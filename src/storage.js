import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Default initial clinical accounts
const DEFAULT_ACCOUNTS = {
  sarah: {
    id: "USR-88219",
    accountKey: "sarah",
    provider: "Email / Clinical EHR",
    name: "Sarah Connor",
    displayName: "Sarah C.",
    email: "sarah.connor@cybercare.med",
    age: 59,
    gender: "Female",
    phone: "+1 (555) 234-8901",
    emergencyContact: "John Connor (+1 555-019-2831)",
    bloodType: "A+",
    wearableId: "CardioTag Sensor #CT-8921",
    wearableActive: true,
    medicalNotes: "Family history of CAD. Low risk profile. Managed with Mediterranean diet.",
    avatarUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuB9eLEf_IPmakKeGwiXjImBaRjBDAoe9gt1FS967W6Dnqp0LSgGYOUOnaSm71uZzEdbic2vARTl8Pmmq1t6Nr09oOmREutsGodYspMN3nwRVlzPKelSud_ydsMXN2Jx-hUiUJcWF3fVW_mzSLl_jQZpEjvUsvH0Zz-31kzoORzM0KydUf0uxa2kaPLEvMmwQRONXxhgR7VbrNhs9CRmAi31fdoyXHKobyWnBSN28Q0PPStEs1lbHYXngA",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  marcus: {
    id: "USR-40192",
    accountKey: "marcus",
    provider: "Email / Clinical EHR",
    name: "Marcus Vance",
    displayName: "Marcus V.",
    email: "m.vance@cardiohealth.org",
    age: 64,
    gender: "Male",
    phone: "+49 30 9182341",
    emergencyContact: "Helena Vance (+49 30 9182349)",
    bloodType: "O+",
    wearableId: "CardioTag Sensor #CT-4402",
    wearableActive: true,
    medicalNotes: "Hypertension, former smoker, borderline LAD narrowing.",
    avatarUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuCOg2HZrNQtu10StJ0KksOCi8_gUC2a6bKWx3t05EGt_afbY7BrZBM-TnXcjyp4hvJz00cfRzYl5R7mabBY1e_Z5Soq8if6ZJFP8dFSx9CZysOcj4XkNFi3-GdsS1C3P4gB9by3JSwVH8Sp2LBv9rgIz7YsC0M_3mmpSy1u9O_URwXDvFAelfXiCZ49wLjjc8IdZGSKl-hJ8MjLJLMt4UYgrTawX3NwaZ4nGjVDKGWzzpsV8WspE99Nag",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  dr_alina: {
    id: "DOC-0129",
    accountKey: "dr_alina",
    provider: "Staff EHR Credentials",
    name: "Dr. Alina Bhart",
    displayName: "Dr. Alina B.",
    email: "alina.bhart@lynxcardio.de",
    age: 41,
    gender: "Female",
    phone: "+49 30 1234567",
    emergencyContact: "Lynx Cardio Hospital Dispatch (+49 30 1234567890)",
    bloodType: "B+",
    wearableId: "CardioTag Clinical Master #CM-01",
    wearableActive: true,
    medicalNotes: "Attending Cardiologist · Head of Non-Invasive Hemodynamics.",
    avatarUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuD9Z_W9ZdGmm9FAwZ7p04DOI1LewV_g41Q_W5lrjnXcXMbSeBY01Ta5unk0TE2Nyqc0kBTQlAVNlS8RO3EsF0EgZCxnRwgUtaiRjoZM9n4tr7bFKbmoXcp9rFqiQbqjHT5WpcF8YXDg-8dojpod1sq_mTZELEJvo_eVMqcG6Jv1oyebp9ZrgTOxwJtxNJw15aHHjGW6TKEUYiZKWGupxLnjfGYUW4vL210Q8xntXzIGG_2WZ-9wlRlc6w",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  google: {
    id: "USR-GOOG-8819",
    accountKey: "google",
    provider: "Google Account",
    name: "Ashirbad Biswal",
    displayName: "Ashirbad B.",
    email: "ashirbadbiswal82791@gmail.com",
    age: 38,
    gender: "Male",
    phone: "+1 (650) 253-0000",
    emergencyContact: "Family Contact (+1 650-555-0199)",
    bloodType: "O+",
    wearableId: "Google WearOS Cardiac Sensor #GW-7712",
    wearableActive: true,
    medicalNotes: "Authenticated via Google Single Sign-On. Resting heart rate 72 bpm baseline.",
    avatarUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuA7yZrqxXgX0Q-iX3R8qj17eJ37M0-P_wQn2l7hK_RjK7nZ6lK-kM8b_q=s96-c",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  google_fit: {
    id: "USR-GFIT-9902",
    accountKey: "google_fit",
    provider: "Google Fit",
    name: "Ashirbad Biswal",
    displayName: "Ashirbad (Fit)",
    email: "ashirbadbiswal82791@gmail.com",
    age: 38,
    gender: "Male",
    phone: "+1 (650) 253-0000",
    emergencyContact: "Emergency Care Contact (+1 650-555-0199)",
    bloodType: "O+",
    wearableId: "Pixel Watch 3 (Google Fit Connected #GF-8831)",
    wearableActive: true,
    medicalNotes: "Direct telemetry streaming via Google Fit REST API. Daily activity & step cadence logged.",
    avatarUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuA7yZrqxXgX0Q-iX3R8qj17eJ37M0-P_wQn2l7hK_RjK7nZ6lK-kM8b_q=s96-c",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  apple: {
    id: "USR-APPL-7731",
    accountKey: "apple",
    provider: "Apple Account",
    name: "Sarah Connor (Apple ID)",
    displayName: "Sarah (Apple)",
    email: "sarah.connor@icloud.com",
    age: 59,
    gender: "Female",
    phone: "+1 (408) 996-1010",
    emergencyContact: "John Connor (+1 555-019-2831)",
    bloodType: "A+",
    wearableId: "Apple Watch Series 10 #AW-5521",
    wearableActive: true,
    medicalNotes: "Sign in with Apple verified with biometric FaceID passkey.",
    avatarUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuB9eLEf_IPmakKeGwiXjImBaRjBDAoe9gt1FS967W6Dnqp0LSgGYOUOnaSm71uZzEdbic2vARTl8Pmmq1t6Nr09oOmREutsGodYspMN3nwRVlzPKelSud_ydsMXN2Jx-hUiUJcWF3fVW_mzSLl_jQZpEjvUsvH0Zz-31kzoORzM0KydUf0uxa2kaPLEvMmwQRONXxhgR7VbrNhs9CRmAi31fdoyXHKobyWnBSN28Q0PPStEs1lbHYXngA",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  apple_fitness: {
    id: "USR-AFIT-6604",
    accountKey: "apple_fitness",
    provider: "Apple Fitness+",
    name: "Marcus Vance",
    displayName: "Marcus (Fitness+)",
    email: "marcus.vance@icloud.com",
    age: 64,
    gender: "Male",
    phone: "+49 30 9182341",
    emergencyContact: "Helena Vance (+49 30 9182349)",
    bloodType: "O+",
    wearableId: "Apple Watch Ultra 2 #AF-4091 (Fitness+ Live)",
    wearableActive: true,
    medicalNotes: "Apple Fitness+ biometric stream connected. Active VO2 Max and cardio recovery monitoring.",
    avatarUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuCOg2HZrNQtu10StJ0KksOCi8_gUC2a6bKWx3t05EGt_afbY7BrZBM-TnXcjyp4hvJz00cfRzYl5R7mabBY1e_Z5Soq8if6ZJFP8dFSx9CZysOcj4XkNFi3-GdsS1C3P4gB9by3JSwVH8Sp2LBv9rgIz7YsC0M_3mmpSy1u9O_URwXDvFAelfXiCZ49wLjjc8IdZGSKl-hJ8MjLJLMt4UYgrTawX3NwaZ4nGjVDKGWzzpsV8WspE99Nag",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  microsoft: {
    id: "USR-MSFT-5012",
    accountKey: "microsoft",
    provider: "Microsoft Account",
    name: "Dr. Alina Bhart (Microsoft)",
    displayName: "Dr. Alina (MS)",
    email: "alina.bhart@outlook.com",
    age: 41,
    gender: "Female",
    phone: "+49 30 1234567",
    emergencyContact: "Lynx Cardio Hospital Dispatch (+49 30 1234567890)",
    bloodType: "B+",
    wearableId: "Microsoft Cloud for Healthcare Telemetry #MS-012",
    wearableActive: true,
    medicalNotes: "Microsoft Entra ID authenticated hospital credential. Fast Identity Online (FIDO2) certified.",
    avatarUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuD9Z_W9ZdGmm9FAwZ7p04DOI1LewV_g41Q_W5lrjnXcXMbSeBY01Ta5unk0TE2Nyqc0kBTQlAVNlS8RO3EsF0EgZCxnRwgUtaiRjoZM9n4tr7bFKbmoXcp9rFqiQbqjHT5WpcF8YXDg-8dojpod1sq_mTZELEJvo_eVMqcG6Jv1oyebp9ZrgTOxwJtxNJw15aHHjGW6TKEUYiZKWGupxLnjfGYUW4vL210Q8xntXzIGG_2WZ-9wlRlc6w",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
};

// In-memory backing cache (ensures zero crashes in serverless / read-only filesystems like Vercel Lambda)
const inMemoryStore = {
  accounts: { ...DEFAULT_ACCOUNTS },
  currentSession: { ...DEFAULT_ACCOUNTS.sarah },
  reports: [],
  diagnostics: [],
  uploads: [],
};

// Determine writable data directory
function resolveDataDir() {
  if (process.env.VERCEL) {
    return path.join(os.tmpdir(), "cardiovision_data");
  }
  const defaultDir = path.join(process.cwd(), "data");
  try {
    if (!fs.existsSync(defaultDir)) {
      fs.mkdirSync(defaultDir, { recursive: true });
    }
    const testFile = path.join(defaultDir, ".write_test");
    fs.writeFileSync(testFile, "ok");
    fs.unlinkSync(testFile);
    return defaultDir;
  } catch (_) {
    return path.join(os.tmpdir(), "cardiovision_data");
  }
}

const DATA_DIR = resolveDataDir();
const ACCOUNTS_DIR = path.join(DATA_DIR, "accounts");
const REPORTS_DIR = path.join(DATA_DIR, "reports");
const DIAGNOSTICS_DIR = path.join(DATA_DIR, "diagnostics");
const UPLOADS_DIR = path.join(DATA_DIR, "uploads");
const CURRENT_SESSION_FILE = path.join(DATA_DIR, "current_session.json");

export function getUploadsDir() {
  return UPLOADS_DIR;
}

// Safe directory creation that never crashes
function ensureDir(dir) {
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  } catch (err) {
    // Read-only filesystem warning; inMemoryStore serves as fallback
  }
}

