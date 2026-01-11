# JD Agent Cleanup Priority List

**Created:** January 8, 2026
**Auditor:** Claude Opus 4.5
**Version:** 1.0

---

## Priority Definitions

| Priority | Definition | Response Time |
|----------|------------|---------------|
| **P0: Critical** | Must fix before any new work. System is broken or at risk. | Immediate |
| **P1: High** | Should fix in next sprint. Significant impact on productivity. | 1-2 weeks |
| **P2: Medium** | Important but not urgent. Plan to address in reasonable timeframe. | 2-4 weeks |
| **P3: Low** | Nice to have. Address when convenient. | Opportunistic |

---

## P0: Critical (Must Fix Before Proceeding)

### P0-1: Zero Unit Test Coverage

**Problem:** No unit tests exist for services, integrations, or packages.

**Files Affected:**
- `/hub/src/services/` (42 files, 0 tests)
- `/hub/src/integrations/` (14 files, 0 tests)
- `/packages/api-client/` (~50 files, 0 tests)
- `/packages/types/` (~162 files, 0 tests)

**Risk:** High - Business logic bugs go undetected until production.

**Action Required:**
1. Add Vitest to hub (`bun add -d vitest`)
2. Create first test file for `goals-service.ts`
3. Establish testing patterns
4. Set coverage threshold at 20% initially

**Effort:** 4-8 hours to establish foundation

---

### P0-2: Header Health Check Hardcoded

**Problem:** Online/offline status always shows "Online" regardless of actual system health.

**File:** `/apps/command-center/src/components/layout/Header.tsx:4`

**Current Code:**
```typescript
const isHealthy = true; // TODO: Connect to actual health check
```

**Risk:** Medium - Users see incorrect system status.

**Action Required:**
1. Create hook `useSystemHealth()` that polls `/api/health`
2. Replace hardcoded value with hook result
3. Add loading state while checking

**Effort:** 30-60 minutes

---

## P1: High (Should Fix In Next Sprint)

### P1-1: R2 File Upload Not Implemented

**Problem:** File attachments may not persist correctly.

**File:** `/hub/src/services/import-service.ts:288`

**Current Code:**
```typescript
// TODO: Upload to R2 and store path
```

**Risk:** High - User uploads may be lost.

**Action Required:**
1. Implement R2 upload using existing AWS SDK
2. Store file path in database
3. Add error handling for upload failures

**Effort:** 2-4 hours

---

### P1-2: Vector Search Not Implemented

**Problem:** Semantic search falls back to text search only.

**File:** `/hub/src/services/search-service.ts:89`

**Current Code:**
```typescript
// TODO: Implement vector search when embeddings are stored
```

**Risk:** Medium - Search quality is degraded.

**Action Required:**
1. Check if pgvector extension is enabled
2. Implement embedding comparison query
3. Combine with text search results

**Effort:** 4-6 hours

---

### P1-3: Search Modal Handlers Empty

**Problem:** Task completion and detail view from search don't work.

**Files:**
- `/apps/tasks/src/components/SearchModal.tsx:41` - `handleComplete`
- `/apps/tasks/src/components/SearchModal.tsx:99` - `onSelect`

**Current Code:**
```typescript
const handleComplete = (id: string) => {
  console.log('Complete:', id); // TODO: Implement complete
};
```

**Risk:** Medium - Users can search but not act on results.

**Action Required:**
1. Implement task completion API call
2. Add task detail navigation
3. Add loading states

**Effort:** 2-3 hours

---

### P1-4: Vault App Has No Tests

**Problem:** Complex knowledge base app is completely untested.

**Files:** `/apps/vault/src/` (28 components, 0 tests)

**Risk:** High - Document management bugs may corrupt user data.

**Action Required:**
1. Add Vitest to vault app
2. Create tests for critical components (editor, search, navigation)
3. Target 30% coverage initially

**Effort:** 8-12 hours

---

### P1-5: Tasks App Has No Tests

**Problem:** Core GTD workflow app is completely untested.

**Files:** `/apps/tasks/src/` (17 components, 0 tests)

**Risk:** High - Task management bugs affect daily workflow.

**Action Required:**
1. Add Vitest to tasks app
2. Create tests for InboxView, TodayView, task completion
3. Target 30% coverage initially

**Effort:** 6-8 hours

---

## P2: Medium (Important But Not Urgent)

### P2-1: Email Service Integration Missing

**Problem:** VIP pipeline cannot send email notifications.

**File:** `/hub/src/jobs/processors/vip.ts:1146`

**Current Code:**
```typescript
// TODO: Integrate with email service when available
```

**Risk:** Low - Notifications still work via Telegram.

**Action Required:**
1. Add Resend integration (already in dependencies)
2. Implement email template for VIP notifications
3. Add email as notification channel option

**Effort:** 2-3 hours

---

### P2-2: Debug Console Statements in Production

**Problem:** 7 console.log statements leak debug info.

