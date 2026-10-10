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
