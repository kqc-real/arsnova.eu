# Design-Audit: arsnova.eu Frontend

**Datum:** 2026-02-25  
**Basis:** ADR 0005, STYLEGUIDE.md, TOKENS.md, PR-CHECKLIST-UI.md

---

## 1) Tailwind & Styling-Strategie

| Kriterium | Status | Details |
|-----------|--------|---------|
| Kein Tailwind in `apps/frontend` | ✅ Bestanden | Keine Tailwind-Klassen, -Configs oder -Utilities gefunden |
| Kein Tailwind im Repo (Ausnahme) | ✅ Dokumentiert | `apps/landing` (Astro) nutzt Tailwind – in ADR 0005 mit Scope, Dauer, Rückbauplan dokumentiert |

---

## 2) Angular Material Komponenten

| Kriterium | Status | Details |
|-----------|--------|---------|
| Material als Standard für interaktive UI | ✅ Bestanden | mat-button, mat-card, mat-form-field, mat-button-toggle, mat-icon, mat-chip-set etc. in Home, Legal, Quiz, Session, Server-Status |
| Eigenkomponenten nur wo nötig | ✅ Bestanden | Server-Status-Widget, Code-Slots, Preset-Toast etc. nutzen Tokens und fügen sich ins Theme ein |

---

## 3) Tokens (Farben, Typografie, Shape, Elevation)

| Kriterium | Status | Details |
|-----------|--------|---------|
| Farben aus Tokens | ✅ Bestanden | Keine hardcoded Hex/RGB in Feature-SCSS; `--mat-sys-*` und `--app-*` in Verwendung |
| Typografie aus Tokens | ✅ Bestanden | M3-Type-Scale (display, headline, title, body, label) über Tokens; fachliche Ausnahmen (Code-Anzeige, Monospace) begründet |
| Shape / Elevation aus Tokens | ✅ Bestanden | `--mat-sys-corner-*`, `--mat-sys-level*`; App-Tokens mappen auf System-Tokens |
| App-Tokens in styles.scss | ✅ Bestanden | `--app-color-*`, `--app-bg-root`, `--app-shadow-accent`; einzig `--app-status-healthy` mit Hex (light-dark) – in TOKENS.md/ADR dokumentiert |

---

## 4) Override-Policy

| Kriterium | Status | Details |
|-----------|--------|---------|
| Keine fragilen Material-DOM-Overrides | ⚠️ Eine Ausnahme | **Home:** `.mat-button-toggle` / `.mat-button-toggle-checked` für transparente Theme/Preset-Toggles. Offizielle Override-APIs decken transparenten Look im Playful/Dark-Modus nicht zuverlässig ab. Farben weiterhin tokenbasiert (`color-mix(..., var(--mat-sys-on-surface))`, `var(--mat-sys-primary)`). |
| Kein `::ng-deep` gegen Material | ✅ Bestanden | Kein `::ng-deep` für Material-Komponenten |
| Legal-Seite `:deep()` | ✅ Erlaubt | `:deep()` nur für **dynamisch gerenderten Markdown-Inhalt** (h1, h2, p, a, ul, li) – keine Material-Interna. Token-basierte Typo/Farben. |
| Anpassungen über offizielle APIs | ✅ Bestanden | `mat.theme()`, `mat.card-overrides()`, `mat.button-overrides()`, `mat.button-toggle-overrides()` in styles.scss |

**Empfehlung:** Die Home-Button-Toggle-Ausnahme in ADR 0005 oder TOKENS.md als „dokumentierte Ausnahme“ mit kurzer Begründung und Rückbauplan (z. B. „bis Override-API transparente Toggles unterstützt“) festhalten, falls noch nicht geschehen.

---

## 5) Layout und SCSS-Patterns

| Kriterium | Status | Details |
|-----------|--------|---------|
| Zentrale Layout-Patterns | ✅ Bestanden | `l-page`, `l-section`, `l-stack`, `l-grid`, `l-cluster`, `l-inset` in styles.scss und in Home, Legal, Quiz, Session genutzt |
| Spacing konsistent | ✅ Bestanden | Pattern-Gaps und rem-Skala; keine Einmal-Hacks |
| Struktur vs. Semantik getrennt | ✅ Bestanden | Layout-Klassen für Struktur; Tokens für Farben/Typo/Elevation |

