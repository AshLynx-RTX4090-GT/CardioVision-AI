// CardioVision dashboard: patient form -> /api/predict -> 3D viewer + explanation charts.
// All charts are hand-built SVG so every number on screen is exact and labelled (no chart library).
import { LEVELS, NEUTRAL, pct, riskColor, riskLevel } from "./risk.js";

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const MINUS = "−";
const UP = "#d1495b", DOWN = "#2a77c9"; // SHAP: raises risk / lowers risk
const signed = (v, d = 1) => (v >= 0 ? "+" : MINUS) + Math.abs(v * 100).toFixed(d) + " pp";

async function api(path, body) {
  const r = await fetch(path, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : undefined);
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || r.statusText);
  return j;
}

const S = {
  schema: null, metrics: null, samples: [], featBy: {}, values: {}, result: null,
  target: "CAD", viewer: null, timer: null, reqId: 0, showAll: false, group: "all",
};

// ============================================================================ init
async function init() {
  try {
    [S.schema, S.metrics, S.samples] = await Promise.all([api("/api/schema"), api("/api/metrics"), api("/api/samples")]);
  } catch (e) {
    document.body.insertAdjacentHTML("afterbegin", `<div class="fatal">Could not reach the API (${esc(e.message)}). Start it with <code>python -m backend.server</code>.</div>`);
    return;
  }
  S.schema.features.forEach((f) => { S.featBy[f.name] = f; S.values[f.name] = f.default; });
  const synth = S.schema.data_source !== "real";
  const badge = $("#source-badge");
  badge.textContent = synth ? "Data: SYNTHETIC stand-in" : "Data: Z-Alizadeh Sani (real)";
  badge.classList.toggle("warn", synth);
  badge.title = synth ? "The real UCI dataset was not found in data/. Metrics and risks below are NOT clinical evidence." : "";

  buildForm();
  buildSamples();
  buildLegend();
  buildTabs();
  buildTargetTabs();
  buildPerformance();
  await initViewer();
  bindControls();
  runPrediction();
}

// ============================================================================ form
function buildForm() {
  const form = $("#patient-form");
  form.innerHTML = "";
  S.schema.groups.forEach((g, gi) => {
    const fs = S.schema.features.filter((f) => f.group === g);
    const d = document.createElement("details");
    d.open = gi < 2;
    d.innerHTML = `<summary>${esc(g)} <span class="count">${fs.length}</span></summary><div class="fields"></div>`;
    const box = $(".fields", d);
    fs.forEach((f) => box.appendChild(fieldEl(f)));
    form.appendChild(d);
  });
  form.addEventListener("input", onFormInput);
  form.addEventListener("change", onFormInput);
}

function fieldEl(f) {
  const w = document.createElement("label");
  w.className = "field " + f.kind;
  if (f.kind === "bin") {
    w.innerHTML = `<input type="checkbox" data-name="${esc(f.name)}"><span class="sw"></span><span class="lbl">${esc(f.label)}</span>`;
  } else if (f.kind === "cat") {
    const opts = [];
    for (let v = f.lo; v <= f.hi; v++) opts.push(`<option value="${v}">${v}</option>`);
    w.innerHTML = `<span class="lbl">${esc(f.label)}</span><select data-name="${esc(f.name)}">${opts.join("")}</select>`;
  } else {
    w.innerHTML = `<span class="lbl">${esc(f.label)}${f.unit ? ` <em>${esc(f.unit)}</em>` : ""}</span>
      <input type="number" step="any" min="${f.lo}" max="${f.hi}" data-name="${esc(f.name)}" ${f.derived ? "readonly tabindex=-1" : ""}>`;
  }
  return w;
}

function pushValuesToForm() {
  document.querySelectorAll("[data-name]").forEach((el) => {
    const v = S.values[el.dataset.name];
    if (el.type === "checkbox") el.checked = v === 1;
    else el.value = v == null ? "" : v;
  });
}

