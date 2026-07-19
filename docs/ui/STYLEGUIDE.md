<!-- markdownlint-disable MD013 MD022 MD032 -->

# UI Styleguide (Angular Material 3)

**Stand:** 2026-07-05 — abgeglichen mit Angular 21.2, `apps/frontend/src/styles.scss`, `apps/frontend/src/styles/playful-inner-chrome.scss`, den Shared-Styles unter `apps/frontend/src/app/shared/styles/`, [TOKENS.md](TOKENS.md) und [PR-CHECKLIST-UI.md](PR-CHECKLIST-UI.md).

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
- Standard-Preset **Seriös:** Primary `mat.$azure-palette`, Tertiary `mat.$cyan-palette`.
- Preset **Spielerisch:** `html.preset-playful` überschreibt die Palette mit `mat.$magenta-palette` und `mat.$violet-palette` und setzt zusätzliche app-spezifische Surface-/Shadow-Tokens.
- `color-scheme` steuert Light/Dark-Verhalten.
- Bei Komponenten gilt: Farben nur aus Tokens, keine ad-hoc Hex-Werte.
- Standard-Hintergrund/Farbe für die App orientiert sich an `--app-bg-root`, `--mat-sys-surface` und `--mat-sys-on-surface`.
- Material Icons sind selbst gehostet und nutzen `font-display: swap`; keine externen Font-Requests einführen.

## Komponentenrichtlinien

- Neue Features verwenden zuerst Angular-Material-Komponenten.
- Eigenkomponenten sind erlaubt, wenn Material funktional nicht reicht.
- Eigene Komponenten müssen dieselben Tokens verwenden wie Material-Komponenten.
- Keine CSS-Selektoren gegen interne Material-DOM-Strukturen.
- Komponentenanpassungen nur über offizielle Override-APIs.
- Globale Overlay-Regeln sind nur mit enger `panelClass` / `backdropClass` zulässig, z. B. für MOTD-Archiv, Admin-MOTD-Template, Server-Status-Hilfe, Markdown-Bild-Lightbox und Word-Cloud-Fullscreen-Dialoge.

## Material-Dialoge: Titelzeile mit Icon (MUSS, Standarddialoge)

- **Einheitliche Gestaltung:** Standard-`MatDialog`-Komponenten im Frontend nutzen für die **Kopfzeile** dieselbe Struktur und Typografie wie der **Bonus-Codes-Dialog** (Icon-Kachel links, Überschrift rechts, optional zweite Zeile).
- **Stylesheet:** `apps/frontend/src/app/shared/styles/dialog-title-header.scss` — Klassen `dialog-title-header`, `dialog-title-header__icon`, `dialog-title-header__copy`, `dialog-title-header__heading`, optional `dialog-title-header__sub`.
- **Markup:** `h2` mit `mat-dialog-title` und Klasse `dialog-title-header`; das Icon liegt in `dialog-title-header__icon` mit `mat-icon`, der Text in `dialog-title-header__copy` (Überschrift mindestens in `dialog-title-header__heading`).
- **Einbindung:** Zusätzlich zur Komponenten-SCSS `styleUrls` um diese Datei erweitern (Pfad je nach Ordner, z. B. `../../../shared/styles/dialog-title-header.scss` aus `features/quiz/quiz-list/`).
- **Warnung / Verlassen:** Bestätigungsdialoge mit kritischem Inhalt: Icon-Wrapper mit `dialog-title-header__icon dialog-title-header__icon--warn` (Farbton aus Error-/Error-Container-Tokens).
- **Seiten- und Kartenköpfe:** Für große Seitenköpfe kann dieselbe Struktur mit `dialog-title-header--page` genutzt werden, wenn Icon+Titel semantisch zur Orientierung beitragen.
- **Ausnahmen:** Fullscreen-Arbeitsflächen wie Word-Cloud-Dialoge und die Markdown-Bild-Lightbox nutzen eigene Toolbars/Close-Buttons. Sie müssen über enge `panelClass` / `backdropClass` gestylt, tastaturbedienbar und in der PR-Checkliste als Ausnahme benannt sein.
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

