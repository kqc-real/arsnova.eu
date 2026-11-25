#!/usr/bin/env bash
# 1C-Laborlauf und Kalibrierung, unbeaufsichtigt ausführbar (Runbook Abschnitte 2–6 und 9).
#
#   labor-lauf.sh kalibrierung   eine nicht gewertete Anfrage (Design 10.1 / 14.3), druckt nur Zeiten
#   labor-lauf.sh lauf           vollständiger Lauf L1–L5 mit Speicherprotokoll (Design 14)
#   labor-lauf.sh cacheversuch   Ursachenversuch U1 (Design 15): 10 direkte Anfragen, Speicher nach jeder
#
# Steuerung über Umgebungsvariablen (Standard in Klammern):
#   LABOR_TAG          Kennung im Dateinamen, z. B. "pc"                 (ohne)
#   LABOR_TIMEOUT_MS   QA_SUMMARY_LABOR_TIMEOUT_MS                        (90000, Release)
#   LABOR_OVERRIDE     zusätzliche Compose-Datei                          (labor-produktionslimits.override.yml)
#                      leer setzen ("LABOR_OVERRIDE=") für die Limits des Laborpfads (4 CPUs, 5 GiB)
#   LABOR_CLI          podman oder docker                                 (podman, wenn vorhanden)
#   LABOR_CACHE_ARM    nur cacheversuch: standard oder aus                (Pflicht)
#   LABOR_OUTDIR       Logs und Speicherprotokoll, nie einchecken         (~/labor-1c)
#
# Das Runtime-Token und das DB-Passwort entstehen nur im Speicher dieses Prozesses.
# Energieprofil "performance" wird gehalten und danach zurückgesetzt, Ruhezustand/Idle/Deckel
# gesperrt, sofern powerprofilesctl bzw. systemd-inhibit vorhanden sind.
# Eingecheckt wird nichts; das passiert danach von Hand (Runbook 7).
set -euo pipefail

MODE="${1:-}"
[[ "$MODE" == kalibrierung || "$MODE" == lauf || "$MODE" == cacheversuch ]] || { echo "Aufruf: $0 kalibrierung|lauf|cacheversuch" >&2; exit 2; }
if [[ "$MODE" == cacheversuch ]]; then
  [[ "${LABOR_CACHE_ARM:-}" == standard || "${LABOR_CACHE_ARM:-}" == aus ]] || { echo "cacheversuch braucht LABOR_CACHE_ARM=standard|aus" >&2; exit 2; }
fi

REPO="$(git -C "$(dirname "$(readlink -f "$0")")" rev-parse --show-toplevel)"
SELF="$(readlink -f "$0")"

# --- Hülle: Energieprofil halten, Ruhezustand sperren, Profil danach zurücksetzen ---
if [[ -z "${LABOR_WRAPPED:-}" ]]; then
  export LABOR_WRAPPED=1
  cmd=("$SELF" "$MODE")
  if command -v systemd-inhibit >/dev/null; then
    cmd=(systemd-inhibit --what=sleep:idle:handle-lid-switch --who=1C-Labor --why="1C-$MODE" --mode=block "${cmd[@]}")
  fi
  if command -v powerprofilesctl >/dev/null && prev="$(powerprofilesctl get 2>/dev/null)"; then
    set +e; powerprofilesctl launch -p performance -r "1C-$MODE" -- "${cmd[@]}"; rc=$?; set -e
    powerprofilesctl set "$prev" || true
    echo "Energieprofil zurückgesetzt auf $(powerprofilesctl get)"
  else
    set +e; "${cmd[@]}"; rc=$?; set -e
  fi
  exit "$rc"
fi

