<!-- markdownlint-disable MD013 MD060 -->

# Sicherheits-Härtungsplan — arsnova.eu

**Status:** Planungsdokument / vor Implementierung (nach Plan-Review geschärft)  
**Stand:** 2026-07-22  
**Bezug:** externes Security-Review (Produktion + `main` `13f8c27b`, passiv, ohne Ausnutzung) inkl. UX-Follow-up und NAT-/Hörsaal-Nachtrag; Plan-Audit derselben Session (Plan **7/10** freigabefähig nach Schärfung; Ist-Sicherheit **~5/10** bis Umsetzung)  
**Kurzreferenz Ist-Kontrollen:** [SECURITY-OVERVIEW.md](SECURITY-OVERVIEW.md)

---

## 1. Kontext und Gesamturteil

`arsnova.eu` besitzt bereits eine **überdurchschnittlich gute Sicherheitsbasis** für eine accountfreie Live-Quiz-App (Host-/Admin-Tokens serverseitig, DTO-Data-Stripping, Redis-Rate-Limits für Create/Join/Votes, CI mit Prod-Audit/Trivy/CodeQL/Dependabot). Gegen gezielte Ressourcen- und Anwendungsangriffe ist die Oberfläche jedoch **noch nicht ausreichend gehärtet**.

| Aussage                     | Bewertung                                                                                                                         |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Externe vorläufige Note     | **~5 von 10** — mittleres Niveau mit mehreren dringenden Befunden; gilt für den **Ist-Stand**, bis die Maßnahmen umgesetzt sind   |
| Plan-Qualität (Review)      | **7 von 10** — freigabefähig nach den unten eingearbeiteten Schärfungen (kein Ersatz für Implementierung)                         |
| Interne Einordnung          | **Fair** für Produktstadium und Bedrohungsmodell; kein Shutdown                                                                   |
| Incident / Kompromittierung | **Kein Hinweis** — handfeste Todos, kein Notfallbetrieb                                                                           |
| Erfolgsmaß (Ende Phase)     | **keine offenen HIGH-Befunde** + definierte Security- und Lasttests (Abschnitt 6.5) **bestanden** — nicht eine vage „7–8/10“-Note |
| Produktgrenzen              | bewusst kein Enterprise-IAM; Session-Code kennt der Raum; Host-Token in `sessionStorage`                                          |

Geprüft wurden die öffentlich erreichbare Produktion und der damalige `main`-Stand. Dieses Dokument **implementiert nichts** — es konsolidiert Befunde, Prinzipien und einen phasierten Umsetzungsplan.

Jede Maßnahme führt Owner, Ticket/Issue, Abhängigkeiten und Rollback mit (Vorlage Abschnitt 6.6).

---

## 2. Leitprinzipien

1. **Accountfrei und sofort nutzbar bleiben.** Keine Login-Pflicht für Lehrende oder Teilnehmende; Härtung darf das Kernversprechen (kostenlos, accountfrei, unmittelbar) nicht aufgeben.
2. **Hörsaal-NAT zuerst denken.** Bis zu ~500 Geräte können dieselbe öffentliche IP teilen. **Enge IP-Limits auf Teilnehmerpfaden sind verboten** (Join, Vote, Q&A, Blitzlicht, WebSocket).
3. **„Proxy“ = lokaler Nginx auf demselben Host.** Kein separates CDN/WAF vor der App. `TRUST_PROXY_HOPS=1` und korrekte IP-Ermittlung dienen Logs und groben Host-/Admin-Grenzen — **nicht** als Hebel für enge Participant-IP-Lockouts.
4. **Teilnehmerverkehr nach Session / Client-ID / Participant-ID; teure Host-Funktionen nach Token, Größe und globalem Budget.**
5. **UX-neutrale Fixes zuerst**, sichtbare Tradeoffs (Image-Proxy, Sync-Rotation, `accessProof`-Migration, PDF-Queue) bewusst später und mit Migration/Fortschritt.
6. **Severity und UX parallelisieren, nicht gegeneinander ausspielen.** „Node zuerst“ (UX) und „PDF-SSRF zuerst“ (Severity) sind beide Woche‑1 — parallel; **W0** enthält sofortige Containment-Schritte, falls der volle SSRF-Slice noch nicht ready ist.

---

## 3. Befundtabelle (HIGH / MEDIUM)

Code-Pointer beziehen sich auf den Review-Stand `13f8c27b` / aktuelles `main`; Pfade können leicht wandern.

