#!/usr/bin/env bash
# 1B-Labor aus WSL steuern, etwa für Codex oder Claude in VS Code (Remote WSL). Ruft über die WSL-Interop
# die Windows-Programme auf: labor.ps1 (powershell.exe) und ssh.exe. So gilt die Windows-Route zum internen
# Hyper-V-Switch; ob WSL selbst 192.168.150.0/24 erreicht, ist nicht dokumentiert und wird nicht gebraucht.
#
#   labor-wsl.sh status|start|stop|sync|vorpruefung|groessen|umgebung|pruefen   wie labor.ps1 -Mode …
#   labor-wsl.sh kalibrierung|lauf|kontrolle|belege [Parameter]  z. B. lauf -LabN 1 -LabTag dev-x -LabTimeoutMs 300000; B0: lauf -LabRuntimeAus
#   labor-wsl.sh up|destroy [Parameter]      mit Admin-Rückfrage (UAC), läuft in eigenem Fenster
#   labor-wsl.sh vm app|llm '<befehl>'       Befehl in einer VM (Laborschlüssel, known_hosts aus dem VM-Ordner)
#   --arbeitsstand (bei sync, up, kalibrierung, lauf, kontrolle, belege): nimmt auch nicht committete Änderungen mit. Dafür legt
#     das Skript einen Commit unter refs/labor/arbeitsstand an (der Zweig bleibt unverändert). Läufe mit
#     Arbeitsstand sind Entwicklungsläufe: LabTag mit dev- beginnen, nicht werten.
#
# Ohne Admin brauchen status/start/stop/Läufe die Gruppe Hyper-V-Administratoren (setzt das erste up).
set -euo pipefail
shopt -s inherit_errexit   # Fehler in $(…) brechen ab, statt still eine leere Ausgabe zu liefern
HERE="$(cd "$(dirname "$(readlink -f "$0")")" && pwd)"
REPO="${LAB_REPO:-$(git -C "$HERE" rev-parse --show-toplevel 2>/dev/null || true)}"   # LAB_REPO nur für Tests

if [[ -z "${LAB_WSL_TEST:-}" ]] && ! grep -qi microsoft /proc/version 2>/dev/null; then
  echo "labor-wsl.sh ist für WSL gedacht; unter Linux direkt labor.sh nutzen." >&2
  exit 2
fi
for c in powershell.exe ssh.exe cmd.exe wslpath; do
  command -v "$c" >/dev/null || { echo "$c fehlt: WSL-Interop aus? (/etc/wsl.conf [interop] enabled=true)" >&2; exit 2; }
done

PS1="$(wslpath -w "$HERE/labor.ps1")"
WINHOME="$(wslpath "$(cmd.exe /c 'echo %USERPROFILE%' 2>/dev/null | tr -d '\r')")"

arbeitsstand() { # legt refs/labor/arbeitsstand an und gibt den Commit aus (auch neue, nicht ignorierte Dateien)
  [[ -n "$REPO" ]] || { echo "kein Git-Repo" >&2; exit 2; }
  local idx tree sha
  idx="$(mktemp)"
  cp "$(git -C "$REPO" rev-parse --path-format=absolute --git-path index)" "$idx"
  GIT_INDEX_FILE="$idx" git -C "$REPO" add -A
  tree="$(GIT_INDEX_FILE="$idx" git -C "$REPO" write-tree)"
  rm -f "$idx"
  if [[ "$tree" == "$(git -C "$REPO" rev-parse 'HEAD^{tree}')" ]]; then
    sha="$(git -C "$REPO" rev-parse HEAD)"
  else
    # Ohne eingerichtete Git-Identität (frisches WSL, CI) scheitert commit-tree; der Arbeitsstand ist
    # ein lokaler Hilfscommit, daher reicht dann eine feste Laboridentität.
    local wer=()
    git -C "$REPO" config user.email >/dev/null 2>&1 || wer=(-c user.name=labor -c user.email=labor@localhost)
    sha="$(git "${wer[@]}" -C "$REPO" commit-tree "$tree" -p HEAD -m "Arbeitsstand $(date --iso-8601=seconds) (Entwicklung, nicht werten)")"
  fi
  [[ "$sha" =~ ^[0-9a-f]{40}$ ]] || { echo "Arbeitsstand: kein Commit angelegt" >&2; exit 2; }
  git -C "$REPO" update-ref refs/labor/arbeitsstand "$sha"
  echo "$sha"
}

modus="${1:-}"
[[ -n "$modus" ]] || { sed -n '2,16p' "$0" | sed 's/^# \{0,1\}//'; exit 2; }
shift

if [[ "$modus" == vm ]]; then
  ip=""
  case "${1:-}" in app) ip=192.168.150.10 ;; llm) ip=192.168.150.20 ;; *) echo "vm: app oder llm angeben" >&2; exit 2 ;; esac
  shift
  vmdir="C:\\ProgramData\\arsnova-1b"
  e="$WINHOME/labor-1b/einstellungen.json"
  if [[ -f "$e" ]]; then
    v="$(sed -n 's/.*"VmDir"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$e" | sed 's/\\\\/\\/g')"
    [[ -n "$v" ]] && vmdir="$v"
  fi
  kh="${vmdir//\\//}/known_hosts"
  exec ssh.exe -i "$(wslpath -w "$WINHOME/.ssh/arsnova-1b_ed25519")" -o StrictHostKeyChecking=accept-new \
    -o "UserKnownHostsFile=$kh" -o ConnectTimeout=5 -o BatchMode=yes -o LogLevel=ERROR "labor@$ip" "$@"
fi

args=()
for a in "$@"; do
  if [[ "$a" == --arbeitsstand ]]; then
    sha="$(arbeitsstand)" || exit 2
    echo "Arbeitsstand $sha (refs/labor/arbeitsstand) geht in die VMs." >&2
    args+=(-Commit "$sha")
  else
    args+=("$a")
  fi
done

case "$modus" in
  up | destroy)
    # Netz und NAT brauchen Admin: eigenes Fenster mit UAC-Rückfrage; danach das Log zeigen.
    echo "Admin-Fenster für labor.ps1 -Mode $modus öffnet sich (UAC bestätigen) und schließt sich am Ende." >&2
    # Ohne "|| rc=$?" beendet set -e das Skript vor der Logausgabe, und der Fehler wäre mit dem Fenster weg.
    rc=0
    powershell.exe -NoProfile -Command "\$p = Start-Process -FilePath powershell.exe -Verb RunAs -Wait -PassThru -ArgumentList '-NoProfile -ExecutionPolicy Bypass -File \"$PS1\" -Mode $modus ${args[*]:-}'; exit \$p.ExitCode" || rc=$?
    log="$(ls -t "$WINHOME"/labor-1b/log-"$modus"-*.txt 2>/dev/null | head -n 1 || true)"
    [[ -n "$log" ]] && { echo "== Ende des Logs $log" >&2; tr -d '\0\r' <"$log" | tail -n 40; }
    exit "$rc"
    ;;
  *)
    powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$PS1" -Mode "$modus" "${args[@]}" | tr -d '\r'
    exit "${PIPESTATUS[0]}"
    ;;
esac