- Border-Radius erfolgt ueber Shape-Tokens (z. B. `--mat-sys-corner-*`).
- Schatten/Elevation erfolgt ueber Elevation-Tokens (`--mat-sys-level*`).
- Linien/Outlines nutzen `--mat-sys-outline` oder `--mat-sys-outline-variant`.

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
- **`.l-page`:** Max-width 56 rem, zentriert, Padding 1,5 rem / 1 rem (responsive 1,5 rem / 2 rem). Fluchtlinie und Innenabstand wie auf der Startseite.
- **`.l-section`:** Max-width 42 rem, zentriert; optional in Kombination mit `.l-page` für schmalere Lesebreite (z. B. Quiz-Shell, Session, Admin).
- **`.content-page-layer`:** Für Help, Legal und News-Archiv die shared Content-Page-Struktur aus `content-page-backdrop.scss` nutzen, wenn seitliche Rails/Klickflächen und ein zentriertes Lesepanel gebraucht werden.
- **Empfehlung:** Einheitlich `<div class="l-page l-section">` als Root der Feature-Komponente (oder `class="<feature>-page l-page"` wie Admin, wenn zusätzliche Feature-Styles nötig sind). So bleibt Abstand zur Toolbar (via `.app-main__content > * > .l-page:first-child`) und Innenabstand konsistent.
- **Startseite:** Bleibt Sonderfall mit eigenem Grid/Hero; nutzt `.l-page` ohne `.l-section`.

### Above the fold auf Mobile (Design-Ziel)

- **Zielbild:** Views und Seiten auf **Mobile** nach Moeglichkeit so gestalten, dass die **Kernansicht ohne vertikales Scrollen** auskommt: Entscheidungsrelevante Infos und die **primaere Aktion** liegen im **sichtbaren Bereich unterhalb der fixierten Top-Toolbar** (Padding `main` beachten).
- **Pattern:** Entspricht **Above the fold** (Wesentliches zuerst im Viewport; weiteres optional per Scroll oder Progressive Disclosure).
- **Umsetzung:** Kompakte Hierarchie, knappe Texte, Sekundaeres einklappen oder auf zweite Ebene verlagern; Layout-Patterns (Stack/Cluster) so waehlen, dass der erste Screen nicht „leer wirkt“, aber auch nicht zwingend gescrollt werden muss, um zu handeln.
- **Ausnahmen:** Bei **langem Fliesstext** (z. B. Legal), **Bearbeitungs- oder Detailansichten** mit viel Inhalt ist Scrollen weiterhin normal und erwuenscht, wenn Lesbarkeit oder Aufgabe es erfordert. Ziel ist **weniger unnötiges Scrollen**, kein absolutes Verbot.

#### Beispiel im Code: Blitzlicht von der Startseite (Standalone-Host)

- **Kontext:** Nach „Live mit einem Klick“ auf der Startseite landet die Veranstaltende auf der **Blitzlicht-Host-Ansicht** (`FeedbackHostComponent`, Route `feedback/:code`, **nicht** eingebettet in Session-Host).
- **Above-the-fold-Umsetzung:**
  - **Ergebnisbereich zuerst** (CSS `order` im Wrapper): Balken/Titel/Stimmen-Zeile liegen im oberen Viewport; Steueraktionen und Formatwahl folgen in derselben Karte darunter.
  - **Beitritt / QR** in einer **kompakten Live-Leiste** unterhalb der Ergebnisse (analog Quiz-Live-Kanal): QR-Icon oeffnet dasselbe **Viewport-Overlay** wie im Kanal Blitzlicht beim Session-Host (`role=dialog`, scrollbarer Vollflaechen-Hintergrund, Schliessen-Button, Hinweis auf schmalen Viewports, „Session-Link kopieren“); das Overlay oeffnet nach dem Laden **einmal automatisch** (wie Lobby-Join beim Session-Host).
  - **Keine doppelte Stimmen-Zeile** in der Leiste (Zaehlung nur im Ergebnisbereich).
  - **Karten-Optik** des Dialogs: globales Styling fuer `feedback-host__join-viewport-overlay__surface.feedback-host__join-menu-panel` in `styles.scss` (gleiche Oberflaeche wie `session-host__join-viewport-overlay__surface`).
- **Referenz-Dateien:** `apps/frontend/src/app/features/feedback/feedback-host.component.{html,scss,ts}`; gemeinsame Join-Karten-Optik in `apps/frontend/src/styles.scss`; Session-Host-Referenz: `session-host__join-viewport-overlay` in `session-host.component.*`.

#### Eingebettet im Session-Host (Tab Blitzlicht)

