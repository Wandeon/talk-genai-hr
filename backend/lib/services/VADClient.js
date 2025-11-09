const axios = require('axios');

class VADClient {
  constructor(baseURL) {
    this.axiosInstance = axios.create({
      baseURL: baseURL,
      timeout: 5000
    });
  }

  async detectSpeech(audioBase64) {
    try {
      const response = await this.axiosInstance.post('/api/detect_stream', {
        audio: audioBase64
      });
      return response.data;
    } catch (error) {
      if (error.response) {
        // Server responded with error status
        throw new Error(
          `VAD service error (${error.response.status}): ${error.response.data?.error || error.message}`
        );
      } else if (error.request) {
        // Request made but no response
        throw new Error(`VAD service unreachable: ${error.message}`);
      } else {
        // Error setting up request
        throw new Error(`VAD service error: ${error.message}`);
      }
    }
  }

  async checkHealth() {
    try {
      const response = await this.axiosInstance.get('/health');
      return response.data;
    } catch (error) {
      if (error.response) {
        // Server responded with error status
        throw new Error(
          `VAD health check error (${error.response.status}): ${error.response.data?.error || error.message}`
        );
      } else if (error.request) {
        // Request made but no response
        throw new Error(`VAD health check unreachable: ${error.message}`);
      } else {
        // Error setting up request
        throw new Error(`VAD health check error: ${error.message}`);
      }
    }
  }
}

module.exports = VADClient;
