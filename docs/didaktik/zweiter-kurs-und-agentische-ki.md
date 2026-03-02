# Synergie beider Kurse: SQM trägt Qualitätsverantwortung

> Ein Produkt (arsnova.eu), zwei Kurse arbeiten parallel: Kurs 1 entwickelt, Kurs 2 (Softwarequalitätsmanagement) ist **für die Qualität des Projekts verantwortlich** und arbeitet mit.

---

## 1. Modell: Ein Produkt, zwei Rollen

| Rolle | Kurs | Verantwortung |
|-------|------|----------------|
| **Entwicklung** | Kurs 1 (z. B. ARS/Entwicklung) | Features bauen: Backlog-Stories umsetzen, tRPC/Frontend/Shared-Types, Repo-Konventionen einhalten. |
| **Qualitätsverantwortung** | Kurs 2 (SQM) | Qualität des **gleichen** Projekts sichern: Teststrategie, E2E-, Last- und Performancetests, Reviews, DoD, Metriken, Sicherheit, Datenschutz (DSGVO), **UI/UX (Lautes Denken)**, **KI-Reader-Nutzbarkeit**, **Nutzungsanleitung mit Guidde**, Prozesse – **parallel** zur Entwicklung. |

**Synergie:** Beide Kurse arbeiten am **selben Repo**, am **selben Backlog**, an der **selben DoD**. SQM ist nicht „noch ein Nutzer der App“, sondern **interner Partner** mit der Rolle „Qualität“. Kein getrenntes Produkt, sondern geteilte Verantwortung für ein gemeinsames Ergebnis.

---

## 2. Parallele Zusammenarbeit konkret

### 2.1 Was der SQM-Kurs beisteuert

