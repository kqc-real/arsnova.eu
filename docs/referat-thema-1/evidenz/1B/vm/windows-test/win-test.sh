#!/usr/bin/env bash
# 1B: echter Test von labor.ps1 in einer Windows-11-VM mit verschachtelter Virtualisierung
# (Plan, Nachtrag Task 12 Step 6). Läuft auf einem Linux-Rechner mit KVM und libvirt.
#
#   win-test.sh vm      Netz, Wegwerf-Passwort, Unattend-ISO, Windows-VM installieren, auf SSH warten
#   win-test.sh repo    Repo-Stand als frischen Clone nach C:\1b\arsnova.eu (ohne WSL, wie bei Niklas)
#   win-test.sh labor   labor.ps1: vorpruefung, groessen, up -NurVorbereiten (zweimal), up bis zum
#                       RAM-Schutz, status, destroy; Ausgaben nach WIN_OUT
#   win-test.sh destroy Windows-VM, Disk und Netz entfernen (ISO bleibt)
#
# Voraussetzungen: Labor-VMs aus und Labornetz gestoppt (das Netz nutzt dieselbe Bridge virbr-1b,
# damit gelten die ufw-Freigaben), ISO unter WIN_DIR, kvm_intel nested=Y, OVMF, xorriso.
# Netz 192.168.151.0/24, damit es sich nicht mit dem Labornetz 192.168.150.0/24 in Windows überschneidet.
# Bekannt (2026-11-13): Mit host-passthrough startet Windows mit aktivem Hyper-V verschachtelt nicht
# („Automatische Reparatur“), auch ohne evmcs; ohne vmx bootet es (Host-Kernel 7.2.15).
# Mit benanntem CPU-Modell läuft Hyper-V: WIN_CPU=Skylake-Client-noTSX-IBRS,+vmx (2026-11-13,
# i7-6820HQ; vgl. qemu-project/qemu#3215). Das Modell muss zur Host-CPU passen (virsh domcapabilities).
set -euo pipefail
HERE="$(cd "$(dirname "$(readlink -f "$0")")" && pwd)"
REPO="$(git -C "$HERE" rev-parse --show-toplevel)"
export LIBVIRT_DEFAULT_URI=qemu:///system
WIN_DIR="${WIN_DIR:-/var/lib/libvirt/images/arsnova-1b/win}"
WIN_OUT="${WIN_OUT:-$HOME/labor-1b/windows-test}"
ISO="${WIN_ISO:-$WIN_DIR/win11-eval-de.iso}"
# WIN_RAM_MIB (18432): 22 GiB ließen dem Rechner (31 GiB) nur 1 GiB, Windows belegt beim Setup alles.
NAME=arsnova-1b-win NET=arsnova-1b-win IP=192.168.151.10 MAC=52:54:00:1b:01:10
KEY="${LAB_SSH_KEY:-$HOME/.ssh/id_ed25519.pub}"
SSH=(ssh -o StrictHostKeyChecking=accept-new -o UserKnownHostsFile="$WIN_DIR/known_hosts" -o ConnectTimeout=5 -o BatchMode=yes "labor@$IP")
# Win32-OpenSSH als MSI statt Windows-Capability (die kam erst nach 1 h 40 min), SHA-256 laut GitHub-Release.
SSH_MSI=OpenSSH-Win64-v10.0.0.0.msi
SSH_MSI_URL=https://github.com/PowerShell/Win32-OpenSSH/releases/download/10.0.0.0p2-Preview/$SSH_MSI
SSH_MSI_SHA=ddec9c53864280759cf9f74791cefd387100e3946aa849a1c138a4ed1b96b7d9
# scp -O (altes Protokoll): der sftp-Teil von Win32-OpenSSH 10.0.0.0p2 bricht ab (Test 2026-11-13).
SCP=(scp -O -q -o UserKnownHostsFile="$WIN_DIR/known_hosts")
mkdir -p "$WIN_OUT"
# virt-install ist ein Python-Programm mit "#!/usr/bin/env python3". Steht ein anderes Python (mise, pyenv,
# venv) vorn im PATH, fehlt dort das Modul gi und es bricht ab (2026-11-13 in einer systemd-Unit).
virt_install() { PATH="/usr/bin:$PATH" virt-install "$@"; }
log() { echo "$(date --iso-8601=seconds) $*"; }
win() { "${SSH[@]}" "$@"; }

