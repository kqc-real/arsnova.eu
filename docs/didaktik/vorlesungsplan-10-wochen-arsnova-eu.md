<!-- markdownlint-disable MD024 -->

# Vorlesungsplan: 10 Wochen arsnova.eu begleiten

> Vorschlag fuer eine semesterbegleitende Vorlesungsreihe auf Basis des Repos `arsnova.eu`.
> Fokus: Onboarding, Softwarearchitektur, Datenschutz, Realtime, Local-First, Qualitaetssicherung und Entwicklung mit KI-Agenten.

---

## 1. Ziel der Reihe

Die Vorlesungsreihe nutzt `arsnova.eu` als durchgehende Fallstudie fuer moderne Softwareentwicklung. Das Repo eignet sich gut, weil dort Produktidee, Architektur, Sicherheit, Entwicklungsprozess, Tests, UX-Regeln und KI-Leitplanken zusammen sichtbar sind.

Am Ende sollen die Studierenden nicht nur einzelne Technologien kennen. Sie sollen verstehen, wie aus Anforderungen, Regeln und Architekturentscheidungen ein zusammenhaengendes Softwaresystem entsteht.

---

## 2. Leitidee

`arsnova.eu` ist als Studienobjekt stark, weil mehrere Spannungsfelder gleichzeitig sichtbar werden:

- Local-First versus serverseitige Kontrolle
- Datenschutz versus Komfort
- Realtime versus Robustheit
- Typsicherheit versus Entwicklungsaufwand
- Dokumentation versus Geschwindigkeit
- KI-Unterstuetzung versus Architekturdisziplin

Genau diese Spannungen machen das Repo zu einer guten Grundlage fuer Software Engineering, Web Engineering und KI-gestuetzte Entwicklung.

---

## 3. Empfohlene Grundstruktur

- Format: 10 Sitzungen
- Dauer: je 90 Minuten
- Arbeitsweise: kurze Impulsphasen, gefuehrte Repo-Lektuere, Live-Demos, Diskussion
- Pruefungsnahe Form: jede Sitzung endet mit einer Transferfrage oder Mini-Analyse

---

## 4. Die 10 Vorlesungsthemen

| Woche | Thema                                                  | Leitfrage                                                                  | Zentrale Repo-Anker                                                                                             |
| ----- | ------------------------------------------------------ | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| 1     | Onboarding in ein professionelles Monorepo             | Wie erschliesst man ein grosses Projekt systematisch?                      | `README.md`, `docs/onboarding.md`, `CONTRIBUTING.md`, `Backlog.md`                                              |
| 2     | Documentation as Code und Architekturkommunikation     | Wie halten Teams Architekturwissen lebendig?                               | `docs/architecture/handbook.md`, `docs/architecture/decisions/`, `docs/serena.md`, `.serena/memories/core.md`   |
| 3     | Monorepo, Shared Types und Schema-first Entwicklung    | Warum beginnt Entwicklung hier mit Vertraegen statt mit UI oder DB-Code?   | `libs/shared-types/src/schemas.ts`, `prisma/schema.prisma`, `apps/backend/src/routers/index.ts`                 |
| 4     | tRPC und End-to-End-Typsicherheit                      | Wie entsteht eine typsichere Full-Stack-API ohne REST-Boilerplate?         | ADR `0003`, `apps/backend/src/routers/`, `apps/frontend/src/app/core/trpc.client.ts`                            |
| 5     | Zero-Knowledge, Datenschutz und Data-Stripping         | Wie wird Datenschutz als Architekturprinzip umgesetzt?                     | `docs/architecture/handbook.md`, `apps/backend/src/__tests__/dto-security.test.ts`, `prisma/schema.prisma`      |
| 6     | Local-First mit Yjs und IndexedDB                      | Was bedeutet es, wenn die Quiz-Sammlung primaer im Browser lebt?           | ADR `0004`, `docs/architecture/quiz-library-sync.md`, `quiz-store.service.ts`                                   |
| 7     | Realtime-Architektur fuer Live-Lehre                   | Wie kombiniert man Sessions, WebSockets, Redis und Live-Status robust?     | `apps/backend/src/index.ts`, `apps/backend/src/routers/session.ts`, `apps/backend/src/routers/quickFeedback.ts` |
| 8     | Produktarchitektur: Eine Session, mehrere Live-Kanaele | Wie werden Quiz, Q&A und Blitzlicht zu einem gemeinsamen Domänenmodell?    | ADR `0009`, `app.routes.ts`, Session-Views im Frontend                                                          |
| 9     | Qualitaet, Tests und Definition of Done                | Wie wird Qualitaet im Repo verankert statt nur behauptet?                  | `Backlog.md`, `AGENT.md`, `.github/workflows/ci.yml`, Testdateien                                               |
| 10    | Entwicklung mit KI-Agenten unter Governance            | Wie arbeitet man produktiv mit KI, ohne Architekturkontrolle zu verlieren? | `AGENT.md`, `.cursorrules`, `docs/vibe-coding/vibe-coding-szenario.md`, ADR `0007`                              |

