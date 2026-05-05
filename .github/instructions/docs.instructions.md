---
description: 'Use when editing Markdown documentation, README files, backlog text, ADR-linked docs, or explanatory project docs in arsnova.eu.'
applyTo:
  - 'docs/**/*.md'
  - 'README.md'
  - 'CONTRIBUTING.md'
  - 'Backlog.md'
---

# Documentation Instructions

- Link to the canonical doc instead of duplicating explanations that already exist elsewhere in the repo.
- Keep each document aligned with the current code and backlog state. If behavior changed, update the nearest affected doc in the same change when practical.
- Respect the language of the file you are editing. This repo intentionally mixes German and English; do not translate an existing document wholesale unless that is the task.
- Prefer concrete file and feature references over generic prose. In docs, ADR links, feature docs, and workspace paths are part of the expected navigation model.
- For architecture, security, UI, or i18n claims, reference the existing handbook, ADRs, or focused docs instead of restating them from memory.
- Preserve existing Markdown conventions in the file, including any `markdownlint-disable` header already present.
- Keep docs actionable and scannable. Add short sections or tables only when they make navigation or maintenance easier.

## Preferred Checks

- Narrow formatting check for touched docs: `npx prettier --check <touched-doc-paths>`
- If docs describe changed behavior, run the relevant code validation too instead of only checking Markdown formatting.

## References

- [docs/README.md](../../docs/README.md)
- [docs/architecture/handbook.md](../../docs/architecture/handbook.md)
- [docs/SECURITY-OVERVIEW.md](../../docs/SECURITY-OVERVIEW.md)
- [docs/TESTING.md](../../docs/TESTING.md)
