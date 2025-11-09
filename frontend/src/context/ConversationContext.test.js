import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { ConversationProvider, useConversation } from './ConversationContext';
import conversationReducer, { initialState } from './conversationReducer';

describe('conversationReducer', () => {
  it('should return initial state', () => {
    expect(initialState).toEqual({
      state: 'idle',
      messages: [],
      currentTranscript: '',
      currentLLMResponse: '',
      isInterrupted: false,
      sessionId: null,
      isConnected: false,
    });
  });

  it('should handle SET_STATE', () => {
    const newState = conversationReducer(initialState, {
      type: 'SET_STATE',
      payload: 'listening',
    });

    expect(newState.state).toBe('listening');
    expect(newState).not.toBe(initialState); // Check immutability
  });

  it('should handle ADD_MESSAGE', () => {
    const message = {
      id: '1',
      role: 'user',
      content: 'Hello',
      timestamp: Date.now(),
      type: 'text',
    };

    const newState = conversationReducer(initialState, {
      type: 'ADD_MESSAGE',
      payload: message,
    });

    expect(newState.messages).toHaveLength(1);
    expect(newState.messages[0]).toEqual(message);
    expect(newState.messages).not.toBe(initialState.messages); // Check immutability
  });

  it('should handle UPDATE_CURRENT_TRANSCRIPT', () => {
    const newState = conversationReducer(initialState, {
      type: 'UPDATE_CURRENT_TRANSCRIPT',
      payload: 'partial transcript...',
    });

    expect(newState.currentTranscript).toBe('partial transcript...');
  });

  it('should handle UPDATE_CURRENT_LLM_RESPONSE', () => {
    const newState = conversationReducer(initialState, {
      type: 'UPDATE_CURRENT_LLM_RESPONSE',
      payload: 'AI is responding...',
    });

    expect(newState.currentLLMResponse).toBe('AI is responding...');
  });

  it('should handle SET_INTERRUPTED', () => {
    const newState = conversationReducer(initialState, {
      type: 'SET_INTERRUPTED',
      payload: true,
    });

    expect(newState.isInterrupted).toBe(true);
  });

  it('should handle SET_SESSION_ID', () => {
    const sessionId = 'session-123';
    const newState = conversationReducer(initialState, {
      type: 'SET_SESSION_ID',
      payload: sessionId,
    });

    expect(newState.sessionId).toBe(sessionId);
  });

  it('should handle SET_CONNECTED', () => {
    const newState = conversationReducer(initialState, {
      type: 'SET_CONNECTED',
      payload: true,
    });

    expect(newState.isConnected).toBe(true);
  });

  it('should handle RESET_CONVERSATION', () => {
    const modifiedState = {
      state: 'speaking',
      messages: [{ id: '1', role: 'user', content: 'test' }],
      currentTranscript: 'test',
      currentLLMResponse: 'response',
      isInterrupted: true,
      sessionId: 'session-123',
      isConnected: true,
    };

    const newState = conversationReducer(modifiedState, {
      type: 'RESET_CONVERSATION',
    });

    expect(newState).toEqual(initialState);
    expect(newState).not.toBe(modifiedState); // Check immutability
  });

  it('should handle multiple ADD_MESSAGE actions', () => {
    const message1 = {
      id: '1',
      role: 'user',
      content: 'Hello',
      timestamp: Date.now(),
      type: 'text',
    };

    const message2 = {
      id: '2',
      role: 'assistant',
      content: 'Hi there',
      timestamp: Date.now(),
      type: 'text',
    };

    let state = conversationReducer(initialState, {
      type: 'ADD_MESSAGE',
      payload: message1,
    });

    state = conversationReducer(state, {
      type: 'ADD_MESSAGE',
      payload: message2,
    });

    expect(state.messages).toHaveLength(2);
    expect(state.messages[0]).toEqual(message1);
    expect(state.messages[1]).toEqual(message2);
  });

  it('should return state unchanged for unknown action', () => {
    const newState = conversationReducer(initialState, {
      type: 'UNKNOWN_ACTION',
    });

    expect(newState).toEqual(initialState);
  });
});

