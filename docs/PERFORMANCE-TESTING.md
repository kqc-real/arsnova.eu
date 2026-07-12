# Last- und Performance-Tests

Diese Seite ist das aktuelle Betriebs- und Testinventar. Strategische Gründe für die
Werkzeugwahl stehen in [ADR-0013](architecture/decisions/0013-use-k6-and-artillery-for-load-and-performance-testing.md);
die Live-SLOs stehen in
[ADR-0021](architecture/decisions/0021-separate-service-status-from-load-status-with-live-slo-telemetry.md).

## Teststufen

- **PR/Deploy-Gate:** kurze, reproduzierbare Classroom- und Browser-Smokes in
  `classroom-smokes`, `e2e` und `lighthouse`.
- **Nacht/Manuell:** protokollnahe Kapazität, Reconnect, Yjs, schwere Vote-Hotpaths
  und 5-Minuten-Soak in den Artillery-Jobs (`artillery-500`, `artillery-reconnect-500`)
  und optional `load-test`.
- **Langzeitprofil:** 30/60-Minuten-Soak mit Prozess-, Redis- und PostgreSQL-Probes
  lokal gegen `npm run dev:backend` (kein separater Staging-Server).

Lasttests niemals ungeplant gegen Produktion ausführen. Der Produktions-k6-Lauf
benötigt eine explizite Workflow-Freigabe (`run_production_load=true`).

## Letzter lokaler Gesamtlauf

Der vollständige lokale Lauf vom **2026-07-10** ist unter
[implementation/LOCAL-TESTRUN-2026-07-10.md](implementation/LOCAL-TESTRUN-2026-07-10.md)
dokumentiert. Kurzstand:

- Unit-Tests und lokalisierter Produktionsbuild bestanden.
- 19 von 21 Last-/Performance-Szenarien bestanden; Artillery Live und Reconnect
  erreichten jeweils 500/500 Teilnehmende ohne Fehler, alle k6-Profile hielten
  ihre Thresholds ein.
- Der 5-Minuten-Soak bestand mit 145 Zyklen, 2.900 Votes, 0 HTTP-Fehlern,
  HTTP-p95 17,05 ms und 6,84 MB Backend-RSS-Wachstum.
- Offen und reproduzierbar: keine Yjs-Konvergenz nach Offline-Updates/Reconnect
  sowie Vote-p95 von 2.156 ms beziehungsweise 1.466 ms im 600er
  Timer-Fairness-Lauf bei einem 1.000-ms-Gate.
- Drei von sechs Browser-Flow-Smokes und das mobile Lighthouse-Performance-Gate
  waren nicht grün.

Der [gezielte QA-Nachlauf vom 2026-07-11](implementation/LOCAL-QA-RECHECK-2026-07-11.md)
schließt diese technischen Befunde: Yjs konvergierte nach Reconnect in 6 ms,
die beiden akzeptierenden 600er Vote-Pfade hielten mit p95 766 ms und 968 ms das
1.000-ms-Gate ein, 6/6 Browser-Flows und 6/6 Lighthouse-Läufe bestanden. Als
offener Nachweis verbleiben Langzeit-Soak und Baseline-Freigabe
(siehe [PERFORMANCE-BASELINE-FREIGABE.md](implementation/PERFORMANCE-BASELINE-FREIGABE.md)).

Dieser Lauf ist ein lokaler Entwicklungsnachweis, keine freigegebene Baseline.
Insbesondere darf die bloße Existenz eines Szenarios nicht mit einem bestandenen
Nachweis gleichgesetzt werden.

Die erzeugten JSON-/JUnit-Dateien liegen lokal unter
`artifacts/local-runtime-20260710/` und werden nicht versioniert. Das
versionierte Messprotokoll enthält die für den Abgleich notwendigen Kennzahlen.

## Szenarien und Kommandos

Für die Node-Szenarien muss das Backend laufen (`npm run dev:backend`).

