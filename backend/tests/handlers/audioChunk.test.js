const VADClient = require('../../lib/services/VADClient');
const STTClient = require('../../lib/services/STTClient');
const SessionManager = require('../../lib/SessionManager');
const WebSocketHandler = require('../../lib/WebSocketHandler');

// Import the handler functions
// We'll need to export them from server.js or create a separate handlers module
const { handleAudioChunk } = require('../../lib/handlers/audioChunk');

jest.mock('../../lib/services/VADClient');
jest.mock('../../lib/services/STTClient');

describe('handleAudioChunk', () => {
  let vadClient;
  let sttClient;
  let session;
  let wsHandler;
  let mockWs;

  beforeEach(() => {
    // Mock WebSocket
    mockWs = {
      readyState: 1, // OPEN
      send: jest.fn()
    };

    // Create real session
    session = new SessionManager('test-session-id');

    // Create handler
    wsHandler = new WebSocketHandler(mockWs, session);

    // Mock VAD client
    vadClient = new VADClient('http://localhost:5052');
    vadClient.detectSpeech = jest.fn();

    // Mock STT client
    sttClient = new STTClient('http://localhost:5051');
    sttClient.transcribe = jest.fn();

    jest.clearAllMocks();
  });

  describe('Speech Detection', () => {
    test('should detect speech and add to audio chunks', async () => {
      const audioBase64 = 'YXVkaW9kYXRh'; // "audiodata" in base64

      // VAD detects speech
      vadClient.detectSpeech.mockResolvedValue({
        is_speech: true,
        probability: 0.95,
        threshold: 0.5
      });

      // Start conversation first
      session.transition('start');
      expect(session.getState()).toBe('listening');

      await handleAudioChunk(wsHandler, session, audioBase64, vadClient, sttClient);

      // Should call VAD
      expect(vadClient.detectSpeech).toHaveBeenCalledWith(audioBase64);

      // Should add chunk to session
      expect(session.audioChunks.length).toBe(1);

      // Should stay in listening state
      expect(session.getState()).toBe('listening');

      // Should not trigger transcription
      expect(sttClient.transcribe).not.toHaveBeenCalled();
    });

    test('should detect silence but not trigger transcription if no prior speech', async () => {
      const audioBase64 = 'c2lsZW5jZQ=='; // "silence" in base64

      // VAD detects silence
      vadClient.detectSpeech.mockResolvedValue({
        is_speech: false,
        probability: 0.1,
        threshold: 0.5
      });

      session.transition('start');

      await handleAudioChunk(wsHandler, session, audioBase64, vadClient, sttClient);

      // Should call VAD
      expect(vadClient.detectSpeech).toHaveBeenCalledWith(audioBase64);

      // Should not add silence to audio chunks
      expect(session.audioChunks.length).toBe(0);

      // Should not trigger transcription (no prior speech)
      expect(sttClient.transcribe).not.toHaveBeenCalled();
    });
  });

  describe('Silence Detection and Transcription', () => {
    test('should trigger transcription after consecutive silence frames', async () => {
      const speechAudio = 'c3BlZWNo'; // "speech" in base64
      const silenceAudio = 'c2lsZW5jZQ=='; // "silence" in base64

      session.transition('start');

      // First, send speech chunks
      vadClient.detectSpeech.mockResolvedValue({
        is_speech: true,
        probability: 0.95,
        threshold: 0.5
      });

      await handleAudioChunk(wsHandler, session, speechAudio, vadClient, sttClient);
      await handleAudioChunk(wsHandler, session, speechAudio, vadClient, sttClient);

      expect(session.audioChunks.length).toBe(2);

      // Now send silence chunks
      vadClient.detectSpeech.mockResolvedValue({
        is_speech: false,
        probability: 0.1,
        threshold: 0.5
      });

      sttClient.transcribe.mockResolvedValue({
        text: 'Hello world',
        language: 'en'
      });

      // Send consecutive silence (default threshold is 3)
      await handleAudioChunk(wsHandler, session, silenceAudio, vadClient, sttClient);
      expect(sttClient.transcribe).not.toHaveBeenCalled();

      await handleAudioChunk(wsHandler, session, silenceAudio, vadClient, sttClient);
      expect(sttClient.transcribe).not.toHaveBeenCalled();

      await handleAudioChunk(wsHandler, session, silenceAudio, vadClient, sttClient);

      // Should trigger transcription
      expect(sttClient.transcribe).toHaveBeenCalledTimes(1);

      // Should have transitioned to transcribing state
      expect(session.getState()).toBe('transcribing');

      // Should send state change message
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"state_change"')
      );
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"state":"transcribing"')
      );

      // Should send final transcript
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"transcript_final"')
      );
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"text":"Hello world"')
      );

      // Should clear audio chunks after transcription
      expect(session.audioChunks.length).toBe(0);
    });

    test('should reset silence counter when speech resumes', async () => {
      const speechAudio = 'c3BlZWNo';
      const silenceAudio = 'c2lsZW5jZQ==';

      session.transition('start');

      // Send speech
      vadClient.detectSpeech.mockResolvedValue({ is_speech: true, probability: 0.95, threshold: 0.5 });
      await handleAudioChunk(wsHandler, session, speechAudio, vadClient, sttClient);

      // Send 2 silence frames
      vadClient.detectSpeech.mockResolvedValue({ is_speech: false, probability: 0.1, threshold: 0.5 });
      await handleAudioChunk(wsHandler, session, silenceAudio, vadClient, sttClient);
      await handleAudioChunk(wsHandler, session, silenceAudio, vadClient, sttClient);

      // Send speech again (should reset silence counter)
      vadClient.detectSpeech.mockResolvedValue({ is_speech: true, probability: 0.95, threshold: 0.5 });
      await handleAudioChunk(wsHandler, session, speechAudio, vadClient, sttClient);

      // Send 2 more silence frames (total would be 4 if not reset, but counter was reset)
      vadClient.detectSpeech.mockResolvedValue({ is_speech: false, probability: 0.1, threshold: 0.5 });
      await handleAudioChunk(wsHandler, session, silenceAudio, vadClient, sttClient);
      await handleAudioChunk(wsHandler, session, silenceAudio, vadClient, sttClient);

      // Should not have triggered transcription yet (only 2 consecutive silence)
      expect(sttClient.transcribe).not.toHaveBeenCalled();
      expect(session.getState()).toBe('listening');
    });
  });

  describe('State Management', () => {
    test('should ensure state is listening when speech starts', async () => {
      const audioBase64 = 'c3BlZWNo';

      // Session is in idle state
      expect(session.getState()).toBe('idle');

      vadClient.detectSpeech.mockResolvedValue({ is_speech: true, probability: 0.95, threshold: 0.5 });

      await handleAudioChunk(wsHandler, session, audioBase64, vadClient, sttClient);

      // Should auto-transition to listening
      expect(session.getState()).toBe('listening');

      // Should send state change
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"state":"listening"')
      );
    });

    test('should transition to transcribing when silence detected', async () => {
      const speechAudio = 'c3BlZWNo';
      const silenceAudio = 'c2lsZW5jZQ==';

      session.transition('start');

      // Send speech
      vadClient.detectSpeech.mockResolvedValue({ is_speech: true, probability: 0.95, threshold: 0.5 });
      await handleAudioChunk(wsHandler, session, speechAudio, vadClient, sttClient);

      // Send silence to trigger transcription
      vadClient.detectSpeech.mockResolvedValue({ is_speech: false, probability: 0.1, threshold: 0.5 });
      sttClient.transcribe.mockResolvedValue({ text: 'Test', language: 'en' });

      await handleAudioChunk(wsHandler, session, silenceAudio, vadClient, sttClient);
      await handleAudioChunk(wsHandler, session, silenceAudio, vadClient, sttClient);
      await handleAudioChunk(wsHandler, session, silenceAudio, vadClient, sttClient);

      expect(session.getState()).toBe('transcribing');
    });
  });

  describe('Error Handling', () => {
    test('should handle VAD service errors gracefully', async () => {
      const audioBase64 = 'c3BlZWNo';

      session.transition('start');

      vadClient.detectSpeech.mockRejectedValue(new Error('VAD service unreachable'));

      await handleAudioChunk(wsHandler, session, audioBase64, vadClient, sttClient);

      // Should send error message
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"error"')
      );

      // Should not crash
      expect(session.getState()).toBe('listening');
    });

    test('should handle STT service errors gracefully', async () => {
      const speechAudio = 'c3BlZWNo';
      const silenceAudio = 'c2lsZW5jZQ==';

      session.transition('start');

      // Send speech
      vadClient.detectSpeech.mockResolvedValue({ is_speech: true, probability: 0.95, threshold: 0.5 });
      await handleAudioChunk(wsHandler, session, speechAudio, vadClient, sttClient);

      // Trigger transcription with STT error
      vadClient.detectSpeech.mockResolvedValue({ is_speech: false, probability: 0.1, threshold: 0.5 });
      sttClient.transcribe.mockRejectedValue(new Error('STT service unreachable'));

      await handleAudioChunk(wsHandler, session, silenceAudio, vadClient, sttClient);
      await handleAudioChunk(wsHandler, session, silenceAudio, vadClient, sttClient);
      await handleAudioChunk(wsHandler, session, silenceAudio, vadClient, sttClient);

      // Should send error message
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"error"')
      );

      // Should clear audio chunks even on error
      expect(session.audioChunks.length).toBe(0);
    });

    test('should handle malformed audio data', async () => {
      const invalidAudio = null;

      session.transition('start');

      await handleAudioChunk(wsHandler, session, invalidAudio, vadClient, sttClient);

      // Should not crash
      expect(vadClient.detectSpeech).not.toHaveBeenCalled();
    });
  });

  describe('Audio Accumulation', () => {
    test('should accumulate multiple speech chunks', async () => {
      const audioChunks = ['Y2h1bmsx', 'Y2h1bmsw', 'Y2h1bmsx'];

      session.transition('start');

      vadClient.detectSpeech.mockResolvedValue({ is_speech: true, probability: 0.95, threshold: 0.5 });

      for (const chunk of audioChunks) {
        await handleAudioChunk(wsHandler, session, chunk, vadClient, sttClient);
      }

      expect(session.audioChunks.length).toBe(3);
    });

    test('should not accumulate silence chunks', async () => {
      const speechAudio = 'c3BlZWNo';
      const silenceAudio = 'c2lsZW5jZQ==';

      session.transition('start');

      // Send speech
      vadClient.detectSpeech.mockResolvedValue({ is_speech: true, probability: 0.95, threshold: 0.5 });
      await handleAudioChunk(wsHandler, session, speechAudio, vadClient, sttClient);

      // Send silence
      vadClient.detectSpeech.mockResolvedValue({ is_speech: false, probability: 0.1, threshold: 0.5 });
      await handleAudioChunk(wsHandler, session, silenceAudio, vadClient, sttClient);

      // Should only have speech chunk
      expect(session.audioChunks.length).toBe(1);
    });
  });

  describe('Configurable Silence Threshold', () => {
    test('should use custom silence threshold if provided', async () => {
      const speechAudio = 'c3BlZWNo';
      const silenceAudio = 'c2lsZW5jZQ==';

      session.transition('start');

      // Send speech
      vadClient.detectSpeech.mockResolvedValue({ is_speech: true, probability: 0.95, threshold: 0.5 });
      await handleAudioChunk(wsHandler, session, speechAudio, vadClient, sttClient);

      // Send silence with custom threshold of 5
      vadClient.detectSpeech.mockResolvedValue({ is_speech: false, probability: 0.1, threshold: 0.5 });
      sttClient.transcribe.mockResolvedValue({ text: 'Test', language: 'en' });

      const customThreshold = 5;

      for (let i = 0; i < 4; i++) {
        await handleAudioChunk(wsHandler, session, silenceAudio, vadClient, sttClient, customThreshold);
      }

      // Should not have triggered yet
      expect(sttClient.transcribe).not.toHaveBeenCalled();

      // 5th silence frame should trigger
      await handleAudioChunk(wsHandler, session, silenceAudio, vadClient, sttClient, customThreshold);
      expect(sttClient.transcribe).toHaveBeenCalledTimes(1);
    });
  });
});
