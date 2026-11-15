#!/usr/bin/env bash
# 1B-Lauf im app-host, aus dem Repo-Checkout aufzurufen (ADR 1B-006, 1B-007, 1B-008).
# Vom Rechner aus: labor.sh lauf|kalibrierung (bzw. labor.ps1), die die Ergebnisse zurückholen.
#
#   lauf.sh vorbereiten    Treiber-Abhängigkeiten, SSH-Schlüssel app-host → llm-host prüfen
#   lauf.sh kalibrierung   eine nicht gewertete Anfrage an eine frische Runtime, Timeout nach Regel
#   lauf.sh lauf           Mitschnitt auf beiden Hosts, n Aufträge, Zeitzerlegung, Kontrolle C0
#   lauf.sh auswerten DIR  nur die Auswertung auf vorhandenen Rohdaten wiederholen
#   lauf.sh kontrolle      C0: kurze Anfrage je 30-mal vom llm-host und vom app-host (Nachtrag M2)
#   lauf.sh belege         ufw, ss -ltnp, chrony, tcpdump zur NAT-Annahme, .env ohne Secrets, Manifest (M1)
#   LAB_RUNTIME_AUS=1 lauf.sh lauf   B0: Aufträge bei gestoppter Runtime (Nachtrag M3)
#
# Umgebung (Standard): LAB_N (10, höchstens 10 je frischer Runtime, ADR 1B-007), LAB_TAG,
# LAB_TIMEOUT_MS (90000), LAB_OUTDIR (~/labor-1b), LAB_BODY (Prompt-Body für die Kalibrierung,
# sonst der jüngste body.json), LAB_PROFIL_IST und LAB_RECHNER (vom Rechner gesetzt).
# Mitschnitte enthalten den Runtime-Token im Authorization-Header: sie bleiben in LAB_OUTDIR.
set -euo pipefail
REPO="$(git -C "$(dirname "$(readlink -f "$0")")" rev-parse --show-toplevel)"
cd "$REPO"
EV=docs/referat-thema-1/evidenz/1B
APP_IP=192.168.150.10 LLM_IP=192.168.150.20
OUTBASE="${LAB_OUTDIR:-$HOME/labor-1b}"
KEY="$HOME/.ssh/labor-llm"
LLM=(ssh -i "$KEY" -o StrictHostKeyChecking=accept-new -o BatchMode=yes -o ConnectTimeout=5 "labor@$LLM_IP")
mkdir -p "$OUTBASE"
log() { echo "$(date --iso-8601=seconds) $*" >&2; }

vorbereiten() {
  [[ -f "$KEY" ]] || ssh-keygen -q -t ed25519 -N '' -C labor-app-zu-llm -f "$KEY"
  "${LLM[@]}" true 2>/dev/null || {
    echo "app-host erreicht den llm-host nicht per SSH; Schlüssel $KEY.pub dort eintragen (labor.sh macht das)." >&2
    exit 1
  }
  # Nur beim ersten Lauf; Wiederholung, weil npm am 2026-11-13 mit ETIMEDOUT abbrach.
  local i
  for i in 1 2 3 4 5; do
    [[ -d node_modules/@trpc/client ]] && break
    npm ci --ignore-scripts --no-audit --no-fund || { echo "npm ci $i fehlgeschlagen" >&2; sleep 30; }
  done
  [[ -d node_modules/@trpc/client ]] || { echo "npm ci fünfmal fehlgeschlagen" >&2; exit 1; }
  [[ -f libs/shared-types/dist/index.js ]] || npm run build -w @arsnova/shared-types
  log "vorbereitet"
}

runtime_frisch() {
  log "Runtime frisch starten"
  "${LLM[@]}" "cd arsnova.eu && docker compose -f docker-compose.llm.yml -f $EV/llm-vm.override.yml --env-file .env.llm --profile llm down && bash $EV/llm-start.sh" >&2
}

# Eine Anfrage direkt im llm-host (ohne App und Netz zwischen den Hosts); Body von stdin.
direkt() {
  "${LLM[@]}" "T=\$(sed -n 's/^OPEN_WEIGHT_LLM_TOKEN=//p' arsnova.eu/.env.llm); curl -sS -o /tmp/direkt.json -w '%{time_starttransfer} %{time_total} %{http_code}' --max-time 600 -H \"Authorization: Bearer \$T\" -H 'Content-Type: application/json' --data-binary @- http://$LLM_IP:8080/v1/chat/completions; echo; jq -c '{prompt_ms: .timings.prompt_ms, predicted_ms: .timings.predicted_ms, prompt_n: .timings.prompt_n, predicted_n: .timings.predicted_n, cache_n: .timings.cache_n}' /tmp/direkt.json; rm -f /tmp/direkt.json"
}

