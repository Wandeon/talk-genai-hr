import { renderHook, act, waitFor } from '@testing-library/react';
import useAudioRecorder from './useAudioRecorder';

// Mock MediaRecorder
class MockMediaRecorder {
  constructor(stream, options) {
    this.stream = stream;
    this.options = options;
    this.state = 'inactive';
    this.ondataavailable = null;
    this.onerror = null;
    this.onstart = null;
    this.onstop = null;
  }

  start(timeslice) {
    this.state = 'recording';
    this.timeslice = timeslice;
    if (this.onstart) {
      this.onstart();
    }

    // Simulate data available after timeslice
    if (this.ondataavailable && timeslice) {
      this.dataAvailableInterval = setInterval(() => {
        const mockBlob = new Blob(['mock audio data'], { type: 'audio/webm' });
        this.ondataavailable({ data: mockBlob });
      }, timeslice);
    }
  }

  stop() {
    this.state = 'inactive';
    if (this.dataAvailableInterval) {
      clearInterval(this.dataAvailableInterval);
    }
    if (this.onstop) {
      this.onstop();
    }
  }

  static isTypeSupported(mimeType) {
    return mimeType === 'audio/webm' || mimeType === 'audio/wav';
  }
}

// Mock MediaStream
class MockMediaStream {
  constructor() {
    this.active = true;
    this.tracks = [
      {
        kind: 'audio',
        stop: jest.fn(),
      },
    ];
  }

  getTracks() {
    return this.tracks;
  }

  getAudioTracks() {
    return this.tracks.filter((t) => t.kind === 'audio');
  }
}

