# JD Agent - Claude Code Implementation Prompt

> **UPDATED:** Use `jd-agent-roadmap-v3.md` - the current roadmap.

## Your Mission

You are implementing the JD Agent system based on the comprehensive roadmap in `jd-agent-roadmap-v3.md`. Read that file completely before starting.

## Critical Rules

1. **Test everything** - After each task, run the verification script. Do not proceed if tests fail.
2. **Fix before moving on** - If something breaks, fix it immediately. No skipping.
3. **Demo to user** - After completing each section, provide a demo with exact commands the user can run to verify.
4. **Be thorough** - Check edge cases. Handle errors gracefully. Log useful information.
5. **Ask if stuck** - If you hit a blocker you can't resolve, ask the user rather than guessing.

## Implementation Order

Follow this exact order:

### Step 1: Critical Fixes (Must Do First)

1. Run the database verification script. If it doesn't exist, create it per the roadmap.
2. Start the server and verify the health endpoint works.
3. Fix the health endpoint to return REAL status (not hardcoded).
4. Create the master test script (`scripts/test-all.ts`).
5. Run the test script. Document what passes and what fails.

**Checkpoint:** Show me the test results. Tell me exactly what's working and what's broken.

### Step 2: Core API Stability

For each API (Tasks, Vault, Calendar, Chat):
1. Review the current implementation
2. Add missing functionality per roadmap requirements
3. Add proper error handling
4. Create/update verification tests
5. Run tests and fix failures

**Checkpoint:** Run full test suite. All core API tests must pass.

### Step 3: Linear Integration

1. Verify Linear API connection
2. Implement bidirectional sync (create, update, complete, delete)
3. Add webhook handling
4. Test with real Linear account
5. Demo: Create task in app → appears in Linear → edit in Linear → syncs back

**Checkpoint:** Show me the Linear sync working end-to-end.

### Step 4: Calendar Integration

1. Verify Google Calendar connection
2. Fix timezone handling
3. Implement task scheduling (creates calendar events)
4. Test bidirectional sync
5. Demo: Create task with schedule → calendar event appears

**Checkpoint:** Show me calendar sync working.

### Step 5: Semantic Search

1. Enable pgvector extension
2. Add embedding generation
3. Implement semantic search in vault
4. Test with sample data
5. Demo: Search for related concepts (not exact words)

**Checkpoint:** Show me semantic search finding related content.

### Step 6: Ceremonies

1. Fix morning ceremony generation
2. Fix evening ceremony generation
3. Connect to notification services (Telegram, SMS, Email)
4. Test each ceremony
5. Demo: Trigger each ceremony, show notification received

**Checkpoint:** Show me receiving a morning briefing on my phone.

### Step 7: Frontend Fixes

1. Connect health indicator to real endpoint
2. Connect Goals panel to backend
3. Fix any broken components
4. Verify all pages load without errors
5. Demo: Walk through each page showing real data

**Checkpoint:** Show me the dashboard with real, live data.

### Step 8: Coaching System

1. Implement pattern detection
2. Implement escalation tiers
3. Add streak tracking
4. Connect to ceremonies
5. Demo: Show coaching message based on task completion patterns

**Checkpoint:** Show me the coaching system responding to my behavior.

## Verification After Each Step

```bash
# Run after every step
bun run scripts/test-all.ts
```

All tests must pass before proceeding to next step.

## Demo Format

After each checkpoint, provide:

```markdown
## Checkpoint X Complete

### What Was Built
- Feature 1: Description
- Feature 2: Description

### Test Results
- Total tests: X
- Passed: X
- Failed: X

### Demo Commands

To verify this yourself, run:

1. [Command 1]
   Expected output: [description]

2. [Command 2]
   Expected output: [description]

### Screenshots/Output
[Paste actual output from your testing]

### Ready for Next Step?
Confirm you've tested the above and it works before I proceed.
```

## If Something Breaks

1. Stop immediately
2. Identify the root cause
3. Fix it
4. Re-run tests
5. Verify the fix didn't break anything else
6. Only then continue

## Environment Setup

Before starting, verify:

```bash
# Check environment variables are set
echo $DATABASE_URL
echo $LINEAR_API_KEY
echo $GOOGLE_CLIENT_ID
echo $TELEGRAM_BOT_TOKEN

# Check services are running
curl http://localhost:3000/api/health
```

If any are missing, ask the user to provide them.

## Start Now

1. Read `jd-agent-roadmap-v2.md` completely
2. Run the existing code to see current state
3. Begin with Step 1: Critical Fixes
4. Report back with Checkpoint 1 results

Go.
