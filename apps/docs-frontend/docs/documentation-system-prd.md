# JD Agent Documentation System - Product Requirements Document

> **Version:** 1.0
> **Date:** January 8, 2026
> **Status:** Proposed
> **Author:** Claude (AI Assistant)

---

## Executive Summary

This PRD defines a comprehensive documentation system for JD Agent that includes:
1. **User Documentation** - Step-by-step guides for all features
2. **Public Roadmap** - Industry-standard roadmap showing progress and future plans
3. **Backlog** - Transparent list of known issues, enhancements, and planned features
4. **Documentation Rules** - Enforced requirement to update docs after every feature

The goal is to create professional, user-focused documentation that educates users and provides transparency into the product's development.

---

## Problem Statement

Currently, JD Agent has:
- `FEATURES.md` - Internal feature list (developer-focused)
- `docs/jd-agent-prd.md` - Technical PRD (developer-focused)
- `CLAUDE.md` - AI agent instructions (developer-focused)

**What's Missing:**
- User-facing documentation explaining how to use features
- Visual roadmap showing product direction
- Transparent backlog of known issues and planned work
- Getting started guide for new users
- Feature-specific tutorials

---

## Goals

1. **Educate Users** - Clear, step-by-step documentation for every feature
2. **Build Trust** - Public roadmap showing where the product is headed
3. **Transparency** - Published backlog of known issues and planned enhancements
4. **Maintainability** - Enforced rules ensuring docs stay current with development
5. **Professional Quality** - Industry-standard documentation matching products like Linear, Notion, Todoist

---

## Target Audience

| Audience | Needs |
|----------|-------|
| **New Users** | Getting started guide, feature overview, quick wins |
| **Power Users** | Advanced features, keyboard shortcuts, integrations |
| **Stakeholders** | Roadmap visibility, progress tracking |
| **Contributors** | Technical docs, API reference, architecture |

---

## Documentation Architecture

### Directory Structure

```
/docs/
├── public/                          # User-facing documentation
│   ├── index.md                     # Documentation home
│   ├── getting-started/
│   │   ├── index.md                 # Getting started overview
│   │   ├── installation.md          # Setup instructions
│   │   ├── quick-start.md           # 5-minute quick start
│   │   └── core-concepts.md         # GTD, PARA, key terminology
│   │
│   ├── features/                    # Feature documentation
│   │   ├── index.md                 # Feature overview
│   │   ├── tasks/
│   │   │   ├── index.md             # Tasks overview
│   │   │   ├── inbox.md             # Inbox & capture
│   │   │   ├── today.md             # Today view
│   │   │   ├── projects.md          # Projects & sections
│   │   │   ├── contexts.md          # @contexts
│   │   │   ├── recurring.md         # Recurring tasks
│   │   │   └── quick-add.md         # Natural language quick add
│   │   ├── vault/
│   │   │   ├── index.md             # Vault overview
│   │   │   ├── search.md            # Search & find
│   │   │   ├── journal.md           # Daily journal
│   │   │   └── archive.md           # Task archive
│   │   ├── calendar/
│   │   │   ├── index.md             # Calendar overview
│   │   │   └── integrations.md      # Google Calendar sync
│   │   ├── agent/
│   │   │   ├── index.md             # AI Agent overview
│   │   │   ├── chat.md              # Chat interface
│   │   │   ├── commands.md          # Agent commands
│   │   │   └── smart-features.md    # Auto-classification, etc.
│   │   ├── ceremonies/
│   │   │   ├── index.md             # Ceremonies overview
│   │   │   └── customization.md     # Ceremony settings
│   │   └── integrations/
│   │       ├── index.md             # Integrations overview
│   │       ├── canvas.md            # Canvas LMS
│   │       ├── telegram.md          # Telegram bot
│   │       ├── google.md            # Google services
│   │       └── whoop.md             # Whoop fitness
│   │
│   ├── guides/                      # How-to guides
│   │   ├── gtd-workflow.md          # GTD methodology guide
│   │   ├── weekly-review.md         # Weekly review process
│   │   ├── keyboard-shortcuts.md    # All shortcuts
│   │   └── best-practices.md        # Tips & tricks
│   │
│   └── reference/
│       ├── api.md                   # API reference
│       ├── quick-add-syntax.md      # Quick add syntax reference
│       └── glossary.md              # Terminology
│
├── roadmap/
│   ├── index.md                     # Public roadmap
│   ├── changelog.md                 # Version changelog
│   └── backlog.md                   # Known issues & planned work
│
└── internal/                        # Developer docs (existing)
    ├── jd-agent-prd.md
    └── vault-restructuring-plan.md
```

---

## Component Specifications

### 1. Public Roadmap (`/docs/roadmap/index.md`)

**Format:** Industry-standard roadmap with phases and status indicators

**Structure:**
```markdown
# JD Agent Roadmap

## Current Focus: Phase 3 - Verify & Coach

### Status Legend
- ✅ Complete
- 🚧 In Progress
- 📋 Planned
- 💡 Under Consideration

---

## Now (Current Sprint)
Items actively being worked on...

## Next (Next 2-4 Weeks)
Items planned for upcoming work...

## Later (Next Quarter)
Items planned for future...

## Future (Backlog)
Long-term vision items...
```

**Required Sections:**
1. Current Phase & Focus
2. Status Legend
3. Now / Next / Later / Future columns
4. Links to detailed specs where relevant
5. Last updated timestamp

