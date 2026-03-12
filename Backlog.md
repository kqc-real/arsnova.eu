# 📋 Product Backlog: arsnova.eu (Core Features MVP)

> **Priorisierung:** 🔴 Must · 🟡 Should · 🟢 Could
>
> **Abhängigkeiten (Kernpfad):** Epic 0 → Epic 1 → Epic 2 → Epic 3 → Epic 4 → Epic 5 ✅
>
> **Nächster Fokus:** Epic 6 (Theming, i18n, Impressum/Datenschutz, Mobile-First, Barrierefreiheit) — parallel ab Epic 0 möglich.
>
> **Weitere Parallelpfade:** Epic 9 (Admin: Inspektion, Löschen, Auszug für Behörden)

---

## 📊 Story-Übersicht & Bearbeitungsstand


| Epic | Story | Titel                                         | Prio | Status   |
| ---- | ----- | --------------------------------------------- | ---- | -------- |
| 0    | 0.1   | Redis-Setup                                   | 🔴   | ✅ Fertig |
| 0    | 0.2   | tRPC WebSocket-Adapter                        | 🔴   | ✅ Fertig |
| 0    | 0.3   | Yjs WebSocket-Provider                        | 🟡   | ✅ Fertig |
| 0    | 0.4   | Server-Status-Indikator                       | 🟡   | ✅ Fertig |
| 0    | 0.5   | Rate-Limiting & Brute-Force-Schutz            | 🔴   | ✅ Fertig |
| 0    | 0.6   | CI/CD-Pipeline (GitHub Actions)               | 🔴   | ✅ Fertig |
| 1    | 1.1   | Quiz erstellen                                | 🔴   | ✅ Fertig |
| 1    | 1.2a  | Fragentypen: MC & SC                          | 🔴   | ✅ Fertig |
| 1    | 1.2b  | Fragentypen: Freitext & Umfrage               | 🟡   | ✅ Fertig |
| 1    | 1.2c  | Fragentyp: Rating-Skala                       | 🟡   | ✅ Fertig |
| 1    | 1.3   | Antworten & Lösungen                          | 🔴   | ✅ Fertig |
| 1    | 1.4   | Sitzungs-Konfiguration                        | 🟡   | ✅ Fertig |
| 1    | 1.5   | Local-First Speicherung                       | 🔴   | ✅ Fertig |
| 1    | 1.6   | Yjs Multi-Device-Sync                         | 🟢   | ✅ Fertig |
| 1    | 1.6a  | Quiz auf anderem Gerät öffnen (Sync-Key/Link) | 🟡   | ✅ Fertig |
| 1    | 1.6b  | Preset & Optionen beim Sync mitführen          | 🟢   | ✅ Fertig |
| 1    | 1.7   | Markdown & KaTeX                              | 🔴   | ✅ Fertig |
| 1    | 1.8   | Quiz exportieren                              | 🟡   | ✅ Fertig |
| 1    | 1.9   | Quiz importieren                              | 🟡   | ✅ Fertig |
| 1    | 1.9a  | KI-gestützter Quiz-Import (Zod-Validierung)   | 🟡   | ✅ Fertig |
| 1    | 1.9b  | KI-Systemprompt (kontextbasiert, schema-getreu)| 🟡   | ✅ Fertig |
| 1    | 1.10  | Quiz bearbeiten & löschen                     | 🔴   | ✅ Fertig |
| 1    | 1.11  | Quiz-Presets                                  | 🟡   | ✅ Fertig |
| 1    | 1.12  | SC-Schnellformate                             | 🟡   | ✅ Fertig |
| 1    | 1.13  | Quiz-Preview & Schnellkorrektur               | 🟡   | ✅ Fertig |
| 1    | 1.14  | Word Cloud (interaktiv + Export)              | 🟡   | ✅ Fertig |
| 1    | 1.15  | Preset-Konfiguration exportieren & importieren | 🟢   | ✅ Fertig |
| 2    | 2.1a  | Session-ID & Quiz-Upload                      | 🔴   | ✅ Fertig |
| 2    | 2.1b  | QR-Code                                       | 🟢   | ✅ Fertig |
| 2    | 2.2   | Lobby-Ansicht                                 | 🔴   | ✅ Fertig |
| 2    | 2.3   | Präsentations-Steuerung                       | 🔴   | ✅ Fertig |
| 2    | 2.4   | Security / Data-Stripping                     | 🔴   | ✅ Fertig |
| 2    | 2.5   | Beamer-Ansicht / Presenter-Mode               | 🔴   | ✅ Fertig |
| 2    | 2.6   | Zwei-Phasen-Frageanzeige (Lesephase)          | 🟡   | ✅ Fertig |
| 2    | 2.7   | Peer Instruction (zweite Abstimmung, Vorher/Nachher) | 🟡   | ✅ Fertig |
| 3    | 3.1   | Beitreten                                     | 🔴   | ✅ Fertig |
| 3    | 3.2   | Nicknames                                     | 🟡   | ✅ Fertig |
| 3    | 3.3a  | Frage empfangen                               | 🔴   | ✅ Fertig |
| 3    | 3.3b  | Abstimmung abgeben                            | 🔴   | ✅ Fertig |
| 3    | 3.4   | Echtzeit-Feedback                             | 🟡   | ✅ Fertig |
| 3    | 3.5   | Countdown-Anzeige                             | 🔴   | ✅ Fertig |
| 3    | 3.5a  | Countdown Finger-Anzeige (letzte 6 Sekunden)   | 🟡   | ✅ Fertig |
| 3    | 3.6   | Anonymer Modus                                | 🟡   | ✅ Fertig |
| 4    | 4.1   | Leaderboard mit Punktesystem                  | 🟡   | ✅ Fertig |
| 4    | 4.2   | Server aufräumen                              | 🔴   | ✅ Fertig |
| 4    | 4.3   | WebSocket Reconnection                        | 🟡   | ✅ Fertig |
| 4    | 4.4   | Ergebnis-Visualisierung                       | 🔴   | ✅ Fertig |
| 4    | 4.5   | Freitext-Auswertung                           | 🟡   | ✅ Fertig |
| 4    | 4.6   | Bonus-Code für Top-Platzierungen               | 🟡   | ✅ Fertig |
| 4    | 4.7   | Ergebnis-Export für Dozenten (anonym)         | 🟡   | ✅ Fertig |
| 4    | 4.8   | Session-Bewertung durch Teilnehmende          | 🟡   | ✅ Fertig |
| 5    | 5.1   | Sound-Effekte                                 | 🟡   | ✅ Fertig |
| 5    | 5.3   | Hintergrundmusik                              | 🟢   | ✅ Fertig |
| 5    | 5.4   | Belohnungseffekte                             | 🟡   | ✅ Fertig |
| 5    | 5.5   | Answer Streak                                 | 🟡   | ✅ Fertig |
| 5    | 5.6   | Persönliche Scorecard                         | 🔴   | ✅ Fertig |
| 5    | 5.7   | Motivationsmeldungen                          | 🟡   | ✅ Fertig |
| 5    | 5.8   | Emoji-Reaktionen                              | 🟢   | ✅ Fertig |
| 6    | 6.1   | Dark/Light/System-Theme                       | 🟡   | ✅ Fertig |
| 6    | 6.2   | Internationalisierung                         | 🟡   | ✅ Fertig |
| 6    | 6.3   | Impressum & Datenschutz                       | 🔴   | ✅ Fertig |
| 6    | 6.4   | Mobile-First & Responsive                     | 🔴   | ✅ Fertig |
| 6    | 6.5   | Barrierefreiheit (Prüfung Projektende)        | 🔴   | ⬜ Offen  |
| 7    | 7.1   | Team-Modus                                    | 🟢   | ⬜ Offen  |
| 8    | 8.1   | Q&A-Session starten                           | 🟢   | ⬜ Offen  |
| 8    | 8.2   | Fragen einreichen                             | 🟢   | ⬜ Offen  |
| 8    | 8.3   | Upvoting & Sortierung                         | 🟢   | ⬜ Offen  |
| 8    | 8.4   | Dozenten-Moderation                           | 🟢   | ⬜ Offen  |
| 9    | 9.1   | Admin: Sessions & Quiz-Inhalte inspizieren     | 🟡   | ⬜ Offen  |
| 9    | 9.2   | Admin: Session/Quiz löschen (rechtlich)        | 🟡   | ⬜ Offen  |
| 9    | 9.3   | Admin: Auszug für Behörden/Staatsanwaltschaft | 🟡   | ⬜ Offen  |


> **Legende Status:** ⬜ Offen · 🔨 In Arbeit · ✅ Fertig (DoD erfüllt) · ❌ Blockiert
>
> **Statistik:** 🔴 Must: 23 · 🟡 Should: 32 · 🟢 Could: 14 = **69 Storys gesamt**

---

## ✅ Definition of Done (DoD)

Eine Story gilt als **fertig**, wenn **alle** folgenden Kriterien erfüllt sind:

### Code-Qualität

- Code kompiliert fehlerfrei (`tsc --noEmit` für Backend, Frontend und shared-types).
- Kein `any`-Typ im gesamten Code (Regel aus AGENT.md §3).
- Alle tRPC-Endpunkte validieren Ein-/Ausgaben über Zod-Schemas aus `@arsnova/shared-types`.
- Das DTO-Pattern ist eingehalten: Daten werden serverseitig durch DTOs gefiltert, bevor sie an Clients gesendet werden.
- `isCorrect` wird **niemals** im Status `ACTIVE` an Studenten übertragen (Data-Stripping-Regel, Story 2.4).

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
- `aria-label` / `aria-live` für dynamische Inhalte (Countdown, Teilnehmerzahl, Feedback).
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

### Deployment

- `docker compose up` startet das gesamte System (PostgreSQL, Redis, Backend, Frontend) ohne manuelle Eingriffe.
- Keine neuen `npm audit`-Schwachstellen mit Severity ≥ high.

---

## Epic 0: Infrastruktur & Plattform (Rolle: Entwickler)

> **Verifizierung im laufenden Betrieb:** 2025-02-23 — Prisma validate ✅, tsc (shared-types, backend, frontend) ✅, Vitest (health + rateLimit, 21 Tests) ✅, ESLint ✅. Docker/Redis via docker-compose.yml und Health-Check-Code geprüft; Frontend wsLink/httpBatchLink und ServerStatusWidget geprüft; CI-Workflow und README-Badge geprüft.  
> **Build + Laufbetrieb (2025-02-23):** `npm run build` ✅ (inkl. Fix Session-Template @else). `docker compose up -d postgres redis` ✅, `prisma db push` ✅. Backend gestartet: `health.check` → redis=ok ✅, `health.stats` → activeSessions/totalParticipants/completedSessions/serverStatus ✅, WebSocket-Server (Story 0.2) erreichbar ✅, Frontend `ng serve` + Startseite mit Status-Widget erreichbar ✅.

- **Story 0.1 (Redis-Setup):** 🔴 Als Entwickler möchte ich eine funktionierende Redis-Instanz (via Docker Compose) haben, damit Echtzeit-Features darauf aufbauen können.
  - **Akzeptanzkriterien:**
    - [x] `docker compose up` startet Redis neben PostgreSQL.
    - [x] Backend kann sich erfolgreich mit Redis verbinden (Health-Check erweitert).
- **Story 0.2 (tRPC WebSocket-Adapter):** 🔴 Als Entwickler möchte ich den tRPC-Server um einen WebSocket-Adapter (`@trpc/server/adapters/ws`) erweitern, damit Subscriptions (Echtzeit-Events) möglich werden.
  - **Akzeptanzkriterien:**
    - [x] WebSocket-Server läuft parallel zum HTTP-Server.
    - [x] Ein Test-Subscription-Endpoint (`health.ping`) sendet alle 5s ein Heartbeat-Event.
    - [x] Frontend-tRPC-Client nutzt `wsLink` für Subscriptions und `httpBatchLink` für Queries/Mutations.
- **Story 0.3 (Yjs WebSocket-Provider):** 🟡 Als Entwickler möchte ich einen Yjs-WebSocket-Provider im Backend einrichten, damit Dozenten ihre Quizzes zwischen Geräten (PC ↔ iPad) synchronisieren können.
  - **Akzeptanzkriterien:**
    - [x] `y-websocket`-Server ist im Backend integriert.
    - [x] Ein Yjs-Dokument kann von zwei Browser-Tabs synchron gehalten werden.
- **Story 0.4 (Server-Status-Indikator):** 🟡 Als Besucher der Startseite möchte ich auf einen Blick sehen, wie ausgelastet der Server ist, damit ich die aktuelle Nutzung einschätzen kann.
  - **Akzeptanzkriterien:**
    - [x] tRPC-Query `health.stats` liefert: Anzahl laufender Quizzes, Gesamtzahl aktiver Teilnehmer, Server-Status (`healthy` / `busy` / `overloaded`).
    - [x] Die Startseite zeigt die Werte als kompaktes Status-Widget an (z.B. "3 Quizzes live · 142 Teilnehmer · 1.247 Quizzes durchgeführt").
    - [x] Ein farbiger Indikator visualisiert den Server-Status: grün (healthy), gelb (busy), rot (overloaded).
    - [x] Schwellwerte für Status: `healthy` < 50 Sessions, `busy` < 200 Sessions, `overloaded` ≥ 200 Sessions.
    - [x] Anzahl bisher durchgeführter Quizzes (`completedSessions`) wird als Gesamtstatistik angezeigt.
    - [x] Die Daten werden alle 30 Sekunden automatisch aktualisiert (Polling).
    - [x] Es werden keine personenbezogenen Daten exponiert (nur aggregierte Zahlen).
    - [x] ⚠️ *Abhängigkeit:* Vor Umsetzung von Story 2.1a liefert die Query Initialwerte (`activeSessions: 0`, `totalParticipants: 0`, `completedSessions: 0`).
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

