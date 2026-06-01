# Shared Types Module

- Path: `libs/shared-types/`; package: `@arsnova/shared-types`.
- This package is the API contract surface between backend and frontend.
- Main files:
  - `src/schemas.ts`: Zod schemas/enums/DTOs for sessions, quizzes, votes, Q&A, quick feedback, MOTD/admin, health/status, word cloud, imports/exports, scoring/evaluation.
  - `src/index.ts`: normal package exports.
  - `src/index.workspace.ts`: workspace/testing export path used by frontend Vitest alias.
- Package output: `dist/index.js`, `dist/index.d.ts`; backend-only typecheck can require `npm run build -w @arsnova/shared-types` first.
- Contract-change order: shared schema/type first, backend procedure/mapping second, frontend caller/component third, tests throughout.
- Avoid parallel app-local DTOs; shared payload shapes belong here as Zod schemas plus inferred/exported TS types.
- Security-sensitive schema widening requires participant DTO stripping review.

## Verwandte Memories:

- `mem:core`
- `mem:modules/backend`
- `mem:modules/frontend`
- `mem:security/dto-stripping`
- `mem:backend/api-router`
- `mem:quality/dod`
