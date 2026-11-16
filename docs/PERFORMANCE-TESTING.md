# Last- und Performance-Tests

Diese Seite ist das aktuelle Betriebs- und Testinventar. Strategische Gründe für die
Werkzeugwahl stehen in
[ADR-0013](architecture/decisions/0013-use-k6-and-artillery-for-load-and-performance-testing.md);
die Live-SLOs stehen in
[ADR-0021](architecture/decisions/0021-separate-service-status-from-load-status-with-live-slo-telemetry.md).

## Issue #456: lokales Demo-Quiz-Integrationsprofil

Der Slice-8-Runner verwendet ausschließlich das kanonische Demo-Quiz und erzwingt mindestens
250 Teilnahmen mit jeweils zehn sinnvollen Q&A-Fragen zum Quiz oder zu arsnova.eu, also
mindestens 2.500 Einreichungen. Die netzwerkfreie Prüfung lautet:

```bash
npm run load:issue-456:validate
```

Der echte Lauf ist ausschließlich gegen Loopbackziele zulässig, verweigert kleinere Profile
und bildet durch den gemeinsamen Lastgenerator auch Shared NAT ab:

```bash
# separates Terminal für den lokalen Backendprozess
QA_SUMMARY_ENABLED=true npm run dev:backend

# Lastgenerator erst nach erfolgreichem Backendstart
npm run load:issue-456:run
```

Er prüft lokal den Ablauf Demo-Quiz, bestätigtes manuelles quiz-weites Lernziel, Join, Q&A,
Quiz, Blitzlicht, Kontextvorschau und versionierten Summary-Auftrag. Er darf nicht gegen
Produktion laufen. Die [fünfsprachige Modellprobe](features/qa-summary.md) prüft kurze
Q&A-Kontexte separat an der privaten Runtime. Das feste 8.192-Profil degradiert einen
zu großen Kontext kontrolliert auf die Q&A-Textbaseline oder Force-Fit-Mindestbelege.
CPU-/Prefill-/RSS-Abnahme und Messungen mit reichhaltigem Vollkontext bleiben Teil der
[Slice-8-Abnahme](implementation/ISSUE-456-SLICE-8-ABNAHME.md).

Das Summary-Flag gehört zum separat gestarteten Backend, nicht zum Lastgenerator. Ein früher
Preflight stoppt bei deaktiviertem Summary V2 noch vor Joins und Q&A-Last; bei späteren Fehlern
beendet der Runner seine neu erstellte Demo-Session idempotent.

## Epic #405: gemeinsamer Release-Nachweis für #414 und #415

Der Runner `scripts/load/qa-scale-epic405.mjs` bildet das verbindliche
Q&A-Releaseprofil ab:

- 2.500 über die Sessionlaufzeit persistierte Teilnahmeidentitäten;
- zehn Fragen je Teilnahme und damit 25.000 physisch gespeicherte Fragen;
- einen deterministischen deutschen Fachkorpus für eine Mitarbeitervollversammlung
  statt technischer Platzhaltertexte;
- 10.360 gerichtete Bewertungen auf sechs hervorgehobenen Fragen mit robusten
  Mehrheiten und nahezu ausgeglichenen Kontroversen;
- exakt 500 gleichzeitig aktive, teilnahmegebundene tRPC-WebSocket-Clients;
- API-p95 strikt unter 1.000 ms und API-p99 strikt unter 2.000 ms;
- technische Fehlerquote je kritischer API-Klasse strikt unter 0,5 Prozent;
- höchstens 256 KiB serialisierter UTF-8-Anwendungspayload und höchstens 100
  Listeneinträge je HTTP-Antwort, WS-Nachricht, Seite oder Snapshot;
- Reconnect-p95 bis zur Anwendung der Zielrevision höchstens drei Sekunden,
  Maximum höchstens zehn Sekunden und 500 von 500 erfolgreichen Clients.

Das Profil ist absichtlich nicht auf kleinere Zahlen umstellbar. Concurrency
und Stichprobengrößen stehen in
`scripts/load/qa-scale-epic405.config.json`, die fachlichen Releasegrenzen
werden bei der Validierung jedoch gegen feste kanonische Werte geprüft.

