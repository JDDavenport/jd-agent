import Foundation

// MARK: - Vault Page
struct VaultPage: Identifiable, Codable, Hashable {
    let id: String
    var parentId: String?
    var title: String
    var icon: String?
    var coverImage: String?
    var isFavorite: Bool
    var isArchived: Bool
    var sortOrder: Int
    var paraType: String?
    var createdAt: Date
    var updatedAt: Date

    enum CodingKeys: String, CodingKey {
        case id
        case parentId
        case title
        case icon
        case coverImage
        case isFavorite
        case isArchived
        case sortOrder
        case paraType
        case createdAt
        case updatedAt
    }

    // Custom decoder to handle API date format
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        parentId = try container.decodeIfPresent(String.self, forKey: .parentId)
        title = try container.decode(String.self, forKey: .title)
        icon = try container.decodeIfPresent(String.self, forKey: .icon)
        coverImage = try container.decodeIfPresent(String.self, forKey: .coverImage)
        isFavorite = try container.decodeIfPresent(Bool.self, forKey: .isFavorite) ?? false
        isArchived = try container.decodeIfPresent(Bool.self, forKey: .isArchived) ?? false
        sortOrder = try container.decodeIfPresent(Int.self, forKey: .sortOrder) ?? 0
        paraType = try container.decodeIfPresent(String.self, forKey: .paraType)

        // Parse ISO8601 dates
        let dateFormatter = ISO8601DateFormatter()
        dateFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]

        let createdAtString = try container.decode(String.self, forKey: .createdAt)
        let updatedAtString = try container.decode(String.self, forKey: .updatedAt)

        createdAt = dateFormatter.date(from: createdAtString) ?? Date()
        updatedAt = dateFormatter.date(from: updatedAtString) ?? Date()
    }

    init(id: String, parentId: String? = nil, title: String, icon: String? = nil,
         coverImage: String? = nil, isFavorite: Bool = false, isArchived: Bool = false,
         sortOrder: Int = 0, paraType: String? = nil, createdAt: Date = Date(), updatedAt: Date = Date()) {
        self.id = id
        self.parentId = parentId
        self.title = title
        self.icon = icon
        self.coverImage = coverImage
        self.isFavorite = isFavorite
        self.isArchived = isArchived
        self.sortOrder = sortOrder
        self.paraType = paraType
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}

// MARK: - Page Tree Node (for hierarchical display)
struct VaultPageTreeNode: Identifiable, Codable {
    let id: String
    var parentId: String?
    var title: String
    var icon: String?
    var isFavorite: Bool
    var isArchived: Bool
    var sortOrder: Int
    var children: [VaultPageTreeNode]

    enum CodingKeys: String, CodingKey {
        case id
        case parentId
        case title
        case icon
        case isFavorite
        case isArchived
        case sortOrder
        case children
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        parentId = try container.decodeIfPresent(String.self, forKey: .parentId)
        title = try container.decode(String.self, forKey: .title)
        icon = try container.decodeIfPresent(String.self, forKey: .icon)
        isFavorite = try container.decodeIfPresent(Bool.self, forKey: .isFavorite) ?? false
        isArchived = try container.decodeIfPresent(Bool.self, forKey: .isArchived) ?? false
        sortOrder = try container.decodeIfPresent(Int.self, forKey: .sortOrder) ?? 0
        children = try container.decodeIfPresent([VaultPageTreeNode].self, forKey: .children) ?? []
    }
}

// MARK: - Create/Update DTOs
struct CreatePageInput: Codable {
    let title: String
    let parentId: String?
    let icon: String?
}

struct UpdatePageInput: Codable {
    var title: String?
    var icon: String?
    var parentId: String?
    var isFavorite: Bool?
    var isArchived: Bool?
}
