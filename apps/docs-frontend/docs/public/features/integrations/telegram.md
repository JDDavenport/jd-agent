# Telegram Integration

Two-way chat with JD Agent via Telegram.

---

## Overview

The Telegram integration provides:
- **Chat with the Agent** from anywhere
- **Receive ceremonies** (morning, evening, weekly)
- **Quick capture** tasks and notes
- **Real-time notifications** for deadlines

---

## Setup

### Step 1: Create a Telegram Bot

1. Open Telegram and search for **@BotFather**
2. Send `/newbot`
3. Choose a name for your bot (e.g., "My JD Agent")
4. Choose a username (must end in `bot`, e.g., `myjdagent_bot`)
5. Save the **API token** you receive

### Step 2: Configure JD Agent

Add to your `.env` file:

```env
TELEGRAM_BOT_TOKEN=your_bot_token_here
```

### Step 3: Restart the Hub

```bash
bun run hub
```

### Step 4: Start a Conversation

1. Search for your bot in Telegram
2. Click **Start**
3. Send any message to begin

The bot is now connected and will respond to your messages.

---

## Features

### Chat with Agent

Send natural language messages:

```
What's on my calendar today?
Create a task to call mom tomorrow
What did I complete this week?
Remember: My wifi password is abc123
```

All 37 agent tools are available via Telegram.

### Quick Task Capture

Fast task creation:

```
Task: Review quarterly report by Friday
Task: Call insurance @calls
Task: Buy groceries @errands
```

Or just describe it naturally:

```
I need to remember to pick up dry cleaning tomorrow
```

### Receive Ceremonies

Configure in Settings → Ceremonies:
- Enable Telegram delivery
- Receive morning briefings
- Get evening reviews
- Weekly review reminders

### Notifications

Receive alerts for:
- Upcoming deadlines
- Overdue tasks
- Calendar reminders
- Canvas assignment updates

---

## Commands

### Built-in Commands

| Command | Description |
|---------|-------------|
| `/start` | Initialize the bot |
| `/help` | Show available commands |
| `/today` | Today's tasks and calendar |
| `/inbox` | Show inbox count |

### Natural Language

Most interactions work with natural language:

```
Show me my tasks
What's next?
Mark the report task as done
Schedule deep work tomorrow morning
```

---

## Image Support

### Send Screenshots

Send images for:
- Event extraction (calendar invites, flyers)
- Document capture
- Quick reference storage

Example:
1. Take a screenshot of a meeting invite
2. Send it to the bot
3. Say "Add this to my calendar"
4. Event is created automatically

---

## Best Practices

### Quick Capture
1. Use Telegram for quick captures when away from computer
2. Process properly later in Tasks app
3. Keep messages short and specific

### Task Creation
1. Include context: `@calls`, `@errands`
2. Include dates: "tomorrow", "Friday"
3. Include priority when urgent: "p1"

### Checking In
1. Morning: Ask for today's briefing
2. Evening: Ask what you completed
3. Before meetings: Check calendar

---

## Multiple Users

### Personal Bot
Each user should have their own bot for privacy.

### Security
- Bot token gives full access to your system
- Don't share your bot token
- Consider IP restrictions in production

---

## Troubleshooting

### Bot Not Responding

1. Check `TELEGRAM_BOT_TOKEN` is set correctly
2. Verify hub is running
3. Check for error messages in logs
4. Ensure bot isn't blocked

### Messages Delayed

1. Check internet connectivity
2. Verify Telegram API status
3. Check for rate limiting
4. Review queue processing

### Commands Not Working

1. Make sure you started a conversation with `/start`
2. Check the command spelling
3. Try natural language instead

### Ceremonies Not Arriving

1. Verify Telegram is enabled for ceremonies (Settings)
2. Check scheduler is running
3. Test with manual trigger
4. Verify chat ID is saved

---

## Privacy & Security

### What's Sent
- Your messages to the agent
- Ceremony content
- Notifications you've enabled

### What's Not Sent
- Your full database
- Other users' data
- Credentials or API keys

### Data Storage
- Chat history stored locally
- Up to 20 messages for context
- No data shared with Telegram beyond messages

---

## Related Features

- [AI Agent](../agent/index.md) - Full agent capabilities
- [Ceremonies](../ceremonies/index.md) - Automated briefings
- [Tasks](../tasks/index.md) - Task management
- [Calendar](../calendar/index.md) - Calendar features

---

*Last updated: January 8, 2026*