kalibrierung() {
  vorbereiten
  local body="${LAB_BODY:-$(ls -t "$OUTBASE"/*/body.json 2>/dev/null | head -n 1)}"
  [[ -f "$body" ]] || { echo "Kein Prompt-Body: erst einen Lauf (z. B. LAB_TAG=probe LAB_N=1) ausführen oder LAB_BODY setzen." >&2; exit 1; }
  runtime_frisch
  log "Kalibrierung mit $body"
  local out; out="$(direkt <"$body")"
  local zeit; zeit="$(head -n 1 <<<"$out")"
  local t; t="$(tail -n 1 <<<"$out")"
  local i; i="$(jq -r '(.prompt_ms + .predicted_ms) | floor' <<<"$t")"
  local timeout
  if ((i <= 75000)); then timeout=90000; elif ((i <= 270000)); then timeout=300000; else timeout=abbruch; fi
  local f; f="$OUTBASE/kalibrierung-$(date +%Y%m%dT%H%M%S).json"
  jq -n --argjson t "$t" --arg zeit "$zeit" --argjson i "$i" --arg timeout "$timeout" \
    --arg profil "${LAB_PROFIL_IST:-unbekannt}" --arg rechner "${LAB_RECHNER:-unbekannt}" --arg commit "$(git rev-parse HEAD)" \
    '{commit: $commit, rechner: $rechner, energieprofil: $profil, timings: $t, curl: $zeit, I_ms: $i, timeoutMs: (if $timeout == "abbruch" then $timeout else ($timeout | tonumber) end),
      regel: "I <= 75 s: 90000; 75 s < I <= 270 s: 300000; sonst Abbruch (ADR 1B-005)"}' | tee "$f"
  [[ "$timeout" != abbruch ]] || { echo "I > 270 s: Abbruch, der Autor entscheidet." >&2; exit 3; }
  echo "$f"
}

# Kurze Anfrage für C0 (Design-Nachtrag 2026-11-13, M2): misst Strecke und Server, kaum Inferenz.
KURZ='{"model":"qwen3-4b-instruct-2507-q4_k_m","messages":[{"role":"system","content":"Antworte nur mit dem Wort bereit."},{"role":"user","content":"Kurzer technischer Bereitschaftstest."}],"temperature":0,"max_tokens":16,"stream":false,"reasoning_effort":"none","chat_template_kwargs":{"enable_thinking":false}}'
C0_FORMAT='%{time_connect} %{time_starttransfer} %{time_total} %{http_code}'

kontrolle() { # M2: dieselbe kurze Anfrage je 30-mal vom llm-host an sich selbst und vom app-host, abwechselnd
  vorbereiten
  local n="${LAB_N_C0:-30}" id out i
  id="$(date +%Y%m%dT%H%M%S)-kontrolle-c0"
  out="$OUTBASE/$id"
  mkdir -p "$out"
  runtime_frisch
  local t_app; t_app="$(sed -n 's/^OPEN_WEIGHT_LLM_TOKEN=//p' .env.production)"
  log "C0: $n kurze Anfragen je Seite, abwechselnd"
  for ((i = 1; i <= n; i++)); do
    "${LLM[@]}" "T=\$(sed -n 's/^OPEN_WEIGHT_LLM_TOKEN=//p' arsnova.eu/.env.llm); curl -sS -o /dev/null -w '$C0_FORMAT' -H \"Authorization: Bearer \$T\" -H 'Content-Type: application/json' --data-binary @- http://$LLM_IP:8080/v1/chat/completions; echo" <<<"$KURZ" >>"$out/llm.txt"
    curl -sS -o /dev/null -w "$C0_FORMAT" -H "Authorization: Bearer $t_app" -H 'Content-Type: application/json' \
      --data-binary "$KURZ" "http://$LLM_IP:8080/v1/chat/completions" >>"$out/app.txt"
    echo >>"$out/app.txt"
  done
  # Sekunden → ms; Median wie zeitzerlegung.mjs (gerade Anzahl: Mittel der beiden mittleren Werte).
  jq -n --arg id "$id" --arg commit "$(git rev-parse HEAD)" --arg profil "${LAB_PROFIL_IST:-unbekannt}" \
    --rawfile app "$out/app.txt" --rawfile llm "$out/llm.txt" '
    def zeilen: split("\n") | map(select(length > 0) | split(" ") | {connectMs: (.[0] | tonumber * 1000), ttfbMs: (.[1] | tonumber * 1000), totalMs: (.[2] | tonumber * 1000), http: (.[3] | tonumber)});
    def median: sort | if length % 2 == 1 then .[length / 2 | floor] else (.[length / 2 - 1] + .[length / 2]) / 2 end;
    ($app | zeilen) as $a | ($llm | zeilen) as $l |
    {lauf: $id, art: "kontrolle-c0", commit: $commit, energieprofil: $profil, n: ($a | length),
     anfrage: "kurz, max_tokens 16 (Design-Nachtrag 2026-11-13, M2)",
     vomAppHost: $a, vomLlmHost: $l,
     kennzahlen: {medianAppMs: ($a | map(.totalMs) | median), medianLlmMs: ($l | map(.totalMs) | median),
       differenzMs: (($a | map(.totalMs) | median) - ($l | map(.totalMs) | median)),
       alleHttp200: (($a + $l) | all(.http == 200)),
       hC0: ((($a | map(.totalMs) | median) - ($l | map(.totalMs) | median)) <= 5 and (($a + $l) | all(.http == 200)))}}' \
    >"$out/ergebnis.json"
  jq '.kennzahlen' "$out/ergebnis.json" >&2
  runtime_frisch
  echo "$out"
}

