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
      const errorMessage = error.response?.data?.error || error.message;
      throw new Error(`STT transcription failed: ${errorMessage}`);
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
      const errorMessage = error.response?.data?.error || error.message;
      throw new Error(`STT health check failed: ${errorMessage}`);
    }
  }
}

module.exports = STTClient;
