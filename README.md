# Voice Chat Application

A complete open-source alternative to OpenAI Realtime API with continuous conversation, real-time interruption support, and multimodal capabilities (voice + vision).

## Features

- 🎙️ **Voice Conversations**: Continuous voice interaction with natural turn-taking
- ⚡ **Real-Time Interruption**: Interrupt AI responses mid-sentence
- 👁️ **Vision Analysis**: Upload images for multimodal conversation
- 🔧 **Tool Calling**: LLM can execute functions (time, weather, calculations)
- 💬 **Text Messages**: Type messages as alternative to voice
- 📊 **Streaming Responses**: Token-by-token LLM streaming for low latency
- 🔄 **Conversation History**: Persistent conversation tracking across sessions
- 📱 **Responsive Design**: Works on desktop and mobile devices

## Architecture

### Technology Stack

**Frontend:**
- React 18 with Hooks
- WebSocket for real-time communication
- Web Audio API for audio playback
- MediaRecorder API for voice capture
- CSS Custom Properties for theming

**Backend:**
- Node.js with Express
- WebSocket Server (ws library)
- SQLite for conversation persistence
- RESTful API for service health checks
- State machine for conversation flow

**AI Services:**
- **VAD**: Silero VAD for voice activity detection
- **STT**: Faster-Whisper for speech-to-text
- **LLM**: Ollama (llama3.2) for conversation
- **TTS**: Parler-TTS for text-to-speech
- **Vision**: Ollama (llama3.2-vision) for image analysis

### System Design

```
┌─────────────┐
│   Browser   │
│  (React)    │
└──────┬──────┘
       │ WebSocket
       │
┌──────▼──────┐     ┌─────────────┐
│   Backend   │────▶│  SQLite DB  │
│  (Node.js)  │     └─────────────┘
└──────┬──────┘
       │
       ├──▶ VAD Service (Silero)
       ├──▶ STT Service (Faster-Whisper)
       ├──▶ LLM Service (Ollama)
       └──▶ TTS Service (Parler-TTS)
```

## Quick Start

### Prerequisites

- Docker and Docker Compose
- External STT service at `http://100.89.2.111:5051`
- External LLM service at `http://100.100.47.43:11434`

### Installation

```bash
# Clone or navigate to repository
cd /home/wandeon/voice-chat-app

# Build and start all services
docker-compose up -d --build

# Verify deployment
./scripts/verify-deployment.sh

# Access application
open http://localhost:8080
```

### Service Endpoints

- **Frontend**: http://localhost:8080
- **Backend API**: http://localhost:3001
- **WebSocket**: ws://localhost:3001
- **VAD Service**: http://localhost:5052
- **TTS Service**: http://localhost:5053

## Usage

### Starting a Conversation

1. Open http://localhost:8080 in your browser
2. Click "Start Conversation" and grant microphone permission
3. Speak naturally - the AI will respond with voice

### Features Usage

**Voice Input:**
- Speak and the system detects speech automatically
- Silence detection triggers transcription
- AI responds with streaming audio

**Text Input:**
- Type a message in the input field
- AI responds with voice (or text if preferred)

**Image Upload:**
- Click image upload button or drag-and-drop
- AI analyzes the image and responds
- Ask follow-up questions about the image

**Interruption:**
- Speak while AI is talking to interrupt
- AI stops immediately and listens

**Tool Calling:**
- Ask "What time is it?" - Uses get_current_time
- Ask "What's the weather in London?" - Uses get_weather
- Ask "Calculate 25 * 4 + 10" - Uses calculate

## Development

### Project Structure

```
voice-chat-app/
├── backend/                 # Node.js backend
│   ├── lib/
│   │   ├── services/       # Service clients (VAD, STT, LLM, TTS)
│   │   ├── handlers/       # Message handlers
│   │   ├── tools/          # LLM tool implementations
│   │   ├── StateMachine.js
│   │   ├── SessionManager.js
│   │   └── WebSocketHandler.js
│   ├── tests/              # 373 tests
│   │   ├── unit/
│   │   ├── integration/
│   │   └── performance/
│   ├── database.js
│   └── server.js
│
├── frontend/               # React frontend
│   ├── src/
│   │   ├── components/    # UI components
│   │   ├── context/       # State management
│   │   ├── hooks/         # Custom React hooks
│   │   └── App.js
│   └── tests/             # 280 tests
│
├── vad-service/           # Silero VAD Docker service
├── streaming-tts-service/ # Parler-TTS Docker service
│
├── docs/
│   ├── DEPLOYMENT.md      # Deployment guide
│   └── plans/             # Implementation plans
│
├── scripts/
│   └── verify-deployment.sh
│
└── docker-compose.yml
```

### Running Tests

```bash
# Backend tests (373 tests)
cd backend && npm test

# Frontend tests (280 tests)
cd frontend && npm test

# Performance tests
cd backend && npm test -- performance
```

### Test Coverage

- **Total Tests**: 653 (373 backend + 280 frontend)
- **All Passing**: ✅
- **Coverage Areas**:
  - Unit tests for all core components
  - Integration tests for conversation flows
  - Performance and load testing
  - WebSocket communication
  - State machine transitions
  - Audio processing
  - Vision analysis
  - Tool calling

