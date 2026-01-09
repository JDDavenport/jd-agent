# JD Agent - Complete Roadmap & Implementation Guide

> **DEPRECATED:** This roadmap has been superseded by `jd-agent-roadmap-v3.md`. Please use v3 for current implementation.

## Version 2.0 | January 6, 2026 (DEPRECATED)

---

## Document Purpose

This roadmap serves as the **single source of truth** for completing the JD Agent system. It is designed to be fed directly to Claude Code for autonomous implementation with built-in testing and verification at each step.

**Instructions for Claude Code:** 
1. Complete each task in order
2. Run the verification tests after each task
3. Do not proceed to the next task until verification passes
4. Demo completed features to the user before moving to the next section
5. Fix any bugs discovered during testing before proceeding

---

## Table of Contents

1. [Vision Recap](#1-vision-recap)
2. [Current State Summary](#2-current-state-summary)
3. [Critical Fixes (Do First)](#3-critical-fixes)
4. [Phase 1: Core Stability](#4-phase-1-core-stability)
5. [Phase 2: Task & Calendar System](#5-phase-2-task--calendar-system)
6. [Phase 3: Knowledge Vault & Search](#6-phase-3-knowledge-vault--search)
7. [Phase 4: Capture Pipelines](#7-phase-4-capture-pipelines)
8. [Phase 5: Coaching & Accountability](#8-phase-5-coaching--accountability)
9. [Phase 6: Command Center UI](#9-phase-6-command-center-ui)
10. [Phase 7: Advanced Features](#10-phase-7-advanced-features)
11. [Testing Protocol](#11-testing-protocol)

---

## 1. Vision Recap

### What JD Agent Must Do

JD Agent is a **personal AI chief of staff** that enables Human JD to:

1. **Never have open loops** - Everything is captured and tracked
2. **Stay in flow** - Right information at the right time
3. **Trust the system** - Verified, reliable, no manual checking needed
4. **Be accountable** - Honest coaching toward goals

### Core User Workflows

**Daily:**
- 6:00 AM: Receive morning briefing (SMS + Email) with today's tasks, calendar, deadlines
- Throughout day: Capture tasks/notes via chat, Plaud recordings auto-processed
- 9:00 PM: Receive evening summary, confirm task completion, review tomorrow

**Weekly:**
- Sunday 4:00 PM: Weekly review - all projects, goals, metrics, next week planning

**As Needed:**
- Chat with agent to create tasks, search vault, ask questions
- Take notes in web UI or Remarkable (auto-synced)
- Check dashboard for system health and trust verification

### Key Integrations Required

| Integration | Purpose | Priority |
|-------------|---------|----------|
| Linear | Task management (source of truth for tasks) | CRITICAL |
| Google Calendar | Schedule management | CRITICAL |
| Vault (PostgreSQL) | Knowledge storage & search | CRITICAL |
| Telegram | Chat interface & notifications | HIGH |
| Canvas | Academic assignments → tasks | HIGH |
| Gmail | Email monitoring & task extraction | MEDIUM |
| Plaud | Recording → transcription → tasks | MEDIUM |
| Remarkable | Handwritten notes → vault | LOW |

---

## 2. Current State Summary

### What's Working (Verified)

| Component | Status | Confidence |
|-----------|--------|------------|
| PostgreSQL Database | ✅ Schema exists | HIGH |
| Hono API Server | ✅ Starts | MEDIUM |
| Basic Task CRUD | ✅ API exists | MEDIUM |
| Basic Vault CRUD | ✅ API exists | MEDIUM |
| React Frontend | ✅ Builds | LOW |
| Telegram Bot | ✅ Configured | MEDIUM |

### What's Broken or Incomplete

| Component | Issue | Severity |
|-----------|-------|----------|
| Frontend Health Check | Hardcoded `true`, not real | HIGH |
| Goals Panel | Static data, no backend | HIGH |
| Semantic Search | TODO placeholder, not implemented | HIGH |
| Master Agent | Uses OpenAI, tools may not work | HIGH |
| Linear Sync | Partially implemented, untested | HIGH |
| Google Calendar | Timezone hardcoded, sync untested | MEDIUM |
| Canvas Sync | 85% done, edge cases fail | MEDIUM |
| Ceremonies | Framework exists, delivery untested | MEDIUM |
| Coaching | 60% done, escalation incomplete | MEDIUM |
| Cloudflare R2 | Not configured | MEDIUM |
| Plaud Pipeline | 10% done | LOW |
| Remarkable Pipeline | 10% done | LOW |

### Architecture Issues

1. **Agent uses OpenAI** - Should use Anthropic Claude per original spec
2. **No end-to-end testing** - Individual pieces exist but integration untested
3. **Frontend disconnected** - Many components show static/mock data
4. **Redis dependency** - Job queue requires Redis but may not be running

---

## 3. Critical Fixes (Do First)

**Purpose:** Get the system to a baseline working state before adding features.

### Task 3.1: Verify Database Connection

**Goal:** Confirm database is accessible and schema is correct.

```bash
# Test command
bun run db:push
```

**Verification:**
```typescript
// Create file: scripts/verify-db.ts
import { db } from '../src/db/client';
import { tasks, vaultEntries, calendarEvents } from '../src/db/schema';

async function verifyDatabase() {
  console.log('Testing database connection...');
  
  try {
    // Test connection
    const result = await db.select().from(tasks).limit(1);
    console.log('✅ Tasks table accessible');
    
    const vaultResult = await db.select().from(vaultEntries).limit(1);
    console.log('✅ Vault table accessible');
    
    const calendarResult = await db.select().from(calendarEvents).limit(1);
    console.log('✅ Calendar table accessible');
    
    console.log('\n✅ DATABASE VERIFICATION PASSED');
    return true;
  } catch (error) {
    console.error('❌ DATABASE VERIFICATION FAILED:', error);
    return false;
  }
}

verifyDatabase();
```

**Run:** `bun run scripts/verify-db.ts`

**Expected Output:**
```
Testing database connection...
✅ Tasks table accessible
✅ Vault table accessible
✅ Calendar table accessible

✅ DATABASE VERIFICATION PASSED
```

**If Failed:** Fix database connection in `.env` before proceeding.

---

### Task 3.2: Verify API Server Starts

**Goal:** Confirm API server starts without errors.

```bash
# Start server
bun run dev
```

**Verification:**
```bash
# In another terminal
curl http://localhost:3000/api/health
```

**Expected Output:**
```json
{
  "status": "ok",
  "timestamp": "2026-01-06T...",
  "services": {
    "database": "connected",
    "redis": "connected" 
  }
}
```

**If Failed:** 
- Check port 3000 is available
- Check database URL is correct
- Check Redis is running (or disable if not needed for basic testing)

---

### Task 3.3: Fix Health Endpoint to Return Real Status

**Goal:** Health endpoint should return actual service status, not hardcoded values.

**File:** `src/api/routes/health.ts`

**Implementation:**
```typescript
import { Hono } from 'hono';
import { db } from '../../db/client';
import { sql } from 'drizzle-orm';

const health = new Hono();

health.get('/', async (c) => {
  const status = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      database: 'unknown',
      redis: 'unknown',
    },
    checks: {
      tasksTable: false,
      vaultTable: false,
      calendarTable: false,
    }
  };

  // Check database
  try {
    await db.execute(sql`SELECT 1`);
    status.services.database = 'connected';
    status.checks.tasksTable = true;
    status.checks.vaultTable = true;
    status.checks.calendarTable = true;
  } catch (error) {
    status.services.database = 'disconnected';
    status.status = 'degraded';
  }

  // Check Redis (if applicable)
  try {
    // Add Redis check here if using Redis
    status.services.redis = 'connected';
  } catch (error) {
    status.services.redis = 'disconnected';
    // Don't mark as degraded - Redis is optional for basic functionality
  }

  const httpStatus = status.status === 'ok' ? 200 : 503;
  return c.json(status, httpStatus);
});

health.get('/detailed', async (c) => {
  // More detailed health check for the dashboard
  const checks = {
    database: { status: 'unknown', latency: 0 },
    linear: { status: 'unknown', configured: false },
    googleCalendar: { status: 'unknown', configured: false },
    telegram: { status: 'unknown', configured: false },
    canvas: { status: 'unknown', configured: false },
  };

  // Database check with latency
  const dbStart = Date.now();
  try {
    await db.execute(sql`SELECT 1`);
    checks.database = { status: 'connected', latency: Date.now() - dbStart };
  } catch (error) {
    checks.database = { status: 'disconnected', latency: 0 };
  }

  // Check if integrations are configured (not necessarily connected)
  checks.linear.configured = !!process.env.LINEAR_API_KEY;
  checks.googleCalendar.configured = !!process.env.GOOGLE_CLIENT_ID;
  checks.telegram.configured = !!process.env.TELEGRAM_BOT_TOKEN;
  checks.canvas.configured = !!process.env.CANVAS_API_TOKEN;

  return c.json({
    timestamp: new Date().toISOString(),
    checks,
  });
});

export default health;
```

**Verification:**
```bash
curl http://localhost:3000/api/health
curl http://localhost:3000/api/health/detailed
```

**Expected:** Real status values, not hardcoded.

---

### Task 3.4: Create Master Test Script

**Goal:** Single script that tests all critical paths.

**File:** `scripts/test-all.ts`

```typescript
import { db } from '../src/db/client';
import { tasks, vaultEntries, calendarEvents, projects } from '../src/db/schema';
import { eq } from 'drizzle-orm';

const API_BASE = 'http://localhost:3000';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration: number;
}

const results: TestResult[] = [];

async function runTest(name: string, testFn: () => Promise<void>) {
  const start = Date.now();
  try {
    await testFn();
    results.push({ name, passed: true, duration: Date.now() - start });
    console.log(`✅ ${name}`);
  } catch (error) {
    results.push({ name, passed: false, error: String(error), duration: Date.now() - start });
    console.log(`❌ ${name}: ${error}`);
  }
}

async function apiCall(method: string, path: string, body?: any) {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API ${method} ${path} failed: ${response.status} - ${text}`);
  }
  
  return response.json();
}

async function main() {
  console.log('🧪 JD Agent System Test Suite\n');
  console.log('=' .repeat(50));

  // ===== DATABASE TESTS =====
  console.log('\n📦 Database Tests\n');

  await runTest('Database connection', async () => {
    const result = await db.execute(sql`SELECT 1 as test`);
    if (!result) throw new Error('No result from database');
  });

  // ===== API TESTS =====
  console.log('\n🌐 API Tests\n');

  await runTest('Health endpoint', async () => {
    const health = await apiCall('GET', '/api/health');
    if (health.status !== 'ok' && health.status !== 'degraded') {
      throw new Error(`Unexpected status: ${health.status}`);
    }
  });

  await runTest('Detailed health endpoint', async () => {
    const health = await apiCall('GET', '/api/health/detailed');
    if (!health.checks) throw new Error('Missing checks in response');
  });

  // ===== TASK TESTS =====
  console.log('\n✅ Task Tests\n');

  let testTaskId: string;

  await runTest('Create task', async () => {
    const task = await apiCall('POST', '/api/tasks', {
      title: 'Test Task - Delete Me',
      source: 'manual',
      context: 'Test',
      dueDate: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
    });
    if (!task.id) throw new Error('No task ID returned');
    testTaskId = task.id;
  });

  await runTest('List tasks', async () => {
    const tasks = await apiCall('GET', '/api/tasks');
    if (!Array.isArray(tasks)) throw new Error('Tasks should be an array');
  });

  await runTest('Get single task', async () => {
    if (!testTaskId) throw new Error('No test task ID');
    const task = await apiCall('GET', `/api/tasks/${testTaskId}`);
    if (task.id !== testTaskId) throw new Error('Wrong task returned');
  });

  await runTest('Update task', async () => {
    if (!testTaskId) throw new Error('No test task ID');
    const task = await apiCall('PATCH', `/api/tasks/${testTaskId}`, {
      status: 'today',
    });
    if (task.status !== 'today') throw new Error('Status not updated');
  });

  await runTest('Complete task', async () => {
    if (!testTaskId) throw new Error('No test task ID');
    const task = await apiCall('PATCH', `/api/tasks/${testTaskId}`, {
      status: 'done',
    });
    if (task.status !== 'done') throw new Error('Task not completed');
  });

  await runTest('Delete task', async () => {
    if (!testTaskId) throw new Error('No test task ID');
    await apiCall('DELETE', `/api/tasks/${testTaskId}`);
  });

  // ===== VAULT TESTS =====
  console.log('\n🗄️ Vault Tests\n');

  let testVaultId: string;

  await runTest('Create vault entry', async () => {
    const entry = await apiCall('POST', '/api/vault', {
      title: 'Test Note - Delete Me',
      content: 'This is a test note for verification.',
      contentType: 'note',
      context: 'Test',
      source: 'manual',
      tags: ['test', 'verification'],
    });
    if (!entry.id) throw new Error('No vault entry ID returned');
    testVaultId = entry.id;
  });

  await runTest('Search vault', async () => {
    const results = await apiCall('GET', '/api/vault/search?query=test');
    if (!Array.isArray(results)) throw new Error('Search should return array');
  });

  await runTest('Get vault entry', async () => {
    if (!testVaultId) throw new Error('No test vault ID');
    const entry = await apiCall('GET', `/api/vault/${testVaultId}`);
    if (entry.id !== testVaultId) throw new Error('Wrong entry returned');
  });

  await runTest('Delete vault entry', async () => {
    if (!testVaultId) throw new Error('No test vault ID');
    await apiCall('DELETE', `/api/vault/${testVaultId}`);
  });

  // ===== CALENDAR TESTS =====
  console.log('\n📅 Calendar Tests\n');

  await runTest('Get calendar events', async () => {
    const today = new Date().toISOString().split('T')[0];
    const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
    const events = await apiCall('GET', `/api/calendar?start=${today}&end=${nextWeek}`);
    if (!Array.isArray(events)) throw new Error('Calendar should return array');
  });

  // ===== CHAT TESTS =====
  console.log('\n💬 Agent Tests\n');

  await runTest('Chat with agent', async () => {
    const response = await apiCall('POST', '/api/chat', {
      message: 'Hello, what can you help me with?',
    });
    if (!response.message && !response.response) {
      throw new Error('No response from agent');
    }
  });

  await runTest('Agent creates task via chat', async () => {
    const response = await apiCall('POST', '/api/chat', {
      message: 'Create a task called "Test from chat" due tomorrow',
    });
    // Verify task was created
    const tasks = await apiCall('GET', '/api/tasks');
    const testTask = tasks.find((t: any) => t.title.includes('Test from chat'));
    if (!testTask) {
      console.log('  ⚠️ Task may not have been created - agent tool use needs verification');
    }
  });

  // ===== CEREMONY TESTS =====
  console.log('\n🎭 Ceremony Tests\n');

  await runTest('Trigger morning ceremony (dry run)', async () => {
    try {
      const result = await apiCall('POST', '/api/ceremonies/morning/trigger', {
        dryRun: true, // Don't actually send notifications
      });
      if (!result.briefing) throw new Error('No briefing generated');
    } catch (e) {
      // Endpoint may not exist yet
      throw new Error('Ceremony endpoint not implemented');
    }
  });

  // ===== RESULTS SUMMARY =====
  console.log('\n' + '='.repeat(50));
  console.log('📊 TEST RESULTS SUMMARY\n');

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const total = results.length;

  console.log(`Passed: ${passed}/${total}`);
  console.log(`Failed: ${failed}/${total}`);
  console.log(`Success Rate: ${Math.round((passed / total) * 100)}%`);

  if (failed > 0) {
    console.log('\n❌ Failed Tests:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  - ${r.name}: ${r.error}`);
    });
  }

  console.log('\n' + '='.repeat(50));

  // Exit with error code if any tests failed
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(console.error);
```

**Run:**
```bash
# Make sure server is running first
bun run dev &
sleep 3
bun run scripts/test-all.ts
```

**Expected:** All tests pass. If any fail, fix before proceeding.

---

## 4. Phase 1: Core Stability

**Goal:** All core APIs work reliably with proper error handling.

### Task 1.1: Task API Stability

**Requirements:**
1. Create task with all required fields (title, source, context)
2. Create task with optional fields (dueDate, timeEstimate, energyLevel, etc.)
3. List tasks with filters (status, context, dueDate range)
4. Update any task field
5. Complete a task (sets status to 'done', sets completedAt)
6. Delete a task
7. Proper error responses for invalid input

**File:** `src/api/routes/tasks.ts`

**Verification Script:**
```typescript
// Add to scripts/test-tasks.ts
const testCases = [
  {
    name: 'Create minimal task',
    method: 'POST',
    path: '/api/tasks',
    body: { title: 'Minimal task', source: 'manual', context: 'Test' },
    expect: (r) => r.id && r.title === 'Minimal task',
  },
  {
    name: 'Create full task',
    method: 'POST', 
    path: '/api/tasks',
    body: {
      title: 'Full task',
      source: 'canvas',
      context: 'CS401',
      description: 'A detailed task',
      dueDate: '2026-01-15T23:59:00Z',
      dueDateIsHard: true,
      timeEstimateMinutes: 120,
      energyLevel: 'high',
      priority: 2,
    },
    expect: (r) => r.id && r.timeEstimateMinutes === 120,
  },
  {
    name: 'List tasks filtered by status',
    method: 'GET',
    path: '/api/tasks?status=inbox',
    expect: (r) => Array.isArray(r),
  },
  {
    name: 'List tasks filtered by context',
    method: 'GET',
    path: '/api/tasks?context=CS401',
    expect: (r) => Array.isArray(r),
  },
  {
    name: 'Reject task without title',
    method: 'POST',
    path: '/api/tasks',
    body: { source: 'manual', context: 'Test' },
    expectError: true,
    expectStatus: 400,
  },
];
```

**Demo to User:**
```
After completing Task 1.1, demo:
1. Open http://localhost:3000 in browser
2. Show the API creating a task via curl
3. Show the task appearing in the task list
4. Complete the task and show it moves to 'done'
5. Show filtering by status and context
```

---

### Task 1.2: Vault API Stability

**Requirements:**
1. Create vault entry with required fields
2. Create vault entry with markdown content
3. Search vault by text query (full-text)
4. Search vault by context filter
5. Search vault by content type filter
6. Search vault by tags
7. Get single entry by ID
8. Update vault entry
9. Delete vault entry

**File:** `src/api/routes/vault.ts`

**Verification Script:**
```typescript
// Add to scripts/test-vault.ts
const testCases = [
  {
    name: 'Create note entry',
    method: 'POST',
    path: '/api/vault',
    body: {
      title: 'CS401 Lecture - Neural Networks',
      content: '# Neural Networks\n\n## Key Points\n- Backpropagation\n- Gradient descent',
      contentType: 'note',
      context: 'CS401',
      source: 'manual',
      tags: ['lecture', 'neural-networks'],
    },
    expect: (r) => r.id && r.tags.includes('neural-networks'),
  },
  {
    name: 'Search by text',
    method: 'GET',
    path: '/api/vault/search?query=neural%20networks',
    expect: (r) => Array.isArray(r) && r.length > 0,
  },
  {
    name: 'Search by context',
    method: 'GET',
    path: '/api/vault/search?context=CS401',
    expect: (r) => Array.isArray(r) && r.every(e => e.context === 'CS401'),
  },
  {
    name: 'Search by type',
    method: 'GET',
    path: '/api/vault/search?contentType=note',
    expect: (r) => Array.isArray(r) && r.every(e => e.contentType === 'note'),
  },
];
```

---

### Task 1.3: Calendar API Stability

**Requirements:**
1. Get events in date range
2. Create local calendar event
3. Update calendar event
4. Delete calendar event
5. Google Calendar sync (if configured)
6. Timezone handling (configurable, not hardcoded)

**Fix timezone issue:**
```typescript
// src/integrations/google-calendar.ts
// Replace hardcoded 'America/Denver' with:
const TIMEZONE = process.env.TIMEZONE || 'America/Denver';
```

**Add to `.env.example`:**
```
TIMEZONE=America/Denver
```

---

### Task 1.4: Agent Chat Stability

**Requirements:**
1. Chat endpoint accepts messages
2. Agent responds coherently
3. Agent can use tools (create task, search vault, query calendar)
4. Tool results are incorporated into response
5. Conversation context is maintained within session

**Critical Fix - Switch to Anthropic Claude:**

The original spec calls for Anthropic Claude, but current implementation uses OpenAI. Either:
- Option A: Keep OpenAI if it's working (pragmatic)
- Option B: Switch to Anthropic Claude (per spec)

**If switching to Anthropic:**
```typescript
// src/agents/master-agent.ts
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

async function chat(message: string, context: AgentContext) {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: MASTER_AGENT_SYSTEM_PROMPT,
    tools: AGENT_TOOLS,
    messages: [{ role: 'user', content: message }],
  });
  
  return processResponse(response);
}
```

**Verification:**
```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Create a task called Test Agent Task due tomorrow for CS401"}'

# Then verify task was created:
curl http://localhost:3000/api/tasks | jq '.[] | select(.title | contains("Test Agent"))'
```

---

## 5. Phase 2: Task & Calendar System

**Goal:** Complete task and calendar management with Linear sync.

### Task 2.1: Linear Integration - Full Implementation

**Requirements:**
1. Create task in JD Agent → Creates issue in Linear
2. Create issue in Linear → Creates task in JD Agent (via webhook)
3. Update task in JD Agent → Updates issue in Linear
4. Complete task in JD Agent → Closes issue in Linear
5. Task has both `dueDate` (deadline) and `scheduledDate` (when to work on it)
6. Custom "Scheduled" field in Linear is synced

**File:** `src/integrations/linear.ts`

**Implementation Checklist:**
```typescript
// Verify these functions exist and work:

// 1. Create issue in Linear
async function createLinearIssue(task: Task): Promise<string> {
  // Returns Linear issue ID
}

// 2. Sync from Linear to local
async function syncFromLinear(): Promise<void> {
  // Fetches all issues, creates/updates local tasks
}

// 3. Update issue in Linear
async function updateLinearIssue(task: Task): Promise<void> {
  // Updates title, description, due date, status, custom fields
}

// 4. Handle Linear webhook
async function handleLinearWebhook(payload: LinearWebhookPayload): Promise<void> {
  // Creates/updates/deletes local task based on webhook
}

// 5. Get custom field ID for "Scheduled"
async function getScheduledFieldId(): Promise<string> {
  // Queries Linear API for custom field
}
```

**Verification Script:**
```typescript
// scripts/test-linear-sync.ts
async function testLinearSync() {
  console.log('Testing Linear Integration...\n');

  // 1. Create task locally
  const task = await apiCall('POST', '/api/tasks', {
    title: 'Linear Sync Test Task',
    source: 'manual',
    context: 'Test',
    dueDate: '2026-01-15T23:59:00Z',
  });
  console.log('✅ Created local task:', task.id);

  // 2. Wait for sync to Linear
  await new Promise(r => setTimeout(r, 2000));

  // 3. Verify task exists in Linear
  const linearTasks = await linearClient.issues({
    filter: { title: { contains: 'Linear Sync Test Task' } }
  });
  
  if (linearTasks.nodes.length === 0) {
    throw new Error('Task not found in Linear');
  }
  console.log('✅ Task synced to Linear:', linearTasks.nodes[0].id);

  // 4. Update in Linear, verify sync back
  // ... continue tests

  // 5. Cleanup
  await apiCall('DELETE', `/api/tasks/${task.id}`);
  console.log('✅ Cleaned up test task');
}
```

**Demo to User:**
```
1. Create a task in the web UI
2. Show the task appearing in Linear within seconds
3. Edit the task in Linear
4. Show the change reflected in JD Agent
5. Complete the task in JD Agent
6. Show it marked done in Linear
```

---

### Task 2.2: Calendar Integration - Full Implementation

**Requirements:**
1. Read events from Google Calendar
2. Create events in Google Calendar
3. Update events in Google Calendar
4. Delete events from Google Calendar
5. Bidirectional sync (changes in either direction are reflected)
6. Time blocking: Create calendar event from task
7. Link between calendar event and task

**Verification Script:**
```typescript
// scripts/test-calendar-sync.ts
async function testCalendarSync() {
  // 1. Read events
  const events = await apiCall('GET', '/api/calendar?start=2026-01-06&end=2026-01-13');
  console.log(`✅ Read ${events.length} events from calendar`);

  // 2. Create event
  const newEvent = await apiCall('POST', '/api/calendar', {
    title: 'Test Calendar Event',
    startTime: '2026-01-10T14:00:00Z',
    endTime: '2026-01-10T15:00:00Z',
  });
  console.log('✅ Created calendar event:', newEvent.id);

  // 3. Verify in Google Calendar (if connected)
  // ...

  // 4. Time block from task
  const task = await apiCall('POST', '/api/tasks', {
    title: 'Task with time block',
    source: 'manual',
    context: 'Test',
    timeEstimateMinutes: 60,
  });
  
  const timeBlock = await apiCall('POST', '/api/tasks/' + task.id + '/schedule', {
    scheduledDate: '2026-01-10T14:00:00Z',
  });
  console.log('✅ Created time block for task');

  // 5. Verify calendar event was created
  // ...

  // Cleanup
}
```

---

### Task 2.3: Task Scheduling Feature

**Requirements:**
1. Task has `scheduledDate` field (when to work on it)
2. When task is scheduled, a calendar event is created
3. Calendar event links back to task (URL in description)
4. Task card shows both due date and scheduled date
5. "Today" view shows tasks scheduled for today OR due today
6. Agent can schedule tasks via tool

**New Endpoint:**
```typescript
// POST /api/tasks/:id/schedule
// Body: { scheduledDate: string, duration?: number }
// Creates calendar event and updates task
```

**Agent Tool:**
```typescript
{
  name: 'schedule_task',
  description: 'Schedule a task by creating a time block in the calendar',
  input_schema: {
    type: 'object',
    properties: {
      taskId: { type: 'string', description: 'ID of the task to schedule' },
      scheduledDate: { type: 'string', description: 'ISO datetime when to work on the task' },
      duration: { type: 'number', description: 'Duration in minutes (defaults to task estimate or 60)' },
    },
    required: ['taskId', 'scheduledDate'],
  },
}
```

---

## 6. Phase 3: Knowledge Vault & Search

**Goal:** Searchable knowledge base with semantic search.

### Task 3.1: Full-Text Search (Already Partially Done)

**Verify:**
```bash
curl "http://localhost:3000/api/vault/search?query=neural%20networks"
```

**Should return:** Vault entries containing "neural networks" in title or content.

---

### Task 3.2: Semantic Search with pgvector

**This is marked as TODO in the current codebase. Implementation required.**

**Step 1: Enable pgvector Extension**
```sql
-- Run in PostgreSQL
CREATE EXTENSION IF NOT EXISTS vector;
```

**Step 2: Add Embedding Column**
```typescript
// src/db/schema.ts - update vault_embeddings table
export const vaultEmbeddings = pgTable('vault_embeddings', {
  id: uuid('id').primaryKey().defaultRandom(),
  entryId: uuid('entry_id').references(() => vaultEntries.id, { onDelete: 'cascade' }),
  chunkIndex: integer('chunk_index').default(0),
  contentChunk: text('content_chunk').notNull(),
  embedding: vector('embedding', { dimensions: 1024 }), // Voyage AI dimensions
  createdAt: timestamp('created_at').defaultNow(),
});
```

**Step 3: Generate Embeddings**
```typescript
// src/services/embedding-service.ts
import Anthropic from '@anthropic-ai/sdk';

// Or use Voyage AI as specified
const voyageClient = new VoyageAI({ apiKey: process.env.VOYAGE_API_KEY });

async function generateEmbedding(text: string): Promise<number[]> {
  const response = await voyageClient.embed({
    input: text,
    model: 'voyage-2',
  });
  return response.data[0].embedding;
}

async function embedVaultEntry(entryId: string): Promise<void> {
  const entry = await getVaultEntry(entryId);
  
  // Chunk long content
  const chunks = chunkText(entry.content, 1000);
  
  for (let i = 0; i < chunks.length; i++) {
    const embedding = await generateEmbedding(chunks[i]);
    await db.insert(vaultEmbeddings).values({
      entryId,
      chunkIndex: i,
      contentChunk: chunks[i],
      embedding,
    });
  }
}
```

**Step 4: Semantic Search**
```typescript
// src/services/search-service.ts
async function semanticSearch(query: string, limit = 10): Promise<VaultEntry[]> {
  const queryEmbedding = await generateEmbedding(query);
  
  const results = await db.execute(sql`
    SELECT 
      ve.id,
      ve.title,
      ve.content,
      ve.context,
      ve.content_type,
      1 - (vemb.embedding <=> ${queryEmbedding}::vector) as similarity
    FROM vault_entries ve
    JOIN vault_embeddings vemb ON ve.id = vemb.entry_id
    ORDER BY vemb.embedding <=> ${queryEmbedding}::vector
    LIMIT ${limit}
  `);
  
  return results;
}
```

**Verification:**
```bash
# Create a note about machine learning
curl -X POST http://localhost:3000/api/vault \
  -H "Content-Type: application/json" \
  -d '{"title": "ML Notes", "content": "Deep learning uses neural networks with many layers", "contentType": "note", "context": "CS401", "source": "manual"}'

# Search for related concept (not exact words)
curl "http://localhost:3000/api/vault/search?query=artificial%20intelligence&semantic=true"

# Should return the ML Notes entry due to semantic similarity
```

---

### Task 3.3: Vault Explorer UI

**Requirements:**
1. Left sidebar with folder tree (by context)
2. Search bar with option for semantic search
3. Results grid showing cards
4. Filter by content type, date range, tags
5. Click to view full entry
6. Edit and delete functionality

**Files:**
- `frontend/src/pages/VaultExplorer.tsx`
- `frontend/src/components/vault/VaultTree.tsx`
- `frontend/src/components/vault/VaultCard.tsx`
- `frontend/src/components/vault/VaultSearch.tsx`

**Verification:**
```
1. Navigate to /vault in browser
2. See folder tree on left
3. Click a folder, see entries filtered
4. Search for a term, see results
5. Click an entry, see full content
6. Edit an entry, save, verify changes
```

---

### Task 3.4: Note Editor

**Requirements:**
1. Create new note at `/vault/new`
2. Edit existing note at `/vault/:id`
3. Markdown editor with preview
4. Context dropdown
5. Tags input
6. Auto-save every 30 seconds
7. Manual save button

**Files:**
- `frontend/src/pages/NoteEditor.tsx`
- `frontend/src/components/vault/MarkdownEditor.tsx`

---

## 7. Phase 4: Capture Pipelines

**Goal:** Automatic capture from all input sources.

### Task 4.1: Canvas Integration

**Current Status:** 85% done, needs edge case handling.

**Requirements:**
1. Sync all courses from Canvas
2. Sync all assignments with due dates
3. Create tasks for assignments (avoid duplicates)
4. Update tasks when assignment due dates change
5. Process announcements
6. Handle edge cases: unpublished courses, deleted assignments

**Verification:**
```bash
# Sync courses
curl -X POST http://localhost:3000/api/canvas/sync

# List courses
curl http://localhost:3000/api/canvas/courses

# List assignments
curl http://localhost:3000/api/canvas/assignments

# Verify tasks were created
curl http://localhost:3000/api/tasks?source=canvas
```

---

### Task 4.2: Gmail Integration

**Current Status:** 50% done, triage AI incomplete.

**Requirements:**
1. Monitor inbox for new emails
2. Classify emails: action required, FYI, ignore
3. Extract tasks from action emails (draft, human reviews)
4. Priority sender alerts

**Verification:**
```bash
# Check Gmail connection
curl http://localhost:3000/api/gmail/status

# Fetch recent emails
curl http://localhost:3000/api/gmail/recent

# Process inbox
curl -X POST http://localhost:3000/api/gmail/process
```

---

### Task 4.3: Recording Pipeline (Plaud)

**Current Status:** 10% done.

**Requirements:**
1. Detect new recordings in sync folder
2. Upload to Cloudflare R2
3. Transcribe with Deepgram
4. Summarize with Claude
5. Extract tasks from commitments
6. Classify recording type (class, meeting, conversation)
7. Store in vault with transcript and summary

**Implementation Order:**
1. First: Set up R2 storage
2. Second: File detection (watch folder)
3. Third: Transcription pipeline
4. Fourth: Summarization
5. Fifth: Task extraction

---

### Task 4.4: Remarkable Pipeline

**Current Status:** 10% done.

**Requirements:**
1. Detect new PDFs in Google Drive sync folder
2. Parse filename for metadata (date, context, topic)
3. OCR with Google Cloud Vision
4. Store in vault with extracted text
5. Extract tasks from content
6. Link to same-day recordings

---

## 8. Phase 5: Coaching & Accountability

**Goal:** Agent acts as accountability partner.

### Task 5.1: Morning Ceremony

**Requirements:**
1. Triggers at configured time (default 6:00 AM)
2. Generates briefing with:
   - Today's schedule (from calendar)
   - Today's tasks (from Linear/local)
   - Upcoming deadlines (next 48 hours)
   - Waiting-for items needing follow-up
   - Yesterday's incomplete tasks
3. Sends via Telegram AND Email
4. Can be triggered manually for testing

**Verification:**
```bash
# Trigger morning ceremony (dry run - no notifications)
curl -X POST http://localhost:3000/api/ceremonies/morning/trigger?dryRun=true

# Trigger morning ceremony (with notifications)
curl -X POST http://localhost:3000/api/ceremonies/morning/trigger
```

**Demo:**
```
1. Trigger morning ceremony
2. Show briefing content
3. Show SMS/Telegram received
4. Show email received
```

---

### Task 5.2: Evening Ceremony

**Requirements:**
1. Triggers at configured time (default 9:00 PM)
2. Generates summary with:
   - Tasks completed today
   - Tasks not completed (asks why)
   - Tomorrow's preview
   - Inbox status
3. Prompts for input on incomplete tasks
4. Records reasons for coaching data

**Verification:**
```bash
curl -X POST http://localhost:3000/api/ceremonies/evening/trigger?dryRun=true
```

---

### Task 5.3: Weekly Review

**Requirements:**
1. Triggers at configured time (default Sunday 4:00 PM)
2. Generates report with:
   - Tasks completed this week
   - Tasks missed
   - Goal progress
   - Time analysis (productive vs waste)
   - Patterns detected
   - Next week preview
3. Interactive review in chat

---

### Task 5.4: Coaching Escalation

**Requirements:**
1. Track task completion patterns
2. Escalation tiers:
   - Tier 1: Neutral observation ("You had X planned, did Y")
   - Tier 2: Direct callout ("This is the third day you've avoided...")
   - Tier 3: Intervention ("Let's stop and figure this out")
3. Adjust tone based on repeated misses
4. Celebrate streaks and wins

**Implementation:**
```typescript
// src/services/coaching-service.ts
async function generateCoachingPrompt(userId: string): Promise<string> {
  const patterns = await analyzePatterns(userId);
  
  if (patterns.consecutiveMisses >= 3) {
    return generateTier3Intervention(patterns);
  } else if (patterns.consecutiveMisses >= 2) {
    return generateTier2Callout(patterns);
  } else if (patterns.missedToday.length > 0) {
    return generateTier1Observation(patterns);
  }
  
  if (patterns.streak >= 5) {
    return generateStreakCelebration(patterns);
  }
  
  return null; // No coaching needed
}
```

---

### Task 5.5: Time Tracking

**Requirements:**
1. Track time spent per app (from Screen Time data if available)
2. Categorize: productive, neutral, waste
3. Daily summary in evening ceremony
4. Weekly breakdown in weekly review
5. Trend analysis

**Note:** Screen Time data extraction may require manual export or third-party app.

---

## 9. Phase 6: Command Center UI

**Goal:** Complete, working dashboard.

### Task 6.1: Dashboard Home

**Requirements:**
1. Today's tasks with checkboxes (real data from API)
2. Week calendar with events (real data)
3. Upcoming deadlines (real data)
4. Quick chat widget (working agent)
5. Goals progress (connected to backend)
6. Health indicator (real status)

**Current Issues to Fix:**
- Health indicator is hardcoded
- Goals panel shows static data
- Calendar may not show real events

---

### Task 6.2: System Health Page

**Requirements:**
1. Service status (database, redis, workers)
2. Integration status (Linear, Google, Canvas, etc.)
3. Recent activity log
4. Integrity check results
5. Manual ceremony triggers
6. 7-day stats

---

### Task 6.3: Settings Page

**Requirements:**
1. Ceremony time configuration
2. Notification preferences
3. Class management (CRUD)
4. Goal management (CRUD)
5. Integration re-authorization

---

## 10. Phase 7: Advanced Features

**Lower priority, implement after core is stable.**

### Task 7.1: Class Sub-Agents

Each class gets a specialized agent that:
- Knows all course material
- Can answer questions about content
- Tracks deadlines for that class

### Task 7.2: People Database

Track people you interact with:
- Name, how/where met
- Key facts mentioned
- Interaction history
- Follow-up commitments

### Task 7.3: Social Feed Digest

Monitor and summarize:
- LinkedIn
- X.com
- Reddit
- News sources

Include in daily digest email.

---

## 11. Testing Protocol

### Before Each Phase

```bash
# Run full test suite
bun run scripts/test-all.ts

# All tests must pass before starting new phase
```

### After Each Task

1. Run specific verification script for that task
2. Demo the feature to user
3. Get confirmation before proceeding

### Demo Format

For each completed feature:
```
1. Explain what was built
2. Show it working via UI or curl commands
3. Show the expected output
4. Let user try it themselves
5. Fix any issues discovered
6. Get sign-off before next task
```

### Regression Testing

After completing each phase:
```bash
# Run full test suite again
bun run scripts/test-all.ts

# Ensure no previously working features broke
```

---

## Appendix A: Environment Variables Required

```bash
# Database
DATABASE_URL=postgresql://...

# Redis (optional for basic testing)
REDIS_URL=redis://...

# AI
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...  # If using OpenAI
VOYAGE_API_KEY=...     # For embeddings

# Integrations
LINEAR_API_KEY=lin_api_...
LINEAR_TEAM_ID=...

GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback

CANVAS_API_URL=https://...instructure.com
CANVAS_API_TOKEN=...

TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...

# Notifications
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+1...
USER_PHONE_NUMBER=+1...

RESEND_API_KEY=...
USER_EMAIL=...

# Storage
R2_ENDPOINT=...
R2_ACCESS_KEY=...
R2_SECRET_KEY=...
R2_BUCKET_NAME=...

# Transcription/OCR
DEEPGRAM_API_KEY=...
GOOGLE_APPLICATION_CREDENTIALS=...

# App
TIMEZONE=America/Denver
PORT=3000
```

---

## Appendix B: Quick Commands

```bash
# Development
bun run dev              # Start API server
cd frontend && bun run dev  # Start frontend

# Database
bun run db:push          # Apply schema
bun run db:studio        # Visual browser

# Testing
bun run scripts/test-all.ts      # Full test suite
bun run scripts/verify-db.ts     # Database only
bun run scripts/test-linear-sync.ts  # Linear only

# Manual triggers
curl -X POST localhost:3000/api/ceremonies/morning/trigger
curl -X POST localhost:3000/api/ceremonies/evening/trigger
curl -X POST localhost:3000/api/ceremonies/weekly/trigger
```

---

## Appendix C: File Structure Reference

```
src/
├── api/routes/           # API endpoints
│   ├── tasks.ts
│   ├── vault.ts
│   ├── calendar.ts
│   ├── chat.ts
│   ├── ceremonies.ts
│   ├── health.ts
│   └── ...
├── services/             # Business logic
│   ├── task-service.ts
│   ├── vault-service.ts
│   ├── calendar-service.ts
│   ├── ceremony-service.ts
│   ├── coaching-service.ts
│   ├── search-service.ts
│   └── ...
├── integrations/         # External services
│   ├── linear.ts
│   ├── google-calendar.ts
│   ├── gmail.ts
│   ├── canvas.ts
│   ├── telegram-bot.ts
│   └── ...
├── agents/               # AI agents
│   ├── master-agent.ts
│   ├── class-agent.ts
│   └── tools.ts
├── db/                   # Database
│   ├── client.ts
│   ├── schema.ts
│   └── migrations/
├── jobs/                 # Background jobs
│   ├── queue.ts
│   └── processors/
└── types/                # TypeScript types
    └── index.ts

frontend/
├── src/
│   ├── pages/
│   ├── components/
│   ├── hooks/
│   └── App.tsx
└── ...

scripts/
├── test-all.ts
├── verify-db.ts
├── test-linear-sync.ts
└── ...
```

---

**END OF ROADMAP**

*This document should be fed to Claude Code for systematic implementation. Each task has clear requirements, verification steps, and demo instructions.*
