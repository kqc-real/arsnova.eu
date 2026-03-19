# Server-Status-Widget (Story 0.4)

> **Zielgruppe:** Product Owner, Entwickler

## Was zeigt das Widget?

Das Server-Status-Widget wird im **Footer** der Anwendung angezeigt und gibt Nutzenden
auf einen Blick Auskunft darüber, wie aktiv die Plattform gerade ist. Es werden vier
Kennzahlen und ein farbiger Status-Dot dargestellt:

| Kennzahl | Icon | Bedeutung |
|---|---|---|
| Aktive Sessions | ▶ play_circle | Laufende Quiz-Sessions (Lobby bis Diskussion) |
| Blitz-Runden | ⚡ bolt | Laufende Quick-Feedback-Runden |
| Teilnehmende | 👥 group | Personen in aktiven Sessions |
| Abgeschlossene Quizzes | ✅ check_circle | Bereits beendete Sessions |

### Status-Dot (Ampel)

| Farbe | Bedeutung | Schwellwert |
|---|---|---|
| 🟢 Grün | Gesund | < 50 aktive Sessions |
| 🟡 Gelb | Ausgelastet | 50 – 199 aktive Sessions |
| 🔴 Rot | Überlastet | ≥ 200 aktive Sessions |
| ⚪ Grau | Unbekannt | Daten noch nicht geladen oder Fehler |

---

## Datenfluss (Komponentendiagramm)

```mermaid
flowchart LR
  subgraph "<<subsystem>> Frontend"
    W["<<component>>\nServerStatusWidget"]
  end

  subgraph "<<subsystem>> Backend"
    H["<<component>>\nhealthRouter.stats"]
  end

  subgraph "<<subsystem>> Persistenz"
    P[("<<database>>\nPostgreSQL")]
    R[("<<database>>\nRedis")]
  end

  W -- "query [alle 30 s]" --> H
  H -. "ServerStatsDTO" .-> W
  H -- "count()" --> P
  H -- "SCAN" --> R
```

### Ablauf (Sequenzdiagramm)

```mermaid
sequenceDiagram
  actor User
  participant Widget as :ServerStatusWidget
  participant Client as :tRPC Client
  participant Router as :healthRouter
  participant DB as :PostgreSQL
  participant Cache as :Redis

  User ->> Widget: Seite oeffnen
  activate Widget
  Widget ->> Client: ngOnInit()
  activate Client
  Client ->> Router: health.stats.query()
  activate Router

  par Promise.all
    Router ->> DB: session.count(status IN aktiv)
    Router ->> DB: session.count(status = FINISHED)
    Router ->> DB: participant.count(session.status IN aktiv)
    Router ->> Cache: SCAN qf:*
  end

  DB -->> Router: counts
  Cache -->> Router: keyCount

  Router ->> Router: getServerStatus(activeSessions)
  Router ->> Router: ServerStatsDTOSchema.parse()
  Router -->> Client: :ServerStatsDTO
  deactivate Router
  Client -->> Widget: stats.set(data)
  deactivate Client
  Widget ->> Widget: Template-Rendering
  deactivate Widget

  loop alle 30 s
    Widget ->> Client: fetchStats()
    Client ->> Router: health.stats.query()
    Router -->> Client: :ServerStatsDTO
    Client -->> Widget: stats.set(data)
  end
```

---

## Datenquellen im Detail

### PostgreSQL (via Prisma)

| Kennzahl | Query | Filter |
|---|---|---|
| Aktive Sessions | `prisma.session.count(…)` | Status in: `LOBBY`, `QUESTION_OPEN`, `ACTIVE`, `PAUSED`, `RESULTS`, `DISCUSSION` |
| Abgeschlossene Quizzes | `prisma.session.count(…)` | Status = `FINISHED` |
| Teilnehmende | `prisma.participant.count(…)` | Teilnehmer, deren Session einen der aktiven Status hat |

### Redis

| Kennzahl | Methode | Details |
|---|---|---|
| Blitz-Runden | `SCAN` mit Pattern `qf:*` | Cursor-basiert (kein blockierendes `KEYS`), interne Voter-Sets (`qf:*:voters:*`) werden ignoriert |

---

## Lebenszyklus der Daten (Wann sinken/verschwinden Kennzahlen?)

### Aktive Sessions & Teilnehmende

Eine Session fällt aus der „aktiv"-Zählung, sobald ihr Status auf `FINISHED` wechselt.
Das geschieht durch:

| Auslöser | Beschreibung | Timing |
|---|---|---|
| **Manuell** | Dozent beendet die Session (`session.end`) | Sofort |
| **Automatisch** | Letzte Frage wurde beantwortet → `FINISHED` | Sofort |
| **Cleanup (verwaist)** | Session seit > **24 h** aktiv ohne Aktivität | Stündlicher Cleanup-Job |

Teilnehmende werden nicht einzeln entfernt – sie fallen automatisch aus der Zählung,
sobald ihre zugehörige Session beendet wird.

### Abgeschlossene Quizzes

| Auslöser | Beschreibung | Timing |
|---|---|---|
| **Session Purge** | `FINISHED`-Sessions werden **24 h nach Beendigung** komplett gelöscht | Stündlicher Cleanup-Job |
| **Legal Hold** | Sessions mit `legalHoldUntil` in der Zukunft bleiben erhalten | Bis Ablauf des Holds |

Beim Purge werden auch verwaiste Quizzes gelöscht (Quizzes ohne verbleibende Sessions).

### Blitz-Runden (Redis)

| Auslöser | Beschreibung | Timing |
|---|---|---|
| **TTL** | Alle `qf:*`-Keys haben ein `EXPIRE` von **30 Minuten** | Automatisch durch Redis |
| **Manuell** | Dozent löscht die Runde (`quickFeedback.delete`) | Sofort |