### Netzwerkfreie Validierung und Unit-Tests

```bash
npm run load:qa-scale:test
npm run load:qa-scale:validate
```

`--validate` liest nur die lokale JSON-Konfiguration und wertet
Laufzeitparameter aus. Es öffnet keine HTTP-, WebSocket-, PostgreSQL- oder
Redis-Verbindung. Ein Lauf ohne explizites `--validate`, `--release` oder
`--soak` schlägt fehl; dadurch kann das große Profil nicht versehentlich
gestartet werden.

Eine abweichende Konfiguration kann ebenfalls rein lokal geprüft werden:

```bash
node scripts/load/qa-scale-epic405.mjs --validate --config /pfad/profil.json
```

### Release-Lauf

Der Lauf ist ausschließlich für eine isolierte, migrationsaktuelle und
löschbare Referenzumgebung vorgesehen. Er erzeugt den gesamten Bestand über
die tRPC-API; es gibt keinen direkten DB-Seed. Nach dem Seed prüft er die
Bestände erneut über Host-Aggregat, vollständige revisionsgebundene
Teilnehmerseiten, Q&A-Kontingente und vollständige Q&A-Pagination für `TOP`,
`BEST` und `CONTROVERSIAL`. Der Textgenerator kombiniert zwanzig Themen aus
Arbeitsbedingungen, Vergütung, Beschäftigungssicherung, Digitalisierung,
Mitbestimmung, Qualifizierung und Nachhaltigkeit mit Organisationseinheiten
und Zeithorizonten. Sechs feste Leitfragen erhalten reproduzierbare
Hot-Spot-Votes. Damit muss `TOP`/`BEST` eine breit unterstützte Transparenzfrage
und `CONTROVERSIAL` die nahezu hälftig bewertete Vorstandsbonusfrage anführen.

```bash
TRPC_URL=https://lasttest.example.invalid/trpc \
WS_URL=wss://lasttest.example.invalid \
ADMIN_DIAGNOSTIC_SECRET='separates-starkes-diagnose-secret' \
QA_SCALE_DIAGNOSTIC_TRPC_URLS='https://backend-1.example.invalid/trpc,https://backend-2.example.invalid/trpc' \
QA_SCALE_REPORT_FILE=artifacts/load/qa-scale-epic405.json \
QA_SCALE_JUNIT_FILE=artifacts/load/qa-scale-epic405.xml \
npm run load:qa-scale:release
```

`QA_SCALE_DIAGNOSTIC_TRPC_URLS` nennt bei mehreren Backendinstanzen deren
direkte Diagnoseziele. Der Runner summiert die serverseitig gebundenen
Verbindungen und verlangt vor und nach der Reconnect-Welle exakt 500. Wird
die Variable weggelassen, dient `TRPC_URL` als einziges Diagnoseziel.
Mehrere Diagnoseziele sind kein Produktions-Mehrinstanzbetrieb; die aktuelle
Eininstanzgrenze und der Plan stehen in
[operations/MULTI-INSTANCE-PLAN.md](operations/MULTI-INSTANCE-PLAN.md).

Der Ablauf prüft unter anderem:

1. 2.500 Erstbeitritte mit eigenem CSPRNG-`joinIdempotencyKey` und
   begrenzten Host-Join-Snapshots statt vollständiger Teilnehmerlisten;
2. 500 capability-gebundene Rejoins ohne neue Teilnahmeidentität;
3. 25.000 capability-authentifizierte `qa.submit`-Aufrufe mit eigenem
   CSPRNG-`idempotencyKey`;
4. Retry eines bekannten Submit-Schlüssels mit derselben Frage,
   `replayed: true` und unverändertem Kontingent;
5. genau eine erwartete Limit-Ablehnung für den zusätzlichen Submit;
6. genau 10.360 capability-authentifizierte Up- und Downvotes ohne Selbst- oder
   Doppelvote sowie die erwarteten Spitzen für `TOP`, `BEST` und
   `CONTROVERSIAL`;
