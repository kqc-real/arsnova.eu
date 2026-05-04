<!-- markdownlint-disable MD013 -->

# ADR-0024: Tagesrekord-Verlauf fuer Session-Teilnehmende im Server-Status-Hilfedialog

**Status:** Proposed  
**Datum:** 2026-05-04  
**Entscheider:** Projektteam

## Kontext

Der Server-Status in `arsnova.eu` besitzt bereits zwei etablierte Ebenen:

1. das kompakte Footer-Widget fuer die schnelle Orientierung,
2. den Hilfe-Dialog fuer die Einordnung und Detailansicht.

Der aktuelle Produktstand zeigt im Hilfe-Dialog bereits den Allzeit-Rekord `maxParticipantsSingleSession` aus `PlatformStatistic`. Fuer Lehre, Betrieb und Produktbeobachtung fehlt jedoch eine historische Sicht darauf, wie sich Tageshoechstwerte ueber die letzten Wochen entwickeln.

Wichtig ist die fachliche Abgrenzung: Der Tagesrekord meint **nicht** die Summe aller Teilnehmenden eines Tages ueber alle Sessions hinweg, sondern die **maximale gleichzeitige Teilnehmendenzahl in der groessten einzelnen Session des jeweiligen UTC-Tages**.

Fuer die geplante Story `0.4a` entstehen dadurch mehrere gekoppelte Architekturfragen:

- Wo wird der Tagesrekord gespeichert?
- Wie bleibt der Join-Flow trotz zusaetzlicher Statistikaktualisierung schnell?
- Wie kommt die Historie typsicher in `health.stats`?
- Wie wird die Visualisierung eingebaut, ohne das Footer-Widget oder das Initial-Bundle aufzublaehen?

Bestehende Leitplanken:

- `health.stats` ist tRPC-basiert (ADR-0003).
- Neue UI-Texte muessen dem i18n-Modell folgen (ADR-0008).
- Der Hilfe-Dialog ist die vorgesehene Detailflaeche fuer Statuserklaerungen; das Footer-Widget bleibt kompakt (ADR-0021).

## Entscheidung

### 1. Tagesrekorde werden persistent in PostgreSQL gespeichert

Es wird ein neues Prisma-Modell `DailyStatistic` eingefuehrt. Pro UTC-Tag existiert genau ein Datensatz mit dem Rekord der **groessten einzelnen Session dieses Tages**:

- `date`
- `maxParticipantsSingleSession`
- `updatedAt`

Die Speicherung erfolgt in PostgreSQL ueber Prisma, nicht nur fluechtig in Redis.

### 2. Rekord-Updates bleiben Fire-and-Forget beim Session-Join

Beim Session-Beitritt wird die Statistikaktualisierung weiterhin asynchron ausgeloest. Zusaetzlich zum bestehenden Allzeit-Rekord wird der Tagesrekord atomar per Upsert aktualisiert.

Damit gilt weiterhin:

- kein blockierendes Warten im Join-Flow,
- keine zweite synchrone Roundtrip-Abhaengigkeit fuer den Beitritt,
- Race-Conditions werden ueber atomare Persistenzlogik reduziert.

### 3. `health.stats` liefert einen 30-Tage-Verlauf als API-Vertrag

`ServerStatsDTO` wird um `dailyHighscores` erweitert. Das Feld liefert die letzten 30 UTC-Tage in chronologischer Reihenfolge mit:

- `date` als ISO-String,
- `count` als maximale gleichzeitige Teilnehmendenzahl der groessten einzelnen Session dieses UTC-Tages.

Fehlende Tage werden serverseitig mit `count = 0` aufgefuellt, damit die Frontend-Darstellung eine stabile Zeitachse hat.

### 4. Die Visualisierung lebt nur im Hilfe-Dialog

Der Verlauf wird ausschliesslich im `ServerStatusHelpDialogComponent` angezeigt. Das kompakte Footer-Widget bekommt keinen zusaetzlichen Chart oder Sparkline.

