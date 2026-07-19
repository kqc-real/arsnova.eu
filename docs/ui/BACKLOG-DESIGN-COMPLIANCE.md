# Backlog-Design-Compliance-Check

**Stand:** 2026-07-19

**Basis:** [Backlog.md](../../Backlog.md), [STYLEGUIDE.md](STYLEGUIDE.md), [TOKENS.md](TOKENS.md), [PR-CHECKLIST-UI.md](PR-CHECKLIST-UI.md), ADR-0005 und ADR-0008. Der frühere Auditstand vom 2026-02-25 ist damit ersetzt.

---

## 1. Frontend-DoD

| Kriterium                       | Status | Aktueller Abgleich                                                                                |
| ------------------------------- | ------ | ------------------------------------------------------------------------------------------------- |
| Standalone Components + Signals | ✅     | Standard in `apps/frontend`; keine neuen NgModule-Patterns einführen.                             |
| `@if` / `@for` Control Flow     | ✅     | Angular-Control-Flow ist der Zielpfad für neue Templates.                                         |
| Mobile-First ab 320 px          | ✅     | `npm run check:viewport -w @arsnova/frontend` ist der kanonische 320-px-Smoke.                    |
| Touch-Targets ≥ 44 x 44 px      | ✅     | Material-Controls und App-Controls müssen diese Grenze halten.                                    |
| Tastatur erreichbar, Fokusring  | ✅     | Material-Fokus plus Custom-Fokus nach Styleguide; keine `outline: none`-Hacks.                    |
| Light/Dark/System Theme         | ✅     | Theme-Switcher und Preset-Theme sind umgesetzt; Tokens siehe `TOKENS.md`.                         |
| i18n                            | ✅     | UI-Locales `de`, `en`, `fr`, `es`, `it` sind gepflegt; XLF-Sync bleibt Pflicht.                   |
| `prefers-reduced-motion`        | ✅     | Bewegte Effekte müssen reduzierte Alternativen anbieten.                                          |
| Automatisierte A11y-Gates       | ✅     | Template-Lint, axe, Reflow/Fokus/Zielgrößen und Lighthouse-Einzelaudits; siehe `docs/TESTING.md`. |

---

## 2. Epic 6

| Story                             | Status | Hinweis                                                                                        |
| --------------------------------- | ------ | ---------------------------------------------------------------------------------------------- |
| **6.1** Dark/Light/System Theme   | ✅     | Theme, Persistenz und Systemmodus sind umgesetzt.                                              |
| **6.2** Internationalisierung     | ✅     | Angular-localize/XLF mit fünf Locales; keine alte `i18n/*.json`-Annahme mehr verwenden.        |
| **6.3** Impressum & Datenschutz   | ✅     | Lokalisierte Legal-Markdown-Dateien unter `apps/frontend/src/assets/legal/`.                   |
| **6.4** Mobile-First & Responsive | ✅     | PWA, Viewport-Meta, responsive Layouts und 320-px-Smoke sind Teil der UI-Checks.               |
| **6.5** Barrierefreiheit          | 🔨     | Technische Gates und Befunde umgesetzt; manuelle AT-/Zoom-/OS-Abnahme laut A11y-Journal offen. |
| **6.6** Thinking-Aloud / UX       | ⬜     | Methodische Testreihe plus dokumentierte Umsetzung der Befunde bleibt offen.                   |

---

## 3. Designrelevante Story-Stände

| Bereich                         | Aktueller Stand                                                                                     |
| ------------------------------- | --------------------------------------------------------------------------------------------------- |
| **Startseite / Presets**        | umgesetzt; Presets, Theme, Sprachwahl, Join, Quiz-Sammlung, Server-Status und Legal-Links sichtbar. |
| **Vote / Abstimmung (3.3b)**    | umgesetzt; nicht mehr als offene UI-Lücke führen.                                                   |
| **Presenter / Beamer (2.5)**    | umgesetzt; Vollbild- und Präsentationsregeln siehe `STYLEGUIDE.md`.                                 |
| **Ergebnis-Visualisierung 4.4** | umgesetzt; Farb- und Statusausnahmen in `TOKENS.md` dokumentieren.                                  |
| **Word Cloud 2.0 (1.14a)**      | weiterhin offener Ausbaupfad; bei UI-Arbeit Performance- und Layout-Regeln aus ADR-0012 beachten.   |

---

## 4. Pflege-Regel

- Aktuelle UI-Regeln stehen in [STYLEGUIDE.md](STYLEGUIDE.md), [TOKENS.md](TOKENS.md) und [PR-CHECKLIST-UI.md](PR-CHECKLIST-UI.md).
- Neue UI-Texte müssen in `messages.xlf`, `messages.en.xlf`, `messages.fr.xlf`, `messages.es.xlf` und `messages.it.xlf` synchron bleiben.
- Alte Tailwind-Verweise gelten nur für die separate Astro-Landing-App; im Angular-Frontend bleibt Angular Material 3 mit SCSS- und Token-Schicht verbindlich.