7. Teilnehmer-Paging/-Suche, Q&A-Paging/-Suche, Host-Moderation und
   `health.stats`;
8. den serverseitig aus dem vollständigen Bestand gerankten Wortwolkenkorpus
   mit exakt 500 von 25.000 berücksichtigten Fragen sowie einen weiteren
   Analysejob parallel zu Ratings, Moderation und Statusabrufen;
9. Q&A-Fan-out und die koordinierte 500er-Reconnect-Welle;
10. genau eine erwartete Frist-/Kanalablehnung nach dem abschließenden Schließen
    des Q&A-Kanals.

Für den Reconnect zählt weder Socket-Open noch `onStarted`. Jeder Client
abonniert nach dem Reconnect `qa.onQuestionsUpdated` mit seiner
`participantCapability`, verarbeitet die inhaltslose Invalidierung und lädt
die begrenzte Q&A-Seite erneut. Erst wenn diese Seite im Harness-State
angewendet wurde, gilt der Resubscribe als abgeschlossen. Danach löst der
Runner gezielt eine Q&A-Mutation aus; deren neue `rankingRevision` wird über
einen Host-Snapshot serverseitig bestätigt. Endzeitpunkt je Client ist erneut
die Anwendung genau dieser oder einer neueren Revision nach dem begrenzten
Resync. Die gemessene Dauer beginnt für alle Clients mit der gemeinsamen
Freigabe der Reconnect-Welle.

Die API-Klassen `JOIN_REJOIN`, `PARTICIPANT_QUERY`, `QA_PAGE`, `QA_SUBMIT`,
`QA_RATING`, `QA_MODERATION` und `HEALTH_STATS` werden getrennt ausgewertet.
Erwartete fachliche Ablehnungen besitzen einen eigenen Nenner und eigene
p95-/p99-Werte; Typ und beobachteter tRPC-Statuscode werden getrennt im
Report gezählt. Fehlende Stichproben, unbekannte Zielrevisionen, ein
unvollständiger Bestand oder ein vorzeitig abgebrochener Lauf sind rote Gates;
der Runner erzeugt dafür keinen grünen Ersatzwert.

Für Teilnehmer- und Q&A-Queries wertet der Runner zusätzlich die geschützte,
serverseitig gemessene Request-Hülle aus. Deren p95 muss bei höchstens 250 ms
liegen. Da diese Messung Datenbankzeit und Server-Overhead umfasst, ist sie
eine konservative Obergrenze für das geforderte DB-p95 und kein
Lastgenerator-Ersatzwert.

### Optionaler 60-Minuten-Soak

`--soak` führt zuerst denselben vollständigen Release-Lauf aus. Danach folgen
Warm-up, verpflichtende Baseline und exakt 60 Minuten Messlast:

```bash
TRPC_URL=https://lasttest.example.invalid/trpc \
WS_URL=wss://lasttest.example.invalid \
ADMIN_DIAGNOSTIC_SECRET='separates-starkes-diagnose-secret' \
DATABASE_URL='postgresql://...' \
REDIS_URL='rediss://...' \
QA_SCALE_BACKEND_PROBE_URLS='https://backend-1.example.invalid/internal/runtime,https://backend-2.example.invalid/internal/runtime' \
QA_SCALE_BACKEND_PROBE_TOKEN='separates-probe-token' \
npm run load:qa-scale:soak
```

Jedes Backend-Probeziel muss pro Abruf ein minimales JSON-Objekt liefern:

```json
{
  "instanceId": "backend-1",
  "rssBytes": 734003200,
  "eventLoopP99Ms": 18.4
}
```

Die Probe muss direkt die jeweilige Backendinstanz messen. Ein
Eventloop-Wert des Lastgenerators genügt nicht. Direkt nach dem Warm-up
erfasst der Runner die RSS-Baseline je `instanceId`; das maximale Wachstum
bis zum Laufende darf je Instanz 256 MiB nicht überschreiten und
Backend-Eventloop-p99 muss höchstens 200 ms bleiben. PostgreSQL `SELECT 1`
und Redis `PING` werden im selben Probenraster erfasst. Fehlende,
fehlgeschlagene oder doppelt auf dieselbe `instanceId` zeigende
Backendproben lassen das Gate scheitern; die DB-Probe muss zusätzlich p95
von höchstens 250 ms halten.

