<!-- markdownlint-disable MD013 -->

# Tests & CI — Referenz

**Lokal** vor PR: mindestens `npm run build`, `npm run lint`, `npm test` (entspricht den wesentlichen CI-Gates). Vollständige DoD: [Backlog.md](../Backlog.md) „Definition of Done“. Nach größeren Änderungen an **`@arsnova/shared-types`**: wie in Root-[README](../README.md) zuerst `npm run build -w @arsnova/shared-types` bzw. Root-`npm run build` nutzen.

**Stand:** 2026-04-01 · Workflow: [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) (Node **20** und **22**; Jobs: `build`, `typecheck`, `lint`, `audit` informational, `test`, `docker`, optional `deploy`)

---

## NPM-Skripte (Root)

| Befehl                 | Bedeutung                                                             |
| ---------------------- | --------------------------------------------------------------------- |
| `npm run build`        | `shared-types` → Backend `tsc` → Frontend `ng build`                  |
| `npm run typecheck`    | `shared-types` bauen (`dist`), dann Backend + Frontend `tsc --noEmit` |
| `npm run lint`         | ESLint über `libs/` und `apps/`                                       |
| `npm test`             | **Backend** Vitest + **Frontend** Vitest (sequentiell)                |
| `npm run format:check` | Prettier (ohne Schreiben)                                             |

Workspace-spezifisch:

| Workspace           | Tests                                              | Typcheck                                 |
| ------------------- | -------------------------------------------------- | ---------------------------------------- |
| `@arsnova/backend`  | `npm run test -w @arsnova/backend` (`vitest run`)  | `npm run typecheck -w @arsnova/backend`  |
| `@arsnova/frontend` | `npm run test -w @arsnova/frontend` (`vitest run`) | `npm run typecheck -w @arsnova/frontend` |

`npm run typecheck -w @arsnova/backend` setzt ein gebautes `@arsnova/shared-types` (`libs/shared-types/dist`) voraus; das Root-Skript `npm run typecheck` baut die Library zuerst.

---

## CI-Pipeline (GitHub Actions, `main`)

Auslöser: **Push** und **Pull Request** auf `main`.

| Job / Phase                            | Inhalt                                                                                                                                                                             |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **build** (Node 20 & 22)               | `npm ci` → `prisma validate` → `prisma generate` → `tsc -b apps/backend` → Frontend `tsc --noEmit` → `build:localize` (Frontend, **alle** konfigurierten Locales `de/en/fr/it/es`) |
| **typecheck** (Node 20 & 22, parallel) | `npm ci` → `prisma validate` → `prisma generate` → `npm run typecheck` (inkl. `build` für `shared-types`, dann `--noEmit`)                                                         |
| **lint**                               | `npm run lint` (nach build)                                                                                                                                                        |
| **audit**                              | `npm audit --audit-level=high` (informational, blockiert nicht)                                                                                                                    |
| **test**                               | `npm test` (nach build)                                                                                                                                                            |
| **docker**                             | Docker-Image-Build (ohne Push), nach build                                                                                                                                         |
| **deploy**                             | Nur bei Push auf `main` (oder `DEPLOY_BRANCH`) **und** Repository-Variable `DEPLOY_ENABLED=true`; läuft nach **`lint`, `test`, `docker`, `typecheck`** (alle müssen grün sein)     |

Matrix: **zwei** LTS-Versionen (**20** und **22**), `fail-fast: false`.

---

## Optionale / manuelle Checks (nicht immer CI)

| Befehl (Frontend-Workspace) | Zweck                       |
| --------------------------- | --------------------------- |
| `check:viewport`            | Viewport 320px-Smoke        |
| `smoke:quiz-sync`           | Quiz-Sync-Flow-Skript       |
| `smoke:unified-session`     | Unified-Session-Flow-Skript |
| `lighthouse:a11y`           | Lighthouse A11y (lokal)     |

Prisma-Schema lokal: `npx prisma validate` (in CI ohne DB).

`npm run build:localize -w @arsnova/frontend` ist im Repo kein nackter Angular-Build: Nach `ng build --configuration production --localize` folgen noch Post-Build-Schritte für `noscript`, `sitemap.xml`, `manifest.webmanifest`, die lokalisierten `ngsw.json` und die Root-`index.html`.

---

## Wo Tests liegen

- **Backend:** `apps/backend/src/__tests__/*.test.ts`, Vitest (u. a. Session, Vote, Rate-Limit, **MOTD/Admin-MOTD** — Epic 10).
- **Frontend:** `*.spec.ts` neben Komponenten/Services (Angular/Vitest), siehe [AGENT.md](../AGENT.md).

---

## Verwandte Dokumente

- [CONTRIBUTING.md](../CONTRIBUTING.md) — PR-Checkliste
- [ENVIRONMENT.md](ENVIRONMENT.md) — lokale Ausführung
- [README.md](../README.md) — `npm run dev`, Setup