- **Gleiche Prioritaet wie Standalone:** Im Modifier `feedback-host--embedded` steht der **Ergebnisbereich** (Balken, Titel, Stimmen) per Flexbox-`order` **vor** Format-Chips und Steueraktionen; QR/Beitritt folgen im Anschluss (kein zusaetzlicher Ergebnisblock in der Teilnehmer-Ansicht).
- **Referenz:** `feedback-host.component.scss` (Suche nach `feedback-host--embedded`).

### Leere Zustaende und Listen-Einstieg (z. B. Quiz-Sammlung)

- **Reihenfolge:** Kurzer Kontext oder Begruessung **vor** der Aktionsleiste (Import, Neues Quiz, KI-Prompt usw.), damit der erste Screen nicht nur aus CTAs besteht.
- **Copy:** **Keine Wiederholung** des Seitentitels aus dem Parent (`h1`), wenn der Kontext bereits klar ist; Headline knapp halten (z. B. „Willkommen!“ statt erneut „Quiz-Sammlung“).
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

- **`innerHTML`-Content:** Styles fuer gerendertes Markdown/KaTeX werden global und klar gescoped definiert (z. B. `.quiz-preview-*`, `.quiz-edit-*`), nicht ueber `::ng-deep`.
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

## Preset Spielerisch (Startseite)

- **Hintergrund:** Verlauf mit Primary-/Tertiary-Container (Token `--app-bg-root`).
- **Buehnen-Layout (Startseite):** Hero + USP + Preset-Umschalter liegen in `.home-hero-band` mit dezentem Verlauf/Radial-Glow (nur bei `prefers-reduced-motion: no-preference`); der Glow-Layer darf **sehr langsam** driften (`home-hero-band-spotlight-drift`). Darunter (nur Spielerisch, `isPlayfulPreset`): **Copy-Rotation** in **`.home-stage-rotator`** – kurze Nutzenzeilen zu Mitmachen / Blitzlicht / Veranstalten (i18n `homeStage.rotate1` … `rotate4`), **CSS-Crossfade** (`home-stage-copy-rotate`, Zyklus per `--home-stage-rotator-cycle`), **kein** Autoplay-Carousel mit Fokus-Diebstahl; Container `aria-hidden="true"` (dekorativ, Inhalt folgt in den Karten). Bei **`prefers-reduced-motion: reduce`** nur die **erste** Zeile sichtbar, ohne Animation. **Mitmachen** (`.home-card--stage-main`) liegt leicht **ueberlappend** unter dem Band (`margin-top` negativ), mit **staerkerer** Elevation (`level3` + `--app-shadow-card-playful`). **Blitzlicht** und **Veranstalten** (`.home-card--stage-side`) nutzen **dieselbe Bühnen-Sprache** wie die Hauptkarte (168deg-Verlauf, Primary-/Tertiary-Radials, innere Kante, weicher Farbschatten), aber **deutlich zurückhaltender**; **Blitzlicht** staerker **Primary**-betont, **Veranstalten** **Tertiary**-betont; Icon-Container mit feinem Ring; Hover etwas weniger Lift/Scale als die Hauptkarte. Ab Tablet: Rotator + Hauptkarte + Side Acts in **eigenen Grid-Zeilen** (Rotator Zeile 2, Mitmachen Zeile 3, Side Acts Zeile 4). Serioes-Preset behält das klassische 2-/3-Spalten-Raster ohne diese Hierarchie (kein Rotator).
- **Karten:** Zusaetzlicher Schatten mit Primary-Anteil (`--app-shadow-card-playful`) auf Karten ohne eigene Side-Act-Regeln. Hover: leichtes Anheben + Scale aus der Mitte, nur bei `prefers-reduced-motion: no-preference`; Side Acts haben **eigene** Hover-Stacks (Primary bzw. Tertiary).
- **Veranstalten-Karte (Ausnahme):** Ohne `--app-shadow-card-playful` und ohne `--app-shadow-cta-glow` am gefuellten CTA, damit der Tonal-Button „Deine Quiz-Sammlung“ nicht in einen farbigen Schleier faellt (`home-card--create` in `home.component.scss`).
- **Mitmachen-Karte (Spielerisch, ab 960px):** Statt flacher Graufläche: **mehrschichtiger** Kartenhintergrund (Primary-/Tertiary-Radials + diagonalen Verlauf), **innerer Primary-Streifen** (`inset` box-shadow), **Spotlight-Panel** (Klasse **`.home-spotlight-panel`**) fuer **Session-Code** und – falls vorhanden – **„Letzte Sessions“** (`.home-recent-panel`): gleiche Surface/Primary-Mischung, Innenkante, Radius; Code-Segmente groesser. Titel bleibt **headline-large** (kein Verkleinern auf Desktop).
- **Haupt-CTA:** Der gefuellte Button auf der **Mitmachen**-Karte erhaelt im Spielerisch-Modus einen dezenten Glow (`--app-shadow-cta-glow`).
- **Header:** Gradient, dezenter Primary-Rahmen, `--app-shadow-accent`.
- **Wow-Effekt (nur bei prefers-reduced-motion: no-preference):** Brand-Icon dezentes „Atmen“ (Scale 1 → 1.05 → 1, 2.5 s).
- Alle Werte tokenbasiert in `styles.scss` (html.preset-playful) und Home-Komponente.

