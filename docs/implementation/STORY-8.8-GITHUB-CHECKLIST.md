<!-- markdownlint-disable MD013 -->

# Story 8.8 – GitHub-Issue- und PR-Checkliste

**Kurzfassung fuer GitHub-Artefakte**  
Diese Datei ist die kompakte Ableitung aus dem Implementierungsplan fuer Story 8.8. Sie ist fuer **Issue-Body**, **PR-Beschreibung** und **Review-Checklisten** gedacht.

**Kanondokumente:**

- [Implementierungsplan](./STORY-8.8-IMPLEMENTATION-PLAN.md)
- [ADR-0022 Tempo-Livekanal](../architecture/decisions/0022-tempo-live-channel-as-continuous-session-channel.md)
- [Backlog Story 8.8](../../Backlog.md)

---

## GitHub-Issue-Vorlage

### Titel

`Story 8.8: Tempo-Livekanal als kontinuierlicher vierter Session-Kanal`

### Kurzbeschreibung

Als Lehrperson moechte ich einen persistenten Tempo-Livekanal in einer laufenden ARSnova-Session aktivieren koennen, damit Teilnehmende waehrend eines Vortrags jederzeit anonym signalisieren koennen, ob sie folgen, ob es schneller gehen darf, ob es zu schnell ist oder ob sie abgehaengt sind.

### Akzeptanzkriterien

- [ ] Tempo ist ein **eigener vierter Session-Kanal** und wird nicht als Blitzlicht-Typ, Quizfrage oder Gamification-Mechanik modelliert.
- [ ] Hosts koennen den Kanal pro Session aktivieren, schliessen und wieder oeffnen.
- [ ] Teilnehmende sehen genau vier Zustaende: `speed_up`, `following`, `slow_down`, `lost`.
- [ ] Ein Tap setzt den Zustand; spaetere Taps koennen ihn aendern und optional entfernen; pro `participantId` zaehlt immer nur der letzte Zustand.
- [ ] Der Kanal laeuft parallel zu Quiz, Q&A und Blitzlicht und wird durch deren Lebenszyklen nicht beendet oder ueberschrieben.
- [ ] Teilnehmende nutzen Tempo als **persistentes, mobile-first erreichbares Widget** innerhalb der Session-Vote-Ansicht.
- [ ] Hosts sehen nur **aggregierte** Daten: Verteilung, Prozentwerte, optional absolute Zahlen und Tendenz.
- [ ] Es sind keine individuellen Rueckmeldungen oder Identitaeten aus Host-, Presenter- oder Admin-Pfaden rekonstruierbar.
- [ ] Die Tendenzlogik unterscheidet mindestens: Mehrheit kann folgen, Tempo zu hoch, mehrere abgehaengt, Unterforderung, heterogene Gruppe.
- [ ] Die vier Zustaende sind auf Smartphones ohne horizontales Scrollen erreichbar und erfuellen die projektweiten A11y-Regeln.
- [ ] Die technische Umsetzung verwendet ein eigenes Daten- und API-Modell; Blitzlicht-Logik wird nicht wiederverwendet.

### Architekturleitplanken

- [ ] Session-Konfiguration liegt in PostgreSQL / Prisma: `tempoEnabled`, `tempoOpen`.
- [ ] Livezustand liegt in Redis; keine PostgreSQL-Schreiboperation bei jedem Tap.
- [ ] Redis-Key-Basis ist `sessionCode` in Uppercase.
- [ ] `tempo:state:<SESSION_CODE>` ist die minimale Quelle der Wahrheit; Counts und Trend bleiben abgeleitete Caches.
- [ ] Aktives Session-Ende entfernt `tempo:*:<SESSION_CODE>`-Keys explizit; zusaetzlich gilt ein Fallback-TTL.
- [ ] Host-only-Aktionen laufen serverseitig ueber `hostProcedure`.

### Nicht-Ziele

