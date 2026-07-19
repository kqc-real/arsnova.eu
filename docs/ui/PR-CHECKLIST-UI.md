# PR-Checklist UI (Angular Material 3)

Diese Checkliste ist für alle PRs mit UI-Änderungen in `apps/frontend` verpflichtend.

**Stand:** 2026-05-31 — abgeglichen mit [STYLEGUIDE.md](STYLEGUIDE.md), [TOKENS.md](TOKENS.md), Angular 21.2, den aktuellen Frontend-Skripten und der i18n-Dokumentation.

## 1) Design-System-Konformität

- [ ] Neue interaktive UI nutzt primär Angular-Material-Komponenten.
- [ ] Eigenkomponenten wurden nur dort verwendet, wo Material funktional nicht ausreicht.
- [ ] Es wurden keine Tailwind-Klassen, Tailwind-Configs oder Tailwind-Utilities eingeführt.
- [ ] Spielerisch/Seriös bleiben über `html.preset-playful` und Tokens getrennt; keine Preset-Sonderlogik über freie Hex-Werte.

## 2) Theming und Tokens

- [ ] Farben, Typografie, Shape und Elevation kommen aus Tokens.
- [ ] Keine hardcoded Hex-/RGB-Werte für Standard-UI-Semantik.
- [ ] App-Semantik-Tokens (`--app-*`, `--arsnova-*`) sind in [TOKENS.md](TOKENS.md) dokumentiert oder bewusst komponentenspezifisch scoped.
- [ ] Neue Token-Bedarfe sind begründet, möglichst eng gescoped und in Light/Dark sowie Spielerisch/Seriös geprüft.
- [ ] Status-, Bewertungs- und Chart-Farben nutzen die dokumentierten Ausnahmen statt neuer Einzelfarben.

## 3) Angular-Material-Overrides und Overlays

- [ ] Anpassungen an Material-Komponenten erfolgen über `mat.theme-overrides(...)` oder `<component>-overrides(...)`.
- [ ] Keine fragilen Overrides gegen interne Material-DOM-Strukturen.
- [ ] Kein neues `::ng-deep`.
- [ ] Globale Overlay-Regeln sind über enge `panelClass` / `backdropClass` begrenzt.
- [ ] Standard-Dialoge nutzen `dialog-title-header`; Fullscreen-Tools (Word Cloud, Bild-Lightbox) sind als Ausnahme begründet und separat auf Fokus/Close/Scroll geprüft.

## 4) Layout und SCSS-Patterns

- [ ] Seiten nutzen passende globale Layouts: `.l-page`, `.l-section` oder `.content-page-layer`.
- [ ] Layout wurde über zentrale Pattern (Stack, Cluster, Grid, Inset, Section) umgesetzt.
- [ ] Kein einmaliger Spacing-/Layout-Hack ohne Wiederverwendungsabsicht.
- [ ] Struktur-Styles und visuelle Semantik sind getrennt.
- [ ] Lesbarkeits-Mindestwerte eingehalten: Body `line-height >= 1.5`, Hint/Error `>= 1.4`, Feldabstand `>= 1rem`.
- [ ] Luftiger Vertikalrhythmus eingehalten: Hilfetext zu Widget `>= 0.45rem`, aufeinanderfolgende Aktions-Widgets `>= 0.65rem`.
- [ ] 320 px Breite ohne horizontales Scrollen geprüft.

## 5) Accessibility und Interaction States

- [ ] Light/Dark wurde geprüft.
- [ ] Spielerisch/Seriös wurde geprüft, wenn Farben, Flächen oder Schatten betroffen sind.
- [ ] Fokuszustand ist sichtbar, logisch erreichbar und kontrastreich.
- [ ] Disabled, Error, Hover, Focus und Loading wurden getestet.
- [ ] Kontrast ist für relevante Text/Surface-Kombinationen plausibel.
- [ ] Bei ungültigem Submit springt der Fokus auf das erste fehlerhafte Feld inklusive Scroll.
- [ ] Motion ist bei `prefers-reduced-motion: reduce` nutzbar und ohne Informationsverlust.
- [ ] Touch-Targets sind auf Mobile groß genug und nicht überlappt.

