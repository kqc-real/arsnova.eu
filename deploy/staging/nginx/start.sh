#!/bin/sh
set -eu

state=/var/lib/nginx/staging
if [ ! -f "$state/pools.conf" ]; then
  ln -s /etc/nginx/staging/pools-single.conf "$state/pools.conf"
fi
exec nginx -c /etc/nginx/staging/nginx.conf -g 'daemon off;'
