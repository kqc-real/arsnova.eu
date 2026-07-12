<!-- markdownlint-disable MD013 -->

# CI-Workflow verständlich erklärt (für Junior-Entwickler:innen)

Diese Seite erklärt den kompletten GitHub-Workflow in [../.github/workflows/ci.yml](../.github/workflows/ci.yml):

- Was wird geprüft?
- Wann läuft welcher Job?
- Warum ist dieser Check wichtig?
- Was bedeutet ein Fehler konkret für deinen PR?

Für detaillierte lokale Testkommandos und zusätzliche Last-/Smoke-Varianten siehe [TESTING.md](TESTING.md).

---

## In 5 Minuten verstehen

Wenn du neu im Projekt bist, reicht dieses mentale Modell:

1. **Vorstufe (früh):** `changes` erkennt docs-only Änderungen; parallel dazu prüfen `dependency-review`, `actionlint`, `format` und `migration` frühe PR-, Workflow-, Format- und Datenbankschemarisiken.
2. **Technische Basis:** Das Projekt muss in einer realistischen Umgebung bauen (`build`, `landing-build`, `typecheck`, `lint`, i18n-Konsistenz).
3. **Verhalten:** Tests müssen grün sein und Mindestqualität halten (`test:coverage`, `e2e`, `classroom-smokes`, `lighthouse`).
4. **Sicherheit:** `audit`, Dependency Review und Trivy blockieren ab High; CodeQL prüft SAST, die CI erzeugt ein CycloneDX-SBOM.
5. **Release:** Nur wenn alles grün ist und der Commit noch aktueller `main`-HEAD ist (`deploy-freshness`), darf deployed werden (`deploy`), danach kommt der Gesundheitscheck (`post-deploy-smoke`).

### PR-Checkliste für Erstbeiträge

Nutze diese Reihenfolge lokal, bevor du einen PR öffnest:

1. `npm run typecheck`
2. `npm run lint`
3. `npm run test:coverage`
4. Bei Frontend-/Locale-Änderungen zusätzlich: `npm run build:localize -w @arsnova/frontend`
5. Optional produktionsnah: `npm run verify:production-serving`

Wenn ein Schritt fehlschlägt, behebe ihn lokal zuerst. So sparst du CI-Runden und Reviewer-Zeit.

---

## 1) Ziel der Pipeline

Die CI-Pipeline soll drei Dinge sicherstellen:

1. **Technische Korrektheit**: Build, Typprüfung, Lint und Unit/Integrationstests laufen stabil.
2. **Produktqualität**: Frontend ist baubar, zugänglich (A11y), und die Kernflows funktionieren End-to-End.
3. **Release-Sicherheit**: Sicherheitsprüfungen bestehen, Deploy ist geschützt und wird nachgelagert verifiziert.

---

## 2) Wann startet die Pipeline?

Auslöser in [../.github/workflows/ci.yml](../.github/workflows/ci.yml):

1. **push auf main**
2. **pull_request auf main**
3. **schedule** (nachts, täglich)
4. **workflow_dispatch** (manuell per GitHub UI)

---

## 3) Gesamtbild als Ablaufgrafik

```mermaid
flowchart TD
  A[Trigger: push / pull_request / schedule / workflow_dispatch]
  A --> Z[changes<br/>docs_only output]

  Z --> B[dependency-review<br/>nur pull_request]
  Z --> C[actionlint<br/>nicht bei schedule]
  Z --> D[build<br/>Node 20 + Node 22<br/>skip bei docs_only/schedule]
  Z --> E[typecheck<br/>skip bei docs_only/schedule]
  Z --> F[audit<br/>skip bei docs_only/schedule]
  Z --> G[trivy-fs<br/>skip bei docs_only/schedule]
  Z --> G2[migration drift<br/>migrate deploy + schema diff]

  D --> H[lint]
  D --> I[test:coverage]
  D --> J[lighthouse]
  D --> K[e2e smoke]
  D --> K2[classroom smokes]
  D --> L[docker build]
  D --> M[trivy-image]

  H --> Q[deploy-freshness<br/>nur aktueller main-HEAD]
  I --> Q
  J --> Q
  K --> Q
  K2 --> Q
  L --> Q
  E --> Q
  F --> Q
  G --> Q
  G2 --> Q
  M --> Q

  Q --> N[deploy]

  N --> O[post-deploy-smoke]
  O --> P[rollback-on-smoke-failure<br/>nur bei failed smoke]

  A --> R[load-test k6<br/>nur schedule oder workflow_dispatch]
  A --> R2[artillery-500<br/>nur schedule oder workflow_dispatch]
  A --> R2a[artillery-reconnect-500<br/>nur schedule oder workflow_dispatch]
```

