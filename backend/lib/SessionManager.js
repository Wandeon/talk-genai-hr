const StateMachine = require('./StateMachine');

class SessionManager {
  static MAX_CHUNKS = 1000;
  static VALID_ROLES = ['user', 'assistant', 'system'];

  constructor(sessionId) {
    this.id = sessionId;
    this.stateMachine = new StateMachine();
    this.audioChunks = [];
    this.conversationHistory = [];
    this.interrupted = false;
    this.createdAt = new Date();
    this.metadata = {};
  }

  getState() {
    return this.stateMachine.getState();
  }

  transition(event) {
    try {
      this.stateMachine.transition(event);
    } catch (error) {
      console.error(`SessionManager[${this.id}]: Invalid transition attempt - ${error.message}`);
      throw error;
    }
  }

  addAudioChunk(chunk) {
    this.audioChunks.push(chunk);

    // Prevent unbounded memory growth
    if (this.audioChunks.length > SessionManager.MAX_CHUNKS) {
      console.warn(`SessionManager[${this.id}]: Audio chunk limit reached (${SessionManager.MAX_CHUNKS}), removing oldest chunks`);
      this.audioChunks = this.audioChunks.slice(-SessionManager.MAX_CHUNKS);
    }
  }

  clearAudioChunks() {
    this.audioChunks = [];
  }

  addMessage(role, content) {
    // Validate role
    if (!SessionManager.VALID_ROLES.includes(role)) {
      throw new Error(`Invalid role: ${role}. Must be one of: ${SessionManager.VALID_ROLES.join(', ')}`);
    }

    // Validate content is a string
    if (typeof content !== 'string') {
      throw new Error(`Invalid content type: ${typeof content}. Content must be a string`);
    }

    this.conversationHistory.push({
      role,
      content,
      timestamp: new Date()
    });
  }

  setInterrupted(value) {
    this.interrupted = value;
  }

  isInterrupted() {
    return this.interrupted;
  }

  getMetadata() {
    return {
      id: this.id,
      state: this.getState(),
      messageCount: this.conversationHistory.length,
      audioChunkCount: this.audioChunks.length,
      createdAt: this.createdAt,
      interrupted: this.interrupted
    };
  }

  /**
   * Resets the session to its initial state.
   *
   * Clears:
   * - State machine (back to idle)
   * - Audio chunks
   * - Interrupted flag
   *
   * Preserves:
   * - Conversation history (to maintain context across multiple interactions)
   *
   * If you need a completely fresh session, create a new SessionManager instance instead.
   */
  reset() {
    this.stateMachine.reset();
    this.audioChunks = [];
    this.interrupted = false;
  }
}

module.exports = SessionManager;