### Innere Ansichten (Preset Spielerisch, schrittweise)

- **Welle 1** (`src/styles/playful-inner-chrome.scss`, per `@import` in `styles.scss`): **Quiz-Sammlung** (`.quiz-list-page`) – **Willkommen**-Leerbereich (`.quiz-empty-state--lead`), **Quiz-Karten** (`.quiz-list-item`), **KI-Import-Karte** (`.quiz-list__ai-card`); **Join** (`.join-page`) – **Session-Karten** ohne Fehlerzustand (`mat-card.join-card:not(.join-card--error)`), **Session-Info** in der Lobby (`.join-card--lobby .join-card__session`) als kompaktes Spotlight-innenaehnlich zu Home. **Fehler-Karte** Join bleibt sachlich ohne diese Fläche.
- **Welle 2:** **Neues Quiz** (`mat-card.quiz-form-card`) und **Quiz bearbeiten** (`.quiz-edit`: `.quiz-edit__meta-card`, `.quiz-edit__settings-card`, `.quiz-edit__form-card`, `.quiz-edit-list__empty-card`, `.quiz-edit-question`, `.quiz-edit__not-found`) mit gemeinsamem Mixin **„primary“** (wie Listen-Karten); **verschachtelte** Karten (**Einstellungen** in Neu-Quiz, **Gesamtvorschau** in Bearbeiten) mit schwächerem Mixin **„nested“** (weniger Schatten, kein `--app-shadow-card-playful`).
- **Welle 3:** **Quiz-Vorschau** – Leer-Karte, Editor-Karte, Validierungs-Karte (`mat-card`), Folien-Fläche **`.quiz-preview-question`** (Rand + Schatten/Bühnen-Glow); **Quiz-Sync** (`mat-card.quiz-sync-card`) mit **primary**-Mixin.
- **Welle 4:** **Session Vote (Teilnehmer)** – **`.vote-live-banner`**, **Bonus-** und **Feedback-Karten** mit Panel-Mixin **`app-playful-inner-panel-channel`**; **„seriöse“** Feedback-Karte im UI-Preset Spielerisch mit **nested**; **Lobby-Warteblock** (`.vote-lobby__wait`), **Lese-Banner**, **Abschluss-Hero**, **Feedback-erledigt** und **Channel-Tabs** mit Primary-Tint / Zusatzschatten; Medaillen-Varianten des Heroes behalten ihre Farben, erhalten zusätzlich **`--app-shadow-card-playful`**. **Team-Belohnung** **`.vote-team-reward`**: Shell-Mixins **`app-playful-vote-team-reward-shell`** / **`-leader`**; Kopfzeile, Team-Chip, Stat-Kacheln und Rangliste (Medaillen-Streifen, `--own`). **Ergänzend (Teilnehmeransicht):** **`section.session-channel-card`** (Q&amp;A-Tab, kein `mat-card`), gesamte **`.vote-lobby`**, **`.vote-player-badge`**, **Countdown** (nicht urgent), **`.vote-scorecard`**, **Frage** / **Diskussionsphase** / **Runden-2-Banner**, **Antwort-Buttons** (neutral + ausgewählt), **Freitext** / **Bewertung** / **„Antwort gesendet“**, **Emoji-Leiste**, **Q&amp;A-Karten** (inkl. **pinned**), **leerer Q&amp;A-Zustand**, **Moderations-Hinweis**, **Q&amp;A-Textarea**.
- **Welle 5:** **Session Present** – Sieger-, Team-Board-, Q&amp;A-, Feedback-**`mat-card`** mit **primary**; **Word-Cloud**-Sektion als Panel; **`session-placeholder`** mit **nested**. **Session Host** – Frage-/Ergebnis-/Q&amp;A-Karten und **`session-channel-card`** mit **nested** (ruhiger als Present); Placeholder wie Present.
- **Welle 6:** **Blitzlicht** – eingebettete/Standalone **`session-channel-card`** mit **nested**, **`feedback-host__error`** mit **muted**-Panel; **Teilnehmer-Blitzlicht** (`mat-card.feedback-vote__card`) **primary**; **Hilfe** und **Legal** – **`.legal-article`** im Seiten-Root mit dezentem Bühnen-Hintergrund und Rand; **Admin** (`mat-card.admin-card`) **primary**.
- **Seriös:** keine Regeln aus dieser Datei (Selektoren nur unter `html.preset-playful`).
- **Erweiterung:** Weitere Routen über dieselbe Datei oder thematische Partials anbinden; dicht belegte Host-Ansichten nur dezent tinten.