| Prio            | Befund                                                                                                                                                                                 | Folge                                                    | Code / Ort                                                                                                                                                                   | UX                                                                                                                             |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **HIGH**        | Unsichere externe Bildverarbeitung beim PDF-Export (SSRF, Redirects, Size erst nach Vollladen, Asset-Pfad ohne Root-Containment; Chromium `--no-sandbox`; kein PDF-Parallelitätslimit) | Blind-SSRF, Speicher-/CPU-DoS, lokaler Dateizugriff      | `apps/backend/src/lib/session-results-report-pdf.ts`, `libs/session-export-report/src/markdown-export-images.util.ts`, `apps/backend/src/lib/session-export-asset-reader.ts` | UX-neutral: Stream-Cap, IP-Bind, Redirect-Policy, Path-Containment. Ziel: Image-Proxy; Platzhalter nur als fail-closed Interim |
| **HIGH**        | Öffentliche Erzeugungsendpunkte unzureichend begrenzt (`quiz.upload`, `quickFeedback.create`, Exportwege; Fragen-Array ohne `.max()`; verwaiste Uploads ohne Cleanup)                  | PostgreSQL/Redis füllen, Last, Dienstunterbrechung       | `apps/backend/src/routers/quiz.ts`, `apps/backend/src/routers/quickFeedback.ts`, Zod-Upload-Schemas in `libs/shared-types`                                                   | UX-neutral bei großzügigen Caps + klaren Fehlermeldungen                                                                       |
| **HIGH**        | Produktion auf Node.js 20 (`node:20-alpine`) — seit April 2026 EOL                                                                                                                     | Keine regulären Security-Updates der Runtime             | `Dockerfile` (Builder + Production)                                                                                                                                          | UX-neutral nach Testmatrix; **bevorzugt Node 24**, sonst 22 mit festem Node-24-Termin                                          |
| **MEDIUM–HIGH** | Yjs-Sync ohne serverseitige Autorisierung/Limits (Raum-UUID ≈ Bearer; kein Payload-/Conn-Limit)                                                                                        | Manipulation bei geleaktem Link; WS-/Speicher-Missbrauch | Yjs-/y-websocket-Child, Sync-UI; Story **1.6c**, [architecture/quiz-library-sync.md](architecture/quiz-library-sync.md)                                                      | Lange Tokens + manuelle Rotation; nicht Kurz-TTL                                                                               |
| **MEDIUM**      | IP-basierte Limits über Proxy-Header umgehbar (`CF-Connecting-IP`, `True-Client-IP`, erster `X-Forwarded-For`)                                                                         | Rate-Limit-Bypass                                        | `resolveClientIp` in `apps/backend/src/trpc.ts`; Nutzung in `rateLimit.ts` / Session-Join                                                                                    | Fix IP-Quelle; **keine** engeren Participant-IP-Limits danach                                                                  |
| **MEDIUM**      | Session-Code-Lockout **pro IP**                                                                                                                                                        | Ein Gerät kann im Hörsaal-NAT den ganzen Saal sperren    | `isSessionCodeLockedOut` / `recordFailedSessionCodeAttempt` in `apps/backend/src/lib/rateLimit.ts`                                                                           | Client-ID als Throttle-Signal + Soft-Cap (kein Hard-Lock Saal); IP nur Telemetrie                                              |
| **MEDIUM**      | Container/Chromium unnötig privilegiert (root, keine `cap_drop` / `no-new-privileges`, `--no-sandbox`)                                                                                 | Größeres Blast-Radius nach Compromise                    | `Dockerfile`, Compose/Deploy-Docs                                                                                                                                            | Sandbox ohne `--no-sandbox` **oder** isolierter PDF-Worker; read-only rootfs / Limits                                          |
| **MEDIUM**      | CSP zu weit (`script-src 'self' 'unsafe-inline' 'unsafe-eval' https:`); CORS `*` inkl. Token-Header                                                                                    | Schwacher XSS-Zusatzschutz; Cross-Origin-API-Missbrauch  | Nginx/App-Header-Auslieferung                                                                                                                                                | Zuerst Report-Only inkl. Endpoint/RL/Minimierung/Retention; CORS same-origin                                                   |
| **MEDIUM**      | Legacy-`accessProof` = Content-Hash (kein Besitzbeweis)                                                                                                                                | Historie/Bonus/PDF mit Quizinhalt+ID rekonstruierbar     | `createLegacyQuizHistoryAccessProof` in `libs/shared-types`; Quiz-Historien-Endpunkte                                                                                        | Claim-first-Migration mit Fenster, Logging, Cutoff; Residuen dokumentieren                                                     |
| **MEDIUM**      | Backups primär lokal auf demselben Host dokumentiert                                                                                                                                   | Wenig Schutz bei Hostverlust/Ransomware                  | [deployment-debian-root-server.md](deployment-debian-root-server.md)                                                                                                         | RPO/RTO/Retention/Keys + isolierter Restore                                                                                    |

### Bereits stark (nicht „neu erfinden“)

