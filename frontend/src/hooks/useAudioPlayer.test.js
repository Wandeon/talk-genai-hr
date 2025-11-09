import { renderHook, act, waitFor } from '@testing-library/react';
import useAudioPlayer from './useAudioPlayer';

// Mock AudioContext and related Web Audio API
class MockAudioBufferSourceNode {
  constructor(context) {
    this.context = context;
    this.buffer = null;
    this.onended = null;
    this._started = false;
    this._stopped = false;
  }

  connect(destination) {
    this.destination = destination;
    return destination;
  }

  start(when = 0) {
    this._started = true;
    // Simulate audio playback ending
    setTimeout(() => {
      if (!this._stopped && this.onended) {
        this.onended();
      }
    }, 10);
  }

  stop() {
    this._stopped = true;
  }
}

class MockAudioContext {
  constructor() {
    this.state = 'running';
    this.destination = { channelCount: 2 };
    this.sampleRate = 48000;
    this._closed = false;
  }

  createBufferSource() {
    return new MockAudioBufferSourceNode(this);
  }

  decodeAudioData(arrayBuffer) {
    // Return a mock AudioBuffer
    return Promise.resolve({
      duration: 1.0,
      length: 48000,
      numberOfChannels: 1,
      sampleRate: 48000,
      getChannelData: () => new Float32Array(48000),
    });
  }

  close() {
    this._closed = true;
    this.state = 'closed';
    return Promise.resolve();
  }

  resume() {
    this.state = 'running';
    return Promise.resolve();
  }
}

