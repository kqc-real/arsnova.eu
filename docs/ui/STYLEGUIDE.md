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
- **Icon-Cluster:** 3 Icons (quiz, forum, how_to_vote) in primary-getoenten Kreisen, verbunden durch Dots. `aria-hidden="true"` da dekorativ.
- **Trust-Badges:** Staerkstes Argument zuerst (Kostenlos > DSGVO-konform > Open Source).
- **Onboarding-Banner (Erstbesucher):** 3-Schritt-Visual (Quiz erstellen > Code teilen > Live spielen) mit Icons in Primary-Kreisen und Chevron-Pfeilen. Nur bei erstem Besuch (`localStorage: home-visited`), schliessbar. `grid-column: 1 / -1` auf Desktop.

## Startseite: Status-Indikator
- Der **Status-Dot** ist in das Brand-Icon (SVG) integriert: Ein Circle unten rechts faerbt sich dynamisch (rot = `--mat-sys-error`, gruen = `--app-status-healthy`). `role="status"` + dynamisches `aria-label` auf dem SVG.
- Die **Status-Card** im Grid bleibt fuer detaillierte Infos erhalten.

## Startseite: Mobile-Hierarchie
- Auf Mobile (`< 600 px`) erhaelt die Mitmachen-Karte einen **3 px Primary-Top-Border** als visuellen Akzent, um sie als primaere Aktion hervorzuheben.

## Startseite: Wording-Konventionen
- **Rollenbezeichnungen:** "Mitmachen" (statt "Teilnehmer/in"), "Veranstalten" (statt "Lehrperson"). Aktivierend, rollenunabhaengig.
- **CTAs:** Handlungsauffordernd mit klarem Nutzen: "Los geht's" (statt "Beitreten"), "Neues Quiz starten" (statt "Session erstellen"), "Aus Bibliothek" (statt "Quiz auswaehlen"), "Fragerunde" (statt "Q&A").
- **Hilfetext Session-Code:** "6 Zeichen, z. B. ABC123" -- kurz, konkret, kontextneutral.
- **Server-Status:** "Verbunden" / "Keine Verbindung" (statt "Server erreichbar/nicht erreichbar"). "Nochmal versuchen" (statt "Erneut verbinden").

## Nicht erlaubt
- Tailwind-Klassen im Repository.
- Direkte Ueberschreibung interner Material-Klassen.
- Hardcoded Hex/RGB-Farben fuer Standard-UI-Semantik.
- Wildwuchs an einmaligen Layout-Hacks pro Feature.

## Dokumente
- ADR: `docs/architecture/decisions/0005-use-angular-material-design.md`
- Tokens: `docs/ui/TOKENS.md`
- PR-Checkliste: `docs/ui/PR-CHECKLIST-UI.md`
