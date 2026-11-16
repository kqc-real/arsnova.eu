# 1B Schritte 3–4: Planung und Arbeitsstand

Stand: 2026-11-15. Auftrag: [Issue #9](https://github.com/NiklasSkulll/arsnova.eu/issues/9).
Niklas hat den Vorschlag im Chat am 2026-11-15 zur Dokumentation und Umsetzung
freigegeben. Das ist keine Freigabe für Laborläufe oder Störungen.

## Ziel und verbindliche Quellen

Schritt 3 untersucht, ob Live-Aktionen stabil bleiben, wenn die private Inferenz
langsam ist oder ausfällt. Schritt 4 bewertet anschließend den Betriebsaufwand
der zweiten Serverrolle gegen den gemessenen Isolationsgewinn.

Verbindlich sind die [Laborregeln](AGENTS.md#1b-labor-für-agenten-codex-claude),
die [Übergabe im Runbook §8](evidenz/1B/runbook.md#8-übergabe-an-niklas-schritte-34),
die [Windows-Anleitung](evidenz/1B/vm/WINDOWS.md) und die
[Zeitbegriffe aus ADR 1B-011](adr/1B-011-zeitbegriffe-und-leitfrage.md).
Die Baseline verwendet den echten Release-Pfad auf dem eigenen Rechner.
Fremde absolute Laufzeiten sind keine Vergleichsbasis.

## Vorgehen und Alternativen

Gewählt: vorhandenes Zwei-VM-Labor gezielt erweitern. Echte Runtime für
Normalbetrieb und Netzstörungen; eigenständiger Node-Fake ausschließlich für
deterministische Störvarianten. Ein reiner Fake-Vergleich bildet echte
Inferenzlast nicht ab; eine Neuentwicklung des Labors wäre unnötig umfangreich.
Die 1C-Test-Runtime ist eine Vorlage, kein eigenständiger Server.

Kein Produktionscode wird verändert. Der App-Host bleibt `192.168.150.10`, der
Inferenz-Host `192.168.150.20`; das Netz bleibt privat. Aus WSL erfolgen alle
Laboraktionen ausschließlich über `evidenz/1B/labor-wsl.sh`, niemals über
`labor.sh`. Änderungen an der Linux-Steuerung dürfen nur lesend oder über lokale
Tests ohne reale Laborverbindung geprüft werden.

## Hypothesen und vorab festgelegte Schwellen für Schritt 3

| Kennung     | Hypothese / Kriterium                                                                           | Auswertung                                                                                                                                        |
| ----------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| H2-Fehler   | Keine zusätzlichen Fehler bei Live-Aktionen durch langsame oder ausgefallene Inferenz           | Gleiche Live-Last; Fehlerzahl und Nenner je Aktion sowie Fehlerrate gegenüber B0 ausweisen. Eine fehlerhafte B0 zuerst untersuchen.               |
| H2-Latenz   | Live-p95 bleibt höchstens 10 % über B0                                                          | Je Aktion p95 ≤ 1,10 × B0 auf demselben Rechner. Erweiterung der Dossier-Schwelle auf Störfälle: Vorschlag aus unserer Planung.                   |
| H2-Fallback | Jeder betroffene Auftrag erreicht seinen Fallback spätestens nach effektivem Timeout + 1 s      | Job-Zeit, Ergebnisstatus und Fallback-Grund gemeinsam prüfen; Client-Wartezeit zusätzlich berichten.                                              |
| H-F1        | Gestoppte Runtime führt schnell zum extraktiven Fallback                                        | Median der Job-Zeit ≤ 2 s, passender Grund `unavailable`; Breaker-Antworten gesondert ausweisen.                                                  |
| H-F1F2      | DROP und Containerstopp zeigen verschiedene Fehlerpfade                                         | Median der Fallback-Zeit bei F2 > 10 × F1 für vergleichbare Aufträge mit tatsächlichem Netzversuch.                                               |
| H-Queue     | Ein Queue-Timeout kann im Client als `aborted` erscheinen und deshalb den Breaker nicht erhöhen | Gerichtete Folge mehrerer Timeouts; Status und neue Netzversuche prüfen, mit zählenden Fehlern vergleichen. Vermutung bestätigen oder widerlegen. |

CPU und tatsächlichen RSS des App-Containers als Verlauf erfassen, ohne vorab
unbegründete Grenzwerte zu erfinden. `docker stats`-Speicher ist kein RSS-Ersatz.
Zusätzlich Runtime-Speicher, Neustarts und OOM-Zustand erfassen.

Summary und Label werden getrennt ausgewertet. Für Summary gelten die auf dem
eigenen Rechner kalibrierten 90 000 oder 300 000 ms. Label-Budget und tatsächliche
Konfiguration werden separat dokumentiert. Die vorhandene Sekundenabfrage im
Treiber kann die beobachtete Client-Wartezeit um fast eine Sekunde verlängern;
für das enge Fallback-Kriterium gilt deshalb die Job-Zeit. Nicht beobachtbare
Komponenten bleiben fehlend, insbesondere Inferenzzeit bei Ausfällen oder Fakes.

## Varianten und Umfang

Alle Varianten verwenden dieselbe festgeschriebene Live-Last aus 1A / #6:
Beitritt, Abstimmung, Q&A-Submit und Blitzlicht mit Kennzahlen je Aktion.
Lastprofil, Messfenster und Seed gehören ins Manifest. Live-Last bekommt eine
eigene Session, damit sie den Summary-Snapshot nicht verändert.

| Variante       | Technik                                                      | Vorgesehener Umfang                                           |
| -------------- | ------------------------------------------------------------ | ------------------------------------------------------------- |
| B0             | Runtime aus, vorhandenes `-LabRuntimeAus`                    | Eigene Referenz unter Live-Last; zugleich vorhandener F1-Pfad |
| B1 / B2        | Echte Runtime, Label / Summary                               | Label 30, Summary 10 Aufträge; kalt/warm trennen              |
| L1 / L2        | +50 / +500 ms auf Antworten des Runtime-Ports, SSH ausnehmen | Je 20 Label-Aufträge, Wirkung am Draht prüfen                 |
| L3             | Fake antwortet später als der wirksame Timeout               | Je 10 Label- und Summary-Aufträge                             |
| F1             | Runtime nach frischem Start stoppen                          | Je 10 Label- und Summary-Aufträge                             |
| F2             | DROP von App-Host zu Runtime-Port vor der Freigabe           | Je 5 Label- und Summary-Aufträge                              |
| Slot belegt    | Deterministischer Fake mit belegtem Slot                     | Je 10, `busy` und ausbleibenden Completion-POST prüfen        |
| Optional: Race | Slot-Sonde frei, Completion-POST belegt                      | Separate deterministische Folge                               |

Maximal zehn Aufträge je Runtime-Start; größere Reihen in Teil-Läufe zerlegen.
Normale Reihen behalten den Summary-Cooldown bei. Für den Breaker braucht es
eine gesonderte Folge unterschiedlicher Sessions: die bisherigen 31 s Abstand
überschreiten das 30-s-Öffnungsfenster. Keine zusätzlichen Statusproben während
der Messung, da diese selbst Inferenz auslösen können.

## Umsetzungsschritte

Die Umsetzung erfolgt durch den Agenten selbst mit den Skills `writing-plans`,
`executing-plans` und `test-driven-development`. Diese Datei ist Plan und
Fortschrittsnachweis. Die Zustimmung im Chat umfasst die anschließende Umsetzung.
Arbeit im vorhandenen Haupt-Clone auf `feature-1B-private-inference-3-4`:
Die Windows-Steuerung unterstützt keine Git-Worktrees. Ausgangscommit:
`86f9fa906787fdc1830b694c06c6cb90f29b8cd2`.

1. [x] **Fake mit eigenem Vertragstest:** `evidenz/1B/fake-runtime.mjs` und
       `fake-runtime.test.mjs`. Nur Loopback oder die feste Labor-IP binden;
       Bearer-Prüfung auf beiden API-Pfaden; steuerbare Verzögerung, Status, Body,
       Slotbelegung und Race. CLI liest Token aus der VM-Datei, nie als Argument oder
       im Log. Abbruch und Beenden müssen offene Antworten aufräumen. Tests zuerst
       ausführen und den erwarteten Fehler vor der Implementierung beobachten.
2. [x] **Störungs-Lebenszyklus:** Helfer unter `evidenz/1B/`, Einbindung in
       `lauf.sh` nach `runtime_frisch`, Parameterübergabe in `labor.ps1` und
       `labor.sh`. Ungültige Kombinationen vor Nebenwirkungen ablehnen. Störung,
       Rücknahme und Prüfresultat protokollieren; bei Abbruch ebenfalls aufräumen.
       Keine automatische Aktivierung ohne Niklas' gesonderte Zustimmung.
3. [x] **Messung ergänzen:** vorhandene Lasthelfer aus
       `scripts/load/resource-isolation-live.mjs` und Ressourcen-Collector aus #6
       prüfen und wiederverwenden. App-CPU und RSS sowie Live-p95/Fehler erfassen;
       Label-Pfad und gezielte Breaker-Folge ergänzen. Tests für leere/unvollständige
       Messfenster, Fehler und Zeitüberschreitungen. Ergebnisse mit Lastprofil und
       Störvariante ins Ergebnis-JSON aufnehmen, ohne Secrets.
4. [x] **Auswertung und Doku:** Normalpfad, Fallback und fehlende Timings getrennt
       behandeln; Hypothesen nur bei vollständigen Daten bewerten. Runbook,
       Windows-Parameter, Dateiübersicht und relevante Testdokumentation ergänzen.
5. [x] **Lokale Validierung:** Node-Labortests aus Runbook §9, betroffene
       Lasthelfer-Tests und Pester-Tests ausführen; Shell-Syntax, Prettier und
       `git diff --check` prüfen. Keine Laborläufe als Tests tarnen. Fehlende
       Werkzeuge oder erforderliche Ausführung durch Niklas führen zum Stopp mit
       konkretem nächsten Befehl.
6. [ ] **Labor erst nach gesonderter Rückfrage:** Zustand und Schutz prüfen;
       falls nötig Aufbau, dann Prompt-Body, Kalibrierung, Probe, eigene Baselines
       und Störreihen. I > 270 s bedeutet Abbruch und Entscheidung mit Jonas.
       Lange Läufe startet Niklas selbst. Danach Logs und Ergebnisse auswerten.
7. [ ] **Schritt 4 nach den Messungen:** zweiter Host, Deployment, Updates,
       Monitoring, Token-Rotation und TLS bewerten. S1 separat im Labor messen,
       bevor ein quantitativer Vergleich behauptet wird. Entscheidung als eigenes
       ADR 1B-020 bis 1B-039, Eigenanteil und Ergebnisdokument synchronisieren.

## Prüf- und Stopppunkte

- Vor jedem Lauf, auch Entwicklung und Kalibrierung, ausdrücklich fragen.
- Vor `up`, `destroy`, `tc`, `ufw` und Runtime-Stopp als Störung ausdrücklich
  fragen. Der Plan ist keine pauschale Ausführungsgenehmigung.
- Vor einem von Niklas auszuführenden Schritt stoppen und Befehl, Zweck und
  erwartetes Ergebnis nennen.
- Gewertete Läufe nur committet auf dem eigenen Branch, ohne `--arbeitsstand`;
  Entwicklung mit `dev-…`. `kontrolle`/`belege` nie mit `--arbeitsstand`.
- Nach jeder Störung Rücknahme und `pruefen`; Rücknahme ist Teil der vorher
  genehmigten Störung und muss auch bei Abbruch erfolgen.
- Vollständigkeit besonders prüfen: verzögerte Antwort nach Client-Abbruch,
  abgebrochener Lauf mit Restprozessen, fehlende Ressourcenprobe, durch
  Circuit-Breaker unterdrückter Netzversuch, parallele Live-Last über das
  gesamte Messfenster.
- Protokolle nach `evidenz/1B/<Datum>-lauf-<Tag>.md`, Ergebnisse nach
  `messung/`. Immer Rechner, Hypervisor, VMs und Commit nennen. Tokens,
  `.env`-Inhalte und PCAPs bleiben außerhalb des Repos; eingefrorene Belege
  werden nicht umgeschrieben.

## Arbeitsstand

- 2026-11-15: Planung dokumentiert. Noch keine Laboraktion oder Messung.
- Lokal ist Node 24.18.0 vorhanden. `pwsh` ist nicht im Suchpfad, aber
  `pwsh.exe` ist verfügbar und meldet Pester 5.7.1. Die Windows-Interop braucht
  in dieser Codex-Sandbox eine Freigabe; die lesende Modulabfrage wurde damit
  ausgeführt. Pester-Tests wurden bisher nicht ausgeführt.
- Erster Baustein: [Fake-Server](evidenz/1B/fake-runtime.mjs) und
  [HTTP-Vertragstests](evidenz/1B/fake-runtime.test.mjs) angelegt. Acht lokale
  Tests bestanden, einschließlich Bearer, Verzögerung, Status/Body, Slotbelegung,
  Race, Client-Abbruch, Shutdown und CLI-Bind-Grenzen. Noch keine Einbindung in
  `lauf.sh` oder die Windows-Parameter und noch kein Nachweis gegen die echte App.
  Der Standard-Completion-Body enthält absichtlich nur `{}` als Modellinhalt;
  für Antworten vor dem Timeout ist ein expliziter Vertragsbody nötig.
- CLI des Fakes: `--host`, `--port`, `--mode delay|busy|race`, `--delay-ms`,
  `--status`, optional `--body-file`, `--token-file` (Standard `.env.llm`). Der
  Helfer liest daraus ausschließlich `OPEN_WEIGHT_LLM_TOKEN`. Der Name
  `--env-file` wird vermieden: Node 24.18.0 wertete ihn im lokalen CLI-Test selbst
  aus, bevor die Prüfung der Bind-Adresse im Skript lief. Keine erfundenen
  `timings` und keine Aufzeichnung von Headern oder Request-Bodies im Fake.

### Stopp vor weiteren Umsetzungsschritten, 2026-11-15

Die lokale Labortestsuite wurde ausgeführt:

```bash
node --test docs/referat-thema-1/evidenz/1B/*.test.mjs docs/referat-thema-1/evidenz/1B/messung/*.test.mjs
```

Ergebnis: **81 von 83 Tests bestanden**. Zwei bestehende Tests scheitern wegen
fehlendem `jq` in WSL:

- `vm-info.sh liefert Kernel, Betriebssystem, CPUs und RAM als JSON`
- `umgebung.sh beschreibt Rechner und Hypervisor nach Schema 1b-umgebung-1`

Nächster Schritt durch Niklas, im WSL-Terminal:

```bash
sudo apt-get update
sudo apt-get install jq
```

Danach kann der Agent die lokalen Tests erneut ausführen und die ausstehenden
Bausteine umsetzen. Eine Installation wurde nicht durch den Agenten versucht.

Zusätzlich wurde ausschließlich lesend über den erlaubten Wrapper
`bash docs/referat-thema-1/evidenz/1B/labor-wsl.sh status` angefragt. Ergebnis:
Abbruch wegen fehlender Hyper-V-Rechte. Das Log nennt
`C:\Users\Skull\labor-1b\log-status-20261115T175628.txt`.
Es ist damit weder festgestellt, ob die VMs existieren, noch ob sie laufen.
Keine VM wurde gestartet, keine Störung gesetzt und keine Messung ausgeführt.
Die Rechteklärung erfolgt separat vor Laborarbeit; `up` wird dafür nicht
automatisch ausgeführt. Besteht die Gruppenmitgliedschaft bereits, ist laut
Windows-Anleitung möglicherweise eine erneute Windows-Anmeldung nötig.

Die übrigen Umsetzungsschritte und Schritt 4 sind weiterhin offen. Es gibt
noch keinen gewerteten Befund zu Isolation, Fallback-Zeiten oder Betriebsaufwand.

### Wiederholung nach Installation von jq, 2026-11-15

Niklas hat `jq` in WSL installiert; verfügbar ist Version 1.7. Die oben genannte
Node-Labortestsuite wurde erneut ausgeführt: **83 von 83 Tests bestanden**,
keine übersprungen. Damit sind die beiden durch das fehlende Werkzeug
verursachten Testfehler behoben. Auch die Prettier-Prüfung der Planungsdatei,
des Fakes und seiner Tests besteht. Keine Labor-VM wurde dabei angesprochen.
Die fehlenden Hyper-V-Rechte und die ausstehenden Umsetzungsschritte bleiben
offen; die erfolgreiche lokale Prüfung ersetzt keinen Laborlauf.

### Rechte- und Editionsprüfung, 2026-11-15

Auf Niklas' Auftrag wurden ausschließlich lesend die Windows-Gruppenrechte
und die Verwaltungswerkzeuge geprüft:

| Prüfung                                              | Ergebnis                  |
| ---------------------------------------------------- | ------------------------- |
| Aktueller Windows-Token erhöht                       | Nein                      |
| Hyper-V-Gruppe im aktuellen Token                    | Nein                      |
| Aktueller Benutzer direkt in Hyper-V-Administratoren | Nein                      |
| Windows-Edition laut `Win32_OperatingSystem.Caption` | Microsoft Windows 11 Home |
| Hyper-V-Modul in Windows PowerShell 5.1              | Nicht vorhanden           |
| Hyper-V-Verwaltungsdienst `vmms`                     | Nicht vorhanden           |
| `Win32_ComputerSystem.HypervisorPresent`             | Ja                        |

`HypervisorPresent` allein belegt keine verfügbare Hyper-V-VM-Verwaltung.
Die dokumentierte Voraussetzung aus WINDOWS.md §1 (Pro, Education oder
Enterprise) ist auf diesem Rechner nicht erfüllt. Eine Gruppenänderung oder
erneute Anmeldung allein löst den Aufbau damit nicht. Vor `up` muss die
Laborplattform geklärt werden. Keine Rechte wurden geändert, kein Windows-Feature
aktiviert und keine VM angelegt. Die Vorgabe, aus WSL ausschließlich über
`labor-wsl.sh` zu steuern, bleibt bestehen.

### Nach Upgrade auf Pro, 2026-11-15

Niklas meldet das Upgrade, die Aktivierung von Hyper-V und den Neustart.
Die anschließende lesende Prüfung bestätigt Windows 11 Pro, das vorhandene
Hyper-V-Modul und den laufenden Dienst `vmms`. Die Hyper-V-Gruppe ist weiterhin
nicht im aktuellen Windows-Token; das erste administrative `up` übernimmt laut
Skript die Gruppenaufnahme, danach ist eine erneute Anmeldung erforderlich.

Die Empfehlung aus `labor-wsl.sh groessen -Ja` lautet auf diesem Rechner
(8 Kerne, 16 Threads, 31 GB RAM; Checkout `86f9fa906787fdc1830b694c06c6cb90f29b8cd2`):
llm-host 8 vCPU / 12 GB RAM, app-host 2 vCPU / 6 GB RAM. Beim Prüfen waren nur
15 GB verfügbar; für diese Empfehlung einschließlich 4 GB Reserve sind 22 GB
erforderlich. Der Aufbau würde deshalb vor dem Anlegen abbrechen. Niklas muss
zuerst Speicher freigeben; anschließend wird die Vorschau erneut geprüft.
`up` wurde noch nicht gestartet und keine VM angelegt. Die Ausgabe ist eine
Zustandsprüfung, kein gewerteter Messlauf.

### Aufbau und Plattenkorrektur, 2026-11-15

Der Aufbau durch Niklas und die anschließende Plattenerweiterung sind im
[eigenen Aufbauprotokoll](evidenz/1B/2026-11-15-aufbau-windows.md) dokumentiert.
Die VMs existieren und laufen. Der einzige Fehler der ursprünglichen
Abschlussprüfung betraf freien Plattenplatz im LLM-Host; die Erweiterung ist
ausgeführt und die Platzschwelle jetzt erfüllt. Die vollständige Abschlussprüfung
bleibt bis zur erneuten Windows-Anmeldung wegen der noch nicht aktiven
Hyper-V-Gruppenrechte offen. Keine Kalibrierung und kein Messlauf gestartet.

### Wiederanlauf erfolgreich, 2026-11-15

Nach Niklas' Windows-Neustart funktionieren die Hyper-V-Gruppenrechte.
Die vorhandenen VMs wurden über `labor-wsl.sh start` gestartet. Der Wrapper
endet mit Exit 0; die Abschlussprüfung meldet keine Fehler. Der verbleibende
Hinweis zur nicht erneut ausgeführten administrativen NAT-Prüfung und die
lokalen Belege stehen im
[Aufbauprotokoll](evidenz/1B/2026-11-15-aufbau-windows.md#nachtrag-wiederanlauf-nach-windows-neustart-2026-11-15).
Vor dem nächsten Entwicklungslauf (Prompt-Body) ist erneut Niklas zu fragen.

### Entwicklungslauf für den Prompt-Body, 2026-11-15

Niklas hat den freigegebenen einzelnen `dev-body`-Lauf ausgeführt. Ergebnis und
Prüfgrenzen stehen im
[Laufprotokoll](evidenz/1B/2026-11-15-lauf-dev-body.md).
Prompt-Body und Auswertung liegen vor. Die App verwendet bei `invalid_response`
den extraktiven Fallback; daraus folgt noch kein Ursachenbefund oder gewerteter
Hypothesennachweis. Vor der anschließenden Kalibrierung ist erneut zu fragen.

### Technische Laborvorbereitung abgeschlossen, 2026-11-15

Niklas hat die freigegebene Kalibrierung ausgeführt. Ergebnis und Quelle stehen
im [Nachtrag des Laufprotokolls](evidenz/1B/2026-11-15-lauf-dev-body.md#nachtrag-kalibrierung-abgeschlossen-2026-11-15).
Die Kalibrierung ist ohne Abbruch abgeschlossen; das eigene Labor ist technisch
bereit. Als Nächstes folgen die offenen Implementierungsschritte für Issue #9:
Fake und Störvarianten integrieren, konstante Live-Last und App-CPU/RSS-Messung
ergänzen, Status und Breaker-Verlauf erfassen sowie Auswertung und Tests
vervollständigen. Diese Arbeiten benötigen keinen weiteren Aufbau der VMs.
Probe, lokale Vergleichsreihe und Störreihen werden erst mit den fertigen
Messhelfern und jeweils nach Rückfrage durchgeführt.

## Nachtrag 2026-11-15: Umsetzung des Versuchsaufbaus für Schritt 3

Die Störungshelfer, Parameterübergabe, Live-/Ressourcenmessung, getrennten
Summary-/Label-Treiber und lokale Vergleichsauswertung sind implementiert.
Noch kein neuer VM-Lauf und keine Störung wurden damit ausgeführt; die
VM-Verifikation und die gewerteten Reihen bleiben offen. Schritt 4 folgt den
Messungen. Der technische Laboraufbau und die Kalibrierung sind abgeschlossen,
sie werden nicht als neue Ergebnisse für Schritte 1–2 ausgegeben.

Designentscheidung vor dem nächsten Lauf: Das Live-Fenster dauert 330 statt
300 Sekunden, damit ein Summary-Timeout von 300 Sekunden mit Fallback noch im
Fenster liegt. Die 500 Ankünfte, 90-s-Rampe und Freigabe bei 270 Sekunden aus
1A bleiben. Das misst eine Ankunftswelle, keine durchgehend konstante
500-Personen-Konkurrenz. Alle eigenen Vergleichsläufe verwenden dieses Profil;
direkte Gleichsetzung mit den 300-s-Fenstern aus 1A wäre unzulässig.

Designentscheidung: Die Breaker-Folge verwendet vorab angelegte, unterschiedliche
Summary-Sessions ohne 31-s-Cooldown und ohne Live-Fenster. Das trennt die
indirekte Breaker-Beobachtung von der Isolationsmessung. Es gibt keinen
öffentlich auslesbaren internen Breaker-Zustand; fehlender Netzwerkverkehr ist
allein kein Beweis. Die vorhandenen Backendtests decken Caller-Abbruch und
Slotfreigabe ab; Queue-Timeout und Breaker bleiben im Labor gezielt zu beobachten.

Messgrenze: Labels liefern im bestehenden API-Vertrag weder internen
Fallback-Grund noch Job-Zeit. Der Treiber erfasst Settlement, Modellannahme,
Client-Wartezeit und Transport; fehlende interne Werte bleiben unbekannt. Ein
bestandener Summary-Zeitcheck darf nicht auf Labels übertragen werden.
L1/L2-Störwirkung muss anhand Mitschnitt und Journal bestätigt werden; ihre
Konfiguration allein gilt nicht als gemessene Verzögerung.

Der Label-Treiber benötigt den bestehenden Encoder. `label-setup.sh` baut dessen
Image einmalig, setzt das CPU-Limit auf die tatsächlichen app-host-vCPUs und
aktiviert SEMANTIC erst nach erfolgreichem Encoder-Start. Der Encoder bleibt
für nachfolgende vergleichbare Läufe aktiv; Image-ID wird dokumentiert. Jede
Label-Anfrage nutzt eine frische Session gegen den sessionspezifischen Cache.
Die automatische Rücknahme betrifft die Störung; Encoder-Konfiguration bleibt
bewusst gleich. Falls Speicher nicht reicht, Lauf abbrechen und Größenentscheidung
vor einer Änderung dokumentieren.

Nächster gesondert freizugebender Lauf: ein normaler Entwicklungslauf mit einem
Summary-Auftrag und Live-Fenster, um Laststeuerung, RSS/CPU und Ergebnisformat
auf den bestehenden VMs zu prüfen. Noch keine Störung. Erst danach je Störvariante
separat um Zustimmung bitten. Gewertete Läufe erst nach Commit und ohne
`--arbeitsstand`.

### Lokale Verifikation und Review, 2026-11-15

Schritte 1–5 der Umsetzungsliste sind lokal abgeschlossen. Die Review-Korrektur
hält den Aufräumkontext auch nach Fehler-Rückkehr aus `lauf()` für den EXIT-Trap
verfügbar; ein Regressionstest wurde zunächst rot, danach grün ausgeführt.
Auch ein vorhandenes Störungs-Lease blockiert neue Läufe vor dem Runtime-Neustart.
Der Vergleich verlangt zusätzlich identische freigegebene Konfigurationswerte,
insbesondere Label-Timeout und SEMANTIC-Flag; nur numerische/boolesche Werte
aus einer festen Positivliste werden erfasst, keine Secrets.

Ausgeführte Prüfungen:

```bash
node --test docs/referat-thema-1/evidenz/1B/*.test.mjs docs/referat-thema-1/evidenz/1B/messung/*.test.mjs scripts/load/resource-isolation-live.test.mjs scripts/load/lib/artillery-live-messungen.test.mjs scripts/load/lib/container-metrics.test.mjs
npm run test -w @arsnova/backend -- src/lib/openWeightLlmClient.test.ts src/lib/qaSummaryQueue.test.ts
bash -n docs/referat-thema-1/evidenz/1B/lauf.sh docs/referat-thema-1/evidenz/1B/experiment-lauf.sh docs/referat-thema-1/evidenz/1B/label-setup.sh docs/referat-thema-1/evidenz/1B/labor.sh
```

Pester 5 unter Windows: `Invoke-Pester -Path docs/referat-thema-1/evidenz/1B
-PassThru -Output Detailed` mit explizitem Fehler-Exitcode. Ergebnis: 106/106;
ausgewählte Backendtests: 76/76. Node-Endstand: 138/138 nach den Review-Korrekturen.
Prettier und `git diff --check` für die betroffenen Dateien sind ebenfalls
Teil des Abschlusschecks. Die PowerShell-Dateien sind weiterhin ASCII.
Kein Produktionscode wurde geändert; vollständiger Produkt-Build und komplette
Frontend-Suite sind für diese Laborhelfer nicht ausgeführt. Die Änderungen
sind noch nicht committet. Gewertete Reihen und Schritt 4 bleiben offen.

## Nachtrag 2026-11-15: Entwicklungslauf mit Live-Last und RSS-Korrektur

Der erste `dev-live-normal`-Lauf wurde von Niklas ausgeführt. Beobachtungen,
Umgebung und Arbeitsstand stehen im
[Laufprotokoll](evidenz/1B/2026-11-15-lauf-dev-live-normal.md).
Das Live-Fenster ist vollständig; die Gesamtmessung bleibt wegen fehlender
RSS-Werte unvollständig. Die Ursache wurde mit zwei lesenden Docker-Aufrufen
über den vorgeschriebenen WSL-Wrapper belegt: `docker top` benötigt die PID-Spalte.
Sampler und Parser sind entsprechend korrigiert; Erfassungsfehler erscheinen
künftig als `rssError` statt nur als stiller Nullwert. Regressionstests wurden
zunächst rot, nach der Korrektur grün ausgeführt.

Nächster Stand: Werkzeuge als separaten Vorbereitungscommit sichern, anschließend
zunächst den korrigierten Sampler in einem gesondert freigegebenen Entwicklungslauf
über das gesamte Live-Fenster prüfen. Erst danach gewertete Baselines und
Störreihen auf einem committeten Stand. Dieser Vorbereitungscommit erklärt
Schritt 3 ausdrücklich nicht für abgeschlossen.

Lokaler Abschlusscheck der RSS-Korrektur: dieselbe kombinierte Node-Suite wie
oben, jetzt 141/141 bestanden. Prettier für die betroffenen Skripte und Dokumente
sowie `git diff --check` bestanden. Ein bestehender Fake-Abbruchtest fiel zunächst
wegen einer festen 30-ms-Wartezeit aus; er wartet jetzt mit begrenzter Frist auf
den tatsächlich beobachteten Serverzustand, bevor und nachdem der Client abbricht.
Der Server-Timer liegt dabei weit außerhalb der Testfrist, sodass normales
Antwortende die erfolgreiche Bereinigung nicht vortäuschen kann. Auch der
Shutdown-Test hat jetzt eine begrenzte Wartefrist. Keine neue Messreihe gestartet;
die VM-Zugriffe dieser Korrektur waren ausschließlich lesende Prozesslisten.

## Nachtrag 2026-11-15: Normalreihe vollständig, TCP-Flag-Auswertung korrigiert

Die gewertete Summary-Normalreihe auf `5e758d0a` ist vollständig; Beobachtungen,
Qualitätsgrenze und Quellen stehen im
[Normalreihenprotokoll](evidenz/1B/2026-11-15-lauf-normal-summary.md).
Das vorangegangene `dev-live-rss`-Ergebnis bestätigt die korrigierte RSS-Erfassung
über das ganze Fenster. Die Normalreihe liefert die erste Referenz bei laufender
echter Inferenz; B0/F1 und die Störreihen bleiben offen.

Bei der Rohdatenprüfung fiel das `True`/`False`-Format der TCP-Flags auf.
Die Auswertung akzeptiert jetzt zusätzlich dieses Format; Regressionstest
zunächst rot, danach grün. Historische Rohdaten werden nicht überschrieben.
Die normale Live-/Ressourcenmessung muss deshalb nicht wiederholt werden.
Vor F1/F2 ist stets die korrigierte Transportauswertung lokal auf die Rohdaten
anzuwenden; ihr Commit ist getrennt vom Ausführungscommit zu dokumentieren.

Designentscheidung für die weiteren Vergleichsreihen: Ausführungsstand auf
`5e758d0a870bc38441b60c541a6ff6f3d0662ee2` fixieren, damit identischer Treiber,
Sampler und Störungshelfer mit der vorliegenden Normalreihe verglichen werden.
Die TCP-Flag-Korrektur betrifft nur nachträgliche Analyse. Ein gesonderter
Commit für Korrektur und Protokolle ersetzt den Ausführungsstand nicht;
kommende Läufe bekommen diesen ausdrücklich als `-Commit`.
Zunächst F1 mit einem Auftrag als Entwicklung, nur nach gesonderter Zustimmung
zum Lauf und zum Stoppen der Runtime als Störung. Gewertete F1-Reihe erst nach
erfolgreicher Rücknahme-/Prüfkontrolle und plausibler Transportauswertung.

Verifikation der TCP-Flag-Korrektur: kombinierte Node-Labor-/Lasthelfer-Suite
142/142 bestanden; Prettier für betroffene Skripte und Dokumente sowie
`git diff --check` bestanden. Der Regressionstest erfasst beide Flag-Formate
und verhindert die Einstufung eines beobachteten RST als DROP.
Eine lokale Neuberechnung bestätigt die Verbindungserkennung in allen Aufträgen
der Normalreihe. Es wurde kein weiterer Laborlauf und keine Störung gestartet.

## Nachtrag 2026-11-15: F1-Entwicklungslauf geprüft

Der von Niklas ausgeführte F1-Entwicklungslauf ist im
[Protokoll](evidenz/1B/2026-11-15-lauf-dev-f1-summary.md) dokumentiert:
RST und schneller extraktiver Fallback beobachtet, Messfenster vollständig,
Containerstopp und Rücknahme im Journal, Wiederherstellung und Nachprüfungen
bestanden. Die korrigierte TCP-Flag-Auswertung wurde ausschließlich lokal auf
die vorhandenen Rohdaten angewendet; Originaldaten unverändert.

Ein vorläufiger Vergleich des Entwicklungsfensters mit der Normalreihe zeigt
bei Quizstimmen eine Überschreitung der 10-%-p95-Schwelle. Das wird ausdrücklich
nicht als bestanden ausgegeben; Schwelle bleibt unverändert. Der einzelne
Entwicklungslauf ist keine gewertete F1-Reihe und kein belastbarer Nachweis einer
Ursache. Nächster gesondert freizugebender Lauf: F1 Summary mit zehn Aufträgen
und Live-Fenstern auf dem fixierten Ausführungsstand `5e758d0a`, mit protokolliertem
Containerstopp, automatischer Rücknahme und anschließenden Prüfungen.

## Nachtrag 2026-11-16: Gewertete F1-Reihe vom Vortag ausgewertet

Die F1-Summary-Reihe und damit die B0/F1-Referenz für folgende Störvarianten
liegt vollständig vor. Messwerte, Quellen, Journal-Zuordnung und Urteile stehen
im [F1-Protokoll](evidenz/1B/2026-11-15-lauf-f1-summary.md).
H-F1 und Fallback-Frist erfüllt; Live-Fehlerfreiheit beobachtet. Beim getrennten
Vergleich zur Normalreihe überschreitet Quizstimmen-p95 die 10-%-Schwelle.
Das wird als Abweichung dokumentiert, ohne kausale Zuschreibung und ohne
nachträgliche Änderung der Schwelle. H2-Vergleiche der folgenden Varianten
verwenden zusätzlich die vorab vorgesehene B0/F1-Referenz.

Nächster Versuch: F2 Summary als Entwicklung mit einem Auftrag und Live-Fenster,
Ausführungsstand unverändert `5e758d0a`. Vorher ausdrückliche Freigabe für Lauf
und ufw-DROP in der llm-host-VM erfragen. Die Regel betrifft ausschließlich
app-host → llm-host:8080; SSH bleibt erreichbar. Rücknahme und Prüfungen sind
Teil dieses Versuchs. Kein neuer Versuch wurde bei dieser Auswertung gestartet.

Datumswechsel auf 2026-11-16: Vor der nächsten gewerteten Reihe wird eine neue
Tageskalibrierung benötigt. Die F2-Entwicklungsprobe darf mit dem ausdrücklich
angegebenen bisherigen Budget stattfinden; sie ersetzt keine Tageskalibrierung
und wird nicht gewertet. Eine Kalibrierung ist ein eigener, vorher freizugebender Lauf.

## Nachtrag 2026-11-16: F2-Entwicklungsstörung unwirksam, Korrektur nötig

Der [F2-Entwicklungslauf](evidenz/1B/2026-11-16-lauf-dev-f2-summary.md) ist kein
DROP-Nachweis: HTTP 200 und echte Inferenz beobachtet. Die Ursache wurde lesend
und durch ufw-Trockenläufe belegt. Der Helfer akzeptierte einen erfolgreichen
Exitcode, obwohl ufw die eingefügte Regel wegen einer bestehenden gleich
adressierten Regel übersprang. Keine nachträgliche Umdeutung als bestandener
F2-Versuch oder als F2/F1-Zeitverhältnis.

Lokale Korrektur: Schnittstelle im Regelvertrag ergänzen, vorrangigen DROP im
Kernel vor Treiberstart bestätigen, ufw-Ausgabe und Verifikation protokollieren,
Rücknahme auch nach übersprungener Regel wiederholbar halten. Regressionstests
für No-op, fehlende Kernelwirkung, erfolgreiche Rücknahme und alte Leases.
Keine neue Störung aktiviert; zusätzliche VM-Befehle waren lesend oder `--dry-run`.

Die bisherige Entscheidung, alle Versuche auf `5e758d0a` festzuhalten, wird für
F2 durch diesen datierten Nachtrag ergänzt: Vor einer Wiederholung ist ein neuer
committeter F2-Injektionsstand nötig. Produktionscode, Treiber, Sampler und
Laufskript bleiben unverändert; bisherige Normal-/F1-Daten werden nicht verworfen.
Vor einem gewerteten Vergleich ist die konkrete Versionsabweichung offenzulegen
und die Kompatibilität zu prüfen. Der automatische Commit-Abgleich bleibt aktiv;
ein abweichender Commit darf nicht stillschweigend als identisch behandelt werden.
Als nächster Schritt muss Niklas die Korrektur und vorhandenen Protokolle sichern.
Danach erneut Freigabe für eine F2-Entwicklungsprobe und ufw-Störung erfragen.

Lokaler Abschlusscheck der F2-Korrektur: kombinierte Node-Labor-/Lasthelfer-Suite
148/148 bestanden; Prettier für betroffene Skripte und Dokumente sowie
`git diff --check` bestanden. Der Vergleich gegen `5e758d0a` zeigt unveränderte
Dateien `lauf.sh`, `treiber.mjs`, `messfenster.mjs`, `auftraege.mjs` sowie die
Produktions-Compose-Dateien. Änderungen betreffen F2-Injektion/-Prüfung,
Transportauswertung, zugehörige Tests und Dokumentation. Die tatsächliche
DROP-Wirkung des korrigierten Helfers auf der VM ist noch offen.

## Nachtrag 2026-11-16: korrigierter F2-Helfer auf der VM bestätigt

Die freigegebene [zweite Entwicklungsprobe](evidenz/1B/2026-11-16-lauf-dev-f2-summary-v2.md)
bestätigt Aktivierung, tatsächliche DROP-Wirkung, Rücknahme und Nachprüfungen
auf dem committeten Korrekturstand `2b39b9df`. Die Einzelprobe bleibt Entwicklung;
die geplante gewertete F2-Reihe ist weiterhin offen. Nächster separater Lauf ist
die Tageskalibrierung nach erneuter Freigabe. Vor gewerteten Vergleichen bleibt
die Kompatibilitätsprüfung gegenüber den bisherigen Normal-/F1-Daten erforderlich.

## Nachtrag 2026-11-16: Tageskalibrierung und Vorbereitung der F2-Reihe

Die [Tageskalibrierung](evidenz/1B/2026-11-16-kalibrierung.md) ist abgeschlossen.
Für den unmittelbar folgenden Lauf wird der kalibrierte Timeout explizit
übergeben, da UTC-Dateiname und lokales Windows-Datum an der Mitternachtsgrenze
auseinanderfallen. Energieeinstellungen und VM-Größen unverändert lassen.

Versionsprüfung `5e758d0a` → `2b39b9df`: Produktionscode, Compose-Konfiguration,
`lauf.sh`, `treiber.mjs`, `auftraege.mjs`, `messfenster.mjs` und
`vergleichen.mjs` unverändert. Funktionale Änderungen betreffen die F2-Regel,
ihre Aktivierungs-/Rücknahmeprüfung und die Erkennung von TCP-Flags als
`True`/`False` zusätzlich zu `1`. F1-Stopp und Messablauf sind unverändert.
Eine lokale Neuauswertung der vorhandenen Normal-/F1-Rohdaten mit dem aktuellen
`buildExperimentResult` bestätigt identische Live-Daten und Job-Zeiten; die
Transportfelder korrigieren erwartungsgemäß die bislang im ursprünglichen
Ergebnis-JSON nicht erkannten SYN-/RST-Flags. Für alle F1-Jobs sind jetzt
Netzversuch und RST erkannt. Originaldateien bleiben unverändert.

Damit sind Messablauf und Messgrößen für eine ausdrücklich dokumentierte
versionsübergreifende Auswertung geeignet. Ausführungscommit und
Auswertungsstand müssen dabei getrennt angegeben werden. Der automatische
Vergleich bleibt wegen unterschiedlicher Commits gesperrt; kein stilles
Umschreiben des Manifests und kein automatischer PASS aus dieser Prüfung.
Zusätzlich müssen die konkreten Manifeste der neuen Reihe geprüft werden.

Nächster vorgeschlagener, noch separat freizugebender Versuch:
`f2-summary`, fünf Summary-Aufträge mit Live-Fenstern auf `2b39b9df`,
ohne `--arbeitsstand`. Hypothesen und Schwellen bleiben wie oben:
Fallback innerhalb des kalibrierten Budgets, tatsächlicher DROP je Auftrag,
F2/F1-Medianverhältnis > 10 bei beobachteten Netzversuchen; Live-p95 höchstens
110 % von B0/F1 und keine zusätzlichen Fehler. CPU/RSS vollständig erfassen.
Rücknahme und beide VM-Prüfungen müssen bestehen. Diese Ankündigung ist keine
Freigabe des Laufs oder der ufw-Störung.

## Nachtrag 2026-11-16: gewertete F2-Summary-Reihe ausgewertet

Die [F2-Summary-Reihe](evidenz/1B/2026-11-16-lauf-f2-summary.md) wurde nach
Freigabe auf `2b39b9df` ausgeführt. Der geplante Summary-Umfang ist vollständig;
H2-Fallback, H2-Fehler und H-F1F2 sind nach offengelegter Versionsprüfung
erfüllt, H2-Latenz wegen der Beitritte nicht vollständig erfüllt. Rücknahme und
Nachprüfungen bestanden. Zahlen und Grenzen ausschließlich im Laufprotokoll.

Als nächster Versuch wird eine einzelne L3-Summary-Entwicklungsprobe mit
Live-Fenster vorgeschlagen: `dev-l3-summary`, `-LabN 1`,
`-LabStoerung l3`, kalibrierter Timeout 300 000 ms, Ausführungsstand `2b39b9df`.
Sie prüft erstmals den verzögerten Fake auf den VMs, tatsächlichen
Completion-POST, Fallback und Wiederherstellung. Kein gewerteter L3-Nachweis
aus der Probe; danach erst die geplante Reihe vorbereiten. Der Helfer stoppt
die echte Runtime temporär und ersetzt sie durch den Fake; diese Störung und
der Lauf benötigen vor Ausführung eine erneute Freigabe.

## Nachtrag 2026-11-16: L3-Summary-Probe bestanden

Die freigegebene [L3-Entwicklungsprobe](evidenz/1B/2026-11-16-lauf-dev-l3-summary.md)
auf `2b39b9df` bestätigt den Completion-POST an den verzögerten Fake,
Timeout-Fallback innerhalb der vorgesehenen Toleranz, vollständige Messung und
erfolgreiche Wiederherstellung. Zahlen und Grenzen stehen im Protokoll.

Nächster vorgeschlagener Lauf: gewertete L3-Summary-Reihe, zehn Aufträge,
`-LabTag l3-summary`, `-LabStoerung l3`, `-LabLive`, Timeout 300 000 ms,
Fake-Verzögerung 310 000 ms, Ausführungscommit `2b39b9df`, kein `--arbeitsstand`.
H2-Fallback: jeder Job mit passendem Timeout-Grund innerhalb Budget + 1 s;
H2-Fehler: keine zusätzlichen Live-Fehler; H2-Latenz: p95 je Aktion höchstens
110 % der B0/F1-Referenz. Tatsächlichen Completion-POST je Auftrag prüfen,
CPU/RSS vollständig erfassen und Wiederherstellung bestätigen. Vergleich zur
älteren B0/F1-Reihe nur mit offengelegtem Versionsvergleich und erneuter
Manifestprüfung. Entwicklungsprobe nicht in die gewertete Reihe einrechnen.
Lauf und temporärer Runtime-Ersatz durch den Fake sind noch nicht freigegeben.

## Nachtrag 2026-11-16: gewertete L3-Summary-Reihe ausgewertet

Die [L3-Summary-Reihe](evidenz/1B/2026-11-16-lauf-l3-summary.md) ist nach
Freigabe auf `2b39b9df` vollständig ausgeführt und ausgewertet. H2-Fallback
und H2-Fehler bestehen, H2-Latenz wegen der Blitzlicht-Antworten nicht
vollständig. Rücknahme und Nachprüfungen bestanden. Zahlen, Versionsvergleich
und Messgrenzen ausschließlich im Protokoll. Kein Queue-/Breaker-Nachweis.

Nächster vorgeschlagener Versuch: eine Slot-belegt-Summary-Entwicklungsprobe
mit `-LabN 1`, `-LabTag dev-busy-summary`, `-LabStoerung busy`, `-LabLive`,
Timeout 300 000 ms, Ausführungsstand `2b39b9df`, ohne `--arbeitsstand`.
Erwartet sind eine Slots-Antwort mit HTTP 503, kein Completion-POST,
extraktiver Fallback und vollständige Wiederherstellung. Erst danach die
geplante gewertete Reihe vorbereiten. Runtime-Stopp, Fake und Lauf brauchen
eine neue Freigabe; keine davon ist durch diesen Nachtrag erteilt.

## Nachtrag 2026-11-16: Slot-belegt-Summary-Probe bestanden

Die freigegebene [Slot-belegt-Probe](evidenz/1B/2026-11-16-lauf-dev-busy-summary.md)
auf `2b39b9df` bestätigt HTTP 503 bei der Slot-Abfrage, keinen Completion-POST,
den passenden Fallback und erfolgreiche Wiederherstellung. Vollständige
Messung; Zahlen und Grenzen ausschließlich im Protokoll.

Nächster vorgeschlagener Versuch: die geplante gewertete Slot-belegt-Reihe,
zehn Summary-Aufträge, `-LabTag busy-summary`, `-LabStoerung busy`,
`-LabLive`, Timeout 300 000 ms, Ausführungscommit `2b39b9df`, ohne
`--arbeitsstand`. Erwartet je Auftrag HTTP 503 bei der Slot-Abfrage, kein
Completion-POST und `extractive/busy`; H2-Fallback innerhalb Budget + 1 s,
H2-Fehler ohne zusätzliche Live-Fehler und H2-Latenz höchstens 110 % von B0/F1.
CPU/RSS vollständig erfassen, Versions-/Manifestprüfung offenlegen,
Wiederherstellung bestätigen. Entwicklungsprobe nicht mitwerten.
Lauf und temporärer Runtime-Ersatz durch den Fake benötigen erneut Freigabe.

## Nachtrag 2026-11-16: Busy-Reihe ausgewertet und Zwischenstand abgeglichen

Die [Slot-belegt-Summary-Reihe](evidenz/1B/2026-11-16-lauf-busy-summary.md)
auf `2b39b9df` ist vollständig. H2-Fallback und H2-Fehler bestehen,
H2-Latenz wegen Beitritt und Blitzlicht nicht vollständig; Wiederherstellung
bestanden. Zahlen und Grenzen ausschließlich im Protokoll.

Abgleich mit dem am 2026-11-16 per GitHub CLI gelesenen Issue #9 und den
Dokumenten `00-rahmen-und-pruefung.md` und `01-aufteilung.md`:
Werkzeuge, Fake mit Tests, eigene Summary-Baseline und geplante Summary-Reihen
Normal, F1/B0, F2, L3 und Slot-belegt sind vorhanden. Das ist eigene
Schritt-3-Evidenz, keine bloße Wiederholung des Aufbaus aus Schritten 1–2.
Ein allgemeiner Isolationsgewinn ist wegen verfehlter p95-Kriterien nicht
nachgewiesen. Schritt 3 insgesamt bleibt offen.

Ausstehend: eigene Label-Baseline und Label-Reihen (L1/L2, L3, F1, F2,
Slot-belegt), Nachweis der tatsächlich gesetzten Netzlatenz bei L1/L2,
gerichtete Queue-/Breaker-Folge mit Kontrollfall und Behandlung der
Label-Beobachtbarkeitslücke. Race bleibt optional. Schritt 4 benötigt
Betriebsbewertung, S1-Laborvergleich und konkrete Entscheidung; Eigenanteil,
Autorenprüfung, Abgabe-/PR-Abschluss folgen nach der Auswertung.

Nächster vorgeschlagener Lauf: Label-Normalbetrieb als Entwicklungsprobe,
`-LabN 1`, `-LabTag dev-normal-label`, `-LabAuftrag label`,
`-LabStoerung normal`, `-LabLive`, Timeout 300 000 ms auf `2b39b9df`,
ohne `--arbeitsstand`. Der vorhandene Helfer baut bei Bedarf den Encoder
und aktiviert SEMANTIC; beides bleibt anschließend aktiv. Für alle folgenden
Label-Baselines und Varianten dieselbe Konfiguration verwenden. Der Wechsel
ist im Manifest zu erfassen; bisherige Summary-Baselines nicht ungeprüft mit
späteren Läufen mit aktivem Encoder vergleichen. Ein `labelSettlement`-Ergebnis,
ein tatsächlich ausgeführter Label-Pfad, vollständige Live-/Ressourcenmessung
und gesunde Dienste sind zu prüfen. Fehlende interne Label-Job-Zeit und
Fallback-Gründe bleiben fehlend; kein H2-Fallback-PASS daraus ableiten.
Diese Probe und die Encoder-Einrichtung sind noch nicht freigegeben.

## Nachtrag 2026-11-16: Label-Probe abgebrochen, Diagnose erforderlich

Die freigegebene [Label-Normalprobe](evidenz/1B/2026-11-16-lauf-dev-normal-label.md)
auf `2b39b9df` bricht vor einem vollständigen Messfenster ab. Encoder und
SEMANTIC sind eingerichtet und bleiben aktiv; gesunde Dienste nach Abbruch
bestätigt. Label-Phase nicht nachgewiesen, Ursache des frühen Semantic-Fallbacks
noch offen. Keine Baseline und kein gewerteter Label-Lauf.

Der Labortreiber ergänzt seine bisher pauschale Abbruchmeldung um ausgewählte
Statusfelder, ohne Nutzdaten oder Tokens. Regressionstest rot vor Änderung,
acht ausgewählte lokale Tests danach grün. Kein Produktionspatch.
Nächster vorgeschlagener Lauf: ein Label-Normalauftrag mit Live-Fenster,
`-LabTag dev-normal-label-diagnose`, `--arbeitsstand`, Timeout 300 000 ms;
Entwicklung, nicht werten. Er muss separat freigegeben werden.
Vor gewerteten Label-Reihen außerdem Node-24-Abweichung und tatsächlich
wirksamen Encoder-Timeout im Manifest klären; Details im Protokoll.

## Nachtrag 2026-11-16: Label-Korpus korrigiert, Node-Umstellung als nächster Schritt

Die [Diagnoseprobe](evidenz/1B/2026-11-16-lauf-dev-normal-label-diagnose.md)
belegt einen Semantic-Cluster-Fallback mit Encoder-Modellversion; die
LLM-Labelphase wird deshalb übersprungen. Nur für Label wird nun
`label-identical-pair-v1` verwendet: identische sichtbare Fragen B/C und ein
Gegenbeispiel E. Summary-/Breaker-Referenz unverändert. Last-/Fehlerfixture,
keine Aussage zur semantischen Qualität. Korpuskennung im Treiber-JSON;
alle künftigen Label-Reihen verwenden dieselbe Fixture. Regressionstest
vorher rot, zehn ausgewählte Tests danach grün. VM-Nachweis steht aus.

Nächster Schritt ist zunächst die Umstellung beider VM-Node-Versionen auf 24,
vor einer weiteren Label-Probe und vor jeder gewerteten Label-Baseline.
Die App selbst läuft schon unter Node 24.19.0. Node 22 ist keine belegte
Ursache dieses Fallbacks. Upgrade noch nicht ausgeführt; danach Versionen und
Dienste prüfen und Freigabe für die korrigierte Entwicklungsprobe erfragen.
Alte Summary-Daten und ihre tatsächlich verwendeten Versionen bleiben erhalten.
Effektiven Encoder-Timeout vor gewerteten Label-Reihen klären.

## Nachtrag 2026-11-16: Node 24 installiert, korrigierte Label-Probe bereit

Niklas hat die [Node-24-Umstellung](evidenz/1B/2026-11-16-node24-upgrade.md)
auf beiden VMs ausgeführt. Versionen und Dienste sind lesend nachgeprüft;
die Node-Voraussetzung ist vor dem nächsten Label-Test erfüllt. Bestehende
Summary-Daten und ihre Umgebungsangaben bleiben unverändert.

Nächster vorgeschlagener Lauf: `dev-normal-label-v2`, ein Label-Normalauftrag
mit Live-Fenster, Timeout 300 000 ms und `--arbeitsstand`, damit die lokal
getestete Korpuskorrektur übertragen wird. Entwicklung, nicht werten.
Korpuskennung `label-identical-pair-v1`, erreichter Label-Pfad,
vollständiges Live-/Ressourcenfenster und gesunde Dienste sind zu prüfen.
Kein neuer Lauf gestartet; Freigabe für diese einzelne Probe noch erforderlich.

## Nachtrag 2026-11-16: Label-Pfad bestätigt, Manifest vor Baseline korrigiert

Die freigegebene [Label-Probe v2](evidenz/1B/2026-11-16-lauf-dev-normal-label-v2.md)
erreicht mit `label-identical-pair-v1` tatsächlich die Runtime und übernimmt
die Label-Antwort. Vollständige Messung und Dienstprüfungen; weiterhin nur
Entwicklung wegen `--arbeitsstand`. Zahlen und Grenzen im Protokoll.

Die bekannte Manifestabweichung ist lokal korrigiert: erlaubte Settings aus
dem laufenden App-Container statt der env-Datei, ausdrückliche Herkunft,
Node-Versionen beider VMs und des App-Containers sowie Korpuskennung im
Vergleich. Unvollständige Label-Manifeste bleiben nicht beurteilbar.
Regressionstests vorher rot, 26 ausgewählte Tests danach grün; Syntax geprüft.
Noch kein vollständiger VM-Lauf mit der neuen Manifest-Erfassung.

Vor dem ersten gewerteten Label-Lauf Änderungen regulär committen und neuen
Ausführungsstand festhalten. Danach die erste Teilreihe Normal/Label mit
höchstens zehn der geplanten 30 Aufträge separat freigeben. Konfiguration,
Encoder, Korpus und Node-Versionen für alle Label-Varianten beibehalten.
Noch keine neue Baseline erhoben; interne Label-Fallback-Zeit bleibt nicht
direkt beobachtbar. Keine weiteren Node-Upgrades vor der Baseline erforderlich.
