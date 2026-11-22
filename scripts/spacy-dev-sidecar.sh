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
Venv: docker/spacy/.venv (erster Lauf lädt de/en/fr/es/it, oft mehrere Minuten)
Python 3.10–3.13 erforderlich (python3.13 … python3.10 werden bevorzugt).

Das Backend in npm run dev / npm run dev:de / npm run dev:en setzt dafür
NLP_ENABLED=true und denselben Socket. Produktiv bleibt NLP_ENABLED=false.
EOF
}

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  print_usage
  exit 0
fi

python_has_models() {
  "$1" -c 'import spacy, spacy_lookups_data; spacy.load("de_core_news_sm"); spacy.load("en_core_web_sm"); spacy.load("fr_core_news_sm"); spacy.load("es_core_news_sm")' \
    >/dev/null 2>&1
}

resolve_python() {
  local candidate
  if [[ -n "$VENV_DIR" ]]; then
    candidate="$VENV_DIR/bin/python"
    [[ -x "$candidate" ]] || fail "NLP_VENV hat kein python: $candidate"
    python_has_models "$candidate" || fail "NLP_VENV fehlen spaCy-Sprachdaten für de/en/fr/es/it. Installiere docker/spacy/requirements.txt in diesem venv."
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

# spaCy 3.8.15 (docker/spacy/requirements.txt) hat keine Pakete für Python 3.14+.
python_in_supported_range() {
  "$1" -c 'import sys; raise SystemExit(0 if (3, 10) <= sys.version_info[:2] < (3, 14) else 1)' \
    >/dev/null 2>&1
}

ensure_python() {
  local venv_dir py candidate base_python=""
  if resolve_python; then
    return 0
  fi

  venv_dir="$ROOT/docker/spacy/.venv"
  py="$venv_dir/bin/python"
  if [[ -x "$py" ]] && python_in_supported_range "$py"; then
    info "Ergänze die Sprachdaten im vorhandenen spaCy-venv …"
  else
    # Der erste passende Interpreter kann ohne venv-Modul installiert sein
    # (Debian/Ubuntu: pythonX.Y-venv separat), daher den nächsten versuchen.
    for candidate in python3.13 python3.12 python3.11 python3.10 python3; do
      command -v "$candidate" >/dev/null 2>&1 || continue
      python_in_supported_range "$candidate" || continue
      info "Lege spaCy-venv mit $candidate an unter $venv_dir (erster Lauf lädt de/en/fr/es/it, oft mehrere Minuten) …"
      if "$candidate" -m venv --clear "$venv_dir"; then
        base_python="$candidate"
        break
      fi
      info "venv mit $candidate fehlgeschlagen (fehlt das venv-Paket, z. B. ${candidate}-venv?); versuche den nächsten Interpreter …"
    done
    [[ -n "$base_python" ]] || fail \
      "Python 3.10–3.13 mit venv-Modul erforderlich (spaCy 3.8.15 hat keine Pakete für Python 3.14+; gefunden: $(python3 --version 2>/dev/null || echo 'kein python3')). Bitte z. B. python3.13 installieren (brew install python@3.13; Debian/Ubuntu zusätzlich python3.13-venv)."
  fi
  "$py" -m pip install --upgrade pip
  "$py" -m pip install -r "$ROOT/docker/spacy/requirements.txt"
  python_has_models "$py" || fail "spaCy-Modelle de/en/fr/es/it konnten nicht geladen werden."
  PYTHON_BIN="$py"
}

ensure_python
info "Starte die Lemmatisierung (spaCy): Wörter werden auf ihre Grundform zurückgeführt. Die Sprachmodelle werden jetzt geladen …"
exec env NLP_SOCKET_PATH="$SOCKET" "$PYTHON_BIN" "$ROOT/docker/spacy/server.py"
