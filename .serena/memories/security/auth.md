# Security Auth

- Authorization is server-side. Routes, session codes, client state, `moderatorView`, or UI visibility are never permission proofs.
- Host-only session actions must use `hostProcedure` or equivalent validated server token checks. `session.create` returns the host token; host requests use `x-host-token`.
- `/session/:code/host` and `/session/:code/present` are UX routes only. Client route guards improve navigation but do not authorize backend mutations/subscriptions.
- Standalone quick feedback uses its own feedback-host token context (`x-feedback-host-token`); do not implicitly reuse session-host ownership.
- Admin login uses `ADMIN_SECRET` only at login; subsequent admin access must use a TTL-backed admin session token and `adminProcedure`.
- Owner-bound quiz history/analytics access must require `accessProof` or an equivalent ownership model, never a public `quizId` alone.
- Public endpoints should be minimal and purpose-bound; full participant/session views remain host/admin-scoped.
- Never commit secrets, `.env` contents, production credentials, local tokens, or generated operational tokens.

## Verwandte Memories:

- `mem:core`
- `mem:security/dto-stripping`
- `mem:modules/backend`
- `mem:backend/api-router`
- `mem:deployment/core`
- `mem:quality/dod`
