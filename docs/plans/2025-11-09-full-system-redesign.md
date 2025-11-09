# Full System Redesign - OpenAI Realtime API Alternative

**Date:** 2025-11-09
**Goal:** Build a complete ChatGPT/OpenAI Realtime API equivalent using only open-source components
**Scope:** Complete frontend and backend rewrite with full feature parity

---

## Executive Summary

This design creates an open-source voice assistant matching OpenAI Realtime API and Google Gemini Live capabilities:

- **Continuous conversation mode** with hands-free interaction
- **Real-time interruption support** (speak over the AI like a real conversation)
- **Streaming responses** with token-by-token display
- **Multimodal support** (voice + vision)
- **Function calling** for dynamic tool use
- **Sub-2-second latency** for natural conversation flow

All using 100% free and open-source components.

---

## 1. System Architecture

### 1.1 Core Layers

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (React)                         │
│  - WebSocket client                                          │
│  - Real-time streaming UI                                    │
│  - Audio recording & playback with interruption support      │
│  - Vision upload                                             │
└─────────────────────────────────────────────────────────────┘
                              ↕ WebSocket
┌─────────────────────────────────────────────────────────────┐
│                Backend (Node.js + WebSocket)                 │
│  - Session & state management                                │
│  - Audio pipeline orchestration                              │
│  - Interruption handling                                     │
│  - Database persistence (SQLite)                             │
└─────────────────────────────────────────────────────────────┘
                              ↕ HTTP/gRPC
┌─────────────────────────────────────────────────────────────┐
│                   AI Services (Microservices)                │
│  - VAD (Silero-VAD): Continuous speech detection             │
│  - STT (Faster-Whisper): Audio transcription                 │
│  - LLM (Ollama): Text generation + tools + vision            │
│  - TTS (Parler-TTS): Streaming speech synthesis              │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 Key Innovation: Continuous VAD Monitoring

Unlike traditional turn-based systems, our VAD runs **continuously** during all phases:

- **During listening**: Detects when user starts/stops speaking
- **During AI speaking**: Detects user interruptions
- **Instant response**: <100ms from user speech to AI stopping

This creates the natural "interrupt anytime" behavior of human conversation.

---

## 2. WebSocket Communication Protocol

### 2.1 Frontend → Backend Messages

```javascript
// Conversation control
{ type: 'start_conversation', sessionId?: string }
{ type: 'stop_conversation' }
{ type: 'interrupt' }  // Manual interrupt button

// Audio streaming
{ type: 'audio_chunk', audio: base64, timestamp: number }

// Multimodal input
{ type: 'upload_image', image: base64, prompt?: string }
{ type: 'user_message', text: string }  // Text fallback
```

### 2.2 Backend → Frontend Messages

```javascript
// State transitions
{ type: 'state_change', state: 'idle|listening|transcribing|thinking|speaking' }

// Real-time transcription
{ type: 'transcript_partial', text: string }
{ type: 'transcript_final', text: string }

// Streaming LLM response
{ type: 'llm_token', token: string, done: boolean }
{ type: 'llm_complete', fullText: string }

// Audio playback
{ type: 'audio_chunk', audio: base64, chunkIndex: number }
{ type: 'audio_complete' }

// Function calling
{ type: 'tool_call_start', toolName: string, args: object }
{ type: 'tool_call_result', toolName: string, result: object }

// Vision analysis
{ type: 'vision_result', description: string }

// Interruption
{ type: 'interrupted', reason: 'user_speech|manual' }
{ type: 'stop_speaking' }  // Kill audio immediately

// Errors
{ type: 'error', message: string, phase: string }
```

### 2.3 Conversation Flow Example

