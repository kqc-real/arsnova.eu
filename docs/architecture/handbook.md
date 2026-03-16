<!-- markdownlint-disable MD013 -->

# 🏛️ Architektur-Handbuch: arsnova.eu

**Zuletzt aktualisiert:** 2026-03-16  
**Rolle:** Living Documentation (Documentation as Code)

**Produktstatus (Stand 2026-03):**

- Produktionsreif umgesetzt: Epics 0-5, 8 und 9.
- Plattform: Epic 6 weitgehend umgesetzt, 6.5 (Abschlusspruefung Barrierefreiheit) offen.
- Ebenfalls umgesetzt: Epic 7.1 Team-Modus.

## 1. Einleitung & Philosophie

Dieses Handbuch beschreibt die Softwarearchitektur von **arsnova.eu**. Wir folgen dem Prinzip der **"Living Documentation"**. Dieses Dokument und alle dazugehörigen Architekturentscheidungen (ADRs) leben direkt im Git-Repository. Sie entwickeln sich parallel zum Code weiter.

Das Hauptziel dieses Systems ist es, ein hochperformantes Audience-Response-System (Quiz-App für Hörsäle) zu schaffen, dessen absoluter **USP (Unique Selling Proposition)** die **100 %ige DSGVO-Konformität** ist. Das System operiert serverseitig als "Zero-Knowledge"-Infrastruktur bezüglich der geistigen Eigentümer (Fragen) der Dozenten.

---

## 2. Der Technologie-Stack (High-Level)

Wir setzen auf einen modernen, stark typisierten TypeScript-Stack (Full-Stack), der auf Typsicherheit, Entwicklererfahrung (DX) und Echtzeit-Performance optimiert ist.

- **Frontend:** Angular (v21) mit **Signals** (Zustandsverwaltung), **Standalone Components** und **Angular Material 3** (tokenbasiert, ohne Tailwind).
- **Backend:** Node.js API mit **tRPC** (für typsichere Aufrufe und WebSocket-Subscriptions).
- **Datenbank (Persistenz):** **PostgreSQL** angebunden über **Prisma ORM**.
- **Echtzeit-Broker (Flüchtig):** **Redis** (Pub/Sub für Abstimmungen).
- **Offline & Sync Engine:** **Yjs** (CRDTs für die Local-First Speicherung im Browser).

---

## 3. Kern-Architekturkonzepte

Um die Ziele des Projekts zu erreichen, müssen alle Entwickler folgende drei architektonische Säulen strikt einhalten:

### 3.1 Local-First & Zero-Knowledge (Die Yjs-Engine)

Die **Quiz-Bibliothek** der Dozenten wird *nicht dauerhaft* auf dem Server gespeichert. Wenn ein Dozent ein Quiz erstellt, lebt dieses als **CRDT-Dokument (Conflict-free Replicated Data Type)** über `Yjs` primär in der lokalen IndexedDB seines Browsers. Das Backend dient für die Quiz-Erstellung lediglich als "dummer" WebSocket-Relay-Server, um E2E-verschlüsselte Deltas (Änderungen) zwischen den Endgeräten des Dozenten (z.B. PC und iPad) zu synchronisieren. Damit der Dozent dasselbe Quiz auf einem anderen Gerät öffnen kann, erhält er einen **Sync-Link** bzw. **Sync-Code** (Story 1.6a); nur wer diesen Key hat, kann das Quiz bearbeiten oder live steuern. Der Session-Beitrittscode für Studenten gewährt keinen Zugriff auf die Quiz-Bearbeitung. Beim **Start einer Live-Session** wird eine **Kopie** des gewählten Quiz an den Server übermittelt (Quiz-Upload, Story 2.1a); diese Kopie wird nur für die Dauer der Session in PostgreSQL gehalten. Die dauerhafte "Single Source of Truth" der Quiz-Inhalte bleibt die lokale Yjs/IndexedDB des Dozenten.

### 3.2 End-to-End Typsicherheit (tRPC)

Wir verzichten auf klassische REST-Schnittstellen und das manuelle Schreiben von DTO-Klassen im Frontend. Durch die Nutzung von **tRPC v11** im Monorepo (npm Workspaces) importiert das Angular-Frontend die Typen direkt aus der API-Schicht des Backends. Wenn sich das Datenbank-Schema (Prisma) ändert, schlägt der Frontend-Build sofort fehl.

**Hinweis:** Das Frontend führt `@trpc/server` als Dependency nur für die **Bundler-Auflösung**. `@trpc/client` v11 importiert intern Teile von `@trpc/server` (z. B. Observable/RPC). Ohne diese Abhängigkeit würde der Angular-Build die Imports nicht auflösen können; serverseitige Logik wird im Frontend nicht ausgeführt.

### 3.3 Security & Data-Stripping (Das DTO-Pattern)

