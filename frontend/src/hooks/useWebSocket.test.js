import { renderHook, act, waitFor } from '@testing-library/react';
import useWebSocket from './useWebSocket';

// Store WebSocket instances for testing
let wsInstance = null;

// Mock WebSocket
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  constructor(url) {
    this.url = url;
    this.readyState = MockWebSocket.CONNECTING;
    this.onopen = null;
    this.onmessage = null;
    this.onclose = null;
    this.onerror = null;
    wsInstance = this;

    // Simulate async connection
    setTimeout(() => {
      if (this.readyState !== MockWebSocket.CLOSED) {
        this.readyState = MockWebSocket.OPEN;
        if (this.onopen) {
          this.onopen(new Event('open'));
        }
      }
    }, 0);
  }

  send(data) {
    if (this.readyState !== MockWebSocket.OPEN) {
      throw new Error('WebSocket is not open');
    }
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) {
      this.onclose(new CloseEvent('close'));
    }
  }
}

global.WebSocket = MockWebSocket;

describe('useWebSocket', () => {
  beforeEach(() => {
    wsInstance = null;
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  it('should connect on mount', async () => {
    const { result } = renderHook(() =>
      useWebSocket('ws://localhost:8000', () => {})
    );

    expect(result.current.isConnected).toBe(false);

    // Wait for connection
    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    }, { timeout: 1000 });
  });

  it('should send messages when connected', async () => {
    const { result } = renderHook(() =>
      useWebSocket('ws://localhost:8000', () => {})
    );

    // Wait for connection
    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    }, { timeout: 1000 });

    // Should not throw when sending
    act(() => {
      expect(() => {
        result.current.sendMessage({ type: 'test', data: 'hello' });
      }).not.toThrow();
    });
  });

  it('should handle incoming messages', async () => {
    const onMessage = jest.fn();
    const { result } = renderHook(() =>
      useWebSocket('ws://localhost:8000', onMessage)
    );

    // Wait for connection
    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    }, { timeout: 1000 });

    // Simulate incoming message
    act(() => {
      const messageEvent = new MessageEvent('message', {
        data: JSON.stringify({ type: 'test', content: 'hello' })
      });

      // Use the stored wsInstance
      if (wsInstance && wsInstance.onmessage) {
        wsInstance.onmessage(messageEvent);
      }
    });

    expect(onMessage).toHaveBeenCalledWith({
      type: 'test',
      content: 'hello'
    });
  });

  it('should not send messages when disconnected', () => {
    const { result } = renderHook(() =>
      useWebSocket('ws://localhost:8000', () => {})
    );

    // Try to send before connection
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

    act(() => {
      result.current.sendMessage({ type: 'test' });
    });

    consoleSpy.mockRestore();
  });

  it('should cleanup on unmount', async () => {
    const { result, unmount } = renderHook(() =>
      useWebSocket('ws://localhost:8000', () => {})
    );

    // Wait for connection
    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    }, { timeout: 1000 });

    const closeSpy = jest.spyOn(wsInstance, 'close');

    // Unmount should close connection
    unmount();

    expect(closeSpy).toHaveBeenCalled();
  });
});
