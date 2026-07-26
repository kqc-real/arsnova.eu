#!/usr/bin/env bash

set -euo pipefail
umask 077

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RESTIC_WRAPPER="$SCRIPT_DIR/arsnova-restic.sh"
CONFIG_FILE="${ARSNOVA_BACKUP_CONFIG:-/etc/arsnova-backup/backup.env}"

fail() {
  echo "Fehler: $*" >&2
  exit 1
}

require_private_config() {
  local owner mode

  [[ -f "$CONFIG_FILE" ]] || fail "Backup-Konfiguration fehlt: $CONFIG_FILE"
  owner="$(stat -c '%u' "$CONFIG_FILE")"
  mode="$(stat -c '%a' "$CONFIG_FILE")"
  [[ "$owner" == "0" ]] || fail "Backup-Konfiguration muss root gehören: $CONFIG_FILE"
  if (( 8#$mode & 8#077 )); then
    fail "Backup-Konfiguration darf keine Gruppen-/Fremdrechte besitzen (aktuell $mode)."
  fi
}

[[ "${EUID:-$(id -u)}" -eq 0 ]] || fail "Das Backup muss als root laufen."
[[ -x "$RESTIC_WRAPPER" ]] || fail "Restic-Wrapper fehlt oder ist nicht ausführbar: $RESTIC_WRAPPER"
require_private_config

set -a
# shellcheck disable=SC1090
source "$CONFIG_FILE"
set +a

APP_DIR="${ARSNOVA_APP_DIR:-/home/deploy/arsnova.eu}"
POSTGRES_CONTAINER="${ARSNOVA_POSTGRES_CONTAINER:-arsnova-v3-postgres}"
STAGING_ROOT="${ARSNOVA_BACKUP_STAGING_DIR:-/var/lib/arsnova-backup}"
KEEP_DAILY="${ARSNOVA_BACKUP_KEEP_DAILY:-14}"
BACKUP_HOST="${RESTIC_HOST:-arsnova-production}"
SUCCESS_MARKER="${ARSNOVA_BACKUP_SUCCESS_MARKER:-$STAGING_ROOT/last-success}"
RUN_DIR="$STAGING_ROOT/current"
LOCK_FILE="$STAGING_ROOT/backup.lock"
REPOSITORY_LOCK_FILE="${ARSNOVA_RESTIC_LOCAL_LOCK_FILE:-/run/lock/arsnova-restic.lock}"
REPOSITORY_LOCK_WAIT_SECONDS="${ARSNOVA_RESTIC_LOCAL_LOCK_WAIT_SECONDS:-1800}"

[[ "$KEEP_DAILY" =~ ^[1-9][0-9]*$ ]] || fail "ARSNOVA_BACKUP_KEEP_DAILY muss eine positive Ganzzahl sein."
[[ "$REPOSITORY_LOCK_WAIT_SECONDS" =~ ^[1-9][0-9]*$ ]] || fail "ARSNOVA_RESTIC_LOCAL_LOCK_WAIT_SECONDS muss eine positive Ganzzahl sein."
[[ "$STAGING_ROOT" == /* && "$STAGING_ROOT" != "/" ]] || fail "Ungültiges Staging-Verzeichnis: $STAGING_ROOT"
[[ "$REPOSITORY_LOCK_FILE" == /* ]] || fail "ARSNOVA_RESTIC_LOCAL_LOCK_FILE muss ein absoluter Pfad sein."
[[ -f "$APP_DIR/.env.production" ]] || fail ".env.production fehlt unter $APP_DIR."

for command_name in docker flock install sha256sum; do
  command -v "$command_name" >/dev/null 2>&1 || fail "Benötigtes Kommando fehlt: $command_name"
done

install -d -m 0700 "$STAGING_ROOT"
exec 9>"$LOCK_FILE"
flock -n 9 || fail "Ein anderes Backup läuft bereits."

cleanup() {
  rm -rf -- "$RUN_DIR"
}
trap cleanup EXIT

rm -rf -- "$RUN_DIR"
install -d -m 0700 "$RUN_DIR/config"

echo ">>> Erzeuge konsistenten PostgreSQL-Dump …"
# Expansion erfolgt absichtlich erst in der Container-Shell.
# shellcheck disable=SC2016
docker exec "$POSTGRES_CONTAINER" sh -eu -c \
  'exec pg_dump --format=custom --compress=9 --no-owner --no-acl --username="$POSTGRES_USER" --dbname="$POSTGRES_DB"' \
  >"$RUN_DIR/postgres.dump"

[[ -s "$RUN_DIR/postgres.dump" ]] || fail "PostgreSQL-Dump ist leer."
docker exec -i "$POSTGRES_CONTAINER" pg_restore --list <"$RUN_DIR/postgres.dump" >/dev/null

echo ">>> Sichere verschlüsselt wiederherstellbare Produktionskonfiguration …"
install -m 0600 "$APP_DIR/.env.production" "$RUN_DIR/config/env.production"

postgres_version="$(docker exec "$POSTGRES_CONTAINER" postgres --version | tr -d '\r')"
created_at="$(date --utc +'%Y-%m-%dT%H:%M:%SZ')"
dump_sha256="$(sha256sum "$RUN_DIR/postgres.dump" | awk '{print $1}')"

cat >"$RUN_DIR/manifest.txt" <<EOF
created_at=$created_at
postgres_version=$postgres_version
postgres_dump_sha256=$dump_sha256
scope=postgres-and-production-config
EOF

exec 8>"$REPOSITORY_LOCK_FILE"
flock -w "$REPOSITORY_LOCK_WAIT_SECONDS" 8 || fail "Das Restic-Repository ist lokal noch durch einen anderen Job belegt."

echo ">>> Übertrage Snapshot verschlüsselt in das Offsite-Repository …"
ARSNOVA_BACKUP_CONFIG="$CONFIG_FILE" "$RESTIC_WRAPPER" backup "$RUN_DIR" \
  --host "$BACKUP_HOST" \
  --tag arsnova-production \
  --tag postgres

echo ">>> Wende die Retention von $KEEP_DAILY täglichen Snapshots an …"
ARSNOVA_BACKUP_CONFIG="$CONFIG_FILE" "$RESTIC_WRAPPER" forget \
  --host "$BACKUP_HOST" \
  --tag arsnova-production \
  --keep-daily "$KEEP_DAILY" \
  --prune

echo ">>> Prüfe Repository-Metadaten …"
ARSNOVA_BACKUP_CONFIG="$CONFIG_FILE" "$RESTIC_WRAPPER" check

printf '%s\n' "$created_at" >"$SUCCESS_MARKER"
chmod 0600 "$SUCCESS_MARKER"
echo ">>> Offsite-Backup erfolgreich: $created_at"
