# Tasks App - Manual Testing Guide

**App URL:** http://localhost:5180
**Last Updated:** 2026-01-23

## Pre-Test Setup
- Ensure backend Hub API is running on http://localhost:3000
- Ensure Tasks app is running on http://localhost:5180
- Open the app in Chrome/Chromium browser

---

## Test Suite 1: Basic Navigation & UI

### Test 1.1: App Loads Successfully
**Steps:**
1. Navigate to http://localhost:5180
2. Verify page loads without errors

**Expected:**
- App displays without JavaScript errors in console
- Header shows "Today" or "Inbox" title
- Sidebar is visible with navigation items
- Date is displayed in header (for Today view)

**Status:** [ ] PASS [ ] FAIL

---

### Test 1.2: Sidebar Navigation
**Steps:**
1. Click "Inbox" in sidebar
2. Verify header changes to "Inbox"
3. Click "Today" in sidebar
4. Verify header changes to "Today" with current date
5. Click "Upcoming" in sidebar
6. Verify header changes to "Upcoming"

**Expected:**
- Each navigation item changes the main view
- Header title updates accordingly
- URL does NOT change (single-page app)

**Status:** [ ] PASS [ ] FAIL

---

### Test 1.3: Task Counts Display
**Steps:**
1. View sidebar
2. Check for task counts next to "Inbox" and "Today"

**Expected:**
- Inbox shows count of unorganized tasks
- Today shows count of tasks scheduled for today
- Counts are numeric and accurate

**Status:** [ ] PASS [ ] FAIL

---

## Test Suite 2: Task Creation

### Test 2.1: Quick Add with Q Keyboard Shortcut
**Steps:**
1. Press "Q" key (lowercase, no modifiers)
2. Verify Quick Add modal appears
3. Type "Test task from Q shortcut"
4. Press Enter or click "Add Task"

**Expected:**
- Modal opens instantly when Q is pressed
- Input field is auto-focused
- Task is created and modal closes
- New task appears in current view

**Status:** [ ] PASS [ ] FAIL

---

### Test 2.2: Quick Add with N Keyboard Shortcut
**Steps:**
1. Press "N" key (lowercase, no modifiers)
2. Verify Quick Add modal appears
3. Type "Test task from N shortcut"
4. Press Enter

**Expected:**
- Modal opens (same behavior as Q)
- Task is created successfully

**Status:** [ ] PASS [ ] FAIL

---

### Test 2.3: Quick Add with Header Button
**Steps:**
1. Click "Add Task" button in header (blue button with + icon)
2. Enter task title: "Test task from button"
3. Click "Add Task" in modal

**Expected:**
- Modal opens
- Task is created
- Modal closes automatically

**Status:** [ ] PASS [ ] FAIL

---

### Test 2.4: Quick Add with Project Assignment
**Steps:**
1. If no projects exist, create one first (via sidebar or API)
2. Press Q to open Quick Add
3. Enter task: "Task with project"
4. Select a project from the dropdown (if available)
5. Submit

**Expected:**
- Project dropdown is visible and functional
- Task is created with project assignment
- Task appears in project view

**Status:** [ ] PASS [ ] FAIL

---

### Test 2.5: Quick Add - Escape to Close
**Steps:**
1. Press Q to open Quick Add
2. Press Escape key

**Expected:**
- Modal closes without creating task
- No task is added

**Status:** [ ] PASS [ ] FAIL

---

## Test Suite 3: Task Management

### Test 3.1: Task Status Transition (Inbox → Today)
**Steps:**
1. Navigate to Inbox
2. Create a new task: "Test status transition"
3. Click on the task to select it
4. Press Enter or click to open task detail
5. Set a due date or scheduled date for today
6. Close detail panel
7. Navigate to Today view

**Expected:**
- Task moves from Inbox to Today when date is set
- Task appears in Today view
- Inbox count decrements

