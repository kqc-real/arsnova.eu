<!-- markdownlint-disable MD013 -->

# Umgebungsvariablen (Referenz)

**Stand:** 2026-07-25

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

| Variable                                               | Erforderlich | Standard / Beispiel        | Zweck                                                                                                                                                               |
| ------------------------------------------------------ | ------------ | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                                         | ja (für DB)  | siehe `.env.example`       | PostgreSQL-Verbindung (Prisma)                                                                                                                                      |
| `REDIS_URL`                                            | nein         | `redis://localhost:6379`   | Redis für Rate-Limits, Host-/Admin-Session-Tokens und kurzlebige Live-Hilfsdaten (z. B. Blitzlicht-/Presence-Zustand); MOTD-Interaktionszähler liegen in PostgreSQL |
| `PORT`                                                 | nein         | `3000`                     | HTTP-API (Express + tRPC)                                                                                                                                           |
| `HOST`                                                 | nein         | —                          | **Kein** eigener Reader für den HTTP-Server. Wird nur als Fallback für die Bind-Adresse des Yjs-Relays genutzt, wenn `YJS_WS_HOST` fehlt                            |
| `WS_PORT`                                              | nein         | `3001`                     | WebSocket-Server (tRPC-Subscriptions)                                                                                                                               |
| `WS_HOST`                                              | nein         | `0.0.0.0`                  | Bind-Adresse des tRPC-WebSocket-Servers                                                                                                                             |
| `TRPC_WS_MAX_CONNECTIONS`                              | nein         | `1200`                     | Globales tRPC-WebSocket-Verbindungscap je Backend-Prozess mit Reserve oberhalb zweier 500er-Kohorten; Code-Maximum `5000`                                           |
| `TRPC_WS_MAX_CONNECTIONS_PER_SESSION`                  | nein         | `1100`                     | Cap je gültigem Session-Code-Throttle-Signal; stale 500er-Reconnect-Kohorte plus Steuer-Reserve, Code-Minimum `750`, Maximum `5000`, kein Authentifizierungsbeweis  |
| `TRPC_WS_MAX_CONNECTIONS_PER_PARTICIPANT`              | nein         | `2`                        | Cap je gültigem Session-/Participant-UUID-Tupel; Code-Maximum `10`, kein IP-Key und kein Authentifizierungsbeweis                                                   |
| `TRPC_WS_MAX_UPGRADES_PER_MINUTE`                      | nein         | `3000`                     | Globales Upgrade-Budget ohne IP-Bucket; sechs volle 500er-Wellen, Code-Maximum `30000`                                                                              |
| `TRPC_WS_MAX_MESSAGES_PER_10_SECONDS`                  | nein         | `120`                      | Nachrichtenbudget je tRPC-WebSocket und 10 Sekunden; Code-Maximum `1200`                                                                                            |
| `TRPC_WS_MAX_MESSAGES_GLOBAL_PER_10_SECONDS`           | nein         | `30000`                    | Globales Nachrichtenbudget je Backend-Prozess und 10 Sekunden; Code-Maximum `300000`                                                                                |
| `YJS_WS_PORT`                                          | nein         | `3002`                     | Gehärteter Yjs-Relay für den Quiz-Sync                                                                                                                              |
| `YJS_WS_HOST`                                          | nein         | siehe `HOST` / `127.0.0.1` | Bind-Adresse des Yjs-Relays. **Nicht** nur `127.0.0.1` im Container, sonst scheitert `wss://…/yjs-ws` hinter Nginx                                                  |
| `YJS_WS_MAX_CONNECTIONS`                               | nein         | `1000`                     | Globales Verbindungscap je Backend-Prozess; Code-Maximum `2000`                                                                                                     |
| `YJS_WS_MAX_CONNECTIONS_PER_ROOM`                      | nein         | `200`                      | Verbindungscap je `quiz-library-room-<UUID>` mit Reconnect-Reserve; Code-Maximum `500`                                                                              |
| `YJS_WS_MAX_UPGRADES_PER_MINUTE`                       | nein         | `3000`                     | Globales Upgrade-Budget ohne IP-Bucket; Code-Maximum `6000`                                                                                                         |
| `YJS_WS_MAX_UPGRADES_PER_ROOM_PER_MINUTE`              | nein         | `600`                      | Upgrade-Budget je Raum ohne IP-Bucket; Code-Maximum `1200`                                                                                                          |
| `YJS_WS_MAX_PAYLOAD_BYTES`                             | nein         | `16777216`                 | Einzelpayload-Limit 16 MiB für vollständige Quiz-Sammlungen; Code-Maximum 32 MiB                                                                                    |
| `YJS_WS_MAX_MESSAGES_PER_10_SECONDS`                   | nein         | `600`                      | Nachrichtenbudget je Verbindung und 10 Sekunden; Code-Maximum `1200`                                                                                                |
| `YJS_WS_MAX_BYTES_PER_10_SECONDS`                      | nein         | `33554432`                 | Bytebudget je Verbindung und 10 Sekunden; Code-Maximum 64 MiB                                                                                                       |
| `YJS_WS_MAX_MESSAGES_PER_ROOM_PER_10_SECONDS`          | nein         | `6000`                     | Gemeinsames Nachrichtenbudget je Raum und 10 Sekunden; Code-Maximum `12000`                                                                                         |
| `YJS_WS_MAX_BYTES_PER_ROOM_PER_10_SECONDS`             | nein         | `268435456`                | Gemeinsames Bytebudget je Raum und 10 Sekunden; Code-Maximum 512 MiB                                                                                                |
| `YJS_WS_MAX_MESSAGES_GLOBAL_PER_10_SECONDS`            | nein         | `30000`                    | Globales Nachrichtenbudget je Backend-Prozess und 10 Sekunden; Code-Maximum `60000`                                                                                 |
| `YJS_WS_MAX_BYTES_GLOBAL_PER_10_SECONDS`               | nein         | `1073741824`               | Globales Bytebudget je Backend-Prozess und 10 Sekunden; Code-Maximum 2 GiB                                                                                          |
| `YJS_WS_MAX_DOCUMENT_BYTES_PER_ROOM`                   | nein         | `15728640`                 | Obergrenze des zusammengeführten Yjs-Zustands je Raum (15 MiB); Code-Maximum 30 MiB                                                                                 |
| `YJS_WS_MAX_DOCUMENT_BYTES_GLOBAL`                     | nein         | `268435456`                | Global reservierter Yjs-Dokumentzustand je Backend-Prozess (256 MiB); Code-Maximum 512 MiB                                                                          |
| `YJS_WS_MAX_AWARENESS_STATE_BYTES`                     | nein         | `4096`                     | Persistenter Awareness-JSON-State; je Verbindung höchstens eine neu eingeführte ID, bekannte Peer-IDs dürfen rebroadcastet werden; Code-Maximum 16 KiB              |
| `YJS_WS_MAX_OUTBOUND_BYTES_PER_10_SECONDS`             | nein         | `33554432`                 | Tatsächlich versendete Bytes je Verbindung und 10 Sekunden (32 MiB); Code-Maximum 64 MiB                                                                            |
| `YJS_WS_MAX_OUTBOUND_BYTES_PER_ROOM_PER_10_SECONDS`    | nein         | `268435456`                | Tatsächlich versendete Bytes je Raum und 10 Sekunden (256 MiB); Code-Maximum 512 MiB                                                                                |
| `YJS_WS_MAX_OUTBOUND_BYTES_GLOBAL_PER_10_SECONDS`      | nein         | `1073741824`               | Tatsächlich versendete Bytes global und 10 Sekunden (1 GiB); Code-Maximum 2 GiB                                                                                     |
| `NODE_ENV`                                             | nein         | —                          | `production` u. a. für CORS/Static; `development` für lokale Defaults                                                                                               |
| `TRUST_PROXY_HOPS`                                     | nein         | `0`                        | `1` setzen, wenn Express **hinter** Nginx/Proxy läuft — dann `req.ip` und Rate-Limit pro **echtem** Client (nicht nur Proxy-IP)                                     |
| `HOST_SESSION_TTL_SECONDS`                             | nein         | `28800` (8 h)              | TTL für Host-/Present-Besitznachweise in Redis; Werte unter 60 Sekunden fallen auf den Standard zurück                                                              |
| `RATE_LIMIT_SESSION_CODE_WINDOW_SECONDS`               | nein         | `300`                      | Festes Fenster ausschließlich für nicht existente Session-Codes; nur nach unten konfigurierbar                                                                      |
| `RATE_LIMIT_SESSION_CODE_CLIENT_FAILURES_PER_WINDOW`   | nein         | `20`                       | Ungültige Codes pro anonymer Browser-Client-ID; danach 429. Die ID wird nur gehasht im Redis-Key verwendet                                                          |
| `RATE_LIMIT_SESSION_CODE_CODE_SOFT_CAP_PER_WINDOW`     | nein         | `600`                      | Soft-Cap je nicht existentem Code; erzeugt progressiven Delay und Telemetrie, keinen Hard-Lock                                                                      |
| `RATE_LIMIT_SESSION_CODE_GLOBAL_SOFT_CAP_PER_WINDOW`   | nein         | `5000`                     | Globales Soft-Cap; ab Erschöpfung keine neuen Client-/Code-Keys, aber weiterhin nur bounded Delay                                                                   |
| `RATE_LIMIT_SESSION_CODE_DELAY_BASE_MS`                | nein         | `100`                      | Startwert des progressiven Soft-Cap-Delays ab 80 % Auslastung                                                                                                       |
| `RATE_LIMIT_SESSION_CODE_DELAY_MAX_MS`                 | nein         | `1500`                     | Obergrenze des Soft-Cap-Delays; gültige Joins und Rejoins werden nie dadurch verzögert                                                                              |
| `RATE_LIMIT_SESSION_CODE_MAX_CONCURRENT_DELAYS`        | nein         | `100`                      | Maximale gleichzeitig wartende ungültige Code-Abfragen pro Backend-Prozess; weitere werden mit 429 abgewiesen                                                       |
| `RATE_LIMIT_VOTE_REQUESTS_PER_SECOND`                  | nein         | `1`                        | Vote-Throttling pro Teilnehmenden-ID                                                                                                                                |
| `RATE_LIMIT_SESSION_CREATE_PER_HOUR`                   | nein         | `10`                       | Grobes Shared-NAT-IP-Budget für Session-Erstellungen pro festem Stundenfenster                                                                                      |
| `RATE_LIMIT_SESSION_CREATE_GLOBAL_PER_HOUR`            | nein         | `120` (`2400` in Prod)     | Globales Session-Create-Budget gegen verteilten Spam; wird atomar mit dem IP-Budget gebucht. Der höhere Prod-Fallback schützt bestehende Deployments ohne neue Env  |
| `RATE_LIMIT_SESSION_CREATE_BYPASS_LOCALHOST`           | nein         | —                          | Optionaler Override für den Localhost-Bypass des Session-Create-Limits; ohne Override ist localhost in Nicht-Prod standardmäßig ausgenommen                         |
| `RATE_LIMIT_QUIZ_UPLOAD_ATTEMPT_PER_IP_PER_HOUR`       | nein         | `600`                      | Grobes Shared-NAT-Versuchslimit vor fachlicher Zod-Validierung                                                                                                      |
| `RATE_LIMIT_QUIZ_UPLOAD_ATTEMPT_GLOBAL_PER_HOUR`       | nein         | `1200`                     | Globales Versuchslimit vor Zod; zählt auch ungültige Uploads                                                                                                        |
| `RATE_LIMIT_QUIZ_UPLOAD_PER_IP_PER_HOUR`               | nein         | `300`                      | Shared-NAT-Budget für erfolgreich validierte öffentliche Quiz-Uploads                                                                                               |
| `RATE_LIMIT_QUIZ_UPLOAD_GLOBAL_PER_HOUR`               | nein         | `600`                      | Globales Count-Budget für persistierbare Quiz-Uploads                                                                                                               |
| `RATE_LIMIT_QUIZ_UPLOAD_GLOBAL_BYTES_PER_HOUR`         | nein         | `67108864`                 | Atomar mitgebuchtes globales Payload-Budget (64 MiB je festem Stundenfenster)                                                                                       |
| `RATE_LIMIT_QUIZ_UPLOAD_GLOBAL_COMPLEXITY_PER_HOUR`    | nein         | `100000`                   | Globales Komplexitätsbudget: Quiz + Fragen + Antwortoptionen                                                                                                        |
| `RATE_LIMIT_QUICK_FEEDBACK_STANDALONE_PER_IP_PER_HOUR` | nein         | `600`                      | Großzügiges Shared-NAT-Budget für Standalone-Blitzlicht-Erstellungen                                                                                                |
| `RATE_LIMIT_QUICK_FEEDBACK_STANDALONE_GLOBAL_PER_HOUR` | nein         | `3000`                     | Globales Stundenbudget für Standalone-Blitzlicht-Erstellungen                                                                                                       |
| `RATE_LIMIT_QUICK_FEEDBACK_SESSION_PER_MINUTE`         | nein         | `120`                      | Host-authentifizierte Blitzlicht-Starts pro Session und Minute; kein Teilnehmer-/IP-Limit                                                                           |
| `CSP_REPORT_GLOBAL_PER_MINUTE`                         | nein         | `6000`                     | Globales Redis-Budget für `POST /csp-report`; nur bis zum statischen Maximum 6000 konfigurierbar                                                                    |
| `CSP_REPORT_PER_IP_PER_MINUTE`                         | nein         | `120`                      | Grobes Shared-NAT-Budget ausschließlich aus trusted `req.ip`; nur bis zum statischen Maximum 120 konfigurierbar                                                     |
| `CSP_REPORT_FALLBACK_GLOBAL_PER_MINUTE`                | nein         | `6000`                     | Hartes prozesslokales Drop-Cap bei Redis-Ausfall; der Endpoint bleibt 204 und speichert nichts                                                                      |
| `CSP_REPORT_RETENTION_SECONDS`                         | nein         | `604800` (7 Tage)          | TTL der ausschließlich gehashten 10-s-Aggregationsdimensionen; nur bis sieben Tage konfigurierbar                                                                   |
| `RATE_LIMIT_MOTD_GET_CURRENT_PER_MINUTE`               | nein         | `600`                      | MOTD `getCurrent` + `getHeaderState` (gemeinsames Limit) — Anfragen pro IP und Minute (Epic 10, `motd.ts` / `rateLimit.ts`)                                         |
| `RATE_LIMIT_MOTD_GET_CURRENT_BYPASS_LOCALHOST`         | nein         | —                          | Wie Session-Create: optional `true`\|`false`; ohne Override ist **Loopback** in Nicht-Prod für MOTD-Read-Limits ausgenommen (Prerender/Dev)                         |
| `RATE_LIMIT_MOTD_LIST_ARCHIVE_PER_MINUTE`              | nein         | `60`                       | MOTD `listArchive` — pro IP und Minute                                                                                                                              |
| `RATE_LIMIT_MOTD_RECORD_INTERACTION_PER_MINUTE`        | nein         | `40`                       | MOTD `recordInteraction` — pro IP und Minute                                                                                                                        |
| `RATE_LIMIT_ADMIN_LOGIN_WINDOW_SECONDS`                | nein         | `60`                       | Festes Fenster für das globale Budget fehlgeschlagener Admin-Logins                                                                                                 |
| `RATE_LIMIT_ADMIN_LOGIN_GLOBAL_ATTEMPTS_PER_WINDOW`    | nein         | `60`                       | Globales Pre-Auth-Limit für `admin.login`; ohne Permit findet kein Secret-Vergleich statt, kein IP-Lockout                                                          |
| `RATE_LIMIT_ADMIN_LOGIN_DELAY_BASE_MS`                 | nein         | `100`                      | Startwert der exponentiell progressiven Verzögerung für ungültige Admin-Zugangsdaten                                                                                |
| `RATE_LIMIT_ADMIN_LOGIN_DELAY_MAX_MS`                  | nein         | `2000`                     | Maximaler Delay pro ungültigem Admin-Login (hart auf höchstens 5000 ms begrenzt)                                                                                    |
| `RATE_LIMIT_ADMIN_LOGIN_MAX_CONCURRENT_DELAYS`         | nein         | `25`                       | Maximale Anzahl absichtlich wartender Admin-Login-Requests pro Backend-Prozess                                                                                      |
| `ADMIN_SECRET`                                         | für `/admin` | —                          | Shared Secret für Admin-Login (Epic 9); in Prod **stark setzen**                                                                                                    |
| `ADMIN_DIAGNOSTIC_SECRET`                              | für Diagnose | —                          | Separates Secret nur für `health.securityStats`; mindestens 32 Zeichen, darf nicht `ADMIN_SECRET` entsprechen                                                       |
| `CSP_REPORT_HASH_SECRET`                               | empfohlen    | `JWT_SECRET`               | Separater HMAC-Schlüssel (mind. 32 UTF-8-Bytes) für IP-/Dimensionshashes; sonst ausreichend starkes `JWT_SECRET`, zuletzt prozesslokaler Zufallswert                |
| `ADMIN_SESSION_TTL_SECONDS`                            | nein         | `28800` (8 h)              | Admin-Session-TTL                                                                                                                                                   |
| `ADMIN_LEGAL_HOLD_DEFAULT_DAYS`                        | nein         | `30`                       | Default-Tage für Legal-Hold-Angaben (Admin)                                                                                                                         |

