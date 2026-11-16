# Gerichtete F1-Kontrollfolge für den Circuit Breaker, 2026-11-16

Prüfung durch den Autor: 2026-11-16 (Niklas).

## Umgebung und Quellen

Niklas hat nach Freigabe vier Summary-Aufträge in unterschiedlichen, vorab
angelegten Sessions ohne Cooldown ausgeführt. Gerichteter Kontrollversuch,
keine Live-Last und keine neue Isolationsmessung.

- Ausführungs- und Auswertungscommit:
  `7c64dd6a0352df1e51981ab16300532eb849f712`, ohne `--arbeitsstand`.
- Rechner: Intel Core i7-10700K, Windows 11 Pro, Hyper-V ohne CPU-Pinning,
  31,9 GiB RAM; app-host 2 vCPU/4 GiB, llm-host 8 vCPU/10 GiB.
- Node: beide VM-Hosts v24.22.3, App-Container v24.19.0.
- Lauf-ID `20261116T191719-breaker-f1-summary`, lokal etwa 20:17–20:19 Uhr MEZ.
- [Ergebnis-JSON](messung/2026-11-16-lauf-breaker-f1-summary.json).
- Lokale Quellen unter `%USERPROFILE%\labor-1b\20261116T191719-breaker-f1-summary\`:
  Treiber, App-Log, Transport-TSVs, Journal und Nachprüfungen.
  PCAPs mit Token bleiben lokal. Repo-JSON und lokales Ergebnis identisch.

Verbraucher `breaker-summary`, Budget 90 000 ms, `pauseMs=0`, Live deaktiviert.
Keine Vergleichbarkeit mit Live-Latenz-/CPU-/RSS-Reihen behauptet.
`buildExperimentResult` reproduziert das gespeicherte Experimentergebnis.

## Störung und beobachteter Breaker

Alle Zahlen gelten für den genannten Rechner und Commit. Journal: auf llm-host
`docker stop arsnova-open-weight-llm` um 19:18:08 UTC; Rücknahme
`docker start arsnova-open-weight-llm` um 19:18:55 UTC.

Alle vier Aufträge `status=ready`, `effectiveMode=extractive`.

| Auftrag | Fallback-Grund | interne Job-Zeit ms | Client-Wartezeit ms | Verbindungsversuche | TCP-RST |
| ------- | -------------- | ------------------: | ------------------: | ------------------: | ------: |
| 1       | unavailable    |                  53 |               1 112 |                   1 |       1 |
| 2       | unavailable    |                  47 |               1 079 |                   1 |       1 |
| 3       | unavailable    |                  44 |               1 064 |                   1 |       1 |
| 4       | circuit_open   |                  44 |               1 058 |                   0 |       0 |

Kein HTTP und kein Completion-POST. Die ersten drei Aufträge erreichen
nachweislich den ausgefallenen Netzpfad. Der vierte wird mit explizitem
`circuit_open` ohne neuen Netzversuch beantwortet. Start des vierten Auftrags
19:18:45,795 UTC, unmittelbar nach Ende des dritten; damit innerhalb des
30-s-Öffnungsfensters. Unterschiedliche Snapshot-Hashes im Treiber unterstützen
die Zuordnung zu unterschiedlichen vorbereiteten Szenarien statt Wiederholung
eines gecachten Ergebnisses.

Das passt zum Code-Schwellwert von drei zählenden Fehlern und 30 s
Öffnungsdauer (`openWeightLlmConfig.ts`, `openWeightLlmClient.ts`). Die Kombination
aus Ergebnisgrund und fehlendem Transport bestätigt die positive Kontrolle;
fehlender Transport allein wäre kein hinreichender Beleg. Der interne
Fehlerzähler selbst wird nicht ausgelesen. Keine Aussage zur Wiederöffnung
oder vollständigen Wiederherstellung des Breakers nach Ablauf der 30 s.
Client-Wartezeiten enthalten die Sekundenabfrage des Treibers und sind nicht
mit internen Job-Zeiten gleichzusetzen.

## Abschluss und nächste Hypothesenprüfung

Rücknahme `restored=true, variant=f1`, Wiederherstellung `checksPassed=true`;
beide VM-Prüfungen einschließlich Testinferenz nach frischem Runtime-Start
bestanden. Keine Live-Fenster oder App-RSS-Verläufe erhoben. Runtime-Logger
enthält nur eine Probe vor dem absichtlichen Stopp, keinen Speicherverlauf
während der Störung.

Kontrollziel erreicht. H-Queue ist dadurch noch nicht beantwortet.
Nächster separat freizugebender Versuch: vier Summary-Timeouts mit verzögertem
Fake, denselben 90 000 ms Budget, unterschiedlichen Sessions und ohne Cooldown.
Bei zählenden Fehlern wird der vierte Auftrag lokal mit `circuit_open`
beantwortet, bei nicht zählenden Abbrüchen erreicht er erneut die Runtime.
Interne `aborted`-Klassifikation nur bei direktem Beleg behaupten; sonst
indirekten Befund mit Codebezug und Grenze dokumentieren.
