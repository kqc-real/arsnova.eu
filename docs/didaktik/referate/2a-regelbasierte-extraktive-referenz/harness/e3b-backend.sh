#!/usr/bin/env bash
# E3b: startet das arsnova-Backend (Repo unverändert, keine .env) mit Bedingungs-Env.
# Usage: e3b-backend.sh <C1|C2|C3> ; schreibt PID nach evidence/E3/e3b-backend-<C>.pid
set -euo pipefail
COND="${1:?C1|C2|C3}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/../../../../.." && pwd)"
OUT="$HERE/../evidence/E3"
mkdir -p "$OUT"
# Nur für die lokale Laborinstanz: Werte werden je Lauf zufällig erzeugt und
# in der Evidenz geschwärzt.
rand() { openssl rand -hex 24; }
LOG="$OUT/e3b-backend-$COND.log"

BASE_ENV=(
  NODE_ENV=development
  DATABASE_URL="postgresql://arsnova_user:secretpassword@localhost:5432/arsnova_v3_dev?schema=public"
  REDIS_URL="redis://localhost:6379"
  JWT_SECRET="$(rand)"
  CAPABILITY_ENVELOPE_KEY_BASE64="$(openssl rand -base64 32)"
  ADMIN_SECRET="$(rand)"
  ADMIN_DIAGNOSTIC_SECRET="$(rand)"
  CSP_REPORT_HASH_SECRET="$(rand)"
  PORT=3000 HOST=127.0.0.1 WS_PORT=3001 WS_HOST=127.0.0.1 YJS_WS_PORT=3002
  MAX_SESSION_DURATION=P180D
  NLP_ENABLED=false QA_NLP_ENABLED=false WORD_CLOUD_SEMANTIC_ENABLED=false
  QA_SUMMARY_ENABLED=true
)
TOKEN="$(rand)"
case "$COND" in
  C1) COND_ENV=(OPEN_WEIGHT_LLM_ENABLED=false QA_SUMMARY_INFERENCE_URL= ) ;;
  C2) COND_ENV=(OPEN_WEIGHT_LLM_ENABLED=true OPEN_WEIGHT_LLM_URL=http://[::1]:59999 OPEN_WEIGHT_LLM_TOKEN=$TOKEN QA_SUMMARY_INFERENCE_URL= ) ;;
  C3) COND_ENV=(OPEN_WEIGHT_LLM_ENABLED=true OPEN_WEIGHT_LLM_URL=http://127.0.0.1:59998 OPEN_WEIGHT_LLM_TOKEN=$TOKEN QA_SUMMARY_INFERENCE_URL= QA_SUMMARY_TIMEOUT_MS=500 OPEN_WEIGHT_LLM_SUMMARY_TIMEOUT_MS=1000 ) ;;
  C3b) COND_ENV=(OPEN_WEIGHT_LLM_ENABLED=true OPEN_WEIGHT_LLM_URL=http://127.0.0.1:59998 OPEN_WEIGHT_LLM_TOKEN=$TOKEN QA_SUMMARY_INFERENCE_URL= QA_SUMMARY_TIMEOUT_MS=3000 OPEN_WEIGHT_LLM_SUMMARY_TIMEOUT_MS=1000 ) ;;
  *) echo "unknown condition" >&2; exit 2 ;;
esac
printf '%s\n' "${BASE_ENV[@]}" "${COND_ENV[@]}" \
  | sed -E 's/^(JWT_SECRET|CAPABILITY_ENVELOPE_KEY_BASE64|ADMIN_SECRET|ADMIN_DIAGNOSTIC_SECRET|CSP_REPORT_HASH_SECRET|OPEN_WEIGHT_LLM_TOKEN)=.*/\1=<redacted-local-lab-value>/' \
  > "$OUT/e3b-env-$COND.txt"
cd "$REPO"
nohup env -i PATH="$PATH" HOME="$HOME" "${BASE_ENV[@]}" "${COND_ENV[@]}" \
  node --import tsx apps/backend/src/index.ts > "$LOG" 2>&1 &
echo $! > "$OUT/e3b-backend-$COND.pid"
echo "started $COND pid $(cat "$OUT/e3b-backend-$COND.pid") log $LOG"
