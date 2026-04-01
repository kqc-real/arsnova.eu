<!-- markdownlint-disable MD013 MD022 MD032 -->

# Praktikum Softwarequalitätsmanagement (SQM) am Projekt arsnova.eu

**Für Studierende** · **Umfang:** in der Regel **10 Termine à 4 Stunden** (ca. **40 Stunden** Planungsgröße — exakte Vorgabe gibt die **Betreuung** in der Veranstaltung)

## Inhaltsverzeichnis

1. [Was ist arsnova.eu?](#1-was-ist-arsnovaeu-kurzüberblick)
2. [Deine Rolle](#2-deine-rolle-im-sqm-praktikum)
3. [Lernziele](#3-lernziele)
4. [Zeitmodell](#4-zeitmodell-10--4-stunden-orientierung)
5. [Bewertete Leistung](#5-bewertete-leistung-orientierung--feinabstimmung-mit-betreuung)
6. [Aufgabenfelder im Detail](#6-aufgabenfelder-im-detail-spickzettel)
7. [Agentische KI](#7-agentische-ki--sinnvoll-für-sqm)
8. [10-Block-Plan](#8-vorschlag-10-blöcke--4-stunden-sqm)
9. [Bewertung](#9-bewertung-transparent)
10. [FAQ](#10-faq)
11. [Abgabe-Checkliste](#11-abgabe-checkliste)
12. [Literatur](#12-literatur--links-im-repo)
13. [Übungsaufgaben](#13-übungsaufgaben)

Willkommen. Dieses Dokument ist die **Arbeitsgrundlage** für dein SQM-Praktikum an **arsnova.eu**. Du bist **kein** „externer Tester am fertigen Produkt“, sondern arbeitest mit einem klaren Qualitätsauftrag im laufenden Projekt.

**Wenig Vorerfahrung mit Git, GitHub, Pull Requests oder dem Tech-Stack?** Lies **[`EINSTIEG-TOOLS-UND-STACK.md`](./EINSTIEG-TOOLS-UND-STACK.md)** (Abschnitt zu SQM) und richte die Umgebung wie in [`docs/onboarding.md`](../onboarding.md) ein — für Reviews brauchst du den Code lokal oder zumindest lesbar auf GitHub.

### Einstieg und Produktkontext

Wenn dir für Reviews noch Produktkontext fehlt, starte mit diesen Dokumenten:

- [`README.md`](../../README.md)
- [`Backlog.md`](../../Backlog.md)
- [`docs/didaktik/greenfield-demo-1-7a-vorlesung.md`](../didaktik/greenfield-demo-1-7a-vorlesung.md)

---

## 1. Was ist arsnova.eu? (Kurzüberblick)

Eine **Web-App** für **Live-Quiz**, **Abstimmungen**, **Freitext**, **Q&A** u. a. — **Mobile-first**, **tRPC**-API, **Angular** mit **Signals**, strenge **Zod**-Schemas in `libs/shared-types`, **DTO/Data-Stripping** für Sicherheit.

| Bereich                  | Pfad / Technik                                                                                   |
| ------------------------ | ------------------------------------------------------------------------------------------------ |
| Frontend                 | `apps/frontend/` — Angular (Standalone, Signals), Angular Material 3                             |
| Backend                  | `apps/backend/` — Node.js, tRPC, Prisma, Redis                                                   |
| Gemeinsame API-Typen     | `libs/shared-types/` — Zod (verbindlich für tRPC)                                                |
| Architektur-Kurzreferenz | [`docs/architecture/handbook.md`](../architecture/handbook.md)                                   |
| Produkt-Backlog          | [`Backlog.md`](../../Backlog.md)                                                                 |
| Tests & CI               | [`docs/TESTING.md`](../TESTING.md), [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) |

**Erste Schritte:** [`docs/onboarding.md`](../onboarding.md), [`AGENT.md`](../../AGENT.md), [`CONTRIBUTING.md`](../../CONTRIBUTING.md).

---

## 2. Deine Rolle im SQM-Praktikum

Du trägst **mit**, dass das **gemeinsame** Produkt **messbar** und **nachvollziehbar** gut wird — **parallel** zu Feature-PRs, nicht erst „nach dem Release“.

**Typische Aufgaben** (du wählst mit der Betreuung einen **fokussierten** Schwerpunkt; Details folgen in Abschnitt 6):

- **Teststrategie** und **Tests** (Vitest Backend/Frontend, ggf. neue Fälle für kritische Pfade).
- **E2E-Tests** (Konzept + erste Automatisierung für Kern-Flows; Toolwahl z. B. Playwright/Cypress — siehe [Angular E2E](https://angular.dev/tools/cli/end-to-end)).
- **Performance & Last** (Lighthouse, Chrome DevTools; Last-Szenarien — siehe Backlog **Story 0.7**).
- **Reviews** von PRs gegen **DoD** und Architektur (Zod, DTO, keine Secrets, A11y-Grundlagen).
- **Qualitätsmetriken** (Abdeckung, Linter, Lighthouse-A11y — transparent dokumentieren).
- **Sicherheit & Abhängigkeiten** (`npm audit`, keine high/critical laut Projektziel — siehe DoD).
- **Datenschutz (DSGVO)** anhand der Projektregeln (Datensparsamkeit, Session-Lebensdauer, siehe [`docs/SECURITY-OVERVIEW.md`](../SECURITY-OVERVIEW.md)).
- **UI/UX: Lautes Denken (Think Aloud)** — Planung, Durchführung, Auswertung, **konkrete** Verbesserungsvorschläge.
- **Nutzbarkeit mit KI-Readern** (Browser-/Extension-Reader auf kritischen Flows).
- **Nutzungsanleitung** mit **Guidde** (geführte Tutorials für Lehrende und Teilnehmende).
- **Prozesse** (Review-Rhythmus, Definition „qualitätsseitig abgenommen“, Checklisten).

**Wichtig:** Du **blockierst** die Entwicklung nicht unnötig — du **machst Qualität sichtbar** und **hilfst**, Fehler **früh** zu finden.

---

## 3. Lernziele

Nach dem Praktikum kannst du typischerweise:

- **Qualitätsziele** für ein reales Web-Produkt **formulieren** und an **DoD** und **Backlog** **koppeln**.
- **Tests** und **manuelle** Prüfungen **planen**, **durchführen** und **dokumentieren** (reproduzierbar).
- **Pull Requests** **sachlich** gegen **Architektur- und Sicherheitsregeln** prüfen — ohne „Geschmacks-Reviews“.
- **Usability** mit einer **standardisierten Methode** (Think Aloud) **vorbereiten** und **auswerten**.
- **KI-gestützte Werkzeuge** (z. B. Cursor) **zielgerichtet** für **Review**, **Checklisten** und **Testideen** nutzen — und **Grenzen** benennen.
- Im **Monorepo** **sinnvoll committen** (Tests, Docs, CI, keine unnötigen Feature-Umbauten ohne Absprache).

---

## 4. Zeitmodell: 10 × 4 Stunden (Orientierung)

Die **40 Stunden** sind eine **Richtgröße**. Zeit für **Lesen**, **Reviews**, **Abstimmung mit der Betreuung** und **Auswertung** ist **explizit** eingeplant — nicht jede Stunde ist „nur Code“.

**Empfehlung:** Pro Block **3–5 Sätze Protokoll**: Ziel, Erreichtes, Blocker, nächster Schritt.

---

## 5. Bewertete Leistung (Orientierung — Feinabstimmung mit Betreuung)

Die Betreuung legt die **exakte Gewichtung** fest. Üblich ist ein **Paket aus Konzept + nachweisbaren Artefakten + Reflexion**.

### 5.1 Konzeption (schriftlich)

Eine **klare**, **studentenverständliche** Ausarbeitung (oft **4–8 Seiten** inkl. Abbildungen/Tabellen):

1. **Qualitätsziele** für arsnova.eu in **deinem** Praktikumszeitraum (messbar oder überprüfbar formulieren).
2. **Teststrategie** (Was wird **automatisch** geprüft? Was **manuell**? Warum?)
3. **Risiken** (z. B. WebSocket, viele Teilnehmer, Datenschutz, Mobile) und **wie** ihr sie **adressiert**.
4. **Zusammenarbeit im Projektkontext** (Kommunikation, PRs, Backlog).
5. **Abgrenzung:** Was ist in **40 h** **realistisch** — was ist **Ausblick**?

### 5.2 Praktische Artefakte (Portfolio)

**Mindestens zwei bis drei** der folgenden **Bausteine** solltest du **konkret** liefern (in **Absprache** mit der Betreuung festlegen):

| Baustein                       | Beispiel für ein „fertiges“ Artefakt                                                                  |
| ------------------------------ | ----------------------------------------------------------------------------------------------------- |
| **Tests**                      | Erweiterung oder neue Vitest-Specs; nachvollziehbare Testfälle, PR mit grünen Tests                   |
| **E2E**                        | Konzeptdokument + erste automatisierte Szenarien (z. B. Join → Vote) im Repo oder angehängt           |
| **Performance / Lighthouse**   | Messprotokoll (Vorher/Nachher oder Vergleich Routen), **konkrete** Empfehlungen                       |
| **Last / Skalierung**          | Szenario beschreiben (z. B. k6/Artillery — siehe ADR-0013), Ergebnis **oder** belastbare Pilotmessung |
| **Review / DoD**               | **Review-Checkliste** (Markdown im Repo) + **Beispiel-Review** (anonymisiert oder verlinkter PR)      |
| **Think Aloud**                | Leitfaden, **N≥3** Sessions (wenn möglich), Auswertung, **Top-3** UX-Maßnahmen                        |
| **KI-Reader**                  | Testmatrix (Tool, Flow, Ergebnis), **konkrete** UI-/A11y-Empfehlungen                                 |
| **Guidde**                     | **Veröffentlichter** oder exportierter Guide + Kurzbeschreibung Zielgruppe und Abdeckung              |
| **CI / Qualitätssichtbarkeit** | Kleine CI-Erweiterung oder Dokumentation „wie wir Qualität im PR sehen“                               |

**Qualitätsanforderungen:**

- **Nachvollziehbarkeit:** Jemand anderes im Kurs kann deine Schritte **nachvollziehen** (Befehle, Links, Pfade).
- **Respekt vor dem Repo:** Keine **großen** Refactorings „nebenbei“; Fokus auf **Qualität**, Features nur nach **Absprache**.
- **Keine Secrets** in Commits; **keine** personenbezogenen Rohdaten aus echten Sessions **öffentlich** ablegen.

### 5.3 Reflexion **agentische** / KI-gestützte Arbeit

Kurzer Abschnitt (**1–3 Seiten**):

- Welche **Prompts** oder **Agenten-Workflows** hast du genutzt (Review, Testfälle, Checklisten)?
- **Wo** hat die KI **Zeit gespart** — **wo** hat sie **Unsinn** vorgeschlagen?
- **Wie** hast du **verifiziert** (Tests, Diffs, zweite Person)?

---

## 6. Aufgabenfelder im Detail (Spickzettel)

### 6.1 Automatisierte Tests (Vitest)

- **Backend:** `apps/backend/src/__tests__/` — tRPC-Router, Session-Lifecycle, DTO-Stripping.
- **Frontend:** `apps/frontend/src/app/**/*.spec.ts` — Komponenten, Services.
- **Lokal:** `npm test` (Root) — siehe [`docs/TESTING.md`](../TESTING.md).

**Idee:** Ein neuer Test, der eine **konkrete Risiko-Story** absichert (z. B. Regression nach Feature-PR), ist oft **wertvoller** als viele oberflächliche Tests.

### 6.2 E2E (End-to-End)

- Offizielle Angular-Übersicht: [End-to-End Testing](https://angular.dev/tools/cli/end-to-end).
- Sinnvolle **erste** Szenarien: **Beitritt** mit Code, **eine** Abstimmung, **Ergebnis** sichtbar; ggf. **Host-Lobby**.

**Merke:** E2E ist **flaky**-anfällig — stabile **Selektoren**, wenige **Wartezeiten**, klare **Testdaten**.

### 6.3 Performance & Lighthouse

- Angular-Hinweise: [Profiling mit Chrome DevTools](https://angular.dev/best-practices/profiling-with-chrome-devtools).
- Projektbezug: Budget-Warnungen beim Build, Mobile-First — [`docs/ui/LIGHTHOUSE-PERFORMANCE.md`](../ui/LIGHTHOUSE-PERFORMANCE.md) (falls vorhanden) oder eigene Messnotizen.

### 6.4 Last & Skalierung

- Backlog: **Story 0.7** (Last- & Performance-Tests mit E2E-Szenarien).
- ADR: [`docs/architecture/decisions/0013-use-k6-and-artillery-for-load-and-performance-testing.md`](../architecture/decisions/0013-use-k6-and-artillery-for-load-and-performance-testing.md).

### 6.5 Reviews & DoD

- **DoD:** Abschnitt in [`Backlog.md`](../../Backlog.md) und die Arbeitsregeln in [`CONTRIBUTING.md`](../../CONTRIBUTING.md).
- **Sicherheits-Denke:** [`docs/SECURITY-OVERVIEW.md`](../SECURITY-OVERVIEW.md), DTO-Stripping.
- **UI-Review:** [`docs/ui/PR-CHECKLIST-UI.md`](../ui/PR-CHECKLIST-UI.md), [`docs/ui/STYLEGUIDE.md`](../ui/STYLEGUIDE.md).

### 6.6 Think Aloud (Lautes Denken)

- **Vorbereitung:** Aufgaben aus Sicht von Lehrenden und Teilnehmenden, **keine** Führung durch die Testperson.
- **Dokumentation:** Kurzprotokoll, **Zitate** (anonymisiert), **Priorisierung** der Findings.

### 6.7 KI-Reader / Vorlese-Assistenten

- **Ziel:** Kritische Flows mit **mindestens einem** gängigen Setup testen (Browser oder Erweiterung — laut Vorgabe Betreuung).
- **Output:** Tabelle „Schritt / erwartetes Verhalten / beobachtetes Verhalten / Schweregrad“.

### 6.8 Guidde (Nutzungsanleitung)

- [Guidde](https://www.guidde.com/) — geführte **visuelle** Anleitungen.
- **Abgabe:** Link oder Export + **Kurztext**, welche **Rolle** und welche **Flows** abgedeckt sind.

---

## 7. Agentische KI — sinnvoll für SQM

Die KI „ersetzt“ **kein** Review — sie **unterstützt** Lesen und Strukturieren.

| Aufgabe               | Beispiel-Prompt-Richtung                                                            | Pflicht: Mensch prüft |
| --------------------- | ----------------------------------------------------------------------------------- | --------------------- |
| PR gegen DoD          | „Liste Verstöße gegen DTO-Stripping und Zod-Pflicht anhand dieses Diffs.“           | Ja                    |
| Testfälle             | „Schlage Vitest-Fälle für Router X vor; keine Implementierung ohne meine Freigabe.“ | Ja                    |
| Checkliste            | „Erstelle Review-Checkliste für Angular-Signals + tRPC-Frontend.“                   | Ja                    |
| Think-Aloud-Leitfaden | „Entwirf eine Aufgabenstellung für Erstnutzer:innen in 5 Schritten.“                | Ja                    |

**Nützlicher Kontext:** [`AGENT.md`](../../AGENT.md), [`docs/architecture/handbook.md`](../architecture/handbook.md).

---

## 8. Vorschlag: 10 Blöcke à 4 Stunden (SQM)

| Block  | Schwerpunkt                    | Artefakte (Beispiel)                                                          |
| ------ | ------------------------------ | ----------------------------------------------------------------------------- |
| **1**  | Onboarding + Modell            | Repo bauen, `npm test`, ein Flow manuell; **1 Seite** Rollenverständnis       |
| **2**  | DoD & Risiken                  | DoD extrahieren, **Risikoliste** Top-5                                        |
| **3**  | Testlandschaft                 | Karte: welche Tests wo; **Lücke** wählen                                      |
| **4**  | Umsetzung Test/Qualität        | PR mit Specs oder Doc; Review-Checkliste **v1**                               |
| **5**  | E2E-Konzept                    | Toolwahl begründen, **2–3** Szenarien beschrieben                             |
| **6**  | E2E-Implementierung            | Erste lauffähige Tests (oder Prototyp + offene Punkte dokumentiert)           |
| **7**  | Performance/A11y               | Lighthouse auf **2** Routen, **konkrete** Findings                            |
| **8**  | Think Aloud **oder** KI-Reader | Durchführung + **kurze** Auswertung **oder** Reader-Matrix                    |
| **9**  | Guidde **oder** Last/CI        | Guide-Link **oder** Last-Szenario-Skizze (0.7/ADR-0013)                       |
| **10** | Abgabe                         | Konzept + Portfolio + KI-Reflexion; **kurze** Präsentation (falls vorgesehen) |

**Wenn Zeit knapp wird:** Priorität **Tests/Review-Checkliste** + **eine** qualitative Methode (Think Aloud **oder** KI-Reader).

---

## 9. Bewertung (transparent)

Orientierung — **exakte Gewichtung** durch die Betreuung:

| Kriterium               | Was geprüft wird                                               |
| ----------------------- | -------------------------------------------------------------- |
| **Konzept**             | Klare Ziele, Strategie, Risiken, Zusammenarbeit                |
| **Artefakte**           | Nachvollziehbar, relevant, sauber eingebunden ins Repo/Prozess |
| **Methodik**            | Think Aloud / Reader / E2E **regelkonform** und auswertbar     |
| **Technische Qualität** | Tests/CI-Impact **ohne** Chaos im Codebase                     |
| **KI-Reflexion**        | Kritisch, ehrlich, nachvollziehbar                             |

---

## 10. FAQ

**Darf ich Feature-Code ändern?**  
Nur in **Absprache** oder wenn ihr **gemeinsam** im PR arbeitet. SQM-Fokus: **Qualität**, nicht „nebenbei umbauen“.

**Was, wenn gerade wenige PRs oder Features vorliegen?** Dann **vertiefst** du Reviews, Metriken, Dokumentation und E2E-Infrastruktur — **ohne** künstlich neue Features zu fordern.

**Muss ich alles aus Abschnitt 6 machen?**  
Nein — du wählst mit der Betreuung ein **schlankes**, **beweisbares** Paket.

**Wo melde ich Sicherheitsbedenken?**  
Sofort an die **Betreuung**; keine öffentlichen Issue-Details zu **Exploits** ohne Absprache.

---

## 11. Abgabe-Checkliste

- [ ] Konzeptdokument (PDF oder Markdown im Repo nach Absprache)
- [ ] Portfolio-Artefakte (Links, PRs, Guidde, Messprotokolle)
- [ ] `npm test` / CI-relevante Checks **grün** (für **deine** Änderungen)
- [ ] Reflexion **KI-Einsatz**
- [ ] Kurze **Demo** oder **Walkthrough** (falls verlangt)

---

## 12. Literatur / Links im Repo

- [`README.md`](../../README.md) — Produktüberblick und Setup-Einstieg
- [`docs/TESTING.md`](../TESTING.md) — Befehle, CI
- [`Backlog.md`](../../Backlog.md) — DoD, Story **0.7**, **6.5**, **6.6**
- [`docs/SECURITY-OVERVIEW.md`](../SECURITY-OVERVIEW.md)
- [`docs/vibe-coding/`](../vibe-coding/) — Prompt-Beispiele (optional erweiterbar)

**Viel Erfolg — Qualität ist Teamarbeit.**

---

## 13. Übungsaufgaben

**Arbeitsweise:** Zuerst **selbst** Antworten skizzieren, dann mit den **Musterlösungen** vergleichen.

### Aufgabe 1 — DoD vs. Feature-Wunsch

Ein Entwicklungsteam möchte **schnell** mergen: „Nur noch ein kleines UI-Tuning, **kein** neuer Test.“ Die **DoD** verlangt aber für neue Logik **Tests**.

**Frage:** Wie argumentierst du in einem **Review** sachlich — **ohne** den Kolleg:innen das Gefühl zu geben, du blockierst „aus Prinzip“?

---

### Aufgabe 2 — Risiko → Maßnahme

Nenne **zwei** konkrete **Risiken** für arsnova.eu (z. B. WebSocket bricht ab, `isCorrect` leak, Mobile-Layout) und je **eine** **prüfbare** Maßnahme (Test, Review-Punkt, manueller Check).

---

### Aufgabe 3 — Think Aloud (Kurzplan)

Du willst **Lehrende** beim **ersten** Session-Start beobachten. Skizziere in **fünf Stichpunkten**, wie du **Aufgabe**, **Einführung**, **Beobachtung**, **Nachgespräch** und **Datenschutz** planst (keine Namen in der öffentlichen Abgabe).

---

### Aufgabe 4 — KI im Review

Du nutzt einen KI-Chat: „Finde Sicherheitslücken in diesem Diff.“ Die KI behauptet, ein String-Vergleich sei „timing-safe“ nötig.

**Frage:** Welche **drei Schritte** unternimmst du, **bevor** du das Ergebnis ins Review übernimmst?

---

### Musterlösungen

**Zu 1:** Kernaussage: DoD ist **gemeinsame** Qualitätsvereinbarung; kleine Änderungen können **Regressionen** verursachen. Vorschlag: **Risiko einordnen** (nur CSS vs. Logik), ggf. **bestehenden** Test erweitern oder **explizite** Ausnahme mit **Ticket** und **Frist**. Ton: **konstruktiv**, **Alternative** anbieten.

**Zu 2:** Beispiel — (a) WebSocket-Reconnect: **Integrationstest** oder manueller **Chaos-Test** dokumentieren; (b) DTO: **bestehende** `dto-security`-Specs als **Review-Check** bei Router-Änderungen; (c) Mobile: **Lighthouse** + **Think-Aloud** auf kleinem Viewport.

**Zu 3:** Aufgabe klar (**ohne** Führung); **Einwilligung** und **Anonymisierung**; stilles Beobachten **oder** lautes Denken je nach Methode; **Notizen** statt Video ohne Zustimmung; **Dank** + **Zusammenfassung** nur aggregiert in der Abgabe.

**Zu 4:** (1) **Diff selbst** ansehen — trifft die Aussage zu? (2) **Offizielle** Quellen / Team fragen — kein Blindvertrauen. (3) **Nur** verifizierte Punkte ins Review; **spekulative** KI-Hinweise als **Frage** formulieren, nicht als Befund.

---

_Stand: 2026-04-01 · Pflege bei Änderungen am SQM-Setup: dieses Dokument und Verweis in `docs/README.md` anpassen._
