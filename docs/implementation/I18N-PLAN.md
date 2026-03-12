# Planungsdokument: Internationalisierung (Story 6.2)

**Ziel:** UI der App mehrsprachig anbieten (de, en, fr, it, es) mit @angular/localize, Locale als Subpfad, ohne Quiz-Inhalte zu übersetzen.

**Implementierungsstand (2026-03-12):** Story 6.2 ist abgeschlossen. Alle UI-Bereiche sind mit i18n/$localize markiert (inkl. ARIA, Fehlertexte, Placeholders), die Locale-Dateien `messages.en/fr/es/it.xlf` sind gepflegt, und `angular.json` baut `de/en/fr/it/es`. Sprachwähler (Toolbar) nutzt Locale-Subpfade + Persistenz (`home-language`) mit Vollreload und Guard bei ungespeicherten Änderungen. Legal-Seiten laden `imprint/privacy.{locale}.md` mit Fallback auf `de`. Datums- und Zahlenformate folgen der gewählten Locale (keine feste `LOCALE_ID`-Vorgabe; Locale-Daten für `de/en/fr/es/it` registriert). Build und CI laufen mit lokalisiertem Output erfolgreich.

**Nächste Schritte (optional):** Laufender sprachlicher Feinschliff bei neuen/angepassten UI-Texten in allen 5 Sprachen (`de/en/fr/es/it`) im selben PR/Commit gemäß ADR-0008 sowie AGENT/.cursorrules.

**Referenzen:**
- **Backlog:** Epic 6, Story 6.2 (Internationalisierung)
- **ADR-0008:** [docs/architecture/decisions/0008-i18n-internationalization.md](../architecture/decisions/0008-i18n-internationalization.md) — Technik, Locale-Strategie, Hinweis bei Inhaltsverlust, Vorgaben für Übersetzungen (Duzen, DE-Referenz, Mobile-First-Prüfung, ggf. zwei Varianten Mobile/Desktop)
- **Umsetzungshinweise:** [docs/I18N-ANGULAR.md](../I18N-ANGULAR.md)
- **Lokal testen (lokalisierten Build mit API):** [README.md](../../README.md) Abschnitt 4 „Lokalisierter Build (i18n) lokal testen“; Details zum Proxy und typischen Fehlern in [I18N-ANGULAR.md](../I18N-ANGULAR.md) Abschnitt „Lokalisierter Build lokal“.

---

## 0. Grobe Schätzung: Anzahl Übersetzungen (Labels & Phrasen)

Abschätzung basierend auf Durchsicht der aktuellen Frontend-Templates und -Services (ohne `ng extract-i18n`; nach Markierung kann die tatsächliche Zahl abweichen):

| Kategorie | Geschätzte Anzahl (einzigartige Einheiten) | Anmerkung |
|-----------|--------------------------------------------|-----------|
| **Templates (HTML)** | **ca. 250–320** | Buttons, Labels, Überschriften, Hinweise, Links, Card-Titel, Badges, Status-Texte; inkl. ~65 aria-labels/placeholders/title. Doppelte Phrasen (z. B. „Frage X“, „Letzte Frage“ an mehreren Stellen) zählen als eine Einheit. |
| **TypeScript** | **ca. 50–80** | Fehlermeldungen, Validierungstexte, Snackbar-/Dialog-Texte, dynamische Labels (z. B. Countdown, Platz, Punkte), Meldungen in session-host/session-vote/quiz-edit/quiz-new/join/legal. |
| **Help** | **ca. 20–40** | Texte in der Help-Komponente (Überschriften, Absätze, Hinweise). |
| **Rechtliche Seiten** | **2 lange Dokumente** | Impressum und Datenschutz je als vollständiger Text pro Sprache (oder in Abschnitte gegliedert, dann ca. 40–80 Segmente gesamt). |
| **Gesamt (UI ohne Legal)** | **ca. 320–450** | Summe aus Templates, TS und Help. |
| **Mit Legal (als 2 Dokumente)** | **+ 2 × 4 = 8 Dokumente** | Pro Zielsprache (en, fr, it, es) je Impressum + Datenschutz; DE ist Quellsprache. |

