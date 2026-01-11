# Vault Data Architecture Restructuring Plan

> **Date:** January 7, 2026
> **Status:** Proposed
> **Author:** Claude (AI Assistant)

---

## Executive Summary

The vault currently stores ~15+ content types from 10+ sources in a flat structure with metadata-based organization. While flexible, this makes search difficult and doesn't match the intended PARA (Projects, Areas, Resources, Archive) methodology from the PRD.

This plan proposes restructuring to a **hierarchical folder-first architecture** with **consistent tagging taxonomy** and **enhanced search capabilities**.

---

## Current State Analysis

### Data Sources (10+)
| Source | Type | Volume | Notes |
|--------|------|--------|-------|
| `apple_notes` | Notes | High | Batch import via AppleScript |
| `notion` | Notes/Docs | Medium | Incremental sync |
| `google_drive` | Files/Docs | Medium | Full hierarchy |
| `google_docs` | Documents | Medium | Markdown export |
| `canvas` | Academic | High | Courses, syllabi, assignments |
| `plaud` | Recordings | Low-Med | Transcriptions + summaries |
| `remarkable` | Handwritten | Low-Med | PDFs with OCR |
| `email` | Email | High | Gmail integration |
| `manual` | User-created | Low | Web interface |
| `web` | Clipped | Low | Web content |
| `tasks` | Task archives | High | Completed tasks |

### Content Types (15)
```
Core:        note, document, article, reference, snippet, template, other
Learning:    class_notes, lecture, meeting_notes, meeting, recording_summary
Personal:    resume, journal
System:      task_archive
Sensitive:   person, credential, financial, medical, legal
```

### Current Problems

1. **Flat Structure** - All entries at same level with metadata-based filtering only
2. **Overloaded Context Field** - Stores class names, project names, "personal", "reference" without hierarchy
3. **No Enforced Taxonomy** - Tags are free-form, no controlled vocabulary
4. **Multiple Overlapping Schemes** - `contentType` vs `category` vs `context` create confusion
5. **Search Challenges** - Relies on keyword matching; semantic search infrastructure exists but underutilized
6. **No Clear Inbox** - New entries don't have a staging area for processing

---

## Proposed Architecture

### 1. PARA Folder Hierarchy

Implement the PRD's intended structure as a **first-class organization layer**:

```
VAULT/
├── 📥 INBOX/                    # Unsorted captures (needs processing)
│   └── [All uncategorized imports land here]
│
├── 📁 PROJECTS/                 # Active outcomes with deadlines
│   ├── Q1-Product-Launch/
│   │   ├── Requirements/
│   │   ├── Meeting-Notes/
│   │   └── Research/
│   ├── Thesis/
│   └── [auto-linked to projects table]
│
├── 📚 AREAS/                    # Ongoing responsibilities (no deadline)
│   ├── Work/
│   │   ├── Team-Processes/
│   │   └── 1-on-1-Notes/
│   ├── School/
│   │   ├── CS401-ML/
│   │   │   ├── Lectures/
│   │   │   ├── Assignments/
│   │   │   └── Study-Guides/
│   │   └── MBA501-Strategy/
│   └── Health/
│
├── 📦 RESOURCES/                # Reference materials (topic-based)
│   ├── Programming/
│   ├── Career/
│   │   └── Resumes/
│   ├── Templates/
│   └── How-Tos/
│
├── 🗄️ ARCHIVE/                  # Completed/inactive items
│   ├── Completed-Tasks/
│   │   ├── 2026-01/
│   │   └── 2025-12/
│   ├── Completed-Projects/
│   └── Old-Notes/
│
├── 👥 PEOPLE/                   # Contact notes (links to people table)
│   ├── Professor-Smith/
│   └── John-Colleague/
│
├── 📅 JOURNAL/                  # Daily/weekly reflections
│   ├── Daily/
│   └── Weekly-Reviews/
│
└── 🎙️ RECORDINGS/               # Transcribed audio
    ├── Classes/
    ├── Meetings/
    └── Voice-Memos/
```

### 2. Schema Changes

#### A. Add `folder_path` Column (Required)
```sql
ALTER TABLE vault_entries
ADD COLUMN folder_path TEXT NOT NULL DEFAULT '/INBOX';

-- Examples:
-- '/PROJECTS/Q1-Product-Launch/Meeting-Notes'
-- '/AREAS/School/CS401-ML/Lectures'
-- '/RESOURCES/Career/Resumes'
-- '/ARCHIVE/Completed-Tasks/2026-01'
```

#### B. Add `para_type` Enum Column
```sql
ALTER TABLE vault_entries
ADD COLUMN para_type TEXT NOT NULL DEFAULT 'inbox'
CHECK (para_type IN ('inbox', 'project', 'area', 'resource', 'archive', 'people', 'journal', 'recording'));
```

#### C. Rename/Deprecate Ambiguous Fields
```sql
-- Rename 'context' to 'legacy_context' (for backward compatibility)
ALTER TABLE vault_entries RENAME COLUMN context TO legacy_context;

-- Add new specific fields
ALTER TABLE vault_entries ADD COLUMN area TEXT;          -- 'Work', 'School', 'Personal'
ALTER TABLE vault_entries ADD COLUMN class_name TEXT;    -- 'CS401', 'MBA501'
ALTER TABLE vault_entries ADD COLUMN project_name TEXT;  -- Links to project.name
```

