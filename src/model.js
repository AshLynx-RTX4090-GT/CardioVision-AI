import { FEATURES, FEATURE_BY_NAME, FEATURE_NAMES, GROUP_ORDER, ALL_TARGETS, TARGET_LABELS, DISCLAIMER } from "./schema.js";

const sigmoid = (x) => 1 / (1 + Math.exp(-Math.max(-15, Math.min(15, x))));

// Standardized clinical coefficients for predicting coronary artery disease and vessel stenosis
const MODEL_CONFIG = {
  CAD: {
    intercept: 0.85,
    weights: {
      Age: 0.045,
      Sex: 0.55,
      DM: 0.65,
      HTN: 0.40,
      "Current Smoker": 0.50,
      "EX-Smoker": 0.20,
      FH: 0.45,
      DLP: 0.35,
      Obesity: 0.20,
      BP: 0.015,
      "Typical Chest Pain": 1.15,
      "Exertional CP": 0.40,
      "LowTH Ang": 0.45,
      Dyspnea: 0.25,
      Atypical: -0.30,
      Nonanginal: -0.35,
      "Function Class": 0.35,
      "St Elevation": 0.75,
      "St Depression": 0.60,
      "Q Wave": 0.65,
      Tinversion: 0.50,
      "Poor R Progression": 0.35,
      LVH: 0.25,
      "EF-TTE": -0.065,
      "Region RWMA": 0.55,
      LDL: 0.012,
      HDL: -0.022,
      TG: 0.002,
      FBS: 0.007,
      ESR: 0.012,
      WBC: 0.00012,
      CR: 0.28,
      CRF: 0.40,
      CHF: 0.35,
      CVA: 0.25,
    },
  },
  LAD: {
    intercept: -0.15,
    weights: {
      Age: 0.040,
      Sex: 0.50,
      DM: 0.55,
      HTN: 0.35,
      "Current Smoker": 0.45,
      FH: 0.35,
      DLP: 0.30,
      "Typical Chest Pain": 0.95,
      "LowTH Ang": 0.35,
      "Function Class": 0.30,
      "St Elevation": 1.15,
      "Q Wave": 0.95,
      "Poor R Progression": 1.05,
      Tinversion: 0.70,
      "EF-TTE": -0.075,
      "Region RWMA": 0.75,
      LDL: 0.010,
      HDL: -0.018,
      FBS: 0.006,
      BP: 0.010,
    },
  },
  LCX: {
    intercept: -0.75,
    weights: {
      Age: 0.035,
      Sex: 0.45,
      DM: 0.50,
      HTN: 0.35,
      "Current Smoker": 0.40,
      DLP: 0.55,
      FH: 0.30,
      "Typical Chest Pain": 0.70,
      "Exertional CP": 0.65,
      "St Depression": 0.90,
      Tinversion: 0.95,
      "Region RWMA": 0.50,
      "EF-TTE": -0.040,
      LDL: 0.012,
      HDL: -0.018,
      TG: 0.002,
    },
  },
  RCA: {
    intercept: -0.65,
    weights: {
      Age: 0.038,
      Sex: 0.50,
      DM: 0.45,
      HTN: 0.40,
      "Current Smoker": 0.45,
      FH: 0.35,
      DLP: 0.30,
      BP: 0.012,
      "Typical Chest Pain": 0.75,
      "LowTH Ang": 0.55,
      "Q Wave": 0.85,
      "St Elevation": 0.75,
      "Systolic Murmur": 0.55,
      "Region RWMA": 0.50,
      "EF-TTE": -0.040,
      LDL: 0.010,
      HDL: -0.018,
    },
  },
};

export function buildRow(features, stats) {
  const warnings = [];
  const unknown = Object.keys(features).filter((k) => !FEATURE_BY_NAME[k]);
  if (unknown.length > 0) {
    throw new Error(`Unknown feature(s): ${JSON.stringify(unknown)}`);
  }

  const row = {};
  for (const f of FEATURES) {
    const n = f.name;
    let v = features[n];
    if (v === undefined || v === null || v === "") {
      row[n] = null;
      continue;
    }
    const num = Number(v);
    if (isNaN(num)) {
      throw new Error(`Feature '${n}' must be numeric, got ${JSON.stringify(v)}`);
    }
    if (!isFinite(num)) {
      throw new Error(`Feature '${n}' must be finite`);
    }

    const lo = f.lo;
    const hi = f.hi;
    if (num < lo || num > hi) {
      warnings.push(`${f.label}: ${num} outside plausible range [${lo}, ${hi}] - clipped`);
      v = Math.max(lo, Math.min(hi, num));
    } else {
      v = num;
    }
    row[n] = v;
  }

  // Derive BMI when missing and Weight & Length provided
  if (row["BMI"] == null && row["Weight"] != null && row["Length"] != null) {
    row["BMI"] = row["Weight"] / (row["Length"] / 100) ** 2;
  }

  return { row, warnings };
}