function onFormInput(ev) {
  const el = ev.target;
  const name = el.dataset && el.dataset.name;
  if (!name) return;
  const f = S.featBy[name];
  if (el.type === "checkbox") S.values[name] = el.checked ? 1 : 0;
  else if (el.value === "") S.values[name] = null;
  else S.values[name] = Number(el.value);
  if (name === "Weight" || name === "Length") {
    const w = S.values.Weight, h = S.values.Length;
    if (w && h) {
      S.values.BMI = Math.round((w / (h / 100) ** 2) * 10) / 10;
      const b = document.querySelector('[data-name="BMI"]');
      if (b) b.value = S.values.BMI;
    }
  }
  // inline range feedback
  if (f.kind === "num" && S.values[name] != null) el.classList.toggle("out", S.values[name] < f.lo || S.values[name] > f.hi);
  schedulePrediction();
}

function buildSamples() {
  const sel = $("#sample-select");
  S.samples.forEach((s) => sel.insertAdjacentHTML("beforeend", `<option value="${esc(s.id)}">${esc(s.description)}</option>`));
  sel.addEventListener("change", () => {
    const s = S.samples.find((x) => x.id === sel.value);
    if (!s) return;
    S.schema.features.forEach((f) => (S.values[f.name] = s.features[f.name] ?? null));
    pushValuesToForm();
    runPrediction();
  });
  $("#reset-btn").addEventListener("click", () => {
    S.schema.features.forEach((f) => (S.values[f.name] = f.default));
    $("#sample-select").value = "";
    pushValuesToForm();
    runPrediction();
  });
  pushValuesToForm();
}

// ============================================================================ prediction
function schedulePrediction() {
  clearTimeout(S.timer);
  S.timer = setTimeout(runPrediction, 450);
}

async function runPrediction() {
  clearTimeout(S.timer);
  const id = ++S.reqId;
  const spin = setTimeout(() => ($("#loading").hidden = false), 250);
  try {
    const res = await api("/api/predict", { features: S.values, explain: true });
    if (id !== S.reqId) return; // stale
    S.result = res;
    renderAll();
  } catch (e) {
    $("#warnings").innerHTML = `<div class="warnbox err">${esc(e.message)}</div>`;
  } finally {
    clearTimeout(spin);
    if (id === S.reqId) $("#loading").hidden = true;
  }
}

function renderAll() {
  const r = S.result;
  if (S.viewer) S.viewer.setRisks({ LAD: r.predictions.LAD.probability, LCX: r.predictions.LCX.probability, RCA: r.predictions.RCA.probability });
  renderSummary();
  $("#warnings").innerHTML = r.warnings.length ? `<div class="warnbox">${r.warnings.map((w) => `<div>⚠ ${esc(w)}</div>`).join("")}</div>` : "";
  renderExplain();
}

// ============================================================================ summary cards
function probBar(p) {
  const c = riskColor(p);
  return `<div class="pbar" role="img" aria-label="${pct(p)}"><div class="fill" style="width:${(p * 100).toFixed(1)}%;background:${c}"></div><div class="tick" title="50% classification threshold"></div></div>`;
}

function renderSummary() {
  const P = S.result.predictions;
  const cad = P.CAD, lvl = riskLevel(cad.probability);
  const vessel = (t) => {
    const p = P[t], l = riskLevel(p.probability);
    return `<button class="vcard ${S.target === t ? "active" : ""}" data-target="${t}" style="--c:${riskColor(p.probability)}">
      <div class="vname">${t}<span class="lv">${l.label}</span></div>
      <div class="vval">${pct(p.probability)}</div>
      ${probBar(p.probability)}
      <div class="vsub">${p.positive ? "Stenosis predicted" : "No stenosis predicted"}</div></button>`;
  };
  $("#summary").innerHTML = `
    <button class="cad-card ${S.target === "CAD" ? "active" : ""}" data-target="CAD" style="--c:${riskColor(cad.probability)}">
      <div class="cad-left">
        <div class="k">Overall CAD status</div>
        <div class="status">${cad.positive ? "CAD likely" : "CAD unlikely"}</div>
        <div class="sub">${lvl.label} risk · classification threshold 50%</div>
      </div>
      <div class="cad-right"><div class="big">${pct(cad.probability)}</div>${probBar(cad.probability)}</div>
    </button>
    <div class="vgrid">${["LAD", "LCX", "RCA"].map(vessel).join("")}</div>
    <p class="fine">Vessel probability = chance of ≥50% narrowing of that artery. Models: ${["CAD", "LAD", "LCX", "RCA"].map((t) => `${t} ${esc(P[t].model)} (test AUC ${P[t].test_auc.toFixed(2)})`).join(" · ")}.</p>`;
  document.querySelectorAll("#summary [data-target]").forEach((b) => b.addEventListener("click", () => setTarget(b.dataset.target)));
}

