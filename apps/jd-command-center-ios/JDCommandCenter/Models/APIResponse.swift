import Foundation

// MARK: - Generic API Response
struct APIResponse<T: Codable>: Codable {
    let success: Bool
    let data: T?
    let message: String?
    let count: Int?
    let error: APIErrorResponse?
}

// MARK: - API Error Response
struct APIErrorResponse: Codable {
    let code: String?
    let message: String?
}

// MARK: - Empty Response
struct EmptyResponse: Codable {}

// MARK: - Error Response (for parsing errors)
struct ErrorResponse: Codable {
    let success: Bool?
    let message: String?
    let error: String?
}
