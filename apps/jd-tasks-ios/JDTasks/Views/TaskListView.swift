import SwiftUI

struct TaskListView: View {
    let tasks: [JDTask]
    let emptyTitle: String
    let emptyMessage: String
    let onComplete: (JDTask) -> Void
    let onSelect: (JDTask) -> Void

    @State private var selectedTask: JDTask?

    var body: some View {
        Group {
            if tasks.isEmpty {
                EmptyStateView(
                    emptyTitle,
                    systemImage: "checkmark.circle",
                    description: emptyMessage
                )
            } else {
                List {
                    ForEach(tasks) { task in
                        TaskRowView(
                            task: task,
                            onComplete: { onComplete(task) }
                        )
                        .contentShape(Rectangle())
                        .onTapGesture {
                            selectedTask = task
                            onSelect(task)
                        }
                    }
                }
                .listStyle(.plain)
            }
        }
        .sheet(item: $selectedTask) { task in
            TaskDetailView(task: task)
        }
    }
}

// MARK: - Grouped Task List
struct GroupedTaskListView: View {
    let groupedTasks: [(title: String, tasks: [JDTask])]
    let emptyTitle: String
    let emptyMessage: String
    let onComplete: (JDTask) -> Void
    let onSelect: (JDTask) -> Void

    @State private var selectedTask: JDTask?

    var body: some View {
        Group {
            if groupedTasks.allSatisfy({ $0.tasks.isEmpty }) {
                EmptyStateView(
                    emptyTitle,
                    systemImage: "checkmark.circle",
                    description: emptyMessage
                )
            } else {
                List {
                    ForEach(groupedTasks, id: \.title) { group in
                        if !group.tasks.isEmpty {
                            Section(group.title) {
                                ForEach(group.tasks) { task in
                                    TaskRowView(
                                        task: task,
                                        onComplete: { onComplete(task) }
                                    )
                                    .contentShape(Rectangle())
                                    .onTapGesture {
                                        selectedTask = task
                                        onSelect(task)
                                    }
                                }
                            }
                        }
                    }
                }
                .listStyle(.insetGrouped)
            }
        }
        .sheet(item: $selectedTask) { task in
            TaskDetailView(task: task)
        }
    }
}

// MARK: - Preview
#Preview("Task List") {
    TaskListView(
        tasks: [],
        emptyTitle: "No Tasks",
        emptyMessage: "Add a task to get started",
        onComplete: { _ in },
        onSelect: { _ in }
    )
}
