# Read Help - Personal Book Learning Assistant

**Status:** Draft
**Created:** 2026-01-26
**Author:** Claude (Product Manager)
**Roadmap Item:** New App

---

## Executive Summary

Read Help is a personal learning assistant that transforms how you consume and retain knowledge from books. Upload your legally-owned PDFs, and Read Help becomes your AI tutor - summarizing chapters, explaining concepts, creating study guides, and testing your understanding. The goal: maximize learning retention while minimizing time spent re-reading.

---

## Problem Statement

### The Pain Points

1. **Time scarcity** - You have limited reading time but many books to get through
2. **Retention gap** - You read a book, but forget 80% within a month
3. **No active learning** - Passive reading doesn't cement knowledge
4. **Context switching** - When returning to a book after days/weeks, you've lost context
5. **No searchability** - Can't find that one quote or concept you vaguely remember
6. **No synthesis** - Hard to connect ideas across multiple books

### Target User

JD - an MBA student and busy professional who needs to:
- Read dozens of business/strategy books per year
- Retain key frameworks and concepts for exams and work
- Reference specific passages and ideas quickly
- Learn efficiently in 15-30 minute sessions

---

## Solution Overview

### Core Value Proposition

**"Your personal book tutor, available 24/7"**

Read Help turns your book library into an interactive learning experience:
- **Upload** your legally-owned PDFs
- **Index** content for instant search
- **Summarize** any chapter in 5, 15, or 30-minute formats
- **Teach** concepts with explanations, examples, and analogies
- **Test** understanding with quizzes and flashcards
- **Connect** ideas across your entire library

---

## User Experience

### User Journey

```
┌─────────────────────────────────────────────────────────────────────┐
│                         READ HELP FLOW                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  1. LIBRARY                    2. BOOK VIEW                          │
│  ┌──────────────────┐         ┌──────────────────┐                  │
│  │ 📚 My Books      │         │ 📖 Book Title    │                  │
│  │                  │  ───►   │                  │                  │
│  │ ▪ Book 1        │         │ Chapters:        │                  │
│  │ ▪ Book 2        │         │ 1. Introduction  │                  │
│  │ ▪ Book 3        │         │ 2. Chapter One   │                  │
│  │                  │         │ 3. Chapter Two   │                  │
│  │ [+ Add Book]     │         │ ...              │                  │
│  └──────────────────┘         └──────────────────┘                  │
│                                        │                             │
│                                        ▼                             │
│  3. LEARNING MODE                                                    │
│  ┌──────────────────────────────────────────────────────┐           │
│  │ Chapter 3: Competitive Strategy                       │           │
│  │                                                       │           │
│  │ ┌─────────────────────────────────────────────────┐  │           │
│  │ │ 🤖 What would you like to do?                   │  │           │
│  │ │                                                  │  │           │
│  │ │ [📝 15-min Summary] [🎓 Teach Me] [❓ Quiz Me]  │  │           │
│  │ │                                                  │  │           │
│  │ │ [🔍 Search] [💡 Key Concepts] [📊 Frameworks]   │  │           │
│  │ └─────────────────────────────────────────────────┘  │           │
│  │                                                       │           │
│  │ Ask anything: "Explain Porter's 5 Forces like I'm 5" │           │
│  │ ┌─────────────────────────────────────┐ [Send]       │           │
│  │ └─────────────────────────────────────┘              │           │
│  └──────────────────────────────────────────────────────┘           │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Key Interactions

#### 1. Add a Book
```
User: Clicks "+ Add Book"
System: Opens file picker for PDF upload
User: Selects PDF file
System:
  - Uploads and stores PDF
  - Extracts text content
  - Identifies chapters/sections
  - Creates searchable index
  - Shows "Book added! Ready to learn."
```

#### 2. Get a Chapter Summary
```
User: Selects Chapter 3, clicks "15-min Summary"
System:
  - Analyzes chapter content
  - Generates structured summary with:
    - Key thesis (1-2 sentences)
    - Main arguments (bullet points)
    - Key frameworks/models
    - Memorable quotes
    - Action items/takeaways
  - Estimated read time shown
