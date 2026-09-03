# Token-Konventionen (Angular Material 3)

**Stand:** 2026-09-03 — abgeglichen mit `apps/frontend/src/styles.scss`, `apps/frontend/src/styles/playful-inner-chrome.scss`, `apps/frontend/src/app/shared/server-status-help-dialog/server-status-help-dialog.component.scss`, [STYLEGUIDE.md](STYLEGUIDE.md) und Angular Material 21.2.

## Ziel

Dieses Dokument beschreibt, wie Tokens in arsnova.eu definiert, genutzt und erweitert werden. Es verhindert Design-Drift und sichert eine konsistente Material-3-Umsetzung.

## Token-Ebenen

### 1) System-Tokens (Quelle der Wahrheit)

- Prefix: `--mat-sys-*`
- Herkunft: Angular Material Theme (`mat.theme(...)`) in `apps/frontend/src/styles.scss`
- Beispiele:
  - Farbe: `--mat-sys-primary`, `--mat-sys-surface`, `--mat-sys-on-surface`
  - Typografie: `--mat-sys-body-medium`, `--mat-sys-title-large`
  - Shape: `--mat-sys-corner-medium`, `--mat-sys-corner-large`, `--mat-sys-corner-extra-large`
  - Elevation: `--mat-sys-level1`, `--mat-sys-level3`

### 2) App-Semantik-Tokens

- Prefix: `--app-*` für App-Semantik und Layout-Konstanten
- Prefix: `--arsnova-*` für produktsemantische Visualisierungsfarben, die nicht einfach Primary/Tertiary sind
- Definition: global in `:root` oder bewusst komponentenspezifisch scoped
- Regel: App-Tokens mappen bevorzugt auf `--mat-sys-*`; feste `light-dark(...)`-Werte sind nur für dokumentierte Semantik erlaubt.

Aktuell globale Tokens in `styles.scss`:

| Token                          | Zweck                                                     | Quelle / Regel                                                       |
| ------------------------------ | --------------------------------------------------------- | -------------------------------------------------------------------- |
| `--app-color-success-bg`       | Erfolgshintergrund                                        | `--mat-sys-secondary-container`                                      |
| `--app-color-success-fg`       | Text/Icon auf Erfolgshintergrund                          | `--mat-sys-on-secondary-container`                                   |
| `--app-color-danger-bg`        | Fehler-/Gefahrhintergrund                                 | `--mat-sys-error-container`                                          |
| `--app-color-danger-fg`        | Text/Icon auf Fehler-/Gefahrhintergrund                   | `--mat-sys-on-error-container`                                       |
| `--app-color-info-bg`          | Infofläche                                                | `--mat-sys-tertiary-container`                                       |
| `--app-color-info-fg`          | Text/Icon auf Infofläche                                  | `--mat-sys-on-tertiary-container`                                    |
| `--app-color-warning-bg`       | Warn-/Hinweisfläche                                       | `--mat-sys-surface-variant`                                          |
| `--app-color-warning-fg`       | Text/Icon auf Warn-/Hinweisfläche                         | `--mat-sys-on-surface-variant`                                       |
| `--app-status-healthy`         | Grüner Betriebsstatus (Dots, Legend, Last-Badge)          | dokumentierte `light-dark(...)`-Ausnahme                             |
| `--app-status-busy`            | Gelb/Amber für Last-/Busy-Zustand (Dots, Legend, Badge)   | dokumentierte `light-dark(...)`-Ausnahme                             |
| `--app-rating-star`            | Bewertungssterne                                          | dokumentierte `light-dark(...)`-Ausnahme                             |
| `--app-eu-blue`                | Brand-SVG Europa-Blau                                     | `#002395`, Brand-Ausnahme                                            |
| `--app-eu-blue-dark`           | dunkleres Brand-Blau                                      | `#001a75`, Brand-Ausnahme                                            |
| `--app-eu-yellow`              | Brand-SVG Stern                                           | `#ffcc00`, Brand-Ausnahme                                            |
| `--app-eu-on-primary`          | Text/Icon auf EU-Blau-CTAs                                | `#ffffff`, nur Seriös + Light                                        |
| `--app-eu-blue-on-dark`        | helles EU-Blau für Icons auf Dark                         | `#b4c4ff`, nur Seriös + Dark                                         |
| `--arsnova-bar-correct`        | Richtig-/Erfolgsbalken in Auswertungen                    | dokumentierte `light-dark(...)`-Ausnahme                             |
| `--arsnova-bar-correct-on`     | Kontrasttext auf `--arsnova-bar-correct`                  | dokumentierte `light-dark(...)`-Ausnahme                             |
| `--arsnova-bar-wrong`          | Falsch-/Fehlerbalken in Auswertungen                      | dokumentierte `light-dark(...)`-Ausnahme                             |
| `--app-bg-root`                | App-Hintergrund, im Spielerisch-Preset Verlauf            | Standard `--mat-sys-surface`, Preset-Verlauf aus Systemtokens/Mixins |
| `--app-shadow-accent`          | Akzent-Schatten, z. B. Spielerisch                        | Standard `none`, Preset via `color-mix(... --mat-sys-primary ...)`   |
| `--app-shadow-card-playful`    | Zusatzschatten für Spielerisch-Karten                     | nur `html.preset-playful`                                            |
| `--app-shadow-cta-glow`        | dezenter Glow für Spielerisch-CTA (Token, Home ungenutzt) | nur `html.preset-playful`                                            |
| `--app-corner-playful`         | stärker gerundete Spielerisch-Flächen                     | nur `html.preset-playful`                                            |
| `--app-toolbar-max-width`      | maximale Toolbar-/Shell-Breite                            | Layout-Konstante, derzeit `56rem`                                    |
| `--app-live-channel-max-width` | maximale Breite von Host-/Vote-/Feedback-Live-Kanälen     | Layout-Konstante, derzeit `36rem`                                    |
| `--app-live-channel-inline`    | Inline-Padding für Live-Kanäle                            | Layout-Konstante                                                     |
| `--host-mobile-inline`         | Mobile-Inline-Abstand für Host/Vote/Feedback/Join         | Layout-Konstante                                                     |
| `--host-mobile-stack-gap`      | Mobile Stack-Gap in Live-Ansichten                        | Layout-Konstante                                                     |
| `--host-mobile-card-padding`   | Mobile Card-Padding in Live-Ansichten                     | Layout-Konstante                                                     |
| `--host-mobile-toolbar-gap`    | Mobile Abstand zu Toolbar-/Bottom-Actions                 | Layout-Konstante                                                     |
| `--host-mobile-safe-bottom`    | Safe-Area-Offset für mobile Bottom-Actions                | `env(safe-area-inset-bottom)`                                        |
| `--app-qr-size`                | Standardgröße für QR-Flächen                              | Layout-Konstante                                                     |
| `--app-qr-size-compact`        | kompakte QR-Größe                                         | Layout-Konstante                                                     |

