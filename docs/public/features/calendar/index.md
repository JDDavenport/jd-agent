# Calendar

Keep track of your schedule and manage events.

---

## Overview

JD Agent integrates with Google Calendar to provide a unified view of your schedule alongside your tasks.

### Key Capabilities
- **Bidirectional sync** with Google Calendar
- **Event management** - create, update, delete via Agent
- **Conflict detection** - know when you're double-booked
- **Time blocking** - schedule focused work time
- **Integration** with tasks for scheduling

---

## Getting Started

### Connect Google Calendar

1. Open Command Center → Settings
2. Click **Connect Google Calendar**
3. Sign in with your Google account
4. Grant calendar permissions
5. Calendar syncs automatically

### View Your Calendar

**In Command Center Dashboard:**
- Week overview widget shows 7-day calendar with events
- Density heatmap indicates busy days
- Workload indicators (light/moderate/heavy)
- Click any day to expand and see all events
- Time allocation breakdown by event type

**Via Agent:**
```
What's on my calendar today?
What meetings do I have this week?
```

---

## Features

### Event Types

| Type | Description | Example |
|------|-------------|---------|
| `meeting` | Meetings with others | Team standup |
| `class` | Academic classes | CS401 Lecture |
| `deadline` | Due dates | Assignment due |
| `personal` | Personal events | Dinner reservation |
| `blocked_time` | Focus time | Deep work block |

### Creating Events

Events are created via the AI Agent:
```
Schedule a meeting with Sarah tomorrow at 2pm

Create an event: "Dentist appointment" on Friday at 10am

Block 2 hours tomorrow morning for deep work
```

**Event Properties:**
- Title
- Date and time
- Duration
- Location
- Attendees
- Description

### All-Day Events

For events without specific times:
```
Add an all-day event: "Conference" on January 15th
```

### Recurring Events

Create repeating events:
```
Schedule team standup every weekday at 9am
Add a monthly review on the first Monday of each month
```

---

## Conflict Detection

JD Agent automatically detects scheduling conflicts.

**Check availability:**
```
Am I free on Friday at 2pm?
Do I have any conflicts this week?
What's my availability tomorrow afternoon?
```

**When creating events:**
- Agent warns if there's a conflict
- Suggests alternative times
- Shows what's blocking the slot

---

## Time Blocking

Schedule focused work time on your calendar.

### Creating Time Blocks

**Via Agent:**
```
Block 2 hours tomorrow morning for the report
Schedule deep work time on Friday afternoon
```

**Block Types:**
- Deep work
- Administrative tasks
- Email processing
- Planning

### Best Practices

1. **Block early** - Schedule important work first
2. **Protect blocks** - Treat them like meetings
3. **Be realistic** - Leave buffer time
4. **Review weekly** - Adjust based on needs

---

## Task ↔ Calendar Integration

### Scheduling Tasks

Tasks with scheduled times appear on your calendar:
```
Schedule the report task for tomorrow at 9am
```

This:
- Sets the task's scheduled time
- Creates a calendar event
- Links task and event

### Task Due Dates

Due dates are different from scheduled times:
- **Due date**: When something is DUE
- **Scheduled**: When you'll WORK on it

Example: "Report due Friday, scheduled for Wednesday"

---

## Image-to-Calendar

The AI Agent can extract events from images.

### How It Works

1. Take a screenshot of an event invite, flyer, or email
2. Send to the agent with a request to add it
3. Agent uses GPT-4 Vision to extract details
4. Event is created automatically

### Example

```
User: [attaches screenshot of conference invite]
"Add this to my calendar"

Agent: Created event:
- Title: Tech Conference 2026
- Date: March 15-17, 2026
- Location: Convention Center
- Notes: [extracted details]
```

---

## Dashboard Week Calendar

The Command Center dashboard includes an enhanced week calendar widget:

### Features
- **7-day overview** with all events
- **Density heatmap** - background color intensity shows busy days
- **Workload indicators** - light (green), moderate (yellow), heavy (red)
- **Expandable days** - click to see all events
- **Event type colors** - meetings (purple), classes (blue), personal (green), focus (yellow)
- **Time allocation breakdown** - see how time is distributed

### Event Display
- First 2 events shown per day
- "+N more" indicator for additional events
- Task count per day
- Current day highlighted

---

## Sync Settings

### Automatic Sync

Calendar syncs automatically:
- Periodically for changes
- Immediately when you create events via Agent
- On app startup

### Manual Sync

Force a sync via Agent:
```
Sync my calendar now
```

---

## Tips & Best Practices

### Planning Your Day
1. Check dashboard calendar each morning
2. Identify fixed commitments
3. Block time for important tasks via Agent
4. Leave buffer between events

### Avoiding Overload
1. Don't schedule back-to-back meetings
2. Block focus time early in the week
3. Review calendar before accepting invites
4. Use conflict detection

### Task Integration
1. Schedule tasks, don't just set due dates
2. Use time estimates for realistic blocking
3. Review dashboard for scheduled tasks

---

## API Endpoints

For developers and integrations:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/calendar` | GET | List events with filters |
| `/api/calendar/today` | GET | Today's events |
| `/api/calendar/upcoming` | GET | Upcoming events (default 7 days) |
| `/api/calendar/sync` | GET | Trigger Google Calendar sync |
| `/api/calendar/status` | GET | Integration status |
| `/api/calendar/:id` | GET | Get single event |
| `/api/calendar` | POST | Create event |
| `/api/calendar/check-conflicts` | POST | Check for conflicts |
| `/api/calendar/:id` | PATCH | Update event |
| `/api/calendar/:id` | DELETE | Delete event |

---

## Related Features

- [Tasks](../tasks/index.md) - Task scheduling
- [Agent](../agent/index.md) - Calendar via chat
- [Ceremonies](../ceremonies/index.md) - Calendar in briefings

---

## Roadmap

Future enhancements planned:
- Dedicated calendar page with month/week/day views
- Event creation modal in UI
- View navigation and switching
- Keyboard shortcuts for calendar navigation

---

*Last updated: January 10, 2026*
