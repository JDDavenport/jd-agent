import Foundation

// MARK: - Parsed Task Result
struct ParsedTask {
    var title: String
    var dueDate: Date?
    var priority: Int?
    var contexts: [String]?
    var labels: [String]?
    var timeEstimate: Int?
    var recurrence: String?

    init(
        title: String,
        dueDate: Date? = nil,
        priority: Int? = nil,
        contexts: [String]? = nil,
        labels: [String]? = nil,
        timeEstimate: Int? = nil,
        recurrence: String? = nil
    ) {
        self.title = title
        self.dueDate = dueDate
        self.priority = priority
        self.contexts = contexts
        self.labels = labels
        self.timeEstimate = timeEstimate
        self.recurrence = recurrence
    }
}

// MARK: - Natural Language Parser
class NaturalLanguageParser {

    // MARK: - Date Keywords

    private static let dateKeywords: [String: () -> Date] = [
        "today": { Date() },
        "tod": { Date() },
        "tomorrow": { Calendar.current.date(byAdding: .day, value: 1, to: Date())! },
        "tom": { Calendar.current.date(byAdding: .day, value: 1, to: Date())! },
        "tmrw": { Calendar.current.date(byAdding: .day, value: 1, to: Date())! },
        "tmr": { Calendar.current.date(byAdding: .day, value: 1, to: Date())! },
        "next week": { Calendar.current.date(byAdding: .weekOfYear, value: 1, to: Date())! },
        "next month": { Calendar.current.date(byAdding: .month, value: 1, to: Date())! },
    ]

    private static let weekdays: [(name: String, weekday: Int)] = [
        ("sunday", 1), ("sun", 1),
        ("monday", 2), ("mon", 2),
        ("tuesday", 3), ("tue", 3), ("tues", 3),
        ("wednesday", 4), ("wed", 4),
        ("thursday", 5), ("thu", 5), ("thurs", 5),
        ("friday", 6), ("fri", 6),
        ("saturday", 7), ("sat", 7),
    ]

    // MARK: - Parse Method

    static func parse(_ input: String) -> ParsedTask {
        var text = input.trimmingCharacters(in: .whitespaces)
        var result = ParsedTask(title: "")

        // Extract priority (p1, p2, p3, p4 or !!, !!!, etc)
        result.priority = extractPriority(&text)

        // Extract @contexts
        result.contexts = extractContexts(&text)

        // Extract #labels
        result.labels = extractLabels(&text)

        // Extract time estimates (~30m, ~1h, ~2hr)
        result.timeEstimate = extractTimeEstimate(&text)

        // Extract due date from keywords and day names
        result.dueDate = extractDate(&text)

        // Clean up the title
        result.title = cleanupTitle(text)

        return result
    }

    // MARK: - Extraction Methods

    private static func extractPriority(_ text: inout String) -> Int? {
        // Match p1, p2, p3, p4 (case insensitive)
        if let range = text.range(of: #"\bp([1-4])\b"#, options: [.regularExpression, .caseInsensitive]) {
            let match = String(text[range])
            let priorityChar = match.dropFirst()
            if let p = Int(priorityChar) {
                text.removeSubrange(range)
                // Convert p1=4 (urgent), p2=3, p3=2, p4=1
                return 5 - p
            }
        }

        // Match exclamation marks (!! = high, !!! = urgent)
        if let range = text.range(of: #"!{2,4}"#, options: .regularExpression) {
            let exclamations = text[range].count
            text.removeSubrange(range)
            switch exclamations {
            case 4: return 4 // Urgent
            case 3: return 3 // High
            case 2: return 2 // Medium
            default: return nil
            }
        }

        return nil
    }

    private static func extractContexts(_ text: inout String) -> [String]? {
        let pattern = #"@(\w+)"#
        guard let regex = try? NSRegularExpression(pattern: pattern) else { return nil }

        let nsRange = NSRange(text.startIndex..., in: text)
        let matches = regex.matches(in: text, range: nsRange)

        guard !matches.isEmpty else { return nil }

        var contexts: [String] = []
        for match in matches.reversed() {
            if let contextRange = Range(match.range(at: 1), in: text) {
                contexts.insert(String(text[contextRange]), at: 0)
            }
            if let fullRange = Range(match.range, in: text) {
                text.removeSubrange(fullRange)
            }
        }

        return contexts.isEmpty ? nil : contexts
    }

    private static func extractLabels(_ text: inout String) -> [String]? {
        let pattern = #"#(\w+)"#
        guard let regex = try? NSRegularExpression(pattern: pattern) else { return nil }

        let nsRange = NSRange(text.startIndex..., in: text)
        let matches = regex.matches(in: text, range: nsRange)

        guard !matches.isEmpty else { return nil }

        var labels: [String] = []
        for match in matches.reversed() {
            if let labelRange = Range(match.range(at: 1), in: text) {
                labels.insert(String(text[labelRange]), at: 0)
            }
            if let fullRange = Range(match.range, in: text) {
                text.removeSubrange(fullRange)
            }
        }

        return labels.isEmpty ? nil : labels
    }

