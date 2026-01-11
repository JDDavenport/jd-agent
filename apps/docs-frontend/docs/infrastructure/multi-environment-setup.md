# Multi-Environment Database Setup

This document describes the multi-environment database architecture for JD Agent, providing isolated Development, Staging, and Production environments.

## Overview

JD Agent uses three isolated database environments:

| Environment | Purpose | Database |
|-------------|---------|----------|
| **Development** | Local development | Local PostgreSQL or Neon Dev Branch |
| **Staging** | Testing before production | Neon Staging Branch |
| **Production** | Live system | Neon Main Branch |

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Neon PostgreSQL                          │
├─────────────────┬─────────────────┬─────────────────────────┤
│   Development   │     Staging     │      Production         │
│   (dev branch)  │  (staging branch) │    (main branch)      │
│                 │                 │                         │
│  - Schema tests │  - Full testing │  - Live data           │
│  - Local data   │  - Seed data    │  - Backups enabled     │
│  - Fast reset   │  - Pre-prod     │  - Read replicas       │
└─────────────────┴─────────────────┴─────────────────────────┘
```

## Prerequisites

1. **Neon.tech Account**: Sign up at [neon.tech](https://neon.tech)
2. **Bun Runtime**: For running scripts
3. **PostgreSQL Client**: For local development (optional)

## Initial Setup

### Step 1: Create Neon Project

1. Go to [console.neon.tech](https://console.neon.tech)
2. Create a new project: `jd-agent`
3. Note your connection string for the main branch (this is production)

### Step 2: Create Database Branches

In the Neon console:

1. **Staging Branch**:
   - Click "Branches" in the left sidebar
   - Click "Create Branch"
   - Name: `staging`
   - Parent: `main`

2. **Development Branch** (optional - you can use local PostgreSQL):
   - Click "Create Branch"
   - Name: `development`
   - Parent: `main`

### Step 3: Configure Environment Files

Copy the example files and fill in your credentials:

```bash
cd hub

# Development (uses local PostgreSQL by default)
# The .env.development file is already configured for local use

# Staging
cp .env.staging.example .env.staging
# Edit .env.staging with your Neon staging branch connection string

# Production
cp .env.production.example .env.production
# Edit .env.production with your Neon main branch connection string
```

### Step 4: Run Migrations

Apply schema to each environment:

```bash
# Development
bun run db:migrate:dev

# Staging
bun run db:migrate:staging

# Production (has 5-second safety delay)
bun run db:migrate:prod
```

### Step 5: Verify Setup

```bash
# Verify single environment
bun run db:verify development
bun run db:verify staging
bun run db:verify production

# Verify all environments
bun run db:verify:all
```

### Step 6: Seed Staging Data (Optional)

```bash
bun run db:seed:staging
```

## Environment Files

### .env.development

Local development with local PostgreSQL (no SSL):

```env
NODE_ENV=development
APP_ENV=development
DATABASE_URL=postgresql://username@localhost:5432/jd_agent
DATABASE_SSL=false
```

### .env.staging

Staging with Neon (SSL required):

```env
NODE_ENV=staging
APP_ENV=staging
DATABASE_URL=postgresql://user:pass@ep-xxx-staging.neon.tech/jd_agent_staging?sslmode=require
DATABASE_SSL=true
DATABASE_POOL_SIZE=5
LOG_LEVEL=debug
```

### .env.production

Production with Neon (SSL required):

```env
NODE_ENV=production
APP_ENV=production
DATABASE_URL=postgresql://user:pass@ep-xxx.neon.tech/jd_agent?sslmode=require
DATABASE_SSL=true
DATABASE_POOL_SIZE=20
LOG_LEVEL=warn
```

## Available Commands

| Command | Description |
|---------|-------------|
| `bun run db:migrate:dev` | Apply migrations to development |
| `bun run db:migrate:staging` | Apply migrations to staging |
| `bun run db:migrate:prod` | Apply migrations to production (5s delay) |
| `bun run db:seed:staging` | Seed staging with test data |
| `bun run db:verify` | Verify development connection |
| `bun run db:verify:all` | Verify all environments |

## How Environment Selection Works

The system uses `APP_ENV` to determine which environment to use:

```typescript
// Load order for .env files (highest priority first):
1. .env.{APP_ENV}.local   // Local overrides (gitignored)
2. .env.{APP_ENV}         // Environment-specific
3. .env.local             // Local overrides (gitignored)
4. .env                   // Base config
```

### Running in Different Environments

```bash
# Development (default)
bun run dev

# Staging
APP_ENV=staging bun run start

# Production
APP_ENV=production bun run start
```

## Security Considerations

### What's Committed to Git

| File | Committed | Contains |
|------|-----------|----------|
| `.env.example` | Yes | Template with placeholders |
| `.env.staging.example` | Yes | Template with placeholders |
| `.env.production.example` | Yes | Template with placeholders |
| `.env.development` | Yes | Local dev config (no secrets) |
| `.env.staging` | **No** | Staging credentials |
| `.env.production` | **No** | Production credentials |
| `.env.*.local` | **No** | Local overrides |

### Best Practices

1. **Never commit real credentials** to git
2. **Use different passwords** for each environment
3. **Rotate credentials** periodically
4. **Enable Neon's IP allowlisting** for production
5. **Use read-only credentials** where possible

## Troubleshooting

### Connection Timeout

If you get connection timeouts:

1. Check your IP is allowed in Neon's dashboard
2. Verify the connection string includes `?sslmode=require`
3. Check your network allows outbound connections on port 5432

### SSL Errors

For SSL certificate issues:

```typescript
// The config uses rejectUnauthorized: false for Neon
ssl: { rejectUnauthorized: false }
```

### Migration Failures

If migrations fail:

1. Check the database user has CREATE/ALTER permissions
2. Verify no active connections are blocking schema changes
3. Review the specific error in the console output

### Environment Not Loading

If wrong environment is loading:

1. Check `APP_ENV` is set correctly
2. Verify the correct `.env.{environment}` file exists
3. Restart the server after changing environment

## Neon-Specific Features

### Branching

Neon branches are instant copies of your database:

- Create feature branches for testing schema changes
- Reset staging by re-branching from production
- Test migrations safely before applying to production

### Connection Pooling

Neon includes built-in connection pooling. For serverless:

```
# Use the pooled connection string
DATABASE_URL=postgresql://user:pass@ep-xxx-pooler.neon.tech/db?sslmode=require
```

### Autoscaling

Neon automatically scales compute based on load:

- Development: Scales to zero when idle
- Staging: Same as development
- Production: Configure minimum compute size

## Next Steps

After setting up environments:

1. Configure CI/CD to run tests against staging
2. Set up automated backups for production
3. Implement blue-green deployments
4. Add monitoring and alerting
