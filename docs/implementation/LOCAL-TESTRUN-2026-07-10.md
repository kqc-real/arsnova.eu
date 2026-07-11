# Lokaler Gesamt-Testlauf vom 2026-07-10

> **Historischer Messstand:** Die hier dokumentierten roten Befunde wurden im
> [gezielten QA-Nachlauf vom 2026-07-11](LOCAL-QA-RECHECK-2026-07-11.md)
> reproduzierbar behoben. Dieses Protokoll bleibt als unveränderte Ausgangsmessung
> erhalten.

## Zweck und Einordnung

Dieser Lauf prüfte die aktuelle Unit-, Build-, Browser-, Last- und
Performance-Testbasis gemeinsam gegen eine lokale Laufzeitumgebung. Er ist ein
reproduzierbarer Entwicklungsnachweis, aber keine Produktions- oder
Staging-Baseline: Hardware, Prozessmodell, Netzwerk und statische Auslieferung
weichen von der Zielumgebung ab.

## Messumgebung

- macOS, Node.js 20.19
- PostgreSQL und Redis aus dem lokalen Docker-Compose-Setup
- separate Datenbank `arsnova_v3_perf_test`; vorhandene Entwicklungsdaten wurden
  nicht verändert
- Backend: HTTP `:3000`, tRPC-WebSocket `:3001`, Yjs-WebSocket `:3002`
- Frontend: lokalisierter Produktionsbuild über `serve:localize:api` auf `:4200`
- k6 über `grafana/k6` in Docker
- Lastreports: `artifacts/local-runtime-20260710/` (lokal, git-ignoriert)

Die Lastszenarien liefen nacheinander gegen dieselbe Testdatenbank. Deshalb zeigte
`health.stats` während des späteren Soaks anfangs noch `loadStatus=overloaded`
aufgrund vorheriger Testsessions. `serviceStatus` blieb stabil; die
szenariospezifischen Soak-Metriken waren fehlerfrei.

## Zusammenfassung

- Unit-Tests: **1.310/1.310 bestanden**
  - Backend: 399 Tests in 45 Dateien
  - Frontend: 911 Tests in 62 Dateien
- lokalisierter Frontend-Produktionsbuild: **bestanden**
- Last-/Performance-Szenarien: **19/21 bestanden**
- Browser-Flow-Smokes: **3/6 bestanden**
- Word-Cloud-Benchmark: **bestanden**
- Lighthouse-Hard-Gate: **fehlgeschlagen**

## Bestandene Last- und Performance-Nachweise

### Classroom, Realtime und fachliche Hotpaths

- Demo-Quiz, Q&A, Blitzlicht, WS-Vote-Progress, WS-Reconnect und
  Q&A-/Blitzlicht-Fan-out mit jeweils 30 Teilnehmenden
- Freitext/Word-Cloud mit 100 Teilnehmenden und drei Runden
- Host-Vote-Progress mit 200 Teilnehmenden
- Node-Health mit 50 parallelen Nutzern: 4.638 Requests, 0 Fehler, p95 3,36 ms
- Node-Session mit 50 parallelen Nutzern: 7.846 Samples, 0 Fehler, p95 3,51 ms
- 500 parallele Status-Subscriptions: 500 geöffnet, 0 Fehler

Der erste WS-Vote-Lauf scheiterte erst nach fachlich erfolgreicher Ausführung an
einer undefinierten Report-Variable. Nach Korrektur des Testharness bestand der
Wiederholungslauf. Beim Reconnect-Smoke wurde außerdem die Zahl erfolgreich
gestarteter Subscriptions vor dem Cleanup erfasst; der Wiederholungslauf meldete
30/30.

### Artillery

- Unified Live-Session: 500/500 Joins, Votes und WebSocket-Verbindungen,
  0 Fehler; Host sah 500 Votes und `RESULTS`
- Reconnect-Welle: 500/500 Reconnects, 0 Fehler, 500/500 sahen `RESULTS`;
  Reconnect maximal 13 ms

### k6

Alle verbindlichen Thresholds bestanden:

- Health, 50 VUs: p95 4,60 ms, 0 % Fehler
- Session Join/Polling, 50 VUs: p95 4,50 ms, 0 % Fehler
- Join-Welle, 500 VUs: p95 11,25 ms, 0 % Fehler
- aktive Frage, 500 VUs: p95 186,52 ms, 0 % Fehler
- Vote-Spike, 500 VUs: p95 874,32 ms, 0 % Fehler

### Fünf-Minuten-Soak

