# Voice Chat Application - Deployment Guide

## Overview

This document provides deployment instructions and verification for the Voice Chat application, a complete open-source alternative to OpenAI Realtime API.

## Architecture

### Services

The application consists of 4 Docker containers:

1. **vad-service** - Silero VAD for voice activity detection (port 5052)
2. **streaming-tts** - Parler-TTS for text-to-speech generation (port 5053)
3. **backend** - Node.js WebSocket server (port 3001)
4. **frontend** - React application served by Nginx (port 8080)

### External Services

Two services run externally (not in Docker):

1. **STT Service** - Faster-Whisper at `http://100.89.2.111:5051`
2. **LLM Service** - Ollama at `http://100.100.47.43:11434`

## Pre-Deployment Verification

### 1. Test Suite Status

**Backend Tests:**
- Total: 373 tests
- Status: ✅ All passing
- Coverage: Complete integration and unit test coverage
  - Unit tests: Database, StateMachine, SessionManager, WebSocketHandler, Service Clients
  - Integration tests: Conversation flow, Interruption, Tool calling, Vision upload
  - Performance tests: Load testing, concurrent sessions, memory management

**Frontend Tests:**
- Total: 280 tests
- Status: ✅ All passing
- Coverage: Complete component and hook testing
  - Hooks: useWebSocket, useAudioRecorder, useAudioPlayer
  - Components: MessageList, AudioRecorder, AudioPlayer, VisionUploader, ToolCallDisplay, PhaseIndicator, ServiceStatus
  - Context: ConversationContext, conversationReducer
  - App integration

### 2. Environment Configuration

**Backend Environment Variables (docker-compose.yml):**

```yaml
environment:
  - PORT=3001
  - STT_URL=http://100.89.2.111:5051      # External Faster-Whisper service
  - LLM_URL=http://100.100.47.43:11434     # External Ollama service
  - TTS_URL=http://streaming-tts:5053      # Internal container service
  - VAD_URL=http://vad-service:5052        # Internal container service
  - LLM_MODEL=llama3.2                     # Default LLM model
  - DB_PATH=/data/conversations.db         # Persistent database path
```

**Note:** Database path is now configurable via `DB_PATH` environment variable (updated in server.js).

### 3. Docker Services Configuration

#### VAD Service
- **Image**: Custom Silero VAD
- **Port**: 5052
- **Health Check**: `curl -f http://localhost:5052/health`
- **Start Period**: 40s

#### Streaming TTS Service
- **Image**: Custom Parler-TTS
- **Port**: 5053
- **Volume**: `tts-audio:/tmp/tts_audio`
- **Health Check**: `curl -f http://localhost:5053/health`
- **Start Period**: 60s (model loading time)

#### Backend Service
- **Image**: Custom Node.js
- **Port**: 3001
- **Volume**: `backend-data:/data` (for SQLite database persistence)
- **Dependencies**: vad-service, streaming-tts
- **Health Check**: `wget --quiet --tries=1 --spider http://localhost:3001/health`
- **Restart**: unless-stopped

#### Frontend Service
- **Image**: Custom Nginx
- **Port**: 8080 (external) → 80 (internal)
- **Dependencies**: backend
- **Health Check**: `wget --quiet --tries=1 --spider http://localhost:80`
- **Restart**: unless-stopped

### 4. Network Configuration

All services communicate via `voice-chat-network` (bridge driver):
- Backend communicates with VAD/TTS via service names
- Frontend proxies API calls to backend
- External services accessible via IP addresses

### 5. Data Persistence

Two named volumes for persistent data:
1. **backend-data**: SQLite database with conversation history
2. **tts-audio**: Temporary TTS audio files

## Deployment Instructions

### Step 1: Verify External Services

Before deploying, ensure external services are accessible:

```bash
# Test STT service
curl -f http://100.89.2.111:5051/health

# Test LLM service
curl -f http://100.100.47.43:11434/api/tags
```

### Step 2: Build and Deploy

```bash
cd /home/wandeon/voice-chat-app

# Build and start all services
docker-compose up -d --build

# Verify all containers are running
docker-compose ps

# Check logs
docker-compose logs -f
```

### Step 3: Health Check Verification

Wait for all services to pass health checks:

```bash
# Check VAD service
curl http://localhost:5052/health

# Check TTS service
curl http://localhost:5053/health

# Check backend service
curl http://localhost:3001/health

# Check service status (backend endpoint that checks all services)
curl http://localhost:3001/api/status
```

Expected response from `/api/status`:
```json
{
  "vad": { "url": "http://vad-service:5052", "status": "online" },
  "stt": { "url": "http://100.89.2.111:5051", "status": "online" },
  "llm": { "url": "http://100.100.47.43:11434", "status": "online" },
  "tts": { "url": "http://streaming-tts:5053", "status": "online" }
}
```

### Step 4: Access Application

- **Frontend**: http://localhost:8080
- **Backend**: http://localhost:3001
- **WebSocket**: ws://localhost:3001