## Startseite: Buttons, Snackbar und Toast

- **Button-Hierarchie:** Auf der Veranstalten-Karte erscheint der gefuellte CTA **„Letztes Quiz starten“** nur, wenn mindestens ein **eigenes** Quiz existiert (Demo zaehlt nicht); sonst fuehrt der Einstieg ueber **„Deine Quiz-Sammlung“** (tonal, inkl. „Neues Quiz erstellen“). Hilfe als Text-Button ohne Umrandung.
- **Preset-Wechsel (Snackbar):** Klick auf Serioes/Spielerisch wendet das Preset sofort an und zeigt eine **Snackbar** (fixed bottom, `inverse-surface`-Farben, 5 s Auto-Dismiss). Die Snackbar enthaelt Icon, Label und einen "Anpassen"-Link, der das Detail-Modal oeffnet.
- **Toast (Preset-Detail-Konfiguration):** Oeffnet sich nur bei Klick auf "Anpassen" in der Snackbar. Zentriertes Modal mit Close-Button; alle Optionen als **toggelbare Chips** nach Kategorien (Gamification, Teilnahme, Ablauf, Team, Audio). Abhaengige Chips (z. B. "Teams zuweisen") werden nur angezeigt wenn der Eltern-Chip aktiv ist. Speichern uebernimmt, Zuruecksetzen setzt Preset-Defaults. Einstellungen in **localStorage**; Sync ueber Yjs geplant (Story 1.6b).
- **Abstaende:** Einheitlicher Button-/Link-Abstand auf Karten ueber `l-stack--sm` (0,5 rem).

## Startseite: Session-Code-Eingabe (Segment-Input)

- **6 Segment-Boxen** statt mat-form-field: Jede Box zeigt ein Zeichen, Monospace, zentriert. Transparenter `<input>` liegt als Overlay darueber und faengt alle nativen Interaktionen (Paste, Mobile-Keyboard).
- **Zustaende:** Leer (outline-variant Border), Active (primary Border + Pulse-Animation), Filled (primary Border + Tint-Background), Valid (success-fg Border + Glow).
- **Micro-Interactions:** Segment-Pulse auf aktiver Box (breathing-Effekt, 1 s), CTA-Pulse wenn 6. Zeichen eingegeben (scale 1 > 1.04 > 1, 350 ms), Shake bei ungültigem Submit (horizontale Vibration, 400 ms, mit rotem Border). Alle Animationen in `@media (prefers-reduced-motion: no-preference)`.
- **Beschriftung** unter den Segments: zentriert **Session-Code** (`label-medium`, on-surface-variant). Laenge und Beispiel entfallen in der Zeile; Screenreader: `aria-label` am Eingabefeld („Session-Code, 6 Zeichen“).
- Responsive: Groessere Boxen auf Desktop (3 rem x 3.5 rem vs. 2.5 rem x 3 rem Mobile).
- **Fokusvertrag:** Die allgemeine Startseite setzt keinen Autofokus; der Skip-Link bleibt erster Tabstopp. Die sichtbare Aktion **„Code eingeben“** fokussiert das native Overlay-Eingabefeld unmittelbar.
- **Dedizierter Einstieg:** Der codefreie Pfad `/join` verwendet dieselbe Startseiten-Komponente und darf die Code-Eingabe auf Geräten ohne groben Primärzeiger fokussieren. Bei primärer Touch-Eingabe bleibt der Fokus unverändert, damit ein direkter Link nicht ungefragt die Bildschirmtastatur öffnet; ein bewusster Klick auf „Code eingeben“ fokussiert weiterhin.

