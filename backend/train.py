"""Training pipeline: overall CAD + LAD / LCX / RCA stenosis classifiers.

Run:  python -m backend.train

Protocol (kept honest for a 303-row dataset):
  1. Leakage columns (LAD, LCX, RCA, Cath) are never inputs (see data.split_xy).
  2. Stratified 80/20 split -> the 20 % test set is touched ONCE, for the
     selected model only.
  3. On the 80 % train part: repeated stratified 5-fold CV (3 repeats) compares
     three candidates (logistic regression, random forest, gradient boosting);
     the winner is chosen by mean CV ROC-AUC.
  4. Reported metrics: CV mean±sd for every candidate + held-out test metrics
     (accuracy, precision, recall, F1, ROC-AUC, Brier) + ROC curve, confusion
     matrix, calibration bins.
  5. The deployed model is refit on ALL rows (more data = better estimates for
     the UI); the held-out numbers remain the honest performance estimate.
"""
from __future__ import annotations

import json
import time
import warnings

import joblib
import numpy as np
from sklearn.calibration import CalibratedClassifierCV
from sklearn.ensemble import HistGradientBoostingClassifier, RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (accuracy_score, brier_score_loss, confusion_matrix, f1_score,
                             precision_score, recall_score, roc_auc_score, roc_curve)
from sklearn.model_selection import RepeatedStratifiedKFold, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from .config import ALL_TARGETS, FEATURE_NAMES, MODEL_DIR
from .data import RNG_SEED, load_dataset, split_xy

warnings.filterwarnings("ignore")
THRESHOLD = 0.5


def make_candidates():
    lr = Pipeline([
        ("imp", SimpleImputer(strategy="median")),
        ("sc", StandardScaler()),
        ("clf", LogisticRegression(C=0.15, penalty="l2", max_iter=2000, class_weight="balanced")),
    ])
    rf = Pipeline([
        ("imp", SimpleImputer(strategy="median")),
        ("clf", CalibratedClassifierCV(
            RandomForestClassifier(n_estimators=250, min_samples_leaf=3, max_features="sqrt",
                                   class_weight="balanced_subsample", random_state=RNG_SEED, n_jobs=2),
            method="sigmoid", cv=3)),
    ])
    gb = Pipeline([
        ("imp", SimpleImputer(strategy="median")),
        ("clf", CalibratedClassifierCV(
            HistGradientBoostingClassifier(max_depth=3, learning_rate=0.05, max_iter=120,
                                           l2_regularization=1.0, random_state=RNG_SEED),
            method="sigmoid", cv=3)),
    ])
    return {"Logistic Regression": lr, "Random Forest": rf, "Gradient Boosting": gb}


def metric_dict(y, p, thr=THRESHOLD):
    pred = (p >= thr).astype(int)
    return dict(
        accuracy=accuracy_score(y, pred),
        precision=precision_score(y, pred, zero_division=0),
        recall=recall_score(y, pred, zero_division=0),
        f1=f1_score(y, pred, zero_division=0),
        roc_auc=roc_auc_score(y, p) if len(np.unique(y)) > 1 else float("nan"),
        brier=brier_score_loss(y, p),
    )


def cv_evaluate(model, X, y):
    rskf = RepeatedStratifiedKFold(n_splits=5, n_repeats=3, random_state=RNG_SEED)
    rows = []
    for tr, va in rskf.split(X, y):
        from sklearn.base import clone
        m = clone(model).fit(X.iloc[tr], y.iloc[tr])
        rows.append(metric_dict(y.iloc[va], m.predict_proba(X.iloc[va])[:, 1]))
    out = {}
    for k in rows[0]:
        v = np.array([r[k] for r in rows])
        out[k] = dict(mean=float(np.nanmean(v)), sd=float(np.nanstd(v)))
    return out


