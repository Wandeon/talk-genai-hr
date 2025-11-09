import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Custom hook for recording audio continuously and sending chunks to backend
 * @param {function} sendAudioChunk - Callback to send audio chunks (receives base64 string)
 * @returns {Object} - { isRecording, hasPermission, permissionError, startRecording, stopRecording }
 */
const useAudioRecorder = (sendAudioChunk) => {
  const [isRecording, setIsRecording] = useState(false);
  const [hasPermission, setHasPermission] = useState(null);
  const [permissionError, setPermissionError] = useState(null);

  const mediaStreamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const sendAudioChunkRef = useRef(sendAudioChunk);
  const mountedRef = useRef(true);

  // Keep sendAudioChunk ref up to date
  useEffect(() => {
    sendAudioChunkRef.current = sendAudioChunk;
  }, [sendAudioChunk]);

  // Request microphone permission on mount
  useEffect(() => {
    const requestPermission = async () => {
      // Check if MediaRecorder is supported
      if (typeof MediaRecorder === 'undefined') {
        setHasPermission(false);
        setPermissionError('MediaRecorder API is not supported in this browser.');
        return;
      }

      try {
        // Only check permission, don't keep stream
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop()); // Immediately stop
        setHasPermission(true);
        setPermissionError(null);
      } catch (error) {
        console.error('Error requesting microphone permission:', error);
        setHasPermission(false);

        // Handle specific error types
        if (error.name === 'NotAllowedError') {
          setPermissionError('Microphone access denied. Please grant permission to use voice chat.');
        } else if (error.name === 'NotFoundError') {
          setPermissionError('No microphone found. Please connect a microphone.');
        } else {
          setPermissionError(error.message || 'Failed to access microphone.');
        }
      }
    };

    requestPermission();

    // Cleanup on unmount
    return () => {
      mountedRef.current = false;
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // Convert blob to base64
  const blobToBase64 = (blob) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  // Start recording
  const startRecording = useCallback(async () => {
    if (!hasPermission) {
      console.warn('Cannot start recording: Permission not granted');
      return;
    }

    // Request fresh stream when recording starts
    if (!mediaStreamRef.current) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaStreamRef.current = stream;
      } catch (error) {
        console.error('Error getting media stream for recording:', error);
        return;
      }
    }

    try {
      // Determine supported mime type
      let mimeType = 'audio/webm';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/wav';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          console.warn('Neither audio/webm nor audio/wav is supported, using default');
          mimeType = undefined;
        }
      }

      const options = mimeType ? { mimeType } : {};
      const mediaRecorder = new MediaRecorder(mediaStreamRef.current, options);
      mediaRecorderRef.current = mediaRecorder;

      // Handle data available event (audio chunks)
      mediaRecorder.ondataavailable = async (event) => {
        if (event.data && event.data.size > 0 && mountedRef.current) {
          try {
            const base64Data = await blobToBase64(event.data);
            const base64Only = base64Data.split(',')[1]; // Strip "data:audio/webm;base64,"
            sendAudioChunkRef.current(base64Only);
          } catch (error) {
            console.error('Error converting audio chunk to base64:', error);
          }
        }
      };

      // Handle recording start
      mediaRecorder.onstart = () => {
        setIsRecording(true);
      };

      // Handle recording stop
      mediaRecorder.onstop = () => {
        setIsRecording(false);
      };

      // Handle errors
      mediaRecorder.onerror = (error) => {
        console.error('MediaRecorder error:', error);
        setIsRecording(false);
      };

      // Start recording with 100ms chunks for low latency
      mediaRecorder.start(100);
    } catch (error) {
      console.error('Error starting recording:', error);
    }
  }, [hasPermission]);

  // Stop recording
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  return {
    isRecording,
    hasPermission,
    permissionError,
    startRecording,
    stopRecording,
  };
};

export default useAudioRecorder;