describe('ConversationContext', () => {
  const wrapper = ({ children }) => (
    <ConversationProvider>{children}</ConversationProvider>
  );

  it('should provide initial state', () => {
    const { result } = renderHook(() => useConversation(), { wrapper });

    expect(result.current.state).toEqual(initialState);
  });

  it('should provide dispatch function', () => {
    const { result } = renderHook(() => useConversation(), { wrapper });

    expect(typeof result.current.dispatch).toBe('function');
  });

  it('should update state when SET_STATE is dispatched', () => {
    const { result } = renderHook(() => useConversation(), { wrapper });

    act(() => {
      result.current.dispatch({
        type: 'SET_STATE',
        payload: 'listening',
      });
    });

    expect(result.current.state.state).toBe('listening');
  });

  it('should add message when ADD_MESSAGE is dispatched', () => {
    const { result } = renderHook(() => useConversation(), { wrapper });

    const message = {
      id: '1',
      role: 'user',
      content: 'Hello',
      timestamp: Date.now(),
      type: 'text',
    };

    act(() => {
      result.current.dispatch({
        type: 'ADD_MESSAGE',
        payload: message,
      });
    });

    expect(result.current.state.messages).toHaveLength(1);
    expect(result.current.state.messages[0]).toEqual(message);
  });

  it('should update current transcript', () => {
    const { result } = renderHook(() => useConversation(), { wrapper });

    act(() => {
      result.current.dispatch({
        type: 'UPDATE_CURRENT_TRANSCRIPT',
        payload: 'Testing...',
      });
    });

    expect(result.current.state.currentTranscript).toBe('Testing...');
  });

  it('should update current LLM response', () => {
    const { result } = renderHook(() => useConversation(), { wrapper });

    act(() => {
      result.current.dispatch({
        type: 'UPDATE_CURRENT_LLM_RESPONSE',
        payload: 'AI response...',
      });
    });

    expect(result.current.state.currentLLMResponse).toBe('AI response...');
  });

  it('should set interrupted flag', () => {
    const { result } = renderHook(() => useConversation(), { wrapper });

    act(() => {
      result.current.dispatch({
        type: 'SET_INTERRUPTED',
        payload: true,
      });
    });

    expect(result.current.state.isInterrupted).toBe(true);
  });

  it('should set session ID', () => {
    const { result } = renderHook(() => useConversation(), { wrapper });

    act(() => {
      result.current.dispatch({
        type: 'SET_SESSION_ID',
        payload: 'session-456',
      });
    });

    expect(result.current.state.sessionId).toBe('session-456');
  });

  it('should set connection status', () => {
    const { result } = renderHook(() => useConversation(), { wrapper });

    act(() => {
      result.current.dispatch({
        type: 'SET_CONNECTED',
        payload: true,
      });
    });

    expect(result.current.state.isConnected).toBe(true);
  });

  it('should reset conversation to initial state', () => {
    const { result } = renderHook(() => useConversation(), { wrapper });

    // Modify state
    act(() => {
      result.current.dispatch({ type: 'SET_STATE', payload: 'speaking' });
      result.current.dispatch({
        type: 'ADD_MESSAGE',
        payload: { id: '1', role: 'user', content: 'test' },
      });
      result.current.dispatch({
        type: 'SET_SESSION_ID',
        payload: 'session-789',
      });
    });

    expect(result.current.state.state).toBe('speaking');
    expect(result.current.state.messages).toHaveLength(1);

    // Reset
    act(() => {
      result.current.dispatch({ type: 'RESET_CONVERSATION' });
    });

    expect(result.current.state).toEqual(initialState);
  });

  it('should handle complex state transitions', () => {
    const { result } = renderHook(() => useConversation(), { wrapper });

    // Simulate a conversation flow
    act(() => {
      // Connect
      result.current.dispatch({ type: 'SET_CONNECTED', payload: true });
      result.current.dispatch({
        type: 'SET_SESSION_ID',
        payload: 'session-complex',
      });

      // User starts speaking
      result.current.dispatch({ type: 'SET_STATE', payload: 'listening' });

      // Transcription starts
      result.current.dispatch({ type: 'SET_STATE', payload: 'transcribing' });
      result.current.dispatch({
        type: 'UPDATE_CURRENT_TRANSCRIPT',
        payload: 'Hello',
      });

      // Transcription complete, add message
      result.current.dispatch({
        type: 'ADD_MESSAGE',
        payload: {
          id: '1',
          role: 'user',
          content: 'Hello',
          timestamp: Date.now(),
          type: 'text',
        },
      });
      result.current.dispatch({
        type: 'UPDATE_CURRENT_TRANSCRIPT',
        payload: '',
      });

      // AI thinking
      result.current.dispatch({ type: 'SET_STATE', payload: 'thinking' });

      // AI responding
      result.current.dispatch({ type: 'SET_STATE', payload: 'speaking' });
      result.current.dispatch({
        type: 'UPDATE_CURRENT_LLM_RESPONSE',
        payload: 'Hi there!',
      });

      // Response complete
      result.current.dispatch({
        type: 'ADD_MESSAGE',
        payload: {
          id: '2',
          role: 'assistant',
          content: 'Hi there!',
          timestamp: Date.now(),
          type: 'text',
        },
      });
      result.current.dispatch({
        type: 'UPDATE_CURRENT_LLM_RESPONSE',
        payload: '',
      });
      result.current.dispatch({ type: 'SET_STATE', payload: 'idle' });
    });

    expect(result.current.state.isConnected).toBe(true);
    expect(result.current.state.sessionId).toBe('session-complex');
    expect(result.current.state.messages).toHaveLength(2);
    expect(result.current.state.messages[0].role).toBe('user');
    expect(result.current.state.messages[1].role).toBe('assistant');
    expect(result.current.state.state).toBe('idle');
    expect(result.current.state.currentTranscript).toBe('');
    expect(result.current.state.currentLLMResponse).toBe('');
  });

  it('should throw error when useConversation is used outside provider', () => {
    // Suppress console.error for this test
    const consoleError = jest.spyOn(console, 'error').mockImplementation();

    expect(() => {
      renderHook(() => useConversation());
    }).toThrow('useConversation must be used within a ConversationProvider');

    consoleError.mockRestore();
  });
});
