#!/bin/sh
# =============================================================================
# arsnova.eu – Docker Entrypoint (v5)
# 1. ensure-schema.js: Fehlende Spalten/Enums direkt per SQL sicherstellen
# 2. Optional: prisma db push als zusätzlicher Sync (mit --url)
# =============================================================================

echo ">>> Entrypoint v5 gestartet"

if [ -z "${DATABASE_URL:-}" ]; then
  echo ">>> WARNUNG: DATABASE_URL nicht gesetzt – DB-Sync übersprungen."
  exec "$@"
fi

echo ">>> DATABASE_URL vorhanden."

# ── Schritt 1: Direkte SQL-Sicherung (funktioniert immer) ──
echo ">>> Schritt 1: ensure-schema.js …"
node /app/scripts/ensure-schema.js 2>&1
ENSURE_EXIT=$?

if [ "$ENSURE_EXIT" -eq 0 ]; then
  echo ">>> Schritt 1: erfolgreich."
else
  echo ">>> Schritt 1: WARNUNG – Exit-Code $ENSURE_EXIT (App startet trotzdem)."
fi

# ── Schritt 2: Prisma db push mit expliziter URL (umgeht prisma.config.ts) ──
echo ">>> Schritt 2: prisma db push …"
npx prisma db push --accept-data-loss --url "$DATABASE_URL" 2>&1 || echo ">>> Schritt 2: prisma db push fehlgeschlagen (nicht kritisch)."

echo ">>> DB-Sync abgeschlossen."
exec "$@"
