# Server-Status-Widget (Story 0.4)

> **Zielgruppe:** Product Owner, Entwickler  
> **Stand:** 2026-07-27 (Abgleich mit `health.ts` `stats`/`footerBundle` inkl. `PlatformStatistic`, `DailyStatistic`, SLO-/Lastsignalen, `server-status-widget.component.ts`, `server-status-help-dialog.component.ts`, `app.component.html` / `app.component.ts` und Blitzlicht-Tombstones aus PR #164)

## Was zeigt das Widget?

Der Betriebsstatus ist im **globalen App-Footer** sichtbar: farbiger Status-Dot
direkt neben dem Menü **Mehr**, und zusätzlich unter **Mehr → Betriebsstatus**
(`app.component.html`). Beide Einstiege öffnen denselben Betriebsstatus-Dialog.
Im Menüeintrag werden Label und farbiger Status-Dot angezeigt; die Kennzahlen
stehen im **Hilfe-Dialog**. Der Footer (und damit der Status-Einstieg) wird
**nicht** angezeigt auf der **Standalone-Blitzlicht-Route** (`/feedback/...`) und
in der **immersiven Host-Ansicht** (`isImmersiveHostView`). Auf Join- und
Session-Live-Routen bleibt der Status-Einstieg ausgeblendet (Polling unterdrückt).

| Kennzahl                 | Icon            | Bedeutung                                                                                                 |
| ------------------------ | --------------- | --------------------------------------------------------------------------------------------------------- |
| Offene Sessions          | ▶ play_circle   | Noch nicht beendete Sessions (Status ≠ `FINISHED`)                                                        |
| Aktive Sessions          | ▶ play_circle   | Offene Sessions mit mindestens 5 aktiven Teilnehmenden in der Redis-Presence der letzten Minuten          |
| Blitz-Runden             | ⚡ bolt         | Laufende Blitzlicht-/Quick-Feedback-Runden (Redis-Primärkeys `qf:<code>`, siehe Backend)                  |
| Teilnehmende             | 👥 group        | Aktive Teilnahmen über laufende Sessions aus Redis-Presence                                               |
| Abgeschlossene Quizzes   | ✅ check_circle | Monotoner Gesamtzähler aus `PlatformStatistic.completedSessionsTotal` bzw. Fallback auf `FINISHED`-Zeilen |
| Stimmen/Statuswechsel    | timeline        | Diagnosewerte der letzten Minute (`votesLastMinute`, `sessionTransitionsLastMinute`)                      |
| Countdown-Sessions       | timer           | Sessions mit aktivem Countdown im aktuellen Zeitfenster                                                   |
| Allzeit- und Tagesrekord | emoji_events    | `PlatformStatistic.maxParticipantsSingleSession` und 30 UTC-Tage aus `DailyStatistic`                     |

Der Footer ruft alle 5 Minuten **`health.footerBundle`** ab. Dieser Endpoint kombiniert `health.check`
mit einem schlanken `FooterStatusDTO` (`serviceStatus`, `loadStatus`). Beim Öffnen des Dialogs lädt
die App **`health.stats`** frisch nach; der Dialog rendert die vollständigen Kennzahlen und den
100-Tage-Verlauf.

### Status-Dot (Ampel)

| Farbe   | Bedeutung                 | Datenbasis                                                                  |
| ------- | ------------------------- | --------------------------------------------------------------------------- |
| 🟢 Grün | Stabil (`serviceStatus`)  | `serviceStatus = stable`                                                    |
| 🟡 Gelb | Eingeschränkt             | `serviceStatus = limited`                                                   |
| 🔴 Rot  | Kritisch                  | `serviceStatus = critical`                                                  |
| ⚪ Grau | Unbekannt / nicht geladen | `connectionOk=false`, initiales Laden oder kein `FooterStatusDTO` vorhanden |

**Hinweis:** Der Dot ist heute ein **Betriebsstatus** (`serviceStatus`) und nicht mehr nur eine
Schwellwert-Ampel auf `activeSessions`. `loadStatus` bleibt als Diagnosewert im Detaildialog sichtbar.

---

## Datenfluss (Komponentendiagramm)

```mermaid
flowchart LR
  subgraph "<<subsystem>> Frontend"
    W["<<component>>\nServerStatusWidget"]
  end

  subgraph "<<subsystem>> Backend"
    H["<<component>>\nhealth.footerBundle / health.stats"]
  end

  subgraph "<<subsystem>> Persistenz"
    P[("<<database>>\nPostgreSQL")]
    R[("<<database>>\nRedis")]
  end

  W -- "footerBundle [alle 5 min]" --> H
  W -- "stats [Dialog öffnen]" --> H
  H -. "FooterStatusDTO / ServerStatsDTO" .-> W
  H -- "count()" --> P
  H -- "DailyStatistic / PlatformStatistic" --> P
  H -- "SCAN + Presence/Load/SLO" --> R
```

### Ablauf (Sequenzdiagramm)

```mermaid
sequenceDiagram
  actor User
  participant App as AppComponent
  participant Widget as ServerStatusWidget
  participant Client as tRPC Client
  participant Router as healthRouter
  participant DB as PostgreSQL
  participant Cache as Redis

  Note over App: Beim Start / Retry: health.footerBundle → apiStatus + FooterStatusDTO
  App ->> Client: health.footerBundle.query()
  Client -->> App: check + serviceStatus/loadStatus

  User ->> Widget: Route mit Footer
  activate Widget
  Note over Widget: connectionOk = apiStatus und Dot aus serviceStatus
  Widget ->> User: Button Betriebsstatus
  User ->> Widget: Dialog öffnen
  Widget ->> Client: health.stats.query()
  activate Client
  activate Router

  par Promise.all
    Router ->> DB: session.count(Status != FINISHED)
    Router ->> DB: session.count(FINISHED)
    Router ->> DB: PlatformStatistic lesen
    Router ->> DB: DailyStatistic letzte 30 UTC-Tage lesen
    Router ->> Cache: Presence pro offener Session zählen
    Router ->> Cache: Load-/SLO-Signale lesen
    Router ->> Cache: SCAN MATCH qf:* Primärkeys
  end

  DB -->> Router: Counts + Platform/DailyStatistic
  Cache -->> Router: Presence + activeBlitzRounds + Load/SLO

  Router ->> Router: loadStatus berechnen
  Router ->> Router: serviceStatus aus SLO/Last ableiten
  Router ->> Router: ServerStatsDTOSchema.parse
  Router -->> Client: ServerStatsDTO
  deactivate Router
  Client -->> Widget: stats.set(data)
  deactivate Client
  Widget ->> Widget: Dialog + Chart rendern
  deactivate Widget

  loop alle 5 min bei sichtbarem Footer
    App ->> Client: health.footerBundle.query()
    Client -->> App: check + FooterStatusDTO
  end
```

---

## Datenquellen im Detail

### PostgreSQL (via Prisma)

| Kennzahl                     | Query                                                                 | Filter                                                                                             |
| ---------------------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Kennzahl / Daten             | Query / Quelle                                                        | Filter / Semantik                                                                                  |
| ---------------------------- | --------------------------------------                                | -------------------------------------------------------------------------------------------------- |
| Offene Sessions              | `prisma.session.count(…)`                                             | Status ≠ `FINISHED`                                                                                |
| Abgeschlossene Quizzes       | `PlatformStatistic.completedSessionsTotal` / Fallback `session.count` | monotoner Gesamtzähler, damit Purge den Wert nicht senkt                                           |
| Allzeit-Rekord               | `PlatformStatistic`                                                   | `maxParticipantsSingleSession`, `updatedAt`                                                        |
| Tagesrekord-Verlauf          | `prisma.dailyStatistic.findMany(…)`                                   | letzte 30 UTC-Tage, Lücken werden mit `count=0` aufgefüllt                                         |
| Quiz-/Session-Inhalte        | Session/Quiz-Tabellen                                                 | nur indirekt für Counts; keine Inhalte im Footer-Status                                            |

### Redis

| Kennzahl                 | Methode                 | Details                                                                                                                     |
| ------------------------ | ----------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Kennzahl / Signal        | Methode                 | Details                                                                                                                     |
| ------------------------ | ----------------------- | --------------------------------------------------------------------------------------------------------                    |
| Aktive Teilnehmende      | Presence-Keys           | nur offene Sessions; Presence-Fenster siehe Backend `presence`                                                              |
| Aktive Sessions          | Presence pro Session    | nur offene Sessions mit mindestens `ACTIVE_SESSION_MIN_PARTICIPANTS = 5`                                                    |
| Blitz-Runden             | `SCAN` mit `MATCH qf:*` | es zählen nur Primärkeys `qf:<code>`, keine `qf:voters:*`, `qf:choices:*`, `qf:choices:r1:*`, `qf:host:*` oder `qf:known:*` |
| Votes / Statuswechsel    | Load-Signale            | Werte der letzten Minute                                                                                                    |
| SLO-Signale              | SLO-Telemetrie          | Request-Sample, Fehlerrate, p95/p99-Latenz                                                                                  |

---

## Lebenszyklus der Daten (Wann sinken/verschwinden Kennzahlen?)

### Offene Sessions, aktive Sessions & Teilnehmende

Eine Session fällt aus der „offen"-Zählung, sobald ihr Status auf `FINISHED` wechselt.
Als **aktiv** zählt sie erst, wenn mindestens 5 Teilnehmende innerhalb des Presence-Fensters sichtbar sind.
Das geschieht durch:

| Auslöser               | Beschreibung                                 | Timing                  |
| ---------------------- | -------------------------------------------- | ----------------------- |
| **Manuell**            | Dozent beendet die Session (`session.end`)   | Sofort                  |
| **Automatisch**        | Letzte Frage wurde beantwortet → `FINISHED`  | Sofort                  |
| **Cleanup (verwaist)** | Session seit > **24 h** aktiv ohne Aktivität | Stündlicher Cleanup-Job |

Teilnehmende werden nicht einzeln aus PostgreSQL entfernt. Für den Live-Status zählt Redis-Presence;
sobald Presence abläuft oder die Session beendet ist, sinken die Live-Zahlen.

### Abgeschlossene Quizzes

| Auslöser          | Beschreibung                                                                                                                                                                | Timing                  |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| **Session Purge** | `FINISHED`-Sessions werden frühestens **24 h nach Beendigung** gelöscht, aber nur wenn kein aktiver Legal Hold und keine frischen Bonus-Tokens/Session-Feedbacks existieren | Stündlicher Cleanup-Job |
| **Legal Hold**    | Sessions mit `legalHoldUntil` in der Zukunft bleiben erhalten                                                                                                               | Bis Ablauf des Holds    |

Beim Purge werden auch verwaiste Quizzes gelöscht (Quizzes ohne verbleibende Sessions).
Der angezeigte Gesamtwert `completedSessions` sinkt dadurch nicht, weil `completedSessionsTotal`
monoton in `PlatformStatistic` geführt wird.

### Blitz-Runden (Redis)

| Auslöser      | Beschreibung                                                                                                                                          | Timing                  |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| **TTL**       | Haupt- und Rundendaten laufen nach **30 Minuten** ab; `qf:known:<CODE>` lebt als Tombstone fünf Minuten länger und zählt nicht als aktive Blitz-Runde | Automatisch durch Redis |
| **Schreiben** | Mutationen mit erneuter Haupt-TTL erneuern den Tombstone auf **35 Minuten**                                                                           | Mit der Mutation        |
| **Manuell**   | `quickFeedback.end` löscht die Rundendaten sofort und hält den Tombstone noch fünf Minuten, damit Polling/Subscription sauber bei `NOT_FOUND` stoppen | Sofort                  |

### Lebenszyklus einer Session (Zustandsdiagramm)

```mermaid
stateDiagram-v2
  direction TB

  [*] --> LOBBY : create()

  state "Aktiv (in Kennzahlen)" as active {
    LOBBY --> QUESTION_OPEN : openQuestion()
    QUESTION_OPEN --> ACTIVE : startAnswering()
    QUESTION_OPEN --> PAUSED : pauseQuiz()
    ACTIVE --> PAUSED : pauseQuiz()
    PAUSED --> QUESTION_OPEN : resumeQuiz() [pausedFromStatus=QUESTION_OPEN]
    PAUSED --> ACTIVE : resumeQuiz() [pausedFromStatus=ACTIVE]
    ACTIVE --> RESULTS : timeout / allAnswered
    RESULTS --> DISCUSSION : startDiscussion()
    RESULTS --> QUESTION_OPEN : nextQuestion()
    DISCUSSION --> QUESTION_OPEN : nextQuestion()
  }

  active --> FINISHED : end() / lastQuestion / cleanup [after 24h]

  FINISHED --> Purged : sessionPurge [after 24h, no legalHold]
  Purged --> [*]

  note right of active
    openSessions zählt mit
    activeSessions erst ab 5 Presence-Teilnehmenden
  end note

  note right of FINISHED
    openSessions -1
    completedSessionsTotal +1
  end note

  note right of Purged
    completedSessionsTotal bleibt
    Datensatz entfernt
  end note
```

### Lebenszyklus einer Blitz-Runde (Zustandsdiagramm)

```mermaid
stateDiagram-v2
  direction LR

  [*] --> Active : create()
  Active --> Expired : after(30min) [Haupt-TTL]
  Active --> Deleted : end()
  Expired --> Tombstone : qf:known bleibt 5min
  Deleted --> Tombstone : qf:known bleibt 5min
  Tombstone --> [*] : after(5min)

  note right of Active
    Zähler: Redis-Keys qf:*
    Haupt-Key: qf:CODE
  end note

  note right of Tombstone
    zählt nicht als aktive Runde
    verhindert Fehlbudget-Nachlauf
  end note
```

---

## Fehlerverhalten (Aktivitaetsdiagramm)

```mermaid
flowchart TD
  S(( )) --> Q["health.footerBundle.query()"]
  Q --> OK{query erfolgreich}

  OK -- "[true]" --> SET["apiStatus + footerStatus setzen"]
  SET --> RENDER["Footer-Dot anzeigen"]
  RENDER --> E(( ))

  OK -- "[false]" --> NULL["apiStatus + footerStatus null"]
  NULL --> CON{connectionOk}
  CON -- "[true]" --> LOAD["Anzeige: Wird geladen"]
  CON -- "[false]" --> OFFLINE["Anzeige: Keine Verbindung"]
  LOAD --> E
  OFFLINE --> E
```

| Situation                                  | Backend                                                           | Frontend                                                                        |
| ------------------------------------------ | ----------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| DB oder Redis nicht erreichbar             | Fallback: Werte `0`, `serviceStatus=stable`, `loadStatus=healthy` | Dialog zeigt Fallbackwerte, Footer-Dot bleibt stabil wenn `health.check` ok ist |
| tRPC `health.footerBundle` schlägt fehl    | –                                                                 | `apiStatus=null`, `footerStatus=null` → grauer Dot und Retry-Aktion             |
| tRPC `health.stats` im Dialog schlägt fehl | –                                                                 | `footerStats=null` → Dialog zeigt Lade-/Fehlerzustand statt Kennzahlen          |

---

## Darstellung

Der Betriebsstatus hat zwei Einstiege im globalen App-Footer:

1. farbiger Status-Dot direkt neben **Mehr**
2. **Mehr → Betriebsstatus**

Beide öffnen denselben Dialog; alle Kennzahlen liegen dort.
Die Ampelfarbe kommt aus der gemeinsamen Helper-Quelle
`resolveFooterStatusColor` / `resolveFooterStatusDotCssColor`
(`footer-status-color.ts`), die auch `ServerStatusWidgetComponent` nutzt
(Widget selbst ist nicht mehr als eigener Primärbutton in der App-Shell eingebunden).

| Element               | Verwendung                        | Darstellung                                    |
| --------------------- | --------------------------------- | ---------------------------------------------- |
| Status-Dot neben Mehr | globaler App-Footer, neben „Mehr“ | farbiger Ampel-Dot                             |
| Mehr-Menüeintrag      | globaler App-Footer → Menü „Mehr“ | Status-Dot + Label „Betriebsstatus“            |
| Detaildialog          | Auswahl „Betriebsstatus“ / Dot    | Kennzahlen, SLO-/Laststatus und 100-Tage-Chart |

```html
<button
  matIconButton
  type="button"
  class="app-footer__status-shortcut"
  (click)="openServerStatusHelp()"
>
  <mat-icon class="app-footer__status-dot" [style.color]="footerStatusDotCssColor()">lens</mat-icon>
</button>
<button mat-menu-item type="button" (click)="openServerStatusFromMore()">
  <mat-icon class="app-footer__status-dot" [style.color]="footerStatusDotCssColor()">lens</mat-icon>
  <span i18n="@@app.footer.serverHelpLabel">Betriebsstatus</span>
</button>
```

Der **Hilfe-Dialog** (`ServerStatusHelpDialogComponent`) wird lazy geladen und ruft dann `health.stats` ab.
Nach dem Schließen liegt der Fokus wieder auf dem auslösenden Footer-Trigger
(**Mehr** bzw. Status-Dot neben Mehr).

---

## Cleanup-Scheduler (Hintergrund-Jobs)

Der Scheduler startet mit dem Backend und läuft **jede Stunde** (`sessionCleanup.ts`):

_Aktivitätsdiagramm_

```mermaid
flowchart TB
  S(( )) --> TIMER{"[every 60 min]"}
  TIMER --> J1["cleanupStaleSessions()"]
  J1 --> D1{"stale sessions found"}
  D1 -- "[true]" --> U1["updateMany: status = FINISHED"]
  D1 -- "[false]" --> J2
  U1 --> J2["cleanupExpiredBonusTokens()"]
  J2 --> D2{"expired tokens found"}
  D2 -- "[true]" --> TDEL["deleteMany: bonusTokens"]
  D2 -- "[false]" --> J3
  TDEL --> J3["cleanupExpiredSessionFeedback()"]
  J3 --> D3{"expired feedback found"}
  D3 -- "[true]" --> FDEL["deleteMany: sessionFeedback"]
  D3 -- "[false]" --> J4
  FDEL --> J4["cleanupExpiredFinishedSessions()"]
  J4 --> D4{"expired sessions found"}
  D4 -- "[true]" --> DEL["deleteMany: sessions + orphan quizzes"]
  D4 -- "[false]" --> TIMER
  DEL --> TIMER
```

| Job                       | Aktion                                                                 | Schwellwert                             |
| ------------------------- | ---------------------------------------------------------------------- | --------------------------------------- |
| 1. Stale Sessions         | Aktive Sessions ohne Aktivität seit > 24 h → `FINISHED`                | `STALE_SESSION_HOURS = 24`              |
| 2. Bonus-Token Purge      | Bonus-Tokens älter als 90 Tage → gelöscht                              | `BONUS_TOKEN_RETENTION_DAYS = 90`       |
| 3. Session-Feedback Purge | Feedback zu beendeten Sessions älter als 90 Tage → gelöscht            | `SESSION_FEEDBACK_RETENTION_DAYS = 90`  |
| 4. Session Purge          | Beendete Sessions > 24 h nach Ende → gelöscht, wenn Retention frei ist | `FINISHED_SESSION_RETENTION_HOURS = 24` |

---

## Relevante Dateien

| Bereich                         | Datei                                                                           |
| ------------------------------- | ------------------------------------------------------------------------------- |
| **Zod-Schema**                  | `libs/shared-types/src/schemas.ts` (`ServerStatsDTOSchema`)                     |
| **Backend Router**              | `apps/backend/src/routers/health.ts` (`stats`, `footerBundle`, `check`, `ping`) |
| **Cleanup**                     | `apps/backend/src/lib/sessionCleanup.ts`                                        |
| **Presence/Load/SLO**           | `apps/backend/src/lib/presence.ts`, `loadSignal.ts`, `sloTelemetry.ts`          |
| **Blitzlicht TTL**              | `apps/backend/src/routers/quickFeedback.ts` (`FEEDBACK_TTL_SECONDS`)            |
| **Frontend Widget**             | `apps/frontend/src/app/shared/server-status-widget/`                            |
| **Hilfe-Dialog**                | `apps/frontend/src/app/shared/server-status-help-dialog/`                       |
| **API-Erreichbarkeit + Footer** | `apps/frontend/src/app/app.component.ts`, `app.component.html`                  |
