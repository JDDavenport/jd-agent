# JD Agent Apps - Product Requirements Document

## Version 1.0 | January 7, 2026

---

# Part 1: Vision & Philosophy

## Core Philosophy

**"Capture everything. Process to zero. Trust the system."**

This system combines:
- **Todoist's** speed and simplicity for task capture
- **Notion's** flexibility and interconnectedness for knowledge
- **GTD's** methodology for stress-free productivity
- **AI** for automation, insights, and coaching

## The GTD Framework

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         GTD WORKFLOW                                         │
│                                                                              │
│   CAPTURE ──► CLARIFY ──► ORGANIZE ──► REFLECT ──► ENGAGE                   │
│      │           │            │            │           │                     │
│   Inbox      "Is it       Projects     Weekly      Do the                   │
│   Zero       actionable?"  Contexts    Review      work                     │
│              "What's the   Next        Daily                                │
│               next         Actions     Review                               │
│               action?"     Calendar                                         │
│                           Waiting For                                       │
│                           Someday/Maybe                                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              JD HUB                                          │
│                     (Single Source of Truth)                                 │
│                                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   Tasks     │  │   Vault     │  │  Projects   │  │  Contexts   │        │
│  │   Table     │◄─┼─► Entries   │◄─┼─► Table     │◄─┼─► Table     │        │
│  │             │  │   Table     │  │             │  │             │        │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘        │
│         │                │                │                │                │
│         └────────────────┴────────────────┴────────────────┘                │
│                                   │                                          │
│                          Everything Connected                                │
│                     (Tasks → Vault when completed)                          │
│                     (Vault entries can have tasks)                          │
│                     (Projects contain tasks + notes)                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
         ┌──────────────────────────┼──────────────────────────┐
         │                          │                          │
         ▼                          ▼                          ▼
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│    JD TASKS     │      │    JD VAULT     │      │  JD COMMAND     │
│                 │      │                 │      │    CENTER       │
│  • Inbox        │      │  • Search       │      │                 │
│  • Today        │      │  • Browse       │      │  • Dashboard    │
│  • Upcoming     │      │  • Notes        │      │  • Analytics    │
│  • Projects     │      │  • Files        │      │  • Settings     │
│  • Contexts     │      │  • Archive      │      │  • Health       │
│  • Filters      │      │  • Connections  │      │  • Coaching     │
└─────────────────┘      └─────────────────┘      └─────────────────┘
```

---

# Part 2: JD Hub (Backend)

## Overview

The Hub is the central nervous system. It stores all data, runs all logic, and provides APIs for all apps.

## Database Schema

### Core Tables

```sql
-- TASKS (GTD: Next Actions, Calendar, Waiting For, Someday)
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Core
  title TEXT NOT NULL,
  description TEXT,

  -- GTD Status
  status TEXT NOT NULL DEFAULT 'inbox',
    -- 'inbox'     = Unclarified (GTD: Capture)
    -- 'next'      = Next action (GTD: Do ASAP)
    -- 'scheduled' = Has a specific date/time (GTD: Calendar)
    -- 'waiting'   = Delegated/Waiting for (GTD: Waiting For)
    -- 'someday'   = Someday/Maybe (GTD: Someday)
    -- 'done'      = Completed
    -- 'archived'  = In vault, searchable

  -- Priority (Todoist-style)
  priority INTEGER DEFAULT 0,
    -- 0 = No priority (default)
    -- 1 = Low (P4 in Todoist)
    -- 2 = Medium (P3)
    -- 3 = High (P2)
    -- 4 = Urgent (P1)

  -- Dates
  due_date TIMESTAMP,
  due_date_is_hard BOOLEAN DEFAULT false,  -- True = immovable deadline
  scheduled_start TIMESTAMP,               -- When to START working
  scheduled_end TIMESTAMP,                 -- When to STOP (for time blocks)

  -- Organization (GTD: Organize)
  project_id UUID REFERENCES projects(id),
  parent_task_id UUID REFERENCES tasks(id),  -- Subtasks
  section_id UUID REFERENCES sections(id),   -- Within project

  -- Contexts (GTD: @contexts)
  contexts TEXT[],  -- ['@computer', '@home', '@calls']

  -- Labels (Todoist-style tags)
  labels TEXT[],    -- ['urgent', 'client-x', 'q1-goals']

  -- Estimates
  time_estimate_minutes INTEGER,
  energy_level TEXT,  -- 'high', 'low', 'admin'

  -- Dependencies (GTD: Blocked)
  blocked_by UUID REFERENCES tasks(id),
  waiting_for TEXT,  -- Person we're waiting on
  waiting_since TIMESTAMP,

  -- Recurrence
  recurrence_rule TEXT,  -- RRULE format
  recurrence_parent_id UUID REFERENCES tasks(id),

  -- Source tracking
  source TEXT NOT NULL DEFAULT 'manual',
    -- 'manual', 'email', 'canvas', 'chat', 'quick-add', 'api'
  source_ref TEXT,  -- External ID (email ID, assignment ID, etc.)

  -- Calendar integration
  calendar_event_id TEXT,

  -- Completion
  completed_at TIMESTAMP,
  completed_by TEXT,  -- 'user', 'auto', 'agent'

  -- Vault integration (completed tasks become vault entries)
  vault_entry_id UUID REFERENCES vault_entries(id),

  -- Order
  sort_order INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- PROJECTS (GTD: Projects = outcomes requiring multiple actions)
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Core
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#808080',
  icon TEXT,

  -- Status
  status TEXT DEFAULT 'active',
    -- 'active', 'on_hold', 'completed', 'archived'

  -- Hierarchy
  parent_project_id UUID REFERENCES projects(id),

  -- Area of responsibility (GTD: Areas)
  area TEXT,  -- 'Work', 'Personal', 'School', 'Health'

  -- Organization
  is_favorite BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,

  -- Views
  default_view TEXT DEFAULT 'list',  -- 'list', 'board', 'calendar'

  -- Goal tracking
  target_completion_date DATE,

  -- Vault integration
  vault_folder_id UUID,  -- All project notes go here

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  archived_at TIMESTAMP
);