```

#### 3. Interactive Teaching
```
User: "Explain the VRIO framework"
System:
  - Finds VRIO content in book
  - Explains concept clearly
  - Provides examples (from book + real-world)
  - Offers to go deeper or quiz understanding
```

#### 4. Quiz Mode
```
User: Clicks "Quiz Me" on Chapter 3
System:
  - Generates 5-10 questions from chapter
  - Mix of multiple choice, true/false, short answer
  - Provides immediate feedback
  - Tracks score and weak areas
  - Suggests review for missed concepts
```

#### 5. Cross-Book Search
```
User: Searches "competitive advantage"
System:
  - Shows results across ALL books
  - Groups by book with context snippets
  - Highlights most relevant passages
  - Offers to synthesize findings
```

---

## Feature Requirements

### P0 - Must Have (MVP)

| ID | Feature | Description | Acceptance Criteria |
|----|---------|-------------|---------------------|
| P0-1 | PDF Upload | Upload PDF files to library | - Accepts PDF files up to 100MB<br>- Shows upload progress<br>- Validates PDF is readable<br>- Stores securely |
| P0-2 | Text Extraction | Extract searchable text from PDFs | - Handles text-based PDFs<br>- Preserves paragraph structure<br>- Identifies page numbers<br>- 95%+ accuracy on clean PDFs |
| P0-3 | Chapter Detection | Auto-detect chapter boundaries | - Identifies TOC if present<br>- Falls back to heading detection<br>- Allows manual chapter marking<br>- Shows chapter list in UI |
| P0-4 | Full-Text Search | Search across all books | - Sub-second search results<br>- Highlights matching text<br>- Shows context around matches<br>- Filters by book |
| P0-5 | Chapter Summary | Generate chapter summaries | - 5, 15, 30-minute lengths<br>- Includes key points, quotes, frameworks<br>- Consistent structure<br>- Regenerate option |
| P0-6 | AI Chat | Ask questions about content | - Context-aware responses<br>- Cites specific pages<br>- Explains concepts<br>- Remembers conversation |
| P0-7 | Book Library | Manage uploaded books | - List all books with metadata<br>- Delete books<br>- View book details<br>- Show reading progress |

### P1 - Should Have

| ID | Feature | Description | Acceptance Criteria |
|----|---------|-------------|---------------------|
| P1-1 | OCR Support | Handle scanned PDFs | - OCR for image-based PDFs<br>- Reasonable accuracy (90%+)<br>- Async processing with status |
| P1-2 | Quiz Generation | Create quizzes from content | - Multiple question types<br>- Difficulty levels<br>- Score tracking<br>- Spaced repetition scheduling |
| P1-3 | Flashcards | Generate and study flashcards | - Auto-generate from content<br>- Manual card creation<br>- Spaced repetition (SM-2)<br>- Progress tracking |
| P1-4 | Highlights & Notes | Annotate while reading | - Highlight text passages<br>- Add notes to highlights<br>- Export annotations<br>- View all highlights for book |
| P1-5 | Reading Progress | Track where you left off | - Remember last position<br>- Show % complete<br>- Estimated time remaining |
| P1-6 | Key Concepts | Extract key terms/concepts | - Auto-identify important terms<br>- Definitions from context<br>- Link to occurrences |

### P2 - Nice to Have

| ID | Feature | Description |
|----|---------|-------------|
| P2-1 | Cross-Book Synthesis | "Compare how Book A and Book B discuss X" |
| P2-2 | Study Plans | Generate multi-week learning plans |
| P2-3 | Audio Summaries | Text-to-speech for summaries |
| P2-4 | Export to Vault | Send notes/summaries to Vault app |
| P2-5 | Legal Book Sources | Integration with Open Library, Gutenberg |
| P2-6 | Reading Statistics | Time spent, books completed, streaks |

---

## Technical Architecture

### System Design

```
┌─────────────────────────────────────────────────────────────────────┐
│                           READ HELP ARCHITECTURE                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐           │
│  │   Frontend  │────►│   Hub API   │────►│  Database   │           │
│  │   (React)   │     │   (Hono)    │     │ (Postgres)  │           │
│  └─────────────┘     └──────┬──────┘     └─────────────┘           │
│                             │                                        │
│                             ▼                                        │
│                      ┌─────────────┐                                │
│                      │   Services  │                                │
│                      └──────┬──────┘                                │
│                             │                                        │
│          ┌─────────────────┼─────────────────┐                      │
│          ▼                  ▼                 ▼                      │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐               │
│  │ PDF Service │   │ AI Service  │   │Search Index │               │
│  │ - Extract   │   │ - Summarize │   │ (Postgres   │               │
│  │ - OCR       │   │ - Chat      │   │  Full-Text) │               │
│  │ - Parse     │   │ - Quiz      │   │             │               │
│  └─────────────┘   └─────────────┘   └─────────────┘               │
│                                                                      │
│  Storage: /hub/storage/read-help/books/{book_id}/                   │
│           - original.pdf                                             │
│           - content.json (extracted text)                            │
│           - chapters.json (structure)                                │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Database Schema

