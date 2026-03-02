# UI-Dokumentation Einstieg

## Zweck
Verbindliche UI-Standards für arsnova.eu (Angular Material 3). Startpunkt für alle UI-Änderungen.

## Reihenfolge für die Arbeit
1. ADR: `docs/architecture/decisions/0005-use-angular-material-design.md`
2. Umsetzung: `STYLEGUIDE.md`, `TOKENS.md`
3. Vor Merge: `PR-CHECKLIST-UI.md`

---

## Dokumente in diesem Ordner

| Datei | Inhalt |
|-------|--------|
| **STYLEGUIDE.md** | Components, Layout, Theming – konkrete Umsetzung |
| **TOKENS.md** | Erlaubte Tokens, Einführung neuer Tokens |
| **PR-CHECKLIST-UI.md** | Verbindliche Review-Kriterien vor Freigabe |
| **DESIGN-AUDIT.md** | Aktuelles Design-Audit (ADR 0005, Tokens, Overrides, Layout, A11y) |
| **DOD-AUDIT-REPORT.md** | Material Design 3 / ADR-0005-Audit (Tailwind, Tokens, Overrides) |
| **BACKLOG-DESIGN-COMPLIANCE.md** | Backlog-DoD & Epic-6 (Theming, A11y) vs. Umsetzung |
| **FINAL-DESIGN-DOD-AUDIT.md** | Snapshot: Design + DoD + Epic-6 + Startseite (Zusammenfassung) |
| **HOME-M3-COMPLIANCE.md** | Startseite – M3-Typografie, Elevation, Bewertung |
| **STARTSEITE-BACKLOG-CHECK.md** | Startseite vs. Backlog – welche Stories/Features sichtbar |
| **LIGHTHOUSE-PERFORMANCE.md** | Performance: Production-Build, Fonts/Icons, SPA-Serve, robots.txt |
| **LIGHTHOUSE-ANALYSIS.md** | Lighthouse-Ergebnisse (Performance, Best Practices, SEO) und Optimierungen |

---

## Verbindlichkeit
Alle UI-PRs in `apps/frontend` halten diese Regeln ein. Ausnahmen nur mit Review, Zeitlimit und Rückbauplan.  
ADR-Grundlage: `docs/architecture/decisions/0005-use-angular-material-design.md`

## DoD Quick Check (UI)
- Kein Tailwind; Tokens statt hardcoded Farben/Typo/Shape/Elevation
- Keine fragilen Material-DOM-Overrides
- Light/Dark, Fokus/Hover/Disabled/Error geprüft
- 320px ohne horizontales Scrollen: `npm run check:viewport` (apps/frontend)
- Lighthouse Accessibility ≥ 90: `npm run lighthouse:a11y` (apps/frontend)
- `PR-CHECKLIST-UI.md` abgearbeitet
