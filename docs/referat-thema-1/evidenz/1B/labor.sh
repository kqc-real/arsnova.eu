#!/usr/bin/env bash
# 1B-Labor unter Linux mit einem Befehl (ADR 1B-010):
#   labor.sh up        Voraussetzungen, Größenwahl, VMs, llm-host, app-host, Prüfungen
#   labor.sh groessen  nur Empfehlung und Größenwahl anzeigen, nichts anlegen
#   labor.sh pruefen   nur die Prüfungen (Runbook §10, §11, Negativtests), Bericht schreiben
#   labor.sh kalibrierung  eine nicht gewertete Anfrage, Timeout nach Regel (ADR 1B-005)
#   labor.sh lauf      gewerteter Lauf (LAB_N, LAB_TAG, LAB_TIMEOUT_MS), Ergebnis nach messung/
#                      LAB_RUNTIME_AUS=1: B0, Aufträge bei gestoppter Runtime
#   labor.sh kontrolle C0: kurze Anfrage je 30-mal vom llm-host und vom app-host
#   labor.sh belege    ufw, ss -ltnp, chrony, tcpdump zur NAT-Annahme, .env ohne Secrets, Manifest
#                      LAB_PROFIL: performance (Standard, wie 1C gehalten) oder unveraendert;
#                      LAB_TAG mit Präfix dev oder probe: kommt nicht ins Repo; Timeout ohne
#                      LAB_TIMEOUT_MS aus der jüngsten Kalibrierung mit gleichem Energieprofil
#   labor.sh status    VMs, Pinning, Docker, Repo-Stand
#   labor.sh umgebung  Rechner, Hypervisor und VMs als JSON (steht auch in jedem Ergebnis)
#   labor.sh stop      beide VMs herunterfahren (RAM und CPU wieder frei, Disks bleiben)
#   labor.sh start     beide VMs starten, auf die Dienste warten, prüfen
#   labor.sh destroy   VMs, Disks und Netz entfernen (fragt nach)
#
# Ohne Rückfragen: LAB_JA=1. Eigene Größen: LAB_LLM_VCPU, LAB_LLM_RAM_GIB, LAB_LLM_DISK_GIB,
# LAB_APP_VCPU, LAB_APP_RAM_GIB, LAB_APP_DISK_GIB (Pinning rechnet labor.sh). RAM-Reserve für den
# Rechner: LAB_RAM_RESERVE_GIB (Standard 4, mindestens 2; kleiner nur auf Testrechnern ohne andere Programme). Bericht und Logs: LAB_OUTDIR (~/labor-1b).
# Weitere Variablen: vm/vm-linux.sh. Windows: labor.ps1.
set -euo pipefail
HERE="$(cd "$(dirname "$(readlink -f "$0")")" && pwd)"
REPO="$(git -C "$HERE" rev-parse --show-toplevel)"
# shellcheck source=groessen.sh
source "$HERE/groessen.sh"
# shellcheck source=fortschritt.sh
source "$HERE/fortschritt.sh"
VMDIR="${LAB_VMDIR:-/var/lib/libvirt/images/arsnova-1b}"
OUT="${LAB_OUTDIR:-$HOME/labor-1b}"
APP=192.168.150.10 LLM=192.168.150.20
EV=docs/referat-thema-1/evidenz/1B
SSH=(ssh -o StrictHostKeyChecking=accept-new -o UserKnownHostsFile="$VMDIR/known_hosts" -o ConnectTimeout=5)
mkdir -p "$OUT"

interaktiv() { [[ -t 0 && "${LAB_JA:-}" != 1 ]]; }
# sudo nur, wenn es ohne Rückfrage geht oder ein Terminal das Passwort abfragen kann.
sudo_moeglich() { [[ -t 0 ]] || sudo -n true 2>/dev/null; }
frage() { # text standard(j|n) → 0 bei ja
  local a
  [[ "${LAB_JA:-}" == 1 ]] && return 0
  if ! interaktiv; then [[ "$2" == j ]]; return; fi
  read -r -p "$1 " a
  a="${a:-$2}"
  [[ "${a,,}" == j* || "${a,,}" == y* ]]
}

