<!-- markdownlint-disable MD013 MD022 MD032 -->

# UI Styleguide (Angular Material 3)

## Ziel und Geltungsbereich

Dieser Styleguide definiert verbindliche UI-Regeln fuer `apps/frontend` von arsnova.eu.
Ergaenzend zur ADR `docs/architecture/decisions/0005-use-angular-material-design.md` beschreibt er die operative Umsetzung im Alltag.

## Grundsaetze

- Angular Material ist der Standard fuer interaktive UI-Elemente.
- Material 3 ist die visuelle und semantische Grundlage.
- Styling ist tokenbasiert und zentral gesteuert.
- Kein Tailwind im Repository.
- Eigenes SCSS ist erlaubt fuer Layout-Patterns und app-spezifische Strukturen.

## Theming und Farbmodus

- Das globale Theme wird auf Root-Ebene (`html`) mit `mat.theme(...)` definiert.
- `color-scheme` steuert Light/Dark-Verhalten.
- Bei Komponenten gilt: Farben nur aus Tokens, keine ad-hoc Hex-Werte.
- Standard-Hintergrund/Farbe fuer die App orientiert sich an `--mat-sys-surface` und `--mat-sys-on-surface`.

## Komponentenrichtlinien

- Neue Features verwenden zuerst Angular-Material-Komponenten.
- Eigenkomponenten sind erlaubt, wenn Material funktional nicht reicht.
- Eigene Komponenten muessen dieselben Tokens verwenden wie Material-Komponenten.
- Keine CSS-Selektoren gegen interne Material-DOM-Strukturen.
- Komponentenanpassungen nur ueber offizielle Override-APIs.

## Token-Nutzung

- System-Tokens: `--mat-sys-*`.
- App-Semantik-Tokens (z. B. Erfolg/Warnung/Info) mappen auf System-Tokens.
- Direkte Farbwerte in Feature-SCSS sind nur mit begruendeter Ausnahme erlaubt.

## Typografie

- Typografie folgt der M3-Type-Scale (Display, Headline, Title, Body, Label).
- Fuer Texte in Komponenten bevorzugt Typo-Tokens wie `--mat-sys-body-medium`.
- Keine freien Font-Groessen/Line-Heights ohne Design-System-Bedarf.

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

### Layout-Vorgabe fuer Inhaltseiten (alle ausser Startseite)

- **Root-Container:** Jede Seite (Quiz, Session, Legal, Help, Join, Admin usw.) nutzt als aeusseren Container eine der globalen Layout-Klassen aus `styles.scss`.
- **`.l-page`:** Max-width 56 rem, zentriert, Padding 1,5 rem / 1 rem (responsive 1,5 rem / 2 rem). Fluchtlinie und Innenabstand wie auf der Startseite.
- **`.l-section`:** Max-width 42 rem, zentriert; optional in Kombination mit `.l-page` fuer schmalere Lesebreite (z. B. Quiz-Shell, Session, Admin).
- **Empfehlung:** Einheitlich `<div class="l-page l-section">` als Root der Feature-Komponente (oder `class="<feature>-page l-page"` wie Legal/Help, wenn zusaetzliche Feature-Styles noetig sind). So bleibt Abstand zur Toolbar (via `.app-main > * > .l-page:first-child`) und Innenabstand konsistent.
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
  - **Beitritt / QR** in einer **kompakten Live-Leiste** unterhalb der Ergebnisse (analog Quiz-Live-Kanal): QR-Icon oeffnet ein **`mat-menu`** mit grossem QR und Code; das Menue oeffnet nach dem Laden **einmal automatisch** (wie Lobby-Join-Menue beim Session-Host).
  - **Keine doppelte Stimmen-Zeile** in der Leiste (Zaehlung nur im Ergebnisbereich).
  - **Popup horizontal mittig** (globales Overlay-Styling fuer `feedback-host__join-menu-overlay-panel` in `styles.scss`).
