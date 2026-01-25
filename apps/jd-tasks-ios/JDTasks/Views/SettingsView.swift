import SwiftUI

struct SettingsView: View {
    @State private var config = AppConfiguration.shared
    @State private var serverURL: String = ""
    @State private var isTestingConnection = false
    @State private var connectionStatus: ConnectionStatus = .unknown
    @State private var selectedContext: String = ""

    enum ConnectionStatus {
        case unknown, checking, connected, failed(String)

        var icon: String {
            switch self {
            case .unknown: return ""
            case .checking: return ""
            case .connected: return "checkmark.circle.fill"
            case .failed: return "xmark.circle.fill"
            }
        }

        var color: Color {
            switch self {
            case .unknown: return .clear
            case .checking: return .clear
            case .connected: return .green
            case .failed: return .red
            }
        }
    }

    var body: some View {
        NavigationStack {
            Form {
                // Server Configuration
                Section {
                    TextField("Server URL", text: $serverURL)
                        .textContentType(.URL)
                        .autocorrectionDisabled()
                        .textInputAutocapitalization(.never)
                        .keyboardType(.URL)

                    HStack {
                        Button("Test Connection") {
                            testConnection()
                        }
                        .disabled(isTestingConnection || serverURL.isEmpty)

                        Spacer()

                        switch connectionStatus {
                        case .unknown:
                            EmptyView()
                        case .checking:
                            ProgressView()
                                .scaleEffect(0.8)
                        case .connected:
                            Image(systemName: "checkmark.circle.fill")
                                .foregroundStyle(.green)
                        case .failed(let message):
                            HStack {
                                Image(systemName: "xmark.circle.fill")
                                    .foregroundStyle(.red)
                                Text(message)
                                    .font(.caption)
                                    .foregroundStyle(.red)
                            }
                        }
                    }

                    if serverURL != config.apiBaseURLString {
                        Button("Save Server URL") {
                            config.apiBaseURLString = serverURL
                            connectionStatus = .unknown
                        }
                        .foregroundStyle(.blue)
                    }
                } header: {
                    Text("Server")
                } footer: {
                    Text("Enter the URL of your JD Agent Hub server. Default: http://localhost:3000")
                }

                // Task Defaults
                Section {
                    Picker("Default Context", selection: $selectedContext) {
                        ForEach(config.availableContexts, id: \.self) { context in
                            Text(context.capitalized).tag(context)
                        }
                    }
                    .onChange(of: selectedContext) { newValue in
                        config.defaultContext = newValue
                    }
                } header: {
                    Text("Task Defaults")
                } footer: {
                    Text("Tasks created via Siri or Quick Add will use this context by default.")
                }

                // Siri & Shortcuts
                Section {
                    NavigationLink {
                        SiriSetupView()
                    } label: {
                        HStack {
                            Image(systemName: "mic.fill")
                                .foregroundStyle(.blue)
                            Text("Siri Setup")
                        }
                    }

                    NavigationLink {
                        ShortcutsGuideView()
                    } label: {
                        HStack {
                            Image(systemName: "square.on.square")
                                .foregroundStyle(.purple)
                            Text("Shortcuts Guide")
                        }
                    }
                } header: {
                    Text("Siri & Shortcuts")
                }

                // About
                Section {
                    LabeledContent("Version", value: "1.0.0")
                    LabeledContent("Build", value: "1")

                    Link(destination: URL(string: "https://github.com/jddavenport/jd-agent")!) {
                        HStack {
                            Text("GitHub Repository")
                            Spacer()
                            Image(systemName: "arrow.up.right.square")
                                .foregroundStyle(.secondary)
                        }
                    }
                } header: {
                    Text("About")
                }

                // Debug (only in DEBUG builds)
                #if DEBUG
                Section("Debug") {
                    Button("Reset All Settings") {
                        UserDefaults.standard.removePersistentDomain(
                            forName: Bundle.main.bundleIdentifier!
                        )
                        serverURL = "http://localhost:3000"
                        selectedContext = "personal"
                        connectionStatus = .unknown
                    }
                    .foregroundStyle(.red)
                }
                #endif
            }
            .navigationTitle("Settings")
            .onAppear {
                serverURL = config.apiBaseURLString
                selectedContext = config.defaultContext
            }
        }
    }

