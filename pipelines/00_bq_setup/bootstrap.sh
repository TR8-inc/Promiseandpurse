#!/usr/bin/env bash
# Idempotent bootstrap: verify gcloud auth, set ADC, ensure datasets exist.
# Safe to re-run.

set -euo pipefail

PROJECT="agency2026ot-tr8-0429"
LOCATION="northamerica-northeast1"   # match source dataset `tr8` region; cross-region BQ queries are blocked
SA_KEY="$(cd "$(dirname "$0")" && pwd)/sa-key.json"

if [[ ! -f "$SA_KEY" ]]; then
  echo "ERROR: service account key not found at $SA_KEY" >&2
  exit 1
fi

export GOOGLE_APPLICATION_CREDENTIALS="$SA_KEY"

echo "==> gcloud project = $(gcloud config get-value project)"
echo "==> gcloud account = $(gcloud config get-value account)"
echo "==> GOOGLE_APPLICATION_CREDENTIALS = $GOOGLE_APPLICATION_CREDENTIALS"

# Datasets (idempotent — bq mk returns non-zero if exists, so guard)
for ds in gc_policy; do
  if bq --project_id="$PROJECT" ls 2>/dev/null | awk 'NR>2 {print $1}' | grep -qx "$ds"; then
    echo "==> dataset $ds exists"
  else
    echo "==> creating dataset $ds in $LOCATION"
    bq --project_id="$PROJECT" --location="$LOCATION" mk --dataset "$ds"
  fi
done

# Probe — confirm we can read source disbursements
n=$(bq --project_id="$PROJECT" query --use_legacy_sql=false --format=csv --quiet \
  'SELECT COUNT(*) FROM `agency2026ot-tr8-0429.tr8.Transport Canada`' \
  | tail -1)
echo "==> tr8.Transport Canada rows = $n"

echo "==> bootstrap OK"
