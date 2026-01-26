# JD Agent - Current Features & Capabilities

> **Last Updated:** January 24, 2026
> **Version:** 0.3.12
> **Phase:** Phase 3 - Verify & Coach

> **For Agents:** See [CLAUDE.md](/CLAUDE.md) for development rules and workflow requirements.

This document is the single source of truth for all current features and capabilities of the JD Agent system.

---

## Architecture Overview

| Component | Location | Purpose | Type |
|-----------|----------|---------|------|
| Hub (Backend API) | `/hub` | Central API server - single source of truth | Node.js + Hono |
| Command Center | `/apps/command-center` | Main dashboard (includes Journal, Settings) | Tauri Desktop App |
| Tasks App | `/apps/tasks` | Focused task management interface | Tauri Desktop App |
| Vault App | `/apps/vault` | Knowledge base (Notion-like) | Tauri Desktop App |
| Jobs App | `/apps/jobs` | Job hunting agent interface | Web App |
| Tasks iOS | `/apps/jd-tasks-ios` | Native iOS task management | iOS App (SwiftUI) |
| Command Center iOS | `/apps/jd-command-center-ios` | Native iOS briefing & productivity | iOS App (SwiftUI) |
| Shared Types | `/packages/types` | TypeScript type definitions | Library |
| API Client | `/packages/api-client` | Typed API client library | Library |

**Desktop Apps (Tauri):**
- Command Center, Tasks, and Vault are native macOS desktop applications
- Built with Tauri 2.x (Rust + WebView)
- Auto-launch on system startup via LaunchAgent
- Individual app icons and window management
- Dev mode: `bun run tauri:dev` in each app directory
- Production builds: `bun run tauri:build`

**iOS Apps (Native SwiftUI):**
- Tasks iOS and Command Center iOS are native iPhone applications
- Built with Swift 5.9+ and SwiftUI (iOS 16+)
- Siri Shortcuts integration for voice commands
- XcodeGen project configuration (`project.yml`)
- Dev mode: Open `.xcodeproj` in Xcode, build to device
- Production builds: Archive via Xcode

---

## Core Features

### 1. Task Management System

**GTD-Based Status Workflow:**
- `inbox` - Unclarified items (capture phase)
- `today` - Next actions for today
- `upcoming` - Scheduled for future date
- `waiting` - Delegated/waiting for someone
- `someday` - Someday/maybe list
- `done` - Completed
- `archived` - Moved to vault, searchable

**Task Properties:**
- Priority levels: 0 (none) to 4 (urgent)
- Hard vs. soft deadlines
- Time estimates (minutes)
- Energy level requirements (high, low, admin)
- Context tagging (@computer, @home, @calls, etc.)
- Project hierarchies and subtasks
- Blocking relationships between tasks
- Recurrence rules (RRULE format)
- Source tracking (email, canvas, meeting, recording, manual, calendar, remarkable)

**Task Operations:**
- Full CRUD (create, read, update, delete)
- Bulk status updates
- Filtering by status, project, context, priority, labels
- Auto-archival of completed tasks to vault
- Recurring task instance generation (automatic on task completion)

**Recurring Tasks:**
- Natural language parsing for recurrence patterns ("every Monday", "daily", "weekly")
- RRULE format storage (RFC 5545 compliant)
- Recurrence picker UI with presets (Daily, Weekdays, Weekly, Bi-weekly, Monthly)
- Automatic instance generation when recurring task is completed
- Batch processing job for missed instances
- Visual indicator on task cards showing recurrence pattern
- Supports: daily, weekly, bi-weekly, monthly, specific days (e.g., "every Tuesday and Thursday")

