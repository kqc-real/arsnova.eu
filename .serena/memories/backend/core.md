# Backend Core

- Backend source lives in `apps/backend/src`:
  - `index.ts`: Express/server entrypoint.
  - `trpc.ts`: tRPC initialization and procedure layers (`publicProcedure`, telemetry middleware, `hostProcedure`, `adminProcedure`).
  - `routers/index.ts`: `appRouter` combining `admin`, `health`, `motd`, `qa`, `quickFeedback`, `quiz`, `session`, `vote`, `wordCloud`.
  - `db.ts`, `redis.ts`, `load-env.ts`: infrastructure setup.
  - `lib/`: auth helpers (`hostAuth`, `adminAuth`, `feedbackHostAuth`), rate limit, presence, session cleanup, join admission, scoring, answer order, word-cloud analysis, MOTD markdown, SLO/load telemetry.
- Data model is Prisma/PostgreSQL in root `prisma/schema.prisma`; local dev DB is Postgres 16. Redis is used for rate limits, token TTL/live helper data, pub/sub/presence/live feedback concerns.
- App is intentionally account-free/local-first: quiz creation is browser-local until upload/start creates server-side quiz/session records. Do not introduce creator/user ownership assumptions without an explicit product/security decision.
- Security-sensitive router changes must keep host/admin/feedback-host token contexts separate and server-enforced. Client route guards are not authorization.
- Participant/live DTOs must strip answer correctness and owner-only material before returning to student/vote views.
- Backend tests live in `apps/backend/src/__tests__/*.test.ts` and selected `src/lib/*.test.ts`; Vitest runs in node environment and aliases `@arsnova/shared-types` to source for tests.
- Backend workspace scripts: `dev` = `tsx watch src/index.ts`; `build` = `tsc`; `typecheck` = `tsc --noEmit`; tests use `vitest run`.
