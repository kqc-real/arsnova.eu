# AGENT.md – arsnova.eu

Dieses Dokument **ergänzt** die [.cursorrules](.cursorrules) (Projektstruktur, Monorepo-Regeln, Stack, DTO-Pattern). Cursor lädt `.cursorrules` automatisch; dieses Dokument beschreibt **Arbeitsweise und Qualitätsmaßstäbe**.

## 🔗 Basis: .cursorrules

Für Pfade (`apps/backend`, `apps/frontend`, `libs/shared-types`), strikte Monorepo-Regeln (Zod zuerst, nur tRPC), Angular (Signals, Standalone, kein RxJS für UI-State), DTO/Data-Stripping und Backlog-Verweis gilt **immer** die [.cursorrules](.cursorrules). Weiche davon nur ab, wenn der User es explizit mit dem Suffix **`--override`** verlangt.

## 🚶 Arbeitsweise (Baby-Steps)

- Schreibe nicht die gesamte App auf einmal.
- Wenn der Nutzer ein Feature anfragt (z.B. "Erstelle das Leaderboard"), frage nach, ob zuerst **Backend** (tRPC-Endpoint + DTO in `libs/shared-types`) oder **Frontend** (Angular UI) umgesetzt werden soll – so bleibt die tRPC-Typsicherheit gewahrt.
- Liefere Code, der **sofort kompiliert** und **gut kommentiert** ist.
- Liefer bei jeder Story die **DoD-Tests mit** (siehe Abschnitt „Test-Regel: Tests gehören zur Story“).
- Bevor du eine Story als fertig markierst: einen einfachen **tRPC-Integrationstest** generieren, der das DTO-Stripping verifiziert (z. B. kein `isCorrect` an Teilnehmende im Status `ACTIVE`), sofern die Story Frage-Auslieferung betrifft.

### Scroll- und Layout-Debugging

- Bei Scroll-, Overlay- oder "Inhalt ist da, aber nicht erreichbar"-Fehlern in Live-Ansichten **nicht mehrfach blind per Komponenten-CSS nachjustieren**.
- Früh den **tatsächlichen Scrollcontainer** im Browser prüfen (`app-main`, eingebettete Panels, Dialog-Content, Listen-Container) und nicht nur die betroffene Komponente.
- Immer auch auf **fixed/sticky-Überlagerungen** achten (Toolbar, Channel-Tabs, Live-Banner, Floating Controls). Das sichtbare Problem sitzt oft in der Kombination aus globalem Layout und eingebettetem Feature.
- **Mobile und Desktop getrennt prüfen**: unterschiedliche Top-Offsets, Banner-Höhen und Zentrierungsregeln können auf einer Plattform funktionieren und auf der anderen scheitern.

## 🧪 Unit-Tests (Angular Style Guide)

- **Platzierung:** Unit-Test-Dateien liegen **im gleichen Ordner** wie die zu testende Datei (z.B. Komponente, Service, Pipe).
- **Benennung:** Gleicher Basis-Dateiname + `.spec.ts` (z.B. `home.component.ts` → `home.component.spec.ts`, `preset-toast.component.ts` → `preset-toast.component.spec.ts`).
- **Eine Spec pro Artefakt:** Jede Komponente/Service hat ihre eigene Spec-Datei; keine zentralen Test-Sammlungen. Tests für eine Komponente gehören in die Spec **neben** dieser Komponente.
- **Stack:** Vitest + `@analogjs/vitest-angular`; Specs werden von `tsconfig.spec.json` (include: `src/**/*.spec.ts`) erfasst.

### Test-Regel: Tests gehören zur Story (DoD)

- **Unit-Tests sind Teil der Story, keine spätere Phase.** Eine Story gilt erst als fertig, wenn die in der DoD geforderten Tests mitgeliefert sind.
- **Backend (tRPC):** Pro neuer Query/Mutation/Subscription mindestens: **ein Happy-Path-Test** (gültige Eingabe → erwartete Ausgabe) und **ein Fehlerfall** (ungültige Eingabe, NOT_FOUND, Rate-Limit o.ä.). Tests liegen in `apps/backend/src/__tests__/` (z.B. pro Router oder thematisch gruppiert).
- **Frontend:** Pro neuer Komponente/Service eine Spec-Datei im gleichen Ordner; kritische Logik und Nutzerinteraktionen abdecken.
- Bevor eine Story als „fertig“ markiert wird: Tests ausführen (`npm run test -w @arsnova/backend` bzw. `-w @arsnova/frontend`) und DoD-Check (inkl. DTO-Stripping-Tests wo relevant).

## 📐 Zusätzliche Angular-Details (zu .cursorrules)

- **RxJS:** Nur für asynchrone Streams (WebSockets, tRPC-Subscriptions) oder z.B. Debouncing – **niemals** für einfachen UI-State (`BehaviorSubject` ist verboten).
- **Styling:** Angular Material 3 + Design-Tokens und SCSS-Patterns (kein Tailwind in `apps/frontend`). Siehe ADR 0005 und `docs/ui/STYLEGUIDE.md`.

## 🎨 Design-Leitplanken (aus UX-Audit)

Die folgenden Patterns wurden als verbindlich etabliert und **müssen** bei Änderungen an der Startseite oder ähnlichen Seiten eingehalten werden:

### Eingabe-Patterns

- **Segment-Input für Codes:** Session-Codes werden als 6 einzelne Segment-Boxen dargestellt, nicht als `mat-form-field`. Ein transparentes Overlay-`<input>` fängt Tastatur und Paste ab. Zustände (leer, aktiv, gefüllt, valide) werden über CSS-Klassen gesteuert, nicht über Material-States.

### Feedback-Patterns

