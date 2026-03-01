# Projekt-Kontext: arsnova.click V3 (Stable Reference for AI)

Dieses Dokument ist die **kanonische Referenz** für Struktur, Stack, Konventionen und Backlog. Es wird für Context Caching (Claude Opus 4.6) als stabiler Prefix genutzt. Nur bei größeren Architektur- oder Backlog-Änderungen anpassen.

---

## 1. Identität und Rolle

- **Projekt:** arsnova.click V3 – interaktive Quiz- und Abstimmungsplattform (Live-Sessions, Dozent/Student-Rollen).
- **KI-Rolle:** Lead-Architekt / Senior Full-Stack; Entscheidungen an Monorepo-Regeln und Backlog ausrichten.
- **Artefakte:** Backlog.md (Storys, DoD), Prisma-Schema, Zod-Schemas in libs/shared-types, Diagramme in docs/diagrams/.

---

## 2. Repository-Struktur (Pfade)

- **Backend:** `apps/backend/` – Node.js, Express, tRPC v11, Prisma 7, Redis.
- **Frontend:** `apps/frontend/` – Angular 17+ (aktuell 19), Standalone Components, Signals, Angular Material 3.
- **Shared Types:** `libs/shared-types/` – Zod-Schemas, TypeScript-Typen, DTO-Definitionen. Import: `@arsnova/shared-types`.
- **Prisma:** `prisma/schema.prisma` – Datenmodell; Migrationen und Client-Generierung wie üblich.
- **Dokumentation:** `docs/` – architecture, diagrams, onboarding, vibe-coding; `Backlog.md` im Repo-Root.

---

## 3. Technologie-Stack (strikt)

- **Kommunikation:** Ausschließlich tRPC (Queries, Mutations, Subscriptions). Kein REST.
- **Datenbank:** PostgreSQL über Prisma ORM.
- **Echtzeit:** Redis Pub/Sub; tRPC-WebSocket für Subscriptions.
- **Quiz-Inhalte (Local-First):** Yjs (CRDTs), IndexedDB, y-websocket für Multi-Device-Sync.
- **Frontend-State:** Nur Angular Signals (`signal`, `computed`, `effect`). Kein RxJS für UI-State (kein BehaviorSubject); RxJS nur für asynchrone Streams (z. B. tRPC-Subscriptions, Debouncing).
- **UI:** Standalone Components, Control Flow `@if`/`@for`, Angular Material 3, tokenbasiertes Theming und SCSS-Patterns. Keine NgModules, kein Tailwind.

---

## 4. Monorepo-Regeln

1. **Shared Types zuerst:** Jede tRPC-Eingabe und -Ausgabe muss ein Zod-Schema aus `@arsnova/shared-types` verwenden. Schema dort anlegen/ändern, bevor Code in apps/backend oder apps/frontend geschrieben wird.
2. **Imports:** Gemeinsame Typen und Schemas immer aus `@arsnova/shared-types` importieren; tsconfig-Pfade für das Monorepo beachten.
3. **Backend/Frontend gemeinsam:** Bei neuen tRPC-Procedures immer Backend (Router, Service, DTO) und Frontend (Client-Aufruf, Typen) zusammen anpassen, damit die Typsicherheit erhalten bleibt.

---

## 5. Sicherheit und Data-Stripping (kritisch)

- **DTO-Pattern:** Daten werden serverseitig durch DTOs gefiltert, bevor sie an Clients gehen. Kein direktes Durchreichen von Prisma-Modellen.
- **isCorrect:** Das Feld `AnswerOption.isCorrect` (richtige Lösung) darf **niemals** im Session-Status `ACTIVE` an Studenten gesendet werden. Erst nach Wechsel zu `RESULTS` und Auflösung durch den Dozenten werden Lösungen sichtbar (QuestionRevealedDTO, AnswerOptionRevealedDTO).
- **DTOs nach Phase:**  
  - `QUESTION_OPEN` (Lesephase, Story 2.6): QuestionPreviewDTO – nur Fragenstamm, keine Antwortoptionen.  
  - `ACTIVE`: QuestionStudentDTO – Frage inkl. Antwortoptionen, **ohne** isCorrect.  
  - `RESULTS`: QuestionRevealedDTO – inkl. isCorrect.  
- **Typsicherheit:** Im Frontend Typen aus shared-types oder aus dem tRPC-Client nutzen; kein `any`.

---

## 6. Session-Lifecycle und Status