```sql
-- Books table
CREATE TABLE read_help_books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  author TEXT,
  file_path TEXT NOT NULL,
  file_size_bytes INTEGER,
  page_count INTEGER,
  status TEXT DEFAULT 'processing', -- processing, ready, error
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Chapters table
CREATE TABLE read_help_chapters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID REFERENCES read_help_books(id) ON DELETE CASCADE,
  chapter_number INTEGER NOT NULL,
  title TEXT,
  start_page INTEGER,
  end_page INTEGER,
  content TEXT NOT NULL,
  summary_short TEXT,
  summary_medium TEXT,
  summary_long TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Search index (using pg_tsvector)
CREATE TABLE read_help_search_index (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID REFERENCES read_help_books(id) ON DELETE CASCADE,
  chapter_id UUID REFERENCES read_help_chapters(id) ON DELETE CASCADE,
  page_number INTEGER,
  content TEXT NOT NULL,
  search_vector TSVECTOR,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_search_vector ON read_help_search_index USING GIN(search_vector);

-- Chat history
CREATE TABLE read_help_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID REFERENCES read_help_books(id) ON DELETE CASCADE,
  chapter_id UUID REFERENCES read_help_chapters(id),
  messages JSONB DEFAULT '[]',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Highlights and notes
CREATE TABLE read_help_highlights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID REFERENCES read_help_books(id) ON DELETE CASCADE,
  chapter_id UUID REFERENCES read_help_chapters(id),
  page_number INTEGER,
  start_offset INTEGER,
  end_offset INTEGER,
  highlighted_text TEXT NOT NULL,
  note TEXT,
  color TEXT DEFAULT 'yellow',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Quiz results
CREATE TABLE read_help_quiz_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID REFERENCES read_help_books(id) ON DELETE CASCADE,
  chapter_id UUID REFERENCES read_help_chapters(id),
  questions JSONB NOT NULL,
  answers JSONB NOT NULL,
  score DECIMAL(5,2),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Reading progress
CREATE TABLE read_help_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID REFERENCES read_help_books(id) ON DELETE CASCADE,
  current_page INTEGER DEFAULT 1,
  current_chapter_id UUID REFERENCES read_help_chapters(id),
  percent_complete DECIMAL(5,2) DEFAULT 0,
  last_read_at TIMESTAMP DEFAULT NOW(),
  total_reading_time_minutes INTEGER DEFAULT 0
);
```

### API Endpoints

