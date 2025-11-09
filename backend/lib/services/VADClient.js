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
      throw new Error(`VAD service error: ${error.message}`);
    }
  }

  async checkHealth() {
    try {
      const response = await this.axiosInstance.get('/health');
      return response.data;
    } catch (error) {
      throw new Error(`VAD health check error: ${error.message}`);
    }
  }
}

module.exports = VADClient;
