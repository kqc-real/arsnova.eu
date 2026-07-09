<!-- markdownlint-disable MD013 -->

# ADR-0026: Performance-Hotpaths priorisieren und Telemetrie-Nebenlast konsequent entkoppeln

**Status:** Accepted  
**Datum:** 2026-05-09  
**Entscheider:** Projektteam

**Letzter Repo-Abgleich:** 2026-07-09

## Kontext

arsnova.eu ist eine Live-Plattform, deren kritische Last nicht primaer aus klassischen CRUD-Zugriffen entsteht, sondern aus gleichzeitigen Interaktionen vieler Teilnehmender in kurzer Zeit.

Die aktuelle Diskussion um Veranstaltungen mit bis zu 500 gleichzeitigen Teilnehmenden hat den relevanten Performance-Befund weiter geschaerft:

- Join-Wellen erzeugen kurzfristig hohe Parallelitaet.
- Vote- und Session-Clients nutzen Fallback-Polling.
- Status-Subscriptions arbeiten teilweise serverseitig selbst pollingbasiert.
- einzelne Hotpaths lesen oder aggregieren Daten, die bei hoher Parallelitaet teuer werden.
- daneben koennen Betriebs- und Statusanzeigen unnoetige Nebenlast erzeugen, wenn sie global und zu haeufig pollen.

Gleichzeitig zeigt sich, dass nicht jede Metrik oder Beobachtbarkeit gleich kritisch ist. Entscheidend ist, **wo** Last entsteht:

- im unmittelbaren Nutzer-Hotpath
- im Live-Fan-out
- im Hintergrund
- oder nur als Nebenverkehr durch Telemetrie und Betriebs-UI

Wir brauchen deshalb eine verbindliche Architekturentscheidung,

1. welche Lastpfade bei arsnova.eu primaer zu schuetzen sind,
2. welche Lastarten bei 500er-Szenarien als kritisch gelten,
3. wie Telemetrie und Statusanzeigen vom eigentlichen Live-Betrieb zu entkoppeln sind,
4. und welche Gegenmassnahmen bevorzugt einzusetzen sind.

## Entscheidung

### 1. Der Live-Hotpath hat immer Vorrang vor Diagnose-, Komfort- und Telemetriefunktionen

Fuer arsnova.eu gilt kuenftig verbindlich:

- Join, Vote, Sessionstatus und Teilnehmersicht sind primaere Betriebsfunktionen.
- Statusdialoge, Footer-Indikatoren, Reichweitenmetriken und sonstige Telemetrie sind nachrangig.
- Wenn Diagnose- oder Komfortfunktionen in Konflikt mit Live-Pfaden geraten, wird die Nebenlast zuerst reduziert oder entkoppelt.

Das bedeutet konkret:

- keine teuren Statistikabfragen im Teilnehmer-Hotpath
- keine vollstaendige Diagnoselogik in haeufig gepollten UI-Elementen
- keine Live-Aggregation historischer Kennzahlen pro Request, wenn ein monotones oder materialisiertes Modell moeglich ist

### 2. Bei 500 gleichzeitigen Teilnehmenden gelten vier Lasttreiber als primaer kritisch

Die folgenden Pfade werden fuer arsnova.eu verbindlich als primaere Performance-Hotpaths behandelt:

1. **`getCurrentQuestionForStudent` und vergleichbare Frage-/Antwortpfade**
2. **Join-Wellen** inklusive Session-Info- und Nickname-/Teilnehmerabfragen
3. **serverseitig pollingbasierte Status- oder Realtime-Pfade**
4. **clientseitige Fallback-Polling-Pfade** auf Vote- und Session-Seiten

Diese Pfade sind vor allen anderen Performance-Massnahmen zu beobachten, zu testen und zu optimieren.

### 3. Nicht jede Last ist gleich kritisch; die Bewertung erfolgt per Hotpath-Ampel

Fuer Entwurf, Review und Betrieb wird folgende Priorisierung verbindlich:

#### Rot: unmittelbar 500er-relevant

- `getCurrentQuestionForStudent` und andere pro Teilnehmer haeufig aufgerufene Fragepfade
- serverseitiges Polling fuer Status- und Realtime-Updates
- Vote-Fallback-Polling im Sekundenbereich
- Join-Wellen mit vielen gleichzeitigen `getInfo`-, Nickname- und `join`-Zugriffen

