# Gewertete Slot-belegt-Summary-Reihe, 2026-11-16

Prüfung durch den Autor: 2026-11-16 (Niklas).

## Umgebung und Quellen

Niklas hat die freigegebene Reihe mit zehn Summary-Aufträgen und Live-Last
über `labor-wsl.sh` ausgeführt, ohne `--arbeitsstand`.

- Ausführungs- und Auswertungscommit:
  `2b39b9dfc13aefd763fa4e0d8440a0536fa847f7`.
- Rechner: Intel Core i7-10700K, 8 Kerne/16 Threads, 31,9 GiB RAM,
  Windows 11 Pro, Hyper-V ohne CPU-Pinning.
- app-host: 2 vCPU/4 GiB RAM; llm-host: 8 vCPU/10 GiB RAM.
- Lauf-ID `20261116T021116-busy-summary`; lokal etwa 03:11–04:12 Uhr MEZ.
- [Ergebnis-JSON](messung/2026-11-16-lauf-busy-summary.json), Timeout ausdrücklich
  300 000 ms nach der [Tageskalibrierung](2026-11-16-kalibrierung.md).
- Lokale Quellen unter `%USERPROFILE%\labor-1b\20261116T021116-busy-summary\`:
  Treiber, App-Log, Transport-TSVs, Störungsjournal und VM-Nachprüfungen.
  PCAPs mit Token bleiben lokal. Das Ergebnis-JSON wurde nicht verändert.

## Störung, Fallback und Rücknahme

Alle Zahlen gelten für den oben genannten Rechner und Commit.
Das laufübergreifende Journal wurde ab 02:11:54 UTC betrachtet:
`docker stop arsnova-open-weight-llm`, anschließend Fake im Modus `busy`
um 02:11:55 UTC. Je Auftrag eine Verbindung und eine Slot-Abfrage mit HTTP 503,
kein Completion-POST, kein RST; `faultObserved=true` bei allen zehn Aufträgen.
Keine reale Inferenz, keine reine Breaker-Antwort ohne Netzversuch.

Alle Jobs erreichen `ready`, `extractive/busy`.

| Auftrag | Job-Zeit in ms | Client-Wartezeit in ms |
| ------- | -------------: | ---------------------: |
| 1       |             49 |                  1 106 |
| 2       |            111 |                  1 123 |
| 3       |             97 |                  1 121 |
| 4       |            106 |                  1 109 |
| 5       |             68 |                  1 112 |
| 6       |            119 |                  1 153 |
| 7       |             49 |                  1 121 |
| 8       |            163 |                  1 127 |
| 9       |             47 |                  1 131 |
| 10      |             89 |                  1 141 |

Job-Median 93 ms, Maximum 163 ms; H2-Fallback innerhalb des Budgets plus 1 s
erfüllt. Die Sekundenabfrage erklärt zusätzliche Client-Wartezeit; sie ist
nicht die Messgröße des Job-Kriteriums. Kein Nachweis der Queue-/Breaker-Hypothese:
die getrennten Live-Fenster und Cooldowns bilden keine gezielte Breaker-Folge.

Der Rücknahmehelfer beendet den Fake und startet die echte Runtime.
Das Journal bestätigt `docker start arsnova-open-weight-llm` und `restored`
um 03:12:09 UTC. Rücknahmebericht `restored=true, variant=busy`;
Wiederherstellung `restored=true, checksPassed=true`.
Beide VM-Prüfungen einschließlich Testinferenz bestehen nach frischem Start.

## Live-Last und Vergleichbarkeit

Referenz ist die [F1-/B0-Reihe](2026-11-15-lauf-f1-summary.md) auf demselben
Rechner, Ausführungscommit `5e758d0a870bc38441b60c541a6ff6f3d0662ee2`.
Die Manifestprojektion aus `vergleichen.mjs` unterscheidet sich ausschließlich
im Commit; Images, Modellhash, Settings, Energieprofil, VM-Größen und
Live-Profile stimmen überein. Der
[Versionsnachtrag](../../1B-3u4-Planung.md#nachtrag-2026-11-16-tageskalibrierung-und-vorbereitung-der-f2-reihe)
belegt unveränderten Produktionscode, Treiber und Messablauf.
Energiesparplan Ausbalanciert; Windows-Energiemodus nicht damit belegt.

Der strikte automatische Manifestvergleich liefert keinen PASS. Die folgende
Bewertung ist ein ausdrücklich dokumentierter versionsübergreifender Vergleich
mit `evaluateLiveComparison(F1.experiment.live, Busy.experiment.live)` auf
Auswertungsstand `2b39b9df`, ohne Manifeständerung. Neuberechnung mit
`buildExperimentResult` aus den lokalen Eingaben reproduziert das gespeicherte
Experimentergebnis; lokales Ergebnis und Repo-Datei sind gleich.

Alle zehn Live-, Ressourcen- und Gesamtfenster vollständig: 1 660 gültige
RSS-Proben, 16 000 erfolgreiche Aktionen, keine Fehler. Je Fenster 500 Ankünfte,
90-s-Rampe, Ergebnisfreigabe bei 270 s, Messdauer 330 s; keine dauerhaft
konstante Konkurrenz von 500 Personen. p95 aus den zusammengeführten
Einzelzeiten je Aktion, kein Mittelwert einzelner p95-Werte. Richtung Busy / F1.

| Aktion             | Erfolge Busy | Fehler Busy | p95 F1 in ms | p95 Busy in ms | Änderung | ≤ 110 % |
| ------------------ | -----------: | ----------: | -----------: | -------------: | -------: | ------- |
| Beitritt           |        5 000 |           0 |        30,66 |          38,75 | +26,42 % | Nein    |
| Quizstimme         |        5 000 |           0 |        31,08 |          32,76 |  +5,38 % | Ja      |
| Q&A-Einreichung    |        1 000 |           0 |        14,67 |          15,30 |  +4,26 % | Ja      |
| Blitzlicht-Antwort |        5 000 |           0 |        11,25 |          13,72 | +21,91 % | Nein    |

H2-Fehler erfüllt. H2-Latenz insgesamt nicht erfüllt: Beitritt und Blitzlicht
überschreiten die 10-%-Schwelle, absolut rund 8,10 bzw. 2,47 ms mehr.
Zeitlich getrennte Reihen, eine gemeinsame physische CPU und fehlendes
CPU-Pinning begrenzen die Interpretation. Keine kausale Zuschreibung der
Abweichung zur Störung; kein allgemeiner Nachweis erfolgreicher Isolation.

App-Prozess-RSS maximal 474 853 376 Bytes; gemeinsame Seiten können mehrfach
gezählt sein. Maximale App-CPU 40,41 % einer logischen CPU aus cgroup-Deltas.
Die separate Runtime-Speicherreihe enthält nur eine Probe vor dem Stopp
(3 043 246 080 Bytes). Sie ist kein Verlauf des Fakes und kein Beleg für
OOM-/Neustartzustände über die Störungsdauer.

## Ergebnis

Die geplante Slot-belegt-Summary-Reihe ist erhoben und ausgewertet.
Alle Aufträge vermeiden den Completion-POST und wechseln schnell in den
Busy-Fallback. Live-Fehlerkriterium und Wiederherstellung bestehen,
Live-Latenzkriterium nicht vollständig. Label-Reihen einschließlich L1/L2,
gerichteter Queue-/Breaker-Nachweis und Schritt 4 bleiben offen.
