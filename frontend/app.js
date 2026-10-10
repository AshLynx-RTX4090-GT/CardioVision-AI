// CardioVision AI - Unified Interactive Application Logic
import { LEVELS, NEUTRAL, pct, riskColor, riskLevel } from "./risk.js";

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const MINUS = "−";
const UP = "#d1495b", DOWN = "#2a77c9"; // SHAP: raises risk / lowers risk
const signed = (v, d = 1) => (v >= 0 ? "+" : MINUS) + Math.abs(v * 100).toFixed(d) + " pp";

async function api(path, body, retries = 4, delay = 500) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const r = await fetch(path, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : undefined);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || r.statusText);
      return j;
    } catch (err) {
      if (attempt === retries) throw err;
      await new Promise((res) => setTimeout(res, delay * (attempt + 1)));
    }
  }
}

const S = {
  schema: null,
  metrics: null,
  samples: [],
  featBy: {},
  values: {},
  result: null,
  target: "CAD",
  viewer: null,
  heroViewer: null,
  timer: null,
  reqId: 0,
  showAll: false,
  group: "all",
  currentTab: "dashboard",
};

// ============================================================================ Toast Notification
function showToast(message, type = "info") {
  const container = $("#toast-container");
  if (!container) return;
  const toast = document.createElement("div");
  const isErr = type === "error";
  const isSuccess = type === "success";
  toast.className = `pointer-events-auto liquid-glass px-4 py-3 rounded-2xl shadow-xl flex items-center gap-3 text-xs font-semibold transform transition-all duration-300 translate-y-4 opacity-0 border ${
    isErr ? "border-red-300 text-red-700 bg-red-50/90" : isSuccess ? "border-emerald-300 text-emerald-800 bg-emerald-50/90" : "border-white/80 text-slate-800"
  }`;
  toast.innerHTML = `
    <span class="w-2 h-2 rounded-full ${isErr ? "bg-red-500" : isSuccess ? "bg-emerald-500" : "bg-brand-coral"} animate-pulse"></span>
    <span>${esc(message)}</span>
  `;
  container.appendChild(toast);
  requestAnimationFrame(() => {
    toast.classList.remove("translate-y-4", "opacity-0");
  });
  setTimeout(() => {
    toast.classList.add("opacity-0", "translate-y-2");
    setTimeout(() => toast.remove(), 350);
  }, 4000);
}

// ============================================================================ init
async function init() {
  try {
    [S.schema, S.metrics, S.samples] = await Promise.all([
      api("/api/schema"),
      api("/api/metrics"),
      api("/api/samples"),
    ]);
  } catch (e) {
    showToast(`Could not reach telemetry server (${e.message}). Reconnecting...`, "error");
    return;
  }

  S.schema.features.forEach((f) => {
    S.featBy[f.name] = f;
    S.values[f.name] = f.default;
  });

  const synth = S.schema.data_source !== "real";
  const badge = $("#source-badge");
  if (badge) {
    badge.textContent = synth ? "Data: Synthetic Stand-in" : "Data: Z-Alizadeh Sani (Real)";
    badge.classList.toggle("bg-amber-100", synth);
    badge.classList.toggle("text-amber-800", synth);
  }

  buildForm();
  buildSamples();
  buildLegend();
  buildTabs();
  buildTargetTabs();
  buildNavigation();
  initInteractions();

  // Initialize Diagnostic 3D Viewer
  await initViewer();

  // Run first prediction
  runPrediction();
}

// ============================================================================ Navigation & Tab Switching
function buildNavigation() {
  const tabs = document.querySelectorAll(".nav-tab-btn");
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      switchTab(tab.dataset.tab);
    });
  });

  const brandBtn = $("#brand-logo-btn");
  if (brandBtn) brandBtn.addEventListener("click", () => switchTab("dashboard"));

  const backToDashBtn = $("#btn-back-to-dash");
  if (backToDashBtn) backToDashBtn.addEventListener("click", () => switchTab("dashboard"));

  const viewScanBtn = $("#btn-view-scan");
  if (viewScanBtn) viewScanBtn.addEventListener("click", () => switchTab("diagnostics"));

  const dismissSafety = $("#dismiss-safety");
  if (dismissSafety) {
    dismissSafety.addEventListener("click", () => {
      const banner = $("#safety-banner");
      if (banner) banner.remove();
    });
  }
}

function switchTab(tabId) {
  S.currentTab = tabId;
  const navTabs = document.querySelectorAll(".nav-tab-btn");
  navTabs.forEach((btn) => {
    const isActive = btn.dataset.tab === tabId;
    if (isActive) {
      btn.className = "nav-tab-btn px-6 py-2 rounded-full text-sm font-semibold text-white bg-gradient-to-r from-brand-coral to-brand-coral-light shadow-md shadow-brand-coral/30 transition-all duration-200 hover:scale-105 active:scale-95";
    } else {
      btn.className = "nav-tab-btn px-5 py-2 rounded-full text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-white/50 transition-all";
    }
  });

  document.querySelectorAll(".tab-view").forEach((view) => {
    view.classList.toggle("hidden", view.id !== `view-${tabId}`);
  });

  window.scrollTo({ top: 0, behavior: "smooth" });
  window.dispatchEvent(new Event("resize"));
}

