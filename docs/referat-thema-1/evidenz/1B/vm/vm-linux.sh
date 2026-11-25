#!/usr/bin/env bash
# 1B-Labor: zwei KVM-VMs unter Linux (libvirt), ADR 1B-002, 1B-003.
#
#   vm-linux.sh up        Netz, Image, VMs anlegen und starten; Repo-Stand per git bundle kopieren
#   vm-linux.sh sync      nur den Repo-Stand in beide VMs bringen
#   vm-linux.sh status    IPs, SSH, docker version, ausgehendes NAT
#   vm-linux.sh destroy   VMs, Disks und Netz entfernen
#
# Umgebungsvariablen (Standard in Klammern):
#   LAB_SSH_KEY   öffentlicher Schlüssel für den Nutzer labor   (~/.ssh/id_ed25519.pub)
#   LAB_COMMIT    Repo-Stand für die VMs                         (HEAD)
#   LAB_VMDIR     Disks, Seeds, Image; nie einchecken             (/var/lib/libvirt/images/arsnova-1b)
#                 Muss für den Nutzer libvirt-qemu erreichbar sein (nicht unter einem Home mit 700).
#                 Einmalig: sudo install -d -o "$USER" -m 755 /var/lib/libvirt/images/arsnova-1b
#
# CPU-Pinning (lscpu -e am ThinkPad P50, 2026-11-12): CPU n und n+4 sind Hyperthread-Geschwister
# von Kern n. llm-host vCPU 0–3 → CPU 0–3 (je ein Thread jedes Kerns), app-host vCPU 0–1 → CPU 4–5
# (Geschwister von Kern 0 und 1), CPU 6–7 bleiben dem Laptop. Auf anderer Hardware anpassen.
set -euo pipefail

MODE="${1:-}"
HERE="$(cd "$(dirname "$(readlink -f "$0")")" && pwd)"
REPO="$(git -C "$HERE" rev-parse --show-toplevel)"
export LIBVIRT_DEFAULT_URI=qemu:///system
NET=arsnova-1b
VMDIR="${LAB_VMDIR:-/var/lib/libvirt/images/arsnova-1b}"
KEY="${LAB_SSH_KEY:-$HOME/.ssh/id_ed25519.pub}"
COMMIT="$(git -C "$REPO" rev-parse --verify "${LAB_COMMIT:-HEAD}^{commit}")"
IMG_URL=https://cloud-images.ubuntu.com/releases/24.04/release
IMG=ubuntu-24.04-server-cloudimg-amd64.img
SSH=(ssh -o StrictHostKeyChecking=accept-new -o UserKnownHostsFile="$VMDIR/known_hosts" -o ConnectTimeout=5)

# Größen und Pinning: Standard = Messrechner; labor.sh setzt sie aus der Größenregel (ADR 1B-010).
APP_VCPU="${LAB_APP_VCPU:-2}" APP_RAM="${LAB_APP_RAM_GIB:-6}" APP_SET="${LAB_APP_CPUSET:-4,5}"
LLM_VCPU="${LAB_LLM_VCPU:-4}" LLM_RAM="${LAB_LLM_RAM_GIB:-12}" LLM_SET="${LAB_LLM_CPUSET:-0,1,2,3}"
APP_DISK="${LAB_APP_DISK_GIB:-25}" LLM_DISK="${LAB_LLM_DISK_GIB:-20}"
# name ip mac vcpus ram_mib disk_gb cpuset user-data
VMS=(
  "arsnova-1b-app 192.168.150.10 52:54:00:1b:00:10 $APP_VCPU $((APP_RAM * 1024)) $APP_DISK $APP_SET app-host.user-data.yaml"
  "arsnova-1b-llm 192.168.150.20 52:54:00:1b:00:20 $LLM_VCPU $((LLM_RAM * 1024)) $LLM_DISK $LLM_SET llm-host.user-data.yaml"
)

# virt-install ist ein Python-Programm mit "#!/usr/bin/env python3". Steht ein anderes Python (mise, pyenv,
# venv) vorn im PATH, fehlt dort das Modul gi und es bricht ab (2026-11-13 in einer systemd-Unit).
virt_install() { PATH="/usr/bin:$PATH" virt-install "$@"; }
need() { command -v "$1" >/dev/null || { echo "Fehlt: $1" >&2; exit 1; }; }

seed_iso() { # out user-data name
  local dir; dir="$(mktemp -d)"
  sed "s|__SSH_KEY__|$(cat "$KEY")|" "$HERE/$2" >"$dir/user-data"
  printf 'instance-id: %s\nlocal-hostname: %s\n' "$3-$(date +%s)" "$3" >"$dir/meta-data"
  if command -v xorriso >/dev/null; then
    xorriso -as mkisofs -quiet -o "$1" -V cidata -J -r "$dir/user-data" "$dir/meta-data"
  else
    genisoimage -quiet -o "$1" -V cidata -J -r "$dir/user-data" "$dir/meta-data"
  fi
  rm -rf "$dir"
}

wait_ssh() { # ip
  for _ in $(seq 1 90); do
    "${SSH[@]}" "labor@$1" test -f /var/lib/labor-basis.done 2>/dev/null && return 0
    sleep 10
  done
  echo "VM $1 nach 15 min nicht bereit (cloud-init: sudo cloud-init status --long)" >&2
  exit 1
}

