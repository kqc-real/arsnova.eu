#!/usr/bin/env bash
# macOS: Produktions-Build aller Locales, Host-spaCy-Sidecar, Seed für Freitext + Q&A.
#
# Docker-Volume /run/spacy/nlp.sock ist für Host-npm auf macOS nicht erreichbar.
# Dieses Skript räumt lokale Build-Artefakte und alte arsnova-Images auf,
# baut npm run build:prod (de/en/fr/es/it), startet start:prod plus Sidecar
# und serve:localize:api auf Port 4200 (kein ng serve).
#
# Usage:
#   npm run spacy:macos-dev
#   npm run spacy:macos-dev -- --code ABC123 --yes
#   SESSION_CODE=ABC123 npm run spacy:macos-dev -- --yes --skip-clean --skip-build
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOCKET="${NLP_SOCKET_PATH:-/tmp/arsnova-nlp.sock}"
SIDECAR_LOG="${NLP_SIDECAR_LOG:-/tmp/arsnova-nlp-sidecar.log}"
SIDECAR_PID_FILE="${NLP_SIDECAR_PID_FILE:-/tmp/arsnova-nlp-sidecar.pid}"
BACKEND_LOG="${NLP_BACKEND_LOG:-/tmp/arsnova-backend-nlp.log}"
FRONTEND_LOG="${NLP_FRONTEND_LOG:-/tmp/arsnova-frontend-localize.log}"
VENV_DIR="${NLP_VENV:-}"
TIMEOUT_MS="${NLP_TIMEOUT_MS:-15000}"

CODE=""
YES=0
DRY_RUN=0
KEEP_BACKEND=0
APPEND_QA=0
SKIP_CLEAN=0
SKIP_BUILD=0
HELP=0
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
macOS-Helfer: Clean, Produktions-Build aller Locales, spaCy-Sidecar, Seeds

WICHTIG — Demo-Quiz mit Freitextfrage:
  Nach dem Start eine Host-Session mit dem Demo-Quiz (Praxis-Showcase) anlegen.
  Im Quizkanal die Freitextfrage anzeigen (DE: „Was hilft dir beim Lernen?“).
  Ohne diese Freitextfrage kann seed:session-votes die Wortwolke nicht befüllen.

  Locales zum Experimentieren (kein ng serve; lokalisierter Dist):
    http://localhost:4200/de/   http://localhost:4200/en/
    http://localhost:4200/fr/   http://localhost:4200/es/
    http://localhost:4200/it/
  Gleicher Build auch unter http://localhost:3000/{de,en,fr,es,it}/
  Sprachformen glätten nur in de/en. fr/es/it zeigen bewusst
  „Glättung nicht verfügbar“.

Usage:
  npm run spacy:macos-dev
  npm run spacy:macos-dev -- --code ABC123 --yes
  SESSION_CODE=ABC123 npm run spacy:macos-dev -- --yes --skip-clean --skip-build

Optionen:
  --code <CODE>     6-stelliger Session-Code (sonst Abfrage nach dem Start)
  --yes             Hinweis bestätigen, ohne auf Enter zu warten
  --dry-run         Stack starten, Seeds nur prüfen, nichts schreiben
  --skip-clean      Dist, Caches und Docker-Images nicht löschen
  --skip-build      npm run build:prod überspringen (vorhandener Dist)
  --keep-backend    start:prod nicht neu starten
  --append-qa       Q&A-Fragen anhängen statt ersetzen
  --help            Diese Hilfe

Ablauf:
  1. Aufräumen: free-dev-ports, npm run clean:generated, spaCy-Container,
     lokale arsnova-/spaCy-Images, baumelnde Docker-Images (Postgres/Redis
     und ihre Volumes bleiben).
  2. docker:up:dev (Postgres/Redis), Host-Sidecar auf /tmp/arsnova-nlp.sock
  3. npm run build:prod (shared-types, Backend, Frontend de/en/fr/es/it)
  4. NLP_ENABLED in .env, npm run start:prod
  5. serve:localize:api auf Port 4200 (lokalisierter Dist + API-Proxy)
  6. seed:session-votes (Freitext) und seed:qa-forum (Default: ersetzen)