## Startseite: Hero und Onboarding

- **Hero-Text:** Nutzenversprechen, kein Feature-Listing. Verben statt Nomen.
- **Alleinstellungsmerkmale (USP):** Direkt unter dem Hero: (1) Zielspanne und Stil – z. B. „Kita bis Uni – serioes oder spielerisch.“ In Primary-Farbe, body-large. (2) Bonus-Option – nur im Preset **Spielerisch**: z. B. „Bonus fuer die Besten: Code bei der Quizleitung einloesbar.“ Einzeilig auf Desktop (max-width 38rem ab 600px); „Code“ statt „Token“. Als zweite Zeile, body-medium, on-surface-variant (`.home-hero-usp--secondary`). Beide zentriert, max-width begrenzt.
- **Trust-Badges:** Staerkstes Argument zuerst (Kostenlos > DSGVO-konform > Open Source).
- **Kein Onboarding-Banner:** Nach den Hero-Erweiterungen (USPs, Bonus-Option, ggf. Preset-Toggle) wird kein zusaetzliches 3-Schritt-Banner mehr angezeigt. Die Karten (Mitmachen/Veranstalten) und die Hilfe-Seite erklaeren den Ablauf.

## Startseite: Brand und Status

- **Brand-Icon:** EU-Blau als Hintergrund (stilistische Anlehnung, kein offizielles EU-Emblem). Im Logo: EU-gelber Stern (arsnova-stern-eu, Pentagramm wie EU-Flagge, eine Spitze oben), Farbe `--app-eu-yellow`; Logo-Stern-Farbe wird nicht themenabhängig geändert. Im Titel nur „arsnova.eu“ mit normalem Punkt (kein Stern im Wortmarken-Text). Farben: `--app-eu-blue`, `--app-eu-blue-dark`, `--app-eu-yellow` (als Brand-Ausnahme in [TOKENS.md](TOKENS.md) dokumentiert).
- **Status nur auf der Karte:** Kein Status-Punkt im Header; der Server-Status wird ausschliesslich in der **Status-Card** im Grid angezeigt (detaillierte Infos, z. B. „Quiz live“, „Verbunden“).

## Startseite: Mobile-Hierarchie

- Auf Mobile (`< 600 px`) erhaelt die Mitmachen-Karte einen **3 px Primary-Top-Border** als visuellen Akzent, um sie als primaere Aktion hervorzuheben.

## Top-Toolbar und Scroll-Verhalten (seitenuebergreifend)

