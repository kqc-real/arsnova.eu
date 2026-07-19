<!-- markdownlint-disable MD013 MD022 MD032 MD060 -->

# Accessibility-Umsetzungsjournal

**Projekt:** arsnova.eu  
**Beginn:** 2026-07-19  
**Prüfmaßstab:** WCAG 2.2, Konformitätsstufe AA  
**Zugehöriger Audit:** [`ACCESSIBILITY-AUDIT-WCAG-2.2-AA.md`](./ACCESSIBILITY-AUDIT-WCAG-2.2-AA.md)

## Zweck

Dieses Journal dokumentiert fortlaufend, **was konkret umgesetzt wurde**. Es
ergänzt den Audit und den Umsetzungsplan um:

- betroffene Dateien;
- vorheriges und neues Verhalten;
- zugeordnete WCAG-Kriterien;
- automatische und manuelle Nachweise;
- Auswirkungen auf UX, Design, Performance und bestehende Abläufe;
- offene Risiken;
- spätere Pull-Request- und Commit-Referenzen.

Ein Eintrag „umgesetzt“ bedeutet nicht automatisch „formal gegen WCAG
abgenommen“. Die formale Abnahme erfolgt erst mit der manuellen Prüfmatrix aus
PR 7 des Audits.

## Statusbegriffe

| Status                    | Bedeutung                                                                      |
| ------------------------- | ------------------------------------------------------------------------------ |
| **geplant**               | Im Audit beschrieben, aber noch nicht begonnen                                 |
| **in Arbeit**             | Code oder Tests werden aktuell verändert                                       |
| **umgesetzt**             | Lokaler Code und fokussierte Tests sind fertig                                 |
| **automatisch validiert** | Gesamttests, Typecheck und erforderlicher Build sind erfolgreich               |
| **manuell abgenommen**    | Tastatur, Screenreader, Zoom und visuelle UX wurden protokolliert geprüft      |
| **abgeschlossen**         | Automatische und manuelle Abnahme sind vollständig; PR/Commit ist referenziert |

## Übersicht

| Arbeitsschnitt | Thema                                      | Status                | Automatische Validierung                                   | Manuelle Abnahme  | PR/Commit                      |
| -------------- | ------------------------------------------ | --------------------- | ---------------------------------------------------------- | ----------------- | ------------------------------ |
| PR 1           | Semantik und Eingaben                      | automatisch validiert | 950 Frontend-Tests, Typecheck, ESLint, lokalisierter Build | ausstehend        | #89 `1e3fff8c`                 |
| PR 2           | Fokus und SPA-Navigation                   | automatisch validiert | 953 Frontend-Tests, Typecheck, ESLint, lokalisierter Build | ausstehend        | #89 `1e3fff8c`                 |
| PR 3           | Dialoge und Overlays                       | automatisch validiert | 955 Frontend-Tests, Typecheck, ESLint, lokalisierter Build | ausstehend        | #89 `1e3fff8c`                 |
| PR 4           | WCAG-2.2-Interaktionen und Inhaltsstruktur | automatisch validiert | 959 Frontend-Tests, Typecheck, ESLint, lokalisierter Build | ausstehend        | #90 `e2d99a25`                 |
| PR 5           | i18n assistiver Texte                      | automatisch validiert | 964 Frontend-Tests, Typecheck, ESLint, lokalisierter Build | ausstehend        | #90 `e2d99a25`                 |
| PR 6           | automatisierte Qualitätssicherung          | automatisch validiert | Template-Lint, axe statisch/dynamisch, Lighthouse, Reflow  | ausstehend        | #91 `746f43c1`                 |
| PR 7           | manuelle Abschlussprüfung                  | in Arbeit             | Browser-/Locale-Matrix und neue Fokusregressionen grün     | AT/OS ausstehend  | Abnahme ausstehend             |
| PR 8           | PDF/UA und Dokumentation                   | automatisch validiert | veraPDF PDF/UA-1: fünf Locale-Demos PASS                   | AT/PAC ausstehend | #92 `1d5f798b`, #93 `5dfd9119` |

## PR 1 – Kritische Semantik und Eingaben

**Datum:** 2026-07-19  
**Status:** automatisch validiert  
**WCAG:** 1.3.1, 2.4.3, 2.5.2, 2.5.3, 3.3.2, 4.1.2

### 1. Vote-Submit und Pointer Cancellation

**Vorher**

Die Abstimmung wurde bereits bei `pointerdown` ausgelöst. Ein Wegziehen des
Zeigers vor dem Loslassen konnte die Aktion nicht abbrechen.

**Umsetzung**

- `pointerdown`-Handler aus dem Template entfernt;
- Methode `onVoteSubmitPointerDown` entfernt;
- fachliche Aktion wird nur noch über `click` ausgelöst;
- Regressionstest sendet `pointerdown` und `pointercancel`, erwartet noch
  keinen Submit und prüft anschließend den Click.

**Dateien**

- `apps/frontend/src/app/features/session/session-vote/session-vote.component.html`
- `apps/frontend/src/app/features/session/session-vote/session-vote.component.ts`
- `apps/frontend/src/app/features/session/session-vote/session-vote.component.spec.ts`

**UX-Einfluss**

Die Aktion erfolgt wenige Millisekunden später. Dafür werden unbeabsichtigte
Touch-/Pointer-Aktionen vermeidbar.

**Offen**

- manuelles Verhalten exakt am Ende eines Countdowns prüfen;
- sicherstellen, dass die Server-Toleranz für zeitkritische Votes fachlich
  unverändert passend ist.

### 2. Programmatische Beschriftung des Markdown-Editors

**Vorher**

Die interne `textarea` hatte keine direkte Beziehung zu den sichtbaren Labels
der aufrufenden Komponenten.

**Umsetzung**

- erforderlichen Komponenten-Input `fieldId` ergänzt;
- `fieldId` an die interne `textarea` gebunden;
- sichtbare Labels über `for` mit den Editor-Feldern verknüpft;
- statische und dynamische IDs für Quiz-Beschreibung, Fragetext und
  Antworttexte vergeben.

**Dateien**

- `apps/frontend/src/app/shared/markdown-katex-editor/markdown-katex-editor.component.ts`
- `apps/frontend/src/app/shared/markdown-katex-editor/markdown-katex-editor.component.html`
- `apps/frontend/src/app/shared/markdown-katex-editor/markdown-katex-editor.component.spec.ts`
- `apps/frontend/src/app/features/quiz/quiz-new/quiz-new.component.html`
- `apps/frontend/src/app/features/quiz/quiz-edit/quiz-edit.component.html`
- `apps/frontend/src/app/features/quiz/quiz-preview/quiz-preview.component.html`

**UX-Einfluss**

Keine neue sichtbare Textzeile. Vorhandene Labels sind nun auch anklickbar und
fokussieren das zugehörige Feld.

### 3. Sichtbare Labels für Freitext und Kurzantwort

**Vorher**

Die Eingaben verwendeten nur Placeholder. Der Kurzantwort-Zähler war dem Feld
nicht programmatisch zugeordnet.

**Umsetzung**

- persistente sichtbare Labels ergänzt;
- Labels über `for`/`id` verbunden;
- Kurzantwort-Zähler über `aria-describedby` zugeordnet;
- Label- und Zuordnungstests ergänzt.

**Dateien**

- `apps/frontend/src/app/features/session/session-vote/session-vote.component.html`
- `apps/frontend/src/app/features/session/session-vote/session-vote.component.scss`
- `apps/frontend/src/app/features/session/session-vote/session-vote.component.spec.ts`

**UX-Einfluss**

Die Labels benötigen zusätzliche vertikale Höhe und wiederholen teilweise den
Placeholder. Der Feldzweck bleibt dafür während der Eingabe sichtbar.

**Offen**

- visuelle Prüfung auf 320 CSS-Pixel;
- prüfen, ob Label und Placeholder sprachlich stärker voneinander abgegrenzt
  werden sollten.

### 4. Sternebewertung als Radiogruppe

