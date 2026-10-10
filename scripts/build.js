import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

console.log("[build] Starting build script for Vercel deployment...");

const frontendDir = path.join(rootDir, "frontend");
const publicDir = path.join(rootDir, "public");

// Ensure public directory exists
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Copy all frontend assets to public directory
if (fs.existsSync(frontendDir)) {
  console.log(`[build] Copying static assets from ${frontendDir} to ${publicDir}...`);
  fs.cpSync(frontendDir, publicDir, { recursive: true });
} else {
  console.warn(`[build] Warning: frontend directory not found at ${frontendDir}`);
}

// Verify Three.js vendor files in public
const vendorThreeBuild = path.join(publicDir, "vendor", "three", "build", "three.module.js");
const vendorThreeControls = path.join(publicDir, "vendor", "three", "examples", "jsm", "controls", "OrbitControls.js");

if (!fs.existsSync(vendorThreeBuild) || !fs.existsSync(vendorThreeControls)) {
  console.log("[build] Ensuring Three.js vendor files from node_modules...");
  const nmThreeBuild = path.join(rootDir, "node_modules", "three", "build", "three.module.js");
  const nmThreeControls = path.join(rootDir, "node_modules", "three", "examples", "jsm", "controls", "OrbitControls.js");

  const targetBuildDir = path.join(publicDir, "vendor", "three", "build");
  const targetControlsDir = path.join(publicDir, "vendor", "three", "examples", "jsm", "controls");

  fs.mkdirSync(targetBuildDir, { recursive: true });
  fs.mkdirSync(targetControlsDir, { recursive: true });

  if (fs.existsSync(nmThreeBuild) && !fs.existsSync(vendorThreeBuild)) {
    fs.copyFileSync(nmThreeBuild, vendorThreeBuild);
  }
  if (fs.existsSync(nmThreeControls) && !fs.existsSync(vendorThreeControls)) {
    fs.copyFileSync(nmThreeControls, vendorThreeControls);
  }
}

// Verify index.html exists
const indexHtml = path.join(publicDir, "index.html");
if (fs.existsSync(indexHtml)) {
  const stats = fs.statSync(indexHtml);
  console.log(`[build] Verified index.html (${stats.size} bytes) in public directory.`);
} else {
  console.error("[build] Error: index.html not found in public directory!");
  process.exit(1);
}

// Verify models/metrics.json exists
const metricsJson = path.join(rootDir, "models", "metrics.json");
if (fs.existsSync(metricsJson)) {
  console.log("[build] Verified models/metrics.json.");
} else {
  console.warn("[build] Warning: models/metrics.json not found, using fallback defaults.");
}

console.log("[build] Build script completed successfully! Application is ready for Vercel deployment.");
