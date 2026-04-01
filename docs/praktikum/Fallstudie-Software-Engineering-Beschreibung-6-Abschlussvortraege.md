<!-- markdownlint-disable MD013 MD022 MD024 MD032 -->

# Fallstudie Software Engineering – Beschreibung der sechs Abschlussvorträge

**Kontext:** Fallstudie **arsnova.eu** · **Zielgruppe:** Studierende nach dem Bearbeiten der **didaktischen 13-Ticket-Reihenfolge** (siehe [`STUDENT-STORY-REIHENFOLGE.md`](./STUDENT-STORY-REIHENFOLGE.md))  
**Zweck:** Dieses Dokument hilft euch dabei, euer Thema klar abzugrenzen, sinnvoll zu gewichten und mit belastbaren Repo-Bezügen vorzubereiten. Es ersetzt keine Prüfungsabsprachen mit der Betreuung.  
**Backlog-Stand:** 93 Stories (79 erledigt, 14 offen) – bei größeren Änderungen in [`Backlog.md`](../../Backlog.md) bitte Themenabgrenzungen und Beispiele neu prüfen.

---

## 1. Was ihr vorbereitet

### 1.1 Format der Prüfungsleistung

Die sechs Abschlussvorträge sind **sechs getrennte Einzeltermine**. Pro Termin gibt es **genau ein Thema** und **genau eine vortragende Person**. Es handelt sich also **nicht** um einen gemeinsamen Gruppenblock mit sechs Kurzbeiträgen.

| Bestandteil                 | Typische Ausgestaltung                                                                  |
| --------------------------- | --------------------------------------------------------------------------------------- |
| **Unterrichtseinheit (UE)** | **45 Minuten** pro Termin für Vortrag, Rückfragen und Feedback                          |
| **Einzelvortrag**           | meist **ca. 20 Minuten** strukturierter Vortrag                                         |
| **Diskussion und Feedback** | restliche Zeit für Nachfragen, Einordnung und Rückmeldung durch Betreuung und Gruppe    |
| **Handout**                 | **eine** DIN-A4-Seite oder **ein** DIN-A3-Blatt mit einem klaren Themenblock pro Person |

Über alle Themen hinweg ergibt das **6 x 45 Minuten** und damit eine vollständige Vortragsreihe zur Fallstudie.

### 1.2 Was das Handout leisten soll

Das Handout soll **nicht** die 13 Tickets nacherzählen. Es soll zeigen, wie aus euren sechs Einzelthemen **ein gemeinsames softwaretechnisches Bild** von arsnova.eu entsteht.

- Jedes Thema bekommt ungefähr **gleich viel Platz**.
- Jedes Thema benennt **Stack**, **Architekturmuster**, **ein konkretes Repo-Beispiel** und **eine reflektierte KI-Erfahrung**.
- Jedes Thema grenzt sich sichtbar von den Nachbarthemen ab.

Ein einfaches und belastbares Muster pro Handout-Feld ist:

1. Warum dieses Thema im Projekt wichtig ist.
2. Welche Bausteine aus dem Repo dazugehören.
3. Welche typische Arbeitsweise oder welches Muster ihr daran zeigen könnt.
4. Welche Grenze zu den anderen fünf Vorträgen gilt.

### 1.3 Logik für Vortrag und Handout

Vortrag und Handout sollten derselben Linie folgen:

- **Was gehört fachlich zu meinem Thema?**
- **Wo sieht man das im Repo?**
- **Welche typische Engineering-Entscheidung steckt dahinter?**
- **Wo war KI hilfreich, wo musste sie korrigiert werden?**

Wenn ihr diese vier Fragen sauber beantwortet, wirkt euer Thema weder beliebig noch ausufernd.

### 1.4 Ein gemeinsames Beispiel, das viele Schichten verbindet

Wenn ihr ein durchgehendes Beispiel braucht, eignet sich **Epic 10 / MOTD** sehr gut: [ADR-0018](../architecture/decisions/0018-message-of-the-day-platform-communication.md). Daran lassen sich Verträge, Paketgrenzen, Berechtigungen, i18n, Persistenz und Tests entlang einer einzigen Funktionskette erklären.

---

## 2. Was die sechs Vorträge zusammen abdecken sollen

Die sechs Themen sollen zusammen mindestens diese Schichten verständlich machen:

| Schicht                                              | Abgedeckt durch | Typische Repo-Quellen                                                                                                                                                                                                                                    |
| ---------------------------------------------------- | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Typisierte Verträge und API-Schnittstellen           | Thema 1         | `libs/shared-types/src/schemas.ts`, Router in `apps/backend/src/routers/`, [ADR-0003](../architecture/decisions/0003-use-trpc-for-api.md)                                                                                                                |
| Struktur des Monorepos und Paketgrenzen              | Thema 2         | Root-`package.json`, `tsconfig.json`, Paketdateien in `apps/` und `libs/`, [Handbuch](../architecture/handbook.md)                                                                                                                                       |
| Sicherheit, Rollen und Datenminimierung              | Thema 3         | [`SECURITY-OVERVIEW.md`](../SECURITY-OVERVIEW.md), Router-Logik, DTO-Tests, [ADR-0006](../architecture/decisions/0006-roles-routes-authorization-host-admin.md)                                                                                          |
| Angular-Frontend, UI-Regeln und i18n                 | Thema 4         | `apps/frontend/src/`, [ADR-0002](../architecture/decisions/0002-use-angular-signals-for-ui-state.md), [ADR-0005](../architecture/decisions/0005-use-angular-material-design.md), [ADR-0008](../architecture/decisions/0008-i18n-internationalization.md) |
| Persistenz, Migrationen und Laufzeitverhalten        | Thema 5         | `prisma/schema.prisma`, `prisma/migrations/`, [`ENVIRONMENT.md`](../ENVIRONMENT.md), Backend-Libs                                                                                                                                                        |
| Qualitätssicherung, CI und KI-gestützte Arbeitsweise | Thema 6         | [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml), [`TESTING.md`](../TESTING.md), [`CONTRIBUTING.md`](../../CONTRIBUTING.md), [`AGENT.md`](../../AGENT.md)                                                                                    |

---

## Thema 1 – Typisierte Schnittstellen: Zod, `shared-types`, tRPC

**Warum dieses Thema zählt:** Dieses Thema erklärt, warum arsnova.eu nicht aus lose verkabelten JSON-Objekten besteht. Wer diesen Vortrag übernimmt, zeigt, wie aus einem Schema ein Vertrag wird, der Frontend und Backend zusammenhält.

### Was ihr zeigen solltet

- Zod-Schemas in `libs/shared-types` als verbindliche Beschreibung von Ein- und Ausgaben
- tRPC als transportierte API-Logik ohne separates REST-Nebenmodell
- das Muster **Schema zuerst, danach Router und UI-Anbindung**
- ein konkretes Beispiel dafür, wie eine Änderung am Schema mehrere Schichten berührt

### Guter Einstieg im Repo

- `libs/shared-types/src/schemas.ts`
- `apps/backend/src/routers/`
- [ADR-0003](../architecture/decisions/0003-use-trpc-for-api.md)
- [Architektur-Handbuch](../architecture/handbook.md)

### Anknüpfung an eure Tickets

Besonders passend sind Tickets, in denen ihr Eingaben, Antworten oder Rückgabeformen erweitert habt, zum Beispiel bei neuen Fragetypen, Q&A-Funktionen oder Admin-Fällen. Genau dort merkt man, ob ein Vertrag sauber gepflegt ist.

### KI-Reflexion

Beschreibt eine Stelle, an der die KI euch zwar schnell ein Schema oder einen Router-Vorschlag geliefert hat, ihr aber selbst prüfen musstet, ob Feldnamen, Validierung und Rückgabetypen wirklich zu den bestehenden Konventionen passen.

### Was bewusst nicht dazugehört

- tiefere UI-Gestaltung und Angular-Komponenten
- Datenbankmodellierung und Migrationen im Detail
- CI-Organisation als Hauptthema

---

## Thema 2 – Monorepo: Workspaces, `apps/*`, `libs`, Abhängigkeiten

**Warum dieses Thema zählt:** Dieses Thema macht sichtbar, warum Zusammenarbeit in arsnova.eu überhaupt beherrschbar bleibt. Ihr zeigt hier nicht nur Ordnerstrukturen, sondern die Logik dahinter: Was darf wo liegen, was wird gemeinsam genutzt und wie verhindert das Repo unübersichtliche Änderungen?

### Was ihr zeigen solltet

- die Rolle von npm Workspaces und Paketgrenzen
- die Aufgabenteilung zwischen `apps/frontend`, `apps/backend` und `libs/shared-types`
- typische Import- und Abhängigkeitsrichtungen
- warum kleine, paketklare Änderungen wartbarer sind als Misch-PRs

### Guter Einstieg im Repo

- Root-`package.json`
- Root-`tsconfig.json`
- `apps/frontend/package.json`
- `apps/backend/package.json`
- `libs/shared-types/package.json`
- [Architektur-Handbuch](../architecture/handbook.md)

### Anknüpfung an eure Tickets

Relevant sind besonders Tickets, bei denen ihr gleichzeitig Frontend, Backend und gemeinsame Typen anfassen musstet. Dort sieht man direkt, ob Paketgrenzen helfen oder ob sie unterlaufen werden.

### KI-Reflexion

