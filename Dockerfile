# Study Help API - Production Dockerfile
FROM oven/bun:1.1-alpine AS base
WORKDIR /app

# Install system dependencies needed for native modules (canvas, sharp, etc.)
RUN apk add --no-cache \
    cairo-dev \
    pango-dev \
    libjpeg-turbo-dev \
    giflib-dev \
    librsvg-dev \
    python3 \
    make \
    g++ \
    pixman-dev

# Copy all workspace package.json files for bun workspace resolution
COPY package.json bun.lockb* bun.lock* ./
COPY hub/package.json ./hub/
COPY packages/types/package.json ./packages/types/
COPY packages/api-client/package.json ./packages/api-client/
COPY apps/ad-exchange/package.json ./apps/ad-exchange/
COPY apps/command-center/package.json ./apps/command-center/
COPY apps/crypto-tracker/package.json ./apps/crypto-tracker/
COPY apps/docs-frontend/package.json ./apps/docs-frontend/
COPY apps/jobs/package.json ./apps/jobs/
COPY apps/read-help/package.json ./apps/read-help/
COPY apps/sosatisfying-api/package.json ./apps/sosatisfying-api/
COPY apps/sosatisfying/package.json ./apps/sosatisfying/
COPY apps/study-help/package.json ./apps/study-help/
COPY apps/sync-service/package.json ./apps/sync-service/
COPY apps/tasks/package.json ./apps/tasks/
COPY apps/vault/package.json ./apps/vault/

# Install dependencies
RUN bun install --frozen-lockfile || bun install

# Copy source code (only hub + packages needed for runtime)
COPY hub/ ./hub/
COPY packages/ ./packages/

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

WORKDIR /app/hub
CMD ["bun", "run", "src/index.ts"]
