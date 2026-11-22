#!/usr/bin/env bash
set -euo pipefail

root=${ARSNOVA_RELEASE_ROOT:-$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)}
cd "$root"
control=${ARSNOVA_NGINX_CONTROL_URL:-http://127.0.0.1:18081}
wait_seconds=${ARSNOVA_REPLICA_WAIT_SECONDS:-180}
pool_helper=${ARSNOVA_RELEASE_POOL_HELPER:-"$root/deploy/production/nginx-pools.sh"}

nginx_pools() {
  if ((EUID == 0)) || [[ -n "${ARSNOVA_NGINX_POOLS_FILE:-}" ]]; then
    bash "$pool_helper" "$@"
  else
    sudo -n /usr/local/sbin/arsnova-nginx-pools "$@"
  fi
}

base() {
  COMPOSE_FILE=docker-compose.prod.yml "$root/scripts/prod-compose.sh" "$@"
}

replicas() {
  base -f docker-compose.prod.replicas.yml --profile app-replicas --profile app-third "$@"
}

read_mode() {
  curl --noproxy '*' -fsS --max-time 2 "$control/mode"
}

wait_for_mode() {
  local expected=$1 attempt
  for ((attempt = 0; attempt < 15; attempt++)); do
    if [[ "$(read_mode 2>/dev/null)" == "$expected" ]] &&
      curl --noproxy '*' -fsS --max-time 2 "$control/ready" | grep -q '"redis":"ok"'; then
      return 0
    fi
    sleep 1
  done
  printf 'Nginx-Modus %s wurde nicht als bereit bestätigt.\n' "$expected" >&2
  return 1
}

switch_pools() {
  local mode=$1 previous
  previous=$(read_mode) || return 1
  nginx_pools apply "$mode" || return 1
  if wait_for_mode "$mode"; then return 0; fi
  nginx_pools apply "$previous" || echo 'Vorheriger Nginx-Modus konnte nicht wiederhergestellt werden.' >&2
  return 1
}

app_ready() {
  replicas exec -T "$1" node --input-type=module <"$root/deploy/production/app-readiness.mjs"
}

wait_app() {
  local service=$1 attempt
  for ((attempt = 0; attempt < 10; attempt++)); do
    if app_ready "$service"; then return 0; fi
    sleep 1
  done
  return 1
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
    if base exec -T redis redis-cli --raw PUBSUB NUMSUB "${channels[@]}" |
      awk -v n="$count" -v channels="${#channels[@]}" 'NR % 2 == 0 && $1 == n { ready++ } END { exit !(NR == 2 * channels && ready == channels) }'; then
      return 0
    fi
    sleep 1
  done
  echo "Redis meldet nicht $count App-Subscriber je Session-Kanal." >&2
  return 1
}

verify_deployed_primary() {
  local id ref expected
  id=$(base ps --status running --quiet app)
  if [[ -z "$id" ]]; then
    echo 'Zuerst den regulären Digest-Deploy für App A abschließen.' >&2
    return 1
  fi
  ref=$(docker inspect --format '{{.Config.Image}}' "$id")
  expected=$(base config --no-env-resolution app |
    awk '/^  app:$/ { in_app=1; next } in_app && /^    image: / { print $2; in_app=0 }')
  if [[ "$ref" != "$expected" ]]; then
    echo 'Das bereitgestellte Image von App A weicht vom Compose-Image ab.' >&2
    return 1
  fi
  primary_image=$(docker inspect --format '{{.Image}}' "$id")
}

verify_image() {
  local service=$1 id
  id=$(replicas ps --status running --quiet "$service")
  if [[ -z "$id" || "$(docker inspect --format '{{.Image}}' "$id")" != "$primary_image" ]]; then
    echo "Image von $service weicht vom bereitgestellten Image ab." >&2
    return 1
  fi
}

verify_relay() {
  verify_image yjs-relay &&
    replicas exec -T yjs-relay wget -qO /dev/null -T 3 http://127.0.0.1:3002/
}

verify_replica() {
  local service=$1
  verify_image "$service" &&
    [[ "$(replicas exec -T "$service" printenv DATABASE_POOL_MAX)" == "$ARSNOVA_REPLICA_POOL_MAX" ]] &&
    wait_app "$service"
}

withdraw_replicas() {
  local current=$1
  if [[ "$current" == dual || "$current" == triple ]]; then
    wait_app app
    switch_pools primary
  fi
  # Nach bestätigtem Reload kündigt der reguläre App-Shutdown WebSocket-Reconnects an.
  replicas stop app-b app-c
}

rollback() {
  local current
  current=$(read_mode)
  withdraw_replicas "$current"
  base up -d --no-deps --wait --wait-timeout "$wait_seconds" app
  wait_app app
  base exec -T app wget -qO /dev/null -T 3 http://127.0.0.1:3002/
  switch_pools single
  replicas stop yjs-relay
  echo 'Rollback abgeschlossen. HTTP, tRPC-WebSocket und Yjs laufen über App A.'
}

activate() {
  local target=$1 current count=2 service
  local -a extra=(app-b)
  export ARSNOVA_REPLICA_POOL_MAX=30
  if [[ "$target" == triple ]]; then
    export ARSNOVA_REPLICA_POOL_MAX=20
    count=3
    extra+=(app-c)
  fi
  current=$(read_mode)
  if [[ "$current" == "$target" ]] && verify_replica app &&
    verify_relay &&
    [[ "$(replicas ps --status running --quiet app-b app-c | wc -l | tr -d ' ')" == "$((count - 1))" ]]; then
    local ready=1
    for service in "${extra[@]}"; do
      if ! verify_replica "$service"; then ready=0; fi
    done
    if [[ "$ready" == 1 ]] && wait_subscribers "$count"; then
      echo "Nginx nutzt bereits $count bereite Apps."
      return 0
    fi
  fi

  withdraw_replicas "$current"
  replicas up -d --no-deps --wait --wait-timeout "$wait_seconds" yjs-relay
  verify_relay
  if ! replicas up -d --no-deps --wait --wait-timeout "$wait_seconds" app ||
    ! verify_replica app || ! switch_pools primary; then
    echo 'App A oder ihre Nginx-Route ist fehlgeschlagen. Stelle den Einzelbetrieb wieder her.' >&2
    (rollback)
    return 1
  fi
  replicas up -d --no-deps --wait --wait-timeout "$wait_seconds" "${extra[@]}"
  for service in "${extra[@]}"; do
    verify_replica "$service"
  done
  wait_subscribers "$count"
  switch_pools "$target"
  echo "Nginx nutzt $count Apps mit je $ARSNOVA_REPLICA_POOL_MAX DB-Verbindungen."
}

case "${1:-}" in
  render)
    [[ $# == 2 ]] || exit 2
    bash "$pool_helper" render "$2"
    exit
    ;;
  status)
    [[ $# == 1 ]] || exit 2
    replicas ps -a
    read_mode
    exit
    ;;
  mode)
    [[ $# == 1 ]]
    read_mode
    exit
    ;;
  check)
    [[ $# == 1 ]]
    nginx_pools check
    if ((EUID != 0)) && [[ -z "${ARSNOVA_NGINX_POOLS_FILE:-}" ]]; then
      for mode in single primary dual triple; do
        sudo -n -l /usr/local/sbin/arsnova-nginx-pools apply "$mode" >/dev/null
      done
    fi
    verify_deployed_primary
    exit
    ;;
  up|enable-third|rollback|drain)
    [[ $# == 1 ]] || exit 2
    ;;
  *)
    echo 'Aufruf: scripts/prod-replicas.sh {up|enable-third|rollback|status|mode|check|render single}' >&2
    exit 2
    ;;
esac

# shellcheck disable=SC1090,SC1091
source "${ARSNOVA_RELEASE_LOCK_LIB:-$root/scripts/deploy/lib-operation-lock.sh}"
lock_operation "$root"
if [[ ! "$wait_seconds" =~ ^[1-9][0-9]*$ ]]; then
  echo 'Ungültige ARSNOVA_REPLICA_WAIT_SECONDS.' >&2
  exit 1
fi
nginx_pools check

case "$1" in
  up) verify_deployed_primary; activate dual ;;
  enable-third) verify_deployed_primary; activate triple ;;
  rollback) rollback ;;
  drain)
    # Recover muss auch mit einer nicht bereiten App A starten können.
    # Der folgende Digest-Deploy übernimmt deren Start sowie Embedded-Yjs.
    nginx_pools apply single
    replicas stop app-b app-c yjs-relay
    ;;
esac
