<!-- markdownlint-disable MD013 -->

# ADR-0008: Internationalisierung (i18n) — Technik, Locale-Strategie und Hinweise bei Inhaltsverlust

**Status:** Accepted  
**Datum:** 2026-03-12  
**Entscheider:** Projektteam  

## Kontext

Die App soll mehrsprachig nutzbar sein (Backlog Epic 6, Story 6.2). Dafür sind folgende Punkte zu klären:

1. **Technischer Ansatz:** Compile-Time-i18n mit separaten Builds pro Sprache (@angular/localize) oder Laufzeit-i18n mit einem Build (z. B. ngx-translate).
2. **Sprachwechsel:** Bei Compile-Time-i18n bedeutet Sprachwechsel in der Regel Navigation auf eine andere URL (Locale als Subpfad) und damit einen **vollständigen Seiten-Reload**. Dabei geht clientseitiger State verloren, sofern er nicht in URL, localStorage oder sessionStorage liegt oder vom Server neu geladen wird.
3. **Nutzer:innen informieren:** Auf welchen Seiten kann durch einen Sprachwechsel **Inhalt oder Kontext verloren gehen**, und wie müssen wir die Nutzer:innen darauf hinweisen?

## Entscheidung

### 1. Technik: @angular/localize (Compile-Time)

- Es wird der **offizielle Angular-Weg** mit **@angular/localize** verwendet. **Wir folgen den Empfehlungen von Angular** (Dokumentation angular.dev, CLI): Technik, Workflow (Extract → Übersetzen → Merge → Build pro Locale) und Standardformate werden wie von Angular vorgegeben genutzt; Abweichungen nur bei zwingendem Grund (z. B. Tooling-Anforderung).
- **Format Übersetzungsdateien:** Entsprechend der Angular-CLI-Empfehlung wird das **Standardformat XLIFF** verwendet (`ng extract-i18n` ohne `--format` erzeugt `.xlf`, XLIFF 1.2). Damit sind Meaning/Description für Übersetzer:innen voll unterstützt. Abweichung auf JSON oder ARB nur, wenn externes Tooling oder CI das zwingend verlangt.
- **Locale = Subpfad:** Jede unterstützte Sprache wird unter einem eigenen Pfad ausgeliefert (z. B. `/de/`, `/en/`, `/fr/`). Sprachwechsel = Navigation zu diesem Subpfad (in der Regel mit vollständigem Reload).
- **Unterstützte Sprachen (Backlog 6.2):** Deutsch (de), Englisch (en), Französisch (fr), Italienisch (it), Spanisch (es). Quellsprache im Code: Deutsch (sourceLocale).
- **Sprachwahl:** Ein Sprachwähler (z. B. in der Top-Toolbar) ermöglicht die Auswahl; die gewählte Locale wird in der URL abgebildet. Die Auswahl wird in `localStorage` persistiert und beim nächsten Besuch serverseitig oder clientseitig für Redirect genutzt.
- **Browser-Default:** Beim ersten Besuch ohne gespeicherte Präferenz wird die Sprache aus dem `Accept-Language`-Header abgeleitet; Fallback: Englisch.
- **Quiz-Inhalte:** Fragenstamm und Antworten (Dozenten-Inhalte) werden **nicht** übersetzt; sie bleiben in der vom Dozenten eingegebenen Sprache. Nur die **UI-Texte** (Buttons, Labels, Fehlermeldungen, Platzhalter, rechtliche Seiten) werden übersetzt.
- **Datum und Zahlen:** DatePipe, DecimalPipe, PercentPipe und CurrencyPipe nutzen die jeweilige Build-Locale (LOCALE_ID); keine zusätzliche Konfiguration nötig.
- **Rechtliche Seiten (Impressum, Datenschutz):** Inhalte werden pro Locale bereitgestellt (z. B. Markdown-Dateien pro Sprache oder Einträge in den Übersetzungsdateien); Routen bleiben sprachneutral (`/legal/imprint`, `/legal/privacy`).

Detaillierte Umsetzungshinweise: [docs/I18N-ANGULAR.md](../../I18N-ANGULAR.md).

### 2. Sprachwechsel und Verlust von Seiteninhalt / Session-State

Bei Sprachwechsel über Locale-Subpfad erfolgt ein **Seiten-Reload**. Alles, was nur im Speicher lebt (Komponenten-State, ungespeicherte Formulare), geht verloren. Erhalten bleiben: `localStorage`, `sessionStorage` sowie Daten, die nach dem Reload aus URL oder Server wieder geladen werden.

