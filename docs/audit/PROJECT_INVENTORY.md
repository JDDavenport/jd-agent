# JD Agent - Project Inventory

**Audit Date:** January 26, 2026
**Auditor:** Claude PM Agent
**Version:** 0.3.12

---

## Executive Summary

JD Agent is a comprehensive personal productivity system implementing GTD (Getting Things Done) principles with AI assistance. The system consists of:

- **1 Backend Hub API** (Node.js + Hono + PostgreSQL)
- **3 Native iOS Apps** (SwiftUI + Swift 5.9+)
- **3 Desktop Apps** (Tauri 2.x + React + Rust)
- **8 Web Applications** (React + Vite + Tailwind)
- **2 Shared Packages** (Types, API Client)
- **56 API Route Files**
- **96 Service Files**
- **64 Test Files**

---

## Architecture Map

```
JD Agent Monorepo
├── hub/                          # Backend API (Bun + Hono + PostgreSQL + Redis)
│   ├── src/
│   │   ├── api/routes/          # 56 API endpoint files
│   │   ├── services/            # 96 business logic services
│   │   ├── integrations/        # External service connectors
│   │   ├── agents/              # AI agent implementations
│   │   ├── db/                  # Database schema & migrations
│   │   └── jobs/                # BullMQ background jobs
│   └── scripts/                 # Utility scripts & testing
│
├── apps/
│   ├── command-center/          # Main dashboard (Tauri Desktop)
│   ├── tasks/                   # Task management (Tauri Desktop)
│   ├── vault/                   # Knowledge base (Tauri Desktop)
│   ├── jd-tasks-ios/           # Task management (iOS Native SwiftUI)
│   ├── jd-command-center-ios/  # Briefing & productivity (iOS Native SwiftUI)
│   ├── vault-ios/              # Knowledge base (iOS Native SwiftUI)
│   ├── jobs/                   # Job hunting agent (Web)
│   ├── sosatisfying/           # SoSatisfying.com frontend (Web)
│   ├── sosatisfying-api/       # SoSatisfying.com backend (Web API)
│   ├── ad-exchange/            # Gadz.io ad exchange (Web)
│   ├── crypto-tracker/         # Crypto portfolio tracker (Web)
│   ├── read-help/              # Reading assistant (Web)
│   └── docs-frontend/          # Documentation site (Next.js)
│
└── packages/
    ├── types/                   # Shared TypeScript types
    └── api-client/              # Typed API client library
```

---

## Component Details

### Backend Hub (`/hub`)

**Technology Stack:**
- Runtime: Bun (Node.js alternative)
- Framework: Hono 4.6.14 (lightweight HTTP framework)
- Database: PostgreSQL 15+ with Drizzle ORM 0.37.0
- Queue: BullMQ 5.30.1 + Redis (ioredis 5.4.1)
- AI: OpenAI 6.15.0, Anthropic SDK 0.71.2, Groq SDK 0.37.0, Google Gemini
- Testing: Vitest 4.0.16 with coverage
- Other: Playwright 1.57.0 (browser automation), Zod 3.24.1 (validation)

**API Routes (56 files):**
| Route File | Purpose |
|------------|---------|
| `acquisition.ts` | Lead acquisition and enrichment |
| `ad-exchange.ts` | Advertising exchange APIs |
| `analytics.ts` | Analytics and reporting |
| `briefing.ts` | Daily briefing generation |
| `budget-reports.ts` | Budget reporting and analysis |
| `brain-dump-ui.ts` | Quick capture interface |
| `calendar.ts` | Calendar and event management |
| `canvas.ts` | Canvas LMS integration |
| `canvas-materials.ts` | Canvas course materials |
| `ceremonies.ts` | GTD weekly/monthly reviews |
| `classes.ts` | Class management (MBA) |
| `contexts.ts` | GTD contexts (@home, @computer, etc.) |
| `crypto.ts` | Cryptocurrency tracking |
| `feedback.ts` | User feedback collection |
| `filters.ts` | Saved task filters |
| `finance.ts` | Plaid integration, transactions |
| `finance-analytics.ts` | Spending analytics |
| `goal-vault.ts` | Goal tracking system |
| `goals.ts` | Goal CRUD operations |
| `health.ts` | System health monitoring |
| `inbox.ts` | Inbox processing |
| `ingestion.ts` | Data ingestion pipeline |
| `integrations.ts` | Integration management |
| `jupyter.ts` | Jupyter notebook integration |
| `labels.ts` | Task labels/tags |
| `logs.ts` | System logging |
| `oauth.ts` | OAuth 2.0 authentication |
| `people.ts` | Contact/relationship management |
| `privacy.ts` | Privacy controls |
| `productivity.ts` | Screen time and productivity metrics |
| `progress.ts` | Progress tracking |
| `projects.ts` | Project management |
| `read-help.ts` | Reading assistant APIs |
| `recordings.ts` | Plaud recording management |
| `roadmap.ts` | Product roadmap APIs |
| `schedule.ts` | Task scheduling & time blocking |
| `search.ts` | Global search |
| `setup.ts` | Initial setup wizard |
| `setup-ui.ts` | Setup UI components |
| `sosatisfying.ts` | SoSatisfying.com APIs |
| `system.ts` | System configuration |
| `tasks.ts` | Task CRUD operations |
| `testing.ts` | AI testing agent APIs |
| `vault.ts` | Knowledge base (Notion-style pages + legacy entries) |
| `voice-profiles.ts` | Voice profile management |
| `webhooks.ts` | Webhook receivers |

