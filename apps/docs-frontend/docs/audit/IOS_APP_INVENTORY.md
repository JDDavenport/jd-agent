# JD Agent - iOS Apps Comprehensive Inventory

**Audit Date:** January 26, 2026
**Auditor:** Claude PM Agent via Explore Agent
**Agent ID:** a7ab0fd

---

## Overview

The JD Agent system includes three native iOS applications that extend the platform's functionality to mobile devices. Each app connects to the JD Agent Hub backend (running on `http://localhost:3000` or a configurable IP) and provides specific functionality through SwiftUI-based interfaces.

---

## 1. JD Tasks iOS (`/apps/jd-tasks-ios`)

### App Information

**Bundle Identifier:** `com.jdagent.tasks-ios`
**Display Name:** JD Tasks
**Development Team:** TP4ZZ5XA76
**Target iOS Version:** 16.0+
**Xcode Version:** 15.0+
**Swift Version:** 5.9
**Marketing Version:** 1.0.0
**Code Sign Style:** Automatic

### Capabilities & Entitlements

- **Siri Integration** (`com.apple.developer.siri`) - Enabled for voice commands
- NSAppTransportSecurity configured for localhost and local networking
- No encryption required (ITSAppUsesNonExemptEncryption: false)

### Screen/View Hierarchy

**Root View:** `ContentView` (Tab-based navigation)

```
ContentView (TabView)
├── InboxView (Tab: Inbox)
│   ├── TaskListView
│   ├── TaskRowView (for each task)
│   └── TaskDetailView (navigation)
├── TodayView (Tab: Today)
│   ├── Overdue Tasks Section
│   ├── Today Tasks Section
│   └── Completed Tasks Section
├── UpcomingView (Tab: Upcoming)
│   └── TaskListView
├── SettingsView (Tab: Settings)
│   └── Configuration options
└── QuickAddView (Sheet modal)
    └── Task input form
```

### Swift Files & Purpose

**App Entry:**
- `App/JDTasksApp.swift` - App entry point with TaskShortcuts registration

**Models:**
- `Models/Task.swift` - Core data models:
  - `JDTask` - Main task entity with GTD workflow
  - `TaskStatus` enum - inbox, today, upcoming, waiting, someday, done, archived
  - `TaskSource` enum - 14 sources (manual, email, canvas, meeting, recording, calendar, etc.)
  - `EnergyLevel` enum - high, low, admin
  - `TaskFilters` - Advanced filtering
  - `CreateTaskInput` / `UpdateTaskInput` - API input DTOs
- `Models/APIResponse.swift` - Generic API response wrappers

**Services:**
- `Services/APIClient.swift` - HTTP client with URLSession, JSON encoding/decoding, error handling
- `Services/TaskService.swift` - Task operations (list, get, create, update, complete, delete)
- `Services/AppConfiguration.swift` - Settings management via UserDefaults
  - Configurable API base URL (default: 192.168.1.175:3000)
  - Default context (personal, work, school, health, mba)
  - UI preferences (show completed, haptics, Siri setup flag)
- `Services/NaturalLanguageParser.swift` - Parse natural language for quick add

**Views:**
- `Views/ContentView.swift` - Tab navigation and floating quick-add button
- `Views/InboxView.swift` - Unprocessed tasks
- `Views/TodayView.swift` - Today's tasks with overdue section
- `Views/UpcomingView.swift` - Next 7 days of tasks
- `Views/TaskListView.swift` - Reusable task list component
- `Views/TaskRowView.swift` - Single task display with swipe actions
- `Views/TaskDetailView.swift` - Full task editing interface
- `Views/QuickAddView.swift` - Modal for quick task creation
- `Views/SettingsView.swift` - Settings and configuration
- `Views/EmptyStateView.swift` - Empty state messaging

**Intents (Siri):**
- `Intents/AddTaskIntent.swift` - "Add [task] to my tasks"
- `Intents/CompleteTaskIntent.swift` - "Complete [task]"
- `Intents/ListTasksIntent.swift` - "What are my tasks"
- `Intents/TaskEntity.swift` - Siri entity type definition
- `Intents/TaskShortcuts.swift` - Shortcuts provider with phrases

**Extensions:**
- `Extensions/Date+Extensions.swift` - Date formatting helpers

### Key Features

- **GTD Workflow** - 7 task statuses aligned with Getting Things Done
- **Siri Voice Control** - Full voice command support
- **Natural Language Quick Add** - Parse dates, priorities, contexts, labels, time estimates
- **Task Counts** - Badge indicators on tabs (inbox, overdue counts)
- **Swipe Actions** - Complete, move to today, delete
- **Filtering** - By status, context, project, due date
- **Task Details** - Priority, due dates, labels, contexts, subtasks, energy levels

