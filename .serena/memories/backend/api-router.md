# Backend API Router

- `apps/backend/src/routers/index.ts` composes the app router from domain routers.
- Current router domains: `health`, `quiz`, `session`, `vote`, `qa`, `quickFeedback`, `motd`, `admin`, `adminMotd`, `wordCloud`.
- Procedure naming conventions: queries read (`getInfo`, `getLeaderboard`), mutations write (`create`, `join`, `submit`), subscriptions usually start with `on...`.
- tRPC inputs/outputs must use schemas from `@arsnova/shared-types`; do not define parallel DTOs in router code.
- Auth-sensitive router behavior:
  - session host/present/moderation paths require host token procedures.
  - quick feedback has session-bound and standalone ownership contexts.
  - admin/MOTD writes require admin token procedures.
  - public MOTD/read endpoints need rate limiting and minimal payloads.
- Session/history/export procedures must preserve ownership checks and DTO stripping.
- New procedures normally need success and rejection/error tests in backend Vitest coverage.

## Verwandte Memories:

- `mem:core`
- `mem:modules/backend`
- `mem:modules/shared-types`
- `mem:security/auth`
- `mem:security/dto-stripping`
- `mem:session/lifecycle`
- `mem:testing/core`
