#!/usr/bin/env bash
# Checkt DEPLOY_SHA aus, bevor scripts/deploy.sh gestartet wird.
# Verhindert, dass der erste Post-Merge-Deploy noch das alte 1B-Skript (compose build) ausführt.
# shellcheck shell=bash
set -euo pipefail

DEPLOY_DIR="${DEPLOY_DIR:?DEPLOY_DIR required}"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-main}"
DEPLOY_SHA="${DEPLOY_SHA:?DEPLOY_SHA required}"

cd "$DEPLOY_DIR"

if ! command -v git >/dev/null 2>&1; then
  echo "Fehler: git fehlt auf dem Server." >&2
  exit 1
fi

if [[ ! "$DEPLOY_SHA" =~ ^[0-9a-f]{40}$ ]]; then
  echo "Fehler: ungültiger DEPLOY_SHA: $DEPLOY_SHA" >&2
  exit 1
fi

echo ">>> Bootstrap: hole und checke DEPLOY_SHA aus (${DEPLOY_SHA}) …"
git fetch --prune origin "$DEPLOY_BRANCH"

if ! git cat-file -e "${DEPLOY_SHA}^{commit}" 2>/dev/null; then
  git fetch origin "$DEPLOY_SHA"
fi

if ! git cat-file -e "${DEPLOY_SHA}^{commit}" 2>/dev/null; then
  echo "Fehler: Ziel-Commit $DEPLOY_SHA konnte nicht gefunden werden." >&2
  exit 1
fi

git checkout --detach --force "$DEPLOY_SHA"

checked_out_sha="$(git rev-parse HEAD)"
if [[ "$checked_out_sha" != "$DEPLOY_SHA" ]]; then
  echo "Fehler: Ausgecheckter Commit ($checked_out_sha) entspricht nicht DEPLOY_SHA ($DEPLOY_SHA)." >&2
  exit 1
fi

echo ">>> Bootstrap-Checkout OK ($(git log -1 --format='%h %s'))"
