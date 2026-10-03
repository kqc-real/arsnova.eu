#!/usr/bin/env bash
# =============================================================================
# arsnova.eu – Digest-basiertes Deploy-Skript (Server oder CI per SSH)
#
# Normal:  DEPLOY_IMAGE + DEPLOY_SHA setzen, zuerst
#          ./scripts/deploy/checkout-deploy-sha.sh, dann ./scripts/deploy.sh
# Rollback: ./scripts/deploy.sh --rollback
#   lädt previous.state (gemeinsamer Image+SHA-Snapshot) nach erfolgreichem Deploy.
# Recover:  ./scripts/deploy.sh --recover
#   lädt current.state — für unvollständige Deploys vor State-Rotation.
#
# CI und manuelle Normal-Deploys bootstrappen DEPLOY_SHA vor dem Aufruf (siehe
# ci.yml und Usage), damit der erste Post-Merge-Lauf nicht mehr eine veraltete
# Deploy-Reihenfolge aus dem vorherigen Working Tree ausführt.
# Rollback/Recover starten das aktuell installierte Skript ohne vorherigen
# Checkout, damit der State zuerst gelesen werden kann.
#
# Kanonische Image-Wahrheit: ghcr.io/kqc-real/arsnova.eu@sha256:<64-hex>
# DEPLOY_SHA ist nur für Git-Checkout von Compose/Migrationen/Skripten.
# Auf dem Server ist nur Image-Pull erlaubt (kein lokaler Image-Build).
#
# Wichtig: Image-Rollback setzt keine Datenbankmigrationen zurück.
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

# shellcheck disable=SC1091
source "${SCRIPT_DIR}/deploy/lib-image-ref.sh"
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/deploy/lib-deploy-state.sh"
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/deploy/lib-arch.sh"

COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE=".env.production"
IMAGE_ENV_FILE=".env.arsnova-image"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-main}"
DEPLOY_SHA="${DEPLOY_SHA:-}"
DEPLOY_IMAGE="${DEPLOY_IMAGE:-}"
DEPLOY_DIR="${DEPLOY_DIR:-}"
HEALTH_MAX_WAIT_SECONDS="${HEALTH_MAX_WAIT_SECONDS:-180}"
REDIS_AOF_MIGRATION_TIMEOUT_SECONDS="${REDIS_AOF_MIGRATION_TIMEOUT_SECONDS:-300}"
REDIS_CONTAINER_NAME="arsnova-v3-redis"
DEPLOY_MODE="normal" # normal | rollback | recover

if [[ ! "$REDIS_AOF_MIGRATION_TIMEOUT_SECONDS" =~ ^[1-9][0-9]*$ ]]; then
  echo "Fehler: REDIS_AOF_MIGRATION_TIMEOUT_SECONDS muss eine positive Ganzzahl sein." >&2
  exit 1
fi

usage() {
  cat <<'EOF'
Usage:
  DEPLOY_DIR='/home/deploy/arsnova.eu' \
  DEPLOY_SHA='<40-hex>' \
  ./scripts/deploy/checkout-deploy-sha.sh

  DEPLOY_IMAGE='ghcr.io/kqc-real/arsnova.eu@sha256:<64-hex>' \
  DEPLOY_SHA='<40-hex>' \
  ./scripts/deploy.sh

  ./scripts/deploy.sh --rollback   # nach erfolgreichem Deploy: previous.state
  ./scripts/deploy.sh --recover    # bei unvollständigem Deploy: current.state

Hinweis: Image-Rollback/Recover setzt keine DB-Migrationen zurück.
EOF
}

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  usage
  exit 0
fi

if [[ "${1:-}" == "--rollback" ]]; then
  DEPLOY_MODE="rollback"
  shift
elif [[ "${1:-}" == "--recover" ]]; then
  DEPLOY_MODE="recover"
  shift
fi

