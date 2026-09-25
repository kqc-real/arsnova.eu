<!-- markdownlint-disable MD013 MD022 MD032 -->

# UI Styleguide (Angular Material 3)

**Stand:** 2026-09-21 — abgeglichen mit Angular 21.2, `apps/frontend/src/styles.scss`, `apps/frontend/src/styles/playful-inner-chrome.scss`, den Shared-Styles unter `apps/frontend/src/app/shared/styles/`, [TOKENS.md](TOKENS.md), [PR-CHECKLIST-UI.md](PR-CHECKLIST-UI.md) und `apps/landing/src/styles/landing-theme.css`.

## Ziel und Geltungsbereich

Dieser Styleguide definiert verbindliche UI-Regeln für `apps/frontend` von arsnova.eu.
Ergänzend zur ADR `docs/architecture/decisions/0005-use-angular-material-design.md` beschreibt er die operative Umsetzung im Alltag.

## Grundsaetze

- Angular Material ist der Standard für interaktive UI-Elemente.
- Material 3 ist die visuelle und semantische Grundlage.
- Styling ist tokenbasiert und zentral gesteuert.
- Kein Tailwind in `apps/frontend`.
- Eigenes SCSS ist erlaubt für Layout-Patterns, app-spezifische Strukturen und klar begrenzte globale Overlay-Surfaces.

## Theming und Farbmodus

- Das globale Theme wird auf Root-Ebene (`html`) mit `mat.theme(...)` definiert.
- Standard-Preset **Seriös:** Primary `mat.$azure-palette`, Tertiary `mat.$cyan-palette`. Zusätzlich EU-Blau: in **Light** für Primary/CTAs (`--app-eu-blue` / `--app-eu-on-primary`), in **Dark** für Primary-Container/Icons (`--app-eu-blue` / `--app-eu-blue-on-dark`).
- Preset **Spielerisch:** `html.preset-playful` überschreibt die Palette mit `mat.$magenta-palette` und `mat.$orange-palette` und setzt zusätzliche app-spezifische Surface-/Shadow-Tokens. **Buttons:** Filled-CTAs (`matButton="filled"` / `mat-flat-button`) nutzen **Tertiary** (Orange), Tonal-CTAs **`surface-container-high`**. Magenta/`primary-container` bleibt Flächen und Icons vorbehalten – keine hellrosa CTAs. `color="warn"` bleibt Error. **Textfelder:** Platzhalter `on-surface-variant`, Eingabetext `on-surface`, Outlined-Rand Primary-getönt, Filled-Container `surface-container-high` — keine invers-hellen Native-Flächen. Date/Time-Felder behalten `appearance: auto` und setzen MDC `display: none` am Kalender-Indikator zurück, damit der native Picker auf Desktop und Mobil sichtbar bleibt. Session-Fristen (Zugang/Q&A) nutzen zusätzlich den Material-Datepicker mit farbigen Zellen: wählbar grün (`--arsnova-bar-correct`), nicht wählbar rot (`--mat-sys-error`), aktuelle Auswahl Primary; die Bedeutung steht auch textlich unter dem Feld. **Overlays:** Tooltip, Menü, Select, Autocomplete, Datepicker, Snackbar und alle Standard-Dialoge nutzen Surface-Chrome statt M3-Inverse; die Dialog-Chrome kommt global aus `app-dialog-surface-base` / `app-playful-surface-chrome`. **Flächen:** `color-mix(..., white)` ist kein Surface-Lift; stattdessen `--mat-sys-surface` / `surface-container-lowest`. Die Astro-Landing (`apps/landing`, info.arsnova.eu) folgt demselben Magenta-/Orange-Konzept mit eigenen `--landing-*`-Tokens, ohne Material-Systemtokens.
- `color-scheme` steuert Light/Dark-Verhalten.
- Bei Komponenten gilt: Farben nur aus Tokens, keine ad-hoc Hex-Werte.
- Standard-Hintergrund/Farbe für die App orientiert sich an `--app-bg-root`, `--mat-sys-surface` und `--mat-sys-on-surface`.
- Material Icons sind selbst gehostet und nutzen `font-display: swap`; keine externen Font-Requests einführen.

## Komponentenrichtlinien

- Neue Features verwenden zuerst Angular-Material-Komponenten.
- Eigenkomponenten sind erlaubt, wenn Material funktional nicht reicht.
- Eigene Komponenten müssen dieselben Tokens verwenden wie Material-Komponenten.
- Keine CSS-Selektoren gegen interne Material-DOM-Strukturen in Feature-SCSS.
- `::ng-deep` und `:deep(...)` nicht verwenden (deprecated bzw. Piercing). Weder neu einführen noch bestehende Vorkommen erweitern.
- Material-Internals (Expansion-Header, Tab-Body, MDC-Label, Form-Field-Infix, `innerHTML`-Markdown) nur über **enge globale Scope-Klassen** in `styles.scss` oder offizielle Override-Mixins.
- Shell-/Layout-Regeln außerhalb von `:host` (z. B. Present-Vollfläche) gehören in die App-Shell (`app.component.scss` mit Route-Klasse), nicht in Feature-`::ng-deep`.
- Komponentenanpassungen nur über offizielle Override-APIs.
- Overlay-**Surface-Chrome** (Farbe, Verlauf, Ecke, Elevation) gilt **global** für alle Standard-`MatDialog`-Surfaces, Menüs, Selects, Tooltips, Datepicker und Snackbars. `panelClass` / `backdropClass` steuern nur Layout, Breite, Backdrop und dokumentierte Ausnahmen: Word-Cloud, Markdown-Bild-Lightbox und In-App-Produktfeedback (transparente Träger). Keine panelClass-Whitelist mehr für Playful-Chrome.

## Material-Dialoge: Titelzeile mit Icon (MUSS, Standarddialoge)

- **Einheitliche Gestaltung:** Standard-`MatDialog`-Komponenten im Frontend nutzen für die **Kopfzeile** dieselbe Struktur und Typografie wie der **Bonus-Codes-Dialog** (Icon-Kachel links, Überschrift rechts, optional zweite Zeile). Die Icon-Kachel folgt der Startseite: umrandet, transparent, Primary-Glyph – keine gefuellte `primary-container`-Fliese.
- **Stylesheet:** `apps/frontend/src/app/shared/styles/dialog-title-header.scss` — Klassen `dialog-title-header`, `dialog-title-header__icon`, `dialog-title-header__copy`, `dialog-title-header__heading`, optional `dialog-title-header__sub` und `dialog-title-header__step`.
- **Markup:** `h2` mit `mat-dialog-title` und Klasse `dialog-title-header`; das Icon liegt in `dialog-title-header__icon` mit `mat-icon`, der Text in `dialog-title-header__copy` (Überschrift mindestens in `dialog-title-header__heading`).
- **Einbindung:** Zusätzlich zur Komponenten-SCSS `styleUrls` um diese Datei erweitern (Pfad je nach Ordner, z. B. `../../../shared/styles/dialog-title-header.scss` aus `features/quiz/quiz-list/`).
- **Warnung / Verlassen:** Bestätigungsdialoge mit kritischem Inhalt: Icon-Wrapper mit `dialog-title-header__icon dialog-title-header__icon--warn` (Farbton aus Error-/Error-Container-Tokens).
- **Seiten- und Kartenköpfe:** Für große Seitenköpfe kann dieselbe Struktur mit `dialog-title-header--page` genutzt werden, wenn Icon+Titel semantisch zur Orientierung beitragen.
- **Ausnahmen:** Fullscreen-Arbeitsflächen wie Word-Cloud-Dialoge und die Markdown-Bild-Lightbox nutzen eigene Toolbars/Close-Buttons. Sie müssen über enge `panelClass` / `backdropClass` gestylt, tastaturbedienbar und in der PR-Checkliste als Ausnahme benannt sein. Produktfeedback-Sheets (Post-Session-Karte und In-App-Dialog) nutzen dieselbe Kartenoptik statt `dialog-title-header`; der In-App-Dialog wird über `product-feedback-in-app-dialog-panel` / `product-feedback-in-app-dialog-backdrop` gestylt.
- **Neue Dialoge:** Keine rein textlichen `mat-dialog-title`-Zeilen ohne Icon-Kachel, außer bei den genannten Fullscreen-Tool-Ausnahmen.

## Token-Nutzung

- System-Tokens: `--mat-sys-*`.
- App-Semantik-Tokens (z. B. Erfolg/Warnung/Info) mappen auf System-Tokens.
- Direkte Farbwerte in Feature-SCSS sind nur mit begründeter Ausnahme erlaubt. Zulässige dokumentierte Ausnahmen stehen in [TOKENS.md](TOKENS.md), z. B. Status-/Bewertungsfarben, `meta theme-color` und technisch begrenzte Chart-/Canvas-Fallbacks.

## Typografie

- Typografie folgt der M3-Type-Scale (Display, Headline, Title, Body, Label).
- Für Texte in Komponenten bevorzugt Typo-Tokens wie `--mat-sys-body-medium`.
- Keine freien Font-Größen/Line-Heights ohne Design-System-Bedarf.

## Shape, Elevation, Borders

- Border-Radius erfolgt ueber Shape-Tokens (`--mat-sys-corner-small|medium|large|extra-large|full`).
- Kapseln/Pills/Progress: `--mat-sys-corner-full` – **kein** `999px` (Ausnahme: Histogram-Stab `999px 999px 2px 2px`).
- Harte Rem-Radii (`1.25rem`, `1.35rem`, …) fuer Panels/Buttons/Chips sind nicht erlaubt; Kreis-Dots duerfen `50%` bleiben.
- Schriftgewicht fuer UI-Hierarchie: maximal **700** (kein `font-weight: 800`).
- Schatten/Elevation erfolgt ueber Elevation-Tokens (`--mat-sys-level*`) bzw. dokumentierte Playful-Schatten.
- Linien/Outlines nutzen `--mat-sys-outline` oder `--mat-sys-outline-variant`.
- Produktsemantik wie `--arsnova-bar-*` in Feature-SCSS **ohne Hex-Fallbacks** (`var(--arsnova-bar-correct)`, nicht `var(--arsnova-bar-correct, #2e7d32)`); Fallbacks nur zentral in Token-Definition.

## Layout-Patterns (SCSS)

Erlaubte Pattern-Kategorien:

- Stack: vertikales Spacing zwischen Elementen
- Cluster: horizontale Gruppen mit Umbruch
- Grid: responsives Raster
- Inset: konsistente Innenabstaende
- Section/Page-Container: wiederkehrende Seitenstruktur

Regeln:

- Spacing-Werte zentral definieren, nicht pro Feature neu erfinden.
- Keine Utility-Klassen-Flut; stattdessen wiederverwendbare Pattern-Klassen/Mixins.
- Layout und Component-Skin trennen (Struktur vs. visuelle Semantik).

