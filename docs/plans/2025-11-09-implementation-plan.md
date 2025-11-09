# Full System Redesign - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a complete open-source alternative to OpenAI Realtime API with continuous conversation, real-time interruption support, and multimodal capabilities.

**Architecture:** Pure WebSocket architecture with backend state machine orchestrating VAD, STT, LLM, and TTS services. Frontend streams all content in real-time with interrupt support.

**Tech Stack:** Node.js + WebSocket, React + Hooks, SQLite, Silero-VAD, Faster-Whisper, Ollama, Parler-TTS

---

## Phase 1: Backend Foundation

### Task 1: Database Schema and Initialization

**Files:**
- Create: `backend/database.js` (already exists, will modify)
- Test: `backend/tests/database.test.js`

**Step 1: Write failing test for database initialization**

Create `backend/tests/database.test.js`:

```javascript
const db = require('../database');
const fs = require('fs');

describe('Database', () => {
  beforeEach(() => {
    if (fs.existsSync('/tmp/test.db')) {
      fs.unlinkSync('/tmp/test.db');
    }
  });

  test('should initialize database with correct schema', async () => {
    await db.initialize('/tmp/test.db');

    const tables = await db.getTables();
    expect(tables).toContain('sessions');
    expect(tables).toContain('messages');
    expect(tables).toContain('tool_calls');
    expect(tables).toContain('images');
  });

  test('should create session', async () => {
    await db.initialize('/tmp/test.db');
    const sessionId = await db.createSession({ userAgent: 'test', ip: '127.0.0.1' });

    expect(sessionId).toBeTruthy();
    const session = await db.getSession(sessionId);
    expect(session.id).toBe(sessionId);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd backend && npm test -- database.test.js`
Expected: FAIL - "getTables is not a function"

**Step 3: Update database.js with new schema**

Modify `backend/database.js`:

```javascript
const sqlite3 = require('sqlite3').verbose();
const { promisify } = require('util');

let db = null;

async function initialize(dbPath = '/data/conversations.db') {
  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(dbPath, (err) => {
      if (err) reject(err);

      db.run(`CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        ended_at DATETIME,
        user_agent TEXT,
        ip_address TEXT,
        message_count INTEGER DEFAULT 0,
        total_audio_duration REAL DEFAULT 0
      )`, (err) => {
        if (err) reject(err);

        db.run(`CREATE TABLE IF NOT EXISTS messages (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          session_id TEXT NOT NULL,
          role TEXT NOT NULL,
          content TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          audio_duration REAL,
          FOREIGN KEY (session_id) REFERENCES sessions(id)
        )`, (err) => {
          if (err) reject(err);

          db.run(`CREATE TABLE IF NOT EXISTS tool_calls (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            message_id INTEGER NOT NULL,
            tool_name TEXT NOT NULL,
            arguments TEXT NOT NULL,
            result TEXT,
            executed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            execution_time REAL,
            FOREIGN KEY (message_id) REFERENCES messages(id)
          )`, (err) => {
            if (err) reject(err);

            db.run(`CREATE TABLE IF NOT EXISTS images (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              message_id INTEGER NOT NULL,
              base64_data TEXT NOT NULL,
              analysis TEXT,
              uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (message_id) REFERENCES messages(id)
            )`, (err) => {
              if (err) reject(err);

              db.run(`CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id, created_at)`, (err) => {
                if (err) reject(err);
                resolve();
              });
            });
          });
        });
      });
    });
  });
}

async function getTables() {
  return new Promise((resolve, reject) => {
    db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, rows) => {
      if (err) reject(err);
      resolve(rows.map(r => r.name));
    });
  });
}

async function createSession(metadata) {
  const sessionId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO sessions (id, user_agent, ip_address) VALUES (?, ?, ?)',
      [sessionId, metadata.userAgent, metadata.ip],
      (err) => {
        if (err) reject(err);
        resolve(sessionId);
      }
    );
  });
}

async function getSession(sessionId) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM sessions WHERE id = ?', [sessionId], (err, row) => {
      if (err) reject(err);
      resolve(row);
    });
  });
}

module.exports = {
  initialize,
  getTables,
  createSession,
  getSession
};
```

**Step 4: Run test to verify it passes**

Run: `cd backend && npm test -- database.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add backend/database.js backend/tests/database.test.js
git commit -m "feat(db): implement new database schema for WebSocket architecture

- Add sessions, messages, tool_calls, images tables
- Add initialization and basic operations
- Add tests for schema validation

Part of full system redesign"
```

---

### Task 2: WebSocket State Machine

**Files:**
- Create: `backend/lib/StateMachine.js`
- Test: `backend/tests/StateMachine.test.js`

**Step 1: Write failing test for state machine**

Create `backend/tests/StateMachine.test.js`:

```javascript
const StateMachine = require('../lib/StateMachine');

describe('StateMachine', () => {
  let sm;

  beforeEach(() => {
    sm = new StateMachine();
  });

  test('should start in idle state', () => {
    expect(sm.getState()).toBe('idle');
  });

  test('should transition idle → listening on start', () => {
    sm.transition('start');
    expect(sm.getState()).toBe('listening');
  });

  test('should transition listening → transcribing on silence', () => {
    sm.transition('start');
    sm.transition('silence_detected');
    expect(sm.getState()).toBe('transcribing');
  });

  test('should transition transcribing → thinking on transcription_complete', () => {
    sm.transition('start');
    sm.transition('silence_detected');
    sm.transition('transcription_complete');
    expect(sm.getState()).toBe('thinking');
  });

  test('should transition thinking → speaking on llm_complete', () => {
    sm.transition('start');
    sm.transition('silence_detected');
    sm.transition('transcription_complete');
    sm.transition('llm_complete');
    expect(sm.getState()).toBe('speaking');
  });

  test('should transition speaking → listening on audio_complete', () => {
    sm.transition('start');
    sm.transition('silence_detected');
    sm.transition('transcription_complete');
    sm.transition('llm_complete');
    sm.transition('audio_complete');
    expect(sm.getState()).toBe('listening');
  });

  test('should transition speaking → listening on interrupt', () => {
    sm.transition('start');
    sm.transition('silence_detected');
    sm.transition('transcription_complete');
    sm.transition('llm_complete');
    sm.transition('interrupt');
    expect(sm.getState()).toBe('listening');
  });

  test('should transition any state → idle on stop', () => {
    sm.transition('start');
    sm.transition('stop');
    expect(sm.getState()).toBe('idle');
  });

  test('should call callback on state change', () => {
    const callback = jest.fn();
    sm.onStateChange(callback);
    sm.transition('start');
    expect(callback).toHaveBeenCalledWith('idle', 'listening');
  });

  test('should throw error on invalid transition', () => {
    expect(() => sm.transition('invalid')).toThrow();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd backend && npm test -- StateMachine.test.js`
Expected: FAIL - "Cannot find module '../lib/StateMachine'"

**Step 3: Implement state machine**

Create `backend/lib/StateMachine.js`:

```javascript
class StateMachine {
  constructor() {
    this.state = 'idle';
    this.callbacks = [];

    // Define valid transitions
    this.transitions = {
      idle: ['start'],
      listening: ['silence_detected', 'stop'],
      transcribing: ['transcription_complete', 'stop'],
      thinking: ['llm_complete', 'stop'],
      speaking: ['audio_complete', 'interrupt', 'stop']
    };

    // Define next states
    this.nextStates = {
      start: 'listening',
      silence_detected: 'transcribing',
      transcription_complete: 'thinking',
      llm_complete: 'speaking',
      audio_complete: 'listening',
      interrupt: 'listening',
      stop: 'idle'
    };
  }

  getState() {
    return this.state;
  }

  transition(event) {
    const validTransitions = this.transitions[this.state];

    if (!validTransitions || !validTransitions.includes(event)) {
      throw new Error(`Invalid transition: ${event} from state ${this.state}`);
    }

    const oldState = this.state;
    this.state = this.nextStates[event];

    // Notify callbacks
    this.callbacks.forEach(cb => cb(oldState, this.state));
  }

  onStateChange(callback) {
    this.callbacks.push(callback);
  }

  reset() {
    this.state = 'idle';
  }
}

module.exports = StateMachine;
```

**Step 4: Run test to verify it passes**

Run: `cd backend && npm test -- StateMachine.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add backend/lib/StateMachine.js backend/tests/StateMachine.test.js
git commit -m "feat(backend): add state machine for conversation flow

- Implement state transitions: idle → listening → transcribing → thinking → speaking
- Support interruptions (speaking → listening)
- Add state change callbacks
- Full test coverage

Part of full system redesign"
```

---

### Task 3: WebSocket Session Manager

**Files:**
- Create: `backend/lib/SessionManager.js`
- Test: `backend/tests/SessionManager.test.js`

**Step 1: Write failing test**

Create `backend/tests/SessionManager.test.js`:

```javascript
const SessionManager = require('../lib/SessionManager');
const StateMachine = require('../lib/StateMachine');

describe('SessionManager', () => {
  let session;

  beforeEach(() => {
    session = new SessionManager('test-123');
  });

  test('should initialize with session ID', () => {
    expect(session.id).toBe('test-123');
  });

  test('should have state machine', () => {
    expect(session.stateMachine).toBeInstanceOf(StateMachine);
  });

  test('should start in idle state', () => {
    expect(session.getState()).toBe('idle');
  });

  test('should accumulate audio chunks', () => {
    session.addAudioChunk('chunk1');
    session.addAudioChunk('chunk2');
    expect(session.audioChunks).toEqual(['chunk1', 'chunk2']);
  });

  test('should clear audio chunks', () => {
    session.addAudioChunk('chunk1');
    session.clearAudioChunks();
    expect(session.audioChunks).toEqual([]);
  });

  test('should track conversation history', () => {
    session.addMessage('user', 'Hello');
    session.addMessage('assistant', 'Hi there');
    expect(session.conversationHistory).toHaveLength(2);
  });

  test('should set interrupted flag', () => {
    expect(session.isInterrupted()).toBe(false);
    session.setInterrupted(true);
    expect(session.isInterrupted()).toBe(true);
  });

  test('should get metadata', () => {
    const metadata = session.getMetadata();
    expect(metadata.id).toBe('test-123');
    expect(metadata.state).toBe('idle');
    expect(metadata.messageCount).toBe(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd backend && npm test -- SessionManager.test.js`
