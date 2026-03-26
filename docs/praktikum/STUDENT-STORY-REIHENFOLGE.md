# Didaktische Reihenfolge: Offene User Stories (KI codiert, Studi steuert)

**Zielgruppe:** Betreuende, Studierende im Praktikum  
**Voraussetzung:** Jede Person soll **jede offene Story** aus dem Produkt-Backlog **einmal** umsetzen (oder: durch den vollständigen Katalog gehen). Die **Reihenfolge** ist dann entscheidend für **Verständnis**, **Lernkurve** und **Review-Sicherheit**, wenn die **Codierung überwiegend durch KI-Unterstützung** erfolgt und der Studi **überwacht, steuert und abnimmt**.

**Referenz:** [`Backlog.md`](../../Backlog.md) (Status ⬜ Offen).  
**Stand dieser Empfehlung:** 2026-03-26 — bei Änderungen im Backlog Reihenfolge und Begründungen anpassen.

---

## 1. Warum überhaupt eine feste Reihenfolge?

| Aspekt      | Ohne Reihenfolge                                       | Mit didaktischer Reihenfolge                              |
| ----------- | ------------------------------------------------------ | --------------------------------------------------------- |
| Einstieg    | Risiko: große oder sicherheitskritische Stories zuerst | Kleine, prüfbare Schritte am Anfang                       |
| Verständnis | Codebase wirkt „alles gleich wichtig“                  | Aufbau von **Mustern** (Feature → Q&A → Infra → Security) |
| KI-Einsatz  | Schwer zu validieren bei undurchsichtigen Änderungen   | Stories mit **klarer Spezifikation** früh üben            |
| Review      | Betreuende müssen alles gleich tief prüfen             | Spätere Stories erfordern **bewusst** mehr Audit-Zeit     |

**Leitidee:** Zuerst **lernen, KI-Output gegen Anforderungen und Tests zu prüfen**, dann **komplexere Flächen** und zuletzt **hohes Schadenspotenzial** (Security, Querschnitt).

---

## 2. Rollenklärung (didaktisch)

- **Studi:** Versteht die Story, zerlegt in Schritte, formuliert Aufträge an die KI, **liest Diff und Tests**, führt manuelle Checks aus, dokumentiert kurz das Ergebnis.
- **KI:** Implementiert nach Vorgabe; **kein Ersatz** für Abnahme gegen Backlog und DoD.
- **Betreuung:** Reihenfolge durchsetzen oder begründet abweichen; bei Security-/A11y-Stories zusätzliche Review-Luke einplanen.

---

## 3. Empfohlene Reihenfolge (alle offenen Stories)

Die folgende Tabelle ist die **Standard-Reihenfolge** für die **zeitlich aufeinanderfolgende** Vergabe (Ticket 1 → 2 → … → 14).

| Nr. | Story     | Titel (Kurz)                         | Didaktischer Schwerpunkt                       | Warum an dieser Stelle                                                                                                                                                                                                     |
| --- | --------- | ------------------------------------ | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **5.4a**  | Foyer-Einflug, Preset Spielerisch    | Mini-Feature, schnelles Feedback               | **Einstieg:** wenige Dateien, Ergebnis oft visuell/sofort prüfbar; Training im Umgang mit Repo, Branch, CI.                                                                                                                |
| 2   | **1.7a**  | Markdown-Bilder: URL + Lightbox      | Begrenztes UI-Feature, ADR lesen               | **Architektur im Kleinen:** ADR-0015, keine Scope-Explosion; üben: Akzeptanzkriterien aus Backlog abhaken.                                                                                                                 |
| 3   | **8.7**   | Q&A „Beste Fragen“ (Wilson-Score)    | Algorithmus + tRPC + Tests                     | **Spezifikationsgetrieben:** Formel und SQL-Hintergrund in [`docs/features/controversy-score.md`](../features/controversy-score.md); ohne \(N\)-Glättung etwas fokussierter als 8.6; gut **gegen Dokument verifizierbar**. |
| 4   | **8.6**   | Q&A Kontroversitäts-Score            | Gleiche Domäne wie 8.7, mehr Produktentscheide | **Aufbau:** gleiche Q&A-Basis; zusätzlich \(N\) für Glättung, Badge/Schwellen, i18n — **nach** 8.7, wenn Sortier-/Score-Muster schon verstanden sind.                                                                      |
| 5   | **6.6**   | UX Thinking Aloud & Umsetzung        | Methode, Findings, iterative UX                | **Methodenkompetenz:** weniger „ein Algorithmus“, mehr Testprotokoll und gezielte UI-Anpassungen; bricht reine Code-Linie bewusst auf.                                                                                     |
| 6   | **8.5**   | Delegierbare Q&A-Moderation          | Rollen, Tokens, Rechte, UI                     | **Komplexes Feature** mit vielen Schichten; sinnvoll, wenn Q&A (8.6/8.7) bereits vertraut ist.                                                                                                                             |
| 7   | **0.7**   | Last- & Performance-Tests (E2E)      | Tooling, CI, Metriken                          | **Qualitätsschicht:** weniger Produktlogik, mehr Infra-Verständnis; sinnvoll, wenn Features aus vorherigen Tickets bekannt sind.                                                                                           |
| 8   | **1.6d**  | Sync-Performance & Skalierung        | Messen, Profiling, Hypothesen                  | **Nicht-trivial „fertig“:** Lernziel ist evidenzbasierte Optimierung, nicht nur „Code ändern“.                                                                                                                             |
| 9   | **1.2d**  | Numerische Schätzfrage               | Voller Fragentyp End-to-End                    | **Domänentiefe:** Backend, Shared-Types, UI, Auswertung — hoher Koordinationsaufwand; besser mit Codebase-Erfahrung.                                                                                                       |
| 10  | **1.14a** | Word Cloud 2.0                       | Layout, UX, Performance                        | **Große UX-Fläche**, viele Feinschliff-Runden; braucht Geduld und klare Abnahme-Kriterien.                                                                                                                                 |
| 11  | **1.7b**  | Markdown/KaTeX-Editor, MD3-Toolbar   | Großes Editor-Feature                          | **Viele Kantenfälle** und UI-Zustände; KI-Output hier besonders kritisch lesen.                                                                                                                                            |
| 12  | **2.1c**  | Host-/Presenter-Session-Token härten | Security, Bedrohungsmodell                     | **Hohes Risiko bei Fehlern** — Review-Zeit einplanen; Pair-Review mit Betreuung empfohlen.                                                                                                                                 |
| 13  | **1.6c**  | Sync-Sicherheit härten               | Security, verteilte Logik                      | Ebenfalls **Security**; von 1.6d/2.1c konzeptionell profitieren, aber eigenständiges Audit nötig.                                                                                                                          |
| 14  | **6.5**   | Barrierefreiheit (Projektende)       | Querschnitt, Standards, Tests                  | **Am Ende:** greift in viele bestehende Oberflächen; sinnvoll, wenn der Großteil der Features steht.                                                                                                                       |