- [ ] Kein Standalone-Tempo-Pfad in der ersten Ausbaustufe.
- [ ] Kein neuer Blitzlicht-Typ.
- [ ] Keine personenbezogene Verlaufsanalyse.
- [ ] Keine dauerhafte Tempo-Ereignis-Historie in PostgreSQL.

### Empfohlene Delivery-Slices

- [ ] PR 1: Vertraege + Session-Konfiguration
- [ ] PR 2: Tempo-Backend-Hotpath
- [ ] PR 3: Shell-Refactor fuer vier Kanaele
- [ ] PR 4: Host-UI fuer Tempo
- [ ] PR 5: Teilnehmer-Widget + A11y
- [ ] PR 6: Feinschliff + Nachweise

---

## PR-Vorlagen

Die folgenden Bloecke sind bewusst knapp und koennen direkt als PR-Beschreibung uebernommen werden.

### PR 1 – Vertraege + Session-Konfiguration

**Titel:** `Story 8.8 / PR 1: Shared Types und Session-Konfiguration fuer Tempo`

**Enthalten**

- [ ] `SessionChannelsDTO` um `tempo` erweitern
- [ ] Tempo-Zod-Schemas und DTOs in `libs/shared-types`
- [ ] `CreateSessionInputSchema` um `tempoEnabled` erweitern
- [ ] Prisma-Felder `tempoEnabled`, `tempoOpen`
- [ ] Migration anlegen
- [ ] `buildSessionChannels()` und `session.create` erweitern

**Nicht enthalten**

- [ ] kein `tempoRouter`
- [ ] keine Host- oder Teilnehmer-UI
- [ ] keine Trendlogik

**Validierung**

- [ ] `@arsnova/shared-types` Build
- [ ] Backend-Typecheck
- [ ] `apps/backend/src/__tests__/session.enable-channels.test.ts`
- [ ] `apps/backend/src/__tests__/session.create.test.ts`

**Review-Fokus**

- [ ] Vertrag sauber um vierten Kanal erweitert
- [ ] keine Regression fuer `qa` und `quickFeedback`
- [ ] Prisma- und Schema-Aenderungen konsistent

### PR 2 – Tempo-Backend-Hotpath

**Titel:** `Story 8.8 / PR 2: Tempo-Router und Redis-Hotpath`

**Enthalten**

- [ ] `apps/backend/src/routers/tempo.ts`
- [ ] `setState`, `getOwnState`, `hostSnapshot`, `onHostSnapshot`
- [ ] Gating fuer `tempoEnabled`, `tempoOpen`, `status !== FINISHED`
- [ ] Redis-Keying, Count-Pflege, Trend-Buckets, Cleanup/TTL
- [ ] Router-Registrierung in `apps/backend/src/routers/index.ts`

**Nicht enthalten**

- [ ] keine sichtbare Tempo-UI
- [ ] kein Shell-Refactor im Frontend

**Validierung**

- [ ] Backend-Typecheck
- [ ] neuer fokussierter Tempo-Test, z. B. `apps/backend/src/__tests__/tempo.test.ts`
- [ ] Erfolgspfad und Fehlerpfad fuer Host/Teilnehmende abgedeckt

**Review-Fokus**

- [ ] keine personenbezogenen Host-Payloads
- [ ] keine Blitzlicht-Semantik uebernommen
- [ ] Redis-Lifecycle und Drift-Regeln nachvollziehbar

### PR 3 – Shell-Refactor fuer vier Kanaele

**Titel:** `Story 8.8 / PR 3: Host- und Vote-Shell fuer vier Kanaele refactoren`

**Enthalten**

- [ ] `SessionChannelTab` in Host/Vote um `tempo` erweitern
- [ ] `visibleChannels`, `channelOpenState`, `channelLabel`, `channelTabMetaLabel` erweitern
- [ ] falsche QuickFeedback-Autofokus-Annahmen entfernen
- [ ] Navigation fuer bestehenden 3-Kanal-Bestand stabil halten

