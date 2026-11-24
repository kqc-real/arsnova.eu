<!-- markdownlint-disable MD013 MD060 -->

# Tests & CI — Referenz

**Lokal** vor PR: mindestens `npm run build`, `npm run lint`, `npm test` (entspricht den wesentlichen CI-Gates). Vollständige DoD: [Backlog.md](../Backlog.md) „Definition of Done“. Nach größeren Änderungen an **`@arsnova/shared-types`**: wie in Root-[README](../README.md) zuerst `npm run build -w @arsnova/shared-types` bzw. Root-`npm run build` nutzen.

**Git-Hooks:** Pre-commit führt nur `lint-staged --concurrent false` aus. ESLint, Prettier und Related-Tests laufen dort als eine sequenzielle Task-Kette; lint-staged blendet ungestagte Änderungen aus, bevor die Tests starten (`--no-isolate`). Änderungen in `shared-types` oder `session-export-report` ziehen die abhängigen Workspace-Suiten mit. Manuelles `npm run test:related` isoliert bei Bedarf selbst gegen den Index und stellt ausschließlich den selbst erzeugten Keep-Index-Stash wieder her. Pre-push führt `npm run typecheck` aus. Die volle Suite bleibt verbindlich in der CI und in der PR-Checkliste; der Hook ersetzt sie nicht.

**Stand:** 2026-09-21 · Workflow: [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) (Node **22** und **24**; inkl. `dependency-review`, `actionlint`, Format-, i18n-, Template-A11y-, axe-, Lighthouse-, Reflow-, PDF/UA-, Trivy- und Migrations-Gates) · SAST: [`.github/workflows/codeql.yml`](../.github/workflows/codeql.yml) · Deploy-Skript: [`scripts/deploy.sh`](../scripts/deploy.sh)

---

## NPM-Skripte (Root)

| Befehl                                        | Bedeutung                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run build`                               | `shared-types` → Backend `tsc` → Frontend `ng build`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `npm run typecheck`                           | `shared-types` und `session-export-report` bauen (`dist`) und danach Quellen inklusive `*.test.ts` prüfen; Backend prüft `src` und `scripts/**/*.test.ts`; Frontend prüft `tsconfig.app.json` und `tsconfig.spec.json`                                                                                                                                                                                                                                                                                                                                                                                                             |
| `npm run lint`                                | Blockierendes ESLint-Gate über `libs/`, `apps/` und alle inventarisierten operativen JS-/TS-Skripte                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `npm run lint:scripts`                        | Blockierendes Voll-Gate: jede inventarisierte Skriptdatei muss ohne ESLint-Fehler und ohne Warnungen bestehen                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `npm run lint:scripts:changed`                | Deterministisches Zusatz-Gate für neue/geänderte Skripte im angegebenen Git-SHA-Bereich; behandelt Löschungen und Renames                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `npm run lint:scripts:test`                   | Negativ-, Profil- und Mutationstests für Inventur, Changed-Script- und Voll-Gate                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `npm run prisma:migrate`                      | Versionierte Prisma-Migrationen auf die lokale Dev-DB (`migrate deploy`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `npm run prisma:migrate:test`                 | Vertragstest: lokale Dev-Skripte rufen `migrate deploy` auf, nicht `db push`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `npm test`                                    | **Shared Contracts**, **Session-Export-Report**, **Backend** und **Frontend** mit Vitest (sequentiell)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `npm run test:related`                        | Pre-commit: Vitest `related` für gestagte Dateien, volle Vitest-Läufe in abhängigen Workspaces bei Lib-Änderungen, Node-Skripttests; in `lint-staged` ohne Extra-Stash (`--no-isolate`), manuell nur mit nachgewiesenem Keep-Index-Stash                                                                                                                                                                                                                                                                                                                                                                                           |
| `npm run test:related:test`                   | Unit-Tests für den Related-Test-Planer                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `npm run test:spacy-sidecar`                  | Unix-Socket-Unittests des optionalen spaCy-Sidecars ohne Modell-Download (`docker/spacy/tests`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `npm run test:spacy-compose`                  | Compose-Smoke: Sidecar nur über Profil `nlp`, kein TCP-Port, `SPACY_IMAGE` getrennt von `ARSNOVA_IMAGE`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `npm run docker:up:nlp`                       | Optionalen spaCy-Sidecar lokal bauen und starten (`docker compose --profile nlp`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `npm run test:wordcloud-encoder`              | Unittests des optionalen Word-Cloud-Encoders ohne Modell-Download (`docker/wordcloud-encoder/tests`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `npm run test:wordcloud-encoder-compose`      | Compose-Smoke: Encoder nur über Profil `encoder`, kein TCP-Port, cgroup 1 CPU / 2 GiB, `WORD_CLOUD_ENCODER_IMAGE` getrennt von `ARSNOVA_IMAGE`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `npm run docker:up:encoder`                   | Optionalen Word-Cloud-Encoder lokal bauen und starten (`docker compose --profile encoder`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `npm run docker:up:llm:http`                  | Optionalen llama.cpp-Container an `127.0.0.1:8080` für Host-`npm run dev` (Profil `llm-http`; Anleitung: [onboarding.md](onboarding.md#optional-lokale-text-ki-qwen3-4b))                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `npm run docker:up:llm`                       | Optional Runtime **und** App-Container über Unix-Socket (Profil `llm`; nicht parallel zu `npm run dev`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `npm run spacy:dev`                           | Host-spaCy-Sidecar im Vordergrund für `npm run dev` (`/tmp/arsnova-nlp.sock`, venv `docker/spacy/.venv`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `npm run spacy:dev:test`                      | Hilfe-/Syntax- und Verdrahtungstests für `scripts/spacy-dev-sidecar.sh`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `npm run engines:test`                        | Node-`engines`-Vertrag: `engine-strict`, Root-`engines` im Lockfile, alle nicht optionalen Pakete ab Mindestversion installierbar (`semver` ist dafür Root-`devDependency`)                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `npm run spacy:macos-dev`                     | macOS: Clean, `build:prod` aller Locales, Host-Sidecar, `start:prod`, `serve:localize:api` auf 4200, Freitext-, Q&A- und Moderationskompass-Seed (Demo-Quiz mit Freitextfrage)                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `npm run spacy:macos-dev:test`                | Hilfe, Syntax, Sidecar-Upgrade und Wiederverwendung nach vorübergehender Auslastung                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `npm run qa-summary:dev`                      | Lokaler 8.9c-Inferenzhelfer auf `127.0.0.1:8787/summary` (extraktiv; optional Gemini-Key nur im Helfer)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `npm run qa-summary:dev:test`                 | Vertrag-, Loopback- und Gemini-Mock-Tests für `scripts/qa-summary-dev-server.mjs`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `npm run dev:qa-summary`                      | Backend/Frontend, spaCy, Themen-Encoder und lokalen Zusammenfassungshelfer gemeinsam starten; der Starter aktiviert die Zusammenfassung und ihre Loopback-URL automatisch                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `npm run dev:ai`                              | Vollständiger lokaler KI-Stack: Backend/Frontend, Q&A-NLP, spaCy-Lemmatisierung, Themen-Encoder, extraktiver Summary-Helfer und – bei konfiguriertem `OPEN_WEIGHT_LLM_URL` – automatischer SSH-Tunnel zur privaten Open-Weight-Runtime für Themenbeschriftungen, Zusammenfassungen und Lernzielvorschläge; für CPU-Inferenz gilt lokal ein Summary-Timeout von 240 s. Der Start erklärt jeden freigegebenen Port. Danach zeigt eine farbige Übersicht pro Funktion Datenherkunft, Nutzen, aktiv unterstützte Locales sowie Modell oder Verfahren. Der Themenpfad nennt ausdrücklich E5 plus Complete-Linkage-Clustering statt kNN. |
| `npm run format:check`                        | Prettier (ohne Schreiben)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `npm run validate:pdfua`                      | Fünf PDF/UA-1-Locale-Demos mit veraPDF validieren                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `npm run verify:production-serving`           | HTTP-Smoke gegen einen laufenden Production-Serve (`/`, `/de/`, Compression, `health.stats`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `npm run audit:trpc-dod`                      | Blockierendes Non-Regression-Gate für AppRouter und alle Backend-`src/**/*.test.ts`; `scripts/**/*.test.ts` ist kein Evidenzpfad; Legacy bleibt zulässig                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `npm run audit:trpc-dod -- --update-baseline` | Vollständigen/verbesserten Zustand atomar und monoton in die Git-verankerte Baseline übernehmen                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `npm run audit:trpc-dod:poc`                  | Isolierter Fixture-Audit der in Slice 2A eingeführten Evidenzkonvention                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `npm run audit:trpc-dod:test`                 | Negativ- und Determinismus-Tests für `scripts/audit-trpc-dod.mjs` (nach `npm ci`, nicht im Workflow-Lint)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |

### Hervorgehobener KI-Gesamtstart: `npm run dev:ai`

`npm run dev:ai` ist der zentrale Entwicklungsstart für alle KI-Pfade. Er startet
die App, Q&A-Kategorisierung, Lemmatisierung, E5-Themenbildung und den lokalen
extraktiven Summary-Helfer. Dazu kommen die privaten Qwen-Aufträge für
Themenbeschriftung, Zusammenfassung und Lernzielvorschläge. Die Analyseverträge
unterstützen `de`, `en`, `fr`, `es` und `it`. Die Qwen-Runtime selbst muss bereits über
die konfigurierte URL beziehungsweise den Maintainer-SSH-Tunnel erreichbar sein.

Ressourcen: E5 ist lokal auf 1 CPU und 2 GiB RAM begrenzt. Der spaCy-Hostprozess
und die Node-Prozesse besitzen im Host-Starter kein eigenes Limit; das
spaCy-Compose-Profil verwendet 1 CPU und 1 GiB. Ein optional lokal gestarteter
Qwen-Container verwendet bis zu 4 CPUs und 5 GiB RAM; seine GGUF-Datei ist
2.497.281.120 Byte groß. Mit entferntem Qwen konservativ 4 Kerne, 12 GiB RAM und
10 GiB freien Speicher einplanen, empfohlen 8/16/20. Mit Qwen auf demselben
Rechner 8 Kerne, 16 GiB RAM und 20 GiB frei vorsehen. Das sind Planungswerte für
Entwicklung, keine Lastfreigabe. Die vollständige Tabelle steht im
[Onboarding](onboarding.md#alle-ki-komponenten-starten-npm-run-devai).

Workspace-spezifisch:

| Workspace                        | Tests                                                           | Typcheck                                              |
| -------------------------------- | --------------------------------------------------------------- | ----------------------------------------------------- |
| `@arsnova/shared-types`          | `npm run test -w @arsnova/shared-types` (`vitest run`)          | `npm run typecheck -w @arsnova/shared-types`          |
| `@arsnova/session-export-report` | `npm run test -w @arsnova/session-export-report` (`vitest run`) | `npm run typecheck -w @arsnova/session-export-report` |
| `@arsnova/backend`               | `npm run test -w @arsnova/backend` (`vitest run`)               | `npm run typecheck -w @arsnova/backend`               |
| `@arsnova/frontend`              | `npm run test -w @arsnova/frontend` (`vitest run`)              | `npm run typecheck -w @arsnova/frontend`              |

`npm run typecheck -w @arsnova/backend` setzt ein gebautes `@arsnova/shared-types` (`libs/shared-types/dist`) voraus; das Root-Skript `npm run typecheck` baut die Libraries zuerst. Die Landingpage hat keine TypeScript-Specs; ihr Typcheck bleibt `npm run check -w @arsnova/landing` (`astro check`) und gehört nicht zu `npm run typecheck`.

### Absoluter Session-Lebenszyklus und Retention (PostgreSQL)

Der Migration-Job führt die opt-in Tests für #407 und #409 gegen die
vollständig migrierte PostgreSQL-Datenbank aus:

```bash
RUN_PG_SESSION_LIFECYCLE_TESTS=1 \
  npm run test -w @arsnova/backend -- \
  --run src/__tests__/session.absolute-lifecycle.pg.test.ts \
        src/__tests__/session.retention.pg.test.ts \
        src/__tests__/session.learning-objectives.pg.test.ts
