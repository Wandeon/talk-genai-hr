/**
 * Transcription Handler
 *
 * Processes transcribed text from STT and triggers LLM processing.
 * This handler is called after audio transcription completes.
 */

/**
 * Handle transcribed text and trigger LLM processing
 *
 * @param {WebSocketHandler} wsHandler - WebSocket handler for sending messages
 * @param {SessionManager} session - Session manager instance
 * @param {string} transcriptText - Transcribed text from STT
 * @param {LLMClient} llmClient - LLM service client
 */
async function handleTranscription(wsHandler, session, transcriptText, llmClient) {
  try {
    // Validate transcript text
    if (!transcriptText || typeof transcriptText !== 'string' || transcriptText.trim() === '') {
      console.warn(`[Session ${session.id}] Empty or invalid transcript received`);
      return;
    }

    console.log(`[Session ${session.id}] Processing transcription: "${transcriptText}"`);

    // Add user message to conversation history
    session.addMessage('user', transcriptText);

    // Transition to thinking state
    session.transition('transcription_complete');
    wsHandler.sendStateChange(session.getState());

    console.log(`[Session ${session.id}] Starting LLM processing`);

    // Process with LLM
    await processWithLLM(wsHandler, session, llmClient);

  } catch (error) {
    console.error(`[Session ${session.id}] Transcription handling error:`, error.message);
    wsHandler.sendError(`Transcription processing failed: ${error.message}`, 'transcription_handler');
  }
}

/**
 * Process conversation with LLM
 *
 * @param {WebSocketHandler} wsHandler - WebSocket handler
 * @param {SessionManager} session - Session manager
 * @param {LLMClient} llmClient - LLM client
 */
async function processWithLLM(wsHandler, session, llmClient) {
  try {
    // Get conversation history in LLM format
    const messages = session.conversationHistory.map(msg => ({
      role: msg.role,
      content: msg.content
    }));

    // Get model from environment or use default
    const model = process.env.LLM_MODEL || 'llama3.2';

    console.log(`[Session ${session.id}] Calling LLM with ${messages.length} messages, model: ${model}`);

    // Accumulate full response
    let fullResponse = '';

    // Stream LLM response with token callback
    await llmClient.streamChat(
      messages,
      // Token callback
      (token) => {
        fullResponse += token;

        // Send token to client
        wsHandler.sendLLMToken(token, false);

        console.log(`[Session ${session.id}] LLM token: "${token}"`);
      },
      // Model
      model,
      // Tools (empty for now, will be added in future tasks)
      [],
      // Tool callback (placeholder for now)
      null
    );

    console.log(`[Session ${session.id}] LLM streaming complete. Full response: "${fullResponse}"`);

    // Send completion signal
    wsHandler.sendLLMToken('', true);
    wsHandler.sendLLMComplete(fullResponse);

    // Add assistant response to conversation history
    session.addMessage('assistant', fullResponse);

    // TODO: In Task 24, we'll add TTS processing here
    // For now, transition back to listening state
    session.transition('llm_complete');
    wsHandler.sendStateChange(session.getState());

  } catch (error) {
    console.error(`[Session ${session.id}] LLM processing error:`, error.message);
    wsHandler.sendError(`LLM processing failed: ${error.message}`, 'llm');

    // Try to recover to listening state
    try {
      if (session.getState() === 'thinking') {
        session.transition('llm_complete');
        wsHandler.sendStateChange(session.getState());
      }
    } catch (transitionError) {
      console.error(`[Session ${session.id}] Failed to recover state:`, transitionError.message);
    }
  }
}

module.exports = {
  handleTranscription,
  processWithLLM
};