`HOST_SESSION_TTL_SECONDS` ist ein optionaler Backend-Reader und wird in den Example-Dateien nicht gesetzt, weil der 8h-Standard für Dev und Produktion der vorgesehene Normalfall ist.

### tRPC-Payload-Limits

tRPC-HTTP-Anfragen und tRPC-WebSocket-Nachrichten sind fest auf **2 MiB** begrenzt (`TRPC_MAX_BODY_SIZE_BYTES` in `apps/backend/src/lib/requestLimits.ts`). Übergroße WebSocket-Nachrichten werden mit Close-Code `1009` beendet. Die Nginx-Produktionskonfiguration verwendet für HTTP mit `client_max_body_size 8m;` ein separates Infrastruktur-Hard-Cap oberhalb dieser Grenze. Dadurch erzeugt tRPC die anwendungsspezifische, auch für `httpBatchLink` kompatible HTTP-413-Antwort; Nginx verwirft nur deutlich größere HTTP-Requests vor dem Backend. Die Limits sind bewusst nicht per Env abschaltbar; Änderungen erfordern Code-, Test- und Deployment-Review.

### CSP-Report-Ingest (W2.4a)

`POST /csp-report` ist die begründete Browser-Reporting-Ausnahme vom
tRPC-only-Grundsatz. Er akzeptiert ausschließlich `application/csp-report` und
`application/reports+json` (optional `charset=utf-8`), maximal 32 KiB Raw Body
und zehn Reports. Falsche Typen liefern 415, Oversize 413, regulär
ausgeschöpfte Redis-Budgets 429; malformed Reports und Redis-Ausfälle werden
ohne Antwortkörper mit 204 verworfen. Es gibt weder Rohreport-, User-Agent-,
Referrer- noch URL-Logging. Redis erhält nur feste Telemetrie-Keys und
HMAC-Digests; pro 10-s-Bucket sind höchstens 256 Dimensionen zulässig.