### Layout-Vorgabe für Inhaltseiten (alle außer Startseite)

- **Root-Container:** Jede Seite (Quiz, Session, Legal, Help, Join, Admin usw.) nutzt als aeusseren Container eine der globalen Layout-Klassen aus `styles.scss`.
- **`.l-page`:** Max-width 56 rem, zentriert, Padding 1,5 rem / 1 rem (responsive 1,5 rem / 2 rem).
- **`.l-section`:** Max-width 42 rem, zentriert; optional in Kombination mit `.l-page` für schmalere Lesebreite (z. B. Quiz-Shell, Session, Admin).
- **`.content-page-layer`:** Für Help, Legal und News-Archiv die shared Content-Page-Struktur aus `content-page-backdrop.scss` nutzen, wenn seitliche Rails/Klickflächen und ein zentriertes Lesepanel gebraucht werden. Overlay-Semantik: Focus Trap im Panel, Escape/Zurück/Backdrop schließen die Seite (Escape nicht bei offenem MatDialog/Lightbox); App-Toolbar und Footer sind auf diesen Routen `inert`. Nach dem Schließen zur Startseite: Fokus zurück auf den auslösenden Footer-Trigger (Hilfe bzw. Mehr); MOTD-Overlay einmal unterdrückt. Dialogtitel bleiben auch im Lade-/Fehlerzustand benannt.
- **News-Archiv gelesen:** Pro Eintrag ein **Toggle** außerhalb des Expansion-Headers:
  **Als gelesen markieren** (`matButton="text"`, Primary) bzw. **Als ungelesen markieren**
  (`undo`-Icon aus dem selbst gehosteten Icon-Subset, Text/Icon `--mat-sys-on-surface-variant`).
  Kein paralleler Status-Text neben der Aktion. Neue Icon-Namen vorab gegen
  `assets/fonts/material-icons.woff2` prüfen (`mark_as_unread` fehlt dort).
  Produktfeedback („arsnova.eu verbessern“) nutzt `insights`; MOTD behält
  `campaign`, Session-Bewertung (4.8) behält `feedback`.
- **Empfehlung:** Einheitlich `<div class="l-page l-section">` als Root der Feature-Komponente (oder `class="<feature>-page l-page"` wie Admin, wenn zusätzliche Feature-Styles nötig sind). So bleibt Abstand zur Toolbar (via `.app-main__content > * > .l-page:first-child`) und Innenabstand konsistent.
- **Startseite:** Bleibt Sonderfall mit eigenem Hero und nutzt `.l-page` ohne `.l-section`. Bis 1199 px stehen die Inhalte in **einer zentrierten Lesespalte mit maximal 40 rem**: Hero, Teilnahme, Rollenwechsel und danach die Aufgaben **Quiz**, **Q&A** und **Blitzlicht**. Ab 1200 px folgen Hero, Host-Einstieg und Host-Raster der **56-rem-Achse der Toolbar**; die drei Host-Karten stehen gleich breit und gleich hoch in einer Zeile. Die zentrierte Teilnahme-Karte behaelt mit maximal 36 rem ihre kompakte Eingabebreite.

### Above the fold auf Mobile (Design-Ziel)

- **Zielbild:** Views und Seiten auf **Mobile** nach Moeglichkeit so gestalten, dass die **Kernansicht ohne vertikales Scrollen** auskommt: Entscheidungsrelevante Infos und die **primaere Aktion** liegen im **sichtbaren Bereich unterhalb der fixierten Top-Toolbar** (Padding `main` beachten).
- **Pattern:** Entspricht **Above the fold** (Wesentliches zuerst im Viewport; weiteres optional per Scroll oder Progressive Disclosure).
- **Umsetzung:** Kompakte Hierarchie, knappe Texte, Sekundaeres einklappen oder auf zweite Ebene verlagern; Layout-Patterns (Stack/Cluster) so waehlen, dass der erste Screen nicht „leer wirkt“, aber auch nicht zwingend gescrollt werden muss, um zu handeln.
- **Ausnahmen:** Bei **langem Fliesstext** (z. B. Legal), **Bearbeitungs- oder Detailansichten** mit viel Inhalt ist Scrollen weiterhin normal und erwuenscht, wenn Lesbarkeit oder Aufgabe es erfordert. Ziel ist **weniger unnötiges Scrollen**, kein absolutes Verbot.

#### Beispiel im Code: Blitzlicht von der Startseite (Standalone-Host)

- **Kontext:** Der kanallose Standalone-Pfad (`FeedbackHostComponent`, Route `feedback/:code`) bleibt im Code, ist auf der Startseite aber nicht mehr erreichbar (Rückbau: Backlog 8.10). Neue Blitzlichter starten sitzungsgebunden und landen im Session-Host.
- **Above-the-fold-Umsetzung:**
  - **Ergebnisbereich zuerst** (CSS `order` im Wrapper): Balken/Titel/Stimmen-Zeile liegen im oberen Viewport; Steueraktionen und Formatwahl folgen in derselben Karte darunter.
  - **QR-Icon** in einer **kompakten Live-Leiste** unterhalb der Ergebnisse (analog Quiz-Live-Kanal): das Icon oeffnet dasselbe **Viewport-Overlay** wie im Kanal Blitzlicht beim Session-Host (`role=dialog`, scrollbarer Vollflaechen-Hintergrund, Schliessen-Button, Hinweis auf schmalen Viewports, „Session-Link kopieren“); das Overlay oeffnet nach dem Laden **einmal automatisch** (wie Lobby-Join beim Session-Host).
  - **Keine doppelte Stimmen-Zeile** in der Leiste (Zaehlung nur im Ergebnisbereich).
  - **Karten-Optik** des Dialogs: globales Styling fuer `feedback-host__join-viewport-overlay__surface.feedback-host__join-menu-panel` in `styles.scss` (gleiche Oberflaeche wie `session-host__join-viewport-overlay__surface`).
- **Referenz-Dateien:** `apps/frontend/src/app/features/feedback/feedback-host.component.{html,scss,ts}`; gemeinsame Join-Karten-Optik in `apps/frontend/src/styles.scss`; Session-Host-Referenz: `session-host__join-viewport-overlay` in `session-host.component.*`.

#### Eingebettet im Session-Host (Tab Blitzlicht)

- **Gleiche Prioritaet wie Standalone:** Im Modifier `feedback-host--embedded` steht der **Ergebnisbereich** (Balken, Titel, Stimmen) per Flexbox-`order` **vor** Format-Chips und Steueraktionen; QR/Beitritt folgen im Anschluss (kein zusaetzlicher Ergebnisblock in der Teilnehmer-Ansicht).
- **Referenz:** `feedback-host.component.scss` (Suche nach `feedback-host--embedded`).

### Leere Zustaende und Listen-Einstieg

- **Quiz-Sammlung:** Kein zusaetzlicher Willkommen- oder Leer-Text unter dem Seiten-`h1` („Deine Quiz-Sammlung“). Der Einstieg ist die Aktionsleiste; ohne eigene Quizzes folgt der Demo-Callout.
- **Reihenfolge (andere Listen):** Kurzer Kontext **vor** der Aktionsleiste, wenn der Screen sonst nur aus CTAs bestünde.
- **Copy:** **Keine Wiederholung** des Seitentitels aus dem Parent (`h1`).
- **Semantik:** Wirkt die Zeile wie eine zweite Ebene unter dem Seiten-`h1`, semantisch **`h2`** verwenden (nicht nur Absatz).
- **Hervorhebung:** Nur ueber M3-Typo-Tokens (z. B. `headline-large` / `headline-medium`) und **`--mat-sys-primary`** – keine Hex-Werte.
- **Abstand:** Optional Modifier-Klasse (z. B. `--lead`) mit **reduziertem `padding-top`**, damit der Block visuell oben ansetzt und Mobile-**Above-the-fold** entlastet.

## Accessibility und Interaktion

- Kontrast und Lesbarkeit müssen in Light und Dark erfüllt sein.
- Fokuszustand muss klar sichtbar sein (bei Bedarf `mat.strong-focus-indicators()`).
- Textlinks verwenden bei `:focus-visible` einen 2-Pixel-Rahmen mit
  `0.25rem` `outline-offset`; kein zusätzliches Padding, damit Textfluss und
  Klickfläche unverändert bleiben.
- Disabled, Error und Hover/Focus-Zustände nur über passende Tokens ausdrücken.
- 320 px Breite ohne horizontales Scrollen ist Pflicht für produktive UI-Flows; für relevante Änderungen `npm run check:viewport -w @arsnova/frontend` nutzen, wenn ein lokaler Server bereitsteht.
- Animationen und Transitions müssen bei `prefers-reduced-motion: reduce` ohne Informationsverlust nutzbar bleiben.

## Verbindliche Lesbarkeitsregeln (MUSS)

- **Text-Rhythmus:** Fuer Fliesstext in Feature-Screens `line-height` mindestens `1.5`; fuer Hint-/Error-Texte mindestens `1.4`.
- **Formular-Abstaende:** Zwischen aufeinanderfolgenden Eingabefeldern mindestens `1rem` vertikaler Abstand; zwischen Feld und Hint/Error mindestens `0.2rem`.
- **Widget-Luftigkeit:** Zwischen erklaerendem Text (`.admin-help`, Hint, Sicherheits-Hinweis) und folgendem interaktiven Element (Phrase-Block, `mat-form-field`, Button-Gruppe) mindestens `0.45rem` vertikaler Abstand; zwischen mehreren Widget-Bloecken in einer Aktion mindestens `0.65rem`.
- **Card-Header-Abstaende:** Zwischen Title und Subtitle mindestens `0.15rem`; zwischen Header und erstem Inhaltselement mindestens `0.4rem`.
- **Label-Lesbarkeit:** Feldlabels duerfen nicht abgeschnitten werden; Umbruch ist erlaubt, aber ohne Silbentrennung (`hyphens: none`).
- **Lange Hinweise:** Lange Hint-/Tooltip-Texte muessen ohne horizontales Scrollen lesbar bleiben (mobil und desktop).

## Formularverhalten bei Fehlern (MUSS)

- **Erster Fehler:** Bei Submit mit ungültigem Formular wird immer zum ersten fehlerhaften Feld gescrollt und fokussiert.
- **Fokus-Reihenfolge:** Reihenfolge folgt der visuellen Reihenfolge im Formular (oben links nach unten rechts).
- **Korrektheitslogik:** Bei fachlichen Fehlern ohne invalides Feld (z. B. fehlende Korrektmarkierung) wird die erste relevante Interaktionsstelle fokussiert.

## Aktionen und Menues (MUSS)

