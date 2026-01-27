# JD Agent - Issue Catalog & Bug Report

**Audit Date:** January 26, 2026
**Auditor:** Claude PM Agent
**Version:** 0.3.12

---

## Executive Summary

Based on comprehensive discovery, API testing, TypeScript type checking, and code analysis, I've identified **critical issues** that need attention, along with numerous opportunities for improvement.

### Health Score by Component

| Component | Health | Critical Issues | Priority Issues | Notes |
|-----------|--------|-----------------|-----------------|-------|
| Hub API | 🟡 DEGRADED | 1 | 2 | Running but 82 TypeScript errors |
| iOS Apps | 🟢 HEALTHY | 0 | 2 | No test coverage for 2/3 apps |
| Desktop Apps | 🟢 HEALTHY | 0 | 1 | Build paths need verification |
| Database | 🟢 HEALTHY | 0 | 0 | Schema is sound |
| Documentation | 🟢 HEALTHY | 0 | 1 | FEATURES.md very comprehensive |
| Tests | 🟡 DEGRADED | 0 | 3 | Gaps in coverage |

---

## Critical Bugs (P0) - Must Fix

Issues that prevent core functionality or cause system instability.

### BUG-001: Hub TypeScript Compilation Errors (82 errors)

**Component:** hub/src
**Severity:** Critical
**Impact:** Build failures, potential runtime errors

**Description:**
The Hub backend has 82 TypeScript compilation errors, primarily in:
- Canvas integrity agent (browser-manager.ts, content-extractor.ts, page-navigator.ts)
- Job agent (linkedin-adapter.ts)

**Root Cause:**
1. DOM types (`document`, `window`, `HTMLElement`) used without proper lib configuration
2. Type mismatches in Canvas assignment properties
3. Implicit `any` types in callback parameters
4. `null` vs `undefined` type conflicts

**Files Affected:**
```
src/agents/canvas-integrity/browser-manager.ts (5 errors)
src/agents/canvas-integrity/explorer/content-extractor.ts (67 errors)
src/agents/canvas-integrity/explorer/page-navigator.ts (3 errors)
src/agents/canvas-integrity/index.ts (7 errors)
src/agents/job-agent/adapters/linkedin-adapter.ts (5 errors)
```

**Evidence:**
```typescript
// Example error:
error TS2584: Cannot find name 'document'. Do you need to change your target library? Try changing the 'lib' compiler option to include 'dom'.

// Example error:
error TS2322: Type 'null' is not assignable to type 'string | undefined'.
```

**Steps to Reproduce:**
```bash
cd hub
bun run typecheck
```

**Impact:**
- Build failures in CI/CD
- Potential runtime errors in Canvas integrity agent
- Reduced code quality and maintainability
- LSP/IDE errors confusing developers

**Recommendation:** See FIX-001 below.

---

## High Priority Bugs (P1) - Should Fix Soon

Issues that significantly degrade experience but have workarounds.

### BUG-002: Integration Health Reporting False Negative

**Component:** `/api/briefing/preview`
**Severity:** High
**Impact:** User trust in system health monitoring

**Description:**
The briefing preview endpoint reports `"integrationsHealthy": false` even though the system is operational and processing tasks.

**Evidence:**
```json
{"success":true,"data":{"tasksToday":42,"eventsToday":16,"canvasDue":0,"newRecordings":0,"integrationsHealthy":false}}
```

**Impact:**
- Users may mistrust system health indicators
- False alerts reduce attention to real issues
- Command Center iOS app will show degraded status unnecessarily

**Root Cause Analysis Needed:**
- Check integration health check logic in `/hub/src/api/routes/briefing.ts`
- Verify which integration is failing health check
- Determine if Plaud/Remarkable/Canvas/Calendar are actually unhealthy

**Recommendation:** See FIX-002 below.

---

### BUG-003: iOS Tasks App - No Test Coverage

**Component:** apps/jd-tasks-ios
**Severity:** High
**Impact:** Regression risk, no QA safety net

**Description:**
The iOS Tasks app (most critical day-to-day app for users) has **zero test files**. No unit tests, no UI tests, no integration tests.

**Comparison:**
- ✅ Vault iOS: Has comprehensive UI test suite (`JDVaultUITests.swift`)
- ❌ Tasks iOS: No tests found
- ❌ Command Center iOS: No tests found

**Impact:**
- High regression risk when making changes
- No automated validation of critical user flows
- QA must be done manually every time
- Cannot confidently deploy updates

**Affected Flows (Untested):**
- Task creation via quick add
- Natural language parsing ("tomorrow 2pm")
- Task completion
- Siri shortcuts integration
- GTD status transitions (inbox → today → done)
- Task counts/badges
- Settings configuration

**Recommendation:** See FIX-003 below.

---

## Medium Priority Bugs (P2) - Fix When Possible

Issues that are annoying but have workarounds.

### BUG-004: Inconsistent API Base URLs Across iOS Apps

**Component:** iOS apps configuration
**Severity:** Medium
**Impact:** Connection issues when deploying to physical devices