    private static func extractTimeEstimate(_ text: inout String) -> Int? {
        // Match ~30m, ~30min, ~30 min, ~1h, ~1hr, ~1 hour
        let patterns = [
            (#"~(\d+)\s*m(?:in(?:ute)?s?)?\b"#, { (m: Int) in m }),
            (#"~(\d+)\s*h(?:r|our)?s?\b"#, { (h: Int) in h * 60 }),
        ]

        for (pattern, converter) in patterns {
            if let range = text.range(of: pattern, options: [.regularExpression, .caseInsensitive]) {
                let match = String(text[range])
                // Extract the number
                let digits = match.filter { $0.isNumber }
                if let value = Int(digits) {
                    text.removeSubrange(range)
                    return converter(value)
                }
            }
        }

        return nil
    }

    private static func extractDate(_ text: inout String) -> Date? {
        let lowercased = text.lowercased()

        // Check date keywords first
        for (keyword, dateFunc) in dateKeywords {
            if let range = lowercased.range(of: "\\b\(keyword)\\b", options: .regularExpression) {
                let originalRange = text.index(text.startIndex, offsetBy: lowercased.distance(from: lowercased.startIndex, to: range.lowerBound))
                    ..< text.index(text.startIndex, offsetBy: lowercased.distance(from: lowercased.startIndex, to: range.upperBound))
                text.removeSubrange(originalRange)
                return dateFunc()
            }
        }

        // Check weekday names
        for (name, weekday) in weekdays {
            if let range = lowercased.range(of: "\\b\(name)\\b", options: .regularExpression) {
                let originalRange = text.index(text.startIndex, offsetBy: lowercased.distance(from: lowercased.startIndex, to: range.lowerBound))
                    ..< text.index(text.startIndex, offsetBy: lowercased.distance(from: lowercased.startIndex, to: range.upperBound))
                text.removeSubrange(originalRange)
                return nextWeekday(weekday)
            }
        }

        // Check for "in X days/weeks"
        if let range = text.range(of: #"in\s+(\d+)\s*(day|week|month)s?"#, options: [.regularExpression, .caseInsensitive]) {
            let match = String(text[range]).lowercased()

            // Extract number and unit
            if let numberRange = match.range(of: #"\d+"#, options: .regularExpression),
               let number = Int(match[numberRange]) {

                var component: Calendar.Component = .day
                if match.contains("week") {
                    component = .weekOfYear
                } else if match.contains("month") {
                    component = .month
                }

                text.removeSubrange(range)
                return Calendar.current.date(byAdding: component, value: number, to: Date())
            }
        }

        return nil
    }

    private static func nextWeekday(_ targetWeekday: Int) -> Date {
        let calendar = Calendar.current
        let today = Date()
        let todayWeekday = calendar.component(.weekday, from: today)

        var daysToAdd = targetWeekday - todayWeekday
        if daysToAdd <= 0 {
            daysToAdd += 7
        }

        return calendar.date(byAdding: .day, value: daysToAdd, to: today) ?? today
    }

    private static func cleanupTitle(_ text: String) -> String {
        // Replace multiple spaces with single space
        var cleaned = text.replacingOccurrences(
            of: #"\s+"#,
            with: " ",
            options: .regularExpression
        )

        // Trim whitespace
        cleaned = cleaned.trimmingCharacters(in: .whitespaces)

        // Capitalize first letter if all lowercase
        if !cleaned.isEmpty && cleaned == cleaned.lowercased() {
            cleaned = cleaned.prefix(1).uppercased() + cleaned.dropFirst()
        }

        return cleaned
    }
}

// MARK: - Preview Helpers
extension ParsedTask {
    var hasParsedData: Bool {
        dueDate != nil || priority != nil || contexts != nil || labels != nil || timeEstimate != nil
    }

    var formattedDueDate: String? {
        guard let date = dueDate else { return nil }

        let calendar = Calendar.current
        if calendar.isDateInToday(date) {
            return "Today"
        } else if calendar.isDateInTomorrow(date) {
            return "Tomorrow"
        } else {
            let formatter = DateFormatter()
            formatter.dateStyle = .medium
            return formatter.string(from: date)
        }
    }

    var formattedTimeEstimate: String? {
        guard let minutes = timeEstimate else { return nil }

        if minutes >= 60 {
            let hours = minutes / 60
            let remaining = minutes % 60
            if remaining > 0 {
                return "\(hours)h \(remaining)m"
            }
            return "\(hours)h"
        }
        return "\(minutes)m"
    }

    var priorityLabel: String? {
        guard let p = priority else { return nil }
        return "P\(5 - p)"
    }
}
