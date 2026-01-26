# Vault iOS PRD (Notion-Competitive)
> **Date:** January 24, 2026  
> **Status:** In Progress  
> **Related Roadmap:** Vault iOS Experience (Planned → In Progress)

---

## Overview

The Vault iOS app should feel as fast and polished as Notion’s iOS app while supporting JD Agent’s unique workflows (GTD, PARA, semantic search, task archival). The goal is a daily-driver second brain on iPhone with zero friction for capture, navigation, editing, and search.

---

## Goals

1. **Daily Driver Usability**: Capture and edit notes comfortably on iPhone.
2. **Notion-Competitive UX**: Smooth navigation, fast search, and native-feeling interactions.
3. **Reliable Editing**: All edits persist with clear save feedback.
4. **Fast Find**: Search instantly across pages and legacy entries.
5. **Mobile-First Flows**: Minimize taps and typing for common actions.

---

## Non-Goals (for v1)

- Full Notion database feature parity
- Advanced table/board views
- Collaborative editing or shared workspaces
- iOS share extension (planned v1.1)

---

## Target Users

- **Primary**: JD on iPhone (daily capture + retrieval)
- **Secondary**: Power users who rely on Notion iOS

---

## Competitive Requirements (Notion iOS Parity)

### Navigation
- Tab-based home navigation (Home, Pages, Favorites, Search)
- Back stack with native-style transitions
- One-handed reachability and safe-area support

### Capture
- New page button always visible
- Quick add from Home with title + optional template
- Empty state prompts to create first note

### Search
- Search-first experience with instant results
- Recent items and pinned favorites
- Semantic search toggle (fallback to full-text)

### Editing
- Block editor with slash commands
- Inline page title editing
- Page icon + cover management
- Reliable auto-save with visible feedback

### Interactions
- Pull-to-refresh on lists
- Swipe actions on pages (favorite, delete)
- Haptic feedback on critical actions

---

## Inspiration from JD Tasks iOS App

We will reuse the best iOS patterns already implemented:

- **Tab navigation + badges** (Task counts → Page counts)
- **Pull-to-refresh** for lists
- **Swipe actions** (favorite/delete/archive)
- **Haptic feedback** for completion + key actions
- **Quick add** modal with inline parsing (if applicable)

---

## Core UX Flows

### 1. Home (Search + Recents)
- Search bar at top
- Quick actions (New, Search, Journal, Archive)
- Recent pages list
- Favorites section

### 2. Page View
- Inline page title + icon
- Editor with block controls
- Save status (“Saving…”, “Saved”, “Offline”)
- Back navigation + search access

### 3. Pages Tree
- Hierarchical list with expand/collapse
- Fast access to nested pages
- Long-press or swipe actions per page

### 4. Journal + Archive
- Journal: daily entry capture and browsing
- Archive: completed tasks timeline

---

## Functional Requirements

### MVP (v1)
- Home with Recents + Favorites
- Page navigation + editor
- Auto-save + save status
- Pull-to-refresh for lists
- Quick actions
- Keyboard-safe layout

### v1.1 Enhancements
- Swipe actions (favorite, archive, delete)
- Page templates
- Share sheet import
- Offline-first editing with sync queue

---

## Technical Approach

- **Current**: React + Vite PWA (iOS Safari)
- **Future**: Tauri iOS build (native shell)
- **Backend**: Hub API (vault pages + blocks)
- **Data**: Vault pages + block storage

---

## Metrics of Success

- **Edit success rate**: 99% of edits persist
- **Time-to-note**: < 5 seconds to create a new page
- **Search latency**: < 200ms perceived response
- **Daily usage**: ≥ 3 sessions/day (by owner)

---

## QA / Testing Plan

- iOS Testing Agent scenario suite
- Manual smoke test on iPhone:
  - Create page
  - Edit and refresh
  - Navigate tree
  - Search + open recent
  - Archive view

---

## Open Questions

1. Should vault pages support offline editing in PWA immediately?
2. Which templates matter most day 1?
3. Should we prioritize share sheet import before swipe actions?