**Fazit:** Es kommen auf euch grob **rund 350–450 übersetzbare UI-Einheiten** (Labels, Buttons, Phrasen, Meldungen) zu, plus **2 Rechtstexte (Impressum, Datenschutz)** in **4 Zielsprachen** (en, fr, it, es). Bei zwei Varianten (Mobile kurz / Desktop voll) für einen Teil der Texte erhöht sich die Anzahl um die betroffenen Einheiten. Die exakte Zahl steht erst nach dem ersten `ng extract-i18n` fest.

---

## 1. Rahmenbedingungen (aus ADR-0008)

| Thema | Vorgabe |
|-------|---------|
| **Technik** | @angular/localize (Compile-Time); Locale = Subpfad (`/de/`, `/en/`, …) |
| **Quellsprache** | Deutsch (sourceLocale: de) |
| **Zielsprachen** | de, en, fr, it, es |
| **Übersetzt** | Nur UI-Texte (Buttons, Labels, Fehlermeldungen, Platzhalter, rechtliche Seiten) |
| **Nicht übersetzt** | Quiz-Inhalte (Fragenstamm, Antworten) — bleiben in Dozentensprache |
| **Sprachwechsel** | Navigation zu anderem Subpfad → vollständiger Reload; State-Verlust auf einigen Seiten (siehe ADR-0008 §2) |
| **Hinweis bei Reload** | Auf Quiz bearbeiten und Quiz neu: Bei ungespeichertem Inhalt Hinweis-Dialog oder Deaktivierung der Sprachwahl (ADR-0008 §3) |
| **Übersetzungsvorgaben** | Duzen, zeitgemäß; DE = Referenz für Form/Länge; Prüfung **zuerst Smartphone** (Mobile-First); ggf. zwei Varianten (Mobile kurz / Desktop voll); Datum/Einheiten/Idiomatik in Zielsprache |

---

## 2. Abhängigkeiten und Reihenfolge

```
Phase 0: Voraussetzungen (keine Code-Änderung an Übersetzungen)
   └── ADR-0008, I18N-ANGULAR.md, dieser Plan sind freigegeben

Phase 1: Paket & Build-Grundgerüst
   └── ng add @angular/localize; angular.json i18n/localize (zunächst nur de)

Phase 2: Texte markieren (ohne sofort alle Locales zu bauen)
   └── i18n / $localize in Templates und TS; Extract einmalig

Phase 3: Übersetzungsdateien & erste weitere Locale
   └── messages.*.xlf anlegen; angular.json locales; Build für de + en testen

Phase 4: Alle Locales, Sprachwähler, Persistenz
   └── en, fr, it, es; Toolbar/Sprachwähler → Locale-Subpfad; localStorage + Server-Redirect

Phase 5: Rechtliche Seiten & kritische Routen
   └── Legal (Impressum/Datenschutz) pro Locale; Hinweis auf Quiz Edit/New bei Sprachwechsel

Phase 6: Qualität & Freigabe
   └── Visuelle Prüfung (Mobile-First), ggf. zweite Varianten; DoD 6.2 prüfen
```

**Empfohlene Reihenfolge:** 1 → 2 → 3 → 4 → 5 → 6. Phase 2 kann nach Feature-Bereichen (z. B. Home, dann Session, dann Quiz) schrittweise erfolgen.

---

## 3. Phase 1: Paket & Build-Grundgerüst

| # | Task | Beschreibung | Ergebnis |
|---|------|--------------|----------|
| 1.1 | **@angular/localize hinzufügen** | Im Frontend-Projekt `ng add @angular/localize` ausführen. Prüfen: `package.json`, `tsconfig`, `main.ts` (Triple-Slash für $localize). | Paket installiert, Build läuft weiter |
| 1.2 | **angular.json: i18n-Block** | Unter `projects.frontend.architect.build.options` Block `i18n` anlegen: `sourceLocale: "de"`, `locales: { "de": {} }`. | Quell-Locale definiert |
| 1.3 | **angular.json: localize** | Für Entwicklung zunächst `"localize": ["de"]` setzen, damit `ng serve` weiterhin funktioniert (nur eine Locale). | `ng serve` und `ng build` laufen |
| 1.4 | **baseHref / outputPath** | Prüfen, ob `baseHref` und `outputPath` mit Locale-Subpfaden zusammenpassen (CLI setzt bei localize pro Locale eigenen outputPath). Dokumentation angular.dev „Merge“ / „Deploy“ beachten. | Kein Konflikt mit bestehendem Routing |

