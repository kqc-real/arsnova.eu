<!-- markdownlint-disable MD013 MD060 -->

# Tests & CI — Referenz

**Lokal** vor PR: mindestens `npm run build`, `npm run lint`, `npm test` (entspricht den wesentlichen CI-Gates). Vollständige DoD: [Backlog.md](../Backlog.md) „Definition of Done“. Nach größeren Änderungen an **`@arsnova/shared-types`**: wie in Root-[README](../README.md) zuerst `npm run build -w @arsnova/shared-types` bzw. Root-`npm run build` nutzen.

**Stand:** 2026-08-16 · Workflow: [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) (Node **22** und **24**; inkl. `dependency-review`, `actionlint`, Format-, i18n-, Template-A11y-, axe-, Lighthouse-, Reflow-, PDF/UA-, Trivy- und Migrations-Gates) · SAST: [`.github/workflows/codeql.yml`](../.github/workflows/codeql.yml) · Deploy-Skript: [`scripts/deploy.sh`](../scripts/deploy.sh)

---

## NPM-Skripte (Root)

| Befehl                                        | Bedeutung                                                                                                                                                                      |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run build`                               | `shared-types` → Backend `tsc` → Frontend `ng build`                                                                                                                           |
| `npm run typecheck`                           | `shared-types` bauen (`dist`), dann Backend + Frontend `tsc --noEmit`                                                                                                          |
| `npm run lint`                                | Blockierendes ESLint-Gate über `libs/`, `apps/` und alle inventarisierten operativen JS-/TS-Skripte                                                                            |
| `npm run lint:scripts`                        | Blockierendes Voll-Gate: jede inventarisierte Skriptdatei muss ohne ESLint-Fehler und ohne Warnungen bestehen                                                                  |
| `npm run lint:scripts:changed`                | Deterministisches Zusatz-Gate für neue/geänderte Skripte im angegebenen Git-SHA-Bereich; behandelt Löschungen und Renames                                                      |
| `npm run lint:scripts:test`                   | Negativ-, Profil- und Mutationstests für Inventur, Changed-Script- und Voll-Gate                                                                                               |
| `npm test`                                    | **Shared Contracts**, **Session-Export-Report**, **Backend** und **Frontend** mit Vitest (sequentiell)                                                                         |
| `npm run test:spacy-sidecar`                  | Unix-Socket-Unittests des optionalen spaCy-Sidecars ohne Modell-Download (`docker/spacy/tests`)                                                                                |
| `npm run test:spacy-compose`                  | Compose-Smoke: Sidecar nur über Profil `nlp`, kein TCP-Port, `SPACY_IMAGE` getrennt von `ARSNOVA_IMAGE`                                                                        |
| `npm run docker:up:nlp`                       | Optionalen spaCy-Sidecar lokal bauen und starten (`docker compose --profile nlp`)                                                                                              |
| `npm run spacy:macos-dev`                     | macOS: Clean, `build:prod` aller Locales, Host-Sidecar, `start:prod`, `serve:localize:api` auf 4200, Freitext-, Q&A- und Moderationskompass-Seed (Demo-Quiz mit Freitextfrage) |
| `npm run spacy:macos-dev:test`                | Hilfe-/Syntax-Tests für `scripts/macos-spacy-wordcloud-dev.sh`                                                                                                                 |
| `npm run format:check`                        | Prettier (ohne Schreiben)                                                                                                                                                      |
| `npm run validate:pdfua`                      | Fünf PDF/UA-1-Locale-Demos mit veraPDF validieren                                                                                                                              |
| `npm run verify:production-serving`           | HTTP-Smoke gegen einen laufenden Production-Serve (`/`, `/de/`, Compression, `health.stats`)                                                                                   |
| `npm run audit:trpc-dod`                      | Blockierendes Non-Regression-Gate für AppRouter und alle Backend-`src/**/*.test.ts`; `scripts/**/*.test.ts` ist kein Evidenzpfad; Legacy bleibt zulässig                       |
| `npm run audit:trpc-dod -- --update-baseline` | Vollständigen/verbesserten Zustand atomar und monoton in die Git-verankerte Baseline übernehmen                                                                                |
| `npm run audit:trpc-dod:poc`                  | Isolierter Fixture-Audit der in Slice 2A eingeführten Evidenzkonvention                                                                                                        |
| `npm run audit:trpc-dod:test`                 | Negativ- und Determinismus-Tests für `scripts/audit-trpc-dod.mjs` (nach `npm ci`, nicht im Workflow-Lint)                                                                      |

Workspace-spezifisch:

| Workspace                        | Tests                                                           | Typcheck                                              |
| -------------------------------- | --------------------------------------------------------------- | ----------------------------------------------------- |
| `@arsnova/shared-types`          | `npm run test -w @arsnova/shared-types` (`vitest run`)          | `npm run typecheck -w @arsnova/shared-types`          |
| `@arsnova/session-export-report` | `npm run test -w @arsnova/session-export-report` (`vitest run`) | `npm run typecheck -w @arsnova/session-export-report` |
| `@arsnova/backend`               | `npm run test -w @arsnova/backend` (`vitest run`)               | `npm run typecheck -w @arsnova/backend`               |
| `@arsnova/frontend`              | `npm run test -w @arsnova/frontend` (`vitest run`)              | `npm run typecheck -w @arsnova/frontend`              |

`npm run typecheck -w @arsnova/backend` setzt ein gebautes `@arsnova/shared-types` (`libs/shared-types/dist`) voraus; das Root-Skript `npm run typecheck` baut die Library zuerst.

### tRPC-DoD-Non-Regression-Gate

Für jede neue Query/Mutation und jede Query/Mutation mit geändertem
Source-Fingerprint müssen Tests über den kanonischen `trpcDodIt`-Helper sowohl
`case: 'happy'` als auch `case: 'error'` registrieren. Der Error-Fall benötigt einen
bekannten tRPC-Vertrag oder einen konkret benannten `DOMAIN:*`-Vertrag. Rename wird
als Löschung plus neue Prozedur behandelt. Subscriptions erscheinen im Bericht und
in der Baseline, ihre Evidenz ist jedoch report-only.

Der normale Audit blockiert:

- neue/geänderte Queries oder Mutations mit fehlender Happy-/Error-Evidenz;
- den Verlust einer zuvor abgedeckten Dimension;
- eine nicht zur aktuellen Inventur synchronisierte Baseline;
- strukturell ungültige Evidenz, Inventur oder Baseline-Historie.

Unveränderte Legacy-Schuld blockiert nicht. Nach einer vollständigen neuen oder
geänderten Prozedur, einer behobenen Legacy-Lücke, einem Rename oder einer Löschung
ist `npm run audit:trpc-dod -- --update-baseline` auszuführen und die geänderte
`.github/trpc-dod-baseline.json` mit zu committen. Der Updater verweigert neue oder
erhöhte Schuld sowie konkurrierende Schreibzugriffe. Exit 1 bedeutet Gate-Verstoß
oder erforderliche Baseline-Fortschreibung; Exit 2 bedeutet einen Struktur- oder
Historienfehler. Details stehen in
[ADR-0034](architecture/decisions/0034-trpc-dod-evidence-helper-and-fingerprint.md).

Eine gelöschte ID verliert ihren Legacy-Bestandsschutz. Wird dieselbe ID später mit
demselben Fingerprint wieder eingeführt, gilt sie wegen ihrer Abwesenheit in der
unmittelbar vorherigen Baseline trotzdem als neu und benötigt vollständige
Happy-/Error-Evidenz. Das Audit prüft diese Anwesenheitsübergänge auch rückwirkend
über alle committeten Baseline-Versionen.

### Parallele Unit-Testläufe vermeiden

`npm test` startet **sequentiell** Shared Types, Backend und Frontend — aber **nur ein Lauf zur Zeit**.
Mehrere gleichzeitige `npm test`- oder `vitest run`-Prozesse (z. B. aus IDE, Agent oder Terminal
parallel) führen zu **Timeout-Flakiness** in schweren Frontend-Specs, ohne dass der Code fehlerhaft
ist.

**Typische Symptome:**

- Vitest-`setup` dauert Minuten statt Sekunden (z. B. > 1.000 s statt ~20 s).
- Schwankende Fehlerzahl (2–9 Tests) in `session-vote`, `session-host` oder `quiz-edit`.
- CI bleibt grün, lokaler Gesamtlauf scheitert sporadisch.

**Empfehlung:**

```bash
# Nur Frontend (~20 s), wenn Backend bereits grün ist:
npm run test -w @arsnova/frontend