---

## 5. Ausformulierte Wochenplanung

## Woche 1: Onboarding in ein professionelles Monorepo

### Lernziel

Die Studierenden koennen ein fremdes Projekt strukturiert erschliessen und zwischen Setup-Dokumentation, Fachlogik und Architekturartefakten unterscheiden.

### Schwerpunkt

- Einstieg ueber `README.md`
- Quickstart und Setup ueber `docs/onboarding.md`
- Mitarbeit ueber `CONTRIBUTING.md`
- Einordnung des Backlogs als Navigationsinstrument

### Lehrwert

Diese Sitzung zeigt, dass professionelles Onboarding selbst ein Architekturthema ist. Wer ein Projekt nicht lesen kann, kann es auch nicht verantwortungsvoll weiterentwickeln.

### Was das fuer eure Arbeit im Praktikum heisst

- Ohne diesen Einstieg wirken Tickets schnell wie isolierte Einzelaufgaben statt wie Teile eines Systems.
- Genau diese Sitzung hilft euch, beim ersten eigenen Beitrag nicht im Repo verloren zu gehen.

---

## Woche 2: Documentation as Code und Architekturkommunikation

### Lernziel

Die Studierenden verstehen den Mehrwert von Architekturhandbuch, ADRs, Backlog und stabilen Kontextdateien fuer Teamarbeit und Langzeitwartbarkeit.

### Schwerpunkt

- `docs/architecture/handbook.md` als Living Documentation
- ADRs als begruendete Entscheidungen
- `docs/serena.md` und `mem:core` als Einstieg in die kondensierte Projektreferenz
- Backlog und DoD als Bruecke zwischen Produkt und Technik

### Lehrwert

Das Repo zeigt vorbildlich, wie Dokumentation nicht neben dem Code steht, sondern im selben Entwicklungsprozess entsteht.

### Was das fuer eure Arbeit im Praktikum heisst

- Ihr braucht diese Perspektive, um Tickets nicht nur umzusetzen, sondern auch gegen Backlog, ADRs und Regeln zu plausibilisieren.
- Spaetestens bei Review, Begruendung oder Abgabe merkt man, ob ihr Entscheidungen im Projektkontext verorten koennt.

---

## Woche 3: Monorepo, Shared Types und Schema-first Entwicklung

### Lernziel

Die Studierenden koennen erklaeren, warum `shared-types` in diesem Projekt der eigentliche Integrationskern zwischen Frontend, Backend und Datenmodell ist.

### Schwerpunkt

- npm Workspaces als Strukturprinzip
- Zod-Schemas in `libs/shared-types/src/schemas.ts`
- Prisma-Schema als Datenmodell
- Ableitung von Frontend- und Backend-Code aus gemeinsamen Vertraegen

### Lehrwert

Hier laesst sich sehr gut zeigen, wie sich “erst Vertrag, dann Implementierung” von ad hoc entwickelten Webprojekten unterscheidet.

### Was das fuer eure Arbeit im Praktikum heisst

