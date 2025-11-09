#!/bin/bash

# Voice Chat Application - Deploy to VPS-00
# This script deploys the application to vps-00

set -e

echo "============================================================"
echo "Voice Chat Application - Deployment to VPS-00"
echo "============================================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
VPS_HOST="${VPS_HOST:-vps-00}"
VPS_USER="${VPS_USER:-root}"
DEPLOY_PATH="${DEPLOY_PATH:-/opt/voice-chat-app}"
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo -e "${BLUE}Configuration:${NC}"
echo "  VPS Host: $VPS_HOST"
echo "  VPS User: $VPS_USER"
echo "  Deploy Path: $DEPLOY_PATH"
echo "  Project Dir: $PROJECT_DIR"
echo ""

# Step 1: Pre-deployment checks
echo -e "${BLUE}Step 1: Pre-deployment Checks${NC}"
echo "-----------------------------------------------------------"

echo -n "Checking SSH connectivity to $VPS_HOST... "
if ssh -o ConnectTimeout=5 -o BatchMode=yes "$VPS_USER@$VPS_HOST" exit 2>/dev/null; then
    echo -e "${GREEN}✓ Connected${NC}"
else
    echo -e "${RED}✗ Failed${NC}"
    echo ""
    echo "Please ensure:"
    echo "  1. VPS-00 is accessible"
    echo "  2. SSH key is configured"
    echo "  3. User has sudo access"
    echo ""
    exit 1
fi

echo -n "Verifying all tests pass... "
cd "$PROJECT_DIR/backend" && npm test --silent > /dev/null 2>&1
BACKEND_RESULT=$?
cd "$PROJECT_DIR/frontend" && npm test -- --watchAll=false --silent > /dev/null 2>&1
FRONTEND_RESULT=$?

if [ $BACKEND_RESULT -eq 0 ] && [ $FRONTEND_RESULT -eq 0 ]; then
    echo -e "${GREEN}✓ All 653 tests passing${NC}"
else
    echo -e "${RED}✗ Tests failing${NC}"
    echo "Please fix failing tests before deployment"
    exit 1
fi

echo ""

# Step 2: Prepare deployment package
echo -e "${BLUE}Step 2: Prepare Deployment Package${NC}"
echo "-----------------------------------------------------------"

TEMP_DIR=$(mktemp -d)
echo "Creating deployment package in $TEMP_DIR..."

# Copy necessary files
echo -n "Copying files... "
cp -r "$PROJECT_DIR" "$TEMP_DIR/voice-chat-app"
cd "$TEMP_DIR/voice-chat-app"

# Remove development files
rm -rf backend/node_modules frontend/node_modules
rm -rf backend/coverage frontend/coverage
rm -rf .git
rm -f backend/conversations.db
rm -f *.log

echo -e "${GREEN}✓ Done${NC}"

# Create tarball
echo -n "Creating tarball... "
cd "$TEMP_DIR"
tar -czf voice-chat-app.tar.gz voice-chat-app/
echo -e "${GREEN}✓ Done${NC}"

PACKAGE_SIZE=$(du -h voice-chat-app.tar.gz | cut -f1)
echo "Package size: $PACKAGE_SIZE"
echo ""

# Step 3: Upload to VPS
echo -e "${BLUE}Step 3: Upload to VPS-00${NC}"
echo "-----------------------------------------------------------"

echo "Uploading package to $VPS_HOST..."
scp "$TEMP_DIR/voice-chat-app.tar.gz" "$VPS_USER@$VPS_HOST:/tmp/"
echo -e "${GREEN}✓ Upload complete${NC}"
echo ""

# Step 4: Deploy on VPS
echo -e "${BLUE}Step 4: Deploy on VPS-00${NC}"
echo "-----------------------------------------------------------"

ssh "$VPS_USER@$VPS_HOST" bash << 'ENDSSH'
set -e

echo "Extracting package..."
cd /tmp
tar -xzf voice-chat-app.tar.gz

echo "Stopping existing services..."
if [ -d "/opt/voice-chat-app" ]; then
    cd /opt/voice-chat-app
    docker-compose down 2>/dev/null || true
fi

echo "Installing new version..."
rm -rf /opt/voice-chat-app.old
if [ -d "/opt/voice-chat-app" ]; then
    mv /opt/voice-chat-app /opt/voice-chat-app.old
fi
mv /tmp/voice-chat-app /opt/

echo "Installing dependencies..."
cd /opt/voice-chat-app/backend
npm install --production --silent

cd /opt/voice-chat-app/frontend
npm install --production --silent
npm run build --silent

echo "Building Docker images..."
cd /opt/voice-chat-app
docker-compose build --quiet

echo "Starting services..."
docker-compose up -d

echo "Cleaning up..."
rm -f /tmp/voice-chat-app.tar.gz
rm -rf /tmp/voice-chat-app

echo "Deployment complete!"
ENDSSH

echo -e "${GREEN}✓ Deployment complete${NC}"
echo ""

# Step 5: Verify deployment
echo -e "${BLUE}Step 5: Verify Deployment${NC}"
echo "-----------------------------------------------------------"

echo "Waiting for services to start (30 seconds)..."
sleep 30

echo ""
echo "Running verification on VPS..."
ssh "$VPS_USER@$VPS_HOST" "cd /opt/voice-chat-app && ./scripts/verify-deployment.sh"

VERIFY_RESULT=$?

echo ""

# Cleanup
echo -e "${BLUE}Cleanup${NC}"
echo "-----------------------------------------------------------"
echo "Removing temporary files..."
rm -rf "$TEMP_DIR"
echo -e "${GREEN}✓ Done${NC}"
echo ""

# Summary
echo "============================================================"
echo "Deployment Summary"
echo "============================================================"
echo ""

if [ $VERIFY_RESULT -eq 0 ]; then
    echo -e "${GREEN}✓ Deployment successful!${NC}"
    echo ""
    echo "Application is now running on vps-00:"
    echo ""
    echo "  Frontend:  http://vps-00:8080"
    echo "  Backend:   http://vps-00:3001"
    echo "  WebSocket: ws://vps-00:3001"
    echo ""
    echo "Access the application at the frontend URL."
    echo ""
    echo "To check logs:"
    echo "  ssh $VPS_USER@$VPS_HOST 'cd /opt/voice-chat-app && docker-compose logs -f'"
    echo ""
    echo "To stop services:"
    echo "  ssh $VPS_USER@$VPS_HOST 'cd /opt/voice-chat-app && docker-compose down'"
    echo ""
    exit 0
else
    echo -e "${RED}✗ Deployment verification failed${NC}"
    echo ""
    echo "Services are running but some checks failed."
    echo "Please review the verification output above."
    echo ""
    echo "To check logs:"
    echo "  ssh $VPS_USER@$VPS_HOST 'cd /opt/voice-chat-app && docker-compose logs -f'"
    echo ""
    echo "To rollback:"
    echo "  ssh $VPS_USER@$VPS_HOST 'cd /opt/voice-chat-app && docker-compose down && mv /opt/voice-chat-app.old /opt/voice-chat-app && cd /opt/voice-chat-app && docker-compose up -d'"
    echo ""
    exit 1
fi
