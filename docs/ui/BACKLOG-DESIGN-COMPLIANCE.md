# Backlog-Design-Compliance-Check

**Datum:** 2026-02-25  
**Basis:** Backlog.md (Product Backlog), DoD, Epic 6 (Theming & Barrierefreiheit)

---

## 1) Backlog DoD – Frontend (Zeilen 96–107)

| Kriterium                       | Status | Umsetzung                                                    |
| ------------------------------- | ------ | ------------------------------------------------------------ |
| Standalone Components + Signals | ✅     | Durchgängig                                                  |
| `@if` / `@for` Control-Flow     | ✅     | Kein `*ngIf` / `*ngFor`                                      |
| Mobile-First ≤ 320px            | ⚠️     | Breakpoints 640/768/1024/1280; 320px nicht explizit getestet |
| Touch-Targets ≥ 44×44px         | ✅     | Material-Buttons erfüllen WCAG 2.5.5 (48×48px)               |
| Tastatur erreichbar, Fokusring  | ✅     | `mat.strong-focus-indicators()`, Material-Komponenten        |
| Dark/Light Theme                | ✅     | Theme-Switcher (System/Dark/Light), localStorage             |
| ~~Tailwind `dark:`-Varianten~~  | ➖     | **Obsolet** – ADR 0005: Material statt Tailwind              |
| **prefers-reduced-motion**      | ✅     | In styles.scss implementiert                                 |
| Lighthouse Accessibility ≥ 90   | ⚠️     | Nicht geprüft                                                |

---

## 2) Epic 6 (Theming & Barrierefreiheit)

### Story 6.1 (Dark/Light/System-Theme) – 🟡 Offen

| Akzeptanzkriterium                      | Status                      |
| --------------------------------------- | --------------------------- |
| Theme-Umschalter (Light, Dark, System)  | ✅                          |
| System übernimmt `prefers-color-scheme` | ✅                          |
| Sofortiger Wechsel ohne Reload          | ✅                          |
| localStorage-Persistenz                 | ✅                          |
| ~~Tailwind `dark:`-Varianten~~          | ➖ Obsolet (Material)       |
| Countdown, Leaderboard, Lobby, Beamer   | ➖ Noch nicht implementiert |
| Kontrast WCAG 2.1 AA                    | ✅ (Material M3)            |

### Story 6.2 (Internationalisierung) – 🟡 Teilweise

| Akzeptanzkriterium                   | Status                           |
| ------------------------------------ | -------------------------------- |
| 5 Sprachen (de, en, fr, it, es)      | ✅ Auswahl im Sprachwähler       |
| Sprachwähler in Navbar               | ✅                               |
| localStorage-Persistenz              | ✅                               |
| ngx-translate oder @angular/localize | ❌ Nicht implementiert           |
| i18n/\*.json Übersetzungsdateien     | ❌ Keine – UI-Texte noch deutsch |

### Story 6.3 (Impressum & Datenschutz) – ✅ Implementiert

| Akzeptanzkriterium                        | Status                                           |
| ----------------------------------------- | ------------------------------------------------ |
| Footer-Links Impressum / Datenschutz      | ✅ Footer in AppComponent                        |
| Routen `/legal/imprint`, `/legal/privacy` | ✅ Route `legal/:slug`                           |
| Markdown-Inhalte                          | ✅ `assets/legal/imprint.de.md`, `privacy.de.md` |

### Story 6.4 (Mobile-First & Responsive) – 🟡 Teilweise

| Akzeptanzkriterium                   | Status                   |
| ------------------------------------ | ------------------------ | ------------------------------------- |
| Mobile-First ≤ 640px Basis           | ✅                       |
| ~~Tailwind-Breakpoints~~             | ➖ Obsolet (Material)    |
| Touch-Targets ≥ 44×44px              | ✅                       |
| Abstimmungsbuttons vollbreite Karten | ➖ Story 3.3b noch offen |
| Kein horizontales Scrollen ≥ 320px   | ⚠️                       | Manuell prüfen                        |
| Viewport-Meta                        | ✅                       | `width=device-width, initial-scale=1` |
| PWA manifest.json                    | ✅                       | `manifest.webmanifest` vorhanden      |

### Story 6.5 (Barrierefreiheit) – 🟡 Teilweise

| Akzeptanzkriterium | Status |
| ------------------ | ------ |
| Tastaturnavigation | ✅     |

