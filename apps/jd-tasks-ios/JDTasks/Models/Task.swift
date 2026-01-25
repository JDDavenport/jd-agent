import Foundation
import SwiftUI

// MARK: - Task Status (GTD workflow)
enum TaskStatus: String, Codable, CaseIterable {
    case inbox = "inbox"
    case today = "today"
    case upcoming = "upcoming"
    case waiting = "waiting"
    case someday = "someday"
    case done = "done"
    case archived = "archived"

    var displayName: String {
        switch self {
        case .inbox: return "Inbox"
        case .today: return "Today"
        case .upcoming: return "Upcoming"
        case .waiting: return "Waiting"
        case .someday: return "Someday"
        case .done: return "Done"
        case .archived: return "Archived"
        }
    }

    var icon: String {
        switch self {
        case .inbox: return "tray"
        case .today: return "sun.max"
        case .upcoming: return "calendar"
        case .waiting: return "clock"
        case .someday: return "archivebox"
        case .done: return "checkmark.circle"
        case .archived: return "archivebox.fill"
        }
    }
}

// MARK: - Task Source
enum TaskSource: String, Codable {
    case manual = "manual"
    case email = "email"
    case canvas = "canvas"
    case meeting = "meeting"
    case recording = "recording"
    case calendar = "calendar"
    case remarkable = "remarkable"
    case chat = "chat"
    case agent = "agent"
    case acquisition = "acquisition"
    case siri = "siri"
    case plaud = "plaud"
    case nlp = "nlp"
    case unknown = "unknown"

    // Handle unknown source values gracefully
    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        let value = try container.decode(String.self)
        self = TaskSource(rawValue: value) ?? .unknown
    }
}

// MARK: - Energy Level
enum EnergyLevel: String, Codable {
    case high = "high"
    case low = "low"
    case admin = "admin"

    var displayName: String {
        switch self {
        case .high: return "High Energy"
        case .low: return "Low Energy"
        case .admin: return "Admin"
        }
    }
}

// MARK: - Main Task Model
struct JDTask: Identifiable, Codable, Hashable {
    let id: String
    var linearId: String?
    var title: String
    var description: String?
    var status: TaskStatus
    var priority: Int
    var dueDate: Date?
    var dueDateIsHard: Bool
    var scheduledStart: Date?
    var scheduledEnd: Date?
    var source: TaskSource
    var sourceRef: String?
    var context: String
    var taskContexts: [String]?
    var taskLabels: [String]?
    var timeEstimateMinutes: Int?
    var energyLevel: EnergyLevel?
    var blockedBy: String?
    var waitingFor: String?
    var waitingSince: Date?
    var projectId: String?
    var parentTaskId: String?
    var sectionId: String?
    var calendarEventId: String?
    var recurrenceRule: String?
    var recurrenceParentId: String?
    var completedBy: String?
    var vaultEntryId: String?
    var sortOrder: Int?
    var subtaskCount: Int?
    var completedSubtaskCount: Int?
    var createdAt: Date
    var updatedAt: Date
    var completedAt: Date?

    // MARK: - Computed Properties

    var isCompleted: Bool {
        status == .done || status == .archived
    }

    var isOverdue: Bool {
        guard let due = dueDate, !isCompleted else { return false }
        return due < Date()
    }

    var hasSubtasks: Bool {
        (subtaskCount ?? 0) > 0
    }

    var subtaskProgress: String? {
        guard let total = subtaskCount, total > 0 else { return nil }
        let completed = completedSubtaskCount ?? 0
        return "\(completed)/\(total)"
    }

    var priorityColor: Color {
        switch priority {
        case 4: return .red      // P1 - Urgent
        case 3: return .orange   // P2 - High
        case 2: return .yellow   // P3 - Medium
        case 1: return .blue     // P4 - Low
        default: return .gray    // No priority
        }
    }

    var priorityLabel: String? {
        switch priority {
        case 4: return "P1"
        case 3: return "P2"
        case 2: return "P3"
        case 1: return "P4"
        default: return nil
        }
    }

    var isRecurring: Bool {
        recurrenceRule != nil
    }

    var formattedDueDate: String? {
        guard let date = dueDate else { return nil }

        let calendar = Calendar.current
        if calendar.isDateInToday(date) {
            return "Today"
        } else if calendar.isDateInTomorrow(date) {
            return "Tomorrow"
        } else if calendar.isDateInYesterday(date) {
            return "Yesterday"
        } else {
            let formatter = DateFormatter()
            formatter.dateStyle = .medium
            formatter.timeStyle = .none
            return formatter.string(from: date)
        }
    }

    // MARK: - Coding Keys

    enum CodingKeys: String, CodingKey {
        case id
        case linearId
        case title
        case description
        case status
        case priority
        case dueDate
        case dueDateIsHard
        case scheduledStart
        case scheduledEnd
        case source
        case sourceRef
        case context
        case taskContexts
        case taskLabels
        case timeEstimateMinutes
        case energyLevel
        case blockedBy
        case waitingFor
        case waitingSince
        case projectId
        case parentTaskId
        case sectionId
        case calendarEventId
        case recurrenceRule
        case recurrenceParentId
        case completedBy
        case vaultEntryId
        case sortOrder
        case subtaskCount
        case completedSubtaskCount
        case createdAt
        case updatedAt
        case completedAt
    }
}

// MARK: - Create Task Input
struct CreateTaskInput: Codable {
    let title: String
    var description: String?
    var status: TaskStatus?
    var priority: Int?
    var dueDate: String?
    var dueDateIsHard: Bool?
    let source: TaskSource
    var sourceRef: String?
    let context: String
    var taskContexts: [String]?
    var taskLabels: [String]?
    var timeEstimateMinutes: Int?
    var energyLevel: EnergyLevel?
    var waitingFor: String?
    var projectId: String?
    var parentTaskId: String?
    var recurrenceRule: String?
}

// MARK: - Update Task Input
struct UpdateTaskInput: Codable {
    var title: String?
    var description: String?
    var status: TaskStatus?
    var priority: Int?
    var dueDate: String?
    var dueDateIsHard: Bool?
    var context: String?
    var taskContexts: [String]?
    var taskLabels: [String]?
    var timeEstimateMinutes: Int?
    var energyLevel: EnergyLevel?
    var waitingFor: String?
    var projectId: String?
    var parentTaskId: String?
    var recurrenceRule: String?
}

// MARK: - Task Counts
struct TaskCounts: Codable {
    let inbox: Int
    let today: Int
    let upcoming: Int
    let waiting: Int?
    let someday: Int?
    let done: Int?
    let archived: Int?

    // Computed property for overdue (not returned by API)
    var overdue: Int { 0 }
}

// MARK: - Task Filters
struct TaskFilters {
    var status: TaskStatus?
    var context: String?
    var projectId: String?
    var includeCompleted: Bool?
    var dueBefore: Date?
    var dueAfter: Date?
    var limit: Int?
    var offset: Int?
}
