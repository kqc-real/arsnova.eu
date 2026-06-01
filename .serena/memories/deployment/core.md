# Deployment Core

- Production/operator changes include env vars, deploy scripts, Nginx/reverse proxy, Docker Compose, admin/security paths, rate limits, health/status, backups, CI/CD, and server runbooks.
- Cross-check production changes against: `docs/deployment-debian-root-server.md`, `docs/ENVIRONMENT.md`, `docs/SECURITY-OVERVIEW.md`, `docs/TESTING.md`, `docs/implementation/ADMIN-FLOW.md`, `.env.production.example`, `docker-compose.prod.yml`, `scripts/deploy.sh`, `.github/workflows/ci.yml`.
- Local production-like path: `npm run build:prod`, `npm run start:prod`, then `npm run verify:production-serving` against the served URL.
- Localized production frontend validation: backend dev server + `npm run build:localize -w @arsnova/frontend` + `npm run serve:localize:api -w @arsnova/frontend`.
- Behind exactly one Nginx/reverse proxy, `TRUST_PROXY_HOPS=1` is production-relevant so rate limits see real client IPs.
- Docker local dev services are Postgres and Redis; production deploy must include migration/generate/health sequencing as documented.
- Do not store production secrets or real `.env.production` values in repo docs, prompts, memories, or commits.

## Verwandte Memories:

- `mem:core`
- `mem:modules/data-runtime`
- `mem:security/auth`
- `mem:testing/core`
- `mem:quality/dod`
- `mem:quality/workflow`