CLI="${LABOR_CLI:-$(command -v podman >/dev/null && echo podman || echo docker)}"
OVERRIDE="${LABOR_OVERRIDE-docs/referat-thema-1/evidenz/1C/labor-produktionslimits.override.yml}"
TIMEOUT_MS="${LABOR_TIMEOUT_MS:-90000}"
TAG="${LABOR_TAG:+-$LABOR_TAG}"
OUTDIR="${LABOR_OUTDIR:-$HOME/labor-1c}"
DAY="$(date +%F)"
LOG="$OUTDIR/$MODE$TAG-$DAY.log"
# Gepinnte Node auch für Kindprozesse (npx, Shebangs) vorn in den PATH, sonst greift dort ggf. die System-Node.
NODE_BIN="$(mise where node@24.18.0)/bin"
NODE=(mise exec node@24.18.0 -- env PATH="$NODE_BIN:$PATH")
COMPOSE=("$CLI" compose -f docker-compose.yml)
[[ -n "$OVERRIDE" ]] && COMPOSE+=(-f "$OVERRIDE")
[[ "$MODE" == cacheversuch && "$LABOR_CACHE_ARM" == aus ]] && COMPOSE+=(-f docs/referat-thema-1/evidenz/1C/labor-cache-aus.override.yml)
COMPOSE+=(--profile llm-http)
CONTAINER=arsnova-v3-open-weight-llm-http
URL='http://127.0.0.1:8080'
mkdir -p "$OUTDIR"
exec > >(tee -a "$LOG") 2>&1

step() { echo "[$(date '+%F %T')] $*"; }
notify() { command -v notify-send >/dev/null && notify-send -a 1C-Labor "1C-$MODE" "$1" 2>/dev/null || true; }
fail() { step "ABBRUCH: $*"; notify "Abgebrochen: $*"; exit 1; }

MEM_PID=""
cleanup() {
  local rc=$?
  step "Aufräumen (Exit-Code $rc)"
  [[ -n "$MEM_PID" ]] && kill "$MEM_PID" 2>/dev/null || true
  unset QA_SUMMARY_LABOR_RUNTIME_TOKEN OPEN_WEIGHT_LLM_TOKEN || true
  (cd "$REPO" && "${COMPOSE[@]}" rm --stop --force open-weight-llm-http) || true
  "$CLI" rm -f labor-1c-pg labor-1c-redis >/dev/null 2>&1 || true
  [[ "$MODE" == lauf ]] && command -v systemctl >/dev/null && systemctl --user stop labor-1c-keepawake.service 2>/dev/null || true
  step "Fertig"
}
trap cleanup EXIT

cd "$REPO"
step "Start 1C-$MODE (CLI $CLI, Override ${OVERRIDE:-keins}, Timeout $TIMEOUT_MS ms)"

# --- Rahmenbedingungen ---
ac="$(cat /sys/class/power_supply/A{C,DP}*/online 2>/dev/null | head -1 || true)"
step "Netzteil: ${ac:-kein Akku-System (Desktop)}"
[[ -z "$ac" || "$ac" == 1 ]] || fail "kein Netzteil angeschlossen"
if command -v powerprofilesctl >/dev/null; then
  profile="$(powerprofilesctl get)"; step "Energieprofil: $profile"
  [[ "$profile" == performance ]] || fail "Energieprofil ist $profile, nicht performance"
fi
step "Governor: $(cat /sys/devices/system/cpu/cpu0/cpufreq/scaling_governor 2>/dev/null || echo ?), EPP: $(cat /sys/devices/system/cpu/cpu0/cpufreq/energy_performance_preference 2>/dev/null || echo ?)"
pkill -f '[o]rg.omarchy.screensaver' && step "Screensaver beendet" || true
step "Last vor dem Start: $(cat /proc/loadavg)"
lscpu | grep -E 'Model name|^CPU\(s\)|Thread|Core\(s\)|max MHz'
free -b | sed -n 2p

# --- Referenzstand ---
[[ -z "$(git status --porcelain)" ]] || fail "Arbeitsbaum nicht sauber"
git fetch --all --prune --quiet || step "WARNUNG: git fetch fehlgeschlagen"
step "HEAD $(git rev-parse HEAD) auf $(git branch --show-current), upstream/main $(git rev-parse --short upstream/main)"
step "Commits upstream/main, die HEAD fehlen: $(git rev-list --count HEAD..upstream/main)"
step "Baseline (letzter eingemergter upstream-Stand): main@$(git rev-parse --short "$(git merge-base HEAD upstream/main)")"

