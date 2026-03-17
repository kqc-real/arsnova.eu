# Folienskizzen fuer 10 Vorlesungsthemen zu arsnova.eu

> Jede Skizze enthaelt Lernziele, einen moeglichen Foliensatz, Demo-Dateien im Repo und Diskussionsfragen.
> Die Skizzen sind fuer Vorlesungen, Seminare oder Blockveranstaltungen nutzbar.

---

## 1. Thema: Onboarding in ein professionelles Monorepo

### Lernziele

- Die Studierenden koennen ein fremdes Repo systematisch erschliessen.
- Die Studierenden koennen zwischen Setup-, Architektur- und Produktartefakten unterscheiden.
- Die Studierenden koennen begruenden, warum gutes Onboarding Entwicklungszeit spart.

### Folienskizze

1. Titel: Warum Onboarding ein Architekturthema ist
2. Produktbild: Was ist `arsnova.eu`?
3. Projektstruktur: `apps`, `libs`, `prisma`, `docs`
4. Einstiegspfad: README, Onboarding, Contributing
5. Backlog als Landkarte statt als To-do-Liste
6. Typische Fehler beim Einstieg in grosse Repos
7. Lesestrategie fuer die ersten 60 Minuten im Projekt
8. Fazit: Orientierung vor Implementierung

### Demo-Dateien

- `README.md`
- `docs/onboarding.md`
- `CONTRIBUTING.md`
- `Backlog.md`

### Diskussionsfragen

- Woran erkennt man in den ersten Minuten, ob ein Repo professionell gepflegt ist?
- Was fehlt in vielen studentischen Projekten, das hier bereits vorhanden ist?
- Sollte Onboarding Teil der Definition of Done sein?

---

## 2. Thema: Documentation as Code und Architekturkommunikation

### Lernziele

- Die Studierenden koennen den Unterschied zwischen README, Handbuch und ADR erklaeren.
- Die Studierenden verstehen, wie Architekturwissen im Repo versioniert wird.
- Die Studierenden koennen Nutzen und Grenzen von Living Documentation bewerten.

### Folienskizze

1. Titel: Architekturwissen im Repository
2. Das Problem impliziten Wissens
3. Living Documentation in `arsnova.eu`
4. ADR-Struktur: Kontext, Entscheidung, Konsequenzen
5. Backlog und DoD als verbindende Artefakte
6. `docs/cursor-context.md` als kondensiertes Systemwissen
7. Chancen und Pflegeaufwand
8. Fazit: Dokumentation als Teil der Architektur

### Demo-Dateien

- `docs/architecture/handbook.md`
- `docs/cursor-context.md`
- `docs/architecture/decisions/0003-use-trpc-for-api.md`
- `docs/architecture/decisions/0004-use-yjs-for-local-first-storage.md`

### Diskussionsfragen

- Welche Entscheidungen gehoeren in eine ADR und welche nicht?
- Wie verhindert man, dass Dokumentation veraltet?
- Ist “Documentation as Code” in jedem Projekt realistisch?

---

## 3. Thema: Monorepo, Shared Types und Schema-first Entwicklung

### Lernziele

- Die Studierenden verstehen das Strukturprinzip eines npm-Workspaces-Monorepos.
- Die Studierenden koennen die Rolle von `shared-types` als Integrationskern beschreiben.
- Die Studierenden koennen Schema-first Entwicklung von UI-first Entwicklung abgrenzen.

### Folienskizze

1. Titel: Warum dieses Projekt mit Vertraegen beginnt
2. Monorepo-Grundidee und Paketgrenzen
3. `shared-types` als zentrale Vertragsschicht
4. Prisma als Datenmodell
5. Zod als Laufzeit- und Typsicherheitswerkzeug
6. Auswirkungen auf Frontend und Backend
7. Vorteile, Kosten und Disziplinanforderungen
8. Fazit: Vertragsantrieb statt Ad-hoc-Integration

### Demo-Dateien

- `libs/shared-types/src/schemas.ts`
- `prisma/schema.prisma`
- `apps/backend/src/routers/index.ts`

### Diskussionsfragen

- Wann ist ein Monorepo die richtige Wahl?
- Erhoeht Schema-first den Aufwand am Anfang oder senkt es Gesamtkosten?
- Wuerdet ihr `shared-types` als eigene Bibliothek auslagern?

---

## 4. Thema: tRPC und End-to-End-Typsicherheit

### Lernziele

- Die Studierenden koennen tRPC im Vergleich zu REST und GraphQL einordnen.
- Die Studierenden verstehen, wie Frontend und Backend denselben Vertrag nutzen.
- Die Studierenden koennen Nutzen und Grenzen enger Typlogik im Monorepo bewerten.

### Folienskizze

