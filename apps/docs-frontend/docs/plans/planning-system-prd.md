# Planning System - Product Requirements Document

## Version 1.0 | January 23, 2026

---

# Executive Summary

The Planning System transforms JD Agent's Command Center into a comprehensive planning hub that enables intentional time allocation through visual drag-and-drop interfaces. It supports both daily tactical planning and weekly strategic planning, while providing system health monitoring to ensure all integrations are functioning correctly.

**Core Philosophy:** "Plan your work, work your plan."

---

# Part 1: Overview

## Problem Statement

Current productivity systems treat task management and time management as separate concerns. Users:
- Have tasks in a list but no clear picture of when they'll do them
- Struggle to balance immediate work with weekly priorities
- Lack visibility into whether background jobs and integrations are healthy
- Miss the ritual of intentional planning (daily reviews, weekly reviews)

## Solution

A unified planning system with three core components:

1. **Daily Planning** - Tactical: What am I doing today and tomorrow?
2. **Weekly Planning** - Strategic: What are my priorities for the next 2 weeks?
3. **System Health** - Operational: Is everything working correctly?

## User Stories

As a user, I want to:
- See today's tasks alongside tomorrow's calendar so I can prepare
- Drag tasks from my backlog onto specific days/times to schedule them
- Prioritize my weekly backlog by drag-and-drop reordering
- Monitor system health to know if my automations are working
- Complete a daily planning ritual that sets me up for success

---

# Part 2: Weekly Planning

## Overview

Weekly Planning is a Friday ritual for strategic planning. Users review their weekly backlog and allocate tasks across the next 2+ weeks.

## User Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         WEEKLY PLANNING PAGE                                 │
│                                                                              │
│  ┌─────────────────────┐  ┌─────────────────────────────────────────────┐  │
│  │   WEEKLY BACKLOG    │  │              17-DAY CALENDAR                 │  │
│  │                     │  │                                              │  │
│  │  #weekly-backlog    │  │   Fri  Sat  Sun  Mon  Tue  Wed  Thu  ...   │  │
│  │                     │  │   24   25   26   27   28   29   30         │  │
│  │  ┌───────────────┐  │  │  ┌────┬────┬────┬────┬────┬────┬────┐     │  │
│  │  │ ≡ Task 1   P3 │◄─┼──┼──│6am │    │    │    │    │    │    │     │  │
│  │  └───────────────┘  │  │  ├────┼────┼────┼────┼────┼────┼────┤     │  │
│  │  ┌───────────────┐  │  │  │7am │    │    │    │    │    │    │     │  │
│  │  │ ≡ Task 2   P2 │  │  │  ├────┼────┼────┼────┼────┼────┼────┤     │  │
│  │  └───────────────┘  │  │  │8am │    │ ▓▓ │    │    │    │    │     │  │
│  │  ┌───────────────┐  │  │  ├────┼────┼────┼────┼────┼────┼────┤     │  │
│  │  │ ≡ Task 3   P1 │  │  │  │9am │    │ ▓▓ │    │ ▓▓ │    │    │     │  │
│  │  └───────────────┘  │  │  ├────┼────┼────┼────┼────┼────┼────┤     │  │
│  │                     │  │  │10am│    │    │ ▓▓ │ ▓▓ │    │    │     │  │
│  │  Drag to reorder    │  │  └────┴────┴────┴────┴────┴────┴────┘     │  │
│  │  Drag to calendar   │  │                                              │  │
│  │  to schedule        │  │  ▓▓ = Google Calendar events                │  │
│  │                     │  │  ░░ = Scheduled tasks                       │  │
│  └─────────────────────┘  └─────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Features

### 2.1 Weekly Backlog Panel (Left)

**Purpose:** Display and manage tasks tagged with `#weekly-backlog`

**Requirements:**
- [ ] Display all tasks with `taskLabels` containing "weekly-backlog"
- [ ] Show task title, priority indicator (color-coded border), time estimate
- [ ] Show project name and context if assigned
- [ ] Drag handle for reordering within backlog
- [ ] Checkbox to complete tasks directly
- [ ] Task count in header
- [ ] Empty state with instructions

**Interactions:**
- Drag within list → Reorder (persists to `sortOrder` field)
- Drag to calendar → Schedule task
- Click checkbox → Complete task
- Click task → Open task detail panel (future)

### 2.2 Planning Calendar (Right)

**Purpose:** 17-day calendar view for scheduling tasks

