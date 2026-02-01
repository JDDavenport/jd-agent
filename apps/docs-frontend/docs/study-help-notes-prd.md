# Study-Help Notes Integration PRD

## The Problem

You go to class. You record with Plaud. You take handwritten notes on Remarkable. Later, you need to study.

Right now: hunting through folders, no connection between sources, no way to search "what did the professor say about X?"

**Goal:** One place to review everything from a class, connected and searchable.

---

## User Experience

### The Core Flow

```
Course View → Lectures Tab → Class Day → Unified Review
```

### 1. Lectures Tab (New in CourseView)

When you click into a course, there's a new **Lectures** tab alongside Tasks, Readings, Videos.

**What you see:**
- Timeline of class days (most recent first)
- Each card shows:
  - Date + day of week
  - Duration of recording(s)
  - Preview snippet from transcript
  - Icons for what's available: 🎙️ audio | 📝 handwritten | ⌨️ typed
  - "New" badge if unreviewed

**Quick actions:**
- Click card → full lecture view
- Play button → start audio immediately
- Search bar → find across all lectures

---

### 2. Lecture Detail View (Class Day)

Everything from one class session, unified.

**Layout:**

```
┌────────────────────────────────────────────────────────────┐
│  MBA 560 · Business Analytics                              │
│  Wednesday, January 22, 2026                               │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  🎙️ Audio Player                          1:23:45   │  │
│  │  [▶️ advancement-slider─────────○──────────────────] │  │
│  │  [1x] [⏪ 15s] [⏩ 15s] [📍 Bookmark]               │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                            │
│  ┌──────────────────────┐  ┌──────────────────────────┐   │
│  │ Transcript           │  │ Handwritten Notes        │   │
│  │ (click to jump)      │  │ (Remarkable PDF)         │   │
│  │                      │  │                          │   │
│  │ [00:00] Welcome...   │  │ ┌────────────────────┐   │   │
│  │ [02:34] Today we're  │  │ │                    │   │   │
│  │ going to cover...    │  │ │   (page preview)   │   │   │
│  │ [05:12] The key      │  │ │                    │   │   │
│  │ insight here is...   │  │ └────────────────────┘   │   │
│  │                      │  │ Page 1 of 3  [< >]      │   │
│  └──────────────────────┘  └──────────────────────────┘   │
│                                                            │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ 📌 Key Moments (AI-extracted or your bookmarks)     │  │
│  │                                                      │  │
│  │ [12:34] "The three factors that matter most..."      │  │
│  │ [34:56] "This will be on the exam"                   │  │
│  │ [45:23] Porter's Five Forces explanation             │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                            │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ 🔗 Related                                           │  │
│  │ • Assignment: Case Analysis due Jan 29              │  │
│  │ • Reading: Chapter 4 - Competitive Strategy         │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

**Key Interactions:**

1. **Synced playback** — Click any line in transcript → audio jumps there
2. **Highlight & annotate** — Select text → add note/highlight (persists)
3. **Bookmark moments** — Mark key points for later review
4. **Speed control** — 1x, 1.25x, 1.5x, 2x playback
5. **PDF navigation** — Scroll through Remarkable pages, zoom in
6. **OCR search** — Search finds text in handwritten notes too

---

### 3. Search (Universal)

From any course view, search box that queries:
- All Plaud transcripts for that course
- All Remarkable OCR text
- All typed notes
- Textbook content (existing read-help)

**Results show:**
- Source type icon
- Date
- Snippet with highlighted match
- Click → jump to that moment/page

---

### 4. Review Mode

After a lecture, or before an exam.

**Auto-generated study aids:**
- **Summary** — AI-generated 1-page summary of the lecture
- **Key concepts** — Extracted terms/definitions
- **Flashcards** — Generate cards from lecture content
- **Quiz** — Test yourself on the material

**Spaced repetition:**
- Flashcards from lectures join the existing flashcard system
- Tagged by course + date
- Due dates based on SM-2 algorithm

---

### 5. Quick Capture (Future)

Before class:
- "Start class session" → Begins Plaud recording, creates placeholder

After class:
- Auto-sync pulls recording + Remarkable notes
- Matches to class session by time
- Notifies you: "Analytics lecture ready for review"

---

## Data Model

### What we have (Obsidian Vault)

```
~/Documents/Obsidian/JD Vault/
└── MBA/
    └── Spring 2026/
        └── MBA 560 - Business Analytics/
            ├── Plaud/
            │   ├── 2026-01-22 Lecture title.md  (transcript)
            │   └── 2026-01-22_449aad08.mp3      (audio)
            └── Remarkable/
                └── 2026-01-22 Handwritten Notes.md  (OCR text + PDF link)