1. Titel: API ohne OpenAPI-Codegen?
2. Problem klassischer REST-Boilerplate
3. ADR `0003`: Entscheidung fuer tRPC
4. `appRouter` als zentraler Einstieg
5. Typimport im Frontend
6. WebSockets und Queries unter derselben Abstraktion
7. Risiken: Kopplung, Monorepo-Abhaengigkeit, Einarbeitung
8. Fazit: Typsicherheit als Integrationsstrategie

### Demo-Dateien

- `docs/architecture/decisions/0003-use-trpc-for-api.md`
- `apps/backend/src/routers/index.ts`
- `apps/frontend/src/app/core/trpc.client.ts`

### Diskussionsfragen

- Waere REST fuer ein Lehrprojekt leichter zu vermitteln?
- Wie stark darf Frontend vom Backend-Typensystem abhaengen?
- Ist tRPC vor allem eine DX- oder eine Architekturentscheidung?

---

## 5. Thema: Zero-Knowledge, Datenschutz und Data-Stripping

### Lernziele

- Die Studierenden koennen Zero-Knowledge im Kontext des Projekts korrekt erklaeren.
- Die Studierenden verstehen das DTO-Pattern als Sicherheitsmechanismus.
- Die Studierenden koennen Datenschutzanforderungen in technische Pruefregeln uebersetzen.

### Folienskizze

1. Titel: Datenschutz als Systementwurf
2. Zero-Account und Zero-Knowledge im Projekt
3. Gefahr: Loesungsleak im aktiven Quiz
4. DTOs fuer unterschiedliche Session-Phasen
5. Data-Stripping im Backend
6. Test `dto-security.test.ts`
7. Datenschutz als Architektur statt Add-on
8. Fazit: Sicherheit braucht Typen, Tests und Prozesse

### Demo-Dateien

- `docs/architecture/handbook.md`
- `libs/shared-types/src/schemas.ts`
- `apps/backend/src/__tests__/dto-security.test.ts`
- `prisma/schema.prisma`

### Diskussionsfragen

- Reicht es, sensible Daten nicht anzuzeigen?
- Welche Felder waeren bei neuen Fragetypen kritisch?
- Wie ueberzeugt man Produktverantwortliche von solchem Sicherheitsaufwand?

---

## 6. Thema: Local-First mit Yjs und IndexedDB

### Lernziele

- Die Studierenden verstehen die Grundidee von CRDTs.
- Die Studierenden koennen Local-First als Produkt- und Architekturentscheidung beschreiben.
- Die Studierenden koennen Chancen und Risiken lokaler Datenhaltung bewerten.

### Folienskizze

1. Titel: Wenn der Browser die Primaerquelle wird
2. Was bedeutet Local-First?
3. ADR `0004`: Warum Yjs?
4. IndexedDB, WebSocket-Relay und Sync-Link
5. `quiz-store.service.ts` als technische Umsetzung
6. Vorteile: Offline, Datenschutz, Datensouveraenitaet
7. Risiken: Debugging, Browser-Storage, Komplexitaet
8. Fazit: Local-First als bewusstes Gegenmodell

### Demo-Dateien

- `docs/architecture/decisions/0004-use-yjs-for-local-first-storage.md`
- `docs/architecture/quiz-library-sync.md`
- `apps/frontend/src/app/features/quiz/data/quiz-store.service.ts`

### Diskussionsfragen

- Warum ist Local-First gerade fuer `arsnova.eu` sinnvoll?
- Wo waere klassische Serverspeicherung trotzdem einfacher?
- Ist die zusaetzliche Komplexitaet didaktisch und technisch gerechtfertigt?

---

## 7. Thema: Realtime-Architektur fuer Live-Lehre

### Lernziele

- Die Studierenden koennen verschiedene Realtime-Muster im Projekt unterscheiden.
- Die Studierenden verstehen, dass Realtime fachlich und nicht nur technologisch motiviert ist.
- Die Studierenden koennen geeignete Realtime-Mechanismen fuer Features begruenden.

### Folienskizze

1. Titel: Realtime jenseits von “wir brauchen WebSockets”
2. Live-Anforderungen im Hoersaal
3. Session-Lifecycle als Ereignismodell
4. tRPC-Subscriptions, Redis und Yjs im Vergleich
5. `session`, `quickFeedback` und `qa` als unterschiedliche Live-Kerne
6. Countdown, Lobby, Voting und Ergebnisanzeige
7. Robustheit statt Technologie-Euphorie
8. Fazit: Realtime folgt der Fachlogik

### Demo-Dateien

- `apps/backend/src/index.ts`
- `apps/backend/src/routers/session.ts`
- `apps/backend/src/routers/quickFeedback.ts`
- `apps/backend/src/routers/qa.ts`

### Diskussionsfragen

- Welches Live-Feature braucht welches Realtime-Muster?
- Wann ist Polling ausreichend, wann nicht?
- Ist Realtime hier eher ein UX- oder ein Infrastrukturthema?

---

