<!-- markdownlint-disable MD013 -->

# ADR-0003: Nutzung von tRPC für die API-Schicht

**Status:** Accepted
**Datum:** 2026-02-18
**Entscheider:** Projektteam

**Letzter Repo-Abgleich:** 2026-05-31

## Kontext

Wir benötigen eine API-Schicht zwischen Angular-Frontend und Node.js-Backend. Klassische REST-APIs erfordern manuelles DTO-Mapping und bieten keine Ende-zu-Ende-Typsicherheit. GraphQL löst dieses Problem, bringt aber erhebliche Komplexität mit.

## Entscheidung

Wir verwenden **tRPC** als API-Schicht. Das Frontend importiert den **Router-Typ (`AppRouter`)** direkt aus dem Backend über den Path-Alias `@arsnova/api` (zeigt auf `apps/backend/src/routers/index.ts`). Geteilte Zod-Schemas und DTOs werden aus `@arsnova/shared-types` (`libs/shared-types`) importiert. Dadurch entsteht **100 % End-to-End Typsicherheit** ohne Code-Generierung.

tRPC wird auch für **WebSocket-Subscriptions** (Echtzeit-Abstimmungen) verwendet.

## Repo-Abgleich 2026-05-31

Der Path-Alias `@arsnova/api` zeigt weiterhin auf `apps/backend/src/routers/index.ts`; `@arsnova/shared-types` zeigt im Workspace auf `libs/shared-types/src/index.workspace.ts`. Das Frontend nutzt im Browser `splitLink` mit `wsLink` fuer Subscriptions und `httpBatchLink` fuer Queries/Mutations; SSR/Prerender nutzt nur HTTP. `@trpc/server` bleibt im Frontend als Dependency vorhanden, weil `@trpc/client` v11 interne Typen/Runtime-Teile daraus aufloest.

## Konsequenzen

### Positiv

- Typ-Änderungen im Backend führen sofort zu Compile-Fehlern im Frontend
- Kein manuelles Pflegen von API-Schemas oder OpenAPI-Specs
- WebSockets und HTTP-Calls über dieselbe Abstraktion
- Zod-Validierung am Eingang jedes Endpoints

### Negativ / Risiken

- Frontend und Backend müssen im selben Monorepo liegen (oder Types separat publishen)
- tRPC ist weniger bekannt als REST – Einarbeitungszeit für Studenten

## Alternativen (geprüft)

- **REST + OpenAPI:** Typsicherheit nur über Code-Generierung, fehleranfällig
- **GraphQL:** Sehr mächtig, aber Overshoot für dieses Projekt; eigener Schema-Layer nötig