EOF
}

normalize_code() {
  printf '%s' "$1" | tr -d '[:space:]' | tr '[:lower:]' '[:upper:]'
}

is_session_code() {
  [[ "$1" =~ ^[A-Z0-9]{6}$ ]]
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --help | -h)
        HELP=1
        shift
        ;;
      --yes | -y)
        YES=1
        shift
        ;;
      --dry-run)
        DRY_RUN=1
        shift
        ;;
      --skip-clean)
        SKIP_CLEAN=1
        shift
        ;;
      --skip-build)
        SKIP_BUILD=1
        shift
        ;;
      --keep-backend)
        KEEP_BACKEND=1
        shift
        ;;
      --append-qa)
        APPEND_QA=1
        shift
        ;;
      --code)
        [[ $# -ge 2 ]] || fail "--code erwartet einen Session-Code."
        CODE="$(normalize_code "$2")"
        shift 2
        ;;
      --code=*)
        CODE="$(normalize_code "${1#--code=}")"
        shift
        ;;
      *)
        fail "Unbekannte Option: $1 (siehe --help)"
        ;;
    esac
  done
}

require_macos() {
  local uname_s
  uname_s="$(uname -s)"
  [[ "$uname_s" == "Darwin" ]] || fail \
    "Dieses Skript ist für macOS. Unter Linux den Sidecar im App-Container nutzen: npm run docker:up:nlp"
}

port_in_use() {
  lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1
}

wait_for_port() {
  local port="$1"
  local seconds="${2:-30}"
  local i
  i=0
  while [[ "$i" -lt "$seconds" ]]; do
    if port_in_use "$port"; then
      return 0
    fi
    sleep 1
    i=$((i + 1))
  done
  return 1
}

docker_available() {
  command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1
}

should_remove_docker_image() {
  local ref="$1"
  case "$ref" in
    arsnovaeu-spacy:* | arsnova-spacy:* | arsnova-eu:* | arsnovaeu-app:* | \
    arsnovaeu-spacy | arsnova-spacy | arsnova-eu | \
    */arsnova.eu:* | */arsnova.eu)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

clean_docker_images() {
  if ! docker_available; then
    info "Docker nicht erreichbar — Image-Bereinigung übersprungen."
    return 0
  fi

  info "Stoppe optionalen Docker-spaCy-Sidecar (Host-Socket ersetzt ihn) …"
  docker rm -f arsnova-v3-spacy >/dev/null 2>&1 || true

  info "Entferne lokale arsnova-/spaCy-Images …"
  local ref
  while IFS= read -r ref; do
    [[ -n "$ref" ]] || continue
    [[ "$ref" == "<none>:<none>" ]] && continue
    if should_remove_docker_image "$ref"; then
      docker rmi -f "$ref" >/dev/null 2>&1 || true
      info "  entfernt $ref"
    fi
  done <<EOF
$(docker images --format '{{.Repository}}:{{.Tag}}' 2>/dev/null || true)
EOF

  info "Entferne baumelnde Docker-Images …"
  docker image prune -f >/dev/null
}

clean_workspace() {
  info "Gebe Dev-Ports 3000/3001/3002/4200 frei …"
  node "$ROOT/scripts/free-dev-ports.mjs"
  info "Lösche generierte Artefakte (dist, .angular, coverage) …"
  npm run clean:generated
  clean_docker_images
}

ensure_postgres_redis() {
  if port_in_use 5432 && port_in_use 6379; then
    info "Postgres (5432) und Redis (6379) laufen bereits."
    return 0
  fi
  docker_available || fail "Postgres/Redis sind nicht erreichbar und Docker fehlt. Bitte npm run docker:up:dev."
  info "Starte Postgres und Redis …"
  npm run docker:up:dev
}

sidecar_healthy() {
  [[ -S "$SOCKET" ]] || return 1
  NLP_SOCKET_PATH="$SOCKET" "$1" "$ROOT/docker/spacy/healthcheck.py" >/dev/null 2>&1
}

