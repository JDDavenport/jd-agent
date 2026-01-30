# Weekly Planning - Bug Report

**Date:** January 26, 2026
**Tested by:** Automated E2E Tests (Playwright)
**Test File:** `/apps/command-center/e2e/weekly-planning/user-experience.spec.ts`

## Summary

| Status | Count |
|--------|-------|
| Tests Passed | 39 |
| Tests Failed | 2 |
| Tests Skipped | 1 |
| Bugs Found | 6 |

---

## Critical Bugs

### BUG-001: Time Calculation is Incorrect When Scheduling Tasks

**Severity:** CRITICAL
**Status:** Confirmed (reproducible 3/3 times)

**Description:**
When dragging a task from the backlog to the calendar grid, the scheduled time is calculated incorrectly. The task is scheduled at a time that does not match the drop position.

**Steps to Reproduce:**
1. Navigate to Weekly Planning page
2. Ensure there is a task in the backlog
3. Drag the task to approximately 9:00 AM on the calendar
4. Observe the API call

**Expected Behavior:**
Task should be scheduled around 9:00 AM (hour 9)

**Actual Behavior:**
Task is scheduled at 9:45 PM (hour 21) - completely wrong time

**Evidence:**
- Test logs: `Scheduled start time: 2026-01-26T04:45:00.000Z` (which is 9:45 PM in local time)
- `Scheduled hour: 21` instead of expected 8-10

**Root Cause Analysis:**
The time calculation in `handleDragEnd` uses `event.activatorEvent` and `event.delta` to calculate the final position, but the math appears to be incorrect. The calculation:
```javascript
const finalY = activatorY + deltaY;
const relativeY = finalY - overRect.top;
```
This doesn't properly account for:
1. The scroll position of the calendar
2. The sticky header height
3. The relationship between the drop zone coordinates and actual content

**Impact:** Users cannot reliably schedule tasks at specific times. This breaks the core functionality of the weekly planning feature.

---

### BUG-002: Hover Preview Does Not Appear When Dragging Tasks

**Severity:** HIGH
**Status:** Confirmed

**Description:**
When dragging a task from backlog over the calendar, the emerald/green hover preview that should show where the task will land does NOT appear.

**Steps to Reproduce:**
1. Navigate to Weekly Planning page
2. Start dragging a task from backlog
3. Move it over the calendar grid
4. Observe - no preview appears

**Expected Behavior:**
An emerald/green preview block should appear at the target position showing:
- Task title
- Scheduled time

**Actual Behavior:**
No preview appears. Only the drag overlay (the task being dragged) is visible.

**Evidence:**
- Screenshot `ux-07-drag-hover-preview.png` shows drag overlay but no preview in calendar
- Test log: `Hover preview visible: false`

**Root Cause Analysis:**
The `useDndMonitor.onDragMove` handler calculates hover preview position, but the calculation for determining which column the pointer is over appears to fail. The checks for `isInTasksColumn` may be evaluating incorrectly.

**Impact:** Users have no visual feedback about where their task will be scheduled, making it a guessing game.

---

## High Priority Bugs

### BUG-003: Rescheduling Scheduled Tasks Does Not Work

**Severity:** HIGH
**Status:** Confirmed

**Description:**
Dragging a scheduled task (already on the calendar) to a new time slot does NOT trigger a reschedule. The task stays at its original position.

**Steps to Reproduce:**
1. Navigate to Weekly Planning page
2. Find a scheduled task on the calendar
3. Drag it to a different time (e.g., 2 hours later)
4. Release

**Expected Behavior:**
Task should be rescheduled to the new time, API should be called

**Actual Behavior:**
- No API call is made
- Task remains at original position
- No visual feedback during drag

**Evidence:**
- Test log: `Schedule API called for reschedule: false`
- Screenshots `ux-11-before-reschedule.png` and `ux-12-after-reschedule.png` are identical

**Root Cause Analysis:**
The drag and drop for scheduled tasks uses ID prefix `scheduled-{taskId}`. The `handleDragEnd` logic may not be properly detecting when the scheduled task is dropped over a valid time slot, or the droppable zones are not being detected correctly.

**Impact:** Users cannot reschedule tasks by dragging, forcing them to unschedule and re-schedule manually.

---

### BUG-004: Event Creation Drag Does Not Show Selection Highlight

**Severity:** MEDIUM
**Status:** Confirmed

