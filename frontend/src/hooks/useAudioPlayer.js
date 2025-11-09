import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Custom hook for playing TTS audio from backend with interrupt support
 * Plays audio chunks received via WebSocket and supports immediate interruption
 * Uses Web Audio API for low-latency playback
 *
 * @returns {Object} - { isPlaying, playAudioChunk, stop, queue }
 */
const useAudioPlayer = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [queue, setQueue] = useState([]);

  // Refs for audio context and playback state
  const audioContextRef = useRef(null);
  const sourceNodeRef = useRef(null);
  const queueRef = useRef([]);
  const isPlayingRef = useRef(false);

  // Initialize AudioContext on mount
  useEffect(() => {
    const initAudioContext = () => {
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
          audioContextRef.current = new AudioContext();
          console.log('AudioContext initialized, sample rate:', audioContextRef.current.sampleRate);
        } else {
          console.warn('AudioContext not available in this browser');
        }
      } catch (error) {
        console.error('Error initializing AudioContext:', error);
      }
    };

    initAudioContext();

    // Cleanup on unmount
    return () => {
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        // Stop current playback
        if (sourceNodeRef.current) {
          try {
            sourceNodeRef.current.stop();
          } catch (error) {
            // Already stopped, ignore
          }
        }
        // Close context
        audioContextRef.current.close().catch(() => {
          // Ignore close errors
        });
      }
    };
  }, []);

  /**
   * Convert base64 string to ArrayBuffer
   * @param {string} base64 - Base64 encoded audio data
   * @returns {ArrayBuffer} - Decoded audio buffer
   */
  const base64ToArrayBuffer = useCallback((base64) => {
    try {
      if (!base64 || base64.length === 0) {
        throw new Error('Empty base64 string');
      }

      // Validate base64 format (should only contain valid base64 characters)
      const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
      if (!base64Regex.test(base64)) {
        throw new Error('Invalid base64 format');
      }

      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes.buffer;
    } catch (error) {
      console.error('Error decoding base64:', error);
      throw error;
    }
  }, []);

  /**
   * Process the next chunk in the queue
   */
  const processQueue = useCallback(async () => {
    if (queueRef.current.length === 0) {
      isPlayingRef.current = false;
      setIsPlaying(false);
      return;
    }

    if (!audioContextRef.current) {
      queueRef.current = [];
      setQueue([]);
      return;
    }

    const chunk = queueRef.current.shift();
    setQueue([...queueRef.current]);

    try {
      // Resume audio context if needed (for browser autoplay policies)
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      // Decode base64 to ArrayBuffer
      const arrayBuffer = base64ToArrayBuffer(chunk);

      // Decode audio data
      const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);

      // Create source node
      const sourceNode = audioContextRef.current.createBufferSource();
      sourceNode.buffer = audioBuffer;
      sourceNode.connect(audioContextRef.current.destination);

      // Set up end callback to process next chunk
      sourceNode.onended = () => {
        sourceNodeRef.current = null;
        processQueue();
      };

      // Store reference to current source
      sourceNodeRef.current = sourceNode;

      // Mark as playing
      isPlayingRef.current = true;
      setIsPlaying(true);

      // Start playback
      sourceNode.start(0);

      console.log('Playing audio chunk, queue length:', queueRef.current.length);
    } catch (error) {
      console.error('Error playing audio chunk:', error);
      // Continue to next chunk on error
      processQueue();
    }
  }, [base64ToArrayBuffer]);

  /**
   * Play an audio chunk (base64 encoded)
   * Queues the chunk for playback or starts playback immediately
   *
   * @param {string} base64Audio - Base64 encoded audio data
   * @returns {Promise<void>}
   */
  const playAudioChunk = useCallback(
    async (base64Audio) => {
      if (!base64Audio) {
        return;
      }

      if (!audioContextRef.current) {
        console.warn('AudioContext not available');
        return;
      }

      // Add chunk to queue
      queueRef.current.push(base64Audio);
      setQueue([...queueRef.current]);

      // If not currently playing, start processing queue
      if (!isPlayingRef.current) {
        processQueue();
      }
    },
    [processQueue]
  );

  /**
   * Stop playback immediately and clear the queue
   * Used for interruption when user speaks
   */
  const stop = useCallback(() => {
    try {
      // Stop current source
      if (sourceNodeRef.current) {
        sourceNodeRef.current.stop();
        sourceNodeRef.current = null;
      }

      // Clear queue
      queueRef.current = [];
      setQueue([]);

      // Update state
      isPlayingRef.current = false;
      setIsPlaying(false);

      console.log('Audio playback stopped');
    } catch (error) {
      console.error('Error stopping audio:', error);
      // Force state reset on error
      isPlayingRef.current = false;
      setIsPlaying(false);
    }
  }, []);

  return {
    isPlaying,
    playAudioChunk,
    stop,
    queue,
  };
};

export default useAudioPlayer;
