#!/usr/bin/env bash
# Führt den Digest-Deploy und die Replikatfreigabe unter derselben Sperre aus.
set -euo pipefail

root=$(cd -- "${DEPLOY_DIR:?DEPLOY_DIR fehlt}" && pwd)
cd "$root"
# Das Bootstrap lädt den Runner und die Sperre aus dem Ziel-Commit.
# Erst unter der Sperre darf der gemeinsame Arbeitsbaum wechseln.
[[ "${DEPLOY_SHA:-}" =~ ^[a-f0-9]{40}$ ]] || {
  echo 'DEPLOY_SHA muss eine Commit-SHA sein.' >&2
  exit 1
}
lock_lib=$(git show "$DEPLOY_SHA:scripts/deploy/lib-operation-lock.sh")
# shellcheck disable=SC1091
source /dev/stdin <<<"$lock_lib"
lock_operation "$root" release

git checkout --detach --force "$DEPLOY_SHA"
# shellcheck disable=SC1091
source "$root/scripts/deploy/lib-deploy-state.sh"
# shellcheck disable=SC1091
source "$root/scripts/deploy/lib-image-ref.sh"
# shellcheck disable=SC1091
source "$root/scripts/deploy/lib-arch.sh"
require_canonical_deploy_image "${DEPLOY_IMAGE:-}" DEPLOY_IMAGE
if [[ ! "${DEPLOY_SMOKE_URL:-}" =~ ^https://[a-zA-Z0-9.-]+(:[0-9]+)?$ ||
  "${DEPLOY_SMOKE_URL#https://}" =~ ^[0-9.]+(:[0-9]+)?$ ]]; then
  echo 'DEPLOY_SMOKE_URL muss eine HTTPS-URL mit TLS-Hostnamen sein.' >&2
  exit 1
fi

state_dir=$(deploy_state_dir "$root" "${DEPLOY_DIR:-}")
initial_image='' initial_sha=''
load_current_deploy_state "$state_dir" initial_image initial_sha
require_canonical_deploy_image "$initial_image" 'Last-known-good-Image'
require_valid_deploy_sha "$initial_sha" 'Last-known-good-SHA'

# Ein Image-Recover kann den Arbeitsbaum auf einen älteren Commit umschalten.
# Für die restliche Transaktion bleibt der Operator aus dem Release-Commit aktiv.
release_tmp=$(mktemp -d)
# shellcheck disable=SC2317 # EXIT trap
cleanup_release() {
  rm -f -- "$release_tmp/operator" "$release_tmp/nginx-pools" "$release_tmp/operation-lock"
  rmdir -- "$release_tmp"
  unlock_operation
}
trap cleanup_release EXIT
cp -- "$root/scripts/prod-replicas.sh" "$release_tmp/operator"
cp -- "$root/deploy/production/nginx-pools.sh" "$release_tmp/nginx-pools"
printf '%s\n' "$lock_lib" >"$release_tmp/operation-lock"
export ARSNOVA_RELEASE_ROOT="$root"
export ARSNOVA_RELEASE_POOL_HELPER="$release_tmp/nginx-pools"
export ARSNOVA_RELEASE_LOCK_LIB="$release_tmp/operation-lock"

replicas() {
  bash "$release_tmp/operator" "$@"
}

smoke() {
  docker exec -i arsnova-v3-app node --input-type=module - "$DEPLOY_SMOKE_URL" \
    <"$root/scripts/verify-production-serving.mjs"
}

restore_release() {
  local current_image='' current_sha='' previous_image='' previous_sha='' action
  read_snapshot "$state_dir/current.state" current_image current_sha || return 1
  if [[ "$current_image" == "$initial_image" && "$current_sha" == "$initial_sha" ]]; then
    action=--recover
  elif [[ "$current_image" == "$DEPLOY_IMAGE" && "$current_sha" == "$DEPLOY_SHA" ]] &&
    read_snapshot "$state_dir/previous.state" previous_image previous_sha &&
    [[ "$previous_image" == "$initial_image" && "$previous_sha" == "$initial_sha" ]]; then
    action=--rollback
  else
    echo 'Deploy-State stimmt nicht mit dem vorherigen verifizierten Release überein.' >&2
    return 1
  fi

  replicas drain &&
    bash "$root/scripts/deploy.sh" "$action" &&
    replicas "$restore_topology" || return 1
  echo 'Vorheriger Digest und Topologie sind wieder bereit.'
  smoke
}

replicas check
initial_mode=$(replicas mode)
restore_topology=up
target_topology=up
case "$initial_mode" in
  dual|primary) ;;
  triple) restore_topology=enable-third; target_topology=enable-third ;;
  single) restore_topology=rollback ;;
  *) echo 'Nginx-Modus vor Rollout unbekannt.' >&2; exit 1 ;;
esac

# Das neue Image vor dem Wechsel laden und den Rückweg auf den alten Digest prüfen.
if [[ "$(docker inspect --format '{{.Config.Image}}' arsnova-v3-app)" != "$initial_image" ]]; then
  echo 'Laufendes Image stimmt nicht mit current.state überein.' >&2
  exit 1
fi
docker pull "$DEPLOY_IMAGE"
require_image_compatible_with_host "$DEPLOY_IMAGE"
docker image inspect "$initial_image" >/dev/null
if replicas rollback &&
  bash "$root/scripts/deploy.sh" &&
  replicas "$target_topology" &&
  smoke; then
  echo 'Release inklusive Replikat-Readiness und öffentlichem Smoke-Test abgeschlossen.'
  exit 0
fi

echo 'Release fehlgeschlagen. Stelle das vorherige Image und die Topologie wieder her.' >&2
if restore_release; then
  echo 'Automatischer Rollback abgeschlossen. Der fehlgeschlagene Release bleibt fehlgeschlagen.' >&2
else
  echo 'Automatischer Rollback fehlgeschlagen. Status und Logs der Produktion prüfen.' >&2
fi
exit 1
