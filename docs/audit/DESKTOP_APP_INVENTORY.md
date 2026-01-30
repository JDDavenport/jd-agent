# JD Agent - Desktop Apps Comprehensive Inventory

**Audit Date:** January 26, 2026
**Auditor:** Claude PM Agent via Explore Agent
**Agent ID:** a5b83c8

---

[Content continues with the full desktop apps report from the second explore agent...]

## Comprehensive Desktop Apps Report: JD Agent Tauri Applications

### Executive Summary

JD Agent implements three sophisticated Tauri desktop applications running on macOS, Windows, and Linux, with iOS support planned for Vault. Each app is a full-featured React 19 SPA with TypeScript, Tailwind CSS, and React Router v7, communicating with a centralized Node.js/Hono backend via REST APIs.

---

## Part 1: Tauri Configuration & Native Architecture

### 1. Command Center Desktop App

**Tauri Configuration (`tauri.conf.json`):**
- **Product Name:** JD Command Center
- **Identifier:** `com.jdagent.commandcenter`
- **Version:** 0.0.0
- **Window:** 1440x900px, resizable
- **Dev Server:** `http://localhost:5173`
- **Frontend Build:** Outputs to `../dist`
- **Bundle Icons:** PNG (32x32, 128x128 @2x) + macOS (icns) + Windows (ico)

**Rust Backend (`src-tauri/src/main.rs`):**
- Minimal implementation: ~7 lines
- Uses `tauri::Builder::default()` with generated context
- Windows subsystem disabled for release builds (no console window)
- No custom Tauri commands or plugins
- Pure builder pattern initialization

**Build Configuration (`Cargo.toml`):**
- Tauri v2.x with standard features
- Build script: `build.rs` (delegates to tauri-build)
- No additional Rust dependencies

**Development Workflow:**
- `bun run dev`: Starts Vite dev server on :5173
- `bun run build`: TypeScript + Vite build → `/dist`
- `bun run tauri:dev`: Launches Tauri in dev mode
- `bun run tauri:build`: Creates platform-specific bundles

---

### 2. Tasks Desktop App

**Tauri Configuration (`tauri.conf.json`):**
- **Product Name:** JD Tasks
- **Identifier:** `com.jdagent.tasks`
- **Version:** 0.1.0
- **Window:** 1200x820px, resizable
- **Dev Server:** `http://localhost:5180`
- **Frontend Build:** Outputs to `../dist`
- **Note:** Minimal bundle configuration (no icon definitions)

**Rust Backend (`src-tauri/src/main.rs`):**
- Identical minimal pattern as Command Center (~7 lines)
- No plugins or custom commands
- Standard Tauri initialization

**Build Configuration (`Cargo.toml`):**
- Identical to Command Center
- Tauri v2.x standard
- No native extensions

**Development Workflow:**
- `bun run dev`: Vite on :5180
- `bun run build`: TypeScript + Vite
- `bun run tauri:dev`: Desktop app development
- `bun run tauri:build`: Build bundles

---

### 3. Vault Desktop App (iOS-Capable)

**Tauri Configuration (`tauri.conf.json`):**
- **Product Name:** JD Vault
- **Identifier:** `com.jdagent.vault`
- **Version:** 0.1.0
- **Window:** 1320x900px, resizable
- **Dev Server:** `http://localhost:5181`
- **Security:** CSP set to null (allows embedded content/scripts)
- **iOS Bundle:** Min deployment target 15.0
- **Plugins:**
  - SQL (SQLite with preload: `sqlite:vault.db`)
  - HTTP (network requests)
  - Store (local key-value storage)
  - Haptics (vibration feedback)

**Rust Backend (`src-tauri/src/lib.rs`):**
```rust
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::new().build())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_haptics::init())
        .run(tauri::generate_context!())
        .expect("error while running JD Vault");
}
```
- Mobile entry point macro for iOS
- 4 essential plugins initialized
- Library crate (can be compiled as static/shared/rlib for iOS)

**Main Entry (`src-tauri/src/main.rs`):**
- Delegates to `jd_vault_lib::run()`
- Allows code sharing with iOS builds