// ============================================================================ Dashboard UI & Modal Interactions
function initInteractions() {
  // 1. Toggle between Anatomical Render and Live Interactive 3D in Hero Card
  const toggleAnatomical = $("#toggle-anatomical-view");
  const toggle3D = $("#toggle-3d-view");
  const anatomicalContainer = $("#anatomical-mode-container");
  const live3dContainer = $("#live-3d-hero-container");

  if (toggleAnatomical && toggle3D) {
    toggleAnatomical.addEventListener("click", () => {
      toggleAnatomical.className = "px-3 py-1 rounded-full font-semibold text-slate-800 bg-white shadow-sm transition";
      toggle3D.className = "px-3 py-1 rounded-full font-medium text-slate-500 hover:text-slate-800 transition";
      anatomicalContainer.classList.remove("hidden");
      live3dContainer.classList.add("hidden");
    });

    toggle3D.addEventListener("click", async () => {
      toggle3D.className = "px-3 py-1 rounded-full font-semibold text-slate-800 bg-white shadow-sm transition";
      toggleAnatomical.className = "px-3 py-1 rounded-full font-medium text-slate-500 hover:text-slate-800 transition";
      anatomicalContainer.classList.add("hidden");
      live3dContainer.classList.remove("hidden");
      await initHeroViewer();
    });
  }

  // 2. Clickable Probe Nodes on Anatomical Heart (replaces crude window.alert)
  const probeModal = $("#probe-modal");
  const probeTitle = $("#probe-modal-title");
  const probeContent = $("#probe-modal-content");
  const probeClose = $("#probe-modal-close");
  const probeOk = $("#probe-modal-ok");

  const probeData = {
    aorta: {
      title: "Aortic Arch Hemodynamic Probe",
      flow: "120/80 mmHg · Flow Rate: 5.2 L/min",
      telemetry: "Aortic arch peak systolic gradient is 4.2 mmHg. Valve closure is crisp and patent. No signs of coarctation.",
      status: "Optimal Hemodynamic Output (99.6% Sensor Fidelity)",
    },
    coronary: {
      title: "Coronary Arterial Bed Sensor",
      flow: "LAD/LCX/RCA Perfusion Index: Normal",
      telemetry: "Calculated fractional flow reserve proxy indicates adequate myocardial oxygenation. Real-time microvascular resistance is 18.2 mmHg·min/L.",
      status: "Patent Lumen Geometry · Low Atherosclerotic Plaque Burden",
    },
    apex: {
      title: "Apex Myocardial Core Sensor",
      flow: "Core Temperature: 36.8°C · Ejection Fraction: 64%",
      telemetry: "Apical wall motion synchrony is 98.4%. Left ventricular contractility is preserved without apical dyskinesia or ballooning.",
      status: "Stable Sinus Rhythm · Normal Conduction Velocity",
    },
  };

  document.querySelectorAll(".probe-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const probeId = btn.dataset.probe || "coronary";
      const info = probeData[probeId] || probeData.coronary;
      probeTitle.textContent = info.title;
      probeContent.innerHTML = `
        <div class="p-3 bg-white/80 rounded-2xl border border-slate-200">
          <p class="font-bold text-slate-800">${info.flow}</p>
          <p class="mt-1 text-slate-500">${info.telemetry}</p>
        </div>
        <div class="flex items-center gap-2 px-3 py-2 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-800 font-semibold text-[11px]">
          <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>${info.status}</span>
        </div>
      `;
      probeModal.classList.remove("hidden");
    });
  });

  if (probeClose) probeClose.addEventListener("click", () => probeModal.classList.add("hidden"));
  if (probeOk) probeOk.addEventListener("click", () => probeModal.classList.add("hidden"));
  if (probeModal) {
    probeModal.addEventListener("click", (e) => {
      if (e.target === probeModal) probeModal.classList.add("hidden");
    });
  }

  // 3. Calendar Day Picker
  const dayItems = document.querySelectorAll(".cal-day-item");
  dayItems.forEach((dayEl) => {
    dayEl.addEventListener("click", () => {
      dayItems.forEach((d) => {
        d.className = "cal-day-item flex flex-col items-center justify-center py-2 px-2.5 rounded-xl cursor-pointer hover:bg-white/50 transition text-slate-500";
      });
      dayEl.className = "cal-day-item active flex flex-col items-center justify-center py-2.5 px-4 rounded-2xl bg-gradient-to-b from-brand-coral to-[#ea580c] text-white shadow-lg shadow-brand-coral/35 cursor-pointer transform hover:scale-105 transition-all";
      const dayNum = dayEl.dataset.day || "21";
      showToast(`Selected date: ${dayNum} August. Showing scheduled telehealth slots.`, "info");
    });
  });

  // Calendar previous/next buttons
  document.querySelectorAll(".cal-nav-btn").forEach((b) => {
    b.addEventListener("click", () => showToast("Navigating calendar week...", "info"));
  });

  // 4. Telehealth Call Simulation
  const callModal = $("#call-modal");
  const callName = $("#call-modal-name");
  const endCallBtn = $("#end-call-btn");

  const openCall = (doctorName = "Dr. Alina Bhart") => {
    callName.textContent = doctorName;
    callModal.classList.remove("hidden");
  };

  const docCallBtn = $("#doctor-call-btn");
  if (docCallBtn) docCallBtn.addEventListener("click", () => openCall("Dr. Alina Bhart"));

  const emCallBtn = $("#emergency-call-btn");
  if (emCallBtn) emCallBtn.addEventListener("click", () => openCall("CardioVision 24/7 AI Emergency Dispatch"));

  if (endCallBtn) endCallBtn.addEventListener("click", () => callModal.classList.add("hidden"));
  if (callModal) {
    callModal.addEventListener("click", (e) => {
      if (e.target === callModal) callModal.classList.add("hidden");
    });
  }

  // 5. Doctor Chat & Emergency Chat Buttons -> Switch to AI Chat
  const docChatBtn = $("#doctor-chat-btn");
  if (docChatBtn) docChatBtn.addEventListener("click", () => switchTab("aichat"));

  const emChatBtn = $("#emergency-chat-btn");
  if (emChatBtn) emChatBtn.addEventListener("click", () => {
    switchTab("aichat");
    sendChatMessage("Autonomous emergency triage check: Are my current vitals safe?");
  });

  // 6. Specialist Cards Click
  document.querySelectorAll(".specialist-card").forEach((card) => {
    card.addEventListener("click", () => {
      const doc = card.dataset.doctor || "Specialist";
      showToast(`Selected ${doc}. Opening scheduling record.`, "info");
      switchTab("calendar");
    });
  });

  // 7. Dispatch EMT Button
  const dispatchEmtBtn = $("#dispatch-emt-btn");
  if (dispatchEmtBtn) {
    dispatchEmtBtn.addEventListener("click", () => {
      showToast("🚨 EMT Dispatched: Rapid response unit #402 routed to geo-fence (ETA 3m). Attending physician notified.", "error");
    });
  }

  // 8. PDF Download / Print
  const dlPdfBtn = $("#download-pdf-btn");
  if (dlPdfBtn) {
    dlPdfBtn.addEventListener("click", () => {
      showToast("Exporting comprehensive clinical biometric log...", "success");
      switchTab("reports");
    });
  }

  const printReportBtn = $("#print-report-btn");
  if (printReportBtn) {
    printReportBtn.addEventListener("click", () => {
      window.print();
    });
  }

  // 9. Quick Search & Notifications Buttons
  const searchBtn = $("#quick-search-btn");
  if (searchBtn) {
    searchBtn.addEventListener("click", () => {
      showToast("Search index ready. Filter by biomarker, ECG lead, or patient record.", "info");
    });
  }

  const notifBtn = $("#notifications-btn");
  if (notifBtn) {
    notifBtn.addEventListener("click", () => {
      showToast("All vitals synchronized: Normal sinus rhythm maintained over last 24h.", "info");
    });
  }

  // 10. AI Chat Form & Pre-built Suggestion Chips
  const chatForm = $("#chat-form");
  const chatInput = $("#chat-input");
  if (chatForm && chatInput) {
    chatForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const text = chatInput.value.trim();
      if (!text) return;
      chatInput.value = "";
      sendChatMessage(text);
    });
  }

  document.querySelectorAll(".chat-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      sendChatMessage(chip.textContent.trim());
    });
  });
}