W2.4a setzt bewusst noch keinen `Content-Security-Policy-Report-Only`- oder
enforcenden CSP-Header. Policy und Browser-Smoke folgen erst in W2.4b.

Der tRPC-WebSocket-Server begrenzt zusätzlich pro Backend-Prozess aktive
Verbindungen, Upgrade-Versuche sowie Nachrichten je Verbindung und global.
Die Defaults lassen 1.200 gleichzeitige Verbindungen und 3.000 Upgrades pro
Minute zu. Damit passen zwei 500er-Kohorten plus Steuer-/Public-Reserve
beziehungsweise sechs vollständige 500er-Reconnect-Wellen in die
Standardbudgets. Es gibt bewusst kein IP-Bucket:
Teilnehmende hinter derselben Schul-/Hochschul-NAT blockieren einander nicht.
Gültige, normalisierte Session-Codes begrenzen standardmäßig auf 1.100
Verbindungen und lassen damit neben 500 aktiven Sockets eine vollständige
500er-Ersatzkohorte sowie 100 Host-/Presenter-Sockets zu; ein
Session-/Participant-UUID-Tupel begrenzt auf zwei. Beide Werte sind
nur prozesslokale Throttle-Signale und ausdrücklich kein Authentifizierungs-
oder Besitznachweis. Fehlende beziehungsweise ungültige Signale bleiben für
Rolling Deployments unter den globalen W2.3a-Caps kompatibel. Der Produktclient
reconnectet mit exponentiellem Backoff plus 0–349 ms Jitter.