belege() { # M1: Netz-, Uhren- und Reproduktionsbelege ohne Secrets (Dossier 10.6)
  vorbereiten
  local id out
  id="$(date +%Y%m%dT%H%M%S)-belege"
  out="$OUTBASE/$id"
  mkdir -p "$out"
  log "Belege nach $out"
  { sudo ufw status verbose 2>&1 || echo "(ufw nicht aktiv oder nicht installiert)"; } >"$out/app-ufw.txt"
  "${LLM[@]}" 'sudo ufw status verbose' >"$out/llm-ufw.txt" 2>&1
  sudo ss -ltnp >"$out/app-ss-ltnp.txt" 2>&1
  "${LLM[@]}" 'sudo ss -ltnp' >"$out/llm-ss-ltnp.txt" 2>&1
  chronyc tracking >"$out/app-chrony.txt" 2>&1 || true
  "${LLM[@]}" 'chronyc tracking' >"$out/llm-chrony.txt" 2>&1 || true
  # NAT-Annahme: eine Anfrage aus dem App-Container erscheint am llm-host mit der Adresse des app-hosts.
  # Nur Kopfzeilen (-q, keine Nutzdaten), ohne Token (die Antwort 401 genügt für die Adressen).
  "${LLM[@]}" "IF=\$(ip -o route get $APP_IP | awk '{for(i=1;i<=NF;i++) if(\$i==\"dev\") print \$(i+1)}'); sudo timeout 25 tcpdump -nn -q -l -c 6 -i \"\$IF\" 'tcp port 8080' > /tmp/1b-nat.txt 2>/dev/null &"
  sleep 3
  docker exec arsnova-v3-app node -e "fetch('http://$LLM_IP:8080/health').then(r => console.log('HTTP ' + r.status)).catch(e => console.log(String(e)))" >"$out/app-container-anfrage.txt" 2>&1
  sleep 5
  "${LLM[@]}" 'sleep 2; cat /tmp/1b-nat.txt; rm -f /tmp/1b-nat.txt' >"$out/llm-tcpdump-nat.txt" 2>&1
  bash "$EV/env-ohne-secrets.sh" <.env.production >"$out/app-env-production-ohne-secrets.txt"
  "${LLM[@]}" 'cat arsnova.eu/.env.llm' | bash "$EV/env-ohne-secrets.sh" >"$out/llm-env-llm-ohne-secrets.txt"
  local llm_img llm_args
  llm_img="$("${LLM[@]}" "docker inspect -f '{{.Config.Image}}' arsnova-open-weight-llm")"
  llm_args="$("${LLM[@]}" "docker inspect -f '{{json .Args}}' arsnova-open-weight-llm" | sed 's/"--api-key","[^"]*"/"--api-key","(nicht ausgegeben)"/')"
  jq -n --arg commit "$(git rev-parse HEAD)" --arg appImage "$(docker inspect -f '{{.Config.Image}}' arsnova-v3-app)" \
    --arg llmImage "$llm_img" --argjson llmArgs "$llm_args" --slurpfile modell docker/open-weight-llm/model-manifest.json \
    '{commit: $commit, appImage: $appImage, llmImage: $llmImage, llamaServerArgs: $llmArgs,
      modell: {datei: $modell[0].filename, sha256: $modell[0].sha256}}' >"$out/manifest.json"
  # Kein Token darf in den Belegen stehen (Gegenprobe gegen beide Token-Werte).
  local t1 t2
  t1="$(sed -n 's/^OPEN_WEIGHT_LLM_TOKEN=//p' .env.production)"
  t2="$("${LLM[@]}" "sed -n 's/^OPEN_WEIGHT_LLM_TOKEN=//p' arsnova.eu/.env.llm")"
  if grep -rqF -e "$t1" -e "$t2" "$out"; then echo "Token in den Belegen gefunden: Abbruch" >&2; rm -rf "$out"; exit 1; fi
  log "Belege fertig (Token-Gegenprobe ok)"
  echo "$out"
}

