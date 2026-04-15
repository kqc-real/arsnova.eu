# Konsistenzprüfung: Diagramme · Handbuch · Backlog · Code

**Datum:** 2026-03-20  
**Geprüft:** diagrams.md, architecture-overview.md, handbook.md, Backlog.md, ADR-0006, ADR-0015/0016, ROUTES_AND_STORIES.md, prisma/schema.prisma, libs/shared-types, apps/backend, apps/frontend, [server-status-widget.md](../features/server-status-widget.md).

**Epic 0:** Alle Stories 0.1–0.6 umgesetzt (Redis, tRPC WebSocket, Yjs, Server-Status, Rate-Limiting, CI/CD). health.check, health.stats, health.ping, Rate-Limit-Service und Frontend ServerStatusWidget sind implementiert.

---

## 1. Konsistenz innerhalb der Diagramme (diagrams.md)

### 1.1 Backend-Komponenten

- **Router:** health, quiz, session, vote, qa, **admin** (Epic 9) – untereinander konsistent; adminRouter mit PG/Cleanup; Verbindungen zu Services, DTO, Validation und PG/Redis/WebSocket/y-websocket stimmig.
- **DTO-Layer:** QuestionStudentDTO (kein isCorrect), QuestionRevealedDTO (mit isCorrect), SessionInfoDTO, LeaderboardEntryDTO, PersonalScorecardDTO – stimmt mit shared-types Zod-Schemas überein.
- **Validation:** SubmitVoteInputSchema, CreateSessionInputSchema, QuizUploadInputSchema im Diagramm – alle drei existieren identisch in `libs/shared-types/src/schemas.ts`. ✓
- **Header:** Epic 0 umgesetzt; healthRouter (check, stats, ping), sessionRouter (mit Rate-Limit), voteRouter (mit Rate-Limit), Yjs- und WebSocket-Server implementiert. ✓

### 1.2 Frontend-Komponenten

- **Routen:** Home (/), Quiz (/quiz), Session (/session/:code/host), Beamer (/session/:code/present), Join (/join/:code), Student (/session/:code/vote), **Admin (/admin)**, Legal (/legal) – konsistent mit Backlog, ADR-0006 und ROUTES_AND_STORIES.md.
- **Komponenten:** Alle geplanten Komponenten (inkl. QaModeratorComponent, QaStudentComponent, RatingScaleComponent, FreetextInputComponent, MotivationMessageComponent, EmojiBarComponent, BonusTokenDisplay, BonusTokenListComponent, EmojiOverlayComponent, QrCodeComponent, WordcloudComponent, RatingHistogramComponent, ImportExportComponent, ConfirmDialogComponent) sind abgebildet. ✓

### 1.3 Datenbank-Schema (erDiagram)

- **Entitäten:** Quiz, Question, AnswerOption, Session, Participant, Team, Vote, VoteAnswer, BonusToken, QaQuestion, QaUpvote – stimmen mit Prisma-Schema überein. ✓
- **Relationen & Kardinalitäten:** Alle 1:n- und n:m-Beziehungen korrekt.
- **Felder im erDiagram:** Nur eine Auswahl dargestellt (id, name, text, etc.). Prisma-Schema enthält deutlich mehr Felder (z. B. Quiz hat 17 Felder im Schema, 4 im Diagramm). Akzeptable Vereinfachung.

### 1.4 Sequenzdiagramme (Dozent & Student)

- **Dozent:** Optional Phase „Quiz auf anderem Gerät öffnen“ (Story 1.6a: Sync-Link/Room-ID) nach Quiz erstellen; danach quiz.upload → session.create → Subscriptions → nextQuestion → revealResults → session.end → Redis-Cleanup → getBonusTokens; optional Ergebnis-Export (4.7) – Reihenfolge konsistent mit Backlog (1.6a, 2.1a, 2.3, 2.4, 4.2, 4.6, 4.7). ✓
- **Student:** session.getInfo → session.join → onQuestionRevealed → vote.submit → onResultsRevealed → onPersonalResult → onStatusChanged FINISHED → bonusToken – konsistent mit Backlog (3.1, 3.3a/b, 4.6, 5.6). ✓
- **DTOs:** QuestionStudentDTO (kein isCorrect) im ACTIVE-Status, QuestionRevealedDTO (mit isCorrect) im RESULTS-Status – korrekt dargestellt. ✓

