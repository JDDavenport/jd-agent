import SwiftUI

struct TaskRowView: View {
    let task: JDTask
    let onComplete: () -> Void

    @State private var isAnimating = false

    var body: some View {
        HStack(spacing: 12) {
            // Completion checkbox
            Button(action: {
                withAnimation(.spring(response: 0.3, dampingFraction: 0.6)) {
                    isAnimating = true
                }
                onComplete()

                // Reset animation state
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                    isAnimating = false
                }
            }) {
                ZStack {
                    Circle()
                        .stroke(task.isCompleted ? Color.green : Color.gray.opacity(0.5), lineWidth: 2)
                        .frame(width: 24, height: 24)

                    if task.isCompleted {
                        Circle()
                            .fill(Color.green)
                            .frame(width: 24, height: 24)

                        Image(systemName: "checkmark")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundStyle(.white)
                    }
                }
                .scaleEffect(isAnimating ? 1.2 : 1.0)
            }
            .buttonStyle(.plain)

            // Task content
            VStack(alignment: .leading, spacing: 4) {
                // Title row
                HStack(spacing: 6) {
                    Text(task.title)
                        .font(.body)
                        .strikethrough(task.isCompleted)
                        .foregroundStyle(task.isCompleted ? .secondary : .primary)
                        .lineLimit(2)

                    if let priorityLabel = task.priorityLabel {
                        PriorityBadge(priority: task.priority)
                    }
                }

                // Metadata row
                HStack(spacing: 8) {
                    // Due date
                    if let dueDate = task.formattedDueDate {
                        HStack(spacing: 4) {
                            Image(systemName: "calendar")
                            Text(dueDate)
                        }
                        .font(.caption)
                        .foregroundStyle(task.isOverdue ? .red : .secondary)
                    }

                    // Context
                    if let contexts = task.taskContexts, let first = contexts.first {
                        Text("@\(first)")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }

                    // Labels
                    if let labels = task.taskLabels, !labels.isEmpty {
                        ForEach(labels.prefix(2), id: \.self) { label in
                            Text("#\(label)")
                                .font(.caption)
                                .foregroundStyle(.blue)
                        }
                    }

                    // Subtask count
                    if let progress = task.subtaskProgress {
                        HStack(spacing: 2) {
                            Image(systemName: "list.bullet")
                            Text(progress)
                        }
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    }

                    // Time estimate
                    if let minutes = task.timeEstimateMinutes {
                        HStack(spacing: 2) {
                            Image(systemName: "clock")
                            Text(formatTimeEstimate(minutes))
                        }
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    }

                    // Recurring indicator
                    if task.isRecurring {
                        Image(systemName: "repeat")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
            }

            Spacer()

            // Chevron
            Image(systemName: "chevron.right")
                .font(.caption)
                .foregroundStyle(.tertiary)
        }
        .padding(.vertical, 6)
        .contentShape(Rectangle())
    }

    private func formatTimeEstimate(_ minutes: Int) -> String {
        if minutes >= 60 {
            let hours = minutes / 60
            let remaining = minutes % 60
            if remaining > 0 {
                return "\(hours)h\(remaining)m"
            }
            return "\(hours)h"
        }
        return "\(minutes)m"
    }
}

// MARK: - Priority Badge
struct PriorityBadge: View {
    let priority: Int

    var body: some View {
        Text(label)
            .font(.caption2.bold())
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(color.opacity(0.2))
            .foregroundStyle(color)
            .clipShape(Capsule())
    }

    private var label: String {
        switch priority {
        case 4: return "P1"
        case 3: return "P2"
        case 2: return "P3"
        case 1: return "P4"
        default: return ""
        }
    }

    private var color: Color {
        switch priority {
        case 4: return .red
        case 3: return .orange
        case 2: return .yellow
        case 1: return .blue
        default: return .gray
        }
    }
}

// MARK: - Preview
#Preview("Task Row") {
    List {
        TaskRowView(
            task: JDTask(
                id: "1",
                title: "Buy groceries",
                status: .inbox,
                priority: 3,
                dueDate: Date(),
                dueDateIsHard: false,
                source: .manual,
                context: "personal",
                taskContexts: ["errands"],
                taskLabels: ["shopping"],
                subtaskCount: 3,
                completedSubtaskCount: 1,
                createdAt: Date(),
                updatedAt: Date()
            ),
            onComplete: {}
        )

        TaskRowView(
            task: JDTask(
                id: "2",
                title: "Completed task example",
                status: .done,
                priority: 0,
                dueDateIsHard: false,
                source: .manual,
                context: "personal",
                createdAt: Date(),
                updatedAt: Date(),
                completedAt: Date()
            ),
            onComplete: {}
        )
    }
}
