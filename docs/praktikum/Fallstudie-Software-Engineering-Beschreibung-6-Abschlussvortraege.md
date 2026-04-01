<!-- markdownlint-disable MD013 MD022 MD032 -->

# Fallstudie Software Engineering — Beschreibung der sechs Abschlussvorträge

**Kontext:** Fallstudie **arsnova.eu** · **Zielgruppe:** Studierende nach dem Bearbeiten der **didaktischen 13-Ticket-Reihenfolge** (siehe [`STUDENT-STORY-REIHENFOLGE.md`](./STUDENT-STORY-REIHENFOLGE.md))  
**Zweck:** Orientierung für **Inhalt und Abgrenzung** der Prüfungsleistung — nicht Ersatz für Betreuungsvorgaben der Lehrveranstaltung.

---

## 1. Einleitung: Vortrag, Handout und Zusammenspiel der sechs Themen

### 1.1 Was ihr vorlegt

**Ablauf:** Es sind **sechs getrennte Einzeltermine** — **je Thema ein eigener Termin**, **je Termin genau eine vortragende Person**. Es gibt **keinen** gemeinsamen Gruppenvortrag in einem einzigen Zeitfenster.

| Bestandteil                 | Typische Ausgestaltung                                                                                                                                                                                          |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Unterrichtseinheit (UE)** | **45 Minuten** pro Termin — das ist **eine** klassische UE für **einen** Abschlussvortrag inklusive Nachbesprechung.                                                                                            |
| **Einzelvortrag**           | In der Regel **ca. 20 Minuten** reiner Vortrag durch **die eine** zum Thema zugewiesene Person.                                                                                                                 |
| **Diskussion und Feedback** | Der **Rest der 45 Minuten** (rund **25 Minuten**) für Fragen, Diskussion und Rückmeldung mit der Betreuung und der Gruppe — Umfang nach Vorgabe der **Betreuung**.                                              |
| **Handout**                 | **Eine** DIN-A4-Seite **oder** ein DIN-A3-Blatt — Umfang und Form legt die Veranstaltung fest; inhaltlich weiterhin **sechs gleichwertige Teile** (je Person ein Abschnitt), die zusammen das Projekt abbilden. |

**Rechnung über alle Themen:** **6 × 45 Minuten** = **sechs Unterrichtseinheiten** für die gesamte Reihe der Abschlussvorträge (Thema 1 bis Thema 6).

**Ein Thema, eine Person:** Jedes der **sechs Themen** wird **nur von einer Person** bearbeitet — Recherche, Struktur, **Einzelvortrag** und zugehöriger Abschnitt im Handout liegen **ausschließlich** bei dieser Person. **Keine** geteilten Themen und **keine** Doppelbesetzung.

### 1.2 Was das Handout leisten soll

- **Ein gemeinsames Bild:** Die **sechs Teile** (je Thema eine Person) ergeben **zusammen** die Fallstudie **arsnova.eu** aus **softwaretechnischer** Sicht — ohne Lücken und ohne große Überschneidungen.
- **Gleiche Wertschätzung:** Sechs **gleich große** inhaltliche Bereiche (auf einem A3 z. B. **Raster 3×2** oder **2×3**; auf A4 **eng gesetzt** oder bewusst kürzer pro Feld).
- **Kein Story-Katalog:** Das Handout **ersetzt keine** Aufzählung der 13 Tickets; es zeigt **Architektur, Stack und Entwicklungsprozess**, nicht „was wir in Story X gemacht haben“.

### 1.3 Vortrag und Handout: dieselbe Logik

Im **Einzelvortrag** wie auf dem Handout gilt: **Pro Thema ein klarer Block** — (a) **welche Bausteine des Stacks** ihr ansprecht, (b) **welches Architekturmuster** ihr damit verbindet, (c) **wie der KI-gestützte Ablauf** in diesem Bereich aussieht und **wo Menschen** prüfen müssen. Was zu einem Thema **nicht** gehört, steht unten bei jedem Thema explizit — damit sich die **sechs Vortragenden** inhaltlich nicht überschneiden.

---

## 2. Überdeckung des Projekts (alle sechs Themen zusammen)

Gemeinsam sollen die sechs Themen mindestens abdecken:

| Schicht                                         | Abgedeckt durch |
| ----------------------------------------------- | --------------- |
| Typisierte API und gemeinsame Verträge          | Thema 1         |
| Monorepo-Struktur und Zuschnitt der Apps        | Thema 2         |
| Sicherheit und Datenminimierung am Backend      | Thema 3         |
| Frontend-Technologie und UI-/i18n-Regeln        | Thema 4         |
| Persistenz, Infrastruktur, Laufzeitverhalten    | Thema 5         |
| Qualitätssicherung, CI und KI im Arbeitsprozess | Thema 6         |

---