#### Gelb: beobachtungspflichtig

- haeufige Session-Info-Abfragen ausserhalb des Kernpfads
- Nebenkanaele wie Quick Feedback, wenn sie gleichzeitig mit Quiz-Last laufen
- zusaetzliche Reichweiten- und Betriebsmetriken, sofern sie nicht materialisiert sind

#### Gruen: im Normalfall unkritisch

- monotone Persistenzzaehler
- materialisierte oder gecachte Reichweitenmetriken
- schlanke Betriebsstatusanzeigen mit niedriger Pollingfrequenz
- Diagnoseabfragen, die nur on demand geladen werden

### 4. Telemetrie- und Betriebsanzeigen muessen vom Live-Betrieb entkoppelt werden

Telemetrie, Betriebsindikatoren und Status-UI muessen kuenftig nach folgenden Regeln entworfen werden:

1. **nur schlanke Daten im Footer oder in global sichtbaren UI-Elementen**
2. **schwere Detaildaten nur on demand**, z. B. beim Oeffnen eines Dialogs
3. **sichtbarkeits- und routenabhaengiges Polling** statt globalem Dauerpolling
4. **Caching fuer Betriebsdaten**, wenn dieselben Informationen mehrfach abgefragt werden
5. **keine Live-Abfrage historischer Reichweitenwerte**, wenn diese asynchron oder monoton fortgeschrieben werden koennen

Diese Regel gilt ausdruecklich auch dann, wenn eine einzelne Abfrage fuer sich genommen "noch billig genug" wirkt. Massgeblich ist die Last im Produkt unter vielen offenen Tabs und vielen Teilnehmenden.

### 5. Bevorzugte Gegenmassnahmen folgen einer festen Reihenfolge

Wenn ein Pfad als performance-kritisch bewertet wird, sind Gegenmassnahmen in dieser Reihenfolge zu pruefen:

1. **Polling vermeiden oder seltener machen**
2. **Push/Eventing gegenueber Polling bevorzugen**
3. **teure Aggregation aus dem synchronen Request-Pfad herausziehen**
4. **Kurzzeit-Caches oder materialisierte Zustandsmodelle einsetzen**
5. **Fan-out begrenzen oder nur fuer Hosts statt fuer alle Teilnehmenden exponieren**
6. **Feature bei Last degradieren oder temporar abschalten**
7. **erst danach** vertikal oder horizontal Infrastruktur vergroessern

Damit wird festgelegt: Infrastruktur-Upgrades sind zulaessig, aber kein Ersatz fuer Hotpath-Disziplin.

### 6. Fallback-Polling ist ein Notfallmechanismus, kein Normalbetriebsmodell

Clientseitiges Fallback-Polling darf verwendet werden, aber nur unter folgenden Leitplanken:

- es muss so selten wie fachlich vertretbar sein
- es darf nur die minimal noetigen Daten nachladen
- es soll nur aktiv sein, wenn der Push-/Subscription-Pfad nicht ausreicht oder stoert
- es ist regelmaessig gegen echte Ereignis- oder Versionierungsmodelle zu pruefen

Ein dauerhaft sekundenbasiertes Fallback auf allen Teilnehmenden-Geraeten ist fuer Grossveranstaltungen kein bevorzugtes Architekturmodell.

### 7. Reichweiten- und Betriebsmetriken sollen bevorzugt monoton, materialisiert oder ereignisbasiert entstehen

Fuer Reichweiten- und Betriebsstatistiken gilt:

- bevorzugt monotone Zaehler in `PlatformStatistic`
- alternativ materialisierte Tages- oder Fensterwerte
- nur ausnahmsweise direkte Live-`count(*)`- oder `some`-Abfragen ueber grosse Tabellen

Geeignet sind insbesondere:

- genutzte Sessions gesamt
- abgeschlossene Sessions gesamt
- Teilnahmen gesamt
- Votes gesamt
- Schwellenzaehler wie Sessions ab 10, 25, 50 oder 100 Teilnehmenden

Weniger geeignet fuer haeufig gepollte Pfade sind:

- wiederholte Vollzaehlungen ueber Sessions
- Reichweitenaggregation mit relationalen Existenzpruefungen pro Request
- Redis-Keyspace-Scans im Statuspfad

### 8. Grosse Veranstaltungen werden gegen reale Lastprofile statt abstrakte Zahlen bewertet

