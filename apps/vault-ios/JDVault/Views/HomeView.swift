import SwiftUI

struct HomeView: View {
    @ObservedObject var viewModel: HomeViewModel
    let onSelectPage: (VaultPage) -> Void
    let onCreatePage: () -> Void
    let onSearch: () -> Void

    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                // Quick Actions
                quickActionsSection

                // Recent Pages
                if !viewModel.recentPages.isEmpty {
                    recentSection
                }

                // Favorites
                if !viewModel.favorites.isEmpty {
                    favoritesSection
                }

                // All Notes
                allNotesSection
            }
        }
        .refreshable {
            await viewModel.refresh()
        }
        .navigationTitle("Vault")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button(action: onSearch) {
                    Image(systemName: "magnifyingglass")
                }
            }
        }
        .overlay {
            if viewModel.isLoading && viewModel.pageTree.isEmpty {
                ProgressView("Loading...")
            }
        }
    }

    // MARK: - Quick Actions
    private var quickActionsSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Quick Actions")
                .font(.caption)
                .fontWeight(.semibold)
                .foregroundColor(.secondary)
                .textCase(.uppercase)
                .padding(.horizontal)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    QuickActionButton(
                        title: "New Note",
                        icon: "plus",
                        color: .blue,
                        action: onCreatePage
                    )

                    QuickActionButton(
                        title: "Search",
                        icon: "magnifyingglass",
                        color: .gray,
                        action: onSearch
                    )
                }
                .padding(.horizontal)
            }
        }
        .padding(.vertical, 12)
    }

    // MARK: - Recent Section
    private var recentSection: some View {
        VStack(alignment: .leading, spacing: 0) {
            SectionHeader(title: "Recent")

            ForEach(viewModel.recentPages) { page in
                PageRow(
                    page: page,
                    onTap: { onSelectPage(page) },
                    onFavorite: { Task { await viewModel.toggleFavorite(page) } },
                    onArchive: { Task { await viewModel.archivePage(page) } },
                    onDelete: { Task { await viewModel.deletePage(page) } }
                )
            }
        }
    }

    // MARK: - Favorites Section
    private var favoritesSection: some View {
        VStack(alignment: .leading, spacing: 0) {
            SectionHeader(title: "Favorites", icon: "star.fill", iconColor: .yellow)

            ForEach(viewModel.favorites) { page in
                PageRow(
                    page: page,
                    onTap: { onSelectPage(page) },
                    onFavorite: { Task { await viewModel.toggleFavorite(page) } },
                    onArchive: { Task { await viewModel.archivePage(page) } },
                    onDelete: { Task { await viewModel.deletePage(page) } }
                )
            }
        }
    }

    // MARK: - All Notes Section
    private var allNotesSection: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                SectionHeader(title: "All Notes")
                Spacer()
                Button(action: onCreatePage) {
                    Label("New", systemImage: "plus")
                        .font(.subheadline)
                        .fontWeight(.medium)
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.small)
                .padding(.trailing)
            }

            if viewModel.pageTree.isEmpty && !viewModel.isLoading {
                EmptyStateView(
                    icon: "doc.text",
                    title: "No notes yet",
                    message: "Create your first note to get started",
                    actionTitle: "Create Note",
                    action: onCreatePage
                )
                .padding(.vertical, 40)
            } else {
                ForEach(viewModel.pageTree) { node in
                    PageTreeRow(
                        node: node,
                        depth: 0,
                        onSelectPage: { pageId in
                            // Convert tree node to page for navigation
                            if let page = viewModel.recentPages.first(where: { $0.id == pageId }) ??
                                viewModel.favorites.first(where: { $0.id == pageId }) {
                                onSelectPage(page)
                            } else {
                                // Create a minimal page object for navigation
                                let page = VaultPage(
                                    id: pageId,
                                    title: node.title,
                                    icon: node.icon,
                                    isFavorite: node.isFavorite
                                )
                                onSelectPage(page)
                            }
                        }
                    )
                }
            }
        }
    }
}

// MARK: - Quick Action Button
struct QuickActionButton: View {
    let title: String
    let icon: String
    let color: Color
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 6) {
                Image(systemName: icon)
                    .font(.subheadline)
                Text(title)
                    .font(.subheadline)
                    .fontWeight(.medium)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(color.opacity(color == .gray ? 0.1 : 1))
            .foregroundColor(color == .gray ? .primary : .white)
            .cornerRadius(8)
        }
    }
}

// MARK: - Section Header
struct SectionHeader: View {
    let title: String
    var icon: String? = nil
    var iconColor: Color = .primary

    var body: some View {
        HStack(spacing: 6) {
            if let icon = icon {
                Image(systemName: icon)
                    .foregroundColor(iconColor)
                    .font(.caption)
            }
            Text(title)
                .font(.caption)
                .fontWeight(.semibold)
                .foregroundColor(.secondary)
                .textCase(.uppercase)
        }
        .padding(.horizontal)
        .padding(.vertical, 10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(.systemGroupedBackground))
    }
}

// MARK: - Empty State
struct EmptyStateView: View {
    let icon: String
    let title: String
    let message: String
    let actionTitle: String
    let action: () -> Void

    var body: some View {
        VStack(spacing: 12) {
            Image(systemName: icon)
                .font(.system(size: 48))
                .foregroundColor(.secondary)

            Text(title)
                .font(.headline)

            Text(message)
                .font(.subheadline)
                .foregroundColor(.secondary)

            Button(action: action) {
                Label(actionTitle, systemImage: "plus")
            }
            .buttonStyle(.borderedProminent)
            .padding(.top, 8)
        }
        .frame(maxWidth: .infinity)
    }
}

#Preview {
    NavigationStack {
        HomeView(
            viewModel: HomeViewModel(),
            onSelectPage: { _ in },
            onCreatePage: {},
            onSearch: {}
        )
    }
}