**Vorher**

Die Container hatten `role="radiogroup"`, die Sterne waren jedoch Buttons mit
`aria-pressed`.

**Umsetzung**

- Sterne auf `role="radio"` und `aria-checked` umgestellt;
- roving `tabindex` eingeführt;
- Pfeiltasten, Pos1 und Ende implementiert;
- zyklischer Wechsel vom ersten zum letzten und vom letzten zum ersten Stern;
- beide vorhandenen Sternebewertungsansichten korrigiert;
- Semantik-, Fokus- und Tastaturtests ergänzt.

**Dateien**

- `apps/frontend/src/app/features/session/session-vote/session-vote.component.html`
- `apps/frontend/src/app/features/session/session-vote/session-vote.component.ts`
- `apps/frontend/src/app/features/session/session-vote/session-vote.component.spec.ts`

**UX-Einfluss**

Mausbedienung und Optik bleiben unverändert. Die Tab-Reihenfolge wird kürzer;
innerhalb der Gruppe werden die erwartbaren Pfeiltasten verwendet.

### 5. Home: Tab-Reihenfolge und Label in Name

**Vorher**

- Wrapper und natives Eingabefeld waren zwei Tabstopps;
- sichtbares „Los geht's“ und Accessible Name „Teilnehmen“ wichen voneinander
  ab.

**Umsetzung**

- Wrapper-`tabindex` und Wrapper-Tastaturhandler entfernt;
- nur das native Session-Code-Feld bleibt fokussierbar;
- abweichende `aria-label`-Attribute der Join-Buttons entfernt;
- Tests für Tabstopp und sichtbaren Buttontext ergänzt.

**Dateien**

- `apps/frontend/src/app/features/home/home.component.html`
- `apps/frontend/src/app/features/home/home.component.spec.ts`

**UX-Einfluss**

Visuell unverändert. Tastaturnutzer:innen benötigen einen Schritt weniger.

### Validierung PR 1

- 950 Frontend-Tests erfolgreich;
- Frontend-Typecheck erfolgreich;
- fokussierter ESLint-Lauf erfolgreich;
- lokalisierter Produktionsbuild für `de`, `en`, `fr`, `es`, `it`
  erfolgreich;
- Prettier und `git diff --check` erfolgreich;
- bekannte, nicht blockierende Warnung: Initial Bundle etwa 29 kB über dem
  konfigurierten Budget.

## PR 2 – Fokus und SPA-Navigation

**Datum:** 2026-07-19  
**Status:** automatisch validiert  
**WCAG:** 2.4.3, 2.4.7, 2.4.11

### 1. Fokus nach SPA-Navigation

**Vorher**

Nach Folge-Navigationen wurde der Scrollcontainer zurückgesetzt, der Fokus
blieb jedoch auf einem entfernten Element und fiel auf `body`.

**Umsetzung**

- vorhandene `NavigationEnd`-Behandlung erweitert;
- Initialnavigation weiterhin ausgenommen;
- Fragmentnavigationen ausgenommen, damit Ankerziele nicht überschrieben
  werden;
- nach Folge-Navigation zunächst gescrollt und anschließend die erste sichtbare
  `h1` fokussiert;
- Fallback auf das `main`-Landmark;
- temporärer `tabindex="-1"` an Überschriften wird beim Blur entfernt;
- `main` dauerhaft als programmatisches Skip-Link-Ziel fokussierbar gemacht.

**Dateien**

- `apps/frontend/src/app/app.component.ts`
- `apps/frontend/src/app/app.component.html`
- `apps/frontend/src/app/app.component.spec.ts`

**UX-Einfluss**

Mausnutzende sehen normalerweise keinen Unterschied. Abhängig vom Browser kann
kurz ein Fokusrahmen an der Überschrift sichtbar sein. Tastatur- und
Screenreader-Nutzer:innen beginnen nachvollziehbar am neuen Seitenanfang.

**Offen**

- konkurrierenden Autofokus auf der Home-Seite beobachten;
- Home → Quiz → Bearbeiten → Zurück manuell prüfen;
- 400-%-Zoom und Screenreader-Ansage prüfen.

### 2. Versteckte Toolbar bei Tastaturfokus

**Vorher**

Die Toolbar wurde vollständig aus dem Viewport transformiert, ihre Controls
konnten aber weiterhin Fokus erhalten.

**Umsetzung**

- `focusin` am Toolbar-Host setzt den Hidden-State im App-Shell zurück;
- CSS-`:focus-within` macht die Toolbar bereits im selben Rendering-Zyklus
  sichtbar;
- Regressionstest für die Wiederanzeige ergänzt.

**Dateien**

- `apps/frontend/src/app/app.component.html`
- `apps/frontend/src/app/app.component.ts`
- `apps/frontend/src/app/app.component.spec.ts`
- `apps/frontend/src/app/shared/top-toolbar/top-toolbar.component.scss`

**UX-Einfluss**

Beim Durchtabben kann die zuvor ausgeblendete Toolbar wieder erscheinen. Diese
Bewegung ist funktional notwendig, darf aber nicht überraschend animiert sein.
Die bestehende Reduced-Motion-Regel bleibt wirksam.

### 3. Prüfung fixierter Aktionsleisten

Die fixierten Vote- und Host-Aktionsleisten besitzen bereits
zustandsabhängige Bottom-Padding-Reserven. Es wurde deshalb keine zusätzliche
globale Scroll-Padding-Regel eingeführt.

**Offen**

- Fokusverdeckung durch virtuelle Tastatur, Snackbars und Aktionsleisten
  manuell bei 400 % Zoom prüfen.

### Validierung PR 2

- 953 Frontend-Tests erfolgreich;
- Frontend-Typecheck und fokussierter ESLint-Lauf erfolgreich;
- lokalisierter Produktionsbuild erfolgreich;
- Prettier und `git diff --check` erfolgreich;
- bekannte Bundle-Budget-Warnung unverändert.

## PR 3 – Dialoge und Overlays

**Datum:** 2026-07-19  
**Status:** automatisch validiert  
**WCAG:** 2.1.1, 2.4.3, 4.1.2

### 1. Inventarisierte Custom-Overlays

- Home-MOTD;
- Preset-Konfiguration;
- Tempo-Hilfe;
- Beitrittsinformationen im Feedback-Host;
- Beitrittsinformationen im Session-Host;
- Session-Endzustand in der Vote-Ansicht.

### 2. Focus Traps und Initialfokus

**Umsetzung**

- `CdkTrapFocus` in Home, Preset-Konfiguration, Feedback-Host und Session-Host
  eingebunden;
- Auto-Capture für modale Overlays aktiviert;
- Schließen-Buttons als Initialfokus markiert;
- Focus-Trap-Regressionstests ergänzt;
- bestehende visuelle Overlays beibehalten, statt sie in diesem Schritt
  vollständig neu zu gestalten.

**Dateien**

- `apps/frontend/src/app/features/home/home.component.ts`
- `apps/frontend/src/app/features/home/home.component.html`
- `apps/frontend/src/app/shared/preset-toast/preset-toast.component.ts`
- `apps/frontend/src/app/shared/preset-toast/preset-toast.component.html`
- `apps/frontend/src/app/features/feedback/feedback-host.component.ts`
- `apps/frontend/src/app/features/feedback/feedback-host.component.html`
- `apps/frontend/src/app/features/session/session-host/session-host.component.ts`
- `apps/frontend/src/app/features/session/session-host/session-host.component.html`

### 3. Escape, inerte Hintergründe und Fokus-Rückgabe

**Umsetzung**

- Preset-Konfiguration schließt nun auch mit Escape;
- bestehende Escape-Behandlung für MOTD, Tempo-Hilfe und Join-Overlays
  beibehalten und mit Focus Traps kombiniert;
- Home-Hintergrund während des MOTD über `inert` gesperrt;
- Feedback-Hintergrund während der Tempo-Hilfe über `inert` gesperrt;
- vorheriges Trigger-Element beim Öffnen gespeichert;
- Fokus nach dem Schließen auf Trigger beziehungsweise Session-Code-Feld
  zurückgegeben;