`quiz.upload` besitzt zusätzlich fachliche Zod-Caps: maximal **200 Fragen**, **10 Antwortoptionen je Frage** und **1.250.000 UTF-8-Bytes** für den validierten Quiz-Payload. Ein Classroom-Fixture mit 100 Fragen und je vier Optionen liegt darunter. Diese Grenze ergänzt das 2-MiB-Infrastrukturlimit und ist bewusst nicht per Env abschaltbar.

Vor dem Zod-Parser greift ein grobes atomisches Versuchslimit, damit auch
ungültige knapp-2-MiB-Payloads Budget verbrauchen. Nach erfolgreicher
Validierung werden Count, serialisierte UTF-8-Bytes und Komplexität
(`1 + Fragen + Antwortoptionen`) in einem zweiten atomischen Redis-Aufruf
gebucht. Die Env-Werte können die hart geprüften Maxima nur absenken, nicht
erhöhen.

Das stündliche Cleanup verarbeitet nach 24 Stunden Grace Period höchstens
13 Batches zu je 100 Uploads, also 1.300 pro Lauf. Damit liegt seine bounded
Kapazität über dem maximalen Count-Burst von 1.200 akzeptierten Uploads, der
beim Übergang zwischen zwei festen 600er-Stundenfenstern möglich ist. Das
64-MiB-/100.000-Komplexitätsbudget senkt die Rate großer Quizzes zusätzlich.
Direkt sessiongebundene Quizzes bleiben erhalten. Pro `historyScopeId` bleiben
nach der Grace Period höchstens **5** sessionlose Geschwisterkopien erhalten,
solange noch ein Session-Anker im Scope existiert; ältere sessionlose Uploads
werden mitgelöscht. Die Keep-Set-Prüfung sucht höchstens fünf neuere Geschwister
(`LIMIT`, Index `(historyScopeId, createdAt, id)`), statt einen ganzen Scope zu
zählen. Scopes ohne jede Session sowie Uploads ohne Scope werden nach der Grace
Period vollständig bereinigt — ein alleiniger Scope-Anker schützt keine
unbegrenzte Geschwistermenge.