**Build Configuration (`Cargo.toml`):**
```toml
[lib]
name = "jd_vault_lib"
crate-type = ["staticlib", "cdylib", "rlib"]
```
- Vault is unique: compiled as library + dylib for iOS interop
- iOS-specific dependencies: `tauri { version = "2", features = ["wry"] }`
- Dependencies:
  - `tauri-plugin-sql` v2 with SQLite
  - `tauri-plugin-http` v2
  - `tauri-plugin-store` v2
  - `tauri-plugin-haptics` v2
  - `serde` + `serde_json` for data handling

**iOS Capabilities (`src-tauri/capabilities/default.json`):**
```json
{
  "identifier": "default",
  "description": "Default capabilities for JD Vault",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "sql:default", "sql:allow-execute", "sql:allow-select", "sql:allow-close", "sql:allow-load",
    "http:default", "http:allow-fetch", "http:allow-fetch-cancel", "http:allow-fetch-read-body", "http:allow-fetch-send",
    "store:default", "store:allow-get", "store:allow-set", "store:allow-delete", "store:allow-keys", "store:allow-clear", "store:allow-load", "store:allow-save",
    "haptics:default", "haptics:allow-vibrate", "haptics:allow-impact-feedback", "haptics:allow-notification-feedback", "haptics:allow-selection-feedback"
  ]
}
```
- Comprehensive permission set for iOS-native capabilities
- Database access, network, local storage, haptic feedback

**Development Workflow:**
- Desktop: `bun run tauri:dev` on :5181
- iOS Init: `bun run tauri:ios:init`
- iOS Dev: `bun run tauri:ios:dev`
- iOS Build: `bun run tauri:ios:build`

---

## Part 2: Frontend React Architecture

### Command Center App (`/apps/command-center`)

**Package.json Dependencies:**
- React 19.2.0 + React DOM
- React Router v7.11.0 (router-based navigation)
- TanStack React Query v5.90.16 (async state & caching)
- Vite 7.2.4 + React plugin
- TailwindCSS 4.1.18
- DnD Kit (drag-and-drop): `@dnd-kit/core`, `@dnd-kit/sortable`
- Heroicons v2.2.0 (icon library)
- markdown-it, react-markdown (content rendering)
- Vite PWA plugin (progressive web app support)

**App Structure (App.tsx):**
```tsx
- Router-based navigation with 20+ routes
- AppLayout wrapper with sidebar + main content
- QueryClient configured: 5-min stale time, no refetch on window focus
- Auto-trigger Plaud sync on app load
- ErrorBoundary error handling
```

**Core Routes:**
1. **Dashboard Views:**
   - `/` - Dashboard (analytics, widgets)
   - `/health` - System Health
   - `/personal-health` - Personal Health (Garmin)
   - `/canvas` - Canvas Integrity (LMS integration)

2. **Planning & Calendar:**
   - `/calendar` - Calendar views (month, week, day)
   - `/weekly-planning` - Weekly planning UI with drag-drop
   - `/progress` - Progress tracking

3. **Finance:**
   - `/finance` - Main finance page
   - `/finance/reports` - Finance reports
   - `/finance/settings` - Finance settings

4. **Content Management:**
   - `/vault` - Vault explorer
   - `/vault/new` - New entry redirect
   - `/vault/:id` - Entry detail redirect
   - `/recordings` - Recording summaries
   - `/remarkable` - Remarkable integration

5. **Full-Screen Pages:**
   - `/chat` - Chat interface (no sidebar)
   - `/setup` - Initial setup (no sidebar)
   - `/brain-dump` - Quick capture (no sidebar)

6. **Other:**
   - `/goals`, `/habits`, `/journal`, `/acquisition`, `/roadmap`, `/settings`

**Component Structure (67 components):**
- `components/layout/` - AppLayout, Header, Sidebar
- `components/calendar/` - DayView, WeekView, MonthView, EventModal
- `components/weekly-planning/` - PlanningCalendar, TaskDetailModal, WeeklyBacklogPanel
- `components/chat/` - MessageList, MessageBubble, ChatInput, QuickActions
- `components/acquisition/` - PipelineBoard, LeadDetail, ScoreBreakdown
- `components/dashboard/` - FinanceWidget, GradesWidget, HomeworkHubWidget
- `components/canvas/` - CanvasQuickActions, CourseMaterials, SubmissionPanel
- `components/health/` - IntegrityLog, CommunicationStatus
- `components/common/` - ErrorBoundary, LineChart, MultiLineChart

