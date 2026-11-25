#!/usr/bin/env bash
# Renders docs/referat-thema-1/diagrams/<name>.mmd to <name>.light.svg and <name>.dark.svg with a pinned mermaid-cli, in a container
# without network access. Each SVG records the hash of what it was made from (source, palette, theme, this script and
# the image), so a stale SVG can be told from a current one. Adapted from agent-loadout's docs/diagrams/render.sh.
# Usage: docs/referat-thema-1/diagrams/render.sh [NAME...]  (no NAME: every diagram). Needs podman (or docker: DIAGRAMS_ENGINE=docker).
set -euo pipefail
# version for people, digest (the multi-platform index) so a re-pushed tag cannot change the output
IMAGE="ghcr.io/mermaid-js/mermaid-cli/mermaid-cli:11.16.0@sha256:29077c6bd02f14bdfdd5fee552d9c00fe68d4fab3cd84952d21e2d1faf2fadaf"
dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
engine="${DIAGRAMS_ENGINE:-podman}"
cd "$dir"

sha256() { if command -v sha256sum >/dev/null; then sha256sum; else shasum -a 256; fi | cut -d' ' -f1; }

names=()
for a in "$@"; do names+=("${a%.mmd}"); done
if [ ${#names[@]} -eq 0 ]; then
  for f in *.mmd; do case "$f" in palette.*) ;; *) names+=("${f%.mmd}") ;; esac; done
fi
for n in "${names[@]}"; do
  case "$n" in palette.* | */* | "") echo "not a diagram: $n" >&2; exit 2 ;; esac
  [ -f "$n.mmd" ] || { echo "no such diagram: $n (expected docs/referat-thema-1/diagrams/$n.mmd)" >&2; exit 2; }
done

# write the SVGs as the calling user (rootless podman maps it into the container with keep-id)
user=(--user "$(id -u):$(id -g)")
if [ "$(basename "$engine")" = podman ] && [ "$(id -u)" != 0 ]; then user=(--userns=keep-id "${user[@]}"); fi
work="$(mktemp -d "$dir/.render.XXXXXX")"
trap 'rm -rf "$work"' EXIT
w="$(basename "$work")"

for n in "${names[@]}"; do
  for v in light dark; do
    # the "%% palette" line becomes this variant's classDef lines
    awk -v pal="palette.$v.mmd" '
      /^[[:space:]]*%% palette[[:space:]]*$/ { while ((getline l < pal) > 0) print l; close(pal); next }
      { print }' "$n.mmd" >"$work/$n.$v.mmd"
    "$engine" run --rm --network=none "${user[@]}" -e HOME=/tmp -v "$dir:/data" "$IMAGE" \
      -i "$w/$n.$v.mmd" -o "$w/$n.$v.svg" -c "theme.$v.json" -b transparent --quiet
    hash="$({ cat "$n.mmd" "palette.$v.mmd" "theme.$v.json" render.sh | tr -d '\r'; printf '%s' "$IMAGE"; } | sha256)"
    awk -v c="<!-- diagram-source sha256:$hash -->" '
      !done && match($0, /<svg[^>]*>/) { $0 = substr($0, 1, RSTART + RLENGTH - 1) c substr($0, RSTART + RLENGTH); done = 1 }
      { print }' "$work/$n.$v.svg" >"$work/$n.$v.stamped"
    grep -q "diagram-source sha256:$hash" "$work/$n.$v.stamped" || { echo "no <svg> tag in the output for $n ($v)" >&2; exit 1; }
    mv "$work/$n.$v.stamped" "$n.$v.svg"
    echo "wrote docs/referat-thema-1/diagrams/$n.$v.svg"
  done
done