- Fallback auf den Join-Trigger bei automatisch geöffneten QR-Overlays.

### 4. Session-Endzustand

**Vorher**

Der vollständige Session-Endzustand war als modaler Dialog ausgezeichnet,
obwohl er die eigentliche Seite ersetzt und keinen modalen Hintergrund besitzt.

**Umsetzung**

- `role="dialog"` und `aria-modal="true"` entfernt;
- Zustand als benannte Region ausgezeichnet.

**Datei**

- `apps/frontend/src/app/features/session/session-vote/session-vote.component.html`

### UX-, Design- und Performance-Einfluss

- visuelle Gestaltung der Overlays bleibt unverändert;
- beim Öffnen kann der Fokusrahmen am Schließen-Button sichtbar werden;
- Tab und Shift+Tab verlassen den Dialog nicht mehr;
- Hintergrundaktionen sind während MOTD und Tempo-Hilfe bewusst nicht mehr
  möglich;
- nach dem Schließen wird die vorherige Arbeit am Trigger fortgesetzt;
- betroffene Lazy Chunks wurden im Buildvergleich jeweils grob um weniger als
  2 kB Rohgröße größer;
- Initial Bundle blieb durch den Focus-Trap-Schritt unverändert.

**Offen**

- visuelle Mobile-Prüfung aller Overlays;
- VoiceOver/Safari und NVDA/Firefox;
- lange Inhalte bei 200 % und 400 % Zoom;
- Fokus-Rückgabe, wenn der ursprüngliche Trigger während des Dialogs aus dem
  DOM entfernt wird;
- prüfen, ob eine spätere Material-/CDK-Dialogmigration Wartung weiter
  vereinfachen würde.

### Validierung PR 3

- 955 Frontend-Tests erfolgreich;
- 356 fokussierte Overlay-/Vote-Tests erfolgreich;
- Frontend-Typecheck und fokussierter ESLint-Lauf erfolgreich;
- lokalisierter Produktionsbuild erfolgreich;
- der Angular-Produktionscompiler erkannte zunächst eine strengere
  HostListener-Typanforderung; Signatur von `KeyboardEvent` auf `Event`
  korrigiert und vollständigen Build erfolgreich wiederholt;
- Formatprüfung aller geänderten Dateien und `git diff --check` erfolgreich;
- bekannte Bundle-Budget- und `pako`-CommonJS-Warnungen bleiben
  nicht-blockierend.

## PR 4 – WCAG-2.2-Interaktionen und Inhaltsstruktur

**Datum:** 2026-07-19  
**Status:** automatisch validiert  
**WCAG:** 1.3.1, 2.1.1, 2.5.7, 2.5.8

### 1. Fragen ohne Dragging sortieren

**Vorher**

Quizfragen konnten ausschließlich über den CDK-Drag-Handle umsortiert werden.
Eine Ein-Zeiger-Alternative ohne Ziehbewegung fehlte.

**Umsetzung**

- pro Frage permanente „Nach oben“- und „Nach unten“-Buttons ergänzt;
- Buttons an der ersten beziehungsweise letzten Position deaktiviert;
- Sortieraktionen während der Inline-Bearbeitung deaktiviert;
- bestehendes Drag-and-drop unverändert als zusätzliche Bedienmöglichkeit
  beibehalten;
- Drag-Handle und neue Buttons auf mindestens 44 × 44 CSS-Pixel vergrößert;
- alle drei Controls mit positionsbezogenen Accessible Names versehen;
- dieselbe Store-Methode für Dragging und Buttonbedienung verwendet.

**Dateien**

- `apps/frontend/src/app/features/quiz/quiz-edit/quiz-edit.component.html`
- `apps/frontend/src/app/features/quiz/quiz-edit/quiz-edit.component.ts`
- `apps/frontend/src/app/features/quiz/quiz-edit/quiz-edit.component.scss`
- `apps/frontend/src/app/features/quiz/quiz-edit/quiz-edit.component.spec.ts`

### 2. Positionsänderung ankündigen

**Umsetzung**

- höfliche, atomare Live-Region an der Fragenliste ergänzt;
- Ansage enthält alte Position, neue Position und Gesamtzahl;
- Signal wird vor einer neuen Ansage geleert, damit wiederholte Bewegungen
  erneut ausgegeben werden;
- Drag-and-drop und Buttonalternative verwenden dieselbe Ansagelogik;
- Regressionstest prüft Store-Aufruf, Grenz-Button und Live-Text.

### 3. Markdown-Überschriften kontextbezogen staffeln

**Vorher**

Nutzer- und Demo-Markdown konnte eine zusätzliche `h1` in Karten, Fragen oder
Antworten erzeugen. Bereits vorstrukturierte Inhalte begannen teilweise mit
`###`, sodass ein pauschaler Offset wiederum Ebenen überspringen würde.

**Umsetzung**

- Option `headingStartLevel` in die zentrale Render-Pipeline aufgenommen;
- flachste im Inhalt vorkommende Markdown-Überschrift ermittelt;
- relative Hierarchie des Inhalts beibehalten und auf den
  Einbettungs-Startlevel normalisiert;
- Ausgabe auf `h2` bis `h6` begrenzt;
- Sanitizer um `h5` und `h6` ergänzt;
- Quizbeschreibung, Editor-Vorschau, Fragen und Antworten mit dem jeweiligen
  Karten-/Fragenkontext gerendert;
- Importbeispiele und Utility-Tests auf die kontextuelle Staffelung
  umgestellt.

**Dateien**

- `apps/frontend/src/app/shared/markdown-katex.util.ts`
- `apps/frontend/src/app/shared/markdown-katex.util.spec.ts`
- `apps/frontend/src/app/shared/markdown-katex-editor/markdown-katex-editor.component.ts`
- `apps/frontend/src/app/features/quiz/quiz-list/quiz-list.component.ts`
- `apps/frontend/src/app/features/quiz/quiz-edit/quiz-edit.component.ts`
- `apps/frontend/src/app/features/quiz/quiz-preview/quiz-preview.component.ts`
- `apps/frontend/src/app/features/quiz/data/quiz-import-examples.spec.ts`
- `apps/frontend/src/app/features/session/session-host/session-host.component.ts`
- `apps/frontend/src/app/features/session/session-host/session-host.component.html`
- `apps/frontend/src/app/features/session/session-host/session-host.component.spec.ts`
- `apps/frontend/src/app/features/session/session-vote/session-vote.component.ts`
- `apps/frontend/src/app/features/session/session-vote/session-vote.component.html`
- `apps/frontend/src/app/features/session/session-present/session-present.component.ts`
- `apps/frontend/src/app/features/admin/admin.component.ts`
- `apps/frontend/src/app/features/admin/admin.component.html`

### 4. Textäquivalent für Wortwolken

**Vorher**

Häufigkeit und Rang wurden primär über Schriftgröße und räumliche Anordnung
vermittelt. Tooltips waren kein vollständiger Ersatz für diese visuelle
Beziehung.

**Umsetzung**

- semantisch geordnete, visuell verborgene Liste parallel zur Wortwolke
  ergänzt;
- vollständige, nicht nur visuell gekappte Begriffsliste verwendet;
- jede Position enthält Begriff, Häufigkeits-/Größenwert und vorhandene
  Analysedetails;
- Lösung gilt auch im Output-only-Präsentationsmodus;
- Regressionstest prüft Listenrang, Nennungszahl und Vollständigkeit.

**Dateien**

- `apps/frontend/src/app/features/session/session-present/word-cloud.component.html`
- `apps/frontend/src/app/features/session/session-present/word-cloud.component.spec.ts`

### 5. Normale Navigationssemantik der Landing-App

**Vorher**

Die mobile Linknavigation verwendete `role="menu"` und `role="menuitem"`,
implementierte aber nicht das für ARIA-Menüs erwartete Pfeiltastenmuster.

**Umsetzung**