```

Der Test benötigt echtes PostgreSQL; ein Prisma-Mock ist kein Ersatz. Er prüft
24-Stunden-Defaults, unveränderliche Lifecycle-Marker, fail-closed
Child-Writes, `endedAt = expiresAt` bei verspäteter Materialisierung sowie
Verlängerung-/Ende-Races über mehrere Verbindungen. Der Retention-Test löscht
außerdem ein abgelaufenes, entkoppeltes `SessionFeedback` direkt und prüft damit
den Trigger-Konflikt `27000`. Vor dem Test müssen die
versionierten Migrationen mit `npx prisma migrate deploy` angewendet sein. Die
zugehörigen Controlled-Clock-Unit- und Frontendtests laufen im normalen
Backend-/Frontend-Testjob. Der Retention-Test prüft zusätzlich die
14-Tage-/Legal-Hold-Bridge für alte Cleanup-Images, Cascade und Set-Null,
Audit-Minimierung, Invite-Job-Löschung, gültige Leitindizes aller
Session-/Parent-Quiz-Purge-Referenzaktionen sowie die getrennten
90-/365-Tage-TTLs.
Der Orphan-Scope-PostgreSQL-Test prüft zusätzlich die gemeinsame
Sessionzeilensperre für Parent-Quiz-Löschung und späte FK-lose Audit-/Invite-
Writer.
Der Lernzieltest prüft die Quelllöschung für Quiz- und Q&A-Referenzen,
monotone Ziel-/Kontextrevisionen, den Abbruch am Revisionsmaximum sowie
vollständige Session-/Quiz-Cascades. Damit wird insbesondere die Reihenfolge
der PostgreSQL-Trigger und Fremdschlüssel gegen eine echte Migration statt nur
gegen Prisma-Mocks validiert.

### Capabilities und Q&A-Skalierungsinvarianten (PostgreSQL + Redis)

Der Migration-Job prüft #412 bis #415 zusätzlich gegen echte, vollständig
migrierte Dienste:

```bash
RUN_PG_CAPABILITY_TESTS=1 RUN_PG_QA_SCALE_TESTS=1 \
  REDIS_URL=redis://localhost:6379 \
  npm run test -w @arsnova/backend -- \
  --run src/__tests__/session.capabilities.pg.test.ts \
        src/__tests__/qa.scale.pg.test.ts

RUN_PG_QA_MIGRATION_TESTS=1 \
  npm run test -w @arsnova/backend -- \
  --run scripts/qa-scale-migration.test.ts
```

Die Capability-Suite prüft atomare Teilnahme-Kennungen, Tiernummern je
Raum und Tier bei parallelen Beitritten, Join-Replay, den Redis-Join-Puffer
mit 500 Plätzen und die Nachfüllrate von 125 Plätzen pro Sekunde,
atomare Schreibgruppen für freie Nicknames mit Replays und Namens-/Client-Konflikten,
sessiongebundenen Wiederbeitritt, Host-Credential-Rotation, Wiederherstellung
nach Redis-Verlust und auditierten Widerruf. Die Q&A-Suite prüft die parallelen
10./11.- und 25.000./25.001.-Grenzen, idempotenten Retry, physisches Delete,
persistente Plattformprojektion und konkurrierende Richtungsstimmen. Der
Migrations-Backfill läuft in einer kurzlebigen Datenbank und entfernt sie
anschließend wieder.

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
`.github/trpc-dod-baseline.json` mit zu committen. Die Audit-Tests leiten
Gesamtzahl, `kind`-Zahlen und `Complete` aus dieser Baseline ab; ein zweites
manuelles Nachziehen fester Prozedurzahlen ist nicht nötig. Der Updater verweigert
neue oder erhöhte Schuld sowie konkurrierende Schreibzugriffe. Exit 1 bedeutet Gate-Verstoß
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
Der Frontend-Lauf verteilt die Spec-Dateien bereits selbst auf Worker-Prozesse (`maxWorkers: '50%'`
der logischen Kerne, `pool: 'forks'`, ein Prozess pro Datei). Mehrere gleichzeitige `npm test`- oder
`vitest run`-Prozesse (z. B. aus IDE, Agent oder Terminal parallel) überbuchen die CPU zusätzlich und
führen zu **Timeout-Flakiness** in schweren Frontend-Specs, ohne dass der Code fehlerhaft ist.

**Typische Symptome:**

- Vitest-`setup` dauert Minuten statt Sekunden (z. B. > 1.000 s statt ~20 s).
- Schwankende Fehlerzahl (2–9 Tests) in `session-vote`, `session-host` oder `quiz-edit`.
- CI bleibt grün, lokaler Gesamtlauf scheitert sporadisch.

**Empfehlung:**

```bash
# Nur Frontend (wenige Minuten), wenn Backend bereits grün ist:
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
ist ebenfalls abgeschlossen. Die jüngsten Hotpath-Optimierungen (Coalescing in `getCurrentQuestionForStudent`, `fetchHostVoteProgress` und `qa.onQuestionsUpdated`/`qa.list`, `SHORT_TEXT`-Toleranz-Stripping sowie Frontend-Request-Epochs) und die Timing-Gegenüberstellung gegen die Story-0.7-Baseline sind in [HOTPATH-AUDIT-UND-TIMING-2026-10-22.md](implementation/HOTPATH-AUDIT-UND-TIMING-2026-10-22.md) dokumentiert.

---

## CI-Pipeline (GitHub Actions, `main`)

Auslöser: **Push** und **Pull Request** auf `main`.

| Job / Phase                                                                      | Inhalt                                                                                                                                                                                                                         |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **dependency-review**                                                            | PR-abhängiger Dependency-Risiko-Check (`fail-on-severity: high`)                                                                                                                                                               |
| **actionlint**                                                                   | Linting/Validierung der GitHub-Workflow-Dateien; zusätzlich operative Python-/Shell-Checks inkl. spaCy-Sidecar-Unittests ohne Modell-Download                                                                                  |
| **format**                                                                       | Prettier-Gate für im PR/Push geänderte unterstützte Dateien                                                                                                                                                                    |
| **landing-build**                                                                | Produktionsbuild der Astro-Landingpage plus axe-Gate für Start, Impressum und Datenschutz                                                                                                                                      |
| **build** (Node 22 & 24)                                                         | `npm ci` → `prisma validate` → `prisma generate` → `tsc -b apps/backend` → Frontend `tsc --noEmit` → `build:localize` (Frontend, **alle** konfigurierten Locales `de/en/fr/it/es`)                                             |
| **typecheck** (Node 22 & 24, parallel)                                           | `npm ci` → `prisma validate` → `prisma generate` → `npm run typecheck` (Library-Build, dann `--noEmit` für Quellen und TypeScript-Tests der Libraries, des Backends und des Frontends)                                         |
| **lint**                                                                         | `npm run lint` (nach build), einschließlich Angular-Template-A11y-Regeln und blockierendem Voll-Gate für alle inventarisierten Skripte; zusätzlich Negativ-/Mutationstests und deterministisches Changed-Script-Gate           |
| **audit**                                                                        | `npm audit --audit-level=high --omit=dev`, CycloneDX-SBOM als Artefakt (**blockierend ab High für Produktionsabhängigkeiten**)                                                                                                 |
| **test**                                                                         | `npm run test:coverage` (nach build, inkl. Coverage-Thresholds)                                                                                                                                                                |
| **pdfua**                                                                        | veraPDF-1.30.2-Gate für die PDF/UA-1-Demoexporte aller fünf Locales                                                                                                                                                            |
| **trivy-fs**                                                                     | Trivy-Scan des Repository-Dateisystems (HIGH/CRITICAL, blockierend)                                                                                                                                                            |
| **trivy-image**                                                                  | Docker-Image-Build für Scan + Trivy-Image-Scan (HIGH/CRITICAL, blockierend)                                                                                                                                                    |
| **lighthouse**                                                                   | Lighthouse Performance gegen Home DE/EN; separater A11y-Lauf gegen Home DE/EN, Quiz-Liste, Hilfe und Datenschutz, inklusive blockierender Einzelaudits                                                                         |
| **e2e-chromium**                                                                 | Chromium Smoke E2E mit Postgres/Redis, statischen und dynamischen axe-Scans sowie Reflow-/Fokus-/Zielgrößen-Gate                                                                                                               |
| **webkit-e2e**                                                                   | Expliziter WebKit-Lauf Safari-naher MOTD-Pointer-/Fokus-Regressionen und Smartphone-Teilnahme (Join, Kanäle, Countdown, Vote)                                                                                                  |
| **e2e**                                                                          | Stabiler Required-Check, der die erfolgreichen Chromium- und WebKit-Jobs aggregiert; bei Workflow-Abbruch nicht nachträglich rot, bei Job-Timeout eines Browsers weiterhin rot                                                 |
| **classroom-smokes**                                                             | Sechs Unterrichts-Szenario-Smokes (inkl. WS Vote-Progress, Reconnect und Q&A-/Blitzlicht-Fan-out, je 30 TN) gegen lokales Backend; JSON-/JUnit-Reports als Artifact                                                            |
| **docker**                                                                       | Docker-Image-Build (ohne Push), vollständiger Production-Compose-Start mit Migration/Healthcheck sowie Runtime-Smokes für Container-Härtung/Chromium-Maximalbericht und Yjs-Konvergenz inkl. Offline-Reconnect gegen Port 3002 |
| **deploy**                                                                       | Bei Push auf `main` und `DEPLOY_ENABLED=true` nach den Quality-Gates. Der per SSH geladene Release-Runner hält die Produktionssperre über Digest-Deploy, Replikatfreigabe, HTTPS-Smoke und gegebenenfalls Rollback.            |
| Matrix: **zwei** unterstützte Versionen (**22** und **24**), `fail-fast: false`. |

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
  src/lib/pdfConcurrencyLimiter.test.ts \
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
den Unix-Socket. Der Smoke prüft, dass das Ergebnis mehrere Seiten enthält. CI
prüft während dieses Render-Tests zusätzlich, dass der PID-Limit-Zähler des
Workers nicht steigt. CI beendet den Worker zuvor einmal hart und erwartet einen
healthy `restart: always`, bevor der PDF-Smoke Socket-Cleanup und
Wiederanbindung bestätigt; die exakte Policy wird am laufenden Container
assertiert und deckt auch Host-/Daemon-Neustarts ab. Der Unit-Test mit einem nie
auflösenden Renderer prüft zusätzlich worker-interne Deadline, 504, fatalen
Healthstatus und Exit-Callback. Produktion darf nicht auf lokales Chromium
zurückfallen.