**Abnahme:** `ng build` und `ng serve` laufen; noch keine sichtbare Mehrsprachigkeit.

---

## 4. Phase 2: Texte für Übersetzung markieren

Alle **UI-Texte** (keine Quiz-Inhalte) in Templates und TypeScript mit `i18n` bzw. `$localize` markieren. Reihenfolge nach Feature-Bereichen empfohlen, damit Extract schrittweise genutzt werden kann.

| Bereich | Wo | Was markieren |
|---------|-----|----------------|
| **Home** | home.component, top-toolbar (soweit global) | Buttons, Labels, Platzhalter, Footer (Impressum/Datenschutz-Links), Session-Code-Hinweise |
| **Join** | join.component | Titel, Session-Infos, Nickname-Labels, Hinweise, Button „Jetzt beitreten“ |
| **Session (Host)** | session-host | Phasen-Labels, Buttons (Nächste Frage, Diskussionsphase, …), Lobby-Texte, Lesephase/Diskussions-Banner, Ergebnis-Labels („Richtig“, …), Hinweise |
| **Session (Vote)** | session-vote | Lobby, Fragentitel-Label, Lesephase-Banner, Diskussions-Text, Antwort-Optionen-Labels, „Antwort gesendet“, Scorecard/Belohnung/Emoji-Bereich, Countdown-Texte |
| **Session (Present)** | session-present | Falls eigene UI-Texte (Beamer) |
| **Quiz (Liste, New, Edit, Preview)** | quiz-list, quiz-new, quiz-edit, quiz-preview | Alle Buttons, Labels, Fehlermeldungen, Platzhalter, Validierungstexte; **nicht** Frage-/Antwort-Inhalte aus dem Quiz-Modell |
| **Legal** | legal-page | Nur falls Texte aus dem Code („Wird geladen…“, Fehlermeldung); Impressum/Datenschutz-Inhalte siehe Phase 5 |
| **Help** | help.component | Überschriften, Hinweise |
| **Feedback** | feedback-host, feedback-vote | Alle sichtbaren UI-Texte |
| **Admin** | admin | Buttons, Labels, Meldungen |
| **Shared** | top-toolbar, preset-toast, server-status-widget, … | Theme/Preset-Labels, Sprachwähler-Labels, Statistik-Texte |

**Regeln beim Markieren:**
- Template: `i18n` auf Elementen mit statischem Text; `i18n-placeholder`, `i18n-title`, `i18n-alt` etc. für Attribute.
- TypeScript: `$localize\`Text\``; bei Kontext für Übersetzer: `$localize`:Bedeutung|Beschreibung:Text\``.
- ICU für Plural/Select wo nötig (z. B. „1 Frage“ / „X Fragen“).
- **Nicht** markieren: Dozenten-Fragentext, Dozenten-Antwortoptionen, Quiz-Titel/Beschreibung (Inhalte aus Store/API).

**Nach Phase 2 (oder pro Bereich):** `ng extract-i18n` ausführen → `messages.xlf` (oder gewähltes Format) entsteht; noch keine Übersetzungen einpflegen.

**Abnahme:** Extract läuft ohne Fehler; alle relevanten UI-Strings sind in der generierten Datei vertreten.

---

## 5. Phase 3: Übersetzungsdateien & erste weitere Locale

| # | Task | Beschreibung | Ergebnis |
|---|------|--------------|----------|
| 3.1 | **Extract-Optionen festlegen** | `ng extract-i18n --output-path src/locale --out-file messages.xlf` (oder .json); ggf. in `package.json` Script `extract-i18n`. | Reproduzierbare Quell-Datei |
| 3.2 | **messages.en.xlf anlegen** | Kopie der Quell-XLF; für Englisch `<target>`-Tags befüllen. DE bleibt Quellsprache (keine messages.de.xlf nötig, oder leere Referenz). | Eine Zielsprache (en) übersetzt |
| 3.3 | **angular.json: locales erweitern** | `locales: { "de": {}, "en": { "translation": "src/locale/messages.en.xlf" } }`. Für Build-Test `"localize": ["de", "en"]` (oder Konfiguration `production,en`). | Zwei Locales werden gebaut |
| 3.4 | **Build & Ausgabe prüfen** | `ng build --localize` (oder mit Konfiguration). Prüfen: `dist/.../de/`, `dist/.../en/`; baseHref je Locale. | Zwei getrennte Outputs |
| 3.5 | **Visuelle Prüfung (Mobile-First)** | App mit Locale `de` und `en` **zuerst auf Smartphone-Viewport** prüfen (ADR-0008); Strukturbrüche bei längeren englischen Texten dokumentieren oder sofort kürzere Varianten/ zwei Varianten planen. | Keine ungeprüften Layout-Brüche |