### 1.5 Aktivitätsdiagramm

- Dozent/Student/Server-Phasen korrekt abgebildet.
- **`PAUSED`-Status:** In diagrams.md (Aktivitäts- und Dozent-Sequenzdiagramm) integriert — siehe §7.1 (Erledigt 2026-02-21).

---

## 2. Konsistenz zwischen diagrams.md und architecture-overview.md

| Thema                | diagrams.md                                                                                        | architecture-overview.md                                    | Bewertung                              |
| -------------------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | -------------------------------------- | ---------------------------------------- | -------- |
| tRPC-Router          | health, quiz, session, vote, qa, admin                                                             | health · quiz · session · vote · qa · admin                 | ✓ gleich                               |
| DTOs                 | QuestionStudentDTO, QuestionRevealedDTO, SessionInfoDTO, LeaderboardEntryDTO, PersonalScorecardDTO | QuestionStudentDTO, QuestionRevealedDTO                     | ⚠️ Übersicht benennt nur 2 DTOs        |
| Data-Stripping       | ACTIVE ohne isCorrect, RESULTS mit isCorrect                                                       | Sicherheits-Diagramm + Datenfluss                           | ✓ gleich                               |
| Session-Ablauf       | quiz.upload → session.create → …                                                                   | Datenfluss zeigt quiz.upload + session.create               | ✓ nach vorheriger Anpassung konsistent |
| Frontend-Routen      | /, /quiz, /session/:code/host                                                                      | present                                                     | vote, /join/:code, /admin, /legal      | architecture-overview: FE_ROUTES + Admin | ✓ gleich |
| DB-Modelle           | erDiagram inkl. AdminAuditLog                                                                      | `prisma/schema.prisma` inkl. `AdminAuditLog` (Story 9.2 ✅) | ✓                                      |
| Frontend-Komponenten | 37 Komponenten                                                                                     | 20 Komponenten                                              | ⚠️ Vereinfacht (siehe 2.1)             |

### 2.1 Fehlende Komponenten in architecture-overview.md

Die Komponenten-Hierarchie in architecture-overview.md ist eine **bewusst vereinfachte** Darstellung. Folgende Komponenten aus diagrams.md fehlen dort:

**Session-Steuerung:** QaModeratorComponent, BonusTokenListComponent  
**Beamer:** WordcloudComponent, RatingHistogramComponent, EmojiOverlayComponent, QrCodeComponent  
**Student:** McToggleButtonsComponent, RatingScaleComponent, FreetextInputComponent, MotivationMessageComponent, EmojiBarComponent, QaStudentComponent, BonusTokenDisplay  
**Shared:** LanguageSwitcherComponent, ConfirmDialogComponent, MarkdownKatexComponent (fehlt in Hierarchie-Darstellung)  
**Quiz:** ImportExportComponent, QuizConfigComponent

**Empfehlung:**  
Da beide Dateien als Living Documentation dienen, sollte architecture-overview.md entweder (a) einen expliziten Vermerk „Vereinfachte Darstellung – Details in diagrams.md" tragen oder (b) die fehlenden Komponenten ergänzt werden, um Verwirrung zu vermeiden.

---

## 3. Abdeckung Handbuch (Handbook)