warte_ssh() { # max. Minuten
  for _ in $(seq 1 $(($1 * 6))); do win 'exit 0' 2>/dev/null && return 0; sleep 10; done
  echo "Windows nach $1 min nicht per SSH erreichbar (Konsole: virt-viewer $NAME)" >&2
  exit 1
}

vm() {
  if virsh net-info arsnova-1b 2>/dev/null | grep -Eq '^Active: +yes'; then
    echo "Labornetz arsnova-1b ist aktiv (gleiche Bridge): Labor-VMs herunterfahren, virsh net-destroy arsnova-1b" >&2
    exit 1
  fi
  if ! virsh net-info "$NET" >/dev/null 2>&1; then
    virsh net-define /dev/stdin <<EOF
<network>
  <name>$NET</name>
  <forward mode='nat'/>
  <bridge name='virbr-1b' stp='on' delay='0'/>
  <ip address='192.168.151.1' netmask='255.255.255.0'>
    <dhcp>
      <range start='192.168.151.100' end='192.168.151.199'/>
      <host mac='$MAC' name='$NAME' ip='$IP'/>
    </dhcp>
  </ip>
</network>
EOF
  fi
  virsh net-start "$NET" 2>/dev/null || true
  if virsh dominfo "$NAME" >/dev/null 2>&1; then
    echo "$NAME existiert schon"
    # Nach der Installation darf das ISO weg (Platz); dann das Laufwerk leeren, sonst startet die VM nicht.
    [[ -f "$ISO" ]] || virsh change-media "$NAME" sdb --eject --config >/dev/null 2>&1 || true
    virsh domstate "$NAME" | grep -q running || virsh start "$NAME"
    warte_ssh 120
    return
  fi
  [[ -f "$ISO" ]] || { echo "ISO fehlt: $ISO" >&2; exit 1; }

  local t; t="$(mktemp -d)"
  umask 077
  [[ -f "$WIN_DIR/passwort" ]] || openssl rand -base64 18 | tr -d '/+=' >"$WIN_DIR/passwort"
  sed "s|__PASSWORT__|$(cat "$WIN_DIR/passwort")|g" "$HERE/autounattend.xml" >"$t/autounattend.xml"
  cp "$HERE/setup.ps1" "$t/"
  [[ -f "$WIN_DIR/$SSH_MSI" ]] || curl -fsSL -o "$WIN_DIR/$SSH_MSI" "$SSH_MSI_URL"
  echo "$SSH_MSI_SHA  $WIN_DIR/$SSH_MSI" | sha256sum -c --quiet -
  cp "$WIN_DIR/$SSH_MSI" "$t/"
  cp "$KEY" "$t/authorized_keys"
  rm -f "$WIN_DIR/unattend.iso" # libvirt übernimmt die Datei beim Start (dynamic_ownership)
  xorriso -as mkisofs -quiet -o "$WIN_DIR/unattend.iso" -V UNATTEND -J -joliet-long -r "$t"
  rm -rf "$t"

  log "Windows-VM anlegen und installieren"
  virt_install --name "$NAME" --memory "${WIN_RAM_MIB:-18432}" --vcpus 4,sockets=1,cores=4,threads=1 \
    --cpu "${WIN_CPU:-host-passthrough}" --osinfo win11 --boot uefi \
    --disk "path=$WIN_DIR/$NAME.qcow2,size=60,format=qcow2,bus=sata" \
    --disk "path=$ISO,device=cdrom,bus=sata" --disk "path=$WIN_DIR/unattend.iso,device=cdrom,bus=sata" \
    --network "network=$NET,mac=$MAC,model=e1000e" \
    --graphics vnc,listen=127.0.0.1 --noautoconsole --wait 0 \
    --check disk_size=off # qcow2 dünn belegt; Windows braucht real 15–20 GB (Wächter in der Nacht 2026-11-13)
  # Das UEFI-Bootmenü des ISO wartet auf „Taste drücken“; Enter senden, bis Setup läuft.
  for _ in $(seq 1 60); do virsh send-key "$NAME" KEY_ENTER >/dev/null 2>&1 || true; sleep 1; done # 60 s: das Anlegen der Disk kann dauern
  # setup.ps1 laedt OpenSSH ueber Windows Update; am 2026-11-13 dauerte das allein 1 h 40 min.
  log "warte auf Installation, ersten Login, setup.ps1 und Neustart (bis 240 min)"
  warte_ssh 240
  until win 'Test-Path C:\1b-setup.done' 2>/dev/null | grep -q True; do sleep 20; done
  sleep 120
  warte_ssh 30
 win '(Get-CimInstance Win32_OperatingSystem).Caption; (Get-WindowsOptionalFeature -Online -FeatureName Microsoft-Hyper-V).State' |
    tee "$WIN_OUT/windows.txt"
}

