<!-- markdownlint-disable MD013 -->

# Sicherheit & Datenschutz — Überblick

Kurzreferenz für **Annahmen, Grenzen und eingebaute Kontrollen**. Kein vollständiges Threat-Model und keine Rechtsberatung; technische Tiefe: Handbuch, ADRs, Prisma, `session.ts` / DTO-Schicht.

**Stand:** 2026-07-23 — abgeglichen mit Root-[README](../README.md), [docs/README.md](README.md), [deployment-debian-root-server.md](deployment-debian-root-server.md), [ENVIRONMENT.md](ENVIRONMENT.md), [TESTING.md](TESTING.md), Admin-Flow und aktuellem Backend. Enthalten sind Host-/Feedback-Host-Token, Admin-Tokens, besitzgebundene Quiz-Historie (`accessProof`), MOTD, Server-Status (`health.footerBundle` / `health.stats`) und Plattformstatistik (`PlatformStatistic`, `DailyStatistic`).

---

## 1. Produktkontext

- **Accountfrei:** Kein Nutzer-/Login-Modell für Lehrende oder Teilnehmende. Identität **realer Personen** hält die App nicht fest; Pseudonyme und freiwillige Einreichung von Bonus-Codes sind dokumentiert ([bonus-codes](features/bonus-codes.md)).
- **Local-First (Quiz):** Dauerhafte **Quiz-Sammlung** primär im Browser (Yjs); Server erhält eine **flüchtige Kopie** für die Live-Session ([ADR-0004](architecture/decisions/0004-use-yjs-for-local-first-storage.md), Handbook §3.1).

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
- **Teilnehmende:** Öffentliche Join-/Vote-Pfade mit Session-Code. Teilnehmerdaten sind auf Minimalzwecke geschnitten: Nickname-Kollisionen für Join, eigener Datensatz für Vote, keine öffentliche Voll-Liste. Rate-Limits greifen je nach Pfad unterschiedlich: Session-Code-Fehlversuche und Session-Erstellung pro IP, Vote-Submit pro Teilnehmenden-ID.
- **Quiz-Sammlungs-Historie:** Endpunkte wie `session.getBonusTokensForQuiz`, `session.getLastSessionAnalysisForQuiz` und `session.getActiveQuizIds` verlangen zusätzlich einen **besitzgebundenen `accessProof`** zur hochgeladenen Quizkopie. Die Historie ist damit nicht mehr allein über `quizId` öffentlich enumerierbar.
- **Admin:** Separater Pfad `/admin`; **`ADMIN_SECRET`** (Env), danach Admin-Session mit TTL in Redis. Token-Transport über `Authorization: Bearer ...` oder `x-admin-token`; Schutz zentral über `adminProcedure`. Umgesetzt sind Recherche, Detailansicht, Legal Hold, Einzel-/Massenlöschung, Behördenexport, Quiz-Import-Export und Rekord-Reset. Für Betrieb und Go-Live gelten die gleichen Secrets- und Proxy-Annahmen wie in [ENVIRONMENT.md](ENVIRONMENT.md) und [docs/deployment-debian-root-server.md](deployment-debian-root-server.md).
- **MOTD (Epic 10):** **Öffentlich:** `motd.getCurrent`, `listArchive`, `getHeaderState`, `recordInteraction` — **rate-limited** pro IP ([ENVIRONMENT.md](ENVIRONMENT.md), `rateLimit.ts`). **Schreibend:** nur Admin-Prozeduren — MOTD, Vorlagen, Statistiken und Audit-Log `MotdAuditLog`. Für die praktische Prüfung siehe [TESTING.md](TESTING.md).

Die App **ersetzt keine** organisationsweite IAM- oder VPN-Lösung.

---

## 4. Missbrauch & Last (Rate-Limiting)

Redis-basierte Limits u. a. für Session-Code-Fehlversuche und Session-Erstellung **pro IP**, Votes **pro Teilnehmenden-ID** sowie die **MOTD-Öffentliche-API pro IP** — konfigurierbar über Env ([ENVIRONMENT.md](ENVIRONMENT.md), `rateLimit.ts`). Hinter Nginx muss `TRUST_PROXY_HOPS=1` gesetzt sein, damit `x-forwarded-for` / `x-real-ip` korrekt ausgewertet werden und nicht alle Clients im Proxy-Bucket landen.

HTTP-Anfragen und WebSocket-Nachrichten an tRPC sind im Backend auf **2 MiB** begrenzt; Nginx setzt für HTTP davor ein **8-MiB-Infrastruktur-Hard-Cap**. HTTP-Requests oberhalb des Anwendungslimits werden dadurch regulär von tRPC mit HTTP **413** und dem auch für Batch-Requests passenden Code `PAYLOAD_TOO_LARGE` abgewiesen; übergroße WebSocket-Nachrichten schließen mit Code `1009`, bevor ein Resolver ausgeführt wird. Das schützt insbesondere öffentliche Create-/Quiz-Upload-Pfade; fachliche Array- und Feldgrenzen bleiben zusätzlich erforderlich.

Die ressourcenintensive Playwright-PDF-Erzeugung für Session-Ergebnisberichte ist im einzelnen Backend-Prozess auf **einen aktiven Job** begrenzt. Weitere PDF-Anfragen werden ohne Warteschlange mit HTTP **429** abgewiesen; Start, Abschluss, Fehler und Ablehnungen sind über strukturierte `pdf:*`-Log-Ereignisse sowie rollierende Redis-Metriken in `health.stats` beobachtbar. Der konservative Cap wurde gewählt, weil Cap 2 auf dem Zielhost die Vote-SLOs verfehlte. Bei einer späteren horizontalen Skalierung ist vorab ein instanzübergreifender Semaphore erforderlich.

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

