const axios = require('axios');
const FormData = require('form-data');

/**
 * Client for communicating with the STT (Speech-to-Text) service
 */
class STTClient {
  constructor(baseURL) {
    this.baseURL = baseURL;
  }

  /**
   * Transcribe audio buffer to text
   * @param {Buffer} audioBuffer - Audio data to transcribe
   * @param {string} language - Language code (default: 'en')
   * @returns {Promise<Object>} Transcription result
   */
  async transcribe(audioBuffer, language = 'en') {
    try {
      const formData = new FormData();
      formData.append('audio', audioBuffer, {
        filename: 'audio.wav',
        contentType: 'audio/wav'
      });
      formData.append('language', language);

      const response = await axios.post(
        `${this.baseURL}/api/transcribe`,
        formData,
        {
          headers: {
            ...formData.getHeaders()
          },
          timeout: 30000
        }
      );

      return response.data;
    } catch (error) {
      if (error.response) {
        // Server responded with error status
        throw new Error(
          `STT transcription failed (${error.response.status}): ${error.response.data?.error || error.message}`
        );
      } else if (error.request) {
        // Request made but no response
        throw new Error(`STT service unreachable: ${error.message}`);
      } else {
        // Error setting up request
        throw new Error(`STT transcription failed: ${error.message}`);
      }
    }
  }

  /**
   * Check if the STT service is healthy
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
          `STT health check failed (${error.response.status}): ${error.response.data?.error || error.message}`
        );
      } else if (error.request) {
        // Request made but no response
        throw new Error(`STT health check unreachable: ${error.message}`);
      } else {
        // Error setting up request
        throw new Error(`STT health check failed: ${error.message}`);
      }
    }
  }
}

module.exports = STTClient;