**Requirements:**
- [ ] Date range: Friday of current week through Sunday of week-after-next (17 days)
- [ ] Time grid: 6am - 10pm, 50px per hour
- [ ] Display Google Calendar events (color-coded by type)
- [ ] Display scheduled tasks (tasks with `scheduledStart`)
- [ ] Droppable time slots for each hour
- [ ] Current time indicator (red line) for today
- [ ] Auto-scroll to current hour on load

**Event Types & Colors:**
| Type | Color | Description |
|------|-------|-------------|
| meeting | Purple | Meetings, calls |
| class | Blue | Classes, lectures |
| deadline | Red | Hard deadlines |
| personal | Green | Personal events |
| blocked_time | Yellow | Focus time, blocked |

**Interactions:**
- Drop task on time slot → Schedule task at that time
- Hover time slot → Highlight as drop target

### 2.3 Drag-and-Drop Behavior

**Scheduling a Task:**
1. User drags task from backlog
2. Hovers over calendar time slot
3. Slot highlights to show it's a valid target
4. User drops task
5. System:
   - Sets `scheduledStart` to slot datetime
   - Sets `scheduledEnd` based on `timeEstimateMinutes` (default 60min)
   - Removes `weekly-backlog` label (optional, configurable)
   - Creates Google Calendar event (optional, configurable)

**Reordering Backlog:**
1. User drags task within backlog list
2. Other tasks shift to show insertion point
3. User drops task in new position
4. System persists new order via `POST /api/tasks/reorder`

## API Requirements

### Existing Endpoints (Modified)

**GET /api/tasks**
- Add `label` query parameter to filter by `taskLabels` array
- Example: `GET /api/tasks?label=weekly-backlog`

### New Endpoints

**POST /api/tasks/reorder**
```typescript
// Request
{
  ids: string[]  // Task IDs in desired order
}

// Response
{
  success: true,
  count: number  // Number of tasks reordered
}
```

**POST /api/tasks/:id/schedule**
```typescript
// Request
{
  startTime: string,      // ISO datetime
  endTime?: string,       // ISO datetime (optional)
  createCalendarEvent?: boolean  // Default: true
}

// Response
{
  success: true,
  task: Task,
  calendarEvent?: CalendarEvent
}
```

## Database Changes

**tasks table** - Existing fields used:
- `taskLabels: text[]` - Array of labels including "weekly-backlog"
- `sortOrder: integer` - For backlog ordering
- `scheduledStart: timestamp` - When task is scheduled
- `scheduledEnd: timestamp` - End time for scheduled task
- `calendarEventId: text` - Link to Google Calendar event

---

# Part 3: Daily Planning

## Overview

Daily Planning is a morning/evening ritual for tactical planning. Users review today's commitments and prepare for tomorrow.

