<!-- markdownlint-disable MD013 MD022 MD032 -->

# Softwarequalitätsmanagement — Beschreibung der vier Referate (Fallstudie arsnova.eu)

**Kontext:** Kurs **Softwarequalitätsmanagement** am Projekt **arsnova.eu** · **Zielgruppe:** Studierende nach dem Bearbeiten der **didaktischen 13-Ticket-Reihenfolge** in Verbindung mit dem SQM-Praktikum (siehe [`STUDENT-STORY-REIHENFOLGE.md`](./STUDENT-STORY-REIHENFOLGE.md), [`PRAKTIKUM-SQM.md`](./PRAKTIKUM-SQM.md))  
**Zweck:** Orientierung für **Inhalt und Abgrenzung** der Referate — nicht Ersatz für Betreuungsvorgaben der Lehrveranstaltung.

---

## 1. Einleitung: Referat, Handout und schriftliche Ausarbeitung

### 1.1 Was ihr vorlegt

**Ablauf:** Es sind **vier getrennte Einzeltermine** — **je Thema ein eigener Termin**, **je Termin genau eine vortragende Person**. Es gibt **keinen** gemeinsamen Gruppenvortrag in einem einzigen Zeitfenster.

| Bestandteil                   | Typische Ausgestaltung                                                                                                                                                                                                                                                        |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Unterrichtseinheit (UE)**   | **45 Minuten** pro Termin — **eine** klassische UE für **ein** Referat inklusive Nachbesprechung.                                                                                                                                                                             |
| **Einzelreferat**             | In der Regel **ca. 20 Minuten** Vortrag durch **die eine** zum Thema zugewiesene Person.                                                                                                                                                                                      |
| **Diskussion und Feedback**   | Der **Rest der 45 Minuten** (rund **25 Minuten**) für Fragen, Diskussion und Rückmeldung — Umfang nach Vorgabe der **Betreuung**.                                                                                                                                             |
| **Handout**                   | **Eine** DIN-A4-Seite **oder** ein DIN-A3-Blatt; **vier gleichwertige** inhaltliche Bereiche (je Person ein Abschnitt), die zusammen die **Qualitätssicht** auf das Projekt abbilden.                                                                                         |
| **Schriftliche Ausarbeitung** | In der Regel **ca. 7–10 DIN-A4-Seiten**, erstellt mit **LaTeX** (Abgabe typischerweise als **PDF** plus **Quellen**, falls verlangt). Ob der Umfang **je Person** oder **für die Gruppe insgesamt** gilt, legt die **Betreuung** fest — bei Unklarheit **vor Abgabe** klären. |

**Rechnung über alle Themen:** **4 × 45 Minuten** = **vier Unterrichtseinheiten** für die gesamte Referatsreihe (Thema 1 bis Thema 4).

**Ein Thema, eine Person:** Jedes der **vier Themen** wird **nur von einer Person** bearbeitet — Recherche, **Einzelreferat**, Handout-Abschnitt und den **ihrem Thema zugeordneten Teil** der schriftlichen Ausarbeitung (soweit nicht eine **gemeinsame** Arbeit verlangt wird). **Keine** geteilten Themen und **keine** Doppelbesetzung.

### 1.2 Querschnitt statt Einzelticket

Die **vier Referatsthemen** sind **querschnittlich** angelegt: Sie greifen **über alle bearbeiteten Tickets hinweg** typische **Qualitätsfragen** auf — nicht „Story 5.4a“, sondern z. B. „Wie haben wir Tests **über Features hinweg** priorisiert?“. **Einzelstorys** dürfen **als Beispiele** vorkommen, **nicht** als Katalog der 13 Tickets.

### 1.3 Referat, Handout und schriftliche Arbeit: dieselbe Logik

**Pro Thema ein klarer Block:**

- **Qualitätsziele** und **messbare bzw. nachweisbare** Kriterien (was wollt ihr im Projekt abgesichert wissen?).
- **Vorgehen und Methoden** (Tests, Reviews, Messungen, Nutzertests …) **im Kontext arsnova.eu** (`docs/TESTING.md`, `Backlog.md` DoD, [`SECURITY-OVERVIEW.md`](../SECURITY-OVERVIEW.md), …).
- **Rolle von Werkzeugen und KI** (z. B. Testvorschläge, Review-Unterstützung) — **immer** mit **Verifikation** durch Menschen, CI oder reproduzierbare Nachweise.

