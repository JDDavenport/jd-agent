import Foundation

// MARK: - Briefing Response
struct BriefingResponse: Codable {
    let generatedAt: Date
    let greeting: String
    let summary: String
    let sections: [BriefingSection]
    let integrations: IntegrationStatusSummary
    let signOff: String
}

// MARK: - Briefing Section
struct BriefingSection: Codable, Identifiable {
    var id: String { type }
    let type: String
    let title: String
    let items: [BriefingItem]
    let stats: [String: Int]
}

// MARK: - Briefing Item
struct BriefingItem: Codable, Identifiable {
    let id: String
    let title: String
    let subtitle: String?
    let priority: String?
    let type: String
    let dueAt: Date?
    let metadata: [String: AnyCodable]?
}

// MARK: - Integration Status
struct IntegrationStatus: Codable {
    let status: String  // "healthy", "degraded", "down", "not_configured"
    let lastSync: Date?
    let pendingItems: Int
    let errorMessage: String?

    var statusColor: String {
        switch status {
        case "healthy": return "green"
        case "degraded": return "yellow"
        case "down": return "red"
        default: return "gray"
        }
    }

    var isHealthy: Bool { status == "healthy" }
    var isConfigured: Bool { status != "not_configured" }
}

// MARK: - Integration Status Summary
struct IntegrationStatusSummary: Codable {
    let overall: String  // "healthy", "degraded", "down"
    let plaud: IntegrationStatus
    let remarkable: IntegrationStatus
    let canvas: IntegrationStatus
    let googleCalendar: IntegrationStatus

    var allHealthy: Bool { overall == "healthy" }

    var configuredIntegrations: [(String, IntegrationStatus)] {
        [
            ("Plaud", plaud),
            ("Remarkable", remarkable),
            ("Canvas", canvas),
            ("Calendar", googleCalendar),
        ].filter { $0.1.isConfigured }
    }
}

// MARK: - Preview Data
struct BriefingPreview: Codable {
    let tasksToday: Int
    let eventsToday: Int
    let canvasDue: Int
    let newRecordings: Int
    let integrationsHealthy: Bool
}

// MARK: - AnyCodable for flexible metadata
struct AnyCodable: Codable {
    let value: Any

    init(_ value: Any) {
        self.value = value
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let intValue = try? container.decode(Int.self) {
            value = intValue
        } else if let doubleValue = try? container.decode(Double.self) {
            value = doubleValue
        } else if let stringValue = try? container.decode(String.self) {
            value = stringValue
        } else if let boolValue = try? container.decode(Bool.self) {
            value = boolValue
        } else {
            value = ""
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        if let intValue = value as? Int {
            try container.encode(intValue)
        } else if let doubleValue = value as? Double {
            try container.encode(doubleValue)
        } else if let stringValue = value as? String {
            try container.encode(stringValue)
        } else if let boolValue = value as? Bool {
            try container.encode(boolValue)
        }
    }
}
