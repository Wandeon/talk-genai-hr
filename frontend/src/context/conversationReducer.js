// Initial state for conversation
export const initialState = {
  state: 'idle', // 'idle' | 'listening' | 'transcribing' | 'thinking' | 'speaking'
  messages: [],
  currentTranscript: '', // Partial transcript during transcription
  currentLLMResponse: '', // Streaming LLM response
  isInterrupted: false,
  sessionId: null,
  isConnected: false,
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
      return { ...initialState };

    default:
      return state;
  }
};

// Action creators (optional but helpful)
export const actions = {
  setState: (state) => ({
    type: ACTION_TYPES.SET_STATE,
    payload: state,
  }),

  addMessage: (message) => ({
    type: ACTION_TYPES.ADD_MESSAGE,
    payload: message,
  }),

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
};

export default conversationReducer;
