/**
 * Transcription Handler
 *
 * Processes transcribed text from STT and triggers LLM processing.
 * This handler is called after audio transcription completes.
 */

const { getToolDefinitions, executeToolCall } = require('../tools/index');
const { handleTTSGeneration } = require('./tts');

/**
 * Handle transcribed text and trigger LLM processing
 *
 * @param {WebSocketHandler} wsHandler - WebSocket handler for sending messages
 * @param {SessionManager} session - Session manager instance
 * @param {string} transcriptText - Transcribed text from STT
 * @param {LLMClient} llmClient - LLM service client
 * @param {TTSClient} ttsClient - TTS service client (optional)
 */
async function handleTranscription(wsHandler, session, transcriptText, llmClient, ttsClient = null) {
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
    await processWithLLM(wsHandler, session, llmClient, ttsClient);

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
 * @param {TTSClient} ttsClient - TTS client (optional)
 */
async function processWithLLM(wsHandler, session, llmClient, ttsClient = null) {
  try {
    // Get conversation history in LLM format
    const messages = session.conversationHistory.map(msg => ({
      role: msg.role,
      content: msg.content
    }));

    // Get model from environment or use default
    const model = process.env.LLM_MODEL || 'llama3.2';

    // Get tool definitions
    const tools = getToolDefinitions();

    console.log(`[Session ${session.id}] Calling LLM with ${messages.length} messages, model: ${model}, ${tools.length} tools available`);

    // Accumulate full response
    let fullResponse = '';

    // Stream LLM response with token callback and tool support
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
      // Tools
      tools,
      // Tool callback
      async (toolCall) => {
        try {
          console.log(`[Session ${session.id}] LLM requested tool: ${toolCall.function.name}`);

          // Execute the tool
          const result = await executeToolCall(toolCall);

          console.log(`[Session ${session.id}] Tool result: ${result}`);

          // Add tool call to conversation history
          session.addMessage('assistant', `[Used tool: ${toolCall.function.name}]`);
          session.addMessage('system', `Tool result: ${result}`);

          return result;
        } catch (toolError) {
          console.error(`[Session ${session.id}] Tool execution error:`, toolError.message);

          // Return error to LLM so it can handle gracefully
          const errorMessage = `Error executing tool: ${toolError.message}`;
          session.addMessage('system', `Tool error: ${errorMessage}`);

          return errorMessage;
        }
      }
    );

    console.log(`[Session ${session.id}] LLM streaming complete. Full response: "${fullResponse}"`);

    // Send completion signal
    wsHandler.sendLLMToken('', true);
    wsHandler.sendLLMComplete(fullResponse);

    // Add assistant response to conversation history
    session.addMessage('assistant', fullResponse);

    // Trigger TTS generation if ttsClient is available
    if (ttsClient) {
      await handleTTSGeneration(wsHandler, session, fullResponse, ttsClient);
    } else {
      // No TTS client available, just transition to speaking state
      console.log(`[Session ${session.id}] No TTS client available, skipping TTS`);
      session.transition('llm_complete');
      wsHandler.sendStateChange(session.getState());
    }

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
