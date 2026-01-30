import Foundation
import SwiftUI

// MARK: - Productivity Service
@MainActor
class ProductivityService: ObservableObject {
    private let client: APIClient

    @Published var todayReport: ScreenTimeReport?
    @Published var stats: ProductivityStats?
    @Published var comparison: DailyComparison?
    @Published var isLoading = false
    @Published var error: Error?

    init(baseURL: URL) {
        self.client = APIClient(baseURL: baseURL)
    }

    // MARK: - Sync Report

    /// Sync a Screen Time report to the Hub
    func syncReport(_ report: ScreenTimeReportInput) async throws -> ScreenTimeReport {
        let response: APIResponse<ScreenTimeReport> = try await client.post("/api/productivity/sync", body: report)

        guard let syncedReport = response.data else {
            throw APIError.noData
        }

        // Update local state if it's today's report
        let today = ISO8601DateFormatter().string(from: Date()).prefix(10)
        if report.date == String(today) {
            todayReport = syncedReport
        }

        return syncedReport
    }

    // MARK: - Get Today's Report

    /// Get today's Screen Time report
    func getToday() async throws -> ScreenTimeReport? {
        isLoading = true
        error = nil

        do {
            let params = ["deviceId": AppConfiguration.shared.deviceId]
            let response: APIResponse<ScreenTimeReport?> = try await client.get("/api/productivity/today", params: params)

            todayReport = response.data ?? nil
            isLoading = false
            return todayReport
        } catch {
            self.error = error
            isLoading = false
            throw error
        }
    }

    // MARK: - Get Stats

    /// Get productivity statistics with trends
    func getStats(days: Int = 30) async throws -> ProductivityStats {
        isLoading = true
        error = nil

        do {
            let params = [
                "deviceId": AppConfiguration.shared.deviceId,
                "days": String(days),
            ]
            let response: APIResponse<ProductivityStats> = try await client.get("/api/productivity/stats", params: params)

            guard let stats = response.data else {
                throw APIError.noData
            }

            self.stats = stats
            isLoading = false
            return stats
        } catch {
            self.error = error
            isLoading = false
            throw error
        }
    }

    // MARK: - Get Comparison

    /// Get today vs yesterday comparison
    func getComparison() async throws -> DailyComparison {
        let params = ["deviceId": AppConfiguration.shared.deviceId]
        let response: APIResponse<DailyComparison> = try await client.get("/api/productivity/comparison", params: params)

        guard let comparison = response.data else {
            throw APIError.noData
        }

        self.comparison = comparison
        return comparison
    }

    // MARK: - Get History

    /// Get historical reports for a date range
    func getHistory(startDate: String, endDate: String) async throws -> [ScreenTimeReport] {
        let params = [
            "deviceId": AppConfiguration.shared.deviceId,
            "startDate": startDate,
            "endDate": endDate,
        ]
        let response: APIResponse<[ScreenTimeReport]> = try await client.get("/api/productivity/history", params: params)

        return response.data ?? []
    }

    // MARK: - Refresh All

    /// Refresh all productivity data
    func refreshAll() async {
        do {
            async let todayTask = getToday()
            async let statsTask = getStats()
            async let comparisonTask = getComparison()

            _ = try await (todayTask, statsTask, comparisonTask)
        } catch {
            print("Productivity refresh failed: \(error.localizedDescription)")
        }
    }
}