#### D. Create Folders Table
```sql
CREATE TABLE vault_folders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    path TEXT NOT NULL UNIQUE,           -- '/AREAS/School/CS401-ML'
    name TEXT NOT NULL,                   -- 'CS401-ML'
    para_type TEXT NOT NULL,              -- 'area'
    parent_path TEXT,                     -- '/AREAS/School'
    icon TEXT,                            -- '📘'
    color TEXT,
    metadata JSONB,                       -- {professor: 'Smith', semester: 'Spring 2026'}
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_folders_parent ON vault_folders(parent_path);
CREATE INDEX idx_folders_para ON vault_folders(para_type);
```

### 3. Tag Taxonomy (Controlled Vocabulary)

Replace free-form tags with a **structured taxonomy**:

```yaml
# Primary Dimensions (pick one per dimension)

status:
  - active
  - reference
  - archived
  - needs-review

type:
  - note
  - document
  - meeting
  - lecture
  - recording
  - task
  - template

sensitivity:
  - public
  - private
  - confidential      # credentials, financial, medical, legal

# Secondary Tags (multiple allowed)

topics:              # What it's about
  - machine-learning
  - algorithms
  - productivity
  - career
  - finance
  - health

formats:             # Content format
  - markdown
  - pdf
  - audio
  - image
  - handwritten

actions:             # GTD-style
  - actionable
  - waiting
  - someday
  - delegated
```

#### Schema for Controlled Tags
```sql
CREATE TABLE vault_tag_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dimension TEXT NOT NULL,    -- 'status', 'type', 'sensitivity', 'topics'
    name TEXT NOT NULL,         -- 'machine-learning'
    description TEXT,
    color TEXT,
    is_active BOOLEAN DEFAULT true,
    UNIQUE(dimension, name)
);

-- Join table for many-to-many
CREATE TABLE vault_entry_tags (
    entry_id UUID REFERENCES vault_entries(id) ON DELETE CASCADE,
    tag_id UUID REFERENCES vault_tag_definitions(id) ON DELETE CASCADE,
    PRIMARY KEY (entry_id, tag_id)
);
```

### 4. Search Architecture

#### A. Faceted Search API
```typescript
interface VaultSearchRequest {
    // Text search
    query?: string;                    // Full-text search
    semanticQuery?: string;            // Semantic/meaning search

    // Facets (folder-based)
    folderPath?: string;               // Search within folder tree
    paraType?: ParaType[];             // ['project', 'area']

    // Facets (metadata)
    contentType?: ContentType[];
    source?: VaultSource[];
    area?: string[];                   // ['Work', 'School']
    className?: string[];              // ['CS401', 'MBA501']

    // Facets (tags)
    tags?: {
        status?: string[];
        type?: string[];
        sensitivity?: string[];
        topics?: string[];
    };

    // Date filters
    createdAfter?: Date;
    createdBefore?: Date;
    sourceAfter?: Date;
    sourceBefore?: Date;

    // Pagination
    limit?: number;
    offset?: number;
    sortBy?: 'relevance' | 'date' | 'title';
}
```

#### B. Full-Text Search Index (PostgreSQL)
```sql
-- Create materialized search index
CREATE INDEX idx_vault_fts ON vault_entries
USING GIN (
    to_tsvector('english',
        coalesce(title, '') || ' ' ||
        coalesce(content, '') || ' ' ||
        coalesce(folder_path, '') || ' ' ||
        coalesce(array_to_string(tags, ' '), '')
    )
);
```

#### C. Semantic Search Enhancement
```typescript
// Chunk content and store embeddings
interface SemanticSearchConfig {
    chunkSize: 512;              // tokens per chunk
    chunkOverlap: 50;            // overlap for context
    model: 'voyage-large-2';     // embedding model
    topK: 20;                    // candidates for reranking
}
```

### 5. Migration Strategy

#### Phase 1: Schema Migration (Non-Breaking)
1. Add new columns (`folder_path`, `para_type`, `area`, `class_name`, `project_name`)
2. Create `vault_folders` and `vault_tag_definitions` tables
3. All new columns have defaults - existing code continues working

