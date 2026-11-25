#!/usr/bin/env bash
# Schrittanzeige für labor.sh up, wie labor.ps1 unter Windows (Get-LaborPlan, Get-Restzeit, Format-Dauer):
#   [n/7] Text (dauert …) - seit Beginn M:SS, noch etwa M:SS, fertig gegen HH:MM
# Zum Einbinden per source; Tests: fortschritt.test.mjs. FS_JETZT (Epoche) nur für Tests.

fs_plan() {
  # Geschätzte Sekunden je Schritt von labor.sh up (ThinkPad P50, Aufbau 2026-11-13: 48 min, eher großzügig):
  # 1 Voraussetzungen, 2 Größen, 3 VMs und cloud-init, 4 Modell kopieren, 5 llm-host, 6 app-host, 7 Prüfen.
  echo 15 15 600 90 900 1200 120
}

fs_restzeit() { # erledigte Schritte → Sekunden der offenen Schritte
  local -a plan; read -r -a plan <<<"$(fs_plan)"
  local i rest=0
  for ((i = $1; i < ${#plan[@]}; i++)); do rest=$((rest + plan[i])); done
  echo "$rest"
}

fs_dauer() { # Sekunden → M:SS oder H:MM:SS
  local s=$1
  if ((s >= 3600)); then printf '%d:%02d:%02d\n' $((s / 3600)) $((s % 3600 / 60)) $((s % 60))
  else printf '%d:%02d\n' $((s / 60)) $((s % 60)); fi
}

fs_schritt() { # nummer text dauer-text
  local jetzt="${FS_JETZT:-$(date +%s)}"
  local -a plan
  read -r -a plan <<<"$(fs_plan)"
  [[ -n "${FS_BEGINN:-}" ]] || FS_BEGINN=$jetzt
  local rest; rest="$(fs_restzeit $(($1 - 1)))"
  local d=''; [[ -n "${3:-}" ]] && d=" (dauert $3)"
  printf '\n[%d/%d] %s%s - seit Beginn %s, noch etwa %s, fertig gegen %s\n' \
    "$1" "${#plan[@]}" "$2" "$d" "$(fs_dauer $((jetzt - FS_BEGINN)))" "$(fs_dauer "$rest")" \
    "$(date -d "@$((jetzt + rest))" +%H:%M)"
}
