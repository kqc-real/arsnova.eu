#!/usr/bin/env bash
# 1B-Labor, im app-host aus dem Repo-Checkout aufzurufen (ADR 1B-002, 1B-005):
#   1. App-Image bauen, in eine lokale Registry (nur 127.0.0.1:5000) pushen, Digest ablesen;
#   2. .env.production aus .env.production.example erzeugen (Secrets nur in der VM);
#   3. Migrationen wie scripts/deploy.sh, Start nach docker-compose.prod.yml ohne Profile;
#   4. warten, bis app healthy ist.
# Den LLM-Token liest das Skript von stdin (nur beim ersten Lauf), z. B. vom Laptop aus:
#   ssh labor@192.168.150.20 'sed -n "s/^OPEN_WEIGHT_LLM_TOKEN=//p" arsnova.eu/.env.llm' \
#     | ssh labor@192.168.150.10 'bash arsnova.eu/docs/referat-thema-1/evidenz/1B/app-start.sh'
# Release-Dateien werden nicht verändert. Abweichungen: ADR 1B-005.
set -euo pipefail
REPO="$(git -C "$(dirname "$(readlink -f "$0")")" rev-parse --show-toplevel)"
cd "$REPO"
LLM_URL="${LAB_LLM_URL:-http://192.168.150.20:8080}"
REG=127.0.0.1:5000/arsnova

echo "== Registry und App-Image"
docker start registry >/dev/null 2>&1 ||
  docker run -d --restart=always --name registry -p 127.0.0.1:5000:5000 registry:2.8.3 >/dev/null
# Tag nach dem letzten Commit außerhalb von docs/; Doku-Commits bauen nicht neu.
TAG="$REG:$(git log -1 --format=%h --abbrev=12 -- . ":(exclude)docs")"
# Netzfehler beim npm ci im Build sind vorübergehend (Befund 2026-11-12): bis zu 3 Versuche.
for i in 1 2 3; do
  docker image inspect "$TAG" >/dev/null 2>&1 && break
  docker build --pull --file Dockerfile --tag "$TAG" . || echo "Build $i fehlgeschlagen" >&2
done
docker image inspect "$TAG" >/dev/null
for i in 1 2 3 4 5; do docker push -q "$TAG" >/dev/null && break; echo "Push $i fehlgeschlagen" >&2; sleep 5; done
docker pull -q "$TAG" >/dev/null
IMAGE="$(docker image inspect --format '{{range .RepoDigests}}{{println .}}{{end}}' "$TAG" | grep -F "$REG@sha256:" | head -n 1)"
[[ -n "$IMAGE" ]] || { echo "Kein Registry-Digest für $TAG" >&2; exit 1; }
export ARSNOVA_IMAGE="$IMAGE"
# Build-Cache nach dem Build löschen: spart im app-host rund 6 GiB Platte (gemessen 2026-11-13).
docker builder prune -af >/dev/null 2>&1 || true

