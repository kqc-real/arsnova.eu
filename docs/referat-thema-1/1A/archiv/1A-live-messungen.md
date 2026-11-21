# A1: Live-Messungen mit Artillery

Diese Unterlage beschreibt die in Schritt 3 ergänzte Live-Instrumentierung.
Die vollständige automatisierte Messung ist inzwischen durchgeführt;
[Versuchsreihe](./1A-versuchsreihe.md) und [Auswertung](../1A-auswertung.md)
ordnen die aktuellen Ergebnisse zu. Die Beitrittswelle belegt keine dauerhaft
500 gleichzeitig aktiven Clients.

## Lastprofil und Messgrenze

[`500-live-session.yml`](../../../../scripts/load/artillery/500-live-session.yml)
erzeugt eine Beitrittswelle mit `arrivalCount`: Jeder virtuelle Client tritt
einmal bei, baut seine Status-WebSocket-Verbindung auf und führt Quizstimme,
gegebenenfalls Q&A-Einreichung und Blitzlicht aus. Danach wartet er auf die
Ergebnisphase und beendet das Szenario. Jeder fünfte Client reicht eine
Q&A-Frage ein. Bei 500 geplanten Clients sind damit je 500 Beitritte,
Quizstimmen und Blitzlichtstimmen sowie 100 Q&A-Einreichungen vorgesehen.

Der Report beschreibt dieses Profil unter `workload` als `join-wave`, mit
`arrivalMode: "arrivalCount"`, `plannedArrivals`, `rampSeconds` und
`qaEveryNthParticipant: 5`. `continuousConcurrencyVerified: false` verhindert
eine Verwechslung mit einer konstanten Parallelität. `ARTILLERY_ARRIVAL_RATE`
steuert diese YAML-Phase nicht; maßgeblich sind Ankunftszahl und Rampendauer.
Im eigenständigen YAML-Szenario orientiert sich die Ergebnisfreigabe am Laufzustand.
Der feste Zeitplan der abgeschlossenen A1-Reihe wird durch
`run-resource-isolation.mjs` und `resource-isolation-live.mjs` umgesetzt.

Gemessen wird im Lastgenerator mit `performance.now()`, vom Start der Aktion
bis zur verarbeiteten Antwort oder zum Fehler. Enthalten sind Clientarbeit,
Transport und Serverantwort. Die Werte sind keine isolierten
Backend-Ausführungszeiten und keine Messung des Renderings im Browser.

## Messwerte lesen

Der Runner gibt seine Zusammenfassung auf der Konsole aus. Mit
`REPORT_FILE=/tmp/a1-live.json` wird zusätzlich der vorhandene standardisierte
JSON-Report geschrieben; `JUNIT_FILE=/tmp/a1-live.xml` ergänzt JUnit. Darin
liegen die Aktionen unter `metrics.layers.liveActions`:

| Schlüssel    | Gemessene Aktion     |
| ------------ | -------------------- |
| `join`       | `session.join`       |
| `vote`       | `vote.submit`        |
| `qaSubmit`   | `qa.submit`          |
| `blitzlicht` | `quickFeedback.vote` |

Jede Aktion weist die folgenden Felder aus:

| Feld                   | Bedeutung                                                                                                                  |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `applicable`           | Aktion ist für diesen Lauf vorgesehen.                                                                                     |
| `planned`              | Anzahl laut Lastprofil.                                                                                                    |
| `attempted`            | Tatsächlich gestartete Aktionen.                                                                                           |
| `succeeded`, `failed`  | Erfolgreich abgeschlossene beziehungsweise fehlgeschlagene Aktionen.                                                       |
| `skipped`              | Bewusst ohne Aufruf übersprungene Aktionen.                                                                                |
| `pending`              | Gestartete Aktionen ohne erfassten Abschluss.                                                                              |
| `notAttempted`         | Weder gestarteter noch ausdrücklich übersprungener Teil der Planung, etwa nach einem früheren Szenarioabbruch.             |
| `accountingValid`      | Zählungen und zugehörige Laufzeitstichproben sind konsistent.                                                              |
| `errorRate`            | `failed / attempted`; ohne Versuche oder bei widersprüchlicher Zählung `null`.                                             |
| `scheduledFailureRate` | Anteil der geplanten Aktionen ohne erfolgreichen Abschluss: Fehler, übersprungene, laufende und nicht gestartete Aktionen. |
| `latency`              | Laufzeiten erfolgreicher Aktionen.                                                                                         |
| `failureLatency`       | Laufzeiten fehlgeschlagener Aktionen, getrennt von den Erfolgsperzentilen.                                                 |
| `errorCodes`           | Häufigkeit bekannter tRPC-Fehlercodes; Transportfehler als `TRANSPORT_ERROR`, sonstige Fehler als `OTHER`.                 |