Komponentenspezifische Tokens:

| Scope                                      | Tokens                                                                                                                                      | Zweck                                               |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| `.status-help-dialog__history-chart-shell` | `--app-status-chart-grid`, `--app-status-chart-line`, `--app-status-chart-point`, `--app-status-chart-text`, `--app-status-chart-tooltip-*` | Canvas-/Chart-Farben für Server-Status-Historie     |
| Feature-Komponenten                        | lokale `--<feature>-*` Tokens, z. B. Shell-Breiten oder Action-Offsets                                                                      | nur innerhalb der Komponente, nicht als globale API |

### 3) Komponententokens

- Anpassungen für Angular-Material-Komponenten erfolgen über offizielle Override-APIs.
- Erlaubt sind `mat.theme-overrides(...)`, `mat.button-overrides(...)`, `mat.card-overrides(...)`, `mat.button-toggle-overrides(...)` und vergleichbare Material-Mixins.
- Keine direkte Überschreibung interner Klassen/DOM-Strukturen als Normalfall.
- Globales Styling von CDK-/Material-Overlay-Surfaces ist nur mit enger `panelClass` / `backdropClass` erlaubt.

## Theme-Konfiguration

Das globale Theme in `styles.scss` nutzt `mat.theme()` mit:

| Preset      | CSS-Scope             | Primary-Palette        | Tertiary-Palette      |
| ----------- | --------------------- | ---------------------- | --------------------- |
| Seriös      | `html`                | `mat.$azure-palette`   | `mat.$cyan-palette`   |
| Spielerisch | `html.preset-playful` | `mat.$magenta-palette` | `mat.$violet-palette` |

Light/Dark wird über `color-scheme` gesteuert:

- Default der App ohne gespeicherte Präferenz: Dark (`html.dark`)
- `html` ohne Klasse (Option **System**): `color-scheme: light dark` (folgt Systemeinstellung)
- `html.dark`: `color-scheme: dark`
- `html.light`: `color-scheme: light`

Preset-Umschaltung läuft über die CSS-Klasse `html.preset-playful`.

## Erlaubte Styling-Quellen

- `mat.theme(...)` für Theme-Definition
- Material Override-Mixins für Komponenten
- `--mat-sys-*` für Farbe, Typografie, Shape und Elevation
- `--app-*` und `--arsnova-*` für dokumentierte App-Semantik
- SCSS-Patterns für Layout und app-spezifische Strukturen
- enge `panelClass` / `backdropClass` für CDK-Overlays und Fullscreen-Tools

## Nicht erlaubt

- hardcoded Hex-/RGB-Farben in Feature-SCSS für Standard-UI-Semantik
- Hex-Fallbacks an `--app-*` / `--arsnova-*` in Feature-SCSS (Token-Definition bleibt zentral)
- direkte Material-DOM-Overrides mit fragilen Selektoren in Feature-SCSS
- `::ng-deep` und `:deep(...)` (deprecated bzw. Piercing; Material-Internals global gescoped, siehe STYLEGUIDE Style-Vertraege)
- `999px`-Radii außer dem dokumentierten Histogram-Stab; `font-weight: 800`
- Token-Bypass durch ad-hoc Inline-Styles
- neue globale Tokens ohne Dokumentation in dieser Datei

