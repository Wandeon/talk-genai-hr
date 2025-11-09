import React, { useState, useEffect } from 'react';
import './ServiceStatus.css';

/**
 * ServiceStatus Component
 *
 * Displays the status of backend AI services (VAD, STT, LLM, TTS).
 * Features:
 * - Fetches service status from backend /api/status endpoint
 * - Auto-refreshes at configurable interval
 * - Color-coded status indicators (green=online, red=offline, gray=unknown)
 * - Expand/collapse functionality
 * - Last updated timestamp
 * - Error handling with retry button
 * - Uses AbortController for fetch cancellation
 */
function ServiceStatus({ backendUrl = 'http://localhost:3001', refreshInterval = 30000 }) {
  const [services, setServices] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  /**
   * Fetch service status from backend
   */
  const fetchServiceStatus = async () => {
    const controller = new AbortController();
    let timeout;

    try {
      setLoading(true);
      setError(null);

      // Only set timeout if abort method exists (may not in test environments)
      if (controller && typeof controller.abort === 'function') {
        timeout = setTimeout(() => controller.abort(), 5000); // 5 second timeout
      }

      const fetchOptions = {
        signal: controller.signal
      };

      const response = await fetch(`${backendUrl}/api/status`, fetchOptions);

      if (timeout) clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setServices(data);
      setLastUpdated(new Date());
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError(err.message || 'Failed to fetch service status');
      }
    } finally {
      setLoading(false);
      if (timeout) clearTimeout(timeout);
    }
  };

  /**
   * Retry fetching service status
   */
  const handleRetry = () => {
    fetchServiceStatus();
  };

  /**
   * Toggle expand/collapse
   */
  const handleToggleExpand = () => {
    setExpanded(!expanded);
  };

  /**
   * Format timestamp for display
   */
  const formatTimestamp = (date) => {
    if (!date) return null;
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  };

  /**
   * Fetch on mount and set up auto-refresh interval
   */
  useEffect(() => {
    // Fetch on mount
    fetchServiceStatus();

    // Set up auto-refresh interval
    const intervalId = setInterval(() => {
      fetchServiceStatus();
    }, refreshInterval);

    // Cleanup interval on unmount
    return () => {
      clearInterval(intervalId);
    };
  }, [backendUrl, refreshInterval]);

  // Loading state
  if (loading && !services) {
    return (
      <div className="service-status">
        <div className="status-header">
          <h3>Service Status</h3>
        </div>
        <div className="status-content">
          <p className="loading-message">Loading service status...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !services) {
    return (
      <div className="service-status">
        <div className="status-header">
          <h3>Service Status</h3>
        </div>
        <div className="status-content error-state">
          <p className="error-message">Error: {error}</p>
          <button className="retry-button" onClick={handleRetry}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!services) {
    return null;
  }

  /**
   * Render individual service item
   */
  const renderServiceItem = (name, service) => {
    if (!service) return null;

    return (
      <div key={name} className="service-item">
        <div className="service-indicator-row">
          <span className={`status-indicator ${service.status}`}></span>
          <span className="service-name">{name.toUpperCase()}</span>
          <span className={`status-text ${service.status}`}>
            {service.status.charAt(0).toUpperCase() + service.status.slice(1)}
          </span>
        </div>
        <div className="service-url">{service.url}</div>
      </div>
    );
  };

  return (
    <div className="service-status">
      <div className="status-header">
        <div className="header-left">
          <h3>Service Status</h3>
          {lastUpdated && (
            <span className="last-updated">
              Updated: {formatTimestamp(lastUpdated)}
            </span>
          )}
        </div>
        <button
          className="toggle-button"
          onClick={handleToggleExpand}
          aria-label={expanded ? 'Collapse services' : 'Expand services'}
        >
          {expanded ? '▼' : '▶'}
        </button>
      </div>

      {expanded && (
        <div className="status-content">
          <div className="service-list expanded">
            {renderServiceItem('vad', services.vad)}
            {renderServiceItem('stt', services.stt)}
            {renderServiceItem('llm', services.llm)}
            {renderServiceItem('tts', services.tts)}
          </div>
          {error && (
            <div className="status-footer">
              <p className="error-message-small">Last error: {error}</p>
              <button className="retry-button-small" onClick={handleRetry}>
                Retry
              </button>
            </div>
          )}
        </div>
      )}

      {!expanded && (
        <div className="status-content collapsed">
          <div className="service-list collapsed">
            <div className="collapsed-indicator">
              <span className={`status-indicator ${getOverallStatus(services)}`}></span>
              <span className="status-summary">
                {getStatusSummary(services)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Get overall status based on all services
 */
function getOverallStatus(services) {
  if (!services) return 'unknown';

  const statuses = Object.values(services).map(s => s?.status);
  const onlineCount = statuses.filter(s => s === 'online').length;
  const offlineCount = statuses.filter(s => s === 'offline').length;

  if (offlineCount > 0) return 'offline';
  if (statuses.includes('unknown')) return 'unknown';
  return 'online';
}

/**
 * Get status summary text
 */
function getStatusSummary(services) {
  if (!services) return 'Unknown';

  const statuses = Object.values(services).map(s => s?.status);
  const onlineCount = statuses.filter(s => s === 'online').length;
  const totalCount = statuses.length;

  if (onlineCount === totalCount) return 'All Online';
  if (onlineCount === 0) return 'All Offline';
  return `${onlineCount}/${totalCount} Online`;
}

export default ServiceStatus;
