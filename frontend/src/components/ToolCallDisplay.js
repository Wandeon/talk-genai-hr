import React, { useState } from 'react';
import './ToolCallDisplay.css';

/**
 * ToolCallDisplay Component
 * Displays LLM function/tool calls with their arguments and results
 *
 * @component
 * @param {Object} props - Component props
 * @param {Object} props.toolCall - Tool call object containing:
 *   @param {string} props.toolCall.toolName - Name of the tool being called
 *   @param {Object} props.toolCall.args - Arguments passed to the tool
 *   @param {string} props.toolCall.status - Current status: 'executing', 'completed', or 'error'
 *   @param {Object} [props.toolCall.result] - Result of the tool execution (when completed)
 * @returns {React.ReactElement} The rendered component
 */
const ToolCallDisplay = ({ toolCall }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!toolCall) {
    return null;
  }

  const { toolName, args = {}, status, result } = toolCall;

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  /**
   * Format arguments for display
   * Converts nested objects and arrays to readable format
   */
  const formatValue = (value, isDeep = false) => {
    if (value === null || value === undefined) {
      return <span className="value-null">null</span>;
    }

    if (typeof value === 'boolean') {
      return <span className={`value-boolean value-${value}`}>{String(value)}</span>;
    }

    if (typeof value === 'number') {
      return <span className="value-number">{value}</span>;
    }

    if (typeof value === 'string') {
      // Handle long strings
      const maxLength = 100;
      if (value.length > maxLength && !isDeep) {
        return (
          <span className="value-string">
            {value.substring(0, maxLength)}
            <span className="value-truncated">... ({value.length} chars)</span>
          </span>
        );
      }
      return <span className="value-string">"{value}"</span>;
    }

    if (Array.isArray(value)) {
      return (
        <div className="value-array">
          <span className="bracket">[</span>
          <div className="array-items">
            {value.map((item, idx) => (
              <div key={idx} className="array-item">
                {formatValue(item, true)}
                {idx < value.length - 1 && <span className="comma">,</span>}
              </div>
            ))}
          </div>
          <span className="bracket">]</span>
        </div>
      );
    }

    if (typeof value === 'object') {
      return (
        <div className="value-object">
          <span className="bracket">{'{'}</span>
          <div className="object-properties">
            {Object.entries(value).map(([key, val], idx, arr) => (
              <div key={key} className="object-property">
                <span className="property-key">{key}:</span>
                <span className="property-value">{formatValue(val, true)}</span>
                {idx < arr.length - 1 && <span className="comma">,</span>}
              </div>
            ))}
          </div>
          <span className="bracket">{'}'}</span>
        </div>
      );
    }

    return <span>{String(value)}</span>;
  };

  /**
   * Get status display text
   */
  const getStatusText = () => {
    switch (status) {
      case 'executing':
        return 'Executing';
      case 'completed':
        return 'Completed';
      case 'error':
        return 'Error';
      default:
        return status || 'Unknown';
    }
  };

  /**
   * Check if has arguments
   */
  const hasArguments = Object.keys(args).length > 0;

  /**
   * Render arguments section
   */
  const renderArguments = () => {
    if (!hasArguments) {
      return (
        <div className="arguments-section">
          <div className="empty-arguments">No arguments</div>
        </div>
      );
    }

    return (
      <div className="arguments-section">
        <div className="arguments-content">
          {Object.entries(args).map(([key, value]) => (
            <div key={key} className="argument-item">
              <span className="argument-label">{key}:</span>
              <div className="argument-value">
                {formatValue(value)}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  /**
   * Render result section
   */
  const renderResult = () => {
    if (!result || status === 'executing') {
      return null;
    }

    if (status === 'error') {
      const errorMessage = result.error || JSON.stringify(result);
      return (
        <div className="result-section error-section">
          <div className="result-header">
            <span className="result-label">Error</span>
          </div>
          <div className="error-message">
            {errorMessage}
          </div>
        </div>
      );
    }

    return (
      <div className="result-section">
        <div className="result-header">
          <span className="result-label">Result</span>
        </div>
        <div className="result-content">
          {formatValue(result)}
        </div>
      </div>
    );
  };

  return (
    <article
      className={`tool-call-display ${status} ${isExpanded ? 'expanded' : 'collapsed'}`}
      data-testid="tool-call-display"
      aria-label={`Tool call: ${toolName} - ${getStatusText()}`}
    >
      {/* Header with tool name and status */}
      <div className="tool-call-header">
        <div className="tool-info">
          <h3 className="tool-name">{toolName}</h3>
          <span
            className={`status-badge ${status}`}
            data-testid="status-badge"
            role="status"
            aria-live="polite"
          >
            {getStatusText()}
          </span>
        </div>

        {/* Loading indicator for executing state */}
        {status === 'executing' && (
          <div
            className="loading-spinner"
            data-testid="loading-spinner"
            aria-label="Tool is executing"
            aria-live="polite"
          >
            <div className="spinner-ring"></div>
            <span className="sr-only">Executing tool</span>
          </div>
        )}
      </div>

      {/* Arguments and Result sections */}
      <div className="tool-call-body">
        {/* Expandable arguments section */}
        {hasArguments && (
          <div className="expandable-section arguments-wrapper">
            <button
              className="expand-button"
              onClick={toggleExpanded}
              aria-expanded={isExpanded}
              aria-label="Toggle details"
            >
              <span className="expand-icon">
                {isExpanded ? '−' : '+'}
              </span>
              <span className="expand-label">Arguments</span>
            </button>
            {isExpanded && renderArguments()}
          </div>
        )}

        {/* Non-expandable arguments section if no arguments */}
        {!hasArguments && (
          <div className="expandable-section arguments-wrapper">
            <button
              className="expand-button"
              onClick={toggleExpanded}
              aria-expanded={isExpanded}
              aria-label="Toggle details"
            >
              <span className="expand-icon">
                {isExpanded ? '−' : '+'}
              </span>
              <span className="expand-label">Arguments</span>
            </button>
            {isExpanded && renderArguments()}
          </div>
        )}

        {/* Result section */}
        {renderResult()}
      </div>
    </article>
  );
};

export default ToolCallDisplay;
