<!-- markdownlint-disable MD013 -->

# Performance-Wellenmodell fuer arsnova.eu

## Zweck

Dieses Dokument beschreibt typische **Performance-Wellen** im Betrieb von arsnova.eu.

Gemeint sind keine gleichmaessigen Dauerlasten, sondern **kurze oder phasenbezogene Lastspitzen**, die in Live-Szenarien mit vielen Teilnehmenden besonders relevant werden. Das Wellenmodell soll helfen,

- kritische Phasen frueh zu erkennen,
- Gegenmassnahmen gezielt zu priorisieren,
- Lasttests realistischer zu gestalten,
- und Architekturentscheidungen nicht nur abstrakt, sondern entlang realer Nutzungsphasen zu treffen.

Die Einordnung orientiert sich insbesondere an Grossveranstaltungen mit bis zu 500 gleichzeitigen Teilnehmenden.

## Grundannahme

arsnova.eu wird nicht primaer durch eine einzelne hohe Zahl offener Verbindungen kritisch, sondern durch **gleichzeitige Interaktionsspitzen in bestimmten Phasen**:

- vor dem Join
- waehrend der Join-Welle
- beim Oeffnen einer Frage
- beim gleichzeitigen Abstimmen
- bei Statuswechseln
- bei Reconnects
- und bei zusaetzlichen Nebenkanaelen

Deshalb ist das Performance-Risiko **wellenfoermig** und nicht linear.

## Wellenuebersicht

### 1. Lobby- und Vorbeitritts-Welle

**Phase**

- Teilnehmende haben den Session-Code bereits geoeffnet, sind aber noch nicht beigetreten.

**Typische Ursache**

- viele gleichzeitig offene Join-Seiten
- periodisches Nachladen von Session-Info und Nickname-Liste

**Betroffene Pfade**

- `session.getInfo`
- `session.getParticipantNicknames`
- Join-Client-Polling

**Risiko**

- eher **gelb**
- kann bei grossen Veranstaltungen aber vor dem eigentlichen Join schon eine spuervolle Vorlast erzeugen

**Warum kritisch**

- Last entsteht bereits vor der eigentlichen Teilnahme
- Nickname- und Teilnehmerlisten werden potenziell haeufig und redundant geladen

**Bevorzugte Gegenmassnahmen**

- Session-Info und Nickname-Liste getrennt takten
- Nickname-Liste seltener aktualisieren als Session-Info
- kurze Session-Caches
- bei stabiler Lobby Polling-Intervall erhoehen

### 2. Join-Welle

**Phase**

- viele Teilnehmende treten in kurzer Zeit nahezu gleichzeitig bei

**Typische Ursache**

- Host zeigt QR-Code oder Startsignal
- Publikum joint im selben Zeitfenster

**Betroffene Pfade**

- `session.join`
- Session-Info-Nachladungen
- Nickname-/Teilnehmerabfragen
- Teamzuweisung und Folgeschritte

**Risiko**

- **rot**

**Warum kritisch**

- gleichzeitige Schreib- und Lesezugriffe
- hohe kurzfristige Parallelitaet
- Folgeeffekte auf weitere Live-Pfade

**Bevorzugte Gegenmassnahmen**

- Admission Control / Join-Glattung
- Join in leichte und schwere Schritte trennen
- Nebenabfragen im Join-Kontext reduzieren
- Join-Folgeoperationen staffeln

### 3. Statuswechsel-Welle

**Phase**

- Session wechselt sichtbar ihren Zustand, z. B. Lobby -> Frage offen -> Aktiv -> Ergebnisse

**Typische Ursache**

- Host-Aktionen mit Auswirkungen auf alle Clients

**Betroffene Pfade**

- `onStatusChanged`
- Subscription-/Realtime-Pfade
- serverseitiges Status-Polling

**Risiko**

- **rot**

**Warum kritisch**

- Fan-out auf viele Clients
- serverseitig teilweise pollingbasiert statt echt ereignisbasiert
- kann sich mit anderen Wellen ueberlagern

**Bevorzugte Gegenmassnahmen**

- Eventing/PubSub statt Polling
- adaptive Pollingfrequenzen
- Sessionstatus zentral materialisieren
- Fan-out effizienter gestalten

