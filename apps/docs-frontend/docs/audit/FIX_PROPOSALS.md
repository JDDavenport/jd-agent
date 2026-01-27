# JD Agent - Safe Fix Proposals

**Audit Date:** January 26, 2026
**Auditor:** Claude PM Agent

---

## Fix Execution Priority

This document provides detailed, safe fix proposals for all issues identified in the audit. Fixes are organized into batches based on risk level.

---

## Batch 1: Zero-Risk Fixes (Deploy Immediately)

Fixes that are isolated, well-understood, and cannot break existing functionality.

### FIX-001: Fix TypeScript Compilation Errors in Hub

**Priority:** Critical (P0)
**Risk:** Low
**Estimated Effort:** 2-3 hours

#### Problem
82 TypeScript errors in Hub backend preventing clean builds.

#### Root Cause
1. Playwright browser-context code using DOM types without proper configuration
2. Type mismatches between `null` and `undefined`
3. Missing type annotations on callback parameters

#### Proposed Solution

**Step 1: Fix tsconfig.json for Canvas Integrity Agent**

File: `/hub/src/agents/canvas-integrity/tsconfig.json` (create new)

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "lib": ["ES2021", "DOM"],
    "types": ["@types/node", "@playwright/test"]
  },
  "include": [
    "**/*.ts"
  ]
}
```

**Step 2: Fix null vs undefined issues**

File: `/hub/src/agents/canvas-integrity/index.ts`

```typescript
// BEFORE (lines 460-465):
title: assignment.title,
description: assignment.description,
points: assignment.points_possible,
dueAt: assignment.due_at,

