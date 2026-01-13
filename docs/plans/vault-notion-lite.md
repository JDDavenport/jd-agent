# Vault Notion-Lite Transformation Plan

> **Date:** January 12, 2026
> **Status:** Proposed
> **Related Roadmap:** Vault PARA Restructuring (In Progress)

---

## Overview

Transform the Vault app from its current state into a polished "Notion-lite" experience. Focus on look, feel, and core UX rather than advanced features like databases or synced blocks.

---

## Current State

### Already Implemented

| Feature | Status | Notes |
|---------|--------|-------|
| Block editor (TipTap) | Done | Headings, lists, tasks, quotes, code, callouts, toggles |
| Slash commands | Done | Full menu with 15 block types |
| Sidebar navigation | Done | Tree view, drag-drop, expand/collapse |
| Command palette | Done | Cmd+K quick search |
| Page links | Done | `[[page]]` syntax supported |
| Task/Goal links | Done | Link to tasks and goals |
| File attachments | Done | Upload modal |
| Bookmarks | Done | URL preview cards |
| Notion-style CSS | Done | Typography, spacing, colors |
| Instant page creation | Done | Click "New" → instant full-page editor (no modal) |
| Page icons | Done | Emoji picker with 24 quick icons |
| Page covers | Done | 12 gradient presets, hover to add/change/remove |
| Dark mode | Done | Toggle in sidebar, persists to localStorage, system preference detection |
| Backlinks | Done | Shows pages linking to current page at bottom, collapsible |
| Block hover states | Done | Subtle background on hover, Notion-style |
| Drag handles | Done | ⠿ handle appears on left when hovering blocks |
| Block actions menu | Done | Click handle for delete, duplicate, turn into, move up/down |

### What's Missing

Remaining work to complete the "Notion-lite" experience:

1. **Block drag & drop** - Actually reorder blocks by dragging (currently uses move up/down)
2. **Multi-block selection** - Shift+click to select multiple blocks
3. **Visual polish** - Animations, transitions, loading states

---

## Transformation Roadmap

### Phase 1: Page Identity (High Impact)

Make pages feel like Notion pages.

#### 1.1 Page Covers
- Add cover image support to pages
- Cover picker with:
  - Unsplash integration (or preset images)
  - Solid color options
  - Upload custom image
- Reposition cover (drag to adjust)
- Remove cover option

#### 1.2 Page Icons
- Emoji picker for page icons
- Show icon in:
  - Page header (large)
  - Sidebar tree (small)
  - Breadcrumbs
  - Page links
- Random emoji suggestion on create

#### 1.3 Page Title Enhancement
- Inline editable title (click to edit)
- Large, bold typography matching Notion
- Placeholder: "Untitled" in gray

**Schema changes:**
```sql
ALTER TABLE vault_pages ADD COLUMN cover_url TEXT;
ALTER TABLE vault_pages ADD COLUMN cover_position INTEGER DEFAULT 50; -- vertical %
ALTER TABLE vault_pages ADD COLUMN icon TEXT; -- emoji or custom icon URL
```

---

### Phase 2: Block Interactions (Medium Impact)

Make editing feel smooth and intuitive.

#### 2.1 Block Hover States
- Show drag handle on left when hovering block
- Show "+" button to add block below
- Show "..." menu for block actions

#### 2.2 Block Drag & Drop
- Drag handle appears on hover
- Visual indicator during drag
- Drop zones between blocks
- Indent/outdent support

#### 2.3 Block Actions Menu
- Duplicate block
- Delete block
- Turn into (convert block type)
- Copy link to block
- Move to page
- Color/highlight options

#### 2.4 Selection
- Multi-block selection (shift+click, drag)
- Block toolbar on selection
- Cut/copy/paste blocks

---

### Phase 3: Navigation & Context (Medium Impact)

Help users know where they are.

#### 3.1 Breadcrumb Header
- Show page hierarchy at top
- Clickable breadcrumb links
- Current page title editable inline

#### 3.2 Backlinks Section
- Show at bottom of page
- List of pages that link to this page
- Collapse/expand

