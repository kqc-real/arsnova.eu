<!-- markdownlint-disable MD013 -->

# Umgebungsvariablen (Referenz)

**Stand:** 2026-07-24

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

| Variable                                        | Erforderlich | Standard / Beispiel        | Zweck                                                                                                                                                               |
| ----------------------------------------------- | ------------ | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                                  | ja (für DB)  | siehe `.env.example`       | PostgreSQL-Verbindung (Prisma)                                                                                                                                      |
| `REDIS_URL`                                     | nein         | `redis://localhost:6379`   | Redis für Rate-Limits, Host-/Admin-Session-Tokens und kurzlebige Live-Hilfsdaten (z. B. Blitzlicht-/Presence-Zustand); MOTD-Interaktionszähler liegen in PostgreSQL |
| `PORT`                                          | nein         | `3000`                     | HTTP-API (Express + tRPC)                                                                                                                                           |
| `HOST`                                          | nein         | —                          | **Kein** eigener Reader für den HTTP-Server. Wird im aktuellen Code nur als **Fallback** für den Yjs-Child genutzt, wenn `YJS_WS_HOST` fehlt                        |
| `WS_PORT`                                       | nein         | `3001`                     | WebSocket-Server (tRPC-Subscriptions)                                                                                                                               |
| `YJS_WS_PORT`                                   | nein         | `3002`                     | y-websocket-Relay (Quiz-Sync)                                                                                                                                       |
| `YJS_WS_HOST`                                   | nein         | siehe `HOST` / `127.0.0.1` | Bind-Adresse des Yjs-Childs (`@y/websocket-server`). **Nicht** nur `127.0.0.1` in Docker, sonst scheitert `wss://…/yjs-ws` hinter Nginx                             |
| `NODE_ENV`                                      | nein         | —                          | `production` u. a. für CORS/Static; `development` für lokale Defaults                                                                                               |
| `TRUST_PROXY_HOPS`                              | nein         | `0`                        | `1` setzen, wenn Express **hinter** Nginx/Proxy läuft — dann `req.ip` und Rate-Limit pro **echtem** Client (nicht nur Proxy-IP)                                     |
| `HOST_SESSION_TTL_SECONDS`                      | nein         | `28800` (8 h)              | TTL für Host-/Present-Besitznachweise in Redis; Werte unter 60 Sekunden fallen auf den Standard zurück                                                              |
| `RATE_LIMIT_SESSION_CODE_ATTEMPTS`              | nein         | `5`                        | Fehlversuche Session-Code pro IP                                                                                                                                    |
| `RATE_LIMIT_SESSION_CODE_WINDOW_MINUTES`        | nein         | `5`                        | Zeitfenster (Minuten)                                                                                                                                               |
| `RATE_LIMIT_SESSION_CODE_LOCKOUT_SECONDS`       | nein         | `60`                       | Sperre nach zu vielen Fehlversuchen                                                                                                                                 |
| `RATE_LIMIT_VOTE_REQUESTS_PER_SECOND`           | nein         | `1`                        | Vote-Throttling pro Teilnehmenden-ID                                                                                                                                |
| `RATE_LIMIT_SESSION_CREATE_PER_HOUR`            | nein         | `10`                       | Session-Erstellungen pro IP und Stunde                                                                                                                              |
| `RATE_LIMIT_SESSION_CREATE_BYPASS_LOCALHOST`    | nein         | —                          | Optionaler Override für den Localhost-Bypass des Session-Create-Limits; ohne Override ist localhost in Nicht-Prod standardmäßig ausgenommen                         |
| `RATE_LIMIT_MOTD_GET_CURRENT_PER_MINUTE`        | nein         | `600`                      | MOTD `getCurrent` + `getHeaderState` (gemeinsames Limit) — Anfragen pro IP und Minute (Epic 10, `motd.ts` / `rateLimit.ts`)                                         |
| `RATE_LIMIT_MOTD_GET_CURRENT_BYPASS_LOCALHOST`  | nein         | —                          | Wie Session-Create: optional `true`\|`false`; ohne Override ist **Loopback** in Nicht-Prod für MOTD-Read-Limits ausgenommen (Prerender/Dev)                         |
| `RATE_LIMIT_MOTD_LIST_ARCHIVE_PER_MINUTE`       | nein         | `60`                       | MOTD `listArchive` — pro IP und Minute                                                                                                                              |
| `RATE_LIMIT_MOTD_RECORD_INTERACTION_PER_MINUTE` | nein         | `40`                       | MOTD `recordInteraction` — pro IP und Minute                                                                                                                        |
| `ADMIN_SECRET`                                  | für `/admin` | —                          | Shared Secret für Admin-Login (Epic 9); in Prod **stark setzen**                                                                                                    |
| `ADMIN_SESSION_TTL_SECONDS`                     | nein         | `28800` (8 h)              | Admin-Session-TTL                                                                                                                                                   |
| `ADMIN_LEGAL_HOLD_DEFAULT_DAYS`                 | nein         | `30`                       | Default-Tage für Legal-Hold-Angaben (Admin)                                                                                                                         |