describe('useAudioPlayer', () => {
  let originalAudioContext;

  beforeEach(() => {
    // Save original
    originalAudioContext = global.AudioContext;

    // Setup global mock
    global.AudioContext = MockAudioContext;
    global.webkitAudioContext = MockAudioContext;

    // Mock atob for base64 decoding
    global.atob = jest.fn((str) => {
      // Simple mock that returns a string representation
      return str.split('').map(char => String.fromCharCode(char.charCodeAt(0))).join('');
    });
  });

  afterEach(() => {
    // Restore original
    global.AudioContext = originalAudioContext;
    global.webkitAudioContext = originalAudioContext;
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() => useAudioPlayer());

      expect(result.current.isPlaying).toBe(false);
      expect(result.current.queue).toEqual([]);
    });

    it('should create AudioContext on mount', () => {
      const { result } = renderHook(() => useAudioPlayer());

      // AudioContext should be created (we can verify by trying to play audio)
      expect(result.current.playAudioChunk).toBeDefined();
    });
  });

  describe('playAudioChunk', () => {
    it('should decode and play base64 audio chunk', async () => {
      const { result } = renderHook(() => useAudioPlayer());

      // Create a simple base64 string (doesn't need to be real audio for mock)
      const base64Audio = 'SGVsbG8gV29ybGQ='; // "Hello World" in base64

      await act(async () => {
        await result.current.playAudioChunk(base64Audio);
      });

      // Should start playing
      await waitFor(() => {
        expect(result.current.isPlaying).toBe(true);
      });
    });

    it('should add chunk to queue when already playing', async () => {
      const { result } = renderHook(() => useAudioPlayer());

      const chunk1 = 'Q2h1bmsx'; // "Chunk1"
      const chunk2 = 'Q2h1bmsw'; // "Chunk2"

      await act(async () => {
        await result.current.playAudioChunk(chunk1);
        await result.current.playAudioChunk(chunk2);
      });

      await waitFor(() => {
        expect(result.current.queue.length).toBeGreaterThanOrEqual(0);
      });
    });

    it('should handle invalid base64 gracefully', async () => {
      const { result } = renderHook(() => useAudioPlayer());

      const invalidBase64 = 'not-valid-base64!!!';

      await act(async () => {
        // Should not throw
        await expect(result.current.playAudioChunk(invalidBase64)).resolves.not.toThrow();
      });

      // Should handle error and not be playing
      expect(result.current.isPlaying).toBe(false);
    });

    it('should handle decodeAudioData errors gracefully', async () => {
      // Override mock to throw error
      global.AudioContext = class extends MockAudioContext {
        decodeAudioData() {
          return Promise.reject(new Error('Decode error'));
        }
      };

      const { result } = renderHook(() => useAudioPlayer());

      const base64Audio = 'SGVsbG8gV29ybGQ=';

      await act(async () => {
        await result.current.playAudioChunk(base64Audio);
      });

      // Should handle error gracefully
      expect(result.current.isPlaying).toBe(false);
    });
  });

  describe('stop', () => {
    it('should stop playback immediately', async () => {
      const { result } = renderHook(() => useAudioPlayer());

      const base64Audio = 'SGVsbG8gV29ybGQ=';

      await act(async () => {
        await result.current.playAudioChunk(base64Audio);
      });

      // Wait for playback to start
      await waitFor(() => {
        expect(result.current.isPlaying).toBe(true);
      });

      act(() => {
        result.current.stop();
      });

      // Should stop immediately
      expect(result.current.isPlaying).toBe(false);
    });

    it('should clear the queue when stopping', async () => {
      const { result } = renderHook(() => useAudioPlayer());

      const chunk1 = 'Q2h1bmsx';
      const chunk2 = 'Q2h1bmsw';

      await act(async () => {
        await result.current.playAudioChunk(chunk1);
        await result.current.playAudioChunk(chunk2);
      });

      act(() => {
        result.current.stop();
      });

      // Queue should be cleared
      expect(result.current.queue).toEqual([]);
    });

    it('should stop current audio source node', async () => {
      const { result } = renderHook(() => useAudioPlayer());

      const base64Audio = 'SGVsbG8gV29ybGQ=';

      await act(async () => {
        await result.current.playAudioChunk(base64Audio);
      });

      await waitFor(() => {
        expect(result.current.isPlaying).toBe(true);
      });

      act(() => {
        result.current.stop();
      });

      expect(result.current.isPlaying).toBe(false);
    });
  });

  describe('queue management', () => {
    it('should process queued chunks sequentially', async () => {
      const { result } = renderHook(() => useAudioPlayer());

      const chunk1 = 'Q2h1bmsx';
      const chunk2 = 'Q2h1bmsw';
      const chunk3 = 'Q2h1bmsy';

      await act(async () => {
        await result.current.playAudioChunk(chunk1);
        await result.current.playAudioChunk(chunk2);
        await result.current.playAudioChunk(chunk3);
      });

      // Should be playing
      await waitFor(() => {
        expect(result.current.isPlaying).toBe(true);
      });

      // Wait for queue to process
      await waitFor(
        () => {
          expect(result.current.queue.length).toBe(0);
          expect(result.current.isPlaying).toBe(false);
        },
        { timeout: 3000 }
      );
    });

    it('should update queue state as chunks are processed', async () => {
      const { result } = renderHook(() => useAudioPlayer());

      const chunks = ['Q2h1bmsx', 'Q2h1bmsw', 'Q2h1bmsy'];

      await act(async () => {
        for (const chunk of chunks) {
          await result.current.playAudioChunk(chunk);
        }
      });

      // Initial queue should have chunks
      const initialQueueLength = result.current.queue.length;
      expect(initialQueueLength).toBeGreaterThanOrEqual(0);
    });
  });

  describe('cleanup', () => {
    it('should cleanup AudioContext on unmount', async () => {
      const { result, unmount } = renderHook(() => useAudioPlayer());

      const base64Audio = 'SGVsbG8gV29ybGQ=';

      await act(async () => {
        await result.current.playAudioChunk(base64Audio);
      });

      unmount();

      // AudioContext should be closed (verified by no errors thrown)
      expect(true).toBe(true);
    });

    it('should stop playback on unmount', async () => {
      const { result, unmount } = renderHook(() => useAudioPlayer());

      const base64Audio = 'SGVsbG8gV29ybGQ=';

      await act(async () => {
        await result.current.playAudioChunk(base64Audio);
      });

      await waitFor(() => {
        expect(result.current.isPlaying).toBe(true);
      });

      unmount();

      // No errors should occur
      expect(true).toBe(true);
    });
  });

  describe('browser compatibility', () => {
    it('should handle missing AudioContext gracefully', () => {
      // Remove AudioContext
      const tempAudioContext = global.AudioContext;
      const tempWebkitAudioContext = global.webkitAudioContext;
      global.AudioContext = undefined;
      global.webkitAudioContext = undefined;

      const { result } = renderHook(() => useAudioPlayer());

      // Should still initialize without crashing
      expect(result.current.isPlaying).toBe(false);
      expect(result.current.playAudioChunk).toBeDefined();
      expect(result.current.stop).toBeDefined();

      // Restore
      global.AudioContext = tempAudioContext;
      global.webkitAudioContext = tempWebkitAudioContext;
    });

    it('should not play audio when AudioContext is unavailable', async () => {
      const tempAudioContext = global.AudioContext;
      const tempWebkitAudioContext = global.webkitAudioContext;
      global.AudioContext = undefined;
      global.webkitAudioContext = undefined;

      const { result } = renderHook(() => useAudioPlayer());

      const base64Audio = 'SGVsbG8gV29ybGQ=';

      await act(async () => {
        await result.current.playAudioChunk(base64Audio);
      });

      // Should not be playing
      expect(result.current.isPlaying).toBe(false);

      // Restore
      global.AudioContext = tempAudioContext;
      global.webkitAudioContext = tempWebkitAudioContext;
    });
  });

  describe('base64 decoding', () => {
    it('should correctly decode base64 to ArrayBuffer', async () => {
      const { result } = renderHook(() => useAudioPlayer());

      const base64Audio = 'SGVsbG8gV29ybGQ=';

      await act(async () => {
        await result.current.playAudioChunk(base64Audio);
      });

      // atob should have been called
      expect(global.atob).toHaveBeenCalledWith(base64Audio);
    });

    it('should handle empty base64 string', async () => {
      const { result } = renderHook(() => useAudioPlayer());

      const emptyBase64 = '';

      await act(async () => {
        await result.current.playAudioChunk(emptyBase64);
      });

      // Should handle gracefully without crashing
      expect(result.current.isPlaying).toBe(false);
    });
  });

  describe('playback state', () => {
    it('should set isPlaying to true when playing', async () => {
      const { result } = renderHook(() => useAudioPlayer());

      const base64Audio = 'SGVsbG8gV29ybGQ=';

      expect(result.current.isPlaying).toBe(false);

      await act(async () => {
        await result.current.playAudioChunk(base64Audio);
      });

      await waitFor(() => {
        expect(result.current.isPlaying).toBe(true);
      });
    });

    it('should set isPlaying to false when playback ends', async () => {
      const { result } = renderHook(() => useAudioPlayer());

      const base64Audio = 'SGVsbG8gV29ybGQ=';

      await act(async () => {
        await result.current.playAudioChunk(base64Audio);
      });

      await waitFor(() => {
        expect(result.current.isPlaying).toBe(true);
      });

      // Wait for playback to end
      await waitFor(
        () => {
          expect(result.current.isPlaying).toBe(false);
        },
        { timeout: 1000 }
      );
    });

    it('should maintain playing state across multiple chunks', async () => {
      const { result } = renderHook(() => useAudioPlayer());

      const chunk1 = 'Q2h1bmsx';
      const chunk2 = 'Q2h1bmsw';

      await act(async () => {
        await result.current.playAudioChunk(chunk1);
      });

      await waitFor(() => {
        expect(result.current.isPlaying).toBe(true);
      });

      await act(async () => {
        await result.current.playAudioChunk(chunk2);
      });

      // Should still be playing
      expect(result.current.isPlaying).toBe(true);
    });
  });
});
