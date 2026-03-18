<!-- markdownlint-disable MD013 -->

# Story 2.8 – Implementierungsplan: Produktives Smartphone-Hosting fuer Live-Sessions

**Epic 2 · Live-Sitzung & Lobby**  
**Ziel:** Die Host-Ansicht von arsnova.eu wird auf Smartphones zu einem vollwertigen produktiven Bedienmodus fuer echte Live-Sessions mit Quiz, Q&A, Blitzlicht und Ergebnisansichten, ohne die Desktop-/Beamer-Ansicht zu verschlechtern.

**Architekturbezug:** `ADR-0014`  
**Backlog-Bezug:** `Story 2.8 Produktives Smartphone-Hosting fuer Live-Sessions`

**Status:** ✅ Abgeschlossen (2026-03-13)

---

## Zielbild

Dozierende koennen eine laufende Veranstaltung komplett auf dem Smartphone hosten:

1. Session starten und ueberblicken
2. zwischen Quiz, Q&A und Blitzlicht wechseln
3. Blitzlicht-Runden starten, vergleichen, zuruecksetzen und beenden
4. Q&A-Fragen moderieren
5. Ergebnisse lesen
6. Session sicher beenden

Wichtig:

- **gleiche Rolle, gleiche Route, gleiche Kernfunktionen**
- **keine Mobile-Spezialroute**
- **keine Desktop-Regression**
- **produktive Verbesserung ueber Mobile-Breakpoints**

---

## Ist-Stand (vor Umsetzung)

| Bereich | Status |
|--------|--------|
| **Host-Shell** | `session-host.component.html/.scss` nutzt Kanal-Tabs, Live-Banner und zusaetzliche Controls. Mobile Layouts sind vorhanden, aber noch stark aus Desktop-/Beamer-Denken abgeleitet. |
| **Top-Zone** | Tabs und Live-Banner arbeiten teils mit `fixed`, Offsets und `dvh`-Hoehen. Das erzeugt auf Smartphone Konkurrenz zwischen Scrollbarkeit, Sichtbarkeit und Steuerungsdichte. |
| **Quiz-Host** | Die Kernlogik funktioniert, aber die obere Steuerzone und Folgeaktionen sind mobil nicht als fokussierter Primar-Workflow modelliert. |
| **Q&A-Host** | `session-channel-card--qa` ist funktional, aber Moderation und Informationsdichte koennen mobil schnell zu dicht wirken. |
| **Blitzlicht-Host** | `feedback-host.component.*` ist bereits responsive, enthaelt mobil aber viele gleichzeitige Aktions- und Ergebnisbereiche. Vergleichsansicht und Aktionsgruppen brauchen klare Priorisierung. |
| **Vote-/Present-Views** | `session-vote` und `session-present` enthalten kanaluebergreifende mobile Regeln, aber noch kein konsistentes Smartphone-Layoutsystem fuer den gesamten Live-Modus. |
| **Designsystem** | Globale Tokens wie `--app-live-channel-max-width` und `--app-live-channel-inline` existieren. Es fehlt jedoch ein explizites mobiles Host-Spacing-/Shell-System. |

---

## Nicht-Ziele

- Keine neue Rolle, keine neue Route, kein Backend-Sondermodus fuer Mobile
- Keine komplette Desktop-Neugestaltung
- Keine fachlichen Aenderungen an Session-Status, Kanaelen oder Rechten
- Keine kosmetische Einzelkorrektur pro View ohne gemeinsames mobiles IA-System

---

## Leitprinzipien fuer die Umsetzung

1. **Mobile reduziert Gleichzeitigkeit, nicht Faehigkeit.**
2. **Scrollbarkeit vor visueller Fixierung.**
3. **Primaeraktionen zuerst, Sekundaeraktionen spaeter oder kompakter.**
4. **Einspaltige Haupthierarchie fuer alle Host-Kanaele.**
5. **Desktop bleibt Standard fuer Projektionsfaelle, Mobile bekommt eigene IA unter Breakpoints.**

---

## Betroffene Dateien

### Primaer

- `apps/frontend/src/app/features/session/session-host/session-host.component.html`
- `apps/frontend/src/app/features/session/session-host/session-host.component.scss`
- `apps/frontend/src/app/features/feedback/feedback-host.component.html`
- `apps/frontend/src/app/features/feedback/feedback-host.component.scss`
- `apps/frontend/src/app/features/session/session-vote/session-vote.component.html`
- `apps/frontend/src/app/features/session/session-vote/session-vote.component.scss`
- `apps/frontend/src/app/features/session/session-present/session-present.component.html`
- `apps/frontend/src/app/features/session/session-present/session-present.component.scss`
- `apps/frontend/src/styles.scss`