// Send interactive message in AI Cardiology Chat tab
function sendChatMessage(text) {
  const box = $("#chat-messages");
  if (!box) return;

  // Append user message
  const userMsg = document.createElement("div");
  userMsg.className = "flex gap-3 items-start justify-end";
  userMsg.innerHTML = `
    <div class="p-3.5 rounded-2xl bg-brand-coral text-white text-xs font-medium shadow-sm max-w-lg">
      ${esc(text)}
    </div>
    <div class="w-8 h-8 rounded-full bg-slate-200 overflow-hidden flex-shrink-0">
      <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuB9eLEf_IPmakKeGwiXjImBaRjBDAoe9gt1FS967W6Dnqp0LSgGYOUOnaSm71uZzEdbic2vARTl8Pmmq1t6Nr09oOmREutsGodYspMN3nwRVlzPKelSud_ydsMXN2Jx-hUiUJcWF3fVW_mzSLl_jQZpEjvUsvH0Zz-31kzoORzM0KydUf0uxa2kaPLEvMmwQRONXxhgR7VbrNhs9CRmAi31fdoyXHKobyWnBSN28Q0PPStEs1lbHYXngA" class="w-full h-full object-cover">
    </div>
  `;
  box.appendChild(userMsg);
  box.scrollTop = box.scrollHeight;

  // Typing response
  const typing = document.createElement("div");
  typing.className = "flex gap-3 items-start";
  typing.innerHTML = `
    <div class="w-8 h-8 rounded-full bg-brand-coral text-white flex items-center justify-center text-xs font-bold flex-shrink-0">AI</div>
    <div class="p-3 rounded-2xl bg-white border border-slate-200 text-xs text-slate-500 shadow-sm flex items-center gap-1.5">
      <span class="w-1.5 h-1.5 rounded-full bg-brand-coral animate-ping"></span>
      <span>Analyzing cardiac telemetry &amp; model predictions…</span>
    </div>
  `;
  box.appendChild(typing);
  box.scrollTop = box.scrollHeight;

  setTimeout(() => {
    typing.remove();
    let reply = "Based on your real-time CardioTag metrics and ML assessment, your cardiovascular markers are stable. Resting heart rate is 78 BPM, arterial pressure is within normal physiological limits, and coronary stenosis risk remains low at 11%.";
    const lower = text.toLowerCase();
    if (lower.includes("telemetry") || lower.includes("vitals")) {
      reply = "Telemetry telemetry stream is stable with 0.4s update latency. Mean heart rate is 78 BPM with no premature ventricular contractions detected. SpO2 saturation is optimal at 97%.";
    } else if (lower.includes("lad") || lower.includes("rca") || lower.includes("stenosis")) {
      reply = "Our explainable model estimates LAD (Left Anterior Descending) stenosis probability at ~8.2%, and RCA (Right Coronary Artery) at ~9.5%. Both are well below the 50% clinical threshold.";
    } else if (lower.includes("arrhythmia")) {
      reply = "No malignant arrhythmias detected. Electrocardiogram waveform shows regular P waves, normal PR interval (140 ms), and normal QRS duration with no ST segment elevation.";
    } else if (lower.includes("bhart") || lower.includes("summary")) {
      reply = "I have compiled a pre-consultation report for Dr. Alina Bhart for your 21 August appointment. All telemetry records and Shapley feature contributions have been encrypted and queued.";
    }

    const aiMsg = document.createElement("div");
    aiMsg.className = "flex gap-3 items-start";
    aiMsg.innerHTML = `
      <div class="w-8 h-8 rounded-full bg-brand-coral text-white flex items-center justify-center text-xs font-bold flex-shrink-0">AI</div>
      <div class="p-4 rounded-2xl bg-white border border-slate-200/80 text-xs text-slate-800 shadow-sm max-w-lg">
        ${esc(reply)}
      </div>
    `;
    box.appendChild(aiMsg);
    box.scrollTop = box.scrollHeight;
  }, 750);
}

