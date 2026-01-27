# Canvas Reading Assignment Integration - Product Requirements Document

**Status:** Ready for Implementation
**Created:** January 27, 2025
**Owner:** Product Team
**Priority:** High

---

## Executive Summary

Integrate Canvas reading assignments with the Read Help app to automatically upload PDFs/readings to a class-organized library and create tasks with direct links to reading materials. This eliminates manual upload friction and creates a seamless flow from Canvas → Task → Reading Helper.

---

## Problem Statement

### Current Pain Points

1. **Manual Upload Friction:** When Canvas has reading assignments (PDFs, articles, cases), users must:
   - Download from Canvas manually
   - Upload to Read Help app manually
   - Create tasks manually
   - Remember which task corresponds to which reading

2. **No Class Organization:** Read Help app treats all books/readings as a flat library with no course-level organization

3. **Broken Task→Reading Flow:** Tasks created by Canvas agent don't link to actual reading materials in Read Help app

4. **Redundant Data Entry:** Course information exists in Canvas but isn't propagated to Read Help

### Impact

- **Time Waste:** 5-10 minutes per reading assignment for manual transfers
- **Cognitive Load:** Context switching between Canvas, tasks, and reading helper
- **Missing Readings:** Easy to forget to upload readings before they're due
- **Poor Study Experience:** Can't quickly jump from task to reading material

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Auto-upload success rate | >95% | Successful PDF uploads / total readings detected |
| Task→Reading link accuracy | 100% | Tasks with correct reading links / total reading tasks |
| Time saved per reading | 5+ minutes | User testing & time tracking |
| Reading completion rate | +30% | Readings read / readings assigned (before vs after) |
| User satisfaction | 4.5/5 | Post-implementation survey |

---

## User Stories

### Primary Stories

**As a student**, I want Canvas readings to automatically appear in Read Help organized by class, so I don't have to manually download and upload PDFs.

**As a task manager user**, I want reading tasks to link directly to the reading material in Read Help, so I can click through from my task list to start reading immediately.

**As a Read Help user**, I want my readings organized by course/class, so I can easily find materials for a specific class.

**As a busy student**, I want to be reminded to read assignments before they're due, so I don't fall behind on course material.

### Edge Cases

- **Unsupported file types:** Canvas reading is not a PDF (e.g., external article link)
- **Duplicate detection:** Same reading assigned in multiple courses
- **File access:** PDF requires Canvas login to download
- **Large files:** 100+ page case study packets
- **OCR requirements:** Scanned PDFs needing text extraction

---

## Solution Overview

### High-Level Architecture

```
┌─────────────────┐
│   Canvas LMS    │
│  (API + Browser)│
└────────┬────────┘
         │
         │ 1. Detect reading assignments
         │    (modules with PDFs, files, external_url)
         │
         v
┌────────────────────────────────────────────────┐
│        Canvas Integrity Agent                  │
│  - extractReadings() (EXISTING)                │
│  - extractFiles() (EXISTING)                   │
│  - NEW: detectReadingAssignments()             │
│  - NEW: downloadCanvasPDF()                    │
└────────┬───────────────────────────────────────┘
         │
         │ 2. For each reading:
         │    a) Download PDF from Canvas
         │    b) Upload to Read Help with class context
         │    c) Create task with reading link
         │
         v
┌────────────────────────────────────────────────┐
│           Read Help Service                    │
│  - NEW: uploadFromCanvas()                     │
│  - NEW: addClassMetadata()                     │
│  - NEW: linkToTask()                           │
└────────┬───────────────────────────────────────┘
         │
         │ 3. Store reading with class info
         │
         v
┌────────────────────────────────────────────────┐
│         Read Help Database                     │
│  readHelpBooks                                 │
│  + classId (NEW)                               │
│  + className (NEW)                             │
│  + canvasItemId (NEW)                          │
│  + taskId (NEW)                                │
└────────┬───────────────────────────────────────┘
         │
         │ 4. Return reading link
         │
         v
┌────────────────────────────────────────────────┐
│            Task Service                        │
│  tasks table                                   │
│  + readingUrl (NEW) - link to Read Help        │
│  + readingId (NEW) - readHelpBooks.id          │
└────────────────────────────────────────────────┘
```

### Data Flow

1. **Canvas Detection** (Every 2 hours)
   - Canvas agent runs integrity check
   - Detects module items with type: `file` (PDF) or `external_url` (article)
   - Filters for reading-related keywords in title/description
   - Stores in `canvasItems` with `canvasType: 'file'`

