const WebSocketHandler = require('../lib/WebSocketHandler');
const SessionManager = require('../lib/SessionManager');

describe('WebSocketHandler', () => {
  let mockWs;
  let session;
  let handler;

  beforeEach(() => {
    // Mock WebSocket
    mockWs = {
      readyState: 1, // OPEN
      send: jest.fn()
    };

    session = new SessionManager('test-session-123');
    handler = new WebSocketHandler(mockWs, session);
  });

  describe('Initialization', () => {
    test('should initialize with websocket and session', () => {
      expect(handler.ws).toBe(mockWs);
      expect(handler.session).toBe(session);
    });

    test('should store session ID', () => {
      expect(handler.sessionId).toBe('test-session-123');
    });
  });

  describe('sendStateChange()', () => {
    test('should send state change message', () => {
      handler.sendStateChange('processing_speech');

      expect(mockWs.send).toHaveBeenCalledTimes(1);
      const message = JSON.parse(mockWs.send.mock.calls[0][0]);
      expect(message).toEqual({
        type: 'state_change',
        state: 'processing_speech'
      });
    });

    test('should not send if WebSocket is not open', () => {
      mockWs.readyState = 0; // CONNECTING
      handler.sendStateChange('processing_speech');
      expect(mockWs.send).not.toHaveBeenCalled();
    });
  });

  describe('sendError()', () => {
    test('should send error message with phase', () => {
      handler.sendError('Something went wrong', 'speech');

      expect(mockWs.send).toHaveBeenCalledTimes(1);
      const message = JSON.parse(mockWs.send.mock.calls[0][0]);
      expect(message).toEqual({
        type: 'error',
        message: 'Something went wrong',
        phase: 'speech'
      });
    });

    test('should send error message without phase', () => {
      handler.sendError('Generic error');

      expect(mockWs.send).toHaveBeenCalledTimes(1);
      const message = JSON.parse(mockWs.send.mock.calls[0][0]);
      expect(message).toEqual({
        type: 'error',
        message: 'Generic error'
      });
    });
  });

  describe('sendTranscriptPartial()', () => {
    test('should send partial transcript message', () => {
      handler.sendTranscriptPartial('Hello');

      expect(mockWs.send).toHaveBeenCalledTimes(1);
      const message = JSON.parse(mockWs.send.mock.calls[0][0]);
      expect(message).toEqual({
        type: 'transcript_partial',
        text: 'Hello'
      });
    });
  });

  describe('sendTranscriptFinal()', () => {
    test('should send final transcript message', () => {
      handler.sendTranscriptFinal('Hello world');

      expect(mockWs.send).toHaveBeenCalledTimes(1);
      const message = JSON.parse(mockWs.send.mock.calls[0][0]);
      expect(message).toEqual({
        type: 'transcript_final',
        text: 'Hello world'
      });
    });
  });

  describe('sendLLMToken()', () => {
    test('should send LLM token message', () => {
      handler.sendLLMToken('Hello', false);

      expect(mockWs.send).toHaveBeenCalledTimes(1);
      const message = JSON.parse(mockWs.send.mock.calls[0][0]);
      expect(message).toEqual({
        type: 'llm_token',
        token: 'Hello',
        done: false
      });
    });

    test('should send LLM token with done flag', () => {
      handler.sendLLMToken('!', true);

      expect(mockWs.send).toHaveBeenCalledTimes(1);
      const message = JSON.parse(mockWs.send.mock.calls[0][0]);
      expect(message).toEqual({
        type: 'llm_token',
        token: '!',
        done: true
      });
    });
  });

  describe('sendLLMComplete()', () => {
    test('should send LLM complete message', () => {
      handler.sendLLMComplete('Hello world!');

      expect(mockWs.send).toHaveBeenCalledTimes(1);
      const message = JSON.parse(mockWs.send.mock.calls[0][0]);
      expect(message).toEqual({
        type: 'llm_complete',
        fullText: 'Hello world!'
      });
    });
  });

  describe('sendAudioChunk()', () => {
    test('should send audio chunk message', () => {
      handler.sendAudioChunk('base64audio', 0);

      expect(mockWs.send).toHaveBeenCalledTimes(1);
      const message = JSON.parse(mockWs.send.mock.calls[0][0]);
      expect(message).toEqual({
        type: 'audio_chunk',
        audio: 'base64audio',
        chunkIndex: 0
      });
    });

    test('should send audio chunk with different index', () => {
      handler.sendAudioChunk('base64audio', 5);

      expect(mockWs.send).toHaveBeenCalledTimes(1);
      const message = JSON.parse(mockWs.send.mock.calls[0][0]);
      expect(message.chunkIndex).toBe(5);
    });
  });

  describe('sendAudioComplete()', () => {
    test('should send audio complete message', () => {
      handler.sendAudioComplete();

      expect(mockWs.send).toHaveBeenCalledTimes(1);
      const message = JSON.parse(mockWs.send.mock.calls[0][0]);
      expect(message).toEqual({
        type: 'audio_complete'
      });
    });
  });

  describe('sendToolCallStart()', () => {
    test('should send tool call start message', () => {
      const args = { query: 'test' };
      handler.sendToolCallStart('search', args);

      expect(mockWs.send).toHaveBeenCalledTimes(1);
      const message = JSON.parse(mockWs.send.mock.calls[0][0]);
      expect(message).toEqual({
        type: 'tool_call_start',
        toolName: 'search',
        args: { query: 'test' }
      });
    });
  });

  describe('sendToolCallResult()', () => {
    test('should send tool call result message', () => {
      const result = { data: 'result' };
      handler.sendToolCallResult('search', result);

      expect(mockWs.send).toHaveBeenCalledTimes(1);
      const message = JSON.parse(mockWs.send.mock.calls[0][0]);
      expect(message).toEqual({
        type: 'tool_call_result',
        toolName: 'search',
        result: { data: 'result' }
      });
    });
  });

  describe('sendVisionResult()', () => {
    test('should send vision result message', () => {
      handler.sendVisionResult('A cat sitting on a table');

      expect(mockWs.send).toHaveBeenCalledTimes(1);
      const message = JSON.parse(mockWs.send.mock.calls[0][0]);
      expect(message).toEqual({
        type: 'vision_result',
        description: 'A cat sitting on a table'
      });
    });
  });

  describe('sendInterrupted()', () => {
    test('should send interrupted message', () => {
      handler.sendInterrupted('user_spoke');

      expect(mockWs.send).toHaveBeenCalledTimes(1);
      const message = JSON.parse(mockWs.send.mock.calls[0][0]);
      expect(message).toEqual({
        type: 'interrupted',
        reason: 'user_spoke'
      });
    });
  });

  describe('sendStopSpeaking()', () => {
    test('should send stop speaking message', () => {
      handler.sendStopSpeaking();

      expect(mockWs.send).toHaveBeenCalledTimes(1);
      const message = JSON.parse(mockWs.send.mock.calls[0][0]);
      expect(message).toEqual({
        type: 'stop_speaking'
      });
    });
  });

  describe('sendConnected()', () => {
    test('should send connected message with session ID', () => {
      handler.sendConnected('session-abc-123');

      expect(mockWs.send).toHaveBeenCalledTimes(1);
      const message = JSON.parse(mockWs.send.mock.calls[0][0]);
      expect(message).toEqual({
        type: 'connected',
        sessionId: 'session-abc-123'
      });
    });
  });

  describe('WebSocket state handling', () => {
    test('should not send when WebSocket is CONNECTING (0)', () => {
      mockWs.readyState = 0;
      handler.sendStateChange('idle');
      expect(mockWs.send).not.toHaveBeenCalled();
    });

    test('should not send when WebSocket is CLOSING (2)', () => {
      mockWs.readyState = 2;
      handler.sendStateChange('idle');
      expect(mockWs.send).not.toHaveBeenCalled();
    });

    test('should not send when WebSocket is CLOSED (3)', () => {
      mockWs.readyState = 3;
      handler.sendStateChange('idle');
      expect(mockWs.send).not.toHaveBeenCalled();
    });

    test('should send when WebSocket is OPEN (1)', () => {
      mockWs.readyState = 1;
      handler.sendStateChange('idle');
      expect(mockWs.send).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error handling', () => {
    let consoleErrorSpy;

    beforeEach(() => {
      consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleErrorSpy.mockRestore();
    });

    test('should handle JSON.stringify errors gracefully', () => {
      // Create a circular reference object that will cause JSON.stringify to throw
      const circularObj = { type: 'test' };
      circularObj.self = circularObj;

      // This should not throw, but should log the error
      expect(() => {
        handler.send(circularObj);
      }).not.toThrow();

      // Verify error was logged
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Session test-session-123] Failed to send message:'),
        expect.any(String)
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith('Message type:', 'test');
    });

    test('should handle ws.send() errors gracefully', () => {
      // Mock ws.send to throw an error
      mockWs.send.mockImplementation(() => {
        throw new Error('Network error');
      });

      // This should not throw, but should log the error
      expect(() => {
        handler.sendStateChange('idle');
      }).not.toThrow();

      // Verify error was logged
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Session test-session-123] Failed to send message:'),
        'Network error'
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith('Message type:', 'state_change');
    });

    test('should continue processing after send error', () => {
      // Make first call fail
      mockWs.send.mockImplementationOnce(() => {
        throw new Error('Temporary error');
      });

      // First call should log error but not throw
      handler.sendStateChange('idle');
      expect(consoleErrorSpy).toHaveBeenCalled();

      // Reset spy
      consoleErrorSpy.mockClear();

      // Second call should work normally
      handler.sendStateChange('processing_speech');
      expect(mockWs.send).toHaveBeenCalledTimes(2);
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });
});
