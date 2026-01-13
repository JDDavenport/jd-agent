#!/bin/bash
# Plaud AirDrop Watcher
# Watches Downloads folder for audio files and moves them to PlaudSync
#
# Usage: ./plaud-airdrop-watcher.sh
# Or add to launchd for auto-start

DOWNLOADS_DIR="$HOME/Downloads"
PLAUD_SYNC_DIR="$HOME/Documents/PlaudSync"

# Ensure PlaudSync exists
mkdir -p "$PLAUD_SYNC_DIR"

echo "🎙️  Plaud AirDrop Watcher"
echo "   Watching: $DOWNLOADS_DIR"
echo "   Moving to: $PLAUD_SYNC_DIR"
echo ""

# Check if fswatch is installed
if ! command -v fswatch &> /dev/null; then
    echo "Installing fswatch via Homebrew..."
    brew install fswatch
fi

# Function to process new audio files
process_audio() {
    local file="$1"
    local filename=$(basename "$file")
    local ext="${filename##*.}"
    ext=$(echo "$ext" | tr '[:upper:]' '[:lower:]')

    # Check if it's an audio file
    if [[ "$ext" =~ ^(mp3|m4a|wav|ogg|webm|aac|flac)$ ]]; then
        echo "$(date '+%Y-%m-%d %H:%M:%S') - Found audio file: $filename"

        # Wait a moment for file to finish writing
        sleep 2

        # Move to PlaudSync
        if mv "$file" "$PLAUD_SYNC_DIR/"; then
            echo "  ✓ Moved to PlaudSync"

            # Trigger sync via API (if hub is running)
            if curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
                curl -s -X POST http://localhost:3000/api/ingestion/plaud/sync > /dev/null
                echo "  ✓ Triggered transcription"
            fi
        else
            echo "  ✗ Failed to move file"
        fi
    fi
}

export -f process_audio
export PLAUD_SYNC_DIR

# Watch Downloads folder for new files
echo "Watching for new audio files..."
echo "(AirDrop recordings from Plaud will be auto-processed)"
echo ""

fswatch -0 "$DOWNLOADS_DIR" | while IFS= read -r -d '' file; do
    # Only process if file exists (fswatch also reports deletions)
    if [[ -f "$file" ]]; then
        process_audio "$file"
    fi
done
