<!-- markdownlint-disable MD013 -->

# ADR-0015: Markdown-Bilder nur per URL (kein Speicher bei uns) und Vollbild-Ansicht per Klick

**Status:** Accepted  
**Datum:** 2026-03-20  
**Entscheider:** Projektteam

## Kontext

In Fragen und Antwortoptionen wird Markdown inkl. Bilder genutzt (Backlog Story 1.7). Aus **Datenschutz** und **Betriebsminimalismus** soll arsnova.eu **keine von Nutzer:innen hochgeladenen Bilddateien** verarbeiten oder persistieren.

Gleichzeitig soll die Darstellung auf **Smartphones** der gängigen Chat-/Messenger-UX entsprechen: ein **angetipptes Bild** öffnet eine **große, fokussierte Ansicht** (vergleichbar mit WhatsApp o. Ä.), nicht nur die eingebettete Thumbnail-Größe im Fließtext.

## Entscheidung

### 1. Kein Bild-Upload, nur Einbindung aus dem Netz

- **Quiz-/Session-Inhalte:** Bilder in Markdown ausschließlich über **externe URLs** im üblichen Syntax `![Alt-Text](https://…)` (optional Titel nach GFM).
- Es gibt **keinen** Server-Endpunkt zum **Upload** von Bildern für Quiz-Inhalte und **keine** Speicherung binärer Medien in unserer Infrastruktur für diese Funktion.
- Der **Persistenz- und Exportpfad** bleibt **reiner Text** (Markdown); die URL ist nur eine Zeichenkette im Inhalt.

### 2. Sicherheit und harte Grenzen

- **Rendering:** Bilder werden im Client wie heute aus dem Markdown-HTML erzeugt; es gilt das bestehende **Sanitizing** und **DTO-/Stripping**-Denken (kein unkontrolliertes `innerHTML` ohne Filter).
- **URL-Policy (Mindeststandard):**
  - **Quiz-/Session-Inhalte:** Nur **`https:`-URLs** für `img[src]` zulassen; **`data:`**, **`javascript:`** und ähnliche Schemata für Bilder **ablehnen** oder nicht rendern.
  - **System-/Admin-Inhalte (z. B. MOTD, Legal, Demos):** Bilder dürfen zusätzlich als **interne Assets** referenziert werden (z. B. `/assets/...` oder `assets/...`), bleiben aber ansonsten denselben Sicherheitsregeln unterworfen (kein `data:`, kein `javascript:`).
- **CSP:** `img-src` muss zu den erlaubten Quellen passen; bei strikter CSP ggf. dokumentierte Ausnahmen nur soweit nötig.

### 3. Lightbox / große Ansicht per Klick

- Überall, wo **Markdown-Vorschau oder gerenderte Fragen** Bilder zeigen (z. B. Quiz-Edit-Preview, Join/Vote, Present, Host), löst ein **Klick (Tap)** auf das Bild eine **Vollbild- oder Near-Vollbild-Ansicht** aus:
  - Bild **maximal groß**, **zentriert**, **Hintergrund abgedunkelt** (Material 3: z. B. `MatDialog` oder vergleichbares Overlay).
  - **Schließen:** sichtbarer **Schließen-Button**, **Tap auf Backdrop**, **Escape** (wo sinnvoll), **fokussierbare** und **screenreader-taugliche** Dialog-Semantik.
- Die angezeigte URL ist **dieselbe** wie im `src` der Vorschau (kein zweiter Upload, kein Proxy durch uns, sofern nicht ausdrücklich später anders entschieden).

### 4. UX- und i18n-Pflichten

- **Mobile-First:** ausreichend große Touch-Flächen; keine ausschließlich hover-abhängige Steuerung.
- **i18n:** Beschriftungen für Schließen/Hilfe nach ADR-0008 in allen Locales.

## Konsequenzen

### Positiv

- Keine **Speicherung** und **Verarbeitung** von Bilddateien auf unserer Seite → weniger **DSGVO-Relevanz** und weniger Betriebslast.
- Klare **Verantwortung**: der **externe Host** liefert das Medium; Dozent:innen wählen die Quelle bewusst.
- Bessere **Lesbarkeit** von Bildern auf kleinen Displays durch Lightbox.

### Negativ / Risiken

- **Broken Links** und **Drittanbieter-Ausfälle**: Bilder können verschwinden oder langsam laden — ohne eigenes Hosting keine Garantie.
- **Tracking / Drittanbieter**: externe Server können **Logs** schreiben; ggf. in **Hilfe/Datenschutz** hinweisen (Inhaltspflege durch Dozent:innen).
- **Hotlinking-Richtlinien** fremder Sites können Bilder blockieren.

## Alternativen (geprüft)

- **Eigenes Bild-Hosting mit Upload:** verworfen wegen Datenschutz- und Betriebsaufwand (dieses ADR).
- **Nur Inline-Bild ohne Lightbox:** verworfen wegen schlechter Mobile-UX für Detailansicht.
- **Bilder komplett verbieten:** verworfen; didaktischer Mehrwert von Abbildungen in Fragen bleibt gewünscht.

## Referenzen

- Backlog Story **1.7a** (Markdown-Bilder: URL-only + Lightbox).
- [ADR-0016: Markdown/KaTeX-Editor — Split-View und MD3-Toolbar](./0016-markdown-katex-editor-split-view-and-md3-toolbar.md) (Einbindung von Bildern in der Bearbeiten-Toolbar).
- [ADR-0005: Angular Material Design](./0005-use-angular-material-design.md) (UI-Patterns).
- [ADR-0008: Internationalisierung](./0008-i18n-internationalization.md).
