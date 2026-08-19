#!/usr/bin/env bash
# Installiert ein Playwright-Browser mit Zeitlimit für den Binary-Download
# und ohne --with-deps im Timeout-Pfad.
#
# `install --with-deps` startet apt-get als root außerhalb der timeout-
# Prozessgruppe. Ein 3–7-Minuten-Kill während apt-get update (langsamer
# azure.archive.ubuntu.com-Spiegel) hinterlässt den apt-Lock; Folgeversuche
# scheitern mit Exit 100 oder laufen in timeout-minutes.
#
# Deshalb: Binary-Download mit Retry, OS-Deps danach ohne kurzen Kill,
# auf GitHub-Runnern Ubuntu-Spiegel auf archive.ubuntu.com umbiegen.
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
per_attempt_sec="${PLAYWRIGHT_INSTALL_TIMEOUT_SEC:-420}"
retry_sleep_sec="${PLAYWRIGHT_INSTALL_RETRY_SLEEP_SEC:-5}"

if ! [[ "$max_attempts" =~ ^[1-9][0-9]*$ ]]; then
  echo "PLAYWRIGHT_INSTALL_ATTEMPTS muss eine positive Ganzzahl sein." >&2
  exit 2
fi
if ! [[ "$per_attempt_sec" =~ ^[1-9][0-9]*$ ]]; then
  echo "PLAYWRIGHT_INSTALL_TIMEOUT_SEC muss eine positive Ganzzahl sein." >&2
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

prefer_archive_ubuntu_mirrors() {
  if [[ "${GITHUB_ACTIONS:-}" != 'true' ]]; then
    return 0
  fi
  if ! command -v sudo >/dev/null 2>&1; then
    return 0
  fi
  echo "CI: Ubuntu-Spiegel von azure.archive.ubuntu.com auf archive.ubuntu.com umbiegen."
  local files=()
  local candidate
  for candidate in /etc/apt/sources.list /etc/apt/apt-mirrors.txt /etc/apt/sources.list.d/ubuntu.sources; do
    if [[ -f "$candidate" ]]; then
      files+=("$candidate")
    fi
  done
  shopt -s nullglob
  for candidate in /etc/apt/sources.list.d/*.list /etc/apt/sources.list.d/*.sources; do
    files+=("$candidate")
  done
  shopt -u nullglob
  if ((${#files[@]} == 0)); then
    return 0
  fi
  sudo sed -i 's/azure\.archive\.ubuntu\.com/archive.ubuntu.com/g' "${files[@]}" || true
}

prefer_archive_ubuntu_mirrors

attempt=1
while ((attempt <= max_attempts)); do
  echo "Playwright-Install $browser Versuch $attempt/$max_attempts (Timeout ${per_attempt_sec}s, nur Browser-Binary)"
  set +e
  "$timeout_bin" --kill-after=20s "${per_attempt_sec}s" node "$cli" install "$browser"
  status=$?
  set -e
  if ((status == 0)); then
    echo "Playwright-Browser $browser heruntergeladen."
    break
  fi
  echo "Playwright-Install $browser Versuch $attempt fehlgeschlagen (Exit $status)."
  if ((attempt == max_attempts)); then
    echo "Playwright-Install $browser nach $max_attempts Versuchen fehlgeschlagen." >&2
    exit 1
  fi
  sleep "$retry_sleep_sec"
  attempt=$((attempt + 1))
done

echo "Playwright-OS-Deps für $browser installieren (ohne kurzen Timeout)."
node "$cli" install-deps "$browser"
echo "Playwright-Install $browser erfolgreich."
