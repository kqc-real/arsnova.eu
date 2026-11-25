#!/usr/bin/env bash
# Nur im app-host; wird beim ausdrücklich freigegebenen Label-Lauf aufgerufen.
set -euo pipefail
REPO="$(git -C "$(dirname "$(readlink -f "$0")")" rev-parse --show-toplevel)"
cd "$REPO"
ip -j -4 addr show | jq -e 'any(.[].addr_info[]; .local == "192.168.150.10")' >/dev/null ||
  { echo 'Label-Einrichtung ausschließlich im app-host.' >&2; exit 1; }
[[ -f .env.production ]] || { echo 'App zuerst einrichten.' >&2; exit 1; }
image=arsnova-wordcloud-encoder:e5-small
docker image inspect "$image" >/dev/null 2>&1 || docker build -t "$image" docker/wordcloud-encoder
# Encoder hat im Produktionsprofil vier CPUs; höchstens die tatsächlich vorhandenen
# vCPUs erlauben. App/Redis/Postgres behalten ihre Produktionslimits.
umask 077
override="$HOME/labor-1b/encoder.override.yml"
mkdir -p "$HOME/labor-1b"
printf 'services:\n  wordcloud-encoder:\n    cpus: "%s"\n' "$(nproc)" >"$override"
export ARSNOVA_IMAGE="$(docker inspect -f '{{.Config.Image}}' arsnova-v3-app)"
export WORD_CLOUD_ENCODER_IMAGE="$image"
C=(docker compose -f docker-compose.prod.yml -f "$override" --env-file .env.production --profile encoder)
"${C[@]}" up -d --wait wordcloud-encoder
# Flag erst nach dem erfolgreichen Encoder-Start aktivieren.
grep -q '^WORD_CLOUD_SEMANTIC_ENABLED=' .env.production
sed -i 's/^WORD_CLOUD_SEMANTIC_ENABLED=.*/WORD_CLOUD_SEMANTIC_ENABLED=true/' .env.production
"${C[@]}" up -d --wait --no-deps app
# Nur Image-ID, keine Konfiguration oder Tokens ausgeben.
docker inspect -f '{{.Image}}' arsnova-v3-wordcloud-encoder