# Prüfen, ob noch Vitest läuft (macOS/Linux):
pgrep -fl "vitest run"

# Einzelnen Test wiederholen:
npx vitest run src/app/features/session/session-vote/session-vote.component.spec.ts \
  -t "Abstimmen-Button"
```

Schwere Session-/Quiz-Specs nutzen `flushComponentAfterStable` aus
`apps/frontend/src/testing/component-test-utils.ts` und ein erhöhtes Datei-Timeout (30 s), damit sie
unter moderater Last stabiler bleiben. Das ersetzt nicht den Wegfall paralleler Root-`npm test`-Läufe.

## Verifizierter lokaler Lauf vom 2026-07-10

Der Gesamt-Testlauf gegen eine separate lokale PostgreSQL-Testdatenbank, Redis,
Backend, tRPC-/Yjs-WebSockets und den lokalisierten Frontend-Produktionsbuild ist
in
[implementation/LOCAL-TESTRUN-2026-07-10.md](implementation/LOCAL-TESTRUN-2026-07-10.md)
dokumentiert.

- `npm test`: **1.310/1.310 Tests bestanden**
- `build:localize`: **bestanden**
- Last-/Performance-Szenarien: **19/21 bestanden**
- Browser-Flow-Smokes: **3/6 bestanden**
- Lighthouse: **fehlgeschlagen** (Performance 0,55; LCP rund 11,1 s)

Im Lauf vom 2026-07-10 reproduzierbar offen waren die Yjs-Konvergenz nach Offline-Reconnect, das
1.000-ms-p95-Gate beim 600er Timer-Fairness-Lauf sowie die Browser-Flows
Host-Join-Liveanzeige, `SHORT_TEXT`-Fragenübertragung und
Numeric-Estimate-Ergebnisdarstellung. Ein grüner Unit-Testlauf ersetzt diese
Laufzeit-Gates nicht.

Der [gezielte QA-Nachlauf vom 2026-07-11](implementation/LOCAL-QA-RECHECK-2026-07-11.md)
belegt die Korrekturen: Yjs-Reconnect, beide 600er Vote-p95-Pfade, alle sechs
Browser-Flows und alle sechs Lighthouse-Läufe sind grün. Der anschließende
[30-Minuten-Langlauf mit Baseline-Freigabe vom 2026-07-12](implementation/LOCAL-BASELINE-FREIGABE-2026-07-12.md)
ist ebenfalls abgeschlossen.

---

## CI-Pipeline (GitHub Actions, `main`)

Auslöser: **Push** und **Pull Request** auf `main`.

| Job / Phase                            | Inhalt                                                                                                                                                                                                                           |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **dependency-review**                  | PR-abhängiger Dependency-Risiko-Check (`fail-on-severity: high`)                                                                                                                                                                 |
| **actionlint**                         | Linting/Validierung der GitHub-Workflow-Dateien; zusätzlich operative Python-/Shell-Checks inkl. spaCy-Sidecar-Unittests ohne Modell-Download                                                                                    |
| **format**                             | Prettier-Gate für im PR/Push geänderte unterstützte Dateien                                                                                                                                                                      |
| **landing-build**                      | Produktionsbuild der Astro-Landingpage plus axe-Gate für Start, Impressum und Datenschutz                                                                                                                                        |
| **build** (Node 22 & 24)               | `npm ci` → `prisma validate` → `prisma generate` → `tsc -b apps/backend` → Frontend `tsc --noEmit` → `build:localize` (Frontend, **alle** konfigurierten Locales `de/en/fr/it/es`)                                               |
| **typecheck** (Node 22 & 24, parallel) | `npm ci` → `prisma validate` → `prisma generate` → `npm run typecheck` (inkl. `build` für `shared-types`, dann `--noEmit`)                                                                                                       |
| **lint**                               | `npm run lint` (nach build), einschließlich Angular-Template-A11y-Regeln und blockierendem Voll-Gate für alle inventarisierten Skripte; zusätzlich Negativ-/Mutationstests und deterministisches Changed-Script-Gate             |
| **audit**                              | `npm audit --audit-level=high --omit=dev`, CycloneDX-SBOM als Artefakt (**blockierend ab High für Produktionsabhängigkeiten**)                                                                                                   |
| **test**                               | `npm run test:coverage` (nach build, inkl. Coverage-Thresholds)                                                                                                                                                                  |
| **pdfua**                              | veraPDF-1.30.2-Gate für die PDF/UA-1-Demoexporte aller fünf Locales                                                                                                                                                              |
| **trivy-fs**                           | Trivy-Scan des Repository-Dateisystems (HIGH/CRITICAL, blockierend)                                                                                                                                                              |
| **trivy-image**                        | Docker-Image-Build für Scan + Trivy-Image-Scan (HIGH/CRITICAL, blockierend)                                                                                                                                                      |
| **lighthouse**                         | Lighthouse Performance gegen Home DE/EN; separater A11y-Lauf gegen Home DE/EN, Quiz-Liste, Hilfe und Datenschutz, inklusive blockierender Einzelaudits                                                                           |
| **e2e-chromium**                       | Chromium Smoke E2E mit Postgres/Redis, statischen und dynamischen axe-Scans sowie Reflow-/Fokus-/Zielgrößen-Gate                                                                                                                 |
| **webkit-e2e**                         | Expliziter WebKit-Lauf Safari-naher MOTD-Pointer-, Fokus- und Tab-Regressionen                                                                                                                                                   |
| **e2e**                                | Stabiler Required-Check, der die erfolgreichen Chromium- und WebKit-Jobs aggregiert; bei Workflow-Abbruch nicht nachträglich rot, bei Job-Timeout eines Browsers weiterhin rot                                                   |
| **classroom-smokes**                   | Sechs Unterrichts-Szenario-Smokes (inkl. WS Vote-Progress, Reconnect und Q&A-/Blitzlicht-Fan-out, je 30 TN) gegen lokales Backend; JSON-/JUnit-Reports als Artifact                                                              |
| **docker**                             | Docker-Image-Build (ohne Push), vollständiger Production-Compose-Start mit Migration/Healthcheck sowie Runtime-Smokes für Container-Härtung/Chromium-Maximalbericht und Yjs-Konvergenz inkl. Offline-Reconnect gegen Port 3002   |
| **deploy**                             | Nur bei Push auf `main` und `DEPLOY_ENABLED=true`; nach Quality-Gates inkl. `publish-image`; übergibt `DEPLOY_IMAGE`/`DEPLOY_SHA`, checkt `DEPLOY_SHA` per SSH vor `scripts/deploy.sh` aus, dann Digest-Pull (kein Server-Build) |
| **post-deploy-smoke**                  | Prüft nach erfolgreichem Deploy die Produktionsauslieferung via `scripts/verify-production-serving.mjs`                                                                                                                          |

Matrix: **zwei** unterstützte Versionen (**22** und **24**), `fail-fast: false`.

Für die ausführliche, schrittweise Erklärung (inkl. Ablaufdiagramm) siehe [CI-WORKFLOW.md](CI-WORKFLOW.md).

### Reports & Artefakte in GitHub Actions

Artifacts findest du in einem Run unter: **Actions → CI-Run öffnen → Artifacts**.

| Artefaktname              | Erzeugender Job    | Inhalt                                                                                                | Retention |
| ------------------------- | ------------------ | ----------------------------------------------------------------------------------------------------- | --------- |
| `frontend-dist-browser`   | `build`            | Frontend-Produktionsbuild (`apps/frontend/dist/browser`)                                              | 1 Tag     |
| `coverage-reports`        | `test`             | Coverage-Reports aus `apps/backend/coverage` und `apps/frontend/coverage`                             | 7 Tage    |
| `verapdf-ua1-report`      | `pdfua`            | veraPDF-Textbericht für die PDF/UA-1-Demos aller fünf Locales                                         | 30 Tage   |
| `lighthouse-reports`      | `lighthouse`       | Performance- und A11y-Ausgabe aus `.lighthouseci` und `.lighthouseci-a11y`                            | 7 Tage    |
| `e2e-service-logs`        | `e2e-chromium`     | `backend.log` und `frontend.log`                                                                      | 7 Tage    |
| `webkit-e2e-service-logs` | `webkit-e2e`       | Backend-/Frontend-Logs und WebKit-Screenshots bei Browserfehlern                                      | 7 Tage    |
| `classroom-smoke-reports` | `classroom-smokes` | Standardisiertes JSON + JUnit XML für sechs Szenarien (inkl. `channel-ws-fanout`) sowie `backend.log` | 7 Tage    |
| `artillery-500-reports`   | `artillery-500`    | Artillery-Rohreport, JSON/JUnit für Unified, Vote, Yjs, Freitext und Soak sowie `backend.log`         | 30 Tage   |
| `trivy-fs-report`         | `trivy-fs`         | SARIF-Report (`trivy-fs.sarif`)                                                                       | 7 Tage    |
| `trivy-image-report`      | `trivy-image`      | SARIF-Report (`trivy-image.sarif`)                                                                    | 7 Tage    |

### Produktions-/Deploy-Checks

Für produktionsrelevante Änderungen zusätzlich prüfen:

```bash
npm run build:prod
npm run start:prod
npm run verify:production-serving
# Produktion: Image-Env über Wrapper (nach Digest-Deploy: .env.arsnova-image)
./scripts/prod-compose.sh config
```

Für W2.1b zusätzlich (Compose-Smokes brauchen ein **bereits gebautes** Image —
kein `compose build` auf dem Produktionsserver; lokal/CI z. B. wie der Docker-Build-Job):

```bash
npm test -w @arsnova/backend -- --run \
  src/lib/pdfWorkerTransport.test.ts \
  src/lib/safeExternalImageFetch.test.ts \
  src/lib/pdfImageNormalizer.test.ts \
  src/__tests__/session-results-report-pdf.test.ts \
  src/__tests__/session-results-report-pdf.ssrf.test.ts