### Sekundaer / optional

- `apps/frontend/src/app/features/session/session-host/session-host.component.spec.ts`
- `apps/frontend/src/app/features/feedback/feedback-host.component.spec.ts`
- `apps/frontend/src/app/features/session/session-vote/session-vote.component.spec.ts`
- Playwright-/E2E-Tests fuer mobile Sessions, falls vorhanden oder neu angelegt

---

## Implementierungsstrategie

Die Umsetzung erfolgt in **6 Phasen**. Jede Phase soll fuer sich testbar und rueckbaubar bleiben.

---

## Phase 1: Gemeinsames mobiles Host-Shell-System

Ziel: eine belastbare gemeinsame Grundlage fuer alle Live-Views schaffen.

### Aufgaben

| # | Task | Beschreibung | Datei |
|---|------|--------------|-------|
| 1.1 | **Mobile Host-Tokens definieren** | Neue CSS-Variablen fuer Smartphone-Hosting einfuehren, z. B. `--host-mobile-inline`, `--host-mobile-stack-gap`, `--host-mobile-card-padding`, `--host-mobile-toolbar-gap`, `--host-mobile-safe-bottom`. | `apps/frontend/src/styles.scss` oder `session-host.component.scss` |
| 1.2 | **Einheitliche Mobile-Shell ableiten** | Bestehende Live-Container (`app-live-channel-shell`, `session-host__channel-panel`, `feedback-host`, `vote-page`, `session-present`) unter Mobile-Breakpoints auf ein konsistentes einspaltiges Layout mappen. | mehrere SCSS-Dateien |
| 1.3 | **Scrollmodell festlegen** | Hauptscrollcontainer und Kanalcontainer so vereinheitlichen, dass keine konkurrierenden Hoehen-/Overflow-Konstruktionen mehr entstehen. | `session-host.component.scss`, `feedback-host.component.scss`, `session-vote.component.scss` |
| 1.4 | **Safe-Area absichern** | `env(safe-area-inset-bottom)` und mobile Bottom-Paddings fuer iOS/Android sauber integrieren. | `styles.scss`, relevante Komponenten-SCSS |

### Ergebnis

- konsistenter mobiler vertikaler Rhythmus
- keine zufaelligen Einzelabstaende pro Kanal
- stabile Grundlage fuer die Folgephasen

---

## Phase 2: Top-Zone der Host-Ansicht neu balancieren

Ziel: Tabs, Banner und Controls als kompakte mobile Steuerzone umsetzen.

### Aufgaben

| # | Task | Beschreibung | Datei |
|---|------|--------------|-------|
| 2.1 | **Tabs mobil vereinfachen** | `session-channel-tabs-shell` fuer Smartphone kompakter, stabiler und klar fingerbedienbar machen; ggf. `sticky` statt komplexer `fixed`-Kombinationen. | `session-host.component.scss` |
| 2.2 | **Live-Banner neu priorisieren** | `session-host__live-banner` mobil auf Session-Code, Status, Teilnehmerzahl und wichtigste Aktion fokussieren; visuelle Sekundaerelemente reduzieren. | `session-host.component.html/.scss` |
| 2.3 | **Join-/Sound-/Zusatzaktionen verdichten** | Sekundaeraktionen in kompaktere Icon-/Menuelogik verschieben oder optisch nachrangig staffeln. | `session-host.component.html/.scss` |
| 2.4 | **Offset-Logik entschlacken** | Mobile `padding-top`, `min-height` und `dvh`-/Offset-Regeln fuer `session-host__run` und `session-host__channel-panel` systematisch vereinfachen. | `session-host.component.scss` |
| 2.5 | **Kanalwechsel stabilisieren** | Sicherstellen, dass Wechsel zwischen `quiz`, `qa` und `quickFeedback` auf Smartphone keine sichtbaren Spruenge, Versaetze oder Layout-Drifts erzeugen. | `session-host.component.scss`, ggf. untergeordnete SCSS |

### Ergebnis

- obere Zone bleibt sichtbar, aber verbraucht weniger Raum
- bessere Erstbedienung auf Smartphone
- weniger Ueberlagerungen und Scrollkonflikte

---

