import SwiftUI

@main
struct JDCommandCenterApp: App {
    @StateObject private var briefingService = BriefingService(baseURL: AppConfiguration.shared.apiURL)
    @StateObject private var productivityService = ProductivityService(baseURL: AppConfiguration.shared.apiURL)

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(briefingService)
                .environmentObject(productivityService)
        }
    }
}
