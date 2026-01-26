import SwiftUI

struct PageDetailView: View {
    let page: VaultPage
    let onNavigate: (VaultPage) -> Void

    @StateObject private var viewModel: PageDetailViewModel
    @State private var isEditingTitle = false
    @State private var editedTitle: String
    @State private var showingBlockMenu = false
    @FocusState private var isTitleFocused: Bool

    init(page: VaultPage, onNavigate: @escaping (VaultPage) -> Void) {
        self.page = page
        self.onNavigate = onNavigate
        self._viewModel = StateObject(wrappedValue: PageDetailViewModel(page: page))
        self._editedTitle = State(initialValue: page.title)
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                // Page Header
                pageHeader

                // Blocks
                blocksSection

                // Add block button at bottom
                addBlockButton
            }
            .padding(.bottom, 100)
        }
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    Button(action: { Task { await viewModel.toggleFavorite() } }) {
                        Label(viewModel.page.isFavorite ? "Unfavorite" : "Favorite",
                              systemImage: viewModel.page.isFavorite ? "star.slash" : "star")
                    }

                    Button(action: {}) {
                        Label("Share", systemImage: "square.and.arrow.up")
                    }

                    Divider()

                    Button(role: .destructive, action: {}) {
                        Label("Delete", systemImage: "trash")
                    }
                } label: {
                    Image(systemName: "ellipsis.circle")
                }
            }
        }
        .overlay {
            if viewModel.isLoading {
                ProgressView()
            }
        }
        .sheet(isPresented: $showingBlockMenu) {
            BlockTypeMenu { blockType in
                showingBlockMenu = false
                Task {
                    _ = await viewModel.addBlock(type: blockType)
                }
            }
            .presentationDetents([.medium])
        }
    }

    // MARK: - Page Header
    private var pageHeader: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Icon button
            Button(action: {
                // TODO: Show emoji picker
            }) {
                Text(viewModel.page.icon ?? "📄")
                    .font(.system(size: 48))
            }
            .buttonStyle(.plain)

            // Title
            TextField("Untitled", text: $editedTitle, axis: .vertical)
                .font(.system(size: 32, weight: .bold))
                .focused($isTitleFocused)
                .onSubmit {
                    Task {
                        await viewModel.updateTitle(editedTitle)
                    }
                }
                .onChange(of: isTitleFocused) { _, focused in
                    if !focused && editedTitle != viewModel.page.title {
                        Task {
                            await viewModel.updateTitle(editedTitle)
                        }
                    }
                }
        }
        .padding(.horizontal)
        .padding(.top, 20)
        .padding(.bottom, 16)
    }

    // MARK: - Blocks Section
    private var blocksSection: some View {
        VStack(alignment: .leading, spacing: 4) {
            ForEach(viewModel.blocks) { block in
                BlockView(
                    block: block,
                    onUpdate: { content in
                        Task { await viewModel.updateBlock(block, content: content) }
                    },
                    onDelete: {
                        Task { await viewModel.deleteBlock(block) }
                    },
                    onToggleTodo: {
                        Task { await viewModel.toggleTodo(block) }
                    },
                    onChangeType: { newType in
                        Task { await viewModel.updateBlockType(block, type: newType) }
                    },
                    onAddBlockAfter: {
                        Task { _ = await viewModel.addBlock(afterBlock: block) }
                    }
                )
            }

            if viewModel.blocks.isEmpty && !viewModel.isLoading {
                Text("Tap here or press + to start writing...")
                    .foregroundColor(.secondary)
                    .padding(.horizontal)
                    .padding(.vertical, 8)
                    .onTapGesture {
                        Task { _ = await viewModel.addBlock() }
                    }
            }
        }
    }

    // MARK: - Add Block Button
    private var addBlockButton: some View {
        Button(action: { showingBlockMenu = true }) {
            HStack {
                Image(systemName: "plus")
                Text("Add block")
            }
            .font(.subheadline)
            .foregroundColor(.secondary)
            .padding(.horizontal)
            .padding(.vertical, 12)
        }
    }
}

// MARK: - Toggle Favorite Extension
extension PageDetailViewModel {
    func toggleFavorite() async {
        do {
            page = try await APIClient.shared.toggleFavorite(id: page.id)
        } catch {
            self.error = "Failed to toggle favorite: \(error.localizedDescription)"
        }
    }
}

// MARK: - Block Type Menu
struct BlockTypeMenu: View {
    let onSelect: (BlockType) -> Void

    var body: some View {
        NavigationStack {
            List {
                Section("Basic") {
                    ForEach([BlockType.paragraph, .heading1, .heading2, .heading3], id: \.self) { type in
                        Button(action: { onSelect(type) }) {
                            Label(type.displayName, systemImage: type.icon)
                        }
                    }
                }

                Section("Lists") {
                    ForEach([BlockType.bulletList, .numberedList, .todo], id: \.self) { type in
                        Button(action: { onSelect(type) }) {
                            Label(type.displayName, systemImage: type.icon)
                        }
                    }
                }

                Section("Other") {
                    ForEach([BlockType.quote, .code, .callout, .divider], id: \.self) { type in
                        Button(action: { onSelect(type) }) {
                            Label(type.displayName, systemImage: type.icon)
                        }
                    }
                }
            }
            .navigationTitle("Add Block")
            .navigationBarTitleDisplayMode(.inline)
        }
    }
}

#Preview {
    NavigationStack {
        PageDetailView(
            page: VaultPage(id: "1", title: "Test Page", icon: "📝"),
            onNavigate: { _ in }
        )
    }
}
