/**
 * Tools Module
 *
 * Provides tool definitions and execution for LLM function calling.
 * Tools follow the Ollama function calling format.
 */

const { getCurrentTime, getWeather, calculate } = require('./implementations');

/**
 * Tool definitions in Ollama format
 * @returns {Array} Array of tool definitions
 */
function getToolDefinitions() {
  return [
    {
      type: 'function',
      function: {
        name: 'get_current_time',
        description: 'Get the current time and date. Optionally specify a timezone.',
        parameters: {
          type: 'object',
          properties: {
            timezone: {
              type: 'string',
              description: 'Optional timezone (e.g., "America/New_York", "Europe/London", "UTC")'
            }
          },
          required: []
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'get_weather',
        description: 'Get current weather information for a specific location.',
        parameters: {
          type: 'object',
          properties: {
            location: {
              type: 'string',
              description: 'The city or location to get weather for (e.g., "New York", "London", "Tokyo")'
            }
          },
          required: ['location']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'calculate',
        description: 'Perform mathematical calculations. Supports basic arithmetic operations (+, -, *, /) and parentheses.',
        parameters: {
          type: 'object',
          properties: {
            expression: {
              type: 'string',
              description: 'The mathematical expression to evaluate (e.g., "2 + 2", "(10 + 5) * 2")'
            }
          },
          required: ['expression']
        }
      }
    }
  ];
}

/**
 * Execute a tool call from the LLM
 * @param {Object} toolCall - Tool call object from LLM
 * @param {Object} toolCall.function - Function details
 * @param {string} toolCall.function.name - Function name
 * @param {Object|string} toolCall.function.arguments - Function arguments (may be string or object)
 * @returns {Promise<string>} Tool execution result
 */
async function executeToolCall(toolCall) {
  try {
    const { function: func } = toolCall;
    const { name, arguments: args } = func;

    // Parse arguments if they're a string
    let parsedArgs = args;
    if (typeof args === 'string') {
      try {
        parsedArgs = JSON.parse(args);
      } catch (e) {
        parsedArgs = {};
      }
    }

    // Handle null or undefined arguments
    if (!parsedArgs) {
      parsedArgs = {};
    }

    // Execute the appropriate tool
    switch (name) {
      case 'get_current_time':
        return getCurrentTime(parsedArgs);

      case 'get_weather':
        return getWeather(parsedArgs);

      case 'calculate':
        return calculate(parsedArgs);

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    // Re-throw validation errors (like missing required params)
    if (error.message.includes('required')) {
      throw error;
    }
    // For other errors, log and re-throw
    console.error('Tool execution error:', error);
    throw error;
  }
}

module.exports = {
  getToolDefinitions,
  executeToolCall
};
