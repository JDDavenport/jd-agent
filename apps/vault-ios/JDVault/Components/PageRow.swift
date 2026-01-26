import SwiftUI

struct PageRow: View {
    let page: VaultPage
    let onTap: () -> Void
    let onFavorite: () -> Void
    let onArchive: () -> Void
    let onDelete: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 12) {
                // Icon
                Text(page.icon ?? "📄")
                    .font(.title2)

                // Title and metadata
                VStack(alignment: .leading, spacing: 2) {
                    Text(page.title.isEmpty ? "Untitled" : page.title)
                        .font(.body)
                        .fontWeight(.medium)
                        .foregroundColor(.primary)
                        .lineLimit(1)

                    Text(page.updatedAt.formatted(.relative(presentation: .named)))
                        .font(.caption)
                        .foregroundColor(.secondary)
                }

                Spacer()

                // Favorite indicator
                if page.isFavorite {
                    Image(systemName: "star.fill")
                        .foregroundColor(.yellow)
                        .font(.caption)
                }

                Image(systemName: "chevron.right")
                    .foregroundColor(.secondary)
                    .font(.caption)
            }
            .padding(.horizontal)
            .padding(.vertical, 12)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .swipeActions(edge: .trailing, allowsFullSwipe: false) {
            Button(role: .destructive, action: onDelete) {
                Label("Delete", systemImage: "trash")
            }

            Button(action: onArchive) {
                Label("Archive", systemImage: "archivebox")
            }
            .tint(.blue)

            Button(action: onFavorite) {
                Label(page.isFavorite ? "Unfavorite" : "Favorite", systemImage: page.isFavorite ? "star.slash" : "star")
            }
            .tint(.yellow)
        }
    }
}

// MARK: - Page Tree Row (for hierarchical display)
struct PageTreeRow: View {
    let node: VaultPageTreeNode
    let depth: Int
    let onSelectPage: (String) -> Void

    @State private var isExpanded = false

    var body: some View {
        VStack(spacing: 0) {
            Button(action: { onSelectPage(node.id) }) {
                HStack(spacing: 8) {
                    // Indentation
                    if depth > 0 {
                        Color.clear
                            .frame(width: CGFloat(depth) * 20)
                    }

                    // Expand/collapse button
                    if !node.children.isEmpty {
                        Button(action: { isExpanded.toggle() }) {
                            Image(systemName: isExpanded ? "chevron.down" : "chevron.right")
                                .font(.caption)
                                .foregroundColor(.secondary)
                                .frame(width: 20, height: 20)
                        }
                        .buttonStyle(.plain)
                    } else {
                        Color.clear.frame(width: 20, height: 20)
                    }

                    // Icon
                    Text(node.icon ?? "📄")
                        .font(.body)

                    // Title
                    Text(node.title.isEmpty ? "Untitled" : node.title)
                        .font(.body)
                        .foregroundColor(.primary)
                        .lineLimit(1)

                    Spacer()

                    // Favorite indicator
                    if node.isFavorite {
                        Image(systemName: "star.fill")
                            .foregroundColor(.yellow)
                            .font(.caption)
                    }

                    // Child count badge
                    if !node.children.isEmpty {
                        Text("\(node.children.count)")
                            .font(.caption2)
                            .fontWeight(.medium)
                            .foregroundColor(.blue)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Color.blue.opacity(0.1))
                            .cornerRadius(8)
                    }
                }
                .padding(.horizontal)
                .padding(.vertical, 10)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)

            Divider()
                .padding(.leading, CGFloat(depth + 1) * 20 + 48)

            // Children
            if isExpanded {
                ForEach(node.children) { child in
                    PageTreeRow(
                        node: child,
                        depth: depth + 1,
                        onSelectPage: onSelectPage
                    )
                }
            }
        }
    }
}

#Preview {
    VStack {
        PageRow(
            page: VaultPage(
                id: "1",
                title: "Test Page",
                icon: "📝",
                isFavorite: true
            ),
            onTap: {},
            onFavorite: {},
            onArchive: {},
            onDelete: {}
        )

        Divider()

        PageTreeRow(
            node: VaultPageTreeNode(
                id: "2",
                title: "Parent Page",
                icon: "📁",
                children: []
            ),
            depth: 0,
            onSelectPage: { _ in }
        )
    }
}

// Add initializer extension for preview
extension VaultPageTreeNode {
    init(id: String, title: String, icon: String?, children: [VaultPageTreeNode]) {
        self.id = id
        self.parentId = nil
        self.title = title
        self.icon = icon
        self.isFavorite = false
        self.isArchived = false
        self.sortOrder = 0
        self.children = children
    }
}
