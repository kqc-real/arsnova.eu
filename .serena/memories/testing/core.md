# Testing Core

- Root baseline for broad changes: `npm run typecheck`, `npm test`, `npm run lint`.
- Root build commands: `npm run build`, `npm run build:prod`; shared contract rebuild: `npm run build -w @arsnova/shared-types`.
- Backend tests: Vitest in `apps/backend`, node environment, tests under `apps/backend/src/**/*.test.ts` and selected `src/lib/*.test.ts`.
- Frontend tests: Vitest + @analogjs/vitest-angular, jsdom, specs colocated as `*.spec.ts` beside components/services/utilities.
- New backend procedures usually need at least one success and one rejection/error case.
- DTO stripping/security behavior needs explicit regression coverage: active participant payloads must not contain correctness; revealed/results payloads may contain correctness where intended.
- UI/template/i18n changes should not stop at diagnostics; use focused specs, `npm run typecheck -w @arsnova/frontend`, and for localized copy/templates `npm run build:localize -w @arsnova/frontend`.
- Optional frontend smokes include viewport 320px, host/present auth, host music, short text, quiz sync, unified session, Lighthouse a11y, word-cloud benchmark.
- Markdown-only changes: `npx prettier --check <touched-docs>` and `git diff --check -- <touched-docs>`.

## Verwandte Memories:

- `mem:core`
- `mem:quality/dod`
- `mem:quality/workflow`
- `mem:modules/backend`
- `mem:modules/frontend`
- `mem:security/dto-stripping`
- `mem:deployment/core`