---

## Epic 1: Quiz-Verwaltung (Rolle: Dozent / Ersteller)

> **Verifizierung Epic 1 (2026-03-09):** Status aller Storys 1.1–1.15 auf **✅ Fertig** gesetzt.  
> Frontend-Checks: `npm run typecheck -w @arsnova/frontend` ✅, `npm run test -w @arsnova/frontend -- src/app/features/quiz` ✅ (54/54).  
> Ergänzend abgeschlossen: Styleguide-/DoD-Nacharbeiten (Lesbarkeit/Spacing, Wording-Konsistenz, deutsches Datumsformat `de-DE`, Fehlerfokus auf erstes ungültiges Feld, Entfernung fragiler `::ng-deep`-Selektoren im Quiz-Feature, Preview-Interaktions- und Markdown/KaTeX-Rendering-Korrekturen).

- **Story 1.1 (Quiz erstellen):** 🔴 Als Dozent möchte ich ein neues Quiz anlegen und benennen können.
  - **Akzeptanzkriterien:**
    - Ein Formular (Name, optionale Beschreibung) erstellt ein neues Quiz.
    - Das Quiz erscheint in einer lokalen Quiz-Liste.
    - Name darf nicht leer sein und max. 200 Zeichen haben.
- **Story 1.2a (Fragentypen: MC & SC):** 🔴 Als Dozent möchte ich Multiple-Choice- und Single-Choice-Fragen hinzufügen können.
  - **Akzeptanzkriterien:**
    - Frage-Formular mit Typ-Auswahl (MC/SC) und mindestens 2 Antwortoptionen.
    - MC erlaubt mehrere korrekte Antworten, SC genau eine.
    - Fragen werden in der Quiz-Ansicht sortiert angezeigt.
    - Fragenstamm und Antwortoptionen unterstützen Markdown & KaTeX (siehe Story 1.7).
    - Pro Frage kann ein Schwierigkeitsgrad (EASY / MEDIUM / HARD) ausgewählt werden (default: MEDIUM).
- **Story 1.2b (Fragentypen: Freitext & Umfrage):** 🟡 Als Dozent möchte ich Freitext- und Umfrage-Fragen hinzufügen können.
  - **Akzeptanzkriterien:**
    - Freitext-Fragen haben keine vordefinierten Antwortoptionen.
    - Umfrage-Fragen haben Optionen, aber kein `isCorrect`-Flag.
    - Freitext- und Umfrage-Fragen werden im Leaderboard-Scoring (Story 4.1) nicht gewertet — sie vergeben 0 Punkte und zählen nicht zur `totalQuestions`-Summe.
- **Story 1.2c (Fragentyp: Rating-Skala):** 🟡 Als Dozent möchte ich eine Bewertungsskala-Frage (1–5 oder 1–10) stellen können, um Meinungsbilder und Zufriedenheitswerte zu erheben.
  - **Akzeptanzkriterien:**
    - Neuer Fragentyp `RATING` in der Typ-Auswahl.
    - Der Dozent konfiguriert die Skala: Minimum (default: 1), Maximum (5 oder 10), optionale Labels für Min/Max (z.B. „Stimme gar nicht zu" / „Stimme voll zu").
    - Auf dem Studenten-Gerät wird die Skala als horizontale Reihe von Sternen, Zahlen oder Punkten dargestellt (1 Tap = Auswahl).
    - RATING-Fragen werden **nicht** gescored (wie SURVEY) — 0 Punkte, kein `isCorrect`.
    - **Ergebnis-Visualisierung:** Histogramm (Balkendiagramm der Häufigkeiten pro Stufe) + Durchschnittswert + Standardabweichung.
    - Prisma: Neues Feld `Vote.ratingValue Int?` für den gewählten Skalenwert. Neues Feld `Question.ratingMin`, `Question.ratingMax`, `Question.ratingLabelMin`, `Question.ratingLabelMax`.
- **Story 1.3 (Antworten & Lösungen):** 🔴 Als Dozent möchte ich Antwortmöglichkeiten definieren und korrekte Antworten markieren können.
  - **Akzeptanzkriterien:**
    - Antworten können hinzugefügt, bearbeitet und gelöscht werden.
    - Mindestens eine Antwort muss als korrekt markiert sein (außer bei SURVEY/FREETEXT).
    - `isCorrect`-Felder werden primär lokal im Browser gespeichert (Yjs/IndexedDB).
    - Beim Live-Schalten (Story 2.1a) werden `isCorrect`-Felder einmalig an den Server übertragen, damit das serverseitige Scoring (Story 4.1) möglich ist. Sie werden dort nur temporär für die Dauer der Session vorgehalten.
- **Story 1.4 (Sitzungs-Konfiguration):** 🟡 Als Dozent möchte ich globale Einstellungen für mein Quiz festlegen können.
  - **Akzeptanzkriterien:**
    - Toggle für `showLeaderboard` (default: an).
    - Toggle für `allowCustomNicknames` (default: an).
    - Optional: Standard-Timer (5–300 Sekunden), überschreibbar pro Frage.
    - Auswahl des Nickname-Themas (`nicknameTheme`, default: Nobelpreisträger; siehe Story 3.2).
    - Toggle für `enableSoundEffects` (default: an; siehe Story 5.1).
    - Toggle für `enableRewardEffects` (default: an; siehe Story 5.4).
    - Auswahl der Hintergrundmusik (`backgroundMusic`, optional; siehe Story 5.3).
- **Story 1.5 (Local-First Speicherung):** 🔴 Als Dozent möchte ich, dass mein Quiz automatisch lokal in meinem Browser (IndexedDB via Yjs) gespeichert wird, ohne Account-Zwang.
  - **Akzeptanzkriterien:**
    - Quiz-Daten werden als Yjs-Dokument in IndexedDB persistiert.
    - Nach Browser-Neustart sind alle Quizzes sichtbar.
    - Kein Server-Roundtrip nötig zum Speichern.
- **Story 1.6 (Yjs Multi-Device-Sync):** 🟢 Als Dozent möchte ich mein Quiz auf mehreren Geräten synchron bearbeiten können.
  - **Akzeptanzkriterien:**
    - Änderungen auf Gerät A erscheinen in <2s auf Gerät B.
    - Konflikte werden automatisch via CRDT aufgelöst.
    - Abhängig von Story 0.3.
    - UX für „Quiz auf anderem Gerät öffnen“ siehe Story 1.6a.
- **Story 1.6a (Quiz auf anderem Gerät öffnen – Sync-Key/Link):** 🟡 Als Dozent möchte ich einen persönlichen Sync-Link oder Sync-Code für ein Quiz erhalten, damit ich dasselbe Quiz auf einem anderen Gerät (z. B. Tablet) öffnen, weiterbearbeiten oder von dort aus live schalten kann – ohne dass Teilnehmer (Session-Code) das Quiz bearbeiten können.
  - **Akzeptanzkriterien:**
    - In der Quiz-Detailansicht bzw. im Editor gibt es eine Option **„Auf anderem Gerät öffnen“** (oder vergleichbar), die einen **Sync-Link** (URL mit Dokument-ID) und/oder einen kurzen **Sync-Code** (z. B. zum Abtippen) sowie optional einen **QR-Code** anzeigt.
    - Der Sync-Link enthält die Yjs-Dokument-ID (Room-Name); wer den Link öffnet, verbindet sich mit demselben Yjs-Dokument und sieht das Quiz zur Bearbeitung bzw. zur Session-Steuerung (wie auf dem ersten Gerät).
    - Auf dem anderen Gerät: Nutzer gibt die App-URL ein, öffnet den Sync-Link (oder scannt den QR-Code / gibt den Sync-Code ein) und gelangt zum **gleichen Quiz** (Bearbeitung, Preview, ggf. Session starten/steuern). Kein erneutes Anlegen des Quiz nötig.
    - **Trennung von Session-Code:** Der 6-stellige Session-Beitrittscode (für Studenten) wird nicht als Sync-Key verwendet und gewährt keinen Zugriff auf die Quiz-Bearbeitung. Nur wer den Sync-Link/Code hat, kann das Quiz bearbeiten oder live steuern.
    - Abhängig von Story 1.6 (Yjs Multi-Device-Sync) und Story 0.3 (y-websocket).
- **Story 1.6b (Preset & Optionen beim Sync mitführen):** 🟢 Als Dozent möchte ich beim Synchronisieren mit einem anderen Client (Sync-Link/Key, Story 1.6/1.6a) auch meine **Preset- und Optionen-Einstellungen** (Seriös/Spielerisch, alle Toast-Optionen wie Leaderboard, Sound, Lesephase, Team, …) mitgeführt haben, damit auf dem anderen Gerät dieselben Voreinstellungen ankommen und nicht auf Standard zurückfallen.
  - **Akzeptanzkriterien:**
    - Preset (home-preset) und Optionen (home-preset-options) werden nicht nur in localStorage gehalten, sondern zusätzlich in einem **kleinen Yjs-Dokument** (z. B. „Preferences“) persistiert, das über den **gleichen Sync-Kanal** wie das Quiz (oder einen abgeleiteten Room) synchronisiert wird.
    - Beim Öffnen eines Sync-Links auf dem anderen Client werden diese Einstellungen übernommen (Preset-Anzeige, Optionen-Chips); bei Konflikt gewinnt „last write“ oder CRDT-Merge (z. B. einzelne Optionen als Y-Map).
    - Ohne aktiven Sync bleibt das bisherige Verhalten (nur localStorage); mit Sync werden Änderungen an Preset/Optionen ins Yjs-Dokument geschrieben und so auf andere Clients übertragen.
    - Abhängig von Story 1.6 bzw. 1.6a (Sync-Link/Key muss vorhanden sein).
- **Story 1.7 (Markdown & KaTeX):** 🔴 Als Dozent möchte ich im Fragenstamm und in den Antwortoptionen Markdown und KaTeX-Formeln verwenden können, damit ich mathematische und formatierte Inhalte ansprechend darstellen kann.
  - **Akzeptanzkriterien:**
    - Fragenstamm (`Question.text`) und Antworttext (`AnswerOption.text`) akzeptieren Markdown-Syntax (Fett, Kursiv, Listen, Code-Blöcke, Bilder).
    - KaTeX-Auszeichnungen (Inline `$...$` und Block `$$...$$`) werden als gerenderte Formeln angezeigt.
    - Beim Bearbeiten einer Frage zeigt eine Live-Preview den gerenderten Markdown- und KaTeX-Inhalt neben dem Editor an.
    - Die Preview aktualisiert sich bei jeder Tastatureingabe (Debounce ≤300ms).
    - Ungültige KaTeX-Syntax zeigt eine lesbare Fehlermeldung in der Preview statt zu crashen.
    - Die gerenderte Darstellung wird auch den Studenten in der Live-Session korrekt angezeigt (Story 3.3a).
    - Verwendete Libraries: `marked` (Markdown) + `katex` (Mathematik), kein serverseitiges Rendering nötig.
- **Story 1.8 (Quiz exportieren):** 🟡 Als Dozent möchte ich ein Quiz als JSON-Datei exportieren können, damit ich es sichern, teilen oder auf einem anderen Gerät importieren kann.
  - **Akzeptanzkriterien:**
    - Ein "Exportieren"-Button erzeugt eine `.json`-Datei mit allen Quiz-Daten (Name, Beschreibung, Konfiguration, Fragen, Antwortoptionen inkl. `isCorrect`).
    - Das Export-Format enthält eine Schema-Version (`exportVersion`), um spätere Migrationen zu ermöglichen.
    - Markdown- und KaTeX-Auszeichnungen bleiben als Rohtext im Export erhalten.
    - Der Export erfolgt rein clientseitig (Download aus IndexedDB/Yjs, kein Server-Roundtrip).
    - Der Dateiname enthält den Quiz-Namen und ein Datum (z.B. `Mathe-Quiz_2026-02-18.json`).
- **Story 1.9 (Quiz importieren):** 🟡 Als Dozent möchte ich eine zuvor exportierte JSON-Datei importieren können, um ein Quiz wiederherzustellen oder von Kollegen zu übernehmen.
  - **Akzeptanzkriterien:**
    - Ein "Importieren"-Button öffnet einen Datei-Dialog für `.json`-Dateien.
    - Die Datei wird gegen das Export-Schema (Zod) validiert; bei Fehlern wird eine verständliche Meldung angezeigt.
    - Das importierte Quiz erhält eine neue ID (kein Überschreiben bestehender Quizzes).
    - Das Quiz wird nach dem Import sofort in der lokalen Quiz-Liste angezeigt (Yjs/IndexedDB).
    - Der Import erfolgt rein clientseitig (kein Server-Roundtrip).
