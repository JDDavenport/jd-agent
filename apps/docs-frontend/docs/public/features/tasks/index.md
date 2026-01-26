# Task Management

Your command center for getting things done.

---

## Overview

JD Agent's task management system implements the GTD (Getting Things Done) methodology, giving you a trusted system to capture, organize, and complete your work.

### Key Capabilities
- **Capture anything** with natural language quick add
- **Organize** with projects, contexts, and labels
- **Schedule** with due dates and time blocks
- **Automate** with recurring tasks
- **Archive** completed tasks to Vault for permanent history

---

## Getting Started

### Create Your First Task

1. Open the Tasks app (http://localhost:5174)
2. Click the quick add bar or press `Q`
3. Type your task: "Review documentation"
4. Press Enter

Your task is now in the **Inbox**, ready to be processed.

### Quick Add Syntax

JD Agent understands natural language. Try:

```
Call mom tomorrow at 2pm @calls
Finish report Friday p1 #Work
Buy groceries @errands
Review PR ~30m
Read chapter 5 someday
```

[Full Quick Add Reference](../../reference/quick-add-syntax.md)

---

## Install as a Native App (macOS)

Tasks now ships as a native macOS app using Tauri.

### Prerequisites
- Rust toolchain (`rustup` on macOS)
- Xcode Command Line Tools (`xcode-select --install`)

### Run Native (Dev)
```
cd apps/tasks
bun run tauri:dev
```

### Build Native App
```
cd apps/tasks
bun run tauri:build
```

**Note:** The app still needs the Hub running at `http://localhost:3000` (or set `VITE_API_URL` to your server).

---

## Install as an App (iOS - Basic)

Basic mobile access is available via PWA while the native iOS build is in progress.

1. Open http://localhost:5174 in Safari
2. Tap **Share** → **Add to Home Screen**
3. Launch it from your home screen

---

## Views

### Inbox
**Purpose:** Capture point for unprocessed tasks

The inbox shows tasks that haven't been clarified yet - tasks with **no project, no due date, and no scheduled date**. Once you assign any of these, the task moves out of inbox. The goal is **inbox zero** - process everything daily.

**What appears in Inbox:**
- Tasks without a project assigned
- Tasks without a due date
- Tasks without a scheduled date
- All three conditions must be true

**How to use:**
1. Check inbox daily
2. For each item, decide: actionable or not?
3. If actionable: Assign a project, due date, or schedule it
4. If not actionable: Delete, archive to Vault, or mark Someday

### Today
**Purpose:** Your focus for today

Shows:
- Overdue tasks (red)
- Tasks scheduled for today
- "Anytime today" tasks (no specific time)
- Completed tasks (collapsed)

**How to use:**
1. Check each morning
2. Work through your scheduled tasks
3. Pick from "anytime" tasks when you have gaps

### Upcoming
**Purpose:** See what's coming

Shows tasks organized by day:
- Today
- Tomorrow
- Next 7 days
- Next week and beyond

**How to use:**
- Plan ahead
- Reschedule tasks by dragging
- Identify busy days

### Projects
**Purpose:** Organize outcomes requiring multiple tasks

Shows all projects organized by area:
- Favorites at top
- Work, School, Personal areas
- Completed projects (collapsed)
- Nested sub-projects displayed hierarchically

**How to use:**
- Click a project name to view its tasks and sub-projects
- Click the chevron (▶) to expand/collapse child projects in sidebar
- Sub-projects appear as clickable cards within parent project view
- Use sections to organize within projects
- Track progress with completion counts

### Filters
**Purpose:** Cross-cutting views by context or label

Shows tasks matching specific criteria:
- @computer, @calls, @errands
- Custom saved filters

**How to use:**
- Click a context to see all matching tasks
- Create saved filters for common queries

---

## Task Detail Panel

Click any task to open a slide-out detail panel showing all task information.

### What You'll See
- **Title**: The task name (editable)
- **Due Date**: When it must be done
- **Scheduled Date**: When you plan to work on it
- **Priority**: P1-P4 with color indicators
- **Project**: Which project this belongs to
- **Description**: Detailed notes about the task
- **Comments**: Discussion and updates

### How to Use
1. Click any task in a list view
2. The detail panel slides in from the right
3. View or edit any field
4. Press **Escape** or click outside to close

### Keyboard Shortcut
- **Escape**: Close the detail panel

---

## Task Properties

### Status
| Status | Meaning | View |
|--------|---------|------|
| `inbox` | Unclarified, needs processing | Inbox |
| `today` | Scheduled for today | Today |
| `upcoming` | Scheduled for future | Upcoming |
| `waiting` | Delegated, waiting for someone | Filters |
| `someday` | Someday/maybe | Filters |
| `done` | Completed | Archive |
| `archived` | In vault | Vault |

### Priority
| Level | Meaning | Color |
|-------|---------|-------|
| P1 | Urgent | Red |
| P2 | High | Orange |
| P3 | Medium | Yellow |
| P4 | Low | Blue |
| None | No priority | Gray |

### Dates
- **Due Date**: Deadline (when it MUST be done)
- **Scheduled Date**: When you'll work on it (when you WILL do it)

Example: "Assignment due Friday, scheduled for Wednesday"

### Contexts
WHERE or HOW you can do the task:

| Context | Use When |
|---------|----------|
| @computer | At your computer |
| @calls | Can make phone calls |
| @errands | Out and about |
| @home | At home |
| @office | At the office |
| @waiting | Waiting for someone |

### Labels
Cross-cutting tags for any categorization:
- `#urgent`
- `#client-x`
- `#quick-win`
- `#deep-work`

### Time Estimates
How long a task will take:
- `~15m` - Quick task
- `~30m` - Short task
- `~1h` - Standard task
- `~2h` - Long task

---

## Projects

### What is a Project?
Any outcome requiring more than one action step.

**Is a project:**
- "Plan vacation" (requires research, booking, packing)
- "Complete assignment" (requires reading, writing, review)

**Not a project:**
- "Call mom" (single action)
- "Buy milk" (single action)

### Creating Projects

1. Click **Projects** in sidebar
2. Click **+ New Project**
3. Enter name and optional details
4. Click **Create**

### Project Features
- **Sections**: Organize tasks within project
- **Sub-projects**: Nest projects hierarchically
- **Progress**: Track completion percentage
- **Notes**: Link to Vault for project documentation

### Project Views
- **List**: Traditional task list
- **Board**: Kanban-style columns
- **Calendar**: Tasks on a calendar

---

## Recurring Tasks

Create tasks that repeat automatically.

### Creating Recurring Tasks

In quick add, use natural language:
```
Weekly review every Sunday at 4pm
Daily standup every weekday at 9am
Rent payment every month on the 1st
Team sync every monday
```

The parser automatically:
- Sets the recurrence rule (e.g., "FREQ=WEEKLY;BYDAY=MO")
- Sets the first due date to the next occurrence (e.g., next Monday)

Or edit a task and set recurrence manually.

### Recurrence Options
- Daily
- Weekly (pick days)
- Monthly (pick date)
- Custom (RRULE format)

When you complete a recurring task, the next occurrence is created automatically.

---

## Subtasks

Break large tasks into smaller steps.

### Creating Subtasks

1. Open a task
2. Click **Add Subtask**
3. Enter the subtask
4. Repeat as needed

Or in the task list:
- Select a task
- Press **Tab** to indent it under the task above

### Subtask Behavior
- Parent task shows subtask count
- Complete all subtasks to complete parent
- Subtasks inherit parent's project and context

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Q` or `N` | Quick add task |
| `Enter` | Open selected task |
| `Escape` | Close detail panel/modals |
| `Cmd+Enter` | Complete task |
| `G then I` | Go to Inbox |
| `G then T` | Go to Today |
| `G then U` | Go to Upcoming |
| `G then P` | Go to Projects |
| `Cmd+K` or `/` | Search |
| `Tab` | Make subtask (indent) |
| `Shift+Tab` | Outdent |
| `↑/↓` | Navigate tasks |
| `Cmd+↑/↓` | Reorder tasks |

[Full Shortcuts Reference](../../reference/keyboard-shortcuts.md)

---

## Tips & Best Practices

### Inbox Processing
1. Touch each item once
2. Make decisions, don't defer
3. If < 2 minutes, do it now
4. Use "Someday" for "maybe later"

### Effective Projects
1. Start with the outcome in mind
2. Define the first next action
3. Review weekly for stuck projects
4. Archive when complete

### Using Contexts
1. Choose context based on where you ARE
2. Batch similar contexts together
3. @waiting needs regular follow-up
4. @errands for when you're out

### Quick Wins
1. Tag quick tasks with `#quick-win`
2. Use time estimates
3. Do quick tasks between meetings
4. Build momentum early in the day

---

## Related Features

- [Vault](../vault/index.md) - Where completed tasks are archived
- [Calendar](../calendar/index.md) - Time-based task scheduling
- [Agent](../agent/index.md) - Create and manage tasks via chat
- [Ceremonies](../ceremonies/index.md) - Daily and weekly reviews

---

## Detailed Guides

- [Quick Add Syntax](../../reference/quick-add-syntax.md)
- [Projects Deep Dive](./projects.md)
- [Contexts Guide](./contexts.md)
- [Recurring Tasks](./recurring.md)

---

*Last updated: January 23, 2026*
