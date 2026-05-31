<!-- markdownlint-disable MD013 -->

# Prüfung: Widersprüche in der technischen Architektur

**Datum:** 2026-05-31
**Geprüft:** `AGENT.md`, `handbook.md`, `README.md`, alle Dateien unter `docs/architecture`, Prisma-Schema, Backend-/Frontend-Code, Zod-Schemas (`shared-types`), `package.json`-Dateien, `docker-compose.yml`, `tsconfig.json`, Angular-Router und relevante Feature-Dokumente.

---

## 1. README: „niemals im Klartext auf einem Server gespeichert"

**README.md:**

> „Das geistige Eigentum (die Quizfragen) wird niemals im Klartext auf einem zentralen Server gespeichert, sondern lebt Local-First im Browser des Erstellers."

**Handbook 3.1 / ADR-0004:**
Beim Start einer Live-Session wird eine **Kopie** des Quiz an den Server übermittelt (Story 2.1a); diese Session-Kopie wird in PostgreSQL gehalten.

**Prisma-Schema:**
`Quiz`, `Question`, `AnswerOption` mit Klartext-Feldern (`name`, `text`, `isCorrect`).

**Widerspruch:**
Handbook und ADR-0004 wurden bereits präzisiert (Session-Kopie erlaubt). Das **README** verwendet jedoch noch das absolute „niemals", ohne die Session-Kopie zu erwähnen.

**Empfehlung:**
Im README den Satz ergänzen, z. B.: _„… wird niemals **dauerhaft** auf einem zentralen Server gespeichert. Beim Start einer Live-Session wird eine temporäre Kopie an den Server übertragen, die nur für die Dauer der Sitzung existiert."_

**Erledigt (2026-02-21):** README.md entsprechend angepasst.

---

## 2. ADR-0003: Router-Typen-Import-Pfad

**ADR-0003:**

> „Das Frontend importiert die Router-Typen direkt aus dem Backend über den **`libs/shared-types`-Pfad** im Monorepo."

**Code (`tsconfig.json`):**

```json
"paths": {
  "@arsnova/shared-types": ["libs/shared-types/src/index.ts"],
  "@arsnova/api": ["apps/backend/src/routers/index.ts"]
}
```

**Code (`core/trpc.client.ts`):**

```ts
import type { AppRouter } from '@arsnova/api';
```

**Widerspruch:**
`AppRouter` wird über den Path-Alias `@arsnova/api` importiert, der auf `apps/backend/src/routers/index.ts` zeigt, also **nicht** auf `libs/shared-types`. Geteilte Zod-Schemas und DTOs kommen aus `@arsnova/shared-types`, aber der Router-Typ kommt aus dem Backend direkt.

**Empfehlung:**
ADR-0003 korrigieren: _„Das Frontend importiert den **Router-Typ (`AppRouter`)** direkt aus dem Backend über den Path-Alias `@arsnova/api`. Geteilte Schemas und DTOs werden aus `@arsnova/shared-types` importiert."_

**Erledigt (2026-02-21):** ADR-0003 entsprechend korrigiert.

---

## 3. Prisma-Client-Version: Root vs. Backend

**Root `package.json`:**

```json
"@prisma/client": "^7.4.0",
"prisma": "^7.4.0"
```

**Backend `apps/backend/package.json`:**

```json
"@prisma/client": "^6.0.0"
```

**Widerspruch:**
Root deklariert Prisma 7.x, Backend deklariert Prisma 6.x. Bei npm Workspaces wird normalerweise die Root-Version aufgelöst (Hoisting), sodass de facto Prisma 7.x verwendet wird. Die Backend-Deklaration ist aber irreführend.

**Empfehlung:**
In `apps/backend/package.json` die Version auf `"^7.4.0"` anheben, damit sie konsistent ist.

**Erledigt (2026-02-21):** Backend-Version auf `^7.4.0` angehoben.

---

## 4. Angular-Version in der Dokumentation

| Dokument                     | Angabe                            |
| ---------------------------- | --------------------------------- |
| `AGENT.md`                   | „Angular (Version 17+)"           |
| Handbook                     | „Angular (v21)"                   |
| README Badges                | „Angular 17+"                     |
| `architecture-overview.md`   | „Frontend - Angular (aktuell 21)" |
| `diagrams.md`                | „Angular 21"                      |
| `apps/frontend/package.json` | `"@angular/core": "^21.2.0"`      |

**Bewertung:**
Der damalige Widerspruch ist behoben. Die Referenzdokumente nennen inzwischen den aktuellen Projektstand mit Angular 21 oder eine bewusst allgemeine 17+-Formulierung.

**Empfehlung:**
Dokumentation bei Framework-Upgrades weiterhin zentral nachziehen.

**Aktualisiert (2026-03-16):** `handbook.md`, `architecture-overview.md`, `diagrams.md` und weitere Referenzen auf Angular 21 bzw. den aktuellen Stand gebracht.

---

## 5. Docker-Compose-Befehl

**README.md:**

```sh
docker-compose up -d
```

**Root `package.json` Script:**

```json
"docker:up": "docker compose up -d"
```

