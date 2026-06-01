# Backend Module

- Path: `apps/backend/`; package: `@arsnova/backend`.
- Stack: Node + TypeScript, Express, tRPC v11, Prisma 7, PostgreSQL, Redis/ioredis, WebSockets, Zod, PDFKit.
- Entry points:
  - `src/index.ts`: Express/server bootstrap.
  - `src/trpc.ts`: tRPC initialization, public/telemetry/host/admin procedure layers.
  - `src/routers/index.ts`: `appRouter` composition.
  - `src/db.ts`, `src/redis.ts`, `src/load-env.ts`: infrastructure.
- Source layout:
  - `src/routers/`: `admin`, `adminMotd`, `health`, `motd`, `qa`, `quickFeedback`, `quiz`, `session`, `vote`, `wordCloud`.
  - `src/lib/`: auth, rate limit, presence, cleanup, join admission, scoring, answer order, word-cloud analysis, MOTD markdown, SLO/load telemetry.
  - `src/__tests__/`: backend Vitest coverage.
- Scripts: `dev` = `tsx watch src/index.ts`; `build` = `tsc`; `typecheck` = `tsc --noEmit`; `test` = `vitest run`.
- Backend must not expose raw Prisma models to clients; return DTOs validated/typed through shared contracts.

## Verwandte Memories:

- `mem:core`
- `mem:backend/api-router`
- `mem:modules/shared-types`
- `mem:modules/data-runtime`
- `mem:security/auth`
- `mem:security/dto-stripping`
- `mem:testing/core`
