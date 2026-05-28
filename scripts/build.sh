#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

MODE="${1:-}"
if [[ "$MODE" != "test" && "$MODE" != "prod" ]]; then
  echo "Usage: $0 test|prod" >&2
  exit 1
fi

if [[ "$MODE" == "prod" ]]; then
  node scripts/sync-sheets.mjs
  node scripts/generate-config.mjs local
else
  node scripts/generate-config.mjs sheet
fi

# リポジトリ直下の config.js を _site に含める
./scripts/assemble-site.sh _site

echo "Build (${MODE}) complete → _site/"