if [[ $# -gt 0 ]]; then
  echo "Fehler: unbekannte Argumente: $*" >&2
  usage >&2
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Fehler: $ENV_FILE nicht gefunden. Bitte anlegen (siehe .env.production.example)."
  exit 1
fi

for cmd in git docker curl; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Fehler: benötigtes Kommando '$cmd' fehlt auf dem Server."
    exit 1
  fi
done

STATE_DIR="$(deploy_state_dir "$REPO_ROOT" "$DEPLOY_DIR")"
PURGE_RUNNER_STATE_FILE="${STATE_DIR}/wordcloud-purge-runner.state"
PURGE_RUNNER_CANDIDATE_STATE_FILE="${STATE_DIR}/wordcloud-purge-runner-candidate.state"
SAVED_PURGE_RUNNER_IMAGE=''
SAVED_PURGE_RUNNER_SHA=''
CANDIDATE_PURGE_RUNNER_IMAGE=''
CANDIDATE_PURGE_RUNNER_SHA=''
CURRENT_DEPLOY_IMAGE=''
CURRENT_DEPLOY_SHA=''
REDIS_AOF_RESTART_PROBE_KEY=''
REDIS_KEY_COUNT_BEFORE_RECREATE=''

if [[ -e "${STATE_DIR}/current.state" ]]; then
  if ! read_snapshot "${STATE_DIR}/current.state" CURRENT_DEPLOY_IMAGE CURRENT_DEPLOY_SHA; then
    echo "Fehler: Ungültiger Current-Deploy-State unter ${STATE_DIR}/current.state." >&2
    exit 1
  fi
  require_canonical_deploy_image "$CURRENT_DEPLOY_IMAGE" "Current-Deploy-Image" || exit 1
  require_valid_deploy_sha "$CURRENT_DEPLOY_SHA" "Current-Deploy-SHA" || exit 1
fi

if [[ -e "$PURGE_RUNNER_STATE_FILE" ]]; then
  if ! read_snapshot \
    "$PURGE_RUNNER_STATE_FILE" SAVED_PURGE_RUNNER_IMAGE SAVED_PURGE_RUNNER_SHA; then
    echo "Fehler: Ungültiger Word-Cloud-Purge-Runner-State unter $PURGE_RUNNER_STATE_FILE." >&2
    exit 1
  fi
  require_canonical_deploy_image "$SAVED_PURGE_RUNNER_IMAGE" "Purge-Runner-Image" || exit 1
  require_valid_deploy_sha "$SAVED_PURGE_RUNNER_SHA" "Purge-Runner-SHA" || exit 1
fi

if [[ -e "$PURGE_RUNNER_CANDIDATE_STATE_FILE" ]]; then
  if ! read_snapshot \
    "$PURGE_RUNNER_CANDIDATE_STATE_FILE" \
    CANDIDATE_PURGE_RUNNER_IMAGE \
    CANDIDATE_PURGE_RUNNER_SHA; then
    echo "Fehler: Ungültiger Word-Cloud-Purge-Runner-Candidate-State." >&2
    exit 1
  fi
  require_canonical_deploy_image \
    "$CANDIDATE_PURGE_RUNNER_IMAGE" "Purge-Runner-Candidate-Image" || exit 1
  require_valid_deploy_sha \
    "$CANDIDATE_PURGE_RUNNER_SHA" "Purge-Runner-Candidate-SHA" || exit 1
fi

if [[ "$DEPLOY_MODE" == "rollback" ]]; then
  echo ">>> Rollback-Modus: lade previous.state (Image+SHA) aus Deploy-State …"
  if ! load_previous_deploy_state "$STATE_DIR" DEPLOY_IMAGE DEPLOY_SHA; then
    exit 1
  fi
  echo ">>> Previous image: $DEPLOY_IMAGE"
  echo ">>> Previous sha:    $DEPLOY_SHA"
elif [[ "$DEPLOY_MODE" == "recover" ]]; then
  echo ">>> Recover-Modus: lade current.state (letzter OK-Stand) aus Deploy-State …"
  if ! load_current_deploy_state "$STATE_DIR" DEPLOY_IMAGE DEPLOY_SHA; then
    exit 1
  fi
  echo ">>> Current image: $DEPLOY_IMAGE"
  echo ">>> Current sha:    $DEPLOY_SHA"
fi

# Image/SHA validieren, bevor laufende App-Container verändert werden.
require_canonical_deploy_image "$DEPLOY_IMAGE" "DEPLOY_IMAGE" || exit 1
require_valid_deploy_sha "$DEPLOY_SHA" "DEPLOY_SHA" || exit 1

if [[ "$DEPLOY_MODE" == "normal" ]]; then
  initial_checkout_sha="$(git rev-parse HEAD)"
  if [[ "$initial_checkout_sha" != "$DEPLOY_SHA" ]]; then
    echo "Fehler: Normal-Deploy muss bereits am DEPLOY_SHA gestartet werden." >&2
    echo "Zuerst scripts/deploy/checkout-deploy-sha.sh ausführen; kein Mid-Script-Upgrade." >&2
    exit 1
  fi
fi

export ARSNOVA_IMAGE="$DEPLOY_IMAGE"
export DEPLOY_IMAGE
export DEPLOY_SHA

compose_for_image() {
  local image="${1:?image required}"
  shift
  # ARSNOVA_IMAGE muss für Compose-Interpolation im Environment stehen.
  # Zusätzlich .env.arsnova-image laden, falls vorhanden (Operator-Persistenz).
  local -a env_args=("--env-file" "$ENV_FILE")
  if [[ -f "$IMAGE_ENV_FILE" ]]; then
    env_args+=("--env-file" "$IMAGE_ENV_FILE")
  fi
  ARSNOVA_IMAGE="$image" docker compose -f "$COMPOSE_FILE" "${env_args[@]}" "$@"
}

compose() {
  compose_for_image "$ARSNOVA_IMAGE" "$@"
}

# Der produktive Compose-Vertrag verwendet den lokalen, nicht per ACL/TLS
# abgesicherten Redis-Container. Die Live-Konvertierung muss auf genau diesem
# bestehenden Prozess laufen, bevor Compose ihn mit der AOF-Startkonfiguration
# eventuell neu erstellt. Externe/Managed Redis werden von diesem lokalen
# Betriebsvertrag nicht migriert.
redis_cli() {
  docker exec "$REDIS_CONTAINER_NAME" redis-cli --raw "$@"
}

redis_persistence_field() {
  local info="${1:?persistence info required}"
  local field="${2:?field required}"
  local line
  while IFS= read -r line; do
    line="${line%$'\r'}"
    if [[ "$line" == "$field:"* ]]; then
      printf '%s\n' "${line#*:}"
      return 0
    fi
  done <<<"$info"
  return 1
}

wait_for_redis_ping() {
  local attempt
  for attempt in {1..30}; do
    if [[ "$(redis_cli PING 2>/dev/null || true)" == "PONG" ]]; then
      return 0
    fi
    sleep 1
  done
  echo "Fehler: Bestehender Redis-Container wurde nicht rechtzeitig erreichbar." >&2
  return 1
}

wait_for_redis_rdb_snapshot() {
  local deadline=$((SECONDS + REDIS_AOF_MIGRATION_TIMEOUT_SECONDS))
  local info in_progress last_status
  while true; do
    if ! info="$(redis_cli INFO persistence)"; then
      echo "Fehler: Redis-Persistenzstatus konnte nicht gelesen werden." >&2
      return 1
    fi
    if ! in_progress="$(redis_persistence_field "$info" rdb_bgsave_in_progress)" ||
      ! last_status="$(redis_persistence_field "$info" rdb_last_bgsave_status)"; then
      echo "Fehler: Redis INFO persistence enthält keinen vollständigen RDB-Status." >&2
      return 1
    fi
    if [[ "$in_progress" == "0" && "$last_status" == "ok" ]]; then
      return 0
    fi
    if [[ "$in_progress" == "0" && "$last_status" != "ok" ]]; then
      echo "Fehler: Redis-RDB-Sicherung ist fehlgeschlagen (Status: $last_status)." >&2
      return 1
    fi
    if ((SECONDS >= deadline)); then
      echo "Fehler: Timeout beim Warten auf die Redis-RDB-Sicherung." >&2
      return 1
    fi
    sleep 1
  done
}

wait_for_redis_aof_ready() {
  local deadline=$((SECONDS + REDIS_AOF_MIGRATION_TIMEOUT_SECONDS))
  local info enabled in_progress scheduled rewrite_status write_status
  while true; do
    if ! info="$(redis_cli INFO persistence)"; then
      echo "Fehler: Redis-Persistenzstatus konnte nicht gelesen werden." >&2
      return 1
    fi
    if ! enabled="$(redis_persistence_field "$info" aof_enabled)" ||
      ! in_progress="$(redis_persistence_field "$info" aof_rewrite_in_progress)" ||
      ! scheduled="$(redis_persistence_field "$info" aof_rewrite_scheduled)" ||
      ! rewrite_status="$(redis_persistence_field "$info" aof_last_bgrewrite_status)" ||
      ! write_status="$(redis_persistence_field "$info" aof_last_write_status)"; then
      echo "Fehler: Redis INFO persistence enthält keinen vollständigen AOF-Status." >&2
      return 1
    fi
    if [[ "$enabled" == "1" && "$in_progress" == "0" && "$scheduled" == "0" &&
      "$rewrite_status" == "ok" && "$write_status" == "ok" ]]; then
      return 0
    fi
    if [[ "$in_progress" == "0" && "$scheduled" == "0" &&
      ("$rewrite_status" != "ok" || "$write_status" != "ok") ]]; then
      echo "Fehler: Redis-AOF ist nicht schreibbereit (Rewrite: $rewrite_status, Write: $write_status)." >&2
      return 1
    fi
    if ((SECONDS >= deadline)); then
      echo "Fehler: Timeout beim Warten auf die Redis-AOF-Aktivierung." >&2
      return 1
    fi
    sleep 1
  done
}

record_redis_aof_restart_probe() {
  local output normalized first_line remainder local_fsync
  REDIS_AOF_RESTART_PROBE_KEY="arsnova:ops:redis-aof-cutover:v1:${DEPLOY_SHA:0:12}:$$:${RANDOM}${RANDOM}${RANDOM}${RANDOM}"
  if ! output="$({
    printf 'SET %s 1 EX 600\n' "$REDIS_AOF_RESTART_PROBE_KEY"
    printf 'WAITAOF 1 0 5000\n'
  } | docker exec -i "$REDIS_CONTAINER_NAME" redis-cli --raw)"; then
    echo "Fehler: Redis-AOF-Neustartprobe konnte nicht geschrieben werden." >&2
    return 1
  fi
  normalized="${output//$'\r'/}"
  first_line="${normalized%%$'\n'*}"
  if [[ "$normalized" == *$'\n'* ]]; then
    remainder="${normalized#*$'\n'}"
    local_fsync="${remainder%%$'\n'*}"
  else
    local_fsync=''
  fi
  if [[ "$first_line" != "OK" || ! "$local_fsync" =~ ^[0-9]+$ ]] ||
    ((local_fsync < 1)); then
    echo "Fehler: Redis hat die AOF-Neustartprobe nicht lokal per WAITAOF bestätigt." >&2
    return 1
  fi
  if ! REDIS_KEY_COUNT_BEFORE_RECREATE="$(redis_cli DBSIZE)" ||
    [[ ! "$REDIS_KEY_COUNT_BEFORE_RECREATE" =~ ^[0-9]+$ ]]; then
    echo "Fehler: Redis-Schlüsselzahl konnte vor der Neuerstellung nicht gelesen werden." >&2
    return 1
  fi
  export REDIS_AOF_RESTART_PROBE_KEY REDIS_KEY_COUNT_BEFORE_RECREATE
}

