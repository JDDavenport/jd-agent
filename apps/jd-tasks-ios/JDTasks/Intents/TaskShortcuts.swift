import AppIntents

// MARK: - App Shortcuts Provider
/// Makes intents available in Shortcuts app and enables Siri phrases
struct TaskShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        // Add Task - simpler phrases without parameter interpolation
        AppShortcut(
            intent: AddTaskIntent(),
            phrases: [
                "Add a task in \(.applicationName)",
                "Create a task in \(.applicationName)",
                "New task in \(.applicationName)"
            ],
            shortTitle: "Add Task",
            systemImageName: "plus.circle"
        )

        // Show Today's Tasks
        AppShortcut(
            intent: ListTodayTasksIntent(),
            phrases: [
                "What are my tasks today in \(.applicationName)",
                "Show today's tasks in \(.applicationName)",
                "What do I need to do today in \(.applicationName)",
                "My tasks for today in \(.applicationName)",
                "Today's tasks in \(.applicationName)"
            ],
            shortTitle: "Today's Tasks",
            systemImageName: "sun.max"
        )

        // Show Inbox
        AppShortcut(
            intent: ListInboxIntent(),
            phrases: [
                "What's in my inbox in \(.applicationName)",
                "Show inbox in \(.applicationName)",
                "My inbox in \(.applicationName)",
                "Check inbox in \(.applicationName)"
            ],
            shortTitle: "Show Inbox",
            systemImageName: "tray"
        )

        // Complete Task - uses TaskEntity which is an AppEntity
        AppShortcut(
            intent: CompleteTaskIntent(),
            phrases: [
                "Complete a task in \(.applicationName)",
                "Mark a task as done in \(.applicationName)",
                "Finish a task in \(.applicationName)"
            ],
            shortTitle: "Complete Task",
            systemImageName: "checkmark.circle"
        )

        // Show Overdue
        AppShortcut(
            intent: ListOverdueTasksIntent(),
            phrases: [
                "What tasks are overdue in \(.applicationName)",
                "Show overdue tasks in \(.applicationName)",
                "Overdue tasks in \(.applicationName)"
            ],
            shortTitle: "Overdue Tasks",
            systemImageName: "exclamationmark.circle"
        )

        // Task Summary
        AppShortcut(
            intent: GetTaskCountsIntent(),
            phrases: [
                "How many tasks do I have in \(.applicationName)",
                "Task summary in \(.applicationName)",
                "Task counts in \(.applicationName)"
            ],
            shortTitle: "Task Summary",
            systemImageName: "chart.bar"
        )
    }
}
