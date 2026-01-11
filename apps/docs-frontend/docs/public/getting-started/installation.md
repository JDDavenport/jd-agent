# Installation Guide

This guide walks you through setting up JD Agent on your machine.

---

## Prerequisites

Before you begin, ensure you have:

| Requirement | Version | Notes |
|-------------|---------|-------|
| **Bun** | 1.0+ | JavaScript runtime |
| **PostgreSQL** | 15+ | Database |
| **Redis** | 6+ | Queue and caching |
| **Node.js** | 18+ | Some tooling requires Node |

### API Keys Required
- **OpenAI API Key** - For the AI agent (GPT-4)
- **Anthropic API Key** - For processing tasks (Claude)

### Optional API Keys
- **Google OAuth** - For Calendar and Gmail integration
- **Telegram Bot Token** - For Telegram notifications
- **Canvas API Token** - For Canvas LMS integration
- **Voyage AI Key** - For semantic search

---

## Step 1: Clone the Repository

```bash
git clone https://github.com/your-repo/jd-agent.git
cd jd-agent
```

---

## Step 2: Install Dependencies

```bash
bun install
```

This installs dependencies for:
- Hub (backend API)
- Command Center app
- Tasks app
- Vault app
- Jobs app
- Shared packages

---

## Step 3: Set Up Environment Variables

Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/jdagent

# Redis
REDIS_URL=redis://localhost:6379

# AI Services (Required)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# Google OAuth (Optional - for Calendar/Gmail)
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback

# Telegram (Optional)
TELEGRAM_BOT_TOKEN=...

# Canvas LMS (Optional)
CANVAS_API_TOKEN=...
CANVAS_BASE_URL=https://your-school.instructure.com

# Voyage AI (Optional - for semantic search)
VOYAGE_API_KEY=...

# Notifications (Optional)
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
RESEND_API_KEY=...
```

---

## Step 4: Set Up the Database

### Create the database:
```bash
createdb jdagent
```

### Push the schema:
```bash
cd hub
bun run db:push
```

### Verify the setup:
```bash
bun run db:studio
```
This opens Drizzle Studio where you can inspect your database.

---

## Step 5: Start the Services

### Option A: Start Everything at Once

From the root directory:
```bash
bun run dev
```

### Option B: Start Services Individually

Open separate terminals for each service:

**Terminal 1 - Hub (Backend API)**
```bash
bun run hub
```
Hub runs on http://localhost:3000

**Terminal 2 - Command Center**
```bash
bun run command-center
```
Command Center runs on http://localhost:5173

**Terminal 3 - Tasks App**
```bash
bun run tasks
```
Tasks app runs on http://localhost:5174

**Terminal 4 - Vault App**
```bash
bun run vault
```
Vault app runs on http://localhost:5175

---

## Step 6: Verify Installation

### Check the API health:
```bash
curl http://localhost:3000/api/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2026-01-08T...",
  "services": {
    "database": "connected",
    "redis": "connected"
  }
}
```

### Open the apps:
- **Command Center**: http://localhost:5173
- **Tasks**: http://localhost:5174
- **Vault**: http://localhost:5175

---

## Step 7: Initial Setup (Optional)

### Run the Setup Wizard

Navigate to http://localhost:3000/setup to:
- Configure your timezone
- Set up morning/evening ceremony times
- Connect Google Calendar
- Configure Telegram bot

### Import Existing Data

If you have data from other systems:

**From Todoist:**
```bash
cd hub
bun run migration/todoist-import.ts
```

**From Apple Notes:**
```bash
cd hub
bun run migration/migrate-apple-notes.ts
```

**From Notion:**
Configure in the setup wizard or use the API.

---

## Running Background Services

For full functionality, start these additional services:

### Job Worker (Background Processing)
```bash
cd hub
bun run worker
```
Handles: transcription, summarization, email triage, task extraction

### Scheduler (Cron Jobs)
```bash
cd hub
bun run scheduler
```
Handles: ceremonies, calendar sync, deadline alerts

---

## Troubleshooting

### Database Connection Failed
- Verify PostgreSQL is running: `pg_isready`
- Check DATABASE_URL is correct
- Ensure the database exists: `psql -l`

### Redis Connection Failed
- Verify Redis is running: `redis-cli ping`
- Check REDIS_URL is correct

### API Key Errors
- Ensure OpenAI/Anthropic keys are valid
- Check for proper formatting (no extra spaces)

### Port Already in Use
```bash
# Find what's using the port
lsof -i :3000

# Kill the process
kill -9 <PID>
```

---

## Next Steps

You're all set up! Continue with:
1. [Quick Start](./quick-start.md) - Create your first task
2. [Core Concepts](./core-concepts.md) - Understand the methodology

---

*Last updated: January 8, 2026*