### 4. Frageoeffnungs-Welle

**Phase**

- eine neue Frage wird sichtbar oder aktiv geschaltet

**Typische Ursache**

- Host startet die naechste Frage
- viele Clients laden nahezu gleichzeitig neue Fragendaten

**Betroffene Pfade**

- `getCurrentQuestionForStudent`
- Fragevorschau-/Aktivdaten
- sessionnahe Statusinfos

**Risiko**

- **rot**

**Warum kritisch**

- zeitgleiche Abrufe durch viele Clients
- teure Aggregationen oder Zaehllogik koennen im Request-Pfad liegen

**Bevorzugte Gegenmassnahmen**

- aktuelle Frage pro Session materialisieren
- Ergebnis- und Aggregatdaten cachen
- keine frischen teuren Counts pro Clientrequest

### 5. Abstimmungs-Spike

**Phase**

- ein grosser Teil der Teilnehmenden stimmt innerhalb weniger Sekunden ab

**Typische Ursache**

- Quiz-Frage mit klarer Zeitbegrenzung
- viele Teilnehmende senden kurz vor Ablauf oder direkt nach Freigabe
- synchronisierende Wirkung eines fuer alle sichtbaren Countdowns

**Betroffene Pfade**

- `vote.submit`
- nachgelagerte Auswertungs- und Statuspfade

**Risiko**

- **rot**

**Warum kritisch**

- kurze, sehr steile Schreibspitze
- haeufig gekoppelt mit nachgelagerten Lese- und Statuswellen
- Countdown synchronisiert das Verhalten vieler Teilnehmender und verschaerft dadurch die Welle

**Bevorzugte Gegenmassnahmen**

- Vote-Pfad so kurz wie moeglich halten
- Nebenschritte asynchronisieren
- keine zusaetzlichen Live-Aggregationen im Submit-Pfad
- Ergebnisdaten spaeter materialisieren statt sofort pro Client neu berechnen

### 5a. Countdown-Wirkung

**Phase**

- waehrend einer aktiven Frage mit sichtbarem Timer

**Typische Ursache**

- alle Teilnehmenden sehen denselben Deadline-bezogenen Countdown

**Betroffene Pfade**

- clientseitiger Countdown im Vote-Client
- indirekt: `vote.submit`, Ergebnisphase, Statuswechsel

**Risiko**

- der Countdown selbst: **gruen**
- seine synchronisierende Wirkung auf Folgeereignisse: **gelb bis rot**

**Warum relativ unkritisch**

- der Countdown wird im Client lokal berechnet
- er braucht nach Erhalt von `activeAt`, `timer` und Serverzeit-Offset keine dauernden Server-Requests
- der sekundenweise Tick belastet primär Browser, nicht Backend oder Netzwerk

**Warum trotzdem relevant**

- der Countdown synchronisiert Nutzerverhalten
- dadurch submitten viele Teilnehmende in einem engen Zeitfenster
- das verstaerkt Abstimmungs-, Ergebnis- und Statuswechsel-Wellen

**Bevorzugte Gegenmassnahmen**

- nicht den Countdown selbst priorisiert optimieren
- stattdessen die Pfade am Countdown-Ende entlasten
- insbesondere `vote.submit`, Ergebnisbereitstellung und Folge-Refreshs
- Countdown weiterhin clientseitig und deadline-basiert halten

### 6. Vote-Fallback-Welle

**Phase**

- Vote-Clients holen im Fallback periodisch Session- und Fragendaten

**Typische Ursache**

- seconds-based Fallback statt ausschliesslich eventbasierter Versorgung

**Betroffene Pfade**

- Vote-Client-Polling
- `session.getInfo`
- `getCurrentQuestionForStudent`
- Quick-Feedback-Resultpfade

**Risiko**

- **rot**

**Warum kritisch**

- betrifft potenziell alle aktiven Teilnehmenden gleichzeitig
- erzeugt Dauerlast statt einmaliger Spitze
- ueberlagert sich mit Frage- und Abstimmungsphasen

**Bevorzugte Gegenmassnahmen**

- Fallback nur als Notfallmodus
- Pollingintervalle erhoehen
- nur minimal noetige Daten nachladen
- eventbasierte Pfade staerken