## Post-Deployment Verification

### 1. Frontend Accessibility

```bash
# Test frontend loads
curl -I http://localhost:8080

# Should return: HTTP/1.1 200 OK
```

### 2. WebSocket Connection Test

Open browser console at http://localhost:8080 and check:
- WebSocket connection established
- "Connected" message received
- No connection errors

### 3. End-to-End Conversation Test

1. Click "Start Conversation" button
2. Grant microphone permission
3. Speak into microphone
4. Verify:
   - Audio chunks are being sent
   - VAD detects speech
   - Transcription appears
   - LLM response streams
   - TTS audio plays back

### 4. Feature Verification Checklist

- ✅ Voice conversation (microphone → transcription → LLM → TTS)
- ✅ Text message input
- ✅ Image upload and vision analysis
- ✅ Tool/function calling (get_time, get_weather, calculate)
- ✅ Real-time interruption
- ✅ Conversation history persistence
- ✅ Multi-turn conversation context

## Performance Benchmarks

Based on load testing (Task 30):

- **Concurrent Sessions**: 100+ supported
- **Message Throughput**: 200,000+ msg/sec
- **Message Latency**: < 0.01ms average
- **Audio Processing**: 3,000 chunks/sec
- **Database Operations**: 16,000+ ops/sec
- **Memory per Session**: ~170 KB
- **Connection Establishment**: < 1ms

## Monitoring

### Container Health

```bash
# Monitor all containers
docker-compose ps

# View logs for specific service
docker-compose logs -f backend
docker-compose logs -f vad-service
docker-compose logs -f streaming-tts
docker-compose logs -f frontend
```

### Resource Usage

```bash
# Check resource usage
docker stats

# Check specific service
docker stats voice-chat-backend
```

### Database

```bash
# Access database
docker exec -it voice-chat-backend sh
sqlite3 /data/conversations.db

# Check conversation history
SELECT * FROM sessions ORDER BY started_at DESC LIMIT 10;
SELECT * FROM messages WHERE session_id = 'SESSION_ID' ORDER BY created_at;
```

## Troubleshooting

### Common Issues

**1. External Services Unreachable**

Error: `VAD health check failed` or `STT health check failed`

Solution:
- Verify external service IPs are accessible
- Check firewall rules
- Test connectivity: `curl http://100.89.2.111:5051/health`

**2. Container Fails to Start**

Solution:
```bash
# Check logs
docker-compose logs SERVICE_NAME

# Rebuild specific service
docker-compose up -d --build SERVICE_NAME
```

**3. WebSocket Connection Fails**

Solution:
- Check backend logs: `docker-compose logs -f backend`
- Verify backend health: `curl http://localhost:3001/health`
- Check browser console for errors
- Verify no firewall blocking port 3001

**4. Database Permission Issues**

Solution:
```bash
# Fix volume permissions
docker-compose down
docker volume rm voice-chat-app_backend-data
docker-compose up -d
```

**5. Port Conflicts**

Error: `port is already allocated`

Solution:
```bash
# Check what's using the port
sudo lsof -i :8080  # or :3001, :5052, :5053

# Stop conflicting service or change port in docker-compose.yml
```

## Rollback Procedure

If deployment fails:

```bash
# Stop all services
docker-compose down

# Restore previous version (if using git)
git checkout PREVIOUS_COMMIT

# Rebuild and restart
docker-compose up -d --build
```

## Security Considerations

1. **Database**: SQLite database is stored in Docker volume (persistent across restarts)
2. **Environment Variables**: Sensitive config should use Docker secrets in production
3. **Network**: Services communicate via internal Docker network
4. **External Services**: Ensure STT and LLM services are behind firewall
5. **CORS**: Backend has CORS enabled for frontend communication

## Maintenance

### Backup Database

```bash
# Backup conversation database
docker exec voice-chat-backend cat /data/conversations.db > backup-$(date +%Y%m%d).db
```

### Update Services

```bash
# Pull latest changes
git pull

# Rebuild and restart
docker-compose down
docker-compose up -d --build
```

### Clean Up

```bash
# Remove stopped containers
docker-compose down

# Remove volumes (WARNING: deletes data)
docker-compose down -v

# Remove images
docker-compose down --rmi all
```

## Production Deployment (vps-00)

For production deployment to vps-00:

1. Ensure all external services are configured
2. Update environment variables for production URLs
3. Configure reverse proxy (Nginx/Caddy) for SSL/TLS
4. Set up monitoring and logging
5. Configure automatic backups
6. Use Docker secrets for sensitive configuration
7. Set resource limits in docker-compose.yml

## Support

For issues or questions:
- Check logs: `docker-compose logs -f`
- Review test results: `npm test` (backend/frontend)
- Verify health endpoints
- Check this deployment guide

## Changelog

### 2025-11-09
- Initial deployment configuration
- Complete backend WebSocket architecture
- Full frontend React implementation
- 653 total tests passing (373 backend + 280 frontend)
- Performance testing complete
- All integration tests passing
