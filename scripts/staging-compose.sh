#!/usr/bin/env bash
set -euo pipefail

root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
project=${STAGING_PROJECT_NAME:-arsnova-staging}
env_file=${STAGING_ENV_FILE:-"$root/.env.staging"}

case "${1:-}" in
  up|rollback|status|config|down) ;;
  *)
    echo "Aufruf: $0 {up|rollback|status|config|down}" >&2
    exit 2
    ;;
esac
if [[ ! "$project" =~ ^arsnova-staging(-[a-z0-9]+)*$ ]]; then
  echo 'STAGING_PROJECT_NAME muss arsnova-staging oder arsnova-staging-<suffix> sein.' >&2
  exit 2
fi
if [[ ! -f "$env_file" ]]; then
  echo 'Staging-Umgebungsdatei fehlt. Vorlage: .env.staging.example' >&2
  exit 2
fi

compose() {
  docker compose --project-name "$project" --env-file "$env_file" \
    --file "$root/docker-compose.staging.yml" "$@"
}

check_running_replicas() {
  local running=$1 container service hash ref image expected_hash expected_image details
  while read -r container; do
    details=$(docker inspect --format '{{index .Config.Labels "com.docker.compose.service"}} {{index .Config.Labels "com.docker.compose.config-hash"}} {{.Config.Image}} {{.Image}}' "$container")
    read -r service hash ref image <<< "$details"
    expected_hash=$(compose config --hash "$service")
    expected_image=$(docker image inspect --format '{{.Id}}' "$ref")
    if [[ "$expected_hash" != "$service $hash" || "$expected_image" != "$image" ]]; then
      echo 'Image- oder App-Konfigurationswechsel erfordert zuerst down.' >&2
      return 1
    fi
  done <<< "$running"
}

wait_subscribers() {
  local count=$1 attempt
  local channels=(
    arsnova:session:status:v1
    arsnova:session:vote-progress:v1
    arsnova:session:participants:v1
    arsnova:session:qa-questions:v1
  )
  for ((attempt = 0; attempt < 15; attempt++)); do
    if compose exec -T redis redis-cli --raw PUBSUB NUMSUB "${channels[@]}" |
      awk -v n="$count" -v channels="${#channels[@]}" \
        'NR % 2 == 0 && $1 == n { ready++ } END { exit !(NR == 2 * channels && ready == channels) }'; then
      return 0
    fi
    sleep 1
  done
  echo "Erwartete Redis-Subscriber je Kanal: $count." >&2
  return 1
}

wait_replica_readiness() {
  local attempt
  for ((attempt = 0; attempt < 10; attempt++)); do
    if compose exec -T app-b node /app/staging-readiness.mjs app-a &&
      compose exec -T app-a node /app/staging-readiness.mjs app-b; then
      return 0
    fi
    sleep 1
  done
  echo 'App-Readiness über das Compose-Netz nicht bestätigt.' >&2
  return 1
}

wait_nginx_readiness() {
  local attempt
  for ((attempt = 0; attempt < 10; attempt++)); do
    if compose exec -T nginx wget -qO- -T 2 http://127.0.0.1:8081/ready |
      grep -q '"redis":"ok"'; then
      return 0
    fi
    sleep 1
  done
  echo 'Nginx-Readiness nicht bestätigt.' >&2
  return 1
}

wait_relay_readiness() {
  local attempt
  for ((attempt = 0; attempt < 15; attempt++)); do
    if compose exec -T app-a node -e 'fetch("http://yjs-relay:3002/", { signal: AbortSignal.timeout(3000) }).then(response => { if (!response.ok) process.exitCode = 1; }, () => { process.exitCode = 1; })'; then
      return 0
    fi
    sleep 1
  done
  echo 'Yjs-Relay-Readiness nicht bestätigt.' >&2
  return 1
}

switch_pools() {
  compose exec -T nginx sh /etc/nginx/staging/switch.sh "$1"
}

case "$1" in
  up|rollback|down)
    lock="${TMPDIR:-/tmp}/$project.operator.lock"
    if ! mkdir "$lock"; then
      echo 'Ein Staging-Betriebsbefehl läuft bereits.' >&2
      exit 1
    fi
    trap 'rmdir "$lock"' EXIT
    trap 'exit 130' INT
    trap 'exit 143' TERM
    ;;
esac

case "$1" in
  up)
    running=$(compose ps --status running --quiet app-a app-b)
    if [[ -n "$running" ]]; then
      check_running_replicas "$(compose ps --status running --quiet app-a app-b yjs-relay pdf-worker spacy qa-summary-redis)"
      compose up -d --wait --wait-timeout 120 postgres redis pdf-worker spacy qa-summary-redis
      compose up -d --no-deps app-a app-b
    else
      compose up -d --wait --wait-timeout 120 app-a app-b
    fi
    wait_replica_readiness
    wait_subscribers 2
    compose up -d --no-deps yjs-relay
    wait_relay_readiness
    compose up -d --no-deps nginx
    wait_nginx_readiness
    switch_pools dual
    echo 'Staging bereit: beide Apps in HTTP- und WebSocket-Pool, Yjs über den dedizierten Relay.'
    ;;
  rollback)
    compose exec -T app-a node /app/staging-readiness.mjs
    switch_pools single
    compose stop app-b
    wait_subscribers 1
    compose exec -T app-a node /app/staging-readiness.mjs
    echo 'Rollback abgeschlossen: beide Pools verwenden App A.'
    ;;
  status)
    compose ps -a
    compose exec -T nginx wget -qO- http://127.0.0.1:8081/mode
    ;;
  config)
    compose config --quiet
    ;;
  down)
    compose down
    ;;
esac
