# Gerichtete Queue-Timeout-Folge und Breaker-Vergleich, 2026-11-16

Prüfung durch den Autor: 2026-11-16 (Niklas).

## Umgebung und Quellen

Niklas hat nach Freigabe vier Summary-Aufträge in unterschiedlichen, vorab
angelegten Sessions ohne Cooldown gegen den verzögerten Fake ausgeführt.
Gerichteter H-Queue-Versuch, keine Live-Last und keine neue Isolationsmessung.

- Ausführungs- und Auswertungscommit:
  `7c64dd6a0352df1e51981ab16300532eb849f712`, ohne `--arbeitsstand`.
- Rechner: Intel Core i7-10700K, Windows 11 Pro, Hyper-V ohne CPU-Pinning,
  31,9 GiB RAM; app-host 2 vCPU/4 GiB, llm-host 8 vCPU/10 GiB.
- Node: beide VM-Hosts v24.22.3, App-Container v24.19.0.
- Lauf-ID `20261116T192306-breaker-l3-summary`, lokal etwa 20:23–20:31 Uhr MEZ.
- [Ergebnis-JSON](messung/2026-11-16-lauf-breaker-l3-summary.json).
- [Zählende F1-Kontrollfolge](2026-11-16-lauf-breaker-f1-summary.md).
- Lokale Quellen unter `%USERPROFILE%\labor-1b\20261116T192306-breaker-l3-summary\`:
  Treiber, App-Log, Transport-TSVs, Journal und Nachprüfungen.
  PCAPs mit Token bleiben lokal. Repo-JSON und lokales Ergebnis identisch.

`breaker-summary`, Budget 90 000 ms, `pauseMs=0`, Live deaktiviert.
`buildExperimentResult` reproduziert das gespeicherte Experimentergebnis.
Keine Live-p95-/CPU-/RSS-Vergleichsaussage aus diesem Versuch.

## Störung und Ergebnisse

Alle Zahlen gelten für den genannten Rechner und Commit. Journal auf llm-host:
19:23:44 UTC `docker stop arsnova-open-weight-llm`, um 19:23:45 UTC Fake-Modus
`delay` mit 130 000 ms Verzögerung. Rücknahme beendet den Fake und startet die
Runtime mit `docker start arsnova-open-weight-llm` um 19:30:25 UTC.

Alle vier Aufträge `status=ready`, `effectiveMode=extractive`,
`fallbackReason=timeout`. Je Auftrag eine Verbindung, eine erfolgreiche
Slot-Abfrage (HTTP 200) und ein Completion-POST ohne Antwort während des
Auftrags, kein RST. Auch der vierte Auftrag erreicht tatsächlich das Netz.

| Auftrag | interne Job-Zeit ms | Client-Wartezeit ms | Verbindungen | Slot-Abfragen | POSTs |
| ------- | ------------------: | ------------------: | -----------: | ------------: | ----: |
| 1       |              90 060 |              91 005 |            1 |             1 |     1 |
| 2       |              90 057 |              90 966 |            1 |             1 |     1 |
| 3       |              90 060 |              91 083 |            1 |             1 |     1 |
| 4       |              90 064 |              90 914 |            1 |             1 |     1 |

Interner Job-Median 90 060 ms, Maximum 90 064 ms. Alle Jobs innerhalb des
90 000-ms-Budgets plus 1 s; H2-Fallback in dieser Folge erfüllt.
Client-Zeiten enthalten die Sekundenabfrage des Treibers; deren Überschreiten
der 91 000 ms in zwei Fällen ist nicht das interne Job-Zeitkriterium.
Keine synthetische Inferenzzeit für den Fake.

## H-Queue: Befund mit Kontrollfolge

F1-Kontrolle: nach drei tatsächlichen RST-Fehlern vierter Auftrag mit
`circuit_open` und ohne Netzversuch. Hier dagegen viermal `timeout` mit
Netzversuch, insbesondere nach dem dritten Timeout kein lokaler Circuit-
Fallback im unmittelbar folgenden vierten Auftrag. Unterschiedliche
Snapshot-Hashes und kein absichtlicher Cooldown. Der vierte Auftrag beginnt
um 19:28:46,246 UTC, direkt nach Ende des dritten um 19:28:46,245 UTC;
ein nach dem dritten Fehler geöffnetes 30-s-Fenster wäre nicht bereits abgelaufen.

Damit ist die vorab formulierte H-Queue-Verhaltensvorhersage für diesen Lauf
gestützt: Queue-Timeouts öffnen den beobachteten Breaker nicht wie die
zählenden F1-Fehler. Codebezug am genannten Commit:

- `qaSummaryQueue.ts`, `processWithTimeout`: Queue-Timer bricht den Caller
  mit `QA_SUMMARY_TIMEOUT` ab und liefert Queue-Status `timeout`.
- `openWeightLlmClient.ts`, `classifyCaughtError`: abgebrochenes Caller-Signal
  wird vorrangig als `aborted` klassifiziert.
- `failureCountsForCircuit`: nur `timeout`, `unavailable`, `invalid_response`
  zählen, nicht `aborted`. Schwellwert drei, Öffnungsdauer 30 s.

Die Verbindung von beobachtetem Verhalten und Code stützt die Erklärung eines
nicht zählenden Caller-Abbruchs. Der interne Client-Status und Fehlerzähler
werden im Lauf nicht direkt ausgegeben. Bei gleichen Queue-/Client-Budgets
können Timer konkurrieren; keine Behauptung, jeder denkbare Timeout werde
immer als `aborted` klassifiziert oder dieser einzelne Versuch beweise jeden
internen Zwischenschritt. Kein zusätzlicher Test auf Verdacht erforderlich;
die geforderte gerichtete Folge mit zählender Kontrolle liegt vor.

Betriebsfolge für die spätere Entscheidung: nicht darauf vertrauen, dass der
Breaker wiederholte Queue-Timeouts zuverlässig dämpft. Der beobachtete Pfad
kann pro neuem Auftrag erneut bis zum Queue-Budget warten. Timeout-Wahl und
Monitoring von Timeout-Fallbacks sind daher gesondert zu bewerten.

## Abschluss

Rücknahme `restored=true, variant=l3`, Wiederherstellung `checksPassed=true`;
beide VM-Prüfungen einschließlich Testinferenz nach frischem Runtime-Start
bestanden. Kein weiteres optionales Breaker-Experiment geplant.

Gerichteter H-Queue-Nachweis mit Kontrolle abgeschlossen, mit den oben
genannten Beobachtbarkeitsgrenzen. Offen bleiben die Transportauswertung und
Schritt 4 mit Same-Host-Vergleich, Betriebsaufwand und Entscheidung.
