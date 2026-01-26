# Weekly Planning Feature - Product Requirements Document

## Overview
The Weekly Planning feature enables users to visually plan their week by scheduling tasks from a backlog onto a calendar grid. It follows a Google Calendar-style interaction model with drag-and-drop scheduling, real-time preview, and granular time control.

## User Stories

### As a user, I want to:
1. **Brain dump tasks** - Quickly add tasks to a backlog without worrying about when to do them
2. **See my week at a glance** - View calendar events and scheduled tasks side-by-side
3. **Schedule tasks visually** - Drag tasks from backlog to specific time slots on the calendar
4. **See where tasks will land** - Get visual feedback (hover preview) showing exactly where a task will be scheduled before dropping
5. **Reschedule tasks** - Drag scheduled tasks to different times or days
6. **Unschedule tasks** - Move tasks back to backlog if plans change
7. **Create calendar events** - Click and drag on the calendar to create new events
8. **Navigate between weeks** - Move forward/backward to plan future weeks
9. **Complete tasks** - Mark tasks as done directly from the calendar

---

## Functional Requirements

### FR-1: Weekly Backlog Panel
| ID | Requirement | Priority |
|----|-------------|----------|
| FR-1.1 | Display a "Weekly Backlog" panel on the left side of the screen | P0 |
| FR-1.2 | Show task count in the panel header | P0 |
| FR-1.3 | Allow adding new tasks via "Add task" button | P0 |
| FR-1.4 | Support rapid task entry (type and press Enter to add, stay in input for next task) | P1 |
| FR-1.5 | Display task title, priority indicator, and time estimate for each task | P0 |
| FR-1.6 | Tasks should be draggable from the backlog | P0 |
| FR-1.7 | Show visual feedback when a task is being dragged (opacity change, shadow) | P1 |
| FR-1.8 | Allow reordering tasks within the backlog via drag-and-drop | P2 |

### FR-2: Calendar Grid
| ID | Requirement | Priority |
|----|-------------|----------|
| FR-2.1 | Display 7 days (current week) with day names and dates | P0 |
| FR-2.2 | Show time slots from 6am to 10pm in 15-minute increments | P0 |
| FR-2.3 | Each day column split into "Events" (left) and "Tasks" (right) sections | P0 |
| FR-2.4 | Display current time indicator (red line) on today's column | P1 |
| FR-2.5 | Highlight today's column with distinct background | P1 |
| FR-2.6 | Support vertical scrolling within the calendar area | P0 |
| FR-2.7 | Auto-scroll to current time on page load | P1 |

### FR-3: Calendar Events Display
| ID | Requirement | Priority |
|----|-------------|----------|
| FR-3.1 | Display Google Calendar events in the "Events" column | P0 |
| FR-3.2 | Show event title, time, and color based on event type | P0 |
| FR-3.3 | Events should be read-only (cannot drag to reschedule) | P0 |
| FR-3.4 | Show event count per day in column header | P1 |

### FR-4: Task Scheduling (Drag from Backlog)
| ID | Requirement | Priority |
|----|-------------|----------|
| FR-4.1 | Allow dragging tasks from backlog to any "Tasks" column | P0 |
| FR-4.2 | Show drag overlay (floating card) while dragging | P0 |
| FR-4.3 | **Show hover preview** - A distinct visual block in the target column showing exactly where the task will be placed | P0 |
| FR-4.4 | Hover preview must update in real-time as cursor moves between days and time slots | P0 |
| FR-4.5 | Hover preview must show task title and scheduled time | P0 |
| FR-4.6 | Snap to 15-minute increments when dropping | P0 |
| FR-4.7 | On drop, schedule the task at the previewed time | P0 |
| FR-4.8 | Remove task from backlog after successful scheduling | P0 |
| FR-4.9 | Task duration should default to time estimate or 15 minutes if not set | P1 |

### FR-5: Task Rescheduling (Drag Scheduled Tasks)
| ID | Requirement | Priority |
|----|-------------|----------|
| FR-5.1 | Scheduled tasks in the calendar should be draggable | P0 |
| FR-5.2 | Allow dragging to different time slots on the same day | P0 |
| FR-5.3 | Allow dragging to different days | P0 |
| FR-5.4 | Show hover preview when rescheduling | P0 |
| FR-5.5 | Original task position should show reduced opacity while dragging | P1 |

### FR-6: Task Unscheduling
| ID | Requirement | Priority |
|----|-------------|----------|
| FR-6.1 | Right-click on scheduled task shows context menu | P0 |
| FR-6.2 | Context menu includes "Back to Backlog" option | P0 |
| FR-6.3 | Clicking "Back to Backlog" removes schedule and returns task to backlog | P0 |
| FR-6.4 | Context menu includes "Edit Details" option | P1 |

