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

# Git info build arguments
ARG NEXT_PUBLIC_COMMIT_SHA=unknown
ARG NEXT_PUBLIC_BRANCH_NAME=unknown
ARG NEXT_PUBLIC_BUILD_TIME=unknown

# Set as NEXT_PUBLIC_ environment variables for build-time embedding
ENV NEXT_PUBLIC_COMMIT_SHA=${NEXT_PUBLIC_COMMIT_SHA}
ENV NEXT_PUBLIC_BRANCH_NAME=${NEXT_PUBLIC_BRANCH_NAME}
ENV NEXT_PUBLIC_BUILD_TIME=${NEXT_PUBLIC_BUILD_TIME}

# Write build metadata to JSON file for direct consumption
RUN echo "{\"commit\":\"${NEXT_PUBLIC_COMMIT_SHA}\",\"branch\":\"${NEXT_PUBLIC_BRANCH_NAME}\",\"buildTime\":\"${NEXT_PUBLIC_BUILD_TIME}\"}" > public/build-info.json && \
    cat public/build-info.json && \
    echo "Build info written successfully"

# Build Next.js
ARG DATABASE_URL
ENV DATABASE_URL=${DATABASE_URL}
RUN npm run build

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

# Re-declare build args (need to redeclare in new stage)
ARG NEXT_PUBLIC_COMMIT_SHA=unknown
ARG NEXT_PUBLIC_BRANCH_NAME=unknown
ARG NEXT_PUBLIC_BUILD_TIME=unknown

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Set NEXT_PUBLIC_ environment variables (for runtime fallback)
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
