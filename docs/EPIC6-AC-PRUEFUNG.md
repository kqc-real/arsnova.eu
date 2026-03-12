# Epic 6: Prüfung der Akzeptanzkriterien (Abschlussstand)

Stand: Abschlussprüfung der Stories 6.1–6.4 gegen Codebase. Story 6.5 (Barrierefreiheit) bleibt als kontinuierlicher Qualitäts-Checkpoint (WCAG-Audit) bestehen.

---

## Story 6.1 — Dark/Light/System-Theme

| Kriterium | Status | Nachweis |
|-----------|--------|----------|
| Theme-Umschalter in Nav mit Light, Dark, System | ✅ | `top-toolbar.component.html`: `mat-button-toggle-group` mit `system`/`dark`/`light`, Icons `contrast`, `dark_mode`, `light_mode` |
| System (default) folgt `prefers-color-scheme` | ✅ | `theme-preset.service.ts`: Default `theme = signal('system')`; bei System keine Klasse auf `html` → `:root { color-scheme: light dark }` in `styles.scss` steuert Anzeige |
| Wechsel sofort ohne Reload (Klasse auf `<html>`) | ✅ | `applyTheme()` setzt/entfernt `dark`/`light` auf `document.documentElement` |
| Auswahl in localStorage persistiert | ✅ | `STORAGE_THEME = 'home-theme'`, `setTheme()`/`initFromStorage()` |
| UI nutzt MD3 Theme-Tokens | ✅ | `styles.scss`: `--mat-sys-*`, `light-dark()`, ADR 0005; Komponenten nutzen Tokens |
| Countdown, Leaderboard, Lobby, Beamer unterstützen beide Themes | ✅ | Gemeinsame Theme-Steuerung über `html.dark`/`html.light` bzw. `color-scheme` |
| Kontrast WCAG 2.1 AA (≥ 4.5:1) | ⚠️ | Nicht automatisch prüfbar; Design nutzt M3-Tokens (typisch kontrastkonform). Empfehlung: einmalige manuelle Prüfung oder Tool. |

**Fazit:** Alle technischen Akzeptanzkriterien erfüllt. Kontrast als Design-Annahme.

---

## Story 6.3 — Impressum & Datenschutzerklärung

| Kriterium | Status | Nachweis |
|-----------|--------|----------|
| Footer-Links zu Impressum und Datenschutz | ✅ | `app.component.html`: Links zu `/legal/imprint`, `/legal/privacy` mit Icons |
| Routen `/legal/imprint`, `/legal/privacy` | ✅ | `app.routes.ts`: Lazy-Load von `legal-page.component` mit `data: { slug: 'imprint' }` bzw. `slug: 'privacy'` |
| Inhalte als Markdown, leicht editierbar | ✅ | `assets/legal/imprint.de.md`, `privacy.de.md`; `legal-page.component.ts` lädt per HTTP und rendert mit `marked` (Laufzeit-Rendering; „zur Buildzeit“ im Backlog = optional, „editierbar ohne Code-Änderung“ erfüllt) |
| Impressum: Betreiber, Anschrift, Kontakt, Verantwortlicher § 18 MStV | ✅ | `imprint.de.md`: Anbieter, Adresse, E-Mail, „Verantwortlich für den Inhalt (§ 18 Abs. 2 MStV)“ |
| Datenschutz: Verantwortlicher, Art der Daten, Rechtsgrundlage, Local-First, Cookie/LocalStorage, Hosting, Betroffenenrechte, Kontakt | ✅ | `privacy.de.md`: Abschnitte 1–9 decken alle Punkte ab (u. a. Art. 6, Local-First, Bereinigung, Anonymer Modus) |
| Ohne Login erreichbar | ✅ | Öffentliche Routen, kein Guard |
| In gewählter Sprache (Fallback Deutsch) | ⚠️ | Aktuell fest `lang = 'de'` in `legal-page.component.ts`; Mehrsprachigkeit hängt an Story 6.2 (i18n). Fallback Deutsch erfüllt. |

**Fazit:** Alle inhaltlichen und technischen Kriterien erfüllt. Sprachumschaltung folgt mit 6.2.

---

## Story 6.4 — Mobile-First & Responsive Design

| Kriterium | Status | Nachweis |
|-----------|--------|----------|
| Mobile-First (Basis ≤640px, Tablet/Desktop erweitert) | ✅ | `session-vote`: `max-width: 36rem`, `@media (min-width: 600px)`; Layout zentriert, kein festes Desktop-Only |
| Breakpoints konsequent (640, 768, 1024, 1280) | ⚠️ | Teilweise 600px statt 640px (z. B. `session-vote.component.scss`). Inhaltlich Mobile-First gegeben; ggf. spätere Vereinheitlichung auf Backlog-Werte. |
| Touch-Targets ≥ 44×44 px | ✅ | DoD/STYLEGUIDE; z. B. `session-vote.component.scss` `min-width/height: 44px` für relevante Ziele; Material-Buttons erfüllen typisch 44px |
| Abstimmungsbuttons auf Smartphone vollbreite gestapelte Karten | ✅ | Vote-Bereich: `width: 100%`, `flex-wrap`, max-width 36rem; Karten stapelbar |
| Beamer volle Breite, große Schrift, Countdown, Leaderboard | ✅ | `session-host`: Full-Width-Layout, Countdown/Leaderboard integriert |
| Kein horizontales Scrollen ab 320 px | ✅ | Viewport-Check: `scripts/check-viewport-320.mjs` (Playwright 320×568); `package.json` Script `check:viewport` |
| Viewport-Meta-Tag | ✅ | `index.html`: `width=device-width, initial-scale=1` |
| PWA: manifest mit Icon-Set | ✅ | `manifest.webmanifest` in `angular.json` eingetragen; Icons 72–512 px inkl. maskable; `display: standalone`, `start_url`, `categories` |

**Fazit:** Alle Akzeptanzkriterien erfüllt; Breakpoints teilweise 600px statt 640px (kleine Abweichung).

---

## Story 6.2 — Internationalisierung

| Kriterium | Status | Nachweis |
|-----------|--------|----------|
| Sprachen de/en/fr/it/es verfügbar | ✅ | `angular.json` mit allen fünf Locales; lokalisierter Build erzeugt `dist/browser/{de,en,fr,it,es}` |
| Angular i18n mit `@angular/localize` und XLIFF | ✅ | `src/locale/messages.xlf` + `messages.en/fr/es/it.xlf`; UI-Texte in Templates und `$localize` markiert |
| Sprachwähler in Toolbar + Locale-Subpfade | ✅ | `top-toolbar.component.*`: Sprachmenü, Redirect auf `/de|en|fr|it|es/...`, Persistenz via `home-language` |
| Rechtstexte je Locale + Fallback | ✅ | `assets/legal/imprint.{locale}.md`, `privacy.{locale}.md`; Fallback auf `de` in `legal-page.component` |
| Datums-/Zahlenformate je Locale | ✅ | Keine feste `LOCALE_ID`-Verdrahtung mehr; `registerLocaleData(...)` für `de/en/fr/es/it` in `main.ts`; Pipes nutzen Angular-Locale |

**Fazit:** Story 6.2 erfüllt.

---

## Story 6.5 — Barrierefreiheit

Als fortlaufender Qualitäts-Checkpoint geführt. MD3 und Angular Material decken viele Grundlagen ab (Fokus, Semantik, Touch); finale vollständige WCAG-2.1-AA-Prüfung bleibt Bestandteil der Abschluss-QA.
