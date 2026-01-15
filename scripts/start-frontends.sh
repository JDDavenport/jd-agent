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

# Start frontends in background
echo "Starting Command Center on port 5173..."
cd "/Users/jddavenport/Projects/JD Agent/apps/command-center"
/Users/jddavenport/.bun/bin/bun run dev > /tmp/command-center.log 2>&1 &

echo "Starting Tasks on port 5180..."
cd "/Users/jddavenport/Projects/JD Agent/apps/tasks"
/Users/jddavenport/.bun/bin/bun run dev > /tmp/tasks-app.log 2>&1 &

echo "Starting Vault on port 5181..."
cd "/Users/jddavenport/Projects/JD Agent/apps/vault"
/Users/jddavenport/.bun/bin/bun run dev > /tmp/vault-app.log 2>&1 &

echo "All frontends started!"
echo "  - Command Center: http://localhost:5173"
echo "  - Tasks: http://localhost:5180"
echo "  - Vault: http://localhost:5181"