up() {
  for c in virsh virt-install qemu-img sha256sum; do need "$c"; done
  [[ -f "$KEY" ]] || { echo "SSH-Schlüssel fehlt: $KEY" >&2; exit 1; }
  mkdir -p "$VMDIR"
  if ! virsh net-info "$NET" >/dev/null 2>&1; then
    virsh net-define "$HERE/netz.xml"
    virsh net-autostart "$NET"
  fi
  virsh net-start "$NET" 2>/dev/null || true
  # Falle (2026-11-12): aktive Host-ufw blockt DHCP/DNS auf der Bridge und das Weiterleiten;
  # die VMs bekommen dann keine IP. Einmalig freigeben (nur die Bridge, nichts von außen):
  if systemctl is-active -q ufw 2>/dev/null; then
    echo "Hinweis: ufw aktiv. Falls die VMs keine IP bekommen:" >&2
    echo "  sudo ufw allow in on virbr-1b to any port 67 proto udp" >&2
    echo "  sudo ufw allow in on virbr-1b to any port 53" >&2
    echo "  sudo ufw route allow in on virbr-1b" >&2
  fi

  if [[ ! -f "$VMDIR/$IMG" ]]; then
    curl -fL -o "$VMDIR/$IMG" "$IMG_URL/$IMG"
  fi
  [[ -s "$VMDIR/SHA256SUMS" ]] || curl -fsSL -o "$VMDIR/SHA256SUMS" "$IMG_URL/SHA256SUMS"
  (cd "$VMDIR" && grep " \*\?$IMG\$" SHA256SUMS | sha256sum -c -)

  for vm in "${VMS[@]}"; do
    read -r name ip mac vcpus ram disk cpuset ud <<<"$vm"
    if virsh dominfo "$name" >/dev/null 2>&1; then
      echo "$name existiert schon"
      ist="$(virsh dominfo "$name" | awk '/^CPU\(s\)/ {c=$2} /^Max memory/ {m=$3/1024} END {print c, m}')"
      [[ "$ist" == "$vcpus $ram" ]] || {
        echo "$name hat $ist (vCPU MiB), gewünscht $vcpus $ram; zuerst: $0 destroy" >&2
        exit 1
      }
      [[ "$(virsh domstate "$name")" == running ]] || virsh start "$name"
      continue
    fi
    qemu-img create -q -f qcow2 -F qcow2 -b "$VMDIR/$IMG" "$VMDIR/$name.qcow2" "${disk}G"
    seed_iso "$VMDIR/$name-seed.iso" "$ud" "$name"
    virt_install --name "$name" --memory "$ram" --vcpus "$vcpus" --cpuset "$cpuset" \
      --cpu host-passthrough --osinfo ubuntu24.04 --import \
      --disk "path=$VMDIR/$name.qcow2,format=qcow2" \
      --disk "path=$VMDIR/$name-seed.iso,device=cdrom" \
      --network "network=$NET,mac=$mac,model=virtio" \
      --graphics none --noautoconsole
    # Jede vCPU fest auf einen Host-Thread (cputune), nicht nur auf die Menge.
    i=0
    for cpu in ${cpuset//,/ }; do virsh vcpupin "$name" "$i" "$cpu" --config --live >/dev/null; i=$((i + 1)); done
  done

  sync
  status
}

sync() { # Repo-Stand LAB_COMMIT (HEAD) per git bundle in beide VMs
  bundle="$VMDIR/repo.bundle"
  # Bündel aus HEAD; LAB_COMMIT muss darin enthalten sein (Vorfahre von HEAD).
  git -C "$REPO" merge-base --is-ancestor "$COMMIT" HEAD || { echo "LAB_COMMIT ist kein Vorfahre von HEAD" >&2; exit 1; }
  git -C "$REPO" bundle create "$bundle" HEAD 2>/dev/null
  for vm in "${VMS[@]}"; do
    read -r name ip _ <<<"$vm"
    wait_ssh "$ip"
    scp -q -o UserKnownHostsFile="$VMDIR/known_hosts" "$bundle" "labor@$ip:/tmp/repo.bundle"
    "${SSH[@]}" "labor@$ip" "test -d arsnova.eu || git clone -q /tmp/repo.bundle arsnova.eu; cd arsnova.eu && git fetch -q /tmp/repo.bundle && git checkout -q --detach $COMMIT && git log --oneline -1"
  done
}

status() {
  virsh net-dumpxml "$NET" | grep -E "forward|bridge name" || true
  for vm in "${VMS[@]}"; do
    read -r name ip _ <<<"$vm"
    echo "== $name ($ip): $(virsh domstate "$name" 2>/dev/null || echo fehlt)"
    virsh vcpupin "$name" 2>/dev/null | tail -n +3 | sed '/^$/d'
    "${SSH[@]}" "labor@$ip" 'docker version --format "docker {{.Server.Version}}"; node --version; curl -fsSI https://deb.debian.org >/dev/null && echo "ausgehend: ok"; git -C arsnova.eu log --oneline -1 2>/dev/null' || echo "SSH nicht erreichbar"
  done
}

destroy() {
  for vm in "${VMS[@]}"; do
    read -r name _ <<<"$vm"
    virsh destroy "$name" 2>/dev/null || true
    virsh undefine "$name" --nvram 2>/dev/null || virsh undefine "$name" 2>/dev/null || true
    rm -f "$VMDIR/$name.qcow2" "$VMDIR/$name-seed.iso"
  done
  virsh net-destroy "$NET" 2>/dev/null || true
  virsh net-undefine "$NET" 2>/dev/null || true
  rm -f "$VMDIR/known_hosts" "$VMDIR/repo.bundle"
}

case "$MODE" in
  up) up ;;
  sync) sync ;;
  status) status ;;
  destroy) destroy ;;
  *) echo "Aufruf: $0 up|sync|status|destroy" >&2; exit 2 ;;
esac
