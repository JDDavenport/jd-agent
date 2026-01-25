import AppIntents
import SwiftUI

// MARK: - List Today's Tasks Intent
/// "Hey Siri, what are my tasks today?"
struct ListTodayTasksIntent: AppIntent {
    static var title: LocalizedStringResource = "Show Today's Tasks"
    static var description = IntentDescription("List your tasks for today")
    static var openAppWhenRun: Bool = false

    @MainActor
    func perform() async throws -> some IntentResult & ProvidesDialog & ShowsSnippetView {
        let service = AppConfiguration.shared.createTaskService()

        do {
            let tasks = try await service.getTodayTasks()
            let incompleteTasks = tasks.filter { !$0.isCompleted }

            if incompleteTasks.isEmpty {
                return .result(
                    dialog: "You have no tasks for today. Nice work!",
                    view: EmptyTasksSnippetView(message: "No tasks for today")
                )
            }

            let count = incompleteTasks.count
            let taskWord = count == 1 ? "task" : "tasks"
            let dialogText: String

            if count <= 3 {
                let titles = incompleteTasks.map { $0.title }.joined(separator: ", ")
                dialogText = "You have \(count) \(taskWord) today: \(titles)"
            } else {
                let first = incompleteTasks.prefix(3).map { $0.title }.joined(separator: ", ")
                dialogText = "You have \(count) \(taskWord) today. Here are the first few: \(first)"
            }

            return .result(
                dialog: IntentDialog(stringLiteral: dialogText),
                view: TaskListSnippetView(title: "Today's Tasks", tasks: Array(incompleteTasks.prefix(5)))
            )
        } catch {
            return .result(
                dialog: "I couldn't fetch your tasks. Please check your connection.",
                view: ErrorSnippetView(message: error.localizedDescription)
            )
        }
    }
}

// MARK: - List Inbox Intent
/// "Hey Siri, what's in my inbox?"
struct ListInboxIntent: AppIntent {
    static var title: LocalizedStringResource = "Show Inbox"
    static var description = IntentDescription("List tasks in your inbox")
    static var openAppWhenRun: Bool = false

    @MainActor
    func perform() async throws -> some IntentResult & ProvidesDialog & ShowsSnippetView {
        let service = AppConfiguration.shared.createTaskService()

        do {
            let tasks = try await service.getInboxTasks()

            if tasks.isEmpty {
                return .result(
                    dialog: "Your inbox is empty. Inbox zero!",
                    view: EmptyTasksSnippetView(message: "Inbox is empty")
                )
            }

            let count = tasks.count
            let taskWord = count == 1 ? "item" : "items"

            return .result(
                dialog: "You have \(count) \(taskWord) in your inbox.",
                view: TaskListSnippetView(title: "Inbox", tasks: Array(tasks.prefix(5)))
            )
        } catch {
            return .result(
                dialog: "I couldn't check your inbox. Please try again.",
                view: ErrorSnippetView(message: error.localizedDescription)
            )
        }
    }
}

// MARK: - List Overdue Tasks Intent
/// "Hey Siri, what tasks are overdue?"
struct ListOverdueTasksIntent: AppIntent {
    static var title: LocalizedStringResource = "Show Overdue Tasks"
    static var description = IntentDescription("List your overdue tasks")
    static var openAppWhenRun: Bool = false

    @MainActor
    func perform() async throws -> some IntentResult & ProvidesDialog & ShowsSnippetView {
        let service = AppConfiguration.shared.createTaskService()

        do {
            let tasks = try await service.getOverdueTasks()

            if tasks.isEmpty {
                return .result(
                    dialog: "You have no overdue tasks. Great job staying on top of things!",
                    view: EmptyTasksSnippetView(message: "No overdue tasks")
                )
            }

            let count = tasks.count
            let taskWord = count == 1 ? "task" : "tasks"

            return .result(
                dialog: "You have \(count) overdue \(taskWord).",
                view: TaskListSnippetView(title: "Overdue", tasks: Array(tasks.prefix(5)))
            )
        } catch {
            return .result(
                dialog: "I couldn't check for overdue tasks.",
                view: ErrorSnippetView(message: error.localizedDescription)
            )
        }
    }
}

// MARK: - Get Task Counts Intent
/// "Hey Siri, how many tasks do I have?"
struct GetTaskCountsIntent: AppIntent {
    static var title: LocalizedStringResource = "Task Summary"
    static var description = IntentDescription("Get a summary of your task counts")
    static var openAppWhenRun: Bool = false

    @MainActor
    func perform() async throws -> some IntentResult & ProvidesDialog & ShowsSnippetView {
        let service = AppConfiguration.shared.createTaskService()

        do {
            let counts = try await service.getTaskCounts()

            var parts: [String] = []
            if counts.overdue > 0 {
                parts.append("\(counts.overdue) overdue")
            }
            parts.append("\(counts.today) for today")
            parts.append("\(counts.upcoming) upcoming")
            parts.append("\(counts.inbox) in inbox")

            let summary = parts.joined(separator: ", ")

            return .result(
                dialog: "You have \(summary).",
                view: TaskCountsSnippetView(counts: counts)
            )
        } catch {
            return .result(
                dialog: "I couldn't get your task counts.",
                view: ErrorSnippetView(message: error.localizedDescription)
            )
        }
    }
}

// MARK: - Snippet Views

struct TaskListSnippetView: View {
    let title: String
    let tasks: [JDTask]

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.headline)

            ForEach(tasks) { task in
                HStack(spacing: 8) {
                    Image(systemName: task.isCompleted ? "checkmark.circle.fill" : "circle")
                        .foregroundStyle(task.isCompleted ? .green : .gray)
                        .font(.caption)

                    Text(task.title)
                        .font(.subheadline)
                        .lineLimit(1)

                    Spacer()

                    if task.isOverdue {
                        Image(systemName: "exclamationmark.circle.fill")
                            .foregroundStyle(.red)
                            .font(.caption)
                    }
                }
            }

            if tasks.count < 5 {
                // Show "all tasks shown"
            } else {
                Text("+ more...")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding()
    }
}

struct EmptyTasksSnippetView: View {
    let message: String

    var body: some View {
        VStack(spacing: 8) {
            Image(systemName: "checkmark.circle.fill")
                .font(.largeTitle)
                .foregroundStyle(.green)
            Text(message)
                .font(.headline)
        }
        .padding()
    }
}

struct TaskCountsSnippetView: View {
    let counts: TaskCounts

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Task Summary")
                .font(.headline)

            HStack(spacing: 16) {
                CountBadge(count: counts.overdue, label: "Overdue", color: .red)
                CountBadge(count: counts.today, label: "Today", color: .orange)
                CountBadge(count: counts.upcoming, label: "Upcoming", color: .blue)
                CountBadge(count: counts.inbox, label: "Inbox", color: .gray)
            }
        }
        .padding()
    }
}

struct CountBadge: View {
    let count: Int
    let label: String
    let color: Color

    var body: some View {
        VStack(spacing: 4) {
            Text("\(count)")
                .font(.title2.bold())
                .foregroundStyle(color)
            Text(label)
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
    }
}
