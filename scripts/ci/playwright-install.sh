#!/usr/bin/env bash
# Installiert ein Playwright-Browser mit Zeitlimit und Wiederholung.
# Hängende CDN- oder apt-Downloads sollen den CI-Job nicht bis timeout-minutes
# blockieren und als cancelled den Required-Check e2e rot färben.
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
per_attempt_sec="${PLAYWRIGHT_INSTALL_TIMEOUT_SEC:-180}"
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

attempt=1
while ((attempt <= max_attempts)); do
  echo "Playwright-Install $browser Versuch $attempt/$max_attempts (Timeout ${per_attempt_sec}s)"
  set +e
  "$timeout_bin" --kill-after=15s "${per_attempt_sec}s" node "$cli" install --with-deps "$browser"
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
  sleep "$retry_sleep_sec"
  attempt=$((attempt + 1))
done

echo "Playwright-Install $browser nach $max_attempts Versuchen fehlgeschlagen." >&2
exit 1
