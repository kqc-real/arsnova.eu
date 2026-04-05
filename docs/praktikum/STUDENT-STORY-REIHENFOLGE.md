<!-- markdownlint-disable MD060 -->

# Didaktische Reihenfolge: Offene User Stories

**Zielgruppe:** Betreuende, Studierende im Praktikum  
**Voraussetzung:** Die folgende Reihenfolge richtet sich nach den **aktuell offenen Stories** im Produkt-Backlog. Bereits erledigte Stories sind aus der studentischen Ticketstrecke entfernt; das betrifft jetzt insbesondere **2.1c**, die im Backlog als **✅ Fertig** geführt wird. **Story 1.7a** bleibt ein Sonderfall: Wenn die **Greenfield-Demo** (3×45 Min.) die Story inhaltlich vollständig abdeckt, gehört sie **nicht** zur regulären studentischen Ticketstrecke; andernfalls wird sie direkt vor **1.7b** eingeschoben. **Epic 10 (MOTD)** bleibt im Repo **bereits fertig** und dient bei Bedarf als Referenzcode. Die **Reihenfolge** bleibt entscheidend für **Verständnis**, **Lernkurve** und **Review-Sicherheit**, wenn die **Umsetzung überwiegend mit KI-Unterstützung** erfolgt und die studierende Person **überwacht, steuert und abnimmt**.

**Verbindlicher Rahmen:** Jede studierende Person bearbeitet die **gesamte Ticketstrecke** in der hier empfohlenen Reihenfolge. Der frühere Regelfall **„Pflichtkern + Vertiefungspfad“** gilt für dieses Dokument nicht mehr.

**Referenz:** [`Backlog.md`](../../Backlog.md) (Status ⬜ Offen).  
**Stand dieser Empfehlung:** 2026-04-05 — bei Änderungen im Backlog Reihenfolge und Begründungen anpassen.

## Kurz gesagt

Wenn du nur wissen willst, **was das für dich praktisch heißt**, dann ist der Regelfall:

- Du bearbeitest **alle Tickets dieser Liste** selbst.
- Du startest nach der Vorlesungs-Demo mit **5.4a** und gehst die Liste dann **in Reihenfolge** durch.
- **2.1c** ist aus der studentischen Strecke herausgenommen, weil die Story laut Backlog bereits umgesetzt ist.
- **1.7a** kommt nur dann als zusätzliches Ticket dazu, wenn die Vorlesungs-Demo die Story **nicht** vollständig abdeckt.
- Die Strecke ist didaktisch bewusst aufgebaut: **kleiner Einstieg → Q&A-Logik → größere Produktflächen → Qualität/Querschnitt → Security-Härtung**.

---

## 0. Einstieg: Greenfield 1.7a — diese Story ist nur bei Bedarf Teil der Ticketstrecke

Der Einstieg beginnt mit einer **Greenfield-Demo** am Beamer: **Story 1.7a** (Markdown-Bilder: nur URL + Lightbox) — **3×45 Minuten** (135 Min.), Leitfaden: [`docs/didaktik/greenfield-demo-1-7a-vorlesung.md`](../didaktik/greenfield-demo-1-7a-vorlesung.md).

- **Lehrperson** und **KI-Agent** zeigen **Ende-zu-Ende**: Backlog-Akzeptanzkriterien → [ADR-0015](../architecture/decisions/0015-markdown-images-url-only-and-lightbox.md) → Angular/Markdown-Pipeline → Lightbox → i18n/Tests (soweit in der Zeit reicht).
- **Parallel:** Mini-Inputs **VS Code**, **Git**, **GitHub**, **Stack** (TypeScript, Angular, Monorepo — nach Terminplan).
- **Studierende** bearbeiten **1.7a nicht** als eigene Praktikums-Story, wenn die Demo diese Story **inhaltlich vollständig abdeckt**.
- Wenn die Demo **nicht** ausreicht, wird **1.7a** als **zusätzliches Ticket direkt vor 1.7b** in die Reihenfolge aufgenommen.
- **Epic 10 (MOTD)** dient **optional** als **zweites** Referenzbeispiel (fertiger Full-Stack-Strang: Spec, ADR-0018, `motd`-Router) — **nicht** Ersatz für die 1.7a-Greenfield-Demo.

---

## 1. Warum überhaupt eine feste Reihenfolge?

| Aspekt      | Ohne Reihenfolge                                       | Mit didaktischer Reihenfolge                           |
| ----------- | ------------------------------------------------------ | ------------------------------------------------------ |
| Einstieg    | Risiko: große oder sicherheitskritische Stories zuerst | Kleine, prüfbare Schritte am Anfang                    |
| Verständnis | Codebase wirkt „alles gleich wichtig“                  | Aufbau von **Mustern** (Feature → Q&A → UI → Qualität) |
| KI-Einsatz  | Schwer zu validieren bei undurchsichtigen Änderungen   | Stories mit **klarer Spezifikation** früh üben         |
| Review      | Betreuende müssen alles gleich tief prüfen             | Spätere Stories erfordern **bewusst** mehr Audit-Zeit  |

