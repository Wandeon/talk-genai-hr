/**
 * Voice Chat Backend - WebSocket Server
 *
 * Main server entry point that orchestrates WebSocket connections,
 * service clients, session management, and message routing.
 */

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const crypto = require('crypto');
require('dotenv').config();

// Import service clients
const VADClient = require('./lib/services/VADClient');
const STTClient = require('./lib/services/STTClient');
const LLMClient = require('./lib/services/LLMClient');
const TTSClient = require('./lib/services/TTSClient');

// Import core components
const SessionManager = require('./lib/SessionManager');
const WebSocketHandler = require('./lib/WebSocketHandler');
const database = require('./database');

// Import handlers
const { handleAudioChunk: handleAudioChunkWithVAD, cleanupSession } = require('./lib/handlers/audioChunk');
const { handleTranscription } = require('./lib/handlers/transcription');
const { handleTextMessage } = require('./lib/handlers/textMessage');

// Configuration
const PORT = process.env.PORT || 3001;
const VAD_URL = process.env.VAD_URL || 'http://localhost:5052';
const STT_URL = process.env.STT_URL || 'http://100.89.2.111:5051';
const LLM_URL = process.env.LLM_URL || 'http://100.100.47.43:11434';
const TTS_URL = process.env.TTS_URL || 'http://100.89.2.111:5050';

// Initialize service clients
const vadClient = new VADClient(VAD_URL);
const sttClient = new STTClient(STT_URL);
const llmClient = new LLMClient(LLM_URL);
const ttsClient = new TTSClient(TTS_URL);

// Set up Express and HTTP server
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Middleware
app.use(express.json());

// Initialize database
database.initialize('./conversations.db')
  .then(() => {
    console.log('Database initialized successfully');
  })
  .catch((error) => {
    console.error('Failed to initialize database:', error);
    process.exit(1);
  });

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

// Service status endpoint
app.get('/api/status', async (req, res) => {
  const services = {
    vad: { url: VAD_URL, status: 'unknown' },
    stt: { url: STT_URL, status: 'unknown' },
    llm: { url: LLM_URL, status: 'unknown' },
    tts: { url: TTS_URL, status: 'unknown' }
  };

  // Check VAD
  try {
    await vadClient.checkHealth();
    services.vad.status = 'online';
  } catch (error) {
    services.vad.status = 'offline';
  }

  // Check STT
  try {
    await sttClient.checkHealth();
    services.stt.status = 'online';
  } catch (error) {
    services.stt.status = 'offline';
  }

  // Check LLM
  try {
    await llmClient.checkHealth();
    services.llm.status = 'online';
  } catch (error) {
    services.llm.status = 'offline';
  }

  // Check TTS
  try {
    await ttsClient.checkHealth();
    services.tts.status = 'online';
  } catch (error) {
    services.tts.status = 'offline';
  }

  res.json(services);
});

// WebSocket connection handler
wss.on('connection', async (ws, req) => {
  // Generate secure session ID
  const sessionId = crypto.randomUUID();

  // Create SessionManager
  const session = new SessionManager(sessionId);

  // Create WebSocketHandler
  const wsHandler = new WebSocketHandler(ws, session);

  console.log(`[Session ${sessionId}] New WebSocket connection established`);

  // Create database session
  try {
    await database.createSession({
      userAgent: req.headers['user-agent'] || 'unknown',
      ip: req.socket.remoteAddress || 'unknown'
    });
    console.log(`[Session ${sessionId}] Database session created`);
  } catch (error) {
    console.error(`[Session ${sessionId}] Failed to create database session:`, error);
  }

  // Send connection confirmation
  wsHandler.sendConnected(sessionId);

  // Message handler
  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      console.log(`[Session ${sessionId}] Received message type: ${data.type}`);

      // Route message by type
      switch (data.type) {
        case 'start_conversation':
          await handleStartConversation(session, wsHandler, data);
          break;

        case 'stop_conversation':
          await handleStopConversation(session, wsHandler, data);
          break;

        case 'audio_chunk':
          await handleAudioChunk(session, wsHandler, data);
          break;

        case 'interrupt':
          await handleInterrupt(session, wsHandler, data);
          break;

        case 'upload_image':
          await handleUploadImage(session, wsHandler, data);
          break;

        case 'user_message':
          await handleUserMessage(session, wsHandler, data);
          break;

        default:
          console.log(`[Session ${sessionId}] Unknown message type: ${data.type}`);
      }
    } catch (error) {
      console.error(`[Session ${sessionId}] Message handling error:`, error);
      wsHandler.sendError(error.message);
    }
  });

  // Close handler
  ws.on('close', () => {
    console.log(`[Session ${sessionId}] WebSocket connection closed`);
    // Clean up session-specific data
    cleanupSession(sessionId);
  });

  // Error handler
  ws.on('error', (error) => {
    console.error(`[Session ${sessionId}] WebSocket error:`, error);
  });
});

// Placeholder handler functions (stubs for now)

async function handleStartConversation(session, wsHandler, data) {
  console.log(`[Session ${session.id}] Starting conversation (stub)`);

  // Transition state
  session.transition('start');
  wsHandler.sendStateChange(session.getState());

  // TODO: Implement actual conversation start logic
}

async function handleStopConversation(session, wsHandler, data) {
  console.log(`[Session ${session.id}] Stopping conversation (stub)`);

  // Transition state
  session.transition('stop');
  wsHandler.sendStateChange(session.getState());

  // TODO: Implement actual conversation stop logic
}

async function handleAudioChunk(session, wsHandler, data) {
  // Use the new VAD-based audio chunk handler with transcription callback
  await handleAudioChunkWithVAD(
    wsHandler,
    session,
    data.audio,
    vadClient,
    sttClient,
    3, // Default silence threshold
    llmClient,
    // Callback to trigger LLM after transcription
    async (transcriptText) => {
      await handleTranscription(wsHandler, session, transcriptText, llmClient, ttsClient);
    }
  );
}

async function handleInterrupt(session, wsHandler, data) {
  console.log(`[Session ${session.id}] Interrupt received (stub)`);

  // Set interrupted flag
  session.setInterrupted(true);
  wsHandler.sendInterrupted(data.reason || 'User interrupted');

  // TODO: Implement interrupt logic (stop TTS, clear buffers, etc.)
}

async function handleUploadImage(session, wsHandler, data) {
  console.log(`[Session ${session.id}] Image upload received (stub)`);

  // TODO: Implement image upload and vision analysis
  // Should use llmClient.analyzeImage()
}

async function handleUserMessage(session, wsHandler, data) {
  console.log(`[Session ${session.id}] User message received: ${data.text}`);

  // Use the new text message handler
  await handleTextMessage(wsHandler, session, data.text, llmClient, ttsClient);
}

// Start server
server.listen(PORT, '0.0.0.0', () => {
  console.log('\n' + '='.repeat(60));
  console.log('Voice Chat Backend - WebSocket Server');
  console.log('='.repeat(60));
  console.log(`\nServer running on: http://0.0.0.0:${PORT}`);
  console.log(`WebSocket endpoint: ws://0.0.0.0:${PORT}`);
  console.log('\nService URLs:');
  console.log(`  VAD: ${VAD_URL}`);
  console.log(`  STT: ${STT_URL}`);
  console.log(`  LLM: ${LLM_URL}`);
  console.log(`  TTS: ${TTS_URL}`);
  console.log('\n' + '='.repeat(60) + '\n');
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down gracefully...');

  // Close WebSocket server
  wss.close(() => {
    console.log('WebSocket server closed');
  });

  // Close database
  await database.close();
  console.log('Database closed');

  // Close HTTP server
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});
