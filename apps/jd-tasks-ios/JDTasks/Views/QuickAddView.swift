import SwiftUI

struct QuickAddView: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var taskService: TaskService

    @State private var input = ""
    @State private var parsedTask: ParsedTask?
    @State private var isSubmitting = false
    @State private var errorMessage: String?

    @FocusState private var isFocused: Bool

    var body: some View {
        NavigationStack {
            VStack(spacing: 20) {
                // Text input
                VStack(alignment: .leading, spacing: 8) {
                    TextField("What needs to be done?", text: $input, axis: .vertical)
                        .font(.body)
                        .padding()
                        .background(Color(.systemGray6))
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                        .focused($isFocused)
                        .onChange(of: input) { newValue in
                            parsedTask = NaturalLanguageParser.parse(newValue)
                        }
                        .submitLabel(.done)
                        .onSubmit {
                            if !input.isEmpty {
                                addTask()
                            }
                        }

                    Text("Try: \"Buy milk tomorrow p2 @errands #shopping\"")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                // Parsed preview
                if let parsed = parsedTask, parsed.hasParsedData {
                    ParsedPreviewView(parsed: parsed)
                }

                // Quick action buttons
                VStack(spacing: 12) {
                    Text("Quick Set")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity, alignment: .leading)

                    HStack(spacing: 12) {
                        QuickActionButton(icon: "sun.max", label: "Today", color: .orange) {
                            appendToInput(" today")
                        }
                        QuickActionButton(icon: "sunrise", label: "Tomorrow", color: .blue) {
                            appendToInput(" tomorrow")
                        }
                        QuickActionButton(icon: "calendar", label: "Next Week", color: .purple) {
                            appendToInput(" next week")
                        }
                    }

                    HStack(spacing: 12) {
                        QuickActionButton(icon: "flag.fill", label: "P1", color: .red) {
                            appendToInput(" p1")
                        }
                        QuickActionButton(icon: "flag.fill", label: "P2", color: .orange) {
                            appendToInput(" p2")
                        }
                        QuickActionButton(icon: "flag.fill", label: "P3", color: .yellow) {
                            appendToInput(" p3")
                        }
                    }
                }

                if let error = errorMessage {
                    Text(error)
                        .font(.caption)
                        .foregroundStyle(.red)
                        .padding()
                        .background(Color.red.opacity(0.1))
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                }

                Spacer()
            }
            .padding()
            .navigationTitle("Add Task")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Add") {
                        addTask()
                    }
                    .disabled(input.trimmingCharacters(in: .whitespaces).isEmpty || isSubmitting)
                    .fontWeight(.semibold)
                }
            }
            .onAppear {
                isFocused = true
            }
        }
    }

    // MARK: - Helper Methods

    private func appendToInput(_ text: String) {
        input += text
        parsedTask = NaturalLanguageParser.parse(input)
    }

    private func addTask() {
        guard !input.trimmingCharacters(in: .whitespaces).isEmpty else { return }

        isSubmitting = true
        errorMessage = nil

        let parsed = parsedTask ?? ParsedTask(title: input)

        Task {
            defer { isSubmitting = false }

            let createInput = CreateTaskInput(
                title: parsed.title,
                description: nil,
                status: .inbox,
                priority: parsed.priority ?? 0,
                dueDate: parsed.dueDate?.iso8601String,
                source: .manual,
                context: AppConfiguration.shared.defaultContext,
                taskContexts: parsed.contexts,
                taskLabels: parsed.labels,
                timeEstimateMinutes: parsed.timeEstimate
            )

            do {
                _ = try await taskService.createTask(createInput)
                dismiss()
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }
}

// MARK: - Parsed Preview View
struct ParsedPreviewView: View {
    let parsed: ParsedTask

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Parsed:")
                .font(.caption)
                .foregroundStyle(.secondary)

            HStack(spacing: 12) {
                // Due date
                if let date = parsed.formattedDueDate {
                    HStack(spacing: 4) {
                        Image(systemName: "calendar")
                        Text(date)
                    }
                    .font(.caption)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(Color.blue.opacity(0.1))
                    .foregroundStyle(.blue)
                    .clipShape(Capsule())
                }

                // Priority
                if let priority = parsed.priorityLabel {
                    HStack(spacing: 4) {
                        Image(systemName: "flag.fill")
                        Text(priority)
                    }
                    .font(.caption)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(priorityColor.opacity(0.1))
                    .foregroundStyle(priorityColor)
                    .clipShape(Capsule())
                }

                // Contexts
                if let contexts = parsed.contexts {
                    ForEach(contexts, id: \.self) { ctx in
                        Text("@\(ctx)")
                            .font(.caption)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(Color.green.opacity(0.1))
                            .foregroundStyle(.green)
                            .clipShape(Capsule())
                    }
                }

                // Labels
                if let labels = parsed.labels {
                    ForEach(labels, id: \.self) { label in
                        Text("#\(label)")
                            .font(.caption)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(Color.purple.opacity(0.1))
                            .foregroundStyle(.purple)
                            .clipShape(Capsule())
                    }
                }

                // Time estimate
                if let time = parsed.formattedTimeEstimate {
                    HStack(spacing: 4) {
                        Image(systemName: "clock")
                        Text(time)
                    }
                    .font(.caption)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(Color.orange.opacity(0.1))
                    .foregroundStyle(.orange)
                    .clipShape(Capsule())
                }
            }
        }
        .padding()
        .background(Color(.systemGray6))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    private var priorityColor: Color {
        guard let priority = parsed.priority else { return .gray }
        switch priority {
        case 4: return .red
        case 3: return .orange
        case 2: return .yellow
        default: return .blue
        }
    }
}

// MARK: - Quick Action Button
struct QuickActionButton: View {
    let icon: String
    let label: String
    let color: Color
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 6) {
                Image(systemName: icon)
                    .font(.title3)
                    .foregroundStyle(color)
                Text(label)
                    .font(.caption2)
                    .foregroundStyle(.primary)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 12)
            .background(Color(.systemGray6))
            .clipShape(RoundedRectangle(cornerRadius: 12))
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Preview
#Preview {
    QuickAddView()
        .environmentObject(AppConfiguration.shared.createTaskService())
}
