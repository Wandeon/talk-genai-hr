import React from 'react';

function ChatMessage({ message }) {
  const { role, content, timestamp } = message;

  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className={`message message-${role}`}>
      <div className="message-header">
        <span className="message-role">
          {role === 'user' ? '👤 You' : role === 'assistant' ? '🤖 AI' : '⚠️ System'}
        </span>
        <span className="message-time">{formatTime(timestamp)}</span>
      </div>
      <div className="message-content">{content}</div>
    </div>
  );
}

export default ChatMessage;