python_has_models() {
  "$1" -c 'import spacy; spacy.load("de_core_news_sm"); spacy.load("en_core_web_sm")' \
    >/dev/null 2>&1
}

resolve_python() {
  local candidate
  if [[ -n "$VENV_DIR" ]]; then
    candidate="$VENV_DIR/bin/python"
    [[ -x "$candidate" ]] || fail "NLP_VENV hat kein python: $candidate"
    python_has_models "$candidate" || fail "NLP_VENV enthält nicht de/en spaCy 3.8. Bitte venv neu anlegen."
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

  command -v python3 >/dev/null 2>&1 || fail "python3 fehlt. Bitte Python 3.10+ installieren (z. B. brew install python@3.12)."
  python3 -c 'import sys; raise SystemExit(0 if sys.version_info >= (3, 10) else 1)' \
    || fail "Python 3.10+ erforderlich (gefunden: $(python3 --version 2>&1))."

  venv_dir="$ROOT/docker/spacy/.venv"
  info "Lege spaCy-venv an unter $venv_dir (erster Lauf lädt die MIT-Modelle de/en, oft 1-3 Minuten) …"
  python3 -m venv "$venv_dir"
  py="$venv_dir/bin/python"
  "$py" -m pip install --upgrade pip >/dev/null
  "$py" -m pip install -r "$ROOT/docker/spacy/requirements.txt"
  python_has_models "$py" || fail "spaCy-Modelle de/en konnten nicht geladen werden."
  PYTHON_BIN="$py"
}

start_sidecar() {
  local python_bin="$1"
  if sidecar_healthy "$python_bin"; then
    info "Sidecar läuft bereits ($SOCKET)."
    return 0
  fi

  if [[ -S "$SOCKET" ]]; then
    info "Entferne verwaisten Socket $SOCKET"
    rm -f "$SOCKET"
  fi
  if [[ -f "$SIDECAR_PID_FILE" ]]; then
    local old_pid
    old_pid="$(cat "$SIDECAR_PID_FILE" 2>/dev/null || true)"
    if [[ -n "${old_pid:-}" ]] && kill -0 "$old_pid" 2>/dev/null; then
      kill "$old_pid" 2>/dev/null || true
      sleep 1
    fi
    rm -f "$SIDECAR_PID_FILE"
  fi

  info "Starte Host-Sidecar auf $SOCKET …"
  : >"$SIDECAR_LOG"
  nohup env NLP_SOCKET_PATH="$SOCKET" "$python_bin" "$ROOT/docker/spacy/server.py" \
    >>"$SIDECAR_LOG" 2>&1 &
  echo $! >"$SIDECAR_PID_FILE"

  local i
  i=0
  while [[ "$i" -lt 90 ]]; do
    if sidecar_healthy "$python_bin"; then
      info "Sidecar ist bereit (GET /health -> 204)."
      return 0
    fi
    sleep 1
    i=$((i + 1))
  done
  fail "Sidecar wurde nicht gesund. Log: $SIDECAR_LOG"
}

upsert_env_var() {
  local file="$1"
  local key="$2"
  local value="$3"
  local tmp
  tmp="$(mktemp)"
  if [[ -f "$file" ]]; then
    awk -v k="$key" -v v="$value" '
      BEGIN { done = 0 }
      $0 ~ ("^" k "=") { print k "=" v; done = 1; next }
      { print }
      END { if (!done) print k "=" v }
    ' "$file" >"$tmp"
  else
    printf '%s=%s\n' "$key" "$value" >"$tmp"
  fi
  mv "$tmp" "$file"
}

ensure_env() {
  local env_file="$ROOT/.env"
  [[ -f "$env_file" ]] || fail "Lokale .env fehlt. Bitte .env.example nach .env kopieren."
  upsert_env_var "$env_file" "NLP_ENABLED" "true"
  upsert_env_var "$env_file" "NLP_SOCKET_PATH" "$SOCKET"
  upsert_env_var "$env_file" "NLP_TIMEOUT_MS" "$TIMEOUT_MS"
  info "Lokale .env: NLP_ENABLED=true, NLP_SOCKET_PATH=$SOCKET, NLP_TIMEOUT_MS=$TIMEOUT_MS"
}

