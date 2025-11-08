import React from 'react';
import '../styles/ConversationIndicator.css';

function ConversationIndicator({ phase, volumeLevel }) {
  const getPhaseConfig = () => {
    switch (phase) {
      case 'listening':
        return {
          icon: '🎤',
          text: 'Listening for your voice...',
          color: '#4CAF50',
          animated: true
        };
      case 'transcribing':
        return {
          icon: '📝',
          text: 'Converting speech to text...',
          color: '#2196F3',
          animated: true
        };
      case 'thinking':
        return {
          icon: '🤔',
          text: 'AI is thinking...',
          color: '#FF9800',
          animated: true
        };
      case 'speaking':
        return {
          icon: '🔊',
          text: 'AI is responding...',
          color: '#9C27B0',
          animated: true
        };
      case 'paused':
        return {
          icon: '⏸️',
          text: 'Conversation paused',
          color: '#757575',
          animated: false
        };
      case 'idle':
      default:
        return {
          icon: '💬',
          text: 'Ready to start conversation',
          color: '#607D8B',
          animated: false
        };
    }
  };

  const config = getPhaseConfig();

  return (
    <div className="conversation-indicator" style={{ '--phase-color': config.color }}>
      <div className={`phase-icon ${config.animated ? 'animated' : ''}`}>
        {config.icon}
      </div>
      <div className="phase-text">{config.text}</div>

      {phase === 'listening' && volumeLevel !== undefined && (
        <div className="volume-meter">
          <div className="volume-label">Volume</div>
          <div className="volume-bar-container">
            <div
              className="volume-bar-fill"
              style={{ width: `${volumeLevel}%` }}
            />
          </div>
          <div className="volume-percentage">{Math.round(volumeLevel)}%</div>
        </div>
      )}
    </div>
  );
}

export default ConversationIndicator;