# --- Runtime (Runbook 2) ---
QA_SUMMARY_LABOR_RUNTIME_TOKEN="$(openssl rand -hex 32)"
export QA_SUMMARY_LABOR_RUNTIME_TOKEN
export OPEN_WEIGHT_LLM_TOKEN="$QA_SUMMARY_LABOR_RUNTIME_TOKEN"
export OPEN_WEIGHT_LLM_MODEL_DIR="$REPO/models/open-weight-llm"
"${NODE[@]}" node scripts/open-weight-llm/verify-model.mjs
# podman compose mit docker-compose als Provider braucht den Podman-API-Socket.
if [[ "$CLI" == podman ]] && command -v systemctl >/dev/null && ! systemctl --user is-active --quiet podman.socket; then
  step "podman.socket inaktiv, starte ihn (nur für diese Sitzung)"
  systemctl --user start podman.socket || fail "podman.socket lässt sich nicht starten"
fi
"${COMPOSE[@]}" up -d --build open-weight-llm-http
h=none
for _ in $(seq 1 60); do
  h="$("$CLI" inspect --format '{{.State.Health.Status}}' "$CONTAINER" 2>/dev/null || echo none)"
  [[ "$h" == healthy ]] && break
  sleep 5
done
[[ "$h" == healthy ]] || fail "Runtime nicht healthy nach 300 s ($h)"
"$CLI" inspect --format 'Status={{.State.Status}} Neustarts={{.RestartCount}} CPUs={{.HostConfig.NanoCpus}} Speicher={{.HostConfig.Memory}} Speicher+Swap={{.HostConfig.MemorySwap}}' "$CONTAINER"
"$CLI" exec "$CONTAINER" printenv OPEN_WEIGHT_LLM_THREADS | sed 's/^/Threads=/'
RUNTIME_IMAGE_ID="$("$CLI" image inspect --format '{{.Id}}' arsnova-open-weight-llm:llama-b10524)"
RUNTIME_IMAGE="arsnova-open-weight-llm:llama-b10524@sha256:${RUNTIME_IMAGE_ID#sha256:}"
MODEL_SHA256="$(sha256sum models/open-weight-llm/Qwen3-4B-Instruct-2507-Q4_K_M.gguf | cut -d' ' -f1)"
step "RUNTIME_IMAGE (lokale Image-ID) $RUNTIME_IMAGE"
AUTH=(--header "Authorization: Bearer $QA_SUMMARY_LABOR_RUNTIME_TOKEN")
curl --fail --silent --max-time 5 "${AUTH[@]}" "$URL/props" | jq -c '{build_info, total_slots, n_ctx: .default_generation_settings.n_ctx}'

# --- Kalibrierung: eine Anfrage mit dem Body aus dem Laptop-Lauf, Antworttext wird verworfen ---
if [[ "$MODE" == kalibrierung ]]; then
  BODY="$OUTDIR/kalibrierung-body.json"
  zcat docs/referat-thema-1/evidenz/1C/messung/2026-11-05-labor.json.gz \
    | jq -r '[.labor.quiet.runs[] | select(.warmup | not)][0].exchanges[] | select(.path == "/v1/chat/completions") | .rawRequestBody' > "$BODY"
  step "Body: $(wc -c < "$BODY") Byte, max_tokens $(jq '.max_tokens' "$BODY")"
  start=$(date +%s.%N)
  curl --fail --silent --show-error --max-time 600 "${AUTH[@]}" --header 'Content-Type: application/json' \
    --data-binary @"$BODY" "$URL/v1/chat/completions" \
    | jq -c '{finish: .choices[0].finish_reason, usage, prompt_n: .timings.prompt_n, prompt_ms: .timings.prompt_ms, predicted_n: .timings.predicted_n, predicted_ms: .timings.predicted_ms, prompt_per_s: .timings.prompt_per_second, predicted_per_s: .timings.predicted_per_second}' \
    | tee "$OUTDIR/kalibrierung$TAG-$DAY.json"
  end=$(date +%s.%N)
  rm -f "$BODY"
  step "Wandzeit $(awk -v a="$start" -v b="$end" 'BEGIN { printf "%.1f", b - a }') s"
  jq -r '"Inferenz (prompt_ms + predicted_ms): \(((.prompt_ms + .predicted_ms) / 1000) | floor) s; ungünstigster Fall bei 640 Ausgabe-Tokens: \(((.prompt_ms + 640 / .predicted_per_s * 1000) / 1000) | floor) s"' "$OUTDIR/kalibrierung$TAG-$DAY.json"
  notify "Kalibrierung fertig, siehe $LOG"
  exit 0