## Deployment

### Production Deployment

See [DEPLOYMENT.md](docs/DEPLOYMENT.md) for detailed deployment instructions.

**Quick Deploy:**

```bash
# 1. Verify external services are accessible
curl http://100.89.2.111:5051/health  # STT
curl http://100.100.47.43:11434/api/tags  # LLM

# 2. Build and deploy
docker-compose up -d --build

# 3. Verify deployment
./scripts/verify-deployment.sh

# 4. Check all services are online
curl http://localhost:3001/api/status
```

### Environment Variables

Configure via `docker-compose.yml` or `.env` file:

```bash
PORT=3001                                    # Backend port
VAD_URL=http://vad-service:5052             # VAD service
STT_URL=http://100.89.2.111:5051            # STT service (external)
LLM_URL=http://100.100.47.43:11434          # LLM service (external)
TTS_URL=http://streaming-tts:5053           # TTS service
LLM_MODEL=llama3.2                          # Default LLM model
VISION_MODEL=llama3.2-vision                # Vision model
DB_PATH=/data/conversations.db              # Database path
```

## Performance

Based on comprehensive load testing:

- **Concurrent Sessions**: 100+ supported
- **Message Throughput**: 200,000+ msg/sec
- **Average Latency**: < 0.01ms per message
- **Audio Processing**: 3,000 chunks/sec
- **Database Performance**: 16,000+ ops/sec
- **Memory per Session**: ~170 KB
- **WebSocket Connection**: < 1ms establishment

See [Performance Test Results](backend/tests/performance/load-testing.test.js) for details.

## API Reference

### WebSocket Messages

**Client → Server:**

```javascript
// Start conversation
{ type: 'start_conversation' }

// Send audio chunk
{ type: 'audio_chunk', audio: 'base64...' }

// Send text message
{ type: 'user_message', text: 'Hello' }

// Upload image
{
  type: 'upload_image',
  imageBase64: 'base64...',
  filename: 'image.png',
  mimeType: 'image/png'
}

// Interrupt AI response
{ type: 'interrupt', reason: 'user_spoke' }

// Stop conversation
{ type: 'stop_conversation' }
```

**Server → Client:**

```javascript
// State changes
{ type: 'state_change', state: 'listening' | 'transcribing' | 'thinking' | 'speaking' | 'analyzing_image' }

// Transcription
{ type: 'transcript_partial', text: '...' }
{ type: 'transcript_final', text: '...' }

// LLM response
{ type: 'llm_token', token: 'Hello', done: false }
{ type: 'llm_complete', fullText: 'Hello world' }

// Audio playback
{ type: 'audio_chunk', audio: 'base64...', chunkIndex: 0 }
{ type: 'audio_complete' }

// Vision analysis
{ type: 'vision_result', description: '...' }

// Tool calls
{ type: 'tool_call_start', toolName: 'get_time', args: {} }
{ type: 'tool_call_result', toolName: 'get_time', result: '...' }

// Errors
{ type: 'error', message: '...', phase: 'listening' }

// Connection
{ type: 'connected', sessionId: '...', message: 'Ready' }
```

### REST API

```bash
# Health check
GET /health
Response: { "status": "ok", "timestamp": "..." }

# Service status
GET /api/status
Response: {
  "vad": { "url": "...", "status": "online" },
  "stt": { "url": "...", "status": "online" },
  "llm": { "url": "...", "status": "online" },
  "tts": { "url": "...", "status": "online" }
}
```

## Available Tools

The LLM can execute these tools:

### get_current_time
```javascript
// Get current time
{ function: { name: 'get_current_time', arguments: { timezone: 'UTC' }}}
```

### get_weather
```javascript
// Get weather for location
{ function: { name: 'get_weather', arguments: { location: 'London, UK' }}}
```

### calculate
```javascript
// Perform calculation
{ function: { name: 'calculate', arguments: { expression: '25 * 4 + 10' }}}
```

## Troubleshooting

### Common Issues

**WebSocket Connection Failed:**
- Check backend is running: `curl http://localhost:3001/health`
- Check browser console for errors
- Verify no firewall blocking port 3001

**No Audio Playback:**
- Check browser permissions
- Verify TTS service is online: `curl http://localhost:5053/health`
- Check browser console for audio errors

**Transcription Not Working:**
- Verify microphone permission granted
- Check STT service: `curl http://100.89.2.111:5051/health`
- Check browser console for MediaRecorder errors

**Service Offline:**
```bash
# Check container status
docker-compose ps

# View logs
docker-compose logs -f backend

# Restart service
docker-compose restart backend
```

See [DEPLOYMENT.md](docs/DEPLOYMENT.md) for comprehensive troubleshooting.

## Contributing

This is a complete implementation following TDD principles:

1. All features have comprehensive test coverage
2. Tests are written before implementation
3. All 653 tests passing
4. Performance benchmarks established

## License

Open source - feel free to use and modify.

## Acknowledgments

Built with:
- Silero VAD for voice activity detection
- Faster-Whisper for speech recognition
- Ollama for LLM and vision
- Parler-TTS for speech synthesis
- React and Node.js

## Version

**Current Version**: 1.0.0
**Date**: 2025-11-09
**Tests**: 653 passing
**Status**: Production ready ✅