- **Inhalt:** Logo (Link zur Startseite), Preset-Umschalter (Serioes/Spielerisch), Theme-Umschalter (System/Dark/Light), Sprachauswahl. Die Toolbar erscheint auf **allen** Seiten (Startseite, Quiz, Session, Help, Legal).
- **Position:** Die Toolbar ist **fixiert** (position: fixed), damit Hide-on-Scroll funktioniert. Der Hauptinhalt (`main`) erhaelt `padding-top: 3.5rem`, damit nichts unter der Toolbar verschwindet.
- **Hide-on-Scroll (UX-Empfehlung):** Entsprechend Material Design und UX-Research (Hybrid-Pattern) gilt auf **allen** Seiten: Beim **Runterscrollen** (ab ca. 80 px) wird die Toolbar ausgeblendet (transform translateY(-100%)), beim **Hochscrollen** erscheint sie wieder. So bleibt mehr Platz fuer Inhalt beim Lesen, die Navigation ist beim Hochscrollen sofort wieder da. Animation der Ein-/Ausblendung nur bei `prefers-reduced-motion: no-preference`.
- **Scroll-Elevation:** Sobald gescrollt wurde (scrollY > 0), erhaelt die Toolbar einen staerkeren Schatten (`--mat-sys-level2`) zur Abhebung vom Inhalt (Material/Apple-konform).
- **Preset Spielerisch:** Die Top-Toolbar nutzt **dieselbe visuelle Sprache** wie Startseiten-Bühne/Hero: **Primary-/Tertiary-Verlauf** auf `surface-container`, **Primary-Rand**, **`--app-shadow-accent`**, **Innenlicht** (`inset`), dezent **radialer Highlight** oben rechts (nur bei `prefers-reduced-motion: no-preference`). **Gescrollt:** zusaetzlicher **Primary-Tiefenschatten**. **Brand-SVG:** leichtes **Pulsieren** (`home-playful-brand-pulse`), Preset-Toggle **checked** mit **primary-container**-Flaeche; **Spielerisch-Icon** in Primary. **Mobile-Ausklappbereich:** Trennlinie primary-getoent; **Locale-Hinweis** (Dev) mit leicht getoenter Fläche und Rand.
- **Mobile:** Kompakte Hoehe (min-height 48 px, reduziertes Padding 0.5 rem / 0.75 rem), damit die Toolbar wenig Platz wegnimmt.
- **Bei Navigation:** Beim Seitenwechsel (NavigationEnd) wird die Toolbar wieder eingeblendet (sichtbar beim Landen auf einer neuen Seite).
- **Fokus-Steuerung:** Beim Anzeigen der Preset-Snackbar oder des Preset-Toasts wird das fokussierte Eingabefeld (z. B. Session-Code auf der Startseite) geblurt, damit die virtuelle Tastatur auf Mobile schliesst und Snackbar/Toast nicht ueberdeckt. Beim Schliessen wird optional wieder fokussiert (PresetSnackbarFocusService). Startseite registriert den Session-Code-Input; Toolbar ruft nach Sprach-/Theme-Wechsel refocusInput auf.

## Wording: Anrede und Typografie

- **Gedankenstriche:** In der UI sparsam einsetzen – wirken schnell akademisch oder schwer. Stattdessen Komma, Doppelpunkt oder Punkt (z. B. „Kita bis Uni …“ statt „… Zielgruppe – von …“).
- **Duzen:** In der gesamten App (Hilfe, Hinweise, Buttons, Fehlermeldungen) wird die Nutzerin/der Nutzer mit **Du** angesprochen – einheitlich fuer alle Rollen (Veranstaltende und Teilnehmende). Entspricht dem Vorgehen vieler Lern- und Umfrage-Apps (z. B. Mentimeter, Kahoot!, Slido). Formelles "Sie" nur in rechtlichen Texten (Impressum, Datenschutz), wo ueblich.
- **Rollenbezeichnungen:** "Mitmachen" (statt "Teilnehmer/in"), "Veranstalten" (statt "Lehrperson"). Aktivierend, rollenunabhaengig. **Teilnehmer-Perspektive (Live):** Steuernde als **Moderation** oder **Host** benennen, nicht als Dozent/Lehrperson (siehe unten „Zielgruppenneutrale Copy“). Kurzlinks z. B. **„Als Host anzeigen“** (`@@sessionEntry.showHostLink`).
- **CTAs:** Handlungsauffordernd mit klarem Nutzen: "Los geht's" (statt "Beitreten"), "Neues Quiz starten" (statt "Session erstellen"), Begriffe zur **Quiz-Sammlung** statt generisch „Bibliothek“, "Fragerunde" (statt "Q&A"). **Hinweis:** Das Wort **Quiz** ist im Produkt fest verankert; breitere Begriffe (z. B. „Interaktionen“, „Fragerunde“ als Navigation) nur bei einer **eigenen Story** mit durchgaengigem i18n – nicht punktuell mischen.
- **Session-Code (Startseite):** Sichtbar nur zentrierte Bezeichnung **Session-Code**; Details (6 Zeichen) in **aria-label** des Overlays.
- **Server-Status:** "Verbunden" / "Keine Verbindung" (statt "Server erreichbar/nicht erreichbar"). "Nochmal versuchen" (statt "Erneut verbinden").

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
- **Spielerisch-Variant:** Modal mit `--app-corner-playful`, Primary-getoenter Border und dezentem Glow-Schatten.

## Preset-Snackbar (Startseite): Design

- **Form:** Pill (corner-full), inverse-surface-Farben, dezenter Rand und Schatten. Bottom mit `max(1.5rem, env(safe-area-inset-bottom))` fuer Notch-Geraete.
- **Icon:** In rundem Container (inverse-on-surface 22 %), nicht nackt neben Text.
- **Animation:** Einblendung translateY + scale(0.96) → 1, nur bei `prefers-reduced-motion: no-preference`.

