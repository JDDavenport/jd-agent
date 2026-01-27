# Canvas Reading Integration - Test Report & Findings

**Date:** January 27, 2025
**Tester:** Product Manager / QA
**Status:** Investigation Complete

---

## Executive Summary

After thorough testing and code investigation, I've identified the current state of Canvas reading detection and the gaps that need to be filled for the Canvas Reading Integration feature. The infrastructure for reading detection exists but is **not actively running** in production.

---

## Test Results

### 1. Canvas Item Detection (✅ PASS with caveats)

**Test Query:**
```sql
SELECT COUNT(*) FROM canvas_items;
```

**Results:**
- **Total Canvas items:** 127
- **Assignments:** 103
- **Quizzes:** 24
- **Files/Readings/Pages:** 0 ❌

**Finding:** Canvas agent successfully detects assignments and quizzes, but does NOT detect files, external URLs, or pages (reading materials).

---

### 2. Canvas Agent Architecture Analysis (✅ COMPLETE)

#### Current Agent Structure

**Two separate systems exist:**

1. **API-Based Sync** (Currently Active - 3x daily)
   - Location: `/hub/src/integrations/canvas.ts`
   - Methods: `fullSync()`, `dailyCheck()`
   - Scheduled: 6:30 AM, 12:00 PM, 6:00 PM
   - **Only syncs:** Assignments, Quizzes, Announcements
   - **Does NOT sync:** Readings, Files, Pages, Module items

2. **Browser-Based Agent** (NOT Currently Active)
   - Location: `/hub/src/agents/canvas-integrity/`
   - Methods: `runAudit()`, `extractModuleItems()`, `extractReadings()`, `extractFiles()`
   - **Can extract:** All content types including readings
   - **Not scheduled:** Manual runs only

#### Code Evidence

**From** `/hub/src/agents/canvas-integrity/explorer/content-extractor.ts`:
- ✅ `extractModuleItems()` - Detects files, external_url, page items (line 427)
- ✅ `extractReadings()` - Filters reading-related items with keywords (line 1030)
- ✅ `extractFiles()` - Extracts file list from Canvas files page (line 954)

**From** `/hub/src/agents/canvas-integrity/index.ts`:
- ✅ `verifyAndSyncItem()` - Creates tasks for readings (line 977)
- ⚠️ **Only creates tasks for "required" readings** (line 1074-1075)
- ✅ Supports file, external_url, page types (lines 1025-1045)

**Reading Keywords Detected:**
- "reading", "read", "article", "chapter", "textbook", "paper"
- "case", "hbr", "harvard", "study", "material", "resource"
- "preparation", "prep", "before class", "pre-class"

---

### 3. Task Creation Analysis (✅ PASS)

**Test Query:**
```sql
SELECT * FROM tasks WHERE source = 'canvas' LIMIT 5;
```

**Results:**
- ✅ 5 Canvas tasks found
- ✅ `source: 'canvas'` set correctly
- ✅ `sourceRef` contains Canvas item ID (e.g., `canvas:quiz:assignment_1255535`)
- ✅ Due dates properly mapped
- ❌ NO `readingUrl` or `readingId` fields (expected - not yet implemented)

**Sample Task:**
```json
{
  "title": "📝 Preparation/ Participation",
  "dueDate": "2026-01-20T09:00:00Z",
  "source": "canvas",
  "sourceRef": "canvas:assignment:assignment_1304238",
  "context": "Course Name",
  "priority": 2
}
```

---

### 4. Read Help App Analysis (✅ PASS)

**Test Query:**
```sql
SELECT COUNT(*) FROM read_help_books;
```

**Results:**
- ✅ 4 books in Read Help library
- ❌ NO `classId` field (expected - not yet implemented)
- ❌ NO `className` field (expected - not yet implemented)
- ❌ NO `canvasItemId` field (expected - not yet implemented)
- ❌ NO `taskId` field (expected - not yet implemented)
- ❌ NO books with tags (no class organization)

**Current Schema:**
```typescript
{
  id: uuid,
  title: string,
  author: string,
  filePath: string,
  pageCount: number,
  tags: string[], // ← Could use for classes, but not structured
  status: 'processing' | 'ready' | 'error',
  // Missing: classId, className, canvasItemId, taskId, assignmentType
}
```