### 2. Backlog (`/docs/roadmap/backlog.md`)

**Format:** Categorized list of known issues, enhancements, and feature requests

**Structure:**
```markdown
# Backlog

## Known Issues
| ID | Description | Severity | Status |
|----|-------------|----------|--------|

## Enhancements
| ID | Description | Priority | Category |
|----|-------------|----------|----------|

## Feature Requests
| ID | Description | Votes | Status |
|----|-------------|-------|--------|
```

### 3. Changelog (`/docs/roadmap/changelog.md`)

**Format:** Keep a Changelog format (https://keepachangelog.com)

**Structure:**
```markdown
# Changelog

All notable changes to JD Agent.

## [Unreleased]

## [0.3.0] - 2026-01-07
### Added
- ...
### Changed
- ...
### Fixed
- ...
```

### 4. Getting Started (`/docs/public/getting-started/`)

**Required Content:**
1. **Installation** - Prerequisites, setup steps, configuration
2. **Quick Start** - 5-minute guide to first task
3. **Core Concepts** - GTD, Inbox Zero, PARA methodology

### 5. Feature Documentation Template

Each feature page must include:

```markdown
# Feature Name

> Brief description of what this feature does

## Overview
What problem does this solve? Why use it?

## Getting Started
Step-by-step for first-time use

## How It Works
Detailed explanation with screenshots/examples

## Key Features
- Feature 1
- Feature 2
- ...

## Tips & Best Practices
Power user tips

## Related Features
Links to related documentation

## Keyboard Shortcuts
Relevant shortcuts for this feature

---
*Last updated: [date]*
```

---

## Documentation Rules (Enforcement)

### Rule 1: Feature Documentation Required

**When:** After implementing any new feature or significant enhancement

**Requirements:**
1. Create or update relevant documentation in `/docs/public/features/`
2. Include step-by-step usage instructions
3. Add any new keyboard shortcuts to shortcuts reference
4. Update feature index if new feature category

### Rule 2: Roadmap Update Required

**When:** After completing any roadmap item or adding new planned work

**Requirements:**
1. Update `/docs/roadmap/index.md` with current status
2. Move completed items from "Now" to changelog
3. Add new planned items to appropriate column

### Rule 3: Backlog Update Required

**When:** After discovering bugs, receiving feedback, or identifying enhancements

**Requirements:**
1. Add entry to `/docs/roadmap/backlog.md`
2. Categorize appropriately (Issue/Enhancement/Feature Request)
3. Assign severity/priority

### Rule 4: Changelog Update Required

**When:** Before any release or version bump

**Requirements:**
1. Update `/docs/roadmap/changelog.md`
2. Follow Keep a Changelog format
3. Group changes by type (Added/Changed/Fixed/Removed)

---

## CLAUDE.md Rule Addition

Add to CLAUDE.md:

```markdown
## Documentation Requirements

**CRITICAL RULE:** After implementing any feature, enhancement, or fix:

1. **Update Feature Docs** - Create or update `/docs/public/features/` with user-facing documentation
2. **Update Roadmap** - Reflect changes in `/docs/roadmap/index.md`
3. **Update Changelog** - Add entry to `/docs/roadmap/changelog.md`
4. **Update Backlog** - Mark completed items, add discovered issues

Documentation must be:
- User-focused (not developer-focused)
- Include step-by-step instructions
- Include relevant screenshots or examples
- Updated before marking any feature as complete
```

---

## Content Guidelines

### Voice & Tone
- Clear and concise
- Action-oriented (use verbs: "Create", "Click", "Navigate")
- Friendly but professional
- No jargon without explanation

### Formatting Standards
- Use H2 (##) for main sections
- Use bullet points for lists
- Use tables for comparisons/references
- Use code blocks for commands/syntax
- Include "Last updated" on every page

### Visual Standards
- Screenshots should be 1024x768 or similar
- Highlight relevant UI elements
- Use consistent annotation style
- Dark mode screenshots optional

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Documentation coverage | 100% of features documented |
| Freshness | All docs updated within 7 days of feature changes |
| User feedback | Positive sentiment on clarity |
| Support reduction | Decrease in "how do I..." questions |

---

## Implementation Plan

### Phase 1: Foundation (Immediate)
1. Create directory structure
2. Create documentation home page
3. Create roadmap with current status
4. Create backlog from known items
5. Update CLAUDE.md with documentation rules

### Phase 2: Core Documentation (Week 1)
1. Getting Started guides
2. Task management documentation
3. Vault documentation
4. Agent/Chat documentation

### Phase 3: Complete Coverage (Week 2)
1. All integrations documented
2. All features documented
3. Reference guides complete
4. Keyboard shortcuts complete

### Phase 4: Enhancement (Ongoing)
1. Add screenshots/visuals
2. Video tutorials (future)
3. Interactive guides (future)
4. Search functionality (future)

---

## Appendix: Industry Examples

### Reference Products
- **Notion** - https://notion.so/help
- **Linear** - https://linear.app/docs
- **Todoist** - https://todoist.com/help
- **Obsidian** - https://help.obsidian.md

### Common Patterns
1. Left sidebar navigation
2. Search functionality
3. "Was this helpful?" feedback
4. Related articles suggestions
5. Version-specific documentation

---

## Approval

- [ ] User approves PRD scope
- [ ] User approves directory structure
- [ ] User approves documentation rules
- [ ] Begin implementation

---

*This PRD defines a professional documentation system that will educate users, provide transparency, and ensure documentation stays current with development.*
