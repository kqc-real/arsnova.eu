#!/usr/bin/env bash

set -euo pipefail

CONFIG_FILE="${ARSNOVA_BACKUP_CONFIG:-/etc/arsnova-backup/backup.env}"

fail() {
  echo "Fehler: $*" >&2
  exit 1
}

require_root_owned_private_file() {
  local path="$1"
  local label="$2"
  local owner mode

  [[ -f "$path" ]] || fail "$label fehlt: $path"
  owner="$(stat -c '%u' "$path")"
  mode="$(stat -c '%a' "$path")"

  [[ "$owner" == "0" ]] || fail "$label muss root gehören: $path"
  if (( 8#$mode & 8#077 )); then
    fail "$label darf keine Gruppen-/Fremdrechte besitzen (aktuell $mode): $path"
  fi
}

command -v restic >/dev/null 2>&1 || fail "restic ist nicht installiert."
command -v ssh >/dev/null 2>&1 || fail "ssh ist nicht installiert."

require_root_owned_private_file "$CONFIG_FILE" "Backup-Konfiguration"

set -a
# Die Datei ist root-owned und darf deshalb als kontrollierte Shell-Konfiguration
# geladen werden. Zugangsdaten gehören ausschließlich in diese Serverdatei.
# shellcheck disable=SC1090
source "$CONFIG_FILE"
set +a

: "${RESTIC_REPOSITORY:?RESTIC_REPOSITORY fehlt in $CONFIG_FILE}"
: "${RESTIC_PASSWORD_FILE:?RESTIC_PASSWORD_FILE fehlt in $CONFIG_FILE}"
: "${ARSNOVA_BACKUP_SSH_CONFIG:?ARSNOVA_BACKUP_SSH_CONFIG fehlt in $CONFIG_FILE}"

require_root_owned_private_file "$RESTIC_PASSWORD_FILE" "Restic-Passwortdatei"
require_root_owned_private_file "$ARSNOVA_BACKUP_SSH_CONFIG" "SSH-Konfiguration"

exec restic \
  -o "sftp.command=ssh -F ${ARSNOVA_BACKUP_SSH_CONFIG} arsnova-storagebox -s sftp" \
  "$@"
