# Mitwirken an arsnova.eu

Dieses Projekt wird KI-gestützt weiterentwickelt. Menschen tragen Produkt-, Architektur- und Review-Verantwortung; KI-Werkzeuge wie Cursor, Copilot oder Codex helfen bei Recherche, Umsetzung und Tests. Diese Datei beschreibt den pragmatischen Einstieg für Beiträge.

**Stand:** 2026-05-31 — abgeglichen mit [README.md](README.md), [AGENT.md](AGENT.md), [docs/onboarding.md](docs/onboarding.md), [docs/TESTING.md](docs/TESTING.md), [docs/SECURITY-OVERVIEW.md](docs/SECURITY-OVERVIEW.md) und der Produktionsdoku.

---

## 1. Orientierung und Setup

1. **Projektüberblick lesen:** [README.md](README.md) erklärt Zielgruppe, Produktumfang, Betrieb und lokalen Schnellstart.
2. **Entwicklungsumgebung aufsetzen:** [docs/onboarding.md](docs/onboarding.md) führt durch Node, Docker, `.env`, Prisma, `shared-types` und `npm run dev`.
3. **Dokumentation finden:** [docs/README.md](docs/README.md) ist die Landkarte für Architektur, Sicherheit, Tests, UI, i18n, Praktikum und Betrieb.
4. **Produktionsrelevantes kennen:** Für Betreiber- oder Deploy-Änderungen zusätzlich [docs/deployment-debian-root-server.md](docs/deployment-debian-root-server.md), [docs/ENVIRONMENT.md](docs/ENVIRONMENT.md), [docs/SECURITY-OVERVIEW.md](docs/SECURITY-OVERVIEW.md), [docs/TESTING.md](docs/TESTING.md) und [docs/implementation/ADMIN-FLOW.md](docs/implementation/ADMIN-FLOW.md) lesen.

Empfohlener lokaler Start:

```bash
cp .env.example .env
npm ci
npm run setup:dev
npm run dev
```

Für den Einstieg ist Node 20 aus `.nvmrc` oder eine passende Node-22-LTS-Version der Standardweg. Windows-Nutzer:innen verwenden bitte WSL2/Ubuntu wie im Onboarding beschrieben.

---

## 2. KI-gestützt arbeiten

- [AGENT.md](AGENT.md) ist der kurze Einstieg für KI-Coding-Agents und sollte in KI-Sessions zuerst geladen werden.
- [Backlog.md](Backlog.md) bleibt die Quelle für Story-Scope, Akzeptanzkriterien und Definition of Done.
- Für KI-Kontext zusätzlich [docs/serena.md](docs/serena.md), [`.cursorrules`](.cursorrules), [`.cursor/rules/core.mdc`](.cursor/rules/core.mdc) und bei verfügbarer Serena-Integration `mem:core` beachten.
- KI-Vorschläge immer gegen Diff, Tests, Datenschutz und Architektur prüfen. Keine Secrets, lokalen `.env`-Werte oder produktiven Zugangsdaten in Prompts, Commits oder PRs übernehmen.
- Bestehende Änderungen anderer Personen nicht überschreiben. Vor größeren Edits `git status` prüfen und Diffs klein halten.

---

## 3. Umsetzung

- **Story wählen:** Mit einer offenen Must-/Should-Story aus dem Backlog starten oder eine klar abgegrenzte Wartungsaufgabe bearbeiten.
- **Schema-first:** Neue oder geänderte tRPC-Ein- und -Ausgaben zuerst in `libs/shared-types/src/schemas.ts` als Zod-Schema pflegen, dann Backend und Frontend anpassen.
- **Nur tRPC:** Keine ad-hoc REST-Endpunkte oder duplizierten DTOs einführen.
- **Berechtigungen serverseitig prüfen:** Host-, Present-, Feedback-Host- und Admin-Rechte nie aus Route, Session-Code oder Client-State ableiten.
- **Data-Stripping einhalten:** Teilnehmer-Payloads minimal halten; lösungsrelevante Felder wie `isCorrect` nicht vor der Ergebnisphase ausliefern.
- **Frontend-Konventionen:** Angular Standalone Components, Signals, Angular Material 3 Tokens, keine Tailwind-Klassen in `apps/frontend`, keine `BehaviorSubject`-State-Stores für normalen UI-State.
- **i18n vollständig halten:** User-facing UI-Texte in `de`, `en`, `fr`, `es`, `it` synchron nachziehen; Legal-Markdown bei rechtlichen Texten ebenfalls.
- **Doku mitziehen:** Wenn Verhalten, Setup, Env, Deployment, Sicherheit, Tests oder Admin-Flows geändert werden, die nächstgelegene Doku im selben PR aktualisieren.