```
Books
-----
POST   /api/read-help/books              Upload a new book (multipart/form-data)
GET    /api/read-help/books              List all books
GET    /api/read-help/books/:id          Get book details
DELETE /api/read-help/books/:id          Delete a book
GET    /api/read-help/books/:id/status   Get processing status

Chapters
--------
GET    /api/read-help/books/:id/chapters           List chapters
GET    /api/read-help/chapters/:id                 Get chapter content
GET    /api/read-help/chapters/:id/summary/:length Get summary (short/medium/long)
POST   /api/read-help/chapters/:id/summary         Generate/regenerate summary

Search
------
GET    /api/read-help/search?q=...&book_id=...     Search across books

AI/Learning
-----------
POST   /api/read-help/chat                         Chat about content
POST   /api/read-help/chapters/:id/quiz            Generate quiz
POST   /api/read-help/chapters/:id/quiz/submit     Submit quiz answers
GET    /api/read-help/chapters/:id/concepts        Get key concepts

Highlights
----------
POST   /api/read-help/highlights                   Create highlight
GET    /api/read-help/books/:id/highlights         Get book highlights
DELETE /api/read-help/highlights/:id               Delete highlight

Progress
--------
GET    /api/read-help/books/:id/progress           Get reading progress
PUT    /api/read-help/books/:id/progress           Update progress
```

---

## UI/UX Specifications

### Pages

#### 1. Library Page (`/read-help`)
- Grid or list view of all books
- Book cards show: cover (if extractable), title, author, progress bar, last read
- Search/filter bar at top
- "+ Add Book" prominent button
- Empty state with onboarding for new users

#### 2. Book Detail Page (`/read-help/books/:id`)
- Book metadata (title, author, pages, added date)
- Chapter list with completion status
- Quick actions: Search book, View highlights, Continue reading
- Reading progress visualization

#### 3. Chapter/Learning Page (`/read-help/books/:id/chapters/:id`)
- Chapter title and content
- Sidebar with AI assistant chat
- Action buttons: Summary, Quiz, Key Concepts
- Highlight capability on text selection
- Navigation between chapters

#### 4. Search Results Page (`/read-help/search`)
- Search input with filters (by book, by chapter)
- Results grouped by book
- Snippet preview with highlighted matches
- Click to go to location in book

### Design Tokens

```css
/* Colors - extend existing JD Agent theme */
--read-help-primary: #6366f1;      /* Indigo for learning */
--read-help-highlight-yellow: #fef08a;
--read-help-highlight-green: #bbf7d0;
--read-help-highlight-blue: #bfdbfe;
--read-help-highlight-pink: #fbcfe8;

/* Status colors */
--read-help-processing: #fbbf24;
--read-help-ready: #22c55e;
--read-help-error: #ef4444;
```

---

## Non-Functional Requirements

### Performance
- PDF upload: Accept up to 100MB files
- Text extraction: Complete within 30 seconds for typical book
- Search: Results in < 500ms
- Summary generation: Complete within 10 seconds
- Page load: < 2 seconds

### Security
- PDFs stored in user's local Hub storage (not cloud)
- No sharing of content with third parties
- AI requests only send relevant excerpts, not full books

### Reliability
- Graceful handling of corrupt PDFs
- Resume interrupted uploads
- Retry failed AI requests

---

## Testing Requirements

### Unit Tests

| Area | Test Cases |
|------|------------|
| PDF Service | - Extract text from valid PDF<br>- Handle password-protected PDF (reject with message)<br>- Handle corrupt PDF (error gracefully)<br>- Extract page count<br>- Identify chapter boundaries |
| Search Service | - Index content correctly<br>- Return relevant results<br>- Handle special characters<br>- Rank by relevance<br>- Filter by book |
| Summary Service | - Generate short summary (< 500 words)<br>- Generate medium summary (< 1500 words)<br>- Include key quotes<br>- Handle empty chapter |
| Quiz Service | - Generate valid questions<br>- Score answers correctly<br>- Handle edge cases |

### Integration Tests

| Scenario | Steps | Expected |
|----------|-------|----------|
| Upload and process book | 1. Upload PDF<br>2. Wait for processing<br>3. Verify chapters detected | Book appears in library with chapters |
| Search across books | 1. Upload 2 books<br>2. Search common term<br>3. Verify results from both | Results from both books shown |
| Generate and take quiz | 1. Go to chapter<br>2. Generate quiz<br>3. Answer questions<br>4. Submit | Score calculated, results saved |
| Chat about content | 1. Go to chapter<br>2. Ask question<br>3. Verify response cites book | AI responds with page references |