- Starke zufällige Host-/Admin-Token, Hash + konstante Vergleiche, Redis-TTLs
- Zentrale `hostProcedure` / `adminProcedure`
- Data-Stripping (`isCorrect` nicht in `ACTIVE`) — [implementation/DATA-STRIPPING-CHECKLIST.md](implementation/DATA-STRIPPING-CHECKLIST.md)
- Vote-Limit **pro Teilnehmer-ID** (Hörsaal-tauglich)
- PostgreSQL/Redis nicht öffentlich; dokumentierte Host-Härtung
- CI: Dependabot, CodeQL, Trivy, SBOM, Dependency Review, `npm audit --omit=dev` (Prod grün)

---

## 4. UX-neutrale vs. Tradeoff-Maßnahmen

### 4.1 Praktisch ohne UX-Einbußen (Woche 0–2 priorisieren)

| Maßnahme                                                                                         | Hinweis                                                                |
| ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| **W0 Containment:** Body-Limits, PDF-Parallelität, Node-Bump-Start, Monitoring-Schwellen         | Sofort, auch vor vollem SSRF-Slice                                     |
| Node.js 20 → **24** (wenn Tests grün) oder **22 jetzt** + verbindlicher Node-24-Termin           | CI/Prod-Image/`.nvmrc`/Docs abstimmen                                  |
| `resolveClientIp` → nur `req.ip` / Trust-Proxy                                                   | CF-/True-Client-IP ignorieren                                          |
| Session-Code-Fehlversuche → Client-ID-Throttle + globales Soft-Cap (Delay+Alert, kein Hard-Lock) | IP-Lockout entfernen; Limit-Auslastung beobachtbar                     |
| Rate-Limits für `quiz.upload`, `quickFeedback.create`, PDF, Admin-Login                          | Großzügige Bursts; Host-Token/global wo sinnvoll                       |
| Quiz-Größenlimits (Fragen, Optionen, Payload-MB)                                                 | UI-Hinweis vor Upload                                                  |
| PDF-SSRF-Kern: TOCTOU-/DNS-Rebind-Schutz, Stream-Cap, MIME+Magic, kein Header-Forward            | Image-Proxy anstreben; **temporärer** Platzhalter fail-closed erlaubt  |
| Non-Root + Chromium-Sandbox **ohne** `--no-sandbox` **oder** isolierter PDF-Worker               | read-only rootfs, tmpfs `/tmp`, pids/CPU/RAM, seccomp/AppArmor, Egress |
| CORS auf eigene Origins / entfernen in Prod                                                      | Same-Origin-App                                                        |
| `X-Powered-By` entfernen                                                                         | trivial                                                                |
| CSP **Report-Only** + Report-Endpoint (RL, Minimierung, Retention)                               | Noch nicht enforce                                                     |
| Externe verschlüsselte Backups: RPO/RTO/Retention/Keys + isolierter Restore                      | Betrieb                                                                |
| Monitoring-/Alarm-Schwellen für Create/PDF/WS                                                    | Betrieb                                                                |

### 4.2 Sichtbare Tradeoffs (ab Woche 2–4)

| Maßnahme                                  | UX-Wirkung                                    | Sinnvolle Umsetzung                                                               |
| ----------------------------------------- | --------------------------------------------- | --------------------------------------------------------------------------------- |
| PDF-Queue / Parallelität (z. B. 1–2)      | Kurze Wartezeit bei Last                      | Fortschrittsanzeige; Cache fertiger Berichte (Size/TTL; sitzungsgebunden löschen) |
| Sicherer Bild-Proxy für PDF               | Langsamer/Fehler → Platzhalter                | Proxy statt Dauerabschalten; Cache Size/TTL; Timeouts; PII-Hinweis                |
| Yjs: signierte Tokens + manuelle Rotation | Längerer Link; „Link ungültig machen“         | Lange Gültigkeit; keine Kurz-TTL; Story 1.6c gestaffelt                           |
| Legacy-`accessProof` abschalten           | Alte Karten verlieren Historie ohne Migration | Claim-first mit begrenztem Fenster → Cutover → Hilfetext; Residuen dokumentieren  |
| CSP enforce                               | Bei Fehlern leere Seite/Assets                | Erst Report-Only, dann schrittweise                                               |

### 4.3 Bewusste Produktentscheidungen (nicht „Bugs“)

- Sync-Link ≈ Capability („wer den Link hat, darf“) — fehlt Relay-Härtung, nicht Login
- Accountfrei: verlorenes `accessProof`/Sync-Token hat keine Kontowiederherstellung
- CORS bei Token-Headern ohne Cookies ist weniger kritisch als bei Cookie-Sessions — trotzdem Prod einschränken
- Anonyme Client-ID ist **kein Sicherheitsbeweis**, nur Throttle-/Anti-Enumeration-Signal (siehe W1.5)

---

