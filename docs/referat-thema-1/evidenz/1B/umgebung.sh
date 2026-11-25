#!/usr/bin/env bash
# 1B: Umgebung eines Laufs auf dem Linux-Rechner als JSON (Schema 1b-umgebung-1, gleich wie labor.ps1 unter Windows).
# Rechner (CPU, Takt, RAM, Betriebssystem, Kernel, Energieprofil, Governor, Netzteil, Speicherort und Plattentyp),
# Hypervisor (QEMU, libvirt, nested), je VM Größen, Pinning, CPU-Modell, Plattengröße und das Innere (vm-info.sh).
# LAB_OHNE_VMS=1: nur Rechner und Hypervisor (Tests). Ohne Tokens.
set -uo pipefail
HERE="$(cd "$(dirname "$(readlink -f "$0")")" && pwd)"
REPO="$(git -C "$HERE" rev-parse --show-toplevel)"
VMDIR="${LAB_VMDIR:-/var/lib/libvirt/images/arsnova-1b}"
export LIBVIRT_DEFAULT_URI=qemu:///system
SSH=(ssh -o StrictHostKeyChecking=accept-new -o UserKnownHostsFile="$VMDIR/known_hosts" -o ConnectTimeout=5 -o BatchMode=yes)
EV=docs/referat-thema-1/evidenz/1B

lscpu_wert() { lscpu | sed -n "s/^$1: *//p" | head -n 1; }
null_oder() { if [[ -n "$1" ]]; then printf '%s' "$1"; else printf 'null'; fi; }

speicherort() {
  local ort="$VMDIR" fs dev medium=null
  [[ -d "$ort" ]] || ort="$(dirname "$ort")"
  fs="$(findmnt -no FSTYPE --target "$ort" 2>/dev/null)"
  dev="$(findmnt -no SOURCE --target "$ort" 2>/dev/null)"
  dev="${dev%%\[*}"   # btrfs meldet /dev/mapper/root[/@]
  # Unterste Platte unter LVM/LUKS: ROTA 0 = SSD/NVMe, 1 = drehende Platte.
  local rota; rota="$(lsblk -s -n -o ROTA,TYPE "$dev" 2>/dev/null | awk '$2 == "disk" {print $1; exit}')"
  [[ "$rota" == 0 ]] && medium='"SSD"'
  [[ "$rota" == 1 ]] && medium='"HDD"'
  jq -n --arg pfad "$VMDIR" --arg fs "$fs" --argjson medium "$medium" '{pfad: $pfad, dateisystem: $fs, medium: $medium}'
}

rechner() {
  local kerne threads ac=null
  kerne="$(lscpu -p=CORE,SOCKET | grep -v '^#' | sort -u | wc -l)"
  threads="$(nproc --all)"
  for a in /sys/class/power_supply/A{C,DP}*/online; do [[ -f "$a" ]] && { [[ "$(cat "$a")" == 1 ]] && ac=true || ac=false; break; }; done
  jq -n --arg cpu "$(lscpu_wert 'Model name')" --argjson kerne "$kerne" --argjson threads "$threads" \
    --arg maxmhz "$(lscpu_wert 'CPU max MHz')" --arg ram "$(awk '/^MemTotal:/ {printf "%.1f", $2 / 1048576}' /proc/meminfo)" \
    --arg os "$(. /etc/os-release && echo "$PRETTY_NAME")" --arg kernel "$(uname -r)" \
    --arg profil "$(powerprofilesctl get 2>/dev/null)" \
    --arg gov "$(cat /sys/devices/system/cpu/cpu0/cpufreq/scaling_governor 2>/dev/null)" \
    --arg treiber "$(cat /sys/devices/system/cpu/cpu0/cpufreq/scaling_driver 2>/dev/null)" \
    --argjson ac "$ac" --argjson ort "$(speicherort)" \
    '{plattform: "linux", cpu: $cpu, kerne: $kerne, threads: $threads,
      maxMHz: (if $maxmhz == "" then null else ($maxmhz | tonumber | floor) end), ramGib: ($ram | tonumber),
      os: $os, kernel: $kernel, energieprofil: (if $profil == "" then null else $profil end),
      cpuGovernor: (if $gov == "" then null else $gov end), cpufreqTreiber: (if $treiber == "" then null else $treiber end),
      netzteil: $ac, speicherort: $ort}'
}

hypervisor() {
  local v; v="$(virsh version 2>/dev/null)"
  jq -n --arg qemu "$(sed -n 's/^Running hypervisor: *//p' <<<"$v")" --arg libvirt "$(sed -n 's/^Using library: *//p' <<<"$v")" \
    --arg nested "$(cat /sys/module/kvm_intel/parameters/nested /sys/module/kvm_amd/parameters/nested 2>/dev/null | head -n 1)" \
    '{name: "KVM/QEMU (libvirt)", version: (if $qemu == "" then null else $qemu end),
      libvirt: (if $libvirt == "" then null else $libvirt end), nested: (if $nested == "" then null else $nested end), pinning: true}'
}

vm() { # name ip
  local x pin cpumodell disk gast
  x="$(virsh dominfo "$1" 2>/dev/null)" || { echo null; return; }
  pin="$(virsh vcpupin "$1" 2>/dev/null | awk 'NR > 2 && NF {print $2}' | paste -sd' ')"
  cpumodell="$(virsh dumpxml "$1" | sed -n "s/.*<cpu mode='\([^']*\)'.*/\1/p" | head -n 1)"
  disk="$(virsh domblkinfo "$1" vda 2>/dev/null | awk '/^Capacity:/ {printf "%.0f", $2 / 1073741824}')"
  gast="$("${SSH[@]}" "labor@$2" "bash arsnova.eu/$EV/vm-info.sh" 2>/dev/null)"
  jq -e 'type == "object"' >/dev/null 2>&1 <<<"$gast" || gast=null
  jq -n --arg name "$1" --arg ip "$2" --arg vcpu "$(sed -n 's/^CPU(s): *//p' <<<"$x")" \
    --arg ram "$(sed -n 's/^Max memory: *\([0-9]*\).*/\1/p' <<<"$x")" --arg zustand "$(sed -n 's/^State: *//p' <<<"$x")" \
    --arg pin "$pin" --arg cpumodell "$cpumodell" --arg disk "$disk" --argjson gast "$gast" \
    '{name: $name, ip: $ip, zustand: $zustand, vcpu: ($vcpu | tonumber), ramGib: (($ram | tonumber) / 1048576),
      cpuset: (if $pin == "" then null else $pin end), cpuModell: (if $cpumodell == "" then null else $cpumodell end),
      plattenMaxGib: (if $disk == "" then null else ($disk | tonumber) end), gast: $gast}'
}

vms='[]'
if [[ -z "${LAB_OHNE_VMS:-}" ]]; then
  vms="$(jq -s '[.[] | select(. != null)]' <(vm arsnova-1b-app 192.168.150.10) <(vm arsnova-1b-llm 192.168.150.20))"
fi
jq -n --arg am "$(date --iso-8601=seconds)" --argjson rechner "$(rechner)" --argjson hv "$(hypervisor)" --argjson vms "$vms" \
  --arg commit "$(git -C "$REPO" rev-parse HEAD)" \
  '{schema: "1b-umgebung-1", erfasstAm: $am, rechner: $rechner, hypervisor: $hv, vms: $vms, laborStand: {commit: $commit}}'
