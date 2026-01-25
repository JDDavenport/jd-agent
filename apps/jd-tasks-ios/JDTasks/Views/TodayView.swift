import SwiftUI

struct TodayView: View {
    @EnvironmentObject private var taskService: TaskService
    @Binding var refreshTrigger: UUID

    @State private var tasks: [JDTask] = []
    @State private var overdueTasks: [JDTask] = []
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var selectedTask: JDTask?

    // Inline quick add
    @State private var newTaskTitle = ""
    @State private var isAddingTask = false
    @FocusState private var isInputFocused: Bool

    private var incompleteTasks: [JDTask] {
        tasks.filter { !$0.isCompleted }
    }

    private var completedTasks: [JDTask] {
        tasks.filter { $0.isCompleted }
    }

    var body: some View {
        NavigationStack {
            List {
                if isLoading && tasks.isEmpty && overdueTasks.isEmpty {
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
                } else if incompleteTasks.isEmpty && overdueTasks.isEmpty {
                    VStack(spacing: 16) {
                        Image(systemName: "sun.max.fill")
                            .font(.system(size: 48))
                            .foregroundStyle(.orange)
                        Text("All Done!")
                            .font(.headline)
                        Text("You've completed all your tasks for today.")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 40)
                    .listRowBackground(Color.clear)

                    // Quick add even when empty
                    Section {
                        quickAddRow
                    }
                } else {
                        // Overdue section
                        if !overdueTasks.isEmpty {
                            Section {
                                ForEach(overdueTasks) { task in
                                    TaskRowView(task: task) {
                                        completeTask(task, from: .overdue)
                                    }
                                    .contentShape(Rectangle())
                                    .onTapGesture {
                                        selectedTask = task
                                    }
                                }
                            } header: {
                                Label("Overdue", systemImage: "exclamationmark.circle.fill")
                                    .foregroundStyle(.red)
                            }
                        }

                        // Today's tasks section
                        if !incompleteTasks.isEmpty {
                            Section("Today") {
                                ForEach(incompleteTasks) { task in
                                    TaskRowView(task: task) {
                                        completeTask(task, from: .today)
                                    }
                                    .contentShape(Rectangle())
                                    .onTapGesture {
                                        selectedTask = task
                                    }
                                    .swipeActions(edge: .trailing) {
                                        Button(role: .destructive) {
                                            deleteTask(task)
                                        } label: {
                                            Label("Delete", systemImage: "trash")
                                        }

                                        Button {
                                            moveTo(task, status: .upcoming)
                                        } label: {
                                            Label("Later", systemImage: "arrow.right")
                                        }
                                        .tint(.purple)
                                    }
                                    .swipeActions(edge: .leading, allowsFullSwipe: true) {
                                        Button {
                                            completeTask(task, from: .today)
                                        } label: {
                                            Label("Complete", systemImage: "checkmark")
                                        }
                                        .tint(.green)
                                    }
                                }
                            }
                        }

                        // Completed section (collapsible)
                        if !completedTasks.isEmpty {
                            Section("Completed") {
                                ForEach(completedTasks) { task in
                                    TaskRowView(task: task) {
                                        reopenTask(task)
                                    }
                                    .contentShape(Rectangle())
                                    .onTapGesture {
                                        selectedTask = task
                                    }
                                }
                            }
                        }

                        // Quick Add Row - at end of list
                        Section {
                            quickAddRow
                        }
                }
            }
            .listStyle(.insetGrouped)
            .navigationTitle("Today")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Text(Date(), style: .date)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
            }
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
                print("TodayView: refreshTrigger changed, reloading...")
                Task { await loadTasks() }
            }
        }
    }

    // MARK: - Quick Add Row (inline in list)

    private var quickAddRow: some View {
        HStack(spacing: 12) {
            Image(systemName: "plus.circle")
                .foregroundStyle(.orange)
                .font(.title3)

            TextField("Add task for today...", text: $newTaskTitle)
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
                            .foregroundStyle(.orange)
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
            async let todayResult = taskService.getTodayTasks()
            async let overdueResult = taskService.getOverdueTasks()

            tasks = try await todayResult
            overdueTasks = try await overdueResult
            print("TodayView: Loaded \(tasks.count) today tasks, \(overdueTasks.count) overdue")
        } catch {
            errorMessage = error.localizedDescription
            print("TodayView: Error loading tasks: \(error)")
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
                    status: .today,
                    source: .manual,
                    context: AppConfiguration.shared.defaultContext
                )
                let newTask = try await taskService.createTask(input)
                print("TodayView: Created task: \(newTask.title)")

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
                print("TodayView: Failed to create task: \(error)")
                await MainActor.run {
                    isAddingTask = false
                    errorMessage = "Failed to add task: \(error.localizedDescription)"
                }
            }
        }
    }

    // MARK: - Actions

    enum TaskListSource {
        case today, overdue
    }

    private func completeTask(_ task: JDTask, from source: TaskListSource) {
        Task {
            do {
                _ = try await taskService.completeTask(id: task.id)
                withAnimation {
                    switch source {
                    case .today:
                        if let index = tasks.firstIndex(where: { $0.id == task.id }) {
                            var updated = task
                            updated.status = .done
                            updated.completedAt = Date()
                            tasks[index] = updated
                        }
                    case .overdue:
                        overdueTasks.removeAll { $0.id == task.id }
                    }
                }
            } catch {
                print("Failed to complete task: \(error)")
            }
        }
    }

    private func reopenTask(_ task: JDTask) {
        Task {
            do {
                let updated = try await taskService.reopenTask(id: task.id)
                withAnimation {
                    if let index = tasks.firstIndex(where: { $0.id == task.id }) {
                        tasks[index] = updated
                    }
                }
            } catch {
                print("Failed to reopen task: \(error)")
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

    private func moveTo(_ task: JDTask, status: TaskStatus) {
        Task {
            do {
                let update = UpdateTaskInput(status: status)
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
    TodayView(refreshTrigger: .constant(UUID()))
        .environmentObject(AppConfiguration.shared.createTaskService())
}