// ============================================================================ target tabs + selection sync
function buildTargetTabs() {
  const box = $("#target-tabs");
  box.innerHTML = S.schema.targets.map((t) => `<button class="ttab" data-target="${t.id}">${t.id === "CAD" ? "Overall CAD" : t.id}</button>`).join("");
  box.addEventListener("click", (e) => { const b = e.target.closest("[data-target]"); if (b) setTarget(b.dataset.target); });
  syncTargetTabs();
}
function syncTargetTabs() {
  document.querySelectorAll("#target-tabs .ttab").forEach((b) => b.classList.toggle("active", b.dataset.target === S.target));
  document.querySelectorAll("#summary [data-target]").forEach((b) => b.classList.toggle("active", b.dataset.target === S.target));
}
function setTarget(t, { fromViewer = false } = {}) {
  S.target = t;
  S.showAll = false;
  syncTargetTabs();
  if (S.result) renderExplain();
  if (S.viewer && !fromViewer) S.viewer.select(t === "CAD" ? null : t);
}

// ============================================================================ explanation
function fmtVal(c) {
  const f = S.featBy[c.name];
  if (c.value == null) return "n/a (imputed)";
  if (f.kind === "bin") return c.value === 1 ? "Yes" : "No";
  const v = Number.isInteger(c.value) ? String(c.value) : c.value.toFixed(1);
  return f.unit ? `${v} ${f.unit}` : v;
}

function renderExplain() {
  const t = S.target, ex = S.result.explanation[t], pr = S.result.predictions[t];
  if (!ex) { $("#explain").innerHTML = ""; return; }
  const name = t === "CAD" ? "overall CAD" : `${t} stenosis`;
  const delta = ex.prediction - ex.base_value;
  const groups = S.schema.groups;
  $("#explain").innerHTML = `
    <section class="card">
      <h3>Why ${esc(name)} risk is ${pct(pr.probability)}</h3>
      <p class="lead">Starting from the cohort-average risk of <b>${pct(ex.base_value)}</b>, this patient's measurements move the estimate by
        <b style="color:${delta >= 0 ? UP : DOWN}">${signed(delta)}</b> to <b>${pct(ex.prediction)}</b>. Each bar is one factor's Shapley contribution in
        <abbr title="percentage points of predicted probability">pp</abbr>; bars add up exactly to the total shift.</p>
      <div class="chart-legend"><span><i style="background:${UP}"></i>raises risk</span><span><i style="background:${DOWN}"></i>lowers risk</span></div>
      ${waterfall(ex)}
    </section>
    <section class="card">
      <h3>Contribution by clinical domain</h3>
      <p class="lead small">Same contributions summed per category (pp). Scale is symmetric around zero.</p>
      ${groupBars(ex)}
    </section>
    <section class="card">
      <div class="card-head"><h3>Physiological measurements &amp; contribution</h3>
        <select id="group-filter"><option value="all">All domains</option>${groups.map((g) => `<option value="${esc(g)}" ${S.group === g ? "selected" : ""}>${esc(g)}</option>`).join("")}</select></div>
      <p class="lead small">Bar under <i>Population range</i>: full cohort min–max, darker band = 5th–95th percentile, tick = median, dot = this patient (red ring = outside the cohort range).</p>
      ${measurementTable(ex)}
    </section>
    <p class="fine">Explanations describe the <b>model's</b> reasoning, not causation. Additivity check: |Σ contributions − (prediction − baseline)| = ${ex.additivity_error.toExponential(1)}.</p>`;
  const gf = $("#group-filter");
  gf.addEventListener("change", () => { S.group = gf.value; renderExplain(); });
  const more = $("#toggle-all");
  if (more) more.addEventListener("click", () => { S.showAll = !S.showAll; renderExplain(); });
}

