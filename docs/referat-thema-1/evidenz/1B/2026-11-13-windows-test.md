# 1B: Windows-Test von `labor.ps1`

Stand: 2026-11-13 · Rechner: ThinkPad P50 (i7-6820HQ, 4 Kerne/8 Threads, 31 GiB), Host-Kernel 7.2.15 (`linux-omarchy`), libvirt/KVM · Prüfung durch den Autor: 2026-11-13, ohne Einwände; Nachträge bis 2026-11-14 geprüft am 2026-11-14, ohne Einwände

Ziel (Plan, Nachtrag Task 12 Step 6): `labor.ps1` auf echtem Windows mit Hyper-V testen, in einer Windows-VM mit verschachtelter Virtualisierung. Skripte: [`vm/windows-test/`](vm/windows-test/).

## Aufbau

- Windows 11 Enterprise Evaluation (de-de, Build 26100), unbeaufsichtigt per `autounattend.xml`
- VM `arsnova-1b-win`: 4 vCPU, 18 GiB RAM, 60 GB Disk, NAT-Netz 192.168.151.0/24; CPU-Modell in Versuch 1 `host-passthrough`, in Versuch 2 `Skylake-Client-noTSX-IBRS,+vmx`
- `setup.ps1` nach dem ersten Login: OpenSSH-Server nur mit Schlüssel, Hyper-V, WSL-Grundlage, Neustart

## Verlauf Versuch 1 (`host-passthrough`)

| Zeit (2026-11-12/13) | Ereignis                                                                                        |
| -------------------- | ----------------------------------------------------------------------------------------------- |
| 22:29                | VM angelegt, Installation startet                                                               |
| 23:20                | `setup.ps1` startet (Transkript `C:\1b-setup.log`)                                              |
| 01:02                | OpenSSH aus Windows Update installiert (1 h 40 min), `setup.ps1` endet 01:04 und startet neu    |
| 01:04 –              | Windows startet mit aktivem Hyper-V nicht mehr: „Automatische Reparatur“                        |
| 01:25                | Ohne `evmcs` (und `avic`): gleiches Bild                                                        |
| 01:31                | Ohne `vmx` in der VM-CPU startet Windows normal; Ursache ist also der verschachtelte Hypervisor |
| 02:02                | SSH erst nach Freigabe der Firewall-Regel für alle Profile erreichbar (siehe Befunde)           |
| 02:05 – 02:30        | Teiltest von `labor.ps1` ohne laufenden Hypervisor                                              |

