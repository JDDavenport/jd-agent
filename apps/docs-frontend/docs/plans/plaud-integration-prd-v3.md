# Plaud Pro Integration - Revised PRD v3.0

**Version:** 3.0
**Date:** January 8, 2026
**Owner:** JD
**Status:** Implementation Ready
**Previous Version:** 2.0 (aspirational), now refined to match codebase reality

---

## Executive Summary

This PRD revises the Plaud Pro integration plan based on a thorough code review of the existing JD Agent codebase. The original v2.0 PRD was aspirational; this version acknowledges what's already built and provides a realistic, phased implementation plan.

### Current State Assessment

| Component | Status | Location |
|-----------|--------|----------|
| File Watcher Integration | Implemented | `/hub/src/integrations/plaud.ts` |
| R2 Cloud Storage | Implemented | `/hub/src/integrations/plaud.ts` |
| Deepgram Transcription | Implemented | `/hub/src/integrations/deepgram.ts` |
| Speaker Diarization | Partial | Deepgram returns numeric IDs only |
| VIP Pipeline Structure | Scaffolded | `/hub/src/services/vip-service.ts`, `/hub/src/jobs/processors/vip.ts` |
| Database Schema | ~70% Complete | Missing: voice_profiles, speaker mapping |
| Voice Profiles | Not Started | No tables or logic |
| Voice Commands | Not Started | No detection or extraction |
| Calendar Classification | Scaffolded | Schema exists, logic placeholder |
| Vault Page Generation | Placeholder | VIP processor is stub |
| Notifications | Placeholder | VIP processor is stub |

**Overall: ~20% Complete**

---

## Part 1: Gap Analysis

### 1.1 Critical Missing Components

#### 1. Voice Profile System (NOT STARTED)
The v2.0 PRD extensively describes voice profiles and speaker recognition. **None of this exists in the codebase.**

**Missing:**
- `voice_profiles` table
- `voice_samples` table
- Speaker embedding storage
- Voice profile training workflow
- Speaker-to-name mapping

**Current Reality:** Deepgram returns numeric speaker IDs (0, 1, 2). These are stored in transcript segments but never mapped to actual people.

#### 2. Plaud Cloud API/Webhook Integration (NOT STARTED)
The v2.0 PRD assumes Plaud Cloud API with webhooks. **Only file-system watcher is implemented.**

**Missing:**
- Plaud API client
- Webhook receiver endpoint
- Cloud transcript fetching
- Auto-sync from Plaud Cloud

**Current Reality:** Users must manually sync Plaud recordings to a local folder (`PLAUD_SYNC_PATH`). No Plaud API integration exists.

#### 3. Voice Command Extraction (NOT STARTED)
The v2.0 PRD describes "Plaud, add task..." wake word detection. **No command extraction exists.**

**Missing:**
- Wake word detection ("Plaud")
- Command pattern matching
- Task/event/note creation from voice
- Speaker verification (only JD commands should execute)

#### 4. Calendar Context Classification (SCAFFOLDED BUT NOT IMPLEMENTED)
The v2.0 PRD describes rich calendar-based classification.

**What Exists:**
- `recordingSegments` table with `calendarEventId` field
- `vipService.getCalendarEventsForDate()` method
- VIP pipeline job structure

**What's Missing:**
- Actual time-overlap matching logic
- Course code detection from calendar events
- Context type assignment (class, meeting, conversation)

#### 5. Vault Page Generation (PLACEHOLDER)
**What Exists:**
- `classPages` table linking calendar events to vault pages
- VIP vault writer job (placeholder)
- Vault pages/blocks schema

**What's Missing:**
- Actual page generation logic
- Class page templates
- Conversation page templates
- Transcript formatting with speaker labels

#### 6. Notification System (PLACEHOLDER)
**What Exists:**
- VIP notification job (placeholder)
- Telegram integration elsewhere in codebase
- Email integration elsewhere in codebase

**What's Missing:**
- Daily summary generation
- Processing complete notifications
- Notification formatting for recordings

### 1.2 Components That Work

1. **File Watching** - `PlaudIntegration.startWatching()` monitors sync folder
2. **R2 Upload** - Files uploaded to Cloudflare R2 with presigned URLs
3. **Deepgram Transcription** - Full transcription with speaker diarization
4. **VIP Batch Creation** - Batches created and tracked in database
5. **Job Queue Pipeline** - BullMQ jobs chain properly (though processors are stubs)

