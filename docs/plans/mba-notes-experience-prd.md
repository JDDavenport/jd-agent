# MBA Notes Experience - Product Requirements Document

**Status:** In Progress
**Last Updated:** 2026-01-26
**Owner:** Product Team

---

## Vision

Transform the Vault MBA Classes feature into a delightful, customer-ready experience that makes it effortless to find, review, and learn from class materials. Users should have complete confidence that recordings, handwritten notes, and summaries are correctly matched to each class session.

---

## User Stories

### Primary Persona: MBA Student (JD)

1. **As a student, I want to quickly find my notes for any class period** so I can review before exams or reference during projects.

2. **As a student, I want to see an AI-generated summary with key takeaways** so I can quickly understand what was covered without re-reading everything.

3. **As a student, I want to see my actual handwritten notes (PDF)** so I can see diagrams, equations, and visual notes I made.

4. **As a student, I want the OCR text searchable** so I can find specific topics across all my notes.

5. **As a student, I want confidence that the recording and PDF match the correct class** so I don't accidentally study the wrong material.

6. **As a student, I want an easy review experience** so I can efficiently prepare for exams and reinforce learning.

---

## Feature Specification

### 1. Class Session Page (Redesigned)

#### 1.1 Session Header
- Class name + Date prominently displayed
- Breadcrumb navigation: MBA BYU > Winter2026 > Strategy > Jan 15
- Quick nav arrows to previous/next session

#### 1.2 Summary Card (NEW - Top of Page)
```
┌─────────────────────────────────────────────────────────┐
│ 📝 Class Summary                                        │
├─────────────────────────────────────────────────────────┤
│ This class covered Porter's Five Forces framework and   │
│ how to apply competitive analysis to real businesses.   │
│                                                         │
│ Key Takeaways:                                          │
│ • Five Forces: Suppliers, Buyers, Substitutes, Entry,   │
│   Rivalry                                               │
│ • Used Tesla case study to illustrate industry analysis │
│ • Next week: Value chain analysis                       │
│                                                         │
│ ⏱️ 73 min lecture | 📄 2 pages notes | ✓ High confidence│
└─────────────────────────────────────────────────────────┘
```

#### 1.3 Content Tabs
- **Summary** (default) - AI-generated overview
- **Recording** - Full transcript with timestamps
- **Handwritten Notes** - PDF viewer + OCR text
- **Review** - Study mode with key points

#### 1.4 Confidence Indicator
- Visual indicator showing match confidence
- Green checkmark: High confidence (>90%)
- Yellow warning: Medium confidence (70-90%)
- Red alert: Low confidence (<70%) - needs verification
- Hover tooltip explains how matching was determined

### 2. PDF Viewer Component (NEW)

#### 2.1 Features
- Inline PDF display (not just download link)
- Page navigation controls
- Zoom in/out
- Full-screen mode
- Download button
- Side-by-side with OCR text option

#### 2.2 Fallback
- If PDF not available, show prominent "No PDF attached" message
- Link to Remarkable sync settings

### 3. AI Summary Generation (Backend)

#### 3.1 Summary Contents
- **Overview**: 2-3 sentence summary of the class
- **Key Takeaways**: 3-5 bullet points
- **Topics Covered**: List of main topics
- **Action Items**: Any homework, readings, deadlines mentioned
- **Questions to Review**: Important concepts to remember

#### 3.2 Generation Trigger
- Automatic when transcript is available
- Re-generate button for manual refresh
- Combine transcript + OCR text for better context

### 4. Study/Review Mode (NEW)

#### 4.1 Features
- Focus view with distractions removed
- Key points highlighted
- Flashcard-style navigation
- Progress tracking (reviewed/not reviewed)
- Quick notes feature for study annotations

#### 4.2 Class Overview Dashboard
- All sessions for a class in timeline view
- Visual indicators for reviewed/not reviewed
- Quick stats: total hours, pages, sessions

### 5. Search Enhancements

#### 5.1 Scope
- Search across all class transcripts
- Search across all OCR text
- Search across summaries
- Filter by class, date range, content type

#### 5.2 Results
- Show matching snippet with highlight
- Navigate directly to relevant section
- Show which class/session the result is from

---

## Technical Implementation

### Phase 1: Data Foundation (Backend)

1. **Recording Summary Generation**
   - Create job to generate summaries for recordings with transcripts
   - Store in `recordingSummaries` table (already exists)
   - Include key points, topics, action items

2. **PDF Linking**
   - Ensure Remarkable PDFs are linked to correct session pages
   - Store `pdfPath` on session page or create attachment
   - Add confidence score for PDF-session match

3. **Confidence Scoring**
   - Calculate match confidence based on:
     - Date match (recording date vs session date)
     - Content match (transcript keywords vs class name)
     - Time proximity (recording time vs class schedule)
   - Store confidence score with each recording-session link

### Phase 2: Session Page UI (Frontend)

1. **Summary Card Component**
   - Fetch summary from API
   - Display key takeaways prominently
   - Show metadata (duration, pages, confidence)

2. **Tabbed Interface**
   - Summary | Recording | Notes | Review tabs
   - Lazy load content for each tab
   - Persist selected tab in URL

3. **PDF Viewer**
   - Integrate PDF.js library
   - Page navigation, zoom, fullscreen
   - Mobile-responsive design

4. **Confidence Indicator**
   - Visual badge component
   - Tooltip with explanation
   - Link to verification flow if low confidence

### Phase 3: Study Mode (Frontend)

1. **Review View Component**
   - Focused study interface
   - Key points as cards
   - Navigation between sessions

2. **Progress Tracking**
   - Track reviewed sessions (localStorage or DB)
   - Visual progress indicators
   - Streak/gamification elements

### Phase 4: Polish & Testing

1. **Loading States**
   - Skeleton loaders for all components
   - Progressive loading for large content

2. **Error Handling**
   - Graceful fallbacks for missing data
   - User-friendly error messages
   - Retry mechanisms

3. **E2E Testing**
   - Test all user flows
   - Test edge cases (missing data, slow network)
   - Mobile testing

4. **Accessibility**
   - Keyboard navigation
   - Screen reader support
   - Color contrast compliance

---

## Success Metrics

1. **Findability**: User can locate any class session in <10 seconds
2. **Completeness**: 95%+ of sessions have summary, recording, and notes linked
3. **Confidence**: 90%+ of sessions have high confidence match
4. **Usability**: User can complete review of one session in <5 minutes
5. **Satisfaction**: Would recommend score of 8+ out of 10

---

## Timeline

| Phase | Description | Duration |
|-------|-------------|----------|
| Phase 1 | Data Foundation | Today |
| Phase 2 | Session Page UI | Today |
| Phase 3 | Study Mode | Today |
| Phase 4 | Polish & Testing | Today |

---

## Open Questions

1. Should summaries be editable by the user?
2. Should we support multiple PDFs per session (multiple pages of notes)?
3. Should review progress sync across devices?

---

## Appendix: Current Data Status

### Recordings with Transcripts
- Query needed to assess coverage

### Remarkable PDFs Linked
- ~20 PDFs in storage
- Need to verify linkage to sessions

### Existing Summaries
- `recordingSummaries` table exists
- Need to check population status
