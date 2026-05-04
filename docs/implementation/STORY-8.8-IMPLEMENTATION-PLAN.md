<!-- markdownlint-disable MD013 -->

# Story 8.8 – Implementierungsplan: Tempo-Livekanal

**Epic 8 · Erweiterte Live-Kanaele (Q&A, Tempo)**  
**Ziel:** Ein vierter Session-Kanal `Tempo` wird als kontinuierlicher, anonymer Livekanal in ARSnova eingefuehrt. Teilnehmende koennen ihren kognitiven Zustand jederzeit mit einem Tap melden; Hosts sehen nur aggregierte Live-Werte und eine Tendenz.

**Backlog-Bezug:** `Story 8.8 Tempo-Livekanal`  
**Architekturbezug:** `ADR-0022`, `ADR-0009`, `ADR-0010`, `ADR-0014`, `ADR-0019`, `ADR-0021`

**Status:** 📌 Planungsdokument / vor Implementierung

---

## Zielbild

Der Tempo-Livekanal ist ein **eigener vierter Session-Kanal**:

- **Quiz**
- **Q&A**
- **Blitzlicht**
- **Tempo**

Fachliche Kerneigenschaften:

- **kontinuierlich**, nicht punktuell
- **parallel** zu Quiz, Q&A und Blitzlicht
- **anonym** im Produktsinn
- **pro teilnehmender Person genau ein aktueller Zustand**
- **kein Submit-Button**
- **keine Round-/Lock-/Vergleichslogik**

Die vier Zustände sind:

- `speed_up` → 🚀 Schneller
- `following` → 🙂 Ich folge
- `slow_down` → 🐢 Langsamer
- `lost` → 😵 Verloren

---

## SWE-Lehrfluss

Diese Story soll bewusst entlang eines sauberen SWE-Prozesses entwickelt werden:

1. **Feature Request / GitHub-Issue**
2. **Feature-Branch**
3. **Branch-Entwicklung**
4. **Pull Request**
5. **Code Review**
6. **UX-Tests**
7. **UX-Feintuning**
8. **Produktion**

Empfohlener Branchname:

- `codex/<issue-number>-tempo-livekanal`

---

## Ist-Stand (vor Umsetzung)

| Bereich            | Status                                                                                                                                                                                |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Session-Modell** | Session ist kanalbasiert erweitert, aber aktuell noch hart auf `quiz`, `qa`, `quickFeedback` zugeschnitten (`qaEnabled`, `quickFeedbackEnabled`, `quickFeedbackOpen`).                |
| **Shared Types**   | `SessionChannelsDTOSchema` kennt nur `quiz`, `qa`, `quickFeedback`. `SessionChannelTab` ist im Frontend ebenfalls auf drei Kanaele verdrahtet.                                        |
| **Blitzlicht**     | `quickFeedback` ist technisch ein punktueller Round-Mechanismus mit `locked`, `discussion`, `currentRound`, `already voted`, Redis-TTL.                                               |
| **Vote-Ansicht**   | Teilnehmer-Navigation ist tab-orientiert. Es gibt bereits Floating-/Bottom-Action-Konzepte, die mit einem persistenten Tempo-Widget kollidieren koennen.                              |
| **Host-Ansicht**   | Host-Shell hat einen klaren Kanalbegriff, Badge-/Meta-Labels und channel activation/open-state, aber nur fuer drei Kanaele.                                                           |
| **Realtime**       | tRPC-Subscriptions existieren; viele Session-Livepfade nutzen polling-basierte Subscription-Generatoren. Redis wird bereits fuer Livezustand, Rate-Limits und SLO-Telemetrie genutzt. |
| **Sicherheit**     | Host-only-Aktionen laufen ueber `hostProcedure`; Session-Code alleine verleiht keine Host-Rechte.                                                                                     |

---

## Nicht-Ziele

