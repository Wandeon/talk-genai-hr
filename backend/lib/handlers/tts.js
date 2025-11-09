/**
 * TTS Handler
 *
 * Handles text-to-speech audio generation and streaming to complete
 * the voice conversation loop after LLM generates a response.
 */

/**
 * Handle TTS generation and audio streaming
 *
 * @param {WebSocketHandler} wsHandler - WebSocket handler for sending messages
 * @param {SessionManager} session - Session manager instance
 * @param {string} text - Text to convert to speech
 * @param {TTSClient} ttsClient - TTS service client
 */
async function handleTTSGeneration(wsHandler, session, text, ttsClient) {
  try {
    console.log(`[Session ${session.id}] TTS generation triggered for text: "${text}"`);

    // Skip TTS for empty responses
    if (!text || typeof text !== 'string' || text.trim() === '') {
      console.log(`[Session ${session.id}] Skipping TTS for empty response`);
      // Still transition to speaking to maintain state flow
      session.transition('llm_complete');
      wsHandler.sendStateChange(session.getState());

      // Then transition back to listening immediately
      session.transition('audio_complete');
      wsHandler.sendStateChange(session.getState());
      return;
    }

    // Check if interrupted before starting TTS
    if (session.isInterrupted()) {
      console.log(`[Session ${session.id}] Conversation interrupted before TTS, skipping`);
      session.setInterrupted(false); // Reset flag
      return;
    }

    // Transition to speaking state
    session.transition('llm_complete');
    wsHandler.sendStateChange(session.getState());

    console.log(`[Session ${session.id}] Calling TTS service`);

    // Call TTS service to generate audio
    const ttsResponse = await ttsClient.generateSpeech(text);

    // Validate response
    if (!ttsResponse || !ttsResponse.audio) {
      throw new Error('TTS service returned invalid response: missing audio data');
    }

    const audioBase64 = ttsResponse.audio;

    console.log(`[Session ${session.id}] TTS generated ${audioBase64.length} bytes of audio`);

    // Check if interrupted after TTS generation
    if (session.isInterrupted()) {
      console.log(`[Session ${session.id}] Conversation interrupted during TTS, skipping audio send`);
      session.setInterrupted(false); // Reset flag
      return;
    }

    // Send audio chunk to client
    // For now, send as single chunk (index 0)
    // Future enhancement: could split large audio into multiple chunks
    wsHandler.sendAudioChunk(audioBase64, 0);

    console.log(`[Session ${session.id}] Audio chunk sent to client`);

    // Send audio complete notification
    wsHandler.sendAudioComplete();

    console.log(`[Session ${session.id}] Audio streaming complete`);

    // Transition back to listening state
    session.transition('audio_complete');
    wsHandler.sendStateChange(session.getState());

    console.log(`[Session ${session.id}] Returned to listening state`);

  } catch (error) {
    console.error(`[Session ${session.id}] TTS generation error:`, error.message);

    // Send error to client
    wsHandler.sendError(`TTS generation failed: ${error.message}`, 'tts');

    // Try to recover to listening state
    try {
      // If we're in speaking state, transition back to listening
      if (session.getState() === 'speaking') {
        session.transition('audio_complete');
        wsHandler.sendStateChange(session.getState());
      }
    } catch (transitionError) {
      console.error(`[Session ${session.id}] Failed to recover state:`, transitionError.message);
    }

    // Don't re-throw - TTS is optional, conversation should continue
  }
}

module.exports = {
  handleTTSGeneration
};
