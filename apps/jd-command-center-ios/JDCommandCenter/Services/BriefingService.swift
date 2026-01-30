import Foundation
import SwiftUI

// MARK: - Briefing Service
@MainActor
class BriefingService: ObservableObject {
    private let client: APIClient

    @Published var currentBriefing: BriefingResponse?
    @Published var isLoading = false
    @Published var error: Error?
    @Published var lastRefresh: Date?

    init(baseURL: URL) {
        self.client = APIClient(baseURL: baseURL)
    }

    // MARK: - Generate Briefing

    /// Fetch a fresh on-demand briefing
    func generateBriefing() async throws -> BriefingResponse {
        isLoading = true
        error = nil

        do {
            let response: APIResponse<BriefingResponse> = try await client.get("/api/briefing")

            guard let briefing = response.data else {
                throw APIError.noData
            }

            currentBriefing = briefing
            lastRefresh = Date()
            isLoading = false
            return briefing
        } catch {
            self.error = error
            isLoading = false
            throw error
        }
    }

    /// Refresh the current briefing
    func refresh() async {
        do {
            _ = try await generateBriefing()
        } catch {
            print("Briefing refresh failed: \(error.localizedDescription)")
        }
    }

    // MARK: - Preview

    /// Get quick preview data for widgets
    func getPreview() async throws -> BriefingPreview {
        let response: APIResponse<BriefingPreview> = try await client.get("/api/briefing/preview")

        guard let preview = response.data else {
            throw APIError.noData
        }

        return preview
    }

    // MARK: - Integration Status

    /// Get integration status only
    func getIntegrationStatus() async throws -> IntegrationStatusSummary {
        let response: APIResponse<IntegrationStatusSummary> = try await client.get("/api/briefing/integrations")

        guard let status = response.data else {
            throw APIError.noData
        }

        return status
    }
}
