# Study Help - MBA Study Dashboard

A comprehensive study dashboard for BYU MBA students that integrates tasks from Canvas with reading materials from the read-help API.

## Features

### 📊 Dashboard
- Overview of all courses with task counts
- Urgent tasks that need attention
- Quick access to study timer, flashcards, and readings

### 📚 Course View
- **Tasks Tab**: View and manage all course tasks, organized by due date
- **Readings Tab**: Browse uploaded PDFs for each course
- **Calendar Tab**: See upcoming deadlines visually

### 📖 Task → Reading Integration
- Click any task to see a detail modal
- **Related Readings** automatically matched by course and content
- One-click access to view reading summaries, chat, and study tools

### 🎓 Reading Features
- AI-generated summaries (short, medium, long)
- Chat with your readings - ask questions about the content
- Generate flashcards for spaced repetition
- Quiz yourself on chapter content

### 🎬 Video Features
- YouTube video embedding with summaries
- Automatic transcript extraction
- AI-generated video summaries (quick/full/detailed)
- Key concepts extraction from video content
- Full transcript viewer

## Getting Started

### 1. Start the backend API
```bash
cd ~/projects/JD\ Agent/hub
npm run dev
# API runs at http://localhost:3000
```

### 2. Start the Study Help app
```bash
cd ~/projects/JD\ Agent/apps/study-help
npm run dev
# App runs at http://localhost:5177
```

### 3. Sync Canvas Content (optional)
```bash
# Sync PDFs only
npm run sync:canvas

# Sync YouTube videos only  
npm run sync:videos

# Sync everything
npm run sync:all
```

**PDF Sync** will:
- Scan all your Canvas courses for PDF files
- Download each PDF
- Upload to the read-help API with course tags
- Skip files already uploaded

## Canvas Content Sync

### PDF Sync
The Canvas PDF Sync script downloads all PDFs from your Canvas courses and uploads them to the read-help API.

### YouTube Video Sync
The Canvas Video Sync script finds all YouTube links in Canvas module items and:
- Fetches video metadata and thumbnails
- Extracts transcripts (when available)
- Generates AI summaries (short, medium, long)
- Extracts key concepts from the video content

### Prerequisites
- Canvas API token in `~/projects/JD Agent/hub/.env`:
  ```
  CANVAS_BASE_URL=https://byu.instructure.com
  CANVAS_TOKEN=your_token_here
  ```
- Backend API running at http://localhost:3000

### Supported Courses
- MBA 560: Business Analytics
- MBA 580: Business Strategy
- Entrepreneurial Innovation
- MBA 664: Venture Capital/Private Equity
- MBA 677R: Entrepreneurship Through Acquisition
- MBA 654: Strategic Client Acquisition/Retention
- MBA 693R: Post-MBA Career Strategy

### Running the Sync
```bash
npm run sync:canvas
```

The script will:
1. Check for existing books to avoid duplicates
2. Scan each course's modules for PDF files
3. Download and upload each PDF with appropriate tags
4. Report summary of uploaded/skipped files

## Project Structure

```
src/
├── App.tsx           # Main app with routing and sidebar
├── api.ts            # API client functions
├── components/
│   └── TaskDetailModal.tsx   # Task detail with related readings
├── hooks/
│   └── useStudy.ts   # React Query hooks for data fetching
├── types/
│   ├── index.ts      # Type definitions
│   └── courses.ts    # Course definitions and matching
├── views/
│   ├── DashboardView.tsx     # Main dashboard
│   ├── CourseView.tsx        # Course detail with tabs
│   ├── ReadingDetailView.tsx # Reading view with summaries, chat
│   ├── PomodoroView.tsx      # Study timer
│   └── FlashcardsView.tsx    # Flashcard review
└── index.css         # Tailwind styles

scripts/
└── canvas-pdf-sync.ts  # Canvas PDF download/upload script
```

## Testing the Full UX

1. **View Dashboard**: http://localhost:5177/
   - See all courses with task counts
   - View urgent tasks needing attention

2. **Navigate to a Course**: Click any course in sidebar
   - Overview tab shows coming up tasks + readings
   - Tasks tab shows organized task list
   - Readings tab shows uploaded PDFs

3. **Task Detail Modal**: Click any task
   - See task details and due date
   - View related readings matched by course
   - Click a reading to view summaries/chat
   - Mark task complete when done

4. **Read & Study**: Click a reading
   - Choose summary length (quick/15min/30min)
   - Chat with the AI about the content
   - Generate flashcards for review
   - Take a quiz to test knowledge

## Tech Stack

- **React** + TypeScript
- **Vite** for dev/build
- **TailwindCSS** for styling
- **React Router** for navigation
- **TanStack Query** for data fetching
- **date-fns** for date formatting
- **Heroicons** for icons
