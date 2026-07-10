<!-- markdownlint-disable MD013 -->

# Arbeitsauftrag: Lasttest der arsnova.eu-Architektur

## 1. Auftrag

Dieser Arbeitsauftrag beschreibt Vorbereitung, Durchfuehrung, Messung, Auswertung und Freigabe eines produktionsnahen Lasttests fuer die aktuelle arsnova.eu-Architektur.

Der Auftrag richtet sich an Entwicklung, Betrieb und Qualitaetssicherung. Er ist so formuliert, dass eine beauftragte Person oder ein kleines Team den Lasttest reproduzierbar vorbereiten, fahren, auswerten und daraus belastbare technische Massnahmen ableiten kann.

Als aktueller lokaler Vorlauf dient der
[Gesamt-Testlauf vom 2026-07-10](./LOCAL-TESTRUN-2026-07-10.md). Er bestätigt
Artillery und k6 bis 500 Teilnehmende/VUs sowie einen stabilen 5-Minuten-Soak,
zeigt aber offene Yjs-Reconnect-Konvergenz, ein überschrittenes
600er Vote-p95-Gate, drei rote Browser-Flows und ein rotes Lighthouse-Gate. Ein
produktionsnaher Lauf darf diese Befunde nicht durch pauschale
„Reconnect/Vote bestanden“-Aussagen überdecken.

## 2. Hintergrund

arsnova.eu ist ein Audience-Response-System fuer Live-Lehrveranstaltungen. Kritische Last entsteht nicht gleichmaessig, sondern in kurzen synchronen Wellen:

- viele Teilnehmende oeffnen gleichzeitig den Join-Link oder QR-Code
- viele Teilnehmende treten nahezu gleichzeitig einer Session bei
- der Host schaltet eine Frage frei und alle Clients laden denselben Zustand
- viele Teilnehmende stimmen innerhalb weniger Sekunden ab
- Ergebnisse werden gleichzeitig sichtbar
- WebSocket-Clients reconnecten nach Netzwerkstoerungen oder Tab-Wechseln

Die Bachelorarbeit von Muhammad Diniz Bin Irwan zu frag.jetzt liefert dafuer eine methodische Vorlage. Uebertragbar ist nicht die konkrete Kapazitaetszahl, sondern die Messlogik:

- Lastprofile getrennt nach Zielroute definieren
- Black-Box-Metriken des Lastgenerators mit White-Box-Metriken von App, Datenbank und Redis zeitsynchron erfassen
- Baseline, Kontrolllast und echte Hotpaths getrennt auswerten
- p95/p99-Latenzen, Fehlerraten und Pool-/Queueing-Zustaende hoeher gewichten als Durchschnittswerte
- aus jedem beobachteten Symptom eine konkrete technische Ursache ableiten

## 3. Architektur unter Test

Zu testen ist die aktuelle arsnova.eu-Architektur:

- Angular-Frontend
- Node.js-/Express-Backend
- tRPC HTTP API auf `PORT=3000`
- tRPC WebSocket-Server auf `WS_PORT=3001`
- Yjs WebSocket-Server auf `YJS_WS_PORT=3002`
- PostgreSQL 16 ueber Prisma 7 und `@prisma/adapter-pg`
- Redis 7 fuer Presence, Rate-Limiting, Live-Signale, SLO-Telemetrie und Kurzzeitdaten
- Nginx oder vergleichbarer Reverse Proxy mit TLS-Termination in Produktion
- Docker-Compose-basierter Betrieb auf dem Zielserver

Relevante Quelldokumente und vorhandene Bausteine:

- `docs/architecture/decisions/0013-use-k6-and-artillery-for-load-and-performance-testing.md`
- `docs/architecture/decisions/0026-prioritize-performance-hotpaths-and-de-escalate-telemetry-side-load.md`
- `docs/implementation/PERFORMANCE-WELLENMODELL-ARSNOVA-EU.md`
- `docs/implementation/LASTTEST-500-TEILNEHMENDE.md`
- `scripts/load/k6-trpc-health-50vu.js`
- `scripts/load/k6-trpc-session-50vu.js`
- `scripts/load/k6-session-hotpaths-500vu.js`
- `scripts/load/ws-status-subscribers.mjs`

## 4. Ziel des Lasttests

Der Lasttest soll belastbar beantworten:

