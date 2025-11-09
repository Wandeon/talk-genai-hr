/**
 * Message object shape
 * @typedef {Object} Message
 * @property {string} id - Unique message identifier
 * @property {'user'|'assistant'} role - Message sender role
 * @property {string} content - Message text content
 * @property {number} timestamp - Message timestamp in milliseconds
 * @property {'text'|'audio'|'error'} type - Message type
 * @property {Object} [metadata] - Optional metadata for the message
 * @property {string} [audioUrl] - Optional audio URL for audio messages
 * @property {number} [duration] - Optional duration for audio messages
 */

// Initial state for conversation
export const initialState = {
  state: 'idle', // 'idle' | 'listening' | 'transcribing' | 'thinking' | 'speaking'
  messages: [],
  currentTranscript: '', // Partial transcript during transcription
  currentLLMResponse: '', // Streaming LLM response
  isInterrupted: false,
  sessionId: null,
  isConnected: false,
  error: null, // { message: string, phase?: string }
  activeTool: null, // { toolName: string, args: object, result?: object }
};

// Action types
export const ACTION_TYPES = {
  SET_STATE: 'SET_STATE',
  ADD_MESSAGE: 'ADD_MESSAGE',
  UPDATE_CURRENT_TRANSCRIPT: 'UPDATE_CURRENT_TRANSCRIPT',
  UPDATE_CURRENT_LLM_RESPONSE: 'UPDATE_CURRENT_LLM_RESPONSE',
  SET_INTERRUPTED: 'SET_INTERRUPTED',
  SET_SESSION_ID: 'SET_SESSION_ID',
  SET_CONNECTED: 'SET_CONNECTED',
  RESET_CONVERSATION: 'RESET_CONVERSATION',
  SET_ERROR: 'SET_ERROR',
  CLEAR_ERROR: 'CLEAR_ERROR',
  SET_ACTIVE_TOOL: 'SET_ACTIVE_TOOL',
  UPDATE_TOOL_RESULT: 'UPDATE_TOOL_RESULT',
  CLEAR_ACTIVE_TOOL: 'CLEAR_ACTIVE_TOOL',
};

// Conversation reducer
const conversationReducer = (state, action) => {
  switch (action.type) {
    case ACTION_TYPES.SET_STATE:
      return {
        ...state,
        state: action.payload,
      };

    case ACTION_TYPES.ADD_MESSAGE:
      return {
        ...state,
        messages: [...state.messages, action.payload],
      };

    case ACTION_TYPES.UPDATE_CURRENT_TRANSCRIPT:
      return {
        ...state,
        currentTranscript: action.payload,
      };

    case ACTION_TYPES.UPDATE_CURRENT_LLM_RESPONSE:
      return {
        ...state,
        currentLLMResponse: action.payload,
      };

    case ACTION_TYPES.SET_INTERRUPTED:
      return {
        ...state,
        isInterrupted: action.payload,
      };

    case ACTION_TYPES.SET_SESSION_ID:
      return {
        ...state,
        sessionId: action.payload,
      };

    case ACTION_TYPES.SET_CONNECTED:
      return {
        ...state,
        isConnected: action.payload,
      };

    case ACTION_TYPES.RESET_CONVERSATION:
      return {
        ...initialState,
        isConnected: state.isConnected,
        sessionId: state.sessionId,
      };

    case ACTION_TYPES.SET_ERROR:
      return {
        ...state,
        error: action.payload,
      };

    case ACTION_TYPES.CLEAR_ERROR:
      return {
        ...state,
        error: null,
      };

    case ACTION_TYPES.SET_ACTIVE_TOOL:
      return {
        ...state,
        activeTool: action.payload,
      };

    case ACTION_TYPES.UPDATE_TOOL_RESULT:
      return {
        ...state,
        activeTool: state.activeTool
          ? { ...state.activeTool, result: action.payload }
          : null,
      };

    case ACTION_TYPES.CLEAR_ACTIVE_TOOL:
      return {
        ...state,
        activeTool: null,
      };

    default:
      return state;
  }
};

// Valid conversation states
const VALID_STATES = ['idle', 'listening', 'transcribing', 'thinking', 'speaking'];

// Action creators (optional but helpful)
export const actions = {
  setState: (state) => {
    if (!VALID_STATES.includes(state)) {
      console.warn(`Invalid state: ${state}. Valid states are: ${VALID_STATES.join(', ')}`);
    }
    return {
      type: ACTION_TYPES.SET_STATE,
      payload: state,
    };
  },

  addMessage: (message) => {
    if (!message.id || !message.role || !message.content) {
      console.warn('Invalid message: missing required fields (id, role, content)', message);
    }
    return {
      type: ACTION_TYPES.ADD_MESSAGE,
      payload: message,
    };
  },

  updateCurrentTranscript: (transcript) => ({
    type: ACTION_TYPES.UPDATE_CURRENT_TRANSCRIPT,
    payload: transcript,
  }),

  updateCurrentLLMResponse: (response) => ({
    type: ACTION_TYPES.UPDATE_CURRENT_LLM_RESPONSE,
    payload: response,
  }),

  setInterrupted: (isInterrupted) => ({
    type: ACTION_TYPES.SET_INTERRUPTED,
    payload: isInterrupted,
  }),

  setSessionId: (sessionId) => ({
    type: ACTION_TYPES.SET_SESSION_ID,
    payload: sessionId,
  }),

  setConnected: (isConnected) => ({
    type: ACTION_TYPES.SET_CONNECTED,
    payload: isConnected,
  }),

  resetConversation: () => ({
    type: ACTION_TYPES.RESET_CONVERSATION,
  }),

  setError: (error) => ({
    type: ACTION_TYPES.SET_ERROR,
    payload: error,
  }),

  clearError: () => ({
    type: ACTION_TYPES.CLEAR_ERROR,
  }),

  setActiveTool: (tool) => ({
    type: ACTION_TYPES.SET_ACTIVE_TOOL,
    payload: tool,
  }),

  updateToolResult: (result) => ({
    type: ACTION_TYPES.UPDATE_TOOL_RESULT,
    payload: result,
  }),

  clearActiveTool: () => ({
    type: ACTION_TYPES.CLEAR_ACTIVE_TOOL,
  }),
};

export default conversationReducer;