### Lebenszyklus einer Session (Zustandsdiagramm)

```mermaid
stateDiagram-v2
  direction TB

  [*] --> LOBBY : create()

  state "Aktiv (in Kennzahlen)" as active {
    LOBBY --> QUESTION_OPEN : openQuestion()
    QUESTION_OPEN --> ACTIVE : startAnswering()
    ACTIVE --> PAUSED : pause()
    PAUSED --> QUESTION_OPEN : resume()
    ACTIVE --> RESULTS : timeout / allAnswered
    RESULTS --> DISCUSSION : startDiscussion()
    DISCUSSION --> QUESTION_OPEN : nextQuestion()
  }

  active --> FINISHED : end() / lastQuestion / cleanup [after 24h]

  FINISHED --> Purged : sessionPurge [after 24h, no legalHold]
  Purged --> [*]

  note right of active
    activeSessions +1
    totalParticipants zaehlt mit
  end note

  note right of FINISHED
    activeSessions -1
    completedSessions +1
  end note

  note right of Purged
    completedSessions -1
    Datensatz entfernt
  end note
```

### Lebenszyklus einer Blitz-Runde (Zustandsdiagramm)

```mermaid
stateDiagram-v2
  direction LR

  [*] --> Active : create()
  Active --> Expired : after(30min) [Redis TTL]
  Active --> Deleted : delete()
  Expired --> [*]
  Deleted --> [*]

  note right of Active
    activeBlitzRounds +1
    Key: qf:code
  end note
```

---

## Fehlerverhalten (Aktivitaetsdiagramm)

```mermaid
flowchart TD
  S(( )) --> Q["health.stats.query()"]
  Q --> OK{query erfolgreich}

  OK -- "[true]" --> SET["stats.set(data)"]
  SET --> RENDER["Dot + Kennzahlen anzeigen"]
  RENDER --> E(( ))

  OK -- "[false]" --> NULL["stats.set(null)"]
  NULL --> CON{connectionOk}
  CON -- "[true]" --> LOAD["Anzeige: Wird geladen"]
  CON -- "[false]" --> OFFLINE["Anzeige: Keine Verbindung"]
  LOAD --> E
  OFFLINE --> E
```

| Situation | Backend | Frontend |
|---|---|---|
| DB oder Redis nicht erreichbar | Fallback: alle Werte `0`, Status `healthy` | Zeigt Nullwerte an |
| tRPC-Aufruf schlägt fehl | – | `stats` wird `null` → „Wird geladen…" |
| API-Health-Check fehlgeschlagen | – | `connectionOk = false` → „Keine Verbindung" + grauer Dot |

---

## Darstellungsmodi

Das Widget unterstützt zwei Modi über den `compact`-Input:

| Modus | Verwendung | Darstellung |
|---|---|---|
| **Normal** (`compact = false`) | Eigenständige Anzeige (z. B. Startseite) | Header „Gerade aktiv" + Dot + Statistik-Zeile, Skeleton-Loader |
| **Kompakt** (`compact = true`) | Globaler App-Footer | Nur Dot + Kennzahlen in einer Zeile, kein Header |

Im App-Footer wird immer der kompakte Modus genutzt:

```html
<app-server-status-widget [connectionOk]="!!apiStatus()" [compact]="true" />
```

---

## Cleanup-Scheduler (Hintergrund-Jobs)

Der Scheduler startet mit dem Backend und läuft **jede Stunde** (`sessionCleanup.ts`):

*Aktivitaetsdiagramm*

```mermaid
flowchart TB
  S(( )) --> TIMER{"[every 60 min]"}
  TIMER --> J1["cleanupStaleSessions()"]
  J1 --> D1{"stale sessions found"}
  D1 -- "[true]" --> U1["updateMany: status = FINISHED"]
  D1 -- "[false]" --> J2
  U1 --> J2["cleanupExpiredFinishedSessions()"]
  J2 --> D2{"expired sessions found"}
  D2 -- "[true]" --> DEL["deleteMany: sessions + orphan quizzes"]
  D2 -- "[false]" --> J3
  DEL --> J3["cleanupExpiredBonusTokens()"]
  J3 --> D3{"expired tokens found"}
  D3 -- "[true]" --> TDEL["deleteMany: bonusTokens"]
  D3 -- "[false]" --> TIMER
  TDEL --> TIMER
```

| Job | Aktion | Schwellwert |
|---|---|---|
| 1. Stale Sessions | Aktive Sessions ohne Aktivität seit > 24 h → `FINISHED` | `STALE_SESSION_HOURS = 24` |
| 2. Session Purge | Beendete Sessions > 24 h nach Ende → komplett gelöscht | `FINISHED_SESSION_RETENTION_HOURS = 24` |
| 3. Bonus-Token Purge | Bonus-Tokens älter als 90 Tage → gelöscht | `BONUS_TOKEN_RETENTION_DAYS = 90` |

---

## Relevante Dateien

| Bereich | Datei |
|---|---|
| **Zod-Schema** | `libs/shared-types/src/schemas.ts` (`ServerStatsDTOSchema`) |
| **Backend Router** | `apps/backend/src/routers/health.ts` (`stats` Query) |
| **Cleanup** | `apps/backend/src/lib/sessionCleanup.ts` |
| **Quick-Feedback TTL** | `apps/backend/src/routers/quickFeedback.ts` (`FEEDBACK_TTL_SECONDS`) |
| **Frontend Widget** | `apps/frontend/src/app/shared/server-status-widget/` |
| **Einbindung Footer** | `apps/frontend/src/app/app.component.html` |
