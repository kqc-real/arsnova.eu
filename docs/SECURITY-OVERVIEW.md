<!-- markdownlint-disable MD013 -->

# Sicherheit & Datenschutz — Überblick

Kurzreferenz für **Annahmen, Grenzen und eingebaute Kontrollen**. Kein vollständiges Threat-Model und keine Rechtsberatung; technische Tiefe: Handbuch, ADRs, Prisma, `session.ts` / DTO-Schicht.

**Stand:** 2026-07-25 — abgeglichen mit Root-[README](../README.md), [docs/README.md](README.md), [deployment-debian-root-server.md](deployment-debian-root-server.md), [ENVIRONMENT.md](ENVIRONMENT.md), [TESTING.md](TESTING.md), Admin-Flow und aktuellem Backend. Enthalten sind Host-/Feedback-Host-Token, Admin-Tokens, besitzgebundene Quiz-Historie (`accessProof`), MOTD, öffentlicher Server-Status (`health.footerBundle` / `health.stats`), admin-geschützte Betriebsmetriken (`health.securityStats`) und Plattformstatistik (`PlatformStatistic`, `DailyStatistic`).

---

## 1. Produktkontext

- **Accountfrei:** Kein Nutzer-/Login-Modell für Lehrende oder Teilnehmende. Identität **realer Personen** hält die App nicht fest; Pseudonyme und freiwillige Einreichung von Bonus-Codes sind dokumentiert ([bonus-codes](features/bonus-codes.md)).
- **Local-First (Quiz):** Dauerhafte **Quiz-Sammlung** primär im Browser (Yjs); Server erhält eine **flüchtige Kopie** für die Live-Session ([ADR-0004](architecture/decisions/0004-use-yjs-for-local-first-storage.md), Handbook §3.1).
- **Quiz-Sync-Zugriff:** Der Relay akzeptiert ausschließlich `quiz-library-room-<UUID>`. Die Raum-UUID bleibt bis zum separaten Share-Token-Slice ein langlebiges Bearer-Secret: Wer den Link kennt, kann lesen und schreiben. Das Zielbild für signierte Share-Tokens und manuelle Rotation dokumentiert [ADR-0033](architecture/decisions/0033-harden-yjs-relay-and-plan-rotatable-share-tokens.md).

---

## 2. Vertraulichkeit der Inhalte (Live-Quiz)

- **Data-Stripping:** `AnswerOption.isCorrect` wird im Status **`ACTIVE`** nicht an Teilnehmende ausgeliefert; Auflösung erst in **`RESULTS`** über geeignete DTOs. Maßgeblich sind hier die DTO-Schemas, der Session-Router und die zugehörigen Tests ([libs/shared-types/src/schemas.ts](../libs/shared-types/src/schemas.ts), [apps/backend/src/routers/session.ts](../apps/backend/src/routers/session.ts), [apps/backend/src/**tests**/dto-security.test.ts](../apps/backend/src/__tests__/dto-security.test.ts)).
- **Phasen-DTOs:** `QUESTION_OPEN` (Lesephase) liefert nur Fragenstamm ohne Antwortoptionen, sofern Lesephase aktiv — siehe Story 2.6.
- **Effective Vote:** Bei Peer Instruction zählt für Scoring, Leaderboards, Bonuscodes und Exporte die wirksame Runde gemäß ADR-0028; alte Zwischenstände dürfen keine alternative Auswertung erzeugen.

---

## 3. Zugriffskontrolle (rollenbasiert, technisch)