// Safe file write
function safeWriteFile(filePath, content) {
  try {
    ensureDir(path.dirname(filePath));
    fs.writeFileSync(filePath, content, "utf8");
    return true;
  } catch (err) {
    return false;
  }
}

// Safe file read
function safeReadFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, "utf8");
    }
  } catch (err) {}
  return null;
}

// Initialize backend folder process
export function initBackendStorage() {
  ensureDir(DATA_DIR);
  ensureDir(ACCOUNTS_DIR);
  ensureDir(REPORTS_DIR);
  ensureDir(DIAGNOSTICS_DIR);
  ensureDir(UPLOADS_DIR);

  // Initialize accounts files if missing
  for (const [key, acc] of Object.entries(DEFAULT_ACCOUNTS)) {
    const accFile = path.join(ACCOUNTS_DIR, `${key}.json`);
    if (!fs.existsSync(accFile)) {
      safeWriteFile(accFile, JSON.stringify(acc, null, 2));
    }
  }

  // Initialize active session file if missing
  if (!fs.existsSync(CURRENT_SESSION_FILE)) {
    safeWriteFile(CURRENT_SESSION_FILE, JSON.stringify(DEFAULT_ACCOUNTS.sarah, null, 2));
  }

  console.log(`Backend storage initialized at ${DATA_DIR} (serverless/Vercel resilient)`);
}

