const StateMachine = require('./StateMachine');

class SessionManager {
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
    this.stateMachine.transition(event);
  }

  addAudioChunk(chunk) {
    this.audioChunks.push(chunk);
  }

  clearAudioChunks() {
    this.audioChunks = [];
  }

  addMessage(role, content) {
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

  reset() {
    this.stateMachine.reset();
    this.audioChunks = [];
    this.interrupted = false;
  }
}

module.exports = SessionManager;