**State Management:**
- **React Query:** TanStack React Query for all async operations
- **Local State:** useState hooks for UI state (sidebar collapse, modals)
- **Custom Hooks:** ~15 hooks in `/hooks/` directory
  - `useFinance()` - Finance data
  - `useRecordings()` - Recording sync & playback
  - `useSystemHealth()` - Health metrics
  - `useChat()` - Chat messaging
  - `useCanvasMaterials()` - Course materials
  - `useHomeworkHub()` - Assignment data
  - `useDashboardLoader()` - Dashboard initialization
  - Plus: useCrypto, useCanvasComplete, useGrades, useSetup, useVault

**API Integration:**
- Base URL: `VITE_API_URL || http://localhost:3000`
- API calls via fetch wrapped in hooks
- Triggers Plaud sync endpoint on app start

**Build Configuration (vite.config.ts):**
```typescript
- PWA manifest with command-center branding
- Path alias: @ → ./src
- Dev server: port 5173, proxy /api to :3000
- Sourcemaps enabled for production builds
- build → dist
```

---

### Tasks App (`/apps/tasks`)

**Package.json Dependencies:**
- React 19.2.0 + React DOM
- TanStack React Query v5.90.16
- Vite 7.2.4
- TailwindCSS 4.1.18
- DnD Kit (drag-and-drop)
- Heroicons v2.2.0
- rrule v2.8.1 (recurring rules)
- No React Router (single-page component approach)

**App Structure (App.tsx):**
```tsx
<QueryClientProvider>
  <Sidebar /> - Project navigation
  <main>
    <header> - Search, Add buttons
    {renderMainContent()} - Dynamic view rendering
    <QuickAddTask /> - Modal for task creation
    <SearchModal /> - Search interface
    <TaskDetailPanel /> - Task detail view
  </main>
</QueryClientProvider>
```

**View Types:**
1. **inbox** - Unscheduled, unassigned tasks
2. **today** - Tasks due today with date display
3. **upcoming** - Future tasks
4. **project** - Tasks for specific project
5. **filter** - Custom filtered views
6. **label** - Label-based views

**Component Structure (components):**
- `Sidebar.tsx` - Project tree, quick nav (collapsible parents)
- `TaskCard.tsx` - Individual task display
- `TaskList.tsx` - List rendering
- `SubtaskList.tsx` - Nested subtasks
- `DraggableTaskList.tsx` - Drag-drop reordering
- `QuickAddTask.tsx` - Modal for new tasks
- `TaskDetailPanel.tsx` - Full task editor
- `SearchModal.tsx` - Global search
- `InlineAddTask.tsx` - Inline creation

**State Management:**
- React Query for all data operations
- useState for view selection, modal states
- useMemo for task counts, projects
- Optimistic updates on mutations

**Keyboard Shortcuts:**
| Shortcut | Action |
|----------|--------|
| `q` / `n` | Quick add task |
| `/` or `⌘K` | Search |
| `g` then `i/t/u` | Navigate to Inbox/Today/Upcoming |
| `↑` / `↓` | Select task up/down |
| `⌘Enter` | Complete selected task |
| `Enter` | Open task detail |
| `e` | Edit task |
| `d` | Delete task |
| `Tab` | Create subtask |
| `Esc` | Close modals |

**Data Fetching Hooks:**
```typescript
useTasks(filters?) - All tasks with optional filters
useTodayTasks() - Tasks due today
useInboxTasks() - Unorganized tasks
useTask(id) - Single task detail
useProjects() - All projects
useCreateTask() - Create mutation
useUpdateTask() - Update mutation
useCompleteTask() - Complete mutation
useDeleteTask() - Delete mutation
```

