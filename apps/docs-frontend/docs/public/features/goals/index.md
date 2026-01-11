# Goals & Habits Tracking

Track your goals across all life areas, build habits, and monitor your progress.

---

## Overview

The Goals & Habits system helps you set meaningful goals organized by life areas, break them into milestones, build supporting habits, and reflect on your journey. It integrates with Tasks, Vault, and Ceremonies to keep you focused and accountable.

---

## Life Areas

Every goal and habit belongs to one of six life areas:

| Area | Icon | Description |
|------|------|-------------|
| **Spiritual** | :pray: | Faith, meditation, purpose, values |
| **Personal** | :brain: | Self-improvement, hobbies, learning |
| **Fitness** | :muscle: | Physical health, exercise, nutrition |
| **Family** | :family: | Relationships, parenting, community |
| **Professional** | :briefcase: | Career, business, income |
| **School** | :mortar_board: | Education, certifications, academic |

---

## Goals

### Creating a Goal

1. Set a clear **title** that describes your desired outcome
2. Choose a **life area** for organization
3. Select a **goal type**:
   - **Achievement**: One-time accomplishment (e.g., "Run a marathon")
   - **Maintenance**: Ongoing standard (e.g., "Maintain 10% body fat")
   - **Growth**: Continuous improvement (e.g., "Increase savings rate")
4. Add your **motivation** - why this matters to you
5. Set a **target date** (optional)

### Goal Health Score

Each goal has a health score (0-100) based on:
- **Progress** vs expected timeline
- **Active habits** linked to the goal
- **Milestone completion** rate
- **Recent activity** (reflections, updates)

Goals with low health scores appear in your "Needs Attention" list.

### Goal Status

Goals flow through these statuses:
- `active` - Currently pursuing
- `paused` - Temporarily on hold
- `completed` - Successfully achieved
- `abandoned` - No longer pursuing

---

## Milestones

Milestones are checkpoints within a goal that mark significant progress.

### Creating Milestones

1. Add milestones in order of completion
2. Set target dates for each
3. Add descriptions for clarity

### Completing Milestones

When you complete a milestone:
1. Mark it complete
2. Add **evidence** of completion (optional)
3. Goal progress auto-updates based on completed milestones

### Milestone Status

- `pending` - Not started
- `in_progress` - Currently working on
- `completed` - Done
- `skipped` - Decided to skip

---

## Habits

Habits are recurring actions that support your goals.

### Creating a Habit

1. Set a clear **title**
2. Choose **frequency**:
   - Daily
   - Weekly
   - Specific days (Mon, Wed, Fri)
3. Select preferred **time of day** (morning, afternoon, evening)
4. Link to a **goal** (optional)
5. Assign a **life area**

### Streaks

The system tracks your current streak and longest streak ever.

**Streak Protection**: You get a 2-day grace period. If you miss one day, your streak is preserved as long as you complete the habit the next day.

### Completing Habits

When completing a habit, you can optionally add:
- **Quality rating** (1-5 stars)
- **Duration** in minutes
- **Notes** about the session

---

## Reflections

Journal entries attached to your goals.

### Reflection Types

| Type | Icon | Use For |
|------|------|---------|
| **Progress** | :chart_with_upwards_trend: | Regular updates on how things are going |
| **Obstacle** | :construction: | Challenges and blockers you're facing |
| **Win** | :trophy: | Celebrating achievements and milestones |
| **Adjustment** | :arrows_counterclockwise: | Changes to your approach or strategy |

### Creating Reflections

1. Select the goal
2. Choose the reflection type
3. Write your thoughts
4. System auto-detects sentiment

---

## Progress Dashboard

### Overview

The dashboard shows:
- **Today's habits** completion percentage
- **Overall goal** progress
- **Goals needing attention** (low health scores)
- **Top streaks** to maintain
- **Upcoming milestones** this week

### Life Area View

See progress broken down by life area:
- Average goal progress per area
- Active goals count
- Habit completion rate
- Recent reflections

### Weekly Reports

Every week you get a summary of:
- Habits completed vs target
- Goals that improved or declined
- Streaks protected or broken
- Key wins and obstacles

---

## Task Integration

### Auto-Generated Tasks

The system automatically creates tasks for:
- **Upcoming milestones** (7 days ahead)
- **Stale goals** (no activity in 7 days)
- **Habit protection** (streaks at risk)

### Manual Task Linking

Link any task to a goal or habit to:
- Track contributions toward goals
- See task history in goal view
- Include tasks in progress calculations

---

## Vault Integration

### Exporting to Vault

Export your goal journey to the vault for documentation:
- Complete journey export (goal + milestones + reflections)
- Individual reflection export
- Goal notes creation

### Auto-Archive

When you complete a goal, it can auto-export to the vault with your full journey documented.

---

## Ceremony Integration

Goals and habits data appears in your ceremonies:

### Morning Ceremony
- Goals needing attention
- Today's habits
- Upcoming milestones

### Evening Ceremony
- Top streaks to protect
- Recent wins
- Reflection prompts

### Weekly Review
- Life area progress
- Weekly highlights
- Improvement opportunities

---

## API Reference

### Goals API
```
GET    /api/goals                    # List with filters
GET    /api/goals/by-life-area       # Stats by life area
GET    /api/goals/needs-attention    # Low health score goals
GET    /api/goals/:id                # Get goal with relations
POST   /api/goals                    # Create goal
PATCH  /api/goals/:id                # Update goal
POST   /api/goals/:id/complete       # Mark completed
POST   /api/goals/:id/pause          # Pause goal
POST   /api/goals/:id/resume         # Resume goal
POST   /api/goals/:id/abandon        # Abandon goal
```

### Milestones API
```
GET    /api/milestones?goalId=       # List by goal
GET    /api/milestones/upcoming      # Upcoming milestones
GET    /api/milestones/overdue       # Overdue milestones
POST   /api/milestones               # Create milestone
POST   /api/milestones/:id/complete  # Complete milestone
POST   /api/milestones/:id/start     # Start milestone
```

### Habits API
```
GET    /api/habits                   # List habits
GET    /api/habits/:id/streak        # Get streak info
POST   /api/habits                   # Create habit
POST   /api/habits/:id/complete      # Log completion
```

### Progress API
```
GET    /api/progress/overview        # Full dashboard
GET    /api/progress/weekly          # Weekly report
GET    /api/progress/area/:area      # Life area detail
GET    /api/progress/streaks         # Top streaks
```

### Reflections API
```
GET    /api/reflections?goalId=      # List by goal
GET    /api/reflections/recent       # Recent reflections
GET    /api/reflections/wins         # Win reflections
POST   /api/reflections/:goalId      # Create reflection
```

---

## Tips

1. **Start with one goal per life area** - Don't overwhelm yourself
2. **Link habits to goals** - Habits drive progress toward goals
3. **Reflect weekly** - Regular reflections keep you connected to your why
4. **Trust the health score** - If it's low, the goal needs attention
5. **Use milestones** - They make big goals feel achievable
6. **Protect your streaks** - The 2-day grace period is your friend

---

*Last updated: January 8, 2026*
