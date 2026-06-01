# Synergie beider Kurse: SQM trägt Qualitätsverantwortung

> Ein Produkt (arsnova.eu), zwei Kurse arbeiten parallel: Kurs 1 entwickelt, Kurs 2 (Softwarequalitätsmanagement) ist **für die Qualität des Projekts verantwortlich** und arbeitet mit.

## Kurz gesagt

- **Kurs 1** baut Features.
- **Kurs 2** sorgt dafuer, dass diese Features technisch und methodisch sauber werden.
- Beide arbeiten **am gleichen Produkt**, **im gleichen Repo** und mit **denselben Regeln**.

### Ausführliche Praktikumsbeschreibung (SQM, studierendenfreundlich)

Für **Lernziele**, **Zeitmodell**, **bewertete Leistung** (Portfolio), **Aufgabenfelder** (Tests, E2E, Lighthouse, Think Aloud, KI-Reader, Guidde), **agentische KI** und **Abgabe-Checkliste**:

**→ [`docs/praktikum/PRAKTIKUM-SQM.md`](../praktikum/PRAKTIKUM-SQM.md)**

Dieses Dokument hier bleibt die **kompakte** Synergie- und Rollenübersicht; Details und Arbeitsanleitung stehen im Praktikumsleitfaden.

---

## 1. Modell: Ein Produkt, zwei Rollen

| Rolle                      | Kurs                           | Verantwortung                                                                                                                                                                                                                                                                          |
| -------------------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Entwicklung**            | Kurs 1 (z. B. ARS/Entwicklung) | Features bauen: Backlog-Stories umsetzen, tRPC/Frontend/Shared-Types, Repo-Konventionen einhalten.                                                                                                                                                                                     |
| **Qualitätsverantwortung** | Kurs 2 (SQM)                   | Qualität des **gleichen** Projekts sichern: Teststrategie, E2E-, Last- und Performancetests, Reviews, DoD, Metriken, Sicherheit, Datenschutz (DSGVO), **UI/UX (Lautes Denken)**, **KI-Reader-Nutzbarkeit**, **Nutzungsanleitung mit Guidde**, Prozesse – **parallel** zur Entwicklung. |

**Synergie:** Beide Kurse arbeiten am **selben Repo**, am **selben Backlog** und an der **selben DoD**. SQM ist nicht einfach ein weiterer Nutzer der App, sondern der Qualitäts-Partner im gleichen Projekt.

---

## 2. Parallele Zusammenarbeit konkret

### 2.1 Was der SQM-Kurs beisteuert