**Services (96 files):**
Major services include:
- `task-service.ts` - Task management logic
- `vault-page-service.ts` - Notion-style pages
- `finance-service.ts` - Budget tracking
- `canvas-integrity-service.ts` - Canvas assignment monitoring
- `scheduling-service.ts` - Time blocking algorithms
- `plaud-gdrive-sync.ts` - Recording sync
- `acquisition-service.ts` - Lead generation
- `crypto-service.ts` - Crypto portfolio
- `notebook-service.ts` - Jupyter integration
- Many more...

**Database Tables (from schema.ts):**
- `projects` - Project hierarchy
- `sections` - Todoist-style project sections
- `contexts` - GTD contexts
- `labels` - Cross-cutting tags
- `tag_categories` - Tag grouping
- `filters` - Saved filters
- `tasks` - Task management
- `vault_entries` - Legacy vault entries
- `vault_pages` - Notion-style pages
- `vault_blocks` - Page content blocks
- `calendar_events` - Calendar entries
- `people` - Contact management
- `finance_*` - Budget & transaction tables
- Many more...

---

### iOS Apps

#### 1. Tasks iOS (`/apps/jd-tasks-ios`)

**Technology:**
- Language: Swift 5.9+
- Framework: SwiftUI
- Target: iOS 16+
- Project: XcodeGen (`project.yml`)
- Xcode Project: `JDTasks.xcodeproj`

**Screens/Views:**
- `ContentView.swift` - Main container
- `TaskListView.swift` - Task list
- `TaskRowView.swift` - Individual task card
- `TaskDetailView.swift` - Task details
- `QuickAddView.swift` - Quick capture
- `InboxView.swift` - Inbox
- `TodayView.swift` - Today's tasks
- `UpcomingView.swift` - Upcoming tasks
- `SettingsView.swift` - App settings
- `EmptyStateView.swift` - Empty state UI

**Services:**
- `APIClient.swift` - HTTP client
- `TaskService.swift` - Task operations
- `NaturalLanguageParser.swift` - Quick add parsing
- `AppConfiguration.swift` - Config management

**Models:**
- `Task.swift` - Task data model
- `APIResponse.swift` - API response wrapper

**Siri Integration:**
- `AddTaskIntent.swift` - "Add task" shortcut
- `CompleteTaskIntent.swift` - "Complete task" shortcut
- `ListTasksIntent.swift` - "List tasks" shortcut
- `TaskEntity.swift` - Task entity for Siri
- `TaskShortcuts.swift` - Shortcut definitions

**Status:** ✅ Fully implemented native iOS app

---

#### 2. Command Center iOS (`/apps/jd-command-center-ios`)

**Technology:**
- Language: Swift 5.9+
- Framework: SwiftUI
- Target: iOS 16+
- Xcode Project: `JDCommandCenter.xcodeproj`

**Screens/Views:**
- `ContentView.swift` - Main container
- `BriefingView.swift` - Daily briefing display
- `ProductivityView.swift` - Screen time & productivity metrics
- `SettingsView.swift` - App settings

**Services:**
- `APIClient.swift` - HTTP client
- `BriefingService.swift` - Briefing data
- `ProductivityService.swift` - Productivity metrics
- `AppConfiguration.swift` - Config management

**Models:**
- `Briefing.swift` - Briefing data model
- `ScreenTimeReport.swift` - Productivity metrics
- `APIResponse.swift` - API response wrapper

**Siri Integration:**
- `BriefingShortcuts.swift` - Briefing shortcuts

**Status:** ✅ Fully implemented native iOS app

---

#### 3. Vault iOS (`/apps/vault-ios`)

**Technology:**
- Language: Swift 5.9+
- Framework: SwiftUI
- Target: iOS 16+
- Xcode Project: `JDVault.xcodeproj`

