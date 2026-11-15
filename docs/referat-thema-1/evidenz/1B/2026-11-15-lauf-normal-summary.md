# Gewertete Normalreihe Summary, 2026-11-15

Prüfung durch den Autor: offen.

## Umgebung und Quellen

Niklas hat den vorab besprochenen Lauf mit zehn Summary-Aufträgen und Live-Last
auf dem committeten Stand ausgeführt, ohne Störung und ohne `--arbeitsstand`.

- Ausführungscommit: `5e758d0a870bc38441b60c541a6ff6f3d0662ee2`.
- Rechner: Intel Core i7-10700K, 8 Kerne/16 Threads, 31,9 GiB RAM;
  Windows 11 Pro und Hyper-V ohne CPU-Pinning.
- app-host: 2 vCPU/4 GiB; llm-host: 8 vCPU/10 GiB.
- Lauf-ID: `20261115T202740-normal-summary`.
- Kalibrierung: `kalibrierung-20261115T190323.json`, gleicher Rechner und
  Energiesparplan; wirksames Summary-Budget 300 000 ms.
- [Ergebnis-JSON](messung/2026-11-15-lauf-normal-summary.json) mit `umgebung`.
- Lokale ergänzende Quellen unter
  `%USERPROFILE%\labor-1b\20261115T202740-normal-summary\`:
  `treiber.json`, `app.tsv`, `app.log`, `wiederherstellung.json`, Prüfberichte.
  PCAPs bleiben lokal und werden nicht eingecheckt.

## Vollständigkeit und Live-Verhalten

Alle folgenden Werte beziehen sich ausschließlich auf den oben genannten
Rechner und Commit. Alle zehn Messfenster sind vollständig, einschließlich
CPU/RSS. Insgesamt 1 660 gültige RSS-Proben, keine übersprungenen Ressourcenproben.
Pro Fenster das vorab dokumentierte Profil: 500 Ankünfte, 90-s-Rampe,
Freigabe bei 270 s, Fensterdauer 330 s. Keine Behauptung einer kontinuierlich
konstanten Konkurrenz von 500 Personen.

Die p95-Werte werden aus den gepoolten Roh-Latenzen aller zehn Fenster mit
`fasseLaufzeitenZusammen` berechnet, nicht als Mittelwert der Fenster-p95.

| Aktion          | Erfolgreich / geplant | Fehler | Gepooltes p95 in ms |
| --------------- | --------------------- | ------ | ------------------- |
| Beitritt        | 5 000 / 5 000         | 0      | 30,42               |
| Quizstimme      | 5 000 / 5 000         | 0      | 25,99               |
| Q&A-Einreichung | 1 000 / 1 000         | 0      | 18,15               |
| Blitzlicht      | 5 000 / 5 000         | 0      | 13,73               |

Keine offenen, ausgelassenen oder nicht versuchten Aktionen. Nachprüfungen
bestanden; `restored=true`, `checksPassed=true`. Runtime: keine Neustarts,
kein OOM-Kill. Die Reihe ist als Live-/Ressourcenreferenz bei laufender echter
Inferenz verwendbar. Ein Isolationsgewinn gegenüber Störungen ist damit allein
noch nicht nachgewiesen; die B0/F1-Referenz und Störreihen fehlen weiterhin.

## Summary-Ergebnisse und Qualitätsgrenze

Zehn Endstatus `ready`, aber jeweils `effectiveMode=extractive` und
`fallbackReason=invalid_response`. Das Qualitätstor lehnt die Modellantworten ab.
Die Reihe ist deshalb ausdrücklich keine Referenz für erfolgreich akzeptierte
Modellzusammenfassungen. Sie misst den echten Release-Pfad mit Inferenzlast und
anschließendem extraktivem Fallback.

Erster kalter Auftrag: Job-Zeit 106 013 ms. Median der neun warmen Aufträge:
67 532 ms. Alle Fallbacks liegen innerhalb des wirksamen Summary-Budgets plus
1 s. Die im Laufskript ausgegebenen H_B-Kennzahlen gehören zur Zeitzerlegung
und ersetzen keine Bewertung der H2-Störhypothesen.

## Korrektur der Transportauswertung am Lauftag

Die gespeicherten TSV-Felder zeigen TCP-SYN/RST als `True`/`False`. Der bisherige
Parser akzeptiert nur `1`/`0`, weshalb `transport.connections` im ursprünglichen
Ergebnis fälschlich null Verbindungen zählt. Die Rohdaten sind vollständig;
Live-Kennzahlen, CPU/RSS und Job-Zeiten sind davon unabhängig.

Der Parser akzeptiert jetzt beide Formate. Der Regressionstest war vor der
Korrektur rot und danach grün; eine rein lokale Neuberechnung aus `app.tsv`,
`app.log`, `experiment-config.json` und `treiber.json` ergibt eine beobachtete
Verbindung pro Auftrag. Original-Rohdaten und ursprüngliches Ergebnis-JSON
werden dabei nicht überschrieben. Für spätere F1/F2-Befunde ist diese korrigierte
Auswertung auf die Rohdaten anzuwenden, sonst wären RST/DROP nicht erkennbar.

Die Korrektur betrifft ausschließlich nachträgliche Auswertung und erfordert
keine Wiederholung dieser Messreihe. Für Vergleichsreihen bleibt der
Ausführungsstand fest bei `5e758d0a`; Ausführung und Version der korrigierten
Auswertung sind separat zu belegen. Nächster Labor-Schritt ist ein gesondert
freizugebender F1-Entwicklungslauf, bevor die Störvariante gewertet wird.