Während einer Live-Sitzung müssen die Fragen an die Smartphones der Studenten gesendet werden. Das Backend lädt die Daten und **muss zwingend** ein DTO (Data Transfer Object) anwenden, bevor die Daten über WebSockets versendet werden. Lösungsrelevante Felder wie `isCorrect` werden serverseitig restlos entfernt, um clientseitiges Cheating, etwa über Chrome DevTools, auszuschließen.

---

## 4. Architecture Decision Records (ADRs)

Wir dokumentieren jede signifikante Änderung an der Architektur, neue Bibliotheken oder Muster in Form von ADRs.

> 📂 **Alle Entscheidungen finden sich im Ordner:** [`./decisions`](./decisions)

**Wichtige Basis-Entscheidungen:**

- [ADR-0002: Nutzung von Angular Signals](./decisions/0002-use-angular-signals-for-ui-state.md)
- [ADR-0003: Nutzung von tRPC](./decisions/0003-use-trpc-for-api.md)
- [ADR-0004: Nutzung von Yjs (CRDTs) für Offline-Sync](./decisions/0004-use-yjs-for-local-first-storage.md)
- [ADR-0005: UI-Strategie mit Angular Material 3 (ohne Tailwind)](./decisions/0005-use-angular-material-design.md)
- [ADR-0006: Rollen, Routen und Autorisierung (Host, Teilnehmer, Admin)](./decisions/0006-roles-routes-authorization-host-admin.md)
- [ADR-0007: Promptarchitektur für KI-generierte Quizzes](./decisions/0007-prompt-architecture-ki-quiz.md)
- [ADR-0008: Internationalisierung (i18n) — Technik, Locale-Strategie und Hinweise bei Inhaltsverlust](./decisions/0008-i18n-internationalization.md)
- [ADR-0009: Unified Live-Session Channels (Quiz, Q&A, Blitzlicht)](./decisions/0009-unified-live-session-channels.md)
- [ADR-0010: Blitzlicht als Kernmodus mit konsistenter UX in Startseite und Live-Session](./decisions/0010-blitzlicht-as-core-live-mode.md)

---

## 5. Datenmodell (Single Source of Truth)

Unser relationales Datenmodell für flüchtige Live-Sessions, Quiz-Session-Kopien, Teilnehmer, Votes, Bonus-Token, Q&A und Session-Kanaele wie Blitzlicht wird zentral über Prisma verwaltet. Das aktuelle Schema findet sich in `prisma/schema.prisma`.

**Hinweis zur Anonymität:** Die App ist bewusst **accountfrei**. Es gibt kein User-/Account-Modell. Dozenten und Studierende nutzen die App ohne Registrierung. Die Zuordnung Quiz ↔ Dozent erfolgt ausschließlich über Local-First (Yjs/IndexedDB) im Browser; der Server speichert keine Nutzerkonten.

---

## 6. Betrieb, CI/CD und Production-Deployment

Der produktive Rollout erfolgt ueber GitHub Actions (`.github/workflows/ci.yml`) mit klaren Gates:

1. Build & Validate
2. Lint
3. Tests
4. Docker-Build
5. Deploy-Job, nur bei Push auf Deploy-Branch und `DEPLOY_ENABLED=true`

Der Deploy-Job ist auf **production** als GitHub Environment gebunden und fuehrt serverseitig `scripts/deploy.sh` aus.

### 6.1 Deploy-Ablauf (serverseitig)

- Git sync auf Ziel-Branch
- App-Image Build (`docker compose ... build --pull app`)
- Start von Postgres/Redis
- Prisma-Migrationen (`npx prisma migrate deploy`)
- App-Start/Update (`docker compose ... up -d app`)
- Health-Wait + HTTP-Verifikation (`/trpc/health.check`, Frontend-Shell unter `/de/`)

### 6.2 Betriebsdokumente

- Admin-Betriebsfluss: `docs/implementation/ADMIN-FLOW.md`
- Post-Deploy Go/No-Go Checkliste: `docs/implementation/POST-DEPLOY-CHECKLIST.md`

---

## 7. Performance-Leitplanken (Produktionsbetrieb)

Die wichtigsten umgesetzten Produktionsoptimierungen:

- **Redis-Hotpath entschärft:** `health.stats` nutzt SCAN statt blockierendem KEYS.
- **DB-Indexierung nach Query-Mustern:** gezielte Indizes für Session-, Vote-, Q&A-, Bonus- und Admin-Audit-Queries.
- **Polling-Reduktion / WebSocket-first:** Subscription-Intervalle entschärft und dedupliziert; Frontend-Fallback-Polling reduziert.
- **Query-Payload-Reduktion:** Hotpaths (`getCurrentQuestionForHost/Student`) laden nur noch benötigte Felder.

Grundprinzip fuer neue Features:

- erst bestehende Subscription-Pfade nutzen
- Polling nur als Fallback
- bei Last-Hotspots selektive Prisma-`select` statt breiter `include`
