# JD Agent - Claude Code Rules

## Project Overview

JD Agent is a personal AI assistant system designed to eliminate administrative overhead and enable a constant state of flow. It follows GTD (Getting Things Done) principles and integrates with numerous external services.

**Architecture:** Monorepo with Hub (backend API) + 3 Frontend Apps (command-center, tasks, vault)

## Required Reading Before Working

**IMPORTANT:** Before making any changes to this codebase, you MUST:

1. **Read `FEATURES.md`** - This is the single source of truth for all current features and capabilities. Understand what exists before modifying anything.

2. **Read `docs/jd-agent-prd.md`** - Product requirements document with system design and goals.

## Updating FEATURES.md

**CRITICAL RULE:** After implementing any new feature, modifying existing functionality, or adding new integrations, you MUST update `FEATURES.md` to reflect your changes.

When updating FEATURES.md:
1. Add or modify the relevant section describing the feature
2. Add an entry to the Changelog at the bottom with:
   - The date
   - Your changes (brief description of what was added/modified)
3. Update the "Last Updated" date at the top if making significant changes

This ensures all agents have an accurate understanding of the system's current capabilities.

## Tech Stack Summary

- **Backend:** Bun + TypeScript + Hono framework
- **Database:** PostgreSQL 15+ with Drizzle ORM
- **Queue:** BullMQ + Redis
- **AI:** OpenAI GPT-4 (agent), Anthropic Claude (processing)
- **Frontend:** React 19 + Vite + Tailwind CSS + React Router v7

## Key Directories

```
/hub/src/api/routes/     # API endpoints
/hub/src/services/       # Business logic
/hub/src/integrations/   # External service integrations
/hub/src/agents/         # AI agent implementation
/hub/src/db/schema.ts    # Database schema
/apps/command-center/    # Main dashboard
/apps/tasks/             # Task management UI
/apps/vault/             # Knowledge base UI
/packages/types/         # Shared TypeScript types
```

## Development Commands

```bash
bun run dev              # Start hub dev server
bun run hub              # Start hub with hot reload
bun run tasks            # Start tasks app
bun run vault            # Start vault app
bun run command-center   # Start command-center app
bun run db:push          # Push schema to database
bun run db:studio        # Open Drizzle Studio
```

## Code Style Guidelines

1. Use TypeScript strict mode
2. Follow existing patterns in the codebase
3. Add proper error handling for all API endpoints
4. Use Zod for input validation
5. Keep services focused (single responsibility)
6. Track sources for all data (where did this task/entry come from?)

## Testing

After implementing changes:
1. Run `bun run test` if tests exist
2. Verify the health endpoint: `curl http://localhost:3000/api/health`
3. Test your changes manually via the relevant API endpoints or UI

## Documentation Requirements

**CRITICAL RULE:** After implementing ANY feature, enhancement, or fix, you MUST update the documentation system. This is not optional.

### Required Documentation Updates

#### 1. Feature Documentation
**When:** After implementing any new feature or significant enhancement
**Location:** `/docs/public/features/`

Requirements:
- Create or update the relevant feature documentation page
- Use the standard template (overview, getting started, how it works, tips)
- Include step-by-step usage instructions
- Add relevant keyboard shortcuts to the shortcuts reference
- Update feature index if adding a new feature category

#### 2. Roadmap Update
**When:** After completing any roadmap item or planning new work
**Location:** `/docs/roadmap/index.md`

Requirements:
- Move completed items from "Now" section
- Update status indicators (✅ 🚧 📋 💡)
- Add new planned items to appropriate column (Now/Next/Later/Future)
- Update "Last Updated" date

#### 3. Changelog Update
**When:** After any release or significant feature completion
**Location:** `/docs/roadmap/changelog.md`

Requirements:
- Follow Keep a Changelog format
- Group by type: Added, Changed, Fixed, Removed
- Include date and version
- Write user-focused descriptions (not technical jargon)

#### 4. Backlog Update
**When:** After discovering bugs, receiving feedback, or identifying enhancements
**Location:** `/docs/roadmap/backlog.md`

Requirements:
- Add new issues with severity level
- Add new enhancements with priority
- Add new feature requests
- Update status of existing items when resolved
- Move completed items to "Recently Completed" section

### Documentation Standards

**Voice & Tone:**
- User-focused, not developer-focused
- Clear and concise
- Action-oriented (use verbs: "Create", "Click", "Navigate")
- No jargon without explanation

**Formatting:**
- Use H2 (##) for main sections
- Include "Last updated" on every page
- Use tables for references
- Use code blocks for syntax/commands

### Quick Reference: What to Update

| Change Type | FEATURES.md | Roadmap | Changelog | Backlog | Feature Docs |
|-------------|-------------|---------|-----------|---------|--------------|
| New feature | ✅ | ✅ | ✅ | ✅ | ✅ |
| Enhancement | ✅ | ✅ | ✅ | ✅ | ✅ |
| Bug fix | ✅ | - | ✅ | ✅ | - |
| New integration | ✅ | ✅ | ✅ | - | ✅ |
| Documentation only | - | - | - | - | ✅ |

**A feature is NOT complete until its documentation is complete.**

### New App/Agent Documentation

**CRITICAL RULE:** When creating a new app or agent in the `/apps/` or `/hub/src/agents/` directories, you MUST create comprehensive documentation for it.

#### Required Steps for New Apps

1. **Create Documentation Directory**
   ```
   /docs/public/features/{app-name}/index.md
   ```

2. **Required Sections in App Documentation**
   - **Overview** - What the app does and its purpose
   - **Getting Started** - Initial setup and configuration
   - **Core Features** - Main functionality with examples
   - **Available Tools** - If agent-based, list all tools with descriptions
   - **API Endpoints** - REST endpoints if applicable
   - **Configuration** - Environment variables and options
   - **Best Practices** - Usage recommendations

3. **Update Navigation** (if not automatic)
   - Add to `/docs/public/features/index.md` feature list
   - Ensure sidebar navigation includes the new app

4. **Update Project Overview**
   - Add to the "Apps" section in FEATURES.md
   - Update architecture description if significant

#### Documentation Template for New Apps

```markdown
---
title: {App Name}
description: {One-line description}
---

# {App Name}

{Overview paragraph explaining what the app does and why it exists.}

## Overview

{2-3 paragraphs about the app's purpose and capabilities.}

## Getting Started

### Prerequisites
{List of requirements}

### Configuration
{Setup instructions}

## Core Features

### Feature 1
{Description with examples}

## Available Tools

| Tool | Description |
|------|-------------|
| `tool_name` | What it does |

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/...` | What it returns |

## Configuration

Required environment variables:
```bash
EXAMPLE_VAR=value    # Description
```

## Best Practices

1. First recommendation
2. Second recommendation

## Next Steps

- [Link to related docs](/docs/features/...)
```

#### Automatic Discovery

The documentation frontend at `/apps/docs-frontend/` automatically discovers and displays documentation from `/docs/public/features/`. When you add a new app documentation folder:

1. Create the folder: `/docs/public/features/{app-name}/`
2. Add `index.md` with frontmatter (title, description)
3. The frontend will automatically include it in navigation and search

No manual navigation updates are required - the system dynamically loads all feature documentation.