---

## Part 2: Revised Implementation Plan

### Phase 0: Foundation Fixes (Current Sprint)
**Goal:** Get basic end-to-end pipeline working without voice profiles

#### 0.1 Fix VIP Segmentation Processor
Currently a placeholder. Need to:
- Load recordings for batch from database
- Create segments based on recording duration (simple 1:1 for now)
- Update batch progress

**File:** `/hub/src/jobs/processors/vip.ts` - `processVipSegmentationJob()`

#### 0.2 Implement Calendar Alignment
Match recording times to calendar events:
```typescript
// Pseudocode
for each segment:
  find calendar events where:
    event.startTime <= segment.startTime <= event.endTime
    OR overlap > 50%
  if match found:
    segment.calendarEventId = event.id
    segment.className = extractClassName(event.title)
    segment.segmentType = 'class' | 'meeting' | 'other'
```

**File:** `/hub/src/jobs/processors/vip.ts` - `processVipCalendarAlignmentJob()`

#### 0.3 Wire Transcription to Pipeline
Currently transcription happens separately. Need to:
- Call Deepgram from VIP transcription job
- Store transcript linked to segment
- Handle R2 presigned URLs properly

**File:** `/hub/src/jobs/processors/vip.ts` - `processVipTranscriptionJob()`

#### 0.4 Basic Vault Page Generation
Create simple class pages:
- Title: `{Class Name} - {Date}`
- Summary placeholder: "Transcript available"
- Full transcript with timestamps
- Link to audio file

**File:** `/hub/src/jobs/processors/vip.ts` - `processVipVaultWriterJob()`

#### 0.5 Basic Notifications
Send simple Telegram/email notification:
- "Daily recordings processed: X classes, Y segments, Z minutes"
- List of created vault pages

**File:** `/hub/src/jobs/processors/vip.ts` - `processVipNotificationJob()`

**Phase 0 Deliverable:** Upload MP3 → Get class page in Vault with transcript

---

### Phase 1: Voice Profile System (Next Sprint)

#### 1.1 Database Schema
Add to `/hub/src/db/schema.ts`:

```typescript
export const voiceProfiles = pgTable('voice_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  personId: uuid('person_id').references(() => people.id),
  category: text('category').notNull(), // 'self', 'family', 'teacher', 'classmate'

  // Voice characteristics (for future embedding matching)
  sampleCount: integer('sample_count').default(0),
  totalDurationSeconds: integer('total_duration_seconds').default(0),

  // Recognition settings
  isActive: boolean('is_active').default(true),
  confidenceThreshold: real('confidence_threshold').default(0.75),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const speakerMappings = pgTable('speaker_mappings', {
  id: uuid('id').primaryKey().defaultRandom(),
  transcriptId: uuid('transcript_id').references(() => transcripts.id, { onDelete: 'cascade' }),
  deepgramSpeakerId: integer('deepgram_speaker_id').notNull(), // 0, 1, 2 from Deepgram
  voiceProfileId: uuid('voice_profile_id').references(() => voiceProfiles.id),
  confidence: real('confidence'),
  manuallyAssigned: boolean('manually_assigned').default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});
```

#### 1.2 Speaker Mapping Service
Create `/hub/src/services/voice-profile-service.ts`:
- Create voice profile for person
- Manual speaker assignment (UI: "Speaker 1 = Sam")
- Future: Voice embedding matching

#### 1.3 Speaker Labeling UI
Add to Vault recording pages:
- Show transcript with "Speaker 1", "Speaker 2"
- Dropdown to assign speaker to voice profile
- Save mapping for future auto-detection

**Phase 1 Deliverable:** View transcript with speaker labels, manually assign names

---

### Phase 2: AI-Powered Extraction (Week 3)

#### 2.1 Summarization
Implement in VIP extraction job:
- Send transcript to Claude/OpenAI
- Generate class summary (key concepts, examples)
- Extract key takeaways as bullet points

**Prompt Template:**
```
Analyze this class transcript and provide:
1. SUMMARY: 2-3 paragraph overview
2. KEY CONCEPTS: Bullet points of main ideas
3. ACTION ITEMS: Any mentioned assignments, readings, exams
4. IMPORTANT QUOTES: Notable statements from professor

Class: {className}
Date: {date}
Transcript:
{transcript}
```

