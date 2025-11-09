/**
 * Text Message Handler
 *
 * Processes text-only messages from user (typed messages, not voice).
 * This handler bypasses STT and directly triggers LLM processing.
 */

// Import shared LLM processing logic from transcription handler
const { processWithLLM } = require('./transcription');

/**
 * Handle text message from user
 *
 * @param {WebSocketHandler} wsHandler - WebSocket handler for sending messages
 * @param {SessionManager} session - Session manager instance
 * @param {string} messageText - Text message from user
 * @param {LLMClient} llmClient - LLM service client
 * @param {TTSClient} ttsClient - TTS service client (optional)
 */
async function handleTextMessage(wsHandler, session, messageText, llmClient, ttsClient = null) {
  try {
    // Validate message text
    if (!messageText || typeof messageText !== 'string') {
      console.warn(`[Session ${session.id}] Invalid text message received`);
      return;
    }

    // Trim whitespace
    const trimmedText = messageText.trim();

    if (trimmedText === '') {
      console.warn(`[Session ${session.id}] Empty text message received`);
      return;
    }

    console.log(`[Session ${session.id}] Processing text message: "${trimmedText}"`);

    // Add user message to conversation history
    session.addMessage('user', trimmedText);

    // Transition to thinking state
    // Need to handle different starting states (idle, listening, etc.)
    const currentState = session.getState();

    if (currentState === 'idle') {
      // If idle, start conversation then go to thinking
      session.transition('start');
      session.transition('text_message');
    } else if (currentState === 'listening') {
      // If listening, go directly to thinking
      session.transition('text_message');
    } else {
      // For other states, just try to transition
      // This might fail, which is okay - we'll catch it
      try {
        session.transition('text_message');
      } catch (stateError) {
        console.warn(`[Session ${session.id}] Could not transition from ${currentState}, proceeding anyway`);
      }
    }

    wsHandler.sendStateChange(session.getState());

    console.log(`[Session ${session.id}] Starting LLM processing for text message`);

    // Process with LLM (shared logic with transcription handler)
    await processWithLLM(wsHandler, session, llmClient, ttsClient);

  } catch (error) {
    console.error(`[Session ${session.id}] Text message handling error:`, error.message);
    wsHandler.sendError(`Text message processing failed: ${error.message}`, 'text_message_handler');
  }
}

module.exports = {
  handleTextMessage
};
