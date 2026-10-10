import { FEATURES, FEATURE_NAMES, GROUP_ORDER, ALL_TARGETS } from "./schema.js";

function mulberry32(a) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeNormal(rng) {
  let haveSpare = false;
  let spare = 0;
  return function (mu = 0, sd = 1) {
    if (haveSpare) {
      haveSpare = false;
      return mu + sd * spare;
    }
    haveSpare = true;
    let u = 0,
      v = 0,
      s = 0;
    do {
      u = rng() * 2 - 1;
      v = rng() * 2 - 1;
      s = u * u + v * v;
    } while (s >= 1 || s === 0);
    const mul = Math.sqrt((-2.0 * Math.log(s)) / s);
    spare = v * mul;
    return mu + sd * (u * mul);
  };
}

const sigmoid = (x) => 1 / (1 + Math.exp(-Math.max(-15, Math.min(15, x))));

// Generate 303 synthetic cohort patients
export function createCohort() {
  const rng = mulberry32(42);
  const normal = makeNormal(rng);
  const n = 303;

  const clip = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const g = (mu, sd, lo, hi) => clip(normal(mu, sd), lo, hi);
  const b = (p) => (rng() < p ? 1 : 0);

  const rows = [];
  for (let i = 0; i < n; i++) {
    const d = {};
    d["Age"] = Math.round(g(58, 10, 30, 86));
    d["Sex"] = b(0.46);
    d["Length"] = Math.round(d["Sex"] === 1 ? g(171, 7, 150, 195) : g(158, 6, 140, 180));
    d["Weight"] = Math.round(clip(normal(0, 1) * 12 + (d["Length"] - 100) * 0.95 + 5, 40, 125));
    d["BMI"] = Math.round((d["Weight"] / (d["Length"] / 100) ** 2) * 10) / 10;

    const z = ((d["Age"] - 58) / 10) * 0.6 + d["Sex"] * 0.3 + normal(0, 1) * 0.8;
    d["DM"] = b(sigmoid(-1.3 + 0.6 * z));
    d["HTN"] = b(sigmoid(-0.2 + 0.7 * z));
    d["Current Smoker"] = b(sigmoid(-1.9 + 0.8 * d["Sex"]));
    d["EX-Smoker"] = b(0.04 + 0.05 * d["Sex"]);
    d["FH"] = b(0.12);
    d["Obesity"] = d["BMI"] > 30 ? 1 : 0;
    d["CRF"] = b(0.015);
    d["CVA"] = b(0.02 + (z > 1 ? 0.02 : 0));
    d["Airway disease"] = b(0.06);
    d["Thyroid Disease"] = b(0.03);
    d["CHF"] = b(0.02);
    d["DLP"] = b(sigmoid(-0.9 + 0.4 * z));

    d["BP"] = Math.round(g(130, 17, 90, 190) + 6 * d["HTN"]);
    d["PR"] = Math.round(g(75, 11, 50, 115));
    d["Edema"] = b(0.03);
    d["Weak Peripheral Pulse"] = b(0.02);
    d["Lung rales"] = b(0.04);
    d["Systolic Murmur"] = b(0.15);
    d["Diastolic Murmur"] = b(0.02);

    const base =
      -0.9 +
      0.045 * (d["Age"] - 58) +
      0.55 * d["Sex"] +
      0.7 * d["DM"] +
      0.45 * d["HTN"] +
      0.55 * d["Current Smoker"] +
      0.45 * d["FH"] +
      0.3 * d["DLP"] +
      normal(0, 0.9);
    const lad_latent = base + 0.25 + normal(0, 0.7);
    const lcx_latent = base - 0.55 + normal(0, 0.8);
    const rca_latent = base - 0.5 + normal(0, 0.8);

    const LAD = rng() < sigmoid(lad_latent) ? 1 : 0;
    const LCX = rng() < sigmoid(lcx_latent) ? 1 : 0;
    const RCA = rng() < sigmoid(rca_latent) ? 1 : 0;
    const any_v = Math.max(LAD, LCX, RCA);
    const CAD = any_v;

    d["Typical Chest Pain"] = b(0.12 + 0.55 * any_v);
    d["Atypical"] = b(0.1 + 0.05 * (1 - any_v));
    d["Nonanginal"] = b(0.1 * (1 - d["Typical Chest Pain"]) + 0.03);
    d["Exertional CP"] = b(0.02 + 0.08 * any_v);
    d["LowTH Ang"] = b(0.03 + 0.14 * any_v);
    d["Dyspnea"] = b(0.2 + 0.15 * any_v);
    d["Function Class"] = clip(Math.round(normal(0.9 + 0.7 * any_v, 0.9)), 0, 4);

    d["Q Wave"] = b(0.015 + 0.07 * LAD + 0.03 * RCA);
    d["St Elevation"] = b(0.02 + 0.09 * LAD + 0.04 * RCA);
    d["St Depression"] = b(0.05 + 0.2 * any_v + 0.08 * LCX);
    d["Tinversion"] = b(0.07 + 0.22 * LCX + 0.15 * LAD);
    d["LVH"] = b(0.05 + 0.12 * d["HTN"]);
    d["Poor R Progression"] = b(0.02 + 0.1 * LAD);
    d["BBB"] = rng() < 0.06 ? Math.floor(rng() * 2) + 1 : 0;

    d["FBS"] = Math.round(g(98, 22, 70, 300) + 55 * d["DM"] * (rng() < 0.8 ? 1 : 0));
    d["CR"] = Math.round(clip(g(1.0, 0.18, 0.5, 2.2) + 0.9 * d["CRF"], 0.5, 4.0) * 10) / 10;
    d["TG"] = Math.round(clip(Math.exp(normal(5.0, 0.4)) + 25 * any_v, 45, 700));
    d["LDL"] = Math.round(clip(g(100, 28, 45, 240) + 14 * any_v + 8 * d["DLP"], 40, 260));
    d["HDL"] = Math.round(clip(g(43, 9, 18, 85) - 3.5 * any_v - 3 * d["Sex"], 15, 90));
    d["BUN"] = Math.round(g(17, 6, 6, 55) + 12 * d["CRF"]);
    d["ESR"] = Math.round(clip(g(18, 12, 2, 80) + 5 * any_v + 0.15 * (d["Age"] - 58), 1, 85));
    d["HB"] = Math.round(clip(g(13.3, 1.6, 8, 17.5) + 1.0 * d["Sex"] - 0.5, 8, 18) * 10) / 10;
    d["K"] = Math.round(g(4.2, 0.4, 3.0, 5.8) * 10) / 10;
    d["Na"] = Math.round(g(141, 3, 130, 148));
    d["WBC"] = Math.round(clip(normal(7400 + 500 * any_v, 1900), 3200, 16000) / 100) * 100;
    d["Lymph"] = Math.round(g(32 - 1.5 * any_v, 8, 8, 55));
    d["Neut"] = Math.round(clip(100 - d["Lymph"] - normal(6, 3), 35, 88));
    d["PLT"] = Math.round(g(235, 55, 100, 450));

    const ef = clip(normal(52 - 8 * LAD - 3 * LCX - 3 * RCA, 6), 18, 70);
    d["EF-TTE"] = Math.round(ef);
    d["Region RWMA"] = clip(Math.round(normal(0.1 + 1.0 * LAD + 0.6 * LCX + 0.6 * RCA, 0.6)), 0, 4);
    d["VHD"] = rng() < 0.2 ? Math.floor(rng() * 3) + 1 : 0;

    d["_LAD"] = LAD;
    d["_LCX"] = LCX;
    d["_RCA"] = RCA;
    d["_CAD"] = CAD;

    rows.push(d);
  }

  // Calculate stats for each feature
  const stats = {};
  for (const f of FEATURES) {
    const name = f.name;
    const vals = rows.map((r) => r[name]).filter((v) => v != null && !isNaN(v));
    vals.sort((a, b) => a - b);
    const sum = vals.reduce((a, b) => a + b, 0);
    const mean = sum / vals.length;
    const variance = vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length;
    const sd = Math.sqrt(variance) || 1.0;
    const median = vals[Math.floor(vals.length / 2)];
    const p5 = vals[Math.floor(vals.length * 0.05)];
    const p95 = vals[Math.floor(vals.length * 0.95)];
    const min = vals[0];
    const max = vals[vals.length - 1];
    stats[name] = { mean, sd, median, p5, p95, min, max };
  }

  // Sample picks
  function pickRow(pred) {
    const matching = rows.filter(pred);
    if (matching.length === 0) return rows[0];
    return matching[Math.floor(matching.length / 2)];
  }

  function cleanRowFeatures(row) {
    const fObj = {};
    for (const name of FEATURE_NAMES) {
      fObj[name] = row[name];
    }
    return fObj;
  }

  const multiRow = pickRow((r) => r._LAD === 1 && r._LCX === 1 && r._RCA === 1);
  const ladRow = pickRow((r) => r._LAD === 1 && r._LCX === 0 && r._RCA === 0);
  const rcaRow = pickRow((r) => r._RCA === 1 && r._LAD === 0 && r._LCX === 0);
  const lcxRow = pickRow((r) => r._LCX === 1 && r._LAD === 0 && r._RCA === 0);
  const normalRow = pickRow((r) => r._CAD === 0);

  const samples = [
    {
      id: "multi",
      description: "Dataset patient, 3-vessel disease on catheterisation",
      features: cleanRowFeatures(multiRow),
      cath_labels: { CAD: 1, LAD: 1, LCX: 1, RCA: 1 },
    },
    {
      id: "lad",
      description: "Dataset patient, LAD-only stenosis",
      features: cleanRowFeatures(ladRow),
      cath_labels: { CAD: 1, LAD: 1, LCX: 0, RCA: 0 },
    },
    {
      id: "rca",
      description: "Dataset patient, RCA-only stenosis",
      features: cleanRowFeatures(rcaRow),
      cath_labels: { CAD: 1, LAD: 0, LCX: 0, RCA: 1 },
    },
    {
      id: "lcx",
      description: "Dataset patient, LCX-only stenosis",
      features: cleanRowFeatures(lcxRow),
      cath_labels: { CAD: 1, LAD: 0, LCX: 1, RCA: 0 },
    },
    {
      id: "normal",
      description: "Dataset patient, normal coronaries",
      features: cleanRowFeatures(normalRow),
      cath_labels: { CAD: 0, LAD: 0, LCX: 0, RCA: 0 },
    },
  ];

  // Background sample for Shapley calculation (60 representative cohort patients)
  const background = rows.slice(0, 60).map((r) => cleanRowFeatures(r));

  return { rows, stats, samples, background };
}
