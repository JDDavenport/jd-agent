#!/bin/bash
# JD Agent - Local Backend Startup Script
#
# This script starts all local backend services using Docker Compose.
# Includes health checks, database migrations, and status reporting.
#
# Usage:
#   ./scripts/local-start.sh              # Start all services
#   ./scripts/local-start.sh --dev        # Start with logs attached
#   ./scripts/local-start.sh --rebuild    # Rebuild containers and start
#   ./scripts/local-start.sh --stop       # Stop all services
#   ./scripts/local-start.sh --status     # Show service status

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
COMPOSE_FILE="${PROJECT_DIR}/docker-compose.yml"
ENV_FILE="${PROJECT_DIR}/.env.local.docker"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

print_header() {
    echo -e "${BLUE}"
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║                                                              ║"
    echo "║     ██╗██████╗      █████╗  ██████╗ ███████╗███╗   ██╗████████╗"
    echo "║     ██║██╔══██╗    ██╔══██╗██╔════╝ ██╔════╝████╗  ██║╚══██╔══╝"
    echo "║     ██║██║  ██║    ███████║██║  ███╗█████╗  ██╔██╗ ██║   ██║   "
    echo "║██   ██║██║  ██║    ██╔══██║██║   ██║██╔══╝  ██║╚██╗██║   ██║   "
    echo "║╚█████╔╝██████╔╝    ██║  ██║╚██████╔╝███████╗██║ ╚████║   ██║   "
    echo "║ ╚════╝ ╚═════╝     ╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚═╝  ╚═══╝   ╚═╝   "
    echo "║                                                              ║"
    echo "║  Local Backend Startup                                       ║"
    echo "║                                                              ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    echo ""
}

check_requirements() {
    echo -e "${YELLOW}Checking requirements...${NC}"

    # Check Docker
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}❌ Docker is not installed${NC}"
        echo "Install Docker Desktop: https://docker.com/products/docker-desktop"
        exit 1
    fi
    echo -e "${GREEN}✓ Docker installed${NC}"

    # Check if Docker is running
    if ! docker info &> /dev/null; then
        echo -e "${RED}❌ Docker is not running${NC}"
        echo "Please start Docker Desktop first"
        exit 1
    fi
    echo -e "${GREEN}✓ Docker is running${NC}"

    # Check docker-compose.yml exists
    if [ ! -f "$COMPOSE_FILE" ]; then
        echo -e "${RED}❌ docker-compose.yml not found${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓ docker-compose.yml found${NC}"

    # Check .env.local.docker exists
    if [ ! -f "$ENV_FILE" ]; then
        echo -e "${YELLOW}⚠ .env.local.docker not found${NC}"
        echo ""
        echo "Creating from template..."
        if [ -f "${PROJECT_DIR}/.env.local.docker.example" ]; then
            cp "${PROJECT_DIR}/.env.local.docker.example" "$ENV_FILE"
            echo -e "${GREEN}✓ Created .env.local.docker from template${NC}"
            echo ""
            echo -e "${YELLOW}IMPORTANT: Edit .env.local.docker with your API keys before starting!${NC}"
            echo ""
            read -p "Press Enter when ready to continue..."
        else
            echo -e "${RED}❌ No template found. Create .env.local.docker manually.${NC}"
            exit 1
        fi
    fi
    echo -e "${GREEN}✓ Environment file found${NC}"

    echo ""
}

wait_for_service() {
    local service=$1
    local max_attempts=$2
    local url=$3
    local attempt=1

    while [ $attempt -le $max_attempts ]; do
        if curl -sf "$url" > /dev/null 2>&1; then
            return 0
        fi
        echo -ne "\r  Waiting for $service... (attempt $attempt/$max_attempts)"
        sleep 2
        attempt=$((attempt + 1))
    done

    echo ""
    return 1
}

