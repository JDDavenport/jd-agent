# JD Tasks iOS App

Native iOS Tasks app with full Siri integration, connecting to the JD Agent Hub backend.

## Features

- **Full Siri Integration** - "Hey Siri, add buy milk to my tasks"
- **Quick Add** - Natural language task creation with parsing
- **GTD Workflow** - Inbox, Today, Upcoming views
- **Nested Tasks** - Create and manage subtasks
- **Labels & Contexts** - Organize with @contexts and #labels
- **Swipe Actions** - Complete, move to today, delete

## Requirements

- iOS 16.0+
- Xcode 15.0+
- Swift 5.9+
- Apple Developer Account (for Siri Intents)

## Setup Instructions

### 1. Create Xcode Project

1. Open Xcode
2. File → New → Project
3. Select "App" under iOS
4. Configure:
   - Product Name: `JDTasks`
   - Team: Your Apple Developer Team
   - Organization Identifier: `com.jdagent`
   - Bundle Identifier: `com.jdagent.tasks-ios`
   - Interface: SwiftUI
   - Language: Swift
   - Minimum Deployments: iOS 16.0

### 2. Add Source Files

1. Delete the default `ContentView.swift` that Xcode created
2. Drag all files from `JDTasks/` folder into your Xcode project
3. Make sure "Copy items if needed" is checked
4. Ensure all files are added to the JDTasks target

### 3. Configure Info.plist

Replace the default Info.plist with the one from `JDTasks/Resources/Info.plist`, or add these keys:

```xml
<key>NSAppTransportSecurity</key>
<dict>
    <key>NSAllowsLocalNetworking</key>
    <true/>
</dict>

<key>NSSiriUsageDescription</key>
<string>Use Siri to quickly add, view, and complete tasks.</string>

<key>NSLocalNetworkUsageDescription</key>
<string>JD Tasks needs to connect to your local JD Agent Hub server.</string>
```

### 4. Add Capabilities

In Xcode, go to your target's "Signing & Capabilities" tab and add:

1. **Siri** - Required for voice commands
2. **App Groups** (optional) - For widget data sharing
3. **Background Modes** → Background fetch (optional)

### 5. Build and Run

1. Select your device or simulator
2. Press ⌘+R to build and run
3. On first launch, grant Siri permission when prompted

## Siri Phrases

### Adding Tasks
- "Hey Siri, add buy milk to my tasks in JD Tasks"
- "Hey Siri, add call mom tomorrow p1 in JD Tasks"
- "Hey Siri, create task finish report in JD Tasks"

### Viewing Tasks
- "Hey Siri, what are my tasks today in JD Tasks"
- "Hey Siri, what's in my inbox in JD Tasks"
- "Hey Siri, what tasks are overdue in JD Tasks"
- "Hey Siri, how many tasks do I have in JD Tasks"

### Completing Tasks
- "Hey Siri, complete buy milk in JD Tasks"
- "Hey Siri, mark report as done in JD Tasks"

## Quick Add Syntax

The quick add feature supports natural language:

```
Buy groceries tomorrow p2 @errands #shopping ~30m
```

- `tomorrow`, `today`, `monday`, etc. → Due date
- `p1`, `p2`, `p3`, `p4` → Priority (1=highest)
- `@context` → Context tag
- `#label` → Label tag
- `~30m`, `~1h` → Time estimate

## Server Configuration

By default, the app connects to `http://localhost:3000`. For device testing:

1. Find your Mac's IP address (System Settings → Network)
2. Go to Settings → Server in the app
3. Enter `http://YOUR_IP:3000`
4. Test the connection

Make sure your Hub server is running:
```bash
cd hub && bun run dev
```

## Project Structure

```
JDTasks/
├── App/
│   └── JDTasksApp.swift          # App entry point
├── Models/
│   ├── Task.swift                # Task model & enums
│   └── APIResponse.swift         # API response types
├── Services/
│   ├── APIClient.swift           # HTTP client
│   ├── TaskService.swift         # Task API methods
│   ├── AppConfiguration.swift    # Settings manager
│   └── NaturalLanguageParser.swift
├── Views/
│   ├── ContentView.swift         # Tab bar root
│   ├── InboxView.swift           # Inbox tab
│   ├── TodayView.swift           # Today tab
│   ├── UpcomingView.swift        # Upcoming tab
│   ├── TaskListView.swift        # Reusable task list
│   ├── TaskRowView.swift         # Single task row
│   ├── TaskDetailView.swift      # Task editing
│   ├── QuickAddView.swift        # Quick add modal
│   └── SettingsView.swift        # Settings tab
├── Intents/
│   ├── TaskEntity.swift          # Siri entity type
│   ├── AddTaskIntent.swift       # Add task intent
│   ├── CompleteTaskIntent.swift  # Complete task intent
│   ├── ListTasksIntent.swift     # List tasks intents
│   └── TaskShortcuts.swift       # Shortcuts provider
├── Extensions/
│   └── Date+Extensions.swift     # Date helpers
└── Resources/
    └── Info.plist                # App configuration
```

## Troubleshooting

### Siri not working
1. Check that Siri is enabled in iOS Settings
2. Ensure you granted Siri permission to the app
3. Try phrases that include "in JD Tasks" at the end
4. Check that the app has the Siri capability in Xcode

### Connection errors
1. Verify Hub is running (`curl http://localhost:3000/api/health`)
2. For device testing, use your Mac's IP address
3. Ensure both devices are on the same network
4. Check that NSAllowsLocalNetworking is true in Info.plist

### Tasks not syncing
1. Pull-to-refresh in any list view
2. Check server URL in Settings
3. Test connection in Settings