// AFTER:
title: assignment.title ?? undefined,
description: assignment.description ?? undefined,
points: assignment.points_possible ?? undefined,
dueAt: assignment.due_at ?? undefined,
```

**Step 3: Add type annotations to callbacks**

File: `/hub/src/agents/canvas-integrity/explorer/content-extractor.ts`

```typescript
// BEFORE (line 355):
const rows = Array.from(tableElement.querySelectorAll('tr')).map((row, index) => {

// AFTER:
const rows = Array.from(tableElement.querySelectorAll('tr')).map((row: Element, index: number) => {
```

Apply this pattern to all callback parameters flagged in errors.

**Step 4: Fix CreateProjectInput type issues**

File: `/hub/src/agents/canvas-integrity/index.ts` (lines 1203, 1227, 1254)

Remove `status` property from CreateProjectInput objects (not in type definition):

```typescript
// BEFORE:
{
  name: courseName,
  description: `Canvas course: ${courseName}`,
  area: 'School',
  context: 'mba',
  status: 'active', // ❌ Remove this line
  ...
}

// AFTER:
{
  name: courseName,
  description: `Canvas course: ${courseName}`,
  area: 'School',
  context: 'mba',
  ...
}
```

#### Files to Modify
- `/hub/src/agents/canvas-integrity/tsconfig.json` (create)
- `/hub/src/agents/canvas-integrity/index.ts` (7 locations)
- `/hub/src/agents/canvas-integrity/browser-manager.ts` (5 locations)
- `/hub/src/agents/canvas-integrity/explorer/content-extractor.ts` (67 locations)
- `/hub/src/agents/canvas-integrity/explorer/page-navigator.ts` (3 locations)
- `/hub/src/agents/job-agent/adapters/linkedin-adapter.ts` (5 locations)

#### Testing Plan

**Before:**
```bash
cd hub
bun run typecheck
# Should show 82 errors
```

**After:**
```bash
cd hub
bun run typecheck
# Should show 0 errors

# Verify Canvas integrity agent still works
bun run test -- canvas-integrity
curl -X POST http://localhost:3000/api/canvas-integrity/audit/quick
```

**Manual Verification:**
- [ ] TypeScript compiles with no errors
- [ ] Canvas integrity audit runs successfully
- [ ] No runtime errors in logs during audit

#### Rollback Plan
1. Revert all file changes via git: `git checkout hub/src/agents/`
2. Remove new tsconfig: `rm hub/src/agents/canvas-integrity/tsconfig.json`

---

### FIX-002: Fix Integration Health Reporting

**Priority:** High (P1)
**Risk:** Low
**Estimated Effort:** 1 hour

#### Problem
Briefing preview reports `integrationsHealthy: false` causing false alerts.

#### Proposed Solution

**Step 1: Investigate health check logic**

File: `/hub/src/api/routes/briefing.ts` (find preview endpoint)

Add logging to identify failing integration:

```typescript
const integrationStatus = await getIntegrationStatus();
console.log('[DEBUG] Integration Status:', JSON.stringify(integrationStatus, null, 2));

const integrationsHealthy = Object.values(integrationStatus).every(
  status => status === 'healthy' || status === 'not_configured'
);
```

**Step 2: Update health check criteria**

Current logic likely flags integrations as unhealthy if they're `not_configured`. Fix:

```typescript
// BEFORE:
const integrationsHealthy = Object.values(integrationStatus).every(
  status => status === 'healthy'
);

// AFTER:
const integrationsHealthy = Object.values(integrationStatus).every(
  status => status === 'healthy' || status === 'not_configured'
);
```

**Step 3: Add per-integration health to response**

```typescript
return {
  tasksToday,
  eventsToday,
  canvasDue,
  newRecordings,
  integrationsHealthy,
  integrationDetails: integrationStatus, // NEW: Show per-integration status
};
```

#### Files to Modify
- `/hub/src/api/routes/briefing.ts`
- `/hub/src/services/briefing-service.ts` (if health check logic is there)

#### Testing Plan

**Before:**
```bash
curl http://localhost:3000/api/briefing/preview
# Should show integrationsHealthy: false
```

**After:**
```bash
curl http://localhost:3000/api/briefing/preview
# Should show integrationsHealthy: true (or false only if actually unhealthy)
# Should show integrationDetails object
```

#### Rollback Plan
Revert changes to briefing route files.

---

## Batch 2: Low-Risk Fixes (Deploy with Basic Testing)

Fixes that are well-scoped with clear test paths.

### FIX-003: Add iOS Tasks App Test Suite

**Priority:** High (P1)
**Risk:** Low (new tests, won't affect existing code)
**Estimated Effort:** 6-8 hours

#### Problem
iOS Tasks app has zero test coverage, creating high regression risk.

#### Proposed Solution

**Phase 1: Setup Test Infrastructure** (2 hours)

Create test target in Xcode project:
1. Open `apps/jd-tasks-ios/JDTasks.xcodeproj`
2. File → New → Target → iOS Unit Testing Bundle
3. Name: `JDTasksTests`
4. Add target to `project.yml` for XcodeGen

**Phase 2: Unit Tests for Core Logic** (2-3 hours)

File: `/apps/jd-tasks-ios/JDTasksTests/TaskServiceTests.swift`

```swift
import XCTest
@testable import JDTasks

class TaskServiceTests: XCTestCase {
    var sut: TaskService!
    var mockAPIClient: MockAPIClient!

    override func setUp() {
        super.setUp()
        mockAPIClient = MockAPIClient()
        sut = TaskService(apiClient: mockAPIClient)
    }

    func testFetchInboxTasks_Success() async throws {
        // Given
        mockAPIClient.mockResponse = [MockTask.inbox1, MockTask.inbox2]

        // When
        let tasks = try await sut.getInboxTasks()

        // Then
        XCTAssertEqual(tasks.count, 2)
        XCTAssertEqual(tasks[0].status, .inbox)
    }

    func testCompleteTask_Success() async throws {
        // Given
        let taskId = UUID().uuidString
        mockAPIClient.mockCompleteSuccess = true

        // When
        try await sut.completeTask(id: taskId)

        // Then
        XCTAssertTrue(mockAPIClient.completeTaskWasCalled)
        XCTAssertEqual(mockAPIClient.lastCompletedTaskId, taskId)
    }
}
```

**Phase 3: UI Tests for Critical Flows** (3-4 hours)

File: `/apps/jd-tasks-ios/JDTasksUITests/JDTasksUITests.swift`

```swift
import XCTest

class JDTasksUITests: XCTestCase {
    var app: XCUIApplication!

    override func setUp() {
        super.setUp()
        continueAfterFailure = false
        app = XCUIApplication()
        app.launch()
    }

    func testQuickAddTask() throws {
        // T-001: Quick add task flow
        let addButton = app.buttons["quickAddButton"]
        XCTAssertTrue(addButton.exists)
        addButton.tap()

        let titleField = app.textFields["taskTitleField"]
        titleField.tap()
        titleField.typeText("Test task for tomorrow 2pm")

        let saveButton = app.buttons["saveTaskButton"]
        saveButton.tap()

        // Verify task appears in list
        let taskCell = app.cells.containing(.staticText, identifier: "Test task for tomorrow 2pm").firstMatch
        XCTAssertTrue(taskCell.waitForExistence(timeout: 5))
    }

    func testCompleteTask() throws {
        // T-002: Complete task via swipe
        let firstTask = app.cells.firstMatch
        XCTAssertTrue(firstTask.waitForExistence(timeout: 5))

        firstTask.swipeLeft()

        let completeButton = app.buttons["Complete"]
        XCTAssertTrue(completeButton.exists)
        completeButton.tap()

        // Verify task disappears or moves to completed section
        sleep(1)
        XCTAssertFalse(firstTask.exists)
    }

    func testTabNavigation() throws {
        // T-003: Tab navigation works
        let todayTab = app.tabBars.buttons["Today"]
        XCTAssertTrue(todayTab.exists)
        todayTab.tap()

        XCTAssertTrue(app.navigationBars["Today"].exists)

        let inboxTab = app.tabBars.buttons["Inbox"]
        inboxTab.tap()

        XCTAssertTrue(app.navigationBars["Inbox"].exists)
    }
}
```

#### Files to Create
- `/apps/jd-tasks-ios/JDTasksTests/TaskServiceTests.swift`
- `/apps/jd-tasks-ios/JDTasksTests/NaturalLanguageParserTests.swift`
- `/apps/jd-tasks-ios/JDTasksTests/Mocks/MockAPIClient.swift`
- `/apps/jd-tasks-ios/JDTasksUITests/JDTasksUITests.swift`
- `/apps/jd-tasks-ios/project.yml` (update with test targets)

#### Testing Plan

**After Implementation:**
```bash
cd apps/jd-tasks-ios
xcodebuild test -scheme JDTasks -destination 'platform=iOS Simulator,name=iPhone 15'

# Should show:
# ✓ TaskServiceTests: 10 tests passed
# ✓ JDTasksUITests: 5 tests passed
```

#### Rollback Plan
Delete test target from Xcode project. No impact on production code.

---

### FIX-004: Centralize iOS API Configuration

**Priority:** Medium (P2)
**Risk:** Low
**Estimated Effort:** 3-4 hours

#### Problem
iOS apps use inconsistent API base URLs with hardcoded IPs.

#### Proposed Solution

**Step 1: Create Shared Configuration Module**

File: `/apps/shared-ios/Sources/Configuration/APIConfiguration.swift` (new shared package)

```swift
import Foundation

public struct APIConfiguration {
    public static let shared = APIConfiguration()

    private let userDefaults = UserDefaults.standard
    private let defaultURL = "http://localhost:3000"

    public var baseURL: String {
        get {
            // 1. Try user-configured URL
            if let configured = userDefaults.string(forKey: "apiBaseURL"), !configured.isEmpty {
                return configured
            }

            // 2. Try auto-discovery
            if let discovered = discoverLocalAPI() {
                return discovered
            }

            // 3. Fallback to default
            return defaultURL
        }
        set {
            userDefaults.set(newValue, forKey: "apiBaseURL")
        }
    }

    public func testConnection() async -> Bool {
        guard let url = URL(string: "\(baseURL)/api/health") else {
            return false
        }

        do {
            let (_, response) = try await URLSession.shared.data(from: url)
            return (response as? HTTPURLResponse)?.statusCode == 200
        } catch {
            return false
        }
    }

    private func discoverLocalAPI() -> String? {
        // TODO: Implement mDNS/Bonjour discovery
        // For now, try common local IPs
        let commonIPs = [
            "http://localhost:3000",
            "http://192.168.1.175:3000",
            "http://10.34.144.203:3000"
        ]

        for ip in commonIPs {
            if checkConnection(ip) {
                return ip
            }
        }

        return nil
    }

    private func checkConnection(_ urlString: String) -> Bool {
        // Quick sync check (timeout 1s)
        guard let url = URL(string: "\(urlString)/api/health") else {
            return false
        }

        var request = URLRequest(url: url)
        request.timeoutInterval = 1.0

        let semaphore = DispatchSemaphore(value: 0)
        var success = false

        URLSession.shared.dataTask(with: request) { _, response, _ in
            success = (response as? HTTPURLResponse)?.statusCode == 200
            semaphore.signal()
        }.resume()

        _ = semaphore.wait(timeout: .now() + 1.5)
        return success
    }
}
```

**Step 2: Update iOS Apps to Use Shared Config**

File: `/apps/jd-tasks-ios/JDTasks/Services/APIClient.swift`

```swift
// BEFORE:
private let baseURL: String

init() {
    self.baseURL = UserDefaults.standard.string(forKey: "apiBaseURL") ?? "http://192.168.1.175:3000"
}

// AFTER:
import Configuration

private let baseURL: String

init() {
    self.baseURL = APIConfiguration.shared.baseURL
}
```

Repeat for all three iOS apps.

**Step 3: Add First-Launch Connection Test**

File: `/apps/jd-tasks-ios/JDTasks/App/JDTasksApp.swift`

```swift
@main
struct JDTasksApp: App {
    @State private var showConnectionAlert = false

    var body: some Scene {
        WindowGroup {
            ContentView()
                .task {
                    await checkAPIConnection()
                }
                .alert("Cannot Connect to Hub", isPresented: $showConnectionAlert) {
                    Button("Open Settings") {
                        // Navigate to settings
                    }
                    Button("Retry") {
                        Task { await checkAPIConnection() }
                    }
                } message: {
                    Text("Could not connect to JD Agent Hub. Please check your network settings.")
                }
        }
    }

    private func checkAPIConnection() async {
        let connected = await APIConfiguration.shared.testConnection()
        if !connected {
            showConnectionAlert = true
        }
    }
}
```

#### Files to Modify
- Create: `/apps/shared-ios/` package
- Modify: All iOS app `APIClient.swift` files
- Modify: All iOS app entry points for connection test

#### Testing Plan

**Before:**
Vault iOS cannot connect when deployed to device (hardcoded IP mismatch).

**After:**
1. Deploy to simulator → should auto-connect to localhost:3000
2. Deploy to physical device → should try common IPs and connect
3. If none work, show alert with Settings option
4. User configures custom IP → should persist and work

#### Rollback Plan
Revert to hardcoded URLs in each app individually.

---

### FIX-005: Prevent Duplicate Vault Page Creation

**Priority:** Medium (P2)
**Risk:** Low
**Estimated Effort:** 2 hours

#### Problem
Duplicate "Daily Review" vault pages created, likely from race condition.

#### Proposed Solution

**Step 1: Add Unique Constraint to Database**

File: `/hub/src/db/schema.ts`

Add unique index on `(title, createdAt::date)` for daily review pages:

```typescript
export const vaultPages = pgTable(
  'vault_pages',
  {
    // ... existing fields
  },
  (table) => [
    // ... existing indexes
    index('vault_pages_title_date_idx').on(
      table.title,
      sql`DATE(${table.createdAt})`
    ),
  ]
);
```

**Step 2: Add Upsert Logic to Daily Review Completion**

File: `/hub/src/api/routes/journal.ts` (find complete endpoint)

```typescript
// BEFORE:
const vaultPage = await createVaultPage({
  title: `Daily Review - ${formatDate(reviewDate)}`,
  ...
});

// AFTER:
// Check for existing page first
const existingPage = await db.query.vaultPages.findFirst({
  where: and(
    eq(vaultPages.title, `Daily Review - ${formatDate(reviewDate)}`),
    sql`DATE(${vaultPages.createdAt}) = DATE(${reviewDate})`
  ),
});

let vaultPage;
if (existingPage) {
  // Update existing
  vaultPage = await updateVaultPage(existingPage.id, { ... });
} else {
  // Create new
  vaultPage = await createVaultPage({ ... });
}
```

**Step 3: Add Cleanup Script for Existing Duplicates**

File: `/hub/scripts/cleanup-duplicate-vault-pages.ts` (new)

```typescript
import { db } from '../src/db';
import { vaultPages } from '../src/db/schema';
import { eq, sql } from 'drizzle-orm';

async function cleanupDuplicates() {
  // Find duplicate daily review pages
  const duplicates = await db.execute(sql`
    SELECT
      title,
      DATE(created_at) as review_date,
      array_agg(id ORDER BY created_at) as page_ids
    FROM vault_pages
    WHERE title LIKE 'Daily Review -%'
    GROUP BY title, DATE(created_at)
    HAVING COUNT(*) > 1
  `);

  console.log(`Found ${duplicates.rows.length} sets of duplicates`);

  for (const dup of duplicates.rows) {
    const pageIds = dup.page_ids as string[];
    const keepId = pageIds[0]; // Keep oldest
    const deleteIds = pageIds.slice(1); // Delete rest

    console.log(`Keeping ${keepId}, deleting ${deleteIds.length} duplicates for "${dup.title}"`);

    for (const deleteId of deleteIds) {
      await db.delete(vaultPages).where(eq(vaultPages.id, deleteId));
    }
  }

  console.log('Cleanup complete');
}

cleanupDuplicates().catch(console.error);
```

#### Files to Modify
- `/hub/src/db/schema.ts` (add index)
- `/hub/src/api/routes/journal.ts` (add upsert logic)
- `/hub/scripts/cleanup-duplicate-vault-pages.ts` (create new)

#### Testing Plan

**Cleanup:**
```bash
cd hub
bun run scripts/cleanup-duplicate-vault-pages.ts
# Should remove duplicate pages

curl http://localhost:3000/api/vault/pages | grep "Daily Review" | wc -l
# Should show reduced count
```

**Prevention Test:**
```bash
# Complete daily review twice in quick succession
curl -X POST http://localhost:3000/api/journal/daily-review/complete -d '...'
curl -X POST http://localhost:3000/api/journal/daily-review/complete -d '...'

# Check for duplicates
curl http://localhost:3000/api/vault/pages | grep "$(date +%Y-%m-%d)" | wc -l
# Should show 1, not 2
```

#### Rollback Plan
1. Remove unique index from schema
2. Revert journal route changes
3. Duplicates will resume but system functional

---

## Batch 3: Medium-Risk Fixes (Deploy with Comprehensive Testing)

Fixes that touch multiple components or have wider impact.

### FIX-006: Add CI/CD Pipeline

**Priority:** Medium
**Risk:** Low (new infrastructure, doesn't affect existing code)
**Estimated Effort:** 4-6 hours

#### Problem
No automated CI/CD checks for TypeScript compilation, tests, or builds.

#### Proposed Solution

**Step 1: Create GitHub Actions Workflow**

File: `/.github/workflows/ci.yml` (new)

```yaml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  typecheck:
    name: TypeScript Type Check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
        with:
          bun-version: latest
      - run: bun install
      - name: Hub Typecheck
        run: cd hub && bun run typecheck
      - name: Command Center Typecheck
        run: cd apps/command-center && bun run typecheck
      - name: Tasks Typecheck
        run: cd apps/tasks && bun run typecheck
      - name: Vault Typecheck
        run: cd apps/vault && bun run typecheck

  test:
    name: Run Tests
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - name: Run Hub Tests
        run: cd hub && bun run test
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/jd_agent_test
          REDIS_URL: redis://localhost:6379

  ios-build:
    name: iOS Build Check
    runs-on: macos-latest
    strategy:
      matrix:
        app: [jd-tasks-ios, jd-command-center-ios, vault-ios]
    steps:
      - uses: actions/checkout@v4
      - name: Install Dependencies
        run: cd apps/${{ matrix.app }} && xcodegen
      - name: Build
        run: |
          cd apps/${{ matrix.app }}
          xcodebuild build \
            -scheme JDTasks \
            -destination 'platform=iOS Simulator,name=iPhone 15' \
            CODE_SIGNING_ALLOWED=NO

  desktop-build:
    name: Desktop Build Check
    runs-on: macos-latest
    strategy:
      matrix:
        app: [command-center, tasks, vault]
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - uses: actions-rust-lang/setup-rust-toolchain@v1
      - name: Install Dependencies
        run: cd apps/${{ matrix.app }} && bun install
      - name: Build Frontend
        run: cd apps/${{ matrix.app }} && bun run build
      - name: Build Desktop App
        run: cd apps/${{ matrix.app }} && bun run tauri:build
```

**Step 2: Add Status Badge to README**

File: `/README.md`

Add at top:
```markdown
[![CI](https://github.com/[username]/jd-agent/actions/workflows/ci.yml/badge.svg)](https://github.com/[username]/jd-agent/actions/workflows/ci.yml)
```

#### Files to Create
- `/.github/workflows/ci.yml`

#### Testing Plan

Push to GitHub and verify all checks pass.

#### Rollback Plan
Delete `.github/workflows/ci.yml`.

---

## Batch 4: Higher-Risk Fixes (Deploy with Extra Caution)

Fixes that require architectural changes or have broad impact.

*No high-risk fixes identified in this audit.*

---

## Deferred: Needs More Analysis

### DEFER-001: Performance Optimization for Vault Pages API

**Issue:** Vault pages API returns full list without pagination.

**Why Deferred:**
- Need to measure actual performance impact with realistic data volumes
- Requires API contract change (affects all clients)
- Need to assess pagination strategy (cursor vs offset)

**Recommendation:**
Monitor API response times in production. Implement if response times exceed 500ms.

---

## Implementation Roadmap

### Week 1 (Immediate)
- ✅ FIX-001: TypeScript errors (Critical)
- ✅ FIX-002: Integration health reporting
- ✅ FIX-005: Duplicate vault pages

### Week 2-3
- FIX-003: iOS Tasks test suite (High priority)
- FIX-004: Centralize iOS configuration
- FIX-006: CI/CD pipeline

### Month 2
- ENH-001: iOS Command Center tests
- UX-001: Auto-discovery for iOS
- UX-002: Integration health visibility

### Ongoing
- Technical debt items as time permits
- Performance monitoring
- Documentation improvements

---

## Success Criteria

### Before Deployment
- [ ] All TypeScript errors resolved
- [ ] Integration health reporting accurate
- [ ] No duplicate vault pages created in testing
- [ ] CI/CD pipeline passing

### After Deployment
- [ ] No new errors in production logs
- [ ] API response times remain < 500ms
- [ ] iOS apps connect successfully
- [ ] User satisfaction maintained or improved

---

**End of Fix Proposals**