Gute Frage für eure Reflexion: Hat die KI euch einmal eine Änderung vorgeschlagen, die technisch funktionierte, aber die Paketgrenzen unsauber gemacht hätte? Dann zeigt genau, wie ihr das im Diff erkannt und wieder aufgeräumt habt.

### Was bewusst nicht dazugehört

- inhaltliche Detailerklärung einzelner Zod-Schemas
- tiefere Sicherheitslogik einzelner Rollen oder DTOs
- vollständige CI-Pipeline-Erklärung

---

## Thema 3 – Sicherheit und Schutz sensibler Daten: DTO, Stripping, Berechtigung

**Warum dieses Thema zählt:** Dieses Thema eignet sich besonders gut, um zu zeigen, was saubere Softwareentwicklung von naiver Datenweitergabe unterscheidet. Ihr macht sichtbar, dass Sicherheit in arsnova.eu nicht nur ein Zusatz ist, sondern Teil des Architekturdenkens.

### Was ihr zeigen solltet

- das Prinzip **nur die Daten an den Client geben, die dort wirklich gebraucht werden**
- DTOs und Data-Stripping als bewusstes Muster
- serverseitige Rollen- und Berechtigungslogik
- ehrliche Einordnung von Zielbild und aktuellem Umsetzungsstand

### Guter Einstieg im Repo

- `apps/backend/src/__tests__/dto-security.test.ts`
- `apps/backend/src/routers/session.ts`
- [`SECURITY-OVERVIEW.md`](../SECURITY-OVERVIEW.md)
- [ADR-0006](../architecture/decisions/0006-roles-routes-authorization-host-admin.md)

### Anknüpfung an eure Tickets

Besonders passend sind Data-Stripping-, Rollen- oder Moderations-Themen. Auch Admin-Funktionen oder Host-Rechte liefern anschauliche Beispiele dafür, wie technische Entscheidungen direkt mit Sicherheitsniveau zusammenhängen.

### KI-Reflexion

Stark ist hier eine konkrete Erfahrung, bei der die KI euch zu viele Felder zurückgeben wollte oder Berechtigungen zu grob modelliert hat. Genau diese Korrekturleistung gehört in den Vortrag.

### Was bewusst nicht dazugehört

- vollständige Pentesting- oder Threat-Modeling-Diskussion
- Frontend-spezifische UI-Muster
- Infrastrukturdetails, sofern sie nicht direkt für Sicherheit nötig sind

---

## Thema 4 – Frontend: Angular, Signals, Material 3, i18n

**Warum dieses Thema zählt:** Hier geht es um die sichtbare und erlebbare Seite des Projekts. Dieses Thema ist nicht nur für Design-Interessierte spannend, sondern für alle, die verstehen wollen, wie technische Regeln, UI-Konsistenz und Mehrsprachigkeit im Alltag zusammenwirken.

### Was ihr zeigen solltet

- Angular mit Standalone Components und Signals als Projektstil
- Material 3 als UI-Basis
- die i18n-Regel, sichtbare Texte konsequent in mehreren Sprachen mitzudenken
- ein Beispiel dafür, wie Frontend-Regeln Entwicklungsentscheidungen beeinflussen

### Guter Einstieg im Repo

- `apps/frontend/src/app/`
- `apps/frontend/src/assets/i18n/` oder die aktuelle Lokalisierungsstruktur im Frontend
- [ADR-0002](../architecture/decisions/0002-use-angular-signals-for-ui-state.md)
- [ADR-0005](../architecture/decisions/0005-use-angular-material-design.md)
- [ADR-0008](../architecture/decisions/0008-i18n-internationalization.md)
- [`I18N-ANGULAR.md`](../I18N-ANGULAR.md)

### Anknüpfung an eure Tickets

Alle Tickets mit sichtbaren Oberflächen, Barrierefreiheit, neuen UI-Texten oder Interaktionsmustern passen hier gut. Besonders ergiebig sind Fälle, in denen eine kleine UI-Änderung plötzlich i18n, States und Tests mitberührt hat.

### KI-Reflexion

Typisch ist hier, dass KI alte Angular-Muster oder projektfremde Vorschläge produziert. Ein guter Vortrag benennt nicht nur das Problem, sondern zeigt, wie ihr es an Projektregeln, Reviews oder Tests erkannt habt.

### Was bewusst nicht dazugehört

- tiefe Router- oder Vertragslogik aus dem Backend
- detailreiche Test- und CI-Erklärung
- Datenbankperspektive

---

## Thema 5 – Persistenz und Laufzeit: Prisma, Redis, Backend-Realität

**Warum dieses Thema zählt:** Dieses Thema bringt die Ebene ins Spiel, auf der viele gute Ideen erst belastbar werden müssen. Ihr zeigt hier, wie Datenmodelle, Migrationen und Laufzeitmechanismen dafür sorgen, dass Features nicht nur lokal funktionieren, sondern im System stabil bleiben.