-- SECTIONS (Todoist-style sections within projects)
CREATE TABLE sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  is_collapsed BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- CONTEXTS (GTD: @contexts - WHERE/HOW you can do work)
CREATE TABLE contexts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,  -- '@computer', '@home', '@errands', '@calls'
  description TEXT,
  color TEXT,
  icon TEXT,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- LABELS (Todoist-style tags for cross-cutting concerns)
CREATE TABLE labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  color TEXT DEFAULT '#808080',
  is_favorite BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- FILTERS (Todoist-style saved filters)
CREATE TABLE filters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  query TEXT NOT NULL,  -- Filter query string
  color TEXT,
  icon TEXT,
  is_favorite BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- VAULT ENTRIES (Notion-like knowledge base)
CREATE TABLE vault_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Core
  title TEXT NOT NULL,
  content TEXT,  -- Markdown
  content_type TEXT NOT NULL,
    -- 'note', 'document', 'meeting', 'recording', 'task_archive',
    -- 'email', 'article', 'reference', 'template', 'journal'

  -- Organization
  parent_id UUID REFERENCES vault_entries(id),  -- Nested pages
  project_id UUID REFERENCES projects(id),       -- Linked project

  -- Classification
  tags TEXT[],

  -- Source
  source TEXT NOT NULL DEFAULT 'manual',
  source_ref TEXT,
  source_url TEXT,
  source_date TIMESTAMP,

  -- For archived tasks
  original_task_id UUID REFERENCES tasks(id),
  task_completed_at TIMESTAMP,
  task_project TEXT,
  task_contexts TEXT[],

  -- For recordings
  recording_duration_seconds INTEGER,
  recording_transcript TEXT,
  recording_summary TEXT,

  -- For files
  file_path TEXT,
  file_type TEXT,
  file_size_bytes INTEGER,

  -- Search
  search_vector TSVECTOR,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- VAULT EMBEDDINGS (Semantic search)
CREATE TABLE vault_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID REFERENCES vault_entries(id) ON DELETE CASCADE,
  chunk_index INTEGER DEFAULT 0,
  content_chunk TEXT NOT NULL,
  embedding VECTOR(1024),  -- Voyage AI dimensions
  created_at TIMESTAMP DEFAULT NOW()
);

-- VAULT CONNECTIONS (Notion-like backlinks)
CREATE TABLE vault_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID REFERENCES vault_entries(id) ON DELETE CASCADE,
  target_id UUID REFERENCES vault_entries(id) ON DELETE CASCADE,
  connection_type TEXT DEFAULT 'reference',
    -- 'reference', 'parent', 'related', 'blocks', 'mentions'
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(source_id, target_id)
);

-- PEOPLE (Contacts/CRM)
CREATE TABLE people (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  company TEXT,
  role TEXT,
  how_met TEXT,
  notes TEXT,
  tags TEXT[],
  last_contact_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- TASK COMMENTS (Collaboration)
CREATE TABLE task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  author TEXT DEFAULT 'user',  -- 'user', 'agent', 'system'
  created_at TIMESTAMP DEFAULT NOW()
);

-- ACTIVITY LOG (Audit trail)
CREATE TABLE activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,  -- 'task', 'project', 'vault'
  entity_id UUID NOT NULL,
  action TEXT NOT NULL,  -- 'created', 'updated', 'completed', 'deleted'
  changes JSONB,
  actor TEXT DEFAULT 'user',
  created_at TIMESTAMP DEFAULT NOW()
);

-- GOALS (High-level objectives)
CREATE TABLE goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  target_date DATE,
  metric_type TEXT,  -- 'percentage', 'count', 'boolean'
  target_value NUMERIC,
  current_value NUMERIC DEFAULT 0,
  area TEXT,  -- 'Work', 'Personal', 'Health', etc.
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- DAILY REVIEWS (GTD: Daily reflection)
CREATE TABLE daily_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL UNIQUE,
  tasks_planned INTEGER,
  tasks_completed INTEGER,
  tasks_added INTEGER,
  inbox_start INTEGER,
  inbox_end INTEGER,
  reflection TEXT,
  mood TEXT,  -- 'great', 'good', 'okay', 'rough'
  created_at TIMESTAMP DEFAULT NOW()
);

-- INDEXES
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_due_date ON tasks(due_date);
CREATE INDEX idx_tasks_project ON tasks(project_id);
CREATE INDEX idx_tasks_contexts ON tasks USING GIN(contexts);
CREATE INDEX idx_tasks_labels ON tasks USING GIN(labels);
CREATE INDEX idx_vault_search ON vault_entries USING GIN(search_vector);
CREATE INDEX idx_vault_project ON vault_entries(project_id);
CREATE INDEX idx_vault_type ON vault_entries(content_type);
CREATE INDEX idx_vault_tags ON vault_entries USING GIN(tags);
```

## Hub API Endpoints

### Tasks API

```
GET    /api/tasks                    # List with filters
GET    /api/tasks/inbox              # Inbox view
GET    /api/tasks/today              # Today view (scheduled today + overdue)
GET    /api/tasks/upcoming           # Next 7 days
GET    /api/tasks/project/:id        # Tasks in project
GET    /api/tasks/context/:name      # Tasks by context
GET    /api/tasks/label/:name        # Tasks by label
GET    /api/tasks/filter/:id         # Custom filter
GET    /api/tasks/search             # Full-text search
GET    /api/tasks/:id                # Single task
POST   /api/tasks                    # Create (supports quick-add syntax)
POST   /api/tasks/quick              # Quick add with natural language
PATCH  /api/tasks/:id                # Update
POST   /api/tasks/:id/complete       # Complete task
POST   /api/tasks/:id/uncomplete     # Uncomplete task
POST   /api/tasks/:id/move           # Move to project/section
POST   /api/tasks/:id/schedule       # Schedule to date/time
POST   /api/tasks/:id/duplicate      # Duplicate task
DELETE /api/tasks/:id                # Delete (moves to vault archive)
POST   /api/tasks/reorder            # Reorder tasks
```

### Projects API

```
GET    /api/projects                 # List all projects
GET    /api/projects/:id             # Single project with tasks
POST   /api/projects                 # Create project
PATCH  /api/projects/:id             # Update project
POST   /api/projects/:id/archive     # Archive project
DELETE /api/projects/:id             # Delete project
POST   /api/projects/reorder         # Reorder projects
GET    /api/projects/:id/sections    # Get sections
POST   /api/projects/:id/sections    # Create section
```

### Vault API

```
GET    /api/vault                    # List entries (paginated)
GET    /api/vault/search             # Full-text + semantic search
GET    /api/vault/recent             # Recently modified
GET    /api/vault/tree               # Folder tree structure
GET    /api/vault/project/:id        # Entries for project
GET    /api/vault/tags               # List all tags with counts
GET    /api/vault/tag/:name          # Entries by tag
GET    /api/vault/:id                # Single entry
GET    /api/vault/:id/connections    # Backlinks and references
POST   /api/vault                    # Create entry
PATCH  /api/vault/:id                # Update entry
DELETE /api/vault/:id                # Delete entry
POST   /api/vault/:id/move           # Move to folder
```

### Other APIs

```
# Contexts
GET    /api/contexts                 # List contexts
POST   /api/contexts                 # Create context
PATCH  /api/contexts/:id             # Update context
DELETE /api/contexts/:id             # Delete context

