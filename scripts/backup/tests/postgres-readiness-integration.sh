#!/usr/bin/env bash

set -euo pipefail

command -v docker >/dev/null 2>&1 || {
  echo "Docker fehlt für den PostgreSQL-Bereitschaftstest." >&2
  exit 1
}

CONTAINER_NAME="arsnova-postgres-readiness-test-$$"

cleanup() {
  docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
}
trap cleanup EXIT

docker run -d --rm \
  --name "$CONTAINER_NAME" \
  --network none \
  --user 70:70 \
  --read-only \
  --cap-drop ALL \
  --security-opt no-new-privileges:true \
  --pids-limit 128 \
  --memory 2g \
  --cpus 1 \
  --tmpfs /var/lib/postgresql/data:rw,noexec,nosuid,nodev,size=1g,uid=70,gid=70,mode=0700 \
  --tmpfs /var/run/postgresql:rw,noexec,nosuid,nodev,size=16m,uid=70,gid=70,mode=0755 \
  --tmpfs /tmp:rw,noexec,nosuid,nodev,size=64m,uid=70,gid=70,mode=1777 \
  -e POSTGRES_HOST_AUTH_METHOD=trust \
  postgres:16-alpine >/dev/null

ready=false
for _ in {1..60}; do
  if docker exec "$CONTAINER_NAME" sh -eu -c \
    'test "$(cat /proc/1/comm)" = postgres && pg_isready -U postgres >/dev/null'; then
    ready=true
    break
  fi
  sleep 1
done

[[ "$ready" == "true" ]] || {
  docker logs "$CONTAINER_NAME" >&2
  echo "Der finale PostgreSQL-Prozess wurde nicht rechtzeitig bereit." >&2
  exit 1
}

docker exec "$CONTAINER_NAME" createdb -U postgres readiness_test