## Phase 3: Quiz- und Q&A-Host mobil priorisieren

Ziel: die wichtigsten produktiven Steuerwege fuer Quiz und Q&A fingerfreundlich und lesbar machen.

### Aufgaben

| # | Task | Beschreibung | Datei |
|---|------|--------------|-------|
| 3.1 | **Quiz-Steuerfokus schaerfen** | Primaraktion im Quiz-Host mobil klar hervorheben; Folgeaktionen nicht als dichte Werkzeugreihe im Erstbereich. | `session-host.component.html/.scss` |
| 3.2 | **Meta- und Statusbereiche staffeln** | Status, Fragetext, Countdown/Phase und Zusatzinfos vertikal klarer staffeln. | `session-host.component.scss` |
| 3.3 | **Q&A-Karte mobil umbauen** | `session-channel-card--qa`, `session-qa-summary`, `session-qa-card`, Aktionsbuttons und Stimmenanzeige fuer einspaltige Smartphone-Nutzung optimieren. | `session-host.component.html/.scss` |
| 3.4 | **Moderationsaktionen vergroessern** | Touch-Ziele vergroessern, Button-Wrap und Abstaende verbessern, damit Moderation mit dem Daumen verlaesslich bleibt. | `session-host.component.scss` |
| 3.5 | **Markdown-/Textlesbarkeit absichern** | Textbloecke, Fragen und laengere Inhalte in Q&A mobil mit ruhiger Typografie und ausreichender Zeilenhoehe darstellen. | `session-host.component.scss` |

### Ergebnis

- Quiz-Steuerung ist auf Smartphone stressarm bedienbar
- Q&A bleibt moderierbar, ohne wie eine gequetschte Desktop-Liste zu wirken

---

## Phase 4: Blitzlicht-Host und Blitzlicht-Vote mobil neu strukturieren

Ziel: Blitzlicht als Kernmodus fuer Smartphone besonders stark machen.

### Aufgaben

| # | Task | Beschreibung | Datei |
|---|------|--------------|-------|
| 4.1 | **Blitzlicht-Aktionszonen staffeln** | `feedback-host__actions` mobil als klares Grid/Stack statt als dichte Buttonwolke organisieren. | `feedback-host.component.scss` |
| 4.2 | **Template-Auswahl mobil beruhigen** | `feedback-host__template-switch` fuer kleine Breiten auf 1 oder 2 Spalten begrenzen; Karten/Buttons harmonisieren. | `feedback-host.component.scss` |
| 4.3 | **Resultate mobil lesbar machen** | `feedback-host__bars`, Labels, Counts und Tracks so umbauen, dass keine visuelle Kollision bei engen Screens entsteht. | `feedback-host.component.scss` |
| 4.4 | **Vergleichsrunden vertikalisieren** | `feedback-host__comparison*` fuer Smartphone staerker untereinander staffeln, statt Informationen horizontal zu verdichten. | `feedback-host.component.scss` |
| 4.5 | **Vote-Banner angleichen** | `vote-live-banner` und `app-feedback-vote` an dasselbe mobile Shell-System anbinden wie die Host-Ansicht. | `session-vote.component.scss`, `feedback-vote.component.scss` falls noetig |
| 4.6 | **Floating-Countdown pruefen** | `vote-countdown-floating` mobil auf Kollisionen mit Tabs/Banner pruefen und ggf. neu positionieren oder vereinfachen. | `session-vote.component.scss` |

### Ergebnis

- Blitzlicht wirkt mobil wie ein nativer Kernmodus
- besonders fuer spontane Live-Settings ohne Desktop entsteht hier ein sichtbarer USP

---

## Phase 5: Present-/Ergebnisansichten mobil konsolidieren

Ziel: Ergebnisse und Praesentationskarten auf Smartphone ruhig und vollstaendig lesbar machen.

### Aufgaben

| # | Task | Beschreibung | Datei |
|---|------|--------------|-------|
| 5.1 | **Feedback-/Q&A-Karten vereinheitlichen** | `session-present__qa-card`, `session-present__feedback-card` und zugehoerige Reihen/Metadaten auf das gemeinsame mobile Spacing-System umstellen. | `session-present.component.scss` |
| 5.2 | **Ergebnisbalken mobil staffeln** | `session-present__feedback-row*` und zugehoerige Werte so anordnen, dass Zahlen und Balken nicht gequetscht wirken. | `session-present.component.scss` |
| 5.3 | **Leaderboard/Team-Finale mobil pruefen** | `session-present--team-finale`, `session-present__team-board*`, `session-host__leaderboard*` auf mobile Lesbarkeit und Scrollbarkeit angleichen. | `session-present.component.scss`, `session-host.component.scss` |
| 5.4 | **Word-Cloud-Rahmung beachten** | vorhandene oder kommende Freitext-/Word-Cloud-Bloecke in die mobile Seitenrhythmik einordnen, auch wenn die eigentliche Word-Cloud separat entwickelt wird. | `session-host.component.scss`, `session-present.component.scss` |

