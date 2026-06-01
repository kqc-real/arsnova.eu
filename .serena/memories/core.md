# Core

- Root memory for arsnova.eu agent context. Prefer this graph over `docs/cursor-context.md` for long-lived AI context.
- Project: account-light, DSGVO-oriented audience-response system for quiz, Q&A, quick feedback, team/bonus modes, present view, admin, MOTD/news, PWA/i18n.
- Repo root: `/Users/kqc/arsnova.eu`; npm workspaces monorepo with `apps/*` and `libs/*`.
- Start with module memories:
  - Product identity/background: `mem:modules/product`.
  - Backend stack and source layout: `mem:modules/backend`.
  - Frontend stack and source layout: `mem:modules/frontend`.
  - Shared API contracts: `mem:modules/shared-types`.
  - Landing/legal Astro app: `mem:modules/landing`.
  - Runtime data services: `mem:modules/data-runtime`.
- Critical safety/context memories:
  - Auth and ownership boundaries: `mem:security/auth`.
  - Participant DTO stripping and solution-data rules: `mem:security/dto-stripping`.
  - Session phases and live DTO lifecycle: `mem:session/lifecycle`.
- Implementation-detail memories:
  - tRPC router/procedure map: `mem:backend/api-router`.
  - Angular route/component map: `mem:frontend/routing-components`.
  - Frontend i18n/UI constraints: `mem:frontend/i18n-ui`.
  - Deployment/operator context: `mem:deployment/core`.
  - Testing conventions and checks: `mem:testing/core`.
  - Naming conventions: `mem:conventions/naming`.
  - Definition of Done and workflow: `mem:quality/dod`, `mem:quality/workflow`.
- Canonical files still matter: `AGENT.md` for critical rules, `.cursorrules` for minimal Cursor stack/path facts, `docs/README.md` as docs map, `Backlog.md` as story/DoD source, focused docs for security/deploy/testing/i18n/UI.
- Do not store task-local notes, secrets, volatile line-level facts, or full Backlog copies in memories.

## Verwandte Memories:

- `mem:memory_maintenance`
- `mem:modules/product`
- `mem:modules/backend`
- `mem:modules/frontend`
- `mem:modules/shared-types`
- `mem:modules/landing`
- `mem:modules/data-runtime`
- `mem:security/auth`
- `mem:security/dto-stripping`
- `mem:session/lifecycle`
- `mem:backend/api-router`
- `mem:frontend/routing-components`
- `mem:frontend/i18n-ui`
- `mem:deployment/core`
- `mem:testing/core`
- `mem:conventions/naming`
- `mem:quality/dod`
- `mem:quality/workflow`
