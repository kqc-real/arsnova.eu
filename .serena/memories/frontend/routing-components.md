# Frontend Routing Components

- `apps/frontend/src/app/app.routes.ts` lazy-loads routed feature components.
- Route domains: home, quiz, session, join, feedback, admin, help, news archive, legal.
- Locale-prefixed paths exist for localized builds, e.g. `/de/...`, `/en/...`, `/fr/...`, `/es/...`, `/it/...`.
- Session routes:
  - `/session/:code` redirects/chooses entry behavior.
  - `/session/:code/host`: host control view. Presenter-Ansicht opens the shared “Präsentation starten” dialog first (optional phone pairing, visibility default projected, no silent grant); pairing QR/approve and device management stay host-private. Paired hosts use the same shell; audio defaults to off.
  - `/session/:code/present`: projection/presenter view; fullscreen gate only, no pairing secrets, approve UI, or device revoke.
  - `/session/:code/vote`: participant voting view.
  - `/session/:code/pair`: smartphone pairing request; secret only in the URL fragment; no host token and no approve UI.
- Feedback routes include standalone host/vote flows; do not conflate feedback-host token with session-host token.
- Quiz routes include list/new/edit/preview/sync areas; local-first quiz store/sync code lives under `features/quiz` and `features/quiz/data`.
- Core/shared/features layout follows Angular style: avoid generic top-level `components/` or `services/` buckets.
- SSR/browser boundary: localStorage/requestIdleCallback/WebSocket-only behavior must stay browser-guarded.

## Verwandte Memories:

- `mem:core`
- `mem:modules/frontend`
- `mem:frontend/i18n-ui`
- `mem:security/auth`
- `mem:session/lifecycle`
- `mem:testing/core`