load_nvm_if_present() {
  # Homebrew-npm und `npm run …` setzen npm_config_prefix (z. B. /opt/homebrew).
  # nvm lehnt das ab; vor dem Laden zurücksetzen.
  unset npm_config_prefix NPM_CONFIG_PREFIX
  if [[ -s "${NVM_DIR:-$HOME/.nvm}/nvm.sh" ]]; then
    # shellcheck disable=SC1090
    . "${NVM_DIR:-$HOME/.nvm}/nvm.sh"
    if [[ -f "$ROOT/.nvmrc" ]]; then
      nvm use
    fi
  fi
  command -v node >/dev/null 2>&1 || fail "node fehlt. Bitte Node aus .nvmrc nutzen."
  command -v npm >/dev/null 2>&1 || fail "npm fehlt."
}

require_localized_dist() {
  [[ -f "$ROOT/apps/frontend/dist/browser/de/index.html" ]] \
    && [[ -f "$ROOT/apps/frontend/dist/browser/en/index.html" ]] \
    && [[ -f "$ROOT/apps/frontend/dist/browser/fr/index.html" ]] \
    && [[ -f "$ROOT/apps/frontend/dist/browser/es/index.html" ]] \
    && [[ -f "$ROOT/apps/frontend/dist/browser/it/index.html" ]] \
    && [[ -f "$ROOT/apps/backend/dist/index.js" ]]
}

build_prod() {
  info "Baue Produktions-Frontend aller Locales (de/en/fr/es/it) plus Backend …"
  npm run build:prod
  require_localized_dist || fail "build:prod hat nicht alle Locale-Ausgaben erzeugt."
}

ensure_prod_hmac_secret() {
  if [[ -n "${YJS_SHARE_TOKEN_SECRET:-}" ]]; then
    export YJS_SHARE_TOKEN_SECRET
    return 0
  fi
  # Die lokale .env-Vorlage hat ein kurzes JWT_SECRET. start:prod (NODE_ENV=production)
  # verlangt mindestens 32 UTF-8-Bytes. Nur Prozessumgebung, nicht .env.
  YJS_SHARE_TOKEN_SECRET="$(
    node -e "process.stdout.write(require('crypto').randomBytes(32).toString('base64'))"
  )"
  export YJS_SHARE_TOKEN_SECRET
  info "Lokales YJS_SHARE_TOKEN_SECRET fuer start:prod gesetzt (JWT_SECRET in .env ist kuerzer als 32 Bytes)."
}

dump_backend_log() {
  if [[ -f "$BACKEND_LOG" ]]; then
    printf 'Letzte Zeilen aus %s:\n' "$BACKEND_LOG" >&2
    tail -n 30 "$BACKEND_LOG" >&2 || true
  fi
}

dump_frontend_log() {
  if [[ -f "$FRONTEND_LOG" ]]; then
    printf 'Letzte Zeilen aus %s:\n' "$FRONTEND_LOG" >&2
    tail -n 30 "$FRONTEND_LOG" >&2 || true
  fi
}