2. **PDF Download** (New)
   - Agent downloads PDF from Canvas using authenticated session
   - Stores temporarily in `/storage/canvas/readings/{canvasId}.pdf`
   - Validates file size (<100MB) and type (PDF)

3. **Read Help Upload** (New)
   - Calls Read Help API with PDF + metadata:
     - `title`: Reading title from Canvas
     - `author`: Course instructor or "Unknown"
     - `tags`: [courseName, "canvas", assignmentType]
     - `classId`: Canvas course ID
     - `className`: Course name
     - `canvasItemId`: Canvas item ID
   - Read Help processes PDF (OCR if needed, chapter detection, indexing)

4. **Task Creation** (Enhanced)
   - Canvas agent creates task for reading
   - Task includes:
     - `title`: "Read: [Reading Title]"
     - `description`: Reading description + word count + estimated time
     - `dueDate`: Canvas due date
     - `source`: 'canvas'
     - `sourceRef`: Canvas item ID
     - `readingUrl`: `/books/{readHelpBookId}` (NEW)
     - `readingId`: Read Help book UUID (NEW)
     - `priority`: Based on due date proximity
     - `timeEstimateMinutes`: Based on page count

5. **Task Display** (Enhanced)
   - Tasks app shows "Open Reading" button if `readingUrl` exists
   - Command center shows reading preview in assignment detail
   - Click opens Read Help app to specific book/chapter

---

## Technical Requirements

### Database Schema Changes

#### 1. Read Help Books Table Enhancement

```sql
-- Add columns to readHelpBooks table
ALTER TABLE "readHelpBooks" ADD COLUMN "classId" text;
ALTER TABLE "readHelpBooks" ADD COLUMN "className" text;
ALTER TABLE "readHelpBooks" ADD COLUMN "canvasItemId" text;
ALTER TABLE "readHelpBooks" ADD COLUMN "taskId" uuid REFERENCES tasks(id);
ALTER TABLE "readHelpBooks" ADD COLUMN "assignmentType" text; -- reading, case, textbook, article
CREATE INDEX idx_read_help_books_class ON "readHelpBooks"(classId);
CREATE INDEX idx_read_help_books_canvas_item ON "readHelpBooks"(canvasItemId);
```

#### 2. Tasks Table Enhancement

```sql
-- Add columns to tasks table
ALTER TABLE "tasks" ADD COLUMN "readingUrl" text;
ALTER TABLE "tasks" ADD COLUMN "readingId" uuid REFERENCES "readHelpBooks"(id);
CREATE INDEX idx_tasks_reading ON tasks(readingId);
```

#### 3. Canvas Items Enhancement (Already has most fields)

```sql
-- Verify canvasItems has needed fields (should already exist)
-- materialType: 'reading' | 'case' | 'textbook' | 'article'
-- downloadUrl, localPath, fileType
```

### API Endpoints

#### New Endpoints

**Canvas Integration:**
- `POST /api/canvas-integrity/readings/:id/process` - Download and upload reading to Read Help
- `GET /api/canvas-integrity/readings/:id/status` - Check processing status

**Read Help:**
- `POST /api/read-help/books/from-canvas` - Upload book from Canvas with class metadata
- `GET /api/read-help/books?classId=:id` - Filter books by class
- `GET /api/read-help/classes` - Get list of classes with book counts

**Tasks:**
- `GET /api/tasks/:id/reading` - Get linked reading details

#### Enhanced Endpoints

- `GET /api/tasks?hasReading=true` - Filter tasks with readings
- `GET /api/tasks/:id` - Include reading link in response

### Service Layer

#### New Services

**canvas-reading-service.ts**
```typescript
class CanvasReadingService {
  async detectReadingAssignments(courseId: string): Promise<Reading[]>
  async downloadPDF(canvasItemId: string): Promise<Buffer>
  async processReading(canvasItemId: string): Promise<ProcessingResult>
  async syncReadingToTask(readingId: string, taskId: string): Promise<void>
}
```

**Read Help Service Enhancement**
```typescript
class ReadHelpService {
  async uploadFromCanvas(params: {
    file: Buffer,
    title: string,
    classId: string,
    className: string,
    canvasItemId: string,
    taskId?: string
  }): Promise<Book>

  async getBooksByClass(classId: string): Promise<Book[]>
  async getClasses(): Promise<ClassSummary[]>
}
```

### Frontend Changes

#### 1. Read Help App

**New Views:**
- `/classes` - Class library view showing courses with book counts
- `/classes/:classId` - Class detail view showing all readings for that course

**Enhanced Views:**
- `/` (Library) - Add filter by class dropdown
- Book cards - Show class badge

