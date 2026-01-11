# Core Concepts

Understanding the methodology behind JD Agent will help you use it effectively.

---

## The Philosophy

> "Capture everything. Process to zero. Trust the system."

JD Agent is built on two proven productivity methodologies:
1. **GTD (Getting Things Done)** - For task management
2. **PARA** - For knowledge organization

---

## Getting Things Done (GTD)

GTD, created by David Allen, is a personal productivity methodology. JD Agent implements GTD's core workflow.

### The GTD Workflow

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   CAPTURE ──► CLARIFY ──► ORGANIZE ──► REFLECT ──► ENGAGE  │
│      │           │            │            │           │    │
│   Inbox      "Is it       Projects     Weekly      Do the   │
│   Zero       actionable?"  Contexts    Review      work     │
│              "What's the   Next        Daily                │
│               next         Actions     Review               │
│               action?"     Calendar                         │
│                           Waiting For                       │
│                           Someday/Maybe                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 1. Capture
**Get everything out of your head.**

- Use quick add (press `Q`) to capture thoughts
- Use the AI agent to capture via chat
- Forward emails to your inbox
- Capture voice memos

In JD Agent, captured items go to your **Inbox**.

### 2. Clarify
**Decide what each item means.**

For each inbox item, ask:
- Is this actionable?
- If yes, what's the very next physical action?
- If no, trash it, file it, or put it on someday/maybe

### 3. Organize
**Put things where they belong.**

| If it's... | Put it in... |
|------------|--------------|
| A next action | Today or Upcoming |
| A multi-step outcome | A Project |
| Something to do someday | Someday/Maybe |
| Waiting for someone | Waiting |
| Reference material | Vault |

### 4. Reflect
**Review your system regularly.**

- **Daily Review**: Check Today view each morning
- **Weekly Review**: Process inbox, review projects, plan ahead

JD Agent helps with automated ceremonies (morning briefing, evening review, weekly review).

### 5. Engage
**Do the work with confidence.**

When you trust your system:
- You know nothing is forgotten
- You can focus on the task at hand
- You can say "no" to distractions

---

## Key GTD Concepts in JD Agent

### Inbox
The inbox is where everything enters your system. The goal is **inbox zero** - processing every item, not completing every item.

**In JD Agent:** Inbox view shows all unclarified tasks.

### Projects
A project is any outcome requiring more than one action step.

Examples:
- "Plan vacation" (multiple tasks)
- "Complete CS401 assignment" (multiple tasks)
- "Set up new laptop" (multiple tasks)

**In JD Agent:** Projects contain tasks and can have sub-projects.

### Contexts
Contexts are the tools, locations, or conditions needed to do a task.

| Context | Meaning |
|---------|---------|
| @computer | Needs a computer |
| @calls | Phone calls |
| @errands | Away from home/office |
| @home | At home |
| @office | At the office |
| @waiting | Waiting for someone |

**In JD Agent:** Filter tasks by context to see what you can do NOW.

### Next Actions
A next action is the very next physical, visible activity.

**Not a next action:** "Plan project"
**Next action:** "Draft outline for project proposal"

### Someday/Maybe
Ideas and tasks you might want to do eventually, but not now.

**In JD Agent:** Tasks with "someday" status.

### Waiting For
Things you're waiting on from others.

**In JD Agent:** Tasks with "waiting" status include who you're waiting for and since when.

---

## PARA: Organizing Knowledge

PARA, created by Tiago Forte, organizes information into four categories.

### The PARA Structure

```
VAULT/
├── PROJECTS      # Active outcomes with deadlines
├── AREAS         # Ongoing responsibilities
├── RESOURCES     # Reference materials by topic
└── ARCHIVE       # Completed/inactive items
```

### Projects
Active outcomes with a deadline or target completion.

Examples:
- Q1 Product Launch
- CS401 Final Paper
- Home Renovation

### Areas
Ongoing areas of life/work without a deadline.

Examples:
- Health
- Career
- Family
- Finance

### Resources
Topic-based reference material you might need.