## 6) Wording, Locale und Content

- [ ] Neue oder geänderte UI-Texte sind in `de`, `en`, `fr`, `es`, `it` synchron.
- [ ] Bei Legal-Texten sind die passenden Markdown-Dateien je Locale geprüft.
- [ ] Wording entspricht dem Styleguide: Du-Ansprache, zielgruppenneutral, keine unnötigen Anglizismen.
- [ ] Feste Übersetzungs-IDs (`@@...`) bleiben stabil oder wurden bewusst migriert.
- [ ] Datum/Zeit ist in deutscher UI als `de-DE` formatiert.
- [ ] Deutsche UI nutzt „Vorschau“, „Tastenkürzel“, „gültig“ und vermeidet technische Begriffe in Primärtexten.

## 7) Feature-spezifische Regression

- [ ] Betroffene Screens wurden manuell geprüft: Desktop, 840 px, 600 px und 320 px soweit relevant.
- [ ] Es gibt keine visuelle Regression bei bestehenden Material-Komponenten.
- [ ] Überflüssige Alt-Styles wurden entfernt; kein paralleler Stilpfad.
- [ ] Overflow-Menüs enthalten keine redundanten Duplikate einer bereits sichtbaren Primäraktion.
- [ ] Preview-Ansichten sind nicht interaktiv (Radio/Checkbox nur visuell).
- [ ] Markdown/KaTeX wird in Liste, Edit, Preview und Live-Ansicht konsistent gerendert.
- [ ] Markdown-Bilder und Lightbox wurden geprüft, wenn Markdown-Rendering betroffen ist.
- [ ] Word-Cloud-Fullscreen-Dialoge wurden auf Desktop/Mobile geprüft, wenn Wortwolken betroffen sind.

## 8) Checks

Mindestens passend zur Änderung ausführen oder im PR begründen, warum nicht:

- [ ] fokussierter Frontend-Test: `npm run test -w @arsnova/frontend -- <path-to-spec>`
- [ ] Frontend-Typecheck: `npm run typecheck -w @arsnova/frontend`
- [ ] Template-A11y-Lint: `npm run lint`
- [ ] UI-/Copy-Änderung: `npm run build:localize -w @arsnova/frontend` oder Root `npm run build:prod`
- [ ] Reflow-/Fokus-/Zielgrößen-Smoke: `BASE_URL=http://localhost:4200 npm run a11y:layout -w @arsnova/frontend`
- [ ] Statisches axe-Gate: `BASE_URL=http://localhost:4200 npm run a11y:axe:static -w @arsnova/frontend`
- [ ] Lighthouse-A11y einschließlich Einzelaudits: `BASE_URL=http://localhost:4200 npm run lighthouse:a11y -w @arsnova/frontend`
- [ ] Landing bei Landing-Änderungen: `npm run build -w @arsnova/landing && npm run test:a11y -w @arsnova/landing`
- [ ] PDF-Export bei PDF-Änderungen: `npm run validate:pdfua`
- [ ] Markdown-only: `npx prettier --check <dateien>` und `git diff --check -- <dateien>`

## 9) Dokumentation

- [ ] ADR `0005` wurde beachtet.
- [ ] [STYLEGUIDE.md](STYLEGUIDE.md) und [TOKENS.md](TOKENS.md) wurden bei Bedarf aktualisiert.
- [ ] i18n-Regeln aus `docs/I18N-ANGULAR.md` wurden beachtet.
- [ ] Ausnahmen sind dokumentiert mit Scope, Dauer und Rückbauplan.

## Reviewer-Entscheidung

- [ ] Freigabe
- [ ] Freigabe mit Auflagen
- [ ] Änderungen erforderlich