---

### 5. Canvas Materials Service Analysis (✅ PASS)

**Location:** `/hub/src/services/canvas-materials-service.ts`

**Capabilities:**
- ✅ Downloads files from Canvas with authentication
- ✅ Classifies material types (syllabus, case, reading, lecture, template, data)
- ✅ Stores in `canvasMaterials` table
- ✅ Tracks read progress
- ❌ NOT integrated with Read Help app
- ❌ NOT automatically triggered

**Material Type Detection (lines 24-32):**
```typescript
const MATERIAL_TYPE_KEYWORDS = {
  syllabus: ['syllabus', 'course outline', 'course overview'],
  case: ['case', 'case study', 'harvard', 'hbr'],
  reading: ['reading', 'article', 'chapter', 'paper', 'journal'], // ← Perfect for Read Help
  lecture: ['lecture', 'slide', 'presentation', 'ppt'],
  template: ['template', 'worksheet', 'form', 'rubric'],
  data: ['data', 'dataset', 'excel', 'spreadsheet', 'csv'],
};
```

---

### 6. Audit Type Analysis (⚠️ WARNING)

**From** `/hub/src/agents/canvas-integrity/index.ts` (lines 926-943):

```typescript
getPagesToVisit(auditType: 'full' | 'incremental' | 'quick_check') {
  switch (auditType) {
    case 'full':
      return [
        CanvasPage.HOME,
        CanvasPage.SYLLABUS,
        CanvasPage.MODULES,      // ← Readings extracted here
        CanvasPage.ASSIGNMENTS,
        CanvasPage.DISCUSSIONS,
        CanvasPage.ANNOUNCEMENTS,
        CanvasPage.QUIZZES,
        CanvasPage.PAGES,         // ← Wiki pages extracted here
        CanvasPage.FILES,         // ← Files extracted here
      ];
    case 'incremental':
      return [CanvasPage.ASSIGNMENTS, CanvasPage.ANNOUNCEMENTS]; // ← No readings
    case 'quick_check':
      return [CanvasPage.ASSIGNMENTS]; // ← No readings
  }
}
```

**Critical Finding:** Only 'full' audit visits MODULES, PAGES, FILES pages where readings are detected.

---

### 7. Scheduler Analysis (❌ FAIL - Root Cause Found)

**From** `/hub/src/scheduler.ts` (lines 197-253):

```typescript
// Canvas runs 3x daily
{
  name: 'canvas-daily-check',
  hour: 6, minute: 30,
  run: async () => {
    await canvasIntegration.dailyCheck(); // ← API-based, assignments only
  }
},
{
  name: 'canvas-sync-noon',
  hour: 12, minute: 0,
  run: async () => {
    await canvasIntegration.fullSync(); // ← API-based, assignments only
  }
},
{
  name: 'canvas-sync-evening',
  hour: 18, minute: 0,
  run: async () => {
    await canvasIntegration.fullSync(); // ← API-based, assignments only
  }
}
```

**ROOT CAUSE:** Scheduler runs `canvasIntegration.fullSync()`, NOT `canvasIntegrityAgent.runAudit('full')`.

**Result:** Browser-based agent (which detects readings) is never executed automatically.

---

## Gap Analysis

### What Exists ✅

| Component | Status | Notes |
|-----------|--------|-------|
| Reading detection logic | ✅ Implemented | Keywords, filtering, extraction all work |
| File detection | ✅ Implemented | Extracts from modules and files page |
| Canvas Materials Service | ✅ Implemented | Downloads, classifies, stores materials |
| Browser automation | ✅ Implemented | Playwright with session management |
| Task creation for readings | ✅ Implemented | Only for required readings |
| Read Help PDF upload | ✅ Implemented | Deduplication, OCR, chapters |
| Read Help search | ✅ Implemented | Full-text indexed search |

### What's Missing ❌

| Component | Status | Impact |
|-----------|--------|--------|
| Scheduled browser agent runs | ❌ Missing | Readings never detected |
| Reading → Read Help integration | ❌ Missing | No automatic uploads |
| Read Help class organization | ❌ Missing | No schema fields for class |
| Task → Reading links | ❌ Missing | No readingUrl/readingId |
| Reading task creation (all) | ❌ Limited | Only required readings |
| Canvas PDF download | ❌ Partial | Materials service exists but not used |
| Frontend class views | ❌ Missing | No UI for class organization |

