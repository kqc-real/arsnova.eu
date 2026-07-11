# Lasttest-Ergebnis 500 Teilnehmende vom 2026-05-09

> **Historischer Lauf:** Der aktuelle breitere lokale Nachweis mit Artillery,
> k6, Yjs, Soak, Browser-Smokes und Lighthouse steht im
> [Gesamt-Testlauf vom 2026-07-10](./LOCAL-TESTRUN-2026-07-10.md). Die Werte
> dieses Dokuments bleiben als Vergleichspunkt erhalten.

## Zweck

Dieses Dokument haelt den am 2026-05-09 durchgefuehrten lokalen 500er-Lastlauf fuer arsnova.eu fest.

Es dokumentiert:

- den Testaufbau
- die gefahrenen Szenarien
- die gemessenen Ergebnisse
- die waehrend des Laufs gefundenen Probleme
- die noch am selben Tag umgesetzten Korrekturen

## Rahmenbedingungen

- Testart: lokaler Entwicklungs- und Integrationslasttest
- Backend: aktueller Entwicklungsstand vom 2026-05-09
- Datenhaltung: lokales PostgreSQL und Redis
- Lastgeneratoren:
  - `scripts/load/k6-session-hotpaths-500vu.js`
  - `scripts/load/ws-status-subscribers.mjs`
- Testquiz: `Alle Frageformate – Quiz aus der Oberstufe`

Wichtig:

- Der Lauf ist ein starker technischer Hinweis auf 500er-Faehigkeit.
- Er ersetzt **nicht** den noch ausstehenden produktionsnahen Lasttest auf dem Hetzner-Zielsystem.

## Gefahrene Szenarien

### 1. Join-Welle

- Session-Code: `69CRGP`
- Last: 500 VUs
- Modus: `join-wave`
- Dauerfenster: 15 Sekunden Polling nach Join

Ergebnis:

- 0 Fehler
- `http_req_duration p95 = 204.3 ms`
- 500 reale Teilnehmende erfolgreich erzeugt

### 2. Status-Fan-out

- Session-Code: `69CRGP`
- Last: 500 parallele `onStatusChanged`-Subscriptions
- Dauer: 20 Sekunden
- reale Host-Statuswechsel:
  - `LOBBY -> QUESTION_OPEN`
  - `QUESTION_OPEN -> ACTIVE`
  - `ACTIVE -> RESULTS`

Ergebnis:

- 500 geoeffnete Subscriptions
- 0 Fehler
- 1500 empfangene Nachrichten

Das entspricht genau drei Signalen an je 500 Clients.

### 3. Aktive Frage

- Session-Code: `69CRGP`
- Frage: `14e851dd-0dc2-4c1e-ae8b-d9ff15ff44db`
- Last: 500 VUs
- reale Teilnehmer-IDs aus der vorherigen Join-Welle
- Modus: `active-question`

Ergebnis:

- 0 Fehler
- `http_req_duration p95 = 416.99 ms`

### 4. Vote-Spike

- Session-Code: `69CRGP`
- Session-ID: `ee2b21ea-091a-44c4-993e-dfb7bee947d8`
- Frage: `14e851dd-0dc2-4c1e-ae8b-d9ff15ff44db`
- Antwortoption: `139b7f61-759a-48bb-b234-eb052805f7e9`
- Last: 500 VUs
- reale Teilnehmer-IDs aus derselben Session
- Modus: `vote-spike`

Ergebnis:

- 0 Fehler
- `http_req_duration p95 = 742.62 ms`
- anschliessend verifiziert:
  - 500 Teilnehmende in der Session
  - 500 persistierte Votes insgesamt
  - 500 Votes auf der aktiven Frage

## Befunde waehrend des Laufs

Der Lauf hat zwei echte technische Probleme sichtbar gemacht:

### 1. Lokale Dev-Datenbank nicht vollstaendig schema-synchron

Symptom:

- Fehler auf `PlatformStatistic` wegen fehlender Spalte `usedSessionsTotal`

Ursache:

- lokales Dev-Schema entsprach nicht vollstaendig dem aktuellen Prisma-Schema

Massnahme:

- `npm run prisma:push`

### 2. EventEmitter-Listenerlimit fuer 500 Subscriptions zu niedrig

Symptom:

- `MaxListenersExceededWarning` bei vielen parallelen Status-Subscriptions

Ursache:

- Standardlimit des Node-EventEmitters von `10`

Massnahme:

- interne Session-EventEmitter in `session.ts` auf unlimitierte Listener gesetzt

## Post-Fix-Rerun

Nach den beiden Korrekturen wurde ein kurzer Rerun gefahren.

### Join-Welle

- Session-Code: `32D7CF`
- 500 VUs
- `http_req_duration p95 = 147.52 ms`
- 0 Fehler

### Status-Fan-out

- Session-Code: `32D7CF`
- 500 parallele `onStatusChanged`-Subscriptions
- Dauer: 10 Sekunden
- reale Host-Statuswechsel:
  - `LOBBY -> QUESTION_OPEN`
  - `QUESTION_OPEN -> ACTIVE`

Ergebnis:

- 500 geoeffnete Subscriptions
- 0 Fehler
- 1000 empfangene Nachrichten
- keine neue Listener-Warnung im Backend

