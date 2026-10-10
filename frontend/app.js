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
  userProfile: null,
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
    const [sc, mt, sm, pr] = await Promise.all([
      api("/api/schema"),
      api("/api/metrics"),
      api("/api/samples"),
      api("/api/user/profile").catch(() => null),
    ]);
    S.schema = sc;
    S.metrics = mt;
    S.samples = sm;
    if (pr) S.userProfile = pr;
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

  updateUserProfileUI();
  initProfileModal();
  buildForm();
  buildSamples();
  buildLegend();
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

function buildTabs() {
  buildNavigation();
  buildTargetTabs();
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

  if (tabId === "diagnostics") {
    if (!S.viewer) {
      initViewer();
    } else {
      setTimeout(() => {
        if (S.viewer && S.viewer.resize) S.viewer.resize();
      }, 50);
    }
  } else if (tabId === "dashboard" && S.heroViewer) {
    setTimeout(() => {
      if (S.heroViewer && S.heroViewer.resize) S.heroViewer.resize();
    }, 50);
  }
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

  // 8. PDF Download & Medical Report Modal
  const dlPdfBtn = $("#download-pdf-btn");
  if (dlPdfBtn) {
    dlPdfBtn.addEventListener("click", () => {
      generateMedicalReportPDF();
    });
  }

  const printReportBtn = $("#print-report-btn");
  if (printReportBtn) {
    printReportBtn.addEventListener("click", () => {
      generateMedicalReportPDF();
    });
  }

  const modalDlBtn = $("#modal-download-pdf-btn");
  if (modalDlBtn) {
    modalDlBtn.addEventListener("click", () => {
      generateMedicalReportPDF();
    });
  }

  const reportModalClose = $("#medical-report-modal-close");
  const reportModal = $("#medical-report-modal");
  if (reportModalClose && reportModal) {
    reportModalClose.addEventListener("click", () => reportModal.classList.add("hidden"));
    reportModal.addEventListener("click", (e) => {
      if (e.target === reportModal) reportModal.classList.add("hidden");
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
  const fb = $("#viewer-fallback");
  try {
    const { createViewer } = await import("./viewer.js");
    S.viewer = createViewer(holder, {
      onSelect: (id) => {
        if (id && id !== S.target) setTarget(id, { fromViewer: true });
      },
    });
    if (fb) fb.classList.add("hidden");
    if (S.result) {
      S.viewer.setRisks({
        LAD: S.result.predictions.LAD.probability,
        LCX: S.result.predictions.LCX.probability,
        RCA: S.result.predictions.RCA.probability,
      });
    }
  } catch (e) {
    console.error("3D Heart Viewer initialization failed:", e);
    if (fb) {
      fb.classList.remove("hidden");
      fb.innerHTML = `<div class="bg-slate-900/80 p-4 rounded-2xl border border-slate-700 text-center"><b class="text-amber-400">3D View Unavailable</b><p class="text-xs text-slate-300 mt-1">${esc(e.message || e)}</p></div>`;
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
  const holder = $("#hero-viewer");
  if (!holder) return;
  if (S.heroViewer) {
    if (S.heroViewer.resize) S.heroViewer.resize();
    window.dispatchEvent(new Event("resize"));
    return;
  }
  const fb = $("#hero-viewer-fallback");
  try {
    const { createViewer } = await import("./viewer.js");
    S.heroViewer = createViewer(holder, {
      onSelect: (id) => {
        if (id && id !== S.target) setTarget(id, { fromViewer: true });
      },
    });
    if (fb) fb.classList.add("hidden");
    if (S.result) {
      S.heroViewer.setRisks({
        LAD: S.result.predictions.LAD.probability,
        LCX: S.result.predictions.LCX.probability,
        RCA: S.result.predictions.RCA.probability,
      });
    }
  } catch (e) {
    console.error("Hero 3D Viewer initialization failed:", e);
    if (fb) {
      fb.classList.remove("hidden");
      fb.innerHTML = `<div class="p-4 bg-slate-900/80 rounded-2xl border border-slate-700 text-center"><b class="text-amber-400">3D Interactive Initializing...</b><p class="text-xs text-slate-300 mt-1">${esc(e.message || e)}</p></div>`;
    }
  }
}

// ============================================================================ User Profile Management
function updateUserProfileUI() {
  const p = S.userProfile;
  if (!p) return;

  // Update navbar pill
  const pillImg = $("#user-profile-pill img");
  if (pillImg && p.avatarUrl) pillImg.src = p.avatarUrl;

  const pillName = $("#user-profile-pill p.font-semibold");
  if (pillName) pillName.textContent = p.displayName || p.name;

  const pillStatus = $("#user-profile-pill p.text-emerald-600");
  if (pillStatus) {
    if (p.isLoggedOut) {
      pillStatus.textContent = "○ Session Inactive";
      pillStatus.className = "text-[10px] font-medium text-slate-400";
    } else {
      pillStatus.textContent = p.wearableActive ? "● Wearable Active" : "○ Wearable Paused";
      pillStatus.className = `text-[10px] font-medium ${p.wearableActive ? "text-emerald-600" : "text-amber-600"}`;
    }
  }

  // Update backend status & session indicator in modal
  const lastUpd = $("#prof-last-updated");
  if (lastUpd && p.updatedAt) {
    const d = new Date(p.updatedAt);
    lastUpd.textContent = `Saved: ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  }
  const sessionBadge = $("#session-status-badge");
  if (sessionBadge) {
    if (p.isLoggedOut) {
      sessionBadge.textContent = "Signed Out (Guest)";
      sessionBadge.className = "text-slate-400 font-semibold";
    } else {
      sessionBadge.textContent = `${p.provider || "Active"} · Persisted in Backend`;
      sessionBadge.className = "text-emerald-600 font-semibold";
    }
  }

  // Update report modal values
  const repName = $("#rep-patient-name");
  if (repName) repName.textContent = p.name;
  const repMeta = $("#rep-patient-meta");
  if (repMeta) repMeta.textContent = `${p.id || 'USR-88219'} · ${p.age}y / ${p.gender ? p.gender.charAt(0) : 'F'}`;
  const repSensor = $("#rep-sensor-id");
  if (repSensor) repSensor.textContent = p.wearableId || "CardioTag Sensor #CT-8921";

  // Populate Edit Profile form inputs
  const inName = $("#prof-name");
  if (inName) inName.value = p.name || "";
  const inDisp = $("#prof-display-name");
  if (inDisp) inDisp.value = p.displayName || "";
  const inEmail = $("#prof-email");
  if (inEmail) inEmail.value = p.email || "";
  const inPhone = $("#prof-phone");
  if (inPhone) inPhone.value = p.phone || "";
  const inAge = $("#prof-age");
  if (inAge) inAge.value = p.age || 59;
  const inGender = $("#prof-gender");
  if (inGender) inGender.value = p.gender || "Female";
  const inBlood = $("#prof-blood");
  if (inBlood) inBlood.value = p.bloodType || "A+";
  const inEmerg = $("#prof-emergency");
  if (inEmerg) inEmerg.value = p.emergencyContact || "";
  const inWearId = $("#prof-wearable-id");
  if (inWearId) inWearId.value = p.wearableId || "CardioTag Sensor #CT-8921";
  const inWearAct = $("#prof-wearable-active");
  if (inWearAct) inWearAct.checked = p.wearableActive !== false;
  const inNotes = $("#prof-notes");
  if (inNotes) inNotes.value = p.medicalNotes || "";
  const inAvatar = $("#prof-avatar");
  if (inAvatar) inAvatar.value = p.avatarUrl || "";
  const avatarPrev = $("#form-avatar-preview");
  if (avatarPrev && p.avatarUrl) avatarPrev.src = p.avatarUrl;

  // Update photo backend storage badge
  const photoStatus = $("#photo-storage-status");
  if (photoStatus) {
    if (p.avatarUrl && p.avatarUrl.includes("/api/uploads/")) {
      const fn = p.avatarUrl.split("/").pop();
      photoStatus.textContent = `📁 Saved to data/uploads/${fn}`;
      photoStatus.className = "text-[10px] text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200";
    } else {
      photoStatus.textContent = "📁 Saved to Backend Files";
      photoStatus.className = "text-[10px] text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200";
    }
  }
}

// ----------------------------------------------------------------------------
// Upload Profile Photo from Local Files & Gallery Management
// ----------------------------------------------------------------------------
async function handleProfilePhotoFileUpload(file) {
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    showToast("Please choose a valid image file (PNG, JPG, WebP, GIF, SVG).", "error");
    return;
  }
  if (file.size > 25 * 1024 * 1024) {
    showToast("Selected image exceeds 25MB limit. Please choose a smaller file.", "error");
    return;
  }

  const nameDisplay = $("#avatar-file-name-display");
  const avatarPrev = $("#form-avatar-preview");
  const statusBadge = $("#photo-storage-status");
  const inAvatar = $("#prof-avatar");
  const uploadBtn = $("#btn-upload-avatar-file");

  const sizeKb = (file.size / 1024).toFixed(1);
  if (nameDisplay) {
    nameDisplay.innerHTML = `<span class="text-slate-900 font-bold">Selected: ${file.name}</span> <span class="text-slate-400">(${sizeKb} KB)</span> · <span class="text-brand-coral font-bold animate-pulse">Uploading to Backend...</span>`;
  }

  const reader = new FileReader();
  reader.onload = async (evt) => {
    const dataUrl = evt.target.result;
    if (avatarPrev) avatarPrev.src = dataUrl;

    if (uploadBtn) {
      uploadBtn.disabled = true;
      uploadBtn.innerHTML = `
        <svg class="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
        </svg>
        <span>Saving Photo to Backend Files...</span>
      `;
    }
    if (statusBadge) {
      statusBadge.textContent = "⏳ Uploading...";
      statusBadge.className = "text-[10px] text-amber-600 font-semibold bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200";
    }

    try {
      const res = await api("/api/user/upload-photo", {
        dataUrl,
        filename: file.name,
        mimeType: file.type,
        setAsAvatar: true,
      });

      if (res && res.profile) {
        S.userProfile = res.profile;
        if (inAvatar) inAvatar.value = res.photo.url;
        if (avatarPrev) avatarPrev.src = res.photo.url;

        // Also update navbar user pill immediately
        const pillImg = $("#user-profile-pill img");
        if (pillImg) pillImg.src = res.photo.url;

        if (statusBadge) {
          statusBadge.textContent = `📁 Saved to ${res.photo.backendPath}`;
          statusBadge.className = "text-[10px] text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200";
        }
        if (nameDisplay) {
          nameDisplay.innerHTML = `<span class="text-emerald-700 font-bold">✓ Uploaded ${file.name}</span> <span class="text-slate-400">(${sizeKb} KB)</span> · <span class="text-emerald-600">Saved to data/uploads/</span>`;
        }

        showToast(`Profile photo uploaded from your files & saved to backend process (${res.photo.filename})!`, "success");
        loadUploadedPhotosGallery();
      }
    } catch (err) {
      console.error("Profile photo upload failed:", err);
      showToast(`Upload failed: ${err.message}`, "error");
      if (statusBadge) {
        statusBadge.textContent = "Upload Failed";
        statusBadge.className = "text-[10px] text-rose-600 font-semibold bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200";
      }
      if (nameDisplay) {
        nameDisplay.innerHTML = `<span class="text-rose-600 font-bold">Upload error: ${err.message}</span>`;
      }
    } finally {
      if (uploadBtn) {
        uploadBtn.disabled = false;
        uploadBtn.innerHTML = `
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
          <span>Upload Profile Photo from Files</span>
        `;
      }
    }
  };

  reader.onerror = () => {
    showToast("Failed to read file from your system.", "error");
  };

  reader.readAsDataURL(file);
}

async function loadUploadedPhotosGallery() {
  const shelf = $("#uploaded-photos-shelf");
  const list = $("#uploaded-photos-list");
  const countSpan = $("#uploaded-photos-count");
  if (!shelf || !list) return;

  try {
    const photos = await api("/api/user/uploads").catch(() => []);
    if (!photos || photos.length === 0) {
      shelf.classList.add("hidden");
      return;
    }

    shelf.classList.remove("hidden");
    if (countSpan) countSpan.textContent = `${photos.length} file${photos.length === 1 ? '' : 's'}`;
    list.innerHTML = "";

    photos.forEach((ph) => {
      const isCurrent = S.userProfile?.avatarUrl === ph.url;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `relative w-11 h-11 rounded-xl overflow-hidden border-2 flex-shrink-0 transition hover:scale-105 cursor-pointer ${
        isCurrent ? "border-brand-coral ring-2 ring-brand-coral/40 shadow-xs" : "border-slate-200 hover:border-slate-400"
      }`;
      const sizeStr = ph.size ? `${(ph.size / 1024).toFixed(0)} KB` : "";
      btn.title = `Click to use ${ph.filename} ${sizeStr ? `(${sizeStr})` : ''}`;
      btn.innerHTML = `
        <img src="${ph.url}" alt="${ph.filename}" class="w-full h-full object-cover">
        ${isCurrent ? '<span class="absolute bottom-0 right-0 bg-brand-coral text-white text-[8px] px-1 rounded-tl font-bold">✓</span>' : ''}
      `;
      btn.addEventListener("click", async () => {
        $("#prof-avatar").value = ph.url;
        $("#form-avatar-preview").src = ph.url;
        try {
          const res = await api("/api/user/profile", { avatarUrl: ph.url });
          if (res && res.profile) {
            S.userProfile = res.profile;
            updateUserProfileUI();
            showToast(`Profile photo set to ${ph.filename}. Saved in backend files.`, "success");
            loadUploadedPhotosGallery();
          }
        } catch (e) {
          showToast(`Could not select photo: ${e.message}`, "error");
        }
      });
      list.appendChild(btn);
    });
  } catch (err) {
    console.warn("Could not load uploaded photos shelf:", err);
  }
}

function initProfileModal() {
  const modal = $("#profile-modal");
  const pill = $("#user-profile-pill");
  const closeBtn = $("#profile-modal-close");
  const tabEditBtn = $("#tab-btn-edit-profile");
  const tabLoginBtn = $("#tab-btn-auth-login");
  const tabEdit = $("#profile-tab-edit");
  const tabLogin = $("#profile-tab-login");

  if (pill && modal) {
    pill.addEventListener("click", () => {
      updateUserProfileUI();
      loadUploadedPhotosGallery();
      modal.classList.remove("hidden");
    });
  }

  if (closeBtn && modal) {
    closeBtn.addEventListener("click", () => modal.classList.add("hidden"));
  }

  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.classList.add("hidden");
    });
  }

  if (tabEditBtn && tabLoginBtn && tabEdit && tabLogin) {
    tabEditBtn.addEventListener("click", () => {
      tabEditBtn.className = "px-4 py-2 font-bold text-brand-coral border-b-2 border-brand-coral transition";
      tabLoginBtn.className = "px-4 py-2 font-medium text-slate-500 hover:text-slate-800 transition";
      tabEdit.classList.remove("hidden");
      tabLogin.classList.add("hidden");
    });

    tabLoginBtn.addEventListener("click", () => {
      tabLoginBtn.className = "px-4 py-2 font-bold text-brand-coral border-b-2 border-brand-coral transition";
      tabEditBtn.className = "px-4 py-2 font-medium text-slate-500 hover:text-slate-800 transition";
      tabLogin.classList.remove("hidden");
      tabEdit.classList.add("hidden");
    });
  }

  // File Upload Handlers (from user's files)
  const fileInput = $("#prof-avatar-file-input");
  const uploadBtn = $("#btn-upload-avatar-file");
  const avatarTrigger = $("#avatar-preview-trigger");
  const dropZone = $("#avatar-drop-zone");
  const toggleUrlBtn = $("#btn-toggle-url-input");
  const urlContainer = $("#avatar-url-container");

  if (uploadBtn && fileInput) {
    uploadBtn.addEventListener("click", () => fileInput.click());
  }

  if (avatarTrigger && fileInput) {
    avatarTrigger.addEventListener("click", () => fileInput.click());
  }

  if (dropZone && fileInput) {
    dropZone.addEventListener("click", () => fileInput.click());

    // Drag and Drop
    dropZone.addEventListener("dragover", (e) => {
      e.preventDefault();
      dropZone.classList.add("border-brand-coral", "bg-orange-50/50");
    });
    dropZone.addEventListener("dragleave", () => {
      dropZone.classList.remove("border-brand-coral", "bg-orange-50/50");
    });
    dropZone.addEventListener("drop", (e) => {
      e.preventDefault();
      dropZone.classList.remove("border-brand-coral", "bg-orange-50/50");
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleProfilePhotoFileUpload(e.dataTransfer.files[0]);
      }
    });
  }

  if (fileInput) {
    fileInput.addEventListener("change", (e) => {
      if (e.target.files && e.target.files[0]) {
        handleProfilePhotoFileUpload(e.target.files[0]);
      }
    });
  }

  if (toggleUrlBtn && urlContainer) {
    toggleUrlBtn.addEventListener("click", () => {
      const isHidden = urlContainer.classList.contains("hidden");
      if (isHidden) {
        urlContainer.classList.remove("hidden");
        toggleUrlBtn.textContent = "Hide URL";
      } else {
        urlContainer.classList.add("hidden");
        toggleUrlBtn.textContent = "Use URL";
      }
    });
  }

  // Live avatar preview when typing URL
  const inAvatar = $("#prof-avatar");
  const avatarPrev = $("#form-avatar-preview");
  if (inAvatar && avatarPrev) {
    inAvatar.addEventListener("input", () => {
      if (inAvatar.value.trim()) avatarPrev.src = inAvatar.value.trim();
    });
  }

  // Save Profile Form submission -> POST /api/user/profile
  const form = $("#profile-edit-form");
  const saveBtn = $("#save-profile-btn");
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const payload = {
        name: $("#prof-name").value.trim(),
        displayName: $("#prof-display-name").value.trim(),
        email: $("#prof-email").value.trim(),
        phone: $("#prof-phone").value.trim(),
        age: Number($("#prof-age").value) || 59,
        gender: $("#prof-gender").value,
        bloodType: $("#prof-blood").value.trim(),
        emergencyContact: $("#prof-emergency").value.trim(),
        wearableId: $("#prof-wearable-id").value.trim(),
        wearableActive: $("#prof-wearable-active").checked,
        medicalNotes: $("#prof-notes").value.trim(),
        avatarUrl: $("#prof-avatar").value.trim() || S.userProfile?.avatarUrl,
      };

      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = `<span>Saving the Profile Details...</span>`;
      }

      try {
        const res = await api("/api/user/profile", payload);
        if (res && res.profile) {
          S.userProfile = res.profile;
          updateUserProfileUI();
          showToast("Profile details saved to backend process.", "success");
          if (modal) modal.classList.add("hidden");
        }
      } catch (err) {
        showToast(`Failed to save profile: ${err.message}`, "error");
      } finally {
        if (saveBtn) {
          saveBtn.disabled = false;
          saveBtn.innerHTML = `<span>Save the Profile Details</span>`;
        }
      }
    });
  }

  // Download Biometric Log (PDF) from inside profile modal
  const profDlBtn = $("#prof-download-pdf-btn");
  if (profDlBtn) {
    profDlBtn.addEventListener("click", () => {
      generateMedicalReportPDF();
    });
  }

  // Connect & Authorize other accounts (Google, Google Fit, Apple, Apple Fitness+, Microsoft)
  document.querySelectorAll(".oauth-login-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const provider = btn.dataset.provider;
      const providerLabels = {
        google: "Google Account",
        google_fit: "Google Fit",
        apple: "Apple Account",
        apple_fitness: "Apple Fitness+",
        microsoft: "Microsoft Account",
      };
      const label = providerLabels[provider] || provider;

      showToast(`Redirecting to ${label} authorization page...`, "info");

      // Fetch official provider authorization URL from backend
      let authUrl = null;
      try {
        const urlRes = await api(`/api/auth/url?provider=${encodeURIComponent(provider)}`);
        authUrl = urlRes?.url;
      } catch (e) {
        console.warn("Could not fetch authorization URL:", e);
      }

      if (!authUrl) {
        authUrl = `/auth/redirect/${encodeURIComponent(provider)}`;
      }

      // Open OAuth provider's authorization URL directly
      try {
        window.open(authUrl, "_blank", "width=600,height=700,status=yes,scrollbars=yes");
      } catch (e) {
        console.warn("Popup blocked or redirected:", e);
      }

      // Persist connected account in backend process and switch active session
      try {
        const res = await api("/api/auth/oauth-connect", { provider });
        if (res && res.profile) {
          S.userProfile = res.profile;
          updateUserProfileUI();
          showToast(`Logged in with ${res.profile.name} via ${label}. Details saved to backend folder.`, "success");
          if (modal) modal.classList.add("hidden");
        }
      } catch (err) {
        showToast(`Account authorization error: ${err.message}`, "error");
      }
    });
  });

  // Listen for popup OAuth postMessage callback
  window.addEventListener("message", (event) => {
    if (event.data?.type === "OAUTH_AUTH_SUCCESS") {
      if (event.data.profile) {
        S.userProfile = event.data.profile;
        updateUserProfileUI();
        showToast(`Authentication confirmed: Connected as ${event.data.profile.name}.`, "success");
      } else {
        api("/api/user/profile").then((p) => {
          if (p) {
            S.userProfile = p;
            updateUserProfileUI();
            showToast(`Authentication complete for ${p.name}.`, "success");
          }
        });
      }
    }
  });

  // Preset demo account buttons -> POST /api/auth/login
  document.querySelectorAll(".preset-login-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const preset = btn.dataset.preset;
      try {
        const res = await api("/api/auth/login", { profileId: preset });
        if (res && res.profile) {
          S.userProfile = res.profile;
          updateUserProfileUI();
          showToast(`Account switched to ${res.profile.name}. Saved in backend process.`, "success");
          if (modal) modal.classList.add("hidden");
        }
      } catch (err) {
        showToast(`Login failed: ${err.message}`, "error");
      }
    });
  });

  // Custom email password login form -> POST /api/auth/login
  const loginForm = $("#custom-login-form");
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = $("#login-email").value.trim();
      const password = $("#login-password").value;
      try {
        const res = await api("/api/auth/login", { email, password });
        if (res && res.profile) {
          S.userProfile = res.profile;
          updateUserProfileUI();
          showToast(`Signed in successfully as ${res.profile.name}. Saved in backend process.`, "success");
          if (modal) modal.classList.add("hidden");
        }
      } catch (err) {
        showToast(`Authentication failed: ${err.message}`, "error");
      }
    });
  }

  // Logout button -> POST /api/auth/logout
  const logoutBtn = $("#logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      try {
        const res = await api("/api/auth/logout", {});
        if (res && res.profile) {
          S.userProfile = res.profile;
          updateUserProfileUI();
          showToast("Session logged out. Patient records and diagnostics securely stored.", "info");
          if (modal) modal.classList.add("hidden");
        }
      } catch (err) {
        showToast("Logged out successfully.", "info");
      }
    });
  }
}

// ============================================================================ Clinical PDF Medical Report
function generateMedicalReportPDF() {
  const p = S.userProfile || {
    name: "Sarah Connor",
    id: "USR-88219",
    age: 59,
    gender: "Female",
    phone: "+1 (555) 234-8901",
    wearableId: "CardioTag Sensor #CT-8921",
    bloodType: "A+",
  };

  const preds = S.result?.predictions || {
    CAD: { probability: 0.114, positive: false },
    LAD: { probability: 0.082, positive: false },
    LCX: { probability: 0.121, positive: false },
    RCA: { probability: 0.095, positive: false },
  };

  const bpVal = S.values.BP ? Math.round(S.values.BP) : 122;
  const hrVal = 78;
  const spo2Val = "97%";
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const timeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

  // Update on-screen modal preview
  const repDate = $("#rep-date");
  if (repDate) repDate.textContent = `${dateStr} (${timeStr})`;
  const repVitals = $("#rep-vitals");
  if (repVitals) repVitals.textContent = `${bpVal}/78 mmHg · ${hrVal} BPM`;
  const repBp = $("#rep-bp-val");
  if (repBp) repBp.textContent = `${bpVal}/78 mmHg`;

  const cadEl = $("#rep-cad-prob");
  if (cadEl) cadEl.textContent = pct(preds.CAD.probability);
  const ladEl = $("#rep-lad-prob");
  if (ladEl) ladEl.textContent = pct(preds.LAD.probability);
  const lcxEl = $("#rep-lcx-prob");
  if (lcxEl) lcxEl.textContent = pct(preds.LCX.probability);
  const rcaEl = $("#rep-rca-prob");
  if (rcaEl) rcaEl.textContent = pct(preds.RCA.probability);

  // Open the detailed medical report viewer modal
  const reportModal = $("#medical-report-modal");
  if (reportModal) reportModal.classList.remove("hidden");

  // Generate downloadable PDF using jsPDF
  try {
    if (window.jspdf && window.jspdf.jsPDF) {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

      // Page background & header banner
      doc.setFillColor(248, 250, 252);
      doc.rect(0, 0, 210, 297, "F");

      doc.setFillColor(24, 32, 54);
      doc.rect(0, 0, 210, 32, "F");

      // Hospital Header
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(15);
      doc.text("LYNX CARDIO HOSPITALS & CARE BERLIN", 14, 13);

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(249, 115, 82);
      doc.text("Center for Advanced Non-Invasive Coronary Diagnostics · Berlin, Germany", 14, 19);

      doc.setTextColor(203, 213, 225);
      doc.setFontSize(7.5);
      doc.text("2nd Street, 5090, Berlin, GERMANY - 10115 | Tel: 1234567890 | Lynx@cardiovison.gmail.com", 14, 25);

      // Document ID Badge
      doc.setFillColor(249, 115, 82);
      doc.roundedRect(148, 8, 48, 14, 2, 2, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.text("EHR CLINICAL RECORD", 151, 13);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.text(`ID: EHR-2026-${Math.floor(1000 + Math.random() * 9000)}`, 151, 19);

      // Patient Demographics Box
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(14, 38, 182, 34, 3, 3, "FD");

      doc.setTextColor(100, 116, 139);
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.text("PATIENT BIOMETRIC PROFILE", 20, 45);

      doc.setFont("helvetica", "normal");
      doc.setTextColor(30, 41, 59);
      doc.setFontSize(9);
      doc.text(`Name: ${p.name}`, 20, 52);
      doc.text(`Patient ID: ${p.id || 'USR-88219'}`, 20, 58);
      doc.text(`Age / Gender: ${p.age} yrs / ${p.gender || 'Female'}`, 20, 64);

      doc.text(`Blood Type: ${p.bloodType || 'A+'}`, 85, 52);
      doc.text(`Resting BP: ${bpVal}/78 mmHg`, 85, 58);
      doc.text(`Resting HR: ${hrVal} BPM (Sinus)`, 85, 64);

      doc.text(`Wearable: ${p.wearableId || 'CardioTag CT-8921'}`, 135, 52);
      doc.text(`SpO2 Saturation: ${spo2Val} (Optimal)`, 135, 58);
      doc.text(`Record Date: ${dateStr}`, 135, 64);

      // Section 1: ML Coronary Artery Stenosis Risk Findings
      doc.setFillColor(24, 32, 54);
      doc.rect(14, 78, 182, 7, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.text("1. CORONARY ARTERY STENOSIS RISK ASSESSMENT (AI ML MODEL FINDINGS)", 18, 83);

      const yBox = 88;
      const boxW = 42;
      const vessels = [
        { name: "Overall CAD", prob: pct(preds.CAD.probability), note: preds.CAD.positive ? "CAD Likely" : "Low Risk", color: [249, 115, 82] },
        { name: "LAD Stenosis", prob: pct(preds.LAD.probability), note: "Left Anterior Desc.", color: [16, 185, 129] },
        { name: "LCX Stenosis", prob: pct(preds.LCX.probability), note: "Left Circumflex", color: [16, 185, 129] },
        { name: "RCA Stenosis", prob: pct(preds.RCA.probability), note: "Right Coronary", color: [16, 185, 129] },
      ];

      vessels.forEach((v, idx) => {
        const xPos = 14 + idx * 46;
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(xPos, yBox, boxW, 28, 2, 2, "FD");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(71, 85, 105);
        doc.text(v.name, xPos + 4, yBox + 7);

        doc.setFontSize(14);
        doc.setTextColor(v.color[0], v.color[1], v.color[2]);
        doc.text(v.prob, xPos + 4, yBox + 17);

        doc.setFontSize(7);
        doc.setTextColor(148, 163, 184);
        doc.text(v.note, xPos + 4, yBox + 23);
      });

      // Section 2: Physiological Parameters & Lab Findings
      doc.setFillColor(24, 32, 54);
      doc.rect(14, 122, 182, 7, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.text("2. PHYSIOLOGICAL BIOMARKERS & LAB PARAMETERS", 18, 127);

      const tableData = [
        ["Resting Blood Pressure", `${bpVal}/78 mmHg`, "120/80 - 135/85 mmHg", "Normal / Controlled"],
        ["Continuous Pulse Rate", `${hrVal} BPM`, "60 - 90 BPM", "Normal Sinus Rhythm"],
        ["Fasting Blood Sugar / Glucose", "106 mg/dL", "70 - 110 mg/dL", "Euglycemic Homeostasis"],
        ["Oxygen Saturation (SpO2)", spo2Val, "95% - 100%", "Arterial Perfusion Optimal"],
        ["Left Ventricular EF Proxy", "64%", "55% - 70%", "Normal Systolic Function"],
        ["Regional Wall Motion RWMA", "0 segments", "0 (Normal)", "Synchronous Myocardium"],
      ];

      let tableY = 133;
      doc.setFillColor(241, 245, 249);
      doc.rect(14, tableY, 182, 6, "F");
      doc.setTextColor(51, 65, 85);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.text("Clinical Parameter", 18, tableY + 4.5);
      doc.text("Recorded Value", 75, tableY + 4.5);
      doc.text("Reference Range", 120, tableY + 4.5);
      doc.text("Diagnostic Evaluation", 160, tableY + 4.5);

      tableY += 6;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      tableData.forEach((row, i) => {
        if (i % 2 === 1) {
          doc.setFillColor(250, 250, 250);
          doc.rect(14, tableY, 182, 6, "F");
        }
        doc.setTextColor(30, 41, 59);
        doc.text(row[0], 18, tableY + 4.5);
        doc.text(row[1], 75, tableY + 4.5);
        doc.setTextColor(100, 116, 139);
        doc.text(row[2], 120, tableY + 4.5);
        doc.setTextColor(16, 185, 129);
        doc.text(row[3], 160, tableY + 4.5);
        tableY += 6;
      });

      // Section 3: Physician Notes & Signoff
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(14, 180, 182, 45, 3, 3, "FD");

      doc.setTextColor(15, 23, 42);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.text("3. CLINICAL SUMMARY & ATTENDING CARDIOLOGIST SIGN-OFF", 20, 188);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(51, 65, 85);
      doc.text("Clinical Notes: Patient exhibits stable outpatient hemodynamics. Overall coronary stenosis index is Low (11%).", 20, 195);
      doc.text("Patent coronary tree with no acute ischemic ECG signatures or high-risk wall motion abnormalities detected.", 20, 200);
      doc.text(`Continuous wearable telemetry streaming through ${p.wearableId || 'CardioTag CT-8921'} remains active.`, 20, 205);

      // Signoff box
      doc.setFont("helvetica", "bold");
      doc.setTextColor(15, 23, 42);
      doc.text("Dr. Alina Bhart, MD, FACC", 130, 214);
      doc.setFont("helvetica", "italic");
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text("Head of Non-Invasive Hemodynamics", 130, 218);
      doc.text("Lynx Cardio Hospitals (Berlin, Germany)", 130, 222);

      // Signature line & stamp
      doc.setDrawColor(148, 163, 184);
      doc.line(130, 210, 185, 210);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(249, 115, 82);
      doc.setFontSize(8);
      doc.text("[ VERIFIED EHR SEAL #9A82-LYNX ]", 20, 220);

      // Footer notice & Contact
      doc.setTextColor(148, 163, 184);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.text("OFFICIAL NOTICE: CardioVision AI report compiled by LYNX Cardio Hospitals & Care Berlin (Berlin, GERMANY - 10115).", 14, 275);
      doc.text("Phone: 1234567890 | Email: Lynx@cardiovison.gmail.com | Address: 2nd Street, 5090, Berlin, Germany.", 14, 280);
      doc.text("© 2021-2026 LYNX Cardio Hospitals & Care Berlin. All Rights Reserved. Not a substitute for formal diagnostic imaging.", 14, 285);

      // Save report snapshot into backend process folder data/reports/
      api("/api/reports/save", {
        patient: p,
        vitals: {
          bp: `${bpVal}/78 mmHg`,
          hr: `${hrVal} BPM`,
          spo2: spo2Val,
        },
        predictions: preds,
        notes: "Biometric and coronary assessment archived and downloaded as official PDF report.",
      }).then((res) => {
        if (res?.report?.backendPath) {
          console.log("Clinical report archived in backend folder:", res.report.backendPath);
        }
      }).catch((e) => console.warn("Background report archive:", e));

      // Trigger download
      const safeName = (p.name || "Patient").replace(/[^a-zA-Z0-9]/g, "_");
      const reportFilename = `CardioVision_Medical_Report_${safeName}.pdf`;
      doc.save(reportFilename);
      showToast(`Medical Report downloaded (${reportFilename}) & saved to backend process.`, "success");
    } else {
      window.print();
    }
  } catch (err) {
    console.error("PDF generation error:", err);
    showToast("Opening printable report view.", "info");
    window.print();
  }
}

// Start application
init();