```bash
# Kurze Classroom-Gates, standardmäßig 30 Teilnehmende
npm run load:smoke:demo-classroom-30
npm run load:smoke:qa-classroom-30
npm run load:smoke:blitzlicht-classroom-30
npm run load:smoke:ws-vote-progress-classroom-30
npm run load:smoke:ws-reconnect-wave-classroom-30
npm run load:smoke:channel-ws-fanout-classroom-30

# Architektur-Hotpaths
CLIENTS=30 npm run load:yjs:sync
PARTICIPANTS=100 ITERATIONS=3 npm run load:freetext:wordcloud
PARTICIPANTS=200 npm run load:smoke:host-vote-progress
PARTICIPANTS=600 VOTE_P95_LIMIT_MS=1000 npm run load:smoke:vote-timer-fairness

# Realtime-Kapazität
PARTICIPANTS=500 npm run load:artillery:500
PARTICIPANTS=500 npm run load:artillery:reconnect:500

# Soak: lokal kurz, in Staging explizit länger
npm run load:soak:live-session
SOAK_DURATION_MINUTES=30 npm run load:soak:live-session
SOAK_DURATION_MINUTES=60 npm run load:soak:live-session
```

Die k6-Szenarien decken Health, Session-Join/Polling und gezielte Session-Hotpaths ab:

```bash
npm run load:k6:health
SESSION_CODE=AB12CD npm run load:k6:session
MODE=join-wave SESSION_CODE=AB12CD VUS=50 npm run load:k6:hotpaths
```

Standardmäßig gelten für k6 eine Fehlerquote unter 0,5 %, p95 unter 1 s und p99
unter 2 s. Die Skripte erlauben eine explizite Anpassung über `ERROR_RATE_LIMIT`,
`P95_LIMIT_MS`, `P99_LIMIT_MS` und `CHECK_RATE_LIMIT`. Classroom- und
Realtime-Skripte dokumentieren ihre szenariospezifischen Budgets im Dateikopf bzw.
in der `--help`-Ausgabe.

## Reports und Regressionen

Node-Szenarien schreiben bei gesetztem `REPORT_FILE` einen atomaren JSON-Report mit
dem gemeinsamen Schema:

- `schemaVersion`, `scenario`, `timestamp`, optional `gitCommit`
- explizit freigegebene `environment`-Werte
- szenariospezifische `metrics`
- maschinenlesbare `assertions`

Mit `JUNIT_FILE` entsteht zusätzlich JUnit XML. Zugangsdaten werden nicht aus der
Prozessumgebung in Reports übernommen.

```bash
REPORT_FILE=artifacts/current.json \
JUNIT_FILE=artifacts/current.junit.xml \
npm run load:smoke:demo-classroom-30

npm run load:report:compare -- \
  --current artifacts/current.json \
  --baseline baselines/demo.json \
  --config scripts/load/load-regression-budgets.example.json
```

Die Budgetdatei referenziert numerische Pfade unter `metrics`. Eine Regression
schlägt fehl, wenn sie sowohl das absolute als auch das relative Budget
überschreitet. Produktionsbaselines werden bewusst nicht automatisch aus einem
einzelnen CI-Lauf aktualisiert; sie benötigen einen geprüften Lauf in derselben
Umgebung und Lastkonfiguration.

## Soak-Metriken

Der Soak sammelt Ziel-HTTP-Latenzen, `health.stats`, Event-Loop-Verzögerung des
Lastgenerators sowie optional Backend-Prozess-, Redis- und PostgreSQL-Probes:

```bash
SOAK_BACKEND_PID=12345 \
SOAK_REDIS_URL=redis://127.0.0.1:6379 \
SOAK_DATABASE_URL=postgresql://... \
SOAK_DURATION_MINUTES=30 \
npm run load:soak:live-session
```

Nicht messbare optionale Probes werden im Report als `unavailable` markiert und
von der harten Bewertung ausgenommen. `health.stats` liefert derzeit abgeleitete
Service-/Lastzustände, aber keine rohen SLO-Perzentile. Die Event-Loop-Metrik
bezieht sich auf den Lastgenerator; Backend-RSS benötigt `SOAK_BACKEND_PID`.

Eine netzwerkfreie Konfigurationsprüfung ist mit
`SOAK_VALIDATE_ONLY=1 npm run load:soak:live-session` möglich.

Referenz aus dem lokalen 5-Minuten-Lauf vom 2026-07-10: 145 Zyklen, 2.900 Votes,
14 Reconnect-Wellen, HTTP-p95 17,05 ms, 0 Fehler und 6,84 MB
Backend-RSS-Wachstum. Weil alle Lastprofile zuvor gegen dieselbe Testdatenbank
liefen, meldete `health.stats` anfangs noch `loadStatus=overloaded`;
`serviceStatus` und die szenariospezifischen Gates blieben stabil.