## Preset-Toast: Wording

- **Titel:** Nur "Seriös" / "Spielerisch" (ohne "Preset:"). **Englisch (`en`):** Toggles und Toast-Titel **Business** / **Gamification** — siehe **`docs/ui/ENGLISH-UI-COPY.md`**.
- **Hinweise:** Nutzenorientiert, keine reine Feature-Liste. Serioes: "Ohne Wettbewerb, mit Lesephase – Fokus auf Inhalte." Spielerisch: "Mit Rangliste, Action Sounds und Anfeuerung – fuer mehr Motivation."
- **Stil wechseln:** Link-Text "Stil wechseln zu Serioes/Spielerisch".
- **Subtitle:** "Tippen zum An- oder Ausschalten. Mit „Speichern“ uebernehmen." (kurz, handlungsorientiert).
- **Kategorien:** "Spiel & Auswertung", "Teilnahme & Namen", "Ablauf & Zeit", "Team", "Ton & Musik". Kein Anglizismus "Nicknames".
- **Optionen:** Aussagekraeftige Labels (z. B. "Teams automatisch oder manuell zuweisen", "Hintergrundmusik in der Lobby", "Zeitlimit pro Frage"). Kein redundanter Zusatz "(Countdown)".
- **Namensmodus:** "Nicks", "Eigen", "Anonym" (kurz halten, damit auf kleinen Screens kein horizontales Scrollen noetig ist).
- **Label fuer vorgegebene Namen:** "Altersgruppe:" (Select fuer Nobelpreisträger, Kita, Grundschule, etc.). Aria-Label: "Altersgruppe waehlen".
- **Schliessen-Button:** aria-label "Einstellungen schliessen".

## Seitenuebergreifend: UX und Wording

- **Zurueck zur Startseite:** Nur ueber Logo oder Home-Icon in der Top-Toolbar; keine expliziten "Startseite"-Links auf Inhaltseiten (NN/G: auf der Startseite selbst keinen aktiven Home-Link anbieten).
- **Ladezustaende:** Kurz "Wird geladen…" (ohne "Session" oder Kontext, wenn der Kontext schon klar ist).
- **Fehlermeldungen:** Nutzerorientiert, kein Technik-Jargon. "Ungültiger Code." statt "Ungültiger Session-Code."; "Nicht gefunden. Code prüfen oder neu eingeben."; "Seite konnte nicht geladen werden." statt "Inhalt konnte nicht geladen werden.".
- **Platzhalter-Hinweise:** Keine Story-/Epic-Referenzen in der UI. Stattdessen kurze nutzerorientierte Hinweise (z. B. "Hier Quizzes anlegen und verwalten.", "Lobby und Steuerung werden hier angezeigt.").
- **Leere Tabs/Listen:** Wenn Tab-Titel oder umgebender Kontext die Funktion schon traegt, reicht ein **minimaler** Hinweis (z. B. "Noch keine Fragen.") – ohne erklaerenden Zusatzsatz, der nur wiederholt, was unten ohnehin passiert.
- **Footer-Badges:** Reihenfolge wie auf der Startseite: "Kostenlos · 100 % DSGVO-konform · Open Source".
- **Wiederholungs-Buttons:** Einheitlich "Nochmal versuchen" (Retry/Reconnect), mit `aria-label` wo noetig (z. B. "Verbindung erneut pruefen").

## Nicht erlaubt

- Tailwind-Klassen im Repository.
- Direkte Überschreibung interner Material-Klassen.
- Hardcoded Hex/RGB-Farben fuer Standard-UI-Semantik.
- Wildwuchs an einmaligen Layout-Hacks pro Feature.

## Performance (Lighthouse)

- **Fonts:** Material Icons nutzen `font-display: swap`, damit Lighthouse keine unsichtbare Textphase meldet und die Icons nach dem Font-Load regulär ersetzen. Kein Preload im Index, um Ladepfade nicht zu stören.
- **Aktueller Mobile-Nachweis:** Der CI-nahe lokale Lauf vom 2026-07-10
  erreichte fuer `/de/` und `/en/` reproduzierbar nur **55 % Performance** und
  rund **11,1 s LCP**. Damit sind die verbindlichen Gates von 60 % und 4 s
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
