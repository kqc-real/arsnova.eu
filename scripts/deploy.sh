#!/usr/bin/env bash
# =============================================================================
# arsnova.eu – Deploy-Skript (auf dem Server oder via CI per SSH)
# Voraussetzung: Im Repo-Verzeichnis, .env.production vorhanden.
# CI setzt DEPLOY_SHA auf den exakt geprüften Commit.
# Manuell ohne DEPLOY_SHA wird der aktuelle Stand von origin/$DEPLOY_BRANCH verwendet.
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE=".env.production"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-main}"
DEPLOY_SHA="${DEPLOY_SHA:-}"
HEALTH_MAX_WAIT_SECONDS="${HEALTH_MAX_WAIT_SECONDS:-180}"

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

compose() {
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" "$@"
}

echo ">>> Schritt 1: Ziel-Commit holen und exakt auschecken (Branch: $DEPLOY_BRANCH) …"
git fetch --prune origin "$DEPLOY_BRANCH"

if [[ -z "$DEPLOY_SHA" ]]; then
  DEPLOY_SHA="$(git rev-parse FETCH_HEAD)"
  echo ">>> Kein DEPLOY_SHA gesetzt; verwende aktuellen Remote-Stand: $DEPLOY_SHA"
fi

if [[ ! "$DEPLOY_SHA" =~ ^[0-9a-f]{40}$ ]]; then
  echo "Fehler: ungültiger DEPLOY_SHA: $DEPLOY_SHA"
  exit 1
fi

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
echo ">>> Schritt 2: Docker Image bauen (Produktion)"
compose build --pull app

echo ""
echo ">>> Schritt 3: Infrastruktur starten (Postgres + Redis)"
compose up -d postgres redis

echo ""
echo ">>> Schritt 4: Prisma-Migrationen anwenden"
# Vor dem App-Rollout explizit migrieren; der App-Entrypoint wiederholt diesen
# idempotenten Check beim Containerstart als zusätzliche Startbarriere.
compose run --rm --entrypoint "" app /app/node_modules/.bin/prisma migrate deploy --schema /app/prisma/schema.prisma

echo ""
echo ">>> Schritt 5: App starten"
compose up -d app

echo ""
echo ">>> Schritt 6: Warte auf Container-Healthcheck (max ${HEALTH_MAX_WAIT_SECONDS}s) …"
elapsed=0
until compose ps app --format json | grep -q '"Health":"healthy"'; do
  sleep 5
  elapsed=$((elapsed + 5))
  if (( elapsed >= HEALTH_MAX_WAIT_SECONDS )); then
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

echo ""
echo ">>> Schritt 7: HTTP-Verifikation"
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
echo ">>> Deploy abgeschlossen."
echo ">>> Version: $(git log -1 --format='%h – %s (%ci)')"