**API Integration (api.ts):**
- Centralized via `createClient(baseUrl)`
- Base URL: `VITE_API_URL` or same-origin
- Paths: `/api/tasks`, `/api/projects`

**Build Configuration (vite.config.ts):**
- PWA manifest
- Path alias: @ → ./src
- Dev server: port 5180, proxy /api to :3000
- Strict port enforcement

---

### Vault App (`/apps/vault`)

**Package.json Dependencies (Most Complex):**
- React 19.2.0 + React DOM
- TanStack React Query v5.90.16
- Vite 7.2.4
- TailwindCSS 4.1.18
- DnD Kit (drag-and-drop)
- Heroicons v2.2.0
- **Tiptap v3.15.3** (rich text editor)
  - Extensions: code-block, highlight, image, link, task-list
  - Lowlight for syntax highlighting
- React Markdown + remark-gfm
- Floating UI (popovers/tooltips)
- Workbox (PWA service worker)
- Playwright (E2E testing)

**Dual Mode Architecture:**

**Mode 1: Notion-Style (New)**
- Block-based editing via Tiptap
- Page tree hierarchy with drag-drop
- Favorites system
- Breadcrumb navigation
- Instant page creation ("Untitled" → navigate immediately)

**Mode 2: Legacy Vault (Existing)**
- Entry-based system with tags
- Flat hierarchical view (parents/children)
- Content types: journal, recording_summary, meeting, reference, etc.
- Filter by tags: inbox, processed, favorite, archived, person, project, area
- Breadcrumb navigation through entry hierarchy

**App Structure (App.tsx - 720 lines):**

```tsx
<QueryClientProvider>
  <SyncProvider>
    {isMobile ? <MobileLayout /> : <DesktopLayout />}
  </SyncProvider>
</QueryClientProvider>
```

**Desktop Layout:**
```tsx
<div>
  <NotionSidebar /> - Page tree, PARA folders, search
  <main>{renderMainContent()}</main>
  <CommandPalette /> - Global search/navigation
  <NewEntryModal /> - Legacy mode entry creation
  <VaultChat /> - Chat sidebar
</div>
```

**Mobile Layout:**
- Bottom tab navigation
- Collapsible sidebars
- Full-screen page editing
- Responsive views

**State Hierarchy:**

```
App Level:
  - appMode: 'notion' | 'legacy'
  - selectedPageId: string | null
  - selectedEntryId: string | null
  - viewType: 'search' | 'inbox' | 'journal' | 'goals' | 'archive' | etc.
  - sidebarCollapsed: boolean
  - showCommandPalette: boolean
  - showChat: boolean

Mobile:
  - mobileTab: 'home' | 'favorites' | 'pages' | 'new'
  - selectedClassCode: string | null
```

**Data Hooks - Notion Mode:**
```typescript
useVaultPageTree() - Hierarchical page structure
useVaultPageFavorites() - Favorite pages list
useVaultPages() - All pages
usePARAFolders() - PARA system folders
useCreateVaultPage(title, parentId) - Create page
useToggleVaultPageFavorite(pageId) - Favorite toggle
useUpdateVaultPage(id, input) - Update page
useDeleteVaultPage(pageId) - Delete page
useInitializePARA() - Create PARA folders
```

**Data Hooks - Legacy Mode:**
```typescript
useVaultEntries() - All vault entries
useVaultSearch(query) - Search entries
useVaultEntry(id) - Single entry detail
useVaultBreadcrumb(id) - Entry hierarchy path
useVaultChildren(id) - Child entries
useUpdateVaultEntry(id, data) - Update entry
```

**Key Views:**

1. **BlockPageView** - Notion-style page editor with Tiptap
2. **SearchView** - Global search + quick actions
3. **JournalViewConnected** - Daily journal reviews (PARA: Projects)
4. **ArchiveViewConnected** - Archived entries (PARA: Archive)
5. **TagsView** - Tag-based organization
6. **GoalsView** - Goal tracking (PARA: Projects)
7. **ClassView** - MBA class notes & sessions
8. **PageView** - Legacy entry detail (markdown rendering)
9. **VaultList** - Filtered entry list