- **SessionStatus (Prisma enum):** LOBBY → QUESTION_OPEN (optional, Lesephase) → ACTIVE → RESULTS → PAUSED → (wieder QUESTION_OPEN/ACTIVE oder FINISHED).
- **Lesephase (Story 2.6):** Bei `readingPhaseEnabled=true` zeigt „Nächste Frage“ zuerst nur den Fragenstamm (QUESTION_OPEN, QuestionPreviewDTO); Dozent klickt „Antworten freigeben“ → ACTIVE, dann QuestionStudentDTO / onAnswersRevealed. Bei `readingPhaseEnabled=false` wechselt „Nächste Frage“ direkt zu ACTIVE.
- **Wichtige tRPC-Events:** onQuestionRevealed, onAnswersRevealed (bei Lesephase), onResultsRevealed, onStatusChanged, onParticipantJoined, onPersonalResult (Scorecard, Bonus-Token).

---

## 7. Datenmodell (Prisma – Kurzreferenz)

- **Quiz:** id, name, description, showLeaderboard, allowCustomNicknames, defaultTimer, readingPhaseEnabled, bonusTokenCount, nicknameTheme, teamMode, enableSoundEffects, enableRewardEffects, enableMotivationMessages, enableEmojiReactions, anonymousMode, backgroundMusic; Relationen: questions, sessions.
- **Question:** id, text, type (QuestionType), timer, difficulty, ratingMin/Max/LabelMin/Max, quizId, order; Relationen: answers (AnswerOption), votes.
- **AnswerOption:** id, text, isCorrect, questionId; Relation: voteAnswers (VoteAnswer).
- **Session:** id, code (UK), type (SessionType), status (SessionStatus), title, moderationMode, currentQuestion, quizId; Relationen: participants, teams, votes, bonusTokens, qaQuestions.
- **Participant:** id, nickname, sessionId, teamId; Relationen: votes, bonusTokens, qaQuestions, qaUpvotes.
- **Vote:** sessionId, participantId, questionId, selectedAnswers (VoteAnswer), freeText, ratingValue, responseTimeMs, score, streakCount, streakBonus.
- **VoteAnswer:** voteId, answerOptionId.
- **BonusToken:** token (UK), sessionId, participantId, nickname, quizName, totalScore, rank.
- **Team:** name, color, sessionId; Relation: participants.
- **QaQuestion:** text, upvoteCount, status (QaQuestionStatus), sessionId, participantId; Relation: upvotes (QaUpvote).
- **QaUpvote:** qaQuestionId, participantId.
- **Enums:** QuestionType (MULTIPLE_CHOICE, SINGLE_CHOICE, FREETEXT, SURVEY, RATING), Difficulty (EASY, MEDIUM, HARD), SessionStatus (LOBBY, QUESTION_OPEN, ACTIVE, PAUSED, RESULTS, FINISHED), NicknameTheme, TeamAssignment, SessionType (QUIZ, Q_AND_A), QaQuestionStatus (PENDING, ACTIVE, PINNED, ARCHIVED, DELETED).

---

## 8. tRPC-Router und zentrale Procedures

- **appRouter** (apps/backend/src/routers/index.ts): health, quiz, session, vote, qa (weitere Router je nach Implementierungsstand).
- **health:** check, ggf. stats (Story 0.4).
- **quiz:** upload (QuizUploadInputSchema), getById, list, etc.
- **session:** create (CreateSessionInputSchema), getInfo (per code), join (JoinSessionInputSchema), nextQuestion, revealAnswers (Story 2.6), revealResults, end; Subscriptions: onParticipantJoined, onStatusChanged, onQuestionRevealed, onAnswersRevealed, onResultsRevealed, onPersonalResult; getBonusTokens, getLeaderboard; getExportData (Story 4.7: GetExportDataInputSchema → SessionExportDTO).
- **vote:** submit (SubmitVoteInputSchema).
- **qa:** submitQuestion, upvote, moderate (Dozent), etc.
- Alle Ein-/Ausgaben über Zod-Schemas aus libs/shared-types (CreateSessionInputSchema, QuizUploadInputSchema, SubmitVoteInputSchema, JoinSessionInputSchema, SessionInfoDTOSchema, QuestionPreviewDTO, QuestionStudentDTO, QuestionRevealedDTO, PersonalScorecardDTO, LeaderboardEntryDTO, BonusTokenListDTO, SessionExportDTO, GetExportDataInputSchema, etc.).

---

## 9. Frontend-Routen und Komponenten (Überblick)

