#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -f "${ROOT}/.env" ]]; then
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line#"${line%%[![:space:]]*}"}"
    [[ -z "$line" || "$line" == \#* ]] && continue
    key="${line%%=*}"
    val="${line#*=}"
    key="${key%"${key##*[![:space:]]}"}"
    val="${val#"${val%%[![:space:]]*}"}"
    val="${val%\"}"; val="${val#\"}"
    val="${val%\'}"; val="${val#\'}"
    val="${val/#\~/$HOME}"
    export "$key=$val"
  done < "${ROOT}/.env"
fi

: "${HETEML_SSH:?Set HETEML_SSH in .env (see .env.example)}"
: "${HETEML_REMOTE_PATH:?Set HETEML_REMOTE_PATH in .env}"

PORT="${HETEML_SSH_PORT:-22}"
RSYNC_SSH="ssh -p ${PORT}"
if [[ -n "${SSH_KEY_PATH:-}" ]]; then
  RSYNC_SSH="ssh -p ${PORT} -i ${SSH_KEY_PATH}"
fi

./scripts/build.sh test

echo "Deploying _site/ → ${HETEML_SSH}:${HETEML_REMOTE_PATH}"
rsync -avz --delete -e "$RSYNC_SSH" _site/ "${HETEML_SSH}:${HETEML_REMOTE_PATH}"
echo "Heteml deploy complete."
