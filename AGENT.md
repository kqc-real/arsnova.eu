# 🤖 AGENT.md - arsnova.eu (Vibe Coding Guidelines)

**Hallo KI-Assistent!** Dieses Dokument **ergänzt** die [.cursorrules](.cursorrules) (Projektstruktur, Monorepo-Regeln, Stack, DTO-Pattern). Cursor lädt .cursorrules automatisch; dieses Dokument beschreibt **Arbeitsweise und Qualität**.

## 🔗 Basis: .cursorrules
Für Pfade (`apps/backend`, `apps/frontend`, `libs/shared-types`), strikte Monorepo-Regeln (Zod zuerst, nur tRPC), Angular (Signals, Standalone, kein RxJS für UI-State), DTO/Data-Stripping und Backlog-Verweis gilt **immer** die [.cursorrules](.cursorrules). Weiche davon nur ab, wenn der User es explizit mit dem Suffix **`--override`** verlangt.

## 🚶 Arbeitsweise (Baby-Steps)
* Schreibe nicht die gesamte App auf einmal.
* Wenn der Nutzer ein Feature anfragt (z.B. "Erstelle das Leaderboard"), frage nach, ob zuerst **Backend** (tRPC-Endpoint + DTO in `libs/shared-types`) oder **Frontend** (Angular UI) umgesetzt werden soll – so bleibt die tRPC-Typsicherheit gewahrt.
* Liefere Code, der **sofort kompiliert** und **gut kommentiert** ist.
* Bevor du eine Story als fertig markierst: einen einfachen **tRPC-Integrationstest** generieren, der das DTO-Stripping (z.B. kein `isCorrect` an Studenten in ACTIVE) verifiziert.

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
