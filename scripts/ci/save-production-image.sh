#!/usr/bin/env bash
# Speichert ein lokales Produktionsimage als komprimiertes CI-Artefakt inkl. Integritätsmeta.
# Usage: save-production-image.sh <local-tag> <out-dir> <github-sha>
set -euo pipefail

LOCAL_TAG="${1:?local image tag required}"
OUT_DIR="${2:?output directory required}"
GITHUB_SHA="${3:?github sha required}"

mkdir -p "$OUT_DIR"
ARCHIVE_NAME='arsnova-eu-production.tar.gz'
META_NAME='arsnova-eu-production.meta.json'
ARCHIVE_PATH="$OUT_DIR/$ARCHIVE_NAME"
META_PATH="$OUT_DIR/$META_NAME"

if ! docker image inspect "$LOCAL_TAG" >/dev/null 2>&1; then
  echo "Image nicht gefunden: $LOCAL_TAG" >&2
  exit 1
fi

IMAGE_ID="$(docker image inspect --format '{{.Id}}' "$LOCAL_TAG")"
echo "Exportiere Image $LOCAL_TAG (imageId=$IMAGE_ID) — kein zweiter Build."

docker save "$LOCAL_TAG" | gzip -1 >"$ARCHIVE_PATH"
ARCHIVE_SHA256="$(sha256sum "$ARCHIVE_PATH" | awk '{print $1}')"

python3 - "$META_PATH" "$GITHUB_SHA" "$LOCAL_TAG" "$IMAGE_ID" "$ARCHIVE_NAME" "$ARCHIVE_SHA256" <<'PY'
import json
import sys

meta_path, github_sha, local_tag, image_id, archive_name, archive_sha256 = sys.argv[1:]
payload = {
    "githubSha": github_sha,
    "localTag": local_tag,
    "imageId": image_id,
    "archiveFile": archive_name,
    "archiveSha256": archive_sha256,
}
with open(meta_path, "w", encoding="utf-8") as handle:
    json.dump(payload, handle, indent=2, sort_keys=True)
    handle.write("\n")
PY

echo "Archiv geschrieben: $ARCHIVE_PATH"
echo "archiveSha256=$ARCHIVE_SHA256"
echo "imageId=$IMAGE_ID"
