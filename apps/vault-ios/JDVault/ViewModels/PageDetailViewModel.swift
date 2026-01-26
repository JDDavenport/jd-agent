import Foundation
import SwiftUI

@MainActor
class PageDetailViewModel: ObservableObject {
    @Published var page: VaultPage
    @Published var blocks: [VaultBlock] = []
    @Published var isLoading = false
    @Published var isSaving = false
    @Published var error: String?

    private let apiClient = APIClient.shared

    init(page: VaultPage) {
        self.page = page
        Task {
            await loadBlocks()
        }
    }

    func loadBlocks() async {
        isLoading = true
        do {
            blocks = try await apiClient.getBlocks(pageId: page.id)
            blocks.sort { $0.sortOrder < $1.sortOrder }
            print("[PageVM] Loaded \(blocks.count) blocks for page \(page.id)")
        } catch {
            self.error = error.localizedDescription
            print("[PageVM] Error loading blocks: \(error)")
        }
        isLoading = false
    }

    func updateTitle(_ newTitle: String) async {
        guard newTitle != page.title else { return }

        isSaving = true
        do {
            let input = UpdatePageInput(title: newTitle)
            page = try await apiClient.updatePage(id: page.id, input: input)
            print("[PageVM] Updated title to: \(newTitle)")
        } catch {
            self.error = "Failed to update title: \(error.localizedDescription)"
        }
        isSaving = false
    }

    func updateIcon(_ newIcon: String?) async {
        isSaving = true
        do {
            let input = UpdatePageInput(icon: newIcon)
            page = try await apiClient.updatePage(id: page.id, input: input)
        } catch {
            self.error = "Failed to update icon: \(error.localizedDescription)"
        }
        isSaving = false
    }

    func addBlock(type: BlockType = .paragraph, afterBlock: VaultBlock? = nil) async -> VaultBlock? {
        do {
            let input = CreateBlockInput(
                type: type,
                content: BlockContent(text: ""),
                parentBlockId: nil,
                afterBlockId: afterBlock?.id
            )
            let block = try await apiClient.createBlock(pageId: page.id, input: input)
            await loadBlocks()
            return block
        } catch {
            self.error = "Failed to add block: \(error.localizedDescription)"
            return nil
        }
    }

    func updateBlock(_ block: VaultBlock, content: BlockContent) async {
        do {
            let input = UpdateBlockInput(content: content)
            _ = try await apiClient.updateBlock(id: block.id, input: input)

            // Update local state
            if let index = blocks.firstIndex(where: { $0.id == block.id }) {
                blocks[index].content = content
            }
        } catch {
            self.error = "Failed to update block: \(error.localizedDescription)"
        }
    }

    func updateBlockType(_ block: VaultBlock, type: BlockType) async {
        do {
            let input = UpdateBlockInput(type: type)
            _ = try await apiClient.updateBlock(id: block.id, input: input)

            if let index = blocks.firstIndex(where: { $0.id == block.id }) {
                blocks[index].type = type
            }
        } catch {
            self.error = "Failed to update block type: \(error.localizedDescription)"
        }
    }

    func deleteBlock(_ block: VaultBlock) async {
        do {
            try await apiClient.deleteBlock(id: block.id)
            blocks.removeAll { $0.id == block.id }
        } catch {
            self.error = "Failed to delete block: \(error.localizedDescription)"
        }
    }

    func toggleTodo(_ block: VaultBlock) async {
        guard block.type == .todo else { return }

        var newContent = block.content
        newContent.checked = !(newContent.checked ?? false)
        await updateBlock(block, content: newContent)
    }
}