### API Endpoints Used

- `GET /api/health` - Health check
- `GET /api/tasks/inbox` - Inbox tasks
- `GET /api/tasks/today` - Today's tasks
- `GET /api/tasks/upcoming?days=7` - Upcoming tasks
- `GET /api/tasks/overdue` - Overdue tasks
- `GET /api/tasks/counts` - Task counts for badges
- `GET /api/tasks` - Generic task listing with filters
- `POST /api/tasks` - Create new task
- `GET /api/tasks/{id}` - Get single task
- `PATCH /api/tasks/{id}` - Update task
- `POST /api/tasks/{id}/complete` - Mark task complete
- `DELETE /api/tasks/{id}` - Delete task

---

## 2. JD Command Center iOS (`/apps/jd-command-center-ios`)

### App Information

**Bundle Identifier:** `com.jdagent.command-center-ios`
**Display Name:** JD Command
**Development Team:** TP4ZZ5XA76
**Target iOS Version:** 16.0+
**Xcode Version:** 15.0+
**Swift Version:** 5.9
**Marketing Version:** 1.0.0
**Code Sign Style:** Automatic

### Capabilities & Entitlements

- **Siri Integration** (`com.apple.developer.siri`)
- **Family Controls** (`com.apple.developer.family-controls`) - For screen time data
- NSAppTransportSecurity for localhost access

### Screen/View Hierarchy

**Root View:** `ContentView` (Tab-based navigation)

```
ContentView (TabView)
├── BriefingView (Tab: Briefing)
│   ├── Greeting section
│   ├── Summary section
│   ├── Dynamic briefing sections
│   └── Integration status display
├── ProductivityView (Tab: Productivity)
│   └── Screen time and metrics
└── SettingsView (Tab: Settings)
```

### Swift Files & Purpose

**App Entry:**
- `App/JDCommandCenterApp.swift` - App initialization with service injection

**Models:**
- `Models/Briefing.swift` - Core data structures:
  - `BriefingResponse` - Full briefing with sections, greeting, integrations
  - `BriefingSection` - Organized briefing content
  - `BriefingItem` - Individual briefing items with metadata
  - `IntegrationStatus` - Status of integrations (healthy, degraded, down, not_configured)
  - `IntegrationStatusSummary` - Status of plaud, remarkable, canvas, calendar
  - `BriefingPreview` - Quick preview data
  - `AnyCodable` - Flexible metadata handling
- `Models/ScreenTimeReport.swift` - Screen time metrics
- `Models/APIResponse.swift` - Generic API response wrapper

**Services:**
- `Services/APIClient.swift` - HTTP communication layer
- `Services/BriefingService.swift` - Briefing generation and refresh
  - `generateBriefing()` - Fetch full briefing
  - `refresh()` - Refresh current briefing
  - `getPreview()` - Quick preview data
  - `getIntegrationStatus()` - Integration health only
- `Services/ProductivityService.swift` - Screen time and productivity metrics
- `Services/AppConfiguration.swift` - Settings and API configuration

**Views:**
- `Views/ContentView.swift` - Main tab navigation
- `Views/Briefing/BriefingView.swift` - Daily briefing display
  - Loading state
  - Error handling
  - Greeting and summary
  - Organized sections (tasks, calendar, recordings, etc.)
  - Integration status panel
- `Views/Productivity/ProductivityView.swift` - Screen time metrics
- `Views/Settings/SettingsView.swift` - Configuration

**Intents (Siri):**
- `Intents/BriefingShortcuts.swift` - App shortcuts provider with multiple intents:
  - `GetBriefingIntent` - "Give me my briefing"
  - `CheckIntegrationsIntent` - "Check my integrations"
  - `GetProductivityIntent` - "How much screen time did I have"

**Extensions:**
- `Extensions/Date+Extensions.swift` - Date utilities

### Key Features

- **Daily Briefing** - AI-generated summary with personalized greeting
- **Integration Monitoring** - Real-time status of plaud, remarkable, canvas, calendar
- **Screen Time Tracking** - Productivity metrics via Family Controls
- **Siri Integration** - Voice access to briefing and productivity
- **Refresh Capability** - Manual refresh with pull-to-refresh
- **Dynamic Sections** - Briefing automatically includes relevant sections

### API Endpoints Used

- `GET /api/briefing` - Full briefing generation
- `GET /api/briefing/preview` - Quick preview
- `GET /api/briefing/integrations` - Integration status
- `GET /api/productivity/screen-time` - Screen time metrics

---

## 3. Vault iOS (`/apps/vault-ios`)

### App Information

