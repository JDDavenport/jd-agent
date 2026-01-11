#!/bin/bash
# Sync docs from monorepo root to docs-frontend for Vercel deployments
#
# The root /docs folder is the single source of truth.
# This script copies it to apps/docs-frontend/docs/ for Vercel deployments.
#
# Usage:
#   ./scripts/sync-docs.sh        # Sync docs
#   ./scripts/sync-docs.sh --check  # Check if sync is needed (for CI)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
SOURCE_DIR="$ROOT_DIR/docs"
TARGET_DIR="$ROOT_DIR/apps/docs-frontend/docs"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

if [ "$1" == "--check" ]; then
    # Check mode - verify if docs are in sync
    if [ ! -d "$TARGET_DIR" ]; then
        echo -e "${RED}Error: Target docs folder doesn't exist${NC}"
        echo "Run './scripts/sync-docs.sh' to sync"
        exit 1
    fi

    # Compare directories (ignoring .git and other hidden files)
    DIFF=$(diff -rq "$SOURCE_DIR" "$TARGET_DIR" 2>/dev/null | grep -v "\.git" || true)

    if [ -n "$DIFF" ]; then
        echo -e "${YELLOW}Docs are out of sync:${NC}"
        echo "$DIFF" | head -20
        echo ""
        echo "Run './scripts/sync-docs.sh' to sync"
        exit 1
    else
        echo -e "${GREEN}Docs are in sync${NC}"
        exit 0
    fi
fi

# Sync mode
echo "Syncing docs from root to docs-frontend..."

# Remove existing target and copy fresh
rm -rf "$TARGET_DIR"
cp -r "$SOURCE_DIR" "$TARGET_DIR"

# Count files synced
FILE_COUNT=$(find "$TARGET_DIR" -type f | wc -l | tr -d ' ')

echo -e "${GREEN}Synced $FILE_COUNT files to apps/docs-frontend/docs/${NC}"
