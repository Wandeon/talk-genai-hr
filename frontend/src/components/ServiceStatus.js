import React from 'react';

function ServiceStatus({ status }) {
  if (!status) {
    return (
      <div className="service-status">
        <span className="status-badge status-unknown">Checking services...</span>
      </div>
    );
  }

  const allOnline = status.stt?.status === 'online' &&
                    status.llm?.status === 'online' &&
                    status.tts?.status === 'online';

  return (
    <div className="service-status">
      <div className="status-summary">
        {allOnline ? (
          <span className="status-badge status-online">✓ All Services Online</span>
        ) : (
          <span className="status-badge status-offline">⚠ Some Services Offline</span>
        )}
      </div>
      <div className="status-details">
        <span className={`service-item ${status.stt?.status}`}>
          STT: {status.stt?.status === 'online' ? '✓' : '✗'}
        </span>
        <span className={`service-item ${status.llm?.status}`}>
          LLM: {status.llm?.status === 'online' ? '✓' : '✗'}
        </span>
        <span className={`service-item ${status.tts?.status}`}>
          TTS: {status.tts?.status === 'online' ? '✓' : '✗'}
        </span>
      </div>
    </div>
  );
}

export default ServiceStatus;
