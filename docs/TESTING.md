<!-- markdownlint-disable MD013 MD060 -->

# Tests & CI — Referenz

**Lokal** vor PR: mindestens `npm run build`, `npm run lint`, `npm test` (entspricht den wesentlichen CI-Gates). Vollständige DoD: [Backlog.md](../Backlog.md) „Definition of Done“. Nach größeren Änderungen an **`@arsnova/shared-types`**: wie in Root-[README](../README.md) zuerst `npm run build -w @arsnova/shared-types` bzw. Root-`npm run build` nutzen.

**Stand:** 2026-07-06 · Workflow: [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) (Node **20** und **22**; inkl. `dependency-review`, `actionlint`, `trivy-fs`, `trivy-image`, `post-deploy-smoke`) · Deploy-Skript: [`scripts/deploy.sh`](../scripts/deploy.sh)

---

## NPM-Skripte (Root)

| Befehl                              | Bedeutung                                                                                    |
| ----------------------------------- | -------------------------------------------------------------------------------------------- |
| `npm run build`                     | `shared-types` → Backend `tsc` → Frontend `ng build`                                         |
| `npm run typecheck`                 | `shared-types` bauen (`dist`), dann Backend + Frontend `tsc --noEmit`                        |
| `npm run lint`                      | ESLint über `libs/` und `apps/`                                                              |
| `npm test`                          | **Backend** Vitest + **Frontend** Vitest (sequentiell)                                       |
| `npm run format:check`              | Prettier (ohne Schreiben)                                                                    |
| `npm run verify:production-serving` | HTTP-Smoke gegen einen laufenden Production-Serve (`/`, `/de/`, Compression, `health.stats`) |

Workspace-spezifisch:

| Workspace           | Tests                                              | Typcheck                                 |
| ------------------- | -------------------------------------------------- | ---------------------------------------- |
| `@arsnova/backend`  | `npm run test -w @arsnova/backend` (`vitest run`)  | `npm run typecheck -w @arsnova/backend`  |
| `@arsnova/frontend` | `npm run test -w @arsnova/frontend` (`vitest run`) | `npm run typecheck -w @arsnova/frontend` |

`npm run typecheck -w @arsnova/backend` setzt ein gebautes `@arsnova/shared-types` (`libs/shared-types/dist`) voraus; das Root-Skript `npm run typecheck` baut die Library zuerst.

---

## CI-Pipeline (GitHub Actions, `main`)

Auslöser: **Push** und **Pull Request** auf `main`.

| Job / Phase                            | Inhalt                                                                                                                                                                                                      |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **dependency-review**                  | PR-abhängiger Dependency-Risiko-Check (`fail-on-severity: high`)                                                                                                                                            |
| **actionlint**                         | Linting/Validierung der GitHub-Workflow-Dateien                                                                                                                                                             |
| **build** (Node 20 & 22)               | `npm ci` → `prisma validate` → `prisma generate` → `tsc -b apps/backend` → Frontend `tsc --noEmit` → `build:localize` (Frontend, **alle** konfigurierten Locales `de/en/fr/it/es`)                          |
| **typecheck** (Node 20 & 22, parallel) | `npm ci` → `prisma validate` → `prisma generate` → `npm run typecheck` (inkl. `build` für `shared-types`, dann `--noEmit`)                                                                                  |
| **lint**                               | `npm run lint` (nach build)                                                                                                                                                                                 |
| **audit**                              | `npm audit --audit-level=high --omit=dev` (**blockierend für Produktionsabhängigkeiten**)                                                                                                                   |
| **test**                               | `npm run test:coverage` (nach build, inkl. Coverage-Thresholds)                                                                                                                                             |
| **trivy-fs**                           | Trivy-Scan des Repository-Dateisystems (HIGH/CRITICAL, blockierend)                                                                                                                                         |
| **trivy-image**                        | Docker-Image-Build für Scan + Trivy-Image-Scan (HIGH/CRITICAL, blockierend)                                                                                                                                 |
| **lighthouse**                         | Lighthouse CI gegen `/de/` und `/en/`; Reports als Artifact                                                                                                                                                 |
| **e2e**                                | Playwright Smoke E2E mit Postgres/Redis + Service-Logs als Artifact                                                                                                                                         |
| **classroom-smokes**                   | Vier Unterrichts-Szenario-Smokes (Blitzlicht, Q&A, Demo-Quiz, WS Vote-Progress, je 30 TN) gegen lokales Backend; JSON-Reports als Artifact                                                                  |
| **docker**                             | Docker-Image-Build (ohne Push), nach build                                                                                                                                                                  |
| **deploy**                             | Nur bei Push auf `main` und `DEPLOY_ENABLED=true`; läuft nach **`lint`, `test`, `docker`, `typecheck`, `lighthouse`, `e2e`, `audit`, `trivy-fs`, `trivy-image`**; ruft serverseitig `scripts/deploy.sh` auf |
| **post-deploy-smoke**                  | Prüft nach erfolgreichem Deploy die Produktionsauslieferung via `scripts/verify-production-serving.mjs`                                                                                                     |

