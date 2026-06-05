<!-- markdownlint-disable MD013 -->

# ADR-0029: Tempo als vordefiniertes Blitzlicht-Template statt eigenem Session-Kanal

**Status:** Accepted
**Datum:** 2026-05-27
**Entscheider:** Projektteam

**Letzter Repo-Abgleich:** 2026-06-04

## Kontext

`ADR-0022` hatte Tempo zunaechst als eigenstaendigen vierten Session-Kanal vorgesehen. Diese Richtung wurde vor Implementierung wieder verworfen.

Der aktualisierte Produktentscheid aus Issue `#17` und der anschliessenden Produktpraezisierung lautet:

- Tempo-Feedback bleibt fachlich wichtig.
- Es soll aber im bestehenden Blitzlicht-Modell angeboten werden.
- Es muss sowohl im Session-Blitzlicht als auch im Standalone-Blitzlicht verfuegbar sein.
- Es wird **kein** vierter Session-Kanal, **kein** eigener Host-Tab und **kein** persistentes Parallel-Widget in der Teilnehmeransicht eingefuehrt.

Treiber fuer die Aenderung:

- Die bestehende Session-Shell ist auf `quiz`, `qa` und `quickFeedback` optimiert.
- Ein vierter Kanal wuerde Shared Types, Session-DTOs, Host-IA und Vote-IA deutlich verbreitern.
- Das eigentliche Produktziel ist eine schnell startbare Host-Option fuer Tempo-Feedback, nicht eine zweite Live-Infrastruktur neben Blitzlicht.
- Die bestehende Blitzlicht-Infrastruktur besitzt bereits die passenden Host- und Teilnehmerpfade fuer anonyme Live-Aggregation.
- Der Hotpath muss auch bei 500+ Teilnehmenden schlank bleiben und darf keinen neuen Session-weiten Fan-out erzeugen.

## Entscheidung

### 1. Tempo wird als Blitzlicht-Template umgesetzt

Tempo wird als **vordefiniertes Template im bestehenden Blitzlicht-Kanal** modelliert.

Es ist damit:

- **kein** eigener Session-Kanal
- **kein** neuer Host-Tab
- **keine** Quizfrage
- **kein** paralleles Ambient-Widget ausserhalb von Blitzlicht

Die bestehende Blitzlicht-Start-UI bietet dafuer eine eigene Host-Option `Tempo`.

Diese Host-Option muss in beiden Produktkontexten verfuegbar sein:

- eingebettetes Blitzlicht innerhalb der Session
- Standalone-Blitzlicht

Fuer die Startseite gilt zusaetzlich:

- `Tempo` bekommt fuer das Standalone-Blitzlicht eine **Spotlight-Kachel**
- diese Darstellung ist **kein** zusaetzlicher vierter Hero-Chip
- die bestehende 3-Chip-IA bleibt erhalten; `Tempo` erscheint als hervorgehobener Zusatz-Einstieg zum Blitzlicht

Fuer die Blitzlicht-Host-Startflaeche gilt dieselbe Regel:

- `Tempo` wird in der Host-Auswahl als **Spotlight-Kachel** dargestellt
- `Tempo` ist **kein** weiterer kleiner Preset-Chip ohne visuelle Prioritaet
- Hosts muessen die Option in der Livesituation sofort finden koennen

### 2. Es gibt weiterhin genau ein aktives Blitzlicht

Die bestehende Produktregel bleibt erhalten:

- Es ist immer nur **ein** Blitzlicht gleichzeitig aktiv und sichtbar.
- Ein gestartetes Tempo-Blitzlicht ersetzt kein separates Parallelfeature, sondern ist selbst das aktuell aktive Blitzlicht.
- Startet der Host ein anderes Blitzlicht, ersetzt dieses das laufende Tempo-Blitzlicht.
- Tempo kann spaeter erneut gestartet werden.

Tempo laeuft damit nicht parallel zu einem zweiten Blitzlicht.

### 3. Tempo erhaelt eine eigene Interaktionssemantik innerhalb von `quickFeedback`

Die vier vordefinierten Tempo-Reaktionen sind:

- `🚀 Schneller`
- `🙂 Ich folge`
- `🐢 Langsamer`
- `😕 Verloren`

Fuer dieses Template gilt abweichend vom klassischen Einmal-Vote:

- eine teilnehmende Person kann ihre Auswahl jederzeit aendern
- ein Tap auf die aktuell aktive Option entfernt die Auswahl wieder
- pro teilnehmender Person zaehlt immer nur der **aktuelle** Zustand

Diese Semantik ist auf das Template `Tempo` begrenzt. Andere Blitzlicht-Typen bleiben unveraendert, solange keine explizite Folgeentscheidung etwas anderes festlegt.

### 4. Hosts sehen nur Aggregation und Tendenz

Hosts erhalten fuer Tempo ausschliesslich:

- aggregierte Verteilung
- Prozentwerte
- optional absolute Zahlen
- eine zusammenfassende Tendenz