Expected: FAIL

**Step 3: Implement SessionManager**

Create `backend/lib/SessionManager.js`:

```javascript
const StateMachine = require('./StateMachine');

class SessionManager {
  constructor(sessionId) {
    this.id = sessionId;
    this.stateMachine = new StateMachine();
    this.audioChunks = [];
    this.conversationHistory = [];
    this.interrupted = false;
    this.createdAt = new Date();
    this.metadata = {};
  }

  getState() {
    return this.stateMachine.getState();
  }

  transition(event) {
    this.stateMachine.transition(event);
  }

  addAudioChunk(chunk) {
    this.audioChunks.push(chunk);
  }

  clearAudioChunks() {
    this.audioChunks = [];
  }

  addMessage(role, content) {
    this.conversationHistory.push({
      role,
      content,
      timestamp: new Date()
    });
  }

  setInterrupted(value) {
    this.interrupted = value;
  }

  isInterrupted() {
    return this.interrupted;
  }

  getMetadata() {
    return {
      id: this.id,
      state: this.getState(),
      messageCount: this.conversationHistory.length,
      audioChunkCount: this.audioChunks.length,
      createdAt: this.createdAt,
      interrupted: this.interrupted
    };
  }

  reset() {
    this.stateMachine.reset();
    this.audioChunks = [];
    this.interrupted = false;
  }
}

module.exports = SessionManager;
```

**Step 4: Run test to verify it passes**

Run: `cd backend && npm test -- SessionManager.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add backend/lib/SessionManager.js backend/tests/SessionManager.test.js
git commit -m "feat(backend): add session manager for WebSocket sessions

- Manage session state with state machine
- Track audio chunks and conversation history
- Handle interruption flag
- Provide session metadata

Part of full system redesign"
```

---

### Task 4: WebSocket Server Foundation

**Files:**
- Modify: `backend/server.js` (complete rewrite)
- Create: `backend/lib/WebSocketHandler.js`
- Test: `backend/tests/WebSocketHandler.test.js`

**Step 1: Write failing test**

Create `backend/tests/WebSocketHandler.test.js`:

```javascript
const WebSocket = require('ws');
const WebSocketHandler = require('../lib/WebSocketHandler');
const SessionManager = require('../lib/SessionManager');

describe('WebSocketHandler', () => {
  let handler;
  let mockWs;
  let session;

  beforeEach(() => {
    session = new SessionManager('test-session');
    mockWs = {
      send: jest.fn(),
      on: jest.fn()
    };
    handler = new WebSocketHandler(mockWs, session);
  });

  test('should initialize with websocket and session', () => {
    expect(handler.ws).toBe(mockWs);
    expect(handler.session).toBe(session);
  });

  test('should send state change message', () => {
    handler.sendStateChange('listening');
    expect(mockWs.send).toHaveBeenCalledWith(
      JSON.stringify({ type: 'state_change', state: 'listening' })
    );
  });

  test('should send error message', () => {
    handler.sendError('Test error', 'listening');
    expect(mockWs.send).toHaveBeenCalledWith(
      JSON.stringify({ type: 'error', message: 'Test error', phase: 'listening' })
    );
  });

  test('should send LLM token', () => {
    handler.sendLLMToken('Hello', false);
    expect(mockWs.send).toHaveBeenCalledWith(
      JSON.stringify({ type: 'llm_token', token: 'Hello', done: false })
    );
  });

  test('should send audio chunk', () => {
    handler.sendAudioChunk('base64audio', 0);
    expect(mockWs.send).toHaveBeenCalledWith(
      JSON.stringify({ type: 'audio_chunk', audio: 'base64audio', chunkIndex: 0 })
    );
  });

  test('should send stop speaking command', () => {
    handler.sendStopSpeaking();
    expect(mockWs.send).toHaveBeenCalledWith(
      JSON.stringify({ type: 'stop_speaking' })
    );
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd backend && npm test -- WebSocketHandler.test.js`
Expected: FAIL

**Step 3: Implement WebSocketHandler**

Create `backend/lib/WebSocketHandler.js`:

