#!/bin/sh
# =============================================================================
# arsnova.eu – Docker Entrypoint
# Wendet Prisma-Migrationen an, bevor der Backend-Prozess startet.
# So funktioniert Deploy ohne Zugriff auf den Server (nur Container starten).
# =============================================================================

set -e

if [ -n "${DATABASE_URL:-}" ]; then
  echo ">>> Prisma: Migrationen anwenden …"
  npx prisma migrate deploy
  echo ">>> Prisma: Migrationen abgeschlossen."
else
  echo ">>> DATABASE_URL nicht gesetzt – Prisma-Migrationen übersprungen."
fi

exec "$@"
