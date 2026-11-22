#!/usr/bin/env bash
set -euo pipefail

root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
cd "$root"
if [[ $# -gt 1 ]]; then
  echo 'Aufruf: ./scripts/build-text-sidecars.sh [git-ref]' >&2
  exit 2
fi
revision=$(git rev-parse --verify --end-of-options "${1:-HEAD}^{commit}")
context=$(mktemp -d)
trap 'rm -rf -- "$context"' EXIT
git archive "$revision" docker/spacy docker/wordcloud-encoder | tar -xf - -C "$context"

for sidecar in spacy wordcloud-encoder; do
  tag="arsnova-$sidecar:$revision"
  docker build --label "org.opencontainers.image.revision=$revision" --tag "$tag" "$context/docker/$sidecar"
  printf '%s %s\n' "$tag" "$(docker image inspect --format '{{.Id}}' "$tag")"
done