- **Keine Redundanz:** Eine primaere Aktion darf nicht gleichzeitig als sichtbarer CTA und im Overflow-Menue angeboten werden.
- **Overflow-Menue:** Enthaelt nur sekundaere oder seltene Aktionen.
- **CTA-Hierarchie:** Pro Kontext genau eine klare Primaeraktion, weitere Aktionen als tonal/text oder Menue.

## Preview-Vertrag (MUSS)

- **Nicht-interaktiv:** Vorschau-Ansichten sind rein visuell; Eingabeelemente wie Radio/Checkbox duerfen dort nicht direkt auswaehlbar sein.
- **Fluchtlinien:** Auswahlindikatoren in Listen sind linksbuendig ausgerichtet.
- **Render-Paritaet:** Markdown/KaTeX muss in Vorschau, Bearbeiten-Liste und Live-Preview konsistent angezeigt werden.

## Markdown/KaTeX Styling (MUSS)

- **`innerHTML`-Content:** Styles fuer gerendertes Markdown/KaTeX werden global und klar gescoped definiert (z. B. `.quiz-preview-*`, `.quiz-edit-*`, `.session-projection-quiz`, `.admin-question__text`), nicht ueber `::ng-deep` oder `:deep(...)`.
- **Fehlerdarstellung:** `.markdown-katex-error` nutzt Error-Tokens und `body-small`.
- **Typografie:** Absatz-, Listen-, Heading- und Blockquote-Abstaende fuer gerenderten Content sind explizit definiert.
- **Bilder:** Markdown-Bilder mit Lightbox nutzen die shared Directive/Fullscreen-Dialoge. Fullscreen-Surfaces sind bewusst transparent und global über `markdown-image-lightbox-dialog-panel` begrenzt.
- **Bekannte Einschraenkung (vorlaeufig):** Nach Inline-KaTeX (`$...$`) kann ein direkt folgendes Satzzeichen durch Browser-Zeilenumbruch an der HTML-Grenze optisch in die naechste Zeile rutschen (CSS/Unicode-Glue ist dafuer nicht zuverlaessig). **Workaround fuer Autor:innen:** Satzzeichen in die Formel nehmen (z. B. `$\dots.$` oder `\text{.}` am Ende) oder den Satz so formulieren, dass kein Satzzeichen unmittelbar nach `$...$` folgt.

## Fullscreen-Tools: Word Cloud und Bild-Lightbox (MUSS)

- Fullscreen-Dialoge nutzen enge `panelClass` / `backdropClass` statt generischer Material-Overrides.
- Die Surface darf transparent und randlos sein, wenn das Tool selbst die visuelle Fläche trägt.
- Schließen-Button, Tastaturfokus, Scroll-/Overscroll-Verhalten und mobile Toolbar müssen explizit geprüft werden.
- Referenzen: `word-cloud-dialog-panel`, `word-cloud-dialog-backdrop`, `markdown-image-lightbox-dialog-panel`, `markdown-image-lightbox-dialog-backdrop` in `styles.scss`.

## Technische Details und Progressive Disclosure (MUSS)

- **Nutzerfokus zuerst:** Primaransichten zeigen nur entscheidungsrelevante Informationen.
- **Technische IDs/Links:** Nur sekundar, z. B. in aufklappbaren Details (`details/summary`) oder separaten Technikbereichen.

## Locale und Datumsformat (MUSS)

- **Locale:** Frontend nutzt fuer UI-Datum/Zeit standardmaessig `de-DE`.
- **Formatkonsistenz:** US-Formate wie `3/9/26, 8:09 AM` sind in der deutschen UI zu vermeiden.

## Beispielmuster

Tokenbasierte Card-Flaeche:

```scss
.panel {
  background: var(--mat-sys-surface-container);
  color: var(--mat-sys-on-surface);
  border: 1px solid var(--mat-sys-outline-variant);
  border-radius: var(--mat-sys-corner-large);
  box-shadow: var(--mat-sys-level1);
}
```

## Style-Vertraege fuer Erweiterungen (MUSS)

Abgeschlossen mit dem Token-/Chrome-Nachzug (Wellen 1–8). Bei **neuen oder geänderten Surfaces** gelten diese Verträge verbindlich – nicht nur die historische Wellen-Liste unten.

### Dual-Layer: Seriös-Basis + Playful-Chrome

- Feature-SCSS liefert die **Seriös-Basis** (Border, Surface, Layout, A11y).
- Overlay-Chrome (Dialog, Menü, Snackbar) liegt global in `styles.scss`; Karten-Chrome in `playful-inner-chrome.scss` nur unter `html.preset-playful` (Mixins `primary` / `nested` / `muted` / Channel-Shells).
- Spielerisch-CTAs nicht mit Magenta-Primary oder `primary-container` fuellen (siehe Theming). Keine lokalen `--mat-button-*-container-color: var(--mat-sys-primary-container)`-Overrides an Buttons. Keine `color-mix(..., white)`-Aufhellung für Flächen oder Hinweistexte; Surface- bzw. `on-surface-variant`-Tokens nutzen.
- Keine Flatten-Kämpfe (`!important`, Gegen-Overrides) auf denselben Selektoren zwischen Feature und Playful.
- Seriös darf keine Regeln aus `playful-inner-chrome.scss` übernehmen.

### Shape, Gewicht, Semantik-Tokens

- Radii: `--mat-sys-corner-*` (inkl. `full` für Kapseln). Ausnahme Histogram-Stab und echte Kreise (`50%`).
- `font-weight` in UI/Display: maximal **700**.
- `--arsnova-bar-*` und vergleichbare App-Tokens ohne Hex-Fallback in Feature-SCSS.
- Tote Selektoren und ungenutzte Chrome-Klassen entfernen statt „mitwandern“.

### Material-Internals und Encapsulation

1. Offizielle Material-Override-Mixins, falls vorhanden.
2. Sonst eng gescopte Regeln unter Feature-Host-Klassen:
   - bevorzugt in der **lazy** Feature-SCSS mit `ViewEncapsulation.None` (Vorbild: Help-/MOTD-Expansion, Admin-Tabs, Quiz-Edit-Meta, Projection-`innerHTML`), oder
   - global in `styles.scss`, wenn die Styles früh/überall nötig sind (Vorbild: `.vote-timer-a11y__option`).
3. Layout außerhalb von `:host`: Route-/Shell-Klasse in `app.component` (Vorbild: `.app-main--present`).
4. Overlays: `panelClass` / `backdropClass`.
5. **Verboten** in Feature-SCSS: `::ng-deep`, `:deep(...)`.

### Floating-Bottom-Contract

| Muster                     | Wann                                                                                                | Verhalten                                                                                                                          |
| -------------------------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Solo-Primary-CTA           | Ein sichtbarer Primary (Vote-Submit, Q&amp;A „Frage stellen“, Join-Submit, Session-Ende `--single`) | `width: fit-content`, zentriert inkl. Safe-Area; **kein** Glas-/Surface-Prospekt um den Button                                     |
| Multi-Action-Tray          | 2–3 Aktionen (Session-Ende)                                                                         | opake Kapsel, Grid, begrenzte Breite; `padding-bottom` der Vote-Seite hält den Inhalt über der Leiste scrollbar (`--triple` höher) |
| Blitzlicht-Host-Standalone | Host-Standalone-Bottom                                                                              | Buttons ohne Tray (wie etabliert)                                                                                                  |
| Quiz-Edit-Leiste           | Editor speichern/verwerfen                                                                          | **eigener** Editor-Chrome – nicht in den Vote-Floating-Contract zwingen                                                            |

### Live-Kanal-Breite (Session-Shell)

- `.session-page-shell.l-section` als Flex-Kind braucht **`width: min(100%, …)`**, nicht nur `max-width` (sonst shrink-to-fit).
- Standard-Kanalbreite folgt `--app-live-channel-max-width` (36rem); Teilnehmer-Q&amp;A: Shell + `--app-live-channel-max-width` auf **48rem** via `:has(.vote-page--qa)`.

### Host-Live-Zeile, Icon-Buttons und Kapseln (Session-Host)

Gilt fuer `.session-host__live-shell-row` und analoge Join-Trigger (Standalone-Blitzlicht). Referenz: `session-host.component.{html,scss}`, `feedback-host.component.{html,scss}`.

- **Gemeinsame Fluchtlinie:** Live-Zeile, Kanal-Tabs (`.session-channel-tabs-shell`) und Kanal-Karten (`.session-host__channel-panel`) teilen **`--session-host-shell-width`**, `max-width: 100%` und `margin-inline: auto`. Mobil **kein** `width: 100%` auf der Live-Zeile – sonst fallen Join-Kapsel und Kompass aus der Aussenkante von Tabs, Rahmen-Button und Fragekarten.
- **Kompakte Join-Kapsel:** `.session-host__live-banner` bleibt **`width: max-content`** / `flex: 0 1 auto`. Nicht `flex: 1` und nicht `width: auto` nur wegen Channel-Tabs – das zieht die Kapsel bis an den Kompass. Der QR-Trigger ist **icon-only** (`qr_code_2`); der sichtbare Text „Beitritt“ entfaellt, der zugaengliche Name bleibt `aria-label` (`@@sessionHost.joinControlAria`). Kompass sitzt rechts (`justify-content: space-between` unter 600px; darueber Grid + `justify-self: end`).
- **Vergroesserte `mat-icon-button`:** `.mat-mdc-icon-button` ist `display: inline-block` und zentriert das Glyph ueber `padding: calc((state-layer - icon-size) / 2)` mit **`--mat-icon-button-state-layer-size`** und **`--mat-icon-button-icon-size`**. Nur `--mdc-icon-button-state-layer-size` plus `padding: 0` verschiebt Icon gegen Fokusring und Hover-Flaeche (Schrift-Baseline). Token setzen **und** `display: inline-flex; align-items: center; justify-content: center`. Touch-Target bleibt mindestens 44px.
- **Icon+Text-Kapseln** (z. B. `.session-host__vote-dist-correct`): `align-items: center`, Label in einem `span`, Icon ohne `margin-top`-Korrektur. `align-items: flex-start` setzt einzeiligen Body-Text optisch an den oberen Kapselrand.

### Bewusste Ausnahmen (nicht „fixen“)

- Foyer-Einflug: Keyframes / `animation-*`-Longhands / `ViewEncapsulation.None` (Prod-Flug).
- Live-Banner Vote: kompakte Leiste (Code + Teilnehmerzahl, optional Titel) – kein Kanalstatus parallel zu den Tabs; vertikale Höhe klein halten, damit Abstimmen ohne Scrollen bleibt. Host-Join darf bühnenhafter bleiben.
- Ankunfts-/Confetti-/Reward-Keyframes und Medaillenfarben nicht ohne Produktgrund antasten.

### Checkliste bei Style-PRs