- **Story 1.9a (KI-gestützter Quiz-Import mit Zod-Validierung):** 🟡 Als Dozent möchte ich die vom LLM generierte Quiz-JSON (aus dem Workflow von Story 1.9b) in arsnova.eu importieren können, wobei strikte Zod-Validierung sicherstellt, dass fehlerhafte oder halluzinierte KI-Antworten die App nicht zum Absturz bringen.
  - **Akzeptanzkriterien:**
    - **Import-UI:** Es gibt einen Dialog **„KI-JSON importieren“**, in den der Dozent die Antwort des LLMs per Copy & Paste einfügen oder als `.json`-Datei hochladen kann. Ein Zugang zu diesem Dialog ist dort vorhanden, wo auch der KI-Prompt angeboten wird (Story 1.9b).
    - **Strikte Zod-Validierung (Kern-Kriterium):**
      - Das eingefügte JSON wird **nicht** blind mit `JSON.parse()` als `any` in den State übernommen.
      - Es muss durch ein definiertes Zod-Schema (z. B. `quizImportSchema` aus `libs/shared-types/src/schemas.ts`) laufen (mittels `schema.safeParse()`).
      - Die Validierung prüft rekursiv, ob alle Pflichtfelder vorhanden sind (z. B. korrekter `QuestionType` aus dem Enum, Vorhandensein des `isCorrect`-Flags bei den Antworten).
    - **Fehlerbehandlung (Graceful Degradation):** Wenn die KI das Format verfehlt hat (Zod wirft einen Fehler), stürzt die App nicht ab. Stattdessen liest das Frontend den `ZodError` aus und zeigt dem Dozenten eine verständliche Fehlermeldung an (z. B. „Fehler im Import: Bei Frage 2 fehlt das Feld ‚isCorrect‘“).
    - **Yjs-Integration:** Nur wenn `safeParse().success` wahr ist, wird das typsichere Objekt in ein lokales Yjs-CRDT-Dokument transformiert, in der IndexedDB gespeichert und dem Dashboard des Dozenten hinzugefügt.
  - **Abhängigkeiten:** Story 1.9 (Quiz importieren, gleiches Import-Schema/Wiederverwendung), Story 1.5 (Local-First/Yjs). Das Zod-Schema für den KI-Import kann das gleiche wie für den regulären Import sein oder eine explizite Variante `quizImportSchema` in `libs/shared-types`.
- **Story 1.9b (KI-Systemprompt – kontextbasiert, schema-getreu):** 🟡 Als Dozent möchte ich einen KI-Systemprompt an der **Stelle in der UI kopieren** können, an der ich bereits meine **Vorgaben** (Preset, Zielgruppe/Nickname-Auswahl, Schwierigkeitsgrad, ggf. weitere Optionen) durchgeklickt habe, damit das LLM ein schema-konformes Quiz genau nach meinen Einstellungen erzeugen kann – inkl. Anleitung für Kontext-Upload (RAG) bei Präsentation/Skript.
  - **Akzeptanzkriterien:**
    - **Platzierung:** Der **„KI-Prompt generieren“**-Button (bzw. Zugang zum Kopieren des Prompts) wird **dort angeboten, wo der Dozent bereits Preset-Optionen, Zielgruppe (Nickname-Theme), Schwierigkeitsgrad und ggf. weitere Quiz-Vorgaben** gewählt hat (z. B. auf der Startseite nach Auswahl des Presets und der Optionen, oder in einem dedizierten „Quiz per KI vorbereiten“-Schritt). Nicht auf einer leeren Seite ohne Kontext.
    - **Kontext-Einbindung:** Der kopierte Prompt enthält die **aktuell gewählten Werte** (Preset: Seriös/Spielerisch, Zielgruppe z. B. Kita/Oberstufe, Standard-Schwierigkeit EASY/MEDIUM/HARD), sodass das LLM das Quiz passend zu diesen Vorgaben generiert. Die Werte werden aus dem gleichen State/Model gespeist wie die übrigen Preset-Optionen (Story 1.11, Home-Optionen).
    - **Schema-Treue:** Der Prompt-Text (Template bzw. konstante Vorlage in `@arsnova/shared-types` oder Frontend, wartbar) beschreibt **exakt** das von `quizImportSchema` erwartete JSON-Format: erforderliche Felder, erlaubte Enums (`QuestionType`, etc.), `isCorrect` bei Antwortoptionen, Struktur für Fragen und Optionen. Das Ziel ist, dass typische LLM-Ausgaben nach Feintuning **ohne Nachbearbeitung** die Zod-Validierung (Story 1.9a) bestehen.
    - **RAG-Anleitung:** Der Prompt weist den Dozenten an, bei Bedarf **Lehrmaterial (Präsentation, Skript, PDF)** per Kontext-Upload (Datei/URL) im Chatbot bereitzustellen, und das LLM an, das Quiz **aus diesem Kontext** zu erzeugen – so ist ein präsentations-/skriptbasiertes Quiz (wie bei Mentimeter) abgedeckt, ohne Upload zu arsnova.eu.
    - **Wartbarkeit:** Der Prompt-Inhalt ist als **eigenes, versionierbares Artefakt** (z. B. Template-String, Markdown-Datei oder Eintrag in i18n) gepflegt, sodass Iterationen für bessere Schema-Konformität (Feintuning) ohne Änderung der Import-Logik (1.9a) möglich sind.
  - **Abhängigkeiten:** Story 1.11 (Preset & Optionen), damit Preset/Zielgruppe/Optionen in der UI verfügbar sind; Story 1.9a (Import) kann parallel oder danach umgesetzt werden – der Prompt wird von 1.9a nur genutzt (Copy), nicht implementiert.
- **Story 1.10 (Quiz bearbeiten & löschen):** 🔴 Als Dozent möchte ich ein bestehendes Quiz umbenennen, bearbeiten und löschen können, damit ich meine Quiz-Sammlung pflegen kann.
  - **Akzeptanzkriterien:**
    - In der Quiz-Liste gibt es pro Quiz ein Kontextmenü (⋮) mit Optionen: „Bearbeiten", „Duplizieren", „Löschen".
    - **Bearbeiten:** Öffnet das Quiz im Editor — alle Felder (Name, Beschreibung, Konfiguration, Fragen, Antworten) sind änderbar. Änderungen werden sofort lokal gespeichert (Yjs/IndexedDB).
    - **Duplizieren:** Erstellt eine vollständige Kopie des Quizzes mit dem Suffix „(Kopie)" am Namen und einer neuen ID.
    - **Löschen:** Zeigt einen Bestätigungsdialog ("Quiz ‹Name› wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden."). Nach Bestätigung wird das Yjs-Dokument aus IndexedDB entfernt.
    - Ein Quiz, das gerade live ist (offene Session), kann nicht gelöscht werden — der Löschen-Button ist ausgegraut mit Tooltip-Hinweis.
    - Alle Operationen erfolgen rein clientseitig (Local-First).
