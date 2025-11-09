const LLMClient = require('../../lib/services/LLMClient');
const SessionManager = require('../../lib/SessionManager');
const WebSocketHandler = require('../../lib/WebSocketHandler');
const { handleTranscription } = require('../../lib/handlers/transcription');
const { getToolDefinitions } = require('../../lib/tools/index');

jest.mock('../../lib/services/LLMClient');

describe('handleTranscription', () => {
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

  describe('Successful Transcription Flow', () => {
    test('should add user message to conversation history', async () => {
      const transcriptText = 'Hello, how are you?';

      // Set session to transcribing state (as it would be after STT)
      session.transition('start');
      session.transition('silence_detected');
      expect(session.getState()).toBe('transcribing');

      // Mock LLM streaming response
      llmClient.streamChat.mockImplementation(async (messages, onToken) => {
        onToken('I am doing well, thank you!');
      });

      await handleTranscription(wsHandler, session, transcriptText, llmClient);

      // Should add user message to history
      expect(session.conversationHistory.length).toBeGreaterThanOrEqual(1);
      const userMessage = session.conversationHistory.find(msg => msg.role === 'user');
      expect(userMessage).toBeDefined();
      expect(userMessage.content).toBe(transcriptText);
    });

    test('should transition to thinking state and then speaking', async () => {
      const transcriptText = 'What is the weather?';

      // Set session to transcribing state first
      session.transition('start');
      session.transition('silence_detected');
      expect(session.getState()).toBe('transcribing');

      llmClient.streamChat.mockImplementation(async (messages, onToken) => {
        onToken('The weather is sunny.');
      });

      await handleTranscription(wsHandler, session, transcriptText, llmClient);

      // Should complete LLM and transition to speaking state
      expect(session.getState()).toBe('speaking');

      // Should have sent state change to thinking during processing
      const stateChangeCalls = mockWs.send.mock.calls.filter(call => {
        const message = JSON.parse(call[0]);
        return message.type === 'state_change';
      });

      // Should have state changes: transcribing->thinking, thinking->speaking
      expect(stateChangeCalls.length).toBeGreaterThanOrEqual(2);
    });

    test('should call LLM with conversation history', async () => {
      const transcriptText = 'Tell me a joke';

      session.transition('start');
      session.transition('silence_detected');

      llmClient.streamChat.mockImplementation(async (messages, onToken) => {
        onToken('Why did the chicken cross the road?');
      });

      await handleTranscription(wsHandler, session, transcriptText, llmClient);

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
      const transcriptText = 'Count to three';
      const tokens = ['One', ' two', ' three'];

      session.transition('start');
      session.transition('silence_detected');

      llmClient.streamChat.mockImplementation(async (messages, onToken) => {
        for (const token of tokens) {
          onToken(token);
        }
      });

      await handleTranscription(wsHandler, session, transcriptText, llmClient);

      // Should send LLM tokens
      const tokenCalls = mockWs.send.mock.calls.filter(call => {
        const message = JSON.parse(call[0]);
        return message.type === 'llm_token';
      });

      expect(tokenCalls.length).toBeGreaterThan(0);
    });

    test('should add assistant response to conversation history', async () => {
      const transcriptText = 'Say hello';
      const response = 'Hello there!';

      session.transition('start');
      session.transition('silence_detected');

      llmClient.streamChat.mockImplementation(async (messages, onToken) => {
        onToken(response);
      });

      await handleTranscription(wsHandler, session, transcriptText, llmClient);

      // Should add assistant message to history
      const assistantMessage = session.conversationHistory.find(msg => msg.role === 'assistant');
      expect(assistantMessage).toBeDefined();
      expect(assistantMessage.content).toBe(response);
    });

    test('should send state change messages', async () => {
      const transcriptText = 'Test message';

      session.transition('start');
      session.transition('silence_detected');

      llmClient.streamChat.mockImplementation(async (messages, onToken) => {
        onToken('Response');
      });

      await handleTranscription(wsHandler, session, transcriptText, llmClient);

      // Should send state change to thinking
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"state_change"')
      );
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"state":"thinking"')
      );
    });
  });

  describe('Error Handling', () => {
    test('should handle LLM service errors gracefully', async () => {
      const transcriptText = 'This will fail';

      session.transition('start');
      session.transition('silence_detected');
      expect(session.getState()).toBe('transcribing');

      llmClient.streamChat.mockRejectedValue(new Error('LLM service unreachable'));

      await handleTranscription(wsHandler, session, transcriptText, llmClient);

      // Should send error message
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"error"')
      );
    });

    test('should handle empty transcript gracefully', async () => {
      const transcriptText = '';

      // Don't need to transition for this test as it should return early
      await handleTranscription(wsHandler, session, transcriptText, llmClient);

      // Should not call LLM for empty transcript
      expect(llmClient.streamChat).not.toHaveBeenCalled();
    });

    test('should handle LLM streaming errors', async () => {
      const transcriptText = 'This will error during streaming';

      session.transition('start');
      session.transition('silence_detected');
      expect(session.getState()).toBe('transcribing');

      llmClient.streamChat.mockImplementation(async (messages, onToken) => {
        onToken('Partial response');
        throw new Error('Stream interrupted');
      });

      await handleTranscription(wsHandler, session, transcriptText, llmClient);

      // Should send error message
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"error"')
      );
    });
  });

  describe('Model Configuration', () => {
    test('should use LLM_MODEL from environment', async () => {
      const transcriptText = 'Test with custom model';
      const originalModel = process.env.LLM_MODEL;

      process.env.LLM_MODEL = 'llama3.2';
      session.transition('start');
      session.transition('silence_detected');
      expect(session.getState()).toBe('transcribing');

      llmClient.streamChat.mockImplementation(async (messages, onToken, model) => {
        onToken('Response');
      });

      await handleTranscription(wsHandler, session, transcriptText, llmClient);

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
      session.addMessage('user', 'Previous question');
      session.addMessage('assistant', 'Previous answer');

      const transcriptText = 'Follow-up question';

      session.transition('start');
      session.transition('silence_detected');
      expect(session.getState()).toBe('transcribing');

      llmClient.streamChat.mockImplementation(async (messages, onToken) => {
        onToken('Follow-up answer');
      });

      await handleTranscription(wsHandler, session, transcriptText, llmClient);

      // Get the messages passed to LLM
      const callArgs = llmClient.streamChat.mock.calls[0];
      const messages = callArgs[0];

      // Should include all messages (previous + new)
      expect(messages.length).toBeGreaterThanOrEqual(3);

      // Should maintain conversation order
      const roles = messages.map(m => m.role);
      expect(roles).toContain('user');
      expect(roles).toContain('assistant');
    });
  });

  describe('Tool Calling Support', () => {
    test('should pass tool definitions to LLM', async () => {
      const transcriptText = 'What time is it?';

      session.transition('start');
      session.transition('silence_detected');

      llmClient.streamChat.mockImplementation(async (messages, onToken) => {
        onToken('The current time is 2:30 PM.');
      });

      await handleTranscription(wsHandler, session, transcriptText, llmClient);

      // Get the call arguments
      const callArgs = llmClient.streamChat.mock.calls[0];
      const tools = callArgs[3]; // 4th parameter
      const onToolCall = callArgs[4]; // 5th parameter

      // Should pass tool definitions
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBeGreaterThan(0);

      // Should pass tool callback
      expect(typeof onToolCall).toBe('function');
    });

    test('should execute tool when LLM requests it', async () => {
      const transcriptText = 'What is the time?';

      session.transition('start');
      session.transition('silence_detected');

      // Simulate LLM requesting a tool call and then providing response
      llmClient.streamChat.mockImplementation(async (messages, onToken, model, tools, onToolCall) => {
        // LLM calls the tool
        const toolCall = {
          function: {
            name: 'get_current_time',
            arguments: {}
          }
        };

        if (onToolCall) {
          await onToolCall(toolCall);
        }

        // Then provides final response
        onToken('Based on the tool result, the current time is 2:30 PM.');
      });

      await handleTranscription(wsHandler, session, transcriptText, llmClient);

      // Should complete successfully
      expect(session.conversationHistory.length).toBeGreaterThan(0);
    });

    test('should handle tool execution with arguments', async () => {
      const transcriptText = 'What is the weather in New York?';

      session.transition('start');
      session.transition('silence_detected');

      // Simulate LLM requesting weather tool
      llmClient.streamChat.mockImplementation(async (messages, onToken, model, tools, onToolCall) => {
        const toolCall = {
          function: {
            name: 'get_weather',
            arguments: { location: 'New York' }
          }
        };

        if (onToolCall) {
          await onToolCall(toolCall);
        }

        onToken('The weather in New York is sunny with a temperature of 72°F.');
      });

      await handleTranscription(wsHandler, session, transcriptText, llmClient);

      // Should complete successfully
      expect(session.conversationHistory.length).toBeGreaterThan(0);
      const assistantMessage = session.conversationHistory.find(msg => msg.role === 'assistant');
      expect(assistantMessage).toBeDefined();
    });

    test('should handle calculate tool', async () => {
      const transcriptText = 'What is 15 times 7?';

      session.transition('start');
      session.transition('silence_detected');

      llmClient.streamChat.mockImplementation(async (messages, onToken, model, tools, onToolCall) => {
        const toolCall = {
          function: {
            name: 'calculate',
            arguments: { expression: '15 * 7' }
          }
        };

        if (onToolCall) {
          await onToolCall(toolCall);
        }

        onToken('The result of 15 times 7 is 105.');
      });

      await handleTranscription(wsHandler, session, transcriptText, llmClient);

      expect(session.conversationHistory.length).toBeGreaterThan(0);
    });

    test('should handle tool execution errors gracefully', async () => {
      const transcriptText = 'Get weather without location';

      session.transition('start');
      session.transition('silence_detected');

      llmClient.streamChat.mockImplementation(async (messages, onToken, model, tools, onToolCall) => {
        const toolCall = {
          function: {
            name: 'get_weather',
            arguments: {} // Missing required location
          }
        };

        if (onToolCall) {
          try {
            await onToolCall(toolCall);
          } catch (error) {
            // Tool execution failed, LLM should handle it
            onToken('I need to know which location you want weather for.');
          }
        }
      });

      await handleTranscription(wsHandler, session, transcriptText, llmClient);

      // Should handle error and continue
      expect(session.conversationHistory.length).toBeGreaterThan(0);
    });

    test('should continue conversation after tool execution', async () => {
      const transcriptText = 'What time is it in London?';

      session.transition('start');
      session.transition('silence_detected');

      let toolExecuted = false;

      llmClient.streamChat.mockImplementation(async (messages, onToken, model, tools, onToolCall) => {
        // First, execute tool
        const toolCall = {
          function: {
            name: 'get_current_time',
            arguments: { timezone: 'Europe/London' }
          }
        };

        if (onToolCall) {
          await onToolCall(toolCall);
          toolExecuted = true;
        }

        // Then stream response
        onToken('The time in London is 7:30 PM.');
      });

      await handleTranscription(wsHandler, session, transcriptText, llmClient);

      // Tool should have been executed
      expect(toolExecuted).toBe(true);

      // Response should be in history - get the last assistant message (after tool call)
      const assistantMessages = session.conversationHistory.filter(msg => msg.role === 'assistant');
      expect(assistantMessages.length).toBeGreaterThan(0);

      // The last assistant message should be the actual response
      const lastAssistantMessage = assistantMessages[assistantMessages.length - 1];
      expect(lastAssistantMessage.content).toContain('London');
    });
  });

  describe('TTS Triggering', () => {
    test('should trigger TTS after LLM completes', async () => {
      const transcriptText = 'Say hello';
      const response = 'Hello there!';

      session.transition('start');
      session.transition('silence_detected');

      llmClient.streamChat.mockImplementation(async (messages, onToken) => {
        onToken(response);
      });

      await handleTranscription(wsHandler, session, transcriptText, llmClient);

      // After LLM completes, should transition to speaking state
      expect(session.getState()).toBe('speaking');

      // Should send state change to speaking
      const stateChangeCalls = mockWs.send.mock.calls.filter(call => {
        const message = JSON.parse(call[0]);
        return message.type === 'state_change' && message.state === 'speaking';
      });

      expect(stateChangeCalls.length).toBeGreaterThan(0);
    });

    test('should not trigger TTS on empty response', async () => {
      const transcriptText = 'Silent response';

      session.transition('start');
      session.transition('silence_detected');

      llmClient.streamChat.mockImplementation(async (messages, onToken) => {
        // Empty response
      });

      await handleTranscription(wsHandler, session, transcriptText, llmClient);

      // Should handle empty response gracefully
      expect(session.conversationHistory.length).toBeGreaterThan(0);
    });
  });
});