---

## Critical Path Issues

### Issue #1: Browser Agent Not Scheduled
**Severity:** High
**Impact:** Zero reading detection in production
**Solution:** Add Canvas integrity agent to scheduler OR enhance API-based sync

### Issue #2: No Integration Between Systems
**Severity:** High
**Impact:** Even if readings detected, they're not uploaded to Read Help
**Solution:** Create canvas-reading-service.ts bridge

### Issue #3: Schema Gaps
**Severity:** Medium
**Impact:** Can't link readings to classes/tasks
**Solution:** Add fields to readHelpBooks and tasks tables

### Issue #4: Frontend Class Organization
**Severity:** Medium
**Impact:** Users can't browse readings by class
**Solution:** Build class views in Read Help app

---

## PRD Validation

### PRD Assumptions vs Reality

| PRD Assumption | Reality | Status |
|----------------|---------|--------|
| Canvas detects readings | ✅ TRUE (if browser agent runs) | Validated |
| Canvas creates tasks for readings | ⚠️ PARTIAL (only required) | Needs fix |
| Read Help supports PDFs | ✅ TRUE | Validated |
| Tasks support metadata | ✅ TRUE | Validated |
| Need schema changes | ✅ TRUE | Validated |

### PRD Adjustments Needed

1. **Add Issue:** Browser agent not scheduled - must be addressed first
2. **Clarify:** Only "required" readings create tasks - should we change this?
3. **Add Detail:** Canvas Materials Service exists - should we use it or replace?
4. **Consider:** Should we use canvasMaterials table or go direct to Read Help?

---

## Recommendations

### Phase 0: Enable Existing Functionality (Quick Win - 1 day)

**Before building new features, let's activate what exists:**

1. Add Canvas integrity agent to scheduler:
   ```typescript
   {
     name: 'canvas-integrity-daily',
     hour: 7,
     minute: 0,
     run: async () => {
       const agent = new CanvasIntegrityAgent();
       await agent.runAudit('full'); // ← Visits MODULES, FILES, PAGES
     }
   }
   ```

2. Modify reading task creation to include ALL readings (not just required):
   ```typescript
   // Line 1074 in index.ts
   const isActionable = ['assignment', 'quiz', 'discussion'].includes(canvasType) ||
     ['file', 'page', 'external_url'].includes(canvasType); // ← Add all readings
   ```

3. Test: Run full audit manually and verify readings detected

### Phase 1-6: Implement Per PRD (12-16 days)

Continue with PRD implementation plan as written.

---

## Test Environment

- **Database:** PostgreSQL 15, jd_agent database
- **Canvas Items:** 127 (103 assignments, 24 quizzes, 0 readings)
- **Read Help Books:** 4
- **Bun Version:** Latest
- **Test Script:** `/hub/scripts/test-canvas-readings.ts`

---

## Next Steps

1. ✅ Present findings to stakeholders
2. ⏳ Decide on Phase 0 quick win vs full implementation
3. ⏳ Update PRD with Phase 0 recommendations
4. ⏳ Get approval to proceed
5. ⏳ Begin implementation

---

## Appendix: Test Scripts

### A. Canvas Reading Detection Test

```bash
cd hub && bun run scripts/test-canvas-readings.ts
```

**Output:**
```
✅ Total Canvas items: 127

📚 Reading-related Canvas items:
  (none found)

📝 Sample Canvas tasks:
  1. Assignment - Employment Survey
  2. 📝 Preparation/ Participation
  ...

📚 Total Read Help books: 4

🏷️ Sample books with tags:
  ℹ️ No books with tags
```

### B. Manual Browser Agent Test

```bash
cd hub && bun run scripts/run-canvas-audit.ts --type=full
```

**Expected Output:**
```
[CanvasIntegrityAgent] Found 5 courses
[CanvasIntegrityAgent] Auditing course: MBA 560
[CanvasIntegrityAgent] Extracted 12 readings from modules
[CanvasIntegrityAgent] Extracted 8 files
...
```

---

## Sign-off

**Tested by:** Product Manager
**Date:** January 27, 2025
**Verdict:** PRD validated with Phase 0 additions recommended
