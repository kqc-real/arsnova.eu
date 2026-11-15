# 1B-Labor: Nachbau und Lauf

Zwei VMs auf einem Rechner: app-host `192.168.150.10` (App aus `docker-compose.prod.yml`) und llm-host `192.168.150.20` (Runtime aus `docker-compose.llm.yml`). Entscheidungen: [ADR 1B-002](../../adr/1B-002-topologie-zwei-vms-ein-rechner.md) bis [ADR 1B-012](../../adr/1B-012-windows-aufbau-ohne-wsl.md). Linux ist getestet. Windows läuft ohne WSL; die Schritte unter Windows stehen in [WINDOWS.md](vm/WINDOWS.md), der Teststand im [Windows-Test](2026-11-13-windows-test.md). Dieses Runbook gilt für beide Systeme; Befehle stehen in der Linux-Form (unter Windows, auch in WSL, nie `labor.sh`, sondern `labor.ps1` bzw. `labor-wsl.sh` mit denselben Modi), die Windows-Parameter in [WINDOWS.md, Abschnitt 3](vm/WINDOWS.md#3-parameter).

_Aktualisiert 2026-11-14 (Docs-Audit):_ Schritt 1 des Laufs, fehlende Modi und Variablen, Abschnitt 9 (Tests) ergänzt; die Windows-Anleitung aus Abschnitt 8 steht jetzt in WINDOWS.md.

## 1. Voraussetzungen

| Was             | Linux                                                                                                                    | Windows                                                                  |
| --------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| Rechner         | mindestens 16 GiB RAM und 2 physische Kerne mit SMT (ohne SMT 4); empfohlen 24 GiB und 4 Kerne                           | dasselbe                                                                 |
| Virtualisierung | KVM (`/dev/kvm`), libvirt, `virt-install`, `qemu-img`, `xorriso`, `jq`; `labor.sh` nennt fehlende Pakete je Distribution | Windows 10/11 Pro, Education oder Enterprise mit Hyper-V; kein WSL nötig |
| Rechte          | Gruppe `libvirt`; sudo nur für ufw-Freigaben und das VM-Verzeichnis (fragt nach)                                         | Admin-PowerShell                                                         |
| Netz            | Internet für Ubuntu-Image, Pakete, Docker-Images und das GGUF (2,3 GiB)                                                  | dasselbe                                                                 |
| Strom           | Netzteil; Energieprofil siehe Abschnitt 4                                                                                | dasselbe                                                                 |

## 2. Aufbau

```bash
bash docs/referat-thema-1/evidenz/1B/labor.sh groessen   # nur Empfehlung ansehen
bash docs/referat-thema-1/evidenz/1B/labor.sh up         # alles aufbauen und prüfen
```

`up` zeigt die Größenempfehlung für den Rechner und fragt, ob sie übernommen wird. Danach baut es die VMs, richtet den llm-host ein (Runtime-Image in lokaler Registry, GGUF prüfen oder laden, `.env.llm` mit Token nur in der VM, Wrapper-Prüfungen, Start), dann den app-host (App-Image, `.env.production`, Migrationen, Start), und prüft zuletzt alles. Liegt das GGUF schon unter `models/open-weight-llm/` im Clone, kopiert `labor.sh` es in den llm-host statt es zu laden. Jeder Schritt zeigt unter Linux und Windows dieselbe Zeile, etwa `[5/7] llm-host einrichten … (dauert 5-20 min) - seit Beginn 25:00, noch etwa 37:00, fertig gegen 20:40` (Linux 7 Schritte, Windows 11; Schätzung aus den Aufbauten am ThinkPad P50). `up` startet keine Messung; Kalibrierung und Läufe nur auf eigenen Befehl (Abschnitt 3). Ohne Rückfragen: `LAB_JA=1`. Dauer am ThinkPad P50: 48 min beim Aufbau von null am 2026-11-13 abends ([Laufprotokoll, Nachtrag](2026-11-13-lauf.md#nachtrag-2026-11-13-abends-ergänzende-messungen-m1m4)).

**Schutz für den Rechner:** Vor dem Anlegen zeigt `up`, was es belegt und was dem Rechner bleibt, und **bricht ab, ohne etwas anzulegen**, wenn

- nach dem Start der VMs weniger als die RAM-Reserve frei bliebe (Standard 4 GiB; `LAB_RAM_RESERVE_GIB`, mindestens 2, kleiner nur auf Testrechnern ohne andere Programme), oder
- der freie Platz kleiner ist als der gemessene Bedarf (etwa 31 GiB) plus 10 GiB Reserve.

Unter Windows zählt der verfügbare RAM wie im Task-Manager (frei plus Cache), geprüft vor dem Aufbau und noch einmal direkt vor dem Start der VMs. Läuft WSL oder Docker Desktop, belegen sie selbst RAM ([WINDOWS.md, Abschnitt 1](vm/WINDOWS.md#1-vorbereitung-einmal)).

| Belegt (Empfehlung bei 24 GiB RAM und mehr) | llm-host                         | app-host            | Hinweis                        |
| ------------------------------------------- | -------------------------------- | ------------------- | ------------------------------ |
| RAM (fest, solange die VM läuft)            | 12 GiB                           | 6 GiB               | knapp: 10 + 4 GiB              |
| vCPU                                        | physische Kerne, höchstens 8     | 2                   | ohne SMT bleiben 2 Kerne frei  |
| Platte (Obergrenze, dünn belegt)            | 20 GiB (real ~9)                 | 25 GiB (real ~15)   | App-Build braucht kurz ~18 GiB |
| Last                                        | volle vCPUs nur während Inferenz | gering, außer Build | Leerlauf fast null             |

Platte real: am ThinkPad P50 nach allen Läufen gemessen (2026-11-14). Eigene Größen: `LAB_LLM_VCPU`, `LAB_LLM_RAM_GIB`, `LAB_LLM_DISK_GIB`, `LAB_APP_VCPU`, `LAB_APP_RAM_GIB`, `LAB_APP_DISK_GIB` (Pinning rechnet `labor.sh`). Lehnt man die Empfehlung auf die Frage „Übernehmen?“ ab, fragt `up` die Größen einzeln ab und lehnt zu kleine Werte ab. Hinweise zu knappen Größen zeigt `up` nur für die Empfehlung, nicht für eigene Werte. Nach dem Build löschen beide VMs ihren Docker-Build-Cache (im app-host rund 6 GiB).

**Ein und aus:** `labor.sh stop` fährt beide VMs herunter; dann belegen sie weder RAM noch CPU, Daten und Einrichtung bleiben. `start` fährt sie wieder hoch, wartet auf die Dienste und prüft alles.

**Zustand:** `labor.sh status` (VMs, Pinning, Docker, Repo-Stand), `labor.sh umgebung` (Rechner, Hypervisor und VMs als JSON; steht auch in jedem Ergebnis).

Ergebnis: Aufbaubericht `~/labor-1b/aufbau-<Zeit>.txt` mit je einer Zeile `OK` oder `FEHLER` pro Prüfung, dazu `INFO`-Zeilen; dort liegen auch `llm-start.log` und `app-start.log`. Erneut prüfen: `labor.sh pruefen`. `up` ist mehrfach aufrufbar; bestehende VMs mit anderer Größe lehnt es ab (dann `destroy`, Abschnitt 5).

Weitere Variablen: `LAB_OUTDIR` (Bericht, Logs und Rohdaten, Standard `~/labor-1b`), `LAB_VMDIR` (VM-Verzeichnis, Standard `/var/lib/libvirt/images/arsnova-1b`), `LAB_SSH_KEY` und `LAB_COMMIT` (Repo-Stand für die VMs, muss ein Vorfahre von `HEAD` sein; `vm/vm-linux.sh`).

## 3. Lauf

Reihenfolge, jeweils vom Rechner aus:

1. Einen Prompt-Body erzeugen, falls noch keiner da ist: `LAB_TAG=dev-body LAB_N=1 LAB_TIMEOUT_MS=300000 LAB_PROFIL=unveraendert labor.sh lauf`. Der Timeout ist hier Pflicht, weil es noch keine Kalibrierung gibt.
2. Kalibrierung: `labor.sh kalibrierung` → I = `prompt_ms + predicted_ms` und Timeout (90 000 oder 300 000 ms; über 270 s Abbruch, dann nicht weiter messen, siehe Abschnitt 8).
3. Probelauf: `LAB_TAG=probe LAB_N=2 labor.sh lauf`.
4. Gewerteter Lauf: `LAB_N=10 labor.sh lauf`.

Ohne `LAB_TIMEOUT_MS` nimmt `lauf` den Timeout aus der jüngsten Kalibrierung von heute und bricht ab, wenn deren Energieprofil nicht zum Lauf passt. `LAB_TIMEOUT_MS` erlaubt nur 90000 oder 300000, `LAB_N` 1 bis 10. Bricht ein Lauf ab, stoppt ein `trap` Mitschnitte und Speicherprotokoll; die Rohdaten bleiben im app-host unter `~/labor-1b/`.

Ein Lauf startet die Runtime frisch (höchstens 10 Aufträge je Runtime, [ADR 1B-007](../../adr/1B-007-umgang-mit-1c-fallen.md)), schneidet auf beiden Hosts mit, legt per Treiber eine Session mit dem 1C-Referenzszenario an (200 Teilnehmende über die API) und löst die Aufträge mit 31 s Abstand aus. Danach Zeitzerlegung und die Kontrolle C0 Direktprompt an einer frischen Runtime (nicht bei B0) (Begriffe: [ADR 1B-011](../../adr/1B-011-zeitbegriffe-und-leitfrage.md)). Rohdaten: `~/labor-1b/<Lauf>/`; Ergebnis: `evidenz/1B/messung/<Datum>-lauf[-Tag].json` (nicht bei Tag `dev…` oder `probe…`).

**Messmodi** (Nachtrag M1–M4, unter Linux und Windows):

| Messung                  | Linux                                        | Ergebnis unter `messung/`        |
| ------------------------ | -------------------------------------------- | -------------------------------- |
| Lauf, Probe, Entwicklung | `labor.sh lauf` mit `LAB_N`, `LAB_TAG`       | `<Datum>-lauf[-Tag].json`        |
| B0, Runtime ausgefallen  | `LAB_RUNTIME_AUS=1 LAB_TAG=b0 labor.sh lauf` | `<Datum>-lauf-b0.json`           |
| C0 nach M2 (n = 30)      | `labor.sh kontrolle`                         | `<Datum>-kontrolle-c0.json`      |
| Netz- und Konfig.-Belege | `labor.sh belege`                            | `<Datum>-belege/` (ohne Secrets) |

Ein zweites Ergebnis am selben Tag bekommt die Endung `-2`, `-3` …; nichts wird überschrieben. `kontrolle` und `belege` schreiben immer nach `messung/`, auch bei Entwicklungsständen. Ein Ausfall wird nicht von Hand vorbereitet: `lauf` startet die Runtime immer frisch, ein vorheriges `docker stop` wäre wirkungslos; `LAB_RUNTIME_AUS=1` stoppt sie nach dem Neustart und vor dem ersten Auftrag.

Nur beim Aufruf von `lauf.sh` direkt im app-host wirken außerdem `LAB_BODY` (Prompt-Body der Kalibrierung, sonst der jüngste `body.json`) und `LAB_N_C0` (Wiederholungen von `kontrolle`, Standard 30); `labor.sh` reicht sie nicht weiter. `lauf.sh auswerten <Verzeichnis>` wiederholt die Auswertung auf vorhandenen Rohdaten.

## 4. Energieprofil

`labor.sh lauf` hält unter Linux das Profil `performance` per `powerprofilesctl launch` und stellt es danach zurück, wie 1C. `LAB_PROFIL=unveraendert` lässt es wie es ist (nur Entwicklungsläufe). Das Ergebnis nennt das Profil. Kalibrierung und gewerteter Lauf brauchen dasselbe Profil. Während `kalibrierung`, `lauf`, `kontrolle` und `belege` sperrt `labor.sh` außerdem den Ruhezustand (`systemd-inhibit`). Windows: [WINDOWS.md, Abschnitt 4](vm/WINDOWS.md#4-vor-kalibrierung-und-lauf).

**Messruhe in den VMs:** Hintergrund-Updates (`apt-daily*`, `unattended-upgrades`, `fwupd-refresh` u. a.) schaltet das `user-data` unter Linux und Windows ab; `pruefen` meldet „Hintergrund-Updates aus“ (geprüft werden `apt-daily.timer` und `apt-daily-upgrade.timer`). Anlass: Am 2026-11-13 lief `apt-daily-upgrade` mitten im gewerteten Lauf in beiden VMs.

## 5. Rückbau

`labor.sh destroy`: VMs, Disks und Labornetz (fragt nach). Das Ubuntu-Image bleibt im VM-Verzeichnis liegen. Windows: [WINDOWS.md, Abschnitt 5](vm/WINDOWS.md#5-zwischen-den-sitzungen-und-rückbau).

## 6. Stolperfallen

| Falle                                                                       | Abhilfe                                                                               |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Aktive Host-ufw: VMs bekommen keine IP, kein ausgehendes NAT                | Freigabe nur auf `virbr-1b` für DHCP, DNS und Weiterleitung; `labor.sh` bietet sie an |
| Updates im Hintergrund während eines Laufs (VM oder Host)                   | VMs: `user-data` schaltet sie ab, `pruefen` prüft es; Host: siehe Abschnitt 4         |
| VM-Verzeichnis im Home (Modus 700): libvirt-qemu kann die Disks nicht lesen | `/var/lib/libvirt/images/arsnova-1b` (Standard)                                       |
| Runbook §6 `npm ci --omit=dev`: Produktionswrapper findet `dotenv` nicht    | `llm-start.sh` installiert ohne `--omit=dev` (Issue #21)                              |
| Push großer Layer in `registry:2` läuft in einen Timeout                    | Wiederholung (bis 5 Versuche) in `llm-start.sh` und `app-start.sh`                    |
| Neubau des Runtime-Images ergibt einen anderen Digest                       | Digest je Lauf aus dem Ergebnis nehmen, nicht aus einem älteren Bericht               |
| Windows PowerShell 5.1 hängt beim Pipen CRLF an                             | `app-start.sh` entfernt `\r` am Token                                                 |
| Windows PowerShell 5.1 liest Skripte ohne BOM als ANSI                      | `.ps1`-Dateien sind reines ASCII                                                      |
| tcpdump gibt unter Ubuntu Rechte ab und kann nicht ins Home schreiben       | `tcpdump -Z labor`, Dateiendung `.pcap` (AppArmor)                                    |
| sudo ohne Terminal (`LAB_JA=1`) fragt kein Passwort ab                      | ufw-Schritt wird dann nur angezeigt; einmalig von Hand setzen                         |
| Lange Hintergrundjobs eines Agenten werden bei Speicherdruck beendet        | Aufbau und Schlafsperre als `systemd-run --user`-Unit starten                         |

„Runbook §6“ meint hier das [Second-Host-Runbook](../../../operations/OPEN-WEIGHT-LLM-SECOND-HOST-RUNBOOK.md) des Release.

## 7. Datenregeln

Mitschnitte enthalten den Runtime-Token im `Authorization`-Header und bleiben in `~/labor-1b` (Windows: `%USERPROFILE%\labor-1b`); sie kommen nie ins Repo. Ins Repo kommen nur Ergebnis-JSON, Berichte und Belege ohne Secrets und Protokolle. Die Szenariodaten sind synthetisch (1C-Fixture).

## 8. Übergabe an Niklas (Schritte 3–4)

Stand für Störversuche und Betriebsaufwand auf dem eigenen Rechner. Auftrag: Issue [#9](https://github.com/NiklasSkulll/arsnova.eu/issues/9). Schritt-für-Schritt unter Windows, auch mit Codex in WSL: [WINDOWS.md](vm/WINDOWS.md). Für Codex: [`AGENTS.md`, Abschnitt 1B-Labor für Agenten](../../AGENTS.md#1b-labor-für-agenten-codex-claude).

- **Branch:** Eigene Arbeit frisch von `main` abzweigen, etwa `git fetch origin && git switch -c <eigener-branch> origin/main`. Der in #9 genannte Branch `feature-1B-private-inference-3-4` stammt vom 2026-10-23 und enthält das Labor nicht; ob er ersetzt oder ein neuer Name genutzt wird, entscheidet Niklas.
- **Begriffe und Vergleichswerte:** gemeinsame Zeitbegriffe (T_host … T_transport) in [ADR 1B-011](../../adr/1B-011-zeitbegriffe-und-leitfrage.md); Werte aus Schritt 2 (normaler Dienst, kalt und warm, C0, B0) im [1B-Ergebnis](../../1B-ergebnis.md), Rohdaten unter `messung/`. Absolute Zeiten anderer Rechner sind damit nicht vergleichbar, nur Verhältnisse; der normale Dienst wird deshalb auf dem eigenen Rechner neu gemessen.
- **Wiederverwendbar:** `lauf.sh` (Mitschnitt auf beiden Hosts, Speicher-CSV der Runtime, Zeitzerlegung), `pruefen.sh` (Limits, Flags, Bind), der Treiber `treiber.mjs` und der Ausfall B0. **B0 entspricht F1 aus #9** (Container gestoppt, schneller Fehler); Vergleichswert H_B0 im 1B-Ergebnis. S1 (Same-Host) ist in Schritt 2 nicht gemessen; wer S1 für Schritt 4 braucht, misst es selbst.
- **Was das Labor für Schritt 3 noch nicht kann:**
  - **Hohe Latenz und Firewall-DROP:** `lauf` hat außer `LAB_RUNTIME_AUS` keinen Haken für Störungen. Netzverzögerung und DROP lassen sich von Hand in der llm-host-VM setzen, vor dem Lauf, mit Rücknahme danach. Vorschlag, im Labor noch nicht ausprobiert (aus WSL jeweils `labor-wsl.sh vm llm '…'`):
    - Verzögerung nur für Antworten von Port 8080 (sonst wird auch SSH langsam): `IF=$(ip -o route get 192.168.150.10 | awk '{for(i=1;i<=NF;i++) if($i=="dev") print $(i+1)}')`, dann `sudo tc qdisc add dev $IF root handle 1: prio`, `sudo tc qdisc add dev $IF parent 1:3 handle 30: netem delay 500ms`, `sudo tc filter add dev $IF parent 1:0 protocol ip u32 match ip sport 8080 0xffff flowid 1:3`. Rücknahme: `sudo tc qdisc del dev $IF root`. Überlebt den Neustart der Runtime durch `lauf`, nicht den Neustart der VM.
    - DROP statt RST: `sudo ufw insert 1 deny from 192.168.150.10 to any port 8080 proto tcp` (ufw `deny` verwirft, `reject` antwortet). Rücknahme: `sudo ufw delete deny from 192.168.150.10 to any port 8080 proto tcp`. `pruefen` meldet währenddessen erwartungsgemäß `FEHLER`.
    - Fake-Server mit Verzögerung über dem Timeout (L3 in #9): braucht einen neuen Haken in `lauf.sh` nach dem Neustart der Runtime (Vorbild `LAB_RUNTIME_AUS`), weitergereicht über `labor.ps1` (Parameter und `Get-LaufEnv`) und `labor.sh`; der Fake-Server muss auf `192.168.150.20:8080` lauschen, weil ufw nur diesen Port freigibt. Die 1C-Test-Runtime (`apps/backend/src/__tests__/lib/open-weight-test-runtime.ts`) läuft nur in Vitest und ist kein eigenständiger Server.
  - **Rückwirkung auf den App-Host:** Die Speicher-CSV erfasst nur den Runtime-Container im llm-host, und der Treiber erzeugt keine Live-Last. Für CPU und RSS des App-Containers (`arsnova-v3-app`) und für p95 und Fehlerrate der Live-Aktionen fehlen noch eine Aufzeichnung im app-host (etwa wie die Speicherschleife in `lauf.sh`) und Live-Last (Messskript aus #6, sonst `npm run load:smoke:qa-classroom-30` im app-host gegen `127.0.0.1:3000`). Beides ist Teil von Schritt 3.
- **Regeln:**
  - Vor jedem gewerteten Lauf Hypothese, Messgröße und Schwelle aufschreiben: eigenes Design `specs/<Datum>-1b-stoerungen-design.md` oder ein datierter Nachtrag. Vor jedem Lauf, auch zur Entwicklung, fragt Codex Niklas.
  - Gewertete Läufe nur auf einem committeten Stand ohne `--arbeitsstand`; der Commit im Ergebnis-JSON muss auf dem eigenen Branch liegen. Eigene Läufe mit eigenem Tag (z. B. `stoerung-…`).
  - Jede Störung samt Rücknahme protokollieren und nach dem Lauf zurücknehmen; danach `pruefen`.
  - Ablage: Laufprotokolle als `evidenz/1B/<Datum>-lauf-<Tag>.md` nach dem Muster von [`2026-11-13-lauf.md`](2026-11-13-lauf.md), eigene Entscheidungen als ADR 1B-020 bis 1B-039; Ergebnis-JSON landen automatisch in `messung/`. Datenregeln wie Abschnitt 7.
  - Bricht die Kalibrierung ab (I > 270 s), nicht weiter messen: Rechner, I und Größen an Jonas melden und die Entscheidung als ADR festhalten (etwa mehr vCPU für den llm-host).
- **Schutz:** Reicht RAM oder Platz nicht, legt das Skript nichts an und sagt, was zu tun ist (Abschnitt 2).

## 9. Tests

Die Laborskripte haben eigene Tests, getrennt von `npm test`:

```bash
node --test docs/referat-thema-1/evidenz/1B/*.test.mjs docs/referat-thema-1/evidenz/1B/messung/*.test.mjs
pwsh -NoProfile -Command "Invoke-Pester -Path docs/referat-thema-1/evidenz/1B -Output Detailed"
```

Die Pester-Tests brauchen Pester 5 (`Install-Module Pester -MinimumVersion 5`) und laufen auch unter Linux mit `pwsh`. `qualitaetstor.test.mjs` lädt das Qualitätstor der App über `tsx` aus `node_modules`; vorher einmal `npm ci` im Clone.
