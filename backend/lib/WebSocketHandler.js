/**
 * WebSocketHandler - Centralized WebSocket message sending
 *
 * Provides type-safe message construction and sending for all WebSocket message types
 * defined in the protocol specification.
 *
 * Key responsibilities:
 * - Validate WebSocket connection state before sending
 * - Construct properly formatted JSON messages
 * - Support all message types from protocol spec
 *
 * WebSocket readyState values:
 * 0 - CONNECTING
 * 1 - OPEN
 * 2 - CLOSING
 * 3 - CLOSED
 */
class WebSocketHandler {
  constructor(ws, session) {
    this.ws = ws;
    this.session = session;
    this.sessionId = session.id;
  }

  /**
   * Private method to send a message only if WebSocket is open
   * @private
   */
  send(message) {
    if (this.ws.readyState === 1) { // OPEN
      this.ws.send(JSON.stringify(message));
    }
  }

  /**
   * Send state change notification
   * @param {string} state - New state name
   */
  sendStateChange(state) {
    this.send({
      type: 'state_change',
      state
    });
  }

  /**
   * Send error message
   * @param {string} message - Error message
   * @param {string} [phase] - Optional phase where error occurred
   */
  sendError(message, phase) {
    const payload = {
      type: 'error',
      message
    };

    if (phase !== undefined) {
      payload.phase = phase;
    }

    this.send(payload);
  }

  /**
   * Send partial (interim) transcript
   * @param {string} text - Partial transcript text
   */
  sendTranscriptPartial(text) {
    this.send({
      type: 'transcript_partial',
      text
    });
  }

  /**
   * Send final transcript
   * @param {string} text - Final transcript text
   */
  sendTranscriptFinal(text) {
    this.send({
      type: 'transcript_final',
      text
    });
  }

  /**
   * Send LLM token (streaming response)
   * @param {string} token - Text token
   * @param {boolean} done - Whether this is the last token
   */
  sendLLMToken(token, done) {
    this.send({
      type: 'llm_token',
      token,
      done
    });
  }

  /**
   * Send LLM complete message with full text
   * @param {string} fullText - Complete LLM response
   */
  sendLLMComplete(fullText) {
    this.send({
      type: 'llm_complete',
      fullText
    });
  }

  /**
   * Send audio chunk
   * @param {string} audio - Base64 encoded audio data
   * @param {number} chunkIndex - Index of this chunk
   */
  sendAudioChunk(audio, chunkIndex) {
    this.send({
      type: 'audio_chunk',
      audio,
      chunkIndex
    });
  }

  /**
   * Send audio complete notification
   */
  sendAudioComplete() {
    this.send({
      type: 'audio_complete'
    });
  }

  /**
   * Send tool call start notification
   * @param {string} toolName - Name of the tool being called
   * @param {Object} args - Tool arguments
   */
  sendToolCallStart(toolName, args) {
    this.send({
      type: 'tool_call_start',
      toolName,
      args
    });
  }

  /**
   * Send tool call result
   * @param {string} toolName - Name of the tool
   * @param {Object} result - Tool result data
   */
  sendToolCallResult(toolName, result) {
    this.send({
      type: 'tool_call_result',
      toolName,
      result
    });
  }

  /**
   * Send vision analysis result
   * @param {string} description - Description of the image
   */
  sendVisionResult(description) {
    this.send({
      type: 'vision_result',
      description
    });
  }

  /**
   * Send interrupted notification
   * @param {string} reason - Reason for interruption
   */
  sendInterrupted(reason) {
    this.send({
      type: 'interrupted',
      reason
    });
  }

  /**
   * Send stop speaking command
   */
  sendStopSpeaking() {
    this.send({
      type: 'stop_speaking'
    });
  }

  /**
   * Send connected notification with session ID
   * @param {string} sessionId - Session identifier
   */
  sendConnected(sessionId) {
    this.send({
      type: 'connected',
      sessionId
    });
  }
}

module.exports = WebSocketHandler;
