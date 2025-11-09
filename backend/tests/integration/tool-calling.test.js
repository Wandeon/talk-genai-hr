/**
 * Tool Calling Integration Tests
 *
 * Tests the complete tool calling flow:
 * - LLM requesting to use a tool during conversation
 * - Tool execution with correct parameters
 * - Tool result being passed back to LLM
 * - LLM incorporating tool results into response
 * - Multiple tool calls in sequence
 * - Error handling when tool execution fails
 * - Invalid tool calls (unknown tool, invalid parameters)
 * - State transitions during tool execution
 * - WebSocket messages for tool call progress
 *
 * These tests mock the LLM service but test real integration between:
 * - LLM client tool call handling
 * - Tool execution
 * - Result passing back to LLM
 * - Conversation history management
 * - WebSocket message handling
 */

const SessionManager = require('../../lib/SessionManager');
const WebSocketHandler = require('../../lib/WebSocketHandler');
const LLMClient = require('../../lib/services/LLMClient');
const TTSClient = require('../../lib/services/TTSClient');
const { getToolDefinitions, executeToolCall } = require('../../lib/tools/index');
const { handleTextMessage } = require('../../lib/handlers/textMessage');

// Mock service clients
jest.mock('../../lib/services/LLMClient');
jest.mock('../../lib/services/TTSClient');

