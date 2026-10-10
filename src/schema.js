export const TARGETS = ["LAD", "LCX", "RCA"];
export const LEAKAGE_COLUMNS = ["LAD", "LCX", "RCA", "Cath"];
export const TARGET_LABELS = { CAD: "Overall CAD", LAD: "LAD", LCX: "LCX", RCA: "RCA" };
export const ALL_TARGETS = ["CAD", "LAD", "LCX", "RCA"];

export const GROUP_ORDER = ["Demographics", "History", "Symptoms", "Examination", "ECG", "Laboratory", "Echo"];

export const FEATURES = [
  // --- Demographics ---
  { name: "Age", label: "Age", kind: "num", group: "Demographics", unit: "yrs", lo: 18, hi: 95, default: 58 },
  { name: "Weight", label: "Weight", kind: "num", group: "Demographics", unit: "kg", lo: 35, hi: 140, default: 77 },
  { name: "Length", label: "Height", kind: "num", group: "Demographics", unit: "cm", lo: 140, hi: 200, default: 164 },
  { name: "Sex", label: "Sex (1 = male)", kind: "bin", group: "Demographics", lo: 0, hi: 1, default: 0 },
  { name: "BMI", label: "BMI", kind: "num", group: "Demographics", unit: "kg/m²", lo: 14, hi: 50, default: 28.7, derived: true },
  // --- History / risk factors ---
  { name: "DM", label: "Diabetes mellitus", kind: "bin", group: "History", lo: 0, hi: 1, default: 0 },
  { name: "HTN", label: "Hypertension", kind: "bin", group: "History", lo: 0, hi: 1, default: 0 },
  { name: "Current Smoker", label: "Current smoker", kind: "bin", group: "History", lo: 0, hi: 1, default: 0 },
  { name: "EX-Smoker", label: "Ex-smoker", kind: "bin", group: "History", lo: 0, hi: 1, default: 0 },
  { name: "FH", label: "Family history of CAD", kind: "bin", group: "History", lo: 0, hi: 1, default: 0 },
  { name: "Obesity", label: "Obesity", kind: "bin", group: "History", lo: 0, hi: 1, default: 0 },
  { name: "CRF", label: "Chronic renal failure", kind: "bin", group: "History", lo: 0, hi: 1, default: 0 },
  { name: "CVA", label: "Cerebrovascular accident", kind: "bin", group: "History", lo: 0, hi: 1, default: 0 },
  { name: "Airway disease", label: "Airway disease", kind: "bin", group: "History", lo: 0, hi: 1, default: 0 },
  { name: "Thyroid Disease", label: "Thyroid disease", kind: "bin", group: "History", lo: 0, hi: 1, default: 0 },
  { name: "CHF", label: "Congestive heart failure", kind: "bin", group: "History", lo: 0, hi: 1, default: 0 },
  { name: "DLP", label: "Dyslipidemia", kind: "bin", group: "History", lo: 0, hi: 1, default: 0 },
  // --- Examination ---
  { name: "BP", label: "Systolic blood pressure", kind: "num", group: "Examination", unit: "mmHg", lo: 80, hi: 200, default: 130 },
  { name: "PR", label: "Pulse rate", kind: "num", group: "Examination", unit: "bpm", lo: 40, hi: 130, default: 75 },
  { name: "Edema", label: "Edema", kind: "bin", group: "Examination", lo: 0, hi: 1, default: 0 },
  { name: "Weak Peripheral Pulse", label: "Weak peripheral pulse", kind: "bin", group: "Examination", lo: 0, hi: 1, default: 0 },
  { name: "Lung rales", label: "Lung rales", kind: "bin", group: "Examination", lo: 0, hi: 1, default: 0 },
  { name: "Systolic Murmur", label: "Systolic murmur", kind: "bin", group: "Examination", lo: 0, hi: 1, default: 0 },
  { name: "Diastolic Murmur", label: "Diastolic murmur", kind: "bin", group: "Examination", lo: 0, hi: 1, default: 0 },
  { name: "Typical Chest Pain", label: "Typical chest pain", kind: "bin", group: "Symptoms", lo: 0, hi: 1, default: 0 },
  { name: "Dyspnea", label: "Dyspnea", kind: "bin", group: "Symptoms", lo: 0, hi: 1, default: 0 },
  { name: "Function Class", label: "Functional class (0-4)", kind: "cat", group: "Symptoms", lo: 0, hi: 4, default: 1 },
  { name: "Atypical", label: "Atypical chest pain", kind: "bin", group: "Symptoms", lo: 0, hi: 1, default: 0 },
  { name: "Nonanginal", label: "Non-anginal chest pain", kind: "bin", group: "Symptoms", lo: 0, hi: 1, default: 0 },
  { name: "Exertional CP", label: "Exertional chest pain", kind: "bin", group: "Symptoms", lo: 0, hi: 1, default: 0 },
  { name: "LowTH Ang", label: "Low-threshold angina", kind: "bin", group: "Symptoms", lo: 0, hi: 1, default: 0 },
  // --- ECG ---
  { name: "Q Wave", label: "Q wave", kind: "bin", group: "ECG", lo: 0, hi: 1, default: 0 },
  { name: "St Elevation", label: "ST elevation", kind: "bin", group: "ECG", lo: 0, hi: 1, default: 0 },
  { name: "St Depression", label: "ST depression", kind: "bin", group: "ECG", lo: 0, hi: 1, default: 0 },
  { name: "Tinversion", label: "T inversion", kind: "bin", group: "ECG", lo: 0, hi: 1, default: 0 },
  { name: "LVH", label: "Left ventricular hypertrophy", kind: "bin", group: "ECG", lo: 0, hi: 1, default: 0 },
  { name: "Poor R Progression", label: "Poor R progression", kind: "bin", group: "ECG", lo: 0, hi: 1, default: 0 },
  { name: "BBB", label: "Bundle branch block (0 none, 1 LBBB, 2 RBBB)", kind: "cat", group: "ECG", lo: 0, hi: 2, default: 0 },
  // --- Laboratory ---
  { name: "FBS", label: "Fasting blood sugar", kind: "num", group: "Laboratory", unit: "mg/dL", lo: 60, hi: 420, default: 100 },
  { name: "CR", label: "Creatinine", kind: "num", group: "Laboratory", unit: "mg/dL", lo: 0.4, hi: 4.0, default: 1.0 },
  { name: "TG", label: "Triglycerides", kind: "num", group: "Laboratory", unit: "mg/dL", lo: 40, hi: 800, default: 150 },
  { name: "LDL", label: "LDL cholesterol", kind: "num", group: "Laboratory", unit: "mg/dL", lo: 30, hi: 300, default: 105 },
  { name: "HDL", label: "HDL cholesterol", kind: "num", group: "Laboratory", unit: "mg/dL", lo: 15, hi: 100, default: 40 },
  { name: "BUN", label: "Blood urea nitrogen", kind: "num", group: "Laboratory", unit: "mg/dL", lo: 5, hi: 60, default: 17 },
  { name: "ESR", label: "ESR", kind: "num", group: "Laboratory", unit: "mm/h", lo: 1, hi: 90, default: 20 },
  { name: "HB", label: "Hemoglobin", kind: "num", group: "Laboratory", unit: "g/dL", lo: 7, hi: 18, default: 13.2 },
  { name: "K", label: "Potassium", kind: "num", group: "Laboratory", unit: "mEq/L", lo: 3.0, hi: 6.0, default: 4.2 },
  { name: "Na", label: "Sodium", kind: "num", group: "Laboratory", unit: "mEq/L", lo: 128, hi: 150, default: 141 },
  { name: "WBC", label: "White blood cells", kind: "num", group: "Laboratory", unit: "/µL", lo: 3000, hi: 18000, default: 7500 },
  { name: "Lymph", label: "Lymphocytes", kind: "num", group: "Laboratory", unit: "%", lo: 5, hi: 60, default: 32 },
  { name: "Neut", label: "Neutrophils", kind: "num", group: "Laboratory", unit: "%", lo: 30, hi: 90, default: 60 },
  { name: "PLT", label: "Platelets", kind: "num", group: "Laboratory", unit: "×10³/µL", lo: 80, hi: 500, default: 230 },
  // --- Echocardiography ---
  { name: "EF-TTE", label: "Ejection fraction (TTE)", kind: "num", group: "Echo", unit: "%", lo: 15, hi: 75, default: 48 },
  { name: "Region RWMA", label: "Regional wall motion abnormality (0-4 regions)", kind: "cat", group: "Echo", lo: 0, hi: 4, default: 0 },
  { name: "VHD", label: "Valvular heart disease (0 none … 3 severe)", kind: "cat", group: "Echo", lo: 0, hi: 3, default: 0 },
];

export const FEATURE_NAMES = FEATURES.map((f) => f.name);
export const FEATURE_BY_NAME = Object.fromEntries(FEATURES.map((f) => [f.name, f]));
export const DISCLAIMER =
  "Decision-support / educational use only. Predictions are statistical estimates and are NOT a substitute for formal diagnostic imaging (e.g. coronary angiography or CT angiography) or clinical judgement.";
