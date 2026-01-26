# Vault iOS App - Product Requirements Document (PRD)

**Version:** 2.0
**Date:** January 26, 2026
**Status:** In Development
**Owner:** JD Agent Team

---

## Executive Summary

Vault iOS is a native mobile app for capturing, organizing, and accessing notes on-the-go. It's the mobile companion to the JD Agent knowledge management system, providing a fast, reliable, native iOS experience.

---

## Problem Statement

The current Tauri-based iOS app has fundamental issues:
- Buttons don't respond to taps
- SQLite integration fails silently
- WebView-based approach causes performance and reliability issues
- No proper error feedback to users

Users need a **reliable, native iOS app** that works consistently.

---

## Goals

### Primary Goals
1. **Reliability** - Every tap works, every action completes
2. **Speed** - App loads in <2 seconds, actions feel instant
3. **Offline-capable** - Works without network, syncs when available

### Success Metrics
- 100% of UI elements respond to interaction
- App launch to usable state: <2 seconds
- Zero silent failures - all errors shown to user
- All automated tests pass before release

---

## User Stories

### Epic 1: View Notes
| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| V-1 | As a user, I can see all my notes on the home screen | Home screen displays page tree within 2 seconds of launch |
| V-2 | As a user, I can see my favorite notes | Favorites section shows starred pages |
| V-3 | As a user, I can see recently edited notes | Recent section shows last 10 edited pages |
| V-4 | As a user, I can expand/collapse nested pages | Chevron toggles children visibility |

### Epic 2: Create & Edit Notes
| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| C-1 | As a user, I can create a new note with one tap | "New Note" creates untitled page and opens editor |
| C-2 | As a user, I can edit the page title | Tapping title allows inline editing |
| C-3 | As a user, I can add text blocks | Tapping empty area or "+" adds new block |
| C-4 | As a user, I can edit existing blocks | Tapping block allows text editing |
| C-5 | As a user, I can delete blocks | Swipe or long-press shows delete option |
| C-6 | As a user, I can create different block types | Slash menu or "+" shows block type options |

### Epic 3: Organize Notes
| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| O-1 | As a user, I can favorite/unfavorite a page | Star icon toggles, page appears in favorites |
| O-2 | As a user, I can archive a page | Archive action moves page to archive |
| O-3 | As a user, I can delete a page | Delete action removes page with confirmation |

### Epic 4: Search
| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| S-1 | As a user, I can search for notes | Search bar filters pages by title |
| S-2 | As a user, I can create a note from search | "Create [query]" option when no results |

### Epic 5: Sync & Offline
| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| Y-1 | As a user, I can pull to refresh | Pull gesture triggers data reload |
| Y-2 | As a user, I see online/offline status | Banner shows when offline |
| Y-3 | As a user, changes sync automatically | Edits persist to server when online |

---

## Technical Requirements

### Architecture
```
┌─────────────────────────────────────────────────────────┐
│                    SwiftUI Views                         │
├─────────────────────────────────────────────────────────┤
│                    ViewModels                            │
│         (ObservableObject, @Published)                   │
├─────────────────────────────────────────────────────────┤
│                    API Client                            │
│              (URLSession, async/await)                   │
├─────────────────────────────────────────────────────────┤
│                    Hub API                               │
│              (http://[IP]:3000/api/...)                  │
└─────────────────────────────────────────────────────────┘
```

### API Endpoints Required
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/health` | GET | Connectivity check |
| `/api/vault/pages` | GET | List all pages |
| `/api/vault/pages/tree` | GET | Hierarchical page tree |
| `/api/vault/pages/favorites` | GET | Favorited pages |
| `/api/vault/pages` | POST | Create new page |
| `/api/vault/pages/:id` | GET | Get single page |
| `/api/vault/pages/:id` | PATCH | Update page |
| `/api/vault/pages/:id` | DELETE | Delete page |
| `/api/vault/pages/:id/favorite` | POST | Toggle favorite |
| `/api/vault/pages/:id/blocks` | GET | Get page blocks |
| `/api/vault/pages/:id/blocks` | POST | Create block |
| `/api/vault/blocks/:id` | PATCH | Update block |
| `/api/vault/blocks/:id` | DELETE | Delete block |
| `/api/vault/pages/quick-find` | GET | Search pages |

### Data Models

```swift
struct VaultPage {
    let id: String
    var parentId: String?
    var title: String
    var icon: String?
    var isFavorite: Bool
    var isArchived: Bool
    var createdAt: Date
    var updatedAt: Date
}

struct VaultBlock {
    let id: String
    let pageId: String
    var type: BlockType  // paragraph, heading1-3, todo, bullet, etc.
    var content: BlockContent
    var sortOrder: Int
}