| Handbuch-Kapitel                      | In Diagrammen abgebildet                                                                                                                                                                           |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **§2 Technologie-Stack**              | Angular, tRPC, PostgreSQL/Prisma, Redis, Yjs – in architecture-overview + diagrams.md ✓                                                                                                            |
| **§3.1 Local-First & Zero-Knowledge** | Quiz-Sammlung lokal (Yjs/IndexedDB); Session-Kopie (quiz.upload) in Dozent-Sequenz ✓                                                                                                               |
| **§3.2 End-to-End Typsicherheit**     | tRPC Router, httpBatchLink/wsLink, Path-Alias @arsnova/api – in Frontend-Services und System-Architektur ✓                                                                                         |
| **§3.3 Security & Data-Stripping**    | QuestionStudentDTO ohne isCorrect, QuestionRevealedDTO mit isCorrect; Sicherheits-Diagramm in architecture-overview ✓                                                                              |
| **§5 Datenmodell**                    | Prisma als Single Source of Truth – erDiagram in beiden Dateien, synchron mit schema.prisma ✓                                                                                                      |
| **Story 0.4 Server-Status**           | Aggregierte Kennzahlen + Polling: ausführlich in [server-status-widget.md](../features/server-status-widget.md) (Sequenz-, Zustands- und Aktivitätsdiagramme); Architektur-Diagramme nur kompakt ✓ |

---

## 4. Abdeckung Backlog (Stories/Epics)

### Epic 0: Infrastruktur (✅ abgeschlossen)

| Story              | Abgedeckt in Diagrammen                                   | Anmerkung                                                                                                                                                                                          |
| ------------------ | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0.1 Redis-Setup    | Redis in System- und Backend-Architektur ✓                | Docker Compose + health.check (redis=ok) implementiert                                                                                                                                             |
| 0.2 tRPC WebSocket | WebSocket Server + wsLink in Diagrammen ✓                 | health.ping Subscription, wsLink/httpBatchLink im Frontend implementiert                                                                                                                           |
| 0.3 Yjs WebSocket  | y-websocket Relay in Backend-Diagramm ✓                   | y-websocket-Server (Port 3002) im Backend integriert                                                                                                                                               |
| 0.4 health.stats   | ServerStatusWidget im Frontend-Diagramm ✓                 | `health.stats` + Footer-Widget (`compact`), Polling **30 s**, `health.check` → `connectionOk`; Schwellen 50/200; Details + Mermaid: [server-status-widget.md](../features/server-status-widget.md) |
| 0.5 Rate-Limiting  | RateLimitService in Backend-Diagramm ✓                    | Redis Sliding-Window, TOO_MANY_REQUESTS, Env-konfigurierbar implementiert                                                                                                                          |
| 0.6 CI/CD          | Nicht in Architektur-Diagrammen (korrekt, da Dev-Tooling) | GitHub Actions: Build, Lint, Test, Docker-Build, Matrix Node 20/22 ✓                                                                                                                               |

### Epic 1: Quiz-Verwaltung

- QuizEditorComponent, QuestionEditorComponent, AnswerEditorComponent, QuizPreviewComponent, ImportExportComponent – alle in Frontend-Diagramm ✓
- **Story 1.6a (Quiz auf anderem Gerät öffnen – Sync-Link/Room-ID):** Dozent-Sequenz (opt. Phase „Auf anderem Gerät öffnen“) und Aktivitätsdiagramm (Schritt D1a) in diagrams.md; Datenfluss in architecture-overview.md (opt. Sync-Link) ✓
- Quiz-Presets (1.11) und SC-Schnellformate (1.12) – clientseitig in shared-types definiert, Komponenten implizit in QuizConfigComponent ✓
- Markdown/KaTeX (1.7) – MarkdownKatexComponent in Shared ✓
- Stories **1.7a/1.7b** (Markdown-Bilder URL+Lightbox, KaTeX-Editor MD3-Toolbar) – Backlog offen, [ADR-0015](../architecture/decisions/0015-markdown-images-url-only-and-lightbox.md) / [ADR-0016](../architecture/decisions/0016-markdown-katex-editor-split-view-and-md3-toolbar.md); keine eigene Mermaid-Erweiterung nötig
- Word Cloud interaktiv + Export (1.14) – WordcloudComponent bereits in Beamer/Ergebnis-Ansicht; Export (CSV/PNG) in Story 1.14 spezifiziert ✓