- **Host / Present:** `session.create` liefert ein **Host-Token**; das Frontend speichert es pro Session-Code in `sessionStorage`. Host-only-Prozeduren laufen zentral über **`hostProcedure`** und erwarten `x-host-token`. Die Routen `/session/:code/host` und `/session/:code/present` sind clientseitig tokengebunden; ohne Token Redirect auf Join oder Zugriff verweigert.
- **Q&A-Moderation (Lesepfade):** Host-Härtung gilt nicht nur für schreibende Moderationsaktionen, sondern auch für Moderator-Lesepfade. `qa.list` und `qa.onQuestionsUpdated` mit `moderatorView: true` prüfen serverseitig den Host-Kontext gegen den **Session-Code aus der Datenbank**; `PENDING`-/Moderationsdaten werden damit nicht mehr allein über eine frei gesetzte Input-Flag ausgeliefert.
- **Blitzlicht-Host:** Standalone-Blitzlicht (`/feedback/:code`) nutzt ein eigenes **Feedback-Host-Token** via `x-feedback-host-token`. Session-gebundenes Blitzlicht nutzt dagegen das normale Session-Host-Token. Dadurch bleiben Session-Host und Standalone-Blitzlicht getrennte Besitzkontexte.
- **Teilnehmende:** Öffentliche Join-/Vote-Pfade mit Session-Code. Teilnehmerdaten sind auf Minimalzwecke geschnitten: Nickname-Kollisionen für Join, eigener Datensatz für Vote, keine öffentliche Voll-Liste. Ungültige Session-Codes werden nach anonymer Browser-Client-ID sowie Code-/Global-Soft-Cap geschützt; es gibt keinen Join-IP-Lock. Session-Erstellung verwendet ein grobes Shared-NAT-IP- plus Globalbudget, Vote-Submit wird pro Teilnehmenden-ID begrenzt.
- **Quiz-Sammlungs-Historie:** Endpunkte wie `session.getBonusTokensForQuiz`, `session.getLastSessionAnalysisForQuiz` und `session.getActiveQuizIds` verlangen zusätzlich einen **besitzgebundenen `accessProof`** zur hochgeladenen Quizkopie. Die Historie ist damit nicht mehr allein über `quizId` öffentlich enumerierbar.
- **Admin:** Separater Pfad `/admin`; **`ADMIN_SECRET`** (Env), danach Admin-Session mit TTL in Redis. Token-Transport über `Authorization: Bearer ...` oder `x-admin-token`; Schutz zentral über `adminProcedure`. Die ausschließlich lesende Betriebsdiagnose `health.securityStats` verwendet dagegen das unabhängig rotierbare **`ADMIN_DIAGNOSTIC_SECRET`** im Header `x-admin-diagnostic-secret`, konstantzeitig und ohne Redis geprüft. Fehlende, kürzere als 32 Zeichen oder mit `ADMIN_SECRET` identische Diagnose-Secrets schließen den Zugang; falsche Versuche besitzen ein globales, speicher-konstantes Fehlerbudget. Dieser Header gilt für keinen anderen Admin-Endpunkt. Umgesetzt sind Recherche, Detailansicht, Legal Hold, Einzel-/Massenlöschung, Behördenexport, Quiz-Import-Export und Rekord-Reset. Für Betrieb und Go-Live gelten die gleichen Secrets- und Proxy-Annahmen wie in [ENVIRONMENT.md](ENVIRONMENT.md) und [docs/deployment-debian-root-server.md](deployment-debian-root-server.md).
- **MOTD (Epic 10):** **Öffentlich:** `motd.getCurrent`, `listArchive`, `getHeaderState`, `recordInteraction` — **rate-limited** pro IP ([ENVIRONMENT.md](ENVIRONMENT.md), `rateLimit.ts`). **Schreibend:** nur Admin-Prozeduren — MOTD, Vorlagen, Statistiken und Audit-Log `MotdAuditLog`. Für die praktische Prüfung siehe [TESTING.md](TESTING.md).

Die App **ersetzt keine** organisationsweite IAM- oder VPN-Lösung.

---

## 4. Missbrauch & Last (Rate-Limiting)