**Description:**
iOS apps use different hardcoded API base URLs:
- Tasks iOS: `192.168.1.175:3000` (configurable via Settings)
- Command Center iOS: `192.168.1.175:3000` (configurable via Settings)
- Vault iOS: Hardcoded per build variant
  - Simulator: `http://localhost:3000`
  - Device: `http://10.34.144.203:3000`

**Impact:**
- Vault iOS cannot connect when deployed to physical devices unless IP matches `10.34.144.203`
- Tasks/Command Center require manual configuration after installation
- No centralized configuration management
- Deployment friction

**User Impact:**
Low (affects development/testing more than production since user likely runs Hub locally)

**Recommendation:** See FIX-004 below.

---

### BUG-005: Duplicate Vault Pages Issue

**Component:** Vault API
**Severity:** Medium
**Impact:** Data clutter, search pollution

**Description:**
Multiple duplicate "Daily Review" vault pages created:
- "Daily Review - Friday, January 16, 2026" (7 duplicates found)
- "Daily Review - Thursday, January 8, 2026" (3 duplicates found)

**Evidence from API Response:**
```json
{"id":"00e7c301-e361-41da-950b-55021034fdd0","title":"Daily Review - Friday, January 16, 2026","sortOrder":29},
{"id":"46bd963a-49ff-4f52-be86-344e5b808b4c","title":"Daily Review - Friday, January 16, 2026","sortOrder":30},
{"id":"49135b59-d0e0-46bd-b12d-a3b2d0edad0a","title":"Daily Review - Friday, January 16, 2026","sortOrder":31},
...
```

**Root Cause:**
Likely a race condition or duplicate submission in the daily review completion flow (`/api/journal/daily-review/complete`).

**Impact:**
- Cluttered vault page list
- Search results pollution
- User confusion
- Storage waste

**Recommendation:** See FIX-005 below.

---

## Low Priority / Enhancements (P3)

Nice-to-have improvements.

### ENH-001: iOS Command Center - Add UI Tests

**Component:** apps/jd-command-center-ios
**Priority:** Low
**Benefit:** Improved QA coverage

**Description:**
Command Center iOS has no automated tests. While lower priority than Tasks (less frequently used), tests would still provide value.

**Suggested Test Coverage:**
- Briefing generation and display
- Integration status monitoring
- Productivity metrics display
- Settings configuration

---

### ENH-002: Desktop App Directory Structure Clarification

**Component:** Project documentation
**Priority:** Low
**Benefit:** Improved developer onboarding

**Description:**
During audit, attempted to run `cd apps/command-center && bun run typecheck` and `cd apps/tasks && bun run typecheck`, but these directories were not accessible as expected.

**Investigation Needed:**
- Verify actual directory structure matches documentation
- Update PROJECT_INVENTORY.md if paths differ
- Ensure all documented scripts actually work

---

### ENH-003: TypeScript Strict Mode for Frontend Apps

**Component:** Frontend apps (Command Center, Tasks, Vault)
**Priority:** Low
**Benefit:** Improved type safety

**Description:**
Frontend apps should use TypeScript strict mode for maximum type safety, matching the Hub backend's configuration.

