<!-- markdownlint-disable MD013 -->

# Story 8.8 - GitHub-Issue- und PR-Checkliste

**Kurzfassung fuer GitHub-Artefakte**  
Diese Datei ist die kompakte Ableitung aus dem Implementierungsplan fuer Story 8.8. Sie ist fuer **Issue-Body**, **PR-Beschreibung** und **Review-Checklisten** gedacht.

**Kanondokumente:**

- [Implementierungsplan](./STORY-8.8-IMPLEMENTATION-PLAN.md)
- [ADR-0029 Tempo als Blitzlicht-Template](../architecture/decisions/0029-tempo-as-predefined-blitzlicht-template.md)
- [Backlog Story 8.8](../../Backlog.md)

---

## GitHub-Issue-Vorlage

### Titel

`Story 8.8: Tempo-Blitzlicht als Host-Option`

### Kurzbeschreibung

Als Lehrperson moechte ich im bestehenden Blitzlicht ein vordefiniertes Tempo-Blitzlicht starten koennen, damit Teilnehmende waehrend eines Vortrags jederzeit anonym rueckmelden koennen, ob sie folgen, ob es schneller gehen darf, ob es zu schnell ist oder ob sie abgehaengt sind.

### Akzeptanzkriterien

- [ ] Tempo ist ein **vordefiniertes Blitzlicht-Template** im bestehenden `quickFeedback`-Kanal.
- [ ] Es entsteht **kein** vierter Session-Kanal, kein `tempoRouter`, kein `tempoEnabled`/`tempoOpen` im Prisma-Sessionmodell und kein persistentes Parallel-Widget.
- [ ] Hosts koennen Tempo im Session-Blitzlicht und im Standalone-Blitzlicht starten; pro Kontext ist weiterhin genau ein Blitzlicht aktiv.
- [ ] Startet der Host ein anderes Blitzlicht, ersetzt es das laufende Tempo-Blitzlicht.
- [ ] Teilnehmende sehen genau vier Optionen: `🚀 Schneller`, `🙂 Ich folge`, `🐢 Langsamer`, `😕 Verloren`.
- [ ] Eine Auswahl kann mit einem Tap gesetzt, durch einen anderen Tap gewechselt und durch Re-Tap oder Backdrop zurueckgesetzt werden.
- [ ] Pro teilnehmender Person zaehlt immer nur der aktuelle Tempo-Zustand.
- [ ] Klassische Blitzlicht-Typen bleiben bei ihrer Einmal-Vote-Semantik.
- [ ] Hosts sehen nur Aggregation, Prozentwerte und Tendenz, keine individuellen Rueckmeldungen oder Teilnehmerlisten.
- [ ] Die Tendenzlogik unterscheidet mindestens: `Die Mehrheit kann folgen.`, `Es wirkt zu schnell.`, `Mehrere Teilnehmende sind abgehaengt.`, `Die Gruppe kann schneller mitgehen.`, `Die Rueckmeldungen sind gemischt.`, `Noch zu wenige Rueckmeldungen.`
- [ ] Die Host-Ansicht bietet einen Umschalter zwischen `Details` und `Tendenz`.
- [ ] Im Standalone-Host sind die Kennzahlen `Online` und `Rueckmeldungen` sichtbar, ohne redundante Doppelungen wie `0 Rueckmeldungen` direkt unter `Rueckmeldungen`.
- [ ] Die Startseite zeigt Tempo als Spotlight-Einstieg mit CTA `Tempo-Feedback`, nicht als vierten gleichrangigen Hero-Chip.
- [ ] Die Blitzlicht-Host-Auswahl zeigt Tempo ebenfalls als Spotlight-Kachel.
- [ ] Die vier Tempo-Icons bleiben auf Smartphone, Tablet, Desktop und Host-Ansicht gross genug, horizontal zentriert und ohne Layout-Ueberlappung.
- [ ] Die technische Umsetzung bleibt im Redis-Hotpath: kein PostgreSQL-Schreibpfad pro Tap, keine Vollreaggregation pro Event.
- [ ] Parallel abgegebene Tempo-Rueckmeldungen von 500 Teilnehmenden werden korrekt aggregiert.

### Architekturleitplanken

- [ ] Shared Types zuerst: `QuickFeedbackTypeEnum` enthaelt `TEMPO`, `TempoValueEnum` die vier Werte und `TempoTrendSchema` die Host-Metadaten.
- [ ] Backend-Verzweigung bleibt in `quickFeedback.vote`; ein atomarer Redis-Lua-Hotpath verhindert verlorene Updates bei parallelen Wechseln.
- [ ] Tempo-Buckets liegen kurzlebig in Redis (`qf:tempo:buckets:*`) und speisen die 60s/15s-Tendenz.
- [ ] `SessionLiveChannelSchema` bleibt bei `quiz | qa | quickFeedback`.
- [ ] Host-only-Aktionen laufen weiter ueber Session-Host-Token bzw. Feedback-Host-Token.
- [ ] Frontend bleibt Angular Standalone + Signals + Material 3; kein `::ng-deep`.
- [ ] UI-Texte sind in `de`, `en`, `fr`, `es`, `it` synchron.