**Bundle Identifier:** `com.jdagent.vault` (main), `com.jdagent.vault.uitests` (tests)
**Display Name:** JD Vault
**Development Team:** 5744Y4WB6M
**Target iOS Version:** 17.0+ (higher than other apps)
**Xcode Version:** 15.0+
**Swift Version:** 5.9
**Marketing Version:** 1.0.0
**Development Language:** en
**Supported Devices:** iPhone and iPad (TARGETED_DEVICE_FAMILY: 1,2)

### Test Configuration

- **UI Test Target:** `JDVaultUITests`
- **Test Bundle ID:** `com.jdagent.vault.uitests`
- **Xcode generates test Info.plist automatically**

### Capabilities & Entitlements

- NSAppTransportSecurity - Allows arbitrary loads
- Supports multiple scenes (iPadOS)
- Multiple interface orientations

### Screen/View Hierarchy

**Root View:** `ContentView` (NavigationStack)

```
ContentView
├── HomeView
│   ├── Quick Actions section
│   │   ├── New Note button
│   │   ├── Search button
│   │   └── Import button
│   ├── Recent Pages section
│   ├── Favorites section
│   └── All Notes section
├── PageDetailView (navigationDestination)
│   ├── Page Header (editable title)
│   ├── Blocks Section
│   │   ├── BlockView (for each block)
│   │   └── Dynamic block rendering
│   ├── Add Block button
│   └── Toolbar (favorite, share, delete)
└── SearchView (sheet modal)
    └── Search results
```

### Swift Files & Purpose

**App Entry:**
- `JDVaultApp.swift` - App initialization with AppState
  - `AppState` class - Tracks online status, loading, errors
  - Health check on launch

**Models:**
- `Models/VaultPage.swift` - Page data structures:
  - `VaultPage` - Individual note/page with hierarchical support
  - `VaultPageTreeNode` - Tree structure for hierarchical pages
  - `CreatePageInput` / `UpdatePageInput` - API input DTOs
  - Custom date decoding for ISO8601 format
- `Models/VaultBlock.swift` - Block type definitions:
  - `BlockType` enum - 14+ block types (text, heading1-3, bulletList, numberedList, todo, quote, code, divider, callout, file, image)
  - Custom decoder for API format compatibility
  - Display names for each type

**Services:**
- `Services/APIClient.swift` - API communication (singleton pattern)
  - Configured for simulator (localhost) and physical device (10.34.144.203:3000)
  - Date formatting with ISO8601 support
  - Comprehensive error handling

**ViewModels:**
- `ViewModels/HomeViewModel.swift` - Home screen logic
  - `pageTree` - Hierarchical page structure
  - `favorites` - Favorite pages list
  - `recentPages` - Recently updated pages
  - `loadData()` - Parallel API calls for tree, favorites, pages
  - `refresh()` - Manual refresh
  - `createPage()` - Create new page
  - `toggleFavorite()` - Favorite toggling
- `ViewModels/PageDetailViewModel.swift` - Page detail logic
  - Block management
  - Title editing
  - Page updates

**Views:**
- `ContentView.swift` - Root navigation with error/offline banners
  - `ErrorBanner` - Red error display
  - `OfflineBanner` - Orange offline indicator
- `Views/HomeView.swift` - Home page with quick actions and sections
- `Views/PageDetailView.swift` - Full page editor
  - Title editing
  - Block rendering
  - Toolbar with favorite/share/delete
- `Views/SearchView.swift` - Search interface
- `Components/PageRow.swift` - Reusable page list item
- `Components/BlockView.swift` - Renders individual blocks based on type

**Tests:**
- `JDVaultUITests/JDVaultUITests.swift` - Comprehensive UI test suite:
  - T-001: App launch test
  - T-002: Pages load test
  - T-003: Favorites section test
  - XCTest with XCUIApplication
  - Tests for navigation, page loading, sections

### Key Features

- **Hierarchical Pages** - Parent-child page relationships
- **Block-Based Editor** - 14+ block types for rich content
- **Favorites** - Quick access to important pages
- **Search** - Full-text page search
- **Offline Support** - Connection status tracking
- **iPad Support** - Landscape and multi-window support
- **Comprehensive Testing** - UI tests for critical paths

### API Endpoints Used

- `GET /api/health` - Health check
- `GET /api/vault/pages` - List all pages
- `GET /api/vault/pages?archived=true` - List archived pages
- `GET /api/vault/pages/{id}` - Get single page
- `GET /api/vault/pages/tree` - Get hierarchical tree
- `GET /api/vault/pages/favorites` - Get favorite pages
- `POST /api/vault/pages` - Create new page
- `PATCH /api/vault/pages/{id}` - Update page
- `POST /api/vault/pages/{id}/favorite` - Toggle favorite
- `GET /api/vault/pages/{id}/blocks` - Get page blocks
- `POST /api/vault/pages/{id}/blocks` - Create block
- `DELETE /api/vault/blocks/{id}` - Delete block

