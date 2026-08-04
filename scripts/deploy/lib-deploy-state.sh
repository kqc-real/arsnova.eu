#!/usr/bin/env bash
# Hilfsfunktionen: nicht versionierter Deploy-State (current/previous image+sha).
# shellcheck shell=bash

deploy_state_dir() {
  local repo_root="${1:?repo_root required}"
  local deploy_dir="${2:-}"
  if [[ -n "$deploy_dir" ]]; then
    printf '%s\n' "${deploy_dir%/}/.deploy-state"
  else
    printf '%s\n' "${repo_root%/}/.deploy-state"
  fi
}

ensure_deploy_state_dir() {
  local state_dir="${1:?}"
  mkdir -p "$state_dir"
  chmod 0700 "$state_dir"
}

write_atomic_state_file() {
  local dest="${1:?}"
  local content="${2:?}"
  local dir tmp
  dir="$(dirname "$dest")"
  ensure_deploy_state_dir "$dir"
  tmp="$(mktemp "${dir}/.tmp.XXXXXX")"
  printf '%s\n' "$content" >"$tmp"
  chmod 0600 "$tmp"
  mv -f "$tmp" "$dest"
  chmod 0600 "$dest"
}

read_state_file() {
  local path="${1:?}"
  if [[ ! -f "$path" ]]; then
    return 1
  fi
  tr -d '[:space:]' <"$path"
}

# Rotiert erst nach erfolgreichem Deploy: altes current → previous, neu → current.
rotate_deploy_state() {
  local state_dir="${1:?}"
  local new_image="${2:?}"
  local new_sha="${3:?}"
  local current_image current_sha

  ensure_deploy_state_dir "$state_dir"

  current_image="$(read_state_file "${state_dir}/current.image" || true)"
  current_sha="$(read_state_file "${state_dir}/current.sha" || true)"

  if [[ -n "$current_image" && -n "$current_sha" ]]; then
    write_atomic_state_file "${state_dir}/previous.image" "$current_image"
    write_atomic_state_file "${state_dir}/previous.sha" "$current_sha"
  fi

  write_atomic_state_file "${state_dir}/current.image" "$new_image"
  write_atomic_state_file "${state_dir}/current.sha" "$new_sha"
}

load_previous_deploy_state() {
  local state_dir="${1:?}"
  local image_var="${2:?}"
  local sha_var="${3:?}"
  local prev_image prev_sha

  prev_image="$(read_state_file "${state_dir}/previous.image" || true)"
  prev_sha="$(read_state_file "${state_dir}/previous.sha" || true)"

  if [[ -z "$prev_image" || -z "$prev_sha" ]]; then
    echo "Fehler: Kein gültiger Previous-Deploy-State unter ${state_dir}." >&2
    echo "" >&2
    echo "Image-Rollback benötigt previous.image und previous.sha aus einem" >&2
    echo "zuvor erfolgreichen Digest-Deploy. github.event.before ist kein Ersatz." >&2
    echo "" >&2
    echo "Manuelles Rollback (Beispiel):" >&2
    echo "  DEPLOY_IMAGE='ghcr.io/kqc-real/arsnova.eu@sha256:<64-hex>' \\" >&2
    echo "  DEPLOY_SHA='<40-hex-commit>' \\" >&2
    echo "  ./scripts/deploy.sh" >&2
    echo "" >&2
    echo "Hinweis: Image-Rollback setzt keine Datenbankmigrationen zurück." >&2
    return 1
  fi

  printf -v "$image_var" '%s' "$prev_image"
  printf -v "$sha_var" '%s' "$prev_sha"
}
