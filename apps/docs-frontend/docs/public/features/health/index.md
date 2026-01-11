---
title: Personal Health
description: Track your fitness and wellness metrics with Whoop integration
---

# Personal Health

The Personal Health dashboard integrates with Whoop to display your recovery, strain, and sleep metrics alongside your productivity data.

## Overview

Personal Health provides:

- **Recovery Scores** - Daily readiness based on HRV, sleep, and strain
- **Sleep Metrics** - Sleep quality, duration, and consistency
- **Strain Tracking** - Daily cardiovascular strain from activities
- **Health-Aware Insights** - Correlate productivity with wellness

## Dashboard

Access the Personal Health dashboard from the Command Center sidebar. The dashboard shows:

### Recovery Score

Your daily recovery percentage (0-100%):

| Range | Status | Meaning |
|-------|--------|---------|
| 67-100% | Green | Fully recovered, ready for high strain |
| 34-66% | Yellow | Partially recovered, moderate activity |
| 0-33% | Red | Under-recovered, rest recommended |

### Sleep Performance

Key sleep metrics:

- **Sleep Duration** - Total hours of sleep
- **Sleep Efficiency** - Percentage of time in bed spent sleeping
- **REM/Deep Sleep** - Quality sleep stage distribution
- **Respiratory Rate** - Breathing patterns during sleep
- **Sleep Consistency** - Regularity of sleep schedule

### Strain Score

Daily cardiovascular load (0-21 scale):

| Range | Level | Examples |
|-------|-------|----------|
| 0-9 | Light | Normal daily activity |
| 10-13 | Moderate | Light workout, active day |
| 14-17 | High | Intense workout |
| 18-21 | Overreaching | Competition, extreme effort |

## Whoop Integration

### Setup

1. Go to **Settings** in Command Center
2. Click **Connect Whoop**
3. Authorize JD Agent to access your Whoop data
4. Data syncs automatically every 4 hours

### Data Synced

| Metric | Frequency | Description |
|--------|-----------|-------------|
| Recovery | Daily | Morning recovery score |
| Strain | Real-time | Accumulated daily strain |
| Sleep | Daily | Previous night's sleep |
| Workouts | Real-time | Tagged activities |
| HRV | Daily | Heart rate variability |

## Health in Ceremonies

Your health data appears in ceremonies:

### Morning Briefing

```
Good morning!

Recovery: 78% (Green)
- You're well-recovered. Great day for challenging tasks.
- Aim for moderate-to-high strain today.

Last Night: 7h 32m sleep
- 1h 45m REM, 1h 12m Deep
- Sleep efficiency: 92%
```

### Evening Review

```
Evening Review

Today's Strain: 14.2 (High)
- Morning run: +8.3 strain
- Active day: +5.9 strain

Tomorrow's Predicted Recovery: ~72%
Consider scheduling cognitively demanding work.
```

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/whoop/recovery` | Current recovery data |
| `GET /api/whoop/sleep` | Sleep metrics |
| `GET /api/whoop/strain` | Strain data |
| `GET /api/whoop/workouts` | Recent workouts |
| `POST /api/whoop/sync` | Trigger manual sync |

## Health-Aware Scheduling

The agent considers your health when suggesting schedules:

```
"Schedule my deep work for this week"

Agent: Based on your recovery patterns, I recommend:
- Monday: High cognitive load (predicted 82% recovery)
- Tuesday: Moderate tasks (predicted 65% recovery after Monday workout)
- Wednesday: Light work (rest day)
- Thursday: High cognitive load (predicted 78% recovery)
- Friday: Moderate tasks, wrap-up
```

## Configuration

Environment variables:

```bash
WHOOP_CLIENT_ID=your-client-id
WHOOP_CLIENT_SECRET=your-client-secret
WHOOP_REFRESH_TOKEN=your-refresh-token
```

## Privacy

- Health data is stored locally only
- No data shared with third parties
- You can disconnect Whoop at any time
- Data is deleted when you disconnect

## Troubleshooting

### Data Not Syncing

1. Check Whoop connection in Settings
2. Verify OAuth token is valid
3. Reconnect if token expired

### Missing Recovery Score

Recovery is calculated each morning after you wake up. If missing:
1. Ensure you wore your Whoop band overnight
2. Check that sleep was detected
3. Wait for Whoop to process data (can take 30 min)

### Incorrect Strain

Strain accumulates throughout the day. If incorrect:
1. Check for untagged activities in Whoop app
2. Verify band was worn properly
3. Trigger manual sync

## Best Practices

1. **Check recovery before planning** - Schedule demanding work on green days
2. **Track strain balance** - Aim for strain that matches recovery
3. **Prioritize sleep consistency** - Regular schedule improves recovery
4. **Use insights for scheduling** - Let health data inform task planning

## Next Steps

- [Connect your Whoop](/docs/getting-started/installation#whoop)
- [Configure ceremonies](/docs/features/ceremonies)
- [View your health dashboard](http://localhost:5173/personal-health)
