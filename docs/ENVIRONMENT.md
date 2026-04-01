<!-- markdownlint-disable MD013 -->

# Umgebungsvariablen (Referenz)

**Lokal:** Vorlage [`../.env.example`](../.env.example) nach `.env` kopieren und anpassen.  
**Produktion (Docker):** Vorlage [`.env.production.example`](../.env.production.example) → `.env.production`; siehe auch [deployment-debian-root-server.md](deployment-debian-root-server.md).

---

## Backend (Lokal / Standard-Dev)

Variablen, die der Node-Backend-Prozess unter `apps/backend` typischerweise liest:

| Variable                                        | Erforderlich | Standard / Beispiel        | Zweck                                                                                                                                        |
| ----------------------------------------------- | ------------ | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                                  | ja (für DB)  | siehe `.env.example`       | PostgreSQL-Verbindung (Prisma)                                                                                                               |
| `REDIS_URL`                                     | nein         | `redis://localhost:6379`   | Redis für Rate-Limits, Admin-Sessions und ephemere Live-Daten (z. B. Blitzlicht / MOTD-Interaktionszähler)                                   |
| `PORT`                                          | nein         | `3000`                     | HTTP-API (Express + tRPC)                                                                                                                    |
| `HOST`                                          | nein         | —                          | **Kein** eigener Reader für den HTTP-Server. Wird im aktuellen Code nur als **Fallback** für den Yjs-Child genutzt, wenn `YJS_WS_HOST` fehlt |
| `WS_PORT`                                       | nein         | `3001`                     | WebSocket-Server (tRPC-Subscriptions)                                                                                                        |
| `YJS_WS_PORT`                                   | nein         | `3002`                     | y-websocket-Relay (Quiz-Sync)                                                                                                                |
| `YJS_WS_HOST`                                   | nein         | siehe `HOST` / `127.0.0.1` | Bind-Adresse des Yjs-Childs (`@y/websocket-server`). **Nicht** nur `127.0.0.1` in Docker, sonst scheitert `wss://…/yjs-ws` hinter Nginx      |
| `NODE_ENV`                                      | nein         | —                          | `production` u. a. für CORS/Static; `development` für lokale Defaults                                                                        |
| `RATE_LIMIT_SESSION_CODE_ATTEMPTS`              | nein         | `5`                        | Fehlversuche Session-Code pro IP                                                                                                             |
| `RATE_LIMIT_SESSION_CODE_WINDOW_MINUTES`        | nein         | `5`                        | Zeitfenster (Minuten)                                                                                                                        |
| `RATE_LIMIT_SESSION_CODE_LOCKOUT_SECONDS`       | nein         | `60`                       | Sperre nach zu vielen Fehlversuchen                                                                                                          |
| `RATE_LIMIT_VOTE_REQUESTS_PER_SECOND`           | nein         | `1`                        | Vote-Throttling pro Teilnehmenden-ID                                                                                                         |
| `RATE_LIMIT_SESSION_CREATE_PER_HOUR`            | nein         | `10`                       | Session-Erstellungen pro IP und Stunde                                                                                                       |
| `RATE_LIMIT_SESSION_CREATE_BYPASS_LOCALHOST`    | nein         | —                          | Optionaler Override für den Localhost-Bypass des Session-Create-Limits; ohne Override ist localhost in Nicht-Prod standardmäßig ausgenommen  |
| `RATE_LIMIT_MOTD_GET_CURRENT_PER_MINUTE`        | nein         | `120`                      | MOTD `getCurrent` — Anfragen pro IP und Minute (Epic 10, `motd.ts` / `rateLimit.ts`)                                                         |
| `RATE_LIMIT_MOTD_LIST_ARCHIVE_PER_MINUTE`       | nein         | `60`                       | MOTD `listArchive` — pro IP und Minute                                                                                                       |
| `RATE_LIMIT_MOTD_RECORD_INTERACTION_PER_MINUTE` | nein         | `40`                       | MOTD `recordInteraction` — pro IP und Minute                                                                                                 |
| `ADMIN_SECRET`                                  | für `/admin` | —                          | Shared Secret für Admin-Login (Epic 9); in Prod **stark setzen**                                                                             |
| `ADMIN_SESSION_TTL_SECONDS`                     | nein         | `28800` (8 h)              | Admin-Session-TTL                                                                                                                            |
| `ADMIN_LEGAL_HOLD_DEFAULT_DAYS`                 | nein         | `30`                       | Default-Tage für Legal-Hold-Angaben (Admin)                                                                                                  |

### `JWT_SECRET` (`.env.example`)

In **`.env.example`** und **Docker-/Deploy-Vorlagen** enthalten; im aktuellen **`apps/backend`-Quellcode** gibt es dafür keinen direkten Leser. Für **Produktions-Compose** trotzdem einen starken Wert setzen, solange Deploy-/Operations-Doku diese Variable weiter mitführt oder künftige Features darauf aufbauen.

---

## Produktion (Auszug)

Zusätzlich zu den Backend-Variablen (angepasste Hosts: `postgres`, `redis` im Netzwerk) siehe [`.env.production.example`](../.env.production.example) für **PostgreSQL-Credentials** und Secrets. Nie echte Secrets in Git committen. Falls der Yjs-WebSocket in Containern von außen erreichbar sein muss, `YJS_WS_HOST` explizit passend setzen; `HOST` ist dafür nur der Fallback.

---

## Schnelldiagnose

| Symptom                                                           | Prüfen                                                                                                           |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Prisma-Fehler / keine DB                                          | `DATABASE_URL`, Container `postgres`, `npx prisma db push`                                                       |
| Rate-Limits, Admin-Session oder Blitzlicht verhalten sich seltsam | `REDIS_URL`, Container `redis`                                                                                   |
| tRPC-WebSocket hängt                                              | `WS_PORT` frei, Frontend-Proxy auf gleichen WS-Port                                                              |
| Quiz-Sync zwischen Geräten tot / `wss://…/yjs-ws` schlägt fehl    | Container: `HOST=0.0.0.0` oder `YJS_WS_HOST=0.0.0.0`, Nginx `location /yjs-ws` → `127.0.0.1:3002`, Prozess läuft |
| Admin-Login scheitert                                             | `ADMIN_SECRET` gesetzt und mit Eingabe übereinstimmend                                                           |
| MOTD/API 429 (Too Many Requests)                                  | `RATE_LIMIT_MOTD_*` anpassen oder Last prüfen; öffentliche MOTD-Pfade sind bewusst rate-limited                  |

---

## Verwandte Dokumente

- [onboarding.md](onboarding.md) — Setup-Reihenfolge
- [architecture/handbook.md](architecture/handbook.md) — Architektur- und Stack-Überblick
- [README.md](../README.md) — `npm run dev`, Docker-Hinweise

**Stand:** 2026-04-01 — zuletzt ergänzt: **MOTD-Rate-Limits** (Epic 10, `apps/backend/src/lib/rateLimit.ts`). **`PlatformStatistic`** / Rekordteilnehmer je Session werden in der DB gepflegt, nicht über Env. Bei neuen `process.env`-Lesern diese Tabelle und [`.env.example`](../.env.example) mitziehen.
