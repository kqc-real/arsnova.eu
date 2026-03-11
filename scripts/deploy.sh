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

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Fehler: $ENV_FILE nicht gefunden. Bitte anlegen (siehe .env.production.example)."
  exit 1
fi

echo ">>> Schritt 1: Neuesten Code von GitHub holen …"
git pull --ff-only origin main
echo ">>> Git pull abgeschlossen ($(git log -1 --format='%h %s'))"

echo ""
echo ">>> Schritt 2: Docker Compose – Build ohne Cache & Start (Produktion)"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" build --no-cache
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d

echo ""
echo ">>> Schritt 3: Warte auf Healthcheck …"
sleep 5
if docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps --format json | grep -q '"Health":"healthy"'; then
  echo ">>> App ist healthy."
else
  echo ">>> App startet noch – Container-Logs prüfen:"
  echo ">>>   docker compose -f $COMPOSE_FILE --env-file $ENV_FILE logs app --tail 50"
fi

echo ""
echo ">>> Deploy abgeschlossen."
echo ">>> Version: $(git log -1 --format='%h – %s (%ci)')"
