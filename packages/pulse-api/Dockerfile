# Multi-stage build for pulse-api.
#
# Build context MUST be the repo root (not packages/pulse-api/) because the
# Prisma schema lives at /prisma/schema.prisma — pulse-api re-uses it.
#
#   docker build -t ghcr.io/rector-labs/pulse-api:latest \
#     -f packages/pulse-api/Dockerfile .

# ---------- build stage ----------
FROM node:24-alpine AS builder

WORKDIR /app

# Copy schema first so it can be referenced by the postinstall prisma generate
COPY prisma ./prisma

# Copy package manifests for both pulse-api and the workspace-linked pulse-types
COPY packages/pulse-types/package.json ./packages/pulse-types/package.json
COPY packages/pulse-api/package.json ./packages/pulse-api/package.json

# Install pulse-types deps (no postinstall side effects)
WORKDIR /app/packages/pulse-types
RUN npm install --ignore-scripts

# Install pulse-api deps; postinstall runs prisma generate against ../../prisma
WORKDIR /app/packages/pulse-api
RUN npm install --ignore-scripts && \
    npx prisma generate --schema=../../prisma/schema.prisma

# Copy sources
COPY packages/pulse-types ./../pulse-types
COPY packages/pulse-api ./

# Compile TypeScript -> dist/
RUN npm run build

# ---------- runtime stage ----------
FROM node:24-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 pulseapi

# Production deps only
COPY --from=builder /app/packages/pulse-api/package.json ./package.json
COPY --from=builder /app/packages/pulse-types ./packages/pulse-types
RUN npm install --ignore-scripts --omit=dev

# Generated Prisma client + schema
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client

# Compiled JS
COPY --from=builder /app/packages/pulse-api/dist ./dist

USER pulseapi

EXPOSE 7004
ENV PORT=7004

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --spider -q http://127.0.0.1:7004/healthz || exit 1

CMD ["node", "--enable-source-maps", "dist/index.js"]
