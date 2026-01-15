# JD Agent - Local Backend Setup Guide

This guide walks you through migrating from cloud-hosted backend (Railway) to a local Docker-based backend while keeping the frontend on Cloudflare Pages/Vercel.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Cloud Frontend (Vercel)                      │
├───────────────┬───────────────┬───────────────┬─────────────────┤
│Command Center │     Tasks     │     Vault     │   Jobs/Docs     │
│   React App   │   React App   │   React App   │   React Apps    │
└───────┬───────┴───────┬───────┴───────┬───────┴────────┬────────┘
        │               │               │                │
        └───────────────┴───────┬───────┴────────────────┘
                                │
                    ┌───────────▼───────────┐
                    │  Cloudflare Tunnel    │
                    │  api.jdagent.dev      │
                    └───────────┬───────────┘
                                │
┌───────────────────────────────▼─────────────────────────────────┐
│                    Your Mac (Docker)                            │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │  PostgreSQL │  │    Redis    │  │   Hub API   │              │
│  │    :5432    │  │    :6379    │  │    :3000    │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │   Worker    │  │  Scheduler  │  │ Cloudflared │              │
│  │  (BullMQ)   │  │   (Cron)    │  │  (Tunnel)   │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
└─────────────────────────────────────────────────────────────────┘
```

## Prerequisites

- **macOS** (this guide is macOS-specific, Linux/Windows need adjustments)
- **Docker Desktop** installed and running
- **Cloudflare account** with a domain for the tunnel
- **~30 minutes** for initial setup

## Quick Start

```bash
# 1. Configure environment
cp .env.local.docker.example .env.local.docker
# Edit .env.local.docker with your API keys

# 2. Set up Cloudflare Tunnel
./scripts/setup-tunnel.sh

# 3. Start everything
./scripts/local-start.sh

# 4. (Optional) Enable auto-start on login
./scripts/install-launchd.sh install
```

## Step-by-Step Setup

### Step 1: Configure Environment Variables

1. Copy the example environment file:
   ```bash
   cp .env.local.docker.example .env.local.docker
   ```

2. Edit `.env.local.docker` with your values:
   - **Required**: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`
   - **For tunnel**: `CLOUDFLARE_TUNNEL_TOKEN` (see Step 2)
   - **Integrations**: Add any API keys you use (Telegram, Google, etc.)

### Step 2: Set Up Cloudflare Tunnel

The tunnel exposes your local API to the internet for:
- Frontend apps to connect
- Webhooks (Plaud, Garmin, email)
- Mobile access

1. Install cloudflared:
   ```bash
   brew install cloudflared
   ```

2. Run the setup script:
   ```bash
   ./scripts/setup-tunnel.sh
   ```

3. Follow the prompts to:
   - Authenticate with Cloudflare
   - Create a tunnel named `jd-agent-local`
   - Configure DNS (e.g., `api.jdagent.dev`)

4. Copy the tunnel token to `.env.local.docker`

### Step 3: Export Production Data

If you have existing data in Neon/Railway:

1. Export your production database:
   ```bash
   # Set your production DATABASE_URL
   export PRODUCTION_DATABASE_URL="postgresql://user:pass@ep-xxx.neon.tech/jd_agent?sslmode=require"

   # Run export
   ./scripts/backup-database.sh --export-production
   ```

2. Start local services:
   ```bash
   ./scripts/local-start.sh
   ```

3. Import the data:
   ```bash
   ./scripts/backup-database.sh --restore backups/production_export_*.sql.gz
   ```

### Step 4: Start Local Services

```bash
# Start all services in background
./scripts/local-start.sh

# Check status
./scripts/local-start.sh --status

# View logs
./scripts/local-start.sh --logs hub
```

### Step 5: Update Frontend Configuration

Update your frontend apps to use the tunnel URL:

**Option A: Environment Variables (Recommended for Vercel)**

In Vercel project settings, set:
```
VITE_API_URL=https://api.jdagent.dev
```

**Option B: Local .env files**

In each app's `.env.local`:
```
VITE_API_URL=https://api.jdagent.dev
```

**Option C: Dynamic configuration**

The frontends already have proxy configuration for local development, so `localhost:5173` will proxy to `localhost:3000` automatically during development.

### Step 6: Enable Auto-Start (Optional)

Make JD Agent start automatically when you log in:

```bash
./scripts/install-launchd.sh install
```

This creates a macOS LaunchAgent that:
- Starts Docker containers on login
- Waits for Docker Desktop to be running
- Restarts containers if they crash
- Logs to `~/Library/Logs/jd-agent-docker.log`

To manage:
```bash
./scripts/install-launchd.sh status   # Check status
./scripts/install-launchd.sh logs     # View logs
./scripts/install-launchd.sh stop     # Stop temporarily
./scripts/install-launchd.sh uninstall # Remove auto-start
```

## Testing Checklist

After setup, verify everything works:

### Infrastructure
- [ ] Docker containers are running: `docker compose ps`
- [ ] PostgreSQL is healthy: `docker compose exec postgres pg_isready`
- [ ] Redis is responding: `docker compose exec redis redis-cli ping`
- [ ] Hub API responds: `curl http://localhost:3000/api/health`

