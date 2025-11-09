/**
 * Vision Upload Integration Tests
 *
 * Tests the complete vision/image upload and analysis flow:
 * - Image upload → vision analysis → response
 * - Multiple image uploads in sequence
 * - Image upload with conversation context
 * - Different image formats (PNG, JPEG, etc.)
 * - Large images (base64 size validation)
 * - Image upload error handling
 * - Vision analysis errors
 * - State transitions during vision analysis
 * - WebSocket messages during vision flow
 * - Conversation history with image context
 * - Vision results integrated into conversation
 * - Combining vision analysis with follow-up questions
 *
 * These tests mock external services but test real integration between:
 * - WebSocket message handling
 * - Session management
 * - State machine transitions (analyzing_image state)
 * - Vision handler orchestration
 * - Conversation history management
 */

const SessionManager = require('../../lib/SessionManager');
const WebSocketHandler = require('../../lib/WebSocketHandler');
const LLMClient = require('../../lib/services/LLMClient');
const TTSClient = require('../../lib/services/TTSClient');

// Import handlers
const { handleImageUpload } = require('../../lib/handlers/imageUpload');
const { handleTextMessage } = require('../../lib/handlers/textMessage');

// Mock service clients
jest.mock('../../lib/services/LLMClient');
jest.mock('../../lib/services/TTSClient');

