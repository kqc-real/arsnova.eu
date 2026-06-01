# Quality Definition of Done

- Code compiles and types are clean. Avoid `any`; shared API payloads use Zod schemas from `@arsnova/shared-types`.
- API changes are complete across shared schema, backend implementation, frontend usage, and tests.
- DTO pattern is preserved; participant-facing `ACTIVE` payloads never expose solution data such as `isCorrect`.
- Security-sensitive behavior has rejection/error tests as well as success cases.
- Frontend uses Standalone Components, Signals, Angular Material 3 tokens, `@if`/`@for`, mobile-first layout, keyboard/focus accessibility, dark/light compatibility, reduced-motion guard for animations.
- UI/copy changes sync `de`, `en`, `fr`, `es`, `it` and preserve relevant ARIA/placeholder/error text.
- Docs are updated when setup, env, deployment, security, tests, admin flow, routes, or user-visible behavior changes.
- Production/operator changes require production-style validation and focused documentation review.
- Choose focused checks first, then broaden based on blast radius.

## Verwandte Memories:

- `mem:core`
- `mem:quality/workflow`
- `mem:testing/core`
- `mem:security/auth`
- `mem:security/dto-stripping`
- `mem:frontend/i18n-ui`
- `mem:deployment/core`