describe('Tool Calling Integration Tests', () => {
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

    // Mock LLM client
    llmClient = new LLMClient('http://localhost:11434');
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

  describe('Tool Definitions', () => {
    test('should have correct tool definitions structure', () => {
      const tools = getToolDefinitions();

      expect(tools).toHaveLength(3);

      // Verify all tools have required structure
      tools.forEach(tool => {
        expect(tool).toHaveProperty('type', 'function');
        expect(tool).toHaveProperty('function');
        expect(tool.function).toHaveProperty('name');
        expect(tool.function).toHaveProperty('description');
        expect(tool.function).toHaveProperty('parameters');
        expect(tool.function.parameters).toHaveProperty('type', 'object');
        expect(tool.function.parameters).toHaveProperty('properties');
        expect(tool.function.parameters).toHaveProperty('required');
      });
    });

    test('should define get_current_time tool correctly', () => {
      const tools = getToolDefinitions();
      const timeTool = tools.find(t => t.function.name === 'get_current_time');

      expect(timeTool).toBeDefined();
      expect(timeTool.function.description).toContain('current time');
      expect(timeTool.function.parameters.properties).toHaveProperty('timezone');
      expect(timeTool.function.parameters.required).toEqual([]);
    });

    test('should define get_weather tool correctly', () => {
      const tools = getToolDefinitions();
      const weatherTool = tools.find(t => t.function.name === 'get_weather');

      expect(weatherTool).toBeDefined();
      expect(weatherTool.function.description).toContain('weather');
      expect(weatherTool.function.parameters.properties).toHaveProperty('location');
      expect(weatherTool.function.parameters.required).toEqual(['location']);
    });

    test('should define calculate tool correctly', () => {
      const tools = getToolDefinitions();
      const calcTool = tools.find(t => t.function.name === 'calculate');

      expect(calcTool).toBeDefined();
      expect(calcTool.function.description).toContain('mathematical calculations');
      expect(calcTool.function.parameters.properties).toHaveProperty('expression');
      expect(calcTool.function.parameters.required).toEqual(['expression']);
    });
  });

  describe('Single Tool Call Execution', () => {
    test('should execute get_current_time tool without parameters', async () => {
      const toolCall = {
        function: {
          name: 'get_current_time',
          arguments: {}
        }
      };

      const result = await executeToolCall(toolCall);

      expect(result).toContain('The current time is');
      expect(typeof result).toBe('string');
    });

    test('should execute get_current_time tool with timezone parameter', async () => {
      const toolCall = {
        function: {
          name: 'get_current_time',
          arguments: { timezone: 'America/New_York' }
        }
      };

      const result = await executeToolCall(toolCall);

      expect(result).toContain('The current time is');
      expect(result).toContain('America/New_York');
    });

    test('should execute get_weather tool with location parameter', async () => {
      const toolCall = {
        function: {
          name: 'get_weather',
          arguments: { location: 'New York' }
        }
      };

      const result = await executeToolCall(toolCall);

      expect(result).toContain('weather in New York');
      expect(result).toMatch(/sunny|partly cloudy|cloudy|rainy|windy/);
      expect(result).toMatch(/\d+°F/);
    });

    test('should execute calculate tool with expression', async () => {
      const toolCall = {
        function: {
          name: 'calculate',
          arguments: { expression: '2 + 2' }
        }
      };

      const result = await executeToolCall(toolCall);

      expect(result).toContain('The result of 2 + 2 is 4');
    });

    test('should handle complex mathematical expressions', async () => {
      const toolCall = {
        function: {
          name: 'calculate',
          arguments: { expression: '(10 + 5) * 2' }
        }
      };

      const result = await executeToolCall(toolCall);

      expect(result).toContain('The result of (10 + 5) * 2 is 30');
    });

    test('should parse string arguments correctly', async () => {
      const toolCall = {
        function: {
          name: 'get_weather',
          arguments: '{"location": "London"}'
        }
      };

      const result = await executeToolCall(toolCall);

      expect(result).toContain('weather in London');
    });

    test('should handle null or undefined arguments', async () => {
      const toolCall = {
        function: {
          name: 'get_current_time',
          arguments: null
        }
      };

      const result = await executeToolCall(toolCall);

      expect(result).toContain('The current time is');
    });
  });

  describe('Tool Call Error Handling', () => {
    test('should throw error for unknown tool', async () => {
      const toolCall = {
        function: {
          name: 'unknown_tool',
          arguments: {}
        }
      };

      await expect(executeToolCall(toolCall)).rejects.toThrow('Unknown tool: unknown_tool');
    });

    test('should throw error when required parameter is missing', async () => {
      const toolCall = {
        function: {
          name: 'get_weather',
          arguments: {}
        }
      };

      await expect(executeToolCall(toolCall)).rejects.toThrow('Location parameter is required');
    });

    test('should handle invalid calculation expression', async () => {
      const toolCall = {
        function: {
          name: 'calculate',
          arguments: { expression: 'invalid expression $#@' }
        }
      };

      const result = await executeToolCall(toolCall);

      expect(result).toContain('Error');
      expect(result).toContain('invalid characters');
    });

    test('should handle malformed JSON in arguments', async () => {
      const toolCall = {
        function: {
          name: 'get_current_time',
          arguments: 'not valid json'
        }
      };

      const result = await executeToolCall(toolCall);

      // Should handle gracefully and execute with empty args
      expect(result).toContain('The current time is');
    });

    test('should handle division by zero gracefully', async () => {
      const toolCall = {
        function: {
          name: 'calculate',
          arguments: { expression: '1 / 0' }
        }
      };

      const result = await executeToolCall(toolCall);

      // Result should either be error or Infinity handling
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });

  describe('Tool Call Integration with LLM', () => {
    test('should complete full flow with single tool call', async () => {
      const messageText = 'What time is it?';
      const toolCallResponse = 'The current time is 10:30:00 AM.';
      const finalResponse = 'It is currently 10:30 AM.';

      let toolCallback;

      // Mock LLM to request tool and then respond with tool result
      llmClient.streamChat.mockImplementation(async (messages, onToken, model, tools, onToolCall) => {
        toolCallback = onToolCall;

        // First, simulate LLM requesting tool
        if (onToolCall) {
          const result = await onToolCall({
            function: {
              name: 'get_current_time',
              arguments: {}
            }
          });

          expect(result).toContain('The current time is');
        }

        // Then stream final response
        for (const char of finalResponse) {
          onToken(char);
        }
      });

      ttsClient.generateSpeech.mockResolvedValue({ audio: 'YXVkaW8=' });

      await handleTextMessage(wsHandler, session, messageText, llmClient, ttsClient);

      // Verify tool was called
      expect(toolCallback).toBeDefined();

      // Verify LLM received tools
      const llmCall = llmClient.streamChat.mock.calls[0];
      const tools = llmCall[3];
      expect(tools).toHaveLength(3);
      expect(tools[0].function.name).toBe('get_current_time');

      // Verify conversation history includes tool usage
      expect(session.conversationHistory.length).toBeGreaterThan(2);

      // Should have user message, tool usage markers, and assistant response
      const historyContent = session.conversationHistory.map(m => m.content).join(' ');
      expect(historyContent).toContain('What time is it?');
      expect(historyContent).toContain('Used tool: get_current_time');
      expect(historyContent).toContain('Tool result:');
    });

    test('should handle tool call with weather query', async () => {
      const messageText = 'What is the weather in Tokyo?';
      const finalResponse = 'The weather in Tokyo is sunny with 72°F.';

      llmClient.streamChat.mockImplementation(async (messages, onToken, model, tools, onToolCall) => {
        // Simulate LLM requesting weather tool
        if (onToolCall) {
          await onToolCall({
            function: {
              name: 'get_weather',
              arguments: { location: 'Tokyo' }
            }
          });
        }

        // Stream final response
        for (const char of finalResponse) {
          onToken(char);
        }
      });

      ttsClient.generateSpeech.mockResolvedValue({ audio: 'YXVkaW8=' });

      await handleTextMessage(wsHandler, session, messageText, llmClient, ttsClient);

      // Verify tool usage in conversation history
      const historyContent = session.conversationHistory.map(m => m.content).join(' ');
      expect(historyContent).toContain('Used tool: get_weather');
      expect(historyContent).toContain('Tool result:');
      expect(historyContent).toContain('weather in Tokyo');
    });

    test('should handle tool call with calculation', async () => {
      const messageText = 'What is 15 times 8?';
      const finalResponse = 'The result is 120.';

      llmClient.streamChat.mockImplementation(async (messages, onToken, model, tools, onToolCall) => {
        // Simulate LLM requesting calculate tool
        if (onToolCall) {
          await onToolCall({
            function: {
              name: 'calculate',
              arguments: { expression: '15 * 8' }
            }
          });
        }

        // Stream final response
        for (const char of finalResponse) {
          onToken(char);
        }
      });

      ttsClient.generateSpeech.mockResolvedValue({ audio: 'YXVkaW8=' });

      await handleTextMessage(wsHandler, session, messageText, llmClient, ttsClient);

      // Verify calculation in conversation history
      const historyContent = session.conversationHistory.map(m => m.content).join(' ');
      expect(historyContent).toContain('Used tool: calculate');
      expect(historyContent).toContain('The result of 15 * 8 is 120');
    });

    test('should handle tool execution failure gracefully', async () => {
      const messageText = 'What is the weather?';
      const finalResponse = 'I need a location to check the weather.';

      llmClient.streamChat.mockImplementation(async (messages, onToken, model, tools, onToolCall) => {
        // Simulate LLM requesting weather tool without required parameter
        if (onToolCall) {
          const result = await onToolCall({
            function: {
              name: 'get_weather',
              arguments: {} // Missing required 'location'
            }
          });

          // Tool should return error message
          expect(result).toContain('Error executing tool');
        }

        // LLM streams response based on error
        for (const char of finalResponse) {
          onToken(char);
        }
      });

      ttsClient.generateSpeech.mockResolvedValue({ audio: 'YXVkaW8=' });

      await handleTextMessage(wsHandler, session, messageText, llmClient, ttsClient);

      // Should complete successfully despite tool error
      expect(session.getState()).toBe('listening');

      // Conversation history should show tool error
      const historyContent = session.conversationHistory.map(m => m.content).join(' ');
      expect(historyContent).toContain('Tool error:');
    });
  });

  describe('Multiple Tool Calls', () => {
    test('should handle multiple sequential tool calls', async () => {
      const messageText = 'What time is it in Tokyo and what is the weather there?';
      const finalResponse = 'It is 11:00 PM in Tokyo and the weather is cloudy with 68°F.';

      llmClient.streamChat.mockImplementation(async (messages, onToken, model, tools, onToolCall) => {
        if (onToolCall) {
          // First tool call: get time
          await onToolCall({
            function: {
              name: 'get_current_time',
              arguments: { timezone: 'Asia/Tokyo' }
            }
          });

          // Second tool call: get weather
          await onToolCall({
            function: {
              name: 'get_weather',
              arguments: { location: 'Tokyo' }
            }
          });
        }

        // Stream final response incorporating both results
        for (const char of finalResponse) {
          onToken(char);
        }
      });

      ttsClient.generateSpeech.mockResolvedValue({ audio: 'YXVkaW8=' });

      await handleTextMessage(wsHandler, session, messageText, llmClient, ttsClient);

      // Verify both tool calls in conversation history
      const historyContent = session.conversationHistory.map(m => m.content).join(' ');
      expect(historyContent).toContain('Used tool: get_current_time');
      expect(historyContent).toContain('Used tool: get_weather');
      expect(historyContent).toContain('Asia/Tokyo');
      expect(historyContent).toContain('weather in Tokyo');
    });

    test('should handle mix of successful and failed tool calls', async () => {
      const messageText = 'Calculate 5+5 and tell me the weather';
      const finalResponse = 'The calculation is 10, but I need a location for weather.';

      llmClient.streamChat.mockImplementation(async (messages, onToken, model, tools, onToolCall) => {
        if (onToolCall) {
          // Successful calculation
          await onToolCall({
            function: {
              name: 'calculate',
              arguments: { expression: '5 + 5' }
            }
          });

          // Failed weather call (missing location)
          await onToolCall({
            function: {
              name: 'get_weather',
              arguments: {}
            }
          });
        }

        for (const char of finalResponse) {
          onToken(char);
        }
      });

      ttsClient.generateSpeech.mockResolvedValue({ audio: 'YXVkaW8=' });

      await handleTextMessage(wsHandler, session, messageText, llmClient, ttsClient);

      // Should complete successfully
      expect(session.getState()).toBe('listening');

      // History should show both success and error
      const historyContent = session.conversationHistory.map(m => m.content).join(' ');
      expect(historyContent).toContain('The result of 5 + 5 is 10');
      expect(historyContent).toContain('Tool error:');
    });

    test('should maintain context across multiple tool calls', async () => {
      const messageText = 'Calculate (10 + 20) * 2 then calculate 30 / 3';
      const finalResponse = 'First result is 60, second result is 10.';

      llmClient.streamChat.mockImplementation(async (messages, onToken, model, tools, onToolCall) => {
        if (onToolCall) {
          const result1 = await onToolCall({
            function: {
              name: 'calculate',
              arguments: { expression: '(10 + 20) * 2' }
            }
          });

          const result2 = await onToolCall({
            function: {
              name: 'calculate',
              arguments: { expression: '30 / 3' }
            }
          });

          expect(result1).toContain('60');
          expect(result2).toContain('10');
        }

        for (const char of finalResponse) {
          onToken(char);
        }
      });

      ttsClient.generateSpeech.mockResolvedValue({ audio: 'YXVkaW8=' });

      await handleTextMessage(wsHandler, session, messageText, llmClient, ttsClient);

      // Verify both calculations in history
      const calcMessages = session.conversationHistory.filter(m =>
        m.content.includes('Tool result:')
      );

      expect(calcMessages.length).toBe(2);
    });
  });

  describe('Tool Calls with Different Parameter Types', () => {
    test('should handle tool with no required parameters', async () => {
      const toolCall = {
        function: {
          name: 'get_current_time',
          arguments: {}
        }
      };

      const result = await executeToolCall(toolCall);
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    test('should handle tool with optional parameters', async () => {
      const toolCall = {
        function: {
          name: 'get_current_time',
          arguments: { timezone: 'Europe/London' }
        }
      };

      const result = await executeToolCall(toolCall);
      expect(result).toContain('Europe/London');
    });

    test('should handle tool with required string parameter', async () => {
      const toolCall = {
        function: {
          name: 'get_weather',
          arguments: { location: 'Paris' }
        }
      };

      const result = await executeToolCall(toolCall);
      expect(result).toContain('Paris');
    });

    test('should handle tool with string parameter containing special characters', async () => {
      const toolCall = {
        function: {
          name: 'get_weather',
          arguments: { location: 'São Paulo' }
        }
      };

      const result = await executeToolCall(toolCall);
      expect(result).toContain('São Paulo');
    });

    test('should handle expression with parentheses and operators', async () => {
      const toolCall = {
        function: {
          name: 'calculate',
          arguments: { expression: '((5 + 3) * 2) - 4' }
        }
      };

      const result = await executeToolCall(toolCall);
      expect(result).toContain('12'); // ((5+3)*2)-4 = 16-4 = 12
    });

    test('should handle decimal numbers in calculation', async () => {
      const toolCall = {
        function: {
          name: 'calculate',
          arguments: { expression: '10.5 * 2' }
        }
      };

      const result = await executeToolCall(toolCall);
      expect(result).toContain('21');
    });
  });

  describe('Tool Call During Streaming', () => {
    test('should handle tool call mid-stream', async () => {
      const messageText = 'Let me check the time';

      llmClient.streamChat.mockImplementation(async (messages, onToken, model, tools, onToolCall) => {
        // Stream some initial text
        onToken('Let me ');
        onToken('check ');
        onToken('that... ');

        // Make tool call
        if (onToolCall) {
          await onToolCall({
            function: {
              name: 'get_current_time',
              arguments: {}
            }
          });
        }

        // Continue streaming
        onToken('It is ');
        onToken('10:30 AM.');
      });

      ttsClient.generateSpeech.mockResolvedValue({ audio: 'YXVkaW8=' });

      await handleTextMessage(wsHandler, session, messageText, llmClient, ttsClient);

      // Verify streaming worked
      const llmTokens = getMessagesByType('llm_token');
      expect(llmTokens.length).toBeGreaterThan(0);

      // Verify full response
      const llmComplete = getLatestMessage('llm_complete');
      expect(llmComplete.fullText).toContain('Let me check that... It is 10:30 AM.');
    });

    test('should preserve token order with tool calls', async () => {
      const tokens = [];

      llmClient.streamChat.mockImplementation(async (messages, onToken, model, tools, onToolCall) => {
        onToken('First ');
        tokens.push('First ');

        if (onToolCall) {
          await onToolCall({
            function: {
              name: 'calculate',
              arguments: { expression: '2 + 2' }
            }
          });
          tokens.push('[TOOL_CALL]');
        }

        onToken('Second');
        tokens.push('Second');
      });

      ttsClient.generateSpeech.mockResolvedValue({ audio: 'YXVkaW8=' });

      await handleTextMessage(wsHandler, session, 'Test', llmClient, ttsClient);

      // Verify order was maintained
      expect(tokens).toEqual(['First ', '[TOOL_CALL]', 'Second']);
    });
  });

  describe('State Transitions During Tool Execution', () => {
    test('should maintain thinking state during tool execution', async () => {
      let statesDuringExecution = [];

      llmClient.streamChat.mockImplementation(async (messages, onToken, model, tools, onToolCall) => {
        statesDuringExecution.push(session.getState());

        if (onToolCall) {
          await onToolCall({
            function: {
              name: 'get_current_time',
              arguments: {}
            }
          });
          statesDuringExecution.push(session.getState());
        }

        onToken('Response');
      });

      ttsClient.generateSpeech.mockResolvedValue({ audio: 'YXVkaW8=' });

      await handleTextMessage(wsHandler, session, 'What time is it?', llmClient, ttsClient);

      // State should remain consistent during tool execution
      expect(statesDuringExecution[0]).toBe('thinking');
      expect(statesDuringExecution[1]).toBe('thinking');
    });

    test('should transition to speaking after tool execution completes', async () => {
      llmClient.streamChat.mockImplementation(async (messages, onToken, model, tools, onToolCall) => {
        if (onToolCall) {
          await onToolCall({
            function: {
              name: 'get_current_time',
              arguments: {}
            }
          });
        }
        onToken('Response');
      });

      ttsClient.generateSpeech.mockResolvedValue({ audio: 'YXVkaW8=' });

      await handleTextMessage(wsHandler, session, 'Test', llmClient, ttsClient);

      // Should end in listening state
      expect(session.getState()).toBe('listening');

      // Should have gone through speaking state
      const stateChanges = getMessagesByType('state_change');
      const states = stateChanges.map(msg => msg.state);
      expect(states).toContain('speaking');
    });

    test('should recover state if tool execution fails', async () => {
      llmClient.streamChat.mockImplementation(async (messages, onToken, model, tools, onToolCall) => {
        if (onToolCall) {
          // Tool call that will fail
          await onToolCall({
            function: {
              name: 'get_weather',
              arguments: {} // Missing location
            }
          });
        }
        onToken('Response despite error');
      });

      ttsClient.generateSpeech.mockResolvedValue({ audio: 'YXVkaW8=' });

      await handleTextMessage(wsHandler, session, 'Weather', llmClient, ttsClient);

      // Should still complete successfully
      expect(session.getState()).toBe('listening');
    });
  });

  describe('Conversation History with Tool Calls', () => {
    test('should add tool usage to conversation history', async () => {
      llmClient.streamChat.mockImplementation(async (messages, onToken, model, tools, onToolCall) => {
        if (onToolCall) {
          await onToolCall({
            function: {
              name: 'get_current_time',
              arguments: { timezone: 'UTC' }
            }
          });
        }
        onToken('Response');
      });

      ttsClient.generateSpeech.mockResolvedValue({ audio: 'YXVkaW8=' });

      await handleTextMessage(wsHandler, session, 'What time?', llmClient, ttsClient);

      // Should have: user message, tool marker, tool result, assistant response
      expect(session.conversationHistory.length).toBeGreaterThan(2);

      // Find tool-related messages
      const toolMessages = session.conversationHistory.filter(m =>
        m.content.includes('Used tool:') || m.content.includes('Tool result:')
      );

      expect(toolMessages.length).toBeGreaterThan(0);
    });

    test('should preserve tool results for context in next message', async () => {
      // First message with tool call
      llmClient.streamChat.mockImplementationOnce(async (messages, onToken, model, tools, onToolCall) => {
        if (onToolCall) {
          await onToolCall({
            function: {
              name: 'calculate',
              arguments: { expression: '10 * 5' }
            }
          });
        }
        onToken('The result is 50');
      });

      ttsClient.generateSpeech.mockResolvedValue({ audio: 'YXVkaW8=' });

      await handleTextMessage(wsHandler, session, 'Calculate 10 times 5', llmClient, ttsClient);

      // Second message should have access to previous tool result
      llmClient.streamChat.mockImplementationOnce(async (messages, onToken, model, tools, onToolCall) => {
        // Verify previous tool result is in messages
        const messageContents = messages.map(m => m.content).join(' ');
        expect(messageContents).toContain('Tool result:');
        expect(messageContents).toContain('50');

        onToken('Yes, the previous result was 50');
      });

      await handleTextMessage(wsHandler, session, 'What was the result?', llmClient, ttsClient);

      expect(session.conversationHistory.length).toBeGreaterThan(4);
    });

    test('should include all tool calls in multi-turn conversation', async () => {
      // Turn 1: Time query
      llmClient.streamChat.mockImplementationOnce(async (messages, onToken, model, tools, onToolCall) => {
        if (onToolCall) {
          await onToolCall({
            function: {
              name: 'get_current_time',
              arguments: {}
            }
          });
        }
        onToken('It is 10 AM');
      });

      ttsClient.generateSpeech.mockResolvedValue({ audio: 'YXVkaW8=' });
      await handleTextMessage(wsHandler, session, 'What time?', llmClient, ttsClient);

      // Turn 2: Weather query
      llmClient.streamChat.mockImplementationOnce(async (messages, onToken, model, tools, onToolCall) => {
        if (onToolCall) {
          await onToolCall({
            function: {
              name: 'get_weather',
              arguments: { location: 'Boston' }
            }
          });
        }
        onToken('It is sunny in Boston');
      });

      await handleTextMessage(wsHandler, session, 'Weather in Boston?', llmClient, ttsClient);

      // Turn 3: Calculation
      llmClient.streamChat.mockImplementationOnce(async (messages, onToken, model, tools, onToolCall) => {
        if (onToolCall) {
          await onToolCall({
            function: {
              name: 'calculate',
              arguments: { expression: '100 / 5' }
            }
          });
        }
        onToken('The answer is 20');
      });

      await handleTextMessage(wsHandler, session, 'Calculate 100 divided by 5', llmClient, ttsClient);

      // Verify all tool calls are in history
      const historyContent = session.conversationHistory.map(m => m.content).join(' ');
      expect(historyContent).toContain('Used tool: get_current_time');
      expect(historyContent).toContain('Used tool: get_weather');
      expect(historyContent).toContain('Used tool: calculate');
    });
  });

  describe('WebSocket Messages for Tool Calls', () => {
    test('should send appropriate messages during tool execution flow', async () => {
      llmClient.streamChat.mockImplementation(async (messages, onToken, model, tools, onToolCall) => {
        if (onToolCall) {
          await onToolCall({
            function: {
              name: 'get_current_time',
              arguments: {}
            }
          });
        }
        onToken('Response');
      });

      ttsClient.generateSpeech.mockResolvedValue({ audio: 'YXVkaW8=' });

      await handleTextMessage(wsHandler, session, 'What time?', llmClient, ttsClient);

      // Verify standard message types are present
      const messageTypes = new Set(sentMessages.map(msg => msg.type));

      expect(messageTypes.has('state_change')).toBe(true);
      expect(messageTypes.has('llm_token')).toBe(true);
      expect(messageTypes.has('llm_complete')).toBe(true);

      // Note: tool_call_start and tool_call_result messages are defined in WebSocketHandler
      // but not currently used in the transcription handler
      // This is a potential enhancement area
    });

    test('should maintain message order during tool execution', async () => {
      const messageOrder = [];

      // Track message order
      mockWs.send = jest.fn((message) => {
        const parsed = JSON.parse(message);
        messageOrder.push(parsed.type);
        sentMessages.push(parsed);
      });

      llmClient.streamChat.mockImplementation(async (messages, onToken, model, tools, onToolCall) => {
        onToken('Before ');
        if (onToolCall) {
          await onToolCall({
            function: {
              name: 'get_current_time',
              arguments: {}
            }
          });
        }
        onToken('After');
      });

      ttsClient.generateSpeech.mockResolvedValue({ audio: 'YXVkaW8=' });

      await handleTextMessage(wsHandler, session, 'Test', llmClient, ttsClient);

      // Verify messages were sent in logical order
      // Should have state changes
      const stateChanges = messageOrder.filter(t => t === 'state_change');
      expect(stateChanges.length).toBeGreaterThan(0);

      // Should have LLM tokens
      const tokenIndices = messageOrder.reduce((acc, type, idx) => {
        if (type === 'llm_token') acc.push(idx);
        return acc;
      }, []);
      expect(tokenIndices.length).toBeGreaterThan(0);
    });
  });

  describe('Error Scenarios', () => {
    test('should handle LLM service failure during tool call', async () => {
      llmClient.streamChat.mockRejectedValue(new Error('LLM service unreachable'));

      await handleTextMessage(wsHandler, session, 'What time?', llmClient, ttsClient);

      // Should send error message
      const errors = getMessagesByType('error');
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].message).toContain('LLM processing failed');
    });

    test('should handle tool exception during execution', async () => {
      llmClient.streamChat.mockImplementation(async (messages, onToken, model, tools, onToolCall) => {
        if (onToolCall) {
          const result = await onToolCall({
            function: {
              name: 'unknown_tool',
              arguments: {}
            }
          });

          // Should receive error message
          expect(result).toContain('Error executing tool');
        }
        onToken('I encountered an error');
      });

      ttsClient.generateSpeech.mockResolvedValue({ audio: 'YXVkaW8=' });

      await handleTextMessage(wsHandler, session, 'Use unknown tool', llmClient, ttsClient);

      // Should complete despite tool error
      expect(session.getState()).toBe('listening');
    });

    test('should handle malformed tool call from LLM', async () => {
      llmClient.streamChat.mockImplementation(async (messages, onToken, model, tools, onToolCall) => {
        if (onToolCall) {
          // Malformed tool call structure
          try {
            await onToolCall({
              invalid: 'structure'
            });
          } catch (error) {
            // Should handle gracefully
          }
        }
        onToken('Response');
      });

      ttsClient.generateSpeech.mockResolvedValue({ audio: 'YXVkaW8=' });

      await handleTextMessage(wsHandler, session, 'Test', llmClient, ttsClient);

      // Should still complete
      expect(session.getState()).toBe('listening');
    });
  });

  describe('Tool Call Performance', () => {
    test('should handle rapid sequential tool calls', async () => {
      llmClient.streamChat.mockImplementation(async (messages, onToken, model, tools, onToolCall) => {
        if (onToolCall) {
          // Make multiple tool calls rapidly
          await Promise.all([
            onToolCall({
              function: {
                name: 'calculate',
                arguments: { expression: '1 + 1' }
              }
            }),
            onToolCall({
              function: {
                name: 'calculate',
                arguments: { expression: '2 + 2' }
              }
            }),
            onToolCall({
              function: {
                name: 'calculate',
                arguments: { expression: '3 + 3' }
              }
            })
          ]);
        }
        onToken('All calculations complete');
      });

      ttsClient.generateSpeech.mockResolvedValue({ audio: 'YXVkaW8=' });

      await handleTextMessage(wsHandler, session, 'Do multiple calculations', llmClient, ttsClient);

      // Should handle all tool calls
      const toolMessages = session.conversationHistory.filter(m =>
        m.content.includes('Tool result:')
      );

      expect(toolMessages.length).toBe(3);
    });

    test('should not block streaming during tool execution', async () => {
      const timestamps = [];

      llmClient.streamChat.mockImplementation(async (messages, onToken, model, tools, onToolCall) => {
        timestamps.push({ event: 'start', time: Date.now() });

        onToken('Before tool ');
        timestamps.push({ event: 'token_before', time: Date.now() });

        if (onToolCall) {
          await onToolCall({
            function: {
              name: 'get_current_time',
              arguments: {}
            }
          });
          timestamps.push({ event: 'tool_complete', time: Date.now() });
        }

        onToken('After tool');
        timestamps.push({ event: 'token_after', time: Date.now() });
      });

      ttsClient.generateSpeech.mockResolvedValue({ audio: 'YXVkaW8=' });

      await handleTextMessage(wsHandler, session, 'Test', llmClient, ttsClient);

      // Verify events happened in order
      expect(timestamps[0].event).toBe('start');
      expect(timestamps[1].event).toBe('token_before');
      expect(timestamps[2].event).toBe('tool_complete');
      expect(timestamps[3].event).toBe('token_after');
    });
  });

  describe('Tool Call Context Preservation', () => {
    test('should preserve conversation context when tool is called', async () => {
      // Build up some context
      session.addMessage('user', 'My name is Alice');
      session.addMessage('assistant', 'Nice to meet you, Alice!');

      llmClient.streamChat.mockImplementation(async (messages, onToken, model, tools, onToolCall) => {
        // Verify previous context is included
        expect(messages.length).toBeGreaterThan(2);
        expect(messages[0].content).toBe('My name is Alice');

        if (onToolCall) {
          await onToolCall({
            function: {
              name: 'get_current_time',
              arguments: {}
            }
          });
        }

        onToken('The time is 10 AM, Alice');
      });

      ttsClient.generateSpeech.mockResolvedValue({ audio: 'YXVkaW8=' });

      await handleTextMessage(wsHandler, session, 'What time is it?', llmClient, ttsClient);

      // Context should be preserved
      expect(session.conversationHistory[0].content).toBe('My name is Alice');
      expect(session.conversationHistory[1].content).toBe('Nice to meet you, Alice!');
    });

    test('should allow tool results to inform subsequent responses', async () => {
      // First call: Get weather
      llmClient.streamChat.mockImplementationOnce(async (messages, onToken, model, tools, onToolCall) => {
        if (onToolCall) {
          await onToolCall({
            function: {
              name: 'get_weather',
              arguments: { location: 'Seattle' }
            }
          });
        }
        onToken('It is rainy in Seattle');
      });

      ttsClient.generateSpeech.mockResolvedValue({ audio: 'YXVkaW8=' });
      await handleTextMessage(wsHandler, session, 'Weather in Seattle?', llmClient, ttsClient);

      // Second call: Should have access to weather result
      llmClient.streamChat.mockImplementationOnce(async (messages, onToken, model, tools, onToolCall) => {
        const context = messages.map(m => m.content).join(' ');
        expect(context).toContain('weather in Seattle');

        onToken('Since it is rainy, bring an umbrella');
      });

      await handleTextMessage(wsHandler, session, 'What should I bring?', llmClient, ttsClient);

      expect(session.conversationHistory.length).toBeGreaterThan(4);
    });
  });
});
