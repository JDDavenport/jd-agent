# Multi-Tenant Canvas Integration

## Overview

The Study Help app now supports multi-tenant Canvas integration, allowing any user to connect their own Canvas account.

## Architecture

### Database Schema

The schema already supports multi-tenancy:

| Table | Purpose |
|-------|---------|
| `study_help_institutions` | Schools (BYU, etc.) with Canvas URLs |
| `study_help_users` | Users with encrypted Canvas tokens |
| `study_help_sessions` | Session management |
| `study_help_user_courses` | Per-user course enrollments |
| `study_help_chat_messages` | Per-user chat history |

### Authentication Flow

1. **Registration:** User creates account, optionally selects institution
2. **Canvas Connect:** User generates a Personal Access Token in Canvas and pastes it
3. **Token Storage:** Token is encrypted with AES-256-GCM before storage
4. **Token Usage:** Decrypted on-demand for API calls

### Why Personal Access Tokens?

For a personal study app, Personal Access Tokens are ideal because:
- User has full control
- No Canvas admin approval needed
- Works immediately
- Can be revoked by user at any time

OAuth2 is better for third-party apps that need to work across institutions, but PATs are simpler for this use case.

## API Endpoints

### Authentication
- `POST /api/study-help/auth/register` - Create account
- `POST /api/study-help/auth/login` - Login
- `POST /api/study-help/auth/logout` - Logout
- `GET /api/study-help/auth/me` - Get current user
- `GET /api/study-help/auth/institutions` - List available schools
- `POST /api/study-help/auth/canvas/connect` - Connect Canvas with PAT
- `DELETE /api/study-help/auth/canvas/disconnect` - Disconnect Canvas
- `GET /api/study-help/auth/canvas/instructions` - How to get a PAT

### Courses
- `GET /api/study-help/courses` - Get user's enrolled courses
- `GET /api/study-help/courses/available` - Get available courses from Canvas
- `POST /api/study-help/courses` - Add a course
- `POST /api/study-help/courses/bulk` - Add multiple courses
- `DELETE /api/study-help/courses/:id` - Remove a course
- `POST /api/study-help/courses/sync` - Sync courses from Canvas

### Sync
- `POST /api/study-help/sync/trigger` - Trigger full sync
- `GET /api/study-help/sync/status` - Get sync status
- `POST /api/study-help/sync/all` - Admin: sync all users

### Chat
- `POST /api/study-help/chat` - Send message, get AI response
- `GET /api/study-help/chat/history/:canvasCourseId` - Get chat history
- `DELETE /api/study-help/chat/history/:canvasCourseId` - Clear history

## Setup

### 1. Add BYU Institution

```bash
cd ~/projects/JD\ Agent/hub
bun run scripts/setup-byu-institution.ts --migrate-jd
```

This creates the BYU institution and migrates JD's existing Canvas token.

### 2. Environment Variables

Required in `.env`:
```
STUDY_HELP_ENCRYPTION_KEY=<32-char-key>  # Or ENCRYPTION_KEY
ANTHROPIC_API_KEY=<key>  # For chat
```

### 3. Run Sync

```bash
# Via API (requires auth)
curl -X POST http://localhost:3000/api/study-help/sync/trigger

# Direct test
bun run scripts/test-sync.ts
```

## User Flow

1. **Register/Login** at `/api/study-help/auth/register` or `/login`
2. **Select School** - Choose BYU or enter custom Canvas URL
3. **Connect Canvas:**
   - Go to Canvas → Account → Settings → Approved Integrations
   - Create new access token named "Study Help"
   - Paste token in app
4. **Sync Courses** - Automatic on connect, or trigger manually
5. **Use Class GPT** - Chat with course materials

## Data Isolation

All data is properly scoped per user:
- ✅ Chat messages filtered by `userId`
- ✅ Courses filtered by `userId`
- ✅ Chat history filtered by `userId`
- ✅ Course enrollment filtered by `userId`

Materials (`canvas_materials`) are shared per course, which is intentional - multiple users in the same course share the same content.

## Testing

```bash
# Run sync test
bun run scripts/test-sync.ts

# Test API manually
curl -X POST http://localhost:3000/api/study-help/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"jddavenport46@gmail.com","password":"changeme123"}'
```

## Future Enhancements

1. **Scheduled Sync:** Add cron job to sync all users periodically
2. **Webhook Sync:** Canvas can POST updates when content changes
3. **Material Download:** Download PDFs/files for text extraction
4. **Multiple Institutions:** Users can connect multiple Canvas accounts