## Thema 1 — Typisierte Schnittstellen: Zod, `shared-types`, tRPC

**Verantwortliche Person:** genau **eine** fest zugewiesene Person — **nur sie** bearbeitet das Thema und **nur sie** hält dazu den **Einzelvortrag** (in der zugehörigen **45-Minuten-UE**).

### Was dieses Thema umfasst

- **`libs/shared-types`:** Zod-Schemas als **einzige** verbindliche Beschreibung der tRPC-Ein- und -Ausgaben.
- **tRPC:** Prozeduren als durchgängige API; **kein** paralleles REST-Modell in der Fallstudie.
- **Architekturmuster:** **Schema-first** — Änderungen an Schnittstellen beginnen am Schema, nicht am zufälligen JSON.
- **KI-gestützter Prozess:** z. B. Vorschläge für Schema und Prozedur-Skelette; **menschliche** Pflicht: Abgleich mit bestehenden Routern, Edge Cases, `Backlog`-Akzeptanzkriterien und laufende **Typprüfung**.

### Was dieses Thema bewusst nicht umfasst

- **Konkrete Domänenlogik** einzelner Features (Q&A, Sync, …) — nur soweit sie **Beispiele** für Verträge sind.
- **UI-Komponenten** und **CSS** — gehören zu Thema 4.
- **Datenbankschema und Migrationen** im Detail — gehören zu Thema 5.
- **Deployment** und Serverbetrieb.

---

## Thema 2 — Monorepo: Workspaces, `apps/*`, `libs`, Abhängigkeiten

**Verantwortliche Person:** genau **eine** fest zugewiesene Person — **nur sie** bearbeitet das Thema und **nur sie** hält dazu den **Einzelvortrag** (in der zugehörigen **45-Minuten-UE**).

### Was dieses Thema umfasst

- **npm Workspaces:** ein Repo, mehrere Pakete; sinnvolle **Grenzen** zwischen `apps/frontend`, `apps/backend` und `libs/shared-types` (bzw. weitere `libs`, falls genutzt).
- **Architekturmuster:** klare **Importrichtungen**; Änderungen **paketweise** nachvollziehbar; PRs, die nicht „alles auf einmal“ vermischen.
- **KI-gestützter Prozess:** KI erzeugt oft **querliegende** Änderungen — eure Erfahrung: **Diffs pro Paket** lesen, Zyklen und falsche Abhängigkeiten erkennen; kleine Schritte, **CI grün** halten.

### Was dieses Thema bewusst nicht umfasst

- **Inhalt** der Zod-Schemas — Kern von **Thema 1**; hier nur **Struktur und Ordnung** der Pakete.
- **Sicherheitslogik** von DTOs — **Thema 3**.
- **Detaillierte** CI-Job-Definition — **Thema 6** (hier nur: „Monorepo beeinflusst, wie wir bauen und testen“).

---

## Thema 3 — Sicherheit und Schutz sensibler Daten: DTO, Stripping, Berechtigung

**Verantwortliche Person:** genau **eine** fest zugewiesene Person — **nur sie** bearbeitet das Thema und **nur sie** hält dazu den **Einzelvortrag** (in der zugehörigen **45-Minuten-UE**).

### Was dieses Thema umfasst

- **Pattern:** **Data-Stripping** / **DTO** — dem Client nur geben, was für die Rolle und den Kontext erlaubt ist; **keine** Geheimnisse im Browser.
- **Backend-Rolle:** tRPC-Prozeduren mit **klarer Berechtigung** (z. B. Host-only); Session- und Rollenkontext **serverseitig**.
- **KI-gestützter Prozess:** KI neigt zu **vollständigen Objekten** oder vereinfachtem Zugriff — **Review** sensibler Stellen bleibt menschlich; KI eher für **Checklisten** und strukturiertes Lesen von Diffs, nicht für blindes Vertrauen.

### Was dieses Thema bewusst nicht umfasst

- **Vollständiges** Bedrohungsmodell oder Penetrationstests — nur **projektrelevante** Prinzipien.
- **Angular-spezifische** Patterns — **Thema 4**.
- **Redis/WebSocket-Implementierungsdetails** — Kurzverweis möglich, Tiefe bei **Thema 5**.

---

## Thema 4 — Frontend: Angular, Signals, Material 3, i18n

**Verantwortliche Person:** genau **eine** fest zugewiesene Person — **nur sie** bearbeitet das Thema und **nur sie** hält dazu den **Einzelvortrag** (in der zugehörigen **45-Minuten-UE**).

### Was dieses Thema umfasst

