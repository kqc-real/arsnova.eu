#!/usr/bin/env bash
# Operator-Wrapper: docker compose mit Secrets + persistiertem Digest-Image.
# Nach erfolgreichem Deploy schreibt scripts/deploy.sh .env.arsnova-image.
#
# Wenn .env.arsnova-image existiert, ist deren ARSNOVA_IMAGE maßgeblich
# (Shell-Umgebung wird überschrieben). Compose priorisiert sonst die Shell
# gegenüber --env-file und würde einen veralteten Digest unbemerkt nutzen.
#
# Fresh-Host / Disaster-Recovery: fehlt die Image-Env noch, setzt dieser Wrapper
# einen dokumentierten Infra-Placeholder, damit Compose (z. B. `up -d postgres`)
# überhaupt geparst werden kann. App/pdf-worker dürfen damit nicht gestartet
# werden — reguläres Digest-Deploy schreibt danach die echte Referenz.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-.env.production}"
IMAGE_ENV_FILE="${IMAGE_ENV_FILE:-.env.arsnova-image}"
# Nur für Compose-Interpolation auf Fresh-Hosts ohne Deploy-State.
# Kein gültiges Deploy-Ziel (deploy.sh lehnt ab); Pull von app/pdf-worker schlägt fehl.
ARSNOVA_COMPOSE_INFRA_PLACEHOLDER="${ARSNOVA_COMPOSE_INFRA_PLACEHOLDER:-ghcr.io/kqc-real/arsnova.eu@sha256:0000000000000000000000000000000000000000000000000000000000000000}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Fehler: $ENV_FILE nicht gefunden." >&2
  exit 1
fi

read_image_env_file() {
  local path="${1:?}"
  local line value
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
    if [[ "$line" =~ ^ARSNOVA_IMAGE=(.*)$ ]]; then
      value="${BASH_REMATCH[1]}"
      # optionale Anführungszeichen entfernen
      value="${value#\"}"
      value="${value%\"}"
      value="${value#\'}"
      value="${value%\'}"
      printf '%s\n' "$value"
      return 0
    fi
  done <"$path"
  return 1
}

args=(-f "$COMPOSE_FILE" --env-file "$ENV_FILE")
if [[ -f "$IMAGE_ENV_FILE" ]]; then
  if ! ARSNOVA_IMAGE="$(read_image_env_file "$IMAGE_ENV_FILE")"; then
    echo "Fehler: $IMAGE_ENV_FILE enthält kein ARSNOVA_IMAGE=…" >&2
    exit 1
  fi
  if [[ -z "$ARSNOVA_IMAGE" ]]; then
    echo "Fehler: ARSNOVA_IMAGE in $IMAGE_ENV_FILE ist leer." >&2
    exit 1
  fi
  # Explizit exportieren, damit Shell-Override den persistierten Digest nicht gewinnt.
  export ARSNOVA_IMAGE
  args+=(--env-file "$IMAGE_ENV_FILE")
elif [[ -n "${ARSNOVA_IMAGE:-}" ]]; then
  export ARSNOVA_IMAGE
else
  export ARSNOVA_IMAGE="$ARSNOVA_COMPOSE_INFRA_PLACEHOLDER"
  echo "Warnung: weder $IMAGE_ENV_FILE noch ARSNOVA_IMAGE gesetzt." >&2
  echo "  Infra-Placeholder aktiv — nur postgres/redis (Disaster-Recovery/Fresh-Host)." >&2
  echo "  App/pdf-worker erst nach Digest-Deploy starten (schreibt $IMAGE_ENV_FILE)." >&2
fi

exec docker compose "${args[@]}" "$@"