## 5. Schutzmodell für ~500 Teilnehmende (Limit-by)

Kernsatz:

> **Teilnehmerverkehr wird pro Session, Teilnehmer und Verbindung kontrolliert – nicht eng pro öffentlicher IP. Teure Host-/Serverfunktionen werden über Token, Größenlimits und globale Ressourcenbudgets geschützt.**

| Vorgang                   | Limitierung nach                                                     | **Nicht** nach                    |
| ------------------------- | -------------------------------------------------------------------- | --------------------------------- |
| Gültiger Session-Beitritt | Sessionkapazität + anonyme Client-ID                                 | öffentlicher IP                   |
| Ungültige Session-Codes   | anonyme Client-ID + sehr großzügiges globales Soft-Cap (Delay+Alert) | enger IP-Lockout / Saal-Hard-Lock |
| Abstimmung                | Teilnehmer-ID, Frage, Runde                                          | IP                                |
| Q&A-Beitrag               | Teilnehmer-ID + Session                                              | IP                                |
| Blitzlicht-Vote           | anonyme Voter-ID + Session                                           | IP                                |
| WebSocket                 | Session, Teilnehmer, globale Serverkapazität                         | enge IP-Conn-Limits               |
| Quiz-Upload               | Host-/Browser-Instanz, Größe, globales Limit                         | primär IP (IP nur grob/optional)  |
| PDF-Erstellung            | Host-Token, Session, globale Parallelität                            | IP                                |
| Admin-Login               | progressive Verzögerung + globales Limit                             | sperrender Hörsaal-IP-Lockout     |
| Session-Erstellung        | großzügiges Limit (ggf. grob IP + global)                            | enge IP-Werte nach Header-Fix     |

### Kapazitäts-Richtwerte (keine finalen Prod-Zahlen)

Aus 500er-Lasttests und gezielter Reconnect-Messung ableiten; grobe Planung:

| Größe                                             | Richtwert                              |
| ------------------------------------------------- | -------------------------------------- |
| Registrierte Teilnehmer / Session                 | 600–650                                |
| Gleichzeitige WS (Burst)                          | ≥ 800                                  |
| Reconnect-Welle                                   | ~500 Geräte, **jittered**              |
| Vote-Burst                                        | 500 Votes in wenigen Sekunden          |
| Zusätzliche Host-/Present-/Moderator-Verbindungen | einplanen                              |
| PDF parallel                                      | z. B. 2 (nur Host; Hörsaal-irrelevant) |

Produkt-SLOs (Latenz/Fehlerquote Join/Vote/WS) **vor** dem formalen Abnahmelasttest festlegen und in Abschnitt 6.5 spiegeln.

### WebSocket ohne Hörsaalprobleme

Statt „max. 20 Verbindungen pro IP“:

- z. B. max. **2** Verbindungen pro Teilnehmer-ID
- großzügige Session-Obergrenze + globale Serverkapazität
- begrenzte Nachrichtengröße und -rate pro Verbindung
- Reconnect mit **zufälliger Verzögerung** (Reconnect-Welle)

### Anonyme Client-ID

- Beim ersten Aufruf zufällig erzeugen, lokal im Browser speichern
- Kein Nutzerkonto, keine PII
- **Kein Security-Proof:** Angreifer können IDs rotieren → immer mit Session- und Global-Caps kombinieren
- Dient als **Throttle-Signal** gegen Code-Enumeration, nicht als Authentifizierung
- Limit-Auslastung (Soft-Cap / Fail-Budget) muss **beobachtbar** sein (Metrik/Alert)

### IP-Ermittlung (trotzdem korrigieren)

- `TRUST_PROXY_HOPS=1` beibehalten
- Backend: **nur** Express-`req.ip`
- `CF-Connecting-IP` / `True-Client-IP` **ignorieren**
- Nginx überschreibt Client-IP, übernimmt sie nicht blind
- Keine Sicherheitsentscheidung anhand eines beliebigen ersten `X-Forwarded-For`-Eintrags
- Zweck: korrekte Logs/Telemetrie und **selten** grobe Host-/Admin-Grenzen — **nicht** Participant-IP-Lock und **kein** Hörsaal-Hard-Lock

---

## 6. Phasenplan Woche 0–4

### Woche 0 — Sofort-Containment (parallel zum Slice-Schnitt)

