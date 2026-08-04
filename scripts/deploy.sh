#!/usr/bin/env bash
# =============================================================================
# arsnova.eu – Digest-basiertes Deploy-Skript (Server oder CI per SSH)
#
# Normal:  DEPLOY_IMAGE + DEPLOY_SHA setzen, dann ./scripts/deploy.sh
# Rollback: ./scripts/deploy.sh --rollback
#   lädt previous image+sha aus $DEPLOY_DIR/.deploy-state (bzw. Repo-Root).
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

COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE=".env.production"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-main}"
DEPLOY_SHA="${DEPLOY_SHA:-}"
DEPLOY_IMAGE="${DEPLOY_IMAGE:-}"
DEPLOY_DIR="${DEPLOY_DIR:-}"
HEALTH_MAX_WAIT_SECONDS="${HEALTH_MAX_WAIT_SECONDS:-180}"
ROLLBACK_MODE=0

usage() {
  cat <<'EOF'
Usage:
  DEPLOY_IMAGE='ghcr.io/kqc-real/arsnova.eu@sha256:<64-hex>' \
  DEPLOY_SHA='<40-hex>' \
  ./scripts/deploy.sh

  ./scripts/deploy.sh --rollback

Hinweis: Image-Rollback setzt keine DB-Migrationen zurück.
EOF
}

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  usage
  exit 0
fi

if [[ "${1:-}" == "--rollback" ]]; then
  ROLLBACK_MODE=1
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

if (( ROLLBACK_MODE == 1 )); then
  echo ">>> Rollback-Modus: lade previous image+sha aus Deploy-State …"
  if ! load_previous_deploy_state "$STATE_DIR" DEPLOY_IMAGE DEPLOY_SHA; then
    exit 1
  fi
  echo ">>> Previous image: $DEPLOY_IMAGE"
  echo ">>> Previous sha:    $DEPLOY_SHA"
fi

# Image/SHA validieren, bevor laufende App-Container verändert werden.
require_canonical_deploy_image "$DEPLOY_IMAGE" "DEPLOY_IMAGE" || exit 1
require_valid_deploy_sha "$DEPLOY_SHA" "DEPLOY_SHA" || exit 1

export ARSNOVA_IMAGE="$DEPLOY_IMAGE"
export DEPLOY_IMAGE
export DEPLOY_SHA

compose() {
  # ARSNOVA_IMAGE muss für Compose-Interpolation im Environment stehen.
  ARSNOVA_IMAGE="$ARSNOVA_IMAGE" docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" "$@"
}

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
echo ">>> Schritt 3: Image pullen (kein Build) …"
compose pull app pdf-worker

echo ""
echo ">>> Schritt 4: Infrastruktur starten (Postgres + Redis)"
compose up -d postgres redis

echo ""
echo ">>> Schritt 5: Prisma-Migrationen anwenden"
# Vor dem App-Rollout explizit migrieren; der App-Entrypoint wiederholt diesen
# idempotenten Check beim Containerstart als zusätzliche Startbarriere.
compose run --rm --entrypoint "" app /app/node_modules/.bin/prisma migrate deploy --schema /app/prisma/schema.prisma

echo ""
echo ">>> Schritt 6: App und PDF-Worker starten"
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
echo ">>> Schritt 10: Deploy-State atomar rotieren (current/previous) …"
rotate_deploy_state "$STATE_DIR" "$ARSNOVA_IMAGE" "$DEPLOY_SHA"
echo ">>> Deploy-State aktualisiert unter $STATE_DIR"

echo ""
echo ">>> Deploy abgeschlossen."
if ((ROLLBACK_MODE == 1)); then
  echo ">>> Modus: Rollback (Image+SHA aus Previous-State)."
  echo ">>> Hinweis: Image-Rollback setzt keine Datenbankmigrationen zurück."
fi
echo ">>> Image: $ARSNOVA_IMAGE"
echo ">>> Version: $(git log -1 --format='%h – %s (%ci)')"