### PDF-Parallelitätslimit

Die ressourcenintensiven Playwright-PDF-Pfade für Session-Ergebnisberichte teilen sich pro Backend-Prozess einen festen Cap von **einem aktiven Job** (`PDF_MAX_CONCURRENT_JOBS` in `apps/backend/src/lib/pdfConcurrencyLimiter.ts`). Weitere Jobs werden ohne Queue mit HTTP 429 abgewiesen. Der konservative Cap folgt aus der Zielhost-Lastabnahme: Cap 2 ließ die Vote-Latenz deutlich über die SLOs steigen. Der Cap ist nicht per Env konfigurierbar oder abschaltbar; Änderungen erfordern Code-, Lasttest- und Deployment-Review. Die aktuelle Produktion läuft mit genau einem Backend-Prozess. Horizontale Skalierung setzt deshalb zuerst einen instanzübergreifenden Semaphore voraus.

### Security- und Lastmonitoring

`health.stats` bleibt öffentlich und liefert UX-/Produktstatistiken sowie
`serviceStatus` und `loadStatus`. Operative PDF-, Create-/429- und
tRPC-WebSocket-Metriken liegen ausschließlich in der admin-geschützten Query
`health.securityStats`. Damit diese Diagnose bei Redis-Ausfall funktioniert,
akzeptiert ausschließlich diese read-only Query das separate
`ADMIN_DIAGNOSTIC_SECRET` im Header `x-admin-diagnostic-secret`. Die Prüfung
erfolgt konstantzeitig und ohne Redis; normale Admin-Prozeduren akzeptieren
diesen Header nicht und verwenden weiterhin Admin-Session-Tokens.
`ADMIN_DIAGNOSTIC_SECRET` muss mindestens 32 Zeichen lang sein und einen
anderen Wert als `ADMIN_SECRET` besitzen. Fehlt es oder verletzt eine dieser
Regeln, bleibt der Diagnosezugang geschlossen.

