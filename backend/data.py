"""Dataset loading and preprocessing.

load_dataset() looks for the real Z-Alizadeh Sani extension file in data/
(any .xlsx/.xls/.csv). If none is found it generates a SYNTHETIC stand-in with
the same schema so the whole system can run. Every consumer is told which one
was used via the returned `source` string ("real" or "synthetic").
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from .config import (ALL_TARGETS, DATA_DIR, FEATURE_BY_NAME, FEATURE_NAMES,
                     FEATURES, LEAKAGE_COLUMNS)

RNG_SEED = 42


# --------------------------------------------------------------------------
# Real dataset
# --------------------------------------------------------------------------
def _norm(s: str) -> str:
    return "".join(ch for ch in str(s).lower() if ch.isalnum())


_ALIASES = {_norm(n): n for n in FEATURE_NAMES + LEAKAGE_COLUMNS}
_ALIASES.update({
    "stelevation": "St Elevation", "stdepression": "St Depression",
    "tinversion": "Tinversion", "efttee": "EF-TTE", "eftte": "EF-TTE",
    "regionrwma": "Region RWMA", "currentsmoker": "Current Smoker",
    "exsmoker": "EX-Smoker", "lowthang": "LowTH Ang", "lowthangina": "LowTH Ang",
    "typicalchestpain": "Typical Chest Pain", "functionclass": "Function Class",
    "weakperipheralpulse": "Weak Peripheral Pulse", "lungrales": "Lung rales",
    "poorrprogression": "Poor R Progression", "exertionalcp": "Exertional CP",
    "airwaydisease": "Airway disease", "thyroiddisease": "Thyroid Disease",
    "systolicmurmur": "Systolic Murmur", "diastolicmurmur": "Diastolic Murmur",
    "qwave": "Q Wave", "height": "Length", "bpsystolic": "BP",
})

_YES = {"y", "yes", "1", "true", "t", "present", "stenotic", "cad", "abnormal", "positive", "male", "m"}
_NO = {"n", "no", "0", "false", "f", "absent", "normal", "negative", "fmale", "female"}


def _to_binary(series: pd.Series, positive_extra=()) -> pd.Series:
    def conv(v):
        if pd.isna(v):
            return np.nan
        if isinstance(v, (int, float, np.integer, np.floating)):
            return 1.0 if float(v) > 0 else 0.0
        t = str(v).strip().lower()
        if t in positive_extra:
            return 1.0
        if t in _YES:
            return 1.0
        if t in _NO:
            return 0.0
        return np.nan
    return series.map(conv)


def _find_real_file():
    if not DATA_DIR.exists():
        return None
    for ext in ("*.xlsx", "*.xls", "*.csv"):
        for p in sorted(DATA_DIR.glob(ext)):
            return p
    return None


def _clean_real(df: pd.DataFrame) -> pd.DataFrame:
    df = df.rename(columns={c: _ALIASES.get(_norm(c), c) for c in df.columns})
    missing_t = [t for t in ["LAD", "LCX", "RCA", "Cath"] if t not in df.columns]
    if missing_t:
        raise ValueError(f"Real dataset is missing label columns: {missing_t}")

    out = pd.DataFrame(index=df.index)
    # Labels
    for t in ("LAD", "LCX", "RCA"):
        out[t] = _to_binary(df[t], positive_extra={"stenotic", "stenosis"})
    out["Cath"] = _to_binary(df["Cath"], positive_extra={"cad"})
    # Overall CAD: dataset 'Cath' column; fall back to any-vessel rule.
    out["CAD"] = out["Cath"]
    anyv = out[["LAD", "LCX", "RCA"]].max(axis=1)
    out["CAD"] = out["CAD"].fillna(anyv)

    # Features
    for f in FEATURES:
        n = f["name"]
        if n == "BMI" and "BMI" not in df.columns and {"Weight", "Length"} <= set(df.columns):
            out[n] = pd.to_numeric(df["Weight"], errors="coerce") / (pd.to_numeric(df["Length"], errors="coerce") / 100) ** 2
            continue
        if n not in df.columns:
            out[n] = np.nan
            continue
        col = df[n]
        if n == "Sex":
            out[n] = _to_binary(col, positive_extra={"male"})
        elif n == "BBB":
            m = {"n": 0, "no": 0, "none": 0, "lbbb": 1, "rbbb": 2, "0": 0, "1": 1, "2": 2}
            out[n] = col.map(lambda v: np.nan if pd.isna(v) else m.get(str(v).strip().lower(), np.nan))
        elif n == "VHD":
            m = {"n": 0, "no": 0, "none": 0, "mild": 1, "moderate": 2, "severe": 3}
            out[n] = col.map(lambda v: np.nan if pd.isna(v) else
                             (float(v) if isinstance(v, (int, float, np.number)) else m.get(str(v).strip().lower(), np.nan)))
        elif f["kind"] == "bin":
            out[n] = _to_binary(col)
        else:
            out[n] = pd.to_numeric(col, errors="coerce")
    out = out.dropna(subset=["CAD", "LAD", "LCX", "RCA"]).reset_index(drop=True)
    return out


# --------------------------------------------------------------------------
# Synthetic stand-in (clearly NOT clinical data)
# --------------------------------------------------------------------------
def _sigmoid(x):
    return 1 / (1 + np.exp(-x))


def generate_synthetic(n: int = 303, seed: int = RNG_SEED) -> pd.DataFrame:
    """Synthetic patients with plausible, clinically-motivated structure.

    Vessel-specific signals (e.g. ST elevation/Q wave -> LAD, T inversion ->
    LCX, inferior-type findings -> RCA) are baked in so that per-vessel models
    have something to learn. Real-data performance WILL differ.
    """
    r = np.random.default_rng(seed)
    g = lambda mu, sd, lo, hi: np.clip(r.normal(mu, sd, n), lo, hi)
    b = lambda p: (r.random(n) < p).astype(float)

    d = {}
    d["Age"] = np.round(g(58, 10, 30, 86))
    d["Sex"] = b(0.46)
    d["Length"] = np.round(np.where(d["Sex"] == 1, g(171, 7, 150, 195), g(158, 6, 140, 180)))
    d["Weight"] = np.round(np.clip(r.normal(0, 1, n) * 12 + (d["Length"] - 100) * 0.95 + 5, 40, 125))
    d["BMI"] = np.round(d["Weight"] / (d["Length"] / 100) ** 2, 1)

    # latent cardiovascular risk driving history items
    z = (d["Age"] - 58) / 10 * 0.6 + d["Sex"] * 0.3 + r.normal(0, 1, n) * 0.8
    d["DM"] = b(_sigmoid(-1.3 + 0.6 * z))
    d["HTN"] = b(_sigmoid(-0.2 + 0.7 * z))
    d["Current Smoker"] = b(_sigmoid(-1.9 + 0.8 * d["Sex"]))
    d["EX-Smoker"] = b(0.04 + 0.05 * d["Sex"])
    d["FH"] = b(0.12)
    d["Obesity"] = (d["BMI"] > 30).astype(float)
    d["CRF"] = b(0.015)
    d["CVA"] = b(0.02 + 0.02 * (z > 1))
    d["Airway disease"] = b(0.06)
    d["Thyroid Disease"] = b(0.03)
    d["CHF"] = b(0.02)
    d["DLP"] = b(_sigmoid(-0.9 + 0.4 * z))

    d["BP"] = np.round(g(130, 17, 90, 190) + 6 * d["HTN"])
    d["PR"] = np.round(g(75, 11, 50, 115))
    d["Edema"] = b(0.03)
    d["Weak Peripheral Pulse"] = b(0.02)
    d["Lung rales"] = b(0.04)
    d["Systolic Murmur"] = b(0.15)
    d["Diastolic Murmur"] = b(0.02)

    # latent per-vessel disease burden (this is the hidden truth)
    base = (-0.9 + 0.045 * (d["Age"] - 58) + 0.55 * d["Sex"] + 0.7 * d["DM"] + 0.45 * d["HTN"]
            + 0.55 * d["Current Smoker"] + 0.45 * d["FH"] + 0.3 * d["DLP"] + r.normal(0, 0.9, n))
    lad = base + 0.25 + r.normal(0, 0.7, n)
    lcx = base - 0.55 + r.normal(0, 0.8, n)
    rca = base - 0.5 + r.normal(0, 0.8, n)
    LAD = (r.random(n) < _sigmoid(lad)).astype(float)
    LCX = (r.random(n) < _sigmoid(lcx)).astype(float)
    RCA = (r.random(n) < _sigmoid(rca)).astype(float)
    any_v = np.maximum.reduce([LAD, LCX, RCA])

    # symptoms
    d["Typical Chest Pain"] = b(0.12 + 0.55 * any_v)
    d["Atypical"] = b(0.10 + 0.05 * (1 - any_v))
    d["Nonanginal"] = b(0.10 * (1 - d["Typical Chest Pain"]) + 0.03)
    d["Exertional CP"] = b(0.02 + 0.08 * any_v)
    d["LowTH Ang"] = b(0.03 + 0.14 * any_v)
    d["Dyspnea"] = b(0.20 + 0.15 * any_v)
    d["Function Class"] = np.clip(np.round(r.normal(0.9 + 0.7 * any_v, 0.9)), 0, 4)

    # ECG (vessel-specific tendencies)
    d["Q Wave"] = b(0.015 + 0.07 * LAD + 0.03 * RCA)
    d["St Elevation"] = b(0.02 + 0.09 * LAD + 0.04 * RCA)
    d["St Depression"] = b(0.05 + 0.20 * any_v + 0.08 * LCX)
    d["Tinversion"] = b(0.07 + 0.22 * LCX + 0.15 * LAD)
    d["LVH"] = b(0.05 + 0.12 * d["HTN"])
    d["Poor R Progression"] = b(0.02 + 0.10 * LAD)
    d["BBB"] = np.where(r.random(n) < 0.06, r.integers(1, 3, n), 0).astype(float)

    # laboratory
    d["FBS"] = np.round(g(98, 22, 70, 300) + 55 * d["DM"] * (r.random(n) < 0.8))
    d["CR"] = np.round(np.clip(g(1.0, 0.18, 0.5, 2.2) + 0.9 * d["CRF"], 0.5, 4.0), 1)
    d["TG"] = np.round(np.clip(r.lognormal(5.0, 0.4, n) + 25 * any_v, 45, 700))
    d["LDL"] = np.round(np.clip(g(100, 28, 45, 240) + 14 * any_v + 8 * d["DLP"], 40, 260))
    d["HDL"] = np.round(np.clip(g(43, 9, 18, 85) - 3.5 * any_v - 3 * d["Sex"], 15, 90))
    d["BUN"] = np.round(g(17, 6, 6, 55) + 12 * d["CRF"])
    d["ESR"] = np.round(np.clip(g(18, 12, 2, 80) + 5 * any_v + 0.15 * (d["Age"] - 58), 1, 85))
    d["HB"] = np.round(g(13.3, 1.6, 8, 17.5) + 1.0 * d["Sex"] - 0.5, 1)
    d["K"] = np.round(g(4.2, 0.4, 3.0, 5.8), 1)
    d["Na"] = np.round(g(141, 3, 130, 148))
    d["WBC"] = np.round(np.clip(r.normal(7400 + 500 * any_v, 1900, n), 3200, 16000), -2)
    d["Lymph"] = np.round(g(32 - 1.5 * any_v, 8, 8, 55))
    d["Neut"] = np.round(np.clip(100 - d["Lymph"] - r.normal(6, 3, n), 35, 88))
    d["PLT"] = np.round(g(235, 55, 100, 450))

    # echo
    ef = np.clip(r.normal(52 - 8 * LAD - 3 * LCX - 3 * RCA, 6, n), 18, 70)
    d["EF-TTE"] = np.round(ef)
    rwma = np.clip(np.round(r.normal(0.1 + 1.0 * LAD + 0.6 * LCX + 0.6 * RCA, 0.6)), 0, 4)
    d["Region RWMA"] = rwma
    d["VHD"] = np.where(r.random(n) < 0.20, r.integers(1, 4, n), 0).astype(float)

    df = pd.DataFrame(d)
    # 5 % missingness on a few labs to exercise the imputer
    for c in ("FBS", "TG", "LDL", "HDL", "ESR"):
        df.loc[r.random(n) < 0.03, c] = np.nan
    df["LAD"], df["LCX"], df["RCA"] = LAD, LCX, RCA
    df["Cath"] = any_v
    df["CAD"] = any_v
    return df[FEATURE_NAMES + LEAKAGE_COLUMNS + ["CAD"]]


# --------------------------------------------------------------------------
def load_dataset():
    """Returns (df, source) where df has FEATURE_NAMES + LEAKAGE + CAD columns."""
    p = _find_real_file()
    if p is not None:
        raw = pd.read_csv(p) if p.suffix == ".csv" else _read_excel_best_sheet(p)
        df = _clean_real(raw)
        return df, "real"
    return generate_synthetic(), "synthetic"


def _read_excel_best_sheet(path):
    sheets = pd.read_excel(path, sheet_name=None)
    best = max(sheets.values(), key=lambda s: s.shape[0] * s.shape[1])
    return best


def split_xy(df: pd.DataFrame, target: str):
    """Features exclude every leakage column by construction."""
    X = df[FEATURE_NAMES].copy()
    assert not set(X.columns) & set(LEAKAGE_COLUMNS)
    y = df[target].astype(int)
    return X, y
