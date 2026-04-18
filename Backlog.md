# 📋 Product Backlog: arsnova.eu

> **Priorisierung:** 🔴 Must · 🟡 Should · 🟢 Could
>
> **Abhängigkeiten (Kernpfad):** Epic 0 → Epic 1 → Epic 2 → Epic 3 → Epic 4 → Epic 5 ✅
>
> **Nächster Fokus (Auswahl offener Stories):** u. a. **0.7** (Last- & Performance-Tests), **0.8** (Komplexitätsabbau / McCabe-Refactor), **6.5**/**6.6** (Barrierefreiheit / UX-Testreihen), **1.2d** (numerische Schätzfrage), **1.6c** (Sync-Sicherheit), **8.5–8.7** (Q&A-Erweiterungen) — **Epic 6** im Kern (6.1–6.4: Theme, i18n, Legal, Responsive) ist umgesetzt ✅. **Lehre:** Greenfield-Demo **1.7a** in **3×45 Min.** — [`docs/didaktik/greenfield-demo-1-7a-vorlesung.md`](docs/didaktik/greenfield-demo-1-7a-vorlesung.md).
>
> **Weitere Parallelpfade:** Epic 9 ✅ (Admin: Inspektion, Löschen, Auszug für Behörden) · Epic 10 ✅ (MOTD / Plattform-Kommunikation — ADR-0018, `docs/features/motd.md`)

---

## 📊 Story-Übersicht & Bearbeitungsstand

| Epic | Story | Titel                                                       | Prio | Status    |
| ---- | ----- | ----------------------------------------------------------- | ---- | --------- |
| 0    | 0.1   | Redis-Setup                                                 | 🔴   | ✅ Fertig |
| 0    | 0.2   | tRPC WebSocket-Adapter                                      | 🔴   | ✅ Fertig |
| 0    | 0.3   | Yjs WebSocket-Provider                                      | 🟡   | ✅ Fertig |
| 0    | 0.4   | Server-Status-Indikator                                     | 🟡   | ✅ Fertig |
| 0    | 0.5   | Rate-Limiting & Brute-Force-Schutz                          | 🔴   | ✅ Fertig |
| 0    | 0.6   | CI/CD-Pipeline (GitHub Actions)                             | 🔴   | ✅ Fertig |
| 0    | 0.7   | Last- & Performance-Tests mit E2E-Szenarien                 | 🟡   | ⬜ Offen  |
| 0    | 0.8   | Komplexitätsabbau (McCabe) & Refactor-Hotspots              | 🟡   | ⬜ Offen  |
| 1    | 1.1   | Quiz erstellen                                              | 🔴   | ✅ Fertig |
| 1    | 1.2a  | Fragentypen: MC & SC                                        | 🔴   | ✅ Fertig |
| 1    | 1.2b  | Fragentypen: Freitext & Umfrage                             | 🟡   | ✅ Fertig |
| 1    | 1.2c  | Fragentyp: Rating-Skala                                     | 🟡   | ✅ Fertig |
| 1    | 1.2d  | Numerische Schätzfrage (Toleranz, 2 Runden, Statistik)      | 🟡   | ⬜ Offen  |
| 1    | 1.3   | Antworten & Lösungen                                        | 🔴   | ✅ Fertig |
| 1    | 1.4   | Sitzungs-Konfiguration                                      | 🟡   | ✅ Fertig |
| 1    | 1.5   | Local-First Speicherung                                     | 🔴   | ✅ Fertig |
| 1    | 1.6   | Yjs Multi-Device-Sync                                       | 🟢   | ✅ Fertig |
| 1    | 1.6a  | Quiz auf anderem Gerät öffnen (Sync-Key/Link)               | 🟡   | ✅ Fertig |
| 1    | 1.6b  | Preset & Optionen beim Sync mitführen                       | 🟢   | ✅ Fertig |
| 1    | 1.6c  | Sync-Sicherheit härten                                      | 🔴   | ⬜ Offen  |
| 1    | 1.6d  | Sync-Performance & Skalierung optimieren                    | 🟡   | ⬜ Offen  |
| 1    | 1.7   | Markdown & KaTeX                                            | 🔴   | ✅ Fertig |
| 1    | 1.7a  | Markdown-Bilder: nur URL + Lightbox                         | 🟡   | ✅ Fertig |
| 1    | 1.7b  | Markdown/KaTeX-Editor mit MD3-Toolbar                       | 🟡   | ✅ Fertig |
| 1    | 1.8   | Quiz exportieren                                            | 🟡   | ✅ Fertig |
| 1    | 1.9   | Quiz importieren                                            | 🟡   | ✅ Fertig |
| 1    | 1.9a  | KI-gestützter Quiz-Import (Zod-Validierung)                 | 🟡   | ✅ Fertig |
| 1    | 1.9b  | KI-Systemprompt (kontextbasiert, schema-getreu)             | 🟡   | ✅ Fertig |
| 1    | 1.10  | Quiz bearbeiten & löschen                                   | 🔴   | ✅ Fertig |
| 1    | 1.11  | Quiz-Presets                                                | 🟡   | ✅ Fertig |
| 1    | 1.12  | SC-Schnellformate                                           | 🟡   | ✅ Fertig |
| 1    | 1.13  | Quiz-Preview & Schnellkorrektur                             | 🟡   | ✅ Fertig |
| 1    | 1.14  | Word Cloud (interaktiv + Export)                            | 🟡   | ✅ Fertig |
| 1    | 1.14a | Word Cloud 2.0 (echtes Layout + Premium-UX)                 | 🟡   | ⬜ Offen  |
| 1    | 1.15  | Preset-Konfiguration exportieren & importieren              | 🟢   | ✅ Fertig |
| 2    | 2.1a  | Session-ID & Quiz-Upload                                    | 🔴   | ✅ Fertig |
| 2    | 2.1b  | QR-Code                                                     | 🟢   | ✅ Fertig |
| 2    | 2.1c  | Host-/Presenter-Zugang mit Session-Token härten             | 🔴   | ✅ Fertig |
| 2    | 2.2   | Lobby-Ansicht                                               | 🔴   | ✅ Fertig |
| 2    | 2.3   | Präsentations-Steuerung                                     | 🔴   | ✅ Fertig |
| 2    | 2.4   | Security / Data-Stripping                                   | 🔴   | ✅ Fertig |
| 2    | 2.5   | Beamer-Ansicht / Presenter-Mode                             | 🔴   | ✅ Fertig |
| 2    | 2.6   | Zwei-Phasen-Frageanzeige (Lesephase)                        | 🟡   | ✅ Fertig |
| 2    | 2.7   | Peer Instruction (zweite Abstimmung, Vorher/Nachher)        | 🟡   | ✅ Fertig |
| 2    | 2.8   | Produktives Smartphone-Hosting für Live-Sessions            | 🔴   | ✅ Fertig |
| 3    | 3.1   | Beitreten                                                   | 🔴   | ✅ Fertig |
| 3    | 3.2   | Nicknames                                                   | 🟡   | ✅ Fertig |
| 3    | 3.3a  | Frage empfangen                                             | 🔴   | ✅ Fertig |
| 3    | 3.3b  | Abstimmung abgeben                                          | 🔴   | ✅ Fertig |
| 3    | 3.4   | Echtzeit-Feedback                                           | 🟡   | ✅ Fertig |
| 3    | 3.5   | Countdown-Anzeige                                           | 🔴   | ✅ Fertig |
| 3    | 3.5a  | Countdown Finger-Anzeige (letzte 6 Sekunden)                | 🟡   | ✅ Fertig |
| 3    | 3.6   | Anonymer Modus                                              | 🟡   | ✅ Fertig |
| 4    | 4.1   | Leaderboard mit Punktesystem                                | 🟡   | ✅ Fertig |
| 4    | 4.2   | Server aufräumen                                            | 🔴   | ✅ Fertig |
| 4    | 4.3   | WebSocket Reconnection                                      | 🟡   | ✅ Fertig |
| 4    | 4.4   | Ergebnis-Visualisierung                                     | 🔴   | ✅ Fertig |
| 4    | 4.5   | Freitext-Auswertung                                         | 🟡   | ✅ Fertig |
| 4    | 4.6   | Bonus-Code für Top-Platzierungen                            | 🟡   | ✅ Fertig |
| 4    | 4.7   | Ergebnis-Export für Lehrende (anonym)                       | 🟡   | ✅ Fertig |
| 4    | 4.8   | Session-Bewertung durch Teilnehmende                        | 🟡   | ✅ Fertig |
| 5    | 5.1   | Sound-Effekte                                               | 🟡   | ✅ Fertig |
| 5    | 5.3   | Hintergrundmusik                                            | 🟢   | ✅ Fertig |
| 5    | 5.4   | Belohnungseffekte                                           | 🟡   | ✅ Fertig |
| 5    | 5.4a  | Foyer-Einflug im Preset Spielerisch                         | 🟡   | ⬜ Offen  |
| 5    | 5.5   | Answer Streak                                               | 🟡   | ✅ Fertig |
| 5    | 5.6   | Persönliche Scorecard                                       | 🔴   | ✅ Fertig |
| 5    | 5.7   | Motivationsmeldungen                                        | 🟡   | ✅ Fertig |
| 5    | 5.8   | Emoji-Reaktionen                                            | 🟢   | ✅ Fertig |
| 6    | 6.1   | Dark/Light/System-Theme                                     | 🟡   | ✅ Fertig |
| 6    | 6.2   | Internationalisierung                                       | 🟡   | ✅ Fertig |
| 6    | 6.3   | Impressum & Datenschutz                                     | 🔴   | ✅ Fertig |
| 6    | 6.4   | Mobile-First & Responsive                                   | 🔴   | ✅ Fertig |
| 6    | 6.5   | Barrierefreiheit (Prüfung Projektende)                      | 🔴   | ⬜ Offen  |
| 6    | 6.6   | UX-Testreihen Thinking Aloud & Umsetzung                    | 🟡   | ⬜ Offen  |
| 6    | 6.7   | Startseite: Hero-Chips; Session-Ende Toolbar + Kanal-Button | 🔴   | ✅ Fertig |
| 7    | 7.1   | Team-Modus                                                  | 🟢   | ✅ Fertig |
| 8    | 8.1   | Q&A-Session starten                                         | 🟢   | ✅ Fertig |
| 8    | 8.2   | Fragen einreichen                                           | 🟢   | ✅ Fertig |
| 8    | 8.3   | Upvoting & Sortierung                                       | 🟢   | ✅ Fertig |
| 8    | 8.4   | Moderation durch Lehrende                                   | 🟢   | ✅ Fertig |
| 8    | 8.5   | Delegierbare Q&A-Moderation für Tutor:innen                 | 🟡   | ⬜ Offen  |
| 8    | 8.6   | Q&A: Kontroversitäts-Score & Sortierung                     | 🟡   | ⬜ Offen  |
| 8    | 8.7   | Q&A: Sortierung „Beste Fragen“ (Wilson-Score)               | 🟡   | ⬜ Offen  |
| 9    | 9.1   | Admin: Sessions & Quiz-Inhalte inspizieren                  | 🟡   | ✅ Fertig |
| 9    | 9.2   | Admin: Session/Quiz löschen (rechtlich)                     | 🟡   | ✅ Fertig |
| 9    | 9.3   | Admin: Auszug für Behörden/Staatsanwaltschaft               | 🟡   | ✅ Fertig |
| 10   | 10.1  | MOTD: Datenmodell, Migration, Zod/DTOs                      | 🟡   | ✅ Fertig |
| 10   | 10.2  | MOTD: Öffentliche Read-API + Rate-Limiting                  | 🟡   | ✅ Fertig |
| 10   | 10.3  | MOTD: Admin tRPC (CRUD, Templates, Zeitsteuerung)           | 🟡   | ✅ Fertig |
| 10   | 10.4  | MOTD: Admin-UI (CMS-light, Markdown, Vorschau)              | 🟡   | ✅ Fertig |
| 10   | 10.5  | MOTD: Startseiten-Overlay + localStorage                    | 🟡   | ✅ Fertig |
| 10   | 10.6  | MOTD: Interaktionen (Ack, Dismiss, Feedback, API)           | 🟡   | ✅ Fertig |
| 10   | 10.7  | MOTD: Header-Icon, Archiv, Lazy Load, i18n-Inhalte          | 🟡   | ✅ Fertig |
| 10   | 10.8  | MOTD: Härtung (Sanitize, A11y, Audit, Tests)                | 🟡   | ✅ Fertig |

> **Repo-Abgleich (Codebase 2026-04-03):** Die **⬜-Stories** sind weiterhin durch den Stand im Monorepo begründet: u. a. kein Fragentyp numerische Schätzung in `QuestionTypeEnum` (`libs/shared-types`); Word Cloud weiterhin ohne ADR-0012/`d3-cloud`-Layout (vgl. `word-cloud.component`); Q&A-Sortierung nur nach Upvotes, **keine** Kontrovers-/Wilson-Berechnung im Router; kein ausführbares **k6**-/Artillery-Lasttest-Setup (ADR-0013 dokumentarisch). **Umgesetzt** sind jetzt u. a. **2.1c** (Host-/Presenter-Härtung via Host-Token und `hostProcedure`) sowie die besitzgebundene Quiz-Historie per `accessProof` ohne eigene Story-ID. Die **✅-Einträge** wurden stichprobenartig nicht widerlegt. _Ohne eigene Story-ID:_ Rekord **max. Teilnehmende pro Session** in `health.stats` / Hilfe-Seite (`PlatformStatistic`, u. a. Migration `platform_statistic_max_participants`).
>
> **Legende Status:** ⬜ Offen · 🔨 In Arbeit · ✅ Fertig (DoD erfüllt) · ❌ Blockiert
>
> **Statistik:** 🔴 Must: 29 · 🟡 Should: 55 · 🟢 Could: 11 = **95 Stories gesamt** (**80** ✅ Fertig · **15** ⬜ Offen)

---

## ✅ Definition of Done (DoD)

Eine Story gilt als **fertig**, wenn **alle** folgenden Kriterien erfüllt sind:

### Code-Qualität

- Code kompiliert fehlerfrei (`tsc --noEmit` für Backend, Frontend und shared-types).
- Kein `any`-Typ im gesamten Code (Regel aus AGENT.md §3).
- Alle tRPC-Endpunkte validieren Ein-/Ausgaben über Zod-Schemas aus `@arsnova/shared-types`.
- Das DTO-Pattern ist eingehalten: Daten werden serverseitig durch DTOs gefiltert, bevor sie an Clients gesendet werden.
- `isCorrect` wird **niemals** im Status `ACTIVE` an Teilnehmende übertragen (Data-Stripping-Regel, Story 2.4).

### Tests

- Mindestens ein Unit-Test pro tRPC-Mutation/-Query (Happy Path + ein Fehlerfall).
- Automatisierter Test, dass `QuestionStudentDTO` im Status `ACTIVE` kein `isCorrect` enthält.
- Automatisierter Test, dass `AnswerOptionRevealedDTO` im Status `RESULTS` `isCorrect` korrekt enthält.

### Frontend

- Komponenten nutzen ausschließlich **Standalone Components** + **Angular Signals** (kein `BehaviorSubject` für UI-State).
- Neue `@if` / `@for` Control-Flow-Syntax — kein `*ngIf` / `*ngFor`.
- Mobile-First: Layout funktioniert ab 320 px Viewport-Breite ohne horizontales Scrollen.
- Touch-Targets ≥ 44 × 44 px (WCAG 2.5.5).
- Alle interaktiven Elemente per Tastatur erreichbar (`Tab`, `Enter`/`Space`), sichtbarer Fokusring.
- Dark- und Light-Theme korrekt (Material Design 3 Theme-Tokens, Kontrast ≥ 4.5:1 WCAG AA).
- `prefers-reduced-motion` wird respektiert (Animationen deaktiviert/reduziert).
- Kein neuer Lighthouse-Accessibility-Score-Rückgang unter 90.

### Barrierefreiheit (WCAG 2.1 AA)

- Semantisches HTML (`<label>`, `<button>`, Überschriften-Hierarchie).
- `aria-label` / `aria-live` für dynamische Inhalte (Countdown, Zahl der Teilnehmenden, Feedback).
- Farbunabhängigkeit: Richtig/Falsch zusätzlich über Icons (✓/✗) und Text kommuniziert.

### Datenschutz (DSGVO)

- Keine personenbezogenen Daten werden ohne Zweckbindung gespeichert.
- Session-Daten (Votes, Participants) werden nach Beendigung (Story 4.2) bzw. nach 24 h automatisch bereinigt.
- Aggregierte Statistiken (Story 0.4) exponieren keine Einzelpersonen.
- Anonymer Modus (Story 3.6) verhindert pseudonymisierte Zuordnung.

### Dokumentation

- Neue/geänderte tRPC-Endpunkte sind mit JSDoc-Kommentaren versehen.
- Bei Architektur-Änderungen: ADR erstellt oder bestehendes ADR aktualisiert (`docs/architecture/decisions/`).
- Prisma-Schema, Zod-Schemas und Backlog sind synchron (keine Widersprüche zwischen den drei Artefakten).
- Neue oder geänderte **nutzerrelevante UI-/Workflow-Begriffe** sind in `docs/GLOSSAR.md` ergänzt oder dort per Verweis abgedeckt (siehe Pflegehinweis in der Datei).

### Deployment

- `docker compose up` startet das gesamte System (PostgreSQL, Redis, Backend, Frontend) ohne manuelle Eingriffe.
- Keine neuen `npm audit`-Schwachstellen mit Severity ≥ high.

---

## Epic 0: Infrastruktur & Plattform (Rolle: Entwickler)

> **Verifizierung im laufenden Betrieb:** 2025-02-23 — Prisma validate ✅, tsc (shared-types, backend, frontend) ✅, Vitest (health + rateLimit, 21 Tests) ✅, ESLint ✅. Docker/Redis via docker-compose.yml und Health-Check-Code geprüft; Frontend wsLink/httpBatchLink und ServerStatusWidget geprüft; CI-Workflow und README-Badge geprüft.  
> **Build + Laufbetrieb (2025-02-23):** `npm run build` ✅ (inkl. Fix Session-Template @else). `docker compose up -d postgres redis` ✅, `prisma db push` ✅. Backend gestartet: `health.check` → redis=ok ✅, `health.stats` → activeSessions/totalParticipants/completedSessions/serverStatus ✅, WebSocket-Server (Story 0.2) erreichbar ✅, Frontend `ng serve` + Startseite mit Status-Widget erreichbar ✅.  
> **Ergänzung Plattform-Rekord (2026-04-01):** `health.stats` liefert zusätzlich den historischen Höchstwert **max. gleichzeitige Teilnehmende in einer Session** (`maxParticipantsSingleSession`, Zeitstempel `maxParticipantsStatisticUpdatedAt`) aus der Tabelle `PlatformStatistic` (atomare Aktualisierung u. a. beim Join, `apps/backend/src/lib/platformStatistic.ts`); die Hilfe-Seite zeigt den Wert. Migration: `20260401110000_platform_statistic_max_participants`.

- **Story 0.1 (Redis-Setup):** 🔴 Als Entwickler möchte ich eine funktionierende Redis-Instanz (via Docker Compose) haben, damit Echtzeit-Features darauf aufbauen können.
  - **Akzeptanzkriterien:**
    - [x] `docker compose up` startet Redis neben PostgreSQL.
    - [x] Backend kann sich erfolgreich mit Redis verbinden (Health-Check erweitert).
- **Story 0.2 (tRPC WebSocket-Adapter):** 🔴 Als Entwickler möchte ich den tRPC-Server um einen WebSocket-Adapter (`@trpc/server/adapters/ws`) erweitern, damit Subscriptions (Echtzeit-Events) möglich werden.
  - **Akzeptanzkriterien:**
    - [x] WebSocket-Server läuft parallel zum HTTP-Server.
    - [x] Ein Test-Subscription-Endpoint (`health.ping`) sendet alle 5s ein Heartbeat-Event.
    - [x] Frontend-tRPC-Client nutzt `wsLink` für Subscriptions und `httpBatchLink` für Queries/Mutations.
- **Story 0.3 (Yjs WebSocket-Provider):** 🟡 Als Entwickler möchte ich einen Yjs-WebSocket-Provider im Backend einrichten, damit Lehrende ihre Quizzes zwischen Geräten (PC ↔ iPad) synchronisieren können.
  - **Akzeptanzkriterien:**
    - [x] `y-websocket`-Server ist im Backend integriert.
    - [x] Ein Yjs-Dokument kann von zwei Browser-Tabs synchron gehalten werden.
- **Story 0.4 (Server-Status-Indikator):** 🟡 Als Besucher der Startseite möchte ich auf einen Blick sehen, wie ausgelastet der Server ist, damit ich die aktuelle Nutzung einschätzen kann.
  - **Akzeptanzkriterien:**
    - [x] tRPC-Query `health.stats` liefert: Anzahl laufender Quizzes, Gesamtzahl aktiver Teilnehmender, Server-Status (`healthy` / `busy` / `overloaded`).
    - [x] Die Startseite zeigt die Werte als kompaktes Status-Widget an (z. B. „3 Quizzes live · 142 Teilnehmende · 1.247 Quizzes durchgeführt“).
    - [x] Ein farbiger Indikator visualisiert den Server-Status: grün (healthy), gelb (busy), rot (overloaded).
    - [x] Schwellwerte für Status: `healthy` < 50 Sessions, `busy` < 200 Sessions, `overloaded` ≥ 200 Sessions.
    - [x] Anzahl bisher durchgeführter Quizzes (`completedSessions`) wird als Gesamtstatistik angezeigt.
    - [x] Die Daten werden alle 30 Sekunden automatisch aktualisiert (Polling).
    - [x] Es werden keine personenbezogenen Daten exponiert (nur aggregierte Zahlen).
    - [x] ⚠️ _Abhängigkeit:_ Vor Umsetzung von Story 2.1a liefert die Query Initialwerte (`activeSessions: 0`, `totalParticipants: 0`, `completedSessions: 0`).
- **Story 0.5 (Rate-Limiting & Brute-Force-Schutz):** 🔴 Als System möchte ich Missbrauch durch automatisierte Anfragen verhindern, damit die Plattform stabil und fair bleibt.
  - **Akzeptanzkriterien:**
    - [x] **Session-Code-Eingabe (Story 3.1):** Maximal 5 Fehlversuche pro IP-Adresse innerhalb von 5 Minuten. Nach Überschreitung wird eine 60-Sekunden-Sperre verhängt mit Hinweismeldung.
    - [x] **Vote-Submit (Story 3.3b):** Maximal 1 Request pro Sekunde pro Participant (Token-Bucket). Überschüssige Requests erhalten HTTP 429 mit `Retry-After`-Header.
    - [x] **Session-Erstellung (Story 2.1a):** Maximal 10 Sessions pro IP pro Stunde.
    - [x] Rate-Limits werden über Redis (`ioredis`) mit Sliding-Window-Algorithmus umgesetzt (abhängig von Story 0.1).
    - [x] Bei Überschreitung wird ein strukturierter tRPC-Error (`TOO_MANY_REQUESTS`) mit verbleibender Wartezeit zurückgegeben.
    - [x] Limits sind als Umgebungsvariablen konfigurierbar (nicht hart kodiert).
- **Story 0.6 (CI/CD-Pipeline):** 🔴 Als Entwickler möchte ich eine automatische CI/CD-Pipeline (GitHub Actions) haben, damit Code-Qualität bei jedem Push und Pull-Request sichergestellt wird und Docker-Images für das Deployment bereitstehen.
  - **Akzeptanzkriterien:**
    - [x] **CI-Workflow (`.github/workflows/ci.yml`):** Wird bei Push auf `main` und bei Pull-Requests ausgelöst.
    - [x] **TypeScript-Kompilierung:** `tsc --noEmit` für `libs/shared-types`, `apps/backend` und `apps/frontend` — alle drei müssen fehlerfrei kompilieren.
    - [x] **Prisma-Validierung:** `prisma validate` prüft das Schema auf Korrektheit.
    - [x] **Linting:** ESLint prüft alle `.ts`-Dateien auf Regelverstöße (Root-Config: `eslint.config.mjs`).
    - [x] **Security-Audit:** `npm audit --audit-level=high` meldet keine bekannten Schwachstellen mit Severity ≥ high.
    - [x] **Docker-Image:** Multi-Stage-Dockerfile baut ein produktionsfertiges Image (`node:20-alpine`).
    - [x] **Docker-Build:** CI baut das Docker-Image erfolgreich (kein Push in Registry, nur Build-Test).
    - [x] **Caching:** `node_modules` wird via `actions/cache` zwischengespeichert, um CI-Laufzeit zu verkürzen.
    - [x] **Matrix-Test:** Pipeline läuft auf Node.js 20 und 22 (Kompatibilitätstest).
    - [x] **Tests:** Job `test` führt Backend-Unit-Tests aus (Vitest: health.check, health.stats, Rate-Limiting).
    - [x] **Status-Badge:** README.md enthält ein CI-Status-Badge (`![CI](https://github.com/...)`).
- **Story 0.7 (Last- & Performance-Tests mit E2E-Szenarien):** 🟡 Als Entwickler möchte ich reproduzierbare Last- und Performance-Tests mit realitätsnahen E2E-Szenarien haben, damit Engpässe in Live-Sessions, Join-Flows, Freitext, Q&A und Synchronisierung früh erkannt und vor Releases messbar bewertet werden können.
  - **Akzeptanzkriterien:**
    - Es gibt ein eigenes Test-Setup für Last- und Performance-Prüfungen, das lokal und in CI oder einer dedizierten Prüf-Umgebung ausführbar ist.
    - Die Tests decken nicht nur einzelne HTTP-Requests ab, sondern vollständige E2E-Szenarien mit Frontend, Backend, WebSocket/tRPC und Redis.
    - Mindestens folgende Szenarien sind automatisiert abbildbar:
      - viele parallele Joins in eine Lobby
      - Start einer Live-Session mit Quiz
      - gleichzeitige Abstimmungen auf eine aktive Frage
      - Freitext-Eingaben mit Live-Auswertung / Word-Cloud
      - Q&A-Fragen einreichen und moderieren
      - Reconnect-Szenarien bei unterbrochener WebSocket-Verbindung
      - optionale Sync-Szenarien für Quiz-Sammlungen auf mehreren Clients
    - Es gibt definierte Laststufen, z. B. klein, mittel und hoch, die mit festen Profilen wiederholbar gestartet werden können.
    - Für jede Laststufe werden zentrale Metriken erfasst, mindestens:
      - Zeit bis Join erfolgreich abgeschlossen ist
      - Latenz für Session-Statuswechsel
      - Latenz bis ein Vote oder Freitext-Eintrag in Host/Presenter sichtbar wird
      - Fehlerrate / Timeout-Rate
      - Reconnect-Dauer nach Verbindungsabbruch
      - CPU- und Speicherverhalten von Frontend und Backend, soweit praktikabel
    - Es gibt klare Schwellwerte oder Zielkorridore, ab wann ein Szenario als bestanden, degradiert oder fehlgeschlagen gilt.
    - Die Tests liefern maschinenlesbare Ergebnisse und eine für Entwickler:innen gut lesbare Zusammenfassung.
    - Ergebnisse können zwischen Läufen verglichen werden, damit Performance-Regressionen sichtbar werden.
    - E2E-Lasttests sind von funktionalen Standardtests getrennt, damit normale CI-Laufzeiten nicht unnötig explodieren.
    - Für Pull-Requests gibt es mindestens einen leichten Smoke-/Performance-Check; schwerere Lasttests dürfen zeitgesteuert, manuell oder auf dedizierten Branches laufen.
    - Die Testdaten und Szenarien sind deterministisch genug, dass Ergebnisse nicht durch Zufall stark schwanken.
    - Das Setup berücksichtigt die reale Architektur von arsnova.eu mit tRPC, WebSocket-Subscriptions, Redis und Yjs- bzw. Sync-Komponenten.
    - Lasttests für Live-Sessions respektieren das Sicherheitsmodell; es werden keine Abkürzungen genutzt, die Host-/Presenter-/Teilnehmerpfade unrealistisch vereinfachen.
    - Für besonders kritische Flows gibt es explizite Benchmarks, mindestens für:
      - Lobby-Join bei hoher Gleichzeitigkeit
      - Vote-Submit unter Last
      - Freitext-Live-Auswertung
      - Session-Start
    - Die Dokumentation beschreibt, wie die Lasttests gestartet werden, welche Infrastruktur benötigt wird und wie Resultate zu interpretieren sind.
    - Neue Performance-Erkenntnisse aus diesen Tests fliessen in Backlog, ADRs oder Optimierungsstories zurück.
    - **Architekturvorgabe:** Die Tool-Auswahl und Rollentrennung folgen ADR-0013; `k6` ist der Standard für protokollnahe Lasttests, `Artillery` für Realtime- und E2E-nahe Lastszenarien, `Playwright` bleibt funktionale Browser-Referenz und `autocannon` ist nur ein lokales Entwicklerwerkzeug für Hotspots.
  - **Abhängigkeiten:** Story 0.2 (tRPC WebSocket-Adapter), Story 0.5 (Rate-Limiting), Story 0.6 (CI/CD), Story 2.1a (Session-Start), Story 2.2 (Lobby), Story 3.1 (Join), Story 3.3b (Abstimmung), Story 4.5 (Freitext-Auswertung), Story 8.1–8.4 (Q&A), optional Story 1.6/1.6a/1.6b/1.6d (Sync), ADR-0013.

- **Story 0.8 (Komplexitätsabbau / McCabe-Refactor):** 🟡 Als Entwickler möchte ich überhöhte zyklomatische Komplexität in priorisierten Hotspots systematisch reduzieren, damit Wartbarkeit, Änderbarkeit und Fehlersicherheit steigen, ohne funktionale Regressionen einzuführen.
  - **Akzeptanzkriterien:**
    - Es liegt ein reproduzierbarer Komplexitäts-Report (McCabe/Cyclomatic) für Backend und Frontend vor, der mindestens **Durchschnitt**, **P95**, **Maximum** und die **Top-Hotspots** ausweist.
    - Es gibt eine priorisierte Hotspot-Liste (mindestens Top-10) mit Datei, Funktion/Block und aktuellem Komplexitätswert als Arbeitsgrundlage.
    - Für die zuerst zu bearbeitenden Hotspots ist ein Refactor-Plan dokumentiert (Schnittstellen, Zerlegungsschritte, Risiken, benötigte Tests).
    - Die bearbeiteten Hotspots werden verhaltensgleich in kleinere Einheiten aufgeteilt (z. B. Validierung, Mapping, Orchestrierung getrennt); öffentliche API/UX bleibt unverändert.
    - Nach Umsetzung sind Build, Typecheck und bestehende Test-Suiten grün; kritische Flows erhalten bei Bedarf zusätzliche Regressionstests.
    - Messbarer Effekt: **P95** und **Maximum** sinken gegenüber dem initialen Report; zusätzlich werden keine neuen Funktionen mit Komplexität > 15 eingeführt.
    - Für künftige Änderungen existiert eine dauerhafte Leitplanke (CI-Check oder verbindlicher manueller Quality-Gate-Check), damit neue Ausreißer früh sichtbar sind.
  - **Anker im Repo (erste Hotspots):**
    - `apps/frontend/src/app/features/session/session-vote/session-vote.component.ts`
    - `apps/backend/src/routers/vote.ts`
    - `apps/backend/src/routers/session.ts`
    - `apps/frontend/src/app/features/quiz/data/quiz-store.service.ts`

---

## Epic 1: Quiz-Verwaltung (Rolle: Lehrperson / Ersteller:in)

> **Verifizierung Epic 1 (2026-03-09, ergänzt 2026-04-01, 2026-04-07, 2026-04-17):** Die **nummerierten** Kern-Stories **1.1–1.15** (ohne Buchstaben-Zusätze) sind auf **✅ Fertig** gesetzt — siehe Übersichtstabelle. **Offen** bleiben die Erweiterungen **1.2d**, **1.6c**, **1.6d**, **1.14a** (dort ⬜). **Story 1.7a** und **Story 1.7b** sind umgesetzt und auf **✅ Fertig** gesetzt.
> Frontend-Checks: `npm run typecheck -w @arsnova/frontend` ✅, `npm run test -w @arsnova/frontend -- src/app/features/quiz` ✅ (54/54).  
> Ergänzend abgeschlossen: Styleguide-/DoD-Nacharbeiten (Lesbarkeit/Spacing, Wording-Konsistenz, deutsches Datumsformat `de-DE`, Fehlerfokus auf erstes ungültiges Feld, Entfernung fragiler `::ng-deep`-Selektoren im Quiz-Feature, Preview-Interaktions- und Markdown/KaTeX-Rendering-Korrekturen).

- **Story 1.1 (Quiz erstellen):** 🔴 Als Lehrperson möchte ich ein neues Quiz anlegen und benennen können.
  - **Akzeptanzkriterien:**
    - Ein Formular (Name, optionale Beschreibung) erstellt ein neues Quiz.
    - Das Quiz erscheint in einer lokalen Quiz-Liste.
    - Name darf nicht leer sein und max. 200 Zeichen haben.
- **Story 1.2a (Fragentypen: MC & SC):** 🔴 Als Lehrperson möchte ich Multiple-Choice- und Single-Choice-Fragen hinzufügen können.
  - **Akzeptanzkriterien:**
    - Frage-Formular mit Typ-Auswahl (MC/SC) und mindestens 2 Antwortoptionen.
    - MC erlaubt mehrere korrekte Antworten, SC genau eine.
    - Fragen werden in der Quiz-Ansicht sortiert angezeigt.
    - Fragenstamm und Antwortoptionen unterstützen Markdown & KaTeX (siehe Story 1.7).
    - Pro Frage kann ein Schwierigkeitsgrad (EASY / MEDIUM / HARD) ausgewählt werden (default: MEDIUM).
- **Story 1.2b (Fragentypen: Freitext & Umfrage):** 🟡 Als Lehrperson möchte ich Freitext- und Umfrage-Fragen hinzufügen können.
  - **Akzeptanzkriterien:**
    - Freitext-Fragen haben keine vordefinierten Antwortoptionen.
    - Umfrage-Fragen haben Optionen, aber kein `isCorrect`-Flag.
    - Freitext- und Umfrage-Fragen werden im Leaderboard-Scoring (Story 4.1) nicht gewertet — sie vergeben 0 Punkte und zählen nicht zur `totalQuestions`-Summe.
- **Story 1.2c (Fragentyp: Rating-Skala):** 🟡 Als Lehrperson möchte ich eine Bewertungsskala-Frage (1–5 oder 1–10) stellen können, um Meinungsbilder und Zufriedenheitswerte zu erheben.
  - **Akzeptanzkriterien:**
    - Neuer Fragentyp `RATING` in der Typ-Auswahl.
    - Die Lehrperson konfiguriert die Skala: Minimum (default: 1), Maximum (5 oder 10), optionale Labels für Min/Max (z.B. „Stimme gar nicht zu" / „Stimme voll zu").
    - Auf dem Teilnehmenden-Gerät wird die Skala als horizontale Reihe von Sternen, Zahlen oder Punkten dargestellt (1 Tap = Auswahl).
    - RATING-Fragen werden **nicht** gescored (wie SURVEY) — 0 Punkte, kein `isCorrect`.
    - **Ergebnis-Visualisierung:** Histogramm (Balkendiagramm der Häufigkeiten pro Stufe) + Durchschnittswert + Standardabweichung.
    - Prisma: Neues Feld `Vote.ratingValue Int?` für den gewählten Skalenwert. Neues Feld `Question.ratingMin`, `Question.ratingMax`, `Question.ratingLabelMin`, `Question.ratingLabelMax`.
- **Story 1.2d (Numerische Schätzfrage – Toleranz, Zwei-Runden-Option, detaillierte Statistik):** 🟡 Als Lehrperson möchte ich **numerische Schätzfragen** stellen können, bei denen ich **Zahlentyp** (ganzzahlig / Dezimal mit maximaler Nachkommastellenanzahl), **Referenzwert** und **Toleranzband** für die Wertung „richtig“ vorgebe; optional mit **zwei Abstimmungsrunden** inkl. Diskussionsphase (analog Peer Instruction). Als Host möchte ich nach Freigabe der Ergebnisse eine **beamer-taugliche Visualisierung** und eine **detaillierte statistische Auswertung beider Runden** sehen – **ohne** vorherigen Herdeneffekt durch Live-Verteilungen.
  - **Akzeptanzkriterien:**
    - **Fragentyp & Editor (Lehrperson):** Neuer Fragentyp (Arbeitsname z. B. `NUMERIC_ESTIMATE` o. Ä.) in `@arsnova/shared-types` (Zod) und Quiz-Editor: Konfiguration mindestens von **Toleranz (exklusiver Modus – genau einer aktiv)**, **numerischer Eingabetyp** (**Ganzzahl** vs. **Dezimal** mit **max. Nachkommastellen**), optional **Min/Max** der erlaubten Eingabe (Plausibilität, nicht Lösungsverrat). Fragentext weiterhin Markdown/KaTeX (Story 1.7), wo fachlich passend.
      - **Modus „Absolutes Intervall“:** Lehrperson konfiguriert **linke** und **rechte Intervallgrenze** \(L, R\) (absolut; asymmetrisch erlaubt). Validierung: \(L < R\).
      - **Modus „Relatives Toleranzband“:** Lehrperson konfiguriert **Referenzwert** \(V\) und **Prozentwert** \(p\%\). Das Band berechnet sich als \([V - |V|\cdot p,\; V + |V|\cdot p]\) (Grenzen anschließend min/max-sortiert). Sonderfall: Bei \(V = 0\) ist der relative Modus nicht zulässig (verständliche Fehlermeldung im Editor).
    - **Teilnehmenden-UI & Validierung:** Eingabefeld, das den konfigurierten Typ erzwingt (z. B. `step`, Validierung); **Normalisierung** von Eingaben (Komma/Punkt) einheitlich auf Client und Server. Ungültige Eingaben (kein Zahlwert, zu viele Nachkommastellen, außerhalb optionaler Min/Max) werden mit einer **lokalisierten** Fehlermeldung abgewiesen; es wird kein Vote gespeichert/gesendet. In der Teilnehmendenansicht wird **nicht** angezeigt, ob die Eingabe innerhalb des Toleranzintervalls/-bands liegt (kein Lösungsverrat).
    - **Wertung:** Antwort gilt als **richtig**, wenn der geparste Zahlenwert \(x\) **innerhalb des konfigurierten Toleranzintervalls/-bands** liegt; sonst falsch. Der Server ist maßgeblich; `isCorrect` wird gemäß Data-Stripping **nicht** während `ACTIVE` an Teilnehmende übertragen (Story 2.4).
    - **Zwei-Runden-Option (Pflicht-Feature des Typs):** Gleiches fachliches Muster wie **Peer Instruction** (Story 2.7): **Runde 1** → optionale **Diskussionsphase** (Host-Steuerung) → **Runde 2**; **getrennte Speicherung** der Werte pro Runde, **zuordenbar** zur **Teilnehmenden-Identität** (z. B. `participantId` / bestehendes Vote-Modell), damit **paarweise** Auswertung möglich ist. Ohne aktivierte zweite Runde verhält sich die Frage wie **eine** Schätzrunde (Abwärtskompatibilität des Flows).
    - **Herdeneffekt / Vorab-Visualisierung:** **Während** die Abstimmung läuft und **bis zur definierten Ergebnisfreischaltung** (Host-Aktion oder Statuswechsel analog bestehender Ergebnislogik): **keine** Histogramme, **keine** animierten Balken und **keine** aggregierte Verteilung, aus der Schätzlagen erkennbar wären (weder für Studierende noch in einer für den Saal sichtbaren Form). **Erlaubt** sind nur **neutrale** Fortschrittsanzeigen (z. B. „n von N haben abgestimmt“) ohne Wertachse/Buckets.
    - **Host-Screen nach Freigabe:** **Histogramm** (große, lesbare Balken; sinnvolles Binning), **Referenzlinie** für \(V\), **visuelles Toleranzband**, optional Balken **im Band** vs. **außerhalb** farblich differenziert; **Kennzahlenzeile** (mindestens **n**, **Median**, **Mittelwert**, **Anteil im Toleranzband** in %). Darstellung **beamer-tauglich** (Kontrast, keine Mikrotypografie-Abhängigkeit).
    - **Animationen:** **Balken-Animationen** (Höhe wachsen o. Ä.) **nur nach** Ergebnisfreischaltung, **nicht** davor. **`prefers-reduced-motion: reduce`:** keine oder stark reduzierte Bewegung (Projekt-Styleguide / ADR-konform).
    - **Detaillierte statistische Analyse beider Runden:** Nach Freigabe (bzw. in dedizierter Auswertungs-/Export-Ansicht) **mindestens** je Runde: **n** gültige Abgaben, **Mittelwert**, **Median**, **Standardabweichung**, **IQR** (oder Quartile), **Min/Max**, **Anteil im Toleranzband**, **mittlerer absoluter Fehler** \(|x - V|\) (optional **mittlerer relativer Fehler** nur wenn \(V \neq 0\) und definiert). **Vergleich R1 → R2:** Differenz der Lagemaße, Differenz des Anteils im Band (Prozentpunkte). **Paarweise Auswertung** (gleiche Person): Anzahl **näher an \(V\)**, **weiter weg**, **unverändert** (mit Toleranz für Gleichheit); Verteilung von \(\Delta x = x_2 - x_1\) (z. B. kleines Histogramm oder aggregierte Zählung). Ohne Paarzuordnung: nur **unabhängiger** Vergleich der beiden Verteilungen kennzeichnen.
    - **Datenschutz / Anzeige:** In der **Live-Host-Ansicht** nur **aggregierte** Kennzahlen und Histogramme **ohne** Zuordnung zu Namen; keine öffentliche Liste aller Einzelwerte mit Personenbezug.
    - **Backend & API:** Neues bzw. erweitertes Modell in Prisma + tRPC; **alle** Ein-/Ausgaben über Zod in `@arsnova/shared-types`; DTO/Data-Stripping für Teilnehmende einhalten. Integration in Session-/Vote-Flow (Stories **2.3**, **2.7**, **3.3a/b**, **4.1**, **4.4**) sowie Export (Story **4.7**) soweit fachlich nötig **spezifizieren und umsetzen**.
    - **Tests:** Unit-Tests für Toleranzlogik, Parsing, Rundung/Grenzfälle (\(V=0\), leere Runde 2); mindestens ein Integrationstest-Pfad für Zwei-Runden-Speicherung; Frontend-Specs für kritische Validierung wo sinnvoll.
    - **i18n (ADR-0008):** Alle neuen UI-Strings (Lehrperson, Host, Teilnehmende, Fehlermeldungen) in **de, en, fr, es, it**.
  - **Abhängigkeiten:** Story **1.7** (Markdown/KaTeX), Story **1.3** (Antwortlogik ggf. erweitern; klären ob Antwortoptionen entfallen), Story **2.7** (Peer-Instruction-/Zweirunden-Flow als fachliches Vorbild), Story **3.3b** (Abstimmung), Story **4.1** / **4.4** (Scoring & Visualisierung), Story **2.4** (Data-Stripping).
- **Story 1.3 (Antworten & Lösungen):** 🔴 Als Lehrperson möchte ich Antwortmöglichkeiten definieren und korrekte Antworten markieren können.
  - **Akzeptanzkriterien:**
    - Antworten können hinzugefügt, bearbeitet und gelöscht werden.
    - Mindestens eine Antwort muss als korrekt markiert sein (außer bei SURVEY/FREETEXT).
    - `isCorrect`-Felder werden primär lokal im Browser gespeichert (Yjs/IndexedDB).
    - Beim Live-Schalten (Story 2.1a) werden `isCorrect`-Felder einmalig an den Server übertragen, damit das serverseitige Scoring (Story 4.1) möglich ist. Sie werden dort nur temporär für die Dauer der Session vorgehalten.
- **Story 1.4 (Sitzungs-Konfiguration):** 🟡 Als Lehrperson möchte ich globale Einstellungen für mein Quiz festlegen können.
  - **Akzeptanzkriterien:**
    - Toggle für `showLeaderboard` (default: an).
    - Toggle für `allowCustomNicknames` (default: an).
    - Optional: Standard-Timer (5–300 Sekunden), überschreibbar pro Frage.
    - Auswahl des Nickname-Themas (`nicknameTheme`, default: Nobelpreisträger; siehe Story 3.2).
    - Toggle für `enableSoundEffects` (default: an; siehe Story 5.1).
    - Toggle für `enableRewardEffects` (default: an; siehe Story 5.4).
    - Auswahl der Hintergrundmusik (`backgroundMusic`, optional; siehe Story 5.3).
- **Story 1.5 (Local-First Speicherung):** 🔴 Als Lehrperson möchte ich, dass mein Quiz automatisch lokal in meinem Browser (IndexedDB via Yjs) gespeichert wird, ohne Account-Zwang.
  - **Akzeptanzkriterien:**
    - Quiz-Daten werden als Yjs-Dokument in IndexedDB persistiert.
    - Nach Browser-Neustart sind alle Quizzes sichtbar.
    - Kein Server-Roundtrip nötig zum Speichern.
- **Story 1.6 (Yjs Multi-Device-Sync):** 🟢 Als Lehrperson möchte ich mein Quiz auf mehreren Geräten synchron bearbeiten können.
  - **Akzeptanzkriterien:**
    - Änderungen auf Gerät A erscheinen in <2s auf Gerät B.
    - Konflikte werden automatisch via CRDT aufgelöst.
    - Abhängig von Story 0.3.
    - UX für „Quiz auf anderem Gerät öffnen“ siehe Story 1.6a.
- **Story 1.6a (Quiz auf anderem Gerät öffnen – Sync-Key/Link):** 🟡 Als Lehrperson möchte ich einen persönlichen Sync-Link oder Sync-Code für ein Quiz erhalten, damit ich dasselbe Quiz auf einem anderen Gerät (z. B. Tablet) öffnen, weiterbearbeiten oder von dort aus live schalten kann – ohne dass Teilnehmende über den Session-Code das Quiz bearbeiten können.
  - **Akzeptanzkriterien:**
    - In der Quiz-Detailansicht bzw. im Editor gibt es eine Option **„Auf anderem Gerät öffnen“** (oder vergleichbar), die einen **Sync-Link** (URL mit Dokument-ID) und/oder einen kurzen **Sync-Code** (z. B. zum Abtippen) sowie optional einen **QR-Code** anzeigt.
    - Der Sync-Link enthält die Yjs-Dokument-ID (Room-Name); wer den Link öffnet, verbindet sich mit demselben Yjs-Dokument und sieht das Quiz zur Bearbeitung bzw. zur Session-Steuerung (wie auf dem ersten Gerät).
    - Auf dem anderen Gerät: Nutzer gibt die App-URL ein, öffnet den Sync-Link (oder scannt den QR-Code / gibt den Sync-Code ein) und gelangt zum **gleichen Quiz** (Bearbeitung, Preview, ggf. Session starten/steuern). Kein erneutes Anlegen des Quiz nötig.
    - **Trennung von Session-Code:** Der 6-stellige Session-Beitrittscode (für Teilnehmende) wird nicht als Sync-Key verwendet und gewährt keinen Zugriff auf die Quiz-Bearbeitung. Nur wer den Sync-Link/Code hat, kann das Quiz bearbeiten oder live steuern.
    - Abhängig von Story 1.6 (Yjs Multi-Device-Sync) und Story 0.3 (y-websocket).
- **Story 1.6b (Preset & Optionen beim Sync mitführen):** 🟢 Als Lehrperson möchte ich beim Synchronisieren mit einem anderen Client (Sync-Link/Key, Story 1.6/1.6a) auch meine **Preset- und Optionen-Einstellungen** (Seriös/Spielerisch, alle Toast-Optionen wie Leaderboard, Sound, Lesephase, Team, …) mitgeführt haben, damit auf dem anderen Gerät dieselben Voreinstellungen ankommen und nicht auf Standard zurückfallen.
  - **Akzeptanzkriterien:**
    - Preset (home-preset) und Optionen (home-preset-options) werden nicht nur in localStorage gehalten, sondern zusätzlich in einem **kleinen Yjs-Dokument** (z. B. „Preferences“) persistiert, das über den **gleichen Sync-Kanal** wie das Quiz (oder einen abgeleiteten Room) synchronisiert wird.
    - Beim Öffnen eines Sync-Links auf dem anderen Client werden diese Einstellungen übernommen (Preset-Anzeige, Optionen-Chips); bei Konflikt gewinnt „last write“ oder CRDT-Merge (z. B. einzelne Optionen als Y-Map).
    - Ohne aktiven Sync bleibt das bisherige Verhalten (nur localStorage); mit Sync werden Änderungen an Preset/Optionen ins Yjs-Dokument geschrieben und so auf andere Clients übertragen.
    - Abhängig von Story 1.6 bzw. 1.6a (Sync-Link/Key muss vorhanden sein).
- **Story 1.6c (Sync-Sicherheit härten):** 🔴 Als Lehrperson möchte ich, dass geteilte Quiz-Sammlungen sicherer geöffnet werden können, damit ein versehentlich weitergegebener oder missverstandener Sync-Zugang nicht stillschweigend Vollzugriff gewährt.
  - **Teilstand 2026-04-03:** Die UI-Kommunikation wurde geschärft: Der **Sync-Link** wird als eigentlicher Zugriffsschlüssel benannt, und Geräte-/Herkunftsangaben werden in UI und Architektur-Doku ausdrücklich als **Vertrauenssignale** beschrieben. Die Story bleibt dennoch offen, weil der serverseitige Missbrauchsschutz für Sync-Raum-Zugriffe sowie der Härtungspfad für **signierte Share-Tokens** und **Link-Rotation** noch fehlen.
  - **Akzeptanzkriterien:**
    - Die UI erklärt klar, dass der **Sync-Link** der eigentliche Zugriffsschlüssel ist.
    - Für Sync-Raum-Zugriffe existiert ein Schutzkonzept gegen Missbrauch (mindestens Rate-Limit oder gleichwertige Begrenzung auf Relay-/Proxy-Ebene).
    - Ein Härtungspfad für **signierte Share-Tokens** und **Link-Rotation** ist konzipiert und dokumentiert.
    - Herkunfts- und Geräteangaben werden im UI und in der Doku ausdrücklich als **Vertrauenssignale**, nicht als manipulationssichere Sicherheitsnachweise beschrieben.
- **Story 1.6d (Sync-Performance & Skalierung optimieren):** 🟡 Als Lehrperson möchte ich, dass die Synchronisierung meiner Quiz-Sammlung auch bei größeren Sammlungen und mehreren Geräten flüssig bleibt, damit Bearbeitung und Gerätewechsel nicht durch spürbare Verzögerungen ausgebremst werden.
  - **Akzeptanzkriterien:**
    - Kurzfristige Optimierungen reduzieren unnötige Vollserialisierung und bündeln lokale Persistenzvorgänge.
    - Für größere Sammlungen werden Messpunkte dokumentiert oder implementiert (z. B. Snapshot-Größe, Dauer von Mirror-/Yjs-Writes, Anzahl von Writes pro Aktion).
    - Der Legacy-Mirror in `localStorage` ist auf seine Notwendigkeit geprüft und kann perspektivisch reduziert oder entfernt werden.
    - Ein technischer Zielpfad für eine granularere Yjs-Modellierung (`Y.Map`/`Y.Array` statt JSON-Blob) ist dokumentiert.
    - Die Architektur-Dokumentation benennt klar, welche Quick Wins bereits umgesetzt sind und welche Skalierungsmaßnahmen noch offen bleiben.
- **Story 1.7 (Markdown & KaTeX):** 🔴 Als Lehrperson möchte ich im Fragenstamm und in den Antwortoptionen Markdown und KaTeX-Formeln verwenden können, damit ich mathematische und formatierte Inhalte ansprechend darstellen kann.
  - **Akzeptanzkriterien:**
    - Fragenstamm (`Question.text`) und Antworttext (`AnswerOption.text`) akzeptieren Markdown-Syntax (Fett, Kursiv, Listen, Code-Blöcke, Bilder).
    - KaTeX-Auszeichnungen (Inline `$...$` und Block `$$...$$`) werden als gerenderte Formeln angezeigt.
    - Beim Bearbeiten einer Frage zeigt eine Live-Preview den gerenderten Markdown- und KaTeX-Inhalt neben dem Editor an.
    - Die Preview aktualisiert sich bei jeder Tastatureingabe (Debounce ≤300ms).
    - Ungültige KaTeX-Syntax zeigt eine lesbare Fehlermeldung in der Preview statt zu crashen.
    - Die gerenderte Darstellung wird auch den Teilnehmenden in der Live-Session korrekt angezeigt (Story 3.3a).
    - Verwendete Libraries: `marked` (Markdown) + `katex` (Mathematik), kein serverseitiges Rendering nötig.
- **Story 1.7a (Markdown-Bilder: nur URL + Lightbox):** ✅ Als Lehrperson bzw. als Teilnehmende:r möchte ich Bilder in Markdown-Fragen nur über **externe HTTPS-URLs** einbinden und ein eingebettetes Bild per **Tap/Klick in einer großen Ansicht** sehen (wie in gängigen Messenger-Apps), damit **Datenschutz** gewahrt bleibt und Bilder auf dem **Smartphone** gut erkennbar sind.
  - **Akzeptanzkriterien:**
    - Es gibt **keinen** Bild-Upload und **keine** Speicherung von Bilddateien auf arsnova.eu-Servern für Quiz-/Session-Markdown-Inhalte; im Markdown bleiben nur **URL-Strings** (z. B. `![Alt](https://…)`).
    - **Nur sichere Bild-URLs** werden gerendert (Mindeststandard: **`https:`**; unsichere oder verbotene Schemata wie `data:`/`javascript:` für Bilder werden nicht ausgeführt — siehe **ADR-0015**).
    - In allen relevanten **Markdown-Render-Ansichten** (mindestens: Live-Preview beim Quiz bearbeiten, Teilnehmenden-Ansicht Vote, Present, Host bei gerendertem Fragentext) öffnet ein **Klick/Tap auf das Bild** eine **große Overlay-Ansicht** (z. B. Material-Dialog): Bild zentriert, maximal sichtbar, abgedunkelter Hintergrund.
    - **Schließen** der Ansicht: Backdrop-Tap, Schließen-Steuerung und **Escape** (Desktop); **Fokus** und **ARIA** für Barrierefreiheit.
    - **i18n:** UI-Strings (z. B. Schließen, optionaler Hinweis) in **de/en/fr/es/it** (ADR-0008).
    - Architekturentscheidung und Policy sind in **ADR-0015** festgehalten.
- **Story 1.7b (Markdown/KaTeX-Editor mit MD3-Toolbar):** ✅ Als Lehrperson möchte ich Fragen- und Antworttexte in einem **Split-View** bearbeiten (**Markdown-Quelle** + **Live-Vorschau** mit KaTeX) und Formatierungen, Links, **externe Bild-URLs** und Formeln **per Klick auf eine eigene Material-3-Toolbar** einfügen, damit die Bearbeitung auf dem **Smartphone** nutzbar bleibt und dieselbe Darstellung wie in der **Live-Session** zuverlässig widerspiegelt wird.
  - **Akzeptanzkriterien:**
    - **Split-View:** Markdown-Quelltext und Vorschau sind gleichzeitig nutzbar; die Vorschau aktualisiert sich mit **Debouncing** (z. B. ≤ 300 ms) wie bei Story 1.7.
    - **Gemeinsame Logik:** Vorschau nutzt dieselbe **Markdown-/KaTeX- und Sanitize-Strategie** wie die bestehende Session-/Preview-Darstellung (kein „zweites, stilles“ Rendering ohne Abgleich).
    - **Implementierungs-Skizze (verbindliche Bausteine, ohne WYSIWYG-Pflicht):**
      - **Shared Render-Pipeline:** Eine zentrale, wiederverwendbare Einheit (z. B. `renderMarkdownWithKatex(...)` + Sanitizing + URL-Policy aus ADR-0015) erzeugt das Preview-/Session-HTML. **Alle** Views (Editor-Preview, Host/Present/Vote/Preview) nutzen **denselben** Pfad bzw. dieselbe Konfiguration.
      - **Editor-Komponente:** Eine Standalone-Editor-Komponente kapselt `textarea` (Quelle), debounced Preview und Toolbar-State mit **Signals** (kein rxjs-Zwang). Sie ist so gebaut, dass sie für **Fragetext** und **Antwortoptionen** wiederverwendbar ist (Inputs: `value`, `disabled`, `placeholder`, optional `compact`; Output: `valueChange`).
      - **Toolbar + Actions:** Toolbar-Aktionen sind als kleine, testbare Funktionen/Services modelliert (Insert/Wrap/Replace anhand von Selection-Range), damit Edge-Cases (mehrzeilig, Cursor, Undo/Redo) robust bleiben. Dialoge/Sheets (Link/Bild/Formel) liefern strukturierte Werte zurück; das Einfügen erfolgt anschließend über dieselben Action-Funktionen.
    - **Security (Angular v22 Best Practices):**
      - **Kein ungeprüftes HTML:** Es wird **kein** untrusted HTML ohne Sanitizing per `[innerHTML]` gerendert. `DomSanitizer.bypassSecurityTrustHtml(...)` wird **nur** als letzter Schritt auf **bereits sanitiztem** HTML eingesetzt (Angular Security Best Practices).
      - **Sanitizing explizit:** Die Render-Pipeline verwendet einen expliziten Sanitizer (z. B. **DOMPurify**) und eine dokumentierte Policy (Tags/Attributes/URL-Schemata). Links/Bilder müssen die URL-Policy aus ADR-0015 durchsetzen (mindestens `https:`); externe Links erhalten `rel="noopener noreferrer"` und ein sicheres `target`-Verhalten.
      - **Sanitizing-Policy (konkret, Allowlist-orientiert):**
        - **Erlaubte Tags (Minimum):** `p`, `br`, `hr`, `strong`, `em`, `s`, `code`, `pre`, `blockquote`, `ul`, `ol`, `li`, `h1`–`h4`, `a`, `img` sowie KaTeX-Output-Container (`span`) für gerenderte Formeln. Weitere Tags nur bei begründetem Bedarf ergänzen.
        - **Erlaubte Attribute:** Für Links `href`, `title`; für Bilder `src`, `alt`, `title`. **Kein** User-`style`, **keine** `on*`-Handler, keine iframes/forms/embeds. Falls für KaTeX nötig: `class` auf `span`/KaTeX-Elementen zulassen (nur zur Darstellung, nicht als Authoring-Feature).
        - **URL-Schemata:** `img[src]` **nur `https:`** (ADR-0015). `a[href]` nur aus definierter Allowlist (mind. `https:`; optional `http:`/`mailto:`). Alle anderen Schemata entfernen/neutralisieren.
        - **Link-Härtung:** Externe Links werden mit `rel="noopener noreferrer"` versehen; `target="_blank"` nur, wenn UX-seitig explizit gewünscht und konsistent umgesetzt.
    - **Empfohlene Libraries / Angular-Komponenten (Stand 2026, konform zu ADRs & Angular v22 Security):**
      - **Markdown-Parsing:** `marked` (wie Story 1.7); Security erfolgt **nicht** im Parser, sondern in der gemeinsamen Render-Pipeline.
      - **Sanitizing:** `dompurify` (Allowlist-Policy wie oben; optional `RETURN_TRUSTED_TYPE` bei strikter CSP/Trusted Types).
      - **KaTeX:** `katex` mit `trust: false` und gesetzten Limits (`maxExpand`, `maxSize`) gemäß „untrusted input“.
      - **Textarea-Insert/Wrapping (Undo/Redo best effort):** `text-field-edit` (Insert/Wrap mit besserer Browser-Unterstützung) plus eigene, testbare Action-Funktionen für Selection-Handling.
      - **MD3 UI:** `MatIconButton`/`MatButton` + `MatMenu` (Overflow), `MatDialog` (Link/Bild/Formel-Dialoge), `MatBottomSheet` (mobile Overflow/Actionsheets).
      - **A11y/Fokus:** `@angular/cdk/a11y` (z. B. `cdkTrapFocus`, `cdkFocusInitial`, `FocusMonitor`) falls über Standardverhalten hinaus benötigt.
    - **KaTeX-Sicherheit & Robustheit:**
      - KaTeX läuft mit **untrusted-input**-tauglicher Konfiguration: `trust` ist **false** (bzw. nur per enger Allowlist-Funktion, falls jemals nötig) und es sind **Limits** gesetzt (`maxExpand`, `maxSize`), um Missbrauch/DoS durch extreme Formeln zu begrenzen.
      - Fehler in KaTeX werden als **lesbare** Preview-Fehlermeldung angezeigt (kein Crash); die App bleibt interaktiv.
    - **Mobile-Definition Split-View (320 px):**
      - Auf kleinen Viewports ist „Split-View“ als **gestapelter** Split (Quelle/Preview untereinander) oder als **schneller Umschaltmodus** mit stabiler Kontextwahrung definiert; beide Paneele bleiben ohne Layout-Brüche nutzbar (keine horizontale Scroll-Fallen).
    - **A11y für Dialoge/Sheets (Link/Bild/Formel):**
      - Dialoge/Sheets setzen initialen Fokus sinnvoll, halten Fokus innerhalb des Overlays, schließen per **Escape** (wo passend) und geben Fokus nach Close an den auslösenden Toolbar-Button zurück; Titel/Labels sind über `aria-labelledby`/`aria-label` angebunden.
    - **Undo/Redo (Best-Effort):**
      - Toolbar-Inserts/Wrapping respektieren native Undo/Redo **best effort**; browserbedingte Unterschiede sind akzeptiert, aber Cursor/Selection werden nach jeder Aktion deterministisch gesetzt.
    - **MD3-Toolbar (Klick/Tap):** Aktionen mindestens für Fett, Kursiv, Überschrift (sinnvolle Stufen), Listen, Zitat, Inline-Code, Codeblock, Link (Sheet/Dialog mit Text + URL), **Bild nur per HTTPS-URL** (+ Alt-Text, **kein Upload** — **ADR-0015**), **Inline- und Block-Formel** (Delimiters wie in der App dokumentiert).
    - **Mobile:** häufige Aktionen in der ersten Zeile; weitere über **Menü** oder **Bottom Sheet**; Touch-Ziele ausreichend groß (Mobile-First).
    - **Open Source:** eingesetzte Abhängigkeiten für Parsing/Hilfen sind **Open Source** und zur Projektlizenz kompatibel (**ADR-0016**); keine Pflicht-Komponente aus kommerziellen Rich-Text-Suites.
    - **Angular:** Standalone, UI-State mit **Signals** wo sinnvoll (**ADR-0002**); keine Pflicht auf `rxjs` für Editor-UI-State.
    - **i18n:** alle neuen UI-Strings in **de/en/fr/es/it** (**ADR-0008**).
    - **Barrierefreiheit:** Dialoge/Sheets mit Fokus und ARIA; kein rein hover-basiertes Bedienkonzept.
    - Architektur und Abgrenzung zu optionalem späteren WYSIWYG-Motor sind in **ADR-0016** festgehalten.
    - **UI-Geltungsbereich:** Mindestens **Quiz bearbeiten** und **Quiz neu** (Fragetext, Antwortoptionen); **Quiz-Beschreibung** mit derselben Markdown-/KaTeX-Semantik, wenn fachlich gewünscht; optional **Quiz-Vorschau** (Schnellkorrektur) in einer **kompakten** Variante (schmale Zeilen, ggf. Verweis auf Voll-Editor). **Außerhalb** von 1.7b: das **KI-JSON-Pastefeld** in der Quiz-Sammlung — siehe **Story 1.9a** und **ADR-0017**.
    - **Romanische Locales (fr/es/it):** Toolbar- und andere **kurze Aktionslabels** bewusst **kompakt** formulieren, damit sie auf **Buttons/Chips** auf dem Smartphone nicht übermäßig umbrechen (**ADR-0017**, **ADR-0014**).
- **Story 1.8 (Quiz exportieren):** 🟡 Als Lehrperson möchte ich ein Quiz als JSON-Datei exportieren können, damit ich es sichern, teilen oder auf einem anderen Gerät importieren kann.
  - **Akzeptanzkriterien:**
    - Ein "Exportieren"-Button erzeugt eine `.json`-Datei mit allen Quiz-Daten (Name, Beschreibung, Konfiguration, Fragen, Antwortoptionen inkl. `isCorrect`).
    - Das Export-Format enthält eine Schema-Version (`exportVersion`), um spätere Migrationen zu ermöglichen.
    - Markdown- und KaTeX-Auszeichnungen bleiben als Rohtext im Export erhalten.
    - Der Export erfolgt rein clientseitig (Download aus IndexedDB/Yjs, kein Server-Roundtrip).
    - Der Dateiname enthält den Quiz-Namen und ein Datum (z.B. `Mathe-Quiz_2026-02-18.json`).
- **Story 1.9 (Quiz importieren):** 🟡 Als Lehrperson möchte ich eine zuvor exportierte JSON-Datei importieren können, um ein Quiz wiederherzustellen oder von Kolleg:innen zu übernehmen.
  - **Akzeptanzkriterien:**
    - Ein "Importieren"-Button öffnet einen Datei-Dialog für `.json`-Dateien.
    - Die Datei wird gegen das Export-Schema (Zod) validiert; bei Fehlern wird eine verständliche Meldung angezeigt.
    - Das importierte Quiz erhält eine neue ID (kein Überschreiben bestehender Quizzes).
    - Das Quiz wird nach dem Import sofort in der lokalen Quiz-Liste angezeigt (Yjs/IndexedDB).
    - Der Import erfolgt rein clientseitig (kein Server-Roundtrip).
- **Story 1.9a (KI-gestützter Quiz-Import mit Zod-Validierung):** 🟡 Als Lehrperson möchte ich die vom LLM generierte Quiz-JSON (aus dem Workflow von Story 1.9b) in arsnova.eu importieren können, wobei strikte Zod-Validierung sicherstellt, dass fehlerhafte oder halluzinierte KI-Antworten die App nicht zum Absturz bringen.
  - **Akzeptanzkriterien:**
    - **Import-UI:** In der **Quiz-Sammlung** (`/quiz`) gibt es den aufklappbaren Bereich **„Mit unserem Prompt zum fertigen Quiz“**, in den die Lehrperson die LLM-Antwort per **Copy & Paste** einfügt (inkl. tolerantem Parsing von Markdown-Codeblock `json` bzw. eingebettetem JSON). Der allgemeine **Importieren**-Button daneben dient dem Datei-Import exportierter JSON (Story 1.9) und kann auch für vom LLM gespeicherte `.json`-Dateien genutzt werden.
    - **Kein JSON-/Code-Editor-Pflicht:** Das Einfügefeld ist ein **Paste-Kanal** für KI-Ausgabe; ein **dedizierter JSON-Editor** (IDE-ähnlich, Syntax-Highlighting als Pflichtfeature) ist **kein** Liefergegenstand — siehe **ADR-0017**. Qualitätssicherung über **Zod** und verständliche Fehlermeldungen; optionale **leichtgewichtige** Hilfen (z. B. Fence-Stripping) bleiben zulässig.
    - **Strikte Zod-Validierung (Kern-Kriterium):**
      - Das eingefügte JSON wird **nicht** blind mit `JSON.parse()` als `any` in den State übernommen.
      - Es muss durch ein definiertes Zod-Schema (z. B. `quizImportSchema` aus `libs/shared-types/src/schemas.ts`) laufen (mittels `schema.safeParse()`).
      - Die Validierung prüft rekursiv, ob alle Pflichtfelder vorhanden sind (z. B. korrekter `QuestionType` aus dem Enum, Vorhandensein des `isCorrect`-Flags bei den Antworten).
    - **Fehlerbehandlung (Graceful Degradation):** Wenn die KI das Format verfehlt hat (Zod wirft einen Fehler), stürzt die App nicht ab. Stattdessen liest das Frontend den `ZodError` aus und zeigt der Lehrperson eine verständliche Fehlermeldung an (z. B. „Fehler im Import: Bei Frage 2 fehlt das Feld ‚isCorrect‘“).
    - **Yjs-Integration:** Nur wenn `safeParse().success` wahr ist, wird das typsichere Objekt in ein lokales Yjs-CRDT-Dokument transformiert, in der IndexedDB gespeichert und dem Dashboard der Lehrperson hinzugefügt.
  - **Abhängigkeiten:** Story 1.9 (Quiz importieren, gleiches Import-Schema/Wiederverwendung), Story 1.5 (Local-First/Yjs). Das Zod-Schema für den KI-Import kann das gleiche wie für den regulären Import sein oder eine explizite Variante `quizImportSchema` in `libs/shared-types`.
- **Story 1.9b (KI-Systemprompt – kontextbasiert, schema-getreu):** 🟡 Als Lehrperson möchte ich einen KI-Systemprompt in der App kopieren können, der meine **Quiz-Vorgaben** (Preset, Nickname-Theme, Schwierigkeit, Live-Optionen) widerspiegelt, damit das LLM ein schema-konformes Quiz erzeugen kann – inkl. Anleitung für Kontext-Upload (RAG) bei Präsentation/Skript.
  - **Akzeptanzkriterien:**
    - **Platzierung:** Der Zugang **„Mit unserem Prompt zum fertigen Quiz“** (Textvorlage kopieren) liegt in der **Quiz-Sammlung** (`/quiz`), dort wo die Lehrperson ohnehin Quizzes verwaltet und importiert. (Nicht zwingend auf der Startseite.)
    - **Kontext-Einbindung:** Der Prompt enthält die **aktuellen Werte** aus dem **Startseiten-Preset** (`ThemePresetService`: spielerisch/seriös) und – gespeichert – aus den **Preset-Optionen** im `localStorage` (gleiche Quelle wie Preset-Toast auf der Startseite). Er spiegelt **nicht** das gerade fokussierte Quiz in der Liste wider. Vollständiger Vertrag: **ADR-0007**.
    - **Schema-Treue:** Der Prompt-Text (`buildKiQuizSystemPrompt` in `apps/frontend/src/app/shared/ki-quiz-prompt.ts`, siehe ADR-0007) beschreibt **exakt** das von `quizImportSchema` erwartete JSON-Format: erforderliche Felder, erlaubte Enums (`QuestionType`, etc.), `isCorrect` bei Antwortoptionen, Struktur für Fragen und Optionen. Das Ziel ist, dass typische LLM-Ausgaben nach Feintuning **ohne Nachbearbeitung** die Zod-Validierung (Story 1.9a) bestehen.
    - **RAG-Anleitung:** Der Prompt weist die Lehrperson an, bei Bedarf **Lehrmaterial (Präsentation, Skript, PDF)** per Kontext-Upload (Datei/URL) im Chatbot bereitzustellen, und das LLM an, das Quiz **aus diesem Kontext** zu erzeugen – so ist ein präsentations-/skriptbasiertes Quiz (wie bei Mentimeter) abgedeckt, ohne Upload zu arsnova.eu.
    - **Wartbarkeit:** Der Prompt-Inhalt ist als **versionierbares Artefakt** im Frontend-Modul `ki-quiz-prompt.ts` (plus Spec) gepflegt, sodass Iterationen für bessere Schema-Konformität (Feintuning) ohne Änderung der Import-Logik (1.9a) möglich sind.
  - **Abhängigkeiten:** Story 1.11 (Preset & Optionen), damit Preset/Zielgruppe/Optionen in der UI verfügbar sind; Story 1.9a (Import) kann parallel oder danach umgesetzt werden – der Prompt wird von 1.9a nur genutzt (Copy), nicht implementiert.
- **Story 1.10 (Quiz bearbeiten & löschen):** 🔴 Als Lehrperson möchte ich ein bestehendes Quiz umbenennen, bearbeiten und löschen können, damit ich meine Quiz-Sammlung pflegen kann.
  - **Akzeptanzkriterien:**
    - In der Quiz-Liste gibt es pro Quiz ein Kontextmenü (⋮) mit Optionen: „Bearbeiten", „Duplizieren", „Löschen".
    - **Bearbeiten:** Öffnet das Quiz im Editor — alle Felder (Name, Beschreibung, Konfiguration, Fragen, Antworten) sind änderbar. Änderungen werden sofort lokal gespeichert (Yjs/IndexedDB).
    - **Duplizieren:** Erstellt eine vollständige Kopie des Quizzes mit dem Suffix „(Kopie)" am Namen und einer neuen ID.
    - **Löschen:** Zeigt einen Bestätigungsdialog ("Quiz ‹Name› wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden."). Nach Bestätigung wird das Yjs-Dokument aus IndexedDB entfernt.
    - Ein Quiz, das gerade live ist (offene Session), kann nicht gelöscht werden — der Löschen-Button ist ausgegraut mit Tooltip-Hinweis.
    - Alle Operationen erfolgen rein clientseitig (Local-First).
- **Story 1.11 (Quiz-Presets):** 🟡 Als Lehrperson möchte ich beim Erstellen eines Quizzes ein Preset auswählen können, das alle Gamification-Einstellungen auf einmal setzt, damit ich schnell zwischen spielerischem und seriösem Modus wechseln kann.
  - **Akzeptanzkriterien:**
    - Es gibt **zwei** Presets in der Quiz-Konfiguration (Implementierung: `QUIZ_PRESETS` in `@arsnova/shared-types`):
      - **🎮 Spielerisch** (default): u. a. `showLeaderboard=true`, `enableSoundEffects=true`, `enableRewardEffects=true`, `enableMotivationMessages=true`, `enableEmojiReactions=true`, `anonymousMode=false`, `allowCustomNicknames=false`, `nicknameTheme=HIGH_SCHOOL`, `defaultTimer` = Standard-Countdown (`DEFAULT_TIMER_SECONDS`), `readingPhaseEnabled=false`.
      - **🎓 Seriös**: u. a. `showLeaderboard=false`, `enableSoundEffects=false`, `enableRewardEffects=false`, `enableMotivationMessages=false`, `enableEmojiReactions=false`, `anonymousMode=false` (Pseudonyme aus Themenliste, nicht reiner Anonym-Modus), `allowCustomNicknames=false`, `nicknameTheme=HIGH_SCHOOL`, `defaultTimer=null` (offene Antwortphase), `readingPhaseEnabled=true`.
    - **Einzeloptionen sind auswählbar:** Jede Option kann unabhängig an- oder abgewählt bzw. gesetzt werden; die UI bietet pro Option einen klaren Toggle oder ein Eingabefeld. Nach Auswahl eines Presets kann die Lehrperson jede Einzeloption überschreiben. Die gewählten **Einzelwerte werden gespeichert** — im Quiz-Dokument (Yjs) und damit persistent (Local-First, Sync über Yjs).
    - Das Preset dient nur als Komfortfunktion zum einmaligen Vorsetzen der Werte; **maßgeblich und gespeichert sind die Einzelwerte** (über Yjs), nicht das Preset selbst.
    - Ein visueller Hinweis (Badge „Spielerisch" / „Seriös") zeigt an, welchem Preset die aktuelle Konfiguration entspricht. Wenn Einzelwerte abweichen, wird „Benutzerdefiniert" angezeigt.
    - **Bedeutung der Einzeloptionen** (alle Quiz-Konfigurationsoptionen, auswählbar; Referenz: Prisma Quiz, CreateQuizInput):
      - **showLeaderboard** — Leaderboard mit Rangfolge anzeigen (ja/nein).
      - **allowCustomNicknames** — Eigene Pseudonyme erlauben oder nur vordefinierte Liste (Story 1.4) (ja/nein).
      - **defaultTimer** — Standard-Countdown in Sekunden pro Frage (Zahl oder „offen" / null).
      - **enableSoundEffects** — **Action Sounds**: kurze SFX (z. B. Countdown), nicht Phasen-Hintergrundmusik (ja/nein).
      - **enableRewardEffects** — Belohnungseffekte (ja/nein).
      - **enableMotivationMessages** — Motivationsmeldungen (ja/nein).
      - **enableEmojiReactions** — Emoji-Reaktionen (ja/nein).
      - **anonymousMode** — Anonymer Modus (keine Nickname-Auswahl, automatische IDs) (ja/nein).
      - **readingPhaseEnabled** — Lesephase: Frage zuerst lesen, dann „Antworten freigeben" (Story 2.6) (ja/nein).
      - **nicknameTheme** — Thema für vordefinierte Nicknames, z. B. Nobelpreisträger, Tiere (Story 3.2) (Auswahl).
      - **teamMode** — Team-Modus: Teilnehmende in Teams (Story 7.1) (ja/nein).
      - **teamCount** — Anzahl Teams bei Team-Modus (2–8, nur bei teamMode=true).
      - **teamAssignment** — Zuweisung zu Teams: automatisch oder manuell (Story 7.1) (Auswahl).
      - **backgroundMusic** — Hintergrundmusik in Lobby/Countdown (Story 5.3): Track-Name oder aus (optional).
      - **bonusTokenCount** — Anzahl Top-Plätze mit Bonus-Code (1–50, null = deaktiviert) (Story 4.6). In der UI: „Bonus-Code für Top-Plätze“.
    - **Preset-Optionen-Chips (UI):** Der Zustand jeder Option (an/aus) wird in der Preset-Toast-UI farblich hervorgehoben: „an“ in Grün (Ampel), „aus“ in Rot — bessere Scanbarkeit ohne Abhängigkeit von der Chip-Highlight-Farbe allein.
    - Presets sind auch beim Bearbeiten (Story 1.10) verfügbar.
- **Story 1.12 (SC-Schnellformate):** 🟡 Als Lehrperson möchte ich beim Erstellen einer Single-Choice-Frage aus vorkonfigurierten Antwortformaten wählen können, damit ich häufig benötigte Formate mit einem Klick einfügen kann.
  - **Akzeptanzkriterien:**
    - Wenn der Fragentyp `SINGLE_CHOICE` gewählt ist, erscheint über dem Antwort-Editor eine Dropdown-Leiste **„Schnellformat"** mit folgenden Optionen:
      - **Ja / Nein** → 2 Antwortoptionen: „Ja", „Nein"
      - **Ja / Nein / Vielleicht** → 3 Antwortoptionen: „Ja", „Nein", „Vielleicht"
      - **Ja / Nein / Weiß nicht** → 3 Antwortoptionen: „Ja", „Nein", „Weiß nicht"
      - **Wahr / Falsch** → 2 Antwortoptionen: „Wahr", „Falsch"
      - **A / B / C / D** → 4 Antwortoptionen: „A", „B", „C", „D"
    - Bei Auswahl eines Formats werden die bestehenden Antwortoptionen **ersetzt** (nach Bestätigungsdialog, falls bereits Antworten vorhanden sind).
    - Die Lehrperson muss danach mindestens eine Antwort als korrekt (`isCorrect`) markieren — das Schnellformat setzt keine Lösung voraus.
    - Nach dem Einfügen kann die Lehrperson die Antworttexte frei bearbeiten, weitere Optionen ergänzen oder entfernen.
    - Die Schnellformate sind als Konstante `SC_FORMAT_PRESETS` in `@arsnova/shared-types` definiert und werden bei i18n (Story 6.2) lokalisiert.
    - Das Dropdown ist nur bei `SINGLE_CHOICE` sichtbar — bei anderen Fragentypen wird es ausgeblendet.
    - Das Feature ist rein clientseitig (kein Server-Roundtrip, keine Datenbankänderung).
- **Story 1.13 (Quiz-Preview & Schnellkorrektur):** 🟡 Als Lehrperson möchte ich mein Quiz vor dem Live-Schalten in einer Vorschau durchblättern und dabei Fehler direkt per Inline-Bearbeitung korrigieren können, damit ich Tippfehler und falsche Markierungen schnell finde und behebe — unterstützt durch Hotkeys für flüssige Navigation.
  - **Akzeptanzkriterien:**
    - In der Quiz-Detailansicht gibt es einen **„Preview"-Button** (Augen-Icon 👁️), der den Preview-Modus öffnet.
    - **Vollbild-Preview:**
      - Jede Frage wird so angezeigt, wie sie später auf dem Teilnehmenden-Gerät erscheinen würde (Markdown/KaTeX gerendert, Antwort-Buttons mit Farb- und Formencodierung △○□◇).
      - Die korrekte(n) Antwort(en) werden zusätzlich mit einem grünen Häkchen (✓) markiert, damit die Lehrperson die Lösung sofort sieht.
      - Bei RATING-Fragen wird die Skala mit Labels angezeigt; bei FREETEXT-Fragen ein Platzhalter-Textfeld.
      - Am oberen Rand: Fortschrittsbalken (z. B. „Frage 3 / 12") + Fragentyp-Badge (MC/SC/Freitext/Rating/Umfrage) + Schwierigkeits-Badge (Easy/Medium/Hard).
    - **Hotkey-Navigation (Tastatursteuerung):**
      - `→` oder `N` — Nächste Frage
      - `←` oder `P` — Vorherige Frage
      - `Home` — Zur ersten Frage springen
      - `End` — Zur letzten Frage springen
      - `1`–`9` — Direkt zur Frage Nr. 1–9 springen
      - `E` — Inline-Bearbeitung für die aktuelle Frage öffnen (Toggle)
      - `Esc` — Preview-Modus verlassen / Inline-Bearbeitung abbrechen
    - **Inline-Schnellkorrektur:**
      - Per Klick auf den Fragentext, einen Antworttext oder das `isCorrect`-Häkchen wechselt das jeweilige Element in einen editierbaren Zustand (Inline-Edit).
      - Alternativ: Hotkey `E` aktiviert die Bearbeitung der gesamten aktuellen Frage.
      - Änderungen werden sofort in Yjs/IndexedDB gespeichert (Local-First, kein Save-Button nötig).
      - Markdown-Preview aktualisiert sich live bei Textänderungen (Debounce ≤ 300 ms).
      - `isCorrect`-Toggle: Ein Klick auf das Häkchen einer Antwort invertiert den Korrekt-Status sofort.
    - **Swipe-Navigation (Mobile):**
      - Auf Touch-Geräten kann zwischen Fragen durch horizontales Wischen gewechselt werden (Swipe left = nächste, Swipe right = vorherige).
      - Swipe-Geste wird mit einer kurzen Slide-Animation (150 ms) visuell bestätigt.
    - **Validierungs-Overlay:**
      - Am unteren Rand zeigt ein kompakter Validierungs-Balken Probleme an, z. B.:
        - ⚠️ „Frage 5: Keine korrekte Antwort markiert"
        - ⚠️ „Frage 8: Weniger als 2 Antwortoptionen"
        - ⚠️ „Frage 3: Timer fehlt (Quiz-Default wird verwendet)"
      - Klick auf eine Warnung springt direkt zur betroffenen Frage.
      - Wenn keine Probleme: ✅ „Alle Fragen valide — bereit zum Live-Schalten".
    - Das Feature ist rein clientseitig (kein Server-Roundtrip).
    - Abhängigkeiten: Story 1.7 (Markdown/KaTeX), Story 1.2a–c (Fragentypen), Story 1.5 (Local-First).
- **Story 1.14 (Word Cloud – interaktiv + Export):** 🟡 Als Lehrperson möchte ich Freitext-Antworten als interaktive Word-Cloud sehen und die Auswertung exportieren können, damit ich auf Mentimeter-Niveau präsentieren und Ergebnisse für Nachbereitung oder Lehrevaluation nutzen kann.
  - **Akzeptanzkriterien:**
    - **Interaktive Word-Cloud:** In Beamer-Ansicht (Story 2.5) und Host-Steuerung wird bei FREETEXT-Fragen mit mindestens einer Antwort eine Word-Cloud angezeigt; Begriffe werden nach Häufigkeit skaliert (Stopwörter optional ausblendbar).
    - Klick auf einen Begriff hebt ihn hervor oder filtert die zugehörigen Antworten in einer Liste (Toggle); Tooltip zeigt exakte Anzahl.
    - Word-Cloud aktualisiert sich live bei eingehenden Votes (Echtzeit, konsistent mit Story 4.5).
    - **Export:** Die Lehrperson kann pro Frage oder für die gesamte Session exportieren:
      - **CSV:** Alle Freitext-Antworten (aggregiert: Text, Anzahl), ohne Nicknames; optional Bonus-Code-Liste (Story 4.6) in separatem Export.
      - **Bild/PNG (optional):** Screenshot der Word-Cloud oder der Ergebnis-Visualisierung für eine Frage.
    - Export ist nur für die Lehrperson zugänglich (kein Zugriff für Teilnehmende); Daten nur aggregiert bzw. pseudonym (Bonus-Code-Liste), DSGVO-konform.
    - Abhängigkeiten: Story 4.5 (Freitext-Auswertung), Story 2.5 (Beamer), Story 4.4 (Ergebnis-Visualisierung).
- **Story 1.14a (Word Cloud 2.0 – echtes Layout + Premium-UX):** 🟡 Als Lehrperson möchte ich Freitext-Antworten in einer echten, dichten und präsentationstauglichen Word-Cloud sehen, damit arsnova.eu bei Live-Freitext mindestens so stark wie Kahoot oder Mentimeter wirkt und in Lesbarkeit, Interaktion und Export sichtbar darüber liegt.
  - **Akzeptanzkriterien:**
    - **Layout-Engine:** Die Word-Cloud verwendet eine echte Layout-Engine mit Kollisionsprüfung und Spiralplatzierung; die bisherige `flex-wrap`-Tag-Cloud wird für Host/Presenter durch ein echtes Cloud-Layout ersetzt.
    - **Wichtigstes Wort zentral:** Das häufigste oder eines der häufigsten Wörter wird sichtbar dominanter und möglichst zentral platziert; die visuelle Hierarchie ist für einen Beamer aus mehreren Metern Entfernung erkennbar.
    - **Dichte statt Liste:** Die Darstellung nutzt die verfügbare Fläche deutlich besser als die bisherige Tag-Cloud; sie wirkt wie eine echte Wortwolke und nicht wie eine umbrochene Begriffsliste.
    - **Mindestens Benchmark-Niveau:** Die Standarddarstellung ist in wahrgenommener Qualität, Lesbarkeit und visueller Dichte mindestens auf dem Niveau von Kahoot oder Mentimeter.
    - **Zielbild besser als Benchmark:** In mindestens zwei Bereichen ist die Darstellung sichtbar besser als typische Standard-Word-Clouds von Kahoot oder Mentimeter, z. B. bei Live-Aktualisierung ohne visuelle Unruhe, Interaktion, Exportqualität, Filterung oder Responsiveness.
    - **Live-Update ohne Chaos:** Neue Freitext-Antworten führen zu einer stabilen Neuberechnung; bereits platzierte Wörter springen nicht bei jedem Update chaotisch über die Fläche, sondern verändern sich für Nutzer:innen nachvollziehbar.
    - **Animierter, aber ruhiger Übergang:** Wenn Wörter ihre Position oder Größe ändern, erfolgen diese Änderungen weich und visuell ruhig; bei `prefers-reduced-motion` werden Animationen reduziert oder deaktiviert.
    - **Skalierung:** Die Schriftgröße wird nicht nur linear vergrößert, sondern so skaliert, dass Unterschiede zwischen seltenen, mittleren und sehr häufigen Begriffen auch bei vielen Einträgen gut erkennbar bleiben.
    - **Farblogik:** Die Cloud verwendet eine projektkonforme Farb- und Kontrastlogik; Farben dürfen die Hierarchie unterstützen, aber nie die Lesbarkeit schwächen.
    - **Rotation konfigurierbar:** Wortrotation ist technisch möglich und konfigurierbar; Standard bleibt nur dann ohne Rotation, wenn dies nach UX-Prüfung klar besser lesbar ist.
    - **Padding konfigurierbar:** Wortabstände, Mindestpadding und maximale Dichte sind konfigurierbar, damit die Darstellung je nach Host-, Presenter- oder Exportkontext feinjustiert werden kann.
    - **Größe adaptiv:** Die Word-Cloud passt sich an verschiedene Viewports und Seitenverhältnisse an, ohne dass die Layoutqualität auf Mobilgeräten, Laptops oder Projektionsflächen sichtbar kollabiert.
    - **Presenter und Host konsistent:** Host- und Presenter-Ansicht nutzen dieselbe fachliche Aggregation und dasselbe Layoutprinzip; Unterschiede dürfen nur bewusst in Dichte, Bedienelementen oder Rahmung bestehen.
    - **Echte Interaktion:** Klick oder Fokus auf ein Wort markiert es sichtbar und filtert die zugrundeliegenden Antworten; das aktive Wort kann wieder deaktiviert werden.
    - **Exakte Mengen sichtbar:** Für jedes Wort ist die genaue Häufigkeit per Tooltip, Overlay oder Fokuszustand klar erkennbar.
    - **Stopwörter professionell:** Stopwörter können ein- und ausgeblendet werden; das Umschalten führt zu einer nachvollziehbaren, konsistenten Neuberechnung statt zu einem kompletten visuellen Neustart.
    - **Semantische Robustheit:** Tokenisierung, Stopwortlogik und Mindestwortlänge bleiben getrennt vom Layout und können später ohne Austausch der Layout-Engine erweitert werden.
    - **Lexikonform per NLP:** Wörter werden vor der Aggregation über geeignete NLP-Komponenten in ihre möglichst fehlerfreie Lexikonform überführt, damit Beugungen, Flexionen und naheliegende Wortformen nicht als getrennte Begriffe erscheinen.
    - **Ähnliche Wörter zusammenfassen:** Fachlich gleichartige Wortformen wie Singular/Plural, konjugierte Verbformen oder flektierte Adjektive können auf einen gemeinsamen Begriff aggregiert und als ein Wort in der Cloud dargestellt werden; als Referenz für die Qualität gilt ein Ansatz mit NLP-Bausteinen auf dem Niveau von spaCy.
    - **Viele verschiedene Einträge:** Bei einer Testmenge mit vielen heterogenen Freitext-Antworten bleibt die Darstellung lesbar und präsentierbar; die Ansicht darf nicht in eine ungeordnete Mikrotext-Fläche kippen.
    - **Viele Dubletten:** Bei stark häufigen Wiederholungen wird die Dominanz weniger Leitbegriffe deutlich sichtbar, ohne dass seltenere, relevante Wörter vollständig untergehen.
    - **Begrenzung mit Qualitätsregel:** Wenn aufgrund der Fläche oder Dichte nicht alle Wörter gerendert werden können, werden die wichtigsten Wörter priorisiert; verworfene Wörter führen nicht zu einem inkonsistenten oder kaputten Layout.
    - **Leere und frühe Zustände:** Bei noch keinen oder sehr wenigen Antworten zeigt die UI einen hochwertigen leeren bzw. frühen Zustand und wechselt sauber in die eigentliche Cloud.
    - **Export in Präsentationsqualität:** PNG- oder SVG-Export liefert eine hochwertige, ruhige und beamergeeignete Grafik; der Export ist kein bloßer Screenshot einer instabilen Zwischenansicht.
    - **Export und Live-Ansicht konsistent:** Die Exportdarstellung entspricht in Hierarchie und Wortanordnung plausibel der Live-Ansicht oder nutzt bewusst ein hochwertigeres statisches Layout desselben Datenstands.
    - **Barrierefreiheit:** Die wichtigsten Informationen der Cloud bleiben nicht nur visuell zugreifbar; es gibt eine textuelle Alternative oder assistive Darstellung für Häufigkeiten und gefilterte Antworten.
    - **Tastaturbedienung:** Interaktive Wörter sind per Tastatur erreichbar; Fokuszustand und Aktivierung sind sichtbar und sinnvoll.
    - **Performance im Live-Betrieb:** Die Layoutberechnung bleibt für typische Live-Szenarien performant genug, dass Host und Presenter während eingehender Antworten reaktiv bleiben.
    - **Messbare Qualitätsprobe:** Vor Abschluss der Story wird die neue Darstellung mit mehreren realistischen Demo-Datensätzen geprüft, darunter:
      - viele unterschiedliche kurze Antworten
      - viele Wiederholungen weniger Begriffe
      - gemischte deutsche und englische Begriffe
      - sehr lange Einzelbegriffe
    - **Architekturvorgabe:** Die Umsetzung folgt ADR-0012; `d3-cloud` wird als Layout-Engine in eine eigene Angular-Komponente gekapselt und nicht als unkontrolliertes Fremd-Widget direkt in die UI eingebaut.
  - **Abhängigkeiten:** Story 1.14 (bestehende Word-Cloud), Story 4.5 (Freitext-Auswertung), Story 2.5 (Beamer / Presenter), Story 6.4 (Responsive), Story 6.5 (Barrierefreiheit), ADR-0012.
- **Story 1.15 (Preset-Konfiguration exportieren & importieren):** 🟢 Als Lehrperson möchte ich meine Preset-Konfiguration (Seriös/Spielerisch inkl. aller Optionen) als Datei exportieren und auf einem anderen Gerät/Browser importieren können, damit ich meine Einstellungen geräteübergreifend nutzen kann — ohne Account und ohne serverseitige Speicherung.
  - **Motivation:** Presets werden im `localStorage` des Browsers gespeichert und sind damit an ein Gerät bzw. einen Browser gebunden. Für Lehrende, die zwischen Laptop und Tablet wechseln, geht die individuelle Konfiguration verloren. Diese Story bietet eine einfache, Zero-Knowledge-konforme Lösung.
  - **Akzeptanzkriterien:**
    - In der Preset-Toast-UI gibt es zwei neue Buttons: **„Exportieren"** (Download-Icon) und **„Importieren"** (Upload-Icon).
    - **Export:** Erzeugt eine `.json`-Datei mit allen Preset-Daten beider Presets (Seriös + Spielerisch): Optionszustand, Namensmodus, Nickname-Theme, Teamanzahl, aktives Preset, Theme (Dark/Light/System). Dateiname: `arsnova-presets_{datum}.json`.
    - **Import:** Öffnet einen Datei-Dialog für `.json`-Dateien. Die Datei wird gegen ein Zod-Schema validiert; bei Fehlern wird eine verständliche Meldung angezeigt. Nach erfolgreichem Import werden `localStorage`-Keys aktualisiert und die UI reagiert sofort.
    - Export und Import erfolgen rein clientseitig (kein Server-Roundtrip) — Zero-Knowledge-Prinzip bleibt gewahrt.
    - Das Export-Format enthält eine Schema-Version (`presetExportVersion`), um spätere Migrationen zu ermöglichen.
  - **Abgrenzung zu Story 1.6b:** Story 1.6b synchronisiert Presets automatisch über Yjs (erfordert aktive Sync-Verbindung). Story 1.15 ist eine manuelle, dateibasierte Lösung, die ohne Netzwerk funktioniert und auch über Browsergrenzen (Chrome → Firefox) hinweg nutzbar ist.

---

## Epic 2: Live-Sitzung & Lobby (Rolle: Lehrperson)

> **Verifizierung (Commit-Historie):** Der Kernumfang 2.1a–2.8 ist umgesetzt, einschließlich **2.1c** mit tokenbasiertem Host-/Presenter-Zugang und serverseitiger Host-Prüfung.

- **Story 2.1a (Session-ID generieren & Quiz-Upload):** 🔴 Als Lehrperson möchte ich ein Quiz live schalten können, wodurch eine 6-stellige Session-ID generiert wird und die Quizdaten an den Server übertragen werden.
  - **Akzeptanzkriterien:**
    - tRPC-Mutation `session.create` erstellt eine Session mit eindeutigem 6-stelligem Code.
    - Session-Status ist initial `LOBBY`.
    - Session ist über `Session`-Modell in der Datenbank persistiert.
    - Das lokale Quiz (Fragen, Antwortoptionen inkl. `isCorrect`, Konfiguration) wird beim Live-Schalten einmalig an den Server übertragen und in PostgreSQL gespeichert.
    - `isCorrect`-Daten verbleiben ausschließlich serverseitig und werden **niemals** während der Frage-Phase an Teilnehmende gesendet (siehe Story 2.4).
- **Story 2.1b (QR-Code):** 🟢 Als Lehrperson möchte ich einen QR-Code angezeigt bekommen, der den Beitritts-Link enthält.
  - **Akzeptanzkriterien:**
    - QR-Code encodiert `{baseUrl}/join/{sessionCode}`.
    - QR-Code ist auf Beamer-Auflösung lesbar.
- **Story 2.1c (Host-/Presenter-Zugang mit Session-Token härten):** ✅ Fertig – Als Lehrperson möchte ich, dass eine laufende Veranstaltung nur mit passenden Session-Tokens gesteuert oder angezeigt werden kann, damit weder Teilnehmende noch Dritte allein über den Session-Code Host-Rechte erhalten.
  - **Akzeptanzkriterien:**
    - `session.create` liefert ein **Host-Token** zurück; der Redirect von `/session/:code` entscheidet tokenabhängig zwischen Host-Ansicht und Join-Pfad.
    - Der 6-stellige **Session-Code** bleibt ausschließlich Join-Zugang für Teilnehmende und reicht **nicht** für `/session/:code/host`, `/session/:code/present` oder geschützte Host-Prozeduren.
    - Alle Host-only-Prozeduren (`nextQuestion`, `revealAnswers`, `revealResults`, `end`, Exporte, Bonus-/Moderationssteuerung, Q&A-Moderation, session-gebundenes Blitzlicht) prüfen serverseitig ein gültiges Host-Token über `hostProcedure`.
    - Die Presenter-Ansicht ist als **read-only** abgesichert: Sie zeigt Live-Inhalte, kann aber keine Session steuern und ist clientseitig an das Host-Token gebunden.
    - Tokens werden serverseitig nur gehasht gespeichert, sind an die Session gebunden und werden bei Session-Ende bzw. Host-Exit sauber entfernt.
    - Ohne gültiges Token zeigen Host-/Presenter-Routen eine klare Zugriffsfehlermeldung oder leiten in einen sicheren Einstieg um.
- **Story 2.2 (Lobby-Ansicht):** 🔴 Als Lehrperson möchte ich in Echtzeit sehen, wie viele und welche Teilnehmenden meiner Lobby beigetreten sind.
  - **Akzeptanzkriterien:**
    - tRPC-Subscription `session.onParticipantJoined` pusht neue Teilnehmende in Echtzeit.
    - Die Teilnehmenden-Liste zeigt Nicknames an.
    - Die Zahl der Teilnehmenden wird live aktualisiert.
- **Story 2.3 (Präsentations-Steuerung):** 🔴 Als Lehrperson möchte ich den Ablauf steuern (Frage öffnen, Antworten freigeben, Ergebnisse auflösen).
  - **Akzeptanzkriterien:**
    - Buttons: "Nächste Frage" → "Antworten freigeben" → "Ergebnis zeigen".
    - Session-Status-Wechsel: `LOBBY → QUESTION_OPEN → ACTIVE → RESULTS → PAUSED → …` (Details siehe Story 2.6).
    - Wenn `readingPhaseEnabled=false`: Der Status `QUESTION_OPEN` wird übersprungen — "Nächste Frage" wechselt direkt zu `ACTIVE` (bisheriges Verhalten).
    - Alle verbundenen Clients werden via Subscription über Statuswechsel informiert.
- **Story 2.4 (Security / Data-Stripping):** 🔴 Als Lehrperson möchte ich absolut sicher sein, dass die `isCorrect`-Lösungsflags _während der Frage-Phase_ nicht an die Browser der Teilnehmenden gesendet werden.
  - **Akzeptanzkriterien:**
    - Das DTO `QuestionStudentDTO` enthält kein `isCorrect`-Feld — es wird bei jeder Frage-Auslieferung serverseitig entfernt.
    - `isCorrect`-Daten dürfen erst **nach expliziter Auflösung durch die Lehrperson** (Statuswechsel zu `RESULTS`) an die Teilnehmenden übertragen werden (siehe Story 3.4).
    - Ein automatisierter Test verifiziert, dass das ausgehende JSON im Status `ACTIVE` kein `isCorrect` enthält.
    - Ein separater Test bestätigt, dass `isCorrect` im Status `RESULTS` korrekt mitgesendet wird.
    - Code-Review-Checkliste dokumentiert die Stripping-Regel.
- **Story 2.5 (Beamer-Ansicht = Host-Ansicht):** 🔴 Als Lehrperson sehe ich genau das auf dem Beamer, was auf meinem Laptop angezeigt wird (gespiegelt). Es gibt keinen zweiten Bildschirmausgang – die **Host-Ansicht ist die Beamer-Ansicht**.
  - **Kontext:** Sobald die Lehrperson die Live-Session startet, spielt sich alles in diesem einen View ab (`/session/:code/host`). Der Beamer darf nichts verraten, was die Lehrperson nicht freigegeben hat (z. B. korrekte Antworten erst nach Klick auf „Ergebnis zeigen“).
  - **Akzeptanzkriterien:**
    - Die Host-Ansicht ist die einzige Projektions-Ansicht; keine separate „Beamer-Route“ erforderlich (Route `/session/:code/present` optional, z. B. gleicher Inhalt für Vollbild-Tab).
    - Beamer-tauglich: große Schrift wo nötig (≥ 24px Basis für Fragentext), hoher Kontrast, Fokus auf Inhalt (Lobby: Code, QR, Teilnehmende; Frage: Stamm + Optionen; Steuerung: ein klarer Button).
    - **Nichts verraten:** Korrekte Antworten (grün/Häkchen) werden in der Host-Ansicht erst im Status `RESULTS` angezeigt (bereits umgesetzt).
    - **Lobby-Phase:** Session-Code, QR-Code (2.1b), Live-Teilnehmerliste (2.2).
    - **Lesephase (`QUESTION_OPEN`, Story 2.6):** Nur Fragenstamm (großformatig); Antwortoptionen ausgeblendet; Hinweis „Warte auf Freigabe…“ (Story 2.6).
    - **Frage-Phase (`ACTIVE`):** Fragenstamm, Antwortoptionen ohne Lösungsmarkierung, Countdown (Story 3.5), Live-Abstimmungsbalken.
    - **Ergebnis-Phase (`RESULTS`):** Ergebnis-Visualisierung (Story 4.4), optional Leaderboard-Zwischenstand.
    - **End-Phase (`FINISHED`):** finales Leaderboard (Story 4.1), Belohnungseffekte (Story 5.4).
    - Statuswechsel via tRPC-Subscription; die Lehrperson kann F11 für Browser-Vollbild nutzen.
- **Story 2.6 (Zwei-Phasen-Frageanzeige / Lesephase):** 🟡 Als Lehrperson möchte ich, dass beim Freigeben einer Frage zunächst nur der Fragenstamm angezeigt wird (Lesephase), damit die Teilnehmenden die Frage in Ruhe und vollständig lesen können, bevor die Antwortoptionen erscheinen und der Countdown beginnt.
  - **Didaktische Begründung:** In klassischen Quiz-Apps erscheinen Frage und Antworten gleichzeitig. Teilnehmende springen dann oft direkt zu den Antworten, ohne die Frage gründlich zu lesen — insbesondere bei komplexen Fragen mit Formeln oder längeren Texten. Die Zwei-Phasen-Anzeige fördert **kognitives Processing** und reduziert impulsives Raten.
  - **Akzeptanzkriterien:**
    - Neuer Session-Status `QUESTION_OPEN` zwischen `LOBBY`/`PAUSED` und `ACTIVE`.
    - **Status-Flow (erweitert):** `LOBBY → QUESTION_OPEN → ACTIVE → RESULTS → PAUSED → QUESTION_OPEN → … → FINISHED`.
    - **Phase 1 (`QUESTION_OPEN`):**
      - Auf Beamer und Teilnehmenden-Geräten wird **nur der Fragenstamm** angezeigt (Markdown/KaTeX gerendert), ohne Antwortoptionen.
      - Kein Countdown läuft. Abstimmung ist nicht möglich.
      - Beamer: Frage großformatig zentriert, dezenter Hinweis „Gleich geht's los…".
      - Teilnehmenden-Gerät: Frage wird angezeigt, Hinweis „Lies die Frage — Antworten folgen gleich.“
      - Neues DTO `QuestionPreviewDTO` wird gesendet (enthält `id`, `text`, `type`, `difficulty`, `order` — **keine** `answers`).
    - **Phase 2 (Übergang zu `ACTIVE`):**
      - Die Lehrperson klickt den Button „Antworten freigeben“ (Story 2.3).
      - Backend wechselt Status von `QUESTION_OPEN` → `ACTIVE`.
      - tRPC-Subscription `session.onAnswersRevealed` pusht die Antwortoptionen (`QuestionStudentDTO` ohne `isCorrect`).
      - Auf Beamer und Teilnehmenden-Geräten erscheinen die Antwort-Buttons mit Einblende-Animation (Slide-Up, 200 ms).
      - Der Countdown beginnt (Story 3.5).
    - **Konfigurierbar:** Neues Quiz-Konfigurationsfeld `readingPhaseEnabled` (default: `true`).
      - Wenn `true`: Zwei-Phasen-Flow wie oben beschrieben.
      - Wenn `false`: „Nächste Frage" wechselt direkt zu `ACTIVE` (Frage + Antworten + Countdown gleichzeitig — bisheriges Verhalten).
    - Das Feature ist in beiden Presets (Story 1.11) konfiguriert: **Spielerisch** → `readingPhaseEnabled=false`, **Seriös** → `readingPhaseEnabled=true`.
    - **Security:** Während `QUESTION_OPEN` werden weder `isCorrect` noch die Antwortoptionen an Teilnehmende gesendet — das DTO-Stripping (Story 2.4) greift bereits in dieser Phase.
    - **Barrierefreiheit:** Der Übergang von Phase 1 zu Phase 2 wird via `aria-live="polite"` angekündigt, damit Screenreader-Nutzer den Wechsel mitbekommen.
  - **Abhängigkeiten:** Story 2.3 (Steuerung), Story 2.4 (Security), Story 2.5 (Beamer), Story 3.3a (Frage empfangen), Story 3.5 (Countdown).
- **Story 2.7 (Peer Instruction – zweite Abstimmung, Vorher/Nachher):** ✅ Fertig – Als Lehrperson möchte ich die Methode **Peer Instruction** (Eric Mazur) umsetzen können: **Zwei Abstimmrunden** mit Zwischendiskussion, wobei die erste Runde für die Dauer der Session gespeichert und mit der zweiten Runde verglichen wird, damit der Lernerfolg durch Peer-Diskussion sichtbar wird.
  - **Hintergrund (Peer Instruction):** Konzeptfrage bzw. Abstimmungsthema stellen → **erste Abstimmung** (individuell) → kurze **Peer-Diskussion** (Sitznachbarn überzeugen) → **zweite Abstimmung** (revidierte Antwort) → Auflösung. Die Vergleichsanzeige Vorher/Nachher macht den Effekt der Diskussion deutlich.
  - **Zwei Anwendungsfälle:** (1) **Blitz-Feedback:** Peer Instruction erfolgt mit **zwei Blitz-Feedback-Runden** desselben Typs (z. B. Stimmungsbild, ja/nein/vielleicht oder ABCD): erste Runde starten → Ergebnis nicht auflösen, Hinweis „Diskutiert mit eurem Nachbarn“ → zweite Runde (gleicher Code/Session) → Vorher/Nachher-Anzeige. (2) **Quiz:** Optional bei MC/SC-Fragen zwei Abstimmrunden pro Frage mit Diskussionsphase dazwischen (wie unten).
  - **Akzeptanzkriterien:**
    - **Blitz-Feedback (Hauptfall):** In einer Blitz-Feedback-Session können **zwei Runden** derselben Abstimmung durchgeführt werden. Die **erste Runde** wird gespeichert; nach der Aufforderung zur Diskussion (ohne Auflösung) startet die Lehrperson die **zweite Runde** (weiterhin derselbe Session-Code). Nach der zweiten Runde wird ein **Doppel-Balkendiagramm (Vorher/Nachher)** angezeigt. Beide Runden bleiben nur für die Dauer der Session gespeichert.
    - **Quiz (optional):** Die Lehrperson kann bei MC/SC-Fragen optional „Peer Instruction“ aktivieren. Dann: zwei getrennte Abstimmungsphasen pro Frage; zwischen den Phasen keine Auflösung, nur die Aufforderung zur Diskussion (z. B. „Tauscht euch mit euren Nachbarinnen und Nachbarn aus – zweite Abstimmung gleich.“).
    - **Erste Abstimmung:** Wie bisher (Story 3.3b) – Teilnehmende geben ihre erste Antwort ab. Diese **erste Runde** wird **pro Frage und Session** serverseitig gespeichert (z. B. `Vote.round = 1` oder separates Aggregat „Round1“). Nach Ende der ersten Runde wechselt die UI in eine **Diskussionsphase** (Beamer: Hinweis „Diskutiert mit eurem Nachbarn“; Teilnehmende sehen keine Auflösung).
    - **Zweite Abstimmung:** Die Lehrperson startet die zweite Runde (z. B. Button „Zweite Abstimmung“). Teilnehmende können **neu abstimmen** (ggf. gleiche oder geänderte Antwort). Die zweite Runde wird ebenfalls gespeichert (`round = 2` bzw. „Round2“). Danach erfolgt die normale Auflösung (Ergebnis anzeigen, Story 4.4).
    - **Speicherdauer:** Die Daten der ersten Runde werden nur **für die Dauer der Session** vorgehalten (z. B. Redis/Prisma wie andere Votes). Nach Session-Ende (Story 4.2) werden sie mit gelöscht – kein dauerhafter Vergleich über Sessions hinweg.
    - **Anzeige Vorher/Nachher:** In der Ergebnisphase (`RESULTS`) wird bei Peer-Instruction-Fragen eine **Vergleichsdarstellung** angezeigt:
      - **Doppel-Balkendiagramm (oder vergleichbar):** Pro Antwortoption zwei Balken nebeneinander oder übereinander: **Vorher** (erste Runde) und **Nachher** (zweite Runde), z. B. farblich unterschieden (Vorher: dezent/grau, Nachher: kräftig/primary). So ist auf einen Blick sichtbar, wie sich die Verteilung durch die Diskussion geändert hat.
      - Alternative/Ergänzung: Zusätzliche Kennzahlen (z. B. „Richtig in Runde 1: 45 % → Runde 2: 72 %“) für schnelle Einordnung.
    - **Beamer & Host-Steuerung:** Die Vorher/Nachher-Visualisierung erscheint in der Beamer-Ansicht (Story 2.5) und in der Ergebnisansicht der Lehrperson. Barrierefrei: Balken mit `aria-label`/`role`, sinnvolle Kontraste (Story 6.5).
  - **Abhängigkeiten:** Story 2.3 (Steuerung), Story 2.5 (Beamer), Story 3.3b (Abstimmung), Story 4.4 (Ergebnis-Visualisierung), Story 4.2 (Session-Cleanup für Speicherdauer).
- **Story 2.8 (Produktives Smartphone-Hosting für Live-Sessions):** 🔴 Als Lehrperson möchte ich eine laufende Veranstaltung komplett und verlässlich auf meinem Smartphone hosten können, damit Quiz, Q&A und Blitzlicht auch ohne Desktop oder Beamer in echten Live-Situationen professionell steuerbar sind.
  - **Kontext:** Smartphone-Hosting ist kein Test- oder Fallback-Szenario, sondern ein echter Kernanwendungsfall, z. B. für Outdoor-Events, Seminare ohne Beamer, spontane Kleingruppenformate oder Lehrsituationen ohne Laptop. Das Produktversprechen lautet daher nicht nur „responsive“, sondern „live hostbar ohne Desktop“.
  - **Akzeptanzkriterien:**
    - **Produktiver Primärmodus:** Die Host-Ansicht ist auf Smartphones ein vollwertiger produktiver Bedienmodus; Start, Steuerung, Kanalwechsel und Session-Ende sind ohne Desktop möglich.
    - **Gleiche Rolle, gleiche Route:** Es gibt keine eigene Mobile-Host-Rolle und keine separate Mobile-Route; dieselbe Host-Funktionalität wird über responsive Informationsarchitektur für Smartphones nutzbar gemacht.
    - **Desktop bleibt stabil:** Desktop- und Beamer-Ansicht werden nicht verschlechtert; mobile Anpassungen erfolgen gezielt unter `@media`-Breakpoints.
    - **Obere Steuerzone mobil vereinfacht:** Kanal-Tabs, Live-Banner, Session-Code, Status, Join-/Sound-Aktionen und Zusatz-Controls sind auf Smartphones so priorisiert, dass die obere Zone kompakt, ruhig und ohne visuelle Überladung bedienbar bleibt.
    - **Natürliche Scrollbarkeit:** Jede mobile Host-Ansicht ist vollständig scrollbar; wichtige Aktionen oder Informationen werden nicht durch konkurrierende `fixed`-/`sticky`-/`dvh`-Konstruktionen abgeschnitten oder überlagert.
    - **Safe Area sauber:** iPhone- und Android-Safe-Areas sowie Browser-Chrome werden in Höhen- und Padding-Logik berücksichtigt.
    - **Quiz mobil steuerbar:** In laufenden Quiz-Sessions sind Frage, Status, Countdown, primäre Steueraktion und Folgeaktionen auf Smartphone ohne horizontales Scrollen und ohne gequetschte Toolbar bedienbar.
    - **Q&A mobil steuerbar:** Fragenliste, Moderationsstatus, Votes und Moderationsaktionen bleiben auf Smartphone lesbar, scrollbar und fingerfreundlich; Moderationsaktionen sind ohne Fehlbedienung erreichbar.
    - **Blitzlicht mobil steuerbar:** Startzustand, Rundenergebnis, Vergleichsrunde und Reset-/Ende-Aktionen sind auf Smartphone klar gegliedert; Aktionsbereiche und Ergebnisbalken kollabieren nicht visuell.
    - **Ergebnisansichten mobil robust:** Leaderboard, Freitext-/Word-Cloud-Rahmung, Bewertungs- und Auswertungsansichten bleiben auf Smartphones strukturiert, mit angenehmen Abständen und klarer visueller Hierarchie.
    - **Einheitliche mobile IA:** Quiz, Q&A, Blitzlicht und Ergebnisansichten folgen auf Smartphones einem konsistenten Layoutsystem mit einspaltiger Haupthierarchie, vergleichbaren Kartenbreiten und abgestimmten Abständen.
    - **Touch-Ziele:** Alle interaktiven Hauptelemente in der mobilen Host-Ansicht erreichen mindestens 44 × 44 px und sind mit dem Daumen sicher bedienbar.
    - **Keine horizontale Überforderung:** Auf 320 px Breite gibt es in der Host-Ansicht kein unbeabsichtigtes horizontales Scrollen.
    - **Kanalwechsel bleiben ruhig:** Beim Wechsel zwischen Quiz, Q&A und Blitzlicht verschieben sich Hauptkarten und Widgets nicht störend; der Layoutfluss bleibt stabil.
    - **Performance im Live-Betrieb:** Die mobile Host-Ansicht bleibt auch bei verbundenen Teilnehmenden, Live-Updates und Kanalwechseln reaktiv genug für den Echtbetrieb.
    - **Echte Geräteprüfung:** Vor Abschluss der Story wird die Host-Ansicht auf realen Smartphones in produktnahen Sessions für mindestens folgende Szenarien geprüft:
      - Quiz live starten und mehrere Fragen steuern
      - zwischen Quiz, Q&A und Blitzlicht wechseln
      - Blitzlicht starten, zurücksetzen und beenden
      - Q&A moderieren
      - Session ohne Desktop beenden
    - **Architekturvorgabe:** Umsetzung und Priorisierung folgen ADR-0014; Smartphone-Hosting wird als mobile Informationsarchitektur und als produktives USP-Feature behandelt, nicht als reine Responsive-Korrektur.
  - **Abhängigkeiten:** Story 2.3 (Präsentations-Steuerung), Story 2.5 (Beamer-/Host-Ansicht), Story 2.7 (Kanalwechsel und Vergleichsrunden), Story 4.4 (Ergebnis-Visualisierung), Story 6.4 (Mobile-First & Responsive), Story 6.5 (Barrierefreiheit), ADR-0014.

---

## Epic 3: Teilnahme & Abstimmung (Rolle: Teilnehmende:r) ✅ abgeschlossen

- **Story 3.1 (Beitreten):** 🔴 Als Teilnehmende:r möchte ich über die Eingabe des Session-Codes sofort und ohne Registrierung in die Quiz-Lobby gelangen.
  - **Akzeptanzkriterien:**
    - Eingabefeld für 6-stelligen Code.
    - Bei gültigem Code → Weiterleitung zur Lobby.
    - Bei ungültigem/abgelaufenem Code → Fehlermeldung.
- **Story 3.2 (Nicknames):** 🟡 Als Teilnehmende:r möchte ich einen Nicknamen aus einer themenbezogenen Liste auswählen oder, falls erlaubt, frei eingeben können.
  - **Akzeptanzkriterien:**
    - Die Lehrperson wählt in der Quiz-Konfiguration ein Nickname-Thema (`nicknameTheme`):
      - **Nobelpreisträger** (default) – z.B. "Marie Curie", "Albert Einstein", "Ada Yonath" (mind. 50 Namen).
      - **Kita** – Tiere & Farben, z.B. "Blauer Elefant", "Rotes Einhorn" (mind. 50 Kombinationen).
      - **Grundschule** – Märchenfiguren, z.B. "Rotkäppchen", "Rumpelstilzchen" (mind. 50 Namen).
      - **Mittelstufe** – Superhelden & Entdecker, z.B. "Kolumbus", "Amelia Earhart" (mind. 50 Namen).
      - **Oberstufe** – Wissenschaftler & Philosophen, z.B. "Kant", "Noether", "Hawking" (mind. 50 Namen).
    - Bereits in der Session vergebene Namen werden ausgegraut und sind nicht wählbar.
    - Falls `allowCustomNicknames=true`: Zusätzlich steht ein Freitextfeld zur Verfügung.
    - Falls `allowCustomNicknames=false`: Nur die ausgewählte Themenliste ist verfügbar.
    - Die Listen werden rein clientseitig bereitgestellt (statische Arrays, kein Server-Roundtrip).
    - Doppelte Nicknames in derselben Session werden abgelehnt (DB-Constraint).
- **Story 3.6 (Anonymer Modus):** 🟡 Als Lehrperson möchte ich einen anonymen Modus aktivieren können, bei dem keine Nicknames angezeigt werden, damit die Teilnahme psychologisch druckfrei ist.
  - **Akzeptanzkriterien:**
    - Neues Quiz-Konfigurationsfeld `anonymousMode` (default: false; **Preset „Seriös“ setzt `anonymousMode=false`** — reiner Anonym-Modus ist optional separat aktivierbar, Story 1.11).
    - Wenn aktiviert:
      - Teilnehmende erhalten beim Beitreten eine automatisch generierte ID (z. B. „Teilnehmer #7“) — kein Nickname-Auswahlschritt.
      - In der Lobby (Story 2.2) wird nur die **Zahl der Teilnehmenden** angezeigt, keine Namensliste.
      - Im Leaderboard (Story 4.1) und auf der Beamer-Ansicht werden **keine** individuellen Einträge angezeigt — nur aggregierte Ergebnisse (Durchschnittspunkte, Verteilung der richtigen Antworten).
      - Die persönliche Scorecard (Story 5.6) wird trotzdem auf dem eigenen Gerät angezeigt (ist privat).
    - Wenn deaktiviert: Nickname-Auswahl wie gewohnt (Story 3.2).
    - DSGVO-Vorteil: Im anonymen Modus werden keine pseudonymisierten Daten erhoben — vollständig datensparsam.
- **Story 3.3a (Frage empfangen):** 🔴 Als Teilnehmende:r möchte ich die aktuell freigegebene Frage auf meinem Gerät in Echtzeit sehen.
  - **Akzeptanzkriterien:**
    - tRPC-Subscription `session.onQuestionRevealed` pusht die aktuelle Frage.
    - **Lesephase (`QUESTION_OPEN`, Story 2.6):** Nur der Fragenstamm wird angezeigt (`QuestionPreviewDTO`, ohne Antwortoptionen). Antwort-Buttons und Countdown sind ausgeblendet. Hinweistext: „Lies die Frage — Antworten folgen gleich."
    - **Antwortphase (`ACTIVE`):** Die Antwortoptionen werden eingeblendet, der Countdown startet. Die vollständige Frage wird als `QuestionStudentDTO` (ohne `isCorrect`) angezeigt.
    - Wenn `readingPhaseEnabled=false`: Die Lesephase entfällt — die Frage wird sofort mit Antwortoptionen angezeigt (bisheriges Verhalten).
    - Fragenstamm und Antwortoptionen werden mit Markdown & KaTeX korrekt gerendert (siehe Story 1.7).
- **Story 3.3b (Abstimmung abgeben):** 🔴 Als Teilnehmende:r möchte ich performant abstimmen können.
  - **Akzeptanzkriterien:**
    - tRPC-Mutation `vote.submit` nimmt die Stimme entgegen.
    - Nur eine Stimme pro Frage und teilnehmender Person (DB-Constraint).
    - Visuelles Feedback: "Antwort gesendet ✓".
  - **UI-Vorgaben (Abstimm-Buttons):**
    - **Daumen-Erreichbarkeit:** Buttons liegen im unteren Bildschirmdrittel (Thumb Zone) und haben eine Mindestgröße von 48 × 48 px (WCAG 2.5.8 Target Size).
    - **Entprellung (Debounce):** Nach dem ersten Tap wird der Button sofort als „gesendet" markiert und für 300 ms gegen erneutes Antippen gesperrt, um Doppel-Submits zu verhindern.
    - **Geringe Verzögerung:** Optimistisches UI-Update — die Auswahl wird sofort visuell bestätigt (`selected`-State), bevor die Server-Antwort eintrifft. Bei Fehler wird der State zurückgerollt und eine Fehlermeldung angezeigt.
    - **Kurze Klickfolgen:** Bei SC/MC-Fragen genügt ein einziger Tap auf eine Antwortoption, um die Stimme abzusenden (kein zusätzlicher „Absenden"-Button bei Single Choice). Bei Multiple Choice wird ein kompakter „Absenden"-Button direkt unterhalb der Optionen platziert.
    - **Touch-Feedback:** Buttons zeigen beim Antippen eine sofortige visuelle Reaktion (`:active`-State, Scale-Down-Animation ≤ 50 ms) und haptisches Feedback via Vibration API (`navigator.vibrate(10)`), sofern vom Gerät unterstützt.
    - **Ladeindikator:** Zwischen Tap und Server-Bestätigung wird ein dezenter Spinner/Pulse auf dem gewählten Button angezeigt (kein Fullscreen-Loader).
  - **Button-Layout (Antwortoptionen):**
    - Jede Antwortoption wird als **vollbreiter, vertikal gestapelter Button** dargestellt (100 % Viewport-Breite abzgl. Padding).
    - Jeder Button trägt links ein farbiges **Buchstaben-Label** (A, B, C, D, …) als quadratisches Badge — daneben den Antworttext.
    - **Farbcodierung der Labels:** A = Blau, B = Orange, C = Grün, D = Violett — weitere Optionen folgen dem Farbring. Die Farben sind in Light- und Dark-Theme kontrastkonform (WCAG AA).
    - **Formencodierung (Barrierefreiheit):** Zusätzlich zur Farbe trägt jedes Label eine geometrische Form: A = △ (Dreieck), B = ○ (Kreis), C = □ (Quadrat), D = ◇ (Raute). Damit können farbenblinde Nutzer die Optionen eindeutig unterscheiden (konsistent mit Story 6.5).
    - **Kurztext & Formeln:** Der Antworttext wird einzeilig mit Ellipsis abgeschnitten (`text-overflow: ellipsis`), sofern er breiter als der Button ist. KaTeX-Formeln werden inline gerendert — ist die Formel zu breit, wird auf eine zweite Zeile umbrochen (kein horizontales Scrollen).
    - **Maximale Höhe pro Button:** 64 px (einzeilig) bzw. 96 px (mit Formelumbruch). Dadurch bleiben bei 4 Optionen alle Buttons ohne Scrollen im sichtbaren Bereich ("above the fold").
    - **Beamer-Ansicht (Story 2.5):** Buttons werden als 2×2-Grid dargestellt (bei ≤ 4 Optionen) mit großer Schrift (≥ 28 px) für Lesbarkeit auf Distanz. Ab 5 Optionen wird auf ein einspaltige Liste umgestellt.
    - **MC-Auswahl:** Bei Multiple Choice sind Buttons als Toggles realisiert (Antippen = ausgewählt, erneutes Antippen = abgewählt). Ausgewählte Buttons zeigen einen farbigen Rahmen + Häkchen-Icon. Der „Absenden"-Button erscheint erst, wenn ≥ 1 Option gewählt ist.
    - **Freitext (FREETEXT):** Statt Buttons wird ein vollbreites Textfeld mit „Absenden"-Button angezeigt. Platzhaltertext: „Deine Antwort…".
- **Story 3.4 (Echtzeit-Feedback):** 🟡 Als Teilnehmende:r möchte ich nach der Auflösung durch die Lehrperson sofort sehen, ob meine Antwort richtig war.
  - **Akzeptanzkriterien:**
    - tRPC-Subscription `session.onResultsRevealed` sendet die korrekten Antworten.
    - Eigene Antwort wird grün (richtig) oder rot (falsch) markiert.
    - `isCorrect` wird erst NACH expliziter Auflösung durch die Lehrperson übertragen (Statuswechsel `ACTIVE → RESULTS`). Dies steht nicht im Widerspruch zu Story 2.4, die das Stripping nur während der Frage-Phase (`ACTIVE`) fordert.
- **Story 3.5 (Countdown-Anzeige):** 🔴 Als Teilnehmende:r möchte ich einen gut sichtbaren Countdown-Zähler auf meinem Gerät sehen, damit ich weiß, wie viel Zeit mir noch bleibt.
  - **Akzeptanzkriterien:**
    - Der Countdown startet erst mit dem Statuswechsel zu `ACTIVE` (d. h. nach der Lesephase, Story 2.6). Während `QUESTION_OPEN` wird **kein** Countdown angezeigt.
    - Countdown wird als großer, zentraler Zähler auf dem Client-Gerät (Smartphone) angezeigt.
    - Auf der Beamer-Ansicht der Lehrperson wird der Countdown zusätzlich als Kreisdiagramm / Fortschrittsbalken dargestellt.
    - Countdown synchronisiert sich über den Server-Timestamp (kein Client-Drift).
    - Die letzten 5 Sekunden werden visuell hervorgehoben (rot, pulsierend).
    - Nach Ablauf wird die Eingabe automatisch gesperrt.
    - Falls kein Timer gesetzt ist, wird kein Countdown angezeigt (offene Antwortphase, die Lehrperson beendet manuell).
- **Story 3.5a (Countdown Finger-Anzeige, letzte 6 Sekunden):** 🟡 Als Lehrperson oder Teilnehmende:r möchte ich in den letzten 6 Sekunden des Countdowns die animierte Finger-Countdown-Anzeige (5 → 0) sehen, damit der Zeitablauf spielerisch und einheitlich sichtbar ist.
  - **Akzeptanzkriterien:**
    - Sobald der Countdown die letzten 6 Sekunden erreicht, wird die Finger-Countdown-Animation (wie im Preset-Toast „Spielerisch“) eingeblendet.
    - **Beamer-Ansicht (Story 2.5):** Die Animation wird in **Vollansicht** (groß, zentral oder prominent) angezeigt, sodass sie im Saal gut erkennbar ist.
    - **Client-Geräte (Teilnehmende):** Die Animation wird **klein** (wie auf dem Preset-Toast) in der **unteren linken Ecke** angezeigt, ohne die Antwort-Buttons oder den restlichen Countdown zu überdecken.
    - Dauer der Animation: exakt 6 Sekunden (1 Sekunde pro Frame 5 → 4 → 3 → 2 → 1 → 0), synchron mit dem restlichen Countdown.
    - Nur anzeigen, wenn ein Timer gesetzt ist und das Preset „Spielerisch“ aktiv ist (oder eine optionale Einstellung „Finger-Countdown“ an).
    - Bei `prefers-reduced-motion` kann die Animation durch einen statischen Zähler oder dezente Anzeige ersetzt werden.
  - **Abhängigkeiten:** Story 3.5 (Countdown-Anzeige), Story 2.5 (Beamer-Ansicht), Preset „Spielerisch“ / Countdown-Asset (countdown-fingers.gif bzw. transparente Einzelbilder).

---

## Epic 4: Auswertung & Aufräumen (System & Lehrperson)

- **Story 4.1 (Leaderboard mit Punktesystem):** ✅ Als Lehrperson möchte ich am Ende des Quizzes ein differenziertes Ranking sehen, das Schwierigkeit und Antwortgeschwindigkeit berücksichtigt.
  - **Akzeptanzkriterien:**
    - Leaderboard zeigt Rang, Nickname, Gesamtpunkte und Anzahl richtiger Antworten.
    - **Punkteformel:** `score = difficultyMultiplier × timeBonus`
      - Schwierigkeits-Multiplikator: EASY = ×1, MEDIUM = ×2, HARD = ×3.
      - Zeitbonus: `maxPoints × (1 − responseTime / timerDuration)`, wobei `maxPoints = 1000`. Schnellere Antwort = mehr Punkte.
      - **Fallback bei fehlendem Timer:** Wenn weder `Question.timer` noch `Quiz.defaultTimer` gesetzt ist, erhalten korrekte Antworten pauschal `maxPoints × difficultyMultiplier` (kein Zeitbonus).
      - Falsche Antworten erhalten 0 Punkte.
      - Fragen vom Typ FREETEXT und SURVEY werden nicht gescored (0 Punkte, zählen nicht zur `totalQuestions`).
    - Sortierung: Höchste Gesamtpunktzahl zuerst; bei Gleichstand entscheidet die kürzere Gesamtantwortzeit.
    - Wird nur angezeigt, wenn `showLeaderboard=true` konfiguriert ist.
    - Nach jeder Frage kann optional ein Zwischenstand (Top 5) eingeblendet werden.
- **Story 4.2 (Server aufräumen):** ✅ Als System möchte ich, dass die flüchtigen Abstimmungsdaten (Redis) vom Server gelöscht werden, sobald die Lehrperson die Live-Session beendet.
  - **Akzeptanzkriterien:**
    - `session.end`-Mutation setzt Status auf `FINISHED` und löscht Redis-Keys.
    - Votes bleiben in PostgreSQL für spätere Leaderboard-Auswertung erhalten.
    - Automatisches Cleanup nach 24h für nicht beendete Sessions.
- **Story 4.3 (WebSocket Reconnection):** ✅ Als System möchte ich, dass abgebrochene WebSocket-Verbindungen automatisch wiederhergestellt werden.
  - **Akzeptanzkriterien:**
    - Frontend erkennt Verbindungsabbruch und zeigt Hinweis an.
    - Automatischer Reconnect-Versuch (Exponential Backoff).
    - Nach Reconnect wird der aktuelle Session-Zustand synchronisiert.
- **Story 4.4 (Ergebnis-Visualisierung):** ✅ Als Lehrperson möchte ich die Abstimmungsergebnisse nach jeder Frage als anschauliche Grafik auf dem Beamer sehen.
  - **Akzeptanzkriterien:**
    - **MC/SC-Fragen:** Horizontales Balkendiagramm — ein Balken pro Antwortoption, Länge proportional zur Anzahl Votes, absolute Zahl + Prozentwert als Label.
    - Korrekte Antworten werden nach Auflösung grün hervorgehoben, falsche rot (+ Icons ✓/✗ für Farbunabhängigkeit, Story 6.5).
    - **SURVEY-Fragen:** Gleiches Balkendiagramm, aber ohne Farbmarkierung (kein richtig/falsch).
    - **FREETEXT-Fragen:** Antworten werden als scrollbare Liste angezeigt; bei ≥ 10 identischen Antworten zusätzlich als Wordcloud (Story 4.5).
    - Animation: Balken wachsen von 0 auf Endwert (300 ms ease-out). Bei `prefers-reduced-motion` wird die Animation übersprungen.
    - Diagramm skaliert responsive (Mobile: vertikal gestapelt, Beamer: horizontal).
    - Wird sowohl in der Beamer-Ansicht (Story 2.5) als auch auf den Geräten der Teilnehmenden angezeigt.
- **Story 4.5 (Freitext-Auswertung):** ✅ Als Lehrperson möchte ich die eingegangenen Freitext-Antworten gebündelt einsehen können, um offene Fragen auszuwerten.
  - **Akzeptanzkriterien:**
    - Alle Freitext-Antworten werden in einer sortierbaren Liste angezeigt (alphabetisch / nach Häufigkeit).
    - Identische oder sehr ähnliche Antworten werden gruppiert mit Anzahl-Badge.
    - Bei ≥ 10 eindeutigen Antworten wird eine Wordcloud als alternative Darstellung angeboten.
    - Die Lehrperson kann einzelne Antworten auf dem Beamer hervorheben (Klick → vergrößerte Anzeige).
    - Datenschutz: Freitext-Antworten werden **nicht** mit Nicknames verknüpft dargestellt (anonyme Auswertung, konsistent mit DSGVO-Prinzip der Datensparsamkeit).
- **Story 4.6 (Bonus-Code für Top-Platzierungen):** ✅ Als Lehrperson möchte ich den bestplatzierten Teilnehmenden im Leaderboard einen individuellen Bonus-Code ausstellen können, den diese per E-Mail zur Einlösung von Bonuspunkten oder Anerkennung einreichen, damit herausragende Leistungen belohnt werden — ohne die Anonymität der übrigen Teilnehmenden zu gefährden.
  - **Hinweis Wording:** In der gesamten UI wird „Bonus-Code“ bzw. „Code“ verwendet (nicht „Token“); technisch bleibt das Datenmodell `BonusToken`/`bonusTokenCount` unverändert.
  - **Akzeptanzkriterien:**
    - In der Quiz-Konfiguration (Story 1.4) gibt es ein neues optionales Feld `**bonusTokenCount`\*\* (`Int?, 1–50, default: null`). Wenn gesetzt, erhalten die Top X im finalen Leaderboard automatisch einen Code.
    - **Code-Generierung (serverseitig):**
      - Beim Beenden der Session (`session.end`) werden für die Top X Plätze kryptografisch sichere, einmalige Codes generiert (`crypto.randomUUID()` oder `nanoid`, 12 Zeichen, z. B. `BNS-A3F7-K2M9`).
      - Jeder Code wird als `BonusToken`-Datensatz in PostgreSQL gespeichert mit: `token`, `sessionId`, `participantId`, `nickname` (Snapshot), `quizName` (Snapshot), `totalScore`, `rank`, `generatedAt`.
      - Codes sind nach Generierung unveränderlich (kein Update, keine Regeneration).
    - **Ansicht der Teilnehmenden:**
      - Die Top-X-Teilnehmenden sehen auf ihrer finalen Scorecard (Story 5.6) zusätzlich einen hervorgehobenen Bereich: **„🎓 Dein Bonus-Code: `BNS-A3F7-K2M9`“**.
      - Ein „Kopieren"-Button kopiert den Code in die Zwischenablage (`navigator.clipboard.writeText`).
      - Ein erklärender Hinweis: _„Sende diesen Code per E-Mail an deine Lehrperson, um Bonuspunkte zu erhalten. Deine Anonymität bleibt gewahrt, solange du den Code nicht einreichst.“_
      - Der Code wird **nur** der jeweils berechtigten teilnehmenden Person angezeigt (individuell per tRPC-Subscription `session.onPersonalResult`, kein Broadcast).
      - Teilnehmende, die nicht in den Top X sind, sehen keinen Bonus-Code-Bereich.
    - **Ansicht der Lehrperson (Bonus-Code-Liste):**
      - Nach Beendigung der Session kann die Lehrperson über einen neuen tRPC-Query `**session.getBonusTokens({ sessionId })`\*\* die vollständige Liste der ausgegebenen Codes abrufen.
      - Die Liste enthält pro Eintrag: Code, Pseudonym (Nickname), Quiz-Name, erreichte Punkte, Ranking-Platz, Datum.
      - Die Liste ist als Tabelle dargestellt und kann als **CSV exportiert** werden (clientseitiger Download).
      - Die Lehrperson sieht **keine** echten Namen oder E-Mail-Adressen — nur Pseudonyme.
    - **Verifizierungs-Workflow (außerhalb der App):**
      - Teilnehmende senden ihren Code per E-Mail an die Lehrperson.
      - Die Lehrperson gleicht den Code mit der CSV-/Tabellenliste ab und schreibt anhand der Absender-Mailadresse Bonuspunkte gut.
      - Die App selbst speichert keine E-Mail-Adressen (DSGVO-konform, Prinzip der Datensparsamkeit).
    - **Anonymitätsgarantie:**
      - Die Zuordnung Code → reale Person ist **nur** möglich, wenn eine teilnehmende Person ihren Code freiwillig per E-Mail einreicht.
      - Teilnehmende, die nicht einreichen, bleiben vollständig anonym — auch gegenüber der Lehrperson.
      - Im anonymen Modus (Story 3.6) werden Codes dennoch generiert (Pseudonym = „Teilnehmer #7“), da die Einreichung per E-Mail die freiwillige De-Anonymisierung darstellt.
    - **Gültigkeit & Cleanup:**
      - Bonus-Codes (BonusToken-Datensätze) bleiben 90 Tage in der Datenbank gespeichert, danach werden sie automatisch gelöscht (Erweiterung von Story 4.2).
      - Codes sind nicht übertragbar — die Lehrperson prüft den Absender der E-Mail eigenverantwortlich.
    - **Abhängigkeiten:** Story 4.1 (Leaderboard), Story 5.6 (Persönliche Scorecard).
- **Story 4.7 (Ergebnis-Export für Lehrende – anonym):** ✅ Als Lehrperson möchte ich nach Ende einer Session die Auswertung anonym als Datei (CSV/PDF) herunterladen können, damit ich die Ergebnisse für Nachbereitung, Lehrevaluation oder Akkreditierung nutzen kann — ohne personenbezogene Daten.
  - **Akzeptanzkriterien:**
    - Nach Beendigung der Session (Status `FINISHED`) steht in der Ansicht der Lehrperson ein Button **„Ergebnis exportieren“** zur Verfügung.
    - **CSV-Export (mindestens):** Enthält pro Zeile aggregierte Daten, z. B.: Session-ID, Quiz-Name, Datum, pro Frage: Fragentext (Kurz), Fragentyp, Zahl der Teilnehmenden, Verteilung der Antworten (Anzahl pro Option bzw. bei Freitext: aggregierte Begriffe/Häufigkeiten), Durchschnittspunktzahl pro Frage, keine Nicknames und keine personenbezogenen Daten.
    - Optional: **PDF-Export** mit gleichen Inhalten in lesbarer Form (z. B. Deckblatt, pro Frage eine Seite mit Balkendiagramm-Beschreibung oder Word-Cloud-Text).
    - Bonus-Code-Liste (Story 4.6) kann in den Export einbezogen werden (Code, Rang, Punkte, Pseudonym) — entspricht der bereits in Story 4.6 beschriebenen CSV-Funktion; kein Widerspruch zur Anonymität, da Zuordnung nur über freiwillige E-Mail-Einreichung.
    - Export erfolgt clientseitig (Generierung im Browser) oder über einen tRPC-Query, der nur aggregierte/anonymisierte Daten zurückgibt; keine Speicherung der Export-Datei auf dem Server.
    - **tRPC & Schemas (bei serverseitiger Variante):** Query `session.getExportData` mit `GetExportDataInputSchema` (sessionId); Rückgabe `SessionExportDTO` (sessionId, sessionCode, quizName, finishedAt, participantCount, questions[], bonusTokens?). Siehe `libs/shared-types/src/schemas.ts` (SessionExportDTOSchema, QuestionExportEntrySchema, OptionDistributionEntrySchema, FreetextAggregateEntrySchema).
    - DSGVO: Export enthält ausschließlich anonymisierte bzw. aggregierte Daten; Hinweis in der UI: „Export für Dokumentation und Evaluation – keine personenbezogenen Daten“.
    - Abhängigkeiten: Story 4.1 (Leaderboard), Story 4.4 (Ergebnis-Visualisierung), Story 4.5 (Freitext-Auswertung), Story 4.6 (Bonus-Code-Liste).
- **Story 4.8 (Session-Bewertung durch Teilnehmende):** ✅ Als Teilnehmende:r möchte ich am Ende einer Session das Quiz bewerten können (z. B. Qualität der Fragen, hat mir gefallen, sollen wir solche Quizze regelmäßig machen?), damit Lehrperson und alle Beteiligten ein gemeinsames Stimmungsbild sehen.
  - **Akzeptanzkriterien:**
    - Nach Beendigung der Session (Status `FINISHED`) können Teilnehmende auf ihrem Gerät eine **kurze Bewertung** abgeben (einmalig pro Person pro Session).
    - **Aufforderung zur Teilnahme:** Auf dem Teilnehmenden-Gerät erscheint eine deutliche Einladung, das Quiz zu bewerten und sich an der Umfrage zu beteiligen (z. B. „Deine Meinung zählt — bewerte das Quiz“ bzw. „Beteilige dich an der Umfrage“). Auf der Beamer-Ansicht kann die Lehrperson optional einen ähnlichen Aufruf anzeigen (z. B. „Jetzt abstimmen: Wie hat euch das Quiz gefallen?“), um die Beteiligung zu steigern.
    - **Bewertung per Sterne oder aufsteigende Emojis:** Die Bewertung erfolgt über **Sterne** (z. B. 1–5 Sterne) oder **aufsteigende Emojis** (z. B. 😞 → 🙂 → 😊), nicht über lange Skalen oder viele Einzelfragen. Mindestens: „Wie hat dir das Quiz gefallen?“ (Sterne/Emojis); optional „Qualität der Fragen?“ und „Sollen wir solche Quizze regelmäßig durchführen?“ (ebenfalls Sterne/Emojis). **Keine Freitext-Box** — nur vordefinierte Sterne/Emojis (vermindert Missbrauch).
    - Die **aggregierte Auswertung** (Durchschnitte, Verteilungen) ist **für alle sichtbar**: Die Lehrperson sieht sie in der Steuerungs- und Beamer-Ansicht, Teilnehmende sehen sie auf ihrem Gerät (z. B. nach Abgabe oder auf Knopfdruck „Ergebnis anzeigen“). Keine personenbezogene Zuordnung — nur Summen und Häufigkeiten.
    - Im Preset **Spielerisch** kann die Session-Bewertung prominent angeboten werden (z. B. direkt nach „Quiz beendet“); im Preset **Seriös** optional oder dezenter (z. B. Link „Feedback geben“).
    - **Datenmodell:** Neue Entität oder Erweiterung (z. B. `SessionFeedback` mit sessionId, participantId optional anonym, Bewertungsitems, aggregierte Auswertung serverseitig berechnet). Speicherung nur bis zum Session-Cleanup (Story 4.2); Export in Story 4.7 kann Session-Bewertung anonym mit einbeziehen.
    - **tRPC:** Mutation zum Abgeben der Bewertung (z. B. `session.submitSessionFeedback`); Query oder Subscription für aggregierte Bewertung (z. B. `session.getSessionFeedbackSummary`), für Lehrperson und Teilnehmende gleichermaßen abrufbar.
    - Abhängigkeiten: Story 4.2 (Session-Ende/Cleanup), Story 4.4 (Ergebnis-Visualisierung für Darstellung der Auswertung).

---

## Epic 5: Gamification & Audio-Effekte (Rolle: Lehrperson & Teilnehmende:r) ✅ abgeschlossen

> **Tag:** `epic-5` · UX-Verbesserungen (Phasen-Labels, Lesephase-Banner, Letzte-Frage-Hinweis, Richtig-Badge, KaTeX-Scrollbar, Join/Diskussion) sind in den Session-Features integriert.

- **Story 5.1 (Sound-Effekte):** 🟡 Als Lehrperson möchte ich, dass bei bestimmten Quiz-Events automatisch Sound-Effekte abgespielt werden, um die Atmosphäre im Hörsaal zu steigern.
  - **Akzeptanzkriterien:**
    - Ein Gong/Pfiff ertönt, wenn das Quiz endet (`SessionStatus.FINISHED`).
    - Ein kurzer Sound signalisiert den Start einer neuen Frage (`SessionStatus.ACTIVE`).
    - Ein Tick-Sound begleitet die letzten 5 Sekunden des Countdowns.
    - Die Lehrperson kann Sounds global an/aus schalten (Quiz-Konfiguration `enableSoundEffects`, default: an).
    - Sound-Dateien liegen unter **`apps/frontend/src/assets/sound`** und werden als statische Assets gebundelt (kein Server-Roundtrip).
    - Sounds werden über die Web Audio API abgespielt und respektieren die Browser-Autoplay-Policy (erster Klick aktiviert Audio-Context).
- ~~\*\*Story 5.2~~ → verschoben nach Story 3.5\*\* _(Countdown-Anzeige gehört zur Kern-Abstimmung, nicht zur Gamification — siehe Epic 3)_
- **Story 5.3 (Hintergrundmusik):** 🟢 Als Lehrperson möchte ich eine Hintergrundmusik während der Lobby- und Countdown-Phase abspielen können, um eine spielerische Stimmung zu erzeugen.
  - **Akzeptanzkriterien:**
    - Die Lehrperson kann aus mindestens 3 vordefinierten Musik-Tracks wählen (z. B. „Entspannt“, „Spannend“, „Episch“).
    - Musik wird nur auf dem Beamer-/Host-Gerät abgespielt, **nicht** auf den Smartphones der Teilnehmenden.
    - Musik stoppt automatisch, wenn eine Frage aufgelöst wird (`SessionStatus.RESULTS`).
    - Lautstärkeregler (0–100 %) in der Ansicht der Lehrperson.
    - Musik-Dateien liegen unter **`apps/frontend/src/assets/sound`** (z.B. `lobby/`), sind lizenzfrei und werden als Assets gebundelt.
    - Konfigurierbar pro Quiz (`backgroundMusic: string | null`).
- **Story 5.4 (Belohnungseffekte bei Platzierung):** 🟡 Als Teilnehmende:r möchte ich bei einer vorderen Platzierung im Leaderboard eine visuelle Belohnung sehen, damit der Wettbewerb motivierend wird.
  - **Akzeptanzkriterien:**
    - **Platz 1:** Konfetti-Animation + Gold-Pokal-Icon + Fanfare-Sound.
    - **Platz 2:** Silber-Medaillen-Icon + kurzer Jubel-Sound.
    - **Platz 3:** Bronze-Medaillen-Icon + kurzer Applaus-Sound.
    - Animationen werden per CSS-Keyframes / Canvas (`canvas-confetti`) realisiert – keine schweren Libraries.
    - Effekte werden sowohl auf dem Beamer als auch auf den Smartphones der Top-3 angezeigt.
    - Effekte können von der Lehrperson deaktiviert werden (`enableRewardEffects`, default: an).
    - Bei `prefers-reduced-motion: reduce` werden Animationen deaktiviert; nur statische Icons und Text werden angezeigt (konsistent mit Story 6.5).
    - Abhängig von Story 4.1 (Leaderboard).
- **Story 5.4a (Foyer-Einflug im Preset Spielerisch):** 🟡 Als Teilnehmende:r möchte ich im Preset `Spielerisch` während der Connecting-Phase sehen, wie bunte Teilnehmenden-Chips in das Foyer einfliegen, damit der Einstieg lebendig, motivierend und unverwechselbar wirkt.
  - **Akzeptanzkriterien:**
    - **Nur im Preset `Spielerisch`:** Der Effekt ist standardmäßig nur aktiv, wenn das Quiz bzw. die Live-Session im Preset `Spielerisch` läuft; im Preset `Seriös` erscheint keine verspielte Einflug-Animation.
    - **Connecting-Phase klar definiert:** Der Effekt wird während des Verbindens bzw. beim Übergang in Lobby/Foyer gezeigt, nicht während aktiver Fragen oder Ergebnisphasen.
    - **Eigenständiger Stil:** Die Animation darf an die Lebendigkeit von Kahoot erinnern, muss aber einen klar eigenen Stil von arsnova.eu haben; sie ist keine optische Kopie bestehender Produkte.
    - **Teilnehmende als Chips:** Jede neu beitretende Person wird als farbiger Chip visualisiert; der Chip kann Initiale, Icon, Pseudonym oder ein abstrahiertes Teilnehmenden-Symbol tragen.
    - **Mehrere Farben gleichzeitig:** Die Chips verwenden mehrere deutlich unterscheidbare, themenkonforme Farben und erzeugen dadurch ein lebendiges, aber nicht chaotisches Gesamtbild.
    - **Einflugbewegung ins Foyer:** Neue Chips bewegen sich sichtbar von außerhalb oder vom Rand in den Foyer-Bereich hinein und kommen dort in einer ruhigen Endposition an.
    - **Kein wildes Durcheinander:** Auch bei vielen fast gleichzeitigen Joins bleibt die Bewegung lesbar; Chips dürfen sich nicht störend überlagern oder hektisch unkontrolliert springen.
    - **Host-Lobby profitiert sichtbar:** In der Host-Lobby wird der Effekt klar sichtbar, damit die Lehrperson den lebendigen Zulauf ins Foyer wahrnimmt.
    - **Beamer-tauglich:** Wenn die Lobby auf dem Beamer gezeigt wird, ist der Effekt großzügig, kontrastreich und aus der Distanz gut erkennbar.
    - **Teilnehmenden-Gerät mit passendem Feedback:** Auf dem Smartphone der beitretenden Person gibt es einen kleineren, passenden Ankunftsmoment oder eine Bestätigung, die den erfolgreichen Eintritt ins Foyer spielerisch bestätigt.
    - **Ruhender Endzustand:** Nach dem Einflug bleiben Chips stabil im Foyer sichtbar oder gehen in eine geordnete Lobby-Darstellung über; es bleibt kein permanent unruhiges Herumfliegen bestehen.
    - **Skalierung bei vielen Joins:** Bei steigender Zahl Teilnehmender skaliert die Darstellung sauber, z. B. über kleinere Chips, Clustering oder reduzierte Bewegungsdauer, ohne unlesbar zu werden.
    - **Keine Behinderung zentraler Lobby-Infos:** Session-Code, QR-Code, Join-Link, Teamkarten oder die Zahl der Teilnehmenden bleiben trotz Animation klar lesbar und bedienbar.
    - **Designsystem-konform:** Form, Farbe, Schatten, Bewegung und Timing passen zu Material 3 und zum visuellen Stil der Startseite bzw. des Presets `Spielerisch`.
    - **Konfigurierbar über bestehende Effektlogik:** Der Effekt respektiert vorhandene Effekt-Schalter wie `enableRewardEffects` oder eine gleichwertige dedizierte Option für Lobby-Mikrointeraktionen.
    - **`prefers-reduced-motion`:** Bei reduzierter Bewegung wird der Einflug stark vereinfacht oder durch eine statische, sanfte Einblendung ersetzt.
    - **Performant im Live-Betrieb:** Auch bei vielen schnellen Beitritten bleibt die Lobby flüssig; Animationen dürfen das UI nicht spürbar blockieren.
    - **Team-Modus kompatibel:** Wenn Team-Modus aktiv ist, dürfen Chips farblich oder gruppierend mit Teamkarten zusammenspielen, ohne die Team-Erkennbarkeit zu verschlechtern.
    - **Anonymität gewahrt:** Im anonymen oder seriösen Kontext werden keine zusätzlichen personenbezogenen Signale sichtbar gemacht; der Effekt arbeitet mit den ohnehin zulässigen Anzeigeformen.
    - **Sound optional, nicht zwingend:** Ein kurzer verspielter Join-Sound ist optional möglich, darf aber nur abgespielt werden, wenn Soundeffekte aktiv sind und die Browser-Policy das erlaubt.
    - **Testfälle für Qualität:** Die Story gilt erst als abgeschlossen, wenn die Lobby mit wenigen, mittleren und vielen parallelen Joins visuell geprüft wurde und der Effekt in allen drei Fällen motivierend statt störend wirkt.
  - **Abhängigkeiten:** Story 2.2 (Lobby-Ansicht), Story 1.11 (Preset `Spielerisch`), Story 5.1 (Sound-Effekte, optional), Story 6.4 (Responsive), Story 6.5 (Barrierefreiheit).
- **Story 5.5 (Answer Streak — Serienbonus):** 🟡 Als Teilnehmende:r möchte ich für aufeinanderfolgende richtige Antworten einen steigenden Bonus erhalten, damit ich für Konstanz belohnt werde.
  - **Akzeptanzkriterien:**
    - Für jede weitere korrekte Antwort in Folge steigt der Streak-Zähler: 2er-Streak = ×1.1, 3er-Streak = ×1.2, 4er-Streak = ×1.3, 5+ = ×1.5 (Multiplikator auf den Frage-Score).
    - Bei einer falschen Antwort oder keiner Antwort wird der Streak auf 0 zurückgesetzt.
    - **Formel:** `finalScore = score × streakMultiplier` (der `score` aus Story 4.1 wird mit dem Streak-Faktor multipliziert).
    - FREETEXT- und SURVEY-Fragen unterbrechen den Streak **nicht** (sie werden übersprungen).
    - Der aktuelle Streak-Zähler wird auf der persönlichen Scorecard (Story 5.6) angezeigt.
    - Auf dem Beamer wird bei Streaks ≥ 3 ein Flammen-Icon (🔥) neben dem Nickname im Leaderboard-Zwischenstand angezeigt.
    - Streak-Daten werden serverseitig berechnet (kein Client-Vertrauen) und im `Vote`-Modell als `streakCount` gespeichert.
- **Story 5.6 (Persönliche Scorecard):** 🔴 Als Teilnehmende:r möchte ich nach jeder Frage eine persönliche Ergebniskarte auf meinem Smartphone sehen, die mir zeigt, wie ich abgeschnitten habe.
  - **Akzeptanzkriterien:**
    - Nach der Auflösung (Status `RESULTS`) wird auf dem Gerät der teilnehmenden Person eine Scorecard eingeblendet mit:
      - Ergebnis: ✓ Richtig / ✗ Falsch (+ korrekte Antwort bei Falsch).
      - Punkte für diese Frage (Score + Streak-Bonus aufgeschlüsselt).
      - Aktueller Streak-Zähler mit Flammen-Animation bei ≥ 3 (🔥).
      - Aktueller Rang im Leaderboard + Rangveränderung seit der letzten Frage (z.B. „↑ 3 Plätze", „↓ 1 Platz", „— gleich").
      - Gesamtpunktzahl bisher.
    - Die Scorecard wird als Overlay/Bottom-Sheet angezeigt und verschwindet automatisch, wenn die nächste Frage beginnt.
    - Bei SURVEY/FREETEXT-Fragen: Scorecard zeigt nur „Antwort registriert" + aktuellen Rang (keine Punkte).
    - tRPC-Subscription `session.onPersonalResult` liefert die Daten individuell pro Participant (kein Broadcast der Einzelergebnisse an alle).
- **Story 5.7 (Motivationsmeldungen):** 🟡 Als Teilnehmende:r möchte ich kontextbezogene Motivationsmeldungen auf meiner Scorecard sehen, die mich anfeuern.
  - **Akzeptanzkriterien:**
    - Meldungen werden basierend auf dem Kontext ausgewählt:
      - **Richtig + schnell (Top 25% Antwortzeit):** „Blitzschnell! ⚡"
      - **Richtig + Streak ≥ 3:** „On fire! 🔥 {streakCount}er-Serie!"
      - **Richtig + langsam:** „Richtig! Knapp, aber korrekt 👍"
      - **Falsch + vorher Streak:** „Streak gerissen! Nächste Runde! 💪"
      - **Falsch + Rang im oberen Drittel:** „Kopf hoch — du liegst noch gut! 🏅"
      - **Falsch + Rang im unteren Drittel:** „Weiter so — jede Frage ist eine neue Chance! 🌟"
      - **Rangaufstieg:** „{rankChange} Plätze aufgestiegen! 🚀"
    - Meldungen werden rein clientseitig aus den Scorecard-Daten generiert (kein Server-Roundtrip).
    - Meldungen werden in der jeweils gewählten App-Sprache angezeigt (i18n, Story 6.2).
    - Die Lehrperson kann Motivationsmeldungen global an/aus schalten (Quiz-Konfiguration, neues Feld `enableMotivationMessages`, default: an).
- **Story 5.8 (Emoji-Reaktionen in Ergebnis-Phase):** 🟢 Als Teilnehmende:r möchte ich in der Ergebnis-Phase mit Emoji-Reaktionen reagieren können, um die Stimmung im Hörsaal zu äußern.
  - **Akzeptanzkriterien:**
    - Nach der Auflösung (Status `RESULTS`) erscheint auf dem Gerät der teilnehmenden Person eine Emoji-Leiste mit 5 vordefinierten Reaktionen: 👏 🎉 😮 😂 😢.
    - Ein Tap auf ein Emoji sendet die Reaktion an den Server (tRPC-Mutation `session.react`).
    - Auf der Beamer-Ansicht (Story 2.5) werden eingehende Reaktionen als aufsteigende Emoji-Blasen am rechten Bildschirmrand animiert (ähnlich Instagram Live).
    - Maximal 1 Reaktion pro teilnehmender Person pro Frage (Entprellung).
    - Reaktionen werden **nicht** persistiert (nur Redis/In-Memory, flüchtig).
    - Emoji-Reaktionen können von der Lehrperson deaktiviert werden (Quiz-Konfiguration, neues Feld `enableEmojiReactions`, default: an).
    - Bei `prefers-reduced-motion` werden Blasen ohne Animation angezeigt (statische Liste statt Aufsteigen).

---

## Epic 6: Theming & Barrierefreiheit (Rolle: Alle Nutzer) — abgeschlossen

Epic 6 bündelt **Theming, Internationalisierung, rechtliche Pflichtseiten, Mobile-First und Barrierefreiheit**. Alle Stories zielen auf Nutzer:innen aller Rollen (Lehrperson, Teilnehmende, Gast). Keine Abhängigkeit von Epic 5; kann parallel ab Epic 0 umgesetzt werden.

**Stand:** Stories 6.1 (Theme), 6.2 (i18n inkl. Locale-Formatierung für Datum/Zahlen), 6.3 (Impressum/Datenschutz) und 6.4 (Mobile-First/PWA) sind umgesetzt; Akzeptanzkriterien geprüft (siehe `docs/EPIC6-AC-PRUEFUNG.md`). Story 6.5 bleibt als fortlaufender Qualitäts-Checkpoint (WCAG-Audit) über den Projektverlauf bestehen und blockiert den Epic-Abschluss nicht. Story 6.6 ergänzt **qualitative UX-Testreihen** (Thinking Aloud) und die **konkrete Umsetzung** der daraus abgeleiteten UI/UX-Anpassungen.

- **Story 6.1 (Dark/Light/System-Theme):** 🟡 Als Nutzer möchte ich zwischen Dark Theme, Light Theme und System-Einstellung wählen können, damit die App meinen Sehgewohnheiten entspricht.
  - **Akzeptanzkriterien:**
    - Ein Theme-Umschalter (Icon-Button) in der Navigationsleiste bietet drei Optionen: Light, Dark, System.
    - **System** (default) übernimmt die Betriebssystem-Einstellung via `prefers-color-scheme` Media-Query.
    - Theme-Wechsel erfolgt sofort ohne Seitenreload (CSS-Klasse `dark` auf `<html>`).
    - Die Auswahl wird im `localStorage` persistiert und beim nächsten Besuch wiederhergestellt.
    - Alle UI-Komponenten nutzen Material Design 3 Theme-Tokens für Farben, Hintergründe und Kontraste (ADR 0005).
    - Countdown, Leaderboard, Lobby und Beamer-Ansicht unterstützen beide Themes.
    - Kontrastverhältnisse erfüllen WCAG 2.1 AA (mind. 4.5:1 für Text).
  - **Verifizierung:** ThemePresetService, Top-Toolbar (System/Dark/Light), localStorage, MD3-Tokens; siehe `docs/EPIC6-AC-PRUEFUNG.md`.
- **Story 6.2 (Internationalisierung):** 🟡 Als Nutzer möchte ich die App in meiner Sprache verwenden können, damit ich alle Bedienelemente und Hinweise verstehe.
  - **Akzeptanzkriterien:**
    - Unterstützte Sprachen: Deutsch (de), Englisch (en), Französisch (fr), Italienisch (it), Spanisch (es).
    - **Browser** (default) — die Sprache wird automatisch aus `navigator.language` abgeleitet; Fallback: Englisch.
    - Ein Sprachwähler (Dropdown / Icon-Button) in der Navigationsleiste ermöglicht manuelles Umschalten.
    - Die Auswahl wird im `localStorage` persistiert und beim nächsten Besuch wiederhergestellt.
    - Internationalisierung wird über Angulars eingebautes i18n (`@angular/localize`) mit XLIFF umgesetzt.
    - Alle UI-Texte (Buttons, Labels, Fehlermeldungen, Platzhalter) werden über Übersetzungsdateien (`src/locale/messages.*.xlf`) bereitgestellt.
    - Quiz-Inhalte (Fragenstamm, Antworten) werden **nicht** übersetzt — sie bleiben in der von der Lehrperson eingegebenen Sprache.
    - Datums- und Zahlenformate passen sich der gewählten Locale an (`DatePipe`, `DecimalPipe`).
  - **Verifizierung:** Locales `de/en/fr/es/it` in `angular.json` aktiv; `messages.en.xlf`, `messages.fr.xlf`, `messages.es.xlf`, `messages.it.xlf` vorhanden und build-fähig (`npm run build:localize`). Sprachwähler und Locale-Subpfade aktiv (`/de`, `/en`, `/fr`, `/es`, `/it`); UI-Texte inkl. ARIA/Status in Templates und `$localize` markiert.
- **Story 6.3 (Impressum & Datenschutzerklärung):** 🔴 Als Nutzer möchte ich ein Impressum und eine Datenschutzerklärung einsehen können, damit die App den gesetzlichen Anforderungen (TMG, DSGVO) entspricht.
  - **Akzeptanzkriterien:**
    - Im Footer jeder Seite befinden sich Links zu „Impressum" und „Datenschutz".
    - Beide Seiten sind als eigene Angular-Routen erreichbar (`/legal/imprint`, `/legal/privacy`) — sprachneutrale Pfade für i18n-Kompatibilität.
    - Inhalte werden als Markdown-Dateien gepflegt und zur Buildzeit gerendert (leicht editierbar ohne Code-Änderung).
    - **Impressum** enthält mindestens: Betreiber, Anschrift, Kontakt (E-Mail), Verantwortlicher i.S.d. § 18 MStV.
    - **Datenschutzerklärung** enthält mindestens: Verantwortlicher, Art der erhobenen Daten, Rechtsgrundlage (Art. 6 DSGVO), Hinweis auf Local-First-Architektur (keine serverseitige Speicherung von Quiz-Inhalten), Cookie-/LocalStorage-Nutzung, Hosting-Anbieter, Betroffenenrechte (Auskunft, Löschung, Widerspruch), Kontakt des Datenschutzbeauftragten.
    - Beide Seiten sind ohne Login erreichbar.
    - Inhalte werden in der aktuell gewählten Sprache angezeigt (abhängig von Story 6.2; Fallback: Deutsch).
  - **Verifizierung:** Footer-Links, Routen, Markdown in `assets/legal/` vollständig; Inhalte verfügbar für `de/en/fr/es/it` (`imprint.{locale}.md`, `privacy.{locale}.md`) mit Fallback auf `de`.
- **Story 6.4 (Mobile-First & Responsive Design):** 🔴 Als Teilnehmende:r möchte ich die App auf meinem Smartphone komfortabel bedienen können, da ich im Hörsaal primär mein Handy nutze.
  - **Akzeptanzkriterien:**
    - Alle Ansichten werden **Mobile-First** entwickelt: Basis-Layout für Smartphones (≤ 640px), erweitert für Tablets (≥ 768px) und Desktop/Beamer (≥ 1024px).
    - Responsive Breakpoints (640px, 768px, 1024px, 1280px) werden konsequent genutzt — keine festen Pixelbreiten.
    - Touch-Targets (Buttons, Antwortoptionen) sind mindestens 44×44px groß (Apple HIG / WCAG 2.5.5).
    - Abstimmungsbuttons sind auf Smartphones als vollbreite, gestapelte Karten dargestellt (einfaches Antippen).
    - Die Beamer-Ansicht der Lehrperson nutzt die volle Breite (`lg`+) mit großer Schrift, Countdown und Leaderboard.
    - Kein horizontales Scrollen auf Viewports ≥ 320px.
    - Viewport-Meta-Tag ist korrekt gesetzt (`width=device-width, initial-scale=1`).
    - PWA-fähig: `manifest.json` mit Icon-Set, damit die App zum Homescreen hinzugefügt werden kann.
  - **Verifizierung:** Viewport-Meta, `check-viewport-320.mjs`, Touch 44px, `manifest.webmanifest` mit Icons; Breakpoints teils 600px (Backlog 640px).
- **Story 6.5 (Barrierefreiheit / Accessibility):** 🔴 Als Nutzer mit Einschränkungen möchte ich die App vollständig per Tastatur, Screenreader und assistive Technologien bedienen können. _(Zur Prüfung ans Projektende gestellt — MD3/Angular decken Großteil ab.)_
  - **Akzeptanzkriterien:**
    - **Tastaturnavigation:** Alle interaktiven Elemente (Buttons, Inputs, Antwortoptionen, Dropdown-Menüs) sind per `Tab`-Taste erreichbar und per `Enter`/`Space` aktivierbar.
    - **Fokus-Management:** Ein sichtbarer Fokusring (`focus-visible`) ist auf allen interaktiven Elementen vorhanden. Nach Seitenwechsel, Modal-Öffnung oder Theme-/Sprachumschaltung auf der Startseite wird der Fokus programmatisch auf das erste relevante Element (z. B. Session-Code-Eingabe) gesetzt.
    - **Screenreader-Support:** Alle Bilder haben `alt`-Texte, alle Icons haben `aria-label`. Dynamische Statusänderungen (Countdown, Zahl der Teilnehmenden, Antwort-Feedback) werden über `aria-live`-Regionen kommuniziert.
    - **Semantisches HTML:** Überschriften-Hierarchie (`h1`–`h6`) ist korrekt. Formulare nutzen `<label>`-Elemente mit `for`-Attribut. Listen nutzen `<ul>`/`<ol>`.
    - **ARIA-Rollen:** Custom-Komponenten (Theme-Switcher, Sprachwähler, Quiz-Steuerung) verwenden korrekte ARIA-Rollen (`role="tablist"`, `role="dialog"`, etc.).
    - **Farbunabhängigkeit:** Richtig/Falsch-Feedback nutzt neben Farbe (grün/rot) auch Icons (✓/✗) und Text, damit farbenblinde Nutzer es erkennen können.
    - **Schriftgröße:** Text ist bis 200% Browser-Zoom ohne Layoutbruch lesbar.
    - **Reduzierte Bewegung:** Bei `prefers-reduced-motion: reduce` werden Animationen (Konfetti, Pulsen, Countdowns) deaktiviert oder stark reduziert.
    - **Zielstandard:** WCAG 2.1 Level AA für alle öffentlich zugänglichen Ansichten.

- **Story 6.6 (UX-Testreihen nach „Thinking Aloud“ & Umsetzung der Befunde):** 🟡 Als Produktteam möchten wir die App in **strukturierten Nutzertestreihen** mit der Methode **Thinking Aloud** beobachten und die dabei gewonnenen **UI/UX-Erkenntnisse** priorisiert **in der Implementierung nachziehen**, damit reale Verständnis- und Bedienprobleme sichtbar werden und nicht nur intern vermutet werden.

  **Methode „Thinking Aloud“ (Kurzbeschreibung für die Durchführung):**
  - **Grundidee:** Testpersonen bearbeiten **realistische Aufgaben** (z. B. Session beitreten, abstimmen, Quiz anlegen) und **sprechen dabei laut** über das, was sie denken, erwarten, nicht verstehen oder sie irritiert. Es geht nicht um eine Bewertung der Person, sondern um **Sichtbarkeit des mentalen Modells** und von **Reibung** in der Oberfläche.
  - **Ablauf:** Moderation mit **Aufgabenliste** (Tasks) und neutralen Nachfragen („Was erwarten Sie jetzt?“); keine Lösung vorgeben. Sitzungen werden **protokolliert** (Notizen; optional Aufzeichnung nur mit **Einwilligung** und DSGVO-konformer Vereinbarung).
  - **Auswertung:** Beobachter bündeln Beobachtungen zu **Themen** (Wording, Informationsarchitektur, fehlendes Feedback, Touch-Ziele, …), bewerten **Dringlichkeit** und leiten **konkrete Änderungsvorschläge** ab (Must/Should/Could). Typischerweise **kleine Stichprobe** (formative UX-Qualität, kein Ersatz für großflächige quantitative Studien).
  - **Abgrenzung:** Ergänzt, ersetzt nicht **Story 6.5** (systematische Barrierefreiheit/WCAG); beide können sich überschneiden (z. B. wenn Tester:innen auf Kontrast oder Fokus stoßen).

  - **Akzeptanzkriterien:**
    - Es liegt ein **schriftlicher Testplan** vor: Zielgruppe (mindestens Rollen **Lehrperson/Host** und **Teilnehmende**), **Geräte** (mindestens ein Smartphone-Viewport gemäß Mobile-First), **Kernflows** (z. B. Startseite → Session-Code, Join, typische Vote-/Host-Schritte, mindestens ein Quiz-Pfad), Aufgabenformulierung und Erfolgskriterien pro Task.
    - Es wird mindestens **eine Testreihe** durchgeführt mit **mindestens drei** unterschiedlichen Testpersonen (oder gleichwertig dokumentierte mehrere Termine), Methode und Rahmen sind den Teilnehmenden vorher erklärt.
    - Aus jeder Sitzung entsteht ein **kurzes Protokoll** (Problemstelle, Zitat oder Paraphrase, Schweregrad); daraus wird ein **Auswertungsdokument** mit **priorisierter Maßnahmenliste** (Umsetzungsempfehlungen inkl. betroffene Bereiche/Dateien wo möglich).
    - Für **jede Maßnahme** aus der priorisierten Liste wird entschieden und nachverfolgt: **umgesetzt** (PR/Commit referenziert), **zurückgestellt** mit Begründung, oder **bewusst abgelehnt** mit Begründung — sodass keine „toten“ Befunde ohne Status bleiben.
    - **Umsetzung:** Die als **Should/Must für die Reihe** markierten UX-Anpassungen werden **im Code umgesetzt** (Wording gemäß ADR-0008 in allen Locales, Layout/Interaktion gemäß ADR-0005/ADR-0014 wo betroffen); nachvollziehbar z. B. über Verweis von Maßnahmenliste auf PRs oder kurze Changelog-Notiz im Repo/`docs/`.
    - Optional aber wünschenswert: **kurze Lessons Learned** (1 Seite) für künftige Testrunden.

- **Story 6.7 (Startseite: Hero-Chips & Kanal-Einstiege zuverlässig):** 🟢

  **Kurz (User Story):** Als Veranstaltende\*r nutze ich die **Hero-Chips** auf der Startseite, lande nach dem Start **zuverlässig** im richtigen Host-Kanal und kann die laufende Session **ohne inkonsistentes Verhalten** beenden oder zur App zurückkehren — **unabhängig vom aktiven Kanal** (Quiz, Q&A, Blitzlicht).

  **Hero-Chips — kanonisches Wording, Reihenfolge und Navigationsziele (festgelegt, in die Implementierung zu übernehmen):**

  | Reihenfolge | Navigationsziel                                                             | DE                     | EN                    | FR                          | IT                        | ES                       |
  | ----------- | --------------------------------------------------------------------------- | ---------------------- | --------------------- | --------------------------- | ------------------------- | ------------------------ |
  | 1           | **Quiz-Bibliothek** (Quiz-Liste / `quiz`-Route gemäß Router)                | **Quiz starten**       | **Start quiz**        | **Lancer le quiz**          | **Avvia quiz**            | **Iniciar quiz**         |
  | 2           | **Host-Route**, aktiver **Q&A-Kanaltab** (`tab=qa` o. ä.)                   | **Q&A öffnen**         | **Open Q&A**          | **Ouvrir le Q&A**           | **Apri Q&A**              | **Abrir Q&A**            |
  | 3           | **Host-Route**, aktiver **Blitzlicht-Kanaltab** (`tab=quickFeedback` o. ä.) | **Blitzlicht starten** | **Start pulse check** | **Lancer le sondage flash** | **Avvia sondaggio flash** | **Iniciar sondeo flash** |
  - **Reihenfolge auf der Startseite:** immer **1 → 2 → 3** wie in der Tabelle (oben nach unten bzw. links nach rechts — konsistent mit dem Hero-Layout).
  - **i18n (ADR-0008):** Chip-Labels **verbindlich** wie in der Tabelle für **`de` · `en` · `fr` · `it` · `es`**; stabile `i18n`-IDs (`@@…`) wo sinnvoll.

  **Zielbild für die Implementierung (MUSS):**
  1. **Hero-Chips:** Die **drei** Chips entsprechen **exakt** der Tabelle oben (Wording, Reihenfolge, Ziel). Jeder Chip führt **deterministisch** zum dokumentierten Ziel (Quiz-Bibliothek bzw. `session/:code/host` mit `tab=qa` / `tab=quickFeedback`). Kein „still hängenbleiben“ oder falscher Tab nach dem Sprung von der Startseite.
  2. **Zwei getrennte UX-Pfade zum Verlassen / Beenden** (beide bei **aktiver** Session mit **gleicher** Sicherheitslogik):
     - **Pfad A – Shell-Navigation:** Klicks auf Links in **`app-top-toolbar`** (z. B. Brand „arsnova.eu“, **Home-Icon**, andere App-Routen), die **weg von der Host-Route** navigieren → **dieselbe** Bestätigungslogik wie heute bei `canDeactivate` (Konsequenzen klar, Abbruch möglich). _Technisch: bestehender Router-Guard auf der Host-Route._
     - **Pfad B – Explizites Session-Ende:** Sichtbarer, beschrifteter **„Session beenden“**-Einstieg **im Host-Layout** mit **fester, UX-optimierter und kanalübergreifend identischer Platzierung:** die Aktion sitzt an **einem** von **`SessionHostComponent`** vorgegebenen **Anker** (z. B. gemeinsame Host-Steuerleiste / fester Bereich unmittelbar am Kanal-Tab-Bereich — im Code festgelegt, nicht pro Kanal neu erfunden). Beim Wechsel zwischen Quiz-, Q&A- und Blitzlicht-Tab bleibt der Einstieg **an derselben Stelle im Viewport** (kein Verschieben in unterschiedliche Bereiche der eingebetteten Kanal-Views). **Gleiche** Bestätigungsdialog-Komponente / **gleiches** Datenmodell für Konsequenzen wie Pfad A (kein separates „Mini-Ende“ per Snackbar ohne Dialog, wenn die Session noch aktiv ist).
  3. **Platzierung „Session beenden“ (Pfad B):** Der **beschriftete** Button/Aktion „Session beenden“ (oder lokalisiertes Äquivalent) steht **nicht** in **`app-top-toolbar`** und **nicht** ausschließlich in Footer/Global-Chrome, sondern **im Host-Layout** unterhalb der App-Shell-Leiste, **immer am gleichen UI-Anker** (s. Zielbild 2, Pfad B), damit er in **Browser-Vollbild** und bei **ausgeblendeter Top-Toolbar** (Scroll-Verhalten `app.component`) **weiterhin sichtbar, auffindbar und bedienbar** bleibt und Nutzer:innen die Aktion **nicht suchen** müssen, wenn sie den Kanal wechseln.
  4. **Kanalgleichheit:** Verhalten nach Bestätigung (tRPC `session.end`, Token-Cleanup, Navigation) ist für alle Kanäle **funktional identisch**; keine Sonderfälle, bei denen z. B. nur Q&A zuverlässig endet und Blitzlicht nicht.
  5. **Layout-Host:** Erkennung „Host-Route“ / volle Host-Breite darf **nicht** von `router.url.endsWith('/host')` ohne Strippen von `?tab=…` abhängen (bekanntes Anti-Pattern: Query bricht `endsWith('/host')`).
  6. **Bereinigung redundanter Session-Exits:** Bestehende **weitere** UI-Einstiege, die dieselbe **komplette Host-Session** beenden (serverseitig i. d. R. `session.end` + gleichwertiges Token-Cleanup wie Pfad A/B), sind **zu entfernen** oder **strikt auf** die gemeinsame Bestätigungslogik (Pfad A oder B) **umzuleiten**. Es gibt **genau zwei** bewusste Muster: **Pfad A** (Shell-Navigation mit `canDeactivate`) und **Pfad B** (beschrifteter Kanal-Button im Host-Layout). _Ausnahme nur_, wenn eine Aktion **sachlich** etwas anderes beendet (z. B. nur Blitzlicht-Runde / `quickFeedback.end` ohne gesamte Session) — dann **anderes Label**, kein zweites „Session beenden“ für dasselbe Ereignis.

  **Explizite Verbote (DARF NICHT):**
  - Den **einzigen** oder **primären** „Session beenden“-Einstieg **nur** in die Toolbar legen.
  - **Unterschiedliche** Bestätigungs-UX für „Toolbar weg navigieren“ vs. „Kanal-Button Session beenden“ (wenn beide dieselbe serverseitige Aktion auslösen) — gleiche Dialogbasis, angepasste Texte nur wo sachlich nötig.
  - Kanalspezifische **zweite** vollständige Session-Ende-Buttons, die sich **widersprüchlich** verhalten (z. B. einer Dialog, anderer nur Snackbar).
  - **Mehrfache gleichwertige Session-Exits:** Es dürfen **keine** zusätzlichen Buttons/Snackbars/versteckten Einstiege existieren, die **dieselbe** „komplette Session beenden“-Wirkung wie Pfad A/B auslösen — diese **Alt-UI** ist zu **entfernen** oder auf den **gemeinsamen** Dialog/Flow zu **konsolidieren**.
  - **Springender oder kanalabhängiger Ort für Pfad B:** „Session beenden“ darf **nicht** je nach aktivem Kanal an **unterschiedlichen** Stellen (z. B. nur unten in der Blitzlicht-Karte, links in Q&A) erscheinen — **ein** Anker, **eine** Position.

  **Akzeptanzkriterien (abnahmefähig):**
  - [x] Start über **jeden der drei Hero-Chips** (s. Tabelle; Labels in allen Locales **de/en/fr/it/es**) landet reproduzierbar im **richtigen Ziel** (Quiz-Bibliothek bzw. Host-Tab Q&A / Blitzlicht) (manuell + ggf. Smoke).
  - [x] **Pfad A:** Navigation von `/session/…/host` zur Startseite über **Top-Toolbar** (Home/Brand) zeigt bei aktiver Session den **Bestätigungsdialog** und endet die Session nach Zustimmung konsistent.
  - [x] **Pfad B:** Button **„Session beenden“** ist **immer am gleichen Host-Anker** platziert (sichtbar beim Wechsel **aller** relevanter Kanal-Tabs: Quiz, Q&A, Blitzlicht), **nicht** in `app-top-toolbar`, mit **demselben** Bestätigungsmuster wie Pfad A (inhaltlich vergleichbare Konsequenzen); **kein** Ortswechsel des Buttons nur durch Kanalwechsel.
  - [x] **Vollbild** + **Toolbar eingeklappt/ausgeblendet:** Pfad B bleibt nutzbar; Session-Ende ist **ohne** sichtbare Toolbar möglich.
  - [x] Nach Ende: **Host-Token** und **Feedback-Host-Token** (falls gesetzt) sind clientseitig konsistent entfernt; keine Zombie-Requests.
  - [x] **i18n (ADR-0008):** Chip-Labels **exakt** wie in der Tabelle für alle fünf Locales; XLF/`messages.*.xlf` synchron.
  - [x] **Keine redundanten Session-Exits:** Code-Review / kurzes UI-Audit: **keine** weiteren sichtbaren Einstiege „Session beenden“ (oder unterschiedlich benannt, **gleiche** Wirkung) außer **Pfad A** (Toolbar-Navigation mit Guard) und **Pfad B** (Host-Kanal-Button); alte Duplikate sind entfernt oder auf den gemeinsamen Dialog refaktoriert.

  **Verifizierung (April 2026):**
  - Frontend-Specs (u. a. `home.component.spec.ts`, `session-host.component.spec.ts`) für Hero-Chip-/Host-Ende-Flows grün.
  - Kanalübergreifender End-Flow (Quiz/Q&A/Blitzlicht), Token-Cleanup und Host-Route-Erkennung gegen Query-Parameter umgesetzt.
  - Build-Check: `npm run -w apps/frontend build` erfolgreich.

  **Anker im Repo (Orientierung für Agent:innen, nicht abschließend):** `apps/frontend/src/app/features/home/home.component.ts` (Hero-Chips / Navigation zum Host), `apps/frontend/src/app/app.routes.ts` (`canDeactivate` Host-Route), `apps/frontend/src/app/features/session/session-host/session-host.component.ts` + Template, `apps/frontend/src/app/features/session/session.component.ts` (Host-Layout-Erkennung vs. Query), `apps/frontend/src/app/shared/confirm-leave-dialog/`, `apps/frontend/src/app/shared/top-toolbar/`, eingebettetes `FeedbackHostComponent` bei Blitzlicht, `docs/ui/STYLEGUIDE.md`, ADR-0008.

  **Empfohlene Umsetzungsreihenfolge (Agent):** (1) Layout/Host-Route-Fixes ohne Feature-Regression → (2) Inventar: alle aktuellen Session-Exit-UI (Toolbar, Host, `FeedbackHostComponent` eingebettet, Snackbars, …) → (3) Duplikate entfernen/vereinheitlichen → (4) gemeinsame Hilfsfunktion / gemeinsamer Dialog für „Session wirklich beenden“ aus Toolbar- und Kanal-Trigger → (5) sichtbare Kanal-Buttons + Tests → (6) i18n alle Locales → (7) manuelle Testmatrix unten.

  **Nicht-Ziele:** Inhaltliche Änderung von Quiz-Fragen; neue Live-Kanäle außerhalb der bestehenden Session-Architektur; reine REST-APIs (nur tRPC laut Monorepo-Regeln).

  **Definition of Done (Story-spezifisch):** Unit-/Component-Tests für geänderte Host-/Home-Logik grün; manuelle Matrix mindestens: **alle drei Hero-Chips** (Quiz-Bibliothek, Q&A-Tab, Blitzlicht-Tab) × (Pfad A Toolbar, Pfad B am **festen Host-Anker**) × (normale Ansicht, Vollbild oder Toolbar aus); beim Tab-Wechsel **Quiz ↔ Q&A ↔ Blitzlicht** prüfen: **Pfad B** bleibt **ortsgleich**; sekundäre Navigation (z. B. Hilfe) nach bestätigtem Verlassen ohne Fehlzustand; `npm run build` Frontend ohne Fehler.

---

## Epic 7: Team-Modus (Rolle: Lehrperson & Teilnehmende:r) ✅ abgeschlossen

- **Story 7.1 (Team-Modus):** 🟢 Als Lehrperson möchte ich optional einen Team-Modus aktivieren können, bei dem Teilnehmende in Gruppen gegeneinander antreten.
  - **Akzeptanzkriterien:**
    - In der Quiz-Konfiguration (Story 1.4) gibt es ein neues Feld `teamMode` (default: aus).
    - Wenn aktiviert, definiert die Lehrperson die Anzahl der Teams (2–8) und optional Team-Namen (default: „Team A“, „Team B“, …).
    - Beim Beitreten (Story 3.1) wird jede teilnehmende Person automatisch einem Team zugewiesen (Round-Robin) oder wählt ein Team aus einer Liste (konfigurierbar via `teamAssignment: 'AUTO' | 'MANUAL'`).
    - **Team-Leaderboard:** Neben dem individuellen Leaderboard (Story 4.1) wird ein Team-Leaderboard angezeigt — Gesamtpunkte des Teams = Summe aller Mitglieder-Scores.
    - Auf der Beamer-Ansicht werden Teams mit farbigen Bannern und kumulierten Balkendiagrammen dargestellt.
    - Team-Belohnungseffekte (Story 5.4): Das Gewinnerteam erhält eine kollektive Konfetti-Animation.
    - Prisma-Modell `Team` verknüpft `Session` ↔ `Participant` (n:m via Team).
    - DSGVO: Team-Zugehörigkeit wird nur temporär für die Session vorgehalten (wie alle Session-Daten).
  - **Aktueller Implementierungsstand (März 2026):**
    - `shared-types`, Prisma und Backend-Router tragen `teamMode`, `teamCount`, `teamAssignment` und konfigurierbare `teamNames` Ende-zu-Ende.
    - Beim Session-Start werden Teams serverseitig initialisiert; eigene Team-Namen werden übernommen, fehlende Namen fallen auf `Team A`, `Team B`, … zurück.
    - `join/:code` nutzt im **MANUAL**-Modus jetzt ein eindeutiges Kartenmuster statt doppelter Auswahl; im **AUTO**-Modus bleibt die Teamvorschau sichtbar und hebt ein wahrscheinliches Zielteam als kleinen Orientierungsmoment hervor.
    - Die Join-Ansicht zeigt Teamfarben, Mitgliederzahl, klaren Auswahlzustand und im Preset `PLAYFUL` einen kleinen spielerischen Bestätigungs-/Motivationsmoment.
    - Die Host-Lobby gruppiert Teilnehmende nach Teams, priorisiert die Teamkarten jetzt visuell vor QR/Join-Link und zeigt den Zugang zur Session als sekundären Block darunter; die Abschlussansicht zeigt zusätzlich ein Team-Leaderboard mit farbigen Balken.
    - Für Quiz New/Edit gibt es konfigurierbare Team-Namen inkl. Live-Vorschau der effektiv entstehenden Teams sowie Validierung gegen Duplikate, Überlänge und zu viele Einträge.
    - `session/:code/present` inszeniert das Team-Finale jetzt fokussiert als Siegerkarte plus kompaktes Team-Balkenboard; laufzeitfremde Word-Cloud-/Placeholder-Inhalte bleiben im Abschlusszustand ausgeblendet.
    - `session/:code/vote` zeigt in `RESULTS` und `FINISHED` einen kollektiven Team-Moment mit eigener Teamkarte, Teamrang, Team-Punkten und kompakter Team-Topliste.
  - **Verifizierung bisher:**
    - Backend: Team-Initialisierung, Auto-/Manual-Join und Team-Leaderboard sind durch Unit-Tests abgedeckt.
    - Frontend: Join-, Quiz-, Host-, Present- und Vote-Specs decken Teamwahl, Teamvorschau, Lobby/Leaderboard, Beamer-Finale und kollektive Belohnungen für Teilnehmende ab.
    - Lokalisierung: Alle neuen Teammodus-Texte sind in `de`, `en`, `fr`, `es`, `it` nachgezogen; `extract-i18n` und `build:localize` laufen erfolgreich.
    - Laufzeit-Review: Echte Multi-Client-Captures aus dem lokalisierten Build wurden nach dem UX-Feinschliff erneuert (`runtime-02-join-manual.png`, `runtime-03-host-lobby-fixed.png`, `runtime-05-join-auto.png`, `runtime-06-present-finale.png`); der frühere Lobby-Befund bleibt als Vergleich in `runtime-03-host-lobby.png` erhalten.
  - **Abschluss / DoD:**
    - Story-Abnahme erfolgt, Teammodus-Dokumentation final integriert.
    - Status auf `✅ Fertig` gesetzt.

---

## Epic 8: Q&A-Modus (Rolle: Lehrperson & Teilnehmende:r)

> **Verifizierung Epic 8 (2026-03-13):** Der bisherige Kernumfang 8.1–8.4 ist umgesetzt. Offen: Story 8.5 (delegierbare Moderation), Story 8.6 (Kontroversitäts-Score), Story 8.7 („Beste Fragen“, Wilson-Score) — Spezifikation und Hintergrund [`docs/features/controversy-score.md`](docs/features/controversy-score.md).  
> Backend-Checks: `npm run test -w @arsnova/backend -- qa session.start-qa` ✅.  
> Frontend-Checks: Spec-Abdeckung für Host-, Vote-, Present- und eingebettete Blitz-Feedback-Flows vorhanden ✅.  
> Laufzeit-Review: `BASE_URL=http://localhost:4200 npm run smoke:unified-session -w @arsnova/frontend` ✅, inklusive automatischem Fallback auf bestehende Unified-Session bei Session-Rate-Limit.

- **Story 8.1 (Q&A-Session starten):** 🟢 Als Lehrperson möchte ich eine Q&A-Session starten können, in der Teilnehmende Fragen stellen und die besten Fragen hochvoten können — als interaktive Alternative zur klassischen Fragenrunde.
  - **Akzeptanzkriterien:**
    - Q&A wird gemäß ADR-0009 als Live-Kanal innerhalb derselben Veranstaltung gestartet; Quiz, Fragen und Blitz-Feedback teilen sich einen Session-Code.
    - Die Lehrperson kann beim Live-Schalten festlegen, mit welchem Kanal die Session startet, und Q&A zusätzlich aktivieren.
    - Die Lehrperson legt optional einen Titel oder ein Thema für den Q&A-Kanal fest.
    - Teilnehmende treten einmal über denselben Session-Code bei (Story 3.1) und wechseln anschließend in derselben Session-Shell zwischen den Kanälen.
    - Prisma/DTOs modellieren Q&A als Session-Funktion (`qaEnabled`, `qaTitle`, `qaModerationMode`) im bestehenden Session-Modell.
- **Story 8.2 (Fragen einreichen):** 🟢 Als Teilnehmende:r möchte ich eine Frage an die Lehrperson einreichen können.
  - **Akzeptanzkriterien:**
    - Eingabefeld für Freitext (max. 500 Zeichen) + „Absenden"-Button.
    - Fragen werden anonym eingereicht (kein Nickname sichtbar) — konsistent mit dem seriösen Modus (Story 3.6).
    - Markdown wird in Fragen unterstützt (Story 1.7).
    - Maximal 3 Fragen pro teilnehmender Person pro Session (Spam-Schutz).
    - Fragen erscheinen sofort im Teilnehmenden-Tab und in der Host-Moderation; freigegebene bzw. hervorgehobene Fragen sind auf der Presenter-Ansicht sichtbar.
- **Story 8.3 (Upvoting & Sortierung):** 🟢 Als Teilnehmende:r möchte ich die Fragen anderer Teilnehmender upvoten können, damit die relevantesten Fragen nach oben wandern.
  - **Akzeptanzkriterien:**
    - Jede Frage hat einen Upvote-Button (👍 / ▲) mit aktueller Stimmenanzahl.
    - Maximal 1 Upvote pro teilnehmender Person pro Frage (Toggle: erneuter Tap entfernt den Upvote).
    - Fragen werden in Echtzeit nach Upvote-Anzahl sortiert (höchste zuerst).
    - tRPC-Subscription `qa.onQuestionsUpdated` pusht die aktuelle Fragenliste.
    - Prisma: Neues Modell `QaUpvote` mit `@@unique([qaQuestionId, participantId])` für Upvote-Toggle.
- **Story 8.4 (Moderation durch Lehrende):** 🟢 Als Lehrperson möchte ich eingereichte Fragen moderieren können.
  - **Akzeptanzkriterien:**
    - Die Lehrperson kann Fragen:
      - **Hervorheben** (Pin) — fixiert die Frage oben auf der Beamer-Ansicht als „Wird gerade beantwortet".
      - **Archivieren** — entfernt die Frage aus der aktiven Liste (als „Beantwortet" markiert).
      - **Löschen** — entfernt unangemessene Fragen (nur für die Lehrperson sichtbar).
    - Optional: Vorab-Moderation — Fragen erscheinen erst nach Freigabe durch die Lehrperson (`moderationMode: boolean`, default: aus).
    - Host- und Presenter-Ansicht zeigen neue Fragen bzw. aktive Warteschlangen sichtbar an (Badge/Highlight/Queue), ohne die Session-Shell zu verlassen.
    - Prisma: Neues Modell `QaQuestion` mit Feldern `id`, `sessionId`, `participantId` (Autor, für 3-Fragen-Limit), `text`, `upvoteCount`, `status` (PENDING/ACTIVE/PINNED/ARCHIVED/DELETED), `createdAt`.
- **Story 8.5 (Delegierbare Q&A-Moderation für Tutor:innen):** 🟡 Als Lehrperson möchte ich Q&A-Moderation an Tutor:innen delegieren können, damit eine zweite Person eingehende Fragen parallel sichten und freigeben kann, ohne Vollzugriff auf die Veranstaltung zu erhalten.
  - **Akzeptanzkriterien:**
    - Aus der laufenden Session kann ein **Moderator-Link** oder **Moderator-Token** erzeugt werden.
    - Moderator:innen dürfen Q&A-Fragen listen, freigeben, pinnen, archivieren und löschen, aber **keine** Quiz-Steuerung, keine Blitzlicht-Steuerung und kein Session-Ende auslösen.
    - Moderatorrechte sind **kanalgebunden** auf Q&A und gelten nicht automatisch für Presenter- oder Host-Funktionen.
    - Der Moderatorzugang ist widerrufbar oder neu generierbar, falls ein Link versehentlich weitergegeben wurde.
    - Die UI macht klar unterscheidbar, ob ein Gerät als **Host**, **Presenter** oder **Moderator:in** verbunden ist.
    - Sicherheits- und Integrationstests decken unzulässige Rolleneskalation ausdrücklich ab.
- **Story 8.6 (Q&A: Kontroversitäts-Score & Sortierung):** 🟡 Als Lehrperson oder Moderator:in einer Live-Veranstaltung möchte ich Fragen im Q&A nach Kontroversität (ausgeglichene Up- und Downvotes) sortieren können, damit polarisierende Themen sichtbar werden und nicht nur durch hohe Upvote-Zahlen dominieren.
  - **Details:** Formel, Sortier-Tie-Breaker, UI-Schwellen, Testfälle und Beispiel-SQL: [`docs/features/controversy-score.md`](docs/features/controversy-score.md).
- **Story 8.7 (Q&A: Sortierung „Beste Fragen“, Wilson-Score):** 🟡 Als Lehrperson oder Moderator:in einer Live-Veranstaltung möchte ich Fragen im Q&A optional nach statistisch belastbarer Zustimmung sortieren können („Beste Fragen“, untere Grenze des Wilson-Konfidenzintervalls), damit Einzelstimmen mit scheinbar 100 % nicht über Fragen mit vielen, fast einhelligen Stimmen rutschen.
  - **Details:** Hintergrund, Wilson-Formel, Beispiel-SQL und Abgrenzung zu Story 8.6: [`docs/features/controversy-score.md`](docs/features/controversy-score.md) (Abschnitte „Best Questions“ / Wilson und Entwicklernotizen).
  - **Hinweis:** Sortier-UI (Dropdown o. Ä.) kann mit Story 8.6 gemeinsam geplant werden; technisch eigenständiges Scoring und Tests.

---

## Epic 9: Admin (Rechtliche & operative Kontrolle)

> **Rolle:** Admin/Betreiber (z. B. Plattform-Betreiber, Support, rechtliche Verantwortliche).  
> **Hintergrund:** Die App ist accountfrei für Lehrende und Teilnehmende. Auf dem Server liegen jedoch alle **live geschalteten** Sessions inkl. der beim Start hochgeladenen Quiz-Daten (Story 2.1a). Für Meldungen strafrechtlich relevanter Quiz-Inhalte, behördliche Anfragen (z. B. Staatsanwaltschaft) oder Löschpflichten braucht es eine **Admin-Rolle** mit strikter Autorisierung und Nachvollziehbarkeit.
>
> **Status:** ✅ Abgeschlossen (Stories 9.1, 9.2, 9.3 umgesetzt)

### Admin-Credentials: Wie kommt der Admin an seinen Zugang?

- **Vergabe:** Die Credentials werden **vom Betreiber der Plattform** (z. B. IT, Verantwortliche:r für den Betrieb) bereitgestellt — nicht von der App selbst. Es gibt keine Selbstregistrierung für Admins.
- **Technik (aktueller Stand):** Ein **geheimer Admin-Schlüssel** (API-Key/Passphrase) wird in der **Server-Umgebung** konfiguriert (z. B. Umgebungsvariable `ADMIN_SECRET` oder `ADMIN_API_KEYS`). Der Betreiber legt diesen Wert beim Deployment fest und teilt ihn **außerhalb der App** nur den berechtigten Admins mit (z. B. über sicheren Kanal, Passwortmanager, interne Dokumentation).
- **Ablauf für den Admin:** Beim Aufruf von `/admin` erscheint eine **Login-Seite** (kein öffentliches Dashboard). Der Admin gibt den ihm mitgeteilten **Admin-Schlüssel** ein. Das Frontend sendet ihn an das Backend (z. B. tRPC `admin.login` oder `admin.verifySecret`); das Backend vergleicht mit dem konfigurierten Wert. Bei Übereinstimmung erhält der Admin ein **Session-Token** (z. B. kurzlebiges JWT oder opaker Token in Redis mit TTL), das im Frontend (z. B. sessionStorage) gespeichert und bei jedem Admin-tRPC-Aufruf mitgeschickt wird. So ist der Admin „eingeloggt“, ohne dass die App ein eigenes Benutzerkonto für ihn anlegt.
- **Zusammenfassung:** Der Admin bekommt seine Credentials **vom Betreiber** (out-of-band). Technisch reicht ein gemeinsamer geheimer Schlüssel in der Server-Config; keine Datenbank für Admin-Benutzer nötig. Optional später: mehrere Schlüssel oder einfache Admin-Tabelle (Name, Hash des Passworts) für bessere Nachvollziehbarkeit im Audit-Log.

### Admin-Recherchefenster (verbindlich)

- **Fenster A – Laufende Session (`status != FINISHED`):**
  - **Recherchierbar:** Session-Metadaten, Session-Quiz-Kopie (Fragen/Antworten), Q&A-Inhalte, aggregierte Ergebnisdaten.
- **Fenster B – Nachlauf (`status = FINISHED` bis `endedAt + 24h`):**
  - **Recherchierbar:** wie Fenster A, um Meldungen/Nachfragen kurzzeitig bearbeiten und Exporte erstellen zu können.
- **Fenster C – Purged (ab `endedAt + 24h`, technisch spätestens nach Cleanup-Lauf):**
  - **Nicht mehr recherchierbar:** Session-Inhalte, Quiz-Kopie, Q&A, Votes, Participants, BonusTokens.
  - **Weiter recherchierbar:** nur Admin-Audit-Metadaten (wer, wann, welche Aktion, welche Session-ID/-Code, optional Grund) ohne Inhaltsdump.
- **PII-Regel über alle Fenster:** Nicknames, IP-Adressen und andere personenbezogene Daten sind **standardmäßig nicht Teil** von Admin-Ansicht/Export; nur bei expliziter Rechtsgrundlage in einem separaten, dokumentierten Sonderprozess.

- **Story 9.1 (Admin: Sessions & Quiz-Inhalte inspizieren):** ✅ Als Admin möchte ich alle auf dem Server gespeicherten Sessions einsehen und die zugehörigen Quiz-Inhalte (Fragen, Antworten, Metadaten) sowie den Session-Verlauf (Zahl der Teilnehmenden, Status, Zeitraum) inspizieren können, damit ich bei Meldungen oder Anfragen den Kontext prüfen kann.
  - **Akzeptanzkriterien:**
    - **Admin-Autorisierung:** Zugriff nur mit gültiger Admin-Authentifizierung (z. B. Admin-Token/API-Key aus Umgebung oder separates Admin-Login). Die Admin-Rolle wird **nicht** durch die URL verliehen — wer `/admin` aufruft ohne gültige Admin-Credentials, erhält „Zugriff verweigert“; alle Admin-tRPC-Prozeduren prüfen die Admin-Berechtigung serverseitig.
    - **Code-Eingabe (Session-Lookup):** Im Admin-Bereich (Panel/Dashboard) gibt es eine **Eingabe für den 6-stelligen Session-Code**. Der Admin kann den Code (z. B. aus einer Meldung oder behördlichen Anfrage) eingeben und damit direkt die zugehörigen Session- und Quiz-Daten abrufen. Bei gültigem Code wird die Session-Detail-Ansicht inkl. Quiz-Inhalt angezeigt; bei ungültigem/abgelaufenem Code eine klare Fehlermeldung. Technisch: tRPC `admin.getSessionByCode({ code })` oder Nutzung von `getSessionDetail` mit Code; UI: z. B. prominentes Suchfeld/Code-Eingabe oben im Dashboard.
    - **Session-Liste:** Admin kann eine paginierte/filterbare Liste aller Sessions abrufen (tRPC `admin.listSessions`): Session-Code, Status, Quiz-Name (falls vorhanden), Typ (QUIZ/Q_AND_A), Zeitraum (`startedAt`, `endedAt`), Zahl der Teilnehmenden. Filter optional: Status, Zeitraum, Code.
    - **Session-Detail:** Admin kann zu einer Session die vollständigen Metadaten sowie das bei Session-Start hochgeladene Quiz (Fragen, Antwortoptionen inkl. `isCorrect`) einsehen (read-only). Keine Änderung über diese Ansicht. Erreichbar sowohl über die Code-Eingabe als auch über Klick auf einen Eintrag in der Session-Liste.
    - **Zeitfenster-Grenze:** Session-Liste und Session-Detail zeigen nur Sessions in **Fenster A/B** (laufend oder bis max. 24h nach `endedAt`). Für **Fenster C** wird eine klare Meldung gezeigt (z. B. „Sessiondaten wurden gemäß Aufbewahrungsregel bereinigt.“).
    - **Route:** Eigene Route `/admin` (oder `/admin/sessions`) — nur erreichbar, wenn Admin authentifiziert ist. **Absicherung:** Frontend Route Guard prüft Admin-Session-Token (fehlt/ungültig → Login anzeigen oder Redirect); Backend: jede Admin-Prozedur prüft Token (z. B. zentrale `adminProcedure`-Middleware), sonst `UNAUTHORIZED`. Details: `docs/ROUTES_AND_STORIES.md` Abschnitt „Absicherung der Admin-Route“.
    - **Datenschutz:** Zugriff nur für berechtigte Admins; Zugriffe können für ein Audit-Log protokolliert werden (siehe Story 9.2).
  - **Abhängigkeiten:** Session- und Quiz-Daten liegen beim Live-Schalten bereits auf dem Server (Story 2.1a). Kein neues Datenmodell nötig; ggf. neuer tRPC-Router `admin` mit gesicherten Procedures.

- **Story 9.2 (Admin: Session/Quiz löschen – rechtlich):** ✅ Als Admin möchte ich eine Session inkl. der zugehörigen Quiz-Kopie und aller Abstimmungsdaten (Votes, Participants, BonusTokens etc.) endgültig löschen können, wenn dies aus rechtlichen Gründen erforderlich ist (z. B. strafrechtlich relevanter Inhalt, Löschauflage).
  - **Akzeptanzkriterien:**
    - **Admin-only:** Nur mit gültiger Admin-Authentifizierung (wie Story 9.1). Löschen ist eine explizite Aktion (Button „Session endgültig löschen“) mit Bestätigungsdialog und optionaler Pflichtangabe eines Löschgrunds (Freitext oder Kategorie).
    - **Vollständige Löschung:** Die Mutation `admin.deleteSession` (oder vergleichbar) löscht die Session und kaskadiert alle zugehörigen Daten (Participants, Votes, BonusTokens, QaQuestions etc.). Die beim Session-Start hochgeladene Quiz-Kopie (Quiz, Questions, AnswerOptions) wird mitgelöscht, sofern sie nur zu dieser Session gehört (oder explizit „Session-Quiz-Kopie“); Quizzes, die von mehreren Sessions referenziert werden können, sind im aktuellen Modell pro Session eine Kopie (Quiz ist über Session.quizId verknüpft) — hier ist die Löschlogik an das Prisma-Schema anzupassen (Cascade oder explizites Löschen der Session-Quiz-Daten).
    - **Zeitfenster-Hinweis:** In **Fenster A/B** kann aktiv gelöscht werden; in **Fenster C** ist keine Löschung mehr nötig/möglich, weil Daten bereits durch Retention-Cleanup entfernt wurden.
    - **Audit-Log:** Jede Admin-Löschung wird protokolliert: Zeitpunkt, Session-Code/ID, durchführende Admin-Kennung (z. B. Admin-Token-ID oder „system“), optional Löschgrund. Speicherung in einer Tabelle `AdminAuditLog` oder vergleichbar (oder strukturierte Logs), Aufbewahrungsfrist gemäß rechtlichen Anforderungen.
    - **Keine Wiederherstellung:** Nach Löschung sind die Daten nicht wiederherstellbar; Hinweis in der UI.
  - **Abhängigkeiten:** Story 9.1 (Admin-Zugang, Session-Liste/Detail).

- **Story 9.3 (Admin: Auszug für Behörden/Staatsanwaltschaft):** ✅ Als Admin möchte ich zu einer Session einen vollständigen, maschinenlesbaren Auszug (z. B. JSON oder PDF) erzeugen können, der alle relevanten Inhalte (Quiz-Name, Fragen, Antwortoptionen, Session-Metadaten, Zahl der Teilnehmenden, ggf. aggregierte Abstimmungsergebnisse — **keine** personenbezogenen Daten wie Nicknames, sofern nicht rechtlich gefordert) enthält, damit ich Anfragen von Behörden oder Staatsanwaltschaft (z. B. bezichtigter Quiz-Inhalt) erfüllen kann.
  - **Akzeptanzkriterien:**
    - **Export-Funktion:** In der Admin-Session-Detail-Ansicht (Story 9.1) ein Button „Auszug für Behörden exportieren“. Erzeugt ein strukturiertes Exportpaket (z. B. JSON mit Schema-Version) mit: Session-ID, -Code, Status, Zeitraum, Quiz-Name, alle Fragen inkl. Text und Antwortoptionen (inkl. Kennzeichnung korrekt/falsch), Session-Typ, Zahl der Teilnehmenden, aggregierte Ergebnisdaten (wie in Story 4.7). Optional: zweites Format PDF für lesbare Übermittlung.
    - **Zeitfenster-Grenze:** Export ist nur in **Fenster A/B** verfügbar. In **Fenster C** ist kein Export mehr möglich; UI zeigt eindeutige Begründung („Daten bereits bereinigt“).
    - **DSGVO/Recht:** Der Export enthält bewusst **keine** Nicknames, IP-Adressen oder anderen personenbezogenen Daten, sofern nicht durch Rechtsgrund (z. B. Durchsuchungsbeschluss) explizit gefordert. Hinweis in der UI: „Nur für berechtigte Anfragen verwenden; Datensparsamkeit beachten.“
    - **Audit:** Export-Vorgänge können im gleichen Audit-Log wie Löschungen erfasst werden (wer, wann, welche Session).
  - **Abhängigkeiten:** Story 9.1 (Admin-Zugang, Session-Detail); inhaltlich an Story 4.7 (Export-Format) anknüpfbar.

---

## Epic 10: MOTD — Plattform-Kommunikation (Message of the Day)

> **Rolle:** Betreiber/Admin kommuniziert **mit allen Nutzer:innen** der App (ohne Session-Host-Rolle).  
> **Hintergrund:** Ankündigungen (Wartung, Features, Spenden u. a.) sollen **zur Laufzeit** steuerbar, **mehrsprachig**, **zeitfensterbasiert** und mit **Archiv** sowie **Nutzerinteraktionen** nutzbar sein — getrennt von Epic 9 (Session-Inspektion/Löschung/Behördenexport).
>
> **Architektur & Gesamtspezifikation:** [ADR-0018](docs/architecture/decisions/0018-message-of-the-day-platform-communication.md) · [docs/features/motd.md](docs/features/motd.md)
>
> **Status:** ✅ Fertig (Stories 10.1–10.8, Stand Produktcode)

### Implementierungsreihenfolge (empfohlen)

1. **10.1** — Fundament (Schema, keine API ohne Typen).
2. **10.2** — Öffentliches Lesen (Startseite/Archiv können Daten beziehen).
3. **10.3** — Admin-Schreiben (Betrieb kann Inhalte pflegen).
4. **10.4** — Admin-UI (Editor, Templates, Planung).
5. **10.5** — Sichtbarkeit auf der Startseite (Overlay, localStorage).
6. **10.6** — Interaktionen + optionale Aggregations-API.
7. **10.7** — Globales Archiv im Header + redaktionelle i18n-Pflege in der UI.
8. **10.8** — Querschnitt Qualität, Sicherheit, Nachvollziehbarkeit.

---

- **Story 10.1 (MOTD: Datenmodell, Migration, Zod/DTOs):** ✅ Als Entwickler:in möchte ich ein persistiertes Datenmodell für MOTDs und Vorlagen sowie Zod-Schemas und DTOs in `@arsnova/shared-types`, damit Backend und Frontend typisiert und migrationsfähig arbeiten können.
  - **Akzeptanzkriterien:**
    - Prisma-Modelle für **MOTD** und **Template** (inkl. mehrsprachige Inhaltsfelder oder normalisierte Locale-Zeilen), Indizes für Abfrage nach Zeitfenster und Priorität.
    - Zod-Input/Output-Schemas für alle späteren `motd.*`- und `admin.motd.*`-Prozeduren vorbereitet oder in dieser Story vollständig angelegt.
    - Keine sensiblen Admin-Metadaten in öffentlichen DTOs.
    - Migration ausführbar; keine Breaking Changes an bestehenden Epics ohne Absprache.
  - **Abhängigkeiten:** Keine fachliche Abhängigkeit zu anderen Epics; technisch ADR-0018.

- **Story 10.2 (MOTD: Öffentliche Read-API + Rate-Limiting):** ✅ Als Nutzer:in möchte ich die aktuelle MOTD und eine Archivliste **ohne Login** abrufen können, damit die Startseite und das Archiv funktionieren — ohne Überlastung durch Missbrauch.
  - **Akzeptanzkriterien:**
    - tRPC-Queries (z. B. `motd.getCurrent`, `motd.listArchive`) mit Locale-Parameter und Pagination für Archiv.
    - Auslieferung nur von **freigegebenen** Archiv-Einträgen; aktive MOTD nur innerhalb `startsAt`/`endsAt` und passendem Status.
    - **Konfliktregel** bei mehreren Kandidaten wie ADR-0018.
    - **Rate-Limiting** auf öffentlichen MOTD-Endpunkten dokumentiert und getestet.
  - **Abhängigkeiten:** 10.1.

- **Story 10.3 (MOTD: Admin tRPC — CRUD, Templates, Zeitsteuerung):** ✅ Als Admin möchte ich MOTDs und Vorlagen anlegen, bearbeiten, planen und archivieren können, damit die Plattform-Kommunikation vollständig serverseitig steuerbar ist.
  - **Akzeptanzkriterien:**
    - Alle Schreibzugriffe nur über **`adminProcedure`** (analog Epic 9).
    - Felder: Status (`draft`/`scheduled`/`published` o. ä.), `startsAt`/`endsAt` (UTC), `priority`, `visibleInArchive`, mehrsprachige Markdown-Inhalte, optionale Template-Referenz.
    - Berechnung/Aktualisierung von **`contentHash` oder `version`** für „erneute Anzeige bei Inhaltsänderung“.
    - Validierung: maximale Textlänge, erlaubter Markdown-Umfang (Schutz vor Abuse).
  - **Abhängigkeiten:** 10.1, 10.2 (Read kann zum Testen genutzt werden).

- **Story 10.4 (MOTD: Admin-UI — CMS-light, Markdown-Editor, Vorschau):** ✅ Als Admin möchte ich ein schlankes UI unter `/admin`, um MOTDs und Templates mit Markdown zu pflegen und eine **gerätebezogene Vorschau** zu sehen, damit ich Inhalte ohne Deploy veröffentlichen kann.
  - **Akzeptanzkriterien:**
    - Eingabe **pro Locale** (de/en/fr/es/it) mit klarer Fallback-Dokumentation in der UI.
    - Markdown-Editor im Umfang **minimalistisch** aber bedienbar; Vorschau entspricht **Endnutzer-Rendering** (soweit technisch identisch).
    - Alle **neuen UI-Strings** mit stabilen IDs nach ADR-0008 in **allen fünf Sprachen** (XLF).
    - Angular: Signals, Standalone, `@if`/`@for`; kein `BehaviorSubject` für UI-State.
  - **Abhängigkeiten:** 10.3.

- **Story 10.5 (MOTD: Startseiten-Overlay + localStorage):** ✅ Als Nutzer:in möchte ich eine aktive MOTD auf der **Startseite** in einem **mobile-first Overlay** sehen und sie schließen können, wobei mein Gerät merkt, welche Version ich schon gesehen habe — ohne Account.
  - **Akzeptanzkriterien:**
    - Overlay erscheint nur bei gültiger MOTD; **Schließen-Button**; optional **Swipe-to-dismiss** zusätzlich; Escape und fokussierbare Steuerung.
    - `localStorage`-Schema mit **MOTD-ID + Version/Hash**; Namespace versionierbar (`arsnova-motd-v1`).
    - `prefers-reduced-motion` beachten; Touch-Ziele ≥ 44 px.
    - Kein Layout-Bruch ab 320 px Breite.
  - **Abhängigkeiten:** 10.2.

- **Story 10.6 (MOTD: Interaktionen — Kenntnisnahme, Dismiss-Typen, Feedback, API):** ✅ Als Betreiber möchte ich optional **aggregierte Signale** (Zur-Kenntnis-genommen, Daumen, Dismiss-Art), damit wir Wirksamkeit messen können — ohne personenbezogene Tracking-Profile.
  - **Akzeptanzkriterien:**
    - UI: Button **„Zur Kenntnis genommen“** (o. ä., i18n), **Daumen hoch/runter** (optional einblendbar), Unterscheidung **Dismiss per Close vs. Swipe** wenn technisch sinnvoll (Events).
    - Optional: öffentliche **Mutation** `motd.recordInteraction` mit strengem Rate-Limit; nur Aggregation auf dem Server; **kein** Zuordnen zu Personen.
    - Clientseitige Duplikat-Vermeidung für Votes pro MOTD-Version (localStorage) dokumentiert.
    - Datenschutz: keine PII in Telemetrie; Hinweis in Feature-Doku bei Bedarf ergänzt.
  - **Abhängigkeiten:** 10.5, 10.2.

- **Story 10.7 (MOTD: Header-Icon, Archiv, Lazy Load):** ✅ Als Nutzer:in möchte ich über ein **Nachrichten-Icon** im App-Header vergangene, vom Betreiber **freigegebene** MOTDs nachlesen können — ohne die Startseite zu verlassen.
  - **Akzeptanzkriterien:**
    - Icon nur sinnvoll sichtbar (kein toter Button: ausblenden/deaktivieren wenn weder aktive MOTD noch Archiv-Einträge — gemäß Feature-Doku).
    - Archiv lädt Inhalte **lazy** beim Öffnen; Markdown-Rendering konsistent mit Overlay.
    - Mobile-first Sheet/Dialog; Tastatur und Screenreader nutzbar.
    - Vollständige **UI-i18n** (alle Locales).
  - **Abhängigkeiten:** 10.2, 10.5; inhaltlich auf 10.6 aufsetzbar (Reihenfolge mit 10.6 abstimmbar).

- **Story 10.8 (MOTD: Härtung — Sanitize, A11y, Audit, Tests):** ✅ Als Team möchten wir MOTD **produktionssicher** abschließen: XSS-Schutz, Audit-Spuren für Admin-Änderungen, Tests und dokumentierte Betriebsparameter.
  - **Akzeptanzkriterien:**
    - Markdown-Output durch **Sanitize-Pipeline** wie im restlichen Produkt; **ADR-0015** bei Bildern eingehalten.
    - **Leichtes Audit** für relevante Admin-Aktionen (mindestens: Veröffentlichung, Archiv-Sichtbarkeit, Löschen — Metadaten ohne Pflicht-Volltext im Log).
    - Unit-Tests für Auswahl-Logik, DTOs, Rate-Limits; Frontend-Specs für Overlay und Archiv; DoD aus `Backlog.md` eingehalten.
    - `docs/ROUTES_AND_STORIES.md` und bei Bedarf die Architektur-Dokumentation werden um MOTD-Routen und Router ergänzt.
  - **Abhängigkeiten:** 10.4–10.7 (inhaltlich Querschnitt nach abgeschlossenen Kern-Stories).
