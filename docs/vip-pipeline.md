# Vault Ingestion Pipeline (VIP)

The Vault Ingestion Pipeline (VIP) processes audio recordings from PLAUD devices, extracts insights using AI, and creates structured vault entries in the JD Agent knowledge management system.

## Overview

VIP transforms raw audio files into organized knowledge with the following steps:

1. **Ingestion**: Upload MP3/WAV files and create processing batches
2. **Segmentation**: Split recordings into logical segments (classes, conversations)
3. **Calendar Alignment**: Match segments to Google Calendar events
4. **Transcription**: Convert speech to text using Deepgram
5. **Extraction**: Use AI to identify summaries, action items, and key points
6. **Vault Creation**: Generate day pages, class pages, and task entries
7. **Notification**: Send digests via Telegram and email

## Architecture

### Database Schema

VIP adds several new tables to track the processing pipeline:

- `recording_batches`: Batch-level status and progress tracking
- `recording_segments`: Audio segments within recordings
- `extracted_items`: AI-extracted tasks, summaries, and insights
- `class_pages`: Links between calendar events and vault pages

### Job Queue

VIP uses BullMQ for background processing with these job types:

- `vip-ingestion`: Initial file processing and batch setup
- `vip-segmentation`: Audio segmentation logic
- `vip-calendar-alignment`: Match segments to calendar events
- `vip-transcription`: Deepgram transcription
- `vip-extraction`: AI-powered content extraction
- `vip-vault-writer`: Create vault pages and entries
- `vip-notification`: Send completion digests

## API Endpoints

### File Upload

```http
POST /api/ingestion/vip/upload
Content-Type: multipart/form-data

files[]: Audio files (MP3/WAV)
batchDate: YYYY-MM-DD (optional, defaults to today)
context: Optional context string
```

### Batch Management

```http
GET /api/ingestion/vip/status
GET /api/ingestion/vip/batches
GET /api/ingestion/vip/batches/:id
POST /api/ingestion/vip/batches/:id/resume
```

## Configuration

### Environment Variables

```bash
# Storage (Cloudflare R2)
R2_ENDPOINT=https://xxx.r2.cloudflarestorage.com
R2_ACCESS_KEY=your_access_key
R2_SECRET_KEY=your_secret_key
R2_BUCKET_NAME=your_bucket

# AI Services
DEEPGRAM_API_KEY=your_deepgram_key
ANTHROPIC_API_KEY=your_claude_key

# Notifications
TELEGRAM_TOKEN=your_telegram_token
TELEGRAM_CHAT_ID=your_chat_id
RESEND_API_KEY=your_resend_key
USER_EMAIL=your@email.com
```

### Google Calendar Integration

VIP requires Google Calendar access to align recordings with class schedules:

```bash
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REFRESH_TOKEN=your_refresh_token
GOOGLE_CALENDAR_ID=primary
```

## Usage

### Starting a Batch

1. Export recordings from PLAUD app
2. Upload via API or web interface:

```bash
curl -X POST http://localhost:3000/api/ingestion/vip/upload \
  -F "files[]=@recording1.mp3" \
  -F "files[]=@recording2.wav" \
  -F "batchDate=2024-01-15"
```

### Monitoring Progress

Check batch status:

```bash
curl http://localhost:3000/api/ingestion/vip/batches/YOUR_BATCH_ID
```

### Resuming Failed Batches

If processing fails, resume from the last successful step:

```bash
curl -X POST http://localhost:3000/api/ingestion/vip/batches/YOUR_BATCH_ID/resume
```

## Output Structure

VIP creates the following vault structure:

```
/vault/days/2024-01-15
├── Class: MBA Finance (Recording transcript + summary)
/vault/classes/mba-finance/
├── 2024-01-15: Class Notes
└── 2024-01-15: Key Takeaways
```

## Testing

Run the VIP test suite:

```bash
# Run VIP-specific tests
bun run scripts/test-vip.ts

# Run full integration test suite
bun run test
```

## Development

### Adding New Job Types

1. Add job type to `JobType` union in `jobs/queue.ts`
2. Create job data interface
3. Add scheduling function (`addVipXxxJob`)
4. Implement processor in `jobs/processors/vip.ts`
5. Add case to worker switch statement
6. Update job list in worker startup

### Extending AI Extraction

The extraction job can be enhanced to detect:

- Specific topics discussed
- Action items with deadlines
- People mentioned and relationships
- Survey questions or assignments
- Follow-up commitments

### Storage Optimization

VIP currently stores full audio files. Future optimizations:

- Compress audio before storage
- Implement retention policies (90 days)
- Add audio format conversion
- Implement resumable uploads

## Troubleshooting

### Common Issues

**Storage not configured**: Set R2 environment variables for file storage.

**Calendar access denied**: Verify Google OAuth tokens and calendar permissions.

**AI service failures**: Check API keys and rate limits for Deepgram/Claude.

**Job queue stuck**: Check Redis connectivity and restart worker process.

### Logs

VIP logs are prefixed with `[VIP]`. Check worker logs for processing details:

```bash
tail -f /var/log/jd-agent/worker.log | grep "\[VIP\]"
```

## Future Enhancements

- **Speaker Diarization**: Identify and label different speakers
- **Real-time Processing**: Process recordings as they're uploaded
- **Advanced Segmentation**: ML-based topic segmentation
- **Multi-language Support**: Detect and handle multiple languages
- **Integration APIs**: Webhooks for external recording services