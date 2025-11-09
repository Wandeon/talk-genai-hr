/**
 * End-to-End Conversation Flow Integration Tests
 *
 * Tests the complete conversation flows from WebSocket message to final response:
 * - Voice conversation flow: audio_chunk → VAD → STT → LLM → TTS → audio_complete
 * - Text message flow: text_message → LLM → TTS → audio_complete
 * - Image upload flow: upload_image → vision analysis → response
 *
 * These tests mock external services but test real integration between:
 * - WebSocket message handling
 * - Session management
 * - State machine transitions
 * - Handler orchestration
 * - Conversation history management
 */

const SessionManager = require('../../lib/SessionManager');
const WebSocketHandler = require('../../lib/WebSocketHandler');
const VADClient = require('../../lib/services/VADClient');
const STTClient = require('../../lib/services/STTClient');
const LLMClient = require('../../lib/services/LLMClient');
const TTSClient = require('../../lib/services/TTSClient');

// Import handlers
const { handleAudioChunk, cleanupSession } = require('../../lib/handlers/audioChunk');
const { handleTranscription } = require('../../lib/handlers/transcription');
const { handleTextMessage } = require('../../lib/handlers/textMessage');
const { handleImageUpload } = require('../../lib/handlers/imageUpload');

// Mock all service clients
jest.mock('../../lib/services/VADClient');
jest.mock('../../lib/services/STTClient');
jest.mock('../../lib/services/LLMClient');
jest.mock('../../lib/services/TTSClient');