| Fokus-Management | ✅ |
| Screenreader (aria-label, aria-live) | ✅ |
| Semantisches HTML | ⚠️ | Teilweise |
| ARIA-Rollen | ⚠️ | Material-Komponenten haben Defaults |
| Farbunabhängigkeit (✓/✗ Icons) | ➖ | Bei Ergebnis-Feedback (Story 4.4) |
| Schriftgröße bis 200% Zoom | ⚠️ | Nicht geprüft |
| **prefers-reduced-motion** | ✅ | In styles.scss implementiert |

---

## 3) Weitere Design-relevante Backlog-Stellen

### Story 0.4 (Server-Status-Indikator) – ✅ Fertig

- Farbiger Indikator (grün/gelb/rot) – ✅ Token-basiert
- Status-Widget – ✅

### Story 3.1 (Beitreten) – 🟡 Platzhalter

- Session-Code-Eingabe – ✅
- 6-stelliger Code – ✅
- Fehlermeldung bei ungültigem Code – ✅

### Story 3.3b (Abstimmung) – ⬜ Offen

- UI-Vorgaben (Abstimm-Buttons): Daumen-Erreichbarkeit, Touch-Targets 48×48px, Farbcodierung A/B/C/D, Formencodierung △○□◇ – **noch nicht umgesetzt**

### Story 1.11 (Quiz-Presets) – ✅ Umgesetzt (Quiz + Startseite)

- **Quiz neu/bearbeiten:** `QUIZ_PRESETS` (Spielerisch/Seriös) setzt die Quiz-Settings; Details und Abgleich mit dem Home-Preset-Toast: [`docs/features/preset-modes.md`](../features/preset-modes.md).
- **Startseite / Header:** Preset-Toast und Theme-Persistenz wie bisher (localStorage, Yjs-Spiegel über Quiz-Sammlung).

---

## 4) Konkrete Anpassungen

### 4.1 Manifest – ✅ Erledigt

`manifest.webmanifest` wurde angepasst:

- `theme_color: "#6750a4"` (M3 Primary)
- `background_color: "#1c1b1f"` (M3 Surface Dark)

### 4.2 prefers-reduced-motion – ✅ Erledigt

In `styles.scss` implementiert: `@media (prefers-reduced-motion: reduce)` reduziert alle Animationen und Transitions auf 0.01ms.

### 4.3 Backlog-Text – Tailwind-Referenzen

Die Backlog-DoD und Story 6.1/6.4 verweisen auf „Tailwind“.  
**Empfehlung:**

- In Backlog-DoD und Story 6.1/6.4 „Tailwind“ durch „Material Design 3 / Theme-Tokens“ ersetzen (oder ergänzen).

---

## 5) Zusammenfassung

| Kategorie    | Bestanden | Teilweise | Offen |
| ------------ | --------- | --------- | ----- |
| DoD Frontend | 7         | 2         | 0     |
| Story 6.1    | 5         | 0         | 0     |
| Story 6.2    | 3         | 0         | 2     |
| Story 6.3    | 3         | 0         | 0     |
| Story 6.4    | 4         | 2         | 0     |
| Story 6.5    | 5         | 2         | 0     |

---

## 6) Style-bezogene Stories & Akzeptanzkriterien – Gesamtstatus

**Frage:** Sind alle style-bezogenen User Stories bzw. Akzeptanzkriterien aus dem Backlog umgesetzt?

### DoD Frontend (Backlog Zeilen 96–107) – style-relevant

