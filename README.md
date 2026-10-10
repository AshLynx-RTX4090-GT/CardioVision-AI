<div align="center">

  # 🫀 CardioVision-AI

  <p align="center">
    <strong>3D Interactive Coronary Risk Explorer & Clinical Explainability Platform</strong>
  </p>

  <p align="center">
    <a href="https://www.python.org/">
      <img src="https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python" height="28"/>
    </a>
    &nbsp;
    <a href="https://aws.amazon.com/">
      <img src="https://img.shields.io/badge/AWS-Solutions%20Architect-FF9900?style=for-the-badge&logo=amazon-aws&logoColor=white" alt="AWS Solutions Architect" height="28"/>
    </a>
    &nbsp;
    <a href="https://cardio-vision-ai-six.vercel.app/">
      <img src="https://img.shields.io/badge/CardioVision-LYNX%20Co.-00c853?style=for-the-badge&logo=heart&logoColor=white" alt="CardioVision LYNX" height="28"/>
    </a>
  </p>

  <!-- If you have the image file inside your repository root, use this: -->
  <p align="center">
    <img src="CardioVision%20by%20LYNX.jpg" alt="CardioVision by LYNX Logo" width="130" style="border-radius: 50%;" />
  </p>

  <br />

  <!-- Video Preview Card -->
  <p align="center">
    <a href="https://cardio-vision-ai-six.vercel.app/">
      <img src="https://img.shields.io/badge/▶%20Watch%20Demo%20Video-CardioVision%20Walkthrough-red?style=for-the-badge&logo=youtube&logoColor=white" alt="Watch Demo" height="35" />
    </a>
  </p>

  <br />

  <!-- RGB Styled Banner Box -->
  <table align="center" style="border-collapse: collapse; border: none;">
    <tr>
      <td align="center" style="background: linear-gradient(135deg, #ff0055, #7a00ff, #00d2ff); padding: 3px; border-radius: 12px;">
        <table style="background: #0d1117; border-radius: 9px; padding: 12px 28px; border-collapse: collapse;">
          <tr>
            <td align="center">
              🌐 <strong>Live Application:</strong>&nbsp;
              <a href="https://cardio-vision-ai-six.vercel.app/" target="_blank">
                <strong>https://cardio-vision-ai-six.vercel.app/</strong>
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>

</div>

---

## 📖 Overview

**CardioVision AI** is an interactive clinical decision-support and educational platform combining real-time **3D anatomical coronary visualization** with machine-learning-based risk estimation and permutation-sampled **Shapley (SHAP-style) explainability**. 

It evaluates individual patient parameters against demographic cohorts to project multi-vessel stenosis risks across primary coronary trees (**LAD**, **LCX**, and **RCA**).

---

## ✨ Key Features

- **Interactive 3D Coronary Viewport**: Real-time WebGL rendering of the human heart, thoracic landmarks, and major coronary arteries (**LAD**, **LCX**, **RCA**) with mouse drag orbit, zoom, and vessel selection.
- **Multitarget Clinical Risk Prediction**: Simultaneous assessment of global coronary artery disease (**CAD**) index and specific vessel stenosis risks.
- **Explainable AI (Shapley Values)**: Real-time additive feature attribution highlighting exact risk drivers (demographics, blood pressure, glucose, SpO₂, lifestyle).
- **Synthetic Population Calibration**: Calibrated against diverse synthetic patient baselines to contextualize individualized percentiles.
- **Zero-Dependency 3D**: Runs client-side Three.js directly via local imports, preventing CDN lag and enabling reliable offline/clinical deployment.

---

## 📁 Repository Structure





# CardioVision AI – 3D Coronary Risk Explorer

CardioVision is an interactive clinical decision-support and educational platform that combines 3D anatomical coronary visualization with machine-learning-based risk estimation and permutation-sampled Shapley (SHAP-style) explainability.

---

## Architecture & Project Structure

```
CardioVision/
├── frontend/             # Interactive 3D visualization dashboard & UI
│   ├── index.html        # Entrypoint with local Three.js importmap
│   ├── style.css         # UI design system & responsive layout
│   ├── app.js            # Dashboard state, SVG charts, and API binding
│   ├── viewer.js         # Three.js 3D cardiac & coronary viewport
│   ├── anatomy.js        # Procedural coronary anatomy mesh generation
│   └── risk.js           # Multi-vessel risk classification & color scales
├── src/                  # Core application logic & risk engines
│   ├── app.js            # Express application routing & middleware
│   ├── model.js          # Clinical risk model & Shapley explanation engine
│   ├── cohort.js         # Synthetic population generator & baseline stats
│   └── schema.js         # Clinical features schema & domain mappings
├── models/               # Benchmark metrics & validation reports
│   └── metrics.json      # Cross-validation & held-out test evaluation
├── scripts/              # Local run and utility scripts
│   ├── run.bat           # Windows launcher
│   ├── run.sh            # Linux / macOS launcher
│   └── requirements-legacy-python.txt
├── data/                 # Dataset documentation & references
│   └── README.md
├── server.js             # Main server entrypoint (Local, Cloud Run, Vercel)
├── package.json          # Node.js project manifest & scripts
├── package-lock.json     # Dependency lockfile
├── vercel.json           # Vercel deployment configuration
├── metadata.json         # Platform configuration
└── .env.example          # Environment variables template
```

---

## Key Features

- **3D Anatomical Coronary Viewport**: Real-time WebGL rendering of the human heart, thoracic cage, lungs, and the primary coronary vessels (**LAD**, **LCX**, **RCA**) with interactive rotation, artery inspection, and layer toggles.
- **Multitarget Risk Prediction**: Simultaneously estimates overall coronary artery disease (**CAD**) risk along with individual vessel-specific stenosis probabilities.
- **Explainable AI (Shapley Values)**: Computes additive feature contributions (in probability points) with exact additivity, domain waterfall breakdowns, and population percentile context.
- **Zero-Dependency 3D**: Bundles Three.js locally via `/vendor/three`, running completely offline without external CDN latency.

---

## Getting Started

### Prerequisites
- Node.js 18+ (Node.js 20 or 22 recommended)
- npm

### Installation & Run

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start the server**:
   ```bash
   npm start
   ```

3. **Open in browser**:
   Navigate to `http://localhost:3000`.

### Quick Launchers
- **Windows**: Double-click `run.bat`
- **Linux / macOS**: Execute `./run.sh`

---

## Deployment

### Vercel
Deploy seamlessly with zero configuration:
```bash
vercel
```
The repository includes `vercel.json` and `api/index.js` configured for `@vercel/node`.

### Google Cloud Run / Docker
The application automatically binds to `0.0.0.0:${PORT:-3000}`.
