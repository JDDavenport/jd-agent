# Cloud Infrastructure Documentation

## Overview

JD Agent is deployed across multiple cloud services:

| Service | Purpose | URL Pattern |
|---------|---------|-------------|
| Railway | Backend API (Hub) | `api.jdagent.app` / `api-staging.jdagent.app` |
| Vercel | Frontend Apps | `app.jdagent.app` / `staging.jdagent.app` |
| Neon | PostgreSQL Database | Serverless with branching |

## Architecture

```
                                 ┌─────────────────┐
                                 │     Vercel      │
                                 │  (Frontend)     │
                                 │                 │
                                 │ ┌─────────────┐ │
                                 │ │Command Ctr  │ │
┌─────────────┐                  │ └─────────────┘ │
│   Browser   │ ◄──────────────► │ ┌─────────────┐ │
│             │                  │ │   Tasks     │ │
└─────────────┘                  │ └─────────────┘ │
       │                         │ ┌─────────────┐ │
       │                         │ │   Vault     │ │
       │                         │ └─────────────┘ │
       │                         └────────┬────────┘
       │                                  │
       │         ┌────────────────────────┘
       │         │
       ▼         ▼
  ┌─────────────────────────┐         ┌─────────────────┐
  │        Railway          │         │      Neon       │
  │     (Backend API)       │ ◄─────► │  (PostgreSQL)   │
  │                         │         │                 │
  │  ┌───────────────────┐  │         │  ┌───────────┐  │
  │  │    Hub (Bun)      │  │         │  │Development│  │
  │  │                   │  │         │  └───────────┘  │
  │  │  - API Routes     │  │         │  ┌───────────┐  │
  │  │  - Background     │  │         │  │  Staging  │  │
  │  │    Jobs           │  │         │  └───────────┘  │
  │  │  - Integrations   │  │         │  ┌───────────┐  │
  │  │                   │  │         │  │Production │  │
  │  └───────────────────┘  │         │  └───────────┘  │
  └─────────────────────────┘         └─────────────────┘
```

## Railway Setup

### Project Configuration

The hub is deployed to Railway using Nixpacks for the build process.

#### Configuration Files

**`hub/railway.json`:**
```json
{
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "bun install --frozen-lockfile"
  },
  "deploy": {
    "startCommand": "bun run start",
    "healthcheckPath": "/api/health",
    "healthcheckTimeout": 30,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

**`hub/nixpacks.toml`:**
```toml
[phases.setup]
nixPkgs = ["nodejs_20", "bun"]

[phases.install]
cmds = ["bun install --frozen-lockfile"]

[start]
cmd = "bun run start"

[variables]
NODE_ENV = "production"
```

### Initial Setup

1. **Create Railway Account**
   - Sign up at [railway.app](https://railway.app)
   - Connect your GitHub account

2. **Create New Project**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose `your-org/jd-agent`
   - Set root directory to `hub`

3. **Configure Environment Variables**
   ```bash
   # Required
   DATABASE_URL=postgresql://...         # Neon connection string
   APP_ENV=production                    # or staging

   # Optional but recommended
   JWT_SECRET=<32+ character secret>
   OPENAI_API_KEY=sk-...
   ANTHROPIC_API_KEY=sk-ant-...
   ```

4. **Configure Custom Domain**
   - Go to Settings → Networking
   - Add custom domain (e.g., `api.jdagent.app`)
   - Configure DNS records as shown

5. **Enable Health Checks**
   - Railway will automatically use `/api/health`
   - Configured in `railway.json`

### Deployment

Railway auto-deploys on push to the configured branch. Manual deploys:

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Link project
railway link

# Deploy manually
railway up
```

## Vercel Setup

### Project Configuration

Each frontend app has its own Vercel project.

#### Configuration Files

**`apps/{app}/vercel.json`:**
```json
{
  "framework": "vite",
  "buildCommand": "bun run build",
  "outputDirectory": "dist",
  "installCommand": "bun install",
  "routes": [
    {
      "src": "/assets/(.*)",
      "headers": { "Cache-Control": "public, max-age=31536000, immutable" }
    },
    { "src": "/(.*)", "dest": "/index.html" }
  ],
  "env": {
    "VITE_API_URL": "@api_url",
    "VITE_APP_ENV": "@app_env"
  }
}
```

### Initial Setup