### Ergebnis

- Ergebnisansichten bleiben auf Smartphone vertrauenswuerdig und praesentabel
- keine “Desktop-Miniatur” im Abschlussflow

---

## Phase 6: Verifikation, Tests und Abnahmekatalog

Ziel: Story 2.8 nicht nur bauen, sondern belastbar freigeben.

### Technische Checks

| # | Task | Beschreibung |
|---|------|--------------|
| 6.1 | **Frontend-Checks** | `npm run typecheck`, relevante Vitest-Suites, ggf. Lint fuer geaenderte Dateien. |
| 6.2 | **Komponententests erweitern** | Bestehende Specs dort ergaenzen, wo mobile Layout-States, Klassen oder reduzierte Informationshierarchien testbar sind. |
| 6.3 | **E2E mobil vorbereiten** | Wenn praktikabel: Playwright-Szenarien mit Smartphone-Viewport fuer Kernfluesse einziehen. |

### Manuelle Abnahme auf realen Smartphones

Mindestens folgende Szenarien muessen einmal produktnah durchgespielt werden:

1. Quiz-Session auf Smartphone starten
2. Mehrere Fragen nacheinander steuern
3. Zwischen Quiz, Q&A und Blitzlicht wechseln
4. Blitzlicht starten, zuruecksetzen, zweite Runde starten, beenden
5. Q&A moderieren
6. Ergebnis-/Leaderboard-Ansicht lesen
7. Session auf Smartphone beenden

### Abnahmekriterien

- keine unbeabsichtigte horizontale Scrollbarkeit ab `320px`
- alle Primaeraktionen per Daumen sicher erreichbar
- keine abgeschnittenen Controls
- keine ueberlagerten Banner/Tabs/Widgets
- ruhige Kanalwechsel ohne sichtbaren Versatz
- visuell ausgewogene Abstaende zwischen Widgets
- Desktop-/Beamer-Nutzung weiterhin intakt

---

## Empfohlene Umsetzungsreihenfolge

1. **Phase 1** Mobile Host-Shell-System
2. **Phase 2** Top-Zone / Tabs / Banner / Offsets
3. **Phase 3** Quiz + Q&A
4. **Phase 4** Blitzlicht Host + Vote
5. **Phase 5** Present + Ergebnisse
6. **Phase 6** Tests + echte Smartphone-Abnahme

Diese Reihenfolge minimiert Rework, weil zuerst das gemeinsame Layoutfundament entsteht und erst danach die kanalindividuellen Feinheiten angepasst werden.

---

## Risiken und Gegenmassnahmen

| Risiko | Auswirkung | Gegenmassnahme |
|--------|------------|----------------|
| Mobile Fixes brechen Desktop | regressiver Eindruck auf Beamer/Laptop | Mobile-Aenderungen strikt unter `@media` und mit kurzen manuellen Desktop-Gegenchecks pro Phase |
| Zu viele punktuelle Ausnahmen | schwer wartbares CSS | zuerst gemeinsame Tokens/Shell, erst dann kanalindividuelle Regeln |
| Mobile wird “zu leer” | Verlust von wahrgenommener Power | Primaer-/Sekundaerlogik bewusst definieren, nichts fachlich entfernen |
| Scroll-Probleme auf iOS | abgeschnittene Inhalte / unruhiger Viewport | Safe-Areas, weniger verschachtelte `dvh`-Logik, reale Geraetetests |
| Blitzlicht/Q&A driften stilistisch auseinander | uneinheitliche Host-UX | gemeinsames mobiles IA-System und Referenzspacing fuer alle Kanaele |

---

## Kurz: konkrete erste Arbeitspakete

Wenn die Umsetzung direkt startet, sollten diese Pakete zuerst bearbeitet werden:

1. `session-host.component.scss`
   - mobile Top-Zone
   - Tabs/Banner/Offsets
   - Kanalpanel-Scrollmodell
