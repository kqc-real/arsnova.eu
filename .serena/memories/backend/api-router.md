# Backend API Router

- `apps/backend/src/routers/index.ts` composes the app router from domain routers.
- Current router domains: `health`, `quiz`, `session`, `vote`, `qa`, `quickFeedback`, `motd`, `admin`, `adminMotd`, `wordCloud`, `productFeedback` (Epic 12 / Stories 12.1–12.2: Post-Session + IN_APP Challenge/Submit/Follow-up), `admin.productFeedback` (Stats + Triage Inbox).
- Procedure naming conventions: queries read (`getInfo`, `getLeaderboard`), mutations write (`create`, `join`, `submit`), subscriptions usually start with `on...`.
- Story 2.10 Slices 1–5 pairing lives under `session.*` via `sessionHostPairingRouter`: `createHostPairingInvite`, `requestHostPairing`, `getHostPairingRequest`, `approveHostPairing`, `rejectHostPairing`, `revokePairedHost`, `listPairedHosts`. Invite/approve/revoke/list require `originalHostProcedure`; request/claim are public with invite/request secrets. Caps and hashed tokens are in `apps/backend/src/lib/hostPairing.ts`. Host subscriptions (`onCurrentQuestionForHostChanged`, `onHostVoteProgressChanged`, `onParticipantJoined`) stop after paired-token revoke via `waitWhileHostTokenValid`.
- tRPC inputs/outputs must use schemas from `@arsnova/shared-types`; do not define parallel DTOs in router code.
- Auth-sensitive router behavior:
  - session host/present/moderation paths require host token procedures.
  - quick feedback has session-bound and standalone ownership contexts.
  - admin/MOTD writes require admin token procedures.
  - public MOTD/read endpoints need rate limiting and minimal payloads.
  - ProductFeedback IN_APP writes require Same-Origin via `PUBLIC_FRONTEND_URL` in production, Challenge token, and Shared-NAT-safe rate limits.
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
