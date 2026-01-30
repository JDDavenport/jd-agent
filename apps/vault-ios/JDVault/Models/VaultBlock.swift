import Foundation

// MARK: - Block Types
enum BlockType: String, Codable, CaseIterable {
    // Raw values must match API's expected block types
    case paragraph = "text"           // API uses "text" for paragraph/text blocks
    case heading1 = "heading_1"       // API uses snake_case
    case heading2 = "heading_2"
    case heading3 = "heading_3"
    case bulletList = "bulleted_list"
    case numberedList = "numbered_list"
    case todo = "todo"                // API uses lowercase
    case quote = "quote"
    case code = "code"
    case divider = "divider"
    case callout = "callout"
    case file = "file"
    case image = "image"
    case unknown = "unknown"

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        let rawValue = try container.decode(String.self)

        // Handle both API format and legacy format for backward compatibility
        switch rawValue {
        case "text", "paragraph": self = .paragraph
        case "heading_1", "heading1": self = .heading1
        case "heading_2", "heading2": self = .heading2
        case "heading_3", "heading3": self = .heading3
        case "bulleted_list", "bulletedList": self = .bulletList
        case "numbered_list", "numberedList": self = .numberedList
        case "todo", "toDo": self = .todo
        case "quote": self = .quote
        case "code": self = .code
        case "divider": self = .divider
        case "callout": self = .callout
        case "file": self = .file
        case "image": self = .image
        default: self = .unknown
        }
    }

    var displayName: String {
        switch self {
        case .paragraph: return "Text"
        case .heading1: return "Heading 1"
        case .heading2: return "Heading 2"
        case .heading3: return "Heading 3"
        case .bulletList: return "Bullet List"
        case .numberedList: return "Numbered List"
        case .todo: return "To-do"
        case .quote: return "Quote"
        case .code: return "Code"
        case .divider: return "Divider"
        case .callout: return "Callout"
        case .file: return "File"
        case .image: return "Image"
        case .unknown: return "Unknown"
        }
    }

    var icon: String {
        switch self {
        case .paragraph: return "text.alignleft"
        case .heading1: return "textformat.size.larger"
        case .heading2: return "textformat.size"
        case .heading3: return "textformat.size.smaller"
        case .bulletList: return "list.bullet"
        case .numberedList: return "list.number"
        case .todo: return "checkmark.square"
        case .quote: return "text.quote"
        case .code: return "chevron.left.forwardslash.chevron.right"
        case .divider: return "minus"
        case .callout: return "exclamationmark.bubble"
        case .file: return "doc"
        case .image: return "photo"
        case .unknown: return "questionmark"
        }
    }
}

// MARK: - Block Content
struct BlockContent: Codable, Equatable {
    var text: String?
    var checked: Bool?
    var language: String?
    var emoji: String?

    init(text: String? = nil, checked: Bool? = nil, language: String? = nil, emoji: String? = nil) {
        self.text = text
        self.checked = checked
        self.language = language
        self.emoji = emoji
    }
}

// MARK: - Vault Block
struct VaultBlock: Identifiable, Codable, Equatable {
    let id: String
    let pageId: String
    var parentBlockId: String?
    var type: BlockType
    var content: BlockContent
    var sortOrder: Int
    var createdAt: Date
    var updatedAt: Date

    enum CodingKeys: String, CodingKey {
        case id
        case pageId
        case parentBlockId
        case type
        case content
        case sortOrder
        case createdAt
        case updatedAt
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        pageId = try container.decode(String.self, forKey: .pageId)
        parentBlockId = try container.decodeIfPresent(String.self, forKey: .parentBlockId)
        type = try container.decode(BlockType.self, forKey: .type)
        content = try container.decode(BlockContent.self, forKey: .content)
        sortOrder = try container.decodeIfPresent(Int.self, forKey: .sortOrder) ?? 0

        let dateFormatter = ISO8601DateFormatter()
        dateFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]

        let createdAtString = try container.decode(String.self, forKey: .createdAt)
        let updatedAtString = try container.decode(String.self, forKey: .updatedAt)

        createdAt = dateFormatter.date(from: createdAtString) ?? Date()
        updatedAt = dateFormatter.date(from: updatedAtString) ?? Date()
    }

    init(id: String = UUID().uuidString, pageId: String, parentBlockId: String? = nil,
         type: BlockType = .paragraph, content: BlockContent = BlockContent(),
         sortOrder: Int = 0, createdAt: Date = Date(), updatedAt: Date = Date()) {
        self.id = id
        self.pageId = pageId
        self.parentBlockId = parentBlockId
        self.type = type
        self.content = content
        self.sortOrder = sortOrder
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}

// MARK: - Create/Update DTOs
struct CreateBlockInput: Codable {
    let type: BlockType
    let content: BlockContent
    let parentBlockId: String?
    let afterBlockId: String?
}

struct UpdateBlockInput: Codable {
    var type: BlockType?
    var content: BlockContent?
}
