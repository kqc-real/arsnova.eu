# Preset-Toggle auf Mobile (Recherche)

## Aktueller Stand

- **Desktop-Toolbar (≥ 840 px):** Preset, Theme und Sprache in der Header-Zeile.
- **Kompakte Toolbar (< 840 px, Phone + Tablet-Portrait):** icon-only Preset-Button (`celebration` / `work`) öffnet dasselbe Hamburger-Menü wie der Menu-Button. Beschriftung nur im `aria-label`. Umschalten bleibt im ausgeklappten Bereich (`top-toolbar__mobile`).
- **Hero:** kein zweiter Preset-Toggle. Die Hero-Karte bleibt kompakt, damit die Dozierenden-Sektion auf schmalen Displays im ersten Viewport anschneidet.

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
  - **Mobile:** Zuerst nur der Hamburger-Button; Preset/Theme/Sprache erschienen **nur** im ausklappbaren Menü (`top-toolbar__mobile`).

Der **sichtbare** Preset-Toggle im Hero existiert seit diesem Commit auf Mobile **nicht mehr**.

## Warum war der Toggle im Hero eingeführt worden?

Laut Kontext: Damit Nutzer die Preset-Option **wahrnehmen**, statt sie nur unter dem More/Hamburger-Icon zu verstecken.

## Auffindbarkeit ohne Hero-Toggle

Statt den Hero wieder zu füllen, zeigt die Toolbar den aktuellen Modus als Icon. Der Button öffnet das bestehende Menü; Hosts erkennen Spielerisch/Seriös ohne Text in der schmalen Zeile.