`HOST_SESSION_TTL_SECONDS` ist ein optionaler Backend-Reader und wird in den Example-Dateien nicht gesetzt, weil der 8h-Standard für Dev und Produktion der vorgesehene Normalfall ist.

### tRPC-Payload-Limits

tRPC-HTTP-Anfragen und tRPC-WebSocket-Nachrichten sind fest auf **2 MiB** begrenzt (`TRPC_MAX_BODY_SIZE_BYTES` in `apps/backend/src/lib/requestLimits.ts`). Übergroße WebSocket-Nachrichten werden mit Close-Code `1009` beendet. Die Nginx-Produktionskonfiguration verwendet für HTTP mit `client_max_body_size 8m;` ein separates Infrastruktur-Hard-Cap oberhalb dieser Grenze. Dadurch erzeugt tRPC die anwendungsspezifische, auch für `httpBatchLink` kompatible HTTP-413-Antwort; Nginx verwirft nur deutlich größere HTTP-Requests vor dem Backend. Die Limits sind bewusst nicht per Env abschaltbar; Änderungen erfordern Code-, Test- und Deployment-Review.

### PDF-Parallelitätslimit

Die ressourcenintensiven Playwright-PDF-Pfade für Session-Ergebnisberichte teilen sich pro Backend-Prozess einen festen Cap von **einem aktiven Job** (`PDF_MAX_CONCURRENT_JOBS` in `apps/backend/src/lib/pdfConcurrencyLimiter.ts`). Weitere Jobs werden ohne Queue mit HTTP 429 abgewiesen. Der konservative Cap folgt aus der Zielhost-Lastabnahme: Cap 2 ließ die Vote-Latenz deutlich über die SLOs steigen. Der Cap ist nicht per Env konfigurierbar oder abschaltbar; Änderungen erfordern Code-, Lasttest- und Deployment-Review. Die aktuelle Produktion läuft mit genau einem Backend-Prozess. Horizontale Skalierung setzt deshalb zuerst einen instanzübergreifenden Semaphore voraus.

### Security- und Lastmonitoring

`health.stats` bleibt öffentlich und liefert UX-/Produktstatistiken sowie
`serviceStatus` und `loadStatus`. Operative PDF-, Create-/429- und
tRPC-WebSocket-Metriken liegen ausschließlich in der admin-geschützten Query
`health.securityStats`; sie akzeptiert ein gültiges Admin-Session-Token via
`Authorization: Bearer ...` oder `x-admin-token`, niemals direkt das
`ADMIN_SECRET`.

