# Task Completion

- Start coding tasks with `git status --short`; do not overwrite unrelated local changes.
- Narrow changes: run the smallest focused test/typecheck that can fail for the touched slice, then widen based on risk.
- Broad/general coding baseline before handoff: `npm run typecheck`, `npm test`, `npm run lint`.
- Shared contract changes:
  - `npm run build -w @arsnova/shared-types`
  - then `npm run typecheck` or affected workspace typechecks/tests.
- Backend changes:
  - focused backend test, e.g. `npm run test -w @arsnova/backend -- <path>`
  - `npm run typecheck -w @arsnova/backend`
  - full backend suite when router/auth/schema blast radius is nontrivial.
- Frontend changes:
  - focused frontend spec, e.g. `npm run test -w @arsnova/frontend -- <path>`
  - `npm run typecheck -w @arsnova/frontend`
  - UI/template/localized copy changes: `npm run build:localize -w @arsnova/frontend`; consider `check:viewport` and targeted smoke scripts.
- Prisma/data model changes: validate schema/migration path, regenerate Prisma client, update shared schemas/backend/frontend/tests/docs as needed.
- Production/deploy changes: `npm run build:prod`; when a real production env is available, also compose config validation and `npm run verify:production-serving` against a running serve.
- Markdown-only changes: at minimum `npx prettier --check <touched-docs>` and `git diff --check -- <touched-docs>`; run code checks too if docs describe changed behavior.
- Serena memory-only changes: verify the memory graph with `serena memories check` when the CLI is available; no npm build/test is needed unless repo files or behavior changed.
