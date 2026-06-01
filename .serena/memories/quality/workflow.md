# Quality Workflow

- Start coding work with `git status --short`; never overwrite unrelated user/local changes.
- Prefer small, coherent slices over broad rewrites. For API work, one coherent slice includes shared schema, backend procedure, frontend usage, and tests.
- For feature/bugfix work, run the smallest focused check that can fail for the touched slice before widening.
- For docs-only work, verify claims against code or canonical docs; run Prettier and `git diff --check` on touched docs.
- For production/operator-facing work, review env/deploy/security/testing docs and operator config in the same change.
- Serena use: load `mem:core` first, then focused memories. Use semantic symbol/reference tools for large TypeScript impact analysis; keep `rg`, tests, typecheck, and diff review for verification.
- Memory maintenance: update only stable, non-obvious project conventions. Run `serena memories check` after memory graph changes.

## Verwandte Memories:

- `mem:core`
- `mem:quality/dod`
- `mem:testing/core`
- `mem:deployment/core`
- `mem:modules/shared-types`
- `mem:memory_maintenance`
