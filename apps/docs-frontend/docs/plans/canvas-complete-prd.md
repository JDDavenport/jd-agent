# Canvas Complete PRD
## Zero-Friction Homework Experience

**Version:** 1.0
**Last Updated:** January 26, 2026
**Status:** Draft
**Roadmap Item:** Academic Productivity Enhancement

---

## Executive Summary

Transform the Canvas integration from a simple task sync into a **complete homework command center** where you can discover, understand, work on, and submit assignments without ever opening Canvas directly.

**Goal:** All homework done from JD Agent apps - Canvas becomes invisible infrastructure.

---

## Problem Statement

### Current Pain Points

1. **Task Descriptions Are Anemic**
   - Canvas assignments sync with just a title
   - No rich context: rubrics, instructions, point breakdowns
   - User must open Canvas to understand what the assignment actually requires

2. **Readings & Materials Are Inaccessible**
   - Files and PDFs are detected but not downloaded
   - User must navigate to Canvas to access course materials
   - No centralized reading list across all classes

3. **No Homework Workflow**
   - Can't see assignment requirements in Tasks app
   - Can't access related PDFs/readings in Vault
   - No connection between task, instructions, and materials

4. **Context Switching Kills Flow**
   - Open Canvas → Find course → Find assignment → Read instructions
   - Open separate app for notes
   - Open another for the actual work
   - Back to Canvas to submit

---

## Solution: Canvas Complete

### Vision

When you open a Canvas assignment task in JD Agent:
- See the **full assignment details** (instructions, rubric, points, submission type)
- Access **all related materials** (PDFs, readings, slides) with one click
- Take **notes in Vault** linked to the assignment
- Work on the assignment with all context at hand
- Eventually: Submit directly from the app

### Core Principles

1. **Pull Everything Once** - Download and store all materials locally
2. **Rich Task Context** - Tasks contain everything needed to complete them
3. **Connected Ecosystem** - Tasks ↔ Vault ↔ Materials work seamlessly
4. **Zero Canvas Visits** - Never need to open the LMS directly

---

## Feature Specification

### Phase 1: Rich Assignment Details

**Objective:** Tasks contain all the information needed to complete assignments.

#### 1.1 Enhanced Assignment Sync

When syncing assignments, extract and store:

| Field | Source | Example |
|-------|--------|---------|
| `instructions` | Assignment description HTML (cleaned) | "Write a 5-page analysis..." |
| `rubric` | Rubric API or browser scrape | Array of criteria + points |
| `submissionType` | Submission types array | ["online_upload", "online_text_entry"] |
| `allowedExtensions` | Allowed file types | [".pdf", ".docx"] |
| `wordCount` | Parsed from instructions | "1500-2000 words" |
| `groupAssignment` | Is group project? | true/false |
| `peerReview` | Has peer review? | true/false |
| `attachedFiles` | Files attached to assignment | Array of file refs |

**Schema Addition:**
```sql
-- Add to canvas_items table
instructions TEXT,
rubric JSONB,           -- [{criterion, points, description}]
submission_type TEXT[], -- ['online_upload', 'online_text']
allowed_extensions TEXT[],
word_count_min INTEGER,
word_count_max INTEGER,
is_group_assignment BOOLEAN,
has_peer_review BOOLEAN,
attached_file_ids TEXT[], -- Canvas file IDs
```

#### 1.2 Task Detail Enhancement

When viewing a Canvas-sourced task:

```
┌─────────────────────────────────────────────────────────────┐
│ MBA 560 - Case Analysis: Southwest Airlines                  │
│ ─────────────────────────────────────────────────────────── │
│ Due: Jan 30, 2026 at 11:59 PM  │  Points: 100  │  Priority: 3│
├─────────────────────────────────────────────────────────────┤
│ INSTRUCTIONS                                                 │
│ Analyze the Southwest Airlines case using the frameworks     │
│ discussed in class. Your analysis should include:            │
│ • Industry analysis (Porter's Five Forces)                   │
│ • Competitive advantage assessment                           │
│ • Strategic recommendations                                  │
│                                                              │
│ Requirements: 5-7 pages, double-spaced, APA format          │
├─────────────────────────────────────────────────────────────┤
│ RUBRIC                                                       │
│ □ Industry Analysis (25 pts)                                │
│ □ Competitive Advantage (25 pts)                            │
│ □ Strategic Recommendations (25 pts)                        │
│ □ Writing Quality (15 pts)                                  │
│ □ Citations & Format (10 pts)                               │
├─────────────────────────────────────────────────────────────┤
│ MATERIALS                          │ NOTES                   │
│ 📄 Southwest Airlines Case.pdf     │ 📝 My Analysis Notes   │
│ 📄 Porter's Five Forces.pptx       │ + Create Note          │
│ 📄 Week 3 Lecture Slides.pdf       │                        │
├─────────────────────────────────────────────────────────────┤
│ [Open in Vault] [View on Canvas] [Mark Complete]            │
└─────────────────────────────────────────────────────────────┘
```

