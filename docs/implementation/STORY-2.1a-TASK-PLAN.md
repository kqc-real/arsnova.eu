# Story 2.1a – Detaillierter Task-Plan: Session-ID & Quiz-Upload

**Epic 2 · Live-Sitzung & Lobby**  
**Ziel:** Dozent kann ein Quiz live schalten → 6-stelliger Session-Code wird erzeugt, Quizdaten werden einmalig an den Server übertragen und in PostgreSQL gespeichert. Session-Status initial `LOBBY`.

---

## Ist-Stand (vor Umsetzung)

| Bereich | Status |
|--------|--------|
| **Prisma** | `Session`, `Quiz`, `Question`, `AnswerOption` existieren; Session hat `code` (unique), `quizId`, `status` (default LOBBY). |
| **shared-types** | `QuizUploadInputSchema`, `CreateSessionInputSchema`, `CreateSessionOutputSchema` vorhanden. **Fehlt:** `QuizUploadOutputSchema` (Rückgabe von `quiz.upload`). |
| **Backend session** | `session.create` existiert: nimmt `quizId` (optional), erzeugt 6-stelligen Code, Rate-Limit 10/h (Story 0.5). **Erstellt keine Quiz-Daten** – erwartet bereits existierendes `quizId`. |
| **Backend quiz** | **Kein** `quiz`-Router vorhanden; `quiz.upload` fehlt. |
| **Frontend** | Quiz-Liste nutzt `session.getActiveQuizIds`; kein „Live schalten“-Button. `QuizStoreService.exportQuiz(quizId)` liefert `QuizExport` (inkl. `quiz`-Objekt), das strukturell zu `QuizUploadInput` passt. |

---

## Abhängigkeiten

- **Epic 0:** Redis, Rate-Limiting (session create 10/h) – erledigt.
- **Epic 1:** Quiz-Daten lokal (Yjs/IndexedDB), Export-Format – erledigt.
- Keine Abhängigkeit von Story 2.2–2.7 für die reine 2.1a-Implementierung.

---

## Task-Liste (Reihenfolge)

### Phase 1: Shared Types

| # | Task | Beschreibung | Datei |
|---|------|--------------|--------|
| 1.1 | **QuizUploadOutputSchema** | Output-Schema für `quiz.upload`: `{ quizId: z.string().uuid() }` definieren und exportieren. | `libs/shared-types/src/schemas.ts` |

---

### Phase 2: Backend – Quiz-Upload

| # | Task | Beschreibung | Datei |
|---|------|--------------|--------|
| 2.1 | **Quiz-Router anlegen** | Neue Datei `apps/backend/src/routers/quiz.ts`, `router({ ... })` mit `upload`-Procedure. | `apps/backend/src/routers/quiz.ts` |
| 2.2 | **Procedure `upload`** | `.input(QuizUploadInputSchema)`, `.output(QuizUploadOutputSchema)`. In einer Transaktion: `prisma.quiz.create` inkl. `questions` (createMany oder nested create) und je Frage `answers` (AnswerOption). Reihenfolge: Quiz → Questions (mit `order`) → AnswerOptions. Keine IDs aus dem Input übernehmen (Server generiert UUIDs). | `apps/backend/src/routers/quiz.ts` |
| 2.3 | **Prisma-Transaktion** | Nutzung von `prisma.$transaction([...])` oder nested `create({ data: { questions: { create: [...] } } })`, sodass Quiz + alle Questions + alle AnswerOptions atomar gespeichert werden. Mapping: `QuizUploadInput` → Prisma `Quiz` (name, description, showLeaderboard, …), `Question` (text, type, timer aus question, difficulty, order, ratingMin/Max/LabelMin/Max), `AnswerOption` (text, isCorrect). | `apps/backend/src/routers/quiz.ts` |
| 2.4 | **Router registrieren** | `quizRouter` in `appRouter` eintragen: `quiz: quizRouter`. | `apps/backend/src/routers/index.ts` |
| 2.5 | **Unit-Test upload** | Mind. ein Test: Happy Path – gültiges `QuizUploadInput` → Aufruf `quiz.upload` → DB enthält Quiz mit mind. einer Frage und Antwortoptionen; Rückgabe enthält `quizId`. Ein Fehlerfall: leeres `questions`-Array oder ungültiges Schema → Fehler. | `apps/backend/src/routers/quiz.spec.ts` (oder in quiz.ts integriert) |

---

### Phase 3: Backend – Session.create (optional prüfen)

| # | Task | Beschreibung | Datei |
|---|------|--------------|--------|
| 3.1 | **session.create mit quizId** | Bereits implementiert: `session.create` nimmt `input.quizId`. Bei `type: 'QUIZ'` muss das Frontend nach `quiz.upload` die erhaltene `quizId` übergeben. Keine Backend-Änderung nötig, sofern Verhalten bereits korrekt ist. | `apps/backend/src/routers/session.ts` |
| 3.2 | **Validierung (optional)** | Wenn `type === 'QUIZ'` und `quizId` fehlt → `BAD_REQUEST`. Wenn `quizId` gesetzt, aber Quiz nicht existiert → `NOT_FOUND`. (Falls noch nicht vorhanden, ergänzen.) | `apps/backend/src/routers/session.ts` |

---

### Phase 4: Frontend – Upload-Payload & Live-Schalten