- **kein** neuer Blitzlicht-Typ
- **kein** neuer Quiz-Fragentyp
- **kein** Standalone-Tempo-Pfad in der ersten Ausbaustufe
- **keine** personenbezogene Verlaufsanalyse
- **keine** dauerhafte Ereignis-Historie in PostgreSQL
- **kein** Ranking oder Gamification-Mechanismus

---

## Architekturentscheidungen fuer die Umsetzung

### 1. Eigener Kanal, eigene Semantik

Tempo wird nicht auf `quickFeedback` aufgesetzt, sondern bekommt:

- eigene Schemas
- eigene tRPC-Procedures
- eigene Redis-Schluessel
- eigene Host-/Teilnehmer-UI

### 2. Session-Konfiguration in Postgres, Livezustand in Redis

- `Session` speichert nur **Kanal-Konfiguration** (`tempoEnabled`, `tempoOpen`)
- Redis speichert:
  - letzten Zustand je `participantId`
  - aggregierte Counts
  - Rolling Window fuer Trend / Tendenz

### 3. Unterschiedliche UI-Vertraege

- **Host:** eigener Kanal `Tempo` in der Session-Shell
- **Teilnehmende:** persistentes Widget innerhalb der Vote-Ansicht, kein erzwungener eigener Fokus-Tab

### 4. Datenschutzgrenze

Individuelle Tempo-Zustaende sind **technischer Innenzustand**, kein auslieferbarer Vertrag.

Hosts sehen nur:

- aggregierte Counts
- Prozentwerte
- optionale absolute Zahlen
- Tendenz

---

## Betroffene Dateien

### Shared Types / Schema

- `libs/shared-types/src/schemas.ts`

### Backend

- `prisma/schema.prisma`
- neue Migration unter `prisma/migrations/*`
- `apps/backend/src/routers/session.ts`
- `apps/backend/src/routers/index.ts`
- **neu:** `apps/backend/src/routers/tempo.ts`
- ggf. **neu:** `apps/backend/src/lib/tempo*.ts`
- ggf. `apps/backend/src/lib/sloTelemetry.ts`

### Frontend

- `apps/frontend/src/app/features/session/session-host/session-host.component.ts`
- `apps/frontend/src/app/features/session/session-host/session-host.component.html`
- `apps/frontend/src/app/features/session/session-host/session-host.component.scss`
- `apps/frontend/src/app/features/session/session-vote/session-vote.component.ts`
- `apps/frontend/src/app/features/session/session-vote/session-vote.component.html`
- `apps/frontend/src/app/features/session/session-vote/session-vote.component.scss`
- ggf. **neu:** `apps/frontend/src/app/features/session/tempo-*`

### Tests

- Backend-Tests unter `apps/backend/src/__tests__/`
- Frontend-Specs fuer Host/Vote-Komponenten

---

## Implementierungsstrategie

Die Umsetzung erfolgt in **7 Phasen**.

Jede Phase soll:

- kompilierbar bleiben
- testbar bleiben
- keine unscharfen Zwischenvertraege einfuehren

---

## Phase 1: Shared Types und Session-Kanalmodell erweitern

Ziel: Der vierte Kanal wird als offizieller Vertrag in `shared-types` und Session-DTOs verankert.

### Aufgaben

| #   | Task                                        | Beschreibung                                                                                                                                 | Datei                                               |
| --- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| 1.1 | **Tempo-State-Enum definieren**             | Neues Enum/Schema fuer `speed_up`, `following`, `slow_down`, `lost`.                                                                         | `libs/shared-types/src/schemas.ts`                  |
| 1.2 | **Tempo-DTOs definieren**                   | Eigene Schemas fuer Teilnehmerzustand, Host-Snapshot, Trend/Tendenz.                                                                         | `libs/shared-types/src/schemas.ts`                  |
| 1.3 | **SessionChannelsDTO erweitern**            | `SessionChannelsDTOSchema` um `tempo: { enabled, open }` erweitern.                                                                          | `libs/shared-types/src/schemas.ts`                  |
| 1.4 | **Session-Create-/Update-Inputs erweitern** | `CreateSessionInputSchema` optional um `tempoEnabled` erweitern; spaetere Host-Mutationen mit dedizierten Input-/Output-Schemas vorbereiten. | `libs/shared-types/src/schemas.ts`                  |
| 1.5 | **Stabile Namenskonventionen festlegen**    | Begriffe und API-Namen finalisieren: `tempo`, nicht `pace`, `speedFeedback` oder `feedback2`.                                                | `libs/shared-types/src/schemas.ts` + ADR-Konsistenz |

