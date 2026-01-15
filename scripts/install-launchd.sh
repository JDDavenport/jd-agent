#!/bin/bash
# JD Agent - macOS LaunchAgent Installation Script
#
# This script installs a LaunchAgent that automatically starts
# the Docker Compose services when you log in to your Mac.
#
# Usage:
#   ./scripts/install-launchd.sh install    # Install and start
#   ./scripts/install-launchd.sh uninstall  # Stop and remove
#   ./scripts/install-launchd.sh status     # Check status
#   ./scripts/install-launchd.sh logs       # View logs

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
PLIST_NAME="dev.jdagent.docker"
PLIST_SOURCE="${SCRIPT_DIR}/launchd/${PLIST_NAME}.plist"
PLIST_DEST="$HOME/Library/LaunchAgents/${PLIST_NAME}.plist"
LOG_DIR="$HOME/Library/Logs"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_header() {
    echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║       JD Agent - macOS Auto-Start Configuration           ║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

check_docker() {
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}❌ Docker is not installed${NC}"
        echo "Please install Docker Desktop first: https://docker.com/products/docker-desktop"
        exit 1
    fi
    echo -e "${GREEN}✓ Docker is installed${NC}"
}

check_docker_running() {
    if ! docker info &> /dev/null; then
        echo -e "${YELLOW}⚠ Docker is not running${NC}"
        echo "Please start Docker Desktop first"
        return 1
    fi
    echo -e "${GREEN}✓ Docker is running${NC}"
    return 0
}

install() {
    print_header
    check_docker

    echo -e "${YELLOW}Installing LaunchAgent...${NC}"
    echo ""

    # Create LaunchAgents directory if needed
    mkdir -p "$HOME/Library/LaunchAgents"

    # Check if plist source exists
    if [ ! -f "$PLIST_SOURCE" ]; then
        echo -e "${RED}❌ Plist file not found: ${PLIST_SOURCE}${NC}"
        exit 1
    fi

    # Update paths in plist to match current user
    sed "s|/Users/jddavenport|$HOME|g" "$PLIST_SOURCE" > "$PLIST_DEST"

    # Also update the project directory path
    sed -i '' "s|/Users/jddavenport/Projects/JD Agent|${PROJECT_DIR}|g" "$PLIST_DEST"

    echo -e "${GREEN}✓ Plist installed to: ${PLIST_DEST}${NC}"

    # Unload if already loaded
    launchctl unload "$PLIST_DEST" 2>/dev/null || true

    # Load the agent
    launchctl load "$PLIST_DEST"
    echo -e "${GREEN}✓ LaunchAgent loaded${NC}"

    echo ""
    echo -e "${GREEN}Installation complete!${NC}"
    echo ""
    echo "The JD Agent backend will now:"
    echo "  • Start automatically when you log in"
    echo "  • Restart if it crashes"
    echo "  • Wait for Docker Desktop to be running"
    echo ""
    echo "Commands:"
    echo "  ./scripts/install-launchd.sh status    # Check status"
    echo "  ./scripts/install-launchd.sh logs      # View logs"
    echo "  ./scripts/install-launchd.sh uninstall # Remove"
    echo ""

    # Start immediately if Docker is running
    if check_docker_running; then
        echo ""
        echo -e "${YELLOW}Starting services now...${NC}"
        launchctl start "$PLIST_NAME"
        sleep 3
        status
    fi
}

uninstall() {
    print_header
    echo -e "${YELLOW}Uninstalling LaunchAgent...${NC}"
    echo ""

    # Stop the agent
    launchctl stop "$PLIST_NAME" 2>/dev/null || true
    echo -e "${GREEN}✓ Service stopped${NC}"

    # Unload the agent
    launchctl unload "$PLIST_DEST" 2>/dev/null || true
    echo -e "${GREEN}✓ LaunchAgent unloaded${NC}"

    # Remove the plist
    rm -f "$PLIST_DEST"
    echo -e "${GREEN}✓ Plist removed${NC}"

    echo ""
    echo -e "${GREEN}Uninstallation complete!${NC}"
    echo ""
    echo "Note: Docker containers are still running."
    echo "To stop them: docker compose down"
}

status() {
    echo -e "${BLUE}Service Status:${NC}"
    echo ""

    # Check if plist is installed
    if [ ! -f "$PLIST_DEST" ]; then
        echo -e "${YELLOW}⚠ LaunchAgent not installed${NC}"
        echo "Run: ./scripts/install-launchd.sh install"
        return
    fi
    echo -e "${GREEN}✓ LaunchAgent installed${NC}"

    # Check if loaded
    if launchctl list | grep -q "$PLIST_NAME"; then
        echo -e "${GREEN}✓ LaunchAgent loaded${NC}"
    else
        echo -e "${YELLOW}⚠ LaunchAgent not loaded${NC}"
    fi

    echo ""
    echo -e "${BLUE}Docker Container Status:${NC}"
    echo ""

    # Check Docker containers
    if check_docker_running; then
        docker compose -f "$PROJECT_DIR/docker-compose.yml" ps
    fi

    echo ""
    echo -e "${BLUE}Health Check:${NC}"
    echo ""
    if curl -sf http://localhost:3000/api/health > /dev/null 2>&1; then
        echo -e "${GREEN}✓ API is responding${NC}"
        curl -s http://localhost:3000/api/health | jq . 2>/dev/null || curl -s http://localhost:3000/api/health
    else
        echo -e "${RED}✗ API is not responding${NC}"
    fi
}

logs() {
    echo -e "${BLUE}JD Agent Docker Logs:${NC}"
    echo ""

    if [ -f "$LOG_DIR/jd-agent-docker.log" ]; then
        echo "=== stdout ==="
        tail -50 "$LOG_DIR/jd-agent-docker.log"
    fi

    if [ -f "$LOG_DIR/jd-agent-docker.error.log" ]; then
        echo ""
        echo "=== stderr ==="
        tail -50 "$LOG_DIR/jd-agent-docker.error.log"
    fi

    echo ""
    echo "For Docker container logs:"
    echo "  docker compose logs -f hub      # Hub API logs"
    echo "  docker compose logs -f worker   # Worker logs"
    echo "  docker compose logs -f scheduler # Scheduler logs"
}

# Main
case "${1:-}" in
    install)
        install
        ;;
    uninstall|remove)
        uninstall
        ;;
    status)
        status
        ;;
    logs)
        logs
        ;;
    start)
        launchctl start "$PLIST_NAME"
        echo "Started. Check status: ./scripts/install-launchd.sh status"
        ;;
    stop)
        launchctl stop "$PLIST_NAME"
        echo "Stopped."
        ;;
    restart)
        launchctl stop "$PLIST_NAME" 2>/dev/null || true
        sleep 2
        launchctl start "$PLIST_NAME"
        echo "Restarted. Check status: ./scripts/install-launchd.sh status"
        ;;
    *)
        echo "JD Agent - macOS Auto-Start Manager"
        echo ""
        echo "Usage: $0 {install|uninstall|status|logs|start|stop|restart}"
        echo ""
        echo "Commands:"
        echo "  install   - Install LaunchAgent for auto-start on login"
        echo "  uninstall - Remove LaunchAgent"
        echo "  status    - Show current status of services"
        echo "  logs      - View service logs"
        echo "  start     - Manually start services"
        echo "  stop      - Manually stop services"
        echo "  restart   - Restart services"
        ;;
esac