| View / Route | URL enthält | Risiko State-Verlust |
| --- | --- | --- |
| Startseite `/` | – | **Niedrig:** Nur eingegebener Session-Code weg. |
| Join `/join/:code` | Session-Code | **Mittel:** Nickname/Formular weg; Code bleibt. |
| Session Host/Vote/Present `/session/:code/...` | Session-Code | **Niedrig:** State wird per tRPC aus Server wiederhergestellt. |
| Quiz-Liste `/quiz` | – | **Niedrig:** Liste aus Store neu ladbar. |
| **Quiz bearbeiten** `/quiz/:id` | Quiz-ID | **Hoch:** **Ungespeicherte Änderungen** (Fragen, Antworten, Einstellungen) gehen verloren. |
| **Quiz neu** `/quiz/new` | – | **Hoch:** **Gesamter neuer Quiz-Entwurf** weg, wenn noch nicht gespeichert. |
| Quiz Preview `/quiz/:id/preview` | Quiz-ID | **Mittel:** Nur View-State (z. B. aktuelle Seite) weg. |
| Legal / Help | – | **Keins.** |

### 3. Pflicht: Hinweis an Nutzer:innen bei möglichem Inhaltsverlust

**Es muss ein entsprechender Hinweis an die Nutzer:innen ausgegeben werden**, wenn ein Sprachwechsel auf einer Seite erfolgen soll, auf der **nicht gespeicherter Inhalt oder Entwurf verloren gehen kann**.

- **Quiz bearbeiten (`/quiz/:id`):** Solange **ungespeicherte Änderungen** vorhanden sind, darf ein Sprachwechsel nicht ohne Warnung erfolgen. Es ist entweder:
  - ein **Hinweis-Dialog** anzuzeigen (z. B. „Sprache wechseln? Ungespeicherte Änderungen gehen verloren.“) mit Optionen „Abbrechen“ / „Trotzdem wechseln“, oder
  - die **Sprachwahl zu deaktivieren**, bis die Änderungen gespeichert oder verworfen wurden.
- **Quiz neu (`/quiz/new`):** Solange der **neue Quiz-Entwurf noch nicht gespeichert** ist, gilt dasselbe: Entweder **Hinweis** (z. B. „Sprache wechseln? Ihr neuer Quiz-Entwurf geht verloren.“) mit „Abbrechen“ / „Trotzdem wechseln“, oder **Deaktivierung** der Sprachwahl bis zum ersten Speichern.
- **Optional, aber empfohlen:** Beim Wechsel von einer kritischen Route (Quiz Edit/New) in eine andere Locale die **gleiche fachliche Route** in der neuen Locale ansteuern (z. B. `/de/quiz/xyz` → `/en/quiz/xyz`), damit Nutzer:innen wieder auf derselben Seite landen; der Hinweis auf möglichen Verlust bleibt davon unberührt.

**Implementierung:** Die Entwickler:innen stellen sicher, dass (1) auf den betroffenen Routen (Quiz Edit, Quiz New) vor einem ausgelösten Locale-Wechsel geprüft wird, ob ungespeicherter Inhalt existiert, und (2) in diesem Fall ein klar lesbarer Hinweis (Dialog oder vergleichbar) angezeigt wird, der die Folgen erklärt und eine bewusste Bestätigung oder einen Abbruch ermöglicht.

### 4. Vorgaben für die Übersetzungen

Für alle Zielsprachen gelten verbindliche Vorgaben; Übersetzer:innen und Entwickler:innen halten sie ein.

#### Sprachstil und Anrede

- **Informelle Sprache (Duzen):** Die App spricht Nutzer:innen mit „Du“ an (Deutsch). In den Zielsprachen ist die **entsprechende informelle Anrede** zu verwenden (z. B. „tu“/„Du“ im Französischen, „tú“/„Du“ im Spanischen, „tu“ im Italienischen, „you“ im Englischen ohne formelle Variante, sofern nicht zwingend erforderlich).
- **Zeitgemäßer Sprachstil:** Formulierungen sind zeitgemäß, klar und handlungsorientiert; keine veralteten Floskeln oder übermäßig formelle Wendungen.

#### Quellsprache Deutsch: Form und Länge

- **Deutsch ist die Referenz** für Form (Struktur, Satzbau, Aufzählungen) und **Länge** aller UI-Texte. Die deutschen Quelltexte wurden in Form und Länge geprüft und gelten als Maßstab für die anderen Sprachen.
- Übersetzungen sollen in der Zielsprache natürlich wirken, **ohne** die im Deutschen vorgegebene inhaltliche Kürze und Struktur grundlegend zu sprengen (keine unnötigen Verlängerungen, wo der deutsche Text knapp ist).

#### Layout und Strukturbrüche (Mobile-First)

- Es muss **stets visuell geprüft** werden, ob längere übersetzte Texte zu **Strukturbrüchen** führen (z. B. Umbrüche, Überläufe, abgeschnittene Buttons, verschobene Layouts). Ist der übersetzte Text in der Zielsprache deutlich länger als der deutsche, sind entweder:
  - **kürzere, gleichwertige Formulierungen** zu wählen, oder
  - **Layout/UI** (z. B. Zeilenumbruch, `min-width`, Truncation) so anzupassen, dass in allen Locales kein Bruch entsteht.
