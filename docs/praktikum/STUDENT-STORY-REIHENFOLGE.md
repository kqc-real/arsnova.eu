<!-- markdownlint-disable MD060 -->

# Didaktische Reihenfolge: Offene User Stories

**Zielgruppe:** Betreuende, Studierende im Praktikum  
**Voraussetzung:** Die folgende Reihenfolge richtet sich nach den **aktuell offenen bzw. laufenden Stories** im Produkt-Backlog. Bereits erledigte Stories sind aus der studentischen Ticketstrecke entfernt; das betrifft inzwischen u. a. **5.4a**, **8.6**, **8.7**, **1.7a** und **1.7b**, die im Backlog als **✅ Fertig** geführt werden. **Epic 10 (MOTD)** bleibt im Repo **bereits fertig** und dient bei Bedarf als Referenzcode. **Epic 11** ist ein noch nicht beauftragter Angebots-/Produktpfad und gehört nicht zur Standardstrecke. Die **Reihenfolge** bleibt entscheidend für **Verständnis**, **Lernkurve** und **Review-Sicherheit**, wenn du **überwiegend mit KI-Unterstützung** arbeitest und die Umsetzung **überwachst, steuerst und abnimmst**.

**Verbindlicher Rahmen:** Jede studierende Person bearbeitet die **gesamte Ticketstrecke** in der hier empfohlenen Reihenfolge. Der frühere Regelfall **„Pflichtkern + Vertiefungspfad“** gilt für dieses Dokument nicht mehr.

**Referenz:** [`Backlog.md`](../../Backlog.md) (Status ⬜ Offen).  
**Stand dieser Empfehlung:** 2026-05-31 — bei Änderungen im Backlog Reihenfolge und Begründungen anpassen.

## Kurz gesagt

Wenn du nur wissen willst, **was das für dich praktisch heißt**, dann ist der Regelfall:

- Du bearbeitest **alle Tickets dieser Liste** selbst.
- Du startest nach der Vorlesungs-Demo mit **Ticket 1 der aktuellen Tabelle** und gehst die Liste dann **in Reihenfolge** durch.
- Erledigte Referenzstories wie **5.4a**, **8.6**, **8.7**, **1.7a** und **1.7b** bleiben als Code- und Review-Beispiele nützlich, sind aber **keine** aktuellen Studententickets mehr.
- Die Strecke ist didaktisch bewusst aufgebaut: **überschaubarer Produktausbau → Q&A/Live-Logik → neue Fragentypen → Qualität/Performance → Security-Härtung**.

---

## 0. Einstieg: Greenfield 1.7a — Referenz, kein Studententicket

Der Einstieg beginnt mit einer **Greenfield-Demo** am Beamer: **Story 1.7a** (Markdown-Bilder: nur URL + Lightbox) — **3×45 Minuten** (135 Min.), Leitfaden: [`docs/didaktik/greenfield-demo-1-7a-vorlesung.md`](../didaktik/greenfield-demo-1-7a-vorlesung.md).

- **Lehrperson** und **KI-Agent** zeigen **Ende-zu-Ende**: Backlog-Akzeptanzkriterien → [ADR-0015](../architecture/decisions/0015-markdown-images-url-only-and-lightbox.md) → Angular/Markdown-Pipeline → Lightbox → i18n/Tests (soweit in der Zeit reicht).
- **Parallel:** Mini-Inputs **VS Code**, **Git**, **GitHub**, **Stack** (TypeScript, Angular, Monorepo — nach Terminplan).

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

- **Du:** Verstehst die Story, zerlegst sie in Schritte, formulierst Aufträge an die KI, **liest Diff und Tests**, führst manuelle Checks aus und dokumentierst kurz das Ergebnis.
- **KI:** Implementiert nach Vorgabe; **kein Ersatz** für Abnahme gegen Backlog und DoD.
- **Betreuung:** Reihenfolge durchsetzen oder begründet abweichen; bei Security-/Querschnitts-Stories zusätzliche Review-Zeit einplanen.

---

## 3. Verbindliche Reihenfolge aller Studententickets