## Mapping-Regeln

- Aktionen: `--mat-sys-primary`, `--mat-sys-on-primary`, Varianten über Container-Tokens
- Flächen: `--mat-sys-surface*`, `--mat-sys-on-surface*`
- Fehler: `--mat-sys-error*`
- Erfolg/Info/Warnung: vorhandene `--app-color-*` Tokens nutzen
- Bewertungs-/Richtig-/Falsch-Diagramme: `--app-rating-star` und `--arsnova-bar-*`
- Typografie: `--mat-sys-title-*`, `--mat-sys-body-*`, `--mat-sys-label-*`
- Shape/Elevation: `--mat-sys-corner-*`, `--mat-sys-level*`

## Einführung neuer Tokens

1. Bedarf beschreiben (fachlich + visuell).
2. Prüfen, ob bestehender `--mat-sys-*` oder `--app-*` Token ausreicht.
3. Token so eng wie möglich scopen: Komponenten-Scope vor globalem `:root`.
4. Falls global nötig, neuen `--app-*` oder `--arsnova-*` Token einführen.
5. Mapping dokumentieren (Zweck, Quelle, erlaubte Ausnahmen).
6. In mindestens einem echten Screen validieren: Light, Dark, Spielerisch/Seriös, Hover, Focus, Disabled und Mobile.

## Beispiel: Banner-Semantik

```scss
.banner--info {
  background: var(--app-color-info-bg);
  color: var(--app-color-info-fg);
  border: 1px solid var(--mat-sys-outline-variant);
}

.banner--error {
  background: var(--app-color-danger-bg);
  color: var(--app-color-danger-fg);
}
```

## Technische Ausnahmen

### Semantische Status- und Auswertungsfarben

Diese Tokens nutzen bewusst feste `light-dark(...)`-Werte statt Primary/Tertiary, weil ihre Bedeutung unabhängig vom Preset bleiben muss:

- `--app-status-healthy`
- `--app-status-busy`
- `--app-rating-star`
- `--arsnova-bar-correct`
- `--arsnova-bar-correct-on`
- `--arsnova-bar-wrong`

Neue feste Farbausnahmen müssen hier ergänzt und begründet werden.

### Server-Status-Chart

Die Chart-Tokens sind komponentenspezifisch in `.status-help-dialog__history-chart-shell` definiert, weil Canvas-Rendering keine CSS-Kaskade im gezeichneten Inhalt hat. Der Chart-Renderer liest die Tokens zur Laufzeit per `getComputedStyle`.

### `meta theme-color` (`index.html`)

Die HTML-Meta `theme-color` unterstützt keine CSS Custom Properties. Daher werden feste Hex-Werte verwendet:

- Light: `#f5f5f5` (Nähe M3 surface)
- Dark: `#1c1b1f` (Nähe M3 surface)

Diese Ausnahme ist technisch bedingt und dokumentiert in ADR 0005.

### Brand-Farben

`--app-eu-blue`, `--app-eu-blue-dark` und `--app-eu-yellow` sind produktsemantische Markenfarben im Brand-SVG (Home und Top-Toolbar).

**Ausnahme Seriös:** Azure-Primary wirkt cyan-stichig neben dem Logo. Deshalb überschreibt `html.light:not(.preset-playful)` (und System-Light ohne `.dark`) Primary auf `--app-eu-blue` und On-Primary auf `--app-eu-on-primary`, damit gefüllte CTAs zur Brand-Farbe passen. In Dark setzt `html.dark:not(.preset-playful)` (und System-Dark ohne `.light`) Primary-Container auf `--app-eu-blue` und Primary auf `--app-eu-blue-on-dark` (`#b4c4ff`), damit Karten-Icon-Kacheln und Toolbar-Icons zur Brand-Farbe passen. Spielerisch bleibt unverändert.

## Responsive Breakpoints (Material Design 3)

| Breakpoint | Viewport     | Verwendung                                                  |
| ---------- | ------------ | ----------------------------------------------------------- |
| Compact    | `< 600px`    | Smartphone (Portrait/Landscape), einspaltig, Bottom-Actions |
| Medium     | `600–839px`  | Tablet Portrait, erste zweispaltige Layouts                 |
| Expanded   | `840–1199px` | Tablet Landscape, kleiner Desktop                           |
| Large      | `≥ 1200px`   | Desktop, 3-spaltige Grids und volle Layouts                 |

Quelle: M3 Window Size Classes.

## Referenzen

- ADR: `docs/architecture/decisions/0005-use-angular-material-design.md`
- Styleguide: `docs/ui/STYLEGUIDE.md`
- PR-Checkliste: `docs/ui/PR-CHECKLIST-UI.md`
- Globale Tokens: `apps/frontend/src/styles.scss`
- Spielerisch-Chrome: `apps/frontend/src/styles/playful-inner-chrome.scss`