| # | Task | Beschreibung | Datei |
|---|------|--------------|--------|
| 4.1 | **getUploadPayload(quizId)** | In `QuizStoreService`: Methode `getUploadPayload(quizId: string): QuizUploadInput`. Aus `getQuizById(quizId)` das Dokument lesen und in das Format von `QuizUploadInputSchema` bringen (name, description, settings, questions mit text, type, difficulty, order, answers mit text/isCorrect; ratingMin/Max/LabelMin/Max pro Frage; **keine** IDs in questions/answers). Anschließend `QuizUploadInputSchema.safeParse(payload)` – bei Fehler klar werfen (oder Result zurückgeben). | `apps/frontend/src/app/features/quiz/data/quiz-store.service.ts` |
| 4.2 | **Mapping QuizDocument → QuizUploadInput** | Sicherstellen, dass alle Pflichtfelder gesetzt sind (z. B. `teamAssignment`, `readingPhaseEnabled` mit Defaults). `questions[].answers` maximal 10; `timer` pro Frage optional (falls im Document vorhanden, mitgeben). | `apps/frontend/src/app/features/quiz/data/quiz-store.service.ts` |
| 4.3 | **„Live schalten“ in Quiz-Liste** | In der Quiz-Liste pro Quiz einen Button „Live schalten“ (oder „Session starten“). Nur anzeigen, wenn Quiz mind. eine Frage hat (sonst disabled mit Tooltip). Bei Klick: 1) `getUploadPayload(quizId)`; 2) `trpc.quiz.upload.mutate(payload)`; 3) `trpc.session.create.mutate({ quizId: result.quizId, type: 'QUIZ' })`; 4) bei Erfolg: `router.navigate(['/session', result.code])` (Redirect zu `/session/:code/host`). Loading-State und Fehlerbehandlung (z. B. Snackbar: „Zu viele Sessions“ bei TOO_MANY_REQUESTS, „Ungültige Quiz-Daten“ bei Zod/Validation). | `apps/frontend/src/app/features/quiz/quiz-list/quiz-list.component.ts`, `quiz-list.component.html` |
| 4.4 | **Optional: „Live schalten“ im Quiz-Editor** | Zusätzlich in der Quiz-Detail/Editor-Ansicht einen Button „Live schalten“ (z. B. in der Toolbar), gleicher Ablauf wie 4.3. | `apps/frontend/src/app/features/quiz/quiz-edit/quiz-edit.component.ts` (optional) |

---

### Phase 5: Integration & DoD

| # | Task | Beschreibung |
|---|------|--------------|
| 5.1 | **E2E-Ablauf** | Manuell: Quiz auswählen → „Live schalten“ → Weiterleitung zu `/session/:code` (Host-Ansicht); Session-Code 6 Zeichen; in DB: Session mit `status LOBBY`, zugehöriges Quiz mit Fragen und Antwortoptionen (inkl. `isCorrect`). |
| 5.2 | **Rate-Limit** | Prüfen: 11. Session innerhalb 1 h → Fehlermeldung (TOO_MANY_REQUESTS). |
| 5.3 | **DoD-Check** | Code kompiliert (tsc Backend, Frontend, shared-types); alle tRPC-Ein-/Ausgaben über Zod; DTO-Pattern (Session-Ausgabe bereits über CreateSessionOutputSchema). |

---

## Kurz: Datenfluss

1. **Frontend:** User klickt „Live schalten“ für ein Quiz (aus Liste oder Editor).
2. **Frontend:** `getUploadPayload(quizId)` baut aus dem lokalen Quiz (Yjs/IndexedDB) ein `QuizUploadInput` und validiert es mit Zod.
3. **Frontend:** `trpc.quiz.upload.mutate(QuizUploadInput)` → Backend erstellt Quiz + Questions + AnswerOptions in PostgreSQL, gibt `{ quizId }` zurück.
4. **Frontend:** `trpc.session.create.mutate({ quizId, type: 'QUIZ' })` → Backend erzeugt 6-stelligen Code, erstellt Session mit `status: LOBBY`, gibt `{ sessionId, code, status, quizName }` zurück.
5. **Frontend:** Navigate zu `/session/:code` (→ Redirect auf Host-Ansicht `/session/:code/host`).

---

## Dateien-Übersicht

| Aktion | Datei |
|--------|--------|
| Neu | `apps/backend/src/routers/quiz.ts` |
| Neu | `apps/backend/src/routers/quiz.spec.ts` (oder in bestehende Teststruktur) |
| Ändern | `libs/shared-types/src/schemas.ts` (QuizUploadOutputSchema) |
| Ändern | `apps/backend/src/routers/index.ts` (quizRouter einbinden) |
| Ändern | `apps/frontend/.../quiz-list/quiz-list.component.ts` (Live-Schalten-Logik) |
| Ändern | `apps/frontend/.../quiz-list/quiz-list.component.html` (Button) |
| Ändern | `apps/frontend/.../quiz/data/quiz-store.service.ts` (getUploadPayload) |
| Optional | `apps/frontend/.../quiz-edit/quiz-edit.component.*` (Button „Live schalten“) |

---

## Hinweise

- **Host-Token:** Story 2.1a verlangt im Backlog kein Host-Token; das kann in einer späteren Story (z. B. Absicherung Host-Route) ergänzt werden.
- **isCorrect:** Bleibt serverseitig gespeichert; wird erst in Story 2.4 (Data-Stripping) relevant, wenn Fragen an Teilnehmer ausgeliefert werden.
- **Session-Code:** Bereits 6 Zeichen, kollisionsfrei (ensureUniqueSessionCode); Zeichensatz wie in `session.ts` (z. B. Großbuchstaben + Ziffern ohne Verwechslungszeichen).