### 7. Ergebnis- und Leaderboard-Welle

**Phase**

- nach einer Abstimmung oder Frage werden Ergebnisse sichtbar

**Typische Ursache**

- Host schaltet auf Ergebnisse
- viele Clients moechten gleichzeitig denselben Auswertungsstand sehen

**Betroffene Pfade**

- Ergebnisdaten
- Rankings
- Reveal-/Leaderboard-Ansichten

**Risiko**

- **gelb bis rot**, je nach Berechnungsaufwand

**Warum kritisch**

- haeufige Gleichzeitigkeit
- Gefahr mehrfach redundanter Aggregation desselben Ergebnisstands

**Bevorzugte Gegenmassnahmen**

- Ergebnisdaten einmalig vorberechnen
- Fan-out vorberechneter Daten statt Einzelaggregation pro Client
- Rankings und Reveal-Daten cachen oder materialisieren

### 8. Reconnect-Welle

**Phase**

- viele Geraete verlieren kurzzeitig Verbindung und verbinden sich dann erneut

**Typische Ursache**

- instabiles WLAN
- Mobilfunkwechsel
- Wechsel zwischen Vorder- und Hintergrund auf Mobilgeraeten

**Betroffene Pfade**

- Rejoin-/Reconnect-Logik
- Status- und Session-Refresh
- Presence-Updates

**Risiko**

- **rot**, wenn viele Clients gleichzeitig betroffen sind

**Warum kritisch**

- oft unerwartete Massenspitze
- kann wie eine zweite Join-Welle wirken
- trifft haeufig auf bereits belastete Systeme

**Bevorzugte Gegenmassnahmen**

- Exponential Backoff
- Rejoin billiger als Neu-Join
- Reconnect-Pfade getrennt von Erstbeitritt behandeln
- Presence- und Session-Refresh entkoppeln

### 9. Nebenkanal-Welle

**Phase**

- zusaetzliche Live-Kanaele laufen parallel zur Quiz-Last

**Typische Ursache**

- Quick Feedback
- Q&A
- kuenftige Tempo-Kanaele
- weitere Live-Signale

**Betroffene Pfade**

- kanalabhaengig
- oft Redis-, Session- oder UI-Fan-out-Pfade

**Risiko**

- meist **gelb**
- bei Ueberlagerung mit Quiz-Last auch **rot**

**Warum kritisch**

- einzelne Kanaele sind oft unproblematisch
- addieren sich aber zur Hauptlast

**Bevorzugte Gegenmassnahmen**

- getrennte Lastgrenzen je Kanal
- Degradationsmodus unter hoher Last
- Host-zentrierte statt teilnehmerweite Sichtbarkeit, wenn moeglich

### 10. Telemetrie- und Betriebsstatus-Welle

**Phase**

- viele Clients oder Tabs fragen Betriebsstatus und Diagnosedaten ab

**Typische Ursache**

- globales Footer-Polling
- haeufige Statuswidgets
- Diagnoseabfragen in haeufig sichtbaren UIs

**Betroffene Pfade**

- `health.footerBundle`
- `health.stats`
- serverseitige Statistikaggregation

**Risiko**

- nach aktueller Entschaerfung eher **gruen bis gelb**
- frueher potenziell kritischer Nebenlasttreiber

**Warum kritisch**

- unauffaellige Zusatzlast
- trifft haeufig viele Tabs gleichzeitig
- fachlich nachrangig, technisch aber teuer, wenn schlecht entworfen

**Bevorzugte Gegenmassnahmen**

- nur schlanke Footerdaten
- Detaildaten nur on demand
- sichtbarkeits- und routenabhaengiges Polling
- Caching fuer Serverstats

## Priorisierung der Wellen

Fuer arsnova.eu wuerde ich aktuell in dieser Reihenfolge priorisieren:

1. Vote-Fallback-Welle
2. Frageoeffnungs-Welle
3. Statuswechsel-Welle
4. Join-Welle
5. Abstimmungs-Spike

## Bereits umgesetzte Entschaerfungen

Stand 2026-05-09 bereits umgesetzt:

- Footer-Status von den vollen Serverstats entkoppelt
- Footer-Polling auf Live-Routen deaktiviert
- Footer-Polling auf sichtbare Tabs und seltenere Intervalle begrenzt
- Join-Polling in versteckten Tabs pausiert
- Join-Polling mit Jitter gestartet
- Nickname-Liste seltener als Session-Info nachgeladen
- Vote-Fallback in versteckten Tabs pausiert
- Vote-Fallback mit Jitter gestartet
- Vote-Fallback fuer Session- und Fragepfade auf echten Stoerfallmodus reduziert
- serverseitige Join-Admission-Control zur Glaettung von Join-Wellen
- Kurzzeit-Caches fuer `session.getInfo`, `onStatusChanged` und `getCurrentQuestionForStudent`
- gezielte Invalidierung der jeweils betroffenen Kurzzeit-Caches bei Join, Vote und relevanten Host-Statuswechseln
- getrennte Vote-Count- und Ergebnisaggregat-Caches fuer laufende Frage-/Rundenkontexte
- `onStatusChanged` von starrem Polling auf signalgetriebene Subscription mit seltenem Resync umgestellt
- `onParticipantJoined` von starrem Polling auf signalgetriebene Subscription mit seltenem Timeout-Resync umgestellt
- Host- und Presenter-Polling auf sichtbare Tabs und kontextrelevante Datenpfade begrenzt
- interne EventEmitter fuer Session-Signale auf hohe Parallelitaet vorbereitet, damit 500 Subscriptions keine Listener-Warnungen ausloesen

## Wirkung der bisherigen Massnahmen

Bereits erreicht:

- geringere Footer-Nebenlast
- geringere Join-Vorlast
- geringere Bursthoehe synchroner Polling-Starts
- geringere redundante Lese-Arbeit in kurzen Hotpath-Fenstern
- kurze Read-Caches koennen aggressiv bleiben, ohne dass neue Votes oder Host-Aktionen bis zum TTL-Ende unsichtbar bleiben
- neue Votes zwingen nicht mehr automatisch zu frischen `count(*)`- oder Ergebnis-Reads, solange der laufende Fragekontext unveraendert bleibt
- bei gesunder Realtime-Verbindung entfaellt die fruehere HTTP-Doppellast des Vote-Fallbacks weitgehend
- Status-Subscriptions verursachen im Leerlauf deutlich weniger Datenbankarbeit
- offene Host- und Presenter-Tabs tragen spuerbar weniger periodische Nebenlast

Noch nicht ausreichend entschaerft:

- `getCurrentQuestionForStudent` als eigentlicher 500er-Hotpath
- verbleibende Ergebnis- und Detailreads im Fragekontext
- Reconnect- und Subscription-Ausfallpfade
- Ergebnis- und Aggregatbildung nach dem Abstimmen

6. Reconnect-Welle
7. Ergebnis-/Leaderboard-Welle
8. Lobby-/Vorbeitritts-Welle
9. Nebenkanal-Welle
10. Telemetrie-/Betriebsstatus-Welle

Diese Reihenfolge ist nicht absolut, sondern fuer das aktuelle Architektur- und Lastbild zu lesen.

## Empirische Verifikation am 2026-05-09

Die Wellenpriorisierung wurde am 2026-05-09 erstmals gegen einen realen lokalen 500er-Lastlauf geprueft.

Getestet wurden:

- Join-Welle mit 500 VUs
- Status-Fan-out mit 500 parallelen `onStatusChanged`-Subscriptions
- aktiver Fragepfad mit 500 VUs
- Vote-Spike mit 500 VUs

### Beobachtete Wirkung

- **Join-Welle:** bestanden, `p95` im Hauptlauf bei `204.3 ms`, im Post-Fix-Rerun bei `147.52 ms`
- **Statuswechsel-Welle:** bestanden, 500 Subscriptions, 0 Fehler, korrekter Fan-out fuer 2 bis 3 reale Host-Statuswechsel
- **Frageoeffnungs- und Active-Question-Welle:** bestanden, `p95 = 416.99 ms`
- **Abstimmungs-Spike:** bestanden, `p95 = 742.62 ms`, 500 persistierte Votes