# Labels
GET    /api/labels                   # List labels
POST   /api/labels                   # Create label
PATCH  /api/labels/:id               # Update label
DELETE /api/labels/:id               # Delete label

# Filters
GET    /api/filters                  # List saved filters
POST   /api/filters                  # Create filter
PATCH  /api/filters/:id              # Update filter
DELETE /api/filters/:id              # Delete filter

# People
GET    /api/people                   # List people
GET    /api/people/:id               # Single person with history
POST   /api/people                   # Create person
PATCH  /api/people/:id               # Update person

# Goals
GET    /api/goals                    # List goals
POST   /api/goals                    # Create goal
PATCH  /api/goals/:id                # Update goal
POST   /api/goals/:id/progress       # Update progress

# Analytics
GET    /api/analytics/productivity   # Productivity stats
GET    /api/analytics/completion     # Completion trends
GET    /api/analytics/contexts       # Time by context
GET    /api/analytics/projects       # Project progress

# Chat (Agent)
POST   /api/chat                     # Chat with agent

# Sync
POST   /api/sync                     # Sync for offline apps
```

---

# Part 3: JD Tasks App

## Overview

The Tasks app is your primary interface for capturing and managing work. It should feel as fast and intuitive as Todoist while supporting the full GTD methodology.

## Core Screens

### 1. Inbox

**Purpose:** Capture everything, clarify later (GTD: Capture -> Clarify)

```
┌─────────────────────────────────────────────────────────────────┐
│  ☰  INBOX (12)                                    [+ Add Task]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ + Add a task...                                           │ │
│  │   Type naturally: "Call mom tomorrow p1 @calls #family"   │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  ○ Review proposal from Sarah                                   │
│    Added 2 hours ago                                            │
│                                                                 │
│  ○ Book dentist appointment                                     │
│    Added yesterday                                              │
│                                                                 │
│  ○ Research new laptop options                                  │
│    Added 3 days ago                                             │
│                                                                 │
│  ○ Prepare presentation for Monday meeting                      │
│    Added 3 days ago                                             │
│                                                                 │
│  ... (8 more)                                                   │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│  💡 Process inbox to zero daily. What's the next action?        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Features:**
- Quick add at top (always visible)
- Natural language parsing: "Call mom tomorrow p1 @calls #family"
- Swipe actions: Schedule, Move to Project, Delete
- Bulk process mode: Rapidly clarify multiple items
- "What's the next action?" prompt
- Inbox zero celebration

---

### 2. Today

**Purpose:** Focus on what matters today (GTD: Engage)

```
┌─────────────────────────────────────────────────────────────────┐
│  ☰  TODAY                              Wed, Jan 7      [+ Add]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  📊 4 of 8 completed                    ████████░░░░ 50%  │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  OVERDUE ──────────────────────────────────────────────────────│
│                                                                 │
│  ⚠️ ○ Submit expense report               Jan 5 • Work         │
│        Was due 2 days ago                                       │
│                                                                 │
│  SCHEDULED ─────────────────────────────────────────────────── │
│                                                                 │
│  🔴 ○ Client presentation prep            9:00 AM • 2h • Work  │
│        Acme Corp Q4 Review                                      │
│                                                                 │
│  🟡 ○ Review PR #234                      11:00 AM • 30m       │
│        @computer • Engineering                                  │
│                                                                 │
│  ───── 12:00 PM - Lunch with Sarah (Calendar) ─────            │
│                                                                 │
│  🟢 ○ Call insurance company              2:00 PM • 15m        │
│        @calls • Personal                                        │
│                                                                 │
│  ANYTIME TODAY ────────────────────────────────────────────────│
│                                                                 │
│     ○ Process email inbox                 @computer             │
│     ○ Water plants                        @home                 │
│     ○ Review meeting notes                @computer • CS401     │
│                                                                 │
│  ✓ COMPLETED (4) ──────────────────────────────────────────────│
│                                                                 │
│     ✓ Morning standup                     9:00 AM               │
│     ✓ Reply to John's email               10:30 AM              │
│     ✓ Review budget spreadsheet           11:15 AM              │
│     ✓ Update project timeline             11:45 AM              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Features:**
- Overdue section (red alert)
- Time-blocked tasks with durations
- Calendar events inline (read-only)
- "Anytime" tasks (flexible for today)
- Completed tasks collapsed at bottom
- Progress bar
- Drag to reorder
- Quick reschedule: drag to tomorrow

---

### 3. Upcoming

**Purpose:** See what's coming (GTD: Horizon 1)

```
┌─────────────────────────────────────────────────────────────────┐
│  ☰  UPCOMING                                           [+ Add]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  TODAY • Wed, Jan 7 ─────────────────────────────────────────  │
│                                                                 │
│  🔴 ○ Client presentation prep            9:00 AM • Work       │
│     ○ Process email inbox                 @computer             │
│     ○ Call insurance company              @calls                │
│                                                                 │
│  TOMORROW • Thu, Jan 8 ──────────────────────────────────────  │
│                                                                 │
│  🟡 ○ CS401 Assignment Due                11:59 PM • School    │
│     ○ Dentist appointment                 2:00 PM • Personal   │
│     ○ Team retrospective                  4:00 PM • Work       │
│                                                                 │
│  FRI, JAN 9 ─────────────────────────────────────────────────  │
│                                                                 │
│     ○ Weekly report                       EOD • Work           │
│     ○ Date night                          7:00 PM • Personal   │
│                                                                 │
│  SAT, JAN 10 ────────────────────────────────────────────────  │
│                                                                 │
│     ○ Grocery shopping                    @errands             │
│                                                                 │
│  NEXT WEEK ──────────────────────────────────────────────────  │
│                                                                 │
│     ○ Quarterly review prep               Mon • Work           │
│     ○ MBA502 Midterm                      Wed • School         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Features:**
- Day-by-day view
- Week overview collapsed
- Calendar events mixed in
- Quick date picker on hover
- "No due date" section at bottom

