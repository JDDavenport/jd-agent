import SwiftUI

struct BriefingView: View {
    @EnvironmentObject var briefingService: BriefingService
    @State private var hasLoaded = false

    var body: some View {
        NavigationStack {
            ScrollView {
                if briefingService.isLoading && briefingService.currentBriefing == nil {
                    loadingView
                } else if let briefing = briefingService.currentBriefing {
                    briefingContent(briefing)
                } else if briefingService.error != nil {
                    errorView
                } else {
                    emptyView
                }
            }
            .navigationTitle("Briefing")
            .refreshable {
                await briefingService.refresh()
            }
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    if briefingService.isLoading {
                        ProgressView()
                    } else {
                        Button(action: {
                            Task { await briefingService.refresh() }
                        }) {
                            Image(systemName: "arrow.clockwise")
                        }
                    }
                }
            }
            .task {
                if !hasLoaded {
                    hasLoaded = true
                    await briefingService.refresh()
                }
            }
        }
    }

    // MARK: - Briefing Content

    private func briefingContent(_ briefing: BriefingResponse) -> some View {
        VStack(alignment: .leading, spacing: 20) {
            // Greeting
            VStack(alignment: .leading, spacing: 4) {
                Text(briefing.greeting)
                    .font(.title)
                    .fontWeight(.bold)

                if let lastRefresh = briefingService.lastRefresh {
                    Text("Updated \(lastRefresh.formatted(.relative(presentation: .named)))")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
            .padding(.horizontal)

            // Summary Card
            summaryCard(briefing.summary)

            // Integration Status
            integrationStatusView(briefing.integrations)

            // Sections
            ForEach(briefing.sections) { section in
                sectionView(section)
            }

            // Sign off
            Text(briefing.signOff)
                .font(.headline)
                .foregroundColor(.secondary)
                .padding(.horizontal)
                .padding(.top, 10)
        }
        .padding(.vertical)
    }

    // MARK: - Summary Card

    private func summaryCard(_ summary: String) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: "sparkles")
                    .foregroundColor(.purple)
                Text("AI Summary")
                    .font(.headline)
            }

            Text(summary)
                .font(.body)
                .foregroundColor(.primary)
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(12)
        .padding(.horizontal)
    }

    // MARK: - Integration Status

    private func integrationStatusView(_ integrations: IntegrationStatusSummary) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Image(systemName: integrations.allHealthy ? "checkmark.shield.fill" : "exclamationmark.shield.fill")
                    .foregroundColor(integrations.allHealthy ? .green : .orange)
                Text("Integrations")
                    .font(.headline)
                Spacer()
                Text(integrations.overall.capitalized)
                    .font(.subheadline)
                    .foregroundColor(integrations.allHealthy ? .green : .orange)
            }

            HStack(spacing: 16) {
                ForEach(integrations.configuredIntegrations, id: \.0) { (name, status) in
                    IntegrationBadgeView(name: name, status: status)
                }
            }
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(12)
        .padding(.horizontal)
    }

    // MARK: - Section View

    private func sectionView(_ section: BriefingSection) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Image(systemName: sectionIcon(section.type))
                    .foregroundColor(sectionColor(section.type))
                Text(section.title)
                    .font(.headline)

                Spacer()

                // Stats badge
                if let count = section.stats["today"] ?? section.stats["eventsToday"] ?? section.stats["dueToday"] {
                    Text("\(count)")
                        .font(.caption)
                        .fontWeight(.semibold)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(sectionColor(section.type).opacity(0.2))
                        .cornerRadius(8)
                }
            }

            if section.items.isEmpty {
                Text("No items")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            } else {
                ForEach(section.items.prefix(5)) { item in
                    BriefingItemRow(item: item)
                }
            }
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(12)
        .padding(.horizontal)
    }

    private func sectionIcon(_ type: String) -> String {
        switch type {
        case "tasks": return "checkmark.circle"
        case "calendar": return "calendar"
        case "canvas": return "book.closed"
        case "recordings": return "waveform"
        case "habits": return "repeat"
        case "goals": return "flag"
        default: return "list.bullet"
        }
    }

    private func sectionColor(_ type: String) -> Color {
        switch type {
        case "tasks": return .blue
        case "calendar": return .orange
        case "canvas": return .purple
        case "recordings": return .pink
        case "habits": return .green
        case "goals": return .yellow
        default: return .gray
        }
    }

    // MARK: - Loading View

    private var loadingView: some View {
        VStack(spacing: 16) {
            ProgressView()
                .scaleEffect(1.5)
            Text("Generating your briefing...")
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(.top, 100)
    }

    // MARK: - Error View

    private var errorView: some View {
        VStack(spacing: 16) {
            Image(systemName: "exclamationmark.triangle")
                .font(.system(size: 50))
                .foregroundColor(.orange)

            Text("Couldn't load briefing")
                .font(.headline)

            if let error = briefingService.error {
                Text(error.localizedDescription)
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
            }

            Button("Try Again") {
                Task { await briefingService.refresh() }
            }
            .buttonStyle(.borderedProminent)
        }
        .padding()
    }

    // MARK: - Empty View

    private var emptyView: some View {
        VStack(spacing: 16) {
            Image(systemName: "newspaper")
                .font(.system(size: 50))
                .foregroundColor(.secondary)

            Text("No briefing yet")
                .font(.headline)

            Text("Pull to refresh to generate your briefing")
                .font(.subheadline)
                .foregroundColor(.secondary)
        }
        .padding()
    }
}

// MARK: - Briefing Item Row

struct BriefingItemRow: View {
    let item: BriefingItem

    var body: some View {
        HStack {
            Circle()
                .fill(priorityColor)
                .frame(width: 8, height: 8)

            VStack(alignment: .leading, spacing: 2) {
                Text(item.title)
                    .font(.subheadline)
                    .lineLimit(1)

                if let subtitle = item.subtitle {
                    Text(subtitle)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }

            Spacer()

            if let dueAt = item.dueAt {
                Text(dueAt.formatted(.dateTime.hour().minute()))
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
        .padding(.vertical, 4)
    }

    private var priorityColor: Color {
        switch item.priority {
        case "high": return .red
        case "medium": return .orange
        case "low": return .gray
        default: return .blue
        }
    }
}

// MARK: - Integration Badge View

struct IntegrationBadgeView: View {
    let name: String
    let status: IntegrationStatus

    var body: some View {
        VStack(spacing: 4) {
            Circle()
                .fill(statusColor)
                .frame(width: 12, height: 12)
            Text(name)
                .font(.caption2)
                .foregroundColor(.secondary)
        }
    }

    private var statusColor: Color {
        switch status.status {
        case "healthy": return .green
        case "degraded": return .orange
        case "down": return .red
        default: return .gray
        }
    }
}

#Preview {
    BriefingView()
        .environmentObject(BriefingService(baseURL: URL(string: "http://localhost:3000")!))
}
