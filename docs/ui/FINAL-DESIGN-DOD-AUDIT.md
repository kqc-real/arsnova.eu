# Finaler Design- & DoD-Audit

**Stand:** 2026-07-19

**Basis:** [Backlog.md](../../Backlog.md), ADR-0005, ADR-0008, [STYLEGUIDE.md](STYLEGUIDE.md), [TOKENS.md](TOKENS.md), [BACKLOG-DESIGN-COMPLIANCE.md](BACKLOG-DESIGN-COMPLIANCE.md). Der frühere Stand vom 2026-02-25 ist fachlich überholt.

---

## 1. Design-System

| Kriterium                        | Status | Details                                                                                 |
| -------------------------------- | ------ | --------------------------------------------------------------------------------------- |
| Kein Tailwind in `apps/frontend` | ✅     | Tailwind bleibt auf `apps/landing` beschränkt.                                          |
| Material als Standard für UI     | ✅     | Angular Material 3 ist die Standardbasis für Buttons, Inputs, Dialoge, Menüs und Icons. |
| Farben aus Tokens                | ✅     | App- und Statusfarben sind in `TOKENS.md` dokumentiert; harte Ausnahmen begründen.      |
| Typografie aus Tokens            | ✅     | Material-Typografie und App-Ausnahmen nach Styleguide.                                  |
| Shape/Elevation aus Tokens       | ✅     | Material- und App-Tokens sind verbindlich.                                              |
| Layout-Patterns                  | ✅     | Gemeinsame Layout- und Shared-Styles statt lokaler Einmallösungen.                      |
| Keine fragilen Overrides         | ✅     | Keine neuen `::ng-deep`- oder Material-DOM-Hacks ohne dokumentierte Ausnahme.           |
| Theme Foundation                 | ✅     | Light/Dark/System, Presets und `prefers-color-scheme` sind umgesetzt.                   |
| `prefers-reduced-motion`         | ✅     | Bewegte UI muss reduzierte Alternativen anbieten.                                       |

---

## 2. DoD Frontend

| Kriterium                       | Status | Umsetzung                                                                                 |
| ------------------------------- | ------ | ----------------------------------------------------------------------------------------- |
| Standalone Components + Signals | ✅     | Standard in `apps/frontend`.                                                              |
| `@if` / `@for` Control Flow     | ✅     | Zielpfad für neue Templates.                                                              |
| Mobile-First ab 320 px          | ✅     | `npm run check:viewport -w @arsnova/frontend`.                                            |
| Touch-Targets ≥ 44 x 44 px      | ✅     | Material-Controls und Custom-Controls prüfen.                                             |
| Tastatur erreichbar, Fokusring  | ✅     | Material-Fokus plus Custom-Fokus; sichtbare Fokuszustände bleiben Pflicht.                |
| Theme und Presets               | ✅     | Light/Dark/System plus `Seriös`/`Spielerisch`.                                            |
| i18n                            | ✅     | Fünf Locale-Builds per Angular-localize/XLF; frühere Deutsch-only-Annahmen sind obsolet.  |
| Automatisierte A11y-Gates       | ✅     | Template-Lint, axe, Reflow/Fokus/Zielgrößen und Lighthouse-Einzelaudits sind verbindlich. |

---

## 3. Epic 6

| Story                       | Status | Einordnung                                                                  |
| --------------------------- | ------ | --------------------------------------------------------------------------- |
| **6.1** Theme               | ✅     | umgesetzt.                                                                  |
| **6.2** i18n                | ✅     | umgesetzt mit `de`, `en`, `fr`, `es`, `it`.                                 |
| **6.3** Legal               | ✅     | umgesetzt über lokalisierte Markdown-Assets.                                |
| **6.4** Mobile/PWA          | ✅     | umgesetzt; 320-px- und PWA-Checks bleiben Reviewpflicht.                    |
| **6.5** Barrierefreiheit    | 🔨     | technische Umsetzung validiert; manuelle AT-/Zoom-/OS-Abnahme bleibt offen. |
| **6.6** Thinking-Aloud / UX | ⬜     | offene methodische Testreihe mit Umsetzung der Befunde.                     |

---

## 4. Bekannte Ausnahmen

| Ausnahme                       | Grund                                                           | Referenz              |
| ------------------------------ | --------------------------------------------------------------- | --------------------- |
| `index.html` `theme-color`     | HTML-Meta-Tags unterstützen keine CSS-Variablen                 | ADR-0005, `TOKENS.md` |
| Status-/Bewertungsfarben       | Semantische Ampel-, Stern- und Ergebnisfarben                   | `TOKENS.md`           |
| Landing Tailwind               | Separate Astro-App, kein Angular-Frontend                       | ADR-0005              |
| Fullscreen- und Lightbox-Flows | Fachlich begründete Abweichungen von Standard-Dialog-Containern | `STYLEGUIDE.md`       |

---

## 5. Zusammenfassung

Die Angular-Frontend-UI ist nach aktuellem Stand konform zur Material-3-/Token-Strategie. Offene Punkte sind keine überholten Basislücken mehr, sondern fortlaufende Qualitätsaufgaben: Barrierefreiheitsaudit (6.5), Thinking-Aloud-Testreihe (6.6), Word-Cloud-Ausbau (1.14a) und Review-Nachweise pro PR.
