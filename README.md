# JD Agent

Personal AI agent system designed to enable constant state of flow by eliminating administrative overhead, closing all open loops, and providing honest accountability toward goals.

## Phase 0: Foundation

Currently implementing the foundation phase which includes:
- Core infrastructure (Bun, TypeScript, Hono, Drizzle)
- Task system integration (Linear)
- Knowledge vault (PostgreSQL)
- Calendar integration (Google Calendar)
- Master agent core
- Ceremony framework

## Quick Start

### Prerequisites

- [Bun](https://bun.sh/) v1.0+
- PostgreSQL 15+
- Redis (optional for Phase 0)

### Installation

```bash
# Install dependencies
bun install

# Set up environment variables
cp .env.example .env
# Edit .env with your credentials

# Set up database
bun run db:push

# Start development server
bun run dev
```

### Available Scripts

```bash
bun run dev        # Start dev server with hot reload
bun run start      # Start production server
bun run worker     # Start job worker (Phase 1)
bun run scheduler  # Start scheduler (Phase 0 Day 5)

bun run db:generate  # Generate migrations
bun run db:migrate   # Run migrations
bun run db:push      # Push schema to database
bun run db:studio    # Open Drizzle Studio

bun run typecheck  # Run TypeScript checks
bun run test       # Run tests
```

## API Endpoints

### Health
- `GET /api/health` - Full health check with database status
- `GET /api/health/live` - Liveness probe
- `GET /api/health/ready` - Readiness probe

## Architecture

```
src/
├── index.ts              # API entry point
├── worker.ts             # Job processor (Phase 1)
├── scheduler.ts          # Scheduled jobs
├── api/
│   ├── routes/           # API route handlers
│   └── middleware/       # Hono middleware
├── agents/               # AI agents (coming soon)
├── integrations/         # External service integrations
├── jobs/                 # Background job definitions
├── db/
│   ├── schema.ts         # Drizzle schema
│   ├── client.ts         # Database client
│   └── migrations/       # Database migrations
├── services/             # Business logic services
├── lib/                  # Shared utilities
└── types/                # TypeScript types
```

## Technology Stack

- **Runtime:** Bun
- **Framework:** Hono
- **Database:** PostgreSQL + Drizzle ORM
- **AI:** Anthropic Claude (primary)
- **Task System:** Linear
- **Queue:** BullMQ + Redis

## Documentation

- [System Contract](docs/jd-agent-system-contract.md)
- [PRD](docs/jd-agent-prd.md)
- [Technical Architecture](docs/jd-agent-technical-architecture.md)

## License

Private - JD Agent System