Redis-basierte Limits schützen ungültige Session-Codes nach anonymer
Browser-Client-ID plus Code-/Globalbudget, Session-Erstellung grob **pro
Shared-NAT-IP und global**, Votes **pro Teilnehmenden-ID** sowie die
**MOTD-Öffentliche-API pro IP** —
konfigurierbar über Env ([ENVIRONMENT.md](ENVIRONMENT.md),
`sessionCodeProtection.ts`, `rateLimit.ts`). Alle IP-basierten
Backend-Entscheidungen verwenden ausschließlich Express' `req.ip`; rohe
`CF-Connecting-IP`-, `True-Client-IP`-, `X-Forwarded-For`- und
`X-Real-IP`-Header werden nie direkt ausgewertet. `session.join` verwendet
überhaupt keinen IP-Key. Hinter genau einem Nginx muss `TRUST_PROXY_HOPS=1`
gesetzt sein, damit andere grobe IP-Budgets nicht alle Clients dem
Proxy-Bucket zuordnen. Der separate tRPC-WebSocket-Server verwendet für
Upgrade-Requests dieselbe `proxy-addr`-/Hop-Vertrauensfunktion wie Express.
Der tRPC-WebSocket-Server übernimmt zusätzlich aus dem begrenzt geparsten
`connectionParams`-Frame einen normalisierten Session-Code und optional die
lokal gespeicherte Participant-UUID. Host-/Present-Routen senden dabei nur den
Session-Code, damit eine eventuell gespeicherte Participant-ID nicht das
Participant-Budget einer Steuerverbindung belastet. Der Server begrenzt pro
Prozess standardmäßig auf 1.100 Verbindungen je Session (500 aktive plus eine
vollständige stale Reconnect-Kohorte und 100 Steuer-Sockets) sowie global auf
1.200. Ein Session-/Participant-Tupel ist auf zwei Verbindungen begrenzt.
Das Signal enthält keine PII, ist rotierbar und daher ausdrücklich
**keine Authentifizierung**. Fehlende oder ungültige Signale bleiben unter den
globalen Caps kompatibel; es existiert kein WebSocket-IP-Bucket. Zähler werden
beim Socket-Close genau einmal freigegeben und leere Schlüssel gelöscht.

Der Yjs-Relay begrenzt Einzelpayloads standardmäßig auf 16 MiB, aktive
Verbindungen global und pro Raum sowie Upgrade-, Nachrichten- und Bytebudgets
je Verbindung, Raum und Backend-Prozess. Der zusammengeführte Zustand ist auf
15 MiB je Raum und 256 MiB global begrenzt; tatsächlich versendete Bytes haben
eigene gestufte Budgets gegen Sync-/Reconnect-Verstärkung. Pro Verbindung darf
höchstens eine neue Awareness-ID mit maximal 4 KiB State eingeführt werden;
bereits bekannte Peer-IDs dürfen Provider standardkonform rebroadcasten.
Dadurch begrenzt das Raum-Verbindungscap auch persistent gehaltene
Präsenzdaten. Diese Grenzen sind
bewusst nicht IP-basiert, damit Einrichtungen hinter gemeinsamem NAT nicht
ausgesperrt werden. Nicht kanonische Raumpfade und Query-Parameter werden vor
dem Upgrade abgewiesen; inaktive In-Memory-Dokumente und ihre Reservierungen
werden nach der letzten Verbindung freigegeben. Ungültige Protokollframes
werden ohne attacker-kontrollierte Logs gezählt und getrennt. Aktive
Yjs-Verbindungen/Räume und Ablehnungen sind nur über das
diagnose-authentifizierte `health.securityStats` sichtbar.

`quiz.upload` und Standalone-`quickFeedback.create` verwenden großzügige
Shared-NAT-IP-Budgets zusammen mit globalen Budgets. Gefälschte Proxy-Header
ändern weder dort noch bei Session-Create- oder MOTD-Buckets die
IP. Alle Budgets werden atomar geprüft; ein ausgeschöpftes Globalbudget erzeugt
keine weiteren IP-Rate-Limit-Keys. Session-gebundenes `quickFeedback.create`
wird zuerst als Host-Aktion autorisiert und danach ausschließlich pro Session
begrenzt.

Der reguläre Join-Ablauf und direkte öffentliche Code-Orakel prüfen zuerst, ob
die Session beziehungsweise das Standalone-Blitzlicht existiert. Gültige
Lookups, Joins und Rejoins buchen kein Fehlbudget; Rejoins werden auch nicht
durch die separate Join-Wellen-Glättung verzögert. Nur nicht existente Codes
buchen die anwendbaren Zähler atomar per Lua. Die zufällige browserweite UUID
ist kein Proof und enthält keine PII; Client-ID und Code werden für Redis-Keys
mit SHA-256 gehasht. Das Clientbudget antwortet bei Erschöpfung mit 429. Code-
und Global-Soft-Caps führen ab 80 % progressiv zu höchstens 1.500 ms Delay plus
aggregierter Telemetrie, niemals zu einem saalweiten Hard-Lock. Pro
Backend-Prozess warten höchstens 100 bereits als ungültig erkannte Requests
gleichzeitig; weitere ungültige Requests erhalten 429, während gültige
Codeabfragen keine Delay-Slots verwenden. Nach vollem Globalbudget werden
keine neuen Client-/Code-Keys angelegt. Alle Keys haben ein festes
300-Sekunden-TTL.
Redis-Ausfall beeinflusst gültige Joins nicht; der ohnehin ungültige Pfad ist
fail-closed. Für während des Deployments weiter aktive Service-Worker-Clients
der Vorgängerversion ist die UUID vorübergehend optional. Ohne UUID gelten
weiter Code- und Globalbudget, aber kein Client-Cap; insbesondere wird weder
ein Ersatz-IP-Bucket noch ein Legacy-Client-Key angelegt. Diese
Rollout-Ausnahme ist für einen späteren Cutover vorgesehen.

