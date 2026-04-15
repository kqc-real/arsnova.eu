<!-- markdownlint-disable MD013 -->

# 🏗️ Architektur-Übersicht: arsnova.eu

**Erstellt:** 2026-02-20  
**Zuletzt aktualisiert:** 2026-04-03  
**Zweck:** Visualisierung der gesamten Codebasis-Struktur und Architektur

**Status:** Epics 0–5, 7.1, 8, 9, **10 (MOTD)** umgesetzt · Epic 6 größtenteils umgesetzt (6.5, 6.6 offen) · Plattformstatistik Rekordteilnehmer (`PlatformStatistic`) in `health.stats` · Host-Härtung, Feedback-Host-Token und besitzgebundene Quiz-Historie umgesetzt · geplante Markdown-Stories 1.7a/1.7b siehe [ADR-0015](../architecture/decisions/0015-markdown-images-url-only-and-lightbox.md), [ADR-0016](../architecture/decisions/0016-markdown-katex-editor-split-view-and-md3-toolbar.md), [ADR-0017](../architecture/decisions/0017-markdown-editor-ui-scope-and-ki-import-paste-field.md) (Geltungsbereich Editor vs. KI-Paste). Blitzlicht ist als Startseiten-Shortcut und Session-Kanal konsolidiert. Rollen/Routen/Autorisierung inkl. Admin, Host-Härtung und MOTD siehe [ADR-0006](../architecture/decisions/0006-roles-routes-authorization-host-admin.md), [ADR-0019](../architecture/decisions/0019-host-hardening-and-owner-bound-session-access.md), [ADR-0009](../architecture/decisions/0009-unified-live-session-channels.md), [ADR-0010](../architecture/decisions/0010-blitzlicht-as-core-live-mode.md), [ADR-0018](../architecture/decisions/0018-message-of-the-day-platform-communication.md), [ROUTES_AND_STORIES.md](../ROUTES_AND_STORIES.md).

## System-Architektur-Diagramm

```mermaid
%%{init: {'flowchart': {'curve': 'basis', 'nodeSpacing': 58, 'rankSpacing': 84, 'padding': 18}}}%%
graph LR
    subgraph "Monorepo (npm Workspaces)"
        subgraph "Frontend - Angular 21"
            FE[Angular App<br/>Port 4200]
            FE_COMP[Standalone Components<br/>Signals · Angular Material 3]
            FE_ROUTES["Routing<br/>/quiz<br/>/session/:code/(host|present|vote)<br/>/join/:code · /feedback/:code · /feedback/:code/vote<br/>/admin · /help · /legal/*<br/>optional locale prefix:<br/>/de /en /fr /es /it"]
            FE_SERVICES[Core Services<br/>tRPC Client · ws-connection · theme-preset<br/>locale guard · sound]
        end

        subgraph "Backend - Node.js + tRPC (Epic 0 ✅)"
            BE[Express Server<br/>Port 3000]
            TRPC["tRPC Router<br/>/trpc"]
            ROUTERS[Router Layer<br/>health · quiz · session · vote · qa · quickFeedback · admin · motd]
            SERVICES[Domain/Infra Layer<br/>quizScoring · rateLimit · sessionCleanup · adminAuth]
            DTO[DTO Layer<br/>Data Stripping<br/>QuestionPreviewDTO<br/>QuestionStudentDTO<br/>QuestionRevealedDTO]
        end

        subgraph "Shared Library"
            SHARED[shared-types Library<br/>Zod Schemas<br/>Type Definitions]
        end
    end

    subgraph "Datenbanken & Storage (Epic 0.1 ✅)"
        PG[(PostgreSQL<br/>Prisma ORM<br/>Sessions · Votes · Participants<br/>MOTD · PlatformStatistic)]
        REDIS[(Redis<br/>Pub/Sub · Rate-Limit<br/>Docker Compose)]
        IDB[(IndexedDB<br/>Yjs CRDT<br/>Local-First Quizzes)]
    end

    subgraph "Externe Clients"
        DOZENT[Dozent Client<br/>Quiz-Erstellung<br/>Session-Steuerung]
        STUDENT[Teilnehmer-Client<br/>Quiz · Q&A · Blitzlicht<br/>Voting · Leaderboard]
        ADMIN["Admin Client<br/>/admin · Inspektion<br/>Löschen · Auszug"]
    end

    subgraph "Echtzeit-Kommunikation (Epic 0.2, 0.3 ✅)"
        WS[WebSocket<br/>tRPC Subscriptions<br/>Port 3001]
        YWS[y-websocket<br/>Yjs Sync Relay<br/>Port 3002]
    end

    %% Frontend-Verbindungen
    FE --> FE_COMP
    FE --> FE_ROUTES
    FE --> FE_SERVICES
    FE_SERVICES --> SHARED
    FE_SERVICES --> WS
    FE_SERVICES --> YWS
    FE_SERVICES --> IDB

    %% Backend-Verbindungen
    BE --> TRPC
    TRPC --> ROUTERS
    ROUTERS --> SERVICES
    ROUTERS --> DTO
    SERVICES --> PG
    SERVICES --> REDIS
    ROUTERS --> SHARED
    DTO --> SHARED

    %% Echtzeit-Verbindungen
    WS --> BE
    YWS --> BE
    REDIS --> WS

    %% Client-Verbindungen
    DOZENT --> FE
    STUDENT --> FE
    ADMIN --> FE
    DOZENT --> IDB

    %% Styling
    classDef frontend fill:#DD0031,stroke:#333,stroke-width:2px,color:#fff
    classDef backend fill:#2596be,stroke:#333,stroke-width:2px,color:#fff
    classDef shared fill:#2D3748,stroke:#333,stroke-width:2px,color:#fff
    classDef database fill:#4A90E2,stroke:#333,stroke-width:2px,color:#fff
    classDef client fill:#7B68EE,stroke:#333,stroke-width:2px,color:#fff

    class FE,FE_COMP,FE_ROUTES,FE_SERVICES frontend
    class BE,TRPC,ROUTERS,SERVICES,DTO backend
    class SHARED shared
    class PG,REDIS,IDB database
    class DOZENT,STUDENT,ADMIN client
```

