#!/usr/bin/env bash
# Orchestrator im app-host, ausschließlich über labor-wsl.sh s1 freigeben.
set -euo pipefail
cd "$(git -C "$(dirname "$(readlink -f "$0")")" rev-parse --show-toplevel)"
EV=docs/referat-thema-1/evidenz/1B
ip -j -4 addr show | jq -e 'any(.[].addr_info[]; .local == "192.168.150.10")' >/dev/null
[[ "$(nproc)" == 2 ]]
node "$EV/s1.mjs" config "${LAB_N:?}" "${LAB_AUFTRAG:?}" "${LAB_TAG:?}" "${LAB_TIMEOUT_MS:?}" >/dev/null
[[ "${LAB_STOERUNG:-normal}" == normal && -z "${LAB_RUNTIME_AUS:-}" ]]
exec 9>"$HOME/labor-1b/labor.lock"
flock -n 9 || { echo 'Ein anderer Labormodus läuft.' >&2; exit 1; }
LLM=(ssh -i "$HOME/.ssh/labor-llm" -o StrictHostKeyChecking=accept-new -o BatchMode=yes -o ConnectTimeout=5 labor@192.168.150.20)
"${LLM[@]}" 'test ! -d ~/labor-1b/stoerung-lease && test ! -d ~/labor-1b/s1-lease'
prepared=0
envfile=
cleanup() {
  code=$?
  [[ -z "$envfile" ]] || rm -f "$envfile"
  if [[ "$prepared" == 1 ]]; then
    "${LLM[@]}" "cd arsnova.eu && bash $EV/s1-host.sh undo" >&2 || { echo 'S1-Lease prüfen, keine weiteren Läufe.' >&2; code=1; }
  fi
  exit "$code"
}
trap cleanup EXIT
# Private env nur als SSH-stdin, weder Argument noch Log.
umask 077
envfile="$(mktemp "$HOME/labor-1b/s1-env.XXXXXX")"
node "$EV/s1.mjs" env "$LAB_N" "$LAB_AUFTRAG" "$LAB_TAG" "$LAB_TIMEOUT_MS" <.env.production >"$envfile"
"${LLM[@]}" "cd arsnova.eu && bash $EV/s1-host.sh prepare" <"$envfile"
rm -f "$envfile"
envfile=''
prepared=1
roles=(app postgres redis pdf-worker)
[[ "$LAB_AUFTRAG" != label ]] || roles+=(wordcloud-encoder)
images='{}'
for role in "${roles[@]}"; do
  id="$(docker inspect -f '{{.Image}}' "arsnova-v3-$role")"
  images="$(jq -c --arg role "$role" --arg id "$id" '.+{($role):$id}' <<<"$images")"
done
# Tags sind lokale Transportnamen, die IDs werden auf der Zielseite geprüft.
refs=()
for role in "${roles[@]}"; do
  ref="arsnova-1b-s1-$role:source"
  docker image tag "$(jq -r --arg role "$role" '.[$role]' <<<"$images")" "$ref"
  refs+=("$ref")
done
docker image save "${refs[@]}" | "${LLM[@]}" 'docker image load >/dev/null'
printf '%s\n' "$images" | "${LLM[@]}" 'umask 077; cat > ~/labor-1b/s1-source-images.json'
printf -v envText 'LAB_N=%q LAB_AUFTRAG=%q LAB_TAG=%q LAB_TIMEOUT_MS=%q LAB_PROFIL_IST=%q LAB_RECHNER=%q' \
  "$LAB_N" "$LAB_AUFTRAG" "$LAB_TAG" "$LAB_TIMEOUT_MS" "${LAB_PROFIL_IST:-unbekannt}" "${LAB_RECHNER:-unbekannt}"
remote="$("${LLM[@]}" "cd arsnova.eu && $envText bash $EV/s1-host.sh run")"
# Erfolgreicher run hat Lease entfernt; bei Abbruch bleibt die Wiederherstellung Pflicht.
prepared=0
[[ "$remote" =~ ^/home/labor/labor-1b/[0-9]{8}T[0-9]{6}-[a-z0-9-]+$ ]]
localdir="$HOME/labor-1b/$(basename "$remote")"
mkdir "$localdir"
scp -q -r -i "$HOME/.ssh/labor-llm" -o StrictHostKeyChecking=accept-new -o BatchMode=yes "labor@192.168.150.20:$remote/." "$localdir/"
bash "$EV/pruefen.sh" app >"$localdir/restore-original-app.log" 2>&1
# Der Endbericht ergänzt, dass auch der ursprüngliche App-Host geprüft wurde.
jq '.restoration.originalAppChecksPassed=true' "$localdir/ergebnis.json" >"$localdir/ergebnis.tmp"
mv "$localdir/ergebnis.tmp" "$localdir/ergebnis.json"
echo "$localdir"
