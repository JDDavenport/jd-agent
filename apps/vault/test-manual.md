# Vault App - Manual Testing Guide

**App URL:** http://localhost:5181
**Last Updated:** 2026-01-23

## Pre-Test Setup
- Ensure backend Hub API is running on http://localhost:3000
- Ensure Vault app is running on http://localhost:5181
- Open the app in Chrome/Chromium browser

---

## Test Suite 1: Basic Navigation & UI

### Test 1.1: App Loads Successfully
**Steps:**
1. Navigate to http://localhost:5181
2. Verify page loads without errors

**Expected:**
- App displays without JavaScript errors in console
- Sidebar is visible with navigation items
- Main content area displays welcome screen or page list
- Header/navigation elements are present

**Status:** [ ] PASS [ ] FAIL

---

### Test 1.2: Sidebar Structure
**Steps:**
1. Examine the sidebar
2. Check for sections: Search, Favorites, Projects, Areas, Resources, etc.

**Expected:**
- Sidebar shows hierarchical structure
- Page tree is visible
- Navigation items are clickable
- Collapse/expand buttons work

**Status:** [ ] PASS [ ] FAIL

---

### Test 1.3: Toggle Sidebar with Cmd+\
**Steps:**
1. Press Cmd+\ (Mac) or Ctrl+\ (Windows/Linux)
2. Verify sidebar collapses
3. Press again to expand

**Expected:**
- Sidebar animates smoothly
- Content area adjusts width
- Keyboard shortcut works both ways

**Status:** [ ] PASS [ ] FAIL

---

## Test Suite 2: Page Creation (Notion-Style)

### Test 2.1: Create Page with Cmd+N
**Steps:**
1. Press Cmd+N (Mac) or Ctrl+N (Windows/Linux)
2. Verify new page is created instantly with "Untitled" title

**Expected:**
- Page is created immediately (no modal)
- Page opens in editor automatically
- Title field is focused and editable
- Page appears in sidebar

**Status:** [ ] PASS [ ] FAIL

---

### Test 2.2: Create Page from Sidebar Button
**Steps:**
1. Click "+" button in sidebar (if present)
2. Verify new page is created

**Expected:**
- Same behavior as Cmd+N
- Page created and opened instantly

**Status:** [ ] PASS [ ] FAIL

---

### Test 2.3: Create Nested Page
**Steps:**
1. Select a parent page in sidebar
2. Right-click or use "+" next to it to create child page
3. Verify page is created under parent

**Expected:**
- Child page appears indented under parent
- Breadcrumb shows parent hierarchy
- Parent page has expand/collapse icon

**Status:** [ ] PASS [ ] FAIL

---

### Test 2.4: Rename Page
**Steps:**
1. Open a page with "Untitled" title
2. Click on title and edit to "Test Page"
3. Click outside or press Enter

**Expected:**
- Title updates in editor
- Title updates in sidebar
- Changes are auto-saved

**Status:** [ ] PASS [ ] FAIL

---

## Test Suite 3: TipTap Block Editor

### Test 3.1: Editor Loads and is Editable
**Steps:**
1. Open or create a page
2. Click in the editor content area
3. Type some text

**Expected:**
- Cursor appears in editor
- Text input works smoothly
- No lag or performance issues

**Status:** [ ] PASS [ ] FAIL

---

### Test 3.2: Slash Command Menu (/)
**Steps:**
1. In editor, type "/" character
2. Verify slash command menu appears

**Expected:**
- Menu appears with list of block types
- Menu shows options like: Heading, List, Quote, Code, etc.
- Arrow keys navigate menu
- Enter selects option

**Status:** [ ] PASS [ ] FAIL

---

### Test 3.3: Heading Creation with # Markdown
**Steps:**
1. Type "# " (hash + space) at start of line
2. Verify it converts to Heading 1

**Expected:**
- Text becomes H1 styled
- Markdown shortcut is replaced
- Typing continues normally

**Status:** [ ] PASS [ ] FAIL

---

### Test 3.4: Heading Hierarchy (##, ###)
**Steps:**
1. Type "## " for Heading 2
2. Type "### " for Heading 3

**Expected:**
- H2 and H3 styles apply correctly
- Font sizes are distinct and hierarchical

**Status:** [ ] PASS [ ] FAIL

---

### Test 3.5: Bullet List with - Markdown
**Steps:**
1. Type "- " (dash + space)
2. Verify bullet list is created
3. Press Enter to add more items
4. Press Enter twice to exit list

**Expected:**
- Bullet point appears
- Enter adds new bullet item
- Double Enter exits list

**Status:** [ ] PASS [ ] FAIL

---

### Test 3.6: Numbered List
**Steps:**
1. Type "1. " (number + period + space)
2. Verify numbered list is created