```javascript
class WebSocketHandler {
  constructor(ws, session) {
    this.ws = ws;
    this.session = session;
  }

  send(message) {
    if (this.ws.readyState === 1) { // OPEN
      this.ws.send(JSON.stringify(message));
    }
  }

  sendStateChange(state) {
    this.send({ type: 'state_change', state });
  }

  sendError(message, phase) {
    this.send({ type: 'error', message, phase });
  }

  sendTranscriptPartial(text) {
    this.send({ type: 'transcript_partial', text });
  }

  sendTranscriptFinal(text) {
    this.send({ type: 'transcript_final', text });
  }

  sendLLMToken(token, done = false) {
    this.send({ type: 'llm_token', token, done });
  }

  sendLLMComplete(fullText) {
    this.send({ type: 'llm_complete', fullText });
  }

  sendAudioChunk(audio, chunkIndex) {
    this.send({ type: 'audio_chunk', audio, chunkIndex });
  }

  sendAudioComplete() {
    this.send({ type: 'audio_complete' });
  }

  sendToolCallStart(toolName, args) {
    this.send({ type: 'tool_call_start', toolName, args });
  }

  sendToolCallResult(toolName, result) {
    this.send({ type: 'tool_call_result', toolName, result });
  }

  sendVisionResult(description) {
    this.send({ type: 'vision_result', description });
  }

  sendInterrupted(reason) {
    this.send({ type: 'interrupted', reason });
  }

  sendStopSpeaking() {
    this.send({ type: 'stop_speaking' });
  }

  sendConnected(sessionId) {
    this.send({ type: 'connected', sessionId, message: 'Ready for conversation' });
  }
}

module.exports = WebSocketHandler;
```

**Step 4: Run test to verify it passes**

Run: `cd backend && npm test -- WebSocketHandler.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add backend/lib/WebSocketHandler.js backend/tests/WebSocketHandler.test.js
git commit -m "feat(backend): add WebSocket message handler

- Centralize WebSocket message sending
- Type-safe message construction
- Support all message types from protocol spec

Part of full system redesign"
```

---

## Phase 2: AI Service Integration

### Task 5: VAD Service Client

**Files:**
- Create: `backend/lib/services/VADClient.js`
- Test: `backend/tests/services/VADClient.test.js`

**Step 1: Write failing test**

Create `backend/tests/services/VADClient.test.js`:

```javascript
const VADClient = require('../../lib/services/VADClient');
const axios = require('axios');

jest.mock('axios');

describe('VADClient', () => {
  let client;

  beforeEach(() => {
    client = new VADClient('http://localhost:5052');
    jest.clearAllMocks();
  });

  test('should detect speech in audio chunk', async () => {
    axios.post.mockResolvedValue({
      data: { is_speech: true, confidence: 0.85, timestamp: 123456 }
    });

    const result = await client.detectSpeech('audiobase64');
    expect(result.is_speech).toBe(true);
    expect(result.confidence).toBe(0.85);
  });

  test('should detect silence', async () => {
    axios.post.mockResolvedValue({
      data: { is_speech: false, confidence: 0.15, timestamp: 123457 }
    });

    const result = await client.detectSpeech('audiobase64');
    expect(result.is_speech).toBe(false);
  });

  test('should check health', async () => {
    axios.get.mockResolvedValue({
      data: { status: 'ok', model_loaded: true }
    });

    const health = await client.checkHealth();
    expect(health.status).toBe('ok');
  });

  test('should handle service errors', async () => {
    axios.post.mockRejectedValue(new Error('Service unavailable'));

    await expect(client.detectSpeech('audio')).rejects.toThrow('Service unavailable');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd backend && npm test -- VADClient.test.js`
Expected: FAIL

**Step 3: Implement VAD client**

Create `backend/lib/services/VADClient.js`:

```javascript
const axios = require('axios');

class VADClient {
  constructor(baseURL) {
    this.baseURL = baseURL;
    this.client = axios.create({
      baseURL,
      timeout: 5000
    });
  }

  async detectSpeech(audioBase64) {
    try {
      const response = await this.client.post('/api/detect_stream', {
        audio: audioBase64
      });
      return response.data;
    } catch (error) {
      throw new Error(`VAD error: ${error.message}`);
    }
  }

  async checkHealth() {
    try {
      const response = await this.client.get('/health');
      return response.data;
    } catch (error) {
      throw new Error(`VAD health check failed: ${error.message}`);
    }
  }
}

module.exports = VADClient;
```

**Step 4: Run test to verify it passes**

Run: `cd backend && npm test -- VADClient.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add backend/lib/services/VADClient.js backend/tests/services/VADClient.test.js
git commit -m "feat(backend): add VAD service client

- Detect speech in audio chunks
- Health check endpoint
- Error handling

Part of full system redesign"
```

---

### Task 6: STT Service Client

**Files:**
- Create: `backend/lib/services/STTClient.js`
- Test: `backend/tests/services/STTClient.test.js`

**Step 1: Write failing test**

Create `backend/tests/services/STTClient.test.js`:

```javascript
const STTClient = require('../../lib/services/STTClient');
const axios = require('axios');
const FormData = require('form-data');

jest.mock('axios');

describe('STTClient', () => {
  let client;

  beforeEach(() => {
    client = new STTClient('http://localhost:5051');
    jest.clearAllMocks();
  });

  test('should transcribe audio', async () => {
    axios.post.mockResolvedValue({
      data: { text: 'Hello world', language: 'en' }
    });

    const result = await client.transcribe(Buffer.from('audio'));
    expect(result.text).toBe('Hello world');
    expect(result.language).toBe('en');
  });

  test('should handle transcription errors', async () => {
    axios.post.mockRejectedValue(new Error('Transcription failed'));

    await expect(client.transcribe(Buffer.from('audio'))).rejects.toThrow('Transcription failed');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd backend && npm test -- STTClient.test.js`
