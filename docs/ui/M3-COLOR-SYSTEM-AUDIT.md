# M3 Color System – Audit (arsnova.eu)

Abgleich mit dem [Material Design 3 Color System](https://m3.material.io/styles/color/system/overview) (Stand: Überblick, How the system works, Color roles). Prüfstand: Codebase + TOKENS.md.

---

## 1. Umgesetzt / korrekt

| M3-Vorgabe | Umsetzung |
|------------|-----------|
| **Color roles tokenisiert nutzen** | Durchgängig `--mat-sys-*` (primary, on-primary, surface, surface-container, on-surface, on-surface-variant, error, outline-variant, inverse-*). |
| **Primäre Akzente** | Primary + Tertiary in `mat.theme()` (Seriös: Azure/Cyan, Spielerisch: Magenta/Violet). Secondary wird von Angular Material aus Primary abgeleitet. |
| **Surface-Hierarchie** | surface, surface-container, surface-container-high, surface-container-low, surface-container-lowest genutzt; body-Hintergrund über `--app-bg-root` → surface bzw. Gradient (Spielerisch). |
| **On-Farben nur auf passendem Grund** | on-primary auf primary, on-surface auf surface/surface-container, on-surface-variant für geringere Betonung, on-error-container auf error-container. |
| **Dividers / Trennlinien** | M3: „Outline für Dividers vermeiden, Outline-Variant nutzen.“ → Überall `border-*-*: 1px solid var(--mat-sys-outline-variant)` für Trennlinien (Footer, Toolbar, Preset-Toast, Legal, Home). |
| **Karten-Ränder** | M3: „Outline nicht für Komponenten mit mehreren Elementen (z. B. Karten).“ → Karten/Bereiche nutzen outline-variant oder keine Outline. |
| **Error-Rollen** | error, error-container, on-error-container für Fehler-Banner und -Texte. M3: Error ist statisch (ändert sich nicht bei Dynamic Color). |
| **Inverse für Snackbars** | inverse-surface, inverse-on-surface, inverse-primary für Preset- und Install-Snackbar. Entspricht M3 („Snackbar: inverse surface, inverse on surface, inverse primary für Text-Button“). |
| **Focus-Ring** | outline mit primary (nicht Outline-Rolle) für Fokus sichtbar; M3 Outline-Rolle ist für sichtbare Grenzen (z. B. Textfeld), nicht für Focus. |
| **Statisches Baseline-Schema** | Kein Dynamic Color; hand-picked Paletten (Azure/Cyan, Magenta/Violet). M3: „Baseline static scheme“ ist vorgesehen, Wechsel zu Dynamic Color später möglich. |

---

## 2. Anpassungen / Prüfempfehlungen

### 2.1 Outline vs. Outline-Variant (Server-Status-Widget)

- **M3:**  
  - **Outline:** „Important boundaries“ (z. B. Textfeld-Rand).  
  - **Outline-Variant:** „Decorative elements“, geringere Betonung, wenn anderer Inhalt 4,5:1-Kontrast liefert.
- **Aktuell:** Im Server-Status-Widget werden **neutraler Status** (Icon, Dot, muted Text) mit `var(--mat-sys-outline)` gefärbt (Farbe + Hintergrund).
- **Empfehlung:** Für dekorative/neutrale Status-Indikatoren und dezenten Text eher **outline-variant** verwenden, damit „outline“ für echte Grenzen (z. B. Eingabefelder) reserviert bleibt.

**Datei:** `apps/frontend/src/app/shared/server-status-widget/server-status-widget.component.scss`  
- ~~Zeilen 31, 35, 47, 81: `color: var(--mat-sys-outline)`~~ → **umgesetzt:** `--mat-sys-outline-variant`.  
- ~~Zeilen 55, 71: `background: var(--mat-sys-outline)` für neutrale Dots~~ → **umgesetzt:** `--mat-sys-outline-variant`.

### 2.2 Warning-Hintergrund: surface-variant

- **M3:** In den Color Roles werden explizit u. a. aufgeführt: surface, surface container (und -high, -low, -lowest, -highest), on surface, on surface variant. Ein eigenes **surface variant** als Flächenrolle erscheint in der M3-Dokumentation nicht als zentrale Rolle („on surface variant“ ist die Text-/Icon-Farbe).
- **Aktuell:** `--app-color-warning-bg: var(--mat-sys-surface-variant)` in `styles.scss`.
- **Empfehlung:** Prüfen, ob Angular Material `--mat-sys-surface-variant` als Fläche bereitstellt und ob das für „Warnung“ semantisch passt. Falls M3-konform nur Surface-Container-Rollen genutzt werden sollen, Alternative z. B. `surface-container-high` oder `surface-container` für Warn-Hintergründe.

### 2.3 Surface-Container-Highest

- **M3:** Fünf Stufen: surface-container-highest, -high, (default), -low, -lowest.
- **Aktuell:** highest wird nirgends genutzt (high, default, low, lowest schon).
- **Bewertung:** Kein Fehler; nur Hinweis, falls ihr später stärkere Hierarchie (z. B. Modals, App-Bars) explizit mit „highest“ abbilden wollt.

---

## 3. Bewusst nicht umgesetzt / optional

| Thema | M3 | arsnova.eu |
|-------|----|------------|
| **Dynamic Color** | Option: Nutzer-Wallpaper oder Content als Quelle. | Statisches Baseline-Schema mit zwei Presets; Wechsel zu Dynamic Color möglich, wenn gewünscht. |
| **Kontraststufen (Standard / Medium / High)** | Drei Stufen für bessere Zugänglichkeit (u. a. May 2025), tokenisiert. | Keine UI-Option für Nutzer; Standard-Kontrast. Optional: Prüfen, ob Angular Material Kontrast-Varianten unterstützt und ob wir sie anbinden wollen. |
| **Fixed Accent Colors** | Primär/Sekundär/Tertiär „fixed“ (gleicher Ton in Hell/Dunkel). | Nicht genutzt. M3: „Most products won’t need these add-on roles.“ |
| **Surface Bright / Surface Dim** | Add-on Surface-Rollen für maximale/minimale Helligkeit. | Nicht genutzt. Optional für spezielle Layouts. |
| **Secondary explizit im Theme** | M3 hat Primary, Secondary, Tertiary. | Nur primary + tertiary in `mat.theme()`; Secondary wird von Angular Material abgeleitet. Ausreichend; bei Bedarf secondary explizit setzen. |

---

## 4. Kurzreferenz M3 Color Roles (aus dem Audit)

- **Akzente:** primary, on-primary, primary-container, on-primary-container; secondary/on-secondary, secondary-container/on-secondary-container; tertiary/on-tertiary, tertiary-container/on-tertiary-container.  
- **Surface:** surface, on-surface, on-surface-variant; surface-container, surface-container-high/low/lowest/highest.  
- **Error:** error, on-error, error-container, on-error-container.  
- **Inverse:** inverse-surface, inverse-on-surface, inverse-primary.  
- **Outline:** outline (wichtige Grenzen), outline-variant (dekorativ, Trennlinien).  
- **Paarung:** Immer passende „on“-Farbe auf Container/Füllung nutzen (z. B. on-primary nur auf primary).

---

## 5. Nächste Schritte (optional)

1. Server-Status-Widget: neutrale Indikatoren und muted Text auf `--mat-sys-outline-variant` umstellen (siehe 2.1).  
2. Warning-Token: Klärung/Konsistenz von `surface-variant` vs. Surface-Container-Rollen (siehe 2.2).  
3. Bei Barrierefreiheits-Fokus: Prüfen, ob AM3 Kontraststufen (medium/high) angeboten werden und ob wir sie im Theme/UI anbinden wollen.

Referenzen: [M3 Color System Overview](https://m3.material.io/styles/color/system/overview), [How the system works](https://m3.material.io/styles/color/system/how-the-system-works), [Color roles](https://m3.material.io/m3/pages/color-roles).
