import SwiftUI
import AppIntents

@main
struct JDTasksApp: App {
    init() {
        // Register app shortcuts on launch
        TaskShortcuts.updateAppShortcutParameters()
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}