### Was ihr zeigen solltet

- Prisma-Schema als verbindliche Datenmodellbeschreibung
- Migrationen als nachvollziehbare Entwicklungsschritte
- Redis oder andere Laufzeitkomponenten als Teil des Gesamtverhaltens
- die Verbindung zwischen Persistenz, Cleanup, Realtime und Korrektheit

### Guter Einstieg im Repo

- `prisma/schema.prisma`
- `prisma/migrations/`
- `apps/backend/src/lib/`
- [`ENVIRONMENT.md`](../ENVIRONMENT.md)
- [Architektur-Handbuch](../architecture/handbook.md)
- [`GLOSSAR.md`](../GLOSSAR.md)

### Anknüpfung an eure Tickets

Passend sind alle Tickets mit neuen Feldern, neuen Tabellen, Änderungen an Antworttypen oder Aufräumlogik. Gerade dort wird deutlich, dass Datenhaltung nie nur ein Nebenprodukt des Frontends ist.

### KI-Reflexion

Ein guter Reflexionspunkt ist eine Stelle, an der die KI zwar schnell Code für eine lokale Funktion erzeugt hat, aber Nebenwirkungen im Gesamtsystem übersehen hat, etwa Cleanup, Cascade-Effekte oder fehlende Migrationen.

### Was bewusst nicht dazugehört

- erneute Grundsatzerklärung von Zod und tRPC
- Deployment als eigener Schwerpunkt
- reine UI-Betrachtung ohne Bezug zur Laufzeit

---

## Thema 6 – Qualität, CI und KI im Entwicklungsprozess

**Warum dieses Thema zählt:** Dieses Thema ist der Querschnitt über alles andere. Es zeigt, wie aus Ideen belastbare Änderungen werden und wie das Projekt verhindert, dass schneller Code wichtiger wird als richtiger Code. Genau hier lässt sich KI-Nutzung besonders glaubwürdig und praxisnah reflektieren.

### Was ihr zeigen solltet

- die Rolle von Tests, Typecheck, Linting und CI als Qualitätstore
- den typischen Ablauf von Spezifikation über Implementierung bis zur Absicherung
- die Bedeutung von kleinen Schritten, prüfbaren Diffs und Reviewbarkeit
- konkrete Beispiele dafür, wie KI in diesen Ablauf eingebettet wurde

### Guter Einstieg im Repo

- [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml)
- [`TESTING.md`](../TESTING.md)
- [`CONTRIBUTING.md`](../../CONTRIBUTING.md)
- [`AGENT.md`](../../AGENT.md)
- Testdateien in `apps/backend/src/__tests__/` und `apps/frontend/src/`

### Anknüpfung an eure Tickets

Im Grunde passt jedes Ticket, bei dem etwas erst nach Tests, Review oder CI wirklich fertig war. Besonders gut funktionieren Beispiele, in denen der erste KI-Vorschlag noch nicht tragfähig war und erst durch Nacharbeit sauber wurde.

### KI-Reflexion

Dieser Vortrag gewinnt, wenn ihr beide Seiten zeigt: Wo KI euch Zeit gespart hat und wo ihr bewusst bremsen musstet, weil Annahmen falsch waren, Übersetzungen fehlten oder Tests instabil geworden wären.

### Was bewusst nicht dazugehört

- komplette Wiederholung der Architekturthemen 1 bis 5
- reine Story-Nacherzählung ohne Prozessbezug
- allgemeine KI-Meinungen ohne Projektbeispiel

---

## 3. Kurz-Checkliste vor der Abgabe

### Formales

- [ ] Sechs Personen, sechs Themen, keine Doppelbesetzungen
- [ ] Pro Thema ein Einzeltermin mit klarer Zeitplanung
- [ ] Ein Handout mit sechs gleichwertigen Themenfeldern
- [ ] Absprachen der Betreuung vor der Endfassung eingearbeitet

### Inhaltlich

- [ ] Jedes Thema erklärt seinen Mehrwert für das Gesamtprojekt
- [ ] Jedes Thema bezieht sich auf konkrete Repo-Dateien, ADRs oder Dokuquellen
- [ ] Jedes Thema enthält mindestens ein greifbares Beispiel aus euren Tickets
- [ ] Jedes Thema enthält eine ehrliche KI-Reflexion mit Nutzen und Korrekturanteil
- [ ] Vortrag und Handout grenzen sich sichtbar von den anderen fünf Themen ab

---

_Stand: 2026-04-01 · Datei: `Fallstudie-Software-Engineering-Beschreibung-6-Abschlussvortraege.md` · Bei größeren Änderungen am Stack oder an der Prüfungsform dieses Dokument und die Verweise in [`docs/README.md`](../README.md) mitprüfen._
