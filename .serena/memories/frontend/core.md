# Frontend Core

- Angular app under `apps/frontend/src/app` follows `core/`, `shared/`, `features/`:
  - `core`: app-wide services/utilities such as `trpc.client.ts`, websocket URL/state helpers, locale routing, host/feedback token helpers, theme/preset/sound/MOTD helpers.
  - `shared`: reusable UI and helpers: top toolbar, server-status widget/help, Markdown+KaTeX editor, confirmation/lightbox dialogs, preset toast, answer badges, countdown assets.
  - `features`: routed areas: home, join, quiz, session, feedback, admin, news archive, legal, help.
- Routing (`app.routes.ts`) lazy-loads feature components. Session entry `/session/:code` redirects to role-specific views. Host and present routes check local host token before navigation; this is UX only, not the backend permission boundary.
- Local dev proxy (`proxy.conf.json`): `/trpc` -> `127.0.0.1:3000`, `/trpc-ws` -> `127.0.0.1:3001`, `/yjs-ws` -> `127.0.0.1:3002`.
- Host session routes depend on sessionStorage host tokens (`arsnova-host-token:<CODE>`). HTTP tRPC headers are resolved per request, but WS subscriptions can suffer from timing/reconnect issues; host components should tolerate host-only subscription errors with throttled fallback polling rather than tight resubscribe loops.
- i18n:
  - Angular source locale is `de`.
  - Translation files: `src/locale/messages.en.xlf`, `.fr.xlf`, `.es.xlf`, `.it.xlf`; source `messages.xlf`.
  - Standard `npm run dev`/`start:de` serves German source locale; `dev:en`/`start:en` serves an English single-locale dev build; full locale validation uses `build:localize`.
  - Locale subpaths are `/de/`, `/en/`, `/fr/`, `/it/`, `/es/`; language switching reloads the app and can drop unsaved in-memory edit state.
- Production frontend build is not just `ng build`: `build:localize` runs Angular browser/server builds, prerenders localized routes, patches noscript/sitemap/PWA manifests/ngsw, writes root index, and checks MOTD assets.
- Frontend Vitest config uses jsdom, Angular Vite plugin, `src/test-setup.ts`, and aliases `@arsnova/shared-types` to `libs/shared-types/src/index.workspace.ts`.
- UI work must follow `docs/ui/` and Angular Material 3 tokens; no Tailwind classes/system in this app.
- Do not use `::ng-deep` (deprecated). Style host-owned markup, official Material override mixins, or tightly scoped global/`panelClass` rules. Canonical: `docs/ui/TOKENS.md`, `docs/ui/PR-CHECKLIST-UI.md`.
- Quiz editor persisted metadata/settings/question changes use a centralized `hasPendingChanges()` + `saveAll()` contract; read `mem:frontend/quiz-editor-save-flow` before changing quiz-edit forms, handlers, presets, or question-type parameters.