def calibration_bins(y, p, n_bins=5):
    edges = np.quantile(p, np.linspace(0, 1, n_bins + 1))
    edges[0], edges[-1] = 0.0, 1.0 + 1e-9
    bins = []
    for i in range(n_bins):
        m = (p >= edges[i]) & (p < edges[i + 1])
        if m.sum() >= 3:
            bins.append(dict(pred=float(p[m].mean()), obs=float(y[m].mean()), n=int(m.sum())))
    return bins


def main():
    t0 = time.time()
    MODEL_DIR.mkdir(exist_ok=True, parents=True)
    df, source = load_dataset()
    print(f"[data] source={source}  rows={len(df)}  features={len(FEATURE_NAMES)}")

    report = dict(
        data_source=source, n_rows=int(len(df)), n_features=len(FEATURE_NAMES),
        threshold=THRESHOLD, targets={},
        prevalence={t: float(df[t].mean()) for t in ALL_TARGETS},
    )

    # population statistics for the dashboard (percentile / z context)
    X_all = df[FEATURE_NAMES]
    stats = {}
    for c in FEATURE_NAMES:
        s = X_all[c].dropna()
        stats[c] = dict(mean=float(s.mean()), sd=float(s.std() or 1.0), median=float(s.median()),
                        p5=float(s.quantile(.05)), p95=float(s.quantile(.95)),
                        min=float(s.min()), max=float(s.max()))
    # background sample for Shapley estimation
    bg = X_all.sample(n=min(60, len(X_all)), random_state=RNG_SEED)
    bg = bg.fillna(X_all.median())

    for target in ALL_TARGETS:
        X, y = split_xy(df, target)
        Xtr, Xte, ytr, yte = train_test_split(X, y, test_size=0.2, stratify=y, random_state=RNG_SEED)
        cands = make_candidates()

        cv = {name: cv_evaluate(m, Xtr, ytr) for name, m in cands.items()}
        best = max(cv, key=lambda n: cv[n]["roc_auc"]["mean"])

        from sklearn.base import clone
        sel = clone(cands[best]).fit(Xtr, ytr)
        p_te = sel.predict_proba(Xte)[:, 1]
        test = metric_dict(yte, p_te)
        fpr, tpr, _ = roc_curve(yte, p_te)
        cm = confusion_matrix(yte, (p_te >= THRESHOLD).astype(int), labels=[0, 1])

        # bootstrap CI for test AUC
        rng = np.random.default_rng(RNG_SEED)
        aucs = []
        yt, pt = yte.values, p_te
        for _ in range(500):
            idx = rng.integers(0, len(yt), len(yt))
            if len(np.unique(yt[idx])) > 1:
                aucs.append(roc_auc_score(yt[idx], pt[idx]))
        auc_ci = [float(np.percentile(aucs, 2.5)), float(np.percentile(aucs, 97.5))]

        # deployed model: refit on all data
        final = clone(cands[best]).fit(X, y)
        joblib.dump(final, MODEL_DIR / f"{target}.joblib")

        report["targets"][target] = dict(
            selected=best, cv=cv, test=test, test_auc_ci95=auc_ci,
            n_train=int(len(Xtr)), n_test=int(len(Xte)),
            roc=dict(fpr=[round(float(v), 4) for v in fpr], tpr=[round(float(v), 4) for v in tpr]),
            confusion=dict(tn=int(cm[0, 0]), fp=int(cm[0, 1]), fn=int(cm[1, 0]), tp=int(cm[1, 1])),
            calibration=calibration_bins(yte.values, p_te),
        )
        print(f"[{target}] best={best:<20s} CV-AUC={cv[best]['roc_auc']['mean']:.3f}  "
              f"test: acc={test['accuracy']:.3f} prec={test['precision']:.3f} "
              f"rec={test['recall']:.3f} f1={test['f1']:.3f} auc={test['roc_auc']:.3f}")

    joblib.dump(dict(stats=stats, background=bg, feature_names=FEATURE_NAMES), MODEL_DIR / "meta.joblib")
    with open(MODEL_DIR / "metrics.json", "w") as f:
        json.dump(report, f, indent=2)
    print(f"[done] {time.time() - t0:.1f}s -> {MODEL_DIR}")


if __name__ == "__main__":
    main()