fi

# --- Ursachenversuch U1 (Design 15): 10 verschiedene Bodies aus dem Laptop-Lauf, Speicher nach jeder Anfrage ---
if [[ "$MODE" == cacheversuch ]]; then
  ARM="$LABOR_CACHE_ARM"
  step "Arm $ARM, LLAMA_ARG_CACHE_RAM im Container: $("$CLI" exec "$CONTAINER" printenv LLAMA_ARG_CACHE_RAM 2>/dev/null || echo 'nicht gesetzt (Standard 8192 MiB)')"
  CSV="$OUTDIR/cacheversuch-$ARM$TAG-$DAY.csv"
  mem() { "$CLI" stats --no-stream --format '{{.MemUsage}}' "$CONTAINER" 2>/dev/null | cut -d/ -f1 | tr -d ' ' || echo ?; }
  sleep 5
  echo "nr,zeit,prompt_n,cache_n,predicted_n,prompt_ms,predicted_ms,speicher,neustarts" > "$CSV"
  echo "0,$(date '+%F %T'),,,,,,$(mem),$("$CLI" inspect --format '{{.RestartCount}}' "$CONTAINER")" >> "$CSV"
  BODY="$OUTDIR/cacheversuch-body.json"
  for i in $(seq 0 9); do
    zcat docs/referat-thema-1/evidenz/1C/messung/2026-11-05-labor.json.gz \
      | jq -r --argjson i "$i" '[.labor.quiet.runs[] | select(.warmup | not)][$i] | [.exchanges[] | select(.path == "/v1/chat/completions")][0].rawRequestBody' > "$BODY"
    t="$(curl --fail --silent --show-error --max-time 600 "${AUTH[@]}" --header 'Content-Type: application/json' \
      --data-binary @"$BODY" "$URL/v1/chat/completions" \
      | jq -r '[.timings.prompt_n, .timings.cache_n, .timings.predicted_n, .timings.prompt_ms, .timings.predicted_ms] | map(tostring) | join(",")' || echo ',,,,')"
    sleep 3
    line="$((i + 1)),$(date '+%F %T'),$t,$(mem),$("$CLI" inspect --format '{{.RestartCount}}' "$CONTAINER")"
    echo "$line" >> "$CSV"
    step "Anfrage $((i + 1))/10: $line"
  done
  rm -f "$BODY"
  "$CLI" inspect --format 'Nach dem Versuch: Status={{.State.Status}} Neustarts={{.RestartCount}} OOMKilled={{.State.OOMKilled}}' "$CONTAINER"
  step "Ergebnis in $CSV"
  notify "Cacheversuch Arm $ARM fertig"
  exit 0
fi

# --- Speicherprotokoll der Runtime alle 15 s (Design 14, L6) ---
(
  echo "zeit,speicher,neustarts"
  while sleep 15; do
    mem="$("$CLI" stats --no-stream --format '{{.MemUsage}}' "$CONTAINER" 2>/dev/null | cut -d/ -f1 | tr -d ' ' || echo ?)"
    rc="$("$CLI" inspect --format '{{.RestartCount}}' "$CONTAINER" 2>/dev/null || echo ?)"
    echo "$(date '+%F %T'),$mem,$rc"
  done
) > "$OUTDIR/speicher$TAG-$DAY.csv" &
MEM_PID=$!

# --- Lauf-Datenbank (Runbook 3) ---
"$CLI" rm -f labor-1c-pg labor-1c-redis >/dev/null 2>&1 || true
LABOR_PG_PASSWORD="$(openssl rand -hex 16)"
"$CLI" run -d --name labor-1c-pg -p 127.0.0.1:55432:5432 \
  -e POSTGRES_USER=labor -e POSTGRES_PASSWORD="$LABOR_PG_PASSWORD" -e POSTGRES_DB=labor_1c docker.io/library/postgres:16-alpine >/dev/null
