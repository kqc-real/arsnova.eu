#!/usr/bin/env bash
# Fail-fast: Docker-Build-Job muss nativ auf linux/arm64 laufen.
set -euo pipefail

EXPECTED_ARCH="${1:-arm64}"
IMAGE_REF="${2:-}"

normalize() {
  local raw
  raw="$(printf '%s' "${1:-}" | tr '[:upper:]' '[:lower:]' | tr -d '[:space:]')"
  case "$raw" in
    aarch64 | arm64) printf 'arm64\n' ;;
    x86_64 | amd64) printf 'amd64\n' ;;
    *) printf '%s\n' "$raw" ;;
  esac
}

runner_arch="$(normalize "$(uname -m)")"
docker_arch="$(normalize "$(docker info --format '{{.Architecture}}' 2>/dev/null || true)")"

echo "Runner uname -m → $runner_arch"
echo "docker info Architecture → $docker_arch"

if [[ "$runner_arch" != "$EXPECTED_ARCH" ]]; then
  echo "Fehler: Runner-Architektur ist $runner_arch, erwartet $EXPECTED_ARCH." >&2
  exit 1
fi
if [[ "$docker_arch" != "$EXPECTED_ARCH" ]]; then
  echo "Fehler: Docker-Hostarchitektur ist $docker_arch, erwartet $EXPECTED_ARCH." >&2
  exit 1
fi

if [[ -n "$IMAGE_REF" ]]; then
  image_arch="$(normalize "$(docker image inspect --format '{{.Architecture}}' "$IMAGE_REF")")"
  echo "Image $IMAGE_REF Architecture → $image_arch"
  if [[ "$image_arch" != "$EXPECTED_ARCH" ]]; then
    echo "Fehler: gebautes Image ist $image_arch, erwartet $EXPECTED_ARCH." >&2
    exit 1
  fi
fi

echo "Native ARM64-Nachweis OK."