2. `styles.scss`
   - gemeinsame mobile Host-Tokens
3. `feedback-host.component.scss`
   - Aktionslayout, Template-Grid, Vergleichsansicht
4. `session-vote.component.scss`
   - Vote-Banner, Floating-Countdown, mobile Kanalraender
5. `session-present.component.scss`
   - Ergebnis-/Feedback-/Teamkarten

---

## Konkreter Umsetzungsschnitt fuer Phase 1 und 2

Der folgende Zuschnitt ist bewusst so klein gehalten, dass er in wenigen zusammenhaengenden PRs oder Baby-Steps umgesetzt werden kann, ohne sofort alle Kanaele gleichzeitig umzubauen.

### Paket A: Mobile Host-Tokens und gemeinsame Shell

**Ziel:** ein minimales gemeinsames mobiles Fundament schaffen, bevor Einzelviews angepasst werden.

**Dateien:**

- `apps/frontend/src/styles.scss`
- `apps/frontend/src/app/features/session/session-host/session-host.component.scss`

**Konkrete Tasks:**

| # | Task | Konkreter Eingriff |
|---|------|--------------------|
| A.1 | **Mobile Tokens einfuehren** | In `styles.scss` neue Variablen fuer Smartphone-Hosting anlegen, z. B. `--host-mobile-inline`, `--host-mobile-stack-gap`, `--host-mobile-card-padding`, `--host-mobile-safe-bottom`. |
| A.2 | **`app-live-channel-shell` mobil schaerfen** | Unter Mobile-Breakpoints Breiten, `padding-inline` und `box-sizing` so vereinheitlichen, dass alle Live-Container dieselbe horizontale Logik nutzen. |
| A.3 | **Kanalpanel als Basisshell definieren** | In `session-host.component.scss` fuer `.session-host__channel-panel` und `.session-host__channel-panel--feedback` ein mobiles Standardverhalten festlegen: einspaltig, klare Abstaende, keine widerspruechlichen Zusatzhoehen. |
| A.4 | **Bottom Safe Area integrieren** | Gemeinsames `padding-bottom` mit `env(safe-area-inset-bottom)` fuer mobile Host-Bereiche einziehen. |

**Selektoren mit Prioritaet:**

- `.app-live-channel-shell`
- `.session-host__channel-panel`
- `.session-host__channel-panel--feedback`
- `.session-host__run`

**Definition of Ready fuer Paket B:**

- alle Host-Kanaele benutzen auf Smartphone dieselbe Grundbreite
- keine zufaelligen seitlichen Unterschiede zwischen Quiz, Q&A und Blitzlicht
- kein abgeschnittener unterer Bereich durch fehlende Safe-Area-Abstaende

### Paket B: Top-Zone von `session-host` entschlacken

**Ziel:** Tabs, Banner und Controls auf Smartphone von einer Desktop-Miniatur in eine mobile Steuerzone ueberfuehren.

**Dateien:**

- `apps/frontend/src/app/features/session/session-host/session-host.component.html`
- `apps/frontend/src/app/features/session/session-host/session-host.component.scss`

**Konkrete Tasks:**

| # | Task | Konkreter Eingriff |
|---|------|--------------------|
| B.1 | **Tabs mobil neu einfassen** | `.session-channel-tabs-shell` und `.session-channel-tabs` fuer `max-width: 599px` kompakter machen; Touch-Ziele beibehalten, aber visuelle Dichte reduzieren. |
| B.2 | **Banner von Offset-Fixierung loesen** | Regeln fuer `.session-host--with-channel-tabs .session-host__live-banner` und die zugehoerigen `--session-host-*` Offsets mobil vereinfachen; Ziel ist weniger starre vertikale Stapelung. |
| B.3 | **Run-/Panel-Top-Padding entkoppeln** | `.session-host--with-channel-tabs .session-host__run` und `.session-host--with-channel-tabs .session-host__channel-panel` mobil so anpassen, dass der Inhalt nicht kuenstlich nach unten geschoben wird. |
| B.4 | **Feedback-Sonderfall bereinigen** | `.session-host--with-live-banner.session-host--with-channel-tabs .session-host__channel-panel--feedback` mobil auf dasselbe Top-/Height-Verhalten wie die anderen Kanaele ziehen, soweit fachlich moeglich. |
| B.5 | **View-Controls beruhigen** | `.session-host__view-controls` und `.session-host__view-toggle` fuer Smartphone so staffeln, dass sie nicht gegen Tabs/Banner arbeiten. |

