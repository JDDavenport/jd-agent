# JD Agent - Complete Tutorial

Welcome to **JD Agent**, your personal AI-powered productivity system. This tutorial will walk you through every feature we've built in Phase 0.

---

## 🚀 Quick Start

### 1. Start the Server

```bash
cd "/Users/jddavenport/Projects/JD Agent"
bun run dev
```

Server runs at: **http://localhost:3000**

---

## 💬 THREE WAYS TO CHAT WITH YOUR AGENT

You have **three interfaces** to interact with your AI agent. Pick what works best for you:

### 1️⃣ Web Chat UI (Best for Desktop)

**URL:** http://localhost:3000/chat

This is a beautiful chat interface in your browser:
- Type naturally or use quick action buttons
- See formatted responses with markdown
- Quick buttons: Today, Due Soon, Inbox, Briefing, System

### 2️⃣ Telegram Bot (Best for Mobile)

**Bot:** @JDtwobot

Message the bot on Telegram for:
- Quick task creation: `/add Buy groceries`
- Morning briefing: `/morning`
- Canvas assignments: `/canvas`
- Or just chat naturally!

**Telegram Commands:**
| Command | What it does |
|---------|--------------|
| `/start` | Get welcome message |
| `/today` | Today's tasks & calendar |
| `/inbox` | Items needing attention |
| `/canvas` | Canvas assignments |
| `/due` | Upcoming due dates |
| `/morning` | Morning briefing |
| `/add <task>` | Quick add a task |
| `/help` | All commands |

### 3️⃣ API (For Developers/Scripts)

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "What do I have going on today?"}'
```

### What the Agent Can Do

| Command Type | Example | What Happens |
|--------------|---------|--------------|
| **Task Creation** | "Remind me to call mom tomorrow" | Creates task with due date |
| **Task Queries** | "What's on my plate today?" | Lists today's tasks |
| **Calendar** | "What meetings do I have this week?" | Shows calendar events |
| **Vault Search** | "What do I know about marketing?" | Searches your knowledge base |
| **Canvas** | "Sync my Canvas assignments" | Pulls latest from Canvas |
| **Time Tracking** | "How productive was I today?" | Shows productivity report |
| **System Health** | "Run an integrity check" | Validates data consistency |

---

## ✅ Task Management

Tasks flow through these statuses:
```
Inbox → Today → Doing → Done
         ↓
      Upcoming → Waiting → Someday
```

### API Endpoints

```bash
# List all tasks
curl http://localhost:3000/api/tasks

# Get today's tasks
curl http://localhost:3000/api/tasks/today

# Get inbox items
curl http://localhost:3000/api/tasks/inbox

# Get task counts
curl http://localhost:3000/api/tasks/counts

# Create a task
curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Complete MBA 560 assignment",
    "dueDate": "2026-01-20",
    "dueDateIsHard": true,
    "context": "MBA 560",
    "priority": 3
  }'

# Update task status
curl -X PATCH http://localhost:3000/api/tasks/{id} \
  -H "Content-Type: application/json" \
  -d '{"status": "today"}'

# Mark task complete
curl -X POST http://localhost:3000/api/tasks/{id}/complete
```

### Task Properties

| Field | Description |
|-------|-------------|
| `title` | What needs to be done |
| `description` | Additional details |
| `status` | inbox, today, upcoming, waiting, someday, done |
| `priority` | 0=none, 1=low, 2=medium, 3=high, 4=urgent |
| `dueDate` | When it's due (ISO format) |
| `dueDateIsHard` | true = deadline, false = soft target |
| `context` | Class, project, or life area |
| `source` | Where it came from (manual, canvas, email, etc.) |
| `energyLevel` | low, medium, high (for energy-based scheduling) |

---

## 📚 Canvas LMS Integration

Canvas syncs your courses and assignments automatically.

### Check Your Courses

```bash
# See all current semester courses (published + unpublished)
curl http://localhost:3000/api/ingestion/canvas/current-courses

# Get upcoming assignments
curl http://localhost:3000/api/ingestion/canvas/assignments

# Sync everything to tasks
curl -X POST http://localhost:3000/api/ingestion/canvas/sync

# Daily check (finds newly published courses)
curl -X POST http://localhost:3000/api/ingestion/canvas/daily-check

# Deep scan a specific course
curl http://localhost:3000/api/ingestion/canvas/course/{courseId}/deep-scan
```

### What Gets Synced

| Canvas Item | JD Agent |
|-------------|----------|
| Assignments with due dates | → Tasks (inbox) |
| Announcements | → Vault entries |
| Course syllabus | → Vault entries |
| Courses | → Classes table |

### Unpublished Course Monitoring

4 of your courses are waiting to be published. The system checks daily at:
- **6:30 AM** - Morning check
- **12:00 PM** - Midday check  
- **6:00 PM** - Evening check

When a professor publishes a course, you'll get a **Telegram notification**! 🎉

---

## 📖 Knowledge Vault

Store and search your knowledge, notes, and reference material.

### API Endpoints

```bash
# Search the vault
curl "http://localhost:3000/api/vault/search?q=marketing%20strategy"