**Abnahme:** Build für de und en erfolgreich; eine manuelle Sichtprüfung (mind. Startseite, Join, Session-Vote) auf kleinem Viewport durchgeführt.

---

## 6. Phase 4: Alle Locales, Sprachwähler, Persistenz

| # | Task | Beschreibung | Ergebnis |
|---|------|--------------|----------|
| 4.1 | **Übersetzungsdateien fr, it, es** | Aus messages.xlf Kopien `messages.fr.xlf`, `messages.it.xlf`, `messages.es.xlf` anlegen und übersetzen (Vorgaben ADR-0008: Duzen, idiomatisch, Länge/Struktur an DE orientieren). | Alle fünf Sprachen im Build |
| 4.2 | **angular.json: alle locales** | `locales` um fr, it, es ergänzen; `localize: true` für Produktion. | `ng build --localize` baut alle fünf |
| 4.3 | **Sprachwähler → Locale-URL** | Aktueller Sprachwähler in der Toolbar speichert nur localStorage. Anpassen: Klick auf eine Sprache führt zur **Navigation** auf den passenden Locale-Subpfad (z. B. `/en/...`), damit ein Reload mit der gewählten Sprache erfolgt. Bestehende Route beibehalten (z. B. `/de/session/ABC123/host` → `/en/session/ABC123/host`). | Sprachwechsel = Wechsel des Subpfads |
| 4.4 | **Persistenz** | Gespeicherte Sprache (z. B. `home-language` in localStorage) beim nächsten Besuch auswerten: serverseitig Redirect von `/` auf `/de/` oder `/en/` etc., oder clientseitig nach Boot Redirect auf gespeicherte Locale. | Nutzer landet in zuletzt gewählter Sprache |
| 4.5 | **Browser-Default (Accept-Language)** | Beim ersten Besuch ohne gespeicherte Präferenz: Server (oder Fallback-Logik) leitet anhand `Accept-Language` auf passende Locale um; Fallback Englisch. | Erstbesucher erhalten sinnvolle Sprache |

**Abnahme:** Alle fünf Locales bauen; Sprachwähler wechselt die URL; nach Reload erscheint die gewählte Sprache; Erstbesuch nutzt Accept-Language.

---

## 7. Phase 5: Rechtliche Seiten & Hinweis bei Inhaltsverlust

| # | Task | Beschreibung | Ergebnis |
|---|------|--------------|----------|
| 5.1 | **Legal: Inhalte pro Locale** | Impressum und Datenschutz pro Sprache bereitstellen. Option A: Markdown-Dateien `imprint.de.md`, `imprint.en.md`, … und Legal-Page lädt Datei nach aktueller Locale (aus Pfad oder Service). Option B: Lange Texte in XLIFF/Übersetzungsdateien; Template mit $localize. Routen bleiben `/legal/imprint`, `/legal/privacy`. | Impressum/Datenschutz in allen Sprachen |
| 5.2 | **Hinweis Quiz bearbeiten** | Auf Route `/quiz/:id` (Edit): Vor Auslösen des Locale-Wechsels (Sprachwähler-Klick) prüfen, ob **ungespeicherte Änderungen** existieren (z. B. Formular dirty). Wenn ja: Dialog „Sprache wechseln? Ungespeicherte Änderungen gehen verloren.“ mit „Abbrechen“ / „Trotzdem wechseln“; bei „Trotzdem wechseln“ Navigation zu neuer Locale. Alternativ: Sprachwahl deaktivieren, bis gespeichert. | Kein stiller Verlust auf Quiz Edit |
| 5.3 | **Hinweis Quiz neu** | Auf Route `/quiz/new`: Solange kein erstes Speichern erfolgt ist, gleicher Hinweis oder Deaktivierung der Sprachwahl („Ihr neuer Quiz-Entwurf geht verloren.“). | Kein stiller Verlust auf Quiz New |

**Abnahme:** Legal-Seiten in allen Locales lesbar; auf Quiz Edit und Quiz New erscheint der Hinweis bzw. die Sprachwahl ist bis Speichern deaktiviert.