- **Routen:** / (Home), /quiz (Quiz-Verwaltung), /session/:code (Dozent-Steuerung), /session/:code/present (Beamer), /session/:code/vote (Student), /legal (Impressum, Datenschutz).
- **Home:** HomePageComponent (inkl. Segment-Code-Input, Snackbar, Onboarding-Banner, Hero-Icons, Status-Dot im Brand-SVG), PresetToastComponent.
- **Quiz:** QuizListComponent, QuizEditorComponent, QuizConfigComponent, QuestionEditorComponent, AnswerEditorComponent, QuizPreviewComponent, ImportExportComponent.
- **Session (Dozent):** LobbyComponent, QuizControlComponent, BeamerViewComponent, QaModeratorComponent, BonusTokenListComponent; Beamer: ResultChartComponent, WordcloudComponent, RatingHistogramComponent, LeaderboardComponent, EmojiOverlayComponent, QrCodeComponent, CountdownComponent.
- **Student:** NicknameSelectComponent, VotingViewComponent, AnswerButtonsComponent, McToggleButtonsComponent, RatingScaleComponent, FreetextInputComponent, ScorecardComponent, BonusTokenDisplay, MotivationMessageComponent, EmojiBarComponent, QaStudentComponent, CountdownComponent.
- **Shared:** HeaderComponent, FooterComponent, ThemeSwitcherComponent, LanguageSwitcherComponent, CountdownComponent, MarkdownKatexComponent, ConfirmDialogComponent.
- **Services:** trpcClient (httpBatchLink, wsLink), YjsService, ThemeService, I18nService.

---

## 10. Backlog – Epics und Story-Übersicht

- **Epic 0 – Infrastruktur:** Redis (0.1), tRPC WebSocket (0.2), Yjs Provider (0.3), Server-Status (0.4), Rate-Limiting (0.5), CI/CD (0.6).
- **Epic 1 – Quiz-Erstellung:** Quiz anlegen (1.1), Fragentypen MC/SC (1.2a), Freitext/Umfrage (1.2b), Rating (1.2c), Antworten & Lösungen (1.3), Sitzungs-Konfiguration (1.4), Local-First (1.5), Yjs Sync (1.6), Sync-Link (1.6a), Preset/Optionen-Sync (1.6b), Markdown/KaTeX (1.7), Export/Import (1.8/1.9), Bearbeiten/Löschen (1.10), Presets (1.11), SC-Schnellformate (1.12), Preview (1.13), Word Cloud interaktiv + Export (1.14).
- **Epic 2 – Session-Steuerung:** Quiz-Upload & Session-ID (2.1a), QR-Code (2.1b), Lobby (2.2), Präsentations-Steuerung (2.3), Data-Stripping (2.4), Beamer (2.5), Zwei-Phasen-Frageanzeige/Lesephase (2.6).
- **Epic 3 – Teilnahme & Abstimmung:** Beitreten (3.1), Nicknames (3.2), Frage empfangen (3.3a), Abstimmung (3.3b), Echtzeit-Feedback (3.4), Countdown (3.5), Anonymer Modus (3.6).
- **Epic 4 – Auswertung & Cleanup:** Leaderboard (4.1), Server aufräumen (4.2), WebSocket Reconnection (4.3), Ergebnis-Visualisierung (4.4), Freitext-Auswertung (4.5), Bonus-Token (4.6), Ergebnis-Export für Dozenten (4.7).
- **Epic 5 – Gamification & UX:** Sound (5.1), Hintergrundmusik (5.3), Belohnungseffekte (5.4), Answer Streak (5.5), Scorecard (5.6), Motivationsmeldungen (5.7), Emoji-Reaktionen (5.8).
- **Epic 6 – Theming, i18n, Rechtliches, A11y:** Dark/Light/System (6.1), i18n (6.2), Impressum & Datenschutz (6.3), Mobile-First (6.4), Barrierefreiheit (6.5).
- **Epic 7 – Team-Modus (Could):** Team-Modus (7.1).
- **Epic 8 – Q&A (Could):** Q&A starten (8.1), Fragen einreichen (8.2), Upvoting (8.3), Moderation (8.4).

Priorisierung: 🔴 Must, 🟡 Should, 🟢 Could. Abhängigkeiten: Epic 0 → 1 → 2 → 3 → 4 → 5; Epic 6 parallel ab 0.

---

## 11. Definition of Done (Kernpunkte)