Fuer Aussagen wie "500 Teilnehmende sind moeglich" gilt kuenftig:

- entscheidend sind Join-Welle, Vote-Spike, Statuswechsel und Ergebnisphase
- nicht nur die Zahl gleichzeitiger offener Verbindungen
- Q&A, Quiz und andere Modi sind getrennt zu bewerten
- produktionsnahe Lasttests haben Vorrang vor rein theoretischen Zusagen

Damit wird festgelegt, dass Performance-Bewertungen von arsnova.eu szenariobasiert und nicht nur kapazitaetsorientiert erfolgen.

### 9. Performance-Kritik ist nur dann konstruktiv vollstaendig, wenn sie eine technische Antwort anbietet

Performance-Kritik bleibt ausdruecklich gewollt. Sie soll sich aber an folgendem Muster orientieren:

- betroffenen Pfad benennen
- Lastart erklaeren
- Ampelklasse zuordnen
- bevorzugte Gegenmassnahme nennen
- Mess- oder Verifikationsidee angeben

Beispiel:

- nicht nur: "Das ist kritisch."
- sondern: "Das liegt im roten Vote-Hotpath; bevorzugte Antwort waere Cache oder Eventing statt 2s-Polling; pruefen per k6/Artillery und produktionsnahem 500er-Szenario."

## Konsequenzen

### Positiv

- Die Plattform schuetzt ihre eigentlichen Live-Funktionen systematisch vor Nebenlast.
- Performance-Diskussionen werden konkreter und besser priorisiert.
- Telemetrie und Betriebsanzeigen bleiben moeglich, ohne unbeabsichtigt selbst zum Lasttreiber zu werden.
- Infrastrukturmassnahmen werden sinnvoll eingeordnet, statt Hotpath-Probleme zu verdecken.
- 500er-Szenarien koennen realistischer nach Quiz, Q&A und Join-Verhalten getrennt bewertet werden.

### Negativ / Risiken

- Hoeherer Design- und Review-Aufwand fuer Polling, Caching und Materialisierung.
- Manche komfortablen "einfach mal live zaehlen"-Loesungen werden bewusst ausgeschlossen.
- Kurzfristige Feature-Implementierungen koennen zunaechst langsamer wirken, weil Hotpath-Disziplin explizit mitgedacht werden muss.
- Caches und materialisierte Zustaende erhoehen die Komplexitaet und muessen sauber invalidiert werden.

## Alternativen (geprueft)

- **Performance nur fallweise und ohne ADR behandeln:** verworfen, weil dieselben Muster sonst immer wieder neu diskutiert werden.
- **Primaer Infrastruktur vergroessern:** verworfen, weil dies Polling-, Fan-out- und Aggregationsprobleme im Live-Hotpath nur verdeckt.
- **Alle Telemetrie im Produkt anzeigen und erst spaeter optimieren:** verworfen, weil Status- und Reichweitenanzeigen selbst relevanten Nebenverkehr erzeugen koennen.
- **Nur Lasttests definieren, aber keine Architekturpriorisierung:** verworfen, weil Tests allein nicht festlegen, welche Gegenmassnahmen bevorzugt sind.

## Umsetzungsleitplanken

- Neue oder geaenderte Live-Pfade muessen im Review mindestens einer Hotpath-Ampelklasse zugeordnet werden.
- Neue Footer-, Status- oder Diagnose-Elemente duerfen keine schweren Serverstats in kurzen Intervallen global pollen.
- Reichweitenmetriken in haeufig abgefragten Pfaden sollen bevorzugt auf monotone oder materialisierte Werte zugreifen.
- Vote- und Realtime-Pfade sind bei Optimierungen vor Reichweiten- und Reporting-Pfaden zu behandeln.
- Lasttests fuer Grossveranstaltungen muessen Join, Vote, Statuswechsel und Ergebnisphase getrennt abdecken.

## Implementierungsstand (Projekt arsnova.eu)

Stand 2026-05-09:

