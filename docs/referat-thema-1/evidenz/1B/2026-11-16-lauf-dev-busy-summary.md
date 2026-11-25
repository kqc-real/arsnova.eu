# Entwicklungslauf dev-busy-summary, 2026-11-16

Prüfung durch den Autor: 2026-11-16 (Niklas).

## Umgebung und Quellen

Niklas hat nach Freigabe einen Summary-Auftrag mit Slot-belegt-Fake und
Live-Last über `labor-wsl.sh` ausgeführt. Diese Entwicklungsprobe zählt nicht
zur geplanten gewerteten Reihe mit zehn Summary-Aufträgen.

- Ausführungs- und Auswertungscommit:
  `2b39b9dfc13aefd763fa4e0d8440a0536fa847f7`.
- Rechner: Intel Core i7-10700K, 8 Kerne/16 Threads, 31,9 GiB RAM,
  Windows 11 Pro, Hyper-V ohne CPU-Pinning.
- app-host: 2 vCPU/4 GiB RAM; llm-host: 8 vCPU/10 GiB RAM.
- Lauf-ID `20261116T015911-dev-busy-summary`; lokal etwa 02:59–03:06 Uhr MEZ.
- Timeout 300 000 ms nach der [Tageskalibrierung](2026-11-16-kalibrierung.md).
- Lokale Quellen unter `%USERPROFILE%\labor-1b\20261116T015911-dev-busy-summary\`:
  Ergebnis, Treiber, App-Log, Transport-TSVs, Störungsjournal sowie Rücknahme-
  und Nachprüfungsberichte. Rohdaten und PCAPs bleiben lokal.

## Störung und Ergebnis

Alle Zahlen gelten für den oben genannten Rechner und Commit.
Das laufübergreifende Journal bestätigt für diesen Versuch um 01:59:49 UTC
`docker stop arsnova-open-weight-llm` und um 01:59:50 UTC den Fake im Modus
`busy`. Eine Verbindung und eine Slot-Abfrage mit HTTP 503, kein
Completion-POST, kein RST: `faultObserved=true`. Der Fake weist die Anfrage
bereits bei der Slot-Abfrage ab; die echte Runtime inferiert nicht.

Der Summary-Job endet mit `ready`, `extractive/busy`, Job-Zeit 52 ms.
Client-Wartezeit 1 095 ms; sie enthält die Sekundenabfrage des Treibers und
ist nicht mit der backendseitigen Job-Zeit gleichzusetzen.
`fallbackWithinBudget=true`. Die Neuberechnung mit `buildExperimentResult`
aus den lokalen Eingaben reproduziert das vollständige Experimentergebnis.
Kein Nachweis der Queue-/Breaker-Hypothese aus dieser Einzelprobe.

## Live-Last und Ressourcen

Live-, Ressourcen- und Gesamtfenster vollständig, 166 gültige RSS-Proben.
Je Fenster 500 Ankünfte, 90-s-Rampe, Ergebnisfreigabe bei 270 s, Dauer 330 s;
keine dauerhaft konstante Konkurrenz von 500 Personen.

| Aktion             | Erfolge | Fehler | p95 in ms |
| ------------------ | ------: | -----: | --------: |
| Beitritt           |     500 |      0 |     39,41 |
| Quizstimme         |     500 |      0 |     33,68 |
| Q&A-Einreichung    |     100 |      0 |     15,91 |
| Blitzlicht-Antwort |     500 |      0 |     16,41 |

App-Prozess-RSS maximal 471 871 488 Bytes; gemeinsame Seiten können mehrfach
gezählt sein. Maximale App-CPU 39,67 % einer logischen CPU aus cgroup-Deltas.
Kein gewerteter H2-Latenzvergleich aus der Entwicklungsprobe.

## Wiederherstellung und Konsequenz

Der Rücknahmehelfer beendet den Fake und startet die echte Runtime.
Das Journal bestätigt `docker start arsnova-open-weight-llm` um 02:05:37 UTC
und anschließend `restored`. Rücknahmebericht `restored=true, variant=busy`,
Wiederherstellung `restored=true, checksPassed=true`. Beide VM-Prüfungen
einschließlich Testinferenz bestehen nach frischem Runtime-Start.

Der Slot-belegt-Summary-Pfad ist erstmals auf den VMs bestätigt. Als Nächstes
die geplante gewertete Reihe nach erneuter Freigabe ausführen. Label-Varianten
und gerichteter Queue-/Breaker-Nachweis bleiben offen.
