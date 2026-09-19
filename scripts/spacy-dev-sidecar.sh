#!/usr/bin/env bash
# Host-npm: spaCy-Sidecar im Vordergrund für `npm run dev` (concurrently).
#
# Docker-Volume /run/spacy/nlp.sock ist für Host-Node unsichtbar.
# Dieser Prozess spricht denselben Unix-Socket wie der macOS-Locale-Helfer:
#   NLP_SOCKET_PATH=/tmp/arsnova-nlp.sock
#
# Usage:
#   npm run spacy:dev
#   NLP_SOCKET_PATH=/tmp/arsnova-nlp.sock npm run spacy:dev
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOCKET="${NLP_SOCKET_PATH:-/tmp/arsnova-nlp.sock}"
VENV_DIR="${NLP_VENV:-}"
PYTHON_BIN=""

fail() {
  printf 'Fehler: %s\n' "$*" >&2
  exit 1
}

info() {
  printf '>>> %s\n' "$*"
}

print_usage() {
  cat <<'EOF'
Host-spaCy-Sidecar für npm run dev (Wortwolken-Glättung, Story 1.14b)

Startet server.py im Vordergrund auf einem Unix-Socket. Kein TCP-Port.
Docker-Volume /run/spacy/nlp.sock bleibt für Host-Node unsichtbar.

  npm run spacy:dev
  NLP_SOCKET_PATH=/tmp/arsnova-nlp.sock npm run spacy:dev

Standard-Socket: /tmp/arsnova-nlp.sock
Venv: docker/spacy/.venv (erster Lauf lädt de/en/fr/es, oft mehrere Minuten)
Python 3.10+ erforderlich.

Das Backend in npm run dev / npm run dev:de / npm run dev:en setzt dafür
NLP_ENABLED=true und denselben Socket. Produktiv bleibt NLP_ENABLED=false.
EOF
}

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  print_usage
  exit 0
fi

python_has_models() {
  "$1" -c 'import spacy; spacy.load("de_core_news_sm"); spacy.load("en_core_web_sm"); spacy.load("fr_core_news_sm"); spacy.load("es_core_news_sm")' \
    >/dev/null 2>&1
}

resolve_python() {
  local candidate
  if [[ -n "$VENV_DIR" ]]; then
    candidate="$VENV_DIR/bin/python"
    [[ -x "$candidate" ]] || fail "NLP_VENV hat kein python: $candidate"
    python_has_models "$candidate" || fail "NLP_VENV enthält nicht de/en/fr/es spaCy 3.8. Bitte venv neu anlegen."
    PYTHON_BIN="$candidate"
    return 0
  fi

  for candidate in \
    "$ROOT/docker/spacy/.venv/bin/python" \
    /tmp/arsnova-spacy-venv/bin/python; do
    if [[ -x "$candidate" ]] && python_has_models "$candidate"; then
      PYTHON_BIN="$candidate"
      return 0
    fi
  done

  return 1
}

ensure_python() {
  local venv_dir py
  if resolve_python; then
    return 0
  fi

  command -v python3 >/dev/null 2>&1 || fail \
    "python3 fehlt. Bitte Python 3.10+ installieren (z. B. brew install python@3.12)."
  python3 -c 'import sys; raise SystemExit(0 if sys.version_info >= (3, 10) else 1)' \
    || fail "Python 3.10+ erforderlich (gefunden: $(python3 --version 2>&1))."

  venv_dir="$ROOT/docker/spacy/.venv"
  info "Lege spaCy-venv an unter $venv_dir (erster Lauf lädt de/en/fr/es, oft mehrere Minuten) …"
  python3 -m venv "$venv_dir"
  py="$venv_dir/bin/python"
  "$py" -m pip install --upgrade pip
  "$py" -m pip install -r "$ROOT/docker/spacy/requirements.txt"
  python_has_models "$py" || fail "spaCy-Modelle de/en/fr/es konnten nicht geladen werden."
  PYTHON_BIN="$py"
}

ensure_python
info "Starte Host-Sidecar auf $SOCKET (Modelle laden, danach GET /health) …"
exec env NLP_SOCKET_PATH="$SOCKET" "$PYTHON_BIN" "$ROOT/docker/spacy/server.py"
