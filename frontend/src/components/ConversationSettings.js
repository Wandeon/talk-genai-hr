import React, { useState } from 'react';
import '../styles/ConversationSettings.css';

function ConversationSettings({ settings, onSettingsChange, isOpen, onToggle }) {
  const handleChange = (key, value) => {
    onSettingsChange({ ...settings, [key]: value });
  };

  return (
    <div className={`settings-panel ${isOpen ? 'open' : ''}`}>
      <button className="settings-toggle" onClick={onToggle}>
        ⚙️ Settings
      </button>

      {isOpen && (
        <div className="settings-content">
          <h3>Conversation Settings</h3>

          {/* Note: Silence detection is now automatic based on speech patterns */}

          {/* Silence Duration */}
          <div className="setting-item">
            <label htmlFor="silenceDuration">
              Silence Duration
              <span className="setting-help">Seconds of silence before stopping</span>
            </label>
            <div className="button-group">
              {[1, 1.5, 2, 2.5, 3].map((duration) => (
                <button
                  key={duration}
                  className={`duration-btn ${settings.silenceDuration === duration ? 'active' : ''}`}
                  onClick={() => handleChange('silenceDuration', duration)}
                >
                  {duration}s
                </button>
              ))}
            </div>
          </div>

          {/* Auto-restart */}
          <div className="setting-item">
            <label htmlFor="autoRestart">
              Auto-restart Recording
              <span className="setting-help">Continue listening after AI responds</span>
            </label>
            <div className="toggle-container">
              <input
                type="checkbox"
                id="autoRestart"
                checked={settings.autoRestart}
                onChange={(e) => handleChange('autoRestart', e.target.checked)}
              />
              <label htmlFor="autoRestart" className="toggle-switch">
                <span className="toggle-slider"></span>
              </label>
              <span className="toggle-label">{settings.autoRestart ? 'On' : 'Off'}</span>
            </div>
          </div>

          {/* Inactivity Timeout */}
          <div className="setting-item">
            <label htmlFor="inactivityTimeout">
              Inactivity Timeout
              <span className="setting-help">Auto-pause after silence (seconds)</span>
            </label>
            <div className="slider-container">
              <span className="slider-label">30s</span>
              <input
                type="range"
                id="inactivityTimeout"
                min="30"
                max="300"
                step="30"
                value={settings.inactivityTimeout}
                onChange={(e) => handleChange('inactivityTimeout', parseInt(e.target.value))}
              />
              <span className="slider-label">5m</span>
            </div>
            <div className="slider-value">{settings.inactivityTimeout}s ({Math.round(settings.inactivityTimeout / 60)}m)</div>
          </div>

          {/* Noise Reduction */}
          <div className="setting-item">
            <label htmlFor="noiseReduction">
              Background Noise Reduction
              <span className="setting-help">Filter out background noise</span>
            </label>
            <div className="toggle-container">
              <input
                type="checkbox"
                id="noiseReduction"
                checked={settings.noiseReduction}
                onChange={(e) => handleChange('noiseReduction', e.target.checked)}
              />
              <label htmlFor="noiseReduction" className="toggle-switch">
                <span className="toggle-slider"></span>
              </label>
              <span className="toggle-label">{settings.noiseReduction ? 'On' : 'Off'}</span>
            </div>
          </div>

          <div className="settings-footer">
            <button className="reset-btn" onClick={() => onSettingsChange(getDefaultSettings())}>
              Reset to Defaults
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function getDefaultSettings() {
  return {
    silenceDuration: 2,          // seconds
    autoRestart: true,           // auto-continue conversation
    inactivityTimeout: 60,       // seconds (1 minute)
    noiseReduction: true         // enable noise filtering
  };
}

export default ConversationSettings;
