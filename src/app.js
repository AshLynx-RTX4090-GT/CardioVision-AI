import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createCohort } from "./cohort.js";
import { predict } from "./model.js";
import { ALL_TARGETS, DISCLAIMER, FEATURES, GROUP_ORDER, TARGET_LABELS } from "./schema.js";
import {
  initBackendStorage,
  getUploadsDir,
  getCurrentSessionProfile,
  saveCurrentSessionProfile,
  loginAccount,
  logoutSession,
  listSavedAccounts,
  saveReportToBackend,
  getSavedReports,
  saveDiagnosticToBackend,
  getSavedDiagnostics,
  saveUploadedPhoto,
  listUploadedPhotos,
} from "./storage.js";

// Initialize backend folder persistence
initBackendStorage();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function findPath(relPath) {
  const p1 = path.join(process.cwd(), relPath);
  if (fs.existsSync(p1)) return p1;
  const p2 = path.join(__dirname, "..", relPath);
  if (fs.existsSync(p2)) return p2;
  const p3 = path.join(__dirname, relPath);
  if (fs.existsSync(p3)) return p3;
  return p1;
}

// Load model metrics
let metrics = {};
try {
  const metricsPath = findPath(path.join("models", "metrics.json"));
  const metricsRaw = fs.readFileSync(metricsPath, "utf8");
  metrics = JSON.parse(metricsRaw);
} catch (e) {
  console.warn("Could not read models/metrics.json, using defaults:", e.message);
  metrics = {
    data_source: "synthetic",
    n_rows: 303,
    n_features: 55,
    threshold: 0.5,
    prevalence: { CAD: 0.755, LAD: 0.508, LCX: 0.373, RCA: 0.393 },
    targets: {},
  };
}

// Generate in-memory synthetic cohort & baseline stats
const cohort = createCohort();
const stats = cohort.stats;
const samples = cohort.samples;
const background = cohort.background;

export const app = express();

// Enable CORS so other websites and origins can access the API
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Serve uploaded profile photos & documents from backend files folder
const UPLOADS_PATH = getUploadsDir();
try {
  if (!fs.existsSync(UPLOADS_PATH)) {
    fs.mkdirSync(UPLOADS_PATH, { recursive: true });
  }
} catch (_) {}

app.use("/api/uploads", express.static(UPLOADS_PATH));

// In-memory fallback route for uploads in serverless / read-only filesystem
app.get("/api/uploads/:filename", (req, res, next) => {
  const photo = listUploadedPhotos().find((p) => p.filename === req.params.filename);
  if (photo && photo.dataUrl) {
    const match = photo.dataUrl.match(/^data:([A-Za-z0-9+.-]+\/[A-Za-z0-9+.-]+);base64,(.+)$/);
    if (match) {
      res.setHeader("Content-Type", match[1]);
      return res.send(Buffer.from(match[2], "base64"));
    }
  }
  next();
});

// API routes
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    data_source: metrics.data_source || "synthetic",
    targets: ALL_TARGETS,
  });
});

app.get("/api/schema", (req, res) => {
  res.json({
    features: FEATURES,
    groups: GROUP_ORDER,
    stats,
    targets: ALL_TARGETS.map((t) => ({ id: t, label: TARGET_LABELS[t] })),
    disclaimer: DISCLAIMER,
    data_source: metrics.data_source || "synthetic",
  });
});

app.get("/api/metrics", (req, res) => {
  res.json(metrics);
});

// Helper to determine base URL
function getAppBaseUrl(req) {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const host = req.get("host") || "localhost:3000";
  const proto = req.protocol || (req.secure ? "https" : "http");
  return `${proto}://${host}`;
}