- Menürollen entfernt;
- Links in eine native ungeordnete Liste überführt;
- normale Tab- und Linksemantik beibehalten;
- mobile Linkziele mit mindestens 44 CSS-Pixel Höhe versehen;
- unverändertes Öffnen/Schließen über `aria-expanded` und `aria-controls`.

**Datei**

- `apps/landing/src/layouts/BaseLayout.astro`

### 6. Lightbox ohne Ziehbewegung bedienen

**Vorher**

Zoom war über Doppelclick/Doppeltipp/Pinch und Pan über Ziehen verfügbar. Für
Zoom und Pan gab es keine sichtbare Ein-Zeiger-Alternative ohne Dragging.

**Umsetzung**

- klickbare Controls für Vergrößern, Verkleinern und Originalansicht ergänzt;
- vier Richtungsbuttons verschieben den sichtbaren Ausschnitt schrittweise;
- aktueller Zoomfaktor wird als Live-Status ausgegeben;
- nicht verfügbare Zoom-/Reset-Aktionen werden deaktiviert;
- bestehende Touch- und Mausgesten bleiben erhalten;
- Controls besitzen mindestens 44 × 44 CSS-Pixel und sichtbare Fokusrahmen;
- Mobile-Layout ordnet die Steuerung unterhalb des Schließen-Buttons an;
- Reduced-Motion-Regel bleibt wirksam.

**Dateien**

- `apps/frontend/src/app/shared/markdown-image-lightbox/markdown-image-lightbox-dialog.component.html`
- `apps/frontend/src/app/shared/markdown-image-lightbox/markdown-image-lightbox-dialog.component.ts`
- `apps/frontend/src/app/shared/markdown-image-lightbox/markdown-image-lightbox-dialog.component.scss`
- `apps/frontend/src/app/shared/markdown-image-lightbox/markdown-image-lightbox-dialog.component.spec.ts`

### 7. Zielgrößen und Lokalisierung

- neue Reorder-, Drag- und Lightbox-Controls auf 44 CSS-Pixel gesetzt;
- mobile Landing-Links auf 44 CSS-Pixel Mindesthöhe gesetzt;
- Expand-Button der Quizfragen auf 44 × 44 CSS-Pixel vergrößert;
- positionierte Wortwolken-Chips auf mindestens 24 × 24 CSS-Pixel begrenzt;
- Desktop- und Footer-Links der Landing-App auf mindestens 24 CSS-Pixel Höhe
  vergrößert, ohne ihre Abstände zu verringern;
- verbleibende kleinere Maße in den betrachteten Komponenten gehören zu
  dekorativen Icons, Badges oder Inhalten innerhalb größerer Targets;
- 13 neue beziehungsweise zuvor noch nicht extrahierte Messages synchronisiert;
- Platzhalterkonsistenz über alle 2318 XLIFF-Einheiten geprüft;
- maschinell erzeugte Positionsansagen in allen vier Zielsprachen fachlich
  korrigiert.

### UX-, Design- und Performance-Einfluss

- Quizkarten erhalten links drei statt eines Controls und benötigen dadurch
  mehr vertikalen Platz; auf Mobile bleibt der Textbereich möglichst breit;
- der größere Aufklapp-Button erhöht die Kopfzeilenhöhe einzelner Quizkarten;
- Sortierbuttons machen die Funktion auffindbarer und helfen auch
  Maus-/Touch-Nutzenden bei langen oder eng stehenden Listen;
- Lightbox-Steuerung ist sichtbar und kann Bildbereiche überdecken; auf
  kleinen Viewports wird sie deshalb unter dem Schließen-Button umgebrochen;
- Zoomfaktor und Reset sind jetzt ohne Gestenwissen verständlich;
- Überschriftennormalisierung verändert nur Semantik, nicht das bestehende
  Markdown-Styling;
- die Wortwolke bleibt visuell unverändert; Screenreader erhalten Rang und
  Zahlenwerte in stabiler Reihenfolge;
- Landing-Navigation verhält sich visuell und per Tab wie zuvor, entspricht
  jetzt aber ihrer tatsächlichen Linkfunktion; Desktop- und Footer-Links
  besitzen eine geringfügig größere Click-/Touch-Fläche.

**Offen**

- Reorder-Fokus nach realer CDK-DOM-Verschiebung in Chrome/Safari prüfen;
- Quizkarten bei 320 CSS-Pixel und 400 % Zoom visuell abnehmen;
- Lightbox-Steuerung mit Hoch-/Querformat, sehr langen Captions und
  Safe-Area-Insets prüfen;
- VoiceOver/Safari und NVDA/Firefox für Live-Region, Wortwolkenliste und
  Zoomstatus;
- vollständige Laufzeitmessung aller Targets bleibt Teil der
  Playwright-/manuellen Prüfmatrix aus PR 6 und PR 7.

### Validierung PR 4

- 959 Frontend-Tests erfolgreich;
- 153 fokussierte Tests erfolgreich;
- Frontend-Typecheck und ESLint erfolgreich;
- XLIFF-Konsistenzprüfung: 2318/2318 Einheiten für `en`, `fr`, `es`, `it`;
- lokalisierter Frontend-Produktionsbuild erfolgreich;
- Landing-Produktionsbuild mit Node 22 erfolgreich;
- Prettier und `git diff --check` erfolgreich;
- bekannte Bundle-Budget- und `pako`-CommonJS-Warnungen bleiben
  nicht-blockierend.

## PR 5 – i18n assistiver Texte

**Datum:** 2026-07-19  
**Status:** automatisch validiert  
**WCAG:** 2.1.1, 2.4.3, 3.1.2, 3.3.2, 4.1.2

### 1. Vollständige Inventur und stabile Message-IDs

**Vorher**

Ein Teil der statischen Accessible Names war zwar über ein unbenanntes
`i18n-aria-label` extrahierbar, besaß aber nur eine generierte Hash-ID. Andere
Beschriftungen waren als feste deutsche oder englische Strings im Template
zusammengesetzt und erschienen deshalb unverändert in nichtdeutschen Builds.

**Umsetzung**

- statische `aria-label` in App-Shell, Home, Feedback, Quiz, Session,
  Preset-Dialog sowie Hilfe-/Legal-/News-Navigation inventarisiert;
- bereits extrahierte statische Texte auf sprechende `@@`-IDs migriert;
- harte Template-Konkatenationen durch `$localize`-Methoden ersetzt;
- Aktionsgruppen und Frage-Metadaten in Vote und Host lokalisiert;
- doppeltes `i18n-aria-label` am Teamanzahl-Select entfernt;
- Offline-Wiederholen-Aktion und geräteübergreifende
  Browser-/Gerätebeschreibung in den i18n-Pfad aufgenommen.

**Dateien unter anderem**

- `apps/frontend/src/app/app.component.html`
- `apps/frontend/src/app/features/home/home.component.html`
- `apps/frontend/src/app/features/home/home.component.ts`
- `apps/frontend/src/app/features/feedback/feedback-host.component.html`
- `apps/frontend/src/app/features/session/session-host/session-host.component.html`
- `apps/frontend/src/app/features/session/session-vote/session-vote.component.html`
- `apps/frontend/src/app/features/quiz/quiz-new/quiz-new.component.html`
- `apps/frontend/src/app/features/quiz/quiz-edit/quiz-edit.component.html`
- `apps/frontend/src/app/features/quiz/quiz-preview/quiz-preview.component.html`
- `apps/frontend/src/app/shared/preset-toast/preset-toast.component.html`

### 2. Countdown, Q&A und Quiz-Antwortaktionen

**Vorher**

- Host-Countdown und Finger-Countdown erzeugten deutsche Accessible Names per
  String-Konkatenation;
- Q&A-Upvote und -Downvote waren nur englisch benannt und unterschieden nicht
  zwischen Setzen und Zurücknehmen;
- Markieren, Umschalten und Entfernen von Quizantworten sowie das Auf- und
  Zuklappen von Fragen waren fest deutsch beschriftet.