| #    | Arbeitspaket                                                                                                                     | Akzeptanzkriterien                                                                |
| ---- | -------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| W0.1 | **Body-/Payload-Limits** an öffentlichen Create-/Upload-/Export-Pfaden (Express/tRPC/Nginx)                                      | Übergroße Bodies → 413/klare Fehler; Classroom-Quizze unter Caps                  |
| W0.2 | **PDF-Parallelität** hart begrenzen (z. B. 1–2 global), Queue oder Ablehnung unter Last                                          | Parallele PDF-Jobs ≤ Cap; Live-Voting messbar unberührt                           |
| W0.3 | **Node-Bump starten** (24 bevorzugen / sonst 22 + Termin für 24) — Branch/CI-Matrix, noch kein Pflicht-Prod-Cutover wenn Blocker | Build/Testmatrix dokumentiert; Blocker benannt                                    |
| W0.4 | **Monitoring-Schwellen** Create-Rate, PDF-Tiefe/CPU, WS-Conn, 429-Muster (auch wenn Alarme später feiner)                        | Dashboards/Schwellen existieren; On-Call weiß, wohin schauen                      |
| W0.5 | Optional **SSRF fail-closed Interim:** externe PDF-Bilder → Platzhalter, bis W1.2 vollständig                                    | Kein unkontrollierter Egress; Host-Hinweis; **kein** Dauerzustand als Produktziel |

### Woche 1 — HIGH-Kern + NAT-taugliche Limits (UX-neutral)

| #    | Arbeitspaket                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Akzeptanzkriterien                                                                                                |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| W1.1 | **Node:** Produktionsimage auf **Node 24**, wenn CI/Smoke/relevante Tests grün; sonst **Node 22 jetzt** mit **verbindlichem Cutover-Termin auf Node 24** (Ticket + Datum). Node-20-Prod-Pfad entfernen; `.nvmrc`/Docs abstimmen                                                                                                                                                                                                                                                                                                                                                                                                         | Image baut/läuft auf gewählter LTS; Smoke + Tests grün; Node-24-Termin dokumentiert falls Interim 22              |
| W1.2 | **PDF-SSRF-Kern** (TOCTOU-/DNS-Rebind-resistent): manuelle Redirects mit Hop-Limit; nach jeder Hop erneut auflösen; **alle** A/AAAA prüfen; `connect` an validierte IP binden; blockieren: private/loopback/link-local/multicast/Dokumentationsnetze/Cloud-Metadata; Antwort **streamend** begrenzen; **keine** Cookies/Auth/`Proxy-*`-Header weiterreichen; MIME + Magic-Bytes; Egress zu internen Netzen unterbinden; Asset-Pfad nach `resolve()` unter Asset-Root. Image-Proxy (W3.1) anstreben; **temporär** fail-closed Platzhalter erlaubt, wenn Vollschutz noch nicht ready — **kein** absolutes „externe Bilder nie abschalten“ | Unit-/Integrationstests: Blocklisten, Rebind, Size-Cap, Header-Strip, MIME; kein `file://` / RFC1918 / Metadata   |
| W1.3 | **Public Creates:** Rate-Limits für `quiz.upload` und `quickFeedback.create`; Zod `.max()` für Fragen/Optionen; Payload-Größenlimit; Cleanup verwaister Uploads                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Missbrauchsszenario in Tests; normale Classroom-Quizze unter Caps                                                 |
| W1.4 | **`resolveClientIp`:** nur `req.ip`; Spoof-Header ignorieren; Nginx/Docs                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Tests: gefälschte CF-/XFF-Header ändern Bucket nicht                                                              |
| W1.5 | **Session-Code-Lockout:** IP-Lock entfernen. Anonyme Client-ID = **Throttle-Signal**, kein Security-Proof. Gültige Joins scheitern **nie** am globalen Fail-Budget. Soft-Cap = **Delay + Alert**, kein saalweiter Hard-Lock. IP-Telemetrie ok, **kein** Participant-IP-Lock. Limit-Auslastung beobachtbar (Metrik)                                                                                                                                                                                                                                                                                                                      | Zwei Clients gleicher IP blockieren sich nicht; Enumeration gedrosselt; Soft-Cap löst Delay/Alert, nicht Saal-Tot |
| W1.6 | Grobe Limits Session-Create / Admin-Login (progressive Delay), **ohne** Participant-IP-Tightening                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Create-Spam begrenzt; Admin-Brute-Force erschwert                                                                 |

**Out-of-scope Woche 1:** Image-Proxy-Produktisierung, PDF-Queue-UI, Yjs-Token-Rotation gebaut, `accessProof`-Cutover, CSP enforce, OWASP ZAP als PR-Gate.

### Woche 2 — Defense-in-Depth + Sync-Konzept

