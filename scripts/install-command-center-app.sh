#!/bin/bash
# Install JD Command Center into /Applications

set -euo pipefail

ROOT_DIR="/Users/jddavenport/Projects/JD Agent"
APP_NAME="JD Command Center.app"
SOURCE_APP="${ROOT_DIR}/apps/command-center/src-tauri/target/release/bundle/macos/${APP_NAME}"
TARGET_APP="/Applications/${APP_NAME}"

echo "Building Command Center..."
cd "${ROOT_DIR}/apps/command-center"
CI=false /Users/jddavenport/.bun/bin/bun run tauri:build

if [ ! -d "${SOURCE_APP}" ]; then
  echo "Build failed or app bundle missing at:"
  echo "  ${SOURCE_APP}"
  exit 1
fi

echo "Installing to /Applications..."
rm -rf "${TARGET_APP}"
cp -R "${SOURCE_APP}" "/Applications/"

echo "Installed: ${TARGET_APP}"
echo "You can open it from Spotlight now."