**Umsetzung**

- Host- und Vote-Countdown mit stabilen Singular-/Plural-Messages versehen;
- Finger-Countdown als ein beschriftetes `role="img"` umgesetzt und das
  enthaltene Bild dekorativ gemacht, damit der Alternativtext nicht doppelt
  vorgelesen wird;
- Q&A-Bewertungen benennen abhängig vom Zustand „bewerten“ oder
  „zurücknehmen“;
- Quiz-Antwortaktionen und Auf-/Zuklappen über lokalisierbare Methoden
  beschriftet;
- Preset-Chip-Zustände als vollständige Sätze statt aus übersetzbaren
  Fragmenten zusammengesetzt.

**Dateien**

- `apps/frontend/src/app/features/session/session-host/session-host.component.ts`
- `apps/frontend/src/app/features/session/session-host/session-host.component.html`
- `apps/frontend/src/app/features/session/session-vote/session-vote.component.ts`
- `apps/frontend/src/app/features/session/session-vote/session-vote.component.html`
- `apps/frontend/src/app/shared/countdown-fingers/countdown-fingers.component.ts`
- `apps/frontend/src/app/features/quiz/quiz-edit/quiz-edit.component.ts`
- `apps/frontend/src/app/features/quiz/quiz-edit/quiz-edit.component.html`
- `apps/frontend/src/app/shared/preset-toast/preset-toast.component.ts`

### 3. Namen, Formularlabel und Inhaltsnavigation

- automatisch erzeugte anonyme Namen laufen über `@@join.anonymousNickname`;
- das optionale Nickname-Feld besitzt mit „Dein Name“ ein dauerhaft sichtbares
  und lokalisiertes `mat-label` statt nur eines Placeholders;
- die Zurück-Navigation in Hilfe, Legal und News-Archiv besitzt einen
  lokalisierten Landmark-Namen;
- Quiz-Formular-, Listen-, Vorschau- und Navigationsbeschriftungen verwenden
  stabile IDs.

**Dateien**

- `apps/frontend/src/app/features/join/join.component.ts`
- `apps/frontend/src/app/features/join/join.component.html`
- `apps/frontend/src/app/features/help/help.component.html`
- `apps/frontend/src/app/features/legal/legal-page.component.html`
- `apps/frontend/src/app/features/news-archive/news-archive-page.component.html`
- `apps/frontend/src/app/features/quiz/quiz-list/quiz-list.component.html`

### 4. Lightbox: lokalisierter Status und Tastaturzugang

**Vorher**

Der Zoomstatus bestand assistiv nur aus einer Prozentzahl. Markdown-Bilder
öffneten die Lightbox per Pointer, waren aber weder als Aktion benannt noch per
Tab und Enter/Leertaste erreichbar.

**Umsetzung**

- Zoomstatus als „Zoom: N Prozent“ benannt;
- Lightbox-Bilder erhalten eine lokalisierte Aktionsbeschreibung, `role`,
  `tabindex` und Tastaturaktivierung;
- vorhandener Bild-Alternativtext bleibt Bestandteil des Accessible Names;
- bei fehlendem Alternativtext wird ein lokalisierter generischer Bildname
  verwendet.

**Dateien**

- `apps/frontend/src/app/shared/markdown-image-lightbox/markdown-image-lightbox-dialog.component.html`
- `apps/frontend/src/app/shared/markdown-image-lightbox/markdown-image-lightbox-dialog.component.ts`
- `apps/frontend/src/app/shared/markdown-image-lightbox/markdown-image-lightbox.directive.ts`

### 5. Locale-Pflege und Übersetzungsqualität

- `messages.xlf`, `messages.en.xlf`, `messages.fr.xlf`, `messages.es.xlf` und
  `messages.it.xlf` neu extrahiert und synchronisiert;
- 2.351 von 2.351 Quell-Einheiten je Zielsprache geprüft;
- fehlerhafte Maschinenübersetzungen manuell korrigiert, unter anderem für
  „Schließen“, Quiz-/Q&A-Aktionen, Browser „auf“ Gerät, Auf-/Zuklappen,
  Q&A-Voting, Finger-Countdown und Preset-Zustände;
- Platzhalter und Reihenfolge dynamischer Werte in allen vier Zielsprachen
  erhalten.

### Tests

- neue Unit-Tests für den Finger-Countdown;
- Regressionstests für Host-Countdown, Q&A-Voting, Quiz-Antwortaktionen,
  Auf-/Zuklappen, Nickname-Label, Landmark-Name, Preset-Zustände,
  Lightbox-Zoomstatus und Tastaturaktivierung;
- 392 fokussierte Tests erfolgreich;
- 964 Frontend-Tests in 67 Testdateien erfolgreich.

### UX-, Design- und Performance-Einfluss

- fast alle Änderungen sind rein assistiv und verändern das visuelle Design
  nicht;
- das Nickname-Feld zeigt jetzt ein dauerhaftes Label. Das verbessert auch für
  sehende Nutzende Orientierung und Wiedererkennung, sobald ein Wert
  eingegeben wurde;
- Markdown-Bilder werden zusätzliche Tabstopps. Das verlängert die
  Tastaturreihenfolge bei bildreichen Inhalten, macht die vorhandene
  Vollansicht aber erstmals ohne Pointer erreichbar;
- zustandsabhängige Q&A-Namen erklären auch in Sprachsteuerung eindeutig, ob
  eine Bewertung gesetzt oder zurückgenommen wird;
- vollständige Preset-Statusphrasen verbessern Grammatik und Wortstellung in
  allen Sprachen;
- lokalisierte anonyme Namen können in einer mehrsprachigen Session je nach
  Client-Sprache unterschiedlichsprachig erscheinen; die fachliche Identität
  und Nummer bleiben unverändert;
- keine zusätzliche Netzwerkanfrage und keine relevante Laufzeit- oder
  Bundle-Auswirkung.

**Offen**

- NVDA/Firefox und VoiceOver/Safari für Countdown, Q&A-Zustandswechsel,
  Preset-Chips und Lightbox in allen fünf Locales prüfen;
- Tabreihenfolge bei bildreichen Markdown-Inhalten manuell bewerten;
- gemischtsprachige anonyme Namen in einer realen Session didaktisch prüfen;
- Landmark-Namen und Formularlabel bei 320 CSS-Pixel und 400 % Zoom
  kontrollieren;
- Sprachwechsel und `html@lang` im laufenden Browser zusätzlich prüfen.

### Validierung PR 5

- 964 Frontend-Tests erfolgreich;
- 392 fokussierte Tests erfolgreich;
- Frontend-Typecheck und ESLint erfolgreich;
- XLIFF-Konsistenzprüfung: 2.351/2.351 Einheiten für `en`, `fr`, `es`, `it`;
- lokalisierter Frontend-Produktionsbuild erfolgreich;
- erzeugte Startdokumente tragen passend `lang="de"`, `lang="en"`,
  `lang="fr"`, `lang="es"` und `lang="it"`;
- Prettier für alle geänderten Implementierungs- und Testdateien erfolgreich;
- bekannte Bundle-Budget- und `pako`-CommonJS-Warnungen bleiben
  nicht-blockierend.

## PR 6 – Automatisierte Qualitätssicherung

**Datum:** 2026-07-19  
**Status:** automatisch validiert  
**WCAG:** 1.1.1, 1.3.1, 1.4.3, 1.4.10, 2.1.1, 2.4.7, 2.5.8, 4.1.2  
**PR/Commit:** #91, Squash-Commit `746f43c1`

### Ausgangsproblem

Accessibility wurde überwiegend über Unit-Tests und einen aggregierten
Lighthouse-Score abgesichert. HTML-Templates wurden nicht mit Angular-A11y-Regeln
gelintet. Die vorhandenen Playwright-Flows führten keine systematischen
WCAG-Scans aus. Einzelne fehlgeschlagene Lighthouse-Audits konnten trotz hohem
Gesamtscore grün bleiben; Landing, Reflow und Zielgrößen waren keine
verbindlichen CI-Gates.