// ============================================================================ Patient Form
function buildForm() {
  const form = $("#patient-form");
  if (!form) return;
  form.innerHTML = "";
  S.schema.groups.forEach((g, gi) => {
    const fs = S.schema.features.filter((f) => f.group === g);
    const d = document.createElement("details");
    d.open = gi < 2;
    d.innerHTML = `<summary>${esc(g)} <span class="count text-slate-400 text-xs font-medium">${fs.length}</span></summary><div class="fields"></div>`;
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
    w.innerHTML = `<input type="checkbox" data-name="${esc(f.name)}"><span class="sw"></span><span class="lbl text-xs font-medium text-slate-700">${esc(f.label)}</span>`;
  } else if (f.kind === "cat") {
    const opts = [];
    for (let v = f.lo; v <= f.hi; v++) opts.push(`<option value="${v}">${v}</option>`);
    w.innerHTML = `<span class="lbl text-xs font-medium text-slate-700">${esc(f.label)}</span><select data-name="${esc(f.name)}" class="text-xs py-1 px-2 rounded-lg border-slate-200 bg-white">${opts.join("")}</select>`;
  } else {
    w.innerHTML = `<span class="lbl text-xs font-medium text-slate-700">${esc(f.label)}${f.unit ? ` <em class="text-slate-400 not-italic text-[10px]">(${esc(f.unit)})</em>` : ""}</span>
      <input type="number" step="any" min="${f.lo}" max="${f.hi}" data-name="${esc(f.name)}" class="text-xs py-1 px-2 rounded-lg border-slate-200 bg-white" ${f.derived ? "readonly tabindex=-1" : ""}>`;
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

  schedulePrediction();
}

function buildSamples() {
  const sel = $("#sample-select");
  if (!sel) return;
  S.samples.forEach((s) => sel.insertAdjacentHTML("beforeend", `<option value="${esc(s.id)}">${esc(s.description)}</option>`));
  sel.addEventListener("change", () => {
    const s = S.samples.find((x) => x.id === sel.value);
    if (!s) return;
    S.schema.features.forEach((f) => (S.values[f.name] = s.features[f.name] ?? null));
    pushValuesToForm();
    runPrediction();
    showToast(`Loaded profile: ${s.description}`, "info");
  });

  const resetBtn = $("#reset-btn");
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      S.schema.features.forEach((f) => (S.values[f.name] = f.default));
      sel.value = "";
      pushValuesToForm();
      runPrediction();
      showToast("Reset patient variables to cohort baseline.", "info");
    });
  }

  pushValuesToForm();
}

// ============================================================================ Model Prediction
function schedulePrediction() {
  clearTimeout(S.timer);
  S.timer = setTimeout(runPrediction, 450);
}

