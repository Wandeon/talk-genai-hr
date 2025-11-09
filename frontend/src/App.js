import React, { useCallback, useEffect, useRef } from 'react';
import { ConversationProvider, useConversation } from './context/ConversationContext';
import { actions } from './context/conversationReducer';
import useWebSocket from './hooks/useWebSocket';
import useAudioPlayer from './hooks/useAudioPlayer';
import MessageList from './components/MessageList';
import AudioRecorder from './components/AudioRecorder';
import AudioPlayer from './components/AudioPlayer';
import VisionUploader from './components/VisionUploader';
import ToolCallDisplay from './components/ToolCallDisplay';
import PhaseIndicator from './components/PhaseIndicator';
import ServiceStatus from './components/ServiceStatus';
import './App.css';

// Get backend and WebSocket URLs dynamically at runtime
const getBackendUrl = () => {
  // Use current hostname with port 3001
  const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
  return `${protocol}//${window.location.hostname}:3001`;
};

const getWebSocketUrl = () => {
  // Use current hostname with WebSocket protocol
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.hostname}:3001`;
};

/**
 * Main App Component (Inner)
 * Contains all the business logic and WebSocket handling
 */
function AppInner() {
  const { state, dispatch } = useConversation();
  const { playAudioChunk, stop: stopAudio } = useAudioPlayer();
  const currentLLMResponseRef = useRef('');

  // WebSocket message handler
  const handleWebSocketMessage = useCallback(
    (message) => {
      console.log('WebSocket message received:', message);

      switch (message.type) {
        case 'connected':
          // Set session ID and connection status
          if (message.sessionId) {
            dispatch(actions.setSessionId(message.sessionId));
          }
          dispatch(actions.setConnected(true));
          console.log('Connected to WebSocket with session:', message.sessionId);
          break;

        case 'state_change':
          // Update conversation state
          if (message.state) {
            dispatch(actions.setState(message.state));
          }
          break;

        case 'transcript_partial':
          // Update current transcript (partial/streaming)
          if (message.transcript) {
            dispatch(actions.updateCurrentTranscript(message.transcript));
          }
          break;

        case 'transcript_final':
          // Add user message and clear current transcript
          if (message.transcript) {
            const userMessage = {
              id: `user-${Date.now()}`,
              role: 'user',
              content: message.transcript,
              timestamp: Date.now(),
              type: 'text',
            };
            dispatch(actions.addMessage(userMessage));
            dispatch(actions.updateCurrentTranscript(''));
          }
          break;

        case 'llm_token':
          // Append token to current LLM response
          if (message.token) {
            currentLLMResponseRef.current += message.token;
            dispatch(actions.updateCurrentLLMResponse(currentLLMResponseRef.current));
          }
          break;

        case 'llm_complete':
          // Add assistant message and clear current LLM response
          const assistantMessage = {
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            content: message.content || currentLLMResponseRef.current,
            timestamp: Date.now(),
            type: 'text',
          };
          dispatch(actions.addMessage(assistantMessage));
          dispatch(actions.updateCurrentLLMResponse(''));
          currentLLMResponseRef.current = '';
          break;

        case 'audio_chunk':
          // Play audio chunk
          if (message.chunk) {
            playAudioChunk(message.chunk);
          }
          break;

        case 'audio_complete':
          // Audio playback finished
          console.log('Audio playback complete');
          break;

        case 'tool_call_start':
          // Set active tool
          if (message.toolName) {
            dispatch(
              actions.setActiveTool({
                toolName: message.toolName,
                args: message.args || {},
                status: 'executing',
              })
            );
          }
          break;

        case 'tool_call_result':
          // Update tool result
          if (message.result) {
            dispatch(actions.updateToolResult(message.result));
          }
          // Clear active tool after a delay
          setTimeout(() => {
            dispatch(actions.clearActiveTool());
          }, 3000);
          break;

        case 'vision_result':
          // Handle vision analysis result
          if (message.result) {
            const visionMessage = {
              id: `vision-${Date.now()}`,
              role: 'assistant',
              content: message.result,
              timestamp: Date.now(),
              type: 'text',
            };
            dispatch(actions.addMessage(visionMessage));
          }
          break;

        case 'interrupted':
          // Handle interruption
          dispatch(actions.setInterrupted(true));
          dispatch(actions.updateCurrentLLMResponse(''));
          currentLLMResponseRef.current = '';
          stopAudio();
          break;

        case 'error':
          // Display error
          dispatch(
            actions.setError({
              message: message.error || 'An error occurred',
              phase: message.phase,
            })
          );
          // Add error message to chat
          const errorMessage = {
            id: `error-${Date.now()}`,
            role: 'system',
            content: `Error: ${message.error || 'An error occurred'}`,
            timestamp: Date.now(),
            type: 'error',
          };
          dispatch(actions.addMessage(errorMessage));
          break;

        case 'stop_speaking':
          // Stop audio playback
          stopAudio();
          break;

        default:
          console.warn('Unknown message type:', message.type);
      }
    },
    [dispatch, playAudioChunk, stopAudio]
  );

  // Initialize WebSocket connection (get URL at runtime)
  const { isConnected, sendMessage } = useWebSocket(getWebSocketUrl(), handleWebSocketMessage);

  // Update connection status in context
  useEffect(() => {
    dispatch(actions.setConnected(isConnected));
  }, [isConnected, dispatch]);

  // Send audio chunk to backend
  const handleSendAudioChunk = useCallback(
    (chunk) => {
      sendMessage({
        type: 'audio_chunk',
        chunk,
      });
    },
    [sendMessage]
  );

  // Start conversation
  const handleStartConversation = useCallback(() => {
    sendMessage({ type: 'start_conversation' });
    dispatch(actions.setState('listening'));
  }, [sendMessage, dispatch]);

  // Stop conversation
  const handleStopConversation = useCallback(() => {
    sendMessage({ type: 'stop_conversation' });
    dispatch(actions.setState('idle'));
  }, [sendMessage, dispatch]);

  // Interrupt (user speaks while AI is speaking)
  const handleInterrupt = useCallback(() => {
    sendMessage({ type: 'interrupt' });
    stopAudio();
  }, [sendMessage, stopAudio]);

  // Upload image for vision analysis
  const handleUploadImage = useCallback(
    async (imageBase64, prompt) => {
      sendMessage({
        type: 'upload_image',
        image: imageBase64,
        prompt: prompt || 'What do you see in this image?',
      });
    },
    [sendMessage]
  );

  // Send text message (for future use)
  // const handleSendTextMessage = useCallback(
  //   (text) => {
  //     sendMessage({
  //       type: 'user_message',
  //       message: text,
  //     });
  //   },
  //   [sendMessage]
  // );

  // Check if conversation is in progress
  const isConversationActive =
    state.state === 'listening' ||
    state.state === 'transcribing' ||
    state.state === 'thinking' ||
    state.state === 'speaking';

  return (
    <div className="app">
      {/* Header */}
      <header className="app-header">
        <div className="header-content">
          <h1 className="app-title">Voice Chat App</h1>
          <div className="header-status">
            <ServiceStatus backendUrl={getBackendUrl()} />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="app-main">
        {/* Phase Indicator */}
        <div className="phase-section">
          <PhaseIndicator currentPhase={state.state} />
        </div>

        {/* Active Tool Display */}
        {state.activeTool && (
          <div className="tool-section">
            <ToolCallDisplay toolCall={state.activeTool} />
          </div>
        )}

        {/* Error Display */}
        {state.error && (
          <div className="error-section" role="alert">
            <div className="error-content">
              <span className="error-icon">⚠</span>
              <span className="error-message">{state.error.message}</span>
              <button
                className="error-dismiss"
                onClick={() => dispatch(actions.clearError())}
                aria-label="Dismiss error"
              >
                ×
              </button>
            </div>
          </div>
        )}

        {/* Message List */}
        <div className="messages-section">
          <MessageList />
        </div>

        {/* Audio Player Status */}
        <div className="audio-player-section">
          <AudioPlayer />
        </div>

        {/* Vision Uploader */}
        <div className="vision-section">
          <VisionUploader
            onUpload={handleUploadImage}
            disabled={!isConnected || isConversationActive}
          />
        </div>
      </main>

      {/* Footer Controls */}
      <footer className="app-footer">
        <div className="footer-content">
          {/* Connection Status */}
          <div className="connection-status">
            <span
              className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`}
            />
            <span className="status-text">
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>

          {/* Conversation Controls */}
          <div className="conversation-controls">
            {state.state === 'idle' ? (
              <button
                className="control-button start-button"
                onClick={handleStartConversation}
                disabled={!isConnected}
                aria-label="Start conversation"
              >
                <span className="button-icon">🎤</span>
                Start Conversation
              </button>
            ) : (
              <>
                <button
                  className="control-button interrupt-button"
                  onClick={handleInterrupt}
                  disabled={!isConnected || state.state !== 'speaking'}
                  aria-label="Interrupt"
                >
                  <span className="button-icon">✋</span>
                  Interrupt
                </button>
                <button
                  className="control-button stop-button"
                  onClick={handleStopConversation}
                  disabled={!isConnected}
                  aria-label="Stop conversation"
                >
                  <span className="button-icon">⏹</span>
                  Stop
                </button>
              </>
            )}
          </div>

          {/* Audio Recorder (hidden - runs automatically) */}
          <div className="audio-recorder-section" style={{ display: 'none' }}>
            <AudioRecorder
              sendAudioChunk={handleSendAudioChunk}
              isListening={state.state === 'listening'}
            />
          </div>
        </div>
      </footer>
    </div>
  );
}

/**
 * Main App Component (Wrapper)
 * Wraps AppInner with ConversationProvider
 */
function App() {
  return (
    <ConversationProvider>
      <AppInner />
    </ConversationProvider>
  );
}

export default App;
