import SwiftUI

struct UpcomingView: View {
    @EnvironmentObject private var taskService: TaskService
    @Binding var refreshTrigger: UUID

    @State private var tasks: [JDTask] = []
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var selectedTask: JDTask?
    @State private var daysAhead = 7

    // Inline quick add
    @State private var newTaskTitle = ""
    @State private var isAddingTask = false
    @FocusState private var isInputFocused: Bool

    private var groupedTasks: [(title: String, tasks: [JDTask])] {
        let calendar = Calendar.current
        let today = Date()

        var groups: [(String, [JDTask])] = []

        // Tomorrow
        let tomorrow = calendar.date(byAdding: .day, value: 1, to: today)!
        let tomorrowTasks = tasks.filter { task in
            guard let due = task.dueDate else { return false }
            return calendar.isDate(due, inSameDayAs: tomorrow)
        }
        if !tomorrowTasks.isEmpty {
            groups.append(("Tomorrow", tomorrowTasks))
        }

        // This week (after tomorrow)
        let thisWeekTasks = tasks.filter { task in
            guard let due = task.dueDate else { return false }
            let daysDiff = calendar.dateComponents([.day], from: today, to: due).day ?? 0
            return daysDiff > 1 && daysDiff <= 7
        }
        if !thisWeekTasks.isEmpty {
            groups.append(("This Week", thisWeekTasks))
        }

        // Next week
        let nextWeekTasks = tasks.filter { task in
            guard let due = task.dueDate else { return false }
            let daysDiff = calendar.dateComponents([.day], from: today, to: due).day ?? 0
            return daysDiff > 7 && daysDiff <= 14
        }
        if !nextWeekTasks.isEmpty {
            groups.append(("Next Week", nextWeekTasks))
        }

        // Later (beyond 2 weeks)
        let laterTasks = tasks.filter { task in
            guard let due = task.dueDate else { return false }
            let daysDiff = calendar.dateComponents([.day], from: today, to: due).day ?? 0
            return daysDiff > 14
        }
        if !laterTasks.isEmpty {
            groups.append(("Later", laterTasks))
        }

        // No due date
        let noDueDateTasks = tasks.filter { $0.dueDate == nil }
        if !noDueDateTasks.isEmpty {
            groups.append(("No Due Date", noDueDateTasks))
        }

        return groups
    }

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
                        Image(systemName: "calendar")
                            .font(.system(size: 48))
                            .foregroundStyle(.secondary)
                        Text("No Upcoming Tasks")
                            .font(.headline)
                        Text("Tasks with due dates will appear here.")
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
                        ForEach(groupedTasks, id: \.title) { group in
                            Section(group.title) {
                                ForEach(group.tasks) { task in
                                    TaskRowView(task: task) {
                                        completeTask(task)
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
                                    }
                                    .swipeActions(edge: .leading, allowsFullSwipe: true) {
                                        Button {
                                            moveToToday(task)
                                        } label: {
                                            Label("Today", systemImage: "sun.max")
                                        }
                                        .tint(.orange)
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
            .navigationTitle("Upcoming")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Menu {
                        Button {
                            daysAhead = 7
                            Task { await loadTasks() }
                        } label: {
                            Label("1 Week", systemImage: daysAhead == 7 ? "checkmark" : "")
                        }

                        Button {
                            daysAhead = 14
                            Task { await loadTasks() }
                        } label: {
                            Label("2 Weeks", systemImage: daysAhead == 14 ? "checkmark" : "")
                        }

                        Button {
                            daysAhead = 30
                            Task { await loadTasks() }
                        } label: {
                            Label("1 Month", systemImage: daysAhead == 30 ? "checkmark" : "")
                        }
                    } label: {
                        Image(systemName: "line.3.horizontal.decrease.circle")
                    }
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
                print("UpcomingView: refreshTrigger changed, reloading...")
                Task { await loadTasks() }
            }
        }
    }

    // MARK: - Quick Add Row (inline in list)

    private var quickAddRow: some View {
        HStack(spacing: 12) {
            Image(systemName: "plus.circle")
                .foregroundStyle(.purple)
                .font(.title3)

            TextField("Add upcoming task...", text: $newTaskTitle)
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
                            .foregroundStyle(.purple)
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
            tasks = try await taskService.getUpcomingTasks(days: daysAhead)
            print("UpcomingView: Loaded \(tasks.count) tasks")
        } catch {
            errorMessage = error.localizedDescription
            print("UpcomingView: Error loading tasks: \(error)")
        }

        isLoading = false
    }

    // MARK: - Add Task

    private func addTask() {
        let title = newTaskTitle.trimmingCharacters(in: .whitespaces)
        guard !title.isEmpty else { return }

        isAddingTask = true

        // Set due date to tomorrow
        let tomorrow = Calendar.current.date(byAdding: .day, value: 1, to: Date())!

        Task {
            do {
                let input = CreateTaskInput(
                    title: title,
                    status: .upcoming,
                    dueDate: tomorrow.iso8601String,
                    source: .manual,
                    context: AppConfiguration.shared.defaultContext
                )
                let newTask = try await taskService.createTask(input)
                print("UpcomingView: Created task: \(newTask.title)")

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
                print("UpcomingView: Failed to create task: \(error)")
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
    UpcomingView(refreshTrigger: .constant(UUID()))
        .environmentObject(AppConfiguration.shared.createTaskService())
}