Expected: FAIL

**Step 3: Implement STT client**

Create `backend/lib/services/STTClient.js`:

```javascript
const axios = require('axios');
const FormData = require('form-data');

class STTClient {
  constructor(baseURL) {
    this.baseURL = baseURL;
  }

  async transcribe(audioBuffer, language = 'en') {
    try {
      const formData = new FormData();
      formData.append('audio', audioBuffer, 'audio.wav');
      formData.append('language', language);

      const response = await axios.post(`${this.baseURL}/api/transcribe`, formData, {
        headers: formData.getHeaders(),
        timeout: 30000
      });

      return response.data;
    } catch (error) {
      throw new Error(`STT error: ${error.message}`);
    }
  }

  async checkHealth() {
    try {
      const response = await axios.get(`${this.baseURL}/health`, { timeout: 2000 });
      return response.data;
    } catch (error) {
      throw new Error(`STT health check failed: ${error.message}`);
    }
  }
}

module.exports = STTClient;
```

**Step 4: Run test to verify it passes**

Run: `cd backend && npm test -- STTClient.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add backend/lib/services/STTClient.js backend/tests/services/STTClient.test.js
git commit -m "feat(backend): add STT service client

- Transcribe audio to text
- Support language parameter
- Health check
- Error handling

Part of full system redesign"
```

---

### Task 7: LLM Service Client with Streaming

**Files:**
- Create: `backend/lib/services/LLMClient.js`
- Test: `backend/tests/services/LLMClient.test.js`

**Step 1: Write failing test**

Create `backend/tests/services/LLMClient.test.js`:

```javascript
const LLMClient = require('../../lib/services/LLMClient');
const axios = require('axios');

jest.mock('axios');

describe('LLMClient', () => {
  let client;

  beforeEach(() => {
    client = new LLMClient('http://localhost:11434');
    jest.clearAllMocks();
  });

  test('should stream LLM response', async () => {
    const mockStream = {
      on: jest.fn((event, callback) => {
        if (event === 'data') {
          callback(Buffer.from(JSON.stringify({ message: { content: 'Hello' }, done: false }) + '\n'));
          callback(Buffer.from(JSON.stringify({ message: { content: ' world' }, done: true }) + '\n'));
        }
        if (event === 'end') {
          callback();
        }
        return mockStream;
      })
    };

    axios.post.mockResolvedValue({ data: mockStream });

    const tokens = [];
    await client.streamChat(
      [{ role: 'user', content: 'Hi' }],
      (token) => tokens.push(token),
      'llama3.2'
    );

    expect(tokens).toContain('Hello');
    expect(tokens).toContain(' world');
  });

  test('should handle tool calls', async () => {
    const mockStream = {
      on: jest.fn((event, callback) => {
        if (event === 'data') {
          callback(Buffer.from(JSON.stringify({
            message: {
              content: '',
              tool_calls: [{ function: { name: 'get_time', arguments: '{}' } }]
            },
            done: true
          }) + '\n'));
        }
        if (event === 'end') {
          callback();
        }
        return mockStream;
      })
    };

    axios.post.mockResolvedValue({ data: mockStream });

    const toolCalls = [];
    await client.streamChat(
      [{ role: 'user', content: 'What time is it?' }],
      () => {},
      'llama3.2',
      [],
      (toolCall) => toolCalls.push(toolCall)
    );

    expect(toolCalls).toHaveLength(1);
    expect(toolCalls[0].function.name).toBe('get_time');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd backend && npm test -- LLMClient.test.js`
Expected: FAIL

**Step 3: Implement LLM client**

Create `backend/lib/services/LLMClient.js`:

```javascript
const axios = require('axios');

class LLMClient {
  constructor(baseURL) {
    this.baseURL = baseURL;
  }

  async streamChat(messages, onToken, model = 'llama3.2', tools = [], onToolCall = null) {
    try {
      const response = await axios.post(`${this.baseURL}/api/chat`, {
        model,
        messages,
        tools: tools.length > 0 ? tools : undefined,
        stream: true
      }, {
        responseType: 'stream',
        timeout: 60000
      });

      return new Promise((resolve, reject) => {
        let buffer = '';

        response.data.on('data', (chunk) => {
          buffer += chunk.toString();
          const lines = buffer.split('\n');
          buffer = lines.pop(); // Keep incomplete line in buffer

          lines.forEach(line => {
            if (line.trim()) {
              try {
                const data = JSON.parse(line);

                if (data.message?.content) {
                  onToken(data.message.content);
                }

                if (data.message?.tool_calls && onToolCall) {
                  data.message.tool_calls.forEach(tc => onToolCall(tc));
                }

                if (data.done) {
                  resolve();
                }
              } catch (e) {
                // Ignore parse errors for partial chunks
              }
            }
          });
        });

        response.data.on('end', () => resolve());
        response.data.on('error', (err) => reject(err));
      });
    } catch (error) {
      throw new Error(`LLM error: ${error.message}`);
    }
  }

  async analyzeImage(imageBase64, prompt, model = 'llama3.2-vision') {
    try {
      const response = await axios.post(`${this.baseURL}/api/chat`, {
        model,
        messages: [{
          role: 'user',
          content: prompt,
          images: [imageBase64]
        }],
        stream: false
      }, {
        timeout: 60000
      });

      return response.data.message.content;
    } catch (error) {
      throw new Error(`Vision error: ${error.message}`);
    }
  }

  async checkHealth() {
    try {
      const response = await axios.get(`${this.baseURL}/api/tags`, { timeout: 2000 });
      return { status: 'ok', models: response.data.models };
    } catch (error) {
      throw new Error(`LLM health check failed: ${error.message}`);
    }
  }
}

module.exports = LLMClient;
```

