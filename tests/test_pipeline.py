"""Run:  python -m unittest discover -s tests -v   (after `python -m backend.train`)"""
import json
import unittest

import numpy as np

from backend.config import ALL_TARGETS, FEATURE_NAMES, LEAKAGE_COLUMNS, MODEL_DIR
from backend.data import generate_synthetic, split_xy
from backend.server import State, build_row, predict


class TestLeakage(unittest.TestCase):
    def test_no_leakage_columns_in_features(self):
        self.assertFalse(set(FEATURE_NAMES) & set(LEAKAGE_COLUMNS))

    def test_split_xy_excludes_labels(self):
        df = generate_synthetic()
        for t in ALL_TARGETS:
            X, y = split_xy(df, t)
            self.assertFalse(set(X.columns) & set(LEAKAGE_COLUMNS))
            self.assertEqual(list(X.columns), FEATURE_NAMES)
            self.assertTrue(set(y.unique()) <= {0, 1})

    def test_deployed_models_only_see_feature_columns(self):
        import joblib
        for t in ALL_TARGETS:
            m = joblib.load(MODEL_DIR / f"{t}.joblib")
            names = list(getattr(m, "feature_names_in_", FEATURE_NAMES))
            self.assertFalse(set(names) & set(LEAKAGE_COLUMNS))


class TestApiLogic(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.state = State()

    def test_probabilities_valid_and_additive(self):
        feats = self.state.samples[0]["features"]
        r = predict(self.state, feats, explain=True, n_perm=24)
        for t in ALL_TARGETS:
            p = r["predictions"][t]["probability"]
            self.assertTrue(0.0 <= p <= 1.0)
            ex = r["explanation"][t]
            total = sum(c["shap"] for c in ex["contributions"])
            self.assertAlmostEqual(total, ex["prediction"] - ex["base_value"], places=9)
            self.assertAlmostEqual(ex["prediction"], p, places=9)  # explained value == served prediction
            self.assertAlmostEqual(sum(g["shap"] for g in ex["by_group"]), total, places=9)

    def test_deterministic(self):
        f = self.state.samples[1]["features"]
        a = predict(self.state, f, n_perm=12)["explanation"]["LAD"]["contributions"][0]
        b = predict(self.state, f, n_perm=12)["explanation"]["LAD"]["contributions"][0]
        self.assertEqual(a["name"], b["name"])
        self.assertEqual(a["shap"], b["shap"])

    def test_risk_ordering_is_sensible(self):
        by = {s["id"]: predict(self.state, s["features"], explain=False)["predictions"] for s in self.state.samples}
        self.assertGreater(by["multi"]["CAD"]["probability"], by["normal"]["CAD"]["probability"])

    def test_validation(self):
        with self.assertRaises(ValueError): build_row({"Nope": 1})
        with self.assertRaises(ValueError): build_row({"Age": "x"})
        with self.assertRaises(ValueError): build_row({"Age": float("inf")})
        row, w = build_row({"Age": 500})
        self.assertEqual(row["Age"].iloc[0], 95); self.assertEqual(len(w), 1)

    def test_missing_values_are_imputed(self):
        r = predict(self.state, {}, explain=False)
        self.assertTrue(all(np.isfinite(v["probability"]) for v in r["predictions"].values()))

    def test_bmi_derived(self):
        row, _ = build_row({"Weight": 80, "Length": 180})
        self.assertAlmostEqual(row["BMI"].iloc[0], 80 / 1.8 ** 2, places=6)


class TestMetricsReport(unittest.TestCase):
    def test_report_complete(self):
        m = json.loads((MODEL_DIR / "metrics.json").read_text())
        for t in ALL_TARGETS:
            te = m["targets"][t]["test"]
            for k in ("accuracy", "precision", "recall", "f1", "roc_auc"):
                self.assertTrue(0.0 <= te[k] <= 1.0, (t, k))
            c = m["targets"][t]["confusion"]
            self.assertEqual(c["tn"] + c["fp"] + c["fn"] + c["tp"], m["targets"][t]["n_test"])


if __name__ == "__main__":
    unittest.main()
