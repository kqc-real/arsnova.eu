<!-- markdownlint-disable MD013 -->

# Last- und Performance-Tests — Werkzeuge im Projekt arsnova.eu

**Stand:** 2026-07-10 · **Zielgruppe:** SQM-Praktikum, Story **0.7**, Referate zu nicht-funktionaler Qualität

**Zweck:** Dieses Dokument informiert dich darüber, **mit welchen Werkzeugen** wir Last- und Performance-Tests im Projekt planen, durchführen und dokumentieren — und **was davon bereits im Repo liegt**.

---

## Kurzüberblick (30 Sekunden)

arsnova.eu ist **kein** klassisches HTTP-only-System. Live-Sessions laufen über **tRPC**, **WebSockets**, **Redis** und **PostgreSQL**. Deshalb nutzen wir **mehrere Werkzeuge** mit klarer Rollentrennung — nicht ein einziges Lasttest-Tool für alles.

| Kategorie                                  | Standardwerkzeug                      | Status im Repo                               |
| ------------------------------------------ | ------------------------------------- | -------------------------------------------- |
| Protokollnahe Last (HTTP/tRPC)             | **k6**                                | Skripte vorhanden                            |
| Realtime / WebSocket / E2E-nahe Last       | **Artillery**                         | `load:artillery:500` (HTTP + WS, bis 500 TN) |
| Funktionale Browser-Flows                  | **Playwright**                        | Smokes & Benchmarks vorhanden                |
| Schnelle lokale Hotspot-Checks             | **Node-Skripte** (`load:simulate:50`) | Vorhanden                                    |
| Frontend-Ladeverhalten (Nutzerwahrnehmung) | **Lighthouse** + Chrome DevTools      | Dokumentiert, manuell                        |
| Einfache Node-Simulationen                 | eigene Skripte unter `scripts/load/`  | Vorhanden                                    |

Verbindliche Entscheidung: [ADR-0013](../architecture/decisions/0013-use-k6-and-artillery-for-load-and-performance-testing.md).

---

## 1. Warum mehrere Tools?

Typische Live-Szenarien bei arsnova.eu:

- **500 Teilnehmende** joinen in kurzer Zeit (Join-Welle)
- Host wechselt Session-Status → **500 WebSocket-Subscriptions** bekommen Updates
- Gleichzeitige **Votes** auf eine aktive Frage
- Optional: Freitext, Q&A, Reconnect, Quiz-Sync

Ein reiner HTTP-Lasttest bildet das nicht vollständig ab. Deshalb gilt im Projekt:

```text
k6          → reproduzierbare Protokoll-Last + Schwellwerte
Artillery   → Realtime- und browsernahe Mehrnutzer-Szenarien (Zielbild)
Playwright  → funktionale Referenz-Flows (kein Ersatz für Last)
Lighthouse  → Frontend-Performance im Browser (kein Server-Lasttest)
```

---

## 2. Die Werkzeuge im Detail

### 2.1 k6 — protokollnahe Lasttests

**Was es ist:** Open-Source-Lasttest-Tool; Szenarien als JavaScript, Ausgabe mit Latenz-Percentilen und Fehlerraten.

**Wofür wir es nutzen:**

- tRPC-Requests (`session.join`, `vote.submit`, `getCurrentQuestionForStudent`)
- Join-Wellen und Vote-Spikes mit festen VU-Zahlen (virtuelle Nutzer)
- Schwellwert-Checks (`p95`, Fehlerrate)
- Regressionsvergleiche zwischen Builds (manuell oder später in CI)

**Was im Repo liegt** (`scripts/load/`):

| Skript                         | Typische Last | Zweck                                |
| ------------------------------ | ------------- | ------------------------------------ |
| `k6-trpc-health-50vu.js`       | 50 VUs, 30 s  | Sanity auf `health.stats`            |
| `k6-trpc-session-50vu.js`      | 50 VUs        | Join + Lobby-Polling                 |
| `k6-session-hotpaths-500vu.js` | bis 500 VUs   | Join-Welle, aktive Frage, Vote-Spike |

**Installation:** k6 ist **kein** npm-Paket (Grafana liefert bewusst keine CLI über npm). Im Projekt startest du k6 über **NPM-Wrapper**, die automatisch lokales `k6` oder Docker (`grafana/k6`) nutzen:

```bash
npm run dev:backend
npm run load:k6:health          # Sanity (50 VUs, health.stats)
npm run load:k6:session         # Join + Lobby — SESSION_CODE=AB12CD setzen
npm run load:k6:hotpaths        # 500er-Hotpaths — MODE=join-wave SESSION_CODE=... setzen
```

Der Wrapper [`scripts/load/run-k6.mjs`](../../scripts/load/run-k6.mjs) erkennt:

1. **lokales `k6` in PATH** → `BASE_URL=http://127.0.0.1:3000`
2. **sonst Docker** (Voraussetzung laut [`onboarding.md`](../onboarding.md)) → macOS/Windows: `host.docker.internal`; Linux/WSL: `--network host`

**Optionale native Installation** (schneller, ohne Docker-Overhead): [k6.io/docs/get-started/installation](https://k6.io/docs/get-started/installation/) — macOS: `brew install k6`, Windows/WSL: siehe offizielle Doku. **Kein separates Installations-Handout nötig**, solange Docker läuft.

**Direkt per Docker** (falls du den Wrapper umgehen willst):

| Plattform    | `BASE_URL` für Backend auf dem Host                            |
| ------------ | -------------------------------------------------------------- |
| Linux / WSL2 | `http://127.0.0.1:3000` mit `--network host`                   |
| **macOS**    | `http://host.docker.internal:3000` (**ohne** `--network host`) |

Auf **macOS** funktioniert `docker run --network host` nicht zuverlässig — der Container erreicht das lokale Backend dann nicht (100 % HTTP-Fehler).

```bash
# Sanity (macOS + Docker, manuell)
docker run --rm -i \
  -e BASE_URL=http://host.docker.internal:3000 \
  grafana/k6 run - < scripts/load/k6-trpc-health-50vu.js
```

**Beispiel (lokal installiertes k6, ohne Wrapper):**

```bash
npm run dev:backend
BASE_URL=http://127.0.0.1:3000 k6 run scripts/load/k6-trpc-health-50vu.js

MODE=join-wave SESSION_CODE=AB12CD BASE_URL=http://127.0.0.1:3000 VUS=500 \
  k6 run scripts/load/k6-session-hotpaths-500vu.js
```

**Wichtig:** Join-Tests legen echte Teilnehmer in der Datenbank an. Für Wiederholungen **neue Session** verwenden.

---

### 2.2 Artillery — Realtime- und E2E-nahe Last

**Was es ist:** Node.js-basiertes Lasttest-Framework mit gutem WebSocket-Support; eignet sich für komplexere Mehrnutzer-Flows.

**Wofür wir es nutzen** (ADR-0013):

- Unified Live-Session unter Last: Join-Welle, Quiz-Vote, Q&A, Blitzlicht
- WebSocket-Subscriptions (`onStatusChanged`, Host `onHostVoteProgressChanged`)
- Ergebnis-Fan-out nach `revealResults`

**Im Repo:**

| NPM-Skript           | Zweck                                                               |
| -------------------- | ------------------------------------------------------------------- |
| `load:artillery:500` | 500 TN (konfigurierbar), HTTP + WS, JSON-Summary + Artillery-Report |

**Start (lokal, Backend läuft):**

```bash
npm run dev:backend
PARTICIPANTS=500 npm run load:artillery:500
```

**CI:** Job `artillery-500` bei `schedule` / `workflow_dispatch` (Standard: 100 TN auf Runner; volle 500 lokal oder per Repository-Variable `ARTILLERY_PARTICIPANTS`).

**Skripte:** `scripts/load/run-artillery-500.mjs`, `scripts/load/artillery/500-live-session.yml`, `scripts/load/artillery/processor.mjs`

---

### 2.3 Playwright — funktionale Browser-Flows

**Was es ist:** Browser-Automatisierung für E2E-Tests.

**Rolle bei Performance/Last:** Playwright ist **kein** Lastgenerator für 500 Clients. Es liefert **Referenz-Szenarien**, die unter Last **wiedererkennbar** bleiben müssen.

**Was im Repo liegt:**

| NPM-Skript (Frontend-Workspace)                                     | Zweck                                      |
| ------------------------------------------------------------------- | ------------------------------------------ |
| `smoke:unified-session`                                             | Live-Session-Flow (Join, Kanäle)           |
| `smoke:quiz-sync`                                                   | Quiz-Sync über Yjs                         |
| `smoke:short-text`, `smoke:host-music`, `smoke:numeric-estimate`, … | weitere Kern-Flows                         |
| `benchmark:word-cloud`                                              | Wortwolken-Layout-Performance (Regression) |

**Start (Beispiel Unified Session):**

```bash
npm run dev:backend
npm run build:localize -w @arsnova/frontend
npm run serve:localize:api -w @arsnova/frontend
BASE_URL=http://localhost:4200 npm run smoke:unified-session -w @arsnova/frontend
```

Details: [`docs/TESTING.md`](../TESTING.md).

---

### 2.4 Node-Skripte unter `scripts/load/` — Smokes und Hotspot-Checks ohne k6

Ergänzende Bausteine für schnelle lokale Checks und echte tRPC-/WebSocket-Pfade — **ohne** separates Mikrobenchmark-Tool:

| Skript                             | NPM-Befehl (Root)                        | Zweck                                           |
| ---------------------------------- | ---------------------------------------- | ----------------------------------------------- |
| `concurrent-50-http.mjs`           | `npm run load:simulate:50`               | 50 parallele Reads auf `health.stats`           |
| `session-participants-50.mjs`      | `npm run load:simulate:session:50`       | 50 Joins + Lobby-Polling                        |
| `ws-status-subscribers.mjs`        | — (direkt per `node`)                    | viele parallele `onStatusChanged`-Subscriptions |
| `host-vote-progress-200.mjs`       | `npm run load:smoke:host-vote-progress`  | Votes + Host-WebSocket-Fan-out                  |
| `vote-timer-fairness-600.mjs`      | `npm run load:smoke:vote-timer-fairness` | Timer/Karenz unter 600 parallelen Votes         |
| `yjs-sync-load.mjs`                | `npm run load:yjs:sync`                  | Mehrclient-Sync, Offline-Updates und Reconnect  |
| `freetext-wordcloud-classroom.mjs` | `npm run load:freetext:wordcloud`        | Freitext-Votes und Host-Word-Cloud              |
| `soak-live-session.mjs`            | `npm run load:soak:live-session`         | Langlauf mit HTTP-/Prozess-/DB-/Redis-Probes    |

**Beispiel WebSocket-Status-Fan-out** (Session-Code vorher anlegen):

```bash
SESSION_CODE=AB12CD CLIENTS=500 DURATION_MS=60000 WS_URL=ws://127.0.0.1:3001 \
  node scripts/load/ws-status-subscribers.mjs
```

Während des Laufs Host-Statuswechsel auslösen (`LOBBY → QUESTION_OPEN → ACTIVE → RESULTS`).

**Beispiel Host-Vote-Progress:**

```bash
npm run dev:backend
npm run load:smoke:host-vote-progress

# Erweiterter Check:
PARTICIPANTS=600 npm run load:smoke:host-vote-progress
```

Diese Smokes sind **kein** Ersatz für einen vollständigen 500er-Lauf, aber wichtige **Regressionstests** nach Änderungen am Vote- oder Realtime-Pfad.

---

### 2.5 Lighthouse & Chrome DevTools — Frontend-Performance

**Wofür:** Nutzerwahrnehmbare Ladezeit, Bundle-Größe, Accessibility — **nicht** Server-Skalierung unter 500 parallelen Joins.

**Projektbezug:**

- [`docs/ui/LIGHTHOUSE-PERFORMANCE.md`](../ui/LIGHTHOUSE-PERFORMANCE.md)
- Bundle-Budgets in `angular.json` (initial max. 1,70 / 1,85 MB)
- `npm run lighthouse:a11y -w @arsnova/frontend`

**Merke:** Lighthouse immer gegen einen **Production-Build** messen, nicht gegen `ng serve`.

---

## 3. Was bereits getestet wurde (Ergebnisse)

Dokumentierte Läufe vom **9. Mai 2026**:

| Lauf                                       | Dokument                                                                                                         | Kurzfazit                                       |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Lokal, 500 VUs (Join, Status, Frage, Vote) | [`LASTTEST-500-ERGEBNIS-2026-05-09.md`](../implementation/LASTTEST-500-ERGEBNIS-2026-05-09.md)                   | Alle Kernpfade bestanden; zwei technische Fixes |
| Produktion, Join-Welle 500                 | [`LASTTEST-500-PRODUKTION-6LTFZF-2026-05-09.md`](../implementation/LASTTEST-500-PRODUKTION-6LTFZF-2026-05-09.md) | 500/500 Joins, p95 = 3,57 s (Grenzbereich)      |

**Leitfaden für weitere Tests:** [`LASTTEST-500-TEILNEHMENDE.md`](../implementation/LASTTEST-500-TEILNEHMENDE.md), [`LASTTEST-ARSNOVA-ARCHITEKTUR-ARBEITSAUFTRAG.md`](../implementation/LASTTEST-ARSNOVA-ARCHITEKTUR-ARBEITSAUFTRAG.md).

**Laststufen (Konzept):** 50 → 100 → 250 → 500 → Wiederholung — skalierbar über Parameter `VUS`, `CLIENTS`, `PARTICIPANTS`.

---

## 4. CI und Story 0.7 — aktueller Stand

Die **Standard-CI** ([`.github/workflows/ci.yml`](../../.github/workflows/ci.yml))
führt sechs kurze Classroom-Smokes als Deploy-Gate aus. Nacht- und manuelle Läufe
decken Artillery-Kapazität, Reconnect, schwere Vote-Hotpaths, Yjs,
Freitext/Wordcloud und einen 5-Minuten-Soak ab. Vollständige 500-TN-Läufe gegen
Staging benötigen eine explizite Freigabe.

Story **0.7** im [`Backlog.md`](../../Backlog.md) bleibt **🟡 in Arbeit** (Stand
2026-07-11): Testprofile, harte Latenz-/Fehler-Gates, standardisierte
JSON-/JUnit-Reports, Regressionsvergleich und Laufzeitprobes sind vorhanden.

Der
[lokale Gesamt-Testlauf vom 2026-07-10](../implementation/LOCAL-TESTRUN-2026-07-10.md)
belegt 19/21 Last-/Performance-Szenarien als bestanden. Artillery Live und
Reconnect erreichten jeweils 500/500 Teilnehmende, alle k6-Profile und der
5-Minuten-Soak waren grün. Im damaligen Lauf reproduzierbar offen waren dagegen die
Yjs-Konvergenz nach Offline-Reconnect und das 1.000-ms-p95-Gate beim
600er Timer-Fairness-Lauf. Auch drei Browser-Referenzflows und das
Lighthouse-Performance-Gate waren nicht grün.

Der
[gezielte QA-Nachlauf vom 2026-07-11](../implementation/LOCAL-QA-RECHECK-2026-07-11.md)
belegt die Korrekturen: Yjs-Reconnect, beide akzeptierenden 600er Vote-Pfade,
6/6 Browser-Referenzflows und 6/6 Lighthouse-Läufe bestanden. Für Story 0.7
bleiben Staging-Langlauf und Baseline-Freigabe.

Neben der Ursachenklärung dieser Befunde stehen geprüfte
30/60-Minuten-Pilotläufe in einer stabilen Staging-Umgebung und daraus
freigegebene Produktionsbaselines aus.

Das aktuelle Inventar und alle Kommandos stehen in
[`PERFORMANCE-TESTING.md`](../PERFORMANCE-TESTING.md).

**Dein Beitrag kann z. B. sein:** einen reproduzierbaren Pilot-Lauf durchführen,
die Messumgebung dokumentieren, eine Baseline fachlich prüfen oder einen Engpass
aus dem Report analysieren — in Absprache mit der Betreuung.

---

## 5. Empfohlener Einstieg für dich

### Schritt 1 — Orientierung (ca. 1 h)

1. ADR-0013 lesen (Tool-Rollen)
2. Dieses Handout + Abschnitt „Host-Vote-Progress“ in [`TESTING.md`](../TESTING.md)
3. [`PERFORMANCE-WELLENMODELL-ARSNOVA-EU.md`](../implementation/PERFORMANCE-WELLENMODELL-ARSNOVA-EU.md) — Abschnitt „Wellenübersicht“ (Join-Welle, Vote-Spike)

### Schritt 2 — Lokal ausführen (ca. 2–3 h)

```bash
npm run dev:backend

# Leichte Checks (ohne k6)
npm run load:simulate:50
npm run load:smoke:host-vote-progress

# Mit k6 über Projekt-Wrapper (empfohlen — nutzt lokales k6 oder Docker automatisch)
npm run load:k6:health

# Mit k6 lokal installiert (optional)
BASE_URL=http://127.0.0.1:3000 k6 run scripts/load/k6-trpc-health-50vu.js
```

### Schritt 3 — Messprotokoll anlegen

Nutze die Vorlage [`VORLAGE-MESSPROTOKOLL-LAST.md`](./VORLAGE-MESSPROTOKOLL-LAST.md) (geführter Ablauf: [`Arbeitsanweisungen SQM/05-last-pilot-durchfuehren.md`](./Arbeitsanweisungen%20SQM/05-last-pilot-durchfuehren.md)).

Halte fest:

- Datum, Commit-Stand, Hardware (lokal vs. Server)
- Tool, Skript, Parameter (`VUS`, `SESSION_CODE`, …)
- Metriken: Fehlerrate, p50/p95/p99, beobachtete Engpässe
- Interpretation: bestanden / degradiert / fehlgeschlagen (mit Begründung)

Vorlage orientiert sich an den Berichten unter `docs/implementation/LASTTEST-*.md`.

---

## 6. Regeln und Grenzen

- **Keine Lasttests gegen Produktion** ohne ausdrückliche Freigabe der Betreuung.
- **Keine personenbezogenen Daten** in Test-Sessions oder öffentlichen Protokollen.
- Join-Lasttests erzeugen **echte DB-Einträge** — Test-Sessions gezielt anlegen und nach dem Lauf aufräumen.
- Lasttests respektieren das **Sicherheitsmodell** (keine Abkürzungen, die Host-/Teilnehmer-Pfade unrealistisch vereinfachen).
- Schwere Lastläufe bleiben im Nacht-/Manuell-/Staging-Pfad; die normale PR-CI
  nutzt nur kurze, reproduzierbare Gates.

---

## 7. Weiterführende Links

| Thema                        | Dokument                                                                                                          |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Tool-Entscheidung            | [ADR-0013](../architecture/decisions/0013-use-k6-and-artillery-for-load-and-performance-testing.md)               |
| SLO vs. Laststatus (Betrieb) | [ADR-0021](../architecture/decisions/0021-separate-service-status-from-load-status-with-live-slo-telemetry.md)    |
| Performance-Hotpaths         | [ADR-0026](../architecture/decisions/0026-prioritize-performance-hotpaths-and-de-escalate-telemetry-side-load.md) |
| Tests & CI allgemein         | [`TESTING.md`](../TESTING.md)                                                                                     |
| SQM-Praktikum                | [`PRAKTIKUM-SQM.md`](./PRAKTIKUM-SQM.md)                                                                          |
| Story 0.7 Akzeptanzkriterien | [`Backlog.md`](../../Backlog.md)                                                                                  |
| Angular Profiling            | [angular.dev — Profiling](https://angular.dev/best-practices/profiling-with-chrome-devtools)                      |

---

## Anhang: Gesprächsleitfaden für die Erstbesprechung (Betreuung)

Kurzfolie für das Erstgespräch — du kannst die Studierende durch diese Punkte führen:

1. **Kontext:** arsnova.eu ist realtime-lastig; ein Tool reicht nicht → ADR-0013.
2. **Jetzt nutzbar:** k6 + `scripts/load/` + Playwright-Smokes + Lighthouse.
3. **Lokal belegt:** Yjs-Reconnect, 600er Vote-Timer-Latenz, sechs Browser-Flows
   und Lighthouse-LCP sind im QA-Nachlauf grün.
4. **Aktuell zu belegen:** stabile 30/60-Minuten-Staging-Läufe und daraus geprüfte
   Produktionsbaselines.
5. **Erster Hands-on:** `npm run dev:backend` → `load:simulate:50` → `npm run load:k6:health`.
6. **Artefakt für SQM:** Messprotokoll eines Pilot-Laufs **oder** Konzept für ein fehlendes Szenario (Absprache).
7. **Grenze:** Prod-Last nur mit Freigabe; Fokus lokal oder produktionsnahe Testumgebung laut LASTTEST-500-Doku.