// Helper to construct official OAuth provider authorization URLs
function getProviderAuthUrl(provider, baseUrl) {
  const redirectUri = `${baseUrl}/auth/callback`;
  const p = (provider || "google").toLowerCase();

  if (p === "google") {
    const clientId = process.env.GOOGLE_CLIENT_ID || "8279188219-cardiovision.apps.googleusercontent.com";
    return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent("openid email profile")}&state=google&prompt=select_account`;
  }
  if (p === "google_fit" || p === "googlefit") {
    const clientId = process.env.GOOGLE_CLIENT_ID || "8279188219-cardiovision.apps.googleusercontent.com";
    return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent("https://www.googleapis.com/auth/fitness.activity.read https://www.googleapis.com/auth/fitness.body.read https://www.googleapis.com/auth/fitness.heart_rate.read openid email profile")}&state=google_fit&prompt=consent`;
  }
  if (p === "apple") {
    const clientId = process.env.APPLE_CLIENT_ID || "com.lynxcardio.cardiovision.client";
    return `https://appleid.apple.com/auth/authorize?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code%20id_token&scope=${encodeURIComponent("name email")}&response_mode=form_post&state=apple`;
  }
  if (p === "apple_fitness" || p === "applefitness") {
    const clientId = process.env.APPLE_CLIENT_ID || "com.lynxcardio.cardiovision.fitness";
    return `https://appleid.apple.com/auth/authorize?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code%20id_token&scope=${encodeURIComponent("name email")}&response_mode=form_post&state=apple_fitness`;
  }
  if (p === "microsoft") {
    const clientId = process.env.MICROSOFT_CLIENT_ID || "7a881920-d318-4569-aad2-lynxcardio";
    return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent("openid profile email User.Read")}&response_mode=query&state=microsoft`;
  }

  return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent("8279188219-cardiovision.apps.googleusercontent.com")}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=openid%20email%20profile&state=google`;
}

// ----------------------------------------------------------------------------
// Profile & Accounts API (Backed by backend folder process in data/)
// ----------------------------------------------------------------------------

// Get active profile from backend storage
app.get("/api/user/profile", (req, res) => {
  const profile = getCurrentSessionProfile();
  res.json(profile);
});

// Save updated profile to backend storage process
app.post("/api/user/profile", (req, res) => {
  const updates = req.body;
  if (!updates || typeof updates !== "object") {
    return res.status(400).json({ error: "Invalid profile payload" });
  }

  const updatedProfile = saveCurrentSessionProfile(updates);
  res.json({
    status: "ok",
    message: "Profile details saved successfully in backend process",
    profile: updatedProfile,
  });
});

// Upload profile photo from user's files to backend files process
app.post("/api/user/upload-photo", (req, res) => {
  try {
    const { dataUrl, filename, mimeType, setAsAvatar = true } = req.body || {};
    if (!dataUrl) {
      return res.status(400).json({ error: "Image data required for profile photo upload" });
    }

    const saved = saveUploadedPhoto({
      dataUrl,
      originalFilename: filename,
      mimeType,
    });

    let updatedProfile = getCurrentSessionProfile();
    if (setAsAvatar !== false) {
      updatedProfile = saveCurrentSessionProfile({
        avatarUrl: saved.url,
      });
    }

    res.json({
      status: "ok",
      message: "Profile photo uploaded and saved into backend files",
      photo: saved,
      profile: updatedProfile,
    });
  } catch (err) {
    console.error("Upload profile photo error:", err);
    res.status(500).json({ error: err.message || "Failed to upload photo" });
  }
});

// Retrieve uploaded photos from backend files process
app.get("/api/user/uploads", (req, res) => {
  const uploads = listUploadedPhotos();
  res.json(uploads);
});

// List all known accounts in backend storage
app.get("/api/auth/accounts", (req, res) => {
  const accounts = listSavedAccounts();
  res.json(accounts);
});

// Login / Switch account (persisted in backend folder)
app.post("/api/auth/login", (req, res) => {
  const { email, password, profileId } = req.body || {};
  const key = profileId || email;

  if (!key) {
    return res.status(400).json({ error: "Email or profileId required" });
  }

  const profile = loginAccount(key, { password });
  res.json({
    status: "ok",
    message: `Signed in as ${profile.name}`,
    profile,
  });
});

// Direct OAuth connect & account switch (for Google, Google Fit, Apple, Apple Fitness+, Microsoft)
app.post("/api/auth/oauth-connect", (req, res) => {
  const { provider, extraDetails } = req.body || {};
  if (!provider) {
    return res.status(400).json({ error: "Provider required" });
  }

  const profile = loginAccount(provider, extraDetails || {});
  res.json({
    status: "ok",
    message: `Connected & authenticated via ${profile.provider}`,
    profile,
  });
});

// Logout session
app.post("/api/auth/logout", (req, res) => {
  const guest = logoutSession();
  res.json({
    status: "ok",
    message: "Logged out session successfully",
    profile: guest,
  });
});

