# 1B-010: Aufbau mit einem Befehl, VM-Größen aus einer Regel

- **Status:** methodisch (2026-11-12)
- **Kategorie:** Methodik

## Kontext

Der Autor hat nach dem ersten Aufbau festgelegt: Das Labor soll unter Linux (KVM) und unter Windows (Hyper-V) mit einem Befehl entstehen. Die VM-Größen sollen interaktiv wählbar sein, mit einer Empfehlung aus Kernen, Threads und RAM des Rechners. Niklas baut auf eigener Hardware nach ([ADR 1B-009](1B-009-portabilitaet-linux-windows.md)). Die Größen aus [ADR 1B-002](1B-002-topologie-zwei-vms-ein-rechner.md) passen nur zum Messrechner.

## Entscheidung

`evidenz/1B/labor.sh up` (Linux) und `evidenz/1B/labor.ps1 -Mode up` (Windows) bauen alles auf: Voraussetzungen, Größenwahl, VMs, llm-host, app-host, Prüfungen nach Runbook §10 und §11, Negativtests und einen Aufbaubericht ohne Secrets. Die Einrichtung in den VMs ist für beide Plattformen dieselbe: `llm-start.sh`, `app-start.sh` und `pruefen.sh`. Der Token geht nur per Pipe von VM zu VM.

Größenregel (`groessen.sh` und `groessen.ps1`, gleiche Testfälle in `groessen-faelle.json`):

- llm-host: je vCPU ein physischer Kern, höchstens 8 (Release-Wert). Ohne SMT bleiben 2 Kerne für app-host und Rechner. Unter Linux liegt jede vCPU fest auf dem ersten Thread eines Kerns.
- app-host: 2 vCPU. Unter SMT liegen sie auf den Geschwister-Threads der ersten Kerne, sonst auf den folgenden Kernen.
- RAM bevorzugt: llm 12, app 6, Rechner mindestens 4 GiB. Knapp: llm 10, app 4, Rechner 2 GiB. Darunter bricht das Skript ab.
- Eigene Werte sind möglich und werden geprüft: llm mindestens 2 vCPU und 10 GiB, app mindestens 1 vCPU und 4 GiB, Summen im Rahmen des Rechners.
- `CPU-Limit` und `OPEN_WEIGHT_LLM_THREADS` des Containers folgen den vCPUs der VM (`llm-vm.override.yml`).

Am Messrechner (ThinkPad P50: 4 Kerne, 8 Threads, 31 GiB) ergibt die Regel genau die Größen aus ADR 1B-002. Der gewertete Lauf bleibt dadurch unverändert.

Windows: Hyper-V kann vCPUs nicht an Host-Threads binden. `Set-VMProcessor` bietet nur Anzahl, Reserve, Limit und Gewicht ([Microsoft Learn](https://learn.microsoft.com/powershell/module/hyper-v/set-vmprocessor)). Als Ersatz bekommt der llm-host statischen Speicher, `-Reserve 100` (je vCPU ein voller logischer Prozessor garantiert) und `-RelativeWeight 200` gegenüber 100 beim app-host.

## Alternativen

- **Feste Größen wie ADR 1B-002 für alle:** verworfen; auf kleineren Rechnern scheitert der Aufbau, auf größeren bleibt Leistung ungenutzt.
- **Größenregel nur in einer Sprache (etwa Node):** verworfen; der Windows-Rechner bräuchte Node außerhalb von WSL. Zwei kurze Umsetzungen mit denselben Testfällen halten die Regel gleich.
- **Bis zu 8 Threads für den llm-host unter SMT:** verworfen; am Messrechner bliebe dann kein Thread für app-host und Rechner, und die Zahl wiche von ADR 1B-002 ab. Ob Geschwister-Threads die Inferenz beschleunigen, ist hier nicht gemessen.

## Belege

- Testfälle und Tests: `evidenz/1B/groessen-faelle.json`, `groessen.test.mjs` (Bash, 17/17), `groessen.Tests.ps1` und `labor.Tests.ps1` (Pester 5.7.1 im pwsh-Container, 23/23); PSScriptAnalyzer 1.23.0 ohne Befund. Stand 2026-11-12, Commit `1fb661ea`.
- Linux-Test von null: Aufbaubericht im Aufbauprotokoll (Plan Task 6).
- Windows: nur statisch und mit gemockten Cmdlets geprüft. Der Test in einer verschachtelten VM folgt nach dem gewerteten Lauf (Plan, Nachtrag Task 12 Step 6). Bis dahin gilt „ungetestet, Niklas prüft“.

## Folgen

- Niklas ruft einen Befehl auf und bekommt eine begründete Größe für seinen Rechner.
- Inferenzzeiten auf anderen Größen sind nicht mit dem Messrechner vergleichbar. Der Bericht nennt die gewählten Größen, und das Skript warnt unter 4 vCPU.
- Unter Windows ohne Pinning ist die Messung störanfälliger. Das ist eine Gültigkeitsgrenze für Niklas' Lauf.

## Nachtrag 2026-11-13: Schutz für den Rechner

Auf Wunsch des Autors (Niklas soll keine Sorge um Speicher und Absturz haben) ergänzt, die Entscheidung oben bleibt:

- Die Empfehlung nennt auch die Platte (llm-host 20 GiB statt fest 30, app-host 25 GiB wegen ~18 GiB beim App-Build, gemessen); eigene Werte darüber sind möglich.
- Vor dem Anlegen bricht `up` ab, statt zu warnen, wenn dem Rechner weniger als die RAM-Reserve (Standard 4 GiB) bliebe oder der Platz nicht für den gemessenen Bedarf (~31 GiB) plus 10 GiB reicht. Regel und Testfälle: `groessen-faelle.json` (`ressourcenRegel`).
- Neue Modi `stop` und `start`; nach dem Build löschen die VMs ihren Docker-Build-Cache.
- Belege: Node 53/53, Pester 39/39, PSScriptAnalyzer 1.23.0 ohne Befund (Commit `2acddb37`); Abbruch unter Linux mit zu viel RAM von Hand geprüft. Der Volltest unter Windows in einer VM scheiterte an der Verschachtelung ([Windows-Test, Versuch 3](../evidenz/1B/2026-11-13-windows-test.md#verlauf-versuch-3-volltest-mit-wsl-2026-11-13-vormittag)); der erste echte Aufbau unter Windows ist der von Niklas.

_Ergänzt 2026-11-13:_ Die Fortschrittsanzeige war nur unter Windows umgesetzt (`[n/11]`, Restzeit); `labor.sh up` zeigte nur Überschriften. Angeglichen: Beide zeigen je Schritt dieselbe Zeile mit Zeit seit Beginn, Restzeit und voraussichtlichem Ende (`fortschritt.sh` mit `fortschritt.test.mjs`, `Format-SchrittZeile` mit Pester). Die Schrittzahl bleibt verschieden (Linux 7, Windows 11), weil Hyper-V mehr Einzelschritte braucht.