start_prod_backend() {
  info "Starte Produktions-Backend mit $(node -v) (liefert /de /en /fr /es /it aus dist) …"
  ensure_prod_hmac_secret
  node "$ROOT/scripts/free-dev-ports.mjs" --ports=3000,3001,3002 >/dev/null
  : >"$BACKEND_LOG"
  (
    cd "$ROOT" || exit 1
    export NLP_ENABLED=true
    export NLP_SOCKET_PATH="$SOCKET"
    export NLP_TIMEOUT_MS="$TIMEOUT_MS"
    export YJS_SHARE_TOKEN_SECRET
    exec node "$ROOT/scripts/start-backend-prod.mjs"
  ) >>"$BACKEND_LOG" 2>&1 &
  local bg_pid=$!
  local i
  i=0
  while [[ "$i" -lt 40 ]]; do
    if port_in_use 3000; then
      break
    fi
    if ! kill -0 "$bg_pid" 2>/dev/null; then
      dump_backend_log
      fail "Produktions-Backend ist beendet, Port 3000 bleibt leer. Log: $BACKEND_LOG"
    fi
    sleep 1
    i=$((i + 1))
  done
  if ! port_in_use 3000; then
    dump_backend_log
    fail "Backend lauscht nicht auf Port 3000. Log: $BACKEND_LOG"
  fi
  i=0
  while [[ "$i" -lt 40 ]]; do
    if curl -sf "http://127.0.0.1:3000/trpc/health.check" >/dev/null 2>&1; then
      info "Backend ist erreichbar (health.check)."
      return 0
    fi
    if ! kill -0 "$bg_pid" 2>/dev/null; then
      dump_backend_log
      fail "Produktions-Backend ist beendet. Log: $BACKEND_LOG"
    fi
    sleep 1
    i=$((i + 1))
  done
  dump_backend_log
  fail "Backend-Healthcheck fehlgeschlagen. Log: $BACKEND_LOG"
}

start_localize_frontend() {
  info "Starte lokalisierten Dist auf Port 4200 (serve:localize:api, kein ng serve) …"
  require_localized_dist || fail \
    "Kein vollständiger Locale-Build unter apps/frontend/dist/browser."
  node "$ROOT/scripts/free-dev-ports.mjs" --ports=4200 >/dev/null
  : >"$FRONTEND_LOG"
  (
    cd "$ROOT" || exit 1
    exec node "$ROOT/apps/frontend/scripts/serve-localized-with-api.mjs"
  ) >>"$FRONTEND_LOG" 2>&1 &
  local bg_pid=$!
  local i
  i=0
  while [[ "$i" -lt 20 ]]; do
    if port_in_use 4200; then
      info "Frontend ist erreichbar: http://localhost:4200/de/"
      return 0
    fi
    if ! kill -0 "$bg_pid" 2>/dev/null; then
      dump_frontend_log
      fail "Locale-Server ist beendet, Port 4200 bleibt leer. Log: $FRONTEND_LOG"
    fi
    sleep 1
    i=$((i + 1))
  done
  dump_frontend_log
  fail "Locale-Server lauscht nicht auf Port 4200. Log: $FRONTEND_LOG"
}

prompt_code_if_needed() {
  local raw attempt
  if [[ -n "$CODE" ]]; then
    is_session_code "$CODE" || fail "Ungültiger Session-Code ${CODE}. Erwartet: genau 6 Zeichen (A-Z, 0-9)."
    return 0
  fi
  if [[ -n "${SESSION_CODE:-}" ]]; then
    CODE="$(normalize_code "$SESSION_CODE")"
    is_session_code "$CODE" || fail "Ungültiger Session-Code in SESSION_CODE. Erwartet: genau 6 Zeichen (A-Z, 0-9)."
    return 0
  fi
  [[ -t 0 ]] || fail "Bitte einen 6-stelligen Session-Code angeben (--code ABC123 oder SESSION_CODE=ABC123)."
  cat <<'EOF'

Jetzt im Browser eine Host-Session mit dem Demo-Quiz starten
(Freitextfrage anzeigen), dann den Session-Code eingeben.

EOF
  attempt=0
  while [[ "$attempt" -lt 5 ]]; do
    printf 'Session-Code (6 Zeichen): '
    read -r raw
    CODE="$(normalize_code "$raw")"
    if is_session_code "$CODE"; then
      return 0
    fi
    printf 'Ungültig. Bitte genau 6 Zeichen (A-Z, 0-9) eingeben.\n'
    attempt=$((attempt + 1))
  done
  fail "Kein gültiger Session-Code eingegeben."
}

