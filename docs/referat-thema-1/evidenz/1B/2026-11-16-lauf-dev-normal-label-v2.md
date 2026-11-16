# Erfolgreiche Label-Entwicklungsprobe, 2026-11-16

Prüfung durch den Autor: 2026-11-16 (Niklas).

## Umgebung und Quellen

Niklas hat nach Freigabe einen Label-Normalauftrag mit Live-Last und
korrigiertem Korpus ausgeführt. Ausführungsstand
`4f085aa09511867bd1fefcf29e8ce072bd8e15a6` über `--arbeitsstand`,
ausdrücklich Entwicklung, keine gewertete Baseline.
Rechner: Intel Core i7-10700K, Windows 11 Pro, Hyper-V ohne CPU-Pinning,
31,9 GiB RAM; app-host 2 vCPU/4 GiB, llm-host 8 vCPU/10 GiB.
VM-Node nach dokumentiertem Upgrade 24.22.3, App-Container 24.19.0.

Lauf-ID `20261116T101001-dev-normal-label-v2`, lokal etwa 11:10–11:17 Uhr MEZ.
Quellen unter `%USERPROFILE%\labor-1b\20261116T101001-dev-normal-label-v2\`:
`ergebnis.json`, `experiment.json`, `treiber.json`, `treiber.log`,
Transport-TSVs, Rücknahme- und Nachprüfungsberichte. Keine Rohdaten oder PCAPs
dieser Entwicklungsprobe ins Repo übernommen.

## Label-Pfad erreicht

Alle Zahlen gelten für den oben genannten Rechner und Ausführungsstand.
Korpuskennung `label-identical-pair-v1`, drei sichtbare Fragen mit einem
identischen Paar sowie Gegenbeispiel. Die Fixture prüft Last und Fehlerpfade,
keine semantische Modellqualität.

Der Auftrag endet mit `status=ready`, `effectiveMode=SEMANTIC`,
`labelSettlement=complete`, `labelModelAccepted=true`, zwei Ergebniseinträgen.
Client-Wartezeit 5 883 ms. Transport: eine Verbindung, eine Slot-Abfrage und
ein Completion-POST, beide HTTP 200, kein RST. Die echte Runtime wurde
tatsächlich angesprochen und ihre Label-Antwort übernommen.

Die Neuauswertung mit `buildExperimentResult` reproduziert das gespeicherte
Experimentergebnis vollständig. Interne Label-Job-/Inferenzzeit und interner
Fallback-Grund werden weiter nicht von der API bereitgestellt:
`jobMs=null`, `inferMs=null`, `fallbackWithinBudget=null`. Daraus folgt kein
bestandener interner Fallback-Zeitnachweis.

## Live-Last und Dienstzustand

Live-, Ressourcen- und Gesamtfenster vollständig; 166 gültige RSS-Proben.
500 Ankünfte, 90-s-Rampe, Ergebnisfreigabe bei 270 s, Fenster 330 s;
keine dauerhaft konstante Konkurrenz von 500 Personen.

| Aktion             | Erfolge | Fehler | p95 in ms |
| ------------------ | ------: | -----: | --------: |
| Beitritt           |     500 |      0 |     33,57 |
| Quizstimme         |     500 |      0 |     34,21 |
| Q&A-Einreichung    |     100 |      0 |     17,17 |
| Blitzlicht-Antwort |     500 |      0 |     16,45 |

App-Prozess-RSS maximal 469 295 104 Bytes; gemeinsame Seiten können mehrfach
gezählt sein. Maximale App-CPU 52,96 % einer logischen CPU aus cgroup-Deltas.
Kein gewerteter p95-Vergleich aus dieser Einzelprobe.

`wiederherstellung.json` bestätigt `restored=true, checksPassed=true`.
Beide VM-Prüfungen einschließlich Testinferenz bestanden nach frischem
Runtime-Start. Encoder und SEMANTIC bleiben aktiv.

## Manifestkorrektur vor der gewerteten Baseline

Diese Probe erfasst noch den Dateiwert des Encoder-Timeouts (8 000 ms), obwohl
Compose im App-Container 120 000 ms vorgibt. Deshalb keine formale Baseline
aus dieser Probe ableiten. Der Laborcollector liest künftig nur die erlaubten
booleschen/numerischen Settings direkt aus dem laufenden App-Container;
keine vollständige Umgebung und keine Secrets werden ausgegeben.
`settingsSource=app-container-environment` kennzeichnet diese Herkunft.

Zusätzlich erfasst `runtimeVersions` Node auf beiden VM-Hosts und im
App-Container. Der Vergleich berücksichtigt Versionen und Korpuskennung;
Label-Vergleiche ohne diese Angaben und ohne belegte Settings-Herkunft bleiben
nicht beurteilbar. Alte Ergebnisdateien bleiben unverändert.

Regressionstests waren vor der Korrektur rot (Dateiwert statt Containerwert,
fehlende Versions-/Korpusprüfung). Danach bestehen 26 ausgewählte lokale
Labor-Tests; Shell- und Node-Syntax geprüft. Produktionscode unverändert.
Die neue Erfassung ist noch nicht durch einen vollständigen VM-Lauf bestätigt.

Vor dem ersten gewerteten Label-Lauf Korpus- und Manifestkorrekturen regulär
committen und den Ausführungsstand festhalten. Die geplanten 30 B1-Aufträge
bleiben in drei einzeln freizugebende Läufe mit höchstens zehn Aufträgen
aufzuteilen. Diese Entwicklungsprobe wird nicht mitgewertet.