---

## 4. Phasen (übergeordnet)

Zur Orientierung für die Betreuung — nicht separate „Pflicht“, sondern **Lernbogen**:

1. **Phase A (1–2):** Sicherer Umgang mit Repo, kleinen Features, ADRs.
2. **Phase B (3–4):** Q&A-Scores, Spezifikation lesen, Backend/Frontend/tRPC durchgängig.
3. **Phase C (5–6):** Methodik + komplexes Feature mit Rollen.
4. **Phase D (7–8):** Qualität und Performance ohne neues Nutzer-Feature im Mittelpunkt.
5. **Phase E (9–11):** Große Produktfeatures, hoher Integrationsaufwand.
6. **Phase F (12–14):** Security und Barrierefreiheit — **maximale Sorgfalt** beim Review.

---

## 5. Abnahme-Checkliste pro Story (für den Studi)

Kurz und wiederholbar — unabhängig von der Story-Nummer:

- [ ] Akzeptanzkriterien aus `Backlog.md` erfüllt (oder Abweichung dokumentiert und mit Betreuung abgestimmt).
- [ ] `shared-types` / Zod bei tRPC-Eingaben und -Ausgaben konsistent (`AGENT.md`, Monorepo-Regeln).
- [ ] Tests grün; bei neuem Verhalten sinnvolle Specs ergänzt.
- [ ] UI-Texte: bei deutschen Änderungen **alle** Zielsprachen nachgezogen (ADR-0008), sofern Story UI berührt.
- [ ] Kein blindes Merge: **Diff gelesen**, keine offensichtlichen Sicherheits- oder Datenlecks.

---

## 6. Abweichungen von der Reihenfolge

Erlaubt, wenn **begründet**, z. B.:

- **6.6** früher einsetzen, wenn eine Person **explizit UX/Methoden** stärken soll (parallel zu technischen Tickets einer anderen Person ist möglich, widerspricht aber nicht dem „jede Story einmal“-Prinzip, solange alle Stories durchlaufen werden).
- Backlog-**Priorität** (🔴 Must) zwingt zur Vorderei — dann Reihenfolge mit Betreuung neu bewerten und dieses Dokument aktualisieren.

---

## 7. Verknüpfungen

| Dokument                                                                 | Inhalt                                          |
| ------------------------------------------------------------------------ | ----------------------------------------------- |
| [`Backlog.md`](../../Backlog.md)                                         | Story-Liste, Status, Akzeptanzkriterien         |
| [`docs/features/controversy-score.md`](../features/controversy-score.md) | Kontroversität (8.6), Wilson (8.7), Hintergrund |
| [`docs/praktikum/PRAKTIKUM.md`](./PRAKTIKUM.md)                          | Rahmen Praktikum, Bewertung, Ablauf             |
| [`AGENT.md`](../../AGENT.md)                                             | Arbeitsweise mit KI im Editor                   |

---

_Diese Datei beschreibt eine **didaktische** Empfehlung; die fachliche Priorisierung im Produkt bleibt im Backlog und bei Product Owner / Leitung._
