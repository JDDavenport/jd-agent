# Study Help API - Production Dockerfile
FROM oven/bun:1.1-alpine AS base
WORKDIR /app

# Install native deps for canvas/sharp
FROM base AS runner
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

WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json bun.lockb* bun.lock* ./
COPY hub/package.json ./hub/
RUN bun install --frozen-lockfile || bun install

# Final runner
FROM runner
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

WORKDIR /app/hub
CMD ["bun", "run", "src/index.ts"]