// Get current active user session profile
export function getCurrentSessionProfile() {
  const content = safeReadFile(CURRENT_SESSION_FILE);
  if (content) {
    try {
      const parsed = JSON.parse(content);
      inMemoryStore.currentSession = parsed;
      return parsed;
    } catch (_) {}
  }
  return inMemoryStore.currentSession || DEFAULT_ACCOUNTS.sarah;
}

// Save active session and sync to account file
export function saveCurrentSessionProfile(profileUpdates) {
  const current = getCurrentSessionProfile();
  const updated = {
    ...current,
    ...profileUpdates,
    updatedAt: new Date().toISOString(),
  };

  inMemoryStore.currentSession = updated;
  const accountKey = updated.accountKey || updated.email?.toLowerCase().replace(/[^a-z0-9]/g, "_") || "user";
  inMemoryStore.accounts[accountKey] = updated;

  safeWriteFile(CURRENT_SESSION_FILE, JSON.stringify(updated, null, 2));
  safeWriteFile(path.join(ACCOUNTS_DIR, `${accountKey}.json`), JSON.stringify(updated, null, 2));

  return updated;
}

// Switch or login to an account by key or email
export function loginAccount(keyOrEmail, extraData = {}) {
  const normalizedKey = keyOrEmail ? keyOrEmail.toLowerCase().trim() : "";

  // 1. Check in-memory store first
  if (inMemoryStore.accounts[normalizedKey]) {
    const existing = inMemoryStore.accounts[normalizedKey];
    const merged = { ...existing, ...extraData, updatedAt: new Date().toISOString() };
    inMemoryStore.accounts[normalizedKey] = merged;
    inMemoryStore.currentSession = merged;
    safeWriteFile(path.join(ACCOUNTS_DIR, `${normalizedKey}.json`), JSON.stringify(merged, null, 2));
    safeWriteFile(CURRENT_SESSION_FILE, JSON.stringify(merged, null, 2));
    return merged;
  }

  // 2. Check by email in-memory
  for (const [k, acc] of Object.entries(inMemoryStore.accounts)) {
    if (acc.email && acc.email.toLowerCase() === normalizedKey) {
      const merged = { ...acc, ...extraData, updatedAt: new Date().toISOString() };
      inMemoryStore.accounts[k] = merged;
      inMemoryStore.currentSession = merged;
      safeWriteFile(path.join(ACCOUNTS_DIR, `${k}.json`), JSON.stringify(merged, null, 2));
      safeWriteFile(CURRENT_SESSION_FILE, JSON.stringify(merged, null, 2));
      return merged;
    }
  }

  // 3. Check direct preset account file on disk
  const directPath = path.join(ACCOUNTS_DIR, `${normalizedKey}.json`);
  const directContent = safeReadFile(directPath);
  if (directContent) {
    try {
      const existing = JSON.parse(directContent);
      const merged = { ...existing, ...extraData, updatedAt: new Date().toISOString() };
      inMemoryStore.accounts[normalizedKey] = merged;
      inMemoryStore.currentSession = merged;
      safeWriteFile(directPath, JSON.stringify(merged, null, 2));
      safeWriteFile(CURRENT_SESSION_FILE, JSON.stringify(merged, null, 2));
      return merged;
    } catch (_) {}
  }

  // 4. Scan disk for matching email
  try {
    if (fs.existsSync(ACCOUNTS_DIR)) {
      const files = fs.readdirSync(ACCOUNTS_DIR);
      for (const f of files) {
        if (f.endsWith(".json")) {
          const full = path.join(ACCOUNTS_DIR, f);
          const raw = safeReadFile(full);
          if (raw) {
            const data = JSON.parse(raw);
            if (data.email && data.email.toLowerCase() === normalizedKey) {
              const merged = { ...data, ...extraData, updatedAt: new Date().toISOString() };
              inMemoryStore.accounts[data.accountKey || f.replace(".json", "")] = merged;
              inMemoryStore.currentSession = merged;
              safeWriteFile(full, JSON.stringify(merged, null, 2));
              safeWriteFile(CURRENT_SESSION_FILE, JSON.stringify(merged, null, 2));
              return merged;
            }
          }
        }
      }
    }
  } catch (_) {}

  // 5. If brand new account (e.g. custom email or oauth)
  const isEmail = normalizedKey.includes("@");
  const namePart = isEmail ? normalizedKey.split("@")[0].replace(/[._-]/g, " ") : normalizedKey;
  const formattedName = namePart.charAt(0).toUpperCase() + namePart.slice(1);
  const newId = `USR-${Math.floor(10000 + Math.random() * 90000)}`;

  const newAccount = {
    id: newId,
    accountKey: isEmail ? normalizedKey.replace(/[^a-z0-9]/g, "_") : normalizedKey,
    provider: extraData.provider || "Direct Clinical Login",
    name: extraData.name || formattedName,
    displayName: extraData.displayName || formattedName.slice(0, 10),
    email: isEmail ? normalizedKey : `${normalizedKey}@cardiovision.med`,
    age: extraData.age || 45,
    gender: extraData.gender || "Other",
    phone: extraData.phone || "+1 (555) 000-0000",
    emergencyContact: extraData.emergencyContact || "Medical Dispatcher (+1 555-019-0000)",
    bloodType: extraData.bloodType || "O+",
    wearableId: extraData.wearableId || "CardioTag Sensor #CT-9900",
    wearableActive: true,
    medicalNotes: extraData.medicalNotes || "Direct patient account created.",
    avatarUrl: extraData.avatarUrl || "https://lh3.googleusercontent.com/aida-public/AB6AXuB9eLEf_IPmakKeGwiXjImBaRjBDAoe9gt1FS967W6Dnqp0LSgGYOUOnaSm71uZzEdbic2vARTl8Pmmq1t6Nr09oOmREutsGodYspMN3nwRVlzPKelSud_ydsMXN2Jx-hUiUJcWF3fVW_mzSLl_jQZpEjvUsvH0Zz-31kzoORzM0KydUf0uxa2kaPLEvMmwQRONXxhgR7VbrNhs9CRmAi31fdoyXHKobyWnBSN28Q0PPStEs1lbHYXngA",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...extraData,
  };

  inMemoryStore.accounts[newAccount.accountKey] = newAccount;
  inMemoryStore.currentSession = newAccount;
  safeWriteFile(path.join(ACCOUNTS_DIR, `${newAccount.accountKey}.json`), JSON.stringify(newAccount, null, 2));
  safeWriteFile(CURRENT_SESSION_FILE, JSON.stringify(newAccount, null, 2));
  return newAccount;
}