verify_redis_aof_after_recreate() {
  local marker_value key_count_after
  wait_for_redis_ping
  wait_for_redis_aof_ready
  if [[ -z "$REDIS_AOF_RESTART_PROBE_KEY" ]]; then
    echo ">>> Redis-AOF für Fresh-Install verifiziert."
    return 0
  fi
  if ! marker_value="$(redis_cli GET "$REDIS_AOF_RESTART_PROBE_KEY")" ||
    [[ "$marker_value" != "1" ]]; then
    echo "Fehler: Redis-AOF-Neustartprobe fehlt nach der Container-Neuerstellung." >&2
    echo "Abbruch: Der vor dem Neustart bestätigte Datenstand wurde nicht nachgewiesen." >&2
    return 1
  fi
  if ! key_count_after="$(redis_cli DBSIZE)" || [[ ! "$key_count_after" =~ ^[0-9]+$ ]]; then
    echo "Fehler: Redis-Schlüsselzahl konnte nach der Neuerstellung nicht gelesen werden." >&2
    return 1
  fi
  echo ">>> Redis-AOF-Neustart verifiziert (DBSIZE vorher: $REDIS_KEY_COUNT_BEFORE_RECREATE, nachher: $key_count_after; TTL-Abweichungen sind möglich)."
}