Es werden keine individuellen Rueckmeldungen, keine Teilnehmerlisten und keine personenbezogenen Verlaufsdaten angezeigt.

Mindestens folgende Tendenzen muessen fachlich unterscheidbar sein:

- `Die Mehrheit kann folgen.`
- `Es wirkt zu schnell.`
- `Mehrere Teilnehmende sind abgehaengt.`
- `Die Gruppe kann schneller mitgehen.`
- `Die Rueckmeldungen sind gemischt.`

Zusaetzlich erhaelt die Host-Ansicht einen Umschalter zwischen:

- Detaildarstellung der Verteilung
- Tendenz-Indikator

Im Session-Kontext lebt dieser Umschalter im Blitzlicht-Bereich der Host-Ansicht. Im Standalone-Blitzlicht lebt er in der dortigen Host-Steuerung. Ein tab-spezifischer Indikator ist damit ausdruecklich **nicht** das Zielmodell.

Fuer das **Standalone-Blitzlicht** gilt zusaetzlich:

- der Tendenzmodus ist eine **prominente, große und raumeinnehmende Hauptinformation**
- die Lage muss fuer den Host **mit einem Blick** erfassbar sein, auch auf dem Smartphone waehrend des Vortrags
- sichtbar bleiben mindestens:
  - aktuelle Tendenz
  - Kennzahl `Online`
  - Kennzahl `Rueckmeldungen`
  - Umschalter zwischen `Details` und `Tendenz`
  - Aktion `Session beenden`

Die Host-UI priorisiert hier bewusst **Lesbarkeit vor Informationsdichte**.

Dasselbe Prinzip gilt fuer den Startseiten-Einstieg: **Spotlight statt vierter Pill**.
Dasselbe Prinzip gilt fuer die Blitzlicht-Host-Auswahl: **Spotlight statt Preset-Gleichfoermigkeit**.

Der Tendenz-Indikator muss dabei bewusst **ruhig** bleiben:

- keine Umschaltung wegen einzelner neuer Rueckmeldungen
- keine Aktivierung bei duennen Rueckmeldungen
- keine Bewertung nur relativ zu den abgegebenen Tempo-Rueckmeldungen

Bezugsbasis fuer Aktivierung und Schwellwerte ist die **gesamte aktive Teilnehmendenbasis des jeweiligen Blitzlicht-Kontexts**, nicht nur die aktuelle Zahl der Tempo-Rueckmeldungen.

Empfohlene Leitplanken:

- neutraler Zustand, solange weniger als `max(8, 10 % der aktiven Teilnehmenden)` eine Tempo-Rueckmeldung abgegeben haben
- geglaettete Berechnung ueber ein kurzes Rolling Window, z. B. `60s`
- Hysterese, sodass ein Indikatorwechsel erst nach stabiler Tendenz oder klarer Marge erfolgt

### 5. Die technische Umsetzung bleibt im Blitzlicht-Hotpath

Die Implementierung erfolgt innerhalb des bestehenden `quickFeedback`-Stacks:

- Shared Types fuer Typ, Werte und Ergebnis-Metadaten werden erweitert.
- Backend-Logik bleibt im `quickFeedback`-Router oder eng benachbarter Hilfslogik.
- Frontend-Host- und Vote-Views werden im bestehenden Blitzlicht-Flow erweitert.
- Session- und Standalone-Host teilen dabei dieselbe fachliche Tendenzlogik, auch wenn die Einbettung im UI unterschiedlich ist.
- Der Standalone-Host darf fuer `Tempo` eine deutlich aufmerksamkeitsstaerkere Darstellung verwenden als die eingebettete Session-Ansicht.
- Die Startseite darf fuer `Tempo` eine deutlich aufmerksamkeitsstaerkere Darstellung verwenden als die regulaeren Hero-Chips, solange das 3-Chip-Modell selbst nicht aufgeweicht wird.
- Die Blitzlicht-Host-Auswahl darf fuer `Tempo` eine deutlich aufmerksamkeitsstaerkere Darstellung verwenden als fuer normale Presets, solange die restliche Auswahl weiterhin klar bedienbar bleibt.

Es wird **kein** neues Session-Channel-Modell eingefuehrt.

### 6. Performance ist harte Randbedingung

Tempo ist trotz Wiedernutzung des Blitzlicht-Stacks ein performance-kritisches Feature.

Verbindlich:

- keine neue polling-intensive Live-Strecke
- kein Datenbank-Hotpath pro Tap
- keine Vollrekonstruktion aller Stimmen pro Update
- keine spuerbare Zusatzlast bei Sessions mit 500+ Teilnehmenden

Die bevorzugte technische Richtung ist:

- deltabasiertes Fortschreiben des aktuellen Zustands je Teilnehmer:in
- delta-basierte Redis-Aggregation fuer Counts
- Bucket-Aggregation fuer ein kurzes Rolling Window statt dauernder Vollreanalyse
- typ-spezifische Mutabilitaet fuer `Tempo`, ohne klassische Einmal-Vote-Regel global aufzubrechen