Wichtig: Jobs ohne direkte Abhängigkeit laufen **parallel**.

---

## 4) Job für Job: Was, wo, wann, warum

### 4.0 changes (Change Filter)

- **Was?** Ermittelt, ob der Change-Set ausschließlich Doku-Dateien enthält (`docs/*` und `*.md`).
- **Wo?** Job `changes` in [../.github/workflows/ci.yml](../.github/workflows/ci.yml).
- **Wann?** Bei `push` und `pull_request` (bei `schedule`/`workflow_dispatch` standardmäßig `docs_only=false`).
- **Warum?** Spart Runner-Zeit: Bei docs-only laufen die Jobs weiter (Ruleset-Pflichtchecks behalten Matrix-Namen), schwere Steps werden per Fast Pass übersprungen.

### 4.1 dependency-review

- **Was?** Prüft Dependency-Änderungen im PR auf bekannte Risiken.
- **Wo?** Action `actions/dependency-review-action` in [../.github/workflows/ci.yml](../.github/workflows/ci.yml).
- **Wann?** Nur bei `pull_request`.
- **Warum?** Verhindert, dass riskante Paket-Updates unbemerkt gemerged werden.

### 4.2 actionlint

- **Was?** Linting/Validierung der GitHub-Workflow-Dateien.
- **Wo?** Action `raven-actions/actionlint` in [../.github/workflows/ci.yml](../.github/workflows/ci.yml).
- **Wann?** Bei allen Events außer `schedule`.
- **Warum?** Verhindert CI-Fehler durch fehlerhafte YAML-/Workflow-Logik.

### 4.3 build (Node-Matrix: 20 und 22)

- **Was?**
  1. `npm ci`
  2. `prisma validate`
  3. `prisma generate`
  4. TypeScript-Build (`shared-types` + Backend)
  5. Frontend-Typecheck (`tsc --noEmit`)
  6. Lokalisierter Frontend-Produktionsbuild
  7. Upload des Frontend-Artefakts (für Folgejobs)
- **Wo?** Build-Schritte in [../.github/workflows/ci.yml](../.github/workflows/ci.yml).
- **Wann?** Fast immer; Kernjob für viele Abhängigkeiten.
- **Warum?** Bestätigt, dass das System baubar ist und alle Folgechecks auf einem validen Build aufsetzen.

### 4.3a migration

- **Was?** Wendet die vollständige versionierte Migrationskette auf eine leere PostgreSQL-Datenbank an und vergleicht das Ergebnis mit `prisma/schema.prisma`.
- **Wo?** Job `migration` in [../.github/workflows/ci.yml](../.github/workflows/ci.yml).
- **Wann?** Bei allen Events außer `schedule`; docs-only Änderungen erhalten einen schnellen grünen Platzhalter.
- **Warum?** Verhindert, dass Schemafelder nur durch `prisma db push` existieren und frische Deployments trotz erfolgreichem `migrate deploy` zur Laufzeit scheitern.

### 4.4 typecheck

- **Was?** Root-`typecheck` über Workspaces (`shared-types`, Backend, Frontend).
- **Wo?** Scripts in [../package.json](../package.json), Workspace-Configs in [../apps/backend/vitest.config.ts](../apps/backend/vitest.config.ts) und [../apps/frontend/vitest.config.ts](../apps/frontend/vitest.config.ts) für Testkontext.
- **Wann?** Alle Events außer `schedule`.
- **Warum?** Fängt Typfehler früh ab, bevor Runtime-Tests laufen.

### 4.5 lint

- **Was?** ESLint über `libs/` und `apps/`.
- **Wo?** Script in [../package.json](../package.json).
- **Wann?** Nach erfolgreichem `build`.
- **Warum?** Hält Codequalität und Konsistenz im Team hoch.

### 4.6 audit

