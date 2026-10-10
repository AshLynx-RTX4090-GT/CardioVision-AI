<!-- ========================================== -->
<!-- 1. HEADER, BADGES, VIDEO & RGB DEMO LINK  -->
<!-- ========================================== -->

<div align="center">
  <h1 style="font-size: 3.2rem; font-weight: 800; margin-bottom: 12px; letter-spacing: 1px;">
    CardioVision-AI
  </h1>

  <!-- Badges Section -->
  <p style="margin-bottom: 24px;">
    <!-- Python Logo Badge -->
    <img src="https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python Logo" height="32" />
    &nbsp;
    <!-- AWS Solutions Architect Badge -->
    <img src="https://img.shields.io/badge/AWS-Solutions%20Architect-FF9900?style=for-the-badge&logo=amazon-aws&logoColor=white" alt="AWS Solutions Architect" height="32" />
    &nbsp;
    <!-- CardioVision Badge -->
    <img src="./CardioVision%20by%20LYNX.jpg" alt="CardioVision by LYNX" height="42" style="vertical-align: middle; border-radius: 6px;" />
  </p>

  <!-- Project Video -->
  <div style="max-width: 860px; margin: 20px auto;">
    <video width="100%" controls style="border-radius: 12px; box-shadow: 0 8px 24px rgba(0,0,0,0.25);">
      <source src="M:\CardioVision AI\CardioVision AI\CardioVision by LYNX.mp4" type="video/mp4">
      Your browser does not support the video tag.
    </video>
  </div>

  <!-- RGB Gradient Glowing Box for Web Link -->
  <style>
    @keyframes rgbGlow {
      0%   { background-position: 0% 50%; }
      50%  { background-position: 100% 50%; }
      100% { background-position: 0% 50%; }
    }
    .rgb-border-box {
      display: inline-block;
      padding: 3px;
      margin: 24px auto;
      border-radius: 14px;
      background: linear-gradient(90deg, #ff0055, #7a00ff, #00e5ff, #00ff66, #ffbe00, #ff0055);
      background-size: 400% 400%;
      animation: rgbGlow 6s ease infinite;
      box-shadow: 0 4px 20px rgba(0, 229, 255, 0.35);
    }
    .rgb-inner-content {
      background: #0d1117;
      border-radius: 11px;
      padding: 14px 32px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .rgb-link {
      color: #58a6ff;
      font-size: 1.15rem;
      font-weight: 600;
      text-decoration: none;
      letter-spacing: 0.5px;
    }
    .rgb-link:hover {
      text-decoration: underline;
      color: #79c0ff;
    }
  </style>

  <div class="rgb-border-box">
    <div class="rgb-inner-content">
      <span style="font-size: 1.3rem;">🌐</span>
      <a class="rgb-link" href="https://cardio-vision-ai-six.vercel.app/" target="_blank" rel="noopener noreferrer">
        https://cardio-vision-ai-six.vercel.app/
      </a>
    </div>
  </div>
</div>


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