b0_auswerten() { # app.log → je Auftrag effectiveMode, fallbackReason, latencyMs (Runtime aus, M3)
  node -e '
    const t = require("fs").readFileSync(process.argv[1], "utf8");
    const r = [...t.matchAll(/qa_summary:completed \{([^}]*)\}/g)].map((m) => ({
      effectiveMode: (m[1].match(/effectiveMode: .([a-z-]+)/) || [])[1] ?? null,
      fallbackReason: (m[1].match(/fallbackReason: .([a-z_]+)/) || [])[1] ?? null,
      latencyMs: Number((m[1].match(/latencyMs: (\d+)/) || [])[1]),
    }));
    console.log(JSON.stringify(r));' "$1"
}

aufraeumen() { # Mitschnitte und Speicherschleife stoppen; auch nach Abbruch (trap)
  sudo pkill -INT -f '^tcpdump .*-w .*labor-1b/.*/app\.pcap' 2>/dev/null || true
  "${LLM[@]}" "sudo pkill -INT -f '^tcpdump .*-w /tmp/1b-srv\.pcap' 2>/dev/null; [ -f /tmp/1b-mem.pid ] && kill \$(cat /tmp/1b-mem.pid) 2>/dev/null; pkill -f '1b-mem\.csv' 2>/dev/null; rm -f /tmp/1b-mem.pid; true" 2>/dev/null || true
}

mitschnitt_start() { # wo datei
  local filt="host $LLM_IP and tcp port 8080 and host $APP_IP"
  local cmd="IF=\$(ip -o route get $LLM_IP | awk '{for(i=1;i<=NF;i++) if(\$i==\"dev\") print \$(i+1)}'); [ \"\$IF\" = lo ] && IF=\$(ip -o route get $APP_IP | awk '{for(i=1;i<=NF;i++) if(\$i==\"dev\") print \$(i+1)}'); sudo nohup tcpdump -Z labor -i \"\$IF\" -s 0 -U -w $2 '$filt' >/dev/null 2>&1 & sleep 2; pgrep -f '^tcpdump .*-w $2' >/dev/null"
  if [[ "$1" == app ]]; then bash -c "$cmd"; else "${LLM[@]}" "$cmd"; fi
}

mitschnitt_stop() { # wo datei
  local cmd="sudo pkill -INT -f '^tcpdump .*-w $2' || true; sleep 2"
  if [[ "$1" == app ]]; then bash -c "$cmd"; else "${LLM[@]}" "$cmd"; fi
}

felder() { # pcap → tshark-Felder für zeitzerlegung.mjs
  tshark -r "$1" -T fields -E separator=/t -e frame.time_epoch -e tcp.stream -e ip.src -e tcp.len \
    -e http.request.method -e http.request.uri -e http.response.code
}

auswerten() { # Rohdatenverzeichnis eines Laufs → timings, body, zerlegung
  local out="$1"
  log "Auswertung $out"
  felder "$out/app.pcap" >"$out/app.tsv"
  felder "$out/srv.pcap" >"$out/srv.tsv"
  # -2: zweiter Durchlauf, sonst bleibt http.response_in in tshark 4.2 leer.
  tshark -2 -r "$out/app.pcap" -Y 'http.request.method == "POST" || http.response' -T fields -E separator=/t \
    -e frame.number -e http.request.method -e http.response_in -e http.file_data >"$out/http.tsv"
  node "$EV/messung/timings.mjs" timings "$out/http.tsv" >"$out/timings.json"
  node "$EV/messung/timings.mjs" body "$out/http.tsv" >"$out/body.json"
  node "$EV/messung/zeitzerlegung.mjs" --app "$out/app.tsv" --srv "$out/srv.tsv" --log "$out/app.log" \
    --timings "$out/timings.json" --app-ip "$APP_IP" --out "$out/zerlegung.json" >&2

}