- **Stack:** Angular (Standalone Components, **Signals**), Angular Material 3; UI nach Projektregeln (`@if` / `@for`, kein **RxJS** für reinen UI-State in der Fallstudie).
- **Pattern:** **ADR-0008** — neue oder geänderte **sichtbare** UI-Texte in **fünf** Sprachen; keine „nur Deutsch“-Abkürzung in der Abgabe.
- **KI-gestützter Prozess:** Risiko **veralteter oder fremder** Angular-Muster; Abgleich mit **Projektregeln** und Styleguide; Generierung → **Review** → Tests/manuelle Checks.

### Was dieses Thema bewusst nicht umfasst

- **Backend-Implementierung** von tRPC — **Thema 1** (Vertrag) und **Thema 3** (Berechtigung) grenzen ein, **ohne** Router-Code hier im Detail vorzutragen.
- **Vitest/CI** — **Thema 6** (außer dem Satz: Frontend hat `*.spec.ts` neben dem Code).

---

## Thema 5 — Persistenz und Laufzeit: Prisma, Redis, Backend-Realität

**Verantwortliche Person:** genau **eine** fest zugewiesene Person — **nur sie** bearbeitet das Thema und **nur sie** hält dazu den **Einzelvortrag** (in der zugehörigen **45-Minuten-UE**).

### Was dieses Thema umfasst

- **Prisma:** Schema, Migrationen als **verbindliche** Spur der Datenstruktur; Zusammenhang mit dem, was **über tRPC** exponiert wird (nicht alles Modell ist für den Client gedacht — siehe **Thema 3**).
- **Redis** und Realtime: **kurz** und **sachlich** — wofür die Infrastruktur da ist, nicht jede Zeile Code.
- **Architekturmuster:** Daten- und Laufzeitverhalten **gemeinsam** denken; Performance- und Korrektheitsfragen nicht nur im Frontend lösen wollen.
- **KI-gestützter Prozess:** Hilfreich bei **lokalen** Funktionen; **schwach** bei globalem Nebenwirkungsbild — Absicherung durch **Tests**, lokales Laufen, CI.

### Was dieses Thema bewusst nicht umfasst

- **Vollständige** Wiederholung von **Thema 1** (Zod) — nur der **Bezug** „was persistiert wird vs. was im Vertrag steht“.
- **Deployment-Produktion** (siehe separates Deployment-Dokument, falls Thema in der Veranstaltung).

---

## Thema 6 — Qualität, CI und KI im Entwicklungsprozess

**Verantwortliche Person:** genau **eine** fest zugewiesene Person — **nur sie** bearbeitet das Thema und **nur sie** hält dazu den **Einzelvortrag** (in der zugehörigen **45-Minuten-UE**).

### Was dieses Thema umfasst

- **Stack:** Vitest (Frontend/Backend), GitHub Actions / CI wie im Repo; **`npm test`**, typische Pipeline-Schritte **auf Projektebene**.
- **Pattern:** **Definition of Done** und Erwartungen aus `Backlog.md` / `CONTRIBUTING.md`; wiederkehrender Ablauf **Spezifikation → Schema → Code → Tests** (vgl. [`AGENT.md`](../../AGENT.md)).
- **KI-gestützter Prozess:** KI als **Werkzeug in der Kette** — wo sie Zeit spart (Skizzen, Refactors, Testideen), wo **Nacharbeit** nötig ist (falsche Annahmen, fehlende Übersetzungen, instabile Tests); **Reflexion** als Teil der Fallstudie.

### Was dieses Thema bewusst nicht umfasst

- **Erneute** vollständige Auflistung aller **Architektur-Patterns** aus Thema 1–5 — hier **Querschnitt** und **Prozess**, keine Dublette.
- **Einzelstory-Abnahmen** — nur als **Beispiele**, wenn sie den **Prozess** illustrieren.

---

## 3. Kurz-Checkliste vor der Abgabe

- [ ] Sechs Personen, **je ein Thema**, ohne Doppelungen — **nur eine Person** pro Thema (Erarbeitung **und** Einzelvortrag).
- [ ] **Sechs Termine** à **45 Minuten** (je **eine UE**): **ca. 20 Min.** Vortrag + **Diskussion und Feedback** im restlichen Zeitfenster — mit **Betreuung** abstimmen.
- [ ] Handout: **sechs gleichwertige Felder**, zusammen **vollständiges** softwaretechnisches Bild von arsnova.eu.
- [ ] Pro Thema klar: **Stack + Muster + KI-Prozess**; **Abgrenzung** beachtet (siehe „bewusst nicht umfasst“).
- [ ] Kein Ersatz für die **Betreuungsvorgaben** der konkreten Prüfung — bei Widerspruch gilt die **Veranstaltung**.

---

_Stand: 2026-04-01 · Datei: `Fallstudie-Software-Engineering-Beschreibung-6-Abschlussvortraege.md` · Bei Änderungen am Stack oder an Prüfungsformaten dieses Dokument und Verweise in [`docs/README.md`](../README.md) anpassen._