### Ergebnis

- `shared-types` beschreibt `Tempo` als offiziellen vierten Kanal
- alle Folgeschichten koennen strikt gegen Zod-Vertraege entwickeln

---

## Phase 2: Prisma-Sitzungskonfiguration und Migration

Ziel: Der Session-Datensatz kann den Kanal `Tempo` konfigurieren, ohne den Live-Hotpath in die DB zu ziehen.

### Aufgaben

| #   | Task                                   | Beschreibung                                                                                                       | Datei                                 |
| --- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------- |
| 2.1 | **Session-Felder ergänzen**            | `tempoEnabled Boolean @default(false)` und `tempoOpen Boolean @default(false)` in `Session` aufnehmen.             | `prisma/schema.prisma`                |
| 2.2 | **Migration erzeugen**                 | Neue Prisma-Migration fuer die beiden Session-Felder anlegen.                                                      | `prisma/migrations/*`                 |
| 2.3 | **Session-Channel-Building erweitern** | `buildSessionChannels()` in `session.ts` um `tempo` erweitern.                                                     | `apps/backend/src/routers/session.ts` |
| 2.4 | **Create-Flow erweitern**              | `session.create` so erweitern, dass neue Sessions optional direkt mit aktivem Tempo-Kanal angelegt werden koennen. | `apps/backend/src/routers/session.ts` |

### Ergebnis

- Tempo wird als Session-Funktion wie Q&A/Blitzlicht konfigurierbar
- Live-Daten bleiben weiterhin ausserhalb von Prisma

---

## Phase 3: Redis-Datenmodell und Tempo-Router

Ziel: Ein performanter, datensparsamer Live-Hotpath fuer den Tempo-Kanal.

### Redis-Zielmodell

Empfohlen:

- `tempo:state:<sessionCode>` oder `tempo:state:<sessionId>`  
  Hash `participantId -> state`
- `tempo:counts:<sessionCode>`  
  Hash `state -> count`
- `tempo:events:<sessionCode>:<bucket>`  
  Rolling-Window-Zaehlungen fuer Trend/Tendenz

### Verbindliche Vorab-Entscheidungen fuer Redis-Lifecycle

Damit Phase 3 nicht in einen unscharfen Hotpath-Refactor kippt, werden fuer die erste Umsetzung folgende Punkte **vorab festgelegt**:

- **Redis-Key-Basis ist `sessionCode` in Uppercase**, nicht `sessionId`.
  Begründung: Die bestehenden Session-/Host-/Teilnehmer-Pfade und der Blitzlicht-Hotpath arbeiten bereits codezentriert; damit entfaellt ein zusatzlicher DB-Lookup pro Tap nur zur Redis-Adressierung.
- **`tempo:state:<SESSION_CODE>` ist die minimale Quelle der Wahrheit.**
  `tempo:counts:*` und `tempo:events:*` sind abgeleitete Caches, die deltabasiert gepflegt werden.
- **Aktives Schliessen des Kanals loescht keine Tempo-Daten.**
  `tempoOpen = false` blendet nur das Widget aus; beim Wiederoeffnen bleibt der Kanal ohne Neuinitialisierung nutzbar.