# List all entries
curl http://localhost:3000/api/vault

# Create an entry
curl -X POST http://localhost:3000/api/vault \
  -H "Content-Type: application/json" \
  -d '{
    "title": "MBA 560 Lecture Notes - Week 1",
    "content": "Key concepts: data visualization, PowerBI basics...",
    "contentType": "note",
    "context": "MBA 560",
    "tags": ["analytics", "powerbi", "lecture"]
  }'

# Get vault stats
curl http://localhost:3000/api/vault/stats

# Get all tags
curl http://localhost:3000/api/vault/tags

# Get all contexts
curl http://localhost:3000/api/vault/contexts
```

### Content Types

| Type | Use For |
|------|---------|
| `note` | Quick notes, ideas |
| `document` | Longer documents, PDFs |
| `transcript` | Meeting/lecture transcripts |
| `summary` | AI-generated summaries |
| `reference` | Reference material |

---

## 📅 Calendar Integration

Connects to Google Calendar for event management.

### API Endpoints

```bash
# Get today's events
curl http://localhost:3000/api/calendar/today

# Get upcoming events (next 7 days)
curl http://localhost:3000/api/calendar/upcoming

# Sync with Google Calendar
curl -X POST http://localhost:3000/api/calendar/sync

# Check for conflicts
curl -X POST http://localhost:3000/api/calendar/conflicts \
  -H "Content-Type: application/json" \
  -d '{
    "startTime": "2026-01-10T10:00:00Z",
    "endTime": "2026-01-10T11:00:00Z"
  }'

# Create an event
curl -X POST http://localhost:3000/api/calendar \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Study Session",
    "startTime": "2026-01-10T14:00:00Z",
    "endTime": "2026-01-10T16:00:00Z",
    "eventType": "blocked_time",
    "context": "MBA 560"
  }'
```

---

## 🌅 Ceremonies (Daily Briefings)

Automated morning and evening briefings sent via Telegram.

### Schedule

| Ceremony | Time | Content |
|----------|------|---------|
| **Morning** | 6:00 AM | Today's tasks, calendar, priorities |
| **Evening** | 9:00 PM | What got done, what's tomorrow |
| **Weekly** | Sunday 4:00 PM | Week review, planning ahead |

### API Endpoints

```bash
# Get ceremony status
curl http://localhost:3000/api/ceremonies/status

# Preview a ceremony
curl http://localhost:3000/api/ceremonies/preview/morning

# Trigger manually
curl -X POST http://localhost:3000/api/ceremonies/trigger/morning

# Send test notification
curl -X POST http://localhost:3000/api/ceremonies/test
```

---

## ⏱️ Time Tracking

Track your productivity and screen time.

### API Endpoints

```bash
# Log today's time
curl -X POST http://localhost:3000/api/system/time/log \
  -H "Content-Type: application/json" \
  -d '{
    "totalScreenTimeMinutes": 480,
    "productiveMinutes": 320,
    "wasteMinutes": 100,
    "appBreakdown": {
      "VSCode": 180,
      "Chrome": 120,
      "Slack": 60
    }
  }'

# Get today's report
curl http://localhost:3000/api/system/time/report

# Get weekly stats
curl http://localhost:3000/api/system/time/stats?days=7

# Get weekly comparison
curl http://localhost:3000/api/system/time/weekly
```

### Productivity Grades

| Grade | Productivity Rate |
|-------|-------------------|
| A | 80%+ |
| B | 65-79% |
| C | 50-64% |
| D | 35-49% |
| F | Below 35% |

---

## 🔧 System Health & Integrity

Monitor system health and data consistency.

### API Endpoints

```bash
# Health check
curl http://localhost:3000/api/health

# Detailed health status
curl http://localhost:3000/api/system/health

# System info
curl http://localhost:3000/api/system/info

# Run integrity checks
curl -X POST http://localhost:3000/api/system/integrity/check \
  -H "Content-Type: application/json" \
  -d '{"autoFix": false}'

# View integrity history
curl http://localhost:3000/api/system/integrity/history
```

### Integrity Checks

| Check | What It Does |
|-------|--------------|
| `orphaned_tasks` | Finds tasks referencing deleted projects |
| `orphaned_vault_entries` | Finds entries referencing deleted recordings |
| `task_status_consistency` | Ensures done tasks have completion dates |
| `stale_data` | Finds items stuck too long in "today" or "waiting" |
| `duplicate_detection` | Finds potential duplicate tasks |
| `database_health` | Verifies database connectivity |

---

## 🔔 Notifications

Multi-channel notifications via Telegram, SMS, or Email.

### Currently Configured

- ✅ **Telegram**: @JDtwobot (primary)
- ❌ Twilio SMS: Not configured
- ❌ Resend Email: Not configured

### Test Notifications

```bash
# Test via setup wizard
curl -X POST http://localhost:3000/api/setup/connect/telegram/test

