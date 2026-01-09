# Integrations

Connect JD Agent with your existing tools.

---

## Overview

JD Agent integrates with many external services to centralize your productivity data and automate workflows.

### Active Integrations

| Service | Status | Capabilities |
|---------|--------|--------------|
| [Google Calendar](./google.md) | Active | Bidirectional event sync |
| [Gmail](./google.md) | Partial | Email ingestion, task extraction |
| [Canvas LMS](./canvas.md) | Active | Assignment tracking, integrity agent |
| [Telegram](./telegram.md) | Active | Two-way chat bot |
| [Notion](./notion.md) | Active | Page import |
| [Google Drive](./google.md) | Active | Document extraction |
| [Apple Notes](./apple-notes.md) | Active | Batch import |
| [Whoop](./whoop.md) | Active | Health metrics |
| [Todoist](./todoist.md) | Migration | Task import |
| [Remarkable](./remarkable.md) | Active | Handwriting OCR, class notes pipeline |

### Partial / In Progress

| Service | Status | Notes |
|---------|--------|-------|
| Plaud | 80% | VIP pipeline + voice profiles |
| Voyage AI | Schema ready | Semantic search wiring needed |

---

## Quick Setup Guide

### Essential Integrations

**1. Google (Calendar + Drive)**
Required for: Calendar sync, document import
[Setup Guide](./google.md)

**2. Telegram**
Required for: Chat bot, ceremony delivery
[Setup Guide](./telegram.md)

### Academic Integrations

**Canvas LMS**
Required for: Assignment tracking, class sync
[Setup Guide](./canvas.md)

### Health Integrations

**Whoop**
Optional: Recovery, strain, sleep data
[Setup Guide](./whoop.md)

---

## Integration Matrix

| Feature | Google | Telegram | Canvas | Notion | Whoop |
|---------|--------|----------|--------|--------|-------|
| Task creation | - | ✅ | ✅ | - | - |
| Calendar sync | ✅ | - | - | - | - |
| Notifications | - | ✅ | - | - | - |
| Data import | ✅ | - | ✅ | ✅ | ✅ |
| Two-way sync | ✅ | ✅ | - | - | - |

---

## Authentication

### OAuth Integrations
These require OAuth authentication flow:
- Google (Calendar, Drive, Gmail)
- Notion

### API Token Integrations
These use API tokens configured in `.env`:
- Canvas LMS
- Telegram
- Whoop
- Voyage AI

### Local Integrations
These run locally without external auth:
- Apple Notes (AppleScript)
- ReMarkable (USB/cloud sync)
- Plaud (local files)

---

## Integration Status

Check integration health:

**Via Command Center:**
Settings → Integrations shows connection status

**Via API:**
```bash
curl http://localhost:3000/api/health/full
```

**Via Agent:**
```
Is everything working?
Check system health
```

---

## Data Flow

### Import Flow
```
External Service → JD Agent Hub → Database → Apps
```

### Export Flow (where supported)
```
Apps → JD Agent Hub → External Service
```

### Sync Flow (bidirectional)
```
External Service ←→ JD Agent Hub ←→ Database
```

---

## Adding New Integrations

Integrations are located in `/hub/src/integrations/`.

To request a new integration:
1. Check the [Backlog](../../roadmap/backlog.md)
2. Add a feature request if not listed
3. Include: service name, use case, priority

---

## Troubleshooting

### Connection Failed
1. Check credentials in `.env`
2. Verify service is accessible
3. Review error logs
4. Re-authenticate if needed

### Sync Not Working
1. Check integration health in Settings
2. Verify scheduler is running
3. Try manual sync
4. Review sync logs

### Missing Data
1. Check date filters
2. Verify permissions granted
3. Review import settings
4. Check for rate limits

---

## Detailed Guides

- [Google Services](./google.md) - Calendar, Drive, Gmail setup
- [Telegram](./telegram.md) - Bot setup and usage
- [Canvas LMS](./canvas.md) - Academic integration
- [Remarkable](./remarkable.md) - Handwriting OCR and class notes
- [Whoop](./whoop.md) - Health data
- [Apple Notes](./apple-notes.md) - Import process
- [Notion](./notion.md) - Page import
- [Todoist](./todoist.md) - Migration from Todoist

---

*Last updated: January 9, 2026*
