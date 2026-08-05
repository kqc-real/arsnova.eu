#!/usr/bin/env bash
# Architektur-Hilfen für Digest-Deploy (Produktion: linux/arm64).
# shellcheck shell=bash

# Aktuelle Produktion akzeptiert ausschließlich arm64-Hosts und -Images.
ARSNOVA_REQUIRED_DEPLOY_ARCH="${ARSNOVA_REQUIRED_DEPLOY_ARCH:-arm64}"

normalize_docker_arch() {
  local raw
  raw="$(printf '%s' "${1:-}" | tr '[:upper:]' '[:lower:]' | tr -d '[:space:]')"
  case "$raw" in
    aarch64 | arm64) printf 'arm64\n' ;;
    x86_64 | amd64) printf 'amd64\n' ;;
    '') printf '\n' ;;
    *) printf '%s\n' "$raw" ;;
  esac
}

is_known_deploy_arch() {
  local arch
  arch="$(normalize_docker_arch "${1:-}")"
  [[ "$arch" == "arm64" || "$arch" == "amd64" ]]
}

docker_host_architecture() {
  local raw
  raw="$(docker info --format '{{.Architecture}}' 2>/dev/null || true)"
  normalize_docker_arch "$raw"
}

image_architecture() {
  local ref="${1:?image ref required}"
  local raw
  raw="$(docker image inspect --format '{{.Architecture}}' "$ref" 2>/dev/null || true)"
  normalize_docker_arch "$raw"
}

# Prüft Host- und Imagearchitektur nach dem Pull, vor jeder Compose-Änderung.
# Bei Fehler: klare Meldung, kein Container-Recreate, kein State-/Env-Schreiben.
require_image_compatible_with_host() {
  local image_ref="${1:?}"
  local required="${2:-$ARSNOVA_REQUIRED_DEPLOY_ARCH}"
  local host_arch image_arch

  required="$(normalize_docker_arch "$required")"
  # Erneut normalisieren, falls Aufrufer/Mocks Aliase liefern.
  host_arch="$(normalize_docker_arch "$(docker_host_architecture)")"
  image_arch="$(normalize_docker_arch "$(image_architecture "$image_ref")")"

  if [[ -z "$host_arch" ]]; then
    echo "Fehler: Docker-Hostarchitektur ist leer oder unbekannt." >&2
    echo "Abbruch vor Migration und Änderung laufender App-Container." >&2
    return 1
  fi
  if [[ -z "$image_arch" ]]; then
    echo "Fehler: Image-Architektur für $image_ref ist leer oder unbekannt." >&2
    echo "Abbruch vor Migration und Änderung laufender App-Container." >&2
    return 1
  fi
  if ! is_known_deploy_arch "$host_arch"; then
    echo "Fehler: unbekannte Docker-Hostarchitektur: $host_arch" >&2
    echo "Abbruch vor Migration und Änderung laufender App-Container." >&2
    return 1
  fi
  if ! is_known_deploy_arch "$image_arch"; then
    echo "Fehler: unbekannte Image-Architektur: $image_arch" >&2
    echo "Abbruch vor Migration und Änderung laufender App-Container." >&2
    return 1
  fi
  if [[ "$required" != "arm64" ]]; then
    echo "Fehler: erforderliche Produktionsarchitektur muss arm64 sein (ist: $required)." >&2
    echo "Abbruch vor Migration und Änderung laufender App-Container." >&2
    return 1
  fi
  if [[ "$host_arch" != "$required" ]]; then
    echo "Fehler: Docker-Hostarchitektur $host_arch ist nicht die erforderliche Produktionsarchitektur $required." >&2
    echo "Abbruch vor Migration und Änderung laufender App-Container." >&2
    return 1
  fi
  if [[ "$image_arch" != "$host_arch" ]]; then
    echo "Fehler: Image-Architektur $image_arch ist mit Docker-Hostarchitektur $host_arch nicht kompatibel." >&2
    echo "Abbruch vor Migration und Änderung laufender App-Container." >&2
    return 1
  fi

  echo ">>> Architektur-Preflight OK (Host=$host_arch, Image=$image_arch, erforderlich=$required)."
}
