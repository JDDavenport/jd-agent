# Changelog

All notable changes to JD Agent will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased] - 2026-01-24

### Added
- **Budget Monitoring**: New Budget page in Command Center for real-time spending visibility
  - Plaid Link connection (Chase supported) + manual CSV import
  - Category budgets with progress bars and remaining spend
  - Budget alerts via Email/SMS/Telegram with threshold controls
- **Envelope Budgeting**: YNAB-style “To Be Budgeted” summary and Budgeted/Activity/Available rows
- **Budget Groups + Move Money**: Category grouping and move-money actions between budgets
- **Budget Targets**: Weekly/monthly/yearly targets with funded progress and overspending carry
- **Budget Month View**: Month selector with per‑month budgeted allocations
- **Budget Dashboard**: Whole‑budget at‑a‑glance summary with category list
- **Finance Sync Jobs**: Background finance sync and budget alert checks
- **Vault iOS Home**: Recents list, quick actions, and pull-to-refresh for mobile Vault
- **Vault iOS Swipe Actions**: Favorite, archive, and delete on mobile page lists
- **Vault iOS Floating New Note**: Always-visible create button on mobile
- **Vault PWA Updates**: In-app refresh banner when new build is available
- **Vault Ask AI Quick Action**: One-tap chat entry from mobile home
- **Command Center App Bundle**: macOS bundle now ships with icons for easier discovery
- **Command Center Desktop Discovery**: Auto-launch installed app + install script
- **Vault Mobile Build Stamp**: Display build timestamp for verification
- **Weekly Planning Page**: New `/weekly-planning` page in Command Center for Friday planning sessions
  - Weekly backlog panel showing tasks with `#weekly-backlog` label
  - 17-day calendar view (Friday + 2 weeks) with droppable time slots
  - Drag-and-drop to schedule tasks and reorder backlog priority
  - @dnd-kit integration for smooth drag interactions
- **Task Label Filtering**: `GET /api/tasks?label=weekly-backlog` filters tasks by label
- **Task Reordering API**: `POST /api/tasks/reorder` to persist backlog ordering
- **Task Detail Panel**: Click any task to open slide-out panel with full task information (due date, scheduled date, priority, description, comments)
- **Nested Project Display**: Parent project view now shows child projects as clickable cards
- **Native macOS Apps**: Tasks, Vault, and Command Center now ship as Tauri desktop apps
- **Installable Web Apps (PWA)**: Basic iOS Home Screen install remains available

### Changed
- **Sidebar Navigation**: Clicking project name navigates to project, clicking chevron expands/collapses children
- **Inbox Filtering**: Inbox now shows only unprocessed tasks (no project, no due date, no scheduled date)
- **Recurring Task Parsing**: Natural language "every monday" now sets both recurrence AND first due date

### Fixed
- Command Center System Health now displays uptime strings and integrity timestamps correctly
- Testing agent now uses cloud providers before falling back to local Ollama/llama
- Testing agent pulls missing Ollama models before running locally
- Removed non-functional "Add Section" button from project view
- Vault mobile editor now persists Notion-style page edits and avoids UI overlap with the iOS keyboard

### Production
- Tasks app deployed: https://tasks-ten-ecru.vercel.app
- Vault app deployed: https://vault-indol.vercel.app
- Command Center deployed: https://command-center-plum.vercel.app

---

## [0.3.4] - 2026-01-10

### Added
- Calendar service unit tests (37 tests covering all CRUD operations, conflict detection, alerts)
- Improved E2E tests for week calendar widget (4 tests with meaningful assertions)

### Changed
- Updated calendar documentation to accurately reflect current implementation
- Clarified that calendar is currently a dashboard widget (not standalone page)
- Removed non-functional keyboard shortcuts from documentation
- Added API endpoints reference to calendar docs

### Roadmap
- Added "Calendar Page" to planned features (Month/Week/Day views, event creation modal, keyboard shortcuts)

---

## [0.3.3] - 2026-01-09

### Added