### Konkrete Umsetzung

1. `angular-eslint` prüft externe und eingebettete Frontend-Templates mit dem
   Regelpaket `templateAccessibility`. HTML läuft auch im Pre-Commit-Lint.
2. Ein gemeinsamer `@axe-core/playwright`-Runner blockiert `serious` und
   `critical` Befunde und schreibt JSON-Nachweise.
3. Der statische Lauf deckt Home DE/EN, Quiz-Liste, Quiz neu, ein real
   angelegtes Quiz im Bearbeitungszustand, Hilfe, Legal, Offline sowie
   Join-Lade- und Fehlerzustand ab. Der leere Eigene-Quiz-Zustand wird zusammen
   mit dem Demo-Quiz auf der Quiz-Liste geprüft.
4. `SHORT_TEXT` scannt aktive Host-/Vote-Ansicht und Ergebnis. Der
   Unified-Session-Smoke scannt Host-Lobby, Q&A leer und moderiert,
   Teilnehmer-Lobby und Q&A, Presenter-Q&A, Blitzlicht, den
   Session-Ende-Dialog und den beendeten Teilnehmerzustand.
5. Die Landing-Seite prüft Start, Impressum und Datenschutz vor CI-Build und
   Deployment mit axe.
6. Lighthouse umfasst zusätzlich Quiz-Liste, Hilfe und Datenschutz. Ein eigener
   Report-Validator lässt neben dem Mindestscore jedes gewichtete
   Accessibility-Einzelaudit fehlschlagen.
7. Der bisherige 320-Pixel-Smoke prüft nun sechs DE/EN-Routen auf Reflow,
   sichtbaren Tastaturfokus und 24-CSS-Pixel-Zielgrößen. 320 CSS-Pixel bilden
   dabei den automatisierbaren Reflow-Proxy für 1280 Pixel bei 400 % Zoom.

### Durch die Gates gefundene und behobene Befunde

- das News-Archiv-Footer-Icon war als eigenständige Grafik exponiert, obwohl
  bereits der Link den vollständigen Accessible Name einschließlich
  Ungelesen-Zahl trägt; das Icon ist jetzt dekorativ;
- Landing-CTAs mit Weiß auf Brand-500/600 unterschritten den Textkontrast und
  verwenden nun Brand-700;
- mehrere kleine Slate-500-Texte wurden auf Slate-400 angehoben;
- Links in Fließtext auf Trust-, Vergleichs- und Legal-Seiten sind dauerhaft
  unterstrichen und damit nicht mehr nur über Farbe unterscheidbar;
- rein pointerbezogene Backdrop- und Pan/Zoom-Patterns sind im Template-Lint
  eng begründet ausgenommen; echte Controls und Stop-Propagation-Container
  erhielten passende Semantik oder wurden bereinigt.

### Tests und Nachweise

- Angular-Template- und TypeScript-ESLint erfolgreich;
- Frontend-Typecheck und Syntaxprüfung aller neuen/geänderten A11y-Skripte
  erfolgreich;
- lokalisierter Frontend-Produktionsbuild und Landing-Build erfolgreich;
- statisches axe-Gate: zwölf Zustände ohne `serious`/`critical` Befund;
- Landing-axe-Gate: drei Seiten ohne `serious`/`critical` Befund;
- dynamisches axe-Gate: zehn Unified-Session-Zustände sowie vier
  SHORT_TEXT-Zustände ohne `serious`/`critical` Befund;
- Reflow/Fokus/Zielgröße: sechs Routen erfolgreich;
- Lighthouse-A11y-Matrix: fünf Routen mit Score 100 und allen gewichteten
  Accessibility-Audits grün.

### UX-, Design-, Performance- und Prozesseinfluss

- Template- und Laufzeitfehler werden früher gefunden; die unmittelbare
  Produkt-UX ändert sich durch die meisten Gates nicht;
- die Landing-Kontraste sind sichtbar kräftiger. CTA-Hierarchie und Layout
  bleiben gleich, Lesbarkeit bei Sonne, schwachen Displays und
  Sehbeeinträchtigung steigt;
- dauerhafte Unterstreichungen machen zwei Quellenlinks und Legal-Links auch
  ohne Farbunterscheidung erkennbar und verbessern die allgemeine
  Auffindbarkeit;
- der automatisierte Fokuslauf tabbt nur die ersten zwölf Ziele je statischer
  Route und ersetzt keine vollständige Tastaturabnahme;
- CI-Zeit steigt durch axe-Scans und die Chromium-Installation im Landing-Job.
  Die dynamischen Scans verwenden vorhandene E2E-Flows und vermeiden einen
  zweiten Backend-/Datenbank-Stack;
- JSON-Artefakte erleichtern die Reproduktion, enthalten aber DOM-Ausschnitte
  und dürfen keine nutzerbezogenen Produktionsdaten verwenden.

### Offene Risiken und manuelle Abnahme

- echte Browser-Zoomstufen 200 %/400 %, virtuelle Tastatur und Sticky-Overlays
  bleiben Teil von PR 7; 320 CSS-Pixel ist nur der Reflow-Proxy;
- WCAG-2.5.8-Ausnahmen für Inline-Links werden im automatischen
  Zielgrößenlauf bewusst nicht geometrisch bewertet;
- axe und Lighthouse decken nur automatisierbare Kriterien ab;
- VoiceOver/Safari, NVDA/Firefox, Forced Colors, Presets und alle fünf Locales
  müssen weiterhin manuell geprüft werden;
- die Gate-Integration wurde in PR #91 erfolgreich durch CI validiert;
  zukünftige Änderungen müssen dieselben Gates weiterhin bestehen.

## PR 7 – Manuelle Abschlussprüfung

**Datum:** 2026-07-19  
**Status:** in Arbeit; browsertechnisch validiert, echte Assistive-Technology-
und Betriebssystem-Abnahme ausstehend  
**WCAG:** 1.4.4, 1.4.10, 1.4.11, 2.1.1, 2.4.1, 2.4.3, 2.4.7, 2.4.11,
3.1.1, 3.1.2, 4.1.2, 4.1.3

**PR/Commit:** Abnahme ausstehend; vorbereitende Implementierung #89
(`1e3fff8c`), Dokumentation #93 (`5dfd9119`)

### Konkretisierte Prüfmatrix

Die Abschlussprüfung trennt drei Nachweisarten:

1. reproduzierbare Browsernachweise mit Chromium/Playwright;
2. visuelle Prüfungen mit echtem Browser-Zoom, OS-Kontrastmodi und virtueller
   Tastatur;
3. echte Screenreader-Prüfungen mit VoiceOver/Safari und NVDA/Firefox.

Die browsertechnische Matrix umfasst Home, Quiz-Liste, Quiz-Neuanlage,
Quiz-Bearbeitung, Hilfe, Legal, Join-Lade-/Fehlerzustand, Offline-Banner sowie
die bereits in PR 6 automatisierten Host-, Vote-, Q&A-, Feedback- und
Session-Ende-Zustände. Für `de`, `en`, `fr`, `es` und `it` werden mindestens
`html@lang`, Reflow, Accessible Names und statische axe-Regeln geprüft.

### Durch die Prüfung gefundene und behobene Befunde

#### Initialfokus und Skip-Link

**Vorher**

Die Startseite fokussierte das Session-Code-Feld 100 Millisekunden nach dem
Rendern. Das beschleunigte zwar die direkte Codeeingabe, übersprang aber den
Skip-Link und erzeugte beim Laden eine unerwartete Fokusverschiebung. Die
native Fragmentnavigation des Skip-Links war außerdem nicht als expliziter
Fokusvertrag regressionsgesichert.

**Umsetzung**

- der automatische Startfokus wurde entfernt;
- der Skip-Link ist bei einer Seite ohne modales Start-Overlay der erste
  Tabstopp;
- seine Aktivierung fokussiert explizit `#main-content`;
- der bereits vorhandene sichtbare Skip-Link-Stil wird durch einen
  Browser-Regressionslauf geprüft;