## Datenfluss-Diagramm

```mermaid
sequenceDiagram
    participant D as Dozent
    participant FE as Frontend (Angular)
    participant YJS as Yjs (IndexedDB)
    participant BE as Backend (tRPC)
    participant PG as PostgreSQL
    participant R as Redis
    participant S as Student

    Note over D,YJS: Local-First: Quiz wird lokal gespeichert
    D->>FE: Quiz erstellen/bearbeiten
    FE->>YJS: CRDT-Dokument speichern
    YJS-->>FE: Sync bestätigt
    opt Story 1.6a: Auf anderem Gerät öffnen
        D->>FE: Sync-Link/Room-ID anzeigen
        FE-->>D: Link/QR/Code (Yjs-Dokument-ID)
        Note over D: Anderes Gerät: Link öffnen → gleiches Quiz
    end

    Note over D,BE: Session starten (Backlog 2.1a)
    D->>FE: Live schalten
    FE->>BE: quiz.upload (Quiz-Kopie)
    BE->>PG: Quiz + Questions speichern
    FE->>BE: session.create()
    BE->>PG: Session speichern
    BE->>R: Code registrieren
    BE-->>FE: Session-Code zurück

    Note over S,BE: Student tritt bei
    S->>FE: Code eingeben
    FE->>BE: session.join()
    BE->>PG: Participant erstellen
    BE->>R: Pub/Sub: onParticipantJoined
    R-->>D: Echtzeit-Update

    Note over D,S: Frage wird gestartet (Story 2.6: Zwei-Phasen optional)
    D->>FE: Nächste Frage
    FE->>BE: session.nextQuestion()
    BE->>PG: Status = QUESTION_OPEN (oder ACTIVE wenn readingPhaseEnabled=false)
    BE->>R: Pub/Sub: onQuestionRevealed (QuestionPreviewDTO – nur Fragenstamm)
    R-->>S: Lesephase: Frage anzeigen, keine Antworten

    opt Lesephase aktiv
        D->>FE: Antworten freigeben
        FE->>BE: session.revealAnswers()
        BE->>PG: Status = ACTIVE
        BE->>R: Pub/Sub: onAnswersRevealed (QuestionStudentDTO OHNE isCorrect)
        R-->>S: Antwort-Buttons + Countdown
    end

    Note over S,BE: Student votet
    S->>FE: Antwort auswählen
    FE->>BE: vote.submit()
    BE->>PG: Vote speichern
    BE->>R: Pub/Sub: onVoteCountUpdate
    R-->>D: Live-Update

    Note over D,S: Ergebnisse werden aufgelöst
    D->>FE: Ergebnisse zeigen
    FE->>BE: session.revealResults()
    BE->>PG: Status = RESULTS
    BE->>BE: Scoring berechnen
    BE->>R: Pub/Sub: onResultsRevealed (MIT isCorrect!)
    R-->>S: Ergebnisse + Punkte

    Note over D,S: Zwischen Fragen: PAUSED, dann erneut nextQuestion; Session-Ende: session.end → FINISHED
```

