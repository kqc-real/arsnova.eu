---
description: 'Use when changing backend routers, Prisma-backed server logic, tRPC procedures, DTO stripping, host authorization, rate limits, or backend Vitest coverage in arsnova.eu.'
applyTo:
  - 'apps/backend/**/*.ts'
  - 'prisma/schema.prisma'
---

# Backend Instructions

- Keep the contract in [libs/shared-types](../../libs/shared-types) authoritative. If the change affects tRPC input or output, update the shared Zod schema first.
- Host-only or moderator-only behavior must be protected server-side. Never trust `/session/:code/...`, `moderatorView`, or similar client input as the permission proof by itself.
- Preserve data stripping for participant-facing payloads. During active question phases, do not leak fields such as `isCorrect`.
- Treat standalone feedback and live-session host access as separate ownership contexts; do not reuse one token model implicitly for the other.
- Keep public payloads minimal. Owner-bound history or analytics endpoints must not become enumerable through IDs alone.
- When changing Prisma models in [prisma/schema.prisma](../../prisma/schema.prisma), follow through to the affected backend code and shared schemas in the same change.
- Add or update backend Vitest coverage for the changed slice. New procedures should normally have at least one success case and one rejection or error case.

## Preferred Checks

- Focused backend tests: `npm run test -w @arsnova/backend -- <path-to-test>`
- Backend typecheck: `npm run typecheck -w @arsnova/backend`
- Full backend suite: `npm run test -w @arsnova/backend`

## References

- [docs/SECURITY-OVERVIEW.md](../../docs/SECURITY-OVERVIEW.md)
- [docs/architecture/handbook.md](../../docs/architecture/handbook.md)
- [docs/TESTING.md](../../docs/TESTING.md)
- [docs/architecture/decisions/0006-roles-routes-authorization-host-admin.md](../../docs/architecture/decisions/0006-roles-routes-authorization-host-admin.md)
- [docs/architecture/decisions/0019-host-hardening-and-owner-bound-session-access.md](../../docs/architecture/decisions/0019-host-hardening-and-owner-bound-session-access.md)
