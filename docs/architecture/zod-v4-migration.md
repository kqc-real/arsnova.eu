# Migration Zod v3 -> v4

**Stand:** 2026-05-31
**Status:** umgesetzt, mit dokumentierten Rest-Aufraeumarbeiten

## 1. Aktueller Repo-Stand

Zod v4 ist im Monorepo bereits aktiv:

- `libs/shared-types/package.json`: `zod` `^4.0.0`
- `apps/backend/package.json`: `zod` `^4.0.0`
- `apps/frontend`: nutzt Zod nicht direkt, sondern konsumiert die DTOs aus `@arsnova/shared-types`

Die tRPC-Router binden die Zod-Schemas inzwischen breit ueber `.input(...)` und `.output(...)` ein. Der Health-Router validiert sowohl `health.check` als auch `health.stats` und `health.footerBundle` ueber Shared-Type-Schemas.

## 2. Was erledigt ist

- Paketversionen sind auf Zod v4 angehoben.
- `@arsnova/shared-types` ist die kanonische Schema-Quelle fuer Frontend und Backend.
- Backend-Router verwenden die geteilten Schemas fuer Eingaben und Ausgaben.
- Die Migration benoetigte keine Datenbankmigration und keine API-Neumodellierung.

## 3. Bekannte Restpunkte

Der Code ist lauffaehig auf Zod v4, enthaelt aber noch einige v4-kompatible Legacy-Formen:

- `z.string().uuid()` und `z.string().datetime()` kommen in `libs/shared-types/src/schemas.ts` und vereinzelt in Backend-Router-Inline-Schemas noch vor.
- Diese Methoden funktionieren in Zod v4 weiter, sind aber gegen die bevorzugten Top-Level-APIs (`z.uuid()`, `z.iso.datetime()` bzw. passender ISO-Helper) zu pruefen.
- `ctx.addIssue({ message: ... })` ist **kein** Migrationsproblem; `message` ist dort weiterhin das Issue-Feld und nicht die alte String-Parameterform von `.min(...)`, `.max(...)` oder `.length(...)`.

## 4. Empfohlene Restbereinigung

1. In `libs/shared-types/src/schemas.ts` und Inline-Schemas der Router `z.string().uuid()` systematisch durch den passenden Zod-v4-Top-Level-Helper ersetzen.
2. Datumsfelder gezielt pruefen, bevor `z.string().datetime()` ersetzt wird; entscheidend ist, ob der bestehende Vertrag ISO-Datetime mit Offset, UTC oder nullable Felder erwartet.
3. Danach `npm run build -w @arsnova/shared-types`, `npm run typecheck -w @arsnova/backend` und `npm run typecheck -w @arsnova/frontend` ausfuehren.
4. Bei Schemas, die Import-/Export-Vertraege betreffen, zusaetzlich die betroffenen Backend- und Frontend-Tests laufen lassen.

## 5. Rollback

Ein Rollback auf Zod v3 ist nicht mehr der erwartete Pfad. Falls ein einzelner Helper-Wechsel Probleme erzeugt, wird nur diese Code-Aenderung zurueckgenommen; Paketversionen bleiben auf Zod v4.

## 6. Referenzen im Repo

- `libs/shared-types/src/schemas.ts`
- `apps/backend/src/routers/*.ts`
- `apps/backend/src/routers/health.ts`
- `package-lock.json`
