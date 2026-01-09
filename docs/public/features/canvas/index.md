---
title: Canvas Integration
description: Automated Canvas LMS sync with integrity verification and assignment tracking
---

# Canvas Integration

The Canvas Integration automatically syncs your Canvas LMS courses, assignments, and content with JD Agent, ensuring nothing falls through the cracks.

## Overview

Canvas Integration provides:

- **Automatic Assignment Sync** - Assignments become tasks with due dates
- **Integrity Verification** - Ensures all Canvas items are tracked
- **Course Mapping** - Links courses to JD Agent projects
- **Scheduling Nudges** - Reminds you to schedule unscheduled items
- **Content Extraction** - Pulls syllabi, announcements, and readings

## Getting Started

### Configure Canvas Connection

1. Navigate to **Settings** in the Command Center
2. Enter your Canvas credentials:
   - **Canvas Base URL** (e.g., `https://canvas.university.edu`)
   - **Canvas API Token** (generate from Canvas Account Settings)
3. Click **Connect Canvas**

### Initial Sync

After connecting, run an initial sync:

```
"Sync my Canvas courses"
```

The agent will:
1. Fetch all enrolled courses
2. Filter to current semester
3. Create projects for each course
4. Import all assignments as tasks

## Canvas Integrity Agent

The Canvas Integrity Agent runs automated audits to verify all Canvas content is properly synced.

### Audit Types

| Type | Schedule | Description |
|------|----------|-------------|
| **Quick Check** | Every 6 hours | API-only verification of assignments |
| **Incremental** | Daily at 6 AM | Checks for new assignments and changes |
| **Full Audit** | Weekly (Sunday 2 AM) | Browser-based comprehensive verification |

### Manual Audits

Trigger audits from the Canvas dashboard:

```
"Run a Canvas integrity check"
```

Or click the **Full Audit** button in the Canvas Integration page.

## Sync Status

Each Canvas item has a sync status:

| Status | Meaning |
|--------|---------|
| **Synced** | Item matches between Canvas and JD Agent |
| **Pending** | Item discovered but not yet processed |
| **Mismatch** | Differences detected between systems |
| **Orphaned** | Task exists but Canvas item was removed |

## Course Mapping

Courses are mapped to JD Agent projects in a hierarchy:

```
Spring 2026 (Parent Project)
├── CS 401 - Advanced Algorithms
│   ├── Assignment 1
│   ├── Quiz 1
│   └── Final Project
├── MBA 520 - Strategy
│   ├── Case Study 1
│   └── Group Project
└── ...
```

### Configure Course Mapping

The agent automatically creates mappings, but you can customize:

1. Go to **Canvas** > **Courses** tab
2. Click on a course
3. Edit professor name, meeting times, location

## Scheduling Nudges

The agent sends Telegram nudges for unscheduled items:

- **Daily at 9 AM** - Morning nudge for items due this week
- **Daily at 6 PM** - Evening nudge for urgent items (due tomorrow)

### Example Nudge

```
📚 Canvas: 3 items need scheduling

1. CS 401 - Assignment 3 (due Jan 15)
2. MBA 520 - Case Analysis (due Jan 16)
3. STAT 450 - Problem Set 5 (due Jan 17)

Reply with task numbers to schedule.
```

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/canvas-integrity/status` | Current sync status |
| `GET /api/canvas-integrity/items` | List all Canvas items |
| `GET /api/canvas-integrity/mappings` | Course-to-project mappings |
| `POST /api/canvas-integrity/audit` | Trigger an audit |
| `POST /api/canvas-integrity/nudge` | Send scheduling nudge |

## Browser Automation

Full audits use Playwright browser automation to:

1. Login to Canvas (session persisted for 7 days)
2. Visit each course page
3. Extract content from modules, assignments, discussions
4. Take screenshots for verification
5. Compare with local data

### Session Management

- Sessions are saved to avoid repeated logins
- Handles security challenges (CAPTCHA)
- Falls back to manual login if needed

## Configuration

Environment variables:

```bash
CANVAS_BASE_URL=https://canvas.university.edu
CANVAS_TOKEN=your-api-token
CANVAS_TERM_FILTER=Spring 2026  # Optional: filter by term
```

## Troubleshooting

### Items Not Syncing

1. Check Canvas API token is valid
2. Verify course is in current term
3. Run a full audit to re-sync

### Duplicate Tasks

1. Check for orphaned items in the Canvas dashboard
2. Verify course mappings are correct
3. Use the agent to clean up duplicates

### Session Expired

1. Delete session cookies in data directory
2. Run full audit to trigger fresh login
3. Complete any security challenges

## Best Practices

1. **Run daily incremental audits** - Keep assignments up to date
2. **Check unscheduled items regularly** - Don't let due dates sneak up
3. **Review mismatch items** - May indicate Canvas changes
4. **Keep course mappings accurate** - Helps with organization

## Next Steps

- [Configure Canvas connection](/docs/getting-started/installation#canvas)
- [Set up Telegram for nudges](/docs/features/integrations/telegram)
- [View the Canvas dashboard](/docs/features/canvas/dashboard)
