#!/usr/bin/env bash
# Unified deploy entrypoint
# - full: heteml -> prod
# - heteml: only heteml
# - prod: only production (GitHub Pages)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

MODE="${1:-full}"

case "$MODE" in
  full)
    echo "[deploy] heteml -> prod"
    bash scripts/deploy-heteml.sh
    bash scripts/deploy-prod.sh
    ;;
  heteml)
    echo "[deploy] heteml"
    bash scripts/deploy-heteml.sh
    ;;
  prod)
    echo "[deploy] prod"
    bash scripts/deploy-prod.sh
    ;;
  *)
    echo "Usage: npm run deploy -- [full|heteml|prod]" >&2
    exit 1
    ;;
esac

