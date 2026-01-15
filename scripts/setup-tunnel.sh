#!/bin/bash
# JD Agent - Cloudflare Tunnel Setup Script
#
# This script helps you set up a Cloudflare Tunnel to expose your local
# backend to the internet for webhooks and frontend access.
#
# Prerequisites:
#   - Cloudflare account with a domain
#   - cloudflared CLI installed (brew install cloudflared)
#
# Usage:
#   ./scripts/setup-tunnel.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║       JD Agent - Cloudflare Tunnel Setup                   ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if cloudflared is installed
if ! command -v cloudflared &> /dev/null; then
    echo -e "${RED}❌ cloudflared is not installed${NC}"
    echo ""
    echo "Install it with:"
    echo "  macOS:   brew install cloudflared"
    echo "  Linux:   curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o cloudflared && chmod +x cloudflared"
    echo ""
    exit 1
fi

echo -e "${GREEN}✓ cloudflared is installed${NC}"
cloudflared --version
echo ""

# Step 1: Login to Cloudflare
echo -e "${YELLOW}Step 1: Authenticate with Cloudflare${NC}"
echo "This will open a browser window to log in to your Cloudflare account."
echo ""
read -p "Press Enter to continue (or Ctrl+C to cancel)..."
echo ""

cloudflared tunnel login

echo ""
echo -e "${GREEN}✓ Authenticated with Cloudflare${NC}"
echo ""

# Step 2: Create the tunnel
TUNNEL_NAME="jd-agent-local"
echo -e "${YELLOW}Step 2: Creating tunnel '${TUNNEL_NAME}'${NC}"
echo ""

# Check if tunnel already exists
if cloudflared tunnel list | grep -q "$TUNNEL_NAME"; then
    echo -e "${YELLOW}⚠ Tunnel '$TUNNEL_NAME' already exists${NC}"
    read -p "Delete and recreate? (y/N): " confirm
    if [[ $confirm == [yY] ]]; then
        cloudflared tunnel delete "$TUNNEL_NAME"
        cloudflared tunnel create "$TUNNEL_NAME"
    fi
else
    cloudflared tunnel create "$TUNNEL_NAME"
fi

# Get tunnel ID
TUNNEL_ID=$(cloudflared tunnel list | grep "$TUNNEL_NAME" | awk '{print $1}')
echo ""
echo -e "${GREEN}✓ Tunnel created with ID: ${TUNNEL_ID}${NC}"
echo ""

# Step 3: Configure tunnel routing
echo -e "${YELLOW}Step 3: Configure DNS routing${NC}"
echo ""
read -p "Enter your domain (e.g., jdagent.dev): " DOMAIN
read -p "Enter subdomain for API (e.g., api → api.jdagent.dev): " SUBDOMAIN

HOSTNAME="${SUBDOMAIN}.${DOMAIN}"
echo ""
echo "Creating DNS route: ${HOSTNAME} → localhost:3000"
echo ""

cloudflared tunnel route dns "$TUNNEL_NAME" "$HOSTNAME"

echo ""
echo -e "${GREEN}✓ DNS route created: https://${HOSTNAME}${NC}"
echo ""

# Step 4: Create tunnel configuration
CONFIG_DIR="$HOME/.cloudflared"
CONFIG_FILE="${CONFIG_DIR}/config-jd-agent.yml"

echo -e "${YELLOW}Step 4: Creating tunnel configuration${NC}"
echo ""

mkdir -p "$CONFIG_DIR"
cat > "$CONFIG_FILE" << EOF
# JD Agent Cloudflare Tunnel Configuration
# Location: ${CONFIG_FILE}

tunnel: ${TUNNEL_ID}
credentials-file: ${CONFIG_DIR}/${TUNNEL_ID}.json

ingress:
  # API endpoint
  - hostname: ${HOSTNAME}
    service: http://localhost:3000
    originRequest:
      noTLSVerify: true
      connectTimeout: 30s

  # Catch-all (required)
  - service: http_status:404
EOF

echo -e "${GREEN}✓ Configuration saved to: ${CONFIG_FILE}${NC}"
echo ""

# Step 5: Get tunnel token for Docker
echo -e "${YELLOW}Step 5: Generate token for Docker${NC}"
echo ""

TUNNEL_TOKEN=$(cloudflared tunnel token "$TUNNEL_NAME" 2>/dev/null || echo "")

if [ -z "$TUNNEL_TOKEN" ]; then
    echo -e "${RED}Could not generate tunnel token automatically${NC}"
    echo "Run this command manually to get the token:"
    echo "  cloudflared tunnel token $TUNNEL_NAME"
else
    echo -e "${GREEN}Your tunnel token (add to .env.local.docker):${NC}"
    echo ""
    echo "CLOUDFLARE_TUNNEL_TOKEN=${TUNNEL_TOKEN}"
    echo ""

    # Optionally append to .env.local.docker
    ENV_FILE="$(dirname "$0")/../.env.local.docker"
    if [ -f "$ENV_FILE" ]; then
        read -p "Add token to .env.local.docker? (y/N): " add_to_env
        if [[ $add_to_env == [yY] ]]; then
            if grep -q "CLOUDFLARE_TUNNEL_TOKEN=" "$ENV_FILE"; then
                sed -i '' "s|CLOUDFLARE_TUNNEL_TOKEN=.*|CLOUDFLARE_TUNNEL_TOKEN=${TUNNEL_TOKEN}|" "$ENV_FILE"
            else
                echo "CLOUDFLARE_TUNNEL_TOKEN=${TUNNEL_TOKEN}" >> "$ENV_FILE"
            fi
            echo -e "${GREEN}✓ Token added to .env.local.docker${NC}"
        fi
    fi
fi

echo ""

# Step 6: Test the tunnel
echo -e "${YELLOW}Step 6: Testing tunnel (local mode)${NC}"
echo ""
echo "To test the tunnel locally (without Docker), run:"
echo "  cloudflared tunnel --config ${CONFIG_FILE} run"
echo ""
echo "To run via Docker Compose (recommended for production):"
echo "  docker compose up -d"
echo ""

# Summary
echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                    Setup Complete!                         ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}Summary:${NC}"
echo "  Tunnel Name: ${TUNNEL_NAME}"
echo "  Tunnel ID:   ${TUNNEL_ID}"
echo "  Public URL:  https://${HOSTNAME}"
echo "  Local URL:   http://localhost:3000"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "  1. Copy .env.local.docker.example to .env.local.docker"
echo "  2. Add the CLOUDFLARE_TUNNEL_TOKEN to .env.local.docker"
echo "  3. Add your API keys to .env.local.docker"
echo "  4. Run: docker compose up -d"
echo "  5. Test: curl https://${HOSTNAME}/api/health"
echo ""
echo -e "${YELLOW}Update Frontend:${NC}"
echo "  Set VITE_API_URL=https://${HOSTNAME} in your frontend .env"
echo ""