- **Was?** `npm audit --audit-level=high --omit=dev` als Gate für
  Produktionsabhängigkeiten plus CycloneDX-SBOM-Artefakt.
- **Wo?** Audit-Job in [../.github/workflows/ci.yml](../.github/workflows/ci.yml).
- **Wann?** Alle Events außer `schedule`.
- **Warum?** Blockiert bekannte High-/Critical-Schwachstellen vor dem Merge/Deploy
  und dokumentiert die ausgelieferten Komponenten.

### 4.7 test (Coverage-Gate)

- **Was?** `npm run test:coverage` für Shared Contracts, Backend und Frontend.
- **Wo?** Root-Script in [../package.json](../package.json), Schwellenwerte in
  [../apps/backend/vitest.config.ts](../apps/backend/vitest.config.ts) und
  [../apps/frontend/vitest.config.ts](../apps/frontend/vitest.config.ts) sowie
  [../libs/shared-types/vitest.config.ts](../libs/shared-types/vitest.config.ts).
- **Wann?** Nach erfolgreichem `build`.
- **Warum?** Prüft Verhalten und stellt Mindestabdeckung sicher.

### 4.8 lighthouse

- **Was?** Lighthouse CI gegen den gebauten Frontend-Stand (`/de/`, `/en/`), mobil
  mit drei Läufen je URL. Performance, LCP, CLS, TBT und Accessibility sind harte Gates.
- **Wo?** Job in [../.github/workflows/ci.yml](../.github/workflows/ci.yml), Regeln in [../.lighthouserc.cjs](../.lighthouserc.cjs).
- **Wann?** Nach `build`, außer bei `schedule`.
- **Warum?** Qualitätssignal für Accessibility/Performance/Best-Practices/SEO.
- **Letzter lokaler Nachweis:** Am 2026-07-11 bestanden 6/6 Läufe mit
  Performance 0,79–0,80 und LCP 3,705–3,829 s; siehe
  [QA-Nachlauf](implementation/LOCAL-QA-RECHECK-2026-07-11.md).

### 4.9 e2e

- **Was?** Sechs Playwright-Smokes mit echten Services (Postgres + Redis),
  produktionsnahen Migrationen und Backend-/Frontend-Start: Host-/Presenter-Auth,
  Host-Musik, `SHORT_TEXT`, `NUMERIC_ESTIMATE`, Quiz-Sync und Unified Session.
- **Wo?** Job und Skriptinventar in [../.github/workflows/ci.yml](../.github/workflows/ci.yml)
  und [../apps/frontend/package.json](../apps/frontend/package.json).
- **Wann?** Nach `build`, außer bei `schedule`.
- **Warum?** Testet den Nutzerfluss systemnah (nicht nur isolierte Unit-Tests).

### 4.10 classroom-smokes

- **Was?** Sechs protokollnahe Unterrichts-Szenarien (je 30 TN) gegen lokales Backend: Blitzlicht-Tempo, Q&A, Demo-Quiz mit 9 Fragen, WebSocket Vote-Progress (Host-WS + HTTP-Votes), WebSocket-Reconnect-Welle sowie Q&A-/Blitzlicht-Fan-out.
- **Wo?** Job in [../.github/workflows/ci.yml](../.github/workflows/ci.yml); Skripte:
  - [../scripts/load/blitzlicht-classroom-30.mjs](../scripts/load/blitzlicht-classroom-30.mjs)
  - [../scripts/load/qa-classroom-30.mjs](../scripts/load/qa-classroom-30.mjs)
  - [../scripts/load/demo-quiz-classroom-30.mjs](../scripts/load/demo-quiz-classroom-30.mjs)
  - [../scripts/load/ws-vote-progress-classroom-30.mjs](../scripts/load/ws-vote-progress-classroom-30.mjs)
  - [../scripts/load/ws-reconnect-wave-classroom-30.mjs](../scripts/load/ws-reconnect-wave-classroom-30.mjs)
  - [../scripts/load/channel-ws-fanout-classroom-30.mjs](../scripts/load/channel-ws-fanout-classroom-30.mjs)
- **Wann?** Push/PR auf `main` und `workflow_dispatch`, außer `docs_only` und `schedule`.
- **Warum?** Prüft Session-/Kanal-Hotpaths (Vote, Q&A, Redis-Blitzlicht, Realtime-WS) ohne Browser; ergänzt E2E um API-nahe Last-Smokes und ist ein direktes Deploy-Gate.
- **Artefakt:** `classroom-smoke-reports` (standardisiertes JSON und JUnit XML pro Szenario + `backend.log`).

