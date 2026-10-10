#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
[ -f models/metrics.json ] || python3 -m backend.train
python3 -m backend.server --port "${PORT:-8000}"
