#!/usr/bin/env bash
# Bibliothek für lauf.sh; Import führt keine VM-Befehle aus.
experiment_lease_pruefen() {
  "${LLM[@]}" 'test ! -d ~/labor-1b/stoerung-lease' || {
    echo 'Offenes Störungs-Lease oder SSH-Fehler: kein neuer Lauf. Rücknahme separat freigeben und prüfen.' >&2
    return 1
  }
}

experiment_kontext() {
  # EXIT läuft ggf. erst nach der Rückkehr aus lauf(): Kontext nicht lokal halten.
  out="$1"
  experiment_offen=0
  experiment_pruefen=0
  legacy_runtime_aus=0
}

experiment_anwenden() {
  local variante delay
  variante="$(jq -r .variant "$out/experiment-config.json")"
  delay="$(jq -r .fakeDelayMs "$out/experiment-config.json")"
  if [[ "$variante" != normal ]]; then
    experiment_offen=1 # vor dem ersten mutierenden Befehl, auch bei Teilfehlern
    "${LLM[@]}" "cd arsnova.eu && node $EV/fault-vm.mjs apply $variante $delay" >"$out/stoerung-aktiv.json"
  fi
}

experiment_zuruecknehmen() {
  if [[ "${experiment_offen:-0}" == 1 ]]; then
    "${LLM[@]}" "cd arsnova.eu && node $EV/fault-vm.mjs undo" >"$out/stoerung-ruecknahme.json" || return 1
  fi
  # Frische Runtime auch vor den Prüf-Inferenzen: höchstens zehn Messaufträge
  # pro Runtime, Prüfungen und Kontrolle gehören nicht in denselben Zähler.
  runtime_frisch || return 1
  "${LLM[@]}" "cd arsnova.eu && bash $EV/pruefen.sh llm" >"$out/pruefen-llm.txt" 2>&1 || return 1
  bash "$EV/pruefen.sh" app >"$out/pruefen-app.txt" 2>&1 || return 1
  if [[ "${experiment_offen:-0}" == 1 ]]; then
    "${LLM[@]}" 'cat ~/labor-1b/stoerung-journal.jsonl' >"$out/stoerung-journal.jsonl" || return 1
  fi
  experiment_offen=0
  experiment_pruefen=0
  printf '{"restored":true,"checksPassed":true}\n' >"$out/wiederherstellung.json"
}

lauf_ende() {
  local code=$?
  trap - EXIT INT TERM
  aufraeumen
  if [[ "${experiment_offen:-0}" == 1 || "${experiment_pruefen:-0}" == 1 ]]; then
    if ! experiment_zuruecknehmen; then
      echo 'Rücknahme/Prüfung fehlgeschlagen. Nicht weiter messen; Lease und Journal im llm-host prüfen.' >&2
      code=1
    fi
  elif [[ "${legacy_runtime_aus:-0}" == 1 ]]; then
    runtime_frisch || code=1
  fi
  exit "$code"
}
