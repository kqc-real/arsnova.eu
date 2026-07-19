# Konsistenzprüfung: Diagramme · Handbuch · Backlog · Code

**Datum:** 2026-06-17

**Geprüft:** diagrams.md, architecture-overview.md, handbook.md, Backlog.md, ADR-0006, ADR-0015/0016, ADR-0021, ADR-0028/0029, ROUTES_AND_STORIES.md, GLOSSAR.md, onboarding.md, prisma/schema.prisma, libs/shared-types, apps/backend, apps/frontend, [server-status-widget.md](../features/server-status-widget.md), [numeric-estimate.md](../features/numeric-estimate.md).

**Epic 0:** Alle Stories 0.1–0.6 umgesetzt (Redis, tRPC WebSocket, Yjs, Server-Status, Rate-Limiting, CI/CD). health.check, health.footerBundle, health.stats, health.ping, Rate-Limit-Service und Frontend ServerStatusWidget sind implementiert.

---

## 1. Konsistenz innerhalb der Diagramme (diagrams.md)

### 1.1 Backend-Komponenten

- **Router:** health, quiz, session, vote, qa, quickFeedback, wordCloud, **admin** (Epic 9), **motd** (Epic 10) – untereinander konsistent; adminRouter mit PG/Cleanup; motdRouter mit PG/Rate-Limit; wordCloudRouter mit deterministischer Analyse ohne eigene Persistenz; Verbindungen zu Services, DTO, Validation und PG/Redis/WebSocket/y-websocket stimmig.
- **DTO-Layer:** QuestionStudentDTO (kein isCorrect), QuestionRevealedDTO (mit isCorrect), SessionInfoDTO, LeaderboardEntryDTO, PersonalScorecardDTO und NumericEstimate-DTOs für Histogramm/Stats/Rundenvergleich – stimmt mit shared-types Zod-Schemas überein.
- **Validation:** SubmitVoteInputSchema, CreateSessionInputSchema, QuizUploadInputSchema im Diagramm – alle drei existieren identisch in `libs/shared-types/src/schemas.ts`. ✓
- **Header:** Epic 0 umgesetzt; healthRouter (check, stats, ping), sessionRouter (mit Rate-Limit), voteRouter (mit Rate-Limit), Yjs- und WebSocket-Server implementiert. ✓

### 1.2 Frontend-Komponenten

- **Routen:** Home (/), Quiz (/quiz), Quiz-Sync (/quiz/sync/:docId), Session (/session/:code/host|present|vote), Join (/join/:code), Standalone-Blitzlicht (/feedback/:code|vote), **Admin (/admin)**, Help (/help), News-Archiv (/news-archive), Legal (/legal/imprint|privacy) – konsistent mit Backlog, ADR-0006 und ROUTES_AND_STORIES.md.
- **Komponenten:** Alle geplanten Komponenten (inkl. QaModeratorComponent, QaStudentComponent, RatingScaleComponent, FreetextInputComponent, MotivationMessageComponent, EmojiBarComponent, BonusTokenDisplay, BonusTokenListComponent, EmojiOverlayComponent, QrCodeComponent, WordcloudComponent, RatingHistogramComponent, ImportExportComponent, ConfirmDialogComponent) sind abgebildet. ✓

### 1.3 Datenbank-Schema (erDiagram)

- **Entitäten:** Quiz, Question, AnswerOption, Session, Participant, PlatformStatistic, DailyStatistic, Team, Vote, VoteAnswer, BonusToken, SessionFeedback, QaQuestion, QaUpvote, AdminAuditLog, MotdTemplate, Motd, MotdLocale, MotdInteractionCounter, MotdAuditLog – stimmen mit Prisma-Schema überein. ✓
- **Relationen & Kardinalitäten:** Alle zentralen 1:n-, n:m- und Snapshot-Beziehungen korrekt; optionale Beziehungen (`Session.quizId`, `Participant.teamId`, `Motd.templateId`) sind im ER-Diagramm als optional bzw. kompakt dargestellt.
- **Felder im erDiagram:** Bewusst fachlich gekürzte Auswahl. Neuere schema-relevante Felder sind sichtbar: SHORT_TEXT-/Numeric-Konfigurationen, `NUMERIC_ESTIMATE`-Felder (`numericReferenceValue`, Toleranzintervall, Eingabetyp, `numericTwoRounds`, `Vote.numericValue`), Session-Kanäle, Onboarding-/Legal-Hold-Hinweise, SessionFeedback, Platform/DailyStatistic und MOTD.

