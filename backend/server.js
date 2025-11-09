const express = require('express');
const cors = require('cors');
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');
require('dotenv').config();
const db = require('./database');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const PORT = process.env.PORT || 3001;

// Service URLs (can be configured via environment variables)
const STT_URL = process.env.STT_URL || 'http://100.89.2.111:5051';
const LLM_URL = process.env.LLM_URL || 'http://100.100.47.43:11434';
const TTS_URL = process.env.TTS_URL || 'http://100.89.2.111:5050';
const VAD_URL = process.env.VAD_URL || 'http://localhost:5052';

// Middleware
app.use(cors());
app.use(express.json());

// Configure multer for file uploads
const upload = multer({ dest: 'uploads/' });

// Ensure uploads directory exists
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Get service status
app.get('/api/status', async (req, res) => {
  try {
    const services = {
      stt: { url: STT_URL, status: 'unknown' },
      llm: { url: LLM_URL, status: 'unknown' },
      tts: { url: TTS_URL, status: 'unknown' }
    };

    // Check STT
    try {
      await axios.get(`${STT_URL}/health`, { timeout: 2000 });
      services.stt.status = 'online';
    } catch (error) {
      services.stt.status = 'offline';
    }

    // Check LLM
    try {
      await axios.get(`${LLM_URL}/api/tags`, { timeout: 2000 });
      services.llm.status = 'online';
    } catch (error) {
      services.llm.status = 'offline';
    }

    // Check TTS
    try {
      await axios.get(`${TTS_URL}/health`, { timeout: 2000 });
      services.tts.status = 'online';
    } catch (error) {
      services.tts.status = 'offline';
    }

    res.json(services);
  } catch (error) {
    res.status(500).json({ error: 'Failed to check services', message: error.message });
  }
});

// Vision analysis with Llama 3.2 Vision
app.post('/api/vision/analyze', upload.single('image'), async (req, res) => {
  try {
    const { prompt } = req.body;
    const imagePath = req.file.path;

    // Read image and convert to base64
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');

    // Call Ollama with vision model
    const response = await axios.post(`${LLM_URL}/api/chat`, {
      model: 'llama3.2-vision',
      messages: [
        {
          role: 'user',
          content: prompt || 'Describe what you see in this image.',
          images: [base64Image]
        }
      ],
      stream: false
    }, {
      timeout: 60000
    });

    // Clean up uploaded file
    fs.unlinkSync(imagePath);

    res.json({
      description: response.data.message.content,
      model: 'llama3.2-vision'
    });

  } catch (error) {
    console.error('Vision analysis error:', error.message);
    if (req.file && req.file.path) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({
      error: 'Failed to analyze image',
      message: error.message
    });
  }
});

// Serve static audio files from TTS service
app.get('/api/audio/:filename', async (req, res) => {
  try {
    const audioUrl = `${TTS_URL}/audio/${req.params.filename}`;
    const response = await axios.get(audioUrl, {
      responseType: 'stream',
      timeout: 10000
    });

    response.data.pipe(res);
  } catch (error) {
    console.error('Audio fetch error:', error.message);
    res.status(500).json({
      error: 'Failed to fetch audio',
      message: error.message
    });
  }
});

