# JD Agent - Master Roadmap v3.1

## Complete Implementation Guide with Hub + Apps Architecture

**Created:** January 7, 2026
**Last Updated:** January 7, 2026
**Status:** Phase 3 - Verify & Coach (75% Complete)

---

## Current System Status

### What's Built & Working

| Component | Status | Notes |
|-----------|--------|-------|
| **Monorepo Structure** | Done | hub/, apps/, packages/ |
| **Database (PostgreSQL)** | Done | 20+ tables, Drizzle ORM |
| **Task Service** | Done | Full CRUD, GTD workflow, filtering |
| **Project Service** | Done | Hierarchy, nested projects |
| **Vault Service** | Done | CRUD, full-text search, attachments |
| **Calendar Service** | Done | Google OAuth sync, events |
| **Master Agent** | Done | 37 tools, OpenAI GPT-4 |
| **Health API** | Done | Real status checks |
| **API Client Package** | Done | @jd-agent/api-client |
| **Shared Types** | Done | @jd-agent/types |
| **Tasks App** | Done | All views, quick add, inline add, nested projects |
| **Vault App** | Done | Search, browse, editor |
| **Command Center** | Done | Dashboard, chat, health, settings |
| **Jobs App** | Done | Full pipeline, Kanban, resumes |
| **Ceremonies** | Done | Morning/evening/weekly framework |
| **Canvas Sync** | Done | Integrity agent, term filtering |
| **Testing Agent** | Done | Claude Vision, 18 tools |
| **Telegram Bot** | Done | Two-way messaging |
| **Background Jobs** | Done | BullMQ + Redis |
| **Scheduled Jobs** | Done | node-cron scheduler |

### What Needs Work

| Component | Status | Gap |
|-----------|--------|-----|
| **Semantic Search** | 70% | Schema ready, wiring incomplete |
| **Vault PARA Folders** | 0% | Flat structure only |
| **Coaching Escalation** | 60% | Patterns work, escalation incomplete |
| **Plaud Pipeline** | 10% | Integration exists, pipeline untested |
| **Remarkable Pipeline** | 10% | Integration exists, pipeline untested |
| **Gmail Task Extraction** | 50% | Ingestion works, task creation limited |
| **Class Agents** | 5% | Stub only |
| **Goals Panel** | 30% | Shows static data |

---

## Architecture Overview

### Hub + Apps Design

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              JD AGENT HUB                                    │
│                        (Backend API - Single Source of Truth)                │
│                                                                              │
│   PostgreSQL ─── Tasks, Vault, Calendar, People, Analytics, Jobs            │
│   Services ───── TaskService, VaultService, CalendarService, AgentService   │
│   Agents ─────── MasterAgent, TestingAgent, JobAgent, CanvasIntegrityAgent  │
│   API ────────── /tasks, /vault, /calendar, /chat, /jobs, /testing, /health │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
                                       │ REST + WebSocket
        ┌──────────────────────────────┼──────────────────────────────┐
        │                              │                              │
        ▼                              ▼                              ▼
┌───────────────┐            ┌───────────────┐            ┌───────────────┐
│   JD Tasks    │            │   JD Vault    │            │  JD Command   │
│   (5174)      │            │   (5175)      │            │    Center     │
│               │            │               │            │   (5173)      │
│ Today/Inbox/  │            │ Search/       │            │ Dashboard/    │
│ Projects      │            │ Journal/Tags  │            │ Analytics     │
└───────────────┘            └───────────────┘            └───────────────┘
        │
        ▼
┌───────────────┐
│   JD Jobs     │
│   (5176)      │
│               │
│ Pipeline/     │
│ Resumes       │
└───────────────┘
```

### Key Decisions

| Decision | Choice | Status |
|----------|--------|--------|
| Task System | **PostgreSQL** | Done - No Linear, single source of truth |
| AI Primary | **OpenAI GPT-4** | Done - With GPT-4o Vision |
| AI Secondary | **Anthropic Claude** | Done - For testing agent |
| Architecture | **Monorepo** | Done - Shared types, independent apps |

---

## Project Structure

```
jd-agent/
├── hub/                          # Backend API (Bun + Hono)
│   ├── src/
│   │   ├── api/routes/           # 28+ route files
│   │   ├── services/             # 28 services
│   │   ├── integrations/         # 14+ integrations
│   │   ├── agents/               # Master, Testing, Job, Canvas agents
│   │   ├── db/                   # Drizzle schema, migrations
│   │   └── jobs/                 # BullMQ processors
│   └── scripts/                  # Test & utility scripts
│
├── apps/
│   ├── tasks/                    # Task management (React + Vite)
│   ├── vault/                    # Knowledge base (React + Vite)
│   ├── command-center/           # Dashboard (React + Vite)
│   └── jobs/                     # Job hunting (React + Vite)
│
├── packages/
│   ├── api-client/               # Typed API client
│   └── types/                    # Shared TypeScript types
│
└── docs/
    ├── jd-agent-prd.md           # Product requirements
    └── vault-restructuring-plan.md  # Vault PARA plan