**Leitidee:** Zuerst **lernen, KI-Output gegen Anforderungen und Tests zu prüfen**, dann **komplexere Produktflächen**, dann **Querschnitt und Qualität** und zuletzt **hohes Schadenspotenzial** (Security, verteilte Logik).

---

## 2. Rollenklärung (didaktisch)

Kurz übersetzt:

- **Du** steuerst, prüfst und dokumentierst.
- **Die KI** hilft beim Umsetzen, entscheidet aber nicht über Richtigkeit.
- **Die Betreuung** hilft bei Scope, Reihenfolge und riskanten Themen.

- **Studierende Person:** Versteht die Story, zerlegt sie in Schritte, formuliert Aufträge an die KI, **liest Diff und Tests**, führt manuelle Checks aus und dokumentiert kurz das Ergebnis.
- **KI:** Implementiert nach Vorgabe; **kein Ersatz** für Abnahme gegen Backlog und DoD.
- **Betreuung:** Reihenfolge durchsetzen oder begründet abweichen; bei Security-/Querschnitts-Stories zusätzliche Review-Zeit einplanen.

---

## 3. Verbindliche Reihenfolge aller Studententickets

Die folgende Struktur listet die **offenen, für Studierende relevanten Stories** didaktisch geordnet. **Epic 10 (MOTD)** bleibt herausgenommen, weil es laut Backlog bereits fertig ist. **2.1c** ist ebenfalls entfernt, weil die Story inzwischen umgesetzt ist. **1.7a** ist nur dann Teil der Strecke, wenn sie nicht schon durch die Greenfield-Demo vollständig abgedeckt wurde.

### 3.1 Verbindliche Ticketstrecke

| Nr. | Story     | Titel (Kurz)                           | Didaktischer Schwerpunkt                  | Warum genau hier?                                                                                                                                            |
| --- | --------- | -------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | **5.4a**  | Foyer-Einflug, Preset Spielerisch      | Mini-Feature, schnelles Feedback          | **Einstieg:** wenige Dateien, sofort sichtbares Ergebnis, gute Übung für sauberes Arbeiten mit UI, Tests und Review.                                         |
| 2   | **8.6**   | Q&A Kontroversitäts-Score              | Algorithmus + tRPC + Produktlogik         | **Erste formelbasierte Erweiterung:** fachlich klar beschrieben, gut gegen [`docs/features/controversy-score.md`](../features/controversy-score.md) prüfbar. |
| 3   | **8.7**   | Q&A „Beste Fragen“ (Wilson-Score)      | Statistik, Ranking, Tests                 | **Aufbau auf 8.6:** gleiche Domäne, aber anspruchsvollere Sortierlogik; sinnvoll, wenn das Muster Score → Query → UI bereits sitzt.                          |
| 4   | **8.5**   | Delegierbare Q&A-Moderation            | Rollen, Tokens, Rechte, UI                | **Domänenvertiefung:** nach den Q&A-Sortierungen folgt die Rechte- und Moderationslogik in derselben Fachfläche.                                             |
| 5   | **1.7b**  | Markdown/KaTeX-Editor, MD3-Toolbar     | Editor-UI, Zustände, i18n                 | **Große UI-Fläche:** baut fachlich auf der 1.7a-Demo auf und fordert saubere Zustandsführung statt nur kleiner Ergänzungen.                                  |
| 6   | **1.14a** | Word Cloud 2.0                         | Layout, UX, Performance                   | **UI-Feinschliff mit Systembezug:** bestehende Oberfläche gezielt weiterentwickeln, inklusive Export-, Layout- und Darstellungsfragen.                       |
| 7   | **1.2d**  | Numerische Schätzfrage                 | Voller Fragentyp End-to-End               | **Breiter Full-Stack-Strang:** neuer Fragentyp über Shared Types, Backend, Session-Flow, Ergebnislogik und UI; daher erst nach mehreren kleineren Tickets.   |
| 8   | **0.7**   | Last- & Performance-Tests (E2E)        | Tooling, Messung, CI, Metriken            | **Qualitätsschicht:** erst sinnvoll, wenn mehrere reale Kernflows verstanden und technisch nachvollzogen wurden.                                             |
| 9   | **1.6d**  | Sync-Performance & Skalierung          | Messen, Profiling, Hypothesen             | **Gezielte Optimierung:** baut auf der Mess- und Testlogik aus 0.7 auf, statt blind an Performanceproblemen zu schrauben.                                    |
| 10  | **6.6**   | UX Thinking Aloud & Umsetzung          | Methode, Findings, iterative Verbesserung | **Methodischer Perspektivwechsel:** nach mehreren Produktflächen ist genug Material da, um Beobachtungen systematisch in Änderungen zu übersetzen.           |
| 11  | **6.5**   | Barrierefreiheit (Prüfung Projektende) | Querschnitt, Audit, A11y                  | **Später Querschnitt:** sinnvoll, wenn die relevanten UI-Flächen bereits stehen und nicht mehr im Stundenrhythmus umgebaut werden.                           |
| 12  | **1.6c**  | Sync-Sicherheit härten                 | Security, verteilte Logik, Review-Tiefe   | **Höchstes Fehlerrisiko:** kommt bewusst zuletzt, wenn Architekturverständnis, Prüfdisziplin und Review-Sorgfalt aufgebaut sind.                             |

