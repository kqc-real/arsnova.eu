#!/usr/bin/env bash
set -euo pipefail
umask 077

root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
state_dir="$root/.deploy-state"
state_file="$state_dir/text-sidecars.env"
probe="$root/deploy/text-analysis-readiness.mjs"

usage() {
  cat <<'EOF'
Aufruf: ./scripts/prod-text-sidecars.sh apply <spaCy-Digest> <Encoder-Digest>
        ./scripts/prod-text-sidecars.sh --rollback
        ./scripts/prod-text-sidecars.sh --recover

Akzeptiert lokale sha256:…-Image-IDs und vorgeladene Registry-Digests.
EOF
}

mode=${1:-}
case "$mode:$#" in
  apply:3|--rollback:1|--recover:1) ;;
  --help:1|-h:1) usage; exit 0 ;;
  *) usage >&2; exit 2 ;;
esac

fail() { printf '%s\n' "$*" >&2; exit 1; }

compose() {
  "$root/scripts/prod-compose.sh" --profile nlp --profile encoder --profile app-replicas --profile app-third "$@"
}

digest_pattern='^([a-z0-9][a-z0-9._:/-]*@)?sha256:[0-9a-f]{64}$'
is_digest() { [[ "$1" =~ $digest_pattern ]]; }

image_id() {
  is_digest "$1" || { echo "Unveränderliche Image-Referenz erforderlich: $1" >&2; return 1; }
  docker image inspect --format '{{.Id}}' "$1"
}

running_image() {
  local container
  container=$(compose ps --status running --quiet "$1") || return 1
  [[ -n "$container" ]] || return 1
  docker inspect --format '{{.Image}}' "$container"
}

spacy='' encoder='' previous_spacy='' previous_encoder='' pending=false
if [[ "$mode" == apply ]]; then
  next_spacy=$2
  next_encoder=$3
  next_spacy_id=$(image_id "$next_spacy") || fail 'spaCy-Kandidat zuerst bauen oder laden.'
  next_encoder_id=$(image_id "$next_encoder") || fail 'Encoder-Kandidat zuerst bauen oder laden.'
fi

# shellcheck disable=SC1091
source "$root/scripts/deploy/lib-operation-lock.sh"
lock_operation "$root" sidecars

if [[ -f "$state_file" ]]; then
  while IFS='=' read -r key value; do
    case "$key" in
      SPACY_IMAGE) spacy=$value ;;
      WORD_CLOUD_ENCODER_IMAGE) encoder=$value ;;
      PREVIOUS_SPACY_IMAGE) previous_spacy=$value ;;
      PREVIOUS_ENCODER_IMAGE) previous_encoder=$value ;;
      TEXT_SIDECARS_PENDING) pending=$value ;;
      *) fail 'Sidecar-Deploy-Status ungültig.' ;;
    esac
  done < "$state_file"
  if ! is_digest "$spacy" || ! is_digest "$encoder"; then
    fail 'Sidecar-Deploy-Status ungültig.'
  fi
  if [[ -n "$previous_spacy$previous_encoder" ]]; then
    if ! is_digest "$previous_spacy" || ! is_digest "$previous_encoder"; then
      fail 'Sidecar-Rollback-Status ungültig.'
    fi
  fi
  [[ "$pending" == true || "$pending" == false ]] || fail 'Sidecar-Deploy-Status ungültig.'
elif [[ "$mode" != apply ]]; then
  fail 'Kein gespeichertes Sidecar-Paar vorhanden.'
fi
if [[ "$pending" == true && "$mode" != --recover ]]; then
  fail 'Ein unterbrochener Sidecar-Rollout erfordert zuerst --recover.'
fi

write_state() {
  local tmp
  mkdir -p "$state_dir" || return 1
  tmp=$(mktemp "$state_dir/.text-sidecars.XXXXXX") || return 1
  if printf 'SPACY_IMAGE=%s\nWORD_CLOUD_ENCODER_IMAGE=%s\nPREVIOUS_SPACY_IMAGE=%s\nPREVIOUS_ENCODER_IMAGE=%s\nTEXT_SIDECARS_PENDING=%s\n' "$@" >"$tmp" &&
      mv -f -- "$tmp" "$state_file"; then
    return 0
  fi
  rm -f -- "$tmp"
  return 1
}

apps=()
for service in app app-b app-c; do
  container=$(compose ps --status running --quiet "$service")
  if [[ "$service" == app && -z "$container" ]]; then fail 'App A muss vor dem Sidecar-Rollout laufen.'; fi
  if [[ -n "$container" ]]; then apps+=("$container"); fi
done
project=$(docker inspect --format '{{index .Config.Labels "com.docker.compose.project"}}' "${apps[0]}")
[[ "$project" =~ ^[a-z0-9][a-z0-9_-]*$ ]] || fail 'Compose-Projekt von App A fehlt.'
pin_label="org.arsnova.text-sidecar-pin=$project"

# Auch nicht gestartete Container halten Images beim regulären image prune -a vor.
pin_images() {
  local id pin existing
  for id in "$@"; do
    pin="$project-text-sidecar-pin-${id#sha256:}"
    if existing=$(docker inspect --type container \
        --format '{{.Image}} {{index .Config.Labels "org.arsnova.text-sidecar-pin"}} {{.State.Status}}' "$pin" 2>/dev/null); then
      [[ "$existing" == "$id $project created" ]] || return 1
    else
      docker create --pull never --network none --read-only --name "$pin" --label "$pin_label" "$id" >/dev/null || return 1
    fi
  done
}