**Keyboard Shortcuts:**
| Shortcut | Action |
|----------|--------|
| `⌘K` | Open command palette |
| `⌘N` | Create new page (instant) |
| `⌘\` | Toggle sidebar collapse |
| `Esc` | Close modals/palette |

**Platform Detection Hook (usePlatform):**
```typescript
usePlatform() returns {
  platform: 'ios' | 'android' | 'macos' | 'windows' | 'linux' | 'web'
  isTauri: boolean
  isMobile: boolean
  isDesktop: boolean
  isWeb: boolean
}
```

**Sync Context (SyncContext):**
```typescript
{
  isOnline: boolean
  isSyncing: boolean
  pendingChanges: number
  lastSyncTime: string | null
  error: string | null
  triggerSync(): Promise<void>
  clearError(): void
}
```
- Monitors online/offline status
- Triggers sync on reconnect
- Tracks pending SQLite changes
- iOS-specific sync via `syncService`

**API Integration (api.ts):**
- Uses custom `createClient(baseUrl)` from `lib/api-client`
- Base URL: `VITE_API_URL` or same-origin
- Re-exports 40+ types for pages, blocks, entries, journals, archive

**Build Configuration (vite.config.ts):**
- Build date injection: `__BUILD_DATE__`
- PWA manifest with vault branding
- Path alias: @ → ./src
- Dev server: port 5181, proxy /api to :3000
- Host binding enabled (for network access)

**Component Structure (24 components):**
- **Core:** NotionSidebar, PageView, Breadcrumb, CommandPalette
- **Blocks:** BlockPageView (Tiptap editor)
- **Views:** SearchView, JournalViewConnected, ArchiveViewConnected, TagsView, GoalsView, ClassView
- **Mobile:** MobileLayout, MobileHomeView, MobileSidebar, BottomSheet
- **MBA:** ClassSessionView, ClassOverview, StudyMode
- **Utils:** VaultList, VaultCard, PageTreeItem, SearchBar, Backlinks, PwaUpdateToast

---

## Part 3: Build & Development Scripts

**Unified Build Process (All 3 Apps):**

```bash
# Development
bun run dev      # Vite dev server (:5173, :5180, :5181)
bun run build    # tsc -b && vite build
bun run preview  # Preview production build

# Tauri Desktop
bun run tauri:dev    # Launch Tauri dev window
bun run tauri:build  # Create OS-specific bundles (dmg, exe, AppImage)

# iOS (Vault Only)
bun run tauri:ios:init   # Initialize iOS project
bun run tauri:ios:dev    # Live development on simulator
bun run tauri:ios:build  # Create iOS app bundle
```

**Build Flow:**
1. TypeScript compilation (`tsc -b`)
2. Vite bundling to `/dist`
3. Tauri embeds frontend in Rust binary
4. Platform-specific compilation:
   - macOS: Xcode toolchain → `.app` bundle
   - Windows: MSVC toolchain → `.exe` + installer
   - Linux: GCC → AppImage or deb
   - iOS: Xcode → `.app` for simulator/device

**Development Server Ports:**
- Command Center Frontend: 5173
- Tasks Frontend: 5180
- Vault Frontend: 5181
- Hub API (backend): 3000
- All frontends proxy `/api` to backend during dev

---

## Part 4: Platform-Specific Features

### Desktop (All 3 Apps)
- Native window management
- File system access (potential)
- System tray integration (not currently used)
- Native notifications (available via Tauri)
- Hardware acceleration via WebView

### iOS (Vault Only)
- SQLite local database (`vault.db`)
- HTTP requests (offline/online sync)
- Local key-value store (preferences)
- Haptic feedback (vibration, impact)
- Lock screen widgets (potential)
- Offline-first architecture

### Web/PWA
- All 3 apps have PWA manifests
- Service worker registration
- Offline caching (Vault uses Workbox)
- Install-to-home-screen capability
- Standalone mode display

---

## Part 5: Integration Architecture

**Frontend → Backend Flow:**

```
React App (React Query)
    ↓
    HTTP/HTTPS via Fetch API
    ↓
Hub REST API (:3000)
    ↓
Services (Finance, Canvas, Vault, etc.)
    ↓