// ---------------------------------------------------------------- waterfall (probability space)
function waterfall(ex) {
  const TOP = 10;
  const top = ex.contributions.slice(0, TOP);
  const rest = ex.contributions.slice(TOP);
  const rows = [{ kind: "base", label: "Cohort-average risk", end: ex.base_value }];
  let run = ex.base_value;
  top.forEach((c) => { rows.push({ kind: "f", label: `${c.label} = ${fmtVal(c)}`, delta: c.shap, start: run, end: run + c.shap }); run += c.shap; });
  if (rest.length) { const d = rest.reduce((a, c) => a + c.shap, 0); rows.push({ kind: "f", label: `${rest.length} other features`, delta: d, start: run, end: run + d, muted: true }); run += d; }
  rows.push({ kind: "final", label: "Predicted risk", end: run });

  const all = rows.flatMap((r) => (r.start != null ? [r.start, r.end] : [r.end]));
  let lo = Math.max(0, Math.floor((Math.min(...all) - 0.03) * 20) / 20), hi = Math.min(1, Math.ceil((Math.max(...all) + 0.03) * 20) / 20);
  if (hi - lo < 0.2) { const m = (hi + lo) / 2; lo = Math.max(0, m - 0.1); hi = Math.min(1, lo + 0.2); lo = Math.max(0, hi - 0.2); }
  const W = 640, LW = 215, X0 = LW + 12, X1 = W - 74, RH = 28, TOPM = 34, H = TOPM + rows.length * RH + 8;
  const x = (p) => X0 + ((p - lo) / (hi - lo)) * (X1 - X0);
  const step = hi - lo <= 0.3 ? 0.05 : hi - lo <= 0.6 ? 0.1 : 0.2;
  let g = "";
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) {
    g += `<line x1="${x(v)}" x2="${x(v)}" y1="${TOPM - 6}" y2="${H - 6}" class="grid"/><text x="${x(v)}" y="${TOPM - 12}" class="axis" text-anchor="middle">${Math.round(v * 100)}%</text>`;
  }
  let prevX = null;
  rows.forEach((r, i) => {
    const y = TOPM + i * RH, cy = y + RH / 2;
    const lab = r.label.length > 36 ? r.label.slice(0, 35) + "…" : r.label;
    g += `<text x="${LW}" y="${cy + 4}" text-anchor="end" class="rowlab ${r.kind !== "f" ? "strong" : ""} ${r.muted ? "muted" : ""}"><title>${esc(r.label)}</title>${esc(lab)}</text>`;
    if (r.kind === "f") {
      const a = x(Math.min(r.start, r.end)), b = x(Math.max(r.start, r.end)), w = Math.max(b - a, 1.5);
      g += `<rect x="${a}" y="${y + 5}" width="${w}" height="${RH - 10}" rx="2" fill="${r.delta >= 0 ? UP : DOWN}" opacity="${r.muted ? 0.55 : 1}"><title>${esc(r.label)}: ${signed(r.delta, 2)}</title></rect>`;
      g += `<text x="${b + 6}" y="${cy + 4}" class="val">${signed(r.delta)}</text>`;
      if (prevX != null) g += `<line x1="${prevX}" x2="${prevX}" y1="${y - 5}" y2="${y + 5}" class="conn"/>`;
      prevX = x(r.end);
    } else {
      const px = x(r.end);
      g += `<path d="M${px} ${y + 4} l7 ${RH / 2 - 4} l-7 ${RH / 2 - 4} l-7 -${RH / 2 - 4} z" fill="${r.kind === "final" ? riskColor(r.end) : NEUTRAL}" stroke="#1f2937" stroke-width="1"/>`;
      g += `<text x="${px + 13}" y="${cy + 4}" class="val strong">${pct(r.end)}</text>`;
      if (prevX != null && r.kind === "final") g += `<line x1="${prevX}" x2="${prevX}" y1="${y - 5}" y2="${y + 4}" class="conn"/>`;
      prevX = px;
    }
  });
  return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Waterfall of feature contributions">${g}</svg>`;
}