- der Footer-Betriebsstatus wurde von schweren Serverstats entkoppelt
- globale Statusabfragen wurden auf sichtbare, relevante Routen und deutlich geringere Frequenz begrenzt
- volle Serverstats werden nur noch on demand geladen und serverseitig kurz gecacht
- Join-Wellen werden serverseitig durch eine leichtgewichtige Admission Control geglaettet
- Join-Clients pausieren Polling in versteckten Tabs, laden Nickname-Listen seltener nach und starten nicht mehr synchron
- Vote-Clients pausieren Fallback-Polling in versteckten Tabs, starten Fallback-Poller nicht mehr synchron und nutzen Session-/Frage-Fallback nur noch im echten Stoerfallmodus
- `getParticipantNicknames` wurde serverseitig kurz gecacht, um redundante Join-Vorlast zu reduzieren
- `session.getInfo`, `onStatusChanged` und `getCurrentQuestionForStudent` wurden mit deduplizierten Kurzzeit-Caches entlastet
- diese Kurzzeit-Caches werden bei Join, Vote und relevanten Host-Statuswechseln gezielt invalidiert, damit neue Zustaende sofort sichtbar bleiben, ohne unbeteiligte Read-Caches unnötig zu verwerfen
- fuer laufende Fragen wurden getrennte Vote-Count- und Ergebnisaggregat-Caches eingefuehrt, damit haeufige Vote-Updates nicht staendig neue `count(*)`- und Aggregations-Reads erzwingen
- `onStatusChanged` wurde auf signalgetriebene Status-Subscriptions mit seltenem Resync umgestellt
- `onParticipantJoined` wurde ebenfalls auf signalgetriebene Realtime-Updates mit seltenem Timeout-Resync umgestellt
- Host- und Presenter-Ansichten pollen nur noch sichtbarkeits- und kontextabhaengig; Realtime-Pfade bleiben primaer
- die internen Session-EventEmitter wurden fuer hohe Parallelitaet auf unlimitierte Listener umgestellt, damit 500 Subscription-Clients keine Warn- oder Nebeneffekte erzeugen
- am 2026-05-09 wurde ein realer lokaler 500er-Lastlauf fuer Join-Welle, Status-Fan-out, Active-Question-Pfad und Vote-Spike erfolgreich gefahren
- fuer den teambasierten Host-Pfad wurde ausserdem festgezogen:
  - bei grossen Join-Wellen werden Teamfoyer-Animationen bewusst global unterdrueckt, um minutenlanges Nachzucken und unruhige Re-Renders zu vermeiden
  - synthetische `k6-...`-Namen aus Lasttests sind im Kindergarten-Theme keine Tier-Icons; daraus darf fuer Produktionsbeobachtungen kein separater UI-Fehler abgeleitet werden
- dieser Lauf hat die priorisierten roten Hotpaths bestaetigt und gleichzeitig zwei Restprobleme sichtbar gemacht:
  - lokale Dev-DB musste fuer `PlatformStatistic` schema-synchronisiert werden
  - Standard-Listenerlimits der EventEmitter mussten fuer hohe Subscription-Zahlen angehoben werden
- als primaere offene Optimierungsfelder bleiben insbesondere datenbanklastige Frage- und Ergebnispfade, Reconnect-Wellen und der produktionsnahe 500er-Lauf auf dem Hetzner-Zielsystem

Stand 2026-05-11:

- Ein Regressionsbefund nach der Hotpath-Verschlankung war, dass Vote-Clients Kanalwechsel `Quiz <-> Q&A <-> Blitzlicht` nicht mehr robust vom Host uebernahmen und Blitzlicht-Ergebnisse teils nicht live sichtbar wurden.
- Die Korrektur fuehrt deshalb bewusst wieder **kleine fachlich notwendige Zustandsdaten** im Status-Snapshot mit:
  - `channels` fuer aktiv/offen pro Session-Kanal
  - `preferredChannel` als synchronisierter Host-Wunschkanal
- Diese Ergaenzung gilt weiterhin als mit ADR-0026 vereinbar, weil sie nur sehr kleines Zusatzpayload erzeugt, aber teure oder unzuverlaessige Folge-Refetches im Live-Betrieb vermeidet.
- Fuer Blitzlicht-Ergebnisse wurde auf der Vote-Seite der vorhandene Push-Pfad `quickFeedback.onResults` aktiviert, statt die Anzeige ueber haeufigere Polling- oder Fallback-Requests zu reparieren. Das folgt direkt der Leitplanke "Push/Eventing vor Polling".
- Ein zwischenzeitlich getesteter Client-Guard, der QA- und Blitzlicht-Refetches bei unveraendertem Kanalstatus unterdruecken sollte, wurde wieder verworfen: Der Eingriff war zwar klein, beeintraechtigte aber die fachliche Robustheit des Vote-seitigen Kanalwechsels. Damit gilt hier explizit: Funktionssicherheit im Live-Pfad hat Vorrang vor einer nur marginalen Zusatzentlastung.
- Die aktuelle Balance lautet damit:
  - schlanke, cachebare Status-Snapshots bleiben erhalten
  - fachlich notwendiger Kanalzustand wird trotzdem mitgefuehrt
  - eventgetriebene Ergebnis-Updates werden bevorzugt
  - mikrooptimierende Guards werden nur behalten, wenn sie den Kanalwechsel nicht destabilisieren

