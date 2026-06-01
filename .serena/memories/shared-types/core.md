# Shared Types Core

- `libs/shared-types` is the authoritative contract package used by both backend and frontend.
- Main files:
  - `src/schemas.ts`: large Zod schema/enum/DTO surface for quizzes, sessions, votes, Q&A, quick feedback, admin, MOTD, health/status, word-cloud analysis, scoring/evaluation helpers, import/export, locale-aware payloads.
  - `src/index.ts`: public exports for normal package use.
  - `src/index.workspace.ts`: workspace/testing entry used by frontend Vitest alias.
- Package output: `dist/index.js` and `dist/index.d.ts`; backend-only typecheck can require the package to be built first.
- Change order for contracts: edit schemas/types here first, then backend procedures/Prisma mapping, then frontend callers/components, then tests.
- Avoid shadow DTOs in app code. If backend/frontend need the same payload shape, it belongs here as a Zod schema plus inferred type.
- Security-sensitive schema changes need DTO-stripping review: widening a schema can accidentally expose owner/solution fields to participant-facing procedures.
