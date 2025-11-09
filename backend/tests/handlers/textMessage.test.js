const LLMClient = require('../../lib/services/LLMClient');
const SessionManager = require('../../lib/SessionManager');
const WebSocketHandler = require('../../lib/WebSocketHandler');
const { handleTextMessage } = require('../../lib/handlers/textMessage');

jest.mock('../../lib/services/LLMClient');

describe('handleTextMessage', () => {
  let llmClient;
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

    // Mock LLM client
    llmClient = new LLMClient('http://localhost:11434');
    llmClient.streamChat = jest.fn();

    jest.clearAllMocks();
  });

  describe('Successful Text Message Flow', () => {
    test('should add user message to conversation history', async () => {
      const messageText = 'Hello, this is a text message';

      llmClient.streamChat.mockImplementation(async (messages, onToken) => {
        onToken('Response to text message');
      });

      await handleTextMessage(wsHandler, session, messageText, llmClient);

      // Should add user message to history
      expect(session.conversationHistory.length).toBeGreaterThanOrEqual(1);
      const userMessage = session.conversationHistory.find(msg => msg.role === 'user');
      expect(userMessage).toBeDefined();
      expect(userMessage.content).toBe(messageText);
    });

    test('should transition to thinking state and then speaking', async () => {
      const messageText = 'What is 2+2?';

      // Session starts in idle state
      expect(session.getState()).toBe('idle');

      llmClient.streamChat.mockImplementation(async (messages, onToken) => {
        onToken('2+2 equals 4');
      });

      await handleTextMessage(wsHandler, session, messageText, llmClient);

      // Should complete LLM and transition to speaking state
      expect(session.getState()).toBe('speaking');

      // Should have sent state changes during processing
      const stateChangeCalls = mockWs.send.mock.calls.filter(call => {
        const message = JSON.parse(call[0]);
        return message.type === 'state_change';
      });

      expect(stateChangeCalls.length).toBeGreaterThanOrEqual(1);
    });

    test('should call LLM with conversation history', async () => {
      const messageText = 'Explain quantum physics';

      llmClient.streamChat.mockImplementation(async (messages, onToken) => {
        onToken('Quantum physics is...');
      });

      await handleTextMessage(wsHandler, session, messageText, llmClient);

      // Should call LLM streamChat
      expect(llmClient.streamChat).toHaveBeenCalled();

      // Get the call arguments
      const callArgs = llmClient.streamChat.mock.calls[0];
      const messages = callArgs[0];
      const onToken = callArgs[1];

      // Should pass conversation history
      expect(Array.isArray(messages)).toBe(true);
      expect(messages.length).toBeGreaterThan(0);

      // Should pass callbacks
      expect(typeof onToken).toBe('function');
    });

    test('should stream LLM tokens to client', async () => {
      const messageText = 'Count to five';
      const tokens = ['One', ' two', ' three', ' four', ' five'];

      llmClient.streamChat.mockImplementation(async (messages, onToken) => {
        for (const token of tokens) {
          onToken(token);
        }
      });

      await handleTextMessage(wsHandler, session, messageText, llmClient);

      // Should send LLM tokens
      const tokenCalls = mockWs.send.mock.calls.filter(call => {
        const message = JSON.parse(call[0]);
        return message.type === 'llm_token';
      });

      expect(tokenCalls.length).toBeGreaterThan(0);
    });

    test('should add assistant response to conversation history', async () => {
      const messageText = 'Say goodbye';
      const response = 'Goodbye!';

      llmClient.streamChat.mockImplementation(async (messages, onToken) => {
        onToken(response);
      });

      await handleTextMessage(wsHandler, session, messageText, llmClient);

      // Should add assistant message to history
      const assistantMessage = session.conversationHistory.find(msg => msg.role === 'assistant');
      expect(assistantMessage).toBeDefined();
      expect(assistantMessage.content).toBe(response);
    });

    test('should send state change messages', async () => {
      const messageText = 'Test state change';

      llmClient.streamChat.mockImplementation(async (messages, onToken) => {
        onToken('Response');
      });

      await handleTextMessage(wsHandler, session, messageText, llmClient);

      // Should send state change to thinking
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"state_change"')
      );
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"state":"thinking"')
      );
    });

    test('should work from any valid state', async () => {
      const messageText = 'Message from listening state';

      // Start conversation (go to listening state)
      session.transition('start');
      expect(session.getState()).toBe('listening');

      llmClient.streamChat.mockImplementation(async (messages, onToken) => {
        onToken('Response from listening');
      });

      await handleTextMessage(wsHandler, session, messageText, llmClient);

      // Should complete LLM and be in speaking state
      expect(session.getState()).toBe('speaking');
    });
  });

  describe('Error Handling', () => {
    test('should handle LLM service errors gracefully', async () => {
      const messageText = 'This will fail';

      llmClient.streamChat.mockRejectedValue(new Error('LLM service unreachable'));

      await handleTextMessage(wsHandler, session, messageText, llmClient);

      // Should send error message
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"error"')
      );
    });

    test('should handle empty message gracefully', async () => {
      const messageText = '';

      await handleTextMessage(wsHandler, session, messageText, llmClient);

      // Should not call LLM for empty message
      expect(llmClient.streamChat).not.toHaveBeenCalled();
    });

    test('should handle whitespace-only message gracefully', async () => {
      const messageText = '   \n\t   ';

      await handleTextMessage(wsHandler, session, messageText, llmClient);

      // Should not call LLM for whitespace-only message
      expect(llmClient.streamChat).not.toHaveBeenCalled();
    });

    test('should handle LLM streaming errors', async () => {
      const messageText = 'This will error during streaming';

      llmClient.streamChat.mockImplementation(async (messages, onToken) => {
        onToken('Partial response');
        throw new Error('Stream interrupted');
      });

      await handleTextMessage(wsHandler, session, messageText, llmClient);

      // Should send error message
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"error"')
      );
    });
  });

  describe('Model Configuration', () => {
    test('should use LLM_MODEL from environment', async () => {
      const messageText = 'Test with custom model';
      const originalModel = process.env.LLM_MODEL;

      process.env.LLM_MODEL = 'llama3.2';

      llmClient.streamChat.mockImplementation(async (messages, onToken, model) => {
        onToken('Response');
      });

      await handleTextMessage(wsHandler, session, messageText, llmClient);

      // Get the model parameter passed to streamChat
      const callArgs = llmClient.streamChat.mock.calls[0];
      const model = callArgs[2];

      expect(model).toBe('llama3.2');

      // Restore original
      if (originalModel) {
        process.env.LLM_MODEL = originalModel;
      } else {
        delete process.env.LLM_MODEL;
      }
    });
  });

  describe('Conversation Context', () => {
    test('should include previous conversation history in LLM call', async () => {
      // Add some previous messages
      session.addMessage('user', 'First question');
      session.addMessage('assistant', 'First answer');
      session.addMessage('user', 'Second question');
      session.addMessage('assistant', 'Second answer');

      const messageText = 'Third question';

      llmClient.streamChat.mockImplementation(async (messages, onToken) => {
        onToken('Third answer');
      });

      await handleTextMessage(wsHandler, session, messageText, llmClient);

      // Get the messages passed to LLM
      const callArgs = llmClient.streamChat.mock.calls[0];
      const messages = callArgs[0];

      // Should include all messages (4 previous + 1 new)
      expect(messages.length).toBeGreaterThanOrEqual(5);

      // Should maintain conversation order
      const roles = messages.map(m => m.role);
      expect(roles).toContain('user');
      expect(roles).toContain('assistant');
    });

    test('should work with no previous history', async () => {
      const messageText = 'First message ever';

      llmClient.streamChat.mockImplementation(async (messages, onToken) => {
        onToken('First response');
      });

      await handleTextMessage(wsHandler, session, messageText, llmClient);

      // Get the messages passed to LLM
      const callArgs = llmClient.streamChat.mock.calls[0];
      const messages = callArgs[0];

      // Should have only the new message
      expect(messages.length).toBe(1);
      expect(messages[0].role).toBe('user');
      expect(messages[0].content).toBe(messageText);
    });
  });

  describe('Text vs Voice Integration', () => {
    test('should work seamlessly after voice transcription', async () => {
      // Simulate voice transcription first
      session.addMessage('user', 'This was spoken');
      session.addMessage('assistant', 'Voice response');

      // Now send text message
      const messageText = 'This is typed text';

      llmClient.streamChat.mockImplementation(async (messages, onToken) => {
        onToken('Text response');
      });

      await handleTextMessage(wsHandler, session, messageText, llmClient);

      // Should include both voice and text in history
      expect(session.conversationHistory.length).toBe(4);

      // Get the messages passed to LLM
      const callArgs = llmClient.streamChat.mock.calls[0];
      const messages = callArgs[0];

      // Should include all messages
      expect(messages.length).toBeGreaterThanOrEqual(3);
    });
  });
});