ensure_live_redis_aof_before_recreate() {
  local running info enabled rdb_in_progress response redis_volumes
  running="$(docker inspect --format '{{.State.Running}}' "$REDIS_CONTAINER_NAME" 2>/dev/null || true)"
  if [[ -z "$running" ]]; then
    if [[ -n "$CURRENT_DEPLOY_IMAGE" ]] ||
      docker inspect arsnova-v3-postgres >/dev/null 2>&1; then
      echo "Fehler: Bestehendes Deployment ohne prüfbaren Redis-Container." >&2
      echo "Redis vor dem Deploy aus seinem bisherigen Container/Backup wiederherstellen; kein AOF-Neustart auf Verdacht." >&2
      return 1
    fi
    if ! redis_volumes="$(
      docker volume ls --quiet --filter label=com.docker.compose.volume=redis_data
    )"; then
      echo "Fehler: Bestehende Redis-Datenvolumes konnten nicht geprüft werden." >&2
      return 1
    fi
    if [[ -n "$redis_volumes" ]]; then
      echo "Fehler: Redis-Container fehlt, aber mindestens ein Compose-Redis-Datenvolume ist vorhanden." >&2
      echo "Betroffene(s) Volume(s):" >&2
      printf '%s\n' "$redis_volumes" >&2
      echo "Alten Redis mit seiner RDB-Konfiguration wiederherstellen und live auf AOF migrieren; kein Fresh-Start auf dem Volume." >&2
      return 1
    fi
    echo ">>> Kein bestehender Redis/Postgres-Container: AOF startet als Fresh-Install per Compose."
    return 0
  fi

  if [[ "$running" != "true" ]]; then
    echo ">>> Starte bestehenden Redis mit seiner bisherigen Konfiguration für die Live-AOF-Prüfung …"
    docker start "$REDIS_CONTAINER_NAME" >/dev/null
  fi
  wait_for_redis_ping

  if ! info="$(redis_cli INFO persistence)" ||
    ! enabled="$(redis_persistence_field "$info" aof_enabled)"; then
    echo "Fehler: Redis-AOF-Status konnte vor der möglichen Neuerstellung nicht bestimmt werden." >&2
    return 1
  fi

  if [[ "$enabled" == "1" ]]; then
    echo ">>> Redis-AOF ist bereits aktiv; warte auf stabilen Persistenzstatus …"
    wait_for_redis_aof_ready
  elif [[ "$enabled" != "0" ]]; then
    echo "Fehler: Unerwarteter aof_enabled-Wert: $enabled" >&2
    return 1
  else
    echo ">>> Redis nutzt noch RDB: erzeuge vor der Live-AOF-Konvertierung einen aktuellen Snapshot …"
    if ! rdb_in_progress="$(redis_persistence_field "$info" rdb_bgsave_in_progress)"; then
      echo "Fehler: Redis INFO persistence enthält keinen RDB-Status." >&2
      return 1
    fi
    if [[ "$rdb_in_progress" == "0" ]]; then
      redis_cli BGSAVE >/dev/null
    fi
    wait_for_redis_rdb_snapshot

    echo ">>> Aktiviere AOF live auf dem bestehenden Redis (kein Restart zwischen RDB und AOF) …"
    if ! response="$(redis_cli CONFIG SET appendfsync everysec)" || [[ "$response" != "OK" ]]; then
      echo "Fehler: Redis appendfsync=everysec konnte nicht live gesetzt werden." >&2
      return 1
    fi
    if ! response="$(redis_cli CONFIG SET appendonly yes)" || [[ "$response" != "OK" ]]; then
      echo "Fehler: Redis-AOF konnte nicht live aktiviert werden." >&2
      return 1
    fi
    wait_for_redis_aof_ready
    echo ">>> Redis-RDB→AOF-Live-Konvertierung erfolgreich abgeschlossen."
  fi
  record_redis_aof_restart_probe
}

probe_wordcloud_purge_runner() {
  local image="${1:?image required}"
  local status
  set +e
  compose_for_image "$image" run --rm --no-deps --entrypoint "" app sh -eu -c '
    if [ -f /app/apps/backend/dist/runWordCloudCacheMigration.js ]; then
      exit 0
    fi
    exit 42
  '
  status=$?
  set -e
  return "$status"
}

echo ">>> Schritt 0: Ziel-Image vor Git-Checkout pullen und sicherheitsprüfen …"
# Diese Prüfung muss mit der aktuell installierten, kompatiblen Deploy-Logik
# laufen. Ein Legacy-Rollback wird so abgelehnt, bevor sein alter Working Tree
# das sichere Skript ersetzen könnte.
compose pull app pdf-worker
require_image_compatible_with_host "$ARSNOVA_IMAGE" || exit 1
TARGET_HAS_PURGE_RUNNER=0
if probe_wordcloud_purge_runner "$ARSNOVA_IMAGE"; then
  TARGET_HAS_PURGE_RUNNER=1
