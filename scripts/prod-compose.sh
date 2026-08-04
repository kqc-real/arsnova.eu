#!/usr/bin/env bash
# Operator-Wrapper: docker compose mit Secrets + persistiertem Digest-Image.
# Nach erfolgreichem Deploy schreibt scripts/deploy.sh .env.arsnova-image.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-.env.production}"
IMAGE_ENV_FILE="${IMAGE_ENV_FILE:-.env.arsnova-image}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Fehler: $ENV_FILE nicht gefunden." >&2
  exit 1
fi

args=(-f "$COMPOSE_FILE" --env-file "$ENV_FILE")
if [[ -f "$IMAGE_ENV_FILE" ]]; then
  args+=(--env-file "$IMAGE_ENV_FILE")
elif [[ -z "${ARSNOVA_IMAGE:-}" ]]; then
  echo "Fehler: weder $IMAGE_ENV_FILE noch ARSNOVA_IMAGE gesetzt." >&2
  echo "Nach Digest-Deploy schreibt deploy.sh $IMAGE_ENV_FILE automatisch." >&2
  echo "Manuell: ARSNOVA_IMAGE='ghcr.io/kqc-real/arsnova.eu@sha256:<64-hex>' $0 $*" >&2
  exit 1
fi

exec docker compose "${args[@]}" "$@"