- **Explizites Cleanup erfolgt beim Session-Ende.**
  Wenn `session.finish` oder ein aequivalenter FINISHED-Uebergang erreicht wird, werden alle `tempo:*:<SESSION_CODE>`-Keys aktiv entfernt.
- **Zusaetzlich gilt ein Fallback-TTL auf allen Tempo-Keys.**
  Empfohlen: `24h`, erneuert bei jeder Mutation, damit liegengebliebene Keys auch dann verschwinden, wenn explizites Cleanup ausfaellt.
- **Leere oder fehlende Redis-Keys muessen als gueltiger Leerzustand behandelbar sein.**
  `getOwnState` und `hostSnapshot` duerfen aus fehlenden Keys keinen Serverfehler ableiten.

### Drift- und Rebuild-Regeln

- Counts werden im Hotpath **deltabasiert** fortgeschrieben.
- Falls `tempo:counts:*` fehlt oder offensichtlich inkonsistent ist, darf der Host-Snapshot die Counts **einmalig aus `tempo:state:*` rekonstruieren**.
- Trend-Buckets werden **nicht** als personenbezogene Historie verstanden, sondern nur als kurzlebige Aggregatbasis fuer die Tendenz.

### Aufgaben

| #   | Task                                   | Beschreibung                                                                                                                   | Datei                               |
| --- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------- |
| 3.1 | **Tempo-Router anlegen**               | Neuer Router `tempo.ts` mit dedizierten Procedures.                                                                            | `apps/backend/src/routers/tempo.ts` |
| 3.2 | **Teilnehmer-Mutation `setState`**     | Setzt oder ersetzt den aktuellen Zustand eines `participantId` fuer eine Session. Optional: gleicher Tap entfernt den Zustand. | `apps/backend/src/routers/tempo.ts` |
| 3.3 | **Host-Query `hostSnapshot`**          | Liefert aggregierte Counts, Prozentwerte, Total und Trend/Tendenz.                                                             | `apps/backend/src/routers/tempo.ts` |
| 3.4 | **Teilnehmer-Query `getOwnState`**     | Liefert nur den eigenen aktuellen Zustand fuer UI-Rehydrierung.                                                                | `apps/backend/src/routers/tempo.ts` |
| 3.5 | **Host-Subscription `onHostSnapshot`** | Liefert neue aggregierte Snapshots nur bei Aenderung.                                                                          | `apps/backend/src/routers/tempo.ts` |
| 3.6 | **Session-Gating**                     | `tempoEnabled`, `tempoOpen` und `status !== FINISHED` serverseitig pruefen.                                                    | `apps/backend/src/routers/tempo.ts` |
| 3.7 | **Host-Autorisierung**                 | Host-only-Aktionen nur ueber `hostProcedure` bzw. host-token-gepruefte Pfade.                                                  | `apps/backend/src/routers/tempo.ts` |
| 3.8 | **Router registrieren**                | `tempoRouter` in `apps/backend/src/routers/index.ts` einhaengen.                                                               | `apps/backend/src/routers/index.ts` |

### Wichtige Regeln

- keine individuellen Listen fuer Hosts
- keine personenbezogenen Exporte
- keine PostgreSQL-Schreiboperation bei jedem Tap
- deltabasierte Zaehlerpflege statt Voll-Rescan pro Mutation
- `tempo:state:*` bleibt die fachliche Mindestquelle; Counts/Trend bleiben abgeleitete Caches

### Ergebnis

- Tempo-Hotpath ist livefaehig und datensparsam

---

## Phase 4: Session-Router und Shell-Refactor fuer den vierten Kanal

Ziel: Die bestehende Shell wird vom hart verdrahteten 3-Kanal-Modell auf 4 Kanaele erweitert.

### Aufgaben