Für das [Staging mit zwei Apps](operations/STAGING-COMPOSE.md#gemeinsamer-pdf-export-slot)
einen freigegebenen Quiz-Bericht mit gültigem Host-Token über App A exportieren.
Sobald der Socket-Healthcheck des Workers `x-pdf-worker-state: busy` meldet,
parallel 500 gültige `vote.submit`-Anfragen einer separaten Live-Session über
Nginx starten und denselben PDF-Export direkt auf App B anfragen. Während die
Redis-Reservierung besteht, muss B HTTP 429 liefern. Beide Host-WebSockets
müssen 500 Stimmen melden. Nach der PDF-Antwort von A den Export auf B mit
HTTP 200 wiederholen. Vote-Latenzen und tatsächliche Überlappung mit dem
Rendering protokollieren.

### Optionaler spaCy-Sidecar (Story 1.14b)

Für das [Staging mit zwei Apps](operations/STAGING-COMPOSE.md#gemeinsamer-spacy-sidecar-und-llm-slot)
`wordCloud.analyze` mit `LEXICAL` und `LEMMA` getrennt auf A und B ausführen.
Beide Antworten müssen `normalizationApplied: LEMMA` sowie die Modell-ID
des gemeinsamen Sidecars liefern. Für den LLM-Renntest A unmittelbar nach
erfolgreicher Runtime-Slot-Sonde und vor dem POST halten. Währenddessen
einen Summary-Auftrag auf B starten. B muss einen extraktiven Fallback
mit Grund `busy` liefern, obwohl die Runtime noch einen freien Slot meldet.
A freigeben, genau einen Inferenz-POST am gemeinsamen Endpunkt nachweisen
und den Wiederholungsversuch auf B nach Abschluss prüfen.

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

### Optionaler Word-Cloud-Encoder (Story 1.14c Stufe 1)

Stufe 1 ist im Repo; der Sidecar bleibt Default aus. Produktdoku: [word-cloud-semantic.md](features/word-cloud-semantic.md).

```bash
npm run test -w @arsnova/shared-types -- src/word-cloud-semantic.test.ts
npm test -w @arsnova/backend -- --run \
  src/lib/wordCloudSemanticConfig.test.ts \
  src/lib/wordCloudSemanticCluster.test.ts \
  src/lib/wordCloudSemanticAnalyze.test.ts \
  src/lib/wordCloudEncoderClient.test.ts \
  src/lib/wordCloudAnalysisCache.test.ts \
  src/lib/sessionPurgeInvalidation.test.ts \
  src/lib/wordCloudNormalization.test.ts \
  src/__tests__/wordCloud.hotpath-isolation.test.ts
npm run test -w @arsnova/frontend -- \
  src/app/features/session/session-host/session-host.component.spec.ts \
  src/app/features/session/session-present/word-cloud.component.spec.ts
npm run test:wordcloud-encoder
npm run test:wordcloud-encoder-compose
```

Die atomare Write-Fence, Session-ID-Isolation, Code-Wiederverwendung und die
getrennten Runtime-/Rollout-Sweeps mit echtem Redis 7 prüfen:

```bash
RUN_REDIS_WORD_CLOUD_CACHE_TESTS=1 WORD_CLOUD_PURGE_REQUIRE_DURABILITY=1 \
  npm run test -w @arsnova/backend -- --run \
  src/lib/wordCloudAnalysisCache.redis.test.ts
```

CI führt zusätzlich `wordCloudAnalysisCache.durability.redis.test.ts` in einem
eigenen Redis-Crashzyklus aus. Derselbe Prepare-/Verify-Zyklus prüft auch den
sessiongebundenen Blitzlicht-Purge: sechs `qf:*`-Daten-Keys und die Fence müssen
nach `WAITAOF`, `SIGKILL` und Redis-Neustart dauerhaft gelöscht bzw. erhalten
bleiben, während `qf:host:*` unberührt bleibt. Derselbe Test belegt den
Rollout-Cutover eines sessiongebundenen Altwerts ohne `sessionId`. Der Zyklus
prüft außerdem, dass sessionbezogene ProductFeedback-Slots, Tokens,
Reservierungen und Metadaten gelöscht bleiben, die Fence erhalten bleibt und
eine bereits anonymisierte Follow-up-Capability nicht mit der
Session-Bereinigung entfernt wird. Lokal entsprechen die CI-Opt-ins:

```bash
QUICK_FEEDBACK_PURGE_REQUIRE_DURABILITY=1 \
  npm run test -w @arsnova/backend -- --run \
  src/lib/quickFeedbackSessionPurge.test.ts

PRODUCT_FEEDBACK_PURGE_REQUIRE_DURABILITY=1 \
  npm run test -w @arsnova/backend -- --run \
  src/lib/productFeedbackTokens.purge.test.ts
```

Im selben Crashzyklus prüft
`sessionRuntimeDataPurge.durability.redis.test.ts`, dass Presence und
Lesebereitschaft nach der AOF-bestätigten Session-ID-Fence weder durch den
Redis-Neustart noch durch einen Late-Writer zurückkehren. Die Unit-/Race-Suite
läuft lokal mit:

```bash
SESSION_RUNTIME_DATA_PURGE_REQUIRE_DURABILITY=1 \
  npm run test -w @arsnova/backend -- --run \
  src/lib/sessionRuntimeDataPurge.test.ts
```

Zusätzlich läuft `hostPairingSessionPurge.durability.redis.test.ts` im ersten
Crashzyklus. Er prüft, dass Pairing-Record, begrenzter Artefaktindex,
Token-Lookup und Claim dauerhaft entfernt bleiben, die Session-ID-Fence den
Neustart überlebt und ein Late Writer keinen neuen Pairing-Record anlegt. Die
Unit-/Race-Suite läuft lokal mit:

```bash
HOST_PAIRING_PURGE_REQUIRE_DURABILITY=1 \
  npm run test -w @arsnova/backend -- --run \
  src/lib/hostPairingSessionPurge.test.ts
```

Prepare und AOF-Barriere, `SIGKILL`, Redis-Neustart und Verify laufen vollständig
vor dem entsprechenden Yjs-Zyklus. So kann ein nachgelagertes Yjs-`WAITAOF` die
vorherigen Mutationen nicht versehentlich bestätigen. Die Unit-Suite deckt
außerdem Reconnect und geänderten Server-`run_id` zwischen Mutation und Barriere
sowie die auf 25 Sessions begrenzten Bulk-Chunks ab.

Lokal den Encoder nur bewusst starten. Auf **macOS** nicht `npm run docker:up:encoder` für Host-Node erwarten — der Socket im Volume ist unsichtbar. Stattdessen Loopback `WORD_CLOUD_ENCODER_URL=http://127.0.0.1:8790/embed`. Unter Linux im App-Container: `npm run docker:up:encoder`. Produktion: Image selbst bauen, Compose-Profil `encoder`, `WORD_CLOUD_SEMANTIC_ENABLED=true`; Rollback `WORD_CLOUD_SEMANTIC_ENABLED=false` und `stop wordcloud-encoder`. `deploy.sh` startet den Encoder nicht.

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

`eval:qa-nlp` meldet unter `localeHoldout` zusätzlich Macro-F1, Trefferquote und Anteil unsicherer Ergebnisse für jede App-Locale und für gemischtsprachige Fragen. Der Prüfkorpus ist unabhängig vom Trainingssplit.

### Optionale Moderationszusammenfassung (Story 8.9c)

```bash
npm test -w @arsnova/shared-types -- --run \
  src/qa-summary.test.ts \
  src/qa-summary-v2.test.ts \
  src/qa-summary-visibility.test.ts
npm test -w @arsnova/backend -- --run \
  src/lib/moderationSummaryContext.test.ts \
  src/lib/openWeightLlmClient.test.ts \
  src/lib/qaSummaryConfig.test.ts \
  src/lib/qaSummarySnapshot.test.ts \
  src/lib/qaSummaryValidate.test.ts \
  src/lib/qaSummaryAdapter.test.ts \
  src/lib/qaSummaryQueue.test.ts \
  src/__tests__/qa.summary.test.ts \
  src/__tests__/dto-security.test.ts
npm run test -w @arsnova/frontend -- \
  src/app/features/session/session-host/moderation-compass-dialog.component.spec.ts \
  src/app/features/session/session-host/session-host.component.spec.ts
npm run load:issue-456:validate
```

Kill-Switch default aus (`QA_SUMMARY_ENABLED=false`). On-demand, quellengebunden und ephemer. V2 handelt `full-context`/`legacy-text` ausdrücklich aus und liefert ohne Modell einen lokalen extraktiven Backend-Fallback; es gibt keinen Cloud-Fallback. `qa.summaryContextPreview` ist hostgeschützt und wird in der UI erst nach ausdrücklicher Aktion geladen. Der lokale Legacy-Helfer bleibt mit `npm run qa-summary:dev` / `npm run qa-summary:dev:test` prüfbar. `npm run load:issue-456:validate` validiert netzwerkfrei das kanonische Demo-Quiz sowie mindestens 250 Teilnahmen mit je zehn sinnvollen Fragen; der echte `npm run load:issue-456:run` ist auf Loopback beschränkt und erwartet einen separat mit `QA_SUMMARY_ENABLED=true` gestarteten Backendprozess. Sein früher Preflight bricht bei deaktiviertem Summary V2 noch vor Joins und Q&A-Last ab. Produktdoku: [qa-summary.md](features/qa-summary.md), [Slice-8-Abnahme](implementation/ISSUE-456-SLICE-8-ABNAHME.md). Ein separater interaktiver Lernziellauf mit dem vollständigen Demo-Quiz erzeugte am 12.10.2026 zehn Entwürfe; er ist kein Nachweis für den 250-Teilnahmen-Runner. Die kurze Summary-V2-Modellprobe bestand in allen fünf App-Locales. Vollständige Lernziel-Mess- und Qualitätsdaten sowie die Prefill- und RSS-Abnahme des reichhaltigen 8.192-Profils stehen aus.

Im [Zwei-App-Staging](operations/STAGING-COMPOSE.md#gemeinsamer-qa-ergebnisstatus)
einen Summary-Auftrag auf A starten und mit gültigem Host-Token auf B
zuerst `pending`, dann das fertige Ergebnis abrufen. Eine parallele
Anfrage derselben Session auf B muss denselben Fortschritt liefern.
Am Modellendpunkt genau einen Inferenz-POST zählen. Einen Abruf ohne
Host-Token abweisen und nach einer Quellenänderung den Abgleich auf
beiden Apps prüfen.

### Fünfsprachige NLP-Proben

```bash
node --import tsx apps/backend/scripts/eval-qa-nlp-gatekeeper.ts
npm run eval:issue-456:slice8:pack
OPEN_WEIGHT_LLM_SUMMARY_TIMEOUT_MS=90000 \
  node --env-file=.env --import tsx apps/backend/scripts/eval-qa-summary-locales.ts
# Optional: Slice-8-Vollkontext- & TTFT-/Prefill-Messung (3 Läufe bei T=0, geheimnisfreies JSON)
OPEN_WEIGHT_LLM_SUMMARY_TIMEOUT_MS=90000 \
  node --env-file=.env --import tsx apps/backend/scripts/eval-issue-456-slice8-summary.ts --live
```

Die Klassifikationsprobe wertet 15 synthetische Holdout-Fragen je App-Locale aus.
Die Mindestquote von 80 % bezieht Enthaltungen ein. Die Modellprobe benötigt
eine konfigurierte private Qwen-Runtime und verlangt pro Locale eine generative,
quellengebundene Ausgabe mit zwei vollständigen Überschriften ohne Fallback.
Messwerte und Grenzen stehen in der [Q&A-Klassifikation](features/qa-nlp-moderation.md)
und der [Summary-V2-Dokumentation](features/qa-summary.md).
Der [optionale E5-Modelltest](features/word-cloud-semantic.md) benötigt echte
ONNX-Gewichte. Der lokale Hörsaallastlauf deckte die Klassifikationsqueue sowie
spaCy- und Encoder-Aufträge ab. Qwen lief in separaten Einzelproben.

### Gemeinsame LLM-Prioritätsübergabe (#717)

Der Redis-Test braucht eine isolierte Redis-Instanz. Er prüft die Besitzerkennung
bei Übergabe, den Abbruch vor dem Modellaufruf, die Reihenfolge der Aufträge
den begrenzten Wartebereich pro Priorität, Abbruchsignalverlust und Redis-Ausfall.

```bash
REDIS_URL=redis://127.0.0.1:6379 RUN_REDIS_LLM_PRIORITY_TESTS=1 \
  npm run test -w @arsnova/backend -- --run src/lib/openWeightLlmPriority.redis.test.ts
```

Für die Modellabnahme beide Backends mit aktivierter Prioritätsübergabe und
gemeinsamer Runtime starten. Auf App A eine Lernzielableitung mit mindestens
zwei Fragegruppen auslösen. Sobald die erste Gruppe übernommen wurde, auf
App B ein Themenlabel anfordern, während die zweite Gruppe im Prefill bzw.
in der Token-Generierung läuft. Die Zeit ab der Labelanfrage bis zur
beobachteten Übernahme des Modellslots getrennt von der Zeit bis zum fertigen
Label erfassen. Der Inferenzaufruf meldet `preempted`. Der laufende Lernzielauftrag
behält seine fertigen Entwürfe und wiederholt nur die unterbrochene Gruppe
innerhalb des ursprünglichen Budgets. Die Wortwolke muss bereits vor Abschluss
der Modelllabels bedienbar sein. Für die weiteren Kombinationen eine laufende
Zusammenfassung durch Themenlabels beziehungsweise einen Lernziel-Batch durch
eine Zusammenfassung verdrängen. Freie Slots als Vergleich messen und p50, p95
und Maximum pro Kombination angeben.
[Staging-Konfiguration](operations/STAGING-COMPOSE.md#prioritätsübergabe-in-staging) · [Messung auf dem CPU-Zielhost](operations/LLM-PRIORITY-717.md)

### Private Open-Weight-LLM-Runtime (Story 8.9d)

```bash
npm run test:open-weight-llm:all
npm test -w @arsnova/shared-types -- src/open-weight-llm.test.ts
npm test -w @arsnova/backend -- --run \
  src/lib/openWeightLlmConfig.test.ts \
  src/lib/openWeightLlmClient.test.ts \
  src/__tests__/wordCloud.hotpath-isolation.test.ts
npm run typecheck
npm run build:prod
```

Die modellfreien Tests sind über `npm test` und `npm run test:coverage` in die Standard-CI eingebunden. Sie prüfen Pins und Hartflags, Unix- und Loopback-HTTP-Labor, Zwei-Host-Compose, CSV-sichere Credentials, rollbackfähige Operatorbefehle bei ungültigem Credential, private IPv4-/IPv6-Zielauflösung, DNS-Abbruch und -Timeout, drei versionierte Auftragsschemas samt 2.500-Byte-Kontextgrenze, alle Belegungsreihenfolgen, Triple-Concurrency, höchstens einen Modell-POST, Circuit Breaker, Fallback beziehungsweise manuellen Retry und Live-Hotpath-Isolation. Der reale lokale Modellnachweis mit Digests, Hardware und Messgrenze steht in [open-weight-llm-runtime.md](features/open-weight-llm-runtime.md). Er ersetzt weder die Summary-Prefill-Abnahme auf der 8-vCPU-Box noch Consumer-Qualitäts- oder Produktivtests.

#### Gezielter Modellabbruch und Durchsatz

Für beide Varianten dieselbe dedizierte Ein-Slot-CPU-Runtime-Topologie mit
identischem GGUF, CPU-Kontingent und Threadzahl verwenden. Einen Lauf nach dem
anderen über den privaten HTTP-Laborpfad starten. Das Credential aus der
Laborkonfiguration an den Prozess übergeben. Als Basis dient das bisherige
Modellimage mit CPU-Callback. Die Rolle des Images mit `connection` für die
Basis und `targeted` für den Kandidaten angeben.

```bash
OPEN_WEIGHT_LLM_BENCH_URL=http://127.0.0.1:18080 \
OPEN_WEIGHT_LLM_BENCH_CANCEL_MODE=targeted \
OPEN_WEIGHT_LLM_BENCH_ROUNDS=4 \
  node scripts/open-weight-llm/benchmark-targeted-cancellation.mjs
```

Die Laufreihenfolge Basis, Kandidat, Kandidat, Basis ausführen. Reguläre
Laufzeiten und Tokenzahlen für Themenlabels, Zusammenfassungen und Lernziele
vergleichen. Die getrennte Abbruchmessung erfasst die erste bestätigte
Slot-Freigabe im Prefill und im Decode. Der Kandidat prüft die Authentifizierung,
unbekannte IDs sowie doppelte und verspätete Signale am echten HTTP-Endpunkt.
Mit `OPEN_WEIGHT_LLM_BENCH_ROUNDS=0` läuft nur dieser Funktionstest mit einem
Aufwärmauftrag. Die Produktionsabnahme prüft anschließend im Quizeditor,
ob der erste Entwurf erhalten bleibt und die Fortsetzung nur offene Fragen sendet.

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

Beim allerersten manuellen Cutover muss der Ziel-Commit inline per `git fetch`, `git cat-file`, `git checkout --detach --force` und anschließendem `git rev-parse` **vor** Start von `scripts/deploy.sh` verifiziert werden; der alte Checkout muss den neuen Helper noch nicht enthalten. Bei späteren normalen manuellen Deploys darf `scripts/deploy/checkout-deploy-sha.sh` denselben Bootstrap übernehmen. CI führt ihn immer inline aus. Auf dem Server gilt danach die Reihenfolge **Digest-Image pullen → Architektur-Preflight und Ziel-Purge-Gate prüfen (Host und Image müssen `arm64` sein; Legacy-Ziel scheitert vor Checkout) → bestehenden lokalen Redis vor einer Neuerstellung AOF-verifizieren beziehungsweise RDB→AOF live konvertieren und per WAITAOF-Neustartprobe absichern → Postgres/Redis starten und AOF/Probe/Schlüsselzahl erneut prüfen → Prisma migrate deploy (`compose run --no-deps`, Binary unter `/app/node_modules/.bin/prisma`) → kompatiblen Word-Cloud-Purge-Runner bestimmen → bisherigen App-Writer stoppen/drainen → gesamten Word-Cloud-Analysecache AOF-bestätigt löschen → überfällige Retention vollständig bereinigen (`node /app/apps/backend/dist/runRetentionCleanup.js`, kein `npm`) → denselben AOF-bestätigten Sweep wiederholen → Ziel-Candidate unmittelbar vor Start persistieren → App/PDF-Worker starten, wobei der Ziel-Entrypoint den Sweep nochmals wiederholt → Healthcheck → Digest-Nachweis → Deploy-State schreiben und Candidate entfernen**. Die RDB→AOF-Branchtests erzwingen `BGSAVE` und `CONFIG SET appendonly yes` vor jedem Infrastruktur-Recreate und prüfen Fehler/Timeout/Missing-Container fail-closed. Der zweite Deploy-Sweep deckt insbesondere den ersten Cutover ab, bei dem der alte Writer noch kein Shutdown-Write-Gate besitzt; neue Prozesse sperren Cache-Writes beim SIGTERM und drainen HTTP vor Redis. Aktuelle Produktions-Zielplattform ist **linux/arm64**; ein amd64-only GHCR-Image wird vor Migration/Container-Änderung abgebrochen ([#229](https://github.com/kqc-real/arsnova.eu/issues/229)). `DEPLOY_IMAGE` muss die kanonische Form `ghcr.io/kqc-real/arsnova.eu@sha256:<64-hex>` haben; `ARSNOVA_IMAGE` steuert Compose für `app` und `pdf-worker` und wird in `.env.arsnova-image` persistiert (`./scripts/prod-compose.sh`). Der Deploy ist erst erfolgreich, wenn Redis-Persistenz, Cache- und Retention-Gate erfolgreich waren, der Container healthy ist, `http://127.0.0.1:3000/trpc/health.check` antwortet, die Frontend-Shell unter `/de/` ausgeliefert wird und Registry-Digest, lokale Image-ID sowie laufende Container-Image-IDs übereinstimmen.

**Image-Rollback** (`./scripts/deploy.sh --rollback`) stellt nur ein gate-kompatibles `previous.state` wieder her; **Recover** (`--recover`) stellt nur ein gate-kompatibles `current.state` wieder her. Beide starten das aktuell installierte Skript ohne Vorab-Checkout, prüfen das Ziel vor dessen Checkout, berücksichtigen einen persistierten Candidate zwingend und setzen **keine** Datenbankmigrationen zurück. Beim einmaligen Cutover werden pre-Gate-Ziele absichtlich fail-closed verweigert. Ist `current.state` noch Legacy, muss derselbe kompatible Candidate erneut normal deployt oder durch ein kompatibles Forward-Fix-/Revert-Image ersetzt werden; ein älterer Candidate bleibt bis nach Drain, beiden Sweeps und Retention bindend. Die Deploy-Branchtests bilden diesen Pfad sowie Candidate bei aktivem last-known-good, Fehler vor Drain, den zweiten Sweep und Candidate-Cleanup nach State-Commit ab. Der manuelle HTTP-Smoke über `npm run verify:production-serving -- https://<domain>` ergänzt diesen Check aus Nutzerperspektive.

---

## Browser- und A11y-Checks

| Befehl (Frontend-Workspace)        | Zweck                                                                                                                       |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `a11y:axe:static`                  | axe für statische Kernrouten/-zustände                                                                                      |
| `a11y:layout`                      | Reflow, Fokus, 24px-Ziele, Skip-Link, Join-Fokus, mobiles Disclosure und lokalisierte Aufgabenwahl auf der Startseite       |
| `check:viewport`                   | Alias/älterer 320px-Reflow-Smoke                                                                                            |
| `smoke:host-present-auth`          | Host-/Presenter-Zugriff, Live-Beitritt und nativer Schließdialog nach dem Ansichtswechsel während der Abstimmung            |
| `smoke:host-pairing-security`      | Story 2.10: Host / Smartphone / Presenter, Missbrauch + Lifecycle + Widerruf                                                |
| `smoke:presenter-viewports`        | Gefüllte Presenter-Lobby in vier Tablet-/Beamer-Viewports                                                                   |
| `smoke:host-music`                 | Host-Musik-/Sound-Smoke                                                                                                     |
| `smoke:host-qa-feedback-tools`     | Q&A-/Blitzlicht-Werkzeuge, Filter, Fokus, Fristen, Runden und fünf Locales                                                  |
| `smoke:host-home-entry`            | Echte Home-Chips, Q&A-Menü-Lifecycle, EVENT-Beides/Abbruch/Retry und CLASSROOM bis Gesamtende                               |
| `smoke:host-phase-controls`        | Quiz-Phasen, PI, fünf Locales, mobile Labels und Menü-/Dialogfokus                                                          |
| `smoke:short-text`                 | Kurzantwort-Flow inklusive axe                                                                                              |
| `smoke:numeric-estimate`           | Numerische-Schätzfrage-Flow-Smoke                                                                                           |
| `smoke:session-question-progress`  | Zwei-Client-Smoke für späteren Start, Vote, Skip und Nachbesprechung                                                        |
| `e2e:confidence-summary-demo`      | Demo-Quiz: 30 TN + Confidence-Abschluss                                                                                     |
| `e2e:motd-focus`                   | MOTD-Fokusrücksprung und Tab-Reihenfolge, außerdem Titelzeile und Escape im News-Archiv-Dialog bei 1440 und 320 px          |
| `smoke:webkit-participant-vote`    | WebKit/Safari-Engine: Smartphone-Teilnahme Join, Kanäle, Countdown, Vote                                                    |
| `smoke:quiz-sync`                  | Quiz-Sync-Flow-Skript                                                                                                       |
| `smoke:unified-session`            | Unified-Session-Flow inklusive axe                                                                                          |
| `smoke:product-feedback`           | ProductFeedback 12.1: Host-Sheet + Vote-Sessionende                                                                         |
| `smoke:product-feedback-in-app`    | ProductFeedback 12.2: Footer/Hilfe/Host/Vote/Join/Blitzlicht + Presenter-Negativ                                            |
| `smoke:epic-405-host-qa-lifecycle` | Epic #405: Host-Zugangskarte, Q&A-Footer, Self-Service-Wiederherstellung (lokal, nicht in `e2e-chromium`)                   |
| `smoke:epic-405-participant-qa`    | Epic #405: Q&A-Join, Frage senden, Sortierung, Favoriten, Wortwolke, Schreibpfad nach Ende (lokal, nicht in `e2e-chromium`) |
| `lighthouse:a11y`                  | Score und A11y-Einzelaudits (lokal)                                                                                         |
| `benchmark:word-cloud`             | Wortwolken-Benchmark / Regressionen                                                                                         |

Das PDF/UA-Gate liegt im Root-Workspace:

```bash
npm run validate:pdfua
```

Es benötigt Docker und validiert die committed PDF/UA-Demos mit veraPDF 1.30.2
gegen das Profil `ua1`. Das manuelle Prüfprotokoll steht unter
[`praktikum/ACCESSIBILITY-PDFUA-PRUEFPROTOKOLL.md`](praktikum/ACCESSIBILITY-PDFUA-PRUEFPROTOKOLL.md).

`a11y:axe:static`, `a11y:layout`, `smoke:presenter-viewports`,
`smoke:short-text`, `smoke:session-question-progress` und
`smoke:unified-session` sind Bestandteile des Chromium-Jobs `e2e-chromium`.
`smoke:epic-405-host-qa-lifecycle` und `smoke:epic-405-participant-qa` bleiben
lokale Smokes. Der Teilnehmer-Smoke lief als letzter Schritt im Chromium-Job
und ist dort wiederholt mit Timeout oder `Target crashed` ausgefallen, während
die vorherigen Smokes grün waren. Der Host-Lifecycle-Smoke bleibt lokal, weil
der Host-Reload nach der Zugangskarte in CI wiederholt nicht stabil war.
Der Presenter-Smoke legt vorab 50 Personen in einer Lobby an und blockiert bei
Scroll, Clipping oder Überlappung in 712×1138, 1138×712, 820×1180 und
1280×720 CSS-Pixeln; Fehlerscreenshots landen im E2E-Artefakt. Der Job
`webkit-e2e` startet dieselben echten Backend-/Frontend-Services, wählt WebKit
explizit und führt `e2e:motd-focus` sowie `smoke:webkit-participant-vote` aus.
Der Required-Check `e2e` wird nur grün, wenn beide
Browser-Jobs erfolgreich sind; ein abgebrochener Workflow färbt ihn nicht
nachträglich rot. Playwright-Browser installiert
[`scripts/ci/playwright-install.sh`](../scripts/ci/playwright-install.sh).
Der Browser-Download hat ein eigenes Zeitlimit. Auf GitHub-Runnern
verwendet APT für Azure- und regionale EC2-Spiegel `archive.ubuntu.com`.
`smoke:short-text` und `smoke:unified-session` schreiben bei
gesetztem `SMOKE_ARTIFACT_DIR` zusätzlich axe-JSON-Berichte; der
Session-Verlaufs-Smoke schreibt einen Abschluss- oder Fehler-Screenshot. Mit
`A11Y_SCAN=0` lassen sich nur die axe-Schritte lokal deaktivieren; CI setzt diese
Ausnahme nicht. Der Unified-Session-Smoke prüft den exklusiven Presenter-Wechsel
Q&A → Blitzlicht → Quiz in 1280×720 ohne Scroll oder Clipping. Mit
`UNIFIED_SESSION_SCREENSHOTS=1` speichert er die drei HDMI-Bilder unter
`tmp/presenter-channels-hdmi`; `UNIFIED_SESSION_SCREENSHOT_DIR` überschreibt das
Zielverzeichnis.

Lokal lassen sich dieselben browserabhängigen Prüfungen gezielt ausführen:

```bash
BASE_URL=http://localhost:4200 PLAYWRIGHT_BROWSER=chromium npm run a11y:layout -w @arsnova/frontend
BASE_URL=http://localhost:4200 PLAYWRIGHT_BROWSER=webkit npm run e2e:motd-focus -w @arsnova/frontend
BASE_URL=http://localhost:4200/de TRPC_URL=http://localhost:3000/trpc npm run smoke:webkit-participant-vote -w @arsnova/frontend
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
   Host-Link in der Tab-Reihe ist **Quiz** im Live-Raster, nicht der Skip-Link.
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

Seit dem Legacy-UUID-Cutoff (`YJS_SHARE_LEGACY_UUID_CUTOFF_AT`, Default 2026-10-01)
legt `load:yjs:sync` ohne `YJS_SHARE_TOKEN` automatisch einen Share über
`quizSync.createShare` an (`ARSNOVA_HTTP_URL`, Default `http://127.0.0.1:3000`).

Der Lasttest muss auch Offline-Updates nach Reconnect in denselben State Vector
konvergieren lassen. Enge IP-Limits sind kein zulässiger Ersatz für diese
Abnahme.

Der Smoke-Test nutzt die aktuellen UI-Selektoren für **Quiz anlegen**, **Sync-Link importieren**
und **Quiz speichern**. Wenn er wieder auf Selektoren fällt, ist das zunächst ein Testscript-
Problem und nicht automatisch ein Sync-Defekt.

Wichtig für Wiederholungsläufe: `serve:localize:api` serviert den bereits gebauten Stand aus
`dist/browser`. Nach Frontend- oder Script-Änderungen daher vor dem nächsten Smoke-Test erneut
`npm run build:localize -w @arsnova/frontend` ausführen.

### PWA-Update-Erkennung in bereits geöffneten Fenstern

`npm run test -w @arsnova/frontend -- src/app/core/pwa-update.service.spec.ts src/app/app.component.spec.ts`
prüft frühe Update-Ereignisse, bereits heruntergeladene Versionen ohne erneutes
`VERSION_READY`, positive Prüfergebnisse, Hintergrund/Vordergrund, Fensterfokus,
Offline/Online, parallele Auslöser, Zeitüberschreitung und Aufräumen nach Zerstörung.
Die bestehenden Banner-Tests sichern MOTD-/Entwurfsschutz und bewussten Reload ab.

`node --test apps/frontend/scripts/pwa-update-build.test.mjs` prüft mit dem installierten
Angular-Service-Worker-Generator, dass alle fünf Locale-Builds dieselbe jeweilige
Build-Kennung in HTML (einschließlich Prerender und SSR) und `ngsw.json.appData`
tragen. Wiederholte Generierung muss stabil bleiben; geänderte Assets müssen die
Kennung ändern und die endgültigen HTML-Integritätshashes müssen stimmen.
Der Test läuft vor den Frontend-Tests sowohl bei `npm test` als auch bei
`npm run test:coverage`, sobald die Angular-Abhängigkeiten installiert sind.

Die Kennung wird beim lokalisierten Produktionsbuild gesetzt. Geöffnete Fenster
vergleichen sie mit `NO_NEW_VERSION_DETECTED`, das auch eine schon
heruntergeladene, im Fenster noch nicht geladene Version beschreiben kann.
Ältere Builds ohne Kennung nutzen weiterhin `VERSION_READY`; die zusätzliche
Absicherung greift nach dem ersten Laden eines Builds mit Kennung. Es gibt keinen
automatischen Reload und keine Aktivierung im laufenden Fenster.

`npm run build:localize -w @arsnova/frontend` ist im Repo kein nackter Angular-Build: Nach `ng build --configuration production --localize` folgen noch Post-Build-Schritte für `noscript`, `sitemap.xml`, `manifest.webmanifest`, MOTD-Assets, die lokalisierten `ngsw.json` und die Root-`index.html`.

### Weitere lokale Flow-Smokes

Diese Skripte erwarten ebenfalls eine laufende lokale App mit Backend und Frontend:

```bash
BASE_URL=http://localhost:4200 npm run smoke:short-text -w @arsnova/frontend
BASE_URL=http://localhost:4200 npm run smoke:numeric-estimate -w @arsnova/frontend
BASE_URL=http://localhost:4200 npm run smoke:host-music -w @arsnova/frontend
BASE_URL=http://localhost:4200 TRPC_URL=http://localhost:3000/trpc npm run smoke:host-phase-controls -w @arsnova/frontend
BASE_URL=http://localhost:4200/de TRPC_URL=http://localhost:3000/trpc npm run smoke:presenter-viewports -w @arsnova/frontend
BASE_URL=http://localhost:4200/de TRPC_URL=http://localhost:3000/trpc npm run smoke:session-question-progress -w @arsnova/frontend
BASE_URL=http://localhost:4200 npm run smoke:unified-session -w @arsnova/frontend
BASE_URL=http://localhost:4200 TRPC_URL=http://localhost:3000/trpc npm run smoke:product-feedback -w @arsnova/frontend
BASE_URL=http://localhost:4200 TRPC_URL=http://localhost:3000/trpc SMOKE_ARTIFACT_DIR=tmp/product-feedback-in-app-e2e npm run smoke:product-feedback-in-app -w @arsnova/frontend
BASE_URL=http://localhost:4200 npm run e2e:confidence-summary-demo -w @arsnova/frontend
```

`smoke:host-phase-controls` benötigt den lokalisierten Build und prüft sechs
Konfigurationen nacheinander: de/en/fr/es/it, 320/600/840/1440 CSS-Pixel,
Spielerisch/Seriös und Light/Dark bei reduzierter Bewegung. Echte Host-Buttons
steuern LOBBY bis FINISHED einschließlich Peer Instruction und zweiter Runde.
Der Smoke prüft Reflow, vollständige Beschriftungen, Tastaturfokus nach Menü-
und Dialogabbruch sowie die Export-Einstiegspunkte; er erzeugt keine PDF-Dateien.
`SMOKE_ARTIFACT_DIR` legt das Verzeichnis für Lobby-, Diskussions- und
Abschlussbilder fest. Er ist ein gezielter lokaler Zusatzlauf, kein neuer
Required-Check.

`smoke:host-qa-feedback-tools` prüft Slice 4 von #470 gegen lokalisierte Builds und echte lokale Backend-Dienste. Sechs Kontexte laufen nacheinander: de/en/fr/es/it, 320/600/840/1440 CSS-Pixel, beide Presets und Light/Dark; fünf mit reduzierter Bewegung, Italienisch ohne Bewegungsreduktion. Geprüft werden Q&A leer/mit Fragen, Vormoderation, alle vier Sortierungen, aufklappbare Werkzeuge und einzeln lösbare aktive Filter, Teilnahmeverzeichnis, Wortwolke, CSV und Kompass. Blitzlicht umfasst Tempo, Stopp/Fortsetzen, Live-Ergebnisse, Formatwechsel und dessen Sperre, Vergleichsrunde, Reset, Fehler/Retry, Reload und im Desktopfall Offline/Online mit Übernahme eines zwischenzeitlich geänderten Serverstands. Der deutsche Desktopfall prüft zusätzlich die Identitätssperre nach Join und weiterhin erlaubte Moderation nach einer echten Q&A-Frist. Fokusprüfungen verlangen ein sichtbares Ziel innerhalb des Viewports ohne verdeckendes Element. Der Smoke erzeugt Sessions per API; Startseiten-Chips und Beides bleiben eigene Home-/Session-Regressionen.

```bash
BASE_URL=http://localhost:4173/de TRPC_URL=http://localhost:3000/trpc SMOKE_ARTIFACT_DIR=/private/tmp/host-qa-feedback-tools npm run smoke:host-qa-feedback-tools -w @arsnova/frontend
```

`smoke:host-home-entry` ergänzt die API-basierten Startzustände um echte Startseitenabläufe für #470. Anfangs ist keine Host-Karte sichtbar. Alle vier Blitzlicht-Chips werden nach Auswahl von **Blitzlicht starten** in sechs isolierten Sprach-/Preset-/Viewportkontexten angeklickt. Der Test zählt `session.create`-Requests, prüft den aktiven Kanal und Rundentyp serverseitig und verlangt bei `quickFeedback.create` die Bindung an genau die UI-erzeugte Session. Bei 320 CSS-Pixeln prüft der Q&A-Ablauf außerdem Enter und Space auf der Aufgabenwahl, dass der Fokus auf dem aktiven Tab bleibt, und den nächsten Tab zur ersten Aktion der eingeblendeten Karte. Bei 1024 × 768 CSS-Pixeln muss die Zielkarte mit mindestens 8 Pixel Abstand unter der fixierten Appbar beginnen. Hinzu kommen das Pulldown für mehr als zwei offene Q&A-Sessions mit Abbruch, Löschfehler, erfolgreichem Löschen und dem Übergang von drei auf zwei Direktzugänge, EVENT-Beides über Teilnahmeprofil und Zugangskarte (serverseitige INITIAL-Defaults, kein zusätzlicher Q&A-Konfigurationsdialog), Aktivierungsfehler mit Q&A-Teilerfolg und Retry, Abbruch in beiden Schritten, Reload/neuer Tab sowie CLASSROOM über Quizimport, Auswahl, eigenes letztes Quiz und zwei Fragen bis zum Gesamtende. Sessionstarts erfolgen ausschließlich durch die UI; API-Teilnahmen dienen als Identitätsregression beim Formatwechsel und ermöglichen die Quiz-Gesamtauswertung. Screenshots enthalten keine Zugangskarten. Der lokale Zusatzlauf benötigt denselben lokalisierten Build und dieselben Dienste wie die anderen Host-Smokes; kein neuer Required-Check.

```bash
BASE_URL=http://localhost:4200/de TRPC_URL=http://localhost:3000/trpc SMOKE_ARTIFACT_DIR=/private/tmp/host-home-entry npm run smoke:host-home-entry -w @arsnova/frontend
```

Die vollständige Zuordnung von Anforderungen, Implementierung und Prüfpfaden steht in [Host-Führung](ui/HOST-FUEHRUNG.md); aktuelle Ergebnisse und verbleibende manuelle Aufgaben im [Slice-5-Protokoll](implementation/HOST-SCENARIO-470-SLICE-5.md). Ein Browserlauf nach API-Setup, ein Komponententest, eine visuelle Sichtprüfung und eine Screenreader-Abnahme sind unterschiedliche Nachweisarten. 320-CSS-Pixel-Reflow ersetzt keinen tatsächlichen 400%-Browserzoom.

Mit `PRESENTER_VIEWPORT_SCREENSHOTS=1` speichert der Presenter-Smoke auch bei
erfolgreichen Prüfungen alle vier Screenshots. Das Zielverzeichnis lässt sich
über `PRESENTER_VIEWPORT_ARTIFACT_DIR` festlegen. Standardmäßig nutzt der Smoke
Kindergarten-Tierpseudonyme. Über `PRESENTER_NICKNAME_THEME` lassen sich
alternativ `MIDDLE_SCHOOL`, `HIGH_SCHOOL` oder `NOBEL_LAUREATES` prüfen;
`PRESENTER_ANONYMOUS_MODE=1` aktiviert die anonymen Eingangsnummern. Für die
nummerierten Packed-Modi validiert der Smoke zusätzlich Theme-Icon und
Beitrittsreihenfolge. `PRESENTER_COLOR_SCHEME=dark` prüft dieselben Viewports
mit dem dunklen Material-Theme. Über `PRESENTER_PARTICIPANT_COUNT` lässt sich
die Lobby für manuelle Dichteprüfungen auf bis zu 500 Personen skalieren;
`PRESENTER_MOTIF_IMAGE_URL` ergänzt dabei ein Quiz-Motiv. Für reproduzierbare
Screenshots kann `PRESENTER_MOTIF_IMAGE_FILE` die HTTPS-Ressource lokal
erfüllen; der Smoke wartet auf die vollständige Bilddekodierung und prüft die
Motiv-Geometrie.

Der Confidence-E2E lädt das deutsche Demo-Quiz hoch, lässt standardmäßig 30 Teilnehmende
mit reproduzierbar zufälligen Sicherheitsgraden abstimmen und prüft anschließend
Session-Summary, Quiz-Historienzugriff, Host-Abschlussansicht und CSV-Export. Der Seed ist
über `CONFIDENCE_SEED` anpassbar; der Host-Screenshot wird standardmäßig im temporären
Verzeichnis `arsnova-confidence-summary-demo-e2e` abgelegt.
Bei einer bereits laufenden Demo-Session kann `DEMO_QUIZ_HISTORY_SCOPE_ID` auf eine
neue UUID gesetzt werden. So erhält der Prüflauf ein eigenes Quiz, ohne die
vorhandene Session zu beenden; der feste Standardwert bleibt für bewusste
Wiederverwendung erhalten. Fehler der Host-UI-/CSV-Prüfung führen zu einem
Fehlercode, auch wenn die erzeugte Session weiterhin für die Fehlersuche verfügbar ist.

Für Performance-/Lastarbeit ist [PERFORMANCE-TESTING.md](PERFORMANCE-TESTING.md) das aktuelle Inventar. Die Classroom-Szenario-Smokes (`load:smoke:*-classroom-30`, inkl. WebSocket Vote-Progress, Reconnect-Welle, Q&A-/Blitzlicht-Fan-out sowie Host-Pairing Security/Cap) laufen in CI im Job `classroom-smokes`; schwere Last-Smokes (200–600 TN), Yjs, Soak und k6-Produktion bleiben manuell/Schedule. Der mit PR [#165](https://github.com/kqc-real/arsnova.eu/pull/165) bereitgestellte Demo-Classroom-Dauerlauf ist davon getrennt: **lokal validiert**, ausschließlich manuell lokal und kein PR-Gate. Praktikums-Einstieg: [`docs/praktikum/HANDOUT-LAST-UND-PERFORMANCE-TESTS.md`](praktikum/HANDOUT-LAST-UND-PERFORMANCE-TESTS.md).

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

### Produktions-Compose mit Replikaten

`node --test scripts/deploy/deploy-by-digest.test.mjs` prüft die aufgelösten
Compose-Profile, die Nginx-Upstreams und das Deploy-Gate bei aktiven
Replikaten. Für den isolierten lokalen Lauf den Zustandswechsel
`single → dual → triple → dual → single` ausführen. Nach jedem Wechsel
HTTP, tRPC-WebSocket und den DB-Pool prüfen. In beiden Replikamodi einen
Vote auf A und den vollständigen Host-Fortschritt auf einer anderen App
prüfen. Yjs muss vor und nach der Umschaltung per Nginx erreichbar sein und
bei einer Rotation über eine Replika den alten Socket schließen.
[Produktions-Runbook](operations/PRODUCTION-REPLICAS.md).

### Rollout der Produktions-Sidecars

`node --test scripts/deploy/text-sidecar-rollout.test.mjs scripts/ci/staging-text-analysis.test.mjs`
prüft den Deploy-Zustand, die unveränderlichen Image-Referenzen, den
automatischen Restore und die Locale-Verträge. Beim isolierten
Zielhost-Smoke einen frischen Compose-Projektnamen, separate Volumes und
die Produktions-Compose-Services mit eigenem internen Netz verwenden.

1. Beide Apps und die bisherigen Sidecars starten. Die Container- und
   Image-IDs erfassen.
2. Einen Kandidaten mit aktuellem spaCy und altem Encoder anwenden.
   Der Vorlauf muss Französisch ablehnen und beide ursprünglichen
   Image-IDs wiederherstellen.
3. Beide aktuellen Images anwenden. Alle fünf Locales müssen aus beiden
   Apps bestätigt sein. Im Statusfile müssen beide geprüften Digests stehen.
   Die Image-Halter im Zustand `created` müssen das aktuelle Paar und das
   Rollback-Paar referenzieren.
4. Dasselbe Paar erneut anwenden. Beide Sidecar-Container und das vorige
   Rollback-Paar müssen erhalten bleiben.
5. Einen unterbrochenen Wechsel in Staging nachstellen. `--recover`
   muss das gespeicherte Paar wiederherstellen. Anschließend muss
   `--rollback` zu den ursprünglichen Image-IDs zurückkehren.
6. In jeder Phase prüfen, dass die App-IDs erhalten bleiben und ihre
   HTTP-Readiness nach dem Wechsel erreichbar ist.

[Sidecar-Runbook](operations/PRODUCTION-TEXT-SIDECARS.md).

### Staging-Compose mit zwei Apps

Das [Staging-Runbook](operations/STAGING-COMPOSE.md) beschreibt den lokalen
HTTPS-Start, die automatischen Readiness-Gates und den Rückweg auf App A.
Bei einem Compose-Smoke beide Upstreams für HTTP und tRPC-WebSockets
bestätigen, eine Sessionänderung und einen Vote über Replikatgrenzen
beobachten und beim Rollback einen WebSocket erneut verbinden. Das
Routing nach einem Nginx-Neustart prüfen und B anschließend wieder
über `up` aufnehmen. Der [Yjs-Abschnitt](operations/STAGING-COMPOSE.md#yjs-relay-und-token-rotation)
beschreibt den Sync über WSS, den Widerruf alter Tokens und den
Reconnect einschließlich Offline-Änderungen nach einem Relay-Neustart.

### Gemischtes Lastprofil mit dem Demo-Quiz in fünf Sprachen

Das 45-Minuten-Profil nutzt zwei Staging-Apps mit je 30 DB-Verbindungen,
Nginx und Redis Pub/Sub. Es umfasst 20 Räume, 230 Teilnahmen und 730
Quizstimmen in 65 Runden. Die Räume
starten je Sprache gestaffelt im angegebenen Minutenfenster und bleiben
jeweils bis zu zwölf Minuten aktiv. Damit überlappen höchstens zwei
Sprachgruppen. Die Startfenster sind Annahmen für den Lasttest.

| Locale | Startminute | Räume und Teilnahmen                                |
| ------ | ----------- | --------------------------------------------------- |
| `de`   | 0–1         | Quiz mit Q&A × 20, drei Quizräume × 6               |
| `en`   | 8–9         | Q&A × 20, zwei Quizräume × 6, Beitritt × 6          |
| `fr`   | 16–17       | Q&A × 20, zwei Quizräume × 6, Beitritt × 6          |
| `es`   | 24–25       | Q&A × 20, zwei Quizräume × 6, Beitritt × 6          |
| `it`   | 32–33       | Quiz mit Q&A × 60, zwei Quizräume × 6, Beitritt × 6 |

Die Quizräume verwenden die jeweilige Fassung
`apps/frontend/src/assets/demo/quiz-demo-showcase.<locale>.json`.
Für dieses Profil fünf Originalfragen aus der Demo auswählen
(`order` 0, 1, 3, 4 und 5). Bei der Übernahme ihre relative Reihenfolge
und Antwortdaten beibehalten und `order` lückenlos neu vergeben. Die
Abstimmungen starten innerhalb eines Raums in kurzen Wellen, zwischen
Räumen versetzt. Der vorhandene Runner
`scripts/load/demo-quiz-classroom-30.mjs` lädt über
`QUIZ_CONTENT_LOCALE` das vollständige 13-Fragen-Demo-Quiz für den
separaten Einraumtest.

Pro Sprache den Freitext der Demo-Quiz-Frage zum Lernen in einem
Quizraum auswerten, in `de` und `it` im kombinierten Raum. Pro
Sprache im Q&A-Raum zusätzlich sechs sichtbare Fragen zum Demo-Quiz
und sechs Bewertungen erzeugen. Für Freitext und Q&A synthetische
Beiträge in der jeweiligen Sprache mit mehreren paraphrasierten
Beiträgen je Thema verwenden. Geeignete Themen sind Lernstrategien
für Freitext sowie Timer, Fragetypen und Ergebnisansicht für Q&A.

#### Zehn Aufrufe des Moderationskompasses

Je Sprache den Kompass einmal im Q&A-Kanal nach Eingang der sechs
sichtbaren Fragen und einmal in einem separaten Quizraum nach Freigabe
eines Ergebnisses öffnen. Für `de` und `it` den ersten Aufruf im Q&A-Kanal
des kombinierten Raums ausführen. Die Minuten sind Richtwerte ab Laufstart.
Bei später verfügbaren Signalen im selben Raum auf die jeweilige Phase
warten. Insgesamt zehn verschiedene Sessions verwenden.

| Locale | Minute im Q&A-Kanal | Minute im separaten Quizraum |
| ------ | ------------------- | ---------------------------- |
| `de`   | 3                   | 6                            |
| `en`   | 11                  | 14                           |
| `fr`   | 19                  | 22                           |
| `es`   | 27                  | 30                           |
| `it`   | 35                  | 38                           |

Den Host-Dialog im Browser über `host-moderation-compass` öffnen. Zeit
vom Klick bis zum sichtbaren Dialog, Karten und gültige Quellen der
jeweiligen Session erfassen. Andere Räume bleiben währenddessen aktiv.
Die Karten nutzen vorhandene Host-Signale. Die Öffnung liest den
Zusammenfassungsstatus und startet selbst keine Inferenz. In den fünf
Q&A-Räumen den unten vorgesehenen Zusammenfassungsauftrag ausdrücklich
im selben Dialog starten. Keine zusätzlichen Zusammenfassungen für die
fünf Quizräume anfordern.

#### Analyseaufträge pro Sprache

| Pfad                       | Auslösung                                                                                                                                   | Nachweis                                                                                                                                                                |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Freitext-Wortwolke         | Die Antworten per `session.getLiveFreetext` lesen und per `wordCloud.analyze` mit `LEXICAL` und `LEMMA` auswerten                           | `normalizationApplied: LEMMA` und Modellkennung der Locale                                                                                                              |
| Q&A-Wortwolke              | `wordCloud.analyzeQa` mit `ALL_ELIGIBLE`, `LEXICAL` und `LEMMA` ausführen                                                                   | Sichtbarer Korpus der Session und angewandte Glättung                                                                                                                   |
| Themen in Freitext und Q&A | Beide Wortwolken mit `SEMANTIC` und `normalization: NONE` ausführen                                                                         | Encoder-Ergebnis und mindestens ein per LLM benanntes Thema mit `labelOrigin: model`. Einen aktuellen Runtime-Aufruf über Metadaten belegen                             |
| Q&A-Zusammenfassung        | Nach der Q&A-Themenanalyse im Kompass über `qa.requestSummary` via Nginx starten und `qa.summaryRuntime` mit Host-Berechtigung auf B prüfen | Statusübergang bis zum Ergebnis mit passender Locale und gültigen Quellen. Für den Modellnachweis `execution.effectiveMode: full-context` und den Runtime-Aufruf prüfen |

Pro Sprache zwei spaCy-Aufrufe, zwei Themenanalysen mit Label-Auftrag und
eine Zusammenfassung einplanen. Die Host-Aktionen innerhalb desselben
Raums nacheinander ausführen. Andere Räume stimmen während der Analysen
weiter ab. Cache-Treffer und Fallbacks im Bericht ausweisen. Für jeden
der drei LLM-Pfade pro Sprache mindestens einen frischen Modelllauf
bestätigen.

In den kombinierten Räumen bei laufender Zusammenfassung den nächsten
Quiz-Fragenwechsel bis zur fertigen Zusammenfassung verschieben. So bleibt
der autorisierte Kontext während der Inferenz stabil. Die Wartezeit
separat erfassen.

#### Lernzielableitung aus dem Demo-Quiz

Pro Lastlauf einen Lernzielauftrag einplanen, optional einen zweiten in
einer anderen noch aktiven Demo-Session. Im Standardablauf den ersten
Auftrag in einem separaten `de`-Quizraum auf A starten, den zweiten
bei freiem Slot in einem `it`-Quizraum auf B. Die gewählten Locales in
Folgeläufen wechseln. Je Auftrag eine bewertbare Demo-Frage (`order` 3
in der Quelldatei) mit ihrer Session-Frage-ID und der Raum-Locale
verwenden. Vor `session.deriveLearningObjectives` als Host die aktuelle
`learningContextRevision` über `session.getLearningObjectives` lesen und
für die Ableitung eine frische `operationId` verwenden.

Für den Konflikttest während der ersten Ableitung, sobald A den
Redis-Slot nachweislich hält, einen zusätzlichen Q&A-Themenauftrag aus
dem anderen Raum über B starten. Die reguläre Themenanalyse der Sprache
separat bei freiem Slot ausführen. Im Konflikt genau einen Inferenz-POST
und für B `labelOrigin: extractive` prüfen.

Für jeden Lernzielauftrag Dauer und Runtime-Aufrufe erfassen. Bei
`status: completed` mit `appliedCount > 0` über die jeweils andere App
die gespeicherten Entwürfe (`origin.kind: model-derived`,
`confirmation.state: draft`), die Referenz zur Demo-Frage und die um eins
erhöhte Revision prüfen. Bei `busy` unveränderte Lernziele und Revision
prüfen und das Ergebnis als belegten Slot erfassen.

Für den Lauf `STAGING_TEXT_ANALYSIS=true` und die versionierten Sidecar-Images
verwenden. Der Staging-Wrapper bestätigt vor der Nginx-Aktivierung die
Lemmatisierung und den Encoder-Zugriff in allen fünf Sprachen aus beiden
Apps. Für Modell-Aufträge den privaten LLM-Endpunkt einrichten und
`STAGING_LLM_ENABLED=true` sowie `STAGING_QA_SUMMARY_ENABLED=true` setzen.
[Staging](operations/STAGING-COMPOSE.md#optionaler-aufbau-für-die-textanalyse),
[LLM-Slot](features/open-weight-llm-runtime.md#laufzeitvertrag).

Im Bericht Join- und Vote-p95, vollständigen Stimmenstand am Host,
WebSocket-Fehler und CPU/RAM der Staging-Dienste festhalten. Für die
Analyseaufträge pro Locale Dauer, angewandten Modus, Runtime-Aufrufe,
Cache-Treffer und Fallback-Grund erfassen. Für die Zusammenfassung
Aufnahmezeit und Zeit bis zum Ergebnis getrennt messen. Der Hörsaaltest
mit 1 × 500 und der Stresstest mit 30 × 30 ergänzen dieses Mischprofil.

#### Zielhostmessung mit den aktualisierten Sidecars

Am 21. November 2026 lief das Profil für 45 Minuten im isolierten Staging
auf 8 vCPUs und 15,22 GiB RAM. Beide Apps nutzten `679b89344a3d` und je
30 DB-Verbindungen. Qwen3-4B-Instruct-2507 (Q4_K_M) lief in einer separaten
Runtime mit vier Threads auf dem privaten Modellhost.

| Messgröße                                  | Vorheriger Lauf | Aktualisierte Images |
| ------------------------------------------ | --------------: | -------------------: |
| Join p95                                   |        493,8 ms |             475,6 ms |
| Quiz-Vote p95                              |        107,3 ms |             102,5 ms |
| Host-WebSocket p95 ab letzter Vote-Antwort |        148,5 ms |             149,0 ms |
| Zielhost-CPU p95 / Spitze                  |   25,3 / 76,4 % |        24,2 / 73,3 % |
| Zielhost-RAM-Spitze                        |        7,06 GiB |             7,26 GiB |

PostgreSQL bestätigte 20 Sessions, 230 Teilnahmen, 730 Quizstimmen,
30 Q&A-Fragen und 30 Q&A-Bewertungen. Alle 65 vollständigen Stimmenstände
kamen am Host-WebSocket an. Die zehn Kompassaufrufe dauerten 87–143 ms.
Alle zehn Lemmatisierungen, alle zehn Themenanalysen mit generativen Labels
und alle fünf Vollkontext-Zusammenfassungen mit gültigen Quellen gelangen.
Beide Lernzielaufträge speicherten je einen auf der anderen App lesbaren
Entwurf. Der deutsche Quizraum wartete 9,6 s mit dem nächsten Fragenwechsel.
Die Zielhostwerte enthalten die übrige Hostlast. Der vorherige Lauf nutzte
einen Encoder für Deutsch und Englisch sowie spaCy ohne italienische
Lookup-Tabelle. Die beiden Läufe belegen die beobachteten Werte je Aufbau.

### Gebündelte Joins und Votes im Replikabetrieb

Für den Replikabetrieb laufen die Choice-Vote-Regressionen mit PostgreSQL.
Sie prüfen gebündelte Tokenprüfung, idempotente Vote-IDs, Antwortoptionen
und die Outbox für Runde 1. Ein paralleler Host-Lock betrifft nur den
jeweiligen Raum. Die anderen Räume im Batch können weiter speichern.

```bash
RUN_PG_SESSION_RACE_TESTS=1 npm run test -w @arsnova/backend -- \
  src/__tests__/session.finalization-race.pg.test.ts
```

Der Zielhost-Vergleich verwendet insgesamt 60 DB-Verbindungen pro
Aufbau, frische Daten und dieselben 500er- und 30 × 30-Profile.
Bei der Profilierung Nginx- und Node-Zeitmarken pro Request korrelieren,
damit die Zeit bis zum HTTP-Handler von der DB-Zeit im Handler getrennt
bleibt. Bei einem Transportvergleich dieselbe TLS-Zertifikatsart und
dieselbe CPU-Zuteilung für beide Aufbauten verwenden.

### Kaltstart bei 500 gleichzeitigen Joins

Der erste 500er-Join beginnt nach der Readiness frisch erstellter
App-Container. Vor diesem Lauf keine Probe-Joins ausführen. Das
Hörsaalprofil startet die 500 HTTP-Requests gemeinsam und öffnet nach
jeder Join-Antwort den Teilnehmer-WebSocket. Für den Vergleich TLS,
CPU-Zuteilung, Compose-Topologie und DNS-Verhalten des Lastgenerators
gleich halten. Bei einem gesonderten Test mit voraufgelöstem Hostnamen
weiterhin TLS mit Hostnamen prüfen und die Messreihe separat ausweisen.

Die Join-Migration bündelt Teilnehmernummern, Inserts und Revision. Mit
PostgreSQL und Redis die Nummern, den ersten Join-Zeitstempel, die
Teilnehmerrevision, Konflikte innerhalb einer Gruppe und die
Replay-Capabilities prüfen.

```bash
RUN_PG_CAPABILITY_TESTS=1 npm run test -w @arsnova/backend -- \
  src/__tests__/session.capabilities.pg.test.ts
```

### Live-Signale über Redis Pub/Sub

Der gezielte Backend-Test für diesen optionalen Statuspfad prüft eigene und
fremde Signale, Redis-Fehler, Commit-Reihenfolge sowie das Nachlesen über den
bestehenden Fallback.

```bash
npm run test -w @arsnova/backend -- src/lib/sessionStatusPubSub.test.ts src/__tests__/session.enable-channels.test.ts src/__tests__/session.current-question-host.test.ts
```

Für die Staging-Abnahme `SESSION_STATUS_PUBSUB_ENABLED=true` auf beiden Apps
setzen. Den Status über App A ändern und `session.onStatusChanged` auf B
beobachten. Bei unterbrochenem Subscriber muss der nächste reguläre
Lese-Fallback den aktuellen Zustand liefern. Nach Wiederanbindung einen
weiteren Wechsel über A auslösen und die direkte Zustellung auf B nachweisen.

Im Replikabetrieb teilen die Apps auch die Werte hinter den
Presenter-Signalen. Der Redis-Integrationstest nutzt zwei unabhängige
Client-Instanzen und prüft Seitenwechsel, Q&A-Filter, Emoji-Ersetzungen
sowie das Löschen und Abweisen verspäteter Writes.

```bash
RUN_REDIS_SESSION_REPLICA_TESTS=1 REDIS_URL=redis://127.0.0.1:6379 \
  npm run test -w @arsnova/backend -- src/lib/sessionReplicaState.redis.test.ts src/lib/trpcWebSocketClusterBudget.redis.test.ts
```

Für die Abnahme mit zwei Prozessen die Presenter-Fläche auf A ändern,
das Status-Abo auf B beobachten und denselben Seitenkontext für je einen
Seitenschritt an A und B senden. Eine Reaktion auf A setzen, auf B lesen,
dort mit demselben Teilnahmetoken ersetzen und auf A die neue Verteilung
bei unveränderter Gesamtzahl prüfen.

Für die Abschlussprojektion eine Quiz-Session auf A beenden und die
Rangliste am Status-Abo auf B abwarten. Die Rangliste auf A ausblenden.
B muss nach dem Redis-Signal auf `idle` wechseln. Beim zweiten Durchgang
nur das Publish der Statusnachricht unterbrechen. B muss die bestätigte
Änderung beim nächsten Zehn-Sekunden-Fallback aus Redis übernehmen.

Für den Vote-Fortschritt `session.onHostVoteProgressChanged` mit einem
gültigen Host-Token auf B öffnen. Für dieselbe Session parallel auf A und
B abstimmen, danach eine weitere Stimme nach Veröffentlichung des ersten
Signals senden. Die Redis-Nachrichten auf
`arsnova:session:vote-progress:v1` zählen. Die erste Gruppe wird
instanzübergreifend gebündelt und die spätere Stimme aktualisiert den Host
erneut vor dem Polling. Eine idempotente Wiederholung erzeugt keinen neuen
Vote und kein neues Signal. Bei unterbrochenem Subscriber muss das Host-Abo
nach Ablauf des Aggregatcaches über den regulären Lese-Fallback aufholen.
Für das Vote-Rate-Limit zwei gleichzeitige Anfragen derselben Teilnahme-ID
an getrennte Apps senden. Beim Standardwert wird genau eine zugelassen.
Jede Teilnahme-ID hat auch hinter derselben NAT ein eigenes Budget.
Mit dem Limit zwei müssen drei gleichzeitige Anfragen für dieselbe ID
genau zwei Zulassungen und eine Ablehnung mit einer Sekunde Wartezeit
ergeben. Nach Ablauf des Fensters ist dieselbe ID wieder zulässig.

Für Join und Q&A die geschützten Host-Abos `session.onParticipantJoined`
und `qa.onQuestionsUpdated` auf B öffnen und den jeweiligen
Ausgangssnapshot abwarten. Danach auf A einen Join und eine neue Frage
auslösen. B muss die aktuelle Teilnehmerzahl beziehungsweise Q&A-Revision
vor der nächsten periodischen Abfrage senden. Die Frage anschließend mit
gültigem Host-Token über `qa.list` auf B lesen.
[Staging-Messung](operations/STAGING-COMPOSE.md#lokaler-test-von-a-nach-b)

### Artillery-Lasttest (Realtime, bis 500 TN)

Unified Live-Session: Join-Welle, Quiz-Vote, Q&A (20 %), Blitzlicht, WebSocket-Status/Host-Progress, Ergebnis-Fan-out.

```bash
npm run dev:backend
PARTICIPANTS=500 npm run load:artillery:500
# bestehende Session (Join, Q&A, Blitzlicht, WS); RESULTS überspringt Votes:
SESSION_CODE=AB12CD PARTICIPANTS=500 npm run load:artillery:500
```

Skripte: [`scripts/load/run-artillery-500.mjs`](../scripts/load/run-artillery-500.mjs), [`scripts/load/artillery/500-live-session.yml`](../scripts/load/artillery/500-live-session.yml). CI-Job `artillery-500` (Schedule/Manuell, Standard 100 TN auf Runner).

Der [lokale 500er-Vergleich mit kaltem Cache](PERFORMANCE-TESTING.md#vote-countdown-mit-500-gleichzeitigen-stimmen-und-kaltem-cache-2026-11-16)
ist eine separate Messreihe mit echten Countdown-Bildabrufen, einer
gleichzeitigen Stimmwelle und A/A-Kontrollläufen zur Einordnung der Latenzstreuung.

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

### Host-Pairing DoD (Story 2.10 Slice 5)

Missbrauchs- und Cap-Nachweise gegen ein laufendes Backend:

```bash
npm run dev:backend
npm run load:smoke:host-pairing-security
npm run load:smoke:host-pairing-classroom-30
```

Der Security-Lauf prüft öffentlich Pending→Reject ohne Token, Privat ohne Approve,
Cap 3 inkl. Freigabe nach Widerruf sowie Approve→Host-Aktion→sofort totes HTTP/WS.
Der Classroom-30-Lauf hält Original-Host + 3 Paired Hosts + Presenter-Status,
joint 30 Teilnehmende vom selben Runner (Shared-NAT), sendet eine Vote-Welle,
reconnectet einen Paired Host, wechselt den Presenter-Kanal und widerruft unter
noch verbundenen Teilnehmenden. CI führt beide im Job `classroom-smokes` aus.

Browser-Smoke mit getrennten Kontexten (Original-Host, Smartphone, Presenter):

```bash
BASE_URL=http://localhost:4200/de TRPC_URL=http://localhost:3000/trpc \
  npm run smoke:host-pairing-security -w @arsnova/frontend
```

Der 500er-Cap-Worst-Case ist **kein PR-Gate**. Operatorbefehl:

```bash
npm run dev:backend
PARTICIPANTS=500 npm run load:smoke:host-pairing-cap-500
```

Protokoll, Locale-Review und Usability-Vorlage:
[HOST-PAIRING-2.10-SLICE-5-DOD.md](implementation/HOST-PAIRING-2.10-SLICE-5-DOD.md).

Lokaler Nachweis 2026-09-07: Security-E2E bestanden (`K7E7GE`/`8LUY48`).
Classroom-30 bestanden (`ZB2P7P`, Vote-p95 51 ms). 500er-Cap bestanden
(`NKDM5P`, 500 Joins/Votes, Vote-p95 512 ms, 0 Fehlvotes, Host-Progress 4
Messages, Current-Question nicht geflutet, Widerruf beendete die Host-WS).
Browser-Smoke bestanden (`YEJDNT`). Der 500er bleibt kein CI-/PR-Gate.

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
Der Nightly vom 2026-09-08 scheiterte fachlich: 543/600 Karenz-Votes mit
`Unable to start a transaction in the given time` (57×). Ursache war der
node-pg-Default-Pool (10 Verbindungen) plus Prisma-`maxWait` 2 s. Der Vote-Hotpath
wartet jetzt 10 s auf einen Pool-Slot, der Pool defaultet auf 40 Verbindungen
(`DATABASE_POOL_MAX`, Cap 80 unter Postgres-Default `max_connections=100`).

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

### Hörsaalprojektion und Host-Seitensteuerung (#473)

Bei laufendem lokalem Backend und lokalisiertem Frontend-Build:

```bash
BASE_URL=http://localhost:4200 TRPC_URL=http://localhost:3000/trpc \
  PROJECTION_LOCALES=de,en,fr npm run smoke:projection-pages -w @arsnova/frontend
BASE_URL=http://localhost:4200 TRPC_URL=http://localhost:3000/trpc \
  npm run smoke:presenter-scenarios -w @arsnova/frontend
```

Die Skripte erzeugen ausschließlich Test-Sessions auf der angegebenen Instanz.
Der Browser und die Test-API müssen über HTTP und tRPC-WebSocket dieselbe
Backend-Instanz erreichen, damit Projektionsseiten denselben Kontext verwenden.
Nicht gegen Produktion ausführen. Sie prüfen 720p, 1080p und 1920 × 1200 in beiden
Presets. Das erste prüft den vollständigen Text einschließlich Code, die
Navigation per Host-Befehl und Presenter-Tastaturbedienung sowie die
Wiederherstellung nach Reload. Zusätzlich prüft
es acht gleichzeitig sichtbare Antwortoptionen in Abstimmung und Ergebnisansicht
einschließlich Schriftgröße, Ergebnisbalken und Korrektheitsmarkierung. Das zweite prüft
Lobby 0/10/200, Schätzverteilung mit Statistik, Freitext-Wortwolke, angeheftete
Q&A-Frage mit Warteschlange, verborgenes/freigegebenes Blitzlicht und Rangliste.
Für Schätzfragen liest es die sichtbaren Projektionsseiten über die
Seitenanzeige im Quiz-Footer aus. Es prüft dabei auch die Stichprobengröße
der Statistik, die bei wenig Platz auf einer späteren Seite steht.
Der Fall `quiz-history-live-vote` prüft die Pfeiltasten für den Ergebnisrückblick
und die Rückkehr zur Live-Ansicht. Während der Presenter ein früheres Ergebnis
zeigt, nimmt das Backend eine Stimme für die unveränderte Live-Frage an. Der
Komponenten-Regressionsfall deckt zusätzlich dieselben eingeblendeten Symbole,
die Host-Seitensteuerung und den lokalen Host-Rückblick bei unveränderter
laufender Abstimmung ab.
Screenshots liegen unter `tmp/projection-pages` bzw. `tmp/presenter-scenarios`
(im Arbeitsverzeichnis); `SMOKE_ARTIFACT_DIR` überschreibt den Pfad.
`PROJECTION_DELAYED_MEDIA=1` hält drei Bilder im Fragetext bis nach der ersten
Seitenberechnung zurück und prüft Neumessung sowie vollständige Bilddarstellung.
`PROJECTION_THEME=dark` prüft das dunkle Theme. `PROJECTION_PRESETS` und
`PROJECTION_SIZES` begrenzen den ersten Lauf; `PROJECTION_SCENARIOS` wählt im
zweiten Lauf einzelne Zustände aus (zum Beispiel `numeric-results,freetext-results`).
`PROJECTION_SMOKE=1 PROJECTION_LOCALES=de` begrenzt den zweiten Lauf auf einen
720p-Fall pro Zustand. Native Vollbildberechtigung wird in diesen
Geometrieprüfungen simuliert; Dialog-/Popup-/Guard-Tests prüfen den Einstieg separat.
Die reale HDMI-Probe aus der letzten Reihe bleibt eine zusätzliche manuelle Abnahme.