### 1.4 Sequenzdiagramme (Dozent & Student)

- **Dozent:** Optional Phase „Quiz auf anderem Gerät öffnen“ (Story 1.6a: Sync-Link/Room-ID) nach Quiz erstellen; danach quiz.upload → session.create → Subscriptions → nextQuestion → ggf. NUMERIC_ESTIMATE-Diskussion/Runde 2 → revealResults → session.end → Redis-Cleanup → getBonusTokens; optional Ergebnis-Export (4.7) – Reihenfolge konsistent mit Backlog (1.2d, 1.6a, 2.1a, 2.3, 2.4, 4.2, 4.6, 4.7). ✓
- **Student:** session.getInfo → session.join → onQuestionRevealed → vote.submit (`answerIds`, `freeText`, `ratingValue` oder `numericValue`) → onResultsRevealed → onPersonalResult → onStatusChanged FINISHED → bonusToken – konsistent mit Backlog (1.2d, 3.1, 3.3a/b, 4.6, 5.6). ✓
- **DTOs:** QuestionStudentDTO (kein isCorrect; bei NUMERIC_ESTIMATE keine Verteilung/Lösungsnähe) im ACTIVE-Status, QuestionRevealedDTO (mit isCorrect bzw. Schätzfragen-Stats nach Freigabe) im RESULTS-Status – korrekt dargestellt. ✓

### 1.5 Aktivitätsdiagramm

- Dozent/Student/Server-Phasen korrekt abgebildet.
- **`PAUSED`-Status:** In diagrams.md (Aktivitäts- und Dozent-Sequenzdiagramm) integriert — siehe §7.1 (Erledigt 2026-02-21).

---

## 2. Konsistenz zwischen diagrams.md und architecture-overview.md

| Thema                | diagrams.md                                                                                                                   | architecture-overview.md                                                                   | Bewertung                     |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ----------------------------- |
| tRPC-Router          | health, quiz, session, vote, qa, quickFeedback, wordCloud, admin, motd                                                        | health · quiz · session · vote · qa · quickFeedback · wordCloud · admin · motd             | ✓ gleich                      |
| DTOs                 | QuestionStudentDTO, QuestionRevealedDTO, SessionInfoDTO, LeaderboardEntryDTO, PersonalScorecardDTO, NumericEstimate-Stats     | QuestionPreviewDTO, QuestionStudentDTO, QuestionRevealedDTO, NumericEstimate-Stats-Hinweis | ⚠️ Übersicht bleibt kompakter |
| Data-Stripping       | ACTIVE ohne isCorrect/Schätzlagen, RESULTS mit isCorrect bzw. NumericEstimate-Stats                                           | Sicherheits-Diagramm + Datenfluss                                                          | ✓ gleich                      |
| Session-Ablauf       | quiz.upload → session.create → …                                                                                              | Datenfluss zeigt quiz.upload + session.create                                              | ✓ konsistent                  |
| Frontend-Routen      | /, /quiz, /quiz/sync/:docId, /session/:code/(host/present/vote), /join/:code, /feedback, /admin, /help, /news-archive, /legal | FE_ROUTES mit denselben Hauptpfaden                                                        | ✓ gleich                      |
| DB-Modelle           | erDiagram inkl. SessionFeedback, Platform/DailyStatistic, MOTD und Audit-Snapshots                                            | `prisma/schema.prisma` inkl. gleicher Modelle                                              | ✓                             |
| Frontend-Komponenten | Detailliertere Feature-Hierarchie                                                                                             | Kompaktere Architekturübersicht                                                            | ⚠️ Vereinfacht (siehe 2.1)    |

### 2.1 Fehlende Komponenten in architecture-overview.md

Die Komponenten-Hierarchie in architecture-overview.md ist eine **bewusst vereinfachte** Darstellung. Folgende Komponenten aus diagrams.md fehlen dort:

- **Session-Steuerung:** QaModeratorComponent, BonusTokenListComponent
- **Beamer:** WordcloudComponent, RatingHistogramComponent, EmojiOverlayComponent, QrCodeComponent
- **Student:** McToggleButtonsComponent, RatingScaleComponent, FreetextInputComponent, NumericEstimateInput/-Result, MotivationMessageComponent, EmojiBarComponent, QaStudentComponent, BonusTokenDisplay
- **Shared:** LanguageSwitcherComponent, ConfirmDialogComponent, MarkdownKatexComponent (fehlt in Hierarchie-Darstellung)
- **Quiz:** ImportExportComponent, QuizConfigComponent

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