### Admin-Datenfluss (Epic 9)

```mermaid
sequenceDiagram
    participant A as Admin
    participant FE as Frontend
    participant BE as Backend
    participant PG as PostgreSQL

    A->>FE: /admin – Login
    FE->>BE: admin.login (Admin-Schlüssel)
    BE-->>FE: Session-Token
    FE->>BE: admin.whoami (Token)
    BE-->>FE: authenticated=true
    A->>FE: Session-Code eingeben
    FE->>BE: admin.getSessionByCode (code) + Token
    BE->>PG: Session + Quiz lesen
    BE-->>FE: SessionDetailDTO
    FE->>A: Quiz-Inhalt anzeigen
    opt Löschen / Export
        A->>FE: Löschen oder Auszug
        FE->>BE: admin.deleteSession / exportForAuthorities + Token
        BE->>BE: Retention prüfen (PURGED -> reject)
        BE->>PG: Löschen oder Lesen + AuditLog
        BE-->>FE: success / Export-Daten
    end
```

## Komponenten-Hierarchie

### 1) App-Shell und globale Bausteine

```mermaid
%%{init: {'flowchart': {'curve': 'basis', 'nodeSpacing': 62, 'rankSpacing': 92, 'padding': 20}}}%%
graph LR
    APP[AppComponent]
    ROUTES[app.routes.ts]

    subgraph "Shared UI"
        TOOLBAR[TopToolbarComponent]
        BANNER[ConnectionBannerComponent]
        PRESET[PresetToastComponent]
        STATUS[ServerStatusWidgetComponent]
        CONFIRM[ConfirmLeaveDialogComponent]
    end

    subgraph "Core Services"
        TRPC[trpc.client]
        WSCONN[ws-connection.service]
        THEME[theme-preset.service]
        LOCALE[locale-switch-guard.service]
        SOUND[sound.service]
    end

    APP --> ROUTES
    APP --> TOOLBAR
    APP --> BANNER
    APP --> PRESET
    APP --> STATUS

    TOOLBAR --> CONFIRM
    THEME --> TOOLBAR
    LOCALE --> TOOLBAR
    WSCONN --> TRPC
    SOUND --> ROUTES
```

### 2) Feature-Routen (grober Zuschnitt)

```mermaid
%%{init: {'flowchart': {'curve': 'basis', 'nodeSpacing': 64, 'rankSpacing': 96, 'padding': 20}}}%%
graph LR
    ROUTES[app.routes.ts]

    HOME[HomeComponent<br/>inkl. Blitzlicht-Schnellstart]
    QUIZ[QuizComponent]
    SESSION[SessionComponent<br/>Quiz · Q&A · Blitzlicht]
    JOIN[JoinComponent]
    FEEDBACK_HOST[FeedbackHostComponent]
    FEEDBACK_VOTE[FeedbackVoteComponent]
    ADMIN[AdminComponent]
    HELP[HelpComponent]
    LEGAL[LegalPageComponent]

    ROUTES --> HOME
    ROUTES --> QUIZ
    ROUTES --> SESSION
    ROUTES --> JOIN
    ROUTES --> FEEDBACK_HOST
    ROUTES --> FEEDBACK_VOTE
    ROUTES --> ADMIN
    ROUTES --> HELP
    ROUTES --> LEGAL
```

### 3) Detail-Hierarchie: Quiz, Session, Admin