else
  target_probe_status=$?
  if [[ "$target_probe_status" -eq 42 ]]; then
    echo "Fehler: Ziel-Image enthält kein Word-Cloud-All-Cache-Purge-Gate." >&2
    echo "Ein Cache-unsicherer Legacy-Writer darf auch bei Rollback/Recover nicht neu starten." >&2
  else
    echo "Fehler: Ziel-Image konnte nicht auf das Word-Cloud-Purge-Gate geprüft werden." >&2
  fi
  exit 1
fi

echo ">>> Schritt 1: Ziel-Commit holen und exakt auschecken (Branch: $DEPLOY_BRANCH) …"
git fetch --prune origin "$DEPLOY_BRANCH"

if ! git cat-file -e "${DEPLOY_SHA}^{commit}" 2>/dev/null; then
  echo ">>> Ziel-Commit ist lokal noch nicht vorhanden; hole ihn explizit …"
  git fetch origin "$DEPLOY_SHA"
fi

if ! git cat-file -e "${DEPLOY_SHA}^{commit}" 2>/dev/null; then
  echo "Fehler: Ziel-Commit $DEPLOY_SHA konnte nicht gefunden werden."
  exit 1
fi

git checkout --detach --force "$DEPLOY_SHA"

checked_out_sha="$(git rev-parse HEAD)"
if [[ "$checked_out_sha" != "$DEPLOY_SHA" ]]; then
  echo "Fehler: Ausgecheckter Commit ($checked_out_sha) entspricht nicht DEPLOY_SHA ($DEPLOY_SHA)."
  exit 1
fi

echo ">>> Git sync abgeschlossen ($(git log -1 --format='%h %s'))"

echo ""
echo ">>> Schritt 2: Image-Referenz und Compose-Vertrag prüfen (vor Container-Änderung) …"
if [[ -z "${ARSNOVA_IMAGE:-}" ]]; then
  echo "Fehler: ARSNOVA_IMAGE ist leer. Abbruch vor Änderung laufender Container."
  exit 1
fi
require_canonical_deploy_image "$ARSNOVA_IMAGE" "ARSNOVA_IMAGE" || exit 1

if ! compose config --quiet >/dev/null; then
  echo "Fehler: docker compose config fehlgeschlagen (ARSNOVA_IMAGE/Env prüfen)."
  exit 1
fi

resolve_compose_images() {
  if command -v python3 >/dev/null 2>&1; then
    compose config --format json | python3 -c '
import json, sys
cfg = json.load(sys.stdin)
print(cfg["services"]["app"]["image"])
print(cfg["services"]["pdf-worker"]["image"])
'
    return
  fi
  local cfg resolved_app resolved_pdf
  cfg="$(compose config)"
  resolved_app="$(printf '%s\n' "$cfg" | awk '/^  app:/{p=1} p&&/image:/{print $2; exit}')"
  resolved_pdf="$(printf '%s\n' "$cfg" | awk '/^  pdf-worker:/{p=1} p&&/image:/{print $2; exit}')"
  printf '%s\n%s\n' "$resolved_app" "$resolved_pdf"
}

compose_images="$(resolve_compose_images)"
app_image="$(printf '%s\n' "$compose_images" | sed -n '1p')"
pdf_image="$(printf '%s\n' "$compose_images" | sed -n '2p')"

if [[ "$app_image" != "$ARSNOVA_IMAGE" || "$pdf_image" != "$ARSNOVA_IMAGE" ]]; then
  echo "Fehler: app und pdf-worker müssen dieselbe ARSNOVA_IMAGE-Referenz nutzen."
  echo "  app:        $app_image"
  echo "  pdf-worker: $pdf_image"
  echo "  erwartet:   $ARSNOVA_IMAGE"
  exit 1
fi
echo ">>> Compose-Vertrag OK (app und pdf-worker → $ARSNOVA_IMAGE)."

echo ""
echo ">>> Schritt 3: Redis-Persistenz vor einer möglichen Container-Neuerstellung absichern"
ensure_live_redis_aof_before_recreate

echo ""
echo ">>> Schritt 4: Infrastruktur starten (Postgres + Redis) und auf Bereitschaft warten"
# --wait: Healthchecks von postgres/redis müssen grün sein, bevor migriert wird.
# Notwendig, weil der Migrationslauf mit --no-deps die depends_on-Wartelogik
# von Compose nicht mehr nutzt (#229).
compose up -d --wait postgres redis
verify_redis_aof_after_recreate

echo ""
echo ">>> Schritt 5: Prisma-Migrationen anwenden"
# Vor dem App-Rollout explizit migrieren; der App-Entrypoint wiederholt diesen
# idempotenten Check beim Containerstart als zusätzliche Startbarriere.
# --no-deps: pdf-worker/app nicht als Abhängigkeit vorzeitig starten/ersetzen
# (Incident #229: amd64-Image + depends_on machte den Worker unhealthy).
compose run --rm --no-deps --entrypoint "" app /app/node_modules/.bin/prisma migrate deploy --schema /app/prisma/schema.prisma

echo ""
echo ">>> Schritt 5b: Word-Cloud-/Blitzlicht-Purge-Runner vor Writer-Drain verifizieren"
ACTIVE_APP_IMAGE="$(docker inspect --format '{{.Config.Image}}' arsnova-v3-app 2>/dev/null || true)"
PURGE_RUNNER_IMAGE=''
PURGE_RUNNER_SHA=''
ACTIVE_APP_SHA=''

if [[ "$ACTIVE_APP_IMAGE" == "$CURRENT_DEPLOY_IMAGE" ]]; then
  ACTIVE_APP_SHA="$CURRENT_DEPLOY_SHA"