External APIs (Plaid, Canvas, Google Calendar, etc.)
```

**Command Center Integrations:**
- Plaud audio/recordings sync (auto on app launch)
- Canvas LMS integrity checking
- Garmin health metrics
- Plaid finance data
- Google Calendar events
- Vault pages + entries

**Tasks Integrations:**
- Task scheduling with recurring rules (rrule)
- Project hierarchies
- Calendar event creation
- Subtask support
- Multiple filter views

**Vault Integrations:**
- Block-based editing (Tiptap + custom renderers)
- SQLite sync (iOS)
- Canvas class notes
- Recording summaries
- Journal daily reviews
- Goal tracking
- Tag-based organization
- Markdown import/export

---

## Part 6: Key Technical Insights

| Aspect | Implementation |
|--------|-----------------|
| **State Management** | React Query (server) + useState (UI) + Context API (sync) |
| **Routing** | React Router v7 (Command Center) / Custom state (Tasks, Vault) |
| **Styling** | TailwindCSS 4.1.18 with PostCSS pipeline |
| **Data Fetching** | TanStack React Query with 5-min cache, no auto-refetch |
| **Error Handling** | ErrorBoundary wrapper + try-catch in hooks |
| **Mobile Support** | Platform detection hook + conditional rendering |
| **Offline Support** | Vault: SQLite + Sync Context; Others: Service Worker |
| **Build Optimization** | TypeScript strict + tree-shaking + sourcemaps |
| **Testing** | Playwright E2E tests for Command Center; component testing in packages |
| **PWA Support** | All 3 apps have PWA manifests + auto-update service workers |

---

## Part 7: Development Workflow

**Startup Sequence (start-frontends.sh):**

```bash
1. Wait for Hub API (:3000) health check
2. Start Command Center Tauri app (or open prebuilt .app)
3. Start Tasks Tauri app in background
4. Start Vault Tauri app in background
5. Keep script alive to preserve child processes
```

**Logs:**
- `/tmp/command-center.log`
- `/tmp/tasks-app.log`
- `/tmp/vault-app.log`

**Troubleshooting:**
- Check Rust toolchain: `/opt/homebrew/opt/rustup/bin`
- Bun binary location: `~/.bun/bin/bun`
- Vite strict port enforcement (can't reuse ports)

---

## Summary Table

| Feature | Command Center | Tasks | Vault |
|---------|---|---|---|
| **Type** | Dashboards + Planning | Task Manager | Knowledge Base |
| **Frontend** | React 19 + Router v7 | React 19 (Custom) | React 19 (Dual Mode) |
| **Routes** | 20+ pages | 5 views | 10+ views + mobile |
| **Components** | 67 custom | 10+ custom | 24 custom |
| **Hooks** | 15+ domain hooks | 8 task hooks | 10+ vault hooks |
| **Editor** | None | Task form | Tiptap rich editor |
| **Drag-Drop** | Calendar events | Tasks + subtasks | Pages + blocks |
| **Mobile** | Web only | Web only | Full mobile UI |
| **iOS Support** | No | No | Yes (SQLite) |
| **Plugins** | None | None | SQL, HTTP, Store, Haptics |
| **DB** | None (HTTP API) | None (HTTP API) | SQLite (:vault.db) |
| **Window Size** | 1440x900 | 1200x820 | 1320x900 |
| **Dev Port** | 5173 | 5180 | 5181 |
| **Tauri Minimal** | Yes (7 lines) | Yes (7 lines) | No (4 plugins) |

---

## Conclusion

This is a professional, modular Tauri implementation showcasing:
1. **Minimal Rust backend** for Command Center + Tasks (pure builder pattern)
2. **Rich iOS support** for Vault (library crate, SQLite, haptics, sync)
3. **Modern React patterns** (React Query, hooks, context, PWA)
4. **Cross-platform design** (responsive layouts, platform detection)
5. **Enterprise integrations** (LMS, finance, calendar, recordings)

All three apps follow the same development workflow but serve distinct purposes within the JD Agent ecosystem, with Vault being the most feature-rich due to iOS support and offline-first architecture.

---

**End of Desktop App Inventory**