1. Ob arsnova.eu eine Live-Session mit 500 gleichzeitigen Teilnehmenden unter produktionsnahen Bedingungen stabil traegt.
2. Welche Hotpaths unter Last dominieren: Join, Status-Fan-out, aktuelle Frage, Vote-Submit, Ergebnisphase, Q&A, Quick Feedback, Reconnect.
3. Ob PostgreSQL, Redis, Node.js-Event-Loop, WebSocket-Fan-out, Reverse Proxy oder Netzwerk den ersten relevanten Engpass bilden.
4. Ob bestehende Entlastungen aus ADR-0026 wirken: Kurzzeit-Caches, Push statt Polling, reduzierte Telemetrie, Join-Glattung, materialisierte Zaehler.
5. Welche konkreten Massnahmen vor produktivem Einsatz groesserer Veranstaltungen erforderlich sind.

## 5. Nichtziele

Nicht Bestandteil dieses Auftrags:

- DDoS-Simulation oder Sicherheitsangriffe
- Browser-Rendering-Benchmark auf realen Mobilgeraeten
- WLAN-Ausmessung im Hoersaal
- Vergleich mit frag.jetzt, ARSnova classic oder anderen ARS
- allgemeines Feature-Testing ohne Lastbezug
- Lasttest mit echten personenbezogenen Daten
- endgueltige Kapazitaetsaussage fuer beliebig grosse Veranstaltungen

Browsernahe E2E-Flows duerfen als Kontrollpfade genutzt werden, sind aber nicht der primaere Lasttreiber dieses Auftrags.

## 6. Ergebnisartefakte

Am Ende muessen folgende Artefakte vorliegen:

1. Ergebnisbericht unter `docs/implementation/LASTTEST-ARSNOVA-ARCHITEKTUR-ERGEBNIS-YYYY-MM-DD.md`
2. Liste aller gefahrenen Befehle inklusive Zeitstempel, Commit, Branch, Server und Ziel-URLs
3. Rohdaten der Lastgeneratoren, nicht zwingend committed, aber geordnet abgelegt unter `tmp/loadtests/YYYY-MM-DD-arsnova/`
4. Screenshots oder Exporte der wichtigsten Dashboards und Terminalausgaben
5. Ampelbewertung je Szenario: gruen, gelb, rot
6. konkrete Befundliste mit Ursache, Schweregrad und Massnahme
7. Go/No-Go-Empfehlung fuer Veranstaltungen mit 500 Teilnehmenden

## 7. Rollen

### Testleitung

Verantwortlich fuer:

- Testfenster koordinieren
- Testumfang freigeben
- Start-/Stop-Entscheidungen treffen
- Ergebnisbericht abnehmen

### Betrieb

Verantwortlich fuer:

- Zielsystem vorbereiten
- Servermetriken erfassen
- Logs und Containerstatus sichern
- Notfallabbruch durchfuehren koennen

### Entwicklung

Verantwortlich fuer:

- Testdaten bereitstellen
- fehlende Hilfsskripte ergaenzen
- technische Befunde analysieren
- Code-/Architekturmassnahmen ableiten

### Lasttest-Ausfuehrung

Verantwortlich fuer:

- k6-/Artillery-/Node-Skripte starten
- Zeitstempel dokumentieren
- Rohdaten sichern
- Szenarien exakt nach Plan fahren

## 8. Vorbedingungen

Vor dem Test muessen erfuellt sein:

- Zielsystem laeuft mit aktuellem geplanten Release-Commit.
- `npm run build:prod` laeuft lokal oder in CI erfolgreich.
- Prisma-Schema ist gegen die Ziel-DB angewendet.
- PostgreSQL und Redis sind gesund.
- Nginx/Reverse Proxy leitet HTTP, WebSocket und Yjs korrekt.
- Keine realen Veranstaltungen laufen auf demselben System.
- Lastgenerator laeuft nach Moeglichkeit auf einer separaten Maschine, nicht auf dem Zielserver.
- Systemzeit von Zielserver und Lastgenerator ist synchronisiert.
- Test-Session und Test-Quiz enthalten keine personenbezogenen Daten.
- Abbruchperson mit Serverzugang ist waehrend des Tests erreichbar.

## 9. Testumgebung

### Prioritaet A: produktionsnahes Staging oder dediziertes Testfenster auf Zielsystem

Empfohlen:

- identischer Servertyp wie Produktion
- identische Docker-Compose-Konfiguration
- identisches Nginx-/TLS-Verhalten
- separate Test-Domain oder klar abgegrenztes Testfenster

### Prioritaet B: lokale Integrationsumgebung

Nur fuer Dry Runs geeignet:

- `docker compose up -d postgres redis`
- Backend und Frontend lokal
- Lastgenerator lokal

Lokale Ergebnisse duerfen nur als technische Regressionserkennung verstanden werden, nicht als Kapazitaetszusage.

## 10. Datenschutz und Betriebssicherheit

- Nur synthetische Nicknames verwenden, z. B. `k6-001`.
- Keine echten Vorlesungsdaten, keine echten Studierenden, keine echten Bewertungen.
- Test-Session nach Auswertung loeschen oder klar als Testdaten markieren.
- Logs vor Weitergabe auf Tokens, Cookies, IPs und Secrets pruefen.
- Produktionsumgebung nur in einem freigegebenen Testfenster belasten.
- Bei roten Betriebsindikatoren sofort abbrechen.

## 11. Metriken

### 11.1 Black-Box-Metriken aus Lastgeneratoren

Pflicht:

- Requests pro Sekunde
- `http_req_duration` p50, p90, p95, p99, max
- Fehlerrate
- Statuscode-Verteilung
- Timeouts
- Verbindungsfehler
- WebSocket-Verbindungsaufbauzeit
- WebSocket-Nachrichten empfangen vs. erwartet
- Szenario-spezifische Korrektheit, z. B. 500 Votes persistiert

### 11.2 App-Metriken

Pflicht:

- tRPC-SLO-Telemetrie aus `apps/backend/src/lib/sloTelemetry.ts`
- `totalRequestsLastMinute`
- `errorRatePercentLastMinute`
- `p95LatencyMsLastMinute`
- `p99LatencyMsLastMinute`
- Lastsignale aus `apps/backend/src/lib/loadSignal.ts`
- Votes pro Minute
- Session-Transitions pro Minute
- aktive Countdown-Sessions
- Backend-Logs mit 4xx/5xx, Rate-Limits, WebSocket-Warnungen, Prisma-Fehlern

Wenn moeglich ergaenzen:

- Node.js Event-Loop-Lag
- Heap-Auslastung
- GC-Spitzen
- Anzahl aktiver WebSocket-Clients
- Anzahl aktiver tRPC-Subscriptions pro Session
- Cache-Hit/Miss-Signale fuer kritische Read-Caches

### 11.3 PostgreSQL-Metriken

Pflicht:

- aktive Verbindungen aus `pg_stat_activity`
- wartende Queries
- lang laufende Queries
- Transaktionen pro Sekunde
- Commits/Rollbacks
- Locks und Lock-Waits
- CPU und RAM des Postgres-Containers
- Disk-I/O und fsync-nahe Auffaelligkeiten
- Fehler im Postgres-Log

Empfohlen:

- `pg_stat_statements`, falls aktiviert
- Top-Queries nach Gesamtdauer
- Top-Queries nach mittlerer Dauer
- Cache-Hit-Ratio
- Sequenzielle Scans auf grossen Tabellen
- Wachstum von `Vote`, `Participant`, `Session`, `SessionFeedback`

### 11.4 Redis-Metriken

Pflicht:

- `connected_clients`
- `instantaneous_ops_per_sec`
- `used_memory`
- `blocked_clients`
- `keyspace_hits`
- `keyspace_misses`
- `expired_keys`
- `evicted_keys`
- Redis-Latenz
- Redis-Fehler im Backend-Log

Empfohlen:

- `INFO commandstats`
- `LATENCY DOCTOR`
- auffaellige `SCAN`-/Keyspace-Muster

### 11.5 Reverse Proxy und Betriebssystem

Pflicht:

- CPU, RAM, Load Average
- Netzwerk RX/TX
- offene TCP-Verbindungen
- Container-Restarts
- 499/500/502/503/504 im Reverse Proxy
- TLS-/WebSocket-Upgrade-Fehler

Empfohlen:

- `docker stats`
- `docker compose ps`
- Nginx access/error log mit Zeitfenstern
- `ss -s` oder vergleichbare Socket-Uebersicht

## 12. Akzeptanzkriterien