```
User clicks "Start"
  → Frontend: { type: 'start_conversation' }
  → Backend: { type: 'state_change', state: 'listening' }
  → Frontend starts recording

User speaks "What's the weather?"
  → Frontend: { type: 'audio_chunk', ... } × N
  → VAD detects silence
  → Backend: { type: 'state_change', state: 'transcribing' }
  → Backend: { type: 'transcript_partial', text: 'What' }
  → Backend: { type: 'transcript_partial', text: 'What's the' }
  → Backend: { type: 'transcript_final', text: 'What's the weather?' }

LLM processes with tool calling
  → Backend: { type: 'state_change', state: 'thinking' }
  → Backend: { type: 'tool_call_start', toolName: 'get_weather', args: {} }
  → Backend: { type: 'tool_call_result', result: { temp: 72, ... } }
  → Backend: { type: 'llm_token', token: 'The' }
  → Backend: { type: 'llm_token', token: ' weather' }
  → Backend: { type: 'llm_token', token: ' is' }
  ... (streaming continues)
  → Backend: { type: 'llm_complete', fullText: '...' }

TTS generates audio
  → Backend: { type: 'state_change', state: 'speaking' }
  → Backend: { type: 'audio_chunk', audio: ..., chunkIndex: 0 }
  → Frontend plays audio
  → Backend: { type: 'audio_chunk', audio: ..., chunkIndex: 1 }
  ... (audio streaming continues)

User interrupts mid-speech
  → VAD detects speech during 'speaking' state
  → Backend: { type: 'interrupted', reason: 'user_speech' }
  → Backend: { type: 'stop_speaking' }
  → Frontend cancels audio playback immediately
  → Backend: { type: 'state_change', state: 'listening' }
  → Process new user input...
```

---

## 3. Frontend Architecture

### 3.1 Component Structure

```
App.js
├── WebSocketManager
│   └── Handles connection, reconnection, message routing
├── ConversationController
│   └── State machine, orchestrates conversation flow
├── ChatInterface
│   ├── MessageList
│   │   ├── UserMessage
│   │   ├── AssistantMessage (streaming support)
│   │   ├── FunctionCallMessage (shows tool execution)
│   │   └── VisionMessage (image + analysis)
│   ├── StreamingIndicator (phase animations)
│   └── InputArea (text fallback)
├── VoiceController
│   ├── AudioRecorder (continuous recording)
│   ├── VADMonitor (visual feedback)
│   └── AudioPlayer (with interrupt support)
├── VisionUploader (drag-drop images)
├── ControlPanel
│   ├── StartButton
│   ├── InterruptButton (only visible when AI speaking)
│   └── StopButton
└── ServiceStatus (health indicators)
```

### 3.2 State Management

**Using React Context + useReducer:**

```javascript
const ConversationState = {
  // Connection
  isConnected: boolean,
  sessionId: string | null,

  // Phase tracking
  phase: 'idle' | 'listening' | 'transcribing' | 'thinking' | 'speaking',

  // Content
  messages: Array<Message>,
  currentStreamingText: string,  // Accumulates tokens

  // Audio state
  isRecording: boolean,
  isPlayingAudio: boolean,
  canInterrupt: boolean,

  // Multimodal
  activeToolCalls: Array<ToolCall>,
  uploadedImages: Array<Image>,

  // UI
  error: string | null,
  serviceStatus: object
}
```

### 3.3 Key Frontend Features

1. **Real-time Streaming Text Display**
   - Tokens appear as they're generated
   - Smooth scrolling follows content
   - Cursor blink at end of streaming text

2. **Interruption Support**
   - "Interrupt" button visible only during speaking phase
   - Audio playback can be cancelled mid-stream
   - UI instantly transitions to listening state

3. **Phase Indicators**
   - Listening: Animated microphone with volume bars
   - Transcribing: Typing animation
   - Thinking: Pulsing dots
   - Speaking: Audio waveform visualization

4. **Vision Upload**
   - Drag-drop or click to upload
   - Image preview in chat
   - Analysis streams in like text

5. **Function Call Visualization**
   - Show tool name and arguments
   - Loading state while executing
   - Display results
   - Grouped with triggering message

---

## 4. Backend Architecture

### 4.1 Core Responsibilities

**server.js - Main WebSocket Server:**

1. **Session Management**
   - Create session on connection
   - Track state in memory + persist to SQLite
   - Handle reconnections (resume from last state)

2. **Audio Processing Pipeline**
   ```
   Audio chunks → VAD analysis → Buffer while speaking
                               → Process on silence
                               → STT transcription
                               → LLM + tools
                               → TTS streaming
                               → Audio chunks to frontend
   ```

3. **Interruption Engine**
   - VAD runs continuously in background
   - During 'speaking' phase:
     - If VAD detects speech → set interrupted flag
     - Send `stop_speaking` immediately
     - Cancel TTS stream
     - Discard remaining LLM tokens
     - Transition to 'listening'
     - Buffer new audio

4. **Tool Execution**
   - Parse LLM response for tool calls
   - Execute functions asynchronously
   - Send results to frontend for display
   - Feed results back to LLM
   - Support chained tool calls

