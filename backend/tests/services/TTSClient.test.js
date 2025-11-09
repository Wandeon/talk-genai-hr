const axios = require('axios');
const TTSClient = require('../../lib/services/TTSClient');

jest.mock('axios');

describe('TTSClient', () => {
  let ttsClient;
  const baseURL = 'http://localhost:5002';

  beforeEach(() => {
    ttsClient = new TTSClient(baseURL);
    jest.clearAllMocks();
  });

  describe('generateSpeech', () => {
    it('should generate speech from text', async () => {
      const text = 'Hello world';
      const mockResponse = {
        data: {
          audio: Buffer.from('fake audio data'),
          duration: 1.5
        }
      };

      axios.post.mockResolvedValue(mockResponse);

      const result = await ttsClient.generateSpeech(text);

      expect(result).toEqual(mockResponse.data);
      expect(axios.post).toHaveBeenCalledWith(
        `${baseURL}/api/tts`,
        { text, style: null },
        expect.objectContaining({
          timeout: 30000
        })
      );
    });

    it('should generate speech with voice style parameter', async () => {
      const text = 'Hello world';
      const style = 'cheerful';
      const mockResponse = {
        data: {
          audio: Buffer.from('fake audio data'),
          duration: 1.5
        }
      };

      axios.post.mockResolvedValue(mockResponse);

      const result = await ttsClient.generateSpeech(text, style);

      expect(result).toEqual(mockResponse.data);
      expect(axios.post).toHaveBeenCalledWith(
        `${baseURL}/api/tts`,
        { text, style },
        expect.objectContaining({
          timeout: 30000
        })
      );
    });

    it('should handle API error responses with status code', async () => {
      const text = 'Hello world';
      const error = {
        response: {
          data: { error: 'Invalid text format' },
          status: 400
        }
      };

      axios.post.mockRejectedValue(error);

      await expect(ttsClient.generateSpeech(text))
        .rejects
        .toThrow('TTS generation failed (400): Invalid text format');
    });

    it('should handle service unreachable errors', async () => {
      const text = 'Hello world';
      const error = {
        request: {},
        message: 'ECONNREFUSED'
      };

      axios.post.mockRejectedValue(error);

      await expect(ttsClient.generateSpeech(text))
        .rejects
        .toThrow('TTS service unreachable: ECONNREFUSED');
    });

    it('should handle request setup errors', async () => {
      const text = 'Hello world';
      const error = new Error('Request configuration error');

      axios.post.mockRejectedValue(error);

      await expect(ttsClient.generateSpeech(text))
        .rejects
        .toThrow('TTS service error: Request configuration error');
    });

    it('should handle error response without error field', async () => {
      const text = 'Hello world';
      const error = {
        response: {
          data: {},
          status: 500
        },
        message: 'Internal server error'
      };

      axios.post.mockRejectedValue(error);

      await expect(ttsClient.generateSpeech(text))
        .rejects
        .toThrow('TTS generation failed (500): Internal server error');
    });
  });

  describe('checkHealth', () => {
    it('should check service health', async () => {
      const mockResponse = {
        data: {
          status: 'healthy',
          timestamp: Date.now()
        }
      };

      axios.get.mockResolvedValue(mockResponse);

      const result = await ttsClient.checkHealth();

      expect(result).toEqual(mockResponse.data);
      expect(axios.get).toHaveBeenCalledWith(
        `${baseURL}/health`,
        expect.objectContaining({
          timeout: 2000
        })
      );
    });

    it('should handle health check errors', async () => {
      const error = new Error('Service unavailable');

      axios.get.mockRejectedValue(error);

      await expect(ttsClient.checkHealth())
        .rejects
        .toThrow('TTS health check error: Service unavailable');
    });

    it('should handle health check with error response and status code', async () => {
      const error = {
        response: {
          data: { error: 'Service degraded' },
          status: 503
        }
      };

      axios.get.mockRejectedValue(error);

      await expect(ttsClient.checkHealth())
        .rejects
        .toThrow('TTS health check failed (503): Service degraded');
    });

    it('should handle health check unreachable errors', async () => {
      const error = {
        request: {},
        message: 'ETIMEDOUT'
      };

      axios.get.mockRejectedValue(error);

      await expect(ttsClient.checkHealth())
        .rejects
        .toThrow('TTS health check unreachable: ETIMEDOUT');
    });
  });
});
