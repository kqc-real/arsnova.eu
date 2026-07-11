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
exec "$@"