#### Phase 2: Data Migration Script
```typescript
async function migrateVaultEntries() {
    const entries = await db.select().from(vaultEntries);

    for (const entry of entries) {
        const folderPath = determineFolderPath(entry);
        const paraType = determineParaType(entry);
        const area = extractArea(entry.legacy_context);
        const className = extractClassName(entry.legacy_context);

        await db.update(vaultEntries)
            .set({ folderPath, paraType, area, className })
            .where(eq(vaultEntries.id, entry.id));
    }
}

function determineFolderPath(entry: VaultEntry): string {
    // Task archives -> /ARCHIVE/Completed-Tasks/{month}
    if (entry.contentType === 'task_archive') {
        const month = format(entry.taskCompletedAt, 'yyyy-MM');
        return `/ARCHIVE/Completed-Tasks/${month}`;
    }

    // Recordings -> /RECORDINGS/{type}
    if (entry.recordingId) {
        return `/RECORDINGS/${entry.recordingType || 'Voice-Memos'}`;
    }

    // Class materials -> /AREAS/School/{class}
    if (isClassName(entry.legacy_context)) {
        const category = entry.contentType === 'lecture' ? 'Lectures' : 'Notes';
        return `/AREAS/School/${entry.legacy_context}/${category}`;
    }

    // Journal -> /JOURNAL/Daily
    if (entry.contentType === 'journal') {
        return '/JOURNAL/Daily';
    }

    // Resumes -> /RESOURCES/Career/Resumes
    if (entry.contentType === 'resume') {
        return '/RESOURCES/Career/Resumes';
    }

    // Default to inbox for processing
    return '/INBOX';
}
```

#### Phase 3: Update Import Pipeline
```typescript
// Modify classification service to assign folder paths
async function classifyAndOrganize(entry: RawEntry): Promise<ClassificationResult> {
    const classification = await classificationService.classify(entry);

    // Determine folder path based on classification
    classification.folderPath = this.determineFolderPath(classification, entry);
    classification.paraType = this.determineParaType(classification.folderPath);

    return classification;
}
```

#### Phase 4: UI Updates
1. Update vault app to show folder tree navigation
2. Add drag-and-drop for moving entries between folders
3. Update search to support faceted filtering
4. Add "Move to..." command

---

## Search Optimization for Common Queries

### Query: "What did I learn about neural networks?"
```sql
-- Faceted + Semantic search
SELECT v.*,
       ts_rank(search_vector, plainto_tsquery('neural networks')) as text_rank,
       1 - (e.embedding <=> $semantic_query_embedding) as semantic_rank
FROM vault_entries v
LEFT JOIN vault_embeddings e ON v.id = e.entry_id
WHERE
    v.para_type IN ('area', 'project')
    AND (v.folder_path LIKE '/AREAS/School/%' OR v.class_name IS NOT NULL)
    AND (
        search_vector @@ plainto_tsquery('neural networks')
        OR e.embedding <=> $semantic_query_embedding < 0.3
    )
ORDER BY (text_rank + semantic_rank) DESC
LIMIT 20;
```

### Query: "Show me all my resumes"
```sql
SELECT * FROM vault_entries
WHERE folder_path = '/RESOURCES/Career/Resumes'
   OR content_type = 'resume'
ORDER BY updated_at DESC;
```

### Query: "What tasks did I complete last week?"
```sql
SELECT * FROM vault_entries
WHERE para_type = 'archive'
  AND content_type = 'task_archive'
  AND task_completed_at >= NOW() - INTERVAL '7 days'
ORDER BY task_completed_at DESC;
```

### Query: "CS401 lecture notes"
```sql
SELECT * FROM vault_entries
WHERE folder_path LIKE '/AREAS/School/CS401%/Lectures%'
   OR (class_name = 'CS401' AND content_type IN ('lecture', 'class_notes'))
ORDER BY source_date DESC;
```

---

## Implementation Priority

### P0 - Critical (Week 1)
- [ ] Schema migration (add columns, create tables)
- [ ] Data migration script
- [ ] Update classification service

### P1 - High (Week 2)
- [ ] Folder tree API endpoints
- [ ] Update vault service search
- [ ] UI folder navigation

### P2 - Medium (Week 3)
- [ ] Tag taxonomy implementation
- [ ] Faceted search API
- [ ] Semantic search enhancement

### P3 - Nice to Have
- [ ] Drag-and-drop folder organization
- [ ] Auto-filing rules
- [ ] Folder templates

---

## File Changes Required

| File | Change |
|------|--------|
| `hub/src/db/schema.ts` | Add columns, new tables |
| `hub/src/services/vault-service.ts` | Update queries for folder paths |
| `hub/src/services/classification-service.ts` | Add folder path determination |
| `hub/src/services/import-service.ts` | Use new organization |
| `hub/src/api/routes/vault.ts` | Add folder endpoints |
| `packages/types/src/vault.ts` | Add new types |
| `apps/vault/src/App.tsx` | Folder tree navigation |

---

## Appendix: Folder Path Examples

| Content | Current `context` | New `folder_path` |
|---------|-------------------|-------------------|
| CS401 lecture | "CS401" | /AREAS/School/CS401-ML/Lectures |
| Meeting notes | "Work" | /AREAS/Work/Meeting-Notes |
| Resume | "Career" | /RESOURCES/Career/Resumes |
| Completed task | "CS401" | /ARCHIVE/Completed-Tasks/2026-01 |
| Voice memo | "Personal" | /RECORDINGS/Voice-Memos |
| Project notes | "Q1 Launch" | /PROJECTS/Q1-Product-Launch/Notes |
| Journal entry | "Personal" | /JOURNAL/Daily |
| Person notes | "Sarah" | /PEOPLE/Sarah-Manager |
| Uncategorized | "Imported" | /INBOX |

---

*This plan aligns the vault with GTD/PARA methodology while maintaining backward compatibility and improving search.*
