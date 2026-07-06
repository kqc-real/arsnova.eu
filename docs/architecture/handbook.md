<!-- markdownlint-disable MD013 -->

# 🏛️ Architektur-Handbuch: arsnova.eu

**Zuletzt aktualisiert:** 2026-06-04
**Rolle:** Living Documentation (Documentation as Code)

**Produktstatus (Stand 2026-06-04):**

- Produktionsreif umgesetzt: Epics **0–5**, **7.1** (Team-Modus), der Kern von **8** (Q&A inkl. Sortiermodi und Tempo-Blitzlicht; offen: delegierte Moderation), **9** (Admin: Inspektion, Löschung, Behördenexport, Audit) und **10** (MOTD / Plattform-Kommunikation — ADR-0018, `docs/features/motd.md`).
- Plattform: Epic **6** im Kern umgesetzt (Theme, i18n, Legal, Responsive); offen: **6.5** (Abschlussprüfung Barrierefreiheit / WCAG) und **6.6** (UX-Testreihen _Thinking Aloud_ inkl. Umsetzung der Befunde — siehe `Backlog.md`, Story 6.6, und `docs/EPIC6-AC-PRUEFUNG.md`).
- **Plattformstatistik:** Rekord **max. Teilnehmende je Session** (`PlatformStatistic`) plus 30-Tage-Verlauf der Session-Tagesrekorde (`DailyStatistic`, `dailyHighscores`) in `health.stats` und im Server-Status-Hilfedialog.
- **Quiz-Bewertung:** `SINGLE_CHOICE`, `MULTIPLE_CHOICE` und `SHORT_TEXT` sind bewertbare Fragetypen; Leaderboards, Teamwertung, Bonus-Codes und Scorecards nutzen die gemeinsame Effective-Vote-Regel aus ADR-0028.
- **Offene Zielbilder:** Delegierte Moderation bleibt ohne eigene `/moderate`-Route und ohne Moderator-Token noch Zielbild; Tempo ist als vordefiniertes Blitzlicht-Template im aktuellen `quickFeedback`-Code umgesetzt.

## 1. Einleitung & Philosophie

Dieses Handbuch beschreibt die Softwarearchitektur von **arsnova.eu**. Wir folgen dem Prinzip der **"Living Documentation"**. Dieses Dokument und alle dazugehörigen Architekturentscheidungen (ADRs) liegen direkt im Git-Repository und entwickeln sich parallel zum Code weiter.

Das Hauptziel dieses Systems ist es, ein hochperformantes Audience-Response-System (Quiz-App für Hörsäle) zu schaffen, das konsequent **datensparsam** und **DSGVO-orientiert** aufgebaut ist. Die Quiz-Sammlung ist so gestaltet, dass Inhalte von Lehrenden standardmäßig **nicht dauerhaft serverseitig** gespeichert werden.

---

## 2. Der Technologie-Stack (High-Level)

Wir setzen auf einen modernen, stark typisierten TypeScript-Stack (Full-Stack), der auf Typsicherheit, Entwicklererfahrung (DX) und Echtzeit-Performance optimiert ist.

- **Frontend:** Angular **21.2.x** mit **Signals** (Zustandsverwaltung), **Standalone Components** und **Angular Material 3** (tokenbasiert, im Angular-Frontend ohne Tailwind).
- **Backend:** Node.js API mit **tRPC v11** (für typsichere Aufrufe und WebSocket-Subscriptions).
- **Schemas:** **Zod v4** in `@arsnova/shared-types` und Backend-Routern; DTOs werden ueber `.input()` / `.output()` an tRPC-Prozeduren gebunden.
- **Datenbank (Persistenz):** **PostgreSQL** angebunden über **Prisma ORM 7.4.x**.
- **Echtzeit-Broker (Flüchtig):** **Redis** (Rate-Limiting, Blitzlicht-/Session-Code-Zustand, Tempo-Buckets, Sliding-Windows). Live-Updates in Sessions laufen über **tRPC-WebSocket-Subscriptions**; Status- und Teilnehmerpfade sind inzwischen bevorzugt signalgetrieben mit seltenem Resync, einzelne Live-Pfade nutzen weiterhin gezieltes Polling/Fallbacks. Es gibt keinen zentralen Redis-Pub/Sub-Pfad für jedes Frage-Event.
- **Offline & Sync Engine:** **Yjs** (CRDTs für die Local-First Speicherung im Browser).

---

## 3. Kern-Architekturkonzepte

Um die Ziele des Projekts zu erreichen, müssen alle Entwickler folgende drei architektonische Säulen strikt einhalten:

### 3.1 Local-First & Zero-Knowledge (Die Yjs-Engine)

