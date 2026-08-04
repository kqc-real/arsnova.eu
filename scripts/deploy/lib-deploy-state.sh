#!/usr/bin/env bash
# Hilfsfunktionen: nicht versionierter Deploy-State als atomare Snapshots.
# Jeder Snapshot enthält Image und SHA gemeinsam (eine Datei, ein rename).
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

# Schreibt KEY=VALUE-Paare atomar in eine Snapshot-Datei.
write_atomic_snapshot() {
  local dest="${1:?}"
  local image="${2:?}"
  local sha="${3:?}"
  local dir tmp
  dir="$(dirname "$dest")"
  ensure_deploy_state_dir "$dir"
  tmp="$(mktemp "${dir}/.tmp.XXXXXX")"
  {
    printf 'IMAGE=%s\n' "$image"
    printf 'SHA=%s\n' "$sha"
  } >"$tmp"
  chmod 0600 "$tmp"
  mv -f "$tmp" "$dest"
  chmod 0600 "$dest"
}

# Liest IMAGE und SHA aus einem Snapshot. Return 1 wenn fehlend/ungültig.
read_snapshot() {
  local path="${1:?}"
  local image_var="${2:?}"
  local sha_var="${3:?}"
  local image='' sha='' line key value

  if [[ ! -f "$path" ]]; then
    return 1
  fi

  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ -z "$line" || "$line" =~ ^# ]] && continue
    key="${line%%=*}"
    value="${line#*=}"
    case "$key" in
      IMAGE) image="$value" ;;
      SHA) sha="$value" ;;
    esac
  done <"$path"

  if [[ -z "$image" || -z "$sha" ]]; then
    return 1
  fi

  printf -v "$image_var" '%s' "$image"
  printf -v "$sha_var" '%s' "$sha"
}

# Nach erfolgreichem Normal-Deploy:
# - identisches Image/SHA → previous unverändert (Idempotenz)
# - sonst: altes current → previous (ein Snapshot), neues current (ein Snapshot)
# Abbruch zwischen den beiden renames hinterlässt höchstens den alten konsistenten Zustand
# plus ggf. eine unreferenzierte Temp-Datei; nie ein gemischtes Image/SHA-Paar.
rotate_deploy_state() {
  local state_dir="${1:?}"
  local new_image="${2:?}"
  local new_sha="${3:?}"
  local current_image='' current_sha=''

  ensure_deploy_state_dir "$state_dir"

  if read_snapshot "${state_dir}/current.state" current_image current_sha; then
    if [[ "$current_image" == "$new_image" && "$current_sha" == "$new_sha" ]]; then
      # Idempotenter Redeploy: previous bleibt der letzte bekannte andere Stand.
      write_atomic_snapshot "${state_dir}/current.state" "$new_image" "$new_sha"
      return 0
    fi
    write_atomic_snapshot "${state_dir}/previous.state" "$current_image" "$current_sha"
  fi

  write_atomic_snapshot "${state_dir}/current.state" "$new_image" "$new_sha"
}

# Nach erfolgreichem Rollback auf previous:
# current wird der wiederhergestellte Stand; previous wird NICHT auf den
# fehlgeschlagenen Release gesetzt (sonst würde erneutes --rollback ihn wieder aktivieren).
commit_rollback_deploy_state() {
  local state_dir="${1:?}"
  local restored_image="${2:?}"
  local restored_sha="${3:?}"

  ensure_deploy_state_dir "$state_dir"
  write_atomic_snapshot "${state_dir}/current.state" "$restored_image" "$restored_sha"
}

load_previous_deploy_state() {
  local state_dir="${1:?}"
  local image_var="${2:?}"
  local sha_var="${3:?}"
  local prev_image='' prev_sha=''

  if ! read_snapshot "${state_dir}/previous.state" prev_image prev_sha; then
    echo "Fehler: Kein gültiger Previous-Deploy-State unter ${state_dir}." >&2
    echo "" >&2
    echo "Image-Rollback nach erfolgreichem Digest-Deploy benötigt previous.state" >&2
    echo "(Image+SHA gemeinsam). github.event.before ist kein Ersatz." >&2
    echo "" >&2
    echo "Bei unvollständigem Deploy (State noch auf dem letzten OK-Stand):" >&2
    echo "  ./scripts/deploy.sh --recover" >&2
    echo "" >&2
    echo "Manuelles Deploy (Beispiel):" >&2
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

load_current_deploy_state() {
  local state_dir="${1:?}"
  local image_var="${2:?}"
  local sha_var="${3:?}"
  local cur_image='' cur_sha=''

  if ! read_snapshot "${state_dir}/current.state" cur_image cur_sha; then
    echo "Fehler: Kein gültiger Current-Deploy-State unter ${state_dir}." >&2
    echo "" >&2
    echo "--recover stellt den zuletzt erfolgreich verifizierten Stand wieder her." >&2
    echo "Ohne current.state ist kein automatisches Recover möglich." >&2
    echo "" >&2
    echo "Hinweis: Image-Recover setzt keine Datenbankmigrationen zurück." >&2
    return 1
  fi

  printf -v "$image_var" '%s' "$cur_image"
  printf -v "$sha_var" '%s' "$cur_sha"
}

# Persistiert die aktive Image-Referenz für Operator-Compose (--env-file).
write_operator_image_env() {
  local repo_root="${1:?}"
  local image="${2:?}"
  local dest="${repo_root%/}/.env.arsnova-image"
  local tmp
  tmp="$(mktemp "${repo_root}/.env.arsnova-image.tmp.XXXXXX")"
  printf 'ARSNOVA_IMAGE=%s\n' "$image" >"$tmp"
  chmod 0600 "$tmp"
  mv -f "$tmp" "$dest"
  chmod 0600 "$dest"
}
