import Foundation
import SwiftUI

// MARK: - App Configuration
class AppConfiguration: ObservableObject {
    static let shared = AppConfiguration()

    private let defaults = UserDefaults.standard

    // MARK: - API Configuration

    /// API Base URL - configurable in settings
    var apiBaseURLString: String {
        get { defaults.string(forKey: "apiBaseURL") ?? "http://192.168.1.175:3000" }
        set { defaults.set(newValue, forKey: "apiBaseURL") }
    }

    /// Computed API URL
    var apiURL: URL {
        URL(string: apiBaseURLString) ?? URL(string: "http://192.168.1.175:3000")!
    }

    // MARK: - Task Defaults

    /// Default context for new tasks
    var defaultContext: String {
        get { defaults.string(forKey: "defaultContext") ?? "personal" }
        set { defaults.set(newValue, forKey: "defaultContext") }
    }

    /// Default source for tasks created in the app
    var defaultSource: TaskSource {
        .manual
    }

    // MARK: - UI Preferences

    /// Show completed tasks in lists
    var showCompletedTasks: Bool {
        get { defaults.bool(forKey: "showCompletedTasks") }
        set { defaults.set(newValue, forKey: "showCompletedTasks") }
    }

    /// Enable haptic feedback
    var hapticsEnabled: Bool {
        get { defaults.bool(forKey: "hapticsEnabled") }
        set { defaults.set(newValue, forKey: "hapticsEnabled") }
    }

    // MARK: - Siri Configuration

    /// Siri has been set up
    var siriSetupComplete: Bool {
        get { defaults.bool(forKey: "siriSetupComplete") }
        set { defaults.set(newValue, forKey: "siriSetupComplete") }
    }

    // MARK: - Available Contexts

    var availableContexts: [String] {
        ["personal", "work", "school", "health", "mba"]
    }

    // MARK: - Initialization

    private init() {
        // Migrate from localhost to network IP if needed
        if let stored = defaults.string(forKey: "apiBaseURL"),
           stored.contains("localhost") {
            defaults.removeObject(forKey: "apiBaseURL")
        }
    }

    // MARK: - Create Services

    @MainActor
    func createTaskService() -> TaskService {
        TaskService(baseURL: apiURL)
    }
}

// MARK: - Shared Task Service
extension AppConfiguration {
    @MainActor
    static var taskService: TaskService {
        shared.createTaskService()
    }
}