```

### What we need (Study-Help DB)

```sql
-- Represents one class session
lectures (
  id, course_id, date, title,
  summary,           -- AI-generated
  status,            -- 'new' | 'reviewed' | 'archived'
  created_at, updated_at
)

-- Individual content pieces within a lecture
lecture_content (
  id, lecture_id, type,  -- 'plaud' | 'remarkable' | 'typed'
  source_path,           -- path to file in vault
  audio_path,            -- path to mp3 (for plaud)
  transcript_text,       -- full text for search
  duration_seconds,
  ocr_text,              -- for remarkable
  pdf_path,
  created_at
)

-- Timestamped bookmarks/highlights
lecture_bookmarks (
  id, lecture_content_id,
  timestamp_seconds,     -- for audio
  page_number,           -- for PDF
  text_selection,
  note,
  is_ai_generated,       -- true for auto-extracted key moments
  created_at
)

-- Flashcards generated from lectures
lecture_flashcards (
  id, lecture_id,
  front, back,
  source_timestamp,      -- where in the lecture this came from
  next_review_at,
  ease_factor,
  interval_days,
  created_at
)
```

---

## Implementation Phases

### Phase 1: Basic Lecture Browser (MVP)
**Time: 2-3 days**

- [ ] Add "Lectures" tab to CourseView
- [ ] Scan Obsidian vault for Plaud files per course
- [ ] Display lecture cards with date, title, duration
- [ ] Basic detail view: audio player + transcript display
- [ ] Click-to-seek (transcript timestamps → audio position)

**Result:** You can browse and play back your lecture recordings in the study app.

---

### Phase 2: Remarkable Integration
**Time: 1-2 days**

- [ ] Scan for Remarkable notes per course/date
- [ ] Display PDF preview alongside transcript
- [ ] OCR text already in markdown files → make searchable
- [ ] Link lectures to same-day handwritten notes

**Result:** Audio + handwritten notes together in one view.

---

### Phase 3: Search & Bookmarks
**Time: 2-3 days**

- [ ] Full-text search across all lecture transcripts
- [ ] Search results with snippets + jump-to-source
- [ ] Manual bookmarking (click to mark key moments)
- [ ] Bookmarks sidebar in lecture view

**Result:** Find anything the professor said, mark important moments.

---

### Phase 4: AI-Powered Review
**Time: 3-4 days**

- [ ] Auto-generate lecture summary on first view
- [ ] Extract key concepts/terms
- [ ] Generate flashcards from lecture content
- [ ] "Key Moments" auto-detection (exam hints, definitions, etc.)
- [ ] Connect flashcards to existing spaced repetition system

**Result:** One click to generate study materials from any lecture.

---

### Phase 5: Smart Linking
**Time: 2 days**

- [ ] Link lectures to Canvas assignments (by date/title)
- [ ] Link lectures to textbook chapters (semantic matching)
- [ ] "Related" section in lecture view
- [ ] Study session: pull all materials for a topic

**Result:** Everything connected. Ask "show me everything about Porter's 5 Forces" → get lecture clips, book sections, notes.

---

## Technical Notes

### Audio Playback
- Use HTML5 `<audio>` with custom controls
- Store playback position (resume where you left off)
- Support 0.5x to 2x speed
- Mobile-friendly: works on phone for commute review

### Transcript Sync
- Plaud transcripts have timestamps in format `[MM:SS]` or `[HH:MM:SS]`
- Parse these, create clickable spans
- Highlight current segment during playback

### File Watching
- Option 1: Scan vault on app load + manual refresh
- Option 2: Watch vault directory for changes (Chokidar)
- Start with Option 1, add watching later

### Search
- Full-text search with SQLite FTS5 or in-memory
- Index on first scan, update incrementally
- Rank by recency + relevance

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Time to find lecture content | 2-5 min (folder hunting) | < 10 seconds |
| Lectures reviewed within 48h | ~20% | > 80% |
| Flashcards from lectures | 0 | 50+ per course |
| Cross-source search | Not possible | Works |

---

## Open Questions

1. **Multiple recordings per class?** Sometimes Plaud creates 2-3 files for one lecture. Merge into single view or show separately?

2. **Remarkable sync frequency?** Auto-sync after each class, or manual trigger?

3. **Offline support?** Should this work without internet (all local files)?

4. **Mobile app?** Phone review for commute? (Future consideration)

---

## Next Steps

1. Review this PRD — any changes to the UX vision?
2. If approved, I start Phase 1 tonight
3. You'll have basic lecture browsing by tomorrow

---

*PRD created: January 29, 2026*
