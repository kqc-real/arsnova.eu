#!/usr/bin/env bash
# Lädt ein zuvor exportiertes Produktionsimage und prüft Image-ID sowie Archiv-SHA-256.
# Usage: load-production-image.sh <in-dir> <expected-github-sha>
set -euo pipefail

IN_DIR="${1:?input directory required}"
EXPECTED_GITHUB_SHA="${2:?expected github sha required}"
META_PATH="$IN_DIR/arsnova-eu-production.meta.json"

if [[ ! -f "$META_PATH" ]]; then
  echo "Metadatei fehlt: $META_PATH" >&2
  exit 1
fi

eval "$(
  python3 - "$META_PATH" "$EXPECTED_GITHUB_SHA" <<'PY'
import json
import sys

meta_path, expected_sha = sys.argv[1], sys.argv[2]
with open(meta_path, encoding="utf-8") as handle:
    meta = json.load(handle)

required = ("githubSha", "localTag", "imageId", "archiveFile", "archiveSha256")
missing = [key for key in required if not meta.get(key)]
if missing:
    raise SystemExit(f"Metadatei unvollständig, fehlt: {', '.join(missing)}")

if meta["githubSha"] != expected_sha:
    raise SystemExit(
        f"githubSha stimmt nicht: erwartet {expected_sha}, gefunden {meta['githubSha']}"
    )

if not str(meta["imageId"]).startswith("sha256:") or len(meta["imageId"]) < 70:
    raise SystemExit(f"Ungültige imageId: {meta['imageId']}")

if len(meta["archiveSha256"]) != 64:
    raise SystemExit(f"Ungültige archiveSha256: {meta['archiveSha256']}")

def emit(key: str, value: str) -> None:
    # Sichere Shell-Zuweisung ohne Newlines.
    if any(ch in value for ch in ("\n", "\r", "'")):
        raise SystemExit(f"Ungültiger Meta-Wert für {key}")
    print(f"{key}='{value}'")

emit("LOCAL_TAG", meta["localTag"])
emit("EXPECTED_IMAGE_ID", meta["imageId"])
emit("ARCHIVE_NAME", meta["archiveFile"])
emit("EXPECTED_ARCHIVE_SHA256", meta["archiveSha256"])
PY
)"

ARCHIVE_PATH="$IN_DIR/$ARCHIVE_NAME"
if [[ ! -f "$ARCHIVE_PATH" ]]; then
  echo "Archiv fehlt: $ARCHIVE_PATH" >&2
  exit 1
fi

ACTUAL_ARCHIVE_SHA256="$(sha256sum "$ARCHIVE_PATH" | awk '{print $1}')"
if [[ "$ACTUAL_ARCHIVE_SHA256" != "$EXPECTED_ARCHIVE_SHA256" ]]; then
  echo "Archiv-SHA-256 stimmt nicht:" >&2
  echo "  erwartet: $EXPECTED_ARCHIVE_SHA256" >&2
  echo "  gefunden: $ACTUAL_ARCHIVE_SHA256" >&2
  exit 1
fi

echo "Integrität Archiv ok (sha256=$ACTUAL_ARCHIVE_SHA256)."
echo "Lade Image aus Artefakt — kein docker build / build-push in diesem Job."

gzip -dc "$ARCHIVE_PATH" | docker load

LOADED_IMAGE_ID="$(docker image inspect --format '{{.Id}}' "$LOCAL_TAG")"
if [[ "$LOADED_IMAGE_ID" != "$EXPECTED_IMAGE_ID" ]]; then
  echo "Image-ID nach docker load stimmt nicht:" >&2
  echo "  erwartet: $EXPECTED_IMAGE_ID" >&2
  echo "  gefunden: $LOADED_IMAGE_ID" >&2
  exit 1
fi

echo "Image geladen: tag=$LOCAL_TAG imageId=$LOADED_IMAGE_ID"
echo "LOADED_TAG=$LOCAL_TAG"
echo "LOADED_IMAGE_ID=$LOADED_IMAGE_ID"
