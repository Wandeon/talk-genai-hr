# AI Voice Chat Web Application

**Modern web interface for conversational AI with voice interaction**

Talk naturally with AI through your browser! This React-based web application provides a beautiful, intuitive interface for voice conversations with AI, integrating Speech-to-Text, Large Language Models, and Text-to-Speech services.

## Features

- **Voice Recording** - Click to record, speak naturally, automatic processing
- **Real-time Transcription** - See your words transcribed instantly
- **AI Responses** - Powered by local LLMs via Ollama
- **Speech Synthesis** - Hear AI responses with realistic voice
- **Conversation History** - Full chat history with timestamps
- **Service Status** - Real-time monitoring of backend services
- **Modern UI** - Beautiful gradient design, responsive layout
- **Easy Deployment** - Docker-ready for quick setup

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Voice Chat Web App                    │
├─────────────────────────────────────────────────────────┤
│                                                           │
│   React Frontend (Port 80)                               │
│   ├── Voice Recorder Component                           │
│   ├── Chat Interface                                     │
│   ├── Service Status Display                             │
│   └── Nginx (Proxy + Static Files)                       │
│                       │                                   │
│                       ↓                                   │
│   Node.js Backend (Port 3001)                            │
│   ├── API Proxy Layer                                    │
│   ├── File Upload Handler                                │
│   └── Service Integration                                │
│                       │                                   │
│          ┌────────────┼────────────┐                     │
│          ↓            ↓             ↓                     │
│   STT Service    LLM Service   TTS Service               │
│   (Port 5051)   (Port 11434)   (Port 5050)               │
│   100.89.2.111  100.89.2.111   100.89.2.111              │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

## Quick Start

### Prerequisites

Ensure the following AI services are running on your Tailscale network:

1. **STT Service (Faster-Whisper)** - http://100.89.2.111:5051
2. **LLM Service (Ollama)** - http://100.89.2.111:11434
3. **TTS Service (Coqui)** - http://100.89.2.111:5050

### Option 1: Docker Deployment (Recommended)

```bash
# Clone or navigate to the project
cd voice-chat-app

# Build and start services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

The application will be available at:
- **Frontend**: http://localhost
- **Backend API**: http://localhost:3001

### Option 2: Development Mode

**Backend:**
```bash
cd backend
cp .env.example .env
npm install
npm start
```

**Frontend:**
```bash
cd frontend
npm install
npm start
```

The application will be available at:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001

## Configuration

### Backend Environment Variables

Create `backend/.env`:

```bash
PORT=3001

# AI Service URLs (Tailscale network)
STT_URL=http://100.89.2.111:5051
LLM_URL=http://100.89.2.111:11434
TTS_URL=http://100.89.2.111:5050

