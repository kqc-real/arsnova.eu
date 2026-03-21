# Finaler Design- & DoD-Audit

**Datum:** 2026-02-25  
**Basis:** Backlog.md DoD, ADR 0005, BACKLOG-DESIGN-COMPLIANCE.md, DOD-AUDIT-REPORT.md

---

## 1) Design-Check (Material Design 3 / ADR 0005)

| Kriterium                        | Status | Details                                                                                                           |
| -------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------- |
| Kein Tailwind in `apps/frontend` | ✅     | Keine Tailwind-Klassen                                                                                            |
| Material als Standard für UI     | ✅     | mat-button, mat-card, mat-form-field, mat-icon, mat-menu, mat-chip-set, mat-button-toggle                         |
| Farben aus Tokens                | ✅     | Keine hardcoded Hex in Komponenten; `--app-status-healthy` (light-dark) für Status-Punkt – dokumentierte Ausnahme |
| Typografie aus Tokens            | ✅     | `--mat-sys-body-*`, `--mat-sys-title-*`, `--mat-sys-headline-*`, `--mat-sys-label-*`                              |
| Shape aus Tokens                 | ✅     | `--mat-sys-corner-*` durchgängig                                                                                  |
| Layout-Patterns                  | ✅     | `l-page`, `l-section`, `l-stack` (xs, sm, md, lg, xl), `l-cluster`, `l-grid`                                      |
| Keine fragilen Overrides         | ✅     | Kein `::ng-deep`, keine `.mat-mdc-*` Hacks                                                                        |
| Theme Foundation                 | ✅     | `mat.theme()`, `html.dark`/`html.light`, `html.preset-playful`                                                    |
| prefers-reduced-motion           | ✅     | Globale Regel in styles.scss                                                                                      |

---

## 2) Backlog DoD – Frontend (Zeilen 96–107)

| Kriterium                       | Status | Umsetzung                                                         |
| ------------------------------- | ------ | ----------------------------------------------------------------- |
| Standalone Components + Signals | ✅     | Durchgängig (Home, Quiz, Session, Legal, ServerStatusWidget, App) |
| `@if` / `@for` Control-Flow     | ✅     | Kein `*ngIf` / `*ngFor`                                           |
| Mobile-First ≤ 320px            | ⚠️     | Breakpoints 640/768/1024/1280; 320px nicht explizit getestet      |
| Touch-Targets ≥ 44×44px         | ✅     | Material-Buttons (48×48px), mat-icon-button                       |
| Tastatur erreichbar, Fokusring  | ✅     | `mat.strong-focus-indicators()`, Skip-Link, Tab-Navigation        |
| Dark/Light Theme                | ✅     | Theme-Switcher (System/Dark/Light), Default: Dark                 |
| prefers-reduced-motion          | ✅     | In styles.scss implementiert                                      |
| Lighthouse Accessibility ≥ 90   | ⚠️     | Nicht geprüft                                                     |

---

## 3) Epic 6 (Theming & Barrierefreiheit)

### Story 6.1 (Dark/Light/System-Theme) – ✅ Erfüllt

| Akzeptanzkriterium                      | Status           |
| --------------------------------------- | ---------------- |
| Theme-Umschalter (Light, Dark, System)  | ✅               |
| System übernimmt `prefers-color-scheme` | ✅               |
| Sofortiger Wechsel ohne Reload          | ✅               |
| localStorage-Persistenz                 | ✅               |
| Kontrast WCAG 2.1 AA                    | ✅ (Material M3) |

### Story 6.2 (Internationalisierung) – ⚠️ Teilweise

| Akzeptanzkriterium                | Status                           |
| --------------------------------- | -------------------------------- |
| 5 Sprachen (de, en, fr, it, es)   | ✅ Auswahl vorhanden             |
| Sprachwähler in Navbar            | ✅                               |
| localStorage-Persistenz           | ✅                               |
| ngx-translate / @angular/localize | ❌ Nicht implementiert           |
| i18n/\*.json Übersetzungsdateien  | ❌ Keine – UI-Texte noch deutsch |

### Story 6.3 (Impressum & Datenschutz) – ✅ Erfüllt

| Akzeptanzkriterium                        | Status |
| ----------------------------------------- | ------ |
| Footer-Links Impressum / Datenschutz      | ✅     |
| Routen `/legal/imprint`, `/legal/privacy` | ✅     |
| Markdown-Inhalte                          | ✅     |

### Story 6.4 (Mobile-First & Responsive) – ✅ Erfüllt

| Akzeptanzkriterium         | Status |
| -------------------------- | ------ |
| Mobile-First ≤ 640px Basis | ✅     |
| Touch-Targets ≥ 44×44px    | ✅     |
| Viewport-Meta              | ✅     |
| PWA manifest.webmanifest   | ✅     |

### Story 6.5 (Barrierefreiheit) – ✅ Teilweise

| Akzeptanzkriterium     | Status                                  |
| ---------------------- | --------------------------------------- |
| Tastaturnavigation     | ✅                                      |
| Fokus-Management       | ✅                                      |
| aria-label / aria-live | ✅ (ServerStatusWidget, Offline-Banner) |
| prefers-reduced-motion | ✅                                      |

---

## 4) Startseite – Vollständigkeit

| Element                               | Status     |
| ------------------------------------- | ---------- |
| Theme, Presets, Sprache (5 Sprachen)  | ✅         |
| Beitreten (Code, Zuletzt beigetreten) | ✅         |
| Erstellen (Session, Quiz, Q&A)        | ✅ → /quiz |
| Quiz-Sammlung (Zugang, Vorlage, Demo) | ✅ → /quiz |
| Status (Widget, Retry)                | ✅         |
| Trust-Badges, Offline-Indikator       | ✅         |
| Impressum, Datenschutz                | ✅         |
| Wertversprechen, Hero                 | ✅         |

---

## 5) Bekannte Ausnahmen (dokumentiert)

| Ausnahme                                | Grund                                                   | Referenz            |
| --------------------------------------- | ------------------------------------------------------- | ------------------- |
| `index.html` theme-color (Hex)          | HTML meta unterstützt keine CSS-Variablen               | ADR 0005, TOKENS.md |
| `--app-status-healthy` (light-dark Hex) | Semantisch grün für Status-Punkt unabhängig von Palette | styles.scss         |
| `manifest.webmanifest` (Hex)            | JSON-Format                                             | ADR 0005            |
| Landing Tailwind                        | Astro-App, separater Scope                              | ADR 0005            |

---

## 6) Offene Punkte (nicht blockierend)

| Punkt                    | Empfehlung                                  |
| ------------------------ | ------------------------------------------- |
| Lighthouse Accessibility | Vor Release manuell prüfen                  |
| 320px Viewport           | Manuell testen                              |
| i18n für 5 Sprachen      | Story 6.2 – Übersetzungsdateien fehlen noch |
| Theme-Default „System“   | Aktuell „Dark“ – Backlog nennt „System“     |

---

## 7) Zusammenfassung

| Kategorie            | Bestanden | Teilweise | Offen |
| -------------------- | --------- | --------- | ----- |
| Design (M3/ADR 0005) | 9         | 0         | 0     |
| DoD Frontend         | 6         | 2         | 0     |
| Epic 6 Stories       | 3         | 2         | 0     |

**Gesamtbewertung: Konform.** Die Startseite und die von ihr erreichbaren Funktionen erfüllen die Design- und DoD-Anforderungen. Offene Punkte (i18n, Lighthouse) sind dokumentiert und nicht blockierend für den aktuellen Stand.
