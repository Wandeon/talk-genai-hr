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

  test('should handle invalid state transition with error', () => {
    // Try to transition from 'idle' with an invalid event
    expect(() => {
      session.transition('invalid_event');
    }).toThrow();
  });

  test('should reject invalid message role', () => {
    expect(() => {
      session.addMessage('invalid_role', 'Hello');
    }).toThrow('Invalid role: invalid_role. Must be one of: user, assistant, system');
  });

  test('should reject non-string message content', () => {
    expect(() => {
      session.addMessage('user', 123);
    }).toThrow('Invalid content type: number. Content must be a string');
  });

  test('should reject null message content', () => {
    expect(() => {
      session.addMessage('user', null);
    }).toThrow('Invalid content type: object. Content must be a string');
  });

  test('should limit audio chunks to MAX_CHUNKS', () => {
    // Add more than MAX_CHUNKS
    const maxChunks = SessionManager.MAX_CHUNKS;
    for (let i = 0; i < maxChunks + 100; i++) {
      session.addAudioChunk(`chunk${i}`);
    }

    // Should be limited to MAX_CHUNKS
    expect(session.audioChunks.length).toBe(maxChunks);

    // Should keep the most recent chunks
    expect(session.audioChunks[0]).toBe(`chunk100`);
    expect(session.audioChunks[maxChunks - 1]).toBe(`chunk${maxChunks + 99}`);
  });
});
