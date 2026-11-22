#!/bin/sh
set -eu

mode=${1:-}
case "$mode" in
  single|dual) ;;
  *) exit 2 ;;
esac

state=/var/lib/nginx/staging
conf=/etc/nginx/staging/nginx.conf
current="$state/pools.conf"
mode_url=http://127.0.0.1:8081/mode
read_mode() { wget -qO- -T 2 "$mode_url" 2>/dev/null; }

old_mode=$(read_mode)
case "$old_mode" in
  single|dual) ;;
  *) exit 1 ;;
esac
if [ "$old_mode" = "$mode" ]; then
  if [ "$mode" = single ]; then sleep 6; fi
  exit 0
fi

previous=$(mktemp "$state/previous.XXXXXX")
candidate=$(mktemp "$state/candidate.XXXXXX")
trap 'rm -f "$previous" "$candidate"' EXIT
ln -sfn "/etc/nginx/staging/pools-$old_mode.conf" "$previous"
ln -sfn "/etc/nginx/staging/pools-$mode.conf" "$candidate"
mv -f "$candidate" "$current"
if nginx -t -c "$conf" && nginx -s reload -c "$conf"; then
  for attempt in 1 2 3 4 5 6 7 8 9 10; do
    if [ "$(read_mode)" = "$mode" ] &&
      wget -qO- -T 2 http://127.0.0.1:8081/ready | grep -q '"redis":"ok"'; then
      # Alte Worker haben worker_shutdown_timeout=5s zum Drain.
      sleep 6
      exit 0
    fi
    sleep 1
  done
fi

mv -f "$previous" "$current"
if nginx -s reload -c "$conf"; then
  echo 'Nginx-Umschaltung fehlgeschlagen. Reload des bisherigen Pools ausgelöst.' >&2
else
  echo 'Nginx-Umschaltung fehlgeschlagen. Reload des bisherigen Pools ebenfalls fehlgeschlagen.' >&2
fi
exit 1