#### 1.3 Subtask Generation

Parse assignment requirements into checklist items:

```typescript
// AI-powered requirement parsing
const subtasks = await parseAssignmentRequirements(instructions);
// Returns:
[
  { title: "Read Southwest Airlines case", type: "reading" },
  { title: "Complete Porter's Five Forces analysis", type: "writing" },
  { title: "Write competitive advantage section", type: "writing" },
  { title: "Write strategic recommendations", type: "writing" },
  { title: "Format and proofread", type: "review" },
  { title: "Submit assignment", type: "submission" }
]
```

### Phase 2: Materials Download & Storage

**Objective:** All course materials accessible offline from Vault.

#### 2.1 Automatic File Download

When Canvas items are discovered:

1. **Detect Files** - Assignment attachments, module files, reading materials
2. **Download to Storage** - `hub/storage/canvas/{course_id}/{file_name}`
3. **Create Vault Entry** - Each file becomes a searchable Vault document
4. **Link to Source** - Vault entry links back to Canvas item and assignment

**File Types to Download:**
- PDF documents (cases, readings, syllabi)
- PowerPoint/Slides (lecture materials)
- Word documents (templates, guides)
- Excel files (data sets)
- External URLs (bookmark with metadata)

#### 2.2 Course Materials Library

New Vault view: **Course Materials**

```
┌─────────────────────────────────────────────────────────────┐
│ 📚 Course Materials                        [Search...]      │
├─────────────────────────────────────────────────────────────┤
│ MBA 560 - Strategy                                          │
│ ├─ 📄 Syllabus.pdf                                         │
│ ├─ 📁 Cases                                                 │
│ │   ├─ Southwest Airlines.pdf                              │
│ │   ├─ Netflix Disruption.pdf                              │
│ │   └─ Tesla's Strategy.pdf                                │
│ ├─ 📁 Lectures                                             │
│ │   ├─ Week 1 - Strategy Intro.pptx                        │
│ │   ├─ Week 2 - Industry Analysis.pptx                     │
│ │   └─ Week 3 - Competitive Advantage.pptx                 │
│ └─ 📁 Readings                                             │
│     ├─ Porter (1996) - What is Strategy.pdf                │
│     └─ Barney (1991) - Firm Resources.pdf                  │
│                                                              │
│ MBA 677R - Analytics                                         │
│ ├─ ...                                                      │
└─────────────────────────────────────────────────────────────┘
```

#### 2.3 Reading List Integration

**Per-Course Reading Lists:**
- Extract readings from modules (detected via "reading", "chapter", "article" keywords)
- Track reading status (unread, in-progress, completed)
- Link readings to relevant assignments
- Show readings due this week

