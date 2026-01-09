# Data Migration & Consolidation - Progress Report

## ✅ Completed Components

### 1. Database Schema Extensions
**Files:**
- `src/db/schema.ts` - Extended vault_entries table with migration fields
- `src/types/index.ts` - Added migration-specific types

**What was added:**
- **New fields in vault_entries:**
  - `category` - AI-classified category (career, class, personal, etc.)
  - `sourceId` - Original ID in source system
  - `sourceUrl` - Link back to original
  - `sourcePath` - Folder path in source system
  - `isProcessed`, `needsReview`, `isDuplicate` - Processing state flags
  - `duplicateOf` - Reference to canonical entry
  - `importedAt`, `lastSyncedAt` - Migration timestamps

- **New tables:**
  - `vault_attachments` - File storage references
  - `sync_state` - Track ongoing sync jobs

- **New content types:** resume, document, journal, class_notes, meeting_notes, task_archive, snippet, template, other

- **New sources:** notion, google_drive, google_docs, apple_notes

### 2. Content Parser (`src/lib/content-parser.ts`)
A comprehensive parser that handles:
- HTML → Markdown conversion (using Turndown)
- Notion rich text → Markdown
- Notion blocks → Markdown (recursive, handles all block types)
- Plain text extraction for search indexing
- Metadata extraction (word count, headings, links, etc.)

### 3. Notion Extractor (`src/integrations/notion.ts`)
**Features:**
- Full page extraction with recursive block fetching
- Database extraction
- Incremental sync support (modified since date)
- File attachment detection and tracking
- Folder/parent hierarchy tracking
- Rate limiting (3 req/sec for Notion API)
- Error handling and retries

**Usage:**
```typescript
import { createNotionExtractor } from './integrations/notion';

const extractor = createNotionExtractor(process.env.NOTION_API_KEY!, {
  includeArchived: false,
  excludePageIds: ['page-id-to-skip'],
});

// Extract all pages
for await (const entry of extractor.extractAll()) {
  console.log(entry.title, entry.sourceUrl);
}

// Extract database
const dbEntries = await extractor.extractDatabase('database-id');

// Incremental sync
for await (const entry of extractor.extractModifiedSince(lastSyncDate)) {
  // Process modified entries
}
```

### 4. Google Drive/Docs Extractor (`src/integrations/google-drive-extractor.ts`)
**Features:**
- List all files with filtering
- Google Docs export as Markdown
- Google Sheets/Slides reference links
- PDF text extraction (using pdf-parse)
- File download for attachments
- Folder hierarchy tracking
- Incremental sync support

**File type handling:**
- Google Docs → Markdown (preserves formatting)
- Google Sheets → Reference link
- Google Slides → Reference link
- PDFs → Text extraction + attachment
- Text files → Direct import
- Images/Archives → Attachment + reference

**Usage:**
```typescript
import { createGoogleDriveExtractor } from './integrations/google-drive-extractor';

const extractor = createGoogleDriveExtractor({
  credentials: {
    clientId: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    refreshToken: process.env.GOOGLE_REFRESH_TOKEN!,
  },
  rootFolderId: 'optional-folder-id',
  downloadFiles: true,
});

for await (const entry of extractor.extractAll()) {
  console.log(entry.title, entry.source);
}
```

### 5. Apple Notes Extractor (`src/integrations/apple-notes-extractor.ts`)
**Features:**
- macOS-only extraction via AppleScript
- Full note content with HTML → Markdown conversion
- Folder hierarchy tracking
- Permission checking
- Test utilities

**Requirements:**
- macOS
- Accessibility permissions for Terminal/iTerm
- Apple Notes app

**Usage:**
```typescript
import { createAppleNotesExtractor, testAppleNotesAccess } from './integrations/apple-notes-extractor';

// Test access first
await testAppleNotesAccess();

const extractor = createAppleNotesExtractor({
  includeFolders: ['Work', 'Class'],
  excludeFolders: ['Archive'],
});

for await (const entry of extractor.extractAll()) {
  console.log(entry.title, entry.sourcePath);
}
```

### 6. AI Classification Service (`src/services/classification-service.ts`)
**Features:**
- Claude-powered classification
- Automatic content type detection
- Category assignment
- Tag generation (3-7 relevant tags)
- Usefulness assessment
- Action suggestions (keep, archive, delete, review)
- **Special resume detection** with multiple signals:
  - Title/filename analysis
  - Path analysis
  - Content structure detection (Experience + Education + Skills)
