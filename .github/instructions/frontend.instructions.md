---
description: 'Use when changing Angular frontend components, templates, styles, localized copy, Material 3 UI patterns, Signals-based state, or frontend Vitest coverage in arsnova.eu.'
applyTo:
  - 'apps/frontend/src/**/*.ts'
  - 'apps/frontend/src/**/*.html'
  - 'apps/frontend/src/**/*.scss'
  - 'apps/frontend/src/**/*.css'
  - 'apps/frontend/src/locale/**/*.xlf'
---

# Frontend Instructions

- Use Angular standalone components and Signals for UI state. RxJS is for async streams and operators only, not as the default local state model. Do not introduce `BehaviorSubject` for ordinary component state.
- Follow Angular Material 3 and the project token system. In [apps/frontend](../../apps/frontend) do not introduce Tailwind or one-off styling systems.
- Keep tests next to the artifact under test as `<name>.spec.ts`. When behavior changes, update the nearest spec instead of creating detached test collections.
- For copy changes, keep all frontend locales in sync: `de`, `en`, `fr`, `es`, `it`. This includes ARIA labels, placeholders, validation text, and legal content when relevant.
- If localized copy changes, prefer stable message IDs and keep XLF placeholders aligned with the current extract. Do not hand-wave placeholder names.
- Check mobile behavior deliberately for UI work. The project treats 320 px and localized layouts as first-class constraints.
- Use existing frontend scripts when they match the change: viewport smoke, host/present auth smoke, quiz sync smoke, or localized serve flows.

## Preferred Checks

- Focused frontend tests: `npm run test -w @arsnova/frontend -- <path-to-spec>`
- Frontend typecheck: `npm run typecheck -w @arsnova/frontend`
- Localized build for UI or copy changes: `npm run build:localize -w @arsnova/frontend`
- Full frontend suite: `npm run test -w @arsnova/frontend`

## References

- [docs/ui/README.md](../../docs/ui/README.md)
- [docs/I18N-ANGULAR.md](../../docs/I18N-ANGULAR.md)
- [docs/TESTING.md](../../docs/TESTING.md)
- [docs/architecture/decisions/0002-use-angular-signals-for-ui-state.md](../../docs/architecture/decisions/0002-use-angular-signals-for-ui-state.md)
- [docs/architecture/decisions/0005-use-angular-material-design.md](../../docs/architecture/decisions/0005-use-angular-material-design.md)
- [docs/architecture/decisions/0008-i18n-internationalization.md](../../docs/architecture/decisions/0008-i18n-internationalization.md)