**New Components:**
- `ClassLibrary.tsx` - Grid of classes with book counts
- `ClassReadings.tsx` - List of readings for a specific class
- `ClassBadge.tsx` - Visual indicator of class association

#### 2. Tasks App

**Enhanced Components:**
- `TaskCard.tsx` - Add "📖 Open Reading" button if `readingUrl` exists
- `TaskDetailPanel.tsx` - Show reading preview with book title, page count, reading time

**New Components:**
- `ReadingPreview.tsx` - Inline preview of linked reading

#### 3. Command Center App

**Enhanced Components:**
- `AssignmentDetailModal.tsx` - Add "Reading Material" tab showing Read Help book preview
- `WeeklyPlanningCalendar.tsx` - Show reading icon on tasks with readings

---

## User Experience Flow

### Happy Path: New Reading Assignment

1. **Canvas Update:**
   - Professor uploads "HBS Case: Tesla's Strategy.pdf" to MBA 560 module
   - Due date: 2 days from now

2. **Agent Detection (2 hours later):**
   - Canvas agent runs integrity check
   - Detects new file in modules with "case" keyword
   - `canvasItems` record created: `{canvasType: 'file', materialType: 'case', title: 'Tesla Strategy'}`

3. **Automatic Processing:**
   - Agent downloads PDF from Canvas (authenticated session)
   - Uploads to Read Help with metadata:
     - `className: "MBA 560 - Strategy"`
     - `classId: "canvas_course_12345"`
     - `tags: ["MBA 560", "canvas", "case"]`
   - Read Help processes PDF:
     - Extracts text (32 pages, ~8,000 words)
     - Detects as HBS case (X-XXX-XXX format)
     - Creates chapters for case questions
     - Indexes for search
   - Creates task:
     - `title: "Read: Tesla's Strategy (HBS Case)"`
     - `dueDate: 2 days from now`
     - `timeEstimateMinutes: 45` (based on page count)
     - `readingUrl: "/books/uuid-123"`
     - `priority: 3` (due soon)

4. **User Discovery:**
   - User opens command center app
   - Sees task: "Read: Tesla's Strategy (HBS Case)" with 📖 icon
   - Clicks task → sees assignment detail with "Reading Material" tab

5. **Reading Flow:**
   - Clicks "Open Reading" button
   - Redirects to Read Help: `/books/uuid-123`
   - Book opens with chapters, AI summary available
   - User highlights key points, chats with AI tutor
   - Progress tracked automatically

6. **Task Completion:**
   - User reads to 100%
   - Returns to tasks app
   - Marks task complete
   - Task moves to done, vault entry created

### Edge Cases

**Case 1: External Article Link (Not PDF)**
- Canvas has external URL to NYT article
- Agent detects as reading but can't download PDF
- Creates task with `readingUrl: external_link` (no Read Help integration)
- Task description includes link to external site
- User clicks → opens external URL in browser

**Case 2: Protected PDF (Login Required)**
- PDF requires Harvard Business Publishing login
- Canvas download fails with 403 error
- Agent marks as "manual upload required"
- Creates task with note: "PDF requires manual download from Canvas"
- User downloads manually, uploads to Read Help via drag-drop

**Case 3: Duplicate Reading (Same PDF, Multiple Courses)**
- MBA 560 and MBA 580 both assign same HBS case
- Read Help detects duplicate via file hash
- Creates single book with multiple class tags: `["MBA 560", "MBA 580"]`
- Creates separate tasks for each course, both link to same book

**Case 4: Large PDF (100+ pages)**
- Textbook chapter assigned (150 pages)
- Agent downloads successfully but Read Help processing takes 5+ minutes
- Task created with `readingId: null` initially
- Background job processes PDF
- Task updated with reading link when processing completes

---

## Implementation Plan

### Phase 1: Database & API Foundation (2-3 days)

**Tasks:**
1. Add schema changes to Read Help books table
2. Add schema changes to tasks table
3. Create database migration
4. Create `canvas-reading-service.ts`
5. Add Read Help endpoints for Canvas integration
6. Add task endpoints for reading links
7. Write unit tests for services

**Deliverables:**
- Migration file: `0017_canvas_reading_integration.sql`
- Service: `canvas-reading-service.ts`
- API routes: enhanced read-help.ts, tasks.ts
- Tests: 80%+ coverage

### Phase 2: Canvas Agent Integration (3-4 days)

**Tasks:**
1. Enhance `detectReadingAssignments()` in Canvas agent
2. Implement PDF download from Canvas with authentication
3. Integrate with Read Help upload API
4. Update task creation to include reading links
5. Add error handling for download failures
6. Create processing queue for long-running uploads
7. Write integration tests

