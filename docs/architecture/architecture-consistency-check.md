# Prüfung: Widersprüche in der technischen Architektur

**Datum:** 2026-02-23  
**Geprüft:** AGENT.md, handbook.md, README.md, ADRs (0002–0004), Prisma-Schema, Backend-/Frontend-Code, Zod-Schemas (shared-types), package.json-Dateien, docker-compose.yml, tsconfig.json. **Epic 0 abgeschlossen** (Redis, WebSocket, Yjs, Server-Status, Rate-Limiting, CI/CD).

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
Im README den Satz ergänzen, z. B.: *„… wird niemals **dauerhaft** auf einem zentralen Server gespeichert. Beim Start einer Live-Session wird eine temporäre Kopie an den Server übertragen, die nur für die Dauer der Sitzung existiert."*
**Erledigt (2026-02-21):** README.md entsprechend angepasst.
---

## 2. ADR-0003: Router-Typen-Import-Pfad

**ADR-0003:**
> „Das Frontend importiert die Router-Typen direkt aus dem Backend über den **`libs/shared-types`-Pfad** im Monorepo."

**Code (tsconfig.json):**
```json
"paths": {
  "@arsnova/shared-types": ["libs/shared-types/src/index.ts"],
  "@arsnova/api": ["apps/backend/src/routers/index.ts"]
}
```

**Code (core/trpc.client.ts):**
```ts
import type { AppRouter } from '@arsnova/api';
```

**Widerspruch:**  
`AppRouter` wird über den Path-Alias `@arsnova/api` importiert, der auf `apps/backend/src/routers/index.ts` zeigt – **nicht** auf `libs/shared-types`. Geteilte Zod-Schemas/DTOs kommen aus `@arsnova/shared-types`, aber der Router-Typ kommt aus dem Backend direkt.

**Empfehlung:**  
ADR-0003 korrigieren: *„Das Frontend importiert den **Router-Typ (`AppRouter`)** direkt aus dem Backend über den Path-Alias `@arsnova/api`. Geteilte Schemas und DTOs werden aus `@arsnova/shared-types` importiert."*
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
Root deklariert Prisma 7.x, Backend deklariert Prisma 6.x. Bei npm Workspaces wird normalerweise die Root-Version aufgelöst (Hoisting), sodass de facto Prisma 7.x verwendet wird – die Backend-Deklaration ist aber irreführend.

**Empfehlung:**  
In `apps/backend/package.json` die Version auf `"^7.4.0"` anheben, damit sie konsistent ist.

**Erledigt (2026-02-21):** Backend-Version auf ^7.4.0 angehoben.

---

## 4. Angular-Version in der Dokumentation

| Dokument | Angabe |
|----------|--------|
| AGENT.md | „Angular (Version 17+)" |
| Handbook | „Angular (v17+)" |
| README Badges | „Angular 17+" |
| architecture-overview.md | „Frontend - Angular 17+" |
| diagrams.md | „Angular 19" |
| `apps/frontend/package.json` | `"@angular/core": "^19.0.0"` |

