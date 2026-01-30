# Vault (Knowledge Base)

Your second brain for storing and finding information.

---

## Overview

The Vault is JD Agent's knowledge management system - a Notion-like repository where all your information lives, fully searchable and interconnected.

### Key Capabilities
- **Store anything**: Notes, documents, recordings, references
- **Search everything**: Full-text and semantic search
- **Automatic archival**: Completed tasks become permanent records
- **Daily journal**: Reflection and planning
- **Linked knowledge**: Connect related information

---

## Getting Started

### Access the Vault

Navigate to http://localhost:5175

You'll see:
- **Search bar** at the top
- **Quick access** to common areas
- **Recent entries**
- **Folder navigation**

### Create Your First Note

1. Press `N` or click **+ New**
2. Enter a title
3. Write your content (Markdown supported)
4. Save

---

## Install as a Native App (macOS)

Vault now ships as a native macOS app using Tauri.

### Prerequisites
- Rust toolchain (`rustup` on macOS)
- Xcode Command Line Tools (`xcode-select --install`)

### Run Native (Dev)
```
cd apps/vault
bun run tauri:dev
```

### Build Native App
```
cd apps/vault
bun run tauri:build
```

**Note:** The app still needs the Hub running at `http://localhost:3000` (or set `VITE_API_URL` to your server).

---

## Install as an App (iOS - Basic)

Basic mobile access is available via PWA while the native iOS build is in progress.

1. Open http://localhost:5175 in Safari
2. Tap **Share** → **Add to Home Screen**
3. Launch it from your home screen

### iOS Experience Highlights

- **Home + Recents**: Quick access to recently edited pages
- **Quick Actions**: New note, search, journal, archive
- **Ask AI**: One-tap chat entry from home
- **Pull-to-Refresh**: Refresh pages list on demand
- **Swipe Actions**: Favorite, archive, or delete pages from lists
- **Floating New Note**: Always-visible create button on mobile
- **Mobile Editor**: Auto-save with visible status feedback
- **Keyboard-Safe Layout**: Navigation stays clear when typing
- **Update Prompt**: PWA shows a refresh banner when a new build is available
- **Build Stamp**: Small build timestamp at bottom for troubleshooting

---

## Content Types

The Vault stores many types of content:

| Type | Description | Example |
|------|-------------|---------|
| `note` | General notes | Meeting notes, ideas |
| `document` | Formal documents | Reports, proposals |
| `journal` | Daily reflections | Daily journal entries |
| `task_archive` | Completed tasks | Auto-archived from Tasks |
| `recording_summary` | Transcribed audio | Meeting recordings |
| `lecture` | Class content | Course lectures |
| `class_notes` | Study materials | Notes from class |
| `meeting_notes` | Meeting documentation | 1:1s, team meetings |
| `article` | Saved articles | Web clippings |
| `reference` | Reference material | How-tos, guides |
| `template` | Reusable templates | Project templates |

---

## Views

### Search View (Home)
**Purpose:** Find anything fast

The home screen provides:
- Search bar with instant results
- Recent entries
- Quick access shortcuts
- Browse by category

### Journal View
**Purpose:** Daily reflection and planning

Each day automatically gets a journal entry with:
- Morning intentions
- Notes and thoughts
- Auto-filled completed tasks
- Evening reflection

### Archive View
**Purpose:** Browse completed tasks

See your accomplishments:
- Chronological completion history
- Filter by date range
- Filter by project
- Search within archive

### Folder Views
Browse content by organization:
- **Projects**: Notes linked to active projects
- **Areas**: School, Work, Personal
- **Resources**: Reference materials
- **People**: Contact notes
- **Recordings**: Transcribed audio

---

## Search

### Full-Text Search

Type in the search bar to find:
- Titles matching your query
- Content containing your terms
- Tags and metadata

### Semantic Search

Find related concepts, not just keywords:
- "What did I learn about neural networks?" finds related ML content
- "Customer feedback" finds reviews, surveys, and complaints

### Search Syntax

