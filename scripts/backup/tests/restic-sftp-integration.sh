#!/usr/bin/env bash

set -euo pipefail

[[ "${EUID:-$(id -u)}" -eq 0 ]] || {
  echo "Der SFTP-Integrationstest muss als root laufen." >&2
  exit 1
}

[[ -f /.dockerenv && "${ARSNOVA_BACKUP_TEST_CONTAINER:-}" == "1" ]] || {
  echo "Abbruch: Dieser destruktive Test darf nur im vorgesehenen Wegwerf-Container laufen." >&2
  exit 1
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WRAPPER="$SCRIPT_DIR/arsnova-restic.sh"
TEST_ROOT="$(mktemp -d)"
SSHD_PID_FILE="$TEST_ROOT/sshd.pid"

cleanup() {
  if [[ -f "$SSHD_PID_FILE" ]]; then
    kill "$(cat "$SSHD_PID_FILE")" >/dev/null 2>&1 || true
  fi
  rm -rf -- "$TEST_ROOT"
}
trap cleanup EXIT

for command_name in restic ssh sshd ssh-keygen; do
  command -v "$command_name" >/dev/null 2>&1 || {
    echo "Benötigtes Testkommando fehlt: $command_name" >&2
    exit 1
  }
done

ssh-keygen -q -t ed25519 -N "" -f "$TEST_ROOT/client-key"
install -m 0600 "$TEST_ROOT/client-key.pub" "$TEST_ROOT/authorized_keys"
ssh-keygen -q -t ed25519 -N "" -f "$TEST_ROOT/sshd-host-key"

install -d -m 0755 /run/sshd
/usr/sbin/sshd \
  -p 2222 \
  -h "$TEST_ROOT/sshd-host-key" \
  -o "PidFile=$SSHD_PID_FILE" \
  -o PermitRootLogin=yes \
  -o PasswordAuthentication=no \
  -o "AuthorizedKeysFile=$TEST_ROOT/authorized_keys" \
  -o StrictModes=no

cat >"$TEST_ROOT/ssh_config" <<EOF
Host arsnova-storagebox
  HostName 127.0.0.1
  User root
  Port 2222
  IdentityFile $TEST_ROOT/client-key
  IdentitiesOnly yes
  StrictHostKeyChecking no
  UserKnownHostsFile /dev/null
EOF

cat >"$TEST_ROOT/backup.env" <<EOF
RESTIC_REPOSITORY=sftp:arsnova-storagebox:$TEST_ROOT/restic-repository
RESTIC_PASSWORD_FILE=$TEST_ROOT/restic-password
ARSNOVA_BACKUP_SSH_CONFIG=$TEST_ROOT/ssh_config
EOF

printf 'integration-password\n' >"$TEST_ROOT/restic-password"
chmod 0600 "$TEST_ROOT/backup.env"
chmod 0600 "$TEST_ROOT/restic-password"
chmod 0600 "$TEST_ROOT/ssh_config"

ARSNOVA_BACKUP_CONFIG="$TEST_ROOT/backup.env" "$WRAPPER" init >/dev/null
ARSNOVA_BACKUP_CONFIG="$TEST_ROOT/backup.env" "$WRAPPER" snapshots --json |
  grep -Eq '^\[\]$'

test -f "$TEST_ROOT/restic-repository/config"