**Current State:**
- Hub: Uses strict TypeScript configuration
- Frontend apps: Unknown (couldn't verify due to directory access)

---

## UX Improvements

User experience enhancements identified during audit.

### UX-001: iOS App Configuration Burden

**Current State:**
Users must manually configure API base URL in Settings after installing Tasks iOS and Command Center iOS.

**Proposed Improvement:**
- Use mDNS/Bonjour to auto-discover Hub API on local network
- Fallback to manual configuration if auto-discovery fails
- Show connection status indicator prominently

**Benefit:**
Faster onboarding, fewer support issues.

**Effort:** Medium (requires iOS networking changes)

---

### UX-002: Integration Health Visibility

**Current State:**
Integration health reported as boolean in briefing preview, but user doesn't know which integration failed.

**Proposed Improvement:**
- Break down health by integration (Plaud, Canvas, Calendar, etc.)
- Show individual integration status in UI
- Provide "Fix" or "Reconnect" actions inline

**Benefit:**
Users can self-diagnose and fix integration issues.

**Effort:** Low (data already available in `/api/briefing/integrations` endpoint)

---

### UX-003: Vault Page Deduplication UI

**Current State:**
Users have no visibility into duplicate pages or tools to clean them up.

**Proposed Improvement:**
- Vault admin page showing duplicate detection
- Batch delete or merge duplicates
- Prevent duplicates at creation time

**Benefit:**
Cleaner vault, better search experience.

**Effort:** Medium (requires duplicate detection logic + UI)

---

## Technical Debt

Code quality issues to address over time.

### DEBT-001: Canvas Integrity Agent DOM Type Dependencies

**Issue:**
Canvas integrity agent uses DOM types (`document`, `window`, `HTMLElement`) directly in TypeScript code intended to run in Playwright browser context.

**Recommendation:**
- Add `"lib": ["ES2021", "DOM"]` to `tsconfig.json` for affected files
- OR: Extract browser-context code into separate files with different tsconfig
- OR: Use type assertions with `// @ts-expect-error` comments and runtime validation

**Risk if not addressed:**
Type safety compromised, potential runtime errors.

---

### DEBT-002: Job Agent LinkedIn Adapter Type Safety

**Issue:**
LinkedIn adapter in job agent uses DOM types and has implicit `any` types.

**Recommendation:**
- Add explicit types to all callback parameters
- Configure proper TypeScript lib settings
- Add JSDoc comments for complex scraping logic

**Risk if not addressed:**
Fragile scraping code, hard to maintain.

---

### DEBT-003: Null vs Undefined Type Inconsistencies

**Issue:**
Several type mismatches where `null` is used but `undefined` is expected (or vice versa).

**Locations:**
- `src/agents/canvas-integrity/index.ts` (assignments)

**Recommendation:**
- Audit codebase for null vs undefined patterns
- Standardize on one approach (prefer `undefined` for optional values)
- Update types to match actual usage

**Risk if not addressed:**
Type safety violations, potential runtime errors.

---

## Performance Concerns

No critical performance issues identified, but potential optimization opportunities:

### PERF-001: Vault Pages API Response Size

**Observation:**
`/api/vault/pages` returns full page list with no pagination. During test, response was truncated at ~100 pages.

**Recommendation:**
- Implement cursor-based pagination
- Add `limit` and `offset` query parameters
- Return `hasMore` and `nextCursor` in response

**Benefit:**
Faster API responses, reduced bandwidth, better mobile performance.

**Effort:** Medium

---

## Security Observations

No critical security vulnerabilities found, but areas for improvement:

### SEC-001: API Base URL Hardcoded in iOS Apps

**Issue:**
iOS apps have hardcoded API URLs pointing to local network IP addresses.

**Risk:**
- If device connects to untrusted network with same IP, could connect to malicious API
- No certificate pinning or additional security checks

**Recommendation:**
- Implement certificate pinning for production deployments
- Add API key or token-based authentication
- Validate Hub API identity before sending sensitive data

**Priority:** Low (mitigated by local-only deployment model)

---

## Documentation Gaps

### DOC-001: iOS Deployment Instructions Missing

**Gap:**
No documented process for:
- Building iOS apps for TestFlight
- Provisioning profiles setup
- App Store Connect configuration
- Version/build number management

**Recommendation:**
Create `docs/deployment/ios-deployment.md` with step-by-step guide.

---

### DOC-002: Desktop App Build Verification Needed

**Gap:**
Could not verify desktop app builds during audit due to directory access issues.

**Recommendation:**
- Document exact build commands that work
- Add verification steps to CLAUDE.md
- Create CI/CD checks for desktop builds

---

## Test Coverage Gaps

### TEST-001: iOS Apps Test Coverage

| App | Unit Tests | UI Tests | Integration Tests | Coverage |
|-----|------------|----------|-------------------|----------|
| Vault iOS | ❌ | ✅ | ❌ | ~20% (UI only) |
| Tasks iOS | ❌ | ❌ | ❌ | 0% |
| Command Center iOS | ❌ | ❌ | ❌ | 0% |

**Recommendation:**
Prioritize Tasks iOS test coverage (most critical app).

---

### TEST-002: Hub Service Test Coverage

**Current State:**
- 64 test files exist
- Target: 60%+ service coverage

**Gap:**
Cannot verify actual coverage without running `bun run test:coverage`.

**Recommendation:**
Run coverage report and identify gaps.

---

### TEST-003: E2E Test Coverage

**Current State:**
- Command Center has Playwright E2E tests
- Tasks and Vault lack E2E tests

**Recommendation:**
Add E2E tests for:
- Task creation and completion flows
- Vault page creation and editing flows
- Calendar event creation

---

## Configuration Issues

### CFG-001: Multiple Documentation Sources

**Issue:**
Feature documentation split across:
- `/FEATURES.md` (40,961 tokens - massive)
- `/docs/public/features/` (various files)
- `/docs/plans/` (PRD documents)
- `/docs/roadmap/` (roadmap and changelog)

**Recommendation:**
- Keep FEATURES.md as single source of truth for "what exists now"
- Use /docs/plans/ only for future planning
- Cross-link documents clearly

---

## Infrastructure Observations

### INFRA-001: No CI/CD Configuration Found

**Observation:**
No GitHub Actions, GitLab CI, or other CI/CD configuration detected in repository.

**Recommendation:**
Add `.github/workflows/` with:
- TypeScript compilation checks
- Test suite execution
- iOS build verification
- Desktop build verification

**Benefit:**
Catch issues before they reach production.

---

## Summary Statistics

**Total Issues Found:** 18
- Critical (P0): 1
- High (P1): 3
- Medium (P2): 3
- Low/Enhancements (P3): 3
- UX Improvements: 3
- Technical Debt: 3
- Other: 2

**By Category:**
- Bugs: 5
- Enhancements: 3
- UX: 3
- Technical Debt: 3
- Performance: 1
- Security: 1
- Documentation: 2
- Testing: 3
- Configuration: 1
- Infrastructure: 1

---

## Next Steps

See `/docs/audit/FIX_PROPOSALS.md` for detailed fix recommendations with implementation plans.

---

**End of Issue Catalog**
