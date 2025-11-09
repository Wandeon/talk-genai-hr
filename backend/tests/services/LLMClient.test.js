const axios = require('axios');
const LLMClient = require('../../lib/services/LLMClient');
const { EventEmitter } = require('events');

jest.mock('axios');

describe('LLMClient', () => {
  let client;
  const baseURL = 'http://localhost:11434';

  beforeEach(() => {
    client = new LLMClient(baseURL);
    jest.clearAllMocks();
  });

  describe('streamChat', () => {
    it('should stream chat response with token callback', async () => {
      const messages = [{ role: 'user', content: 'Hello' }];
      const tokens = [];
      const onToken = jest.fn((token) => tokens.push(token));

      // Mock stream response
      const mockStream = new EventEmitter();
      const mockResponse = {
        data: mockStream
      };

      axios.post.mockResolvedValue(mockResponse);

      // Start streaming
      const streamPromise = client.streamChat(messages, onToken);

      // Simulate stream events
      setImmediate(() => {
        mockStream.emit('data', Buffer.from('{"message":{"content":"Hello"}}\n'));
        mockStream.emit('data', Buffer.from('{"message":{"content":" world"}}\n'));
        mockStream.emit('data', Buffer.from('{"done":true}\n'));
        mockStream.emit('end');
      });

      await streamPromise;

      expect(axios.post).toHaveBeenCalledWith(
        `${baseURL}/api/chat`,
        {
          model: 'llama3.2',
          messages,
          tools: [],
          stream: true
        },
        {
          responseType: 'stream',
          timeout: 60000
        }
      );

      expect(onToken).toHaveBeenCalledTimes(2);
      expect(tokens).toEqual(['Hello', ' world']);
    });

    it('should handle custom model parameter', async () => {
      const messages = [{ role: 'user', content: 'Test' }];
      const onToken = jest.fn();
      const customModel = 'llama3.1';

      const mockStream = new EventEmitter();
      const mockResponse = { data: mockStream };
      axios.post.mockResolvedValue(mockResponse);

      const streamPromise = client.streamChat(messages, onToken, customModel);

      setImmediate(() => {
        mockStream.emit('data', Buffer.from('{"message":{"content":"Response"}}\n'));
        mockStream.emit('data', Buffer.from('{"done":true}\n'));
        mockStream.emit('end');
      });

      await streamPromise;

      expect(axios.post).toHaveBeenCalledWith(
        `${baseURL}/api/chat`,
        expect.objectContaining({
          model: customModel
        }),
        expect.any(Object)
      );
    });

    it('should handle tool calls with callback', async () => {
      const messages = [{ role: 'user', content: 'What is the weather?' }];
      const onToken = jest.fn();
      const onToolCall = jest.fn();
      const tools = [{ type: 'function', function: { name: 'get_weather' } }];

      const mockStream = new EventEmitter();
      const mockResponse = { data: mockStream };
      axios.post.mockResolvedValue(mockResponse);

      const streamPromise = client.streamChat(messages, onToken, 'llama3.2', tools, onToolCall);

      const toolCall = {
        function: {
          name: 'get_weather',
          arguments: '{"location":"San Francisco"}'
        }
      };

      setImmediate(() => {
        mockStream.emit('data', Buffer.from(JSON.stringify({
          message: {
            tool_calls: [toolCall]
          }
        }) + '\n'));
        mockStream.emit('data', Buffer.from('{"done":true}\n'));
        mockStream.emit('end');
      });

      await streamPromise;

      expect(axios.post).toHaveBeenCalledWith(
        `${baseURL}/api/chat`,
        expect.objectContaining({
          tools
        }),
        expect.any(Object)
      );

      expect(onToolCall).toHaveBeenCalledWith(toolCall);
    });

    it('should handle incomplete JSON lines with buffer', async () => {
      const messages = [{ role: 'user', content: 'Test' }];
      const tokens = [];
      const onToken = jest.fn((token) => tokens.push(token));

      const mockStream = new EventEmitter();
      const mockResponse = { data: mockStream };
      axios.post.mockResolvedValue(mockResponse);

      const streamPromise = client.streamChat(messages, onToken);

      setImmediate(() => {
        // Send incomplete chunk
        mockStream.emit('data', Buffer.from('{"message":{"content":"First'));
        // Complete the line
        mockStream.emit('data', Buffer.from('"}}\n'));
        mockStream.emit('data', Buffer.from('{"message":{"content":" Second"}}\n'));
        mockStream.emit('data', Buffer.from('{"done":true}\n'));
        mockStream.emit('end');
      });

      await streamPromise;

      expect(tokens).toEqual(['First', ' Second']);
    });

    it('should handle chunk ending with newline', async () => {
      const messages = [{ role: 'user', content: 'Test' }];
      const tokens = [];
      const onToken = jest.fn((token) => tokens.push(token));

      const mockStream = new EventEmitter();
      const mockResponse = { data: mockStream };
      axios.post.mockResolvedValue(mockResponse);

      const streamPromise = client.streamChat(messages, onToken);

      setImmediate(() => {
        // Chunk ending with newline should leave buffer empty
        mockStream.emit('data', Buffer.from('{"message":{"content":"First"}}\n'));
        mockStream.emit('data', Buffer.from('{"message":{"content":" Second"}}\n'));
        mockStream.emit('data', Buffer.from('{"done":true}\n'));
        mockStream.emit('end');
      });

      await streamPromise;

      expect(tokens).toEqual(['First', ' Second']);
    });

    it('should ignore invalid JSON chunks', async () => {
      const messages = [{ role: 'user', content: 'Test' }];
      const tokens = [];
      const onToken = jest.fn((token) => tokens.push(token));

      const mockStream = new EventEmitter();
      const mockResponse = { data: mockStream };
      axios.post.mockResolvedValue(mockResponse);

      const streamPromise = client.streamChat(messages, onToken);

      setImmediate(() => {
        mockStream.emit('data', Buffer.from('invalid json\n'));
        mockStream.emit('data', Buffer.from('{"message":{"content":"Valid"}}\n'));
        mockStream.emit('data', Buffer.from('{"done":true}\n'));
        mockStream.emit('end');
      });

      await streamPromise;

      // Should only process valid JSON
      expect(tokens).toEqual(['Valid']);
    });

    it('should handle stream errors', async () => {
      const messages = [{ role: 'user', content: 'Test' }];
      const onToken = jest.fn();

      const mockStream = new EventEmitter();
      const mockResponse = { data: mockStream };
      axios.post.mockResolvedValue(mockResponse);

      const streamPromise = client.streamChat(messages, onToken);

      setImmediate(() => {
        mockStream.emit('error', new Error('Stream error'));
      });

      await expect(streamPromise).rejects.toThrow('Stream error');
    });

    it('should handle axios errors', async () => {
      const messages = [{ role: 'user', content: 'Test' }];
      const onToken = jest.fn();
      const error = new Error('Network error');

      axios.post.mockRejectedValue(error);

      await expect(client.streamChat(messages, onToken))
        .rejects
        .toThrow('LLM service error: Network error');
    });

    it('should handle API error responses with status code', async () => {
      const messages = [{ role: 'user', content: 'Test' }];
      const onToken = jest.fn();
      const error = {
        response: {
          data: { error: 'Model not found' },
          status: 404
        }
      };

      axios.post.mockRejectedValue(error);

      await expect(client.streamChat(messages, onToken))
        .rejects
        .toThrow('LLM streaming failed (404): Model not found');
    });

    it('should handle service unreachable errors', async () => {
      const messages = [{ role: 'user', content: 'Test' }];
      const onToken = jest.fn();
      const error = {
        request: {},
        message: 'ECONNREFUSED'
      };

      axios.post.mockRejectedValue(error);

      await expect(client.streamChat(messages, onToken))
        .rejects
        .toThrow('LLM service unreachable: ECONNREFUSED');
    });
  });

  describe('analyzeImage', () => {
    it('should analyze image with vision model', async () => {
      const imageBase64 = 'base64encodedimage';
      const prompt = 'What is in this image?';
      const mockResponse = {
        data: {
          message: {
            content: 'A cat sitting on a table'
          }
        }
      };

      axios.post.mockResolvedValue(mockResponse);

      const result = await client.analyzeImage(imageBase64, prompt);

      expect(axios.post).toHaveBeenCalledWith(
        `${baseURL}/api/chat`,
        {
          model: 'llama3.2-vision',
          messages: [
            {
              role: 'user',
              content: prompt,
              images: [imageBase64]
            }
          ],
          stream: false
        },
        {
          timeout: 60000
        }
      );

      expect(result).toBe('A cat sitting on a table');
    });

    it('should use custom vision model', async () => {
      const imageBase64 = 'base64encodedimage';
      const prompt = 'Describe this';
      const customModel = 'custom-vision';
      const mockResponse = {
        data: {
          message: {
            content: 'Description'
          }
        }
      };

      axios.post.mockResolvedValue(mockResponse);

      await client.analyzeImage(imageBase64, prompt, customModel);

      expect(axios.post).toHaveBeenCalledWith(
        `${baseURL}/api/chat`,
        expect.objectContaining({
          model: customModel
        }),
        expect.any(Object)
      );
    });

    it('should handle image analysis errors', async () => {
      const imageBase64 = 'base64encodedimage';
      const prompt = 'Test';
      const error = new Error('Analysis failed');

      axios.post.mockRejectedValue(error);

      await expect(client.analyzeImage(imageBase64, prompt))
        .rejects
        .toThrow('LLM service error: Analysis failed');
    });

    it('should handle API error responses', async () => {
      const imageBase64 = 'base64encodedimage';
      const prompt = 'Test';
      const error = {
        response: {
          data: { error: 'Invalid image format' },
          status: 400
        }
      };

      axios.post.mockRejectedValue(error);

      await expect(client.analyzeImage(imageBase64, prompt))
        .rejects
        .toThrow('LLM image analysis failed (400): Invalid image format');
    });
  });

  describe('checkHealth', () => {
    it('should check health and return models', async () => {
      const mockResponse = {
        data: {
          models: [
            { name: 'llama3.2' },
            { name: 'llama3.2-vision' }
          ]
        }
      };

      axios.get.mockResolvedValue(mockResponse);

      const result = await client.checkHealth();

      expect(axios.get).toHaveBeenCalledWith(
        `${baseURL}/api/tags`,
        {
          timeout: 2000
        }
      );

      expect(result).toEqual({
        status: 'ok',
        models: mockResponse.data.models
      });
    });

    it('should handle health check errors', async () => {
      const error = new Error('Service unavailable');

      axios.get.mockRejectedValue(error);

      await expect(client.checkHealth())
        .rejects
        .toThrow('LLM service error: Service unavailable');
    });

    it('should handle health check with error response', async () => {
      const error = {
        response: {
          data: { error: 'Service degraded' },
          status: 503
        }
      };

      axios.get.mockRejectedValue(error);

      await expect(client.checkHealth())
        .rejects
        .toThrow('LLM health check failed (503): Service degraded');
    });

    it('should handle health check unreachable errors', async () => {
      const error = {
        request: {},
        message: 'ETIMEDOUT'
      };

      axios.get.mockRejectedValue(error);

      await expect(client.checkHealth())
        .rejects
        .toThrow('LLM service unreachable: ETIMEDOUT');
    });
  });
});