#### 2.2 Task Extraction
From transcript, extract actionable items:
- "Survey due Friday" → Create task with due date
- "Read chapter 5" → Create task
- "Exam next week" → Create calendar event

**File:** `/hub/src/jobs/processors/vip.ts` - `processVipExtractionJob()`

#### 2.3 Enhanced Vault Pages
Update page templates to include:
- AI summary section
- Key takeaways
- Extracted tasks (linked)
- Full transcript with speaker names

**Phase 2 Deliverable:** Class pages with AI summaries and auto-extracted tasks

---

### Phase 3: Voice Commands (Week 4)

#### 3.1 Command Detection Service
Create `/hub/src/services/voice-command-service.ts`:

```typescript
interface DetectedCommand {
  type: 'task' | 'event' | 'note' | 'highlight';
  rawText: string;
  parsedIntent: {
    action: string;
    subject: string;
    dueDate?: Date;
    priority?: number;
  };
  timestamp: number;
  speakerId: number;
  confidence: number;
}

function detectCommands(transcript: string, segments: TranscriptSegment[]): DetectedCommand[] {
  const patterns = [
    /plaud[,.]?\s*(add|create|new)\s*(task|todo)/i,
    /plaud[,.]?\s*remind\s*me\s*to/i,
    /plaud[,.]?\s*schedule/i,
    /plaud[,.]?\s*note[:]?\s*/i,
    /plaud[,.]?\s*highlight/i,
  ];
  // ... detection logic
}
```

#### 3.2 Speaker Verification
Only execute commands from JD's voice:
- Check speaker ID matches JD's voice profile
- Log but don't execute commands from other speakers
- Include verification status in notifications

#### 3.3 Command Execution
- Parse command intent with LLM
- Create task/event/note
- Link to recording timestamp
- Include in daily summary

**Phase 3 Deliverable:** "Plaud, add task call Jane" creates task in inbox

---

### Phase 4: Plaud Cloud Integration (Future)

This phase depends on Plaud API availability and documentation.

#### 4.1 Plaud API Client
If Plaud provides an API:
- Authentication flow
- Webhook receiver
- Transcript fetching
- Cloud sync status

#### 4.2 Webhook Handler
```typescript
// POST /api/webhooks/plaud
app.post('/api/webhooks/plaud', async (c) => {
  const { recording_id, transcript_url } = await c.req.json();
  // Fetch transcript from Plaud
  // Create recording and queue processing
});
```

**Note:** This phase requires Plaud API access. Currently using file-watcher as workaround.

---

## Part 3: Simplified Architecture

### 3.1 Current Data Flow (What Works)

```
Local Folder              PlaudIntegration           R2 Storage
    │                          │                          │
    └─ [sync files] ──────────►│                          │
                               │                          │
                               └─ [upload] ───────────────►
                               │
                               └─ [create recording] ─────► Database
                               │
                               └─ [queue job] ────────────► BullMQ
                                                              │
                                                              ▼
                                                        VIP Pipeline
```

### 3.2 Target Data Flow (After Phase 2)

```
Local Folder              PlaudIntegration           R2 Storage
    │                          │                          │
    └─ [sync files] ──────────►│                          │
                               │                          │
                               └─ [upload] ───────────────►
                               │
                               └─ [create recording] ─────► Database
                               │
                               └─ [queue VIP job] ────────► BullMQ
                                                              │
┌─────────────────────────────────────────────────────────────┘
│
▼
VIP Ingestion Job
    │
    └─► VIP Segmentation Job ─────┐
                                  │
    ┌─────────────────────────────┘
    │
    ▼
VIP Calendar Alignment Job
    │
    └─► [fetch calendar events] ──► Google Calendar
    │
    └─► [match segments to events]
    │
    └─► VIP Transcription Job ─────┐
                                   │
    ┌──────────────────────────────┘
    │
    ▼
VIP Transcription Job
    │
    └─► [get presigned URL] ──────► R2
    │
    └─► [transcribe] ─────────────► Deepgram
    │
    └─► VIP Extraction Job ────────┐
                                   │
    ┌──────────────────────────────┘
    │
    ▼
VIP Extraction Job
    │
    └─► [summarize transcript] ───► Claude/OpenAI
    │
    └─► [extract tasks] ──────────► Tasks DB
    │
    └─► VIP Vault Writer Job ──────┐
                                   │
    ┌──────────────────────────────┘
    │
    ▼
VIP Vault Writer Job
    │
    └─► [create vault page] ──────► Vault DB
    │
    └─► [link transcript + summary]
    │
    └─► VIP Notification Job ──────┐
                                   │
    ┌──────────────────────────────┘
    │
    ▼
VIP Notification Job
    │
    └─► [send Telegram summary] ──► Telegram Bot
    │
    └─► [send email digest] ──────► Email Service
```

