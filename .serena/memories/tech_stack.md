# Tech Stack

- Serena-indexed languages: TypeScript, Markdown, JSON.
- TypeScript carries nearly all executable backend/frontend/shared/build logic. Markdown covers docs, ADRs, backlog, onboarding, and architecture notes. JSON covers package manifests and workspace config such as `package.json`, `tsconfig*.json`, `angular.json`, `ngsw-config.json`, and `vercel.json`.
- Runtime/package manager:
  - npm workspaces with `package-lock.json`; root `.npmrc` sets `legacy-peer-deps=true` and `fund=false`.
  - `.nvmrc` pins Node `24.18.0` LTS for local and production reference. Root `engines`: `>=22.12.0 <23 || >=24.0.0 <25`; CI validates Node 22 and 24.
  - TypeScript `~5.9.0`, ESLint `^10`, `typescript-eslint`, Prettier `^3.2`.
- Frontend app (`@arsnova/frontend`): Angular `21.2.x`, Angular Material/CDK `21.2.x`, standalone components, Signals, SCSS, Angular SSR, service worker/PWA, `@angular/localize` i18n, RxJS `~7.8`, tRPC client v11, Yjs/y-websocket, Chart.js, Markdown/KaTeX/highlight utilities.
- Backend app (`@arsnova/backend`): Node + TypeScript, Express 4, tRPC server v11, Prisma ORM `7.4.x` with `@prisma/adapter-pg`, PostgreSQL via `pg`, Redis via `ioredis`, websockets (`ws`, y-websocket), Zod 4, PDFKit, dotenv.
- Shared contracts (`@arsnova/shared-types`): Zod 4 plus generated TS declarations via `tsc`.
- Persistence/runtime services: PostgreSQL 16 and Redis 7 in local Docker Compose. Backend HTTP on 3000, tRPC WS on 3001, Yjs relay on 3002; Angular dev server on 4200.
- Landing app (`@arsnova/landing`): Astro `^5.18`, Tailwind `^3.4`, YAML/prompts helpers. Tailwind belongs here, not in `apps/frontend`.
- Tests/tooling: Vitest 4; backend uses node environment and `src/**/*.test.ts`; frontend uses jsdom, `@analogjs/vite-plugin-angular`, `src/**/*.spec.ts`; Playwright-backed smoke scripts exist under frontend scripts.