**Status:** [ ] PASS [ ] FAIL

---

### Test 3.2: Complete Task with Cmd+Enter
**Steps:**
1. Navigate to Today
2. Click on a task to select it (task should be highlighted)
3. Press Cmd+Enter (Mac) or Ctrl+Enter (Windows/Linux)

**Expected:**
- Task is marked as complete
- Task disappears from Today view or shows as completed
- Completion animation or visual feedback

**Status:** [ ] PASS [ ] FAIL

---

### Test 3.3: Edit Task with E Key
**Steps:**
1. Select a task by clicking on it
2. Press "E" key

**Expected:**
- Task detail panel opens on the right side
- Task title and fields are editable

**Status:** [ ] PASS [ ] FAIL

---

### Test 3.4: Edit Task with Enter Key
**Steps:**
1. Select a task by clicking on it
2. Press "Enter" key

**Expected:**
- Task detail panel opens (same as pressing E)

**Status:** [ ] PASS [ ] FAIL

---

### Test 3.5: Delete Task with D Key
**Steps:**
1. Select a task
2. Press "D" key
3. Confirm deletion in the confirmation dialog

**Expected:**
- Confirmation dialog appears
- Task is deleted after confirmation
- Task disappears from list

**Status:** [ ] PASS [ ] FAIL

---

### Test 3.6: Task Priority Editing
**Steps:**
1. Open a task detail panel
2. Change priority (P1, P2, P3, or P4)
3. Close panel
4. Verify priority indicator on task card

**Expected:**
- Priority updates successfully
- Visual indicator (color or badge) shows priority level
- Changes persist after page reload

**Status:** [ ] PASS [ ] FAIL

---

### Test 3.7: Task Deadline Setting
**Steps:**
1. Open task detail panel
2. Set a deadline date
3. Close panel
4. Check if task appears in Upcoming view with correct date

**Expected:**
- Deadline is saved
- Task appears in Upcoming view grouped by date
- Deadline is displayed on task card

**Status:** [ ] PASS [ ] FAIL

---

## Test Suite 4: Subtasks

### Test 4.1: Create Subtask with Tab Key
**Steps:**
1. Select a parent task (not already a subtask)
2. Press Tab key
3. Verify Quick Add modal opens with parent task indicated
4. Enter subtask title: "Subtask 1"
5. Submit

**Expected:**
- Modal shows "Subtask of: [Parent Task Title]"
- Subtask is created and linked to parent
- Subtask appears indented under parent

**Status:** [ ] PASS [ ] FAIL

---

### Test 4.2: Multiple Subtasks
**Steps:**
1. Create a parent task: "Parent task with subtasks"
2. Create 3 subtasks under it:
   - "Subtask A"
   - "Subtask B"
   - "Subtask C"
3. Verify all appear under parent

**Expected:**
- All 3 subtasks are linked to parent
- Subtasks are visually indented
- Parent shows subtask count indicator

**Status:** [ ] PASS [ ] FAIL

---

### Test 4.3: Complete Parent Task with Incomplete Subtasks
**Steps:**
1. Select a parent task with incomplete subtasks
2. Try to complete the parent task (Cmd+Enter)

**Expected:**
- Either warning is shown about incomplete subtasks
- OR parent can be completed but subtasks remain
- Behavior is consistent and documented

**Status:** [ ] PASS [ ] FAIL

---

## Test Suite 5: Project Management

### Test 5.1: Create Task in Project
**Steps:**
1. Find or create a project in sidebar
2. Click the "+" button next to the project name
3. Enter task title: "Task in project"
4. Submit

**Expected:**
- Quick Add opens with project pre-selected
- Task is created in the project
- Task appears in project view

**Status:** [ ] PASS [ ] FAIL

---

### Test 5.2: Move Task Between Projects
**Steps:**
1. Open a task detail panel
2. Change the project assignment
3. Close panel
4. Navigate to new project view

