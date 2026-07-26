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

[[ "${EUID:-$(id -u)}" -eq 0 ]] || fail "Der Restore-Test muss als root laufen."
[[ -x "$RESTIC_WRAPPER" ]] || fail "Restic-Wrapper fehlt oder ist nicht ausführbar: $RESTIC_WRAPPER"
require_private_config

set -a
# shellcheck disable=SC1090
source "$CONFIG_FILE"
set +a

RESTORE_ROOT="/var/lib/arsnova-restore-check"
BACKUP_HOST="${RESTIC_HOST:-arsnova-production}"
POSTGRES_IMAGE="${ARSNOVA_RESTORE_POSTGRES_IMAGE:-postgres:16-alpine}"
POSTGRES_TMPFS_SIZE="${ARSNOVA_RESTORE_POSTGRES_TMPFS_SIZE:-1g}"
SUCCESS_MARKER="$RESTORE_ROOT/last-success"
RESTORE_TARGET="$RESTORE_ROOT/current"
LOCK_FILE="$RESTORE_ROOT/restore.lock"
CONTAINER_NAME="arsnova-restore-check-$$"
REPOSITORY_LOCK_FILE="/run/lock/arsnova-restic.lock"
REPOSITORY_LOCK_WAIT_SECONDS="${ARSNOVA_RESTIC_LOCAL_LOCK_WAIT_SECONDS:-1800}"

[[ "$RESTORE_ROOT" == /* && "$RESTORE_ROOT" != "/" ]] || fail "Ungültiges Restore-Verzeichnis: $RESTORE_ROOT"
[[ "$REPOSITORY_LOCK_WAIT_SECONDS" =~ ^[1-9][0-9]*$ ]] || fail "ARSNOVA_RESTIC_LOCAL_LOCK_WAIT_SECONDS muss eine positive Ganzzahl sein."

for command_name in docker find flock install sha256sum; do
  command -v "$command_name" >/dev/null 2>&1 || fail "Benötigtes Kommando fehlt: $command_name"
done

install -d -m 0700 "$RESTORE_ROOT"
exec 9>"$LOCK_FILE"
flock -n 9 || fail "Ein anderer Restore-Test läuft bereits."
exec 8>"$REPOSITORY_LOCK_FILE"
flock -w "$REPOSITORY_LOCK_WAIT_SECONDS" 8 || fail "Das Restic-Repository ist lokal noch durch einen anderen Job belegt."

cleanup() {
  docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
  rm -rf -- "$RESTORE_TARGET"
}
trap cleanup EXIT

rm -rf -- "$RESTORE_TARGET"
install -d -m 0700 "$RESTORE_TARGET"

echo ">>> Prüfe das externe Restic-Repository …"
ARSNOVA_BACKUP_CONFIG="$CONFIG_FILE" "$RESTIC_WRAPPER" check

echo ">>> Stelle den neuesten Produktions-Snapshot isoliert wieder her …"
ARSNOVA_BACKUP_CONFIG="$CONFIG_FILE" "$RESTIC_WRAPPER" restore latest \
  --host "$BACKUP_HOST" \
  --tag arsnova-production \
  --target "$RESTORE_TARGET"
flock -u 8

mapfile -d '' -t dump_files < <(find "$RESTORE_TARGET" -type f -name postgres.dump -print0)
mapfile -d '' -t manifest_files < <(find "$RESTORE_TARGET" -type f -name manifest.txt -print0)
mapfile -d '' -t env_files < <(find "$RESTORE_TARGET" -type f -path '*/config/env.production' -print0)

[[ "${#dump_files[@]}" -eq 1 ]] || fail "Erwartete genau einen PostgreSQL-Dump, gefunden: ${#dump_files[@]}"
[[ "${#manifest_files[@]}" -eq 1 ]] || fail "Erwartete genau ein Manifest, gefunden: ${#manifest_files[@]}"
[[ "${#env_files[@]}" -eq 1 && -s "${env_files[0]}" ]] || fail "Produktionskonfiguration fehlt im Snapshot."

dump_file="${dump_files[0]}"
manifest_file="${manifest_files[0]}"
expected_sha256="$(awk -F= '$1 == "postgres_dump_sha256" { print $2 }' "$manifest_file")"
actual_sha256="$(sha256sum "$dump_file" | awk '{print $1}')"
[[ -n "$expected_sha256" && "$actual_sha256" == "$expected_sha256" ]] || fail "SHA-256 des Dumps stimmt nicht mit dem Manifest überein."

echo ">>> Starte temporäres PostgreSQL ohne Netzwerk und ohne Produktions-Volume …"
docker run -d --rm \
  --name "$CONTAINER_NAME" \
  --network none \
  --user 70:70 \
  --read-only \
  --cap-drop ALL \
  --security-opt no-new-privileges:true \
  --pids-limit 128 \
  --memory 2g \
  --cpus 1 \
  --tmpfs "/var/lib/postgresql/data:rw,noexec,nosuid,nodev,size=$POSTGRES_TMPFS_SIZE,uid=70,gid=70,mode=0700" \
  --tmpfs /var/run/postgresql:rw,noexec,nosuid,nodev,size=16m,uid=70,gid=70,mode=0755 \
  --tmpfs /tmp:rw,noexec,nosuid,nodev,size=64m,uid=70,gid=70,mode=1777 \
  -e POSTGRES_HOST_AUTH_METHOD=trust \
  "$POSTGRES_IMAGE" >/dev/null

ready=false
for _ in {1..60}; do
  if docker exec "$CONTAINER_NAME" pg_isready -U postgres >/dev/null 2>&1; then
    ready=true
    break
  fi
  sleep 1
done
[[ "$ready" == "true" ]] || fail "Temporäres PostgreSQL wurde nicht rechtzeitig bereit."

docker exec "$CONTAINER_NAME" createdb -U postgres arsnova_restore_check
docker exec -i "$CONTAINER_NAME" pg_restore \
  --username=postgres \
  --dbname=arsnova_restore_check \
  --exit-on-error \
  --no-owner \
  --no-privileges \
  <"$dump_file" >/dev/null

public_tables="$(docker exec "$CONTAINER_NAME" psql -U postgres -d arsnova_restore_check -Atqc \
  "SELECT count(*) FROM pg_catalog.pg_tables WHERE schemaname = 'public';")"
core_tables="$(docker exec "$CONTAINER_NAME" psql -U postgres -d arsnova_restore_check -Atqc \
  "SELECT count(*) FROM (VALUES (to_regclass('public.\"Quiz\"')), (to_regclass('public.\"Session\"')), (to_regclass('public.\"AdminAuditLog\"'))) AS required(table_name) WHERE table_name IS NOT NULL;")"

[[ "$public_tables" =~ ^[1-9][0-9]*$ ]] || fail "Restore enthält keine öffentlichen Tabellen."
[[ "$core_tables" == "3" ]] || fail "Restore enthält nicht alle erwarteten Kerntabellen."

checked_at="$(date --utc +'%Y-%m-%dT%H:%M:%SZ')"
printf '%s\n' "$checked_at" >"$SUCCESS_MARKER"
chmod 0600 "$SUCCESS_MARKER"
echo ">>> Isolierter Restore-Test erfolgreich: $public_tables Tabellen, $checked_at"
