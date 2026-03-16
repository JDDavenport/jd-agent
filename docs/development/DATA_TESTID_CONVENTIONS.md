# Data-TestID Naming Conventions

> **Purpose:** Standardized naming conventions for `data-testid` attributes to enable stable E2E testing with Playwright.

## Why data-testid?

- **Stable selectors**: Won't break when CSS classes or text change
- **Clear intent**: Makes test code readable and maintainable
- **Decoupled from implementation**: Tests don't depend on styling details
- **Cross-app consistency**: Same patterns work across all JD Agent apps

## Naming Pattern

```
{component}-{element}-{optional-variant}
```

### Rules

1. Use **kebab-case** for all IDs
2. Start with the **component name** (lowercase)
3. Add the **element type** or role
4. Add **variants** only when needed to distinguish similar elements
5. Never include dynamic data in the ID pattern itself

### Examples

| Pattern | Example | Description |
|---------|---------|-------------|
| `{component}-{element}` | `header-logo` | Logo in Header |
| `{component}-{action}` | `sidebar-toggle` | Toggle button in Sidebar |
| `{component}-{element}-{type}` | `task-input-title` | Title input in TaskForm |
| `{component}-{element}-{variant}` | `nav-link-inbox` | Inbox link in navigation |

## Component-Specific Conventions

### Header Component

```tsx
data-testid="header"                    // Root container
data-testid="header-logo"               // Logo/brand
data-testid="header-status-indicator"   // Health status dot
data-testid="header-user-menu"          // User dropdown
data-testid="header-search-button"      // Search trigger
```

### Sidebar Component

```tsx
data-testid="sidebar"                   // Root container
data-testid="sidebar-toggle"            // Collapse/expand button
data-testid="sidebar-nav"               // Navigation container
data-testid="nav-link-{name}"           // Individual nav links
data-testid="sidebar-footer"            // Footer section
```

### Dashboard Widgets

```tsx
data-testid="widget-{name}"             // Widget container
data-testid="widget-{name}-header"      // Widget title area
data-testid="widget-{name}-content"     // Widget main content
data-testid="widget-{name}-loading"     // Loading state
data-testid="widget-{name}-empty"       // Empty state
```

### Task Components

```tsx
data-testid="task-list"                 // Task list container
data-testid="task-item-{index}"         // Individual task (use index)
data-testid="task-checkbox"             // Completion checkbox
data-testid="task-title"                // Task title text
data-testid="task-form"                 // New task form
data-testid="task-input-title"          // Title input field
data-testid="task-input-description"    // Description textarea
data-testid="task-submit"               // Submit button
```

### Vault Components

```tsx
data-testid="vault-sidebar"             // Sidebar container
data-testid="vault-tree"                // Folder tree
data-testid="vault-search"              // Search input
data-testid="vault-editor"              // Editor container
data-testid="vault-editor-title"        // Document title input
data-testid="vault-editor-content"      // Rich text editor
data-testid="vault-toolbar"             // Editor toolbar
```

### Modal/Dialog Components

```tsx
data-testid="modal-{name}"              // Modal container
data-testid="modal-{name}-title"        // Modal title
data-testid="modal-{name}-close"        // Close button
data-testid="modal-{name}-content"      // Modal body
data-testid="modal-{name}-confirm"      // Confirm action
data-testid="modal-{name}-cancel"       // Cancel action
```

### Form Elements

```tsx
data-testid="{form}-input-{field}"      // Input fields
data-testid="{form}-select-{field}"     // Select dropdowns
data-testid="{form}-checkbox-{field}"   // Checkboxes
data-testid="{form}-submit"             // Submit button
data-testid="{form}-cancel"             // Cancel button
data-testid="{form}-error-{field}"      // Field error message
```

### List/Table Patterns

```tsx
data-testid="{name}-list"               // List container
data-testid="{name}-item-{index}"       // List items (prefer index over ID)
data-testid="{name}-empty"              // Empty state
data-testid="{name}-loading"            // Loading state
data-testid="{name}-pagination"         // Pagination controls
```

## Dynamic IDs

When you need to identify specific items in a list:

### Prefer Index-Based

```tsx
// Good - predictable and stable
data-testid={`task-item-${index}`}
```

### For Unique Identification

```tsx
// When needed for specific item targeting
data-testid={`task-item-${task.id}`}
```

### In Tests

```typescript
// Using index
await page.getByTestId('task-item-0').click();

// Using specific ID when needed
await page.getByTestId(`task-item-${taskId}`).click();

// Pattern matching for any item
await page.getByTestId(/^task-item-/).first().click();
```

## Anti-Patterns to Avoid

### Don't Do This

```tsx
// Too generic
data-testid="button"

// Contains dynamic text
data-testid={`button-${buttonLabel}`}

// CamelCase
data-testid="TaskItem"

// Spaces or special characters
data-testid="task item"
data-testid="task_item"

// Implementation details
data-testid="material-ui-button-primary"
```

### Do This Instead

```tsx
// Specific and descriptive
data-testid="task-submit"

// Predictable pattern with index
data-testid={`task-item-${index}`}

// kebab-case
data-testid="task-item"

// Clean naming
data-testid="task-item"

// Role-based
data-testid="task-submit"
```

## Testing with Playwright

### Basic Usage

```typescript
// Click element
await page.getByTestId('sidebar-toggle').click();

// Fill input
await page.getByTestId('task-input-title').fill('New task');

// Check visibility
await expect(page.getByTestId('header-status-indicator')).toBeVisible();

// Get text
const title = await page.getByTestId('task-title').textContent();
```

### Pattern Matching

```typescript
// Match multiple elements
const tasks = page.getByTestId(/^task-item-/);
await expect(tasks).toHaveCount(5);

// First/last matching
await page.getByTestId(/^task-item-/).first().click();
```

### Chaining

```typescript
// Find within container
await page.getByTestId('task-form')
  .getByTestId('task-input-title')
  .fill('New task');
```

## Quick Reference by App

### Command Center

| Component | Key TestIDs |
|-----------|-------------|
| Header | `header`, `header-status-indicator`, `header-user-menu` |
| Sidebar | `sidebar`, `sidebar-toggle`, `nav-link-*` |
| Dashboard | `widget-*`, `stat-card-*` |

### Tasks App

| Component | Key TestIDs |
|-----------|-------------|
| Inbox | `inbox-view`, `task-list`, `task-item-*` |
| TaskForm | `task-form`, `task-input-*`, `task-submit` |
| Search | `search-modal`, `search-input`, `search-results` |

### Vault App

| Component | Key TestIDs |
|-----------|-------------|
| Sidebar | `vault-sidebar`, `vault-tree`, `vault-search` |
| Editor | `vault-editor`, `vault-editor-title`, `vault-toolbar` |
| Modals | `modal-*` |

## Checklist for New Components

When adding a new component:

- [ ] Add `data-testid` to root container
- [ ] Add `data-testid` to all interactive elements
- [ ] Add `data-testid` to important display elements
- [ ] Follow naming conventions
- [ ] Document in this file if introducing new patterns
- [ ] Update app-specific quick reference table

---

*Last updated: January 9, 2026*