- Fast jede ernsthafte Aenderung in `arsnova.eu` beruehrt frueher oder spaeter `shared-types`, Router oder Datenmodell.
- Diese Sitzung erklaert, warum ein kleines Schema oft mehr Auswirkungen hat als eine sichtbare UI-Aenderung.

---

## Woche 4: tRPC und End-to-End-Typsicherheit

### Lernziel

Die Studierenden verstehen, wie tRPC HTTP, WebSockets und Typinferenz in einem Full-Stack-Setup zusammenfuehrt.

### Schwerpunkt

- ADR `0003`
- `appRouter` und Router-Aufbau im Backend
- tRPC-Client im Frontend
- Compile-Time-Fehler als Qualitaetsmechanismus

### Lehrwert

Das Thema eignet sich hervorragend, um REST, GraphQL und tRPC systematisch zu vergleichen.

### Was das fuer eure Arbeit im Praktikum heisst

- Wer Backend und Frontend im gleichen Ticket aendert, muss verstehen, warum API-Aenderungen im Projekt compile-time sichtbar werden.
- Das spart spaeter viel Blindflug bei Routern, Inputs und Rueckgabetypen.

---

## Woche 5: Zero-Knowledge, Datenschutz und Data-Stripping

### Lernziel

Die Studierenden koennen begruenden, wie Datenschutz zu einer architektonischen Entwurfsentscheidung wird und nicht nur zu einem juristischen Nachtrag.

### Schwerpunkt

- Zero-Account- und Zero-Knowledge-Prinzip
- temporaere Session-Kopie statt dauerhafte Cloud-Bibliothek
- DTO-Pattern und Phasenmodell
- Testfall `dto-security.test.ts`

### Lehrwert

Das ist eines der staerksten Themen des Projekts, weil fachliche Gefahr, technische Gegenmassnahme und automatisierter Test unmittelbar zusammenhaengen.

### Was das fuer eure Arbeit im Praktikum heisst

- Diese Denkweise schuetzt euch davor, Daten nur deshalb an den Client zu geben, weil es kurzfristig bequem ist.
- Gerade bei Host-, Admin- oder Moderationsfaellen ist das direkt relevant fuer eure eigenen Tickets.

---

## Woche 6: Local-First mit Yjs und IndexedDB

### Lernziel

Die Studierenden koennen CRDTs, lokale Persistenz und Sync-Mechanismen in ihrer Rolle fuer kollaborative Webanwendungen erklaeren.

### Schwerpunkt

- ADR `0004`
- Yjs, `y-indexeddb`, `y-websocket`
- Browser als primaere Datenhaltung
- Sync-Link und Multi-Device-Szenario

### Lehrwert

Diese Sitzung eignet sich besonders gut, um “Cloud-First” als implizite Norm zu hinterfragen.

### Was das fuer eure Arbeit im Praktikum heisst

- Sobald ihr an Quiz-Sync, Browserpersistenz oder Multi-Device-Verhalten arbeitet, braucht ihr dieses Modell.
- Auch wenn euer Ticket nicht direkt Yjs heisst, beeinflusst diese Architektur viele Randbedingungen des Produkts.

---

## Woche 7: Realtime-Architektur fuer Live-Lehre

### Lernziel

Die Studierenden verstehen, welche Realtime-Muster im Repo koexistieren und warum nicht jedes Live-Feature dieselbe technische Loesung braucht.

### Schwerpunkt

- tRPC-Subscriptions
- Redis fuer kurzlebige Live-Zustaende
- Session-Lifecycle und Countdown-Synchronisation
- Blitzlicht und Q&A als eigene Live-Kanaele

### Lehrwert

Das Thema zeigt, dass Realtime-Architektur immer fachlich motiviert sein sollte und nicht nur technologisch.

### Was das fuer eure Arbeit im Praktikum heisst

- Q&A, Blitzlicht, Session-Zustaende und laufende Abstimmungen wirken nur stabil, wenn ihr die Live-Muster dahinter versteht.
- Diese Sitzung hilft euch, Realtime-Probleme nicht als Zufall, sondern als Architekturthema zu lesen.

---

## Woche 8: Produktarchitektur: Eine Session, mehrere Live-Kanaele

