#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <gitea-clone-url>" >&2
  echo "  Example: $0 https://gitea.example.org/org/repo.git" >&2
  exit 1
fi

URL="$1"
if git remote get-url origin >/dev/null 2>&1; then
  git remote set-url origin "$URL"
else
  git remote add origin "$URL"
fi

git push -u origin main