Die **Quiz-Sammlung** der Lehrenden (in der UI: **Deine Quiz-Sammlung**, Route `/quiz`) wird _nicht dauerhaft_ auf dem Server gespeichert. Wenn eine Lehrperson ein Quiz erstellt, lebt dieses als **CRDT-Dokument (Conflict-free Replicated Data Type)** über `Yjs` primär in der lokalen IndexedDB ihres Browsers. Das Backend dient für die Quiz-Erstellung als WebSocket-Relay-Server, um Deltas (Änderungen) zwischen den Endgeräten der Lehrperson (z. B. PC und iPad) zu synchronisieren. Damit dieselbe Person ein Quiz auf einem anderen Gerät öffnen kann, erhält sie einen **Sync-Link** bzw. **Sync-Code** (Story 1.6a); nur wer diesen Schlüssel hat, kann das Quiz bearbeiten oder live steuern. Der Session-Beitrittscode für Teilnehmende gewährt keinen Zugriff auf die Quiz-Bearbeitung. Beim **Start einer Live-Session** wird eine **Kopie** des gewählten Quiz an den Server übermittelt (Quiz-Upload, Story 2.1a); diese Kopie wird nur für die Dauer der Session in PostgreSQL gehalten. Die dauerhafte "Single Source of Truth" der Quiz-Inhalte bleibt die lokale Yjs/IndexedDB der Lehrperson.

**KI-gestützter Quiz-Import (externes LLM):** System-Prompt kopieren und LLM-Antwort einfügen geschieht in derselben **Quiz-Sammlung**; der Prompt bezieht Preset und Optionen aus der Startseite bzw. dem `localStorage` der Preset-Optionen (nicht aus einem einzelnen Listen-Quiz). Vertrag und Pfade: [ADR-0007](./decisions/0007-prompt-architecture-ki-quiz.md).

### 3.2 End-to-End Typsicherheit (tRPC)

Wir verzichten auf klassische REST-Schnittstellen und das manuelle Schreiben von DTO-Klassen im Frontend. Durch die Nutzung von **tRPC v11** im Monorepo (npm Workspaces) importiert das Angular-Frontend die Typen direkt aus der API-Schicht des Backends. Wenn sich das Datenbank-Schema (Prisma) ändert, schlägt der Frontend-Build sofort fehl.

**Hinweis:** Das Frontend führt `@trpc/server` als Dependency nur für die **Bundler-Auflösung**. `@trpc/client` v11 importiert intern Teile von `@trpc/server` (z. B. Observable/RPC). Ohne diese Abhängigkeit würde der Angular-Build die Imports nicht auflösen können; serverseitige Logik wird im Frontend nicht ausgeführt.

### 3.3 Security & Data-Stripping (Das DTO-Pattern)

Während einer Live-Sitzung müssen die Fragen an die Smartphones der Teilnehmenden gesendet werden. Das Backend lädt die Daten und **muss zwingend** ein DTO (Data Transfer Object) anwenden, bevor die Daten über WebSockets versendet werden. Lösungsrelevante Felder wie `isCorrect` werden serverseitig entfernt, um clientseitiges Cheating, etwa über Chrome DevTools, auszuschließen.

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
- [ADR-0011: Delegierbare Moderatorrolle für Live-Sessions](./decisions/0011-delegated-moderator-role-for-live-sessions.md)
- [ADR-0012: d3-cloud als Layout-Engine fuer Freitext-Word-Clouds](./decisions/0012-use-d3-cloud-for-freetext-word-clouds.md)
- [ADR-0013: k6 und Artillery als Standard-Stack fuer Last- und Performance-Tests](./decisions/0013-use-k6-and-artillery-for-load-and-performance-testing.md)
- [ADR-0015: Markdown-Bilder nur per URL und Lightbox-Ansicht](./decisions/0015-markdown-images-url-only-and-lightbox.md)
- [ADR-0016: Markdown/KaTeX-Editor — Split-View und eigene MD3-Toolbar](./decisions/0016-markdown-katex-editor-split-view-and-md3-toolbar.md)
- [ADR-0017: Markdown-Editor — UI-Umfang vs. KI-Import-Paste-Feld](./decisions/0017-markdown-editor-ui-scope-and-ki-import-paste-field.md)
- [ADR-0018: Message of the Day / Plattform-Kommunikation (MOTD)](./decisions/0018-message-of-the-day-platform-communication.md)
- [ADR-0021: Trennung von Betriebsstatus (SLO) und Systemlast mit Live-Telemetrie](./decisions/0021-separate-service-status-from-load-status-with-live-slo-telemetry.md)
- [ADR-0024: Session-Tagesrekord-Verlauf fuer Session-Teilnehmende im Server-Status-Hilfedialog](./decisions/0024-daily-session-records-in-server-status-help-dialog.md)
- [ADR-0025: Zukuenftige Erweiterungen standardmaessig als performance-kritisch behandeln](./decisions/0025-treat-future-extensions-as-performance-critical-until-proven-otherwise.md)
- [ADR-0026: Performance-Hotpaths priorisieren und Telemetrie-Nebenlast entkoppeln](./decisions/0026-prioritize-performance-hotpaths-and-de-escalate-telemetry-side-load.md)
- [ADR-0027: Join-Wellen mit leichtgewichtiger Admission Control glätten](./decisions/0027-smooth-join-waves-with-lightweight-admission-control.md)
- [ADR-0028: Quiz-Bewertung und Effective-Vote-Regel vereinheitlichen](./decisions/0028-quiz-scoring-and-effective-vote-rule.md)
- [ADR-0029: Tempo als vordefiniertes Blitzlicht-Template statt eigenem Session-Kanal](./decisions/0029-tempo-as-predefined-blitzlicht-template.md)
- [ADR-0031: Quiz-Editor-Aenderungserkennung zentralisieren](./decisions/0031-centralized-quiz-editor-save-detection.md)

