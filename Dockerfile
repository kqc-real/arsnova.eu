# =============================================================================
# arsnova.eu – Multi-Stage Dockerfile
# Stage 1: Install dependencies + build
# Stage 2: Production image (node:20-alpine)
# =============================================================================

# ─── Stage 1: Build ─────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

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
COPY scripts/fix-esm-imports.mjs scripts/fix-esm-imports.mjs
RUN npx tsc -b apps/backend/tsconfig.json \
    && node scripts/fix-esm-imports.mjs

# Build frontend localized (de/en) including root redirect index
RUN npm run build:localize -w @arsnova/frontend

# ─── Stage 2: Production ────────────────────────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

# Security-Patches des unveränderlich referenzierten Alpine-Basisimages einspielen.
# Chromium für Server-PDF (Playwright nutzt System-Binary, kein Browser-Download).
RUN apk upgrade --no-cache \
    && apk add --no-cache \
      chromium \
      nss \
      freetype \
      harfbuzz \
      ca-certificates \
      ttf-freefont \
      font-noto

ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 \
    PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium \
    PUBLIC_FRONTEND_URL=http://127.0.0.1:3000

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
RUN chmod +x /app/scripts/docker-entrypoint.sh
ENTRYPOINT ["/app/scripts/docker-entrypoint.sh"]

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3000/trpc/health.check || exit 1

EXPOSE 3000

CMD ["node", "apps/backend/dist/index.js"]
