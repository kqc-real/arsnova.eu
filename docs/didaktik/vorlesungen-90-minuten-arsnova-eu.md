# 90-Minuten-Gliederungen zu 10 Vorlesungsthemen

> Detaillierte Sitzungsstruktur fuer eine Vorlesungsreihe auf Basis von `arsnova.eu`.
> Jede Sitzung ist auf 90 Minuten ausgelegt und verbindet Impuls, Repo-Lektuere, Demo und Diskussion.

---

## 1. Didaktisches Grundmuster

Fuer alle Sitzungen empfiehlt sich dieselbe Grundlogik:

- 0-10 Min: Einstieg und Leitfrage
- 10-25 Min: fachlicher und technischer Kontext
- 25-45 Min: Repo-Walkthrough an Leitdateien
- 45-65 Min: Live-Demo oder Architekturlesen am konkreten Beispiel
- 65-80 Min: Transfer, Diskussion oder Mini-Aufgabe
- 80-90 Min: Zusammenfassung und Ausblick

Die folgenden Plaene konkretisieren dieses Muster fuer die 10 Themen.

---

## 2. Sitzung 1: Onboarding in ein professionelles Monorepo

### Leitfrage

Wie erschliesst man ein fremdes Softwaresystem, ohne sich im Code zu verlieren?

### Ablauf

#### 0-10 Min: Einstieg

- Produktversprechen von `arsnova.eu` vorstellen
- Unterschied zwischen “App benutzen” und “Repo verstehen” ansprechen
- Erwartung setzen: Wir lesen nicht nur Code, sondern auch Kontextartefakte

#### 10-25 Min: Kontext

- Monorepo-Idee kurz erklaeren
- Rollen von `README.md`, `docs/onboarding.md`, `CONTRIBUTING.md` und `Backlog.md` einordnen
- “Wie wuerdet ihr anfangen?” als kurze Plenumsfrage

#### 25-45 Min: Repo-Walkthrough

- `README.md`: Produktidee, Setup, Betriebsmodell
- `docs/onboarding.md`: technische Einstiegspfad
- `CONTRIBUTING.md`: Mitarbeit und PR-Disziplin
- `Backlog.md`: Produktlandkarte

#### 45-65 Min: Demo

- Projektstruktur gemeinsam lesen
- Pfade `apps/backend`, `apps/frontend`, `libs/shared-types`, `docs`, `prisma` in ihrer Funktion erklaeren
- Frage diskutieren: Wo wuerde man eine neue Story zuerst verorten?

#### 65-80 Min: Mini-Aufgabe

- In Kleingruppen: “Erstellt einen Onboarding-Fahrplan fuer eine neue Person im Team in 6 Schritten.”

#### 80-90 Min: Abschluss

- wichtigste Heuristik: erst Orientierung, dann Implementierung
- Hausaufgabe: `Backlog.md` und `docs/architecture/handbook.md` querlesen

---

## 3. Sitzung 2: Documentation as Code und Architekturkommunikation

### Leitfrage

Wie bleibt Architekturwissen lebendig, wenn Teams und Anforderungen sich veraendern?

### Ablauf

#### 0-10 Min: Einstieg

- Problem skizzieren: Wissen nur in Koepfen oder Tickets
- Begriff “Living Documentation” einfuehren

#### 10-25 Min: Kontext

- Unterschied zwischen README, Architekturhandbuch, ADR und Backlog
- Dokumentation als Teil der Softwarearchitektur

#### 25-45 Min: Repo-Walkthrough

- `docs/architecture/handbook.md`
- `docs/cursor-context.md`
- `docs/architecture/decisions/0003-use-trpc-for-api.md`
- `docs/architecture/decisions/0004-use-yjs-for-local-first-storage.md`

#### 45-65 Min: Demo

- Eine ADR gemeinsam zerlegen: Kontext, Entscheidung, Konsequenzen, Alternativen
- zeigen, wie Architekturentscheidungen dadurch nachvollziehbar und lehrbar werden

