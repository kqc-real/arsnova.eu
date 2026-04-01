<!-- markdownlint-disable MD013 MD022 MD024 MD032 -->

# Softwarequalitätsmanagement – Beschreibung der vier Referate

**Kontext:** Kurs **Softwarequalitätsmanagement** in der Fallstudie **arsnova.eu** · **Zielgruppe:** Studierende nach dem Bearbeiten der didaktischen Ticket-Reihenfolge und der SQM-Aufgaben (siehe [`STUDENT-STORY-REIHENFOLGE.md`](./STUDENT-STORY-REIHENFOLGE.md) und [`PRAKTIKUM-SQM.md`](./PRAKTIKUM-SQM.md))  
**Zweck:** Dieses Dokument gibt euch eine klare, eigenständige Orientierung für Themenwahl, Abgrenzung, Nachweise und Gewichtung der vier Referate. Es ersetzt keine Vorgaben der Betreuung.  
**Backlog-Stand:** 93 Stories (79 erledigt, 14 offen) – bei größeren Änderungen in [`Backlog.md`](../../Backlog.md) bitte Beispiele, Begriffe und Nachweise aktualisieren.

---

## 1. Was ihr vorbereitet

### 1.1 Format der Prüfungsleistung

Die vier Referate sind **vier getrennte Einzeltermine**. Pro Termin gibt es **genau ein Thema** und **genau eine vortragende Person**.

| Bestandteil                   | Typische Ausgestaltung                                                                     |
| ----------------------------- | ------------------------------------------------------------------------------------------ |
| **Unterrichtseinheit (UE)**   | **45 Minuten** pro Termin                                                                  |
| **Einzelreferat**             | meist **ca. 20 Minuten** Vortrag                                                           |
| **Diskussion und Feedback**   | restliche Zeit für Fragen, Einordnung und Rückmeldung                                      |
| **Handout**                   | **eine** DIN-A4-Seite oder **ein** DIN-A3-Blatt mit vier klar getrennten Themenblöcken     |
| **Schriftliche Ausarbeitung** | in der Regel **ca. 7 bis 10 Seiten** in LaTeX, sofern die Betreuung nichts anderes vorgibt |

### 1.2 Was an SQM hier wichtig ist

Diese vier Themen sind **querschnittlich** angelegt. Ihr sollt also nicht einzelne Stories nacherzählen, sondern erklären, **wie Qualität im Projekt geplant, sichtbar gemacht, geprüft und verbessert wird**.

Einzelne Tickets dürfen dabei als Beispiele dienen. Hilfreich sind sie aber nur dann, wenn sie eine größere Qualitätsfrage illustrieren, zum Beispiel Testbarkeit, Reviewbarkeit, Performance oder Nutzungsqualität.

### 1.3 Was Handout, Vortrag und Ausarbeitung gemeinsam brauchen

Jedes Thema sollte dieselben vier Fragen beantworten:

1. Welches Qualitätsziel steht im Mittelpunkt?
2. Woran sieht man dieses Ziel konkret im Projekt?
3. Mit welchen Methoden, Artefakten oder Messungen wurde daran gearbeitet?
4. Wo war KI hilfreich und wo musste sie durch Menschen, Tests oder Reviews korrigiert werden?

### 1.4 Technischer Kurzkontext für SQM

Damit die Referate für sich selbst stehen, hier der nötige Projektkontext in kompakter Form:

- arsnova.eu ist ein Monorepo mit Frontend, Backend und gemeinsamen Typen.
- Im Frontend wird Angular eingesetzt.
- Das Backend nutzt tRPC, Prisma und weitere Node-basierte Komponenten.
- Getestet wird vor allem mit Vitest; abgesichert wird zusätzlich über Typecheck, Linting und CI.
- Qualitätsfragen zeigen sich deshalb nie nur in einer Datei, sondern fast immer über mehrere Schichten hinweg.

---

## 2. Was die vier Referate zusammen abdecken sollen

Die vier Themen sollen zusammen ein in sich geschlossenes SQM-Bild des Projekts liefern:

| Qualitätsdimension                                           | Abgedeckt durch | Typische Repo-Quellen                                                                                                            |
| ------------------------------------------------------------ | --------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Teststrategie, Automatisierung, reproduzierbare Absicherung  | Thema 1         | [`TESTING.md`](../TESTING.md), [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml), Testdateien in Frontend und Backend |
| Reviews, Definition of Done, Merge-Qualität                  | Thema 2         | [`CONTRIBUTING.md`](../../CONTRIBUTING.md), [`Backlog.md`](../../Backlog.md), Pull-Request-nahe Doku                             |
| Nicht-funktionale Qualität: Performance, Last, Supply Chain  | Thema 3         | [`SECURITY-OVERVIEW.md`](../SECURITY-OVERVIEW.md), Lighthouse- oder Audit-Artefakte, relevante Architektur-ADRs                  |
| Nutzerqualität, Barrierefreiheit, Methodik und Dokumentation | Thema 4         | SQM-Praktikumsdoku, Nutzungs- und A11y-Artefakte, Projekt- und Kursdokumentation                                                 |

