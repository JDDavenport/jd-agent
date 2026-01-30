# JD Agent Integrations PRD

## Learning Materials Integration System

**Version:** 1.0  
**Last Updated:** January 29, 2025  
**Author:** JD Agent System

---

## Executive Summary

JD Agent aims to be a **one-stop-shop for all learning materials** - unifying voice notes (Plaud), handwritten notes (Remarkable), and documents (Vault) into a single searchable, connected knowledge base integrated with the study workflow.

This PRD documents the current state, gaps, and roadmap for the three core integrations: **Vault**, **Plaud**, and **Remarkable**.

---

## 1. Integration Overview

### 1.1 Vault (Knowledge Base)

**Purpose:** Central storage for all knowledge, notes, and documents with Notion-like organization.

**Current Implementation:**
- `vault-service.ts` - Core CRUD, search, hierarchical pages, version management, attachments
- `vault-page-service.ts` - Notion-like pages with PARA organization (Projects, Areas, Resources, Archive)
- `vault-block-service.ts` - Block-based content (text, headings, lists, code, etc.)
- `vault-embedding-service.ts` - Semantic search using Voyage AI / OpenAI embeddings

**Data Model:**
```
vault_entries     - Legacy flat entries (being migrated to pages)
vault_pages       - Hierarchical Notion-like pages with PARA structure
vault_blocks      - Content blocks within pages
vault_embeddings  - Semantic search embeddings (chunks)
vault_attachments - File attachments (PDFs, images, etc.)
vault_references  - Cross-system links (to tasks, goals, calendar events)
```

**Status: ✅ Working** - Core functionality complete, semantic search functional

---

### 1.2 Plaud (Voice Recordings)

**Purpose:** Sync and process voice recordings from Plaud device/app with transcription.

**Current Implementation:**
- `plaud-sync-service.ts` - Downloads from web.plaud.ai using browser session (audio + transcripts + summaries)
- `plaud-browser-sync.ts` - Playwright-based sync with persistent auth
- `plaud-gdrive-sync.ts` - Polls Google Drive for Plaud exports (alternative workflow)
- `plaud-scraper.ts` - Web scraping utilities

**Sync Workflows:**
1. **Direct Web Sync:** Authenticates to web.plaud.ai, downloads all recordings/transcripts
2. **Google Drive Sync:** Monitors GDrive "Plaud" folder for shared exports
3. **Browser Sync:** Uses Playwright persistent context for automated login

**Data Model:**
```
recordings        - Recording metadata (path, duration, type, status)
transcripts       - Transcript content linked to recordings
class_pages       - Plaud transcripts linked to class/calendar events
```

**Output:**
- Downloads to `/Users/jddavenport/Documents/PlaudSync/`
- Per-recording folders: `{date}_{title}_{id}/`
  - `metadata.json` - Recording info
  - `audio.m4a` - Audio file
  - `transcript.json` - Structured transcript
  - `transcript.txt` - Human-readable format
  - `summary.md` - AI-generated summary

**Status: ⚠️ Partially Working**
- Web sync works when session is valid
- Session expires frequently requiring manual re-login
- No automatic vault page creation
- Google Drive sync configured but rarely used

---

### 1.3 Remarkable (E-ink Tablet Notes)

**Purpose:** Sync handwritten notes from Remarkable tablet, OCR them, and integrate into study workflow.

**Current Implementation:**
- `remarkable-cloud-sync.ts` - Polls Remarkable Cloud API for document changes, downloads .rm files, renders to PDF, OCR extraction
- `remarkable-mba-sync.ts` - Maps MBA folder structure to Vault pages
- `remarkable-service.ts` - Business logic for content merging, combined markdown generation
- `remarkable-gdrive-sync.ts` - Alternative: monitors Google Drive for Remarkable exports

**Key Features:**
- Device token authentication with user token refresh
- Full document download (.rm → PDF → OCR pipeline)
- Apple Vision OCR with Tesseract fallback
- Folder structure awareness (BYU MBA → Semester → Class → Notes)
- Daily note grouping per class

**Data Model:**
```
remarkable_notes       - Note metadata, classification, OCR text
remarkable_sync_state  - Sync tracking state
remarkable_vault_sync  - Links between Remarkable docs and Vault pages
```

**Output:**
- PDFs stored in `storage/remarkable/`
- OCR text stored in database
- Vault pages created with content blocks

**Status: ⚠️ Partially Working**
- Cloud sync functional when device token valid
- PDF rendering works (requires `rmc`, `cairosvg`, `pdfunite`)
- OCR extraction works (Apple Vision + Tesseract)
- MBA folder sync implemented but untested in production
- Combined markdown generation incomplete

---

## 2. Study-Help App Integration

### 2.1 Read-Help Service

**Purpose:** AI-powered textbook reading assistant with Q&A, summaries, flashcards.

**Current Implementation:** `read-help-service.ts`
- Book upload and PDF processing
- Chapter extraction and summarization
- Semantic search across books
- AI chat with citations
- Quiz generation
- Spaced repetition flashcards

