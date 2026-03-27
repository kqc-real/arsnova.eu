# Fahrplan: drei Kurse + didaktische Reihenfolge der Repo-Dokumentation

**Zielgruppe:** Lehrperson (Planung von Vorlesung/Praktikum)  
**Annahmen:** **Kurs 1** = Fallstudie Software Engineering (Entwicklung), **Kurs 2** = Software-Qualitätsmanagement, **Kurs 3** = Data Analytics / NLP — können **parallel** (1+2) laufen; **Kurs 3** oft **versetzt** oder **eigenes Semester** (siehe [`dritter-kurs-data-analytics-nlp.md`](./dritter-kurs-data-analytics-nlp.md)).  
**Anpassung:** Wochen sind **Richtwerte**; bei komprimierter Epic-10-Demo (**drei Vorlesungen**) Inhalte aus Woche 1–2 **zusammenlegen**.

---

## Teil A — Fahrplan „was wann in welchem Kurs“

### Legende

| Spalte  | Inhalt                                                                                    |
| ------- | ----------------------------------------------------------------------------------------- |
| **FSE** | Fallstudie Software Engineering — Vorlesung + Praktikum                                   |
| **SQM** | Software-Qualitätsmanagement                                                              |
| **DA**  | Data Analytics / NLP (Kurs 3) — nur ausfüllen, wenn der Kurs **in diesem Zeitraum** läuft |

### Übersicht (ca. 12–14 Wochen Semester)