1. **Create Vercel Account**
   - Sign up at [vercel.com](https://vercel.com)
   - Connect your GitHub account

2. **Create Projects for Each App**

   For each app (command-center, tasks, vault):
   - Click "Add New Project"
   - Import from GitHub
   - Configure:
     - Root Directory: `apps/{app-name}`
     - Framework Preset: Vite
     - Build Command: `bun run build`
     - Output Directory: `dist`

3. **Configure Environment Variables**
   ```bash
   # For staging
   VITE_API_URL=https://api-staging.jdagent.app
   VITE_APP_ENV=staging

   # For production
   VITE_API_URL=https://api.jdagent.app
   VITE_APP_ENV=production
   ```

4. **Configure Custom Domains**
   - Production: `app.jdagent.app`
   - Staging: `staging.jdagent.app`

### Deployment

Vercel auto-deploys on push. Manual deploys:

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy to preview
vercel

# Deploy to production
vercel --prod
```

## Neon Database Setup

### Branching Strategy

| Branch | Environment | Purpose |
|--------|-------------|---------|
| `main` | Production | Live data |
| `staging` | Staging | Pre-production testing |
| `development` | Development | Local development |

### Connection Strings

Get connection strings from [Neon Console](https://console.neon.tech):

```bash
# Development
DATABASE_URL=postgresql://neondb_owner:...@ep-xxx-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require

# Staging
DATABASE_URL=postgresql://neondb_owner:...@ep-yyy-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require

# Production
DATABASE_URL=postgresql://neondb_owner:...@ep-zzz-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require
```

### Running Migrations

```bash
# Development
bun run db:push:dev

# Staging
bun run db:push:staging

# Production (with confirmation)
bun run db:push:prod
```

## Environment Configuration

### Hub Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | Neon PostgreSQL connection string |
| `APP_ENV` | Yes | `development`, `staging`, or `production` |
| `PORT` | No | Server port (default: 3000) |
| `JWT_SECRET` | Prod | JWT signing secret (32+ chars) |
| `OPENAI_API_KEY` | No | OpenAI API key for AI features |
| `ANTHROPIC_API_KEY` | No | Anthropic API key for AI features |
| `REDIS_URL` | No | Redis connection string for queues |
| `GOOGLE_CLIENT_ID` | No | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | No | Google OAuth client secret |
| `NOTION_TOKEN` | No | Notion integration token |
| `TODOIST_API_TOKEN` | No | Todoist API token |

### Frontend Environment Variables

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Backend API URL (e.g., `https://api.jdagent.app`) |
| `VITE_APP_ENV` | Current environment |

## Monitoring

### Railway Logs

```bash
# View recent logs
railway logs

# Stream logs
railway logs --follow
```

### Health Endpoints

| Endpoint | Purpose |
|----------|---------|
| `/api/health` | Full health check with database status |
| `/api/health/live` | Liveness probe (for Kubernetes/Railway) |
| `/api/health/ready` | Readiness probe |
| `/api/health/detailed` | Detailed integration status |

Example health response:
```json
{
  "status": "healthy",
  "version": "0.1.0",
  "environment": "production",
  "deploymentId": "abc123",
  "timestamp": "2026-01-09T12:00:00.000Z",
  "uptime": 3600,
  "checks": {
    "database": {
      "status": "up",
      "latencyMs": 15
    }
  }
}
```

## Troubleshooting

### Railway Issues

**Build Failing:**
- Check Nixpacks logs for errors
- Verify `bun.lockb` is committed
- Check package.json scripts

**Container Not Starting:**
- Check environment variables are set
- Verify DATABASE_URL is correct
- Check health endpoint is responding

### Vercel Issues

**Build Failing:**
- Check Vite build output
- Verify environment variables
- Check for TypeScript errors

**API Calls Failing:**
- Verify VITE_API_URL is correct
- Check CORS configuration on Railway
- Check browser network tab for errors

### Database Issues

**Connection Timeouts:**
- Use pooler endpoint (not direct)
- Check `sslmode=require` in connection string
- Verify IP allowlist if enabled

## Security Considerations

1. **Secrets Management**
   - Never commit secrets to git
   - Use environment variables for all sensitive data
   - Rotate secrets regularly

2. **CORS Configuration**
   - Configure allowed origins in Hub
   - Restrict to known domains in production

3. **SSL/TLS**
   - All traffic is encrypted (Railway and Vercel enforce HTTPS)
   - Database connections use SSL

4. **Authentication**
   - JWT tokens for API authentication
   - Secure cookie settings in production

## Cost Optimization

### Railway
- Use sleep mode for staging when not in use
- Monitor build minutes
- Use reasonable instance sizes

### Vercel
- Enable caching for static assets
- Use preview deployments sparingly
- Monitor function invocations

### Neon
- Use connection pooling
- Clean up unused branches
- Monitor compute usage
