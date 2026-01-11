# JD Agent - Current Features & Capabilities

> **Last Updated:** January 9, 2026
> **Version:** 0.3.5
> **Phase:** Phase 3 - Verify & Coach

> **For Agents:** See [CLAUDE.md](/CLAUDE.md) for development rules and workflow requirements.

This document is the single source of truth for all current features and capabilities of the JD Agent system.

---

## Architecture Overview

| Component | Location | Purpose |
|-----------|----------|---------|
| Hub (Backend API) | `/hub` | Central API server - single source of truth |
| Command Center | `/apps/command-center` | Main React web dashboard (includes Journal) |
| Tasks App | `/apps/tasks` | Focused task management interface |
| Vault App | `/apps/vault` | Knowledge base (Notion-like) |
| Jobs App | `/apps/jobs` | Job hunting agent interface |
| Shared Types | `/packages/types` | TypeScript type definitions |
| API Client | `/packages/api-client` | Typed API client library |

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
- Recurring task instance generation

### 2. Project Management

**Project Features:**
- Multi-level project hierarchy
- Status tracking (active, on_hold, completed, archived)
- Area of responsibility assignment
- Context association
- Target completion dates
- Linked vault folders for project notes
- Section-based task organization (Todoist-style)

### 3. Vault (Knowledge Base)

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

**Legacy Vault Features (Still Available):**
- Full-text search
- Semantic search with embeddings (Voyage AI) - *Schema ready, wiring in progress*
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

**Features:**
- Google Calendar sync (OAuth 2.0)
- Event types: class, meeting, deadline, personal, blocked_time
- Conflict detection
- Deadline alerts (every 15 minutes via scheduler)
- Event classification by context
- All-day vs. timed events
- Location tracking
- Bidirectional sync with external calendar

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

**Purpose:** Autonomous verification that all Canvas LMS assignments exist as tasks with correct due dates and project assignments.

**Features:**
- Browser automation via Playwright for Canvas scraping
- API-based assignment sync with term filtering
- Nested project hierarchy (Semester → Class → Assignments)
- Automatic task creation with both due date and scheduled date
- Integrity audits (full, incremental, quick check)
- Telegram nudges for unscheduled Canvas tasks

**Database Tables:**
- `canvas_items` - Track all Canvas assignments
- `canvas_audits` - Audit run history and findings
- `class_project_mapping` - Link Canvas courses to projects
- `canvas_schedule_tracking` - Track scheduling status

**API Endpoints:**
```
POST /api/canvas-integrity/audit       # Trigger full audit
POST /api/canvas-integrity/audit/quick # Quick API-only check
GET  /api/canvas-integrity/status      # Current integrity status
GET  /api/canvas-integrity/unscheduled # List unscheduled tasks
POST /api/canvas-integrity/nudge       # Send nudge now
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
| **Whoop** | Active | Recovery, strain, sleep metrics |
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
| `/api/testing` | GET, POST | AI-powered testing agent |

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

**Status:** Complete (100%) - Full MBA class notes pipeline with OCR and content merging

### What Works
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
- `/hub/src/integrations/remarkable.ts` - File watcher, OCR, naming parser
- `/hub/src/services/remarkable-service.ts` - Business logic, content merging
- `/hub/src/jobs/processors/remarkable.ts` - Background job processors
- `/hub/src/api/routes/ingestion.ts` - API endpoints (remarkable section)
- `/hub/src/db/schema.ts` - `remarkable_notes`, `remarkable_sync_state` tables

### Setup Guide
1. **Install rmapi** (recommended): `go install github.com/juruen/rmapi@latest`
2. **Configure sync folder**: Set `REMARKABLE_SYNC_PATH` in `.env`
3. **Optional OCR**: Set `GOOGLE_APPLICATION_CREDENTIALS` for handwriting OCR
4. **Start watching**: `POST /api/ingestion/remarkable/watch/start`
5. **Or manual sync**: `POST /api/ingestion/remarkable/sync`

### PRD Reference
See the Remarkable Integration PRD for detailed implementation plan.

---

## Frontend Applications

### Command Center (`/apps/command-center`)
**Pages:**
- Dashboard: Today's view with enhanced metric cards
- Goals: Goal management with life area breakdown
- Habits: Habit tracking with streak visualization
- Journal: 7-step daily review workflow (integrated from standalone app)
- Vault Explorer: Knowledge base browsing and search
- System Health: Backend health, integrity checks, services status
- Personal Health: Whoop fitness metrics, recovery scores, sleep data
- Settings: Configuration and preferences
- Chat: Full-screen master agent chat
- Brain Dump: Quick capture interface
- Setup Wizard: Initial configuration

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
- InboxView: Unclarified tasks
- TodayView: Today's next actions
- UpcomingView: Scheduled tasks
- ProjectView: Project-specific tasks
- FiltersView: Custom filtered views

**Features:**
- Drag-and-drop task organization (dnd-kit)
- Quick add task modal
- Global search
- Task cards with inline editing
- Sidebar navigation

### Vault App (`/apps/vault`)
**Views (Notion Mode - NEW):**
- BlockPageView: Block-based page editing with TipTap
- Welcome view: Empty state with create page CTA

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

**Features:**
- Block-based editing (Notion-style)
- Slash command menu (/) for quick block insertion
- Command palette (⌘K) for search
- Hierarchical page organization
- Mode switching (Pages vs Legacy)
- Keyboard shortcuts: ⌘K (search), ⌘N (new), ⌘\ (sidebar), ⌘S (save)
- Full-text and semantic search (legacy)
- Rich markdown editing (legacy)
- Entry linking and related entries (legacy)
- File attachments (legacy)

---

## Database Schema (Key Tables)

| Table | Purpose |
|-------|---------|
| `projects` | GTD projects with hierarchy |
| `tasks` | Individual action items |
| `sections` | Todoist-style project sections |
| `contexts` | @context tags |
| `labels` | Cross-cutting tags |
| `filters` | Saved search queries |
| `vault_entries` | Knowledge base entries (legacy) |
| `vault_embeddings` | Semantic search vectors |
| `vault_attachments` | File attachments |
| `vault_pages` | Block-based pages (NEW) |
| `vault_blocks` | Page content blocks (NEW) |
| `vault_references` | Cross-system links (NEW) |
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

**Location:** `/docs/`

**Structure:**
```
/docs/
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
```

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

---

*When updating this document, add your changes to the Changelog section with the date and a brief description of what was added or modified.*
