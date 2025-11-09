const TTSClient = require('../../lib/services/TTSClient');
const SessionManager = require('../../lib/SessionManager');
const WebSocketHandler = require('../../lib/WebSocketHandler');
const { handleTTSGeneration } = require('../../lib/handlers/tts');

jest.mock('../../lib/services/TTSClient');

describe('handleTTSGeneration', () => {
  let ttsClient;
  let session;
  let wsHandler;
  let mockWs;

  beforeEach(() => {
    // Mock WebSocket
    mockWs = {
      readyState: 1, // OPEN
      send: jest.fn()
    };

    // Create real session
    session = new SessionManager('test-session-id');

    // Create handler
    wsHandler = new WebSocketHandler(mockWs, session);

    // Mock TTS client
    ttsClient = new TTSClient('http://localhost:5050');
    ttsClient.generateSpeech = jest.fn();

    jest.clearAllMocks();
  });

  describe('Successful TTS Generation', () => {
    test('should transition through speaking state and end at listening', async () => {
      const text = 'Hello, how are you?';
      const audioBase64 = 'dGVzdCBhdWRpbyBkYXRh'; // "test audio data"

      // Set session to thinking state (as it would be after LLM)
      session.transition('start');
      session.transition('silence_detected');
      session.transition('transcription_complete');
      expect(session.getState()).toBe('thinking');

      // Mock TTS response
      ttsClient.generateSpeech.mockResolvedValue({
        audio: audioBase64
      });

      await handleTTSGeneration(wsHandler, session, text, ttsClient);

      // Should complete and transition back to listening state
      expect(session.getState()).toBe('listening');

      // Should have sent speaking state change
      const stateChangeCalls = mockWs.send.mock.calls.filter(call => {
        const message = JSON.parse(call[0]);
        return message.type === 'state_change' && message.state === 'speaking';
      });
      expect(stateChangeCalls.length).toBeGreaterThan(0);
    });

    test('should call TTS service with text', async () => {
      const text = 'This is a test message';
      const audioBase64 = 'dGVzdCBhdWRpbyBkYXRh';

      session.transition('start');
      session.transition('silence_detected');
      session.transition('transcription_complete');

      ttsClient.generateSpeech.mockResolvedValue({
        audio: audioBase64
      });

      await handleTTSGeneration(wsHandler, session, text, ttsClient);

      // Should call TTS service
      expect(ttsClient.generateSpeech).toHaveBeenCalledWith(text);
    });

    test('should send audio chunk to client', async () => {
      const text = 'Test speech';
      const audioBase64 = 'dGVzdCBhdWRpbyBkYXRh';

      session.transition('start');
      session.transition('silence_detected');
      session.transition('transcription_complete');

      ttsClient.generateSpeech.mockResolvedValue({
        audio: audioBase64
      });

      await handleTTSGeneration(wsHandler, session, text, ttsClient);

      // Should send audio chunk
      const audioChunkCalls = mockWs.send.mock.calls.filter(call => {
        const message = JSON.parse(call[0]);
        return message.type === 'audio_chunk';
      });

      expect(audioChunkCalls.length).toBe(1);

      const audioMessage = JSON.parse(audioChunkCalls[0][0]);
      expect(audioMessage.audio).toBe(audioBase64);
      expect(audioMessage.chunkIndex).toBe(0);
    });

    test('should send audio_complete message after streaming', async () => {
      const text = 'Test speech';
      const audioBase64 = 'dGVzdCBhdWRpbyBkYXRh';

      session.transition('start');
      session.transition('silence_detected');
      session.transition('transcription_complete');

      ttsClient.generateSpeech.mockResolvedValue({
        audio: audioBase64
      });

      await handleTTSGeneration(wsHandler, session, text, ttsClient);

      // Should send audio_complete
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"audio_complete"')
      );
    });

    test('should transition to listening state after completion', async () => {
      const text = 'Complete message';
      const audioBase64 = 'dGVzdCBhdWRpbyBkYXRh';

      session.transition('start');
      session.transition('silence_detected');
      session.transition('transcription_complete');

      ttsClient.generateSpeech.mockResolvedValue({
        audio: audioBase64
      });

      await handleTTSGeneration(wsHandler, session, text, ttsClient);

      // Should transition back to listening state
      expect(session.getState()).toBe('listening');
    });

    test('should send state change messages', async () => {
      const text = 'State test';
      const audioBase64 = 'dGVzdCBhdWRpbyBkYXRh';

      session.transition('start');
      session.transition('silence_detected');
      session.transition('transcription_complete');

      ttsClient.generateSpeech.mockResolvedValue({
        audio: audioBase64
      });

      await handleTTSGeneration(wsHandler, session, text, ttsClient);

      // Should send state changes: thinking->speaking->listening
      const stateChangeCalls = mockWs.send.mock.calls.filter(call => {
        const message = JSON.parse(call[0]);
        return message.type === 'state_change';
      });

      expect(stateChangeCalls.length).toBeGreaterThanOrEqual(2);

      // Should have speaking state
      const speakingState = stateChangeCalls.find(call => {
        const message = JSON.parse(call[0]);
        return message.state === 'speaking';
      });
      expect(speakingState).toBeDefined();

      // Should have listening state
      const listeningState = stateChangeCalls.find(call => {
        const message = JSON.parse(call[0]);
        return message.state === 'listening';
      });
      expect(listeningState).toBeDefined();
    });
  });

  describe('Empty Text Handling', () => {
    test('should skip TTS for empty text', async () => {
      session.transition('start');
      session.transition('silence_detected');
      session.transition('transcription_complete');

      await handleTTSGeneration(wsHandler, session, '', ttsClient);

      // Should not call TTS service
      expect(ttsClient.generateSpeech).not.toHaveBeenCalled();

      // Should transition to speaking and then back to listening
      expect(session.getState()).toBe('listening');
    });

    test('should skip TTS for whitespace-only text', async () => {
      session.transition('start');
      session.transition('silence_detected');
      session.transition('transcription_complete');

      await handleTTSGeneration(wsHandler, session, '   \n\t  ', ttsClient);

      // Should not call TTS service
      expect(ttsClient.generateSpeech).not.toHaveBeenCalled();
    });

    test('should skip TTS for null text', async () => {
      session.transition('start');
      session.transition('silence_detected');
      session.transition('transcription_complete');

      await handleTTSGeneration(wsHandler, session, null, ttsClient);

      // Should not call TTS service
      expect(ttsClient.generateSpeech).not.toHaveBeenCalled();
    });
  });

  describe('Interruption Handling', () => {
    test('should check for interruption before starting TTS', async () => {
      const text = 'This will be interrupted';
      const audioBase64 = 'dGVzdCBhdWRpbyBkYXRh';

      session.transition('start');
      session.transition('silence_detected');
      session.transition('transcription_complete');

      // Set interrupted flag before TTS
      session.setInterrupted(true);

      ttsClient.generateSpeech.mockResolvedValue({
        audio: audioBase64
      });

      await handleTTSGeneration(wsHandler, session, text, ttsClient);

      // Should not call TTS if already interrupted
      expect(ttsClient.generateSpeech).not.toHaveBeenCalled();
    });

    test('should check for interruption after TTS generation', async () => {
      const text = 'Will be interrupted during playback';
      const audioBase64 = 'dGVzdCBhdWRpbyBkYXRh';

      session.transition('start');
      session.transition('silence_detected');
      session.transition('transcription_complete');

      // Simulate interruption during TTS generation
      ttsClient.generateSpeech.mockImplementation(async () => {
        session.setInterrupted(true);
        return { audio: audioBase64 };
      });

      await handleTTSGeneration(wsHandler, session, text, ttsClient);

      // Should still complete TTS call but not send audio
      expect(ttsClient.generateSpeech).toHaveBeenCalled();

      // Should not send audio chunks if interrupted
      const audioChunkCalls = mockWs.send.mock.calls.filter(call => {
        const message = JSON.parse(call[0]);
        return message.type === 'audio_chunk';
      });

      expect(audioChunkCalls.length).toBe(0);
    });

    test('should reset interrupted flag after handling', async () => {
      const text = 'Test interruption reset';

      session.transition('start');
      session.transition('silence_detected');
      session.transition('transcription_complete');
      session.setInterrupted(true);

      await handleTTSGeneration(wsHandler, session, text, ttsClient);

      // Should reset interrupted flag
      expect(session.isInterrupted()).toBe(false);
    });
  });

  describe('Error Handling', () => {
    test('should handle TTS service errors gracefully', async () => {
      const text = 'This will fail';

      session.transition('start');
      session.transition('silence_detected');
      session.transition('transcription_complete');

      ttsClient.generateSpeech.mockRejectedValue(new Error('TTS service unreachable'));

      await handleTTSGeneration(wsHandler, session, text, ttsClient);

      // Should send error message
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"error"')
      );

      // Should still transition to listening to recover
      expect(session.getState()).toBe('listening');
    });

    test('should handle TTS timeout errors', async () => {
      const text = 'This will timeout';

      session.transition('start');
      session.transition('silence_detected');
      session.transition('transcription_complete');

      ttsClient.generateSpeech.mockRejectedValue(new Error('TTS request timeout'));

      await handleTTSGeneration(wsHandler, session, text, ttsClient);

      // Should send error message
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"error"')
      );
    });

    test('should recover to listening state on error', async () => {
      const text = 'Error recovery test';

      session.transition('start');
      session.transition('silence_detected');
      session.transition('transcription_complete');

      ttsClient.generateSpeech.mockRejectedValue(new Error('TTS error'));

      await handleTTSGeneration(wsHandler, session, text, ttsClient);

      // Should recover to listening state
      expect(session.getState()).toBe('listening');
    });

    test('should handle missing audio data in response', async () => {
      const text = 'Missing audio test';

      session.transition('start');
      session.transition('silence_detected');
      session.transition('transcription_complete');

      // TTS returns empty response
      ttsClient.generateSpeech.mockResolvedValue({});

      await handleTTSGeneration(wsHandler, session, text, ttsClient);

      // Should handle gracefully
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"error"')
      );
    });
  });

  describe('Chunked Audio Streaming', () => {
    test('should handle large audio by sending single chunk', async () => {
      const text = 'Long speech content';
      const largeAudioBase64 = 'A'.repeat(10000); // Large base64 string

      session.transition('start');
      session.transition('silence_detected');
      session.transition('transcription_complete');

      ttsClient.generateSpeech.mockResolvedValue({
        audio: largeAudioBase64
      });

      await handleTTSGeneration(wsHandler, session, text, ttsClient);

      // For now, should send as single chunk
      const audioChunkCalls = mockWs.send.mock.calls.filter(call => {
        const message = JSON.parse(call[0]);
        return message.type === 'audio_chunk';
      });

      expect(audioChunkCalls.length).toBe(1);

      const audioMessage = JSON.parse(audioChunkCalls[0][0]);
      expect(audioMessage.audio).toBe(largeAudioBase64);
    });

    test('should send proper chunk index', async () => {
      const text = 'Chunk index test';
      const audioBase64 = 'dGVzdCBhdWRpbyBkYXRh';

      session.transition('start');
      session.transition('silence_detected');
      session.transition('transcription_complete');

      ttsClient.generateSpeech.mockResolvedValue({
        audio: audioBase64
      });

      await handleTTSGeneration(wsHandler, session, text, ttsClient);

      const audioChunkCalls = mockWs.send.mock.calls.filter(call => {
        const message = JSON.parse(call[0]);
        return message.type === 'audio_chunk';
      });

      const audioMessage = JSON.parse(audioChunkCalls[0][0]);
      expect(audioMessage.chunkIndex).toBe(0);
    });
  });

  describe('State Machine Validation', () => {
    test('should handle invalid state transitions gracefully', async () => {
      const text = 'Invalid state test';

      // Don't transition to proper state
      expect(session.getState()).toBe('idle');

      // Should handle invalid transition by catching the error
      await handleTTSGeneration(wsHandler, session, text, ttsClient);

      // Should send error message
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"error"')
      );
    });

    test('should work from thinking state', async () => {
      const text = 'From thinking state';
      const audioBase64 = 'dGVzdCBhdWRpbyBkYXRh';

      // Transition to thinking state
      session.transition('start');
      session.transition('silence_detected');
      session.transition('transcription_complete');
      expect(session.getState()).toBe('thinking');

      ttsClient.generateSpeech.mockResolvedValue({
        audio: audioBase64
      });

      await handleTTSGeneration(wsHandler, session, text, ttsClient);

      // Should successfully process
      expect(ttsClient.generateSpeech).toHaveBeenCalled();
      expect(session.getState()).toBe('listening');
    });
  });

  describe('Logging and Debugging', () => {
    test('should log TTS generation start', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const text = 'Log test';
      const audioBase64 = 'dGVzdCBhdWRpbyBkYXRh';

      session.transition('start');
      session.transition('silence_detected');
      session.transition('transcription_complete');

      ttsClient.generateSpeech.mockResolvedValue({
        audio: audioBase64
      });

      await handleTTSGeneration(wsHandler, session, text, ttsClient);

      // Should log generation start
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('TTS generation')
      );

      consoleSpy.mockRestore();
    });

    test('should log errors', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const text = 'Error log test';

      session.transition('start');
      session.transition('silence_detected');
      session.transition('transcription_complete');

      ttsClient.generateSpeech.mockRejectedValue(new Error('TTS failed'));

      await handleTTSGeneration(wsHandler, session, text, ttsClient);

      // Should log error
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });
  });
});