Die folgenden Werte sind Startwerte fuer den ersten produktionsnahen Lauf. Sie duerfen nach einem sauber dokumentierten Baseline-Lauf angepasst werden.

### Gruen

- keine Datenkorruption
- keine verlorenen Votes in bestandenen Vote-Szenarien
- keine App- oder Container-Restarts
- Fehlerrate pro kritischem Szenario unter 1 %
- keine 5xx-Bursts ueber 10 Sekunden
- Join-Welle p95 unter 2 s
- aktive Frage p95 unter 1.5 s
- Vote-Spike p95 unter 2 s
- WebSocket-Fan-out liefert mindestens 99.5 % der erwarteten Nachrichten
- p99 der kritischen API-Pfade bleibt unter 5 s
- PostgreSQL-Verbindungen bleiben unter 80 % des Limits
- Redis `evicted_keys = 0`
- keine dauerhafte CPU-Saettigung ueber 90 % fuer laenger als 5 Minuten

### Gelb

- Fehlerrate zwischen 1 % und 3 %, ohne Datenverlust
- einzelne p99-Ausreisser ueber 5 s, aber keine kaskadierende Degradation
- PostgreSQL- oder Redis-Spitzen erkennbar, aber selbstheilend
- WebSocket-Fan-out unter 99.5 %, aber fachlich ohne sichtbare Fehlfunktion
- Nachoptimierung erforderlich, aber kein grundsaetzlicher Architekturbruch

### Rot

- Datenverlust oder inkonsistente Vote-/Ergebnisdaten
- App- oder DB-Restart
- Fehlerrate ueber 3 % in roten Hotpaths
- p95 ueber 5 s in Join, Vote oder aktueller Frage
- p99 ueber 10 s in roten Hotpaths
- WebSocket-Reconnect-Sturm destabilisiert Backend
- PostgreSQL-Connection-Pool oder aktive DB-Verbindungen laufen an harte Grenzen
- Redis blockiert oder evictet Daten
- Reverse Proxy produziert relevante 502/504
- System erholt sich nach Lastende nicht innerhalb von 2 Minuten

## 13. Abbruchkriterien

Der Test ist sofort zu stoppen, wenn eines der folgenden Ereignisse eintritt:

- Produktion oder Testziel wird fuer echte Nutzende beeintraechtigt
- 5xx-Rate ueber 5 % fuer mehr als 60 Sekunden
- Datenbank nicht mehr erreichbar
- Redis nicht mehr erreichbar
- App-Container restartet mehrfach
- freier RAM unter 5 % plus Swap-Aktivitaet
- Plattenplatz unter 10 %
- Reverse Proxy liefert massenhaft 502/504
- Testleitung oder Betrieb fordert Abbruch

## 14. Testdaten

### Test-Quiz

Es ist ein dediziertes Test-Quiz anzulegen mit:

- mindestens einer Single-Choice-Frage
- mindestens einer Multiple-Choice-Frage
- mindestens einer Freitext-/Word-Cloud-Frage
- mindestens einer Frage mit Ergebnisanzeige
- optional Teammodus, falls Grossveranstaltung mit Teams geplant ist

### Test-Session

Pro Testlauf ist mindestens eine frische Session zu verwenden:

- eindeutiger Session-Code
- kein realer Veranstaltungsname
- Host-Token dokumentiert, aber nicht in Logs commiten
- Session-ID, Frage-ID und Antwort-ID fuer k6-Skripte erfassen
- Teilnehmer-IDs nach Join-Welle exportieren

### Teilnehmerdaten

Teilnehmer werden synthetisch erzeugt:

- `k6-001` bis `k6-500`
- keine echten Namen
- keine Mailadressen
- keine personenbezogenen Freitexte

## 15. Vorbereitende Befehle

Die konkreten Befehle sind an Zielserver und Deployment anzupassen.

### 15.1 Repository- und Build-Stand dokumentieren

```bash
git rev-parse --abbrev-ref HEAD
git rev-parse HEAD
git status --short
npm run build:prod
```