---

### 4. Projects

**Purpose:** Organize outcomes (GTD: Projects)

```
┌─────────────────────────────────────────────────────────────────┐
│  ☰  PROJECTS                                   [+ New Project]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ⭐ FAVORITES                                                   │
│  ├── 🔵 Q1 Product Launch (8/24)                               │
│  └── 🟢 Thesis (12/45)                                         │
│                                                                 │
│  WORK ───────────────────────────────────────────────────────  │
│  ├── 🔵 Acme Corp Project (5/12)                               │
│  ├── 🟠 Team Onboarding (3/8)                                  │
│  └── 🟣 Q1 Goals                                               │
│      ├── Revenue Target (2/5)                                  │
│      └── Hiring Plan (1/3)                                     │
│                                                                 │
│  SCHOOL ─────────────────────────────────────────────────────  │
│  ├── 📘 CS401 - Machine Learning (4/15)                        │
│  ├── 📗 CS501 - Algorithms (2/8)                               │
│  ├── 📕 MBA501 - Strategy (6/10)                               │
│  └── 📙 MBA502 - Finance (3/7)                                 │
│                                                                 │
│  PERSONAL ───────────────────────────────────────────────────  │
│  ├── 🏠 Home Renovation (2/12)                                 │
│  ├── 🏃 Marathon Training (5/20)                               │
│  └── 📚 Reading List (1/5)                                     │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│  📦 Completed Projects (12)                          [Archive] │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Project Detail View:**

```
┌─────────────────────────────────────────────────────────────────┐
│  ← PROJECTS                                                     │
│                                                                 │
│  🔵 Q1 Product Launch                            ⭐ ⋯          │
│  Launch new product by March 31                                 │
│  Progress: ████████░░░░░░░░░░░░ 33% (8/24)                     │
│                                                                 │
│  [List] [Board] [Calendar] [Notes]              [+ Add Task]   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  PLANNING ──────────────────────────────────────────────────── │
│                                                                 │
│  ✓ Define product requirements                                  │
│  ✓ Create project timeline                                      │
│  ✓ Assign team roles                                            │
│     ○ Finalize budget                         Due: Jan 10      │
│     ○ Stakeholder approval                    Due: Jan 15      │
│                                                                 │
│  DEVELOPMENT ───────────────────────────────────────────────── │
│                                                                 │
│     ○ Backend API complete                    Due: Feb 1       │
│     ○ Frontend MVP                            Due: Feb 15      │
│     ○ Integration testing                     Due: Feb 28      │
│                                                                 │
│  LAUNCH ────────────────────────────────────────────────────── │
│                                                                 │
│     ○ Marketing materials                     Due: Mar 15      │
│     ○ Beta user feedback                      Due: Mar 20      │
│     ○ Public launch                           Due: Mar 31      │
│                                                                 │
│  📝 PROJECT NOTES ──────────────────────────────────────────── │
│                                                                 │
│     Meeting Notes - Jan 5                                       │
│     Requirements Doc                                            │
│     Competitor Analysis                                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Features:**
- Nested projects (sub-projects)
- Area groupings (Work, School, Personal)
- Sections within projects
- Multiple views: List, Board, Calendar
- Project notes (linked to Vault)
- Progress tracking
- Archive completed projects

---

### 5. Filters & Labels

**Purpose:** Cross-cutting views (GTD: Contexts, Labels)

```
┌─────────────────────────────────────────────────────────────────┐
│  ☰  FILTERS & LABELS                              [+ New]       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  CONTEXTS (@where) ──────────────────────────────────────────  │
│                                                                 │
│  💻 @computer (12)        What I can do at my computer          │
│  📱 @phone (3)            Quick mobile tasks                    │
│  📞 @calls (5)            Calls to make                         │
│  🏠 @home (8)             Things to do at home                  │
│  🏃 @errands (4)          While out and about                   │
│  👤 @waiting (6)          Waiting for others                    │
│                                                                 │
│  LABELS (#tags) ─────────────────────────────────────────────  │
│                                                                 │
│  🔴 #urgent (2)           Needs immediate attention             │
│  🟡 #client-x (5)         Acme Corp related                     │
│  🟢 #quick-win (8)        < 15 minute tasks                     │
│  🔵 #deep-work (4)        Needs focus time                      │
│  🟣 #review (3)           Needs review/approval                 │
│                                                                 │
│  SAVED FILTERS ──────────────────────────────────────────────  │
│                                                                 │
│  ⏰ Due this week (15)    All tasks due within 7 days           │
│  🔥 High priority (4)     Priority 3 or 4                       │
│  ⏳ No due date (23)      Tasks without deadlines               │
│  📅 Scheduled (18)        Tasks with scheduled time             │
│  🎯 Quick wins (8)        < 15 min + low energy                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Features:**
- GTD contexts (@where you can do work)
- Labels for cross-cutting tags
- Custom saved filters with query language
- Task counts
- Color coding

---

### 6. Search

**Purpose:** Find anything fast

```
┌─────────────────────────────────────────────────────────────────┐
│  🔍 Search tasks...                                      ⌘K    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [All] [Tasks] [Projects] [Notes]                              │
│                                                                 │
│  RECENT SEARCHES                                                │
│  • budget report                                                │
│  • @calls due:tomorrow                                          │
│  • #client-x                                                    │
│                                                                 │
│  SEARCH SYNTAX                                                  │
│  • @context     Filter by context                               │
│  • #label       Filter by label                                 │
│  • p:project    Filter by project                               │
│  • due:today    Due date filter                                 │
│  • priority:1   Priority filter                                 │
│  • assigned:me  Assignment filter                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Task Quick Add Syntax

