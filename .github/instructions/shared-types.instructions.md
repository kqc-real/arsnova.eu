---
description: 'Use when changing shared Zod schemas, shared API contracts, exported TypeScript types, or monorepo contract surfaces in libs/shared-types for arsnova.eu.'
applyTo:
  - 'libs/shared-types/**/*.ts'
---

# Shared Types Instructions

- This package is the contract surface between frontend and backend. Make schema changes here before changing app code.
- Prefer Zod-backed schemas that are directly usable by tRPC inputs and outputs. Avoid parallel handwritten DTOs elsewhere.
- Keep exports intentional and stable. If you rename or remove a schema, update all affected backend and frontend imports in the same change.
- After modifying shared types, rebuild the package before validating dependents. Backend-only typecheck commands expect the built output to exist.
- When a schema change affects security-sensitive payloads, confirm the backend still strips participant-facing data correctly and update the relevant tests.

## Preferred Checks

- Rebuild shared types: `npm run build -w @arsnova/shared-types`
- Full typecheck after schema changes: `npm run typecheck`

## References

- [README.md](../../README.md)
- [docs/architecture/handbook.md](../../docs/architecture/handbook.md)
- [docs/SECURITY-OVERVIEW.md](../../docs/SECURITY-OVERVIEW.md)
- [docs/TESTING.md](../../docs/TESTING.md)
