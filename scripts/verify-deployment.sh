#!/bin/bash

# Voice Chat Application - Deployment Verification Script
# This script verifies that all services are running correctly

set -e

echo "============================================================"
echo "Voice Chat Application - Deployment Verification"
echo "============================================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
BACKEND_URL="${BACKEND_URL:-http://localhost:3001}"
FRONTEND_URL="${FRONTEND_URL:-http://localhost:8080}"
VAD_URL="${VAD_URL:-http://localhost:5052}"
TTS_URL="${TTS_URL:-http://localhost:5053}"
STT_URL="${STT_URL:-http://100.89.2.111:5051}"
LLM_URL="${LLM_URL:-http://100.100.47.43:11434}"

# Track failures
FAILURES=0

# Helper function to check HTTP endpoint
check_http() {
    local name=$1
    local url=$2
    local endpoint=${3:-/health}

    echo -n "Checking $name... "

    if curl -f -s -o /dev/null -w "%{http_code}" "$url$endpoint" | grep -q "200"; then
        echo -e "${GREEN}✓ OK${NC}"
        return 0
    else
        echo -e "${RED}✗ FAILED${NC}"
        FAILURES=$((FAILURES + 1))
        return 1
    fi
}

# Helper function to check Docker container
check_container() {
    local name=$1

    echo -n "Checking container $name... "

    if docker ps --format '{{.Names}}' | grep -q "^$name$"; then
        local status=$(docker inspect -f '{{.State.Health.Status}}' "$name" 2>/dev/null || echo "no-health-check")
        if [ "$status" = "healthy" ] || [ "$status" = "no-health-check" ]; then
            echo -e "${GREEN}✓ Running${NC}"
            return 0
        else
            echo -e "${YELLOW}⚠ Unhealthy (status: $status)${NC}"
            FAILURES=$((FAILURES + 1))
            return 1
        fi
    else
        echo -e "${RED}✗ Not running${NC}"
        FAILURES=$((FAILURES + 1))
        return 1
    fi
}

echo "1. Docker Container Status"
echo "-----------------------------------------------------------"
check_container "voice-chat-vad"
check_container "voice-chat-streaming-tts"
check_container "voice-chat-backend"
check_container "voice-chat-frontend"
echo ""

echo "2. Service Health Checks"
echo "-----------------------------------------------------------"
check_http "VAD Service" "$VAD_URL"
check_http "TTS Service" "$TTS_URL"
check_http "Backend Service" "$BACKEND_URL"
check_http "Frontend Service" "$FRONTEND_URL" ""
echo ""

echo "3. External Service Connectivity"
echo "-----------------------------------------------------------"
check_http "STT Service (External)" "$STT_URL"
check_http "LLM Service (External)" "$LLM_URL" "/api/tags"
echo ""

echo "4. Backend Service Status Endpoint"
echo "-----------------------------------------------------------"
echo -n "Fetching service status... "

STATUS_RESPONSE=$(curl -s "$BACKEND_URL/api/status")

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ OK${NC}"
    echo ""
    echo "Service Status Details:"
    echo "$STATUS_RESPONSE" | jq '.' 2>/dev/null || echo "$STATUS_RESPONSE"

    # Check if all services are online
    if echo "$STATUS_RESPONSE" | jq -e '.vad.status == "online" and .stt.status == "online" and .llm.status == "online" and .tts.status == "online"' > /dev/null 2>&1; then
        echo -e "${GREEN}All services online!${NC}"
    else
        echo -e "${YELLOW}Some services offline${NC}"
        FAILURES=$((FAILURES + 1))
    fi
else
    echo -e "${RED}✗ FAILED${NC}"
    FAILURES=$((FAILURES + 1))
fi
echo ""

echo "5. Docker Volumes"
echo "-----------------------------------------------------------"
echo -n "Checking backend-data volume... "
if docker volume ls | grep -q "voice-chat-app_backend-data"; then
    echo -e "${GREEN}✓ Exists${NC}"