| #   | Task                                      | Beschreibung                                                                                                               | Datei                                                    |
| --- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| 4.1 | **Enable/Open/Close-Mutationen ergänzen** | `enableTempoChannel`, `closeTempoChannel`, `reopenTempoChannel` analog zu Q&A/Blitzlicht.                                  | `apps/backend/src/routers/session.ts`                    |
| 4.2 | **Frontend-Channel-Unions erweitern**     | `SessionChannelTab` in Host/Vote auf `tempo` erweitern.                                                                    | `session-host.component.ts`, `session-vote.component.ts` |
| 4.3 | **Visible/Open-State Refactor**           | `channels`, `channelOpenState`, `visibleChannels`, `channelLabel`, `channelTabMetaLabel` fuer den vierten Kanal erweitern. | Host/Vote-Komponenten                                    |
| 4.4 | **Badge-/Meta-Konzept definieren**        | Tempo-Metadaten fuer Host-Tab festlegen, z. B. dominante Tendenz oder Hinweis `Live`.                                      | `session-host.component.ts`                              |
| 4.5 | **Kein falscher Auto-Fokus**              | Sicherstellen, dass Tempo nicht die Teilnehmernavigation kapert wie eine aktive Blitzlicht-Runde.                          | `session-vote.component.ts`                              |

### Ergebnis

- die Session-Shell kennt offiziell vier Kanaele
- bestehende Q&A-/Blitzlicht-Logik bleibt intakt

---

## Phase 5: Host-UI fuer Aktivierung und Auswertung

Ziel: Hosts koennen den Kanal aktivieren und aggregiert auswerten.

### Zielbild Host

- Kanal `Tempo` in den Session-Tabs
- Aktivieren, schliessen, wieder oeffnen
- Aggregatsicht mit:
  - 4 Segmenten / Balken
  - Prozenten
  - optional absoluten Zahlen
  - Tendenz

### Aufgaben

| #   | Task                             | Beschreibung                                                                                             | Datei                               |
| --- | -------------------------------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| 5.1 | **Tempo-Panel im Host einbauen** | Neuer Kanalzweig im Host-Template fuer `activeChannel() === 'tempo'`.                                    | `session-host.component.html`       |
| 5.2 | **Host-State-Signale ergänzen**  | Signale fuer `tempoSnapshot`, Loading, Fehler, evtl. Tendenz und absolute Zahlen.                        | `session-host.component.ts`         |
| 5.3 | **Live-Abo integrieren**         | Host-Snapshot per Query + Subscription / Fallback-Polling anbinden.                                      | `session-host.component.ts`         |
| 5.4 | **Visualisierung bauen**         | Segmentierte Verteilung und lesbare Tendenz bauen, ohne auf Farbe allein zu setzen.                      | `session-host.component.html/.scss` |
| 5.5 | **Mobile Host-IA beachten**      | Das Panel muss ins Vier-Zonen-/Mobile-Host-System passen und darf die obere Steuerzone nicht ueberladen. | `session-host.component.scss`       |

### Ergebnis

- Host sieht einen ruhigen, livefaehigen Tempo-Kanal

---

## Phase 6: Teilnehmer-Widget in der Vote-Ansicht

Ziel: Teilnehmende koennen den Tempo-Zustand jederzeit ohne Kontextwechsel setzen.

### Zielbild Teilnehmer

- persistentes Tempo-Widget in der Session-Vote-Ansicht
- mobile-first erreichbar
- keine horizontale Scrollfalle
- aktiver Zustand klar markiert
- semantisch und per Tastatur bedienbar

### Aufgaben

