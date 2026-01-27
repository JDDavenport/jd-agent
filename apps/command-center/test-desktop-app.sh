#!/bin/bash
# Desktop App Test Helper Script
# Automates pre-test checks and launches app with monitoring

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  JD Command Center - Desktop App Test Kit"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counters
PASSED=0
FAILED=0

# Test function
test_step() {
    local name=$1
    local command=$2
    local expected=$3

    echo -n "Testing: $name... "

    result=$(eval "$command" 2>&1)

    if echo "$result" | grep -q "$expected"; then
        echo -e "${GREEN}✓ PASS${NC}"
        ((PASSED++))
        return 0
    else
        echo -e "${RED}✗ FAIL${NC}"
        echo "  Expected: $expected"
        echo "  Got: $result"
        ((FAILED++))
        return 1
    fi
}

echo "Step 1: Pre-Test Checks"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if hub is running
test_step "Hub API Health" \
    "curl -s http://localhost:3000/api/health | jq -r '.status'" \
    "healthy"

# Check Whoop authorization
test_step "Whoop Authorization" \
    "curl -s http://localhost:3000/api/whoop/status | jq -r '.data.authorized'" \
    "true"

# Check Whoop configuration
test_step "Whoop Configuration" \
    "curl -s http://localhost:3000/api/whoop/status | jq -r '.data.configured'" \
    "true"

# Check recovery data available
echo -n "Testing: Recovery Data Available... "
RECOVERY=$(curl -s http://localhost:3000/api/dashboard/fitness | jq -r '.data.todayRecovery')
if [ "$RECOVERY" != "null" ] && [ "$RECOVERY" != "" ]; then
    echo -e "${GREEN}✓ PASS${NC} (Score: $RECOVERY%)"
    ((PASSED++))
else
    echo -e "${RED}✗ FAIL${NC}"
    echo "  No recovery data found"
    ((FAILED++))
fi

# Check if desktop app exists
echo -n "Testing: Desktop App Build... "
APP_PATH="src-tauri/target/release/bundle/macos/JD Command Center.app"
if [ -d "$APP_PATH" ]; then
    echo -e "${GREEN}✓ PASS${NC}"
    ((PASSED++))
else
    echo -e "${RED}✗ FAIL${NC}"
    echo "  App not found at: $APP_PATH"
    echo "  Run: bun run tauri:build"
    ((FAILED++))
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Pre-Test Results: ${GREEN}$PASSED passed${NC}, ${RED}$FAILED failed${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ $FAILED -gt 0 ]; then
    echo -e "${RED}⚠ Some pre-test checks failed. Fix issues before testing.${NC}"
    echo ""
    echo "Common fixes:"
    echo "  - Start hub: cd ../../hub && bun run dev"
    echo "  - Build app: bun run tauri:build"
    echo "  - Check Whoop: curl http://localhost:3000/api/whoop/status | jq"
    echo ""
    exit 1
fi

echo -e "${GREEN}✓ All pre-test checks passed!${NC}"
echo ""
echo "Step 2: Launching Desktop App"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Ask user if they want to launch the app
read -p "Launch desktop app now? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Opening desktop app..."
    open "$APP_PATH"

    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  Desktop App Launched!"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "Manual Test Steps:"
    echo ""
    echo "1. ${BLUE}Initial Load Test${NC}"
    echo "   → Check Fitness widget shows recovery: ${RECOVERY}%"
    echo "   → Right-click → Inspect → Console"
    echo "   → Look for: '[FitnessWidget] Configuration check'"
    echo ""
    echo "2. ${BLUE}Window Focus Test${NC}"
    echo "   → Minimize app (Cmd+M)"
    echo "   → Wait 5 seconds"
    echo "   → Restore window"
    echo "   → Watch for pulsing ↻ icon"
    echo ""
    echo "3. ${BLUE}Manual Refresh Test${NC}"
    echo "   → Click 'Refresh' button in Fitness widget"
    echo "   → Verify data updates"
    echo ""
    echo "4. ${BLUE}Background Polling${NC}"
    echo "   → Leave app open for 11 minutes"
    echo "   → Watch for auto-refresh at 10-minute mark"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "View full test kit: ${YELLOW}DESKTOP-APP-TEST-KIT.md${NC}"
    echo ""

    # Start monitoring in background
    echo "Starting API monitoring (Ctrl+C to stop)..."
    echo "Watching for API calls to /dashboard/fitness..."
    echo ""

    # Monitor API calls (this will run until Ctrl+C)
    while true; do
        sleep 60  # Check every minute
        TIMESTAMP=$(date "+%H:%M:%S")
        echo "[$TIMESTAMP] Checking... (App should refresh every 10 min)"
    done
else
    echo "Skipping app launch."
    echo ""
    echo "To launch manually:"
    echo "  open \"$APP_PATH\""
    echo ""
    echo "Or run in dev mode:"
    echo "  bun run tauri:dev"
    echo ""
fi
