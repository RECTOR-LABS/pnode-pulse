# Dependencies + source + generated Prisma client.
# Shared base for both the web build and the collector so they install deps once.
FROM node:24-alpine AS deps

WORKDIR /app

# Install dependencies
# Note: --ignore-scripts skips native compilation (usb package not needed in server)
# Note: --legacy-peer-deps for react-simple-maps compatibility with React 19
COPY package*.json ./
RUN npm ci --ignore-scripts --legacy-peer-deps

# Copy source
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Web build stage
FROM deps AS builder

ARG DATABASE_URL
ENV DATABASE_URL=${DATABASE_URL}
RUN npm run build

# Collector stage — runs the data-collection worker via tsx.
# Reuses `deps` (full deps incl. tsx, source, generated Prisma client); the
# Next.js build is NOT needed here, so this stage skips it.
FROM deps AS collector

ENV NODE_ENV=production
CMD ["npx", "tsx", "scripts/start-collector.ts"]

# Production web stage (Next.js standalone). This is the default build target.
FROM node:24-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built assets
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Set permissions
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