- 145 Zyklen, 2.900 Quick-Feedback-Votes
- 14 Reconnect-Wellen mit jeweils fünf Clients
- 3.515 HTTP-Samples, 0 Fehler, p95 17,05 ms
- Backend-RSS: +6,84 MB, Peak 187,13 MB
- Redis-PING: p95 5,37 ms, 0 Fehler
- PostgreSQL `SELECT 1`: p95 5,20 ms, 0 Fehler
- Lastgenerator-Event-Loop: p99 21,53 ms

Alle Soak-Gates bestanden.

## Reproduzierbar fehlgeschlagene Last-Gates

### Yjs-Reconnect-Konvergenz

30 Clients konvergierten initial in 3 ms. Nach Offline-Updates und Reconnect von
sechs Clients meldeten alle Provider innerhalb von rund 335 ms wieder Sync, die
Dokumente erreichten jedoch weder im regulären 15-Sekunden-Lauf noch im
Wiederholungslauf mit 30 Sekunden denselben State Vector.

Das ist bis zur Ursachenklärung ein blockierender Befund für die Aussage
„Yjs-Reconnect unter Mehrclient-Last bestanden“. Zu unterscheiden sind ein
Testmodellfehler und ein echter Verlust beziehungsweise eine dauerhaft
divergierende Zusammenführung von Offline-Updates.

### Vote-Timer-Fairness mit 600 Teilnehmenden

Die fachliche Karenzlogik war korrekt:

- `ACTIVE`: 600/600 Votes akzeptiert
- innerhalb der Backend-Karenz: 600/600 akzeptiert
- außerhalb der Karenz: 600/600 erwartungsgemäß abgewiesen

Das harte p95-Budget von 1.000 ms wurde jedoch überschritten:

- `ACTIVE`: p95 **2.156 ms**
- innerhalb der Karenz: p95 **1.466 ms**

Der Lauf ist deshalb trotz korrekter Fachlogik als fehlgeschlagen zu bewerten.

## Browser- und Frontend-Ergebnisse

Bestanden:

- Host-Musik
- Quiz-Sync zwischen zwei Browserkontexten
- Unified Session mit Quiz, Q&A, Blitzlicht und Presenter

Auch nach isolierter Wiederholung fehlgeschlagen:

- Host-Ansicht aktualisiert die Teilnehmerzahl nach Join nicht live auf 1
- Teilnehmer erhält die gestartete `SHORT_TEXT`-Frage nicht
- Numeric-Estimate-Ergebnisansichten zeigen erwartete eigene Runde-2-Auswertung,
  Toleranzband-Treffer und Rundenvergleich nicht zuverlässig

Die API-seitigen Schritte der Numeric-Estimate-Simulation waren erfolgreich;
der Fehler liegt in der browserseitigen Ergebnisdarstellung oder deren
Testvertrag.

Der Word-Cloud-Benchmark bestand. Die Aggregation von 2.800 Antworten lag bei
p95 8,03 ms. Beim größten mobilen Layout mit 300 Wörtern lag p95 bei 256,8 ms;
26 % der Wörter konnten platziert werden.

## Lighthouse

Der lokalisierte Produktionsbuild wurde je dreimal für `/de/` und `/en/` mit
dem mobilen Lighthouse-Profil gemessen. Beide URLs verfehlten dieselben
verbindlichen Gates:

- Performance-Score: **0,55**, gefordert mindestens 0,60
- Largest Contentful Paint: rund **11,1 s**, gefordert höchstens 4 s

Accessibility, CLS und TBT erzeugten keine Gate-Verletzung. Die Messung nutzte
einen einfachen lokalen statischen Server ohne produktionsspezifische
Kompression oder CDN-Eigenschaften; das erklärt mögliche Abweichungen, hebt das
lokale CI-nahe Gate-Ergebnis aber nicht auf.

## Konsequenzen

Vor einer freigegebenen Baseline sind mindestens diese Punkte zu bearbeiten:

1. Yjs-Offlinesynchronisation nach Reconnect instrumentieren und Ursache der
   dauerhaften State-Vector-Divergenz klären.
2. Vote-Submit bei 600 gleichzeitigen Requests profilieren oder das
   1-Sekunden-Budget nach fachlicher SLO-Entscheidung begründet anpassen.
3. Die drei reproduzierbar fehlgeschlagenen Browser-Flows gegen aktuellen
   UI-/Subscription-Vertrag prüfen.
4. LCP des lokalisierten Einstiegs analysieren und das Lighthouse-Gate wieder
   grün machen.
5. Erst danach 30/60-Minuten-Läufe in einer stabilen Staging-Umgebung ausführen
   und Produktionsbaselines fachlich freigeben.
