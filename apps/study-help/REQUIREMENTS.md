# Study-Help App Requirements

## Overview
A comprehensive study dashboard for BYU MBA students that integrates Canvas tasks with reading materials, videos, and AI-powered study tools.

---

## Core Requirements

### R1: Dashboard (Home Page)
| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| R1.1 | Show greeting with user name and current date | P0 | ✅ |
| R1.2 | Display total task count across all courses | P0 | ✅ |
| R1.3 | Show estimated study time (sum of task estimates) | P1 | ✅ |
| R1.4 | Show count of tasks due today/tomorrow | P0 | ✅ |
| R1.5 | Show completed task count | P1 | ✅ |
| R1.6 | Show flashcards due count with link | P1 | ✅ |
| R1.7 | "Needs Attention" section for overdue/urgent tasks | P0 | ✅ |
| R1.8 | Course cards with task counts and progress | P0 | ✅ |
| R1.9 | Quick actions: Flashcards, Timer, Progress | P1 | ✅ |
| R1.10 | Clicking course card navigates to course view | P0 | ✅ |

### R2: Course View
| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| R2.1 | Show course name, code, and semester | P0 | ✅ |
| R2.2 | Display course-specific stats (active, done, hours) | P0 | ✅ |
| R2.3 | "Ask AI" tab with course-specific chat | P1 | ✅ |
| R2.4 | "Class Notes" tab showing lecture materials | P1 | ✅ |
| R2.5 | "Tasks" tab with filterable task list | P0 | ✅ |
| R2.6 | "Materials" tab showing PDFs and videos | P0 | ✅ |
| R2.7 | "Calendar" tab with upcoming deadlines | P2 | ✅ |
| R2.8 | Task completion with undo toast | P0 | ✅ |
| R2.9 | Task detail modal on click | P0 | ✅ |

### R3: Task Management
| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| R3.1 | Fetch tasks from Canvas via API | P0 | ✅ |
| R3.2 | Filter tasks by course context | P0 | ✅ |
| R3.3 | Sort tasks by due date | P0 | ✅ |
| R3.4 | Mark task complete with API call | P0 | ✅ |
| R3.5 | Undo task completion within 5 seconds | P1 | ✅ |
| R3.6 | Show task description in modal | P0 | ✅ |
| R3.7 | Show related readings in task modal | P1 | ✅ |
| R3.8 | Visual indicators for overdue tasks | P0 | ✅ |

### R4: Reading Materials
| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| R4.1 | List all books/PDFs from read-help API | P0 | ✅ |
| R4.2 | Filter books by course tags | P0 | ✅ |
| R4.3 | Book detail page with chapters | P0 | ✅ |
| R4.4 | AI-generated summaries (short/medium/long) | P0 | ✅ |
| R4.5 | Chat with book content (with citations) | P1 | ✅ |
| R4.6 | Generate flashcards from chapter | P1 | ✅ |
| R4.7 | Generate quiz from chapter | P2 | ✅ |
| R4.8 | Key concepts extraction | P2 | ✅ |

### R5: Video Materials
| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| R5.1 | List videos by course | P1 | ✅ |
| R5.2 | Video detail with embedded player | P1 | ✅ |
| R5.3 | Video summaries (short/medium/long) | P1 | ✅ |
| R5.4 | Video transcript viewer | P2 | ✅ |
| R5.5 | Key concepts from video | P2 | ✅ |

### R6: Flashcards
| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| R6.1 | Show due flashcards count | P1 | ✅ |
| R6.2 | Flashcard review interface | P1 | ✅ |
| R6.3 | Spaced repetition (SM-2 algorithm) | P1 | ✅ |
| R6.4 | Generate flashcards from content | P1 | ✅ |
| R6.5 | Review quality rating (0-5) | P1 | ✅ |

### R7: Study Timer (Pomodoro)
| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| R7.1 | Configurable focus/break durations | P2 | ✅ |
| R7.2 | Visual countdown timer | P2 | ✅ |
| R7.3 | Audio notification on timer end | P2 | ✅ |
| R7.4 | Session tracking | P2 | ✅ |

### R8: Navigation & UX
| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| R8.1 | Responsive sidebar (desktop/mobile) | P0 | ✅ |
| R8.2 | Course list in sidebar with task counts | P0 | ✅ |
| R8.3 | Breadcrumb navigation | P2 | ⚠️ Partial |
| R8.4 | Loading states (skeleton/spinner) | P1 | ✅ |
| R8.5 | Error boundaries for crashes | P1 | ✅ |
| R8.6 | "This Week" quick view | P1 | ✅ |

---

## API Requirements

### Backend Endpoints Required
| Endpoint | Method | Purpose | Status |
|----------|--------|---------|--------|
| `/api/tasks` | GET | List tasks with filters | ✅ |
| `/api/tasks/:id/complete` | POST | Mark task done | ✅ |
| `/api/tasks/:id/reopen` | POST | Undo completion | ✅ |
| `/api/read-help/books` | GET | List all books | ✅ |
| `/api/read-help/books/:id` | GET | Book details | ✅ |
| `/api/read-help/books/:id/chapters` | GET | Book chapters | ✅ |
| `/api/read-help/chapters/:id/summary/:len` | GET | Chapter summary | ✅ |
| `/api/read-help/chat` | POST | Chat about content | ✅ |
| `/api/read-help/flashcards/due` | GET | Due flashcards | ✅ |
| `/api/read-help/flashcards/:id/review` | POST | Review card | ✅ |
| `/api/videos` | GET | List videos | ✅ |
| `/api/videos/:id` | GET | Video details | ✅ |

---

## Test Coverage

### Smoke Tests (Critical Path)
- [ ] App loads without crash
- [ ] Dashboard shows task counts
- [ ] Course view loads with data
- [ ] Task completion works
- [ ] Reading detail loads

### Integration Tests
- [ ] API proxy forwards correctly
- [ ] Data flows from API to UI
- [ ] Task filters work correctly
- [ ] Course matching logic works

### E2E User Flows
- [ ] Complete a task from dashboard
- [ ] Navigate to course → view readings
- [ ] Generate summary for a chapter
- [ ] Review flashcards
- [ ] Use pomodoro timer

---

## Known Issues / Tech Debt

1. **Breadcrumb navigation** — Not fully implemented
2. **Offline support** — None (requires network)
3. **Error messages** — Generic, could be more helpful
4. **Mobile optimization** — Basic, could be improved
5. **Accessibility** — Not audited

---

## Future Enhancements (Backlog)

- [ ] Plaud recording integration (transcripts linked to tasks)
- [ ] Remarkable notes integration (OCR → searchable)
- [ ] Cross-source flashcards (from all materials)
- [ ] Universal search across all content
- [ ] Study streak tracking
- [ ] Calendar sync with Google Calendar
- [ ] Push notifications for due tasks
- [ ] Dark mode
