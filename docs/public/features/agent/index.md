# AI Agent

Your intelligent assistant for managing tasks, calendar, and knowledge.

---

## Overview

JD Agent includes a powerful AI assistant powered by GPT-4 that can help you manage your productivity system through natural conversation.

### Key Capabilities
- **37 specialized tools** for tasks, calendar, vault, and more
- **Natural language** understanding - just chat normally
- **Smart classification** of content and entries
- **Available everywhere** - web chat and Telegram

---

## Getting Started

### Access the Agent

**Option 1: Web Chat**
1. Open Command Center (http://localhost:5173)
2. Click **Chat** in the sidebar
3. Type your message and press Enter

**Option 2: Telegram**
1. Set up the Telegram integration
2. Message the bot directly
3. Get responses anywhere

### Your First Conversation

Try these to get started:

```
What's on my schedule today?
```

```
Create a task to review quarterly report by Friday
```

```
What did I complete last week?
```

---

## What the Agent Can Do

### Task Management

| Command | Example |
|---------|---------|
| Create tasks | "Create a task to call mom tomorrow" |
| List tasks | "What's in my inbox?" |
| Update tasks | "Mark the call task as high priority" |
| Complete tasks | "I finished the report task" |
| View counts | "How many tasks do I have today?" |

**Examples:**
```
Create a task to finish the presentation by Friday with high priority

What tasks are due this week?

Move the grocery task to the errands context

I completed all the tasks from yesterday
```

### Calendar

| Command | Example |
|---------|---------|
| View today | "What's on my calendar today?" |
| View upcoming | "What meetings do I have this week?" |
| Create events | "Schedule a meeting with Sarah tomorrow at 2pm" |
| Check conflicts | "Am I free on Friday afternoon?" |
| From images | "Add this event to my calendar" (with screenshot) |

**Examples:**
```
What's on my calendar for tomorrow?

Schedule lunch with John on Friday at noon at the cafe downtown

Do I have any conflicts on Thursday?

Block 2 hours tomorrow morning for deep work
```

### Vault / Knowledge Base

| Command | Example |
|---------|---------|
| Search | "Find my notes about machine learning" |
| Create entries | "Remember this: my car plate is ABC-1234" |
| Get entries | "Show me my resume" |
| View stats | "How many entries are in my vault?" |
| Smart add | "Save this important info..." |

**Examples:**
```
What do I know about project management?

Remember this credential: AWS key is AKIA...

Show me my notes from last week's meeting

Save this article about productivity tips
```

### People / Contacts

| Command | Example |
|---------|---------|
| Add contacts | "Add John Smith to my contacts, he works at Acme" |
| Find people | "Who do I know at Google?" |
| Log interactions | "I met with Sarah today about the project" |
| Update info | "Update John's email to john@newco.com" |

**Examples:**
```
Add a contact for my new manager Sarah Jones

Find everyone tagged as client

I had coffee with Mike yesterday, we discussed his startup

What's John's phone number?
```

### Scheduling

| Command | Example |
|---------|---------|
| Schedule tasks | "Schedule the report task for tomorrow at 9am" |
| Get suggestions | "When should I work on deep tasks?" |
| View today | "What's my schedule today?" |
| Unschedule | "Remove the time from the meeting task" |

### System

| Command | Example |
|---------|---------|
| Health check | "Is everything working?" |
| Context | "What's the current date and time?" |
| Integrity | "Run a system check" |

---

## Smart Features

### Smart Vault Classification

When you say "remember this" or use `-vault`, the agent automatically:
- Detects content type (credential, person, financial, medical, note)
- Assigns appropriate tags
- Links to relevant people
- Categorizes for easy retrieval

**Examples:**
```
Remember this: my SSN is 123-45-6789
→ Classified as: credential, confidential

Remember this: Met John at the conference, he's a VP at Acme
→ Classified as: person, creates contact entry
```

### Image to Calendar

Send a screenshot of an event invite or flyer, and the agent will:
- Extract event details using GPT-4 Vision
- Parse date, time, location
- Create a calendar event automatically

**How to use:**
1. Take a screenshot of an event
2. In chat, mention adding to calendar
3. Attach the image
4. Agent extracts and creates the event

### Natural Language Dates

The agent understands flexible date formats:
- "tomorrow"
- "next Friday"
- "in 3 days"
- "end of month"
- "January 15th"

---

## Agent Tools (37 Total)

### Tasks (5 tools)
| Tool | Description |
|------|-------------|
| `task_create` | Create a new task |
| `task_list` | List tasks with filters |
| `task_update` | Update task properties |
| `task_complete` | Mark task complete |
| `task_counts` | Get task statistics |

### Vault (5 tools)
| Tool | Description |
|------|-------------|
| `vault_search` | Search vault entries |
| `vault_create` | Create vault entry |
| `vault_get` | Get specific entry |
| `vault_stats` | Vault statistics |
| `vault_smart_add` | Smart classification and add |

### Calendar (6 tools)
| Tool | Description |
|------|-------------|
| `calendar_today` | Today's events |
| `calendar_upcoming` | Future events |
| `calendar_query` | Search events |
| `calendar_create` | Create event |
| `calendar_check_conflicts` | Check availability |
| `calendar_from_image` | Extract event from image |

### People (5 tools)
| Tool | Description |
|------|-------------|
| `people_create` | Add contact |
| `people_search` | Find contacts |
| `people_get` | Get contact details |
| `people_update` | Update contact |
| `people_add_interaction` | Log interaction |

### Scheduling (4 tools)
| Tool | Description |
|------|-------------|
| `schedule_task` | Schedule a task |
| `schedule_suggestions` | Get scheduling suggestions |
| `schedule_today` | Today's schedule |
| `unschedule_task` | Remove task schedule |

### Canvas (2 tools)
| Tool | Description |
|------|-------------|
| `canvas_sync` | Sync Canvas assignments |
| `canvas_assignments` | List assignments |

### Time Tracking (3 tools)
| Tool | Description |
|------|-------------|
| `time_log` | Log time spent |
| `time_report` | Generate time report |
| `time_stats` | Time statistics |

### System (3 tools)
| Tool | Description |
|------|-------------|
| `system_health` | Check system health |
| `integrity_check` | Run integrity check |
| `get_current_context` | Get current date/time |

---

## Communication Style

The agent is designed to be:
- **Direct and efficient** - No unnecessary pleasantries
- **Accountable** - Like a helpful coach
- **Proactive** - Identifies potential issues
- **Confirming** - Always confirms actions taken

### What to Expect

**You say:** "Create a task to call mom"

**Agent responds:**
```
Created task: "Call mom"
- Status: inbox
- No due date set

Would you like me to schedule this or add any details?
```

---

## Tips for Effective Use

### Be Specific
```
Good: "Create a task to review the Q4 budget report by Friday"
Less good: "Remind me about the budget"
```

### Use Natural Phrasing
```
Good: "What meetings do I have tomorrow?"
Good: "Show me tomorrow's calendar"
Good: "Am I busy tomorrow?"
```

### Let the Agent Help
```
"What should I work on next?"
"Do I have any overdue tasks?"
"Summarize my week"
```

### Combine Actions
```
"Create a task to call John and schedule it for tomorrow at 2pm"
"Find my notes about the project and create a task to review them"
```

---

## Telegram Setup

### Setting Up the Bot

1. Create a Telegram bot via @BotFather
2. Get your bot token
3. Add to `.env`: `TELEGRAM_BOT_TOKEN=your_token`
4. Restart the hub
5. Message your bot to start

### Using Telegram

All the same commands work in Telegram:
- Send text messages for commands
- Send images for image-to-calendar
- Receive ceremony notifications

---

## Related Features

- [Tasks](../tasks/index.md) - Task management details
- [Vault](../vault/index.md) - Knowledge base details
- [Calendar](../calendar/index.md) - Calendar management
- [Telegram Integration](../integrations/telegram.md) - Telegram setup

---

*Last updated: January 8, 2026*