npm run typecheck -w @arsnova/backend
# Image einmal bauen/taggen (CI), dann Compose nur pullen/starten:
export ARSNOVA_IMAGE=arsnova-eu:production
./scripts/prod-compose.sh up -d app
./scripts/prod-compose.sh exec -T pdf-worker node /app/scripts/pdf-worker-runtime-smoke.mjs
./scripts/prod-compose.sh exec -T app node /app/scripts/container-runtime-smoke.mjs
npm run validate:pdfua
```

Der Worker-Smoke prüft im echten Compose-Service Netzwerk-/Secret-Abwesenheit,
UID, Capabilities, `NoNewPrivs`, read-only Rootfs, Socketmodus und die
PID-/RAM-/CPU-/`tmpfs`-Grenzen. Der App-Smoke prüft den read-only Socket-Mount
und rendert einen 200-Fragen-/500-Teilnehmenden-Bericht im `pdfUa`-Profil über
den Unix-Socket. CI beendet den Worker dazwischen einmal hart und erwartet einen
healthy `restart: always`, bevor der PDF-Smoke Socket-Cleanup und
Wiederanbindung bestätigt; die exakte Policy wird am laufenden Container
assertiert und deckt auch Host-/Daemon-Neustarts ab. Der Unit-Test mit einem nie
auflösenden Renderer prüft zusätzlich worker-interne Deadline, 504, fatalen
Healthstatus und Exit-Callback. Produktion darf nicht auf lokales Chromium
zurückfallen.

### Optionaler spaCy-Sidecar (Story 1.14b)

Story 1.14b ist umgesetzt; der Sidecar bleibt Default aus. Produktdoku: [word-cloud-spacy.md](features/word-cloud-spacy.md).

```bash
npm run test -w @arsnova/shared-types -- src/word-cloud-normalization.test.ts
npm test -w @arsnova/backend -- --run src/__tests__/wordCloud.analyze.test.ts src/lib/wordCloudNormalizer.test.ts src/lib/spacyClient.test.ts src/lib/wordCloudAnalysisCache.test.ts src/lib/wordCloudLemmaFixtures.test.ts
npm run test -w @arsnova/frontend -- src/app/features/session/session-host/session-host.component.spec.ts
npm run test:spacy-sidecar
npm run test:spacy-compose
```

Lokal den Sidecar nur bewusst starten. Auf **macOS** nicht `npm run docker:up:nlp` für Host-Node erwarten — der Socket im Volume ist unsichtbar. Stattdessen:

```bash
npm run spacy:macos-dev
```

Ablauf, Locale-URLs (`http://localhost:4200/de/` … `/it/`, **kein** `ng serve`) und Flags: [word-cloud-spacy.md](features/word-cloud-spacy.md#lokale-prüfung-auf-macos-host-npm). Unter Linux im App-Container: `npm run docker:up:nlp`. Produktion: Image selbst bauen, Compose-Profil `nlp`, `NLP_ENABLED=true`; Rollback `NLP_ENABLED=false` und `stop spacy`. `deploy.sh` startet den Sidecar nicht.

