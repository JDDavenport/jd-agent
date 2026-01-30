import Foundation

// MARK: - Screen Time Report
struct ScreenTimeReport: Codable, Identifiable {
    let id: String
    let date: String
    let deviceId: String
    let totalMinutes: Int
    let pickupCount: Int
    let notificationCount: Int
    let categoryBreakdown: [String: Int]
    let topApps: [AppUsage]
    let syncedAt: Date

    var totalHours: Double {
        Double(totalMinutes) / 60.0
    }

    var formattedTime: String {
        let hours = totalMinutes / 60
        let minutes = totalMinutes % 60
        if hours > 0 {
            return "\(hours)h \(minutes)m"
        } else {
            return "\(minutes)m"
        }
    }
}

// MARK: - App Usage
struct AppUsage: Codable, Identifiable {
    var id: String { name }
    let name: String
    let bundleId: String?
    let minutes: Int
    let category: String

    var formattedTime: String {
        let hours = minutes / 60
        let mins = minutes % 60
        if hours > 0 {
            return "\(hours)h \(mins)m"
        } else {
            return "\(mins)m"
        }
    }
}

// MARK: - Productivity Stats
struct ProductivityStats: Codable {
    let today: ScreenTimeReport?
    let weeklyAverage: Int
    let monthlyAverage: Int
    let topApps: [TopAppStat]
    let trends: [TrendPoint]
    let categoryTotals: [String: Int]
    let insights: [String]

    var weeklyAverageFormatted: String {
        formatMinutes(weeklyAverage)
    }

    var monthlyAverageFormatted: String {
        formatMinutes(monthlyAverage)
    }

    private func formatMinutes(_ minutes: Int) -> String {
        let hours = minutes / 60
        let mins = minutes % 60
        if hours > 0 {
            return "\(hours)h \(mins)m"
        } else {
            return "\(mins)m"
        }
    }
}

// MARK: - Top App Stat
struct TopAppStat: Codable, Identifiable {
    var id: String { name }
    let name: String
    let totalMinutes: Int
    let category: String

    var formattedTime: String {
        let hours = totalMinutes / 60
        let mins = totalMinutes % 60
        if hours > 0 {
            return "\(hours)h \(mins)m"
        } else {
            return "\(mins)m"
        }
    }
}

// MARK: - Trend Point
struct TrendPoint: Codable, Identifiable {
    var id: String { date }
    let date: String
    let minutes: Int
}

// MARK: - Daily Comparison
struct DailyComparison: Codable {
    let current: Int
    let previous: Int
    let change: Int
    let changePercent: Int
    let trend: String  // "up", "down", "stable"

    var trendEmoji: String {
        switch trend {
        case "up": return "+"
        case "down": return ""
        default: return ""
        }
    }

    var trendColor: String {
        switch trend {
        case "up": return "red"    // More screen time = bad
        case "down": return "green" // Less screen time = good
        default: return "gray"
        }
    }
}

// MARK: - Screen Time Report Input (for syncing)
struct ScreenTimeReportInput: Codable {
    let date: String
    let deviceId: String
    let totalMinutes: Int
    let pickupCount: Int?
    let notificationCount: Int?
    let categoryBreakdown: [String: Int]?
    let topApps: [AppUsage]?
    let hourlyBreakdown: [HourlyUsage]?
    let sourceVersion: String?
}

// MARK: - Hourly Usage
struct HourlyUsage: Codable {
    let hour: Int
    let minutes: Int
}