| #    | Arbeitspaket                                                                                                                                                                                                                                                   | Akzeptanzkriterien                                                                 |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| W2.1 | **Container:** Non-Root, `cap_drop`, `no-new-privileges`. Chromium: **Sandbox ohne `--no-sandbox`** **oder** isolierter PDF-Worker. PDF-Worker: **read-only rootfs**, tmpfs `/tmp`, `pids_limit`, CPU/RAM-Limits, seccomp/AppArmor, **eingeschränkter Egress** | Deploy + PDF-Export in CI/Staging grün; Sandbox- bzw. Worker-Isolation nachweisbar |
| W2.2 | **Story 1.6c Slice A:** Yjs-Relay Rate-Limit / Conn-/Payload-Grenzen; ADR/Konzept für signierte Share-Tokens + manuelle Rotation                                                                                                                               | Backlog-AKs Rate-Limit + dokumentierter Härtungspfad; Local-First-Smoke ok         |
| W2.3 | WS: Limits pro Participant-ID / Session / global; Message-Size/Rate; Client **jittered Reconnect**                                                                                                                                                             | Reconnect-Welle in Lasttest ohne Totalausfall (Kriterien 6.5)                      |
| W2.4 | CSP **Report-Only** verschärfen: Report-Endpoint mit **Rate-Limit**, Payload-**Minimierung**, definierter **Retention**; `unsafe-eval`/`https:` in script-src beobachten                                                                                       | Reports sammeln unter RL; keine PII-Lawine; App ungebrochen                        |
| W2.5 | CORS in Produktion auf eigene Origins beschränken oder entfernen                                                                                                                                                                                               | Same-Origin-Flows ok                                                               |

### Woche 3–4 — Tradeoffs bewusst + Hygiene

| #    | Arbeitspaket                                                                                                                                                                                                                                                                                                                                                 | Akzeptanzkriterien                                                                          |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| W3.1 | **Sicherer Bild-Proxy** für PDF (Formate, Size ~2 MB Cap, Resize, Timeout, Platzhalter). Cache: **max. Größe**, **TTL**, **sitzungs-/exportgebunden löschen** (PII-/Inhaltsrisiko in gecachten Bildern)                                                                                                                                                      | Bildfragen im PDF nutzbar; SSRF-Tests grün; Cache-TTL/Size/Deletion dokumentiert + getestet |
| W3.2 | Optional **PDF-Queue** (Parallelität 1–2) + Fortschritt + Cache                                                                                                                                                                                                                                                                                              | Host sieht Wartehinweis unter Last; Live-Vote unberührt (Messung 6.5)                       |
| W3.3 | **`accessProof`-Migration (Claim-first):** Legacy akzeptieren → Server stellt random Capability aus → Frontend speichert. **Risikofenster begrenzen:** einmal pro Quiz, Legacy danach deaktivieren, Events loggen, optional zweiter Besitznachweis, **festes Cutoff-Datum**. **Residualrisiko** (wer Inhalt+ID kennt, kann im Fenster claimen) dokumentieren | Aktive Nutzer behalten Historie; Cutover + Residuen in SECURITY-OVERVIEW/Betriebshinweis    |
| W3.4 | **Story 1.6c Slice B (optional/teilweise):** signierte Sync-Tokens + UI „Sync-Link ungültig machen“; lange TTL                                                                                                                                                                                                                                               | Workflow „Link kopieren / zweites Gerät“ bleibt; alte Links nach Rotation tot               |
| W3.5 | **Story 0.9** Astro 6→7 (Landing XSS-Advisories) — parallel, nach Security-Deps                                                                                                                                                                                                                                                                              | Landing build/axe grün; Dependabot-XSS schließbar                                           |
| W3.6 | Externe verschlüsselte Backups: **RPO**, **RTO**, **Retention**, Schlüsselverwaltung, **isolierter Restore**-Pfad (nicht nur Same-Host-Kopie)                                                                                                                                                                                                                | Zahlen dokumentiert; Restore-Übung erfolgreich auf isoliertem Ziel                          |
| W3.7 | Monitoring-Alarme (Create-Rate, PDF-Queue-Tiefe, WS-Conn, 429-Muster, Soft-Cap-Auslastung)                                                                                                                                                                                                                                                                   | Alarmierung getestet                                                                        |

### 6.5 Lasttest-Abnahme (messbar)

Vor dem Abnahmelauf: **Produkt-SLOs** für Join/Vote/WS (Latenz-p95, Fehlerquote) schriftlich festlegen.

| Szenario                                         | Messkriterium (Mindestmaß)                                                                            |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| 500 Clients **gleiche IP**, distinkte Client-IDs | Joins/Votes erfolgreich gemäß SLO; **kein** saalweiter IP-Lock                                        |
| Rate-Limit / Enumeration                         | Ungültige Codes → **429**/Delay gemäß Soft-Cap; gültige Joins nicht am Fail-Budget                    |
| WebSocket-Burst                                  | ≥ geplante Concurrent-WS; keine unkontrollierte Conn-Explosion                                        |
| Reconnect-Welle                                  | **95 %** der Clients innerhalb **30 s** wieder verbunden (jittered)                                   |
| Vote-Burst                                       | 500 Votes in wenigen Sekunden; p95/Fehlerquote innerhalb SLO                                          |
| PDF parallel vs. Live-Voting                     | PDF-Jobs am Cap; Vote-Latenz/Fehlerquote **nicht** regressiert über Schwelle                          |
| Metriken                                         | Create-Rate, PDF-Tiefe, WS-Conn, 429-Rate, Soft-Cap-Auslastung sichtbar während Lauf                  |
| Recovery                                         | Nach Lastspitze Rückkehr in Steady-State ohne manuellen Restart (oder dokumentierter Runbook-Schritt) |
| Abuse während Test                               | Paralleler Create-/Code-Guess-/PDF-Spam; Kern-Live-Session bleibt innerhalb SLO                       |