**Bewertung:**  
Kein harter Widerspruch (19 erfüllt „17+"). Allerdings nennt `diagrams.md` explizit „Angular 19", während alle anderen Dokumente „17+" schreiben.

**Empfehlung:**  
Dokumentation vereinheitlichen: Entweder überall „Angular 17+ (aktuell 19)" oder überall „Angular 19".
**Erledigt (2026-02-21):** AGENT.md, handbook.md und architecture-overview.md auf „Angular 17+ (aktuell 19)“ aktualisiert.
---

## 5. Docker-Compose-Befehl

**README.md:**
```
docker-compose up -d
```

**Root `package.json` Script:**
```json
"docker:up": "docker compose up -d"
```

**Bewertung:**  
README nutzt `docker-compose` (v1-Syntax), `package.json` nutzt `docker compose` (v2-Syntax). Beide funktionieren, aber die Inkonsistenz kann verwirren.

**Empfehlung:**  
Im README auf `docker compose up -d` (v2) aktualisieren und ggf. ergänzen: *„(oder `docker-compose up -d` unter Docker Compose v1)"*.
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
Das Feld ist verwaist – es gibt keinen geplanten Use-Case.

**Empfehlung:**  
Entweder eine Story im Backlog anlegen (z. B. „Quiz öffentlich teilen") oder das Feld aus dem Schema entfernen, um Dead Code zu vermeiden.
**Erledigt (2026-02-21):** `isPublic`-Feld aus dem Prisma-Schema entfernt (kein geplanter Use-Case).
---

## 7. `PAUSED`-Status im Schema, aber nicht in Diagrammen

**Prisma-Schema / Zod:**
```
enum SessionStatus { LOBBY, ACTIVE, PAUSED, RESULTS, FINISHED }
```

**Diagramme (Sequenz, Aktivität):**  
Zeigen nur LOBBY → ACTIVE → RESULTS → FINISHED. Der `PAUSED`-Status wird nirgends im Ablauf erwähnt.

**Bewertung:**  
`PAUSED` ist vermutlich der Zustand zwischen zwei Fragen (nach RESULTS, bevor die nächste Frage mit ACTIVE beginnt). Dies ist aber in keinem Diagramm und keinem Backlog-Akzeptanzkriterium dokumentiert.

**Empfehlung:**  
Entweder den Status `PAUSED` im Aktivitäts- und Sequenzdiagramm integrieren (zwischen RESULTS und nächster Frage) oder im Handbook/Backlog den Verwendungszweck dokumentieren.

**Erledigt (2026-02-21):** `PAUSED`-Status in Aktivitäts- und Dozent-Sequenzdiagramm (diagrams.md) integriert.

---

## 8. Backend: Keine Prisma-Client-Nutzung

**Backend-Code (`apps/backend/src/`):**  
Importiert und nutzt `@prisma/client` nirgends. Der Health-Router gibt statische Daten zurück.

**Backend `package.json`:**  
Deklariert `@prisma/client` als Dependency.

**Bewertung:**  
Erwartetes Delta – nur healthRouter ist implementiert (Ziel-Architektur noch nicht umgesetzt). Die Dependency ist berechtigt als Vorbereitung.

**Empfehlung:**  
Kein Handlungsbedarf. Bei Umsetzung von Story 2.1a wird Prisma eingebunden.

---

## 9. Frontend: Leere Routes und kein wsLink

**Code (`app.routes.ts`):**
```ts
export const routes: Routes = [];
```

**Code (`core/trpc.client.ts`):**  
Im Browser: `splitLink` mit `wsLink` + `httpBatchLink`; bei SSR/Prerender nur `httpBatchLink` (WebSocket in Node nicht verfügbar).

**Diagramme / Handbook:**  
Beschreiben Routen (`/quiz`, `/session/:code`, `/legal`, …) und WebSocket-Subscriptions via `wsLink`.

**Bewertung:**  
Erwartetes Delta – Epic 0 ist umgesetzt (wsLink + httpBatchLink, ServerStatusWidget, Home/Session/Quiz-Routen). Weitere Routes/Komponenten folgen mit Epic 1–3.

**Empfehlung:**  
Kein Handlungsbedarf aktuell. Die Diagramme zeigen die Ziel-Architektur.

---

## 10. Health-Router: Kein Zod-Schema für Response

**Backend (`health.ts`):**
```ts
check: publicProcedure.query(() => {
  return { status: 'ok' as const, timestamp: ..., version: ... };
})
```

**shared-types (`schemas.ts`):**  
`HealthCheckResponseSchema` ist definiert, wird aber im Backend nicht als `.output()`-Validator verwendet.

**Bewertung:**  
Der Health-Router validiert seine Ausgabe nicht via Zod. Bei tRPC ist Output-Validierung optional, aber die DoD fordert Zod-Validierung für Ein-/Ausgaben.

**Empfehlung:**  
Im Health-Router `.output(HealthCheckResponseSchema)` ergänzen, um die DoD zu erfüllen und Konsistenz mit den definierten Schemas sicherzustellen.

**Erledigt (2026-02-21):** `.output(HealthCheckResponseSchema)` im Health-Router ergänzt.

---

## Zusammenfassung

| Nr. | Thema | Art | Handlungsbedarf |
|-----|-------|-----|-----------------|
| 1 | README „niemals" vs. Session-Kopie | Inhaltlicher Widerspruch | ✅ README präzisiert |
| 2 | ADR-0003 Import-Pfad | Falscher Pfad | ✅ ADR-0003 korrigiert |
| 3 | Prisma-Client-Version Root vs. Backend | Versionskonflikt | ✅ Backend auf ^7.4.0 angehoben |
| 4 | Angular-Version in Docs | Uneinheitlich | ✅ Auf „17+ (aktuell 19)" vereinheitlicht |
| 5 | docker-compose Syntax | Kleines Delta | ✅ README auf v2-Syntax aktualisiert |
| 6 | `isPublic` ohne Story | Verwaistes Feld | ✅ Feld aus Prisma-Schema entfernt |
| 7 | `PAUSED`-Status undokumentiert | Fehlende Doku | ✅ In Diagrammen ergänzt |
| 8 | Prisma nicht genutzt | Erwartetes Delta | Kein Handlungsbedarf |
| 9 | Leere Routes, kein wsLink | Erwartetes Delta | Kein Handlungsbedarf |
| 10 | Health-Router ohne Output-Schema | DoD-Verstoß | ✅ `.output()` ergänzt |

**Gesamtbewertung:** Alle inhaltlichen Widersprüche, der Versionskonflikt und der DoD-Verstoß wurden behoben. Die verbleibenden Punkte (Nr. 8, 9) sind erwartete Deltas der noch nicht implementierten Ziel-Architektur.