**Expected:**
- Task moves to new project
- Task disappears from old project
- Project counts update

**Status:** [ ] PASS [ ] FAIL

---

### Test 5.3: Project Task Count Accuracy
**Steps:**
1. Navigate to a project with tasks
2. Count visible tasks manually
3. Compare with count badge in sidebar

**Expected:**
- Count matches actual number of incomplete tasks
- Completed tasks are not counted
- Count updates in real-time

**Status:** [ ] PASS [ ] FAIL

---

## Test Suite 6: Views

### Test 6.1: Today View Filtering
**Steps:**
1. Navigate to Today view
2. Check that only today's tasks are shown

**Expected:**
- Tasks with due date = today
- Tasks scheduled for today
- Tasks without dates but marked for today
- No overdue or future tasks

**Status:** [ ] PASS [ ] FAIL

---

### Test 6.2: Upcoming View Date Grouping
**Steps:**
1. Navigate to Upcoming view
2. Verify tasks are grouped by date

**Expected:**
- Tasks grouped under date headers
- Dates are in chronological order
- Each group shows date in readable format (e.g., "Tomorrow", "Jan 25")

**Status:** [ ] PASS [ ] FAIL

---

### Test 6.3: Inbox View Shows Unorganized Tasks
**Steps:**
1. Navigate to Inbox
2. Create a task with no project, no date, no context
3. Verify it appears in Inbox

**Expected:**
- Only tasks without project, due date, or scheduled date
- Tasks can be organized from here

**Status:** [ ] PASS [ ] FAIL

---

## Test Suite 7: Keyboard Shortcuts

### Test 7.1: Arrow Key Navigation
**Steps:**
1. Navigate to Today view with multiple tasks
2. Press Down Arrow key
3. Verify first task is selected (highlighted)
4. Press Down Arrow again
5. Verify next task is selected
6. Press Up Arrow
7. Verify previous task is selected

**Expected:**
- Arrow keys navigate through task list
- Selection is visually indicated
- Navigation wraps or stops at boundaries

**Status:** [ ] PASS [ ] FAIL

---

### Test 7.2: Search with / Key
**Steps:**
1. Press "/" key
2. Verify search modal opens

**Expected:**
- Search modal or input appears
- Input is focused and ready

**Status:** [ ] PASS [ ] FAIL

---

### Test 7.3: Search with Cmd+K
**Steps:**
1. Press Cmd+K (Mac) or Ctrl+K (Windows/Linux)
2. Verify search modal opens

**Expected:**
- Same behavior as "/" key

**Status:** [ ] PASS [ ] FAIL

---

### Test 7.4: Go To Navigation (G+I, G+T, G+U)
**Steps:**
1. Press "G" then quickly press "I"
2. Verify navigates to Inbox
3. Press "G" then "T"
4. Verify navigates to Today
5. Press "G" then "U"
6. Verify navigates to Upcoming

**Expected:**
- Two-key navigation shortcuts work
- View changes immediately

**Status:** [ ] PASS [ ] FAIL

---

### Test 7.5: Escape to Close Modals
**Steps:**
1. Open Quick Add (press Q)
2. Press Escape
3. Verify modal closes
4. Open task detail panel (click task)
5. Press Escape
6. Verify panel closes

**Expected:**
- Escape closes all modals and panels
- No side effects

**Status:** [ ] PASS [ ] FAIL

---

## Test Suite 8: Search & Filtering

### Test 8.1: Task Search by Title
**Steps:**
1. Open search (Cmd+K or /)
2. Type part of a task title
3. Verify matching tasks appear

**Expected:**
- Search is case-insensitive
- Results update as you type
- Clicking result navigates to task

**Status:** [ ] PASS [ ] FAIL

---

### Test 8.2: Context Menu Filtering
**Steps:**
1. If contexts exist, try filtering by context
2. Verify only tasks with that context are shown

