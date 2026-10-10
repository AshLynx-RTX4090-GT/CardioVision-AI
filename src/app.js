import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createCohort } from "./cohort.js";
import { predict } from "./model.js";
import { ALL_TARGETS, DISCLAIMER, FEATURES, GROUP_ORDER, TARGET_LABELS } from "./schema.js";

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

app.use(express.json({ limit: "500kb" }));

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
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Static assets
const threePath = findPath(path.join("node_modules", "three"));
app.use("/vendor/three", express.static(threePath));

const frontendPath = findPath("frontend");
app.use(express.static(frontendPath));

// SPA fallback
app.get("*", (req, res) => {
  res.sendFile(path.join(frontendPath, "index.html"));
});

export default app;