Create-/429-Ereignisse werden im Prozess bounded aggregiert und alle fünf
Sekunden mit einer Redis-Pipeline geflusht. Langsames oder ausgefallenes Redis
erzeugt weder parallele Flushes noch eine angriffsabhängig wachsende Queue;
betroffene Batches dürfen zugunsten stabiler Request-Pfade entfallen.
`rate_limit_429` enthält aus Datenschutzgründen keine vollständige IP, sondern
nur Pfad, Kategorie und `ipSource`. `pdf:*` sind die zugehörigen strukturierten
Backend-Log-Ereignisse. Logrotation und kurze Aufbewahrung sind Betreiberpflicht
(Richtwert im Normalbetrieb höchstens 14 Tage).

Die initialen Warn-/Kritisch-Schwellen, CPU-Diagnose und manuellen
On-Call-Maßnahmen (W0.4) stehen im
[Monitoring-Runbook](operations/MONITORING-RUNBOOK.md). Diese Beobachtung
ergänzt die Limits, verschärft aber keine Teilnehmerpfade anhand einer
gemeinsam genutzten NAT-IP. Automatische Alarmierung ist erst Bestandteil von
W3.7.

Der reproduzierbare PDF-vs.-Voting-Lasttest liest `health.securityStats` und
erwartet deshalb `ADMIN_TOKEN` nur in der Umgebung des Lasttest-Prozesses.
Dabei handelt es sich um ein kurzlebiges Admin-Session-Token aus `admin.login`,
nicht um eine zusätzliche Backend-Konfiguration; nicht in `.env` oder Reports
persistieren und nach dem Lauf aus der Shell entfernen.

### `JWT_SECRET` (`.env.example`)

In **`.env.example`** und **Docker-/Deploy-Vorlagen** enthalten; im aktuellen **`apps/backend`-Quellcode** gibt es dafür keinen direkten Leser. Für **Produktions-Compose** trotzdem einen starken Wert setzen, solange Deploy-/Operations-Doku diese Variable weiter mitführt oder künftige Features darauf aufbauen.

---

## Produktion (Auszug)

Zusätzlich zu den Backend-Variablen (angepasste Hosts: `postgres`, `redis` im Netzwerk) siehe [`.env.production.example`](../.env.production.example) für **PostgreSQL-Credentials** und Secrets. Nie echte Secrets in Git committen. Falls der Yjs-WebSocket in Containern von außen erreichbar sein muss, `YJS_WS_HOST` explizit passend setzen; `HOST` ist dafür nur der Fallback.

### Pflichtwerte vor Go-Live

Für einen öffentlichen Betrieb müssen mindestens diese Werte bewusst gesetzt und geprüft sein:

| Bereich                | Variablen / Prüfung                                                                                                                      |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Datenbank              | `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `DATABASE_URL`; Passwort und URL müssen zusammenpassen                              |
| Redis                  | `REDIS_URL=redis://redis:6379` im Compose-Netzwerk; Redis nicht öffentlich exponieren                                                    |
| Secrets                | `ADMIN_SECRET` stark und eindeutig pro Installation; `JWT_SECRET` weiterhin stark setzen, solange Deploy-/Operations-Vorlagen ihn führen |
| Reverse Proxy          | `TRUST_PROXY_HOPS=1` hinter genau einem Nginx/Proxy, damit Rate-Limits echte Client-IPs sehen                                            |
| WebSockets             | `WS_PORT=3001`, `YJS_WS_PORT=3002`, `YJS_WS_HOST=0.0.0.0`; Nginx routet `/trpc-ws` und `/yjs-ws`                                         |
| Admin                  | `ADMIN_SESSION_TTL_SECONDS`, `ADMIN_LEGAL_HOLD_DEFAULT_DAYS`; Login, Legal-Hold, Löschung und Export testen                              |
| Rate-Limits            | Produktionsprofil aus `.env.production.example` übernehmen und nach realem NAT-/Proxy-Umfeld anpassen                                    |
| Nicht in Env steuerbar | Session-Retention, BonusToken-Retention und SessionFeedback-Retention sind aktuell Code-Konstanten                                       |

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