- **Teststrategie & Tests:** Welche Stories brauchen Unit-/Integrationstests? SQM entwirft mit, schreibt oder prüft Tests (z. B. DTO-Stripping, Session-Lifecycle).
- **E2E-Tests:** End-to-End-Tests mit von der Angular CLI unterstützten Tools (Cypress, Playwright, Nightwatch, WebdriverIO, Puppeteer – [angular.dev E2E](https://angular.dev/tools/cli/end-to-end)) für kritische Flows (Beitritt, Abstimmung, Ergebnis-Anzeige); SQM konzipiert, implementiert und pflegt sie.
- **Last- und Performancetests:** Performancetests mit **Lighthouse** und **Chrome DevTools** (siehe [angular.dev Performance](https://angular.dev/best-practices/profiling-with-chrome-devtools)); Lasttests – Toolwahl durch SQM (Angular gibt keine offizielle Last-Tool-Empfehlung; Szenarien z. B. viele gleichzeitige Teilnehmer, WebSocket-Stabilität).
- **Reviews:** PRs von Kurs 1 gegen DoD und Architektur prüfen (Zod, DTO, kein `any`, Signals, A11y). SQM kann Review-Checklisten pflegen und Reviews übernehmen oder begleiten.
- **DoD durchsetzen:** Sicherstellen, dass Definition of Done eingehalten wird (Tests pro Procedure, kein isCorrect in ACTIVE, Lighthouse, etc.). SQM kann DoD-Checks vor Merge vorschlagen oder automatisieren.
- **Qualitätsmetriken & Audits:** Testabdeckung, Linter-Ergebnisse, Accessibility (Lighthouse), Performance – SQM definiert und überwacht sie.
- **Sicherheit:** Sicherheitschecks (z. B. `npm audit`, Abhängigkeiten, keine high/critical gemäß DoD); SQM prüft oder integriert in CI.
- **Datenschutz (DSGVO):** Prüfung auf Einhaltung der DoD-Datenschutz-Kriterien (Datensparsamkeit, Session-Bereinigung nach 24 h, anonymer Modus).
- **UI/UX-Tests (Lautes Denken):** Usability-Tests nach der Methode „Lautes Denken“ (Think Aloud): Testpersonen nutzen die Anwendung und verbalisieren dabei ihre Gedanken; SQM plant, durchführt und wertet die Tests aus und leitet Verbesserungen ab.
- **Test der Nutzbarkeit mit KI-Readern (Online-Reader):** Prüfung, ob die App mit **KI-gestützten Readern** auf der Webseite (z. B. in den Browser integrierte oder als Erweiterung genutzte KI-Lese-/Vorlese-Assistenten) gut nutzbar ist; SQM testet kritische Flows (Beitritt, Abstimmung, Ergebnis) und dokumentiert Verbesserungsbedarf für die Lesbarkeit und Bedienbarkeit durch solche KI-Reader.
- **User-Nutzungsanleitung mit Guidde:** Erstellung und Pflege der nutzerorientierten Anleitung (Dozenten- und Teilnehmer-Perspektive) mit [Guidde](https://www.guidde.com/) – geführte, visuelle Tutorials/Guides für arsnova.eu.
- **Prozesse:** Wie laufen PRs, wer prüft was, wann ist eine Story „qualitätsseitig abgenommen“? SQM gestaltet den Ablauf mit.

### 2.2 Wie Entwicklung und SQM zusammenspielen

- **Gemeinsames Backlog:** Qualitäts-Stories (z. B. „Integrationstest Session-Flow“, „E2E-Test Beitritt bis Ergebnis“, „Lasttest 100 Teilnehmer“, „Review-Checkliste für Epic 2“) stehen im selben Backlog oder in einer klar verlinkten SQM-Liste; beide Kurse kennen die DoD und die gleichen Konventionen (AGENT.md, cursor-context).
- **Paralleler Rhythmus:** SQM arbeitet nicht „nach dem Release“, sondern **mit**: z. B. Review nach jedem PR, Testkonzept pro Epic, laufende Metriken.
- **Eine Codebasis:** Beide Kurse committen ins gleiche Repo; SQM fügt Tests, CI-Erweiterungen, Checklisten und Docs hinzu, ohne die Feature-Entwicklung zu duplizieren.

---

## 3. Agentische KI in der Synergie

Die KI unterstützt **beide** Kurse mit dem **gleichen Projektkontext** (AGENT.md, cursor-context, Backlog), aber mit unterschiedlichen Aufgaben:

| Kurs | Typische KI-Nutzung |
|------|----------------------|
| **Kurs 1 (Entwicklung)** | Code nach Backlog/DoD generieren, tRPC + Zod + DTO, Frontend mit Signals; Baby-Steps, Architektur einhalten. |
| **Kurs 2 (SQM)** | DoD-Check über geänderten Code (Tests vorhanden? DTO eingehalten? isCorrect nie in ACTIVE?), Review-Kommentare vorschlagen, Testfälle oder Teststrategie entwerfen, Checklisten gegen Code prüfen. |

**Gemeinsam:** Beide laden denselben Kontext; die KI „kennt“ das Projekt und die Qualitätsanforderungen. SQM kann die KI gezielt in **agentischer** Form nutzen (mehrstufig): z. B. „Prüfe diesen PR gegen DoD und Backlog, liste Verstöße auf“ oder „Schlage Testfälle für den session-Router vor“.

Konkrete Ansatzpunkte:
- **Cursor Rules:** Eine Rule für SQM-Arbeit (Review-Fokus, DoD, Teststrategie) neben der bestehenden Architektur-Rule.
- **PR-/DoD-Check:** Manuell („Cursor, prüfe diesen Diff gegen DoD“) oder später automatisiert (z. B. GitHub Action mit LLM), damit SQM konsistent prüfen kann.
- **Test-/Review-Vorlagen:** Prompts in `docs/vibe-coding/` für „Review-Check für PR“ und „Testfälle für Procedure X“, damit beide Kurse und die KI dieselben Maßstäbe anlegen.

---

## 4. Kurzfassung

| Aspekt | Inhalt |
|--------|--------|
| **Synergie** | Ein Produkt (arsnova.eu). Kurs 1 entwickelt, Kurs 2 (SQM) trägt die **Qualitätsverantwortung** und arbeitet **parallel** mit. |
| **SQM-Rolle** | Teststrategie, E2E-, Last- und Performancetests, Reviews, DoD, Metriken/Audits, Sicherheit, Datenschutz (DSGVO), **UI/UX (Lautes Denken)**, **KI-Reader-Nutzbarkeit**, **Nutzungsanleitung mit Guidde**, Prozesse – am gleichen Repo und Backlog. |
| **Agentische KI** | Gemeinsamer Kontext für beide; Entwicklung nutzt KI für Implementierung, SQM für Review, DoD-Check, Tests und Checklisten (inkl. mehrstufige Agent-Nutzung). |

Nächste Schritte (optional): Cursor-Rule für SQM (Review/DoD-Fokus), Review- und Test-Prompt-Vorlagen in `docs/vibe-coding/`, klare Zuordnung von Qualitäts-Stories im Backlog oder in `Backlog-SQM.md` mit Verlinkung zum Haupt-Backlog.