### 15.2 Zielsystem pruefen

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs --tail=100 app
docker compose -f docker-compose.prod.yml logs --tail=100 postgres
docker compose -f docker-compose.prod.yml logs --tail=100 redis
```

### 15.3 Health pruefen

```bash
curl -s "https://<ziel-domain>/trpc/health.check?batch=1&input=%7B%220%22%3A%7B%7D%7D"
curl -s "https://<ziel-domain>/trpc/health.footerBundle?batch=1&input=%7B%220%22%3A%7B%7D%7D"
```

### 15.4 PostgreSQL-Basiszustand erfassen

```bash
docker exec arsnova-v3-postgres psql -U arsnova_user -d arsnova_v3 -c "select now();"
docker exec arsnova-v3-postgres psql -U arsnova_user -d arsnova_v3 -c "select state, count(*) from pg_stat_activity group by state order by state;"
docker exec arsnova-v3-postgres psql -U arsnova_user -d arsnova_v3 -c "select datname, xact_commit, xact_rollback, blks_read, blks_hit from pg_stat_database where datname = 'arsnova_v3';"
```

### 15.5 Redis-Basiszustand erfassen

```bash
docker exec arsnova-v3-redis redis-cli INFO stats
docker exec arsnova-v3-redis redis-cli INFO clients
docker exec arsnova-v3-redis redis-cli INFO memory
docker exec arsnova-v3-redis redis-cli LATENCY DOCTOR
```

## 16. Messprotokoll

Fuer jedes Szenario ist exakt zu dokumentieren:

- Datum
- Startzeit und Endzeit mit Zeitzone
- Ziel-URL
- Branch und Commit
- Serverdaten
- Testdaten: Session-Code, Session-ID, Frage-ID, Antwort-ID
- Befehl
- Lastgenerator-Maschine
- erwartete Last
- beobachtete Fehler
- p50, p90, p95, p99, max
- Postgres-Befunde
- Redis-Befunde
- App-/Proxy-Logs
- Ampel
- kurze Interpretation

Zwischen zwei Szenarien sind mindestens 2 Minuten Cooldown einzuplanen. Nach roten Befunden wird nicht einfach weitergetestet, sondern zuerst Ursache und Systemzustand geprueft.

## 17. Szenarien

### Szenario 0: Baseline

Zweck:

- Ruhezustand und Messinfrastruktur validieren
- Referenzwerte fuer App, DB, Redis und Proxy erfassen

Durchfuehrung:

- 5 Minuten keine kuenstliche Last
- Health alle 30 Sekunden manuell oder per kleinem Monitor abrufen
- DB-/Redis-/Containerwerte erfassen

Erwartung:

- keine steigenden Fehlerraten
- keine wachsenden DB-Wartezustaende
- Redis ohne blockierte Clients
- App ohne Warnungen

### Szenario 1: Statische Gateway-/Frontend-Kontrolllast

Zweck:

- Kontrollmessung fuer Reverse Proxy, TLS, statische Assets und Netzwerk
- Trennung von statischer Auslieferung und echten Live-Hotpaths

Durchfuehrung:

- GET auf `/`, lokalisierte Startseite und wenige Assets
- keine tRPC-API, keine DB, kein Redis als primaeres Ziel

Erwartung:

- sehr niedrige Latenzen
- keine DB-Korrelation
- keine Aussage ueber Live-Faehigkeit ableiten

Hinweis:

- Dieses Szenario entspricht methodisch der Kontrolllast aus der frag.jetzt-Arbeit. Es dient nur als Gegenprobe, nicht als Kapazitaetsbeweis.

### Szenario 2: Health- und Status-Nebenlast

Zweck:

- pruefen, ob Betriebsstatus und Footer-Bundle auch unter Nebenlast entkoppelt bleiben

Befehl:

```bash
BASE_URL=https://<ziel-domain> k6 run scripts/load/k6-trpc-health-50vu.js
```

Erwartung:

- keine Beeintraechtigung der Live-Hotpaths
- keine teuren DB-Spitzen durch Statusmetriken
- Serverstats-Cache wirkt

### Szenario 3: Join-Welle 500

Zweck:

- rote Join-Welle realistisch pruefen
- Admission Control, Redis, Prisma und DB-Schreibpfad bewerten

Befehl:

```bash
MODE=join-wave \
SESSION_CODE=<CODE> \
BASE_URL=https://<ziel-domain> \
VUS=500 \
DURATION_SECONDS=30 \
k6 run scripts/load/k6-session-hotpaths-500vu.js
```

Erwartung:

- 500 Teilnehmende werden angelegt
- Fehlerrate unter 1 %
- p95 unter 2 s
- keine Prisma-/Unique-/Race-Fehler
- keine Redis- oder Postgres-Saettigung

Nachpruefung:

- Teilnehmerzahl in Host-Ansicht
- DB-Anzahl `Participant`
- Backend-Logs fuer Rate-Limit oder Join-Fehler

### Szenario 4: Status-Fan-out mit 500 WebSocket-Subscriptions

Zweck:

- `session.onStatusChanged` unter 500 parallelen Subscriptions pruefen
- Host-Statuswechsel gegen echte Fan-out-Last testen

Befehl:

```bash
SESSION_CODE=<CODE> \
CLIENTS=500 \
DURATION_MS=60000 \
WS_URL=wss://<ziel-domain>/trpc \
node scripts/load/ws-status-subscribers.mjs
```

Falls der produktive WebSocket-Port nicht ueber `/trpc` am selben Host terminiert wird, ist `WS_URL` entsprechend der Nginx-Konfiguration anzupassen.

Waehrend des Laufs ausloesen:

- `LOBBY -> QUESTION_OPEN`
- `QUESTION_OPEN -> ACTIVE`
- `ACTIVE -> RESULTS`

Erwartung:

- 500 geoeffnete Subscriptions
- pro Statuswechsel 500 Nachrichten
- keine `MaxListenersExceededWarning`
- keine Reconnect-Spirale
- keine relevanten 502/504 am Proxy

### Szenario 5: Aktive Frage 500

Zweck:

- roten Lese-Hotpath `session.getCurrentQuestionForStudent` pruefen
- Cache-Hit-Verhalten und DB-Entlastung bewerten

Vorbereitung:

- Frage aktivieren
- reale `PARTICIPANT_IDS` aus der Join-Welle exportieren
- `QUESTION_ID` erfassen

Befehl:

```bash
MODE=active-question \
SESSION_CODE=<CODE> \
QUESTION_ID=<QUESTION_ID> \
PARTICIPANT_IDS="<id1,id2,...>" \
BASE_URL=https://<ziel-domain> \
VUS=500 \
DURATION_SECONDS=60 \
k6 run scripts/load/k6-session-hotpaths-500vu.js
```

Erwartung:

- p95 unter 1.5 s
- p99 unter 5 s
- Fehlerrate unter 1 %
- keine frische teure DB-Aggregation pro Client
- keine wachsenden Lock-Waits

### Szenario 6: Vote-Spike 500

Zweck:

- kritischsten Schreibpeak pruefen
- Vote-Persistenz, Ergebniszaehlung und Host-Fortschritt validieren

Vorbereitung:

- Frage in abstimmungsfaehigen Zustand bringen
- `SESSION_ID`, `QUESTION_ID`, `ANSWER_ID`, `PARTICIPANT_IDS` erfassen

Befehl:

```bash
MODE=vote-spike \
SESSION_ID=<SESSION_ID> \
SESSION_CODE=<CODE> \
QUESTION_ID=<QUESTION_ID> \
ANSWER_ID=<ANSWER_ID> \
PARTICIPANT_IDS="<id1,id2,...>" \
BASE_URL=https://<ziel-domain> \
VUS=500 \
k6 run scripts/load/k6-session-hotpaths-500vu.js
```

Erwartung:

- 500 erwartete Votes oder fachlich begruendete Abweichung
- Fehlerrate unter 1 %
- p95 unter 2 s
- keine doppelten Votes
- Host sieht Vote-Fortschritt unter Last
- Ergebnisphase zeigt korrekte Summen
- keine DB-Locks, die Folgepfade blockieren

Nachpruefung:

- Vote-Anzahl in DB
- Ergebnisanzeige im Host
- Ergebnisanzeige auf Teilnehmerseite
- Teamwertung, falls Teammodus aktiv

### Szenario 7: Ergebnis-Fan-out

Zweck:

- Wechsel `ACTIVE -> RESULTS` und gleichzeitige Ergebnisabfrage testen
- Ergebnisaggregation, Cache und WebSocket-Fan-out pruefen

Durchfuehrung:

- 500 Status-Subscriptions offen halten
- Host schaltet Ergebnisse frei
- parallel aktive Frage oder Ergebnisdaten durch 500 Clients abrufen

Erwartung:

- Ergebnisse innerhalb weniger Sekunden sichtbar
- keine wiederholte Vollaggregation pro Client
- keine inkonsistenten Prozentwerte oder Teamwerte
- WebSocket-Nachrichten nahezu vollstaendig

### Szenario 8: Quick Feedback / Blitzlicht unter Nebenlast

Zweck:

- Redis-lastige Live-Pfade und Ergebnis-Subscription pruefen
- Vertraeglichkeit mit parallel offener Session testen

Durchfuehrung:

- Quick Feedback starten
- 500 synthetische Votes oder Reaktionen senden
- Host-/Presenter-Ergebnisansicht offen halten

Erwartung:

- Redis bleibt stabil
- Ergebnis-Subscription liefert Updates
- keine haeufigen Polling-Fallbacks
- keine Keyspace-Scans im Hotpath, die spuerbar werden

Wenn kein fertiges Skript existiert, ist vor dem Lauf ein kleines k6- oder Artillery-Skript fuer `quickFeedback.vote` zu erstellen.

### Szenario 9: Q&A- und Freitext-Mischlast

Zweck:

- Mischlast aus Lesen, Schreiben, Moderation und Live-Auswertung pruefen

Durchfuehrung:

- 100 bis 200 synthetische Q&A- oder Freitextbeitraege
- 500 lesende Clients
- Host moderiert, sortiert oder zeigt Wortwolke

Erwartung:

- keine blockierende Vollauswertung im Nutzer-Hotpath
- Word-Cloud-/Freitext-Auswertung beeintraechtigt Vote- und Statuspfade nicht
- p95 der roten Quiz-Hotpaths bleibt stabil, falls parallel aktiv

### Szenario 10: Reconnect-Welle

Zweck:

- gleichzeitige WebSocket-Reconnects nach Netzwerkstoerung simulieren

Durchfuehrung:

- 500 WebSocket-Clients verbinden
- Clients nach kurzer Zeit geschlossen oder Netzwerk kurz unterbrochen
- Reconnect beobachten

Erwartung:

- keine Reconnect-Spirale
- Backend bleibt responsiv
- Redis und DB werden durch Reconnect nicht uebermaessig belastet
- Subscriptions erhalten nach Reconnect den korrekten Zustand

Wenn kein fertiges Skript existiert, ist `scripts/load/ws-status-subscribers.mjs` um einen Reconnect-Modus zu erweitern oder ein separates Artillery-Szenario zu erstellen.

### Szenario 11: 30-Minuten-Mischlast

Zweck:

- Stabilitaet ueber eine realistische Veranstaltungsdauer pruefen
- Memory-Leaks, Cache-Wachstum und schleichende Latenzdegradation erkennen

Mischung:

- 500 verbundene Teilnehmende
- 1 Join-Welle am Anfang
- 5 bis 10 Fragen
- je Frage Statuswechsel, Vote-Spike, Ergebnisphase
- zwischendurch Quick Feedback oder Q&A
- einzelne Reconnect-Wellen

Erwartung:

- keine stetig steigende Latenz
- keine wachsende Heap-/Redis-/DB-Speicherlinie ohne Rueckgang
- keine Container-Restarts
- System erholt sich nach Testende innerhalb von 2 Minuten

## 18. Reihenfolge der Durchfuehrung

Empfohlene Reihenfolge:

1. Baseline
2. Health-Smoke
3. statische Kontrolllast
4. Join-Welle 50 als Dry Run
5. Join-Welle 500
6. Status-Fan-out 500
7. aktive Frage 500
8. Vote-Spike 500
9. Ergebnis-Fan-out
10. Quick Feedback / Blitzlicht
11. Q&A / Freitext
12. Reconnect-Welle
13. 30-Minuten-Mischlast

Nach jedem roten Befund wird die Reihenfolge unterbrochen und erst analysiert.

## 19. Analyseleitfaden

Jeder Befund ist nach folgendem Muster zu analysieren:

- Symptom: Was wurde extern beobachtet?
- Zeitpunkt: Wann genau trat es auf?
- Betroffener Pfad: Welche Route oder Subscription?
- Black-Box-Beleg: k6/Artillery/Node-Metrik
- White-Box-Beleg: App, Postgres, Redis, Proxy, OS
- Ursache: technische Hypothese
- Verifikation: welche Daten bestaetigen oder widerlegen sie?
- Massnahme: Code, Konfiguration, Infrastruktur oder Testdaten?
- Prioritaet: P0 bis P3
- Nachtest: welches Szenario beweist die Korrektur?

Beispiele:

- Nicht ausreichend: "Vote ist langsam."
- Ausreichend: "`vote.submit` p95 steigt im Vote-Spike auf 4.8 s, gleichzeitig sind 95 % der Postgres-Verbindungen aktiv und `pg_locks` zeigt Wartende auf `Vote`; Massnahme: Schreibpfad und Unique-/Upsert-Verhalten pruefen, Nachtest Szenario 6."

- Nicht ausreichend: "WebSocket ist instabil."
- Ausreichend: "Beim Status-Fan-out werden nur 1380 von 1500 Nachrichten empfangen, Proxy-Log zeigt 101-Upgrades ohne 5xx, Backend-Log zeigt Reconnects; Massnahme: Subscription-Lifecycle und Client-Reconnect-Backoff pruefen, Nachtest Szenario 4 und 10."

## 20. Berichtsvorlage

Der Ergebnisbericht soll diese Struktur haben:

```markdown
# Lasttest arsnova.eu Architektur vom YYYY-MM-DD