---

## Part 4: Database Schema Updates

### 4.1 Required Migrations

**Migration 1: Voice Profiles**
```sql
CREATE TABLE voice_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  person_id UUID REFERENCES people(id),
  category VARCHAR(50) NOT NULL,
  sample_count INTEGER DEFAULT 0,
  total_duration_seconds INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  confidence_threshold REAL DEFAULT 0.75,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX voice_profiles_person_idx ON voice_profiles(person_id);
CREATE INDEX voice_profiles_category_idx ON voice_profiles(category);
```

**Migration 2: Speaker Mappings**
```sql
CREATE TABLE speaker_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transcript_id UUID REFERENCES transcripts(id) ON DELETE CASCADE,
  deepgram_speaker_id INTEGER NOT NULL,
  voice_profile_id UUID REFERENCES voice_profiles(id),
  confidence REAL,
  manually_assigned BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX speaker_mappings_transcript_idx ON speaker_mappings(transcript_id);
CREATE INDEX speaker_mappings_profile_idx ON speaker_mappings(voice_profile_id);
```

**Migration 3: Extracted Commands**
```sql
CREATE TABLE extracted_commands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  segment_id UUID REFERENCES recording_segments(id) ON DELETE CASCADE,
  command_type VARCHAR(50) NOT NULL,
  raw_text TEXT NOT NULL,
  parsed_intent JSONB,
  speaker_id INTEGER,
  voice_profile_id UUID REFERENCES voice_profiles(id),
  timestamp_seconds REAL,
  executed BOOLEAN DEFAULT false,
  task_id UUID REFERENCES tasks(id),
  calendar_event_id UUID REFERENCES calendar_events(id),
  vault_entry_id UUID,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX extracted_commands_segment_idx ON extracted_commands(segment_id);
CREATE INDEX extracted_commands_type_idx ON extracted_commands(command_type);
CREATE INDEX extracted_commands_executed_idx ON extracted_commands(executed);
```

---

## Part 5: API Endpoint Additions

### 5.1 Voice Profile Endpoints
Add to `/hub/src/api/routes/`:

```typescript
// Voice Profile Routes
GET    /api/voice-profiles                    // List all profiles
GET    /api/voice-profiles/:id                // Get single profile
POST   /api/voice-profiles                    // Create profile
PATCH  /api/voice-profiles/:id                // Update profile
DELETE /api/voice-profiles/:id                // Delete profile

// Speaker Mapping Routes
GET    /api/transcripts/:id/speakers          // Get speaker mappings
POST   /api/transcripts/:id/speakers          // Assign speaker to profile
PATCH  /api/speaker-mappings/:id              // Update mapping
```

### 5.2 VIP Enhanced Endpoints
```typescript
// VIP Batch Details
GET    /api/ingestion/vip/batches/:id/segments     // Get segments for batch
GET    /api/ingestion/vip/batches/:id/transcripts  // Get transcripts
GET    /api/ingestion/vip/batches/:id/tasks        // Get extracted tasks
GET    /api/ingestion/vip/batches/:id/pages        // Get created vault pages

// Reprocessing
POST   /api/ingestion/vip/batches/:id/reprocess    // Rerun from specific step
POST   /api/ingestion/vip/segments/:id/transcribe  // Transcribe single segment
```

---

## Part 6: Configuration

### 6.1 Environment Variables