**Subtasks (NEW):**
- Create subtasks for any parent task (max 1 level deep)
- Subtask count indicator on parent task cards (e.g., "2/5 subtasks")
- Expandable subtask list in TaskCard with inline add/complete functionality
- Subtasks inherit context and project from parent by default
- Independent completion status (completing all subtasks doesn't auto-complete parent)
- Cascade delete (deleting parent removes all subtasks)
- QuickAddTask modal supports subtask creation mode
- API endpoints: GET/POST /api/tasks/:id/subtasks

### 2. Project Management

**Project Features:**
- Multi-level project hierarchy
- Status tracking (active, on_hold, completed, archived)
- Area of responsibility assignment
- Context association
- Target completion dates
- Linked vault folders for project notes
- Section-based task organization (Todoist-style)

### 3. Finance & Budgeting

**Budget Monitoring:**
- Plaid Link connection (Chase supported) with secure token encryption
- Manual CSV import fallback for bank exports
- Category budgets with weekly/monthly/yearly periods
- Remaining spend + percent used for current period
- YNAB-style envelope budgeting with “To Be Budgeted” tracking
- Category groups and move-money adjustments between budgets
- Category targets (weekly/monthly/yearly) with funded progress and overspending carry
- Month selector with per‑month budgeted allocations
- Budget dashboard for whole-budget at-a-glance
- Budget alerts via Email/SMS/Telegram with threshold controls
- Background sync jobs for near real-time updates

### 4. Vault (Knowledge Base)

**Architecture:**
The vault functionality is split across two apps for optimal user experience:

**Command Center** (Browse & Search):
- View vault entries in read-only mode
- Search and filter across all content
- Quick access from dashboard
- Lightweight browsing experience
- Redirects to Vault app for creation/editing

**Vault App** (Create & Edit):
- Full TipTap/Notion-style editor with rich formatting
- Create new pages and notes
- Edit existing entries with block-based editor
- Advanced features (slash commands, markdown shortcuts, etc.)
- Dedicated workspace for knowledge management

**Content Types (Legacy):**
- note, recording_summary, lecture, meeting, article, reference
- resume, document, journal, class_notes, meeting_notes
- task_archive, snippet, template, other

**Block-Based Editor (NEW - Notion-Style):**
- TipTap (Prosemirror-based) rich text editor
- Slash command menu (/) for quick block insertion
- Block types: text, heading_1/2/3, bulleted_list, numbered_list, todo, quote, code, divider, image
- Markdown shortcuts (# for headings, - for lists, [] for todos)
- Auto-save with debounced content changes
- Keyboard shortcuts: ⌘K (search), ⌘N (new page), ⌘\ (toggle sidebar), ⌘S (save)

**Page Features:**
- Hierarchical page organization (parent-child relationships)
- Custom page icons (emoji picker)
- Cover images (optional)
- Favorite pages pinned to sidebar
- Breadcrumb navigation
- Page reordering with drag-and-drop (planned)

**Sidebar:**
- Notion-style 224px collapsible sidebar
- Favorites section at top
- Hierarchical page tree with expand/collapse
- Quick actions: Search (⌘K), New page (⌘N)
- Settings link

**Command Palette (⌘K):**
- Quick page search
- Create new page
- Access legacy vault entries
- Keyboard navigation (arrows + Enter)

**Dark Mode Support (NEW):**
- System, light, and dark theme options
- Theme toggle in sidebar footer (dropdown variant)
- Persists preference to localStorage
- Respects system `prefers-color-scheme` when set to "system"
- CSS variables for consistent theming
- Dark mode styles for all components including prose content

**Entity Link Menu (NEW - [[):**
- Type `[[` in editor to open entity link menu
- Tab between Pages, Tasks, and Goals
- Advanced task filters: All, Today, Inbox, Upcoming, P1, P2
- Task icons show priority (🔴 P1, 🟠 P2, ✓ other)
- Real-time search with keyboard navigation
- Create new page option when no match found

**Entry Versioning (NEW):**
- Automatic version snapshots on content changes
- Version history with timestamps and change descriptions
- Restore to any previous version (creates backup first)
- Prune old versions (keep last N)
- API endpoints for version management

**Semantic Search (NEW - Complete):**
- Voyage AI embeddings for semantic similarity search
- Automatic embedding generation on entry create/update
- Query via `GET /api/vault/search?semantic=true`
- Falls back to full-text search when embeddings unavailable
- Backfill endpoint for existing entries: `POST /api/vault/embeddings/backfill`
- Stats endpoint: `GET /api/vault/embeddings/stats`

**Faceted Search API (NEW):**
- Filter counts for building search UIs
- Facets: contentTypes, contexts, sources, tags, dateRange
- Filtered facets (counts update based on applied filters)
- Combined search + facets with pagination
- Endpoints:
  - `GET /api/vault/facets` - Get facet counts
  - `GET /api/vault/faceted-search` - Search with facets

**Vault Chat (AI Assistant):**
- Slide-out chat panel for querying vault data
- Natural language questions about your knowledge base
- Uses master agent with vault_search and vault_get tools
- Suggested prompts for quick start
- Source citations with clickable links
- Clear history functionality
- Keyboard shortcuts: Escape to close

**Legacy Vault Features (Still Available):**
- Full-text search
- Tagging and categorization
- Duplicate detection
- File attachments (S3/R2 storage)
- Text extraction from uploaded files
- Automatic archival of completed tasks
- Related entries linking

**Mode Switching:**
- Toggle between new "Pages" mode and "Legacy" mode
- Seamless access to both systems from same interface

**Vault Sources:**
- remarkable, plaud, email, manual, web, canvas
- notion, google_drive, google_docs, apple_notes, tasks

### 4. Calendar Integration

**Dedicated Calendar Page (`/calendar`):**
- **Month View**: Full month grid with event dots, click date to drill down to day view
- **Week View** (default): 7-day time grid with hourly slots (6am-10pm), current time indicator
- **Day View**: Single day with full event details, larger time slots for easy clicking
- **Event Modal**: Create/edit events with title, type, all-day toggle, date/time, location, description
- **Navigation**: Previous/next period, today button, keyboard shortcuts (N/T/M/W/D/arrows/Esc)
- **Dashboard Integration**: "View Full Calendar" link from WeekCalendar widget

**Features:**
- Google Calendar sync (OAuth 2.0)
- Event types: class, meeting, deadline, personal, blocked_time
- Conflict detection
- Deadline alerts (every 15 minutes via scheduler)
- Event classification by context
- All-day vs. timed events
- Location tracking
- Bidirectional sync with external calendar

### 4.1 Weekly Planning Page (`/weekly-planning`) (NEW)

**Purpose:** Dedicated planning interface for weekly planning sessions (Fridays).

**Layout:**
- **Left Panel (320px)**: Weekly Backlog - tasks tagged with `#weekly-backlog`
- **Right Panel (flex)**: Planning Calendar - 17-day view (Friday + 2 weeks)

**Weekly Backlog Features:**
- Shows tasks with `#weekly-backlog` label
- Drag-and-drop to reorder (sortOrder persisted via API)
- Drag tasks to calendar to schedule them
- Task cards show: title, time estimate, project, context
- Priority indicator (color-coded border)
- Complete task checkbox

**Planning Calendar Features:**
- 17-day horizontal view: Friday through Sunday of week-after-next
- Droppable time slots for scheduling tasks
- Displays Google Calendar events
- Current time indicator (red line on today)
- Scrollable time grid (6am-10pm)
- Event type color coding

**Drag-and-Drop:**
- @dnd-kit library integration
- Drag from backlog to reorder priority
- Drag from backlog to calendar slot to schedule
- Automatically calls `/api/tasks/:id/schedule` with calculated times
- Uses task's `timeEstimateMinutes` for duration (default 60 min)

**API Endpoints:**
- `GET /api/tasks?label=weekly-backlog` - Fetch backlog tasks
- `POST /api/tasks/reorder` - Persist task ordering
- `POST /api/tasks/:id/schedule` - Schedule task (existing)

### 5. Master Agent (AI Assistant)

**Intelligence - Multi-Provider LLM Support:**
- **Provider Chain** (automatic fallback on errors/rate limits):
  1. **Groq** (FREE - 14,400 req/day) - `llama-3.3-70b-versatile`
  2. **Google Gemini** (FREE - 15 req/min) - `gemini-1.5-flash`
  3. **OpenAI** (PAID fallback) - `gpt-4-turbo-preview`
- **Vision**: OpenAI GPT-4o (for image-to-calendar extraction)
- Tool-use architecture with structured I/O (42 tools)
- Conversation history (up to 20 messages)
- Connected to both Web API (`/api/chat`) and Telegram bot

**Environment Variables:**
- `LLM_PROVIDERS=groq,gemini,openai` (optional, sets provider priority)
- `GROQ_API_KEY` - Get free at https://console.groq.com/keys
- `GOOGLE_AI_API_KEY` - Get free at https://aistudio.google.com/apikey
- `OPENAI_API_KEY` - Optional paid fallback

**Ingestion Channels:**
- Web chat interface (`/api/chat`)
- Telegram bot (two-way messaging)

**Available Tools (37 total):**

| Category | Tools | Description |
|----------|-------|-------------|
| **Tasks** | `task_create`, `task_list`, `task_update`, `task_complete`, `task_counts` | Full task management with inbox logic |
| **Vault** | `vault_search`, `vault_create`, `vault_get`, `vault_stats`, `vault_smart_add` | Knowledge base with smart classification |
| **Calendar** | `calendar_today`, `calendar_upcoming`, `calendar_query`, `calendar_create`, `calendar_check_conflicts`, `calendar_from_image` | Event management with image parsing |
| **People** | `people_create`, `people_search`, `people_get`, `people_update`, `people_add_interaction` | Contact/relationship management |
| **Scheduling** | `schedule_task`, `schedule_suggestions`, `schedule_today`, `unschedule_task` | Time blocking |
| **Canvas** | `canvas_sync`, `canvas_assignments` | LMS integration |
| **Time Tracking** | `time_log`, `time_report`, `time_stats` | Productivity tracking |
| **System** | `system_health`, `integrity_check`, `get_current_context` | Monitoring |

**Task Creation Logic:**
- Tasks WITHOUT `scheduledStart` → go to `inbox` (not fully baked)
- Tasks WITH `scheduledStart` → go to `today` or `upcoming` (fully baked)
- Clear distinction between `dueDate` (deadline) and `scheduledStart` (when to work on it)

**Smart Vault Classification:**
- Auto-detects content type (credential, person, financial, medical, legal, note)
- Auto-assigns context and tags based on content patterns
- Links to people when relevant
- Triggered by `-vault` or "remember this" phrases

**Image-to-Calendar:**
- Accepts screenshots of event invites/flyers
- Uses GPT-4o Vision to extract event details
- Auto-creates calendar event with title, time, location, attendees

**Communication Style:**
- Direct and efficient (no pleasantries)
- Football coach tone for accountability
- Proactive issue identification
- Always confirms actions taken

### 6. AI-Powered Testing Agent

**Purpose:** Autonomous QA testing using Claude Vision to explore and test the application like a human would.

**Capabilities:**
- Vision-based UI understanding via Claude's multimodal API
- Autonomous page exploration and interaction
- Bug detection and reporting
- Screenshot capture and analysis
- API endpoint testing
- Test report generation (HTML, JSON, Markdown)

**Testing Tools (18 total):**
| Category | Tools |
|----------|-------|
| Navigation | `navigate_to_page`, `click_element`, `fill_input`, `scroll`, `wait` |
| Vision | `take_screenshot`, `analyze_screenshot` |
| Verification | `verify_text_visible`, `verify_element_exists`, `verify_url`, `verify_element_state`, `get_element_text` |
| API | `api_request`, `verify_api_response` |
| Control | `log_finding`, `start_test_scenario`, `end_test_scenario`, `complete_testing` |

**Test Scopes:**
- `smoke` - Quick verification of all major pages
- `full` - Comprehensive testing with edge cases
- `specific` - Test specific pages only

**Usage:**
```bash
# CLI
bun run test:ai              # Smoke test
bun run test:ai:full         # Full test
bun run test:ai:smoke        # Explicit smoke test

# API
POST /api/testing/run        # Run custom test
POST /api/testing/smoke      # Quick smoke test
GET /api/testing/status      # Check configuration
```

**Reports Generated:**
- HTML report with embedded screenshots
- JSON report for programmatic access
- Markdown report for documentation

### 7. Job Hunting Agent

**Status Workflow:**
- `discovered` - Found by agent or saved
- `saved` - Saved for later review
- `applying` - Currently filling out application
- `applied` - Application submitted
- `phone_screen` - Phone screen scheduled/completed
- `interviewing` - In interview process
- `offered` - Received offer
- `rejected` - Application rejected
- `withdrawn` - User withdrew
- `accepted` - Accepted offer

**Features:**
- Manual job entry for applications made outside the agent
- Dashboard with application statistics
- Kanban pipeline view (drag-drop status changes)
- Job list with filtering by status/platform
- Resume management with variant selection
- Job profile for targeting preferences
- Screening question answer library
- Vault integration for archival
- Application history tracking

**Frontend Views:**
- Dashboard: Stats, active applications, follow-ups
- Pipeline: Kanban board by status
- Jobs: Filterable list of all jobs
- Resumes: Resume variant management
- Profile: Job search preferences
- Settings: Agent configuration

**API Endpoints:**
```
GET    /api/jobs              # List with filters
GET    /api/jobs/stats        # Dashboard stats
GET    /api/jobs/:id          # Single job
POST   /api/jobs              # Create job
POST   /api/jobs/manual       # Manual entry
PATCH  /api/jobs/:id          # Update job
DELETE /api/jobs/:id          # Delete job
POST   /api/jobs/:id/apply    # Mark as applied
POST   /api/jobs/:id/archive  # Archive to vault

GET    /api/jobs/resumes      # List resumes
POST   /api/jobs/resumes      # Create resume
GET    /api/jobs/profile      # Get profile
PATCH  /api/jobs/profile      # Update profile
GET    /api/jobs/screening    # List screening answers
POST   /api/jobs/screening    # Add screening answer
```

**Database Tables:**
- `jobs` - Job listings and application tracking
- `resume_metadata` - Resume variants with extracted skills
- `job_profile` - User job search preferences
- `screening_answers` - Answers to common screening questions
- `application_history` - Timeline of job application events

### 8. Canvas Integrity Agent

**Purpose:** Autonomous verification that all Canvas LMS assignments exist as tasks with correct due dates and project assignments. Plus complete homework experience without needing to visit Canvas.

**Features:**
- Browser automation via Playwright for Canvas scraping
- API-based assignment sync with term filtering
- Nested project hierarchy (Semester → Class → Assignments)
- Automatic task creation with both due date and scheduled date
- Integrity audits (full, incremental, quick check)
- Telegram nudges for unscheduled Canvas tasks
- Full web scraping of course content:
  - Wiki pages extraction with content and HTML
  - Course files listing with download URLs
  - Readings extraction from modules (external links, files, pages)
  - Module items with position tracking

**Canvas Complete Phase 1 - Rich Assignment Details:**
- Full assignment instructions with HTML and cleaned text
- Rubric extraction with criteria, points, and ratings
- Word count requirements parsing from instructions
- AI-powered time estimation for assignments
- Group assignment and peer review detection
- Subtask/checklist generation for assignments
- Assignment detail modal with tabs for Details, Rubric, Checklist

**Canvas Complete Phase 2 - Course Materials:**
- Automatic file download from Canvas (PDFs, slides, documents)
- Storage organization by course: `hub/storage/canvas/{course}/`
- Material type detection (case, reading, lecture, syllabus, template)
- Reading progress tracking (unread, in_progress, completed)
- Vault page creation for materials (searchable in Vault)
- Course Materials UI component with module grouping
- Related materials linked to assignments

**Canvas Complete Phase 3 - Connected Workflow:**
- Auto-generated Vault pages for assignments with structured content:
  - Header callout with key info (course, due date, points, time estimate)
  - Assignment details section with submission requirements
  - Full instructions content
  - Rubric with expandable criteria and ratings
  - Materials section linked to downloaded files
  - Notes section for working on the assignment
  - Checklist with default items
  - Canvas link for fallback access
- Task-to-Vault-page linking for seamless navigation
- Quick actions on task cards and modals:
  - Open Assignment Page (create/view Vault page)
  - View Materials (jump to related files)
  - Add Note (quick note creation)
  - Open in Canvas (fallback)
- CanvasQuickActions component for inline task actions

**Canvas Complete Phase 4 - Homework Hub Dashboard:**
- Homework Hub dashboard widget with centralized homework view:
  - Due Today section with urgency indicators (critical, high, medium, low)
  - Due This Week section with assignments grouped by date
  - Readings Due section with read progress tracking
  - Upcoming assignments (next 2 weeks)
- Summary statistics:
  - Count of items due today, this week, upcoming
  - Total estimated time for today and week
  - Critical/urgent assignment count
- Progress tracking for multi-part assignments:
  - Subtask completion percentage
  - Status indicators (not_started, in_progress, ready_to_submit, completed)
- Urgency calculations based on hours until due:
  - Critical: < 24 hours or past due
  - High: 24-48 hours
  - Medium: 48-72 hours
  - Low: > 72 hours
- Compact widget mode for dashboard layouts
- Reading progress display with unread/in-progress status

**Canvas Complete Phase 5 - Direct Submission:**
- Submit assignments directly from JD Agent without opening Canvas:
  - Text entry submission
  - URL submission
  - File upload submission (coming soon)
- Submission status tracking:
  - Current submission state (submitted, graded, pending_review)
  - Submission attempt count
  - Late/missing flags
  - Grade and score display
- Submission history with all attempts
- Instructor comments display
- Submitted files list
- SubmissionPanel component with tabbed interface
- Auto-marks linked task as completed on successful submission

**Canvas Complete Phase 5 - Grade Tracking:**
- Grade summary across all courses:
  - Overall average percentage and letter grade
  - Total graded vs pending assignments
  - Course-by-course averages
- Recent grades display with scores and percentages
- New grade alerts with pulse animation notification
- Course-specific grade views
- Pending grades list (submitted but not graded)
- Grade color coding by percentage:
  - Green: 90%+ (A range)
  - Blue: 80-89% (B range)
  - Yellow: 70-79% (C range)
  - Orange: 60-69% (D range)
  - Red: <60% (F)
- GradesWidget for dashboard (compact and full modes)
- Database fields: grade, score, gradedAt, isLate, isMissing

**Database Tables:**
- `canvas_items` - Track all Canvas assignments with rich details (including grade fields)
- `canvas_audits` - Audit run history and findings
- `class_project_mapping` - Link Canvas courses to projects
- `canvas_schedule_tracking` - Track scheduling status
- `canvas_assignment_subtasks` - AI-generated or manual checklists
- `canvas_assignment_pages` - Vault page links for assignments
- `canvas_materials` - Downloaded course files with reading tracking

**API Endpoints:**
```
POST /api/canvas-integrity/audit         # Trigger full audit
POST /api/canvas-integrity/audit/quick   # Quick API-only check
GET  /api/canvas-integrity/status        # Current integrity status
GET  /api/canvas-integrity/unscheduled   # List unscheduled tasks
POST /api/canvas-integrity/nudge         # Send nudge now
GET  /api/canvas-integrity/assignments/:id/full    # Full assignment details
GET  /api/canvas-integrity/homework      # Homework dashboard data

# Course Materials API
GET  /api/canvas-materials               # List all materials
GET  /api/canvas-materials/by-course/:id # Materials grouped by module
GET  /api/canvas-materials/readings      # Reading list
GET  /api/canvas-materials/:id/download  # Download file
GET  /api/canvas-materials/:id/view      # View file inline
PATCH /api/canvas-materials/:id/progress # Update reading progress
POST /api/canvas-materials/sync/:courseId # Sync from Canvas

# Homework Hub API
GET  /api/canvas-integrity/homework-hub          # Full homework hub data
GET  /api/canvas-integrity/homework-hub/summary  # Summary statistics
GET  /api/canvas-integrity/homework-hub/due-today    # Assignments due today
GET  /api/canvas-integrity/homework-hub/due-this-week # Due this week
GET  /api/canvas-integrity/homework-hub/critical     # Critical/urgent items

# Submission API (Phase 5)
GET  /api/canvas-integrity/assignments/:id/submission           # Submission status
GET  /api/canvas-integrity/assignments/:id/submission/can-submit # Check if can submit
GET  /api/canvas-integrity/assignments/:id/submission/history   # Submission history
POST /api/canvas-integrity/assignments/:id/submit/text          # Submit text entry
POST /api/canvas-integrity/assignments/:id/submit/url           # Submit URL
POST /api/canvas-integrity/assignments/:id/submit/file          # Submit file

# Grades API (Phase 5)
GET  /api/canvas-integrity/grades/summary              # Grade summary
GET  /api/canvas-integrity/grades/check                # Check for new grades
GET  /api/canvas-integrity/grades/pending              # Pending grades
GET  /api/canvas-integrity/grades/course/:courseId     # Course grades
```

### 9. Ceremonies System

**Morning Ceremony (6 AM):**
- Greeting and motivation
- Weather and daily priorities
- Today's top 3 tasks
- Today's habits to complete
- Upcoming deadlines
- Calendar overview
- Goals needing attention (with health scores)
- Upcoming milestones for the week

**Evening Ceremony (9 PM):**
- Day review and wins
- Habit completion summary (perfect day celebration)
- Incomplete items for tomorrow
- Top habit streaks celebration
- Recent goal wins from reflections
- Enhanced reflection prompts
- Energy levels assessment
- Rest reminder

**Weekly Review (Sunday 4 PM):**
- Week in review
- Life area progress breakdown
- Goals progress with health scores
- Habit performance summary
- Weekly highlights and improvements
- Wins and learnings
- Next week planning

**Delivery Channels:**
- Telegram bot
- SMS (Twilio)
- Email (Resend)

### 10. Smart Data Recovery Migration

**Purpose:** Recover and intelligently categorize data from Apple Notes, Notion, Todoist, and Google Drive into organized buckets.

**Bucket Structure:**
```
Reference/
├── Sites & Credentials (passwords, logins, accounts)
├── Family/
│   ├── Sam
│   ├── JD
│   ├── Ava
│   └── John
├── People (contacts, doctors)
└── Documents (important docs)

Archive/
├── Old Journal (pre-2026 entries)
├── Todoist Archive
├── Notes Archive
├── Notion Archive
└── Work Archive

MBA/
├── 2026 Winter Semester
└── School Archive

Professional/
├── Resumes
├── Job Applications
└── Career Planning

Personal/
├── Journal (2026+ entries)
├── Health & Fitness
├── Travel & Trips
└── Goals & Plans

Inbox/ (needs review)
```

**Smart Categorization:**
- Pattern-based detection for credentials, family members, resumes
- Date-based routing (old vs current content)
- Source-based archival (Todoist, Notion, Apple Notes)
- Keyword matching for MBA, professional, health content
- AI-enhanced classification with GPT-4o-mini (optional)
- Confidence scoring for flagging ambiguous items

**Usage:**
```bash
# Dry run (preview changes)
bun run migrate:recover:dry

# Execute full migration from all sources
bun run migrate:recover --execute

# Migrate specific sources
bun run migrate:recover:apple     # Apple Notes only
bun run migrate:recover:notion    # Notion only
bun run migrate:recover:todoist   # Todoist only
bun run migrate:recover:drive     # Google Drive only
```

**Required Environment Variables:**
```bash
# For Notion
NOTION_API_KEY=ntn_xxx

# For Todoist
TODOIST_API_KEY=xxx

# For Google Drive
GOOGLE_CLIENT_ID=xxx
GOOGLE_CLIENT_SECRET=xxx
GOOGLE_REFRESH_TOKEN=xxx

# For AI classification (optional)
OPENAI_API_KEY=sk-xxx
```

**Migration Features:**
- Duplicate detection (by title + source)
- Incremental migration support
- Error recovery and continuation
- Detailed statistics reporting
- Items needing review flagged (`needsReview: true`)

### 11. Goals & Habits Tracking System

**Life Areas (6 Fixed Categories):**
| Area | Icon | Color | Description |
|------|------|-------|-------------|
| Spiritual | 🙏 | #8B5CF6 | Faith, meditation, purpose, values |
| Personal | 🧠 | #3B82F6 | Self-improvement, hobbies, learning |
| Fitness | 💪 | #10B981 | Physical health, exercise, nutrition |
| Family | 👨‍👩‍👧‍👦 | #F59E0B | Relationships, parenting, community |
| Professional | 💼 | #6366F1 | Career, business, income |
| School | 🎓 | #EC4899 | Education, certifications, academic |

**Goal Features:**
- Goal types: achievement, maintenance, growth
- Metric types: boolean, numeric, percentage, milestone
- Status workflow: active → paused → completed/abandoned
- Health scoring (0-100) based on:
  - Progress vs expected timeline
  - Linked active habits
  - Milestone completion rate
  - Recent activity (reflections)
- Automatic progress recalculation from milestones
- Motivation and vision statements
- Target dates with projected completion
- Vault integration for documentation

**Milestone System:**
- Ordered checkpoints within goals
- Status: pending, in_progress, completed, skipped
- Target dates with overdue tracking
- Evidence capture on completion
- Auto task generation for upcoming milestones
- Progress percentage updates goal automatically

**Habit Tracking:**
- Frequency: daily, weekly, specific days
- **Day Selector UI**: Interactive day picker (S M T W T F S) for specific days frequency
- Habits with specific days only appear in Today view and Journal on selected days
- Time of day preference (morning, afternoon, evening)
- Current and longest streak tracking
- 2-day grace period for streak protection
- Quality ratings and duration tracking
- Goal linking for habit-goal relationships
- Life area assignment

**Reflections (Goal Journaling):**
- Types: progress, obstacle, win, adjustment
- Sentiment tracking: positive, neutral, negative, mixed
- Search and filtering
- Goal activity tracking
- Vault export capability

**Progress Dashboard:**
- Today's habits completion percentage
- Progress by life area
- Top habit streaks
- Goals needing attention (alerts)
- Overall goal completion rate
- Upcoming milestones
- Weekly reports with highlights

**Task Generation:**
- Auto-generate tasks from upcoming milestones
- Goal check-in reminders for stale goals
- Habit reminder tasks to protect streaks
- Tasks linked back to goals/habits/milestones

**Vault Integration:**
- Export complete goal journeys to vault
- Export individual reflections
- Create goal notes
- Auto-export completed goals

**API Endpoints:**
```
# Goals
GET    /api/goals                    # List with filters
GET    /api/goals/by-life-area       # Stats by life area
GET    /api/goals/needs-attention    # Low health score goals
GET    /api/goals/:id                # Get goal (with relations)
GET    /api/goals/:id/health         # Health report
POST   /api/goals                    # Create goal
PATCH  /api/goals/:id                # Update goal
POST   /api/goals/:id/progress       # Update progress
POST   /api/goals/:id/recalculate    # Recalculate from milestones
POST   /api/goals/:id/complete       # Mark completed
POST   /api/goals/:id/pause          # Pause goal
POST   /api/goals/:id/resume         # Resume goal
POST   /api/goals/:id/abandon        # Abandon goal
DELETE /api/goals/:id                # Delete goal

# Milestones
GET    /api/milestones               # List by goal
GET    /api/milestones/upcoming      # Upcoming milestones
GET    /api/milestones/overdue       # Overdue milestones
GET    /api/milestones/:id           # Get milestone
POST   /api/milestones               # Create milestone
PATCH  /api/milestones/:id           # Update milestone
POST   /api/milestones/:id/complete  # Complete milestone
POST   /api/milestones/:id/start     # Start milestone
POST   /api/milestones/:id/skip      # Skip milestone
POST   /api/milestones/reorder       # Reorder milestones
DELETE /api/milestones/:id           # Delete milestone

# Progress Dashboard
GET    /api/progress/overview        # Full dashboard
GET    /api/progress/weekly          # Weekly report
GET    /api/progress/area/:area      # Life area detail
GET    /api/progress/areas           # All areas summary
GET    /api/progress/streaks         # Top streaks
GET    /api/progress/habits          # Habit dashboard
GET    /api/progress/life-areas      # Life area metadata

# Reflections
GET    /api/reflections              # List by goal
GET    /api/reflections/recent       # Recent reflections
GET    /api/reflections/wins         # Win reflections
GET    /api/reflections/obstacles    # Obstacle reflections
GET    /api/reflections/search       # Search reflections
POST   /api/reflections/:goalId      # Create reflection
DELETE /api/reflections/:id          # Delete reflection

# Task Generation
POST   /api/task-generation/generate # Run all generators
POST   /api/task-generation/milestones # Generate milestone tasks
POST   /api/task-generation/checkins   # Generate check-in tasks
POST   /api/task-generation/habits     # Generate habit reminders
POST   /api/task-generation/action     # Create goal action task
GET    /api/task-generation/goal/:id/tasks   # Tasks for goal
GET    /api/task-generation/habit/:id/tasks  # Tasks for habit

# Goal Vault Integration
POST   /api/goal-vault/export/journey/:goalId     # Export goal journey
POST   /api/goal-vault/export/reflection/:id      # Export reflection
POST   /api/goal-vault/export/completed           # Export all completed
GET    /api/goal-vault/entries/:goalId            # Vault entries for goal
POST   /api/goal-vault/note                       # Create goal note
```

**Database Tables:**
- `goals` - Goal definitions with life area, progress, health
- `milestones` - Ordered checkpoints within goals
- `habits` - Habit definitions with streak tracking
- `habit_completions` - Daily habit completion records
- `goal_reflections` - Journal entries for goals
- `goal_tasks` - Links tasks to goals/milestones
- `habit_tasks` - Links tasks to habits

### 12. Daily Journal & Review (Command Center Integration)

**Purpose:** Evening review workflow to reflect on the day, track habits, review goals, and prepare for tomorrow. **Now integrated into Command Center** at `/journal` route.

**7-Step Review Workflow:**
1. **Habits Review** - View daily habits with completion status and streaks, toggle completions
2. **Goals Review** - Review active goals grouped by life area with progress bars
3. **Journal Entry** - Free-form text entry with word count
4. **Tasks Review** - Review completed tasks with optional reflection notes per task
5. **Classes Review** - Review class notes taken today with key takeaways (conditional - only shows if class notes exist)
6. **Tomorrow Preview** - 3-column grid showing tomorrow's events, tasks, and habits
7. **Complete Review** - Select mood (5 levels), add tags, view summary, save to vault

**Features:**
- Auto-save every 30 seconds
- Mood selector with 5 levels (great, good, okay, difficult, terrible)
- Tag input with add/remove functionality
- Habit completion toggle during review (with streak display)
- Visual progress bar showing step completion
- Click-to-navigate step icons
- Review history view with past reviews
- Completed review summary with vault integration
- Dark theme matching Command Center styling

**Review Data Captured:**
- Journal text with word count
- Mood selection
- Tags array
- Habits completed/total counts
- Goals reviewed count
- Task reflections (taskId, title, note)
- Class reflections (classId, className, note)
- Tomorrow's event/task counts
- Review duration
- Start and completion timestamps

**API Endpoints:**
```
GET    /api/journal/daily-review           # Get all review data for date
POST   /api/journal/daily-review/save      # Auto-save draft
POST   /api/journal/daily-review/complete  # Complete review + save to vault
GET    /api/journal/daily-review/history   # Paginated history
GET    /api/journal/daily-review/search    # Full-text search
POST   /api/journal/habits/:habitId/toggle # Toggle habit completion
POST   /api/journal/daily-review/:id/update-metrics # Update review metrics
```

**Command Center Integration:**
```
/apps/command-center/src/
├── api/journal.ts              # Journal API client with types
├── hooks/useJournal.ts         # React Query hooks
└── pages/Journal.tsx           # Full 7-step review page
    ├── HabitsStep              # Step 1: Toggle habits, view streaks
    ├── GoalsStep               # Step 2: Goals by life area
    ├── JournalStep             # Step 3: Free-form writing
    ├── TasksStep               # Step 4: Completed tasks + reflections
    ├── ClassesStep             # Step 5: Class notes (conditional)
    ├── TomorrowStep            # Step 6: Preview grid
    ├── CompleteStep            # Step 7: Mood, tags, complete
    ├── CompletedView           # Post-completion summary
    └── HistoryView             # Browse past reviews
```

**Database Schema Extensions:**
Extended `dailyReviews` table with:
- `journalText`, `wordCount` - Journal content
- `tasksReviewed`, `classesReviewed` - JSONB reflection arrays
- `habitsCompletedCount`, `habitsTotalCount` - Habit stats
- `goalsReviewedCount`, `tomorrowEventsCount`, `tomorrowTasksCount`
- `tags` - Text array
- `mood` - 5-level mood enum
- `currentStep`, `reviewCompleted`, `reviewDurationSeconds`
- `vaultPageId` - Link to vault page on completion
- `startedAt`, `completedAt` - Timestamps

**Navigation:**
- Accessible via sidebar under "Journal" (between Habits and Vault)
- Route: `/journal` in Command Center
- Keyboard shortcut: `g j` (go to journal) *planned*

---

## Integrations

| Service | Status | Capabilities |
|---------|--------|--------------|
| **Canvas LMS** | Active | Assignment/quiz sync, course content, integrity agent |
| **Google Calendar** | Active | Event sync, schedule management, conflict detection |
| **Gmail** | Partial | Email ingestion works, task extraction limited |
| **Notion** | Active | Page extraction, database import |
| **Google Drive** | Active | Document extraction, file management |
| **Apple Notes** | Active | Batch import via AppleScript |
| **Todoist** | Migration | Task migration and extraction (v1 & v2 APIs) |
| **Smart Data Recovery** | Active | AI-enhanced migration from all sources with smart bucketing |
| **Telegram** | Active | Two-way chat bot interface |
| **ReMarkable** | Active (100%) | MBA class notes pipeline, OCR, content merging with Plaud |
| **Plaud Pro** | Active (80%) | VIP pipeline + voice profiles + speaker labels + voice commands |
| **Deepgram** | Active | Audio transcription with speaker diarization (Nova-2 model) |
| **Voyage AI** | Partial | Embeddings schema ready, search wiring in progress |
| **Twilio** | Configured | SMS notifications |
| **Resend** | Configured | Email notifications |
| **Whoop** | Active | Recovery, strain, sleep metrics + auto-reauthorization via Playwright |
| **Garmin Connect** | Active | Steps, heart rate, sleep, stress, body battery, activities via python-garminconnect |
| **Linear** | Deprecated | Removed per roadmap v3 (PostgreSQL is source of truth) |

---

## API Endpoints

| Endpoint | Methods | Purpose |
|----------|---------|---------|
| `/api/health` | GET | System health checks (live, ready, full) |
| `/api/health/personal` | GET | Personal health data (Whoop metrics) |
| `/api/health/status` | GET | Quick health status for dashboard |
| `/api/tasks` | GET, POST, PUT, DELETE | Task management |
| `/api/projects` | GET, POST, PUT, DELETE | Project hierarchy |
| `/api/vault` | GET, POST, PUT, DELETE, SEARCH | Knowledge base |
| `/api/calendar` | GET, POST, PUT, DELETE | Calendar events |
| `/api/chat` | POST | Master Agent conversation |
| `/api/ceremonies` | GET, POST | Morning/evening/weekly ceremonies |
| `/api/ingestion` | POST | Data import from external sources |
| `/api/search` | GET | Full-text and semantic search |
| `/api/analytics` | GET | System metrics |
| `/api/dashboard` | GET | Enhanced dashboard metrics (6 cards) |
| `/api/schedule` | GET, POST, PUT | Time blocking |
| `/api/system` | GET, POST | System configuration and logs |
| `/api/setup` | GET, POST | Initial setup wizard |
| `/api/webhooks` | POST | Integration webhooks |
| `/api/logs` | GET | Activity and system logs |
| `/api/whoop` | GET, POST | Whoop fitness data |
| `/api/garmin` | GET | Garmin Connect health data (steps, HR, sleep, stress, body battery) |
| `/api/health/combined` | GET | Combined health data from Whoop + Garmin |
| `/api/health/whoop-auto-auth/status` | GET | WHOOP auto-auth status |
| `/api/health/whoop-auto-auth/authenticate` | POST | Trigger WHOOP auto-reauthorization |
| `/api/testing` | GET, POST | AI-powered testing agent |
| `/api/labels` | GET, POST, PATCH, DELETE | Tag taxonomy with categories, suggestions, validation |

**Web UIs served from Hub:**
- `/setup` - Web-based setup wizard
- `/chat` - Web chat interface
- `/brain-dump` - Quick capture interface
- `/privacy` - Privacy policy page

---

## Background Processing

**Job Queue:** BullMQ + Redis

**Processors:**
- `transcription.ts` - Audio file transcription via Deepgram
- `summarization.ts` - Content and recording summarization
- `task-extraction.ts` - Extract tasks from recordings/emails
- `email-triage.ts` - Email classification and task creation

**Scheduled Jobs (Cron):**
| Job | Schedule | Purpose |
|-----|----------|---------|
| Morning ceremony | 6 AM daily | Daily briefing |
| Evening ceremony | 9 PM daily | Day review |
| Weekly review | Sunday 4 PM | Week planning |
| Canvas sync | Every 6 hours | Assignment updates |
| Email monitoring | Every hour | Email ingestion |
| Integrity checks | Twice daily | Data validation |
| Deadline alerts | Every 15 minutes | Upcoming deadline notifications |

---

## Plaud Pro Integration (VIP Pipeline)

**Status:** Phase 4 Complete (90%) - Full pipeline + Voice Profiles + Speaker Labels + Voice Commands + Speaker Recognition

### What Works
- **File Watcher:** Monitors `PLAUD_SYNC_PATH` for new audio files (MP3, M4A, WAV, etc.)
- **R2 Storage:** Audio files uploaded to Cloudflare R2 with presigned URLs
- **Deepgram Transcription:** Nova-2 model with speaker diarization enabled
- **VIP Batch System:** Recording batches tracked with processing status
- **Job Queue:** BullMQ pipeline fully implemented
- **Calendar Alignment:** Matches recordings to Google Calendar events (30%+ overlap)
- **AI Summarization:** Generates summaries and extracts key points via LLM
- **Task Extraction:** Parses action items with due date detection (days of week, tomorrow, etc.)
- **Vault Pages:** Auto-generates formatted pages with summary, key points, and transcript
- **Telegram Notifications:** Sends daily summary with batch stats and extracted tasks
- **Voice Profiles:** Speaker identification system with manual name assignment
- **Speaker Mappings:** Per-transcript mapping of Deepgram speaker IDs to voice profiles
- **Speaker-Labeled Transcripts:** Vault pages display speaker names instead of "Speaker 1, 2, 3"
- **Voice Commands:** Wake word detection ("Plaud, add task...") with command execution
  - Supported: task, reminder, note, highlight, event/schedule, todo
  - Date extraction: today, tomorrow, day names, next week, end of week
  - Priority keywords: urgent, high priority, important, low priority
  - Speaker verification: Only executes commands from "self" voice profile
- **Automatic Speaker Recognition (NEW):** Voice embedding-based speaker identification
  - Python microservice with pyannote-audio for 512-dim embeddings
  - pgvector PostgreSQL extension for efficient cosine similarity search
  - Auto-matches speakers to known profiles (threshold: 0.7)
  - Verification workflow for uncertain matches (0.7-0.8 confidence)
  - Voice samples stored per profile for continuous learning
  - Runs as async job in parallel with vault writer

### API Endpoints
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/ingestion/plaud/status` | GET | Check integration configuration |
| `/api/ingestion/plaud/recordings` | GET | List recordings in sync folder |
| `/api/ingestion/plaud/sync` | POST | Manually sync all recordings |
| `/api/ingestion/plaud/watch/start` | POST | Start file watcher |
| `/api/ingestion/plaud/watch/stop` | POST | Stop file watcher |
| `/api/ingestion/vip/upload` | POST | Upload audio for VIP processing |
| `/api/ingestion/vip/status` | GET | VIP service status |
| `/api/ingestion/vip/batches` | GET | List processing batches |
| `/api/ingestion/vip/batches/:id` | GET | Get batch details |
| `/api/ingestion/vip/batches/:id/resume` | POST | Resume failed batch |
| `/api/voice-profiles` | GET, POST | List/create voice profiles |
| `/api/voice-profiles/self` | GET | Get/create self (JD) profile |
| `/api/voice-profiles/:id` | GET, PATCH, DELETE | Manage individual profile |
| `/api/voice-profiles/:id/samples` | GET, POST | List/create voice samples for profile |
| `/api/voice-profiles/transcripts/:id/speakers` | GET | Get speaker mappings for transcript |
| `/api/voice-profiles/transcripts/:id/speakers/:speakerId` | POST, DELETE | Assign/remove speaker mapping |
| `/api/voice-profiles/transcripts/:id/initialize` | POST | Initialize speaker mappings |
| `/api/voice-profiles/transcripts/:id/auto-match` | POST | Trigger automatic speaker recognition |
| `/api/voice-profiles/mappings/unverified` | GET | List auto-matches needing verification |
| `/api/voice-profiles/mappings/:id/verify` | POST | Confirm/reject auto-matched speaker |
| `/api/voice-profiles/embedding/status` | GET | Check embedding service status |

### VIP Pipeline Steps (All Implemented)
1. **Ingestion** - Create batch, upload files to R2
2. **Segmentation** - Creates 1:1 segments per recording (future: split by silence/speaker)
3. **Calendar Alignment** - Matches to Google Calendar events with overlap detection
4. **Transcription** - Deepgram Nova-2 with speaker diarization
5. **Extraction** - LLM summarization, key points, task extraction with due dates
6. **Speaker Embedding** - Auto-matches speakers using voice embeddings (runs async)
7. **Vault Writer** - Creates formatted pages with callouts, headings, and transcripts
8. **Notification** - Telegram summary with stats, content breakdown, and tasks

### What's Missing (Planned for Q1 2026)
- **Voice Command UI:** Visual feedback for detected/executed commands
- **Multi-Recording Batches:** Process multiple files in single batch
- **Speaker Recognition UI:** Review and verify auto-matched speakers

### Database Tables
- `recordings` - Recording metadata and processing status
- `transcripts` - Full text and JSONB segments with speaker IDs
- `recording_summaries` - AI-generated summaries
- `recording_batches` - VIP batch tracking
- `recording_segments` - Time-based segments linked to calendar
- `extracted_items` - Tasks/notes extracted from transcripts
- `class_pages` - Links calendar events to vault pages
- `voice_profiles` - Speaker identification profiles with embeddings (512-dim vector)
- `speaker_mappings` - Per-transcript mapping with auto-match fields (autoMatched, needsVerification, matchScore)
- `voice_samples` - Audio samples for training speaker embeddings (per profile)

### Configuration
```bash
# Storage
PLAUD_SYNC_PATH=/path/to/plaud/sync  # Local folder for synced recordings
R2_ENDPOINT=xxx                       # Cloudflare R2 endpoint
R2_ACCESS_KEY=xxx                     # R2 credentials
R2_SECRET_KEY=xxx
R2_BUCKET_NAME=xxx                    # Storage bucket

# Transcription
DEEPGRAM_API_KEY=xxx                  # Transcription service

# Speaker Recognition (Optional)
EMBEDDING_SERVICE_URL=http://localhost:8001  # Python embedding microservice
SPEAKER_MATCH_THRESHOLD=0.7                   # Auto-match confidence threshold
HF_TOKEN=hf_xxx                               # HuggingFace token for pyannote
```

### Key Files
- `/hub/src/integrations/plaud.ts` - File watcher & sync
- `/hub/src/integrations/deepgram.ts` - Transcription service
- `/hub/src/services/vip-service.ts` - Pipeline orchestration
- `/hub/src/jobs/processors/vip.ts` - Job processors (fully implemented)
- `/hub/src/services/voice-profile-service.ts` - Voice profile management
- `/hub/src/services/voice-command-service.ts` - Wake word detection & command parsing
- `/hub/src/services/speaker-embedding-service.ts` - Voice embedding extraction & matching
- `/hub/src/api/routes/voice-profiles.ts` - Voice profile API routes
- `/services/embedding-server/` - Python FastAPI microservice (pyannote-audio)

### PRD Reference
See `docs/plans/plaud-integration-prd-v3.md` for detailed implementation plan.

---

## Remarkable Integration (Handwritten Notes)

**Status:** Complete (100%) - Full MBA class notes pipeline with Cloud sync, PDF rendering, and OCR

### What Works

#### Remarkable Cloud Sync (NEW)
- **Cloud API Integration:** Direct sync with Remarkable Cloud servers via device token authentication
- **Folder Tree Browser:** Interactive UI to browse MBA folder structure (BYU MBA > Semester > Class)
- **Multi-page PDF Rendering:** Converts `.rm` files to PDF using `rmc` tool with correct page ordering
- **Apple Vision OCR:** Extracts handwritten text from rendered PDFs with page separators
- **MBA Vault Sync:** Syncs entire BYU MBA folder structure to Vault pages with PDFs attached
- **Daily Grouping:** Multiple documents from same day grouped into single Vault page
- **Background Jobs:** Async MBA sync via BullMQ job queue (handles 90+ second syncs)
- **Sync UI:** Dedicated `/remarkable` page in Command Center with status cards and folder tree

#### Legacy File Watcher
- **Naming Convention Parser:** Auto-classifies notes via `MBA/[Semester]/[ClassCode]/[YYYY-MM-DD]` pattern
- **File Watcher:** Monitors `REMARKABLE_SYNC_PATH` for new PDF, PNG, SVG, TXT files
- **Vault Structure Auto-Creation:** Automatically creates `vault/academic/mba/{semester}/{class}/days/{date}/`
- **OCR Processing:** Google Cloud Vision for handwriting recognition with confidence scoring
- **PDF Text Extraction:** Direct text extraction for typed PDFs via pdf-parse
- **Content Merging:** Combines Remarkable OCR + Plaud transcripts + typed notes into `_combined.md`
- **Vault Page Generation:** Auto-creates/updates vault pages for class days
- **General Inbox:** Non-class notes routed to `vault/remarkable/inbox/` for GTD weekly review
- **Database Tracking:** Full sync history, OCR confidence, classification status
- **Background Jobs:** Async processing for sync, OCR, and merge operations
- **Manual Corrections:** Update OCR text, reclassify notes, mark as reviewed

### Naming Convention
```
MBA/[Semester]/[ClassCode]/[YYYY-MM-DD]

Examples:
- MBA/Spring2026/MGMT501/2026-01-08 → Class note for MGMT501
- MBA/Fall2025/ACCT600/2025-09-15 → Class note for ACCT600
- shopping-list.pdf → General inbox (non-MBA pattern)
```

### API Endpoints

#### Cloud Sync API (NEW)
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/ingestion/remarkable/cloud/status` | GET | Cloud connection status, document count |
| `/api/ingestion/remarkable/cloud/sync` | POST | Sync with Remarkable Cloud servers |
| `/api/ingestion/remarkable/cloud/documents` | GET | List all documents with type, parent, pageCount |
| `/api/ingestion/remarkable/cloud/render/:id` | POST | Render document to PDF with OCR |
| `/api/ingestion/remarkable/mba/status` | GET | MBA folder sync status |
| `/api/ingestion/remarkable/mba/tree` | GET | MBA folder tree structure |
| `/api/ingestion/remarkable/mba/sync` | POST | Sync MBA folder to Vault (direct) |
| `/api/ingestion/remarkable/mba/jobs/sync` | POST | Queue MBA sync as background job |

#### Legacy File Watcher API
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/ingestion/remarkable/status` | GET | Integration status and configuration |
| `/api/ingestion/remarkable/documents` | GET | List documents in sync folder |
| `/api/ingestion/remarkable/sync` | POST | Sync all documents |
| `/api/ingestion/remarkable/watch/start` | POST | Start file watcher |
| `/api/ingestion/remarkable/watch/stop` | POST | Stop file watcher |
| `/api/ingestion/remarkable/stats` | GET | Comprehensive sync statistics |
| `/api/ingestion/remarkable/classes` | GET | Class summaries with note counts |
| `/api/ingestion/remarkable/notes/:classCode` | GET | Notes for a specific class |
| `/api/ingestion/remarkable/inbox` | GET | General inbox notes |
| `/api/ingestion/remarkable/review` | GET | Notes needing OCR review |
| `/api/ingestion/remarkable/merge/:classCode/:noteDate` | POST | Generate combined markdown |
| `/api/ingestion/remarkable/merge-all` | POST | Merge all pending class notes |
| `/api/ingestion/remarkable/notes/:noteId/ocr` | PATCH | Update OCR text (manual correction) |
| `/api/ingestion/remarkable/notes/:noteId/reclassify` | PATCH | Re-classify a note |
| `/api/ingestion/remarkable/notes/:noteId/reviewed` | POST | Mark note as reviewed |
| `/api/ingestion/remarkable/notes/:noteId` | DELETE | Delete a note |
| `/api/ingestion/remarkable/jobs/sync` | POST | Queue background sync job |
| `/api/ingestion/remarkable/jobs/merge` | POST | Queue background merge job |

### Vault Structure
```
vault/
  academic/
    mba/
      spring-2026/
        mgmt501/
          days/
            2026-01-08/
              remarkable-notes.pdf     # Original handwritten notes
              remarkable-ocr.txt       # Extracted OCR text
              plaud-transcript.txt     # Audio transcript (if exists)
              typed-notes.md           # Manual typed notes (if exists)
              _combined.md             # Auto-merged view of all sources
  remarkable/
    inbox/
      shopping-list-2026-01-08-143022.pdf
```

### Database Tables
- `remarkable_notes` - Tracking handwritten notes with OCR, classification, and vault links
- `remarkable_sync_state` - Sync history and statistics

### Configuration
```bash
# Required
REMARKABLE_SYNC_PATH=/path/to/remarkable/exports  # Local folder for synced files

# Optional
REMARKABLE_DEVICE_TOKEN=xxx          # Remarkable Cloud API (future)
GOOGLE_APPLICATION_CREDENTIALS=xxx   # For OCR (handwriting recognition)
OCR_CONFIDENCE_THRESHOLD=50          # Min confidence for OCR (default: 50)
VAULT_BASE_PATH=./vault              # Base path for vault storage
```

### Key Files
- `/hub/src/services/remarkable-cloud-sync.ts` - Cloud API, PDF rendering, OCR extraction
- `/hub/src/services/remarkable-mba-sync.ts` - MBA folder to Vault sync logic
- `/hub/src/integrations/remarkable.ts` - File watcher, OCR, naming parser
- `/hub/src/services/remarkable-service.ts` - Business logic, content merging
- `/hub/src/jobs/processors/remarkable.ts` - Background job processors
- `/hub/src/api/routes/ingestion.ts` - API endpoints (remarkable section)
- `/hub/src/db/schema.ts` - `remarkable_notes`, `remarkable_sync_state` tables
- `/apps/command-center/src/pages/Remarkable.tsx` - Sync UI page
- `/apps/command-center/src/hooks/useRemarkable.ts` - React Query hooks for Remarkable API

### Setup Guide

#### Cloud Sync (Recommended)
1. **Get device token**: Go to `my.remarkable.com` → Connect → Mobile App → Copy one-time code
2. **Register device**: Use the code to get a device token via Remarkable API
3. **Configure**: Set `REMARKABLE_DEVICE_TOKEN` in `.env`
4. **Install rmc**: `pipx install rmc` (for .rm to PDF conversion)
5. **Sync**: Use `/remarkable` page in Command Center or `POST /api/ingestion/remarkable/mba/jobs/sync`

#### Legacy File Watcher
1. **Install rmapi** (recommended): `go install github.com/juruen/rmapi@latest`
2. **Configure sync folder**: Set `REMARKABLE_SYNC_PATH` in `.env`
3. **Optional OCR**: Set `GOOGLE_APPLICATION_CREDENTIALS` for handwriting OCR
4. **Start watching**: `POST /api/ingestion/remarkable/watch/start`
5. **Or manual sync**: `POST /api/ingestion/remarkable/sync`

### PRD Reference
See the Remarkable Integration PRD for detailed implementation plan.

---

## Jupyter Notebook Integration (Data Analysis)

Jupyter notebook integration for data analysis with Claude AI capabilities.

### Features

**Launch & Access:**
- Quick launch from Command Center sidebar (Jupyter Lab in new tab)
- Configurable via environment variables (`JUPYTER_URL`, `JUPYTER_PORT`, `JUPYTER_TOKEN`)
- Server status checking via Hub API

**Vault Integration:**
- Auto-sync notebooks from `/hub/storage/notebooks/` to vault
- Parse .ipynb files to extract code and markdown content
- Full-text and semantic search across notebook content
- File watcher for automatic sync on changes

**Python Utilities (`jdagent` package):**
- `hub` - Access tasks, projects, calendar, people, goals
- `claude` - Pre-configured Claude AI for data analysis
- `vault` - Search and create vault entries

**Usage Example:**
```python
from jdagent import hub, claude, vault

# Get today's tasks
tasks = hub.tasks.today()

# Analyze data with Claude
insights = claude.analyze(my_dataframe, "What trends do you see?")

# Save analysis to vault
vault.save_analysis("Q1 Analysis", insights, tags=["analysis", "q1"])
```

**Analytics Environment:**
Full data science stack with requirements.txt including:
- Core: pandas, numpy, scipy
- Visualization: matplotlib, seaborn, plotly
- ML: scikit-learn, xgboost, lightgbm
- Deep Learning: torch, transformers
- AI Integration: anthropic, openai
- Jupyter: jupyterlab, ipywidgets, jupyter-ai

**MCP Server for Claude Code:**
Enables Claude Code CLI to interact with Jupyter notebooks:
- `notebook_list` - List all notebooks
- `notebook_read` - Read notebook content
- `notebook_read_cell` - Read specific cell
- `cell_create` - Add new cells
- `cell_update` - Modify cells
- `cell_execute` - Execute code in running kernel
- `kernel_list` / `kernel_restart` - Kernel management

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/jupyter/status` | GET | Check Jupyter server status |
| `/api/jupyter/launch` | GET | Get launch URL for Jupyter Lab |
| `/api/jupyter/notebooks` | GET | List tracked notebooks |
| `/api/jupyter/notebooks/:id` | GET | Get specific notebook |
| `/api/jupyter/search` | GET | Search notebooks by content |
| `/api/jupyter/stats` | GET | Get notebook statistics |
| `/api/jupyter/sync` | POST | Trigger notebook sync |
| `/api/jupyter/watcher/start` | POST | Start file watcher |
| `/api/jupyter/watcher/stop` | POST | Stop file watcher |
| `/api/jupyter/kernels` | GET | List running kernels |
| `/api/jupyter/sessions` | GET | List active sessions |

### Configuration

```bash
# Environment Variables
JUPYTER_URL=http://localhost:8888       # Jupyter server URL
JUPYTER_PORT=8888                       # Jupyter server port
JUPYTER_TOKEN=your-token                # Authentication token
JUPYTER_NOTEBOOK_DIR=./storage/notebooks # Notebook directory

# Command Center
VITE_JUPYTER_URL=http://localhost:8888  # Frontend launch URL
```

### Setup

1. Install Python requirements: `cd hub/notebooks && pip install -r requirements.txt`
2. Start Jupyter Lab: `jupyter lab --notebook-dir=./storage/notebooks`
3. Set `JUPYTER_TOKEN` in `.env` (from Jupyter startup output)
4. Click "Jupyter" in Command Center sidebar

### MCP Server Setup

Add to `~/.config/claude/mcp_servers.json`:
```json
{
  "mcpServers": {
    "jupyter": {
      "command": "bun",
      "args": ["run", "hub/src/mcp/jupyter-server.ts"],
      "env": {
        "JUPYTER_URL": "http://localhost:8888",
        "JUPYTER_NOTEBOOK_DIR": "./storage/notebooks"
      }
    }
  }
}
```

### Key Files

- `/hub/src/services/notebook-service.ts` - Notebook parsing and vault sync
- `/hub/src/services/notebook-watcher-service.ts` - File system watcher
- `/hub/src/integrations/jupyter.ts` - Jupyter server integration
- `/hub/src/api/routes/jupyter.ts` - API endpoints
- `/hub/src/mcp/jupyter-server.ts` - MCP server for Claude Code
- `/hub/notebooks/jdagent/` - Python utilities package
- `/hub/notebooks/requirements.txt` - Python dependencies

---

## Acquisition System (Boomer Business Finder)

Lead generation and CRM system for finding acquirable small businesses ("boomer businesses") - Utah companies 20-30 years old likely owned by retiring owners.

### Features

**Lead Management:**
- Utah Business Registry scraping and import
- Business data enrichment (Google Places, Yelp)
- AI-powered acquisition scoring (Claude-based, 7 factors)
- Pipeline stages: New → Researching → Qualified → Outreach → Conversation → Negotiating → Closed
- Favorite/Hot lead flagging
- Follow-up scheduling with task integration

**Pipeline Board:**
- Kanban-style board view with 6 active stages
- Click-to-move stage changes with quick prev/next buttons
- Dropdown menu for moving to any stage
- Lead counts per stage with colored headers

**AI Scoring (0-100 scale):**
| Factor | Max Points | Description |
|--------|------------|-------------|
| Age Fit | 15 | Business age indicating owner retirement timing |
| Entity Type | 10 | Ease of transfer (LLC preferred) |
| Owner Age Signals | 15 | Digital presence indicators of owner age |
| Online Presence | 15 | Modernization/automation opportunity |
| Reputation | 15 | Reviews and customer satisfaction |
| Industry Fit | 15 | Service businesses preferred |
| Automation Potential | 15 | Opportunity for AI/automation improvements |

**Data Enrichment:**
- Google Places API: Business details, ratings, reviews
- Yelp Fusion API: Ratings, review counts, categories
- Batch enrichment via background jobs

**Task Integration:**
- Auto-create tasks when scheduling follow-ups
- Tasks linked to leads via `sourceRef`
- Daily 8 AM follow-up reminder notifications

### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/acquisition/leads` | GET | List leads with filters |
| `/api/acquisition/leads/:id` | GET | Get single lead with interactions |
| `/api/acquisition/leads` | POST | Create new lead |
| `/api/acquisition/leads/:id` | PATCH | Update lead |
| `/api/acquisition/leads/:id` | DELETE | Delete lead |
| `/api/acquisition/leads/import` | POST | Import from scraper |
| `/api/acquisition/leads/:id/stage` | POST | Change pipeline stage |
| `/api/acquisition/leads/:id/favorite` | POST | Toggle favorite |
| `/api/acquisition/leads/:id/hot` | POST | Toggle hot status |
| `/api/acquisition/leads/:id/pass` | POST | Pass on lead |
| `/api/acquisition/leads/:id/follow-up` | POST | Set follow-up date (creates task) |
| `/api/acquisition/leads/:id/enrich` | POST | Enrich single lead |
| `/api/acquisition/leads/:id/score` | POST | Score single lead |
| `/api/acquisition/enrich-batch` | POST | Batch enrich leads |
| `/api/acquisition/score-batch` | POST | Batch score leads |
| `/api/acquisition/stats` | GET | Pipeline statistics |
| `/api/acquisition/follow-ups` | GET | Leads needing follow-up |
| `/api/acquisition/hot` | GET | Hot leads |
| `/api/acquisition/top` | GET | Top scored leads |
| `/api/acquisition/interactions/:leadId` | GET | Lead interactions |
| `/api/acquisition/interactions/:leadId` | POST | Log interaction |

### Database Tables

- `acquisition_leads` - Core lead data with scoring, pipeline stage, enrichment data
- `acquisition_interactions` - Outreach log (calls, emails, meetings)
- `acquisition_enrichment_log` - Track enrichment attempts per source

### Key Files

**Backend:**
- `/hub/src/services/acquisition-service.ts` - Core CRUD & pipeline operations
- `/hub/src/services/acquisition-enrichment-service.ts` - Google/Yelp enrichment
- `/hub/src/services/acquisition-scoring-service.ts` - Claude AI scoring
- `/hub/src/api/routes/acquisition.ts` - REST API endpoints
- `/hub/src/jobs/processors/acquisition.ts` - Background job processors
- `/hub/src/integrations/google-places.ts` - Google Places API client
- `/hub/src/integrations/yelp.ts` - Yelp Fusion API client
- `/hub/src/db/schema.ts` - Database tables

**Frontend:**
- `/apps/command-center/src/pages/Acquisition.tsx` - Main page with list/pipeline views
- `/apps/command-center/src/components/acquisition/LeadList.tsx` - Lead table
- `/apps/command-center/src/components/acquisition/LeadDetail.tsx` - Detail panel
- `/apps/command-center/src/components/acquisition/PipelineBoard.tsx` - Kanban board
- `/apps/command-center/src/components/acquisition/ScoreBreakdown.tsx` - Score visualization
- `/apps/command-center/src/components/dashboard/AcquisitionWidget.tsx` - Dashboard widget
- `/apps/command-center/src/api/acquisition.ts` - API client
- `/apps/command-center/src/hooks/useAcquisition.ts` - React Query hooks
- `/apps/command-center/src/types/acquisition.ts` - TypeScript types

### Configuration

```bash
# Required for enrichment
GOOGLE_PLACES_API_KEY=xxx    # Google Places API
YELP_API_KEY=xxx             # Yelp Fusion API

# Required for scoring
ANTHROPIC_API_KEY=xxx        # Claude AI (already configured)
```

---

## Frontend Applications

### Command Center (`/apps/command-center`)
**Pages:**
- Dashboard: Today's view with enhanced metric cards
- Goals: Goal management with life area breakdown
- Habits: Habit tracking with streak visualization
- Budget: Real-time budget monitoring with Plaid sync and alerts
- Journal: 7-step daily review workflow (integrated from standalone app)
- Vault Explorer: Knowledge base browsing and search
- Acquisition: Business lead CRM with pipeline board and AI scoring
- Recordings: Audio recording management with transcription
- Remarkable: Handwritten notes sync from Remarkable tablet
- System Health: Backend health, integrity checks, services status
- Personal Health: Whoop fitness metrics, recovery scores, sleep data
- Settings: Configuration and preferences
- Chat: Full-screen master agent chat
- Brain Dump: Quick capture interface
- Setup Wizard: Initial configuration
- Native macOS app: Tauri desktop build and dev launcher
- Installable PWA: Add to Dock on macOS, Add to Home Screen on iOS

**Enhanced Dashboard (Phase 1 - Command Center v2.0):**
6 Interactive metric cards with click-through navigation:

| Card | Metrics | Click Target |
|------|---------|--------------|
| Tasks Today | Count, priority breakdown (H/M/L), completion rate | Tasks App (:5173) |
| Events Today | Count, next event countdown, type breakdown | Calendar |
| Goals & Progress | Active count, overall %, life area breakdown | /goals |
| Habits Today | Completion ratio, longest streak, 7-day calendar | /habits |
| Vault Entries | Total count, recent additions, type breakdown | Vault App (:5175) |
| Recovery | Score, status badge, recommendation | /personal-health |

**Enhanced Main Sections (Phase 2 - Command Center v2.0):**

| Widget | Features | New Capabilities |
|--------|----------|------------------|
| **TodayTasks** | Priority-grouped sections | Collapsible groups (Overdue, High, Medium, Low, No Priority), project tags, source badges, time estimates, quick completion toggle |
| **DeadlineWidget** | Urgency-grouped sections | Collapsible groups (Overdue, Today, This Week, Next Week, Later), source badges, priority indicators, days-until countdown |
| **WeekCalendar** | Density heatmap | Background color by event count, workload indicators (light/moderate/heavy), expandable day view, time allocation breakdown |

**Phase 2 Shared Components:**
- `CollapsibleSection`: Expandable sections with header, count badge, and custom icon
- `PriorityBadge`: Color-coded priority labels (Urgent, High, Medium, Low)
- `SourceBadge`: Task source icons with tooltips (Canvas, Email, Meeting, etc.)
- `WorkloadIndicator`: Light/moderate/heavy status dots with optional labels

**Phase 2 API Endpoints:**
- `GET /api/dashboard/tasks/grouped` - Tasks grouped by priority with project info
- `GET /api/dashboard/deadlines/grouped` - Deadlines grouped by urgency
- `GET /api/dashboard/week-overview` - 7-day calendar with density and workload data

**New Dashboard Sections (Phase 3 - Command Center v2.0):**

| Widget | Purpose | Key Features |
|--------|---------|--------------|
| **CanvasHub** | Canvas LMS integration | Today's classes, upcoming assignments, missing submissions alert, next class countdown |
| **FitnessWidget** | Whoop integration | Workout streak, today's recovery score, average sleep, last workout info |
| **SystemMonitor** | Integration health | Status grid (green/yellow/red), last sync times, overall system health |
| **AIInsights** | AI-generated insights | Pattern alerts, workload warnings, actionable suggestions, dismissible cards |

**Phase 3 API Endpoints:**
- `GET /api/dashboard/canvas` - Canvas Hub data (classes, assignments)
- `GET /api/dashboard/fitness` - Fitness data (Whoop)
- `GET /api/dashboard/system` - System health monitor
- `GET /api/dashboard/insights` - AI insights list
- `POST /api/dashboard/insights/:id/dismiss` - Dismiss insight
- `POST /api/dashboard/insights/generate` - Generate new insights

**Phase 3 Database Tables:**
- `ai_insights` - AI-generated insights with type, category, severity, and action targets
- `system_health_logs` - Integration health tracking with status, latency, and error logging

**Key Components:**
- StatsCards: Container for 6 enhanced metric cards (responsive grid)
- MetricCardBase: Clickable card base with hover effects
- TasksMetricCard, EventsMetricCard, GoalsMetricCard, HabitsMetricCard, VaultMetricCard, WellnessMetricCard
- ProgressBar: Completion percentage visualization
- MiniCalendar: 7-day habit completion dots
- TodayTasks: Priority-grouped task list with collapsible sections
- DeadlineWidget: Urgency-grouped deadlines with countdown
- WeekCalendar: Density heatmap with time allocation breakdown
- CanvasHub: Canvas LMS integration with classes and assignments
- FitnessWidget: Whoop integration with recovery and workout tracking
- SystemMonitor: Integration health status grid
- AIInsights: AI-generated insights with dismiss functionality
- GoalsPanel: Active goals with progress bars
- ChatInterface with history
- IntegrityLog, ActivityLog, MetricCharts

### Tasks App (`/apps/tasks`)
**Views:**
- InboxView: Unprocessed tasks (no project, no due date, no scheduled date)
- TodayView: Today's next actions
- UpcomingView: Scheduled tasks
- ProjectView: Project-specific tasks with nested sub-projects display
- FiltersView: Custom filtered views

**Features:**
- Drag-and-drop task organization (dnd-kit)
- Quick add task modal with natural language parsing
- Natural language recurring task support (e.g., "every monday" sets recurrence AND first due date)
- Global search (Cmd+K or /)
- Task detail panel: Click any task to view/edit details (due date, scheduled, description, comments)
- Task cards with inline editing and subtask indicators
- Sidebar navigation with hierarchical project tree
- Parent project navigation: Click project name to view, click chevron to expand/collapse children
- Keyboard shortcuts: Q/N (quick add), G+I/T/U (navigation), Escape (close panels)
- Native macOS app: Tauri desktop build and dev launcher
- Installable PWA: Add to Dock on macOS, Add to Home Screen on iOS

### Vault App (`/apps/vault`)
**Views (Notion Mode - NEW):**
- BlockPageView: Block-based page editing with TipTap
- Welcome view: Empty state with create page CTA
- GoalsView: Goals dashboard with life area grouping and progress tracking

**Views (Legacy Mode):**
- SearchView: Global search with quick actions
- JournalView: Daily journal writing
- ArchiveView: Completed tasks archive
- PageView: Individual entry editing
- Folder views: Project, Area, Resources, People, Recordings

**Components (NEW):**
- NotionSidebar: Collapsible 224px sidebar with page tree
- PageHeader: Title editing, icon picker, breadcrumbs, favorite toggle
- BlockEditor: TipTap-based block editor
- SlashMenu: Slash command menu for block insertion
- CommandPalette: ⌘K quick search and navigation
- ThemeToggle: Light/dark/system theme switcher
- PageLinkMenu: Entity linking with task filters

**Features:**
- Block-based editing (Notion-style)
- Slash command menu (/) for quick block insertion
- Command palette (⌘K) for search
- Hierarchical page organization
- Mode switching (Pages vs Legacy)
- Dark mode with system preference detection
- Entity linking via `[[` trigger with task/goal/page tabs
- Keyboard shortcuts: ⌘K (search), ⌘N (new), ⌘\ (sidebar), ⌘S (save)
- iOS PWA UX: recents + quick actions, pull-to-refresh, swipe actions, save status, keyboard-safe layout
- Floating New Note button on mobile for one-tap capture
- PWA update prompt to refresh when new build is available
- Mobile build timestamp for troubleshooting
- Ask AI quick action on mobile home
- Native macOS app: Tauri desktop build and dev launcher
- Installable PWA: Add to Dock on macOS, Add to Home Screen on iOS
- Full-text and semantic search (legacy)
- Rich markdown editing (legacy)
- Entry linking and related entries (legacy)
- File attachments (legacy)

### Controlled Tag Taxonomy

**Categories (5 default):**
- `status` - Status indicators (active, archived, favorite, processed)
- `type` - Content classification (project, reference, meeting, person)
- `context` - GTD contexts (@computer, @home, @errands, @calls, @email)
- `priority` - Priority levels (urgent, high, low)
- `area` - Life areas (work, personal, family, health, finance, school)

**Tag Features:**
- Category grouping with icons and colors
- Alias support (e.g., "work" has aliases "professional", "career")
- Usage count tracking for popularity sorting
- System tags protected from deletion/modification
- Suggestions with match scoring (exact, prefix, alias, fuzzy)
- Tag validation with optional auto-creation

**API Endpoints:**
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/labels/initialize` | POST | Initialize default categories and tags |
| `/api/labels/suggest` | GET | Get tag suggestions with ?q=query&limit=10 |
| `/api/labels/validate` | POST | Validate tags exist, optionally create missing |
| `/api/labels/grouped` | GET | Get tags grouped by category |
| `/api/labels/categories` | GET, POST | List/create categories |
| `/api/labels/categories/:id` | GET, DELETE | Get/delete category |
| `/api/labels/category/:id` | GET | Get tags by category |

### PARA Folder Structure

**Root Folders (4 system folders):**
- `Projects` (📁) - Active projects with deadlines and goals
- `Areas` (🏠) - Ongoing areas of responsibility
- `Resources` (📚) - Reference materials and information
- `Archive` (📦) - Inactive items for future reference

**Features:**
- System folders protected from deletion
- Automatic initialization via API
- Pages can be moved to any PARA folder
- Tree view includes PARA type in nodes
- paraType and isSystem fields on vault_pages

**API Endpoints:**
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/vault/pages/para/initialize` | POST | Create PARA root folders |
| `/api/vault/pages/para/folders` | GET | Get PARA root folders with config |
| `/api/vault/pages/para/:type` | GET | List pages under a PARA type |
| `/api/vault/pages/:id/move-to-para` | POST | Move page to a PARA folder |

### Vault Migration (vault_entries → vault_pages)

**Purpose:** Migrate legacy vault_entries (markdown-based) to new vault_pages (block-based).

**Features:**
- Automatic markdown to blocks conversion (headings, lists, quotes, dividers, text)
- PARA type mapping based on context and content type
- Preserves creation/update timestamps
- Links legacy entry via legacyEntryId field
- Supports dry run for testing
- Rollback capability for single entries or all

**API Endpoints:**
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/vault/migration/status` | GET | Get migration progress (total, migrated, pending, percentage) |
| `/api/vault/migration/run` | POST | Run migration with options (limit, dryRun, skipExisting) |
| `/api/vault/migration/rollback` | POST | Rollback single entry (legacyEntryId) or all (all: true) |

---

## Database Schema (Key Tables)

| Table | Purpose |
|-------|---------|
| `projects` | GTD projects with hierarchy |
| `tasks` | Individual action items |
| `sections` | Todoist-style project sections |
| `contexts` | @context tags |
| `labels` | Controlled tag taxonomy with categories |
| `tag_categories` | Tag category groups (status, type, context, priority, area) |
| `filters` | Saved search queries |
| `vault_entries` | Knowledge base entries (legacy) |
| `vault_embeddings` | Semantic search vectors |
| `vault_attachments` | File attachments |
| `vault_pages` | Block-based pages (NEW) |
| `vault_blocks` | Page content blocks (NEW) |
| `vault_references` | Cross-system links (NEW) |
| `vault_entry_versions` | Entry version history (NEW) |
| `recordings` | Audio recordings |
| `transcripts` | Transcribed audio |
| `recording_summaries` | Processed summaries |
| `calendar_events` | Calendar events |
| `people` | Contact database |
| `interactions` | People interaction log |
| `classes` | School classes |
| `ceremonies` | Ceremony execution log |
| `system_logs` | Activity/error logging |
| `sync_state` | Source sync tracking |

---

## Tech Stack

**Backend:**
- Runtime: Bun v1.0+
- Language: TypeScript 5.7+
- Framework: Hono 4.6+
- Database: PostgreSQL 15+ with Drizzle ORM
- Queue: BullMQ + Redis
- AI: Groq (free), Google Gemini (free), OpenAI GPT-4 (fallback)

**Frontend:**
- Framework: React 19.2+
- Router: React Router v7+
- State: TanStack React Query 5.90+
- Styling: Tailwind CSS 4.1+
- Build: Vite 7.2+
- Drag & Drop: @dnd-kit

---

## Development Commands

```bash
# From root
bun run dev              # Start hub dev server
bun run hub              # Start hub with hot reload
bun run tasks            # Start tasks app
bun run vault            # Start vault app
bun run command-center   # Start command-center app (includes Journal)
bun run test             # Run test suite
bun run test:ai          # Run AI testing agent (smoke)
bun run test:ai:full     # Run AI testing agent (full)

# From /hub
bun run db:generate      # Generate Drizzle migrations
bun run db:migrate       # Run migrations
bun run db:push          # Push schema to database
bun run db:studio        # Open Drizzle Studio
bun run worker           # Start background job worker
bun run scheduler        # Start cron scheduler
```

---

## Documentation System

**Location:** `/docs/` (source of truth) → `/apps/docs-frontend/` (Next.js app)

**Production URL:** https://docs-frontend-sigma.vercel.app

**Structure:**
```
/docs/                         # Source of truth for all documentation
├── public/                    # User-facing documentation
│   ├── index.md               # Documentation home
│   ├── getting-started/       # Installation, quick start, concepts
│   ├── features/              # Feature documentation
│   │   ├── tasks/
│   │   ├── vault/
│   │   ├── agent/
│   │   ├── calendar/
│   │   ├── ceremonies/
│   │   └── integrations/
│   └── reference/             # Shortcuts, syntax, glossary
├── roadmap/
│   ├── index.md               # Public roadmap (Now/Next/Later/Future)
│   ├── backlog.md             # Known issues & feature requests
│   └── changelog.md           # Keep a Changelog format
└── internal/                  # Developer docs

/apps/docs-frontend/           # Next.js documentation site
├── docs/                      # Synced copy of /docs/ (for Vercel)
├── app/                       # Next.js app router pages
├── components/                # React components
└── lib/docs.ts                # Markdown parsing utilities
```

**Docs Sync System:**

The root `/docs/` folder is the single source of truth. It's synced to `/apps/docs-frontend/docs/` for Vercel deployments.

| Command | Description |
|---------|-------------|
| `bun run docs` | Run docs site locally (port 5177) |
| `bun run docs:sync` | Manually sync docs to docs-frontend |
| `bun run docs:check` | Check if docs are in sync |

**Auto-sync:** A git pre-commit hook automatically syncs when files in `/docs/` are staged. Both the source and synced files are committed together.

**Documentation Rules:** After implementing ANY feature:
1. Update feature docs in `/docs/public/features/`
2. Update roadmap in `/docs/roadmap/index.md`
3. Add changelog entry in `/docs/roadmap/changelog.md`
4. Update backlog in `/docs/roadmap/backlog.md`

See `CLAUDE.md` for full documentation requirements.

---

## Related Documentation

- [CLAUDE.md](/CLAUDE.md) - Development contract and rules
- [Feature Docs](/docs/public/features/) - User-facing documentation
- [Roadmap](/docs/roadmap/index.md) - What's planned
- [Backlog](/docs/roadmap/backlog.md) - Known issues and requests

---

## Changelog

### January 26, 2026 - Canvas Complete Phase 5: Grade Tracking
- **NEW**: Grade tracking and notifications
  - Grade summary across all courses with overall average
  - Course-by-course grade averages
  - Recent grades display
  - New grade alerts
- **NEW**: GradesWidget dashboard component
  - Compact mode for dashboard grid
  - Full mode with detailed breakdowns
  - Color-coded grades by percentage
  - Letter grade display
- **NEW**: Grade API endpoints
  - GET /grades/summary - overall grade summary
  - GET /grades/check - check for new grades
  - GET /grades/pending - assignments awaiting grades
  - GET /grades/course/:courseId - course-specific grades
- **NEW**: Database schema updates for grades
  - Added: grade, score, gradedAt, isLate, isMissing fields
  - Added: canvasCourseId, canvasAssignmentId for API calls
- Files: `canvas-grades-service.ts`, `useGrades.ts`, `GradesWidget.tsx`

### January 26, 2026 - Canvas Complete Phase 5: Direct Submission
- **NEW**: Submit assignments directly from JD Agent
  - Text entry submission for online_text_entry assignments
  - URL submission for online_url assignments
  - File upload preparation (UI ready, backend implemented)
- **NEW**: Submission status tracking
  - Current submission state (submitted, graded, pending_review, unsubmitted)
  - Late and missing flags
  - Grade and score display when graded
  - Submission attempt count
- **NEW**: Submission history view
  - All submission attempts visible
  - Instructor comments displayed
  - Submitted files listed with sizes
- **NEW**: SubmissionPanel component
  - Integrated into AssignmentDetailModal as "Submit" tab
  - Tabbed interface for status and submit forms
  - Real-time submission feedback
- **NEW**: Submission API endpoints
  - GET /submission - current status
  - GET /submission/can-submit - eligibility check
  - GET /submission/history - all attempts
  - POST /submit/text - text submission
  - POST /submit/url - URL submission
  - POST /submit/file - file submission
- Auto-completes linked task on successful submission
- Files: `canvas-submission-service.ts`, `SubmissionPanel.tsx`, updated `useCanvasComplete.ts`

### January 26, 2026 - Canvas Complete Phase 4: Homework Hub Dashboard
- **NEW**: Homework Hub dashboard widget for centralized homework view
  - Due Today section with critical urgency indicators
  - Due This Week section with assignments grouped
  - Readings Due section with progress tracking
  - Upcoming assignments (next 2 weeks preview)
- **NEW**: Homework summary statistics
  - Count of items due today, this week, upcoming
  - Total estimated work time for today and week
  - Critical/urgent assignment alerts with pulse animation
- **NEW**: Progress tracking for assignments
  - Subtask completion percentage with progress bars
  - Status indicators (not_started, in_progress, ready_to_submit, completed)
  - Color-coded progress (red → orange → yellow → green)
- **NEW**: Urgency level calculations
  - Critical (red): <24 hours or past due
  - High (orange): 24-48 hours
  - Medium (yellow): 48-72 hours
  - Low (green): >72 hours
- **NEW**: Homework Hub API endpoints
  - GET /api/canvas-integrity/homework-hub (full data)
  - GET /api/canvas-integrity/homework-hub/summary
  - GET /api/canvas-integrity/homework-hub/due-today
  - GET /api/canvas-integrity/homework-hub/due-this-week
  - GET /api/canvas-integrity/homework-hub/critical
- Files: `homework-hub-service.ts`, `useHomeworkHub.ts`, `HomeworkHubWidget.tsx`

### January 26, 2026 - Canvas Complete Phase 3: Connected Workflow
- **NEW**: Auto-generated Vault pages for assignments
  - Rich structured pages with all assignment context
  - Header callout with course, due date, points, time estimate
  - Full instructions and rubric with expandable criteria
  - Materials section linked to downloaded course files
  - Notes section for working on assignments
  - Default checklist items for tracking progress
- **NEW**: Task-to-Vault linking
  - Canvas tasks link directly to Vault assignment pages
  - Lazy page creation on first access
  - References tracked in vault_references table
- **NEW**: Quick Actions for Canvas tasks
  - CanvasQuickActions component with compact and full modes
  - Open Assignment Page (creates if needed)
  - View Materials shortcut
  - Add Note action
  - Open in Canvas fallback
  - InlineCanvasActions for task list items
- **NEW**: Assignment page API endpoints
  - GET/POST /api/canvas-integrity/assignments/:id/page
  - GET /api/canvas-integrity/assignments/:id/page-or-create
  - GET /api/canvas-integrity/by-task/:taskId/page
  - PATCH /api/canvas-integrity/assignment-pages/:id/notes
  - POST /api/canvas-integrity/courses/:courseId/create-all-pages
- Files: `canvas-assignment-page-service.ts`, `CanvasQuickActions.tsx`, updated `useCanvasComplete.ts`

### January 26, 2026 - Canvas Complete Phase 2: Course Materials
- **NEW**: Canvas materials download and management system
  - Automatic file download from Canvas (PDFs, PowerPoints, Word docs, Excel)
  - Storage organized by course: `hub/storage/canvas/{course}/`
  - Material type auto-detection (case, reading, lecture, syllabus, template, data)
- **NEW**: Reading progress tracking
  - Track reading status: unread, in_progress, completed
  - Progress percentage tracking for each material
  - Unread counts per course
- **NEW**: Vault integration for materials
  - Create Vault pages for downloaded materials
  - Materials become searchable in Vault
  - Course materials folders auto-created
- **NEW**: Course Materials UI component
  - Materials grouped by Canvas module
  - Expand/collapse module sections
  - Download, view inline, and track progress
  - Quick status badges (unread/in progress/completed)
- **NEW**: Canvas materials API (`/api/canvas-materials/*`)
  - List, filter, download materials
  - Sync materials from Canvas
  - Update reading progress
  - Create Vault pages for materials
- **DB**: New `canvas_materials` table
- Files: `canvas-materials-service.ts`, `canvas-materials.ts` (routes), `useCanvasMaterials.ts`, `CourseMaterials.tsx`

### January 24, 2026 - Command Center iOS App
- **NEW**: Native iOS Command Center app (`/apps/jd-command-center-ios`)
  - AI-powered daily briefings with personalized summaries
  - Integration status monitoring (Plaud, Remarkable, Canvas, Calendar)
  - Screen Time productivity tracking synced to Hub
  - Tab-based navigation: Briefing, Productivity, Settings
  - SwiftUI + iOS 16+ with XcodeGen project configuration
- **NEW**: Briefing API (`/api/briefing`)
  - On-demand personalized briefing generation
  - AI summary using LLM provider chain
  - Integration health aggregation
  - Preview endpoint for widgets
- **NEW**: Productivity API (`/api/productivity`)
  - Screen Time data sync from iOS DeviceActivity framework
  - Daily, weekly, monthly analytics with trends
  - AI-generated productivity insights
  - Category and app usage breakdowns
- **NEW**: Siri Shortcuts integration
  - "Give me my JD briefing" - generates spoken summary
  - "Check my integrations" - reports integration health
  - "How much screen time did I have" - productivity report
- **DB**: New `screen_time_reports` table for productivity data
- Files: `briefing-service.ts`, `productivity-service.ts`, `briefing.ts`, `productivity.ts`

### January 25, 2026 - Health Data Automation (WHOOP Auto-Auth + Garmin Integration)
- **NEW**: WHOOP auto-reauthorization using Playwright browser automation
  - Automatically re-authenticates when OAuth refresh tokens expire
  - Auto-triggers when Personal Health page loads and WHOOP is disconnected
  - No manual "Connect" clicking needed - seamless background re-auth
  - Uses the same pattern as Plaud web scraper
  - Configurable via `WHOOP_EMAIL` and `WHOOP_PASSWORD` environment variables
- **NEW**: Garmin Connect integration via python-garminconnect library
  - Steps, heart rate, sleep, stress, body battery, activities
  - Full health report endpoint with all metrics combined
  - TypeScript wrapper calls Python subprocess for authentication
  - Session tokens persist to ~/.garminconnect for seamless re-auth
  - Personal Health page shows Garmin recent activities with duration, calories, HR
  - FitnessWidget displays latest Garmin activity
- **NEW**: Combined health endpoint `/api/health/combined` aggregates WHOOP + Garmin data
- **NEW**: Garmin API routes at `/api/garmin/*` for all health metrics
- **ENH**: Health dashboard can now show data from multiple fitness sources
- Files: `whoop-auto-auth.ts`, `garmin.ts`, `garmin-client.py`, `garmin.ts` (routes), `health.ts`

### January 24, 2026 - Budget Monitoring & Alerts
- **NEW**: Budget page in Command Center with category budgets and remaining spend
- **NEW**: Plaid Link connection (Chase supported) + CSV import fallback
- **NEW**: Budget alerts via Email/SMS/Telegram with threshold controls
- **NEW**: Background finance sync + budget alert checks
- **ENH**: YNAB-style envelope budgeting with “To Be Budgeted” summary
- **ENH**: Category groups and move-money workflow
- **ENH**: Command Center macOS bundle includes proper app icons for discovery
- **ENH**: Category targets with funded progress and overspending carry toggle
- **ENH**: Month selector with per‑month budget allocations
- **ENH**: Budget dashboard summary with category overview

### January 24, 2026 - Command Center Desktop Discovery
- **ENH**: Command Center auto-launches installed app when available
- **ENH**: Install script for `/Applications` bundle (`scripts/install-command-center-app.sh`)

### January 24, 2026 - Vault Mobile Usability Fixes
- **FIX**: Mobile Vault editor now persists Notion-style page edits (block serialization + batch save)
- **FIX**: iOS layout polish (no duplicate header, correct safe area spacing, hide nav when keyboard open)
- **FIX**: Mobile page tree expand/collapse controls and add buttons now work reliably
- **ENH**: iOS home now includes recents, quick actions, and pull-to-refresh
- **ENH**: iOS swipe actions for favorite/archive/delete on page lists
- **ENH**: Floating New Note button on mobile
- **ENH**: PWA update prompt when new build is ready
- **ENH**: Mobile build stamp for troubleshooting
- **ENH**: Ask AI quick action on mobile home

### January 23, 2026 - Weekly Planning Feature
- **NEW**: Weekly Planning page (`/weekly-planning`) in Command Center
  - Left panel: Weekly backlog showing tasks with `#weekly-backlog` label
  - Right panel: 17-day calendar view (Friday + 2 weeks)
  - Drag-and-drop task scheduling - drag from backlog to calendar slot
  - Drag-and-drop reordering within backlog (sortOrder persisted)
  - @dnd-kit library integration for smooth drag interactions
  - Tasks auto-schedule with time estimate duration (default 60min)
  - Files: `WeeklyPlanning.tsx`, `WeeklyBacklogPanel.tsx`, `PlanningCalendar.tsx`, `useWeeklyPlanning.ts`
- **API**: New label filter for tasks endpoint
  - `GET /api/tasks?label=weekly-backlog` filters by taskLabels array
  - Files: `tasks.ts` (routes), `task-service.ts`
- **API**: New reorder endpoint for task sorting
  - `POST /api/tasks/reorder` - bulk update sortOrder based on array position
  - Files: `tasks.ts` (routes), `task-service.ts`

### January 23, 2026 - Native Desktop App Transformation & Testing
- **Tauri Desktop Apps**: Command Center, Tasks, and Vault transformed into native macOS applications
  - Built with Tauri 2.x framework (Rust + WebView)
  - Individual app icons (.icns) and window configurations
  - Each app runs as separate process with own dock icon
  - `tauri:dev` and `tauri:build` scripts per app
  - Desktop configs under `apps/*/src-tauri/`
- **LaunchAgent Auto-start**: Fixed startup script to launch desktop apps
  - Updated `scripts/start-frontends.sh` to run `tauri:dev` instead of web `dev`
  - Apps auto-launch on system startup via `dev.jdagent.frontends.plist`
  - Waits for Hub API health check before starting apps
- **Bug Fix - BUG-018**: Duplicate app instances resolved
  - Issue: Both web (Vite) and desktop (Tauri) versions running simultaneously
  - Cause: LaunchAgent script was starting web servers instead of Tauri apps
  - Fix: Updated startup script to launch correct desktop versions
  - Result: Single instance of each app now runs properly
- **Comprehensive Testing**: 271 automated tests + manual test suites created
  - Command Center: 271 Playwright tests (~85% pass rate)
  - Tasks: 50+ manual tests documented in `apps/tasks/test-manual.md`
  - Vault: 80+ manual tests documented in `apps/vault/test-manual.md`
  - Test report: `COMPREHENSIVE-TEST-REPORT.md`
- **PWA Support**: Basic iOS install capability remains available for web access

### January 22, 2026 - Command Center Health UI Fixes
- **BUG-015 Fixed**: System Health uptime and integrity log rendering
  - Handle string uptime values returned by `/api/system/info`
  - Normalize integrity history timestamps and messages for display
  - Files: `SystemHealth.tsx`, `IntegrityLog.tsx`, `health.ts`, `types/health.ts`
- **BUG-016 Fixed**: Testing agent provider order and fallback
  - Use cloud providers before falling back to local Ollama/llama
  - Allow running tests without OpenAI keys if other providers or Ollama are configured
  - Files: `vision-provider.ts`, `run-ai-tests.ts`
- **BUG-017 Fixed**: Testing agent auto-downloads missing local Ollama models
  - Pulls configured chat/vision models if they are not present locally
  - Files: `vision-provider.ts`

### January 17, 2026 - Canvas Web Scraping & Bug Fixes
- **BUG-012 Fixed**: Full Canvas web scraping implementation
  - Wiki pages extraction with content, HTML, and publishing status
  - Course files listing with download URLs and file metadata
  - Readings extraction from modules (external links, files, pages)
  - Module items with position tracking for navigation
  - New types: `CanvasPageContent`, `CanvasFile`, `CanvasReading`
  - Files: `content-extractor.ts`, `canvas-integrity-service.ts`
- **BUG-010 Fixed**: Vault/Canvas project hierarchy mismatch
  - Added `getProjectByCourseCode()` and `getCourseProjectMap()` to canvas-integrity-service
  - Updated `getOrCreateClassFolder()` to link vault folders to Canvas projects
  - Updated `createClassVaultEntry()` to include projectId
  - Added `scripts/link-vault-to-canvas-projects.ts` backfill script
  - Vault entries now properly linked to Canvas class projects
- **BUG-011 Fixed**: Duplicate Vault pages
  - Added `findOrCreate()` method to VaultPageService to prevent duplicates
  - Added `findByTitleAndParent()` for dedup queries
  - Added `findDuplicates()` and `mergeDuplicates()` methods
  - Updated plaud-api.ts, ingestion.ts, plaud-gdrive-sync.ts to use findOrCreate
  - Added API endpoints: GET `/api/vault/pages/duplicates`, POST `/api/vault/pages/merge-duplicates`
  - Added `scripts/dedupe-vault-pages.ts` cleanup script
- **BUG-009 Fixed**: Recording null titles in database
  - Added fallbacks in all recording creation points (plaud-api.ts, plaud-sync.ts, plaud.ts, vip-service.ts)
  - Generated titles from recording date when source title is null
  - Added `scripts/fix-recording-titles.ts` to fix existing null titles
- **BUG-008 Fixed**: Canvas tasks now include description, URL, and points
- **BUG-013 Fixed**: GET `/api/tasks/:id/canvas-item` endpoint for task → Canvas item lookup
- **BUG-014 Fixed**: Recordings auto-link to vault day pages with summary/transcript
  - Class detection from recording content
  - CLASS_CODE_MAPPING for MBA courses
  - File: `class-detection-service.ts`

### January 15, 2026 - Acquisition System (Boomer Business Finder)
- **Lead Management CRM**: Full pipeline for business acquisition leads
  - Utah Business Registry scraping and import
  - Pipeline stages: New → Researching → Qualified → Outreach → Conversation → Negotiating → Closed
  - Favorite/Hot lead flagging
  - Files: `acquisition-service.ts`, `acquisition.ts` (routes)
- **Data Enrichment**: Multi-source business data enrichment
  - Google Places API integration (ratings, reviews, details)
  - Yelp Fusion API integration (ratings, review counts)
  - Batch enrichment via background jobs
  - Files: `google-places.ts`, `yelp.ts`, `acquisition-enrichment-service.ts`
- **AI Scoring**: Claude-powered lead scoring (0-100)
  - 7 weighted factors: Age Fit, Entity Type, Owner Signals, Online Presence, Reputation, Industry Fit, Automation Potential
  - Batch scoring via background jobs
  - File: `acquisition-scoring-service.ts`
- **Pipeline Board UI**: Kanban-style pipeline view
  - 6-column board with click-to-move functionality
  - Quick prev/next stage buttons and dropdown menu
  - Stage-colored headers with lead counts
  - File: `PipelineBoard.tsx`
- **Task Integration**: Follow-up scheduling creates tasks
  - Tasks linked to leads via `source: 'acquisition'`
  - Daily 8 AM follow-up reminder notifications
  - Scheduler integration: `acquisition-follow-up-reminder` job
- **Dashboard Widget**: Pipeline summary on main dashboard
  - Pipeline progress bar with stage breakdown
  - Hot leads, follow-ups due, top prospects sections
  - File: `AcquisitionWidget.tsx`
- **Frontend**: Complete Acquisition page with list/pipeline views
  - LeadList, LeadDetail, ScoreBreakdown components
  - Slide-out detail panel in pipeline view
  - Full React Query integration

### January 14, 2026 - Jupyter Notebook Integration
- **Jupyter Lab Integration**: Launch Jupyter from Command Center sidebar
  - Quick launch button opens Jupyter Lab in new browser tab
  - Server status checking via API
  - Configurable via environment variables
- **Vault Sync**: Auto-sync notebooks to vault for search
  - Parse .ipynb files to extract code and markdown
  - Full-text and semantic search across notebook content
  - File watcher for automatic sync on changes
  - Files: `notebook-service.ts`, `notebook-watcher-service.ts`
- **Python Utilities (`jdagent` package)**:
  - `hub` client for tasks, projects, calendar, people, goals
  - `claude` helper for AI-powered data analysis
  - `vault` client for search and entry creation
  - Files: `hub/notebooks/jdagent/`
- **Analytics Environment**: Full data science stack
  - Core: pandas, numpy, scipy
  - ML: scikit-learn, xgboost, torch, transformers
  - Visualization: matplotlib, seaborn, plotly
  - AI: anthropic, openai, jupyterlab
- **MCP Server for Claude Code**: Bidirectional Claude integration
  - Read/create/update notebook cells
  - Execute code in running kernels
  - List notebooks and manage sessions
  - File: `hub/src/mcp/jupyter-server.ts`
- **API Endpoints**: `/api/jupyter/*` for status, notebooks, sync, kernels

### January 13, 2026 - Remarkable Cloud Sync & UI
- **Cloud API Integration**: Direct sync with Remarkable Cloud servers
  - Device token authentication with automatic refresh
  - Fetches all 168+ documents with folder hierarchy (type, parent, pageCount)
  - Files: `remarkable-cloud-sync.ts`
- **MBA Vault Sync**: Syncs BYU MBA folder structure to Vault pages
  - Creates page hierarchy: BYU MBA > Semester > Class > Date
  - Renders documents to PDF with multi-page support
  - Extracts OCR text via Apple Vision and creates child pages
  - Groups multiple documents from same day into single page
  - Files: `remarkable-mba-sync.ts`
- **Sync UI**: New `/remarkable` page in Command Center
  - Status cards: Cloud documents, synced count, pending, connection status
  - Interactive folder tree browser with expand/collapse
  - Document preview with embedded PDF viewer and OCR text display
  - Sync buttons for cloud refresh and MBA-to-Vault sync
  - Files: `Remarkable.tsx`, `useRemarkable.ts`
- **Multi-page PDF Rendering**: Enhanced `.rm` to PDF conversion
  - Reads page order from `.content` file's `cPages.pages` array
  - Converts each page via `rmc` tool to SVG, then to PDF
  - Combines all pages using `pdfunite` into single PDF
  - Apple Vision OCR with page separators in extracted text
- **Background Job Support**: MBA sync runs as BullMQ job (90+ second operations)
  - New job type: `remarkable-mba-sync`
  - Files: `worker.ts`, `processors/remarkable.ts`

### January 13, 2026 - Tasks App UI Improvements
- **Task Detail Panel**: Click any task to open slide-out panel with full details
  - Shows due date, scheduled date, priority, description, comments
  - Press Escape or click outside to close
  - Files: `TaskDetailPanel.tsx`, `App.tsx`, all view components
- **Nested Project Navigation**: Improved sidebar project hierarchy
  - Click project name to navigate to project view
  - Click chevron icon to expand/collapse child projects
  - Project view displays nested sub-projects as clickable cards
  - Files: `Sidebar.tsx`, `ProjectView.tsx`
- **Inbox Filtering**: GTD-compliant inbox behavior
  - Inbox now shows only truly unprocessed tasks
  - Tasks with projects, due dates, or scheduled dates are excluded
  - Files: `InboxView.tsx`, `App.tsx`
- **Recurring Task Parsing**: Fixed natural language recurring tasks
  - "every monday" now sets both recurrence rule AND first due date
  - Supports all days of week for recurring tasks
  - Files: `parseNaturalLanguage.ts`
- **Removed Add Section**: Removed non-functional Add Section button from ProjectView
- **Production Deployment**: All changes live at https://tasks-ten-ecru.vercel.app

### January 12, 2026 - Calendar Page Production Fix
- **API Fix**: Fixed calendar API returning 502 timeout with date parameters
  - Root cause: Zod schema transforms creating Date objects that crashed Drizzle ORM queries
  - Solution: Bypass Zod transforms, handle date params directly in route handler
  - Use `getInRange()` instead of `list()` with Zod-parsed filters
- **Production Verified**: Calendar page fully working at https://command-center-plum.vercel.app/calendar
  - Week view displays 50+ events correctly
  - Month/Week/Day views all functional
  - Event creation modal working
  - Navigation and keyboard shortcuts working
- **Files**: `calendar.ts` (routes)

### January 11, 2026 - Vault Migration (ENH-016)
- **Migration Service**: Converts vault_entries to vault_pages + vault_blocks
- **Markdown Conversion**: Parses markdown into structured blocks (headings, lists, quotes, dividers, text)
- **PARA Mapping**: Auto-assigns migrated pages to PARA folders based on context/contentType
- **Dry Run**: Test migration without making changes
- **Rollback**: Undo migration for single entries or all
- **API Endpoints**: /migration/status, /migration/run, /migration/rollback
- **Files**: `vault-migration-service.ts`, `vault.ts` (routes)

### January 11, 2026 - PARA Folder Structure (ENH-001)
- **Root Folders**: 4 system PARA folders (Projects, Areas, Resources, Archive)
- **System Protection**: PARA folders cannot be deleted
- **Move to PARA**: API endpoint to organize pages into PARA folders
- **Database**: Added paraType and isSystem fields to vault_pages
- **API Endpoints**: /para/initialize, /para/folders, /para/:type, /:id/move-to-para
- **Types**: Added PARAType to VaultPage and VaultPageTreeNode interfaces
- **Files**: `vault-page-service.ts`, `vault-pages.ts` (routes), `schema.ts`, `vault.ts` (types)

### January 11, 2026 - Controlled Tag Taxonomy (ENH-002)
- **Tag Categories**: 5 default categories (status, type, context, priority, area)
- **System Tags**: 22 default tags with aliases and GTD contexts
- **Tag Suggestions**: Autocomplete with match scoring (exact, prefix, alias, fuzzy)
- **Tag Validation**: Validate existence with optional auto-creation
- **Category Management**: Full CRUD for custom categories
- **Usage Tracking**: Automatic usage count for popularity sorting
- **API Endpoints**: /initialize, /suggest, /validate, /grouped, /categories, /category/:id
- **Database**: `tag_categories` table, extended `labels` with categoryId, aliases, isSystem, usageCount
- **Files**: `tag-service.ts`, `labels.ts` (routes), `schema.ts`

### January 11, 2026 - Task Subtasks Support & Docs Improvements
- **Documentation Site Fixes**: Tested and fixed bugs in docs-frontend
  - Added missing `/docs/reference` index page
  - Changed calendar demo from "coming-soon" to "available"
  - Made roadmap "last updated" date dynamic from markdown
  - Added configurable app URL via `NEXT_PUBLIC_APP_URL` environment variable
  - Production URL: https://docs-frontend-sigma.vercel.app
- **Docs Sync System**: Auto-sync between root docs and docs-frontend
  - Root `/docs/` is single source of truth
  - Git pre-commit hook syncs to `/apps/docs-frontend/docs/` automatically
  - Commands: `bun run docs:sync`, `bun run docs:check`, `bun run docs`
  - Files: `scripts/sync-docs.sh`, `.git/hooks/pre-commit`
- **Subtasks UI (ENH-020)**: Full subtask support for tasks
  - Backend: GET/POST /api/tasks/:id/subtasks endpoints
  - Service methods with depth validation (max 1 level)
  - Subtask counts included in all task queries (subtaskCount, completedSubtaskCount)
  - TaskCard shows subtask count indicator (e.g., "2/3 subtasks")
  - Expandable SubtaskList component with inline add/complete
  - QuickAddTask modal supports subtask creation mode
  - Subtasks inherit context and project from parent
  - Independent completion (completing subtasks doesn't auto-complete parent)
  - Files: `task-service.ts`, `tasks.ts`, `TaskCard.tsx`, `SubtaskList.tsx`, `QuickAddTask.tsx`

### January 10, 2026 - P1 Search & Chat Verification
- **Faceted Search API (ENH-003)**: New search filtering capabilities
  - `getFacets()` method returns counts for contentTypes, contexts, sources, tags
  - `facetedSearch()` combines search results with facet aggregations
  - `GET /api/vault/facets` endpoint for filter UI counts
  - `GET /api/vault/faceted-search` endpoint with pagination support
  - Filtered facets update counts based on applied filters
  - Files: `vault-service.ts`, `vault.ts` (routes)
- **Semantic Search Pipeline (ENH-018)**: Verified complete
  - Voyage AI embeddings with automatic generation on create/update
  - `GET /api/vault/search?semantic=true` for semantic queries
  - Backfill endpoint for existing entries
  - Falls back to full-text when embeddings unavailable
- **Vault Chat Interface (ENH-017)**: Verified complete
  - VaultChat.tsx slide-out panel for AI queries
  - Uses master agent with vault tools
  - Suggested prompts, source citations, clear history

### January 10, 2026 - Vault App P2 Enhancements
- **Dark Mode Support (P2-1)**: Complete dark mode implementation for vault app
  - ThemeContext with light/dark/system options
  - ThemeToggle component (icon and dropdown variants)
  - CSS custom properties for consistent theming
  - localStorage persistence and system preference detection
  - Dark mode styles for prose, scrollbars, form inputs, and all UI components
  - Files: `ThemeContext.tsx`, `ThemeToggle.tsx`, `index.css`, `Sidebar.tsx`
- **Goal Progress Tracking UI (P2-2)**: New GoalsView component in vault
  - Filter tabs: Active, Completed, All
  - Summary stats: Active goals, completed, avg progress, life areas
  - Goals grouped by life area with color coding
  - Progress bars with color-coded thresholds (green/yellow/orange/red)
  - Expandable goal details (target date, metrics, motivation)
  - Status icons (active, paused, completed, abandoned)
  - Files: `GoalsView.tsx`, `App.tsx`, `Sidebar.tsx`
- **Advanced Task Filters in Entity Link Menu (P2-3)**: Enhanced PageLinkMenu
  - Task filter bar: All, Today, Inbox, Upcoming, P1, P2
  - Priority-based task icons (🔴 P1, 🟠 P2, ✓ other)
  - Client-side filtering with date range detection
  - Task metadata in entity results (status, priority, dueDate)
  - Files: `PageLinkMenu.tsx`
- **Vault Entry Versioning (P2-4)**: Basic version control for vault entries
  - New `vault_entry_versions` database table
  - Service methods: createVersion, listVersions, getVersion, restoreVersion, pruneVersions, updateWithVersion
  - API endpoints: GET/POST `/:id/versions`, GET `/:id/versions/:version`, POST `/:id/versions/:version/restore`, DELETE `/:id/versions`
  - Automatic backup before restore operations
  - Files: `schema.ts`, `vault-service.ts`, `vault.ts` (routes)

### January 11, 2026 - Recurring Task UI (ENH-019)
- **Natural Language Parser**: Extended task parser to extract recurrence patterns
  - Supports: "daily", "weekly", "monthly", "bi-weekly", "every day", "every week"
  - Day-specific: "every Monday", "every Tuesday and Thursday", "every weekday"
  - Human-readable display: "Daily", "Weekly - Mon, Wed, Fri", etc.
- **Recurrence Picker UI**: Added to QuickAddTask component
  - Presets dropdown: None, Daily, Weekdays, Weekly, Bi-weekly, Monthly
  - Shows parsed recurrence from natural language input
  - Integration with advanced options section
- **TaskCard Indicator**: Visual recurrence badge on task cards
  - Purple recurring icon with human-readable pattern
  - Tooltip shows full RRULE description
- **Instance Generator Job**: Background job for creating recurring instances
  - `recurrence-generate`: Triggered when recurring task is completed
  - `recurrence-batch`: Daily batch job for missed instances
  - Uses rrule npm package for RFC 5545 compliance
  - Creates child tasks with `recurrenceParentId` linking
- **API Updates**: Added recurrenceRule to task create/update schemas
- **Files Modified**:
  - `apps/tasks/src/utils/parseNaturalLanguage.ts` - Recurrence pattern extraction
  - `apps/tasks/src/components/QuickAddTask.tsx` - Recurrence picker UI
  - `apps/tasks/src/components/TaskCard.tsx` - Recurrence indicator
  - `hub/src/api/routes/tasks.ts` - API schema updates
  - `hub/src/services/task-service.ts` - Recurrence trigger on complete
  - `hub/src/jobs/processors/recurrence.ts` - New processor file
  - `hub/src/jobs/queue.ts` - New job types
  - `hub/src/worker.ts` - Job handler integration

### January 10, 2026 - Calendar Page Implementation
- **Dedicated Calendar Page**: Created full `/calendar` route in Command Center
- **Three Views**: Month view (grid with event dots), Week view (time slots), Day view (hourly breakdown)
- **Event Modal**: Full create/edit modal with title, event type, all-day toggle, date/time, location, description
- **Keyboard Shortcuts**: N (new event), T (today), M/W/D (views), arrows (navigation), Esc (close modal)
- **Navigation Controls**: Previous/next period, today button, view switcher
- **Current Time Indicator**: Red line showing current time in Week/Day views
- **Dashboard Link**: Added "View Full Calendar" link to WeekCalendar dashboard widget
- **Mutation Hooks**: Added useCreateEvent, useUpdateEvent, useDeleteEvent hooks
- **Files Created**:
  - `apps/command-center/src/pages/Calendar.tsx` - Main calendar page
  - `apps/command-center/src/components/calendar/MonthView.tsx` - Month grid view
  - `apps/command-center/src/components/calendar/WeekView.tsx` - Week time-slot view
  - `apps/command-center/src/components/calendar/DayView.tsx` - Day detailed view
  - `apps/command-center/src/components/calendar/EventModal.tsx` - Create/edit modal
- **Files Modified**:
  - `apps/command-center/src/App.tsx` - Added `/calendar` route
  - `apps/command-center/src/components/layout/Sidebar.tsx` - Added Calendar nav item
  - `apps/command-center/src/hooks/useCalendar.ts` - Added mutation hooks
  - `apps/command-center/src/components/dashboard/WeekCalendar.tsx` - Added "View Full Calendar" link

### January 10, 2026 - Calendar Documentation Update
- **Documentation Accuracy**: Updated `/docs/public/features/calendar/index.md` to match actual implementation
- **Removed Inaccurate Claims**: Removed references to Month/Week/Day view pages that don't exist
- **Updated View Description**: Clarified that calendar is a dashboard widget, not a standalone page
- **Removed Non-Functional Shortcuts**: Removed keyboard shortcuts (`G then C`, `T`, `N`) that aren't implemented
- **Added API Reference**: Added table of all calendar API endpoints
- **Added Roadmap Section**: Documented planned future enhancements for dedicated calendar page
- **Dashboard Widget Documentation**: Added detailed section describing the actual WeekCalendar widget features

### January 8, 2026 - Journal Integration into Command Center
- **Journal Page Integrated**: Moved Daily Journal from standalone app into Command Center
- **New Route**: `/journal` in Command Center with full 7-step workflow
- **Navigation Update**: Added Journal to sidebar between Habits and Vault
- **Removed External Link**: Removed standalone Daily Journal app link from sidebar
- **New Files Created**:
  - `/apps/command-center/src/api/journal.ts` - API client with full TypeScript types
  - `/apps/command-center/src/hooks/useJournal.ts` - React Query hooks for journal data
  - `/apps/command-center/src/pages/Journal.tsx` - Complete 7-step review page
- **Features Implemented**:
  - Step 1: Habits Review with toggle completion and streak display
  - Step 2: Goals Review grouped by life area with progress bars
  - Step 3: Journal Entry with word count
  - Step 4: Tasks Review with reflection notes per task
  - Step 5: Classes Review (conditional, shows only if class notes exist)
  - Step 6: Tomorrow Preview (events, tasks, habits in 3-column grid)
  - Step 7: Complete Review (mood selection, tags, vault save)
  - History View for browsing past reviews
  - Completed View with summary and vault link
- **Auto-save**: Drafts saved every 30 seconds
- **Dark Theme**: Matches Command Center styling
- **API Tests**: All 14 journal API tests passing (100%)

### January 8, 2026 - Remarkable Integration (Handwritten Notes Pipeline)
- **Complete Remarkable Integration**: Full MBA class notes pipeline
  - Naming convention parser for `MBA/[Semester]/[ClassCode]/[YYYY-MM-DD]` pattern
  - Auto-classification into class notes vs general inbox
  - Semester, class code, and date extraction with validation
- **Database Schema**: Two new tables
  - `remarkable_notes`: Tracking handwritten notes with OCR, classification, vault links
  - `remarkable_sync_state`: Sync history, statistics, and error tracking
- **OCR Processing**: Google Cloud Vision integration
  - Handwriting recognition with confidence scoring
  - PDF text extraction via pdf-parse for typed documents
  - Low-confidence notes flagged for manual review
- **Content Merging System**: Unified class day notes
  - Combines Remarkable OCR + Plaud transcripts + typed notes
  - Generates `_combined.md` with formatted sections
  - Auto-creates/updates vault pages for class days
- **Vault Structure**: Academic organization
  - `vault/academic/mba/{semester}/{class}/days/{date}/`
  - General inbox at `vault/remarkable/inbox/`
  - Automatic folder creation for new classes/dates
- **Background Job Processing**: Async operations
  - `remarkable-sync`: Full folder sync job
  - `remarkable-ocr`: OCR processing for individual files
  - `remarkable-merge`: Combined markdown generation
- **18 New API Endpoints**: Comprehensive REST API
  - Status, documents, sync, watch start/stop
  - Stats, classes, notes by class, inbox, review queue
  - Merge endpoints, OCR updates, reclassification
  - Background job queueing
- **Integration Service**: `remarkable-service.ts`
  - Content merging logic with Plaud transcript lookup
  - Class summary statistics
  - Note management (update, reclassify, delete)
  - Batch merge operations
- **Key Files**:
  - `/hub/src/integrations/remarkable.ts` - Core integration
  - `/hub/src/services/remarkable-service.ts` - Business logic
  - `/hub/src/jobs/processors/remarkable.ts` - Job processors
  - `/hub/src/api/routes/ingestion.ts` - API routes
  - `/hub/src/db/schema.ts` - Database tables

### January 8, 2026 - Command Center v2.0 Phase 4 (Polish & Optimization)
- **Lazy Loading**: Heavy components now lazy-loaded for faster initial page load
  - CanvasHub, FitnessWidget, SystemMonitor, AIInsights, QuickChat loaded on demand
  - Suspense fallbacks with loading spinners during component load
- **Keyboard Shortcuts**: Vim-style navigation for power users
  - `g t` → Go to Tasks app
  - `g g` → Go to Goals page
  - `g h` → Go to Habits page
  - `g v` → Go to Vault app
  - `g d` → Go to Dashboard
  - `g s` → Go to Settings
  - `g p` → Go to Progress
  - `g c` → Go to Canvas
  - `r` → Refresh all dashboard data
  - `?` → Show keyboard shortcuts help
- **Keyboard Shortcuts Modal**: Accessible help dialog showing all shortcuts
  - Proper focus trap and escape key handling
  - Accessible with ARIA labels
- **Accessibility Improvements** (WCAG AA):
  - ARIA labels on all metric cards with values
  - Focus-visible outlines for keyboard navigation
  - `role="listitem"` on metric cards for screen readers
  - `aria-expanded` on collapsible sections
  - Decorative icons marked with `aria-hidden`
- **Mobile Responsiveness**:
  - Metric cards: 2 columns on mobile, 3 on tablet, 6 on desktop
  - Responsive font sizes (text-2xl → text-3xl)
  - Smaller card heights on mobile (120px → 140px)
  - Hidden "Click to view" text on mobile
- **Touch Targets**: All interactive elements meet 44x44px minimum
  - CollapsibleSection headers with min-h-[44px]
  - Larger chevron icons (w-5 h-5)
  - Keyboard shortcuts button with min-w/h-[44px]
- **CSS Fixes**:
  - Added `position: relative` to MetricCardBase for absolute positioning
  - Added `group` class for hover effects
  - Added `animate-scale-in` keyframes for modal animation
  - Focus-visible styles for keyboard users

### January 8, 2026 - VIP Pipeline Phase 4 (Speaker Recognition)
- **Automatic Speaker Recognition**: Voice embedding-based speaker identification
  - Python microservice (`/services/embedding-server/`) with pyannote-audio
  - 512-dimensional voice embeddings for speaker matching
  - pgvector PostgreSQL extension for cosine similarity search
  - Auto-matches speakers with confidence threshold (0.7+)
  - Verification workflow for uncertain matches (0.7-0.8 confidence)
- **Speaker Embedding Service** (`/hub/src/services/speaker-embedding-service.ts`)
  - Extract embeddings from audio segments via Python microservice
  - Create and store voice samples with embeddings
  - Auto-match speakers using pgvector cosine similarity
  - Verification workflow for low-confidence matches
- **Database Updates**
  - `voice_profiles.embedding` - 512-dim vector for aggregate speaker embedding
  - `voice_samples` table - Individual audio samples with embeddings
  - `speaker_mappings.autoMatched`, `needsVerification`, `matchScore` fields
- **VIP Pipeline Integration**
  - New `vip-speaker-embedding` job type runs after extraction
  - Async processing in parallel with vault writer
  - Graceful degradation when embedding service unavailable
- **API Endpoints**
  - POST `/api/voice-profiles/:id/samples` - Add voice sample with embedding
  - POST `/api/voice-profiles/transcripts/:id/auto-match` - Trigger auto-matching
  - GET `/api/voice-profiles/mappings/unverified` - List pending verifications
  - POST `/api/voice-profiles/mappings/:id/verify` - Confirm/reject auto-match
  - GET `/api/voice-profiles/embedding/status` - Check service status
- **Status**: VIP Pipeline now at 90% complete (Phase 0-4)

### January 9, 2026 - VIP Pipeline Phase 3 (Voice Commands)
- **Voice Command Service** (`/hub/src/services/voice-command-service.ts`)
  - Wake word detection: "Plaud" + variations (plod, cloud, plot, plaid)
  - Command types: task, reminder, note, highlight, event/schedule, todo
  - Date extraction: today, tomorrow, Monday-Sunday, next week, end of week
  - Priority extraction: urgent (4), high priority (3), medium (2), low (1)
  - Speaker verification: Only executes commands from "self" voice profile
- **VIP Extraction Integration**
  - Scans transcript segments for voice commands after LLM extraction
  - Creates tasks directly from detected commands
  - Logs command detection stats (detected, executed, skipped)
- **Example Commands**:
  - "Plaud, add task review assignment for next week" → Task with due date
  - "Plaud, remind me to email professor tomorrow" → Task with tomorrow's date
  - "Plaud, note important concept about Nash equilibrium" → Task in inbox
  - "Plaud, urgent fix the production bug" → Task with priority 4
- **Status**: VIP Pipeline now at 80% complete (Phase 0-3)

### January 9, 2026 - VIP Pipeline Phase 2 (Speaker-Labeled Transcripts)
- **Speaker Name Integration**: Vault pages now display actual speaker names
  - Updated `formatTranscriptWithSpeakers()` to accept speaker name map
  - Added `getSpeakerNamesForTranscript()` helper to fetch voice profile names
  - Vault writer automatically looks up speaker mappings when generating pages
  - Fallback to "Speaker N" when no mapping exists
- **Example Output**: `**[0:23] JD:**` instead of `**[0:23] Speaker 1:**`
- **Status**: VIP Pipeline now at 60% complete (Phase 0 + Phase 1 + Phase 2)

### January 9, 2026 - VIP Pipeline Phase 1 (Voice Profiles)
- **Voice Profile System**: Speaker identification infrastructure
  - `voice_profiles` table: Store speaker profiles with categories (self, family, teacher, classmate, colleague, other)
  - `speaker_mappings` table: Per-transcript mapping of Deepgram speaker IDs to profiles
  - Manual speaker assignment workflow for transcript review
- **Voice Profile Service** (`/hub/src/services/voice-profile-service.ts`)
  - Create, list, update, delete voice profiles
  - Link profiles to people database
  - Initialize speaker mappings for transcripts
  - Assign speakers to profiles with confidence scores
  - Update profile statistics (sample count, duration)
- **Voice Profile API** (`/api/voice-profiles`)
  - GET /api/voice-profiles - List all profiles
  - GET /api/voice-profiles/self - Get/create JD's profile
  - POST /api/voice-profiles - Create new profile
  - PATCH /api/voice-profiles/:id - Update profile
  - DELETE /api/voice-profiles/:id - Delete profile
  - GET /api/voice-profiles/transcripts/:id/speakers - Get speaker mappings
  - POST /api/voice-profiles/transcripts/:id/speakers/:speakerId - Assign speaker
  - DELETE /api/voice-profiles/transcripts/:id/speakers/:speakerId - Remove assignment
- **Status**: VIP Pipeline now at 50% complete (Phase 0 + Phase 1)

### January 8, 2026 - Command Center v2.0 Phase 3 (New Dashboard Sections)
- **Database Schema**: Added 2 new tables for Phase 3
  - `ai_insights`: AI-generated insights with type, category, severity, action targets, and expiration
  - `system_health_logs`: Integration health tracking with status, latency, sync times, and error logging
- **Canvas Hub Widget**: Academic dashboard integration
  - Today's class schedule from calendar
  - Upcoming assignments (next 7 days) from Canvas LMS
  - Missing submissions alert with count
  - Next class countdown timer
- **Fitness Widget**: Whoop health integration
  - Workout streak badge
  - Today's recovery score with green/yellow/red zones
  - Average sleep hours
  - Last workout info with type and date
  - Sleep trend sparkline (when available)
- **System Monitor Widget**: Integration health dashboard
  - Status grid showing all integration health (healthy/degraded/down/not_configured)
  - Last sync times with relative timestamps
  - Overall system health indicator
  - Separate sections for active and available integrations
- **AI Insights Widget**: Pattern detection and recommendations
  - Pattern alerts for productivity and workflow
  - Workload warnings (overdue tasks, heavy schedules)
  - Actionable suggestions with click-through targets
  - Dismissible insight cards
  - Auto-generate insights from data patterns
- **New API Endpoints**: 6 endpoints for Phase 3 sections
  - `GET /api/dashboard/canvas` - Canvas Hub data
  - `GET /api/dashboard/fitness` - Fitness/Whoop data
  - `GET /api/dashboard/system` - System health monitor
  - `GET /api/dashboard/insights` - AI insights list
  - `POST /api/dashboard/insights/:id/dismiss` - Dismiss insight
  - `POST /api/dashboard/insights/generate` - Generate new insights
- **Updated Dashboard Layout**: New 5-row layout
  - Row 1: 6 metric cards
  - Row 2: TodayTasks (2/3) + Deadlines (1/3)
  - Row 3: WeekCalendar (2/3) + AI Insights (1/3)
  - Row 4: CanvasHub + FitnessWidget + SystemMonitor (3 columns)
  - Row 5: GoalsPanel + QuickChat (2 columns)

### January 8, 2026 - Daily Journal & Review App
- **New App**: Standalone daily journal app at `/apps/daily-journal` (port 5175)
- **7-Step Review Workflow**: Habits Review, Goals Review, Journal Entry, Tasks Review, Classes Review, Tomorrow Preview, Complete Review
- **Database Schema**: Extended `dailyReviews` table with 15+ new columns for journal workflow
- **Backend Service**: New `daily-journal-service.ts` with complete review data aggregation
- **API Routes**: 6 endpoints at `/api/journal/*` for review CRUD, history, and search
- **API Client**: Extended with `getDailyReview`, `saveDailyReview`, `completeDailyReview`, `getDailyReviewHistory`, `searchDailyReviews`, `toggleHabitInReview`
- **Shared Types**: Comprehensive types in `/packages/types/src/journal.ts`
- **TipTap Editor**: Rich text journal entry with markdown support
- **Auto-Save**: Debounced auto-save every 30 seconds
- **Mood Selector**: 5-level mood selection with emoji visualization
- **Tags System**: Tag input with suggested tags
- **Habit Toggle**: Toggle habit completion during review
- **History View**: Browse past reviews with search and mood filtering
- **Vault Integration**: Completed reviews saved as vault pages
- **Progress Indicator**: Visual step completion tracking
- **Mobile Responsive**: Full mobile support

### January 8, 2026 - Command Center v2.0 Phase 2 (Main Section Enhancements)
- **TodayTasks Enhancement**: Complete rewrite with priority-based grouping
  - Collapsible sections: Overdue (red), High Priority, Medium Priority, Low Priority, No Priority
  - Project tags displayed inline with task titles
  - Source badges showing task origin (Canvas, Email, Meeting, etc.)
  - Time estimate totals per section
  - Quick completion toggle checkbox
  - Toggle to show/hide completed tasks
- **DeadlineWidget Enhancement**: Urgency-based grouping
  - Collapsible sections: Overdue, Due Today, This Week, Next Week, Later
  - Color-coded headers based on urgency level
  - Source and priority badges
  - Days-until countdown with formatted display
  - Stats header showing overdue count and urgent items
- **WeekCalendar Enhancement**: Density heatmap and workload visualization
  - Background color intensity based on event count (density heatmap)
  - Workload indicators (light/moderate/heavy) per day
  - Expandable day view showing all events
  - Event type color coding (meeting, class, personal, focus)
  - Time allocation breakdown showing meetings, classes, focus, and personal time
  - Task count per day
- **New Shared Components**:
  - `CollapsibleSection`: Reusable expandable section with chevron, count badge, and icon
  - `PriorityBadge`: Color-coded priority labels (Urgent/High/Medium/Low/None)
  - `SourceBadge`: Icon-based source indicators with configurable sizes
  - `WorkloadIndicator`: Status dot with optional label
- **New API Endpoints**:
  - `GET /api/dashboard/tasks/grouped` - Today's tasks grouped by priority
  - `GET /api/dashboard/deadlines/grouped` - Deadlines grouped by urgency
  - `GET /api/dashboard/week-overview` - 7-day overview with density and time allocation
- **Backend Service**: Extended `dashboard-service.ts` with three new methods:
  - `getGroupedTodayTasks()` - Returns tasks with project info, grouped by priority
  - `getGroupedDeadlines()` - Returns deadlines grouped by urgency timeframes
  - `getWeekOverview()` - Returns 7-day calendar data with density and workload
- **TypeScript Types**: Extended `types/dashboard.ts` with Phase 2 interfaces:
  - `TaskWithProject`, `GroupedTodayTasks`, `DeadlineTask`, `GroupedDeadlines`
  - `WeekDayEvent`, `WeekDay`, `WeekOverview`
- **React Query Hooks**: New hooks in `useDashboardEnhanced.ts`:
  - `useGroupedTodayTasks()`, `useGroupedDeadlines()`, `useWeekOverview()`

### January 8, 2026 - Command Center v2.0 Phase 1 (Enhanced Metric Cards)
- **Enhanced Dashboard**: 6 interactive metric cards replacing the original 4 static cards
- **New API Endpoint**: `GET /api/dashboard/enhanced` - Unified aggregation of all dashboard data
- **Widget Endpoints**: `GET /api/dashboard/{tasks|events|goals|habits|vault|wellness}` for individual widgets
- **Backend Service**: New `dashboard-service.ts` with parallel query optimization
- **Frontend Components**:
  - `MetricCardBase`: Clickable base component with hover effects and navigation
  - `TasksMetricCard`: Tasks with priority breakdown (H/M/L) and completion progress bar
  - `EventsMetricCard`: Events with countdown to next event and type breakdown
  - `GoalsMetricCard`: Goals with overall progress and life area breakdown
  - `HabitsMetricCard`: Habits with completion ratio, longest streak, and 7-day mini calendar
  - `VaultMetricCard`: Vault entries with recent additions and type breakdown
  - `WellnessMetricCard`: Recovery score with status badge and recommendation
- **Shared Components**: `ProgressBar`, `MiniCalendar` for visual elements
- **TypeScript Types**: Full type definitions in `types/dashboard.ts`
- **React Query Hook**: `useDashboardEnhanced` with 5-minute refresh
- **Responsive Grid**: 6 columns on XL, 3 on LG, 2 on SM, 1 on mobile
- **Click-Through Navigation**: Deep links to external apps (Tasks :5173, Vault :5175) and internal routes

### January 8, 2026 - VIP Pipeline Phase 0 Implementation
- **Segmentation Processor**: Creates recording segments linked to batches
- **Calendar Alignment**: Matches recordings to calendar events with 30%+ overlap threshold
- **Transcription Integration**: Deepgram Nova-2 transcription wired into pipeline
- **AI Extraction**: LLM-powered summarization with key points and action item extraction
- **Task Creation**: Auto-extracts tasks with due date parsing (day names, tomorrow, next week)
- **Vault Writer**: Generates formatted pages with callouts, summaries, key points, transcripts
- **Telegram Notifications**: Daily summary with batch stats, content breakdown, extracted tasks
- **Pipeline Status**: End-to-end flow now functional - upload MP3 → Vault page with transcript

### January 8, 2026 - Plaud Integration PRD v3.0 & Documentation
- **Comprehensive Code Review**: Audited existing Plaud integration codebase
- **PRD v3.0**: Created realistic, phased implementation plan at `docs/plans/plaud-integration-prd-v3.md`
- **Gap Analysis**: Identified what exists (20%) vs what's missing (voice profiles, commands, classification)
- **Phase 0 Focus**: Fix VIP pipeline placeholders (segmentation, transcription, vault writer, notifications)
- **Database Schema Proposals**: `voice_profiles`, `speaker_mappings`, `extracted_commands` tables
- **FEATURES.md Update**: Added detailed Plaud Pro Integration section with status, endpoints, and config

### January 8, 2026 - Multi-Provider LLM Support (Cost Optimization)
- **Provider Chain System**: Automatic fallback when one provider fails (rate limits, errors)
- **Groq Integration** (FREE): Primary provider using Llama 3.3 70B, 14,400 requests/day
- **Google Gemini Integration** (FREE): Secondary provider using gemini-1.5-flash, 15 req/min
- **OpenAI as Fallback**: Paid provider used only when free providers fail
- **Provider Abstraction Layer**: New `/hub/src/lib/llm-provider.ts` with unified interface
- **Individual Providers**: `/hub/src/lib/providers/groq.ts`, `gemini.ts`, `openai.ts`
- **Environment Configuration**: `LLM_PROVIDERS` env var for custom provider priority
- **Updated MasterAgent**: Now uses provider chain instead of direct OpenAI
- **Chat Status Endpoint**: Shows available providers and which handled last request
- **Cost Savings**: ~95%+ reduction in LLM costs for typical usage
- **Plan Document**: Full implementation plan at `/docs/plans/llm-cost-optimization.md`

### January 8, 2026 - Smart Data Recovery Migration
- **New Migration System**: Comprehensive data recovery from Apple Notes, Notion, Todoist, and Google Drive
- **Organized Bucket Structure**: Reference (Sites, Family, People, Documents), Archive (Old Journal, Todoist, Notes, Notion, Work), MBA (2026 Winter, School Archive), Professional (Resumes, Job Applications, Career), Personal (Journal, Health, Travel, Goals), Inbox
- **Smart Categorization**: Pattern-based detection for credentials, family, resumes, MBA content, professional items
- **Family Detection**: Automatic routing for Sam, JD, Ava, John family member content
- **Date-Based Routing**: Pre-2026 content to Archive, 2026+ to current buckets
- **Source-Based Archival**: Proper categorization of Todoist tasks, Notion pages, Apple Notes
- **AI-Enhanced Classification**: Optional GPT-4o-mini integration for ambiguous content
- **Confidence Scoring**: Low-confidence items flagged with `needsReview: true`
- **Migration Commands**: `migrate:recover`, `migrate:recover:dry`, `migrate:recover:apple/notion/todoist/drive`
- **New Migration File**: `/hub/src/migration/smart-data-recovery.ts`

### January 8, 2026 - Goals & Habits Tracking System
- **Goals System**: Complete goal tracking with 6 life areas (Spiritual, Personal, Fitness, Family, Professional, School)
- **Milestone Tracking**: Ordered checkpoints within goals with evidence capture and auto-progress calculation
- **Habit System**: Daily/weekly habit tracking with streak calculation and 2-day grace period
- **Reflections**: Goal journaling with types (progress, obstacle, win, adjustment) and sentiment tracking
- **Health Scoring**: 0-100 goal health based on progress, habits, milestones, and activity
- **Progress Dashboard**: Life area progress, top streaks, goals needing attention, weekly reports
- **Task Generation**: Auto-generate tasks from milestones, goal check-ins, and habit reminders
- **Vault Integration**: Export goal journeys and reflections to vault for documentation
- **Ceremony Integration**: Goals and habits data integrated into morning, evening, and weekly ceremonies
- **New Database Tables**: `goals`, `milestones`, `habits`, `habit_completions`, `goal_reflections`, `goal_tasks`, `habit_tasks`
- **New Services**: `goals-service.ts`, `milestones-service.ts`, `habits-service.ts`, `reflections-service.ts`, `progress-service.ts`, `task-generation-service.ts`, `goal-vault-integration.ts`
- **New API Routes**: `/api/goals/*`, `/api/milestones/*`, `/api/habits/*`, `/api/reflections/*`, `/api/progress/*`, `/api/task-generation/*`, `/api/goal-vault/*`

### January 8, 2026 - Vault Notion-Style Revamp
- **Block-Based Editor**: Complete TipTap integration for Notion-like editing experience
- **New Database Tables**: `vault_pages`, `vault_blocks`, `vault_references` for block-based content
- **Backend Services**: `vault-page-service.ts`, `vault-block-service.ts` with full CRUD
- **API Routes**: New `/api/vault/pages/*` and `/api/vault/blocks/*` endpoints
- **NotionSidebar Component**: 224px collapsible sidebar with favorites and page tree
- **BlockEditor Component**: TipTap editor with StarterKit, TaskList, CodeBlock, Images
- **SlashMenu Component**: Slash command (/) for quick block insertion
- **CommandPalette Component**: ⌘K for search, navigation, and quick actions
- **PageHeader Component**: Title editing, emoji icon picker, breadcrumbs, favorite toggle
- **BlockPageView**: Main container for block-based page viewing
- **Mode Switching**: Toggle between new "Pages" and "Legacy" vault modes
- **Keyboard Shortcuts**: ⌘K (search), ⌘N (new page), ⌘\ (toggle sidebar), ⌘S (save)
- **Design Tokens**: Notion-inspired color palette (#37352f, 708px content width, 224px sidebar)
- **React Query Hooks**: `useVaultPages.ts`, `useVaultBlocks.ts` for data management
- **Types Package Updated**: VaultPage, VaultBlock, VaultBlockType, all block content interfaces

### January 9, 2026 - CI/CD Pipeline with GitHub Actions
- **CI Workflow** (`.github/workflows/ci.yml`): Automated testing on every PR
  - Type checking, unit tests, E2E tests with Playwright
  - Critical path tests (10x) before deployment
  - Build verification for all apps
  - Security audit for leaked secrets
- **Deploy Staging** (`.github/workflows/deploy-staging.yml`): Auto-deploy on merge to develop
- **Deploy Production** (`.github/workflows/deploy-production.yml`): Manual approval required, deploy on merge to main
- **Rollback** (`.github/workflows/rollback.yml`): Emergency rollback to any deployment tag
- **Database Migrations** (`.github/workflows/db-migrate.yml`): Safe migrations with dry-run option
- **Documentation**: Full CI/CD guide at `/docs/operations/CICD.md`

### January 9, 2026 - Multi-Environment Database Setup
- **Environment Configuration**: New `/hub/src/config/env.ts` with Zod validation for all environment variables
- **Three Environments**: Development (local), Staging (Neon branch), Production (Neon main)
- **Environment Files**: `.env.development`, `.env.staging`, `.env.production` templates
- **Database Client Update**: `/hub/src/db/client.ts` now uses environment-aware configuration with SSL support
- **Migration Scripts**: `db:migrate:dev`, `db:migrate:staging`, `db:migrate:prod` commands
- **Staging Seed Script**: `db:seed:staging` to populate staging with test data
- **Verification Script**: `db:verify` and `db:verify:all` to test database connectivity
- **Documentation**: Full setup guide at `/docs/infrastructure/multi-environment-setup.md`
- **Security**: Environment files with credentials are gitignored; only templates committed

### January 8, 2026 - Documentation System
- **Public Documentation**: User-facing guides for all features at `/docs/public/`
- **Public Roadmap**: Industry-standard Now/Next/Later/Future format at `/docs/roadmap/index.md`
- **Backlog**: Known issues, enhancements, feature requests at `/docs/roadmap/backlog.md`
- **Changelog**: Keep a Changelog format at `/docs/roadmap/changelog.md`
- **Documentation Rules**: CLAUDE.md updated with mandatory documentation requirements
- **Getting Started Guides**: Installation, Quick Start, Core Concepts
- **Feature Documentation**: Tasks, Vault, Agent, Calendar, Ceremonies, Integrations
- **Reference Guides**: Keyboard shortcuts, Quick add syntax, Glossary

### January 7, 2026 - Tasks App Enhancements
- **Nested Project Hierarchy**: Sidebar now displays projects in collapsible parent-child structure
- **Add Task to Project**: Hover over any project in sidebar to see + button for quick task creation
- **Inline Add Task**: ProjectView now has inline "Add task" at bottom of each section
- **Project ID on Tasks**: Tasks now properly associate with projects via `projectId` field
- **Canvas Winter 2026 Sync**: Filtered to current semester only (MBA 560, MBA 677R, SWELL 132)
- **Scheduled Dates**: Canvas tasks now get scheduled date 3 days before due date

### January 7, 2026 - Canvas Integrity Agent
- **New Agent**: Full Canvas integrity verification system
- **Database Schema**: 4 new tables for Canvas tracking
- **Term Filtering**: Only sync current semester classes
- **Nested Projects**: Semester → Class → Assignments hierarchy
- **API Routes**: `/api/canvas-integrity/*` endpoints
- **Nudge System**: Telegram alerts for unscheduled assignments

### January 7, 2026 - Job Hunting Agent
- **New App**: Standalone job hunting agent at `/apps/jobs` (port 5176)
- **Database Schema**: 5 new tables - `jobs`, `resume_metadata`, `job_profile`, `screening_answers`, `application_history`
- **Job Service**: Full CRUD for job tracking with status workflow (discovered -> applied -> interviewing -> offered)
- **Resume Service**: Resume variant management with skill extraction and auto-selection for jobs
- **Job Profile Service**: User preferences for job search (titles, companies, salary, location, auto-apply settings)
- **Screening Answers**: Library of answers to common application questions with pattern matching
- **API Routes**: Complete REST API at `/api/jobs/*` with jobs, resumes, profile, and screening endpoints
- **Frontend Views**: Dashboard, Pipeline (Kanban), Jobs list, Resumes, Profile, Settings
- **Manual Entry**: Form to add jobs applied outside the agent
- **Vault Integration**: Archive job applications to vault for long-term storage
- **Hub Integration**: Status updates populate the hub via API

### January 7, 2026 - AI-Powered Testing Agent
- **New Feature**: AI-powered testing agent using Claude Vision for autonomous QA testing
- **TestingAgent Class**: Main agent with tool-based architecture (18 tools)
- **PlaywrightBridge**: Browser automation wrapper for navigation, clicks, fills, screenshots
- **ScreenshotAnalyzer**: Claude Vision integration for UI analysis
- **ReportGenerator**: HTML, JSON, and Markdown test report generation
- **API Endpoints**: `/api/testing/run`, `/api/testing/smoke`, `/api/testing/status`
- **CLI Runner**: `bun run test:ai` for command-line testing
- **Test Scopes**: smoke (quick), full (comprehensive), specific (targeted pages)

### January 7, 2026 - Agent Chat Enhancements
- **Chat API Connected**: Wired `/api/chat` endpoint to MasterAgent (was previously a TODO)
- **Task Inbox Logic**: Tasks without `scheduledStart` go to inbox; with scheduled date go to today/upcoming
- **Due Date vs Scheduled Date**: Clear distinction - `dueDate` is deadline, `scheduledStart/End` is work time
- **People Tools Added**: `people_create`, `people_search`, `people_get`, `people_update`, `people_add_interaction`
- **Smart Vault Classification**: `vault_smart_add` tool with auto-detection of content type (credential, person, financial, medical, legal, note)
- **Calendar Attendees**: Added `attendees` field to calendar events
- **Image-to-Calendar**: `calendar_from_image` tool using GPT-4o Vision to extract events from screenshots
- **New Types Added**: TaskSource now includes 'chat', VaultSource includes 'chat', VaultContentType includes 'person', 'credential', 'financial', 'medical', 'legal'
- **Total Agent Tools**: Increased from 26 to 37 tools

### January 7, 2026 - Initial Feature Documentation
- Created comprehensive features list from codebase analysis
- Documented all 14+ integrations
- Listed all API endpoints and their capabilities
- Catalogued database schema
- Documented tech stack and development commands

### January 12, 2026 - Habit Specific Days UI Fix
- **Day Selector UI**: Added interactive day picker (S M T W T F S) buttons for selecting specific days when creating habits
- **Goals Page Integration**: Day selector now appears in habit creation form within Goal detail panel
- **Habits Page Integration**: Day selector now appears in standalone habit creation modal
- **Smart Display**: Habits show formatted day names (e.g., "Mon, Wed, Fri" or "Weekdays") instead of raw frequency
- **Journal Integration**: Habits with specific days only appear in daily journal on selected days
- **Validation**: Submit button disabled until at least one day is selected for specific_days frequency
- **Files Modified**: `Goals.tsx`, `Habits.tsx`, `types/goals.ts` in command-center app

### January 12, 2026 - Dashboard Performance & Stability Fixes
- **Root Cause Fix**: Identified and fixed N+1 query pattern causing production dashboard failures
- **Database Indexes**: Added 4 new performance indexes via migration `0007_performance_indexes.sql`:
  - `tasks_status_due_idx` - Composite index for task queries filtering on status + due_date
  - `vault_entries_created_at_idx` - Index for "recent entries" dashboard lookups
  - `goal_reflections_goal_created_idx` - Composite index for efficient "latest reflection per goal" queries
  - `habit_completions_habit_date_idx` - Index for habit completion range queries
- **N+1 Query Elimination**: Rewrote `getGoalsNeedingAttention()` in progress-service.ts
  - Before: 1 + N queries (51+ database calls for 50 active goals)
  - After: 1 single query with correlated subquery
  - Also optimized to SELECT only needed columns instead of `SELECT *`
- **Graceful Degradation**: Updated `getEnhanced()` in dashboard-service.ts
  - Changed from `Promise.all()` to `Promise.allSettled()`
  - Dashboard now returns partial data if any metric fails (instead of 500 error)
  - Individual metrics return sensible defaults on failure
- **Error Handling**: Added try-catch to all dashboard metric methods:
  - `getTasksMetric()`, `getEventsMetric()`, `getGoalsMetric()`, `getHabitsMetric()`, `getVaultMetric()`
- **Production Results**: Dashboard response times improved from timeouts to ~150-400ms
- **Files Modified**:
  - `hub/src/db/migrations/0007_performance_indexes.sql` (new)
  - `hub/src/db/schema.ts` - Added index definitions
  - `hub/src/services/dashboard-service.ts` - Error handling and resilience
  - `hub/src/services/progress-service.ts` - N+1 query fix

### January 13, 2026 - Dashboard Widget Performance Fixes
- **Grouped Tasks Query Optimization**: Rewrote `getGroupedTodayTasks()` in dashboard-service.ts
  - Combined two separate queries (today's tasks + overdue) into single optimized query
  - SELECT only needed columns instead of `SELECT *`
  - Added LIMIT 200 to prevent memory issues with large datasets
  - Result: 15s+ timeout → 0.47s response time
- **Grouped Deadlines Query Optimization**: Rewrote `getGroupedDeadlines()` in dashboard-service.ts
  - Removed LEFT JOIN with projects table (was causing OOM crashes on Railway)
  - Added bounded date range filter (-30 to +90 days) for efficient index usage
  - Reduced LIMIT to 50 for safety margin on memory-constrained environments
  - SELECT only essential columns (id, title, dueDate, priority, source, context)
  - Result: 15s+ timeout/OOM crash → 0.55s response time
- **CORS Configuration**: Updated `hub/src/index.ts` with function-based origin matching
  - Supports localhost development (any port)
  - Supports all Vercel deployments (*.vercel.app)
  - Supports production domains (jdagent.app)
  - Credentials properly enabled for cross-origin requests
- **Production Performance Summary**:
  | Endpoint | Before | After |
  |----------|--------|-------|
  | `/api/dashboard/tasks/grouped` | 15s+ timeout | 0.47s |
  | `/api/dashboard/deadlines/grouped` | OOM crash | 0.55s |
  | `/api/dashboard/enhanced` | 30s+ timeout | ~1s |
- **Files Modified**:
  - `hub/src/services/dashboard-service.ts` - Query optimizations for grouped endpoints
  - `hub/src/index.ts` - CORS configuration

### January 23, 2026 - Test Suite Improvements & Vault Architecture Documentation
- **Vault Architecture Documented**: Clarified split between Command Center (browse/search) and Vault app (create/edit)
- **Vault Redirect Component**: Created user-friendly redirect when accessing `/vault/new` or `/vault/:id` from Command Center
  - Auto-redirects to Vault app (localhost:5181) after 3 seconds
  - Provides manual "Open Vault App Now" button
  - Explains architecture change with helpful tips
- **Dashboard Test Improvements**: Fixed 3 dashboard load tests with better wait conditions
  - Increased timeouts to 10-15 seconds for cascading loads
  - Added explicit visibility waits instead of simple presence checks
  - All 5 dashboard tests now passing
- **Chat API Tests**: Properly skipped 2 chat endpoint tests requiring OpenAI API
  - Added comprehensive documentation explaining skip reason
  - Added TODO for future mocking strategy
- **Test Results**: Improved test stability and user experience
  - Dashboard tests: 100% passing (5/5)
  - API tests: 100% passing (37/37 excluding skipped)
  - Vault workflows: 80% passing (4/5, 2 creation tests correctly skipped)
- **Files Modified**:
  - `apps/command-center/src/pages/VaultRedirect.tsx` (created) - User-friendly redirect component
  - `apps/command-center/src/App.tsx` - Router configuration for vault redirects
  - `apps/command-center/e2e/app.spec.ts` - Dashboard test timing improvements
  - `apps/command-center/e2e/api-tests.spec.ts` - Chat API test skipping with documentation
  - `FEATURES.md` - Vault architecture documentation
  - `apps/command-center/TEST-IMPROVEMENTS-JAN-23.md` (created) - Comprehensive test improvements report

---

*When updating this document, add your changes to the Changelog section with the date and a brief description of what was added or modified.*