confirm_demo_quiz() {
  cat <<'EOF'

============================================================
  Clean + Produktions-Build aller Locales + spaCy-Seeds
============================================================
  1. Alte Dist-/Cache-Artefakte und lokale arsnova-Images werden
     gelöscht. Postgres/Redis-Daten bleiben.
  2. npm run build:prod erzeugt de/en/fr/es/it.
  3. Danach Host-Session mit dem Demo-Quiz starten.
     Quizkanal: Freitextfrage (DE: „Was hilft dir beim Lernen?“).
  4. Q&A-Kanal darf an sein (das Seed schaltet ihn sonst mit an).

  Ohne diese Freitextfrage kann die Wortwolke nicht befüllt werden.
============================================================

EOF
  if [[ "$YES" -eq 1 ]]; then
    return 0
  fi
  [[ -t 0 ]] || fail "Nicht-interaktiv: bitte --yes und --code ABC123 übergeben."
  printf 'Weiter mit Enter, Abbruch mit Ctrl+C … '
  read -r _
}

run_seeds() {
  # Q&A-Flags literal übergeben; lokale Flag-Variable ist unter set -u unzuverlässig.
  info "Befülle Quizkanal (Freitextfrage) — seed:session-votes …"
  if [[ "$DRY_RUN" -eq 1 ]]; then
    npm run seed:session-votes -w @arsnova/backend -- --code "$CODE" --dry-run
  else
    npm run seed:session-votes -w @arsnova/backend -- --code "$CODE"
  fi

  if [[ "$APPEND_QA" -eq 1 ]]; then
    info "Befülle Q&A-Kanal — seed:qa-forum --append …"
    if [[ "$DRY_RUN" -eq 1 ]]; then
      npm run seed:qa-forum -w @arsnova/backend -- --code "$CODE" --append --dry-run
    else
      npm run seed:qa-forum -w @arsnova/backend -- --code "$CODE" --append
    fi
  else
    info "Befülle Q&A-Kanal — seed:qa-forum --replace …"
    if [[ "$DRY_RUN" -eq 1 ]]; then
      npm run seed:qa-forum -w @arsnova/backend -- --code "$CODE" --replace --dry-run
    else
      npm run seed:qa-forum -w @arsnova/backend -- --code "$CODE" --replace
    fi
  fi
}

parse_args "$@"

if [[ "$HELP" -eq 1 ]]; then
  print_usage
  exit 0
fi

if [[ -n "$CODE" ]]; then
  is_session_code "$CODE" || fail "Ungültiger Session-Code ${CODE}. Erwartet: genau 6 Zeichen (A-Z, 0-9)."
fi

require_macos
cd "$ROOT"
confirm_demo_quiz
load_nvm_if_present

if [[ "$SKIP_CLEAN" -eq 1 ]]; then
  info "Aufräumen übersprungen (--skip-clean)."
else
  clean_workspace
fi

ensure_postgres_redis
ensure_python
info "Python: $PYTHON_BIN"
start_sidecar "$PYTHON_BIN"
ensure_env

if [[ "$SKIP_BUILD" -eq 1 ]]; then
  info "build:prod übersprungen (--skip-build)."
  require_localized_dist || fail \
    "Kein vollständiger Locale-Build unter apps/frontend/dist/browser. Ohne --skip-build starten."
else
  build_prod
fi

if [[ "$KEEP_BACKEND" -eq 1 ]]; then
  info "Backend bleibt unverändert (--keep-backend)."
  port_in_use 3000 || fail "Kein Backend auf Port 3000. --keep-backend weglassen oder start:prod selbst starten."
else
  start_prod_backend
fi

start_localize_frontend

prompt_code_if_needed
info "Session $CODE"
run_seeds

cat <<EOF

Fertig. Locales (hart neu laden):

  http://localhost:4200/de/   (Glättung an)
  http://localhost:4200/en/   (Glättung an)
  http://localhost:4200/fr/   (Glättung nicht verfügbar)
  http://localhost:4200/es/   (Glättung nicht verfügbar)
  http://localhost:4200/it/   (Glättung nicht verfügbar)

  Derselbe Build auch unter http://localhost:3000/{de,en,fr,es,it}/

  Quizkanal -> Freitextfrage -> Wortwolke -> Sprachformen glätten
  Q&A -> Wortwolke -> Einzelwörter / Sprachformen glätten

Sidecar-Log: $SIDECAR_LOG
Backend-Log: $BACKEND_LOG
Frontend-Log: $FRONTEND_LOG
EOF