Die folgende Struktur listet die **offenen oder laufenden, für dich relevanten Stories** didaktisch geordnet. **Epic 10 (MOTD)** bleibt herausgenommen, weil es laut Backlog bereits fertig ist. **Epic 11** bleibt herausgenommen, solange der Erweiterungspfad nicht beauftragt ist.

### 3.1 Verbindliche Ticketstrecke

| Nr. | Story         | Titel (Kurz)                                 | Didaktischer Schwerpunkt                  | Warum genau hier?                                                                                                                                                                                                                |
| --- | ------------- | -------------------------------------------- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **1.14a**     | Word Cloud 2.0                               | Layout, UX, Performance                   | **Einstieg über bestehende Fläche:** sichtbar, produktnah und gut gegen ADR-0012, Styleguide und bestehende Word-Cloud-Tests prüfbar.                                                                                            |
| 2   | **8.5**       | Delegierbare Q&A-Moderation                  | Rollen, Tokens, Rechte, UI                | **Domänenvertiefung:** baut auf dem fertigen Q&A-Kern und den fertigen Sortierungen 8.6/8.7 auf, verschiebt den Fokus aber auf Rechte und Moderation.                                                                            |
| 3   | **1.2ec**     | Kurzantwort: Schlüsselwort-Basis             | Bewertungsmodell, Teilpunkte, Erklärtexte | **Aufbau auf fertiger Kurzantwort:** erweitert vorhandene Bewertung, ohne sofort einen komplett neuen Fragentyp zu erzwingen.                                                                                                    |
| 4   | **1.2ed**     | Kurzantwort: Token-/Mehrwortlogik            | Deterministische Textbewertung, UX        | **Vertiefung nach 1.2ec:** stabilisiert dieselbe Fachfläche und trainiert Tests für Grenzfälle.                                                                                                                                  |
| 5   | **1.2d**      | Numerische Schätzfrage                       | Voller Fragentyp End-to-End               | **Erster neuer Fragentyp:** Shared Types, Backend, Session-Flow, Ergebnislogik und UI; darum erst nach Erweiterungen an bestehender Bewertungslogik.                                                                             |
| 6   | **1.2g–1.2h** | Zuordnung, Reihenfolge                       | Weitere Fragetypen                        | **Varianten nach dem ersten Fragentyp:** dieselben Muster wiederholen und bewusst abstrahieren, ohne Schema- und UI-Regeln zu verwässern. **1.2f** (Hotspot) ist aus A11y-Gründen geschlossen; **1.2i** (Confidence) ist fertig. |
| 7   | **2.9**       | Asynchrone Quiz-Modi und Feedback-Strategien | Produktmodell, Dashboard, Datenschutz     | **Große Produktfläche:** greift tief in Session-Status, Fortschritt und Feedback ein; braucht vorher Routine in Fragentypen und Live-Flows.                                                                                      |
| 8   | **0.7**       | Last- & Performance-Tests mit E2E-Szenarien  | Tooling, Messung, CI, Metriken            | **Qualitätsschicht:** erst sinnvoll, wenn mehrere reale Kernflows verstanden und technisch nachvollzogen wurden.                                                                                                                 |
| 9   | **1.6d**      | Sync-Performance & Skalierung                | Messen, Profiling, Hypothesen             | **Gezielte Optimierung:** baut auf Mess- und Testlogik aus 0.7 auf, statt blind an Performanceproblemen zu schrauben.                                                                                                            |
| 10  | **6.6**       | UX Thinking Aloud & Umsetzung                | Methode, Findings, iterative Verbesserung | **Methodischer Perspektivwechsel:** nach mehreren Produktflächen ist genug Material da, um Beobachtungen systematisch in Änderungen zu übersetzen.                                                                               |
| 11  | **6.5**       | Barrierefreiheit (Prüfung Projektende)       | Querschnitt, Audit, A11y                  | **Später Querschnitt:** sinnvoll, wenn die relevanten UI-Flächen bereits stehen und nicht mehr im Stundenrhythmus umgebaut werden.                                                                                               |
| 12  | **1.6c**      | Sync-Sicherheit härten                       | Security, verteilte Logik, Review-Tiefe   | **Höchstes Fehlerrisiko:** kommt bewusst zuletzt, wenn Architekturverständnis, Prüfdisziplin und Review-Sorgfalt aufgebaut sind. **0.8** (McCabe) ist geschlossen / nicht weiterverfolgt.                                        |