elif [[ "$ACTIVE_APP_IMAGE" == "$SAVED_PURGE_RUNNER_IMAGE" ]]; then
  ACTIVE_APP_SHA="$SAVED_PURGE_RUNNER_SHA"
elif [[ "$ACTIVE_APP_IMAGE" == "$CANDIDATE_PURGE_RUNNER_IMAGE" ]]; then
  ACTIVE_APP_SHA="$CANDIDATE_PURGE_RUNNER_SHA"
elif [[ "$ACTIVE_APP_IMAGE" == "$ARSNOVA_IMAGE" ]]; then
  ACTIVE_APP_SHA="$DEPLOY_SHA"
fi

select_wordcloud_purge_runner() {
  local image="${1:-}"
  local sha="${2:-}"
  local source="${3:?source required}"
  local status
  [[ -n "$image" ]] || return 1
  if probe_wordcloud_purge_runner "$image"; then
    PURGE_RUNNER_IMAGE="$image"
    PURGE_RUNNER_SHA="$sha"
    if [[ "$image" == "$ARSNOVA_IMAGE" ]]; then
      TARGET_HAS_PURGE_RUNNER=1
    fi
    echo ">>> Purge-Runner-Quelle verifiziert: $source ($image)"
    return 0
  else
    status=$?
  fi
  if [[ "$status" -eq 42 ]]; then
    echo ">>> Purge-Runner-Quelle ohne Gate, überspringe: $source ($image)"
  else
    echo ">>> Purge-Runner-Quelle nicht ausführbar, prüfe Fallback: $source ($image)" >&2
  fi
  return 1
}

# Ein persistierter Candidate kennzeichnet ausschließlich einen unvollständigen
# Normal-Deploy. Er kann bereits eine neuere Cachegeneration geschrieben haben
# und ist deshalb bis zum erfolgreichen State-Commit bei jedem Folgelauf der
# bindende Runner – auch wenn inzwischen current/last-known-good läuft. Das gilt
# ebenso für den ersten bzw. wiederholten Normal-Deploy, sobald sein Candidate
# persistiert wurde. Ohne Candidate ist bei Recover eine unbekannte tatsächlich
# laufende Generation ihrerseits bindend.
REQUIRED_PURGE_RUNNER_IMAGE=''
REQUIRED_PURGE_RUNNER_SHA=''
REQUIRED_PURGE_RUNNER_SOURCE=''
if [[ -n "$CANDIDATE_PURGE_RUNNER_IMAGE" ]]; then
  if [[ -n "$ACTIVE_APP_IMAGE" && \
    "$ACTIVE_APP_IMAGE" != "$CANDIDATE_PURGE_RUNNER_IMAGE" && \
    "$ACTIVE_APP_IMAGE" != "$CURRENT_DEPLOY_IMAGE" && \
    "$ACTIVE_APP_IMAGE" != "$SAVED_PURGE_RUNNER_IMAGE" && \
    "$ACTIVE_APP_IMAGE" != "$ARSNOVA_IMAGE" ]]; then
    echo "Fehler: Laufende App-Generation ist weder Candidate noch ein bekannter Deploy-State." >&2
    echo "Ihre Cachegenerationen können nicht sicher bestimmt werden." >&2
    exit 1
  fi
  REQUIRED_PURGE_RUNNER_IMAGE="$CANDIDATE_PURGE_RUNNER_IMAGE"
  REQUIRED_PURGE_RUNNER_SHA="$CANDIDATE_PURGE_RUNNER_SHA"
  REQUIRED_PURGE_RUNNER_SOURCE='unfinished-normal-deploy-candidate'
elif [[ "$DEPLOY_MODE" == "recover" && -n "$ACTIVE_APP_IMAGE" && \
    "$ACTIVE_APP_IMAGE" != "$CURRENT_DEPLOY_IMAGE" && \
    "$ACTIVE_APP_IMAGE" != "$SAVED_PURGE_RUNNER_IMAGE" && \
    "$ACTIVE_APP_IMAGE" != "$ARSNOVA_IMAGE" ]]; then
  REQUIRED_PURGE_RUNNER_IMAGE="$ACTIVE_APP_IMAGE"
  REQUIRED_PURGE_RUNNER_SHA="$ACTIVE_APP_SHA"
  REQUIRED_PURGE_RUNNER_SOURCE='actual-unknown-generation'
fi

if [[ -n "$REQUIRED_PURGE_RUNNER_IMAGE" ]]; then
  if ! select_wordcloud_purge_runner \
    "$REQUIRED_PURGE_RUNNER_IMAGE" \
    "$REQUIRED_PURGE_RUNNER_SHA" \
    "$REQUIRED_PURGE_RUNNER_SOURCE"; then
    echo "Fehler: Potenzieller Writer besitzt keinen ausführbaren All-Cache-Purge-Runner." >&2
    exit 1
  fi
fi

