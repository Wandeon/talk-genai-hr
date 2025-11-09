const axios = require('axios');

/**
 * Client for communicating with the LLM service (Ollama)
 */
class LLMClient {
  constructor(baseURL) {
    this.baseURL = baseURL;
  }

  /**
   * Stream chat responses with token-by-token callback
   * @param {Array} messages - Chat messages array
   * @param {Function} onToken - Callback for each token: (content) => void
   * @param {string} model - Model name (default: 'llama3.2')
   * @param {Array} tools - Tool definitions for function calling
   * @param {Function} onToolCall - Callback for tool calls: (toolCall) => void
   * @returns {Promise<void>} Resolves when stream completes
   */
  async streamChat(messages, onToken, model = 'llama3.2', tools = [], onToolCall = null) {
    try {
      const response = await axios.post(
        `${this.baseURL}/api/chat`,
        {
          model,
          messages,
          tools,
          stream: true
        },
        {
          responseType: 'stream',
          timeout: 60000
        }
      );

      return new Promise((resolve, reject) => {
        const stream = response.data;
        let buffer = '';

        stream.on('data', (chunk) => {
          buffer += chunk.toString();

          // Process complete lines
          const lines = buffer.split('\n');
          // Keep last incomplete line in buffer
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.trim()) continue;

            try {
              const data = JSON.parse(line);

              // Handle token content
              if (data.message?.content) {
                onToken(data.message.content);
              }

              // Handle tool calls
              if (data.message?.tool_calls && onToolCall) {
                for (const toolCall of data.message.tool_calls) {
                  onToolCall(toolCall);
                }
              }

              // Check if done
              if (data.done) {
                resolve();
              }
            } catch (parseError) {
              // Ignore JSON parse errors for partial chunks
              // This is expected for streaming responses
            }
          }
        });

        stream.on('end', () => {
          resolve();
        });

        stream.on('error', (error) => {
          reject(error);
        });
      });
    } catch (error) {
      if (error.response) {
        // Server responded with error status
        throw new Error(
          `LLM streaming failed (${error.response.status}): ${error.response.data?.error || error.message}`
        );
      } else if (error.request) {
        // Request made but no response
        throw new Error(`LLM service unreachable: ${error.message}`);
      } else {
        // Error setting up request
        throw new Error(`LLM streaming failed: ${error.message}`);
      }
    }
  }

  /**
   * Analyze an image using vision model
   * @param {string} imageBase64 - Base64-encoded image
   * @param {string} prompt - Analysis prompt
   * @param {string} model - Vision model name (default: 'llama3.2-vision')
   * @returns {Promise<string>} Analysis result text
   */
  async analyzeImage(imageBase64, prompt, model = 'llama3.2-vision') {
    try {
      const response = await axios.post(
        `${this.baseURL}/api/chat`,
        {
          model,
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

      return response.data.message.content;
    } catch (error) {
      if (error.response) {
        // Server responded with error status
        throw new Error(
          `LLM image analysis failed (${error.response.status}): ${error.response.data?.error || error.message}`
        );
      } else if (error.request) {
        // Request made but no response
        throw new Error(`LLM service unreachable: ${error.message}`);
      } else {
        // Error setting up request
        throw new Error(`LLM image analysis failed: ${error.message}`);
      }
    }
  }

  /**
   * Check if the LLM service is healthy
   * @returns {Promise<Object>} Health status with available models
   */
  async checkHealth() {
    try {
      const response = await axios.get(
        `${this.baseURL}/api/tags`,
        {
          timeout: 2000
        }
      );

      return {
        status: 'ok',
        models: response.data.models
      };
    } catch (error) {
      if (error.response) {
        // Server responded with error status
        throw new Error(
          `LLM health check failed (${error.response.status}): ${error.response.data?.error || error.message}`
        );
      } else if (error.request) {
        // Request made but no response
        throw new Error(`LLM health check unreachable: ${error.message}`);
      } else {
        // Error setting up request
        throw new Error(`LLM health check failed: ${error.message}`);
      }
    }
  }
}

module.exports = LLMClient;
