# Quick Add Syntax

Create tasks quickly with natural language.

---

## Overview

JD Agent's quick add understands natural language, allowing you to create fully-specified tasks in seconds.

**Example:**
```
Call client about proposal tomorrow 2pm p1 @calls #Acme ~30m
```

Creates:
- **Title:** "Call client about proposal"
- **Due:** Tomorrow at 2:00 PM
- **Priority:** P1 (Urgent)
- **Context:** @calls
- **Project:** Acme
- **Duration:** 30 minutes

---

## Basic Syntax

### Just a Title
```
Buy groceries
Review document
Send email to John
```

### With Due Date
```
Buy groceries tomorrow
Review document Friday
Send email Jan 15
Call mom next Monday
```

---

## Dates

### Relative Dates

| Input | Result |
|-------|--------|
| `today` | Today |
| `tomorrow` | Tomorrow |
| `yesterday` | Yesterday (for logging) |
| `next week` | 7 days from now |
| `in 3 days` | 3 days from now |
| `in 2 weeks` | 14 days from now |

### Day Names

| Input | Result |
|-------|--------|
| `monday` | Next Monday |
| `next monday` | Next Monday |
| `this friday` | This coming Friday |
| `next friday` | Friday of next week |

### Specific Dates

| Input | Result |
|-------|--------|
| `Jan 15` | January 15 |
| `January 15` | January 15 |
| `1/15` | January 15 |
| `2026-01-15` | January 15, 2026 |

### Special Dates

| Input | Result |
|-------|--------|
| `end of week` | Friday |
| `end of month` | Last day of month |
| `end of day` / `eod` | Today at 5 PM |

---

## Times

### Time Formats

| Input | Result |
|-------|--------|
| `at 2pm` | 2:00 PM |
| `at 14:00` | 2:00 PM |
| `at 2:30pm` | 2:30 PM |
| `at 9am` | 9:00 AM |
| `noon` | 12:00 PM |
| `midnight` | 12:00 AM |

### Combined Date + Time
```
tomorrow at 2pm
Friday at 10am
Jan 15 at 3:30pm
next Monday at noon
```

---

## Priority

| Input | Meaning | Color |
|-------|---------|-------|
| `p1` | Urgent | Red |
| `p2` | High | Orange |
| `p3` | Medium | Yellow |
| `p4` | Low | Blue |

**Examples:**
```
Urgent report p1
Review docs p2
Nice to have p4
```

---

## Projects

Use `#` to assign to a project:

| Input | Result |
|-------|--------|
| `#Work` | Project: Work |
| `#Personal` | Project: Personal |
| `#"Q1 Launch"` | Project: Q1 Launch (quotes for spaces) |
| `#CS401` | Project: CS401 |

**Examples:**
```
Design mockups #Work
Read chapter 5 #CS401
Plan party #Personal
Update docs #"Product Launch"
```

---

## Contexts

Use `@` to add context:

| Context | Meaning |
|---------|---------|
| `@computer` | At computer |
| `@calls` | Phone calls |
| `@errands` | Away from desk |
| `@home` | At home |
| `@office` | At office |
| `@waiting` | Waiting for someone |
| `@anywhere` | Can do anywhere |

**Examples:**
```
Call insurance @calls
Buy milk @errands
Fix bug @computer
Water plants @home
```

### Multiple Contexts
```
Check email @computer @office
```

---

## Labels

Use `:` to add labels:

| Input | Result |
|-------|--------|
| `:urgent` | Label: urgent |
| `:quick-win` | Label: quick-win |
| `:deep-work` | Label: deep-work |
| `:client-x` | Label: client-x |

**Examples:**
```
Quick fix :quick-win
Research project :deep-work
Client meeting :client-x :urgent
```

---

## Time Estimates

Use `~` to add duration estimate:

| Input | Result |
|-------|--------|
| `~15m` | 15 minutes |
| `~30m` | 30 minutes |
| `~1h` | 1 hour |
| `~2h` | 2 hours |
| `~90m` | 90 minutes |

**Examples:**
```
Review PR ~30m
Write report ~2h
Quick email ~5m
```

---

## Status Shortcuts

| Input | Result |
|-------|--------|
| `someday` | Status: Someday/Maybe |
| `waiting` | Status: Waiting |

**Examples:**
```
Learn Spanish someday
Response from John waiting
```

---

## Recurring Tasks

| Input | Result |
|-------|--------|
| `every day` | Daily |
| `every weekday` | Monday-Friday |
| `every week` | Weekly |
| `every monday` | Every Monday |
| `every month` | Monthly |

**Examples:**
```
Daily standup every weekday at 9am
Weekly review every sunday at 4pm
Pay rent every month on the 1st
Water plants every 3 days
```

---

## Full Examples

### Simple Task
```
Buy groceries
```

### Task with Date
```
Submit report Friday
```

### Task with Time
```
Call mom tomorrow at 2pm
```

### Task with Priority
```
Urgent: Fix production bug p1
```

### Task with Project
```
Design new feature #Product
```

### Task with Context
```
Call dentist @calls
```

### Task with Estimate
```
Review document ~30m
```

### Complex Task
```
Call client about proposal tomorrow 2pm p1 @calls #Acme :urgent ~30m
```
Creates:
- Title: "Call client about proposal"
- Due: Tomorrow 2:00 PM
- Priority: P1
- Context: @calls
- Project: Acme
- Label: urgent
- Duration: 30 minutes

### Another Complex Example
```
Finish quarterly report by Friday p2 #Work @computer :deep-work ~2h
```

### Recurring Task
```
Weekly team sync every monday at 10am #Work @office
```

---

## Order Doesn't Matter

These all create the same task:
```
Buy groceries tomorrow @errands
tomorrow Buy groceries @errands
@errands Buy groceries tomorrow
```

The title is everything that isn't recognized as a modifier.

---

## Tips

### Use Quotes for Spaces
```
#"Q1 Product Launch"
:"follow up"
```

### Be Specific with Dates
```
Jan 15 2026        # Specific year
next Friday        # Clear which Friday
in 3 days          # Explicit relative
```

### Stack Modifiers
```
p1 @calls ~15m     # Priority + context + time
#Work :urgent      # Project + label
```

---

## Common Patterns

### Morning Planning
```
Process inbox today @computer ~30m
```

### Quick Captures
```
Idea: new feature #Ideas someday
```

### Delegated Tasks
```
Response from John about budget waiting #Work
```

### Time-Sensitive
```
Submit application by 5pm today p1 #"Job Search"
```

---

## Related

- [Keyboard Shortcuts](./keyboard-shortcuts.md)
- [Tasks](../features/tasks/index.md)
- [AI Agent](../features/agent/index.md) - Natural language in chat

---

*Last updated: January 8, 2026*