5. **Vision Processing**
   - Receive base64 images
   - Send to llama3.2-vision model
   - Stream analysis back
   - Store in database

### 4.2 State Machine

```javascript
States: idle → listening → transcribing → thinking → speaking → listening (loop)

Transitions:
- idle → listening: User clicks "Start"
- listening → transcribing: VAD detects silence after speech
- transcribing → thinking: STT completes
- thinking → speaking: LLM completes (may have intermediate tool calls)
- speaking → listening: Audio playback completes
- speaking → listening: User interrupts (VAD detects speech)
- any → idle: User clicks "Stop"
```

### 4.3 Database Schema

```sql
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  ended_at DATETIME,
  user_agent TEXT,
  ip_address TEXT,
  message_count INTEGER DEFAULT 0,
  total_audio_duration REAL DEFAULT 0
);

CREATE TABLE messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL,  -- 'user' | 'assistant' | 'system' | 'tool'
  content TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  audio_duration REAL,
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

CREATE TABLE tool_calls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id INTEGER NOT NULL,
  tool_name TEXT NOT NULL,
  arguments TEXT NOT NULL,  -- JSON
  result TEXT,  -- JSON
  executed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  execution_time REAL,
  FOREIGN KEY (message_id) REFERENCES messages(id)
);

CREATE TABLE images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id INTEGER NOT NULL,
  base64_data TEXT NOT NULL,
  analysis TEXT,
  uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (message_id) REFERENCES messages(id)
);

CREATE INDEX idx_messages_session ON messages(session_id, created_at);
CREATE INDEX idx_tool_calls_message ON tool_calls(message_id);
CREATE INDEX idx_images_message ON images(message_id);
```

---

## 5. AI Services Integration

### 5.1 VAD Service (Silero-VAD)

**Purpose:** Continuous speech detection

**API:**
- `POST /api/detect_stream`
- Input: Audio chunks (16kHz, 16-bit PCM)
- Output: `{ is_speech: boolean, confidence: float, timestamp: number }`

**Usage Pattern:**
- Backend sends every audio chunk to VAD
- During listening: Accumulate audio while `is_speech: true`
- Process on silence (is_speech: false for >500ms)
- During speaking: If `is_speech: true` → trigger interrupt

**Configuration:**
```python
threshold=0.5
min_speech_duration_ms=250
min_silence_duration_ms=500
```

### 5.2 STT Service (Faster-Whisper)

**Purpose:** Audio transcription

**API:**
- `POST /api/transcribe`
- Input: Audio blob (WAV/WEBM)
- Output: `{ text: string, language: string, segments: Array }`

**Enhancement:**
- Request streaming if supported for real-time partial results
- Send `transcript_partial` messages as words appear

### 5.3 LLM Service (Ollama)

**Purpose:** Text generation with tools and vision

**Models:**
- `llama3.2` or `llama3.3` for text + tools
- `llama3.2-vision` for image analysis

**API:**
```javascript
POST /api/chat
{
  model: 'llama3.2',
  messages: [...conversation history],
  tools: [...available tools],
  stream: true
}

Response: Server-sent events with tokens
{
  message: { content: "token", tool_calls: [...] },
  done: false
}
```

**Tool Calling Flow:**
1. LLM streams tokens
2. Detect `tool_calls` in response
3. Execute tools
4. Send `tool_call_start` and `tool_call_result` to frontend
5. Feed results back to LLM with role: 'tool'
6. Continue streaming final response

**Conversation Context:**
Maintain full history:
```javascript
[
  { role: 'system', content: 'You are a helpful assistant...' },
  { role: 'user', content: 'What time is it?' },
  { role: 'assistant', content: '', tool_calls: [...] },
  { role: 'tool', name: 'get_current_time', content: '{"time": "14:30"}' },
  { role: 'assistant', content: 'It is 2:30 PM.' }
]
```

### 5.4 TTS Service (Parler-TTS)

**Purpose:** Streaming speech synthesis

**API:**
```javascript
POST /api/tts/stream
{
  text: "Full response text",
  style: "A warm, friendly voice speaks naturally."
}

Response: Streaming audio chunks
```

**Streaming Strategy:**
1. Split text into sentences
2. Generate audio per sentence in parallel
3. Send chunks as they're ready
4. Frontend queues and plays sequentially
5. On interrupt: Stop generating, frontend stops playback

**Audio Format:**
- Sample rate: 24kHz
- Format: WAV/PCM or base64-encoded chunks
- Chunk size: ~1 second of audio

