# 🤖 AGENT.md - arsnova.eu (Vibe Coding Guidelines)

**Hallo KI-Assistent!** Dieses Dokument **ergänzt** die [.cursorrules](.cursorrules) (Projektstruktur, Monorepo-Regeln, Stack, DTO-Pattern). Cursor lädt .cursorrules automatisch; dieses Dokument beschreibt **Arbeitsweise und Qualität**.

## 🔗 Basis: .cursorrules
Für Pfade (`apps/backend`, `apps/frontend`, `libs/shared-types`), strikte Monorepo-Regeln (Zod zuerst, nur tRPC), Angular (Signals, Standalone, kein RxJS für UI-State), DTO/Data-Stripping und Backlog-Verweis gilt **immer** die [.cursorrules](.cursorrules). Weiche davon nur ab, wenn der User es explizit mit dem Suffix **`--override`** verlangt.

## 🚶 Arbeitsweise (Baby-Steps)
* Schreibe nicht die gesamte App auf einmal.
* Wenn der Nutzer ein Feature anfragt (z.B. "Erstelle das Leaderboard"), frage nach, ob zuerst **Backend** (tRPC-Endpoint + DTO in `libs/shared-types`) oder **Frontend** (Angular UI) umgesetzt werden soll – so bleibt die tRPC-Typsicherheit gewahrt.
* Liefere Code, der **sofort kompiliert** und **gut kommentiert** ist.
* Liefer bei jeder Story die **DoD-Tests mit** (siehe Abschnitt „Test-Regel: Tests gehören zur Story“).
* Bevor du eine Story als fertig markierst: einen einfachen **tRPC-Integrationstest** generieren, der das DTO-Stripping (z.B. kein `isCorrect` an Studenten in ACTIVE) verifiziert, sofern die Story Frage-Auslieferung betrifft.

## 🧪 Unit-Tests (Angular Style Guide)
* **Platzierung:** Unit-Test-Dateien liegen **im gleichen Ordner** wie die zu testende Datei (z.B. Komponente, Service, Pipe).
* **Benennung:** Gleicher Basis-Dateiname + `.spec.ts` (z.B. `home.component.ts` → `home.component.spec.ts`, `preset-toast.component.ts` → `preset-toast.component.spec.ts`).
* **Eine Spec pro Artefakt:** Jede Komponente/Service hat ihre eigene Spec-Datei; keine zentralen Test-Sammlungen. Tests für eine Komponente gehören in die Spec **neben** dieser Komponente.
* **Stack:** Vitest + `@analogjs/vitest-angular`; Specs werden von `tsconfig.spec.json` (include: `src/**/*.spec.ts`) erfasst.

### Test-Regel: Tests gehören zur Story (DoD)
* **Unit-Tests sind Teil der Story, keine spätere Phase.** Eine Story gilt erst als fertig, wenn die in der DoD geforderten Tests mitgeliefert sind.
* **Backend (tRPC):** Pro neuer Query/Mutation/Subscription mindestens: **ein Happy-Path-Test** (gültige Eingabe → erwartete Ausgabe) und **ein Fehlerfall** (ungültige Eingabe, NOT_FOUND, Rate-Limit o.ä.). Tests liegen in `apps/backend/src/__tests__/` (z.B. pro Router oder thematisch gruppiert).
* **Frontend:** Pro neuer Komponente/Service eine Spec-Datei im gleichen Ordner; kritische Logik und Nutzerinteraktionen abdecken.
* Bevor eine Story als „fertig“ markiert wird: Tests ausführen (`npm run test -w @arsnova/backend` bzw. `-w @arsnova/frontend`) und DoD-Check (inkl. DTO-Stripping-Tests wo relevant).

## 📐 Zusätzliche Angular-Details (zu .cursorrules)
* **RxJS:** Nur für asynchrone Streams (WebSockets, tRPC-Subscriptions) oder z.B. Debouncing – **niemals** für einfachen UI-State (`BehaviorSubject` ist verboten).
* **Styling:** Angular Material 3 + Design-Tokens und SCSS-Patterns (kein Tailwind in `apps/frontend`). Siehe ADR 0005 und `docs/ui/STYLEGUIDE.md`.

## 🎨 Design-Leitplanken (aus UX-Audit)
Die folgenden Patterns wurden als verbindlich etabliert und MUESSEN bei Aenderungen an der Startseite oder aehnlichen Seiten eingehalten werden:

### Eingabe-Patterns
* **Segment-Input fuer Codes:** Session-Codes werden als 6 einzelne Segment-Boxen dargestellt, NICHT als mat-form-field. Ein transparenter Overlay-`<input>` faengt Tastatur/Paste ab. Zustaende (leer, aktiv, gefuellt, valide) ueber CSS-Klassen, nicht ueber Material-States.