### Lernziel

Die Studierenden erkennen, wie Domänenmodellierung UX, Routing und Backend-Vertraege gleichzeitig praegt.

### Schwerpunkt

- ADR `0009`
- eine Veranstaltung, ein Code, eine App
- gemeinsame Session-Shell statt Feature-Silos
- Quiz, Q&A und Blitzlicht als kanalbasiertes Modell

### Lehrwert

Diese Sitzung ist ideal, um zu zeigen, dass Architekturentscheidungen oft fachliche Modellierungsentscheidungen sind.

### Was das fuer eure Arbeit im Praktikum heisst

- Sie hilft euch zu erkennen, wann ein Ticket wirklich ein Feature erweitert und wann es das Domänenmodell verschiebt.
- Gerade fuer Q&A-, Quiz- und Session-Tickets ist das der Unterschied zwischen lokalem Fix und sauberer Produktentscheidung.

---

## Woche 9: Qualitaet, Tests und Definition of Done

### Lernziel

Die Studierenden koennen erklaeren, wie sich DoD, Tests, CI und Review-Regeln gegenseitig verstaerken.

### Schwerpunkt

- DoD in `Backlog.md`
- Testregeln in `AGENT.md`
- CI ueber `.github/workflows/ci.yml`
- Sicherheits-, UI- und Integrationspruefungen

### Lehrwert

Hier wird sichtbar, dass Qualitaet nicht nur aus Unit-Tests besteht, sondern aus Prozess, Automatisierung und Standards.

### Was das fuer eure Arbeit im Praktikum heisst

- Spätestens bei PR, CI oder Abgabe ist das direkt euer Alltag.
- Diese Sitzung begründet, warum „fertig“ im Projekt mehr bedeutet als „funktioniert lokal einmal“.

---

## Woche 10: Entwicklung mit KI-Agenten unter Governance

### Lernziel

Die Studierenden verstehen den Unterschied zwischen “KI generiert Code” und “KI arbeitet innerhalb expliziter Regeln, Rollen und Artefakte”.

### Schwerpunkt

- `AGENT.md` und `.cursorrules`
- `docs/serena.md` und `mem:core` als stabiler Kontext
- Vibe-Coding-Szenario
- ADR `0007` als Beispiel fuer Promptarchitektur

### Lehrwert

Das Repo ist ein selten gutes Beispiel dafuer, wie KI-Nutzung im Entwicklungsprozess formalisiert und lehrbar gemacht werden kann.

### Was das fuer eure Arbeit im Praktikum heisst

- Ihr arbeitet selbst mit KI-Unterstuetzung, also braucht ihr Kriterien fuer sinnvolle Prompts, kleine Diffs und saubere Verifikation.
- Genau hier lernt ihr, wie KI euch beschleunigt, ohne euch die Verantwortung fuer Architektur und Qualitaet abzunehmen.

---

## 6. Empfohlene Leistungsnachweise

- Kurze Repo-Analysen zu einer Datei oder ADR
- Vergleichsreflexion zu zwei Architekturvarianten
- Mini-Review eines Pull Requests gegen DoD
- Architekturposter zu einem Themenblock
- Reflexionspapier zur Rolle von KI-Agenten in der Softwareentwicklung

---

## 7. Empfohlene Abschlussfrage der Reihe

Wie viel Architekturdisziplin, Dokumentation und Governance braucht ein Team, damit KI-Unterstuetzung die Entwicklung beschleunigt, ohne die Integritaet des Produkts zu untergraben?

---

## 8. Weiterfuehrende Lesereihenfolge im Repo

1. `README.md`
2. `docs/onboarding.md`
3. `CONTRIBUTING.md`
4. `Backlog.md`
5. `docs/architecture/handbook.md`
6. `docs/architecture/decisions/0003-use-trpc-for-api.md`
7. `docs/architecture/decisions/0004-use-yjs-for-local-first-storage.md`
8. `docs/architecture/decisions/0009-unified-live-session-channels.md`
9. `AGENT.md`
10. `docs/vibe-coding/vibe-coding-szenario.md`
