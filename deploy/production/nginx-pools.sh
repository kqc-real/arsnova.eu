#!/bin/bash
set -euo pipefail

# Die installierte sudo-Variante akzeptiert nur die festen Betriebsmodi
# und arbeitet ausschließlich an der Loopback-Route und der Pool-Datei.
if [[ "$0" == /usr/local/sbin/arsnova-nginx-pools ]]; then
  export PATH=/usr/sbin:/usr/bin:/sbin:/bin
  config=/etc/nginx/conf.d/arsnova-live-pools.conf
  control=http://127.0.0.1:18081
  nginx=/usr/sbin/nginx
else
  config=${ARSNOVA_NGINX_POOLS_FILE:-/etc/nginx/conf.d/arsnova-live-pools.conf}
  control=${ARSNOVA_NGINX_CONTROL_URL:-http://127.0.0.1:18081}
  nginx=${ARSNOVA_NGINX_BIN:-nginx}
fi

read_mode() {
  curl --noproxy '*' -fsS --max-time 2 "$control/mode"
}

wait_for_nginx_mode() {
  local expected=$1 attempt
  for ((attempt = 0; attempt < 15; attempt++)); do
    if [[ "$(read_mode 2>/dev/null)" == "$expected" ]]; then return 0; fi
    sleep 1
  done
  printf 'Nginx hat Modus %s nach dem Reload nicht bestätigt.\n' "$expected" >&2
  return 1
}

render_pools() {
  local mode=$1 yjs=13202 output label
  local -a http=(3000) ws=(3001)
  case "$mode" in
    single) yjs=3002 ;;
    primary) ;;
    dual) http+=(13100); ws+=(13101) ;;
    triple) http+=(13100 13300); ws+=(13101 13301) ;;
    *) return 2 ;;
  esac

  for label in app_http app_ws_trpc; do
    if [[ "$label" == app_http ]]; then
      output=("${http[@]}")
    else
      output=("${ws[@]}")
    fi
    printf 'upstream %s {\n    zone %s 64k;\n    least_conn;\n' "$label" "$label"
    printf '    server 127.0.0.1:%s max_fails=1 fail_timeout=10s;\n' "${output[@]}"
    printf '}\n\n'
  done
  cat <<EOF
upstream app_ws_yjs {
    server 127.0.0.1:$yjs;
}

server {
    listen 127.0.0.1:18081;
    access_log off;
    location = /mode { return 200 "$mode\n"; }
    location = /ready { proxy_pass http://app_http/trpc/health.check; }
    location / { return 404; }
}
EOF
}

apply_pools() (
  local mode=$1 previous backup='' candidate='' restore=0
  previous=$(read_mode) || return 1
  if [[ "$previous" == "$mode" ]]; then
    wait_for_nginx_mode "$mode"
    return
  fi
  # shellcheck disable=SC2317,SC2329 # EXIT trap
  restore_previous() {
    if ((restore)); then
      if mv -f -- "$backup" "$config" && "$nginx" -t && "$nginx" -s reload; then
        echo 'Vorherige Nginx-Pool-Datei wiederhergestellt.' >&2
      else
        echo 'Vorherige Nginx-Pool-Datei konnte nicht reaktiviert werden.' >&2
      fi
    fi
    rm -f -- "$backup" "$candidate"
  }
  trap restore_previous EXIT
  trap 'exit 130' INT
  trap 'exit 143' TERM
  backup=$(mktemp "${config}.previous.XXXXXX") || return 1
  candidate=$(mktemp "${config}.candidate.XXXXXX") || return 1
  cp -p -- "$config" "$backup" || return 1
  render_pools "$mode" >"$candidate" || return 1
  restore=1
  mv -f -- "$candidate" "$config" || return 1
  if "$nginx" -t && "$nginx" -s reload && wait_for_nginx_mode "$mode"; then
    restore=0
    return 0
  fi
  echo 'Nginx-Umschaltung fehlgeschlagen.' >&2
  return 1
)

case "${1:-}" in
  check)
    [[ $# == 1 && -f "$config" ]]
    case "$(read_mode)" in
      single|primary|dual|triple) ;;
      *) echo 'Nginx-Statusroute ist nicht bereit.' >&2; exit 1 ;;
    esac
    "$nginx" -t
    ;;
  render|apply)
    [[ $# == 2 ]]
    case "$2" in
      single|primary|dual|triple) ;;
      *) exit 2 ;;
    esac
    if [[ "$1" == render ]]; then render_pools "$2"; else apply_pools "$2"; fi
    ;;
  *) exit 2 ;;
esac