#### 65-80 Min: Diskussion

- Wann lohnt sich eine ADR?
- Wann ist Dokumentation zu viel, wann zu wenig?

#### 80-90 Min: Abschluss

- Merksatz: Gute Architektur entsteht nicht erst in Diagrammen, sondern in gut begruendeten Entscheidungen

---

## 4. Sitzung 3: Monorepo, Shared Types und Schema-first Entwicklung

### Leitfrage

Warum beginnt dieses Projekt mit Vertraegen und nicht mit Komponenten oder Tabellen?

### Ablauf

#### 0-10 Min: Einstieg

- Problem “Backend und Frontend laufen auseinander” skizzieren
- Monorepo als Antwort darauf einfuehren

#### 10-25 Min: Kontext

- npm Workspaces kurz erklaeren
- Rolle von `shared-types` im Projekt darstellen
- Zusammenhang zwischen Prisma, Zod und tRPC andeuten

#### 25-45 Min: Repo-Walkthrough

- `libs/shared-types/src/schemas.ts`
- `prisma/schema.prisma`
- `apps/backend/src/routers/index.ts`

#### 45-65 Min: Demo

- Gemeinsam nachvollziehen, wie aus einem Zod-Schema ein Vertrag fuer mehrere Schichten wird
- Thema “Shared Types zuerst” als Teamregel diskutieren

#### 65-80 Min: Mini-Aufgabe

- Studierende markieren in einer Beispiel-Story, welche Artefakte zuerst angepasst werden muessen

#### 80-90 Min: Abschluss

- Merksatz: Schema-first reduziert Drift, aber erhoeht Disziplinanforderungen

---

## 5. Sitzung 4: tRPC und End-to-End-Typsicherheit

### Leitfrage

Wie kann eine Full-Stack-API ohne REST-Boilerplate und trotzdem strukturiert gebaut werden?

### Ablauf

#### 0-10 Min: Einstieg

- REST, GraphQL und tRPC kurz kontrastieren
- Erwartung formulieren: Wo liegt der Gewinn, wo das Risiko?

#### 10-25 Min: Kontext

- ADR `0003` vorstellen
- HTTP und WebSockets unter einer API-Abstraktion einordnen

#### 25-45 Min: Repo-Walkthrough

- `apps/backend/src/routers/index.ts`
- relevante Router im Backend
- `apps/frontend/src/app/core/trpc.client.ts`

#### 45-65 Min: Demo

- Pfad vom Router bis zum Frontend-Aufruf nachvollziehen
- diskutieren, wie Compile-Time-Fehler zur Qualitaet beitragen

#### 65-80 Min: Diskussion

- Welche Vorteile hat tRPC im Monorepo?
- Was passiert, wenn Frontend und Backend organisatorisch getrennt waeren?

#### 80-90 Min: Abschluss

- Merksatz: tRPC spart nicht nur Code, sondern verlagert Integrationssicherheit in den Compiler

---

## 6. Sitzung 5: Zero-Knowledge, Datenschutz und Data-Stripping

### Leitfrage

Wie wird aus Datenschutz eine technische Designentscheidung?

### Ablauf

#### 0-10 Min: Einstieg

- typisches Risiko in Quizsystemen schildern: Loesungen leaken vor der Freigabe
- Frage an die Gruppe: Reicht “nicht im UI anzeigen” aus?

#### 10-25 Min: Kontext

- Zero-Knowledge und Zero-Account kurz erklaeren
- Session-Kopie versus dauerhafte Datenhaltung diskutieren

#### 25-45 Min: Repo-Walkthrough

- `docs/architecture/handbook.md`
- `prisma/schema.prisma`
- `libs/shared-types/src/schemas.ts`
- `apps/backend/src/__tests__/dto-security.test.ts`

#### 45-65 Min: Demo

- Test `dto-security.test.ts` gemeinsam lesen
- unterschiedliche DTOs fuer unterschiedliche Session-Phasen erklaeren