Support natural language like Todoist:

```
# Basic
"Buy groceries"

# With due date
"Buy groceries tomorrow"
"Buy groceries Jan 15"
"Buy groceries next Monday"

# With time
"Meeting with Sarah at 2pm"
"Call mom 3:30pm tomorrow"

# With priority
"Urgent report p1"
"Review docs p2"

# With project
"Design mockups #Product Launch"
"Read chapter 5 #CS401"

# With context
"Call insurance @calls"
"Fix bug @computer"

# With labels
"Quick fix :quick-win"
"Deep research :deep-work"

# With duration
"Review PR ~30m"
"Write report ~2h"

# Combined
"Call client about proposal tomorrow 2pm p1 @calls #Acme Corp :urgent ~30m"
```

---

## Task Actions

| Action | Gesture/Shortcut | Result |
|--------|------------------|--------|
| Complete | Click checkbox / ⌘Enter | Move to completed |
| Quick schedule | Swipe right / S | Date picker |
| Move to project | Swipe left / M | Project picker |
| Edit | Click task / Enter | Open detail |
| Delete | Long press / ⌫ | Delete (archive) |
| Add subtask | Tab in list | Indent as subtask |
| Priority | P + 1-4 | Set priority |
| Add context | @ + type | Add context |
| Add label | # + type | Add label |

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Q | Quick add task |
| N | New task (detailed) |
| ⌘K | Search |
| G then I | Go to Inbox |
| G then T | Go to Today |
| G then U | Go to Upcoming |
| G then P | Go to Projects |
| ⌘1-4 | Set priority |
| ⌘Enter | Complete task |
| ⌘⇧Enter | Complete and create next |
| Tab | Indent (make subtask) |
| ⇧Tab | Outdent |
| ↑↓ | Navigate tasks |
| ⌘↑↓ | Reorder tasks |

---

# Part 4: JD Vault App

## Overview

The Vault is your second brain - a Notion-like knowledge base where everything lives forever, fully searchable and interconnected.

## Core Concepts

### Everything is a Page

Like Notion, every piece of content is a "page" that can:
- Contain text, tasks, embeds
- Link to other pages
- Be nested infinitely
- Have properties/metadata

### Automatic Archival

When tasks are completed, they become vault entries:
- Preserves task details, project, context
- Searchable forever
- Creates a history of accomplishments
- Can generate insights ("What did I accomplish last month?")

### File Organization

```
VAULT/
├── 📥 Inbox/                    # Quick capture, unsorted
│   ├── Voice memo - Jan 7
│   └── Quick note - meeting idea
│
├── 📁 Projects/                 # Active project notes
│   ├── Q1 Product Launch/
│   │   ├── Requirements Doc
│   │   ├── Meeting Notes/
│   │   │   ├── Kickoff - Jan 3
│   │   │   └── Weekly Sync - Jan 7
│   │   └── Research/
│   └── Thesis/
│       ├── Chapter 1 Draft
│       └── Literature Review
│
├── 📚 Areas/                    # Ongoing areas of responsibility
│   ├── Work/
│   │   ├── Team Processes
│   │   └── 1:1 Notes/
│   ├── School/
│   │   ├── CS401/
│   │   │   ├── Lecture Notes/
│   │   │   ├── Assignments/
│   │   │   └── Study Guides/
│   │   └── MBA501/
│   └── Personal/
│       ├── Health/
│       └── Finance/
│
├── 📦 Resources/                # Reference material
│   ├── Articles/
│   ├── Books/
│   ├── Templates/
│   └── How-Tos/
│
├── 🗄️ Archive/                  # Completed/inactive
│   ├── Completed Tasks/         # Auto-archived tasks
│   │   ├── 2026-01/
│   │   └── 2025-12/
│   ├── Completed Projects/
│   └── Old Notes/
│
├── 👥 People/                   # Contact notes
│   ├── Sarah (Manager)
│   ├── John (Teammate)
│   └── Prof. Smith
│
├── 📅 Journal/                  # Daily/weekly reflections
│   ├── Daily/
│   │   ├── 2026-01-07
│   │   └── 2026-01-06
│   └── Weekly Reviews/
│       └── Week of Jan 5
│
└── 🎙️ Recordings/               # Transcribed audio
    ├── Classes/
    ├── Meetings/
    └── Voice Memos/
```

---

## Core Screens

### 1. Search (Home)

**Purpose:** Find anything instantly

```
┌─────────────────────────────────────────────────────────────────┐
│  ☰  VAULT                                            [+ New]    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ 🔍 Search your vault...                              ⌘K   │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  RECENT ────────────────────────────────────────────────────── │
│                                                                 │
│  📝 CS401 Lecture - Neural Networks           2 hours ago      │
│  📝 Meeting Notes - Product Sync              Yesterday        │
│  📄 Q1 Product Requirements                   2 days ago       │
│                                                                 │
│  QUICK ACCESS ─────────────────────────────────────────────── │
│                                                                 │
│  📥 Inbox (3)              📅 Today's Journal                  │
│  ⭐ Favorites              📁 Active Projects                  │
│  🏷️ All Tags               🗄️ Archive                          │
│                                                                 │
│  BROWSE BY ────────────────────────────────────────────────── │
│                                                                 │
│  📁 Projects        📚 Areas        📦 Resources               │
│  👥 People          📅 Journal      🎙️ Recordings              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Search Results:**

```
┌─────────────────────────────────────────────────────────────────┐
│  🔍 "neural networks"                              [X Clear]    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Found 12 results                    [All] [Notes] [Tasks]     │
│                                                                 │
│  BEST MATCHES ─────────────────────────────────────────────── │
│                                                                 │
│  📝 CS401 Lecture - Neural Networks                            │
│     "...backpropagation in neural networks uses the chain..."  │
│     CS401 • 2 hours ago                                         │
│                                                                 │
│  📝 Deep Learning Study Guide                                   │
│     "...types of neural networks include CNN, RNN, and..."     │
│     CS401 • 1 week ago                                          │
│                                                                 │
│  📄 ML Research Notes                                           │
│     "...latest advances in neural network architectures..."    │
│     Thesis • 2 weeks ago                                        │
│                                                                 │
│  COMPLETED TASKS ──────────────────────────────────────────── │
│                                                                 │
│  ✓ Read neural networks chapter                                 │
│     Completed Jan 3 • CS401                                     │
│                                                                 │
│  ✓ Watch 3Blue1Brown neural network series                     │
│     Completed Dec 28 • Personal                                 │
│                                                                 │
│  RELATED (Semantic) ───────────────────────────────────────── │
│                                                                 │
│  📝 Machine Learning Fundamentals                               │
│     Mentions similar concepts                                   │
│                                                                 │
│  📝 Gradient Descent Explained                                  │
│     Related topic                                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Features:**
- Full-text search
- Semantic search (find related concepts)
- Filter by type (notes, tasks, recordings)
- Search within project/area
- Recent searches
- Instant results as you type