// ---------------------------------------------------------------- domain bars (symmetric diverging)
function groupBars(ex) {
  const items = ex.by_group.slice().sort((a, b) => Math.abs(b.shap) - Math.abs(a.shap));
  const m = Math.max(0.05, Math.ceil(Math.max(...items.map((i) => Math.abs(i.shap))) * 20) / 20);
  const W = 640, LW = 110, X0 = LW + 14, X1 = W - 80, RH = 26, TOPM = 26, H = TOPM + items.length * RH + 6;
  const xm = (X0 + X1) / 2, sx = (v) => xm + (v / m) * ((X1 - X0) / 2);
  let g = "";
  [-m, -m / 2, 0, m / 2, m].forEach((v) => {
    g += `<line x1="${sx(v)}" x2="${sx(v)}" y1="${TOPM - 6}" y2="${H - 4}" class="${v === 0 ? "zero" : "grid"}"/><text x="${sx(v)}" y="${TOPM - 10}" class="axis" text-anchor="middle">${v === 0 ? "0" : (v > 0 ? "+" : MINUS) + Math.abs(v * 100).toFixed(m < 0.1 ? 1 : 0)}</text>`;
  });
  items.forEach((it, i) => {
    const y = TOPM + i * RH, a = sx(Math.min(0, it.shap)), b = sx(Math.max(0, it.shap));
    g += `<text x="${LW}" y="${y + RH / 2 + 4}" text-anchor="end" class="rowlab">${esc(it.group)}</text>
      <rect x="${a}" y="${y + 5}" width="${Math.max(b - a, 1)}" height="${RH - 10}" rx="2" fill="${it.shap >= 0 ? UP : DOWN}"/>
      <text x="${it.shap >= 0 ? b + 6 : a - 6}" y="${y + RH / 2 + 4}" text-anchor="${it.shap >= 0 ? "start" : "end"}" class="val">${signed(it.shap)}</text>`;
  });
  return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Contribution by domain">${g}</svg>`;
}

// ---------------------------------------------------------------- measurement table
function rangeBar(c) {
  const st = S.schema.stats[c.name], W = 130, Hh = 18;
  const span = st.max - st.min || 1, xp = (v) => 4 + ((Math.min(Math.max(v, st.min), st.max) - st.min) / span) * (W - 8);
  const out = c.value != null && (c.value < st.min || c.value > st.max);
  return `<svg viewBox="0 0 ${W} ${Hh}" width="${W}" height="${Hh}" class="rbar" role="img" aria-label="${esc(c.label)} relative to cohort">
    <rect x="4" y="7" width="${W - 8}" height="4" rx="2" fill="#e3e7ee"/>
    <rect x="${xp(st.p5)}" y="6" width="${Math.max(xp(st.p95) - xp(st.p5), 1)}" height="6" rx="2" fill="#b9c3d3"/>
    <line x1="${xp(st.median)}" x2="${xp(st.median)}" y1="3" y2="15" stroke="#5b6678" stroke-width="1.5"/>
    ${c.value == null ? "" : `<circle cx="${xp(c.value)}" cy="9" r="4.5" fill="${c.atypical ? "#d8352a" : "#1f2937"}" stroke="${out ? "#d8352a" : "#fff"}" stroke-width="1.5"/>`}</svg>`;
}

