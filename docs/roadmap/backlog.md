# JD Agent Backlog

> Known issues, planned enhancements, and feature requests

**Last Updated:** January 8, 2026

---

## How to Use This Page

This backlog provides transparency into:
1. **Known Issues** - Bugs and problems we're aware of
2. **Enhancements** - Improvements to existing features
3. **Feature Requests** - New capabilities being considered

### Severity Levels (Issues)
- 🔴 **Critical** - System unusable, data loss risk
- 🟠 **High** - Major feature broken, significant impact
- 🟡 **Medium** - Feature partially working, workaround exists
- 🟢 **Low** - Minor issue, cosmetic, edge case

### Priority Levels (Enhancements/Features)
- **P0** - Must have, blocking other work
- **P1** - High priority, planned for next release
- **P2** - Medium priority, planned for this quarter
- **P3** - Low priority, someday/maybe

---

## Known Issues

| ID | Description | Severity | Status | Notes |
|----|-------------|----------|--------|-------|
| BUG-001 | ReMarkable sync pipeline incomplete | 🟡 Medium | In Progress | 10% complete |
| BUG-002 | Plaud recording pipeline incomplete | 🟡 Medium | In Progress | 10% complete |
| BUG-003 | Semantic search not wired to search API | 🟡 Medium | In Progress | Schema ready, wiring needed |
| BUG-004 | Canvas token expiration not auto-refreshed | 🟢 Low | Open | Manual re-auth required |
| BUG-005 | Gmail task extraction limited accuracy | 🟡 Medium | Open | Needs prompt tuning |
| BUG-006 | Vault flat structure makes navigation difficult | 🟡 Medium | Planned | PARA restructure planned |

---

## Enhancements

| ID | Description | Priority | Category | Status |
|----|-------------|----------|----------|--------|
| ENH-016 | Legacy vault_entries migration to vault_pages | P1 | Vault | Planned |
| ENH-017 | Vault chat interface for querying data | P1 | Vault/AI | Planned |
| ENH-018 | Complete semantic search pipeline | P1 | Search/AI | Planned |
| ENH-001 | PARA folder structure for Vault | P1 | Vault | Planned |
| ENH-002 | Controlled tag taxonomy | P1 | Vault | Planned |
| ENH-003 | Faceted search API | P1 | Search | Planned |
| ENH-004 | Advanced task filters | P2 | Tasks | Planned |
| ENH-005 | Project templates | P2 | Tasks | Planned |
| ENH-006 | Vault entry versioning | P2 | Vault | Planned |
| ENH-007 | Brain dump voice input | P2 | Capture | Planned |
| ENH-008 | Ceremony customization UI | P3 | Ceremonies | Open |
| ENH-009 | Dashboard widget customization | P3 | UI | Open |
| ENH-010 | Task time tracking integration | P3 | Tasks | Open |
| ENH-011 | Calendar conflict auto-resolution | P3 | Calendar | Open |
| ENH-012 | Batch task operations | P2 | Tasks | Open |
| ENH-013 | Task dependencies visualization | P3 | Tasks | Open |
| ENH-014 | Goal progress tracking | P2 | Goals | Open |
| ENH-015 | Weekly review workflow UI | P2 | Ceremonies | Open |

---

## Feature Requests

| ID | Description | Priority | Category | Status | Requested |
|----|-------------|----------|----------|--------|-----------|
| FEAT-001 | Mobile app (iOS/Android) | P2 | Platform | Under Consideration | Jan 2026 |
| FEAT-002 | Offline support | P2 | Platform | Planned | Jan 2026 |
| FEAT-003 | Siri/voice integration | P3 | Integration | Under Consideration | Jan 2026 |
| FEAT-004 | Team/shared projects | P3 | Collaboration | Under Consideration | - |
| FEAT-005 | Apple Calendar sync | P2 | Integration | Open | - |
| FEAT-006 | Outlook Calendar sync | P3 | Integration | Open | - |
| FEAT-007 | Notion two-way sync | P3 | Integration | Open | - |
| FEAT-008 | Linear integration | P3 | Integration | Deprecated | Removed - PostgreSQL is source of truth |
| FEAT-009 | Slack integration | P3 | Integration | Under Consideration | - |
| FEAT-010 | Task delegation/assignment | P3 | Collaboration | Under Consideration | - |
| FEAT-011 | Natural language date parsing improvements | P2 | Tasks | Open | - |
| FEAT-012 | Dark mode for all apps | P2 | UI | Open | - |
| FEAT-013 | Export data (JSON/CSV) | P2 | Data | Open | - |
| FEAT-014 | Import from other task managers | P3 | Data | Open | - |
| FEAT-015 | Browser extension for quick capture | P3 | Capture | Under Consideration | - |
| FEAT-016 | Email forwarding to inbox | P2 | Capture | Open | - |
| FEAT-017 | Pomodoro timer integration | P3 | Productivity | Under Consideration | - |
| FEAT-018 | Focus mode (hide distractions) | P3 | UI | Under Consideration | - |
| FEAT-019 | Smart task scheduling suggestions | P3 | AI | Under Consideration | - |
| FEAT-020 | Recurring task analytics | P3 | Analytics | Under Consideration | - |

---

## Recently Completed

Items recently moved from backlog to done.

| ID | Description | Completed | Notes |
|----|-------------|-----------|-------|
| FEAT-T01 | AI Testing Agent | Jan 7, 2026 | Vision-based QA testing |
| FEAT-T02 | Job Hunting Agent | Jan 7, 2026 | Full job application pipeline |
| FEAT-T03 | Canvas Integrity Agent | Jan 7, 2026 | Assignment verification |
| ENH-T01 | Image-to-calendar event | Jan 7, 2026 | GPT-4o Vision integration |
| ENH-T02 | Smart vault classification | Jan 7, 2026 | Auto-detect content type |
| ENH-T03 | People management tools | Jan 7, 2026 | CRM-like contact tracking |
| ENH-T04 | Nested project hierarchy | Jan 7, 2026 | Parent-child projects |

---

## How to Request a Feature

To request a new feature:

1. **Check if it exists** - Search this backlog first
2. **Describe the problem** - What are you trying to accomplish?
3. **Explain the impact** - Who benefits and how much?
4. **Suggest a solution** - Optional, but helpful

We review feature requests regularly and prioritize based on:
- User impact
- Strategic alignment
- Technical feasibility
- Available resources

---

## Backlog Maintenance

This backlog is maintained as part of the development workflow:
- New issues added as discovered
- Enhancements added from user feedback
- Feature requests added from community input
- Status updated after each sprint
- Completed items archived quarterly

---

*Found a bug? Have a suggestion? This backlog is updated regularly.*
