# =============================================================================
# arsnova.eu – Multi-Stage Dockerfile
# Stage 1: Install dependencies + build
# Stage 2: Production image (node:24-alpine, Digest-Pinning)
#
# Beide Stages verwenden dieselbe Multi-Arch-Index-Referenz von Docker Hub
# (OCI image index), nicht einen plattformspezifischen Manifest-Digest.
# Geprüft: 2026-08-04 via
#   docker buildx imagetools inspect node:24-alpine
# Aktualisierung des Digests: docs/SECURITY-OVERVIEW.md
#   („Container-Basisimage“).
# =============================================================================

# ─── Stage 1: Build ─────────────────────────────────────────────────────────
FROM node:24-alpine@sha256:d32cdf619f63fe0471182d08996dd516c6275bb5fd31ae06e55a570bd9e1ad43 AS builder

WORKDIR /app

# Copy package manifests + npm config first (layer caching)
COPY package.json package-lock.json .npmrc ./
COPY libs/shared-types/package.json libs/shared-types/
COPY libs/session-export-report/package.json libs/session-export-report/
COPY apps/backend/package.json apps/backend/
COPY apps/frontend/package.json apps/frontend/

RUN npm ci

# Copy source
COPY tsconfig.json ./
COPY libs/ libs/
COPY apps/backend/ apps/backend/
COPY apps/frontend/ apps/frontend/
COPY prisma/ prisma/

# Generate Prisma client
RUN npx prisma generate

# Build shared-types + backend (tsc -b handles project references).
# Postbuild: Node ESM in production requires explicit .js extensions in dist/
# for every ESM workspace emitted by tsc -b (shared-types + session-export-report).
COPY scripts/fix-esm-imports.mjs scripts/ensure-schema.mjs scripts/ensure-schema.d.mts scripts/
RUN npx tsc -b apps/backend/tsconfig.json \
    && node scripts/fix-esm-imports.mjs

# Build frontend localized (de/en) including root redirect index
RUN npm run build:localize -w @arsnova/frontend

# ─── Stage 2: Production ────────────────────────────────────────────────────
FROM node:24-alpine@sha256:d32cdf619f63fe0471182d08996dd516c6275bb5fd31ae06e55a570bd9e1ad43 AS production

WORKDIR /app

ENV NODE_ENV=production

# FROM ist per Digest unveränderlich gepinnt. apk upgrade spielt darüber hinaus
# Security-Patches der Alpine-Pakete zum Image-Build-Zeitpunkt ein.
# Chromium für Server-PDF (Playwright nutzt System-Binary, kein Browser-Download).
# libssh explizit auf >=0.12.1-r0 (CVE-2026-59851), falls Chromium eine ältere Transitivversion zieht.
# libcrypto3/libssl3 explizit auf >=3.5.8-r0 (CVE-2026-14456); erzwingt Patch trotz Build-Cache.
# libexpat explizit auf >=2.8.4-r0 (CVE-2026-66046, CVE-2026-76641); erzwingt Patch trotz Build-Cache.
# libblkid/libmount/libuuid explizit auf >=2.42.3-r0 (CVE-2026-53612 ff.); erzwingt util-linux-Patch trotz Build-Cache.
RUN apk upgrade --no-cache \
    && apk add --no-cache \
      chromium \
      nss \
      freetype \
      harfbuzz \
      ca-certificates \
      ttf-freefont \
      font-noto \
      'libssh>=0.12.1-r0' \
      'libcrypto3>=3.5.8-r0' \
      'libssl3>=3.5.8-r0' \
      'libexpat>=2.8.4-r0' \
      'libblkid>=2.42.3-r0' \
      'libmount>=2.42.3-r0' \
      'libuuid>=2.42.3-r0'

ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 \
    PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium \
    PUBLIC_FRONTEND_URL=http://127.0.0.1:3000 \
    HOME=/tmp

# Copy package manifests + npm config, install production deps only
COPY package.json package-lock.json .npmrc ./
COPY libs/shared-types/package.json libs/shared-types/
COPY libs/session-export-report/package.json libs/session-export-report/
COPY apps/backend/package.json apps/backend/

RUN npm ci --omit=dev \
    && rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx

# Copy Prisma schema, config + generated client
COPY prisma/ prisma/
COPY prisma.config.ts tsconfig.json ./
COPY --from=builder /app/node_modules/.prisma node_modules/.prisma

# Copy compiled backend
COPY --from=builder /app/apps/backend/dist apps/backend/dist

# Copy compiled shared-types (needed at runtime via npm workspace resolution)
COPY --from=builder /app/libs/shared-types/dist libs/shared-types/dist
COPY --from=builder /app/libs/shared-types/package.json libs/shared-types/package.json
COPY --from=builder /app/libs/session-export-report/dist libs/session-export-report/dist
COPY --from=builder /app/libs/session-export-report/package.json libs/session-export-report/package.json

# Copy Angular build output (served by Express as static files)
COPY --from=builder /app/apps/frontend/dist/browser apps/frontend/dist

# Entrypoint: versionierte Migrationen vor dem App-Start anwenden
COPY scripts/docker-entrypoint.sh /app/scripts/
COPY scripts/container-runtime-smoke.mjs /app/scripts/
COPY scripts/pdf-worker-healthcheck.mjs /app/scripts/
COPY scripts/pdf-worker-runtime-smoke.mjs /app/scripts/
RUN chmod +x /app/scripts/docker-entrypoint.sh \
    && mkdir -p /run/pdf-worker /run/spacy \
    && chown node:node /run/pdf-worker /run/spacy

# App, Prisma-Migrationen und Chromium benötigen keine Root-Rechte.
USER node

ENTRYPOINT ["/app/scripts/docker-entrypoint.sh"]

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3000/trpc/health.check || exit 1

EXPOSE 3000

CMD ["node", "apps/backend/dist/index.js"]