- bei einem aktiven MOTD bleibt dessen Initialfokus absichtlich vorrangig.

#### Expliziter Join-Fokus

**Vorher**

Nach dem Entfernen des allgemeinen Start-Autofokus war die Code-Eingabe nur
über Tab oder einen direkten Klick auf das Segmentfeld erreichbar. Es gab
weder eine ausdrücklich benannte Aktion „Code eingeben“ noch einen codefreien,
als Join-Absicht erkennbaren Einstieg.

**Umsetzung**

- die bestehende, bereits übersetzte Copy „Code eingeben“ wird als sichtbare
  Startseitenaktion wiederverwendet und fokussiert unmittelbar das native
  Session-Code-Feld;
- `/join` rendert dieselbe Home-Komponente mit einem Route-Data-Fokusvertrag,
  während `/join/:code` unverändert in das Nickname-Onboarding führt;
- bei einem direkten `/join`-Aufruf fokussieren Geräte ohne groben
  Primärzeiger das Feld nach der Fokusverankerung der App-Shell;
- bei primärer Touch-Eingabe bleibt der Fokus unverändert, damit der
  codefreie Deep Link nicht ungefragt die Bildschirmtastatur öffnet;
- `/` behält ausdrücklich keinen Autofokus und den Skip-Link als ersten
  Tabstopp.

**Dateien**

- `apps/frontend/src/app/app.routes.ts`
- `apps/frontend/src/app/features/home/home.component.html`
- `apps/frontend/src/app/features/home/home.component.ts`
- `apps/frontend/src/app/features/home/home.component.spec.ts`
- `apps/frontend/src/app/app.routes.spec.ts`
- `apps/frontend/src/app/core/seo-route-meta.ts`
- `apps/frontend/src/app/core/seo-route-meta.spec.ts`
- `apps/frontend/scripts/prerender-localized.mjs`
- `apps/frontend/scripts/check-viewport-320.mjs`
- `apps/frontend/angular.json`
- `apps/frontend/src/sitemap.xml`

**Regression**

Unit-Tests decken allgemeine Startseite, explizite Aktion, Desktop-Join-Fokus
nachgelagerte App-Shell-Fokusverankerung, Touch-Unterdrückung und
Join-SEO-Metadaten ab. Der 320-Pixel-Browsercheck prüft zusätzlich die Aktion
auf `/de/`, den ausbleibenden mobilen Autofokus auf `/de/join` sowie den
Desktop-Fokus auf demselben Pfad. Der lokalisierte Produktionsbuild rendert
`/join` für alle fünf Locales vor; die Sitemap führt die fünf Sprachvarianten
als Alternativen.

**Offen**

- das Verhalten der virtuellen Tastatur muss weiterhin auf realen iOS- und
  Android-Geräten geprüft werden; Pointer-Media-Queries bilden hybride Geräte
  nicht in jeder Browser-/Hardwarekombination identisch ab;
- VoiceOver/Safari und NVDA/Firefox bleiben Bestandteil der manuellen
  Abschlussmatrix.

#### Sichtbarer Fokus am Session-Code

Das eigentliche Eingabefeld ist aus Designgründen transparent und verteilt
seinen Inhalt auf sechs sichtbare Segmente. Der bisherige Schatten der
Segmente war als Fokusindikator zu zurückhaltend. Der Wrapper erhält nun bei
Eingabefokus einen drei Pixel starken Primary-Outline mit drei Pixel Abstand.
Die segmentierte Optik bleibt erhalten, der Tastaturfokus ist aber wesentlich
deutlicher.

#### Mobile Einstellungen

**Vorher**

Das nichtmodale Disclosure öffnete sein Panel, ohne den Fokus gezielt in die
neu eingeblendeten Bedienelemente zu setzen. Escape war nicht implementiert.

**Umsetzung**

- Öffnen per Enter oder Leertaste fokussiert das erste Preset im Panel;
- Escape schließt das Panel und stellt den Fokus am Auslöser wieder her;
- eine Focus Trap wurde bewusst nicht ergänzt, weil das Disclosure kein
  modaler Dialog ist und die restliche Seite erreichbar bleiben soll;
- Preset- und Theme-Auswahl schließen das mobile Panel ohne Fokusverlust.

#### Erweiterte Regression

`apps/frontend/scripts/check-viewport-320.mjs` prüft auf der deutschen
Startseite zusätzlich:

- Skip-Link als ersten Tabstopp ohne Start-Overlay;
- Fokus auf `#main-content` nach Aktivierung;
- Fokusübernahme beim Öffnen der mobilen Einstellungen;
- Schließen per Escape und Fokus-Rückgabe.

### Browsernachweise

- 62 fokussierte Tests für Home, Routing und SEO sowie 975 Frontend-Tests
  insgesamt erfolgreich;
- Frontend-Typecheck und ESLint erfolgreich;
- lokalisierter Produktionsbuild für alle fünf Locales erfolgreich;
- Reflow, Fokus, 24-Pixel-Ziele und die neuen Tastaturverträge auf sieben
  Routen bei 320 CSS-Pixel erfolgreich;
- zusätzliche axe-Stichprobe ohne serious/critical Befund auf `/fr/`,
  `/fr/help`, `/es/`, `/es/help`, `/it/` und `/it/help` sowie Quiz-Edit,
  Offline und Join Loading/Error;
- objektive Browserstichprobe: `html@lang` ist `en`, `fr`, `es` und `it`;
  die geprüften Seiten hatten bei 320 CSS-Pixel keinen horizontalen Overflow;
- Reduced Motion und Forced Colors wurden per Browseremulation aktiviert.
  Dies weist die Media-Query-Reaktion nach, ersetzt aber keine echte
  Betriebssystemprüfung.

### UX-, Design- und Prozesseinfluss

- Die Startseite setzt den Fokus nicht mehr ungefragt. Pointer-Nutzende merken
  keinen Unterschied; Tastaturnutzende erhalten eine vorhersehbare
  Reihenfolge. Wer sofort einen Code eingeben möchte, benötigt nun einen
  Tabstopp oder einen Klick.
- Der stärkere Outline verändert nur den Fokuszustand. Er verbessert die
  Orientierung auch bei Blendung, geringer Displayqualität, motorischer
  Bedienung und Präsentationen.
- Das mobile Einstellungs-Panel ist schneller per Tastatur bedienbar und mit
  Escape erwartungskonform reversibel. Pointer- und Touchabläufe bleiben
  unverändert.
- Die zusätzlichen Browserassertionen verlängern den bestehenden
  Layout-Smoke nur geringfügig, verhindern aber Regressionen an einer
  zentralen Navigationsfunktion.

### Noch zwingend manuell abzunehmen

PR 7 ist noch nicht „manuell abgenommen“. Folgende Nachweise können in der
aktuellen Automationsumgebung nicht seriös behauptet werden:

- VoiceOver mit Safari für Skip-Link, MOTD, Preset-Dialog, Quiz-Reorder,
  Live-Regionen, Wortwolkenliste und Lightbox-Zoom;
- NVDA mit Firefox für Countdown, Join/Lobby, Q&A-Moderation, Vote-Zustände
  und Session-Ende;
- echter Browser-Zoom bei 200 % und 400 % einschließlich Sticky Header,
  Bottom-Actions und virtueller Tastatur;
- echter Windows-High-Contrast-/Forced-Colors-Modus;
- visuelle Vollmatrix aus Light/Dark und Spielerisch/Seriös in allen
  dynamischen Kernzuständen;
- Laufzeitansagen in allen fünf Locales.

Diese Punkte sind externe Abnahmeschritte und keine offenen bestätigten
Codefehler. Eine WCAG-2.2-AA-Konformität wird bis zu ihrem Abschluss weiterhin
nicht erklärt.

## PR 8 – PDF/UA und Dokumentation

**Datum:** 2026-07-19  
**Status:** automatisch validiert; strukturell und visuell stichprobenartig
geprüft, Reader-/Screenreader-Abnahme ausstehend  
**Normprofil:** PDF/UA-1, ISO 14289-1:2014

