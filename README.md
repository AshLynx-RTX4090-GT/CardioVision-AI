<p align="center">
  <img src="CardioVision%20by%20LYNX.gif" alt="CardioVision by LYNX" />
</p>

<div align="center">
  <h1>CardioVision-AI</h1>
  <p><strong>3D Coronary Risk Explorer</strong></p>
  <p>
    <a href="https://cardio-vision-ai-six.vercel.app/">
      <img src="frontend/cardiovision-lynx-logo.svg" alt="CardioVision badge" height="72">
    </a>
  </p>
</div>

<div align="center">
  <video controls width="85%" poster="frontend/cardiovision-lynx-logo.svg">
    <source src="CardioVision%20by%20LYNX.mp4" type="video/mp4">
    Your browser does not support the video tag.
  </video>
</div>

<div align="center" style="margin: 18px 0;">
  <a href="https://cardio-vision-ai-six.vercel.app/" style="display: inline-block; padding: 12px 22px; border-radius: 10px; color: #ffffff; font-weight: 700; text-decoration: none; background: linear-gradient(90deg, rgb(0, 119, 255), rgb(126, 34, 206), rgb(236, 72, 153)); box-shadow: 0 0 14px rgba(126, 34, 206, 0.55);">
    Visit the CardioVision-AI Website
  </a>
</div>

  <table align="center" style="border-collapse: separate; border-spacing: 10px; border: 1px solid #30363d; border-radius: 12px; padding: 8px 12px; background: #0d1117;">
    <tr>
      <td>
        <a href="https://www.python.org/">
          <img src="https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python" height="28"/>
        </a>
      </td>
      <td>
        <a href="https://aws.amazon.com/">
          <img src="https://img.shields.io/badge/AWS-Solutions%20Architect-FF9900?style=for-the-badge&logo=amazon-aws&logoColor=white" alt="AWS Solutions Architect" height="28"/>
        </a>
      </td>
      <td>
        <img src="https://img.shields.io/badge/Medical-Heart-E63946?style=for-the-badge&logo=heart&logoColor=white" alt="Medical heart badge" height="28"/>
      </td>
    </tr>
  </table>

  <p align="center">
    <img src="CardioVision%20by%20LYNX.jpeg" alt="CardioVision by LYNX Logo" width="130" style="border-radius: 50%;" />
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

<!-- Logos Section: AWS Cloud Solution Architect -->
<table border="0" align="center">
<tr>
 <td align="center" width="200">
        <img src="https://images.credly.com/images/0e284c3f-5164-4b21-8660-0d84737941bc/image.png" width="100" alt="AWS Solutions Architect Logo" /><br/>
        <sub><b>AWS Solution Architect</b></sub>
      </td>
    </tr>
  </table>
  
---

## 📖 Overview

**CardioVision AI** is an interactive clinical decision-support and educational platform that combines real-time **3D anatomical coronary visualization** with machine-learning-based risk estimation and permutation-sampled **Shapley (SHAP-style) explainability**. 

It evaluates individual patient parameters against demographic cohorts to project multi-vessel stenosis risks across primary coronary trees (**LAD**, **LCX**, and **RCA**).

---

## ✨ Key Features

- **Interactive 3D Coronary Viewport**: Real-time WebGL rendering of the human heart, thoracic landmarks, and major coronary arteries (**LAD**, **LCX**, **RCA**) with mouse drag orbit, zoom, and vessel selection.
- **Multitarget Clinical Risk Prediction**: Simultaneous assessment of global coronary artery disease (**CAD**) index and specific vessel stenosis risks.
- **Explainable AI (Shapley Values)**: Real-time additive feature attribution highlighting exact risk drivers (demographics, blood pressure, glucose, SpO₂, lifestyle).
- **Synthetic Population Calibration**: Calibrated against diverse synthetic patient baselines to contextualize individualized percentiles.
- **Zero-Dependency 3D**: Runs client-side Three.js directly via local imports, preventing CDN lag and enabling reliable offline/clinical deployment.

---

<!-- ======================================================== -->
<!-- 🎬 ANIMATED DEMO PREVIEW (MIDDLE OF README)               -->
<!-- ======================================================== -->

<div align="center">
  <h3>✨ CardioVision 3D Cardiac Simulation & Telemetry ✨</h3>
  <br />
  <!-- If converted to GIF in repo: -->
  <img src="cardiovision-demo.gif" alt="CardioVision 3D Cardiac Simulation" width="650" style="border-radius: 14px; box-shadow: 0 8px 30px rgba(0, 0, 0, 0.45); max-width: 100%;" />
  
  <p><sub><i>Real-time 3D anatomical rendering and clinical telemetry engine by LYNX Co.</i></sub></p>
</div>

---

## 📁 Repository Structure



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

---

<h1 align="center">⚖️Apache-2.0 License</h1>

This project is distributed under the terms of the [Apache-2.0 License](LICENSE).

<div align="center">
## ⚠️Disclaimer
CardioVision-AI is intended for educational, research, and demonstration purposes only. It is not a medical device and does not provide diagnosis, treatment recommendations, or emergency medical advice. Predictions and visualizations must not replace assessment by a qualified healthcare professional. Always consult an appropriately licensed clinician for medical decisions.
</div>

## 3D Project Flowchart

```mermaid
flowchart LR
    U([User]) --> UI["frontend / public<br/>index.html + app.js"]
    UI --> V["Three.js Viewer<br/>anatomy.js + viewer.js"]
    UI --> API["API Layer<br/>server.js / api/index.js"]
    API --> CORE["Core Risk Engine<br/>src/app.js + model.js"]
    CORE --> DATA["Cohort & Schema<br/>cohort.js + schema.js"]
    CORE --> M["Trained Models<br/>models/*.joblib"]
    API --> STORE["Storage<br/>src/storage.js"]
    STORE --> D["data/"]
    CORE --> EX["Explainability<br/>SHAP-style output"]
    EX --> UI
    API --> DEPLOY["Deployment<br/>vercel.json / scripts/"]

    classDef ui fill:#0ea5e9,stroke:#075985,color:#fff
    classDef api fill:#8b5cf6,stroke:#5b21b6,color:#fff
    classDef core fill:#10b981,stroke:#047857,color:#fff
    classDef data fill:#f59e0b,stroke:#b45309,color:#fff
    classDef deploy fill:#ec4899,stroke:#9d174d,color:#fff
    class UI,V ui
    class API,STORE api
    class CORE,EX core
    class DATA,M,D data
    class DEPLOY deploy
```
