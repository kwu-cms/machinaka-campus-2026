#!/usr/bin/env bash
# 本番: シート同期 → local config → 画像最適化（任意）→ data/images コミット → github main push
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

./scripts/build.sh prod

if [[ "${SKIP_OPTIMIZE_IMAGES:-}" != "1" ]]; then
  echo "Optimizing images from images-src/ …"
  node scripts/optimize-images.mjs
else
  echo "SKIP_OPTIMIZE_IMAGES=1 — skipping npm run optimize:images"
fi

if [[ "${SKIP_GIT_COMMIT:-}" != "1" ]]; then
  # Heteml は作業ツリーそのままを rsync するため、Pages も同等になるよう
  # 配信に使うファイル一式をコミット対象に含める。
  git add index.html
  git add -A css/
  git add -A js/
  git add -A data/
  git add -A images/
  git add -A scripts/
  git add package.json package-lock.json 2>/dev/null || true

  if git diff --staged --quiet; then
    echo "No deployable changes to commit."
  else
    git commit -m "$(cat <<'EOF'
chore: align production deploy bundle with heteml output

Commit all files used to assemble _site so GitHub Pages matches heteml deployment behavior.
EOF
)"
  fi
else
  echo "SKIP_GIT_COMMIT=1 — skipping git commit"
fi

REMOTE="${GIT_REMOTE:-github}"
BRANCH="${GIT_BRANCH:-main}"
echo "Pushing to ${REMOTE} ${BRANCH} …"
git push "${REMOTE}" "${BRANCH}"

echo "Production deploy pushed. GitHub Pages workflow will run on ${REMOTE}/${BRANCH}."