**Screens/Views:**
- `ContentView.swift` - Main container
- `HomeView.swift` - Home/browse view
- `SearchView.swift` - Search interface
- `PageDetailView.swift` - Page viewing/editing
- `PageRow.swift` - Page list item
- `BlockView.swift` - Block rendering component

**Services:**
- `APIClient.swift` - HTTP client

**Models:**
- `VaultPage.swift` - Page data model
- `VaultBlock.swift` - Block data model

**ViewModels:**
- `HomeViewModel.swift` - Home view logic
- `PageDetailViewModel.swift` - Page detail logic

**UI Tests:**
- `JDVaultUITests.swift` - Automated UI tests

**Status:** ✅ Fully implemented native iOS app with recent bug fixes (Jan 26)

---

### Desktop Apps (Tauri 2.x)

All desktop apps use:
- **Framework:** Tauri 2.x (Rust + WebView)
- **Frontend:** React 19 + Vite + Tailwind CSS
- **Routing:** React Router v7
- **Build:** Cargo (Rust) + npm/bun (frontend)

#### 1. Command Center Desktop (`/apps/command-center`)

**Tauri Config:** `src-tauri/tauri.conf.json`
**Status:** ✅ Desktop app with system tray integration

**Features:**
- Main dashboard with widgets
- Journal interface
- Settings panel
- System health monitoring
- Finance widgets
- Canvas integration
- Weekly planning calendar
- Recordings management

**Key Pages:**
- Dashboard
- Tasks (redirects to Tasks app)
- Vault (read-only, redirects to Vault app for editing)
- Calendar
- Weekly Planning
- Finance
- System Health
- Recordings

---

#### 2. Tasks Desktop (`/apps/tasks`)

**Tauri Config:** `src-tauri/tauri.conf.json`
**Status:** ✅ Dedicated task management desktop app

**Features:**
- Full GTD workflow (Inbox, Today, Upcoming, etc.)
- Quick add with natural language
- Project views
- Filter system
- Keyboard shortcuts

---

#### 3. Vault Desktop (`/apps/vault`)

**Tauri Config:** `src-tauri/tauri.conf.json`
**Status:** ✅ Notion-style editor desktop app