### Epic 2: Session-Start & Steuerung

- quiz.upload + session.create in Dozent-Sequenz ✓
- QR-Code (2.1b) – QrCodeComponent im Beamer-Diagramm ✓
- Lobby (2.2) – LobbyComponent + onParticipantJoined ✓
- Data-Stripping (2.4) – QuestionStudentDTO/QuestionRevealedDTO in allen relevanten Diagrammen ✓
- Beamer-Ansicht (2.5) – BeamerViewComponent mit Chart, Leaderboard, Wordcloud, etc. ✓

### Epic 3: Student-Teilnahme

- session.getInfo + session.join in Student-Sequenz ✓
- Nicknames (3.2) – NicknameSelectComponent ✓
- Frage/Vote (3.3a/b) – VotingViewComponent, AnswerButtons, McToggle, Freetext, RatingScale ✓
- Countdown (3.5) – CountdownComponent in Beamer und Student ✓
- Anonymer Modus (3.6) – anonymousMode in Prisma-Schema, keine explizite Diagramm-Darstellung ⚠️

### Epic 4: Ergebnis & Cleanup

- Leaderboard (4.1) – LeaderboardComponent + LeaderboardEntryDTO ✓
- Cleanup (4.2) – Redis-Cleanup in Dozent-Sequenz ✓
- Ergebnis-Visualisierung (4.4) – ResultChartComponent, WordcloudComponent, RatingHistogramComponent ✓
- Bonus-Token (4.6) – BonusTokenListComponent, BonusTokenDisplay, Token-Generierung in Sequenzdiagramm ✓
- Ergebnis-Export für Dozenten (4.7) – optional in Dozent-Sequenz (diagrams.md §4.3) als `session.getExportData` / SessionExportDTO abgebildet ✓

### Epic 5: Gamification

- Sound/Musik (5.1, 5.3) – In Prisma-Schema (enableSoundEffects, backgroundMusic), nicht in Diagrammen dargestellt ⚠️ (akzeptabel, da clientseitig)
- Scorecard (5.6) – ScorecardComponent + PersonalScorecardDTO + onPersonalResult ✓
- Emoji (5.8) – EmojiBarComponent, EmojiOverlayComponent ✓
- Motivation (5.7) – MotivationMessageComponent ✓

### Epic 9: Admin (Rollen, Routen, Autorisierung)

- **adminRouter** in Backend-Diagramm (diagrams.md + architecture-overview.md) ✓
- **Admin-Client** in Externe Clients (architecture-overview) ✓
- **Route /admin**, Admin-Subgraph (AdminLogin, AdminDashboard, SessionCodeInput, SessionList, SessionDetail, ExportForAuthorities) in Frontend-Diagrammen ✓
- **Sequenz Admin ↔ Backend** (admin.login, getSessionByCode, listSessions, deleteSession, exportForAuthorities) in diagrams.md §5b + architecture-overview „Admin-Datenfluss" ✓
- **Aktivitätsdiagramm:** Admin-Subgraph (A1–A5) + Server S7–S10 ✓
- **Sicherheits-Architektur:** Rollen-Autorisierung (Host-Token, ADMIN_SECRET, admin.\* + Token) in architecture-overview ✓
- **AdminAuditLog** in erDiagram (diagrams.md) und Prisma-Schema (Story 9.2 ✅) ✓

### Epic 6: Theming, i18n, Legal