Matrix: **zwei** LTS-Versionen (**20** und **22**), `fail-fast: false`.

Für die ausführliche, schrittweise Erklärung (inkl. Ablaufdiagramm) siehe [CI-WORKFLOW.md](CI-WORKFLOW.md).

### Reports & Artefakte in GitHub Actions

Artifacts findest du in einem Run unter: **Actions → CI-Run öffnen → Artifacts**.

| Artefaktname              | Erzeugender Job    | Inhalt                                                                                                                               | Retention |
| ------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------ | --------- |
| `frontend-dist-browser`   | `build`            | Frontend-Produktionsbuild (`apps/frontend/dist/browser`)                                                                             | 1 Tag     |
| `coverage-reports`        | `test`             | Coverage-Reports aus `apps/backend/coverage` und `apps/frontend/coverage`                                                            | 7 Tage    |
| `lighthouse-reports`      | `lighthouse`       | Lighthouse-Ausgabe aus `.lighthouseci`                                                                                               | 7 Tage    |
| `e2e-service-logs`        | `e2e`              | `backend.log` und `frontend.log`                                                                                                     | 7 Tage    |
| `classroom-smoke-reports` | `classroom-smokes` | JSON je Szenario (`blitzlicht.json`, `qa.json`, `demo-quiz.json`, `ws-vote-progress.json`, `ws-reconnect-wave.json`) + `backend.log` | 7 Tage    |
| `trivy-fs-report`         | `trivy-fs`         | SARIF-Report (`trivy-fs.sarif`)                                                                                                      | 7 Tage    |
| `trivy-image-report`      | `trivy-image`      | SARIF-Report (`trivy-image.sarif`)                                                                                                   | 7 Tage    |

### Produktions-/Deploy-Checks

Für produktionsrelevante Änderungen zusätzlich prüfen:

```bash
npm run build:prod
npm run start:prod
npm run verify:production-serving
docker compose -f docker-compose.prod.yml --env-file .env.production config
```

`npm run verify:production-serving` erwartet einen laufenden Production-Serve und prüft standardmäßig `http://localhost:3000`. Für abweichende Ports oder Domains den Ziel-URL als Argument übergeben, z. B. `npm run verify:production-serving -- http://localhost:3010` oder `npm run verify:production-serving -- https://arsnova.eu`.

Auf dem Server übernimmt `scripts/deploy.sh` die Reihenfolge **Build → Postgres/Redis starten → Prisma migrate deploy → App starten → Healthcheck**. Der Deploy ist erst erfolgreich, wenn der Container healthy ist, `http://127.0.0.1:3000/trpc/health.check` antwortet und die Frontend-Shell unter `/de/` ausgeliefert wird. Der manuelle HTTP-Smoke über `npm run verify:production-serving -- https://<domain>` ergänzt diesen Check aus Nutzerperspektive.