HTTP-Anfragen und WebSocket-Nachrichten an tRPC sind im Backend auf **2 MiB** begrenzt; Nginx setzt für HTTP davor ein **8-MiB-Infrastruktur-Hard-Cap**. HTTP-Requests oberhalb des Anwendungslimits werden dadurch regulär von tRPC mit HTTP **413** und dem auch für Batch-Requests passenden Code `PAYLOAD_TOO_LARGE` abgewiesen; übergroße WebSocket-Nachrichten schließen mit Code `1009`, bevor ein Resolver ausgeführt wird. Das schützt insbesondere öffentliche Create-/Quiz-Upload-Pfade; fachliche Array- und Feldgrenzen bleiben zusätzlich erforderlich.

Der Quiz-Upload-Vertrag begrenzt zusätzlich auf 200 Fragen, 10 Optionen je
Frage und 1.250.000 UTF-8-Bytes. Ein 100-Fragen-Classroom-Fixture mit je vier
Optionen ist Bestandteil der Contract-Tests.

Ein globales 1.200er-Versuchslimit greift vor Zod und zählt damit auch
ungültige knapp-2-MiB-Eingaben. Validierte Uploads buchen atomar höchstens 600
Creates, 64 MiB und 100.000 Quiz-/Frage-/Optionsknoten je festem
Stundenfenster. Die Limits können per Env nur abgesenkt werden. Der bounded
Cleanup schafft 1.300 Uploads pro Stundenlauf und liegt damit über dem
maximalen Zwei-Fenster-Burst von 1.200 Creates.

Die ressourcenintensive Playwright-PDF-Erzeugung für Session-Ergebnisberichte ist im einzelnen Backend-Prozess auf **einen aktiven Job** begrenzt. Weitere PDF-Anfragen werden ohne Warteschlange mit HTTP **429** abgewiesen. Ablehnungen werden nicht einzeln doppelt geloggt, sondern über das zentrale gesampelte `rate_limit_429` und bounded aggregierte PDF-Metriken in `health.securityStats` beobachtet. Der konservative Cap wurde gewählt, weil Cap 2 auf dem Zielhost die Vote-SLOs verfehlte. Bei einer späteren horizontalen Skalierung ist vorab ein instanzübergreifender Semaphore erforderlich.

Externe Bilder in serverseitigen PDF-Berichten durchlaufen einen
DNS-/TOCTOU-gehärteten Loader: alle A-/AAAA-Ziele müssen öffentlich routbar
sein, der Connect wird an eine validierte IP gebunden, Redirects werden je Hop
neu geprüft, Antworten streamend begrenzt und MIME plus Magic Bytes validiert.
Abgelehnte Quellen werden im HTML durch eine lokale Data-URL ersetzt.
Playwright blockiert zusätzlich alle verbleibenden HTTP(S)- und
`file:`-Requests; lokale Assets müssen nach `realpath` im Asset-Root bleiben.
Die Abnahme ist in
[W1.2-PDF-SSRF-ABNAHME.md](implementation/W1.2-PDF-SSRF-ABNAHME.md)
dokumentiert.

W0.4 bündelt operative Security- und Kapazitätsdaten in der
admin-authentifizierten Query `health.securityStats`: erfolgreiche
Session-Erstellungen, sämtliche tRPC-429 nach Kategorie,
Session-Code-Fehler/Soft-Cap-Delays und aktuelle globale
Soft-Cap-Auslastung, PDF-Auslastung sowie aktive tRPC-WebSocket-Verbindungen.
Öffentliche UX- und Produktstatistiken
einschließlich `serviceStatus` und `loadStatus` bleiben in `health.stats`.
Create-/429- und PDF-Zähler werden pro Prozess bounded aggregiert und höchstens
alle fünf Sekunden nach Redis geflusht. Strukturierte `rate_limit_429`-Ereignisse
enthalten keine Client-IP, sondern nur Pfad, Kategorie und `ipSource`; spezielle
MOTD-/PDF-Reject-Logs wurden entfernt. Verbindliche initiale manuelle Schwellen
und On-Call-Maßnahmen sind im
[Security- und Lastmonitoring-Runbook](operations/MONITORING-RUNBOOK.md)
dokumentiert; automatische Auswertung und Alarmierung bleiben W3.7.