**Features:**
- TipTap block-based editor
- Slash command menu
- Page hierarchy
- Dark mode
- Command palette (⌘K)
- Entity linking ([[)
- Version history
- Vault Chat (AI assistant)

---

### Web Applications

#### 1. Jobs App (`/apps/jobs`)
**Purpose:** Job hunting agent interface
**Stack:** React + Vite
**Status:** 🟡 In development

#### 2. SoSatisfying Frontend (`/apps/sosatisfying`)
**Purpose:** SoSatisfying.com frontend
**Stack:** React + Vite
**Status:** 🟡 In development

#### 3. SoSatisfying API (`/apps/sosatisfying-api`)
**Purpose:** SoSatisfying.com backend
**Stack:** Hono + PostgreSQL
**Status:** 🟡 In development

#### 4. Ad Exchange (`/apps/ad-exchange`)
**Purpose:** Gadz.io advertising exchange
**Stack:** React + Vite
**Status:** 🟡 In development

#### 5. Crypto Tracker (`/apps/crypto-tracker`)
**Purpose:** Cryptocurrency portfolio tracking
**Stack:** React + Vite
**Status:** 🟡 In development

#### 6. Read Help (`/apps/read-help`)
**Purpose:** Reading assistant
**Stack:** React + Vite
**Status:** 🟡 In development

#### 7. Docs Frontend (`/apps/docs-frontend`)
**Purpose:** Documentation site
**Stack:** Next.js
**Status:** ✅ Deployed

---

### Shared Packages

#### Types Package (`/packages/types`)
Shared TypeScript type definitions used across all apps.

#### API Client Package (`/packages/api-client`)
Typed HTTP client for Hub API with automatic type inference.

---

## Development Environment

**Package Manager:** Bun (monorepo with workspaces)

**Development Commands:**
```bash
bun run dev              # Start hub
bun run hub              # Start hub with hot reload
bun run tasks            # Start tasks app
bun run vault            # Start vault app
bun run command-center   # Start command-center app
bun run jobs             # Start jobs app
bun run docs             # Start docs site
bun run db:push          # Push schema to database
bun run db:studio        # Open Drizzle Studio
bun run test             # Run tests
bun run verify           # Verify database
```

**Testing:**
```bash
cd hub
bun run test                # Run unit tests
bun run test:coverage       # Run with coverage
bun run test:critical       # Run critical paths 10x
bun run test:ai             # Run AI testing agent
bun run test:vault-ios      # Run iOS integration tests
```

**iOS Development:**
```bash
# Open Xcode projects
open apps/jd-tasks-ios/JDTasks.xcodeproj
open apps/jd-command-center-ios/JDCommandCenter.xcodeproj
open apps/vault-ios/JDVault.xcodeproj
```

**Desktop Development:**
```bash
# Tauri dev mode
cd apps/command-center && bun run tauri:dev
cd apps/tasks && bun run tauri:dev
cd apps/vault && bun run tauri:dev

# Tauri builds
bun run tauri:build
```

---

## Database Structure

**Provider:** PostgreSQL 15+
**ORM:** Drizzle ORM 0.37.0
**Migration Tool:** Drizzle Kit 0.30.1

**Key Tables (50+ total):**
- Task Management: `tasks`, `projects`, `sections`, `labels`, `contexts`, `filters`
- Calendar: `calendar_events`, `calendar_conflicts`
- Vault: `vault_entries`, `vault_pages`, `vault_blocks`, `vault_embeddings`
- Finance: `plaid_items`, `plaid_accounts`, `transactions`, `budget_categories`
- People: `people`, `interactions`
- Canvas: `canvas_courses`, `canvas_assignments`, `canvas_submissions`
- Recordings: `recordings`, `transcripts`
- Goals: `goals`, `goal_milestones`, `goal_check_ins`
- System: `integrations`, `webhooks`, `logs`

---

## External Integrations

**Authenticated APIs:**
- Google Calendar (OAuth 2.0)
- Canvas LMS (OAuth 2.0)
- Todoist (API token)
- Notion (OAuth 2.0)
- Plaid (OAuth 2.0) - Chase bank integration
- Plaud Note (Web scraping + API)
- Telegram Bot

**AI Providers:**
- Groq (llama-3.3-70b) - Primary, free
- Google Gemini (gemini-1.5-flash) - Secondary, free
- OpenAI (gpt-4-turbo) - Fallback, paid
- Anthropic Claude (analysis) - Paid
- Voyage AI (embeddings) - Paid

**File Storage:**
- AWS S3 / Cloudflare R2 (file attachments)

**Email:**
- Resend (transactional email)
- Gmail (inbox monitoring)

**SMS:**
- Twilio (alerts)

**Vision:**
- Google Cloud Vision (OCR)
- OpenAI GPT-4o (image-to-calendar)

---

## Test Coverage

**Test Files:** 64 total

**Coverage Metrics:**
- Services: ~60%+ target
- Integrations: ~40%+ target
- Critical paths: 80%+ required

**Test Types:**
- Unit tests (Vitest)
- Integration tests
- E2E tests (Playwright)
- AI-powered exploratory tests (Claude Vision)
- iOS UI tests (XCTest)

**Critical Path Testing:**
Deployment BLOCKED if critical paths fail (10x repetition required).

---

## Documentation

**Locations:**
- `/FEATURES.md` - Feature inventory (single source of truth)
- `/CLAUDE.md` - Development rules & workflow
- `/docs/roadmap/` - Product roadmap and changelog
- `/docs/plans/` - Implementation plans
- `/docs/public/features/` - User-facing documentation
- `/apps/docs-frontend/` - Documentation website

**Documentation Requirements:**
- All features must be documented in FEATURES.md
- All changes must update changelog
- New apps require feature documentation
- Roadmap must be kept current

---

## Build Status (as of Jan 26, 2026)

| Component | Status | Notes |
|-----------|--------|-------|
| Hub API | ✅ Production | Running stable |
| Tasks iOS | ✅ Production | Native app complete |
| Command Center iOS | ✅ Production | Native app complete |
| Vault iOS | ✅ Production | Recent bug fixes deployed |
| Command Center Desktop | ✅ Production | Tauri app |
| Tasks Desktop | ✅ Production | Tauri app |
| Vault Desktop | ✅ Production | Tauri app |
| Jobs Web | 🟡 Development | In progress |
| SoSatisfying | 🟡 Development | In progress |
| Ad Exchange | 🟡 Development | In progress |
| Crypto Tracker | 🟡 Development | In progress |
| Read Help | 🟡 Development | In progress |
| Docs Site | ✅ Production | Next.js deployed |

---

## Next Steps for Audit

1. ✅ Complete project structure discovery
2. ⏳ Feature-by-feature validation (Phase 2)
3. ⏳ iOS deep audit (Phase 3)
4. ⏳ Desktop deep audit (Phase 4)
5. ⏳ Code quality analysis (Phase 5)
6. ⏳ Bug catalog (Phase 6)
7. ⏳ Fix proposals (Phase 7)
8. ⏳ Executive summary (Phase 8)

---

**End of Project Inventory**
