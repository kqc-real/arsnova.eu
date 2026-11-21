# Gewertete L3-Summary-Reihe, 2026-11-16

Prüfung durch den Autor: 2026-11-16 (Niklas).

## Umgebung und Quellen

Niklas hat die freigegebene Reihe mit zehn Summary-Aufträgen und Live-Last
über `labor-wsl.sh` ausgeführt, ohne `--arbeitsstand`.

- Ausführungs- und Auswertungscommit:
  `2b39b9dfc13aefd763fa4e0d8440a0536fa847f7`.
- Rechner: Intel Core i7-10700K, 8 Kerne/16 Threads, 31,9 GiB RAM,
  Windows 11 Pro, Hyper-V ohne CPU-Pinning.
- app-host: 2 vCPU/4 GiB RAM; llm-host: 8 vCPU/10 GiB RAM.
- Lauf-ID `20261116T004656-l3-summary`; lokal etwa 01:46–02:48 Uhr MEZ.
- [Ergebnis-JSON](messung/2026-11-16-lauf-l3-summary.json.gz), Timeout ausdrücklich
  300 000 ms nach der [Tageskalibrierung](2026-11-16-kalibrierung.md).
- Lokale Quellen unter `%USERPROFILE%\labor-1b\20261116T004656-l3-summary\`:
  Treiber, App-Log, Transport-TSVs, Störungsjournal und Nachprüfungen.
  PCAPs mit Token bleiben lokal. Ergebnis-JSON unverändert übernommen.

## Störung und Rücknahme

Das laufübergreifende Journal wurde ab 00:47:34 UTC betrachtet. Die echte
Runtime wurde mit `docker stop arsnova-open-weight-llm` angehalten und durch
den authentifizierten Fake im Modus `delay` mit 310 000 ms Verzögerung ersetzt.
Je Auftrag sind eine Verbindung, eine Slot-Abfrage mit HTTP 200 und ein
Completion-POST belegt. Keine Completion-Antwort vor Abbruch, kein RST;
`faultObserved=true` bei allen zehn Aufträgen. Keine reine Breaker-Antwort
ohne Netzversuch. Eine tatsächlich ausgelieferte Antwort nach 310 s wird
nicht behauptet; der Fake räumt beim Clientabbruch den Antwort-Timer auf.

Der Rücknahmehelfer beendet den Fake vor dem Runtime-Neustart. Das Journal
bestätigt `docker start arsnova-open-weight-llm` um 01:47:48 UTC und
`restored` um 01:47:49 UTC. Rücknahmebericht `restored=true, variant=l3`,
Wiederherstellung `restored=true, checksPassed=true`. Beide VM-Prüfungen
bestehen nach frischem Runtime-Start, einschließlich Testinferenz.

## Summary-Ergebnisse

Alle Zahlen gelten für den oben genannten Rechner und Commit.
Alle zehn Jobs erreichen `ready`, `extractive/timeout`.

| Auftrag | Job-Zeit in ms | Client-Wartezeit in ms |
| ------- | -------------: | ---------------------: |
| 1       |        300 090 |                300 435 |
| 2       |        300 103 |                300 360 |
| 3       |        300 063 |                300 392 |
| 4       |        300 069 |                300 518 |
| 5       |        300 065 |                301 161 |
| 6       |        300 060 |                300 189 |
| 7       |        300 090 |                300 344 |
| 8       |        300 062 |                301 140 |
| 9       |        300 061 |                301 104 |
| 10      |        300 070 |                300 364 |

Job-Median 300 067 ms, Maximum 300 103 ms. H2-Fallback erfüllt: alle
Job-Zeiten innerhalb des Budgets plus 1 s. Die Sekundenabfrage des Treibers
kann die Client-Wartezeit zusätzlich verlängern; sie ist ausdrücklich nicht
die Messgröße dieses Kriteriums. Drei Client-Wartezeiten liegen über 301 s.

L3 belegt damit einen Completion-Timeout, anders als F2 mit scheiterndem
Verbindungsaufbau. Durch getrennte Live-Fenster und Cooldown sind die Jobs
keine gerichtete Folge innerhalb des Breaker-Fensters. Weder interner
Breaker-Zustand noch die Queue-Timeout-Hypothese werden hiermit nachgewiesen.

## Vergleichbarkeit und Live-Last

Referenz ist die [F1-/B0-Reihe](2026-11-15-lauf-f1-summary.md) auf demselben
Rechner mit Ausführungscommit `5e758d0a870bc38441b60c541a6ff6f3d0662ee2`.
Die Manifestprojektion aus `vergleichen.mjs` unterscheidet sich ausschließlich
im Commit. Images, Modellhash, Settings, Energieprofil, VM-Größen und
Live-Profile stimmen überein. Der
[Versionsnachtrag](../../1B/archiv/1B-3u4-Planung.md#nachtrag-2026-11-16-tageskalibrierung-und-vorbereitung-der-f2-reihe)
belegt unveränderten Produktionscode, Treiber und Messablauf.
Der Energiesparplan ist Ausbalanciert; der Windows-Energiemodus ist nicht belegt.

Der strikte automatische Manifestvergleich bleibt deshalb gesperrt und liefert
keinen PASS. Die folgende Bewertung ist der ausdrücklich dokumentierte
versionsübergreifende Vergleich mittels
`evaluateLiveComparison(F1.experiment.live, L3.experiment.live)` auf
Auswertungsstand `2b39b9df`; keine Manifeständerung. Die Neuberechnung mit
`buildExperimentResult` aus den lokalen Eingaben reproduziert das gespeicherte
L3-Experimentergebnis vollständig; lokales Ergebnis und Repo-Datei sind gleich.

Alle zehn Live-, Ressourcen- und Gesamtfenster sind vollständig: 1 660 gültige
RSS-Proben und 16 000 erfolgreiche Aktionen ohne Fehler. Je Fenster 500
Ankünfte, 90-s-Rampe, Ergebnisfreigabe bei 270 s, Messdauer 330 s;
keine dauerhaft konstante Konkurrenz von 500 Personen. p95 wird aus den
zusammengeführten Einzelzeiten berechnet, nicht aus gemittelten p95-Werten.
Vergleichsrichtung L3 / F1.

| Aktion             | Erfolge L3 | Fehler L3 | p95 F1 in ms | p95 L3 in ms | Änderung | ≤ 110 % |
| ------------------ | ---------: | --------: | -----------: | -----------: | -------: | ------- |
| Beitritt           |      5 000 |         0 |        30,66 |        30,04 |  −2,00 % | Ja      |
| Quizstimme         |      5 000 |         0 |        31,08 |        28,53 |  −8,23 % | Ja      |
| Q&A-Einreichung    |      1 000 |         0 |        14,67 |        14,66 |  −0,08 % | Ja      |
| Blitzlicht-Antwort |      5 000 |         0 |        11,25 |        12,72 | +13,06 % | Nein    |

H2-Fehler erfüllt, H2-Latenz insgesamt nicht erfüllt: Blitzlicht überschreitet
die 10-%-Schwelle, absolut rund 1,47 ms mehr. Zeitlich getrennte Messreihen,
eine gemeinsame physische CPU und fehlendes CPU-Pinning begrenzen die
Interpretation. Keine kausale Zuschreibung der Abweichung zum Fake und keine
allgemeine Aussage erfolgreicher Isolation.

## Ressourcen und verbleibende Arbeit

App-Prozess-RSS maximal 472 850 432 Bytes; gemeinsame Seiten können mehrfach
gezählt sein. Maximale App-CPU 40,12 % einer logischen CPU aus cgroup-Deltas.
Die separate Runtime-Speicherreihe enthält nur eine Probe vor dem Stopp
(3 043 250 176 Bytes). Sie ist kein Ressourcenverlauf des Fakes und belegt
keinen OOM-/Neustartzustand über die Störungsdauer. Die vollständige
App-Messung ist davon getrennt; die echte Runtime ist nach Rücknahme gesund.

Die geplante L3-Summary-Reihe ist erhoben und ausgewertet. Label-L3,
Slot-belegt, weitere Label-Varianten, gerichteter Queue-/Breaker-Nachweis und
Schritt 4 bleiben offen. Die Entwicklungsprobe wurde nicht mitgewertet.
