/**
 * Tool Implementations
 *
 * Actual functions that execute when tools are called by the LLM.
 */

/**
 * Get current time in specified timezone
 * @param {Object} args - Tool arguments
 * @param {string} [args.timezone] - Optional timezone (default: local)
 * @returns {string} Current time string
 */
function getCurrentTime(args = {}) {
  const { timezone } = args;

  try {
    const options = {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    };

    if (timezone) {
      options.timeZone = timezone;
    }

    const now = new Date();
    const timeString = now.toLocaleTimeString('en-US', options);
    const dateString = now.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      ...(timezone && { timeZone: timezone })
    });

    return `The current time is ${timeString} on ${dateString}${timezone ? ` (${timezone})` : ''}.`;
  } catch (error) {
    return `Error getting time: ${error.message}`;
  }
}

/**
 * Get weather information for a location
 * @param {Object} args - Tool arguments
 * @param {string} args.location - Location to get weather for (required)
 * @returns {string} Weather information
 */
function getWeather(args = {}) {
  const { location } = args;

  if (!location) {
    throw new Error('Location parameter is required for get_weather');
  }

  // Mock weather data - in a real implementation, this would call a weather API
  const weatherConditions = ['sunny', 'partly cloudy', 'cloudy', 'rainy', 'windy'];
  const condition = weatherConditions[Math.floor(Math.random() * weatherConditions.length)];
  const temperature = Math.floor(Math.random() * 30) + 50; // 50-80°F

  return `The weather in ${location} is currently ${condition} with a temperature of ${temperature}°F.`;
}

/**
 * Perform calculations
 * @param {Object} args - Tool arguments
 * @param {string} args.expression - Mathematical expression to evaluate (required)
 * @returns {string} Calculation result
 */
function calculate(args = {}) {
  const { expression } = args;

  if (!expression) {
    throw new Error('Expression parameter is required for calculate');
  }

  try {
    // Basic safety check - only allow numbers and basic operators
    const sanitized = expression.replace(/[^0-9+\-*/(). ]/g, '');
    if (sanitized !== expression) {
      return `Error: Expression contains invalid characters. Only numbers and basic operators (+, -, *, /, parentheses) are allowed.`;
    }

    // Evaluate the expression
    // Note: Using Function constructor is safer than eval for simple math
    // In production, consider using a proper math expression parser
    const result = Function('"use strict"; return (' + sanitized + ')')();

    if (typeof result !== 'number' || !isFinite(result)) {
      return `Error: Invalid calculation result.`;
    }

    return `The result of ${expression} is ${result}.`;
  } catch (error) {
    return `Error calculating expression: ${error.message}`;
  }
}

module.exports = {
  getCurrentTime,
  getWeather,
  calculate
};
