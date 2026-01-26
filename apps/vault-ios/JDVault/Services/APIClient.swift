import Foundation

// MARK: - API Errors
enum APIError: LocalizedError {
    case invalidURL
    case networkError(Error)
    case decodingError(Error)
    case serverError(Int, String?)
    case unknown

    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Invalid URL"
        case .networkError(let error):
            return "Network error: \(error.localizedDescription)"
        case .decodingError(let error):
            return "Failed to decode response: \(error.localizedDescription)"
        case .serverError(let code, let message):
            return "Server error (\(code)): \(message ?? "Unknown")"
        case .unknown:
            return "An unknown error occurred"
        }
    }
}

// MARK: - API Response Wrapper
struct APIResponse<T: Decodable>: Decodable {
    let data: T?
    let error: String?
}

// MARK: - API Client
@MainActor
class APIClient {
    static let shared = APIClient()

    // Configure this to your Hub's IP address
    // For Simulator: use localhost (shares network with host)
    // For Physical Device: use the Mac's network IP
    #if targetEnvironment(simulator)
    private let baseURL = "http://localhost:3000"
    #else
    private let baseURL = "http://10.34.144.203:3000"
    #endif

    private let session: URLSession
    private let decoder: JSONDecoder
    private let encoder: JSONEncoder

    private init() {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 30
        config.timeoutIntervalForResource = 60
        session = URLSession(configuration: config)

        decoder = JSONDecoder()
        encoder = JSONEncoder()
    }

    // MARK: - Health Check
    func healthCheck() async throws -> Bool {
        // Just verify we can reach the server - don't try to decode the complex response
        guard let url = URL(string: baseURL + "/api/health") else {
            throw APIError.invalidURL
        }

        let (_, response) = try await session.data(from: url)

        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw APIError.unknown
        }

        return true
    }

    // MARK: - Pages
    func listPages(archived: Bool = false) async throws -> [VaultPage] {
        let path = archived ? "/api/vault/pages?archived=true" : "/api/vault/pages"
        return try await get(path)
    }

    func getPageTree(archived: Bool = false) async throws -> [VaultPageTreeNode] {
        let path = archived ? "/api/vault/pages/tree?archived=true" : "/api/vault/pages/tree"
        return try await get(path)
    }

    func getFavorites() async throws -> [VaultPage] {
        return try await get("/api/vault/pages/favorites")
    }

    func getPage(id: String) async throws -> VaultPage {
        return try await get("/api/vault/pages/\(id)")
    }

    func createPage(input: CreatePageInput) async throws -> VaultPage {
        return try await post("/api/vault/pages", body: input)
    }

    func updatePage(id: String, input: UpdatePageInput) async throws -> VaultPage {
        return try await patch("/api/vault/pages/\(id)", body: input)
    }

    func deletePage(id: String) async throws {
        let _: EmptyResponse = try await delete("/api/vault/pages/\(id)")
    }

    func toggleFavorite(id: String) async throws -> VaultPage {
        return try await post("/api/vault/pages/\(id)/favorite", body: EmptyBody())
    }

    func searchPages(query: String, limit: Int = 20) async throws -> [VaultPage] {
        let encoded = query.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? query
        return try await get("/api/vault/pages/quick-find?q=\(encoded)&limit=\(limit)")
    }

    // MARK: - Blocks
    func getBlocks(pageId: String) async throws -> [VaultBlock] {
        return try await get("/api/vault/pages/\(pageId)/blocks")
    }

    func createBlock(pageId: String, input: CreateBlockInput) async throws -> VaultBlock {
        return try await post("/api/vault/pages/\(pageId)/blocks", body: input)
    }

    func updateBlock(id: String, input: UpdateBlockInput) async throws -> VaultBlock {
        return try await patch("/api/vault/blocks/\(id)", body: input)
    }

    func deleteBlock(id: String) async throws {
        let _: EmptyResponse = try await delete("/api/vault/blocks/\(id)")
    }

    // MARK: - Private HTTP Methods
    private func get<T: Decodable>(_ path: String) async throws -> T {
        return try await request(method: "GET", path: path, body: nil as EmptyBody?)
    }

    private func post<T: Decodable, B: Encodable>(_ path: String, body: B) async throws -> T {
        return try await request(method: "POST", path: path, body: body)
    }

    private func patch<T: Decodable, B: Encodable>(_ path: String, body: B) async throws -> T {
        return try await request(method: "PATCH", path: path, body: body)
    }

    private func delete<T: Decodable>(_ path: String) async throws -> T {
        return try await request(method: "DELETE", path: path, body: nil as EmptyBody?)
    }

    private func request<T: Decodable, B: Encodable>(method: String, path: String, body: B?) async throws -> T {
        guard let url = URL(string: baseURL + path) else {
            throw APIError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        if let body = body {
            request.httpBody = try encoder.encode(body)
        }

        print("[API] \(method) \(path)")

        do {
            let (data, response) = try await session.data(for: request)

            guard let httpResponse = response as? HTTPURLResponse else {
                throw APIError.unknown
            }

            print("[API] Response: \(httpResponse.statusCode)")

            if httpResponse.statusCode >= 400 {
                let errorMessage = String(data: data, encoding: .utf8)
                throw APIError.serverError(httpResponse.statusCode, errorMessage)
            }

            // Try to decode as wrapped response first, then as direct response
            do {
                let wrapped = try decoder.decode(APIResponse<T>.self, from: data)
                if let result = wrapped.data {
                    return result
                }
            } catch {
                // Try direct decode
            }

            return try decoder.decode(T.self, from: data)
        } catch let error as APIError {
            throw error
        } catch let error as DecodingError {
            print("[API] Decoding error: \(error)")
            throw APIError.decodingError(error)
        } catch {
            print("[API] Network error: \(error)")
            throw APIError.networkError(error)
        }
    }
}

// MARK: - Helper Types
private struct EmptyBody: Encodable {}
private struct EmptyResponse: Decodable {}