**Required (Already Exist):**
```bash
# Plaud sync folder
PLAUD_SYNC_PATH=/path/to/plaud/sync

# R2 Storage
R2_ENDPOINT=https://xxx.r2.cloudflarestorage.com
R2_ACCESS_KEY=xxx
R2_SECRET_KEY=xxx
R2_BUCKET_NAME=jd-agent-recordings

# Deepgram
DEEPGRAM_API_KEY=xxx

# LLM (for summarization)
GROQ_API_KEY=xxx        # Primary (free)
GOOGLE_AI_API_KEY=xxx   # Secondary (free)
OPENAI_API_KEY=xxx      # Fallback (paid)
```

**New (To Add):**
```bash
# Voice Command Wake Word (default: "plaud")
PLAUD_WAKE_WORD=plaud

# Default speaker for JD (voice profile ID)
PLAUD_JD_VOICE_PROFILE_ID=xxx

# Notification settings
PLAUD_NOTIFY_TELEGRAM=true
PLAUD_NOTIFY_EMAIL=true
PLAUD_SUMMARY_TIME=21:00  # When to send daily summary
```

---

## Part 7: Success Metrics

### Phase 0 Success
- [ ] Upload MP3 to sync folder → Processing completes without errors
- [ ] Transcript stored in database with speaker IDs
- [ ] Class page created in Vault with transcript
- [ ] Telegram notification sent

### Phase 1 Success
- [ ] Can create voice profile for family member
- [ ] Can manually assign "Speaker 1" to "Sam" in UI
- [ ] Mapping persists and shows in transcript view

### Phase 2 Success
- [ ] Class pages have AI-generated summaries
- [ ] Tasks extracted from "Survey due Friday" mentions
- [ ] Summary quality rated 4/5+ by JD

### Phase 3 Success
- [ ] "Plaud, add task call Jane" creates task
- [ ] Commands from non-JD speakers logged but not executed
- [ ] Command accuracy >90%

---

## Part 8: Implementation Priority

### Immediate (This Week)
1. **Fix VIP Segmentation** - Make it actually create segments
2. **Fix VIP Transcription** - Wire Deepgram call
3. **Fix VIP Vault Writer** - Create basic class pages
4. **Fix VIP Notification** - Send basic Telegram message

### Short-term (Next 2 Weeks)
5. **Calendar Alignment** - Match segments to events
6. **AI Summarization** - Add to extraction job
7. **Task Extraction** - Parse deadlines from transcripts

### Medium-term (Month)
8. **Voice Profiles** - Schema + service + UI
9. **Speaker Mapping** - Manual assignment flow
10. **Voice Commands** - Wake word detection

### Long-term (Future)
11. **Plaud Cloud API** - If/when available
12. **Voice Embeddings** - Automatic speaker recognition
13. **Advanced Analytics** - Speaking time, topics, etc.

---

## Appendix A: File Locations Reference

| Component | File Path |
|-----------|-----------|
| Plaud Integration | `/hub/src/integrations/plaud.ts` |
| Deepgram Integration | `/hub/src/integrations/deepgram.ts` |
| VIP Service | `/hub/src/services/vip-service.ts` |
| VIP Job Processors | `/hub/src/jobs/processors/vip.ts` |
| Ingestion API Routes | `/hub/src/api/routes/ingestion.ts` |
| Database Schema | `/hub/src/db/schema.ts` |
| Queue Definitions | `/hub/src/jobs/queue.ts` |

---

## Appendix B: Comparison with v2.0 PRD

| Feature | v2.0 PRD | v3.0 PRD (Revised) |
|---------|----------|-------------------|
| Voice Profiles | Full voice embedding system | Start with manual mapping, embeddings later |
| Plaud API | Assumed available via Zapier | File watcher (API integration future phase) |
| Speaker Recognition | 98% accuracy target | Manual assignment first, auto later |
| Voice Commands | Full NLP wake word | Pattern matching first, then LLM |
| Timeline | Not specified | Phased over 4+ weeks |
| 24-hour Recording | Assumed | Not dependent on recording length |

---

## Appendix C: Testing Strategy

### Unit Tests
- VIP service methods
- Calendar alignment logic
- Command pattern matching

### Integration Tests
- Full pipeline: Upload → Vault page
- Deepgram API integration
- Notification delivery

### Manual Testing
- Upload sample recordings
- Verify transcript quality
- Check vault page formatting
- Confirm notification delivery

---

**END OF PRD v3.0**

*This PRD replaces v2.0 as the authoritative implementation guide. v2.0 remains valuable as a vision document for future capabilities.*
