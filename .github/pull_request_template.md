# Pull Request checklist (UI quick review)

> This is a **quick** 5‑minute reviewer checklist for UI changes in `apps/frontend`.
> Source of truth: `docs/ui/PR-CHECKLIST-UI.md`.

## Scope
- [ ] Which screens/routes are affected (Home/Join/Quiz/Session/Admin/Legal/Help)?
- [ ] Is this Copy/i18n, Layout/SCSS, Components/Flow (or mixed)?

## Material + Tokens
- [ ] New interactive UI uses **Angular Material** first.
- [ ] No Tailwind introduced in `apps/frontend`.
- [ ] No hardcoded `#hex` / `rgb()` for standard UI semantics.
- [ ] Uses `--mat-sys-*` or documented `--app-*` / `--arsnova-*` tokens.

## Overrides / Overlays
- [ ] No new fragile Material DOM overrides / no new `::ng-deep`.
- [ ] Overlays styled via narrow `panelClass` / `backdropClass`.
- [ ] Standard dialogs use the `dialog-title-header` pattern (unless documented fullscreen exception).

## Mobile + A11y
- [ ] 320px: no horizontal scrolling; touch targets ok.
- [ ] Focus is visible + keyboard reachable; disabled/error/loading states checked.
- [ ] Motion respects `prefers-reduced-motion`.

## Copy / i18n
- [ ] Locale sync (`de`, `en`, `fr`, `es`, `it`) if strings changed.
- [ ] EN copy follows `docs/ui/ENGLISH-UI-COPY.md` terminology.

## Evidence (as applicable)
- [ ] `npm run typecheck -w @arsnova/frontend`
- [ ] `npm run build:localize -w @arsnova/frontend` (if i18n/copy changed)
- [ ] `BASE_URL=http://localhost:4200 npm run check:viewport -w @arsnova/frontend`
- [ ] `BASE_URL=http://localhost:4200 npm run lighthouse:a11y -w @arsnova/frontend`
