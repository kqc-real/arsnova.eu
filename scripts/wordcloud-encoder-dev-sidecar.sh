#!/usr/bin/env bash
# Host-npm: Word-Cloud-Encoder im Vordergrund fuer `npm run dev` (concurrently).
#
# Der Compose-Unix-Socket ist fuer Host-Node auf macOS unsichtbar. Deshalb
# veroeffentlicht dieser Dev-Container den Encoder ausschliesslich auf Loopback:
#   WORD_CLOUD_ENCODER_URL=http://127.0.0.1:8790/embed
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IMAGE="${WORD_CLOUD_ENCODER_DEV_IMAGE:-arsnova-wordcloud-encoder:e5-small}"
CONTAINER="${WORD_CLOUD_ENCODER_DEV_CONTAINER:-arsnova-wordcloud-encoder-local}"
PORT="${WORD_CLOUD_ENCODER_DEV_PORT:-8790}"

fail() {
  printf 'Fehler: %s\n' "$*" >&2
  exit 1
}

info() {
  printf '>>> %s\n' "$*"
}

print_usage() {
  cat <<'EOF'
Lokaler Word-Cloud-Encoder fuer npm run dev (Themenanalyse, Story 1.14c/1.14d)

Das Docker-Image enthaelt das multilinguale E5-ONNX-Modell. Der erste Build
laedt Modell und Python-Abhaengigkeiten; spaetere Starts verwenden den
Docker-Build-Cache.

  npm run encoder:dev

Standard-URL:       http://127.0.0.1:8790/embed
Standard-Image:     arsnova-wordcloud-encoder:e5-small
Standard-Container: arsnova-wordcloud-encoder-local

Das Backend in npm run dev / npm run dev:de / npm run dev:en aktiviert den
semantischen Themenpfad prozesslokal. Der Container laeuft im Vordergrund und
wird bei Ctrl+C zusammen mit dem Dev-Stack beendet und entfernt.
EOF
}

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  print_usage
  exit 0
fi

[[ "$PORT" =~ ^[0-9]+$ ]] && ((PORT >= 1 && PORT <= 65535)) \
  || fail "WORD_CLOUD_ENCODER_DEV_PORT muss zwischen 1 und 65535 liegen."

command -v docker >/dev/null 2>&1 || fail "Docker ist fuer den lokalen Encoder erforderlich."
docker info >/dev/null 2>&1 || fail "Docker ist nicht erreichbar. Bitte Docker Desktop starten."

# Ein abgebrochener vorheriger Dev-Lauf darf den festen Namen oder Port nicht
# blockieren. Es wird ausschliesslich der diesem Skript gehoerende Container
# entfernt; fremde Prozesse auf PORT bleiben unangetastet und fuehren beim
# anschliessenden docker run zu einer eindeutigen Bind-Fehlermeldung.
docker rm -f "$CONTAINER" >/dev/null 2>&1 || true

info "Bereite die KI für die Themenanalyse vor (Docker-Cache wird verwendet) ..."
docker build --quiet -t "$IMAGE" "$ROOT/docker/wordcloud-encoder" >/dev/null
info "Themenanalyse ist vorbereitet."

info "Starte die Themenanalyse auf http://127.0.0.1:$PORT/embed ..."
exec docker run --rm \
  --name "$CONTAINER" \
  --init \
  --read-only \
  --cap-drop ALL \
  --security-opt no-new-privileges:true \
  --pids-limit 64 \
  --memory 2g \
  --cpus 1.0 \
  --tmpfs /tmp:rw,noexec,nosuid,nodev,size=256m,mode=1777 \
  --no-healthcheck \
  -e WORD_CLOUD_ENCODER_HTTP_BIND=0.0.0.0:"$PORT" \
  -e WORD_CLOUD_ENCODER_MODEL_DIR=/models/e5-small \
  -p 127.0.0.1:"$PORT":"$PORT" \
  "$IMAGE"