---

## Optionale / manuelle Checks (nicht immer CI)

| Befehl (Frontend-Workspace) | Zweck                               |
| --------------------------- | ----------------------------------- |
| `check:viewport`            | Viewport 320px-Smoke                |
| `smoke:host-present-auth`   | Host/Present-Auth-Smoke             |
| `smoke:host-music`          | Host-Musik-/Sound-Smoke             |
| `smoke:short-text`          | Kurzantwort-Flow-Smoke              |
| `smoke:numeric-estimate`    | Numerische-Schätzfrage-Flow-Smoke   |
| `smoke:quiz-sync`           | Quiz-Sync-Flow-Skript               |
| `smoke:unified-session`     | Unified-Session-Flow-Skript         |
| `lighthouse:a11y`           | Lighthouse A11y (lokal)             |
| `benchmark:word-cloud`      | Wortwolken-Benchmark / Regressionen |

Prisma-Schema lokal: `npx prisma validate` (in CI ohne DB).

### Quiz-Sync-Smoke lokal

Der Quiz-Sync-Smoke-Test ist **kein** reiner `ng serve`-Test. Er erwartet bewusst den
lokalisierten Build mit HTTP-, tRPC-WS- und Yjs-WS-Proxy auf **Port 4200**, weil er gegen
`/{locale}/...` läuft und einen echten Yjs-Relay benötigt.

Vorgehen:

1. `npm run dev -w @arsnova/backend`
2. `npm run build:localize -w @arsnova/frontend`
3. `npm run serve:localize:api -w @arsnova/frontend`
4. `BASE_URL=http://localhost:4200 npm run smoke:quiz-sync -w @arsnova/frontend`

Optional kann die Locale gesetzt werden, Standard ist **`en`**:

```bash
BASE_URL=http://localhost:4200 LOCALE=de npm run smoke:quiz-sync -w @arsnova/frontend
```

Der Smoke-Test nutzt die aktuellen UI-Selektoren für **Quiz anlegen**, **Sync-Link importieren**
und **Quiz speichern**. Wenn er wieder auf Selektoren fällt, ist das zunächst ein Testscript-
Problem und nicht automatisch ein Sync-Defekt.

Wichtig für Wiederholungsläufe: `serve:localize:api` serviert den bereits gebauten Stand aus
`dist/browser`. Nach Frontend- oder Script-Änderungen daher vor dem nächsten Smoke-Test erneut
`npm run build:localize -w @arsnova/frontend` ausführen.

`npm run build:localize -w @arsnova/frontend` ist im Repo kein nackter Angular-Build: Nach `ng build --configuration production --localize` folgen noch Post-Build-Schritte für `noscript`, `sitemap.xml`, `manifest.webmanifest`, MOTD-Assets, die lokalisierten `ngsw.json` und die Root-`index.html`.

### Weitere lokale Flow-Smokes

Diese Skripte erwarten ebenfalls eine laufende lokale App mit Backend und Frontend:

```bash
BASE_URL=http://localhost:4200 npm run smoke:short-text -w @arsnova/frontend
BASE_URL=http://localhost:4200 npm run smoke:numeric-estimate -w @arsnova/frontend
BASE_URL=http://localhost:4200 npm run smoke:host-music -w @arsnova/frontend
BASE_URL=http://localhost:4200 npm run smoke:unified-session -w @arsnova/frontend
```

Für Performance-/Lastarbeit liegen ergänzend Arbeitsbausteine in `scripts/load/` und `docs/implementation/LASTTEST-ARSNOVA-ARCHITEKTUR-ARBEITSAUFTRAG.md`. Die fünf **Classroom-Szenario-Smokes** (`load:smoke:*-classroom-30`, inkl. WebSocket Vote-Progress und Reconnect-Welle) laufen in CI im Job `classroom-smokes`; schwere Last-Smokes (200–600 TN) und k6-Produktion bleiben manuell/Schedule. Praktikums-Einstieg: [`docs/praktikum/HANDOUT-LAST-UND-PERFORMANCE-TESTS.md`](praktikum/HANDOUT-LAST-UND-PERFORMANCE-TESTS.md).