case "$DEPLOY_MODE" in
  recover)
    RUNNER_CANDIDATES=(
      "$ACTIVE_APP_IMAGE|$ACTIVE_APP_SHA|actual-container"
      "$CANDIDATE_PURGE_RUNNER_IMAGE|$CANDIDATE_PURGE_RUNNER_SHA|attempted-target"
      "$SAVED_PURGE_RUNNER_IMAGE|$SAVED_PURGE_RUNNER_SHA|last-known-good"
      "$CURRENT_DEPLOY_IMAGE|$CURRENT_DEPLOY_SHA|current.state"
      "$ARSNOVA_IMAGE|$DEPLOY_SHA|recover-target"
    )
    ;;
  rollback)
    RUNNER_CANDIDATES=(
      "$ACTIVE_APP_IMAGE|$ACTIVE_APP_SHA|actual-container"
      "$CURRENT_DEPLOY_IMAGE|$CURRENT_DEPLOY_SHA|current.state"
      "$SAVED_PURGE_RUNNER_IMAGE|$SAVED_PURGE_RUNNER_SHA|last-known-good"
      "$CANDIDATE_PURGE_RUNNER_IMAGE|$CANDIDATE_PURGE_RUNNER_SHA|attempted-target"
      "$ARSNOVA_IMAGE|$DEPLOY_SHA|rollback-target"
    )
    ;;
  *)
    RUNNER_CANDIDATES=(
      "$ARSNOVA_IMAGE|$DEPLOY_SHA|deploy-target"
      "$ACTIVE_APP_IMAGE|$ACTIVE_APP_SHA|actual-container"
      "$CURRENT_DEPLOY_IMAGE|$CURRENT_DEPLOY_SHA|current.state"
      "$SAVED_PURGE_RUNNER_IMAGE|$SAVED_PURGE_RUNNER_SHA|last-known-good"
    )
    ;;
esac

if [[ -z "$PURGE_RUNNER_IMAGE" ]]; then
  for runner_candidate in "${RUNNER_CANDIDATES[@]}"; do
    IFS='|' read -r runner_image runner_sha runner_source <<<"$runner_candidate"
    if select_wordcloud_purge_runner "$runner_image" "$runner_sha" "$runner_source"; then
      break
    fi
  done
fi

if [[ -z "$PURGE_RUNNER_IMAGE" ]]; then
  echo "Fehler: Kein verifizierter Word-Cloud-/Blitzlicht-Rollout-Purge-Runner verfügbar." >&2
  exit 1
fi

echo ">>> Purge-Runner verifiziert: $PURGE_RUNNER_IMAGE"
echo ">>> Stoppe und draine den bisherigen App-Writer …"
compose stop app
if [[ "$(docker inspect --format '{{.State.Running}}' arsnova-v3-app 2>/dev/null || true)" == "true" ]]; then
  echo "Fehler: arsnova-v3-app läuft nach dem Writer-Drain weiterhin." >&2
  exit 1
fi

run_wordcloud_all_cache_purge() {
  compose_for_image "$PURGE_RUNNER_IMAGE" run --rm --no-deps --entrypoint "" \
    -e NODE_ENV=production \
    -e WORD_CLOUD_PURGE_REQUIRE_DURABILITY=1 \
    app node /app/apps/backend/dist/runWordCloudCacheMigration.js
}

echo ">>> Lösche Word-Cloud-Analysecaches und Legacy-Blitzlichter nach Writer-Drain …"
run_wordcloud_all_cache_purge
echo ">>> Erster Word-Cloud-/Blitzlicht-Rollout-Purge AOF-bestätigt."
if [[ -n "$PURGE_RUNNER_SHA" ]]; then
  # Erst ein erfolgreich ausgeführter Sweep macht einen Runner recovery-tauglich.
  write_atomic_snapshot "$PURGE_RUNNER_STATE_FILE" "$PURGE_RUNNER_IMAGE" "$PURGE_RUNNER_SHA"
fi

echo ""
echo ">>> Schritt 5c: Überfällige Retention ohne konkurrierenden App-Writer bereinigen"
# Wie migrate: gehärtetes Image hat kein npm in PATH (Dockerfile entfernt es).
if [[ "$DEPLOY_MODE" == "normal" ]]; then
  compose run --rm --no-deps --entrypoint "" app node /app/apps/backend/dist/runRetentionCleanup.js
else
  compose run --rm --no-deps --entrypoint "" app sh -eu -c '
    if [ -f /app/apps/backend/dist/runRetentionCleanup.js ]; then
      node /app/apps/backend/dist/runRetentionCleanup.js
    else
      echo "Hinweis: Ziel-Image besitzt noch kein Retention-Gate; DB-Rollback-Bridge bleibt aktiv."
    fi
  '
fi

echo ">>> Wiederhole den Word-Cloud-/Blitzlicht-Rollout-Purge nach Retention …"
# Besonders beim ersten Cutover besitzt der gestoppte Legacy-Writer noch kein
# neues Shutdown-Gate. Ein bereits abgesendeter später v1-/Text-Write wird vor
# dem Start einer neuen App-Generation durch diesen zweiten, AOF-bestätigten
# Pass erneut entfernt. Ein Fehler bleibt fail-closed vor App-Start.
run_wordcloud_all_cache_purge
echo ">>> Finaler Word-Cloud-/Blitzlicht-Rollout-Purge AOF-bestätigt."

echo ""
echo ">>> Schritt 6: App und PDF-Worker starten"
if [[ "$DEPLOY_MODE" == "normal" ]]; then
  # Der Candidate wird erst unmittelbar vor dem möglichen neuen Writer
  # persistiert. Ein älterer Candidate bleibt dadurch bis nach Drain, beiden
  # Purges und Retention bindender Runner; erst dann darf ein Forward-Fix ihn
  # sicher ablösen.
  write_atomic_snapshot "$PURGE_RUNNER_CANDIDATE_STATE_FILE" "$ARSNOVA_IMAGE" "$DEPLOY_SHA"
  CANDIDATE_PURGE_RUNNER_IMAGE="$ARSNOVA_IMAGE"
  CANDIDATE_PURGE_RUNNER_SHA="$DEPLOY_SHA"