Referenz: [implementation/LASTTEST-500-TEILNEHMENDE.md](implementation/LASTTEST-500-TEILNEHMENDE.md), [PERFORMANCE-TESTING.md](PERFORMANCE-TESTING.md).

### 6.6 Maßnahme: Owner / Ticket / Deps / Rollback

Pro Arbeitspaket (W0–W3) vor Umsetzung ausfüllen:

| Feld           | Inhalt                                               |
| -------------- | ---------------------------------------------------- |
| Owner          | verantwortliche Person/Rolle                         |
| Ticket / Issue | GitHub-Issue oder PR-Slice                           |
| Abhängigkeiten | z. B. W1.2 vor W3.1; W0.5 entfällt nach W1.2         |
| Rollback       | Feature-Flag, Image-Pin, Config-Revert, Cutover-Stop |

### Übergreifende Akzeptanz (Ende Phase)

- [ ] **Keine offenen HIGH-Befunde** (Node, PDF-SSRF-Kern inkl. Rebind-Bind, Public Creates)
- [ ] Definierte Security-Tests (SSRF/Rebind, IP-Spoof, Client-ID Soft-Cap, Container/Sandbox oder PDF-Worker) **bestanden**
- [ ] Lasttest-Abnahme nach Abschnitt **6.5** **bestanden** (inkl. Produkt-SLOs)
- [ ] Kein enges IP-Limit auf Join/Vote/Q&A/Blitzlicht/WS; Soft-Cap nur Delay+Alert
- [ ] SECURITY-OVERVIEW + ENVIRONMENT um neue Limits/IP-Annahmen/accessProof-Residuen aktualisiert
- [ ] Kein `npm audit fix --force`; Prod-`npm audit --omit=dev` bleibt Steuerungsgröße
- [ ] Jede umgesetzte Maßnahme hat Owner/Ticket/Deps/Rollback dokumentiert

---

## 7. Was ausdrücklich **nicht** tun

| Nicht tun                                                        | Warum                                                                                                                                            |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Externe PDF-Bilder **dauerhaft** vollständig abschalten          | Zerstört Bildfragen/Diagramme; Image-Proxy ist der UX-konforme Dauerweg. **Temporärer** fail-closed Platzhalter (W0.5) bis W1.2/W3.1 ist erlaubt |
| Enge **IP-Lockouts / `limit_conn` pro IP** auf Teilnehmerpfaden  | 500 Geräte hinter NAT → Veranstaltung tot                                                                                                        |
| Client-ID als **Authentifizierung** oder Hard-Proof behandeln    | Leicht rotierbar; nur Throttle-Signal                                                                                                            |
| Globalen Fail-Budget so setzen, dass **gültige Joins** scheitern | Hörsaal stirbt bei Enumeration-Welle                                                                                                             |
| Soft-Cap als **saalweiten Hard-Lock** implementieren             | Delay+Alert statt Totalausfall                                                                                                                   |
| Nach IP-Fix die **alten engen IP-Zahlen** unverändert übernehmen | Erhöht False-Positive-Sperren im Campus-NAT                                                                                                      |
| Chromium dauerhaft mit **`--no-sandbox`** in Prod belassen       | Sandbox reparieren oder PDF-Worker isolieren                                                                                                     |
| **`npm audit fix --force`**                                      | Zerlegt oft Astro/Angular/Artillery; Astro-XSS bewusst an Story 0.9 koppeln                                                                      |
| Blind einzelne Astro-6-XSS-Advisories closen                     | Major-Bump Story **0.9**                                                                                                                         |
| OWASP Dependency-Check als zusätzliches PR-Gate                  | Dupliziert npm audit/Trivy/Dependabot; Noise                                                                                                     |
| OWASP ZAP als blockierendes PR-Gate                              | Optional später Nightly gegen Staging                                                                                                            |
| Sehr kurze Yjs-Token-TTLs / erzwungene Re-Auth                   | Bricht Local-First/Offline/Reconnect                                                                                                             |
| Sofortiger Legacy-`accessProof`-Cutover ohne Fenster/Logging     | Historienverlust; Claim-Missbrauch unkontrolliert                                                                                                |
| CSP sofort enforce mit harter `script-src`                       | Risiko leerer App; erst Report-Only                                                                                                              |
| CSP-Reports ohne RL/Minimierung/Retention                        | Log-Flood / PII-Risiko                                                                                                                           |
| Accounts „nur kurz“ einführen für Sync/Historie                  | Produktbruch                                                                                                                                     |
| Alles von Stufe-B-Sync in einem PR                               | Erst 1.6c Rate-Limit+Konzept, dann Tokens                                                                                                        |
| Erfolgsmaß als vage „7–8/10“-Sicherheitsnote                     | Stattdessen: keine offenen HIGHs + bestandene Security-/Lasttests                                                                                |

