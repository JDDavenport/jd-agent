import Foundation
import SwiftUI

@MainActor
class HomeViewModel: ObservableObject {
    @Published var pageTree: [VaultPageTreeNode] = []
    @Published var favorites: [VaultPage] = []
    @Published var recentPages: [VaultPage] = []
    @Published var isLoading = false
    @Published var error: String?

    private let apiClient = APIClient.shared

    init() {
        Task {
            await loadData()
        }
    }

    func loadData() async {
        isLoading = true
        error = nil

        do {
            async let treeTask = apiClient.getPageTree()
            async let favoritesTask = apiClient.getFavorites()
            async let pagesTask = apiClient.listPages()

            let (tree, favs, pages) = try await (treeTask, favoritesTask, pagesTask)

            pageTree = tree
            favorites = favs
            recentPages = pages.sorted { $0.updatedAt > $1.updatedAt }.prefix(10).map { $0 }

            print("[HomeVM] Loaded \(tree.count) root pages, \(favs.count) favorites, \(pages.count) total pages")
        } catch {
            self.error = error.localizedDescription
            print("[HomeVM] Error loading data: \(error)")
        }

        isLoading = false
    }

    func refresh() async {
        await loadData()
    }

    func createPage(title: String, parentId: String? = nil) async -> VaultPage? {
        do {
            let input = CreatePageInput(title: title, parentId: parentId, icon: nil)
            let page = try await apiClient.createPage(input: input)
            print("[HomeVM] Created page: \(page.id)")

            // Refresh data
            await loadData()

            return page
        } catch {
            self.error = "Failed to create page: \(error.localizedDescription)"
            print("[HomeVM] Error creating page: \(error)")
            return nil
        }
    }

    func toggleFavorite(_ page: VaultPage) async {
        do {
            _ = try await apiClient.toggleFavorite(id: page.id)
            await loadData()
        } catch {
            self.error = "Failed to toggle favorite: \(error.localizedDescription)"
        }
    }

    func deletePage(_ page: VaultPage) async {
        do {
            try await apiClient.deletePage(id: page.id)
            await loadData()
        } catch {
            self.error = "Failed to delete page: \(error.localizedDescription)"
        }
    }

    func archivePage(_ page: VaultPage) async {
        do {
            let input = UpdatePageInput(isArchived: true)
            _ = try await apiClient.updatePage(id: page.id, input: input)
            await loadData()
        } catch {
            self.error = "Failed to archive page: \(error.localizedDescription)"
        }
    }
}