# LLM Model
LLM_MODEL=llama3.2
```

### Frontend Configuration

The frontend uses the backend as a proxy (configured in `package.json`). For production, adjust the `REACT_APP_API_URL` if needed.

## Usage

1. **Open the application** in your browser (http://localhost or http://localhost:3000)

2. **Check service status** at the top - all services should show ✓ Online

3. **Click "Start Recording"** to begin

4. **Speak naturally** - the app will automatically detect when you stop

5. **Wait for processing**:
   - 📝 Transcribing... (STT converts speech to text)
   - 🤔 Thinking... (LLM generates response)
   - 🔊 Speaking... (TTS converts text to speech)

6. **Continue the conversation** - the AI maintains context

### Voice Commands

- **"Clear history"** - Reset the conversation
- **"Goodbye"** / **"Exit"** / **"Quit"** - End the session

## API Endpoints

### Backend API

- `GET /health` - Health check
- `GET /api/status` - Check all AI services status
- `POST /api/transcribe` - Transcribe audio file (multipart/form-data)
- `POST /api/chat` - Send messages to LLM
- `POST /api/tts` - Convert text to speech
- `GET /api/audio/:filename` - Fetch audio file from TTS service

## Project Structure

```
voice-chat-app/
├── backend/
│   ├── server.js           # Express API server
│   ├── package.json        # Backend dependencies
│   ├── Dockerfile          # Backend container
│   └── .env.example        # Environment template
├── frontend/
│   ├── public/
│   │   └── index.html      # HTML entry point
│   ├── src/
│   │   ├── App.js          # Main React component
│   │   ├── index.js        # React entry point
│   │   ├── components/
│   │   │   ├── ChatMessage.js      # Message display
│   │   │   ├── VoiceRecorder.js    # Audio recording
│   │   │   └── ServiceStatus.js    # Service monitoring
│   │   └── styles/
│   │       └── App.css     # Application styles
│   ├── package.json        # Frontend dependencies
│   ├── Dockerfile          # Frontend container
│   └── nginx.conf          # Nginx configuration
├── docker-compose.yml      # Orchestration
└── README.md              # This file
```

## Browser Compatibility

The application requires a modern browser with:
- **MediaRecorder API** (for audio recording)
- **getUserMedia API** (for microphone access)
- **Audio API** (for playback)

**Supported browsers:**
- Chrome/Edge 49+
- Firefox 29+
- Safari 14.1+

## Troubleshooting

### Microphone Access Denied

1. Check browser permissions (click lock icon in address bar)
2. Allow microphone access for the site
3. Refresh the page

### Services Offline

1. Click "🔄 Check Services" to refresh status
2. Verify AI services are running on 100.89.2.111
3. Check Tailscale connectivity
4. Review backend logs: `docker-compose logs backend`

### No Audio Playback

1. Check system volume
2. Verify TTS service is online
3. Try a different browser
4. Check browser console for errors (F12)

### Docker Build Fails

```bash
# Clear Docker cache and rebuild
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Long Response Times

- **STT**: ~1-2s for transcription
- **LLM**: ~2-4s for response generation
- **TTS**: ~2-4s for speech synthesis
- **Total**: ~5-10s per conversation turn

This is normal for CPU-based processing. For faster responses:
- Use smaller LLM model (llama3.2:1b)
- Enable GPU acceleration on AI services
- Use faster STT model

## Development

### Running Tests

```bash
# Backend tests
cd backend
npm test

# Frontend tests
cd frontend
npm test
```

### Code Style

The project uses:
- **ESLint** for JavaScript linting
- **Prettier** for code formatting

### Building for Production

```bash
# Build frontend
cd frontend
npm run build

# The build folder contains production-ready files
```

## Performance

| Component | Latency | Notes |
|-----------|---------|-------|
| **Audio Recording** | ~2-5s | User-dependent |
| **Network Transfer** | <1s | Via Tailscale |
| **STT Processing** | ~1-2s | CPU-based |
| **LLM Processing** | ~2-4s | Depends on response length |
| **TTS Processing** | ~2-4s | CPU-based |
| **Total Round Trip** | ~5-10s | End-to-end conversation turn |

## Security

- **Backend Proxy**: Prevents CORS issues, adds security layer
- **Tailscale Network**: Private mesh VPN, no public exposure
- **No Data Storage**: Conversations exist only in browser memory
- **Local AI**: All processing on your infrastructure
- **No External APIs**: 100% self-hosted

## Deployment to VPS

### Using Docker Compose

1. **Copy project to VPS**:
```bash
scp -r voice-chat-app/ root@your-vps:/opt/
```

2. **SSH to VPS and deploy**:
```bash
ssh root@your-vps
cd /opt/voice-chat-app
docker-compose up -d
```

3. **Configure reverse proxy** (optional, using Caddy):
```
voice-chat.yourdomain.com {
    reverse_proxy localhost:80
}
```

### Environment-Specific Configuration

For production deployment, update `docker-compose.yml` with your service URLs:

```yaml
environment:
  - STT_URL=http://your-stt-service:5051
  - LLM_URL=http://your-llm-service:11434
  - TTS_URL=http://your-tts-service:5050
```

## Contributing

Feel free to modify and improve! The codebase is modular and well-documented.

## License

Built using open-source components:
- **React**: MIT License
- **Express**: MIT License
- **Nginx**: BSD-2-Clause License

## Credits

This application integrates:
- **Faster-Whisper** for speech recognition
- **Ollama** with Llama/Mistral for language understanding
- **Coqui XTTS** for speech synthesis

---

**Enjoy natural conversations with AI!** 🤖✨
