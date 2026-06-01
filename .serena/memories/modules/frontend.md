# Frontend Module

- Path: `apps/frontend/`; package: `@arsnova/frontend`.
- Stack: Angular 21.2, Standalone Components, Signals, Angular Material/CDK 21.2, SCSS, Angular SSR, service worker/PWA, Angular localize, tRPC client v11, Yjs/y-websocket.
- App layout under `src/app/`:
  - `core/`: app-wide singletons/utilities (`trpc.client`, websocket URL/state helpers, locale routing, host/feedback tokens, theme/preset/sound/MOTD helpers).
  - `shared/`: reusable UI/helpers (top toolbar, server-status widget/help, Markdown+KaTeX editor, dialogs, preset toast, answer badges, countdown assets).
  - `features/`: routed domains (`home`, `join`, `quiz`, `session`, `feedback`, `admin`, `news-archive`, `legal`, `help`).
- Dev proxy: `/trpc` -> `127.0.0.1:3000`; `/trpc-ws` -> `127.0.0.1:3001`; `/yjs-ws` -> `127.0.0.1:3002`.
- Scripts: `start:de`, `start:en`, `build`, `build:localize`, `serve:localize:api`, `check:viewport`, smoke scripts, `test`, `typecheck`, `sync-i18n`.
- UI state convention: Signals for component/app UI state; RxJS only for real streams/operators, not default local state stores.
- Tailwind is not part of this app; use Angular Material 3 tokens and existing SCSS patterns.

## Verwandte Memories:

- `mem:core`
- `mem:frontend/routing-components`
- `mem:frontend/i18n-ui`
- `mem:modules/shared-types`
- `mem:security/dto-stripping`
- `mem:testing/core`
- `mem:quality/dod`
