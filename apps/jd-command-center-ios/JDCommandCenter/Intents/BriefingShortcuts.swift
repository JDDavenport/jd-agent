import AppIntents
import SwiftUI

// MARK: - App Shortcuts Provider

struct BriefingShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: GetBriefingIntent(),
            phrases: [
                "Give me my briefing in \(.applicationName)",
                "What's my day look like in \(.applicationName)",
                "Morning briefing in \(.applicationName)",
                "Daily update in \(.applicationName)",
                "Get my briefing from \(.applicationName)",
            ],
            shortTitle: "Daily Briefing",
            systemImageName: "newspaper"
        )

        AppShortcut(
            intent: CheckIntegrationsIntent(),
            phrases: [
                "Check my integrations in \(.applicationName)",
                "Integration status in \(.applicationName)",
                "Are my services working in \(.applicationName)",
            ],
            shortTitle: "Integration Status",
            systemImageName: "checkmark.shield"
        )

        AppShortcut(
            intent: GetProductivityIntent(),
            phrases: [
                "How much screen time did I have in \(.applicationName)",
                "Screen time report in \(.applicationName)",
                "My productivity in \(.applicationName)",
            ],
            shortTitle: "Screen Time",
            systemImageName: "chart.bar"
        )
    }
}

// MARK: - Get Briefing Intent

struct GetBriefingIntent: AppIntent {
    static var title: LocalizedStringResource = "Get Daily Briefing"
    static var description: IntentDescription = "Get a personalized summary of your tasks, calendar, and integrations"
    static var openAppWhenRun: Bool = false

    func perform() async throws -> some IntentResult & ProvidesDialog {
        let service = await MainActor.run { BriefingService(baseURL: AppConfiguration.shared.apiURL) }

        do {
            let briefing = try await service.generateBriefing()

            let response = """
            \(briefing.greeting)

            \(briefing.summary)

            \(briefing.signOff)
            """

            return .result(dialog: IntentDialog(stringLiteral: response))
        } catch {
            return .result(dialog: "Sorry, I couldn't get your briefing right now. Please try again later.")
        }
    }
}

// MARK: - Check Integrations Intent

struct CheckIntegrationsIntent: AppIntent {
    static var title: LocalizedStringResource = "Check Integration Status"
    static var description: IntentDescription = "Check if your integrations are working"
    static var openAppWhenRun: Bool = false

    func perform() async throws -> some IntentResult & ProvidesDialog {
        let service = await MainActor.run { BriefingService(baseURL: AppConfiguration.shared.apiURL) }

        do {
            let status = try await service.getIntegrationStatus()

            var response = "Your integrations are "
            switch status.overall {
            case "healthy":
                response += "all healthy. "
            case "degraded":
                response += "partially working. "
            case "down":
                response += "having issues. "
            default:
                response += "in an unknown state. "
            }

            // Add details for each configured integration
            let integrations = status.configuredIntegrations
            if !integrations.isEmpty {
                let statuses = integrations.map { "\($0.0) is \($0.1.status)" }
                response += statuses.joined(separator: ". ") + "."
            }

            return .result(dialog: IntentDialog(stringLiteral: response))
        } catch {
            return .result(dialog: "Sorry, I couldn't check your integrations right now.")
        }
    }
}

// MARK: - Get Productivity Intent

struct GetProductivityIntent: AppIntent {
    static var title: LocalizedStringResource = "Get Screen Time"
    static var description: IntentDescription = "Get your screen time report"
    static var openAppWhenRun: Bool = false

    func perform() async throws -> some IntentResult & ProvidesDialog {
        let service = await MainActor.run { ProductivityService(baseURL: AppConfiguration.shared.apiURL) }

        do {
            let stats = try await service.getStats(days: 7)

            var response = ""

            if let today = stats.today {
                response += "Today you've had \(today.formattedTime) of screen time with \(today.pickupCount) pickups. "
            }

            response += "Your weekly average is \(stats.weeklyAverageFormatted). "

            if let comparison = try? await service.getComparison() {
                if comparison.trend == "down" {
                    response += "That's \(abs(comparison.change)) minutes less than yesterday. Nice job!"
                } else if comparison.trend == "up" {
                    response += "That's \(comparison.change) minutes more than yesterday."
                }
            }

            if !stats.insights.isEmpty {
                response += " \(stats.insights.first ?? "")"
            }

            return .result(dialog: IntentDialog(stringLiteral: response))
        } catch {
            return .result(dialog: "Sorry, I couldn't get your screen time data right now.")
        }
    }
}
