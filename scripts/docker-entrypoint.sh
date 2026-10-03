#!/bin/sh
# =============================================================================
# arsnova.eu – Docker Entrypoint
# Wendet ausschließlich versionierte Prisma-Migrationen an und startet die App
# erst nach einer vollständig erfolgreichen Migrationskette.
# =============================================================================

set -eu

echo ">>> Production-Entrypoint gestartet"

if [ -z "${DATABASE_URL:-}" ]; then
  echo ">>> FEHLER: DATABASE_URL ist für den Produktionsstart erforderlich." >&2
  exit 1
fi

echo ">>> Wende versionierte Prisma-Migrationen an …"
/app/node_modules/.bin/prisma migrate deploy --schema /app/prisma/schema.prisma
echo ">>> Migrationen erfolgreich angewendet."

# docker-compose.prod.yml betreibt genau einen fest benannten App-Container.
# Der reguläre Deploy-Vertrag stoppt und drained den vorherigen Writer und führt
# vor sowie nach Retention je einen fail-closed Rollout-Sweep aus. Dieser
# Entrypoint wiederholt das Gate unmittelbar vor dem neuen Prozess: v1-Altlasten,
# alle v2-Snapshot-Werte, -Indizes und -Fences, der alte persistente Textcache
# sowie sessiongebundene Blitzlicht-Altwerte ohne sessionId werden entfernt.
# Der neue Prozess startet mit kaltem Analysecache; Standalone-Blitzlichter und
# bereits ID-gebundene Runden bleiben erhalten. Pre-Gate-Ziele darf deploy.sh
# nicht starten.
if [ "$#" -ge 2 ] && [ "$1" = "node" ] && [ "$2" = "apps/backend/dist/index.js" ]; then
  echo ">>> Führe den Word-Cloud-/Blitzlicht-Rollout-Purge nach Writer-Drain aus …"
  node apps/backend/dist/runWordCloudCacheMigration.js
  echo ">>> Word-Cloud-/Blitzlicht-Rollout-Purge abgeschlossen."
fi

exec "$@"
