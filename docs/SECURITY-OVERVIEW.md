<!-- markdownlint-disable MD013 -->

# Sicherheit & Datenschutz — Überblick

Kurzreferenz für **Annahmen, Grenzen und eingebaute Kontrollen**. Kein vollständiges Threat-Model; technische Tiefe: Handbuch, ADRs, Prisma, `session.ts` / DTO-Schicht.

**Stand:** 2026-03-20

---

## 1. Produktkontext

- **Accountfrei:** Kein Nutzer-/Login-Modell für Dozenten oder Teilnehmende. Identität **realer Personen** hält die App nicht fest; Pseudonyme und freiwillige Einreichung von Bonus-Codes sind dokumentiert ([bonus-codes](features/bonus-codes.md)).
- **Local-First (Quiz):** Dauerhafte **Quiz-Sammlung** primär im Browser (Yjs); Server erhält eine **flüchtige Kopie** für die Live-Session ([ADR-0004](architecture/decisions/0004-use-yjs-for-local-first-storage.md), Handbook §3.1).

---

## 2. Vertraulichkeit der Inhalte (Live-Quiz)

- **Data-Stripping:** `AnswerOption.isCorrect` wird im Status **`ACTIVE`** nicht an Teilnehmende ausgeliefert; Auflösung erst in **`RESULTS`** über geeignete DTOs ([ADR-0006](architecture/decisions/0006-roles-routes-authorization-host-admin.md), `cursor-context.md` §5).
- **Phasen-DTOs:** `QUESTION_OPEN` (Lesephase) liefert nur Fragenstamm ohne Antwortoptionen, sofern Lesephase aktiv — siehe Story 2.6.

---

## 3. Zugriffskontrolle (rollenbasiert, technisch)

| Mechanismus    | Zweck                                                                                                                                                   |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Host**       | Steuerung über Kontext nach Session-Start (Host-Token / hostProcedure); Details ADR-0006.                                                               |
| **Teilnehmer** | Öffentliche Join-/Vote-Pfade mit Session-Code und Rate-Limits.                                                                                          |
| **Admin**      | Separater Pfad `/admin`; **`ADMIN_SECRET`** (Env), danach Admin-Session mit TTL (Epic 9 in [Backlog.md](../Backlog.md); Code: `adminAuth`, `admin.ts`). |

Die App **ersetzt keine** organisationsweite IAM- oder VPN-Lösung.

---

## 4. Missbrauch & Last (Rate-Limiting)

Redis-basierte Limits u. a. für Session-Code-Fehlversuche, Votes, Session-Erstellung — konfigurierbar über Env ([ENVIRONMENT.md](ENVIRONMENT.md), `rateLimit.ts`).

---

## 5. Aufbewahrung & Löschung

- **Sessions:** Beendete Sessions und zugehörige Daten nach konfigurierbaren Fenstern (Cleanup-Jobs); **Legal Hold** schützt definiert vor Purge (`apps/backend/src/lib/sessionCleanup.ts`, Admin).
- **Bonus-Tokens:** Zusätzliche TTL-basierte Bereinigung (Tage).
- **Blitzlicht:** Nur Redis, TTL ca. 30 Minuten — kein langfristiges PII dort.

Aggregierte **Server-Statistiken** (`health.stats`) ohne Einzelpersonenbezug (Story 0.4).

---

## 6. Transport & Infrastruktur (Grenzen der App)

TLS-Terminierung, Firewall, Secret-Management auf dem Server und Härtung des Host-Systems sind **Betriebssache** — siehe [deployment-debian-root-server.md](deployment-debian-root-server.md), Docker-/Compose-Vorlagen.

---

## 7. Weiterführend

| Thema                         | Dokument                                                                         |
| ----------------------------- | -------------------------------------------------------------------------------- |
| Rollen & Routen               | [ADR-0006](architecture/decisions/0006-roles-routes-authorization-host-admin.md) |
| i18n & Daten in Übersetzungen | [ADR-0008](architecture/decisions/0008-i18n-internationalization.md)             |
| Architektur gesamt            | [handbook.md](architecture/handbook.md)                                          |
| Umgebungsvariablen            | [ENVIRONMENT.md](ENVIRONMENT.md)                                                 |

Bei **Sicherheitsvorfällen** oder **Datenschutz-Anfragen**: Prozess mit Betrieb/legal klären; Audit-Log für Admin-Aktionen (Löschen/Export) im Schema `AdminAuditLog`.