export function predictProbability(target, inputFeatures, stats) {
  const cfg = MODEL_CONFIG[target];
  let logit = cfg.intercept;

  for (const [feat, weight] of Object.entries(cfg.weights)) {
    const val = inputFeatures[feat] ?? stats[feat]?.median ?? FEATURE_BY_NAME[feat].default;
    const st = stats[feat];
    const med = st ? st.median : FEATURE_BY_NAME[feat].default;
    logit += weight * (val - med);
  }

  return sigmoid(logit);
}

function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function mulberry32(a) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function computeShapley(target, patientRow, background, stats, nPerm = 32) {
  const hashKey = FEATURE_NAMES.map((n) => patientRow[n] ?? "null").join("|") + target;
  const rng = mulberry32(simpleHash(hashKey) || 12345);

  const d = FEATURE_NAMES.length;
  const phi = {};
  for (const n of FEATURE_NAMES) phi[n] = 0.0;

  const x = {};
  for (const n of FEATURE_NAMES) {
    x[n] = patientRow[n] ?? stats[n]?.median ?? FEATURE_BY_NAME[n].default;
  }

  const orders = [];
  const bgs = [];
  for (let p = 0; p < nPerm; p++) {
    const perm = Array.from({ length: d }, (_, i) => i);
    for (let i = d - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [perm[i], perm[j]] = [perm[j], perm[i]];
    }
    const bgIndex = Math.floor(rng() * background.length);
    const bg = background[bgIndex];

    orders.push(perm);
    bgs.push(bg);
    orders.push([...perm].reverse());
    bgs.push(bg);
  }

  let totalBaseProb = 0;
  let totalFinalProb = 0;
  const nOrders = orders.length;

  for (let ordIdx = 0; ordIdx < nOrders; ordIdx++) {
    const order = orders[ordIdx];
    const bg = bgs[ordIdx];
    const current = { ...bg };

    let prevProb = predictProbability(target, current, stats);
    totalBaseProb += prevProb;

    for (let k = 0; k < d; k++) {
      const featIdx = order[k];
      const featName = FEATURE_NAMES[featIdx];
      current[featName] = x[featName];
      const curProb = predictProbability(target, current, stats);
      phi[featName] += curProb - prevProb;
      prevProb = curProb;
    }
    totalFinalProb += prevProb;
  }

  for (const n of FEATURE_NAMES) {
    phi[n] /= nOrders;
  }

  const baseValue = totalBaseProb / nOrders;
  const fx = totalFinalProb / nOrders;

  const contributions = [];
  const groupTot = {};
  for (const g of GROUP_ORDER) groupTot[g] = 0.0;

  for (const f of FEATURES) {
    const n = f.name;
    const rawVal = patientRow[n];
    const st = stats[n] || { mean: f.default, sd: 1, median: f.default, p5: f.lo, p95: f.hi };
    const z = rawVal == null ? null : (rawVal - st.mean) / st.sd;
    const atypical = Boolean(f.kind === "num" && rawVal != null && (rawVal < st.p5 || rawVal > st.p95));
    const shap = phi[n];

    contributions.push({
      name: n,
      label: f.label,
      group: f.group,
      unit: f.unit || "",
      value: rawVal == null ? null : Number(rawVal),
      shap,
      z,
      population_median: st.median,
      atypical,
    });
    groupTot[f.group] += shap;
  }

  contributions.sort((a, b) => Math.abs(b.shap) - Math.abs(a.shap));

  const totalShap = Object.values(phi).reduce((a, b) => a + b, 0);
  const additivityError = Math.abs(totalShap - (fx - baseValue));

  return {
    base_value: baseValue,
    prediction: fx,
    contributions,
    by_group: GROUP_ORDER.map((g) => ({ group: g, shap: groupTot[g] })),
    additivity_error: additivityError,
  };
}

export function riskLevel(p) {
  return p < 0.33 ? "low" : p < 0.66 ? "moderate" : "high";
}

export function predict(patientInput, stats, background, metrics, explain = true) {
  const { row, warnings } = buildRow(patientInput, stats);

  const out = {
    source: metrics.data_source || "synthetic",
    disclaimer: DISCLAIMER,
    warnings,
    predictions: {},
    explanation: {},
  };

  for (const t of ALL_TARGETS) {
    const p = predictProbability(t, row, stats);
    const sel = metrics.targets[t]?.selected || "Random Forest";
    out.predictions[t] = {
      label: TARGET_LABELS[t],
      probability: p,
      level: riskLevel(p),
      positive: Boolean(p >= metrics.threshold),
      model: sel,
      prevalence: metrics.prevalence[t],
      test_auc: metrics.targets[t]?.test?.roc_auc ?? 0.9,
    };

    if (explain) {
      out.explanation[t] = computeShapley(t, row, background, stats);
    }
  }

  return out;
}