W2.4a ergänzt als enge Browser-Reporting-Ausnahme `POST /csp-report`.
Der Endpunkt akzeptiert zwei CSP-Medientypen, begrenzt den Raw Body vor
`JSON.parse` auf 32 KiB und verwirft malformed oder überkomplexe Payloads ohne
Fehleroracle. Eine Feld-Allowlist schließt insbesondere `script-sample`,
`sample`, Referrer, Original-Policy, User-Agent und unbekannte Felder aus.
HTTP(S)-URLs werden vor jeder Aggregation auf Origin und Pfad ohne
Query/Fragment/Userinfo minimiert; besondere Schemes werden statisch
kategorisiert. Redis sieht ausschließlich HMAC-Digests und feste Keys.
Globales und grobes trusted-`req.ip`-Budget werden atomar global-first gebucht,
damit ein volles Globalbudget keine neuen IP-/Dimensionskeys erzeugt. Bei
Redis-Ausfall gilt ein hartes lokales Drop-Cap; Rohreports werden weder
persistiert noch geloggt. Diagnoseaggregate bleiben ausschließlich über
`health.securityStats` zugänglich.

Builder und Produktionscontainer verwenden **Node.js 24 LTS** (`node:24-alpine`). `.nvmrc` pinnt die lokal empfohlene Patchversion; die CI prüft Node 24 als Referenzpfad und Node 22 als unterstützten Kompatibilitätspfad. Node 20 ist wegen EOL aus Engine-Regel, CI und Produktionsimage entfernt.

Die lokale Build-, Test-, Audit-, Image- und Runtime-Abnahme ist in [W0.3-W1.1-NODE-24-ABNAHME.md](implementation/W0.3-W1.1-NODE-24-ABNAHME.md) dokumentiert.

Der Produktions-App-Container läuft als unprivilegierter `node`-User, ohne
Linux-Capabilities und mit gesperrter Privilegieneskalation. Sein
Root-Dateisystem ist read-only; ein begrenztes `tmpfs` unter `/tmp` nimmt
andere notwendige temporäre Dateien auf.
[W2.1A-CONTAINER-BASELINE-ABNAHME.md](implementation/W2.1A-CONTAINER-BASELINE-ABNAHME.md).

W2.1b verlagert den Chromium-PDF-Lauf in einen separaten Worker ohne Netzwerk
und ohne App-Secrets. Die App übergibt ausschließlich vollständig vorbereiteten
Reportinhalt über einen `0600`-Unix-Socket, dessen Volume sie read-only mountet.
Der Worker läuft non-root, capability-frei, mit `no-new-privileges`,
Docker-Default-Seccomp, read-only Rootfs und begrenztem `/tmp`; Compose begrenzt
zusätzlich auf 128 PIDs, 1 GiB RAM und eine CPU. Produktion ist fail-closed auf
den Worker festgelegt. Chromium verwendet dort weiterhin `--no-sandbox`, liegt
aber in einer eigenen Container-, Ressourcen- und Egress-Grenze. CI prüft diese
Laufzeitkontrollen und einen echten Maximalbericht. Eine worker-interne
60-Sekunden-Gesamtdeadline beendet bei hängendem Chromium den Container
non-zero; `restart: always` stellt Socket und Worker sowohl danach als auch nach
Docker-Daemon-/Host-Neustarts sauber wieder her.
Entscheidung, verworfene In-Container-Sandbox und Rollback:
[W2.1B-PDF-WORKER-ISOLATION-ABNAHME.md](implementation/W2.1B-PDF-WORKER-ISOLATION-ABNAHME.md).

---

## 5. Aufbewahrung & Löschung

