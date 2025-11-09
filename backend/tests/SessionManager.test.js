const SessionManager = require('../lib/SessionManager');
const StateMachine = require('../lib/StateMachine');

describe('SessionManager', () => {
  let session;

  beforeEach(() => {
    session = new SessionManager('test-123');
  });

  test('should initialize with session ID', () => {
    expect(session.id).toBe('test-123');
  });

  test('should have state machine', () => {
    expect(session.stateMachine).toBeInstanceOf(StateMachine);
  });

  test('should start in idle state', () => {
    expect(session.getState()).toBe('idle');
  });

  test('should accumulate audio chunks', () => {
    session.addAudioChunk('chunk1');
    session.addAudioChunk('chunk2');
    expect(session.audioChunks).toEqual(['chunk1', 'chunk2']);
  });

  test('should clear audio chunks', () => {
    session.addAudioChunk('chunk1');
    session.clearAudioChunks();
    expect(session.audioChunks).toEqual([]);
  });

  test('should track conversation history', () => {
    session.addMessage('user', 'Hello');
    session.addMessage('assistant', 'Hi there');
    expect(session.conversationHistory).toHaveLength(2);
  });

  test('should set interrupted flag', () => {
    expect(session.isInterrupted()).toBe(false);
    session.setInterrupted(true);
    expect(session.isInterrupted()).toBe(true);
  });

  test('should get metadata', () => {
    const metadata = session.getMetadata();
    expect(metadata.id).toBe('test-123');
    expect(metadata.state).toBe('idle');
    expect(metadata.messageCount).toBe(0);
  });
});
