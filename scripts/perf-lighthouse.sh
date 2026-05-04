#!/usr/bin/env bash
set -euo pipefail

# Lighthouse で Performance カテゴリのみ計測（HTML + JSON を .lighthouse/ に出力）
# 事前に別ターミナルで: cd リポジトリルート && python3 -m http.server 8080
#
# 使い方:
#   ./scripts/perf-lighthouse.sh
#   ./scripts/perf-lighthouse.sh http://127.0.0.1:8080/
#   ./scripts/perf-lighthouse.sh http://127.0.0.1:8080/ mobile   # モバイル相当（preset なし）
#   NO_OPEN=1 ./scripts/perf-lighthouse.sh   # ブラウザを自動で開かない（CI 等）

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT_DIR="$ROOT/.lighthouse"
mkdir -p "$OUT_DIR"

URL="${1:-http://127.0.0.1:8080/}"
MODE="${2:-desktop}"
STAMP="$(date +%Y%m%d-%H%M%S)"
BASE="$OUT_DIR/run-${STAMP}"

LH_VER="11.7.1"

if ! curl -sf -o /dev/null --max-time 3 "$URL"; then
  echo "エラー: ${URL} に接続できません（HTTP が返らないかタイムアウト）。"
  echo "先にローカルサーバーを起動してください。例:"
  echo "  cd \"${ROOT}\" && python3 -m http.server 8080"
  exit 1
fi

DESKTOP_ARGS=()
if [ "$MODE" != "mobile" ]; then
  DESKTOP_ARGS=(--preset=desktop)
fi

echo "Lighthouse ${LH_VER} を実行します (${MODE}): ${URL}"
echo "出力: ${BASE}.report.html / ${BASE}.report.json"

npx --yes "lighthouse@${LH_VER}" "$URL" \
  "${DESKTOP_ARGS[@]}" \
  --only-categories=performance \
  --chrome-flags="--headless=new" \
  --output=html \
  --output=json \
  --output-path="$BASE"

# 直近参照用にシンボリックリンク相当のコピー（環境によっては ln -sf の方がよいが、コピーで確実に）
cp -f "${BASE}.report.html" "$OUT_DIR/last-run.report.html"
cp -f "${BASE}.report.json" "$OUT_DIR/last-run.report.json"

REPORT_HTML="$(cd "$OUT_DIR" && pwd)/last-run.report.html"

open_report_in_browser() {
  local f="$1"
  if [ "${NO_OPEN:-}" = "1" ]; then
    echo "NO_OPEN=1 のためブラウザは開きません: $f"
    return 0
  fi
  if [ ! -f "$f" ]; then
    echo "警告: レポートが見つかりません: $f"
    return 1
  fi
  case "$(uname -s 2>/dev/null)" in
    Darwin)
      open "$f" && echo "ブラウザで開きました: $f" && return 0
      ;;
    Linux)
      if command -v xdg-open >/dev/null 2>&1; then
        xdg-open "$f" >/dev/null 2>&1 && echo "ブラウザで開きました: $f" && return 0
      fi
      ;;
    MINGW* | MSYS* | CYGWIN*)
      cmd.exe /c start "" "$f" >/dev/null 2>&1 && echo "ブラウザで開きました: $f" && return 0
      ;;
  esac
  if command -v python3 >/dev/null 2>&1; then
    if LH_REPORT="$f" python3 -c "import os, webbrowser, pathlib; webbrowser.open(pathlib.Path(os.environ['LH_REPORT']).resolve().as_uri())" 2>/dev/null; then
      echo "ブラウザで開きました (python webbrowser): $f"
      return 0
    fi
  fi
  echo "この環境では自動でブラウザを開けませんでした。次を手動で開いてください:"
  echo "  $f"
  return 1
}

echo "完了。"
open_report_in_browser "$REPORT_HTML" || true