**Nicht enthalten**

- [ ] keine finale Tempo-Visualisierung
- [ ] keine finalen Tempo-Widgets

**Validierung**

- [ ] `apps/frontend/src/app/features/session/session-host/session-host.component.spec.ts`
- [ ] `apps/frontend/src/app/features/session/session-vote/session-vote.component.spec.ts`
- [ ] Frontend-Typecheck

**Review-Fokus**

- [ ] keine Regression in Quiz, Q&A oder Blitzlicht
- [ ] Tempo kapert die Teilnehmernavigation nicht

### PR 4 – Host-UI fuer Tempo

**Titel:** `Story 8.8 / PR 4: Tempo-Host-Tab und Aggregatdarstellung`

**Enthalten**

- [ ] Aktivieren / Schliessen / Wiederoeffnen des Tempo-Kanals
- [ ] Tempo-Tab im Host
- [ ] Snapshot-Darstellung fuer Verteilung und Tendenz
- [ ] Meta-/Badge-Konzept fuer den Host-Tab

**Nicht enthalten**

- [ ] kein Teilnehmer-Widget

**Validierung**

- [ ] Host-Spec
- [ ] Frontend-Typecheck

**Review-Fokus**

- [ ] Aggregat lesbar, ruhig und nicht nur farbbasiert
- [ ] keine Leckage individueller Daten

### PR 5 – Teilnehmer-Widget + A11y

**Titel:** `Story 8.8 / PR 5: Persistentes Tempo-Widget in der Vote-Ansicht`

**Enthalten**

- [ ] persistentes Tempo-Widget in `session-vote`
- [ ] Own-State-Rehydrierung
- [ ] Mutation fuer Setzen / Aendern / Entfernen
- [ ] Bottom-Bar-Koordination
- [ ] `aria-pressed`, Labels, mobile Layoutregeln

**Nicht enthalten**

- [ ] keine weiteren Backend-Vertraege ausser noetigen UI-Anschluessen

**Validierung**

- [ ] Vote-Spec
- [ ] Frontend-Typecheck

**Review-Fokus**

- [ ] kein horizontaler Scroll auf kleinen Screens
- [ ] kein Konflikt mit Submit- oder Session-End-Aktionen
- [ ] aktiver Zustand semantisch klar markiert

### PR 6 – Feinschliff + Nachweise

**Titel:** `Story 8.8 / PR 6: Tendenz-Feinschliff, UX-Nachweise und Doku-Abgleich`

**Enthalten**

- [ ] Tendenzschwellen kalibrieren
- [ ] Copy / i18n nur falls fuer Tempo noetig
- [ ] Doku-Abgleich mit Implementierungsstand
- [ ] Abschluss-Checkliste fuer Review und UX-Tests

**Validierung**

- [ ] fokussierte Frontend- und Backend-Tests
- [ ] `npm run typecheck`
- [ ] `npm test` oder begruendete Teilmengen

**Review-Fokus**

- [ ] Story-DoD wirklich nachgewiesen
- [ ] keine offenen Architektur- oder Datenschutzbefunde

---

## Merge-Checkliste pro PR

- [ ] PR-Scope entspricht genau einem Delivery-Slice.
- [ ] Nicht-Ziele des PRs sind explizit benannt.
- [ ] Neue oder geaenderte Vertraege sind in `libs/shared-types` abgebildet.
- [ ] Serverseitige Autorisierung ist fuer Host-Aktionen vorhanden.
- [ ] Keine personenbezogenen Tempo-Daten werden an Host-, Presenter- oder Admin-Pfade ausgeliefert.
- [ ] Fokussierte Tests fuer den geaenderten Slice laufen gruen.
- [ ] Der PR fuehrt keine implizite Blitzlicht-Wiederverwendung fuer Tempo ein.