- Batch processing with rate limiting
- Fallback rule-based classification

**Resume Detection:**
The service automatically flags resumes by checking:
1. Title contains "resume", "cv", or "curriculum vitae"
2. Path contains "resume", "career", or "job"
3. Content has "Experience", "Education", and "Skills"/"Summary"

If 2+ signals match → automatically classified as resume with `contentType: 'resume'` and `category: 'resume'`

**Usage:**
```typescript
import { classificationService } from './services/classification-service';

// Classify single entry
const result = await classificationService.classify(rawEntry);
console.log(result.contentType, result.category, result.tags);

// Batch classify with progress
const results = await classificationService.classifyBatch(entries, (current, total) => {
  console.log(`Classifying: ${current}/${total}`);
});
```

## 📋 Remaining Components

### High Priority
1. **Migration CLI Tool** - Command-line interface for running migrations
   - Commands: extract, classify, import, sync
   - Progress tracking
   - Dry-run mode
   - Configuration management

2. **Duplicate Detection** - Identify and handle duplicates
   - Title matching
   - Content similarity (cosine similarity)
   - Path/date matching
   - Merge strategies

3. **Embedding Generation** - Create vector embeddings for semantic search
   - Batch processing with Voyage AI
   - Chunking for long documents
   - Storage in vault_embeddings table
   - pgvector setup

4. **Ongoing Sync Mechanism** - Keep vault current
   - Scheduled jobs for each source
   - Incremental sync using sync_state table
   - Conflict resolution
   - Error handling and retry logic

### Medium Priority
5. **Cloudflare R2 Integration** - File storage for attachments
   - Upload/download utilities
   - Path management
   - Presigned URL generation

6. **Review Interface** - Web UI for human verification
   - Browse flagged entries (needsReview = true)
   - Approve/edit classifications
   - Merge duplicates
   - Bulk actions

### Lower Priority
7. **Vault Explorer UI** - Full-featured browsing interface
   - Filters (source, category, type, date)
   - Search (full-text + semantic)
   - Detail view
   - Related entries

8. **Testing & Verification** - Ensure everything works
   - Integration tests
   - End-to-end migration test
   - Data integrity checks

## 🔧 Next Steps

### To Apply the Database Migration:
```bash
# Push schema changes to database
bun run db:push

# Or generate and run migration
bun run db:migrate
```

### To Set Up Environment Variables:
Create/update `.env`:
```bash
# Notion
NOTION_API_KEY=secret_xxx

# Google
GOOGLE_CLIENT_ID=xxx
GOOGLE_CLIENT_SECRET=xxx
GOOGLE_REFRESH_TOKEN=xxx

# Anthropic (for classification)
ANTHROPIC_API_KEY=sk-ant-xxx

# Voyage AI (for embeddings - when implemented)
VOYAGE_API_KEY=xxx

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/jd_agent

# Cloudflare R2 (when implemented)
R2_ACCESS_KEY=xxx
R2_SECRET_KEY=xxx
R2_BUCKET=vault-attachments
```

### Quick Start - Test Extractors:

**1. Test Notion:**
```typescript
// src/test-notion.ts
import { createNotionExtractor } from './integrations/notion';

const extractor = createNotionExtractor(process.env.NOTION_API_KEY!);

for await (const entry of extractor.extractAll()) {
  console.log(`📄 ${entry.title}`);
  console.log(`   Path: ${entry.sourcePath}`);
  console.log(`   Content: ${entry.content.substring(0, 100)}...`);
}
```

Run: `bun run src/test-notion.ts`

**2. Test Apple Notes:**
```typescript
// src/test-apple-notes.ts
import { testAppleNotesAccess } from './integrations/apple-notes-extractor';
await testAppleNotesAccess();
```

Run: `bun run src/test-apple-notes.ts`