**Vertiefende Architektur-Dokumente:**

- [Dokumentations-Landkarte (`docs/README.md`)](../README.md) · [Umgebungsvariablen (`docs/ENVIRONMENT.md`)](../ENVIRONMENT.md) · [Sicherheitsüberblick](../SECURITY-OVERVIEW.md) · [Tests & CI](../TESTING.md)
- [Projekt-Glossar (Begriffe, UI, Workflows)](../GLOSSAR.md)
- [Synchronisierung der Quiz-Sammlung](./quiz-library-sync.md)
- [Epic 6: Akzeptanzkriterien & Prüfung](../EPIC6-AC-PRUEFUNG.md) (inkl. Story 6.6 — Thinking Aloud / UX-Umsetzung)

---

## 5. Datenmodell (Single Source of Truth)

Unser relationales Datenmodell für flüchtige Live-Sessions, Quiz-Session-Kopien, Teilnehmende, Votes, Bonus-Token, Q&A, Session-Kanäle wie Blitzlicht, Session-Feedback sowie **MOTD** (Meldungen, Vorlagen, Locale-Texte, Interaktionszähler, Audit) und Plattformstatistiken (**`PlatformStatistic`**, **`DailyStatistic`**) wird zentral über Prisma verwaltet. Das aktuelle Schema findet sich in `prisma/schema.prisma`.

**Hinweis zur Anonymität:** Die App ist bewusst **accountfrei**. Es gibt kein User-/Account-Modell. Lehrende und Teilnehmende nutzen die App ohne Registrierung. Die Zuordnung Quiz ↔ Lehrperson erfolgt ausschließlich über Local-First (Yjs/IndexedDB) im Browser; der Server speichert keine Nutzerkonten.

---

## 6. Betrieb, CI/CD und Production-Deployment

Der produktive Rollout erfolgt über GitHub Actions (`.github/workflows/ci.yml`) mit klaren Gates:

1. Build & Validate (inkl. `typecheck`-Job)
2. Lint
3. Tests
4. Docker-Build
5. Deploy-Freshness-Check: Nur der aktuelle `main`-HEAD darf weiter zum Production-Deploy.
6. Deploy-Job, nur bei Push auf `main` **und** Repository-Variable `DEPLOY_ENABLED=true`; **Voraussetzung:** Alle Quality-Gates waren erfolgreich und `github.sha` ist weiterhin aktueller `main`-HEAD.

Der Deploy-Job ist an **production** als GitHub Environment gebunden und führt serverseitig `scripts/deploy.sh` mit `DEPLOY_SHA` aus. Das Skript checkt den geprüften Ziel-Commit detached aus, bevor Image-Build, Migrationen und Healthchecks laufen.

### 6.1 Deploy-Ablauf (serverseitig)

- Ziel-Commit holen und exakt per `DEPLOY_SHA` detached auschecken
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

### 7.1 Grundsatz: Performance nicht ohne Sicherheitskontext optimieren

Für arsnova.eu gilt architektonisch:

- **Sicherheit, Autorisierung und Datenschutz** sind keine optionalen Aufpreise auf Performance.
- **Maximale Performance** und **maximale Sicherheitskontrolle** sind oft ein Zielkonflikt, kein gemeinsames Maximum.
- Jede Optimierung muss deshalb auch ihre Folgen für Autorisierung, Missbrauchsschutz, Widerrufbarkeit, Auditierbarkeit und Datenminimierung benennen.

Typische Spannungsfelder:

- **Mehr Sicherheitsprüfungen** bedeuten oft mehr Roundtrips, Hash-/Token-Prüfungen, Redis-Lookups oder zusätzliche Persistenz.
- **Weniger Prüfpfade** machen Hotpaths schneller, vergrößern aber das Risiko von Rolleneskalation, Missbrauch oder stillen Fehlannahmen.
- **Mehr lokale Caches und Mirror** verbessern Reaktionszeit und Offline-Verhalten, können aber Vertrauensannahmen, Recovery-Logik und Sicherheitssemantik komplizierter machen.
- **Mehr serverseitige Kontrolle** verbessert Widerrufbarkeit und Nachweisbarkeit, schwächt aber Local-First und Zero-Knowledge.

Leitregel für neue Features:

- erst das **notwendige Sicherheitsniveau** festlegen
- dann innerhalb dieses Rahmens den Hotpath optimieren
- Optimierungen bevorzugen, die **ohne Sicherheitsabbau** wirken

Grundprinzip für neue Features:

- erst bestehende Subscription-Pfade nutzen
- Polling nur als Fallback
- bei Last-Hotspots selektive Prisma-`select` statt breiter `include`