```mermaid
%%{init: {'flowchart': {'curve': 'basis', 'nodeSpacing': 60, 'rankSpacing': 90, 'padding': 18}}}%%
graph LR
    subgraph "Quiz"
        QSHELL[QuizComponent]
        QLIST[QuizListComponent]
        QNEW[QuizNewComponent]
        QEDIT[QuizEditComponent]
        PREVIEW[QuizPreviewComponent]
        QSYNC[QuizSyncComponent]
        QSHELL --> QLIST
        QSHELL --> QNEW
        QSHELL --> QEDIT
        QEDIT --> PREVIEW
        QSHELL --> QSYNC
    end

    subgraph "Session"
        SROOT[SessionComponent]
        SHOST[SessionHostComponent]
        SPRESENT[SessionPresentComponent]
        SVOTE[SessionVoteComponent]
        FBHOST[FeedbackHostComponent]
        FBVOTE[FeedbackVoteComponent]
        WCLOUD[WordCloudComponent]
        COUNTDOWN[CountdownFingersComponent]
        SROOT --> SHOST
        SROOT --> SPRESENT
        SROOT --> SVOTE
        SHOST --> FBHOST
        SVOTE --> FBVOTE
        SPRESENT --> WCLOUD
        SHOST --> COUNTDOWN
        SVOTE --> COUNTDOWN
    end

    subgraph "Admin"
        AROOT[AdminComponent]
        ALOGIN[Login-View]
        ALIST[Session-Liste + Lookup]
        ADETAIL[Session-Detail]
        AEXPORT[Export PDF/JSON]
        ADELETE[Delete-Flow]
        AROOT --> ALOGIN
        AROOT --> ALIST
        ALIST --> ADETAIL
        ADETAIL --> AEXPORT
        ADETAIL --> ADELETE
    end
```

## Technologie-Stack Übersicht

```mermaid
%%{init: {'theme': 'base', 'themeVariables': { 'primaryColor': '#e3f2fd', 'primaryTextColor': '#0d47a1', 'primaryBorderColor': '#1976d2', 'secondaryColor': '#e8f5e9', 'secondaryTextColor': '#1b5e20', 'secondaryBorderColor': '#388e3c', 'tertiaryColor': '#fff8e1', 'tertiaryTextColor': '#bf360c', 'tertiaryBorderColor': '#ff9800', 'lineColor': '#37474f', 'textColor': '#212121' }}}%%
mindmap
  root((arsnova.eu))
    Frontend
      Angular 21
        Standalone Components
        Signals
        Control Flow @if @for
      Angular Material 3
        Design Tokens
        SCSS Patterns
      tRPC Client
        httpBatchLink
        wsLink
      Yjs
        CRDTs
        IndexedDB
        y-websocket
    Backend
      Node.js
        Express
        TypeScript
      tRPC
        Router
        Procedures
        Subscriptions
      Prisma ORM
        PostgreSQL
        Schema
        Migrations
      Redis
        Pub/Sub
        Rate Limiting
    Shared
      shared-types Library
        Zod Schemas
        Type Definitions
        DTOs
    Architektur
      Local-First
        Zero-Knowledge
        Yjs CRDTs
      End-to-End Typsicherheit
        tRPC
        Zod Validation
      Data Stripping
        DTO Pattern
        Security
```

## Datenbank-Schema Übersicht

Session-Status (Story 2.6): `LOBBY`, `QUESTION_OPEN` (Lesephase), `ACTIVE`, `RESULTS`, `PAUSED`, `FINISHED`.

### Kernsicht (Quiz, Session, Votes)

```mermaid
%%{init: {'flowchart': {'nodeSpacing': 46, 'rankSpacing': 70, 'padding': 14}}}%%
erDiagram
    Quiz ||--o{ Question : enthaelt
    Quiz ||--o{ Session : verwendet_in
    Question ||--o{ AnswerOption : hat
    Question ||--o{ Vote : erhaelt
    Session ||--o{ Participant : hat
    Session ||--o{ Vote : sammelt
    Participant ||--o{ Vote : gibt_ab
    Vote ||--o{ VoteAnswer : waehlt
    AnswerOption ||--o{ VoteAnswer : wird_gewaehlt

    Quiz {
        string id PK
        string name
        boolean showLeaderboard
        int bonusTokenCount
        boolean readingPhaseEnabled
    }
    Question {
        string id PK
        string text
        enum type
        enum difficulty
    }
    Session {
        string id PK
        string code UK
        enum status
    }
    Participant {
        string id PK
        string nickname
    }
    Vote {
        string id PK
        int score
        int streakCount
    }
```

