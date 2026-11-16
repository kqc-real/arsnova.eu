#!/usr/bin/env bash
# Nur auf llm-host durch s1.sh; alle Änderungen benötigen die Lauf-Freigabe.
set -euo pipefail
cd "$(git -C "$(dirname "$(readlink -f "$0")")" rev-parse --show-toplevel)"
EV=docs/referat-thema-1/evidenz/1B
lease="$HOME/labor-1b/s1-lease"
project=arsnova-1b-s1
export ARSNOVA_IMAGE=arsnova-1b-s1-app:source
export WORD_CLOUD_ENCODER_IMAGE=arsnova-wordcloud-encoder:e5-small
C=(docker compose -p "$project" -f "$lease/docker-compose.prod.yml" -f "$PWD/$EV/s1.override.yml" --env-file "$lease/.env.production")
containers=(arsnova-v3-app arsnova-v3-postgres arsnova-v3-redis arsnova-v3-pdf-worker arsnova-v3-wordcloud-encoder)
journal() {
  jq -nc --arg at "$(date -u +%Y-%m-%dT%H:%M:%SZ)" --args '{at:$at,command:$ARGS.positional}' -- "$@" >>"$HOME/labor-1b/s1-journal.jsonl"
}
# Nur INPUT von der eigenen internen S1-Bridge, keine externe Portfreigabe.
rule=(in on br-1b-s1 proto tcp from 172.31.150.0/24 to 192.168.150.20 port 8080 comment arsnova-1b-s1)
kernel_rule=(-s 172.31.150.0/24 -d 192.168.150.20/32 -i br-1b-s1 -p tcp -m tcp --dport 8080 -j ACCEPT)
assert_target() {
  ip -j -4 addr show | jq -e 'any(.[].addr_info[]; .local == "192.168.150.20")' >/dev/null
}
undo() {
  assert_target || return 1
  [[ "$(cat "$lease/owner")" == arsnova-1b-s1-v1 ]] || return 1
  # Keine fremden Container übernehmen, auch nicht bei manueller Wiederherstellung.
  local c label
  for c in "${containers[@]}"; do
    if docker inspect "$c" >/dev/null 2>&1; then
      label="$(docker inspect -f '{{index .Config.Labels "com.docker.compose.project"}}' "$c")"
      [[ "$label" == "$project" ]] || { echo 'S1: Fremdcontainer, Lease bleibt.' >&2; return 1; }
    fi
  done
  if [[ -f "$lease/started" ]]; then "${C[@]}" --profile encoder down >&2 || return 1; fi
  if [[ -f "$lease/firewall-armed" ]]; then
    status="$(sudo ufw status)" || return 1
    if [[ "$status" == *arsnova-1b-s1* ]]; then
      journal sudo ufw --force delete allow "${rule[@]}" || return 1
      sudo ufw --force delete allow "${rule[@]}" >&2 || return 1
    fi
    if sudo iptables -C ufw-user-input "${kernel_rule[@]}" 2>/dev/null; then return 1; fi
    rm -f "$lease/firewall-armed" || return 1
  fi
  # Volumes bleiben als synthetische Labordaten erhalten, kein down -v.
  docker compose -f docker-compose.llm.yml -f "$EV/llm-vm.override.yml" --env-file .env.llm --profile llm down >&2 || return 1
  bash "$EV/llm-start.sh" >&2 || return 1
  bash "$EV/pruefen.sh" llm >&2 || return 1
  rm -f "$lease/.env.production" "$lease/docker-compose.prod.yml" "$lease/owner" "$lease/started"
  rmdir "$lease" || return 1
}
case "${1:-}" in
  prepare)
    assert_target
    [[ ! -d "$lease" && ! -d "$HOME/labor-1b/stoerung-lease" ]]
    [[ -d node_modules/dotenv && -d node_modules/@trpc/client ]]
    model="/srv/arsnova/models/open-weight-llm/$(jq -r .filename docker/open-weight-llm/model-manifest.json)"
    [[ -f "$model" ]]
    node scripts/open-weight-llm/verify-model.mjs docker/open-weight-llm/model-manifest.json "$model" >&2
    foreign=()
    for c in "${containers[@]}"; do docker inspect "$c" >/dev/null 2>&1 && foreign+=("$c"); done
    jq -n --argjson addresses "$(ip -j -4 addr show | jq '[.[].addr_info[].local]')" \
      --argjson cpus "$(nproc)" --argjson memoryBytes "$(awk '/^MemTotal:/ {print $2*1024}' /proc/meminfo)" \
      --argjson availableBytes "$(awk '/^MemAvailable:/ {print $2*1024}' /proc/meminfo)" \
      --argjson diskBytes "$(df -B1 --output=avail "$HOME" | tail -1 | tr -d ' ')" \
      --arg foreign "${foreign[*]}" \
      '{addresses:$addresses,cpus:$cpus,memoryBytes:$memoryBytes,availableBytes:$availableBytes,diskBytes:$diskBytes,foreignContainers:($foreign|split(" ")|map(select(length>0)))}' \
      | node "$EV/s1.mjs" check
    sudo ufw status | grep -q '^Status: active'
    ! sudo ufw status | grep -q 'arsnova-1b-s1'
    if sudo iptables -C ufw-user-input "${kernel_rule[@]}" 2>/dev/null; then exit 1; fi
    mapfile -t networks < <(docker network ls -q)
    docker network inspect "${networks[@]}" | jq '[.[].IPAM.Config[]?.Subnet]' | node "$EV/s1.mjs" networks
    umask 077
    mkdir "$lease"
    printf 'arsnova-1b-s1-v1\n' >"$lease/owner"
    trap 'code=$?; if (( code != 0 )); then undo || echo "S1-Ruecknahme fehlgeschlagen, Lease bleibt." >&2; fi; exit "$code"' EXIT
    cp docker-compose.prod.yml "$lease/docker-compose.prod.yml"
    cat >"$lease/.env.production"
    chmod 600 "$lease/.env.production"
    # Persistente Postgres-Daten nur mit derselben Passwortidentität wiederverwenden.
    identity="$(sed -n 's/^POSTGRES_PASSWORD=//p' "$lease/.env.production" | sha256sum | cut -d' ' -f1)"
    identity_file="$HOME/labor-1b/s1-db-identity"
    if [[ -f "$identity_file" ]]; then [[ "$(cat "$identity_file")" == "$identity" ]]; else printf '%s\n' "$identity" >"$identity_file"; fi
    ;;
  run)
    assert_target
    [[ "$(cat "$lease/owner")" == arsnova-1b-s1-v1 ]]
    node "$EV/s1.mjs" config "${LAB_N:?}" "${LAB_AUFTRAG:?}" "${LAB_TAG:?}" "${LAB_TIMEOUT_MS:?}" >/dev/null
    out="$HOME/labor-1b/$(date -u +%Y%m%dT%H%M%S)-$LAB_TAG"
    mkdir -m 700 "$out"
    trap 'code=$?; if ! undo >"$out/restore-llm.log" 2>&1; then echo "S1-Ruecknahme fehlgeschlagen: $out/restore-llm.log; Lease bleibt." >&2; code=1; fi; exit "$code"' EXIT
    node "$EV/s1.mjs" config "$LAB_N" "$LAB_AUFTRAG" "$LAB_TAG" "$LAB_TIMEOUT_MS" >"$out/config.json"
    cp "$HOME/labor-1b/s1-source-images.json" "$out/source-images.json"
    # Immutable IDs prüfen, bevor irgendein S1-Container gestartet wird.
    jq -r 'keys[]' "$out/source-images.json" | while read -r role; do
      [[ "$role" =~ ^(app|pdf-worker|postgres|redis|wordcloud-encoder)$ ]] || exit 1
      image="arsnova-1b-s1-$role:source"
      [[ "$(docker image inspect -f '{{.Id}}' "$image")" == "$(jq -r --arg role "$role" '.[$role]' "$out/source-images.json")" ]]
    done
    [[ -d node_modules/@trpc/client ]]
    [[ -f libs/shared-types/dist/index.js ]] || npm run build -w @arsnova/shared-types >&2
    # Markierung vor dem ersten Compose-Aufruf, damit Teilfehler aufgeräumt werden.
    touch "$lease/started"
    "${C[@]}" up -d --no-build --pull never --wait postgres redis >"$out/setup.log" 2>&1
    # Vor dem mutierenden ufw-Aufruf Rücknahme scharfstellen.
    touch "$lease/firewall-armed"
    journal sudo ufw insert 1 allow "${rule[@]}"
    sudo ufw insert 1 allow "${rule[@]}" >>"$out/setup.log" 2>&1
    sudo iptables -C ufw-user-input "${kernel_rule[@]}"
    journal verified-s1-firewall
    "${C[@]}" run --rm --no-deps --entrypoint '' app /app/node_modules/.bin/prisma migrate deploy --schema /app/prisma/schema.prisma >>"$out/setup.log" 2>&1
    if [[ "$LAB_AUFTRAG" == label ]]; then "${C[@]}" --profile encoder up -d --no-build --pull never --wait wordcloud-encoder >>"$out/setup.log" 2>&1; fi
    "${C[@]}" up -d --no-build --pull never --wait app pdf-worker >>"$out/setup.log" 2>&1
    docker exec arsnova-v3-app node -e 'fetch(process.env.OPEN_WEIGHT_LLM_URL + "/slots?fail_on_no_slot=1", {headers:{authorization:"Bearer " + process.env.OPEN_WEIGHT_LLM_TOKEN},signal:AbortSignal.timeout(5000)}).then(async r=>{if(r.status!==200 || !Array.isArray(await r.json())) process.exit(1); console.log("S1 authenticated slots: HTTP 200");}).catch(()=>process.exit(1));' >"$out/container-preflight.txt"
    # Versionsmanifest und Settings kommen aus dem tatsächlich laufenden Stack.
    node "$EV/experiment.mjs" settings >"$out/settings.json"
    ids='{}'
    while read -r role; do
      id="$(docker inspect -f '{{.Image}}' "arsnova-v3-$role")"
      ids="$(jq -c --arg role "$role" --arg id "$id" '.+{($role):$id}' <<<"$ids")"
    done < <(jq -r 'keys[]' "$out/source-images.json")
    printf '%s\n' "$ids" >"$out/actual-images.json"
    sourceRuntime="$(docker inspect -f '{{.Image}}' arsnova-open-weight-llm)"
    docker compose -f docker-compose.llm.yml -f "$EV/llm-vm.override.yml" --env-file .env.llm --profile llm down >>"$out/setup.log" 2>&1
    bash "$EV/llm-start.sh" >>"$out/setup.log" 2>&1
    [[ "$(docker inspect -f '{{.Image}}' arsnova-open-weight-llm)" == "$sourceRuntime" ]]
    docker inspect -f '{"image":{{json .Image}},"restarts":{{.RestartCount}},"oomKilled":{{.State.OOMKilled}},"health":{{json .State.Health.Status}}}' arsnova-open-weight-llm >"$out/runtime-before.json"
    jq -n --arg commit "$(git rev-parse HEAD)" --arg hostNode "$(node --version)" \
      --arg appNode "$(docker exec arsnova-v3-app node --version)" \
      --arg runtimeImage "$(docker inspect -f '{{.Image}}' arsnova-open-weight-llm)" \
      --arg profil "${LAB_PROFIL_IST:-unbekannt}" --arg rechner "${LAB_RECHNER:-unbekannt}" \
      --arg modelSha "$(jq -r .sha256 docker/open-weight-llm/model-manifest.json)" \
      --argjson memoryBytes "$(awk '/^MemTotal:/ {print $2*1024}' /proc/meminfo)" \
      --argjson cpus "$(nproc)" --slurpfile settings "$out/settings.json" \
      '{commit:$commit,energieprofil:$profil,rechner:$rechner,settings:$settings[0],settingsSource:"app-container-environment",runtimeVersions:{appHost:$hostNode,llmHost:$hostNode,appContainer:$appNode},runtimeImage:$runtimeImage,modelSha256:$modelSha,placement:{app:"llm-host",runtime:"llm-host",driver:"llm-host",protocol:"http",vmVcpu:$cpus,vmMemoryBytes:$memoryBytes,appCpuSet:"0,1",encoderCpus:2}}' >"$out/evidence.json"
    docker inspect -f '{"restarts":{{.RestartCount}},"oomKilled":{{.State.OOMKilled}},"health":{{json .State.Health.Status}}}' arsnova-v3-app >"$out/app-before.json"
    LAB_LIVE=1 LAB_STOERUNG=normal node "$EV/treiber.mjs" --trpc http://127.0.0.1:3000/trpc --auftraege "$LAB_N" --out "$out/treiber.json" 2>"$out/treiber.log"
    docker inspect -f '{"restarts":{{.RestartCount}},"oomKilled":{{.State.OOMKilled}},"health":{{json .State.Health.Status}}}' arsnova-v3-app >"$out/app-after.json"
    jq -e -s '.[0].restarts == .[1].restarts and (.[1].oomKilled|not) and .[1].health == "healthy"' "$out/app-before.json" "$out/app-after.json" >/dev/null
    docker inspect -f '{"image":{{json .Image}},"restarts":{{.RestartCount}},"oomKilled":{{.State.OOMKilled}},"health":{{json .State.Health.Status}}}' arsnova-open-weight-llm >"$out/runtime-after.json"
    jq -e -s '.[0].image == .[1].image and .[0].restarts == .[1].restarts and (.[1].oomKilled|not) and .[1].health == "healthy"' "$out/runtime-before.json" "$out/runtime-after.json" >/dev/null
    # Rücknahme ausdrücklich vor Erfolg/Ergebnis. EXIT-Trap bei Fehler weiterhin aktiv.
    undo >"$out/restore-llm.log" 2>&1
    trap - EXIT
    cp "$HOME/labor-1b/s1-journal.jsonl" "$out/s1-journal.jsonl"
    printf '{"checksPassed":true}\n' >"$out/wiederherstellung.json"
    node "$EV/s1.mjs" result "$out"
    echo "$out"
    ;;
  undo) undo ;;
  *) echo 'S1: prepare, run oder undo erforderlich.' >&2; exit 2 ;;
esac
