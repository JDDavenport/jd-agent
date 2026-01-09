# Phase 3: Verify & Coach - Tutorial

This tutorial walks you through all Phase 3 features of JD Agent: the accountability, verification, and coaching system.

## 🚀 Quick Start

```bash
# Start the server
bun run dev

# The API is available at http://localhost:3000
```

---

## 📊 Feature 1: Dashboard Overview

Get a unified view of your entire system at a glance.

**Endpoint:** `GET /api/analytics/dashboard`

**Example:**
```bash
curl http://localhost:3000/api/analytics/dashboard
```

**Response:**
```json
{
  "timestamp": "2026-01-06T06:08:08.437Z",
  "tasks": {
    "total": 57,
    "completedToday": 0,
    "completedThisWeek": 0,
    "overdue": 0
  },
  "calendar": {
    "eventsToday": 0
  },
  "vault": {
    "totalEntries": 13,
    "addedThisWeek": 13
  },
  "recordings": {
    "total": 0,
    "processed": 0,
    "processingRate": 100
  },
  "timeTracking": {
    "today": {
      "productive": 320,
      "waste": 100,
      "total": 540
    },
    "weeklyTrend": {
      "trend": "stable",
      "averageDailyWaste": 100,
      "change": 0
    }
  },
  "systemHealth": {
    "status": "healthy",
    "recentFailures": 0
  }
}
```

**What it shows:**
- 📋 **Tasks**: Total, completed today/this week, overdue count
- 📅 **Calendar**: Events scheduled for today
- 📚 **Vault**: Knowledge entries and recent additions
- 🎙️ **Recordings**: Processing status
- ⏱️ **Time Tracking**: Productive vs waste time with trends
- 🏥 **System Health**: Overall system status

---

## ⏱️ Feature 2: Time Tracking

Track and analyze where your screen time goes. The system automatically categorizes apps as productive, waste, or neutral.

### Log Screen Time

**Endpoint:** `POST /api/analytics/time/log`

**Example:**
```bash
# Log productive time (coding)
curl -X POST http://localhost:3000/api/analytics/time/log \
  -H "Content-Type: application/json" \
  -d '{"appName": "VSCode", "minutes": 90}'

# Log waste time (games)
curl -X POST http://localhost:3000/api/analytics/time/log \
  -H "Content-Type: application/json" \
  -d '{"appName": "TFT", "minutes": 45}'

# Log with specific date
curl -X POST http://localhost:3000/api/analytics/time/log \
  -H "Content-Type: application/json" \
  -d '{"appName": "YouTube", "minutes": 30, "date": "2026-01-05"}'
```

### App Categories

The system automatically categorizes apps:

| Category | Apps |
|----------|------|
| **Productive** | VSCode, Cursor, IntelliJ, Notion, Figma, Terminal, Linear, Xcode, Android Studio |
| **Waste** | TFT, YouTube, Reddit, Twitter/X, Instagram, TikTok, Netflix, Twitch, Discord (when gaming) |
| **Neutral** | Chrome, Safari, Slack, Messages, Mail, Zoom, Calendar |

### Get Time Analytics

**Endpoint:** `GET /api/analytics/time?days=7`

**Example:**
```bash
curl "http://localhost:3000/api/analytics/time?days=7"
```

**Response:**
```json
{
  "period": "7d",
  "aggregates": {
    "totalProductive": 410,
    "totalWaste": 175,
    "avgDailyWaste": 175
  },
  "topApps": [
    {"name": "VSCode", "minutes": 240},
    {"name": "Chrome", "minutes": 120}
  ],
  "weeklyTrend": {
    "trend": "stable",
    "change": 0
  }
}
```

---

## 🔍 Feature 3: System Verification

Automated integrity checks that catch issues before they become problems.

**Endpoint:** `GET /api/analytics/health`

**Example:**
```bash
curl http://localhost:3000/api/analytics/health
```

**Response:**
```json
{
  "overallStatus": "warning",
  "summary": {
    "passed": 11,
    "failed": 1,
    "warnings": 1
  },
  "checks": [
    {
      "checkType": "tasks_have_due_dates",
      "passed": false,
      "details": {
        "expected": 0,
        "actual": 7,
        "discrepancies": ["7 active tasks missing due dates"]
      }
    },
    {
      "checkType": "overdue_tasks",
      "passed": true,
      "details": {"expected": 0, "actual": 0, "discrepancies": []}
    }
    // ... more checks
  ],
  "browserVerificationAvailable": false
}
```

### Verification Checks

| Check | What it verifies |
|-------|------------------|
| `tasks_have_due_dates` | All active tasks have due dates |
| `overdue_tasks` | No tasks are past due |
| `recordings_processed` | All recordings have been transcribed |
| `class_agents` | Sub-agents exist for all courses |
| `calendar_integrity` | Calendar sync is working |
| `task_calendar_sync` | Tasks with scheduled times have calendar events |
| `orphaned_tasks` | No tasks without valid contexts |
| `orphaned_vault_entries` | No vault entries without sources |
| `task_status_consistency` | Task statuses are valid |
| `stale_data` | No old unprocessed data |
| `duplicate_detection` | No duplicate tasks/entries |
| `database_health` | Database connections are healthy |

---

## 🎯 Feature 4: Goal Tracking

Set and track goals at different time horizons.

### Create a Goal

**Endpoint:** `POST /api/analytics/goals`