### 4.11 artillery-500

- **Was?** Artillery-Live-Session (Quiz + Q&A + Blitzlicht, HTTP + WebSocket);
  Standard 500 TN im CI-Runner. Im selben geplanten Lauf
  folgen die schweren Vote-Smokes für Host-Progress (200 TN), Timer-Fairness
  (600 TN), der Yjs-Mehrclient-Sync, der Freitext-/Wordcloud-Pfad und ein
  5-Minuten-Live-Session-Soak mit Backend-Prozess-, Redis- und PostgreSQL-Probes.
- **Wo?** Job in [../.github/workflows/ci.yml](../.github/workflows/ci.yml); Runner [../scripts/load/run-artillery-500.mjs](../scripts/load/run-artillery-500.mjs).
- **Wann?** Nur bei `schedule` oder `workflow_dispatch`.
- **Artefakt:** `artillery-500-reports` (standardisierte JSON-/JUnit-Reports, Artillery-Report + `backend.log`).
- **Letzter lokaler Nachweis:** Artillery 500/500 und der 5-Minuten-Soak
  bestanden im Gesamtlauf; Yjs und das 600er Timer-Fairness-Latenzgate bestanden
  im [QA-Nachlauf 2026-07-11](implementation/LOCAL-QA-RECHECK-2026-07-11.md).

### 4.11a artillery-reconnect-500

- **Was?** Artillery-Reconnect-Welle (Quiz-only): Join → WS subscribe → Disconnect → Reconnect → Host-Reveal → Assert `RESULTS`; Standard 100 TN im CI-Runner, konfigurierbar bis 500.
- **Wo?** Job in [../.github/workflows/ci.yml](../.github/workflows/ci.yml); Runner [../scripts/load/run-artillery-reconnect-500.mjs](../scripts/load/run-artillery-reconnect-500.mjs).
- **Wann?** Nur bei `schedule` oder `workflow_dispatch`.
- **Artefakt:** `artillery-reconnect-500-reports` (Summary JSON + Artillery-Report + `backend.log`).

### 4.12 load-test

- **Was?** k6-Health-Loadtest gegen Produktion.
- **Wo?** Job in [../.github/workflows/ci.yml](../.github/workflows/ci.yml), Skript in [../scripts/load/k6-trpc-health-50vu.js](../scripts/load/k6-trpc-health-50vu.js).
- **Wann?** Im Schedule nur mit `PRODUCTION_LOAD_ENABLED=true`; manuell nur mit
  `run_production_load=true`.
- **Warum?** Regelmäßige Lastsicht, ohne jeden PR-Run zu verlangsamen.

### 4.13 trivy-fs

- **Was?** Security-Scan des Repository-Dateisystems (HIGH/CRITICAL).
- **Wo?** Trivy-Job in [../.github/workflows/ci.yml](../.github/workflows/ci.yml).
- **Wann?** Alle Events außer `schedule`.
- **Warum?** Deckt bekannte Schwachstellen/Fehlkonfigurationen in Dateien und Dependencies auf.

### 4.14 trivy-image

- **Was?** Baut ein Scan-Image und führt Trivy-Image-Scan aus (HIGH/CRITICAL).
- **Wo?** In [../.github/workflows/ci.yml](../.github/workflows/ci.yml).
- **Wann?** Nach `build`, außer bei `schedule`.
- **Warum?** Findet container-spezifische Risiken vor Deployment.

### 4.15 docker

- **Was?** Docker-Image-Build (ohne Push).
- **Wo?** Job in [../.github/workflows/ci.yml](../.github/workflows/ci.yml), Build-Definition in [../Dockerfile](../Dockerfile).
- **Wann?** Nach `build`, außer bei `schedule`.
- **Warum?** Prüft, dass das Release-Artefakt (Container) tatsächlich baubar ist.

### 4.16 deploy-freshness

