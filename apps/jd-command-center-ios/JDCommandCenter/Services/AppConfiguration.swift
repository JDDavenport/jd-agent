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

    // MARK: - Device Identification

    /// Unique device identifier for Screen Time tracking
    var deviceId: String {
        if let stored = defaults.string(forKey: "deviceId") {
            return stored
        }
        let newId = "iphone-\(UUID().uuidString.prefix(8).lowercased())"
        defaults.set(newId, forKey: "deviceId")
        return newId
    }

    // MARK: - UI Preferences

    /// Enable haptic feedback
    var hapticsEnabled: Bool {
        get { defaults.bool(forKey: "hapticsEnabled") }
        set { defaults.set(newValue, forKey: "hapticsEnabled") }
    }

    /// Show detailed integration status
    var showDetailedIntegrations: Bool {
        get { defaults.bool(forKey: "showDetailedIntegrations") }
        set { defaults.set(newValue, forKey: "showDetailedIntegrations") }
    }

    // MARK: - Siri Configuration

    /// Siri has been set up
    var siriSetupComplete: Bool {
        get { defaults.bool(forKey: "siriSetupComplete") }
        set { defaults.set(newValue, forKey: "siriSetupComplete") }
    }

    // MARK: - Screen Time Tracking

    /// Screen Time authorization granted
    var screenTimeAuthorized: Bool {
        get { defaults.bool(forKey: "screenTimeAuthorized") }
        set { defaults.set(newValue, forKey: "screenTimeAuthorized") }
    }

    /// Last Screen Time sync date
    var lastScreenTimeSync: Date? {
        get { defaults.object(forKey: "lastScreenTimeSync") as? Date }
        set { defaults.set(newValue, forKey: "lastScreenTimeSync") }
    }

    // MARK: - Initialization

    private init() {
        // Migrate from localhost to network IP if needed
        if let stored = defaults.string(forKey: "apiBaseURL"),
           stored.contains("localhost") {
            defaults.removeObject(forKey: "apiBaseURL")
        }

        // Initialize haptics to true by default
        if defaults.object(forKey: "hapticsEnabled") == nil {
            defaults.set(true, forKey: "hapticsEnabled")
        }
    }

    // MARK: - Create Services

    @MainActor
    func createBriefingService() -> BriefingService {
        BriefingService(baseURL: apiURL)
    }

    @MainActor
    func createProductivityService() -> ProductivityService {
        ProductivityService(baseURL: apiURL)
    }
}
