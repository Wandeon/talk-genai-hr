const { getToolDefinitions, executeToolCall } = require('../../lib/tools/index');

describe('Tools Module', () => {
  describe('getToolDefinitions', () => {
    test('should return an array of tool definitions', () => {
      const tools = getToolDefinitions();

      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBeGreaterThan(0);
    });

    test('should include get_current_time tool', () => {
      const tools = getToolDefinitions();
      const timeTool = tools.find(t => t.function.name === 'get_current_time');

      expect(timeTool).toBeDefined();
      expect(timeTool.type).toBe('function');
      expect(timeTool.function.description).toBeDefined();
      expect(timeTool.function.parameters).toBeDefined();
      expect(timeTool.function.parameters.type).toBe('object');
    });

    test('should include get_weather tool', () => {
      const tools = getToolDefinitions();
      const weatherTool = tools.find(t => t.function.name === 'get_weather');

      expect(weatherTool).toBeDefined();
      expect(weatherTool.type).toBe('function');
      expect(weatherTool.function.description).toBeDefined();

      // Weather tool should have required location parameter
      expect(weatherTool.function.parameters.properties.location).toBeDefined();
      expect(weatherTool.function.parameters.required).toContain('location');
    });

    test('should include calculate tool', () => {
      const tools = getToolDefinitions();
      const calcTool = tools.find(t => t.function.name === 'calculate');

      expect(calcTool).toBeDefined();
      expect(calcTool.type).toBe('function');
      expect(calcTool.function.description).toBeDefined();

      // Calculate tool should have required expression parameter
      expect(calcTool.function.parameters.properties.expression).toBeDefined();
      expect(calcTool.function.parameters.required).toContain('expression');
    });

    test('should follow Ollama tool format', () => {
      const tools = getToolDefinitions();

      for (const tool of tools) {
        // Each tool should have type and function
        expect(tool.type).toBe('function');
        expect(tool.function).toBeDefined();

        // Function should have name, description, and parameters
        expect(typeof tool.function.name).toBe('string');
        expect(typeof tool.function.description).toBe('string');
        expect(tool.function.parameters).toBeDefined();
        expect(tool.function.parameters.type).toBe('object');
        expect(tool.function.parameters.properties).toBeDefined();
      }
    });
  });

  describe('executeToolCall', () => {
    describe('get_current_time', () => {
      test('should execute get_current_time without timezone', async () => {
        const toolCall = {
          function: {
            name: 'get_current_time',
            arguments: {}
          }
        };

        const result = await executeToolCall(toolCall);

        expect(result).toBeDefined();
        expect(typeof result).toBe('string');
        // Should contain time information
        expect(result).toMatch(/\d{1,2}:\d{2}/); // Match time format
      });

      test('should execute get_current_time with timezone', async () => {
        const toolCall = {
          function: {
            name: 'get_current_time',
            arguments: {
              timezone: 'America/New_York'
            }
          }
        };

        const result = await executeToolCall(toolCall);

        expect(result).toBeDefined();
        expect(typeof result).toBe('string');
        expect(result).toMatch(/\d{1,2}:\d{2}/);
      });

      test('should handle string arguments for get_current_time', async () => {
        const toolCall = {
          function: {
            name: 'get_current_time',
            arguments: JSON.stringify({ timezone: 'UTC' })
          }
        };

        const result = await executeToolCall(toolCall);

        expect(result).toBeDefined();
        expect(typeof result).toBe('string');
      });
    });

    describe('get_weather', () => {
      test('should execute get_weather with location', async () => {
        const toolCall = {
          function: {
            name: 'get_weather',
            arguments: {
              location: 'New York'
            }
          }
        };

        const result = await executeToolCall(toolCall);

        expect(result).toBeDefined();
        expect(typeof result).toBe('string');
        expect(result.toLowerCase()).toContain('new york');
      });

      test('should return mock weather data', async () => {
        const toolCall = {
          function: {
            name: 'get_weather',
            arguments: {
              location: 'London'
            }
          }
        };

        const result = await executeToolCall(toolCall);

        expect(result).toBeDefined();
        // Should contain weather-related information
        expect(result).toMatch(/temperature|weather|sunny|cloudy|rainy/i);
      });

      test('should handle missing location parameter', async () => {
        const toolCall = {
          function: {
            name: 'get_weather',
            arguments: {}
          }
        };

        await expect(executeToolCall(toolCall)).rejects.toThrow(/location.*required/i);
      });
    });

    describe('calculate', () => {
      test('should execute calculate with simple expression', async () => {
        const toolCall = {
          function: {
            name: 'calculate',
            arguments: {
              expression: '2 + 2'
            }
          }
        };

        const result = await executeToolCall(toolCall);

        expect(result).toBeDefined();
        expect(result).toContain('4');
      });

      test('should execute calculate with complex expression', async () => {
        const toolCall = {
          function: {
            name: 'calculate',
            arguments: {
              expression: '(10 + 5) * 2'
            }
          }
        };

        const result = await executeToolCall(toolCall);

        expect(result).toBeDefined();
        expect(result).toContain('30');
      });

      test('should handle invalid expressions', async () => {
        const toolCall = {
          function: {
            name: 'calculate',
            arguments: {
              expression: 'invalid expression'
            }
          }
        };

        const result = await executeToolCall(toolCall);

        expect(result).toBeDefined();
        // Should return error message, not throw
        expect(result.toLowerCase()).toMatch(/error|invalid|cannot/);
      });

      test('should handle missing expression parameter', async () => {
        const toolCall = {
          function: {
            name: 'calculate',
            arguments: {}
          }
        };

        await expect(executeToolCall(toolCall)).rejects.toThrow(/expression.*required/i);
      });
    });

    describe('Error Handling', () => {
      test('should handle unknown tool gracefully', async () => {
        const toolCall = {
          function: {
            name: 'unknown_tool',
            arguments: {}
          }
        };

        await expect(executeToolCall(toolCall)).rejects.toThrow(/unknown.*tool/i);
      });

      test('should handle malformed tool call', async () => {
        const toolCall = {
          function: {
            name: 'get_current_time'
            // Missing arguments
          }
        };

        const result = await executeToolCall(toolCall);

        // Should still execute with empty arguments
        expect(result).toBeDefined();
      });

      test('should handle null arguments', async () => {
        const toolCall = {
          function: {
            name: 'get_current_time',
            arguments: null
          }
        };

        const result = await executeToolCall(toolCall);

        expect(result).toBeDefined();
      });
    });
  });
});