W0.4 bündelt die Betriebsbeobachtung in `health.stats`: erfolgreiche
Session-Erstellungen, sämtliche tRPC-429 nach Kategorie, PDF-Auslastung und
aktive tRPC-WebSocket-Verbindungen. Strukturierte `rate_limit_429`- und
`pdf:*`-Ereignisse liefern die Detaildiagnose. Verbindliche initiale Schwellen
und On-Call-Maßnahmen sind im
[Security- und Lastmonitoring-Runbook](operations/MONITORING-RUNBOOK.md)
dokumentiert; automatische Alarmierung bleibt W3.7.

Builder und Produktionscontainer verwenden **Node.js 24 LTS** (`node:24-alpine`). `.nvmrc` pinnt die lokal empfohlene Patchversion; die CI prüft Node 24 als Referenzpfad und Node 22 als unterstützten Kompatibilitätspfad. Node 20 ist wegen EOL aus Engine-Regel, CI und Produktionsimage entfernt.

Die lokale Build-, Test-, Audit-, Image- und Runtime-Abnahme ist in [W0.3-W1.1-NODE-24-ABNAHME.md](implementation/W0.3-W1.1-NODE-24-ABNAHME.md) dokumentiert.

---

## 5. Aufbewahrung & Löschung

- **Sessions:** Aktive, verwaiste Sessions werden nach **24 Stunden** auf `FINISHED` gesetzt. Bereits beendete Sessions werden nach weiteren **24 Stunden** gelöscht, sofern kein aktiver **Legal Hold** greift. Diese Fenster sind derzeit **fest im Code** definiert, nicht per Env konfigurierbar ([apps/backend/src/lib/sessionCleanup.ts](../apps/backend/src/lib/sessionCleanup.ts)).
- **Bonus-Tokens:** Zusätzliche Bereinigung nach **90 Tagen** ([apps/backend/src/lib/sessionCleanup.ts](../apps/backend/src/lib/sessionCleanup.ts)).
- **Session-Feedback:** Zusätzliche Bereinigung nach **90 Tagen** ([apps/backend/src/lib/sessionCleanup.ts](../apps/backend/src/lib/sessionCleanup.ts)).
- **Blitzlicht / Quick Feedback:** Nur Redis, TTL **30 Minuten** — kein langfristiges PII dort ([apps/backend/src/routers/quickFeedback.ts](../apps/backend/src/routers/quickFeedback.ts)).

Aggregierte **Server-Statistiken** (`health.footerBundle`, `health.stats`) ohne Einzelpersonenbezug: aktive/abgeschlossene Sessions, Teilnehmende in aktiven Sessions, Blitz-Runden, Service-/Laststatus, Allzeit-Rekord `maxParticipantsSingleSession` aus **`PlatformStatistic`** und Tagesrekorde aus **`DailyStatistic`**.

---

## 6. Transport & Infrastruktur (Grenzen der App)

TLS-Terminierung, Firewall, Secret-Management auf dem Server und Härtung des Host-Systems sind **Betriebssache** — siehe [deployment-debian-root-server.md](deployment-debian-root-server.md), Docker-/Compose-Vorlagen.

Vor öffentlichem Betrieb müssen Betreiber zusätzlich klären und testen:

- eigene Impressums-/Datenschutztexte und Kontaktwege,
- PostgreSQL-Backups inklusive Restore-Test,
- Admin-Verantwortlichkeiten für Legal Hold, Löschung, Export und MOTD,
- Monitoring/Logzugriff und Incident-Prozess,
- Rate-Limit-Profil im tatsächlichen Proxy-/Shared-NAT-Umfeld,
- WebSocket-Erreichbarkeit für `/trpc-ws` und `/yjs-ws`.

---

## 7. Weiterführend

- **Härtungsplan (externes Audit + UX/NAT-Nachträge, Plan-Review geschärft 2026-07):** [SECURITY-HARDENING-PLAN.md](SECURITY-HARDENING-PLAN.md) — W0–W4, SSRF/TOCTOU-, Soft-Cap- und Lasttest-AKs; Ist-Sicherheit ~5/10 bis Umsetzung; noch nicht implementiert
- **Rollen & Routen:** [ADR-0006](architecture/decisions/0006-roles-routes-authorization-host-admin.md) und [ADR-0019](architecture/decisions/0019-host-hardening-and-owner-bound-session-access.md)
- **MOTD / Plattform-Kommunikation:** [ADR-0018](architecture/decisions/0018-message-of-the-day-platform-communication.md), [motd.md](features/motd.md)
- **i18n & Daten in Übersetzungen:** [ADR-0008](architecture/decisions/0008-i18n-internationalization.md)
- **Architektur gesamt:** [handbook.md](architecture/handbook.md)
- **Umgebungsvariablen:** [ENVIRONMENT.md](ENVIRONMENT.md), [deployment-debian-root-server.md](deployment-debian-root-server.md)

**Stand-Hinweis:** 2026-07-05 — dieselben Betriebsannahmen gelten in [README.md](../README.md), [docs/README.md](README.md) und [docs/ENVIRONMENT.md](ENVIRONMENT.md).

Bei **Sicherheitsvorfällen** oder **Datenschutz-Anfragen**: Prozess mit Betrieb/legal klären; Audit-Log für Admin-Aktionen (Löschen/Export) im Schema `AdminAuditLog`.
