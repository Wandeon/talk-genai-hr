/**
 * Audio Chunk Handler with Voice Activity Detection
 *
 * Handles real-time audio chunk processing with VAD-based speech detection.
 * Accumulates audio during speech and triggers transcription on silence.
 */

// Default silence threshold (consecutive silent frames to trigger transcription)
const DEFAULT_SILENCE_THRESHOLD = 3;

// Track silence state per session
const sessionSilenceCounters = new Map();

/**
 * Process an audio chunk with VAD detection
 *
 * @param {WebSocketHandler} wsHandler - WebSocket handler for sending messages
 * @param {SessionManager} session - Session manager instance
 * @param {string} audioBase64 - Base64 encoded audio data
 * @param {VADClient} vadClient - VAD service client
 * @param {STTClient} sttClient - STT service client
 * @param {number} silenceThreshold - Number of consecutive silence frames to trigger transcription
 */
async function handleAudioChunk(
  wsHandler,
  session,
  audioBase64,
  vadClient,
  sttClient,
  silenceThreshold = DEFAULT_SILENCE_THRESHOLD
) {
  try {
    // Validate audio data
    if (!audioBase64 || typeof audioBase64 !== 'string') {
      console.warn(`[Session ${session.id}] Invalid audio data received`);
      return;
    }

    // Initialize silence counter for this session if not exists
    if (!sessionSilenceCounters.has(session.id)) {
      sessionSilenceCounters.set(session.id, 0);
    }

    // Call VAD service to detect speech
    let vadResult;
    try {
      vadResult = await vadClient.detectSpeech(audioBase64);
    } catch (error) {
      console.error(`[Session ${session.id}] VAD detection error:`, error.message);
      wsHandler.sendError(`Voice activity detection failed: ${error.message}`, 'vad');
      return;
    }

    const isSpeech = vadResult.is_speech;
    console.log(`[Session ${session.id}] VAD result: is_speech=${isSpeech}, probability=${vadResult.probability}`);

    if (isSpeech) {
      // Speech detected
      // Ensure we're in listening state
      if (session.getState() === 'idle') {
        session.transition('start');
        wsHandler.sendStateChange(session.getState());
        console.log(`[Session ${session.id}] Auto-started conversation on speech detection`);
      }

      // Reset silence counter
      sessionSilenceCounters.set(session.id, 0);

      // Add audio chunk to session
      const audioBuffer = Buffer.from(audioBase64, 'base64');
      session.addAudioChunk(audioBuffer);

      console.log(`[Session ${session.id}] Speech detected, chunks accumulated: ${session.audioChunks.length}`);
    } else {
      // Silence detected
      // Only count silence if we have accumulated speech chunks
      if (session.audioChunks.length > 0) {
        const silenceCount = sessionSilenceCounters.get(session.id) + 1;
        sessionSilenceCounters.set(session.id, silenceCount);

        console.log(`[Session ${session.id}] Silence detected, count: ${silenceCount}/${silenceThreshold}`);

        // Check if we've reached the silence threshold
        if (silenceCount >= silenceThreshold) {
          console.log(`[Session ${session.id}] Silence threshold reached, triggering transcription`);

          // Reset silence counter
          sessionSilenceCounters.set(session.id, 0);

          // Trigger transcription
          await triggerTranscription(wsHandler, session, sttClient);
        }
      }
      // Don't add silence chunks to accumulation
    }
  } catch (error) {
    console.error(`[Session ${session.id}] Audio chunk processing error:`, error.message);
    wsHandler.sendError(`Audio processing failed: ${error.message}`, 'audio_chunk');
  }
}

/**
 * Trigger STT transcription for accumulated audio chunks
 *
 * @param {WebSocketHandler} wsHandler - WebSocket handler
 * @param {SessionManager} session - Session manager
 * @param {STTClient} sttClient - STT service client
 */
async function triggerTranscription(wsHandler, session, sttClient) {
  try {
    // Transition to transcribing state
    session.transition('silence_detected');
    wsHandler.sendStateChange(session.getState());

    console.log(`[Session ${session.id}] Starting transcription for ${session.audioChunks.length} chunks`);

    // Concatenate all audio chunks
    const combinedAudio = Buffer.concat(session.audioChunks);

    // Clear audio chunks early to prevent memory buildup
    const chunksCount = session.audioChunks.length;
    session.clearAudioChunks();

    // Call STT service
    const transcriptionResult = await sttClient.transcribe(combinedAudio);

    console.log(`[Session ${session.id}] Transcription complete: "${transcriptionResult.text}"`);

    // Send final transcript to client
    wsHandler.sendTranscriptFinal(transcriptionResult.text);

    // Add to conversation history
    session.addMessage('user', transcriptionResult.text);

    // TODO: Trigger LLM processing here
    // For now, just transition back to listening
    // In full implementation, this would call handleLLMProcessing()

  } catch (error) {
    console.error(`[Session ${session.id}] Transcription error:`, error.message);
    wsHandler.sendError(`Transcription failed: ${error.message}`, 'transcription');

    // Clear audio chunks even on error to prevent memory leak
    session.clearAudioChunks();

    // Reset to listening state to allow retry
    // We need to check current state first to avoid invalid transitions
    if (session.getState() === 'transcribing') {
      // Since there's no direct transcribing -> listening transition,
      // we would normally handle this differently in production
      // For now, just clear the error state
    }
  }
}

/**
 * Clean up session-specific data
 * Should be called when session ends
 *
 * @param {string} sessionId - Session ID
 */
function cleanupSession(sessionId) {
  sessionSilenceCounters.delete(sessionId);
}

module.exports = {
  handleAudioChunk,
  triggerTranscription,
  cleanupSession,
  DEFAULT_SILENCE_THRESHOLD
};