| #   | Task                                | Beschreibung                                                                                   | Datei                               |
| --- | ----------------------------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------- |
| 6.1 | **Widget-Strategie festlegen**      | Tempo nicht als Haupttab rendern, sondern als persistentes Bottom-/Inline-Widget.              | `session-vote.component.html`       |
| 6.2 | **Signale ergänzen**                | `tempoOwnState`, Loading, Fehler, eventuell Optimistic-Update-State.                           | `session-vote.component.ts`         |
| 6.3 | **Mutation anbinden**               | Tap setzt oder entfernt Zustand ohne Submit-Button.                                            | `session-vote.component.ts`         |
| 6.4 | **Own-State-Rehydrierung**          | Beim Laden den eigenen letzten Zustand serverseitig oder aus Livezustand nachziehen.           | `session-vote.component.ts`         |
| 6.5 | **Bottom-Bar-Kollisionen auflösen** | Abstimmungs-Submit, Session-End-Gate und Tempo-Widget sauber staffeln.                         | `session-vote.component.html/.scss` |
| 6.6 | **A11y ausarbeiten**                | Buttons mit Textlabel, ARIA-Name, `aria-pressed` oder aequivalentem aktiven Zustand.           | `session-vote.component.html`       |
| 6.7 | **Mobile-Lesbarkeit sichern**       | Vier Buttons auf schmalen Screens ohne horizontales Scrollen und ohne unruhige Labelumbrueche. | `session-vote.component.scss`       |

### Ergebnis

- Teilnehmende koennen Tempo jederzeit melden, ohne die eigentliche Session-Interaktion zu verlassen

---

## Phase 7: Tests, Review, UX-Tests, Feintuning

Ziel: Die Story wird nicht nur technisch fertig, sondern review- und produktionsfaehig.

### Backend-Tests

| #   | Task                   | Beschreibung                                                                             |
| --- | ---------------------- | ---------------------------------------------------------------------------------------- |
| 7.1 | **Aggregation testen** | Wechsel von Zuständen aktualisiert Counts korrekt.                                       |
| 7.2 | **Anonymitaet testen** | Host-Responses enthalten keine individuellen Zustandslisten.                             |
| 7.3 | **Gating testen**      | `tempoOpen`, `tempoEnabled`, `FINISHED` und Host-Autorisierung werden korrekt erzwungen. |
| 7.4 | **Trendlogik testen**  | Rolling-Window und Tendenz sind deterministisch und nachvollziehbar.                     |

### Frontend-Tests

| #   | Task                  | Beschreibung                                                                         |
| --- | --------------------- | ------------------------------------------------------------------------------------ |
| 7.5 | **Host-Specs**        | Kanal erscheint, Aktivierung funktioniert, Aggregat wird korrekt angezeigt.          |
| 7.6 | **Vote-Specs**        | Widget erscheint nur wenn offen, Auswahl wechselt korrekt, aktiver Zustand markiert. |
| 7.7 | **A11y-/State-Specs** | `aria-pressed`, Labels, Tastaturbedienbarkeit.                                       |

### Konkrete Testanker im aktuellen Repo

Die Story sollte **nicht** mit neuen, losgeloesten Testinseln anfangen, sondern zunaechst die bereits vorhandenen Hotspots erweitern:

- `apps/backend/src/__tests__/session.enable-channels.test.ts`
  Fuer `enableTempoChannel`, `closeTempoChannel`, `reopenTempoChannel` und idempotente Kanalaktivierung.
- `apps/backend/src/__tests__/tempo.test.ts` oder `apps/backend/src/__tests__/tempo.router.test.ts`
  Neuer fokussierter Tempo-Test fuer `setState`, `getOwnState`, `hostSnapshot`, Trendlogik, Gating und Nicht-Leakage individueller Zustandslisten.
- `apps/frontend/src/app/features/session/session-host/session-host.component.spec.ts`
  Fuer vierten Kanal-Tab, Aktivierung, Sichtbarkeit, Host-Metadaten und Snapshot-Darstellung.
- `apps/frontend/src/app/features/session/session-vote/session-vote.component.spec.ts`
  Fuer persistentes Tempo-Widget, kein falscher Auto-Fokus, Zusammenspiel mit Bottom-Actions und aktiven Zustand.

### Empfohlene fokussierte Checks waehrend der Umsetzung