`latency` und `failureLatency` enthalten `available`, `samples`,
`durationSamplesMs`, `p50Ms`, `p95Ms`, `p99Ms` und `maxMs`. Rohstichproben
werden für den vollständigen Lauf ohne Rundung oder Abschneiden gespeichert.
Die Perzentile verwenden den vorhandenen Nearest-Rank-Helfer. Bei leeren
oder ungültigen Stichproben ist `available: false`; Perzentile und Maximum
sind dann `null`. Fehlende Daten erscheinen damit nicht als 0 ms.

Bekannte Fehlercodes werden aggregiert; Fehlermeldungen, Fragetexte und
Teilnehmer-Capabilities werden nicht in diese neuen Messfelder übernommen.
Der vollständige bestehende Runner-Report enthält weiterhin andere
Diagnosedaten wie Sitzungscode und lokale Artefaktpfade. Für die spätere
Evidenzablage bleibt deshalb die Bereinigung laut Versuchsvertrag nötig.

Die bisherigen HTTP-Zähler und die bestehenden Latenzpfade bleiben erhalten.
Unter `metrics.layers.latency` kommen `vote`, `qaSubmit` und `blitzlicht`
hinzu. Auch der Reconnect-Runner nutzt die neue Beitrittsmessung.

## Fehler, Ausnahmen und Gates

Eine vom Backend wegen einer inaktiven Frage abgelehnte Stimme zählt als
fehlgeschlagener Versuch. Sie erhöht zusätzlich `voteRejectedInactive`.
Nur das ausdrücklich konfigurierte Auslassen einer Stimme erhöht
`voteSkippedInactive`, ohne einen Versuch zu starten. Die übrigen Aktionen
können nach einer solchen inaktiven Quizstimme wie bisher weiterlaufen.

Bei einer angehängten Session in `RESULTS` ist die Quizstimme ausdrücklich
nicht anwendbar. Q&A und Blitzlicht bleiben vorgesehen und geprüft. Bei
weniger als fünf geplanten Clients sind keine Q&A-Einreichungen vorgesehen.
Solche Ausnahmen werden als `applicable: false` ausgewiesen; unerwartete
Aufrufe oder widersprüchliche Zählungen bestehen auch dort nicht.

Für jede vorgesehene Aktion prüft der Runner erfolgreiche Stichproben,
konsistente Zählung ohne offene Versuche und die Fehlerquote separat.
Leere Messungen bestehen diese Gates nicht. Die maximale Fehlerquote ist
inklusive: standardmäßig `failed / attempted <= 0.005`, konfigurierbar über
`ARTILLERY_LIVE_ERROR_RATE_LIMIT`. Genau 0,5 % sind damit zulässig.

Die vorhandenen Smoke-Mindestanteile bleiben bestehen: standardmäßig 95 %
erfolgreiche Beitritte (`ARTILLERY_MIN_JOIN_RATIO`) und 90 % für Quizstimmen,
Q&A und Blitzlicht (`ARTILLERY_MIN_VOTE_RATIO`). Nicht gestartete oder
übersprungene Aktionen sind in `scheduledFailureRate` sichtbar; dieses Feld
hat hier noch kein eigenes Gate. Die strengere A1-Abdeckung und der
Variantenvergleich gehören zur späteren Auswertung nach Versuchsvertrag.
Ein bestandener Smoke-Lauf ist daher noch keine bestandene A1-Variante.

Die bestehenden WebSocket- und Fan-out-Gates gelten zusätzlich weiter.
Insbesondere bleibt die bisherige WebSocket-Fehlergrenze exklusiv (`<`);
sie ist von der hier ergänzten inklusiven HTTP-Aktionsgrenze zu unterscheiden.

## Ohne Labor nachvollziehen

```bash
nvm use
npm run load:artillery:metrics:test
```

Der Befehl benötigt die installierten Projektabhängigkeiten, aber keine
Datenbank, keinen laufenden Anwendungsserver und keine KI-Modelle. Er prüft
Messwertberechnung und Gates sowie den echten Artillery-Prozessor gegen
einen lokalen HTTP-Testserver mit dem tRPC-Client des Projekts. Die
Messgrenze wird also auch bei Ablehnung, Authentifizierungsfehler und
Verbindungsabbruch durchlaufen. Ein separater Mengentest verwendet
parallel gestartete Aufrufe und prüft 2005 ungerundete Stichproben. Ein
Artefakttest prüft fehlende Werte und fehlgeschlagene Gates nach dem
Schreiben von JSON und JUnit. Temporäre Testdateien werden entfernt.

Der Befehl ist Teil von `npm test` und `npm run test:coverage`. Diese Tests
belegen die Messinstrumentierung; sie ersetzen keinen realen Lastversuch.
Die Befehle für einen Laborlauf stehen im
[Artillery-Abschnitt von TESTING.md](../../../TESTING.md#artillery-lasttest-realtime-bis-500-tn).