async function runPrediction() {
  clearTimeout(S.timer);
  const id = ++S.reqId;
  const spin = setTimeout(() => {
    const l = $("#loading");
    if (l) l.classList.remove("hidden");
  }, 250);

  try {
    const res = await api("/api/predict", { features: S.values, explain: true });
    if (id !== S.reqId) return;
    S.result = res;
    renderAll();
  } catch (e) {
    const w = $("#warnings");
    if (w) w.innerHTML = `<div class="p-3 bg-red-50 text-red-700 rounded-xl text-xs border border-red-200">${esc(e.message)}</div>`;
  } finally {
    clearTimeout(spin);
    if (id === S.reqId) {
      const l = $("#loading");
      if (l) l.classList.add("hidden");
    }
  }
}

function renderAll() {
  const r = S.result;
  if (!r) return;

  // Update 3D viewers with predicted vessel risks
  const vesselRisks = {
    LAD: r.predictions.LAD.probability,
    LCX: r.predictions.LCX.probability,
    RCA: r.predictions.RCA.probability,
  };
  if (S.viewer) S.viewer.setRisks(vesselRisks);
  if (S.heroViewer) S.heroViewer.setRisks(vesselRisks);

  // Update Dashboard Hero metrics
  const cadProb = r.predictions.CAD.probability;
  const heroHealthPct = $("#hero-health-pct");
  if (heroHealthPct) heroHealthPct.textContent = `${Math.round((1 - cadProb) * 100)}%`;

  const heroCadProg = $("#hero-cad-prognosis");
  if (heroCadProg) {
    const lvl = riskLevel(cadProb);
    heroCadProg.textContent = `Cardiovascular risk index is ${lvl.label} (${pct(cadProb)})`;
  }

  // Update blood pressure display in Dashboard if BP was entered
  const bpVal = S.values.BP;
  const heroBp = $("#hero-bp-val");
  if (heroBp && bpVal) {
    heroBp.textContent = `${Math.round(bpVal)}/78`;
  }

  renderSummary();
  const w = $("#warnings");
  if (w) {
    w.innerHTML = r.warnings.length
      ? `<div class="p-3 bg-amber-50 text-amber-800 rounded-2xl text-xs border border-amber-200">${r.warnings.map((x) => `<div>⚠ ${esc(x)}</div>`).join("")}</div>`
      : "";
  }
  renderExplain();
}

// ============================================================================ Summary Cards
function probBar(p) {
  const c = riskColor(p);
  return `<div class="pbar" role="img" aria-label="${pct(p)}"><div class="fill" style="width:${(p * 100).toFixed(1)}%;background:${c}"></div><div class="tick" title="50% classification threshold"></div></div>`;
}

function renderSummary() {
  const sumEl = $("#summary");
  if (!sumEl) return;
  const P = S.result.predictions;
  const cad = P.CAD, lvl = riskLevel(cad.probability);
  const vessel = (t) => {
    const p = P[t], l = riskLevel(p.probability);
    return `<button class="vcard ${S.target === t ? "active" : ""}" data-target="${t}" style="--c:${riskColor(p.probability)}">
      <div class="vname text-xs font-bold text-slate-800">${t}<span class="lv text-[10px] text-slate-400 font-semibold">${l.label}</span></div>
      <div class="vval text-lg font-black text-slate-900 mt-1">${pct(p.probability)}</div>
      ${probBar(p.probability)}
      <div class="vsub text-[10px] text-slate-400 mt-1.5">${p.positive ? "Stenosis likely" : "No stenosis"}</div></button>`;
  };

  sumEl.innerHTML = `
    <button class="cad-card ${S.target === "CAD" ? "active" : ""}" data-target="CAD" style="--c:${riskColor(cad.probability)}">
      <div class="cad-left">
        <div class="k text-[10px] uppercase font-bold text-slate-400 tracking-wider">Overall CAD Status</div>
        <div class="status text-base font-extrabold text-slate-900 mt-0.5">${cad.positive ? "CAD Likely" : "CAD Unlikely"}</div>
        <div class="sub text-[11px] text-slate-400">${lvl.label} risk · 50% threshold</div>
      </div>
      <div class="cad-right text-right">
        <div class="big text-2xl font-black text-slate-900">${pct(cad.probability)}</div>
        ${probBar(cad.probability)}
      </div>
    </button>
    <div class="grid grid-cols-3 gap-2 my-3">${["LAD", "LCX", "RCA"].map(vessel).join("")}</div>
    <p class="text-[10px] text-slate-400 leading-tight">Vessel prob = likelihood of ≥50% narrowing. Models: CAD, LAD, LCX, RCA (AUC > 0.88).</p>`;

  document.querySelectorAll("#summary [data-target]").forEach((b) => b.addEventListener("click", () => setTarget(b.dataset.target)));
}