---

### 2. Page View

**Purpose:** View and edit any content

```
┌─────────────────────────────────────────────────────────────────┐
│  ← CS401                                      ⭐ Share ⋯       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  📝 CS401 Lecture - Neural Networks                            │
│  ─────────────────────────────────────────────────────────────  │
│  📅 January 7, 2026  •  🏷️ #lecture #deep-learning             │
│                                                                 │
│  ═══════════════════════════════════════════════════════════   │
│                                                                 │
│  # Neural Networks Fundamentals                                │
│                                                                 │
│  ## Key Concepts                                                │
│                                                                 │
│  Neural networks are computational models inspired by           │
│  biological neurons. Key components:                            │
│                                                                 │
│  - **Neurons**: Processing units                                │
│  - **Weights**: Connection strengths                            │
│  - **Activation functions**: Non-linear transformations         │
│                                                                 │
│  ## Backpropagation                                             │
│                                                                 │
│  The algorithm for training neural networks:                    │
│                                                                 │
│  1. Forward pass - compute predictions                          │
│  2. Calculate loss                                              │
│  3. Backward pass - compute gradients                           │
│  4. Update weights                                              │
│                                                                 │
│  > 💡 Prof mentioned this will be on the exam                   │
│                                                                 │
│  ## Related Tasks                                               │
│  □ Complete neural network assignment (Due: Jan 10)            │
│  □ Review backpropagation math                                  │
│                                                                 │
│  ## Linked Notes                                                │
│  → [[Gradient Descent Explained]]                               │
│  → [[Activation Functions Comparison]]                          │
│                                                                 │
│  ═══════════════════════════════════════════════════════════   │
│                                                                 │
│  BACKLINKS (3 pages link here) ─────────────────────────────── │
│  • Deep Learning Study Guide                                    │
│  • ML Research Notes                                            │
│  • Week 2 Lecture Summary                                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Features:**
- Markdown editor with live preview
- Block-based editing (like Notion)
- Slash commands for quick formatting
- Wiki-style links [[Page Name]]
- Backlinks section
- Embedded tasks (can check off)
- Tags and properties
- Version history

---

### 3. Daily Note / Journal

**Purpose:** Daily capture and reflection (GTD: Daily Review)

```
┌─────────────────────────────────────────────────────────────────┐
│  ← JOURNAL                                     [< Prev] [Next >]│
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  📅 Tuesday, January 7, 2026                                   │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  ## Morning Intentions                                          │
│                                                                 │
│  Today's top 3 priorities:                                      │
│  1. [ ] Finish product presentation                             │
│  2. [ ] Submit expense report                                   │
│  3. [ ] Exercise                                                │
│                                                                 │
│  ## Notes & Thoughts                                            │
│                                                                 │
│  - Had a great meeting with Sarah about the launch              │
│  - Need to follow up with John about the API docs               │
│  - [[Idea: New feature for dashboard]]                          │
│                                                                 │
│  ## Tasks Completed Today                          (Auto-filled)│
│                                                                 │
│  ✓ Morning standup                                              │
│  ✓ Review PR #234                                               │
│  ✓ Reply to John's email                                        │
│  ✓ 4 more tasks...                                              │
│                                                                 │
│  ## Evening Reflection                                          │
│                                                                 │
│  What went well: Got the presentation mostly done               │
│  What could improve: Got distracted by Slack                    │
│  Tomorrow's focus: Finish presentation, start API docs          │
│                                                                 │
│  Mood: 😊 Good                                                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Features:**
- Auto-created each day
- Morning intentions template
- Auto-populated completed tasks
- Evening reflection prompts
- Mood tracking
- Links to other pages
- Navigate between days

---

### 4. Task Archive View

**Purpose:** Browse completed task history