**Expected:**
- Numbers appear automatically
- Subsequent items auto-increment
- Enter twice exits list

**Status:** [ ] PASS [ ] FAIL

---

### Test 3.7: Bold, Italic, Code Formatting
**Steps:**
1. Type **bold** or select text and Cmd+B
2. Type *italic* or select text and Cmd+I
3. Type `code` or select text and format as code

**Expected:**
- Markdown shortcuts work
- Keyboard shortcuts work
- Formatting applies correctly

**Status:** [ ] PASS [ ] FAIL

---

### Test 3.8: Block Quote
**Steps:**
1. Type "> " (greater than + space) or use slash command
2. Enter text

**Expected:**
- Quote block is created
- Text is visually distinct (indented/bordered)

**Status:** [ ] PASS [ ] FAIL

---

### Test 3.9: Code Block
**Steps:**
1. Type "```" (three backticks) or use slash command
2. Enter code

**Expected:**
- Code block with syntax highlighting
- Monospace font
- Can select language (if supported)

**Status:** [ ] PASS [ ] FAIL

---

### Test 3.10: Divider / Horizontal Rule
**Steps:**
1. Type "---" (three dashes) or use slash command
2. Verify horizontal rule appears

**Expected:**
- Horizontal line divider
- Markdown is replaced with visual rule

**Status:** [ ] PASS [ ] FAIL

---

### Test 3.11: Task/Todo List (if supported)
**Steps:**
1. Type "[ ] " or use slash command
2. Create checkbox items

**Expected:**
- Checkboxes appear
- Can check/uncheck items
- State persists

**Status:** [ ] PASS [ ] FAIL

---

## Test Suite 4: Auto-Save Functionality

### Test 4.1: Auto-Save on Edit
**Steps:**
1. Edit page content
2. Wait 2-3 seconds
3. Reload page

**Expected:**
- Changes are saved automatically
- No manual save button needed
- Content persists after reload

**Status:** [ ] PASS [ ] FAIL

---

### Test 4.2: Save Indicator
**Steps:**
1. Type in editor
2. Watch for save indicator (e.g., "Saving...", "Saved")

**Expected:**
- Indicator shows save status
- Updates from "Saving" to "Saved"
- User has feedback on save status

**Status:** [ ] PASS [ ] FAIL

---

### Test 4.3: Title Auto-Save
**Steps:**
1. Edit page title
2. Wait a moment
3. Navigate away and back

**Expected:**
- Title change is saved
- No prompt to save
- Change persists

**Status:** [ ] PASS [ ] FAIL

---

## Test Suite 5: Search & Command Palette

### Test 5.1: Open Command Palette with Cmd+K
**Steps:**
1. Press Cmd+K (Mac) or Ctrl+K (Windows/Linux)
2. Verify command palette opens

**Expected:**
- Modal/overlay opens
- Search input is focused
- Shows recent pages or all pages

**Status:** [ ] PASS [ ] FAIL

---

### Test 5.2: Search Pages by Title
**Steps:**
1. Open command palette (Cmd+K)
2. Type partial page title
3. Verify matching results appear

**Expected:**
- Results update as you type
- Matches are highlighted
- Can navigate with arrow keys

**Status:** [ ] PASS [ ] FAIL

---

### Test 5.3: Search Page Content
**Steps:**
1. Open command palette
2. Search for text that exists in page content (not title)
3. Verify results include pages with matching content

**Expected:**
- Full-text search works
- Results show content preview or match context
- Can navigate to matching pages

**Status:** [ ] PASS [ ] FAIL

---

### Test 5.4: Navigate to Page from Search
**Steps:**
1. Open command palette
2. Search for a page
3. Click result or press Enter

**Expected:**
- Command palette closes
- Selected page opens in editor

**Status:** [ ] PASS [ ] FAIL

---

### Test 5.5: Escape to Close Command Palette
**Steps:**
1. Open command palette (Cmd+K)
2. Press Escape

**Expected:**
- Command palette closes
- No page navigation

**Status:** [ ] PASS [ ] FAIL

---

## Test Suite 6: Folder Organization

### Test 6.1: Create Folder/Parent Page
**Steps:**
1. Create a new page: "My Folder"
2. Create child pages under it

**Expected:**
- Pages can be nested
- Parent acts as folder/container
- Child pages are organized under parent

**Status:** [ ] PASS [ ] FAIL

---

### Test 6.2: Move Page to Different Parent
**Steps:**
1. Drag a page in sidebar to drop under different parent
2. OR use right-click menu to move

**Expected:**
- Page moves to new parent
- Hierarchy updates in sidebar
- Breadcrumb updates when viewing page

**Status:** [ ] PASS [ ] FAIL

---