    private func testConnection() {
        connectionStatus = .checking
        isTestingConnection = true

        Task {
            defer { isTestingConnection = false }

            guard let url = URL(string: serverURL) else {
                connectionStatus = .failed("Invalid URL")
                return
            }

            let service = TaskService(baseURL: url)

            do {
                _ = try await service.getTaskCounts()
                connectionStatus = .connected
            } catch {
                connectionStatus = .failed("Failed")
            }
        }
    }
}

// MARK: - Siri Setup View
struct SiriSetupView: View {
    var body: some View {
        List {
            Section {
                Text("Say these phrases to Siri to interact with your tasks. Make sure to say \"in JD Tasks\" or just \"in Tasks\" at the end.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }

            Section("Adding Tasks") {
                SiriPhraseRow(
                    phrase: "Add buy milk to my tasks",
                    description: "Creates a new task in your inbox"
                )
                SiriPhraseRow(
                    phrase: "Add call mom tomorrow p1",
                    description: "Creates a task with due date and priority"
                )
                SiriPhraseRow(
                    phrase: "Remember to submit report",
                    description: "Another way to add a task"
                )
            }

            Section("Viewing Tasks") {
                SiriPhraseRow(
                    phrase: "What are my tasks today?",
                    description: "Lists your tasks for today"
                )
                SiriPhraseRow(
                    phrase: "What's in my inbox?",
                    description: "Shows inbox tasks"
                )
                SiriPhraseRow(
                    phrase: "What tasks are overdue?",
                    description: "Lists overdue tasks"
                )
                SiriPhraseRow(
                    phrase: "How many tasks do I have?",
                    description: "Gives you a summary"
                )
            }

            Section("Completing Tasks") {
                SiriPhraseRow(
                    phrase: "Complete buy milk",
                    description: "Marks the task as done"
                )
                SiriPhraseRow(
                    phrase: "Mark report as done",
                    description: "Alternative completion phrase"
                )
            }

            Section {
                Text("Tip: You can also find and use these shortcuts in the Shortcuts app.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .navigationTitle("Siri Setup")
    }
}

struct SiriPhraseRow: View {
    let phrase: String
    let description: String

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Image(systemName: "mic.fill")
                    .foregroundStyle(.blue)
                    .font(.caption)
                Text("\"\(phrase)\"")
                    .italic()
            }
            Text(description)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding(.vertical, 4)
    }
}

// MARK: - Shortcuts Guide View
struct ShortcutsGuideView: View {
    var body: some View {
        List {
            Section {
                Text("JD Tasks integrates with the Shortcuts app for powerful automations.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }

            Section("Available Actions") {
                ShortcutActionRow(
                    icon: "plus.circle",
                    color: .green,
                    title: "Add Task",
                    description: "Create a new task with title, due date, and priority"
                )
                ShortcutActionRow(
                    icon: "checkmark.circle",
                    color: .blue,
                    title: "Complete Task",
                    description: "Mark a specific task as complete"
                )
                ShortcutActionRow(
                    icon: "sun.max",
                    color: .orange,
                    title: "Show Today's Tasks",
                    description: "Get a list of today's tasks"
                )
                ShortcutActionRow(
                    icon: "tray",
                    color: .gray,
                    title: "Show Inbox",
                    description: "View inbox tasks"
                )
                ShortcutActionRow(
                    icon: "exclamationmark.circle",
                    color: .red,
                    title: "Show Overdue",
                    description: "List overdue tasks"
                )
                ShortcutActionRow(
                    icon: "chart.bar",
                    color: .purple,
                    title: "Task Summary",
                    description: "Get counts of tasks by status"
                )
            }

            Section("Example Automations") {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Morning Briefing")
                        .font(.headline)
                    Text("Run \"Show Today's Tasks\" when you first unlock your phone in the morning.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                VStack(alignment: .leading, spacing: 8) {
                    Text("Quick Capture")
                        .font(.headline)
                    Text("Add a task from the Share Sheet or a widget tap.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                VStack(alignment: .leading, spacing: 8) {
                    Text("Focus Mode Task Review")
                        .font(.headline)
                    Text("Get task counts when entering Work focus mode.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .navigationTitle("Shortcuts Guide")
    }
}

struct ShortcutActionRow: View {
    let icon: String
    let color: Color
    let title: String
    let description: String

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .foregroundStyle(color)
                .frame(width: 24)

            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.subheadline.weight(.medium))
                Text(description)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 4)
    }
}

// MARK: - Preview
#Preview {
    SettingsView()
}