### k6-Lasttests (protokollnah)

Skripte: `scripts/load/k6-trpc-health-50vu.js`, `k6-trpc-session-50vu.js`, `k6-session-hotpaths-500vu.js`. Voraussetzung: laufendes Backend (`npm run dev:backend`).

**Empfohlen:** NPM-Wrapper — nutzt lokales `k6`, sonst automatisch Docker (`grafana/k6`):

```bash
npm run load:k6:health
SESSION_CODE=AB12CD npm run load:k6:session
MODE=join-wave SESSION_CODE=AB12CD VUS=50 npm run load:k6:hotpaths
```

Implementierung: [`scripts/load/run-k6.mjs`](../scripts/load/run-k6.mjs). k6 ist **kein** npm-Paket; native Installation optional (`brew install k6` auf macOS).

| Plattform                | Verhalten des Wrappers                             |
| ------------------------ | -------------------------------------------------- |
| mit lokalem `k6`         | `BASE_URL=http://127.0.0.1:3000`                   |
| Docker auf macOS/Windows | `BASE_URL=http://host.docker.internal:3000`        |
| Docker auf Linux/WSL     | `--network host`, `BASE_URL=http://127.0.0.1:3000` |

Manuell per Docker (macOS):

```bash
docker run --rm -i \
  -e BASE_URL=http://host.docker.internal:3000 \
  grafana/k6 run - < scripts/load/k6-trpc-health-50vu.js
```

### Artillery-Lasttest (Realtime, bis 500 TN)

Unified Live-Session: Join-Welle, Quiz-Vote, Q&A (20 %), Blitzlicht, WebSocket-Status/Host-Progress, Ergebnis-Fan-out.

```bash
npm run dev:backend
PARTICIPANTS=500 npm run load:artillery:500
```

Skripte: [`scripts/load/run-artillery-500.mjs`](../scripts/load/run-artillery-500.mjs), [`scripts/load/artillery/500-live-session.yml`](../scripts/load/artillery/500-live-session.yml). CI-Job `artillery-500` (Schedule/Manuell, Standard 100 TN auf Runner).

### Artillery-Reconnect-Welle (bis 500 TN)

Quiz-only: Join → WS-Status subscribe → Disconnect-Welle → Reconnect-Welle → Host `revealResults` → Assert `RESULTS` bei allen TN.

```bash
npm run dev:backend
PARTICIPANTS=500 npm run load:artillery:reconnect:500
```

Skripte: [`scripts/load/run-artillery-reconnect-500.mjs`](../scripts/load/run-artillery-reconnect-500.mjs), [`scripts/load/artillery/500-reconnect-wave.yml`](../scripts/load/artillery/500-reconnect-wave.yml). CI-Job `artillery-reconnect-500` (Schedule/Manuell, Standard 100 TN auf Runner). Classroom-Smoke (30 TN): `npm run load:smoke:ws-reconnect-wave-classroom-30`.

Session- und Hotpath-Skripte benötigen `SESSION_CODE` (6 Zeichen) bzw. bei Hotpath-Modi `PARTICIPANT_IDS`, `QUESTION_ID` usw. — siehe Kommentarkopf in den Skripten.

Weitere Node-Last-Smokes (ohne k6): `npm run load:simulate:50`, `npm run load:simulate:session:50` (erfordert `SESSION_CODE`).

### Host-Vote-Progress-Last-Smoke

Nach Änderungen am Host-Realtime- oder Vote-Eventpfad sollte zusätzlich der gezielte Host-Progress-Smoke laufen:

```bash
npm run dev:backend
npm run load:smoke:host-vote-progress
```