**Description:**
When click-dragging on the Events column to create a new event, no selection highlight (indigo colored) appears during the drag.

**Steps to Reproduce:**
1. Navigate to Weekly Planning page
2. Click and drag on the Events column (left side of a day)
3. Observe during drag

**Expected Behavior:**
An indigo-colored selection highlight should appear showing the time range being selected

**Actual Behavior:**
No visual feedback during drag. Popup still appears on release.

**Evidence:**
- Screenshot `ux-15-event-drag-selection.png` shows no selection
- Test log: `Selection highlight visible: false`

**Impact:** Users don't get visual feedback when creating events, though the popup does appear correctly.

---

## Medium Priority Bugs

### BUG-005: Context Menu May Be Cut Off Near Screen Edge

**Severity:** MEDIUM
**Status:** Observed

**Description:**
When right-clicking a task near the bottom of the screen, the context menu may extend beyond the viewport.

**Evidence:**
- Screenshot `ux-13-context-menu.png` shows partial menu visibility issue

**Recommendation:**
Add position detection to flip the menu upward when near the bottom edge.

---

### BUG-006: Cross-Day Rescheduling Does Not Work

**Severity:** MEDIUM
**Status:** Confirmed

**Description:**
Dragging a scheduled task from one day to another (e.g., Monday to Tuesday) does not reschedule the task.

**Steps to Reproduce:**
1. Find a scheduled task on a specific day
2. Drag it horizontally to the next day
3. Release

**Expected Behavior:**
Task moves to the new day at the same time

**Actual Behavior:**
No API call made, task stays on original day

**Evidence:**
- Test log: `Schedule API called for cross-day reschedule: false`

---

## Non-Issues (Test Limitations)

### Rapid Clicking Test Failure

**Status:** NOT A BUG

The test that checked rapid clicking on "Add task" button failed because clicking the button opens an input field, hiding the button. This is CORRECT behavior - the test was poorly designed.

---

## Test Coverage Summary

| Feature | Status | Notes |
|---------|--------|-------|
| Page Load | PASS | All elements render correctly |
| Backlog Panel | PASS | Tasks display, quick-add works |
| Calendar Grid | PASS | 7 days, time labels, current time indicator |
| Scheduling (Backlog -> Calendar) | PARTIAL | API works but time calculation is WRONG |
| Hover Preview | FAIL | Not appearing |
| Rescheduling | FAIL | Not working |
| Unscheduling | PASS | Context menu and Back to Backlog work |
| Event Creation | PARTIAL | Popup works but no selection preview |
| Task Completion | PASS | Checkbox and API work |
| Week Navigation | PASS | Next/prev, disable on current week |
| Task Detail Modal | PASS | Double-click opens modal |
| Long Titles | PASS | Truncation works |
| Scrolling | PASS | Calendar scrolls properly |
| Accessibility | PARTIAL | Some ARIA labels present |

---

## Recommendations

### Immediate Fixes Needed

1. **Fix time calculation in `handleDragEnd`** - The relativeY calculation needs to account for:
   - Scroll container scroll position
   - Sticky header offset (80px)
   - Correct mapping from pixel position to time slot

2. **Fix hover preview positioning** - The `useDndMonitor.onDragMove` handler needs:
   - Better column detection
   - Correct scroll position handling
   - Verification that `isInTasksColumn` check is working

3. **Fix scheduled task rescheduling** - Ensure:
   - Droppable zones detect `scheduled-*` IDs
   - The drop handler processes reschedule correctly

### Code Areas to Review

1. `/apps/command-center/src/pages/WeeklyPlanning.tsx`:
   - Lines 173-216: `handleDragEnd` time calculation
   - Lines 186-192: Time slot calculation from Y position

2. `/apps/command-center/src/components/weekly-planning/PlanningCalendar.tsx`:
   - Lines 635-735: `useDndMonitor.onDragMove` hover preview logic
   - Lines 661-680: Column detection and position calculation

---

## Screenshots

All screenshots are saved in `/apps/command-center/screenshots/ux-*.png`:
- `ux-01` through `ux-06`: Page load and backlog
- `ux-07` through `ux-10`: Drag and drop scheduling
- `ux-11` through `ux-12`: Rescheduling
- `ux-13` through `ux-14`: Context menu / unscheduling
- `ux-15` through `ux-18`: Event creation
- `ux-21` through `ux-28`: Navigation and edge cases