## Interpretation

Der lokale 500er-Lastlauf wurde in allen vier Kernpfaden erfolgreich bestanden:

- Join-Welle
- Status-Fan-out
- aktive Frage
- Vote-Spike

Die heute umgesetzten Performance-Massnahmen haben damit nicht nur konzeptionell, sondern unter echter Parallelitaet Wirkung gezeigt.

## Grenzen des Ergebnisses

Der Lauf erlaubt noch **keine endgueltige Zusage** fuer eine produktive 500er-Veranstaltung.

Noch offen bleibt:

- produktionsnaher Lauf auf der Hetzner-Zielinfrastruktur
- Beobachtung von CPU, RAM, PostgreSQL, Redis und Netzwerk unter echter Zielumgebung
- Countdown-Abgleich zwischen Host-Projektion und Teilnehmergeraeten
- Verhalten unter realen WLAN- und Mobilfunkbedingungen vor Ort

## Fazit

Der Entwicklungsstand vom 2026-05-09 ist fuer 500 gleichzeitige Teilnehmende deutlich robuster als zuvor.

Der lokale Integrationslasttest liefert ein positives technisches Signal. Die naechste Pflichtstufe ist der produktionsnahe Lasttest auf dem Zielsystem.

Der anschliessende reale Produktions-Join-Lauf ist separat dokumentiert in [LASTTEST-500-PRODUKTION-6LTFZF-2026-05-09.md](./LASTTEST-500-PRODUKTION-6LTFZF-2026-05-09.md).

Wichtig fuer die aktuelle Gesamtbewertung:

- Der Produktionslauf hat zusaetzliche fachliche Befunde im Teammodus gezeigt.
- Daraus wurden dort explizite Fix-Punkte fuer:
  - Host-Vote-Fortschritt waehrend `ACTIVE`
  - Reading-Ready-Semantik bei Grosslast
  - Teamscore-Sichtbarkeit bei grossen Teams
  - Stabilisierung der Teamkarten auf dem Host
    abgeleitet.
- Der Produktionsbeobachtungskontext ist dabei wichtig:
  - die `500` Lasttest-Teilnehmenden kamen aus `k6` und trugen synthetische `k6-...`-Namen
  - im Kindergarten-Theme wurden diese daher nicht als Tier-Icons dargestellt
  - fuer Teamkarten unter Grosslast wird der Foyer-Einflug bewusst global gedrosselt bzw. unterdrueckt; ein fehlender Einflug einzelner spaeter realer Tier-Icon-Nutzender ist daher erwartbares Verhalten und kein zusaetzlicher Produktionsbug

## Lokaler Nachtest der Prioritaet-A-Fixes

Die aus dem Produktionslauf abgeleiteten Prioritaet-A-Punkte wurden anschliessend lokal umgesetzt und erneut unter 500 Teilnehmenden geprueft.

### Frische lokale Retest-Session

- Session-Code: `ZF62DN`
- Quiz: `Codex Local 500 Team Quiz`
- Teammodus: `Apfel` / `Birne`
- Join-Welle: `500` Teilnehmende

### Join-Welle

- `500` Teilnehmende erfolgreich aufgenommen
- `participantCount = 500`
- `http_req_duration p95 = 1.87 s`
- `0` Fehler
- Teamfoyer-Einflug im Teammodus erwartungsgemaess unterdrueckt, damit die Karten nach der Join-Welle nicht minutenlang nachzucken

### Host-Fortschritt waehrend `ACTIVE`

Nach `nextQuestion` und `revealAnswers` wurde ein 500er-Vote-Spike gegen die aktive Frage gefahren.

Ergebnis:

- im Host-Pfad wurde waehrend `ACTIVE` live `totalVotes = 484` gesehen
- damit ist der fruehere Befund `0 von n haben abgestimmt` lokal nicht mehr reproduzierbar

Einordnung:

- der Host-Pfad zieht neue Votes jetzt waehrend laufender Fragen nach
- die fruehere Stale-Anzeige im Moderationspfad ist lokal behoben

### Teamscore nach `RESULTS`

Nach `revealResults` ergab die Teamwertung erstmals auch unter grossen Teams sichtbare Werte:

- `Birne`: `1899.1`
- `Apfel`: `1876.1`

Einordnung:

- die fruehere Nullanzeige der Teamwertung ist lokal nicht mehr reproduzierbar
- grosse Teams werden jetzt auch in fruehen Live-Phasen sichtbar differenziert

### Restbefund im lokalen Vote-Spike

Der lokale 500er-Vote-Spike zeigte weiterhin einen Restbefund:

- `484 / 500` Vote-Requests erfolgreich
- `16 / 500` Requests mit `dial: i/o timeout`
- `http_req_duration p95 = 661.98 ms`

Einordnung:

- funktional ist der Host-/Team-Pfad jetzt sichtbar korrigiert
- fuer den Lastpfad selbst bleibt lokal ein Restproblem mit einzelnen Langlaeufern bzw. Timeouts im Docker-zu-Localhost-Pfad
- dieser Punkt muss im produktionsnahen bzw. echten Produktions-Retest separat beobachtet werden