- **Snackbar fuer schnelle Aktionen:** Wenn eine Aktion sofort wirkt (z. B. Preset-Wechsel), zeige eine Snackbar (5 s auto-dismiss) statt eines Modals. Snackbar-Farben: `inverse-surface` / `inverse-on-surface`.
- **Micro-Interactions:** Animationen (Pulse, Shake, Glow, CTA-Pulse) IMMER in `@media (prefers-reduced-motion: no-preference)` wrappen. Keine Animationen > 500 ms Dauer.
- **Shake bei Fehler:** Ungueltige Eingaben loesen eine kurze Shake-Animation (400 ms) + roten Border aus, KEIN Error-Toast oder Alert.

### Hierarchie und Layout

- **1 Primary CTA pro Karte:** Maximal ein gefüllter (`matButton`) Button pro logischem Bereich. Sekundäre Aktionen als `matButton="tonal"` in einer `home-cta-row` (Flex-Row mit Gap).
- **Mobile-Akzent:** Auf `< 600 px` erhält die primäre Einstiegskarte einen farbigen oberen Rand.
- **Visuelle Reihenfolge vs. DOM:** Wenn Inhalt logisch an einem Ort bleiben soll, aber **wichtiger Inhalt zuerst** erscheinen muss (z. B. Ergebnisse vor Steuerung), zuerst **Flexbox-`order` oder Modifier-Klassen** pruefen – nicht sofort grosses HTML umschichten (siehe STYLEGUIDE: Blitzlicht Standalone + eingebettet).

### Leere Zustaende (Listen, Tabs)

- **Einstieg:** Kontext oder kurze Begruessung **vor** der Aktionsleiste; Headline **ohne Redundanz** zum Seiten-`h1`; bei betonter Begruessung **`h2`** + M3-Typo-Tokens + Primary-Farbe (Details: `docs/ui/STYLEGUIDE.md`, Abschnitt „Leere Zustaende und Listen-Einstieg“).

### Onboarding

- **Erstbesucher-Banner:** Wird einmalig angezeigt (gesteuerert ueber `localStorage: home-visited`). Schliessbar, erscheint nicht erneut. 3-Schritt-Visualisierung mit Icons und Pfeilen.

### Bedingte Sichtbarkeit

- **Abhängige Optionen:** Chips oder UI-Elemente, die von einer übergeordneten Option abhängen (z. B. „Teams zuweisen“ hängt von „In Teams spielen“ ab), werden komplett ausgeblendet und nicht nur deaktiviert, solange die übergeordnete Option inaktiv ist. Pattern: `isOptionVisible(id)` prüft die `OPTION_REQUIRES_PARENT_ON`-Map.

### Wording

- Nutze aktivierende, rollenunabhängige Bezeichnungen („Mitmachen“, „Veranstalten“, „Los geht's“). Vermeide unnötig formelle Rollenbezeichnungen und technische Begriffe in nutzerseitigen UI-Texten. Vollständige Wording-Referenz in `docs/ui/STYLEGUIDE.md`.

## 🌐 i18n / Übersetzungen (ADR-0008)

Bei Arbeit an UI-Texten, Übersetzungsdateien oder mehrsprachiger Darstellung gelten die Vorgaben aus **ADR-0008** und `docs/I18N-ANGULAR.md`:

- **Technik:** @angular/localize, Locale als Subpfad; Quellsprache Deutsch. Quiz-Inhalte (Fragen, Antworten) werden NICHT übersetzt – nur UI-Texte.
- **Verbindliche Sync-Regel (5 Sprachen):** Neue oder geänderte deutschsprachige UI-Texte **müssen** sofort in `en`, `fr`, `es`, `it` nachgezogen werden (gleiches PR / gleicher Commit). Dazu gehören auch ARIA-Texte, Platzhalter, Fehlermeldungen, Hilfetexte und rechtliche Seiten.
- **Definition unvollständig:** Eine Story mit geänderten DE-UI-Texten ist nicht done, solange `messages.en.xlf`, `messages.fr.xlf`, `messages.es.xlf`, `messages.it.xlf` (und bei Legal-Inhalten `imprint/privacy.{locale}.md`) nicht synchron aktualisiert sind.
- **Stabile Message-IDs:** Neue oder häufig angepasste UI-Strings im Template mit `i18n="@@feature.key"` (bzw. `$localize`:@@…:) markieren, damit XLF-`trans-unit`-IDs bei Copy-Updates nachvollziehbar bleiben; alte, ungenutzte Einheiten entfernen.
- **Sprachstil:** Informelle Anrede (Duzen) und zeitgemäßer Stil in allen Sprachen.
- **Referenz Deutsch:** Deutscher Quelltext ist Maßstab für Form und Länge; Übersetzungen sollen die vorgegebene Kürze/Struktur wahren.
- **Visuelle Prüfung, Mobile-First:** Darstellung mit Übersetzungen **zuerst auf Smartphone** prüfen, dann Desktop. Längere Texte können Strukturbrüche verursachen → kürzere Formulierung oder Layout anpassen; bei Bedarf **zwei Varianten** (Mobile kurz / Desktop voll).
- **Datum, Einheiten, Idiomatik:** Formate und Maßeinheiten nach Zielsprache/Locale; Formulierungen idiomatisch (natürlich in der Zielsprache).
- **Sprachwechsel mit ungespeichertem Inhalt:** Auf Quiz bearbeiten (`/quiz/:id`) und Quiz neu (`/quiz/new`) muss vor Locale-Wechsel ein Hinweis erscheinen (Dialog oder Deaktivierung der Sprachwahl), wenn ungespeicherte Änderungen vorliegen – siehe ADR-0008 Abschnitt 3.

Vollständige Vorgaben: `docs/architecture/decisions/0008-i18n-internationalization.md`.
