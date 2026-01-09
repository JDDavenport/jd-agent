# Remarkable Integration

Automatically import and process handwritten notes from your Remarkable tablet.

---

## Overview

The Remarkable integration provides a seamless pipeline for getting your handwritten notes into JD Agent. It automatically:

- **Classifies notes** based on naming conventions (class notes vs general)
- **Extracts text** via OCR for searchability
- **Merges content** with Plaud recordings and typed notes
- **Organizes files** into your vault with proper folder structure

Perfect for students taking handwritten class notes who want them searchable and combined with lecture recordings.

---

## Getting Started

### Prerequisites

1. **Remarkable tablet** with notes to sync
2. **Sync tool** - Either:
   - [rmapi](https://github.com/juruen/rmapi) for automatic sync (recommended)
   - Manual export to a folder
3. **Google Cloud Vision** (optional) - For handwriting OCR

### Setup

**Step 1: Configure sync folder**

Add to your `.env` file:
```bash
REMARKABLE_SYNC_PATH=/path/to/remarkable/exports
```

**Step 2: (Optional) Enable OCR**

For handwriting recognition, set up Google Cloud Vision:
```bash
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
```

**Step 3: Start the integration**

Via API:
```bash
# Start file watcher
curl -X POST http://localhost:3000/api/ingestion/remarkable/watch/start

# Or manual sync
curl -X POST http://localhost:3000/api/ingestion/remarkable/sync
```

---

## Naming Convention

The integration uses a naming convention to automatically classify your notes.

### Class Notes Pattern

```
MBA/[Semester]/[ClassCode]/[YYYY-MM-DD]
```

**Examples:**
- `MBA/Spring2026/MGMT501/2026-01-08` → Class note for MGMT501 on Jan 8
- `MBA/Fall2025/ACCT600/2025-09-15` → Class note for ACCT600 on Sep 15
- `MBA/Winter2026/MBA560/2026-01-10` → Class note for MBA560 on Jan 10

**Semester formats:** `Spring2026`, `Fall2025`, `Summer2026`, `Winter2026`

**Class codes:** 3-4 letters + 3-4 digits (e.g., `MGMT501`, `MBA560`, `ACCT600`)

### General Notes

Any file not matching the class notes pattern goes to the **inbox**:
- `shopping-list.pdf` → General inbox
- `meeting-notes.txt` → General inbox
- `random-sketch.png` → General inbox

---

## Vault Structure

The integration creates an organized folder structure in your vault:

```
vault/
├── academic/
│   └── mba/
│       └── spring-2026/
│           ├── mgmt501/
│           │   └── days/
│           │       └── 2026-01-08/
│           │           ├── remarkable-notes.pdf    # Original handwritten
│           │           ├── remarkable-ocr.txt      # Extracted text
│           │           ├── plaud-transcript.txt    # Audio transcript
│           │           ├── typed-notes.md          # Manual notes
│           │           └── _combined.md            # Merged view
│           └── acct600/
│               └── days/
│                   └── ...
└── remarkable/
    └── inbox/
        ├── shopping-list-2026-01-08-143022.pdf
        └── meeting-sketch-2026-01-07-091555.pdf
```

---

## Content Merging

The killer feature: automatically merge all your class content into one view.

### Combined Markdown

For each class day with multiple sources, a `_combined.md` file is generated:

```markdown
# MGMT501 - 2026-01-08

*Combined notes from multiple sources*

## Typed Notes
[Your manually typed notes...]

## Audio Transcript (Plaud)
[Transcribed lecture recording...]

## Handwritten Notes (Remarkable)
[OCR-extracted text from handwritten notes...]

*[Attachment: remarkable-notes.pdf]*

---
*Generated: 2026-01-08T14:30:00Z*
```

### Triggering Merges

**Automatic:** After processing a class note, merging happens automatically.

**Manual:**
```bash
# Merge specific class day
curl -X POST http://localhost:3000/api/ingestion/remarkable/merge/MGMT501/2026-01-08

# Merge all pending
curl -X POST http://localhost:3000/api/ingestion/remarkable/merge-all
```

---

## OCR Processing

### Supported File Types

| Type | OCR Method | Confidence |
|------|------------|------------|
| `.txt` | Direct read | 100% |
| `.pdf` | pdf-parse + Vision | 85%+ |
| `.png` | Google Vision | 70-95% |
| `.svg` | Text element extraction | 80% |

### Confidence Thresholds

- **>50%**: Automatically marked as complete
- **<50%**: Flagged for manual review

### Manual OCR Correction

If OCR quality is low, you can manually correct:

```bash
curl -X PATCH http://localhost:3000/api/ingestion/remarkable/notes/{noteId}/ocr \
  -H "Content-Type: application/json" \
  -d '{"ocrText": "Corrected text here..."}'
```

---

## API Reference

### Status & Documents

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/ingestion/remarkable/status` | GET | Integration status |
| `/api/ingestion/remarkable/documents` | GET | List sync folder contents |
| `/api/ingestion/remarkable/stats` | GET | Sync statistics |

### Sync Operations

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/ingestion/remarkable/sync` | POST | Sync all documents |
| `/api/ingestion/remarkable/watch/start` | POST | Start file watcher |
| `/api/ingestion/remarkable/watch/stop` | POST | Stop file watcher |

### Class Notes

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/ingestion/remarkable/classes` | GET | List classes with note counts |
| `/api/ingestion/remarkable/notes/:classCode` | GET | Notes for a class |
| `/api/ingestion/remarkable/merge/:classCode/:date` | POST | Generate combined markdown |
| `/api/ingestion/remarkable/merge-all` | POST | Merge all pending |

### Inbox & Review

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/ingestion/remarkable/inbox` | GET | General inbox notes |
| `/api/ingestion/remarkable/review` | GET | Notes needing OCR review |

### Note Management

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/ingestion/remarkable/notes/:id/ocr` | PATCH | Update OCR text |
| `/api/ingestion/remarkable/notes/:id/reclassify` | PATCH | Change classification |
| `/api/ingestion/remarkable/notes/:id/reviewed` | POST | Mark as reviewed |
| `/api/ingestion/remarkable/notes/:id` | DELETE | Delete note |

### Background Jobs

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/ingestion/remarkable/jobs/sync` | POST | Queue background sync |
| `/api/ingestion/remarkable/jobs/merge` | POST | Queue background merge |

---

## Configuration

### Environment Variables

```bash
# Required
REMARKABLE_SYNC_PATH=/path/to/remarkable/exports

# Optional - OCR
GOOGLE_APPLICATION_CREDENTIALS=/path/to/credentials.json
OCR_CONFIDENCE_THRESHOLD=50

# Optional - Vault
VAULT_BASE_PATH=./vault

# Future - Cloud API
REMARKABLE_DEVICE_TOKEN=xxx
```

### Supported File Types

- `.pdf` - PDF documents (primary)
- `.png` - PNG images
- `.svg` - SVG vector files
- `.txt` - Plain text

---

## Workflow Tips

### For Students

1. **Name your notebooks** using the convention: `MBA/Spring2026/MGMT501`
2. **Date each page** in the filename: `2026-01-08`
3. **Sync after each class** for fresh notes
4. **Review OCR** weekly during your GTD review

### For General Use

1. Keep personal notes in default folders (they go to inbox)
2. Review inbox during weekly review
3. Reclassify important notes as needed

### Automation Setup

For fully automatic workflow:
1. Set up rmapi for automatic Remarkable cloud sync
2. Enable file watcher: `POST /api/ingestion/remarkable/watch/start`
3. Notes sync automatically when you connect your tablet

---

## Troubleshooting

### Notes Not Appearing

1. Check sync path exists: `ls $REMARKABLE_SYNC_PATH`
2. Verify integration status: `GET /api/ingestion/remarkable/status`
3. Check file types are supported (.pdf, .png, .txt, .svg)

### OCR Quality Poor

1. Ensure Google Vision is configured
2. Check confidence scores in stats
3. Consider manual corrections for critical notes

### Classification Wrong

Use reclassify endpoint:
```bash
curl -X PATCH http://localhost:3000/api/ingestion/remarkable/notes/{id}/reclassify \
  -H "Content-Type: application/json" \
  -d '{"type": "class_note", "semester": "Spring2026", "classCode": "MGMT501", "noteDate": "2026-01-08"}'
```

### Merge Not Working

1. Verify note exists: `GET /api/ingestion/remarkable/notes/CLASSNAME`
2. Check syncStatus is "complete"
3. Try manual merge: `POST /api/ingestion/remarkable/merge/CLASS/DATE`

---

## Database Tables

### remarkable_notes
Tracks each imported note with:
- Classification (class_note or general)
- OCR text and confidence
- Vault page links
- Processing status

### remarkable_sync_state
Tracks sync operations with:
- Sync timestamps
- Items processed/added/skipped/failed
- OCR statistics

---

## Related Features

- [Plaud Recording Pipeline](./plaud.md) - Audio transcription for class recordings
- [Vault](../vault/index.md) - Where notes are stored
- [Goals & Habits](../goals/index.md) - Link notes to academic goals

---

*Last updated: January 9, 2026*