function measurementTable(ex) {
  const maxAbs = Math.max(0.01, ...ex.contributions.map((c) => Math.abs(c.shap)));
  let rows = ex.contributions.filter((c) => S.group === "all" || c.group === S.group);
  const total = rows.length;
  if (!S.showAll) rows = rows.slice(0, 15);
  const cell = (c) => {
    const f = S.featBy[c.name], st = S.schema.stats[c.name];
    const pop = f.kind === "num" ? rangeBar(c) : f.kind === "bin" ? `<span class="muted">${(st.mean * 100).toFixed(0)}% of cohort have this</span>` : `<span class="muted">cohort median ${st.median}</span>`;
    const w = (Math.abs(c.shap) / maxAbs) * 50;
    const bar = `<div class="cbar"><div class="mid"></div><div class="b" style="${c.shap >= 0 ? `left:50%;` : `right:50%;`}width:${w}%;background:${c.shap >= 0 ? UP : DOWN}"></div></div>`;
    return `<tr><td class="m-name">${esc(c.label)}<small>${esc(c.group)}</small></td>
      <td class="m-val ${c.atypical ? "atyp" : ""}">${esc(fmtVal(c))}${c.atypical ? ' <span title="outside cohort 5th–95th percentile">▲</span>' : ""}</td>
      <td>${pop}</td><td class="m-c">${bar}<span class="num" style="color:${c.shap >= 0 ? UP : DOWN}">${signed(c.shap, 2)}</span></td></tr>`;
  };
  return `<div class="tablewrap"><table class="mtable"><thead><tr><th>Measurement</th><th>Value</th><th>Population range</th><th>Contribution</th></tr></thead>
    <tbody>${rows.map(cell).join("")}</tbody></table></div>
    ${total > 15 ? `<button id="toggle-all" class="btn ghost small" type="button">${S.showAll ? "Show top 15" : `Show all ${total}`}</button>` : ""}`;
}

// ============================================================================ performance view
function metricTile(label, v, extra = "") {
  return `<div class="mtile"><div class="ml">${label}</div><div class="mv">${v}</div>${extra ? `<div class="me">${extra}</div>` : ""}</div>`;
}
const f3 = (v) => v.toFixed(3);
const pm = (m) => `${m.mean.toFixed(3)} <small>±${m.sd.toFixed(3)}</small>`;

function rocSvg(tg) {
  const S_ = 250, M = 34, a = S_ - M - 10;
  const x = (v) => M + v * a, y = (v) => 10 + (1 - v) * a;
  const pts = tg.roc.fpr.map((f, i) => [x(f), y(tg.roc.tpr[i])]);
  const path = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  let g = "";
  [0, 0.25, 0.5, 0.75, 1].forEach((v) => {
    g += `<line x1="${x(v)}" x2="${x(v)}" y1="10" y2="${10 + a}" class="grid"/><line x1="${M}" x2="${M + a}" y1="${y(v)}" y2="${y(v)}" class="grid"/>
      <text x="${x(v)}" y="${10 + a + 14}" class="axis" text-anchor="middle">${v}</text><text x="${M - 6}" y="${y(v) + 3}" class="axis" text-anchor="end">${v}</text>`;
  });
  return `<svg viewBox="0 0 ${S_} ${S_ + 12}" class="chart sq" role="img" aria-label="ROC curve">${g}
    <line x1="${x(0)}" y1="${y(0)}" x2="${x(1)}" y2="${y(1)}" stroke="#9aa4b5" stroke-dasharray="4 3"/>
    <path d="${path} L${x(1)} ${y(0)} L${x(0)} ${y(0)} Z" fill="#2a77c9" opacity=".12"/><path d="${path}" fill="none" stroke="#2a77c9" stroke-width="2"/>
    <text x="${x(0.97)}" y="${y(0.1)}" text-anchor="end" class="val strong">AUC ${f3(tg.test.roc_auc)}</text>
    <text x="${M + a / 2}" y="${S_ + 9}" class="axis" text-anchor="middle">False positive rate</text></svg>`;
}

