import Foundation

// MARK: - Task Service
@MainActor
class TaskService: ObservableObject {
    private let client: APIClient

    init(baseURL: URL) {
        self.client = APIClient(baseURL: baseURL)
    }

    // MARK: - List Tasks

    /// List tasks with optional filters
    func listTasks(filters: TaskFilters? = nil) async throws -> [JDTask] {
        var params: [String: String] = [:]

        if let status = filters?.status {
            params["status"] = status.rawValue
        }
        if let context = filters?.context {
            params["context"] = context
        }
        if let projectId = filters?.projectId {
            params["projectId"] = projectId
        }
        if let includeCompleted = filters?.includeCompleted {
            params["includeCompleted"] = String(includeCompleted)
        }
        if let dueBefore = filters?.dueBefore {
            params["dueBefore"] = dueBefore.shortDateString
        }
        if let dueAfter = filters?.dueAfter {
            params["dueAfter"] = dueAfter.shortDateString
        }
        if let limit = filters?.limit {
            params["limit"] = String(limit)
        }
        if let offset = filters?.offset {
            params["offset"] = String(offset)
        }

        let response: TaskListResponse = try await client.get("/api/tasks", params: params.isEmpty ? nil : params)
        return response.data
    }

    /// Get inbox tasks
    func getInboxTasks() async throws -> [JDTask] {
        let response: TaskListResponse = try await client.get("/api/tasks/inbox")
        return response.data
    }

    /// Get today's tasks
    func getTodayTasks() async throws -> [JDTask] {
        let response: TaskListResponse = try await client.get("/api/tasks/today")
        return response.data
    }

    /// Get upcoming tasks
    func getUpcomingTasks(days: Int = 7) async throws -> [JDTask] {
        let response: TaskListResponse = try await client.get(
            "/api/tasks/upcoming",
            params: ["days": String(days)]
        )
        return response.data
    }

    /// Get overdue tasks
    func getOverdueTasks() async throws -> [JDTask] {
        let response: TaskListResponse = try await client.get("/api/tasks/overdue")
        return response.data
    }

    /// Get task counts for badges
    func getTaskCounts() async throws -> TaskCounts {
        let response: TaskCountsResponse = try await client.get("/api/tasks/counts")
        return response.data
    }

    // MARK: - Single Task

    /// Get a single task by ID
    func getTask(id: String) async throws -> JDTask {
        let response: TaskResponse = try await client.get("/api/tasks/\(id)")
        return response.data
    }

    // MARK: - Create Task

    /// Create a new task
    func createTask(_ input: CreateTaskInput) async throws -> JDTask {
        let response: TaskResponse = try await client.post("/api/tasks", body: input)
        return response.data
    }

    /// Quick create task with just title (uses defaults)
    func quickCreateTask(title: String, context: String = "personal") async throws -> JDTask {
        let input = CreateTaskInput(
            title: title,
            source: .siri,
            context: context
        )
        return try await createTask(input)
    }

    // MARK: - Update Task

    /// Update an existing task
    func updateTask(id: String, _ input: UpdateTaskInput) async throws -> JDTask {
        let response: TaskResponse = try await client.patch("/api/tasks/\(id)", body: input)
        return response.data
    }

    // MARK: - Complete / Reopen Task

    /// Mark a task as complete
    func completeTask(id: String) async throws -> JDTask {
        let response: TaskResponse = try await client.post("/api/tasks/\(id)/complete", body: EmptyBody())
        return response.data
    }

    /// Reopen a completed task
    func reopenTask(id: String) async throws -> JDTask {
        let response: TaskResponse = try await client.post("/api/tasks/\(id)/reopen", body: EmptyBody())
        return response.data
    }

    // MARK: - Delete Task

    /// Delete a task permanently
    func deleteTask(id: String) async throws {
        try await client.delete("/api/tasks/\(id)")
    }

    // MARK: - Subtasks

    /// Get subtasks for a parent task
    func getSubtasks(parentId: String) async throws -> [JDTask] {
        let response: TaskListResponse = try await client.get("/api/tasks/\(parentId)/subtasks")
        return response.data
    }

    /// Create a subtask under a parent task
    func createSubtask(parentId: String, _ input: CreateTaskInput) async throws -> JDTask {
        let response: TaskResponse = try await client.post("/api/tasks/\(parentId)/subtasks", body: input)
        return response.data
    }

    // MARK: - Scheduling

    /// Schedule a task for a specific time
    func scheduleTask(id: String, startTime: Date, endTime: Date? = nil) async throws -> JDTask {
        struct ScheduleInput: Codable {
            let startTime: String
            let endTime: String?
        }

        let input = ScheduleInput(
            startTime: startTime.iso8601String,
            endTime: endTime?.iso8601String
        )

        let response: TaskResponse = try await client.post("/api/tasks/\(id)/schedule", body: input)
        return response.data
    }

    /// Remove scheduling from a task
    func unscheduleTask(id: String) async throws -> JDTask {
        let response: TaskResponse = try await client.post("/api/tasks/\(id)/unschedule", body: EmptyBody())
        return response.data
    }

    // MARK: - Bulk Operations

    /// Bulk update task statuses
    func bulkUpdateStatus(ids: [String], status: TaskStatus) async throws {
        struct BulkStatusInput: Codable {
            let ids: [String]
            let status: String
        }

        let input = BulkStatusInput(ids: ids, status: status.rawValue)
        let _: APIResponse<String> = try await client.post("/api/tasks/bulk/status", body: input)
    }

    // MARK: - Archive

    /// Archive a task
    func archiveTask(id: String) async throws -> JDTask {
        let response: TaskResponse = try await client.post("/api/tasks/\(id)/archive", body: EmptyBody())
        return response.data
    }
}