## 8. Thema: Produktarchitektur mit mehreren Live-Kanaelen

### Lernziele

- Die Studierenden verstehen, wie fachliche Modellierung technische Struktur beeinflusst.
- Die Studierenden koennen die Idee “eine Veranstaltung, ein Code, eine App” erklaeren.
- Die Studierenden koennen Vor- und Nachteile kanalbasierter Session-Modelle diskutieren.

### Folienskizze

1. Titel: Vom Feature-Silo zur Veranstaltung
2. Ausgangslage: getrennte Modi und mentale Brueche
3. ADR `0009`: Einheitliche Session-Shell
4. Quiz, Q&A und Blitzlicht als Kanaele
5. Routing und Session-Einstieg
6. Auswirkungen auf Datenmodell und DTOs
7. UX-Gewinne und Migrationskosten
8. Fazit: Produktarchitektur ist Domänenmodellierung

### Demo-Dateien

- `docs/architecture/decisions/0009-unified-live-session-channels.md`
- `apps/frontend/src/app/app.routes.ts`
- Session-Komponenten unter `apps/frontend/src/app/features/session/`

### Diskussionsfragen

- Warum ist “eine Veranstaltung” das bessere mentale Modell?
- Wo entstehen durch Vereinheitlichung neue Komplexitaeten?
- Wuerdet ihr Blitzlicht als separaten Modus oder als Kanal modellieren?

---

## 9. Thema: Qualitaet, Tests und Definition of Done

### Lernziele

- Die Studierenden koennen die DoD als Qualitaetsrahmen interpretieren.
- Die Studierenden verstehen das Zusammenspiel von Tests, CI und Reviewregeln.
- Die Studierenden koennen Qualitaetskriterien auf eine neue Story anwenden.

### Folienskizze

1. Titel: Qualitaet ist organisiert, nicht zufaellig
2. DoD in `Backlog.md`
3. Testpflicht in `AGENT.md`
4. CI-Pipeline als Regelvollzug
5. Sicherheits-, UI- und Typpruefungen
6. Beispiele aus Tests und Workflows
7. Qualitaet als Teamkultur
8. Fazit: DoD operationalisiert Architektur

### Demo-Dateien

- `Backlog.md`
- `AGENT.md`
- `.github/workflows/ci.yml`
- `apps/backend/src/__tests__/dto-security.test.ts`

### Diskussionsfragen

- Wie konkret muss eine DoD sein, damit sie wirksam wird?
- Was sollte automatisiert werden, was bewusst im Review bleiben?
- Wie verhindert man, dass Qualitaetsregeln nur auf dem Papier existieren?

---

## 10. Thema: Entwicklung mit KI-Agenten unter Governance

### Lernziele

- Die Studierenden verstehen, wie KI-Leitplanken im Repo institutionalisiert werden.
- Die Studierenden koennen agentische KI-Nutzung von reinem Code-Autocomplete unterscheiden.
- Die Studierenden koennen Chancen und Risiken regelgebundener KI-Entwicklung reflektieren.

### Folienskizze

1. Titel: KI als Architekturasistent, nicht als Ersatzarchitekt
2. Vibe Coding im Projektkontext
3. `AGENT.md`, `.cursorrules` und `cursor-context`
4. Baby-Steps, Shared Types zuerst, Testpflicht
5. Code Defense gegen fehlerhafte KI-Ausgaben
6. ADR `0007`: Promptarchitektur als Softwarearchitektur
7. Chancen, Grenzen und Verantwortung
8. Fazit: KI braucht Governance

### Demo-Dateien

- `AGENT.md`
- `.cursorrules`
- `docs/cursor-context.md`
- `docs/vibe-coding/vibe-coding-szenario.md`
- `docs/architecture/decisions/0007-prompt-architecture-ki-quiz.md`

### Diskussionsfragen

- Welche Regeln sind fuer KI-gestuetzte Entwicklung unverzichtbar?
- Wie viel Freiheit darf ein KI-Agent in einem produktiven Repo haben?
- Ist KI in diesem Projekt eher Beschleuniger, Risiko oder beides?

---

## 11. Optionaler Einsatz in der Lehre

Die Folienskizzen lassen sich auf drei Arten nutzen:

- als klassische Vorlesungsfolien mit anschliessender Repo-Demo
- als Seminarleitfaden fuer studentische Gruppenpraesentationen
- als Grundlage fuer pruefungsnahe Architektur- oder Reviewaufgaben

---

## 12. Didaktischer Hinweis

Die groesste Staerke von `arsnova.eu` als Lehrgegenstand liegt darin, dass Produktidee, Architektur, Prozesse, Tests und KI-Governance nicht auseinanderfallen. Genau deshalb eignet sich das Repo nicht nur fuer eine Technikvorlesung, sondern auch fuer Software Engineering, Datenschutz, Qualitaetsmanagement und KI-unterstuetzte Entwicklung.