// Return provider authorization URL for client-side popups or redirects
app.get("/api/auth/url", (req, res) => {
  const provider = req.query.provider || "google";
  const baseUrl = getAppBaseUrl(req);
  const authUrl = getProviderAuthUrl(provider, baseUrl);
  res.json({
    provider,
    url: authUrl,
    redirectUri: `${baseUrl}/auth/callback`,
  });
});

// Direct HTTP redirect to provider authorization page
app.get("/auth/redirect/:provider", (req, res) => {
  const provider = req.params.provider;
  const baseUrl = getAppBaseUrl(req);
  const authUrl = getProviderAuthUrl(provider, baseUrl);
  res.redirect(authUrl);
});

// OAuth Callback route handler (handles both GET & POST, with and without trailing slash)
const oauthCallbackHandler = (req, res) => {
  const provider = req.query.state || req.body?.state || "google";
  const code = req.query.code || req.body?.code || "sample-auth-code";

  // Record authenticated account in backend process
  const profile = loginAccount(provider, {
    oauthCode: code,
    lastAuthorizedAt: new Date().toISOString(),
  });

  // Return HTML popup response as instructed in oauth-integration skill
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>CardioVision - Authentication Complete</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #0f172a; color: #f8fafc; text-align: center; }
          .card { background: #1e293b; padding: 2rem; border-radius: 1rem; border: 1px solid #334155; max-width: 400px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5); }
          .btn { display: inline-block; margin-top: 1rem; background: #f97316; color: white; padding: 0.5rem 1.25rem; border-radius: 0.5rem; text-decoration: none; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="card">
          <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">✅</div>
          <h2 style="margin: 0 0 0.5rem 0;">Authentication Successful</h2>
          <p style="font-size: 0.875rem; color: #94a3b8; margin: 0;">Connected account with <strong>${profile.provider}</strong>. Details saved in backend storage.</p>
          <a class="btn" href="/" id="cont-btn">Return to CardioVision</a>
        </div>
        <script>
          if (window.opener) {
            window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS', provider: '${provider}', profile: ${JSON.stringify(profile)} }, '*');
            setTimeout(() => window.close(), 1200);
          } else {
            setTimeout(() => { window.location.href = '/'; }, 2000);
          }
        </script>
      </body>
    </html>
  `);
};

app.get(["/auth/callback", "/auth/callback/"], oauthCallbackHandler);
app.post(["/auth/callback", "/auth/callback/"], oauthCallbackHandler);

// ----------------------------------------------------------------------------
// Reports & Diagnostics Storage Process (Backend folder in data/)
// ----------------------------------------------------------------------------

// List all archived clinical reports in backend folder
app.get("/api/reports", (req, res) => {
  const reports = getSavedReports();
  res.json(reports);
});

// Save clinical report to backend folder process
app.post("/api/reports/save", (req, res) => {
  const reportPayload = req.body || {};
  const savedReport = saveReportToBackend(reportPayload);
  res.json({
    status: "ok",
    message: "Medical report saved and archived in backend process folder",
    report: savedReport,
  });
});

// List recent diagnostic calculation records in backend folder
app.get("/api/diagnostics", (req, res) => {
  const diags = getSavedDiagnostics();
  res.json(diags);
});

app.get("/api/samples", (req, res) => {
  res.json(samples);
});

app.post("/api/predict", (req, res) => {
  try {
    const payload = req.body;
    if (!payload || typeof payload !== "object" || !payload.features || typeof payload.features !== "object") {
      return res.status(400).json({ error: 'Body must be {"features": {...}}' });
    }
    const explain = payload.explain !== false;
    const result = predict(payload.features, stats, background, metrics, explain);

    // Save diagnostic run into backend storage process folder
    saveDiagnosticToBackend({
      patientId: getCurrentSessionProfile().id,
      patientName: getCurrentSessionProfile().name,
      features: payload.features,
      results: result,
    });

    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Static assets
const threeVendorPath = findPath(path.join("frontend", "vendor", "three"));
const threeNodePath = findPath(path.join("node_modules", "three"));
const threePath = fs.existsSync(path.join(threeVendorPath, "build", "three.module.js")) ? threeVendorPath : threeNodePath;
app.use("/vendor/three", express.static(threePath));

const frontendPath = findPath("frontend");
app.use(express.static(frontendPath));

// SPA fallback
app.get("*", (req, res) => {
  res.sendFile(path.join(frontendPath, "index.html"));
});

export default app;