- **Sessions:** Aktive, verwaiste Sessions werden nach **24 Stunden** auf `FINISHED` gesetzt. Bereits beendete Sessions werden nach weiteren **24 Stunden** gelöscht, sofern kein aktiver **Legal Hold** greift. Diese Fenster sind derzeit **fest im Code** definiert, nicht per Env konfigurierbar ([apps/backend/src/lib/sessionCleanup.ts](../apps/backend/src/lib/sessionCleanup.ts)).
- **Bonus-Tokens:** Zusätzliche Bereinigung nach **90 Tagen** ([apps/backend/src/lib/sessionCleanup.ts](../apps/backend/src/lib/sessionCleanup.ts)).
- **Session-Feedback:** Zusätzliche Bereinigung nach **90 Tagen** ([apps/backend/src/lib/sessionCleanup.ts](../apps/backend/src/lib/sessionCleanup.ts)).
- **Blitzlicht / Quick Feedback:** Nur Redis, TTL **30 Minuten** — kein langfristiges PII dort ([apps/backend/src/routers/quickFeedback.ts](../apps/backend/src/routers/quickFeedback.ts)).
- **CSP-Report-Aggregate:** Nur Redis, standardmäßig höchstens **7 Tage**; eine feste Generation enthält über das gesamte Retentionsfenster maximal 256 HMAC-gehashte Dimensionen in genau einem Set und einem Hash. Die TTL wird nur beim Generationsstart gesetzt; nach Ablauf beginnt eine neue leere Generation. Keine Rohreports, Roh-URLs oder IP-Adressen werden gespeichert.
- **Verwaiste Quiz-Uploads:** Der stündliche Scheduler löscht nach **24 Stunden Grace Period** höchstens 13 atomare Batches zu je 100 Uploadkopien. Geschützt bleiben Quizzes mit eigener Sessionrelation sowie höchstens **5** neueste sessionlose Kopien je `historyScopeId` mit Session-Anker; ältere Scope-Geschwister, scopelose Orphans und Scopes ohne Session werden gelöscht. Die Keep-Set-Prüfung ist auf fünf neuere Zeilen begrenzt und nutzt `(historyScopeId, createdAt, id)`. `FOR UPDATE SKIP LOCKED` und serialisierbare Transaktionen verhindern Starvation und den Wettlauf mit `session.create`/Attach.

Aggregierte **Server-Statistiken** (`health.footerBundle`, `health.stats`) ohne Einzelpersonenbezug: aktive/abgeschlossene Sessions, Teilnehmende in aktiven Sessions, Blitz-Runden, Service-/Laststatus, Allzeit-Rekord `maxParticipantsSingleSession` aus **`PlatformStatistic`** und Tagesrekorde aus **`DailyStatistic`**.

Strukturierte App-Logs werden minimiert: `rate_limit_429` enthält keine
vollständige IP-Adresse. Zugriff und Rotation sind Betriebspflicht; der
Normalbetrieb soll die kürzeste tragfähige Aufbewahrung verwenden (Richtwert
höchstens 14 Tage), längere Sicherung nur dokumentiert für konkrete Incidents.

---

## 6. Transport & Infrastruktur (Grenzen der App)

TLS-Terminierung, Firewall, Secret-Management auf dem Server und Härtung des Host-Systems sind **Betriebssache** — siehe [deployment-debian-root-server.md](deployment-debian-root-server.md), Docker-/Compose-Vorlagen.

W2.4b liefert hinter dem rollout-sicheren, standardmäßig deaktivierten Flag
`CSP_REPORT_ONLY_ENABLED` ausschließlich
`Content-Security-Policy-Report-Only` aus. Der Header wird erst beim Schreiben
einer erfolgreichen GET-/HEAD-HTML-Antwort gesetzt. `/csp-report` liegt vor der
Middleware; tRPC, 204-Antworten sowie JS-/CSS-/JSON-Assets erhalten ebenfalls
keinen Header. Dadurch entstehen weder Report-Rekursion noch API-/Asset-Stürme.
Die statische Policy erlaubt die nachgewiesenen aktuellen Angular-Inline-
Bootscripts (`'unsafe-inline'`), den Font-Preload-`onload` und die von Zod 4
über `Function` kompilierten Validatoren (`'unsafe-eval'`) sowie Inline-Styles
von Material/KaTeX nur im Report-Only-Modus. Bildquellen decken lokale, HTTPS-,
`data:`- und `blob:`-Markdown-Inhalte ab, `connect-src` die Same-Origin-HTTP-
und sicheren WebSocket-Pfade, `worker-src` den Service Worker. Die beiden
Script-Ausnahmen sind durch den Produktions-Browser-Smoke belegt und müssen vor
einem späteren Enforcement-Slice strukturell entfernt oder durch Nonces/Hashes
ersetzt werden. Online-Navigationen verwenden im Angular Service Worker die
Strategie `freshness`, damit Flagwechsel nicht durch alte App-Shell-Header aus
der Cache API verzögert werden; offline bleibt die Shell verfügbar.
`frame-ancestors 'self'` ist nur Zielpolicy: Browser werten diese Direktive in
Report-Only nicht aus. Bis zum getrennten Enforcement-Slice erzwingt Nginx
`X-Frame-Options: SAMEORIGIN` die Framing-Grenze.
Ein Enforcement-Header, Nonces/Hashes und die Landing-/GitHub-Pages-Auslieferung
bleiben ausdrücklich außerhalb dieses Slices.