describe('Vision Upload Integration Tests', () => {
  let llmClient;
  let ttsClient;
  let session;
  let wsHandler;
  let mockWs;
  let sentMessages;

  // Sample base64-encoded image data (tiny 1x1 pixel images for testing)
  const sampleImages = {
    png: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    jpeg: '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/AA8A/9k=',
    gif: 'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
    webp: 'UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAwA0JaQAA3AA/vuUAAA='
  };

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
    session = new SessionManager('test-vision-session');

    // Create WebSocket handler
    wsHandler = new WebSocketHandler(mockWs, session);

    // Mock LLM client
    llmClient = new LLMClient('http://localhost:11434');
    llmClient.analyzeImage = jest.fn();
    llmClient.streamChat = jest.fn();

    // Mock TTS client
    ttsClient = new TTSClient('http://localhost:5050');
    ttsClient.generateSpeech = jest.fn();

    jest.clearAllMocks();
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

  describe('Single Image Upload Flow', () => {
    test('should complete full image upload flow from idle state', async () => {
      const imageBase64 = sampleImages.jpeg;
      const filename = 'sunset.jpg';
      const mimeType = 'image/jpeg';
      const visionResult = 'This image shows a beautiful sunset over the ocean with vibrant orange and pink hues in the sky.';

      llmClient.analyzeImage.mockResolvedValue(visionResult);

      // Verify starting state
      expect(session.getState()).toBe('idle');

      // Upload image
      await handleImageUpload(wsHandler, session, llmClient, imageBase64, filename, mimeType);

      // Verify complete flow

      // 1. Should have transitioned through states: idle → listening → analyzing_image → listening
      const stateChanges = getMessagesByType('state_change');
      expect(stateChanges.length).toBeGreaterThan(0);

      const states = stateChanges.map(msg => msg.state);
      expect(states).toContain('listening');
      expect(states).toContain('analyzing_image');

      // Final state should be listening
      expect(session.getState()).toBe('listening');

      // 2. Should have sent vision result
      const visionResults = getMessagesByType('vision_result');
      expect(visionResults.length).toBe(1);
      expect(visionResults[0].description).toBe(visionResult);

      // 3. Should have called analyzeImage with correct parameters
      expect(llmClient.analyzeImage).toHaveBeenCalledWith(
        imageBase64,
        expect.stringContaining('describe'),
        expect.any(String)
      );

      // 4. Conversation history should be updated with both user and assistant messages
      expect(session.conversationHistory.length).toBe(2);

      // User message with image reference
      expect(session.conversationHistory[0].role).toBe('user');
      expect(session.conversationHistory[0].content).toContain(filename);
      expect(session.conversationHistory[0].content).toContain('Uploaded image');

      // Assistant message with vision analysis
      expect(session.conversationHistory[1].role).toBe('assistant');
      expect(session.conversationHistory[1].content).toBe(visionResult);

      // 5. No errors should have been sent
      const errors = getMessagesByType('error');
      expect(errors.length).toBe(0);
    });

    test('should complete image upload flow from listening state', async () => {
      const imageBase64 = sampleImages.png;
      const filename = 'screenshot.png';
      const mimeType = 'image/png';
      const visionResult = 'A screenshot showing code with syntax highlighting.';

      llmClient.analyzeImage.mockResolvedValue(visionResult);

      // Start conversation first
      session.transition('start');
      expect(session.getState()).toBe('listening');

      // Upload image
      await handleImageUpload(wsHandler, session, llmClient, imageBase64, filename, mimeType);

      // Should transition: listening → analyzing_image → listening
      const stateChanges = getMessagesByType('state_change');
      const states = stateChanges.map(msg => msg.state);

      expect(states).toContain('analyzing_image');
      expect(session.getState()).toBe('listening');

      // Vision result should be sent
      const visionResults = getMessagesByType('vision_result');
      expect(visionResults.length).toBe(1);
      expect(visionResults[0].description).toBe(visionResult);

      // History should be updated
      expect(session.conversationHistory.length).toBe(2);
    });

    test('should handle PNG image format', async () => {
      const imageBase64 = sampleImages.png;
      const filename = 'diagram.png';
      const mimeType = 'image/png';
      const visionResult = 'A diagram showing system architecture.';

      llmClient.analyzeImage.mockResolvedValue(visionResult);

      await handleImageUpload(wsHandler, session, llmClient, imageBase64, filename, mimeType);

      expect(llmClient.analyzeImage).toHaveBeenCalledWith(
        imageBase64,
        expect.any(String),
        expect.any(String)
      );

      expect(session.getState()).toBe('listening');
      expect(session.conversationHistory.length).toBe(2);
    });

    test('should handle JPEG image format', async () => {
      const imageBase64 = sampleImages.jpeg;
      const filename = 'photo.jpg';
      const mimeType = 'image/jpeg';
      const visionResult = 'A photograph of a person smiling.';

      llmClient.analyzeImage.mockResolvedValue(visionResult);

      await handleImageUpload(wsHandler, session, llmClient, imageBase64, filename, mimeType);

      expect(llmClient.analyzeImage).toHaveBeenCalledWith(
        imageBase64,
        expect.any(String),
        expect.any(String)
      );

      expect(session.getState()).toBe('listening');
      expect(session.conversationHistory.length).toBe(2);
    });

    test('should handle GIF image format', async () => {
      const imageBase64 = sampleImages.gif;
      const filename = 'animation.gif';
      const mimeType = 'image/gif';
      const visionResult = 'An animated GIF showing a loading spinner.';

      llmClient.analyzeImage.mockResolvedValue(visionResult);

      await handleImageUpload(wsHandler, session, llmClient, imageBase64, filename, mimeType);

      expect(session.getState()).toBe('listening');
      expect(session.conversationHistory.length).toBe(2);
    });

    test('should handle WebP image format', async () => {
      const imageBase64 = sampleImages.webp;
      const filename = 'modern-image.webp';
      const mimeType = 'image/webp';
      const visionResult = 'A modern WebP format image.';

      llmClient.analyzeImage.mockResolvedValue(visionResult);

      await handleImageUpload(wsHandler, session, llmClient, imageBase64, filename, mimeType);

      expect(session.getState()).toBe('listening');
      expect(session.conversationHistory.length).toBe(2);
    });
  });

  describe('Multiple Image Uploads', () => {
    test('should handle multiple images in sequence', async () => {
      llmClient.analyzeImage
        .mockResolvedValueOnce('First image: A cat sitting on a couch.')
        .mockResolvedValueOnce('Second image: A dog playing in the park.')
        .mockResolvedValueOnce('Third image: A bird flying in the sky.');

      // Upload first image
      await handleImageUpload(
        wsHandler,
        session,
        llmClient,
        sampleImages.jpeg,
        'cat.jpg',
        'image/jpeg'
      );

      expect(session.getState()).toBe('listening');
      expect(session.conversationHistory.length).toBe(2);
      expect(session.conversationHistory[1].content).toContain('cat');

      // Upload second image
      await handleImageUpload(
        wsHandler,
        session,
        llmClient,
        sampleImages.png,
        'dog.png',
        'image/png'
      );

      expect(session.getState()).toBe('listening');
      expect(session.conversationHistory.length).toBe(4);
      expect(session.conversationHistory[3].content).toContain('dog');

      // Upload third image
      await handleImageUpload(
        wsHandler,
        session,
        llmClient,
        sampleImages.jpeg,
        'bird.jpg',
        'image/jpeg'
      );

      expect(session.getState()).toBe('listening');
      expect(session.conversationHistory.length).toBe(6);
      expect(session.conversationHistory[5].content).toContain('bird');

      // Verify each image was analyzed separately
      expect(llmClient.analyzeImage).toHaveBeenCalledTimes(3);

      // Verify conversation history order
      expect(session.conversationHistory[0].content).toContain('cat.jpg');
      expect(session.conversationHistory[2].content).toContain('dog.png');
      expect(session.conversationHistory[4].content).toContain('bird.jpg');

      // All should be in listening state
      expect(session.getState()).toBe('listening');
    });

    test('should preserve context across multiple image uploads', async () => {
      llmClient.analyzeImage
        .mockResolvedValueOnce('Image 1 description')
        .mockResolvedValueOnce('Image 2 description');

      // First image
      await handleImageUpload(
        wsHandler,
        session,
        llmClient,
        sampleImages.jpeg,
        'image1.jpg',
        'image/jpeg'
      );

      const historyAfterFirst = session.conversationHistory.length;
      expect(historyAfterFirst).toBe(2);

      // Second image
      await handleImageUpload(
        wsHandler,
        session,
        llmClient,
        sampleImages.png,
        'image2.png',
        'image/png'
      );

      // Should have accumulated both image contexts
      expect(session.conversationHistory.length).toBe(4);

      // Verify all messages are preserved
      expect(session.conversationHistory[0].content).toContain('image1.jpg');
      expect(session.conversationHistory[1].content).toBe('Image 1 description');
      expect(session.conversationHistory[2].content).toContain('image2.png');
      expect(session.conversationHistory[3].content).toBe('Image 2 description');
    });
  });

  describe('Image Upload with Conversation Context', () => {
    test('should integrate image upload with existing conversation', async () => {
      // Build up existing conversation
      session.addMessage('user', 'Hello, I want to show you something.');
      session.addMessage('assistant', 'Sure! I would love to see what you have.');

      const imageBase64 = sampleImages.jpeg;
      const filename = 'my-photo.jpg';
      const mimeType = 'image/jpeg';
      const visionResult = 'I can see a beautiful landscape photo.';

      llmClient.analyzeImage.mockResolvedValue(visionResult);

      // Upload image
      await handleImageUpload(wsHandler, session, llmClient, imageBase64, filename, mimeType);

      // Should have all messages in history
      expect(session.conversationHistory.length).toBe(4);

      // Verify order and content
      expect(session.conversationHistory[0].content).toBe('Hello, I want to show you something.');
      expect(session.conversationHistory[1].content).toBe('Sure! I would love to see what you have.');
      expect(session.conversationHistory[2].content).toContain('my-photo.jpg');
      expect(session.conversationHistory[3].content).toBe(visionResult);
    });

    test('should allow follow-up text questions about uploaded image', async () => {
      // Upload image first
      llmClient.analyzeImage.mockResolvedValue('This is a photo of a mountain landscape.');

      await handleImageUpload(
        wsHandler,
        session,
        llmClient,
        sampleImages.jpeg,
        'mountain.jpg',
        'image/jpeg'
      );

      expect(session.conversationHistory.length).toBe(2);

      // Now ask follow-up question
      llmClient.streamChat.mockImplementation(async (messages, onToken) => {
        onToken('The mountain appears to be approximately 3000 meters tall based on the visible features.');
      });

      ttsClient.generateSpeech.mockResolvedValue({ audio: 'YXVkaW8=' });

      await handleTextMessage(
        wsHandler,
        session,
        'How tall is that mountain?',
        llmClient,
        ttsClient
      );

      // Should have image context + follow-up in history
      expect(session.conversationHistory.length).toBe(4);

      // Verify LLM received image context
      const llmCallArgs = llmClient.streamChat.mock.calls[0];
      const messages = llmCallArgs[0];

      expect(messages.length).toBe(3); // Image upload message + vision result + follow-up question
      expect(messages[0].content).toContain('mountain.jpg');
      expect(messages[1].content).toContain('mountain landscape');
      expect(messages[2].content).toBe('How tall is that mountain?');
    });

    test('should maintain image context through multiple follow-ups', async () => {
      // Upload image
      llmClient.analyzeImage.mockResolvedValue('A photo of a red sports car.');

      await handleImageUpload(
        wsHandler,
        session,
        llmClient,
        sampleImages.jpeg,
        'car.jpg',
        'image/jpeg'
      );

      // First follow-up
      llmClient.streamChat
        .mockImplementationOnce(async (messages, onToken) => {
          onToken('It appears to be a Ferrari.');
        })
        .mockImplementationOnce(async (messages, onToken) => {
          onToken('Based on the design, it looks like a 2020 model.');
        });

      ttsClient.generateSpeech.mockResolvedValue({ audio: 'YXVkaW8=' });

      await handleTextMessage(wsHandler, session, 'What brand is it?', llmClient, ttsClient);
      await handleTextMessage(wsHandler, session, 'What year?', llmClient, ttsClient);

      // Should have full conversation
      expect(session.conversationHistory.length).toBe(6);

      // Verify LLM second call received full context including image
      const secondCallArgs = llmClient.streamChat.mock.calls[1];
      const messages = secondCallArgs[0];

      expect(messages.length).toBe(5); // Image + vision + Q1 + A1 + Q2
      expect(messages[0].content).toContain('car.jpg');
      expect(messages[1].content).toContain('sports car');
    });
  });

  describe('Large Image Handling', () => {
    test('should handle large base64-encoded images', async () => {
      // Create a larger base64 string (simulating ~1MB image)
      const largeImageBase64 = sampleImages.jpeg.repeat(1000);
      const filename = 'large-photo.jpg';
      const mimeType = 'image/jpeg';
      const visionResult = 'Analysis of large image.';

      llmClient.analyzeImage.mockResolvedValue(visionResult);

      await handleImageUpload(wsHandler, session, llmClient, largeImageBase64, filename, mimeType);

      // Should handle large image successfully
      expect(llmClient.analyzeImage).toHaveBeenCalledWith(
        largeImageBase64,
        expect.any(String),
        expect.any(String)
      );

      expect(session.getState()).toBe('listening');
      expect(session.conversationHistory.length).toBe(2);
    });

    test('should validate base64 data is a string', async () => {
      const invalidBase64 = 12345; // Not a string
      const filename = 'test.jpg';
      const mimeType = 'image/jpeg';

      await handleImageUpload(wsHandler, session, llmClient, invalidBase64, filename, mimeType);

      // Should send error
      const errors = getMessagesByType('error');
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].message).toContain('Invalid image data');
      expect(errors[0].message).toContain('imageBase64');

      // Should not call analyzeImage
      expect(llmClient.analyzeImage).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    test('should handle missing imageBase64 parameter', async () => {
      await handleImageUpload(wsHandler, session, llmClient, null, 'test.jpg', 'image/jpeg');

      const errors = getMessagesByType('error');
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].message).toContain('Invalid image data');
      expect(errors[0].message).toContain('imageBase64');
      expect(errors[0].phase).toBe('image_upload_handler');

      expect(llmClient.analyzeImage).not.toHaveBeenCalled();
    });

    test('should handle empty imageBase64 string', async () => {
      await handleImageUpload(wsHandler, session, llmClient, '', 'test.jpg', 'image/jpeg');

      const errors = getMessagesByType('error');
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].message).toContain('Invalid image data');
      expect(llmClient.analyzeImage).not.toHaveBeenCalled();
    });

    test('should handle whitespace-only imageBase64', async () => {
      await handleImageUpload(wsHandler, session, llmClient, '   ', 'test.jpg', 'image/jpeg');

      const errors = getMessagesByType('error');
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].message).toContain('Invalid image data');
      expect(llmClient.analyzeImage).not.toHaveBeenCalled();
    });

    test('should handle missing filename parameter', async () => {
      await handleImageUpload(wsHandler, session, llmClient, sampleImages.jpeg, null, 'image/jpeg');

      const errors = getMessagesByType('error');
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].message).toContain('Invalid image data');
      expect(errors[0].message).toContain('filename');

      expect(llmClient.analyzeImage).not.toHaveBeenCalled();
    });

    test('should handle invalid filename type', async () => {
      await handleImageUpload(wsHandler, session, llmClient, sampleImages.jpeg, 12345, 'image/jpeg');

      const errors = getMessagesByType('error');
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].message).toContain('filename');
      expect(llmClient.analyzeImage).not.toHaveBeenCalled();
    });

    test('should handle missing mimeType parameter', async () => {
      await handleImageUpload(wsHandler, session, llmClient, sampleImages.jpeg, 'test.jpg', null);

      const errors = getMessagesByType('error');
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].message).toContain('Invalid image data');
      expect(errors[0].message).toContain('mimeType');

      expect(llmClient.analyzeImage).not.toHaveBeenCalled();
    });

    test('should handle invalid mimeType type', async () => {
      await handleImageUpload(wsHandler, session, llmClient, sampleImages.jpeg, 'test.jpg', 12345);

      const errors = getMessagesByType('error');
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].message).toContain('mimeType');
      expect(llmClient.analyzeImage).not.toHaveBeenCalled();
    });

    test('should handle vision model errors', async () => {
      llmClient.analyzeImage.mockRejectedValue(new Error('Vision model not available'));

      await handleImageUpload(
        wsHandler,
        session,
        llmClient,
        sampleImages.jpeg,
        'test.jpg',
        'image/jpeg'
      );

      // Should send error
      const errors = getMessagesByType('error');
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].message).toContain('Image upload processing failed');
      expect(errors[0].message).toContain('Vision model not available');

      // Should recover to listening state
      expect(session.getState()).toBe('listening');
    });

    test('should handle network failures during vision analysis', async () => {
      llmClient.analyzeImage.mockRejectedValue(new Error('Network timeout'));

      await handleImageUpload(
        wsHandler,
        session,
        llmClient,
        sampleImages.jpeg,
        'test.jpg',
        'image/jpeg'
      );

      const errors = getMessagesByType('error');
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].message).toContain('Network timeout');

      // Should recover to listening state
      expect(session.getState()).toBe('listening');
    });

    test('should handle LLM service unreachable', async () => {
      llmClient.analyzeImage.mockRejectedValue(new Error('LLM service unreachable'));

      await handleImageUpload(
        wsHandler,
        session,
        llmClient,
        sampleImages.jpeg,
        'test.jpg',
        'image/jpeg'
      );

      const errors = getMessagesByType('error');
      expect(errors.length).toBeGreaterThan(0);

      // Should recover
      expect(session.getState()).toBe('listening');
    });

    test('should recover from analyzing_image state on error', async () => {
      llmClient.analyzeImage.mockRejectedValue(new Error('Analysis failed'));

      // Start from listening state
      session.transition('start');
      expect(session.getState()).toBe('listening');

      await handleImageUpload(
        wsHandler,
        session,
        llmClient,
        sampleImages.jpeg,
        'test.jpg',
        'image/jpeg'
      );

      // Should have recovered to listening state
      expect(session.getState()).toBe('listening');

      // Should have added user message but not assistant message (since analysis failed)
      expect(session.conversationHistory.length).toBe(1);

      // Should be able to continue with new operations
      llmClient.analyzeImage.mockResolvedValue('Success this time');

      sentMessages = []; // Clear error messages

      await handleImageUpload(
        wsHandler,
        session,
        llmClient,
        sampleImages.jpeg,
        'test2.jpg',
        'image/jpeg'
      );

      expect(session.getState()).toBe('listening');
      expect(session.conversationHistory.length).toBe(3); // First user message + successful upload (user + assistant)
    });
  });

  describe('State Transitions', () => {
    test('should transition idle → listening → analyzing_image → listening', async () => {
      llmClient.analyzeImage.mockResolvedValue('Image description');

      const states = [];
      states.push(session.getState()); // idle

      await handleImageUpload(
        wsHandler,
        session,
        llmClient,
        sampleImages.jpeg,
        'test.jpg',
        'image/jpeg'
      );

      states.push(session.getState()); // listening (final)

      // Verify initial and final states
      expect(states[0]).toBe('idle');
      expect(states[states.length - 1]).toBe('listening');

      // Check state changes in WebSocket messages
      const stateChanges = getMessagesByType('state_change');
      const messageStates = stateChanges.map(msg => msg.state);

      expect(messageStates).toContain('listening');
      expect(messageStates).toContain('analyzing_image');
    });

    test('should transition listening → analyzing_image → listening', async () => {
      llmClient.analyzeImage.mockResolvedValue('Image description');

      // Start from listening
      session.transition('start');
      expect(session.getState()).toBe('listening');

      sentMessages = []; // Clear previous messages

      await handleImageUpload(
        wsHandler,
        session,
        llmClient,
        sampleImages.jpeg,
        'test.jpg',
        'image/jpeg'
      );

      // Should end in listening
      expect(session.getState()).toBe('listening');

      // Check transitions
      const stateChanges = getMessagesByType('state_change');
      const states = stateChanges.map(msg => msg.state);

      expect(states).toContain('analyzing_image');
      expect(states[states.length - 1]).toBe('listening');
    });

    test('should send state change messages to client', async () => {
      llmClient.analyzeImage.mockResolvedValue('Image description');

      await handleImageUpload(
        wsHandler,
        session,
        llmClient,
        sampleImages.jpeg,
        'test.jpg',
        'image/jpeg'
      );

      const stateChanges = getMessagesByType('state_change');

      // Should have sent multiple state changes
      expect(stateChanges.length).toBeGreaterThan(0);

      // Each should have proper format
      stateChanges.forEach(msg => {
        expect(msg).toHaveProperty('type', 'state_change');
        expect(msg).toHaveProperty('state');
        expect(typeof msg.state).toBe('string');
      });
    });

    test('should handle state transitions gracefully during errors', async () => {
      llmClient.analyzeImage.mockRejectedValue(new Error('Analysis error'));

      // Start from listening
      session.transition('start');

      await handleImageUpload(
        wsHandler,
        session,
        llmClient,
        sampleImages.jpeg,
        'test.jpg',
        'image/jpeg'
      );

      // Should recover to listening even on error
      expect(session.getState()).toBe('listening');
    });
  });

  describe('Vision Results Integration', () => {
    test('should add vision results as assistant message', async () => {
      const visionResult = 'Detailed description of the uploaded image.';
      llmClient.analyzeImage.mockResolvedValue(visionResult);

      await handleImageUpload(
        wsHandler,
        session,
        llmClient,
        sampleImages.jpeg,
        'test.jpg',
        'image/jpeg'
      );

      // Should have user message + assistant message
      expect(session.conversationHistory.length).toBe(2);

      const assistantMessage = session.conversationHistory[1];
      expect(assistantMessage.role).toBe('assistant');
      expect(assistantMessage.content).toBe(visionResult);
    });

    test('should add image context as user message', async () => {
      const filename = 'my-photo.jpg';
      llmClient.analyzeImage.mockResolvedValue('Description');

      await handleImageUpload(
        wsHandler,
        session,
        llmClient,
        sampleImages.jpeg,
        filename,
        'image/jpeg'
      );

      const userMessage = session.conversationHistory[0];
      expect(userMessage.role).toBe('user');
      expect(userMessage.content).toContain('Uploaded image');
      expect(userMessage.content).toContain(filename);
    });

    test('should allow future messages to reference the image', async () => {
      llmClient.analyzeImage.mockResolvedValue('A red apple on a wooden table.');

      await handleImageUpload(
        wsHandler,
        session,
        llmClient,
        sampleImages.jpeg,
        'apple.jpg',
        'image/jpeg'
      );

      // Ask follow-up question
      llmClient.streamChat.mockImplementation(async (messages, onToken) => {
        // Verify LLM receives image context
        expect(messages.length).toBe(3); // image upload + vision result + question
        expect(messages[1].content).toContain('red apple');

        onToken('Yes, apples are typically red, green, or yellow.');
      });

      ttsClient.generateSpeech.mockResolvedValue({ audio: 'YXVkaW8=' });

      await handleTextMessage(
        wsHandler,
        session,
        'What color are apples?',
        llmClient,
        ttsClient
      );

      // LLM should have received context
      expect(llmClient.streamChat).toHaveBeenCalled();
    });

    test('should use vision results in subsequent LLM responses', async () => {
      llmClient.analyzeImage.mockResolvedValue('A diagram showing a client-server architecture with HTTP connections.');

      await handleImageUpload(
        wsHandler,
        session,
        llmClient,
        sampleImages.png,
        'architecture.png',
        'image/png'
      );

      // Ask question that requires image context
      llmClient.streamChat.mockImplementation(async (messages, onToken) => {
        // LLM should have access to vision description
        const hasVisionContext = messages.some(msg =>
          msg.content && msg.content.includes('client-server architecture')
        );
        expect(hasVisionContext).toBe(true);

        onToken('The architecture uses HTTP for client-server communication as shown in the diagram.');
      });

      ttsClient.generateSpeech.mockResolvedValue({ audio: 'YXVkaW8=' });

      await handleTextMessage(
        wsHandler,
        session,
        'What protocol is used?',
        llmClient,
        ttsClient
      );

      expect(llmClient.streamChat).toHaveBeenCalled();
    });

    test('should send vision result with proper message format', async () => {
      const visionResult = 'Test vision description';
      llmClient.analyzeImage.mockResolvedValue(visionResult);

      await handleImageUpload(
        wsHandler,
        session,
        llmClient,
        sampleImages.jpeg,
        'test.jpg',
        'image/jpeg'
      );

      const visionMessages = getMessagesByType('vision_result');
      expect(visionMessages.length).toBe(1);

      const msg = visionMessages[0];
      expect(msg).toHaveProperty('type', 'vision_result');
      expect(msg).toHaveProperty('description', visionResult);
    });
  });

  describe('WebSocket Message Verification', () => {
    test('should send all required message types in vision flow', async () => {
      llmClient.analyzeImage.mockResolvedValue('Image description');

      await handleImageUpload(
        wsHandler,
        session,
        llmClient,
        sampleImages.jpeg,
        'test.jpg',
        'image/jpeg'
      );

      // Verify all expected message types were sent
      const messageTypes = new Set(sentMessages.map(msg => msg.type));

      expect(messageTypes.has('state_change')).toBe(true);
      expect(messageTypes.has('vision_result')).toBe(true);
    });

    test('should not send audio messages during vision-only flow', async () => {
      llmClient.analyzeImage.mockResolvedValue('Image description');

      await handleImageUpload(
        wsHandler,
        session,
        llmClient,
        sampleImages.jpeg,
        'test.jpg',
        'image/jpeg'
      );

      // Should not have audio-related messages
      const audioChunks = getMessagesByType('audio_chunk');
      const audioComplete = getMessagesByType('audio_complete');

      expect(audioChunks.length).toBe(0);
      expect(audioComplete.length).toBe(0);
    });

    test('should send messages in correct order', async () => {
      llmClient.analyzeImage.mockResolvedValue('Image description');

      await handleImageUpload(
        wsHandler,
        session,
        llmClient,
        sampleImages.jpeg,
        'test.jpg',
        'image/jpeg'
      );

      // Find indices of key messages
      const stateChangeIndices = sentMessages
        .map((msg, idx) => (msg.type === 'state_change' ? idx : -1))
        .filter(idx => idx !== -1);

      const visionResultIdx = sentMessages.findIndex(msg => msg.type === 'vision_result');

      // State changes should come before vision result
      expect(stateChangeIndices.length).toBeGreaterThan(0);
      expect(visionResultIdx).toBeGreaterThan(stateChangeIndices[0]);
    });
  });

  describe('Conversation History with Images', () => {
    test('should maintain proper message order with images', async () => {
      llmClient.analyzeImage
        .mockResolvedValueOnce('First image')
        .mockResolvedValueOnce('Second image');

      // Regular conversation
      session.addMessage('user', 'Hello');
      session.addMessage('assistant', 'Hi');

      // Upload first image
      await handleImageUpload(
        wsHandler,
        session,
        llmClient,
        sampleImages.jpeg,
        'img1.jpg',
        'image/jpeg'
      );

      // More conversation
      session.addMessage('user', 'What do you think?');
      session.addMessage('assistant', 'Interesting');

      // Upload second image
      await handleImageUpload(
        wsHandler,
        session,
        llmClient,
        sampleImages.png,
        'img2.png',
        'image/png'
      );

      // Verify order
      expect(session.conversationHistory.length).toBe(8);
      expect(session.conversationHistory[0].content).toBe('Hello');
      expect(session.conversationHistory[2].content).toContain('img1.jpg');
      expect(session.conversationHistory[4].content).toBe('What do you think?');
      expect(session.conversationHistory[6].content).toContain('img2.png');
    });

    test('should preserve image metadata in conversation history', async () => {
      const filename = 'vacation-photo.jpg';
      llmClient.analyzeImage.mockResolvedValue('Beach scene');

      await handleImageUpload(
        wsHandler,
        session,
        llmClient,
        sampleImages.jpeg,
        filename,
        'image/jpeg'
      );

      const userMessage = session.conversationHistory[0];

      // Should include filename and context
      expect(userMessage.content).toContain(filename);
      expect(userMessage.content).toMatch(/uploaded image/i);
    });

    test('should handle mixed content types in history', async () => {
      // Text message
      llmClient.streamChat.mockImplementation(async (messages, onToken) => {
        onToken('Text response');
      });
      ttsClient.generateSpeech.mockResolvedValue({ audio: 'YXVkaW8=' });

      await handleTextMessage(wsHandler, session, 'Text question', llmClient, ttsClient);

      // Image upload
      llmClient.analyzeImage.mockResolvedValue('Image analysis');

      await handleImageUpload(
        wsHandler,
        session,
        llmClient,
        sampleImages.jpeg,
        'photo.jpg',
        'image/jpeg'
      );

      // Another text message
      llmClient.streamChat.mockImplementation(async (messages, onToken) => {
        onToken('Follow-up response');
      });

      await handleTextMessage(wsHandler, session, 'Follow-up', llmClient, ttsClient);

      // Should have all messages
      expect(session.conversationHistory.length).toBe(6);

      // Verify types
      expect(session.conversationHistory[0].content).toBe('Text question');
      expect(session.conversationHistory[2].content).toContain('photo.jpg');
      expect(session.conversationHistory[4].content).toBe('Follow-up');
    });
  });

  describe('Vision Model Configuration', () => {
    test('should use default vision model when not configured', async () => {
      llmClient.analyzeImage.mockResolvedValue('Description');

      await handleImageUpload(
        wsHandler,
        session,
        llmClient,
        sampleImages.jpeg,
        'test.jpg',
        'image/jpeg'
      );

      // Should call analyzeImage with a model parameter
      expect(llmClient.analyzeImage).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.any(String) // Model name
      );
    });

    test('should use environment-configured vision model', async () => {
      const originalModel = process.env.VISION_MODEL;
      process.env.VISION_MODEL = 'custom-vision-model';

      llmClient.analyzeImage.mockResolvedValue('Description');

      await handleImageUpload(
        wsHandler,
        session,
        llmClient,
        sampleImages.jpeg,
        'test.jpg',
        'image/jpeg'
      );

      expect(llmClient.analyzeImage).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        'custom-vision-model'
      );

      // Restore original
      if (originalModel) {
        process.env.VISION_MODEL = originalModel;
      } else {
        delete process.env.VISION_MODEL;
      }
    });
  });

  describe('Edge Cases', () => {
    test('should handle very long vision responses', async () => {
      const longDescription = 'This is a very detailed description. '.repeat(100);
      llmClient.analyzeImage.mockResolvedValue(longDescription);

      await handleImageUpload(
        wsHandler,
        session,
        llmClient,
        sampleImages.jpeg,
        'test.jpg',
        'image/jpeg'
      );

      expect(session.conversationHistory[1].content).toBe(longDescription);
      expect(session.getState()).toBe('listening');
    });

    test('should handle empty vision response', async () => {
      llmClient.analyzeImage.mockResolvedValue('');

      await handleImageUpload(
        wsHandler,
        session,
        llmClient,
        sampleImages.jpeg,
        'test.jpg',
        'image/jpeg'
      );

      // Should still add to history
      expect(session.conversationHistory.length).toBe(2);
      expect(session.conversationHistory[1].content).toBe('');
    });

    test('should handle special characters in filename', async () => {
      const filename = 'test-image_2024 (1).jpg';
      llmClient.analyzeImage.mockResolvedValue('Description');

      await handleImageUpload(
        wsHandler,
        session,
        llmClient,
        sampleImages.jpeg,
        filename,
        'image/jpeg'
      );

      expect(session.conversationHistory[0].content).toContain(filename);
    });

    test('should handle unicode characters in vision response', async () => {
      const unicodeDescription = 'Esta imagen muestra un café ☕ y croissant 🥐';
      llmClient.analyzeImage.mockResolvedValue(unicodeDescription);

      await handleImageUpload(
        wsHandler,
        session,
        llmClient,
        sampleImages.jpeg,
        'test.jpg',
        'image/jpeg'
      );

      expect(session.conversationHistory[1].content).toBe(unicodeDescription);
    });

    test('should handle rapid sequential image uploads', async () => {
      llmClient.analyzeImage
        .mockResolvedValueOnce('Image 1')
        .mockResolvedValueOnce('Image 2')
        .mockResolvedValueOnce('Image 3');

      // Upload multiple images sequentially (not in parallel to avoid state conflicts)
      await handleImageUpload(wsHandler, session, llmClient, sampleImages.jpeg, 'img1.jpg', 'image/jpeg');
      await handleImageUpload(wsHandler, session, llmClient, sampleImages.png, 'img2.png', 'image/png');
      await handleImageUpload(wsHandler, session, llmClient, sampleImages.jpeg, 'img3.jpg', 'image/jpeg');

      // All should complete successfully
      expect(session.conversationHistory.length).toBe(6);
      expect(llmClient.analyzeImage).toHaveBeenCalledTimes(3);
    });
  });
});