---

## Architecture Summary

### Common Patterns Across All Apps

**App Entry:**
- Single `@main` struct implementing `App` protocol
- `WindowGroup` for main scene
- Service injection via `@StateObject` and `@EnvironmentObject`

**Service Architecture:**
- `APIClient` - Core HTTP communication
- Domain-specific services - `TaskService`, `BriefingService`, etc.
- `AppConfiguration` - Settings and preferences
- Separation of concerns

**View Architecture:**
- `ContentView` - Root navigation
- Tab-based or stack-based navigation
- Reusable components (rows, lists)
- Modal sheets for forms
- Environment objects for state sharing

**Data Models:**
- Codable with custom date formatting
- Computed properties for derived data
- Separate input DTOs for API requests
- Enums for controlled values

**Error Handling:**
- Custom error types implementing `LocalizedError`
- User-friendly error messages
- Retry mechanisms
- Network error detection

### Configuration Strategy

All apps use a multi-layer configuration approach:

1. **Build-time** - Info.plist, project.yml (Xcode generation)
2. **Runtime** - UserDefaults for user-configurable settings
3. **Environment** - Hardcoded or build variant for API URLs

### Network Configuration

**JD Tasks & Command Center:** Configurable via Settings (default: 192.168.1.175:3000)

**Vault:** Build-variant based
- Simulator: `http://localhost:3000`
- Device: `http://10.34.144.203:3000`

### Siri & Shortcuts Integration

**JD Tasks:**
- AddTaskIntent - Voice task creation
- CompleteTaskIntent - Voice task completion
- ListTasksIntent - Query tasks by voice
- Natural language parsing in intent handler

**JD Command Center:**
- GetBriefingIntent - Retrieve daily briefing
- CheckIntegrationsIntent - Check integration health
- GetProductivityIntent - Get screen time stats

### Testing Coverage

**JD Vault:** Comprehensive UI test suite
- App launch verification
- Page loading
- Navigation flow
- Section rendering
- Empty states

**JD Tasks & Command Center:** No formal test files found (potential gap)

---

## File Structure Summary

```
apps/
├── jd-tasks-ios/
│   ├── JDTasks.xcodeproj/
│   ├── JDTasks/
│   │   ├── App/
│   │   ├── Models/
│   │   ├── Services/
│   │   ├── Views/ (8 views)
│   │   ├── Intents/ (5 intent files)
│   │   ├── Extensions/
│   │   ├── Resources/Info.plist
│   │   └── JDTasks.entitlements
│   └── project.yml (XcodeGen config)
│
├── jd-command-center-ios/
│   ├── JDCommandCenter.xcodeproj/
│   ├── JDCommandCenter/
│   │   ├── App/
│   │   ├── Models/ (3 models)
│   │   ├── Services/ (3 services)
│   │   ├── Views/ (4 views, organized by type)
│   │   ├── Intents/ (1 file with 3 intents)
│   │   ├── Extensions/
│   │   ├── Resources/Info.plist
│   │   └── JDCommandCenter.entitlements
│   └── project.yml
│
└── vault-ios/
    ├── JDVault.xcodeproj/
    ├── JDVault/
    │   ├── JDVaultApp.swift
    │   ├── ContentView.swift
    │   ├── Models/ (2 models)
    │   ├── Services/ (1 API client)
    │   ├── ViewModels/ (2 viewmodels)
    │   ├── Views/ (3 views)
    │   ├── Components/ (2 components)
    │   ├── Info.plist
    │   └── Assets.xcassets
    ├── JDVaultUITests/
    │   └── JDVaultUITests.swift (comprehensive UI tests)
    └── project.yml
```

---

## Development Notes

### Dependencies

All three apps use **only** Apple frameworks:
- SwiftUI
- Foundation
- AppIntents (for Siri)
- XCTest (for testing)
- URLSession (networking)

**No third-party dependencies** - Pure Swift implementation

### Build Configuration

All apps use **XcodeGen** for project generation from YAML configs:
- `project.yml` in each app directory
- Automatic capability and entitlement setup
- Consistent settings across apps

### Deployment Status

- **JD Tasks** - Development (v1.0.0, build 1)
- **JD Command Center** - Development (v1.0.0, build 1)
- **Vault iOS** - Development (v1.0.0, build 1)

All apps are in active development with no public releases yet.

---

**End of iOS App Inventory**