// Database API endpoints
app.get('/api/sessions', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    const sessions = await db.getSessions(limit, offset);
    res.json({ sessions });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/sessions/:id', async (req, res) => {
  try {
    const session = await db.getSession(req.params.id);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    res.json(session);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/sessions/:id/messages', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;
    const messages = await db.getMessages(req.params.id, limit, offset);
    res.json({ messages });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/sessions/:id/stats', async (req, res) => {
  try {
    const stats = await db.getConversationStats(req.params.id);
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/messages/search', async (req, res) => {
  try {
    const query = req.query.q || '';
    const limit = parseInt(req.query.limit) || 50;
    const messages = await db.searchMessages(query, limit);
    res.json({ messages });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Define available tools for function calling
const tools = [
  {
    type: 'function',
    function: {
      name: 'get_current_time',
      description: 'Get the current time and date',
      parameters: {
        type: 'object',
        properties: {
          timezone: {
            type: 'string',
            description: 'Timezone (e.g., America/New_York, Europe/London). Defaults to local time.'
          }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_weather',
      description: 'Get current weather information for a location (simulated)',
      parameters: {
        type: 'object',
        properties: {
          location: {
            type: 'string',
            description: 'City name or location'
          }
        },
        required: ['location']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'calculate',
      description: 'Perform mathematical calculations',
      parameters: {
        type: 'object',
        properties: {
          expression: {
            type: 'string',
            description: 'Mathematical expression to evaluate (e.g., "2 + 2", "sqrt(16)")'
          }
        },
        required: ['expression']
      }
    }
  }
];

// Execute tool calls
async function executeToolCall(toolName, args) {
  console.log(`🔧 Executing tool: ${toolName} with args:`, args);

  switch (toolName) {
    case 'get_current_time':
      const timezone = args.timezone || 'local';
      const now = new Date();
      return {
        time: now.toLocaleTimeString(),
        date: now.toLocaleDateString(),
        timezone: timezone,
        timestamp: now.toISOString()
      };

    case 'get_weather':
      // Simulated weather data
      const weathers = ['sunny', 'cloudy', 'rainy', 'partly cloudy'];
      const temps = [65, 70, 75, 80, 85];
      return {
        location: args.location,
        temperature: temps[Math.floor(Math.random() * temps.length)],
        condition: weathers[Math.floor(Math.random() * weathers.length)],
        humidity: Math.floor(Math.random() * 40) + 40,
        note: 'This is simulated weather data'
      };

    case 'calculate':
      try {
        // Simple math evaluation (be careful with eval in production!)
        const result = Function('"use strict"; return (' + args.expression + ')')();
        return {
          expression: args.expression,
          result: result
        };
      } catch (error) {
        return {
          error: 'Invalid expression',
          message: error.message
        };
      }

    default:
      return { error: 'Unknown tool' };
  }
}

// WebSocket connection handler for continuous conversation
wss.on('connection', async (ws) => {
  console.log('🔌 New conversation session started');

  // Session state
  const session = {
    id: Date.now().toString(),
    state: 'idle', // idle, listening, processing, speaking
    audioChunks: [],
    conversationHistory: [],
    isInConversation: false,
    processingTimeout: null,
    silenceTimeout: null
  };

  // Create database session
  try {
    await db.createSession(session.id, {
      userAgent: ws.upgradeReq?.headers['user-agent'] || 'unknown',
      ip: ws.upgradeReq?.socket.remoteAddress || 'unknown'
    });
    console.log(`📝 Database session created: ${session.id}`);
  } catch (error) {
    console.error('Failed to create database session:', error);
  }

  // Send initial connection message
  ws.send(JSON.stringify({
    type: 'connected',
    sessionId: session.id,
    message: 'Ready for conversation'
  }));

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      console.log(`📨 Received message type: ${data.type}`);

      switch (data.type) {
        case 'start_conversation':
          handleStartConversation(ws, session);
          break;

        case 'audio_chunk':
          handleAudioChunk(ws, session, data);
          break;

        case 'stop_conversation':
          handleStopConversation(ws, session);
          break;

        case 'user_speaking':
          console.log(`🎤 User speaking: ${data.isSpeaking}`);
          break;

        case 'silence_detected':
          console.log('🔇 Frontend detected silence');
          break;

        case 'process_speech':
          console.log('📤 Frontend requested speech processing');
          // Clear any existing timeout and process immediately
          if (session.silenceTimeout) {
            clearTimeout(session.silenceTimeout);
          }
          if (session.audioChunks.length > 0 && session.state !== 'processing') {
            console.log(`📊 Processing ${session.audioChunks.length} audio chunks`);
            processConversationTurn(ws, session);
          }
          break;

        case 'ping':
          ws.send(JSON.stringify({ type: 'pong' }));
          break;

        default:
          console.log('Unknown message type:', data.type);
      }
    } catch (error) {
      console.error('❌ WebSocket message error:', error.message);
      ws.send(JSON.stringify({ type: 'error', message: error.message }));
    }
  });

  ws.on('close', () => {
    console.log('🔌 Conversation session ended');
    clearTimeouts(session);
  });

  ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error.message);
  });
});

// Handle conversation start
function handleStartConversation(ws, session) {
  console.log('🎤 Starting continuous conversation');
  session.isInConversation = true;
  session.state = 'listening';

  ws.send(JSON.stringify({
    type: 'conversation_started',
    state: 'listening',
    message: 'Conversation started. I\'m listening...'
  }));
}

// Handle incoming audio chunks
function handleAudioChunk(ws, session, data) {
  if (!session.isInConversation) {
    ws.send(JSON.stringify({
      type: 'error',
      message: 'No active conversation. Please start a conversation first.'
    }));
    return;
  }

  // Add audio chunk to buffer
  const audioData = Buffer.from(data.data, 'base64');
  session.audioChunks.push(audioData);
  console.log(`📦 Received audio chunk: ${audioData.length} bytes, total chunks: ${session.audioChunks.length}`);

  // If we're not already processing, update state
  if (session.state === 'listening') {
    session.state = 'receiving';
    ws.send(JSON.stringify({
      type: 'state_change',
      state: 'receiving',
      message: 'Receiving audio...'
    }));
  }

  // Clear existing silence timeout
  if (session.silenceTimeout) {
    clearTimeout(session.silenceTimeout);
  }

  // Set new silence timeout - process when user stops speaking
  session.silenceTimeout = setTimeout(async () => {
    if (session.audioChunks.length > 0 && session.state !== 'processing') {
      console.log('🔇 Backend detected silence after receiving audio, processing...');
      console.log(`📊 Total audio chunks to process: ${session.audioChunks.length}`);
      await processConversationTurn(ws, session);
    }
  }, 1500); // 1.5 seconds of silence triggers processing
}

// Process a conversation turn (transcribe → LLM → TTS)
async function processConversationTurn(ws, session) {
  if (session.state === 'processing') {
    return; // Already processing
  }

  session.state = 'processing';
  const chunks = [...session.audioChunks];
  session.audioChunks = [];

  try {
    // Send processing state
    ws.send(JSON.stringify({
      type: 'state_change',
      state: 'processing',
      message: 'Processing your speech...'
    }));

    // Combine audio chunks
    const audioBuffer = Buffer.concat(chunks);
    console.log('📦 Processing audio buffer:', audioBuffer.length, 'bytes');

    if (audioBuffer.length < 1000) {
      console.log('⚠️ Audio too short, returning to listening');
      returnToListening(ws, session);
      return;
    }

    // Save to temporary file (detect format from first chunk if possible)
    // iPhone Safari might send mp4/m4a instead of webm
    const tempFilename = `conversation-${session.id}-${Date.now()}.webm`;
    const tempPath = path.join('uploads', tempFilename);
    fs.writeFileSync(tempPath, audioBuffer);
    console.log('💾 Saved audio file:', tempPath, 'size:', audioBuffer.length);

    // 1. Transcribe audio
    ws.send(JSON.stringify({
      type: 'state_change',
      state: 'transcribing',
      message: 'Transcribing...'
    }));

    const formData = new FormData();
    formData.append('file', fs.createReadStream(tempPath), {
      filename: 'audio.webm',
      contentType: 'audio/webm'
    });

    console.log('🎤 Transcribing audio...');
    const sttResponse = await axios.post(`${STT_URL}/api/transcribe`, formData, {
      headers: formData.getHeaders(),
      timeout: 30000
    });

    const userText = sttResponse.data.text;
    console.log('📝 User said:', userText);

    // Add to conversation history
    session.conversationHistory.push({ role: 'user', content: userText });

    // Log to database
    try {
      await db.addMessage(session.id, 'user', userText);
    } catch (error) {
      console.error('Failed to log user message:', error);
    }

    // Send transcription to client
    ws.send(JSON.stringify({
      type: 'transcribed',
      text: userText,
      role: 'user'
    }));

    // 2. Get LLM response
    ws.send(JSON.stringify({
      type: 'state_change',
      state: 'thinking',
      message: 'Thinking...'
    }));

    console.log('🤔 Getting AI response...');
    const messages = [
      {
        role: 'system',
        content: 'You are having a natural voice conversation. Keep responses concise and conversational. Respond as if speaking on the phone.'
      },
      ...session.conversationHistory
    ];

    // Stream LLM response with tool support
    let aiText = '';
    let toolCalls = [];

    const llmResponse = await axios.post(`${LLM_URL}/api/chat`, {
      model: process.env.LLM_MODEL || 'llama3.2',
      messages: messages,
      tools: tools,
      stream: true
    }, {
      timeout: 60000,
      responseType: 'stream'
    });

    // Process streaming response
    llmResponse.data.on('data', (chunk) => {
      const lines = chunk.toString().split('\n').filter(line => line.trim());

      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);

          // Handle text content
          if (parsed.message && parsed.message.content) {
            const token = parsed.message.content;
            aiText += token;

            // Stream token to client
            ws.send(JSON.stringify({
              type: 'llm_token',
              token: token,
              role: 'assistant'
            }));
          }

          // Handle tool calls
          if (parsed.message && parsed.message.tool_calls) {
            toolCalls = parsed.message.tool_calls;
          }
        } catch (e) {
          // Ignore parsing errors for partial chunks
        }
      }
    });

    // Wait for stream to complete
    await new Promise((resolve, reject) => {
      llmResponse.data.on('end', resolve);
      llmResponse.data.on('error', reject);
    });

    console.log('🤖 AI response:', aiText.substring(0, 100) + '...');

    // Execute tool calls if any
    if (toolCalls && toolCalls.length > 0) {
      console.log(`🔧 Processing ${toolCalls.length} tool calls`);

      for (const toolCall of toolCalls) {
        const toolName = toolCall.function.name;
        const toolArgs = typeof toolCall.function.arguments === 'string'
          ? JSON.parse(toolCall.function.arguments)
          : toolCall.function.arguments;

        // Notify client about tool execution
        ws.send(JSON.stringify({
          type: 'tool_execution',
          tool: toolName,
          args: toolArgs
        }));

        // Execute the tool
        const toolResult = await executeToolCall(toolName, toolArgs);

        // Add tool call and result to conversation history
        session.conversationHistory.push({
          role: 'assistant',
          content: aiText,
          tool_calls: [toolCall]
        });

        session.conversationHistory.push({
          role: 'tool',
          name: toolName,
          content: JSON.stringify(toolResult)
        });

        // Get AI's response after tool execution
        const followUpMessages = [
          {
            role: 'system',
            content: 'You are having a natural voice conversation. Keep responses concise and conversational. Respond as if speaking on the phone.'
          },
          ...session.conversationHistory
        ];

        let followUpText = '';

        const followUpResponse = await axios.post(`${LLM_URL}/api/chat`, {
          model: process.env.LLM_MODEL || 'llama3.2',
          messages: followUpMessages,
          stream: true
        }, {
          timeout: 60000,
          responseType: 'stream'
        });

        followUpResponse.data.on('data', (chunk) => {
          const lines = chunk.toString().split('\n').filter(line => line.trim());

          for (const line of lines) {
            try {
              const parsed = JSON.parse(line);
              if (parsed.message && parsed.message.content) {
                const token = parsed.message.content;
                followUpText += token;

                ws.send(JSON.stringify({
                  type: 'llm_token',
                  token: token,
                  role: 'assistant'
                }));
              }
            } catch (e) {
              // Ignore parsing errors
            }
          }
        });

        await new Promise((resolve, reject) => {
          followUpResponse.data.on('end', resolve);
          followUpResponse.data.on('error', reject);
        });

        aiText = followUpText;
      }
    }

    // Add final response to conversation history
    session.conversationHistory.push({ role: 'assistant', content: aiText });

    // Log AI response to database
    try {
      const messageId = await db.addMessage(session.id, 'assistant', aiText);

      // Log tool calls if any
      if (toolCalls && toolCalls.length > 0) {
        for (const toolCall of toolCalls) {
          const toolName = toolCall.function.name;
          const toolArgs = typeof toolCall.function.arguments === 'string'
            ? JSON.parse(toolCall.function.arguments)
            : toolCall.function.arguments;

          // Find the tool result from session history
          const toolResultMessage = session.conversationHistory.find(
            msg => msg.role === 'tool' && msg.name === toolName
          );

          if (toolResultMessage) {
            await db.addToolCall(
              messageId,
              toolName,
              toolArgs,
              JSON.parse(toolResultMessage.content)
            );
          }
        }
      }
    } catch (error) {
      console.error('Failed to log assistant message:', error);
    }

    // Send complete response confirmation
    ws.send(JSON.stringify({
      type: 'ai_response_complete',
      text: aiText,
      role: 'assistant'
    }));

    // 3. Generate TTS
    session.state = 'speaking';
    ws.send(JSON.stringify({
      type: 'state_change',
      state: 'speaking',
      message: 'Speaking...'
    }));

    console.log('🔊 Generating speech...');
    const ttsResponse = await axios.post(`${TTS_URL}/api/tts`, {
      text: aiText,
      language: 'en'
    }, {
      timeout: 60000
    });

    const audioFile = ttsResponse.data.audio_file || ttsResponse.data.filename;
    console.log('🎵 Audio ready:', audioFile);

    // Send audio file to client
    ws.send(JSON.stringify({
      type: 'audio_ready',
      audioFile: audioFile,
      duration: ttsResponse.data.duration || 3000
    }));

    // Clean up temp file
    fs.unlinkSync(tempPath);

    // After a delay (simulating speech duration), return to listening
    setTimeout(() => {
      if (session.isInConversation) {
        returnToListening(ws, session);
      }
    }, ttsResponse.data.duration || 3000);

  } catch (error) {
    console.error('❌ Processing error:', error.message);
    if (error.response) {
      console.error('❌ Response data:', error.response.data);
    }

    ws.send(JSON.stringify({
      type: 'error',
      message: `Processing failed: ${error.message}`
    }));

    // Return to listening state after error
    if (session.isInConversation) {
      returnToListening(ws, session);
    }
  }
}

