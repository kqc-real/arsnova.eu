<!-- markdownlint-disable MD013 -->

# ADR-0003: Nutzung von tRPC für die API-Schicht

**Status:** Accepted
**Datum:** 2026-02-18
**Entscheider:** Projektteam

## Kontext

Wir benötigen eine API-Schicht zwischen Angular-Frontend und Node.js-Backend. Klassische REST-APIs erfordern manuelles DTO-Mapping und bieten keine Ende-zu-Ende-Typsicherheit. GraphQL löst dieses Problem, bringt aber erhebliche Komplexität mit.

## Entscheidung

Wir verwenden **tRPC** als API-Schicht. Das Frontend importiert den **Router-Typ (`AppRouter`)** direkt aus dem Backend über den Path-Alias `@arsnova/api` (zeigt auf `apps/backend/src/routers/index.ts`). Geteilte Zod-Schemas und DTOs werden aus `@arsnova/shared-types` (`libs/shared-types`) importiert. Dadurch entsteht **100 % End-to-End Typsicherheit** ohne Code-Generierung.

tRPC wird auch für **WebSocket-Subscriptions** (Echtzeit-Abstimmungen) verwendet.

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
