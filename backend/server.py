"""CardioVision API + static frontend server (stdlib only; no web framework needed).

Run:  python -m backend.server [--port 8000]

Endpoints
  GET  /api/health     liveness + data source
  GET  /api/schema     feature schema, groups, population stats
  GET  /api/metrics    training / validation report (metrics.json)
  GET  /api/samples    example patients taken from the dataset
  POST /api/predict    {"features": {...}, "explain": true}  -> probabilities + Shapley breakdown
  GET  /*              frontend (frontend/ directory)
"""
from __future__ import annotations

import argparse
import json
import math
import mimetypes
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

import joblib
import numpy as np
import pandas as pd

from .config import (ALL_TARGETS, FEATURE_BY_NAME, FEATURE_NAMES, FEATURES, GROUP_ORDER, MODEL_DIR,
                     ROOT, TARGET_LABELS)
from .data import load_dataset
from .explain import shapley_values

FRONTEND = ROOT / "frontend"
DISCLAIMER = ("Decision-support / educational use only. Predictions are statistical estimates and are NOT a "
              "substitute for formal diagnostic imaging (e.g. coronary angiography or CT angiography) or clinical judgement.")
_lock = threading.Lock()


class State:
    def __init__(self):
        if not (MODEL_DIR / "metrics.json").exists():
            raise SystemExit("No trained models found. Run:  python -m backend.train")
        self.models = {t: joblib.load(MODEL_DIR / f"{t}.joblib") for t in ALL_TARGETS}
        meta = joblib.load(MODEL_DIR / "meta.joblib")
        self.stats, self.background = meta["stats"], meta["background"]
        self.metrics = json.loads((MODEL_DIR / "metrics.json").read_text())
        self.df, self.source = load_dataset()
        self.samples = self._make_samples()

    def _make_samples(self):
        df = self.df
        picks = []

        def add(name, mask, desc):
            sub = df[mask]
            if len(sub):
                r = sub.iloc[len(sub) // 2]
                picks.append(dict(
                    id=name, description=desc,
                    features={f: _clean(r[f]) for f in FEATURE_NAMES},
                    cath_labels={t: int(r[t]) for t in ["CAD", "LAD", "LCX", "RCA"]}))

        add("multi", (df.LAD == 1) & (df.LCX == 1) & (df.RCA == 1), "Dataset patient, 3-vessel disease on catheterisation")
        add("lad", (df.LAD == 1) & (df.LCX == 0) & (df.RCA == 0), "Dataset patient, LAD-only stenosis")
        add("rca", (df.RCA == 1) & (df.LAD == 0) & (df.LCX == 0), "Dataset patient, RCA-only stenosis")
        add("lcx", (df.LCX == 1) & (df.LAD == 0) & (df.RCA == 0), "Dataset patient, LCX-only stenosis")
        add("normal", (df.CAD == 0), "Dataset patient, normal coronaries")
        return picks


def _clean(v):
    if v is None or (isinstance(v, float) and math.isnan(v)):
        return None
    return float(v)


def risk_level(p: float) -> str:
    return "low" if p < 0.33 else ("moderate" if p < 0.66 else "high")


def build_row(features: dict):
    """Validate -> DataFrame row. Returns (row, warnings). Unknown keys rejected, missing -> NaN (imputed)."""
    warnings = []
    unknown = [k for k in features if k not in FEATURE_BY_NAME]
    if unknown:
        raise ValueError(f"Unknown feature(s): {unknown}")
    vals = {}
    for f in FEATURES:
        n = f["name"]
        v = features.get(n)
        if v is None or v == "":
            vals[n] = np.nan
            continue
        try:
            v = float(v)
        except (TypeError, ValueError):
            raise ValueError(f"Feature '{n}' must be numeric, got {v!r}")
        if not math.isfinite(v):
            raise ValueError(f"Feature '{n}' must be finite")
        lo, hi = f["lo"], f["hi"]
        if v < lo or v > hi:
            warnings.append(f"{f['label']}: {v:g} outside plausible range [{lo}, {hi}] - clipped")
            v = min(max(v, lo), hi)
        vals[n] = v
    # derive BMI when possible
    if np.isnan(vals["BMI"]) and not np.isnan(vals["Weight"]) and not np.isnan(vals["Length"]):
        vals["BMI"] = vals["Weight"] / (vals["Length"] / 100) ** 2
    return pd.DataFrame([vals])[FEATURE_NAMES], warnings


def predict(state: State, features: dict, explain: bool = True, n_perm: int = 48):
    row, warnings = build_row(features)
    out = dict(source=state.source, disclaimer=DISCLAIMER, warnings=warnings, predictions={}, explanation={})
    x = row.iloc[0]
    for t in ALL_TARGETS:
        model = state.models[t]
        p = float(model.predict_proba(row)[0, 1])
        sel = state.metrics["targets"][t]["selected"]
        out["predictions"][t] = dict(
            label=TARGET_LABELS[t], probability=p, level=risk_level(p),
            positive=bool(p >= state.metrics["threshold"]), model=sel,
            prevalence=state.metrics["prevalence"][t],
            test_auc=state.metrics["targets"][t]["test"]["roc_auc"])
        if not explain:
            continue
        with _lock:
            phi, base, fx = shapley_values(model, x, state.background, n_perm=n_perm)
        contribs = []
        group_tot = {g: 0.0 for g in GROUP_ORDER}
        for f in FEATURES:
            n = f["name"]
            v = x[n]
            st = state.stats[n]
            z = None if np.isnan(v) else (v - st["mean"]) / st["sd"]
            contribs.append(dict(
                name=n, label=f["label"], group=f["group"], unit=f.get("unit", ""),
                value=None if np.isnan(v) else float(v), shap=phi[n],
                z=z, population_median=st["median"],
                atypical=bool(f["kind"] == "num" and not np.isnan(v) and (v < st["p5"] or v > st["p95"]))))
            group_tot[f["group"]] += phi[n]
        contribs.sort(key=lambda c: -abs(c["shap"]))
        out["explanation"][t] = dict(
            base_value=base, prediction=fx, contributions=contribs,
            by_group=[dict(group=g, shap=group_tot[g]) for g in GROUP_ORDER],
            additivity_error=abs(sum(phi.values()) - (fx - base)))
    return out


# ---------------------------------------------------------------------------
class Handler(BaseHTTPRequestHandler):
    state: State = None  # set in main()
    server_version = "CardioVision/1.0"

    def log_message(self, fmt, *args):  # quieter logs
        pass

    def _json(self, obj, status=200):
        body = json.dumps(obj, allow_nan=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = urlparse(self.path).path
        s = self.state
        if path == "/api/health":
            return self._json(dict(status="ok", data_source=s.source, targets=ALL_TARGETS))
        if path == "/api/schema":
            return self._json(dict(features=FEATURES, groups=GROUP_ORDER, stats=s.stats,
                                   targets=[dict(id=t, label=TARGET_LABELS[t]) for t in ALL_TARGETS],
                                   disclaimer=DISCLAIMER, data_source=s.source))
        if path == "/api/metrics":
            return self._json(s.metrics)
        if path == "/api/samples":
            return self._json(s.samples)
        return self._static(path)

    def do_POST(self):
        if urlparse(self.path).path != "/api/predict":
            return self._json(dict(error="not found"), 404)
        try:
            n = int(self.headers.get("Content-Length", "0"))
            if n <= 0 or n > 200_000:
                raise ValueError("Request body missing or too large")
            payload = json.loads(self.rfile.read(n))
            if not isinstance(payload, dict) or not isinstance(payload.get("features"), dict):
                raise ValueError("Body must be {\"features\": {...}}")
            result = predict(self.state, payload["features"], explain=bool(payload.get("explain", True)))
            self._json(result)
        except (ValueError, json.JSONDecodeError) as e:
            self._json(dict(error=str(e)), 400)
        except Exception as e:  # pragma: no cover
            self._json(dict(error=f"internal error: {e}"), 500)

    def _static(self, path):
        rel = "index.html" if path in ("", "/") else path.lstrip("/")
        f = (FRONTEND / rel).resolve()
        if FRONTEND.resolve() not in f.parents and f != FRONTEND.resolve() or not f.is_file():
            self.send_response(404)
            self.end_headers()
            self.wfile.write(b"not found")
            return
        ctype = mimetypes.guess_type(str(f))[0] or "application/octet-stream"
        if f.suffix == ".js":
            ctype = "text/javascript"
        data = f.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", ctype + ("; charset=utf-8" if ctype.startswith("text") else ""))
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        self.wfile.write(data)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--host", default="127.0.0.1")
    ap.add_argument("--port", type=int, default=8000)
    a = ap.parse_args()
    Handler.state = State()
    srv = ThreadingHTTPServer((a.host, a.port), Handler)
    print(f"CardioVision running at http://{a.host}:{a.port}  (data source: {Handler.state.source})")
    srv.serve_forever()


if __name__ == "__main__":
    main()