**3. Test Classification:**
```typescript
// src/test-classification.ts
import { classificationService } from './services/classification-service';
import type { RawEntry } from './types';

const sampleEntry: RawEntry = {
  title: 'Software Engineer Resume',
  content: '# John Doe\n\n## Experience\n- Senior Engineer at Tech Corp\n\n## Education\n- BS Computer Science\n\n## Skills\n- Python, TypeScript, React',
  source: 'google_docs',
  sourceId: 'test-123',
  createdAt: new Date(),
  modifiedAt: new Date(),
};

const result = await classificationService.classify(sampleEntry);
console.log('Classification:', result);
// Should detect as resume!
```

Run: `bun run src/test-classification.ts`

## 📊 Architecture Overview

```
┌──────────────────────────────────────────┐
│         DATA SOURCES                      │
│  Notion │ Google Drive │ Apple Notes     │
└────┬──────────┬──────────────┬───────────┘
     │          │              │
     ▼          ▼              ▼
┌──────────────────────────────────────────┐
│         EXTRACTORS                        │
│  • Fetch & parse content                 │
│  • Convert to RawEntry                    │
│  • Track source metadata                 │
└────────────────┬─────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────┐
│    CONTENT PARSER (Markdown)             │
│  • HTML → Markdown                        │
│  • Notion blocks → Markdown              │
│  • Text normalization                    │
└────────────────┬─────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────┐
│    AI CLASSIFICATION (Claude)            │
│  • Content type detection                │
│  • Category assignment                   │
│  • Tag generation                        │
│  • Resume detection ⭐                    │
│  • Usefulness assessment                 │
└────────────────┬─────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────┐
│    PROCESSING PIPELINE (TODO)            │
│  • Duplicate detection                   │
│  • Embedding generation                  │
│  • Attachment storage (R2)               │
└────────────────┬─────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────┐
│         VAULT (PostgreSQL)               │
│  • vault_entries (+ extensions)          │
│  • vault_attachments                     │
│  • vault_embeddings                      │
│  • sync_state                            │
└──────────────────────────────────────────┘
```

## 🎯 Key Features for Resume Tracking

As you specifically mentioned keeping track of resumes, the system has **multi-layered resume detection**:

1. **During Classification** (classification-service.ts:248):
   - Checks title/filename for "resume", "cv"
   - Checks path for "resume", "career", "job"
   - Checks content structure (Experience + Education + Skills)
   - Requires 2+ signals to confidently flag as resume

2. **Special Handling**:
   - Automatically sets `contentType: 'resume'`
   - Automatically sets `category: 'resume'`
   - Adds tags: `['resume', 'career']`
   - Forces `suggestedAction: 'keep'`
   - Forces `isUseful: true`

3. **Easy Retrieval**:
   ```typescript
   // Find all resumes
   const resumes = await db
     .select()
     .from(vaultEntries)
     .where(eq(vaultEntries.contentType, 'resume'));

   // Or by category
   const resumeCategory = await db
     .select()
     .from(vaultEntries)
     .where(eq(vaultEntries.category, 'resume'));
   ```

## 💡 Recommendations

1. **Start with a small test migration:**
   - Extract from one Notion page or Google Drive folder
   - Verify classification accuracy
   - Check resume detection works correctly

2. **Build the Migration CLI next** to orchestrate the full workflow:
   ```bash
   vault-migrate extract notion --limit 10 --output ./staging
   vault-migrate classify ./staging --output ./classified
   vault-migrate review ./classified  # Opens web UI
   vault-migrate import ./classified
   ```

3. **Add duplicate detection** before full migration to avoid importing duplicates

4. **Set up pgvector** for semantic search to power the resume matching for the Job Application Agent

## 📁 File Structure

```
src/
├── db/
│   ├── schema.ts                    ✅ Extended with migration fields
│   └── migrations/
│       └── 0000_*.sql              ✅ Generated
├── integrations/
│   ├── notion.ts                    ✅ Notion extractor
│   ├── google-drive-extractor.ts    ✅ Google Drive/Docs extractor
│   └── apple-notes-extractor.ts     ✅ Apple Notes extractor
├── services/
│   ├── classification-service.ts    ✅ AI classification
│   ├── vault-service.ts            ✅ Existing
│   └── search-service.ts           ✅ Existing
├── lib/
│   └── content-parser.ts           ✅ Markdown converter
└── types/
    └── index.ts                    ✅ Extended types
```

---

**Total Progress: ~60% Complete** (Core extraction and classification done, need CLI, duplicate detection, embeddings, and UI)
