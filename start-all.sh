#!/bin/bash
# JD Agent - Full Stack Startup
# Starts: Hub, Worker, Scheduler
# Auto-syncs: Plaud recordings every 30 minutes

set -e

PROJECT_DIR="/Users/jddavenport/Projects/JD Agent"
LOG_DIR="$PROJECT_DIR/logs"

# Create log directory
mkdir -p "$LOG_DIR"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}"
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  JD Agent - Full Stack Startup                               ║"
echo "║  Starting: Hub + Worker + Scheduler                          ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Function to cleanup on exit
cleanup() {
    echo -e "\n${YELLOW}Shutting down all services...${NC}"
    kill $HUB_PID $WORKER_PID $SCHEDULER_PID 2>/dev/null || true
    exit 0
}

trap cleanup SIGINT SIGTERM

# Start Hub (API server)
echo -e "${GREEN}Starting Hub...${NC}"
cd "$PROJECT_DIR/hub"
bun run dev > "$LOG_DIR/hub.log" 2>&1 &
HUB_PID=$!
echo "  Hub PID: $HUB_PID"
sleep 3

# Verify Hub started
if curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
    echo -e "  ${GREEN}✓ Hub healthy${NC}"
else
    echo -e "  ${YELLOW}⚠ Hub may still be starting...${NC}"
fi

# Start Worker (job processor)
echo -e "${GREEN}Starting Worker...${NC}"
bun run worker > "$LOG_DIR/worker.log" 2>&1 &
WORKER_PID=$!
echo "  Worker PID: $WORKER_PID"
sleep 2

# Start Scheduler (cron jobs)
echo -e "${GREEN}Starting Scheduler...${NC}"
bun run scheduler > "$LOG_DIR/scheduler.log" 2>&1 &
SCHEDULER_PID=$!
echo "  Scheduler PID: $SCHEDULER_PID"
sleep 2

echo ""
echo -e "${GREEN}All services started!${NC}"
echo ""
echo "Services:"
echo "  - Hub:       http://localhost:3000 (PID: $HUB_PID)"
echo "  - Worker:    Processing jobs (PID: $WORKER_PID)"
echo "  - Scheduler: Running cron jobs (PID: $SCHEDULER_PID)"
echo ""
echo "Plaud Sync:"
echo "  - Folder:    ~/Documents/PlaudSync"
echo "  - Auto-sync: Every 30 minutes"
echo "  - Watcher:   Active (real-time detection)"
echo ""
echo "Logs:"
echo "  - Hub:       $LOG_DIR/hub.log"
echo "  - Worker:    $LOG_DIR/worker.log"
echo "  - Scheduler: $LOG_DIR/scheduler.log"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop all services${NC}"
echo ""

# Tail logs
tail -f "$LOG_DIR/hub.log" "$LOG_DIR/worker.log" "$LOG_DIR/scheduler.log" 2>/dev/null &
TAIL_PID=$!

# Wait for any process to exit
wait $HUB_PID $WORKER_PID $SCHEDULER_PID

# Cleanup
cleanup