### Erweiterungen (Team, Bonus, Q&A, Session-Kanaele, Admin)

```mermaid
%%{init: {'flowchart': {'nodeSpacing': 46, 'rankSpacing': 70, 'padding': 14}}}%%
erDiagram
    Session ||--o{ Team : hat
    Team ||--o{ Participant : besteht_aus
    Session ||--o{ BonusToken : generiert
    Participant ||--o{ BonusToken : erhaelt
    Session ||--o{ QaQuestion : enthaelt
    Participant ||--o{ QaQuestion : stellt
    QaQuestion ||--o{ QaUpvote : erhaelt
    Participant ||--o{ QaUpvote : votet
    Session ||--o{ AdminAuditLog : protokolliert

    Session {
        boolean qaEnabled
        boolean quickFeedbackEnabled
    }
```

## Sicherheits-Architektur

### 1) Zero-Knowledge / Local-First

```mermaid
%%{init: {'flowchart': {'curve': 'basis', 'nodeSpacing': 60, 'rankSpacing': 80, 'padding': 18}}}%%
graph LR
    AUTHOR[Dozent erstellt Quiz]
    IDB[Lokale Speicherung<br/>IndexedDB + Yjs]
    YWS[y-websocket Relay<br/>nur Sync-Deltas]
    LIVE[Live-Schalten]
    PG[(PostgreSQL<br/>flüchtige Session-Kopie)]

    AUTHOR --> IDB
    IDB -.->|CRDT-Deltas| YWS
    IDB -->|quiz.upload bei Session-Start| LIVE
    LIVE --> PG

    style IDB fill:#4dabf7
```

### 2) Data-Stripping entlang des Session-Status

```mermaid
%%{init: {'flowchart': {'curve': 'basis', 'nodeSpacing': 60, 'rankSpacing': 80, 'padding': 18}}}%%
graph LR
    PG[(PostgreSQL<br/>mit isCorrect)]
    BE[Backend DTO-Layer]
    PREVIEW_DTO[QuestionPreviewDTO<br/>QUESTION_OPEN<br/>nur Fragenstamm]
    STUDENT_DTO[QuestionStudentDTO<br/>ACTIVE<br/>ohne isCorrect]
    REVEALED_DTO[QuestionRevealedDTO<br/>RESULTS<br/>mit isCorrect]
    CLIENT[Student-Client]

    PG -->|laden| BE
    BE --> PREVIEW_DTO
    BE --> STUDENT_DTO
    BE --> REVEALED_DTO
    PREVIEW_DTO --> CLIENT
    STUDENT_DTO --> CLIENT
    REVEALED_DTO --> CLIENT

    style PREVIEW_DTO fill:#ffd43b
    style STUDENT_DTO fill:#ff6b6b
    style REVEALED_DTO fill:#51cf66
```

### 3) Rollen-Autorisierung und Rate-Limiting

```mermaid
%%{init: {'flowchart': {'curve': 'basis', 'nodeSpacing': 60, 'rankSpacing': 80, 'padding': 18}}}%%
graph LR
    HOST[Host-Token<br/>aus session.create]
    ADMIN_SEC[ADMIN_SECRET<br/>Server-Env]
    ADMIN_TOKEN[Admin-Session-Token<br/>Redis + TTL]
    CLIENT[Client-Request]
    REDIS[(Redis)]
    BE[Backend tRPC]

    HOST -->|host/* Procedures| BE
    ADMIN_SEC -->|admin.login| BE
    BE -->|issue token| ADMIN_TOKEN
    ADMIN_TOKEN -->|admin.* Procedures| BE

    CLIENT -->|Sliding Window Check| REDIS
    REDIS -->|Allow / Deny| BE
```

---

**Weitere Diagramme:** Detaillierte Backend- und Frontend-Komponenten, Datenbank-Schema, Kommunikation Dozent/Student sowie Aktivitätsablauf finden sich in [diagrams.md](./diagrams.md) (Mermaid, von GitHub gerendert).

**Hinweis:** Diese Diagramme sind eine **vereinfachte Übersicht** (Living Documentation). Die vollständige Komponentenliste und alle DTOs finden sich in [diagrams.md](./diagrams.md). Bei größeren Architekturänderungen sollten beide Dateien aktualisiert werden.