## Kurzfazit

## Testfenster

## Systemstand

- Branch:
- Commit:
- Zielsystem:
- Serverdaten:
- Docker Images:

## Testdaten

- Session-Code:
- Session-ID:
- Quiz:
- Fragen:
- Teilnehmer:

## Szenarien

### Szenario 0: Baseline

- Befehl:
- Zeitraum:
- Ergebnis:
- App:
- PostgreSQL:
- Redis:
- Ampel:
- Interpretation:

...

## Gesamtbewertung

## Befunde

| Prio | Befund | Ursache | Massnahme | Nachtest |
| ---- | ------ | ------- | --------- | -------- |

## Go/No-Go fuer 500 Teilnehmende

## Anhang

- Rohdaten:
- Screenshots:
- Logs:
```

## 21. Erwartete technische Anschlussarbeiten

Falls rote oder gelbe Befunde auftreten, sind wahrscheinlich diese Arbeitsfelder relevant:

- gezielte Instrumentierung von Node.js Event-Loop-Lag und WebSocket-Clientzahlen
- Artillery-Szenarien fuer komplexe Realtime-Flows
- k6-Skripte fuer Quick Feedback, Q&A und Freitext
- Exportskript fuer Teilnehmer-IDs nach Join-Welle
- Host-Steuerskript fuer Statuswechsel ohne manuelle UI-Klicks
- Prometheus-/Grafana-Dashboard fuer Postgres, Redis, App-SLOs und Proxy
- Aktivierung oder Auswertung von `pg_stat_statements`
- explizite Pool-Konfiguration und Pool-Metriken fuer Prisma/Postgres
- Reconnect-Backoff pruefen
- Entkopplung weiterer Telemetrie- oder Reporting-Pfade aus roten Hotpaths

## 22. Go/No-Go-Entscheidung

Die Freigabe fuer 500 gleichzeitige Teilnehmende darf nur erfolgen, wenn:

- Szenarien 3 bis 8 mindestens gelb und kein Szenario rot ist
- Szenario 6 keine Vote-Korrektheitsfehler zeigt
- Szenario 4 keine relevante Fan-out-Luecke zeigt
- PostgreSQL und Redis nach Testende gesund sind
- keine offenen P0/P1-Befunde verbleiben
- ein Nachtest fuer alle behobenen P0/P1-Befunde dokumentiert ist

Wenn diese Bedingungen nicht erfuellt sind, ist die Entscheidung "No-Go" oder "Go mit klarer Begrenzung", z. B.:

- maximal 250 Teilnehmende
- keine parallelen Nebenkanaele
- Teammodus deaktiviert
- Q&A/Freitext nicht parallel zum Quiz
- Test nur auf lokaler Infrastruktur, keine Produktionszusage

## 23. Definition of Done

Der Arbeitsauftrag ist erledigt, wenn:

- alle Pflichtszenarien gefahren oder begruendet ausgelassen wurden
- Rohdaten und Logs gesichert sind
- Ergebnisbericht im Repo liegt
- Ampel je Szenario dokumentiert ist
- alle roten und gelben Befunde priorisiert sind
- konkrete technische Massnahmen abgeleitet sind
- Go/No-Go-Empfehlung vorliegt
- Testleitung den Bericht abgenommen hat