| Woche     | FSE (Vorlesung / Praktikum)                                                                                                                                                                                                                      | SQM                                                                                                                                                                                                | DA (Kurs 3, optional)                                                                                                                                                                                 |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1**     | **Einstieg Produkt:** Was ist arsnova.eu (5 Min. Live-App). **Doku-Reihenfolge Stufe 1** (siehe Teil B). **Epic 10 live starten** mit KI-Agent: erstes sichtbares Ergebnis (z. B. Schema/Struktur). **Mini:** VS Code (Ordner, Terminal, Suche). | **Einstieg:** Rolle Qualitätspartner; [`zweiter-kurs-und-agentische-ki.md`](./zweiter-kurs-und-agentische-ki.md) kurz; gemeinsames Repo/Backlog. **Noch wenig Code:** Produktziel aus Nutzersicht. | **Falls aktiv:** Ziel „Intelligente Moderationshilfe“; Pflichtlektüre Start [`BEGRIFFE-FREITEXT-UND-SEMANTIK.md`](../praktikum/BEGRIFFE-FREITEXT-UND-SEMANTIK.md) (erste Kapitel); Abgrenzung zu FSE. |
| **2**     | **Epic 10 fortsetzen** live. **Mini:** **Git** (Status, Branch, Commit) + **GitHub** (Repo, Issues optional). Verbindung zu dem, was du gerade committest.                                                                                       | **DoD sichtbar machen:** [`Backlog.md`](../../Backlog.md) Abschnitt DoD; **CI** als Türsteher ([`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) nur zeigen, nicht auseinandernehmen).  | Problemstellung Freitext; lexikalisch vs. semantisch (Bezug zu Produkt).                                                                                                                              |
| **3**     | **Epic 10 abschließen** live (Rest 10.x). **Mini:** **npm** (`install`, `run dev`), **Docker** nur als „Postgres/Redis starten“. **Stack in einem Bild:** Browser ↔ Angular ↔ tRPC ↔ Node ↔ Prisma ↔ Postgres (+ Redis erwähnen).                | **PR lesen:** Ein echter PR (dein Epic-10-PR oder Referenz); Diff, Checks grün/rot; **kein** vollständiges Review — nur Orientierung.                                                              | Technische Landkarte spaCy / Encoder / LLM ([`PRAKTIKUM-DATA-ANALYTICS.md`](../praktikum/PRAKTIKUM-DATA-ANALYTICS.md) §6); Evaluationsdenken.                                                         |
| **4**     | **Übergang Studierende:** [`STUDENT-STORY-REIHENFOLGE.md`](../praktikum/STUDENT-STORY-REIHENFOLGE.md) erklären; **erste Story** (z. B. 5.4a) — Aufgabe, Akzeptanzkriterien. **AGENT.md** als Arbeitsvertrag mit KI.                              | **Review-Übung:** Checkliste gegen kleinen PR (Kommilitonen oder Teaching-PR); Fokus Zod/tRPC erwähnt, Tiefe später.                                                                               | Modellwahl-Checkliste anfangen; Datenschutz-Faden (Freitext).                                                                                                                                         |
| **5**     | Praktikum: Story-Arbeit; Sprechstunde Monorepo (`apps/`, `libs/shared-types`). **Bei Bedarf:** [`onboarding.md`](../onboarding.md) Troubleshooting.                                                                                              | Teststrategie grob ([`TESTING.md`](../TESTING.md) Intro); was Unit vs. Integration in _eurem_ Projekt heißt.                                                                                       | Prompting & strukturierte Ausgabe (JSON); Bezug zu Zod nur konzeptionell.                                                                                                                             |
| **6**     | Stories fortsetzen; erste **Merge-Konflikte** / Branch-Update demonstrieren (15 Min.).                                                                                                                                                           | **Lighthouse / A11y** als Thema; [`ui/PR-CHECKLIST-UI.md`](../ui/PR-CHECKLIST-UI.md) optional zeigen.                                                                                              | Evaluierung (kleines Testset); Fehleranalyse.                                                                                                                                                         |
| **7**     | Story mit **UI + i18n** vorbereiten: **ADR-0008** + [`I18N-ANGULAR.md`](../I18N-ANGULAR.md) kurz (Pflicht vor erster Übersetzungs-Story).                                                                                                        | Review mit **i18n-Fokus** (XLF mit erwähnen); DoD-Punkt „alle Sprachen“.                                                                                                                           | Mehrsprachigkeit der _Inhalte_ vs. UI (ADR-0008 vs. Dozenten-Texte).                                                                                                                                  |
| **8**     | **Architektur vertiefen:** ein ADR zum aktuellen Thema (z. B. tRPC, Rollen) — **eine** Datei, nicht alle.                                                                                                                                        | **Sicherheit leicht:** [`SECURITY-OVERVIEW.md`](../SECURITY-OVERVIEW.md) + `npm audit` als Ritual.                                                                                                 | Optional: Abstimmung mit FSE zu Schnittstelle / JSON-Schema.                                                                                                                                          |
| **9**     | Komplexere Stories (Q&A, Sync, …); **`cursor-context.md`** gezielt Ausschnitte (nicht linear lesen).                                                                                                                                             | **E2E/Last** nur planerisch ([`PRAKTIKUM-SQM.md`](../praktikum/PRAKTIKUM-SQM.md) — wo im Kurs vorgesehen).                                                                                         | Portfolio-Zug; ggf. Notebook/CLI-Demo.                                                                                                                                                                |
| **10**    | Praktikum; **feature-Doks** nur bei Bedarf (`docs/features/…`).                                                                                                                                                                                  | Think-Aloud / UX-Test **vorbereiten** (Methodik), falls im Semester vorgesehen.                                                                                                                    | Schreibfertige Konzeption; Review mit SQM möglich.                                                                                                                                                    |
| **11**    | Security-nahe Stories nur mit **extra Hinweis**; Pair-Review empfehlen.                                                                                                                                                                          | **Tieferes PR-Review** (DTO, Stripping, kein `isCorrect` in ACTIVE — Verweis DoD).                                                                                                                 | —                                                                                                                                                                                                     |
| **12**    | Aufräumen, offene PRs; ggf. **Barrierefreiheit**-Story einplanen.                                                                                                                                                                                | Gesamt-Retro Qualität; **Abgabe-Checklisten** aus Praktikums-Dokus.                                                                                                                                | Abgabe / Präsentation (wenn Kurs 3 hier endet).                                                                                                                                                       |
| **13–14** | Puffer, Nachschreiben, Prüfung                                                                                                                                                                                                                   | Puffer, Portfolio                                                                                                                                                                                  | —                                                                                                                                                                                                     |

**Kurz:** In **FSE** dominieren **Woche 1–3** deine **Epic-10-Live-Sessions** inkl. Tool-Mini-Vorlesungen; ab **Woche 4** verschiebt sich der Schwerpunkt auf **gestützte Story-Arbeit**. **SQM** startet **meta** (Rolle, DoD, CI), geht **Woche 4+** in konkrete **Reviews** und später **Tests/Sicherheit/UX**. **DA** bleibt **konzept- und evidenzlastig**, technische Repo-Tiefe nur soweit nötig für Abstimmung mit FSE.

---

## Teil B — Didaktisch sinnvolle Reihenfolge der Repo-Dokumentation

Ziel: **Kognitive Last** steuern — zuerst **Handlung** (App laufen, etwas sehen), dann **Vertrag** (Backlog, DoD), dann **Architektur-Tiefe** (ADRs, cursor-context).

### Stufe 1 — Vor dem ersten Klon (oder in Woche 1, erste 20 Min.)

1. **[`README.md`](../../README.md)** (Root) — Zweck des Produkts, grober Stack.
2. **[`docs/praktikum/EINSTIEG-TOOLS-UND-STACK.md`](../praktikum/EINSTIEG-TOOLS-UND-STACK.md)** — Landkarte Werkzeuge/Technologien (ohne Volltutorial).
3. **[`docs/README.md`](../README.md)** — Navigationskarte `docs/` (nur zeigen: „hier liegt was“).

### Stufe 2 — Setup und erste erfolgreiche Minute

4. **[`docs/onboarding.md`](../onboarding.md)** — Quickstart bis `npm run dev` funktioniert.
5. **[`.env.example`](../../.env.example)** (ohne Geheimnisse zu zeigen) — warum Umgebungsvariablen existieren.
6. **[`docs/ENVIRONMENT.md`](../ENVIRONMENT.md)** — optional, wenn Fragen zu Variablen kommen.

### Stufe 3 — Produkt und Arbeitspakete (ab spätestens Woche 4 für Studierende)

7. **[`Backlog.md`](../../Backlog.md)** — Epics, eine Story **komplett** als Beispiel lesen (Akzeptanzkriterien).
8. **[`docs/praktikum/STUDENT-STORY-REIHENFOLGE.md`](../praktikum/STUDENT-STORY-REIHENFOLGE.md)** — Reihenfolge, Sonderfall Epic 10.
9. **[`docs/ROUTES_AND_STORIES.md`](../ROUTES_AND_STORIES.md)** — optional früh, spätestens wenn Routing verwirrt.

### Stufe 4 — Arbeiten mit KI und Mitwirkung

10. **[`AGENT.md`](../../AGENT.md)** — vor der **ersten** studentischen Story mit KI-Unterstützung.
11. **[`CONTRIBUTING.md`](../../CONTRIBUTING.md)** — Branch, Commit, PR-Erwartung.
12. **[`docs/vibe-coding/`](../vibe-coding/)** — optional als Beispiel-Prompts, nicht Pflichtlektüre.

### Stufe 5 — Architektur und Entscheidungen (verteilt über das Semester)

13. **[`docs/architecture/handbook.md`](../architecture/handbook.md)** — Auszüge, nicht in einer Sitzung.
14. **Einzel-ADRs** passend zur Story (z. B. **0003** tRPC, **0006** Rollen, **0008** i18n, **0018** MOTD), nie „alle ADRs“.
15. **[`docs/cursor-context.md`](../cursor-context.md)** — **Referenz**, zum Nachschlagen; Einführung als **geführte Tour** (15–20 Min.) erst wenn Studierende schon eine Procedure gesehen haben.

### Stufe 6 — Qualität, Sicherheit, UI (wenn thematisch berührt)

16. **[`docs/TESTING.md`](../TESTING.md)**
17. **[`docs/SECURITY-OVERVIEW.md`](../SECURITY-OVERVIEW.md)**
18. **[`docs/ui/STYLEGUIDE.md`](../ui/STYLEGUIDE.md)** + **[`docs/I18N-ANGULAR.md`](../I18N-ANGULAR.md)** vor UI-Storys mit Texten.

### Stufe 7 — Kurs-spezifische Pflichtdokus (parallel einbinden)

| Kurs    | Dokumente (Reihenfolge innerhalb des Kurses)                                                                                                                                                     |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **FSE** | [`PRAKTIKUM.md`](../praktikum/PRAKTIKUM.md) früh; bei MOTD-Vorlesung [`motd.md`](../features/motd.md) + [ADR-0018](../architecture/decisions/0018-message-of-the-day-platform-communication.md). |
| **SQM** | [`PRAKTIKUM-SQM.md`](../praktikum/PRAKTIKUM-SQM.md) → Synergie [`zweiter-kurs-und-agentische-ki.md`](./zweiter-kurs-und-agentische-ki.md) → DoD aus `Backlog.md`.                                |
| **DA**  | [`PRAKTIKUM-DATA-ANALYTICS.md`](../praktikum/PRAKTIKUM-DATA-ANALYTICS.md) → [`BEGRIFFE-FREITEXT-UND-SEMANTIK.md`](../praktikum/BEGRIFFE-FREITEXT-UND-SEMANTIK.md).                               |

### Bewusst nach hinten oder nur für Spezialfälle

- **[`docs/deployment-debian-root-server.md`](../deployment-debian-root-server.md)** — nur wenn Betrieb/Deployment Thema ist.
- **[`docs/diagrams/`](../diagrams/)** — zur Visualisierung in der Vorlesung, nicht als Pflichtlektüre.
- **`prisma/schema.prisma`** — gemeinsam **ein** Modell öffnen, wenn Daten Thema sind.

---

## Teil C — Mini-Checkliste für dich als Lehrende:r

- [ ] Woche 1: Studierende haben **EINSTIEG** + **onboarding** als Links (LMS).
- [ ] Vor Epic-10-Demo: **motd.md** + **ADR-0018** für dich offen, nicht für alle vorlesen.
- [ ] Vor erster Story: **AGENT.md** + **CONTRIBUTING** genannt.
- [ ] **cursor-context** nicht als „Hausaufgabe Seite 1–50“, sondern **spät** und **situativ**.
- [ ] SQM-Studierende wissen bis Woche 4, **wo** die DoD im Backlog steht.

---

**Stand:** 2026-03-27