#### 3.3 Page Properties
- Created date
- Last edited date
- Tags/labels (simple)
- Show at top under title

---

### Phase 4: Visual Polish (High Impact)

Make it feel premium.

#### 4.1 Animations & Transitions
- Smooth sidebar expand/collapse
- Block appear/delete animations
- Menu fade in/out
- Loading skeletons

#### 4.2 Empty States
- Better empty page state
- Empty sidebar state
- Empty search results
- Helpful illustrations

#### 4.3 Dark Mode
- Toggle in settings/header
- Full dark theme
- System preference detection
- Persist preference

#### 4.4 Typography Refinement
- Match Notion's font stack exactly
- Line heights and spacing
- Better code block styling
- Quote styling

---

### Phase 5: Simple Tables (Lower Priority)

Basic table support (not full database).

#### 5.1 Simple Table Block
- Add via slash command `/table`
- Basic rows/columns
- Add/remove rows/columns
- Cell editing
- No formulas, no database features

---

### Phase 6: Templates (Lower Priority)

Quick-start pages.

#### 6.1 Page Templates
- Meeting notes template
- Daily journal template
- Project template
- Create from template option

---

## Implementation Approach

### UI Components Needed

```
apps/vault/src/components/
  PageCover.tsx          # Cover image with picker
  PageIcon.tsx           # Emoji icon picker
  PageHeader.tsx         # (update) Title + cover + icon
  BlockHandle.tsx        # Drag handle + actions
  BlockActionsMenu.tsx   # Block context menu
  Backlinks.tsx          # Backlinks section
  EmptyState.tsx         # Reusable empty states

apps/vault/src/editor/
  BlockWrapper.tsx       # Wraps each block for hover/drag
```

### API Endpoints Needed

```
PATCH /api/vault/pages/:id/cover    # Update cover
PATCH /api/vault/pages/:id/icon     # Update icon
GET   /api/vault/pages/:id/backlinks # Get backlinks
```

### Database Changes

```sql
-- Page covers and icons
ALTER TABLE vault_pages ADD COLUMN cover_url TEXT;
ALTER TABLE vault_pages ADD COLUMN cover_position INTEGER DEFAULT 50;
ALTER TABLE vault_pages ADD COLUMN icon TEXT;

-- For tracking links (backlinks)
CREATE TABLE vault_page_links (
    from_page_id UUID REFERENCES vault_pages(id) ON DELETE CASCADE,
    to_page_id UUID REFERENCES vault_pages(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (from_page_id, to_page_id)
);
```

---

## Priority Matrix

| Phase | Impact | Effort | Priority |
|-------|--------|--------|----------|
| 1. Page Identity | High | Medium | P0 |
| 4. Visual Polish | High | Medium | P0 |
| 2. Block Interactions | Medium | High | P1 |
| 3. Navigation | Medium | Low | P1 |
| 5. Tables | Low | High | P2 |
| 6. Templates | Low | Low | P2 |

**Recommended order:** Phase 1 -> Phase 4 -> Phase 3 -> Phase 2 -> Phase 5/6

---

## Success Criteria

The Vault will feel like "Notion-lite" when:

1. **Pages have personality** - Cover images and emoji icons make pages visually distinct
2. **Editing is fluid** - Blocks respond to hover, drag-drop works smoothly
3. **Navigation is clear** - Always know where you are via breadcrumbs
4. **It looks polished** - Smooth animations, good empty states, dark mode
5. **It's fast** - Quick to create pages, instant saves, responsive UI

---

## Not In Scope (Full Notion Features)

To keep this "lite", we explicitly exclude:

- Full databases with views (table, board, calendar, gallery)
- Formulas and rollups
- Synced blocks
- Comments and discussions
- Version history
- Real-time collaboration
- API/integrations beyond current
- Mobile app (separate project)

---

## Related Documentation

- [Vault Restructuring Plan](/docs/vault-restructuring-plan.md) - PARA folder structure
- [Vault Feature Docs](/docs/public/features/vault/index.md) - User documentation
- [Roadmap](/docs/roadmap/index.md) - Product roadmap

---

*This plan focuses on UX/polish over new features. The goal is making existing functionality feel premium.*
