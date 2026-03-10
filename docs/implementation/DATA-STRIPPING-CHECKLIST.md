# Data-Stripping-Checkliste (Story 2.4)

**Regel:** `isCorrect` (richtige Lösung) darf **während der Frage-Phase (Status ACTIVE)** niemals an Studenten-Clients gesendet werden. Erst nach expliziter Auflösung durch den Dozenten (Status RESULTS) werden Lösungen übertragen.

---

## DTOs (libs/shared-types)

| DTO | Verwendung | isCorrect? |
|-----|------------|------------|
| `QuestionPreviewDTO` | Lesephase (QUESTION_OPEN) | – (keine Antwortoptionen) |
| `QuestionStudentDTO` / `AnswerOptionStudentDTO` | Frage-Phase (ACTIVE) | **Nein** |
| `QuestionRevealedDTO` / `AnswerOptionRevealedDTO` | Ergebnis-Phase (RESULTS) | **Ja** |

- `AnswerOptionStudentDTOSchema` ist `.strict()` – Payloads mit `isCorrect` schlagen die Validierung fehl.
- Beim Bauen von Payloads für Studenten im Backend **nur** `AnswerOptionStudentDTO` (id, text) verwenden.

---

## Code-Review-Checkliste

- [ ] Alle Auslieferungen von Fragen an Teilnehmer (Subscriptions/Queries) nutzen im Status **ACTIVE** ausschließlich `QuestionStudentDTO` / `AnswerOptionStudentDTO` (ohne `isCorrect`).
- [ ] Im Status **RESULTS** werden `QuestionRevealedDTO` / `AnswerOptionRevealedDTO` (mit `isCorrect`) verwendet.
- [ ] Kein direktes Durchreichen von Prisma-Modellen (`AnswerOption`, `Question`) an den Client – immer über DTOs mappen.
- [ ] Unit-Tests: `dto-security.test.ts` – „rejects ACTIVE payload if answer option contains isCorrect“, „requires isCorrect in RESULTS payloads“.

---

## Tests

- `apps/backend/src/__tests__/dto-security.test.ts`: Verifiziert Schema-Verhalten (QuestionStudentDTO ohne isCorrect, AnswerOptionRevealedDTO mit isCorrect).