---

## 8. Backlog- und Dokumentbezüge

| Thema                    | Bezug                                                                                                                                        |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Sync-Sicherheit          | **Story 1.6c** ([Backlog.md](../Backlog.md)); [architecture/quiz-library-sync.md](architecture/quiz-library-sync.md); ADR-0019               |
| Landing XSS / Astro      | **Story 0.9** (Astro ≥ 7.1; geplant nach Security-Deps #121)                                                                                 |
| Ist-Kontrollen           | [SECURITY-OVERVIEW.md](SECURITY-OVERVIEW.md)                                                                                                 |
| Env / Trust-Proxy        | [ENVIRONMENT.md](ENVIRONMENT.md), `TRUST_PROXY_HOPS`                                                                                         |
| Deploy / Nginx / Backups | [deployment-debian-root-server.md](deployment-debian-root-server.md)                                                                         |
| PDF-Export               | [features/session-export-pdf.md](features/session-export-pdf.md)                                                                             |
| Host-Härtung             | [ADR-0019](architecture/decisions/0019-host-hardening-and-owner-bound-session-access.md)                                                     |
| Data-Stripping           | [implementation/DATA-STRIPPING-CHECKLIST.md](implementation/DATA-STRIPPING-CHECKLIST.md)                                                     |
| Last / 500 TN            | [implementation/LASTTEST-500-TEILNEHMENDE.md](implementation/LASTTEST-500-TEILNEHMENDE.md), [PERFORMANCE-TESTING.md](PERFORMANCE-TESTING.md) |
| CI-Security              | [CI-WORKFLOW.md](CI-WORKFLOW.md), [TESTING.md](TESTING.md)                                                                                   |
| Dependabot / Overrides   | PR #121 (sharp/shell-quote/…); Prod-Audit `--omit=dev`                                                                                       |

---

## 9. Empfohlene Umsetzungsreihenfolge (Kurz)

**Woche 0:** Body-Limits · PDF-Parallelität · Node-Bump starten · Monitoring-Schwellen · optional SSRF-Platzhalter fail-closed

**Woche 1 parallel:** Node 24 (oder 22 + Termin) · PDF-SSRF-Guardrails (Rebind/IP-Bind/Stream/MIME) · Create-/Größenlimits · `resolveClientIp` · Client-ID Soft-Cap (kein Hard-Lock)

**Woche 2:** Container/Chromium-Sandbox oder PDF-Worker · 1.6c Rate-Limit + Token-Konzept · WS-Caps + jittered Reconnect · CSP Report-Only (Endpoint/RL) · CORS

**Woche 3–4:** Image-Proxy + Cache-TTL/Size/Deletion · optional PDF-Queue · `accessProof`-Migration (Fenster/Cutoff/Residuen) · Sync-Rotation (Slice) · Astro 0.9 · Backups RPO/RTO/isolierter Restore · Monitoring-Alarme

**Abnahme:** Security-Tests + Lasttest 6.5; Erfolgsmaß = keine offenen HIGHs + Tests bestanden.

Danach sinnvoll: gezielter Penetrationstest mit Serverzugriff, Logs und kontrollierten Szenarien — nicht als Ersatz für die oben genannten Fixes.

---

## 10. Änderungsnotiz

| Datum      | Änderung                                                                                                                                                                                  |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-07-22 | Erstfassung: externes Audit + UX-Follow-up + NAT/Hörsaal-Rate-Limit-Nachtrag konsolidiert                                                                                                 |
| 2026-07-22 | Plan-Review (7/10): Schärfung SSRF/TOCTOU, Client-ID Soft-Cap, Container/Chromium, accessProof-Fenster, Lasttest-AKs, Node 24, W0, Cache/CSP/Backup-Metadaten, Owner/Rollback, Erfolgsmaß |

**Dieses Dokument ist ein Umsetzungsplan.** Konkrete Code-Fixes gehören in eigene PRs pro Slice; dieses File nur bei Planänderungen anpassen und [docs/README.md](README.md) / [SECURITY-OVERVIEW.md](SECURITY-OVERVIEW.md) verlinkt halten.
