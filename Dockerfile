# ================================================================
# Multi-stage Dockerfile for Jobless Empire Timeline Bot
# ================================================================

# --- Stage 1: Build Frontend & Backend Bundles ---
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies first for optimal layer caching
COPY package.json package-lock.json* ./
RUN npm ci

# Copy application source code
COPY . .

# Compile React frontend and bundle server.ts -> dist/server.cjs
RUN npm run build

# --- Stage 2: Production Runner Image ---
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

# Install production dependencies only
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy pre-built bundles from builder
COPY --from=builder /app/dist ./dist

# Copy database schema (used for self-initialization and migrations)
COPY --from=builder /app/src/db/schema.sql ./src/db/schema.sql

# Create fallback data directory with proper write permissions for non-root user
RUN mkdir -p /app/data && chown -R node:node /app

USER node

EXPOSE 3000

# Container healthcheck targeting the timeline bot health API
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

CMD ["node", "dist/server.cjs"]
