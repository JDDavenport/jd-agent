import SwiftUI

struct ContentView: View {
    @EnvironmentObject var briefingService: BriefingService
    @EnvironmentObject var productivityService: ProductivityService

    var body: some View {
        TabView {
            BriefingView()
                .tabItem {
                    Label("Briefing", systemImage: "newspaper")
                }

            ProductivityView()
                .tabItem {
                    Label("Productivity", systemImage: "chart.bar")
                }

            SettingsView()
                .tabItem {
                    Label("Settings", systemImage: "gear")
                }
        }
    }
}

#Preview {
    ContentView()
        .environmentObject(BriefingService(baseURL: URL(string: "http://localhost:3000")!))
        .environmentObject(ProductivityService(baseURL: URL(string: "http://localhost:3000")!))
}
