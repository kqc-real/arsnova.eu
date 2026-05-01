---
description: 'Use when writing or updating Vitest tests, Angular spec files, test-only refactors, or deciding which focused validation commands to run in arsnova.eu.'
applyTo:
  - 'apps/backend/src/**/*.test.ts'
  - 'apps/frontend/src/**/*.spec.ts'
  - 'apps/backend/vitest.config.ts'
  - 'apps/frontend/vitest.config.ts'
---

# Testing Instructions

- Match the workspace conventions: backend tests live under `apps/backend/src/**/*.test.ts`; frontend specs live next to the component, service, or helper as `*.spec.ts`.
- Treat tests as part of the feature or bugfix, not as follow-up cleanup. When behavior changes, update the nearest existing test first.
- Backend tests should usually cover one expected success path and one rejected or failing path for new procedure behavior.
- Frontend tests should cover the user-visible regression or interaction that changed, not only implementation details.
- If a change affects shared schemas, build `@arsnova/shared-types` before relying on backend-only typechecks.
- If frontend templates, localization, or parser-sensitive code changed, do not stop at diagnostics alone. Run the relevant frontend test or type/build command.
- Prefer the smallest focused check that can fail for the changed slice before widening to the whole workspace.

## Preferred Checks

- Focused backend test: `npm run test -w @arsnova/backend -- <path-to-test>`
- Focused frontend spec: `npm run test -w @arsnova/frontend -- <path-to-spec>`
- Backend suite: `npm run test -w @arsnova/backend`
- Frontend suite: `npm run test -w @arsnova/frontend`
- Full baseline before closing broader work: `npm run typecheck` and `npm test`
- Frontend UI or i18n changes: `npm run build:localize -w @arsnova/frontend` or `npm run build:prod`

## References

- [docs/TESTING.md](../../docs/TESTING.md)
- [AGENT.md](../../AGENT.md)
- [apps/backend/vitest.config.ts](../../apps/backend/vitest.config.ts)
- [apps/frontend/vitest.config.ts](../../apps/frontend/vitest.config.ts)