**Step 4: Run test to verify it passes**

Run: `cd backend && npm test -- LLMClient.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add backend/lib/services/LLMClient.js backend/tests/services/LLMClient.test.js
git commit -m "feat(backend): add LLM service client with streaming

- Stream chat responses token-by-token
- Support tool calling
- Vision analysis endpoint
- Health check

Part of full system redesign"
```

---

### Task 8: TTS Service Client with Streaming

**Files:**
- Create: `backend/lib/services/TTSClient.js`
- Test: `backend/tests/services/TTSClient.test.js`

**Step 1: Write failing test**

Create `backend/tests/services/TTSClient.test.js`:

```javascript
const TTSClient = require('../../lib/services/TTSClient');
const axios = require('axios');

jest.mock('axios');

describe('TTSClient', () => {
  let client;

  beforeEach(() => {
    client = new TTSClient('http://localhost:5053');
    jest.clearAllMocks();
  });

  test('should generate speech', async () => {
    axios.post.mockResolvedValue({
      data: { audio: 'base64audio', sampling_rate: 24000 }
    });

    const result = await client.generateSpeech('Hello world');
    expect(result.audio).toBe('base64audio');
  });

  test('should support style parameter', async () => {
    axios.post.mockResolvedValue({
      data: { audio: 'base64audio', sampling_rate: 24000 }
    });

    await client.generateSpeech('Hello', 'A warm, friendly voice');
    expect(axios.post).toHaveBeenCalledWith(
      'http://localhost:5053/api/tts',
      { text: 'Hello', style: 'A warm, friendly voice' },
      expect.any(Object)
    );
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd backend && npm test -- TTSClient.test.js`
Expected: FAIL

**Step 3: Implement TTS client**

Create `backend/lib/services/TTSClient.js`:

```javascript
const axios = require('axios');

class TTSClient {
  constructor(baseURL) {
    this.baseURL = baseURL;
  }

  async generateSpeech(text, style = null) {
    try {
      const response = await axios.post(`${this.baseURL}/api/tts`, {
        text,
        style
      }, {
        timeout: 30000
      });

      return response.data;
    } catch (error) {
      throw new Error(`TTS error: ${error.message}`);
    }
  }

  async checkHealth() {
    try {
      const response = await axios.get(`${this.baseURL}/health`, { timeout: 2000 });
      return response.data;
    } catch (error) {
      throw new Error(`TTS health check failed: ${error.message}`);
    }
  }
}

module.exports = TTSClient;
```

**Step 4: Run test to verify it passes**

Run: `cd backend && npm test -- TTSClient.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add backend/lib/services/TTSClient.js backend/tests/services/TTSClient.test.js
git commit -m "feat(backend): add TTS service client

- Generate speech from text
- Support voice style parameter
- Health check
- Error handling

Part of full system redesign"
```

---

## Phase 3: Backend Main Server

### Task 9: Rewrite Main Server with WebSocket

**Files:**
- Modify: `backend/server.js` (complete rewrite)
- Create: `backend/package.json` (update dependencies)

**Step 1: Update package.json dependencies**

Modify `backend/package.json` to add:

```json
{
  "dependencies": {
    "express": "^4.18.2",
    "ws": "^8.14.2",
    "axios": "^1.6.0",
    "multer": "^1.4.5-lts.1",
    "form-data": "^4.0.0",
    "sqlite3": "^5.1.6",
    "dotenv": "^16.3.1"
  },
  "devDependencies": {
    "jest": "^29.7.0",
    "@types/jest": "^29.5.5"
  }
}
```

**Step 2: Install dependencies**

Run: `cd backend && npm install`
Expected: All packages installed

**Step 3: Rewrite server.js**

Modify `backend/server.js`:

