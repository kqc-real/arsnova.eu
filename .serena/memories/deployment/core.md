# Deployment Core

- Production/operator changes include env vars, deploy scripts, Nginx/reverse proxy, Docker Compose, admin/security paths, rate limits, health/status, backups, CI/CD, and server runbooks.
- Cross-check production changes against: `docs/deployment-debian-root-server.md`, `docs/ENVIRONMENT.md`, `docs/SECURITY-OVERVIEW.md`, `docs/TESTING.md`, `docs/implementation/ADMIN-FLOW.md`, `.env.production.example`, `docker-compose.prod.yml`, `scripts/deploy.sh`, `.github/workflows/ci.yml`.
- Local production-like path: `npm run build:prod`, `npm run start:prod`, then `npm run verify:production-serving` against the served URL.
- Localized production frontend validation: backend dev server + `npm run build:localize -w @arsnova/frontend` + `npm run serve:localize:api -w @arsnova/frontend`.
- Behind exactly one Nginx/reverse proxy, `TRUST_PROXY_HOPS=1` is production-relevant so rate limits see real client IPs.
- Docker local dev services are Postgres and Redis; production deploy must include migration/generate/health sequencing as documented.
- Optional spaCy sidecar (Story 1.14b, done): Compose profile `nlp`, `NLP_ENABLED` default false, `deploy.sh` does not start it. Canonical: `docs/features/word-cloud-spacy.md` and `mem:session/word-cloud-spacy`.
- Optional word-cloud encoder (Story 1.14c Stufe 1): Compose profile `encoder`, `WORD_CLOUD_SEMANTIC_ENABLED` default false, `deploy.sh` does not start it. Canonical: `docs/features/word-cloud-semantic.md` and `mem:session/word-cloud-semantic`.
- Planned open-weight LLM server (Story 8.9d, not implemented): Compose profile `llm`, `OPEN_WEIGHT_LLM_ENABLED` default false, second private host, not on the 16 GB live host. Canonical: ADR-0035.
- Do not store production secrets or real `.env.production` values in repo docs, prompts, memories, or commits.

## Verwandte Memories:

- `mem:core`
- `mem:modules/data-runtime`
- `mem:security/auth`
- `mem:testing/core`
- `mem:session/word-cloud-spacy`
- `mem:quality/dod`
- `mem:quality/workflow`