- Theme (6.1) – ThemeSwitcherComponent + ThemeService ✓
- i18n (6.2) – LanguageSwitcherComponent + I18nService ✓
- Legal (6.3) – ImprintComponent, PrivacyComponent, /legal Route ✓
- Mobile-First (6.4) – in Architektur-Diagrammen nicht einzeln modelliert (UI-Querschnitt) ✓
- Barrierefreiheit (6.5) – offen; Diagramme erwähnen A11y nicht explizit ⚠️
- Thinking Aloud (6.6) – offen; kein Diagrammbezug erforderlich

### Epic 7: Team-Modus

- Team im DB-Schema (Team, Participant.teamId) ✓
- TeamLeaderboardEntryDTO in shared-types ✓
- Team-Leaderboard ohne eigene Komponente: Daten in SessionHost / Present / Vote — siehe `docs/features/team-mode.md`

### Epic 8: Q&A

- qaRouter in Backend-Diagramm ✓
- QaModeratorComponent (Dozent), QaStudentComponent (Student) ✓
- QaQuestion, QaUpvote im DB-Schema ✓
- QaQuestionDTO, SubmitQaQuestionInputSchema, UpvoteQaQuestionInputSchema in shared-types ✓

---

## 5. Konsistenz Zod-Schemas ↔ Prisma-Schema

| Zod-Schema (shared-types) | Prisma-Modell/Enum             | Status                                                                    |
| ------------------------- | ------------------------------ | ------------------------------------------------------------------------- |
| QuestionTypeEnum          | QuestionType                   | ✓ Werte identisch                                                         |
| SessionStatusEnum         | SessionStatus                  | ✓ Werte identisch                                                         |
| DifficultyEnum            | Difficulty                     | ✓ Werte identisch                                                         |
| NicknameThemeEnum         | NicknameTheme                  | ✓ Werte identisch                                                         |
| TeamAssignmentEnum        | TeamAssignment                 | ✓ Werte identisch                                                         |
| QaQuestionStatusEnum      | QaQuestionStatus               | ✓ Werte identisch                                                         |
| SessionTypeEnum           | SessionType                    | ✓ Werte identisch                                                         |
| QuizUploadInputSchema     | Quiz + Question + AnswerOption | ✓ Felder stimmen überein                                                  |
| CreateSessionInputSchema  | Session                        | ✓ type, quizId, title, moderationMode                                     |
| JoinSessionInputSchema    | Participant + Session          | ✓ code (6 Zeichen), nickname                                              |
| SubmitVoteInputSchema     | Vote + VoteAnswer              | ✓ sessionId, questionId, answerIds, freeText, ratingValue, responseTimeMs |

**Bewertung:** Alle Zod-Enums sind synchron mit den Prisma-Enums. Input-Schemas spiegeln die Prisma-Modelle korrekt wider. ✓

---

## 6. Konsistenz Diagramme ↔ Code (Implementierungsstand 2026-03-20)

| Aspekt              | Im Diagramm                                                    | Im Code                                                  | Status |
| ------------------- | -------------------------------------------------------------- | -------------------------------------------------------- | ------ |
| Backend appRouter   | health, quiz, session, vote, qa, quickFeedback, admin          | `apps/backend/src/routers/index.ts` – gleiche Sub-Router | ✓      |
| Persistenz / Prisma | PostgreSQL, Session-Modelle, AdminAuditLog, Q&A, BonusToken    | `prisma/schema.prisma`                                   | ✓      |
| Redis / Rate-Limit  | Pub/Sub, Sliding Window                                        | `rateLimit`-Lib, Session-Publish                         | ✓      |
| WebSocket tRPC      | Port 3001, Subscriptions                                       | Backend ws-Server + Frontend `wsLink`                    | ✓      |
| Yjs Relay           | y-websocket :3002                                              | Backend Relay + Frontend CRDT-Pfad                       | ✓      |
| Frontend            | Routen Home, Quiz, Session, Join, Feedback, Admin, Legal, Help | `app.routes.ts` + Feature-Module                         | ✓      |
| Shared-Types        | Zod-Schemas / DTOs in Diagramm-Validation-Box                  | `libs/shared-types`, von tRPC genutzt                    | ✓      |