- **Mobile-First:** Die Darstellung mit den Übersetzungen wird **zuerst auf Smartphone** geprüft (kleine Viewports, begrenzte Breite). Erst danach folgt die Prüfung auf Tablet/Desktop. Das entspricht dem projektweiten Mobile-First-Pragma (Backlog 6.4).
- Die Prüfung erfolgt pro View und pro Locale (z. B. in den relevanten Breakpoints); neue oder geänderte Übersetzungen werden vor Merge/Freigabe visuell in der App geprüft.
- **Zwei Übersetzungen (Mobile vs. Desktop):** Wenn ein einziger übersetzter Text auf Smartphone zu Strukturbrüchen oder schlechter Lesbarkeit führt, auf Desktop aber passend wäre, sind **zwei Varianten** zulässig und erwünscht: eine kürzere bzw. angepasste Fassung für Mobile und eine vollständige für Desktop. Die technische Umsetzung (z. B. unterschiedliche Message-IDs oder Kontext für „short“/„long“) ist im Übersetzungsworkflow zu definieren; die Quelltexte (Deutsch) liefern dann ebenfalls zwei Varianten pro Stelle, an der getrennt wird.

#### Datum, Einheiten und idiomatische Sprache

- **Datums- und Zeitformate** folgen der **Zielsprache/Locale** (z. B. über DatePipe/LOCALE_ID); keine Vermischung von Formaten (z. B. deutsches Datum in englischer UI).
- **Maßeinheiten, Zahlenformate und Währungen** entsprechen den **Konventionen der Zielsprache** (Dezimaltrennzeichen, Tausendertrennzeichen, Währungssymbol/Position).
- **Idiomatische Sprache:** Formulierungen sind in der Zielsprache **idiomatisch** (natürlich, nicht wörtlich „übersetzt“). Redewendungen, feste Begriffe (z. B. „Session beitreten“, „Abstimmung“, „Impressum“) und Button-Texte werden so gewählt, wie sie muttersprachliche Nutzer:innen erwarten.

### 5. Zusammenfassung für Entwickler:innen

- **i18n-Stack:** @angular/localize, Locale als Subpfad, Extract/Merge/Build pro Locale.
- **State-Verlust:** Siehe Tabelle oben; kritisch sind **Quiz bearbeiten** und **Quiz neu**.
- **Hinweis-Pflicht:** Auf diesen beiden Seiten muss vor einem Sprachwechsel bei ungespeichertem Inhalt ein **Hinweis an die Nutzer:innen** erscheinen (Dialog mit Erklärung und Bestätigung/Abbrechen oder Deaktivierung der Sprachwahl).
- **Übersetzungsvorgaben:** Informelle Anrede (Duzen), zeitgemäßer Stil; Deutsch als Referenz für Form und Länge; **visuelle Prüfung zuerst auf Smartphone** (Mobile-First), dann Desktop; bei Bedarf **zwei Übersetzungen** (Mobile kurz / Desktop voll); Datum, Einheiten und idiomatische Formulierungen in der Zielsprache zwingend beachten (Abschnitt 4).

## Konsequenzen

### Positiv

- Ein Build pro Sprache: optimale Ladeleistung, klare URLs pro Locale.
- Offizieller Angular-Weg: langfristig wartbar, gute Doku.
- Session-Seiten (Host/Vote/Present) verlieren fachlich keinen State; Join verliert nur Formulareingaben, Code bleibt in der URL.
- Klare Regel: Nutzer:innen werden auf kritischen Seiten vor Inhaltsverlust gewarnt.

### Negativ / Risiken

- Sprachwechsel bedeutet Reload; Nutzer:innen auf Quiz Edit/New müssen explizit gewarnt werden, sonst droht Verlust ungespeicherter Arbeit.
- Entwicklungs-Server (`ng serve`) unterstützt nur eine Locale gleichzeitig; zum Testen mehrerer Sprachen sind mehrere Builds oder Konfigurationen nötig.

## Alternativen (geprüft)

- **ngx-translate / Transloco:** Laufzeit-i18n, ein Build, Sprachwechsel ohne Reload → kein State-Verlust. Verworfen für die erste Umsetzung, da Backlog Performance und offizielle Angular-Integration priorisiert; bei Bedarf später ergänzbar.
- **Sprachwechsel ohne Hinweis auf Quiz Edit/New:** Würde ungespeicherte Änderungen still verlieren lassen. Verworfen aus Nutzer:innenschutz-Gründen; Hinweis ist verbindlich.

---

## Implementierungsstand (Projekt arsnova.eu)

Stand 2026-03-12: Alle UI-Texte für **de** und **en** markiert; `messages.en.xlf` vollständig (~580 trans-units). Legal-Seiten als Markdown pro Locale (`imprint.en.md`, `privacy.en.md`). Build `ng build --localize` ohne fehlende Übersetzungen. Details: [I18N-PLAN.md](../../implementation/I18N-PLAN.md), [I18N-ANGULAR.md](../../I18N-ANGULAR.md).