**Example:**
```bash
# Semester goal
curl -X POST http://localhost:3000/api/analytics/goals \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Complete MBA Core Courses with 3.8+ GPA",
    "level": "semester",
    "targetDate": "2026-05-15",
    "progress": 15,
    "milestones": [
      {"title": "Complete MBA 500 Final", "completed": false},
      {"title": "Complete MBA 550 Project", "completed": false}
    ]
  }'

# Weekly goal
curl -X POST http://localhost:3000/api/analytics/goals \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Finish all MBA 560 assignments",
    "level": "weekly",
    "targetDate": "2026-01-12",
    "progress": 0
  }'
```

### Goal Levels

| Level | Time Horizon | Example |
|-------|--------------|---------|
| `semester` | 4-6 months | Graduate with honors |
| `monthly` | 1 month | Complete capstone research |
| `weekly` | 1 week | Finish all assignments |
| `daily` | 1 day | Complete today's tasks |

### Get All Goals

**Endpoint:** `GET /api/analytics/goals`

**Example:**
```bash
curl http://localhost:3000/api/analytics/goals
```

**Response:**
```json
{
  "goals": [
    {
      "id": "uuid-here",
      "title": "Complete MBA Core Courses with 3.8+ GPA",
      "level": "semester",
      "progress": 15,
      "status": "on_track",
      "targetDate": "2026-05-15",
      "milestones": [
        {"title": "Complete MBA 500 Final", "completed": false}
      ]
    }
  ]
}
```

### Update Goal Progress

**Endpoint:** `PUT /api/analytics/goals/:id`

**Example:**
```bash
curl -X PUT http://localhost:3000/api/analytics/goals/goal-id \
  -H "Content-Type: application/json" \
  -d '{"progress": 50}'
```

---

## 🏈 Feature 5: Accountability Coaching

The coaching system provides honest, escalating feedback based on your actual performance.

**Endpoint:** `GET /api/analytics/coaching`

**Example:**
```bash
curl http://localhost:3000/api/analytics/coaching
```

**Response:**
```json
{
  "tasksCompleted": 15,
  "tasksMissed": 3,
  "completionRate": 83,
  "timeWasted": 175,
  "escalationLevel": 1,
  "patterns": [
    {
      "type": "procrastination",
      "description": "Tasks often completed last minute",
      "suggestion": "Try starting tasks 24 hours before the deadline"
    }
  ],
  "coachingMessage": "Good week overall. 15 tasks completed, 83% completion rate. Keep it up."
}
```

### Escalation Levels

The coaching system escalates if you're not meeting your commitments:

| Level | Trigger | Response Style |
|-------|---------|----------------|
| 1 | Normal performance | Encouraging, supportive |
| 2 | 2+ missed tasks | Firm reminders |
| 3 | Pattern of misses | Direct accountability |
| 4 | Consistent issues | Blunt confrontation |
| 5 | Crisis mode | Emergency intervention |

### Pattern Detection

The system detects behavioral patterns:
- **Procrastination**: Tasks completed last minute
- **Morning/Evening bias**: When you're most productive
- **App addiction**: Excessive time on waste apps
- **Context switching**: Too much time between tasks

---

## 📋 Feature 6: Task Analytics

Detailed metrics on task completion and distribution.

**Endpoint:** `GET /api/analytics/tasks?period=30d`

**Example:**
```bash
curl "http://localhost:3000/api/analytics/tasks?period=30d"
```

**Response:**
```json
{
  "period": "30d",
  "byStatus": {
    "inbox": 1,
    "upcoming": 56
  },
  "bySource": {
    "canvas": 47,
    "manual": 10
  },
  "byContext": [
    {"context": "MBA 560-001: Business Analytics", "count": 27},
    {"context": "SWELL 132-004: Golf, Intermediate", "count": 20}
  ]
}
```

**Periods available:** `24h`, `7d`, `30d`, `90d`

---

## 🔄 Scheduled Jobs (Automatic)

These run automatically when the scheduler is active:

| Job | Schedule | What it does |
|-----|----------|--------------|
| Morning Digest | 5:55 AM | Summary of today's tasks and events |
| Evening Digest | 8:55 PM | Review of day's accomplishments |
| Deadline Alerts | Every 15 min | Warns about upcoming deadlines |
| Integrity Checks | Daily at midnight | Runs full verification suite |
| Weekly Coaching | Sundays | Generates coaching report |

---

## 🛠️ Troubleshooting

### Common Issues

**1. "Column does not exist" errors**
```bash
# Run database migration
bun run db:push
```

**2. Time tracking not updating**
```bash
# Check database connection
curl http://localhost:3000/api/health
```

**3. Verification checks failing**
- Check if integrations are configured (Google Calendar, Canvas, etc.)
- Some checks require external services to be set up

---

## 📞 API Endpoints Summary

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/analytics/dashboard` | GET | Central dashboard |
| `/api/analytics/health` | GET | System verification |
| `/api/analytics/time` | GET | Time analytics |
| `/api/analytics/time/log` | POST | Log screen time |
| `/api/analytics/goals` | GET | List goals |
| `/api/analytics/goals` | POST | Create goal |
| `/api/analytics/goals/:id` | PUT | Update goal |
| `/api/analytics/coaching` | GET | Coaching report |
| `/api/analytics/tasks` | GET | Task analytics |

---

## 🎓 Next Steps

1. **Set up your goals**: Create semester, monthly, and weekly goals
2. **Start tracking time**: Log your screen time daily
3. **Review coaching**: Check the coaching endpoint weekly
4. **Fix verification issues**: Address any failed checks

Phase 3 transforms JD Agent from a task manager into an accountability partner that keeps you honest about your time and progress.
