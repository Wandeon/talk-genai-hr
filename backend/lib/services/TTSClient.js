const axios = require('axios');

/**
 * Client for communicating with the TTS (Text-to-Speech) service
 */
class TTSClient {
  constructor(baseURL) {
    this.baseURL = baseURL;
  }

  /**
   * Generate speech from text
   * @param {string} text - Text to convert to speech
   * @param {string} style - Optional voice style (e.g., 'cheerful', 'sad')
   * @returns {Promise<Object>} Generated speech data
   */
  async generateSpeech(text, style = null) {
    try {
      const response = await axios.post(
        `${this.baseURL}/api/tts`,
        { text, style },
        {
          timeout: 30000
        }
      );

      return response.data;
    } catch (error) {
      if (error.response) {
        // Server responded with error status
        throw new Error(
          `TTS generation failed (${error.response.status}): ${error.response.data?.error || error.message}`
        );
      } else if (error.request) {
        // Request made but no response
        throw new Error(`TTS service unreachable: ${error.message}`);
      } else {
        // Error setting up request
        throw new Error(`TTS service error: ${error.message}`);
      }
    }
  }

  /**
   * Check if the TTS service is healthy
   * @returns {Promise<Object>} Health check result
   */
  async checkHealth() {
    try {
      const response = await axios.get(
        `${this.baseURL}/health`,
        {
          timeout: 2000
        }
      );

      return response.data;
    } catch (error) {
      if (error.response) {
        // Server responded with error status
        throw new Error(
          `TTS health check failed (${error.response.status}): ${error.response.data?.error || error.message}`
        );
      } else if (error.request) {
        // Request made but no response
        throw new Error(`TTS health check unreachable: ${error.message}`);
      } else {
        // Error setting up request
        throw new Error(`TTS health check error: ${error.message}`);
      }
    }
  }
}

module.exports = TTSClient;