### 3.2 Bedingtes Zusatz-Ticket: 1.7a

Wenn die Greenfield-Demo **1.7a** nicht vollständig abdeckt, wird die Story als **zusätzliches Ticket direkt vor 1.7b** eingefügt. Inhaltlich gehört sie in dieselbe Lernstufe wie der Editor-Ausbau, nicht an den Anfang der gesamten Strecke.

---

## 4. Phasen (übergeordnet)

Zur Orientierung für die Betreuung — nicht als Alternativpfade, sondern als **Lernbogen über die komplette Strecke**:

1. **Phase A (1):** Erstes eigenes Feature nach der Vorlesung (**5.4a**).
2. **Phase B (2–4):** Q&A-Logik, Spezifikation, Ranking und Rollen in einer gemeinsamen Fachdomäne.
3. **Phase C (5–7):** Größere Produktflächen mit Editor, Word-Cloud-Ausbau und neuem Fragentyp.
4. **Phase D (8–11):** Qualität, Performance, UX-Auswertung und Barrierefreiheit als Querschnitt.
5. **Phase E (12):** Security-Härtung erst mit aufgebauter Review- und Architekturkompetenz.

---

## 5. Abnahme-Checkliste pro Story

Kurz und wiederholbar — unabhängig von der Story-Nummer:

- [ ] Akzeptanzkriterien aus `Backlog.md` erfüllt (oder Abweichung dokumentiert und mit Betreuung abgestimmt).
- [ ] `shared-types` / Zod bei tRPC-Eingaben und -Ausgaben konsistent (`AGENT.md`, Monorepo-Regeln).
- [ ] Tests grün; bei neuem Verhalten sinnvolle Specs ergänzt.
- [ ] UI-Texte: bei deutschen Änderungen **alle** Zielsprachen nachgezogen (ADR-0008), sofern Story UI berührt.
- [ ] Kein blindes Merge: **Diff gelesen**, keine offensichtlichen Sicherheits- oder Datenlecks.

---

## 6. Abweichungen von der Reihenfolge

Abweichungen sind möglich, aber nur **begründet und dokumentiert**, z. B.:

- Eine Backlog-Änderung verschiebt die fachliche Priorität deutlich; dann muss die Reihenfolge in diesem Dokument mitangepasst werden.
- **1.7a** ist in der Vorlesung nicht ausreichend abgedeckt; dann wird die Story vor **1.7b** eingeschoben.
- Ein technischer Blocker macht eine Vorziehung nötig; auch dann bleibt die Grundlogik erhalten: kleine Features vor Querschnitt, Querschnitt vor Security-Härtung.

---

## 7. Verknüpfungen

| Dokument                                                                                           | Inhalt                                                          |
| -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| [`Backlog.md`](../../Backlog.md)                                                                   | Story-Liste, Status, Akzeptanzkriterien                         |
| [`docs/didaktik/greenfield-demo-1-7a-vorlesung.md`](../didaktik/greenfield-demo-1-7a-vorlesung.md) | **Ablauf 3×45 Min.** Greenfield 1.7a                            |
| [`docs/features/controversy-score.md`](../features/controversy-score.md)                           | Kontroversität (8.6), Wilson (8.7), Hintergrund                 |
| [`docs/praktikum/PRAKTIKUM.md`](./PRAKTIKUM.md)                                                    | Rahmen Praktikum, Bewertung, Ablauf                             |
| [`EINSTIEG-TOOLS-UND-STACK.md`](./EINSTIEG-TOOLS-UND-STACK.md)                                     | **Pflicht-Orientierung** bei fehlender Tool-/Stack-Vorerfahrung |
| [`docs/features/motd.md`](../features/motd.md)                                                     | MOTD, Epic 10 (optional Referenzcode)                           |
| [`AGENT.md`](../../AGENT.md)                                                                       | Arbeitsweise mit KI im Editor                                   |

---

_Diese Datei beschreibt eine **didaktische** Reihenfolge für die studentische Bearbeitung. Die fachliche Priorisierung im Produkt bleibt im Backlog und bei Product Owner bzw. Projektleitung._