lauf() {
  local n="${LAB_N:-10}" tag="${LAB_TAG:-}" timeout="${LAB_TIMEOUT_MS:-}"
  [[ "$timeout" == 90000 || "$timeout" == 300000 ]] ||
    { echo "LAB_TIMEOUT_MS fehlt oder ist nicht 90000/300000 (Ergebnis der Kalibrierung, ADR 1B-005)." >&2; exit 1; }
  ((n >= 1 && n <= 10)) || { echo "LAB_N muss 1..10 sein (höchstens 10 Aufträge je frischer Runtime)." >&2; exit 1; }
  local id; id="$(date +%Y%m%dT%H%M%S)${tag:+-$tag}"
  local out="$OUTBASE/$id"
  mkdir -p "$out"
  vorbereiten

  log "Timeouts auf $timeout ms, App neu starten"
  # Flags wie im Laboraufbau erzwingen (ein Trockenlauf schaltet das LLM ab).
  sed -i -e "s/^QA_SUMMARY_TIMEOUT_MS=.*/QA_SUMMARY_TIMEOUT_MS=$timeout/" \
    -e "s/^QA_SUMMARY_ENABLED=.*/QA_SUMMARY_ENABLED=true/" -e "s/^OPEN_WEIGHT_LLM_ENABLED=.*/OPEN_WEIGHT_LLM_ENABLED=true/" \
    -e "s/^OPEN_WEIGHT_LLM_SUMMARY_TIMEOUT_MS=.*/OPEN_WEIGHT_LLM_SUMMARY_TIMEOUT_MS=$timeout/" .env.production
  bash "$EV/app-start.sh" </dev/null >"$out/app-start.log" 2>&1
  runtime_frisch
  local aus="${LAB_RUNTIME_AUS:-}"
  if [[ -n "$aus" ]]; then log "B0: Runtime stoppen"; "${LLM[@]}" 'docker stop arsnova-open-weight-llm' >&2; fi

  aufraeumen
  "${LLM[@]}" 'rm -f /tmp/1b-srv.pcap /tmp/1b-mem.csv'
  trap aufraeumen EXIT
  log "Speicherlog (15 s) und Mitschnitte starten"
  "${LLM[@]}" "c=\$(docker inspect -f '{{.Id}}' arsnova-open-weight-llm); m=/sys/fs/cgroup/system.slice/docker-\$c.scope/memory.current; echo zeit,mem_bytes,restarts,oom_killed > /tmp/1b-mem.csv; nohup bash -c \"while :; do echo \\\$(date +%s),\\\$(cat \$m),\\\$(docker inspect -f '{{.RestartCount}},{{.State.OOMKilled}}' arsnova-open-weight-llm); sleep 15; done >> /tmp/1b-mem.csv\" >/dev/null 2>&1 & echo \$! > /tmp/1b-mem.pid"
  mitschnitt_start app "$out/app.pcap"
  mitschnitt_start llm "/tmp/1b-srv.pcap"
  local start; start="$(date --iso-8601=seconds)"

  log "Treiber: $n Aufträge"
  node "$EV/treiber.mjs" --trpc http://127.0.0.1:3000/trpc --auftraege "$n" --out "$out/treiber.json" 2>"$out/treiber.log"

  sleep 3
  mitschnitt_stop app "$out/app.pcap"
  mitschnitt_stop llm "/tmp/1b-srv.pcap"
  "${LLM[@]}" 'kill $(cat /tmp/1b-mem.pid) 2>/dev/null; cat /tmp/1b-mem.csv' >"$out/speicher.csv"
  "${LLM[@]}" 'cat /tmp/1b-srv.pcap; rm -f /tmp/1b-srv.pcap' >"$out/srv.pcap"
  docker logs --since "$start" arsnova-v3-app >"$out/app.log" 2>&1

  local auswertung=ok c0='' c0t=null b0='null'
  if [[ -n "$aus" ]]; then
    # B0: ohne Runtime gibt es keine POSTs und keine timings; ausgewertet wird das App-Log.
    auswertung=b0
    b0="$(b0_auswerten "$out/app.log" | jq '{auftraege: ., kennzahlen: {n: length,
      medianJobMs: (map(.latencyMs) | sort | if length % 2 == 1 then .[length / 2 | floor] else (.[length / 2 - 1] + .[length / 2]) / 2 end),
      alleUnavailable: all(.effectiveMode == "extractive" and .fallbackReason == "unavailable")}}
      | .kennzahlen.hB0 = (.kennzahlen.alleUnavailable and .kennzahlen.medianJobMs <= 2000)')"
    echo '{"hinweis":"B0: Runtime aus, keine Zeitzerlegung"}' >"$out/zerlegung.json"
    runtime_frisch
  else
    auswerten "$out" || { auswertung=fehlgeschlagen; log "Auswertung fehlgeschlagen; Rohdaten bleiben, später: lauf.sh auswerten $out"; }
    [[ -f "$out/zerlegung.json" && "$auswertung" == ok ]] || echo '{"fehler":"Auswertung fehlgeschlagen"}' >"$out/zerlegung.json"

    # Kontrolle C0 (Design 5) an einer frischen Runtime: sonst bekäme sie n + 1 Anfragen (ADR 1B-007).
    runtime_frisch
    log "Kontrolle C0: erster Prompt direkt im llm-host"
    if [[ -s "$out/body.json" ]]; then c0="$(direkt <"$out/body.json")" || c0=''; fi
    jq -e 'type == "object"' >/dev/null 2>&1 <<<"$(tail -n 1 <<<"$c0")" && c0t="$(tail -n 1 <<<"$c0")"
  fi

  local llm_info app_img
  llm_info="$("${LLM[@]}" "docker inspect -f '{{json .Config.Image}} {{json .Args}}' arsnova-open-weight-llm; nproc; free -g | awk '/^Mem:/ {print \$2}'")"
  app_img="$(docker inspect -f '{{.Config.Image}}' arsnova-v3-app)"
  jq -n \
    --arg id "$id" --arg tag "$tag" --argjson n "$n" --argjson timeout "$timeout" \
    --arg commit "$(git rev-parse HEAD)" --arg profil "${LAB_PROFIL_IST:-unbekannt}" --arg rechner "${LAB_RECHNER:-unbekannt}" \
    --arg appImage "$app_img" --arg llmInfo "$llm_info" --arg appVcpu "$(nproc)" \
    --arg modellSha "$(jq -r .sha256 docker/open-weight-llm/model-manifest.json)" \
    --slurpfile treiber "$out/treiber.json" --slurpfile zerlegung "$out/zerlegung.json" \
    --arg c0curl "$(head -n 1 <<<"$c0")" --argjson c0timings "$c0t" --arg auswertung "$auswertung" \
    --rawfile speicher "$out/speicher.csv" --argjson b0 "$b0" \
    '{lauf: $id, tag: $tag, n: $n, auswertung: $auswertung, b0: $b0, timeoutMs: $timeout, commit: $commit, rechner: $rechner, energieprofil: $profil,
      appHost: {vcpu: ($appVcpu | tonumber), image: $appImage},
      llmHost: {info: $llmInfo, modellSha256: $modellSha},
      treiber: $treiber[0], zerlegung: $zerlegung[0],
      kontrolleC0: {curl: $c0curl, hinweis: "time_starttransfer time_total http_code; frische Runtime", timings: $c0timings},
      speicher: ($speicher | split("\n") | map(select(. != "" and (startswith("zeit") | not))) | map(split(",")) | map(select(.[1] != "")) |
        {proben: length, maxBytes: (map(.[1] | tonumber) | max), restartsMax: (map(.[2] | tonumber) | max),
         oomKilled: (map(.[3]) | any(. == "true"))})}' >"$out/ergebnis.json"
  log "fertig: $out/ergebnis.json"
  echo "$out"
}

case "${1:-}" in
  vorbereiten) vorbereiten ;;
  kalibrierung) kalibrierung ;;
  lauf) lauf ;;
  kontrolle) kontrolle ;;
  belege) belege ;;
  auswerten) auswerten "${2:?Verzeichnis fehlt}" ;;
  *) echo "Aufruf: $0 vorbereiten|kalibrierung|lauf|kontrolle|belege|auswerten DIR" >&2; exit 2 ;;
esac