Der Smoke erstellt eine numerische Schätzfrage, subscribed auf `onCurrentQuestionForHostChanged` und `onHostVoteProgressChanged`, lässt standardmäßig `200` Teilnehmende parallel abstimmen und prüft:

- `vote.submit` aktualisiert den Host-Fortschritt vollständig.
- `onCurrentQuestionForHostChanged` wird durch Votes nicht geflutet.
- `onHostVoteProgressChanged` bleibt durch serverseitige Bündelung klein.
- Der finale `totalVotes`-Snapshot stimmt mit der Zahl der Votes überein.

Für den erweiterten lokalen 600er-Check:

```bash
PARTICIPANTS=600 npm run load:smoke:host-vote-progress
```

### Vote-Timer-Fairness-Last-Smoke

Nach Änderungen an `vote.submit`, Timer-Scoring, Deadline-Prüfung, Karenzlogik oder
`Session.activeQuestionStartedAt` sollte zusätzlich der Timer-Fairness-Smoke laufen:

```bash
npm run dev:backend
npm run load:smoke:vote-timer-fairness
```

Der Smoke erstellt eine Session mit drei `NUMERIC_ESTIMATE`-Fragen und standardmäßig `600`
Teilnehmenden. Er prüft drei Lastfälle:

- `ACTIVE`: 600 parallele Votes vor Timerende werden akzeptiert.
- `RESULTS` innerhalb der 2s-Backend-Karenz: 600 parallele Votes werden noch akzeptiert,
  sofern die Ergebnisfreigabe erst nach der serverseitigen Deadline erfolgte.
- `RESULTS` außerhalb der Karenz: 600 parallele Votes werden abgewiesen.

Wichtige Parameter:

```bash
PARTICIPANTS=600 TIMER_SECONDS=8 TRPC_URL=http://127.0.0.1:3000/trpc npm run load:smoke:vote-timer-fairness
```

Der Smoke ergänzt den Host-Progress-Smoke: Er misst nicht den WebSocket-Fan-out, sondern den
serverseitigen Vote-Hotpath rund um Timerende, Karenz und Ergebnisfreigabe.

---

## Wo Tests liegen

- **Backend:** `apps/backend/src/__tests__/*.test.ts`, Vitest (u. a. Session, Vote, Rate-Limit, **MOTD/Admin-MOTD** — Epic 10).
- **Frontend:** `*.spec.ts` neben Komponenten/Services (Angular/Vitest), siehe [AGENT.md](../AGENT.md).

Gezielte Regressionen für die aktuelle Host-Härtung:

- **Q&A / moderatorView:** `npm run test -w @arsnova/backend -- src/__tests__/qa.test.ts`
- Die Datei deckt explizit ab, dass `qa.list` und `qa.onQuestionsUpdated` mit `moderatorView: true` ohne Host-Token serverseitig abgelehnt und mit gültigem Host-Token zugelassen werden.

Weitere aktuell relevante Regressionen:

- **NUMERIC_ESTIMATE / Zwei-Runden-Flow:** `npm run load:smoke:vote-timer-fairness` und die zugehörigen Backend-/Frontend-Tests für Toleranzband, Karenz und Ergebnisfreigabe.
- **Host-Progress:** `npm run load:smoke:host-vote-progress` nach Änderungen am Vote- oder Realtime-Pfad.
- **Session-Bewertung / MOTD:** die vorhandenen `SessionFeedback`-, `motd*.test.ts`- und Admin-Tests, wenn Auswertung, Header oder Audit-Log angepasst werden.

---

## Verwandte Dokumente

- [CONTRIBUTING.md](../CONTRIBUTING.md) — PR-Checkliste
- [ENVIRONMENT.md](ENVIRONMENT.md) — lokale Ausführung
- [deployment-debian-root-server.md](deployment-debian-root-server.md) — Produktions-Deployment und Go-Live-Checks
- [README.md](../README.md) — `npm run dev`, Setup
