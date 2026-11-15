# Gewertete F1-Reihe Summary, 2026-11-15

Prüfung durch den Autor: offen.

Auswertung des Laufs vom 2026-11-15 am 2026-11-16; keine spätere Wiederholung.

## Umgebung und Quellen

Niklas hat zehn Summary-Aufträge mit Live-Last und gestoppter Runtime nach
Rückfrage selbst ausgeführt. F1 entspricht der vorgesehenen B0-Referenz.

- Ausführungscommit: `5e758d0a870bc38441b60c541a6ff6f3d0662ee2`.
- Rechner: Intel Core i7-10700K, 8 Kerne/16 Threads, 31,9 GiB RAM,
  Windows 11 Pro, Hyper-V ohne CPU-Pinning.
- app-host: 2 vCPU/4 GiB; llm-host: 8 vCPU/10 GiB.
- Lauf-ID: `20261115T215523-f1-summary`; Summary-Budget 300 000 ms.
- [Ursprüngliches Ergebnis-JSON](messung/2026-11-15-lauf-f1-summary.json),
  mit `umgebung`; lokale Quellen unter
  `%USERPROFILE%\labor-1b\20261115T215523-f1-summary\`:
  `experiment-config.json`, `treiber.json`, `app.tsv`, `app.log`,
  `stoerung-journal.jsonl`, Rücknahme- und Wiederherstellungsbericht.
- Korrigierte Transportauswertung lokal mit `buildExperimentResult` aus
  `experiment-result.mjs`, SHA-256 `2f3665c3b51e816a9d9f5477ec62f804177185f370c67fa701ae49c43da7ac47`.
  Der Parserstand enthält die noch nicht committete `True`/`False`-Korrektur.
  Ursprüngliche Ergebnisfelder zur TCP-Erkennung sind wegen des dokumentierten
  Parserfehlers nicht maßgeblich; Originaldaten bleiben unverändert.

## Fallback, Netzwerk und Wiederherstellung

Alle Werte gehören zum genannten Rechner und Ausführungscommit.
Zehn Aufträge erreichen `ready`, `effectiveMode=extractive`,
`fallbackReason=unavailable`. Die korrigierte Auswertung erkennt bei jedem
Auftrag einen Verbindungsversuch und ein RST, ohne HTTP-Antwort oder Completion-POST.
Es sind tatsächliche Netzversuche, keine ausschließlich lokalen Breaker-Antworten.

| Auftrag | Job-Zeit in ms | Verbindungsversuche | RST |
| ------- | -------------- | ------------------- | --- |
| 1       | 57             | 1                   | 1   |
| 2       | 128            | 1                   | 1   |
| 3       | 48             | 1                   | 1   |
| 4       | 43             | 1                   | 1   |
| 5       | 117            | 1                   | 1   |
| 6       | 47             | 1                   | 1   |
| 7       | 47             | 1                   | 1   |
| 8       | 46             | 1                   | 1   |
| 9       | 48             | 1                   | 1   |
| 10      | 212            | 1                   | 1   |

Median 48 ms, Spanne 43–212 ms. H-F1 (Median höchstens 2 s und Grund
`unavailable`) ist für diese Reihe erfüllt; ebenso die Fallback-Frist
Summary-Budget plus 1 s. Inferenzzeiten werden bei ausgefallener Runtime nicht erfunden.
Diese Reihe prüft wegen der langen Abstände nicht das kurze Breaker-Öffnungsfenster.

Das Journal belegt für diese Reihe `docker stop arsnova-open-weight-llm` um
21:56:01 UTC und `docker start arsnova-open-weight-llm` um 22:56:15 UTC.
Es enthält davor auch den Entwicklungslauf; für diese Reihe zählt nur das hier
zugeordnete Zeitintervall. Rücknahme meldet `restored=true, variant=f1`;
Wiederherstellung meldet zusätzlich `checksPassed=true`. Die Prüfungen beider
VMs nach der Wiederherstellung sind bestanden.

## Live-Last und App-Ressourcen

Alle zehn Live-, Ressourcen- und Gesamtfenster sind vollständig. 1 660 gültige
RSS-Proben, keine fehlenden RSS-Werte. Unverändertes 330-s-Profil mit
500 Ankünften pro Fenster; keine Behauptung einer ständig konstanten Konkurrenz.
Insgesamt 5 000 Beitritte, 5 000 Quizstimmen, 1 000 Q&A-Einreichungen und
5 000 Blitzlicht-Antworten erfolgreich, keine Fehler oder offenen Aktionen.

Vergleich mit der [Normalreihe](2026-11-15-lauf-normal-summary.md), identischer
Rechner, Ausführungscommit und Konfiguration. p95 jeweils aus allen Roh-Latenzen
der zehn Fenster gepoolt, keine Mittelung der Fenster-p95.

| Aktion          | Normal-p95 in ms | F1-p95 in ms | Verhältnis | Höchstens 1,10 |
| --------------- | ---------------- | ------------ | ---------- | -------------- |
| Beitritt        | 30,42            | 30,66        | 1,008      | ja             |
| Quizstimme      | 25,99            | 31,08        | 1,196      | nein           |
| Q&A-Einreichung | 18,15            | 14,67        | 0,808      | ja             |
| Blitzlicht      | 13,73            | 11,25        | 0,819      | ja             |

Keine zusätzlichen Fehler gegenüber der Normalreihe. Bei Quizstimmen ist die
10-%-Vergleichsschwelle überschritten; ein pauschales Bestehen aller
Live-Latenzkriterien wäre falsch. Daraus folgt bei seriellen Reihen ohne
randomisierte Reihenfolge noch kein kausaler Nachweis, dass der Ausfall die
Abweichung verursacht hat. Die Schwelle wird nicht nachträglich geändert.

Die im Design für H2 als B0 bezeichnete Referenz ist diese F1-Reihe. Der
Normal-zu-F1-Vergleich ist separat ausgewiesen; die folgenden Störvarianten
müssen zusätzlich gegen B0/F1 verglichen werden. Schritt 3 ist noch nicht
abgeschlossen. Nächster gesondert freizugebender Versuch: ein F2-Entwicklungslauf
mit ufw-DROP nur auf dem Runtime-Port, Rücknahme und Nachprüfung eingeschlossen.
