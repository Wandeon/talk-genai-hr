const axios = require('axios');
const VADClient = require('../../lib/services/VADClient');

jest.mock('axios');

describe('VADClient', () => {
  let client;
  const baseURL = 'http://localhost:8001';
  let mockAxiosInstance;

  beforeEach(() => {
    mockAxiosInstance = {
      post: jest.fn(),
      get: jest.fn()
    };

    axios.create.mockReturnValue(mockAxiosInstance);
    client = new VADClient(baseURL);
    jest.clearAllMocks();
  });

  describe('detectSpeech', () => {
    test('should detect speech in audio chunk (is_speech: true)', async () => {
      const audioBase64 = 'base64encodedaudiodata';
      const mockResponse = {
        data: {
          is_speech: true,
          probability: 0.95,
          threshold: 0.5
        }
      };

      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const result = await client.detectSpeech(audioBase64);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/api/detect_stream',
        { audio: audioBase64 }
      );
      expect(result).toEqual(mockResponse.data);
    });

    test('should detect silence (is_speech: false)', async () => {
      const audioBase64 = 'base64encodedsilence';
      const mockResponse = {
        data: {
          is_speech: false,
          probability: 0.12,
          threshold: 0.5
        }
      };

      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const result = await client.detectSpeech(audioBase64);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/api/detect_stream',
        { audio: audioBase64 }
      );
      expect(result).toEqual(mockResponse.data);
    });

    test('should handle service errors', async () => {
      const audioBase64 = 'base64encodedaudiodata';
      const errorMessage = 'Network Error';

      mockAxiosInstance.post.mockRejectedValue(new Error(errorMessage));

      await expect(client.detectSpeech(audioBase64)).rejects.toThrow(
        'VAD service error: Network Error'
      );
    });
  });

  describe('checkHealth', () => {
    test('should check health endpoint', async () => {
      const mockResponse = {
        data: {
          status: 'healthy',
          service: 'vad'
        }
      };

      mockAxiosInstance.get.mockResolvedValue(mockResponse);

      const result = await client.checkHealth();

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/health');
      expect(result).toEqual(mockResponse.data);
    });

    test('should handle health check errors', async () => {
      const errorMessage = 'Service Unavailable';

      mockAxiosInstance.get.mockRejectedValue(new Error(errorMessage));

      await expect(client.checkHealth()).rejects.toThrow(
        'VAD health check error: Service Unavailable'
      );
    });
  });
});
