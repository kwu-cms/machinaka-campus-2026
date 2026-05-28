#!/usr/bin/env bash
# 静的サイトを _site/ に組み立てる（GitHub Pages / Heteml 共通）
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

OUT="${1:-_site}"
SITE_ORIGIN="${SITE_ORIGIN:-}"

rm -rf "$OUT"
mkdir -p "$OUT"
cp index.html "$OUT/"
cp -r css js data images "$OUT/"
[[ -f robots.txt ]] && cp robots.txt "$OUT/"
[[ -f sitemap.xml ]] && cp sitemap.xml "$OUT/"

if [[ -n "$SITE_ORIGIN" ]]; then
  if grep -q '__SITE_ORIGIN__' "$OUT/index.html"; then
  sed -i.bak "s|__SITE_ORIGIN__|${SITE_ORIGIN}|g" "$OUT/index.html"
  rm -f "$OUT/index.html.bak"
  fi
  if [[ -f "$OUT/robots.txt" ]] && grep -q '__SITE_ORIGIN__' "$OUT/robots.txt"; then
    sed -i.bak "s|__SITE_ORIGIN__|${SITE_ORIGIN}|g" "$OUT/robots.txt"
    rm -f "$OUT/robots.txt.bak"
  fi
  if [[ -f "$OUT/sitemap.xml" ]] && grep -q '__SITE_ORIGIN__' "$OUT/sitemap.xml"; then
    sed -i.bak "s|__SITE_ORIGIN__|${SITE_ORIGIN}|g" "$OUT/sitemap.xml"
    rm -f "$OUT/sitemap.xml.bak"
  fi
fi

echo "Assembled site → ${OUT}/"