```javascript
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
require('dotenv').config();

const db = require('./database');
const SessionManager = require('./lib/SessionManager');
const WebSocketHandler = require('./lib/WebSocketHandler');
const VADClient = require('./lib/services/VADClient');
const STTClient = require('./lib/services/STTClient');
const LLMClient = require('./lib/services/LLMClient');
const TTSClient = require('./lib/services/TTSClient');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3001;
const STT_URL = process.env.STT_URL || 'http://100.89.2.111:5051';
const LLM_URL = process.env.LLM_URL || 'http://100.100.47.43:11434';
const TTS_URL = process.env.TTS_URL || 'http://streaming-tts:5053';
const VAD_URL = process.env.VAD_URL || 'http://vad-service:5052';

// Initialize services
const vadClient = new VADClient(VAD_URL);
const sttClient = new STTClient(STT_URL);
const llmClient = new LLMClient(LLM_URL);
const ttsClient = new TTSClient(TTS_URL);

// Middleware
app.use(cors());
app.use(express.json());

// Initialize database
db.initialize(process.env.DB_PATH || '/data/conversations.db')
  .then(() => console.log('✅ Database initialized'))
  .catch(err => console.error('❌ Database error:', err));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Service status
app.get('/api/status', async (req, res) => {
  const services = {
    stt: { url: STT_URL, status: 'unknown' },
    llm: { url: LLM_URL, status: 'unknown' },
    tts: { url: TTS_URL, status: 'unknown' },
    vad: { url: VAD_URL, status: 'unknown' }
  };

  try {
    await vadClient.checkHealth();
    services.vad.status = 'online';
  } catch (e) { services.vad.status = 'offline'; }

  try {
    await sttClient.checkHealth();
    services.stt.status = 'online';
  } catch (e) { services.stt.status = 'offline'; }

  try {
    await llmClient.checkHealth();
    services.llm.status = 'online';
  } catch (e) { services.llm.status = 'offline'; }

  try {
    await ttsClient.checkHealth();
    services.tts.status = 'online';
  } catch (e) { services.tts.status = 'offline'; }

  res.json(services);
});

// WebSocket connection handler
wss.on('connection', async (ws) => {
  console.log('🔌 New WebSocket connection');

  const sessionId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
  const session = new SessionManager(sessionId);
  const handler = new WebSocketHandler(ws, session);

  // Create database session
  try {
    await db.createSession({ userAgent: 'unknown', ip: 'unknown' });
    console.log(`📝 Session created: ${sessionId}`);
  } catch (error) {
    console.error('Failed to create session:', error);
  }

  // Send connection confirmation
  handler.sendConnected(sessionId);

  // Handle incoming messages
  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      console.log(`📨 Received: ${data.type}`);

      switch (data.type) {
        case 'start_conversation':
          await handleStartConversation(handler, session);
          break;

        case 'stop_conversation':
          await handleStopConversation(handler, session);
          break;

        case 'audio_chunk':
          await handleAudioChunk(handler, session, data.audio);
          break;

        case 'interrupt':
          await handleInterrupt(handler, session);
          break;

        case 'upload_image':
          await handleImageUpload(handler, session, data.image, data.prompt);
          break;

        case 'user_message':
          await handleTextMessage(handler, session, data.text);
          break;

        default:
          console.log('Unknown message type:', data.type);
      }
    } catch (error) {
      console.error('❌ Message handling error:', error);
      handler.sendError(error.message, session.getState());
    }
  });

  ws.on('close', () => {
    console.log('🔌 WebSocket disconnected');
  });

  ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error);
  });
});

// Handler functions (to be implemented in next tasks)
async function handleStartConversation(handler, session) {
  console.log('🎤 Starting conversation');
  session.transition('start');
  handler.sendStateChange('listening');
}

async function handleStopConversation(handler, session) {
  console.log('🛑 Stopping conversation');
  session.transition('stop');
  handler.sendStateChange('idle');
  session.reset();
}

async function handleAudioChunk(handler, session, audioBase64) {
  // Will implement VAD-based processing
  session.addAudioChunk(audioBase64);
}

async function handleInterrupt(handler, session) {
  console.log('⏸️ Interrupt requested');
  if (session.getState() === 'speaking') {
    session.setInterrupted(true);
    handler.sendStopSpeaking();
    handler.sendInterrupted('manual');
    session.transition('interrupt');
    handler.sendStateChange('listening');
  }
}

async function handleImageUpload(handler, session, imageBase64, prompt) {
  // Will implement vision analysis
  console.log('📷 Image upload received');
}

async function handleTextMessage(handler, session, text) {
  // Will implement text-based interaction
  console.log('💬 Text message:', text);
}

// Start server
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n${'='.repeat(60)}`);
  console.log('🚀 Voice Chat Backend - WebSocket Architecture');
  console.log(`${'='.repeat(60)}`);
  console.log(`\n📡 Server: http://0.0.0.0:${PORT}`);
  console.log(`🔌 WebSocket: ws://0.0.0.0:${PORT}`);
  console.log(`\n📋 Services:`);
  console.log(`   VAD: ${VAD_URL}`);
  console.log(`   STT: ${STT_URL}`);
  console.log(`   LLM: ${LLM_URL}`);
  console.log(`   TTS: ${TTS_URL}`);
  console.log(`\n${'='.repeat(60)}\n`);
});
```

**Step 4: Test server starts**

Run: `cd backend && node server.js`
Expected: Server starts without errors

**Step 5: Commit**

```bash
git add backend/server.js backend/package.json
git commit -m "feat(backend): rewrite server with WebSocket architecture