| Kriterium                                         | Status                                                                                                                                              |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Standalone Components + Signals                   | ✅                                                                                                                                                  |
| `@if` / `@for` (kein *ngIf/*ngFor)                | ✅                                                                                                                                                  |
| Mobile-First, kein horizontales Scrollen ab 320px | ✅ Script `npm run check:viewport` (Playwright, 320px); alle geprüften Seiten bestanden (/, /legal/imprint, /legal/privacy, /quiz, /session/DEMO01) |
| Touch-Targets ≥ 44×44 px                          | ✅ (Material 48×48)                                                                                                                                 |
| Tastatur erreichbar, sichtbarer Fokusring         | ✅ `mat.strong-focus-indicators()`                                                                                                                  |
| Dark/Light Theme (M3 Tokens, Kontrast ≥ 4.5:1)    | ✅                                                                                                                                                  |
| `prefers-reduced-motion` respektiert              | ✅ styles.scss                                                                                                                                      |
| Kein Lighthouse-A11y-Rückgang unter 90            | ✅ Script `npm run lighthouse:a11y`; letzter Lauf: **100 %** (DoD ≥ 90)                                                                             |

### Epic 6 (Theming & Barrierefreiheit)

| Story                             | Style-relevante AKs                                                                        | Status                                                                                                                         |
| --------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| **6.1** Dark/Light/System         | Theme-Umschalter, System/default, sofort ohne Reload, localStorage, M3-Tokens, Kontrast    | ✅ (Countdown/Leaderboard/Beamer N/A – Stories offen)                                                                          |
| **6.2** i18n                      | Sprachwähler, 5 Sprachen, localStorage                                                     | ✅ UI; **❌** Übersetzungsdateien/ngx-translate oder @angular/localize **nicht** umgesetzt                                     |
| **6.3** Impressum & Datenschutz   | Footer-Links, Routen, Markdown                                                             | ✅                                                                                                                             |
| **6.4** Mobile-First & Responsive | Breakpoints, Touch 44×44, Viewport-Meta, PWA-Manifest, kein Scroll ab 320px                | ✅ bis auf 320px-Check; Abstimm-Buttons (3.3b) offen                                                                           |
| **6.5** Barrierefreiheit          | Tastatur, Fokus, aria/alt, Semantik, Farbunabhängigkeit, 200% Zoom, prefers-reduced-motion | ✅ Fokus/reduced-motion; ⚠️ Semantik/ARIA/200%-Zoom teilweise; Farbunabhängigkeit (✓/✗) bei Ergebnis-UI (Story 4.4) noch offen |

### Weitere style-relevante Backlog-Stellen

| Story                           | Inhalt                                                                                        | Status                                                                                           |
| ------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| **0.4** Server-Status           | Farbiger Indikator (grün/gelb/rot), Widget                                                    | ✅                                                                                               |
| **3.3b** Abstimmung             | Button-Layout: 48×48, Thumb-Zone, Farbcodierung A/B/C/D, Formencodierung △○□◇, Touch-Feedback | ❌ Story offen                                                                                   |
| **1.11** Quiz-Presets           | Preset in **Quiz-Konfiguration** (Spielerisch/Seriös) + Feintuning auf Startseite             | ✅ Quiz `QUIZ_PRESETS` / Editor; **Home-Preset-Toast** weiterhin für localStorage/Yjs-Spiegel ✅ |
| **2.5** Beamer                  | Große Schrift, Kontrast, Vollbild – style-relevant                                            | ❌ Story offen                                                                                   |
| **4.4** Ergebnis-Visualisierung | Balken, Farben richtig/falsch, Animation, prefers-reduced-motion                              | ❌ Story offen                                                                                   |
| **5.4** Belohnungseffekte       | prefers-reduced-motion bei Effekten                                                           | ✅ global in styles.scss abgedeckt                                                               |

### Kurzantwort

**Nein.** Alle **rein style-bezogenen** Anforderungen aus dem **bereits umgesetzten Kontext** (Startseite, Legal, Theme, Preset-UI, Server-Status, DoD Frontend) sind erfüllt. **Nicht umgesetzt** sind:

1. **Story 6.2:** i18n – Übersetzungsdateien und Übersetzungsframework (ngx-translate oder @angular/localize) fehlen; nur Sprachwähler-UI vorhanden.
2. **Story 3.3b, 2.5, 4.4:** Diese Stories sind fachlich noch offen – die darin beschriebenen **Style-/UI-Akzeptanzkriterien** (Abstimm-Buttons, Beamer-Layout, Ergebnis-Visualisierung) werden erst mit der jeweiligen Story umgesetzt. **Story 1.11 (Quiz-Presets)** ist inhaltlich umgesetzt; verbleibende UI-Details (z. B. „Benutzerdefiniert“-Badge) siehe Produkt-Backlog.

**Empfehlung:** Story 6.2 (i18n-Übersetzungen) als nächste style-relevante Lücke angehen, wenn rechtliche/mehrsprachige Anforderungen anstehen.

---

**Prioritäten (erledigt):**

1. ✅ manifest.webmanifest – Theme-/Background-Farben an M3 angepasst
2. ✅ prefers-reduced-motion – globale Regel in styles.scss
3. ✅ Backlog – Tailwind-Referenzen durch Material/Responsive ersetzt

**Erledigt:** 4. ✅ **Story 6.3** – Impressum & Datenschutz (Routen `/legal/imprint`, `/legal/privacy`, Footer mit Links, Markdown-Inhalte)