- **Story 1.11 (Quiz-Presets):** 🟡 Als Dozent möchte ich beim Erstellen eines Quizzes ein Preset auswählen können, das alle Gamification-Einstellungen auf einmal setzt, damit ich schnell zwischen spielerischem und seriösem Modus wechseln kann.
  - **Akzeptanzkriterien:**
    - Es gibt **zwei** Presets in der Quiz-Konfiguration:
      - **🎮 Spielerisch** (default): setzt `showLeaderboard=true`, `enableSoundEffects=true`, `enableRewardEffects=true`, `enableMotivationMessages=true`, `enableEmojiReactions=true`, `anonymousMode=false`.
      - **🎓 Seriös**: setzt `showLeaderboard=false`, `enableSoundEffects=false`, `enableRewardEffects=false`, `enableMotivationMessages=false`, `enableEmojiReactions=false`, `anonymousMode=true`, `defaultTimer=null` (offene Antwortphase).
    - **Einzeloptionen sind auswählbar:** Jede Option kann unabhängig an- oder abgewählt bzw. gesetzt werden; die UI bietet pro Option einen klaren Toggle oder Eingabefeld. Nach Auswahl eines Presets kann der Dozent jede Einzeloption überschreiben. Die gewählten **Einzelwerte werden gespeichert** — im Quiz-Dokument (Yjs) und damit persistent (Local-First, Sync über Yjs).
    - Das Preset dient nur als Komfortfunktion zum einmaligen Vorsetzen der Werte; **maßgeblich und gespeichert sind die Einzelwerte** (über Yjs), nicht das Preset selbst.
    - Ein visueller Hinweis (Badge „Spielerisch" / „Seriös") zeigt an, welchem Preset die aktuelle Konfiguration entspricht. Wenn Einzelwerte abweichen, wird „Benutzerdefiniert" angezeigt.
    - **Bedeutung der Einzeloptionen** (alle Quiz-Konfigurationsoptionen, auswählbar; Referenz: Prisma Quiz, CreateQuizInput):
      - **showLeaderboard** — Leaderboard mit Rangfolge anzeigen (ja/nein).
      - **allowCustomNicknames** — Eigene Pseudonyme erlauben oder nur vordefinierte Liste (Story 1.4) (ja/nein).
      - **defaultTimer** — Standard-Countdown in Sekunden pro Frage (Zahl oder „offen" / null).
      - **enableSoundEffects** — Sound-Effekte bei Aktionen (ja/nein).
      - **enableRewardEffects** — Belohnungseffekte (ja/nein).
      - **enableMotivationMessages** — Motivationsmeldungen (ja/nein).
      - **enableEmojiReactions** — Emoji-Reaktionen (ja/nein).
      - **anonymousMode** — Anonymer Modus (keine Nickname-Auswahl, automatische IDs) (ja/nein).
      - **readingPhaseEnabled** — Lesephase: Frage zuerst lesen, dann „Antworten freigeben" (Story 2.6) (ja/nein).
      - **nicknameTheme** — Thema für vordefinierte Nicknames, z. B. Nobelpreisträger, Tiere (Story 3.2) (Auswahl).
      - **teamMode** — Team-Modus: Teilnehmer in Teams (Story 7.1) (ja/nein).
      - **teamCount** — Anzahl Teams bei Team-Modus (2–8, nur bei teamMode=true).
      - **teamAssignment** — Zuweisung zu Teams: automatisch oder manuell (Story 7.1) (Auswahl).
      - **backgroundMusic** — Hintergrundmusik in Lobby/Countdown (Story 5.3): Track-Name oder aus (optional).
      - **bonusTokenCount** — Anzahl Top-Plätze mit Bonus-Code (1–50, null = deaktiviert) (Story 4.6). In der UI: „Bonus-Code für Top-Plätze“.
    - **Preset-Optionen-Chips (UI):** Der Zustand jeder Option (an/aus) wird in der Preset-Toast-UI farblich hervorgehoben: „an“ in Grün (Ampel), „aus“ in Rot — bessere Scanbarkeit ohne Abhängigkeit von der Chip-Highlight-Farbe allein.
    - Presets sind auch beim Bearbeiten (Story 1.10) verfügbar.
- **Story 1.12 (SC-Schnellformate):** 🟡 Als Dozent möchte ich beim Erstellen einer Single-Choice-Frage aus vorkonfigurierten Antwortformaten wählen können, damit ich häufig benötigte Formate mit einem Klick einfügen kann.
  - **Akzeptanzkriterien:**
    - Wenn der Fragentyp `SINGLE_CHOICE` gewählt ist, erscheint über dem Antwort-Editor eine Dropdown-Leiste **„Schnellformat"** mit folgenden Optionen:
      - **Ja / Nein** → 2 Antwortoptionen: „Ja", „Nein"
      - **Ja / Nein / Vielleicht** → 3 Antwortoptionen: „Ja", „Nein", „Vielleicht"
      - **Ja / Nein / Weiß nicht** → 3 Antwortoptionen: „Ja", „Nein", „Weiß nicht"
      - **Wahr / Falsch** → 2 Antwortoptionen: „Wahr", „Falsch"
      - **A / B / C / D** → 4 Antwortoptionen: „A", „B", „C", „D"
    - Bei Auswahl eines Formats werden die bestehenden Antwortoptionen **ersetzt** (nach Bestätigungsdialog, falls bereits Antworten vorhanden sind).
    - Der Dozent muss danach mindestens eine Antwort als korrekt (`isCorrect`) markieren — das Schnellformat setzt keine Lösung voraus.
    - Nach dem Einfügen kann der Dozent die Antworttexte frei bearbeiten, weitere Optionen ergänzen oder entfernen.
    - Die Schnellformate sind als Konstante `SC_FORMAT_PRESETS` in `@arsnova/shared-types` definiert und werden bei i18n (Story 6.2) lokalisiert.
    - Das Dropdown ist nur bei `SINGLE_CHOICE` sichtbar — bei anderen Fragentypen wird es ausgeblendet.
    - Das Feature ist rein clientseitig (kein Server-Roundtrip, keine Datenbankänderung).
- **Story 1.13 (Quiz-Preview & Schnellkorrektur):** 🟡 Als Dozent möchte ich mein Quiz vor dem Live-Schalten in einer Vorschau durchblättern und dabei Fehler direkt per Inline-Bearbeitung korrigieren können, damit ich Tippfehler und falsche Markierungen schnell finde und behebe — unterstützt durch Hotkeys für flüssige Navigation.
  - **Akzeptanzkriterien:**
    - In der Quiz-Detailansicht gibt es einen **„Preview"-Button** (Augen-Icon 👁️), der den Preview-Modus öffnet.
    - **Vollbild-Preview:**
      - Jede Frage wird so angezeigt, wie sie später auf dem Studenten-Gerät erscheinen würde (Markdown/KaTeX gerendert, Antwort-Buttons mit Farb- und Formencodierung △○□◇).
      - Die korrekte(n) Antwort(en) werden zusätzlich mit einem grünen Häkchen (✓) markiert, damit der Dozent die Lösung sofort sieht.
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
- **Story 1.14 (Word Cloud – interaktiv + Export):** 🟡 Als Dozent möchte ich Freitext-Antworten als interaktive Word-Cloud sehen und die Auswertung exportieren können, damit ich auf Mentimeter-Niveau präsentieren und Ergebnisse für Nachbereitung oder Lehrevaluation nutzen kann.
  - **Akzeptanzkriterien:**
    - **Interaktive Word-Cloud:** In Beamer-Ansicht (Story 2.5) und Dozenten-Steuerung wird bei FREETEXT-Fragen mit mindestens einer Antwort eine Word-Cloud angezeigt; Begriffe werden nach Häufigkeit skaliert (Stopwörter optional ausblendbar).
    - Klick auf einen Begriff hebt ihn hervor oder filtert die zugehörigen Antworten in einer Liste (Toggle); Tooltip zeigt exakte Anzahl.
    - Word-Cloud aktualisiert sich live bei eingehenden Votes (Echtzeit, konsistent mit Story 4.5).
    - **Export:** Dozent kann pro Frage oder für die gesamte Session exportieren:
      - **CSV:** Alle Freitext-Antworten (aggregiert: Text, Anzahl), ohne Nicknames; optional Bonus-Code-Liste (Story 4.6) in separatem Export.
      - **Bild/PNG (optional):** Screenshot der Word-Cloud oder der Ergebnis-Visualisierung für eine Frage.
    - Export ist nur für den Dozenten zugänglich (kein Studenten-Zugriff); Daten nur aggregiert bzw. pseudonym (Bonus-Code-Liste), DSGVO-konform.
    - Abhängigkeiten: Story 4.5 (Freitext-Auswertung), Story 2.5 (Beamer), Story 4.4 (Ergebnis-Visualisierung).
- **Story 1.15 (Preset-Konfiguration exportieren & importieren):** 🟢 Als Dozent möchte ich meine Preset-Konfiguration (Seriös/Spielerisch inkl. aller Optionen) als Datei exportieren und auf einem anderen Gerät/Browser importieren können, damit ich meine Einstellungen geräteübergreifend nutzen kann — ohne Account und ohne serverseitige Speicherung.
  - **Motivation:** Presets werden im `localStorage` des Browsers gespeichert und sind damit an ein Gerät/einen Browser gebunden. Für Dozenten, die zwischen Laptop und Tablet wechseln, geht die individuelle Konfiguration verloren. Diese Story bietet eine einfache, Zero-Knowledge-konforme Lösung.
  - **Akzeptanzkriterien:**
    - In der Preset-Toast-UI gibt es zwei neue Buttons: **„Exportieren"** (Download-Icon) und **„Importieren"** (Upload-Icon).
    - **Export:** Erzeugt eine `.json`-Datei mit allen Preset-Daten beider Presets (Seriös + Spielerisch): Optionszustand, Namensmodus, Nickname-Theme, Teamanzahl, aktives Preset, Theme (Dark/Light/System). Dateiname: `arsnova-presets_{datum}.json`.
    - **Import:** Öffnet einen Datei-Dialog für `.json`-Dateien. Die Datei wird gegen ein Zod-Schema validiert; bei Fehlern wird eine verständliche Meldung angezeigt. Nach erfolgreichem Import werden `localStorage`-Keys aktualisiert und die UI reagiert sofort.
    - Export und Import erfolgen rein clientseitig (kein Server-Roundtrip) — Zero-Knowledge-Prinzip bleibt gewahrt.
    - Das Export-Format enthält eine Schema-Version (`presetExportVersion`), um spätere Migrationen zu ermöglichen.
  - **Abgrenzung zu Story 1.6b:** Story 1.6b synchronisiert Presets automatisch über Yjs (erfordert aktive Sync-Verbindung). Story 1.15 ist eine manuelle, dateibasierte Lösung, die ohne Netzwerk funktioniert und auch über Browsergrenzen (Chrome → Firefox) hinweg nutzbar ist.

---

## Epic 2: Live-Sitzung & Lobby (Rolle: Dozent)

> **Verifizierung (Commit-Historie):** Storys 2.1a–2.7 als ✅ Fertig markiert. Epic 2 ist vollständig abgeschlossen.

- **Story 2.1a (Session-ID generieren & Quiz-Upload):** 🔴 Als Dozent möchte ich ein Quiz live schalten können, wodurch eine 6-stellige Session-ID generiert wird und die Quizdaten an den Server übertragen werden.
  - **Akzeptanzkriterien:**
    - tRPC-Mutation `session.create` erstellt eine Session mit eindeutigem 6-stelligem Code.
    - Session-Status ist initial `LOBBY`.
    - Session ist über `Session`-Modell in der Datenbank persistiert.
    - Das lokale Quiz (Fragen, Antwortoptionen inkl. `isCorrect`, Konfiguration) wird beim Live-Schalten einmalig an den Server übertragen und in PostgreSQL gespeichert.
    - `isCorrect`-Daten verbleiben ausschließlich serverseitig und werden **niemals** während der Frage-Phase an Studenten gesendet (siehe Story 2.4).
- **Story 2.1b (QR-Code):** 🟢 Als Dozent möchte ich einen QR-Code angezeigt bekommen, der den Beitritts-Link enthält.
  - **Akzeptanzkriterien:**
    - QR-Code encodiert `{baseUrl}/join/{sessionCode}`.
    - QR-Code ist auf Beamer-Auflösung lesbar.
- **Story 2.2 (Lobby-Ansicht):** 🔴 Als Dozent möchte ich in Echtzeit sehen, wie viele und welche Studenten meiner Lobby beigetreten sind.
  - **Akzeptanzkriterien:**
    - tRPC-Subscription `session.onParticipantJoined` pusht neue Teilnehmer in Echtzeit.
    - Teilnehmer-Liste zeigt Nicknames an.
    - Teilnehmeranzahl wird live aktualisiert.
- **Story 2.3 (Präsentations-Steuerung):** 🔴 Als Dozent möchte ich den Ablauf steuern (Frage öffnen, Antworten freigeben, Ergebnisse auflösen).
  - **Akzeptanzkriterien:**
    - Buttons: "Nächste Frage" → "Antworten freigeben" → "Ergebnis zeigen".
    - Session-Status-Wechsel: `LOBBY → QUESTION_OPEN → ACTIVE → RESULTS → PAUSED → …` (Details siehe Story 2.6).
    - Wenn `readingPhaseEnabled=false`: Der Status `QUESTION_OPEN` wird übersprungen — "Nächste Frage" wechselt direkt zu `ACTIVE` (bisheriges Verhalten).
    - Alle verbundenen Clients werden via Subscription über Statuswechsel informiert.
- **Story 2.4 (Security / Data-Stripping):** 🔴 Als Dozent möchte ich absolut sicher sein, dass die `isCorrect`-Lösungsflags *während der Frage-Phase* nicht an die Browser der Studenten gesendet werden.
  - **Akzeptanzkriterien:**
    - Das DTO `QuestionStudentDTO` enthält kein `isCorrect`-Feld — es wird bei jeder Frage-Auslieferung serverseitig entfernt.
    - `isCorrect`-Daten dürfen erst **nach expliziter Auflösung durch den Dozenten** (Statuswechsel zu `RESULTS`) an die Studenten übertragen werden (siehe Story 3.4).
    - Ein automatisierter Test verifiziert, dass das ausgehende JSON im Status `ACTIVE` kein `isCorrect` enthält.
    - Ein separater Test bestätigt, dass `isCorrect` im Status `RESULTS` korrekt mitgesendet wird.
    - Code-Review-Checkliste dokumentiert die Stripping-Regel.
- **Story 2.5 (Beamer-Ansicht = Host-Ansicht):** 🔴 Als Dozent sehe ich genau das auf dem Beamer, was auf meinem Laptop angezeigt wird (gespiegelt). Es gibt keinen zweiten Bildschirmausgang – die **Host-Ansicht ist die Beamer-Ansicht**.
  - **Kontext:** Sobald der Dozent die Live-Session startet, spielt sich alles in diesem einen View ab (/session/:code/host). Der Beamer darf nichts verraten, was der Dozent nicht freigegeben hat (z. B. korrekte Antworten erst nach Klick auf „Ergebnis zeigen“).
  - **Akzeptanzkriterien:**
    - Die Host-Ansicht ist die einzige Projektions-Ansicht; keine separate „Beamer-Route“ erforderlich (Route `/session/:code/present` optional, z. B. gleicher Inhalt für Vollbild-Tab).
    - Beamer-tauglich: große Schrift wo nötig (≥ 24px Basis für Fragentext), hoher Kontrast, Fokus auf Inhalt (Lobby: Code, QR, Teilnehmer; Frage: Stamm + Optionen; Steuerung: ein klarer Button).
    - **Nichts verraten:** Korrekte Antworten (grün/Häkchen) werden in der Host-Ansicht erst im Status `RESULTS` angezeigt (bereits umgesetzt).
    - **Lobby-Phase:** Session-Code, QR-Code (2.1b), Live-Teilnehmerliste (2.2).
    - **Lesephase (`QUESTION_OPEN`, Story 2.6):** Nur Fragenstamm (großformatig); Antwortoptionen ausgeblendet; Hinweis „Warte auf Freigabe…“ (Story 2.6).
    - **Frage-Phase (`ACTIVE`):** Fragenstamm, Antwortoptionen ohne Lösungsmarkierung, Countdown (Story 3.5), Live-Abstimmungsbalken.
    - **Ergebnis-Phase (`RESULTS`):** Ergebnis-Visualisierung (Story 4.4), optional Leaderboard-Zwischenstand.
    - **End-Phase (`FINISHED`):** finales Leaderboard (Story 4.1), Belohnungseffekte (Story 5.4).
    - Statuswechsel via tRPC-Subscription; Dozent kann F11 für Browser-Vollbild nutzen.
- **Story 2.6 (Zwei-Phasen-Frageanzeige / Lesephase):** 🟡 Als Dozent möchte ich, dass beim Freigeben einer Frage zunächst nur der Fragenstamm angezeigt wird (Lesephase), damit die Studierenden die Frage in Ruhe und vollständig lesen können, bevor die Antwortoptionen erscheinen und der Countdown beginnt.
  - **Didaktische Begründung:** In klassischen Quiz-Apps erscheinen Frage und Antworten gleichzeitig. Studierende springen dann oft direkt zu den Antworten, ohne die Frage gründlich zu lesen — insbesondere bei komplexen Fragen mit Formeln oder längeren Texten. Die Zwei-Phasen-Anzeige fördert **kognitives Processing** und reduziert impulsives Raten.
  - **Akzeptanzkriterien:**
    - Neuer Session-Status `QUESTION_OPEN` zwischen `LOBBY`/`PAUSED` und `ACTIVE`.
    - **Status-Flow (erweitert):** `LOBBY → QUESTION_OPEN → ACTIVE → RESULTS → PAUSED → QUESTION_OPEN → … → FINISHED`.
    - **Phase 1 (`QUESTION_OPEN`):**
      - Auf Beamer und Studenten-Geräten wird **nur der Fragenstamm** angezeigt (Markdown/KaTeX gerendert), ohne Antwortoptionen.
      - Kein Countdown läuft. Abstimmung ist nicht möglich.
      - Beamer: Frage großformatig zentriert, dezenter Hinweis „Gleich geht's los…".
      - Studenten-Gerät: Frage wird angezeigt, Hinweis „Lies die Frage — Antworten folgen gleich."
      - Neues DTO `QuestionPreviewDTO` wird gesendet (enthält `id`, `text`, `type`, `difficulty`, `order` — **keine** `answers`).
    - **Phase 2 (Übergang zu `ACTIVE`):**
      - Der Dozent klickt den Button „Antworten freigeben" (Story 2.3).
      - Backend wechselt Status von `QUESTION_OPEN` → `ACTIVE`.
      - tRPC-Subscription `session.onAnswersRevealed` pusht die Antwortoptionen (`QuestionStudentDTO` ohne `isCorrect`).
      - Auf Beamer und Studenten-Geräten erscheinen die Antwort-Buttons mit Einblende-Animation (Slide-Up, 200 ms).
      - Der Countdown beginnt (Story 3.5).
    - **Konfigurierbar:** Neues Quiz-Konfigurationsfeld `readingPhaseEnabled` (default: `true`).
      - Wenn `true`: Zwei-Phasen-Flow wie oben beschrieben.
      - Wenn `false`: „Nächste Frage" wechselt direkt zu `ACTIVE` (Frage + Antworten + Countdown gleichzeitig — bisheriges Verhalten).
    - Das Feature ist in beiden Presets (Story 1.11) konfiguriert: **Spielerisch** → `readingPhaseEnabled=false`, **Seriös** → `readingPhaseEnabled=true`.
    - **Security:** Während `QUESTION_OPEN` werden weder `isCorrect` noch die Antwortoptionen an Studenten gesendet — das DTO-Stripping (Story 2.4) greift bereits in dieser Phase.
    - **Barrierefreiheit:** Der Übergang von Phase 1 zu Phase 2 wird via `aria-live="polite"` angekündigt, damit Screenreader-Nutzer den Wechsel mitbekommen.
  - **Abhängigkeiten:** Story 2.3 (Steuerung), Story 2.4 (Security), Story 2.5 (Beamer), Story 3.3a (Frage empfangen), Story 3.5 (Countdown).
- **Story 2.7 (Peer Instruction – zweite Abstimmung, Vorher/Nachher):** ✅ Fertig – Als Dozent möchte ich die Methode **Peer Instruction** (Eric Mazur) umsetzen können: **Zwei Abstimmrunden** mit Zwischendiskussion, wobei die erste Runde für die Dauer der Session gespeichert und mit der zweiten Runde verglichen wird, damit der Lernerfolg durch Peer-Diskussion sichtbar wird.
  - **Hintergrund (Peer Instruction):** Konzeptfrage bzw. Abstimmungsthema stellen → **erste Abstimmung** (individuell) → kurze **Peer-Diskussion** (Sitznachbarn überzeugen) → **zweite Abstimmung** (revidierte Antwort) → Auflösung. Die Vergleichsanzeige Vorher/Nachher macht den Effekt der Diskussion deutlich.
  - **Zwei Anwendungsfälle:** (1) **Blitz-Feedback:** Peer Instruction erfolgt mit **zwei Blitz-Feedback-Runden** desselben Typs (z. B. Stimmungsbild, ja/nein/vielleicht oder ABCD): erste Runde starten → Ergebnis nicht auflösen, Hinweis „Diskutiert mit eurem Nachbarn“ → zweite Runde (gleicher Code/Session) → Vorher/Nachher-Anzeige. (2) **Quiz:** Optional bei MC/SC-Fragen zwei Abstimmrunden pro Frage mit Diskussionsphase dazwischen (wie unten).
  - **Akzeptanzkriterien:**
    - **Blitz-Feedback (Hauptfall):** In einer Blitz-Feedback-Session können **zwei Runden** derselben Abstimmung durchgeführt werden. Die **erste Runde** wird gespeichert; nach Aufforderung zur Diskussion (ohne Auflösung) startet der Dozent die **zweite Runde** (weiterhin derselbe Session-Code). Nach der zweiten Runde wird ein **Doppel-Balkendiagramm (Vorher/Nachher)** angezeigt. Beide Runden bleiben nur für die Dauer der Session gespeichert.
    - **Quiz (optional):** Der Dozent kann bei MC/SC-Fragen optional „Peer Instruction“ aktivieren. Dann: Zwei getrennte Abstimmphasen pro Frage; zwischen den Phasen keine Auflösung, nur Aufforderung zur Diskussion (z. B. „Tauscht euch mit eurem Nachbarn aus – zweite Abstimmung gleich.“).
    - **Erste Abstimmung:** Wie bisher (Story 3.3b) – Teilnehmende geben ihre erste Antwort ab. Diese **erste Runde** wird **pro Frage und Session** serverseitig gespeichert (z. B. `Vote.round = 1` oder separates Aggregat „Round1“). Nach Ende der ersten Runde wechselt die UI in eine **Diskussionsphase** (Beamer: Hinweis „Diskutiert mit eurem Nachbarn“; Teilnehmende sehen keine Auflösung).
    - **Zweite Abstimmung:** Dozent startet die zweite Runde (z. B. Button „Zweite Abstimmung“). Teilnehmende können **neu abstimmen** (ggf. gleiche oder geänderte Antwort). Zweite Runde wird ebenfalls gespeichert (`round = 2` bzw. „Round2“). Danach erfolgt die normale Auflösung (Ergebnis anzeigen, Story 4.4).
    - **Speicherdauer:** Die Daten der ersten Runde werden nur **für die Dauer der Session** vorgehalten (z. B. Redis/Prisma wie andere Votes). Nach Session-Ende (Story 4.2) werden sie mit gelöscht – kein dauerhafter Vergleich über Sessions hinweg.
    - **Anzeige Vorher/Nachher:** In der Ergebnisphase (`RESULTS`) wird bei Peer-Instruction-Fragen eine **Vergleichsdarstellung** angezeigt:
      - **Doppel-Balkendiagramm (oder vergleichbar):** Pro Antwortoption zwei Balken nebeneinander oder übereinander: **Vorher** (erste Runde) und **Nachher** (zweite Runde), z. B. farblich unterschieden (Vorher: dezent/grau, Nachher: kräftig/primary). So ist auf einen Blick sichtbar, wie sich die Verteilung durch die Diskussion geändert hat.
      - Alternative/Ergänzung: Zusätzliche Kennzahlen (z. B. „Richtig in Runde 1: 45 % → Runde 2: 72 %“) für schnelle Einordnung.
    - **Beamer & Dozenten-Steuerung:** Die Vorher/Nachher-Visualisierung erscheint in der Beamer-Ansicht (Story 2.5) und in der Dozenten-Ergebnisansicht. Barrierefrei: Balken mit `aria-label`/`role`, sinnvolle Kontraste (Story 6.5).
  - **Abhängigkeiten:** Story 2.3 (Steuerung), Story 2.5 (Beamer), Story 3.3b (Abstimmung), Story 4.4 (Ergebnis-Visualisierung), Story 4.2 (Session-Cleanup für Speicherdauer).

---

## Epic 3: Teilnahme & Abstimmung (Rolle: Student) ✅ abgeschlossen

- **Story 3.1 (Beitreten):** 🔴 Als Student möchte ich über die Eingabe des Session-Codes sofort und ohne Registrierung in die Quiz-Lobby gelangen.
  - **Akzeptanzkriterien:**
    - Eingabefeld für 6-stelligen Code.
    - Bei gültigem Code → Weiterleitung zur Lobby.
    - Bei ungültigem/abgelaufenem Code → Fehlermeldung.
- **Story 3.2 (Nicknames):** 🟡 Als Student möchte ich einen Nicknamen aus einer themenbezogenen Liste auswählen oder (falls erlaubt) frei eingeben können.
  - **Akzeptanzkriterien:**
    - Der Dozent wählt in der Quiz-Konfiguration ein Nickname-Thema (`nicknameTheme`):
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
- **Story 3.6 (Anonymer Modus):** 🟡 Als Dozent möchte ich einen anonymen Modus aktivieren können, bei dem keine Nicknames angezeigt werden, damit die Teilnahme psychologisch druckfrei ist.
  - **Akzeptanzkriterien:**
    - Neues Quiz-Konfigurationsfeld `anonymousMode` (default: false; wird automatisch durch Preset „Seriös" aktiviert, Story 1.11).
    - Wenn aktiviert:
      - Studenten erhalten beim Beitreten eine automatisch generierte ID (z.B. „Teilnehmer #7") — kein Nickname-Auswahlschritt.
      - In der Lobby (Story 2.2) wird nur die **Teilnehmerzahl** angezeigt, keine Namensliste.
      - Im Leaderboard (Story 4.1) und auf der Beamer-Ansicht werden **keine** individuellen Einträge angezeigt — nur aggregierte Ergebnisse (Durchschnittspunkte, Verteilung der richtigen Antworten).
      - Die persönliche Scorecard (Story 5.6) wird trotzdem auf dem eigenen Gerät angezeigt (ist privat).
    - Wenn deaktiviert: Nickname-Auswahl wie gewohnt (Story 3.2).
    - DSGVO-Vorteil: Im anonymen Modus werden keine pseudonymisierten Daten erhoben — vollständig datensparsam.
- **Story 3.3a (Frage empfangen):** 🔴 Als Student möchte ich die aktuell freigegebene Frage auf meinem Gerät in Echtzeit sehen.
  - **Akzeptanzkriterien:**
    - tRPC-Subscription `session.onQuestionRevealed` pusht die aktuelle Frage.
    - **Lesephase (`QUESTION_OPEN`, Story 2.6):** Nur der Fragenstamm wird angezeigt (`QuestionPreviewDTO`, ohne Antwortoptionen). Antwort-Buttons und Countdown sind ausgeblendet. Hinweistext: „Lies die Frage — Antworten folgen gleich."
    - **Antwortphase (`ACTIVE`):** Die Antwortoptionen werden eingeblendet, der Countdown startet. Die vollständige Frage wird als `QuestionStudentDTO` (ohne `isCorrect`) angezeigt.
    - Wenn `readingPhaseEnabled=false`: Die Lesephase entfällt — die Frage wird sofort mit Antwortoptionen angezeigt (bisheriges Verhalten).
    - Fragenstamm und Antwortoptionen werden mit Markdown & KaTeX korrekt gerendert (siehe Story 1.7).
- **Story 3.3b (Abstimmung abgeben):** 🔴 Als Student möchte ich performant abstimmen können.
  - **Akzeptanzkriterien:**
    - tRPC-Mutation `vote.submit` nimmt die Stimme entgegen.
    - Nur eine Stimme pro Frage und Teilnehmer (DB-Constraint).
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
- **Story 3.4 (Echtzeit-Feedback):** 🟡 Als Student möchte ich nach der Auflösung durch den Dozenten sofort sehen, ob meine Antwort richtig war.
  - **Akzeptanzkriterien:**
    - tRPC-Subscription `session.onResultsRevealed` sendet die korrekten Antworten.
    - Eigene Antwort wird grün (richtig) oder rot (falsch) markiert.
    - `isCorrect` wird erst NACH expliziter Auflösung durch den Dozenten übertragen (Statuswechsel `ACTIVE → RESULTS`). Dies steht nicht im Widerspruch zu Story 2.4, die das Stripping nur während der Frage-Phase (`ACTIVE`) fordert.
- **Story 3.5 (Countdown-Anzeige):** 🔴 Als Student möchte ich einen gut sichtbaren Countdown-Zähler auf meinem Gerät sehen, damit ich weiß, wie viel Zeit mir noch bleibt.
  - **Akzeptanzkriterien:**
    - Der Countdown startet erst mit dem Statuswechsel zu `ACTIVE` (d. h. nach der Lesephase, Story 2.6). Während `QUESTION_OPEN` wird **kein** Countdown angezeigt.
    - Countdown wird als großer, zentraler Zähler auf dem Client-Gerät (Smartphone) angezeigt.
    - Auf der Beamer-Ansicht (Dozent) wird der Countdown zusätzlich als Kreisdiagramm / Fortschrittsbalken dargestellt.
    - Countdown synchronisiert sich über den Server-Timestamp (kein Client-Drift).
    - Die letzten 5 Sekunden werden visuell hervorgehoben (rot, pulsierend).
    - Nach Ablauf wird die Eingabe automatisch gesperrt.
    - Falls kein Timer gesetzt ist, wird kein Countdown angezeigt (offene Antwortphase, Dozent beendet manuell).
- **Story 3.5a (Countdown Finger-Anzeige, letzte 6 Sekunden):** 🟡 Als Dozent/Teilnehmende möchte ich in den letzten 6 Sekunden des Countdowns die animierte Finger-Countdown-Anzeige (5 → 0) sehen, damit der Zeitablauf spielerisch und einheitlich sichtbar ist.
  - **Akzeptanzkriterien:**
    - Sobald der Countdown die letzten 6 Sekunden erreicht, wird die Finger-Countdown-Animation (wie im Preset-Toast „Spielerisch“) eingeblendet.
    - **Beamer-Ansicht (Story 2.5):** Die Animation wird in **Vollansicht** (groß, zentral oder prominent) angezeigt, sodass sie im Saal gut erkennbar ist.
    - **Client-Geräte (Teilnehmende):** Die Animation wird **klein** (wie auf dem Preset-Toast) in der **unteren linken Ecke** angezeigt, ohne die Antwort-Buttons oder den restlichen Countdown zu überdecken.
    - Dauer der Animation: exakt 6 Sekunden (1 Sekunde pro Frame 5 → 4 → 3 → 2 → 1 → 0), synchron mit dem restlichen Countdown.
    - Nur anzeigen, wenn ein Timer gesetzt ist und das Preset „Spielerisch“ aktiv ist (oder eine optionale Einstellung „Finger-Countdown“ an).
    - Bei `prefers-reduced-motion` kann die Animation durch einen statischen Zähler oder dezente Anzeige ersetzt werden.
  - **Abhängigkeiten:** Story 3.5 (Countdown-Anzeige), Story 2.5 (Beamer-Ansicht), Preset „Spielerisch“ / Countdown-Asset (countdown-fingers.gif bzw. transparente Einzelbilder).

---

## Epic 4: Auswertung & Aufräumen (System & Dozent)

- **Story 4.1 (Leaderboard mit Punktesystem):** ✅ Als Dozent möchte ich am Ende des Quizzes ein differenziertes Ranking sehen, das Schwierigkeit und Antwortgeschwindigkeit berücksichtigt.
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
- **Story 4.2 (Server aufräumen):** ✅ Als System möchte ich, dass die flüchtigen Abstimmungsdaten (Redis) vom Server gelöscht werden, sobald der Dozent die Live-Session beendet.
  - **Akzeptanzkriterien:**
    - `session.end`-Mutation setzt Status auf `FINISHED` und löscht Redis-Keys.
    - Votes bleiben in PostgreSQL für spätere Leaderboard-Auswertung erhalten.
    - Automatisches Cleanup nach 24h für nicht beendete Sessions.
- **Story 4.3 (WebSocket Reconnection):** ✅ Als System möchte ich, dass abgebrochene WebSocket-Verbindungen automatisch wiederhergestellt werden.
  - **Akzeptanzkriterien:**
    - Frontend erkennt Verbindungsabbruch und zeigt Hinweis an.
    - Automatischer Reconnect-Versuch (Exponential Backoff).
    - Nach Reconnect wird der aktuelle Session-Zustand synchronisiert.
- **Story 4.4 (Ergebnis-Visualisierung):** ✅ Als Dozent möchte ich die Abstimmungsergebnisse nach jeder Frage als anschauliche Grafik auf dem Beamer sehen.
  - **Akzeptanzkriterien:**
    - **MC/SC-Fragen:** Horizontales Balkendiagramm — ein Balken pro Antwortoption, Länge proportional zur Anzahl Votes, absolute Zahl + Prozentwert als Label.
    - Korrekte Antworten werden nach Auflösung grün hervorgehoben, falsche rot (+ Icons ✓/✗ für Farbunabhängigkeit, Story 6.5).
    - **SURVEY-Fragen:** Gleiches Balkendiagramm, aber ohne Farbmarkierung (kein richtig/falsch).
    - **FREETEXT-Fragen:** Antworten werden als scrollbare Liste angezeigt; bei ≥ 10 identischen Antworten zusätzlich als Wordcloud (Story 4.5).
    - Animation: Balken wachsen von 0 auf Endwert (300 ms ease-out). Bei `prefers-reduced-motion` wird die Animation übersprungen.
    - Diagramm skaliert responsive (Mobile: vertikal gestapelt, Beamer: horizontal).
    - Wird sowohl in der Beamer-Ansicht (Story 2.5) als auch auf den Studenten-Geräten angezeigt.
- **Story 4.5 (Freitext-Auswertung):** ✅ Als Dozent möchte ich die eingegangenen Freitext-Antworten gebündelt einsehen können, um offene Fragen auszuwerten.
  - **Akzeptanzkriterien:**
    - Alle Freitext-Antworten werden in einer sortierbaren Liste angezeigt (alphabetisch / nach Häufigkeit).
    - Identische oder sehr ähnliche Antworten werden gruppiert mit Anzahl-Badge.
    - Bei ≥ 10 eindeutigen Antworten wird eine Wordcloud als alternative Darstellung angeboten.
    - Der Dozent kann einzelne Antworten auf dem Beamer hervorheben (Klick → vergrößerte Anzeige).
    - Datenschutz: Freitext-Antworten werden **nicht** mit Nicknames verknüpft dargestellt (anonyme Auswertung, konsistent mit DSGVO-Prinzip der Datensparsamkeit).
- **Story 4.6 (Bonus-Code für Top-Platzierungen):** ✅ Als Dozent möchte ich den besten Studenten im Leaderboard einen individuellen Bonus-Code ausstellen können, den diese per E-Mail zur Einlösung von Bonuspunkten oder Anerkennung durch die Lehrperson einreichen, damit herausragende Leistungen belohnt werden — ohne die Anonymität der restlichen Teilnehmer zu gefährden.
  - **Hinweis Wording:** In der gesamten UI wird „Bonus-Code“ bzw. „Code“ verwendet (nicht „Token“); technisch bleibt das Datenmodell `BonusToken`/`bonusTokenCount` unverändert.
  - **Akzeptanzkriterien:**
    - In der Quiz-Konfiguration (Story 1.4) gibt es ein neues optionales Feld `**bonusTokenCount`** (`Int?, 1–50, default: null`). Wenn gesetzt, erhalten die Top X im finalen Leaderboard automatisch einen Code.
    - **Code-Generierung (serverseitig):**
      - Beim Beenden der Session (`session.end`) werden für die Top X Plätze kryptografisch sichere, einmalige Codes generiert (`crypto.randomUUID()` oder `nanoid`, 12 Zeichen, z. B. `BNS-A3F7-K2M9`).
      - Jeder Code wird als `BonusToken`-Datensatz in PostgreSQL gespeichert mit: `token`, `sessionId`, `participantId`, `nickname` (Snapshot), `quizName` (Snapshot), `totalScore`, `rank`, `generatedAt`.
      - Codes sind nach Generierung unveränderlich (kein Update, keine Regeneration).
    - **Studenten-Ansicht:**
      - Die Top-X-Studenten sehen auf ihrer finalen Scorecard (Story 5.6) zusätzlich einen hervorgehobenen Bereich: **„🎓 Dein Bonus-Code: `BNS-A3F7-K2M9`"**.
      - Ein „Kopieren"-Button kopiert den Code in die Zwischenablage (`navigator.clipboard.writeText`).
      - Ein erklärender Hinweis: *„Sende diesen Code per E-Mail an deinen Dozenten, um Bonuspunkte zu erhalten. Deine Anonymität bleibt gewahrt, solange du den Code nicht einreichst."*
      - Der Code wird **nur** dem jeweiligen Studenten angezeigt (individuell per tRPC-Subscription `session.onPersonalResult`, kein Broadcast).
      - Studenten, die nicht in den Top X sind, sehen keinen Bonus-Code-Bereich.
    - **Dozenten-Ansicht (Bonus-Code-Liste):**
      - Nach Beendigung der Session kann der Dozent über einen neuen tRPC-Query `**session.getBonusTokens({ sessionId })`** die vollständige Liste der ausgegebenen Codes abrufen.
      - Die Liste enthält pro Eintrag: Code, Pseudonym (Nickname), Quiz-Name, erreichte Punkte, Ranking-Platz, Datum.
      - Die Liste ist als Tabelle dargestellt und kann als **CSV exportiert** werden (clientseitiger Download).
      - Der Dozent sieht **keine** echten Namen oder E-Mail-Adressen — nur Pseudonyme.
    - **Verifizierungs-Workflow (außerhalb der App):**
      - Studenten senden ihren Code per E-Mail an den Dozenten.
      - Der Dozent gleicht den Code mit der CSV-/Tabellenliste ab und schreibt anhand der Absender-Mailadresse Bonuspunkte gut.
      - Die App selbst speichert keine E-Mail-Adressen (DSGVO-konform, Prinzip der Datensparsamkeit).
    - **Anonymitätsgarantie:**
      - Die Zuordnung Code → reale Person ist **nur** möglich, wenn der Student seinen Code freiwillig per E-Mail einreicht.
      - Studenten, die nicht einreichen, bleiben vollständig anonym — auch gegenüber dem Dozenten.
      - Im anonymen Modus (Story 3.6) werden Codes dennoch generiert (Pseudonym = „Teilnehmer #7"), da die Einreichung per E-Mail die freiwillige De-Anonymisierung darstellt.
    - **Gültigkeit & Cleanup:**
      - Bonus-Codes (BonusToken-Datensätze) bleiben 90 Tage in der Datenbank gespeichert, danach werden sie automatisch gelöscht (Erweiterung von Story 4.2).
      - Codes sind nicht übertragbar — der Dozent prüft den Absender der E-Mail eigenverantwortlich.
    - **Abhängigkeiten:** Story 4.1 (Leaderboard), Story 5.6 (Persönliche Scorecard).
- **Story 4.7 (Ergebnis-Export für Dozenten – anonym):** ✅ Als Dozent möchte ich nach Ende einer Session die Auswertung anonym als Datei (CSV/PDF) herunterladen können, damit ich die Ergebnisse für Nachbereitung, Lehrevaluation oder Akkreditierung nutzen kann — ohne personenbezogene Daten.
  - **Akzeptanzkriterien:**
    - Nach Beendigung der Session (Status `FINISHED`) steht in der Dozenten-Ansicht ein Button **„Ergebnis exportieren“** zur Verfügung.
    - **CSV-Export (mindestens):** Enthält pro Zeile aggregierte Daten, z. B.: Session-ID, Quiz-Name, Datum, pro Frage: Fragentext (Kurz), Fragentyp, Anzahl Teilnehmer, Verteilung der Antworten (Anzahl pro Option bzw. bei Freitext: aggregierte Begriffe/Häufigkeiten), Durchschnittspunktzahl pro Frage, keine Nicknames und keine personenbezogenen Daten.
    - Optional: **PDF-Export** mit gleichen Inhalten in lesbarer Form (z. B. Deckblatt, pro Frage eine Seite mit Balkendiagramm-Beschreibung oder Word-Cloud-Text).
    - Bonus-Code-Liste (Story 4.6) kann in den Export einbezogen werden (Code, Rang, Punkte, Pseudonym) — entspricht der bereits in Story 4.6 beschriebenen CSV-Funktion; kein Widerspruch zur Anonymität, da Zuordnung nur über freiwillige E-Mail-Einreichung.
    - Export erfolgt clientseitig (Generierung im Browser) oder über einen tRPC-Query, der nur aggregierte/anonymisierte Daten zurückgibt; keine Speicherung der Export-Datei auf dem Server.
    - **tRPC & Schemas (bei serverseitiger Variante):** Query `session.getExportData` mit `GetExportDataInputSchema` (sessionId); Rückgabe `SessionExportDTO` (sessionId, sessionCode, quizName, finishedAt, participantCount, questions[], bonusTokens?). Siehe `libs/shared-types/src/schemas.ts` (SessionExportDTOSchema, QuestionExportEntrySchema, OptionDistributionEntrySchema, FreetextAggregateEntrySchema).
    - DSGVO: Export enthält ausschließlich anonymisierte bzw. aggregierte Daten; Hinweis in der UI: „Export für Dokumentation und Evaluation – keine personenbezogenen Daten“.
    - Abhängigkeiten: Story 4.1 (Leaderboard), Story 4.4 (Ergebnis-Visualisierung), Story 4.5 (Freitext-Auswertung), Story 4.6 (Bonus-Code-Liste).
- **Story 4.8 (Session-Bewertung durch Teilnehmende):** ✅ Als Teilnehmende möchte ich am Ende einer Session das Quiz bewerten können (z. B. Qualität der Fragen, hat mir gefallen, sollen wir solche Quizze regelmäßig machen?), damit Dozent und alle Beteiligten ein gemeinsames Stimmungsbild sehen.
  - **Akzeptanzkriterien:**
    - Nach Beendigung der Session (Status `FINISHED`) können Teilnehmende auf ihrem Gerät eine **kurze Bewertung** abgeben (einmalig pro Person pro Session).
    - **Aufforderung zur Teilnahme:** Auf dem Teilnehmenden-Gerät erscheint eine deutliche Einladung, das Quiz zu bewerten und sich an der Umfrage zu beteiligen (z. B. „Deine Meinung zählt — bewerte das Quiz“ bzw. „Beteilige dich an der Umfrage“). Auf der Beamer-Ansicht kann der Dozent optional einen ähnlichen Aufruf anzeigen (z. B. „Jetzt abstimmen: Wie hat euch das Quiz gefallen?“), um die Beteiligung zu steigern.
    - **Bewertung per Sterne oder aufsteigende Emojis:** Die Bewertung erfolgt über **Sterne** (z. B. 1–5 Sterne) oder **aufsteigende Emojis** (z. B. 😞 → 🙂 → 😊), nicht über lange Skalen oder viele Einzelfragen. Mindestens: „Wie hat dir das Quiz gefallen?“ (Sterne/Emojis); optional „Qualität der Fragen?“ und „Sollen wir solche Quizze regelmäßig durchführen?“ (ebenfalls Sterne/Emojis). **Keine Freitext-Box** — nur vordefinierte Sterne/Emojis (vermindert Missbrauch).
    - Die **aggregierte Auswertung** (Durchschnitte, Verteilungen) ist **für alle sichtbar**: Dozent sieht sie in der Steuerungs- und Beamer-Ansicht, Teilnehmende sehen sie auf ihrem Gerät (z. B. nach Abgabe oder auf Knopfdruck „Ergebnis anzeigen“). Keine personenbezogene Zuordnung — nur Summen und Häufigkeiten.
    - Im Preset **Spielerisch** kann die Session-Bewertung prominent angeboten werden (z. B. direkt nach „Quiz beendet“); im Preset **Seriös** optional oder dezenter (z. B. Link „Feedback geben“).
    - **Datenmodell:** Neue Entität oder Erweiterung (z. B. `SessionFeedback` mit sessionId, participantId optional anonym, Bewertungsitems, aggregierte Auswertung serverseitig berechnet). Speicherung nur bis zum Session-Cleanup (Story 4.2); Export in Story 4.7 kann Session-Bewertung anonym mit einbeziehen.
    - **tRPC:** Mutation zum Abgeben der Bewertung (z. B. `session.submitSessionFeedback`); Query oder Subscription für aggregierte Bewertung (z. B. `session.getSessionFeedbackSummary`), für Dozent und Teilnehmende gleichermaßen abrufbar.
    - Abhängigkeiten: Story 4.2 (Session-Ende/Cleanup), Story 4.4 (Ergebnis-Visualisierung für Darstellung der Auswertung).

---

## Epic 5: Gamification & Audio-Effekte (Rolle: Dozent & Student) ✅ abgeschlossen

> **Tag:** `epic-5` · UX-Verbesserungen (Phasen-Labels, Lesephase-Banner, Letzte-Frage-Hinweis, Richtig-Badge, KaTeX-Scrollbar, Join/Diskussion) sind in den Session-Features integriert.

- **Story 5.1 (Sound-Effekte):** 🟡 Als Dozent möchte ich, dass bei bestimmten Quiz-Events automatisch Sound-Effekte abgespielt werden, um die Atmosphäre im Hörsaal zu steigern.
  - **Akzeptanzkriterien:**
    - Ein Gong/Pfiff ertönt, wenn das Quiz endet (`SessionStatus.FINISHED`).
    - Ein kurzer Sound signalisiert den Start einer neuen Frage (`SessionStatus.ACTIVE`).
    - Ein Tick-Sound begleitet die letzten 5 Sekunden des Countdowns.
    - Der Dozent kann Sounds global an/aus schalten (Quiz-Konfiguration `enableSoundEffects`, default: an).
    - Sound-Dateien liegen unter **`apps/frontend/src/assets/sound`** und werden als statische Assets gebundelt (kein Server-Roundtrip).
    - Sounds werden über die Web Audio API abgespielt und respektieren die Browser-Autoplay-Policy (erster Klick aktiviert Audio-Context).
- ~~**Story 5.2~~ → verschoben nach Story 3.5** *(Countdown-Anzeige gehört zur Kern-Abstimmung, nicht zur Gamification — siehe Epic 3)*
- **Story 5.3 (Hintergrundmusik):** 🟢 Als Dozent möchte ich eine Hintergrundmusik während der Lobby- und Countdown-Phase abspielen können, um eine spielerische Stimmung zu erzeugen.
  - **Akzeptanzkriterien:**
    - Der Dozent kann aus mindestens 3 vordefinierten Musik-Tracks wählen (z.B. "Entspannt", "Spannend", "Episch").
    - Musik wird nur auf dem Beamer/Dozenten-Gerät abgespielt, **nicht** auf den Smartphones der Studenten.
    - Musik stoppt automatisch, wenn eine Frage aufgelöst wird (`SessionStatus.RESULTS`).
    - Lautstärkeregler (0–100 %) in der Dozenten-Ansicht.
    - Musik-Dateien liegen unter **`apps/frontend/src/assets/sound`** (z.B. `lobby/`), sind lizenzfrei und werden als Assets gebundelt.
    - Konfigurierbar pro Quiz (`backgroundMusic: string | null`).
- **Story 5.4 (Belohnungseffekte bei Platzierung):** 🟡 Als Student möchte ich bei einer vorderen Platzierung im Leaderboard eine visuelle Belohnung sehen, damit der Wettbewerb motivierend wird.
  - **Akzeptanzkriterien:**
    - **Platz 1:** Konfetti-Animation + Gold-Pokal-Icon + Fanfare-Sound.
    - **Platz 2:** Silber-Medaillen-Icon + kurzer Jubel-Sound.
    - **Platz 3:** Bronze-Medaillen-Icon + kurzer Applaus-Sound.
    - Animationen werden per CSS-Keyframes / Canvas (`canvas-confetti`) realisiert – keine schweren Libraries.
    - Effekte werden sowohl auf dem Beamer als auch auf den Smartphones der Top-3 angezeigt.
    - Effekte können vom Dozenten deaktiviert werden (`enableRewardEffects`, default: an).
    - Bei `prefers-reduced-motion: reduce` werden Animationen deaktiviert; nur statische Icons und Text werden angezeigt (konsistent mit Story 6.5).
    - Abhängig von Story 4.1 (Leaderboard).
- **Story 5.5 (Answer Streak — Serienbonus):** 🟡 Als Student möchte ich für aufeinanderfolgende richtige Antworten einen steigenden Bonus erhalten, damit ich für Konstanz belohnt werde.
  - **Akzeptanzkriterien:**
    - Für jede weitere korrekte Antwort in Folge steigt der Streak-Zähler: 2er-Streak = ×1.1, 3er-Streak = ×1.2, 4er-Streak = ×1.3, 5+ = ×1.5 (Multiplikator auf den Frage-Score).
    - Bei einer falschen Antwort oder keiner Antwort wird der Streak auf 0 zurückgesetzt.
    - **Formel:** `finalScore = score × streakMultiplier` (der `score` aus Story 4.1 wird mit dem Streak-Faktor multipliziert).
    - FREETEXT- und SURVEY-Fragen unterbrechen den Streak **nicht** (sie werden übersprungen).
    - Der aktuelle Streak-Zähler wird auf der persönlichen Scorecard (Story 5.6) angezeigt.
    - Auf dem Beamer wird bei Streaks ≥ 3 ein Flammen-Icon (🔥) neben dem Nickname im Leaderboard-Zwischenstand angezeigt.
    - Streak-Daten werden serverseitig berechnet (kein Client-Vertrauen) und im `Vote`-Modell als `streakCount` gespeichert.
- **Story 5.6 (Persönliche Scorecard):** 🔴 Als Student möchte ich nach jeder Frage eine persönliche Ergebniskarte auf meinem Smartphone sehen, die mir zeigt, wie ich abgeschnitten habe.
  - **Akzeptanzkriterien:**
    - Nach der Auflösung (Status `RESULTS`) wird auf dem Studenten-Gerät eine Scorecard eingeblendet mit:
      - Ergebnis: ✓ Richtig / ✗ Falsch (+ korrekte Antwort bei Falsch).
      - Punkte für diese Frage (Score + Streak-Bonus aufgeschlüsselt).
      - Aktueller Streak-Zähler mit Flammen-Animation bei ≥ 3 (🔥).
      - Aktueller Rang im Leaderboard + Rangveränderung seit der letzten Frage (z.B. „↑ 3 Plätze", „↓ 1 Platz", „— gleich").
      - Gesamtpunktzahl bisher.
    - Die Scorecard wird als Overlay/Bottom-Sheet angezeigt und verschwindet automatisch, wenn die nächste Frage beginnt.
    - Bei SURVEY/FREETEXT-Fragen: Scorecard zeigt nur „Antwort registriert" + aktuellen Rang (keine Punkte).
    - tRPC-Subscription `session.onPersonalResult` liefert die Daten individuell pro Participant (kein Broadcast der Einzelergebnisse an alle).
- **Story 5.7 (Motivationsmeldungen):** 🟡 Als Student möchte ich kontextbezogene Motivationsmeldungen auf meiner Scorecard sehen, die mich anfeuern.
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
    - Der Dozent kann Motivationsmeldungen global an/aus schalten (Quiz-Konfiguration, neues Feld `enableMotivationMessages`, default: an).
- **Story 5.8 (Emoji-Reaktionen in Ergebnis-Phase):** 🟢 Als Student möchte ich in der Ergebnis-Phase mit Emoji-Reaktionen reagieren können, um die Stimmung im Hörsaal zu äußern.
  - **Akzeptanzkriterien:**
    - Nach der Auflösung (Status `RESULTS`) erscheint auf dem Studenten-Gerät eine Emoji-Leiste mit 5 vordefinierten Reaktionen: 👏 🎉 😮 😂 😢.
    - Ein Tap auf ein Emoji sendet die Reaktion an den Server (tRPC-Mutation `session.react`).
    - Auf der Beamer-Ansicht (Story 2.5) werden eingehende Reaktionen als aufsteigende Emoji-Blasen am rechten Bildschirmrand animiert (ähnlich Instagram Live).
    - Maximal 1 Reaktion pro Student pro Frage (Entprellung).
    - Reaktionen werden **nicht** persistiert (nur Redis/In-Memory, flüchtig).
    - Emoji-Reaktionen können vom Dozenten deaktiviert werden (Quiz-Konfiguration, neues Feld `enableEmojiReactions`, default: an).
    - Bei `prefers-reduced-motion` werden Blasen ohne Animation angezeigt (statische Liste statt Aufsteigen).

---

## Epic 6: Theming & Barrierefreiheit (Rolle: Alle Nutzer) — als Nächstes

Epic 6 bündelt **Theming, Internationalisierung, rechtliche Pflichtseiten, Mobile-First und Barrierefreiheit**. Alle Stories zielen auf Nutzer:innen aller Rollen (Dozent, Student, Gast). Keine Abhängigkeit von Epic 5; kann parallel ab Epic 0 umgesetzt werden.

**Stand:** Stories 6.1 (Theme), 6.2 (i18n), 6.3 (Impressum/Datenschutz) und 6.4 (Mobile-First/PWA) sind umgesetzt; Akzeptanzkriterien geprüft (siehe `docs/EPIC6-AC-PRUEFUNG.md`). **6.5 (Barrierefreiheit)** wird ans Projektende zur Prüfung gestellt (MD3/Angular-Komponenten decken vieles ab; finale WCAG-Prüfung dann).

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
    - Quiz-Inhalte (Fragenstamm, Antworten) werden **nicht** übersetzt — sie bleiben in der vom Dozenten eingegebenen Sprache.
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
- **Story 6.4 (Mobile-First & Responsive Design):** 🔴 Als Student möchte ich die App auf meinem Smartphone komfortabel bedienen können, da ich im Hörsaal primär mein Handy nutze.
  - **Akzeptanzkriterien:**
    - Alle Ansichten werden **Mobile-First** entwickelt: Basis-Layout für Smartphones (≤ 640px), erweitert für Tablets (≥ 768px) und Desktop/Beamer (≥ 1024px).
    - Responsive Breakpoints (640px, 768px, 1024px, 1280px) werden konsequent genutzt — keine festen Pixelbreiten.
    - Touch-Targets (Buttons, Antwortoptionen) sind mindestens 44×44px groß (Apple HIG / WCAG 2.5.5).
    - Abstimmungsbuttons sind auf Smartphones als vollbreite, gestapelte Karten dargestellt (einfaches Antippen).
    - Beamer-Ansicht des Dozenten nutzt die volle Breite (`lg`+) mit großer Schrift, Countdown und Leaderboard.
    - Kein horizontales Scrollen auf Viewports ≥ 320px.
    - Viewport-Meta-Tag ist korrekt gesetzt (`width=device-width, initial-scale=1`).
    - PWA-fähig: `manifest.json` mit Icon-Set, damit die App zum Homescreen hinzugefügt werden kann.
  - **Verifizierung:** Viewport-Meta, `check-viewport-320.mjs`, Touch 44px, `manifest.webmanifest` mit Icons; Breakpoints teils 600px (Backlog 640px).
- **Story 6.5 (Barrierefreiheit / Accessibility):** 🔴 Als Nutzer mit Einschränkungen möchte ich die App vollständig per Tastatur, Screenreader und assistive Technologien bedienen können. *(Zur Prüfung ans Projektende gestellt — MD3/Angular decken Großteil ab.)*
  - **Akzeptanzkriterien:**
    - **Tastaturnavigation:** Alle interaktiven Elemente (Buttons, Inputs, Antwortoptionen, Dropdown-Menüs) sind per `Tab`-Taste erreichbar und per `Enter`/`Space` aktivierbar.
    - **Fokus-Management:** Ein sichtbarer Fokusring (`focus-visible`) ist auf allen interaktiven Elementen vorhanden. Nach Seitenwechsel, Modal-Öffnung oder Theme-/Sprachumschaltung auf der Startseite wird der Fokus programmatisch auf das erste relevante Element (z. B. Session-Code-Eingabe) gesetzt.
    - **Screenreader-Support:** Alle Bilder haben `alt`-Texte, alle Icons haben `aria-label`. Dynamische Statusänderungen (Countdown, Teilnehmerzahl, Antwort-Feedback) werden über `aria-live`-Regionen kommuniziert.
    - **Semantisches HTML:** Überschriften-Hierarchie (`h1`–`h6`) ist korrekt. Formulare nutzen `<label>`-Elemente mit `for`-Attribut. Listen nutzen `<ul>`/`<ol>`.
    - **ARIA-Rollen:** Custom-Komponenten (Theme-Switcher, Sprachwähler, Quiz-Steuerung) verwenden korrekte ARIA-Rollen (`role="tablist"`, `role="dialog"`, etc.).
    - **Farbunabhängigkeit:** Richtig/Falsch-Feedback nutzt neben Farbe (grün/rot) auch Icons (✓/✗) und Text, damit farbenblinde Nutzer es erkennen können.
    - **Schriftgröße:** Text ist bis 200% Browser-Zoom ohne Layoutbruch lesbar.
    - **Reduzierte Bewegung:** Bei `prefers-reduced-motion: reduce` werden Animationen (Konfetti, Pulsen, Countdowns) deaktiviert oder stark reduziert.
    - **Zielstandard:** WCAG 2.1 Level AA für alle öffentlich zugänglichen Ansichten.

---

## Epic 7: Team-Modus (Rolle: Dozent & Student)

- **Story 7.1 (Team-Modus):** 🟢 Als Dozent möchte ich optional einen Team-Modus aktivieren können, bei dem Studenten in Gruppen gegeneinander antreten.
  - **Akzeptanzkriterien:**
    - In der Quiz-Konfiguration (Story 1.4) gibt es ein neues Feld `teamMode` (default: aus).
    - Wenn aktiviert, definiert der Dozent die Anzahl der Teams (2–8) und optional Team-Namen (default: „Team A", „Team B", …).
    - Beim Beitreten (Story 3.1) wird jeder Student automatisch einem Team zugewiesen (Round-Robin) oder wählt ein Team aus einer Liste (konfigurierbar via `teamAssignment: 'AUTO' | 'MANUAL'`).
    - **Team-Leaderboard:** Neben dem individuellen Leaderboard (Story 4.1) wird ein Team-Leaderboard angezeigt — Gesamtpunkte des Teams = Summe aller Mitglieder-Scores.
    - Auf der Beamer-Ansicht werden Teams mit farbigen Bannern und kumulierten Balkendiagrammen dargestellt.
    - Team-Belohnungseffekte (Story 5.4): Das Gewinnerteam erhält eine kollektive Konfetti-Animation.
    - Prisma-Modell `Team` verknüpft `Session` ↔ `Participant` (n:m via Team).
    - DSGVO: Team-Zugehörigkeit wird nur temporär für die Session vorgehalten (wie alle Session-Daten).

---

## Epic 8: Q&A-Modus (Rolle: Dozent & Student) 🟢

- **Story 8.1 (Q&A-Session starten):** 🟢 Als Dozent möchte ich eine Q&A-Session starten können, in der Studenten Fragen stellen und die besten Fragen hochvoten können — als interaktive Alternative zur klassischen Fragenrunde.
  - **Akzeptanzkriterien:**
    - Neuer Session-Typ `Q_AND_A` (neben dem regulären Quiz-Modus) — auswählbar beim Live-Schalten.
    - Der Dozent legt optional einen Titel / ein Thema für die Q&A-Runde fest.
    - Studenten treten über den gleichen Session-Code bei (Story 3.1).
    - Session-Status: `LOBBY → ACTIVE → FINISHED` (kein `PAUSED`/`RESULTS`).
    - Prisma: Neues Enum `SessionType` (`QUIZ` / `Q_AND_A`), neues Feld `Session.type`, `Session.title`, `Session.moderationMode`. `Session.quizId` wird optional (null bei Q&A).
- **Story 8.2 (Fragen einreichen):** 🟢 Als Student möchte ich eine Frage an den Dozenten einreichen können.
  - **Akzeptanzkriterien:**
    - Eingabefeld für Freitext (max. 500 Zeichen) + „Absenden"-Button.
    - Fragen werden anonym eingereicht (kein Nickname sichtbar) — konsistent mit dem seriösen Modus (Story 3.6).
    - Markdown wird in Fragen unterstützt (Story 1.7).
    - Maximal 3 Fragen pro Student pro Session (Spam-Schutz).
    - Fragen erscheinen sofort auf der Beamer-Ansicht und auf allen Studenten-Geräten.
- **Story 8.3 (Upvoting & Sortierung):** 🟢 Als Student möchte ich die Fragen anderer Studenten upvoten können, damit die relevantesten Fragen nach oben wandern.
  - **Akzeptanzkriterien:**
    - Jede Frage hat einen Upvote-Button (👍 / ▲) mit aktueller Stimmenanzahl.
    - Maximal 1 Upvote pro Student pro Frage (Toggle: erneuter Tap entfernt den Upvote).
    - Fragen werden in Echtzeit nach Upvote-Anzahl sortiert (höchste zuerst).
    - tRPC-Subscription `qa.onQuestionsUpdated` pusht die aktuelle Fragenliste.
    - Prisma: Neues Modell `QaUpvote` mit `@@unique([qaQuestionId, participantId])` für Upvote-Toggle.
- **Story 8.4 (Dozenten-Moderation):** 🟢 Als Dozent möchte ich eingereichte Fragen moderieren können.
  - **Akzeptanzkriterien:**
    - Der Dozent kann Fragen:
      - **Hervorheben** (Pin) — fixiert die Frage oben auf der Beamer-Ansicht als „Wird gerade beantwortet".
      - **Archivieren** — entfernt die Frage aus der aktiven Liste (als „Beantwortet" markiert).
      - **Löschen** — entfernt unangemessene Fragen (nur für Dozent sichtbar).
    - Optional: Vorab-Moderation — Fragen erscheinen erst nach Freigabe durch den Dozenten (`moderationMode: boolean`, default: aus).
    - Prisma: Neues Modell `QaQuestion` mit Feldern `id`, `sessionId`, `participantId` (Autor, für 3-Fragen-Limit), `text`, `upvoteCount`, `status` (PENDING/ACTIVE/PINNED/ARCHIVED/DELETED), `createdAt`.

---

## Epic 9: Admin (Rechtliche & operative Kontrolle)

> **Rolle:** Admin/Betreiber (z. B. Plattform-Betreiber, Support, rechtliche Verantwortliche).  
> **Hintergrund:** Die App ist accountfrei für Dozenten und Teilnehmer. Auf dem Server liegen jedoch alle **live geschalteten** Sessions inkl. der beim Start hochgeladenen Quiz-Daten (Story 2.1a). Für Meldungen strafrechtlich relevanter Quiz-Inhalte, behördliche Anfragen (z. B. Staatsanwaltschaft) oder Löschpflichten braucht es eine **Admin-Rolle** mit strikter Autorisierung und Nachvollziehbarkeit.

### Admin-Credentials: Wie kommt der Admin an seinen Zugang?

- **Vergabe:** Die Credentials werden **vom Betreiber der Plattform** (z. B. IT, Verantwortliche:r für den Betrieb) bereitgestellt — nicht von der App selbst. Es gibt keine Selbstregistrierung für Admins.
- **Technik (MVP):** Ein **geheimer Admin-Schlüssel** (API-Key/Passphrase) wird in der **Server-Umgebung** konfiguriert (z. B. Umgebungsvariable `ADMIN_SECRET` oder `ADMIN_API_KEYS`). Der Betreiber legt diesen Wert beim Deployment fest und teilt ihn **außerhalb der App** nur den berechtigten Admins mit (z. B. über sicheren Kanal, Passwortmanager, interne Dokumentation).
- **Ablauf für den Admin:** Beim Aufruf von `/admin` erscheint eine **Login-Seite** (kein öffentliches Dashboard). Der Admin gibt den ihm mitgeteilten **Admin-Schlüssel** ein. Das Frontend sendet ihn an das Backend (z. B. tRPC `admin.login` oder `admin.verifySecret`); das Backend vergleicht mit dem konfigurierten Wert. Bei Übereinstimmung erhält der Admin ein **Session-Token** (z. B. kurzlebiges JWT oder opaker Token in Redis mit TTL), das im Frontend (z. B. sessionStorage) gespeichert und bei jedem Admin-tRPC-Aufruf mitgeschickt wird. So ist der Admin „eingeloggt“, ohne dass die App ein eigenes Benutzerkonto für ihn anlegt.
- **Zusammenfassung:** Der Admin bekommt seine Credentials **vom Betreiber** (out-of-band). Technisch reicht ein gemeinsamer geheimer Schlüssel in der Server-Config; keine Datenbank für Admin-Benutzer nötig. Optional später: mehrere Schlüssel oder einfache Admin-Tabelle (Name, Hash des Passworts) für bessere Nachvollziehbarkeit im Audit-Log.

- **Story 9.1 (Admin: Sessions & Quiz-Inhalte inspizieren):** 🟡 Als Admin möchte ich alle auf dem Server gespeicherten Sessions einsehen und die zugehörigen Quiz-Inhalte (Fragen, Antworten, Metadaten) sowie Session-Verlauf (Teilnehmerzahl, Status, Zeitraum) inspizieren können, damit ich bei Meldungen oder Anfragen den Kontext prüfen kann.
  - **Akzeptanzkriterien:**
    - **Admin-Autorisierung:** Zugriff nur mit gültiger Admin-Authentifizierung (z. B. Admin-Token/API-Key aus Umgebung oder separates Admin-Login). Die Admin-Rolle wird **nicht** durch die URL verliehen — wer `/admin` aufruft ohne gültige Admin-Credentials, erhält „Zugriff verweigert“; alle Admin-tRPC-Prozeduren prüfen die Admin-Berechtigung serverseitig.
    - **Code-Eingabe (Session-Lookup):** Im Admin-Bereich (Panel/Dashboard) gibt es eine **Eingabe für den 6-stelligen Session-Code**. Der Admin kann den Code (z. B. aus einer Meldung oder behördlichen Anfrage) eingeben und damit direkt die zugehörigen Session- und Quiz-Daten abrufen. Bei gültigem Code wird die Session-Detail-Ansicht inkl. Quiz-Inhalt angezeigt; bei ungültigem/abgelaufenem Code eine klare Fehlermeldung. Technisch: tRPC `admin.getSessionByCode({ code })` oder Nutzung von `getSessionDetail` mit Code; UI: z. B. prominentes Suchfeld/Code-Eingabe oben im Dashboard.
    - **Session-Liste:** Admin kann eine paginierte/filterbare Liste aller Sessions abrufen (tRPC `admin.listSessions`): Session-Code, Status, Quiz-Name (falls vorhanden), Typ (QUIZ/Q_AND_A), Zeitraum (startedAt, endedAt), Teilnehmeranzahl. Filter optional: Status, Zeitraum, Code.
    - **Session-Detail:** Admin kann zu einer Session die vollständigen Metadaten sowie das bei Session-Start hochgeladene Quiz (Fragen, Antwortoptionen inkl. `isCorrect`) einsehen (read-only). Keine Änderung über diese Ansicht. Erreichbar sowohl über die Code-Eingabe als auch über Klick auf einen Eintrag in der Session-Liste.
    - **Route:** Eigene Route `/admin` (oder `/admin/sessions`) — nur erreichbar, wenn Admin authentifiziert ist. **Absicherung:** Frontend Route Guard prüft Admin-Session-Token (fehlt/ungültig → Login anzeigen oder Redirect); Backend: jede Admin-Prozedur prüft Token (z. B. zentrale `adminProcedure`-Middleware), sonst `UNAUTHORIZED`. Details: `docs/ROUTES_AND_STORIES.md` Abschnitt „Absicherung der Admin-Route“.
    - **Datenschutz:** Zugriff nur für berechtigte Admins; Zugriffe können für ein Audit-Log protokolliert werden (siehe Story 9.2).
  - **Abhängigkeiten:** Session- und Quiz-Daten liegen beim Live-Schalten bereits auf dem Server (Story 2.1a). Kein neues Datenmodell nötig; ggf. neuer tRPC-Router `admin` mit gesicherten Procedures.

- **Story 9.2 (Admin: Session/Quiz löschen – rechtlich):** 🟡 Als Admin möchte ich eine Session inkl. der zugehörigen Quiz-Kopie und aller Abstimmungsdaten (Votes, Participants, BonusTokens etc.) endgültig löschen können, wenn dies aus rechtlichen Gründen erforderlich ist (z. B. strafrechtlich relevanter Inhalt, Löschauflage).
  - **Akzeptanzkriterien:**
    - **Admin-only:** Nur mit gültiger Admin-Authentifizierung (wie Story 9.1). Löschen ist eine explizite Aktion (Button „Session endgültig löschen“) mit Bestätigungsdialog und optionaler Pflichtangabe eines Löschgrunds (Freitext oder Kategorie).
    - **Vollständige Löschung:** Die Mutation `admin.deleteSession` (oder vergleichbar) löscht die Session und kaskadiert alle zugehörigen Daten (Participants, Votes, BonusTokens, QaQuestions etc.). Die beim Session-Start hochgeladene Quiz-Kopie (Quiz, Questions, AnswerOptions) wird mitgelöscht, sofern sie nur zu dieser Session gehört (oder explizit „Session-Quiz-Kopie“); Quizzes, die von mehreren Sessions referenziert werden können, sind im aktuellen Modell pro Session eine Kopie (Quiz ist über Session.quizId verknüpft) — hier ist die Löschlogik an das Prisma-Schema anzupassen (Cascade oder explizites Löschen der Session-Quiz-Daten).
    - **Audit-Log:** Jede Admin-Löschung wird protokolliert: Zeitpunkt, Session-Code/ID, durchführende Admin-Kennung (z. B. Admin-Token-ID oder „system“), optional Löschgrund. Speicherung in einer Tabelle `AdminAuditLog` oder vergleichbar (oder strukturierte Logs), Aufbewahrungsfrist gemäß rechtlichen Anforderungen.
    - **Keine Wiederherstellung:** Nach Löschung sind die Daten nicht wiederherstellbar; Hinweis in der UI.
  - **Abhängigkeiten:** Story 9.1 (Admin-Zugang, Session-Liste/Detail).

- **Story 9.3 (Admin: Auszug für Behörden/Staatsanwaltschaft):** 🟡 Als Admin möchte ich zu einer Session einen vollständigen, maschinenlesbaren Auszug (z. B. JSON oder PDF) erzeugen können, der alle relevanten Inhalte (Quiz-Name, Fragen, Antwortoptionen, Session-Metadaten, Teilnehmer-Anzahl, ggf. aggregierte Abstimmungsergebnisse — **keine** personenbezogenen Daten wie Nicknames, sofern nicht rechtlich gefordert) enthält, damit ich Anfragen von Behörden oder Staatsanwaltschaft (z. B. bezichtigter Quiz-Inhalt) erfüllen kann.
  - **Akzeptanzkriterien:**
    - **Export-Funktion:** In der Admin-Session-Detail-Ansicht (Story 9.1) ein Button „Auszug für Behörden exportieren“. Erzeugt ein strukturiertes Exportpaket (z. B. JSON mit Schema-Version) mit: Session-ID, -Code, Status, Zeitraum, Quiz-Name, alle Fragen inkl. Text und Antwortoptionen (inkl. Kennzeichnung korrekt/falsch), Session-Typ, Teilnehmeranzahl, aggregierte Ergebnisdaten (wie in Story 4.7). Optional: zweites Format PDF für lesbare Übermittlung.
    - **DSGVO/Recht:** Der Export enthält bewusst **keine** Nicknames, IP-Adressen oder anderen personenbezogenen Daten, sofern nicht durch Rechtsgrund (z. B. Durchsuchungsbeschluss) explizit gefordert. Hinweis in der UI: „Nur für berechtigte Anfragen verwenden; Datensparsamkeit beachten.“
    - **Audit:** Export-Vorgänge können im gleichen Audit-Log wie Löschungen erfasst werden (wer, wann, welche Session).
  - **Abhängigkeiten:** Story 9.1 (Admin-Zugang, Session-Detail); inhaltlich an Story 4.7 (Export-Format) anknüpfbar.