clean_pins() {
  local pins pin id
  pins=$(docker ps --all --quiet --filter "label=$pin_label" --filter status=created) || return 1
  while IFS= read -r pin; do
    [[ -n "$pin" ]] || continue
    id=$(docker inspect --format '{{.Image}}' "$pin") || return 1
    case " $* " in
      *" $id "*) ;;
      *) docker rm "$pin" >/dev/null || return 1 ;;
    esac
  done <<< "$pins"
}

check_sockets() {
  local app
  for app in "${apps[@]}"; do
    docker exec -i "$app" node --input-type=module - "$@" < "$probe" || return 1
  done
}

replace_sidecars() {
  local expected_spacy expected_encoder
  expected_spacy=$(image_id "$1") || return 1
  expected_encoder=$(image_id "$2") || return 1
  SPACY_IMAGE="$1" WORD_CLOUD_ENCODER_IMAGE="$2" compose up -d --no-deps --pull never --wait --wait-timeout 180 spacy wordcloud-encoder || return 1
  if [[ "$(running_image spacy)" != "$expected_spacy" || "$(running_image wordcloud-encoder)" != "$expected_encoder" ]]; then
    echo 'Die laufenden Sidecar-Images weichen vom Zielpaar ab.' >&2
    return 1
  fi
}

if [[ "$mode" == --recover ]]; then
  recover_spacy_id=$(image_id "$spacy") || fail 'Gespeichertes spaCy-Image zuerst laden.'
  recover_encoder_id=$(image_id "$encoder") || fail 'Gespeichertes Encoder-Image zuerst laden.'
  pin_images "$recover_spacy_id" "$recover_encoder_id" || fail 'Konnte die Restore-Images nicht sichern.'
  replace_sidecars "$spacy" "$encoder"
  check_sockets --health-only
  write_state "$spacy" "$encoder" "$previous_spacy" "$previous_encoder" false
  echo 'Gespeichertes Sidecar-Paar wiederhergestellt.'
  exit 0
fi

running_spacy=$(running_image spacy) || fail 'Der bisherige spaCy-Sidecar muss für den Rollback laufen.'
running_encoder=$(running_image wordcloud-encoder) || fail 'Der bisherige Encoder muss für den Rollback laufen.'
if [[ -z "$spacy" ]]; then
  spacy=$running_spacy
  encoder=$running_encoder
elif [[ "$(image_id "$spacy")" != "$running_spacy" || "$(image_id "$encoder")" != "$running_encoder" ]]; then
  fail 'Laufende Sidecars weichen vom gespeicherten Paar ab. Zuerst --recover verwenden.'
fi

if [[ "$mode" == --rollback ]]; then
  next_spacy=$previous_spacy
  next_encoder=$previous_encoder
  [[ -n "$next_spacy$next_encoder" ]] || fail 'Kein vorheriges Sidecar-Paar gespeichert.'
  next_spacy_id=$(image_id "$next_spacy") || fail 'Vorheriges spaCy-Image zuerst laden.'
  next_encoder_id=$(image_id "$next_encoder") || fail 'Vorheriges Encoder-Image zuerst laden.'
fi

if [[ "$next_spacy_id" == "$running_spacy" && "$next_encoder_id" == "$running_encoder" && "$mode" == apply ]]; then
  check_sockets
  write_state "$next_spacy" "$next_encoder" "$previous_spacy" "$previous_encoder" false
  echo 'Das gewünschte Sidecar-Paar läuft bereits.'
  exit 0
fi

pin_images "$running_spacy" "$running_encoder" "$next_spacy_id" "$next_encoder_id" || fail 'Konnte die Sidecar-Images nicht für den Rollback sichern.'
write_state "$spacy" "$encoder" "$previous_spacy" "$previous_encoder" true
restore=true
# shellcheck disable=SC2317,SC2329 # EXIT trap
finish() {
  local status=$?
  trap - EXIT
  trap '' INT TERM
  if [[ "$restore" == true ]]; then
    echo 'Stelle das vorherige Sidecar-Paar wieder her.' >&2
    if replace_sidecars "$spacy" "$encoder" && check_sockets --health-only &&
        write_state "$spacy" "$encoder" "$previous_spacy" "$previous_encoder" false; then
      echo 'Vorheriges Sidecar-Paar wiederhergestellt.' >&2
    else
      echo 'Sidecar-Restore unvollständig. Gespeichertes Paar mit --recover wiederherstellen.' >&2
      status=1
    fi
  fi
  unlock_operation
  exit "$status"
}
trap finish EXIT

replace_sidecars "$next_spacy" "$next_encoder"
if [[ "$mode" == --rollback ]]; then
  check_sockets --health-only
  write_state "$next_spacy" "$next_encoder" '' '' false
else
  check_sockets
  write_state "$next_spacy" "$next_encoder" "$spacy" "$encoder" false
fi
restore=false
keep_images=("$next_spacy_id" "$next_encoder_id")
if [[ "$mode" == apply ]]; then keep_images+=("$running_spacy" "$running_encoder"); fi
clean_pins "${keep_images[@]}" || echo 'Nicht mehr benötigte Image-Halter konnten nicht vollständig entfernt werden.' >&2
echo 'Sidecar-Image-Paar gespeichert und aus allen laufenden Apps geprüft.'
