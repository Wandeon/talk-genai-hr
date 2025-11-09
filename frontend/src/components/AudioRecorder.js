import React, { useEffect } from 'react';
import useAudioRecorder from '../hooks/useAudioRecorder';
import './AudioRecorder.css';

/**
 * AudioRecorder component - UI for audio recording with visual feedback
 * @param {Object} props
 * @param {function} props.sendAudioChunk - Callback to send audio chunks
 * @param {boolean} [props.isListening] - Optional flag to auto-start/stop recording
 */
const AudioRecorder = ({ sendAudioChunk, isListening }) => {
  const {
    isRecording,
    hasPermission,
    permissionError,
    startRecording,
    stopRecording,
  } = useAudioRecorder(sendAudioChunk);

  // Auto-start/stop based on isListening prop
  useEffect(() => {
    if (isListening === undefined) return;

    if (isListening && hasPermission && !isRecording) {
      startRecording();
    } else if (!isListening && isRecording) {
      stopRecording();
    }
  }, [isListening, hasPermission, isRecording, startRecording, stopRecording]);

  const handleToggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const getStatusText = () => {
    if (hasPermission === null) {
      return 'Requesting microphone access...';
    }
    if (permissionError) {
      return permissionError;
    }
    if (isRecording) {
      return 'Recording...';
    }
    return 'Ready';
  };

  const isButtonDisabled = hasPermission === null || hasPermission === false;

  return (
    <div
      className={`audio-recorder ${isRecording ? 'recording' : ''}`}
      data-testid="audio-recorder"
      aria-busy={isRecording}
    >
      <div className="recorder-status">
        <div className={`status-text ${permissionError ? 'error' : ''}`}>
          {getStatusText()}
        </div>
        {permissionError && (
          <div className="help-text">
            Please grant permission in your browser settings to use voice chat.
          </div>
        )}
      </div>

      {isRecording && (
        <div className="recording-indicator" data-testid="recording-indicator">
          <span className="pulse"></span>
          <span className="recording-text">Recording</span>
        </div>
      )}

      <button
        className={`recorder-button ${isRecording ? 'recording' : ''}`}
        onClick={handleToggleRecording}
        disabled={isButtonDisabled}
        aria-label={isRecording ? 'Stop recording' : 'Start recording'}
      >
        {isRecording ? (
          <span className="button-content">
            <span className="icon stop-icon">⬛</span>
            Stop Recording
          </span>
        ) : (
          <span className="button-content">
            <span className="icon mic-icon">🎤</span>
            Start Recording
          </span>
        )}
      </button>
    </div>
  );
};

export default AudioRecorder;
