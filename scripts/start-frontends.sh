#!/bin/bash
# JD Agent - Start Frontend Apps
# Starts command-center, tasks, and vault apps

cd "/Users/jddavenport/Projects/JD Agent"

# Wait for Hub to be ready
echo "Waiting for Hub API..."
for i in {1..30}; do
  if curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
    echo "Hub is ready!"
    break
  fi
  sleep 2
done

# Start Tauri desktop apps in background
echo "Starting JD Command Center (Tauri)..."
export PATH="/opt/homebrew/opt/rustup/bin:$PATH"
if [ -d "/Applications/JD Command Center.app" ]; then
  if [ "${JD_SKIP_COMMAND_CENTER_INSTALL:-}" != "1" ]; then
    echo "Updating Command Center app bundle..."
    /bin/bash "/Users/jddavenport/Projects/JD Agent/scripts/install-command-center-app.sh"
  fi
  open -a "/Applications/JD Command Center.app"
else
  cd "/Users/jddavenport/Projects/JD Agent/apps/command-center"
  /Users/jddavenport/.bun/bin/bun run tauri:dev > /tmp/command-center.log 2>&1 &
fi

echo "Starting JD Tasks (Tauri)..."
cd "/Users/jddavenport/Projects/JD Agent/apps/tasks"
export PATH="/opt/homebrew/opt/rustup/bin:$PATH"
/Users/jddavenport/.bun/bin/bun run tauri:dev > /tmp/tasks-app.log 2>&1 &

echo "Starting JD Vault (Tauri)..."
cd "/Users/jddavenport/Projects/JD Agent/apps/vault"
export PATH="/opt/homebrew/opt/rustup/bin:$PATH"
/Users/jddavenport/.bun/bin/bun run tauri:dev > /tmp/vault-app.log 2>&1 &

echo "All Tauri desktop apps started!"
echo "  - JD Command Center (Desktop)"
echo "  - JD Tasks (Desktop)"
echo "  - JD Vault (Desktop)"

# Keep script running so LaunchAgent doesn't kill child processes
wait
