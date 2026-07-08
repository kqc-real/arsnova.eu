<!-- markdownlint-disable MD029 MD060 -->

# Fahrplan: drei Kurse + didaktische Reihenfolge der Repo-Dokumentation

**Zielgruppe:** Lehrperson (Planung von Vorlesung/Praktikum)  
**Annahmen:** **Kurs 1** = Fallstudie Software Engineering (Entwicklung), **Kurs 2** = Software-Qualitätsmanagement, **Kurs 3** = Data Analytics / NLP — können **parallel** (1+2) laufen; **Kurs 3** oft **versetzt** oder **eigenes Semester** (siehe [`dritter-kurs-data-analytics-nlp.md`](./dritter-kurs-data-analytics-nlp.md)).  
**Anpassung:** Wochen sind **Richtwerte**; die **Greenfield-Demo 1.7a** passt in **3×45 Min.** (eine Woche oder drei aufeinanderfolgende Termine) — [`greenfield-demo-1-7a-vorlesung.md`](./greenfield-demo-1-7a-vorlesung.md). Inhalte aus Woche 1–3 FSE bei Zeitdruck **zusammenlegen**.

**Wenn du nur 10 Minuten hast:** Starte mit [`dozenten-quickstart.md`](./dozenten-quickstart.md), dann erst in dieses Dokument.

---

## Teil A — Fahrplan „was wann in welchem Kurs“

### Legende

| Spalte  | Inhalt                                                                                    |
| ------- | ----------------------------------------------------------------------------------------- |
| **FSE** | Fallstudie Software Engineering — Vorlesung + Praktikum                                   |
| **SQM** | Software-Qualitätsmanagement                                                              |
| **DA**  | Data Analytics / NLP (Kurs 3) — nur ausfüllen, wenn der Kurs **in diesem Zeitraum** läuft |

### Übersicht (ca. 12–14 Wochen Semester)

