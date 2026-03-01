# UI Styleguide (Angular Material 3)

## Ziel und Geltungsbereich
Dieser Styleguide definiert verbindliche UI-Regeln fuer `apps/frontend` von arsnova.click v3.
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

## Accessibility und Interaktion
- Kontrast und Lesbarkeit muessen in Light und Dark erfuellt sein.
- Fokuszustand muss klar sichtbar sein (bei Bedarf `mat.strong-focus-indicators()`).
- Disabled, Error und Hover/Focus-Zustaende nur ueber passende Tokens ausdruecken.

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
- **Meta-Zeile** unter den Segments: Zaehler links (`3/6`), Hilfetext rechts.
- Responsive: Groessere Boxen auf Desktop (3 rem x 3.5 rem vs. 2.5 rem x 3 rem Mobile).

## Startseite: Hero und Onboarding
- **Hero-Text:** Nutzenversprechen, kein Feature-Listing. Verben statt Nomen.
- **Alleinstellungsmerkmale (USP):** Direkt unter dem Hero zwei Zeilen: (1) Zielgruppenauswahl – z. B. „Angepasst an deine Zielgruppe: von Kindergarten bis Oberstufe, serioes oder spielerisch.“ In Primary-Farbe, body-large. (2) Bonus-Option – z. B. „Bonus fuer die Besten: Code bei der Quizleitung einloesbar.“ Einzeilig auf Desktop (max-width 38rem ab 600px); „Code“ statt „Token“. Als zweite Zeile, body-medium, on-surface-variant (`.home-hero-usp--secondary`). Beide zentriert, max-width begrenzt.
- **Icon-Cluster:** 3 Icons (quiz, forum, how_to_vote) in primary-getoenten Kreisen, verbunden durch Dots. `aria-hidden="true"` da dekorativ.
- **Trust-Badges:** Staerkstes Argument zuerst (Kostenlos > DSGVO-konform > Open Source).
- **Kein Onboarding-Banner:** Nach den Hero-Erweiterungen (USPs, Bonus-Option, ggf. Preset-Toggle) wird kein zusaetzliches 3-Schritt-Banner mehr angezeigt. Die Karten (Mitmachen/Veranstalten) und die Hilfe-Seite erklaeren den Ablauf.

## Startseite: Status-Indikator
- Der **Status-Dot** ist in das Brand-Icon (SVG) integriert: Ein Circle unten rechts faerbt sich dynamisch (rot = `--mat-sys-error`, gruen = `--app-status-healthy`). `role="status"` + dynamisches `aria-label` auf dem SVG.
- Die **Status-Card** im Grid bleibt fuer detaillierte Infos erhalten.

## Startseite: Mobile-Hierarchie
- Auf Mobile (`< 600 px`) erhaelt die Mitmachen-Karte einen **3 px Primary-Top-Border** als visuellen Akzent, um sie als primaere Aktion hervorzuheben.

## Wording: Anrede und Typografie
- **Gedankenstriche:** In der UI sparsam einsetzen – wirken schnell akademisch oder schwer. Stattdessen Komma, Doppelpunkt oder Punkt (z. B. „Angepasst an deine Zielgruppe: von Kindergarten …“ statt „… Zielgruppe – von …“).
- **Duzen:** In der gesamten App (Hilfe, Hinweise, Buttons, Fehlermeldungen) wird die Nutzerin/der Nutzer mit **Du** angesprochen – einheitlich fuer alle Rollen (Veranstaltende und Teilnehmende). Entspricht dem Vorgehen vieler Lern- und Umfrage-Apps (z. B. Mentimeter, Kahoot!, Slido). Formelles "Sie" nur in rechtlichen Texten (Impressum, Datenschutz), wo ueblich.
- **Rollenbezeichnungen:** "Mitmachen" (statt "Teilnehmer/in"), "Veranstalten" (statt "Lehrperson"). Aktivierend, rollenunabhaengig.
- **CTAs:** Handlungsauffordernd mit klarem Nutzen: "Los geht's" (statt "Beitreten"), "Neues Quiz starten" (statt "Session erstellen"), "Aus Bibliothek" (statt "Quiz auswaehlen"), "Fragerunde" (statt "Q&A").
- **Hilfetext Session-Code:** "6 Zeichen, z. B. ABC123" -- kurz, konkret, kontextneutral.
- **Server-Status:** "Verbunden" / "Keine Verbindung" (statt "Server erreichbar/nicht erreichbar"). "Nochmal versuchen" (statt "Erneut verbinden").

## Preset-Toast (Modal): Design
- **Backdrop:** Gedimmt (`color-mix` on-surface 32 %) + leichter `backdrop-filter: blur(4px)`. Klick schliesst. Einblend-Animation (0.2 s) nur bei `prefers-reduced-motion: no-preference`.
- **Modal:** Zentriert, Einblend-Animation scale(0.96) → 1 + fade (0.25 s). Sticky-Header mit Trennlinie, damit Titel und „Stil wechseln“ beim Scrollen sichtbar bleiben.
- **Header-Akzent:** 4 px linke Randlinie; bei Preset Spielerisch in Primary-Farbe. Titelicone in Container (surface-container-high bzw. bei Spielerisch Primary-Tint 18 %).
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
- **Label fuer vorgegebene Namen:** "Altersgruppe:" (Select fuer Nobelpreistraeger, Kindergarten, Grundschule, etc.). Aria-Label: "Altersgruppe waehlen".
- **Schliessen-Button:** aria-label "Einstellungen schliessen".

## Seitenuebergreifend: UX und Wording
- **Zurueck-Links:** Immer "Startseite" mit Icon arrow_back, `aria-label="Zurueck zur Startseite"`.
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
- Tokens: `docs/ui/TOKENS.md`
- PR-Checkliste: `docs/ui/PR-CHECKLIST-UI.md`
