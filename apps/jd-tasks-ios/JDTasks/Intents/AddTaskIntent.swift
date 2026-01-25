import AppIntents
import SwiftUI

// MARK: - Add Task Intent
/// "Hey Siri, add [task] to my tasks"
struct AddTaskIntent: AppIntent {
    static var title: LocalizedStringResource = "Add Task"
    static var description = IntentDescription("Add a new task to your task list")
    static var openAppWhenRun: Bool = false

    @Parameter(title: "Task Title", description: "What needs to be done?")
    var taskTitle: String

    @Parameter(title: "Due Date", description: "When is this task due?")
    var dueDate: Date?

    @Parameter(title: "Priority", description: "Task priority (1 = highest, 4 = lowest)")
    var priority: Int?

    // Siri dialog configuration
    static var parameterSummary: some ParameterSummary {
        Summary("Add \(\.$taskTitle) to my tasks") {
            \.$dueDate
            \.$priority
        }
    }

    @MainActor
    func perform() async throws -> some IntentResult & ProvidesDialog & ShowsSnippetView {
        let service = AppConfiguration.shared.createTaskService()

        // Parse natural language from the title
        let parsed = NaturalLanguageParser.parse(taskTitle)

        // Determine final values (explicit params override parsed)
        let finalDueDate = dueDate ?? parsed.dueDate
        let finalPriority: Int
        if let explicitPriority = priority {
            // Convert user priority (1-4) to internal (4-1)
            finalPriority = 5 - explicitPriority
        } else {
            finalPriority = parsed.priority ?? 0
        }

        let input = CreateTaskInput(
            title: parsed.title,
            description: nil,
            status: .inbox,
            priority: finalPriority,
            dueDate: finalDueDate?.iso8601String,
            source: .siri,
            context: AppConfiguration.shared.defaultContext,
            taskContexts: parsed.contexts,
            taskLabels: parsed.labels,
            timeEstimateMinutes: parsed.timeEstimate
        )

        do {
            let task = try await service.createTask(input)

            return .result(
                dialog: "Added '\(task.title)' to your tasks",
                view: TaskCreatedSnippetView(task: task)
            )
        } catch {
            return .result(
                dialog: "Sorry, I couldn't add that task. Please try again.",
                view: ErrorSnippetView(message: error.localizedDescription)
            )
        }
    }
}

// MARK: - Snippet Views

struct TaskCreatedSnippetView: View {
    let task: JDTask

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: "checkmark.circle.fill")
                    .foregroundStyle(.green)
                Text("Task Added")
                    .font(.headline)
            }

            Text(task.title)
                .font(.body)

            HStack(spacing: 12) {
                if let dueDate = task.dueDate {
                    HStack(spacing: 4) {
                        Image(systemName: "calendar")
                        Text(dueDate, style: .date)
                    }
                    .font(.caption)
                    .foregroundStyle(.secondary)
                }

                if task.priority > 0 {
                    HStack(spacing: 4) {
                        Image(systemName: "flag.fill")
                        Text("P\(5 - task.priority)")
                    }
                    .font(.caption)
                    .foregroundStyle(priorityColor(task.priority))
                }
            }
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func priorityColor(_ priority: Int) -> Color {
        switch priority {
        case 4: return .red
        case 3: return .orange
        case 2: return .yellow
        default: return .blue
        }
    }
}

struct ErrorSnippetView: View {
    let message: String

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: "exclamationmark.circle.fill")
                    .foregroundStyle(.red)
                Text("Error")
                    .font(.headline)
            }
            Text(message)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding()
    }
}
