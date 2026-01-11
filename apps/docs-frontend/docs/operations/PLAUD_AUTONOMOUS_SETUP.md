# Plaud Pro - Autonomous Daily Pipeline

## Overview

Your Plaud Pro recordings are now fully integrated with JD Agent. This document explains how the autonomous pipeline works and how to optimize it.

## How It Works

### Automatic Flow
```
iPhone (Plaud Note) → AirDrop → Downloads → PlaudSync → JD Agent
                                    ↓
                              File Watcher detects
                                    ↓
                              Upload to R2 Storage
                                    ↓
                              Deepgram Transcription
                                    ↓
                              AI Summarization
                                    ↓
                              Vault Page Created
                                    ↓
                              Evening Digest Notification
```

### What Gets Created

For each recording, JD Agent automatically creates:
- **Vault Page** with:
  - Date, duration, and type metadata
  - AI-generated summary (2-3 paragraphs)
  - Key takeaways (bullet points)
  - Full transcript with speaker labels and timestamps
- **Tasks** extracted from action items mentioned in the recording

## Setup

### 1. Start All Services

```bash
# Option A: All-in-one startup
cd "/Users/jddavenport/Projects/JD Agent"
./start-all.sh

# Option B: Start individually
cd hub
bun run dev      # API server (includes Plaud watcher)
bun run worker   # Job processor (transcription, summarization)
bun run scheduler  # Cron jobs (30-min sync, evening digest)
```

### 2. Enable AirDrop Watcher (Optional)

Automatically moves audio files from Downloads to PlaudSync:

```bash
# Start the watcher
./scripts/plaud-airdrop-watcher.sh

# Or enable auto-start at login
launchctl load ~/Library/LaunchAgents/com.jdagent.plaud-watcher.plist
```

### 3. Daily Workflow

**Option A: AirDrop (Easiest)**
1. Open Plaud Note app on iPhone
2. Select recording(s) to sync
3. Tap Share → AirDrop → Your Mac
4. Files automatically move to PlaudSync and process

**Option B: Direct Export**
1. Export recordings from Plaud Note
2. Save directly to `~/Documents/PlaudSync/`
3. Processing starts automatically

**Option C: Fully Automatic (requires iOS Shortcut)**
See iOS Shortcut Setup below.

## iOS Shortcut Setup (For Full Automation)

Create an iOS Shortcut that automatically exports new Plaud recordings:

### Create the Shortcut

1. Open **Shortcuts** app on iPhone
2. Tap **+** to create new shortcut
3. Add these actions:

```
1. Get Latest Recording from Plaud Note
   - If Plaud has Shortcut actions, use them
   - Otherwise, use "Get File" from Plaud's document folder

2. Save File
   - Destination: iCloud Drive/PlaudSync/
   - Or: AirDrop to Mac

3. (Optional) Show Notification
   - "Recording synced to JD Agent"
```

### Automation Triggers

Set up automation to run the shortcut:
1. Go to **Shortcuts → Automation**
2. Tap **+** → **Create Personal Automation**
3. Choose trigger:
   - **Time of Day**: Run at 9 PM daily
   - **When App Closes**: After closing Plaud Note
4. Select your export shortcut
5. Disable "Ask Before Running"

## Schedule

| Time | What Happens |
|------|--------------|
| Real-time | File watcher detects new recordings |
| Every 30 min | Scheduler syncs PlaudSync folder |
| 8:55 PM | Evening digest with recordings summary |
| 9:00 PM | Evening ceremony (includes transcript links) |

## Monitoring

### Check Status
```bash
# Plaud integration status
curl http://localhost:3000/api/ingestion/plaud/status

# List recordings in sync folder
curl http://localhost:3000/api/ingestion/plaud/recordings

# Trigger manual sync
curl -X POST http://localhost:3000/api/ingestion/plaud/sync
```

### View Logs
```bash
# All logs
tail -f logs/hub.log logs/worker.log

# Just Plaud activity
grep -i plaud logs/hub.log logs/worker.log
```

### Check Processing Queue
```bash
curl http://localhost:3000/api/jobs/status
```

## Troubleshooting

### Recording Not Processing

1. Check file is in `~/Documents/PlaudSync/`
2. Check file format (MP3, M4A, WAV supported)
3. Verify worker is running: `ps aux | grep worker`
4. Check logs: `grep -i error logs/worker.log`

### Transcription Failed

1. Check Deepgram API key in `.env.development`
2. Verify audio file isn't corrupted
3. Check R2 storage is accessible
4. Review error in worker logs

### Summary Not Generated

1. Check OPENAI_API_KEY in hub/.env.development
2. Verify transcription completed first
3. Check summarization job logs

## File Locations

| Item | Location |
|------|----------|
| Sync Folder | `~/Documents/PlaudSync/` |
| Startup Script | `./start-all.sh` |
| AirDrop Watcher | `./scripts/plaud-airdrop-watcher.sh` |
| Launch Agent | `~/Library/LaunchAgents/com.jdagent.plaud-watcher.plist` |
| Logs | `./logs/` |
| Hub Config | `hub/.env.development` |

## Environment Variables

Required in `hub/.env.development`:

```bash
# Plaud Integration
PLAUD_SYNC_PATH=/Users/jddavenport/Documents/PlaudSync

# Deepgram Transcription
DEEPGRAM_API_KEY=your_key_here

# R2 Storage (for audio backup)
R2_ENDPOINT=https://xxx.r2.cloudflarestorage.com
R2_ACCESS_KEY=xxx
R2_SECRET_KEY=xxx
R2_BUCKET_NAME=jd-agent-recordings

# OpenAI (for summarization)
OPENAI_API_KEY=your_key_here
```

## Tips for Best Results

1. **Speak clearly** - Better audio = better transcription
2. **Name your recordings** - Include date/context in filename
3. **Review vault pages** - Edit speaker names for accuracy
4. **AirDrop in batches** - End of day, AirDrop all recordings at once
5. **Check evening digest** - Confirms what was processed

---

*Last Updated: January 2026*
