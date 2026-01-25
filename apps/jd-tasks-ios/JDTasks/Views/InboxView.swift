import SwiftUI

struct InboxView: View {
    @EnvironmentObject private var taskService: TaskService
    @Binding var refreshTrigger: UUID

    @State private var tasks: [JDTask] = []
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var selectedTask: JDTask?

    // Inline quick add
    @State private var newTaskTitle = ""
    @State private var isAddingTask = false
    @FocusState private var isInputFocused: Bool

    var body: some View {
        NavigationStack {
            List {
                if isLoading && tasks.isEmpty {
                    HStack {
                        Spacer()
                        ProgressView("Loading...")
                        Spacer()
                    }
                    .listRowBackground(Color.clear)
                } else if let error = errorMessage {
                    VStack(spacing: 16) {
                        Image(systemName: "wifi.slash")
                            .font(.system(size: 48))
                            .foregroundStyle(.secondary)
                        Text("Connection Error")
                            .font(.headline)
                        Text(error)
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                            .multilineTextAlignment(.center)
                        Button("Retry") {
                            Task { await loadTasks() }
                        }
                        .buttonStyle(.borderedProminent)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 40)
                    .listRowBackground(Color.clear)
                } else if tasks.isEmpty {
                    VStack(spacing: 16) {
                        Image(systemName: "tray")
                            .font(.system(size: 48))
                            .foregroundStyle(.secondary)
                        Text("Inbox Zero")
                            .font(.headline)
                        Text("Your inbox is empty. Nice work!")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 40)
                    .listRowBackground(Color.clear)

                    // Quick add row even when empty
                    quickAddRow
                } else {
                        ForEach(tasks) { task in
                            TaskRowView(task: task) {
                                completeTask(task)
                            }
                            .contentShape(Rectangle())
                            .onTapGesture {
                                selectedTask = task
                            }
                            .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                                Button(role: .destructive) {
                                    deleteTask(task)
                                } label: {
                                    Label("Delete", systemImage: "trash")
                                }

                                Button {
                                    moveToToday(task)
                                } label: {
                                    Label("Today", systemImage: "sun.max")
                                }
                                .tint(.orange)
                            }
                            .swipeActions(edge: .leading, allowsFullSwipe: true) {
                                Button {
                                    completeTask(task)
                                } label: {
                                    Label("Complete", systemImage: "checkmark")
                                }
                                .tint(.green)
                            }
                        }

                        // Inline Quick Add - right after tasks
                        quickAddRow
                }
            }
            .listStyle(.plain)
            .navigationTitle("Inbox")
            .refreshable {
                await loadTasks()
            }
            .task {
                await loadTasks()
            }
            .sheet(item: $selectedTask) { task in
                TaskDetailView(task: task)
                    .environmentObject(taskService)
            }
            .onChange(of: refreshTrigger) { _ in
                print("InboxView: refreshTrigger changed, reloading...")
                Task { await loadTasks() }
            }
        }
    }

    // MARK: - Quick Add Row (inline in list)

    private var quickAddRow: some View {
        HStack(spacing: 12) {
            Image(systemName: "plus.circle")
                .foregroundStyle(.blue)
                .font(.title3)

            TextField("Add task...", text: $newTaskTitle)
                .textFieldStyle(.plain)
                .focused($isInputFocused)
                .submitLabel(.done)
                .onSubmit {
                    addTask()
                }

            if !newTaskTitle.isEmpty {
                if isAddingTask {
                    ProgressView()
                        .scaleEffect(0.8)
                } else {
                    Button {
                        addTask()
                    } label: {
                        Image(systemName: "arrow.up.circle.fill")
                            .font(.title3)
                            .foregroundStyle(.blue)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .padding(.vertical, 4)
    }

    // MARK: - Data Loading

    private func loadTasks() async {
        isLoading = true
        errorMessage = nil

        do {
            tasks = try await taskService.getInboxTasks()
            print("InboxView: Loaded \(tasks.count) tasks")
        } catch {
            errorMessage = error.localizedDescription
            print("InboxView: Error loading tasks: \(error)")
        }

        isLoading = false
    }

    // MARK: - Add Task

    private func addTask() {
        let title = newTaskTitle.trimmingCharacters(in: .whitespaces)
        guard !title.isEmpty else { return }

        isAddingTask = true

        Task {
            do {
                let input = CreateTaskInput(
                    title: title,
                    status: .inbox,
                    source: .manual,
                    context: AppConfiguration.shared.defaultContext
                )
                let newTask = try await taskService.createTask(input)
                print("InboxView: Created task: \(newTask.title)")

                await MainActor.run {
                    withAnimation {
                        tasks.append(newTask)
                    }
                    newTaskTitle = ""
                    isAddingTask = false
                    // Keep focus for rapid-fire entry
                    isInputFocused = true
                }
            } catch {
                print("InboxView: Failed to create task: \(error)")
                await MainActor.run {
                    isAddingTask = false
                    errorMessage = "Failed to add task: \(error.localizedDescription)"
                }
            }
        }
    }

    // MARK: - Actions

    private func completeTask(_ task: JDTask) {
        Task {
            do {
                _ = try await taskService.completeTask(id: task.id)
                withAnimation {
                    tasks.removeAll { $0.id == task.id }
                }
            } catch {
                print("Failed to complete task: \(error)")
            }
        }
    }

    private func deleteTask(_ task: JDTask) {
        Task {
            do {
                try await taskService.deleteTask(id: task.id)
                withAnimation {
                    tasks.removeAll { $0.id == task.id }
                }
            } catch {
                print("Failed to delete task: \(error)")
            }
        }
    }

    private func moveToToday(_ task: JDTask) {
        Task {
            do {
                let update = UpdateTaskInput(status: .today)
                _ = try await taskService.updateTask(id: task.id, update)
                withAnimation {
                    tasks.removeAll { $0.id == task.id }
                }
            } catch {
                print("Failed to move task: \(error)")
            }
        }
    }
}

// MARK: - Preview
#Preview {
    InboxView(refreshTrigger: .constant(UUID()))
        .environmentObject(AppConfiguration.shared.createTaskService())
}