| Story              | Abgedeckt in Diagrammen                                   | Anmerkung                                                                                                                                                                                                                                            |
| ------------------ | --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0.1 Redis-Setup    | Redis in System- und Backend-Architektur ✓                | Docker Compose + health.check (redis=ok) implementiert                                                                                                                                                                                               |
| 0.2 tRPC WebSocket | WebSocket Server + wsLink in Diagrammen ✓                 | health.ping Subscription, wsLink/httpBatchLink im Frontend implementiert                                                                                                                                                                             |
| 0.3 Yjs WebSocket  | y-websocket Relay in Backend-Diagramm ✓                   | y-websocket-Server (Port 3002) im Backend integriert                                                                                                                                                                                                 |
| 0.4 Server-Status  | ServerStatusWidget im Frontend-Diagramm ✓                 | `health.footerBundle` für Footer-Dot, `health.stats` für Detaildialog, Polling 5 min im Footer, 30-s Dialog-/Server-Cache, Service-/Laststatus und DailyStatistic; Details + Mermaid: [server-status-widget.md](../features/server-status-widget.md) |
| 0.5 Rate-Limiting  | RateLimitService in Backend-Diagramm ✓                    | Redis Sliding-Window, TOO_MANY_REQUESTS, Env-konfigurierbar implementiert                                                                                                                                                                            |
| 0.6 CI/CD          | Nicht in Architektur-Diagrammen (korrekt, da Dev-Tooling) | GitHub Actions: Build, Lint, Test, Docker-Build, Matrix Node 20/22 ✓                                                                                                                                                                                 |

### Epic 1: Quiz-Verwaltung

- QuizEditorComponent, QuestionEditorComponent, AnswerEditorComponent, QuizPreviewComponent, ImportExportComponent – alle in Frontend-Diagramm ✓
- **Story 1.6a (Quiz auf anderem Gerät öffnen – Sync-Link/Room-ID):** Dozent-Sequenz (opt. Phase „Auf anderem Gerät öffnen“) und Aktivitätsdiagramm (Schritt D1a) in diagrams.md; Datenfluss in architecture-overview.md (opt. Sync-Link) ✓
- Quiz-Presets (1.11) und SC-Schnellformate (1.12) – clientseitig in shared-types definiert, Komponenten implizit in QuizConfigComponent ✓
- Markdown/KaTeX (1.7) – MarkdownKatexComponent in Shared ✓
- Stories **1.7a** und **1.7b** (Markdown-Bilder URL+Lightbox, KaTeX-Editor MD3-Toolbar) – umgesetzt ([ADR-0015](../architecture/decisions/0015-markdown-images-url-only-and-lightbox.md), [ADR-0016](../architecture/decisions/0016-markdown-katex-editor-split-view-and-md3-toolbar.md)); keine eigene Mermaid-Erweiterung nötig
- Story **1.2d NUMERIC_ESTIMATE** – umgesetzt und in Diagrammen sichtbar: Question-/Vote-Felder, Data-Stripping während ACTIVE, Runde-2-Pfad, Histogramm/Statistik/Paarvergleich nach RESULTS; Details in [numeric-estimate.md](../features/numeric-estimate.md) ✓
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
- Frage/Vote (3.3a/b) – VotingViewComponent, AnswerButtons, McToggle, Freetext, RatingScale, NumericEstimateInput ✓
- Countdown (3.5) – CountdownComponent in Beamer und Student ✓
- Anonymer Modus (3.6) – anonymousMode in Prisma-Schema, keine explizite Diagramm-Darstellung ⚠️

### Epic 4: Ergebnis & Cleanup

- Leaderboard (4.1) – LeaderboardComponent + LeaderboardEntryDTO ✓
- Cleanup (4.2) – Redis-Cleanup in Dozent-Sequenz ✓
- Ergebnis-Visualisierung (4.4) – ResultChartComponent, WordcloudComponent, RatingHistogramComponent, NumericEstimateHistogram/Stats ✓
- Bonus-Token (4.6) – BonusTokenListComponent, BonusTokenDisplay, Token-Generierung in Sequenzdiagramm ✓
- Ergebnis-Export für Dozenten (4.7) – optional in Dozent-Sequenz (diagrams.md §4.3) als `session.getExportData` / `getSessionExportPdf` / SessionExportDTO sowie Quiz-Sammlung via `getLastSessionExportPdfForQuiz` abgebildet ✓

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
- Barrierefreiheit (6.5) – technische Befunde und Gates umgesetzt; manuelle
  AT-/Zoom-/OS-Abnahme in Arbeit. A11y bleibt ein UI-Querschnitt und wird nicht
  als eigener Laufzeitknoten modelliert ✓
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