**Selektoren mit Prioritaet:**

- `.session-host--with-channel-tabs`
- `.session-host--with-live-banner`
- `.session-host__live-banner`
- `.session-channel-tabs-shell`
- `.session-host__view-controls`

**Akzeptanzprobe nach Paket B:**

1. laufende Session auf Smartphone oeffnen
2. Tabs sichtbar und bedienbar
3. Banner sichtbar, aber nicht dominant
4. erster Inhalt ohne uebermaessige Leerflaeche erreichbar
5. keine Ueberlagerung von Tabs, Banner und Controls

### Paket C: Mobile Scrolllogik vor Kanalumbauten stabilisieren

**Ziel:** erst Scroll und Hoehen beruhigen, dann Q&A/Blitzlicht im Detail umbauen.

**Dateien:**

- `apps/frontend/src/app/features/session/session-host/session-host.component.scss`
- `apps/frontend/src/app/features/feedback/feedback-host.component.scss`
- `apps/frontend/src/app/features/session/session-vote/session-vote.component.scss`

**Konkrete Tasks:**

| # | Task | Konkreter Eingriff |
|---|------|--------------------|
| C.1 | **`min-height`-Ketten reduzieren** | Mobile `min-height: calc(100dvh - ...)` nur dort belassen, wo sie wirklich noetig sind; bevorzugt natuerlichen Dokumentfluss herstellen. |
| C.2 | **Verschachtelte Flex-Hoehen pruefen** | `display: flex`-Container im Feedback-/Vote-Bereich so anpassen, dass Child-Container nicht versehentlich scrollen oder seitlich driften. |
| C.3 | **Floating-Elemente pruefen** | `vote-countdown-floating` und vergleichbare Overlays auf Kollision mit Tabs/Banner testen und mobil ggf. neu positionieren. |

**Definition of Done fuer Phase 1 und 2 gesamt:**

- gleiche mobile Shell fuer alle Host-Kanaele
- kompakte obere Steuerzone
- keine sichtbaren Layoutspruenge beim Kanalwechsel
- natuerliche vertikale Scrollbarkeit
- Desktop unveraendert nutzbar

### Empfohlene Commit-Schnitte

1. **Commit 1:** Mobile Tokens + gemeinsame Shell (`styles.scss`, `session-host.component.scss`)
2. **Commit 2:** Top-Zone / Tabs / Banner / Offsets (`session-host.component.html/.scss`)
3. **Commit 3:** Scrolllogik / Feedback-/Vote-Anpassungen als Vorbereitung fuer Phase 3/4

So bleiben Rueckbau, Review und visuelle Gegenpruefung deutlich einfacher.

---

## Abschluss (2026-03-13)

Story 2.8 wurde ueber mehrere Iterationen umgesetzt. Statt punktueller CSS-Korrekturen wurde ein **Vier-Zonen-Layout** als gemeinsame Informationsarchitektur etabliert:

1. **Top-Toolbar** (Logo, Preset, Theme)
2. **Session-Channel-Tabs** (Quiz, Q&A, Blitzlicht)
3. **Live-Channel-Shell** (QR, Session-Code, Musik)
4. **Channel-Panel** (Kanalinhalt)

Alle `fixed`-Elemente in `session-host` wurden entfernt; Tabs und Banner sind statisch im Dokumentfluss. Mobile Host-Tokens, Q&A-Stabilisierung, Blitzlicht-Alignment (embedded/standalone) und 2-Button-Zentrierung (Ja/Nein) sind umgesetzt. Der Fullscreen-Button wird auf Smartphone (inkl. Landscape) ausgeblendet.

---

## Referenzen

- `docs/architecture/decisions/0014-mobile-first-information-architecture-for-host-views.md`
- `Backlog.md` Story `2.8`
- `apps/frontend/src/app/features/session/session-host/session-host.component.html`
- `apps/frontend/src/app/features/session/session-host/session-host.component.scss`
- `apps/frontend/src/app/features/feedback/feedback-host.component.html`
- `apps/frontend/src/app/features/feedback/feedback-host.component.scss`
- `apps/frontend/src/app/features/session/session-vote/session-vote.component.html`
- `apps/frontend/src/app/features/session/session-vote/session-vote.component.scss`
- `apps/frontend/src/app/features/session/session-present/session-present.component.html`
- `apps/frontend/src/app/features/session/session-present/session-present.component.scss`