- `npm run test -w @arsnova/backend -- apps/backend/src/__tests__/session.enable-channels.test.ts`
- `npm run test -w @arsnova/backend -- apps/backend/src/__tests__/tempo.test.ts`
- `npm run test -w @arsnova/frontend -- apps/frontend/src/app/features/session/session-host/session-host.component.spec.ts`
- `npm run test -w @arsnova/frontend -- apps/frontend/src/app/features/session/session-vote/session-vote.component.spec.ts`

### Review- und UX-Stufen

1. **PR / Code Review**
   - keine Wiederverwendung falscher Blitzlicht-Semantik
   - keine personenbezogene Leckage
   - keine unnötige DB-Last
   - Host-/Vote-Shell weiter konsistent
2. **UX-Tests**
   - Smartphone Teilnehmer mit aktivem Quiz
   - Smartphone Teilnehmer mit offenem Q&A
   - Host-Wechsel zwischen Quiz, Q&A, Blitzlicht, Tempo
   - reale oder simulierte Live-Situation
3. **UX-Feintuning**
   - Wording
   - Icon-/Labeldichte
   - Widget-Hoehe und Position
   - Tendenzschwellen
   - Balken-/Segmentdarstellung

---

## Empfohlene Umsetzungsreihenfolge im Branch

1. **shared-types**
2. **Prisma + Migration**
3. **Tempo-Router + Redis-Modell**
4. **Session-Router + Shell-Refactor**
5. **Host-UI**
6. **Vote-Widget**
7. **Tests**
8. **PR**
9. **UX-Tests**
10. **UX-Feintuning**

Diese Reihenfolge minimiert Rework, weil zuerst die Vertraege und der Datenpfad stabilisiert werden und erst danach die UI aufgesetzt wird.

## Empfohlenes PR-Backlog

Um Review-Risiko und Regressionsflaeche zu begrenzen, sollte die Story in **mehrere kleine PRs** geschnitten werden statt in einen grossen Feature-Branch-Block.

| PR   | Ziel                                  | Enthalten                                                                                                                                                      | Muss vor Merge gruen sein                                                                           |
| ---- | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| PR 1 | **Vertraege + Session-Konfiguration** | `shared-types`, `SessionChannelsDTO`, `CreateSessionInput`, Prisma-Felder `tempoEnabled`/`tempoOpen`, Migration, `buildSessionChannels()`, Session-Create-Flow | `@arsnova/shared-types` Build, Backend-Typecheck, `session.create`-/`session.enable-channels`-Tests |
| PR 2 | **Tempo-Backend-Hotpath**             | neuer `tempoRouter`, Redis-Keying, `setState`, `getOwnState`, `hostSnapshot`, Tendenz-Aggregation, Router-Registrierung                                        | fokussierte Tempo-Backend-Tests, Backend-Typecheck                                                  |
| PR 3 | **Shell-Refactor fuer vier Kanaele**  | `SessionChannelTab`, `visibleChannels`, `channelOpenState`, `channelLabel`, Host-/Vote-Navigation, Entfernen falscher QuickFeedback-Autofokus-Annahmen         | Host-/Vote-Specs fuer Kanalwechsel und Navigationsregeln                                            |
| PR 4 | **Host-UI fuer Tempo**                | Tempo-Tab, Aktivieren/Schliessen/Wiederoeffnen, Snapshot-Visualisierung, Meta-/Badge-Konzept                                                                   | Host-Spec, Frontend-Typecheck                                                                       |
| PR 5 | **Teilnehmer-Widget + A11y**          | persistentes Tempo-Widget, Own-State-Rehydrierung, Mutation, Bottom-Bar-Koordination, `aria-pressed`, mobile Layoutregeln                                      | Vote-Spec, Frontend-Typecheck                                                                       |
| PR 6 | **Feinschliff + Nachweise**           | Tendenzschwellen kalibrieren, i18n/Copy falls noetig, Doku-Abgleich, abschliessende Review-/UX-Checkliste                                                      | fokussierte Frontend-/Backend-Tests, ggf. `npm test` und `npm run typecheck`                        |

