#!/usr/bin/env bash
# Installiert ein Playwright-Browser mit Zeitlimit und Wiederholung.
# Hängende CDN-Downloads sollen den CI-Job nicht bis timeout-minutes blockieren.
# `--with-deps` startet apt-get als root außerhalb der timeout-Prozessgruppe;
# nach einem Timeout muss der apt-Lock freigegeben werden, sonst scheitern
# Folgeversuche mit Exit 100.
# Usage: playwright-install.sh <chromium|webkit|firefox>
set -euo pipefail

browser="${1:-}"
case "$browser" in
  chromium | webkit | firefox) ;;
  *)
    echo "Usage: $0 <chromium|webkit|firefox>" >&2
    exit 2
    ;;
esac

cli="${PLAYWRIGHT_CLI:-node_modules/playwright/cli.js}"
timeout_bin="${PLAYWRIGHT_TIMEOUT_BIN:-timeout}"
max_attempts="${PLAYWRIGHT_INSTALL_ATTEMPTS:-3}"
# 3 Minuten waren zu knapp: langsames apt-get update (Azure-Spiegel) wurde
# abgewürgt, obwohl noch Fortschritt da war.
per_attempt_sec="${PLAYWRIGHT_INSTALL_TIMEOUT_SEC:-420}"
retry_sleep_sec="${PLAYWRIGHT_INSTALL_RETRY_SLEEP_SEC:-5}"
apt_lock_wait_sec="${PLAYWRIGHT_APT_LOCK_WAIT_SEC:-90}"

if ! [[ "$max_attempts" =~ ^[1-9][0-9]*$ ]]; then
  echo "PLAYWRIGHT_INSTALL_ATTEMPTS muss eine positive Ganzzahl sein." >&2
  exit 2
fi
if ! [[ "$per_attempt_sec" =~ ^[1-9][0-9]*$ ]]; then
  echo "PLAYWRIGHT_INSTALL_TIMEOUT_SEC muss eine positive Ganzzahl sein." >&2
  exit 2
fi
if ! [[ "$apt_lock_wait_sec" =~ ^[0-9]+$ ]]; then
  echo "PLAYWRIGHT_APT_LOCK_WAIT_SEC muss eine nichtnegative Ganzzahl sein." >&2
  exit 2
fi

if [[ ! -e "$cli" ]]; then
  echo "Playwright CLI nicht gefunden: $cli" >&2
  exit 1
fi

if [[ ! -x "$timeout_bin" ]] && ! command -v "$timeout_bin" >/dev/null 2>&1; then
  echo "timeout-Kommando nicht gefunden: $timeout_bin" >&2
  exit 1
fi

apt_lock_paths=(
  /var/lib/apt/lists/lock
  /var/lib/dpkg/lock-frontend
  /var/lib/dpkg/lock
)

apt_lock_held() {
  local lock
  for lock in "${apt_lock_paths[@]}"; do
    if [[ -e "$lock" ]] && command -v fuser >/dev/null 2>&1 && fuser "$lock" >/dev/null 2>&1; then
      return 0
    fi
    if [[ "${GITHUB_ACTIONS:-}" == 'true' ]] && command -v sudo >/dev/null 2>&1; then
      if [[ -e "$lock" ]] && sudo fuser "$lock" >/dev/null 2>&1; then
        return 0
      fi
    fi
  done
  return 1
}

release_stale_apt_locks() {
  local waited=0
  if ((apt_lock_wait_sec > 0)); then
    while ((waited < apt_lock_wait_sec)); do
      if ! apt_lock_held; then
        return 0
      fi
      echo "apt-Lock noch gehalten, warte (${waited}s/${apt_lock_wait_sec}s)…"
      sleep 5
      waited=$((waited + 5))
    done
  fi
  if ! apt_lock_held; then
    return 0
  fi
  if [[ "${GITHUB_ACTIONS:-}" != 'true' ]] || ! command -v sudo >/dev/null 2>&1; then
    echo "apt-Lock weiterhin gehalten, kein CI-sudo verfügbar."
    return 0
  fi
  echo "apt-Lock nach ${apt_lock_wait_sec}s noch gehalten — beende blockierende Prozesse."
  local lock
  for lock in "${apt_lock_paths[@]}"; do
    sudo fuser -k -TERM "$lock" >/dev/null 2>&1 || true
  done
  sleep 2
  for lock in "${apt_lock_paths[@]}"; do
    sudo fuser -k -KILL "$lock" >/dev/null 2>&1 || true
  done
}

attempt=1
while ((attempt <= max_attempts)); do
  echo "Playwright-Install $browser Versuch $attempt/$max_attempts (Timeout ${per_attempt_sec}s)"
  set +e
  "$timeout_bin" --kill-after=20s "${per_attempt_sec}s" node "$cli" install --with-deps "$browser"
  status=$?
  set -e
  if ((status == 0)); then
    echo "Playwright-Install $browser erfolgreich."
    exit 0
  fi
  echo "Playwright-Install $browser Versuch $attempt fehlgeschlagen (Exit $status)."
  if ((attempt == max_attempts)); then
    break
  fi
  release_stale_apt_locks
  sleep "$retry_sleep_sec"
  attempt=$((attempt + 1))
done

echo "Playwright-Install $browser nach $max_attempts Versuchen fehlgeschlagen." >&2
exit 1