### 5.5 Vision Service (Llama 3.2 Vision)

**Purpose:** Image analysis

**API:**
```javascript
POST /api/vision/analyze
{
  image: "base64_encoded_image",
  prompt: "What's in this image?"
}

Response:
{
  description: "Analysis text...",
  model: "llama3.2-vision"
}
```

**Integration:**
- User uploads image mid-conversation
- Backend sends to vision model
- Stream analysis back like LLM response
- Store image + analysis in database

---

## 6. Error Handling & Recovery

### 6.1 Service Failures

**Strategy: Graceful degradation**

1. **VAD offline:**
   - Fall back to fixed silence detection (2s timeout)
   - Disable interruption feature
   - Show warning to user

2. **STT offline:**
   - Show error message
   - Offer text input as fallback
   - Retry button

3. **LLM offline:**
   - Show error message
   - Offer to retry
   - Don't lose user's transcribed input

4. **TTS offline:**
   - Show text response only
   - No audio playback
   - Conversation continues

### 6.2 Network Issues

**WebSocket Disconnection:**
- Frontend auto-reconnect (exponential backoff: 1s, 2s, 4s, 8s, max 30s)
- Backend saves session state to database
- On reconnect: Send sessionId to resume
- Backend sends last state + recent messages

**Audio Buffer Loss:**
- Buffer audio chunks locally during disconnection
- Send when reconnected
- Timestamp each chunk for ordering

### 6.3 Audio Issues

**Microphone Permission Denied:**
- Clear instructions with browser-specific steps
- Offer text input as alternative

**No Speech Detected:**
- Timeout after 30s of silence
- Return to listening state
- Ask user if they're still there

**VAD False Positives:**
- Minimum audio duration: 250ms
- Require confidence > 0.5
- Debounce rapid speech/silence toggles

### 6.4 State Recovery

**Database Persistence:**
- Every state change saved to SQLite immediately
- On reconnect: Load last session state
- Frontend reconstructs UI from state + messages

**Session Resume:**
```javascript
// Frontend sends
{ type: 'resume_session', sessionId: 'abc123' }

// Backend responds
{
  type: 'session_resumed',
  state: 'listening',
  messages: [...last 10 messages],
  sessionId: 'abc123'
}
```

---

## 7. Performance Optimizations

### 7.1 Audio Processing

- **Chunk size**: 100ms chunks for VAD, aggregate for STT
- **Buffering**: Use ring buffer to avoid memory leaks
- **Compression**: Use Opus codec for WebSocket audio transfer
- **Parallel processing**: VAD and audio buffering run concurrently

### 7.2 Network Optimization

- **Message batching**: Debounce rapid WebSocket messages (16ms)
- **Binary frames**: Send audio as binary instead of base64 when possible
- **Compression**: Enable WebSocket compression

### 7.3 LLM Optimization

- **Context pruning**: Keep last 20 messages, summarize older ones
- **Streaming start**: Begin TTS on first sentence while LLM still generating
- **Tool parallelization**: Execute multiple tools concurrently when possible

### 7.4 Frontend Performance

- **Virtual scrolling**: For long message histories (>100 messages)
- **Audio preloading**: Queue next audio chunk before current finishes
- **React optimization**: useMemo for message rendering, useCallback for handlers

---

## 8. Deployment Strategy

### 8.1 Docker Compose Setup

```yaml
version: '3.8'

services:
  # AI Services
  vad-service:
    build: ./vad-service
    ports: ["5052:5052"]

  streaming-tts:
    build: ./streaming-tts-service
    ports: ["5053:5053"]

  # Backend
  backend:
    build: ./backend
    ports: ["3001:3001"]
    environment:
      - STT_URL=http://100.89.2.111:5051
      - LLM_URL=http://100.100.47.43:11434
      - TTS_URL=http://streaming-tts:5053
      - VAD_URL=http://vad-service:5052
    volumes:
      - backend-data:/data
    depends_on:
      - vad-service
      - streaming-tts

  # Frontend
  frontend:
    build: ./frontend
    ports: ["8080:80"]
    depends_on:
      - backend

volumes:
  backend-data:
```

### 8.2 Health Checks

All services must implement `/health` endpoint:
```javascript
GET /health
→ { status: 'ok', uptime: 12345, ... }
```

Docker health checks:
```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:5052/health"]
  interval: 30s
  timeout: 10s
  retries: 3
```

### 8.3 Graceful Shutdown

