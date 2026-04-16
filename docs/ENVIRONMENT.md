<!-- markdownlint-disable MD013 -->

# Umgebungsvariablen (Referenz)

**Lokal:** Vorlage [`../.env.example`](../.env.example) nach `.env` kopieren und anpassen.  
**Produktion (Docker):** Vorlage [`.env.production.example`](../.env.production.example) → `.env.production`; siehe auch [deployment-debian-root-server.md](deployment-debian-root-server.md).

Die Example-Dateien sind bewusst gleich aufgebaut:

1. **Credentials/Secrets zuerst**
2. Laufzeit/Netzwerk
3. Admin-Konfiguration
4. Rate-Limits

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
| `TRUST_PROXY_HOPS`                              | nein         | `0`                        | `1` setzen, wenn Express **hinter** Nginx/Proxy läuft — dann `req.ip` und Rate-Limit pro **echtem** Client (nicht nur Proxy-IP)              |
| `RATE_LIMIT_SESSION_CODE_ATTEMPTS`              | nein         | `5`                        | Fehlversuche Session-Code pro IP                                                                                                             |
| `RATE_LIMIT_SESSION_CODE_WINDOW_MINUTES`        | nein         | `5`                        | Zeitfenster (Minuten)                                                                                                                        |
| `RATE_LIMIT_SESSION_CODE_LOCKOUT_SECONDS`       | nein         | `60`                       | Sperre nach zu vielen Fehlversuchen                                                                                                          |
| `RATE_LIMIT_VOTE_REQUESTS_PER_SECOND`           | nein         | `1`                        | Vote-Throttling pro Teilnehmenden-ID                                                                                                         |
| `RATE_LIMIT_SESSION_CREATE_PER_HOUR`            | nein         | `10`                       | Session-Erstellungen pro IP und Stunde                                                                                                       |
| `RATE_LIMIT_SESSION_CREATE_BYPASS_LOCALHOST`    | nein         | —                          | Optionaler Override für den Localhost-Bypass des Session-Create-Limits; ohne Override ist localhost in Nicht-Prod standardmäßig ausgenommen  |
| `RATE_LIMIT_MOTD_GET_CURRENT_PER_MINUTE`        | nein         | `600`                      | MOTD `getCurrent` + `getHeaderState` (gemeinsames Limit) — Anfragen pro IP und Minute (Epic 10, `motd.ts` / `rateLimit.ts`)                  |
| `RATE_LIMIT_MOTD_GET_CURRENT_BYPASS_LOCALHOST`  | nein         | —                          | Wie Session-Create: optional `true`\|`false`; ohne Override ist **Loopback** in Nicht-Prod für MOTD-Read-Limits ausgenommen (Prerender/Dev)  |
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

### Empfohlenes Profil: hochfrequentierter Betrieb

Für Installationen mit vielen Einrichtungen hinter Shared-NAT/Proxy (z. B. Schulen/Hochschulen/Business) enthält `.env.production.example` bewusst ein großzügigeres Startprofil:

- `TRUST_PROXY_HOPS=1` (hinter Nginx/Reverse-Proxy)
- `RATE_LIMIT_SESSION_CREATE_PER_HOUR=480`
- `RATE_LIMIT_SESSION_CODE_ATTEMPTS=20`
- `RATE_LIMIT_SESSION_CODE_LOCKOUT_SECONDS=45`
- `RATE_LIMIT_VOTE_REQUESTS_PER_SECOND=2`
- `RATE_LIMIT_MOTD_GET_CURRENT_PER_MINUTE=1200`
- `RATE_LIMIT_MOTD_LIST_ARCHIVE_PER_MINUTE=180`
- `RATE_LIMIT_MOTD_RECORD_INTERACTION_PER_MINUTE=120`

Wichtig: Das sind **Betriebswerte** für die Produktionsvorlage. Die Backend-Code-Defaults (wenn Variablen fehlen) bleiben weiterhin konservativ (z. B. `RATE_LIMIT_SESSION_CREATE_PER_HOUR=10`).

---

## Schnelldiagnose

| Symptom                                                           | Prüfen                                                                                                                                                                                                                                |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Prisma-Fehler / keine DB                                          | `DATABASE_URL`, Container `postgres`, `npx prisma db push`                                                                                                                                                                            |
| Rate-Limits, Admin-Session oder Blitzlicht verhalten sich seltsam | `REDIS_URL`, Container `redis`                                                                                                                                                                                                        |
| tRPC-WebSocket hängt                                              | `WS_PORT` frei, Frontend-Proxy auf gleichen WS-Port                                                                                                                                                                                   |
| Quiz-Sync zwischen Geräten tot / `wss://…/yjs-ws` schlägt fehl    | Container: `HOST=0.0.0.0` oder `YJS_WS_HOST=0.0.0.0`, Nginx `location /yjs-ws` → `127.0.0.1:3002`, Prozess läuft                                                                                                                      |
| Admin-Login scheitert                                             | `ADMIN_SECRET` gesetzt und mit Eingabe übereinstimmend                                                                                                                                                                                |
| MOTD/API 429 (Too Many Requests)                                  | **Beleg:** Backend-Log `motd:rate_limit_429` mit `clientIp`, `ipSource` (woher die IP kam), `redisKey`, `limitPerMinute`. Redis: `ZCARD <redisKey>` — Anzahl der Einträge im 60s-Fenster (siehe `apps/backend/src/lib/rateLimit.ts`). |

### MOTD 429 / „keine Last, aber 429“ – Vorgehen (belegbar)

1. **Backend-Log suchen**: `motd:rate_limit_429` (Event-Objekt).
2. **IP-Quelle prüfen (`ipSource`)**:
   - `x-forwarded-for` / `x-real-ip`: Reverse-Proxy liefert Client-IP mit.
   - `express-req-ip`: Express hat bereits eine IP entschieden (nur korrekt, wenn Proxy-Setup passt).
   - `socket`: direkte Verbindung, kein Proxy-Header.
3. **Redis-Schlüssel prüfen (`redisKey`)**:

```bash
redis-cli ZCARD "<redisKey>"
redis-cli TTL "<redisKey>"
```

1. **Wenn alle Clients in einen Bucket fallen**:
   - `TRUST_PROXY_HOPS=1` setzen (typisch hinter Nginx) und Backend neu starten.
2. **Wenn es ein Trigger-/Loop-Problem im Client ist**:
   - Frontend hat Schutz gegen Request-Stürme (in-flight dedupe + Mindestabstand) in `apps/frontend/src/app/core/motd-header-state.service.ts`.

---

## Verwandte Dokumente

- [onboarding.md](onboarding.md) — Setup-Reihenfolge
- [architecture/handbook.md](architecture/handbook.md) — Architektur- und Stack-Überblick
- [README.md](../README.md) — `npm run dev`, Docker-Hinweise

**Stand:** 2026-04-01 — zuletzt ergänzt: **MOTD-Rate-Limits** (Epic 10, `apps/backend/src/lib/rateLimit.ts`). **`PlatformStatistic`** / Rekordteilnehmer je Session werden in der DB gepflegt, nicht über Env. Bei neuen `process.env`-Lesern diese Tabelle und [`.env.example`](../.env.example) mitziehen.