**PR/Commit:** #92, Squash-Commit `1d5f798b`; Dokumentation #93 (`5dfd9119`)

### Ausgangslage

Das barrierefreie Exportprofil erzeugte bereits getaggte PDFs mit
Dokumentsprache, Titel, XMP-Metadaten, Alternativtexten, Links und
Tabellenstruktur. Der bisherige Nachweis `Tagged: yes` und `Suspects: no`
prüfte jedoch keine vollständige PDF/UA-1-Konformität. Ein externer Validator
war weder als lokaler Befehl noch als CI-Gate integriert.

### Externe Validierung und gefundener Defekt

Der erste Lauf mit veraPDF 1.30.2 zeigte den Wert eines normbezogenen
Validators: Vier Locale-Dateien bestanden, der französische Export scheiterte
an drei Fontprüfungen. Ein nachträglich als Artifact gezeichneter
Fortsetzungsstempel verwendete die nicht eingebetteten PDF-Standardfonts
`Helvetica-Bold` und `Symbol`; das π-Zeichen besaß außerdem keine gültige
Unicode-Abbildung.

`pdfinfo` hatte diesen Fehler nicht gemeldet. „Getaggt“ war daher auch hier
kein ausreichender Konformitätsnachweis.

### Konkrete Umsetzung

- PDF/UA-Exporte überspringen den rein visuellen Fortsetzungsstempel, solange
  kein vollständig eingebetteter Unicode-Font für die Nachbearbeitung
  vorhanden ist;
- das Standardprofil behält den Stempel unverändert;
- ein Playwright-/PDF-Integrationstest sichert ab, dass das PDF/UA-Profil
  weder `Helvetica-Bold` noch `Symbol` nachträglich einführt;
- `scripts/validate-pdfua.mjs` prüft die fünf Locale-Demos mit dem fest
  versionierten Container `verapdf/cli:v1.30.2`;
- `npm run validate:pdfua` stellt den lokalen, reproduzierbaren Einstieg
  bereit;
- der CI-Job `PDF/UA-1 Validation` blockiert bei einem veraPDF-Verstoß und
  lädt den Textbericht als 30 Tage verfügbares Artefakt hoch;
- die fünf PDF/UA-Demos wurden neu erzeugt;
- das vollständige Ergebnis steht in
  [`ACCESSIBILITY-PDFUA-PRUEFPROTOKOLL.md`](./ACCESSIBILITY-PDFUA-PRUEFPROTOKOLL.md).

### Nachweise

- veraPDF PDF/UA-1: `de`, `en`, `fr`, `es`, `it` jeweils PASS;
- Poppler: alle Dateien getaggt, ohne Suspects, mit Metadata Stream und A4;
- identische strukturelle Grundmatrix je Locale: ein `H1`, neun `H2`,
  32 `H3`, drei Figures mit Alternativtext, 22 Links und vier Tabellen;
- 15 repräsentative Seitenrenderings ohne Clipping, Überlagerung,
  Ersatzglyphen oder Tabellenüberlauf;
- 64 Tests der Session-Export-Report-Bibliothek erfolgreich, darunter der
  neue Font-Regressionsfall.

### UX-, Design- und Prozesseinfluss

- Die visuelle Gestaltung der fünf Demo-Berichte bleibt bis auf den
  französischen Fortsetzungsrand unverändert.
- Auf dieser Seite beginnt der Inhalt direkt mit dem aussagekräftigen
  Unterabschnitt „Répartition des estimations“. Die semantische
  Lesereihenfolge bleibt vollständig; nur der dekorative Seitenrandstempel
  entfällt.
- Das Gate prüft committed PDFs und benötigt weder Datenbank noch
  Frontend-Build. Der Docker-Download ist gecacht; der lokale Folgelauf dauert
  ungefähr 15 Sekunden.
- Der fest versionierte Validator und der gespeicherte Bericht verbessern
  Reproduzierbarkeit und Reviewfähigkeit gegenüber manuellen
  `pdfinfo`-Screenshots.

### Noch offen

- VoiceOver mit einem PDF-Reader auf macOS;
- NVDA mit Acrobat Reader unter Windows;
- optionaler PAC-Gegencheck;
- Schließen von Story 6.5 und Erklärung vollständiger WCAG-2.2-AA-Konformität
  erst nach Abschluss der noch offenen PR-7- und Reader-Abnahmen.

## Nachlaufende UX-Feinjustierung – Abstand des Textlink-Fokus

**Datum:** 2026-07-19  
**Status:** umgesetzt  
**WCAG:** 2.4.7 Fokus sichtbar  
**PR/Commit:** `b8feff12` (`main`-HEAD; Push/PR ausstehend)

### Ausgangsproblem

Der vorhandene Fokusrahmen lag bei allgemeinen Textlinks und in mehreren
Markdown-Ansichten mit zwei Pixeln Abstand noch relativ eng an den
Buchstaben. Das war erkennbar, wirkte aber visuell gedrängt.

### Konkrete Umsetzung

- globale Grundregel für fokussierte Links mit `href`;
- einheitlicher Abstand von `0.25rem` zwischen Text und Fokusrahmen;
- kleiner Eckenradius für eine ruhige Darstellung;
- bestehende speziellere Regeln in Hilfe, Rechtstexten, News-Archiv und
  Markdown-Vorschau auf denselben Abstand angehoben.

Es wird bewusst `outline-offset` statt `padding` verwendet. Dadurch ändern
sich weder Textfluss und Zeilenumbruch noch Größe und Position der
Klickfläche.

### Betroffene Dateien

- `apps/frontend/src/styles.scss`;
- `apps/frontend/src/app/features/help/help.component.scss`;
- `apps/frontend/src/app/features/legal/legal-page.component.scss`;
- `apps/frontend/src/app/features/news-archive/news-archive-page.component.scss`;
- `apps/frontend/src/app/shared/markdown-katex-editor/markdown-katex-editor.component.scss`.

### UX- und Design-Einfluss

- Tastaturnutzende können den Fokus leichter vom Linktext unterscheiden.
- Maus- und Touchdarstellung bleiben unverändert, weil die Regel nur für
  `:focus-visible` greift.
- Das Layout bleibt stabil; insbesondere entstehen keine zusätzlichen
  Zeilenumbrüche.

### Offene manuelle Abnahme

- Textlinks in hellem, dunklem und spielerischem Theme per Tastatur prüfen;
- Fokusrahmen an Containerkanten und in scrollbaren Markdown-Bereichen auf
  mögliches Abschneiden kontrollieren.

## Vorlage für weitere Einträge

```markdown
## PR N – Titel

**Datum:** JJJJ-MM-TT
**Status:** geplant | in Arbeit | umgesetzt | automatisch validiert | manuell abgenommen | abgeschlossen
**WCAG:** Kriterien
**PR/Commit:** Link oder Hash

### Ausgangsproblem

### Konkrete Umsetzung

### Betroffene Dateien

### Tests und Nachweise

### UX-, Design- und Performance-Einfluss

### Offene Risiken und manuelle Abnahme
```

## Pflege

Bei jedem weiteren A11y-Arbeitsschritt:

1. Statusübersicht aktualisieren;
2. konkrete Codeänderungen und Dateien eintragen;
3. automatische Prüfergebnisse mit Anzahl und Befehl notieren;
4. sichtbare und unsichtbare UX-Auswirkungen festhalten;
5. offene manuelle Prüfungen nicht als erledigt markieren;
6. nach Commit beziehungsweise Pull Request die Referenz ergänzen;
7. bei einer Regression den Eintrag korrigieren statt nur einen neuen
   Erfolgseintrag anzuhängen.

_Dieses Journal dokumentiert den Stand auf `main` sowie ausdrücklich
gekennzeichnete lokale Nachläufe. PR- und Commit-Referenzen werden bei jedem
Merge beziehungsweise lokalen Commit fortgeschrieben._