function calibSvg(tg) {
  const S_ = 250, M = 34, a = S_ - M - 10;
  const x = (v) => M + v * a, y = (v) => 10 + (1 - v) * a;
  let g = "";
  [0, 0.25, 0.5, 0.75, 1].forEach((v) => {
    g += `<line x1="${x(v)}" x2="${x(v)}" y1="10" y2="${10 + a}" class="grid"/><line x1="${M}" x2="${M + a}" y1="${y(v)}" y2="${y(v)}" class="grid"/>
      <text x="${x(v)}" y="${10 + a + 14}" class="axis" text-anchor="middle">${v}</text><text x="${M - 6}" y="${y(v) + 3}" class="axis" text-anchor="end">${v}</text>`;
  });
  const pts = tg.calibration, line = pts.map((p, i) => `${i ? "L" : "M"}${x(p.pred)} ${y(p.obs)}`).join(" ");
  const dots = pts.map((p) => `<circle cx="${x(p.pred)}" cy="${y(p.obs)}" r="${3 + Math.sqrt(p.n) * 0.6}" fill="#17a673" fill-opacity=".75" stroke="#0f6b4b"><title>n=${p.n}, predicted ${(p.pred * 100).toFixed(0)}%, observed ${(p.obs * 100).toFixed(0)}%</title></circle>`).join("");
  return `<svg viewBox="0 0 ${S_} ${S_ + 12}" class="chart sq" role="img" aria-label="Calibration plot">${g}
    <line x1="${x(0)}" y1="${y(0)}" x2="${x(1)}" y2="${y(1)}" stroke="#9aa4b5" stroke-dasharray="4 3"/><path d="${line}" fill="none" stroke="#17a673" stroke-width="1.5"/>${dots}
    <text x="${M + a / 2}" y="${S_ + 9}" class="axis" text-anchor="middle">Mean predicted probability</text></svg>`;
}

function confusion(tg) {
  const c = tg.confusion, n = c.tn + c.fp + c.fn + c.tp;
  const cell = (v, good) => `<td class="${good ? "ok" : "bad"}" style="--a:${(0.12 + 0.7 * (v / n)).toFixed(2)}"><b>${v}</b><small>${((v / n) * 100).toFixed(0)}%</small></td>`;
  return `<table class="cm"><thead><tr><th></th><th>Pred. negative</th><th>Pred. positive</th></tr></thead>
    <tbody><tr><th>Actual negative</th>${cell(c.tn, true)}${cell(c.fp, false)}</tr><tr><th>Actual positive</th>${cell(c.fn, false)}${cell(c.tp, true)}</tr></tbody></table>`;
}

function buildPerformance() {
  const M = S.metrics, synth = M.data_source !== "real";
  const targets = S.schema.targets.map((t) => t.id);
  const card = (t) => {
    const tg = M.targets[t], te = tg.test;
    const cvRows = Object.entries(tg.cv).map(([n, m]) => `<tr class="${n === tg.selected ? "sel" : ""}"><td>${esc(n)}${n === tg.selected ? " ✓" : ""}</td>
      <td>${pm(m.roc_auc)}</td><td>${pm(m.f1)}</td><td>${pm(m.accuracy)}</td><td>${pm(m.precision)}</td><td>${pm(m.recall)}</td></tr>`).join("");
    return `<section class="card perf-card">
      <h3>${t === "CAD" ? "Overall CAD" : t} <small>· selected: ${esc(tg.selected)} · prevalence ${pct(M.prevalence[t], 0)} · train n=${tg.n_train}, held-out test n=${tg.n_test}</small></h3>
      <div class="mtiles">${metricTile("Accuracy", f3(te.accuracy))}${metricTile("Precision", f3(te.precision))}${metricTile("Recall", f3(te.recall))}${metricTile("F1-score", f3(te.f1))}
        ${metricTile("ROC-AUC", f3(te.roc_auc), `95% CI ${tg.test_auc_ci95[0].toFixed(2)}–${tg.test_auc_ci95[1].toFixed(2)}`)}${metricTile("Brier ↓", f3(te.brier))}</div>
      <div class="perf-grid">
        <div><h4>ROC curve (held-out test)</h4>${rocSvg(tg)}</div>
        <div><h4>Calibration (held-out test)</h4>${calibSvg(tg)}</div>
        <div><h4>Confusion matrix (threshold ${M.threshold})</h4>${confusion(tg)}</div>
      </div>
      <h4>Model comparison – repeated stratified 5-fold CV ×3 on the training split (mean <small>±sd</small>)</h4>
      <div class="tablewrap"><table class="mtable"><thead><tr><th>Model</th><th>ROC-AUC</th><th>F1</th><th>Accuracy</th><th>Precision</th><th>Recall</th></tr></thead><tbody>${cvRows}</tbody></table></div>
    </section>`;
  };
  $("#view-perf").innerHTML = `
    ${synth ? `<div class="warnbox big"><b>These results come from SYNTHETIC data.</b> The real Z-Alizadeh Sani file was not available in <code>data/</code> when the models were trained, so
      a generated cohort with the same columns was used to exercise the pipeline. Re-run <code>python -m backend.train</code> with the real file to get clinically meaningful numbers.</div>` : ""}
    <section class="card"><h3>Validation protocol</h3>
      <ul class="plain"><li>${M.n_rows} patients · ${M.n_features} input features · targets: Overall CAD, LAD, LCX, RCA.</li>
      <li><b>Leakage control:</b> LAD, LCX, RCA and Cath are never model inputs (enforced in code with an assertion).</li>
      <li>Stratified 80/20 split; the 20% test set is used once, for the selected model. Model choice uses repeated stratified CV on the training part only. Deployed models are refit on all rows.</li>
      <li>With a test set this small, metrics have wide uncertainty – see the bootstrap AUC interval and the CV spread.</li></ul></section>
    ${targets.map(card).join("")}`;
}