Was zu einem Thema **nicht** gehört, steht bei jedem Thema unter **„bewusst nicht umfasst“**.

---

## 2. Überdeckung des Projekts (alle vier Themen zusammen)

Gemeinsam sollen die vier Themen die **Softwarequalität** der Fallstudie **arsnova.eu** aus **SQM-Sicht** abdecken — ergänzend zur technischen Entwicklungsfokussierung der FSE-Vorträge:

| Qualitätsdimension (SQM)                           | Abgedeckt durch |
| -------------------------------------------------- | --------------- |
| Testen, Automatisierung, CI                        | Thema 1         |
| Reviews, DoD, Qualität im PR-Prozess               | Thema 2         |
| Performance, Last, Sicherheit der Lieferkette      | Thema 3         |
| Nutzerqualität, Methodik, Inklusion, Dokumentation | Thema 4         |

---

## Thema 1 — Teststrategie, Automatisierung und CI

**Verantwortliche Person:** genau **eine** fest zugewiesene Person — **nur sie** bearbeitet das Thema und **nur sie** hält das **Einzelreferat** (in der zugehörigen **45-Minuten-UE**).

### Was dieses Thema umfasst

- **Testpyramide und Priorisierung:** Was wird **unit**-nah, was **integration**s- oder **router**-nah mit Vitest geprüft — **über** konkrete Features hinweg.
- **CI als Qualitätstor:** Rolle der Pipeline (z. B. [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml)), `npm test` — was muss **grün** sein, bevor ihr Qualität bejaht?
- **Referenz:** [`docs/TESTING.md`](../TESTING.md), DoD-Stellen im [`Backlog.md`](../../Backlog.md) zu Tests.
- **KI im SQM-Prozess:** z. B. Vorschläge für Testfälle oder Specs — **immer** gegen reales Verhalten und bestehende Konventionen prüfen.

### Was dieses Thema bewusst nicht umfasst

- **Detaillierte** Review-Kriterien ohne Testbezug — **Thema 2**.
- **Lighthouse/Last** als Messgröße — **Thema 3**.
- **Think-Aloud-Auswertung** — **Thema 4**.

---

## Thema 2 — Reviews, Definition of Done und Qualität im Pull Request

**Verantwortliche Person:** genau **eine** fest zugewiesene Person — **nur sie** bearbeitet das Thema und **nur sie** hält das **Einzelreferat** (in der zugehörigen **45-Minuten-UE**).

### Was dieses Thema umfasst

- **DoD:** Wo steht sie, wie wird sie im **PR** sichtbar — Verknüpfung mit [`Backlog.md`](../../Backlog.md), [`CONTRIBUTING.md`](../../CONTRIBUTING.md).
- **Review-Inhalte:** sachliche PR-Prüfung — u. a. Zod/tRPC-Konsistenz, DTO/Stripping, **kein** blindes „LGTM“; optional Review-Checklisten (z. B. [`docs/ui/PR-CHECKLIST-UI.md`](../ui/PR-CHECKLIST-UI.md) wo passend).
- **Prozess:** Wie organisiert ihr **Reviews** in der Gruppe, wer prüft was, wie geht ihr mit **KI-generierten** Diffs um?
- **KI im SQM-Prozess:** z. B. Diff-Zusammenfassung oder Checklisten — **kein** Ersatz für eigenes Lesen; spekulative Sicherheitshinweise **verifizieren**.

### Was dieses Thema bewusst nicht umfasst

- **Vollständige** Wiederholung der **Testautomatisierung** — **Thema 1** (Verweis reicht).
- **npm audit / Lighthouse** — **Thema 3**.

---

## Thema 3 — Messbare nicht-funktionale Qualität: Performance, Last, Sicherheit der Lieferkette

**Verantwortliche Person:** genau **eine** fest zugewiesene Person — **nur sie** bearbeitet das Thema und **nur sie** hält das **Einzelreferat** (in der zugehörigen **45-Minuten-UE**).

### Was dieses Thema umfasst