text() {
  case "$1" in
    llm-unter-4) echo "llm-host unter 4 vCPU: Inferenz deutlich langsamer, Zahlen nicht mit dem Messrechner vergleichbar." ;;
    app-ram-4) echo "app-host nur 4 GiB: der App-Build in der VM wird knapp und langsam." ;;
    llm-ram-10) echo "llm-host nur 10 GiB: Container-Limit 8 GiB bleibt, wenig Puffer für das System der VM." ;;
    host-ram-2) echo "Rechnerisch blieben dem Rechner nur ~2 GiB; der Start verlangt ${LAB_RAM_RESERVE_GIB:-4} GiB Reserve auf den verfügbaren RAM. Andere Programme schließen; sonst bricht up vor dem Anlegen ab." ;;
    ram-zu-klein) echo "Zu wenig RAM: mindestens 16 GiB nötig (llm 10 + app 4 + Rechner 2)." ;;
    kerne-zu-wenig) echo "Zu wenige Kerne: der llm-host braucht mindestens 2 physische Kerne (ohne SMT 4)." ;;
    llm-vcpu) echo "llm-host: 2 bis höchstens min(8, physische Kerne) vCPU." ;;
    app-vcpu) echo "app-host: mindestens 1 vCPU." ;;
    vcpu-summe) echo "Zusammen mehr vCPU als Threads des Rechners." ;;
    llm-ram) echo "llm-host: mindestens 10 GiB (Container-Limit 8 GiB plus System)." ;;
    app-ram) echo "app-host: mindestens 4 GiB." ;;
    ram-summe) echo "Zusammen zu viel RAM: dem Rechner müssen 2 GiB bleiben." ;;
    llm-disk) echo "llm-host: Platte mindestens 20 GiB (Modell, Runtime-Image, System)." ;;
    app-disk) echo "app-host: Platte mindestens 25 GiB (der App-Build braucht kurz ~18 GiB)." ;;
    ram-frei) echo "Zu wenig freier RAM: nach dem Start der VMs bliebe dem Rechner weniger als die Reserve (${LAB_RAM_RESERVE_GIB:-4} GiB). Programme schließen oder kleinere Größen wählen." ;;
    disk-frei) echo "Zu wenig freier Platz: nötig sind der erwartete Bedarf (bis 31 GiB) plus 10 GiB Reserve." ;;
    disk-wachstum) echo "Die Platten können im schlimmsten Fall bis zur gewählten Größe wachsen; dann würde der Platz knapp. Während des Aufbaus den freien Platz im Auge behalten." ;;
    *) echo "$1" ;;
  esac
}