### Nicht-Ziele

- [ ] Kein vierter Session-Kanal.
- [ ] Kein separater `tempoRouter`.
- [ ] Keine Prisma-Persistenz fuer Tempo-Rueckmeldungen.
- [ ] Keine personenbezogene Verlaufsanalyse.
- [ ] Keine dauerhafte Tempo-Ereignishistorie.
- [ ] Keine globale Umstellung aller Blitzlicht-Typen auf mutable Votes.

### Empfohlene Delivery-Slices

- [ ] PR 1: Shared Types + zentrale Tempo-Konfiguration
- [ ] PR 2: Backend-Hotpath + Tendenzlogik
- [ ] PR 3: Vote-Client-Interaktion + Backdrop-Reset
- [ ] PR 4: Host-UX mit Details/Tendenz, Kennzahlen und Spotlight-Auswahl
- [ ] PR 5: Startseiten-Spotlight + i18n
- [ ] PR 6: Tests, 500-Teilnehmenden-Abnahme und Doku-Abgleich

---

## PR-Beschreibung

### Titel

`Story 8.8: Tempo-Blitzlicht als QuickFeedback-Template`

### Enthalten

- [ ] `TEMPO` als QuickFeedback-Typ und vier Tempo-Werte in `@arsnova/shared-types`.
- [ ] Mutable Tempo-Rueckmeldungen im bestehenden `quickFeedback`-Router.
- [ ] Atomare Redis-Aggregation fuer parallele Wechsel und Re-Taps.
- [ ] Tendenzlogik mit Mindestquote, 15s-Buckets, 60s-Fenster und Hysterese.
- [ ] Vote-Client mit aktivem Zustand, Wechsel, Re-Tap und Backdrop-Reset.
- [ ] Host-Ansicht mit `Details`/`Tendenz`, `Online` und `Rueckmeldungen`.
- [ ] Spotlight-Einstieg auf Startseite und in der Host-Auswahl.
- [ ] Lokalisierung fuer `de`, `en`, `fr`, `es`, `it`.
- [ ] Backend- und Frontend-Tests plus Last-/Abnahmecheck fuer 500 Teilnehmende.

### Nicht enthalten

- [ ] Kein vierter Session-Kanal.
- [ ] Kein `tempoRouter`.
- [ ] Keine Prisma-Migration fuer Tempo-Zustand.
- [ ] Keine personenbezogenen Host-, Presenter- oder Admin-Payloads.

### Validierung

- [ ] `npm run build -w @arsnova/shared-types`
- [ ] `npm run test -w @arsnova/backend -- src/__tests__/quickFeedback.vote-session.test.ts`
- [ ] relevante Frontend-Specs fuer `feedback-host`, `feedback-vote` und `home`
- [ ] `npm run build:localize -w @arsnova/frontend`
- [ ] 500 parallele Tempo-Rueckmeldungen in einer Session aggregieren ohne verlorene Counts
- [ ] `npx prettier --check` und `git diff --check` fuer geaenderte Markdown-Dateien

### Review-Fokus

- [ ] Keine Regression klassischer Blitzlicht-Typen.
- [ ] Kein Race bei parallelen Tempo-Wechseln.
- [ ] Keine individuellen Rueckmeldungen in Host-/Presenter-/Admin-Payloads.
- [ ] Wording bleibt menschlich: `Rueckmeldungen`, `Online`, `Tempo-Feedback`; keine UI-Texte wie `Signale`, `heterogen`, `Tempo starten`.
- [ ] Spotlight-Layout ueberlappt auf der Startseite keine Hero-Pills und bleibt auf Mobile zentriert.
- [ ] Host-Ansicht wirkt ruhig: wenige Umrandungen, klare Flaechen, genug Abstand zur App-Toolbar.
- [ ] Vote-Client ist freundlich formuliert, ohne redundante Rollenzeilen und ohne sichtbare `#` vor Session-Codes.

---

## Merge-Checkliste

- [ ] Story `8.8` und `ADR-0029` sind im PR verlinkt.
- [ ] Diff ist in `shared-types -> backend -> frontend -> tests -> docs` nachvollziehbar.
- [ ] Neue oder geaenderte Vertraege sind in `libs/shared-types` abgebildet.
- [ ] Serverseitige Autorisierung ist fuer Host-Aktionen vorhanden.
- [ ] `TEMPO` bleibt fachlich im Blitzlicht-Pfad und erzeugt keinen neuen Session-Kanal.
- [ ] Keine personenbezogenen Tempo-Daten werden an Host-, Presenter- oder Admin-Pfade ausgeliefert.
- [ ] Fokussierte Tests laufen gruen.
- [ ] Lokalisierung und Markdown-Doku sind synchron.