### Zusaetzliche Erkenntnisse aus dem Lauf

- Die Wellen selbst liefen stabil, aber der Test hat zwei technische Restschwaechen sichtbar gemacht:
  - lokale Dev-DB war fuer `PlatformStatistic` nicht vollstaendig schema-synchron
  - interne EventEmitter waren standardmaessig noch auf `10` Listener begrenzt
- Beide Probleme wurden noch am selben Tag behoben.

### Bedeutung fuer das Wellenmodell

Das Wellenmodell wurde durch den Lauf nicht widerlegt, sondern bestaetigt:

- die kritischsten Pfade lagen tatsaechlich in Join, Status-Fan-out, aktiver Frage und Vote-Spike
- die zuvor entschaerften Nebenpfade wie Footer-Status spielten im 500er-Lauf praktisch keine Rolle mehr
- die Ueberfuehrung von pollingbasierten Pfaden in signalgetriebene Realtime-Pfade war ein zentraler Hebel

Weiterhin offen bleibt die produktionsnahe Verifikation auf dem Hetzner-Zielsystem unter realem Monitoring und mit realistischen Netzbedingungen vor Ort.

## Produktionsbefund am 2026-05-09

Am 2026-05-09 wurde zusaetzlich ein realer 500er-Join-Lauf gegen die Produktionsinstanz `https://arsnova.eu` fuer die Session `6LTFZF` gefahren.

Beobachtung:

- 500 reale Joins wurden ohne HTTP-Fehler verarbeitet
- die Session stand danach bei `participantCount = 500`
- die Join-Welle war damit funktional erfolgreich

Gleichzeitig zeigte sich:

- `http_req_duration p95 = 3.57 s`
- damit ist die Produktions-Join-Welle machbar, aber qualitativ bereits im Grenzbereich

Fuer das Wellenmodell bedeutet das:

- die Join-Welle ist in Produktion **beherrschbar, aber weiter rot**
- die bisherige Join-Glattung und Vorlastreduktion wirken sichtbar
- fuer eine echte Gesamtfreigabe eines 500er-Szenarios fehlen aber noch Produktionsdaten fuer:
  - aktive Frage
  - Status-Fan-out unter Host-Steuerung
  - Vote-Spike
- zusaetzlich hat der reale Teammodus-Betrieb gezeigt, dass nicht nur Server-Hotpaths, sondern auch **Moderations- und Visualisierungspfade** bei 500+ kritisch werden koennen:
  - Reading-Ready-Semantik
  - Host-Vote-Fortschritt waehrend `ACTIVE`
  - Teamkarten-Stabilisierung
  - Teamwertungsdarstellung

- zusammen ca. **209 req/s**

Gewinn:

- grob **125 req/s weniger Vorlast**
- entsprechend etwa **37 % Reduktion** in dieser Phase

### 4. Nickname-Liste serverseitig kurz gecacht

Umgesetzt:

- `getParticipantNicknames` hat einen kurzen In-Memory-Cache

Wirkung im 500er-Fall:

- keine Aenderung an der nominalen Client-Request-Zahl
- aber deutliche Reduktion redundanter DB-Reads bei synchronen Join-Wellen
- mehrere nahezu gleichzeitige Anfragen koennen denselben Cache-Eintrag nutzen

### 5. Vote-Fallback in versteckten Tabs pausiert

Umgesetzt:

- Vote-Fallback-Polling pausiert in versteckten Tabs
- beim Sichtbarwerden wird sofort resynchronisiert
- Fallback-Poller starten mit kleinem Jitter statt synchron

Wirkung im 500er-Fall:

- im strengen Benchmark mit **500 sichtbaren aktiven Tabs** keine Reduktion der nominellen Durchschnittslast
- in realen Szenarien aber lineare Reduktion entsprechend der Zahl versteckter Tabs
- zusaetzlich geringere Burstlast durch den Jitter

### 6. Kurzzeit-Caches fuer kritische Lese-Hotpaths

Umgesetzt:

- `session.getInfo` mit kurzem dedupliziertem Read-Cache
- `onStatusChanged` mit kurzem dedupliziertem Status-Snapshot-Cache
- `getCurrentQuestionForStudent` mit kurzem dedupliziertem Read-Cache fuer `ACTIVE` und `RESULTS`
- kurz gecachte Pruefung, ob ein `participantId` wirklich zur Session gehoert