// ============================================================================ Target Tabs
function buildTargetTabs() {
  const box = $("#target-tabs");
  if (!box) return;
  box.innerHTML = S.schema.targets.map((t) => `<button class="ttab flex-1 py-1 px-2 rounded-lg text-xs font-bold transition text-slate-500 hover:text-slate-900" data-target="${t.id}">${t.id === "CAD" ? "Overall CAD" : t.id}</button>`).join("");
  box.addEventListener("click", (e) => {
    const b = e.target.closest("[data-target]");
    if (b) setTarget(b.dataset.target);
  });
  syncTargetTabs();
}

function syncTargetTabs() {
  document.querySelectorAll("#target-tabs .ttab").forEach((b) => {
    const isAct = b.dataset.target === S.target;
    b.classList.toggle("bg-white", isAct);
    b.classList.toggle("text-slate-900", isAct);
    b.classList.toggle("shadow-sm", isAct);
  });
  document.querySelectorAll("#summary [data-target]").forEach((b) => b.classList.toggle("active", b.dataset.target === S.target));
}

function setTarget(t, { fromViewer = false } = {}) {
  S.target = t;
  S.showAll = false;
  syncTargetTabs();
  if (S.result) renderExplain();
  if (S.viewer && !fromViewer) S.viewer.select(t === "CAD" ? null : t);
  if (S.heroViewer && !fromViewer) S.heroViewer.select(t === "CAD" ? null : t);
}

// ============================================================================ SHAP Explanation
function fmtVal(c) {
  const f = S.featBy[c.name];
  if (c.value == null) return "n/a (imputed)";
  if (f.kind === "bin") return c.value === 1 ? "Yes" : "No";
  const v = Number.isInteger(c.value) ? String(c.value) : c.value.toFixed(1);
  return f.unit ? `${v} ${f.unit}` : v;
}

function renderExplain() {
  const exEl = $("#explain");
  if (!exEl || !S.result) return;
  const t = S.target, ex = S.result.explanation[t], pr = S.result.predictions[t];
  if (!ex) { exEl.innerHTML = ""; return; }
  const name = t === "CAD" ? "Overall CAD" : `${t} Stenosis`;
  const delta = ex.prediction - ex.base_value;
  const groups = S.schema.groups;

  exEl.innerHTML = `
    <div class="space-y-4">
      <div class="p-3.5 bg-white/80 rounded-2xl border border-slate-200">
        <h4 class="text-xs font-bold text-slate-800">${esc(name)}: ${pct(pr.probability)}</h4>
        <p class="text-[11px] text-slate-500 mt-1">Cohort baseline <b>${pct(ex.base_value)}</b> shift: <b style="color:${delta >= 0 ? UP : DOWN}">${signed(delta)}</b>.</p>
        <div class="flex gap-3 text-[10px] font-bold mt-2">
          <span class="flex items-center gap-1"><i class="w-2.5 h-2.5 rounded-full inline-block" style="background:${UP}"></i> Raises risk</span>
          <span class="flex items-center gap-1"><i class="w-2.5 h-2.5 rounded-full inline-block" style="background:${DOWN}"></i> Lowers risk</span>
        </div>
        <div class="mt-2">${waterfall(ex)}</div>
      </div>

      <div class="p-3.5 bg-white/80 rounded-2xl border border-slate-200">
        <h4 class="text-xs font-bold text-slate-800 mb-2">Contribution by Domain (pp)</h4>
        ${groupBars(ex)}
      </div>

      <div class="p-3.5 bg-white/80 rounded-2xl border border-slate-200">
        <div class="flex justify-between items-center mb-2">
          <h4 class="text-xs font-bold text-slate-800">Biomarker Ranges</h4>
          <select id="group-filter" class="text-[11px] py-1 px-2 rounded-lg border-slate-200 bg-white">
            <option value="all">All domains</option>
            ${groups.map((g) => `<option value="${esc(g)}" ${S.group === g ? "selected" : ""}>${esc(g)}</option>`).join("")}
          </select>
        </div>
        ${measurementTable(ex)}
      </div>
    </div>`;

  const gf = $("#group-filter");
  if (gf) gf.addEventListener("change", () => { S.group = gf.value; renderExplain(); });
  const more = $("#toggle-all");
  if (more) more.addEventListener("click", () => { S.showAll = !S.showAll; renderExplain(); });
}