### E2E Tests

```typescript
// tests/read-help.spec.ts

describe('Read Help', () => {
  describe('Book Management', () => {
    it('should upload a PDF and show in library', async () => {
      // Upload test PDF
      // Wait for processing
      // Verify appears in library
      // Verify chapters detected
    });

    it('should delete a book and remove all data', async () => {
      // Upload book
      // Delete book
      // Verify removed from library
      // Verify search returns no results
    });
  });

  describe('Chapter Summaries', () => {
    it('should generate 15-minute summary', async () => {
      // Navigate to chapter
      // Click 15-min summary
      // Verify summary appears
      // Verify contains key sections
    });

    it('should cache summaries for instant access', async () => {
      // Generate summary
      // Navigate away
      // Return to chapter
      // Verify instant load (no regeneration)
    });
  });

  describe('Search', () => {
    it('should find text across multiple books', async () => {
      // Upload 2 books with known content
      // Search for term in both
      // Verify results from both books
    });

    it('should highlight search matches in context', async () => {
      // Search for term
      // Verify match is highlighted
      // Verify surrounding context shown
    });
  });

  describe('AI Chat', () => {
    it('should answer questions about chapter content', async () => {
      // Go to chapter
      // Ask "What is the main argument?"
      // Verify relevant response
    });

    it('should cite page numbers in responses', async () => {
      // Ask about specific concept
      // Verify response includes page reference
    });
  });

  describe('Quiz', () => {
    it('should generate quiz from chapter', async () => {
      // Go to chapter
      // Click Quiz Me
      // Verify questions generated
      // Verify multiple question types
    });

    it('should score quiz correctly', async () => {
      // Take quiz
      // Submit answers
      // Verify score calculated
      // Verify feedback shown
    });
  });
});
```

---

## Implementation Plan

### Phase 1: Core Infrastructure (MVP)
1. Database schema and migrations
2. PDF upload and storage
3. Text extraction service
4. Chapter detection
5. Basic library UI

### Phase 2: Search & Summaries
1. Full-text search indexing
2. Search UI with filters
3. Summary generation (3 lengths)
4. Summary caching

### Phase 3: AI Learning Features
1. Chat interface
2. Context-aware AI responses
3. Quiz generation
4. Quiz scoring and feedback

### Phase 4: Polish & Enhancement
1. Highlights and notes
2. Reading progress tracking
3. Cross-book features
4. Performance optimization

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Books uploaded | 20+ books in first month |
| Summaries generated | 50+ summaries |
| Quiz completion rate | 70%+ started quizzes completed |
| Search usage | 10+ searches per week |
| Time to value | < 5 minutes from upload to first summary |

---

## Legal Considerations

### Important Notice

Read Help is designed for **legally obtained content only**:

- Books you have purchased (Kindle, Google Books, etc.)
- Public domain works (Project Gutenberg, etc.)
- Academic materials you have legitimate access to
- Your own documents and notes

The system does NOT:
- Help find or download pirated content
- Share your content with others
- Upload content to any cloud service (stays local)

---

## Appendix

### Sample Test PDFs

For development and testing, use:
1. **Public domain classics** from Project Gutenberg (gutenberg.org)
2. **Open textbooks** from OpenStax (openstax.org)
3. **Your own documents** for real-world testing

### Competitor Analysis

| Product | Strengths | Weaknesses | Read Help Advantage |
|---------|-----------|------------|---------------------|
| Blinkist | Great summaries | Only their library, subscription | Your own books |
| Readwise | Highlight sync | No AI summaries | Full AI tutor |
| Notion | Flexible | Manual everything | Auto-extraction, AI |
| ChatGPT | Powerful AI | No persistent library | Organized, searchable |

---

*Last Updated: 2026-01-26*