// Return to listening state
function returnToListening(ws, session) {
  if (!session.isInConversation) {
    return;
  }

  session.state = 'listening';
  session.audioChunks = [];

  ws.send(JSON.stringify({
    type: 'state_change',
    state: 'listening',
    message: 'Listening...'
  }));

  console.log('👂 Returned to listening state');
}

// Handle conversation stop
function handleStopConversation(ws, session) {
  console.log('🛑 Stopping conversation');
  session.isInConversation = false;
  session.state = 'idle';
  session.audioChunks = [];
  session.conversationHistory = [];
  clearTimeouts(session);

  ws.send(JSON.stringify({
    type: 'conversation_stopped',
    state: 'idle',
    message: 'Conversation ended'
  }));
}

// Clear all timeouts
function clearTimeouts(session) {
  if (session.silenceTimeout) {
    clearTimeout(session.silenceTimeout);
    session.silenceTimeout = null;
  }
  if (session.processingTimeout) {
    clearTimeout(session.processingTimeout);
    session.processingTimeout = null;
  }
}

// Start server
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n${'='.repeat(60)}`);
  console.log('🚀 Voice Chat Backend - Continuous Conversation Mode');
  console.log(`${'='.repeat(60)}`);
  console.log(`\n📡 Server running on: http://0.0.0.0:${PORT}`);
  console.log(`🔌 WebSocket running on: ws://0.0.0.0:${PORT}`);
  console.log(`\n📋 Service URLs:`);
  console.log(`   STT: ${STT_URL}`);
  console.log(`   LLM: ${LLM_URL}`);
  console.log(`   TTS: ${TTS_URL}`);
  console.log(`\n${'='.repeat(60)}\n`);
});