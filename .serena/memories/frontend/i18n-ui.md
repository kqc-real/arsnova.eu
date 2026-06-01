# Frontend i18n UI

- Source language is German (`de`); UI tone is informal `Du`.
- Maintained frontend locales: `de`, `en`, `fr`, `es`, `it`.
- Translation files live under `apps/frontend/src/locale/`; Angular source XLF is `messages.xlf`.
- User-facing text changes must sync all locales, including ARIA labels, placeholders, validation, errors, help text, and legal copy when relevant.
- Prefer stable Angular i18n IDs (`i18n="@@..."`, `$localize` IDs) for durable copy; clean up stale XLF entries after copy restructures.
- Dev mode: standard `dev`/`start:de` serves German source; `dev:en`/`start:en` serves English single-locale dev build. Full locale validation uses `build:localize`.
- Locale subpaths reload the app. Avoid accidental loss of unsaved edit state; quiz edit/new flows are the high-risk language-switch cases.
- UI must handle 320px/mobile and longer localized strings. Reduced-motion-sensitive micro-interactions belong in `@media (prefers-reduced-motion: no-preference)`.
- UI implementation follows Angular Material 3 tokens and docs under `docs/ui/`.

## Verwandte Memories:

- `mem:core`
- `mem:modules/frontend`
- `mem:frontend/routing-components`
- `mem:quality/dod`
- `mem:testing/core`
