# Entwicklungslauf dev-l3-summary, 2026-11-16

Prüfung durch den Autor: 2026-11-16 (Niklas).

## Umgebung und Quellen

Niklas hat nach Freigabe einen Summary-Auftrag mit Live-Last und L3-Fake
über `labor-wsl.sh` ausgeführt. Die Probe bestätigt den VM-Pfad; sie ersetzt
nicht die geplante gewertete Reihe mit zehn Summary-Aufträgen.

- Ausführungs- und Auswertungscommit:
  `2b39b9dfc13aefd763fa4e0d8440a0536fa847f7`.
- Rechner: Intel Core i7-10700K, 8 Kerne/16 Threads, 31,9 GiB RAM,
  Windows 11 Pro, Hyper-V ohne CPU-Pinning.
- app-host: 2 vCPU/4 GiB RAM; llm-host: 8 vCPU/10 GiB RAM.
- Lauf-ID `20261116T003534-dev-l3-summary`, lokal etwa 01:35–01:42 Uhr MEZ.
- Summary-Budget 300 000 ms nach der
  [Tageskalibrierung](2026-11-16-kalibrierung.md), Fake-Verzögerung 310 000 ms.
- Lokale Quellen unter `%USERPROFILE%\labor-1b\20261116T003534-dev-l3-summary\`:
  `ergebnis.json`, `experiment.json`, `treiber.json`, `app.log`, Transport-TSVs,
  Störungsjournal, Rücknahme- und Nachprüfungsberichte. Keine Rohdaten oder
  PCAPs dieser Entwicklungsprobe ins Repo übernommen.

## Störung und Beobachtung

Alle Zahlen gelten für den oben genannten Rechner und Commit.
Das Journal bestätigt um 00:36:12 UTC den Stopp der echten Runtime und um
00:36:13 UTC den Fake im Modus `delay` mit 310 000 ms Verzögerung.
Der Transport zeigt eine Verbindung, eine Slot-Abfrage mit HTTP 200 und einen
Completion-POST, keinen RST und keine Completion-Antwort vor dem Abbruch.
Die echte Runtime hat während der Probe nicht inferiert.

Summary-Endstatus `ready`, `extractive/timeout`; backendseitige Job-Zeit
300 086 ms, clientseitige Wartezeit 300 370 ms. Der Job liegt 86 ms über
dem nominellen Budget und innerhalb der vorab erlaubten Toleranz von 1 s.
`faultObserved=true`, `fallbackWithinBudget=true`.
Die Neuberechnung mit `buildExperimentResult` aus den lokalen Eingaben
reproduziert das vollständige gespeicherte Experimentergebnis.

Der Fake ist auf eine spätere Antwort konfiguriert; eine tatsächlich
ausgelieferte Antwort nach 310 s wird nicht behauptet. Beim Clientabbruch
räumt der Fake seinen Antwort-Timer auf. Der beobachtete Timeout unterscheidet
sich vom F2-Verbindungsfehler. Aus einem einzelnen Auftrag folgt keine Aussage
zum internen Circuit-Breaker-Zustand oder zur Queue-Timeout-Hypothese.

## Live-Last und Ressourcen

Ein vollständiges Fenster mit 500 Ankünften, 90-s-Rampe, Ergebnisfreigabe bei
270 s und 330 s Messdauer; keine dauerhaft konstante Konkurrenz von 500 Personen.
Live-, Ressourcen- und Gesamtmessung vollständig, 166 gültige RSS-Proben.

| Aktion             | Erfolge | Fehler | p95 in ms |
| ------------------ | ------: | -----: | --------: |
| Beitritt           |     500 |      0 |     28,90 |
| Quizstimme         |     500 |      0 |     31,16 |
| Q&A-Einreichung    |     100 |      0 |     14,74 |
| Blitzlicht-Antwort |     500 |      0 |     15,56 |

App-Prozess-RSS maximal 470 069 248 Bytes; gemeinsame Seiten können mehrfach
gezählt sein. Maximale App-CPU 39,42 % einer logischen CPU aus cgroup-Deltas.
Kein gewerteter H2-Latenzvergleich aus dieser Entwicklungsprobe.

## Rücknahme und Konsequenz

Der Rücknahmehelfer beendet den Fake vor dem Neustart der echten Runtime.
Das Journal bestätigt den Runtime-Start um 00:41:58 UTC und `restored` um
00:41:59 UTC. Rücknahmebericht `restored=true, variant=l3`;
Wiederherstellung `restored=true, checksPassed=true`. Beide VM-Prüfungen
einschließlich Testinferenz bestehen nach dem frischen Runtime-Start.

Der L3-Summary-Pfad ist damit erstmals auf den VMs erprobt. Als Nächstes kann
die geplante gewertete Reihe mit zehn Aufträgen, gleichem Budget und Live-Profil
nach gesonderter Freigabe ausgeführt werden. Label-L3 und der gerichtete
Queue-/Breaker-Nachweis bleiben davon getrennt offen.
