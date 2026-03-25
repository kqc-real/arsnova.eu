#!/usr/bin/env bash
# =============================================================================
# arsnova.eu – Deploy-Skript (auf dem Server oder via CI per SSH)
# Voraussetzung: Im Repo-Verzeichnis, .env.production vorhanden.
# Nutzung: ./scripts/deploy.sh   oder   bash scripts/deploy.sh
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE=".env.production"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-main}"
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

echo ">>> Schritt 1: Neuesten Code von GitHub holen (Branch: $DEPLOY_BRANCH) …"
git fetch origin
git checkout "$DEPLOY_BRANCH"
git reset --hard "origin/$DEPLOY_BRANCH"
echo ">>> Git sync abgeschlossen ($(git log -1 --format='%h %s'))"

echo ""
echo ">>> Schritt 2: Docker Image bauen (Produktion)"
compose build --pull app

echo ""
echo ">>> Schritt 3: Infrastruktur starten (Postgres + Redis)"
compose up -d postgres redis

echo ""
echo ">>> Schritt 4: Prisma-Migrationen anwenden"
# Entrypoint NICHT ausführen: der würde zuerst „db push“ laufen lassen und Spalten anlegen,
# bevor migrate deploy dieselbe Migration anwendet → P3018 duplicate column.
compose run --rm --entrypoint "" app npx prisma migrate deploy

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
