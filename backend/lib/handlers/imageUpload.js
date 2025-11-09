/**
 * Image Upload Handler
 *
 * Processes uploaded images using vision analysis from the LLM service.
 * This handler validates image data, triggers vision analysis, and integrates
 * the results into the conversation flow.
 */

/**
 * Handle image upload and vision analysis
 *
 * @param {WebSocketHandler} wsHandler - WebSocket handler for sending messages
 * @param {SessionManager} session - Session manager instance
 * @param {LLMClient} llmClient - LLM service client with vision capabilities
 * @param {string} imageBase64 - Base64-encoded image data
 * @param {string} filename - Original filename of the uploaded image
 * @param {string} mimeType - MIME type of the image (e.g., 'image/png', 'image/jpeg')
 */
async function handleImageUpload(wsHandler, session, llmClient, imageBase64, filename, mimeType) {
  try {
    // Validate image data
    if (!imageBase64 || typeof imageBase64 !== 'string' || imageBase64.trim() === '') {
      console.warn(`[Session ${session.id}] Invalid or missing imageBase64`);
      wsHandler.sendError('Invalid image data: imageBase64 is required and must be a non-empty string', 'image_upload_handler');
      return;
    }

    if (!filename || typeof filename !== 'string') {
      console.warn(`[Session ${session.id}] Invalid or missing filename`);
      wsHandler.sendError('Invalid image data: filename is required and must be a string', 'image_upload_handler');
      return;
    }

    if (!mimeType || typeof mimeType !== 'string') {
      console.warn(`[Session ${session.id}] Invalid or missing mimeType`);
      wsHandler.sendError('Invalid image data: mimeType is required and must be a string', 'image_upload_handler');
      return;
    }

    console.log(`[Session ${session.id}] Processing image upload: ${filename} (${mimeType})`);

    // Transition to analyzing_image state
    // Handle different starting states (idle, listening, etc.)
    const currentState = session.getState();

    if (currentState === 'idle') {
      // If idle, start conversation then transition to analyzing
      session.transition('start');
      session.transition('image_upload');
    } else if (currentState === 'listening') {
      // If listening, go directly to analyzing
      session.transition('image_upload');
    } else {
      // For other states, just try to transition
      // This might fail, which is okay - we'll catch it
      try {
        session.transition('image_upload');
      } catch (stateError) {
        console.warn(`[Session ${session.id}] Could not transition from ${currentState}, proceeding anyway`);
      }
    }

    // Send state change to client
    wsHandler.sendStateChange(session.getState());

    console.log(`[Session ${session.id}] Starting vision analysis for ${filename}`);

    // Add user message to conversation history about the image upload
    const userMessage = `[Uploaded image: ${filename}]`;
    session.addMessage('user', userMessage);

    // Get vision model from environment or use default
    const visionModel = process.env.VISION_MODEL || 'llama3.2-vision';

    // Create analysis prompt
    const analysisPrompt = `Please describe this image in detail. What do you see?`;

    // Call LLM vision analysis
    const analysisResult = await llmClient.analyzeImage(
      imageBase64,
      analysisPrompt,
      visionModel
    );

    console.log(`[Session ${session.id}] Vision analysis complete: "${analysisResult.substring(0, 100)}..."`);

    // Add analysis result as assistant message to conversation history
    session.addMessage('assistant', analysisResult);

    // Send vision result to client
    wsHandler.sendVisionResult(analysisResult);

    // Transition back to listening state
    session.transition('image_analysis_complete');
    wsHandler.sendStateChange(session.getState());

    console.log(`[Session ${session.id}] Image upload processing complete`);

  } catch (error) {
    console.error(`[Session ${session.id}] Image upload handling error:`, error.message);
    wsHandler.sendError(`Image upload processing failed: ${error.message}`, 'image_upload_handler');

    // Try to recover to listening state
    try {
      const currentState = session.getState();
      if (currentState === 'analyzing_image') {
        session.transition('image_analysis_complete');
        wsHandler.sendStateChange(session.getState());
      }
    } catch (transitionError) {
      console.error(`[Session ${session.id}] Failed to recover state:`, transitionError.message);
    }
  }
}

module.exports = {
  handleImageUpload
};