### Reports und Geheimnisse

JSON- und optionale JUnit-Reports werden atomar geschrieben. Sie enthalten
nur die freigegebenen Profilwerte, Ziel-Origins, Zähler, Perzentile,
Payloadgrößen und Gateergebnisse. Host-, Teilnehmer-, Diagnose- und
Probe-Tokens sowie `DATABASE_URL` und `REDIS_URL` werden nicht übernommen.
Die Berichtserzeugung liest auch nicht pauschal `process.env`.

Sessioncodes, Host-Credentials und Teilnehmer-Capabilities bleiben nur im
Arbeitsspeicher des Lastgenerators. Der Lauf sollte trotzdem ausschließlich
in einer kurzlebigen Umgebung stattfinden, weil er absichtlich 2.500
Teilnahmen und 25.000 Fragen persistiert.

Dieser Runner deckt die serverseitigen/API-/Realtime-Gates ab. Die in #414
zusätzlich geforderten Browsernachweise für INP, Mobile, Reflow und
`prefers-reduced-motion` bleiben separate UI-/Browser-Abnahmen und werden
nicht als bestanden ausgegeben.

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

Die verbindlichen Produkt-SLOs und der vollständige, operatorgesteuerte
§6.5-Abnahmepfad stehen in
[S6.5-SECURITY-LOAD-ACCEPTANCE.md](implementation/S6.5-SECURITY-LOAD-ACCEPTANCE.md).
`npm run load:security-acceptance:validate` prüft Konfiguration und
Orchestrator netzwerkfrei. Ein Zielhostlauf ist kein PR-Check und bleibt ohne
separate Freigabe gesperrt.

## Manuelle sichere Ausführung

Nach einem autorisierten Push des zu prüfenden Branches startet dieser
Workflow-Dispatch beide isolierten Artillery-Jobs mit 500 Teilnehmenden, aber
ausdrücklich **keinen** Produktions-k6-Lauf:

```bash
gh workflow run ci.yml \
  --ref security/pr128-followup \
  -f artillery_participants=500 \
  -f artillery_ramp_seconds=60 \
  -f run_production_load=false

run_id="$(gh run list --workflow ci.yml --branch security/pr128-followup \
  --event workflow_dispatch --limit 1 --json databaseId --jq '.[0].databaseId')"
gh run watch "$run_id"
```

Beide Artillery-Jobs erzeugen intern je ein separates, maskiertes
`ADMIN_DIAGNOSTIC_SECRET` mit `openssl rand -hex 32`; weder
`ADMIN_SECRET` noch das Diagnose-Secret werden als Workflow-Input oder Report
übergeben.

Der Workflow-k6-Job ist hart auf `https://arsnova.eu` verdrahtet und darf für
diesen Security-Nachweis nicht aktiviert werden. Dasselbe Profil läuft sicher
gegen ein lokales Backend:

```bash
npm run docker:up:dev
npm run prisma:migrate
npm run dev:backend
# In einem zweiten Terminal:
BASE_URL=http://127.0.0.1:3000 VUS=50 DURATION=30s npm run load:k6:health
```

Vor jedem Lauf Ziel-URL und Branch prüfen. `run_production_load=true` bleibt
einer separat freigegebenen Produktionsmessung vorbehalten.

## Lokale Gesamtläufe

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
offener Nachweis verbleiben Langzeit-Soak und Baseline-Freigabe — **erledigt**
am 2026-07-12 ([LOCAL-BASELINE-FREIGABE-2026-07-12.md](implementation/LOCAL-BASELINE-FREIGABE-2026-07-12.md)).

Der Lauf vom 2026-07-10 ist ein lokaler Entwicklungsnachweis. Die anschließende
Baseline wurde separat am 2026-07-12 freigegeben; die bloße Existenz eines
Szenarios darf nicht mit einem bestandenen Nachweis gleichgesetzt werden.

