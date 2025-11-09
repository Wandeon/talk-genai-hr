import React from 'react';
import './PhaseIndicator.css';

/**
 * PhaseIndicator Component
 * Displays animated visual indicators for different conversation phases
 *
 * @param {Object} props
 * @param {string} props.currentPhase - Current conversation phase: 'idle', 'listening', 'transcribing', 'thinking', 'speaking'
 * @returns {JSX.Element} Phase indicator with animations
 */

const PhaseIndicator = ({ currentPhase = 'idle' }) => {
  // Phase configuration with labels, descriptions, and icons
  const phaseConfig = {
    idle: {
      name: 'Ready',
      description: 'Ready to start',
      icon: '●',
      ariaLabel: 'Idle: System is ready',
    },
    listening: {
      name: 'Listening',
      description: 'Listening for audio input',
      icon: '🎤',
      ariaLabel: 'Listening: Microphone is active',
    },
    transcribing: {
      name: 'Transcribing',
      description: 'Converting speech to text',
      icon: '📝',
      ariaLabel: 'Transcribing: Converting speech to text',
    },
    thinking: {
      name: 'Thinking',
      description: 'Processing your request',
      icon: '⚙',
      ariaLabel: 'Thinking: Processing your request',
    },
    speaking: {
      name: 'Speaking',
      description: 'Voice output in progress',
      icon: '🔊',
      ariaLabel: 'Speaking: Voice output in progress',
    },
  };

  const config = phaseConfig[currentPhase] || phaseConfig.idle;

  return (
    <div
      className={`phase-indicator-wrapper phase-${currentPhase}`}
      data-testid="phase-indicator"
      role="status"
      aria-live="polite"
      aria-label={config.ariaLabel}
    >
      <div className="phase-indicator-content">
        <div className="phase-indicator-icon" data-testid="phase-icon">
          {config.icon}
        </div>

        <div className="phase-indicator-text">
          <div className="phase-name">{config.name}</div>
          <div className="phase-description">{config.description}</div>
        </div>

        <div
          className={`phase-indicator-animation indicator-${currentPhase}`}
          data-testid="phase-indicator-animation"
        >
          {currentPhase === 'idle' && <div className="indicator-dot" />}
          {currentPhase === 'listening' && (
            <div className="waveform-container">
              <div className="waveform-bar" />
              <div className="waveform-bar" />
              <div className="waveform-bar" />
              <div className="waveform-bar" />
            </div>
          )}
          {currentPhase === 'transcribing' && (
            <div className="bars-loader">
              <div className="bar" />
              <div className="bar" />
              <div className="bar" />
            </div>
          )}
          {currentPhase === 'thinking' && (
            <div className="spinner-container">
              <div className="spinner-dot" />
              <div className="spinner-dot" />
              <div className="spinner-dot" />
            </div>
          )}
          {currentPhase === 'speaking' && (
            <div className="equalizer-container">
              <div className="equalizer-bar" />
              <div className="equalizer-bar" />
              <div className="equalizer-bar" />
              <div className="equalizer-bar" />
              <div className="equalizer-bar" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PhaseIndicator;