Zum Startabbruch passt ein Bericht über eine Regression ab Host-Kernel 7.2 (Windows-11-Gast mit verschachteltem Hyper-V startet nicht, mit 7.1.8 schon): [CachyOS-Forum](https://discuss.cachyos.org/t/windows-11-kvm-guest-with-nested-hyper-v-boot-loops-on-linux-cachyos-7-2-x-works-on-7-1-8/36134). Einzelbericht, nicht bestätigt; ein Gegentest mit älterem Kernel fehlt.

_Korrektur 2026-11-13, 06:25:_ Hier stand „Host-Kernel 7.2.11“ und „nur Kernel 7.2 installiert“. Laufend ist `linux-omarchy` 7.2.15 (`uname -r`); installiert sind auch 7.2.11 (`linux`) und 6.18 (`linux-lts`).

## Verlauf Versuch 2 (benanntes CPU-Modell)

In [qemu-project/qemu#3215](https://gitlab.com/qemu-project/qemu/-/issues/3215) bootete Windows mit benannten CPU-Modellen. Versuch 2 nutzt `WIN_CPU=Skylake-Client-noTSX-IBRS,+vmx` (passt zum i7-6820HQ), sonst alles wie Versuch 1, mit OpenSSH aus dem MSI.

| Zeit (2026-11-13) | Ereignis                                                                                      |
| ----------------- | --------------------------------------------------------------------------------------------- |
| 04:42             | VM angelegt, Installation startet                                                             |
| 06:03             | `setup.ps1` startet, endet 06:09 und startet neu                                              |
| 06:10             | Windows startet **mit aktivem Hyper-V**, SSH erreichbar                                       |
| 06:20             | `HypervisorPresent = True`, Dienst `vmms` läuft, `hypervisorlaunchtype Auto`, 4 logische CPUs |

Damit liegt der Startabbruch am CPU-Modell `host-passthrough`, nicht am Kernel allein. Belege: `~/labor-1b/windows-test/hyperv-check.txt`, `~/labor-1b/win-vm2.log` (nicht im Repo). Windows meldet Version 10.0.26300.

## Verlauf Versuch 3 (Volltest mit WSL, 2026-11-13 Vormittag)

Ziel: `labor.ps1 up` mit den neuen Schutzprüfungen (Commit `9a36b9d2`). Windows-VM mit 20 GiB RAM, Linux-Labor-VMs und Windows-ISO vorher gelöscht (Platz, mit Freigabe des Autors).

| Zeit (2026-11-13) | Ereignis                                                                                                                                                |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 10:25             | VM startet mit Hyper-V, SSH nach 5 min                                                                                                                  |
| 10:30             | `wsl.exe --install --no-distribution` über SSH ohne Wirkung („nicht installiert“), auch mit `--web-download`: der eingebaute Platzhalter will den Store |
| 10:37             | `scp` nach Windows bricht ab („Connection closed“); `scp -O` (altes Protokoll) geht. Der sftp-Teil von Win32-OpenSSH 10.0.0.0p2 klemmt                  |
| 10:45             | WSL 3.0.5 als MSI von GitHub (SHA-256 aus der Release-API geprüft) per `msiexec /qn /norestart`                                                         |
| 10:46 –           | Windows nicht mehr erreichbar: kein ARP, schwarzer Bildschirm, ~2,7 vCPU Dauerlast                                                                      |
| 11:09             | Harter Reset: Windows bootet nicht mehr bis SSH (15 min schwarzer Bildschirm); VM 11:24 ausgeschaltet                                                   |

Vermutung (nicht belegt): Mit WSL startet zum ersten Mal eine VM innerhalb der Windows-VM (WSL 2 läuft als Hyper-V-VM), also dreifach verschachtelt; das hängt mit diesem Host-Kernel. Damit ist ein Volltest von `labor.ps1 up` in einer VM auf diesem Rechner nicht verlässlich möglich. `labor.ps1 up` selbst kam nicht zum Zug; seine neuen Prüfungen sind nur mit Pester getestet.

## Versuch 4: Weg ohne WSL bis vor den VM-Start (2026-11-13 Nachmittag)

Neue Windows-VM (ohne WSL-Features), 17 GiB RAM, zweite Platte mit 80 GB (in Windows `F:`, weil `D:` und `E:` die DVD-Laufwerke der Test-VM sind), Repo als frischer Clone nach `C:\1b`, Commit `ae828293`. Geprüft bis kurz vor dem Start der Labor-VMs, weil verschachtelte VMs mit Host-Kernel 7.2 hängen (Versuch 3).

_Korrigiert 2026-11-14 (Docs-Audit):_ Dass verschachtelte VMs mit Host-Kernel 7.2 hängen, ist die Vermutung aus Versuch 3, nicht belegt.

| Schritt                         | Ergebnis                                                                                                                                                                                                                                                                                                                      |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| erster Lauf (Commit `fbb106cd`) | **zwei Fehler gefunden:** Vorprüfung bricht unter `Set-StrictMode` ab (`.Count` auf leerem Ergebnis, etwa ohne Akku); Wachhalten scheitert (`0x80000001` ist in PowerShell ein negativer Int32). Behoben mit Tests in `b44bee8b`                                                                                              |
| `vorpruefung`                   | Speicherort: empfiehlt `F:\arsnova-1b` (79 GB frei) vor `C:` (36 GB), lehnt DVD-Laufwerke ab; alle Prüfungen OK, auch externes DNS und alle sieben Downloadquellen; legt den Laborschlüssel an                                                                                                                                |
| `groessen`                      | 16 GB RAM, knappe Stufe llm 2 vCPU/10 GB, app 2 vCPU/4 GB mit vier Hinweisen                                                                                                                                                                                                                                                  |
| `up -NurVorbereiten`            | 5 Schritte mit Restzeit: Netz und NAT angelegt; Ubuntu-qcow2 geladen und geprüft, mit dem eigenen Leser entpackt, VHD-Fußzeile, **`Test-VHD` und `Convert-VHD` nehmen die Datei an**; beide VMs angelegt (Seed-ISO per IMAPI2, Generation 2, Secure Boot). Dauer 14 min, davon je VM ~3,5 min für das Kopieren der Basis-Disk |
| erneut `-NurVorbereiten`        | setzt fort: alles als vorhanden erkannt, 18 s                                                                                                                                                                                                                                                                                 |
| `umgebung`                      | JSON mit Windows-Build 26300, Hyper-V 10.0.26100.8115, beiden VMs (Konfigurationsversion 12.0, Secure Boot an, Reserve/Gewicht)                                                                                                                                                                                               |
| `up`                            | **RAM-Schutz greift:** verfügbar 14 GB, VMs 14 GB, Reserve 4 GB → Abbruch vor dem Start mit Abhilfe; VMs bleiben angelegt                                                                                                                                                                                                     |
| `status`, `destroy`             | korrekt; `destroy` zeigte eine harmlose Warnung, behoben in `ed2057cd`                                                                                                                                                                                                                                                        |

Nicht geprüft: Start der Labor-VMs unter Hyper-V, cloud-init darin, Einrichtung und Lauf. Ersatzbeleg für den Start: dieselbe Disk-Kette bootet in KVM mit erzwungenem Secure Boot (Microsoft-Schlüssel), cloud-init findet den Seed und setzt `eth0` über die MAC ([WINDOWS.md](vm/WINDOWS.md)). Ausgaben: `~/labor-1b/win-test6.log` (nicht im Repo).

## Versuch 5: Regression auf dem Endstand (2026-11-13 Abend)

Stand `76d61b4e` bzw. für `sync` und die Gruppe `024baaf9`, gleiche VM und gleiches Laufwerk `F:` wie Versuch 4, Labor-VMs nicht gestartet.

| Schritt                        | Ergebnis                                                                                                                                                                                              |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `vorpruefung`                  | alle Prüfungen OK                                                                                                                                                                                     |
| `up -NurVorbereiten`           | 5 Schritte mit Restzeit, VMs angelegt; **Fehler gefunden:** Aufnahme in Hyper-V-Administratoren scheitert („Prinzipal WORKGROUP\labor nicht gefunden“). Behoben in `76d61b4e` (Aufnahme über die SID) |
| `status`                       | OK, beide VMs „Off“ mit Reserve und Gewicht                                                                                                                                                           |
| `sync` bei ausgeschalteten VMs | **Fehler gefunden:** wartete über 20 min ohne Ausgabe auf SSH. Behoben in `024baaf9`; danach bricht `sync` sofort ab mit „VMs laufen nicht (…): erst labor.ps1 -Mode start.“                          |
| Gruppe nach dem Fix            | `Add-HyperVGruppe` direkt aufgerufen: nimmt `ARSNOVA-WIN\labor` auf; zweiter Aufruf ändert nichts                                                                                                     |
| `destroy -Ja`                  | OK, Basis-Image bleibt auf `F:`                                                                                                                                                                       |

Während des Laufs startete das Test-Windows für ein Update neu; das betraf nur die Testverbindung. Ausgaben: `~/labor-1b/win-test7.log`, `win-test8.log` (nicht im Repo). Danach wurde die Test-VM gelöscht (Zustimmung des Autors). Der Start der Labor-VMs unter Hyper-V bleibt ungeprüft (Grenze des Testaufbaus, siehe oben); Niklas' erster Aufbau ist der erste echte Test dafür.

## Ergebnis Teiltest (PowerShell 5.1.26100, Commit `1c6cf6474bae`)

_Aktualisiert 2026-11-13:_ Dieser Teiltest gehört zum früheren Weg über WSL. Er ist überholt: `labor.ps1` braucht seit Versuch 4 kein WSL mehr, und die Test-VM ist nach Versuch 5 gelöscht; ein Volltest folgt nicht mehr in dieser VM. W4 betrifft nur den alten Weg.

| Modus                   | Ergebnis                                                                                                                                      |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `groessen -Ja`          | OK: 4 Kerne, 4 Threads, 17 GB erkannt; Empfehlung llm 2 vCPU/10 GB, app 2 vCPU/4 GB mit allen vier Hinweisen (knappe Stufe, ohne SMT Kerne−2) |
| `status`                | OK: Switch, NAT und beide VMs als „fehlt“ gemeldet                                                                                            |
| `pruefen`               | OK: Bericht geschrieben, SSH-Prüfungen und Switch scheitern erwartungsgemäß, NAT ohne Weiterleitung und gesperrter Port 8080 als OK           |
| `up -Ja` ohne Schlüssel | **Fehler gefunden:** `vm-windows.ps1` meldet „SSH-Schlüssel fehlt“, `labor.ps1` richtete trotzdem den llm-host ein (Befund W1)                |
| `up -Ja` nach Fix       | OK: bricht nach der Meldung von `vm-windows.ps1` ab                                                                                           |
| `up -Ja` mit Schlüssel  | OK: Speicherwarnung (35,8 GB frei), dann Abbruch „WSL startet keine Distribution“ mit Installationshinweis                                    |

Nicht getestet: VMs anlegen, WSL-Teil, `llm-start.sh`/`app-start.sh` über Windows, Kalibrierung und Lauf. Seit Versuch 2 läuft der Hypervisor; der Volltest (`win-test.sh wsl`, dann `labor`) folgt nach dem gewerteten Linux-Lauf, die VM bleibt dafür erhalten.

## Befunde

- **W1 (behoben):** `vm-windows.ps1` meldet Fehler nur mit `exit 1`; `labor.ps1` prüfte den Exit-Code nicht. Jetzt wirft `Invoke-VmScript` bei Code ≠ 0, und `vm-windows.ps1` endet bei Erfolg mit `exit 0`. Pester-Test `Invoke-VmScript` (rot vor, grün nach dem Fix), alle 25 Pester-Tests grün.
- **W2 (behoben, nur Testaufbau):** Die Firewall-Regel des OpenSSH-Pakets gilt nur im Profil „Privat“, das NAT-Netz der VM ist „Öffentlich“. `setup.ps1` setzt die Regel jetzt auf alle Profile.
- **W3 (behoben, nur Testaufbau):** `ssh-keygen -N ""` über `cmd /c` scheiterte an der Quotierung; `win-test.sh` nutzt jetzt `-N '""'` (in der VM geprüft). Die Wartezeit auf SSH ist auf 240 min erhöht.
  _Aktualisiert 2026-11-14 (Docs-Audit):_ Seit dem Weg ohne WSL (`effede2f`) erzeugt `win-test.sh` keinen Schlüssel mehr; das macht `vm/vm-windows.ps1` (Z. 251). W3 betrifft nur den alten Weg.
- **W4 (offen, klein):** Die Meldung von `wsl.exe` erscheint als UTF-16 mit Leerzeichen zwischen den Zeichen; nur Kosmetik.