**Integration Points:**
- Books should auto-import from Vault attachments
- Transcripts from class recordings should link to relevant book chapters
- Remarkable notes should cross-reference textbooks
- Flashcards should pull from ALL sources (books, notes, recordings)

**Status: ✅ Standalone Working** - Not yet integrated with other sources

---

## 3. User Stories

### 3.1 Class Day Workflow

**As a student, I want all my class materials in one place after each lecture.**

**Flow:**
1. Before class: Download preclass materials to Remarkable
2. During class: Take handwritten notes on Remarkable, Plaud records lecture
3. After class: System automatically:
   - Syncs Remarkable notes → OCR → Vault page
   - Syncs Plaud recording → Transcription → Same Vault page
   - Links to Canvas assignment/module
   - Generates combined study notes

**Current Gap:** Manual merging required, no automatic linking to calendar events

---

### 3.2 Universal Search

**As a student, I want to search ALL my materials with one query.**

**Flow:**
1. Enter search: "What are the 5 forces in Porter's framework?"
2. System searches:
   - Vault pages/entries
   - Plaud transcripts
   - Remarkable OCR text
   - Read-Help books/chapters
3. Results ranked by relevance with source attribution

**Current Gap:** Search only covers Vault entries, other sources not indexed

---

### 3.3 Study Session

**As a student, I want to review all materials for an upcoming exam.**

**Flow:**
1. Select class/exam date range
2. System aggregates:
   - Class day combined notes
   - Relevant textbook sections
   - Flashcards from all sources
3. AI generates study guide with key concepts

**Current Gap:** No unified aggregation, manual collection required

---

### 3.4 Quick Capture

**As a student, I want voice notes to auto-file themselves.**

**Flow:**
1. Record quick thought with Plaud
2. System:
   - Transcribes automatically
   - AI detects context (class, project, personal)
   - Files to appropriate Vault folder
   - Creates/updates relevant page

**Current Gap:** Classification works but Vault filing is broken

---

## 4. Current State Analysis

### 4.1 What's Working ✅

| Component | Status | Notes |
|-----------|--------|-------|
| Vault CRUD | ✅ | Full create/read/update/delete |
| Vault Pages/Blocks | ✅ | Notion-like structure |
| Vault Semantic Search | ✅ | Embeddings via Voyage AI |
| Plaud Web Sync | ⚠️ | Works when session valid |
| Plaud Transcript Download | ✅ | JSON + TXT formats |
| Remarkable Cloud Auth | ⚠️ | Device token required |
| Remarkable PDF Render | ✅ | rmc → cairosvg pipeline |
| Remarkable OCR | ✅ | Apple Vision + Tesseract |
| Read-Help Books | ✅ | Upload, search, chat |

### 4.2 What's Broken/Missing ❌

| Component | Issue | Priority |
|-----------|-------|----------|
| Plaud → Vault sync | No automatic page creation | HIGH |
| Plaud session renewal | Expires frequently, no auto-refresh | HIGH |
| Remarkable → Vault sync | MBA sync untested | HIGH |
| Combined markdown | Only generates on demand | MEDIUM |
| Calendar linking | Class detection broken | HIGH |
| Universal search | Only searches Vault | HIGH |
| Cross-source flashcards | Not implemented | MEDIUM |
| Preclass tracking | Canvas → Vault broken | MEDIUM |

### 4.3 Dependencies & Configuration

**Required Environment Variables:**
```bash
# Plaud
PLAUD_EMAIL=your@email.com
PLAUD_PASSWORD=your_password
PLAUD_SYNC_PATH=/path/to/plaud/sync

# Google Drive (for GDrive sync)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REFRESH_TOKEN=
PLAUD_GDRIVE_FOLDER=Plaud

# Remarkable
REMARKABLE_DEVICE_TOKEN=
REMARKABLE_SYNC_PATH=/path/to/remarkable/sync
RMC_BIN_PATH=/usr/local/bin/rmc

# Embeddings
VOYAGE_API_KEY= (or OPENAI_API_KEY)

# Vault
VAULT_BASE_PATH=./vault
```

**System Dependencies:**
- `rmc` (v6) - Remarkable file converter
- `cairosvg` - SVG to PDF conversion
- `pdfunite` or `PyPDF2` - PDF merging
- `pdf2image` - PDF page extraction for OCR
- `tesseract` - OCR fallback
- Python with `cairosvg`, `pdf2image`, `pytesseract`

---

## 5. Technical Requirements

### 5.1 Unified Content Pipeline

```
[Plaud Recording] → Transcription → Classification → Vault Page
                                  ↘
[Remarkable Note] → PDF → OCR → Classification → Vault Page (merged)
                                  ↗
[Typed Notes] → Direct Entry → Classification → Vault Page (merged)
```

**Key Requirement:** All sources should merge into a SINGLE Vault page per class day.

### 5.2 Content Classification

The `class-detection-service.ts` should:
1. Detect class name from content/timestamp
2. Match to active semester courses
3. Link to Canvas course/project
4. Create/update appropriate Vault page hierarchy

