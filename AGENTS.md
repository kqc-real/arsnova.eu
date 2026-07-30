# AGENTS.md

Critical instructions for AI coding agents working in arsnova.eu.

## Always-On Rules

- Work schema-first for API changes: update `libs/shared-types` first, then
  backend, then frontend.
- Use tRPC with shared Zod schemas as the contract. Do not add ad-hoc REST
  endpoints or duplicate DTO definitions in application code.
- Never derive permissions from a route, session code, room identifier, URL
  parameter, or client state alone. Host-only backend logic must use validated
  token checks such as `hostProcedure`; standalone feedback, administration,
  and synchronization use their respective token or capability models.
- Keep participant payloads minimal. Do not expose solution data such as
  `isCorrect` while a question is active.
- Preserve the effective-vote rule for Peer Instruction scoring, leaderboards,
  bonus codes, analytics, and exports.
- In `apps/frontend`, use Angular standalone components, Signals, and Angular
  Material 3 tokens. Do not introduce `BehaviorSubject` or RxJS-only state
  stores for ordinary UI state. Do not add Tailwind CSS.
- Keep all user-facing text synchronized across `de`, `en`, `fr`, `es`, and
  `it`.
- Preserve the established WCAG 2.2 AA accessibility level. UI changes must
  not regress keyboard operation, screen-reader semantics, focus management,
  reflow, zoom, contrast, or reduced-motion behavior.
- Tests are part of done. Add or update the nearest backend and frontend tests
  for changed behavior.
- Keep documentation synchronized when setup, environment variables,
  deployment, security, tests, administration, routes, or user-visible
  behavior change.
- Never commit secrets, `.env` contents, production credentials, private keys,
  tokens, database dumps, or local operational artifacts.
- Do not assume a CDN, WAF, or a unique public IP per participant. Production
  must support at least 500 concurrent lecture-hall clients, including many
  users behind shared NAT. Rate limits must not block legitimate shared-IP
  traffic.

## Working Rules

- Read relevant documentation, nearby tests, and analogous implementations
  before editing.
- Check `git status` before editing and preserve unrelated local changes.
- Before implementation, identify the intended behavior, applicable
  invariants, authoritative source of truth, and affected contracts.
- Search for all affected call sites and analogous paths. Do not fix only the
  first visible occurrence of a shared defect class.
- Prefer the smallest complete, codebase-local change over broad rewrites.
- For API work, update shared schemas, backend implementation, frontend usage,
  and tests as one coherent slice.
- For UI work, verify mobile layout, localized text lengths, and relevant
  accessibility behavior.
- For medium- and high-risk changes, evaluate relevant rejection, reload,
  reconnect, expiry, migration, legacy, and concurrency paths. Test only
  plausible paths and justify relevant omissions in the pull request.
- Verify third-party formats, protocols, and runtime behavior against an
  authoritative specification or an appropriate contract test.
- For production or operator-facing changes, verify against
  `docker-compose.prod.yml`, `.env.production.example`, `scripts/deploy.sh`,
  `.github/workflows/ci.yml`, and the relevant production documentation.
- For documentation-only work, verify claims against implementation code,
  tests, configuration, or canonical documentation.

## Validation

Run the checks appropriate to the change:

- Full typecheck: `npm run typecheck`
- Full tests: `npm test`
- Lint: `npm run lint`
- Production build: `npm run build:prod`
- Backend tests: `npm run test -w @arsnova/backend`
- Frontend tests: `npm run test -w @arsnova/frontend`
- Shared-types build: `npm run build -w @arsnova/shared-types`
- Localized frontend build:
  `npm run build:localize -w @arsnova/frontend`

If frontend templates, styles, translations, build configuration, or
production behavior change, run `npm run build:prod` or the applicable
localized build.

For Markdown-only changes, run at minimum:

- `npx prettier --check <touched-docs>`
- `git diff --check -- <touched-docs>`

For production, deployment, database, Redis, WebSocket, rate-limit, or
operator-facing changes, also run the applicable checks from
`docs/TESTING.md`.

Do not report an unexecuted check as successful. If a relevant check cannot be
run, state the reason and resulting risk in the pull request.

## Review Readiness

Before opening or updating a pull request:

- Read and use `.github/pull_request_template.md` in full. Complete every
  applicable section, justify omitted checks, and do not replace it with a
  shorter custom description. The `PR-Template vollständig` check must pass
  before review.
- Review the complete diff, not only the latest edit or fix commit.
- Re-check the task, acceptance criteria, invariants, and analogous paths.
- Add positive, negative, and regression tests appropriate to the actual risk.
- Verify consistency between implementation, schemas, tests, documentation,
  configuration, translations, and the pull-request description.
- Remove obsolete code, temporary compatibility paths, debug output, and
  misleading comments introduced by the change.
- Report the exact validation commands and results.
- Do not claim security, accessibility, compatibility, performance, or
  production properties that were not verified.
- Describe relevant production impact, rollback requirements, residual risks,
  and justified not-applicable checks.
- For asynchronous UI behavior, trace the complete lifecycle before coding:
  trigger → pending → success → rejection/timeout → retry or dismissal.
  Verify DOM state, interaction lock, announcement, and focus in every
  applicable state.
- Never remove, replace, or programmatically focus an element without verifying
  that the resulting focus target exists, is visible, is unobscured, and remains
  appropriate after both success and failure.

## Code Review Rules

- Review the complete pull request and the underlying defect class, not only
  the latest fix.
- Prioritize correctness, security boundaries, state transitions, data
  integrity, production behavior, accessibility, and regressions over style.
- Verify important claims against code, tests, configuration, documentation,
  and authoritative external specifications where relevant.
- Report findings only when there is a concrete failure scenario, affected
  path, and observable impact.
- Use severity proportional to realistic impact and likelihood.
- Do not request speculative hardening or unrelated architectural rewrites
  without a plausible threat or failure path for arsnova.eu.
- Do not reopen a resolved finding unless the fix introduces a concrete new
  regression.
