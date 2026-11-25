# Entwicklungslauf dev-f1-summary, 2026-11-15

Prüfung durch den Autor: 2026-11-16 (Niklas).

## Umgebung und Quellen

Niklas hat einen Summary-Auftrag mit Live-Last und F1-Störung nach Rückfrage
selbst gestartet. Entwicklungslauf, keine gewertete F1-Reihe.

- Ausführungscommit: `5e758d0a870bc38441b60c541a6ff6f3d0662ee2`.
- Rechner: Intel Core i7-10700K, 8 Kerne/16 Threads, 31,9 GiB RAM,
  Windows 11 Pro, Hyper-V ohne CPU-Pinning.
- app-host: 2 vCPU/4 GiB RAM; llm-host: 8 vCPU/10 GiB RAM.
- Lauf-ID: `20261115T214404-dev-f1-summary`; Summary-Budget 300 000 ms.
- Quellen ausschließlich lokal unter
  `%USERPROFILE%\labor-1b\20261115T214404-dev-f1-summary\`:
  `ergebnis.json`, `treiber.json`, `app.tsv`, `app.log`,
  `stoerung-journal.jsonl`, `stoerung-ruecknahme.json`,
  `wiederherstellung.json`, Prüfberichte. Keine PCAPs im Repo.
- Transportauswertung lokal mit dem für `True`/`False` korrigierten Parser;
  SHA-256 von `experiment-result.mjs`: `2f3665c3b51e816a9d9f5477ec62f804177185f370c67fa701ae49c43da7ac47`.
  Der Ausführungscommit bleibt unverändert; die lokale Parserkorrektur ist noch
  nicht committet. Die ursprünglichen Rohdaten werden nicht überschrieben.

## F1-Beobachtung und Rücknahme

Alle Zahlen gehören zum oben genannten Rechner und Ausführungscommit.
Das Journal belegt `docker stop arsnova-open-weight-llm` um
21:44:43 UTC und `docker start arsnova-open-weight-llm` um 21:50:29 UTC.
Die korrigierte Auswertung beobachtet einen Verbindungsversuch und ein RST,
keine HTTP-Antwort und keinen Completion-POST.

Summary-Endstatus `ready`, `effectiveMode=extractive`,
`fallbackReason=unavailable`. Job-Zeit 51 ms, Client-Wartezeit 1 093 ms.
Die Differenz enthält die Sekundenabfrage des Treibers und ist keine
zusätzliche Inferenzzeit. Das beobachtete schnelle Fehlerverhalten liegt unter
der vorab festgelegten 2-s-Schwelle; aus einem Entwicklungslauf wird noch kein
gewerteter Median abgeleitet.

Live-, Ressourcen- und Gesamtmessung sind vollständig: 166 gültige RSS-Proben;
500 Beitritte, 500 Quizstimmen, 100 Q&A-Einreichungen und 500 Blitzlicht-Antworten,
alle ohne Fehler, Auslassungen oder offene Aktionen. Das vorab dokumentierte
330-s-Fenster wurde vollständig erfasst.

Rücknahme bestätigt `restored=true, variant=f1`, Wiederherstellung zusätzlich
`checksPassed=true`. Nachprüfungen für beide VMs bestanden.

## Vorläufiger Latenzvergleich

Nur zur Prüfung der Auswertung: Vergleich dieses einzelnen Entwicklungsfensters
mit den gepoolten Latenzen der zehn Fenster aus der
[Normalreihe](2026-11-15-lauf-normal-summary.md). Manifeste passen zusammen.
Keine formale H2-Bewertung aus diesem Entwicklungsvergleich.

| Aktion          | Normal-p95 in ms | Dev-F1-p95 in ms | Verhältnis |
| --------------- | ---------------- | ---------------- | ---------- |
| Beitritt        | 30,42            | 33,19            | 1,091      |
| Quizstimme      | 25,99            | 34,15            | 1,314      |
| Q&A-Einreichung | 18,15            | 16,45            | 0,906      |
| Blitzlicht      | 13,73            | 12,30            | 0,896      |

Die Quizstimme überschreitet die vorab festgelegten 110 % der Normalreferenz.
Das darf nicht als bestanden dargestellt oder durch Änderung der Schwelle
beseitigt werden. Die gewertete F1-Reihe muss den Befund prüfen. Der gemäß
ursprünglichem Design maßgebliche B0/F1-Bezug ist von diesem vorläufigen
Vergleich mit laufender Normalinferenz zu unterscheiden.

Nächster Schritt: gewertete F1-Reihe mit zehn Aufträgen, nach gesonderter
Freigabe von Lauf und Containerstopp, gleicher Ausführungscommit. Schritt 3
bleibt offen; DROP, Latenz-, Label-, Slot- und Breaker-Versuche folgen separat.
