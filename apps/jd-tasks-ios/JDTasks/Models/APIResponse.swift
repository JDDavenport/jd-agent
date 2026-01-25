import Foundation

// MARK: - Generic API Response
struct APIResponse<T: Codable>: Codable {
    let success: Bool
    let data: T?
    let message: String?
    let count: Int?
}

// MARK: - Task List Response
struct TaskListResponse: Codable {
    let success: Bool
    let data: [JDTask]
    let count: Int?
}

// MARK: - Single Task Response
struct TaskResponse: Codable {
    let success: Bool
    let data: JDTask
    let message: String?
}

// MARK: - Task Counts Response
struct TaskCountsResponse: Codable {
    let success: Bool
    let data: TaskCounts
}

// MARK: - Error Response
struct ErrorResponse: Codable {
    let success: Bool
    let message: String?
    let error: String?
}
