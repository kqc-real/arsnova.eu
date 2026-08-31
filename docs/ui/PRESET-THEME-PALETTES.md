# Preset × Theme – Paletten-Übersicht

Welche Designfarben (M3-Paletten) in welcher Kombination genutzt werden und wie sie ungefähr aussehen.

## Kombinationen (4)

| Preset          | Theme  | Primary (Palette)        | Tertiary (Palette) | Charakter                                                  |
| --------------- | ------ | ------------------------ | ------------------ | ---------------------------------------------------------- |
| **Seriös**      | Hell   | Azure + EU-Blau-Override | Cyan               | Primary/CTA = Logo-Blau `#002395`                          |
| **Seriös**      | Dunkel | Azure + EU-Blau-Override | Cyan               | Primary-Container = Logo-Blau `#002395`; Primary `#b4c4ff` |
| **Spielerisch** | Hell   | Magenta                  | Violet             | Pink + Violett                                             |
| **Spielerisch** | Dunkel | Magenta                  | Violet             | Gleiche Paletten, hellere Töne auf dunklem Grund           |

Die **Paletten** wechseln nur mit dem **Preset** (Seriös vs. Spielerisch).  
**Hell/Dunkel** wählt nur andere **Töne** aus derselben Palette (M3 berechnet Kontrast automatisch).

Preset und Theme sind lokale Browser-Entscheidungen. Ein Host-Preset setzt in Live-Sessions nicht die Palette oder Hell/Dunkel-Wahl von Join-, Vote- oder Present-Clients.

---

## Seriös (Azure + Cyan)

- **Primary:** `mat.$azure-palette` – Blau (von kräftigem Blau bis helles Azur).
- **Tertiary:** `mat.$cyan-palette` – Cyan/Türkis (von dunkel bis hell).

Typische sichtbare Farben (aus der Palette, Töne 40/50 für Hell, 80 für Dunkel):

| Rolle    | Hell (Beispiel)       | Dunkel (Beispiel)        |
| -------- | --------------------- | ------------------------ |
| Primary  | `#002395` (EU-Blau)   | `#b4c4ff` (EU-Blau hell) |
| Tertiary | `#006a6a` / `#008585` | `#00dddd`                |

---

## Spielerisch (Magenta + Violet)

- **Primary:** `mat.$magenta-palette` – Magenta/Pink.
- **Tertiary:** `mat.$violet-palette` – Violett.

Typische sichtbare Farben:

| Rolle    | Hell (Beispiel)       | Dunkel (Beispiel) |
| -------- | --------------------- | ----------------- |
| Primary  | `#a900a9` / `#d200d2` | `#ffabf3`         |
| Tertiary | `#7d00fa` / `#944aff` | `#d5baff`         |

---

## Visuelle Vorschau

Zum Ansehen der Farbflächen: **`docs/ui/palette-preview.html`** im Browser öffnen.  
Die Datei zeigt für alle 4 Kombinationen Primary- und Tertiary-Farben als Flächen (Hell/Dunkel mit den obigen Beispiel-Hex-Werten).

---

## Code-Stelle

Definition in **`apps/frontend/src/styles.scss`**:

- **Seriös (Default):** `html` → `primary: mat.$azure-palette`, `tertiary: mat.$cyan-palette`.
- **Seriös (Light):** Azure bleibt die Basispalette; `html.light:not(.preset-playful)` setzt Primary auf `--app-eu-blue`, damit gefüllte CTAs zum Brand-SVG passen.
- **Seriös (Dark):** Azure bleibt die Basispalette; `html.dark:not(.preset-playful)` setzt Primary-Container auf `--app-eu-blue` und Primary auf `--app-eu-blue-on-dark`, damit Icons zum Brand-SVG passen.
- **Spielerisch:** `html.preset-playful` → `primary: mat.$magenta-palette`, `tertiary: mat.$violet-palette`.

Theme (Hell/Dunkel) wird über `html.light` / `html.dark` und `color-scheme` gesteuert; die Paletten bleiben pro Preset gleich.
