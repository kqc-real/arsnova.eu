#!/usr/bin/env bash
# Ermittelt die kanonische Digest-Referenz nach docker push.
# Primär aus dem Push-Log (digest: sha256:…), sonst aus RepoDigests.
# Usage: resolve-pushed-image-ref.sh <image-name> <pushed-tag> [push-log-file]
# Prints: <image-name>@sha256:<64-hex>
set -euo pipefail

IMAGE_NAME="${1:?image name required (e.g. ghcr.io/org/repo)}"
PUSHED_TAG="${2:?pushed tag required}"
PUSH_LOG_FILE="${3:-}"

DIGEST=''

if [[ -n "$PUSH_LOG_FILE" && -f "$PUSH_LOG_FILE" ]]; then
  DIGEST="$(
    grep -Eo 'digest: sha256:[0-9a-f]{64}' "$PUSH_LOG_FILE" \
      | awk '{print $2}' \
      | tail -1 \
      || true
  )"
fi

if [[ ! "$DIGEST" =~ ^sha256:[0-9a-f]{64}$ ]]; then
  while IFS= read -r entry; do
    [[ -z "$entry" ]] && continue
    if [[ "$entry" == "${IMAGE_NAME}@sha256:"* ]]; then
      DIGEST="${entry##*@}"
      break
    fi
  done < <(docker image inspect --format '{{range .RepoDigests}}{{println .}}{{end}}' "$PUSHED_TAG")
fi

if [[ ! "$DIGEST" =~ ^sha256:[0-9a-f]{64}$ ]]; then
  echo "Konnte keinen Registry-Digest für $PUSHED_TAG ermitteln." >&2
  if [[ -n "$PUSH_LOG_FILE" && -f "$PUSH_LOG_FILE" ]]; then
    echo "Push-Log:" >&2
    cat "$PUSH_LOG_FILE" >&2 || true
  fi
  exit 1
fi

echo "${IMAGE_NAME}@${DIGEST}"