repo() {
  # Ohne WSL: frischer Clone (Arbeitsbaum und .git) per tar nach C:\1b\arsnova.eu, wie bei Niklas.
  log "Repo-Stand $(git -C "$REPO" rev-parse --short HEAD) als frischen Clone nach Windows"
  local t; t="$(mktemp -d)"
  git clone -q --no-hardlinks "$REPO" "$t/arsnova.eu"
  git -C "$t/arsnova.eu" checkout -q "$(git -C "$REPO" rev-parse HEAD)"
  bsdtar -czf "$WIN_DIR/repo.tgz" -C "$t" arsnova.eu
  rm -rf "$t"
  win 'New-Item -ItemType Directory -Force C:\1b | Out-Null; if (Test-Path C:\1b\arsnova.eu) { Remove-Item -Recurse -Force C:\1b\arsnova.eu }'
  "${SCP[@]}" "$WIN_DIR/repo.tgz" "labor@$IP:C:/1b/repo.tgz"
  win 'tar.exe -xzf C:\1b\repo.tgz -C C:\1b; Test-Path C:\1b\arsnova.eu\.git'
}

labor() {
  # Prueft den Windows-Weg bis kurz vor dem VM-Start (verschachtelte L2-VMs haengen mit Host-Kernel 7.2).
  # Die Windows-VM hat 17 GiB und eine zweite Platte D: (wie bei Niklas); up ohne -NurVorbereiten muss am RAM-Schutz abbrechen.
  local p='C:\1b\arsnova.eu\docs\referat-thema-1\evidenz\1B\labor.ps1'
  local g='-LlmCpus 2 -LlmRamGB 10 -AppCpus 2 -AppRamGB 4'   # Test-VM mit 17 GiB: knappe Stufe
  local s
  for s in "vorpruefung:-Mode vorpruefung" "groessen:-Mode groessen -Ja" \
    "vorbereiten:-Mode up -Ja -NurVorbereiten $g" "vorbereiten-erneut:-Mode up -Ja -NurVorbereiten $g" "umgebung:-Mode umgebung" \
    "up-ram-schutz:-Mode up -Ja $g" "status:-Mode status" "destroy:-Mode destroy -Ja"; do
    log "labor.ps1 ${s#*:}"
    win "powershell -NoProfile -ExecutionPolicy Bypass -File $p ${s#*:}; \"exit=\$LASTEXITCODE\"" 2>&1 | tee "$WIN_OUT/${s%%:*}.txt" || true
  done
  "${SCP[@]}" -r "labor@$IP:C:/Users/labor/labor-1b" "$WIN_OUT/von-windows" || true
  win 'Get-VM | Format-Table Name, State; Get-ChildItem C:\ProgramData\arsnova-1b | Format-Table Name, Length' 2>&1 | tee "$WIN_OUT/rest.txt" || true
}

destroy() {
  virsh destroy "$NAME" 2>/dev/null || true
  virsh undefine "$NAME" --nvram 2>/dev/null || virsh undefine "$NAME" 2>/dev/null || true
  rm -f "$WIN_DIR/$NAME.qcow2" "$WIN_DIR/unattend.iso" "$WIN_DIR/known_hosts" "$WIN_DIR/passwort" "$WIN_DIR/repo.bundle"
  virsh net-destroy "$NET" 2>/dev/null || true
  virsh net-undefine "$NET" 2>/dev/null || true
}

case "${1:-}" in
  vm) vm ;;
  repo) repo ;;
  labor) labor ;;
  destroy) destroy ;;
  *) echo "Aufruf: $0 vm|repo|labor|destroy" >&2; exit 2 ;;
esac