**Files:**
- `/apps/vault/src/App.tsx:383,392`
- `/apps/tasks/src/components/SearchModal.tsx:42`
- `/apps/vault/src/components/VaultChat.tsx:108,140` (console.error - OK)
- `/apps/vault/src/App.tsx:106,144` (console.error - OK)

**Risk:** Low - Only affects developer console.

**Action Required:**
1. Remove debug console.log statements (3 instances)
2. Keep console.error for actual errors (4 instances are OK)

**Effort:** 15 minutes

---

### P2-3: Commented-Out Migration Code

**Problem:** Disabled code clutters migration file.

**File:** `/hub/src/migration/test-migration.ts:57-80`

**Content:**
```typescript
// Skip Google Drive - refresh token expired
// Skip Apple Notes - permission issues
```

**Risk:** Low - Code maintenance only.

**Action Required:**
1. Remove commented-out code
2. Add documentation for why these migrations are disabled
3. Or fix the underlying issues and re-enable

**Effort:** 30 minutes

---

### P2-4: API Client Has No Tests

**Problem:** HTTP layer has no validation.

**Files:** `/packages/api-client/` (~50 files, 0 tests)

**Risk:** Medium - API changes may break silently.

**Action Required:**
1. Add Vitest to api-client package
2. Create tests for critical methods
3. Add integration tests with mock server

**Effort:** 4-6 hours

---

### P2-5: Multiple Contract Files

**Problem:** Agents must read 3 files to understand all rules.

**Files:**
- `/CLAUDE.md`
- `/claude-code-prompt.md`
- `/FEATURES.md`

**Risk:** Low - Rules may be missed or inconsistently applied.

**Action Required:**
See [CONSOLIDATION_PLAN.md](./CONSOLIDATION_PLAN.md) Phase 2.

**Effort:** 4.5 hours

---

## P3: Low (Nice To Have)

### P3-1: Documentation Directory Structure Could Be Cleaner

**Problem:** PRDs and plans scattered across directories.

**Current:**
- `/docs/jd-agent-prd.md`
- `/docs/vault-restructuring-plan.md`
- `/docs/plans/`
- `/docs/internal/`

**Action Required:**
See [CONSOLIDATION_PLAN.md](./CONSOLIDATION_PLAN.md) Phase 3.

**Effort:** 2.25 hours

---

### P3-2: Implementation Plans Missing Roadmap Links

**Problem:** Hard to track plan status against roadmap.

**Files:**
- `/docs/plans/plaud-integration-prd-v3.0.md`
- `/docs/plans/llm-cost-optimization.md`
- `/docs/internal/goals-habits-implementation-plan.md`
- `/docs/vault-restructuring-plan.md`

**Action Required:**
Add frontmatter with roadmap item reference.

**Effort:** 1 hour

---

### P3-3: "Follow Existing Patterns" Rule is Vague

**Problem:** CLAUDE.md says "follow existing patterns" but no pattern guide exists.

**File:** `/CLAUDE.md`

**Action Required:**
1. Create PATTERNS.md documenting common patterns
2. Include: service structure, API route structure, component structure
3. Update CLAUDE.md to reference it

**Effort:** 2-3 hours

---

### P3-4: No Load Testing Infrastructure

**Problem:** No systematic load/stress testing.

**Files Affected:** All API endpoints

**Action Required:**
1. Add k6 or artillery for load testing
2. Create load test scripts for critical endpoints
3. Document performance baselines

**Effort:** 4-6 hours

---

### P3-5: No API Documentation (OpenAPI)

**Problem:** API endpoints not documented in standard format.

**Files:** `/hub/src/api/routes/` (39 files)

**Action Required:**
1. Add hono-openapi or similar
2. Generate OpenAPI spec from routes
3. Add Swagger UI endpoint

**Effort:** 4-8 hours

---

## Summary by Priority

| Priority | Count | Total Effort |
|----------|-------|--------------|
| P0: Critical | 2 | 5-9 hours |
| P1: High | 5 | 22-33 hours |
| P2: Medium | 5 | 11-15 hours |
| P3: Low | 5 | 13-20 hours |
| **Total** | **17** | **51-77 hours** |

---

## Recommended Sprint Plan

### Sprint 1 (Week 1): Foundation
- [ ] P0-1: Add Vitest, first unit tests (4-8h)
- [ ] P0-2: Fix Header health check (1h)
- [ ] P2-2: Remove debug console.log (15m)
- [ ] P2-3: Clean up migration code (30m)

### Sprint 2 (Week 2): Core Features
- [ ] P1-1: R2 file upload (4h)
- [ ] P1-2: Vector search (6h)
- [ ] P1-3: Search modal handlers (3h)

### Sprint 3 (Week 3): Test Coverage
- [ ] P1-4: Vault app tests (12h)
- [ ] P1-5: Tasks app tests (8h)

### Sprint 4 (Week 4): Polish
- [ ] P2-1: Email integration (3h)
- [ ] P2-4: API client tests (6h)
- [ ] P2-5: Contract consolidation (4.5h)

---

*Generated by Claude Opus 4.5 Audit Agent*