```

---

## Implementation Status by Day

### Week 1: Foundation - COMPLETE

| Day | Focus | Status | Verification |
|-----|-------|--------|--------------|
| 1 | Restructure | **Done** | Monorepo working, Linear removed |
| 2 | Task Service | **Done** | Full CRUD + filtering |
| 3 | Health + Agent | **Done** | Real health, 37-tool agent |
| 4 | API Client | **Done** | @jd-agent/api-client published |
| 5 | Tasks App UI | **Done** | All views, quick add working |

### Week 2: Vault & Calendar - COMPLETE

| Day | Focus | Status | Verification |
|-----|-------|--------|--------------|
| 6 | Vault Service | **Done** | CRUD + full-text search |
| 7 | Semantic Search | **Partial** | Schema exists, wiring needed |
| 8 | Calendar | **Done** | Google OAuth sync working |
| 9 | Task Scheduling | **Done** | Creates calendar blocks |
| 10 | Ceremonies | **Done** | Morning/evening/weekly |

### Week 3: Apps & Dashboard - COMPLETE

| Day | Focus | Status | Verification |
|-----|-------|--------|--------------|
| 11-12 | Vault App | **Done** | Search, browse, editor |
| 13-14 | Command Center | **Done** | Dashboard with real data |
| 15 | Settings | **Done** | Configuration UI working |

### Week 4: Capture & Coaching - PARTIAL

| Day | Focus | Status | Verification |
|-----|-------|--------|--------------|
| 16-17 | Canvas | **Done** | Integrity agent, term filtering |
| 18-19 | Coaching | **60%** | Patterns work, escalation incomplete |
| 20 | Tasks App Polish | **Done** | Nested projects, inline add |

### Week 5: Polish & Extras - COMPLETE

| Day | Focus | Status | Verification |
|-----|-------|--------|--------------|
| 21 | Vault App | **Done** | Standalone working |
| 22 | API Client | **Done** | Shared typed client |
| 23-24 | Integration Testing | **Done** | Testing agent with Claude Vision |
| 25 | Polish | **Ongoing** | Core features stable |

### Bonus: Additional Features Built

| Feature | Status | Notes |
|---------|--------|-------|
| Jobs App | **Done** | Full pipeline, Kanban, resumes |
| Job Hunting Agent | **Done** | Tracking, profile, screening |
| Testing Agent | **Done** | 18 tools, Claude Vision |
| Canvas Integrity Agent | **Done** | Browser automation, nudges |
| Nested Projects | **Done** | Parent-child hierarchy |
| Inline Task Add | **Done** | Add from project view |

---

## Remaining Work (Priority Order)

### P0 - Critical for Phase 3 Completion

| Task | Effort | Description |
|------|--------|-------------|
| **Wire Semantic Search** | 2 days | Connect pgvector to vault search API |
| **Coaching Escalation** | 2 days | Complete escalation logic, Telegram alerts |

### P1 - High Value

| Task | Effort | Description |
|------|--------|-------------|
| **Vault PARA Folders** | 3 days | Per vault-restructuring-plan.md |
| **Goals Panel** | 1 day | Wire to real goal data |
| **Health Check Accuracy** | 0.5 day | Fix hardcoded values |

### P2 - Medium Priority

| Task | Effort | Description |
|------|--------|-------------|
| **Plaud Pipeline** | 2 days | Test and complete recording flow |
| **Remarkable Pipeline** | 2 days | Test and complete notes flow |
| **Gmail Task Extraction** | 1 day | Wire email → task creation |
| **Class Agents** | 3 days | Implement class-specific assistants |

### P3 - Nice to Have

| Task | Effort | Description |
|------|--------|-------------|
| **Mobile Apps** | TBD | React Native or PWA |
| **Offline Support** | TBD | Service worker, local storage |
| **Collaborative Features** | TBD | Task comments, sharing |

---

## Environment Variables

```bash
# Required
DATABASE_URL=postgresql://...
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# Google (calendar, gmail, drive)
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REFRESH_TOKEN=...

# Canvas LMS
CANVAS_API_TOKEN=...
CANVAS_BASE_URL=https://canvas.instructure.com

# Notifications
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
RESEND_API_KEY=...

# Search & Embeddings
VOYAGE_API_KEY=...

# Storage
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
S3_BUCKET=...

# Optional
TIMEZONE=America/Denver
```

---

## Running the System

### Development

```bash
# Start all services
bun run dev              # Hub API (port 3000)
bun run tasks            # Tasks app (port 5174)
bun run vault            # Vault app (port 5175)
bun run jobs             # Jobs app (port 5176)
bun run command-center   # Dashboard (port 5173)
bun run worker           # Background jobs
bun run scheduler        # Cron jobs

# Database
bun run db:generate      # Generate migrations
bun run db:push          # Push schema
bun run db:studio        # Drizzle Studio

# Testing
bun run test             # Unit tests
bun run test:ai          # AI testing agent (smoke)
bun run test:ai:full     # AI testing agent (full)
```

### Health Check

```bash
curl http://localhost:3000/api/health
# Returns: { status: "ok", services: { database: "connected", ... } }
```

---

## Success Metrics

| Metric | Target | Current |
|--------|--------|---------|
| Task CRUD working | Yes | Yes |
| Vault search working | Yes | Yes (full-text) |
| Calendar sync | Yes | Yes |
| Agent responds | Yes | Yes (37 tools) |
| Apps load | Yes | Yes (all 4) |
| Ceremonies deliver | Yes | Framework done |
| Canvas sync | Yes | Yes |
| Testing agent | Yes | Yes |
| Semantic search | Yes | **No (wiring needed)** |
| Coaching escalation | Yes | **Partial** |

---

## Changelog

### v3.1 - January 7, 2026
- Updated to reflect actual implementation status
- Marked completed items as Done
- Identified remaining gaps
- Added Jobs App and Testing Agent to structure
- Added Canvas Integrity Agent
- Reorganized remaining work by priority

### v3.0 - January 7, 2026
- Initial 20-day plan created
- Hub + Apps architecture defined

---

**END OF ROADMAP**

*Current focus: Complete semantic search wiring and coaching escalation to finish Phase 3.*