| Zod-Schema (shared-types)                                                    | Prisma-Modell/Enum                                     | Status                                                                                  |
| ---------------------------------------------------------------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| QuestionTypeEnum                                                             | QuestionType                                           | ✓ Werte identisch                                                                       |
| SessionStatusEnum                                                            | SessionStatus                                          | ✓ Werte identisch                                                                       |
| DifficultyEnum                                                               | Difficulty                                             | ✓ Werte identisch                                                                       |
| NicknameThemeEnum                                                            | NicknameTheme                                          | ✓ Werte identisch                                                                       |
| TeamAssignmentEnum                                                           | TeamAssignment                                         | ✓ Werte identisch                                                                       |
| QaQuestionStatusEnum                                                         | QaQuestionStatus                                       | ✓ Werte identisch                                                                       |
| SessionTypeEnum                                                              | SessionType                                            | ✓ Werte identisch                                                                       |
| MotdStatusEnum                                                               | MotdStatus                                             | ✓ Werte identisch                                                                       |
| MotdAuditActionEnum                                                          | MotdAuditAction                                        | ✓ Werte identisch                                                                       |
| ShortTextEvaluationKindEnum / ShortAnswerEvaluationModeEnum / Numeric\*Enums | Question-Stringfelder                                  | ✓ Werte werden in Zod validiert und als String-Konfiguration persistiert                |
| NumericEstimateToleranceModeEnum / NumericInputTypeEnum                      | Question-Stringfelder                                  | ✓ `NUMERIC_ESTIMATE`-Konfiguration wird über Zod validiert                              |
| QuizUploadInputSchema                                                        | Quiz + Question + AnswerOption                         | ✓ Felder stimmen überein                                                                |
| CreateSessionInputSchema                                                     | Session                                                | ✓ type, quizId, title, moderationMode                                                   |
| JoinSessionInputSchema                                                       | Participant + Session                                  | ✓ code (6 Zeichen), nickname                                                            |
| SubmitVoteInputSchema                                                        | Vote + VoteAnswer                                      | ✓ sessionId, questionId, answerIds, freeText, ratingValue, numericValue, responseTimeMs |
| NumericEstimateStats-/Histogram-/RoundComparison-Schemas                     | Vote + Question                                        | ✓ Aggregierte Ergebnisdaten erst in RESULTS                                             |
| SubmitSessionFeedbackInputSchema                                             | SessionFeedback                                        | ✓ sessionId, participantId, Ratings                                                     |
| ServerStatsDTOSchema                                                         | PlatformStatistic + DailyStatistic                     | ✓ Allzeit- und Tagesrekord-Metriken                                                     |
| Motd\*Schemas                                                                | Motd, MotdLocale, MotdInteractionCounter, MotdTemplate | ✓ Public/Admin-Daten über DTOs statt Prisma-Rows                                        |

**Bewertung:** Prisma-Enums und Zod-Enums sind synchron, wo es echte DB-Enums gibt. SHORT_TEXT-/Numeric- und NUMERIC_ESTIMATE-Einstellungen sind bewusst als Prisma-Stringfelder modelliert und werden über Zod-Enums abgesichert. Input-/DTO-Schemas spiegeln die relevanten Modelle korrekt wider. ✓

---

## 6. Konsistenz Diagramme ↔ Code (Implementierungsstand 2026-05-31)

