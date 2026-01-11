# Daily Journal

Evening review workflow to reflect on the day, track habits, and prepare for tomorrow.

---

## Overview

The Daily Journal is integrated into the Command Center and provides a structured 7-step evening review workflow that helps you reflect on your day, celebrate wins, and prepare for tomorrow. It integrates with your existing habits, goals, tasks, and calendar to provide a comprehensive daily review experience.

The workflow guides you through reviewing your habit completions, reflecting on goal progress, writing journal entries, reviewing completed tasks, and previewing tomorrow's schedule - all in one cohesive interface.

## Getting Started

### Access the Journal

1. Open the Command Center at `http://localhost:5173`
2. Click "Journal" in the sidebar navigation (between Habits and Vault)
3. Or navigate directly to `http://localhost:5173/journal`

### Start Your First Review

1. The review page loads with today's date automatically
2. Progress through each step using the "Next" button
3. Your progress auto-saves every 30 seconds
4. Complete all 7 steps to finish your review

---

## The 7-Step Workflow

### Step 1: Habits Review

Review your daily habits and mark completions.

**Features:**
- View all habits scheduled for today
- See current streak for each habit
- Toggle completion status directly in the review
- Track completion percentage

**What you see:**
- Habit title and description
- Current streak (days)
- Completion checkbox
- Overall completion percentage

### Step 2: Goals Review

Reflect on your active goals grouped by life area.

**Life Areas:**
- Spiritual
- Personal
- Fitness
- Family
- Professional
- School

**What you see:**
- Goals grouped by life area
- Current progress percentage for each goal
- Health score indicator
- Goal description and motivation

### Step 3: Journal Entry

Write your daily journal in the text editor.

**Editor Features:**
- Simple text area for free-form writing
- Auto-save every 30 seconds
- Word count display
- Reflection prompts to guide your writing

**Prompts to consider:**
- What went well today?
- What could have gone better?
- What am I grateful for?
- What did I learn?

### Step 4: Tasks Review

Review completed tasks from today.

**Features:**
- List of all tasks completed today
- Optional reflection notes per task
- Project and source indicators
- Time estimates and actual time spent

### Step 5: Classes Review

Review class notes and lectures from today (conditional).

**Note:** This step only appears if you have class-related content for the day.

**Features:**
- Today's class notes from the vault
- Key takeaways summary
- Add reflection notes

### Step 6: Tomorrow Preview

See what's coming up tomorrow to prepare mentally.

**What you see:**
- Tomorrow's calendar events
- Tasks scheduled for tomorrow
- Habits to complete
- Any upcoming deadlines

### Step 7: Complete Review

Finalize your review and save to the vault.

**Actions:**
- Select your mood (Great, Good, Okay, Difficult, Terrible)
- Add tags to categorize the day
- View summary of your review
- Save to vault as a permanent record

---

## Features

### Auto-Save

Your review automatically saves every 30 seconds. You can:
- Leave and return later - your progress is preserved
- See the last save time in the interface
- Manually save with Cmd/Ctrl + S

### Mood Tracking

Select from 5 mood levels at the end of your review:
- Great (excellent day)
- Good (positive day)
- Okay (neutral day)
- Difficult (challenging day)
- Terrible (very hard day)

### Tags

Add tags to categorize your day:
- Suggested tags appear based on common usage
- Type custom tags and press Enter
- Tags help with searching past reviews

### Progress Indicator

Visual progress bar shows:
- Current step number
- Steps completed
- Steps remaining

### Vault Integration

Completed reviews are saved to the vault:
- Creates a formatted vault page
- Includes journal text, mood, tags
- Links to habits, tasks, and goals reviewed
- Searchable in vault

---

## History View

Browse and search your past reviews.

### Access History

1. Click "View History" from the main screen
2. Or click "History" button when a review is complete

### Search Reviews

- Search by journal text content
- Filter by date range
- Filter by mood
- Filter by tags

### Review Details

Click any past review to see:
- Full journal entry
- Mood and tags
- Habits completed that day
- Tasks reviewed

---

## API Reference

### Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/journal/daily-review` | GET | Get review data for a date |
| `/api/journal/daily-review/save` | POST | Save review draft |
| `/api/journal/daily-review/complete` | POST | Complete and save to vault |
| `/api/journal/daily-review/history` | GET | Get paginated history |
| `/api/journal/daily-review/search` | GET | Search reviews |
| `/api/journal/habits/:id/toggle` | POST | Toggle habit completion |

### Query Parameters

**GET /api/journal/daily-review**
- `date` (optional): ISO date string, defaults to today

**GET /api/journal/daily-review/history**
- `page` (optional): Page number, default 1
- `limit` (optional): Items per page, default 20

**GET /api/journal/daily-review/search**
- `q`: Search query

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + S` | Save draft |
| `Enter` | Next step (when focused on navigation) |
| `Escape` | Close modals |

---

## Configuration

The Daily Journal is integrated into the Command Center app (port 5173).

### Environment Variables

No additional environment variables required - uses existing Hub configuration.

### API Configuration

API requests are proxied to the Hub at `http://localhost:3000` via the Command Center's Vite configuration.

---

## Best Practices

### Consistency

- Complete your review at the same time each evening
- Make it part of your wind-down routine
- Even a brief entry is better than skipping

### Honesty

- Be honest about your mood - tracking helps identify patterns
- Note both wins and challenges
- Use the journal for genuine reflection, not performance

### Integration

- Toggle habit completions during the review
- Use the tomorrow preview to mentally prepare
- Save to vault to build a searchable history

### Time Investment

- A complete review takes 5-10 minutes
- Focus on quality reflection, not length
- The structured steps prevent overthinking

---

## Troubleshooting

### "Failed to load review data"

1. Ensure the Hub is running on port 3000
2. Check browser console for specific errors
3. Verify database connection

### Auto-save not working

1. Check network connectivity
2. Look for error messages in the interface
3. Try manual save with Cmd/Ctrl + S

### Habits not showing

1. Verify you have habits configured in the Goals & Habits system
2. Check that habits are active (not archived)
3. Ensure habits are scheduled for today's day of week

---

## Related Features

- [Goals & Habits](../goals/index.md) - Configure habits and goals
- [Vault](../vault/index.md) - Browse saved reviews
- [Ceremonies](../ceremonies/index.md) - Automated daily check-ins

---

*Last updated: January 9, 2026*
