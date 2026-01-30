import SwiftUI

struct ProductivityView: View {
    @EnvironmentObject var productivityService: ProductivityService
    @State private var hasLoaded = false
    @State private var showingManualEntry = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 20) {
                    if productivityService.isLoading && productivityService.stats == nil {
                        loadingView
                    } else if let stats = productivityService.stats {
                        statsContent(stats)
                    } else if productivityService.error != nil {
                        errorView
                    } else {
                        emptyView
                    }
                }
                .padding(.vertical)
            }
            .navigationTitle("Productivity")
            .refreshable {
                await productivityService.refreshAll()
            }
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    if productivityService.isLoading {
                        ProgressView()
                    } else {
                        Button(action: {
                            Task { await productivityService.refreshAll() }
                        }) {
                            Image(systemName: "arrow.clockwise")
                        }
                    }
                }
            }
            .task {
                if !hasLoaded {
                    hasLoaded = true
                    await productivityService.refreshAll()
                }
            }
        }
    }

    // MARK: - Stats Content

    private func statsContent(_ stats: ProductivityStats) -> some View {
        VStack(spacing: 20) {
            // Today's Summary Card
            todaySummaryCard(stats)

            // Comparison Card
            if let comparison = productivityService.comparison {
                comparisonCard(comparison)
            }

            // Insights
            if !stats.insights.isEmpty {
                insightsCard(stats.insights)
            }

            // Top Apps
            if !stats.topApps.isEmpty {
                topAppsCard(stats.topApps)
            }

            // Category Breakdown
            if !stats.categoryTotals.isEmpty {
                categoryCard(stats.categoryTotals)
            }

            // Weekly Trend
            if !stats.trends.isEmpty {
                trendsCard(stats.trends)
            }

            // Screen Time Note
            screenTimeNote
        }
    }

    // MARK: - Today's Summary

    private func todaySummaryCard(_ stats: ProductivityStats) -> some View {
        VStack(spacing: 12) {
            HStack {
                Image(systemName: "iphone")
                    .font(.title2)
                    .foregroundColor(.blue)
                Text("Today")
                    .font(.headline)
                Spacer()
            }

            if let today = stats.today {
                HStack(spacing: 30) {
                    statItem(value: today.formattedTime, label: "Screen Time")
                    statItem(value: "\(today.pickupCount)", label: "Pickups")
                    statItem(value: "\(today.notificationCount)", label: "Notifications")
                }
            } else {
                Text("No data for today yet")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            }

            Divider()

            HStack(spacing: 30) {
                VStack {
                    Text(stats.weeklyAverageFormatted)
                        .font(.title3)
                        .fontWeight(.semibold)
                    Text("Weekly Avg")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }

                VStack {
                    Text(stats.monthlyAverageFormatted)
                        .font(.title3)
                        .fontWeight(.semibold)
                    Text("Monthly Avg")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(12)
        .padding(.horizontal)
    }

    private func statItem(value: String, label: String) -> some View {
        VStack {
            Text(value)
                .font(.title2)
                .fontWeight(.bold)
            Text(label)
                .font(.caption)
                .foregroundColor(.secondary)
        }
    }

    // MARK: - Comparison Card

    private func comparisonCard(_ comparison: DailyComparison) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text("vs Yesterday")
                    .font(.headline)

                HStack {
                    Image(systemName: comparison.trend == "up" ? "arrow.up.right" : comparison.trend == "down" ? "arrow.down.right" : "minus")
                        .foregroundColor(trendColor(comparison.trend))

                    Text("\(comparison.trendEmoji)\(abs(comparison.change)) min")
                        .font(.title3)
                        .fontWeight(.semibold)
                        .foregroundColor(trendColor(comparison.trend))

                    Text("(\(comparison.changePercent)%)")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }
            }
            Spacer()
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(12)
        .padding(.horizontal)
    }

    private func trendColor(_ trend: String) -> Color {
        switch trend {
        case "up": return .red      // More screen time = bad
        case "down": return .green  // Less screen time = good
        default: return .gray
        }
    }

    // MARK: - Insights Card

    private func insightsCard(_ insights: [String]) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Image(systemName: "lightbulb.fill")
                    .foregroundColor(.yellow)
                Text("Insights")
                    .font(.headline)
            }

            ForEach(insights, id: \.self) { insight in
                HStack(alignment: .top) {
                    Image(systemName: "arrow.right.circle.fill")
                        .foregroundColor(.blue)
                        .font(.caption)
                    Text(insight)
                        .font(.subheadline)
                }
            }
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(12)
        .padding(.horizontal)
    }

    // MARK: - Top Apps Card

    private func topAppsCard(_ apps: [TopAppStat]) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Image(systemName: "app.badge.fill")
                    .foregroundColor(.purple)
                Text("Top Apps")
                    .font(.headline)
                Spacer()
            }

            ForEach(apps.prefix(5)) { app in
                HStack {
                    Text(app.name)
                        .font(.subheadline)
                    Spacer()
                    Text(app.formattedTime)
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                    Text(app.category)
                        .font(.caption)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 2)
                        .background(categoryColor(app.category).opacity(0.2))
                        .cornerRadius(4)
                }
            }
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(12)
        .padding(.horizontal)
    }

    // MARK: - Category Card

    private func categoryCard(_ categories: [String: Int]) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Image(systemName: "chart.pie.fill")
                    .foregroundColor(.orange)
                Text("Categories")
                    .font(.headline)
                Spacer()
            }

            let sortedCategories = categories.sorted { $0.value > $1.value }

            ForEach(sortedCategories.prefix(5), id: \.key) { category, minutes in
                HStack {
                    Circle()
                        .fill(categoryColor(category))
                        .frame(width: 10, height: 10)
                    Text(category.capitalized)
                        .font(.subheadline)
                    Spacer()
                    Text(formatMinutes(minutes))
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }
            }
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(12)
        .padding(.horizontal)
    }

    private func categoryColor(_ category: String) -> Color {
        switch category.lowercased() {
        case "social": return .blue
        case "entertainment": return .purple
        case "productivity": return .green
        case "gaming": return .red
        case "reading": return .orange
        case "health": return .pink
        default: return .gray
        }
    }

    private func formatMinutes(_ minutes: Int) -> String {
        let hours = minutes / 60
        let mins = minutes % 60
        if hours > 0 {
            return "\(hours)h \(mins)m"
        } else {
            return "\(mins)m"
        }
    }

    // MARK: - Trends Card

    private func trendsCard(_ trends: [TrendPoint]) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Image(systemName: "chart.line.uptrend.xyaxis")
                    .foregroundColor(.green)
                Text("Last 7 Days")
                    .font(.headline)
                Spacer()
            }

            // Simple bar chart
            HStack(alignment: .bottom, spacing: 4) {
                ForEach(trends.suffix(7)) { point in
                    VStack {
                        RoundedRectangle(cornerRadius: 4)
                            .fill(Color.blue)
                            .frame(width: 30, height: barHeight(point.minutes, max: maxMinutes(trends)))

                        Text(dayLabel(point.date))
                            .font(.caption2)
                            .foregroundColor(.secondary)
                    }
                }
            }
            .frame(height: 120)
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(12)
        .padding(.horizontal)
    }

    private func barHeight(_ minutes: Int, max: Int) -> CGFloat {
        guard max > 0 else { return 0 }
        return CGFloat(minutes) / CGFloat(max) * 80
    }

    private func maxMinutes(_ trends: [TrendPoint]) -> Int {
        trends.map(\.minutes).max() ?? 1
    }

    private func dayLabel(_ dateString: String) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        guard let date = formatter.date(from: dateString) else { return "" }

        let dayFormatter = DateFormatter()
        dayFormatter.dateFormat = "EEE"
        return String(dayFormatter.string(from: date).prefix(1))
    }

    // MARK: - Screen Time Note

    private var screenTimeNote: some View {
        VStack(spacing: 8) {
            Image(systemName: "info.circle")
                .foregroundColor(.blue)

            Text("Screen Time data requires iOS authorization")
                .font(.caption)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)

            Text("Go to Settings > Screen Time to enable sharing")
                .font(.caption2)
                .foregroundColor(.secondary)
        }
        .padding()
    }

    // MARK: - Loading View

    private var loadingView: some View {
        VStack(spacing: 16) {
            ProgressView()
                .scaleEffect(1.5)
            Text("Loading productivity data...")
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 100)
    }

    // MARK: - Error View

    private var errorView: some View {
        VStack(spacing: 16) {
            Image(systemName: "exclamationmark.triangle")
                .font(.system(size: 50))
                .foregroundColor(.orange)

            Text("Couldn't load productivity data")
                .font(.headline)

            if let error = productivityService.error {
                Text(error.localizedDescription)
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
            }

            Button("Try Again") {
                Task { await productivityService.refreshAll() }
            }
            .buttonStyle(.borderedProminent)
        }
        .padding()
    }

    // MARK: - Empty View

    private var emptyView: some View {
        VStack(spacing: 16) {
            Image(systemName: "chart.bar")
                .font(.system(size: 50))
                .foregroundColor(.secondary)

            Text("No productivity data yet")
                .font(.headline)

            Text("Screen Time data will appear here once synced")
                .font(.subheadline)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
        }
        .padding()
    }
}

#Preview {
    ProductivityView()
        .environmentObject(ProductivityService(baseURL: URL(string: "http://localhost:3000")!))
}