W2.5 entfernt die HTTP-CORS-Middleware in Produktion vollständig: Angular-App,
tRPC-HTTP und `/csp-report` werden unter derselben Origin ausgeliefert, und es
gibt keinen nachgewiesenen legitimen Cross-Origin-Browser-Consumer. Requests
ohne `Origin` (Docker-Healthcheck, CLI, Lasttests) bleiben normale HTTP-Requests.
Lokale Angular-Entwicklung erlaubt ausschließlich die kanonischen Origins
`http://localhost:4200`, `http://127.0.0.1:4200` und `http://[::1]:4200`, nur
`GET`/`POST`/`OPTIONS` sowie die benötigten Content-/Token-Header, ohne
Credentials oder Wildcard. `/csp-report` bleibt auch lokal vor CORS und erhält
keine Freigabe. WebSocket-Origin-Prüfung ist eine separate Transportkontrolle;
HTTP-CORS authentifiziert weder tRPC noch tRPC-/Yjs-WebSockets. Details und
Rollback: [W2.5-CORS-SAME-ORIGIN-ABNAHME.md](implementation/W2.5-CORS-SAME-ORIGIN-ABNAHME.md).

Vor öffentlichem Betrieb müssen Betreiber zusätzlich klären und testen:

- eigene Impressums-/Datenschutztexte und Kontaktwege,
- PostgreSQL-Backups inklusive Restore-Test,
- Admin-Verantwortlichkeiten für Legal Hold, Löschung, Export und MOTD,
- Monitoring/Logzugriff und Incident-Prozess,
- Rate-Limit-Profil im tatsächlichen Proxy-/Shared-NAT-Umfeld,
- WebSocket-Erreichbarkeit für `/trpc-ws` und `/yjs-ws`.

---

## 7. Weiterführend

- **Härtungsplan (externes Audit + UX/NAT-Nachträge, Plan-Review geschärft 2026-07):** [SECURITY-HARDENING-PLAN.md](SECURITY-HARDENING-PLAN.md) — W0–W4, SSRF/TOCTOU-, Soft-Cap- und Lasttest-AKs; einzelne W0/W1-Slices sind umgesetzt, der Gesamtplan noch nicht abgeschlossen
- **Rollen & Routen:** [ADR-0006](architecture/decisions/0006-roles-routes-authorization-host-admin.md) und [ADR-0019](architecture/decisions/0019-host-hardening-and-owner-bound-session-access.md)
- **MOTD / Plattform-Kommunikation:** [ADR-0018](architecture/decisions/0018-message-of-the-day-platform-communication.md), [motd.md](features/motd.md)
- **i18n & Daten in Übersetzungen:** [ADR-0008](architecture/decisions/0008-i18n-internationalization.md)
- **Architektur gesamt:** [handbook.md](architecture/handbook.md)
- **Umgebungsvariablen:** [ENVIRONMENT.md](ENVIRONMENT.md), [deployment-debian-root-server.md](deployment-debian-root-server.md)

**Stand-Hinweis:** 2026-07-05 — dieselben Betriebsannahmen gelten in [README.md](../README.md), [docs/README.md](README.md) und [docs/ENVIRONMENT.md](ENVIRONMENT.md).

Bei **Sicherheitsvorfällen** oder **Datenschutz-Anfragen**: Prozess mit Betrieb/legal klären; Audit-Log für Admin-Aktionen (Löschen/Export) im Schema `AdminAuditLog`.