**Schema Addition:**
```sql
CREATE TABLE canvas_materials (
  id UUID PRIMARY KEY,
  canvas_item_id UUID REFERENCES canvas_items(id),
  canvas_file_id TEXT,

  -- File info
  file_name TEXT NOT NULL,
  file_type TEXT, -- pdf, pptx, docx, xlsx, url
  file_size_bytes BIGINT,
  local_path TEXT, -- storage path
  download_url TEXT,

  -- Organization
  course_id UUID REFERENCES classes(id),
  module_name TEXT,
  material_type TEXT, -- case, reading, lecture, syllabus, template, data

  -- Vault integration
  vault_page_id UUID REFERENCES vault_pages(id),

  -- Reading tracking
  read_status TEXT DEFAULT 'unread', -- unread, in_progress, completed
  read_progress INTEGER DEFAULT 0, -- % complete
  last_read_at TIMESTAMP,

  -- Metadata
  page_count INTEGER,
  extracted_text TEXT, -- For search
  summary TEXT, -- AI-generated summary

  -- Related assignments
  related_assignment_ids TEXT[],

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Phase 3: Connected Workflow

**Objective:** Seamless flow between task, materials, and notes.

#### 3.1 Assignment Vault Pages

When an assignment is synced, auto-create a Vault page:

```
┌─────────────────────────────────────────────────────────────┐
│ MBA 560 > Assignments > Case Analysis: Southwest            │
├─────────────────────────────────────────────────────────────┤
│ ## Assignment Details                                        │
│ **Due:** January 30, 2026 at 11:59 PM                       │
│ **Points:** 100                                              │
│ **Submission:** File Upload (.pdf, .docx)                   │
│                                                              │
│ ## Instructions                                              │
│ [Full assignment instructions here]                          │
│                                                              │
│ ## Rubric                                                    │
│ | Criterion | Points | Notes |                              │
│ |-----------|--------|-------|                              │
│ | Industry Analysis | 25 | |                                │
│ | Competitive Advantage | 25 | |                            │
│ | ... | | |                                                  │
│                                                              │
│ ## Materials                                                 │
│ - [[Southwest Airlines Case.pdf]]                           │
│ - [[Porter's Five Forces.pptx]]                             │
│                                                              │
│ ## My Notes                                                  │
│ [Your working notes here - auto-saved]                      │
│                                                              │
│ ## Submission                                                │
│ [ ] Draft attached                                          │
│ [ ] Ready to submit                                         │
└─────────────────────────────────────────────────────────────┘
```

#### 3.2 Smart Linking

- **Task → Vault Page:** Click task to open assignment Vault page
- **Vault Page → Materials:** Click material link to view/download
- **Materials → Related:** Show other assignments using same material
- **Notes → Task:** Notes sync back to task description

#### 3.3 Quick Actions from Task

From any Canvas task:
- **📄 Open Assignment Page** - Full Vault page with everything
- **📚 View Materials** - Jump to related files
- **📝 Add Note** - Quick note creation linked to assignment
- **🔗 Open in Canvas** - Fallback to web (rarely needed)

### Phase 4: Daily Homework Dashboard

**Objective:** See all homework in one place with clear priorities.

#### 4.1 Homework Dashboard Widget

New Command Center widget: **Homework Hub**

```
┌─────────────────────────────────────────────────────────────┐
│ 📚 HOMEWORK HUB                                              │
├─────────────────────────────────────────────────────────────┤
│ DUE TODAY                                                    │
│ ⚠️ MBA 677R - Problem Set 4 (11:59 PM)          [Start →]  │
│                                                              │
│ DUE THIS WEEK                                                │
│ • MBA 560 - Case Analysis (Jan 30)              [75 min]   │
│   └─ Missing: Porter analysis section                       │
│ • SWELL 132 - Reflection Paper (Jan 31)         [30 min]   │
│   └─ Ready to submit                                        │
│                                                              │
│ READINGS DUE                                                 │
│ □ Porter (1996) - What is Strategy     [MBA 560, Jan 28]   │
│ □ Chapter 7 - Financial Analysis       [MBA 677R, Jan 29]  │
│                                                              │
│ UPCOMING                                                     │
│ • MBA 560 - Group Project Draft (Feb 5)                     │
│ • MBA 677R - Midterm Exam (Feb 10)                          │
└─────────────────────────────────────────────────────────────┘
```

#### 4.2 Time Estimation

AI-powered time estimates based on:
- Assignment type (case = 2-4 hrs, problem set = 1-2 hrs)
- Word count requirements
- Historical completion times
- Due date proximity (more buffer = lower urgency)

#### 4.3 Progress Tracking

For multi-part assignments:
- Track subtask completion
- Show estimated time remaining
- Alert when falling behind pace

### Phase 5: Mobile Experience

**Objective:** Review materials and track progress on mobile.

#### 5.1 Tasks App Mobile

- View assignment details with full instructions
- Check off subtasks
- Quick access to materials (open in PDF viewer)
- Add voice notes for assignments

#### 5.2 Vault Mobile

- Browse course materials by class
- Read PDFs with annotation
- Track reading progress
- Search across all materials

---

## API Specification

### New Endpoints

```typescript
// Materials
GET  /api/canvas/materials                    // List all materials
GET  /api/canvas/materials/:id                // Get material details
GET  /api/canvas/materials/:id/download       // Download file
POST /api/canvas/materials/:id/progress       // Update read progress
GET  /api/canvas/courses/:id/materials        // Materials for course
GET  /api/canvas/assignments/:id/materials    // Materials for assignment

// Enhanced Assignments
GET  /api/canvas/assignments/:id/full         // Full details with rubric
GET  /api/canvas/assignments/:id/subtasks     // Generated subtasks
POST /api/canvas/assignments/:id/subtasks     // Save subtasks
GET  /api/canvas/assignments/:id/vault-page   // Get or create vault page

// Reading Lists
GET  /api/canvas/readings                     // All readings
GET  /api/canvas/readings/due-this-week       // Readings due soon
POST /api/canvas/readings/:id/status          // Update read status

// Homework Dashboard
GET  /api/dashboard/homework                  // Homework hub data
GET  /api/dashboard/homework/due-today        // Due today
GET  /api/dashboard/homework/this-week        // Due this week
```

### Enhanced Canvas Sync

```typescript
interface EnhancedCanvasSync {
  // Existing
  syncAssignments(): Promise<void>;

  // New
  downloadMaterials(courseId: string): Promise<void>;
  extractReadings(courseId: string): Promise<CanvasReading[]>;
  generateAssignmentSubtasks(assignmentId: string): Promise<Subtask[]>;
  createAssignmentVaultPage(assignmentId: string): Promise<VaultPage>;
  linkMaterialsToAssignments(courseId: string): Promise<void>;
}
```

---

## Database Schema Changes

### New Tables

```sql
-- Course materials storage
CREATE TABLE canvas_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canvas_item_id UUID REFERENCES canvas_items(id),
  canvas_file_id TEXT UNIQUE,
  course_id UUID REFERENCES classes(id) NOT NULL,

  -- File details
  file_name TEXT NOT NULL,
  display_name TEXT,
  file_type TEXT NOT NULL, -- pdf, pptx, docx, xlsx, url
  mime_type TEXT,
  file_size_bytes BIGINT,
  local_path TEXT, -- hub/storage/canvas/...
  download_url TEXT,
  canvas_url TEXT,

  -- Organization
  module_name TEXT,
  module_position INTEGER,
  material_type TEXT, -- case, reading, lecture, syllabus, template, data

  -- Content extraction
  page_count INTEGER,
  extracted_text TEXT,
  ai_summary TEXT,

  -- Vault integration
  vault_page_id UUID REFERENCES vault_pages(id),

  -- Reading tracking
  read_status TEXT DEFAULT 'unread', -- unread, in_progress, completed
  read_progress INTEGER DEFAULT 0,
  last_read_at TIMESTAMP WITH TIME ZONE,

  -- Relationships
  related_assignment_ids UUID[], -- Links to canvas_items

  -- Sync tracking
  downloaded_at TIMESTAMP WITH TIME ZONE,
  last_synced_at TIMESTAMP WITH TIME ZONE,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Assignment subtasks (auto-generated)
CREATE TABLE canvas_assignment_subtasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canvas_item_id UUID REFERENCES canvas_items(id) ON DELETE CASCADE,
  task_id UUID REFERENCES tasks(id),

  title TEXT NOT NULL,
  subtask_type TEXT, -- reading, research, writing, review, submission
  sort_order INTEGER DEFAULT 0,
  is_completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMP WITH TIME ZONE,

  -- AI generation tracking
  generated_by TEXT, -- 'ai' or 'manual'
  generation_prompt TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Assignment vault page links
CREATE TABLE canvas_assignment_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canvas_item_id UUID REFERENCES canvas_items(id) ON DELETE CASCADE UNIQUE,
  vault_page_id UUID REFERENCES vault_pages(id) ON DELETE CASCADE,

  -- Embedded content snapshots
  instructions_snapshot TEXT,
  rubric_snapshot JSONB,

  -- User additions
  user_notes TEXT,
  submission_draft_path TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Schema Modifications

```sql
-- Extend canvas_items
ALTER TABLE canvas_items ADD COLUMN instructions TEXT;
ALTER TABLE canvas_items ADD COLUMN rubric JSONB;
ALTER TABLE canvas_items ADD COLUMN submission_types TEXT[];
ALTER TABLE canvas_items ADD COLUMN allowed_extensions TEXT[];
ALTER TABLE canvas_items ADD COLUMN word_count_min INTEGER;
ALTER TABLE canvas_items ADD COLUMN word_count_max INTEGER;
ALTER TABLE canvas_items ADD COLUMN is_group_assignment BOOLEAN DEFAULT FALSE;
ALTER TABLE canvas_items ADD COLUMN has_peer_review BOOLEAN DEFAULT FALSE;
ALTER TABLE canvas_items ADD COLUMN attached_file_ids TEXT[];
ALTER TABLE canvas_items ADD COLUMN vault_page_id UUID REFERENCES vault_pages(id);
ALTER TABLE canvas_items ADD COLUMN estimated_minutes INTEGER;
```

---

## Implementation Phases

### Phase 1: Rich Details (Week 1-2) - COMPLETED
- [x] Extend canvas_items schema with new fields
- [x] Update content extractor to get full assignment details
- [x] Extract and store rubrics
- [x] Update task sync to include instructions
- [x] Build task detail modal with full context

### Phase 2: Materials Download (Week 2-3) - COMPLETED
- [x] Create canvas_materials table
- [x] Build file download service
- [x] Implement storage organization (by course)
- [x] Create Vault entries for downloaded files
- [x] Build Course Materials view in Vault
- [x] Add reading progress tracking
- [x] Create API endpoints for materials

### Phase 3: Connected Workflow (Week 3-4) - COMPLETED
- [x] Auto-create assignment Vault pages
- [x] Build assignment page template with blocks (callouts, headings, text, rubric toggles, todo checklist)
- [x] Implement linking between tasks/vault/materials
- [x] Add quick actions to task cards and assignment modal
- [x] Create assignment page API endpoints
- [x] Build CanvasQuickActions component

### Phase 4: Dashboard & Polish (Week 4-5) - COMPLETED
- [x] Build Homework Hub widget
- [x] Implement urgency indicators and critical assignment alerts
- [x] Add progress tracking for subtasks
- [x] Readings due section with status tracking
- [x] Time estimation display (estimated minutes today/this week)
- [x] Compact mode for smaller widgets
- [x] Create Homework Hub API endpoints

### Phase 5: Advanced Features (Week 5-6) - COMPLETED
- [x] Direct submission from app (text, URL, file)
- [x] Submission status tracking
- [x] Submission history view
- [x] Grade notifications and tracking
- [x] Grade summary dashboard widget
- [x] Course grade averages
- [x] New grade alerts
- [ ] Peer review tracking (Future)
- [ ] Group project coordination (Future)

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Canvas visits per homework | 3-5 | 0-1 |
| Time to find assignment details | 2-3 min | 5 sec |
| Material access clicks | 5+ | 1 |
| Assignment context completeness | 20% | 95% |
| Reading tracking adoption | 0% | 80% |

---

## User Stories

### Primary Flow: Complete Homework Without Canvas

1. **Morning:** Check Homework Hub widget → See "MBA 560 Case Analysis due Thursday"
2. **Click task:** See full instructions, rubric, point breakdown
3. **Click "Materials":** Open Southwest Airlines case PDF
4. **Read case:** Track reading progress (75% complete)
5. **Click "Open Assignment Page":** Go to Vault page
6. **Take notes:** Write analysis in embedded notes section
7. **Check rubric:** Ensure all criteria addressed
8. **Complete:** Mark task done

**Canvas visits: 0**

### Secondary Flow: Weekly Planning

1. Open Weekly Planning page
2. See all homework for the week with time estimates
3. Drag assignments to time slots
4. See readings needed for each assignment
5. Plan reading time before writing time

### Tertiary Flow: Mobile Review

1. On commute, open Vault on phone
2. Browse to MBA 560 > Readings
3. Open "What is Strategy" PDF
4. Read and highlight key points
5. Mark as completed
6. Notes sync to desktop

---

## Technical Considerations

### File Storage
- Location: `hub/storage/canvas/{course_code}/{material_type}/{filename}`
- Max file size: 100MB
- Supported types: PDF, PPTX, DOCX, XLSX, images
- Text extraction: Use pdf-parse for PDFs

### Sync Strategy
- **Full sync:** Weekly - download all new materials
- **Incremental:** Daily - check for new/updated files
- **On-demand:** When assignment opened, ensure materials present

### Performance
- Lazy load file content
- Cache extracted text for search
- Thumbnail generation for file previews

---

## Open Questions

1. **Submission:** Should we support direct assignment submission? (Canvas API allows this)
2. **Collaboration:** How to handle group assignments?
3. **Annotations:** Should we support PDF annotations in-app?
4. **Offline:** How much to cache for fully offline use?

---

## Appendix: Current vs. Future State

### Current (Minimal Context)
```
Task: "Case Analysis: Southwest Airlines"
Due: Jan 30
Source: Canvas
```

### Future (Complete Context)
```
Task: "Case Analysis: Southwest Airlines"
Due: Jan 30
Source: Canvas
Points: 100
Est. Time: 3 hours
Instructions: "Analyze the Southwest Airlines case using..."
Rubric: [{criterion: "Industry Analysis", points: 25}, ...]
Materials: [
  {name: "Southwest Airlines.pdf", status: "downloaded"},
  {name: "Porter's Five Forces.pptx", status: "downloaded"}
]
Subtasks: [
  {title: "Read case", completed: true},
  {title: "Complete industry analysis", completed: false},
  ...
]
Vault Page: /mba-560/assignments/case-analysis-southwest
Notes: "Key insight: Southwest's cost advantage comes from..."
```

---

*This PRD transforms Canvas from a sync source into invisible infrastructure, letting you focus on learning instead of navigating LMS interfaces.*
