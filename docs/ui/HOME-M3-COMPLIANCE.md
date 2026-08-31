# Startseite – Material Design 3 Compliance

**Stand:** 2026-05-31

> Fokusaudit zur Startseite. Für verbindliche aktuelle UI-Regeln gelten [STYLEGUIDE.md](STYLEGUIDE.md), [TOKENS.md](TOKENS.md) und [PR-CHECKLIST-UI.md](PR-CHECKLIST-UI.md).

## Bereits M3-konform

| Bereich              | Status | Details                                                                                                          |
| -------------------- | ------ | ---------------------------------------------------------------------------------------------------------------- |
| **Theme & Tokens**   | ✅     | `mat.theme()`, `--mat-sys-*` (Farben, Typo, Shape, Elevation), light/dark, Preset „Spielerisch“ mit Nunito       |
| **Komponenten**      | ✅     | mat-card, mat-button, mat-form-field, mat-input, mat-button-toggle, mat-chip-set, mat-menu, mat-icon durchgängig |
| **Typografie-Skala** | ✅     | display-small (Card-Titel), headline-small (Hero), title-large (Brand), body-small, label-small                  |
| **Farben**           | ✅     | Keine Hardcoded-Hex; Surface-Container für Header/Cards, Primary für Akzente                                     |
| **Shape**            | ✅     | corner-extra-large (Cards), corner-large (Toast), corner-small (Icon)                                            |
| **Elevation**        | ✅     | level1 (Header), level3 (Toast), level4 (Cards) – M3-konform                                                     |
| **Layout**           | ✅     | l-page (56rem, Startseite ab 960px 78rem), Grid für Main/Grid, responsive Breakpoints                            |
| **A11y**             | ✅     | strong-focus-indicators, prefers-reduced-motion, semantisches HTML                                               |
| **State**            | ✅     | Buttons/Toggles mit Material-State-Layers; Disabled/Error-States                                                 |

## Empfohlene Anpassungen (modernes M3)

1. **Hero-Zeile** – Stärkere Hierarchie: Headline-Medium (oder Display-Small) für den Hauptsatz, damit die Startseite klar als „Landing“ wirkt.
2. **Trust-Badges** – Als Label-Medium für bessere Lesbarkeit und klare Zweitrangigkeit.
3. **Card-Elevation** – Leicht reduzieren (level2 statt level4) für den aktuellen „flacheren“ M3-Look, sofern gewünscht.
4. **Button-Toggle-Overrides** – Bereits dokumentierte Ausnahme (transparenter Header); bei künftigen Material-Updates prüfen, ob offizielle APIs ausreichen.

## Fazit

Die Startseite ist **auf der Höhe von Material Design 3**: Token-basiert, konsistente Komponenten, klare Hierarchie, Preset-Unterstützung. Die genannten Anpassungen sind optionale Verfeinerungen für einen noch stärkeren „Editorial“-Charakter (M3 Typography/Display).
