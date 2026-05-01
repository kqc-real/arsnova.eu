---
name: story-delivery
description: 'Implement backlog stories in arsnova.eu. Use when a user references a story or epic from Backlog.md, asks to implement, fix, or complete a backlog item, or wants the repo-specific delivery workflow from story scope to validation.'
argument-hint: 'Story id or scope, for example: 0.7, 1.6c, 8.5, or "implement Story 1.2d numerische Schaetzfrage"'
user-invocable: true
---

# Story Delivery

Use this skill when the task is anchored in [Backlog.md](../../../Backlog.md): a story ID, an epic/story title, or a request to implement or finish a backlog item.

This skill exists to make agents follow the repo's real delivery order instead of jumping straight into arbitrary files.

## What This Skill Optimizes For

- Backlog scope before code
- Schema-first contract changes
- Correct backend versus frontend execution order
- Focused tests before broad validation
- i18n, security, and docs updates when the story implies them

## Workflow

1. **Anchor the task in the backlog first.**
   - Open [Backlog.md](../../../Backlog.md) and find the referenced story or the closest matching title.
   - Extract only the controlling acceptance criteria and DoD-relevant constraints.
   - If the story is ambiguous, ask which story or slice should be implemented first rather than guessing a broader scope.

2. **Decide the first implementation surface.**
   - If the story changes API shape, question types, DTOs, or request/response data, start in [libs/shared-types](../../../libs/shared-types).
   - If it is server-only behavior, authorization, persistence, or rate limiting, start in [apps/backend](../../../apps/backend).
   - If it is presentation-only and uses an existing contract unchanged, start in [apps/frontend](../../../apps/frontend).
   - If it spans backend and frontend, still change the contract first, then backend, then frontend.

3. **Apply repo-specific guardrails while coding.**
   - Never infer host or moderator rights from routes or client flags alone; use validated backend token checks.
   - Preserve DTO stripping for participant-facing data.
   - In Angular UI code, use standalone components and Signals; do not introduce `BehaviorSubject` for ordinary UI state.
   - For user-facing copy changes, keep locales in sync: `de`, `en`, `fr`, `es`, `it`.
   - If the story changes architecture or persistent behavior expectations, update the nearest doc or ADR-linked doc in the same change when practical.

4. **Validate in the smallest useful order.**
   - After the first substantive edit, run the narrowest relevant test, spec, or typecheck.
   - If shared-types changed, rebuild them before backend-only validation.
   - If frontend templates, styles, or localization changed, finish with `npm run build:localize -w @arsnova/frontend` or `npm run build:prod`.
   - Before calling the work done, run the smallest set that proves the touched slice plus the baseline checks the scope warrants.

5. **Close the loop against the story.**
   - Recheck the implemented acceptance criteria.
   - Note any deliberate omissions, follow-up stories, or residual risks explicitly.
   - If a story implies glossary, docs, or ADR upkeep, handle that before closing.

## Routing Hints

- **Story mentions question types, DTOs, answer payloads, imports, or schemas:** load the shared-types instructions first.
- **Story mentions host, presenter, moderation, access, cleanup, Redis, Prisma, or rate limits:** load the backend instructions first.
- **Story mentions copy, accessibility, layout, dialogs, theme, translations, or mobile behavior:** load the frontend instructions first.
- **Story asks for docs, glossary, backlog sync, or ADR updates:** load the docs instructions too.
- **Any implementation story:** apply the testing instructions for focused validation rather than broad commands by default.

## References

- [Backlog.md](../../../Backlog.md)
- [AGENT.md](../../../AGENT.md)
- [docs/TESTING.md](../../../docs/TESTING.md)
- [docs/SECURITY-OVERVIEW.md](../../../docs/SECURITY-OVERVIEW.md)
- [docs/I18N-ANGULAR.md](../../../docs/I18N-ANGULAR.md)