- **Referenz-Dateien:** `apps/frontend/src/app/features/feedback/feedback-host.component.{html,scss,ts}`; Overlay-Panel-Klassen in `apps/frontend/src/styles.scss` (gemeinsam mit Session-Host-Join-Menue, wo dokumentiert).

## Accessibility und Interaktion

- Kontrast und Lesbarkeit muessen in Light und Dark erfuellt sein.
- Fokuszustand muss klar sichtbar sein (bei Bedarf `mat.strong-focus-indicators()`).
- Disabled, Error und Hover/Focus-Zustaende nur ueber passende Tokens ausdruecken.

## Verbindliche Lesbarkeitsregeln (MUSS)

- **Text-Rhythmus:** Fuer Fliesstext in Feature-Screens `line-height` mindestens `1.5`; fuer Hint-/Error-Texte mindestens `1.4`.
- **Formular-Abstaende:** Zwischen aufeinanderfolgenden Eingabefeldern mindestens `1rem` vertikaler Abstand; zwischen Feld und Hint/Error mindestens `0.2rem`.
- **Card-Header-Abstaende:** Zwischen Title und Subtitle mindestens `0.15rem`; zwischen Header und erstem Inhaltselement mindestens `0.4rem`.
- **Label-Lesbarkeit:** Feldlabels duerfen nicht abgeschnitten werden; Umbruch ist erlaubt, aber ohne Silbentrennung (`hyphens: none`).
- **Lange Hinweise:** Lange Hint-/Tooltip-Texte muessen ohne horizontales Scrollen lesbar bleiben (mobil und desktop).

## Formularverhalten bei Fehlern (MUSS)

- **Erster Fehler:** Bei Submit mit ungueltigem Formular wird immer zum ersten fehlerhaften Feld gescrollt und fokussiert.
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
- **Karten:** Zusaetzlicher Schatten mit Primary-Anteil (`--app-shadow-card-playful`). Nur die ersten beiden Karten (Beitreten, Erstellen) haben Hover: leichtes Anheben + Scale aus der Mitte, nur bei `prefers-reduced-motion: no-preference`.
- **Haupt-CTA:** Der gefuellte Button erhaelt im Spielerisch-Modus einen dezenten Glow (`--app-shadow-cta-glow`).
- **Header:** Gradient, dezenter Primary-Rahmen, `--app-shadow-accent`.
- **Wow-Effekt (nur bei prefers-reduced-motion: no-preference):** Brand-Icon dezentes „Atmen“ (Scale 1 → 1.05 → 1, 2.5 s).
- Alle Werte tokenbasiert in `styles.scss` (html.preset-playful) und Home-Komponente.

## Startseite: Buttons, Snackbar und Toast

- **Button-Hierarchie:** Nur ein gefuellter CTA pro Kontext (z. B. "Neues Quiz starten" auf der Veranstalten-Karte). Sekundaere Aktionen als `tonal`-Buttons nebeneinander in einer Row (`home-cta-row`). Hilfe als Text-Button ohne Umrandung.
- **Preset-Wechsel (Snackbar):** Klick auf Serioes/Spielerisch wendet das Preset sofort an und zeigt eine **Snackbar** (fixed bottom, `inverse-surface`-Farben, 5 s Auto-Dismiss). Die Snackbar enthaelt Icon, Label und einen "Anpassen"-Link, der das Detail-Modal oeffnet.
- **Toast (Preset-Detail-Konfiguration):** Oeffnet sich nur bei Klick auf "Anpassen" in der Snackbar. Zentriertes Modal mit Close-Button; alle Optionen als **toggelbare Chips** nach Kategorien (Gamification, Teilnahme, Ablauf, Team, Audio). Abhaengige Chips (z. B. "Teams zuweisen") werden nur angezeigt wenn der Eltern-Chip aktiv ist. Speichern uebernimmt, Zuruecksetzen setzt Preset-Defaults. Einstellungen in **localStorage**; Sync ueber Yjs geplant (Story 1.6b).
- **Abstaende:** Einheitlicher Button-/Link-Abstand auf Karten ueber `l-stack--sm` (0,5 rem).