---

## 6) Theme-Foundation

| Kriterium | Status | Details |
|-----------|--------|---------|
| Globales `mat.theme()` auf `html` | ✅ Bestanden | styles.scss, inkl. Serious (Default) und Playful-Preset |
| Light/Dark über color-scheme | ✅ Bestanden | `html.dark` / `html.light`; `color-scheme: light dark` |
| Preset (Serious/Playful) | ✅ Bestanden | `html.preset-playful` mit eigener Palette, Typo (Nunito), Button/Card-Shape-Overrides |
| theme-color in index.html | ✅ Ausnahme | Hex-Werte in meta theme-color – in ADR 0005 dokumentiert (Browser-Limitation) |

---

## 7) Accessibility und States

| Kriterium | Status | Details |
|-----------|--------|---------|
| `mat.strong-focus-indicators()` | ✅ Bestanden | In styles.scss global aktiviert |
| Fokuszustand sichtbar | ✅ Bestanden | Material-Komponenten + focus-visible bei Custom-Elementen; frühere outline-Entfernungen als A11y-Fix zurückgenommen |
| Light/Dark manuell prüfbar | ✅ Bestanden | Theme-Switcher auf der Startseite |
| Disabled/Error/Hover | ⚠️ Manuell | Beitreten-Button Disabled, Join-Error-Anzeige – weiterhin manuell testen bei Änderungen |

---

## 8) Dokumentation

| Kriterium | Status | Details |
|-----------|--------|---------|
| TOKENS.md aktuell | ✅ Bestanden | App-Tokens, Preset, theme-color-Ausnahme beschrieben |
| ADR 0005 Ausnahmen | ✅ Bestanden | Landing Tailwind, theme-color meta |
| PR-Checkliste vorhanden | ✅ Bestanden | PR-CHECKLIST-UI.md mit allen relevanten Punkten |

---

## Zusammenfassung

| Kategorie | Bestanden | Mit dokumentierter Ausnahme | Manuell / Empfehlung |
|-----------|-----------|-----------------------------|------------------------|
| Tailwind | ✅ | ✅ (Landing) | – |
| Material-Komponenten | ✅ | – | – |
| Tokens | ✅ | ✅ (status-healthy, theme-color) | – |
| Overrides | ✅ | ⚠️ Home Button-Toggle | In ADR/TOKENS explizit dokumentieren |
| Layout/SCSS | ✅ | – | – |
| Theme | ✅ | ✅ (theme-color) | – |
| A11y/States | ✅ | – | Disabled/Error weiter manuell prüfen |
| Doku | ✅ | – | – |

**Gesamtbewertung:** **Konform** mit ADR 0005 und Styleguide. Alle Abweichungen sind bekannt und größtenteils dokumentiert; einzige offene Empfehlung: Home-Button-Toggle-Override formal als Ausnahme in ADR 0005 oder TOKENS.md aufnehmen.

---

## Nächste Schritte (optional)

- **Ausnahme dokumentieren:** Home `.mat-button-toggle`-Selektoren in ADR 0005 „Dokumentierte Ausnahmen“ oder in TOKENS.md mit Scope (Home, Theme/Preset-Toggles), Begründung und Rückbauplan eintragen.
- **A11y-Check:** Bei nächster UI-Story gezielt Disabled-, Error- und Fokus-States durchgehen und ggf. in PR-CHECKLIST-UI.md abhaken.
- **Lighthouse/SEO:** Siehe `LIGHTHOUSE-ANALYSIS.md` und `LIGHTHOUSE-PERFORMANCE.md` für Performance und Best Practices.

---

**Verwandte Dokumente:** DOD-AUDIT-REPORT.md, BACKLOG-DESIGN-COMPLIANCE.md, HOME-M3-COMPLIANCE.md, PR-CHECKLIST-UI.md