### Test 6.3: Expand/Collapse Folders
**Steps:**
1. Click expand/collapse icon next to parent page
2. Verify children show/hide

**Expected:**
- Smooth animation
- State persists (expanded/collapsed remembered)

**Status:** [ ] PASS [ ] FAIL

---

## Test Suite 7: Navigation & Breadcrumbs

### Test 7.1: Breadcrumb Navigation
**Steps:**
1. Open a deeply nested page
2. Verify breadcrumb trail at top
3. Click a breadcrumb item

**Expected:**
- Breadcrumb shows full path (e.g., Home > Projects > Project A > Page)
- Clicking navigates to that level
- Current page is highlighted

**Status:** [ ] PASS [ ] FAIL

---

### Test 7.2: Back/Forward Navigation
**Steps:**
1. Navigate through several pages
2. Use browser back button
3. Use browser forward button

**Expected:**
- Browser history works correctly
- Pages load when navigating back/forward
- State is restored

**Status:** [ ] PASS [ ] FAIL

---

### Test 7.3: Sidebar Page Selection Sync
**Steps:**
1. Open a page
2. Verify it's highlighted/selected in sidebar

**Expected:**
- Current page is visually distinct in sidebar
- Selection updates when navigating
- Sidebar scrolls to show current page if needed

**Status:** [ ] PASS [ ] FAIL

---

## Test Suite 8: Favorites & Bookmarks

### Test 8.1: Add Page to Favorites
**Steps:**
1. Right-click a page or use star icon
2. Select "Add to Favorites"
3. Check Favorites section in sidebar

**Expected:**
- Page appears in Favorites
- Star icon or indicator shows it's favorited
- Can access quickly from Favorites section

**Status:** [ ] PASS [ ] FAIL

---

### Test 8.2: Remove Page from Favorites
**Steps:**
1. Right-click a favorited page
2. Select "Remove from Favorites"

**Expected:**
- Page removed from Favorites section
- Still exists in main page tree
- Star indicator removed

**Status:** [ ] PASS [ ] FAIL

---

## Test Suite 9: Legacy Vault Entries (if applicable)

### Test 9.1: Access Legacy Entries
**Steps:**
1. Check sidebar for "Legacy Entries" or similar section
2. Click to view old vault entries

**Expected:**
- Legacy entries are accessible
- Different UI or view for legacy mode
- Data is preserved from old system

**Status:** [ ] PASS [ ] FAIL

---

### Test 9.2: Migrate Legacy Entry to New Page
**Steps:**
1. Open a legacy entry
2. Convert or migrate to new page format

**Expected:**
- Migration option available
- Content preserved
- Formatting retained

**Status:** [ ] PASS [ ] FAIL

---

## Test Suite 10: Special Views

### Test 10.1: Journal View
**Steps:**
1. Navigate to Journal view (if available)
2. Check for date-based entries

**Expected:**
- Journal entries organized by date
- Easy to create daily entries
- Calendar or date navigation

**Status:** [ ] PASS [ ] FAIL

---

### Test 10.2: Archive View
**Steps:**
1. Navigate to Archive view
2. Check for archived pages/entries

**Expected:**
- Shows archived content
- Separate from active pages
- Can restore from archive

**Status:** [ ] PASS [ ] FAIL

---

### Test 10.3: Tags View
**Steps:**
1. Navigate to Tags view
2. Check for tag-based organization

**Expected:**
- Shows all tags used
- Click tag to see tagged pages
- Tag count displayed

**Status:** [ ] PASS [ ] FAIL

---

### Test 10.4: Goals View
**Steps:**
1. Navigate to Goals view
2. Check for goals display

**Expected:**
- Shows goals and progress
- Can create/edit goals
- Links to related pages

**Status:** [ ] PASS [ ] FAIL

---

## Test Suite 11: Vault Chat (if available)

### Test 11.1: Open Vault Chat
**Steps:**
1. Look for chat icon or button
2. Click to open chat panel

**Expected:**
- Chat panel opens (sidebar or overlay)
- Chat interface is functional

**Status:** [ ] PASS [ ] FAIL

---

### Test 11.2: Ask Question About Vault Content
**Steps:**
1. Open chat
2. Ask: "What pages are in my vault about projects?"
3. Verify AI responds with relevant information

**Expected:**
- AI can search vault content
- Responses are accurate
- Can navigate to mentioned pages

**Status:** [ ] PASS [ ] FAIL

---

## Test Suite 12: Keyboard Shortcuts

### Test 12.1: Full Shortcut List
**Test these shortcuts:**
- Cmd+N / Ctrl+N: New page
- Cmd+K / Ctrl+K: Command palette
- Cmd+\ / Ctrl+\: Toggle sidebar
- Escape: Close modals
- Cmd+B / Ctrl+B: Bold
- Cmd+I / Ctrl+I: Italic
- /: Slash command menu