## User Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         DAILY PLANNING PAGE                                  │
│                                                                              │
│  ┌─────────────────────────────────┐  ┌─────────────────────────────────┐  │
│  │          TODAY                   │  │         TOMORROW                 │  │
│  │       January 23, 2026          │  │       January 24, 2026          │  │
│  │                                  │  │                                  │  │
│  │  CALENDAR                        │  │  CALENDAR                        │  │
│  │  ┌────────────────────────────┐ │  │  ┌────────────────────────────┐ │  │
│  │  │ 9:00  Team Standup         │ │  │  │ 10:00 Client Meeting       │ │  │
│  │  │ 11:00 1:1 with Manager     │ │  │  │ 2:00  MBA 560 Class        │ │  │
│  │  │ 2:00  MBA 677R Class       │ │  │  └────────────────────────────┘ │  │
│  │  └────────────────────────────┘ │  │                                  │  │
│  │                                  │  │  TASKS                           │  │
│  │  TASKS                           │  │  ┌────────────────────────────┐ │  │
│  │  ┌────────────────────────────┐ │  │  │ ☐ Prepare presentation     │ │  │
│  │  │ ☐ Review PR #123           │ │  │  │ ☐ Review meeting notes     │ │  │
│  │  │ ☐ Write unit tests         │ │  │  └────────────────────────────┘ │  │
│  │  │ ☐ Email follow-up          │ │  │                                  │  │
│  │  └────────────────────────────┘ │  │  DROP ZONE                       │  │
│  │                                  │  │  ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐ │  │
│  │  COMPLETED                       │  │    Drag tasks here to           │  │
│  │  ┌────────────────────────────┐ │  │  │ schedule for tomorrow       │ │  │
│  │  │ ☑ Morning standup prep     │ │  │  └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘ │  │
│  │  │ ☑ Code review              │ │  │                                  │  │
│  │  └────────────────────────────┘ │  │                                  │  │
│  └─────────────────────────────────┘  └─────────────────────────────────┘  │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                        UNSCHEDULED TASKS                                 ││
│  │  Tasks with no scheduled date - drag to Today or Tomorrow               ││
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      ││
│  │  │ Task A   │ │ Task B   │ │ Task C   │ │ Task D   │ │ Task E   │      ││
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘      ││
│  └─────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
```

## Features

### 3.1 Today Panel (Left)

**Purpose:** Show what's committed for today

**Requirements:**
- [ ] Today's date prominently displayed
- [ ] Calendar events for today (from Google Calendar)
- [ ] Tasks scheduled for today (`scheduledStart` is today)
- [ ] Tasks with `status: 'today'`
- [ ] Completed tasks section (collapsible)
- [ ] Visual timeline showing time blocks

### 3.2 Tomorrow Panel (Right)

**Purpose:** Prepare for tomorrow

**Requirements:**
- [ ] Tomorrow's date displayed
- [ ] Calendar events for tomorrow
- [ ] Tasks already scheduled for tomorrow
- [ ] Drop zone for scheduling tasks
- [ ] Preview of free time slots

### 3.3 Unscheduled Tasks Tray (Bottom)

**Purpose:** Quick access to tasks that need scheduling

**Requirements:**
- [ ] Horizontal scrolling list of unscheduled tasks
- [ ] Filter options: Inbox, Today status, High priority
- [ ] Drag to Today or Tomorrow to schedule
- [ ] Quick-add button for new tasks

### 3.4 Journal Integration

**Purpose:** Connect planning to reflection

**Requirements:**
- [ ] "Start Daily Journal" button
- [ ] Opens Daily Journal app with pre-populated context
- [ ] Context includes:
  - Tasks completed today
  - Tomorrow's schedule preview
  - Reflection prompts

## Interactions

**Drag task to Today:**
- Sets `scheduledStart` to today (no specific time)
- Or sets `status: 'today'` if no time specified

**Drag task to Tomorrow:**
- Sets `scheduledStart` to tomorrow
- Opens time picker modal for specific time (optional)

**Drag task to specific time slot:**
- Sets `scheduledStart` to that datetime
- Sets `scheduledEnd` based on estimate

---

# Part 4: System Health Dashboard

## Overview

Transform the Command Center dashboard into a System Health monitoring page. Shows job execution history, integration status, and alerts.

## User Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SYSTEM HEALTH DASHBOARD                              │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                        INTEGRATION STATUS                                ││
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      ││
│  │  │ ● Google │ │ ● Whoop  │ │ ● Plaud  │ │ ○ Canvas │ │ ● Vault  │      ││
│  │  │ Calendar │ │  Active  │ │  Syncing │ │  Error   │ │  Healthy │      ││
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘      ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│  ┌────────────────────────────────┐  ┌────────────────────────────────────┐ │
│  │      JOB EXECUTION HISTORY     │  │         ALERTS & ISSUES            │ │
│  │                                 │  │                                    │ │
│  │  ┌─────────────────────────┐   │  │  ⚠️  Canvas sync failed (2h ago)   │ │
│  │  │ calendar-sync    ● Pass │   │  │      Error: Token expired          │ │
│  │  │ 12:00 PM         2.3s   │   │  │      [Retry] [View Logs]           │ │
│  │  ├─────────────────────────┤   │  │                                    │ │
│  │  │ plaud-import     ● Pass │   │  │  ⚠️  Whoop needs re-auth (1d ago)  │ │
│  │  │ 11:45 AM         5.1s   │   │  │      Session expired               │ │
│  │  ├─────────────────────────┤   │  │      [Re-authenticate]             │ │
│  │  │ canvas-sync      ○ Fail │   │  │                                    │ │
│  │  │ 10:00 AM         0.8s   │   │  │  ℹ️  3 recordings pending process  │ │
│  │  ├─────────────────────────┤   │  │      [Process Now]                 │ │
│  │  │ whoop-metrics    ● Pass │   │  │                                    │ │
│  │  │ 6:00 AM          1.2s   │   │  └────────────────────────────────────┘ │
│  │  └─────────────────────────┘   │                                         │
│  │                                 │  ┌────────────────────────────────────┐ │
│  │  [View All Jobs]               │  │      QUICK STATS (24h)             │ │
│  └────────────────────────────────┘  │                                    │ │
│                                       │  Jobs Run:        47               │ │
│  ┌────────────────────────────────┐  │  Success Rate:    94%              │ │
│  │     INTEGRATION DETAILS        │  │  Avg Duration:    2.1s             │ │
│  │                                 │  │  Tasks Created:   12               │ │
│  │  Whoop                          │  │  Vault Entries:   8                │ │
│  │  ├─ Last Sync: 6:00 AM         │  │                                    │ │
│  │  ├─ Recovery: 67%              │  └────────────────────────────────────┘ │
│  │  ├─ Sleep: 7h 23m              │                                         │
│  │  └─ Auto-login: ● Active       │                                         │
│  │                                 │                                         │
│  │  Plaud                          │                                         │
│  │  ├─ Last Sync: 11:45 AM        │                                         │
│  │  ├─ Recordings: 156 total      │                                         │
│  │  ├─ Pending: 3                 │                                         │
│  │  └─ Storage: 2.3 GB used       │                                         │
│  │                                 │                                         │
│  │  Remarkable                     │                                         │
│  │  ├─ Last Sync: 8:00 AM         │                                         │
│  │  ├─ Notes: 234 total           │                                         │
│  │  └─ Pending OCR: 0             │                                         │
│  └────────────────────────────────┘                                         │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Features

### 4.1 Integration Status Bar

**Purpose:** At-a-glance health of all integrations

**Requirements:**
- [ ] Show all active integrations
- [ ] Status indicators: ● Healthy (green), ◐ Warning (yellow), ○ Error (red)
- [ ] Click to expand details
- [ ] Last sync time for each

**Integrations to Monitor:**
| Integration | Metrics |
|-------------|---------|
| Google Calendar | Last sync, events synced |
| Whoop | Last sync, recovery score, auto-login status |
| Plaud | Last sync, recordings count, pending transcriptions |
| Remarkable | Last sync, notes count, pending OCR |
| Canvas | Last sync, assignments synced |
| Gmail | Last check, unread count |
| Telegram | Bot status, last message |

### 4.2 Job Execution History

**Purpose:** See what background jobs have run

**Requirements:**
- [ ] List of recent job executions (last 24h)
- [ ] Job name, status (pass/fail), duration, timestamp
- [ ] Filter by job type, status
- [ ] Click to view job details/logs
- [ ] Retry failed jobs

**Job Types:**
- `calendar-sync` - Google Calendar bidirectional sync
- `plaud-import` - Import new Plaud recordings
- `plaud-transcribe` - Transcribe audio files
- `remarkable-sync` - Sync Remarkable notes
- `remarkable-ocr` - OCR handwritten notes
- `canvas-sync` - Sync Canvas assignments
- `whoop-metrics` - Fetch Whoop health data
- `gmail-check` - Check for new emails
- `task-recurrence` - Generate recurring tasks
- `vault-backup` - Backup vault to cloud

### 4.3 Alerts & Issues Panel

**Purpose:** Surface problems that need attention

**Requirements:**
- [ ] List of current issues/warnings
- [ ] Severity levels: Error, Warning, Info
- [ ] Action buttons (Retry, Re-authenticate, View Logs)
- [ ] Dismiss/snooze alerts
- [ ] Auto-resolve when fixed

**Alert Types:**
- Authentication expired (Whoop, Canvas, etc.)
- Sync failures
- Processing backlog (pending recordings, OCR)
- Storage warnings
- Rate limit warnings

### 4.4 Quick Stats

**Purpose:** Summary metrics for the system

**Requirements:**
- [ ] Jobs run in last 24h
- [ ] Success rate percentage
- [ ] Average job duration
- [ ] Tasks created (by automation)
- [ ] Vault entries created

### 4.5 Whoop Auto-Login

**Purpose:** Automatically maintain Whoop session

**Requirements:**
- [ ] Status indicator for auto-login feature
- [ ] Last successful login time
- [ ] Manual trigger button
- [ ] Error details if failing

## API Requirements

### New Endpoints

**GET /api/system/health**
```typescript
// Response
{
  status: 'healthy' | 'degraded' | 'unhealthy',
  integrations: {
    [name: string]: {
      status: 'healthy' | 'warning' | 'error',
      lastSync: string,  // ISO datetime
      details: Record<string, any>
    }
  },
  stats: {
    jobsRun24h: number,
    successRate: number,
    avgDuration: number,
    tasksCreated24h: number,
    vaultEntries24h: number
  }
}
```

**GET /api/system/jobs**
```typescript
// Query params: ?limit=50&status=failed&type=calendar-sync
// Response
{
  jobs: [{
    id: string,
    type: string,
    status: 'completed' | 'failed' | 'running',
    startedAt: string,
    completedAt: string,
    duration: number,  // ms
    error?: string
  }]
}
```

**POST /api/system/jobs/:id/retry**
```typescript
// Response
{
  success: true,
  jobId: string  // New job ID
}
```

**GET /api/system/alerts**
```typescript
// Response
{
  alerts: [{
    id: string,
    type: 'error' | 'warning' | 'info',
    integration: string,
    message: string,
    details: string,
    createdAt: string,
    actions: string[]  // ['retry', 'reauthenticate', 'dismiss']
  }]
}
```

## Database Changes

**New Table: system_jobs**
```sql
CREATE TABLE system_jobs (
  id UUID PRIMARY KEY,
  type TEXT NOT NULL,
  status TEXT NOT NULL,  -- 'pending', 'running', 'completed', 'failed'
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  duration_ms INTEGER,
  error TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**New Table: system_alerts**
```sql
CREATE TABLE system_alerts (
  id UUID PRIMARY KEY,
  type TEXT NOT NULL,  -- 'error', 'warning', 'info'
  integration TEXT,
  message TEXT NOT NULL,
  details TEXT,
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

# Part 5: Day View (Calendar)

## Overview

A focused day view for seeing a single day's schedule in detail.

## Features

### 5.1 Day Calendar View

**Requirements:**
- [ ] Single day time grid (6am - 10pm)
- [ ] Hour-by-hour layout
- [ ] Google Calendar events displayed
- [ ] Scheduled tasks displayed
- [ ] Current time indicator
- [ ] Quick navigation (prev/next day, today)

### 5.2 Day Tasks Sidebar

**Requirements:**
- [ ] Tasks due on this day
- [ ] Tasks scheduled for this day
- [ ] Unscheduled tasks (for quick scheduling)
- [ ] Completed tasks (collapsible)

---

# Part 6: Implementation Phases

## Phase 1: Weekly Planning (COMPLETED)
- [x] Backend: Label filter for tasks API
- [x] Backend: Task reorder endpoint
- [x] Frontend: Weekly Planning page
- [x] Frontend: Weekly Backlog Panel with drag-drop
- [x] Frontend: Planning Calendar with droppable slots
- [x] Frontend: DnD integration with @dnd-kit

## Phase 2: Daily Planning
- [ ] Frontend: Daily Planning page layout
- [ ] Frontend: Today panel with calendar + tasks
- [ ] Frontend: Tomorrow panel with drop zones
- [ ] Frontend: Unscheduled tasks tray
- [ ] Integration: Link to Daily Journal app

## Phase 3: System Health Dashboard
- [ ] Backend: System health API endpoints
- [ ] Backend: Job execution logging
- [ ] Backend: Alerts system
- [ ] Frontend: Integration status bar
- [ ] Frontend: Job history view
- [ ] Frontend: Alerts panel
- [ ] Integration: Whoop auto-login monitoring

## Phase 4: Day View
- [ ] Frontend: Day calendar view
- [ ] Frontend: Day tasks sidebar
- [ ] Integration: Navigation from other views

## Phase 5: Polish & Testing
- [ ] E2E tests for all planning flows
- [ ] Performance optimization
- [ ] Mobile responsive design
- [ ] Keyboard shortcuts
- [ ] Accessibility audit

---

# Part 7: Success Metrics

## Engagement Metrics
- Weekly Planning page visits per week
- Tasks scheduled via drag-drop per week
- Daily Planning ritual completion rate
- System Health page visits

## Productivity Metrics
- % of tasks scheduled vs unscheduled
- Task completion rate for scheduled tasks
- Time from task creation to scheduling

## System Health Metrics
- Job success rate > 95%
- Alert resolution time < 24h
- Integration uptime > 99%

---

# Part 8: Future Enhancements

## Potential Features
- **AI Scheduling Assistant**: Suggest optimal times based on energy, focus patterns
- **Time Blocking Templates**: Save and reuse weekly time block patterns
- **Calendar Conflicts**: Warn when scheduling over existing events
- **Batch Scheduling**: Schedule multiple tasks at once
- **Recurring Planning Sessions**: Automated reminders for weekly review
- **Mobile Planning**: Touch-optimized planning interface
- **Voice Planning**: "Schedule task X for tomorrow at 9am"

---

# Appendix

## Related Documents
- [JD Agent PRD](./jd-agent-prd.md) - Main product requirements
- [Weekly Planning Implementation Plan](./wiggly-sparking-mochi.md) - Technical implementation details
- [Roadmap](../roadmap/index.md) - Product roadmap

## Changelog
| Date | Version | Changes |
|------|---------|---------|
| 2026-01-23 | 1.0 | Initial PRD created |