---

## 8. Phase 6: Qualität & Freigabe

| # | Task | Beschreibung | Ergebnis |
|---|------|--------------|----------|
| 6.1 | **Visuelle Prüfung (Mobile-First)** | Jede View in allen fünf Locales **zuerst auf Smartphone-Viewport** prüfen (ADR-0008). Strukturbrüche (Umbrüche, abgeschnittene Buttons, Überläufe) dokumentieren und beheben: kürzere Formulierung oder Layout-Anpassung; wo nötig zwei Varianten (Mobile kurz / Desktop voll) einführen. | Keine ungeprüften Layout-Brüche in Release |
| 6.2 | **Datum/Einheiten/Idiomatik** | Stichproben: DatePipe/DecimalPipe in allen Locales; Zahlen- und Datumsformat passend. Formulierungen idiomatisch in en, fr, it, es. | DoD 6.2 „Datums- und Zahlenformate“, „idiomatisch“ erfüllt |
| 6.3 | **Backlog 6.2 DoD** | Akzeptanzkriterien Story 6.2 durchgehen: Sprachen, Browser-Default, Sprachwähler, Persistenz, Übersetzungsdateien, Quiz-Inhalte nicht übersetzt, Datum/Zahl. | Story 6.2 als erledigt abnehmbar |
| 6.4 | **CI/Build** | Sicherstellen, dass `ng build --localize` in CI läuft (alle Locales); ggf. Übersetzungs-Warnungen (missing translation) als Fehler konfigurieren (`i18nMissingTranslation: "error"`). | Reproduzierbarer Mehrsprachen-Build |

**Abnahme:** Alle Akzeptanzkriterien 6.2 erfüllt; visuelle Prüfung dokumentiert; CI baut alle Locales.

---

## 9. Offene Punkte / Entscheidungen vor Start

| Thema | Optionen | Empfehlung |
|-------|----------|------------|
| **Format Übersetzungsdateien** | XLIFF (.xlf/.xlf2), JSON, ARB | **Angular (CLI) Standard:** `--format` default ist **xlf** (XLIFF 1.2). Erlaubte Werte: `xlf`, `xlf2`, `xliff`, `xliff2`, `json`, `arb`, `xmb`, `legacy-migrate`. Die offizielle Doku (angular.dev) nennt kein explizites „empfohlen für v22“; **XLIFF 1.2 oder 2** unterstützen Meaning/Description voll. **JSON** unterstützt diese Metadaten aktuell nicht vollständig (offenes Issue). **Empfehlung:** XLIFF 1.2 (`.xlf`) oder XLIFF 2 (`.xlf2`) für volle Metadaten; JSON/ARB nur, wenn Tooling oder CI das zwingend verlangt. |
| **Ablage der Übersetzungsdateien** | `src/locale/`, `apps/frontend/locale/`, `i18n/` | `src/locale/` (nah am App-Code, von angular.json aus referenzierbar) |
| **Zwei Varianten (Mobile/Desktop)** | Pro String zwei IDs (short/long) oder Kontext-Attribut | Erst bei konkretem Bedarf (nach erster Mobile-Prüfung) festlegen; technisch über separate Message-IDs oder ICU möglich |
| **Server-Redirect (Accept-Language)** | Nginx/Apache vs. eigener Middleware vs. clientseitig | Abhängig vom Hosting; Nginx/Apache-Beispiele in angular.dev „Deploy multiple locales“ |

---

## 10. Kurz-Checkliste vor Implementierungsstart

- [ ] ADR-0008 und I18N-ANGULAR.md sind gelesen und freigegeben.
- [ ] Entscheidung: Übersetzungsformat (XLIFF/JSON) und Ablagepfad getroffen.
- [ ] Phase 1 (Paket & Build-Grundgerüst) als erste Umsetzung geplant; danach schrittweise Phase 2 nach Feature-Bereichen.
- [ ] Verantwortung für Übersetzungen (en, fr, it, es) geklärt (intern/extern); Vorgaben (Duzen, DE-Referenz, Mobile-First) an Übersetzer:innen kommuniziert.

---

*Stand: Umsetzung abgeschlossen; Dokument dient als Referenz und Wartungsleitfaden. Bei Änderungen an ADR-0008 oder Backlog 6.2 diesen Plan synchron aktualisieren.*