start_services() {
    local rebuild="${1:-false}"
    local dev_mode="${2:-false}"

    print_header
    check_requirements

    echo -e "${YELLOW}Starting JD Agent backend services...${NC}"
    echo ""

    cd "$PROJECT_DIR"

    # Create data directories if they don't exist
    mkdir -p data/postgres data/redis

    # Build if requested
    if [ "$rebuild" = "true" ]; then
        echo -e "${YELLOW}Rebuilding containers...${NC}"
        docker compose build --no-cache
        echo ""
    fi

    # Start services
    if [ "$dev_mode" = "true" ]; then
        echo -e "${YELLOW}Starting in development mode (logs attached)...${NC}"
        echo "Press Ctrl+C to stop"
        echo ""
        docker compose up
    else
        echo -e "${YELLOW}Starting services in background...${NC}"
        docker compose up -d
    fi

    # Wait for services to be healthy
    if [ "$dev_mode" != "true" ]; then
        echo ""
        echo -e "${YELLOW}Waiting for services to be healthy...${NC}"
        echo ""

        # Wait for PostgreSQL
        echo -n "  PostgreSQL: "
        if docker compose exec -T postgres pg_isready -U jdagent > /dev/null 2>&1; then
            echo -e "${GREEN}healthy${NC}"
        else
            sleep 5
            if docker compose exec -T postgres pg_isready -U jdagent > /dev/null 2>&1; then
                echo -e "${GREEN}healthy${NC}"
            else
                echo -e "${RED}not ready${NC}"
            fi
        fi

        # Wait for Redis
        echo -n "  Redis: "
        if docker compose exec -T redis redis-cli ping > /dev/null 2>&1; then
            echo -e "${GREEN}healthy${NC}"
        else
            sleep 3
            if docker compose exec -T redis redis-cli ping > /dev/null 2>&1; then
                echo -e "${GREEN}healthy${NC}"
            else
                echo -e "${RED}not ready${NC}"
            fi
        fi

        # Wait for Hub API
        echo -n "  Hub API: "
        if wait_for_service "Hub API" 30 "http://localhost:3000/api/health"; then
            echo -e "${GREEN}healthy${NC}"
        else
            echo -e "${RED}not responding${NC}"
        fi

        echo ""

        # Run database migrations
        echo -e "${YELLOW}Running database migrations...${NC}"
        docker compose exec -T hub bun run db:push 2>&1 || echo -e "${YELLOW}⚠ Migration skipped (may already be up to date)${NC}"

        echo ""
        show_status
    fi
}

stop_services() {
    print_header

    echo -e "${YELLOW}Stopping JD Agent backend services...${NC}"
    echo ""

    cd "$PROJECT_DIR"
    docker compose down

    echo ""
    echo -e "${GREEN}All services stopped.${NC}"
}

show_status() {
    echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║                    Service Status                          ║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""

    cd "$PROJECT_DIR"

    # Show container status
    echo -e "${CYAN}Docker Containers:${NC}"
    docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"

    echo ""

    # Health checks
    echo -e "${CYAN}Health Checks:${NC}"

    # PostgreSQL
    echo -n "  PostgreSQL: "
    if docker compose exec -T postgres pg_isready -U jdagent > /dev/null 2>&1; then
        echo -e "${GREEN}●${NC} Connected"
    else
        echo -e "${RED}●${NC} Not available"
    fi

    # Redis
    echo -n "  Redis:      "
    if docker compose exec -T redis redis-cli ping > /dev/null 2>&1; then
        echo -e "${GREEN}●${NC} Connected"
    else
        echo -e "${RED}●${NC} Not available"
    fi

    # Hub API
    echo -n "  Hub API:    "
    if curl -sf http://localhost:3000/api/health > /dev/null 2>&1; then
        echo -e "${GREEN}●${NC} Responding"
    else
        echo -e "${RED}●${NC} Not responding"
    fi

    # Cloudflare Tunnel
    echo -n "  Tunnel:     "
    if docker compose ps cloudflared 2>/dev/null | grep -q "Up"; then
        echo -e "${GREEN}●${NC} Running"
    else
        echo -e "${YELLOW}●${NC} Not configured"
    fi

    echo ""

    # Show URLs
    echo -e "${CYAN}Access URLs:${NC}"
    echo "  Local API:    http://localhost:3000"
    echo "  Health Check: http://localhost:3000/api/health"

    # Check for tunnel URL
    if [ -n "${CLOUDFLARE_TUNNEL_TOKEN:-}" ]; then
        echo "  Public API:   https://api.jdagent.dev (via tunnel)"
    fi

    echo ""

    # Show useful commands
    echo -e "${CYAN}Useful Commands:${NC}"
    echo "  View logs:     docker compose logs -f hub"
    echo "  Hub shell:     docker compose exec hub sh"
    echo "  DB shell:      docker compose exec postgres psql -U jdagent -d jd_agent"
    echo "  Stop services: ./scripts/local-start.sh --stop"
    echo ""
}

show_logs() {
    cd "$PROJECT_DIR"
    docker compose logs -f --tail=100 "$@"
}

# Main
case "${1:-}" in
    --stop|stop)
        stop_services
        ;;
    --status|status)
        show_status
        ;;
    --rebuild|rebuild)
        start_services "true" "false"
        ;;
    --dev|dev)
        start_services "false" "true"
        ;;
    --logs|logs)
        shift
        show_logs "$@"
        ;;
    --help|-h|help)
        echo "JD Agent - Local Backend Manager"
        echo ""
        echo "Usage: $0 [command]"
        echo ""
        echo "Commands:"
        echo "  (none)      Start all services in background"
        echo "  --dev       Start with logs attached (Ctrl+C to stop)"
        echo "  --rebuild   Rebuild containers and start"
        echo "  --stop      Stop all services"
        echo "  --status    Show service status"
        echo "  --logs      View service logs (pass service name to filter)"
        echo "  --help      Show this help"
        echo ""
        echo "Examples:"
        echo "  $0                    # Start all services"
        echo "  $0 --status           # Check if services are running"
        echo "  $0 --logs hub         # View hub logs"
        echo "  $0 --logs hub worker  # View hub and worker logs"
        ;;
    *)
        start_services "false" "false"
        ;;
esac