### Zuschnittsregeln fuer die PRs

- **PR 1 und PR 2** sollen **keine** sichtbare Tempo-UI erzwingen.
- **PR 3** ist ein Refactor-PR und darf bewusst ohne fertige Tempo-Visualisierung gemerged werden, wenn die bestehende 3-Kanal-Logik stabil bleibt.
- **PR 4 und PR 5** koennen getrennt reviewed werden, weil Host-Tab und Teilnehmer-Widget unterschiedliche UI-Vertraege haben.
- **PR 6** ist kein "Restmuell-PR", sondern die explizite Stelle fuer UX-Feintuning, Copy und harte Abschlussnachweise.

---

## Risiken und Gegenmassnahmen

| Risiko                                          | Auswirkung                         | Gegenmassnahme                                                     |
| ----------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------ |
| Blitzlicht-Logik wird teilweise wiederverwendet | fachlich falsches Produktmodell    | eigener Router, eigene DTOs, eigene Terminologie                   |
| Host sieht zu viel Detail                       | Datenschutz- und Vertrauensproblem | nur Aggregat-Daten, keine individuellen Listen                     |
| Teilnehmer-Widget kollidiert mit Bottom-Actions | schlechte Mobile-UX                | Layout frueh mit echter Vote-Ansicht und Session-End-Gate testen   |
| Redis-Zaehler driften bei Zustandswechsel       | falsche Host-Anzeige               | deltabasierte Mutationen und explizite Backend-Tests               |
| Trendlogik wirkt nervoes                        | schlechte Host-Interpretierbarkeit | Rolling Window + deterministische Schwellen + UX-Feintuning        |
| Shell-Refactor bricht bestehende Kanaele        | Regression in Q&A/Blitzlicht       | Phase 4 bewusst klein schneiden und vorhandene Flows weiter testen |

---

## Definition of Done fuer die Story

Die Story gilt erst als bereit fuer Produktion, wenn:

- der Tempo-Kanal als eigener vierter Session-Kanal implementiert ist
- Host nur aggregierte Tempo-Daten sieht
- Teilnehmende ihren Zustand jederzeit setzen, aendern und optional entfernen koennen
- der Kanal parallel zu Quiz, Q&A und Blitzlicht stabil laeuft
- Mobile- und A11y-Kriterien nachgewiesen sind
- Code Review ohne offene Architektur- oder Datenschutzbefunde abgeschlossen ist
- UX-Tests und anschliessendes Feintuning erfolgt sind

---

## Referenzen

- [`Backlog.md`](../../Backlog.md) Story `8.8`
- [`docs/implementation/STORY-8.8-GITHUB-CHECKLIST.md`](./STORY-8.8-GITHUB-CHECKLIST.md)
- [`docs/architecture/decisions/0022-tempo-live-channel-as-continuous-session-channel.md`](../architecture/decisions/0022-tempo-live-channel-as-continuous-session-channel.md)
- [`docs/architecture/decisions/0009-unified-live-session-channels.md`](../architecture/decisions/0009-unified-live-session-channels.md)
- [`docs/architecture/decisions/0010-blitzlicht-as-core-live-mode.md`](../architecture/decisions/0010-blitzlicht-as-core-live-mode.md)
- [`docs/architecture/decisions/0014-mobile-first-information-architecture-for-host-views.md`](../architecture/decisions/0014-mobile-first-information-architecture-for-host-views.md)
- [`docs/architecture/decisions/0019-host-hardening-and-owner-bound-session-access.md`](../architecture/decisions/0019-host-hardening-and-owner-bound-session-access.md)
- [`docs/architecture/decisions/0021-separate-service-status-from-load-status-with-live-slo-telemetry.md`](../architecture/decisions/0021-separate-service-status-from-load-status-with-live-slo-telemetry.md)
