# Security DTO Stripping

- Backend must return DTOs, not raw Prisma models, to clients.
- Participant-facing payloads stay minimal by session phase and purpose.
- `AnswerOption.isCorrect` and equivalent solution/grading fields must never reach participants while a question is active.
- Phase DTO rule:
  - `QUESTION_OPEN`: preview-only question stem; no answer options.
  - `ACTIVE`: student question with answer options but no correctness fields.
  - `RESULTS`: revealed question may include correctness after the host reveals results.
- Full participant lists, owner history, exports, moderation/admin views, and analytics require host/admin/ownership checks.
- Any shared schema or backend mapping that widens public DTOs needs explicit review for solution leaks and enumerability.
- Regression tests should cover `ACTIVE` without correctness and `RESULTS` with revealed correctness where applicable.

## Verwandte Memories:

- `mem:core`
- `mem:security/auth`
- `mem:session/lifecycle`
- `mem:modules/shared-types`
- `mem:backend/api-router`
- `mem:testing/core`
- `mem:quality/dod`