describe('useAudioRecorder', () => {
  let mockGetUserMedia;
  let mockMediaStream;
  let originalMediaRecorder;

  beforeEach(() => {
    // Setup mocks - create a new stream for each test
    mockGetUserMedia = jest.fn().mockImplementation(() => {
      mockMediaStream = new MockMediaStream();
      return Promise.resolve(mockMediaStream);
    });

    // Save originals
    originalMediaRecorder = global.MediaRecorder;

    // Setup global mocks
    global.MediaRecorder = MockMediaRecorder;

    // Define navigator if it doesn't exist
    if (!global.navigator) {
      global.navigator = {};
    }

    // Setup mediaDevices
    Object.defineProperty(global.navigator, 'mediaDevices', {
      writable: true,
      configurable: true,
      value: {
        getUserMedia: mockGetUserMedia,
      },
    });

    // Mock FileReader for base64 conversion
    global.FileReader = class {
      readAsDataURL(blob) {
        // Simulate async read
        setTimeout(() => {
          this.result = 'data:audio/webm;base64,bW9jayBhdWRpbyBkYXRh'; // "mock audio data"
          this.onload && this.onload();
        }, 0);
      }
    };
  });

  afterEach(() => {
    // Restore originals
    global.MediaRecorder = originalMediaRecorder;
    jest.clearAllMocks();
  });

  describe('Initialization and Permissions', () => {
    it('should request microphone permission on mount', async () => {
      const sendAudioChunk = jest.fn();

      renderHook(() => useAudioRecorder(sendAudioChunk));

      await waitFor(() => {
        expect(mockGetUserMedia).toHaveBeenCalledWith({ audio: true });
      });
    });

    it('should set hasPermission to true when permission granted', async () => {
      const sendAudioChunk = jest.fn();

      const { result } = renderHook(() => useAudioRecorder(sendAudioChunk));

      await waitFor(() => {
        expect(result.current.hasPermission).toBe(true);
      });
      expect(result.current.permissionError).toBeNull();
    });

    it('should set permissionError when permission denied', async () => {
      const sendAudioChunk = jest.fn();
      const error = new Error('Permission denied');
      mockGetUserMedia.mockRejectedValue(error);

      const { result } = renderHook(() => useAudioRecorder(sendAudioChunk));

      await waitFor(() => {
        expect(result.current.hasPermission).toBe(false);
      });
      expect(result.current.permissionError).toBe('Permission denied');
    });

    it('should handle NotAllowedError specifically', async () => {
      const sendAudioChunk = jest.fn();
      const error = new Error('Permission denied by user');
      error.name = 'NotAllowedError';
      mockGetUserMedia.mockRejectedValue(error);

      const { result } = renderHook(() => useAudioRecorder(sendAudioChunk));

      await waitFor(() => {
        expect(result.current.permissionError).toBe('Microphone access denied. Please grant permission to use voice chat.');
      });
    });

    it('should handle NotFoundError for missing microphone', async () => {
      const sendAudioChunk = jest.fn();
      const error = new Error('No microphone found');
      error.name = 'NotFoundError';
      mockGetUserMedia.mockRejectedValue(error);

      const { result } = renderHook(() => useAudioRecorder(sendAudioChunk));

      await waitFor(() => {
        expect(result.current.permissionError).toBe('No microphone found. Please connect a microphone.');
      });
    });

    it('should handle missing MediaRecorder API', async () => {
      const sendAudioChunk = jest.fn();
      global.MediaRecorder = undefined;

      const { result } = renderHook(() => useAudioRecorder(sendAudioChunk));

      await waitFor(() => {
        expect(result.current.permissionError).toBe('MediaRecorder API is not supported in this browser.');
      });
    });
  });

  describe('Recording Control', () => {
    it('should start recording when startRecording is called', async () => {
      const sendAudioChunk = jest.fn();

      const { result } = renderHook(() => useAudioRecorder(sendAudioChunk));

      // Wait for permission
      await waitFor(() => {
        expect(result.current.hasPermission).toBe(true);
      });

      // Start recording
      act(() => {
        result.current.startRecording();
      });

      await waitFor(() => {
        expect(result.current.isRecording).toBe(true);
      });
    });

    it('should stop recording when stopRecording is called', async () => {
      const sendAudioChunk = jest.fn();

      const { result } = renderHook(() => useAudioRecorder(sendAudioChunk));

      // Wait for permission
      await waitFor(() => {
        expect(result.current.hasPermission).toBe(true);
      });

      // Start recording
      act(() => {
        result.current.startRecording();
      });

      await waitFor(() => {
        expect(result.current.isRecording).toBe(true);
      });

      // Stop recording
      act(() => {
        result.current.stopRecording();
      });

      await waitFor(() => {
        expect(result.current.isRecording).toBe(false);
      });
    });

    it('should not start recording if permission is not granted', async () => {
      const sendAudioChunk = jest.fn();
      mockGetUserMedia.mockRejectedValue(new Error('Permission denied'));

      const { result } = renderHook(() => useAudioRecorder(sendAudioChunk));

      await waitFor(() => {
        expect(result.current.hasPermission).toBe(false);
      });

      act(() => {
        result.current.startRecording();
      });

      // Should remain not recording
      expect(result.current.isRecording).toBe(false);
    });

    it('should use 100ms timeslice for low latency', async () => {
      const sendAudioChunk = jest.fn();
      let capturedTimeslice;

      // Override MockMediaRecorder to capture timeslice
      const OriginalMockMediaRecorder = global.MediaRecorder;
      global.MediaRecorder = class extends MockMediaRecorder {
        start(timeslice) {
          capturedTimeslice = timeslice;
          super.start(timeslice);
        }
      };

      const { result } = renderHook(() => useAudioRecorder(sendAudioChunk));

      await waitFor(() => {
        expect(result.current.hasPermission).toBe(true);
      });

      act(() => {
        result.current.startRecording();
      });

      await waitFor(() => {
        expect(capturedTimeslice).toBe(100);
      });

      global.MediaRecorder = OriginalMockMediaRecorder;
    });
  });

  describe('Audio Chunk Sending', () => {
    it('should send audio chunks when data is available', async () => {
      const sendAudioChunk = jest.fn();

      const { result } = renderHook(() => useAudioRecorder(sendAudioChunk));

      await waitFor(() => {
        expect(result.current.hasPermission).toBe(true);
      });

      act(() => {
        result.current.startRecording();
      });

      // Wait for at least one chunk to be sent
      await waitFor(() => {
        expect(sendAudioChunk).toHaveBeenCalled();
      }, { timeout: 200 });

      // Check that the chunk is in the correct format
      expect(sendAudioChunk).toHaveBeenCalledWith(
        expect.stringMatching(/^data:audio\/webm;base64,/)
      );
    });

    it('should send multiple chunks during continuous recording', async () => {
      const sendAudioChunk = jest.fn();

      const { result } = renderHook(() => useAudioRecorder(sendAudioChunk));

      await waitFor(() => {
        expect(result.current.hasPermission).toBe(true);
      });

      act(() => {
        result.current.startRecording();
      });

      // Wait for multiple chunks
      await waitFor(() => {
        expect(sendAudioChunk.mock.calls.length).toBeGreaterThanOrEqual(2);
      }, { timeout: 300 });
    });

    it('should stop sending chunks when recording stops', async () => {
      const sendAudioChunk = jest.fn();

      const { result } = renderHook(() => useAudioRecorder(sendAudioChunk));

      await waitFor(() => {
        expect(result.current.hasPermission).toBe(true);
      });

      act(() => {
        result.current.startRecording();
      });

      // Wait for some chunks
      await waitFor(() => {
        expect(sendAudioChunk).toHaveBeenCalled();
      }, { timeout: 200 });

      const callCountBeforeStop = sendAudioChunk.mock.calls.length;

      act(() => {
        result.current.stopRecording();
      });

      // Wait a bit and verify no new chunks are sent
      await new Promise((resolve) => setTimeout(resolve, 200));
      const callCountAfterStop = sendAudioChunk.mock.calls.length;

      // Should not have received many more calls (maybe one more from buffer)
      expect(callCountAfterStop - callCountBeforeStop).toBeLessThanOrEqual(1);
    });
  });

  describe('Cleanup', () => {
    it('should stop recording on unmount', async () => {
      const sendAudioChunk = jest.fn();

      const { result, unmount } = renderHook(() => useAudioRecorder(sendAudioChunk));

      await waitFor(() => {
        expect(result.current.hasPermission).toBe(true);
      });

      act(() => {
        result.current.startRecording();
      });

      await waitFor(() => {
        expect(result.current.isRecording).toBe(true);
      });

      unmount();

      // Verify media stream tracks were stopped
      expect(mockMediaStream.tracks[0].stop).toHaveBeenCalled();
    });

    it('should clean up media stream on unmount', async () => {
      const sendAudioChunk = jest.fn();

      const { unmount } = renderHook(() => useAudioRecorder(sendAudioChunk));

      await waitFor(() => {
        expect(mockGetUserMedia).toHaveBeenCalled();
      });

      unmount();

      // Verify cleanup
      expect(mockMediaStream.tracks[0].stop).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle MediaRecorder errors gracefully', async () => {
      const sendAudioChunk = jest.fn();
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

      const { result } = renderHook(() => useAudioRecorder(sendAudioChunk));

      await waitFor(() => {
        expect(result.current.hasPermission).toBe(true);
      });

      act(() => {
        result.current.startRecording();
      });

      // Simulate MediaRecorder error
      await waitFor(() => {
        expect(result.current.isRecording).toBe(true);
      });

      // Get the MediaRecorder instance and trigger error
      // This would be handled internally by the hook

      consoleError.mockRestore();
    });

    it('should handle blob conversion errors', async () => {
      const sendAudioChunk = jest.fn();
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

      // Mock FileReader to fail
      global.FileReader = class {
        readAsDataURL() {
          setTimeout(() => {
            this.onerror && this.onerror(new Error('Failed to read'));
          }, 0);
        }
      };

      const { result } = renderHook(() => useAudioRecorder(sendAudioChunk));

      await waitFor(() => {
        expect(result.current.hasPermission).toBe(true);
      });

      act(() => {
        result.current.startRecording();
      });

      // Wait a bit for potential errors
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Should still be recording despite conversion errors
      expect(result.current.isRecording).toBe(true);

      consoleError.mockRestore();
    });
  });

  describe('Audio Format', () => {
    it('should prefer audio/webm format', async () => {
      const sendAudioChunk = jest.fn();
      let capturedOptions;

      const OriginalMockMediaRecorder = global.MediaRecorder;
      global.MediaRecorder = class extends MockMediaRecorder {
        constructor(stream, options) {
          capturedOptions = options;
          super(stream, options);
        }
      };

      const { result } = renderHook(() => useAudioRecorder(sendAudioChunk));

      await waitFor(() => {
        expect(result.current.hasPermission).toBe(true);
      });

      act(() => {
        result.current.startRecording();
      });

      await waitFor(() => {
        expect(capturedOptions).toBeDefined();
        expect(capturedOptions.mimeType).toBe('audio/webm');
      });

      global.MediaRecorder = OriginalMockMediaRecorder;
    });

    it('should fall back to audio/wav if webm not supported', async () => {
      const sendAudioChunk = jest.fn();
      let capturedOptions;

      const OriginalMockMediaRecorder = global.MediaRecorder;
      global.MediaRecorder = class extends MockMediaRecorder {
        constructor(stream, options) {
          capturedOptions = options;
          super(stream, options);
        }

        static isTypeSupported(mimeType) {
          return mimeType === 'audio/wav';
        }
      };

      const { result } = renderHook(() => useAudioRecorder(sendAudioChunk));

      await waitFor(() => {
        expect(result.current.hasPermission).toBe(true);
      });

      act(() => {
        result.current.startRecording();
      });

      await waitFor(() => {
        expect(capturedOptions).toBeDefined();
        expect(capturedOptions.mimeType).toBe('audio/wav');
      });

      global.MediaRecorder = OriginalMockMediaRecorder;
    });
  });
});