**Expected:**
- All shortcuts work as documented
- No conflicts with browser shortcuts

**Status:** [ ] PASS [ ] FAIL

---

## Test Suite 13: Data Persistence & Sync

### Test 13.1: Data Persistence Across Reload
**Steps:**
1. Create a page and add content
2. Reload page (Cmd+R or F5)
3. Verify page and content still exist

**Expected:**
- All data persists
- No data loss

**Status:** [ ] PASS [ ] FAIL

---

### Test 13.2: Multi-Tab Sync (if implemented)
**Steps:**
1. Open Vault in two browser tabs
2. Edit page in Tab 1
3. Check if changes appear in Tab 2

**Expected:**
- Changes sync automatically (if real-time sync enabled)
- OR refresh needed to see updates

**Status:** [ ] PASS [ ] FAIL

---

### Test 13.3: Backend Connection Status
**Steps:**
1. Stop backend Hub API
2. Try to edit a page
3. Observe error handling

**Expected:**
- Error message or offline indicator
- Graceful degradation
- Changes queued for sync when online

**Status:** [ ] PASS [ ] FAIL

---

## Test Suite 14: Performance & UX

### Test 14.1: Editor Performance with Large Content
**Steps:**
1. Create a page with 50+ paragraphs of text
2. Type and edit at various positions
3. Observe performance

**Expected:**
- No lag or stuttering
- Smooth typing experience
- Fast load times

**Status:** [ ] PASS [ ] FAIL

---

### Test 14.2: Sidebar Performance with Many Pages
**Steps:**
1. Create 100+ pages (or check existing vault with many pages)
2. Scroll through sidebar
3. Expand/collapse sections

**Expected:**
- Smooth scrolling
- Fast rendering
- No browser freezing

**Status:** [ ] PASS [ ] FAIL

---

### Test 14.3: Search Performance
**Steps:**
1. Search for common term that matches many pages
2. Measure response time

**Expected:**
- Results appear within 1 second
- No UI blocking
- Progressive loading if many results

**Status:** [ ] PASS [ ] FAIL

---

## Test Suite 15: Edge Cases & Error Handling

### Test 15.1: Empty State Display
**Steps:**
1. View Vault with no pages
2. Check for empty state message

**Expected:**
- Friendly message
- Prompt to create first page
- No broken UI

**Status:** [ ] PASS [ ] FAIL

---

### Test 15.2: Very Long Page Titles
**Steps:**
1. Create page with 200+ character title
2. Verify display in sidebar and breadcrumb

**Expected:**
- Title truncates with ellipsis in sidebar
- Full title visible on hover or in editor
- No layout overflow

**Status:** [ ] PASS [ ] FAIL

---

### Test 15.3: Special Characters in Content
**Steps:**
1. Type special characters: `<>{}[]|\/`
2. Type emojis: 🚀 💡 ✅ 📝
3. Verify proper display and save

**Expected:**
- Characters are properly escaped
- Emojis render correctly
- No XSS vulnerabilities

**Status:** [ ] PASS [ ] FAIL

---

### Test 15.4: Delete Page Confirmation
**Steps:**
1. Right-click a page
2. Select "Delete"
3. Verify confirmation dialog

**Expected:**
- Confirmation required
- Warning if page has children
- Can cancel or confirm

**Status:** [ ] PASS [ ] FAIL

---

### Test 15.5: Delete Page with Children
**Steps:**
1. Delete a parent page that has child pages
2. Check what happens to children

**Expected:**
- Warning shown about children
- Children either deleted with parent or orphaned
- Behavior is consistent and documented

**Status:** [ ] PASS [ ] FAIL

---

## Test Suite 16: Responsive Design

### Test 16.1: Mobile View (375px width)
**Steps:**
1. Resize browser to 375px wide
2. Test navigation and editing

**Expected:**
- Sidebar collapses or becomes overlay
- Editor remains functional
- All features accessible

**Status:** [ ] PASS [ ] FAIL

---

### Test 16.2: Tablet View (768px width)
**Steps:**
1. Resize browser to 768px wide
2. Test layout

**Expected:**
- Layout adapts appropriately
- No horizontal scrolling
- Good use of space

**Status:** [ ] PASS [ ] FAIL

---

## Test Suite 17: Collaboration Features (if applicable)

### Test 17.1: Share Page Link
**Steps:**
1. Right-click page
2. Select "Copy Link" or "Share"
3. Paste link in new browser tab

**Expected:**
- Link works and navigates to page
- Shareable URL format

**Status:** [ ] PASS [ ] FAIL

---

## Summary Template

**Total Tests:** 80+
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