"$CLI" run -d --name labor-1c-redis -p 127.0.0.1:56379:6379 docker.io/library/redis:7.4-alpine >/dev/null
for _ in $(seq 1 30); do "$CLI" exec labor-1c-pg pg_isready -U labor -d labor_1c >/dev/null 2>&1 && break; sleep 2; done
export DATABASE_URL="postgresql://labor:${LABOR_PG_PASSWORD}@127.0.0.1:55432/labor_1c?schema=public"
export REDIS_URL=redis://127.0.0.1:56379
"${NODE[@]}" npm run prisma:migrate

# --- Prüfungen vor dem Lauf (Runbook 4) ---
export QA_SUMMARY_LABOR_RUNTIME_URL="$URL"
code="$(curl --silent --output /dev/null --write-out '%{http_code}' --max-time 5 "$URL/slots?fail_on_no_slot=1")"
[[ "$code" == 401 ]] || fail "Slots ohne Token liefert $code statt 401"
slots="$(curl --fail --silent --max-time 5 "${AUTH[@]}" "$URL/slots" | jq -c '[.[] | {id, is_processing}]')"
step "Slots: $slots"
[[ "$(jq 'length' <<<"$slots")" == 1 && "$(jq '.[0].is_processing' <<<"$slots")" == false ]] || fail "Slot-Zustand unerwartet"

# --- Lauf (Runbook 5) ---
npx_node="$("${NODE[@]}" npx --no-install node -v)"
step "Node für vitest (über npx): $npx_node"
[[ "$npx_node" == v24.18.0 ]] || fail "npx findet Node $npx_node statt v24.18.0"
cd "$REPO/apps/backend"
LABOR_OUT="$REPO/docs/referat-thema-1/evidenz/1C/messung/$DAY-labor$TAG.json"
VITEST_LOG="$OUTDIR/vitest$TAG-$DAY.log"
step "Lauf startet, Ausgabe $LABOR_OUT"
notify "Lauf gestartet"
set +e
RUN_QA_SUMMARY_LABOR=1 \
QA_SUMMARY_LABOR_BASELINE="main@$(git rev-parse --short "$(git merge-base HEAD upstream/main)")" \
QA_SUMMARY_LABOR_GIT_SHA="$(git rev-parse HEAD)" \
QA_SUMMARY_LABOR_GIT_DIRTY=false \
QA_SUMMARY_LABOR_RUNTIME_IMAGE="$RUNTIME_IMAGE" \
QA_SUMMARY_LABOR_MODEL_SHA256="$MODEL_SHA256" \
QA_SUMMARY_LABOR_L5_RUNS=5 \
QA_SUMMARY_LABOR_TIMEOUT_MS="$TIMEOUT_MS" \
QA_SUMMARY_LABOR_OUT="$LABOR_OUT" \
  "${NODE[@]}" npx vitest run src/__tests__/qa.summary-labor.pg.test.ts --reporter=verbose > "$VITEST_LOG" 2>&1
vitest_rc=$?
set -e
cd "$REPO"
step "vitest Exit-Code $vitest_rc"
tail -30 "$VITEST_LOG"

# --- Prüfungen nach dem Lauf (Runbook 6) ---
"$CLI" inspect --format 'Nach dem Lauf: Status={{.State.Status}} Neustarts={{.RestartCount}} OOMKilled={{.State.OOMKilled}}' "$CONTAINER" || true
if [[ -f "$LABOR_OUT" ]]; then
  jq '{completed, testsCompleted, dryRun: .labor.dryRun, kind: .labor.runtimeKind}' "$LABOR_OUT" || true
  "${NODE[@]}" node docs/referat-thema-1/evidenz/1C/messung/auswertung.mjs "$LABOR_OUT" > "$OUTDIR/auswertung$TAG-$DAY.txt" 2>&1 || step "WARNUNG: Auswertung mit Fehler"
  step "Token-Treffer JSON/Log: $(grep -c -F "$QA_SUMMARY_LABOR_RUNTIME_TOKEN" "$LABOR_OUT" "$VITEST_LOG" | tr '\n' ' ')"
  step "Bearer-Treffer JSON: $(grep -c -i bearer "$LABOR_OUT" || true)"
fi
notify "Lauf beendet (vitest $vitest_rc), Ergebnisse in $OUTDIR"
exit "$vitest_rc"