| Aspekt              | Im Diagramm                                                                      | Im Code                                                                      | Status |
| ------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------ |
| Backend appRouter   | health, quiz, session, vote, qa, quickFeedback, wordCloud, admin, motd           | `apps/backend/src/routers/index.ts` – gleiche Sub-Router                     | ✓      |
| Persistenz / Prisma | PostgreSQL, Session-Modelle, Feedback, Q&A, BonusToken, Statistiken, MOTD, Audit | `prisma/schema.prisma`                                                       | ✓      |
| Redis / Rate-Limit  | Sliding Window, Token-TTLs, Presence-/Live-Hilfsdaten, Blitzlicht-Zustand        | `rateLimit`, `hostAuth`, `adminAuth`, Presence/Load-Signale, `quickFeedback` | ✓      |
| WebSocket tRPC      | Port 3001, Subscriptions                                                         | Backend ws-Server + Frontend `wsLink`                                        | ✓      |
| Yjs Relay           | y-websocket :3002                                                                | Backend Relay + Frontend CRDT-Pfad                                           | ✓      |
| Frontend            | Routen Home, Quiz, Session, Join, Feedback, Admin, Help, News-Archiv, Legal      | `app.routes.ts` + Feature-Module                                             | ✓      |
| Shared-Types        | Zod-Schemas / DTOs in Diagramm-Validation-Box                                    | `libs/shared-types`, von tRPC genutzt                                        | ✓      |

**Bewertung:** Die zentralen Architekturdiagramme entsprechen dem aktuell umgesetzten Produktstand. Bewusste Vereinfachungen: keine vollständige Auflistung aller Procedures, Utility-Dateien (z. B. Vollbild-Helfer) und feingranulare UI-Komponenten.

---

## 7. Gefundene Probleme

### 7.1 `PAUSED`-Status (Historie)

**Erledigt (2026-02-21):** `PAUSED` ist im Prisma-Enum `SessionStatus` und in **diagrams.md** (Aktivitätsdiagramm sowie Dozent-Sequenz) im Übergang zwischen Fragen abgebildet; architecture-overview Datenfluss enthält eine FINISHED/PAUSED-Note. Bei neuen Session-Phasen beide Dateien prüfen.

### 7.2 Server-Status und Sequenzdiagramme in Architektur-Diagrammen

Story 0.4: Das **ServerStatusWidget** ist in diagrams.md (App-Shell / Shared) abgebildet; ein **detaillierter Ablauf** (`health.footerBundle` → `apiStatus` + `FooterStatusDTO`, `health.stats` im Detaildialog, Redis-Presence/Load/SLO, `DailyStatistic`, Cleanup) steht bewusst **nicht** in diagrams.md/architecture-overview, sondern in **[server-status-widget.md](../features/server-status-widget.md)** inkl. Sequenz-, Fehler- und Cleanup-Diagrammen.

**Empfehlung:** Bei Fragen zu 0.4 das Feature-Dokument als Quelle nutzen; zentrale Architektur-Diagramme nur bei größeren Routing-/Router-Änderungen mitziehen.

### 7.3 Team-Leaderboard-Komponente

`TeamLeaderboardEntryDTO` ist in shared-types definiert; es gibt **keine** eigene `TeamLeaderboardComponent` — `session.getTeamLeaderboard` wird in **SessionHost**, **SessionPresent** und **SessionVote** genutzt (siehe [team-mode.md](../features/team-mode.md) § Team-Leaderboard in der UI).

**Empfehlung:** In `diagrams.md` weiterhin optional als Vereinfachung; bei Detailfragen [team-mode.md](../features/team-mode.md) als Quelle nutzen.

---

## 8. Zusammenfassung

### 8.1 Repo-weiter Mermaid-Audit und Doku-Abgleich

Der repo-weite Mermaid-Render-Audit vom 2026-05-30 bleibt die letzte vollständige Render-Prüfung. Am 2026-05-31 wurden die zentralen Diagrammtexte, Standangaben und Redis-/Realtime-Begriffe mit Architektur-Handbuch, Glossar, Onboarding und Funktionsübersicht abgeglichen. Am 2026-06-17 erfolgte ein fachlicher Abgleich für Story 1.2d `NUMERIC_ESTIMATE`: Backlog-Status, Feature-Doku, Datenmodellfelder, Data-Stripping, Scoring, Zwei-Runden-Flow, Ergebnisaggregation und die Trennung von `HostCurrentQuestionDTO` und `HostVoteProgressDTO` wurden in den zentralen Diagrammen nachgeführt. Zusätzlich zu `docs/diagrams/*` wurden alle weiteren Markdown-Dateien mit Mermaid-Blöcken geprüft:

| Datei                                              | Ergebnis                                                                                                                           |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `docs/features/server-status-widget.md`            | Aktualisiert auf `health.footerBundle`, `health.stats`, `DailyStatistic`, Presence-/Load-/SLO-Signale und aktuellen Cleanup-Ablauf |
| `docs/features/team-mode.md`                       | Aktualisiert auf Session-Onboarding-Felder, effektive Peer-Instruction-Votes und normalisiertes Team-Leaderboard                   |
| `docs/features/bonus-codes.md`                     | Aktualisiert auf effektive Rundenwertung, letzte-Frage-Guard und Token-/Feedback-Retention vor Session-Purge                       |
| `docs/features/blitzlicht-quickfeedback-api.md`    | Fehlende `quickFeedback`-Procedures `isActive`, `hostResults`, `onHostResults` ergänzt                                             |
| `docs/features/preset-modes.md`                    | Foyer-Einflug an lokales UI-Preset `spielerisch` und Reward-Effekte gebunden; keine Host-Übersteuerung von Client-Presets          |
| `docs/features/numeric-estimate.md`                | Neu: didaktisches Konzept, Plausibilitäts-/Toleranzband, Zwei-Runden-Flow, Data-Stripping, Nähe-Scoring, Statistik und Import      |
| `docs/onboarding.md`                               | Backend-Diagramm um `wordCloudRouter`, `wordCloudAnalysis` und aktuellen Server-Status-Pfad ergänzt                                |
| `docs/didaktik/dritter-kurs-data-analytics-nlp.md` | Zielbild an bestehenden `wordCloudRouter` und deterministische `wordCloudAnalysis`-Baseline angepasst                              |
| `docs/praktikum/HANDOUT-TAGESREKORD-KI-AGENT.md`   | Tagesrekord-Sequenzen auf `footerBundle`/`stats`-Trennung und dynamisches Chart-Lazy-Loading aktualisiert                          |
| `docs/architecture/quiz-library-sync.md`           | Geprüft; keine fachliche Änderung nötig                                                                                            |

Technische Plausibilitätschecks: Mermaid-Fences balanciert; alle 20 Prisma-Modelle erscheinen in den zentralen ER-Diagrammen; alle `appRouter`-Keys (`health`, `quiz`, `session`, `vote`, `qa`, `quickFeedback`, `wordCloud`, `admin`, `motd`) sind in Diagramm-/Onboarding-Doku abgebildet. Der letzte vollständige Render-Audit vom 2026-05-30 hat alle 68 Mermaid-Blöcke aus 11 getrackten Markdown-Dateien mit `mmdc 11.15.0` erfolgreich geprüft; am 2026-06-17 erfolgte ein fachlicher Text- und Begriffsabgleich für `NUMERIC_ESTIMATE`, aber kein neuer repo-weiter Render-Audit.

| Aspekt                                     | Bewertung                                                                                                                                                    |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Diagramme intern**                       | ✓ Konsistent (Router, DTOs, Abläufe, DB-Schema stimmig)                                                                                                      |
| **diagrams.md ↔ architecture-overview.md** | ✅ architecture-overview als vereinfachte Übersicht gekennzeichnet; Details in diagrams.md                                                                   |
| **Diagramme ↔ Handbook**                   | ✓ Alle Kernkonzepte (Local-First, tRPC, Data-Stripping, Datenmodell) abgebildet                                                                              |
| **Diagramme ↔ Backlog**                    | ✓ Relevante Stories aus Epics 0–8 abgedeckt; 0.4 vertieft in server-status-widget.md, 1.2d vertieft in numeric-estimate.md; offene Mini-Lücke §7.3 (Team-UI) |
| **Zod-Schemas ↔ Prisma**                   | ✓ Alle Enums synchron, Input-Schemas spiegeln Modelle korrekt                                                                                                |
| **Diagramme ↔ Code**                       | ✓ Kernpfad (Router, DB, WS, Yjs, Frontend-Routen) abgedeckt                                                                                                  |

**Gesamtbewertung:** Die Diagramme sind intern konsistent und decken Handbook sowie Backlog umfassend ab. Die architecture-overview.md ist als vereinfachte Übersicht gekennzeichnet. Der PAUSED-Status ist in diagrams.md und im Datenfluss in architecture-overview.md berücksichtigt. **Server-Status (0.4):** Ablauf in [server-status-widget.md](../features/server-status-widget.md). **Numerische Schätzfrage (1.2d):** Fachdetails in [numeric-estimate.md](../features/numeric-estimate.md). Team-Ranking: siehe [team-mode.md](../features/team-mode.md) statt eigener Diagramm-Komponente.
