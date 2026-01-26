# Vault iOS App - Feature Specification

## Overview

Vault is a Notion-style note-taking app that serves as the knowledge base for JD Agent. The iOS app should provide a native-feeling mobile experience for capturing, organizing, and accessing notes on the go.

## Core Purpose

A mobile-first notes app that:
- Lets you quickly capture thoughts and notes
- Organizes content hierarchically (pages within pages)
- Works offline and syncs when online
- Integrates with the broader JD Agent ecosystem

---

## Feature Requirements

### 1. Home Screen
**What the user sees when opening the app:**
- Quick action buttons at top: "New Note", "Search", "Ask AI"
- Recent pages section (last 5-10 edited)
- Favorites section (starred pages)
- All Notes section (hierarchical tree view)

**Interactions:**
- Tap "New Note" → Creates untitled page, opens editor immediately
- Tap "Search" → Opens search/command palette
- Tap any page → Opens that page for viewing/editing
- Pull down → Refresh data from server
- Swipe left on page row → Reveal actions (Favorite, Archive, Delete)

### 2. Page View
**What the user sees when viewing a page:**
- Page title (editable, large text at top)
- Page icon (emoji picker)
- Breadcrumb navigation (if nested)
- Block content area

**Interactions:**
- Tap title → Edit title inline
- Tap icon → Open emoji picker
- Tap breadcrumb → Navigate to parent
- Scroll content area → View all blocks

### 3. Block Editor
**The core editing experience:**

Supported block types:
- **Text** - Basic paragraph text
- **Heading 1/2/3** - Section headers
- **Bullet List** - Unordered list items
- **Numbered List** - Ordered list items
- **Todo** - Checkbox items
- **Quote** - Block quotes
- **Code** - Code snippets with syntax highlighting
- **Divider** - Horizontal rule

**Interactions:**
- Tap empty area → Add new block
- Tap existing block → Edit that block
- Long press block → Show block menu (delete, duplicate, move, change type)
- Type "/" → Show slash command menu to insert block type
- Swipe left on block → Delete block

### 4. Search
**Quick find any page:**
- Search by title
- Search by content
- Recent searches shown
- Results appear as you type

**Interactions:**
- Type query → See matching pages
- Tap result → Open that page
- Tap "Create [query]" → Create new page with that title

### 5. Offline Support
**Works without internet:**
- All pages cached locally in SQLite
- Create/edit pages works offline
- Changes queued and synced when online
- Visual indicator showing online/offline status

### 6. Sync
**Keeps data in sync with Hub:**
- Auto-sync on app launch
- Auto-sync on network reconnect
- Pull-to-refresh manual sync
- Conflict resolution (last write wins, or merge)

---

## Technical Requirements

### Data Flow
```
User Action → Local SQLite (immediate) → Queue for Sync → Hub API → Other Devices
```

### API Endpoints Used
- `GET /api/vault/pages` - List all pages
- `GET /api/vault/pages/tree` - Get hierarchical tree
- `GET /api/vault/pages/favorites` - Get favorited pages
- `GET /api/vault/pages/:id` - Get single page with blocks
- `POST /api/vault/pages` - Create new page
- `PATCH /api/vault/pages/:id` - Update page
- `DELETE /api/vault/pages/:id` - Delete page
- `POST /api/vault/pages/:id/favorite` - Toggle favorite
- `GET /api/vault/pages/:id/blocks` - Get blocks for page
- `POST /api/vault/pages/:id/blocks` - Create block
- `PATCH /api/vault/blocks/:id` - Update block
- `DELETE /api/vault/blocks/:id` - Delete block

### Local Storage Schema
```sql
-- Pages table
vault_pages (
  id TEXT PRIMARY KEY,
  parent_id TEXT,
  title TEXT,
  icon TEXT,
  is_favorite INTEGER,
  is_archived INTEGER,
  sort_order INTEGER,
  created_at TEXT,
  updated_at TEXT,
  sync_status TEXT  -- 'synced', 'pending', 'conflict'
)

-- Blocks table
vault_blocks (
  id TEXT PRIMARY KEY,
  page_id TEXT,
  type TEXT,
  content TEXT,  -- JSON
  sort_order INTEGER,
  created_at TEXT,
  updated_at TEXT,
  sync_status TEXT
)

-- Sync queue
sync_queue (
  id INTEGER PRIMARY KEY,
  entity_type TEXT,
  entity_id TEXT,
  operation TEXT,  -- 'create', 'update', 'delete'
  payload TEXT,
  created_at TEXT
)
```

---

## UI/UX Requirements

### Mobile-First Design
- Large touch targets (min 44pt)
- Bottom navigation for thumb reach
- Gesture-based interactions (swipe, pull)
- Responsive to different iPhone sizes
- Support for dark mode

### Performance
- App launch to usable: < 2 seconds
- Page open: < 500ms
- Search results: < 300ms
- Smooth scrolling (60fps)

### Error Handling
- Show toast/alert when operations fail
- Retry failed operations automatically
- Never lose user's data
- Graceful degradation when offline

---

## What's NOT in Scope (V1)

- Real-time collaboration
- Image/file attachments
- Page sharing/export
- Advanced formatting (tables, embeds)
- Voice notes
- Handwriting

---

## Success Criteria

The app is successful when a user can:
1. Open the app and see their notes within 2 seconds
2. Create a new note with a single tap
3. Edit a note's title and content
4. Find any note using search
5. Use the app completely offline
6. Have changes sync automatically when online

---

## Recommended Approach for Rebuild

### Option A: Keep Tauri, Simplify
- Strip down to minimal working version
- Remove SQLite complexity initially (API-only)
- Add offline support after core works
- Pros: Reuse existing React code
- Cons: WebView performance, plugin complexity

### Option B: Native SwiftUI
- Build native iOS app from scratch
- Direct SQLite via Swift
- Native performance and feel
- Pros: Best iOS experience, reliable
- Cons: Separate codebase, more work

### Option C: React Native
- Rebuild with React Native
- Share logic with web app
- Native modules for SQLite
- Pros: Cross-platform, good performance
- Cons: Learning curve, bridge overhead

**Recommendation:** Option A (simplified Tauri) for quick fix, Option B (SwiftUI) for long-term quality.