- [ ] Seriös und Spielerisch geprüft; Dual-Layer nicht gebrochen
- [ ] Keine neuen `::ng-deep` / `:deep` / `999px` / `font-weight: 800` / Hex-Token-Fallbacks
- [ ] Material-Internals global oder per Mixin; Markdown/`innerHTML` global gescoped
- [ ] Floating-Bottom-Muster eingehalten oder Ausnahme dokumentiert
- [ ] Host-Live-Zeile: Shell-Fluchtlinie, kompakte Join-Kapsel, Icon im Fokusring zentriert
- [ ] Mobile, längere Locales, Fokus/Kontrast nicht regressiert
- [ ] Nächster Spec-Check auf Token-/Piercing-Regression, wo sinnvoll

## Preset Spielerisch (Startseite)

- **Hintergrund:** Verlauf mit Primary-/Tertiary-Container (Token `--app-bg-root`).
- **Buehnen-Layout:** Hero + USP liegen in `.home-hero-band` mit dezentem Verlauf/Radial-Glow (nur bei `prefers-reduced-motion: no-preference`); der Glow-Layer darf **sehr langsam** driften (`home-hero-band-spotlight-drift`). **Keine Copy-Rotation** unter dem Hero: Der Trust-Satz sitzt in `.home-hero-usp--secondary`. Der Preset-Umschalter bleibt auf Mobile im globalen Hamburger-Menü, damit der Hero kompakt bleibt. Auf schmalen Displays bleibt die Hero-Karte bewusst knapp gepolstert, damit die Dozierenden-Sektion im ersten Viewport angeschritten wird. Bis 1199 px folgt die einspaltige Aufgabenreihenfolge Teilnahme → Rollenwechsel → Live → Direktes Feedback → Vorbereiten; ab 1200 px stehen die drei Host-Aufgaben wie im serioesen Preset als gleich hohes Dreispaltenraster.
- **Karten:** Alle vier Startseiten-Karten (`.home-card`) teilen `corner-extra-large`. Teilnahme (`.home-card--stage-main`) hat die staerkere Elevation (`level3`), `surface-container-high` und eine 1-px-Kontur aus `outline-variant`. Die drei Host-Aufgabenkarten (`.home-card--stage-side`) sind gefuellte Surface-Stufen (`surface-container-low` Live, `surface-container` Feedback, `surface-container-high` Vorbereiten) statt gestapelter Glow-Radials. Vorbereiten bleibt staerker Tertiary-betont. Hover hebt Karten nur unter `prefers-reduced-motion: no-preference` leicht an.
- **Vorbereiten-Karte (Ausnahme):** Ohne `--app-shadow-card-playful` und ohne `--app-shadow-cta-glow` am gefuellten CTA, damit Tonal-Buttons keinen farbigen Schleier erhalten (`home-card--create` in `home.component.scss`).
- **Teilnahme-Karte:** Ein Primary-/Tertiary-Verlauf ohne Glow-Staffelung, **ohne** linken Akzentstreifen. Rollen-Eyebrow »Für Teilnehmende«, darunter genau ein `h2` »Session beitreten«. **Kein Spotlight-Panel** um Session-Code oder »Letzte Sessions«. Die sechs Code-Segmente behalten in beiden Presets dieselbe Geometrie; leere Segmente nutzen `surface-container-highest`.
- **Haupt-CTA:** Der gefuellte Teilnahme-Button hat im Spielerisch-Modus **keinen** Glow- oder Elevation-Glanz; deaktiviert ist die Flaeche matt und deckend.
- **Header:** Gradient, dezenter Primary-Rahmen, `--app-shadow-accent`.
- Alle Werte tokenbasiert in `styles.scss` (`html.preset-playful`) und Home-Komponente.

### Innere Ansichten (Preset Spielerisch, schrittweise)

- **Welle 1** (`src/styles/playful-inner-chrome.scss`, per `@import` in `styles.scss`): **Quiz-Sammlung** (`.quiz-list-page`) – **Demo-/Sync-Callouts** (muted Panel), **Quiz-Karten** mit **primary**-Mixin und eigener **Hover-Elevation** (Ruheschatten der Mixin-Regel sonst ohne Lift); **KI-Import-Karte** (Arbeitsfläche) mit **muted** Panel-Chrome **ohne** Hover-Lift, Schritte als ruhige Insets; **Join** (`.join-page`) – **Session-Karten** ohne Fehlerzustand (`mat-card.join-card:not(.join-card--error)`), **Session-Info** in der Lobby (`.join-card--lobby .join-card__session`) als kompaktes Spotlight-innenaehnlich zu Home. **Fehler-Karte** Join bleibt sachlich ohne diese Fläche.
- **Welle 2:** **Neues Quiz** (`mat-card.quiz-form-card`) und **Quiz bearbeiten** (`.quiz-edit`: `.quiz-edit__meta-card`, `.quiz-edit__settings-card`, `.quiz-edit__form-card`, `.quiz-edit-list__empty-card`, `.quiz-edit-question`, `.quiz-edit__not-found`) mit gemeinsamem Mixin **„primary“** (wie Listen-Karten); **verschachtelte** Karten (**Einstellungen** in Neu-Quiz als `.quiz-form__settings-card`, **Gesamtvorschau** in Bearbeiten) mit schwächerem Mixin **„nested“** (weniger Schatten, kein `--app-shadow-card-playful`); Fieldsets/Preset-Hinweis/Team-Vorschau in Neu-Quiz als ruhige Insets.
- **Welle 3:** **Quiz-Vorschau** – Leer-Karte, Editor-Karte, Validierungs-Karte (`mat-card`), Folien-Fläche **`.quiz-preview-question`** (Rand + Schatten/Bühnen-Glow); **Quiz-Sync** (`mat-card.quiz-sync-card`) mit **primary**-Mixin.
- **Welle 4:** **Session Vote (Teilnehmer)** – **`.vote-live-banner`**, **Bonus-** und **Feedback-Karten** mit Panel-Mixin **`app-playful-inner-panel-channel`**; **„seriöse“** Feedback-Karte im UI-Preset Spielerisch mit **nested**; **Lobby-Warteblock** (`.vote-lobby__wait`), **Lese-Banner**, **Abschluss-Hero**, **Feedback-erledigt** und **Channel-Tabs** mit Primary-Tint / Zusatzschatten; Medaillen-Varianten des Heroes behalten ihre Farben, erhalten zusätzlich **`--app-shadow-card-playful`**. **Team-Belohnung** **`.vote-team-reward`**: Shell-Mixins **`app-playful-vote-team-reward-shell`** / **`-leader`**; Kopfzeile, Team-Chip, Stat-Kacheln und Rangliste (Medaillen-Streifen, `--own`). **Ergänzend (Teilnehmeransicht):** **`section.session-channel-card`** (Q&amp;A-Tab, kein `mat-card`), gesamte **`.vote-lobby`**, **`.vote-player-badge`**, **Countdown** (nicht urgent), **`.vote-scorecard`**, **Frage** / **Diskussionsphase** / **Runden-2-Banner**, **Antwort-Buttons** (neutral + ausgewählt), **Freitext** / **Bewertung** / **„Antwort gesendet“**, **Emoji-Leiste**, **Q&amp;A-Karten** (inkl. **pinned**), **leerer Q&amp;A-Zustand**, **Moderations-Hinweis**, **Q&amp;A-Textarea**. Token-Radii statt `999px`; Timer-A11y-Toggle-Styles global unter `.vote-timer-a11y__option` (kein `::ng-deep`); Ankunfts-/Confetti-/Reward-Keyframes nicht antasten.
- **Welle 5:** **Session Present** – Sieger-, Team-Board-, Q&amp;A-, Feedback-**`mat-card`** mit **primary**; **Word-Cloud**-Sektion als Panel; **`session-placeholder`** mit **nested**; **Quiz-Projektion** Frage (`session-projection-quiz__question`) als `primary-container`-Fokusfläche gegen Stage/Antworten (`surface-container-low`/`lowest`, Spielerisch Stage **muted**). **Session Host** – Frage-Karte als Fokusfläche (`primary-container` in Seriös; verstärkter `primary-container`-Verlauf in Spielerisch) klar gegen Ergebnis-/Antwortflächen (`surface-container-low`/`lowest`, Spielerisch **muted**); Q&amp;A und **`session-channel-card`** **nested**; Placeholder wie Present. **Foyer-Einflug** (`foyer-entrance-layer`): Keyframes/`animation-*`-Longhands und `ViewEncapsulation.None` nicht antasten (Prod-Flug); nur Token-Radii/`999px` und toter CSS erlaubt.
- **Welle 6:** **Blitzlicht** – eingebettete/Standalone **`mat-card.session-channel-card`** mit **nested** (Host-Placeholder und Teilnehmer-Placeholder in `feedback-vote`); geschlossener Blitzlicht-Kanal in der Vote-Shell bleibt **`section.session-channel-card`** (wie Q&amp;A, Chrome ueber `.vote-page section…`); **`feedback-host__error`** mit **muted**-Panel; **Teilnehmer-Blitzlicht** (`mat-card.feedback-vote__card`) **primary** – **ohne** Embedded-Flatten der Flaeche; Standalone-Join ist flache Live-Leiste (kein toter Buehnen-Rahmen/`!important`); Token-Radii statt `999px`, Gewicht 700 statt 800; **Hilfe / Legal / News-Archiv** – Bühnen-Chrome auf **`.content-page-panel`** (nicht als zweite Karte um den Artikel); Lesespur shared über **`content-page-article.scss`**; **Betriebsstatus-Dialog** (`.app-status-help-dialog-panel`) mit dezentem Panel-Chrome; **Admin** (`mat-card.admin-card`) **primary**.
- **Welle 7:** **Q&amp;A** – Host-Kanal-`mat-card` mit **`app-live-channel-shell`** (nested wie Blitzlicht); Host-Innenkarten **`.session-host .session-qa-card`** nested (ohne Override von highlight/compass-focus); Vote-Form/Notice/Card und Present-Votes/List-Items auf Token-Radii; totes **`.session-qa-cloud*`** entfernt; Wortwolken-Dialog Progress auf `corner-full`. Teilnehmer-Q&amp;A: **`.session-page-shell:has(.vote-page--qa)`** erzwingt **48rem** Breite (Flex+`margin-inline:auto` sonst shrink-to-fit unter der Inhaltsbreite; `max-width` allein wirkungslos).
- **Welle 8 (abgeschlossen, Token-Nachzug):** Operative Regeln stehen unter **Style-Vertraege fuer Erweiterungen**. Historisch: Bar-Tokens ohne Hex-Fallbacks; `999px` → `corner-full`; Gewicht 800 → 700; Present-Shell und Material-Internals ohne Piercing; Blitzlicht-Host/Vote-Radii auf Corner-Tokens; Floating-Bottom- und Dual-Layer-Vertrag.
- **Wellen-Status:** Playful-Chrome und Token-Nachzug fuer die inneren Views gelten als **fertig**. Neue Surfaces erweitern die Vertraege oben, statt eine „Welle 9“-Liste fortzuschreiben – ausser bei bewusst abgegrenzten Gross-Batches. Startseiten-Sprache (umrandete Icon-Kacheln, tonal/outlined statt gefuellter Weissfliesen, Tertiary nur fuer den bereiten Primary, Statuspunkt fuer offene Sessions) gilt analog fuer Join, Host-Live-Kapsel, Quiz-Picker und Standarddialoge. **Dialoge und Overlays:** Surface-Chrome kommt aus `styles.scss` (`app-dialog-surface-base` / `app-playful-surface-chrome`) fuer alle Standarddialoge inkl. Bestaetigen, Bonus-Codes, Quiz-Picker, MOTD-Archiv, Lifecycle, Kompass und Markdown-Einfuegen. Presenter-Board, Vollbild-Gate und Pair-Karten folgen den inner-chrome-Mixins. Die Lobby-Join-Karte bleibt transparent (QR auf der Bühne). MOTD-Listenaktionen sind tonal (`surface-container-high`), nicht `primary-container`.