// Logout session
export function logoutSession() {
  const guestProfile = {
    id: "GUEST-0000",
    accountKey: "guest",
    provider: "Guest / Signed Out",
    name: "Guest Patient",
    displayName: "Guest",
    email: "guest@cardiovision.med",
    age: 40,
    gender: "Unknown",
    phone: "--",
    emergencyContact: "--",
    bloodType: "--",
    wearableId: "No Wearable Connected",
    wearableActive: false,
    medicalNotes: "Logged out session. Please sign in to view personal clinical telemetry.",
    avatarUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuB9eLEf_IPmakKeGwiXjImBaRjBDAoe9gt1FS967W6Dnqp0LSgGYOUOnaSm71uZzEdbic2vARTl8Pmmq1t6Nr09oOmREutsGodYspMN3nwRVlzPKelSud_ydsMXN2Jx-hUiUJcWF3fVW_mzSLl_jQZpEjvUsvH0Zz-31kzoORzM0KydUf0uxa2kaPLEvMmwQRONXxhgR7VbrNhs9CRmAi31fdoyXHKobyWnBSN28Q0PPStEs1lbHYXngA",
    isLoggedOut: true,
    updatedAt: new Date().toISOString(),
  };

  inMemoryStore.currentSession = guestProfile;
  safeWriteFile(CURRENT_SESSION_FILE, JSON.stringify(guestProfile, null, 2));
  return guestProfile;
}