Examples:
- Programming tutorials
- Recipes
- Travel destinations

### Archive
Completed projects and inactive items.

Everything ends up here eventually - creating a searchable history.

---

## How JD Agent Implements These

### Task Flow

```
                    ┌─────────────────┐
                    │   QUICK ADD     │
                    │   AI AGENT      │
                    │   EMAIL         │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │     INBOX       │
                    │   (Capture)     │
                    └────────┬────────┘
                             │
                    ┌────────┴────────┐
                    │    CLARIFY      │
                    │  "Actionable?"  │
                    └────────┬────────┘
                             │
          ┌──────────────────┼──────────────────┐
          │                  │                  │
          ▼                  ▼                  ▼
    ┌───────────┐     ┌───────────┐     ┌───────────┐
    │   TODAY   │     │  SOMEDAY  │     │   VAULT   │
    │  UPCOMING │     │   MAYBE   │     │ (Archive) │
    │ (Do it)   │     │ (Later)   │     │ (Ref/Del) │
    └───────────┘     └───────────┘     └───────────┘
          │
          ▼
    ┌───────────┐
    │ COMPLETE  │──────────────────────► VAULT
    └───────────┘                       (Archived)
```

### Vault Organization (PARA)

The Vault organizes your knowledge:

| Location | Contains |
|----------|----------|
| `/Projects/` | Notes linked to active projects |
| `/Areas/School/` | Class notes, lectures |
| `/Areas/Work/` | Work documents, meeting notes |
| `/Resources/` | Reference materials |
| `/Archive/` | Completed tasks, old projects |
| `/Journal/` | Daily reflections |
| `/People/` | Contact notes |
| `/Recordings/` | Transcribed audio |

### Task → Vault Connection

When you complete a task:
1. Task is marked done
2. Task is automatically archived to Vault
3. Task details preserved forever
4. Searchable in your history

This creates a record of everything you've accomplished.

---

## Daily Practice

### Morning Routine
1. Check **Today** view
2. Review calendar
3. Process **Inbox** (if items exist)
4. Choose your first task

JD Agent can send you a morning briefing with this information.

### During the Day
1. Capture thoughts to Inbox immediately
2. Work from **Today** and **Contexts**
3. Complete tasks as you go

### Evening Routine
1. Review what you completed
2. Quick inbox processing
3. Set intentions for tomorrow

JD Agent can send you an evening review.

### Weekly Review (Most Important!)
1. Process all inboxes to zero
2. Review each project - is it moving?
3. Review calendar - what's coming?
4. Review Someday/Maybe - anything to activate?
5. Clean up loose ends

JD Agent prompts weekly reviews on Sundays.

---

## Key Terminology

| Term | Definition |
|------|------------|
| **Inbox** | Collection point for unprocessed items |
| **Next Action** | The very next physical step |
| **Project** | Outcome requiring multiple actions |
| **Context** | Where/how you can do a task |
| **Waiting For** | Delegated items |
| **Someday/Maybe** | Future possibilities |
| **PARA** | Projects, Areas, Resources, Archive |
| **Vault** | Knowledge base / second brain |
| **Ceremony** | Automated review/briefing |

---

## Tips for Success

### Do's
- Capture everything immediately
- Process inbox daily
- Do weekly reviews
- Trust the system
- Use contexts when choosing tasks

### Don'ts
- Don't use your inbox as a to-do list
- Don't create projects for single tasks
- Don't skip weekly reviews
- Don't keep things in your head
- Don't over-organize

---

## Further Reading

- **Getting Things Done** by David Allen
- **Building a Second Brain** by Tiago Forte
- **The PARA Method** by Tiago Forte

---

## Next Steps

Now that you understand the concepts:
1. [Create your first tasks](./quick-start.md)
2. [Set up your projects](../features/tasks/projects.md)
3. [Configure ceremonies](../features/ceremonies/index.md)

---

*"Your mind is for having ideas, not holding them." - David Allen*

*Last updated: January 8, 2026*