Create-/429- und PDF-Ergebnisereignisse werden im Prozess bounded aggregiert
und alle fünf Sekunden mit Redis-Pipelines geflusht. Langsames oder
ausgefallenes Redis erzeugt weder parallele Flushes noch eine
angriffsabhängig wachsende Queue; betroffene Batches dürfen zugunsten stabiler
Request-Pfade entfallen.
`rate_limit_429` enthält aus Datenschutzgründen keine vollständige IP, sondern
nur Pfad, Kategorie und `ipSource`. Zusätzliche MOTD-/PDF-429-Speziallogs gibt
es bewusst nicht. Logrotation und kurze Aufbewahrung sind Betreiberpflicht
(Richtwert im Normalbetrieb höchstens 14 Tage).

Die initialen Warn-/Kritisch-Schwellen, CPU-Diagnose und manuellen
On-Call-Maßnahmen (W0.4) stehen im
[Monitoring-Runbook](operations/MONITORING-RUNBOOK.md). Diese Beobachtung
ergänzt die Limits, verschärft aber keine Teilnehmerpfade anhand einer
gemeinsam genutzten NAT-IP. Automatische Alarmierung ist erst Bestandteil von
W3.7.

Der reproduzierbare PDF-vs.-Voting-Lasttest liest `health.securityStats` und
erwartet deshalb `ADMIN_DIAGNOSTIC_SECRET` nur in der Umgebung des
Lasttest-Prozesses. Der Wert ist ein separates, ausschließlich lesendes
Diagnose-Credential, darf nicht in Reports oder Shell-Historien gelangen und
muss nach dem Lauf aus der Shell entfernt werden. `ADMIN_SECRET` darf dafür
niemals eingesetzt werden.

### `JWT_SECRET` (`.env.example`)

In **`.env.example`** und **Docker-/Deploy-Vorlagen** enthalten; im aktuellen **`apps/backend`-Quellcode** gibt es dafür keinen direkten Leser. Für **Produktions-Compose** trotzdem einen starken Wert setzen, solange Deploy-/Operations-Doku diese Variable weiter mitführt oder künftige Features darauf aufbauen.

---

## Produktion (Auszug)

Zusätzlich zu den Backend-Variablen (angepasste Hosts: `postgres`, `redis` im Netzwerk) siehe [`.env.production.example`](../.env.production.example) für **PostgreSQL-Credentials** und Secrets. Nie echte Secrets in Git committen. Falls der Yjs-WebSocket in Containern von außen erreichbar sein muss, `YJS_WS_HOST` explizit passend setzen; `HOST` ist dafür nur der Fallback.