### FR-7: Event Creation (Click-Drag on Calendar)
| ID | Requirement | Priority |
|----|-------------|----------|
| FR-7.1 | Click and drag on "Events" column creates a time range selection | P0 |
| FR-7.2 | Show visual preview of selected time range while dragging | P0 |
| FR-7.3 | On mouse up, show event creation popup | P0 |
| FR-7.4 | Popup shows date, time range, and title input | P0 |
| FR-7.5 | Allow creating event with title | P0 |
| FR-7.6 | Popup also allows scheduling an existing backlog task to that time | P1 |

### FR-8: Task Completion
| ID | Requirement | Priority |
|----|-------------|----------|
| FR-8.1 | Each scheduled task shows a checkbox | P0 |
| FR-8.2 | Clicking checkbox marks task as complete | P0 |
| FR-8.3 | Completed tasks show strikethrough and reduced opacity | P0 |
| FR-8.4 | Completed tasks remain visible in their time slot | P1 |

### FR-9: Week Navigation
| ID | Requirement | Priority |
|----|-------------|----------|
| FR-9.1 | Display current week date range in header | P0 |
| FR-9.2 | Previous/Next week navigation buttons | P0 |
| FR-9.3 | Cannot navigate to past weeks (previous button disabled for current week) | P1 |
| FR-9.4 | Show week offset indicator when viewing future weeks | P1 |

### FR-10: Visual Feedback & Polish
| ID | Requirement | Priority |
|----|-------------|----------|
| FR-10.1 | Smooth transitions when dragging | P1 |
| FR-10.2 | Drop zone highlighting when hovering over valid targets | P1 |
| FR-10.3 | Priority-based color coding for tasks | P1 |
| FR-10.4 | Event type-based color coding for calendar events | P1 |
| FR-10.5 | Legend showing color meanings | P2 |

---

## Non-Functional Requirements

### NFR-1: Performance
- Page load time < 2 seconds
- Drag operations must be smooth (60fps)
- No visible lag when moving between time slots

### NFR-2: Responsiveness
- Minimum supported width: 1024px
- Calendar should be horizontally scrollable on smaller screens

### NFR-3: Accessibility
- All interactive elements must be keyboard accessible
- Proper ARIA labels for drag-and-drop operations

---

## Test Scenarios

### TS-1: Backlog Management
1. Add a task via "Add task" button - task appears in backlog
2. Add multiple tasks rapidly - all tasks appear
3. Task displays title, priority, and time estimate correctly

### TS-2: Task Scheduling from Backlog
1. Drag task from backlog toward calendar
2. **Verify hover preview appears** in the target column at the correct time
3. Preview updates as cursor moves to different times
4. Preview updates as cursor moves to different days
5. Drop task - task appears at previewed location
6. Task is removed from backlog after drop
7. Scheduled task shows correct time

### TS-3: Task Rescheduling
1. Drag a scheduled task to a different time on same day
2. **Verify hover preview appears** at new location
3. Drop - task moves to new time
4. Drag a scheduled task to a different day
5. **Verify hover preview appears** on new day
6. Drop - task moves to new day and time

### TS-4: Task Unscheduling
1. Right-click on scheduled task
2. Context menu appears with "Back to Backlog" option
3. Click "Back to Backlog"
4. Task disappears from calendar
5. Task reappears in backlog

### TS-5: Event Creation
1. Click and drag on Events column
2. Preview rectangle shows selected time range
3. Release mouse - popup appears
4. Enter title and create event
5. Event appears in calendar

### TS-6: Task Completion
1. Click checkbox on scheduled task
2. Task shows completed state (strikethrough, opacity)
3. Task remains visible in time slot

### TS-7: Week Navigation
1. Click next week button
2. Calendar shows next week dates
3. Click previous week button
4. Calendar returns to current week
5. Previous button disabled when on current week

### TS-8: Hover Preview Accuracy
1. Drag task and position cursor at 9:00am - preview shows 9:00am
2. Move cursor to 9:15am - preview updates to 9:15am
3. Move cursor to 2:30pm - preview shows 2:30pm
4. Move cursor to Monday - preview in Monday column
5. Move cursor to Tuesday - preview moves to Tuesday column
6. Preview disappears when cursor leaves calendar area

---

## Acceptance Criteria

The feature is complete when:
1. All P0 requirements are implemented and tested
2. All test scenarios pass
3. Hover preview works accurately and responsively
4. Tasks can be scheduled, rescheduled, and unscheduled
5. Events can be created via click-drag
6. Week navigation works correctly
7. No console errors during normal operation

---

## Current Known Issues (To Fix)

1. Hover preview positioning may be inaccurate in some scroll states
2. Backlog tasks may not always have the correct data attribute for dragging
3. Event creation drag preview may not show correctly
4. Context menu positioning edge cases

---

*Last Updated: January 26, 2026*
