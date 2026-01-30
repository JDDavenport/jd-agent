import SwiftUI

struct SettingsView: View {
    @StateObject private var config = AppConfiguration.shared
    @State private var serverURL: String = ""
    @State private var showingServerTest = false
    @State private var serverTestResult: ServerTestResult?

    var body: some View {
        NavigationStack {
            Form {
                // Server Configuration
                Section("Server") {
                    TextField("API URL", text: $serverURL)
                        .keyboardType(.URL)
                        .autocapitalization(.none)
                        .autocorrectionDisabled()
                        .onAppear {
                            serverURL = config.apiBaseURLString
                        }
                        .onChange(of: serverURL) { newValue in
                            config.apiBaseURLString = newValue
                        }

                    Button(action: testConnection) {
                        HStack {
                            Text("Test Connection")
                            Spacer()
                            if showingServerTest {
                                ProgressView()
                            } else if let result = serverTestResult {
                                Image(systemName: result.success ? "checkmark.circle.fill" : "xmark.circle.fill")
                                    .foregroundColor(result.success ? .green : .red)
                            }
                        }
                    }

                    if let result = serverTestResult, !result.success {
                        Text(result.message)
                            .font(.caption)
                            .foregroundColor(.red)
                    }
                }

                // Device Info
                Section("Device") {
                    HStack {
                        Text("Device ID")
                        Spacer()
                        Text(config.deviceId)
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }

                // Preferences
                Section("Preferences") {
                    Toggle("Haptic Feedback", isOn: Binding(
                        get: { config.hapticsEnabled },
                        set: { config.hapticsEnabled = $0 }
                    ))

                    Toggle("Detailed Integration Status", isOn: Binding(
                        get: { config.showDetailedIntegrations },
                        set: { config.showDetailedIntegrations = $0 }
                    ))
                }

                // Screen Time
                Section("Screen Time") {
                    HStack {
                        Text("Authorization")
                        Spacer()
                        Text(config.screenTimeAuthorized ? "Granted" : "Not Granted")
                            .foregroundColor(config.screenTimeAuthorized ? .green : .secondary)
                    }

                    if let lastSync = config.lastScreenTimeSync {
                        HStack {
                            Text("Last Sync")
                            Spacer()
                            Text(lastSync.formatted(.relative(presentation: .named)))
                                .foregroundColor(.secondary)
                        }
                    }

                    Button("Open Screen Time Settings") {
                        if let url = URL(string: UIApplication.openSettingsURLString) {
                            UIApplication.shared.open(url)
                        }
                    }
                }

                // Siri
                Section("Siri") {
                    HStack {
                        Text("Setup Complete")
                        Spacer()
                        Text(config.siriSetupComplete ? "Yes" : "No")
                            .foregroundColor(config.siriSetupComplete ? .green : .secondary)
                    }

                    Button("Set Up Siri Shortcuts") {
                        // Would open Siri setup flow
                        config.siriSetupComplete = true
                    }
                }

                // About
                Section("About") {
                    HStack {
                        Text("Version")
                        Spacer()
                        Text("1.0.0")
                            .foregroundColor(.secondary)
                    }

                    HStack {
                        Text("Build")
                        Spacer()
                        Text("1")
                            .foregroundColor(.secondary)
                    }
                }
            }
            .navigationTitle("Settings")
        }
    }

    // MARK: - Test Connection

    private func testConnection() {
        showingServerTest = true
        serverTestResult = nil

        Task {
            do {
                let url = URL(string: serverURL)?.appendingPathComponent("api/health")
                guard let url = url else {
                    await MainActor.run {
                        serverTestResult = ServerTestResult(success: false, message: "Invalid URL")
                        showingServerTest = false
                    }
                    return
                }

                let (_, response) = try await URLSession.shared.data(from: url)

                await MainActor.run {
                    if let httpResponse = response as? HTTPURLResponse,
                       httpResponse.statusCode == 200 {
                        serverTestResult = ServerTestResult(success: true, message: "Connected!")
                    } else {
                        serverTestResult = ServerTestResult(success: false, message: "Server returned error")
                    }
                    showingServerTest = false
                }
            } catch {
                await MainActor.run {
                    serverTestResult = ServerTestResult(success: false, message: error.localizedDescription)
                    showingServerTest = false
                }
            }
        }
    }
}

// MARK: - Server Test Result

struct ServerTestResult {
    let success: Bool
    let message: String
}

#Preview {
    SettingsView()
}
