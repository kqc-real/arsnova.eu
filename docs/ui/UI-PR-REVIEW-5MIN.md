# UI‑PR Review in 5 Minuten (arsnova.eu)

Quelle: `docs/ui/`  
https://github.com/kqc-real/arsnova.eu/tree/main/docs/ui

> Gilt für PRs mit UI‑Änderungen in `apps/frontend` (Angular Material 3 + Tokens).
> Wenn ein Block rot ist: **stop** → “Changes requested”.

---

## 0) Scope (15–30s)
- Welche Screens/Routen sind betroffen (Home/Join/Quiz/Session/Admin/Legal/Help)?
- Ist es **Copy/i18n**, **Layout/SCSS**, **Komponenten/Flow**, oder eine Mischung?

---

## 1) Material‑First & kein Tailwind (30–45s)
- [ ] Neue interaktive UI nutzt primär **Angular Material** (Button/Input/Dialog/Menu/Icon).
- [ ] **Kein Tailwind** (keine Klassen/Config/Utilities) im Angular‑Frontend.
- [ ] Eigenkomponenten nur, wenn Material funktional nicht reicht (trotzdem tokenbasiert).

Referenz: `docs/ui/STYLEGUIDE.md`, `docs/ui/DOD-AUDIT-REPORT.md`

---

## 2) Tokens (Farben/Typo/Shape/Elevation) (60–90s)
Schnellcheck im Diff (SCSS/HTML):
- [ ] Keine neuen hardcoded `#hex`/`rgb()` für Standard‑UI‑Semantik.
- [ ] Farben/Typografie/Shape/Elevation kommen aus:
  - `--mat-sys-*` oder
  - dokumentierten `--app-*` / `--arsnova-*`.
- [ ] Neue Tokens sind begründet, eng gescoped, dokumentiert (ggf. `TOKENS.md`) und in **Light/Dark + Seriös/Spielerisch** geprüft.

Referenz: `docs/ui/TOKENS.md`

---

## 3) Overrides & Overlays (45–60s)
- [ ] Material‑Anpassungen über **Override‑APIs/Mixins** (`mat.*-overrides`), nicht über fragile DOM‑Selektoren.
- [ ] Kein neues `::ng-deep`.
- [ ] Overlay‑Styling nur mit enger `panelClass`/`backdropClass`.
- [ ] Standard‑Dialoge nutzen `dialog-title-header` (außer dokumentierte Fullscreen‑Ausnahmen).

Referenz: `docs/ui/STYLEGUIDE.md`, `docs/ui/PR-CHECKLIST-UI.md`

---

## 4) Layout & Mobile‑First (60s)
- [ ] Seite nutzt passende Layout‑Shell: `.l-page`, `.l-section` oder `content-page-layer`.
- [ ] **320px**: kein horizontales Scrollen, Touch‑Targets ok.
- [ ] Struktur vs. Semantik getrennt (Layout‑Patterns vs. Token‑Skin).

Referenz: `docs/ui/STYLEGUIDE.md`, `docs/ui/PR-CHECKLIST-UI.md`

---

## 5) A11y & States (60s)
- [ ] Fokus sichtbar, Reihenfolge logisch erreichbar.
- [ ] Disabled/Error/Hover/Focus/Loading geprüft.
- [ ] Formulare: bei invalidem Submit Fokus → erstes fehlerhaftes Feld (inkl. Scroll).
- [ ] Motion respektiert `prefers-reduced-motion`.

Referenz: `docs/ui/PR-CHECKLIST-UI.md`, `docs/ui/STYLEGUIDE.md`

---

## 6) Copy & i18n (30–60s)
- [ ] Texte in `de`, `en`, `fr`, `es`, `it` synchron (wenn geändert).
- [ ] Wording: Du‑Ansprache, zielgruppenneutral, keine unnötigen Anglizismen.
- [ ] Englisch‑Copy folgt `ENGLISH-UI-COPY.md` (Host/Session‑Terminologie etc.).

Referenz: `docs/ui/ENGLISH-UI-COPY.md`, `docs/ui/PR-CHECKLIST-UI.md`

---

## Evidence (optional, aber ideal im PR)
Mindestens passend zur Änderung:
- [ ] Typecheck: `npm run typecheck -w @arsnova/frontend`
- [ ] Localize‑Build (bei Copy/i18n): `npm run build:localize -w @arsnova/frontend`
- [ ] 320px Smoke: `BASE_URL=http://localhost:4200 npm run check:viewport -w @arsnova/frontend`
- [ ] A11y Smoke: `BASE_URL=http://localhost:4200 npm run lighthouse:a11y -w @arsnova/frontend`

Referenz: `docs/ui/PR-CHECKLIST-UI.md`, `docs/ui/LIGHTHOUSE-PERFORMANCE.md`

---

## Reviewer‑Entscheidung (Copy/Paste)
- **✅ Approve**: 1–6 grün, keine erkennbare Regression.
- **⚠️ Approve with follow‑ups**: Doku/Checks fehlen, aber Design/Tokens/A11y ok.
- **❌ Changes requested**: hardcoded Farben/Typo ohne Ausnahme, neue fragile Overrides/`::ng-deep`, 320px bricht, Fokus/A11y regressiert, i18n Sync kaputt.