### Pflichtwerte vor Go-Live

Für einen öffentlichen Betrieb müssen mindestens diese Werte bewusst gesetzt und geprüft sein:

| Bereich                | Variablen / Prüfung                                                                                                                                                      |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Datenbank              | `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `DATABASE_URL`; Passwort und URL müssen zusammenpassen                                                              |
| Redis                  | `REDIS_URL=redis://redis:6379` im Compose-Netzwerk; Redis nicht öffentlich exponieren                                                                                    |
| Secrets                | `ADMIN_SECRET` und separates `ADMIN_DIAGNOSTIC_SECRET` stark und verschieden setzen; `JWT_SECRET` weiterhin stark setzen, solange Deploy-/Operations-Vorlagen ihn führen |
| Reverse Proxy          | `TRUST_PROXY_HOPS=1` hinter genau einem Nginx/Proxy, damit Rate-Limits echte Client-IPs sehen                                                                            |
| WebSockets             | `WS_PORT=3001`, `YJS_WS_PORT=3002`, `YJS_WS_HOST=0.0.0.0`; Nginx routet `/trpc-ws` und `/yjs-ws`                                                                         |
| Admin                  | `ADMIN_SESSION_TTL_SECONDS`, `ADMIN_LEGAL_HOLD_DEFAULT_DAYS`; Login, Legal-Hold, Löschung und Export testen                                                              |
| Rate-Limits            | Produktionsprofil aus `.env.production.example` übernehmen und nach realem NAT-/Proxy-Umfeld anpassen                                                                    |
| Nicht in Env steuerbar | Session-Retention, BonusToken-Retention und SessionFeedback-Retention sind aktuell Code-Konstanten                                                                       |

### Empfohlenes Profil: hochfrequentierter Betrieb

Für Installationen mit vielen Einrichtungen hinter Shared-NAT/Proxy (z. B. Schulen/Hochschulen/Business) enthält `.env.production.example` bewusst ein großzügigeres Startprofil:

- `TRUST_PROXY_HOPS=1` (hinter Nginx/Reverse-Proxy)
- Session-Erstellungen: `480` pro Shared-NAT-IP und `2400` global pro Stunde
- Quiz-Upload-Versuche: `600` pro Shared-NAT-IP und `1200` global pro Stunde
- Persistierbare Quiz-Uploads: `300` pro Shared-NAT-IP und `600` global, zusätzlich 64 MiB und 100.000 Komplexitätseinheiten pro Stunde
- `RATE_LIMIT_QUICK_FEEDBACK_STANDALONE_PER_IP_PER_HOUR=600` plus global `3000` pro Stunde
- `RATE_LIMIT_QUICK_FEEDBACK_SESSION_PER_MINUTE=120` pro authentifizierter Session
- `RATE_LIMIT_SESSION_CODE_CLIENT_FAILURES_PER_WINDOW=20`
- `RATE_LIMIT_SESSION_CODE_CODE_SOFT_CAP_PER_WINDOW=600`
- `RATE_LIMIT_SESSION_CODE_GLOBAL_SOFT_CAP_PER_WINDOW=5000`
- `RATE_LIMIT_SESSION_CODE_DELAY_MAX_MS=1500`
- `RATE_LIMIT_VOTE_REQUESTS_PER_SECOND=2`
- `RATE_LIMIT_MOTD_GET_CURRENT_PER_MINUTE=1200`
- `RATE_LIMIT_MOTD_LIST_ARCHIVE_PER_MINUTE=180`
- `RATE_LIMIT_MOTD_RECORD_INTERACTION_PER_MINUTE=120`

Wichtig: Das sind **Betriebswerte** für die Produktionsvorlage. Ohne Variablen
gelten 10 Session-Erstellungen pro IP sowie 120 global pro Stunde. Für
`NODE_ENV=production` fällt ausschließlich das neue Globalbudget auf 2400
zurück, damit bestehende persistente `.env.production`-Dateien beim ersten
Rollout nicht unbemerkt auf 120/h begrenzt werden. Die Variable soll trotzdem
explizit in die produktive Env übernommen werden.

