import AppIntents
import SwiftUI

// MARK: - Complete Task Intent
/// "Hey Siri, complete [task name]"
struct CompleteTaskIntent: AppIntent {
    static var title: LocalizedStringResource = "Complete Task"
    static var description = IntentDescription("Mark a task as complete")
    static var openAppWhenRun: Bool = false

    @Parameter(title: "Task", description: "The task to complete")
    var task: TaskEntity

    static var parameterSummary: some ParameterSummary {
        Summary("Complete \(\.$task)")
    }

    @MainActor
    func perform() async throws -> some IntentResult & ProvidesDialog {
        let service = AppConfiguration.shared.createTaskService()

        do {
            let completedTask = try await service.completeTask(id: task.id)
            return .result(dialog: "Done! Marked '\(completedTask.title)' as complete.")
        } catch {
            return .result(dialog: "I couldn't complete that task. It might already be done or doesn't exist.")
        }
    }
}

// MARK: - Reopen Task Intent
/// "Hey Siri, reopen [task name]"
struct ReopenTaskIntent: AppIntent {
    static var title: LocalizedStringResource = "Reopen Task"
    static var description = IntentDescription("Reopen a completed task")
    static var openAppWhenRun: Bool = false

    @Parameter(title: "Task", description: "The task to reopen")
    var task: TaskEntity

    static var parameterSummary: some ParameterSummary {
        Summary("Reopen \(\.$task)")
    }

    @MainActor
    func perform() async throws -> some IntentResult & ProvidesDialog {
        let service = AppConfiguration.shared.createTaskService()

        do {
            let reopenedTask = try await service.reopenTask(id: task.id)
            return .result(dialog: "Reopened '\(reopenedTask.title)'.")
        } catch {
            return .result(dialog: "I couldn't reopen that task.")
        }
    }
}