- Code kompiliert (tsc --noEmit Backend, Frontend, shared-types); kein `any`; alle tRPC-Ein-/Ausgaben über Zod aus shared-types; DTO-Pattern eingehalten; isCorrect nie in ACTIVE an Studenten.
- Tests: mind. ein Unit-Test pro tRPC-Mutation/Query; automatisierter Test für QuestionStudentDTO ohne isCorrect in ACTIVE und für QuestionRevealedDTO mit isCorrect in RESULTS.
- Frontend: nur Standalone + Signals, @if/@for, Mobile-First, Touch-Targets >=44px, Tastatur, Dark/Light, reduced-motion, Lighthouse A11y >=90. Micro-Interactions immer in `@media (prefers-reduced-motion: no-preference)`. UX-Patterns (Segment-Input, Snackbar, Conditional Chips) siehe `docs/ui/STYLEGUIDE.md`.
- Barrierefreiheit: semantisches HTML, aria-label/aria-live, Farbunabhängigkeit (Icons/Text für Richtig/Falsch).
- Datenschutz: keine unnötigen personenbezogenen Daten; Session-Daten nach Ende/24h bereinigt; Anonymer Modus wie spezifiziert.
- Dokumentation: JSDoc für neue tRPC-Endpunkte; bei Architektur-Änderungen ADR in docs/architecture/decisions/; Prisma, Zod und Backlog synchron.
- Deployment: docker compose up startet System; keine npm audit high/critical.

---

## 12. Arbeitsweise (Baby-Steps, AGENT.md)

- Nicht die gesamte App auf einmal schreiben. Bei Feature-Anfragen nach Reihenfolge fragen: zuerst Backend (tRPC + DTO in shared-types) oder Frontend (Angular UI).
- Code sofort kompilierbar und gut kommentiert liefern. Vor „Story fertig“ einen tRPC-Integrationstest generieren, der DTO-Stripping (z. B. kein isCorrect in ACTIVE) verifiziert.
- Override: Nur bei expliziter User-Anweisung mit Suffix `--override` von diesen Regeln abweichen.

---

## 13. Wichtige Dateien für Kontext