---

## 4. Vor dem Pull Request

Mindestens prüfen:

- [ ] `npm run typecheck`
- [ ] `npm test`
- [ ] `npm run lint`
- [ ] passende fokussierte Tests für die geänderte Stelle
- [ ] bei Markdown-only Änderungen mindestens `npx prettier --check <dateien>` und `git diff --check -- <dateien>`

Je nach Änderung zusätzlich:

- [ ] Shared-Type-Änderung: `npm run build -w @arsnova/shared-types`
- [ ] UI-, Template- oder Copy-Änderung: [docs/ui/PR-CHECKLIST-UI.md](docs/ui/PR-CHECKLIST-UI.md), lokalisierte Texte und `npm run build:localize -w @arsnova/frontend` oder `npm run build:prod`
- [ ] produktionsrelevante Änderung: `npm run build:prod` und, wenn eine echte `.env.production` lokal verfügbar ist, `docker compose -f docker-compose.prod.yml --env-file .env.production config`
- [ ] Prisma-/Datenmodell-Änderung: Schema, Migration/Push-Pfad, Shared Types, Tests und betroffene Doku prüfen
- [ ] Sicherheits-/Datenschutzänderung: [docs/SECURITY-OVERVIEW.md](docs/SECURITY-OVERVIEW.md) und relevante ADRs gegenlesen

Wenn ein Check nicht sinnvoll oder lokal nicht ausführbar ist, im PR kurz begründen.

---

## 5. Branch und Pull Request

- **Branch:** z. B. `feature/1-14-word-cloud-export`, `fix/admin-legal-hold`, `docs/production-runbook`.
- **PR-Beschreibung:** Ziel, wichtigste Änderungen, verknüpfte Story/Issue, ausgeführte Checks und offene Risiken nennen.
- **UI-Änderungen:** Vorher/Nachher-Screenshots oder kurze Smoke-Beschreibung ergänzen, besonders für Mobile und lokalisierte Texte.
- **Betriebsänderungen:** Env-Variablen, Migrationsschritte, Deploy-Hinweise und Rollback-Risiken ausdrücklich dokumentieren.
- **CI:** PRs müssen grün sein. Deploys laufen nur nach den Regeln aus [docs/TESTING.md](docs/TESTING.md) und [docs/deployment-debian-root-server.md](docs/deployment-debian-root-server.md).

---

## 6. Bei Problemen

- **Setup:** [docs/onboarding.md](docs/onboarding.md), [docs/ENVIRONMENT.md](docs/ENVIRONMENT.md)
- **Architektur:** [docs/architecture/handbook.md](docs/architecture/handbook.md), [docs/architecture/decisions/](docs/architecture/decisions/)
- **Tests/CI:** [docs/TESTING.md](docs/TESTING.md)
- **UI/Design:** [docs/ui/STYLEGUIDE.md](docs/ui/STYLEGUIDE.md), [docs/ui/TOKENS.md](docs/ui/TOKENS.md), [docs/ui/PR-CHECKLIST-UI.md](docs/ui/PR-CHECKLIST-UI.md)
- **Sicherheit/Datenschutz:** [docs/SECURITY-OVERVIEW.md](docs/SECURITY-OVERVIEW.md)

Wenn du lokale Änderungen wirklich verwerfen willst, sichere vorher alles Wichtige oder sprich den Reset mit Betreuung/Team ab. `git reset --hard` löscht lokale Änderungen unwiderruflich.