else
    echo -e "${YELLOW}⚠ Not found${NC}"
fi

echo -n "Checking tts-audio volume... "
if docker volume ls | grep -q "voice-chat-app_tts-audio"; then
    echo -e "${GREEN}✓ Exists${NC}"
else
    echo -e "${YELLOW}⚠ Not found${NC}"
fi
echo ""

echo "6. Network Connectivity"
echo "-----------------------------------------------------------"
echo -n "Checking voice-chat-network... "
if docker network ls | grep -q "voice-chat-app_voice-chat-network"; then
    echo -e "${GREEN}✓ Exists${NC}"
else
    echo -e "${RED}✗ Not found${NC}"
    FAILURES=$((FAILURES + 1))
fi
echo ""

echo "7. Port Accessibility"
echo "-----------------------------------------------------------"
check_port() {
    local port=$1
    local service=$2
    echo -n "Checking port $port ($service)... "
    if nc -z localhost $port 2>/dev/null; then
        echo -e "${GREEN}✓ Open${NC}"
    else
        echo -e "${RED}✗ Closed${NC}"
        FAILURES=$((FAILURES + 1))
    fi
}

check_port 8080 "Frontend"
check_port 3001 "Backend"
check_port 5052 "VAD"
check_port 5053 "TTS"
echo ""

echo "8. Database Verification"
echo "-----------------------------------------------------------"
echo -n "Checking database file... "
if docker exec voice-chat-backend test -f /data/conversations.db 2>/dev/null; then
    echo -e "${GREEN}✓ Exists${NC}"

    echo -n "Checking database tables... "
    TABLE_COUNT=$(docker exec voice-chat-backend sqlite3 /data/conversations.db "SELECT COUNT(*) FROM sqlite_master WHERE type='table';" 2>/dev/null)
    if [ "$TABLE_COUNT" -ge 4 ]; then
        echo -e "${GREEN}✓ OK ($TABLE_COUNT tables)${NC}"
    else
        echo -e "${YELLOW}⚠ Unexpected table count: $TABLE_COUNT${NC}"
    fi
else
    echo -e "${YELLOW}⚠ Not found (will be created on first use)${NC}"
fi
echo ""

echo "9. WebSocket Connectivity Test"
echo "-----------------------------------------------------------"
echo -n "Testing WebSocket connection... "
# Simple WebSocket test using wscat if available, or skip
if command -v wscat &> /dev/null; then
    if timeout 5 wscat -c "ws://localhost:3001" --execute "ping" 2>&1 | grep -q "connected"; then
        echo -e "${GREEN}✓ OK${NC}"
    else
        echo -e "${YELLOW}⚠ Could not verify (manual test recommended)${NC}"
    fi
else
    echo -e "${YELLOW}⚠ wscat not installed (manual test recommended)${NC}"
fi
echo ""

echo "10. Resource Usage"
echo "-----------------------------------------------------------"
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}" \
    voice-chat-frontend voice-chat-backend voice-chat-vad voice-chat-streaming-tts 2>/dev/null || \
    echo "Could not fetch resource stats"
echo ""

echo "============================================================"
echo "Verification Summary"
echo "============================================================"
echo ""

if [ $FAILURES -eq 0 ]; then
    echo -e "${GREEN}✓ All checks passed!${NC}"
    echo ""
    echo "Deployment is ready for use."
    echo ""
    echo "Access the application:"
    echo "  Frontend: $FRONTEND_URL"
    echo "  Backend:  $BACKEND_URL"
    echo "  WebSocket: ws://localhost:3001"
    exit 0
else
    echo -e "${RED}✗ $FAILURES check(s) failed${NC}"
    echo ""
    echo "Please review the failures above and check:"
    echo "  1. Docker containers are running: docker-compose ps"
    echo "  2. Service logs: docker-compose logs -f"
    echo "  3. External services are accessible"
    echo "  4. Port conflicts"
    echo ""
    echo "See docs/DEPLOYMENT.md for troubleshooting."
    exit 1
fi
