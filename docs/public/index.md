# JD Agent Documentation

> Your AI-powered personal productivity system built on GTD principles

Welcome to JD Agent - a comprehensive personal assistant that eliminates administrative overhead and helps you maintain a constant state of flow.

---

## Quick Links

| Getting Started | Core Features | Resources |
|-----------------|---------------|-----------|
| [Installation](./getting-started/installation.md) | [Tasks](./features/tasks/index.md) | [Keyboard Shortcuts](./reference/keyboard-shortcuts.md) |
| [Quick Start](./getting-started/quick-start.md) | [Vault](./features/vault/index.md) | [Quick Add Syntax](./reference/quick-add-syntax.md) |
| [Core Concepts](./getting-started/core-concepts.md) | [Calendar](./features/calendar/index.md) | [API Reference](./reference/api.md) |
| | [AI Agent](./features/agent/index.md) | [Glossary](./reference/glossary.md) |
| | [Integrations](./features/integrations/index.md) | |

---

## What is JD Agent?

JD Agent is a personal AI assistant system that combines:

- **Task Management** - GTD-based workflow with inbox, projects, contexts, and recurring tasks
- **Knowledge Base (Vault)** - Notion-like knowledge management with full-text and semantic search
- **AI Agent** - Intelligent assistant that can create tasks, manage calendar, and organize information
- **Ceremonies** - Automated morning briefings, evening reviews, and weekly planning
- **Integrations** - Connect with Google Calendar, Canvas LMS, Telegram, and more

### The Philosophy

> "Capture everything. Process to zero. Trust the system."

JD Agent follows the Getting Things Done (GTD) methodology:

1. **Capture** - Get everything out of your head into the inbox
2. **Clarify** - Process each item: is it actionable? What's the next step?
3. **Organize** - Put items in the right place (projects, calendar, contexts)
4. **Reflect** - Review your system regularly (daily, weekly)
5. **Engage** - Do the work with confidence

---

## System Architecture

JD Agent consists of multiple apps that work together:

| App | Purpose | Port |
|-----|---------|------|
| **Hub** | Backend API - single source of truth | 3000 |
| **Command Center** | Main dashboard and system overview | 5173 |
| **Tasks** | Focused task management interface | 5174 |
| **Vault** | Knowledge base and note-taking | 5175 |
| **Jobs** | Job hunting agent interface | 5176 |

---

## Feature Overview

### Task Management
Create, organize, and complete tasks with powerful features:
- Natural language quick add ("Call mom tomorrow at 2pm @calls")
- GTD statuses: inbox, today, upcoming, waiting, someday
- Projects with sections and hierarchies
- Contexts (@computer, @calls, @errands)
- Recurring tasks with flexible schedules

[Learn more about Tasks](./features/tasks/index.md)

### Vault (Knowledge Base)
Your second brain for storing and finding information:
- Notion-like hierarchical organization
- Full-text and semantic search
- Automatic archival of completed tasks
- Daily journal with reflections
- File attachments and recordings

[Learn more about Vault](./features/vault/index.md)

### AI Agent
An intelligent assistant that understands your system:
- 37 specialized tools for tasks, calendar, vault, and more
- Natural language chat interface
- Smart classification of content
- Image-to-calendar event extraction
- Available via web and Telegram

[Learn more about the Agent](./features/agent/index.md)

### Ceremonies
Automated check-ins to keep you on track:
- Morning briefing with today's priorities
- Evening review of accomplishments
- Weekly review for planning ahead
- Delivered via Telegram, SMS, or email

[Learn more about Ceremonies](./features/ceremonies/index.md)

### Integrations
Connect JD Agent with your existing tools:
- Google Calendar (bidirectional sync)
- Canvas LMS (assignment tracking)
- Telegram (chat bot)
- Notion, Google Drive, Apple Notes (import)
- Whoop (health metrics)

[View all Integrations](./features/integrations/index.md)

---

## Getting Help

- **Documentation** - You're reading it!
- **Roadmap** - See what's [planned and in progress](../roadmap/index.md)
- **Backlog** - View [known issues and feature requests](../roadmap/backlog.md)
- **Changelog** - See [what's new](../roadmap/changelog.md)

---

## Next Steps

1. **New to JD Agent?** Start with [Installation](./getting-started/installation.md)
2. **Already set up?** Try the [Quick Start Guide](./getting-started/quick-start.md)
3. **Want to understand the methodology?** Read [Core Concepts](./getting-started/core-concepts.md)

---

*Last updated: January 8, 2026*
