<!-- markdownlint-disable MD013 -->

# ADR-0017: Markdown-Editor — UI-Geltungsbereich, Abgrenzung KI-Import und kompakte romanische Labels

**Status:** Accepted  
**Datum:** 2026-03-23  
**Entscheider:** Projektteam

## Kontext

Mit **ADR-0016** ist die technische Richtung für den **Markdown-/KaTeX-Editor** (Split-View, MD3-Toolbar, gemeinsame Render-Pipeline) festgelegt. Offen war die **fachliche Abgrenzung**: Welche Eingabefelder sollen diesen Editor überhaupt nutzen, und wie verhält sich das zum **KI-Quiz-Import**, bei dem Nutzer:innen **JSON aus dem Chat einfügen**?

Zusätzlich: In **fr/es/it** sind **lange Button- und Toolbar-Labels** auf schmalen Viewports stärker störend als im Deutschen oder Englischen (**Mobile-First**, **ADR-0014**, **ADR-0008**).

## Entscheidung

### 1. Geltungsbereich: Quiz-Inhalt (Authoring)

Der Markdown-/KaTeX-Editor nach **ADR-0016** ist für **didaktischen Quiz-Inhalt** vorgesehen, der in der App bereits als **Markdown-String** (inkl. KaTeX-Delimiter) gespeichert und mit **`renderMarkdownWithKatex`** ausgeliefert wird:

- **Pflichtfokus:** `quiz-edit` und `quiz-new` — mindestens **Fragetext** und **Antwortoptionen** (soweit typabhängig sinnvoll).
- **Erweiterung sinnvoll:** **Quiz-Beschreibung** (Metadaten-`textarea`), mit derselben Semantik wie Frage/Antwort, sofern Produkt/Schema das weiterhin erlaubt.
- **Optional / kompakt:** `quiz-preview` — **Schnellkorrektur** mit schmalen Zeilen; hier eher **kompakte Toolbar** oder **Ausweichpfad** „Voll bearbeiten“ zum Editor, statt vollwertiger WYSIWYG-pro-Zeile.

**Session-Ansichten** (Host, Present, Vote): **Rendering** von Markdown/KaTeX wie heute; **kein** zusätzlicher Editor-Pflicht aus dieser Story-Linie, solange es keine neuen freien Eingabefelder mit Markdown gibt.

### 2. Kein JSON-/Code-Editor für den KI-Import

Das Eingabefeld für die **LLM-Antwort** in der Quiz-Sammlung (**Story 1.9a**) ist ein **Copy-and-Paste-Kanal**: Die Nutzlast kommt **von der KI**, nicht aus manueller JSON-Authoring-Arbeit.

- Es gibt **keinen** Projektpflicht für einen **dedizierten JSON-Editor** (Syntax-Highlighting, IDE-ähnliche Features) als Liefergegenstand der Markdown-Editor-Story (**1.7b**) oder des KI-Imports.
- Qualitätssicherung bleibt bei **Zod** (`safeParse`) und **verständlichen Fehlermeldungen**; optionale, **leichtgewichtige** Hilfen (z. B. Entfernen von Markdown-Codefences, klarer Hinweis bei Parse-Fehlern) sind erlaubt, bleiben aber **ohne** schwere Editor-Bibliothek.

Die **Systemprompt-Vorschau** (**Story 1.9b**, **ADR-0007**) bleibt **Lesevorschau** (gerendert oder strukturiert angezeigt), **nicht** Teil des Markdown-Authoring-Editors.

### 3. Zwei Profile, eine klare Abgrenzung

Konzeptionell gibt es **zwei** Eingabe-Profile:

| Profil                  | Zweck                       | Typische UI                                         |
| ----------------------- | --------------------------- | --------------------------------------------------- |
| **Quiz-Markdown+KaTeX** | Inhalt für Teilnehmer:innen | Split-View + MD3-Toolbar (**ADR-0016**)             |
| **KI-Paste**            | Übernahme von LLM-JSON      | Einfaches Paste-Feld + Validierung (**Story 1.9a**) |

Eine **gemeinsame** Komponente darf es nur geben, wenn sie **Modi** strikt trennt (kein „ein Editor für alles“ ohne diese Abgrenzung).

### 4. Romanische Sprachen: kompakte UI-Texte

Für **Toolbar-, Button- und Chip-Labels** in **fr/es/it** sind Formulierungen zu bevorzugen, die **semantisch** mit **de/en** übereinstimmen, aber **kürzer** und für **kleine Touch-Flächen** tauglich sind (**ADR-0008**, **ADR-0014**). Ausführliche Beschreibungen bleiben in **Hilfetexten** oder der **Hilfe-Seite**.

## Konsequenzen

### Positiv

- Klare **Erwartungshaltung** an 1.7b: kein Scope-Creep in Richtung KI-JSON-IDE.
- **Weniger Bundle- und Wartungslast** beim KI-Import.
- Bessere **Mobile-UX** in romanischen Locales durch bewusst kürzere Aktionslabels.

### Negativ / Risiken

- Nutzer:innen mit **kaputtem KI-JSON** sehen weiterhin vor allem **Validierungsfehler**, nicht „hübsches“ JSON — das ist bewusst so gewollt.
- Sehr lange **Quiz-Beschreibungen** mit Toolbar können auf dem Handy trotzdem knapp werden; ggf. **Overflow-Menü** / Sheet nutzen (**ADR-0016**).

## Alternativen (geprüft)

- **Monaco/CodeMirror für KI-Paste:** verworfen als **Pflicht** — hoher Aufwand, geringer Mehrwert, da kein manuelles Authoring.
- **Ein einziger Rich-Text-Editor für Prompt + Quiz:** verworfen — unterschiedliche Nutzlast (Prompt vs. gespeicherte Frage), unterschiedliche Risiken (JSON vs. Markdown-String).

## Referenzen

- Backlog: Story **1.7b**, Story **1.9a**, Story **1.9b**
- [ADR-0007: Prompt-Architektur KI-Quiz](./0007-prompt-architecture-ki-quiz.md)
- [ADR-0008: Internationalisierung](./0008-i18n-internationalization.md)
- [ADR-0014: Mobile-first Informationsarchitektur für Host-Views](./0014-mobile-first-information-architecture-for-host-views.md)
- [ADR-0016: Markdown/KaTeX-Bearbeitung — Split-View und MD3-Toolbar](./0016-markdown-katex-editor-split-view-and-md3-toolbar.md)