// ============================================================================ tabs / legend / viewer
function buildTabs() {
  document.querySelectorAll(".tab").forEach((b) => b.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((x) => x.classList.toggle("active", x === b));
    $("#view-patient").hidden = b.dataset.tab !== "patient";
    $("#view-perf").hidden = b.dataset.tab !== "perf";
    window.dispatchEvent(new Event("resize"));
  }));
}

function buildLegend() {
  const stops = Array.from({ length: 21 }, (_, i) => `${riskColor(i / 20)} ${i * 5}%`).join(",");
  $("#legend-bar").style.background = `linear-gradient(90deg,${stops})`;
  $("#legend-bar").innerHTML = LEVELS.map((l) => `<span style="left:${Math.min(l.max, 1) * 100}%"></span>`).slice(0, 2).join("");
}

async function initViewer() {
  const holder = $("#viewer");
  try {
    const { createViewer } = await import("./viewer.js");
    S.viewer = createViewer(holder, { onSelect: (id) => { if (id && id !== S.target) setTarget(id, { fromViewer: true }); } });
  } catch (e) {
    console.error(e);
    const fb = $("#viewer-fallback");
    fb.hidden = false;
    fb.innerHTML = `<b>3D view unavailable</b><p>${esc(e.message || e)}</p><p>Check your internet connection (Three.js loads from a CDN – see the comment in index.html for offline use) and that WebGL is enabled. The prediction dashboard still works.</p>`;
    document.querySelectorAll(".viewer-toolbar button, .viewer-toolbar input").forEach((el) => (el.disabled = true));
  }
}

function bindControls() {
  const v = () => S.viewer;
  document.querySelectorAll("#view-buttons [data-view]").forEach((b) => b.addEventListener("click", () => v() && v().setView(b.dataset.view)));
  document.querySelectorAll("[data-layer]").forEach((c) => c.addEventListener("change", () => v() && v().setLayer(c.dataset.layer, c.checked)));
  $("#autorotate").addEventListener("change", (e) => v() && v().setAutoRotate(e.target.checked));
  $("#heart-opacity").addEventListener("input", (e) => v() && v().setHeartOpacity(Number(e.target.value)));
  $("#predict-btn").addEventListener("click", runPrediction);
  $("#snap-btn").addEventListener("click", () => {
    if (!v()) return;
    const a = document.createElement("a");
    a.href = v().snapshot();
    a.download = "cardiovision-3d.png";
    a.click();
  });
}

init();