## Startseite: Session-Code-Eingabe (Segment-Input)

- **6 Segment-Boxen** statt mat-form-field: Jede Box zeigt ein Zeichen, Monospace, zentriert. Transparenter `<input>` liegt als Overlay darueber und faengt alle nativen Interaktionen (Paste, Mobile-Keyboard).
- **Zustaende:** Leer (outline-variant Border), Active (primary Border + Pulse-Animation), Filled (primary Border + Tint-Background), Valid (success-fg Border + Glow).
- **Micro-Interactions:** Segment-Pulse auf aktiver Box (breathing-Effekt, 1 s), CTA-Pulse wenn 6. Zeichen eingegeben (scale 1 > 1.04 > 1, 350 ms), Shake bei ungueltigem Submit (horizontale Vibration, 400 ms, mit rotem Border). Alle Animationen in `@media (prefers-reduced-motion: no-preference)`.
- **Beschriftung** unter den Segments: zentriert **Session-Code** (`label-medium`, on-surface-variant). Laenge und Beispiel entfallen in der Zeile; Screenreader: `aria-label` am Eingabefeld („Session-Code, 6 Zeichen“).
- Responsive: Groessere Boxen auf Desktop (3 rem x 3.5 rem vs. 2.5 rem x 3 rem Mobile).

## Startseite: Hero und Onboarding

- **Hero-Text:** Nutzenversprechen, kein Feature-Listing. Verben statt Nomen.
- **Alleinstellungsmerkmale (USP):** Direkt unter dem Hero: (1) Zielspanne und Stil – z. B. „Kita bis Uni – serioes oder spielerisch.“ In Primary-Farbe, body-large. (2) Bonus-Option – nur im Preset **Spielerisch**: z. B. „Bonus fuer die Besten: Code bei der Quizleitung einloesbar.“ Einzeilig auf Desktop (max-width 38rem ab 600px); „Code“ statt „Token“. Als zweite Zeile, body-medium, on-surface-variant (`.home-hero-usp--secondary`). Beide zentriert, max-width begrenzt.
- **Trust-Badges:** Staerkstes Argument zuerst (Kostenlos > DSGVO-konform > Open Source).
- **Kein Onboarding-Banner:** Nach den Hero-Erweiterungen (USPs, Bonus-Option, ggf. Preset-Toggle) wird kein zusaetzliches 3-Schritt-Banner mehr angezeigt. Die Karten (Mitmachen/Veranstalten) und die Hilfe-Seite erklaeren den Ablauf.

## Startseite: Brand und Status

