# Ceremonies

Automated check-ins to keep you on track.

---

## Overview

Ceremonies are scheduled messages that help you start your day, review your accomplishments, and plan ahead. They bring GTD's review practice to you automatically.

### Key Capabilities
- **Morning briefing** - Start your day informed
- **Evening review** - Reflect on accomplishments
- **Weekly review** - Plan the week ahead
- **Multiple channels** - Telegram, SMS, or email

---

## The Three Ceremonies

### Morning Ceremony

**When:** 6:00 AM daily (configurable)

**What you receive:**
- Greeting and motivation
- Today's weather
- Calendar overview for the day
- Top 3 priority tasks
- Upcoming deadlines
- Unprocessed inbox count

**Example:**
```
Good morning! Here's your briefing for Tuesday, January 8th.

☀️ Weather: 45°F, partly cloudy

📅 Today's Schedule:
• 9:00 AM - Team standup
• 12:00 PM - Lunch with Sarah
• 2:00 PM - Client call

✅ Top Priorities:
1. Finish quarterly report (due tomorrow)
2. Review PR #234
3. Process inbox (5 items)

⚠️ Upcoming Deadlines:
• CS401 Assignment - Due Wednesday

Have a productive day!
```

### Evening Ceremony

**When:** 9:00 PM daily (configurable)

**What you receive:**
- Day review
- Tasks completed today
- Tasks still pending
- Tomorrow's preview
- Rest reminder

**Example:**
```
Good evening! Here's your daily wrap-up.

✅ Completed Today: 8 tasks
• Finished quarterly report
• Team standup
• Review PR #234
• [5 more...]

⏳ Carried Forward:
• Process inbox (moved to tomorrow)

📅 Tomorrow's Preview:
• 3 meetings scheduled
• Report due to client

Get some rest - you've earned it!
```

### Weekly Review

**When:** Sunday 4:00 PM (configurable)

**What you receive:**
- Week in review statistics
- Goals progress
- Wins and accomplishments
- Stuck projects (no activity)
- Next week preview
- Planning prompts

**Example:**
```
Weekly Review - Week of January 6th

📊 This Week:
• Tasks completed: 34
• Tasks created: 28
• Inbox processed: 12

🎯 Goals Progress:
• Q1 Revenue: 80% ████████░░
• Thesis: 30% ███░░░░░░░

🏆 Wins:
• Shipped new feature
• Completed Canvas assignments
• Had productive 1:1

⚠️ Needs Attention:
• Home Renovation project (no activity in 5 days)

📅 Next Week:
• 8 meetings scheduled
• MBA502 Midterm on Wednesday

Take 15 minutes to review your projects and plan your week!
```

---

## Setting Up Ceremonies

### Configuration

1. Open Command Center → Settings
2. Navigate to **Ceremonies** section
3. Configure each ceremony:

| Setting | Options |
|---------|---------|
| **Time** | Choose when to send |
| **Enabled** | On/Off for each ceremony |
| **Channels** | Telegram, SMS, Email |

### Delivery Channels

**Telegram (Recommended)**
- Instant delivery
- Rich formatting
- Can respond to agent

**Email**
- Full HTML formatting
- Good for detailed reviews
- Available offline

**SMS (Twilio)**
- Short notifications
- Works everywhere
- Best for reminders

### Multiple Channels

You can enable multiple channels per ceremony:
- Morning: Telegram + Email
- Evening: Telegram only
- Weekly: Email + Telegram

---

## Customizing Ceremonies

### Change Times

Adjust to your schedule:
- Early risers: Morning at 5:30 AM
- Night owls: Evening at 10:30 PM
- Different weekly review day

### Content Preferences

Future enhancement: Choose what's included:
- [ ] Weather
- [ ] Motivational quotes
- [ ] Detailed vs. summary format

---

## Manual Triggers

### Test Ceremonies

In Settings → Ceremonies:
- Click **Test** next to any ceremony
- Receive it immediately
- Verify content and formatting

### Via API

```bash
# Trigger morning ceremony
curl -X POST http://localhost:3000/api/ceremonies/morning/trigger

# Trigger evening ceremony
curl -X POST http://localhost:3000/api/ceremonies/evening/trigger

# Trigger weekly review
curl -X POST http://localhost:3000/api/ceremonies/weekly/trigger
```

### Via Agent

```
Send me my morning briefing now
Give me an evening review
```

---

## Behind the Scenes

### How Ceremonies Work

1. Scheduler runs at configured times
2. System gathers relevant data:
   - Tasks, calendar, inbox counts
   - Weather (if configured)
   - Goals and progress
3. AI generates personalized message
4. Delivery via configured channels
5. Logged for history

### Data Sources

Ceremonies pull from:
- Tasks (today, inbox, completed)
- Calendar (events, deadlines)
- Projects (activity, progress)
- Goals (targets, current values)
- Weather API (location-based)

---

## Best Practices

### Morning Ceremony
1. Read it while having coffee
2. Adjust your day based on calendar
3. Tackle top priority first
4. Process inbox if count is high

### Evening Ceremony
1. Acknowledge your wins
2. Note what needs attention tomorrow
3. Let go of incomplete items
4. Rest without guilt

### Weekly Review
1. Block 30-60 minutes for review
2. Use it as a trigger, not the whole review
3. Process all inboxes
4. Review stuck projects
5. Plan next week's priorities

---

## Troubleshooting

### Not Receiving Ceremonies

1. Check ceremony is enabled (Settings → Ceremonies)
2. Verify channel is configured (Telegram/Email)
3. Check scheduler is running (`bun run scheduler`)
4. Review system logs for errors

### Wrong Information

1. Ensure integrations are synced
2. Check timezone settings
3. Verify task/calendar data is current

### Delayed Delivery

1. Check scheduler health
2. Verify external service status (Telegram API)
3. Review network connectivity

---

## Related Features

- [Tasks](../tasks/index.md) - Task data in ceremonies
- [Calendar](../calendar/index.md) - Calendar data in ceremonies
- [Telegram Integration](../integrations/telegram.md) - Delivery setup
- [Agent](../agent/index.md) - Manual ceremony triggers

---

*Last updated: January 8, 2026*