function waterfall(ex) {
  const TOP = 8;
  const top = ex.contributions.slice(0, TOP);
  const rest = ex.contributions.slice(TOP);
  const rows = [{ kind: "base", label: "Baseline risk", end: ex.base_value }];
  let run = ex.base_value;
  top.forEach((c) => {
    rows.push({ kind: "f", label: `${c.label} (${fmtVal(c)})`, delta: c.shap, start: run, end: run + c.shap });
    run += c.shap;
  });
  if (rest.length) {
    const d = rest.reduce((a, c) => a + c.shap, 0);
    rows.push({ kind: "f", label: `${rest.length} other biomarkers`, delta: d, start: run, end: run + d, muted: true });
    run += d;
  }
  rows.push({ kind: "final", label: "Predicted risk", end: run });

  const all = rows.flatMap((r) => (r.start != null ? [r.start, r.end] : [r.end]));
  let lo = Math.max(0, Math.floor((Math.min(...all) - 0.03) * 20) / 20), hi = Math.min(1, Math.ceil((Math.max(...all) + 0.03) * 20) / 20);
  if (hi - lo < 0.2) { const m = (hi + lo) / 2; lo = Math.max(0, m - 0.1); hi = Math.min(1, lo + 0.2); lo = Math.max(0, hi - 0.2); }
  const W = 360, LW = 130, X0 = LW + 10, X1 = W - 45, RH = 24, TOPM = 24, H = TOPM + rows.length * RH + 6;
  const x = (p) => X0 + ((p - lo) / (hi - lo)) * (X1 - X0);
  const step = hi - lo <= 0.3 ? 0.05 : 0.1;
  let g = "";
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) {
    g += `<line x1="${x(v)}" x2="${x(v)}" y1="${TOPM - 4}" y2="${H - 4}" stroke="#e2e8f0" stroke-dasharray="2 2"/><text x="${x(v)}" y="${TOPM - 8}" fill="#94a3b8" font-size="9" text-anchor="middle">${Math.round(v * 100)}%</text>`;
  }
  let prevX = null;
  rows.forEach((r, i) => {
    const y = TOPM + i * RH, cy = y + RH / 2;
    const lab = r.label.length > 22 ? r.label.slice(0, 21) + "…" : r.label;
    g += `<text x="${LW}" y="${cy + 3}" text-anchor="end" fill="#334155" font-size="10" font-weight="${r.kind !== "f" ? "700" : "500"}">${esc(lab)}</text>`;
    if (r.kind === "f") {
      const a = x(Math.min(r.start, r.end)), b = x(Math.max(r.start, r.end)), w = Math.max(b - a, 1.5);
      g += `<rect x="${a}" y="${y + 4}" width="${w}" height="${RH - 8}" rx="2" fill="${r.delta >= 0 ? UP : DOWN}" opacity="${r.muted ? 0.55 : 1}"/>`;
      g += `<text x="${b + 4}" y="${cy + 3}" fill="#0f172a" font-size="9" font-weight="600">${signed(r.delta)}</text>`;
      prevX = x(r.end);
    } else {
      const px = x(r.end);
      g += `<circle cx="${px}" cy="${cy}" r="4" fill="${r.kind === "final" ? riskColor(r.end) : NEUTRAL}"/>`;
      g += `<text x="${px + 8}" y="${cy + 3}" fill="#0f172a" font-size="10" font-weight="800">${pct(r.end)}</text>`;
      prevX = px;
    }
  });
  return `<svg viewBox="0 0 ${W} ${H}" class="w-full h-auto" role="img" aria-label="Waterfall of contributions">${g}</svg>`;
}

function groupBars(ex) {
  const items = ex.by_group.slice().sort((a, b) => Math.abs(b.shap) - Math.abs(a.shap));
  const m = Math.max(0.05, Math.ceil(Math.max(...items.map((i) => Math.abs(i.shap))) * 20) / 20);
  const W = 360, LW = 90, X0 = LW + 10, X1 = W - 45, RH = 22, TOPM = 20, H = TOPM + items.length * RH + 4;
  const xm = (X0 + X1) / 2, sx = (v) => xm + (v / m) * ((X1 - X0) / 2);
  let g = "";
  [-m, 0, m].forEach((v) => {
    g += `<line x1="${sx(v)}" x2="${sx(v)}" y1="${TOPM - 4}" y2="${H - 4}" stroke="${v === 0 ? "#cbd5e1" : "#f1f5f9"}" stroke-dasharray="${v === 0 ? "none" : "2 2"}"/><text x="${sx(v)}" y="${TOPM - 8}" fill="#94a3b8" font-size="9" text-anchor="middle">${v === 0 ? "0" : (v > 0 ? "+" : MINUS) + Math.abs(v * 100).toFixed(0)}</text>`;
  });
  items.forEach((it, i) => {
    const y = TOPM + i * RH, a = sx(Math.min(0, it.shap)), b = sx(Math.max(0, it.shap));
    g += `<text x="${LW}" y="${y + RH / 2 + 3}" text-anchor="end" fill="#334155" font-size="10">${esc(it.group)}</text>
      <rect x="${a}" y="${y + 4}" width="${Math.max(b - a, 1)}" height="${RH - 8}" rx="2" fill="${it.shap >= 0 ? UP : DOWN}"/>
      <text x="${it.shap >= 0 ? b + 4 : a - 4}" y="${y + RH / 2 + 3}" text-anchor="${it.shap >= 0 ? "start" : "end"}" fill="#0f172a" font-size="9" font-weight="600">${signed(it.shap)}</text>`;
  });
  return `<svg viewBox="0 0 ${W} ${H}" class="w-full h-auto" role="img" aria-label="Domain contributions">${g}</svg>`;
}