#### Remarkable Integration
- Complete handwritten notes pipeline for MBA class notes
- Naming convention parser: `MBA/[Semester]/[ClassCode]/[YYYY-MM-DD]`
- Auto-classification into class notes vs general inbox
- Google Cloud Vision OCR with confidence scoring
- PDF text extraction via pdf-parse
- Content merging: Remarkable OCR + Plaud transcripts + typed notes
- Combined markdown generation (`_combined.md`)
- Vault structure auto-creation: `vault/academic/mba/{semester}/{class}/days/{date}/`
- General inbox for non-class notes: `vault/remarkable/inbox/`
- Background job processing (sync, OCR, merge)
- 18 new API endpoints for full CRUD operations
- Database tables: `remarkable_notes`, `remarkable_sync_state`

#### Daily Journal App
- New standalone app at `/apps/daily-journal` (port 5178)
- 7-step evening review workflow:
  1. Habits Review - view and toggle daily habit completions
  2. Goals Review - reflect on goals by life area
  3. Journal Entry - rich text editor with auto-save
  4. Tasks Review - review completed tasks with reflection notes
  5. Classes Review - review class notes (conditional)
  6. Tomorrow Preview - preview tomorrow's schedule
  7. Complete Review - select mood, add tags, save to vault
- Auto-save every 30 seconds with debouncing
- Mood tracking (5 levels: great, good, okay, difficult, terrible)
- Tag system for categorizing reviews
- History view with search and filtering
- Vault integration for permanent records
- Progress indicator showing step completion
- Mobile responsive design

#### Command Center v2.0 Phase 3
- Canvas Hub widget with today's classes and upcoming assignments
- Fitness widget with Whoop integration (recovery, sleep, workouts)
- System Monitor widget for integration health status
- AI Insights widget with pattern detection and recommendations
- New dashboard layout with 5 rows

### Database
- Extended `dailyReviews` table with 15+ new columns:
  - `journalText`, `wordCount` for journal content
  - `tasksReviewed`, `classesReviewed` JSONB arrays
  - `habitsCompletedCount`, `habitsTotalCount`, `goalsReviewedCount`
  - `tomorrowEventsCount`, `tomorrowTasksCount`
  - `tags` text array, `mood` enum
  - `currentStep`, `reviewCompleted`, `reviewDurationSeconds`
  - `vaultPageId`, `startedAt`, `completedAt`
- Added `ai_insights` table for AI-generated insights
- Added `system_health_logs` table for integration health tracking

---

## [Unreleased]

### Added

#### Goals & Habits Tracking System
- Complete goal tracking with 6 fixed life areas (Spiritual, Personal, Fitness, Family, Professional, School)
- Goal types: achievement, maintenance, growth
- Metric types: boolean, numeric, percentage, milestone
- Status workflow: active → paused → completed/abandoned
- Health scoring (0-100) based on progress, habits, milestones, and activity
- Motivation and vision statements for goals

#### Milestone System
- Ordered checkpoints within goals
- Status tracking: pending, in_progress, completed, skipped
- Target dates with overdue tracking
- Evidence capture on completion
- Auto task generation for upcoming milestones
- Progress percentage updates goal automatically

#### Habit Tracking
- Frequency: daily, weekly, specific days
- Time of day preference (morning, afternoon, evening)
- Current and longest streak tracking
- 2-day grace period for streak protection
- Quality ratings and duration tracking
- Goal linking for habit-goal relationships

#### Reflections (Goal Journaling)
- Types: progress, obstacle, win, adjustment
- Sentiment tracking: positive, neutral, negative, mixed
- Search and filtering by type/goal/area
- Vault export capability

#### Progress Dashboard
- Today's habits completion percentage
- Progress by life area
- Top habit streaks
- Goals needing attention (alerts)
- Overall goal completion rate
- Upcoming milestones
- Weekly reports with highlights

#### Task Generation
- Auto-generate tasks from upcoming milestones (7 days ahead)
- Goal check-in reminders for stale goals (7 days inactive)
- Habit reminder tasks to protect streaks (3+ day streaks)
- Tasks linked back to goals/habits/milestones

#### Vault Integration
- Export complete goal journeys to vault
- Export individual reflections
- Create goal notes
- Auto-export completed goals

#### Ceremony Integration
- Morning ceremony: goals needing attention, upcoming milestones
- Evening ceremony: top streaks, recent wins, enhanced reflection prompts
- Weekly ceremony: life area progress, weekly highlights, improvements

#### Documentation
- Documentation system with user-facing guides
- Public roadmap
- Backlog transparency
- Getting started documentation

