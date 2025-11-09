const axios = require('axios');
const STTClient = require('../../lib/services/STTClient');

jest.mock('axios');

describe('STTClient', () => {
  let sttClient;
  const baseURL = 'http://localhost:5001';

  beforeEach(() => {
    sttClient = new STTClient(baseURL);
    jest.clearAllMocks();
  });

  describe('transcribe', () => {
    it('should transcribe audio buffer to text', async () => {
      const audioBuffer = Buffer.from('fake audio data');
      const mockResponse = {
        data: {
          text: 'Hello world',
          language: 'en'
        }
      };

      axios.post.mockResolvedValue(mockResponse);

      const result = await sttClient.transcribe(audioBuffer, 'en');

      expect(result).toEqual(mockResponse.data);
      expect(axios.post).toHaveBeenCalledWith(
        `${baseURL}/api/transcribe`,
        expect.any(Object), // FormData
        expect.objectContaining({
          timeout: 30000,
          headers: expect.any(Object)
        })
      );
    });

    it('should use default language when not specified', async () => {
      const audioBuffer = Buffer.from('fake audio data');
      const mockResponse = {
        data: {
          text: 'Hello world',
          language: 'en'
        }
      };

      axios.post.mockResolvedValue(mockResponse);

      await sttClient.transcribe(audioBuffer);

      expect(axios.post).toHaveBeenCalledWith(
        `${baseURL}/api/transcribe`,
        expect.any(Object),
        expect.objectContaining({
          timeout: 30000
        })
      );
    });

    it('should handle transcription errors', async () => {
      const audioBuffer = Buffer.from('fake audio data');
      const error = new Error('Network error');

      axios.post.mockRejectedValue(error);

      await expect(sttClient.transcribe(audioBuffer))
        .rejects
        .toThrow('STT transcription failed: Network error');
    });

    it('should handle API error responses', async () => {
      const audioBuffer = Buffer.from('fake audio data');
      const error = {
        response: {
          data: { error: 'Invalid audio format' },
          status: 400
        }
      };

      axios.post.mockRejectedValue(error);

      await expect(sttClient.transcribe(audioBuffer))
        .rejects
        .toThrow('STT transcription failed: Invalid audio format');
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

      const result = await sttClient.checkHealth();

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

      await expect(sttClient.checkHealth())
        .rejects
        .toThrow('STT health check failed: Service unavailable');
    });
  });
});