Alle IP-basierten Backend-Entscheidungen verwenden ausschließlich das von Express gemäß `TRUST_PROXY_HOPS` abgeleitete `req.ip`; rohe `CF-Connecting-IP`-, `True-Client-IP`-, `X-Forwarded-For`- und `X-Real-IP`-Header werden ignoriert. Der dokumentierte Einzel-Nginx überschreibt `X-Forwarded-For` mit `$remote_addr`; `TRUST_PROXY_HOPS=1` lässt Express genau diesem Hop vertrauen. Der separate tRPC-WebSocket-Server ergänzt Upgrade-Requests mit derselben `proxy-addr`-/Hop-Vertrauensfunktion. Ohne konfigurierten Proxy-Hop wird auch dort ausschließlich die direkte Socket-Adresse verwendet. Die Public-Create-Budgets werden in einem atomaren Redis-Skript gemeinsam geprüft. Das verhindert Parallelitäts-Bypässe; nach ausgeschöpftem Globalbudget entstehen keine weiteren IP-Keys. Die hohen IP-Schwellen sind nur ein grobes Zusatzsignal für Shared-NAT. Das Globalbudget ist der verteilte Notanker und kann bei einer gezielten verteilten Welle legitime Creates vorübergehend ablehnen; Join, Vote, Q&A und Blitzlicht-Votes sind davon nicht betroffen.

Öffentliche Session-Code-Lookups und `session.join` verwenden keinerlei IP-Key
oder Participant-IP-Lock. Das Backend stellt zuerst fest, ob Session oder
Standalone-Blitzlicht existieren; gültige Lookups, Joins und Rejoins berühren
das Fehlbudget nicht. Nur nicht existente Codes buchen in einem Lua-Aufruf die
anwendbaren Budgets. Client-IDs und Codes stehen nur als SHA-256-Hash in den
Redis-Keys. Während des Service-Worker-Rollouts buchen Vorgängerclients ohne
`anonymousClientId` nur Code- und Globalbudget; sie erzeugen weder einen
Client- noch einen IP-Ersatzkey. Ab 80 % Code- oder Globalauslastung steigt der
Delay progressiv bis zum konfigurierten Maximum; er bleibt ein Soft-Cap ohne
saalweite Ablehnung. Pro Prozess ist die Anzahl gleichzeitig wartender
ungültiger Requests begrenzt; bei voller Wartemenge erhalten nur weitere
ungültige Requests 429. Ist das globale Budget voll, erzeugt der Pfad keine
neuen angreiferkontrollierten Keys. Ein Redis-Ausfall lässt gültige Lookups und
Joins unbeeinträchtigt, während der ungültige Pfad fail-closed fehlschlägt.

---

## Schnelldiagnose

| Symptom                                                           | Prüfen                                                                                                                                                                                                                          |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Prisma-Fehler / keine DB                                          | `DATABASE_URL`, Container `postgres`, `npx prisma db push`                                                                                                                                                                      |
| Rate-Limits, Admin-Session oder Blitzlicht verhalten sich seltsam | `REDIS_URL`, Container `redis`                                                                                                                                                                                                  |
| tRPC-WebSocket hängt                                              | `WS_PORT` frei, Frontend-Proxy auf gleichen WS-Port                                                                                                                                                                             |
| Quiz-Sync zwischen Geräten tot / `wss://…/yjs-ws` schlägt fehl    | Container: `HOST=0.0.0.0` oder `YJS_WS_HOST=0.0.0.0`, Nginx `location /yjs-ws` → `127.0.0.1:3002`, Prozess läuft                                                                                                                |
| Admin-Login scheitert                                             | `ADMIN_SECRET` gesetzt und mit Eingabe übereinstimmend                                                                                                                                                                          |
| Alle Clients landen im selben Rate-Limit-Bucket                   | `TRUST_PROXY_HOPS=1`, Nginx-Header `X-Forwarded-For` / `X-Real-IP`, Backend-Neustart nach Env-Änderung                                                                                                                          |
| Server-Status zeigt nur Fallbackwerte                             | `DATABASE_URL`, `REDIS_URL`, `health.footerBundle`, `health.stats`, PostgreSQL-Tabellen `PlatformStatistic` / `DailyStatistic`, Redis-Erreichbarkeit                                                                            |
| MOTD/API 429 (Too Many Requests)                                  | Zentrales gesampeltes `rate_limit_429` mit Pfad, Kategorie und `ipSource` sowie diagnose-geschützte Aggregate in `health.securityStats`; spezielle MOTD-Logs, Client-IP und IP-haltiger Redis-Key werden bewusst nicht geloggt. |

### MOTD 429 / „keine Last, aber 429“ – Vorgehen (belegbar)

1. **Backend-Log suchen**: zentrales `rate_limit_429` mit Kategorie `motd`
   (gesampelt, ohne Client-IP).
2. **IP-Quelle prüfen (`ipSource`)**:
   - `express-req-ip`: Express hat anhand des konfigurierten Trust-Proxy-Modells entschieden.
   - `socket`: kein Express-IP-Kontext; direkte Socket-Adresse als Fallback.
   - `missing-req`: kein Request bzw. keine Socket-Adresse verfügbar.
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
