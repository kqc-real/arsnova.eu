#!/usr/bin/env bash
# 1B-Labor: Prüfungen in einer VM, aus dem Repo-Checkout aufzurufen (ADR 1B-010).
#   pruefen.sh llm   Runbook §10 im llm-host (Bind, Limits, Auth, Testinferenz)
#   pruefen.sh app   Runbook §11 im app-host (App healthy, Verbindung, Ports nur Loopback)
# Ausgabe je Prüfung eine Zeile „OK …“ oder „FEHLER …“, nie ein Token. Exit 1 bei Fehlern.
set -uo pipefail
REPO="$(git -C "$(dirname "$(readlink -f "$0")")" rev-parse --show-toplevel)"
cd "$REPO"
LLM_IP="${LAB_LLM_BIND:-192.168.150.20}"
fehler=0
pruef() { # name bedingung-ergebnis detail
  if [[ "$2" == 0 ]]; then echo "OK      $1: $3"; else echo "FEHLER  $1: $3"; fehler=1; fi
}
code() { curl -s -o /dev/null -w '%{http_code}' --max-time 5 "$@"; }

echo "== $(hostname) $(date --iso-8601=seconds) commit $(git rev-parse --short=12 HEAD) vCPU $(nproc) RAM $(free -g | awk '/^Mem:/ {print $2}') GiB"
# Messruhe: Hintergrund-Updates aus (user-data, Lauf 2026-11-13).
ruhe="$(systemctl is-enabled apt-daily.timer apt-daily-upgrade.timer 2>/dev/null | paste -sd' ')"
[[ "$ruhe" =~ ^(disabled|masked)\ (disabled|masked)$ ]]; pruef "Hintergrund-Updates aus" $? "apt-daily, apt-daily-upgrade: $ruhe"
case "${1:-}" in
  llm)
    T="$(sed -n 's/^OPEN_WEIGHT_LLM_TOKEN=//p' .env.llm)"
    n="$(nproc)"
    lst="$(ss -ltn | awk '$4 ~ /:8080$/ {print $4}' | sort -u | paste -sd' ')"
    [[ "$lst" == "$LLM_IP:8080" ]]; pruef "Bind nur private IP" $? "$lst"
    set -- $(docker inspect -f '{{.HostConfig.Memory}} {{.HostConfig.MemorySwap}} {{.HostConfig.NanoCpus}} {{.RestartCount}} {{.State.Health.Status}} {{.Config.Image}}' arsnova-open-weight-llm 2>/dev/null || echo - - - - - -)
    [[ "$1" == 8589934592 && "$2" == 10737418240 ]]; pruef "Speicherlimits Release" $? "Memory=$1 MemorySwap=$2"
    [[ "$3" == "$((n * 1000000000))" ]]; pruef "CPU-Limit = vCPUs" $? "NanoCpus=$3 vCPU=$n"
    [[ "$4" == 0 && "$5" == healthy ]]; pruef "Container" $? "Restarts=$4 Health=$5"
    [[ "$6" =~ @sha256:[a-f0-9]{64}$ ]]; pruef "Image per Digest" $? "$6"
    [[ "$(stat -c %a .env.llm)" == 600 ]]; pruef ".env.llm Modus 600" $? "$(stat -c %a .env.llm)"
    a="$(uname -m)" frei="$(df -BG --output=avail / | tail -1 | tr -dc 0-9)"
    [[ "$a" == x86_64 || "$a" == aarch64 ]] && ((frei >= 10)); pruef "64 Bit, mindestens 10 GiB frei" $? "$a, ${frei} GiB frei"
    v="$(node scripts/open-weight-llm/verify-model.mjs docker/open-weight-llm/model-manifest.json \
      "/srv/arsnova/models/open-weight-llm/$(jq -r .filename docker/open-weight-llm/model-manifest.json)" 2>&1)"
    pruef "GGUF Größe und SHA-256" $? "$v"
    # Flags des laufenden llama-server; nur Namen ausgeben, nie den Wert von --api-key.
    args="$(docker top arsnova-open-weight-llm -eo pid,args | grep llama-server | head -n 1)"
    for f in '--parallel 1' '--ctx-size 8192' '--n-predict 768' "--threads $n" '--no-webui' '--slots' \
      '--reasoning off' '--n-gpu-layers 0' '--slot-prompt-similarity 0' '--jinja' '--offline'; do
      [[ " $args " == *" $f "* ]]; pruef "Flag $f" $? ""
    done
    [[ " $args " == *" --api-key "* ]]; pruef "Flag --api-key gesetzt" $? "(Wert nicht ausgegeben)"
    for f in '--embedding' '--props' '--metrics'; do
      [[ " $args " != *" $f"* ]]; pruef "kein $f" $? ""
    done
    th="$(docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' arsnova-open-weight-llm | sed -n 's/^OPEN_WEIGHT_LLM_THREADS=//p')"
    [[ "$th" == "$n" ]]; pruef "Threads = vCPUs" $? "THREADS=$th"
    c="$(code -H "Authorization: Bearer $T" "http://$LLM_IP:8080/health")"
    [[ "$c" == 200 ]]; pruef "§10.1 /health" $? "HTTP $c"
    c="$(code "http://$LLM_IP:8080/slots?fail_on_no_slot=1")"
    [[ "$c" == 401 ]]; pruef "§10.2 ohne Token" $? "HTTP $c"
    c="$(code -H "Authorization: Bearer falsch-$RANDOM-$RANDOM" "http://$LLM_IP:8080/slots?fail_on_no_slot=1")"
    [[ "$c" == 401 ]]; pruef "§10.2 falscher Token" $? "HTTP $c"
    curl -fsS --max-time 5 -H "Authorization: Bearer $T" "http://$LLM_IP:8080/slots?fail_on_no_slot=1" |
      jq -e 'type == "array" and length == 1' >/dev/null
    pruef "§10.2 mit Token ein Slot" $? ""
    r="$(curl -fsS --max-time 120 -X POST -H "Authorization: Bearer $T" -H 'Content-Type: application/json' \
      --data '{"model":"qwen3-4b-instruct-2507-q4_k_m","messages":[{"role":"system","content":"Antworte nur mit dem Wort bereit."},{"role":"user","content":"Kurzer technischer Bereitschaftstest."}],"temperature":0,"max_tokens":8,"stream":false,"reasoning_effort":"none","chat_template_kwargs":{"enable_thinking":false}}' \
      "http://$LLM_IP:8080/v1/chat/completions" | jq -c '{antwort: .choices[0].message.content, prompt_ms: .timings.prompt_ms, predicted_ms: .timings.predicted_ms} | select(.antwort | type == "string" and length > 0)')"
    [[ -n "$r" ]]; pruef "§10.3 Testinferenz" $? "$r"
    ;;
  app)
    T="$(sed -n 's/^OPEN_WEIGHT_LLM_TOKEN=//p' .env.production)"
    s="$(docker inspect -f '{{.State.Health.Status}} {{.Config.Image}}' arsnova-v3-app 2>/dev/null || echo fehlt -)"
    [[ "$s" =~ ^healthy\ .*@sha256:[a-f0-9]{64}$ ]]; pruef "App healthy, Image per Digest" $? "$s"
    h="$(docker exec arsnova-v3-app wget -qO- -T 5 http://localhost:3000/trpc/health.check 2>/dev/null | jq -c '.result.data | {status, redis}')"
    [[ "$h" == '{"status":"ok","redis":"ok"}' ]]; pruef "health.check" $? "$h"
    for v in QA_SUMMARY_ENABLED OPEN_WEIGHT_LLM_ENABLED OPEN_WEIGHT_LLM_URL QA_SUMMARY_TIMEOUT_MS OPEN_WEIGHT_LLM_SUMMARY_TIMEOUT_MS; do
      echo "INFO    $(grep -E "^$v=" .env.production)"
    done
    pub="$(ss -ltn | awk '$4 ~ /:300[0-2]$/ && $4 !~ /^127\.0\.0\.1:/ {print $4}' | paste -sd' ')"
    [[ -z "$pub" ]]; pruef "App-Ports nur Loopback" $? "${pub:-nur 127.0.0.1}"
    c="$(code "http://$LLM_IP:8080/health")"
    [[ "$c" == 200 ]]; pruef "§11 /health vom app-host" $? "HTTP $c"
    curl -fsS --max-time 5 -H "Authorization: Bearer $T" "http://$LLM_IP:8080/slots?fail_on_no_slot=1" |
      jq -e 'type == "array" and length == 1' >/dev/null
    pruef "§11 mit Token ein Slot" $? ""
    docker exec arsnova-v3-app wget -qO /dev/null -T 5 "http://$LLM_IP:8080/health"
    pruef "§11 aus dem App-Container" $? ""
    ;;
  *) echo "Aufruf: $0 llm|app" >&2; exit 2 ;;
esac
exit "$fehler"