Stand 2026-05-31:

- `health.footerBundle` bleibt der schlanke Footer-Pfad; `health.stats` und der Tagesrekord-Chart sind Dialog-/Detaildaten.
- Die konkrete Lasttest-Basis umfasst `scripts/load/k6-session-hotpaths-500vu.js`, Node-Smoke-/WS-Skripte, vier Classroom-30er-Smokes, Artillery-500 (`load:artillery:500`) und den CI-Job `classroom-smokes` auf PR/Push; schwere Last (`artillery-500`, k6-Produktion) bleibt von PR-Checks getrennt.
- Tempo nach ADR-0029 darf nicht als neuer Session-Channel-Fan-out umgesetzt werden, sondern muss im vorhandenen Blitzlicht-Hotpath mit delta-/cachefreundlicher Semantik bleiben.

Stand 2026-06-17:

- Host-Live-Fortschritt waehrend `ACTIVE` laeuft nicht mehr ueber vote-getriebene Full-Question-Events, sondern ueber `HostVoteProgressDTO`.
- `HostCurrentQuestionDTO` bleibt der stabile Host-Snapshot fuer Frage, Konfiguration und Ergebnisdaten; neue Votes invalidieren diesen Kanal nicht pro Abgabe.
- Vote-getriebene Progress-Signale werden kurz gebuendelt, damit Vote-Spitzen den Host nicht mit Re-Renders und WebSocket-Fan-out fluten.
- Ein gezielter Last-Smoke `npm run load:smoke:host-vote-progress` prueft fuer 200 parallele `NUMERIC_ESTIMATE`-Votes, dass der Progress-Endstand ankommt und keine vote-tragenden Current-Question-Events erzeugt werden.

Stand 2026-07-09:

- CI-Job `classroom-smokes` deckt auf PR/Push vier protokollnahe Unterrichts-Szenarien ab (Blitzlicht, Q&A, Demo-Quiz, WS Vote-Progress; je 30 TN).
- Artillery-500 modelliert die Unified Live-Session (Quiz + Q&A + Blitzlicht) mit HTTP, Teilnehmer-WebSocket und Host-Monitor; CI-Job `artillery-500` laeuft Schedule/Manuell (Standard 100 TN auf Runner).
- Docs-only-PRs nutzen in CI einen Fast Pass (Jobs melden Pflicht-Checks als `success`, schwere Steps werden uebersprungen).
- Als primaere offene Lasttest-Luecken bleiben: Reconnect-Wellen, Freitext-/Word-Cloud-Last, Yjs-Sync-Last, vereinheitlichter Laufvergleich und der produktionsnahe 500er-Voll-Lauf auf dem Hetzner-Zielsystem.

---

**Referenzen:** [ADR-0013: k6 und Artillery fuer Last- und Performance-Tests](./0013-use-k6-and-artillery-for-load-and-performance-testing.md), [ADR-0021: Trennung von Betriebsstatus und Laststatus](./0021-separate-service-status-from-load-status-with-live-slo-telemetry.md), [ADR-0025: Zukuenftige Erweiterungen standardmaessig als performance-kritisch behandeln](./0025-treat-future-extensions-as-performance-critical-until-proven-otherwise.md), [health.ts](../../../apps/backend/src/routers/health.ts), [session.ts](../../../apps/backend/src/routers/session.ts), [join.component.ts](../../../apps/frontend/src/app/features/join/join.component.ts), [session-vote.component.ts](../../../apps/frontend/src/app/features/session/session-vote/session-vote.component.ts), [app.component.ts](../../../apps/frontend/src/app/app.component.ts), [platformStatistic.ts](../../../apps/backend/src/lib/platformStatistic.ts).