Die erzeugten JSON-/JUnit-Dateien liegen lokal unter
`artifacts/local-runtime-20260710/` und werden nicht versioniert. Das
versionierte Messprotokoll enthält die für den Abgleich notwendigen Kennzahlen.

### Demo-Classroom-Dauerlauf 2026-07-27

Der Dauerlast-Slice aus PR
[#165](https://github.com/kqc-real/arsnova.eu/pull/165) ist **implementiert und
lokal validiert**. Der manuell gestartete 10-Minuten-Lauf gegen das lokale Backend
erzielte:

- 48 vollständige Demo-Classroom-Runden und 1.440 Joins;
- 14.400/14.400 erfolgreiche Votes;
- 19.104 HTTP-Aufrufe ohne Fehler;
- HTTP-p95 59,62 ms und p99 83,78 ms;
- Redis- und PostgreSQL-Probes jeweils 121/121 erfolgreich;
- 21/21 maschinenlesbare Gates bestanden.

Das ist ein zusätzlicher lokaler Dauerlastnachweis, kein PR-/Deploy-Gate und
keine S6.5-Formalabnahme. Skript und Reportlogik werden mit PR #165
bereitgestellt.

### Hotpath-Audit und Timing-Gegenüberstellung 2026-10-22

Der [Hotpath-Audit- und Timing-Nachlauf vom 2026-10-22](implementation/HOTPATH-AUDIT-UND-TIMING-2026-10-22.md) dokumentiert die Bündelung verbleibender uncached DB-Reads vor `currentQuestionCache` (`studentQuestionSessionCache`, `getParticipantTimerAccommodationCached`), in `getPersonalScorecard`/`getPersonalResult` (`personalScorecardSessionCache`, `personalResultSessionCache`), in `fetchHostVoteProgress` (`hostVoteProgressSessionCache`), im `vote.submit`-Capability-Pfad (`participantCapabilityCache` inkl. Join-Prewarming) und im Q&A-Realtime-/Listen-Pfad (`loadQaSubscriptionSessionSnapshot`, `loadQaParticipantCount`, `loadQaOwnQuestionQuota`) sowie die Gegenüberstellung aller 13 ausgeführten Smoke- und Lasttests mit den historischen Baselines (`ACTIVE` 600 TN `p95`: `788 ms` → **`650 ms`**, 2s-Karenz `p95`: `992 ms` → **`720 ms`**, Reject `p95`: `718 ms` → **`396 ms`**, 500 TN Host-Pairing Cap-Load `p95`: **`618 ms`** bei `0` Fehlern).

### Vote-Countdown mit 500 gleichzeitigen Stimmen und kaltem Cache (2026-11-16)

Das gestaffelte Vorladen senkte die Bildlast pro Countdown und 500 Geräten von
**353,0 MB auf 18,9 MB**. In den Kontrollmessungen bei 1 Gbit/s ließ sich der
anfangs höhere Vote-p95 nicht reproduzieren. Die Streuung der Backend-Zeiten
war im A/A-Vergleich mit identischem Stand teilweise größer als der frühere
Ausschlag.

#### Aufbau und Varianten

- Lokales Produktions-Backend auf Apple M2 Pro (macOS, Node 24.21.0) mit
  PostgreSQL 16 und Redis 7.4 mit AOF in getrennten Testcontainern. Der
  PostgreSQL-Pool nutzte den Standard von 40 Verbindungen.
- Pro Lauf traten 500 Teilnehmende über tRPC mit eigenen Capabilities und
  derselben Quelladresse bei. Der Lastgenerator sandte für eine
  Single-Choice-Frage mit einem Neun-Sekunden-Timer 500 einzelne
  `vote.submit`-Aufrufe in einer Welle. Die Welle war 100 ms nach Eintritt in
  die jeweilige Restsekunde angesetzt. Der Lastgenerator forderte die sechs
  statischen Bilder pro simuliertem Client in jedem Lauf ohne Cache an. Er
  spielte die Abrufpläne gegen denselben Backend-Build ab.
- Ein lokaler Reverse-Proxy begrenzte die gemeinsame Übertragung der
  Antwortdaten auf 1 Gbit/s oder 250 Mbit/s und verteilte sie in
  Stücken bis 8 KiB auf die offenen Antworten. Die Messung reichte vom Start
  des Vote-Aufrufs bis zum Empfang der vollständigen Antwort über HTTP/1.1
  mit Keepalive und ohne TLS. Die Zahlen beschreiben einen protokollnahen Vergleich
  mit simuliertem Link. Eine Lastabnahme mit 500 Browsern, WebSocket-Fan-out
  und einem realen Hörsaal-WLAN war nicht Teil dieser Messung.

| Stand                     | Abrufplan bei einem 9-Sekunden-Timer                                                                       | Bilddaten für 500 Geräte | Größte Abrufwelle |
| ------------------------- | ---------------------------------------------------------------------------------------------------------- | -----------------------: | ----------------: |
| Ursprünglich (`74608ca7`) | Ein PNG je Restsekunde von 5 bis 0                                                                         |                 353,0 MB |           74,1 MB |
| Doppeltes Vorladen        | Zwei PNGs bei 7 Sekunden, weitere bei 5 bis 2 Sekunden                                                     |                 353,0 MB |          136,0 MB |
| Gestaffelt                | Ab Fragenstart ein kleines WebP alle 320 ms, bei 9,00 / 8,68 / 8,36 / 8,04 / 7,72 / 7,40 Sekunden Restzeit |                  18,9 MB |            4,0 MB |

Das Vorladen im Vote beginnt ab höchstens zehn Sekunden Restzeit. Die Bilder
sind für die 48 CSS-Pixel breite Anzeige in dreifacher Auflösung ausgelegt.
Chromium und WebKit wurden separat auf einen flackerfreien Wechsel und den
Zahlenersatz bei einem simulierten Bildfehler geprüft. Der
[Artillery-Live-Test](../scripts/load/artillery/500-live-session.yml) deckt
andere Live-Pfade ab und lädt die Countdown-Bilder nicht.

#### Erste Lastmessung und Wiederholung nach der Staffelung

Je Messreihe liefen drei Vergleichspaare pro Absendezeitpunkt bei 1 Gbit/s und
zwei bei 250 Mbit/s. Beide Messreihen umfassten je 20 Läufe in wechselnder
Reihenfolge und 10.000 von 10.000 gespeicherten Stimmen. Die Tabellenwerte
sind die zusammengefassten Perzentile p50 / p95 / p99 in Millisekunden.
Der ursprüngliche Stand wurde in beiden Reihen erneut gemessen.

| Testlink   | Restzeit | Ursprünglich, erste Messung | Doppeltes Vorladen | Ursprünglich, Wiederholung |      Gestaffelt |
| ---------- | -------: | --------------------------: | -----------------: | -------------------------: | --------------: |
| 1 Gbit/s   |      5 s |             375 / 491 / 511 |    411 / 561 / 588 |            336 / 451 / 477 | 346 / 526 / 550 |
| 1 Gbit/s   |      7 s |             371 / 489 / 510 |    463 / 596 / 611 |            320 / 441 / 465 | 336 / 477 / 498 |
| 250 Mbit/s |      5 s |             507 / 701 / 715 |    755 / 928 / 942 |            481 / 634 / 653 | 378 / 512 / 529 |
| 250 Mbit/s |      7 s |             412 / 561 / 575 |    697 / 847 / 863 |            361 / 493 / 506 | 372 / 499 / 516 |

Beim doppelten Vorladen waren bei sieben Sekunden bis zu 1.000 Bildabrufe offen.
Bei 250 Mbit/s überlappten die Bildwellen. Bei fünf Sekunden waren noch 1.488
bis 1.497 Abrufe offen, gegenüber 500 im ursprünglichen Stand. In der
gestaffelten Variante waren alle sechs Bildwellen an beiden Absendezeitpunkten
abgeschlossen. Trotzdem lag der zusammengefasste p95 bei 1 Gbit/s noch über
dem in derselben Messreihe erfassten ursprünglichen Stand. Das war der Anlass
für die Kontrollmessung.

#### Kontrollmessung bei 1 Gbit/s

Pro Absendezeitpunkt wurden sechs A/B-Paare (ursprünglich und gestaffelt) und
vier eingestreute A/A-Paare (zweimal ursprünglich) in wechselnder Reihenfolge
gefahren. Alle **20.000 Stimmen aus 40 Läufen** wurden gespeichert. Die Einheit
für die mittlere p95-Differenz und das gepaarte 95-%-t-Intervall ist die
500er-Welle. Negative Differenzen bedeuten niedrigere Latenz für den
gestaffelten Stand gegenüber dem ursprünglichen Stand.

| Restzeit | Gepoolt ursprünglich (p50 / p95 / p99) | Gepoolt gestaffelt (p50 / p95 / p99) | Mittlere p95-Differenz pro A/B-Paar |     95-%-Intervall | A/A-p95-Differenzen je Paar      |
| -------- | -------------------------------------: | -----------------------------------: | ----------------------------------: | -----------------: | -------------------------------- |
| 5 s      |                     383 / 494 / 517 ms |                   348 / 472 / 513 ms |                            −32,6 ms | −80,2 bis +14,9 ms | −5,2 / +27,9 / −13,1 / +176,3 ms |
| 7 s      |                     350 / 468 / 485 ms |                   328 / 460 / 496 ms |                            −17,9 ms | −68,0 bis +32,2 ms | +54,0 / +14,2 / −66,4 / +10,7 ms |

- Der gestaffelte Stand war in 10 von 12 A/B-Paaren beim Vote-p95 schneller.
  Alle Bilder waren vor dem Absenden geladen. Bei sieben Sekunden war der
  letzte Bildabruf mindestens 446 ms vor der Stimmabgabe abgeschlossen.
- Der p95 der Proxy-Wartezeit (fertige Backend-Antwort bis zum ersten
  Schreiben über den gedrosselten Link) sank bei fünf Sekunden im Mittel
  um 28,5 ms. Bei sieben Sekunden lag er in beiden Ständen bei rund 2,2 ms.
- Das stärkste A/A-Paar bei fünf Sekunden lag trotz identischem Stand bei
  449 gegenüber 626 ms Vote-p95. Die Wartezeit für den PostgreSQL-Checkout
  stieg dabei von 325 auf 485 ms (jeweils p95). Gemessen wurde die Zeit vom
  Anfordern einer Verbindung bis zur Übergabe an die Anwendung, einschließlich
  der Planung des Callbacks. Die Proxy-Wartezeit sank gleichzeitig von 32 auf
  26 ms.

Die Wiederholung liefert keinen Hinweis auf eine reproduzierbare
Latenzregression durch die gestaffelten Bildabrufe. Die Backend-Streuung bei
gleichzeitig eintreffenden Stimmen erklärt, wie der frühere Ausschlag auch
nach Abschluss der Bildabrufe zustande kommen konnte. Kleinere Effekte bleiben
bei diesen Stichproben offen. Über alle drei Messreihen wurden 40.000 Stimmen
gespeichert und 240.000 Bildantworten geprüft. Die großen lokalen Rohprotokolle
bleiben außerhalb des Repos.

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
npm run load:smoke:host-pairing-security
npm run load:smoke:host-pairing-classroom-30
PARTICIPANTS=500 npm run load:smoke:host-pairing-cap-500

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

Das lokale Q&A-Classroom-Szenario verwendet weiterhin ein
`SUBMIT_P95_LIMIT_MS` von 1.000 ms. Der CI-Workflow setzt für denselben
30-Personen-Funktionssmoke explizit 1.500 ms, um Schwankungen geteilter
GitHub-Runner von funktionalen Fehlern zu trennen. Für belastbare
Leistungsaussagen gelten weiterhin die dedizierten Lastprofile und ihre
strengeren, versionierten Budgets.

## Demo-Classroom-Dauerlast mit Monitoring

> **Verfügbarkeit:** Der Runner läuft ausschließlich manuell lokal und ist kein
> CI-/PR-Gate.

Der lokale Dauerlauf führt bis zum Zeitbudget ausschließlich vollständige
Demo-Quiz-Classrooms durch. Standard sind zehn Minuten und 30 Teilnehmende pro
Classroom. Wenn für eine weitere vollständige Runde erkennbar nicht genug Zeit
bleibt, beginnt eine kontrollierte Cooldown-Phase bis zum Messende. Der Lauf ist
hart auf `localhost`/Loopback begrenzt.

Voraussetzungen:

1. Node gemäß `.nvmrc`, PostgreSQL und Redis:
   `npm run docker:up:dev && npm run prisma:migrate`.
2. Backend mit demselben mindestens 32 Zeichen langen
   `ADMIN_DIAGNOSTIC_SECRET` starten, das dem Lasttest nur als
   Umgebungsvariable übergeben wird. Das Secret weder als CLI-Argument noch in
   Reports oder Logs schreiben.
3. Optional `DEMO_BACKEND_PID`, `DEMO_REDIS_URL` und `DEMO_DATABASE_URL` für
   RSS-, Redis- und PostgreSQL-Probes setzen. Konfigurierte Probes sind harte
   Gates und müssen ohne Fehler messbar sein.

```bash
# Terminal 1
npm run dev:backend

# Terminal 2; Secret zuvor sicher in die Umgebung laden
REPORT_FILE=artifacts/demo-duration-10m.json \
JUNIT_FILE=artifacts/demo-duration-10m.junit.xml \
DEMO_BACKEND_PID=<backend-pid> \
DEMO_REDIS_URL=redis://127.0.0.1:6379 \
DEMO_DATABASE_URL='postgresql://…' \
npm run load:duration:demo-classroom
```

Konfiguration: `DEMO_DURATION_MINUTES` (Default `10`), `PARTICIPANTS`
(Default `30`), `DEMO_MONITOR_INTERVAL_MS` (Default `5000`) sowie
`DEMO_HTTP_P95_LIMIT_MS` (Default `2000`). Mit
`npm run load:duration:demo-classroom:test` läuft die fokussierte,
netzwerkfreie Prüfung der Auswertungslogik.

Der JSON-Report enthält die vollständige PRE-/DURING-/POST-Zeitreihe von
`health.check`, `health.stats` und dem diagnosegeschützten
`health.securityStats`, alle Classroom-Ergebnisse, HTTP-Latenzen,
Infrastruktur-Probes und maschinenlesbare Assertions. JUnit enthält dieselben
Gates. Rollierende 60-Sekunden-Werte werden nicht als exakte kumulative Zähler
behandelt: Lastsignale müssen sichtbar und durch die erzeugte Last begrenzt
sein; unerwünschte Security-Signale dürfen gegenüber PRE nicht steigen. Die
10-Sekunden-Randbucket- und 5-Sekunden-Flush-Toleranz aus dem
[Monitoring-Runbook](operations/MONITORING-RUNBOOK.md) wird damit berücksichtigt.

Das Reconnect-Profil bindet jede physische Teilnehmer-Verbindung mit
Session-Code und der beim Join ausgegebenen UUID. Vor der Neuverbindung wartet
es wie der Produktclient 500 ms plus zufällige 0–349 ms; weitere automatische
Versuche verwenden exponentielles Backoff bis 10 s mit demselben Jitter.
Formales W2.3b-Gate sind mindestens 95 % erfolgreiche Reconnects innerhalb von
30 Sekunden. Fachlicher `RESULTS`-Fan-out und Subscription-Fehler bleiben
zusätzliche, getrennt ausgewiesene Qualitätsmetriken.

Der Yjs-Lauf prüft initiale und konkurrierende Updates, trennt standardmäßig
20 % der Clients, erzeugt während der Offline-Phase weitere Änderungen und
fordert nach Reconnect einen gemeinsamen State Vector. Die W2.2-Grenzen sind
raum-/global bzw. verbindungsbezogen, nicht IP-basiert. Der 30-Client-Lauf ist
das bestehende Merge-Gate; höhere Raumlasten sind separate
Skalierungscharakterisierung und dürfen nicht ohne eigene Baseline zum Gate
erklärt werden.

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
