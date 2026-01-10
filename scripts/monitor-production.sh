#!/bin/bash

# Production Health Check Script for JD Agent
# Run this script to verify all production services are healthy

set -e

echo "========================================"
echo " JD Agent Production Health Check"
echo " $(date)"
echo "========================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Production URLs
HUB_URL="https://jd-agent-hub-production.up.railway.app"
COMMAND_CENTER_URL="https://command-center-plum.vercel.app"
TASKS_URL="https://tasks-ten-ecru.vercel.app"
VAULT_URL="https://vault-indol.vercel.app"

# Function to check HTTP status
check_http() {
    local url=$1
    local name=$2
    local status=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null)

    if [ "$status" = "200" ]; then
        echo -e "${GREEN}[PASS]${NC} $name - HTTP $status"
        return 0
    else
        echo -e "${RED}[FAIL]${NC} $name - HTTP $status"
        return 1
    fi
}

# Function to check API health
check_api_health() {
    local url=$1
    local response=$(curl -s "$url/api/health" 2>/dev/null)

    if echo "$response" | grep -q '"status":"healthy"'; then
        local db_status=$(echo "$response" | grep -o '"database":{[^}]*}' | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
        local uptime=$(echo "$response" | grep -o '"uptime":[0-9]*' | cut -d':' -f2)
        echo -e "${GREEN}[PASS]${NC} Hub API - Healthy"
        echo "       Database: $db_status"
        echo "       Uptime: ${uptime}s"
        return 0
    else
        echo -e "${RED}[FAIL]${NC} Hub API - Not healthy"
        echo "       Response: $response"
        return 1
    fi
}

echo "Checking Hub API..."
echo "-------------------"
check_api_health "$HUB_URL"
echo ""

echo "Checking Frontend Apps..."
echo "-------------------------"
check_http "$COMMAND_CENTER_URL" "Command Center"
check_http "$TASKS_URL" "Tasks App"
check_http "$VAULT_URL" "Vault App"
echo ""

echo "Checking API Endpoints..."
echo "-------------------------"
# Test a few critical API endpoints
endpoints=(
    "/api/tasks"
    "/api/vault/pages"
    "/api/goals"
    "/api/habits"
)

for endpoint in "${endpoints[@]}"; do
    status=$(curl -s -o /dev/null -w "%{http_code}" "$HUB_URL$endpoint" 2>/dev/null)
    if [ "$status" = "200" ] || [ "$status" = "401" ]; then
        echo -e "${GREEN}[PASS]${NC} $endpoint - HTTP $status"
    else
        echo -e "${YELLOW}[WARN]${NC} $endpoint - HTTP $status"
    fi
done
echo ""

echo "========================================"
echo " Health Check Complete"
echo "========================================"
echo ""
echo "Production URLs:"
echo "  Hub API:        $HUB_URL"
echo "  Command Center: $COMMAND_CENTER_URL"
echo "  Tasks:          $TASKS_URL"
echo "  Vault:          $VAULT_URL"
