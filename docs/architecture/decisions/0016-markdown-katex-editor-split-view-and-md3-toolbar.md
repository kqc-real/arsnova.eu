<!-- markdownlint-disable MD013 -->

# ADR-0016: Markdown/KaTeX-Bearbeitung — Split-View, gemeinsame Render-Pipeline und eigene MD3-Toolbar

**Status:** Accepted  
**Datum:** 2026-03-20  
**Entscheider:** Projektteam

## Kontext

Story 1.7 liefert Markdown- und KaTeX-Darstellung in Vorschau und Live-Session. Die **Bearbeitung** soll für Dozent:innen **konsistent**, **mobile-tauglich** und **DSGVO-konform** bleiben. Es besteht Bedarf nach:

- klarer **Open-Source-only**-Policy für einzubindende Editor-Bibliotheken (keine kommerziellen UI-Suites als Pflicht);
- **Material Design 3**-konformer Steuerung (Toolbar) passend zu ADR-0005;
- **KaTeX** und Markdown mit **derselben Semantik** wie in der Teilnehmer-Ansicht (keine zweite, abweichende Math-Syntax ohne Absprache);
- **Bilder** nur per URL ohne Hosting bei uns (**ADR-0015**).

Ein vollständig selbst gebautes **WYSIWYG** (ohne Document-Engine) ist langfristig schwer wartbar; reine **Fremd-Toolbars** passen nicht zu MD3 und Mobile-Anforderungen.

## Entscheidung

### 1. Architekturvariante: Split-View („Variante A“)

- **Quelle:** Der fachliche Inhalt (`Question.text`, `AnswerOption.text`, …) bleibt **canonical als Markdown-String** (inkl. KaTeX-Delimitern wie in der App vereinbart).
- **Eingabe:** Primär ein **Markdown-Quellbereich** (`textarea` o. Ä.) mit programmatischen Einfüge-/Wrap-Operationen über die Toolbar.
- **Vorschau:** **Live-Preview** aus demselben String über die **gleiche oder explizit geteilte** Markdown- und KaTeX-Verarbeitung wie bei der **öffentlichen Rendering-Pipeline** (sanitized HTML), damit „Was du siehst“ dem **Session-Rendering** entspricht.
- **Kein Pflicht-WYSIWYG** im Sinne von ProseMirror-What-You-See-Is-What-You-Get für die erste Ausbaustufe; ein späterer optionaler Schritt könnte eine **OSS-Document-Engine** (z. B. ProseMirror-basiert) nur als Motor nutzen, **ohne** deren Standard-Chrome — das wäre dann **ADR-Ergänzung** oder neues ADR.

### 2. Eigene Toolbar (Angular Material 3)

- Alle gängigen Formatierungen werden per **Klick/Tap** auf eine **eigene Toolbar** ausgelöst (Fett, Kursiv, Überschriften, Listen, Code, Links, **Bild nur URL**, **Inline-/Block-Formel**-Einfügung mit vereinbarten Delimitern).
- Umsetzung mit **Angular Material 3** (`MatButton`, `MatIconButton`, Menüs, auf schmalen Viewports **Bottom Sheet** oder Overflow-Menü) gemäß **ADR-0005** und **Mobile-First** (Epic 6 / ADR-0014).
- **Tastaturkürzel** sind **optional**; sie sind **kein** Ersatz für die Toolbar-Pflicht aus der Story.

### 3. Open Source nur

- Eingesetzte Pakete für Parsing/Rendering/Hilfen müssen **Open Source** sein und zu **Lizenz** und **Security-Review** des Projekts passen (keine Pflicht-Abhängigkeit von kommerziellen Rich-Text-Produkten). Konkrete Paketwahl bleibt Implementierungsdetail, solange diese Policy eingehalten wird.

### 4. Bilder und Lightbox

- Bild-Einfügung in der Toolbar: nur **Dialog/Sheet mit URL (+ Alt-Text)**; **kein Upload**. Verhalten und Policy siehe **ADR-0015**; Lightbox für gerenderte Bilder ebenfalls dort bzw. Story **1.7a**.

### 5. Internationalisierung und Barrierefreiheit

- Alle Toolbar-Labels, Dialoge und ARIA-Hinweise nach **ADR-0008** in **de/en/fr/es/it**.
- Fokus-Management bei Dialogen; keine ausschließlich **hover-only**-Bedienung.

## Konsequenzen

### Positiv

- Volle **Kontrolle über Mobile-UX** und **MD3**; keine Fremd-Toolbar-Optik.
- **Eine Wahrheit** für Inhalt: Markdown-String + geteilte Preview-Logik reduziert **Drift** zwischen Editor und Session.
- **Klare Datenschutz-Grenze** bei Medien (nur URLs, ADR-0015).

### Negativ / Risiken

- **Implementierungsaufwand** für Selection-Handling, Edge Cases (mehrzeilig, IME) und **Tests**.
- Ohne WYSIWYG-Engine: Nutzer:innen müssen **Markdown kennen** oder über Toolbar-Snippets arbeiten; Schulungs-/Hilfetexte sinnvoll.

## Alternativen (geprüft)

- **Kommerzielle All-in-One-Editoren mit Angular-Wrapper:** verworfen wegen **OSS-only**-Vorgabe.
- **Nur Fremd-Editor mit mitgelieferter Toolbar:** verworfen wegen **MD3**- und **Mobile**-Anforderungen.
- **Sofortiges vollständiges WYSIWYG:** verworfen als **Pflicht** für erste Lieferung — höherer Komplexität; optional später mit OSS-Engine + eigener Toolbar.

## Referenzen

- Backlog Story **1.7b** (Markdown/KaTeX-Editor mit MD3-Toolbar).
- [ADR-0017: Markdown-Editor — UI-Geltungsbereich, KI-Import und romanische Labels](./0017-markdown-editor-ui-scope-and-ki-import-paste-field.md) (Abgrenzung: kein JSON-Editor für KI-Paste; Fokus Quiz-Inhalt).
- [ADR-0005: Angular Material Design](./0005-use-angular-material-design.md)
- [ADR-0008: Internationalisierung](./0008-i18n-internationalization.md)
- [ADR-0014: Mobile-first Informationsarchitektur für Host-Views](./0014-mobile-first-information-architecture-for-host-views.md)
- [ADR-0015: Markdown-Bilder nur per URL und Lightbox](./0015-markdown-images-url-only-and-lightbox.md)
- Backlog Story **1.7** (bestehende Markdown- und KaTeX-Darstellung).
