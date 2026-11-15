# 1B-Labor unter Windows

Anleitung für dasselbe Zwei-VM-Labor wie unter Linux, mit Hyper-V und ohne WSL ([ADR 1B-012](../../../adr/1B-012-windows-aufbau-ohne-wsl.md)). Gemeinsame Teile (Größen, Messmodi, Datenregeln, Tests) stehen im [Runbook](../runbook.md); hier nur, was unter Windows anders ist. Teststand: [Windows-Test](../2026-11-13-windows-test.md), auf Windows 11 bis vor den Start der Labor-VMs geprüft.

_Aktualisiert 2026-11-14 (Docs-Audit):_ Die Windows-Schritte aus Runbook Abschnitt 8 stehen jetzt hier; Parametertabelle vervollständigt; Begründung und Alternativen im ADR 1B-012.

|     | app-host       | llm-host       |
| --- | -------------- | -------------- |
| IP  | 192.168.150.10 | 192.168.150.20 |
| MAC | 00155D1B0010   | 00155D1B0020   |

Netz `192.168.150.0/24`, Gateway `.1` auf dem Rechner, ausgehend NAT, von außen nicht erreichbar (kein Port-Forwarding, keine Bridge, [ADR 1B-003](../../../adr/1B-003-laborregel-virtuelles-netz.md)). SSH-Nutzer: `labor`. Größen: [Runbook, Abschnitt 2](../runbook.md#2-aufbau).

## 1. Vorbereitung (einmal)

1. Repo aktualisieren und den eigenen Branch anlegen ([Runbook, Abschnitt 8](../runbook.md#8-übergabe-an-niklas-schritte-34)). Den Clone mit dem Git **in WSL** anlegen (etwa unter `/mnt/d/…`, unter Windows dann `D:\…`), nicht mit Git for Windows: Dessen Standard `core.autocrlf=true` macht aus den `.sh`-Dateien CRLF-Dateien, dann scheitern `labor-wsl.sh` und `--arbeitsstand`. Gibt es schon einen Windows-Clone: `git config core.autocrlf false`, dann `git checkout -- .` (vorher eigene Änderungen sichern). Ein Clone als Git-Worktree wird abgelehnt; das Skript aus dem Haupt-Clone starten.
2. **PowerShell als Administrator** öffnen (Rechtsklick > „Als Administrator ausführen“) und in den Ordner `docs\referat-thema-1\evidenz\1B` des Clones wechseln, etwa `cd D:\<projekte>\arsnova.eu\docs\referat-thema-1\evidenz\1B` (ein Clone nur im WSL-Dateisystem geht auch über `\\wsl.localhost\Ubuntu\…`).
3. `powershell -ExecutionPolicy Bypass -File .\labor.ps1 -Mode vorpruefung`: fragt zuerst, wohin die VM-Disks sollen (zeigt den freien Platz je Laufwerk und empfiehlt das lokale NTFS/ReFS-Laufwerk mit dem meisten, etwa `D:\arsnova-1b`; die Wahl gilt für alle späteren Aufrufe, ändern mit `-VmDir`). Dann prüft es alles und sagt zu jedem `FEHLER`, was zu tun ist. Am System ändert es ohne `-EnableHyperV` nichts. Es merkt sich den Ort in `%USERPROFILE%\labor-1b\einstellungen.json`; erst wenn kein `FEHLER` bleibt, legt es den VM-Ordner und den Laborschlüssel `%USERPROFILE%\.ssh\arsnova-1b_ed25519` an. Typisch beim ersten Mal: Hyper-V ist aus. Dann denselben Befehl mit `-EnableHyperV` am Ende, Windows **neu starten**, Schritt 3 wiederholen.
4. Docker Desktop beenden. WSL 2 reserviert sich bis zur Hälfte des RAMs (im Task-Manager `VmmemWSL`); ohne Codex in WSL genügt vor `up` ein `wsl --shutdown`, mit Codex WSL begrenzen (Abschnitt 6).

Geprüft werden: Admin-Rechte, Windows-Edition (Home hat kein Hyper-V), Hyper-V aktiv und Hypervisor läuft (sonst Hinweis auf BIOS/UEFI), Hyper-V-Modul, `ssh.exe`/`scp.exe`, `tar.exe`, Labornetz frei (VPN, Heimnetz), andere NAT-Netze, freier Platz und die Downloadquellen (Ubuntu, Docker, NodeSource, Hugging Face, GitHub Container Registry). Die Downloadprüfung geht ohne Proxy, wie die VMs, und prüft externes DNS (1.1.1.1), das Uni- oder Firmennetze oft sperren. Den Laborschlüssel legt das Skript ohne Passphrase an, wenn er fehlt; hat ein vorhandener Schlüssel eine Passphrase, bricht es mit Hinweis ab (sonst scheiterte SSH später still).

## 2. Aufbau

Im Folgenden steht `labor.ps1 -Mode X` kurz für `powershell -ExecutionPolicy Bypass -File .\labor.ps1 -Mode X` im Ordner `evidenz\1B`; ein bloßes `.\labor.ps1` scheitert an der Standard-Execution-Policy von Windows. Unter Windows und in WSL nie `labor.sh` aufrufen, das ist der Linux-Weg.

`powershell -ExecutionPolicy Bypass -File .\labor.ps1 -Mode up` zeigt die Empfehlung und was dem Rechner bleibt, fragt einmal, dann läuft es allein (etwa 45–60 min; jeder Schritt mit `[n/11]`, Zeit seit Beginn, geschätzter Restzeit und voraussichtlichem Ende). Solange das Skript läuft (`up`, `start`, `kalibrierung`, `lauf`), geht der Rechner nicht in den Ruhezustand; Netzteil anschließen, im Akkubetrieb weist es darauf hin. Wer erst sehen will, was angelegt wird: zuerst mit `-NurVorbereiten` (startet keine VM).

- Bricht es ab, steht da, in welchem Schritt, warum und was zu tun ist, dazu der Pfad zum Log. Nach dem Beheben denselben Befehl erneut aufrufen; Fertiges wird übersprungen. Bei Fragen das Log an Jonas schicken (enthält keine Tokens).
- Am Ende darf der Bericht `%USERPROFILE%\labor-1b\aufbau-<Zeit>.txt` keine `FEHLER`-Zeile enthalten; ihn ins eigene Aufbauprotokoll `evidenz/1B/<Datum>-aufbau-windows.md` übernehmen. Der Start der VMs unter Hyper-V läuft hier zum ersten Mal auf echter Hardware; jede Abweichung notieren.
- Das erste `up` (als Administrator) trägt den Nutzer in die Gruppe Hyper-V-Administratoren ein; nach erneuter Anmeldung brauchen `status`, `start`, `stop` und Läufe kein Admin-Fenster mehr.

Jeder Aufruf außer `pruefen` (der schreibt den Bericht) legt ein Log `%USERPROFILE%\labor-1b\log-<Modus>-<Zeit>.txt` an, ohne Tokens.

## 3. Parameter

| Parameter                                        | Standard                                    | Bedeutung                                                                                                                                           |
| ------------------------------------------------ | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `-Mode`                                          | `groessen`                                  | `vorpruefung`, `up`, `groessen`, `pruefen`, `status`, `umgebung`, `sync`, `start`, `stop`, `kalibrierung`, `lauf`, `kontrolle`, `belege`, `destroy` |
| `-Ja`                                            | aus                                         | ohne Rückfragen, Empfehlung übernehmen                                                                                                              |
| `-NurVorbereiten`                                | aus                                         | nur bei `up`: alles anlegen, keine VM starten                                                                                                       |
| `-LlmCpus`, `-LlmRamGB`, `-AppCpus`, `-AppRamGB` | Empfehlung (0)                              | eigene Größen; Hinweise zu knappen Größen gibt es nur für die Empfehlung                                                                            |
| `-LlmDiskGB`, `-AppDiskGB`                       | 20, 25                                      | Obergrenze der Platten (mindestens 20 bzw. 25)                                                                                                      |
| `-RamReserveGB`                                  | 4                                           | RAM, der Windows bleiben muss (mindestens 2)                                                                                                        |
| `-EnableHyperV`                                  | aus                                         | Hyper-V aktivieren (danach Neustart)                                                                                                                |
| `-NoSecureBoot`                                  | aus                                         | Secure Boot aus, falls das Image mit dem Template nicht startet; wirkt nur beim Anlegen, vorher `destroy`                                           |
| `-SshKey`                                        | `%USERPROFILE%\.ssh\arsnova-1b_ed25519.pub` | eigener Laborschlüssel für `labor`                                                                                                                  |
| `-VmDir`                                         | beim ersten Aufruf gefragt                  | Image, Disks, Seeds, `known_hosts`; gemerkt nur bei `vorpruefung` und `up`; nie einchecken                                                          |
| `-LabN`                                          | 10                                          | Aufträge je Lauf, 1 bis 10                                                                                                                          |
| `-LabTag`                                        | leer                                        | Name des Laufs, nur `a–z`, `0–9`, `-`; Präfix `dev` oder `probe`: Ergebnis kommt nicht nach `messung/`                                              |
| `-LabTimeoutMs`                                  | 0 (aus der Kalibrierung von heute)          | 90000 oder 300000; für den ersten Lauf ohne Kalibrierung Pflicht                                                                                    |
| `-LabRuntimeAus`                                 | aus                                         | nur `lauf`: Aufträge bei gestoppter Runtime (B0)                                                                                                    |
| `-Commit`                                        | leer (HEAD)                                 | 40-stelliger Commit, den alle Modi mit Repo-Übertragung in die VMs bringen; setzt `labor-wsl.sh --arbeitsstand`                                     |
| `-OutDir`                                        | `%USERPROFILE%\labor-1b`                    | Bericht, Logs, Rohdaten                                                                                                                             |

Die Messmodi und ihre Reihenfolge sind dieselben wie unter Linux ([Runbook, Abschnitt 3](../runbook.md#3-lauf)), etwa Schritt 1 als `-Mode lauf -LabN 1 -LabTag dev-body -LabTimeoutMs 300000`, B0 als `-Mode lauf -LabRuntimeAus -LabTag b0`. Die Ergebnisse kopiert `labor.ps1` nach `messung/`.

## 4. Vor Kalibrierung und Lauf

`kalibrierung` und `lauf` sperren den Ruhezustand, solange sie laufen; `kontrolle` und `belege` ebenfalls (seit 2026-11-14). Von Hand: Energiemodus „Beste Leistung“ (Einstellungen → System → Netzbetrieb und Akku), Netzteil an, Windows Update für die Dauer pausieren (Einstellungen → Windows Update → Updates aussetzen). `labor.ps1` ändert beides nicht. Es hält nur den aktiven Energiesparplan fest (`powercfg /getactivescheme`) und vergleicht ihn zwischen Kalibrierung und Lauf; den Energiemodus „Beste Leistung“ zeigt `powercfg` nicht an, ein geänderter Modus fällt dem Vergleich also nicht auf.

## 5. Zwischen den Sitzungen und Rückbau

- Zwischen den Sitzungen `labor.ps1 -Mode stop`, vorher wieder `labor.ps1 -Mode start` (fährt hoch, wartet auf die Dienste und prüft). Die VMs laufen nur, wenn getestet wird. Nach einem Neustart von Windows sind sie aus und starten nicht von selbst; dann ebenfalls `-Mode start`.
- Am Ende `-Mode destroy`: entfernt nur Objekte namens `arsnova-1b…` (VMs, Disks, Switch und NAT). Basis-Image und Download bleiben im VM-Ordner; den Ordner löschen, wenn auch sie weg sollen (der beim ersten Aufruf gewählte Ort, gemerkt in `%USERPROFILE%\labor-1b\einstellungen.json`; ohne Wahl `C:\ProgramData\arsnova-1b`).
- Hyper-V bleibt an. Wer es wieder aus haben will (etwa für VirtualBox oder VMware): Admin-PowerShell `Disable-WindowsOptionalFeature -Online -FeatureName Microsoft-Hyper-V-All`, neu starten.
- Während das Labor läuft, kein VPN mit „gesamten Verkehr tunneln“ verbinden: Dann erreicht der Rechner die VMs nicht mehr.

## 6. Arbeiten mit Codex in WSL

- WSL nicht beenden, sondern begrenzen: `%USERPROFILE%\.wslconfig` mit `[wsl2]` und `memory=6GB`, danach einmal `wsl --shutdown`. Bei 32 GB empfiehlt `up` llm-host 12 GB und app-host 6 GB, zusammen 18 GB, und verlangt beim Start zusätzlich 4 GB Reserve: verfügbar sein müssen also etwa 22 GB. Mit WSL auf 6 GB und Windows selbst (3–5 GB) wird das knapp; vorher Browser und andere große Programme schließen. Reicht es nicht, bricht `up` vor dem Anlegen ab und nennt die größten Verbraucher; dann mit `-AppRamGB 4` erneut starten (der App-Build in der VM wird langsamer).
- Aus WSL steuert `evidenz/1B/labor-wsl.sh` das Labor über die Windows-Programme (`labor.ps1`, `ssh.exe`); WSL braucht die VMs dafür nicht direkt zu erreichen. Ohne Argumente zeigt es seine Hilfe. Beispiele: `labor-wsl.sh status`, `labor-wsl.sh vm llm 'docker ps'`, `labor-wsl.sh lauf -LabN 1 -LabTag dev-x -LabTimeoutMs 300000 --arbeitsstand`. Ohne `-LabTimeoutMs` braucht `lauf` eine Kalibrierung vom selben Tag, und die Kalibrierung braucht einen Prompt-Body aus einem früheren Lauf; auf einem frischen Labor also zuerst [Runbook, Abschnitt 3](../runbook.md#3-lauf), Schritt 1.
  - `--arbeitsstand` nimmt nicht committete Änderungen mit (Commit unter `refs/labor/arbeitsstand`, der Zweig bleibt unverändert); er wirkt bei allen Modi, die den Repo-Stand in die VMs bringen (`sync`, `up`, `kalibrierung`, `lauf`, `kontrolle`, `belege`). Solche Läufe sind Entwicklungsläufe: `-LabTag dev-…`, nicht werten. `kontrolle` und `belege` nie mit `--arbeitsstand`: Sie schreiben immer nach `messung/`; ist es doch passiert, die neue Datei oder den Ordner dort wieder löschen.
  - `up` und `destroy` öffnen ein Admin-Fenster (UAC) und zeigen danach die letzten 40 Zeilen des Logs. `vorpruefung` braucht ebenfalls Admin-Rechte und scheitert aus WSL ohne Admin-Fenster; sie einmal in einer Admin-PowerShell aufrufen.
  - `vm` nutzt immer den Laborschlüssel `%USERPROFILE%\.ssh\arsnova-1b_ed25519` und den VM-Ordner aus `einstellungen.json`.
  - Die WSL-Interop muss an sein (`/etc/wsl.conf`, `[interop] enabled=true`).
- **Codex-Sandbox:** `labor-wsl.sh` braucht die Windows-Interop (`powershell.exe`, `ssh.exe`), Netz und Schreibzugriff auf `.git` (für `--arbeitsstand`) sowie auf `%USERPROFILE%\labor-1b`. In einer eingeschränkten Sandbox diese Befehle freigeben oder Codex mit vollem Zugriff auf den Clone starten; mit echtem Codex ist das noch nicht ausprobiert.
- **Lange Läufe:** `kalibrierung` dauert einige Minuten, ein Lauf mit 10 Aufträgen 35–45 min, `up` 45–60 min. Solche Befehle startet Niklas besser selbst in einem eigenen WSL-Terminal, etwa `bash docs/referat-thema-1/evidenz/1B/labor-wsl.sh lauf -LabN 10 -LabTag stoerung-x 2>&1 | tee ~/lauf-stoerung-x.log`; Codex liest danach Log und Ergebnis. Bricht ein Lauf ab: im Task-Manager prüfen, ob noch `powershell.exe` läuft, und `labor-wsl.sh vm app 'pgrep -af lauf.sh'`.
- Codex beim Start sagen: „Lies `docs/referat-thema-1/AGENTS.md`, Abschnitt 1B-Labor für Agenten.“ Dort stehen Befehle und Regeln (Hypothese vor jedem Lauf, keine Tokens ins Repo, Läufe nur nach Rückfrage).

## 7. Was `-Mode up` tut

Die VM-Schicht ist `vm-windows.ps1`, die Hilfsfunktionen stehen in `windows-lib.ps1` (getestet mit Pester, auch unter Linux-pwsh). Ein erneuter Aufruf überspringt, was fertig ist.

1. **Vorprüfung** wie Abschnitt 1, dann RAM- und Platzprüfung vor dem Aufbau.
2. **Netz**: interner Switch `arsnova-1b`, `192.168.150.1/24`, `New-NetNat` ([NAT-Netz](https://learn.microsoft.com/windows-server/virtualization/hyper-v/setup-nat-network); nur ein NAT pro Rechner).
3. **Image**: `ubuntu-24.04-server-cloudimg-amd64.img` (qcow2 v3, zlib) von `cloud-images.ubuntu.com/releases/noble/release`, SHA-256 gegen `SHA256SUMS`. Ein eigener qcow2-Leser in `windows-lib.ps1` entpackt es zur Rohdisk, eine VHD-Fußzeile (Microsoft-VHD-Spezifikation) macht daraus eine feste VHD, `Test-VHD` prüft sie, `Convert-VHD` erzeugt die dynamische VHDX (erst unter Zwischennamen, dann umbenannt). Belege in [ADR 1B-012](../../../adr/1B-012-windows-aufbau-ohne-wsl.md#belege). Das `tar.gz` neben dem Image enthält nur die Root-Partition und bootet nicht.
4. **Je VM**: Kopie der Basis-VHDX, `Resize-VHD`, NoCloud-Seed als ISO (Label `cidata`, ISO9660 und Joliet über die Windows-Schnittstelle IMAPI2, wie im Projekt [hyperv-vm-provisioning](https://github.com/schtritoff/hyperv-vm-provisioning)), Generation 2, Secure-Boot-Template `MicrosoftUEFICertificateAuthority`, statischer Speicher, keine automatischen Checkpoints, feste MAC. Mit `-NurVorbereiten` endet `up` hier.
5. **Start**: zweite RAM-Prüfung mit dem dann verfügbaren RAM (statischer Speicher wird beim Start belegt); bliebe Windows weniger als die Reserve, bricht es ab, die VMs bleiben angelegt.
6. **Repo-Stand**: `.git` des Clones per `tar.exe` packen, in jede VM kopieren, dort klonen und den Commit von `HEAD` (oder `-Commit`) auschecken; kein `git.exe` nötig. Wartet je VM bis 20 min auf cloud-init und meldet alle 60 s den Stand.
7. **Einrichtung** (`labor.ps1`): llm-host (Runtime-Image, Modell 2,3 GiB, Start), app-host (App-Build, Datenbank, Start), dann alle Prüfungen mit Bericht.

## 8. Noch nicht auf echter Hardware verifiziert

- Start der VMs unter Hyper-V und cloud-init darin. In einer KVM-VM auf dem Laptop nicht verlässlich testbar: In [Versuch 3](../2026-11-13-windows-test.md#verlauf-versuch-3-volltest-mit-wsl-2026-11-13-vormittag) hing Windows, als zum ersten Mal eine VM in der Windows-VM startete (Ursache vermutet, nicht belegt). Der Rest bis kurz vor dem Start ist dort getestet (Versuche 4–5).
- Ob das generische Ubuntu-Image mit dem Secure-Boot-Template startet. Microsoft listet Ubuntu 24.04 mit UEFI und Secure Boot als unterstützt ([Ubuntu auf Hyper-V](https://learn.microsoft.com/windows-server/virtualization/hyper-v/supported-ubuntu-virtual-machines-on-hyper-v)); falls nicht (die Bootausgabe in `vmconnect localhost arsnova-1b-llm` zeigt einen Secure-Boot-Fehler und `up` wartet 20 min vergeblich): erst `labor.ps1 -Mode destroy`, dann `labor.ps1 -Mode up -NoSecureBoot`.
- Ob cloud-init die Schnittstelle als `eth0` umbenennt; der Treffer läuft über die MAC, der Name ist nur kosmetisch.
- Alles danach: Einrichtung beider VMs über `ssh.exe` (`llm-start.sh`, `app-start.sh`), `pruefen`, `kalibrierung`, `lauf`, `kontrolle`, `belege` samt Rückholen der Ergebnisse, die Aufnahme in die Gruppe Hyper-V-Administratoren, das Admin-Fenster aus WSL und `labor-wsl.sh` insgesamt (bisher nur mit Attrappen getestet) sowie ein Clone unter `\\wsl.localhost\…`.

Niklas führt diese Schritte als Erster auf echter Hardware aus. Jede Abweichung mit dem Log (`%USERPROFILE%\labor-1b\log-*.txt`) im eigenen Aufbauprotokoll `evidenz/1B/<Datum>-aufbau-windows.md` festhalten und Jonas Bescheid geben.

## 9. CPU-Pinning

`Set-VMProcessor` kennt Anzahl, Reserve, Limit und Gewicht, **keine Affinität**. Das Skript setzt für den llm-host `-Reserve 100` und `-RelativeWeight 200`, für den app-host `-RelativeWeight 100`. CPU-Gruppen mit Affinität ([Resource Controls](https://learn.microsoft.com/windows-server/virtualization/hyper-v/manage/manage-hyper-v-cpugroups#isolating-vm-groups-to-specific-host-processors)) sind für Windows Server beschrieben; auf Windows 11 Pro **nicht verifiziert**. Im Protokoll als Abweichung zum Linux-Lauf vermerken.

## 10. Prüfung nach dem Start

`labor.ps1 -Mode pruefen` deckt Runbook §10 und §11 und die Negativtests ab. Von Hand zusätzlich: Vom **Handy oder zweiten Rechner im Heimnetz** muss `curl --max-time 5 http://192.168.150.20:8080/health` scheitern; `Get-NetRoute -DestinationPrefix 192.168.150.0/24` zeigt nur `vEthernet (arsnova-1b)`; `Get-VMSwitch` zeigt `arsnova-1b` als `Internal`.

## 11. Gültigkeitsgrenzen

- Absolute Zeiten sind zwischen Rechnern **nicht vergleichbar**; verglichen werden Verhältnisse und die Zerlegung innerhalb eines Rechners.
- Kein CPU-Pinning (Abschnitt 9): schwächere Isolation als unter Linux; im Protokoll ausweisen.