## Konsequenzen

### Positiv

- Das Produkt bleibt konzeptionell einfacher als mit einem vierten Session-Kanal.
- Die bestehende Host- und Teilnehmer-IA muss nicht auf einen neuen Kanal ausgeweitet werden.
- Der Implementierungsaufwand konzentriert sich auf einen klar umrissenen Blitzlicht-Hotpath.
- Tempo kann schnell startbar und fuer Hosts sichtbar gemacht werden, ohne das Session-Modell zu verbreitern.

### Negativ / Risiken

- Tempo kann nicht parallel zu einem anderen Blitzlicht laufen.
- Die bisherige `quickFeedback`-Logik muss fuer ein einzelnes Template von Einmal-Vote auf mutables Verhalten erweitert werden.
- Template-spezifische Semantik im Blitzlicht-Modell erfordert saubere Typgrenzen, damit andere Blitzlicht-Typen nicht unbeabsichtigt regressieren.
- Die Tendenzlogik darf die Host-Ansicht weder ueberfrachten noch unruhig wirken lassen.

## Alternativen

- **Eigener vierter Session-Kanal:** verworfen; zu hoher Architektur- und UI-Aufwand fuer das eigentliche Produktziel.
- **Tempo als normales ABCD-/Mood-Blitzlicht ohne eigene Semantik:** verworfen; Labels, Toggle-off und Tendenz waeren fachlich unscharf.
- **Permanentes Parallel-Widget fuer Teilnehmende:** verworfen; wuerde wieder auf einen separaten Kanal hinauslaufen und die bestehende IA aufbrechen.

## Implementierungsstand (2026-06-04)

Diese ADR ist umgesetzt. Der aktuelle Code folgt dem Zielmodell `Tempo als Blitzlicht-Template`, nicht dem frueheren Zielbild eines vierten Session-Kanals.

Aktueller Stand:

- `QuickFeedbackTypeEnum` enthaelt `TEMPO`; `TempoValueEnum` definiert `SPEED_UP`, `FOLLOWING`, `SLOW_DOWN`, `LOST`.
- `QuickFeedbackResultSchema` enthaelt optional `tempoTrend` mit `status`, `active`, `activeParticipants`, `tempoVotes`, `requiredVotes`, `windowSeconds` und `bucketSeconds`.
- `SessionLiveChannelSchema` bleibt bei `quiz`, `qa`, `quickFeedback`; es gibt keinen vierten `tempo`-Kanal.
- `quickFeedback.vote` verzweigt fuer `TEMPO` auf einen atomaren Redis-Lua-Hotpath: Wechsel, Re-Tap-Entfernen, Verteilung, `qf:choices:*` und `qf:tempo:buckets:*` werden ohne PostgreSQL-Schreibpfad pro Tap fortgeschrieben.
- Die Tendenzlogik liegt in `apps/backend/src/lib/quickFeedbackTempo.ts` mit 15-Sekunden-Buckets, 60-Sekunden-Fenster, Mindestquote und Hysterese.
- Die Startseite und die Blitzlicht-Host-Auswahl enthalten eine Tempo-Spotlight-Kachel; der Startseiten-CTA lautet `Tempo-Feedback`.
- Die Host-UI bietet Detail- und Tendenzmodus mit den Kennzahlen `Online` und `Rueckmeldungen`; Teilnehmende koennen ihre Tempo-Auswahl wechseln, per Re-Tap entfernen und im Vote-Client per Backdrop zuruecksetzen.
- Die 500-Teilnehmenden-Abnahme wurde mit parallel abgegebenen Tempo-Rueckmeldungen validiert.

## Referenzen

- `Backlog.md` Story `8.8`
- Issue `#17`: `Tempo-Blitzlicht als Host-Option (statt eigenem Session-Kanal)`
- [ADR-0010: Blitzlicht als Kernmodus mit konsistenter UX in Startseite und Live-Session](./0010-blitzlicht-as-core-live-mode.md)
- [ADR-0013: k6 und Artillery fuer Last- und Performance-Tests](./0013-use-k6-and-artillery-for-load-and-performance-testing.md)
- [ADR-0014: Mobile-first Informationsarchitektur fuer Host-Views](./0014-mobile-first-information-architecture-for-host-views.md)
- [ADR-0019: Host-Haertung und besitzgebundene Session-Zugriffe ohne Accounts](./0019-host-hardening-and-owner-bound-session-access.md)
- [ADR-0022: Tempo-Livekanal als kontinuierlicher Session-Kanal](./0022-tempo-live-channel-as-continuous-session-channel.md)
- [ADR-0025: Kuenftige Erweiterungen bis zum Gegenbeweis als performance-kritisch behandeln](./0025-treat-future-extensions-as-performance-critical-until-proven-otherwise.md)
