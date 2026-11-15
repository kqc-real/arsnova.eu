# Entwicklungslauf dev-live-normal, 2026-11-15

Prüfung durch den Autor: offen.

## Zweck und Einordnung

Ein Summary-Auftrag mit Live-Last prüft die neuen Messwerkzeuge für Issue #9.
Niklas hat den Lauf im eigenen WSL-Terminal ausgeführt. Tag `dev-live-normal`,
mit `--arbeitsstand`; **keine gewertete Baseline und kein Abschluss von Schritt 3**.
Keine Störung aktiviert.

## Umgebung und Quelle

- Arbeitsstand: `da36c43396b72cc23076a6f6526ceb4c663f8ece`.
- Rechner: Intel Core i7-10700K, 8 Kerne/16 Threads, 31,9 GiB RAM,
  Windows 11 Pro, Hyper-V ohne CPU-Pinning.
- app-host: 2 vCPU, 4 GiB RAM; llm-host: 8 vCPU, 10 GiB RAM.
- Lauf: `20261115T195220-dev-live-normal`.
- Lokale Quelle: `%USERPROFILE%\labor-1b\20261115T195220-dev-live-normal\`;
  `ergebnis.json`, `treiber.json`, `treiber.log`, `wiederherstellung.json`,
  `pruefen-app.txt`, `pruefen-llm.txt`.
- PCAPs bleiben ausschließlich lokal; keine Tokens oder `.env`-Inhalte im Protokoll.

## Beobachtungen

Die folgenden Werte gehören ausschließlich zum oben genannten Rechner und Arbeitsstand.
Das Live-Fenster hat 500 Ankünfte, eine 90-s-Rampe, Freigabe bei 270 s und eine
Dauer von 330 s. Alle Szenarien wurden beendet; das Live-Fenster selbst ist vollständig.

| Aktion          | Erfolgreich / geplant | Fehler | p95 in ms |
| --------------- | --------------------- | ------ | --------- |
| Beitritt        | 500 / 500             | 0      | 22,92     |
| Quizstimme      | 500 / 500             | 0      | 17,76     |
| Q&A-Einreichung | 100 / 100             | 0      | 15,94     |
| Blitzlicht      | 500 / 500             | 0      | 11,95     |

Summary-Endstatus `ready`, `effectiveMode=extractive`,
`fallbackReason=invalid_response`. Job-Zeit 112 557 ms, beobachtete
Client-Wartezeit 112 868 ms. Ein Completion-POST, HTTP 200; die Antwort wurde
vom Qualitätstor nicht angenommen. Das belegt keine erfolgreiche Modellzusammenfassung.

Die Ressourcenmessung enthält 166 Proben, aber **keinen gültigen RSS-Wert**.
CPU-Deltas sind vorhanden; wegen der RSS-Lücke sind Ressourcenmessung und
Gesamtmessung `complete=false`. Ohne Vergleichsreihe folgt daraus keine Aussage
über den Einfluss einer Störung oder über den Isolationsgewinn.

`wiederherstellung.json`: `restored=true`, `checksPassed=true`.
Die Prüfberichte für App und Runtime sind erfolgreich. Schritt 3 bleibt offen:
Störreihen, passende Baselines und Circuit-Breaker-/Queue-Nachweis fehlen.

## Diagnose und Korrektur am Lauftag

Eine spätere lesende Diagnose über `labor-wsl.sh vm app` bestätigt:
`docker top arsnova-v3-app -eo rss` scheitert mit
`Couldn't find PID field in ps output`. Docker benötigt die PID-Spalte für die
Zuordnung der Hostprozesse zum Container. Mit `-eo pid,rss` liefert derselbe
Container eine gültige Prozessliste. Diese Diagnose ist kein neuer Messlauf.

Der Sampler verwendet jetzt `pid,rss`, und der Parser summiert ausschließlich
die RSS-Spalte in KiB zu Bytes. Ungültige oder fehlende Werte bleiben `null`;
`rssError` kennzeichnet Befehlsfehler, ungültige Ausgabe oder Abbruch.
Regressionstests prüfen die von Docker gelieferte Tabellenform und den Sampler.
Die Korrektur verändert die historischen Rohdaten nicht. Ein vollständiges
Messfenster mit korrigiertem Sampler ist noch nicht auf der VM ausgeführt.
