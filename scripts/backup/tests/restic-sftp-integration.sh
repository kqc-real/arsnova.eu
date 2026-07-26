#!/usr/bin/env bash

set -euo pipefail

[[ "${EUID:-$(id -u)}" -eq 0 ]] || {
  echo "Der SFTP-Integrationstest muss als root laufen." >&2
  exit 1
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WRAPPER="$SCRIPT_DIR/arsnova-restic.sh"
TEST_USER="arsnova_restic_test"
TEST_HOME="/home/$TEST_USER"
SSHD_PID_FILE="/run/arsnova-restic-test-sshd.pid"

cleanup() {
  if [[ -f "$SSHD_PID_FILE" ]]; then
    kill "$(cat "$SSHD_PID_FILE")" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

for command_name in restic ssh sshd ssh-keygen useradd; do
  command -v "$command_name" >/dev/null 2>&1 || {
    echo "Benötigtes Testkommando fehlt: $command_name" >&2
    exit 1
  }
done

useradd -m -s /bin/bash "$TEST_USER"
echo "$TEST_USER:test-password" | chpasswd
install -d -o "$TEST_USER" -g "$TEST_USER" -m 0700 "$TEST_HOME/.ssh"

ssh-keygen -q -t ed25519 -N "" -f /tmp/arsnova-restic-client-key
install -o "$TEST_USER" -g "$TEST_USER" -m 0600 \
  /tmp/arsnova-restic-client-key.pub \
  "$TEST_HOME/.ssh/authorized_keys"

ssh-keygen -A >/dev/null
install -d -m 0755 /run/sshd
/usr/sbin/sshd -p 2222 -o "PidFile=$SSHD_PID_FILE"

install -d -m 0700 /etc/arsnova-backup
cat >/etc/arsnova-backup/ssh_config <<'EOF'
Host arsnova-storagebox
  HostName 127.0.0.1
  User arsnova_restic_test
  Port 2222
  IdentityFile /tmp/arsnova-restic-client-key
  IdentitiesOnly yes
  StrictHostKeyChecking no
  UserKnownHostsFile /dev/null
EOF

cat >/etc/arsnova-backup/backup.env <<'EOF'
RESTIC_REPOSITORY=sftp:arsnova-storagebox:restic-repository
RESTIC_PASSWORD_FILE=/etc/arsnova-backup/restic-password
ARSNOVA_BACKUP_SSH_CONFIG=/etc/arsnova-backup/ssh_config
EOF

printf 'integration-password\n' >/etc/arsnova-backup/restic-password
chmod 0600 /etc/arsnova-backup/backup.env
chmod 0600 /etc/arsnova-backup/restic-password
chmod 0600 /etc/arsnova-backup/ssh_config

ARSNOVA_BACKUP_CONFIG=/etc/arsnova-backup/backup.env "$WRAPPER" init >/dev/null
ARSNOVA_BACKUP_CONFIG=/etc/arsnova-backup/backup.env "$WRAPPER" snapshots --json |
  grep -Eq '^\[\]$'

test -f "$TEST_HOME/restic-repository/config"