fi
compose up -d pdf-worker app

echo ""
echo ">>> Schritt 7: Warte auf Container-Healthcheck (max ${HEALTH_MAX_WAIT_SECONDS}s) …"
elapsed=0
until compose ps app --format json | grep -q '"Health":"healthy"'; do
  sleep 5
  elapsed=$((elapsed + 5))
  if ((elapsed >= HEALTH_MAX_WAIT_SECONDS)); then
    echo "Fehler: App wurde nicht rechtzeitig healthy."
    echo "Container-Status:"
    compose ps
    echo ""
    echo "Letzte App-Logs:"
    compose logs app --tail 80 || true
    exit 1
  fi
done
echo ">>> App-Container ist healthy."

if [[ "$TARGET_HAS_PURGE_RUNNER" -eq 1 ]]; then
  # Der Ziel-Entrypoint hat seinen eigenen All-Cache-Purge erfolgreich passiert
  # und der neue Prozess ist healthy. Erst jetzt wird sein Runner für künftige
  # Rollback-/Recover-Läufe als last-known-good vorgezogen (forward-compatible
  # zu neuen Cachegenerationen im Ziel-Image).
  write_atomic_snapshot "$PURGE_RUNNER_STATE_FILE" "$ARSNOVA_IMAGE" "$DEPLOY_SHA"
fi

verify_running_image_digest() {
  local service="$1"
  local container="$2"
  local expected_ref="$3"
  local local_id container_id repo_digests

  if ! local_id="$(docker image inspect --format '{{.Id}}' "$expected_ref" 2>/dev/null)"; then
    echo "Fehler: Lokales Image für $expected_ref nicht gefunden (Service $service)."
    exit 1
  fi

  repo_digests="$(docker image inspect --format '{{json .RepoDigests}}' "$expected_ref")"
  if ! printf '%s' "$repo_digests" | grep -Fq "$expected_ref"; then
    echo "Fehler: Registry-Digest $expected_ref fehlt in RepoDigests von $service."
    echo "  RepoDigests=$repo_digests"
    exit 1
  fi

  container_id="$(docker inspect --format '{{.Image}}' "$container")"
  if [[ "$container_id" != "$local_id" ]]; then
    echo "Fehler: Laufender Container $container nutzt Image-ID $container_id,"
    echo "  erwartet $local_id ($expected_ref) für Service $service."
    exit 1
  fi

  echo ">>> Digest-Nachweis OK: $service → $expected_ref → $local_id"
}

echo ""
echo ">>> Schritt 8: Registry-Digest → lokale Image-ID → Container-Image-ID prüfen …"
verify_running_image_digest "app" "arsnova-v3-app" "$ARSNOVA_IMAGE"
verify_running_image_digest "pdf-worker" "arsnova-v3-pdf-worker" "$ARSNOVA_IMAGE"

echo ""
echo ">>> Schritt 9: HTTP-Verifikation"
if curl -fsS "http://127.0.0.1:3000/trpc/health.check" >/dev/null; then
  echo ">>> tRPC Healthcheck erreichbar."
else
  echo "Fehler: tRPC Healthcheck nicht erreichbar."
  compose logs app --tail 80 || true
  exit 1
fi

if curl -fsS "http://127.0.0.1:3000/de/" | grep -qi "<app-root"; then
  echo ">>> Frontend-Shell wird unter /de/ ausgeliefert."
else
  echo "Fehler: Frontend-Shell fehlt unter /de/."
  compose logs app --tail 80 || true
  exit 1
fi

echo ""
echo ">>> Schritt 10: Deploy-State und Operator-Image-Env schreiben …"
case "$DEPLOY_MODE" in
  rollback)
    # Fehlgeschlagenen Release nicht als nächsten Rollback-Ziel speichern.
    commit_rollback_deploy_state "$STATE_DIR" "$ARSNOVA_IMAGE" "$DEPLOY_SHA"
    ;;
  recover)
    # current war bereits korrekt; Snapshot nur bestätigen, previous unangetastet.
    write_atomic_snapshot "${STATE_DIR}/current.state" "$ARSNOVA_IMAGE" "$DEPLOY_SHA"
    ;;
  *)
    rotate_deploy_state "$STATE_DIR" "$ARSNOVA_IMAGE" "$DEPLOY_SHA"
    ;;
esac
write_operator_image_env "$REPO_ROOT" "$ARSNOVA_IMAGE"
# Candidate-State bedeutet nur "Normal-Deploy noch nicht vollständig
# committed". Erst nachdem Deploy-State und Operator-Env erfolgreich
# geschrieben sind, ist die Generation abgeschlossen und der Marker obsolet.
rm -f -- "$PURGE_RUNNER_CANDIDATE_STATE_FILE"
echo ">>> Deploy-State aktualisiert unter $STATE_DIR"
echo ">>> Operator-Image-Env: $REPO_ROOT/$IMAGE_ENV_FILE"

echo ""
echo ">>> Deploy abgeschlossen."
case "$DEPLOY_MODE" in
  rollback)
    echo ">>> Modus: Rollback (Image+SHA aus previous.state)."
    echo ">>> Hinweis: Image-Rollback setzt keine Datenbankmigrationen zurück."
    ;;
  recover)
    echo ">>> Modus: Recover (Image+SHA aus current.state)."
    echo ">>> Hinweis: Image-Recover setzt keine Datenbankmigrationen zurück."
    ;;
esac
echo ">>> Image: $ARSNOVA_IMAGE"
echo ">>> Version: $(git log -1 --format='%h – %s (%ci)')"