## Startseite: Buttons, Snackbar und Toast

- **Aufgabenwahl:** Unter »Was möchtest du tun?« stehen drei getrennte Karten: **Quiz**, **Q&A** und **Blitzlicht**, mit denselben Titeln wie im Hero. Bis 1199 px werden sie untereinander angeordnet; ab 1200 px bilden sie drei gleich breite und gleich hohe Spalten.
- **Rollentrennung:** Zwischen Teilnahme-Karte und Veranstalten-Einstieg steht ein semantisches, zentriertes `<hr>` mit maximal **72 % / 26 rem** Breite. Die **1 px** starke Farbe mischt `--mat-sys-outline` mit dem jeweiligen Primary-Token, damit sie sichtbar bleibt, ohne die Karten optisch zu zerschneiden. Der Abstand ober- und unterhalb entsteht aus `0,5 rem` Eigenabstand plus dem Spalten-Gap.
- **Zweizeilige Aktionsbuttons:** Hauptlabel mit `label-large`, Kurzbeschreibung mit mindestens `body-small`; beide verwenden unveraendert die vom Material-Button geerbte On-Container-Farbe. Aktive Kacheln nutzen unter `prefers-reduced-motion: no-preference` MD3-emphasized Easing (`cubic-bezier(0.2, 0, 0, 1)`). Keine reduzierte Opacity oder gemischte Textfarbe. Gemeinsame Mindesthoehe **4,75 rem** (`--home-host-action-min-height`) fuer die Aktionskacheln der drei Host-Karten. An die Host-CTAs schließt ein nicht interaktiver Faktenbereich mit `body-small`-Zeilen für Fristen, Fragenzahl und gegebenenfalls Moderationszahl an. Live: zuerst eine eigene Reihe (`.home-host-session-cta-row`, eine Spalte, 600–1199 px zwei Spalten, Desktop wieder eine Spalte) fuer jede in diesem Browser noch zugangliche Host-Session; offen zuerst (zuletzt gehostete, sonst frühestes Offen-bis), dann geschlossen (frühestes Zugang-bis), Anzeige höchstens 8; das erste offene Forum tonal auf `surface-container-highest` plus `outline-variant` und Statuspunkt (`--app-status-healthy`), der Rest outlined wie **»Quiz-Sammlung öffnen«**; darunter die Kanalaktionen **Live-Quiz** (tonal, Seriös `primary-container`, Spielerisch `tertiary-container`, Kurzzeile **Aus Sammlung wählen**), **Q&A** ohne Host-CTA bzw. **Neue Q&A** sobald mindestens ein Host-CTA steht (tonal auf `surface-container-highest`, sichtbares Grau; Spielerisch mit tertiär getönter Kontur gegen die dunkle Q&A-Karte) und **Blitzlicht** (outlined Nebenaktion) auf Smartphones zu zweit in einer Zeile (dritte Kachel volle Breite), von 600 bis 1199 px drei Spalten, im aeusseren Desktop-Dreispaltenraster wieder eine Spalte. Vorbereiten: eine Spalte, von 480 bis 1199 px zwei Spalten fuer Erstellen/Sammlung, im aeusseren Desktop-Raster wieder eine Spalte. Die Host-Karten tragen keine `.home-card__description`; unter »Was möchtest du tun?« steht kein erklaerender Introtext mehr.
- **Blitzlicht:** Die drei Host-Karten haben keine zusaetzliche Kartenbeschreibung mehr; Eyebrow, Titel und Aktionen reichen. Die Blitzlicht-Karte startet nur noch ein sitzungsgebundenes Blitzlicht und enthaelt genau **Tempo**, **Stimmungsbild**, **Ja · Nein · Vielleicht** und **Sterne**. Das kanallose Standalone-Blitzlicht ist auf der Startseite ausgeblendet. Weitere Blitzlichtformate bleiben in den dafuer vorgesehenen Detailansichten verfuegbar. Bis 1199 px stehen die vier Templates im 2er-Raster. Im aeusseren Desktop-Dreispaltenraster steht **ein Template pro Zeile** mit vollem Label **»Ja · Nein · Vielleicht«** und `1 rem` Zeilenabstand. Alle Kacheln teilen dieselbe Hoehe (`grid-auto-rows: 1fr`, mindestens `4,75 rem`); die Template-Icons stehen mit `0,6 rem` Abstand (`0,4 rem` bei Sternen). Die Gruppe sitzt vertikal zentriert im freien Kartenraum. Session-starten- und Vorbereiten-Karte zentrieren ihre Aktionen ebenso, auch wenn das Sync-Panel die dritte Spalte streckt.
- **Button-Hierarchie:** Global bleibt **»Los geht’s«** der High-Emphasis-CTA: outlined und deaktiviert bis 6 Zeichen, danach **Tertiary-Filled**. **»Letztes Quiz starten«** sitzt auf der Quiz-Karte (volle Breite über Erstellen und Sammlung) als **Tertiary-Filled**-Akzent, nur wenn mindestens ein **eigenes** Quiz existiert (Demo zaehlt nicht). **»Neues Quiz«** bleibt tonal und wird bei Hover etwas heller (`surface-container-high`), **»Quiz-Sammlung öffnen«** outlined. **Geteilte Sammlung nutzen** steht darunter als MD3-Textaktion, der Link **Einsatzmöglichkeiten** ganz unten auf der Karte (`on-surface-variant`, Outlined-Lead-Icons `help_outline` bzw. `devices`). Das Panel nimmt nur einen **empfangenen** Sync-Link entgegen; den Link erzeugen bleibt in der Quiz-Sammlung (**»Sammlung teilen«**). Offen: Schließen per demselben Text-Button, **Backdrop-Klick** oder **Escape**; Fokus zurück auf den Button. Die offene Vorbereiten-Karte muss **über** dem Backdrop liegen (`z-index` höher als `.home-sync-backdrop`), auch gegen die spielerische Side-Act-Regel `z-index: 1`; im schmalen Desktop-Kartenslot stehen Eingabe und Submit untereinander.
- **Outlined-Kontrast:** Auf der spielerischen Light-Verlaufsfläche verwenden **»Quiz-Sammlung öffnen«** und die nicht-primären Host-Session-CTAs für Label und Rand `on-surface` bzw. `on-surface-variant`; die normalen Outlined-Tokens wären dort zu kontrastarm. Spielerisch Dark und beide seriösen Themes behalten die Material-Tokens.
- **Preset-Wechsel (Snackbar):** Klick auf Serioes/Spielerisch wendet das Preset sofort an und zeigt eine **Snackbar** (fixed bottom, 5 s Auto-Dismiss). Serioes bleibt bei M3-`inverse-surface`. Spielerisch nutzt denselben Magenta-/Orange-Chrome wie die Toolbar (`surface-container` + Primary-/Tertiary-Verlauf, Primary-Rand, Tertiary-Aktion). Die Snackbar enthaelt Icon, Label und einen »Anpassen«-Link, der das Detail-Modal oeffnet. Die Blitzlicht-Vergleichs-Snackbar (`feedback-compare-round-snackbar`) behält ihre eigene Surface, setzt die Aktion im Spielerisch-Preset aber auf Tertiary statt `primary-container`.
- **Toast (Preset-Detail-Konfiguration):** Oeffnet sich nur bei Klick auf »Anpassen« in der Snackbar. Zentriertes Modal mit Close-Button; alle Optionen als **toggelbare Chips** nach Kategorien (Gamification, Teilnahme, Ablauf, Team, Audio). Abhaengige Chips werden nur angezeigt, wenn der Eltern-Chip aktiv ist. Speichern uebernimmt, Zuruecksetzen setzt Preset-Defaults. Einstellungen in **localStorage**; Sync ueber Yjs geplant (Story 1.6b).
- **Abstaende:** Nebeneinander liegende Aktionsraster der Host-Karten nutzen 0,75 rem. Gestapelte Buttons (eine Spalte, inkl. Desktop-Dreispaltenraster) und die CTA-Saeule der Vorbereiten-Karte nutzen 1 rem Zeilenabstand; die Desktop-Blitzlicht-Templates ebenfalls 1 rem. Card-Header, Inhalt und Actions behalten 1 rem Inline-Padding. Im breiten Desktop-Raster erhalten alle Home-Karten 1,25 rem Abstand zum unteren Kartenrand.

## Startseite: Session-Code-Eingabe (Segment-Input)