```
# Basic search
neural networks

# Filter by type
type:lecture machine learning

# Filter by project
project:"CS401" homework

# Filter by date
created:2026-01 meeting

# Combined
type:note project:Work budget
```

---

## Daily Journal

### Automatic Daily Notes

JD Agent creates a journal entry for each day.

### Journal Template

```markdown
# January 8, 2026

## Morning Intentions
Today's top 3 priorities:
1. [ ]
2. [ ]
3. [ ]

## Notes & Thoughts
-

## Tasks Completed Today
(Auto-populated)

## Evening Reflection
What went well:
What could improve:
Tomorrow's focus:
```

### Using the Journal

1. **Morning**: Set your top 3 priorities
2. **During the day**: Capture thoughts and notes
3. **Evening**: Reflect on the day
4. Completed tasks are added automatically

---

## Task Archive

When you complete a task, it's automatically archived to the Vault.

### What's Preserved
- Task title and description
- Completion date and time
- Project it belonged to
- Contexts and labels
- Any comments or notes

### Finding Archived Tasks

1. Use the Archive view
2. Search by task content
3. Filter by date or project

### Why Archive?
- Create a permanent record
- Track accomplishments over time
- Answer "What did I do last month?"
- Build your personal history

---

## Creating Content

### New Note

1. Press `N` or click **+ New**
2. Choose content type (optional)
3. Enter title
4. Write content in Markdown
5. Add tags (optional)
6. Save

### Markdown Support

The Vault supports full Markdown:

```markdown
# Heading 1
## Heading 2

**Bold** and *italic*

- Bullet points
- More bullets

1. Numbered lists
2. More numbers

> Block quotes

`inline code`

\`\`\`
code blocks
\`\`\`

[Links](https://example.com)

[[Internal Links]]
```

### Internal Links

Link to other Vault entries:

```markdown
See also: [[Project Planning Notes]]

Related: [[CS401 Lecture 5]]
```

Click a link to navigate to that entry.

---

## Organization

### Folder Structure (PARA)

Content is organized using PARA methodology:

```
VAULT/
├── INBOX/          # Unsorted captures
├── PROJECTS/       # Active project notes
├── AREAS/          # Ongoing responsibilities
│   ├── Work/
│   ├── School/
│   └── Personal/
├── RESOURCES/      # Reference materials
├── ARCHIVE/        # Completed items
├── PEOPLE/         # Contact notes
├── JOURNAL/        # Daily reflections
└── RECORDINGS/     # Transcribed audio
```

### Tags

Add tags to categorize content:
- `#important`
- `#review-later`
- `#cs401`
- `#work`

### Moving Content

1. Open an entry
2. Click **Move to...**
3. Select destination folder
4. Confirm

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `N` | New entry |
| `Cmd+K` | Search |
| `Esc` | Close current entry |
| `Cmd+S` | Save |
| `Cmd+B` | Bold |
| `Cmd+I` | Italic |
| `[[` | Insert internal link |

---

## Tips & Best Practices

### Capture First, Organize Later
1. Get information into the Vault quickly
2. Use Inbox for unsorted items
3. Organize during weekly review

### Use Templates
1. Create templates for common content
2. Use them for consistency
3. Save time on formatting

### Link Liberally
1. Connect related content with [[links]]
2. Build a web of knowledge
3. Discover connections later

### Regular Review
1. Process Vault inbox weekly
2. Review and update tags
3. Archive old content

---

## Importing Content

### From Other Sources

JD Agent can import from:
- **Apple Notes**: Batch import via AppleScript
- **Notion**: Page and database import
- **Google Drive**: Document extraction
- **Email**: Gmail integration

### File Attachments

Attach files to Vault entries:
1. Open an entry
2. Click **Attach File**
3. Upload or drag-and-drop
4. File is stored and linked

Supported: PDF, images, documents

---

## Related Features

- [Tasks](../tasks/index.md) - Tasks archive to Vault
- [Agent](../agent/index.md) - Add to Vault via chat
- [Integrations](../integrations/index.md) - Import from external sources

---

*Last updated: January 24, 2026*
