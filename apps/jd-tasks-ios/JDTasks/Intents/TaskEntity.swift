import AppIntents
import Foundation

// MARK: - Task Entity for Siri
struct TaskEntity: AppEntity {
    static var typeDisplayRepresentation: TypeDisplayRepresentation = "Task"
    static var defaultQuery = TaskEntityQuery()

    var id: String
    var title: String
    var status: TaskStatus
    var dueDate: Date?
    var priority: Int

    var displayRepresentation: DisplayRepresentation {
        var subtitle = status.displayName
        if let due = dueDate {
            let formatter = DateFormatter()
            formatter.dateStyle = .short
            subtitle += " - Due: \(formatter.string(from: due))"
        }
        return DisplayRepresentation(
            title: "\(title)",
            subtitle: "\(subtitle)"
        )
    }

    init(id: String, title: String, status: TaskStatus, dueDate: Date? = nil, priority: Int = 0) {
        self.id = id
        self.title = title
        self.status = status
        self.dueDate = dueDate
        self.priority = priority
    }

    init(from task: JDTask) {
        self.id = task.id
        self.title = task.title
        self.status = task.status
        self.dueDate = task.dueDate
        self.priority = task.priority
    }
}

// MARK: - Task Entity Query
struct TaskEntityQuery: EntityQuery {
    @MainActor
    func entities(for identifiers: [String]) async throws -> [TaskEntity] {
        let service = AppConfiguration.shared.createTaskService()
        var results: [TaskEntity] = []

        for id in identifiers {
            if let task = try? await service.getTask(id: id) {
                results.append(TaskEntity(from: task))
            }
        }

        return results
    }

    @MainActor
    func suggestedEntities() async throws -> [TaskEntity] {
        let service = AppConfiguration.shared.createTaskService()

        do {
            let tasks = try await service.getTodayTasks()
            return tasks.prefix(10).map { TaskEntity(from: $0) }
        } catch {
            return []
        }
    }
}

// MARK: - Task Entity String Query (for natural language)
struct TaskEntityStringQuery: EntityStringQuery {
    @MainActor
    func entities(for identifiers: [String]) async throws -> [TaskEntity] {
        let service = AppConfiguration.shared.createTaskService()
        var results: [TaskEntity] = []

        for id in identifiers {
            if let task = try? await service.getTask(id: id) {
                results.append(TaskEntity(from: task))
            }
        }

        return results
    }

    @MainActor
    func entities(matching string: String) async throws -> [TaskEntity] {
        let service = AppConfiguration.shared.createTaskService()

        do {
            // Get all incomplete tasks and filter by title
            let allTasks = try await service.listTasks(filters: TaskFilters(includeCompleted: false))
            let searchLower = string.lowercased()

            let matching = allTasks.filter { task in
                task.title.lowercased().contains(searchLower)
            }

            return matching.prefix(10).map { TaskEntity(from: $0) }
        } catch {
            return []
        }
    }

    @MainActor
    func suggestedEntities() async throws -> [TaskEntity] {
        let service = AppConfiguration.shared.createTaskService()

        do {
            let tasks = try await service.getTodayTasks()
            return tasks.prefix(10).map { TaskEntity(from: $0) }
        } catch {
            return []
        }
    }
}