### Optionale Q&A-NLP-Kaskade (Story 8.9b)

```bash
npm test -w @arsnova/shared-types -- src/qa-nlp.test.ts
npm test -w @arsnova/backend -- --run \
  src/lib/qaNlpConfig.test.ts \
  src/lib/qaNlpSnapshot.test.ts \
  src/lib/qaNlpResult.test.ts \
  src/lib/qaNlpQueue.test.ts \
  src/lib/qaNlpGatekeeper.test.ts \
  src/lib/qaNlpFallback.test.ts \
  src/lib/qaNlpCascade.test.ts \
  src/lib/qaNlpEvaluate.test.ts \
  src/lib/qaNlpCalibrate.test.ts \
  src/__tests__/qa.nlp.test.ts \
  src/__tests__/dto-security.test.ts \
  src/__tests__/wordCloud.hotpath-isolation.test.ts
npm run eval:qa-nlp -w @arsnova/backend
# bestehende Session nachklassifizieren (Kill-Switch am start:prod-Prozess muss true sein, damit die Host-UI „KI an“ zeigt):
# npm run apply:qa-nlp -w @arsnova/backend -- --code ABC123
npm run test -w @arsnova/frontend -- \
  src/app/features/session/session-host/moderation-compass.spec.ts \
  src/app/features/session/session-host/moderation-compass-dialog.component.spec.ts \
  src/app/features/session/session-host/session-host.component.spec.ts
```

