import React, { createContext, useContext, useReducer } from 'react';
import conversationReducer, { initialState } from './conversationReducer';

// Create the context
const ConversationContext = createContext(undefined);

// Provider component
export const ConversationProvider = ({ children }) => {
  const [state, dispatch] = useReducer(conversationReducer, initialState);

  const value = {
    state,
    dispatch,
  };

  return (
    <ConversationContext.Provider value={value}>
      {children}
    </ConversationContext.Provider>
  );
};

// Custom hook to use the conversation context
export const useConversation = () => {
  const context = useContext(ConversationContext);

  if (context === undefined) {
    throw new Error('useConversation must be used within a ConversationProvider');
  }

  return context;
};

export default ConversationContext;