On SIGTERM:
1. Stop accepting new connections
2. Wait for active conversations to complete (max 60s)
3. Save all session states to database
4. Close database connections
5. Exit

### 8.4 Monitoring & Logging

**Metrics to track:**
- Active WebSocket connections
- Average latency per phase (listening→transcribing→thinking→speaking)
- Interruption rate
- Error rate per service
- Audio chunk queue size

**Logging:**
- All state transitions with timestamps
- Tool executions with duration
- Errors with context (session, phase, service)

---

## 9. Testing Plan

### 9.1 Unit Tests

- State machine transitions
- Tool execution functions
- WebSocket message handling
- Audio chunk buffering
- Database operations

### 9.2 Integration Tests

- Full conversation flow (start → speak → respond → end)
- Interruption at each phase
- Tool calling with multiple tools
- Vision upload and analysis
- Session resume after disconnect

### 9.3 Load Tests

- 100 concurrent conversations
- Measure latency under load
- Memory leak detection (long-running sessions)
- WebSocket connection limits

### 9.4 Manual QA Checklist

- [ ] Start conversation → speak → AI responds correctly
- [ ] Interrupt during AI speech → AI stops immediately
- [ ] Upload image → AI analyzes correctly
- [ ] Trigger tool call (weather, time, calculator) → shows in UI
- [ ] Disconnect → reconnect → session resumes
- [ ] Each service offline → graceful degradation works
- [ ] Multiple rapid turns → no state confusion
- [ ] Long conversation (50+ turns) → performance stable

---

## 10. Migration Plan

### 10.1 Zero-Downtime Migration

Since downtime is acceptable, we'll do a clean redeployment:

1. **Backup current data:**
   ```bash
   docker-compose down
   cp -r backend/data backend/data.backup
   ```

2. **Deploy new system:**
   ```bash
   git checkout redesign-branch
   docker-compose build
   docker-compose up -d
   ```

3. **Verify health:**
   ```bash
   curl http://localhost:3001/health
   curl http://localhost:3001/api/status
   ```

4. **Rollback if needed:**
   ```bash
   docker-compose down
   git checkout main
   docker-compose up -d
   ```

### 10.2 Database Migration

Since we're redesigning schema:
- Old database won't be migrated
- Fresh start with new schema
- Old data archived in backup

### 10.3 Frontend Updates

- New build artifacts completely replace old ones
- No backward compatibility needed
- Users refresh page to get new version

---

## 11. Success Criteria

### 11.1 Functional Requirements

- [x] Continuous conversation mode works
- [x] Users can interrupt AI mid-speech
- [x] Streaming text displays in real-time
- [x] Tool calling works and shows in UI
- [x] Vision upload and analysis works
- [x] Session persistence and resume works

### 11.2 Performance Requirements

- Latency targets:
  - User stops speaking → transcription starts: <500ms
  - Transcription complete → LLM first token: <1s
  - LLM first token → TTS first audio chunk: <500ms
  - Total (silence detected → audio starts): <2s

- Interruption response: <100ms

### 11.3 Reliability Requirements

- Uptime: 99%+ (service restarts allowed)
- Error recovery: All errors handled gracefully
- Data persistence: No message loss on disconnect

---

## 12. Future Enhancements (Post-MVP)

**Not in scope for initial implementation, but designed to support:**

1. **Multi-user support**: Session isolation, user accounts
2. **Voice selection**: Multiple TTS voices, user preference
3. **Language support**: Multi-language STT/TTS
4. **Mobile app**: React Native wrapper
5. **Screen sharing**: Real-time screen analysis
6. **Persistent memory**: Long-term user preferences and context
7. **Custom tools**: User-defined functions via UI
8. **Analytics**: Conversation insights, usage patterns

---

## Conclusion

This design creates a production-ready, open-source alternative to OpenAI Realtime API with:

- ✅ Feature parity with commercial solutions
- ✅ 100% open-source components
- ✅ Sub-2-second latency
- ✅ Natural interruption support
- ✅ Multimodal capabilities
- ✅ Extensible architecture

**Total estimated implementation time:** 2-3 days for core functionality + 1 day for testing and polish.

**Key success factors:**
1. WebSocket-first architecture for real-time streaming
2. Continuous VAD monitoring for natural interruptions
3. Proper state machine for robust conversation flow
4. Comprehensive error handling and recovery
5. Performance optimizations at every layer

The system is designed to be maintainable, testable, and extensible for future enhancements.