Wirkung im 500er-Fall:

- dieselbe Session wird innerhalb sehr kurzer Intervalle nicht mehr fuer jeden Client separat frisch aus der Datenbank aufgebaut
- parallele Subscriptions und Polls teilen sich identische kurze Snapshots
- redundante Vote-Count- und Ergebnis-Reads werden deutlich reduziert
- besonders relevant bei vielen gleichzeitigen Clients in derselben Session

## Gewinnbetrachtung fuer den 500er-Fall

Die bisherige Wirkung laesst sich in drei Arten von Gewinn einteilen:

### 1. Direkter Gewinn an Request-Volumen

Klar numerisch nachweisbar ist vor allem die Reduktion der Join-Vorlast:

- von ca. **334 req/s**
- auf ca. **209 req/s**
- also rund **37 % weniger Request-Volumen** in dieser Phase

### 2. Direkter Gewinn an Nebenlast

Der Footer war frueher ein staendiger Nebenlasttreiber auf vielen offenen Tabs. Auf Live-Seiten ist diese Last jetzt praktisch eliminiert.

Im frueheren Modell haette man bei `500` offenen Tabs grob mit:

- `500 / 30s` = **16,7 req/s**

auf den Footer-/Health-Pfad rechnen muessen.

Heute gilt:

- auf Live-Seiten: praktisch **0 req/s**
- auf uebrigen Seiten: deutlich weniger Requests und deutlich billigere Requests

### 3. Gewinn an Spitzenentlastung

Mehrere der umgesetzten Massnahmen senken nicht die mittlere Last, wohl aber die **Wellenhoehe**:

- Join-Admission-Control
- Polling-Jitter
- Pausieren versteckter Tabs
- kurzer Nickname-Cache

Diese Massnahmen sind im Live-Betrieb besonders wertvoll, weil kritische Situationen haeufig durch **Peaks und Ueberlagerungen** entstehen, nicht nur durch Durchschnittslast.

### 4. Gewinn an redundanzfreier Datenbankarbeit

Die neuen Kurzzeit-Caches fuer `getInfo`, `onStatusChanged` und `getCurrentQuestionForStudent` senken nicht zwingend die nominelle Zahl eingehender Requests, aber sie reduzieren die Zahl der **frischen DB- und Aggregationsarbeiten pro Zeitfenster**.

Das ist im 500er-Fall besonders wichtig, weil viele Clients oft:

- denselben Sessionzustand,
- dieselbe aktuelle Frage,
- denselben Statuswechsel

nahezu gleichzeitig abfragen.

Der Gewinn besteht daher vor allem in:

- weniger doppelten Session-/Quiz-Reads
- weniger parallelen Vote-Count-Abfragen
- weniger redundanten Ergebnis-Reads
- geringerer Lastspitze auf PostgreSQL bei synchronen Leserwellen

## Grenzen der bisherigen Entschaerfung

Trotz der bereits umgesetzten Verbesserungen bleiben die groessten offenen Lasttreiber fuer den 500er-Fall:

- `getCurrentQuestionForStudent`
- Vote-Fallback als Dauerlastmodell
- serverseitiges Status-Polling in Realtime-Pfaden
- Frageoeffnungs- und Ergebniswellen

Die bisherige Entschaerfung verbessert also vor allem:

- Vorlast
- Nebenlast
- Bursthoehe
- redundanzfreie Kurzzeit-Reads im Hotpath

Sie ersetzt aber noch nicht die noetigen Optimierungen im eigentlichen Vote- und Frage-Hotpath.

## Ueberlagerungen

Besonders kritisch sind Kombinationen mehrerer Wellen:

- Join-Welle + Vorbeitritts-Welle
- Frageoeffnungs-Welle + Vote-Fallback-Welle
- Abstimmungs-Spike + Ergebnis-Welle
- Reconnect-Welle waehrend laufender Abstimmung
- Nebenkanal-Welle parallel zu Quiz und Statuswechseln

Die gefaehrlichsten Situationen entstehen meist **nicht** durch eine einzelne Welle, sondern durch deren Ueberlagerung.