Damit bleibt die Aufmerksamkeits- und Platzhierarchie eindeutig:

- Footer = schneller Statusueberblick,
- Hilfe-Dialog = Detailansicht und historische Einordnung.

### 5. Das Diagramm wird lazy geladen und ohne Angular-Wrapper gerendert

Fuer die Diagrammdarstellung wird `chart.js` direkt verwendet, ohne zusaetzlichen Angular-Wrapper. Der Import erfolgt nur beim Oeffnen des Dialogs.

### 6. Es bleibt beim bestehenden Polling-Modell

Die Aktualisierung des Verlaufs erfolgt ueber das bestehende Polling von `health.stats`. Fuer diese Statistik wird kein eigener WebSocket-Kanal eingefuehrt.

## Konsequenzen

### Positiv

- Der Produktvertrag bleibt konsistent mit ADR-0021: Details gehoeren in den Dialog, nicht in den Footer.
- Die Historie ist persistent, reproduzierbar und fuer spaetere Auswertungen anschlussfaehig.
- Der API-Vertrag bleibt typsicher und klar in `shared-types` abbildbar.
- Die Frontend-Performance bleibt kontrollierbar, weil das Diagramm nur bei Bedarf geladen wird.
- Das Feature eignet sich didaktisch gut als vertikaler Durchstich ueber Prisma, Backend, shared-types, Frontend und Git-Workflow.

### Negativ / Risiken

- Zusaetzliches Prisma-Modell plus Migration erhoehen die Pflegekosten.
- Die serverseitige Null-Auffuellung der 30-Tage-Achse muss sauber getestet werden.
- Diagrammcode im Dialog erhoeht die UI-Komplexitaet und benoetigt A11y- und i18n-Sorgfalt.
- Polling bedeutet, dass der Verlauf nicht in Echtzeit pro Sekunde sichtbar ist; diese Verzoegerung ist bewusst akzeptiert.

## Alternativen (geprueft)

- **Historie jedes Mal aus Session- und Participant-Daten ableiten:** verworfen, da teurer, fehleranfaelliger und semantisch unklarer fuer den Tagesrekordbegriff.
- **Redis statt PostgreSQL fuer Tagesrekorde:** verworfen, da die Daten Neustarts ueberleben und zur bestehenden Prisma-Statistiklogik passen sollen.
- **Mini-Sparkline direkt im Footer:** verworfen, da das kompakte Widget bewusst textbasiert und leichtgewichtig bleiben soll.
- **Groessere Chart-Bibliothek oder Angular-Wrapper:** verworfen, da Bundle-Groesse und Integrations-Overhead fuer diesen Anwendungsfall unnoetig hoch waeren.
- **WebSocket-Push fuer den Verlauf:** verworfen, da das bestehende Polling fuer diese langsame Kennzahl ausreicht.

## Umsetzungsleitplanken

- Story-Bezug: `Backlog.md` Story `0.4a`.
- Vor dem Coden sind mindestens ADR-0003, ADR-0008, ADR-0021 und dieses ADR zu lesen.
- Die Implementierung darf das bestehende Footer-Layout nicht ausweiten.
- Die API muss 30 Tage konsistent und chronologisch liefern.
- Neue Labels, Ueberschriften und ARIA-Texte folgen dem vorhandenen i18n-Prozess.

---

**Referenzen:** [Backlog.md](../../../Backlog.md), [Server-Status-Widget](../../features/server-status-widget.md), [ADR-0003: Nutzung von tRPC](./0003-use-trpc-for-api.md), [ADR-0008: Internationalisierung](./0008-i18n-internationalization.md), [ADR-0021: Trennung von Betriebsstatus und Laststatus](./0021-separate-service-status-from-load-status-with-live-slo-telemetry.md), [HANDOUT-TAGESREKORD-KI-AGENT.md](../../praktikum/HANDOUT-TAGESREKORD-KI-AGENT.md).