**Bewertung:**
README nutzt `docker-compose` (v1-Syntax), `package.json` nutzt `docker compose` (v2-Syntax). Beide funktionieren, aber die Inkonsistenz kann verwirren.

**Empfehlung:**
Im README auf `docker compose up -d` (v2) aktualisieren und ggf. ergänzen: _„(oder `docker-compose up -d` unter Docker Compose v1)"_.

**Erledigt (2026-02-21):** README auf `docker compose up -d` aktualisiert.

---

## 6. Quiz-Modell: `isPublic`-Feld ohne Backlog-Story

**Prisma-Schema:**

```prisma
model Quiz {
  isPublic Boolean @default(false)
  ...
}
```

**Backlog / Handbook / Diagramme:**
Kein Epic, keine Story, kein Diagramm und kein DTO referenziert `isPublic`.

**Bewertung:**
Das Feld ist verwaist. Es gibt keinen geplanten Use-Case.

**Empfehlung:**
Entweder eine Story im Backlog anlegen, z. B. „Quiz öffentlich teilen", oder das Feld aus dem Schema entfernen, um Dead Code zu vermeiden.

**Erledigt (2026-02-21):** `isPublic`-Feld aus dem Prisma-Schema entfernt (kein geplanter Use-Case).

---

## 7. `PAUSED`-Status im Schema, aber nicht in Diagrammen

**Prisma-Schema / Zod:**

```text
enum SessionStatus { LOBBY, ACTIVE, PAUSED, RESULTS, FINISHED }
```

**Diagramme (Sequenz, Aktivität):**
Zeigen nur `LOBBY → ACTIVE → RESULTS → FINISHED`. Der `PAUSED`-Status wird nirgends im Ablauf erwähnt.

**Bewertung:**
`PAUSED` ist vermutlich der Zustand zwischen zwei Fragen (nach `RESULTS`, bevor die nächste Frage mit `ACTIVE` beginnt). Dies ist aber in keinem Diagramm und keinem Backlog-Akzeptanzkriterium dokumentiert.

**Empfehlung:**
Entweder den Status `PAUSED` im Aktivitäts- und Sequenzdiagramm integrieren (zwischen `RESULTS` und nächster Frage) oder im Handbook/Backlog den Verwendungszweck dokumentieren.

**Erledigt (2026-02-21):** `PAUSED`-Status in Aktivitäts- und Dozent-Sequenzdiagramm (`diagrams.md`) integriert.

---

## 8. Backend: Prisma-Client-Nutzung

**Urspruenglicher Befund (2026-02):**
Das Backend importierte und nutzte `@prisma/client` noch nicht; der Health-Router gab statische Daten zurueck.

**Aktueller Stand (2026-05-31):**
Der Befund ist ueberholt. `apps/backend/src/db.ts` stellt den Prisma-Client bereit; Session-, Admin-, MOTD-, Q&A-, Vote-, Health- und Statistikpfade nutzen Prisma produktiv. `prisma/schema.prisma` enthaelt u. a. `Session`, `Quiz`, `Participant`, `Vote`, `PlatformStatistic` und `DailyStatistic`.

**Empfehlung:**
Kein Handlungsbedarf. Der alte erwartete Delta-Punkt ist erledigt.

---

## 9. Frontend: Routen und `wsLink`

**Urspruenglicher Befund (2026-02):**

Der Angular-Router war leer; WebSocket-Subscriptions waren erst als Zielbild dokumentiert.

**Aktueller Stand (2026-05-31):**

- `apps/frontend/src/app/app.routes.ts` enthaelt Home, Quiz, Quiz-Sync, Session-Host, Presenter, Vote, Feedback, Join, Admin, Help, News-Archiv und Legal-Routen.
- Host- und Presenter-Routen sind clientseitig an Host-Token gebunden.
- `core/trpc.client.ts` nutzt im Browser `splitLink` mit `wsLink` fuer Subscriptions und `httpBatchLink` fuer Queries/Mutations; SSR/Prerender nutzt nur HTTP.

**Bewertung:**
Der alte Delta-Punkt ist erledigt.

**Empfehlung:**
Kein Handlungsbedarf. Neue Routen muessen weiterhin gegen ADR-0006 und ADR-0019 geprueft werden.

---

## 10. Health-Router: Kein Zod-Schema für Response

**Backend (`health.ts`):**

```ts
check: publicProcedure.query(() => {
  return { status: 'ok' as const, timestamp: ..., version: ... };
})
```

**`shared-types` (`schemas.ts`):**
`HealthCheckResponseSchema` ist definiert, wird aber im Backend nicht als `.output()`-Validator verwendet.

**Bewertung:**
Der Health-Router validiert seine Ausgabe nicht via Zod. Bei tRPC ist Output-Validierung optional, aber die DoD fordert Zod-Validierung für Ein- und Ausgaben.

**Empfehlung:**
Im Health-Router `.output(HealthCheckResponseSchema)` ergänzen, um die DoD zu erfüllen und Konsistenz mit den definierten Schemas sicherzustellen.

**Erledigt (2026-02-21):** `.output(HealthCheckResponseSchema)` im Health-Router ergänzt.

