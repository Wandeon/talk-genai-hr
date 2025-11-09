const LLMClient = require('../../lib/services/LLMClient');
const SessionManager = require('../../lib/SessionManager');
const WebSocketHandler = require('../../lib/WebSocketHandler');
const { handleImageUpload } = require('../../lib/handlers/imageUpload');

jest.mock('../../lib/services/LLMClient');

describe('handleImageUpload', () => {
  let llmClient;
  let session;
  let wsHandler;
  let mockWs;

  // Sample test data
  const validImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const validFilename = 'test-image.png';
  const validMimeType = 'image/png';

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

    // Mock LLM client
    llmClient = new LLMClient('http://localhost:11434');
    llmClient.analyzeImage = jest.fn();

    jest.clearAllMocks();
  });

  describe('Successful Image Upload Flow', () => {
    test('should validate image data before processing', async () => {
      const analysisResult = 'This image shows a red square.';
      llmClient.analyzeImage.mockResolvedValue(analysisResult);

      await handleImageUpload(wsHandler, session, llmClient, validImageBase64, validFilename, validMimeType);

      // Should call analyzeImage
      expect(llmClient.analyzeImage).toHaveBeenCalled();
    });

    test('should transition to analyzing_image state', async () => {
      const analysisResult = 'This is a test image.';
      llmClient.analyzeImage.mockResolvedValue(analysisResult);

      // Start from listening state
      session.transition('start');
      expect(session.getState()).toBe('listening');

      await handleImageUpload(wsHandler, session, llmClient, validImageBase64, validFilename, validMimeType);

      // During processing, should send state_change to analyzing_image
      const stateChangeCalls = mockWs.send.mock.calls.filter(call => {
        const message = JSON.parse(call[0]);
        return message.type === 'state_change';
      });

      expect(stateChangeCalls.length).toBeGreaterThan(0);

      // First state change should be to analyzing_image
      const firstStateChange = JSON.parse(stateChangeCalls[0][0]);
      expect(firstStateChange.state).toBe('analyzing_image');
    });

    test('should send state_change message to client', async () => {
      const analysisResult = 'Image contains a cat.';
      llmClient.analyzeImage.mockResolvedValue(analysisResult);

      session.transition('start');

      await handleImageUpload(wsHandler, session, llmClient, validImageBase64, validFilename, validMimeType);

      // Should send state change messages
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"state_change"')
      );
    });

    test('should call llmClient.analyzeImage with correct parameters', async () => {
      const analysisResult = 'Description of the uploaded image.';
      llmClient.analyzeImage.mockResolvedValue(analysisResult);

      session.transition('start');

      await handleImageUpload(wsHandler, session, llmClient, validImageBase64, validFilename, validMimeType);

      // Should call analyzeImage with correct parameters
      expect(llmClient.analyzeImage).toHaveBeenCalledWith(
        validImageBase64,
        expect.stringContaining('describe'),
        expect.any(String) // model name
      );
    });

    test('should add analysis result as assistant message to conversation history', async () => {
      const analysisResult = 'This image shows a beautiful sunset.';
      llmClient.analyzeImage.mockResolvedValue(analysisResult);

      session.transition('start');

      await handleImageUpload(wsHandler, session, llmClient, validImageBase64, validFilename, validMimeType);

      // Should add assistant message to history
      const assistantMessage = session.conversationHistory.find(msg => msg.role === 'assistant');
      expect(assistantMessage).toBeDefined();
      expect(assistantMessage.content).toContain(analysisResult);
    });

    test('should send analysis result to client', async () => {
      const analysisResult = 'This is a diagram showing data flow.';
      llmClient.analyzeImage.mockResolvedValue(analysisResult);

      session.transition('start');

      await handleImageUpload(wsHandler, session, llmClient, validImageBase64, validFilename, validMimeType);

      // Should send vision_result message
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"vision_result"')
      );

      // Check that the result was sent
      const visionResultCalls = mockWs.send.mock.calls.filter(call => {
        const message = JSON.parse(call[0]);
        return message.type === 'vision_result';
      });

      expect(visionResultCalls.length).toBe(1);
      const visionMessage = JSON.parse(visionResultCalls[0][0]);
      expect(visionMessage.description).toBe(analysisResult);
    });

    test('should transition back to listening when complete', async () => {
      const analysisResult = 'Image analysis complete.';
      llmClient.analyzeImage.mockResolvedValue(analysisResult);

      session.transition('start');
      expect(session.getState()).toBe('listening');

      await handleImageUpload(wsHandler, session, llmClient, validImageBase64, validFilename, validMimeType);

      // Should return to listening state
      expect(session.getState()).toBe('listening');
    });

    test('should work from idle state', async () => {
      const analysisResult = 'Image shows a chart.';
      llmClient.analyzeImage.mockResolvedValue(analysisResult);

      // Start from idle
      expect(session.getState()).toBe('idle');

      await handleImageUpload(wsHandler, session, llmClient, validImageBase64, validFilename, validMimeType);

      // Should complete successfully
      expect(llmClient.analyzeImage).toHaveBeenCalled();
      expect(session.getState()).toBe('listening');
    });
  });

  describe('Validation Failures', () => {
    test('should reject missing imageBase64', async () => {
      session.transition('start');

      await handleImageUpload(wsHandler, session, llmClient, null, validFilename, validMimeType);

      // Should not call analyzeImage
      expect(llmClient.analyzeImage).not.toHaveBeenCalled();

      // Should send error message
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"error"')
      );
    });

    test('should reject empty imageBase64', async () => {
      session.transition('start');

      await handleImageUpload(wsHandler, session, llmClient, '', validFilename, validMimeType);

      // Should not call analyzeImage
      expect(llmClient.analyzeImage).not.toHaveBeenCalled();

      // Should send error message
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"error"')
      );
    });

    test('should reject missing filename', async () => {
      session.transition('start');

      await handleImageUpload(wsHandler, session, llmClient, validImageBase64, null, validMimeType);

      // Should not call analyzeImage
      expect(llmClient.analyzeImage).not.toHaveBeenCalled();

      // Should send error message
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"error"')
      );
    });

    test('should reject missing mimeType', async () => {
      session.transition('start');

      await handleImageUpload(wsHandler, session, llmClient, validImageBase64, validFilename, null);

      // Should not call analyzeImage
      expect(llmClient.analyzeImage).not.toHaveBeenCalled();

      // Should send error message
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"error"')
      );
    });

    test('should reject invalid imageBase64 type', async () => {
      session.transition('start');

      await handleImageUpload(wsHandler, session, llmClient, 12345, validFilename, validMimeType);

      // Should not call analyzeImage
      expect(llmClient.analyzeImage).not.toHaveBeenCalled();

      // Should send error message
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"error"')
      );
    });

    test('should reject invalid filename type', async () => {
      session.transition('start');

      await handleImageUpload(wsHandler, session, llmClient, validImageBase64, {}, validMimeType);

      // Should not call analyzeImage
      expect(llmClient.analyzeImage).not.toHaveBeenCalled();

      // Should send error message
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"error"')
      );
    });

    test('should reject invalid mimeType type', async () => {
      session.transition('start');

      await handleImageUpload(wsHandler, session, llmClient, validImageBase64, validFilename, 123);

      // Should not call analyzeImage
      expect(llmClient.analyzeImage).not.toHaveBeenCalled();

      // Should send error message
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"error"')
      );
    });
  });

  describe('LLM Service Errors', () => {
    test('should handle analyzeImage errors gracefully', async () => {
      llmClient.analyzeImage.mockRejectedValue(new Error('Vision model not available'));

      session.transition('start');

      await handleImageUpload(wsHandler, session, llmClient, validImageBase64, validFilename, validMimeType);

      // Should send error message
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"error"')
      );
    });

    test('should transition back to listening after error', async () => {
      llmClient.analyzeImage.mockRejectedValue(new Error('LLM service unreachable'));

      session.transition('start');
      expect(session.getState()).toBe('listening');

      await handleImageUpload(wsHandler, session, llmClient, validImageBase64, validFilename, validMimeType);

      // Should recover to listening state
      expect(session.getState()).toBe('listening');
    });

    test('should handle network timeout errors', async () => {
      llmClient.analyzeImage.mockRejectedValue(new Error('Request timeout'));

      session.transition('start');

      await handleImageUpload(wsHandler, session, llmClient, validImageBase64, validFilename, validMimeType);

      // Should send error message
      const errorCalls = mockWs.send.mock.calls.filter(call => {
        const message = JSON.parse(call[0]);
        return message.type === 'error';
      });

      expect(errorCalls.length).toBeGreaterThan(0);
      const errorMessage = JSON.parse(errorCalls[0][0]);
      expect(errorMessage.message).toContain('timeout');
    });
  });

  describe('State Transitions', () => {
    test('should properly transition through all states', async () => {
      const analysisResult = 'Complete analysis.';
      llmClient.analyzeImage.mockResolvedValue(analysisResult);

      session.transition('start');
      const initialState = session.getState();

      await handleImageUpload(wsHandler, session, llmClient, validImageBase64, validFilename, validMimeType);

      // Check state change messages
      const stateChangeCalls = mockWs.send.mock.calls.filter(call => {
        const message = JSON.parse(call[0]);
        return message.type === 'state_change';
      });

      // Should have at least 2 state changes: to analyzing_image and back to listening
      expect(stateChangeCalls.length).toBeGreaterThanOrEqual(2);

      const states = stateChangeCalls.map(call => JSON.parse(call[0]).state);
      expect(states).toContain('analyzing_image');
      expect(states[states.length - 1]).toBe('listening');
    });
  });

  describe('Conversation History', () => {
    test('should add user context about uploaded image', async () => {
      const analysisResult = 'Image shows architecture diagram.';
      llmClient.analyzeImage.mockResolvedValue(analysisResult);

      session.transition('start');

      await handleImageUpload(wsHandler, session, llmClient, validImageBase64, validFilename, validMimeType);

      // Should add user message about uploading image
      const userMessage = session.conversationHistory.find(msg => msg.role === 'user');
      expect(userMessage).toBeDefined();
      expect(userMessage.content).toContain('image');
    });

    test('should preserve existing conversation history', async () => {
      const analysisResult = 'New image analysis.';
      llmClient.analyzeImage.mockResolvedValue(analysisResult);

      // Add some previous messages
      session.addMessage('user', 'Previous question');
      session.addMessage('assistant', 'Previous answer');

      const previousCount = session.conversationHistory.length;

      session.transition('start');

      await handleImageUpload(wsHandler, session, llmClient, validImageBase64, validFilename, validMimeType);

      // Should have added new messages without removing old ones
      expect(session.conversationHistory.length).toBeGreaterThan(previousCount);

      // Previous messages should still be there
      expect(session.conversationHistory[0].content).toBe('Previous question');
      expect(session.conversationHistory[1].content).toBe('Previous answer');
    });
  });

  describe('Integration with Image Filename', () => {
    test('should include filename in user message', async () => {
      const analysisResult = 'Chart analysis.';
      llmClient.analyzeImage.mockResolvedValue(analysisResult);

      session.transition('start');

      await handleImageUpload(wsHandler, session, llmClient, validImageBase64, 'chart.png', validMimeType);

      // Should mention filename in user message
      const userMessage = session.conversationHistory.find(msg => msg.role === 'user');
      expect(userMessage.content).toContain('chart.png');
    });

    test('should handle different image formats', async () => {
      const analysisResult = 'JPEG image.';
      llmClient.analyzeImage.mockResolvedValue(analysisResult);

      session.transition('start');

      await handleImageUpload(wsHandler, session, llmClient, validImageBase64, 'photo.jpg', 'image/jpeg');

      // Should process successfully
      expect(llmClient.analyzeImage).toHaveBeenCalled();
    });
  });
});