Ein typisches Beispiel ist:

- Frageoeffnung
- laufender Countdown
- Abstimmungs-Spike kurz vor Deadline
- danach Ergebnis- oder Statuswechsel

Hier ist der Countdown nicht der Lasttreiber, sondern der **Taktgeber** fuer die eigentliche Welle.

## Operative Leitregel

Wenn ein neuer Hotpath, ein neues Feature oder eine neue Metrik bewertet wird, sollte immer gefragt werden:

1. In welcher Welle oder Phase tritt die Last auf?
2. Ist es eine Einzelspitze, Dauerlast oder Ueberlagerung?
3. Liegt die Last im Live-Hotpath oder nur in Nebenfunktionen?
4. Welche Entschaerfung ist vor einem Infrastruktur-Upgrade moeglich?

## Fazit

Das Performance-Risiko von arsnova.eu ist phasenbezogen und wellenfoermig.

Fuer Grossveranstaltungen reicht es deshalb nicht, nur eine abstrakte Maximalzahl gleichzeitiger Teilnehmender zu betrachten. Entscheidend ist, welche **Wellen** auftreten, wie sie sich **ueberlagern** und welche **Gegenmassnahmen** fuer jede Phase bereits umgesetzt sind.

## Nachweisstand vom 2026-05-09

Die aus dem Produktionsbefund abgeleiteten Prioritaet-A-Korrekturen wurden lokal nochmals unter `500` Teilnehmenden pruefbar gemacht.

Nachweisbar lokal behoben:

- Host-Vote-Fortschritt waehrend `ACTIVE` zieht live nach
- Teamwertung fuer grosse Teams bleibt nach `RESULTS` sichtbar ungleich `0`
- Reading-Ready-Text trennt jetzt zwischen verbundenen und gesamten Teilnehmenden
- Teamfoyer-Animationen werden bei grossen Join-Wellen unterdrueckt, um minutenlanges Nachzucken zu vermeiden

Lokal blieb jedoch ein Restbefund im Vote-Spike:

- `16 / 500` Requests liefen in einen `dial: i/o timeout`
- gleichzeitig blieb `p95` mit `661.98 ms` deutlich unterhalb der gesetzten Antwortzeitgrenze

Operative Schlussfolgerung:

- die fachlich sichtbaren Teammodus-Befunde gelten lokal als behoben
- fuer die eigentliche Lastresistenz des Vote-Pfads ist ein kurzer Produktions-Retest weiter Pflicht

---

**Referenzen:** [ADR-0013: k6 und Artillery fuer Last- und Performance-Tests](/Users/kqc/arsnova.eu/docs/architecture/decisions/0013-use-k6-and-artillery-for-load-and-performance-testing.md), [ADR-0025: Zukuenftige Erweiterungen standardmaessig als performance-kritisch behandeln](/Users/kqc/arsnova.eu/docs/architecture/decisions/0025-treat-future-extensions-as-performance-critical-until-proven-otherwise.md), [ADR-0026: Performance-Hotpaths priorisieren und Telemetrie-Nebenlast konsequent entkoppeln](/Users/kqc/arsnova.eu/docs/architecture/decisions/0026-prioritize-performance-hotpaths-and-de-escalate-telemetry-side-load.md), [ADR-0027: Join-Wellen mit leichtgewichtiger Admission Control glaetten](/Users/kqc/arsnova.eu/docs/architecture/decisions/0027-smooth-join-waves-with-lightweight-admission-control.md), [session.ts](/Users/kqc/arsnova.eu/apps/backend/src/routers/session.ts), [health.ts](/Users/kqc/arsnova.eu/apps/backend/src/routers/health.ts), [join.component.ts](/Users/kqc/arsnova.eu/apps/frontend/src/app/features/join/join.component.ts), [session-vote.component.ts](/Users/kqc/arsnova.eu/apps/frontend/src/app/features/session/session-vote/session-vote.component.ts), [app.component.ts](/Users/kqc/arsnova.eu/apps/frontend/src/app/app.component.ts), [joinAdmission.ts](/Users/kqc/arsnova.eu/apps/backend/src/lib/joinAdmission.ts).
