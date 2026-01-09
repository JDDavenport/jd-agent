# JD Agent - Backlog

## Critical - From AI Testing (2026-01-07)

### Dashboard Page - Broken API Validation - FIXED
- [x] **BUG**: Tasks API `dueBefore` parameter expects ISO datetime but receives date-only string
  - Fixed: Added `dateStringToDate` helper to accept both date and datetime strings
- [x] **BUG**: Calendar API `startDate`/`endDate` parameters have same issue
  - Fixed: Added `dateStringToDate` helper to accept both date and datetime strings
- [x] **BUG**: Stats cards not showing on Dashboard
  - Fixed: Rewrote `analyticsService.getDashboard()` to return correct data structure

### System Health Page - Fixed
- [x] **BUG**: TypeError calling `.map()` on undefined `services`/`integrations`
  - Fixed: Added optional chaining in SystemHealth.tsx
  - Fixed: Updated `/api/system/info` to return arrays

### Pages Still Showing 400 Errors (not wired correctly) - FIXED
- [x] **Dashboard**: Fixed date validation - now accepts yyyy-MM-dd format
- [x] **System Health**: Fixed - now returns services/integrations as arrays
- [x] **Analytics Health**: Added missing `/api/analytics/health` endpoint

### Testing Agent Improvements
- [x] Add rate limit retry logic with exponential backoff (5s, 10s, 20s)
- [ ] Switch to gpt-4o-mini for less token usage (or use Anthropic)
- [ ] Add delay between iterations to respect rate limits

## High Priority

### Testing Agent - Add Anthropic API Key Support
- [ ] Configure ANTHROPIC_API_KEY in environment
- [ ] Or add option to use OpenAI for testing agent vision

### Whoop Integration Enhancements
- [ ] Complete OAuth flow for Whoop authentication
- [ ] Add database table for storing Whoop tokens (access_token, refresh_token, expires_at)
- [ ] Create scheduled job to sync Whoop data daily
- [ ] Store recovery, sleep, and workout data in database
- [ ] Integrate recovery score with task energy recommendations
- [ ] Add Whoop data to morning briefing/daily summary
- [ ] Create API endpoints for Whoop data retrieval
- [ ] Add Whoop status to setup wizard verification

### Task System
- [ ] Two-way sync with Linear
- [ ] Smart task prioritization based on energy levels
- [ ] Recurring task support
- [ ] Task batching by context/energy

## Medium Priority

### Calendar Integration
- [ ] Calendar-aware task scheduling
- [ ] Meeting prep automation
- [ ] Buffer time management

### Vault Enhancements
- [ ] Full-text search with embeddings
- [ ] Smart note linking
- [ ] Auto-tagging based on content

### Agent Improvements
- [ ] Context-aware responses based on time of day
- [ ] Proactive task suggestions
- [ ] Weekly review automation

## Low Priority

### UI/UX
- [ ] Mobile-responsive command center
- [ ] Dark mode support
- [ ] Keyboard shortcuts

### Integrations
- [ ] Apple Health data sync
- [ ] Spotify/focus music integration
- [ ] Weather-based suggestions

---

## Completed

### AI-Powered Testing Agent
- [x] Create TestingAgent class with Claude Vision integration
- [x] Implement PlaywrightBridge for browser automation
- [x] Implement ScreenshotAnalyzer for UI analysis
- [x] Define 18 testing tools (navigation, vision, verification, API, control)
- [x] Implement ReportGenerator (HTML, JSON, Markdown)
- [x] Create API endpoints (/api/testing/run, /api/testing/smoke, /api/testing/status)
- [x] Create CLI runner script (bun run test:ai)

---

## Changelog

### 2026-01-07
- Implemented AI-powered testing agent with Claude Vision
- Created backlog file
- Added Whoop integration to environment configuration
