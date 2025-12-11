# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
# Note: --ignore-scripts skips native compilation (usb package not needed in server)
COPY package*.json ./
RUN npm ci --ignore-scripts

# Copy source
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build Next.js
ARG DATABASE_URL
ENV DATABASE_URL=${DATABASE_URL}
RUN npm run build

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Re-declare build args to pass them to runtime
ARG NEXT_PUBLIC_COMMIT_SHA
ARG NEXT_PUBLIC_BRANCH_NAME
ARG NEXT_PUBLIC_BUILD_TIME

# Set runtime environment variables
ENV NEXT_PUBLIC_COMMIT_SHA=${NEXT_PUBLIC_COMMIT_SHA}
ENV NEXT_PUBLIC_BRANCH_NAME=${NEXT_PUBLIC_BRANCH_NAME}
ENV NEXT_PUBLIC_BUILD_TIME=${NEXT_PUBLIC_BUILD_TIME}

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