**Bewertung:** Die zentralen Architekturdiagramme entsprechen dem aktuell umgesetzten Produktstand. Bewusste Vereinfachungen: keine vollständige Auflistung aller Procedures, Utility-Dateien (z. B. Vollbild-Helfer) und feingranulare UI-Komponenten.

---

## 7. Gefundene Probleme

### 7.1 `PAUSED`-Status (Historie)

**Erledigt (2026-02-21):** `PAUSED` ist im Prisma-Enum `SessionStatus` und in **diagrams.md** (Aktivitätsdiagramm sowie Dozent-Sequenz) im Übergang zwischen Fragen abgebildet; architecture-overview Datenfluss enthält eine FINISHED/PAUSED-Note. Bei neuen Session-Phasen beide Dateien prüfen.

### 7.2 `health.stats` und Sequenzdiagramme in Architektur-Diagrammen

Story 0.4: Das **ServerStatusWidget** ist in diagrams.md (App-Shell / Shared) abgebildet; ein **detaillierter Ablauf** (`health.check` → `apiStatus` / `connectionOk`, `health.stats` alle 30 s, Redis-`SCAN`, Schwellen) steht bewusst **nicht** in diagrams.md/architecture-overview, sondern in **[server-status-widget.md](../features/server-status-widget.md)** inkl. Sequenz-, Fehler- und Cleanup-Diagrammen.

**Empfehlung:** Bei Fragen zu 0.4 das Feature-Dokument als Quelle nutzen; zentrale Architektur-Diagramme nur bei größeren Routing-/Router-Änderungen mitziehen.

### 7.3 Team-Leaderboard-Komponente

`TeamLeaderboardEntryDTO` ist in shared-types definiert; es gibt **keine** eigene `TeamLeaderboardComponent` — `session.getTeamLeaderboard` wird in **SessionHost**, **SessionPresent** und **SessionVote** genutzt (siehe [team-mode.md](../features/team-mode.md) § Team-Leaderboard in der UI).

**Empfehlung:** In `diagrams.md` weiterhin optional als Vereinfachung; bei Detailfragen [team-mode.md](../features/team-mode.md) als Quelle nutzen.

---

## 8. Zusammenfassung

| Aspekt                                     | Bewertung                                                                                                              |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| **Diagramme intern**                       | ✓ Konsistent (Router, DTOs, Abläufe, DB-Schema stimmig)                                                                |
| **diagrams.md ↔ architecture-overview.md** | ✅ architecture-overview als vereinfachte Übersicht gekennzeichnet; Details in diagrams.md                             |
| **Diagramme ↔ Handbook**                   | ✓ Alle Kernkonzepte (Local-First, tRPC, Data-Stripping, Datenmodell) abgebildet                                        |
| **Diagramme ↔ Backlog**                    | ✓ Relevante Stories aus Epics 0–8 abgedeckt; 0.4 vertieft in server-status-widget.md; offene Mini-Lücke §7.3 (Team-UI) |
| **Zod-Schemas ↔ Prisma**                   | ✓ Alle Enums synchron, Input-Schemas spiegeln Modelle korrekt                                                          |
| **Diagramme ↔ Code**                       | ✓ Kernpfad (Router, DB, WS, Yjs, Frontend-Routen) abgedeckt                                                            |

**Gesamtbewertung:** Die Diagramme sind intern konsistent und decken Handbook sowie Backlog umfassend ab. Die architecture-overview.md ist als vereinfachte Übersicht gekennzeichnet. Der PAUSED-Status ist in diagrams.md und im Datenfluss in architecture-overview.md berücksichtigt. **health.stats (0.4):** Ablauf in [server-status-widget.md](../features/server-status-widget.md). Team-Ranking: siehe [team-mode.md](../features/team-mode.md) statt eigener Diagramm-Komponente.
