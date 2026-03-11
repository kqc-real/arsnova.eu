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

# Build shared-types + backend (tsc -b handles project references)
RUN npx tsc -b apps/backend/tsconfig.json

# Build frontend (Angular production build)
RUN cd apps/frontend && npx ng build --configuration production

# ─── Stage 2: Production ────────────────────────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

# Copy package manifests + npm config, install production deps only
COPY package.json package-lock.json .npmrc ./
COPY libs/shared-types/package.json libs/shared-types/
COPY apps/backend/package.json apps/backend/

RUN npm ci --omit=dev

# Copy Prisma schema, config + generated client
COPY prisma/ prisma/
COPY prisma.config.ts tsconfig.json ./
COPY --from=builder /app/node_modules/.prisma node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma node_modules/@prisma

# Copy compiled backend
COPY --from=builder /app/apps/backend/dist apps/backend/dist

# Copy compiled shared-types (needed at runtime via npm workspace resolution)
COPY --from=builder /app/libs/shared-types/dist libs/shared-types/dist
COPY --from=builder /app/libs/shared-types/package.json libs/shared-types/package.json

# Copy Angular build output (served by Express as static files)
COPY --from=builder /app/apps/frontend/dist/browser apps/frontend/dist

# Entrypoint: Migrationen vor Start anwenden (funktioniert ohne Server-Zugriff)
COPY scripts/docker-entrypoint.sh /app/scripts/docker-entrypoint.sh
RUN chmod +x /app/scripts/docker-entrypoint.sh
ENTRYPOINT ["/app/scripts/docker-entrypoint.sh"]

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/trpc/health.check || exit 1

EXPOSE 3000

CMD ["node", "apps/backend/dist/index.js"]