### Feedback-Patterns
* **Snackbar fuer schnelle Aktionen:** Wenn eine Aktion sofort wirkt (z. B. Preset-Wechsel), zeige eine Snackbar (5 s auto-dismiss) statt eines Modals. Snackbar-Farben: `inverse-surface` / `inverse-on-surface`.
* **Micro-Interactions:** Animationen (Pulse, Shake, Glow, CTA-Pulse) IMMER in `@media (prefers-reduced-motion: no-preference)` wrappen. Keine Animationen > 500 ms Dauer.
* **Shake bei Fehler:** Ungueltige Eingaben loesen eine kurze Shake-Animation (400 ms) + roten Border aus, KEIN Error-Toast oder Alert.

### Hierarchie und Layout
* **1 Primary CTA pro Karte:** Maximal ein gefuellter (`matButton`) Button pro logischem Bereich. Sekundaere Aktionen als `matButton="tonal"` in einer `home-cta-row` (Flex-Row mit Gap).
* **Mobile-Akzent:** Auf < 600 px erhaelt die primaere Einstiegskarte einen farbigen Top-Border.

### Onboarding
* **Erstbesucher-Banner:** Wird einmalig angezeigt (gesteuerert ueber `localStorage: home-visited`). Schliessbar, erscheint nicht erneut. 3-Schritt-Visualisierung mit Icons und Pfeilen.

### Bedingte Sichtbarkeit
* **Abhaengige Optionen:** Chips oder UI-Elemente, die von einem Parent abhaengen (z. B. "Teams zuweisen" haengt von "In Teams spielen" ab), werden komplett ausgeblendet (nicht nur disabled), solange der Parent inaktiv ist. Pattern: `isOptionVisible(id)` prueft `OPTION_REQUIRES_PARENT_ON`-Map.

### Wording
* Nutze aktivierende, rollenunabhaengige Bezeichnungen ("Mitmachen", "Veranstalten", "Los geht's"). Vermeide formelle Rollenbezeichnungen ("Teilnehmer/in", "Lehrperson") und technische Begriffe ("Session erstellen", "Server erreichbar"). Vollstaendige Wording-Referenz in `docs/ui/STYLEGUIDE.md`.

## 🌐 i18n / Übersetzungen (ADR-0008)
Bei Arbeit an UI-Texten, Übersetzungsdateien oder mehrsprachiger Darstellung gelten die Vorgaben aus **ADR-0008** und `docs/I18N-ANGULAR.md`:

* **Technik:** @angular/localize, Locale als Subpfad; Quellsprache Deutsch. Quiz-Inhalte (Fragen, Antworten) werden NICHT übersetzt – nur UI-Texte.
* **Verbindliche Sync-Regel (5 Sprachen):** Neue oder geänderte deutschsprachige UI-Texte MUESSEN sofort in `en`, `fr`, `es`, `it` nachgezogen werden (gleiches PR/gleicher Commit). Dazu gehören auch ARIA-Texte, Platzhalter, Fehlermeldungen, Help-Texte und rechtliche Seiten.
* **Definition unvollständig:** Eine Story mit geänderten DE-UI-Texten ist nicht done, solange `messages.en.xlf`, `messages.fr.xlf`, `messages.es.xlf`, `messages.it.xlf` (und bei Legal-Inhalten `imprint/privacy.{locale}.md`) nicht synchron aktualisiert sind.
* **Sprachstil:** Informelle Anrede (Duzen) und zeitgemäßer Stil in allen Sprachen.
* **Referenz Deutsch:** Deutscher Quelltext ist Maßstab für Form und Länge; Übersetzungen sollen die vorgegebene Kürze/Struktur wahren.
* **Visuelle Prüfung, Mobile-First:** Darstellung mit Übersetzungen **zuerst auf Smartphone** prüfen, dann Desktop. Längere Texte können Strukturbrüche verursachen → kürzere Formulierung oder Layout anpassen; bei Bedarf **zwei Varianten** (Mobile kurz / Desktop voll).
* **Datum, Einheiten, Idiomatik:** Formate und Maßeinheiten nach Zielsprache/Locale; Formulierungen idiomatisch (natürlich in der Zielsprache).
* **Sprachwechsel mit ungespeichertem Inhalt:** Auf Quiz bearbeiten (`/quiz/:id`) und Quiz neu (`/quiz/new`) muss vor Locale-Wechsel ein Hinweis erscheinen (Dialog oder Deaktivierung der Sprachwahl), wenn ungespeicherte Änderungen vorliegen – siehe ADR-0008 Abschnitt 3.

Vollständige Vorgaben: `docs/architecture/decisions/0008-i18n-internationalization.md`.