# Test ceremony notification
curl -X POST http://localhost:3000/api/ceremonies/test
```

---

## 🎓 Your Current Semester

### Courses (Winter 2026)

**Published (8):**
| Course | Status |
|--------|--------|
| MBA 500: Career Development | ✅ |
| MBA 505: Leadership | ✅ |
| MBA 530: Operations Management | ✅ |
| MBA 548-001: Strategic Human Resource Mgt | ✅ |
| MBA 550-001: Marketing Management | ✅ |
| MBA 560-001: Business Analytics | ✅ |
| MBA Student Resources | ✅ |
| SWELL 132-004: Golf, Intermediate | ✅ |

**Waiting for Professors (4):**
| Course | Status |
|--------|--------|
| MBA 570-002: Entrepreneurial Innovation | ⏳ |
| MBA 580-002: Business Strategy | ⏳ |
| MBA 584: Intro to Global Management | ⏳ |
| MBA 677R-001: Entrepreneurship Through Acquisition | ⏳ |

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     JD AGENT SYSTEM                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │   Master    │    │   Canvas    │    │   Google    │     │
│  │   Agent     │    │     LMS     │    │  Calendar   │     │
│  │  (GPT-4)    │    │             │    │             │     │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘     │
│         │                  │                  │             │
│         ▼                  ▼                  ▼             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                    API Layer (Hono)                  │   │
│  │  /chat  /tasks  /vault  /calendar  /ceremonies      │   │
│  │  /ingestion  /system  /setup  /webhooks             │   │
│  └──────────────────────────┬──────────────────────────┘   │
│                             │                               │
│                             ▼                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Services Layer                          │   │
│  │  TaskService | VaultService | CalendarService        │   │
│  │  CeremonyService | TimeTrackingService | SetupService│   │
│  └──────────────────────────┬──────────────────────────┘   │
│                             │                               │
│                             ▼                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              PostgreSQL Database                     │   │
│  │  tasks | vault_entries | calendar_events | classes   │   │
│  │  ceremonies | time_tracking | integrity_checks       │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔑 Environment Variables

Your current configuration:

| Variable | Status | Purpose |
|----------|--------|---------|
| `DATABASE_URL` | ✅ | PostgreSQL connection |
| `OPENAI_API_KEY` | ✅ | GPT-4 for the agent |
| `TELEGRAM_TOKEN` | ✅ | Bot notifications |
| `TELEGRAM_CHAT_ID` | ✅ | Your chat ID |
| `CANVAS_BASE_URL` | ✅ | BYU Canvas URL |
| `CANVAS_TOKEN` | ✅ | Canvas API access |
| `CANVAS_TERM_FILTER` | ✅ | "MBA,SWELL" |
| `LINEAR_API_KEY` | ✅ | Task management |
| `GOOGLE_CLIENT_ID` | ✅ | Calendar OAuth |
| `GOOGLE_CLIENT_SECRET` | ✅ | Calendar OAuth |
| `GOOGLE_REFRESH_TOKEN` | ✅ | Calendar OAuth |

---

## 📝 Daily Workflow Recommendation

### Morning (6:00 AM)
1. Receive morning briefing via Telegram
2. Review today's tasks and calendar
3. Agent runs Canvas sync (catches new assignments)

### Throughout the Day
1. Use the agent to capture tasks: "I need to..."
2. Process inbox items when you have time
3. Mark tasks complete as you go

### Evening (9:00 PM)
1. Receive evening briefing
2. Review what got done
3. Optional: Log time tracking data

### Weekly (Sunday 4:00 PM)
1. Receive weekly review
2. Plan the upcoming week
3. Check Canvas for newly published courses

---

## 🆘 Troubleshooting

### Server Won't Start
```bash
# Check if port 3000 is in use
lsof -i :3000

# Kill existing process
pkill -f "bun run"
```

### Database Connection Failed
```bash
# Check PostgreSQL is running
pg_isready -h localhost -p 5432

# Start PostgreSQL
brew services start postgresql@16
```

### Canvas Token Invalid
1. Go to BYU Canvas → Account → Settings
2. Generate new access token
3. Update `CANVAS_TOKEN` environment variable

### No Telegram Notifications
1. Make sure you've messaged the bot first
2. Verify `TELEGRAM_CHAT_ID` is set
3. Test: `curl -X POST http://localhost:3000/api/setup/connect/telegram/test`

---

## 🎯 What's Next (Phase 1+)

Future features planned:
- Email triage with Gmail integration
- Plaud voice recording transcription
- Remarkable handwriting sync
- Smart scheduling suggestions
- Habit tracking
- Focus mode with Pomodoro

---

**You're all set!** Start by visiting http://localhost:3000/setup and then try chatting with your agent at `/api/chat`. 🚀
