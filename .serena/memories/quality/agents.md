# AGENTS.md — kritische Agent-Regeln

Canonical file: `AGENTS.md` (Repo-Root). Bei Konflikt gilt die Datei; dieses Memory ist die dichte Arbeitsfassung.

## Always-On

- API schema-first: `libs/shared-types` → Backend → Frontend; tRPC + shared Zod; keine Ad-hoc-REST/DTO-Duplikate.
- Permissions nie aus Route/Session-Code/Room-ID/URL/Client-State allein; Host-Logik nur mit validierten Tokens (`hostProcedure` u. a.).
- Participant-Payloads minimal; kein `isCorrect`/Solution-Data bei aktiver Frage. Details: `mem:security/dto-stripping`, `mem:security/auth`.
- Effective-Vote-Regel für Peer Instruction (Scoring, Leaderboard, Bonus, Analytics, Export) erhalten.
- Frontend: Standalone, Signals, Material 3 tokens; kein `BehaviorSubject`/RxJS-Store für UI-State; kein Tailwind; kein `::ng-deep`/`:deep(...)`. UI: `docs/ui/STYLEGUIDE.md` (Style-Verträge), `docs/ui/TOKENS.md`, `docs/ui/PR-CHECKLIST-UI.md`.
- i18n sync: `de`, `en`, `fr`, `es`, `it`. WCAG 2.2 AA nicht regressieren (Keyboard, SR, Focus, Reflow, Zoom, Contrast, reduced-motion).
- Tests + Docs gehören zu Done bei Behavior-/Setup-/Env-/Deploy-/Security-/Admin-/Route-Änderungen.
- Keine Secrets/`.env`/Credentials/Keys/Tokens/DB-Dumps committen.
- Produktion: ≥500 Concurrent Clients inkl. Shared-NAT; Rate-Limits dürfen Shared-IP-Traffic nicht blockieren. Kein CDN/WAF/Unique-IP-Annahme.

## Working

- Vor Edit: relevante Docs/Tests/Analoga lesen; `git status`; Behavior/Invariants/SoT/Contracts klären; alle Call-Sites einer Defect-Klasse suchen.
- Kleinste vollständige, codebase-lokale Änderung; API als kohärenter Slice (Schema+BE+FE+Tests).
- UI: Mobile, lokalisierte Textlängen, A11y prüfen.
- Medium/High-Risk: Rejection/Reload/Reconnect/Expiry/Migration/Legacy/Concurrency; nur plausible Pfade testen, Auslassungen im PR begründen.
- Third-Party-Formate gegen Spec/Contract-Test verifizieren.
- Prod/Operator: `docker-compose.prod.yml`, `.env.production.example`, `scripts/deploy.sh`, `.github/workflows/ci.yml` + Prod-Docs.
- Docs-only: Claims gegen Code/Tests/Config/kanonische Docs prüfen.

## Validation

- Passend zur Änderung: `npm run typecheck` | `npm test` | `npm run lint` | `npm run build:prod`
- Workspace: `npm run test -w @arsnova/backend` | `@arsnova/frontend`; `npm run build -w @arsnova/shared-types`; `npm run build:localize -w @arsnova/frontend`
- FE Template/Style/i18n/Build/Prod-Verhalten → `build:prod` oder localized build.
- Markdown-only: `npx prettier --check <docs>` + `git diff --check -- <docs>`
- Prod/DB/Redis/WS/Rate-Limit/Operator → zusätzlich `docs/TESTING.md`
- Nicht ausgeführte Checks nie als erfolgreich melden; Begründung + Risiko im PR.

## Review Readiness (vor PR)

- `.github/pull_request_template.md` vollständig nutzen; „PR-Template vollständig“ muss passen.
- Gesamten Diff prüfen; Acceptance/Invariants/Analoga; pos/neg/Regression-Tests je Risiko.
- Konsistenz Implementation ↔ Schemas ↔ Tests ↔ Docs ↔ Config ↔ i18n ↔ PR-Text.
- Obsolete Compat/Debug/misleading Comments entfernen; exakte Validation-Commands + Results.
- Keine unverifizierten Security/A11y/Compat/Perf/Prod-Claims.
- Prod-Impact, Rollback, Residual Risk, N/A-Checks begründen.
- Async UI: Trigger → pending → success → reject/timeout → retry/dismiss; DOM, Lock, Announcement, Focus je State.
- Nie Element entfernen/ersetzen/fokussieren ohne gültiges sichtbares Focus-Ziel nach Success und Failure.

## Code Review

- Gesamten PR + Defect-Klasse; Priorität: Correctness, Security, State, Integrity, Prod, A11y, Regressions > Style.
- Findings nur mit konkretem Failure-Szenario, betroffenem Pfad, beobachtbarem Impact; Severity proportional.
- Kein spekulatives Hardening/Architektur-Rewrite ohne plausible Threat/Failure für arsnova.eu.
- Resolved Findings nicht wieder öffnen, außer Fix verursacht konkrete neue Regression.

## Related

- `mem:core`
- `mem:quality/dod`
- `mem:quality/workflow`
- `mem:testing/core`
- `mem:security/auth`
- `mem:security/dto-stripping`