| Symptom                                                           | Prüfen                                                                                                                                                                                                          |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Prisma-Fehler / keine DB                                          | `DATABASE_URL`, Container `postgres`, `npx prisma db push`                                                                                                                                                      |
| Rate-Limits, Admin-Session oder Blitzlicht verhalten sich seltsam | `REDIS_URL`, Container `redis`                                                                                                                                                                                  |
| tRPC-WebSocket hängt                                              | `WS_PORT` frei, Frontend-Proxy auf gleichen WS-Port                                                                                                                                                             |
| Quiz-Sync zwischen Geräten tot / `wss://…/yjs-ws` schlägt fehl    | Container: `HOST=0.0.0.0` oder `YJS_WS_HOST=0.0.0.0`, Nginx `location /yjs-ws` → `127.0.0.1:3002`, Prozess läuft                                                                                                |
| Admin-Login scheitert                                             | `ADMIN_SECRET` gesetzt und mit Eingabe übereinstimmend                                                                                                                                                          |
| Alle Clients landen im selben Rate-Limit-Bucket                   | `TRUST_PROXY_HOPS=1`, Nginx-Header `X-Forwarded-For` / `X-Real-IP`, Backend-Neustart nach Env-Änderung                                                                                                          |
| Server-Status zeigt nur Fallbackwerte                             | `DATABASE_URL`, `REDIS_URL`, `health.footerBundle`, `health.stats`, PostgreSQL-Tabellen `PlatformStatistic` / `DailyStatistic`, Redis-Erreichbarkeit                                                            |
| MOTD/API 429 (Too Many Requests)                                  | Backend-Log `motd:rate_limit_429` mit Procedure, `ipSource`, Limit und Retry-Zeit sowie admin-geschützte Aggregate in `health.securityStats`; Client-IP und IP-haltiger Redis-Key werden bewusst nicht geloggt. |

### MOTD 429 / „keine Last, aber 429“ – Vorgehen (belegbar)

1. **Backend-Log suchen**: `motd:rate_limit_429` (Event-Objekt ohne Client-IP).
2. **IP-Quelle prüfen (`ipSource`)**:
   - `x-forwarded-for` / `x-real-ip`: Reverse-Proxy liefert Client-IP mit.
   - `express-req-ip`: Express hat bereits eine IP entschieden (nur korrekt, wenn Proxy-Setup passt).
   - `socket`: direkte Verbindung, kein Proxy-Header.
3. **Wenn alle Clients in einen Bucket fallen**:
   - `TRUST_PROXY_HOPS=1` setzen (typisch hinter Nginx) und Backend neu starten.
4. **Wenn es ein Trigger-/Loop-Problem im Client ist**:
   - Frontend hat Schutz gegen Request-Stürme (in-flight dedupe + Mindestabstand) in `apps/frontend/src/app/core/motd-header-state.service.ts`.

---

## Verwandte Dokumente

- [onboarding.md](onboarding.md) — Setup-Reihenfolge
- [architecture/handbook.md](architecture/handbook.md) — Architektur- und Stack-Überblick
- [features/server-status-widget.md](features/server-status-widget.md) — Server-Status, Laststatus und Plattformstatistik
- [deployment-debian-root-server.md](deployment-debian-root-server.md) — Produktions-Deployment mit Docker Compose und Nginx
- [README.md](../README.md) — `npm run dev`, Docker-Hinweise

**Stand:** 2026-07-24 — abgeglichen mit [`.env.example`](../.env.example), [`.env.production.example`](../.env.production.example), [`docker-compose.prod.yml`](../docker-compose.prod.yml), [deployment-debian-root-server.md](deployment-debian-root-server.md), [docs/TESTING.md](TESTING.md) und den aktuellen Env-Readern im Backend. **`PlatformStatistic`**, **`DailyStatistic`** und MOTD-Interaktionszähler werden in der DB gepflegt, nicht über Env. Bei neuen `process.env`-Lesern diese Tabelle und [`.env.example`](../.env.example) mitziehen.