- Complete WebSocket server implementation
- Message routing for all message types
- Service client initialization
- Health check endpoints
- Placeholder handlers for core functionality

Part of full system redesign"
```

---

## Phase 4: Frontend Foundation

### Task 10: Frontend WebSocket Manager

**Files:**
- Create: `frontend/src/hooks/useWebSocket.js`
- Test: `frontend/src/hooks/useWebSocket.test.js`

**Step 1: Write failing test**

Create `frontend/src/hooks/useWebSocket.test.js`:

```javascript
import { renderHook, act } from '@testing-library/react-hooks';
import useWebSocket from './useWebSocket';

global.WebSocket = jest.fn(() => ({
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  send: jest.fn(),
  close: jest.fn()
}));

describe('useWebSocket', () => {
  test('should connect on mount', () => {
    const { result } = renderHook(() => useWebSocket('ws://localhost:3001'));
    expect(result.current.isConnected).toBe(false);
  });

  test('should send messages', () => {
    const { result } = renderHook(() => useWebSocket('ws://localhost:3001'));

    act(() => {
      result.current.sendMessage({ type: 'test', data: 'hello' });
    });
  });

  test('should handle incoming messages', () => {
    const onMessage = jest.fn();
    renderHook(() => useWebSocket('ws://localhost:3001', onMessage));
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd frontend && npm test -- useWebSocket.test.js`
Expected: FAIL

**Step 3: Implement useWebSocket hook**

Create `frontend/src/hooks/useWebSocket.js`:

```javascript
import { useState, useEffect, useRef, useCallback } from 'react';

function useWebSocket(url, onMessage) {
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttempts = useRef(0);

  const connect = useCallback(() => {
    try {
      const ws = new WebSocket(url);

      ws.addEventListener('open', () => {
        console.log('✅ WebSocket connected');
        setIsConnected(true);
        reconnectAttempts.current = 0;
      });

      ws.addEventListener('message', (event) => {
        try {
          const data = JSON.parse(event.data);
          if (onMessage) {
            onMessage(data);
          }
        } catch (e) {
          console.error('Failed to parse message:', e);
        }
      });

      ws.addEventListener('close', () => {
        console.log('❌ WebSocket disconnected');
        setIsConnected(false);

        // Auto-reconnect with exponential backoff
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
        reconnectAttempts.current++;

        reconnectTimeoutRef.current = setTimeout(() => {
          console.log(`🔄 Reconnecting (attempt ${reconnectAttempts.current})...`);
          connect();
        }, delay);
      });

      ws.addEventListener('error', (error) => {
        console.error('❌ WebSocket error:', error);
      });

      wsRef.current = ws;
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
    }
  }, [url, onMessage]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  const sendMessage = useCallback((message) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket not connected, message not sent:', message);
    }
  }, []);

  return {
    isConnected,
    sendMessage
  };
}

export default useWebSocket;
```

**Step 4: Run test to verify it passes**

Run: `cd frontend && npm test -- useWebSocket.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add frontend/src/hooks/useWebSocket.js frontend/src/hooks/useWebSocket.test.js
git commit -m "feat(frontend): add WebSocket hook

- Connect to WebSocket server
- Auto-reconnect with exponential backoff
- Send and receive messages
- Handle connection state

Part of full system redesign"
```

---

**Due to length constraints, I'll summarize the remaining tasks. The full implementation would continue with:**

## Phase 5: Frontend Components (Tasks 11-20)
- Task 11: Conversation state management (Context + Reducer)
- Task 12: Streaming message component
- Task 13: Audio recorder with continuous recording
- Task 14: Audio player with interrupt support
- Task 15: Vision uploader component
- Task 16: Function call display component
- Task 17: Phase indicator animations
- Task 18: Service status component
- Task 19: Main App integration
- Task 20: CSS styling and responsive design

## Phase 6: Backend Message Handlers (Tasks 21-25)
- Task 21: Implement audio chunk processing with VAD
- Task 22: Implement STT transcription flow
- Task 23: Implement LLM streaming with tools
- Task 24: Implement TTS audio streaming
- Task 25: Implement vision analysis handler

## Phase 7: Integration & Testing (Tasks 26-30)
- Task 26: End-to-end conversation flow test
- Task 27: Interruption testing
- Task 28: Tool calling integration test
- Task 29: Vision upload integration test
- Task 30: Performance and load testing

## Phase 8: Deployment (Tasks 31-32)
- Task 31: Update docker-compose.yml
- Task 32: Deploy and verify on vps-00

---

## Execution Summary

**Total Tasks:** 32
**Estimated Time:** 2-3 days
**Test Coverage Target:** 80%+
**Deployment Target:** vps-00 production

Each task follows TDD:
1. Write test
2. Verify failure
3. Implement
4. Verify pass
5. Commit

This ensures quality and makes progress trackable.