describe('End-to-End Conversation Flow Integration Tests', () => {
  let vadClient;
  let sttClient;
  let llmClient;
  let ttsClient;
  let session;
  let wsHandler;
  let mockWs;
  let sentMessages;

  beforeEach(() => {
    // Mock WebSocket that captures all sent messages
    sentMessages = [];
    mockWs = {
      readyState: 1, // OPEN
      send: jest.fn((message) => {
        sentMessages.push(JSON.parse(message));
      })
    };

    // Create real session
    session = new SessionManager('test-session-id');

    // Create WebSocket handler
    wsHandler = new WebSocketHandler(mockWs, session);

    // Mock VAD client
    vadClient = new VADClient('http://localhost:5052');
    vadClient.detectSpeech = jest.fn();

    // Mock STT client
    sttClient = new STTClient('http://localhost:5051');
    sttClient.transcribe = jest.fn();

    // Mock LLM client
    llmClient = new LLMClient('http://localhost:11434');
    llmClient.streamChat = jest.fn();
    llmClient.analyzeImage = jest.fn();

    // Mock TTS client
    ttsClient = new TTSClient('http://localhost:5050');
    ttsClient.generateSpeech = jest.fn();

    jest.clearAllMocks();
  });

  afterEach(() => {
    // Clean up session-specific data
    cleanupSession(session.id);
  });

  /**
   * Helper to get messages by type from sent messages
   */
  function getMessagesByType(type) {
    return sentMessages.filter(msg => msg.type === type);
  }

  /**
   * Helper to get the latest message of a specific type
   */
  function getLatestMessage(type) {
    const messages = getMessagesByType(type);
    return messages[messages.length - 1];
  }

  describe('Complete Voice Conversation Flow', () => {
    test('should complete full voice flow: audio → VAD → STT → LLM → TTS → return to listening', async () => {
      // Setup mocks
      const speechAudio = 'c3BlZWNoZGF0YQ=='; // base64 encoded "speechdata"
      const silenceAudio = 'c2lsZW5jZQ=='; // base64 encoded "silence"
      const transcript = 'Hello, how are you?';
      const llmResponse = 'I am doing well, thank you for asking!';
      const audioResponse = 'YXVkaW9yZXNwb25zZQ=='; // base64 encoded "audioresponse"

      vadClient.detectSpeech.mockResolvedValue({
        is_speech: true,
        probability: 0.95,
        threshold: 0.5
      });

      sttClient.transcribe.mockResolvedValue({
        text: transcript,
        language: 'en'
      });

      llmClient.streamChat.mockImplementation(async (messages, onToken) => {
        // Simulate streaming response
        for (const char of llmResponse) {
          onToken(char);
        }
      });

      ttsClient.generateSpeech.mockResolvedValue({
        audio: audioResponse
      });

      // Step 1: Send speech audio chunks
      await handleAudioChunk(wsHandler, session, speechAudio, vadClient, sttClient, 3);
      await handleAudioChunk(wsHandler, session, speechAudio, vadClient, sttClient, 3);

      // Verify state: should be listening and accumulating audio
      expect(session.getState()).toBe('listening');
      expect(session.audioChunks.length).toBe(2);

      // Step 2: Send silence to trigger transcription
      vadClient.detectSpeech.mockResolvedValue({
        is_speech: false,
        probability: 0.1,
        threshold: 0.5
      });

      // Need 3 consecutive silence frames (default threshold)
      await handleAudioChunk(wsHandler, session, silenceAudio, vadClient, sttClient, 3);
      await handleAudioChunk(wsHandler, session, silenceAudio, vadClient, sttClient, 3);

      // Final silence should trigger transcription
      await handleAudioChunk(
        wsHandler,
        session,
        silenceAudio,
        vadClient,
        sttClient,
        3,
        llmClient,
        async (transcriptText) => {
          // Step 3: Transcription complete, trigger LLM
          await handleTranscription(wsHandler, session, transcriptText, llmClient, ttsClient);
        }
      );

      // Verify complete flow

      // 1. Should have transitioned through states
      const stateChanges = getMessagesByType('state_change');
      expect(stateChanges.length).toBeGreaterThan(0);

      // Check for key states in the flow
      const states = stateChanges.map(msg => msg.state);
      expect(states).toContain('listening');
      expect(states).toContain('transcribing');
      expect(states).toContain('thinking');
      expect(states).toContain('speaking');

      // Final state should be listening
      expect(session.getState()).toBe('listening');

      // 2. Should have sent transcript
      const transcripts = getMessagesByType('transcript_final');
      expect(transcripts.length).toBe(1);
      expect(transcripts[0].text).toBe(transcript);

      // 3. Should have streamed LLM tokens
      const llmTokens = getMessagesByType('llm_token');
      expect(llmTokens.length).toBeGreaterThan(0);

      // Verify LLM complete message
      const llmComplete = getMessagesByType('llm_complete');
      expect(llmComplete.length).toBe(1);
      expect(llmComplete[0].fullText).toBe(llmResponse);

      // 4. Should have sent audio chunks
      const audioChunks = getMessagesByType('audio_chunk');
      expect(audioChunks.length).toBe(1);
      expect(audioChunks[0].audio).toBe(audioResponse);

      // 5. Should have sent audio complete
      const audioComplete = getMessagesByType('audio_complete');
      expect(audioComplete.length).toBe(1);

      // 6. Conversation history should be updated
      expect(session.conversationHistory.length).toBe(2);
      expect(session.conversationHistory[0].role).toBe('user');
      expect(session.conversationHistory[0].content).toBe(transcript);
      expect(session.conversationHistory[1].role).toBe('assistant');
      expect(session.conversationHistory[1].content).toBe(llmResponse);

      // 7. Audio chunks should be cleared
      expect(session.audioChunks.length).toBe(0);
    });

    test('should handle multiple voice turns in conversation', async () => {
      const speechAudio = 'c3BlZWNo';
      const silenceAudio = 'c2lsZW5jZQ==';

      vadClient.detectSpeech.mockImplementation(async (audio) => {
        return audio === speechAudio
          ? { is_speech: true, probability: 0.95, threshold: 0.5 }
          : { is_speech: false, probability: 0.1, threshold: 0.5 };
      });

      sttClient.transcribe
        .mockResolvedValueOnce({ text: 'First question', language: 'en' })
        .mockResolvedValueOnce({ text: 'Second question', language: 'en' });

      llmClient.streamChat
        .mockImplementationOnce(async (messages, onToken) => {
          onToken('First answer');
        })
        .mockImplementationOnce(async (messages, onToken) => {
          onToken('Second answer');
        });

      ttsClient.generateSpeech
        .mockResolvedValueOnce({ audio: 'YXVkaW8x' })
        .mockResolvedValueOnce({ audio: 'YXVkaW8y' });

      // First turn
      await handleAudioChunk(wsHandler, session, speechAudio, vadClient, sttClient, 2);

      vadClient.detectSpeech.mockResolvedValue({ is_speech: false, probability: 0.1, threshold: 0.5 });

      await handleAudioChunk(wsHandler, session, silenceAudio, vadClient, sttClient, 2);
      await handleAudioChunk(
        wsHandler,
        session,
        silenceAudio,
        vadClient,
        sttClient,
        2,
        llmClient,
        async (text) => {
          await handleTranscription(wsHandler, session, text, llmClient, ttsClient);
        }
      );

      // Should be back to listening
      expect(session.getState()).toBe('listening');
      expect(session.conversationHistory.length).toBe(2);

      // Second turn
      sentMessages = []; // Clear messages

      vadClient.detectSpeech.mockResolvedValue({ is_speech: true, probability: 0.95, threshold: 0.5 });

      await handleAudioChunk(wsHandler, session, speechAudio, vadClient, sttClient, 2);

      vadClient.detectSpeech.mockResolvedValue({ is_speech: false, probability: 0.1, threshold: 0.5 });

      await handleAudioChunk(wsHandler, session, silenceAudio, vadClient, sttClient, 2);
      await handleAudioChunk(
        wsHandler,
        session,
        silenceAudio,
        vadClient,
        sttClient,
        2,
        llmClient,
        async (text) => {
          await handleTranscription(wsHandler, session, text, llmClient, ttsClient);
        }
      );

      // Should be back to listening again
      expect(session.getState()).toBe('listening');
      expect(session.conversationHistory.length).toBe(4);

      // Verify conversation history includes context
      const callArgs = llmClient.streamChat.mock.calls[1];
      const messages = callArgs[0];
      expect(messages.length).toBe(3); // First Q, First A, Second Q
    });
  });

  describe('Complete Text Message Flow', () => {
    test('should complete full text flow: text_message → LLM → TTS → return to listening', async () => {
      const messageText = 'What is the weather like?';
      const llmResponse = 'Let me check the weather for you.';
      const audioResponse = 'YXVkaW9kYXRh';

      llmClient.streamChat.mockImplementation(async (messages, onToken) => {
        for (const char of llmResponse) {
          onToken(char);
        }
      });

      ttsClient.generateSpeech.mockResolvedValue({
        audio: audioResponse
      });

      // Start from idle state
      expect(session.getState()).toBe('idle');

      // Send text message
      await handleTextMessage(wsHandler, session, messageText, llmClient, ttsClient);

      // Verify complete flow

      // 1. Should have transitioned through states
      const stateChanges = getMessagesByType('state_change');
      const states = stateChanges.map(msg => msg.state);

      expect(states).toContain('listening'); // idle → listening
      expect(states).toContain('thinking');  // listening → thinking
      expect(states).toContain('speaking');  // thinking → speaking

      // Final state should be listening
      expect(session.getState()).toBe('listening');

      // 2. Should have streamed LLM tokens
      const llmTokens = getMessagesByType('llm_token');
      expect(llmTokens.length).toBeGreaterThan(0);

      // 3. Should have LLM complete
      const llmComplete = getMessagesByType('llm_complete');
      expect(llmComplete[0].fullText).toBe(llmResponse);

      // 4. Should have sent audio
      const audioChunks = getMessagesByType('audio_chunk');
      expect(audioChunks.length).toBe(1);
      expect(audioChunks[0].audio).toBe(audioResponse);

      // 5. Should have audio complete
      const audioComplete = getMessagesByType('audio_complete');
      expect(audioComplete.length).toBe(1);

      // 6. Conversation history should be updated
      expect(session.conversationHistory.length).toBe(2);
      expect(session.conversationHistory[0].role).toBe('user');
      expect(session.conversationHistory[0].content).toBe(messageText);
      expect(session.conversationHistory[1].role).toBe('assistant');
      expect(session.conversationHistory[1].content).toBe(llmResponse);
    });

    test('should work from listening state', async () => {
      const messageText = 'Tell me a joke';
      const llmResponse = 'Why did the chicken cross the road?';

      llmClient.streamChat.mockImplementation(async (messages, onToken) => {
        onToken(llmResponse);
      });

      ttsClient.generateSpeech.mockResolvedValue({
        audio: 'am9rZWF1ZGlv'
      });

      // Start conversation first
      session.transition('start');
      expect(session.getState()).toBe('listening');

      // Send text message
      await handleTextMessage(wsHandler, session, messageText, llmClient, ttsClient);

      // Should complete successfully
      expect(session.getState()).toBe('listening');
      expect(session.conversationHistory.length).toBe(2);
    });

    test('should handle text message without TTS client', async () => {
      const messageText = 'No audio response needed';
      const llmResponse = 'Text only response';

      llmClient.streamChat.mockImplementation(async (messages, onToken) => {
        onToken(llmResponse);
      });

      // Call without TTS client
      await handleTextMessage(wsHandler, session, messageText, llmClient, null);

      // Should have LLM response
      const llmComplete = getMessagesByType('llm_complete');
      expect(llmComplete[0].fullText).toBe(llmResponse);

      // Should NOT have audio chunks
      const audioChunks = getMessagesByType('audio_chunk');
      expect(audioChunks.length).toBe(0);

      // Should transition to speaking state
      expect(session.getState()).toBe('speaking');
    });
  });

  describe('Complete Image Upload Flow', () => {
    test('should complete full image flow: upload_image → vision analysis → return to listening', async () => {
      const imageBase64 = 'aW1hZ2VkYXRh'; // "imagedata" in base64
      const filename = 'test-image.jpg';
      const mimeType = 'image/jpeg';
      const visionResult = 'This image shows a beautiful sunset over the ocean.';

      llmClient.analyzeImage.mockResolvedValue(visionResult);

      // Start from idle state
      expect(session.getState()).toBe('idle');

      // Upload image
      await handleImageUpload(wsHandler, session, llmClient, imageBase64, filename, mimeType);

      // Verify complete flow

      // 1. Should have transitioned through states
      const stateChanges = getMessagesByType('state_change');
      const states = stateChanges.map(msg => msg.state);

      expect(states).toContain('listening');        // idle → listening
      expect(states).toContain('analyzing_image');  // listening → analyzing_image

      // Final state should be listening
      expect(session.getState()).toBe('listening');

      // 2. Should have sent vision result
      const visionResults = getMessagesByType('vision_result');
      expect(visionResults.length).toBe(1);
      expect(visionResults[0].description).toBe(visionResult);

      // 3. Conversation history should be updated
      expect(session.conversationHistory.length).toBe(2);
      expect(session.conversationHistory[0].role).toBe('user');
      expect(session.conversationHistory[0].content).toContain(filename);
      expect(session.conversationHistory[1].role).toBe('assistant');
      expect(session.conversationHistory[1].content).toBe(visionResult);

      // 4. Should have called analyzeImage with correct parameters
      expect(llmClient.analyzeImage).toHaveBeenCalledWith(
        imageBase64,
        expect.any(String),
        expect.any(String)
      );
    });

    test('should work from listening state', async () => {
      const imageBase64 = 'aW1hZ2U=';
      const filename = 'photo.png';
      const mimeType = 'image/png';
      const visionResult = 'A cat sitting on a couch.';

      llmClient.analyzeImage.mockResolvedValue(visionResult);

      // Start conversation first
      session.transition('start');
      expect(session.getState()).toBe('listening');

      // Upload image
      await handleImageUpload(wsHandler, session, llmClient, imageBase64, filename, mimeType);

      // Should complete successfully
      expect(session.getState()).toBe('listening');
      expect(session.conversationHistory.length).toBe(2);
    });

    test('should integrate with conversation context', async () => {
      // Add some conversation history
      session.addMessage('user', 'I want to show you something');
      session.addMessage('assistant', 'Sure, I would love to see it!');

      const imageBase64 = 'aW1hZ2U=';
      const filename = 'my-photo.jpg';
      const mimeType = 'image/jpeg';
      const visionResult = 'I can see your photo.';

      llmClient.analyzeImage.mockResolvedValue(visionResult);

      await handleImageUpload(wsHandler, session, llmClient, imageBase64, filename, mimeType);

      // Should have all messages in history
      expect(session.conversationHistory.length).toBe(4);

      // Verify order
      expect(session.conversationHistory[0].content).toBe('I want to show you something');
      expect(session.conversationHistory[1].content).toBe('Sure, I would love to see it!');
      expect(session.conversationHistory[2].content).toContain(filename);
      expect(session.conversationHistory[3].content).toBe(visionResult);
    });
  });

  describe('State Transitions Across Flows', () => {
    test('should maintain valid state transitions throughout voice flow', async () => {
      const speechAudio = 'c3BlZWNo';
      const silenceAudio = 'c2lsZW5jZQ==';

      vadClient.detectSpeech.mockImplementation(async (audio) => {
        return audio === speechAudio
          ? { is_speech: true, probability: 0.95, threshold: 0.5 }
          : { is_speech: false, probability: 0.1, threshold: 0.5 };
      });

      sttClient.transcribe.mockResolvedValue({ text: 'Test', language: 'en' });
      llmClient.streamChat.mockImplementation(async (messages, onToken) => {
        onToken('Response');
      });
      ttsClient.generateSpeech.mockResolvedValue({ audio: 'YXVkaW8=' });

      // Track all states
      const states = [];
      states.push(session.getState()); // idle

      // Send speech
      await handleAudioChunk(wsHandler, session, speechAudio, vadClient, sttClient, 2);
      states.push(session.getState()); // listening

      // Send silence to trigger transcription and full flow
      await handleAudioChunk(wsHandler, session, silenceAudio, vadClient, sttClient, 2);
      await handleAudioChunk(
        wsHandler,
        session,
        silenceAudio,
        vadClient,
        sttClient,
        2,
        llmClient,
        async (text) => {
          states.push(session.getState()); // transcribing
          await handleTranscription(wsHandler, session, text, llmClient, ttsClient);
        }
      );

      states.push(session.getState()); // listening (final)

      // Verify state sequence
      expect(states).toEqual(['idle', 'listening', 'transcribing', 'listening']);

      // No errors should have been sent
      const errors = getMessagesByType('error');
      expect(errors.length).toBe(0);
    });

    test('should maintain valid state transitions throughout text flow', async () => {
      llmClient.streamChat.mockImplementation(async (messages, onToken) => {
        onToken('Response');
      });
      ttsClient.generateSpeech.mockResolvedValue({ audio: 'YXVkaW8=' });

      const states = [];
      states.push(session.getState()); // idle

      await handleTextMessage(wsHandler, session, 'Test message', llmClient, ttsClient);

      states.push(session.getState()); // listening (final)

      // Verify transitions occurred (idle → listening → thinking → speaking → listening)
      expect(states[0]).toBe('idle');
      expect(states[states.length - 1]).toBe('listening');

      // Check state changes in messages
      const stateChanges = getMessagesByType('state_change');
      const messageStates = stateChanges.map(msg => msg.state);

      expect(messageStates).toContain('listening');
      expect(messageStates).toContain('thinking');
      expect(messageStates).toContain('speaking');
    });

    test('should maintain valid state transitions throughout image flow', async () => {
      llmClient.analyzeImage.mockResolvedValue('Image description');

      const states = [];
      states.push(session.getState()); // idle

      await handleImageUpload(wsHandler, session, llmClient, 'aW1hZ2U=', 'test.jpg', 'image/jpeg');

      states.push(session.getState()); // listening (final)

      // Verify transitions
      expect(states[0]).toBe('idle');
      expect(states[states.length - 1]).toBe('listening');

      // Check for analyzing_image state
      const stateChanges = getMessagesByType('state_change');
      const messageStates = stateChanges.map(msg => msg.state);
      expect(messageStates).toContain('analyzing_image');
      expect(messageStates).toContain('listening');
    });
  });

  describe('Conversation History Management', () => {
    test('should maintain conversation history across different flow types', async () => {
      // Setup mocks
      const speechAudio = 'c3BlZWNo';
      const silenceAudio = 'c2lsZW5jZQ==';

      vadClient.detectSpeech.mockImplementation(async (audio) => {
        return audio === speechAudio
          ? { is_speech: true, probability: 0.95, threshold: 0.5 }
          : { is_speech: false, probability: 0.1, threshold: 0.5 };
      });

      sttClient.transcribe.mockResolvedValue({ text: 'Voice question', language: 'en' });
      llmClient.streamChat.mockImplementation(async (messages, onToken) => {
        onToken('Voice response');
      });
      llmClient.analyzeImage.mockResolvedValue('Image description');
      ttsClient.generateSpeech.mockResolvedValue({ audio: 'YXVkaW8=' });

      // 1. Voice turn
      await handleAudioChunk(wsHandler, session, speechAudio, vadClient, sttClient, 2);
      await handleAudioChunk(wsHandler, session, silenceAudio, vadClient, sttClient, 2);
      await handleAudioChunk(
        wsHandler,
        session,
        silenceAudio,
        vadClient,
        sttClient,
        2,
        llmClient,
        async (text) => {
          await handleTranscription(wsHandler, session, text, llmClient, ttsClient);
        }
      );

      expect(session.conversationHistory.length).toBe(2);

      // 2. Text turn
      llmClient.streamChat.mockImplementation(async (messages, onToken) => {
        onToken('Text response');
      });

      await handleTextMessage(wsHandler, session, 'Text question', llmClient, ttsClient);

      expect(session.conversationHistory.length).toBe(4);

      // 3. Image turn
      await handleImageUpload(wsHandler, session, llmClient, 'aW1hZ2U=', 'pic.jpg', 'image/jpeg');

      expect(session.conversationHistory.length).toBe(6);

      // Verify history order and content
      expect(session.conversationHistory[0].content).toBe('Voice question');
      expect(session.conversationHistory[1].content).toBe('Voice response');
      expect(session.conversationHistory[2].content).toBe('Text question');
      expect(session.conversationHistory[3].content).toBe('Text response');
      expect(session.conversationHistory[4].content).toContain('pic.jpg');
      expect(session.conversationHistory[5].content).toBe('Image description');
    });

    test('should pass full conversation context to LLM', async () => {
      // Build up conversation history
      session.addMessage('user', 'First message');
      session.addMessage('assistant', 'First response');
      session.addMessage('user', 'Second message');
      session.addMessage('assistant', 'Second response');

      llmClient.streamChat.mockImplementation(async (messages, onToken) => {
        onToken('Third response');
      });

      ttsClient.generateSpeech.mockResolvedValue({ audio: 'YXVkaW8=' });

      // Send new text message
      await handleTextMessage(wsHandler, session, 'Third message', llmClient, ttsClient);

      // Verify LLM received full context
      const callArgs = llmClient.streamChat.mock.calls[0];
      const messages = callArgs[0];

      expect(messages.length).toBe(5); // 4 previous + 1 new
      expect(messages[0].content).toBe('First message');
      expect(messages[1].content).toBe('First response');
      expect(messages[2].content).toBe('Second message');
      expect(messages[3].content).toBe('Second response');
      expect(messages[4].content).toBe('Third message');
    });
  });

  describe('Error Recovery', () => {
    test('should recover from VAD service failure', async () => {
      vadClient.detectSpeech.mockRejectedValue(new Error('VAD service unreachable'));

      await handleAudioChunk(wsHandler, session, 'c3BlZWNo', vadClient, sttClient, 3);

      // Should send error
      const errors = getMessagesByType('error');
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].message).toContain('Voice activity detection failed');

      // Should still be in valid state
      expect(['idle', 'listening']).toContain(session.getState());
    });

    test('should recover from STT service failure', async () => {
      const speechAudio = 'c3BlZWNo';
      const silenceAudio = 'c2lsZW5jZQ==';

      vadClient.detectSpeech.mockResolvedValue({
        is_speech: true,
        probability: 0.95,
        threshold: 0.5
      });

      // Accumulate speech
      await handleAudioChunk(wsHandler, session, speechAudio, vadClient, sttClient, 2);

      // Trigger transcription with STT error
      vadClient.detectSpeech.mockResolvedValue({
        is_speech: false,
        probability: 0.1,
        threshold: 0.5
      });

      sttClient.transcribe.mockRejectedValue(new Error('STT service unreachable'));

      await handleAudioChunk(wsHandler, session, silenceAudio, vadClient, sttClient, 2);
      await handleAudioChunk(wsHandler, session, silenceAudio, vadClient, sttClient, 2);

      // Should send error
      const errors = getMessagesByType('error');
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].message).toContain('Transcription failed');

      // Should clear audio chunks even on error
      expect(session.audioChunks.length).toBe(0);
    });

    test('should recover from LLM service failure', async () => {
      llmClient.streamChat.mockRejectedValue(new Error('LLM service unreachable'));

      await handleTextMessage(wsHandler, session, 'Test message', llmClient, ttsClient);

      // Should send error
      const errors = getMessagesByType('error');
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].message).toContain('LLM processing failed');

      // User message should still be in history
      expect(session.conversationHistory.length).toBeGreaterThan(0);
    });

    test('should recover from TTS service failure', async () => {
      llmClient.streamChat.mockImplementation(async (messages, onToken) => {
        onToken('LLM response');
      });

      ttsClient.generateSpeech.mockRejectedValue(new Error('TTS service unreachable'));

      await handleTextMessage(wsHandler, session, 'Test message', llmClient, ttsClient);

      // Should send error
      const errors = getMessagesByType('error');
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].message).toContain('TTS generation failed');

      // Should have completed LLM processing
      const llmComplete = getMessagesByType('llm_complete');
      expect(llmComplete.length).toBe(1);

      // Should recover to listening state
      expect(session.getState()).toBe('listening');

      // Conversation history should still be updated
      expect(session.conversationHistory.length).toBe(2);
    });

    test('should recover from vision service failure', async () => {
      llmClient.analyzeImage.mockRejectedValue(new Error('Vision service unreachable'));

      await handleImageUpload(wsHandler, session, llmClient, 'aW1hZ2U=', 'test.jpg', 'image/jpeg');

      // Should send error
      const errors = getMessagesByType('error');
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].message).toContain('Image upload processing failed');

      // Should recover to listening state
      expect(session.getState()).toBe('listening');
    });
  });

  describe('Session Management', () => {
    test('should properly clean up session on completion', () => {
      const sessionId = session.id;

      // Simulate some activity
      session.addMessage('user', 'Test');
      session.addMessage('assistant', 'Response');

      // Clean up
      cleanupSession(sessionId);

      // Session data should be cleaned up
      // (In this case, silence counters are cleared)
      // Future sessions with same ID won't have stale data
    });

    test('should maintain session state across multiple interactions', async () => {
      llmClient.streamChat.mockImplementation(async (messages, onToken) => {
        onToken('Response');
      });

      ttsClient.generateSpeech.mockResolvedValue({ audio: 'YXVkaW8=' });

      // Multiple interactions
      await handleTextMessage(wsHandler, session, 'First', llmClient, ttsClient);
      await handleTextMessage(wsHandler, session, 'Second', llmClient, ttsClient);
      await handleTextMessage(wsHandler, session, 'Third', llmClient, ttsClient);

      // Session should maintain all history
      expect(session.conversationHistory.length).toBe(6); // 3 user + 3 assistant

      // Session metadata should be accurate
      const metadata = session.getMetadata();
      expect(metadata.id).toBe(session.id);
      expect(metadata.messageCount).toBe(6);
      expect(metadata.state).toBe('listening');
    });

    test('should handle WebSocket messages with proper error handling', () => {
      // Simulate closed WebSocket
      mockWs.readyState = 3; // CLOSED

      // Try to send message
      wsHandler.sendStateChange('listening');

      // Should not throw error
      // Message just won't be sent
      expect(() => {
        wsHandler.sendStateChange('listening');
      }).not.toThrow();
    });
  });

  describe('Mixed Flow Scenarios', () => {
    test('should handle alternating voice and text messages', async () => {
      const speechAudio = 'c3BlZWNo';
      const silenceAudio = 'c2lsZW5jZQ==';

      vadClient.detectSpeech.mockImplementation(async (audio) => {
        return audio === speechAudio
          ? { is_speech: true, probability: 0.95, threshold: 0.5 }
          : { is_speech: false, probability: 0.1, threshold: 0.5 };
      });

      sttClient.transcribe.mockResolvedValue({ text: 'Voice input', language: 'en' });

      llmClient.streamChat
        .mockImplementationOnce(async (messages, onToken) => {
          onToken('Voice response');
        })
        .mockImplementationOnce(async (messages, onToken) => {
          onToken('Text response');
        });

      ttsClient.generateSpeech.mockResolvedValue({ audio: 'YXVkaW8=' });

      // Voice input
      await handleAudioChunk(wsHandler, session, speechAudio, vadClient, sttClient, 2);
      await handleAudioChunk(wsHandler, session, silenceAudio, vadClient, sttClient, 2);
      await handleAudioChunk(
        wsHandler,
        session,
        silenceAudio,
        vadClient,
        sttClient,
        2,
        llmClient,
        async (text) => {
          await handleTranscription(wsHandler, session, text, llmClient, ttsClient);
        }
      );

      expect(session.conversationHistory.length).toBe(2);
      expect(session.getState()).toBe('listening');

      // Text input
      await handleTextMessage(wsHandler, session, 'Text input', llmClient, ttsClient);

      expect(session.conversationHistory.length).toBe(4);
      expect(session.getState()).toBe('listening');

      // Verify both interactions in history
      expect(session.conversationHistory[0].content).toBe('Voice input');
      expect(session.conversationHistory[1].content).toBe('Voice response');
      expect(session.conversationHistory[2].content).toBe('Text input');
      expect(session.conversationHistory[3].content).toBe('Text response');
    });

    test('should handle image upload in middle of conversation', async () => {
      // Start with some conversation
      session.addMessage('user', 'Hello');
      session.addMessage('assistant', 'Hi there!');

      llmClient.analyzeImage.mockResolvedValue('I see a cat');

      // Upload image
      await handleImageUpload(wsHandler, session, llmClient, 'aW1hZ2U=', 'cat.jpg', 'image/jpeg');

      // Continue conversation
      llmClient.streamChat.mockImplementation(async (messages, onToken) => {
        onToken('Yes, cats are great!');
      });

      ttsClient.generateSpeech.mockResolvedValue({ audio: 'YXVkaW8=' });

      await handleTextMessage(wsHandler, session, 'Tell me about cats', llmClient, ttsClient);

      // Verify full conversation flow
      expect(session.conversationHistory.length).toBe(6);
      expect(session.conversationHistory[2].content).toContain('cat.jpg');
      expect(session.conversationHistory[3].content).toBe('I see a cat');
      expect(session.conversationHistory[4].content).toBe('Tell me about cats');
      expect(session.conversationHistory[5].content).toBe('Yes, cats are great!');
    });
  });

  describe('WebSocket Message Verification', () => {
    test('should send all required message types in voice flow', async () => {
      const speechAudio = 'c3BlZWNo';
      const silenceAudio = 'c2lsZW5jZQ==';

      vadClient.detectSpeech.mockImplementation(async (audio) => {
        return audio === speechAudio
          ? { is_speech: true, probability: 0.95, threshold: 0.5 }
          : { is_speech: false, probability: 0.1, threshold: 0.5 };
      });

      sttClient.transcribe.mockResolvedValue({ text: 'Test', language: 'en' });
      llmClient.streamChat.mockImplementation(async (messages, onToken) => {
        onToken('Response');
      });
      ttsClient.generateSpeech.mockResolvedValue({ audio: 'YXVkaW8=' });

      // Complete flow
      await handleAudioChunk(wsHandler, session, speechAudio, vadClient, sttClient, 2);
      await handleAudioChunk(wsHandler, session, silenceAudio, vadClient, sttClient, 2);
      await handleAudioChunk(
        wsHandler,
        session,
        silenceAudio,
        vadClient,
        sttClient,
        2,
        llmClient,
        async (text) => {
          await handleTranscription(wsHandler, session, text, llmClient, ttsClient);
        }
      );

      // Verify all message types were sent
      const messageTypes = new Set(sentMessages.map(msg => msg.type));

      expect(messageTypes.has('state_change')).toBe(true);
      expect(messageTypes.has('transcript_final')).toBe(true);
      expect(messageTypes.has('llm_token')).toBe(true);
      expect(messageTypes.has('llm_complete')).toBe(true);
      expect(messageTypes.has('audio_chunk')).toBe(true);
      expect(messageTypes.has('audio_complete')).toBe(true);
    });

    test('should send proper message format for each type', async () => {
      llmClient.streamChat.mockImplementation(async (messages, onToken) => {
        onToken('Test');
      });

      ttsClient.generateSpeech.mockResolvedValue({ audio: 'YXVkaW8=' });

      await handleTextMessage(wsHandler, session, 'Test', llmClient, ttsClient);

      // Verify message formats
      const stateChange = getLatestMessage('state_change');
      expect(stateChange).toHaveProperty('type');
      expect(stateChange).toHaveProperty('state');

      const llmToken = getLatestMessage('llm_token');
      expect(llmToken).toHaveProperty('type');
      expect(llmToken).toHaveProperty('token');
      expect(llmToken).toHaveProperty('done');

      const llmComplete = getLatestMessage('llm_complete');
      expect(llmComplete).toHaveProperty('type');
      expect(llmComplete).toHaveProperty('fullText');

      const audioChunk = getLatestMessage('audio_chunk');
      expect(audioChunk).toHaveProperty('type');
      expect(audioChunk).toHaveProperty('audio');
      expect(audioChunk).toHaveProperty('chunkIndex');

      const audioComplete = getLatestMessage('audio_complete');
      expect(audioComplete).toHaveProperty('type');
    });
  });
});
