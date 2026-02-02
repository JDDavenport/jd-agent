# Study Aide Desktop Agent

A menu bar app that syncs your learning materials to Study Aide.

## Features

- **Canvas LMS**: Sync courses, assignments, and materials via API token
- **Plaud**: Watch PlaudSync folder for new lecture recordings
- **Remarkable**: Sync handwritten notes via device token

## Development

```bash
# Install dependencies
npm install

# Start development
npm run dev

# Build for production
npm run build

# Package DMG for macOS
npm run package:dmg
```

## How It Works

1. **Login**: Sign in with your Study Aide account
2. **Connect Sources**: 
   - Canvas: Paste your API token (from Canvas → Settings → New Access Token)
   - Plaud: Select your PlaudSync folder
   - Remarkable: Enter device token
3. **Auto-Sync**: The agent watches for changes and syncs automatically

## Architecture

```
src/
├── main/
│   ├── index.ts       # Main Electron process
│   ├── preload.ts     # IPC bridge to renderer
│   └── sync/
│       ├── canvas.ts    # Canvas API sync
│       ├── plaud.ts     # Plaud folder watcher
│       └── remarkable.ts # Remarkable cloud sync
└── renderer/
    ├── App.tsx        # React UI
    └── index.css      # Styles
```

## API Endpoints Used

- `POST /api/study-help/auth/login` - User authentication
- `POST /api/canvas/connect` - Connect Canvas account
- `POST /api/canvas/sync` - Trigger Canvas sync
- `POST /api/sync/plaud` - Upload Plaud transcript
- `POST /api/sync/remarkable/connect` - Connect Remarkable
- `POST /api/sync/remarkable/note` - Upload Remarkable note

## Building

Requires:
- Node.js 18+
- macOS for DMG packaging

```bash
# Build and package
npm run package:dmg

# Output in release/ folder
```