**Deliverables:**
- Enhanced Canvas agent with reading processing
- PDF download module with retry logic
- Integration tests for end-to-end flow
- Documentation of processing pipeline

### Phase 3: Frontend - Read Help App (2-3 days)

**Tasks:**
1. Create `ClassLibrary.tsx` component
2. Create `ClassReadings.tsx` view
3. Add class filter dropdown to library view
4. Add class badges to book cards
5. Update book upload form to optionally accept class info
6. Add class navigation to sidebar
7. Style and responsive design

**Deliverables:**
- Classes view at `/classes`
- Class detail view at `/classes/:classId`
- Enhanced library with filtering
- Mobile-responsive design

### Phase 4: Frontend - Tasks & Command Center (2 days)

**Tasks:**
1. Add "Open Reading" button to `TaskCard.tsx`
2. Create `ReadingPreview.tsx` component
3. Enhance `TaskDetailPanel.tsx` with reading info
4. Add reading tab to `AssignmentDetailModal.tsx` in command center
5. Add reading icons to calendar view
6. Test deep linking from tasks to Read Help

**Deliverables:**
- Reading buttons in tasks app
- Reading preview in command center
- Deep linking working
- Visual indicators for reading tasks

### Phase 5: Testing & Refinement (2-3 days)

**Tasks:**
1. End-to-end testing with real Canvas assignments
2. Test all edge cases (external links, protected PDFs, duplicates)
3. Performance testing with large PDFs
4. User acceptance testing
5. Bug fixes and polish
6. Documentation updates

**Deliverables:**
- Test report with edge case coverage
- Performance benchmarks
- User testing feedback
- Bug fix commits
- Updated FEATURES.md

### Phase 6: Documentation & Rollout (1 day)

**Tasks:**
1. Update FEATURES.md
2. Create feature documentation in `/docs/public/features/`
3. Update roadmap
4. Create user guide
5. Deploy to production

**Deliverables:**
- Complete documentation
- User guide with screenshots
- Changelog entry
- Production deployment

**Total Estimated Time:** 12-16 days

---

## Non-Functional Requirements

### Performance

- PDF download: <30 seconds for 50-page PDF
- Read Help upload: <60 seconds for processing
- Task creation: <2 seconds
- Class filtering: <500ms
- Reading link navigation: <1 second

### Scalability

- Support 50+ courses per user
- Handle 500+ readings per semester
- Queue large PDF processing (>50 pages)
- Batch processing for multiple readings

### Reliability

- Retry PDF downloads 3 times on failure
- Graceful degradation if Read Help unavailable
- Transaction consistency (task + reading link)
- Duplicate detection via file hash

### Security

- Canvas authentication tokens stored securely
- PDF files encrypted at rest
- No public access to Canvas credentials
- User-scoped reading access

### Usability

- Zero-config for users (automatic)
- Clear error messages for manual uploads
- Visual indicators for reading tasks
- One-click navigation to readings

---

## Dependencies

### Internal

- Canvas Integrity Agent (existing)
- Read Help Service (existing)
- Task Service (existing)
- Canvas Integration (existing)

### External

- Canvas LMS API access (existing)
- Canvas authentication (existing)
- PDF processing libraries (existing in Read Help)
- Tesseract OCR (existing in Read Help)

### New Libraries

- None required (all dependencies exist)

---

## Risks & Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Canvas API rate limits | High | Medium | Batch requests, implement exponential backoff |
| PDF download failures | Medium | Medium | Retry logic, manual upload fallback |
| Read Help processing slow | Medium | High | Queue system, background jobs, progress indicators |
| Duplicate readings | Low | High | File hash deduplication, user confirmation |
| Large file sizes | Medium | Low | Streaming downloads, chunked uploads |
| Canvas authentication expires | Medium | Low | Auto-refresh tokens, user re-auth flow |

---

## Open Questions

1. **Should we support non-PDF readings (Word docs, PowerPoints)?**
   - Current Read Help only supports PDFs
   - Could convert with external service (e.g., CloudConvert API)
   - Recommendation: Start with PDFs only, add conversion in Phase 2

2. **How to handle readings without due dates?**
   - Some modules have "optional readings"
   - Recommendation: Create tasks with "someday" status, low priority

3. **Should we auto-archive completed reading tasks?**
   - Could clutter Read Help library
   - Recommendation: Keep books, archive tasks after 30 days

4. **What about reading progress in tasks?**
   - Read Help tracks progress (0-100%)
   - Could sync to task description or status
   - Recommendation: Add progress indicator in Phase 2

