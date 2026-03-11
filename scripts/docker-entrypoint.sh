#!/bin/sh
# =============================================================================
# arsnova.eu – Docker Entrypoint
# Wendet Prisma-Migrationen an, bevor der Backend-Prozess startet.
# Strategie: migrate deploy (sauber) → Fallback db push (robust).
# =============================================================================

set -e

if [ -n "${DATABASE_URL:-}" ]; then
  echo ">>> Prisma: Migrationen anwenden …"

  if npx prisma migrate deploy 2>&1; then
    echo ">>> Prisma: migrate deploy erfolgreich."
  else
    echo ">>> Prisma: migrate deploy fehlgeschlagen – Fallback auf db push …"
    npx prisma db push --skip-generate --accept-data-loss 2>&1
    echo ">>> Prisma: db push abgeschlossen."
  fi

  echo ">>> Prisma: Datenbankschema ist aktuell."
else
  echo ">>> DATABASE_URL nicht gesetzt – Prisma-Migrationen übersprungen."
fi

exec "$@"