---

## Thema 1 – Teststrategie, Automatisierung und CI

**Warum dieses Thema zählt:** Dieses Thema ist der direkteste Nachweis dafür, dass Qualität im Projekt nicht behauptet, sondern geprüft wird. Ihr zeigt hier, wie aus Anforderungen belastbare Tests werden und warum eine grüne Pipeline mehr ist als nur ein Haken im Workflow.

### Was ihr zeigen solltet

- welche Arten von Tests im Projekt sinnvoll eingesetzt werden
- wie zwischen schnellen lokalen Checks und stärkeren Integrationsprüfungen unterschieden wird
- welche Rolle CI als Qualitätstor spielt
- wie Testbarkeit schon bei der Implementierung mitgedacht wird

### Guter Einstieg im Repo

- [`TESTING.md`](../TESTING.md)
- [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml)
- `apps/backend/src/__tests__/`
- `apps/frontend/src/`
- relevante DoD-Hinweise in [`Backlog.md`](../../Backlog.md)

### Anknüpfung an eure Tickets

Passend sind alle Tickets, bei denen ihr neue Tests gebraucht, bestehende Tests erweitert oder CI-Fehler aufgelöst habt. Gerade an solchen Stellen zeigt sich, ob ein Team Qualität nur behauptet oder praktisch absichert.

### KI-Reflexion

Spannend ist hier die Frage, ob KI euch eher beim Formulieren von Testideen geholfen hat oder ob sie euch auch schon falsche Sicherheit gegeben hat. Gute Referate benennen beides.

### Was bewusst nicht dazugehört

- reine Review-Organisation ohne Testbezug
- ausschließlich UX-Methoden oder Think-Aloud-Auswertung
- tiefe Diskussion einzelner Sicherheitslücken ohne Bezug zur Absicherung

---

## Thema 2 – Reviews, Definition of Done und Qualität im Pull Request

**Warum dieses Thema zählt:** Dieses Thema zeigt, wie Qualität sozial organisiert wird. Nicht jedes Problem fällt im Test auf, manches wird erst im Review sichtbar. Genau deshalb ist dieses Thema so wichtig: Ihr erklärt, wie das Projekt verhindert, dass fachlich oder technisch schwache Änderungen einfach durchrutschen.

### Was ihr zeigen solltet

- welche Rolle die Definition of Done spielt
- welche typischen Review-Fragen im Projekt sinnvoll sind
- wie Pull Requests strukturiert sein müssen, damit sie überhaupt gut reviewbar werden
- wie mit KI-generierten Diffs verantwortungsvoll umgegangen wird

### Guter Einstieg im Repo

- [`CONTRIBUTING.md`](../../CONTRIBUTING.md)
- [`Backlog.md`](../../Backlog.md)
- [`AGENT.md`](../../AGENT.md)
- projektspezifische Checklisten oder Review-Hinweise in der Doku

### Anknüpfung an eure Tickets

Besonders geeignet sind Tickets, bei denen ein erster Vorschlag noch zu groß, zu unpräzise oder zu riskant war und erst durch Review, Zuschnitt oder Nachbesserung tragfähig geworden ist.

### KI-Reflexion

Hier ist eine ehrliche Beobachtung besonders stark: Hat euch KI beim Zusammenfassen, Strukturieren oder Formulieren geholfen, aber zugleich dazu verleitet, einen Diff zu schnell als plausibel zu akzeptieren? Genau diese Spannung ist SQM-relevant.

### Was bewusst nicht dazugehört

- vollständige Wiederholung der Testpipeline
- ausführliche Lighthouse- oder Audit-Auswertung
- reine Architekturerklärung ohne Qualitätsprozess

---

## Thema 3 – Messbare nicht-funktionale Qualität: Performance, Last, Sicherheit der Lieferkette

**Warum dieses Thema zählt:** Dieses Thema eignet sich besonders gut, um Qualität messbar zu machen. Hier könnt ihr zeigen, dass Softwarequalität nicht bei Korrektheit endet, sondern auch Reaktionsgeschwindigkeit, Belastbarkeit und einen verantwortungsvollen Umgang mit Abhängigkeiten umfasst.

### Was ihr zeigen solltet

- wie Performance oder Ladeverhalten beobachtet oder verbessert wurden
- welche Rolle Lasttests, Skalierungsüberlegungen oder technische Grenzen spielen
- wie mit Abhängigkeiten, Audits und Lieferkettenrisiken umgegangen wird
- wie man Ergebnisse nachvollziehbar dokumentiert statt nur zu behaupten

### Guter Einstieg im Repo