struct BlockContent {
    var text: String?
    var checked: Bool?  // for todos
}
```

---

## UI Specifications

### Screen 1: Home
```
┌─────────────────────────────────┐
│  Vault                    🔍    │
├─────────────────────────────────┤
│ Quick Actions                   │
│ [+ New Note] [Search]           │
├─────────────────────────────────┤
│ ⭐ Favorites                    │
│ 📄 Important Notes              │
│ 📄 Meeting Notes                │
├─────────────────────────────────┤
│ 🕐 Recent                       │
│ 📄 Today's Notes     2 min ago  │
│ 📄 Project Ideas     1 hour ago │
├─────────────────────────────────┤
│ 📁 All Notes              [+]   │
│ > 📄 Work                       │
│   > 📄 Meetings                 │
│   > 📄 Projects                 │
│ > 📄 Personal                   │
└─────────────────────────────────┘
```

### Screen 2: Page Detail
```
┌─────────────────────────────────┐
│  < Back              ⋯          │
├─────────────────────────────────┤
│ 📄                              │
│ Meeting Notes                   │
│ ─────────────────────────────   │
│                                 │
│ ## Attendees                    │
│ • John                          │
│ • Sarah                         │
│                                 │
│ ## Action Items                 │
│ ☑ Review proposal               │
│ ☐ Send follow-up                │
│                                 │
│ [+ Add block]                   │
└─────────────────────────────────┘
```

### Screen 3: Search
```
┌─────────────────────────────────┐
│  Cancel                         │
├─────────────────────────────────┤
│ 🔍 Search pages...              │
├─────────────────────────────────┤
│ Results                         │
│ 📄 Meeting Notes     yesterday  │
│ 📄 Project Meeting   2 days ago │
├─────────────────────────────────┤
│ [+ Create "meeting"]            │
└─────────────────────────────────┘
```

---

## Testing Requirements

### Automated Test Plan

| Test ID | Category | Test Case | Expected Result |
|---------|----------|-----------|-----------------|
| T-001 | Launch | App launches | Home screen visible in <2s |
| T-002 | Home | Pages load | Page list visible |
| T-003 | Home | Favorites show | Favorites section populated |
| T-004 | Create | Tap New Note | New page created, editor opens |
| T-005 | Edit | Edit page title | Title updates |
| T-006 | Edit | Add text block | Block added to page |
| T-007 | Edit | Edit block text | Block content updates |
| T-008 | Organize | Favorite page | Star toggles, page in favorites |
| T-009 | Organize | Delete page | Page removed |
| T-010 | Search | Search by title | Matching results shown |
| T-011 | Search | Create from search | New page with search term as title |
| T-012 | Nav | Tap page | Page detail opens |
| T-013 | Nav | Back button | Returns to home |
| T-014 | Refresh | Pull to refresh | Data reloads |
| T-015 | Error | Network offline | Error shown gracefully |

### Test Environment
- iOS Simulator: iPhone 17 Pro
- Hub API: Running at localhost:3000
- Automated via: XCTest UI Tests + Testing Agent

---

## Implementation Plan

### Phase 1: Core App (MVP)
1. Fix Xcode project configuration
2. Implement working Home screen
3. Implement page creation
4. Implement page viewing
5. Test in Simulator

### Phase 2: Editing
1. Implement block editor
2. Add block CRUD operations
3. Test all block types

### Phase 3: Organization
1. Implement favorites toggle
2. Implement archive
3. Implement delete with confirmation

### Phase 4: Search
1. Implement search view
2. Implement create from search

### Phase 5: Polish & Testing
1. Error handling
2. Loading states
3. Full automated test suite
4. Performance optimization

---

## Out of Scope (V1)

- Offline-first with local database
- Image/file attachments
- Real-time collaboration
- Push notifications
- Widget support

---

## Appendix: File Structure

```
apps/vault-ios/
├── project.yml              # XcodeGen config
├── JDVault.xcodeproj/       # Generated Xcode project
└── JDVault/
    ├── JDVaultApp.swift     # App entry point
    ├── ContentView.swift    # Root view
    ├── Info.plist           # App configuration
    ├── Assets.xcassets/     # Images, colors
    ├── Models/
    │   ├── VaultPage.swift
    │   └── VaultBlock.swift
    ├── Views/
    │   ├── HomeView.swift
    │   ├── PageDetailView.swift
    │   └── SearchView.swift
    ├── ViewModels/
    │   ├── HomeViewModel.swift
    │   └── PageDetailViewModel.swift
    ├── Components/
    │   ├── PageRow.swift
    │   └── BlockView.swift
    └── Services/
        └── APIClient.swift
```
