# Naming Conventions

- tRPC procedures: camelCase; queries read (`getInfo`, `getLeaderboard`), mutations write (`create`, `join`, `submit`), subscriptions use `on...` where event-like.
- Zod schemas: `*Schema` suffix, e.g. `CreateSessionInputSchema`, `QuestionStudentDTOSchema`.
- DTO/types: exported from shared-types; prefer `z.infer` or explicit exported DTO type where API compatibility requires it.
- Prisma: singular model names (`Quiz`, `Question`, `Session`, `Participant`, `Vote`), PascalCase enums, camelCase fields.
- Angular: `*Component` and `*Service` suffixes; file names in kebab-case; colocate specs as `<name>.spec.ts`.
- Signals/computed values should have descriptive domain names; avoid generic `state`, `subject`, or RxJS-store naming for ordinary UI state.
- Backend routers live under `apps/backend/src/routers/`; helper/domain code under `apps/backend/src/lib/` unless a more specific existing pattern exists.
- Frontend code lives under `apps/frontend/src/app/{core,shared,features}`; avoid type-bucket folders that bypass feature/domain ownership.

## Verwandte Memories:

- `mem:core`
- `mem:modules/shared-types`
- `mem:backend/api-router`
- `mem:frontend/routing-components`
- `mem:quality/dod`
- `mem:testing/core`