if [[ ! -f .env.production ]]; then
  echo "== .env.production erzeugen"
  read -r LLM_TOKEN || true
  # Windows PowerShell 5.1 hängt beim Pipen in ssh.exe CRLF an (labor.ps1).
  LLM_TOKEN="${LLM_TOKEN%$'\r'}"
  [[ "$LLM_TOKEN" =~ ^[A-Za-z0-9._~-]{32,512}$ ]] || { echo "LLM-Token fehlt auf stdin" >&2; exit 1; }
  pg="$(openssl rand -hex 24)"
  b64() { openssl rand -base64 "$1" | tr -d '\n'; }
  umask 077
  # Platzhalter und Laborwerte; alles Übrige bleibt wie in der Vorlage.
  sed -e "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$pg|" \
    -e "s|^DATABASE_URL=.*|DATABASE_URL=\"postgresql://arsnova_user:$pg@postgres:5432/arsnova_v3?schema=public\"|" \
    -e "s|^JWT_SECRET=.*|JWT_SECRET=$(b64 32)|" \
    -e "s|^CAPABILITY_ENVELOPE_KEY_BASE64=.*|CAPABILITY_ENVELOPE_KEY_BASE64=$(b64 32)|" \
    -e "s|^ADMIN_SECRET=.*|ADMIN_SECRET=$(b64 48)|" \
    -e "s|^ADMIN_DIAGNOSTIC_SECRET=.*|ADMIN_DIAGNOSTIC_SECRET=$(b64 48)|" \
    -e "s|^CSP_REPORT_HASH_SECRET=.*|CSP_REPORT_HASH_SECRET=$(b64 32)|" \
    -e "s|^PUBLIC_FRONTEND_URL=.*|PUBLIC_FRONTEND_URL=http://127.0.0.1:3000|" \
    -e "s|^QA_SUMMARY_ENABLED=.*|QA_SUMMARY_ENABLED=true|" \
    -e "s|^OPEN_WEIGHT_LLM_ENABLED=.*|OPEN_WEIGHT_LLM_ENABLED=true|" \
    -e "s|^OPEN_WEIGHT_LLM_URL=.*|OPEN_WEIGHT_LLM_URL=$LLM_URL|" \
    -e "s|^OPEN_WEIGHT_LLM_TOKEN=.*|OPEN_WEIGHT_LLM_TOKEN=$LLM_TOKEN|" \
    .env.production.example >.env.production
  unset LLM_TOKEN pg
  chmod 600 .env.production
  ! grep -qE '^[^#].*<' .env.production || { echo "Platzhalter übrig in .env.production" >&2; exit 1; }
fi
grep -E '^(PUBLIC_FRONTEND_URL|QA_SUMMARY_ENABLED|QA_SUMMARY_TIMEOUT_MS|OPEN_WEIGHT_LLM_(ENABLED|URL|SUMMARY_TIMEOUT_MS))=' .env.production

C=(docker compose -f docker-compose.prod.yml --env-file .env.production)
echo "== Migrationen (wie scripts/deploy.sh)"
# Images vorab holen; ein kurzer DNS-Ausfall brach am 2026-11-13 den Aufbau ab, Wiederholung hilft.
for i in 1 2 3 4 5; do "${C[@]}" pull -q postgres redis && break; echo "Pull $i fehlgeschlagen" >&2; sleep 30; done
"${C[@]}" up -d postgres redis --wait
"${C[@]}" run --rm --no-deps --entrypoint "" app \
  /app/node_modules/.bin/prisma migrate deploy --schema /app/prisma/schema.prisma

echo "== Start ohne Profile (kein nlp, encoder, llm)"
# Der Entrypoint bricht ab, wenn Redis die AOF-Bestätigung (WAITAOF) beim Rollout-Purge nicht
# rechtzeitig liefert (WORD_CLOUD_PURGE_DURABILITY_UNAVAILABLE, Befund 2026-11-12); restart: always
# startet die App neu. Darum bis zu 3 min auf healthy warten statt beim ersten unhealthy abzubrechen.
"${C[@]}" up -d --wait app pdf-worker || echo "App beim ersten Start nicht healthy, warte auf Neustart" >&2
for _ in $(seq 1 36); do
  [[ "$(docker inspect -f '{{.State.Health.Status}}' arsnova-v3-app)" == healthy ]] && break
  sleep 5
done
[[ "$(docker inspect -f '{{.State.Health.Status}}' arsnova-v3-app)" == healthy ]] || { echo "App nicht healthy" >&2; exit 1; }
echo "Neustarts der App: $(docker inspect -f '{{.RestartCount}}' arsnova-v3-app)"
echo "healthy; Image: $(docker inspect -f '{{.Config.Image}}' arsnova-v3-app)"
docker exec arsnova-v3-app wget -qO- http://localhost:3000/trpc/health.check
echo
