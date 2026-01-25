import SwiftUI

struct ContentView: View {
    @StateObject private var taskService: TaskService
    @State private var selectedTab: Tab = .today
    @State private var showingQuickAdd = false
    @State private var taskCounts: TaskCounts?
    @State private var isLoadingCounts = false
    @State private var refreshTrigger = UUID()

    enum Tab: String, CaseIterable {
        case inbox = "Inbox"
        case today = "Today"
        case upcoming = "Upcoming"
        case settings = "Settings"
    }

    init() {
        let service = AppConfiguration.shared.createTaskService()
        _taskService = StateObject(wrappedValue: service)
    }

    var body: some View {
        ZStack {
            TabView(selection: $selectedTab) {
                InboxView(refreshTrigger: $refreshTrigger)
                    .tabItem {
                        Label("Inbox", systemImage: "tray")
                    }
                    .tag(Tab.inbox)
                    .badge(taskCounts?.inbox ?? 0)

                TodayView(refreshTrigger: $refreshTrigger)
                    .tabItem {
                        Label("Today", systemImage: "sun.max")
                    }
                    .tag(Tab.today)
                    .badge(taskCounts?.overdue ?? 0)

                UpcomingView(refreshTrigger: $refreshTrigger)
                    .tabItem {
                        Label("Upcoming", systemImage: "calendar")
                    }
                    .tag(Tab.upcoming)

                SettingsView()
                    .tabItem {
                        Label("Settings", systemImage: "gear")
                    }
                    .tag(Tab.settings)
            }
            .environmentObject(taskService)

            // Floating Quick Add Button
            VStack {
                Spacer()
                HStack {
                    Spacer()
                    QuickAddButton {
                        showingQuickAdd = true
                    }
                    .padding(.trailing, 20)
                    .padding(.bottom, 80)
                }
            }
        }
        .sheet(isPresented: $showingQuickAdd, onDismiss: {
            refreshTrigger = UUID()
            Task { await loadCounts() }
        }) {
            QuickAddView()
                .environmentObject(taskService)
        }
        .task {
            await loadCounts()
        }
        .refreshable {
            await loadCounts()
        }
    }

    private func loadCounts() async {
        guard !isLoadingCounts else { return }
        isLoadingCounts = true
        defer { isLoadingCounts = false }

        do {
            taskCounts = try await taskService.getTaskCounts()
        } catch {
            print("Failed to load task counts: \(error)")
        }
    }
}

// MARK: - Quick Add Button
struct QuickAddButton: View {
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: "plus")
                .font(.title2.bold())
                .foregroundStyle(.white)
                .frame(width: 56, height: 56)
                .background(
                    Circle()
                        .fill(Color.accentColor)
                        .shadow(color: .black.opacity(0.2), radius: 4, x: 0, y: 2)
                )
        }
        .accessibilityLabel("Add new task")
    }
}

// MARK: - Preview
#Preview {
    ContentView()
}