5. **Class organization: Canvas course ID or custom?**
   - Use Canvas course ID for automatic sync
   - Or allow user to create custom class categories
   - Recommendation: Start with Canvas course ID, add custom categories later

---

## Success Criteria

**Must Have:**
- ✅ PDFs from Canvas automatically appear in Read Help
- ✅ Readings organized by class in Read Help app
- ✅ Tasks link directly to readings with one click
- ✅ Reading tasks show book title, page count, estimated time
- ✅ Duplicate detection prevents redundant uploads

**Should Have:**
- ✅ Support for external article links (fallback to direct link)
- ✅ Manual upload fallback for protected PDFs
- ✅ Reading progress indicator in tasks
- ✅ Search by class in Read Help app

**Could Have:**
- ⏸️ Auto-conversion of Word docs to PDF
- ⏸️ Reading reminders 2 days before due date
- ⏸️ AI-generated reading summaries in task description
- ⏸️ Automatic flashcard creation for readings

**Won't Have (v1):**
- ❌ Reading analytics dashboard
- ❌ Social features (share notes with classmates)
- ❌ Integration with citation managers (Zotero, Mendeley)
- ❌ Reading speed tracking

---

## Appendix

### A. Wireframes

*(To be added during design phase)*

### B. Technical Diagrams

**Database Schema:**
```
┌─────────────────────────┐
│     readHelpBooks       │
├─────────────────────────┤
│ id (UUID) PK            │
│ title                   │
│ author                  │
│ pageCount               │
│ tags[]                  │
│ classId (NEW)           │◄─────┐
│ className (NEW)         │      │
│ canvasItemId (NEW)      │◄──┐  │
│ taskId (NEW)            │◄─┐│  │
│ assignmentType (NEW)    │  ││  │
└─────────────────────────┘  ││  │
                             ││  │
┌─────────────────────────┐  ││  │
│        tasks            │  ││  │
├─────────────────────────┤  ││  │
│ id (UUID) PK            │──┘│  │
│ title                   │   │  │
│ dueDate                 │   │  │
│ readingUrl (NEW)        │   │  │
│ readingId (NEW) FK      │───┘  │
│ source                  │      │
│ sourceRef               │      │
└─────────────────────────┘      │
                                 │
┌─────────────────────────┐      │
│      canvasItems        │      │
├─────────────────────────┤      │
│ id (UUID) PK            │──────┘
│ canvasId                │
│ canvasType              │
│ materialType            │
│ downloadUrl             │
│ localPath               │
└─────────────────────────┘
```

### C. API Contract Examples

**POST /api/read-help/books/from-canvas**
```json
Request:
{
  "file": "<binary>",
  "title": "Tesla's Strategy (HBS Case)",
  "classId": "canvas_course_12345",
  "className": "MBA 560 - Strategy",
  "canvasItemId": "canvas_item_67890",
  "taskId": "uuid-task-123",
  "assignmentType": "case",
  "tags": ["MBA 560", "canvas", "strategy"]
}

Response:
{
  "id": "uuid-book-456",
  "title": "Tesla's Strategy (HBS Case)",
  "status": "processing",
  "classId": "canvas_course_12345",
  "className": "MBA 560 - Strategy",
  "pageCount": 32,
  "estimatedReadingTime": 45,
  "url": "/books/uuid-book-456"
}
```

**GET /api/read-help/books?classId=canvas_course_12345**
```json
Response:
{
  "books": [
    {
      "id": "uuid-book-456",
      "title": "Tesla's Strategy (HBS Case)",
      "className": "MBA 560 - Strategy",
      "pageCount": 32,
      "status": "ready",
      "createdAt": "2025-01-27T10:00:00Z"
    }
  ],
  "total": 1
}
```

**GET /api/read-help/classes**
```json
Response:
{
  "classes": [
    {
      "classId": "canvas_course_12345",
      "className": "MBA 560 - Strategy",
      "bookCount": 12,
      "lastUpdated": "2025-01-27T10:00:00Z"
    },
    {
      "classId": "canvas_course_67890",
      "className": "MBA 501 - Finance",
      "bookCount": 8,
      "lastUpdated": "2025-01-26T15:30:00Z"
    }
  ]
}
```

---

## Approval & Sign-off

- [ ] Product Owner
- [ ] Engineering Lead
- [ ] Design Lead
- [ ] QA Lead

---

**Next Steps:**
1. Review PRD with stakeholders
2. Estimate development time
3. Schedule kickoff meeting
4. Begin Phase 1 implementation
