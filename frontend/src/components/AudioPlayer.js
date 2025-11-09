import React from 'react';
import useAudioPlayer from '../hooks/useAudioPlayer';
import './AudioPlayer.css';

/**
 * AudioPlayer Component
 * UI component for displaying audio playback status and control
 * Shows visual indicator when audio is playing and queue status
 */
const AudioPlayer = ({ onAudioStateChange }) => {
  const { isPlaying, playAudioChunk, stop, queue } = useAudioPlayer();

  // Notify parent component of state changes
  React.useEffect(() => {
    if (onAudioStateChange) {
      onAudioStateChange({ isPlaying, queueLength: queue.length });
    }
  }, [isPlaying, queue.length, onAudioStateChange]);

  return (
    <div className="audio-player">
      <div className="audio-player-status">
        <div className={`playback-indicator ${isPlaying ? 'playing' : 'stopped'}`}>
          <div className="indicator-dot"></div>
          <span className="status-text">
            {isPlaying ? 'Playing audio...' : 'Ready'}
          </span>
        </div>

        {queue.length > 0 && (
          <div className="queue-info">
            <span className="queue-label">Queued chunks:</span>
            <span className="queue-count">{queue.length}</span>
          </div>
        )}
      </div>

      {isPlaying && (
        <button className="stop-button" onClick={stop} title="Stop audio playback (interrupt)">
          Stop Playing
        </button>
      )}
    </div>
  );
};

// Export both component and hook for direct access if needed
export { useAudioPlayer };
export default AudioPlayer;