```
┌─────────────────────────────────────────────────────────────────┐
│  ← ARCHIVE                                                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  COMPLETED TASKS                   [This Week ▼] [All Projects]│
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  📊 34 tasks completed this week                                │
│                                                                 │
│  TODAY • Jan 7 ────────────────────────────────────────────── │
│                                                                 │
│  ✓ Morning standup                    Work • 9:15 AM           │
│  ✓ Reply to John's email              Work • 10:30 AM          │
│  ✓ Review budget spreadsheet          Work • 11:15 AM          │
│  ✓ Update project timeline            Q1 Launch • 11:45 AM     │
│                                                                 │
│  YESTERDAY • Jan 6 ──────────────────────────────────────────  │
│                                                                 │
│  ✓ Submit weekly report               Work • 4:30 PM           │
│  ✓ CS401 homework                     School • 8:00 PM         │
│  ✓ Call mom                           Personal • 8:30 PM       │
│  ... (5 more)                                                   │
│                                                                 │
│  MON, JAN 5 ─────────────────────────────────────────────────  │
│                                                                 │
│  ✓ Project kickoff meeting            Q1 Launch • 10:00 AM     │
│  ✓ Define requirements                Q1 Launch • 2:00 PM      │
│  ... (8 more)                                                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Features:**
- Chronological view of completions
- Filter by project, date range, context
- See completion time
- Click to view full task details
- Export to report
- Search within archive

---

## Block Types (Notion-style)

| Type | Syntax | Description |
|------|--------|-------------|
| Text | Just type | Normal paragraph |
| Heading 1 | # | Large heading |
| Heading 2 | ## | Medium heading |
| Heading 3 | ### | Small heading |
| Bullet | - | Unordered list |
| Number | 1. | Ordered list |
| Todo | [ ] | Checkbox |
| Quote | > | Block quote |
| Code | ``` | Code block |
| Callout | > 💡 | Highlighted box |
| Divider | --- | Horizontal line |
| Link | [[Page]] | Wiki link |
| Embed | /embed | Embed content |
| Table | /table | Table block |
| Image | /image | Upload image |
| File | /file | Attach file |

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| ⌘K | Quick search |
| ⌘N | New page |
| ⌘P | Page search |
| ⌘⇧N | New page in current folder |
| / | Slash command menu |
| [[ | Link to page |
| ⌘B | Bold |
| ⌘I | Italic |
| ⌘E | Code |
| ⌘⇧H | Highlight |
| Tab | Indent |
| ⇧Tab | Outdent |
| ⌘Enter | Check todo |

---

# Part 5: JD Command Center

## Overview

The Command Center is your mission control - dashboards, analytics, settings, and system health.

## Core Screens

### 1. Dashboard (Home)

```
┌─────────────────────────────────────────────────────────────────┐
│  JD COMMAND CENTER                     Jan 7, 2026    [⚙️ ✉️]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────┐  ┌─────────────────────────────┐  │
│  │  TODAY'S FOCUS          │  │  CALENDAR                   │  │
│  │                         │  │                             │  │
│  │  🔴 4 tasks scheduled   │  │  9:00  Client Presentation  │  │
│  │  🟡 3 anytime tasks     │  │  12:00 Lunch with Sarah     │  │
│  │  ⚠️ 1 overdue           │  │  2:00  Insurance Call       │  │
│  │                         │  │  4:00  Team Standup         │  │
│  │  Progress: ████░░ 50%   │  │                             │  │
│  │                         │  │  [Full Calendar →]          │  │
│  │  [Open Tasks App →]     │  │                             │  │
│  └─────────────────────────┘  └─────────────────────────────┘  │
│                                                                 │
│  ┌─────────────────────────┐  ┌─────────────────────────────┐  │
│  │  INBOX STATUS           │  │  QUICK CHAT                 │  │
│  │                         │  │                             │  │
│  │  📥 12 items in inbox   │  │  ┌───────────────────────┐  │  │
│  │                         │  │  │ Ask me anything...    │  │  │
│  │  "Process to zero!"     │  │  └───────────────────────┘  │  │
│  │                         │  │                             │  │
│  │  [Process Inbox →]      │  │  • "What's my next task?"  │  │
│  │                         │  │  • "Schedule deep work"    │  │
│  └─────────────────────────┘  └─────────────────────────────┘  │
│                                                                 │
│  ┌─────────────────────────┐  ┌─────────────────────────────┐  │
│  │  WEEKLY PROGRESS        │  │  GOALS                      │  │
│  │                         │  │                             │  │
│  │  Tasks: 34/45 (76%)     │  │  Q1 Revenue  ████████░░ 80% │  │
│  │  Mon ████████████ 12    │  │  Thesis      ███░░░░░░░ 30% │  │
│  │  Tue ████████░░░░ 8     │  │  Fitness     ██████░░░░ 60% │  │
│  │  Wed ██████░░░░░░ 6     │  │                             │  │
│  │  ...                    │  │  [All Goals →]              │  │
│  └─────────────────────────┘  └─────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2. Analytics

```
┌─────────────────────────────────────────────────────────────────┐
│  ANALYTICS                              [This Week ▼]           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  PRODUCTIVITY OVERVIEW                                          │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  ┌─────────────┬─────────────┬─────────────┬─────────────┐     │
│  │ Tasks Done  │ Inbox Zero  │ On-Time %   │ Streak      │     │
│  │    156      │   5 days    │    87%      │  12 days    │     │
│  │   ↑ 12%     │   🔥        │   ↑ 5%      │   🔥        │     │
│  └─────────────┴─────────────┴─────────────┴─────────────┘     │
│                                                                 │
│  COMPLETION TREND                                               │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │     ▁▃▅▇█▇▅▃▁▃▅▇█▇▅▃▁▃▅▇█▇▅▃▁                          │   │
│  │    Mon   Wed   Fri   Mon   Wed   Fri   Mon   Wed        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  BY CONTEXT                           BY PROJECT                │
│  ┌─────────────────────────┐         ┌─────────────────────┐   │
│  │ @computer    ████████ 45│         │ Q1 Launch    ██████ 32│  │
│  │ @calls       ███░░░░░ 12│         │ CS401        ████░░ 24│  │
│  │ @home        ██░░░░░░  8│         │ Thesis       ███░░░ 18│  │
│  │ @errands     █░░░░░░░  4│         │ Personal     ██░░░░ 12│  │
│  └─────────────────────────┘         └─────────────────────┘   │
│                                                                 │
│  INSIGHTS                                                       │
│  ─────────────────────────────────────────────────────────────  │
│  💡 You're most productive on Tuesdays (avg 12 tasks)          │
│  💡 @calls context has 3 tasks waiting > 5 days                │
│  💡 Inbox has been zero for 5 days - great job! 🎉             │
│  ⚠️ Q1 Launch project is behind schedule (32% vs 45% target)   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 3. System Health

```
┌─────────────────────────────────────────────────────────────────┐
│  SYSTEM HEALTH                            Last check: 2 min ago │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  SERVICES                              INTEGRATIONS             │
│  ┌─────────────────────────┐         ┌─────────────────────┐   │
│  │ ✅ API Server    2ms    │         │ ✅ Google Calendar   │   │
│  │ ✅ Database      5ms    │         │ ✅ Gmail             │   │
│  │ ✅ Redis         1ms    │         │ ✅ Telegram          │   │
│  │ ✅ Job Queue    Running │         │ ⚠️ Canvas (expires 3d)│  │
│  └─────────────────────────┘         └─────────────────────┘   │
│                                                                 │
│  SYNC STATUS                                                    │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Calendar    Last sync: 5 min ago     [Sync Now]         │   │
│  │ Gmail       Last sync: 10 min ago    [Sync Now]         │   │
│  │ Canvas      Last sync: 1 hour ago    [Sync Now]         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  RECENT ACTIVITY                                                │
│  ─────────────────────────────────────────────────────────────  │
│  • 2 min ago: Morning ceremony sent                             │
│  • 15 min ago: Calendar synced (3 new events)                   │
│  • 1 hr ago: Canvas sync (2 assignments imported)               │
│  • 3 hr ago: Recording transcribed (CS401 Lecture)              │
│                                                                 │
│  CEREMONIES                                                     │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Morning   ✅ Sent today 6:00 AM     [Test]              │   │
│  │ Evening   ⏳ Scheduled 9:00 PM      [Test]              │   │
│  │ Weekly    📅 Sunday 4:00 PM         [Test]              │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 4. Settings

```
┌─────────────────────────────────────────────────────────────────┐
│  SETTINGS                                                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  PROFILE                                                        │
│  ─────────────────────────────────────────────────────────────  │
│  Name: JD                                                       │
│  Email: jd@example.com                                          │
│  Timezone: America/Denver (MST)                       [Change]  │
│                                                                 │
│  CEREMONIES                                                     │
│  ─────────────────────────────────────────────────────────────  │
│  Morning briefing:  [6:00 AM ▼]  ☑️ Email  ☑️ Telegram         │
│  Evening summary:   [9:00 PM ▼]  ☑️ Email  ☐ Telegram          │
│  Weekly review:     [Sunday 4:00 PM ▼]                         │
│                                                                 │
│  DEFAULTS                                                       │
│  ─────────────────────────────────────────────────────────────  │
│  Default project:   [Inbox ▼]                                   │
│  Default context:   [@computer ▼]                               │
│  Week starts on:    [Monday ▼]                                  │
│  Date format:       [Jan 7, 2026 ▼]                            │
│  Time format:       [12-hour ▼]                                 │
│                                                                 │
│  INTEGRATIONS                                                   │
│  ─────────────────────────────────────────────────────────────  │
│  Google     ✅ Connected as jd@gmail.com         [Disconnect]   │
│  Canvas     ✅ Connected                         [Disconnect]   │
│  Telegram   ✅ Connected as @jd                  [Disconnect]   │
│                                                                 │
│  CLASSES (for School context)                                   │
│  ─────────────────────────────────────────────────────────────  │
│  📘 CS401 - Machine Learning              [Edit] [Remove]       │
│  📗 CS501 - Algorithms                    [Edit] [Remove]       │
│  📕 MBA501 - Strategy                     [Edit] [Remove]       │
│  [+ Add Class]                                                  │
│                                                                 │
│  DANGER ZONE                                                    │
│  ─────────────────────────────────────────────────────────────  │
│  [Export All Data]     [Delete Account]                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

# Part 6: Implementation Priorities

## Phase 1: Core Tasks (Week 1-2)

**Must Have:**
- [ ] Task CRUD with all fields
- [ ] Inbox, Today, Upcoming views
- [ ] Projects with sections
- [ ] Contexts and labels
- [ ] Quick add with natural language
- [ ] Basic search
- [ ] Keyboard shortcuts
- [ ] Mobile-responsive

## Phase 2: GTD Workflow (Week 2-3)

**Must Have:**
- [ ] Inbox processing flow
- [ ] Bulk actions
- [ ] Recurring tasks
- [ ] Waiting-for tracking
- [ ] Subtasks
- [ ] Task comments

## Phase 3: Vault Foundation (Week 3-4)

**Must Have:**
- [ ] Page CRUD
- [ ] Markdown editor
- [ ] Folder structure
- [ ] Full-text search
- [ ] Task -> Vault archival
- [ ] Daily notes

## Phase 4: Integration (Week 4-5)

**Must Have:**
- [ ] Semantic search
- [ ] Wiki-style linking
- [ ] Backlinks
- [ ] Agent integration
- [ ] Calendar sync
- [ ] Ceremonies

## Phase 5: Polish (Week 5-6)

**Nice to Have:**
- [ ] Analytics dashboard
- [ ] Goal tracking
- [ ] Advanced filters
- [ ] Templates
- [ ] Version history
- [ ] Offline support
- [ ] Native mobile apps

---

# Appendix: Quick Add Syntax Reference

```
BASIC
  "Buy groceries"                    -> Task in inbox

DATES
  "Buy groceries today"              -> Due today
  "Buy groceries tomorrow"           -> Due tomorrow
  "Buy groceries Jan 15"             -> Due Jan 15
  "Buy groceries next monday"        -> Due next Monday
  "Buy groceries in 3 days"          -> Due in 3 days

TIMES
  "Call mom at 2pm"                  -> Scheduled 2pm today
  "Meeting tomorrow at 10am"         -> Scheduled tomorrow 10am

PRIORITY (p1 = urgent, p4 = low)
  "Urgent report p1"                 -> Priority 4 (urgent)
  "Review docs p2"                   -> Priority 3 (high)
  "Nice to have p4"                  -> Priority 1 (low)

PROJECT (#)
  "Design mockups #Product Launch"   -> In Product Launch project
  "Read chapter #CS401"              -> In CS401 project

CONTEXT (@)
  "Call insurance @calls"            -> Context: @calls
  "Fix bug @computer"                -> Context: @computer
  "Buy milk @errands"                -> Context: @errands

LABELS (:)
  "Quick fix :quick-win"             -> Label: quick-win
  "Research :deep-work"              -> Label: deep-work

DURATION (~)
  "Review PR ~30m"                   -> 30 minute estimate
  "Write report ~2h"                 -> 2 hour estimate

COMBINED
  "Call client about proposal tomorrow 2pm p1 @calls #Acme :urgent ~30m"
  -> Due: Tomorrow 2pm
  -> Priority: Urgent (p1)
  -> Context: @calls
  -> Project: Acme
  -> Label: urgent
  -> Duration: 30 minutes
```

---

**END OF PRD**

*This document defines the complete product requirements for JD Tasks, JD Vault, and JD Command Center.*