Kill-Switch default aus (`QA_NLP_ENABLED=false`). Timeout, Queue-Limit, Konfidenzschwelle, Kalibrierkurve, k-NN-Fallback und Skip-Strategie: [qa-nlp-moderation.md](features/qa-nlp-moderation.md). Queue-Tests decken langsamen Worker, Timeout und Telemetrie (Early-Exit/Fallback/Unclassified) ab. Lokaler k6/Artillery-Hörsaallast 2026-08-19: 500 Joins/WS und 100 Q&A-Submits ohne Queue-Skip; Produktiv-Default bleibt aus.

Für W2.4a zusätzlich:

```bash
npm test -w @arsnova/backend -- --run \
  src/lib/cspReportIngest.test.ts \
  src/__tests__/health.test.ts
npm test -w @arsnova/shared-types -- --run \
  src/health-security-stats.test.ts
RUN_REDIS_CSP_REPORT_TESTS=1 npm test -w @arsnova/backend -- --run \
  src/lib/cspReportIngest.redis.test.ts
curl -i -X POST http://127.0.0.1:3000/csp-report \
  -H 'Content-Type: application/csp-report' \
  --data '{"csp-report":{"effective-directive":"script-src","blocked-uri":"eval"}}'
```

Der Redis-Test prüft konkurrierendes global-first Rate-Limiting, dass nach
vollem Globalbudget keine neuen IP-Keys entstehen, sowie das atomare
256-Dimensionscap über die gesamte Retentionsgeneration, konstant zwei
Aggregationskeys über viele Zeit-Buckets und eine nicht durch Requests
verlängerte TTL. Der HTTP-Smoke muss `204` ohne Body und ohne
CSP-/Report-Only-Header liefern.

Für W2.4b zusätzlich:

```bash
npm test -w @arsnova/backend -- --run src/lib/cspReportOnly.test.ts
npm test -w @arsnova/frontend -- --run src/app/core/csp-service-worker-config.spec.ts
npm run typecheck -w @arsnova/backend
npm run build:localize -w @arsnova/frontend
CSP_REPORT_ONLY_ENABLED=true npm run start:prod
npm run verify:csp-report-only
npm run verify:csp-browser
```

Der Unit-/HTTP-Test prüft den statischen Policy-String, exakte Flag-Semantik,
lokalisierte SPA-HTML-Routen, genau einen Report-Only-Header und das Fehlen
beider CSP-Header auf tRPC, `/csp-report`, JS, CSS, JSON und 204. Der
Production-Smoke prüft den echten lokalisierten Build einschließlich
Service-Worker-/Manifest-Assets. Der Playwright-Smoke lädt deutsche und
englische Routen, wartet auf den aktiven Service Worker und schlägt bei
Browserfehlern oder aktuellen Policy-Violations fehl. Zusätzlich die
Service-Worker-Spec stellt `navigationRequestStrategy: freshness` sicher, damit
Online-Navigationen Runtime-Header nicht aus einem alten App-Shell-Cache
übernehmen. Die vorhandenen A11y-Gates gegen diesen Build ausführen. Ein legitimer Report ist
Beobachtungsevidenz und darf nicht allein zum Aufweiten von `script-src` führen.

Für W2.5 zusätzlich:

```bash
npm test -w @arsnova/backend -- --run \
  src/lib/httpCors.test.ts \
  src/lib/cspReportIngest.test.ts \
  src/lib/trpcWebSocketServer.test.ts \
  src/lib/yjsRelay.test.ts
npm run typecheck -w @arsnova/backend
NODE_ENV=production curl -si \
  -H 'Origin: https://evil.example' \
  http://127.0.0.1:3000/trpc/health.check
```

Der CORS-Test prüft Same-Origin-/No-Origin-Verkehr, fremde und gespoofte
Origins, `null`, exakte Localhost-Dev-Origins, den benötigten Tokenheader-
Preflight, `Vary: Origin`, das Fehlen von Wildcard/Credentials sowie
`/csp-report` ohne CORS-Freigabe. Beim manuellen Produktions-Smoke muss die
fachliche Antwort unverändert eintreffen, aber jeder
`Access-Control-Allow-*`-Header fehlen. Die WebSocket-Tests sind der
Regression-Smoke dafür, dass HTTP-CORS die separaten tRPC-/Yjs-Server nicht
verändert.

`npm run verify:production-serving` erwartet einen laufenden Production-Serve und prüft standardmäßig `http://localhost:3000`. Für abweichende Ports oder Domains den Ziel-URL als Argument übergeben, z. B. `npm run verify:production-serving -- http://localhost:3010` oder `npm run verify:production-serving -- https://arsnova.eu`.