- **Performance und Profiling:** z. B. Lighthouse, Build-/Ladeaspekte, Mobile-First — **messbar** oder **nachvollziehbar** dokumentiert (Vorher/Nachher oder Routenvergleich).
- **Last und Skalierung:** Bezug zu Projekt-Vorgaben (z. B. Story **0.7**, ADR-0013) — **planerisch** oder **pilotiert**, je nachdem was ihr im Kurs umsetzen konntet.
- **Sicherheit der Lieferkette:** `npm audit`, Umgang mit **high/critical** im Sinne der Projektziele; **keine** öffentliche Detail-Diskussion von Exploits ohne Betreuung.
- **Referenz:** [`docs/SECURITY-OVERVIEW.md`](../SECURITY-OVERVIEW.md).
- **KI im SQM-Prozess:** z. B. Interpretation von Audit-Output — **gegen** offizielle Quellen und Team abgleichen.

### Was dieses Thema bewusst nicht umfasst

- **Vollständiges** Threat Modeling oder Pentesting — nur **projektrelevante** Maßnahmen.
- **Detaillierte** UX-Methodik — **Thema 4**.

---

## Thema 4 — Nutzer- und Nutzungsqualität: Methodik, Inklusion, Dokumentation

**Verantwortliche Person:** genau **eine** fest zugewiesene Person — **nur sie** bearbeitet das Thema und **nur sie** hält das **Einzelreferat** (in der zugehörigen **45-Minuten-UE**).

### Was dieses Thema umfasst

- **Qualitative Methoden:** z. B. **Think Aloud** — Planung, Durchführung, **anonymisierte** Auswertung, **konkrete** Verbesserungsfolgen (siehe auch Story **6.6** im Backlog als mögliche Schnittmenge).
- **Barrierefreiheit und wahrnehmbare Qualität:** z. B. Lighthouse A11y, Tastaturbedienung — **Querschnitt**, nicht ein einzelnes Pixel-Thema.
- **Nutzungsqualität mit KI-Readern** (falls im Praktikum bearbeitet): Testmatrix, Findings.
- **Nutzungsanleitung / Guidde** (falls umgesetzt): Zielgruppe, abgedeckte Flows.
- **DSGVO / Datensparsamkeit:** **Überblick** aus QM-Sicht, Verweis auf [`SECURITY-OVERVIEW.md`](../SECURITY-OVERVIEW.md) — **keine** Rechtsberatung.
- **KI im SQM-Prozess:** z. B. Entwurf von Aufgaben für Nutzertests — **Pilotierung** mit echten Testpersonen bleibt maßgeblich.

### Was dieses Thema bewusst nicht umfasst

- **Erneute** technische Tiefenabstecher in **tRPC/Zod** — höchstens **kurz** zur Einordnung von A11y oder Texten (sonst Überschneidung mit FSE).
- **Detaillierte** CI- oder Vitest-Pipeline — **Thema 1**.

---

## 3. Kurz-Checkliste vor der Abgabe

- [ ] Vier Personen, **je ein Thema**, ohne Doppelungen — **nur eine Person** pro Thema (Erarbeitung **und** Einzelreferat).
- [ ] **Vier Termine** à **45 Minuten** (je **eine UE**): **ca. 20 Min.** Referat + **Diskussion und Feedback** — mit **Betreuung** abstimmen.
- [ ] Handout: **vier gleichwertige Felder**, zusammen **vollständiges** SQM-Bild der Fallstudie.
- [ ] Schriftliche Ausarbeitung: **ca. 7–10 Seiten**, **LaTeX** — Umfang **je Person** vs. **Gruppe** mit **Betreuung** geklärt.
- [ ] Pro Thema klar: **Qualitätsziele + Methoden + Nachweis**; **Abgrenzung** beachtet (siehe „bewusst nicht umfasst“).
- [ ] Kein Ersatz für die **Betreuungsvorgaben** der konkreten Prüfung — bei Widerspruch gilt die **Veranstaltung**.

---

## 4. Literatur im Repo (Orientierung)

- [`PRAKTIKUM-SQM.md`](./PRAKTIKUM-SQM.md) — Aufgabenfelder, Abgabe, 10-Block-Plan
- [`docs/didaktik/zweiter-kurs-und-agentische-ki.md`](../didaktik/zweiter-kurs-und-agentische-ki.md) — Synergie FSE/SQM
- [`docs/TESTING.md`](../TESTING.md), [`Backlog.md`](../../Backlog.md), [`SECURITY-OVERVIEW.md`](../SECURITY-OVERVIEW.md)

---

_Stand: 2026-04-01 · Datei: `Softwarequalitaetsmanagement-Beschreibung-4-Referate.md` · Bei Änderungen an Prüfungsformaten dieses Dokument und Verweise in [`docs/README.md`](../README.md) anpassen._
