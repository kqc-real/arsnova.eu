#!/usr/bin/env bash
# Hilfsfunktionen: kanonische Digest-Image-Referenz für Produktion.
# shellcheck shell=bash

ARSNOVA_CANONICAL_IMAGE_RE='^ghcr\.io/kqc-real/arsnova\.eu@sha256:[0-9a-f]{64}$'
ARSNOVA_DEPLOY_SHA_RE='^[0-9a-f]{40}$'

is_canonical_deploy_image() {
  local ref="${1:-}"
  [[ "$ref" =~ $ARSNOVA_CANONICAL_IMAGE_RE ]]
}

is_valid_deploy_sha() {
  local sha="${1:-}"
  [[ "$sha" =~ $ARSNOVA_DEPLOY_SHA_RE ]]
}

require_canonical_deploy_image() {
  local ref="${1:-}"
  local label="${2:-DEPLOY_IMAGE}"
  if [[ -z "$ref" ]]; then
    echo "Fehler: $label fehlt. Erwartet: ghcr.io/kqc-real/arsnova.eu@sha256:<64-hex>" >&2
    return 1
  fi
  if ! is_canonical_deploy_image "$ref"; then
    echo "Fehler: ungültige $label: $ref" >&2
    echo "Erwartet genau: ghcr.io/kqc-real/arsnova.eu@sha256:<64-hex>" >&2
    return 1
  fi
}

require_valid_deploy_sha() {
  local sha="${1:-}"
  local label="${2:-DEPLOY_SHA}"
  if [[ -z "$sha" ]]; then
    echo "Fehler: $label fehlt. Erwartet: 40-stelliger Hex-Commit-SHA." >&2
    return 1
  fi
  if ! is_valid_deploy_sha "$sha"; then
    echo "Fehler: ungültiger $label: $sha" >&2
    echo "Erwartet: genau 40 Hex-Zeichen (a-f0-9)." >&2
    return 1
  fi
}
