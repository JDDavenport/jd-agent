# Course AI - Your Personal Tutor PRD

## Vision

Each course becomes your personal AI tutor that knows:
- Every lecture recording and transcript
- All your handwritten notes
- Every reading and textbook
- The subject matter deeply

Ask it anything. Get answers grounded in YOUR materials + expert knowledge.

---

## Course Page Structure

When you click into a course, you see:

```
┌────────────────────────────────────────────────────────────────────┐
│  MBA 560 - Business Analytics                                      │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                                    │
│  [Ask AI]  [Recordings]  [Notes]  [Readings]  [Tasks]              │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

### Tab 1: Ask AI (Default)

Chat interface with your course AI tutor.

```
┌────────────────────────────────────────────────────────────────────┐
│  💬 Ask anything about Business Analytics                          │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │ What are the key assumptions of linear regression?           │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │ 🤖 Based on your Jan 22 lecture and Chapter 4 of the         │ │
│  │    textbook, linear regression assumes:                       │ │
│  │                                                               │ │
│  │    1. **Linearity** - relationship between X and Y is linear │ │
│  │    2. **Independence** - observations are independent        │ │
│  │    3. **Homoscedasticity** - constant variance of errors     │ │
│  │    4. **Normality** - errors are normally distributed        │ │
│  │                                                               │ │
│  │    📎 Sources:                                                │ │
│  │    • Lecture Jan 22 [12:34] - "The four key assumptions..."  │ │
│  │    • Chapter 4, p.87 - Regression assumptions                │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                    │
│  Suggested questions:                                              │
│  • "What will be on the midterm?"                                 │
│  • "Explain ANOVA in simple terms"                                │
│  • "Quiz me on probability concepts"                              │
│  • "Summarize last week's lectures"                               │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

**Capabilities:**
- Answer questions using your materials + subject expertise
- Cite sources (timestamp in recording, page in textbook)
- Generate practice questions
- Create summaries
- Explain concepts at different levels
- Identify what professor emphasized (exam hints)

---

### Tab 2: Recordings

All Plaud recordings for this course.

```
┌────────────────────────────────────────────────────────────────────┐
│  🎙️ Lecture Recordings                                            │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │ Jan 26 - Hypothesis Testing                         1:23:45  │ │
│  │ "What an audacious crazy thing to say..."                    │ │
│  │ 📝 Summary | 🎧 Play | 💡 Key Points                         │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │ Jan 24 - Probability Distributions                  1:45:12  │ │
│  │ "But one of the the most rewarding parts of this jo..."      │ │
│  │ 📝 Summary | 🎧 Play | 💡 Key Points                         │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

**Each recording shows:**
- Date + auto-generated title
- Duration
- Preview snippet
- Quick actions: Summary, Play, Key Points

**Recording Detail View:**
- Audio player with speed controls
- Full transcript with timestamps
- Click-to-seek
- AI-generated summary
- Key points extracted
- Bookmarks/highlights

---

### Tab 3: Notes

Handwritten notes from Remarkable + typed notes.

```
┌────────────────────────────────────────────────────────────────────┐
│  📝 Class Notes                                                    │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │ Jan 26 - Handwritten Notes                          3 pages  │ │
│  │ [Preview thumbnail]                                          │ │
│  │ OCR: "Hypothesis testing steps: 1. State null..."           │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

---

### Tab 4: Readings

Textbooks and PDFs for this course.

```
┌────────────────────────────────────────────────────────────────────┐
│  📚 Course Readings                                                │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │ Business Analytics Textbook                         Ch 1-12  │ │
│  │ Progress: Chapter 4 of 12                                    │ │
│  │ [Continue Reading] [Ask AI about this book]                  │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

---

### Tab 5: Tasks

Existing tasks view, filtered to this course.

---

## Technical Implementation

### Phase 1: Course AI Chat (Tonight)

**Backend:**
1. Create `/api/courses/:courseId/chat` endpoint
2. Load all course materials into context:
   - Plaud transcripts from vault
   - Book chapters from read-help
   - Remarkable notes (OCR text)
3. Use OpenAI with system prompt:
   ```
   You are an expert tutor for [Course Name].
   You have access to the student's lecture recordings, notes, and textbooks.
   Answer questions using their materials when relevant, citing sources.
   You're also an expert in [subject] and can explain concepts beyond the materials.
   ```
4. Return response with source citations

**Frontend:**
1. Add "Ask AI" tab to CourseView (make it the first/default tab)
2. Create chat interface component
3. Display responses with citations
4. Add suggested questions

### Phase 2: Recordings Tab

**Backend:**
1. Create `/api/courses/:courseId/lectures` endpoint
2. Scan Obsidian vault for Plaud files
3. Parse transcript .md files for timestamps
4. Serve audio files via `/api/audio/:path`

**Frontend:**
1. Lecture list view
2. Lecture detail view with audio player
3. Synced transcript with click-to-seek

### Phase 3: Notes + Readings Integration

- Connect Remarkable notes
- Connect existing read-help books
- Unified search across all sources

---

## Data Sources

### Plaud Transcripts (Obsidian Vault)
```
~/Documents/Obsidian/JD Vault/MBA/Spring 2026/
├── MBA 560 - Business Analytics/
│   └── Plaud/
│       ├── 2026-01-26 What an audacious crazy thing to say.md
│       ├── 2026-01-26_22aac570.mp3
│       └── ...
├── MBA 580 - Business Strategy/
│   └── Plaud/
│       └── ...
```

### Course ID to Folder Mapping
```typescript
const COURSE_FOLDERS: Record<string, string> = {
  'analytics': 'MBA 560 - Business Analytics',
  'strategy': 'MBA 580 - Business Strategy',
  'innovation': 'Entrepreneurial Innovation',  // Check actual folder
  'vcpe': 'MBA 664 - Venture Capital',
  'eta': 'MBA 677R - Entrepreneurship',
  'client-acq': 'MBA 654 - Strategic Client',
  'career': 'Post-MBA Career Strategy',  // Check actual folder
};
```

---

## API Endpoints

```
POST /api/courses/:courseId/chat
  body: { message: string, history?: Message[] }
  returns: { response: string, sources: Source[] }

GET /api/courses/:courseId/lectures
  returns: Lecture[]

GET /api/courses/:courseId/lectures/:lectureId
  returns: LectureDetail (with transcript)

GET /api/audio/*
  returns: audio file stream
```

---

## Success Criteria

1. **Ask AI works:** Can ask a question about any course and get a helpful, sourced answer
2. **Recordings accessible:** Can browse and play any lecture recording
3. **Transcript synced:** Clicking transcript jumps to that point in audio
4. **Sources cited:** AI responses reference specific lectures/pages

---

## Build Order (Tonight)

1. ✅ Kill zombie processes, restart backend
2. Create `/api/courses/:courseId/chat` endpoint
3. Create chat UI component
4. Add "Ask AI" tab to CourseView
5. Test chat with real course materials
6. Create `/api/courses/:courseId/lectures` endpoint
7. Create lectures list + detail views
8. Add audio player with transcript sync
9. Full integration test
10. Report to JD

---

*PRD v2 - January 29, 2026*