- [`SECURITY-OVERVIEW.md`](../SECURITY-OVERVIEW.md)
- Lighthouse- oder A11y-Reports im Frontend-Kontext
- relevante Architektur- oder Betriebsdokumentation in `docs/`
- Hinweise zu Last oder Infrastruktur in [`Backlog.md`](../../Backlog.md) und der Architekturdoku

### Anknüpfung an eure Tickets

Geeignet sind alle Arbeiten, bei denen ihr messbare Verbesserungen oder Risiken gesehen habt: Performance-Checks, Audit-Funde, Skalierungsfragen oder technische Schulden mit qualitativer Relevanz.

### KI-Reflexion

Eine gute Reflexionsfrage lautet hier: Hat KI euch geholfen, Messwerte oder Audit-Output schneller zu strukturieren, aber nicht sauber genug einzuordnen? Dann zeigt, warum menschliche Bewertung unverzichtbar bleibt.

### Was bewusst nicht dazugehört

- komplette Sicherheitsanalyse im Sinne eines Penetrationstests
- detaillierte UX-Methodik
- bloße Tool-Aufzählung ohne Nachweis oder Einordnung

---

## Thema 4 – Nutzerqualität, Barrierefreiheit, Methodik und Dokumentation

**Warum dieses Thema zählt:** Dieses Thema gibt euch die Chance zu zeigen, dass gute Software nicht nur technisch korrekt, sondern auch verstehbar, zugänglich und im Nutzungskontext sinnvoll sein muss. Gerade hier wird sichtbar, ob Qualität wirklich bei den Menschen ankommt, die das System verwenden.

### Was ihr zeigen solltet

- qualitative Methoden wie Think Aloud oder andere nutzungsnahe Verfahren
- Barrierefreiheit als echte Qualitätsdimension und nicht als Nachtrag
- Nutzungsdokumentation, Einführungshilfen oder Guiding-Artefakte als Teil der Produktqualität
- den Zusammenhang von Beobachtung, Feedback und konkreter Verbesserung

### Guter Einstieg im Repo

- [`PRAKTIKUM-SQM.md`](./PRAKTIKUM-SQM.md)
- A11y- oder Lighthouse-Artefakte im Frontend-Bereich
- relevante didaktische oder methodische Dokumente in `docs/didaktik/`
- [`SECURITY-OVERVIEW.md`](../SECURITY-OVERVIEW.md) dort, wo Datenschutz und Datensparsamkeit die Nutzung berühren

### Anknüpfung an eure Tickets

Passend sind alle Arbeiten, bei denen ihr echte Nutzungsprobleme, Zugangsbarrieren, Missverständnisse oder Dokumentationslücken gesehen und verbessert habt. Solche Beispiele machen das Thema konkret und glaubwürdig.

### KI-Reflexion

Interessant ist hier vor allem, ob KI euch bei Leitfäden, Testskripten oder Auswertungsstrukturen geholfen hat, während die eigentliche Qualitätsaussage erst durch echte Beobachtungen und menschliche Interpretation entstanden ist.

### Was bewusst nicht dazugehört

- tiefe Backend- oder Datenbankerklärungen ohne Nutzungsbezug
- vollständige CI- oder Teststrategie-Wiederholung
- reine Theorie ohne Projektbeispiel

---

## 3. Kurz-Checkliste vor der Abgabe

### Formales

- [ ] Vier Personen, vier Themen, keine Doppelbesetzungen
- [ ] Pro Thema ein klar strukturierter Einzeltermin
- [ ] Ein Handout mit vier gleichwertigen Themenblöcken
- [ ] Umfang und Form der schriftlichen Ausarbeitung mit der Betreuung geklärt

### Inhaltlich

- [ ] Jedes Thema hat ein klares Qualitätsziel
- [ ] Jedes Thema zeigt konkrete Nachweise, Artefakte oder Messpunkte
- [ ] Jedes Thema bezieht sich sichtbar auf Repo-Dateien oder Projektdokumentation
- [ ] Jedes Thema enthält mindestens ein Beispiel aus euren eigenen Arbeiten
- [ ] Jedes Thema enthält eine reflektierte KI-Passage mit Nutzen und Grenzen

---

## 4. Orientierung im Repo

- [`PRAKTIKUM-SQM.md`](./PRAKTIKUM-SQM.md) für Aufgaben, Aufbau und Praktikumsrahmen
- [`TESTING.md`](../TESTING.md) für Test- und CI-Grundlagen
- [`SECURITY-OVERVIEW.md`](../SECURITY-OVERVIEW.md) für sicherheitsnahe Qualitätsaspekte
- [`Backlog.md`](../../Backlog.md) und [`CONTRIBUTING.md`](../../CONTRIBUTING.md) für DoD, Prozess und Reviewbezug

---

_Stand: 2026-04-01 · Datei: `Softwarequalitaetsmanagement-Beschreibung-4-Referate.md` · Bei größeren Änderungen an Prüfungsform, Repo-Struktur oder Projektprozess dieses Dokument und seine Verweise mitprüfen._
