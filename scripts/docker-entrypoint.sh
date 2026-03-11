#!/bin/sh
# =============================================================================
# arsnova.eu – Docker Entrypoint (v4)
# 1. ensure-schema.js: Fehlende Spalten/Enums direkt per SQL sicherstellen
# 2. Optional: prisma db push als zusätzlicher Sync
# Kein Prisma-CLI-Parsing nötig – nutzt den funktionierenden PrismaClient.
# =============================================================================

echo ">>> Entrypoint v4 gestartet"

if [ -z "${DATABASE_URL:-}" ]; then
  echo ">>> WARNUNG: DATABASE_URL nicht gesetzt – DB-Sync übersprungen."
  exec "$@"
fi

echo ">>> DATABASE_URL vorhanden."
echo ">>> Schritt 1: ensure-schema.js – kritische Spalten/Enums sicherstellen …"

node /app/scripts/ensure-schema.js
ENSURE_EXIT=$?

if [ "$ENSURE_EXIT" -ne 0 ]; then
  echo ">>> WARNUNG: ensure-schema.js meldete Fehler (Exit: $ENSURE_EXIT)."
  echo ">>> App wird trotzdem gestartet."
fi

echo ">>> Schritt 2: prisma db push (optionaler vollständiger Sync) …"
npx prisma db push --skip-generate --accept-data-loss 2>&1 || true
echo ">>> DB-Sync abgeschlossen."

exec "$@"