- **Was?** Prüft kurz vor dem Production-Deploy, ob der geprüfte Commit (`github.sha`) noch der aktuelle `main`-HEAD ist.
- **Wo?** Deploy-Freshness-Job in [../.github/workflows/ci.yml](../.github/workflows/ci.yml).
- **Wann?** Nur bei `push` auf `main` und wenn `DEPLOY_ENABLED=true` gesetzt ist, nach allen Quality-Gates.
- **Warum?** Verhindert stale Deployments: Ein älterer, langsamer CI-Lauf darf keinen inzwischen überholten Commit mehr produktiv ausrollen.

### 4.17 deploy

- **Was?** Server-Deploy via SSH; führt serverseitig [../scripts/deploy.sh](../scripts/deploy.sh) aus.
- **Wo?** Deploy-Job in [../.github/workflows/ci.yml](../.github/workflows/ci.yml).
- **Wann?** Nur wenn `deploy-freshness` bestätigt hat, dass `github.sha` noch aktueller `main`-HEAD ist.
- **Warum?** Produktivdeployment bleibt kontrolliert, an alle Quality-Gates gekoppelt und auf den tatsächlich geprüften Commit gepinnt.

### 4.18 post-deploy-smoke

- **Was?** Nachgelagerter Smoke-Check auf der Zielumgebung über [../scripts/verify-production-serving.mjs](../scripts/verify-production-serving.mjs).
- **Wo?** Job in [../.github/workflows/ci.yml](../.github/workflows/ci.yml).
- **Wann?** Nur wenn `deploy` erfolgreich war.
- **Warum?** Verifiziert, dass die produktive Auslieferung wirklich erreichbar und gesund ist (inkl. TLS-Hostname-Schutz bei `DEPLOY_HOST`).

### 4.19 rollback-on-smoke-failure

- **Was?** Automatischer Rollback auf den vorherigen Commit (`github.event.before`) und erneutes serverseitiges Deployment.
- **Wo?** Job in [../.github/workflows/ci.yml](../.github/workflows/ci.yml).
- **Wann?** Bei `push` auf `main`, wenn `deploy` erfolgreich war, aber `post-deploy-smoke` fehlschlug (mit `always()` ausgewertet, damit der Job trotz Fehlerpfad startet).
- **Warum?** Reduziert Ausfallzeit und stellt den zuletzt funktionierenden Stand schnell wieder her.

---

## 5) Welche Jobs sind echte Gates vor Deploy?

Vor dem eigentlichen Deploy müssen erfolgreich sein:

1. lint
2. test (mit Coverage)
3. docker
4. typecheck
5. lighthouse
6. e2e
7. classroom-smokes
8. audit
9. trivy-fs
10. trivy-image
11. deploy-freshness (`should_deploy=true`)

Wenn eines der Quality-Gates (1–10) fehlschlägt, wird nicht deployt. Wenn danach
`deploy-freshness` feststellt, dass `github.sha` nicht mehr aktueller `main`-HEAD ist,
wird der Deploy sauber übersprungen.

---

## 6) Was bedeutet ein Fail für mich im Alltag?

- **Fail in build/typecheck/lint**: meist Code- oder Typproblem direkt in deinem PR.
- **Fail in test/e2e**: Verhalten ist regressiv oder instabil.
- **Fail in audit/trivy**: Sicherheitsrisiko gefunden; Upgrade/Fix nötig.
- **Fail in lighthouse**: Qualitätsanforderung (insb. A11y) unterschritten.
- **Fail in docker**: Release-Artefakt nicht reproduzierbar.
- **Fail in post-deploy-smoke**: Deployment lief technisch, aber die App ist nicht gesund ausgeliefert.
- **Fail in rollback-on-smoke-failure**: Das automatische Zurückrollen ist gescheitert; sofort manuell eingreifen.

---

## 7) Gute Reihenfolge für lokale Checks vor PR

Empfehlung (schnell nach aussagekräftig):

1. `npm run typecheck`
2. `npm run lint`
3. `npm run test:coverage`
4. Bei Frontend-/SSR-Änderungen: `npm run build:localize -w @arsnova/frontend`
5. Optional für produktionsnahe Validierung: `npm run verify:production-serving`

Mehr Details und Spezialfälle stehen in [TESTING.md](TESTING.md).

---

## 8) Glossar für Junior-Entwickler:innen