- **Brand-Icon:** EU-Blau als Hintergrund (stilistische Anlehnung, kein offizielles EU-Emblem). Im Logo: EU-gelber Stern (arsnova-stern-eu, Pentagramm wie EU-Flagge, eine Spitze oben), Farbe `--app-eu-yellow`; Logo-Stern-Farbe wird nicht themenabhaengig geaendert. Im Titel nur „arsnova.eu“ mit normalem Punkt (kein Stern im Wortmarken-Text). Farben: `--app-eu-blue` (#002395), `--app-eu-yellow` (#ffcc00).
- **Status nur auf der Karte:** Kein Status-Punkt im Header; der Server-Status wird ausschliesslich in der **Status-Card** im Grid angezeigt (detaillierte Infos, z. B. „Quiz live“, „Verbunden“).

## Startseite: Mobile-Hierarchie

- Auf Mobile (`< 600 px`) erhaelt die Mitmachen-Karte einen **3 px Primary-Top-Border** als visuellen Akzent, um sie als primaere Aktion hervorzuheben.

## Top-Toolbar und Scroll-Verhalten (seitenuebergreifend)

- **Inhalt:** Logo (Link zur Startseite), Preset-Umschalter (Serioes/Spielerisch), Theme-Umschalter (System/Dark/Light), Sprachauswahl. Die Toolbar erscheint auf **allen** Seiten (Startseite, Quiz, Session, Help, Legal).
- **Position:** Die Toolbar ist **fixiert** (position: fixed), damit Hide-on-Scroll funktioniert. Der Hauptinhalt (`main`) erhaelt `padding-top: 3.5rem`, damit nichts unter der Toolbar verschwindet.
- **Hide-on-Scroll (UX-Empfehlung):** Entsprechend Material Design und UX-Research (Hybrid-Pattern) gilt auf **allen** Seiten: Beim **Runterscrollen** (ab ca. 80 px) wird die Toolbar ausgeblendet (transform translateY(-100%)), beim **Hochscrollen** erscheint sie wieder. So bleibt mehr Platz fuer Inhalt beim Lesen, die Navigation ist beim Hochscrollen sofort wieder da. Animation der Ein-/Ausblendung nur bei `prefers-reduced-motion: no-preference`.
- **Scroll-Elevation:** Sobald gescrollt wurde (scrollY > 0), erhaelt die Toolbar einen staerkeren Schatten (`--mat-sys-level2`) zur Abhebung vom Inhalt (Material/Apple-konform).
- **Mobile:** Kompakte Hoehe (min-height 48 px, reduziertes Padding 0.5 rem / 0.75 rem), damit die Toolbar wenig Platz wegnimmt.
- **Bei Navigation:** Beim Seitenwechsel (NavigationEnd) wird die Toolbar wieder eingeblendet (sichtbar beim Landen auf einer neuen Seite).
- **Fokus-Steuerung:** Beim Anzeigen der Preset-Snackbar oder des Preset-Toasts wird das fokussierte Eingabefeld (z. B. Session-Code auf der Startseite) geblurt, damit die virtuelle Tastatur auf Mobile schliesst und Snackbar/Toast nicht ueberdeckt. Beim Schliessen wird optional wieder fokussiert (PresetSnackbarFocusService). Startseite registriert den Session-Code-Input; Toolbar ruft nach Sprach-/Theme-Wechsel refocusInput auf.

## Wording: Anrede und Typografie

- **Gedankenstriche:** In der UI sparsam einsetzen – wirken schnell akademisch oder schwer. Stattdessen Komma, Doppelpunkt oder Punkt (z. B. „Kita bis Uni …“ statt „… Zielgruppe – von …“).
- **Duzen:** In der gesamten App (Hilfe, Hinweise, Buttons, Fehlermeldungen) wird die Nutzerin/der Nutzer mit **Du** angesprochen – einheitlich fuer alle Rollen (Veranstaltende und Teilnehmende). Entspricht dem Vorgehen vieler Lern- und Umfrage-Apps (z. B. Mentimeter, Kahoot!, Slido). Formelles "Sie" nur in rechtlichen Texten (Impressum, Datenschutz), wo ueblich.
- **Rollenbezeichnungen:** "Mitmachen" (statt "Teilnehmer/in"), "Veranstalten" (statt "Lehrperson"). Aktivierend, rollenunabhaengig.
- **CTAs:** Handlungsauffordernd mit klarem Nutzen: "Los geht's" (statt "Beitreten"), "Neues Quiz starten" (statt "Session erstellen"), Begriffe zur **Quiz-Sammlung** statt generisch „Bibliothek“, "Fragerunde" (statt "Q&A").
- **Session-Code (Startseite):** Sichtbar nur zentrierte Bezeichnung **Session-Code**; Details (6 Zeichen) in **aria-label** des Overlays.
- **Server-Status:** "Verbunden" / "Keine Verbindung" (statt "Server erreichbar/nicht erreichbar"). "Nochmal versuchen" (statt "Erneut verbinden").

### Verbindliche Begriffspaare (MUSS)

- **UI-Sprache:** "Vorschau" statt "Preview", "Tastenkürzel" statt "Hotkeys".
- **Verstaendlichkeit:** "gueltig" statt "valide".
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

- **Titel:** Nur "Seriös" / "Spielerisch" (ohne "Preset:").
- **Hinweise:** Nutzenorientiert, keine reine Feature-Liste. Serioes: "Anonym, ohne Wettbewerb – Fokus auf Inhalte." Spielerisch: "Mit Rangliste, Sounds und Anfeuerung – fuer mehr Motivation."
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
- **Fehlermeldungen:** Nutzerorientiert, kein Technik-Jargon. "Ungueltiger Code." statt "Ungueltiger Session-Code."; "Nicht gefunden. Code pruefen oder neu eingeben."; "Seite konnte nicht geladen werden." statt "Inhalt konnte nicht geladen werden.".
- **Platzhalter-Hinweise:** Keine Story-/Epic-Referenzen in der UI. Stattdessen kurze nutzerorientierte Hinweise (z. B. "Hier Quizzes anlegen und verwalten.", "Lobby und Steuerung werden hier angezeigt.").
- **Footer-Badges:** Reihenfolge wie auf der Startseite: "Kostenlos · 100 % DSGVO-konform · Open Source".
- **Wiederholungs-Buttons:** Einheitlich "Nochmal versuchen" (Retry/Reconnect), mit `aria-label` wo noetig (z. B. "Verbindung erneut pruefen").

## Nicht erlaubt

- Tailwind-Klassen im Repository.
- Direkte Ueberschreibung interner Material-Klassen.
- Hardcoded Hex/RGB-Farben fuer Standard-UI-Semantik.
- Wildwuchs an einmaligen Layout-Hacks pro Feature.

## Performance (Lighthouse)

- **Fonts:** Material Icons nutzen `font-display: block`, damit Icons erst nach Font-Load angezeigt werden (mit `swap` wuerde der System-Font-Fallback leere Kästchen zeigen). Kein Preload im Index, um Ladepfade nicht zu stören.
- **Mobile (~67 %):** Lighthouse simuliert 4x langsamere CPU. Die App ist eine reine Client-SPA: ~386 kB Initial-JS (Framework, Router, Material) plus Home-Chunk muessen geparst und ausgefuehrt werden, bevor Inhalt da ist. Bereits umgesetzt: Preset-Toast und Server-Status-Widget lazy/defer; Health-Check nach First Paint. Deutlich ueber 67 % Mobile erreichbar nur mit weniger Initial-JS (z. B. SSR/Pre-Render fuer Shell) oder Akzeptanz des SPA-Kosten.
- **SSR/Pre-Render:** `@angular/ssr` ist aktiv. Routen `''`, `help`, `quiz` werden beim Build pre-rendert (statisches HTML in `dist/browser`). Root-Route nutzt ggf. `index.csr.html` (Fallback); Backend liefert `index.csr.html` aus, wenn `index.html` fehlt. ThemePresetService und AppComponent nutzen `isPlatformBrowser`, damit Prerender (Node) nicht auf `localStorage`/`navigator` zugreift. Voll-SSR (laufender Node-Server pro Request) wird nicht genutzt – nur Pre-Render + Auslieferung durch Express.
- **Diagnose:** In Lighthouse unter „Reduce JavaScript execution time“ / „View Treemap“ prüfen, welche Skripte die meiste Haupt-Thread-Zeit verbrauchen.
- **Ressourcen:** Keine render-blockierenden Skripte im `<head>`; Lazy Loading fuer Routen bleibt Standard. Build inlinet bereits Critical CSS und laedt Stylesheet non-blocking.

## Dokumente

- ADR: `docs/architecture/decisions/0005-use-angular-material-design.md`
- ADR: `docs/architecture/decisions/0010-blitzlicht-as-core-live-mode.md`
- Tokens: `docs/ui/TOKENS.md`
- Guideline: `docs/ui/BLITZLICHT-GUIDELINES.md`
- PR-Checkliste: `docs/ui/PR-CHECKLIST-UI.md`
