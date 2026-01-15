# JD Agent Hub - Dockerfile
# Multi-stage build for Bun/Hono backend

# ============================================
# Stage 1: Install dependencies
# ============================================
FROM oven/bun:1.1 AS deps

WORKDIR /app

# Copy package files (bun.lockb is optional)
COPY package.json ./
COPY bun.lockb* ./
COPY hub/package.json ./hub/
COPY packages/types/package.json ./packages/types/
COPY packages/api-client/package.json ./packages/api-client/

# Install dependencies
RUN bun install

# ============================================
# Stage 2: Build stage
# ============================================
FROM oven/bun:1.1 AS builder

WORKDIR /app

# Copy dependencies from previous stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source code
COPY . .

# Build packages (if needed)
WORKDIR /app/packages/types
RUN bun run build || true

WORKDIR /app/packages/api-client
RUN bun run build || true

# ============================================
# Stage 3: Production image
# ============================================
FROM oven/bun:1.1-slim AS production

WORKDIR /app

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 hono

# Copy built application
COPY --from=builder --chown=hono:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=hono:nodejs /app/hub ./hub
COPY --from=builder --chown=hono:nodejs /app/packages ./packages
COPY --from=builder --chown=hono:nodejs /app/package.json ./

# Set environment
ENV NODE_ENV=production
ENV PORT=3000

# Expose port
EXPOSE 3000

# Switch to non-root user
USER hono

# Health check using bun
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD bun -e "fetch('http://localhost:3000/api/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

# Start the server
WORKDIR /app/hub
CMD ["bun", "run", "src/index.ts"]