Auf dem Server übernimmt `scripts/deploy.sh` die Reihenfolge **Digest-Image pullen → Architektur-Preflight (Host und Image müssen `arm64` sein) → Postgres/Redis starten und auf Health warten → Prisma migrate deploy (`compose run --no-deps`) → App/PDF-Worker starten → Healthcheck → Digest-Nachweis → Deploy-State schreiben**. Aktuelle Produktions-Zielplattform ist **linux/arm64**; ein amd64-only GHCR-Image wird vor Migration/Container-Änderung abgebrochen ([#229](https://github.com/kqc-real/arsnova.eu/issues/229)). `DEPLOY_IMAGE` muss die kanonische Form `ghcr.io/kqc-real/arsnova.eu@sha256:<64-hex>` haben; `ARSNOVA_IMAGE` steuert Compose für `app` und `pdf-worker` und wird in `.env.arsnova-image` persistiert (`./scripts/prod-compose.sh`). Der Deploy ist erst erfolgreich, wenn der Container healthy ist, `http://127.0.0.1:3000/trpc/health.check` antwortet, die Frontend-Shell unter `/de/` ausgeliefert wird und Registry-Digest, lokale Image-ID sowie laufende Container-Image-IDs übereinstimmen. **Image-Rollback** (`./scripts/deploy.sh --rollback`) stellt `previous.state` wieder her; **Recover** (`--recover`) stellt bei unvollständigem Deploy `current.state` wieder her. Beides setzt **keine** Datenbankmigrationen zurück. Der manuelle HTTP-Smoke über `npm run verify:production-serving -- https://<domain>` ergänzt diesen Check aus Nutzerperspektive.

---

## Browser- und A11y-Checks

| Befehl (Frontend-Workspace)       | Zweck                                                                   |
| --------------------------------- | ----------------------------------------------------------------------- |
| `a11y:axe:static`                 | axe für statische Kernrouten/-zustände                                  |
| `a11y:layout`                     | Reflow, Fokus, 24px-Ziele, Skip-Link, Join-Fokus und mobiles Disclosure |
| `check:viewport`                  | Alias/älterer 320px-Reflow-Smoke                                        |
| `smoke:host-present-auth`         | Host/Present-Auth-Smoke                                                 |
| `smoke:host-music`                | Host-Musik-/Sound-Smoke                                                 |
| `smoke:short-text`                | Kurzantwort-Flow inklusive axe                                          |
| `smoke:numeric-estimate`          | Numerische-Schätzfrage-Flow-Smoke                                       |
| `smoke:session-question-progress` | Zwei-Client-Smoke für späteren Start, Vote, Skip und Nachbesprechung    |
| `e2e:confidence-summary-demo`     | Demo-Quiz: 30 TN + Confidence-Abschluss                                 |
| `e2e:motd-focus`                  | Desktop-MOTD: Tastatur-/Pointer-Rücksprung und fortgesetzte Tab-Reihe   |
| `smoke:quiz-sync`                 | Quiz-Sync-Flow-Skript                                                   |
| `smoke:unified-session`           | Unified-Session-Flow inklusive axe                                      |
| `lighthouse:a11y`                 | Score und A11y-Einzelaudits (lokal)                                     |
| `benchmark:word-cloud`            | Wortwolken-Benchmark / Regressionen                                     |

Das PDF/UA-Gate liegt im Root-Workspace:

```bash
npm run validate:pdfua
```

Es benötigt Docker und validiert die committed PDF/UA-Demos mit veraPDF 1.30.2
gegen das Profil `ua1`. Das manuelle Prüfprotokoll steht unter
[`praktikum/ACCESSIBILITY-PDFUA-PRUEFPROTOKOLL.md`](praktikum/ACCESSIBILITY-PDFUA-PRUEFPROTOKOLL.md).

`a11y:axe:static`, `a11y:layout`, `smoke:short-text`,
`smoke:session-question-progress` und `smoke:unified-session` sind Bestandteile
des Chromium-Jobs `e2e-chromium`. Der Job `webkit-e2e` startet dieselben echten
Backend-/Frontend-Services, wählt WebKit explizit und führt `e2e:motd-focus`
aus. Der Required-Check `e2e` wird nur grün, wenn beide
Browser-Jobs erfolgreich sind; ein abgebrochener Workflow färbt ihn nicht
nachträglich rot. Playwright-Browser installiert
[`scripts/ci/playwright-install.sh`](../scripts/ci/playwright-install.sh) mit
Zeitlimit und Wiederholung. `smoke:short-text` und `smoke:unified-session` schreiben bei
gesetztem `SMOKE_ARTIFACT_DIR` zusätzlich axe-JSON-Berichte; der
Session-Verlaufs-Smoke schreibt einen Abschluss- oder Fehler-Screenshot. Mit
`A11Y_SCAN=0` lassen sich nur die axe-Schritte lokal deaktivieren; CI setzt diese
Ausnahme nicht.

Lokal lassen sich dieselben browserabhängigen Prüfungen gezielt ausführen:

```bash
BASE_URL=http://localhost:4200 PLAYWRIGHT_BROWSER=chromium npm run a11y:layout -w @arsnova/frontend
BASE_URL=http://localhost:4200 PLAYWRIGHT_BROWSER=webkit npm run e2e:motd-focus -w @arsnova/frontend
```

Playwright WebKit prüft die WebKit-Engine reproduzierbar, ist aber nicht die
Safari-App und übernimmt weder deren Browseroberfläche noch die macOS-Einstellung
für vollständige Tastaturnavigation. Vor Releases mit Änderungen an Dialogen,
Fokus oder Tab-Reihenfolge daher zusätzlich Safari auf macOS manuell prüfen:

1. In Safari unter **Einstellungen → Erweitert** die Option zum Hervorheben aller
   Webseitenobjekte per Tabulator einmal aus- und einmal einschalten; zusätzlich
   die macOS-Tastaturnavigation einmal aus- und einmal einschalten. Je nach
   Einstellung mit `Tab` beziehungsweise `⌥ Tab` durch die Seite navigieren.
2. MOTD per Tastatur über **Schließen** und **Alles klar** beenden: Danach muss
   **Code eingeben** den sichtbaren Tastatur-Fokusrahmen erhalten; der nächste
   Navigationstastendruck führt zu **Quiz erstellen**, nicht zum Skip-Link.
3. MOTD jeweils per Maus über **Schließen** und **Alles klar** beenden, während
   der Fokus noch auf dem Schließen-Button liegt: Beide Klicks müssen reagieren;
   **Code eingeben** ist danach das Fokusziel, aber ohne Tastatur-Fokusrahmen.
4. Vor dem verzögerten MOTD-Öffnen das Codefeld fokussieren und dann per Maus
   schließen: Nach dem Schließen liegt der Fokus auf **Code eingeben**, nicht im
   Codefeld oder im entfernten Dialog.

Siehe auch Apples Dokumentation zu
[Safari-Tastaturkurzbefehlen](https://support.apple.com/de-de/guide/safari/cpsh003/mac)
und zur
[macOS-Tastaturnavigation](https://support.apple.com/de-de/guide/mac-help/mchlc06d1059/mac).

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

Die Relay-Unit-/Integrationssuite prüft zusätzlich strikte
`quiz-library-room-<UUID>`-Upgrades, globale und raumbezogene Connection-/
Upgrade-Caps, die 16-MiB-Produktgrenze, viele kleine und wiederholte große
Frames, echte Yjs-Zustände knapp unter/über dem 15-MiB-Dokumentcap,
raumübergreifendes Zustandswachstum, ausgehende Reconnect-Budgets sowie
kontrollierte Parserfehler:

```bash
npm test -w @arsnova/backend -- --run src/lib/yjsRelay.test.ts
CLIENTS=30 npm run load:yjs:sync
```

Der Lasttest muss auch Offline-Updates nach Reconnect in denselben State Vector
konvergieren lassen. Enge IP-Limits sind kein zulässiger Ersatz für diese
Abnahme.

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
BASE_URL=http://localhost:4200/de TRPC_URL=http://localhost:3000/trpc npm run smoke:session-question-progress -w @arsnova/frontend
BASE_URL=http://localhost:4200 npm run smoke:unified-session -w @arsnova/frontend
BASE_URL=http://localhost:4200 npm run e2e:confidence-summary-demo -w @arsnova/frontend
```

Der Confidence-E2E lädt das deutsche Demo-Quiz hoch, lässt standardmäßig 30 Teilnehmende
mit reproduzierbar zufälligen Sicherheitsgraden abstimmen und prüft anschließend
Session-Summary, Quiz-Historienzugriff, Host-Abschlussansicht und CSV-Export. Der Seed ist
über `CONFIDENCE_SEED` anpassbar; der Host-Screenshot wird standardmäßig im temporären
Verzeichnis `arsnova-confidence-summary-demo-e2e` abgelegt.

Für Performance-/Lastarbeit ist [PERFORMANCE-TESTING.md](PERFORMANCE-TESTING.md) das aktuelle Inventar. Die sechs **Classroom-Szenario-Smokes** (`load:smoke:*-classroom-30`, inkl. WebSocket Vote-Progress, Reconnect-Welle und Q&A-/Blitzlicht-Fan-out) laufen in CI im Job `classroom-smokes`; schwere Last-Smokes (200–600 TN), Yjs, Soak und k6-Produktion bleiben manuell/Schedule. Der mit PR [#165](https://github.com/kqc-real/arsnova.eu/pull/165) bereitgestellte Demo-Classroom-Dauerlauf ist davon getrennt: **lokal validiert**, ausschließlich manuell lokal und kein PR-Gate. Praktikums-Einstieg: [`docs/praktikum/HANDOUT-LAST-UND-PERFORMANCE-TESTS.md`](praktikum/HANDOUT-LAST-UND-PERFORMANCE-TESTS.md).

Der lokale 10-Minuten-Nachweis vom 2026-07-27 absolvierte 48 vollständige
Runden, 1.440 Joins, 14.400/14.400 Votes und 19.104 HTTP-Aufrufe ohne Fehler.
HTTP-p95/p99 lagen bei 59,62/83,78 ms; Redis und PostgreSQL lieferten je 121/121
Probes, alle 21/21 Gates bestanden. Dieser Lauf ersetzt nicht die offene
S6.5-Formalabnahme auf dem Zielhost.

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
# bestehende Session (Join, Q&A, Blitzlicht, WS); RESULTS überspringt Votes:
SESSION_CODE=AB12CD PARTICIPANTS=500 npm run load:artillery:500
```

Skripte: [`scripts/load/run-artillery-500.mjs`](../scripts/load/run-artillery-500.mjs), [`scripts/load/artillery/500-live-session.yml`](../scripts/load/artillery/500-live-session.yml). CI-Job `artillery-500` (Schedule/Manuell, Standard 100 TN auf Runner).

### Artillery-Reconnect-Welle (bis 500 TN)

Quiz-only: Join → WS-Status subscribe → Disconnect-Welle → Reconnect-Welle → Host `revealResults` → Assert `RESULTS` bei allen TN.

W2.3a/W2.3b prüfen die serverseitigen tRPC-WebSocket-Caps zusätzlich in
`apps/backend/src/lib/trpcWebSocketServer.test.ts`: echte 429-/503-Upgrades,
Abbruch vor dem Resolver, unverändertes 2-MiB-Payload-Cap und eine vollständige
500-Client-Verbindungs-/Reconnect-Welle mit den Produktionsdefaults. Dazu
kommen gültiges Session-/Participant-Binding, das Zwei-Verbindungs-Cap,
Session-Cap, Counter-Freigabe, Legacy-/Malformed-Kompatibilität und zwei
Participants derselben NAT-IP.

```bash
npm run dev:backend
PARTICIPANTS=500 npm run load:artillery:reconnect:500
```

Der Reconnect verwendet wie der Produktclient 500 ms exponentiellen
Erst-Backoff plus 0–349 ms Jitter. Formales Gate: mindestens 95 % sind binnen
30 Sekunden erneut verbunden. Skripte:
[`scripts/load/run-artillery-reconnect-500.mjs`](../scripts/load/run-artillery-reconnect-500.mjs),
[`scripts/load/artillery/500-reconnect-wave.yml`](../scripts/load/artillery/500-reconnect-wave.yml).
CI-Job `artillery-reconnect-500` (Schedule/Manuell, Standard 100 TN auf Runner).
Classroom-Smoke (30 TN): `npm run load:smoke:ws-reconnect-wave-classroom-30`.

Die formale Security-/Lasttest-Abnahme aus Plan §6.5 wird ohne Last geprüft mit:

```bash
npm run load:security-acceptance:validate
```

Der Test validiert verbindliche Join-/Vote-/WS-/Reconnect-/PDF-SLOs, die
vollständige Szenario-Coverage, ausschließlich bekannte Runner, das
Node-24-/Nginx-/Redis-/PostgreSQL-Zielprofil, befristete Zielhost-Evidenz,
standardisierte Reports sowie die separate Produktionssperre. Ein echter
500er-Lauf ist ausdrücklich kein PR-Gate; der operatorgesteuerte Ablauf steht
in
[S6.5-SECURITY-LOAD-ACCEPTANCE.md](implementation/S6.5-SECURITY-LOAD-ACCEPTANCE.md).

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

Für den parallelen 600er-Burst setzt der Smoke einen eigenen Undici-Dispatcher mit
`VOTE_HTTP_CONNECTIONS` (Default: `PARTICIPANTS`). Der Default-Reveal-Offset beträgt
`WITHIN_GRACE_REVEAL_OFFSET_MS=100` (Clock-Skew-Puffer für Remote-Ziele); in CI wird er auf
`0` gesetzt, damit der Burst maximalen Karenz-Rest auf dem lokalen Runner erhält.
`undici` ist als Root-`devDependency` deklariert, damit `npm ci` den Import nicht nur über
transitives Hoisting auflöst. Keep-Alive liegt bei `KEEP_ALIVE_TIMEOUT_MS=30000`, und vor
Karenz-/Outside-Reveal wärmt der Smoke den Undici-Pool mit parallelen `health.check`-Calls
(`CONNECTION_WARMUP_LEAD_MS=1000`), damit Reconnects nach dem ACTIVE-Burst nicht die 2s-Karenz
auffressen. In CI bleiben die Latenzgates bei
`VOTE_P95_LIMIT_MS=4000` / `VOTE_P99_LIMIT_MS=4000`. Der Nightly vom 2026-08-15 akzeptierte
fachlich 600/600 Karenz-Votes, verfehlte aber das vorherige 3000-ms-Gate (p95 3046 ms,
p99 3095 ms; Vortag p95 2828 ms). Der Nightly vom 2026-08-17 zeigte den Keep-Alive-Flake:
nur 450/600 Karenz-Votes bei p95 2524 ms, nachdem Idle nach ACTIVE die 10s-Keep-Alives
sterben ließ. Die 4000-ms-Gates und das Connection-Warm-up halten die funktionale Prüfung
`accepted === 600` und geben GitHub-Runnern Abstand zur Burst-Latenz.

Der Smoke ergänzt den Host-Progress-Smoke: Er misst nicht den WebSocket-Fan-out, sondern den
serverseitigen Vote-Hotpath rund um Timerende, Karenz und Ergebnisfreigabe.

Der lokale 600er-Lauf vom 2026-07-10 bestätigte die fachliche Karenzlogik, verfehlte
aber das harte `VOTE_P95_LIMIT_MS=1000`: p95 lag bei 2.156 ms in `ACTIVE` und
1.466 ms innerhalb der Backend-Karenz. Das Szenario ist daher als
fehlgeschlagen, nicht nur als funktional korrekt, zu dokumentieren.

---

## Wo Tests liegen

- **Backend:** `apps/backend/src/**/*.test.ts`, Vitest (u. a. Session, Vote, Rate-Limit, **MOTD/Admin-MOTD** — Epic 10).
- **Frontend:** `*.spec.ts` neben Komponenten/Services (Angular/Vitest), siehe [AGENTS.md](../AGENTS.md).
  Async-Komponententests: Hilfsfunktionen in `apps/frontend/src/testing/component-test-utils.ts`.

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
