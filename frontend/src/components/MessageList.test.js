import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import MessageList from './MessageList';
import { ConversationProvider } from '../context/ConversationContext';
import { ACTION_TYPES } from '../context/conversationReducer';

// Helper function to render with context
const renderWithContext = (component, contextValue = {}) => {
  return render(
    <ConversationProvider>
      {component}
    </ConversationProvider>
  );
};

// Mock IntersectionObserver for auto-scroll tests
beforeEach(() => {
  global.IntersectionObserver = class IntersectionObserver {
    constructor() {}
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

describe('MessageList Component', () => {
  describe('Basic Rendering', () => {
    it('should render empty message list when no messages', () => {
      renderWithContext(<MessageList />);
      const messageList = screen.getByRole('log', { name: /conversation messages/i });
      expect(messageList).toBeInTheDocument();
    });

    it('should have proper accessibility attributes', () => {
      renderWithContext(<MessageList />);
      const messageList = screen.getByRole('log', { name: /conversation messages/i });
      expect(messageList).toHaveAttribute('aria-live', 'polite');
      expect(messageList).toHaveAttribute('aria-label', 'Conversation messages');
    });
  });

  describe('Message Display', () => {
    it('should render user messages', () => {
      const TestComponent = () => {
        const { dispatch } = require('../context/ConversationContext').useConversation();

        React.useEffect(() => {
          dispatch({
            type: ACTION_TYPES.ADD_MESSAGE,
            payload: {
              id: 'msg-1',
              role: 'user',
              content: 'Hello, assistant!',
              timestamp: Date.now(),
              type: 'text',
            },
          });
        }, [dispatch]);

        return <MessageList />;
      };

      renderWithContext(<TestComponent />);
      expect(screen.getByText('Hello, assistant!')).toBeInTheDocument();
    });

    it('should render assistant messages', () => {
      const TestComponent = () => {
        const { dispatch } = require('../context/ConversationContext').useConversation();

        React.useEffect(() => {
          dispatch({
            type: ACTION_TYPES.ADD_MESSAGE,
            payload: {
              id: 'msg-2',
              role: 'assistant',
              content: 'Hello, user!',
              timestamp: Date.now(),
              type: 'text',
            },
          });
        }, [dispatch]);

        return <MessageList />;
      };

      renderWithContext(<TestComponent />);
      expect(screen.getByText('Hello, user!')).toBeInTheDocument();
    });

    it('should render multiple messages in order', () => {
      const TestComponent = () => {
        const { dispatch } = require('../context/ConversationContext').useConversation();

        React.useEffect(() => {
          dispatch({
            type: ACTION_TYPES.ADD_MESSAGE,
            payload: {
              id: 'msg-1',
              role: 'user',
              content: 'First message',
              timestamp: Date.now(),
              type: 'text',
            },
          });
          dispatch({
            type: ACTION_TYPES.ADD_MESSAGE,
            payload: {
              id: 'msg-2',
              role: 'assistant',
              content: 'Second message',
              timestamp: Date.now() + 1000,
              type: 'text',
            },
          });
        }, [dispatch]);

        return <MessageList />;
      };

      renderWithContext(<TestComponent />);
      expect(screen.getByText('First message')).toBeInTheDocument();
      expect(screen.getByText('Second message')).toBeInTheDocument();
    });

    it('should apply correct CSS classes to user and assistant messages', () => {
      const TestComponent = () => {
        const { dispatch } = require('../context/ConversationContext').useConversation();

        React.useEffect(() => {
          dispatch({
            type: ACTION_TYPES.ADD_MESSAGE,
            payload: {
              id: 'msg-1',
              role: 'user',
              content: 'User message',
              timestamp: Date.now(),
              type: 'text',
            },
          });
          dispatch({
            type: ACTION_TYPES.ADD_MESSAGE,
            payload: {
              id: 'msg-2',
              role: 'assistant',
              content: 'Assistant message',
              timestamp: Date.now(),
              type: 'text',
            },
          });
        }, [dispatch]);

        return <MessageList />;
      };

      renderWithContext(<TestComponent />);

      const userMessage = screen.getByText('User message').closest('.message');
      const assistantMessage = screen.getByText('Assistant message').closest('.message');

      expect(userMessage).toHaveClass('message-user');
      expect(assistantMessage).toHaveClass('message-assistant');
    });

    it('should display timestamps', () => {
      const testTimestamp = new Date('2025-01-15T10:30:00').getTime();

      const TestComponent = () => {
        const { dispatch } = require('../context/ConversationContext').useConversation();

        React.useEffect(() => {
          dispatch({
            type: ACTION_TYPES.ADD_MESSAGE,
            payload: {
              id: 'msg-1',
              role: 'user',
              content: 'Test message',
              timestamp: testTimestamp,
              type: 'text',
            },
          });
        }, [dispatch]);

        return <MessageList />;
      };

      const { container } = renderWithContext(<TestComponent />);

      // Check that a timestamp element exists
      const timeElements = container.querySelectorAll('.message-time');
      expect(timeElements.length).toBeGreaterThan(0);
    });
  });

  describe('Streaming LLM Response', () => {
    it('should display streaming LLM response when state is "thinking"', () => {
      const TestComponent = () => {
        const { dispatch } = require('../context/ConversationContext').useConversation();

        React.useEffect(() => {
          dispatch({
            type: ACTION_TYPES.SET_STATE,
            payload: 'thinking',
          });
          dispatch({
            type: ACTION_TYPES.UPDATE_CURRENT_LLM_RESPONSE,
            payload: 'I am thinking...',
          });
        }, [dispatch]);

        return <MessageList />;
      };

      renderWithContext(<TestComponent />);
      expect(screen.getByText('I am thinking...')).toBeInTheDocument();
    });

    it('should display streaming LLM response when state is "speaking"', () => {
      const TestComponent = () => {
        const { dispatch } = require('../context/ConversationContext').useConversation();

        React.useEffect(() => {
          dispatch({
            type: ACTION_TYPES.SET_STATE,
            payload: 'speaking',
          });
          dispatch({
            type: ACTION_TYPES.UPDATE_CURRENT_LLM_RESPONSE,
            payload: 'This is a streaming response...',
          });
        }, [dispatch]);

        return <MessageList />;
      };

      renderWithContext(<TestComponent />);
      expect(screen.getByText('This is a streaming response...')).toBeInTheDocument();
    });

    it('should show typing indicator with streaming response', () => {
      const TestComponent = () => {
        const { dispatch } = require('../context/ConversationContext').useConversation();

        React.useEffect(() => {
          dispatch({
            type: ACTION_TYPES.SET_STATE,
            payload: 'thinking',
          });
          dispatch({
            type: ACTION_TYPES.UPDATE_CURRENT_LLM_RESPONSE,
            payload: 'Typing...',
          });
        }, [dispatch]);

        return <MessageList />;
      };

      renderWithContext(<TestComponent />);

      const streamingMessage = screen.getByText('Typing...').closest('.message');
      expect(streamingMessage).toHaveClass('message-streaming');
    });

    it('should not display LLM response when state is not "thinking" or "speaking"', () => {
      const TestComponent = () => {
        const { dispatch } = require('../context/ConversationContext').useConversation();

        React.useEffect(() => {
          dispatch({
            type: ACTION_TYPES.SET_STATE,
            payload: 'idle',
          });
          dispatch({
            type: ACTION_TYPES.UPDATE_CURRENT_LLM_RESPONSE,
            payload: 'This should not be visible',
          });
        }, [dispatch]);

        return <MessageList />;
      };

      renderWithContext(<TestComponent />);
      expect(screen.queryByText('This should not be visible')).not.toBeInTheDocument();
    });
  });

  describe('Current Transcript Display', () => {
    it('should display current transcript when state is "transcribing"', () => {
      const TestComponent = () => {
        const { dispatch } = require('../context/ConversationContext').useConversation();

        React.useEffect(() => {
          dispatch({
            type: ACTION_TYPES.SET_STATE,
            payload: 'transcribing',
          });
          dispatch({
            type: ACTION_TYPES.UPDATE_CURRENT_TRANSCRIPT,
            payload: 'Partial transcript...',
          });
        }, [dispatch]);

        return <MessageList />;
      };

      renderWithContext(<TestComponent />);
      expect(screen.getByText(/Partial transcript\.\.\./)).toBeInTheDocument();
    });

    it('should show ellipsis indicator with current transcript', () => {
      const TestComponent = () => {
        const { dispatch } = require('../context/ConversationContext').useConversation();

        React.useEffect(() => {
          dispatch({
            type: ACTION_TYPES.SET_STATE,
            payload: 'transcribing',
          });
          dispatch({
            type: ACTION_TYPES.UPDATE_CURRENT_TRANSCRIPT,
            payload: 'Speaking...',
          });
        }, [dispatch]);

        return <MessageList />;
      };

      renderWithContext(<TestComponent />);

      const transcriptMessage = screen.getByText(/Speaking\.\.\./).closest('.message');
      expect(transcriptMessage).toHaveClass('message-transcribing');
    });

    it('should not display transcript when state is not "transcribing"', () => {
      const TestComponent = () => {
        const { dispatch } = require('../context/ConversationContext').useConversation();

        React.useEffect(() => {
          dispatch({
            type: ACTION_TYPES.SET_STATE,
            payload: 'idle',
          });
          dispatch({
            type: ACTION_TYPES.UPDATE_CURRENT_TRANSCRIPT,
            payload: 'This should not be visible',
          });
        }, [dispatch]);

        return <MessageList />;
      };

      renderWithContext(<TestComponent />);
      expect(screen.queryByText('This should not be visible')).not.toBeInTheDocument();
    });
  });

  describe('Message Metadata', () => {
    it('should display audio duration for audio messages', () => {
      const TestComponent = () => {
        const { dispatch } = require('../context/ConversationContext').useConversation();

        React.useEffect(() => {
          dispatch({
            type: ACTION_TYPES.ADD_MESSAGE,
            payload: {
              id: 'msg-audio',
              role: 'user',
              content: 'Audio message',
              timestamp: Date.now(),
              type: 'audio',
              duration: 5.5,
            },
          });
        }, [dispatch]);

        return <MessageList />;
      };

      renderWithContext(<TestComponent />);
      expect(screen.getByText(/5\.5s/)).toBeInTheDocument();
    });

    it('should display tool indicator when activeTool is present', () => {
      const TestComponent = () => {
        const { dispatch } = require('../context/ConversationContext').useConversation();

        React.useEffect(() => {
          dispatch({
            type: ACTION_TYPES.SET_ACTIVE_TOOL,
            payload: {
              toolName: 'weatherTool',
              args: { location: 'San Francisco' },
            },
          });
        }, [dispatch]);

        return <MessageList />;
      };

      renderWithContext(<TestComponent />);
      expect(screen.getByText(/weatherTool/)).toBeInTheDocument();
    });
  });

  describe('Auto-scroll Behavior', () => {
    it('should auto-scroll when new messages are added', async () => {
      const scrollIntoViewMock = jest.fn();

      // Mock Element.prototype.scrollIntoView
      Element.prototype.scrollIntoView = scrollIntoViewMock;

      const TestComponent = () => {
        const { dispatch } = require('../context/ConversationContext').useConversation();
        const [messageAdded, setMessageAdded] = React.useState(false);

        React.useEffect(() => {
          if (!messageAdded) {
            setTimeout(() => {
              dispatch({
                type: ACTION_TYPES.ADD_MESSAGE,
                payload: {
                  id: 'msg-scroll',
                  role: 'user',
                  content: 'Test scroll',
                  timestamp: Date.now(),
                  type: 'text',
                },
              });
              setMessageAdded(true);
            }, 100);
          }
        }, [dispatch, messageAdded]);

        return <MessageList />;
      };

      renderWithContext(<TestComponent />);

      await waitFor(() => {
        expect(screen.getByText('Test scroll')).toBeInTheDocument();
      });

      // Wait for scroll to be called
      await waitFor(() => {
        expect(scrollIntoViewMock).toHaveBeenCalled();
      }, { timeout: 1000 });

      // Cleanup
      delete Element.prototype.scrollIntoView;
    });
  });

  describe('Different Message Types', () => {
    it('should render text type messages', () => {
      const TestComponent = () => {
        const { dispatch } = require('../context/ConversationContext').useConversation();

        React.useEffect(() => {
          dispatch({
            type: ACTION_TYPES.ADD_MESSAGE,
            payload: {
              id: 'msg-text',
              role: 'user',
              content: 'Text message',
              timestamp: Date.now(),
              type: 'text',
            },
          });
        }, [dispatch]);

        return <MessageList />;
      };

      renderWithContext(<TestComponent />);
      const message = screen.getByText('Text message').closest('.message');
      expect(message).toHaveClass('message-type-text');
    });

    it('should render audio type messages', () => {
      const TestComponent = () => {
        const { dispatch } = require('../context/ConversationContext').useConversation();

        React.useEffect(() => {
          dispatch({
            type: ACTION_TYPES.ADD_MESSAGE,
            payload: {
              id: 'msg-audio',
              role: 'assistant',
              content: 'Audio response',
              timestamp: Date.now(),
              type: 'audio',
              duration: 3.2,
            },
          });
        }, [dispatch]);

        return <MessageList />;
      };

      renderWithContext(<TestComponent />);
      const message = screen.getByText('Audio response').closest('.message');
      expect(message).toHaveClass('message-type-audio');
    });

    it('should render error type messages', () => {
      const TestComponent = () => {
        const { dispatch } = require('../context/ConversationContext').useConversation();

        React.useEffect(() => {
          dispatch({
            type: ACTION_TYPES.ADD_MESSAGE,
            payload: {
              id: 'msg-error',
              role: 'assistant',
              content: 'Error occurred',
              timestamp: Date.now(),
              type: 'error',
            },
          });
        }, [dispatch]);

        return <MessageList />;
      };

      renderWithContext(<TestComponent />);
      const message = screen.getByText('Error occurred').closest('.message');
      expect(message).toHaveClass('message-type-error');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty message content gracefully', () => {
      const TestComponent = () => {
        const { dispatch } = require('../context/ConversationContext').useConversation();

        React.useEffect(() => {
          dispatch({
            type: ACTION_TYPES.ADD_MESSAGE,
            payload: {
              id: 'msg-empty',
              role: 'user',
              content: '',
              timestamp: Date.now(),
              type: 'text',
            },
          });
        }, [dispatch]);

        return <MessageList />;
      };

      renderWithContext(<TestComponent />);
      const messageList = screen.getByRole('log');
      expect(messageList).toBeInTheDocument();
    });

    it('should handle very long messages', () => {
      const longContent = 'A'.repeat(1000);

      const TestComponent = () => {
        const { dispatch } = require('../context/ConversationContext').useConversation();

        React.useEffect(() => {
          dispatch({
            type: ACTION_TYPES.ADD_MESSAGE,
            payload: {
              id: 'msg-long',
              role: 'assistant',
              content: longContent,
              timestamp: Date.now(),
              type: 'text',
            },
          });
        }, [dispatch]);

        return <MessageList />;
      };

      renderWithContext(<TestComponent />);
      expect(screen.getByText(longContent)).toBeInTheDocument();
    });
  });
});