### 3.2 Greenfield-Referenz: 1.7a

Die Greenfield-Demo **1.7a** bleibt als gemeinsame Referenz für Markdown-Pipeline, Lightbox, i18n und Tests relevant. Als **umgesetzte Story** gehört sie aber **nicht** mehr in die studentische Ticketstrecke. Gleiches gilt für **5.4a**, **8.6**, **8.7**, **1.7b** und **1.2i**: Diese Stories können für Review-Übungen dienen, sind aber keine aktuellen Umsetzungstickets. **Geschlossen (nicht umgesetzt)** und ebenfalls nicht Teil der Strecke: **1.2f** (Hotspot, A11y) und **0.8** (McCabe-Refactor).

---

## 4. Phasen (übergeordnet)

Zur Orientierung für die Betreuung — nicht als Alternativpfade, sondern als **Lernbogen über die komplette Strecke**:

1. **Phase A (1–3):** Überschaubare Produkt- und Live-Ausbaustufen.
2. **Phase B (4–8):** Bewertungslogik, neue Fragentypen und größere Session-Modelle.
3. **Phase C (9–10):** Performance, Last und Sync-Skalierung messbar machen.
4. **Phase D (11–13):** UX, Barrierefreiheit und Wartbarkeit als Querschnitt.
5. **Phase E (14):** Security-Härtung erst mit aufgebauter Review- und Architekturkompetenz.

---

## 5. Abnahme-Checkliste pro Story

Kurz und wiederholbar — unabhängig von der Story-Nummer:

- [ ] Akzeptanzkriterien aus `Backlog.md` erfüllt (oder Abweichung dokumentiert und mit Betreuung abgestimmt).
- [ ] `shared-types` / Zod bei tRPC-Eingaben und -Ausgaben konsistent (`AGENTS.md`, Monorepo-Regeln).
- [ ] Tests grün; bei neuem Verhalten sinnvolle Specs ergänzt.
- [ ] UI-Texte: bei deutschen Änderungen **alle** Zielsprachen nachgezogen (ADR-0008), sofern Story UI berührt.
- [ ] Kein blindes Merge: **Diff gelesen**, keine offensichtlichen Sicherheits- oder Datenlecks.

---

## 6. Abweichungen von der Reihenfolge

Abweichungen sind möglich, aber nur **begründet und dokumentiert**, z. B.:

- Eine Backlog-Änderung verschiebt die fachliche Priorität deutlich; dann muss die Reihenfolge in diesem Dokument mitangepasst werden.
- Ein technischer Blocker macht eine Vorziehung nötig; auch dann bleibt die Grundlogik erhalten: kleine Features vor Querschnitt, Querschnitt vor Security-Härtung.

---

## 7. Verknüpfungen

| Dokument                                                                                           | Inhalt                                                          |
| -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| [`Backlog.md`](../../Backlog.md)                                                                   | Story-Liste, Status, Akzeptanzkriterien                         |
| [`docs/didaktik/greenfield-demo-1-7a-vorlesung.md`](../didaktik/greenfield-demo-1-7a-vorlesung.md) | **Ablauf 3×45 Min.** Greenfield 1.7a                            |
| [`docs/features/controversy-score.md`](../features/controversy-score.md)                           | Referenz für fertige Q&A-Sortierungen (8.6/8.7)                 |
| [`docs/praktikum/PRAKTIKUM.md`](./PRAKTIKUM.md)                                                    | Rahmen Praktikum, Bewertung, Ablauf                             |
| [`EINSTIEG-TOOLS-UND-STACK.md`](./EINSTIEG-TOOLS-UND-STACK.md)                                     | **Pflicht-Orientierung** bei fehlender Tool-/Stack-Vorerfahrung |
| [`docs/features/motd.md`](../features/motd.md)                                                     | MOTD, Epic 10 (optional Referenzcode)                           |
| [`AGENTS.md`](../../AGENTS.md)                                                                     | Arbeitsweise mit KI im Editor                                   |

---

_Diese Datei beschreibt eine **didaktische** Reihenfolge für die studentische Bearbeitung. Die fachliche Priorisierung im Produkt bleibt im Backlog und bei Product Owner bzw. Projektleitung._
