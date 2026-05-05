# AGENT.md

Quick entry point for AI coding agents working in arsnova.eu. Keep this file short, and follow the linked docs for detail.

## Start Here

- Read [README.md](README.md) for setup, workspace scripts, and local run modes.
- Read [Backlog.md](Backlog.md) before implementing story work; the backlog is the source of scope and DoD.
- Use [docs/README.md](docs/README.md) as the documentation map.
- Expect documentation to be mixed German and English. Prefer linking to the existing doc instead of copying its content here.

## Always-On Rules

- Work schema-first for API changes: update [libs/shared-types](libs/shared-types) first, then backend, then frontend.
- Use tRPC plus shared Zod schemas as the contract. Do not add ad-hoc REST endpoints or duplicate DTO definitions in app code.
- Never derive permissions from a route, session code, or client state alone. Host-only backend logic must use validated token checks such as `hostProcedure`; standalone feedback uses its own feedback-host token model.
- Keep participant payloads minimal. Do not expose solution data such as `isCorrect` while a question is active.
- In [apps/frontend](apps/frontend), use Angular standalone components, Signals, and Angular Material 3 tokens. Do not introduce `BehaviorSubject` or RxJS-only state stores for ordinary UI state. Do not add Tailwind there.
- Any user-facing UI text change must keep the locale set in sync: `de`, `en`, `fr`, `es`, `it`.
- Tests are part of done. Add or update the nearest backend and frontend tests for the changed behavior.

## Validation Baseline

- General dev: `npm run dev`
- Full typecheck: `npm run typecheck`
- Full tests: `npm test`
- Production-style validation: `npm run build:prod`
- Workspace-scoped validation: `npm run test -w @arsnova/backend`, `npm run test -w @arsnova/frontend`, `npm run build -w @arsnova/shared-types`
- If you changed frontend templates, styles, or localized copy, finish with `npm run build:localize -w @arsnova/frontend` or the root `npm run build:prod`.

## Use These Docs Instead Of Rewriting Them

- Architecture and boundaries: [docs/architecture/handbook.md](docs/architecture/handbook.md)
- Security and authorization: [docs/SECURITY-OVERVIEW.md](docs/SECURITY-OVERVIEW.md)
- Testing and CI: [docs/TESTING.md](docs/TESTING.md)
- Angular i18n workflow: [docs/I18N-ANGULAR.md](docs/I18N-ANGULAR.md)
- UI rules: [docs/ui/README.md](docs/ui/README.md)
- Architecture decisions: [docs/architecture/decisions](docs/architecture/decisions)

## Scoped Instructions

- Backend work: [.github/instructions/backend.instructions.md](.github/instructions/backend.instructions.md)
- Frontend work: [.github/instructions/frontend.instructions.md](.github/instructions/frontend.instructions.md)
- Shared schema work: [.github/instructions/shared-types.instructions.md](.github/instructions/shared-types.instructions.md)
- Test work: [.github/instructions/testing.instructions.md](.github/instructions/testing.instructions.md)
- Docs work: [.github/instructions/docs.instructions.md](.github/instructions/docs.instructions.md)

## Available Skills

- Story delivery workflow: [.github/skills/story-delivery/SKILL.md](.github/skills/story-delivery/SKILL.md)