### Changed
- Ceremonies enhanced with goals, habits, and progress data
- CLAUDE.md updated with documentation requirements

### Database
- Added 7 tables: `goals`, `milestones`, `habits`, `habit_completions`, `goal_reflections`, `goal_tasks`, `habit_tasks`
- Added `linkType` column to `goal_tasks` table
- Added `agent` to TaskSource type
- Added `goal-export` and `reflection-export` to VaultSource type

---

## [0.3.0] - 2026-01-07

### Added

#### AI-Powered Testing Agent
- New autonomous QA testing agent using GPT-4o Vision
- 18 testing tools for navigation, verification, and reporting
- Playwright browser automation
- Screenshot capture and analysis
- HTML, JSON, and Markdown test report generation
- Three test scopes: smoke, full, specific

#### Job Hunting Agent
- New standalone app at `/apps/jobs` (port 5176)
- Full job application tracking pipeline
- Status workflow: discovered → applied → interviewing → offered
- Resume variant management with skill extraction
- Job profile for targeting preferences
- Screening question answer library
- Kanban pipeline view with drag-drop
- Manual job entry for external applications

#### Canvas Integrity Agent
- Autonomous verification of Canvas LMS assignments
- Browser automation via Playwright for Canvas scraping
- API-based assignment sync with term filtering (Winter 2026)
- Nested project hierarchy: Semester → Class → Assignments
- Automatic task creation with scheduled dates (3 days before due)
- Integrity audits (full, incremental, quick check)
- Telegram nudges for unscheduled Canvas tasks

#### Agent Enhancements
- Chat API connected to MasterAgent (previously TODO)
- People management tools: `people_create`, `people_search`, `people_get`, `people_update`, `people_add_interaction`
- Smart vault classification: `vault_smart_add` with auto-detection
- Image-to-calendar: `calendar_from_image` using GPT-4o Vision
- Calendar attendees field
- Total agent tools increased from 26 to 37

#### Tasks App
- Nested project hierarchy in sidebar (collapsible parent-child)
- Add task button on project hover
- Inline "Add task" at bottom of each section in ProjectView
- Tasks properly associate with projects via `projectId`

### Changed
- Task creation logic: without `scheduledStart` → inbox, with → today/upcoming
- Clear distinction between `dueDate` (deadline) and `scheduledStart` (work time)
- Canvas sync filtered to current semester only (MBA 560, MBA 677R, SWELL 132)
- Canvas tasks now get scheduled date 3 days before due date

### Database
- Added 4 tables for Canvas tracking: `canvas_items`, `canvas_audits`, `class_project_mapping`, `canvas_schedule_tracking`
- Added 5 tables for Job Hunting: `jobs`, `resume_metadata`, `job_profile`, `screening_answers`, `application_history`

---

## [0.2.0] - 2026-01-02

### Added
- Vault knowledge base with full-text search
- Daily journal with reflection prompts
- Task archival to vault on completion
- Google Calendar bidirectional sync
- Ceremonies system (morning, evening, weekly)
- Telegram bot integration
- Whoop health metrics integration
- Search service with multiple backends

### Changed
- Improved task service with recurring task support
- Enhanced project hierarchy support

---

## [0.1.0] - 2025-12-15

### Added
- Initial release
- Core task management with GTD workflow
- Inbox, Today, Upcoming, Someday views
- Projects with sections
- Contexts (@computer, @calls, @errands, @home)
- Labels for cross-cutting tags
- Quick add with natural language parsing
- Priority levels (P1-P4)
- Subtasks and task hierarchies
- Task comments
- Bulk actions
- Keyboard shortcuts
- Command Center dashboard
- Tasks app
- Vault app (basic)
- Health endpoints
- Canvas LMS integration
- Notion import
- Google Drive import
- Apple Notes import
- Todoist migration

---

## Migration Notes

### Upgrading to 0.3.0
- Run `bun run db:push` to apply new schema changes
- New tables will be created automatically
- Existing data is preserved

### Upgrading to 0.2.0
- Vault entries table expanded - run migrations
- Google Calendar OAuth setup required

---

## Deprecations

### Removed in 0.3.0
- Linear integration deprecated (PostgreSQL is now source of truth for tasks)

---

*This changelog is updated with every release. For the complete roadmap, see [Roadmap](./index.md).*