// List all accounts available in backend storage
export function listSavedAccounts() {
  const accountMap = new Map();

  // Load from in-memory store
  for (const [key, data] of Object.entries(inMemoryStore.accounts)) {
    accountMap.set(key, {
      accountKey: data.accountKey || key,
      name: data.name,
      displayName: data.displayName,
      email: data.email,
      provider: data.provider,
      wearableId: data.wearableId,
      updatedAt: data.updatedAt,
    });
  }

  // Also read from disk if available
  try {
    if (fs.existsSync(ACCOUNTS_DIR)) {
      const files = fs.readdirSync(ACCOUNTS_DIR);
      for (const f of files) {
        if (f.endsWith(".json")) {
          const raw = safeReadFile(path.join(ACCOUNTS_DIR, f));
          if (raw) {
            const data = JSON.parse(raw);
            const key = data.accountKey || f.replace(".json", "");
            accountMap.set(key, {
              accountKey: key,
              name: data.name,
              displayName: data.displayName,
              email: data.email,
              provider: data.provider,
              wearableId: data.wearableId,
              updatedAt: data.updatedAt,
            });
          }
        }
      }
    }
  } catch (_) {}

  return Array.from(accountMap.values());
}

// Save a Medical / Biometric Report into backend folder
export function saveReportToBackend(reportPayload) {
  const now = new Date();
  const id = `REP-${now.getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
  const filename = `report_${now.getTime()}_${id}.json`;
  const filePath = path.join(REPORTS_DIR, filename);

  const fullReport = {
    reportId: id,
    filename,
    backendPath: `data/reports/${filename}`,
    hospital: "LYNX Cardio Hospitals & Care Berlin",
    hospitalAddress: "2nd Street, 5090, Berlin, GERMANY - 10115",
    hospitalContact: "Tel: 1234567890 | Lynx@cardiovison.gmail.com",
    savedAt: now.toISOString(),
    patient: reportPayload.patient || getCurrentSessionProfile(),
    vitals: reportPayload.vitals || { bp: "122/78 mmHg", hr: "78 BPM", spo2: "97%" },
    predictions: reportPayload.predictions || {},
    physicianSignoff: {
      physician: "Dr. Alina Bhart, MD, FACC",
      title: "Head of Non-Invasive Hemodynamics · LYNX Cardio Hospitals & Care Berlin",
      seal: "VERIFIED EHR SEAL #9A82-LYNX",
      timestamp: now.toISOString(),
    },
    notes: reportPayload.notes || "Official clinical biometric report compiled and archived.",
  };

  inMemoryStore.reports.unshift(fullReport);
  safeWriteFile(filePath, JSON.stringify(fullReport, null, 2));
  return fullReport;
}

// Get all saved reports from backend storage
export function getSavedReports() {
  const reports = [...inMemoryStore.reports];
  const seenIds = new Set(reports.map((r) => r.reportId));

  try {
    if (fs.existsSync(REPORTS_DIR)) {
      const files = fs.readdirSync(REPORTS_DIR).sort().reverse();
      for (const f of files) {
        if (f.endsWith(".json")) {
          const raw = safeReadFile(path.join(REPORTS_DIR, f));
          if (raw) {
            const r = JSON.parse(raw);
            if (r.reportId && !seenIds.has(r.reportId)) {
              seenIds.add(r.reportId);
              reports.push(r);
            }
          }
        }
      }
    }
  } catch (_) {}

  return reports.sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));
}

// Save Diagnostic Calculation into backend folder
export function saveDiagnosticToBackend(diagPayload) {
  const now = new Date();
  const id = `DIAG-${now.getTime()}-${Math.floor(100 + Math.random() * 900)}`;
  const filename = `diag_${id}.json`;
  const filePath = path.join(DIAGNOSTICS_DIR, filename);

  const fullDiag = {
    diagnosticId: id,
    backendPath: `data/diagnostics/${filename}`,
    timestamp: now.toISOString(),
    patientId: diagPayload.patientId || getCurrentSessionProfile().id,
    patientName: diagPayload.patientName || getCurrentSessionProfile().name,
    features: diagPayload.features || {},
    results: diagPayload.results || {},
  };

  inMemoryStore.diagnostics.unshift(fullDiag);
  if (inMemoryStore.diagnostics.length > 50) {
    inMemoryStore.diagnostics.length = 50;
  }
  safeWriteFile(filePath, JSON.stringify(fullDiag, null, 2));
  return fullDiag;
}

// Get recent diagnostics from backend folder
export function getSavedDiagnostics() {
  const diags = [...inMemoryStore.diagnostics];
  const seenIds = new Set(diags.map((d) => d.diagnosticId));

  try {
    if (fs.existsSync(DIAGNOSTICS_DIR)) {
      const files = fs.readdirSync(DIAGNOSTICS_DIR).sort().reverse().slice(0, 20);
      for (const f of files) {
        if (f.endsWith(".json")) {
          const raw = safeReadFile(path.join(DIAGNOSTICS_DIR, f));
          if (raw) {
            const d = JSON.parse(raw);
            if (d.diagnosticId && !seenIds.has(d.diagnosticId)) {
              seenIds.add(d.diagnosticId);
              diags.push(d);
            }
          }
        }
      }
    }
  } catch (_) {}

  return diags.slice(0, 20);
}

// Save uploaded profile photo into storage
export function saveUploadedPhoto({ dataUrl, buffer, originalFilename, mimeType }) {
  let fileBuffer;
  let ext = ".jpg";

  if (dataUrl) {
    const match = dataUrl.match(/^data:image\/([a-zA-Z0-9+.-]+);base64,(.+)$/);
    if (match) {
      const rawExt = match[1].toLowerCase();
      ext = rawExt === "jpeg" ? ".jpg" : `.${rawExt.replace(/[^a-z0-9]/g, "")}`;
      fileBuffer = Buffer.from(match[2], "base64");
    } else {
      fileBuffer = Buffer.from(dataUrl, "base64");
    }
  } else if (buffer) {
    fileBuffer = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
    if (originalFilename) {
      const parsedExt = path.extname(originalFilename).toLowerCase();
      if (parsedExt) ext = parsedExt;
    }
  }

  if (!fileBuffer || fileBuffer.length === 0) {
    throw new Error("Invalid or empty image buffer");
  }

  const cleanBase = (originalFilename || "profile_photo")
    .replace(/\.[^/.]+$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "_")
    .slice(0, 30);

  const filename = `${cleanBase || "photo"}_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}${ext}`;
  const filePath = path.join(UPLOADS_DIR, filename);

  const photoRecord = {
    filename,
    url: `/api/uploads/${filename}`,
    dataUrl: dataUrl || `data:image/${ext.replace(".", "")};base64,${fileBuffer.toString("base64")}`,
    size: fileBuffer.length,
    backendPath: `data/uploads/${filename}`,
    savedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };

  inMemoryStore.uploads.unshift(photoRecord);

  try {
    ensureDir(UPLOADS_DIR);
    fs.writeFileSync(filePath, fileBuffer);
  } catch (_) {}

  return photoRecord;
}

// List all uploaded photos in storage
export function listUploadedPhotos() {
  const items = [...inMemoryStore.uploads];
  const seenFiles = new Set(items.map((i) => i.filename));

  try {
    if (fs.existsSync(UPLOADS_DIR)) {
      const files = fs.readdirSync(UPLOADS_DIR);
      for (const f of files) {
        if (/\.(png|jpe?g|webp|gif|svg)$/i.test(f) && !seenFiles.has(f)) {
          const full = path.join(UPLOADS_DIR, f);
          try {
            const stat = fs.statSync(full);
            items.push({
              filename: f,
              url: `/api/uploads/${f}`,
              size: stat.size,
              createdAt: stat.birthtime || stat.mtime,
              backendPath: `data/uploads/${f}`,
            });
            seenFiles.add(f);
          } catch (_) {}
        }
      }
    }
  } catch (_) {}

  return items.sort((a, b) => new Date(b.createdAt || b.savedAt) - new Date(a.createdAt || a.savedAt));
}
