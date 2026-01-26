import SwiftUI

@main
struct JDVaultApp: App {
    @StateObject private var appState = AppState()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(appState)
        }
    }
}

// MARK: - App State
@MainActor
class AppState: ObservableObject {
    @Published var isOnline: Bool = true
    @Published var isLoading: Bool = false
    @Published var errorMessage: String?

    private let apiClient = APIClient.shared

    init() {
        checkConnectivity()
    }

    func checkConnectivity() {
        Task {
            do {
                _ = try await apiClient.healthCheck()
                isOnline = true
            } catch {
                isOnline = false
            }
        }
    }

    func showError(_ message: String) {
        errorMessage = message
        DispatchQueue.main.asyncAfter(deadline: .now() + 3) {
            self.errorMessage = nil
        }
    }
}