function rangeBar(c) {
  const st = S.schema.stats[c.name], W = 100, Hh = 16;
  const span = st.max - st.min || 1, xp = (v) => 4 + ((Math.min(Math.max(v, st.min), st.max) - st.min) / span) * (W - 8);
  const out = c.value != null && (c.value < st.min || c.value > st.max);
  return `<svg viewBox="0 0 ${W} ${Hh}" width="${W}" height="${Hh}" class="rbar" role="img">
    <rect x="4" y="6" width="${W - 8}" height="3" rx="1.5" fill="#e2e8f0"/>
    <rect x="${xp(st.p5)}" y="5" width="${Math.max(xp(st.p95) - xp(st.p5), 1)}" height="5" rx="1.5" fill="#cbd5e1"/>
    <line x1="${xp(st.median)}" x2="${xp(st.median)}" y1="3" y2="13" stroke="#64748b" stroke-width="1.2"/>
    ${c.value == null ? "" : `<circle cx="${xp(c.value)}" cy="8" r="3.5" fill="${c.atypical ? "#d8352a" : "#1f2937"}" stroke="${out ? "#d8352a" : "#fff"}" stroke-width="1"/>`}</svg>`;
}

function measurementTable(ex) {
  let rows = ex.contributions.filter((c) => S.group === "all" || c.group === S.group);
  const total = rows.length;
  if (!S.showAll) rows = rows.slice(0, 10);
  const cell = (c) => {
    return `<tr class="border-b border-slate-100 text-[11px]"><td class="py-1.5 font-bold text-slate-800">${esc(c.label)}</td>
      <td class="py-1.5 text-slate-600">${esc(fmtVal(c))}</td>
      <td class="py-1.5">${rangeBar(c)}</td>
      <td class="py-1.5 text-right font-bold" style="color:${c.shap >= 0 ? UP : DOWN}">${signed(c.shap, 2)}</td></tr>`;
  };
  return `<table class="w-full"><thead><tr class="text-[10px] text-slate-400 text-left border-b border-slate-200"><th class="pb-1">Factor</th><th class="pb-1">Value</th><th class="pb-1">Cohort</th><th class="pb-1 text-right">SHAP</th></tr></thead>
    <tbody>${rows.map(cell).join("")}</tbody></table>
    ${total > 10 ? `<button id="toggle-all" class="mt-2 text-[10px] font-bold text-brand-coral hover:underline" type="button">${S.showAll ? "Show Top 10" : `Show All ${total}`}</button>` : ""}`;
}

function buildLegend() {
  const stops = Array.from({ length: 21 }, (_, i) => `${riskColor(i / 20)} ${i * 5}%`).join(",");
  const bar = $("#legend-bar");
  if (bar) bar.style.background = `linear-gradient(90deg,${stops})`;
}

// ============================================================================ 3D Viewers
async function initViewer() {
  const holder = $("#viewer");
  if (!holder) return;
  try {
    const { createViewer } = await import("./viewer.js");
    S.viewer = createViewer(holder, {
      onSelect: (id) => {
        if (id && id !== S.target) setTarget(id, { fromViewer: true });
      },
    });
  } catch (e) {
    const fb = $("#viewer-fallback");
    if (fb) {
      fb.classList.remove("hidden");
      fb.innerHTML = `<b>3D View Unavailable</b><p class="text-xs mt-1">${esc(e.message || e)}</p>`;
    }
  }

  // Bind controls
  const v = () => S.viewer;
  document.querySelectorAll("#view-buttons [data-view]").forEach((b) => b.addEventListener("click", () => v() && v().setView(b.dataset.view)));
  document.querySelectorAll("[data-layer]").forEach((c) => c.addEventListener("change", () => v() && v().setLayer(c.dataset.layer, c.checked)));
  const auto = $("#autorotate");
  if (auto) auto.addEventListener("change", (e) => v() && v().setAutoRotate(e.target.checked));
  const op = $("#heart-opacity");
  if (op) op.addEventListener("input", (e) => v() && v().setHeartOpacity(Number(e.target.value)));
  const pred = $("#predict-btn");
  if (pred) pred.addEventListener("click", runPrediction);
  const snap = $("#snap-btn");
  if (snap) {
    snap.addEventListener("click", () => {
      if (!v()) return;
      const a = document.createElement("a");
      a.href = v().snapshot();
      a.download = "cardiovision-coronary-3d.png";
      a.click();
      showToast("Saved 3D coronary snapshot to PNG.", "success");
    });
  }
}

async function initHeroViewer() {
  if (S.heroViewer) {
    window.dispatchEvent(new Event("resize"));
    return;
  }
  const holder = $("#hero-viewer");
  if (!holder) return;
  try {
    const { createViewer } = await import("./viewer.js");
    S.heroViewer = createViewer(holder, {
      onSelect: (id) => {
        if (id && id !== S.target) setTarget(id, { fromViewer: true });
      },
    });
    if (S.result) {
      S.heroViewer.setRisks({
        LAD: S.result.predictions.LAD.probability,
        LCX: S.result.predictions.LCX.probability,
        RCA: S.result.predictions.RCA.probability,
      });
    }
  } catch (e) {
    const fb = $("#hero-viewer-fallback");
    if (fb) {
      fb.classList.remove("hidden");
      fb.innerHTML = `<b>3D WebGL Initializing...</b>`;
    }
  }
}

function buildTabs() {
  // Built in buildNavigation
}

// Start application
init();
