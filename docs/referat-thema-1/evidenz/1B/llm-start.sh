#!/usr/bin/env bash
# 1B-Labor, im llm-host aus dem Repo-Checkout aufzurufen (ADR 1B-005, 1B-010):
#   1. Runtime-Image bauen, in eine lokale Registry (nur 127.0.0.1:5000) pushen, Digest
#      ablesen (Runbook Anhang A, Registry lokal statt GHCR);
#   2. GGUF prüfen, fehlt es: aus downloadUrl des Manifests laden (Runbook §7);
#   3. .env.llm schreiben, falls sie fehlt; Token nur hier erzeugt (Runbook §8.2–8.3);
#   4. Prüfungen von scripts/open-weight-llm/prod-compose.mjs per Compose-Trockenlauf;
#   5. Start mit derselben Compose-Datei plus Labor-Override (CPUs = vCPUs dieser VM);
#   6. warten, bis der Container healthy ist; Digest ausgeben.
# Mehrfach aufrufbar. Release-Dateien werden nicht verändert.
set -euo pipefail
REPO="$(git -C "$(dirname "$(readlink -f "$0")")" rev-parse --show-toplevel)"
cd "$REPO"
BIND="${LAB_LLM_BIND:-192.168.150.20}"
MODELDIR=/srv/arsnova/models/open-weight-llm
MANIFEST=docker/open-weight-llm/model-manifest.json
REG=127.0.0.1:5000/arsnova-open-weight-llm

# Der Wrapper importiert dotenv aus dem Wurzel-node_modules. Dort liegt es nur als
# Dev-Abhängigkeit; Runbook §6 (npm ci --omit=dev) lässt es weg und der Wrapper bricht
# mit ERR_MODULE_NOT_FOUND ab (Befund 2026-11-12). Darum hier ohne --omit=dev.
[[ -d node_modules/dotenv ]] || npm ci --ignore-scripts --no-audit --no-fund

echo "== Registry und Runtime-Image"
docker start registry >/dev/null 2>&1 ||
  docker run -d --restart=always --name registry -p 127.0.0.1:5000:5000 registry:2.8.3 >/dev/null
# Tag nach dem letzten Commit, der den Build-Kontext geändert hat.
TAG="$REG:server-b10524-$(git log -1 --format=%h --abbrev=12 -- docker/open-weight-llm)"
for i in 1 2 3; do
  docker image inspect "$TAG" >/dev/null 2>&1 && break
  docker build --pull --file docker/open-weight-llm/Dockerfile --tag "$TAG" docker/open-weight-llm ||
    echo "Build $i fehlgeschlagen" >&2
done
docker image inspect "$TAG" >/dev/null
# Push großer Layer in registry:2 läuft gelegentlich in einen Timeout; Wiederholung hilft.
for i in 1 2 3 4 5; do docker push -q "$TAG" >/dev/null && break; echo "Push $i fehlgeschlagen" >&2; sleep 5; done
docker pull -q "$TAG" >/dev/null
IMAGE="$(docker image inspect --format '{{range .RepoDigests}}{{println .}}{{end}}' "$TAG" | grep -F "$REG@sha256:" | head -n 1)"
[[ -n "$IMAGE" ]] || { echo "Kein Registry-Digest für $TAG" >&2; exit 1; }
# Build-Cache löschen (rund 1 GiB im llm-host, gemessen 2026-11-13).
docker builder prune -af >/dev/null 2>&1 || true

echo "== Modell"
GGUF="$MODELDIR/$(jq -r .filename "$MANIFEST")"
if [[ ! -f "$GGUF" ]]; then
  curl -fL --retry 3 -o "$GGUF.part" "$(jq -r .downloadUrl "$MANIFEST")"
  mv "$GGUF.part" "$GGUF"
fi
node scripts/open-weight-llm/verify-model.mjs "$MANIFEST" "$GGUF"

if [[ ! -f .env.llm ]]; then
  echo "== .env.llm schreiben (Token nur in dieser VM)"
  umask 077
  install -m 0600 /dev/null .env.llm
  {
    printf 'OPEN_WEIGHT_LLM_IMAGE=%s\n' "$IMAGE"
    printf 'OPEN_WEIGHT_LLM_MODEL_DIR=%s\n' "$MODELDIR"
    printf 'OPEN_WEIGHT_LLM_BIND_ADDRESS=%s\n' "$BIND"
    printf 'OPEN_WEIGHT_LLM_TOKEN=%s\n' "$(openssl rand -hex 32)"
  } >.env.llm
else
  sed -i "s|^OPEN_WEIGHT_LLM_IMAGE=.*|OPEN_WEIGHT_LLM_IMAGE=$IMAGE|" .env.llm
fi
grep -E '^(OPEN_WEIGHT_LLM_IMAGE|OPEN_WEIGHT_LLM_MODEL_DIR|OPEN_WEIGHT_LLM_BIND_ADDRESS)=' .env.llm

echo "== Wrapper-Prüfungen (Trockenlauf)"
node scripts/open-weight-llm/prod-compose.mjs --dry-run up -d

echo "== Start mit Labor-Override ($(nproc) CPUs)"
LAB_LLM_CPUS="$(nproc)" docker compose -f docker-compose.llm.yml \
  -f docs/referat-thema-1/evidenz/1B/llm-vm.override.yml --env-file .env.llm --profile llm up -d

for _ in $(seq 1 60); do
  state="$(docker inspect -f '{{.State.Health.Status}}' arsnova-open-weight-llm 2>/dev/null || echo fehlt)"
  [[ "$state" == healthy ]] && break
  sleep 5
done
[[ "$state" == healthy ]] || { echo "Runtime nicht healthy: $state" >&2; exit 1; }
echo "healthy; Image: $(docker inspect -f '{{.Config.Image}}' arsnova-open-weight-llm)"