**Hierarchy:**
```
Vault (root)
└── Projects (PARA)
    └── MBA Winter 2026
        └── MBA 560 - Business Analytics
            └── Class Days
                └── 2025-01-29
                    ├── typed-notes (block)
                    ├── plaud-transcript (block)
                    └── remarkable-notes (block + PDF attachment)
```

### 5.3 Indexing for Universal Search

All content sources must be embedded for semantic search:
1. Vault pages/blocks - Already working
2. Plaud transcripts - **TODO:** Index on sync
3. Remarkable OCR - **TODO:** Index on sync
4. Read-Help chapters - Already indexed within read-help

**Proposed Solution:** Create embeddings for ALL content types with source metadata, store in unified `vault_embeddings` table.

### 5.4 Sync Scheduling

| Source | Frequency | Trigger |
|--------|-----------|---------|
| Plaud Web | Every 30 min | Cron job |
| Plaud GDrive | Every 15 min | Polling |
| Remarkable Cloud | Every 30 min | Polling |
| Canvas | On demand + daily | Manual + cron |

---

## 6. Recommended Improvements

### 6.1 High Priority

1. **Fix Plaud Session Management**
   - Implement persistent login with auto-refresh
   - Store session cookies in database, not just file
   - Add session health check to heartbeat

2. **Complete Remarkable → Vault Pipeline**
   - Test and fix MBA folder sync
   - Enable automatic OCR on sync
   - Create Vault pages with proper hierarchy

3. **Implement Combined Markdown Generation**
   - Trigger on any source update for a class/day
   - Merge all available content into single page
   - Update existing page rather than creating duplicates

4. **Universal Search Index**
   - Extend `vault-embedding-service` to index all sources
   - Add source metadata to search results
   - Build unified search API endpoint

### 6.2 Medium Priority

5. **Calendar Event Linking**
   - Match recordings to calendar events by timestamp
   - Auto-detect class from event title
   - Link Vault pages to calendar events

6. **Preclass Material Tracking**
   - Scrape Canvas modules for preclass items
   - Track completion status
   - Show in daily briefing

7. **Cross-Source Flashcards**
   - Extract key concepts from all sources
   - Deduplicate across sources
   - Unified spaced repetition

### 6.3 Future Enhancements

8. **AI Study Buddy**
   - Chat interface that understands all sources
   - Generate study guides on demand
   - Suggest related materials

9. **Mobile Quick Capture**
   - Voice notes from phone → Plaud pipeline
   - Photos of whiteboard → OCR → Vault

10. **Export & Sharing**
    - Export combined notes as PDF
    - Share study materials with classmates

---

## 7. Implementation Roadmap

### Phase 1: Foundation (Week 1-2)
- [ ] Fix Plaud session management
- [ ] Test/fix Remarkable Cloud sync
- [ ] Implement auto Vault page creation

### Phase 2: Integration (Week 3-4)
- [ ] Combined markdown generation
- [ ] Calendar event linking
- [ ] Universal search indexing

### Phase 3: Enhancement (Week 5-6)
- [ ] Preclass tracking
- [ ] Cross-source flashcards
- [ ] Study session aggregation

### Phase 4: Polish (Week 7-8)
- [ ] Mobile quick capture
- [ ] AI study buddy
- [ ] Export capabilities

---

## 8. Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Plaud sync success rate | ~60% | 95%+ |
| Remarkable sync success rate | Unknown | 95%+ |
| Average time to combined notes | Manual | <5 min auto |
| Search coverage | Vault only | All sources |
| Daily active use | Sporadic | Daily |

---

## 9. Appendix

### A. File Locations

```
~/projects/JD Agent/hub/src/services/
├── vault-service.ts
├── vault-page-service.ts
├── vault-block-service.ts
├── vault-embedding-service.ts
├── plaud-sync-service.ts
├── plaud-browser-sync.ts
├── plaud-gdrive-sync.ts
├── remarkable-cloud-sync.ts
├── remarkable-service.ts
├── remarkable-mba-sync.ts
├── remarkable-gdrive-sync.ts
├── class-detection-service.ts
└── read-help-service.ts
```

### B. Database Tables

```sql
-- Vault
vault_entries
vault_pages
vault_blocks
vault_embeddings
vault_attachments
vault_references

-- Plaud
recordings
transcripts
class_pages

-- Remarkable
remarkable_notes
remarkable_sync_state
remarkable_vault_sync
```

### C. API Endpoints (Recommended)

```
POST   /api/sync/plaud        - Trigger Plaud sync
POST   /api/sync/remarkable   - Trigger Remarkable sync
GET    /api/sync/status       - Get all sync statuses

GET    /api/search            - Universal search
GET    /api/search/semantic   - Semantic search across all sources

GET    /api/class-day/:date   - Get all materials for a class day
POST   /api/class-day/merge   - Force merge/regenerate combined notes
```

---

*Document generated by JD Agent analysis of existing codebase.*