- **Backlog:** Backlog.md (Repo-Root) – vor Story-Start prüfen.
- **Mitwirken / Handover:** CONTRIBUTING.md – Einstieg für Studis (Setup, Story-Wahl, DoD vor PR, Branch/PR); bei Fragen zu Workflow oder „wie starte ich?“ darauf verweisen.
- **Schema:** prisma/schema.prisma; libs/shared-types/src/schemas.ts (Zod, DTOs).
- **Router:** apps/backend/src/routers/index.ts, apps/backend/src/routers/*.ts.
- **Diagramme:** docs/diagrams/diagrams.md (detailliert), docs/diagrams/architecture-overview.md (Übersicht).
- **Regeln:** .cursorrules (Pfade, Monorepo, Stack, UX-Design-Regeln); AGENT.md (Arbeitsweise, Baby-Steps, Tests, Design-Leitplanken).

Dieses Dokument bewusst kompakt und stabil halten. Bei größeren Änderungen (neue Epics, neuer Session-Status, neuer Router) einmalig diesen Kontext aktualisieren, damit Context Caching weiterhin den gleichen stabilen Prefix nutzen kann.

---

## 14. Konventionen und Namensgebung

- **tRPC-Procedures:** camelCase; Queries lesen (getInfo, getLeaderboard), Mutations schreiben (create, join, submit), Subscriptions mit on-Prefix (onQuestionRevealed, onResultsRevealed).
- **Zod-Schemas:** Suffix Schema (CreateSessionInputSchema, QuestionStudentDTOSchema); exportierte Typen mit z.infer oder explizit (SessionInfoDTO, QuestionPreviewDTO).
- **Prisma:** Modelle Singular (Quiz, Question, Session, Participant, Vote); Enums PascalCase; Felder camelCase.
- **Angular:** Komponenten Suffix Component; Services Suffix Service; Dateien kebab-case (quiz-control.component.ts); Signale und computed mit aussagekräftigen Namen, keine generischen state/subject-Namen.
- **Dateien:** Backend-Router unter apps/backend/src/routers/, Services unter apps/backend/src/services/; Frontend-Komponenten unter apps/frontend/src/app/ mit Feature-Struktur (home, quiz, session, vote, legal, shared).

---

## 15. Fehlerbehandlung und Validierung

- tRPC: Eingaben immer über Zod parse; bei Validierungsfehlern typische tRPC-Zod-Fehler zurückgeben. Keine rohen Prisma- oder DB-Fehler an den Client durchreichen.
- Session-Code: 6-stellig, case-insensitive Abgleich; getInfo und join mit klaren Fehlermeldungen (Session nicht gefunden, bereits beigetreten, Nickname vergeben).
- Rate-Limiting (Story 0.5): vote.submit und ggf. session.join begrenzen; Redis-basiert; Fehlerantwort mit Retry-After oder Hinweis auf Limit.

---

## 16. Tests und Qualitätssicherung

- Backend: Vitest oder Jest; pro Router/Procedure mindestens Happy Path und ein Fehlerfall; Prisma mit Test-DB oder Mock.
- DTO-Stripping: Expliziter Test, der session.nextQuestion bzw. onQuestionRevealed im Status ACTIVE aufruft und prüft, dass die Antwortoptionen kein isCorrect enthalten; nach revealResults muss isCorrect in den Revealed-DTOs vorhanden sein.
- Frontend: Komponenten-Tests mit TestBed; Signale und Async-Operationen berücksichtigen; keine unnötigen RxJS-Subscriptions für reinen UI-State.
- E2E (optional): Playwright oder Cypress für kritische Flows (Beitritt, Abstimmung, Ergebnis-Anzeige); Session-Code und Nickname testweise fest.

---

## 17. Referenz: Key Exports aus libs/shared-types

- Enums/Schemas: SessionStatusEnum, QuestionTypeEnum, DifficultyEnum, NicknameThemeEnum, TeamAssignmentEnum, SessionTypeEnum, QaQuestionStatusEnum.
- Input-Schemas: CreateSessionInputSchema, JoinSessionInputSchema, CreateQuizInputSchema, QuizUploadInputSchema, SubmitVoteInputSchema, AddQuestionInputSchema, AnswerOptionInputSchema, GetExportDataInputSchema (Story 4.7).
- DTO-Schemas: SessionInfoDTOSchema, QuestionPreviewDTOSchema, QuestionStudentDTOSchema, QuestionRevealedDTOSchema (AnswerOptionRevealedDTO), LeaderboardEntryDTOSchema, PersonalScorecardDTOSchema, BonusTokenListDTO, SessionExportDTOSchema (Story 4.7); ParticipantDTO, QuizExportSchema.
- Presets: QUIZ_PRESETS (PLAYFUL, SERIOUS) mit readingPhaseEnabled, defaultTimer, anonymousMode etc.
- Typen: Alle via z.infer von den genannten Schemas exportieren; keine Duplikate als interface, außer wo für API-Kompatibilität nötig.

---

## 18. Deployment und Umgebung

- **Docker Compose:** PostgreSQL, Redis, Backend (Port 3000), Frontend (Port 4200 oder gebaut und ausgeliefert); Umgebungsvariablen für DB_URL, REDIS_URL; Backend und Frontend im selben Netzwerk.
- **Skripte:** npm run build im Monorepo-Root baut alle Apps; apps/backend und apps/frontend haben eigene build-Skripte; Prisma generate und migrate vor Backend-Start.
- **Umgebungen:** Entwicklung (localhost), optional Staging/Produktion; keine Secrets im Repo; .env-Beispiele in .env.example dokumentieren.

### 18.1 Lokaler Production-ähnlicher Aufbau und Start

Für einen **lokal production-ähnlichen** Lauf (optimierter Frontend-Build, ein Prozess liefert alles aus, Gzip, Pre-Render):

1. **Build:** Im Repo-Root `npm run build:prod` ausführen. Baut Backend (`apps/backend/dist`) und Frontend für Production (`apps/frontend/dist/browser`, inkl. Pre-Render für `/`, `/help`, `/quiz`).
2. **Start:** `npm run start:prod` ausführen. Das Skript `scripts/start-backend-prod.mjs` lädt optional `.env` aus dem Root, gibt Port 3000 frei (falls belegt), baut das Backend bei Bedarf nach und startet es mit `NODE_ENV=production`. Das Backend bedient HTTP/tRPC und liefert die statischen Dateien aus `apps/frontend/dist/browser` aus (Fallback: `index.csr.html`, wenn kein `index.html`).
3. **Aufruf:** Im Browser **http://localhost:3000** öffnen. Ohne laufendes PostgreSQL/Redis funktioniert die Auslieferung und die Startseite; Health-Stats und Session-Funktionen liefern Fallbacks bzw. benötigen DB/Redis.
4. **Optional – Port bereits belegt:** Zuerst `npm run free-port-3000`, danach `npm run start:prod`. Oder Backend auf anderem Port starten: `PORT=3010 npm run start:prod`, dann **http://localhost:3010**.
5. **Optional – volle Funktionalität:** Docker Desktop starten und `npm run docker:up` ausführen (PostgreSQL + Redis), danach erneut `npm run start:prod`.

- **Cursor/Context Caching:** Dieses Dokument (docs/cursor-context.md) dient als stabiler Kontextblock. Bei Nutzung von Claude Opus 4.6 mit Prompt Caching sollte es als Prefix eingebunden werden (z. B. über .cursor/rules mit alwaysApply). Mindestlänge für Cache bei Opus 4.6: 4096 Tokens; diese Datei ist dafür ausgelegt.