### API Endpoints
- [ ] Tasks API: `curl http://localhost:3000/api/tasks`
- [ ] Vault API: `curl http://localhost:3000/api/vault/entries`
- [ ] Calendar API: `curl http://localhost:3000/api/calendar/events`

### Cloudflare Tunnel
- [ ] Tunnel is running: `docker compose ps cloudflared`
- [ ] Public URL works: `curl https://api.jdagent.dev/api/health`

### Frontend Apps
- [ ] Command Center loads: Open http://localhost:5173
- [ ] Tasks app loads: Open http://localhost:5174
- [ ] Vault app loads: Open http://localhost:5175
- [ ] Production frontend connects via tunnel

### Integrations
- [ ] Telegram bot responds (if configured)
- [ ] Plaud webhook receives data
- [ ] Calendar sync works
- [ ] Email ingestion works

### Background Jobs
- [ ] Worker is processing: `docker compose logs worker`
- [ ] Scheduler is running: `docker compose logs scheduler`
- [ ] Cron jobs execute (check logs)

## Database Management

### Backups

Automatic backups with retention:
```bash
# Manual backup
./scripts/backup-database.sh

# Quick backup (no cloud upload)
./scripts/backup-database.sh --quick

# List backups
./scripts/backup-database.sh --list

# Restore from backup
./scripts/backup-database.sh --restore
```

Backup retention:
- Daily: Last 7 days
- Weekly: Last 4 weeks
- Monthly: Last 3 months

### Database Access

```bash
# Connect to database CLI
docker compose exec postgres psql -U jdagent -d jd_agent

# Open Drizzle Studio (run from hub/)
cd hub && bun run db:studio

# Run migrations
docker compose exec hub bun run db:push
```

## Troubleshooting

### Docker Won't Start

```bash
# Check Docker Desktop is running
docker info

# Check disk space
docker system df

# Clean up old containers/images
docker system prune -a
```

### Hub API Not Responding

```bash
# Check container logs
docker compose logs hub --tail=100

# Restart just the hub
docker compose restart hub

# Rebuild if code changed
docker compose up -d --build hub
```

### Database Connection Issues

```bash
# Check PostgreSQL is running
docker compose logs postgres

# Test connection from hub container
docker compose exec hub sh -c 'echo "SELECT 1" | bun run src/db/test-connection.ts'

# Reset database (CAUTION: data loss)
docker compose down -v
docker compose up -d
```

### Tunnel Not Working

```bash
# Check tunnel container
docker compose logs cloudflared

# Verify tunnel token is set
grep CLOUDFLARE_TUNNEL_TOKEN .env.local.docker

# Test tunnel locally
cloudflared tunnel --config ~/.cloudflared/config-jd-agent.yml run
```

### Auto-Start Issues

```bash
# Check LaunchAgent status
./scripts/install-launchd.sh status

# View LaunchAgent logs
./scripts/install-launchd.sh logs

# Reinstall LaunchAgent
./scripts/install-launchd.sh uninstall
./scripts/install-launchd.sh install
```

## File Structure

```
JD Agent/
├── docker-compose.yml          # Docker service definitions
├── hub/
│   └── Dockerfile              # Hub API container image
├── data/
│   ├── postgres/               # PostgreSQL data (persistent)
│   └── redis/                  # Redis data (persistent)
├── backups/
│   ├── daily/                  # Daily backups (7 day retention)
│   ├── weekly/                 # Weekly backups (4 week retention)
│   └── monthly/                # Monthly backups (3 month retention)
├── scripts/
│   ├── local-start.sh          # Main startup script
│   ├── backup-database.sh      # Database backup/restore
│   ├── setup-tunnel.sh         # Cloudflare Tunnel setup
│   ├── install-launchd.sh      # macOS auto-start manager
│   ├── init-db.sql             # PostgreSQL initialization
│   └── launchd/
│       └── dev.jdagent.docker.plist  # LaunchAgent config
├── .env.local.docker           # Environment variables (secrets)
└── .env.local.docker.example   # Environment template
```

## Security Considerations

1. **Secrets**: Never commit `.env.local.docker` - it contains API keys
2. **Tunnel Access**: Consider adding Cloudflare Access policies for authentication
3. **Database**: Only exposed on localhost by default
4. **Backups**: Stored locally; consider enabling R2 upload for redundancy

## Performance Tips

1. **Resource Allocation**: Docker Desktop → Settings → Resources
   - CPUs: 4+
   - Memory: 8GB+
   - Disk: 40GB+

2. **Database Tuning**: For large datasets, adjust PostgreSQL settings in `docker-compose.yml`

3. **Disk I/O**: Keep the project on your main SSD, not external storage

## Next Steps

1. **Monitor Performance**: Use `docker stats` to watch resource usage
2. **Set Up Alerts**: Consider adding health check monitoring
3. **Regular Backups**: The backup script runs automatically with cron, or set up your own schedule
4. **Keep Updated**: Pull latest changes and rebuild containers periodically

## Support

If you encounter issues:
1. Check the logs: `./scripts/local-start.sh --logs`
2. Review this guide's troubleshooting section
3. Check Docker Desktop for resource/disk issues
4. Verify all environment variables are set correctly