- **Teststrategie & Tests:** SQM entwirft, ergänzt oder prüft Tests, z. B. fuer DTO-Stripping oder den Session-Lifecycle.
- **E2E-Tests:** SQM plant und pflegt End-to-End-Tests fuer wichtige Flows wie Beitritt, Abstimmung und Ergebnisanzeige.
- **Last und Performance:** SQM misst, bewertet und dokumentiert Performance und Last, z. B. mit Lighthouse, DevTools oder passenden Lasttest-Tools.
- **Reviews:** SQM prueft PRs von Kurs 1 gegen DoD und Architektur, z. B. Zod, DTO, `any`, Signals oder A11y.
- **DoD durchsetzen:** SQM hilft mit, dass Stories nicht zu frueh als fertig gelten.
- **Qualitätsmetriken & Audits:** SQM beobachtet Testabdeckung, Linter-Ergebnisse, Accessibility und Performance.
- **Sicherheit & Datenschutz:** SQM achtet auf Abhaengigkeiten, Datensparsamkeit und die Projektregeln zu Sicherheit und DSGVO.
- **UI/UX-Tests:** SQM plant, fuehrt und wertet Think-Aloud-Tests aus.
- **KI-Reader-Nutzbarkeit:** SQM prueft, ob zentrale Flows auch mit KI-gestuetzten Readern gut nutzbar sind.
- **Nutzungsanleitung:** SQM kann visuelle Guides, z. B. mit [Guidde](https://www.guidde.com/), erstellen oder verbessern.
- **Prozesse:** SQM hilft bei Review-Rhythmus, Checklisten und der Frage, wann Qualitaet fuer eine Story wirklich nachgewiesen ist.

### 2.2 Wie Entwicklung und SQM zusammenspielen

- **Gemeinsames Backlog:** Qualitäts-Stories koennen im selben Backlog oder in einer klar verlinkten SQM-Liste stehen. Wichtig ist: Beide Kurse kennen DoD und Konventionen.
- **Paralleler Rhythmus:** SQM arbeitet nicht erst nach dem Release, sondern schon waehrend der Entwicklung.
- **Eine Codebasis:** Beide Kurse committen ins gleiche Repo. SQM ergaenzt Tests, Checklisten, CI oder Doku, ohne die Feature-Arbeit von Kurs 1 zu duplizieren.

### 2.3 Erste Vorlesung: Greenfield-Demo Story 1.7a (3×45 Min.)

In **Fallstudie Software Engineering** (und für SQM als Beobachtungs-/Review-Kontext) ist die **erste** gemeinsame Vorlesungseinheit eine **Greenfield-Demo**: [**Story 1.7a**](../../Backlog.md) (_Markdown-Bilder: nur URL + Lightbox_) wird in **3×45 Minuten** (135 Min.) von der **Lehrperson** mit **KI-Agenten** live im Repo umgesetzt — Leitfaden [`greenfield-demo-1-7a-vorlesung.md`](./greenfield-demo-1-7a-vorlesung.md), ADR-0015, Backlog-Akzeptanzkriterien.

- **Studierende** setzen **1.7a nicht** parallel als Praktikums-Ticket um; sie arbeiten **danach** an den **anderen offenen Stories** ([`docs/praktikum/STUDENT-STORY-REIHENFOLGE.md`](../praktikum/STUDENT-STORY-REIHENFOLGE.md), Abschnitt 3).
- **SQM** begleitet die **PRs zu diesen Stories** (Reviews, Tests, DoD, Risiko, A11y).
- Die **erste Vorlesung** bleibt vollständig auf **Story 1.7a / Lightbox** fokussiert; andere fertige Referenzfeatures wie **Epic 10 (MOTD)** sind davon getrennt und gehören höchstens in spätere Sitzungen.

---

## 3. Agentische KI in der Synergie

Die KI unterstützt **beide** Kurse mit dem **gleichen Projektkontext** (AGENT.md, Serena-Memories ab `mem:core`, Backlog), aber mit unterschiedlichen Aufgaben:

| Kurs                     | Typische KI-Nutzung                                                                                                                                                                                |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Kurs 1 (Entwicklung)** | Code nach Backlog/DoD generieren, tRPC + Zod + DTO, Frontend mit Signals; Baby-Steps, Architektur einhalten.                                                                                       |
| **Kurs 2 (SQM)**         | DoD-Check über geänderten Code (Tests vorhanden? DTO eingehalten? isCorrect nie in ACTIVE?), Review-Kommentare vorschlagen, Testfälle oder Teststrategie entwerfen, Checklisten gegen Code prüfen. |

**Gemeinsam:** Beide Kurse arbeiten mit demselben Projektkontext. Die KI kennt also Repo, Regeln und Qualitaetsanforderungen. SQM kann die KI mehrstufig nutzen, z. B.: „Pruefe diesen PR gegen DoD und Backlog“ oder „Schlage Testfaelle fuer den `session`-Router vor“.

Konkrete Ansatzpunkte:

- **Cursor Rules:** Eine eigene Rule fuer SQM-Arbeit mit Fokus auf Review, DoD und Teststrategie.
- **PR-/DoD-Check:** Erst manuell, spaeter bei Bedarf auch automatisiert, damit SQM konsistent pruefen kann.
- **Test-/Review-Vorlagen:** Prompts in `docs/vibe-coding/`, damit beide Kurse und die KI mit denselben Massstaeben arbeiten.

---

## 4. Kurzfassung

| Aspekt            | Inhalt                                                                                                                                                                                                                                            |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Synergie**      | Ein Produkt (arsnova.eu). Kurs 1 entwickelt, Kurs 2 (SQM) trägt die **Qualitätsverantwortung** und arbeitet **parallel** mit.                                                                                                                     |
| **SQM-Rolle**     | Teststrategie, E2E-, Last- und Performancetests, Reviews, DoD, Metriken/Audits, Sicherheit, Datenschutz (DSGVO), **UI/UX (Lautes Denken)**, **KI-Reader-Nutzbarkeit**, **Nutzungsanleitung mit Guidde**, Prozesse – am gleichen Repo und Backlog. |
| **Agentische KI** | Gemeinsamer Kontext für beide; Entwicklung nutzt KI für Implementierung, SQM für Review, DoD-Check, Tests und Checklisten (inkl. mehrstufige Agent-Nutzung).                                                                                      |

Nächste Schritte (optional): Cursor-Rule für SQM (Review/DoD-Fokus), Review- und Test-Prompt-Vorlagen in `docs/vibe-coding/`, klare Zuordnung von Qualitäts-Stories im Backlog oder in `Backlog-SQM.md` mit Verlinkung zum Haupt-Backlog. **Ausführlicher Praktikumsleitfaden für Studierende:** [`docs/praktikum/PRAKTIKUM-SQM.md`](../praktikum/PRAKTIKUM-SQM.md).

**Semester-Fahrplan (Lehrende):** Wochenübersicht drei Kurse + didaktische Reihenfolge der Repo-Dokumentation — [`FAHRPLAN-DREI-KURSE-UND-DOKU-REIHENFOLGE.md`](./FAHRPLAN-DREI-KURSE-UND-DOKU-REIHENFOLGE.md).

**Ergänzung Kurs 3:** Ein **Data-Analytics-/NLP-Praktikum** (intelligente Wortwolke, **Modellwahl und Prompting** auf selbst gehosteten LLMs) ist **nicht** an die Parallelität von Kurs 1 und 2 gebunden — siehe [`dritter-kurs-data-analytics-nlp.md`](./dritter-kurs-data-analytics-nlp.md) und [`docs/praktikum/PRAKTIKUM-DATA-ANALYTICS.md`](../praktikum/PRAKTIKUM-DATA-ANALYTICS.md).
