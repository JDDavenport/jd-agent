import SwiftUI

struct TaskDetailView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var taskService: TaskService

    let task: JDTask

    @State private var editedTitle: String
    @State private var editedDescription: String
    @State private var editedDueDate: Date?
    @State private var hasDueDate: Bool
    @State private var editedPriority: Int
    @State private var editedStatus: TaskStatus
    @State private var subtasks: [JDTask] = []
    @State private var isLoading = false
    @State private var isSaving = false
    @State private var hasChanges = false
    @State private var showingAddSubtask = false
    @State private var newSubtaskTitle = ""

    init(task: JDTask) {
        self.task = task
        _editedTitle = State(initialValue: task.title)
        _editedDescription = State(initialValue: task.description ?? "")
        _editedDueDate = State(initialValue: task.dueDate)
        _hasDueDate = State(initialValue: task.dueDate != nil)
        _editedPriority = State(initialValue: task.priority)
        _editedStatus = State(initialValue: task.status)
    }

    var body: some View {
        NavigationStack {
            Form {
                // Title & Description
                Section {
                    TextField("Title", text: $editedTitle)
                        .font(.headline)
                        .onChange(of: editedTitle) { _ in hasChanges = true }

                    TextField("Description", text: $editedDescription, axis: .vertical)
                        .lineLimit(3...6)
                        .onChange(of: editedDescription) { _ in hasChanges = true }
                }

                // Status
                Section("Status") {
                    Picker("Status", selection: $editedStatus) {
                        ForEach(TaskStatus.allCases, id: \.self) { status in
                            Label(status.displayName, systemImage: status.icon)
                                .tag(status)
                        }
                    }
                    .onChange(of: editedStatus) { _ in hasChanges = true }
                }

                // Due Date
                Section("Due Date") {
                    Toggle("Has Due Date", isOn: $hasDueDate)
                        .onChange(of: hasDueDate) { newValue in
                            hasChanges = true
                            if newValue && editedDueDate == nil {
                                editedDueDate = Date()
                            }
                        }

                    if hasDueDate {
                        DatePicker(
                            "Due Date",
                            selection: Binding(
                                get: { editedDueDate ?? Date() },
                                set: {
                                    editedDueDate = $0
                                    hasChanges = true
                                }
                            ),
                            displayedComponents: [.date]
                        )

                        // Quick date buttons
                        HStack {
                            QuickDateButton(title: "Today") {
                                editedDueDate = Date()
                                hasChanges = true
                            }
                            QuickDateButton(title: "Tomorrow") {
                                editedDueDate = Calendar.current.date(byAdding: .day, value: 1, to: Date())
                                hasChanges = true
                            }
                            QuickDateButton(title: "Next Week") {
                                editedDueDate = Calendar.current.date(byAdding: .weekOfYear, value: 1, to: Date())
                                hasChanges = true
                            }
                        }
                    }
                }

                // Priority
                Section("Priority") {
                    Picker("Priority", selection: $editedPriority) {
                        Text("None").tag(0)
                        HStack {
                            Text("P4 - Low")
                            Spacer()
                            Circle().fill(.blue).frame(width: 8, height: 8)
                        }.tag(1)
                        HStack {
                            Text("P3 - Medium")
                            Spacer()
                            Circle().fill(.yellow).frame(width: 8, height: 8)
                        }.tag(2)
                        HStack {
                            Text("P2 - High")
                            Spacer()
                            Circle().fill(.orange).frame(width: 8, height: 8)
                        }.tag(3)
                        HStack {
                            Text("P1 - Urgent")
                            Spacer()
                            Circle().fill(.red).frame(width: 8, height: 8)
                        }.tag(4)
                    }
                    .onChange(of: editedPriority) { _ in hasChanges = true }
                }

                // Subtasks
                Section {
                    if isLoading {
                        HStack {
                            Spacer()
                            ProgressView()
                            Spacer()
                        }
                    } else if subtasks.isEmpty {
                        Text("No subtasks")
                            .foregroundStyle(.secondary)
                    } else {
                        ForEach(subtasks) { subtask in
                            SubtaskRow(subtask: subtask) {
                                completeSubtask(subtask)
                            }
                        }
                    }

                    Button {
                        showingAddSubtask = true
                    } label: {
                        Label("Add Subtask", systemImage: "plus.circle")
                    }
                } header: {
                    HStack {
                        Text("Subtasks")
                        if !subtasks.isEmpty {
                            Spacer()
                            Text("\(subtasks.filter { $0.isCompleted }.count)/\(subtasks.count)")
                                .foregroundStyle(.secondary)
                        }
                    }
                }

                // Metadata
                Section("Info") {
                    LabeledContent("Created", value: task.createdAt.formatted(date: .abbreviated, time: .shortened))
                    LabeledContent("Source", value: task.source.rawValue.capitalized)
                    if let contexts = task.taskContexts, !contexts.isEmpty {
                        LabeledContent("Contexts", value: contexts.map { "@\($0)" }.joined(separator: ", "))
                    }
                    if let labels = task.taskLabels, !labels.isEmpty {
                        LabeledContent("Labels", value: labels.map { "#\($0)" }.joined(separator: ", "))
                    }
                }

                // Delete
                Section {
                    Button(role: .destructive) {
                        deleteTask()
                    } label: {
                        HStack {
                            Spacer()
                            Label("Delete Task", systemImage: "trash")
                            Spacer()
                        }
                    }
                }
            }
            .navigationTitle("Task Details")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        saveChanges()
                    }
                    .disabled(!hasChanges || isSaving)
                }
            }
            .task {
                await loadSubtasks()
            }
            .alert("Add Subtask", isPresented: $showingAddSubtask) {
                TextField("Subtask title", text: $newSubtaskTitle)
                Button("Cancel", role: .cancel) {
                    newSubtaskTitle = ""
                }
                Button("Add") {
                    addSubtask()
                }
            }
        }
    }

    // MARK: - Data Loading

    private func loadSubtasks() async {
        isLoading = true
        defer { isLoading = false }

        do {
            subtasks = try await taskService.getSubtasks(parentId: task.id)
        } catch {
            print("Failed to load subtasks: \(error)")
        }
    }

    // MARK: - Actions

    private func saveChanges() {
        isSaving = true

        Task {
            defer { isSaving = false }

            let update = UpdateTaskInput(
                title: editedTitle,
                description: editedDescription.isEmpty ? nil : editedDescription,
                status: editedStatus,
                priority: editedPriority,
                dueDate: hasDueDate ? editedDueDate?.iso8601String : nil
            )

            do {
                _ = try await taskService.updateTask(id: task.id, update)
                dismiss()
            } catch {
                print("Failed to save task: \(error)")
            }
        }
    }

    private func deleteTask() {
        Task {
            do {
                try await taskService.deleteTask(id: task.id)
                dismiss()
            } catch {
                print("Failed to delete task: \(error)")
            }
        }
    }

    private func completeSubtask(_ subtask: JDTask) {
        Task {
            do {
                if subtask.isCompleted {
                    _ = try await taskService.reopenTask(id: subtask.id)
                } else {
                    _ = try await taskService.completeTask(id: subtask.id)
                }
                await loadSubtasks()
            } catch {
                print("Failed to toggle subtask: \(error)")
            }
        }
    }

    private func addSubtask() {
        guard !newSubtaskTitle.isEmpty else { return }

        Task {
            let input = CreateTaskInput(
                title: newSubtaskTitle,
                source: .manual,
                context: task.context
            )

            do {
                _ = try await taskService.createSubtask(parentId: task.id, input)
                newSubtaskTitle = ""
                await loadSubtasks()
            } catch {
                print("Failed to add subtask: \(error)")
            }
        }
    }
}

// MARK: - Supporting Views

struct QuickDateButton: View {
    let title: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.caption)
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(Color(.systemGray5))
                .clipShape(Capsule())
        }
        .buttonStyle(.plain)
    }
}

struct SubtaskRow: View {
    let subtask: JDTask
    let onToggle: () -> Void

    var body: some View {
        HStack {
            Button(action: onToggle) {
                Image(systemName: subtask.isCompleted ? "checkmark.circle.fill" : "circle")
                    .foregroundStyle(subtask.isCompleted ? .green : .gray)
            }
            .buttonStyle(.plain)

            Text(subtask.title)
                .strikethrough(subtask.isCompleted)
                .foregroundStyle(subtask.isCompleted ? .secondary : .primary)
        }
    }
}

// MARK: - Preview
#Preview {
    TaskDetailView(
        task: JDTask(
            id: "1",
            title: "Sample Task",
            description: "This is a sample task description",
            status: .today,
            priority: 3,
            dueDate: Date(),
            dueDateIsHard: false,
            source: .manual,
            context: "personal",
            taskContexts: ["home"],
            taskLabels: ["important"],
            createdAt: Date(),
            updatedAt: Date()
        )
    )
    .environmentObject(AppConfiguration.shared.createTaskService())
}