**Expected:**
- Context filter works correctly
- Clear filter button appears

**Status:** [ ] PASS [ ] FAIL

---

## Test Suite 9: Recurring Tasks

### Test 9.1: Create Recurring Task
**Steps:**
1. Open task detail or quick add
2. Set task to repeat (daily, weekly, etc.)
3. Complete the task
4. Verify new instance is created for next occurrence

**Expected:**
- Recurring pattern is saved
- Completing task generates next instance
- Next instance has correct date

**Status:** [ ] PASS [ ] FAIL

---

## Test Suite 10: Integration & Data Persistence

### Test 10.1: Data Persistence Across Reload
**Steps:**
1. Create a new task
2. Reload the page (Cmd+R or F5)
3. Verify task still exists

**Expected:**
- All tasks persist
- State is restored correctly

**Status:** [ ] PASS [ ] FAIL

---

### Test 10.2: Backend Connection Status
**Steps:**
1. Stop the backend Hub API
2. Try to create a task
3. Check for error message or offline indicator

**Expected:**
- App shows connection error
- Graceful degradation or retry mechanism

**Status:** [ ] PASS [ ] FAIL

---

### Test 10.3: Real-time Updates
**Steps:**
1. Open Tasks app in two browser tabs
2. Create a task in Tab 1
3. Check if it appears in Tab 2

**Expected:**
- Changes sync across tabs (if implemented)
- OR refresh is needed to see updates

**Status:** [ ] PASS [ ] FAIL

---

## Test Suite 11: UI/UX & Accessibility

### Test 11.1: Responsive Design
**Steps:**
1. Resize browser window to mobile width (375px)
2. Verify layout adapts
3. Verify all features are accessible

**Expected:**
- Layout adjusts for mobile
- No horizontal scrolling
- All features remain functional

**Status:** [ ] PASS [ ] FAIL

---

### Test 11.2: Visual Feedback for Actions
**Steps:**
1. Perform various actions (create, edit, delete, complete)
2. Observe visual feedback

**Expected:**
- Loading indicators when appropriate
- Success/error messages
- Smooth transitions and animations

**Status:** [ ] PASS [ ] FAIL

---

### Test 11.3: Keyboard Navigation Accessibility
**Steps:**
1. Use Tab key to navigate through interface
2. Verify all interactive elements are reachable
3. Test with screen reader if possible

**Expected:**
- Logical tab order
- Focus indicators visible
- Screen reader compatible (if accessible)

**Status:** [ ] PASS [ ] FAIL

---

## Test Suite 12: Edge Cases & Error Handling

### Test 12.1: Empty State Displays
**Steps:**
1. Navigate to view with no tasks
2. Verify empty state message

**Expected:**
- Friendly empty state message
- Suggestion to add tasks
- No broken UI

**Status:** [ ] PASS [ ] FAIL

---

### Test 12.2: Very Long Task Titles
**Steps:**
1. Create task with 200+ character title
2. Verify display doesn't break layout

**Expected:**
- Title truncates with ellipsis
- Full title visible in detail view
- No layout overflow

**Status:** [ ] PASS [ ] FAIL

---

### Test 12.3: Special Characters in Task Title
**Steps:**
1. Create task with special characters: `<script>alert("XSS")</script>`
2. Create task with emojis: 🚀 💡 ✅ 📝
3. Verify proper display

**Expected:**
- Special characters are escaped/sanitized
- Emojis display correctly
- No XSS vulnerabilities

**Status:** [ ] PASS [ ] FAIL

---

## Summary Template

**Total Tests:** 50+
**Passed:** ___
**Failed:** ___
**Blocked:** ___
**Pass Rate:** ___%

**Critical Issues Found:**
1.
2.
3.

**Minor Issues Found:**
1.
2.
3.

**Recommendations:**
1.
2.
3.

**Tested By:** ________________
**Date:** ________________
**Environment:** ________________
**Browser:** ________________