- **Gate**: Ein Muss-Check. Wenn rot, stoppt die Pipeline vor dem nächsten kritischen Schritt.
- **needs**: Abhängigkeit zwischen Jobs. Ein Job startet erst, wenn seine Vorgänger grün sind.
- **Artifact**: Datei/Ordner aus einem Job, die in späteren Jobs wiederverwendet wird.
- **Matrix**: Derselbe Job läuft in mehreren Umgebungen (hier Node 20 und 22).
- **Smoke-Test**: Kurzer End-to-End-Test, der die wichtigsten Kernfunktionen prüft.

---

## 9) Welche Reports/Artefakte entstehen und wo finde ich sie?

In GitHub findest du Artefakte so:

1. Repository öffnen
2. Tab Actions
3. Gewünschten CI-Run öffnen
4. Unten im Bereich Artifacts die Downloads auswählen

| Artefaktname            | Erzeugender Job | Inhalt                                                        | Fundstelle im Runner                                                | Retention |
| ----------------------- | --------------- | ------------------------------------------------------------- | ------------------------------------------------------------------- | --------- |
| `frontend-dist-browser` | `build`         | Lokalisierter Frontend-Produktionsbuild                       | `apps/frontend/dist/browser`                                        | 1 Tag     |
| `coverage-reports`      | `test`          | Backend- und Frontend-Coverage (HTML + Textsummary-Dateien)   | `apps/backend/coverage`, `apps/frontend/coverage`                   | 7 Tage    |
| `lighthouse-reports`    | `lighthouse`    | Lighthouse-Ausgabe (A11y/Performance/SEO/Best-Practices)      | `.lighthouseci`                                                     | 7 Tage    |
| `e2e-service-logs`      | `e2e`           | Laufzeitlogs von Backend und Frontend während des Smoke-Tests | `${{ runner.temp }}/backend.log`, `${{ runner.temp }}/frontend.log` | 7 Tage    |
| `trivy-fs-report`       | `trivy-fs`      | Trivy Filesystem Security Report (SARIF)                      | `trivy-fs.sarif`                                                    | 7 Tage    |
| `trivy-image-report`    | `trivy-image`   | Trivy Container Image Security Report (SARIF)                 | `trivy-image.sarif`                                                 | 7 Tage    |

Hinweise:

1. `audit`, `dependency-review` und `actionlint` liefern primär Check-Status und Logs, aber kein eigenes Download-Artefakt.
2. Die Trivy-Gates bleiben blockierend: erst wird mit `exit-code: '1'` geprüft, danach wird zusätzlich ein Report für den Download erzeugt.

---

## 10) Branch Protection (Required Checks)

Damit die Pipeline-Regeln wirklich verbindlich sind, sollten in GitHub Branch Protection für `main` diese Checks als **required** gesetzt werden (GitHub-Display-Namen aus dem Workflow):

1. `Build & Validate (Node 20)`
2. `Build & Validate (Node 22)`
3. `lint`
4. `Typecheck (workspaces)` (Matrix: Node 20 und 22)
5. `Tests`
6. `Lighthouse CI`
7. `Playwright Smoke E2E`
8. `Classroom Scenario Smokes`
9. `Security Audit`
10. `Trivy Filesystem Scan`
11. `Trivy Image Scan`
12. `Workflow Lint`
13. `Dependency Review`

Empfehlung: `deploy-freshness`, `deploy`, `post-deploy-smoke` und `rollback-on-smoke-failure` nicht als PR-required setzen, da diese nur im Push/Release-Pfad relevant sind.

**Docs-only und Ruleset:** GitHub-Rulesets können Pflicht-Checks nicht pfadabhängig ausnehmen. Stattdessen melden docs-only-PRs dieselben Check-Namen per **Fast Pass** (Job läuft, schwere Steps werden übersprungen) als `success` — so bleibt das Ruleset für Code-PRs streng, Doku-PRs bleiben mergebar.

---

## 11) Canonical References

- Workflow-Datei: [../.github/workflows/ci.yml](../.github/workflows/ci.yml)
- Test-Referenz: [TESTING.md](TESTING.md)
- Sicherheitsüberblick: [SECURITY-OVERVIEW.md](SECURITY-OVERVIEW.md)
- Deploy-Skript: [../scripts/deploy.sh](../scripts/deploy.sh)
- Post-Deploy-Verifikation: [../scripts/verify-production-serving.mjs](../scripts/verify-production-serving.mjs)