| Woche     | FSE (Vorlesung / Praktikum)                                                                                                                                                                                                                                                                                 | SQM                                                                                                                                                                                                | DA (Kurs 3, optional)                                                                                                                                                                                 |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1**     | **Greenfield-Demo (Teil 1/3):** Story **1.7a** — Backlog-AC, **ADR-0015**, Markdown-Pipeline; **Mini:** VS Code. Leitfaden [`greenfield-demo-1-7a-vorlesung.md`](./greenfield-demo-1-7a-vorlesung.md) Block 1.                                                                                              | **Einstieg:** Rolle Qualitätspartner; [`zweiter-kurs-und-agentische-ki.md`](./zweiter-kurs-und-agentische-ki.md) kurz; gemeinsames Repo/Backlog. **Noch wenig Code:** Produktziel aus Nutzersicht. | **Falls aktiv:** Ziel „Intelligente Moderationshilfe“; Pflichtlektüre Start [`BEGRIFFE-FREITEXT-UND-SEMANTIK.md`](../praktikum/BEGRIFFE-FREITEXT-UND-SEMANTIK.md) (erste Kapitel); Abgrenzung zu FSE. |
| **2**     | **Greenfield-Demo (Teil 2/3):** 1.7a — Lightbox, erste Einbindung; **Mini:** **Git** + **GitHub**. Fokus bleibt vollständig auf **Story 1.7a** und **ADR-0015**.                                                                                                                                            | **DoD sichtbar machen:** [`Backlog.md`](../../Backlog.md) Abschnitt DoD; **CI** als Türsteher ([`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) nur zeigen, nicht auseinandernehmen).  | Problemstellung Freitext; lexikalisch vs. semantisch (Bezug zu Produkt).                                                                                                                              |
| **3**     | **Greenfield-Demo (Teil 3/3):** 1.7a — weitere Views, i18n, A11y, Tests; **Stack in einem Bild** (Browser ↔ Angular ↔ …); **Mini:** **npm** / **Docker** Postgres+Redis. Übergang: [`STUDENT-STORY-REIHENFOLGE.md`](../praktikum/STUDENT-STORY-REIHENFOLGE.md) mit der **aktuellen offenen Ticketstrecke**. | **PR lesen:** PR zur **1.7a**-Demo oder erster Studierenden-PR; Diff, Checks grün/rot; **kein** vollständiges Review — nur Orientierung.                                                           | Technische Landkarte Baseline / Encoder / Kaskade / optional LLM ([`PRAKTIKUM-DATA-ANALYTICS.md`](../praktikum/PRAKTIKUM-DATA-ANALYTICS.md) §6); Evaluationsdenken.                                   |
| **4**     | **Übergang Studierende:** [`STUDENT-STORY-REIHENFOLGE.md`](../praktikum/STUDENT-STORY-REIHENFOLGE.md) erklären; **kanonische Reihenfolge** und ggf. gekürzten Lehrzuschnitt sichtbar machen; **erste aktuelle Story** — Aufgabe, Akzeptanzkriterien. **AGENT.md** als Arbeitsvertrag mit KI.                | **Review-Übung:** Checkliste gegen kleinen PR (Kommilitonen oder Teaching-PR); Fokus Zod/tRPC erwähnt, Tiefe später.                                                                               | Modellwahl-Checkliste anfangen; Datenschutz-Faden (Freitext).                                                                                                                                         |
| **5**     | Praktikum: Story-Arbeit; Sprechstunde Monorepo (`apps/`, `libs/shared-types`). **Bei Bedarf:** [`onboarding.md`](../onboarding.md) Troubleshooting.                                                                                                                                                         | Teststrategie grob ([`TESTING.md`](../TESTING.md) Intro); was Unit vs. Integration in _eurem_ Projekt heißt.                                                                                       | Strukturierte Ausgabe (JSON), Modellversionen und ggf. Prompting; Bezug zu Zod nur konzeptionell.                                                                                                     |
| **6**     | Stories fortsetzen; erste **Merge-Konflikte** / Branch-Update demonstrieren (15 Min.).                                                                                                                                                                                                                      | **Lighthouse / A11y** als Thema; [`ui/PR-CHECKLIST-UI.md`](../ui/PR-CHECKLIST-UI.md) optional zeigen.                                                                                              | Evaluierung (kleines Testset); Fehleranalyse.                                                                                                                                                         |
| **7**     | Story mit **UI + i18n** vorbereiten: **ADR-0008** + [`I18N-ANGULAR.md`](../I18N-ANGULAR.md) kurz (Pflicht vor erster Übersetzungs-Story).                                                                                                                                                                   | Review mit **i18n-Fokus** (XLF mit erwähnen); DoD-Punkt „alle Sprachen“.                                                                                                                           | Mehrsprachigkeit der _Inhalte_ vs. UI (ADR-0008 vs. Dozenten-Texte).                                                                                                                                  |
| **8**     | **Architektur vertiefen:** ein ADR zum aktuellen Thema (z. B. tRPC, Rollen) — **eine** Datei, nicht alle.                                                                                                                                                                                                   | **Sicherheit leicht:** [`SECURITY-OVERVIEW.md`](../SECURITY-OVERVIEW.md) + `npm audit` als Ritual.                                                                                                 | Optional: Abstimmung mit FSE zu Schnittstelle / JSON-Schema.                                                                                                                                          |
| **9**     | Komplexere Stories (Q&A, Sync, …); **Serena-Memories ab `mem:core`** gezielt Ausschnitte (nicht linear lesen).                                                                                                                                                                                              | **E2E/Last** nur planerisch ([`PRAKTIKUM-SQM.md`](../praktikum/PRAKTIKUM-SQM.md) — wo im Kurs vorgesehen).                                                                                         | Portfolio-Zug; ggf. Notebook/CLI-Demo.                                                                                                                                                                |
| **10**    | Praktikum; **feature-Doks** nur bei Bedarf (`docs/features/…`).                                                                                                                                                                                                                                             | Think-Aloud / UX-Test **vorbereiten** (Methodik), falls im Semester vorgesehen.                                                                                                                    | Schreibfertige Konzeption; Review mit SQM möglich.                                                                                                                                                    |
| **11**    | Security-nahe Stories nur mit **extra Hinweis**; Pair-Review empfehlen.                                                                                                                                                                                                                                     | **Tieferes PR-Review** (DTO, Stripping, kein `isCorrect` in ACTIVE — Verweis DoD).                                                                                                                 | —                                                                                                                                                                                                     |
| **12**    | Aufräumen, offene PRs; ggf. **Barrierefreiheit**-Story einplanen.                                                                                                                                                                                                                                           | Gesamt-Retro Qualität; **Abgabe-Checklisten** aus Praktikums-Dokus.                                                                                                                                | Abgabe / Präsentation (wenn Kurs 3 hier endet).                                                                                                                                                       |
| **13–14** | Puffer, Nachschreiben, Prüfung                                                                                                                                                                                                                                                                              | Puffer, Portfolio                                                                                                                                                                                  | —                                                                                                                                                                                                     |

**Kurz:** In **FSE** sind **Woche 1–3** die **Greenfield-Demo Story 1.7a** (3×45 Min., KI-Agent) plus Tool-Mini-Vorlesungen; ab **Woche 4** Schwerpunkt **gestützte Story-Arbeit** entlang der aktuellen offenen Ticketstrecke oder eines bewusst gekürzten Lehrzuschnitts ([`STUDENT-STORY-REIHENFOLGE.md`](../praktikum/STUDENT-STORY-REIHENFOLGE.md)). **SQM** startet **meta** (Rolle, DoD, CI), geht **Woche 4+** in konkrete **Reviews** und später **Tests/Sicherheit/UX**. **DA** bleibt **konzept- und evidenzlastig**: Baselines, Modellvergleich und Evaluation vor Produktintegration, generative LLMs nur optional.

---

## Teil B — Didaktisch sinnvolle Reihenfolge der Repo-Dokumentation

Ziel: **Kognitive Last** steuern — zuerst **Handlung** (App laufen, etwas sehen), dann **Vertrag** (Backlog, DoD), dann **Architektur-Tiefe** (ADRs, Serena-Memories).

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
8. **[`docs/praktikum/STUDENT-STORY-REIHENFOLGE.md`](../praktikum/STUDENT-STORY-REIHENFOLGE.md)** — aktuelle offene Ticketstrecke, Vorlesung **1.7a** ausgenommen.
9. **[`docs/ROUTES_AND_STORIES.md`](../ROUTES_AND_STORIES.md)** — optional früh, spätestens wenn Routing verwirrt.

### Stufe 4 — Arbeiten mit KI und Mitwirkung

10. **[`AGENT.md`](../../AGENT.md)** — vor der **ersten** studentischen Story mit KI-Unterstützung.
11. **[`CONTRIBUTING.md`](../../CONTRIBUTING.md)** — Branch, Commit, PR-Erwartung.
12. **[`docs/vibe-coding/`](../vibe-coding/)** — optional als Beispiel-Prompts, nicht Pflichtlektüre.

### Stufe 5 — Architektur und Entscheidungen (verteilt über das Semester)

13. **[`docs/architecture/handbook.md`](../architecture/handbook.md)** — Auszüge, nicht in einer Sitzung.
14. **Einzel-ADRs** passend zur Story (z. B. **0003** tRPC, **0006** Rollen, **0008** i18n, **0015** Markdown-Bilder, **0018** MOTD), nie „alle ADRs“.
15. **[`docs/serena.md`](../serena.md)** und **`mem:core`** — **Referenz**, zum Nachschlagen; Einführung als **geführte Tour** (15–20 Min.) erst wenn Studierende schon eine Procedure gesehen haben.

### Stufe 6 — Qualität, Sicherheit, UI (wenn thematisch berührt)

16. **[`docs/TESTING.md`](../TESTING.md)**
17. **[`docs/SECURITY-OVERVIEW.md`](../SECURITY-OVERVIEW.md)**
18. **[`docs/ui/STYLEGUIDE.md`](../ui/STYLEGUIDE.md)** + **[`docs/I18N-ANGULAR.md`](../I18N-ANGULAR.md)** vor UI-Storys mit Texten.

### Stufe 7 — Kurs-spezifische Pflichtdokus (parallel einbinden)

| Kurs    | Dokumente (Reihenfolge innerhalb des Kurses)                                                                                                                                                                                                                |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **FSE** | [`PRAKTIKUM.md`](../praktikum/PRAKTIKUM.md) früh; für die erste Vorlesung/Greenfield-Demo [`greenfield-demo-1-7a-vorlesung.md`](./greenfield-demo-1-7a-vorlesung.md) + [ADR-0015](../architecture/decisions/0015-markdown-images-url-only-and-lightbox.md). |
| **SQM** | [`PRAKTIKUM-SQM.md`](../praktikum/PRAKTIKUM-SQM.md) → Synergie [`zweiter-kurs-und-agentische-ki.md`](./zweiter-kurs-und-agentische-ki.md) → DoD aus `Backlog.md`.                                                                                           |
| **DA**  | [`PRAKTIKUM-DATA-ANALYTICS.md`](../praktikum/PRAKTIKUM-DATA-ANALYTICS.md) → [`BEGRIFFE-FREITEXT-UND-SEMANTIK.md`](../praktikum/BEGRIFFE-FREITEXT-UND-SEMANTIK.md).                                                                                          |

### Bewusst nach hinten oder nur für Spezialfälle

- **[`docs/deployment-debian-root-server.md`](../deployment-debian-root-server.md)** — nur wenn Betrieb/Deployment Thema ist.
- **[`docs/diagrams/`](../diagrams/)** — zur Visualisierung in der Vorlesung, nicht als Pflichtlektüre.
- **`prisma/schema.prisma`** — gemeinsam **ein** Modell öffnen, wenn Daten Thema sind.

---

## Teil C — Mini-Checkliste für dich als Lehrende:r

- [ ] Woche 1: Studierende haben **EINSTIEG** + **onboarding** als Links (LMS).
- [ ] Vor Semesterstart: **dozenten-quickstart.md** gelesen und lokale Standardentscheidungen markiert.
- [ ] Vor der ersten 1.7a-/Lightbox-Demo: **greenfield-demo-1-7a-vorlesung.md** + **ADR-0015** für dich offen, nicht für alle vorlesen.
- [ ] Vor erster Story: **AGENT.md** + **CONTRIBUTING** genannt.
- [ ] **Serena-Memories** nicht als „Hausaufgabe alles lesen“, sondern **spät** und **situativ**.
- [ ] SQM-Studierende wissen bis Woche 4, **wo** die DoD im Backlog steht.

---

**Stand:** 2026-05-31
