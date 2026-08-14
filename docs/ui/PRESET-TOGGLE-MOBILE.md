# Preset-Toggle auf Mobile (Recherche)

## Aktueller Stand

- **Startseite (Mobile):** Preset-Toggle im Hero (`home-hero-preset-mobile`), ohne Menü-Klick.
- **Hamburger-Menü:** nur Theme und Sprache. Kein Preset-Umschalter.
- **Desktop-Toolbar:** Preset, Theme und Sprache in der Header-Zeile.

## Wann wurde der sichtbare Preset-Toggle auf Mobile entfernt?

**Commit:** `24890a1`  
**Datum:** 2026-03-04  
**Message:** `feat(ui): Top-Toolbar seitenübergreifend, Hide-on-Scroll, Preset-Snackbar & Styleguide`

## Was war vorher?

- **Home-Seite:** Es gab einen **im Hero-Bereich sichtbaren** Preset-Toggle (Seriös / Spielerisch) nur für Mobile:  
  `<div class="home-hero-preset-mobile">` mit `mat-button-toggle-group`.  
  Damit konnten Nutzer den Stil **ohne** das Hamburger-Menü zu öffnen wahrnehmen und wechseln.
- **Header:** Auf Mobile: Hamburger-Button; beim Öffnen erschienen Preset, Theme und Sprache in einem ausklappbaren Bereich (`home-controls-mobile`). Auf Desktop: Preset/Theme/Sprache direkt in der Header-Zeile.

## Was änderte sich in 24890a1?

- Die Steuerung wurde in eine **seitenübergreifende Top-Toolbar** (`shared/top-toolbar`) verschoben.
- Die **gesamte** alte Home-Header- und Hero-Logik (inkl. `home-hero-preset-mobile` und `presetToastHost`/Snackbar) wurde aus `home.component.html` **entfernt**.
- In der **Top-Toolbar** gibt es seither:
  - **Desktop:** Preset-Toggles sichtbar in der Toolbar.
  - **Mobile:** Nur der Hamburger-Button; Preset/Theme/Sprache erscheinen **nur** im ausklappbaren Menü (`top-toolbar__mobile`).

Der **sichtbare** Preset-Toggle im Hero (ohne Menü-Klick) existiert seit diesem Commit auf Mobile **nicht mehr** – Nutzer müssen das Hamburger-Menü öffnen, um die Preset-Option zu sehen.

## Warum war der Toggle im Hero eingeführt worden?

Laut Kontext: Damit Nutzer die Preset-Option **wahrnehmen**, statt sie nur unter dem More/Hamburger-Icon zu verstecken.

## Wiederherstellung

Um das ursprüngliche Verhalten wiederherzustellen, wurde der Block **„Stil wählen“ (Preset-Toggle)** im Hero der Home-Seite **nur auf Mobile** wieder eingebaut (gleiche Klasse `home-hero-preset-mobile`, Styles in `home.component.scss` waren erhalten). Die Top-Toolbar bleibt unverändert; auf der Startseite ist der Preset zusätzlich im Hero sichtbar (nur mobile).