#### 65-80 Min: Mini-Aufgabe

- Studierende formulieren fuer ein neues Feld an einer Frage die Sicherheitsfrage: “Darf das in `ACTIVE` sichtbar sein?”

#### 80-90 Min: Abschluss

- Merksatz: Datenschutz ist hier kein Banner, sondern ein Typ- und Testproblem

---

## 7. Sitzung 6: Local-First mit Yjs und IndexedDB

### Leitfrage

Was veraendert sich architektonisch, wenn die Wahrheit primaer im Browser liegt?

### Ablauf

#### 0-10 Min: Einstieg

- Cloud-First als Normalfall hinterfragen
- Begriff Local-First einfuehren

#### 10-25 Min: Kontext

- CRDT-Idee knapp erklaeren
- IndexedDB, Yjs und WebSocket-Relay in ihren Rollen einordnen

#### 25-45 Min: Repo-Walkthrough

- ADR `0004`
- `docs/architecture/quiz-library-sync.md`
- `apps/frontend/src/app/features/quiz/data/quiz-store.service.ts`

#### 45-65 Min: Demo

- Ausschnitt aus `quiz-store.service.ts` lesen
- lokale Spiegelung, IndexedDB und Yjs-Sync besprechen

#### 65-80 Min: Diskussion

- Vorteile: Offline, Datenschutz, Souveraenitaet
- Risiken: Debugging, Konflikte, Datenverlust durch geloeschten Browser-Storage

#### 80-90 Min: Abschluss

- Merksatz: Local-First ist nicht nur Technik, sondern auch ein Macht- und Vertrauensmodell

---

## 8. Sitzung 7: Realtime-Architektur fuer Live-Lehre

### Leitfrage

Welche Realtime-Muster braucht eine Anwendung fuer Live-Veranstaltungen wirklich?

### Ablauf

#### 0-10 Min: Einstieg

- Live-Szenario schildern: Lobby, Abstimmung, Ergebnisse, Q&A, Blitzlicht
- technische Herausforderungen sammeln

#### 10-25 Min: Kontext

- Rollen von tRPC-Subscriptions, Redis und Yjs unterscheiden
- Session-Lifecycle als fachliches Rueckgrat einfuehren

#### 25-45 Min: Repo-Walkthrough

- `apps/backend/src/index.ts`
- `apps/backend/src/routers/session.ts`
- `apps/backend/src/routers/quickFeedback.ts`

#### 45-65 Min: Demo

- Verfolgen, wie eine Session vom Start bis zum Ergebnis durch Zustandswechsel laeuft
- Realtime nicht nur als Push, sondern als Fachereignis lesen

#### 65-80 Min: Mini-Aufgabe

- Gruppen ueberlegen, welches Realtime-Muster sie fuer drei Features waehlen wuerden: Voting, Quiz-Sync, Live-Feedback

#### 80-90 Min: Abschluss

- Merksatz: Realtime-Architektur ist dann gut, wenn sie der Fachlogik folgt

---

## 9. Sitzung 8: Produktarchitektur mit mehreren Live-Kanaelen

### Leitfrage

Wie spiegelt sich eine gute fachliche Modellierung gleichzeitig in UX, Routen und API-Vertraegen?

### Ablauf

#### 0-10 Min: Einstieg

- Ausgangsproblem: getrennte Tools fuer Quiz, Q&A und Feedback
- Frage: Was bedeutet “eine Veranstaltung” aus Sicht der Nutzenden?

#### 10-25 Min: Kontext

- ADR `0009` einfuehren
- von Feature-Silos zu kanalbasierter Produktlogik

#### 25-45 Min: Repo-Walkthrough

- ADR `0009`
- `apps/frontend/src/app/app.routes.ts`
- Session-Komponenten im Frontend

#### 45-65 Min: Demo

- Session-Shell als gemeinsamer Einstieg erklaeren
- ein Code, mehrere Kanaele, dieselbe Person in derselben Veranstaltung

