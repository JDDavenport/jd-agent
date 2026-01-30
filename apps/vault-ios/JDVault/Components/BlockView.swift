import SwiftUI

struct BlockView: View {
    let block: VaultBlock
    let onUpdate: (BlockContent) -> Void
    let onDelete: () -> Void
    let onToggleTodo: () -> Void
    let onChangeType: (BlockType) -> Void
    let onAddBlockAfter: () -> Void
    let shouldFocus: Bool

    @State private var editedText: String
    @State private var showingMenu = false
    @FocusState private var isFocused: Bool

    init(block: VaultBlock,
         onUpdate: @escaping (BlockContent) -> Void,
         onDelete: @escaping () -> Void,
         onToggleTodo: @escaping () -> Void,
         onChangeType: @escaping (BlockType) -> Void,
         onAddBlockAfter: @escaping () -> Void,
         shouldFocus: Bool = false) {
        self.block = block
        self.onUpdate = onUpdate
        self.onDelete = onDelete
        self.onToggleTodo = onToggleTodo
        self.onChangeType = onChangeType
        self.onAddBlockAfter = onAddBlockAfter
        self.shouldFocus = shouldFocus
        self._editedText = State(initialValue: block.content.text ?? "")
    }

    var body: some View {
        HStack(alignment: .top, spacing: 8) {
            // Block-specific leading element
            leadingElement

            // Text content
            textContent
        }
        .padding(.horizontal)
        .padding(.vertical, 4)
        .contentShape(Rectangle())
        .contextMenu {
            Button(action: onDelete) {
                Label("Delete", systemImage: "trash")
            }

            Button(action: onAddBlockAfter) {
                Label("Add block below", systemImage: "plus")
            }

            Menu("Turn into") {
                ForEach(BlockType.allCases, id: \.self) { type in
                    Button(action: { onChangeType(type) }) {
                        Label(type.displayName, systemImage: type.icon)
                    }
                }
            }
        }
        .onAppear {
            if shouldFocus {
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                    isFocused = true
                }
            }
        }
    }

    // MARK: - Leading Element
    @ViewBuilder
    private var leadingElement: some View {
        switch block.type {
        case .todo:
            Button(action: onToggleTodo) {
                Image(systemName: block.content.checked == true ? "checkmark.square.fill" : "square")
                    .foregroundColor(block.content.checked == true ? .blue : .secondary)
                    .font(.title3)
            }
            .buttonStyle(.plain)
            .frame(width: 24)

        case .bulletList:
            Text("•")
                .font(.title2)
                .foregroundColor(.secondary)
                .frame(width: 24)

        case .numberedList:
            Text("1.")
                .font(.body)
                .foregroundColor(.secondary)
                .frame(width: 24)

        case .quote:
            Rectangle()
                .fill(Color.secondary.opacity(0.3))
                .frame(width: 3)

        default:
            EmptyView()
        }
    }

    // MARK: - Text Content
    @ViewBuilder
    private var textContent: some View {
        switch block.type {
        case .divider:
            Divider()
                .padding(.vertical, 8)

        case .heading1:
            TextField("Heading 1", text: $editedText, axis: .vertical)
                .font(.system(size: 28, weight: .bold))
                .focused($isFocused)
                .onChange(of: isFocused) { _, focused in
                    if !focused { saveChanges() }
                }
                .onSubmit { saveChanges() }

        case .heading2:
            TextField("Heading 2", text: $editedText, axis: .vertical)
                .font(.system(size: 22, weight: .bold))
                .focused($isFocused)
                .onChange(of: isFocused) { _, focused in
                    if !focused { saveChanges() }
                }
                .onSubmit { saveChanges() }

        case .heading3:
            TextField("Heading 3", text: $editedText, axis: .vertical)
                .font(.system(size: 18, weight: .semibold))
                .focused($isFocused)
                .onChange(of: isFocused) { _, focused in
                    if !focused { saveChanges() }
                }
                .onSubmit { saveChanges() }

        case .code:
            TextField("Code", text: $editedText, axis: .vertical)
                .font(.system(.body, design: .monospaced))
                .padding(8)
                .background(Color(.systemGray6))
                .cornerRadius(4)
                .focused($isFocused)
                .onChange(of: isFocused) { _, focused in
                    if !focused { saveChanges() }
                }

        case .callout:
            HStack(alignment: .top, spacing: 8) {
                Text(block.content.emoji ?? "💡")
                    .font(.title3)

                TextField("Callout", text: $editedText, axis: .vertical)
                    .font(.body)
                    .focused($isFocused)
                    .onChange(of: isFocused) { _, focused in
                        if !focused { saveChanges() }
                    }
            }
            .padding(12)
            .background(Color(.systemGray6))
            .cornerRadius(8)

        case .todo:
            TextField("To-do", text: $editedText, axis: .vertical)
                .font(.body)
                .strikethrough(block.content.checked == true)
                .foregroundColor(block.content.checked == true ? .secondary : .primary)
                .focused($isFocused)
                .onChange(of: isFocused) { _, focused in
                    if !focused { saveChanges() }
                }
                .onSubmit { saveChanges() }

        case .quote:
            TextField("Quote", text: $editedText, axis: .vertical)
                .font(.body.italic())
                .foregroundColor(.secondary)
                .focused($isFocused)
                .onChange(of: isFocused) { _, focused in
                    if !focused { saveChanges() }
                }
                .onSubmit { saveChanges() }

        case .file:
            // Display file info
            HStack {
                Image(systemName: "doc.fill")
                    .foregroundColor(.blue)
                Text(block.content.text ?? "File")
                    .foregroundColor(.primary)
            }
            .padding(8)
            .background(Color(.systemGray6))
            .cornerRadius(8)

        case .image:
            // Display image placeholder
            HStack {
                Image(systemName: "photo.fill")
                    .foregroundColor(.blue)
                Text(block.content.text ?? "Image")
                    .foregroundColor(.primary)
            }
            .padding(8)
            .background(Color(.systemGray6))
            .cornerRadius(8)

        case .paragraph, .unknown, .bulletList, .numberedList:
            TextField("Type something...", text: $editedText, axis: .vertical)
                .font(.body)
                .focused($isFocused)
                .onChange(of: isFocused) { _, focused in
                    if !focused { saveChanges() }
                }
                .onSubmit { saveChanges() }
        }
    }

    // MARK: - Save Changes
    private func saveChanges() {
        guard editedText != block.content.text else { return }
        var newContent = block.content
        newContent.text = editedText
        onUpdate(newContent)
    }
}

#Preview {
    VStack(spacing: 16) {
        BlockView(
            block: VaultBlock(id: "1", pageId: "page1", type: .paragraph, content: BlockContent(text: "Hello world")),
            onUpdate: { _ in },
            onDelete: {},
            onToggleTodo: {},
            onChangeType: { _ in },
            onAddBlockAfter: {}
        )

        BlockView(
            block: VaultBlock(id: "2", pageId: "page1", type: .heading1, content: BlockContent(text: "Big Title")),
            onUpdate: { _ in },
            onDelete: {},
            onToggleTodo: {},
            onChangeType: { _ in },
            onAddBlockAfter: {}
        )

        BlockView(
            block: VaultBlock(id: "3", pageId: "page1", type: .todo, content: BlockContent(text: "Complete task", checked: false)),
            onUpdate: { _ in },
            onDelete: {},
            onToggleTodo: {},
            onChangeType: { _ in },
            onAddBlockAfter: {}
        )

        BlockView(
            block: VaultBlock(id: "4", pageId: "page1", type: .code, content: BlockContent(text: "let x = 42")),
            onUpdate: { _ in },
            onDelete: {},
            onToggleTodo: {},
            onChangeType: { _ in },
            onAddBlockAfter: {}
        )
    }
    .padding()
}
