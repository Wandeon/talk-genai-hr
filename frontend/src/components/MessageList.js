import React, { useRef, useEffect } from 'react';
import { useConversation } from '../context/ConversationContext';
import './MessageList.css';

/**
 * MessageList component displays conversation messages with streaming support
 * Features:
 * - Displays all messages from conversation context
 * - Shows streaming LLM responses in real-time
 * - Shows partial transcripts during transcription
 * - Auto-scrolls to latest message
 * - Supports different message types (text, audio, error)
 * - Displays message metadata (timestamps, durations, tool calls)
 */
function MessageList() {
  const { state } = useConversation();
  const messagesEndRef = useRef(null);
  const {
    messages,
    currentTranscript,
    currentLLMResponse,
    state: conversationState,
    activeTool,
  } = state;

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    const scrollToBottom = () => {
      if (messagesEndRef.current?.scrollIntoView) {
        messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    };

    const rafId = requestAnimationFrame(scrollToBottom);
    return () => cancelAnimationFrame(rafId);
  }, [messages, currentLLMResponse, currentTranscript]);

  // Format timestamp for display
  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Format duration for audio messages
  const formatDuration = (duration) => {
    return `${duration.toFixed(1)}s`;
  };

  // Render a single message
  const renderMessage = (message, index) => {
    const { id, role, content, timestamp, type, duration } = message;
    const safeId = id || `msg-${timestamp}-${index}`;

    return (
      <div
        key={safeId}
        className={`message message-${role} message-type-${type}`}
        role="article"
        aria-label={`${role} message`}
      >
        <div className="message-header">
          <span className="message-role" aria-label={`Message from ${role}`}>
            {role === 'user' ? 'You' : role === 'assistant' ? 'Assistant' : 'System'}
          </span>
          <span className="message-time" aria-label={`Sent at ${formatTime(timestamp)}`}>
            {formatTime(timestamp)}
          </span>
        </div>
        <div className="message-content">{content}</div>
        {duration && (
          <div className="message-metadata">
            <span className="message-duration" aria-label={`Duration ${formatDuration(duration)}`}>
              Duration: {formatDuration(duration)}
            </span>
          </div>
        )}
      </div>
    );
  };

  // Render streaming LLM response
  const renderStreamingResponse = () => {
    if (
      (conversationState === 'thinking' || conversationState === 'speaking') &&
      currentLLMResponse
    ) {
      return (
        <div
          className="message message-assistant message-streaming"
          role="article"
          aria-label="Assistant streaming response"
          aria-live="polite"
        >
          <div className="message-header">
            <span className="message-role">Assistant</span>
            <span className="message-time">{formatTime(Date.now())}</span>
          </div>
          <div className="message-content">
            {currentLLMResponse}
            <span className="typing-indicator" aria-label="Typing">
              ...
            </span>
          </div>
        </div>
      );
    }
    return null;
  };

  // Render current transcript
  const renderCurrentTranscript = () => {
    if (conversationState === 'transcribing' && currentTranscript) {
      return (
        <div
          className="message message-user message-transcribing"
          role="article"
          aria-label="Current transcript"
          aria-live="polite"
        >
          <div className="message-header">
            <span className="message-role">You</span>
            <span className="message-time">{formatTime(Date.now())}</span>
          </div>
          <div className="message-content">
            {currentTranscript}
            <span className="transcribing-indicator" aria-label="Transcribing">
              ...
            </span>
          </div>
        </div>
      );
    }
    return null;
  };

  // Render active tool indicator
  const renderActiveTool = () => {
    if (activeTool) {
      return (
        <div
          className="message message-tool"
          role="status"
          aria-label="Tool execution in progress"
        >
          <div className="message-header">
            <span className="message-role">Tool</span>
            <span className="message-time">{formatTime(Date.now())}</span>
          </div>
          <div className="message-content">
            Executing: <strong>{activeTool.toolName}</strong>
            {activeTool.result && (
              <div className="tool-result">Result available</div>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div
      className="message-list"
      role="log"
      aria-label="Conversation messages"
      aria-live="polite"
    >
      {messages.map(renderMessage)}
      {renderCurrentTranscript()}
      {renderStreamingResponse()}
      {renderActiveTool()}
      <div ref={messagesEndRef} aria-hidden="true" />
    </div>
  );
}

export default MessageList;