- **6 Segment-Boxen** statt mat-form-field: Jede Box zeigt ein Zeichen, Monospace, zentriert. Ein transparentes `<input>` liegt als Overlay darueber und faengt alle nativen Interaktionen (Paste, Mobile-Keyboard).
- **Zustaende:** Leer (**2 px** `--mat-sys-outline` auf `surface-container-highest`, beide Presets), Active (**2 px** Tertiary-Rahmen plus dezenter Tertiary-Glow, Pulse-Animation), Filled (Primary-Border + Tint-Background). **»Los geht’s«** bleibt outlined/deaktiviert bis 6 Zeichen und leuchtet danach als Tertiary-Filled (`home-cta--armed`).
- **Micro-Interactions:** Segment-Pulse auf aktiver Box (1 s), CTA-Armierung beim 6. Zeichen (Tertiary-Filled plus Spring-Scale 0,96 → 1 mit kurzem Overshoot, 520 ms), Shake bei ungueltigem Submit nur auf den Segment-Kacheln (400 ms, Error-Border) – nicht auf dem Container-Query-Host, damit Host-Karten nicht mitwackeln. Alle Animationen in `@media (prefers-reduced-motion: no-preference)`.
- **Beschriftung:** Keine sichtbare Wiederholung **»Session-Code«** unter den Segmenten; **»6-stelligen Code eingeben«** benennt die Aufgabe bereits. Für Screenreader bleibt das `aria-label` am Eingabefeld (»Session-Code, 6 Zeichen«).
- **Geometrie (beide Presets identisch):** Echte Quadrate (`aspect-ratio: 1`, `corner-medium`). Auf Mobile ist die Reihe bis **max. 20,5 rem** breit und zentriert; ab 600 px teilt sie sich eine Zeile mit dem Teilnahme-CTA und nutzt den verfuegbaren Platz. Schrift skaliert mit der Reihenbreite (`cqi`). Keine Preset-eigenen Groessen, Kapsel-Radien oder Spotlight-Polsterung.
- **Fehleingabe:** Der Teilnahme-CTA bleibt **nowrap**; im einspaltigen Mobile-Layout volle Breite, ab 600 px rechts neben dem Code kompakt (`min-width: 8rem`, Mindesthöhe 2,75 rem) statt auf die Höhe der Code-Eingabe gestreckt. Icon und Text im Fehlerhinweis (`.home-error`) stehen **mittig** in der Alert-Zeile.
- **Host-CTAs:** Labels und Kurzbeschreibungen duerfen umbrechen (`white-space: normal`), damit laengere Uebersetzungen innerhalb der Aktionsraster bleiben.
- **Dedizierter Einstieg:** Der codefreie Pfad `/join` verwendet dieselbe Startseiten-Komponente und darf die Code-Eingabe auf Geraeten ohne groben Primaerzeiger fokussieren. Bei primaerer Touch-Eingabe bleibt der Fokus unveraendert, damit ein direkter Link nicht ungefragt die Bildschirmtastatur oeffnet; ein bewusster Klick auf »6-stelligen Code eingeben« fokussiert weiterhin.

## Startseite: Hero und Aufgabenfuehrung

