# Dataset

Place the real **Extension of Z-Alizadeh Sani Dataset** (UCI / Kaggle) here as `.xlsx` or `.csv`
(any filename). The loader picks the first file it finds, matches column names loosely, and converts
the text codes (Y/N, Male/Fmale, LBBB/RBBB, mild/moderate/severe, Normal/Stenotic/Cad).

Then retrain:  `python -m backend.train && python -m backend.server`

With no file present the project falls back to a synthetic stand-in (UI shows a SYNTHETIC badge).