voraussetzungen() {
  local fehlt=()
  for c in virsh virt-install qemu-img jq ssh scp git curl sha256sum lscpu; do
    command -v "$c" >/dev/null || fehlt+=("$c")
  done
  command -v xorriso >/dev/null || command -v genisoimage >/dev/null || fehlt+=(xorriso)
  if ((${#fehlt[@]})); then
    echo "Fehlt: ${fehlt[*]}" >&2
    echo "  Arch:          sudo pacman -S --needed libvirt qemu-base virt-install dnsmasq libisoburn jq openssh" >&2
    echo "  Debian/Ubuntu: sudo apt install libvirt-daemon-system qemu-system-x86 qemu-utils virtinst xorriso jq" >&2
    echo "  danach:        sudo systemctl enable --now libvirtd.socket; sudo usermod -aG libvirt \"\$USER\"" >&2
    exit 1
  fi
  [[ -e /dev/kvm ]] || { echo "/dev/kvm fehlt: Virtualisierung im BIOS/UEFI einschalten." >&2; exit 1; }
  LIBVIRT_DEFAULT_URI=qemu:///system virsh -q list >/dev/null 2>&1 || {
    echo "libvirt nicht erreichbar: libvirtd.socket starten und Gruppe libvirt (neu anmelden)." >&2
    exit 1
  }
  local key="${LAB_SSH_KEY:-$HOME/.ssh/id_ed25519.pub}"
  if [[ ! -f "$key" ]]; then
    if frage "SSH-Schlüssel $key fehlt. Neu erzeugen (ohne Passphrase, nur fürs Labor)? [J/n]" j; then
      ssh-keygen -q -t ed25519 -N '' -f "${key%.pub}"
    else
      exit 1
    fi
  fi
  if [[ ! -w "$VMDIR" ]]; then
    echo "VM-Verzeichnis $VMDIR fehlt oder ist nicht beschreibbar (libvirt-qemu muss es lesen können)."
    sudo_moeglich && frage "Mit sudo anlegen? [J/n]" j && sudo install -d -o "$USER" -m 755 "$VMDIR"
    [[ -w "$VMDIR" ]] || exit 1
  fi
  if systemctl is-active -q ufw 2>/dev/null; then
    echo "Host-ufw ist aktiv; ohne Freigabe auf virbr-1b bekommen die VMs keine IP."
    if ! sudo_moeglich; then
      echo "  Ohne Terminal kein sudo; falls nötig von Hand (einmalig, bleibt gesetzt):"
      echo "  sudo ufw allow in on virbr-1b to any port 67 proto udp; sudo ufw allow in on virbr-1b to any port 53; sudo ufw route allow in on virbr-1b"
    elif frage "Freigaben nur für die Labor-Bridge setzen (sudo ufw, DHCP/DNS/Weiterleitung)? [J/n]" j; then
      sudo ufw allow in on virbr-1b to any port 67 proto udp
      sudo ufw allow in on virbr-1b to any port 53
      sudo ufw route allow in on virbr-1b
    fi
  fi
}

# Setzt LAB_LLM_VCPU, LAB_LLM_RAM_GIB, LAB_LLM_DISK_GIB, LAB_LLM_CPUSET und dasselbe für LAB_APP_….
# Mit Argument „anlegen“ prüft es zusätzlich freien RAM und Platz und bricht ab, wenn es nicht reicht.
groessen_waehlen() {
  local -a r
  mapfile -t r < <(groessen_rechner)
  local kerne=${r[0]} threads=${r[1]} ram=${r[2]} topo=${r[3]} j w
  echo "Rechner: $(lscpu | sed -n 's/^Model name: *//p'), $kerne Kerne, $threads Threads, $ram GiB RAM"
  j="$(groessen_empfehlung "$kerne" "$threads" "$ram" "$topo")"
  local abbruch; abbruch="$(jq -r '.abbruch // empty' <<<"$j")"
  local lv lr av ar ld ad
  if [[ -n "$abbruch" ]]; then
    echo "Keine Empfehlung: $(text "$abbruch")"
    [[ -n "${LAB_LLM_VCPU:-}" ]] || exit 1
  else
    lv=$(jq .llm.vcpu <<<"$j") lr=$(jq .llm.ramGib <<<"$j") av=$(jq .app.vcpu <<<"$j") ar=$(jq .app.ramGib <<<"$j")
    ld=$(jq .llm.diskGib <<<"$j") ad=$(jq .app.diskGib <<<"$j")
    printf 'Empfehlung:  llm-host %d vCPU (CPU %s), %d GiB RAM, Platte bis %d GiB\n             app-host %d vCPU (CPU %s), %d GiB RAM, Platte bis %d GiB\n' \
      "$lv" "$(jq -r .llm.cpuset <<<"$j")" "$lr" "$ld" "$av" "$(jq -r .app.cpuset <<<"$j")" "$ar" "$ad"
    for w in $(jq -r '.warnungen[]' <<<"$j"); do echo "  Hinweis: $(text "$w")"; done
  fi
  lv="${LAB_LLM_VCPU:-$lv}" lr="${LAB_LLM_RAM_GIB:-$lr}" av="${LAB_APP_VCPU:-$av}" ar="${LAB_APP_RAM_GIB:-$ar}"
  ld="${LAB_LLM_DISK_GIB:-${ld:-$GROESSEN_LLM_DISK}}" ad="${LAB_APP_DISK_GIB:-${ad:-$GROESSEN_APP_DISK}}"
  if interaktiv && ! frage "Übernehmen? [J/n]" j; then
    while :; do
      read -r -p "llm-host vCPU [$lv]: " x && lv="${x:-$lv}"
      read -r -p "llm-host RAM GiB [$lr]: " x && lr="${x:-$lr}"
      read -r -p "app-host vCPU [$av]: " x && av="${x:-$av}"
      read -r -p "app-host RAM GiB [$ar]: " x && ar="${x:-$ar}"
      read -r -p "llm-host Platte GiB [$ld]: " x && ld="${x:-$ld}"
      read -r -p "app-host Platte GiB [$ad]: " x && ad="${x:-$ad}"
      local f; f="$(groessen_pruefen "$kerne" "$threads" "$ram" "$lv" "$lr" "$av" "$ar" "$ld" "$ad")"
      [[ -z "$f" ]] && break
      echo "  Ungültig: $(text "$f")"
    done
  fi
  local f; f="$(groessen_pruefen "$kerne" "$threads" "$ram" "$lv" "$lr" "$av" "$ar" "$ld" "$ad")"
  [[ -z "$f" ]] || { echo "Ungültige Größen: $(text "$f")" >&2; exit 1; }
  local sets; sets="$(groessen_pinning "$lv" "$av" "$topo")" || exit 1
  export LAB_LLM_VCPU=$lv LAB_LLM_RAM_GIB=$lr LAB_LLM_CPUSET=${sets% *}
  export LAB_APP_VCPU=$av LAB_APP_RAM_GIB=$ar LAB_APP_CPUSET=${sets#* }
  export LAB_LLM_DISK_GIB=$ld LAB_APP_DISK_GIB=$ad
  echo "Gewählt: llm-host $lv vCPU (CPU $LAB_LLM_CPUSET), $lr GiB, Platte $ld GiB; app-host $av vCPU (CPU $LAB_APP_CPUSET), $ar GiB, Platte $ad GiB"
  [[ "${1:-}" == anlegen ]] && ressourcen_pruefen "$((lr + ar))" "$((ld + ad))" "$((lv + av))" "$threads"
}

# ressourcen_pruefen PLAN_RAM PLAN_DISK PLAN_VCPU THREADS: Übersicht und harter Abbruch, wenn der Rechner
# nach dem Start zu wenig RAM oder Platz hätte (groessen_ressourcen). Laufen die VMs schon, nichts zu prüfen.
ressourcen_pruefen() {
  local vm
  for vm in arsnova-1b-llm arsnova-1b-app; do
    LIBVIRT_DEFAULT_URI=qemu:///system virsh dominfo "$vm" >/dev/null 2>&1 && return 0
  done
  local frei_ram frei_disk ort="$VMDIR" j a w
  frei_ram=$(($(awk '/^MemAvailable:/ {print $2}' /proc/meminfo) / 1024 / 1024))
  [[ -d "$ort" ]] || ort="$(dirname "$ort")"
  frei_disk="$(df -BG --output=avail "$ort" | tail -1 | tr -dc 0-9)"
  echo "Belegt: $1 GiB RAM fest, $3 von $4 Threads, Platte bis $2 GiB (real etwa 31 GiB)."
  echo "Frei jetzt: $frei_ram GiB RAM, $frei_disk GiB Platte unter $ort. Dem Rechner blieben etwa $((frei_ram - $1)) GiB RAM."
  local reserve="${LAB_RAM_RESERVE_GIB:-4}"
  ((reserve >= 2)) || { echo "LAB_RAM_RESERVE_GIB mindestens 2" >&2; exit 1; }
  j="$(groessen_ressourcen "$frei_ram" "$frei_disk" "$1" "$2" "$reserve")"
  for w in $(jq -r '.warnungen[]' <<<"$j"); do echo "  Hinweis: $(text "$w")"; done
  a="$(jq -r '.abbruch // empty' <<<"$j")"
  [[ -z "$a" ]] || { echo "Abbruch, es wurde nichts angelegt: $(text "$a")" >&2; exit 1; }
  echo "Zurück zum Ausgangszustand jederzeit mit: labor.sh destroy"
}

modell_kopieren() { # spart den Download in der VM, wenn der Rechner das GGUF schon hat
  local name; name="$(jq -r .filename "$REPO/docker/open-weight-llm/model-manifest.json")"
  local lokal="$REPO/models/open-weight-llm/$name"
  [[ -f "$lokal" ]] || return 0
  "${SSH[@]}" "labor@$LLM" test -f "/srv/arsnova/models/open-weight-llm/$name" && return 0
  echo "== GGUF vom Rechner kopieren"
  scp -q -o UserKnownHostsFile="$VMDIR/known_hosts" "$lokal" "labor@$LLM:/srv/arsnova/models/open-weight-llm/"
}

negativtests() {
  local ok=0 c
  c="$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "http://$LLM:8080/health" || true)"
  if [[ "$c" == 000 ]]; then echo "OK      Rechner → llm-host:8080 gesperrt: keine Antwort"; else echo "FEHLER  Rechner → llm-host:8080 erreichbar: HTTP $c"; ok=1; fi
  local glieder; glieder="$(ip -br link show master virbr-1b | awk '{print $1}' | paste -sd' ')"
  local phys=""
  for i in $glieder; do [[ -e "/sys/class/net/$i/device" ]] && phys+="$i "; done
  if [[ -z "$phys" ]]; then echo "OK      Bridge virbr-1b nur mit VM-Schnittstellen: $glieder"; else echo "FEHLER  physische Schnittstelle in der Bridge: $phys"; ok=1; fi
  local modus; modus="$(LIBVIRT_DEFAULT_URI=qemu:///system virsh net-dumpxml arsnova-1b | sed -n "s/.*<forward mode='\([a-z]*\)'.*/\1/p")"
  if [[ "$modus" == nat ]]; then echo "OK      libvirt-Netz im Modus NAT (keine Portweiterleitung)"; else echo "FEHLER  libvirt-Netz im Modus '$modus'"; ok=1; fi
  local route; route="$(ip route show 192.168.150.0/24)"
  if [[ "$route" == *"dev virbr-1b"* ]]; then echo "OK      Labornetz nur über virbr-1b geroutet"; else echo "FEHLER  Route: $route"; ok=1; fi
  return "$ok"
}

# Umgebung (Rechner, Hypervisor, VMs, Schema 1b-umgebung-1) erfassen und in eine Ergebnisdatei einbetten.
umgebung_einbetten() { # datei
  local u; u="$(LAB_VMDIR="$VMDIR" bash "$HERE/umgebung.sh")" || { echo "Umgebung nicht erfasst" >&2; return 0; }
  jq --argjson u "$u" '. + {umgebung: $u}' "$1" >"$1.neu" && mv "$1.neu" "$1"
}

pruefen() {
  local rc bericht; bericht="$OUT/aufbau-$(date +%Y%m%dT%H%M%S).txt"
  LAB_VMDIR="$VMDIR" bash "$HERE/umgebung.sh" >"${bericht%.txt}-umgebung.json" 2>/dev/null || true
  {
    echo "# 1B-Aufbaubericht (ohne Secrets) $(date --iso-8601=seconds)"
    echo "Repo: $(git -C "$REPO" rev-parse HEAD)"
    echo "Rechner: $(lscpu | sed -n 's/^Model name: *//p'); $(nproc) Threads; $(free -g | awk '/^Mem:/ {print $2}') GiB"
    local vm
    for vm in arsnova-1b-llm arsnova-1b-app; do
      echo "VM $vm: $(LIBVIRT_DEFAULT_URI=qemu:///system virsh dominfo "$vm" | awk '/^CPU\(s\)/ {c=$2} /^Max memory/ {m=$3/1048576} END {print c " vCPU, " m " GiB"}')"
    done
    bash "$HERE/vm/vm-linux.sh" status
    local f=0
    "${SSH[@]}" "labor@$LLM" "bash arsnova.eu/$EV/pruefen.sh llm" || f=1
    "${SSH[@]}" "labor@$APP" "bash arsnova.eu/$EV/pruefen.sh app" || f=1
    echo "== Negativtests vom Rechner"
    negativtests || f=1
    echo "== Ergebnis: $([[ $f == 0 ]] && echo 'alle Prüfungen OK' || echo 'FEHLER, siehe oben')"
    exit "$f"
  } 2>&1 | tee "$bericht" && rc=0 || rc=$?
  echo "Bericht: $bericht (Umgebung: ${bericht%.txt}-umgebung.json)"
  return "$rc"
}

up() {
  # Fortschritt wie labor.ps1: [n/7] Text (dauert …) - seit Beginn …, noch etwa …, fertig gegen … (fortschritt.sh)
  fs_schritt 1 'Voraussetzungen prüfen' 'Sekunden'
  voraussetzungen
  fs_schritt 2 'Größen wählen' 'Sekunden'
  groessen_waehlen anlegen
  fs_schritt 3 'VMs anlegen und einrichten (cloud-init, Docker)' '5-15 min'
  bash "$HERE/vm/vm-linux.sh" up
  fs_schritt 4 'Modell (2,4 GB) vom Rechner in den llm-host kopieren, falls vorhanden' '1-3 min'
  modell_kopieren
  fs_schritt 5 'llm-host einrichten: Runtime-Image bauen, Modell prüfen, starten' '5-20 min'
  "${SSH[@]}" "labor@$LLM" "bash arsnova.eu/$EV/llm-start.sh" 2>&1 | tee "$OUT/llm-start.log"
  fs_schritt 6 'app-host einrichten: App-Image bauen, Datenbank, Start (Token nur per Pipe von VM zu VM)' '15-30 min'
  "${SSH[@]}" "labor@$LLM" "sed -n 's/^OPEN_WEIGHT_LLM_TOKEN=//p' arsnova.eu/.env.llm" |
    "${SSH[@]}" "labor@$APP" "bash arsnova.eu/$EV/app-start.sh" 2>&1 | tee "$OUT/app-start.log"
  fs_schritt 7 'alles prüfen' '1-3 min'
  pruefen
}

schluessel_app_llm() { # app-host darf für Mitschnitt und Neustart per SSH in den llm-host
  local pub
  pub="$("${SSH[@]}" "labor@$APP" 'test -f ~/.ssh/labor-llm || ssh-keygen -q -t ed25519 -N "" -C labor-app-zu-llm -f ~/.ssh/labor-llm; cat ~/.ssh/labor-llm.pub')"
  [[ "$pub" =~ ^ssh-ed25519\ [A-Za-z0-9+/=]+\ labor-app-zu-llm$ ]] || { echo "unerwarteter Schlüssel" >&2; exit 1; }
  "${SSH[@]}" "labor@$LLM" "grep -qxF '$pub' ~/.ssh/authorized_keys || echo '$pub' >> ~/.ssh/authorized_keys"
}

im_app_host() { # modus: lauf.sh im app-host mit Hülle (Ruhezustand gesperrt, Energieprofil)
  bash "$HERE/vm/vm-linux.sh" sync
  schluessel_app_llm
  local wunsch="${LAB_PROFIL:-performance}" ist
  ist="$(powerprofilesctl get 2>/dev/null || echo unbekannt)"
  local -a huelle=()
  if [[ "$wunsch" == performance ]] && command -v powerprofilesctl >/dev/null; then
    huelle=(powerprofilesctl launch -p performance -r "1B-$1" --)
    ist=performance
  fi
  if command -v systemd-inhibit >/dev/null; then
    huelle=(systemd-inhibit --what=sleep:idle:handle-lid-switch --who=1B-Labor --why="1B-$1" --mode=block "${huelle[@]}")
  fi
  local timeout="${LAB_TIMEOUT_MS:-}"
  if [[ "$1" == lauf && -z "$timeout" ]]; then
    # Timeout aus der jüngsten Kalibrierung, nur bei gleichem Energieprofil (ADR 1B-005).
    local kal; kal="$(ls -t "$OUT"/kalibrierung-*.json 2>/dev/null | head -n 1)"
    [[ -n "$kal" && "$(basename "$kal")" == kalibrierung-"$(date +%Y%m%d)"T* ]] ||
      { echo "Keine Kalibrierung von heute in $OUT: zuerst labor.sh kalibrierung (oder LAB_TIMEOUT_MS setzen)." >&2; exit 1; }
    [[ "$(jq -r .energieprofil "$kal")" == "$ist" ]] ||
      { echo "Kalibrierung $kal lief mit Profil $(jq -r .energieprofil "$kal"), dieser Lauf mit $ist: neu kalibrieren." >&2; exit 1; }
    timeout="$(jq -r .timeoutMs "$kal")"
    echo "Timeout $timeout ms aus $kal"
  fi
  local rechner; rechner="$(lscpu | sed -n 's/^Model name: *//p'), $(nproc) Threads, $(free -g | awk '/^Mem:/ {print $2}') GiB"
  local env; env="$(printf 'LAB_N=%q LAB_TAG=%q LAB_TIMEOUT_MS=%q LAB_PROFIL_IST=%q LAB_RECHNER=%q LAB_RUNTIME_AUS=%q' \
    "${LAB_N:-10}" "${LAB_TAG:-}" "$timeout" "$ist" "$rechner" "${LAB_RUNTIME_AUS:-}")"
  local ausgabe
  local rc=0
  ausgabe="$("${huelle[@]}" "${SSH[@]}" "labor@$APP" "$env bash arsnova.eu/$EV/lauf.sh $1" | tee -a /dev/stderr)" || rc=$?
  if ((rc != 0)); then
    echo "lauf.sh $1 fehlgeschlagen ($rc). Rohdaten im app-host: ssh labor@$APP 'ls -t ~/labor-1b | head -3'" >&2
    exit "$rc"
  fi
  if [[ "$1" == kalibrierung ]]; then
    local datei; datei="$(tail -n 1 <<<"$ausgabe")"
    scp -q -o UserKnownHostsFile="$VMDIR/known_hosts" "labor@$APP:$datei" "$OUT/"
    umgebung_einbetten "$OUT/$(basename "$datei")"
    echo "Kalibrierung: $OUT/$(basename "$datei")"
  fi
  if [[ "$1" == kontrolle || "$1" == belege ]]; then
    local dir; dir="$(tail -n 1 <<<"$ausgabe")"
    scp -q -r -o UserKnownHostsFile="$VMDIR/known_hosts" "labor@$APP:$dir" "$OUT/"
    local lokal; lokal="$OUT/$(basename "$dir")"
    # Nie ein vorhandenes Ergebnis überschreiben: -2, -3 … wie bei lauf (Get-MessungZiel unter Windows).
    local basis ziel i=2
    if [[ "$1" == kontrolle ]]; then
      umgebung_einbetten "$lokal/ergebnis.json"
      basis="$HERE/messung/$(date +%F)-kontrolle-c0" ziel="$basis.json"
      while [[ -e "$ziel" ]]; do ziel="$basis-$i.json"; i=$((i + 1)); done
      cp "$lokal/ergebnis.json" "$ziel"
      echo "Ergebnis: $ziel"
    else
      # Belege sind ohne Secrets (env-ohne-secrets.sh, Token-Gegenprobe in lauf.sh) und kommen ins Repo.
      basis="$HERE/messung/$(date +%F)-belege" ziel="$basis"
      while [[ -e "$ziel" ]]; do ziel="$basis-$i"; i=$((i + 1)); done
      mkdir -p "$ziel"
      cp "$lokal"/*.txt "$lokal"/manifest.json "$ziel/"
      sed -i 's/[[:space:]]*$//' "$ziel/"*.txt   # git diff --check
      LAB_VMDIR="$VMDIR" bash "$HERE/umgebung.sh" >"$ziel/umgebung.json"
      echo "Belege: $ziel/"
    fi
  fi
  if [[ "$1" == lauf ]]; then
    local dir; dir="$(tail -n 1 <<<"$ausgabe")"
    scp -q -r -o UserKnownHostsFile="$VMDIR/known_hosts" "labor@$APP:$dir" "$OUT/"
    echo "Rohdaten (nie einchecken, Mitschnitte enthalten den Token): $OUT/$(basename "$dir")"
    umgebung_einbetten "$OUT/$(basename "$dir")/ergebnis.json"
    if [[ "${LAB_TAG:-}" != dev* && "${LAB_TAG:-}" != probe* ]]; then
      local ziel; ziel="$HERE/messung/$(date +%F)-lauf${LAB_TAG:+-$LAB_TAG}.json" i=2
      while [[ -e "$ziel" ]]; do ziel="$HERE/messung/$(date +%F)-lauf${LAB_TAG:+-$LAB_TAG}-$i.json"; i=$((i + 1)); done
      cp "$OUT/$(basename "$dir")/ergebnis.json" "$ziel"
      echo "Ergebnis: $ziel"
    fi
  fi
}

# stop/start: zwischen Messungen belegen die VMs keinen RAM; Daten und Einrichtung bleiben.
vms_stop() {
  local vm
  export LIBVIRT_DEFAULT_URI=qemu:///system
  for vm in arsnova-1b-app arsnova-1b-llm; do
    virsh domstate "$vm" 2>/dev/null | grep -q running && virsh shutdown "$vm" >/dev/null
  done
  for _ in $(seq 1 36); do
    virsh list --name | grep -q '^arsnova-1b-\(app\|llm\)$' || { echo "Beide VMs aus; RAM und CPU sind wieder frei."; return 0; }
    sleep 5
  done
  echo "VMs nach 3 min noch nicht aus; hart ausschalten mit: virsh -c qemu:///system destroy arsnova-1b-app (bzw. -llm)" >&2
  exit 1
}

vms_start() {
  local vm ip ok=0
  export LIBVIRT_DEFAULT_URI=qemu:///system
  virsh net-start arsnova-1b >/dev/null 2>&1 || true
  for vm in arsnova-1b-llm arsnova-1b-app; do
    virsh domstate "$vm" >/dev/null 2>&1 || { echo "$vm fehlt: zuerst labor.sh up" >&2; exit 1; }
    virsh domstate "$vm" | grep -q running || virsh start "$vm" >/dev/null
  done
  for ip in "$LLM" "$APP"; do
    for _ in $(seq 1 60); do "${SSH[@]}" -o BatchMode=yes "labor@$ip" true 2>/dev/null && break; sleep 5; done
  done
  echo "VMs laufen; warte 90 s auf die Container (restart: always)."
  sleep 90
  for _ in 1 2 3; do pruefen && { ok=1; break; }; echo "Noch nicht bereit, neuer Versuch in 60 s."; sleep 60; done
  ((ok))
}

case "${1:-}" in
  up) up ;;
  stop) vms_stop ;;
  start) vms_start ;;
  groessen) groessen_waehlen ;;
  kalibrierung | lauf | kontrolle | belege) im_app_host "$1" ;;
  pruefen) pruefen ;;
  status) bash "$HERE/vm/vm-linux.sh" status ;;
  umgebung) LAB_VMDIR="$VMDIR" bash "$HERE/umgebung.sh" ;;
  destroy)
    frage "Beide Labor-VMs mit Disks und das Labornetz löschen? [j/N]" n || exit 0
    bash "$HERE/vm/vm-linux.sh" destroy
    ;;
  *) echo "Aufruf: $0 up|groessen|pruefen|kalibrierung|lauf|status|umgebung|stop|start|destroy" >&2; exit 2 ;;
esac