- **Hero-Text:** Kompaktes Nutzenversprechen mit den drei Kanaelen Quiz, Q&A und Blitzlicht. Desktop ab 600 px nutzt **Display Medium**, Mobile bleibt **Title Large**. Der Zielgruppen-Satz steht in **Body Large** mit `line-height` 1,65. Die drei Host-Karten verwenden dieselben Titel-IDs wie der Hero (`@@homeHero.channelQuiz`, `@@homeHero.channelQa`, `@@homeHero.channelBlitzlicht`). Englisch zeigt im Hero und auf der Blitzlicht-Karte **live polls**.
- **Host-Zugang wiederherstellen:** Die Live-Karte lädt bis zu 32 gespeicherte Host-Capabilities und zeigt höchstens 8: offene Foren zuerst (zuletzt gehostete, sonst frühestes Offen-bis), danach geschlossene (frühestes Zugang-bis). Das erste offene Forum ist tonal (`surface-container-highest`, `outline-variant`, Statuspunkt `--app-status-healthy`), nicht Filled-Weiß; der Rest ist outlined wie **»Quiz-Sammlung öffnen«** (inkl. spielerisch-hellem Kontrast). Ohne offenes Forum bleibt die ganze Reihe outlined. Jeder Eintrag öffnet die Host-Session direkt im Q&A-Kanal (`?tab=qa`) und heißt **Q&A-Session** plus der sechsstellige Sessioncode, nicht »offen« und nicht »Host-Session«. Die erste Faktenzeile zeigt die Host-Zugangsfrist (`postProcessingEndsAt`, sonst `expiresAt`) als »Zugang bis …« mit lokalem Datum und Uhrzeit; ohne geladene Frist bleibt `@@homeLiveCard.recoveryDescription`. Die zweite Faktenzeile zeigt die Q&A-Offen-Frist (`qaClosesAt`, sonst `expiresAt`) als »Offen bis …«; nach Ablauf oder geschlossenem Kanal steht dort »Forum geschlossen«. Eine weitere Faktenzeile zeigt bei wartenden Moderationsfragen (`PENDING` > 0, nur mit Host-Token) »In Moderation: {n}«; sonst die teilnehmendensichtbaren Fragen (`ACTIVE`/`PINNED`/`ARCHIVED`) als »1 Frage« oder »{n} Fragen«. Bei null oder 0 entfällt die Zeile. Rechts neben der letzten Faktenzeile sitzt ein `delete_outline`-Icon (44 px, `@@homeLiveCard.removeCtaAria`). Die Host-CTAs sind abgerundete Rechtecke (`--mat-sys-corner-medium`), keine Pills. Der Öffnen-Button enthält nur Sessioncode und gegebenenfalls Statuspunkt. Zugang bis, Offen bis beziehungsweise Forum geschlossen sowie Fragen- und Moderationszahl stehen als angehängte, nicht interaktive Fakten unmittelbar unter dem Button im selben Listeneintrag; der separate Löschbutton sitzt rechts neben der letzten Faktenzeile ohne zusätzliche Leerzeile. Der Öffnen-Button füllt die gesamte Breite des Eintrags. Fakten sind nicht Teil des zugänglichen Linknamens. Der Öffnen-Button ist unter 600 px zentriert und ab 600 px linksbündig; die Fakten bleiben für schnelles Scannen linksbündig. Die Abfrage bietet **Session löschen** als Hauptaktion (`session.end` für alle Kanäle) und **Nur Schnellzugang entfernen** als Ausnahme; sie nennt Offen-Status, Fragenzahl, Zugangsfrist und den Wiederherstellungshinweis. Nur ein Wiederherstellungskandidat ohne aktivierte Capability zeigt keinen CTA. Die Wiederherstellungsseite bleibt unter `/<locale>/host-recovery` erreichbar, hat auf der Live-Karte aber keinen Textlink. Die Kanalaktionen stehen auf Smartphones zu zweit in einer Zeile, von 600 bis 1199 px in drei Spalten, darunter oder darüber die CTA-Reihe (600–1199 px zwei Spalten, sonst eine). Quiz bleibt die Primary-Tonal-Aktion, **Neue Q&A**/**Q&A** tonal grau auf `surface-container-highest`, Blitzlicht outlined.
- **Alleinstellungsmerkmale (USP):** Zielgruppe/Gruppengroesse in Primary-Farbe; darunter nicht interaktive Suggestion-Chips fuer **Kostenlos**, **Open Source**, **Ohne Anmeldung** und ab 600 px bzw. Landscape **Made in Europe**. Keine Onboarding-Schritt-Pills.
- **Rollenwechsel:** Teilnahme steht zuerst. Danach trennt »Für Lehrende und Vortragende« mit `h2` »Was möchtest du tun?« die Host-Aufgaben semantisch und visuell ab.
- **Kartenkopf-Icons:** Informative Glyphen in outlined Tiles (`meeting_room` Teilnehmen, `quiz` Quiz, `chat_bubble_outline` Q&A, `bolt` Blitzlicht). Kein gefuellter Primary-Kreis; Filled bleibt Buttons, Badges und aktiven Zustaenden vorbehalten.
- **Karten-Eyebrows:** Quiz »Fragen ans Publikum«, Q&A »Fragen vom Publikum«, Blitzlicht »Feedback vom Publikum«.
- **Kein Onboarding-Banner:** Kein 3-Schritt-Banner, keine dekorative Schritt-Chip-Sequenz und keine Copy-Rotation (`.home-stage-rotator`). Die Hero-USPs duerfen als Suggestion-Chips stehen. Rollenlabels, Aufgabenüberschrift und Karten erklaeren den Ablauf.

## Startseite: Brand und Status

- **Brand-Icon:** EU-Blau als Hintergrund (stilistische Anlehnung, kein offizielles EU-Emblem). Im Logo: EU-gelber Stern (arsnova-stern-eu, Pentagramm wie EU-Flagge, eine Spitze oben), Farbe `--app-eu-yellow`; Logo-Stern-Farbe wird nicht themenabhängig geändert. Toolbar-Logo **2,25 rem**. Im Titel nur „arsnova.eu“ mit normalem Punkt (kein Stern im Wortmarken-Text). Logo, Wortmarke, Megafon und Toolbar-Labels teilen **dieselbe vertikale Mitte**; die Wortmarke hat keinen Extra-Versatz. Farben: `--app-eu-blue`, `--app-eu-blue-dark`, `--app-eu-yellow` (als Brand-Ausnahme in [TOKENS.md](TOKENS.md) dokumentiert).
- **Status:** Kein Status-Punkt im Startseiten-Header; Betriebsinformationen bleiben in den vorhandenen Status- und Hilfeflächen der App.

## Startseite: Mobile-Hierarchie

- Auf Mobile (`< 600 px`) erhaelt die Teilnahme-Karte im Preset **Serioes** einen **3 px Primary-Top-Border** als visuellen Akzent. Im Preset **Spielerisch** übernimmt der vorhandene umlaufende Primary-/Tertiary-Rand diese Aufgabe.

## Top-Toolbar und Scroll-Verhalten (seitenuebergreifend)

- **Inhalt:** Logo (Link zur Startseite). **Ab 840 px (Landscape-Tablet/Desktop):** Preset-Umschalter (Serioes/Spielerisch), Theme-Umschalter als Segmented Control (System/Dark/Light, mindestens 48 px je Segment, ohne überlappende Hit-Areas), Sprachauswahl. **Darunter inkl. Tablet-Portrait:** nur Hamburger; im geoeffneten Menue Preset, Theme und Sprache; alle Bedienelemente haben mindestens 44 px Hoehe. Die Toolbar erscheint auf **allen** Seiten (Startseite, Quiz, Session, Help, Legal).
- **Position:** Die Toolbar ist **fixiert** (`position: fixed`) über dem App-Shell-Scrollcontainer (`#main-content` / `.app-main`). Der Hauptinhalt erhaelt oben Padding (`.app-main--toolbar-fixed`), damit nichts unter der Toolbar verschwindet. Home, MOTD und Einstellungen bleiben damit auf allen Viewports erreichbar; Hide-on-Scroll entfaellt, weil arsnova eine Werkzeug-UI ist (Material-3-Pinned-Bar, Apple Navigation Bar) und der Inhalt nicht im Fenster, sondern in `#main-content` scrollt.
- **Scroll-Elevation:** Sobald `#main-content` gescrollt wurde (`scrollTop > 0`), erhaelt die Toolbar einen staerkeren Schatten (`--mat-sys-level2`) zur Abhebung vom Inhalt (Material/Apple-konform). Nach Navigation an den Seitenanfang entfaellt die Elevation wieder.
- **Preset Spielerisch:** Die Top-Toolbar nutzt **dieselbe visuelle Sprache** wie Startseiten-Bühne/Hero: **Primary-/Tertiary-Verlauf** auf `surface-container`, **Primary-Rand**, **`--app-shadow-accent`**, **Innenlicht** (`inset`), dezent **radialer Highlight** oben rechts (nur bei `prefers-reduced-motion: no-preference`). **Gescrollt:** zusaetzlicher **Primary-Tiefenschatten**. **Brand-SVG** ohne Pulse-Animation (transform auf dem Inline-SVG verfälscht in Firefox die EU-Blau-Füllung). Preset-Toggle **checked** mit **tertiary-container**-Flaeche; **Spielerisch-Icon** in Tertiary. **Mobile-Ausklappbereich:** Trennlinie primary-getoent; **Locale-Hinweis** (Dev) mit leicht getoenter Fläche und Rand.
- **MOTD-Megafon:** Wenn eine aktuelle MOTD existiert, in dieser Sitzung aber noch nicht als Overlay oder Archiv gezeigt wurde, bekommt `.top-toolbar__motd-btn--attention` eine **primary-container**-Flaeche und das Icon **Primary**. Bewegung nur als Box-Shadow-Puls unter `prefers-reduced-motion: no-preference` (kein Transform auf dem Glyph). Spielerisch staerkt nur die Flaeche, ohne eigene Hex-Werte. Der PWA-Update-Banner bleibt unsichtbar, solange das Auto-Overlay entschieden wird oder offen ist.
- **Mobile:** Kompakte Hoehe (min-height 48 px, reduziertes Padding 0.5 rem / 0.75 rem) unter 840 px, damit die Toolbar wenig Platz wegnimmt.
- **App-Footer:** `padding-bottom: max(0.5rem, env(safe-area-inset-bottom))`, damit die Bottom-Navigation den iOS-Home-Indicator nicht ueberdeckt. Voraussetzung: Viewport-Meta mit `viewport-fit=cover`.
- **Bei Navigation:** Beim Seitenwechsel wird `#main-content` an den Anfang gesetzt; die Toolbar bleibt sichtbar, die Scroll-Elevation entfaellt.
- **Fokus-Steuerung:** Beim Anzeigen der Preset-Snackbar oder des Preset-Toasts wird das fokussierte Eingabefeld (z. B. Session-Code auf der Startseite) geblurt, damit die virtuelle Tastatur auf Mobile schliesst und Snackbar/Toast nicht ueberdeckt. Beim Schliessen wird optional wieder fokussiert (PresetSnackbarFocusService). Startseite registriert den Session-Code-Input; Toolbar ruft nach Sprach-/Theme-Wechsel refocusInput auf.

## Wording: Anrede und Typografie

- **Gedankenstriche:** In der UI sparsam einsetzen – wirken schnell akademisch oder schwer. Stattdessen Komma, Doppelpunkt oder Punkt (z. B. „Kita bis Uni …“ statt „… Zielgruppe – von …“).
- **Duzen:** In der gesamten App (Hilfe, Hinweise, Buttons, Fehlermeldungen) wird die Nutzerin/der Nutzer mit **Du** angesprochen – einheitlich fuer alle Rollen (Veranstaltende und Teilnehmende). Entspricht dem Vorgehen vieler Lern- und Umfrage-Apps (z. B. Mentimeter, Kahoot!, Slido). Formelles "Sie" nur in rechtlichen Texten (Impressum, Datenschutz), wo ueblich.
- **Rollenbezeichnungen:** "Mitmachen" (statt "Teilnehmer/in"), "Veranstalten" (statt "Lehrperson"). Aktivierend, rollenunabhaengig. **Teilnehmer-Perspektive (Live):** Steuernde als **Moderation** oder **Host** benennen, nicht als Dozent/Lehrperson (siehe unten „Zielgruppenneutrale Copy“). Host-Zugang fuer eine offene Session liegt nur auf dem Live-Karten-CTA, nicht auf Teilnehmer-Join- oder Beendet-Fehlerflaechen.
- **CTAs:** Handlungsauffordernd mit klarem Nutzen: »Los geht’s« (statt »Beitreten«), »Neues Quiz erstellen« (statt »Session erstellen«), Begriffe zur **Quiz-Sammlung** statt generisch »Bibliothek«, »Fragerunde« (statt »Q&A«). **Hinweis:** Das Wort **Quiz** ist im Produkt fest verankert; breitere Begriffe (z. B. »Interaktionen«, »Fragerunde« als Navigation) nur bei einer **eigenen Story** mit durchgaengigem i18n – nicht punktuell mischen.
- **Session-Code (Startseite):** Sichtbar benennt »6-stelligen Code eingeben« die Aufgabe; »Session-Code, 6 Zeichen« bleibt das `aria-label` des Eingabe-Overlays.
- **Server-Status:** "Verbunden" / "Keine Verbindung" (statt "Server erreichbar/nicht erreichbar"). "Nochmal versuchen" (statt "Erneut verbinden").

### Anführungszeichen (locale-spezifisch) (MUSS)

Die App liefert nur `de` und `en` ohne Region. Quellsprache ist Deutsch nach **DE/AT** (`»…«`). Es gibt kein `de-CH` und kein `en-GB`. Dieselbe Tabelle gilt für Frontend-XLF, `$localize`, Templates und die Landing-Copy.

| Locale | Zeichen   | Nicht verwenden                                                            | Beispiel      |
| ------ | --------- | -------------------------------------------------------------------------- | ------------- |
| **de** | **»…«**   | Schweizer `«…»`, klassisch `„…“`, gerade `"`                               | »10× Zeit«    |
| **en** | **“…”**   | UK `‘…’`, gerade `"`                                                       | “10× time”    |
| **fr** | **« … »** | ohne schmales geschütztes Leerzeichen (U+202F), `« … »` mit normalem Space | « Temps ×10 » |
| **es** | **«…»**   | englische `“…”`, französisches U+202F                                      | «Tiempo ×10»  |
| **it** | **«…»**   | englische `“…”`, französisches U+202F                                      | «Tempo ×10»   |

- **Nur Bezeichner:** Anführungszeichen um UI-Namen (Buttons, Auswahloptionen, Menüpunkte), nicht um ganze Sätze und nicht um umschriebene Handlungen.
- **Dynamische Namen** in Anführungszeichen (`»{{ name }}«`) brauchen ein eigenes i18n-Markup; sonst bleiben die deutschen Zeichen in allen Locales.
- Gerade ASCII-`"` in sichtbarer Copy vermeiden. HTML-Entities in XLF-`<target>` (`&quot;Edit&quot;`) durch die locale-richtigen Zeichen ersetzen.
- Prüfung: `npm run check:i18n -w @arsnova/frontend` (`apps/frontend/scripts/check-i18n-locales.mjs`). Englische Zusatzregeln: [ENGLISH-UI-COPY.md](ENGLISH-UI-COPY.md).

### Micro-Copy: Natuerlichkeit, Geraet, Denglisch (Empfehlung)

Leitplanken aus der Teilnehmer-Session (Preset **Ernst** / **Spielerisch**); zentrale Texte u. a. in `apps/frontend/src/app/features/session/session-vote/session-vote-participant-copy.ts`.

- **System vs. Nutzer:** Keine anthropomorphe Fuehrung durch die Software (z. B. nicht „wir halten dich bereit“). Klarer: direkte Aufforderung an die Person („mach dich bereit“) oder sachliche Beschreibung des naechsten Schritts.
- **Grammatik auch locker:** Kurze Zeilen duerfen trotzdem grammatisch vollstaendig sein (z. B. „Kurzes Feedback?“ statt abgehacktem „Kurz Feedback?“).
- **Standardsprache statt Slang:** Regionale oder holprige Wendungen wie „geht’s auf“ (im Sinne von „erscheint“) vermeiden; im **Preset Ernst** neutral: „es erscheint …“, „wird angezeigt …“. Im **Preset Spielerisch** sind kurze, bildhafte Verben erlaubt, wenn sie klar bleiben (z. B. „ploppt … auf“ fuer Emoji-Feedback zur Moderation) — nicht ueber alle Screens streuen.
- **Geraeteneutral:** Wo moeglich Aufgaben statt Eingabegeraet benennen (z. B. „abstimmen“ statt „klicken“), damit Touch und Maus gleichermassen passen.
- **„Wir“ / „uns“ vorsichtig:** Formulierungen wie „Bei uns steht:“ koennen Team-Kontext suggerieren; bei Einzelspielerinnen unklar. Bevorzugt Du-Ansprache („Du sagst:“) oder neutrales Label („Deine Eingabe:“).
- **Denglisch vermeiden:** Unnoetige Anglizismen in deutscher UI reduzieren (z. B. „Vote“ in Labels → „Wahl“ oder „Abstimmung“ je nach Kontext).
- **Spielerisch ohne Überdrehung:** Duzen, kurze Saetze, leichte Energie – aber klar; keine unnoetigen Anglizismen und kein derbes oder jugendsprachliches Marketing in Produkt-Strings (z. B. englischsprachiges „Take 2“, „abfeuern“, „raushauen“). **Ernst** bleibt sachlich und klar; gleiche Information darf knapper formuliert sein.

### Zielgruppenneutrale Copy (Schule, Hochschule, Training, Business)

Die App richtet sich auch an Trainer:innen, Workshop- und Event-Moderation sowie Unternehmenskontext (z. B. Townhall, Retro). UI-Texte sollen **nicht** nur Hörsaal/Klassenzimmer implizieren.

- **Teilnehmende Ansicht (Vote, Fragerunde, Bonus, Emoji):** Steuernde als **Moderation** / **Host**, nicht als Dozent/Lehrperson. Beispiele: „Warte auf den Start durch die **Moderation**“, „anonym bei der **Moderation**“; Snacks bei entfernten Fragen: **„Die Moderation hat … entfernt“**. **Bonus-Hinweis:** Im spielerischen Ton **Moderation**; im sachlichen Ton **Veranstaltungsleitung** (kein Zwang zu „per E-Mail“, wenn der Kanal offen ist). Referenz: `session-vote-participant-copy.ts`, Snacks in `session-vote.component.ts`.
- **Beamer-/Grossbild-Ansicht (Present):** Fragen aus dem **Publikum** statt „aus dem Saal“, damit Meetingraum, Workshop und Hoersaal gleichermassen passen. Referenz: `session-present.component.html` (`@@sessionPresent.qaLabel`, `qaQueueLabel`).
- **Host-Seite / Fehlerpfade:** Kurz und klar **Host** nutzen, wo es um die Steuerungs-Ansicht geht (z. B. Link bei beendeter Session).
- **Hilfe und erklaerende Texte:** Zielgruppe beschreiben mit **Lehrende, Trainer:innen, Seminarleiter:innen** (wie im Intro) – dort bewusst breit. Bei Tipps und Anleitungen **Gruppe** und **Teilnehmende** bevorzugen, wenn es nicht explizit um Lernende geht; **Veranstaltung** statt nur „Unterricht“/„Seminar“, wo der Kontext allgemein ist. Referenz: `help.component.html`.
- **Datenschutz / KI / Import:** Statt **Lehrmaterialien** und statt zu enger „Lehr“-Wortwahl lieber **deine Inhalte** (ggf. **Inhalte und Präsentationen**, wenn der Kontext Präsentationsfolien meint). Bei KI-Prompt/Import klarstellen: Generierung mit **eigener KI**, **keine Übermittlung dieser Inhalte an arsnova.eu** (wie in der Hilfe unter Import/Export). Referenz: `help.component.html`.
- **Peer Instruction (Doppelrunden):** In Erklaertexten den Vorher/Nachher-Vergleich so beschreiben, dass er auch **ohne** klassischen „Lerneffekt“ Sinn ergibt – z. B. **Stimmungsbild** / Meinungsverteilung nach Austausch (nicht nur didaktischer Lerngewinn). Referenz: Hilfe-Abschnitte Host und Blitzlicht.
- **i18n:** Neue oder geänderte deutsche UI-Strings dieser Kategorie wie üblich in **allen** Locale-Dateien (`messages.xlf`, `en`, `fr`, `es`, `it`) nachziehen; feste IDs (`@@…`) beibehalten, wo vorhanden.

### Verbindliche Begriffspaare (MUSS)

- **UI-Sprache:** "Vorschau" statt "Preview", "Tastenkürzel" statt "Hotkeys".
- **Englisch (`en`):** Konkrete Copy- und Terminologieregeln für `messages.en.xlf` (Host/Session, Interpunktion, Fehlertoast, SEO): **[ENGLISH-UI-COPY.md](ENGLISH-UI-COPY.md)**.
- **Verständlichkeit:** "gültig" statt "valide".
- **KI-Import-Texte:** Keine internen Technikbegriffe wie "Schema-Validierung" in Primaertexten; stattdessen nutzerorientierte Formulierungen ("Wir pruefen den Inhalt vor dem Import.").

## Preset-Toast (Modal): Design

- **Backdrop:** Gedimmt (`color-mix` on-surface 32 %) + leichter `backdrop-filter: blur(4px)`. Klick schliesst. Einblend-Animation (0.2 s) nur bei `prefers-reduced-motion: no-preference`.
- **Modal:** Zentriert, Einblend-Animation scale(0.96) → 1 + fade (0.25 s). Sticky-Header mit Trennlinie, damit Titel und „Stil wechseln“ beim Scrollen sichtbar bleiben.
- **Header:** Kein linker Balken im Toast-Header. Titelicone in Container (surface-container-high bzw. bei Spielerisch Primary-Tint 18 %).
- **Stil wechseln:** Als Pill-Button (corner-full, Outline, swap_horiz-Icon), nicht als Text-Link. Hover: Primary-Border und -Text.
- **Kategorien:** Jede Kategorie als eigene Karte (surface-container-low, Border, border-radius medium), klare Labels (title-small, font-weight 600).
- **Chips:** Leichter Active-State (scale 0.98) bei `:active`, nur wenn reduced-motion aus.
- **Spielerisch-Variant:** Modal mit `--app-corner-playful`, Primary-getöntem Border, Panel-Verlauf und Glow über `--app-shadow-card-playful` (Klasse `.preset-toast--playful`). Kategorien als ruhige Insets. Countdown-GIF ohne `!important`, Höhe per `clamp`.

## Preset-Snackbar (Startseite): Design

- **Form:** Pill (corner-full). Serioes: `inverse-surface` / `inverse-on-surface` / `inverse-primary`. Spielerisch: Surface-Verlauf wie die Toolbar, Text `on-surface`, Aktion Tertiary, Icon-Kachel umrandet in Primary. Bottom mit `max(1.5rem, env(safe-area-inset-bottom))` fuer Notch-Geraete.
- **Icon:** In rundem Container (Serioes: inverse-on-surface 22 %; Spielerisch: transparente Kachel mit Primary-Rand), nicht nackt neben Text.
- **Animation:** Einblendung translateY + scale(0.96) → 1, nur bei `prefers-reduced-motion: no-preference`.

## Preset-Toast: Wording

- **Titel:** Nur "Seriös" / "Spielerisch" (ohne "Preset:"). **Englisch (`en`):** Toggles und Toast-Titel **Business** / **Gamification** — siehe **`docs/ui/ENGLISH-UI-COPY.md`**.
- **Hinweise:** Nutzenorientiert, keine reine Feature-Liste. Serioes: "Ohne Wettbewerb, mit Lesephase – Fokus auf Inhalte." Spielerisch: "Mit Rangliste, Action Sounds und Anfeuerung – fuer mehr Motivation."
- **Stil wechseln:** Link-Text "Stil wechseln zu Serioes/Spielerisch".
- **Subtitle:** "Tippen zum An- oder Ausschalten. Mit „Speichern“ uebernehmen." (kurz, handlungsorientiert).
- **Kategorien:** "Spiel & Auswertung", "Teilnahme & Namen", "Ablauf & Zeit", "Team", "Ton & Musik". Kein Anglizismus "Nicknames".
- **Optionen:** Aussagekraeftige Labels (z. B. "Teams automatisch oder manuell zuweisen", "Hintergrundmusik in der Lobby", "Zeitlimit pro Frage"). Kein redundanter Zusatz "(Countdown)".
- **Namensmodus:** "Nicks", "Eigen", "Anonym" (kurz halten, damit auf kleinen Screens kein horizontales Scrollen noetig ist).
- **Label fuer vorgegebene Namen:** "Altersgruppe:" (Select fuer Nobelpreisträger, Tier-Icons, Grundschule, etc.). Aria-Label: "Altersgruppe waehlen".
- **Schliessen-Button:** aria-label "Einstellungen schliessen".

## Seitenuebergreifend: UX und Wording

- **Zurueck zur Startseite:** Nur ueber Logo und Produktname in der Top-Toolbar; keine expliziten "Startseite"-Links auf Inhaltseiten und kein zusaetzliches Home-Icon neben der Marke.
- **Ladezustaende:** Kurz "Wird geladen…" (ohne "Session" oder Kontext, wenn der Kontext schon klar ist).
- **Fehlermeldungen:** Nutzerorientiert, kein Technik-Jargon. "Ungültiger Code." statt "Ungültiger Session-Code."; "Nicht gefunden. Code prüfen oder neu eingeben."; "Seite konnte nicht geladen werden." statt "Inhalt konnte nicht geladen werden.".
- **Platzhalter-Hinweise:** Keine Story-/Epic-Referenzen in der UI. Stattdessen kurze nutzerorientierte Hinweise (z. B. "Hier Quizzes anlegen und verwalten.", "Lobby und Steuerung werden hier angezeigt.").
- **Leere Tabs/Listen:** Wenn Tab-Titel oder umgebender Kontext die Funktion schon traegt, reicht ein **minimaler** Hinweis (z. B. "Noch keine Fragen.") – ohne erklaerenden Zusatzsatz, der nur wiederholt, was unten ohnehin passiert.
- **Footer-Badges:** Reihenfolge wie auf der Startseite: "Kostenlos · 100 % DSGVO-konform · Open Source".
- **Wiederholungs-Buttons:** Einheitlich "Nochmal versuchen" (Retry/Reconnect), mit `aria-label` wo noetig (z. B. "Verbindung erneut pruefen").

## Nicht erlaubt

- Tailwind-Klassen im Repository.
- Direkte Überschreibung interner Material-Klassen in Feature-SCSS (`::ng-deep`, `:deep(...)`, fragile MDC-Selektoren ohne globale Scope-Klasse).
- Hardcoded Hex/RGB-Farben fuer Standard-UI-Semantik; Hex-Fallbacks an `--arsnova-*`/`--app-*` in Feature-SCSS.
- `999px`-Radii (außer dokumentiertem Histogram-Stab) und `font-weight: 800`.
- Glas-/Surface-Prospekt um Solo-Floating-CTAs entgegen dem Floating-Bottom-Contract.
- Wildwuchs an einmaligen Layout-Hacks pro Feature.

## Performance (Lighthouse)

- **Fonts:** Material Icons nutzen `font-display: swap`, damit Lighthouse keine unsichtbare Textphase meldet und die Icons nach dem Font-Load regulär ersetzen. Kein Preload im Index, um Ladepfade nicht zu stören.
- **Aktueller Mobile-Nachweis:** Der CI-nahe lokale Lauf vom 2026-07-10
  erreichte fuer `/de/` und `/en/` reproduzierbar nur **55 % Performance** und
  rund **11,1 s LCP**. Damit sind die verbindlichen Gates von 60 % und 5 s
  derzeit nicht erfuellt. Die App liefert rund 386 kB Initial-JS
  (Framework, Router, Material) plus Home-Chunk; diese Kosten und der konkrete
  LCP-Kandidat muessen profiliert werden. Ein theoretisch vorhandenes
  Pre-Rendering ist kein Ersatz fuer den Messnachweis.
- **SSR/Pre-Render:** `@angular/ssr` ist aktiv. Routen `''`, `help`, `quiz` werden beim Build pre-rendert (statisches HTML in `dist/browser`). Root-Route nutzt ggf. `index.csr.html` (Fallback); Backend liefert `index.csr.html` aus, wenn `index.html` fehlt. ThemePresetService und AppComponent nutzen `isPlatformBrowser`, damit Prerender (Node) nicht auf `localStorage`/`navigator` zugreift. Voll-SSR (laufender Node-Server pro Request) wird nicht genutzt – nur Pre-Render + Auslieferung durch Express.
- **Diagnose:** In Lighthouse unter „Reduce JavaScript execution time“ / „View Treemap“ prüfen, welche Skripte die meiste Haupt-Thread-Zeit verbrauchen.
- **Ressourcen:** Keine render-blockierenden Skripte im `<head>`; Lazy Loading fuer Routen bleibt Standard. Build inlinet bereits Critical CSS und laedt Stylesheet non-blocking.
- **Messprotokoll:** [Lokaler Gesamt-Testlauf 2026-07-10](../implementation/LOCAL-TESTRUN-2026-07-10.md) und [Lighthouse Performance](LIGHTHOUSE-PERFORMANCE.md).

## Dokumente

- ADR: `docs/architecture/decisions/0005-use-angular-material-design.md`
- ADR: `docs/architecture/decisions/0010-blitzlicht-as-core-live-mode.md`
- Tokens: `docs/ui/TOKENS.md`
- Guideline: `docs/ui/BLITZLICHT-GUIDELINES.md`
- PR-Checkliste: `docs/ui/PR-CHECKLIST-UI.md`
- i18n / Anführungszeichen: `docs/I18N-ANGULAR.md`, `docs/ui/ENGLISH-UI-COPY.md`