---

## 11. Zod-v4-Migrationsdokument

**Befund (2026-05-31):**
`docs/architecture/zod-v4-migration.md` war noch als Zukunftsplan formuliert, obwohl `libs/shared-types` und `apps/backend` bereits `zod` `^4.0.0` nutzen.

**Bewertung:**
Inhaltlicher Dokumentations-Drift, kein Codeproblem.

**Erledigt (2026-05-31):** Das Dokument wurde auf den aktuellen Stand umgestellt: Migration umgesetzt, Restpunkte fuer Top-Level-Helper dokumentiert.

---

## 12. ADR-0024: Proposed trotz implementierter Tagesrekorde

**Befund (2026-05-31):**
ADR-0024 stand noch auf `Proposed`, waehrend das Repo `DailyStatistic`, Migration `20260504144000_add_daily_statistic`, `ServerStatsDTO.dailyHighscores`, Backend-Tests und den lazy geladenen Chart im Server-Status-Hilfedialog enthaelt.

**Bewertung:**
Status-Drift zwischen ADR und Code.

**Erledigt (2026-05-31):** ADR-0024 wurde auf `Accepted` gesetzt und um den Implementierungsstand ergaenzt.

---

## 13. ADR-0029: Tempo-Zielbild noch nicht im Code umgesetzt

**Befund (2026-05-31):**
ADR-0029 ist als Architekturentscheidung angenommen. `QuickFeedbackTypeEnum` enthaelt aber aktuell noch `MOOD`, `YESNO`, `YESNO_BINARY`, `TRUEFALSE_UNKNOWN`, `STARS`, `ABCD`; ein `TEMPO`-Typ und die mutable Tempo-Semantik sind noch nicht implementiert.

**Bewertung:**
Kein Widerspruch, solange ADR-0029 als Zielentscheidung und Story 8.8 als offen verstanden wird. Die Doku muss diesen Umsetzungsstand aber explizit machen.

**Erledigt (2026-05-31):** ADR-0029 wurde um einen Implementierungsstand mit dieser Abgrenzung ergaenzt.

---

## 14. ADR-0005: Tailwind-Scope

**Befund (2026-05-31):**
ADR-0005 formulierte an einer Stelle "im gesamten Repository kein Tailwind", dokumentierte aber gleichzeitig `apps/landing` als Tailwind-Ausnahme.

**Bewertung:**
Die Architekturregel meint das Angular-Frontend (`apps/frontend`), nicht die separate Astro-Landing-App.

**Erledigt (2026-05-31):** ADR-0005 wurde sprachlich auf `apps/frontend` / Angular-Frontend praezisiert.

---

## Zusammenfassung

| Nr. | Thema                                  | Art                        | Handlungsbedarf                                         |
| --- | -------------------------------------- | -------------------------- | ------------------------------------------------------- |
| 1   | README „niemals" vs. Session-Kopie     | Inhaltlicher Widerspruch   | ✅ README präzisiert                                    |
| 2   | ADR-0003 Import-Pfad                   | Falscher Pfad              | ✅ ADR-0003 korrigiert                                  |
| 3   | Prisma-Client-Version Root vs. Backend | Versionskonflikt           | ✅ Backend auf `^7.4.0` angehoben                       |
| 4   | Angular-Version in Docs                | Damalige Uneinheitlichkeit | ✅ spaeter auf aktuellen Stand (Angular 21) nachgezogen |
| 5   | `docker-compose`-Syntax                | Kleines Delta              | ✅ README auf v2-Syntax aktualisiert                    |
| 6   | `isPublic` ohne Story                  | Verwaistes Feld            | ✅ Feld aus Prisma-Schema entfernt                      |
| 7   | `PAUSED`-Status undokumentiert         | Fehlende Doku              | ✅ In Diagrammen ergänzt                                |
| 8   | Prisma nicht genutzt                   | Ueberholter Delta-Punkt    | ✅ Heute produktiv genutzt                              |
| 9   | Leere Routes, kein `wsLink`            | Ueberholter Delta-Punkt    | ✅ Heute umgesetzt                                      |
| 10  | Health-Router ohne Output-Schema       | DoD-Verstoß                | ✅ `.output()` ergänzt                                  |
| 11  | Zod-v4-Doku als Zukunftsplan           | Dokumentations-Drift       | ✅ Aktualisiert                                         |
| 12  | ADR-0024 Proposed trotz Umsetzung      | Status-Drift               | ✅ Auf Accepted gesetzt                                 |
| 13  | ADR-0029 Tempo noch nicht im Code      | Zielbild vs. Ist-Stand     | ✅ Abgrenzung dokumentiert                              |
| 14  | ADR-0005 Tailwind-Scope                | Unklare Formulierung       | ✅ Auf Angular-Frontend praezisiert                     |

**Gesamtbewertung:** Die frueheren technischen Widersprueche sind behoben. Der aktuelle Abgleich fand vor allem Dokumentations-Drift: Status von ADR-0024, Zod-v4-Migrationsstand, Tempo-Ist-Stand und Tailwind-Scope. Diese Punkte sind in den Architekturdateien aktualisiert.
