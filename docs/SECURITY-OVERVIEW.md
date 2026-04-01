<!-- markdownlint-disable MD013 -->

# Sicherheit & Datenschutz — Überblick

Kurzreferenz für **Annahmen, Grenzen und eingebaute Kontrollen**. Kein vollständiges Threat-Model; technische Tiefe: Handbuch, ADRs, Prisma, `session.ts` / DTO-Schicht.

**Stand:** 2026-04-01 — ergänzt um **MOTD** (Epic 10, öffentliche Lesepfade + Admin), **Plattformstatistik** (`PlatformStatistic` / Rekordteilnehmer in `health.stats`).

---

## 1. Produktkontext

- **Accountfrei:** Kein Nutzer-/Login-Modell für Lehrende oder Teilnehmende. Identität **realer Personen** hält die App nicht fest; Pseudonyme und freiwillige Einreichung von Bonus-Codes sind dokumentiert ([bonus-codes](features/bonus-codes.md)).
- **Local-First (Quiz):** Dauerhafte **Quiz-Sammlung** primär im Browser (Yjs); Server erhält eine **flüchtige Kopie** für die Live-Session ([ADR-0004](architecture/decisions/0004-use-yjs-for-local-first-storage.md), Handbook §3.1).

---

## 2. Vertraulichkeit der Inhalte (Live-Quiz)

- **Data-Stripping:** `AnswerOption.isCorrect` wird im Status **`ACTIVE`** nicht an Teilnehmende ausgeliefert; Auflösung erst in **`RESULTS`** über geeignete DTOs. Maßgeblich sind hier die DTO-Schemas, der Session-Router und die zugehörigen Tests ([libs/shared-types/src/schemas.ts](../libs/shared-types/src/schemas.ts), [apps/backend/src/routers/session.ts](../apps/backend/src/routers/session.ts), [apps/backend/src/**tests**/dto-security.test.ts](../apps/backend/src/__tests__/dto-security.test.ts)).
- **Phasen-DTOs:** `QUESTION_OPEN` (Lesephase) liefert nur Fragenstamm ohne Antwortoptionen, sofern Lesephase aktiv — siehe Story 2.6.

---

## 3. Zugriffskontrolle (rollenbasiert, technisch)

| Mechanismus        | Zweck                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Host / Present** | Eigene Host-/Present-Routen im Frontend. **Wichtig:** Das streng tokenbasierte Host-Modell aus ADR-0006 ist im aktuellen Backend noch **nicht** vollständig als eigene `hostProcedure` sichtbar. Steuernde Session-Prozeduren wie `session.nextQuestion`, `session.revealResults`, `session.getExportData` oder `session.getBonusTokens` laufen derzeit über `publicProcedure` im Session-Kontext. Das ADR beschreibt hier das Zielbild, nicht durchgehend den Ist-Zustand. |
| **Teilnehmende**   | Öffentliche Join-/Vote-Pfade mit Session-Code. Rate-Limits greifen je nach Pfad unterschiedlich: Session-Code-Fehlversuche und Session-Erstellung pro IP, Vote-Submit pro Teilnehmenden-ID.                                                                                                                                                                                                                                                                                 |
| **Admin**          | Separater Pfad `/admin`; **`ADMIN_SECRET`** (Env), danach Admin-Session mit TTL in Redis. Token-Transport über `Authorization: Bearer ...` oder `x-admin-token`; Schutz zentral über `adminProcedure` (Epic 9 in [Backlog.md](../Backlog.md); Code: `adminAuth`, `trpc.ts`, `admin.ts`).                                                                                                                                                                                    |
| **MOTD (Epic 10)** | **Öffentlich:** `motd.getCurrent`, `listArchive`, `getHeaderState`, `recordInteraction` — **rate-limited** pro IP ([ENVIRONMENT.md](ENVIRONMENT.md), `rateLimit.ts`). **Schreibend:** nur `adminProcedure` — `admin.motd.*` / Templates, Audit-Log `MotdAuditLog`.                                                                                                                                                                                                          |

Die App **ersetzt keine** organisationsweite IAM- oder VPN-Lösung.

---

## 4. Missbrauch & Last (Rate-Limiting)

Redis-basierte Limits u. a. für Session-Code-Fehlversuche und Session-Erstellung **pro IP**, Votes **pro Teilnehmenden-ID** sowie die **MOTD-Öffentliche-API pro IP** — konfigurierbar über Env ([ENVIRONMENT.md](ENVIRONMENT.md), `rateLimit.ts`). Die Client-IP wird dabei primär aus `x-forwarded-for`, sonst aus `socket.remoteAddress` gelesen (`trpc.ts`).

---

## 5. Aufbewahrung & Löschung

- **Sessions:** Aktive, verwaiste Sessions werden nach **24 Stunden** auf `FINISHED` gesetzt. Bereits beendete Sessions werden nach weiteren **24 Stunden** gelöscht, sofern kein aktiver **Legal Hold** greift. Diese Fenster sind derzeit **fest im Code** definiert, nicht per Env konfigurierbar ([apps/backend/src/lib/sessionCleanup.ts](../apps/backend/src/lib/sessionCleanup.ts)).
- **Bonus-Tokens:** Zusätzliche Bereinigung nach **90 Tagen** ([apps/backend/src/lib/sessionCleanup.ts](../apps/backend/src/lib/sessionCleanup.ts)).
- **Blitzlicht / Quick Feedback:** Nur Redis, TTL **30 Minuten** — kein langfristiges PII dort ([apps/backend/src/routers/quickFeedback.ts](../apps/backend/src/routers/quickFeedback.ts)).

Aggregierte **Server-Statistiken** (`health.stats`) ohne Einzelpersonenbezug (Story 0.4): aktive/abgeschlossene Sessions, Teilnehmende in aktiven Sessions, Blitz-Runden, sowie **Rekord** `maxParticipantsSingleSession` aus **`PlatformStatistic`** (Hilfe-Dialog — keine personenbezogenen Einzelwerte).

---

## 6. Transport & Infrastruktur (Grenzen der App)

TLS-Terminierung, Firewall, Secret-Management auf dem Server und Härtung des Host-Systems sind **Betriebssache** — siehe [deployment-debian-root-server.md](deployment-debian-root-server.md), Docker-/Compose-Vorlagen.

---

## 7. Weiterführend

| Thema                          | Dokument                                                                                                                                                       |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rollen & Routen                | [ADR-0006](architecture/decisions/0006-roles-routes-authorization-host-admin.md) — Zielbild; aktuellen Ist-Stand zusätzlich in `session.ts` / `trpc.ts` prüfen |
| MOTD / Plattform-Kommunikation | [ADR-0018](architecture/decisions/0018-message-of-the-day-platform-communication.md), [motd.md](features/motd.md)                                              |
| i18n & Daten in Übersetzungen  | [ADR-0008](architecture/decisions/0008-i18n-internationalization.md)                                                                                           |
| Architektur gesamt             | [handbook.md](architecture/handbook.md)                                                                                                                        |
| Umgebungsvariablen             | [ENVIRONMENT.md](ENVIRONMENT.md)                                                                                                                               |

Bei **Sicherheitsvorfällen** oder **Datenschutz-Anfragen**: Prozess mit Betrieb/legal klären; Audit-Log für Admin-Aktionen (Löschen/Export) im Schema `AdminAuditLog`.