#### 65-80 Min: Diskussion

- Wie veraendert das die mentale Last fuer Nutzende?
- Welche technischen Migrationskosten bringt so eine Entscheidung?

#### 80-90 Min: Abschluss

- Merksatz: Produktarchitektur ist oft wichtiger fuer die UX als einzelne Widgets

---

## 10. Sitzung 9: Qualitaet, Tests und Definition of Done

### Leitfrage

Wie wird Qualitaet im Projekt institutionalisiert?

### Ablauf

#### 0-10 Min: Einstieg

- Unterschied zwischen “funktioniert bei mir” und “erfuellt die DoD”
- Qualitaet als Teamvereinbarung einfuehren

#### 10-25 Min: Kontext

- DoD als verbindlicher Rahmen
- Unit-, Integrations-, UI- und Sicherheitspruefung unterscheiden

#### 25-45 Min: Repo-Walkthrough

- `Backlog.md`
- `AGENT.md`
- `.github/workflows/ci.yml`
- ausgewaehlte Testdateien

#### 45-65 Min: Demo

- Beispiel: warum `dto-security.test.ts` mehr ist als ein technischer Test
- CI-Pipeline als technische Durchsetzung von Teamregeln lesen

#### 65-80 Min: Mini-Aufgabe

- Studierende formulieren fuer eine Beispiel-Story eine kleine DoD mit Test- und Reviewkriterien

#### 80-90 Min: Abschluss

- Merksatz: Qualitaet entsteht aus Regeln, Automatisierung und gemeinsamer Erwartung

---

## 11. Sitzung 10: Entwicklung mit KI-Agenten unter Governance

### Leitfrage

Wie nutzt man KI produktiv, ohne die Verantwortung an sie abzugeben?

### Ablauf

#### 0-10 Min: Einstieg

- typische Hoffnungen und Enttaeuschungen bei KI in der Entwicklung sammeln
- These setzen: KI braucht Architekturleitplanken

#### 10-25 Min: Kontext

- `AGENT.md`, `.cursorrules` und `docs/cursor-context.md` als Governance-Artefakte
- Rolle von Promptarchitektur ueber ADR `0007`

#### 25-45 Min: Repo-Walkthrough

- `AGENT.md`
- `docs/vibe-coding/vibe-coding-szenario.md`
- ADR `0007`

#### 45-65 Min: Demo

- “Code Defense” aus dem Vibe-Coding-Szenario diskutieren
- zeigen, wie Regeln Halluzinationen und Stilbrueche begrenzen sollen

#### 65-80 Min: Diskussion

- Wo endet Assistenz und wo beginnt Kontrollverlust?
- Welche Regeln sollte ein Team fuer KI-Entwicklung explizit festhalten?

#### 80-90 Min: Abschluss

- Merksatz: KI ist in professioneller Entwicklung kein Ersatz fuer Architektur, sondern ein Verstaerker vorhandener Prozesse

---

## 12. Hinweise zur Anpassung

Je nach Kursprofil lassen sich die Sitzungen unterschiedlich zuspitzen:

- fuer Software Engineering staerker auf ADRs, DoD und Teamprozesse
- fuer Web Engineering staerker auf Angular, tRPC, Yjs und Realtime
- fuer Datenschutz/Informatikrecht staerker auf Zero-Knowledge, Retention und Admin-Flow
- fuer KI-Lehre staerker auf Governance, Promptarchitektur und agentische Zusammenarbeit

---

## 13. Empfohlene Abschlussleistung

Eine geeignete Prüfungsform waere eine strukturierte Repo-Analyse zu einem Teilaspekt von `arsnova.eu`, etwa:

- Architekturreview zu einer ADR
- Sicherheitsanalyse des DTO-Musters
- Lehrkonzept fuer den Einsatz von KI-Agenten im Repo
- Verbesserungsvorschlag fuer Onboarding, Teststrategie oder Realtime-Architektur
