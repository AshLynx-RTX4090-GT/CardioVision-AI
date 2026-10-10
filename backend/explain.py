"""Model-agnostic Shapley-value explanations (SHAP-style) with no extra deps.

For a patient x and a background sample B, we draw random feature orderings.
Walking an ordering, features are switched one at a time from a background
patient's value to x's value; the change in predicted probability at each step
is that feature's marginal contribution. Averaging over orderings (and using
each ordering reversed too - "antithetic" sampling, which cuts variance)
estimates the Shapley value.

Property that makes the output trustworthy and testable:
    sum(contributions) == P(x) - base_value     (exactly, for every ordering)
so the bars in the dashboard always add up to the predicted risk.

Contributions are in probability points (e.g. +0.12 = raises risk by 12 pts).
"""
from __future__ import annotations

import hashlib

import numpy as np
import pandas as pd


def shapley_values(model, x: pd.Series, background: pd.DataFrame, n_perm: int = 48, seed: int | None = None):
    cols = list(background.columns)
    d = len(cols)
    if seed is None:
        seed = int(hashlib.md5(np.asarray(x.values, dtype=float).tobytes()).hexdigest()[:8], 16)
    rng = np.random.default_rng(seed)
    xv = x[cols].to_numpy(dtype=float)
    bgv = background.to_numpy(dtype=float)

    orders, bgs = [], []
    for _ in range(n_perm):
        o = rng.permutation(d)
        b = bgv[rng.integers(0, len(bgv))]
        orders.extend([o, o[::-1]])
        bgs.extend([b, b])
    n_orders = len(orders)

    # rows[i*(d+1) + k] = background b with the first k features of ordering i taken from x
    rows = np.empty((n_orders * (d + 1), d))
    for i, (o, b) in enumerate(zip(orders, bgs)):
        cur = b.copy()
        base = i * (d + 1)
        rows[base] = cur
        for k, j in enumerate(o):
            cur[j] = xv[j]
            rows[base + k + 1] = cur
    probs = model.predict_proba(pd.DataFrame(rows, columns=cols))[:, 1].reshape(n_orders, d + 1)

    phi = np.zeros(d)
    for i, o in enumerate(orders):
        deltas = np.diff(probs[i])            # contribution of the k-th switched feature
        phi[o] += deltas
    phi /= n_orders
    base_value = float(probs[:, 0].mean())    # E[f(background draw)]
    fx = float(probs[:, -1].mean())           # == f(x) for every ordering
    return dict(zip(cols, phi.tolist())), base_value, fx
