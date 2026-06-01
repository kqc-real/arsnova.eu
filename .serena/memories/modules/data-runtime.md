# Data Runtime Module

- PostgreSQL is the durable source for sessions, quizzes, votes, audit/admin/MOTD/statistic data.
- Prisma schema is `prisma/schema.prisma`; migrations live under `prisma/migrations/`.
- Redis is for rate limits, token TTLs, presence/live helper data, pub/sub or transient feedback concerns. Do not treat Redis as durable session/vote source of truth.
- Local Docker Compose provides Postgres 16 and Redis 7. Default local service ports: Postgres 5432, Redis 6379.
- Backend HTTP defaults to 3000, tRPC WebSocket to 3001, Yjs relay to 3002; Angular dev server defaults to 4200.
- Quiz sync is local-first: browser storage/IndexedDB plus Yjs/y-websocket; live session upload creates server-side copies.
- Production rate-limit correctness depends on trusted proxy configuration; see deployment memory before changing proxy/IP logic.

## Verwandte Memories:

- `mem:core`
- `mem:modules/backend`
- `mem:modules/frontend`
- `mem:deployment/core`
- `mem:security/auth`
- `mem:session/lifecycle`
