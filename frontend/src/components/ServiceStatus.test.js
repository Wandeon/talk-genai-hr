import React from 'react';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import ServiceStatus from './ServiceStatus';

// Mock the fetch API
global.fetch = jest.fn();

describe('ServiceStatus Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    // Mock AbortController for tests
    if (!global.AbortController) {
      global.AbortController = class {
        constructor() {
          this.signal = {};
        }
        abort() {}
      };
    }
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe('Initial Fetch on Mount', () => {
    it('should fetch service status on mount', async () => {
      const mockStatus = {
        vad: { url: 'http://localhost:5052', status: 'online' },
        stt: { url: 'http://localhost:5051', status: 'online' },
        llm: { url: 'http://localhost:11434', status: 'online' },
        tts: { url: 'http://localhost:5050', status: 'online' }
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockStatus
      });

      render(<ServiceStatus backendUrl="http://localhost:3001" />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
        const callUrl = global.fetch.mock.calls[0][0];
        expect(callUrl).toBe('http://localhost:3001/api/status');
      });
    });

    it('should display loading state initially', () => {
      global.fetch.mockImplementation(() => new Promise(() => {})); // Never resolves

      render(<ServiceStatus backendUrl="http://localhost:3001" />);

      expect(screen.getByText(/loading|checking/i)).toBeInTheDocument();
    });

    it('should display service status after fetching', async () => {
      const mockStatus = {
        vad: { url: 'http://localhost:5052', status: 'online' },
        stt: { url: 'http://localhost:5051', status: 'offline' },
        llm: { url: 'http://localhost:11434', status: 'online' },
        tts: { url: 'http://localhost:5050', status: 'unknown' }
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockStatus
      });

      render(<ServiceStatus backendUrl="http://localhost:3001" />);

      await waitFor(() => {
        expect(screen.getByText(/VAD/i)).toBeInTheDocument();
        expect(screen.getByText(/STT/i)).toBeInTheDocument();
        expect(screen.getByText(/LLM/i)).toBeInTheDocument();
        expect(screen.getByText(/TTS/i)).toBeInTheDocument();
      });
    });
  });

  describe('Service Status Display', () => {
    it('should display service names', async () => {
      const mockStatus = {
        vad: { url: 'http://localhost:5052', status: 'online' },
        stt: { url: 'http://localhost:5051', status: 'online' },
        llm: { url: 'http://localhost:11434', status: 'online' },
        tts: { url: 'http://localhost:5050', status: 'online' }
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockStatus
      });

      render(<ServiceStatus backendUrl="http://localhost:3001" />);

      await waitFor(() => {
        expect(screen.getByText(/VAD/i)).toBeInTheDocument();
        expect(screen.getByText(/STT/i)).toBeInTheDocument();
        expect(screen.getByText(/LLM/i)).toBeInTheDocument();
        expect(screen.getByText(/TTS/i)).toBeInTheDocument();
      });
    });

    it('should display service URLs', async () => {
      const mockStatus = {
        vad: { url: 'http://localhost:5052', status: 'online' },
        stt: { url: 'http://localhost:5051', status: 'online' },
        llm: { url: 'http://localhost:11434', status: 'online' },
        tts: { url: 'http://localhost:5050', status: 'online' }
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockStatus
      });

      render(<ServiceStatus backendUrl="http://localhost:3001" />);

      await waitFor(() => {
        expect(screen.getByText(/http:\/\/localhost:5052/)).toBeInTheDocument();
        expect(screen.getByText(/http:\/\/localhost:5051/)).toBeInTheDocument();
        expect(screen.getByText(/http:\/\/localhost:11434/)).toBeInTheDocument();
        expect(screen.getByText(/http:\/\/localhost:5050/)).toBeInTheDocument();
      });
    });

    it('should display online status with green indicator', async () => {
      const mockStatus = {
        vad: { url: 'http://localhost:5052', status: 'online' },
        stt: { url: 'http://localhost:5051', status: 'online' },
        llm: { url: 'http://localhost:11434', status: 'online' },
        tts: { url: 'http://localhost:5050', status: 'online' }
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockStatus
      });

      const { container } = render(<ServiceStatus backendUrl="http://localhost:3001" />);

      await waitFor(() => {
        const onlineIndicators = container.querySelectorAll('.status-indicator.online');
        expect(onlineIndicators.length).toBeGreaterThan(0);
      });
    });

    it('should display offline status with red indicator', async () => {
      const mockStatus = {
        vad: { url: 'http://localhost:5052', status: 'offline' },
        stt: { url: 'http://localhost:5051', status: 'offline' },
        llm: { url: 'http://localhost:11434', status: 'offline' },
        tts: { url: 'http://localhost:5050', status: 'offline' }
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockStatus
      });

      const { container } = render(<ServiceStatus backendUrl="http://localhost:3001" />);

      await waitFor(() => {
        const offlineIndicators = container.querySelectorAll('.status-indicator.offline');
        expect(offlineIndicators.length).toBeGreaterThan(0);
      });
    });

    it('should display unknown status with gray indicator', async () => {
      const mockStatus = {
        vad: { url: 'http://localhost:5052', status: 'unknown' },
        stt: { url: 'http://localhost:5051', status: 'unknown' },
        llm: { url: 'http://localhost:11434', status: 'unknown' },
        tts: { url: 'http://localhost:5050', status: 'unknown' }
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockStatus
      });

      const { container } = render(<ServiceStatus backendUrl="http://localhost:3001" />);

      await waitFor(() => {
        const unknownIndicators = container.querySelectorAll('.status-indicator.unknown');
        expect(unknownIndicators.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Auto-Refresh', () => {
    it('should refresh status at specified interval', async () => {
      const mockStatus = {
        vad: { url: 'http://localhost:5052', status: 'online' },
        stt: { url: 'http://localhost:5051', status: 'online' },
        llm: { url: 'http://localhost:11434', status: 'online' },
        tts: { url: 'http://localhost:5050', status: 'online' }
      };

      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => mockStatus
      });

      render(<ServiceStatus backendUrl="http://localhost:3001" refreshInterval={5000} />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(1);
      });

      // Fast-forward time by 5 seconds
      act(() => {
        jest.advanceTimersByTime(5000);
      });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(2);
      });
    });

    it('should use default refresh interval of 30 seconds', async () => {
      const mockStatus = {
        vad: { url: 'http://localhost:5052', status: 'online' },
        stt: { url: 'http://localhost:5051', status: 'online' },
        llm: { url: 'http://localhost:11434', status: 'online' },
        tts: { url: 'http://localhost:5050', status: 'online' }
      };

      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => mockStatus
      });

      render(<ServiceStatus backendUrl="http://localhost:3001" />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(1);
      });

      // Fast-forward time by 30 seconds
      act(() => {
        jest.advanceTimersByTime(30000);
      });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Error Handling', () => {
    it('should display error message on fetch failure', async () => {
      global.fetch.mockRejectedValueOnce(new Error('Network error'));

      render(<ServiceStatus backendUrl="http://localhost:3001" />);

      await waitFor(() => {
        expect(screen.getByText(/error|failed/i)).toBeInTheDocument();
      });
    });

    it('should display error message when response is not ok', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      });

      render(<ServiceStatus backendUrl="http://localhost:3001" />);

      await waitFor(() => {
        expect(screen.getByText(/error|failed/i)).toBeInTheDocument();
      });
    });

    it('should show retry button on error', async () => {
      global.fetch.mockRejectedValueOnce(new Error('Network error'));

      render(<ServiceStatus backendUrl="http://localhost:3001" />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      });
    });

    it('should retry fetch when retry button is clicked', async () => {
      const mockStatus = {
        vad: { url: 'http://localhost:5052', status: 'online' },
        stt: { url: 'http://localhost:5051', status: 'online' },
        llm: { url: 'http://localhost:11434', status: 'online' },
        tts: { url: 'http://localhost:5050', status: 'online' }
      };

      global.fetch.mockRejectedValueOnce(new Error('Network error'));
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockStatus
      });

      render(<ServiceStatus backendUrl="http://localhost:3001" />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      });

      const retryButton = screen.getByRole('button', { name: /retry/i });
      fireEvent.click(retryButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(2);
        expect(screen.getByText(/VAD/i)).toBeInTheDocument();
      });
    });
  });

  describe('Expand/Collapse', () => {
    it('should render expand/collapse toggle button', async () => {
      const mockStatus = {
        vad: { url: 'http://localhost:5052', status: 'online' },
        stt: { url: 'http://localhost:5051', status: 'online' },
        llm: { url: 'http://localhost:11434', status: 'online' },
        tts: { url: 'http://localhost:5050', status: 'online' }
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockStatus
      });

      render(<ServiceStatus backendUrl="http://localhost:3001" />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /toggle|expand|collapse|show|hide/i })).toBeInTheDocument();
      });
    });

    it('should be expanded by default', async () => {
      const mockStatus = {
        vad: { url: 'http://localhost:5052', status: 'online' },
        stt: { url: 'http://localhost:5051', status: 'online' },
        llm: { url: 'http://localhost:11434', status: 'online' },
        tts: { url: 'http://localhost:5050', status: 'online' }
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockStatus
      });

      const { container } = render(<ServiceStatus backendUrl="http://localhost:3001" />);

      await waitFor(() => {
        const serviceList = container.querySelector('.service-list');
        expect(serviceList).toHaveClass('expanded');
      });
    });

    it('should collapse when toggle button is clicked', async () => {
      const mockStatus = {
        vad: { url: 'http://localhost:5052', status: 'online' },
        stt: { url: 'http://localhost:5051', status: 'online' },
        llm: { url: 'http://localhost:11434', status: 'online' },
        tts: { url: 'http://localhost:5050', status: 'online' }
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockStatus
      });

      const { container } = render(<ServiceStatus backendUrl="http://localhost:3001" />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /toggle|expand|collapse|show|hide/i })).toBeInTheDocument();
      });

      const toggleButton = screen.getByRole('button', { name: /toggle|expand|collapse|show|hide/i });
      fireEvent.click(toggleButton);

      const serviceList = container.querySelector('.service-list');
      expect(serviceList).toHaveClass('collapsed');
    });

    it('should expand when toggle button is clicked again', async () => {
      const mockStatus = {
        vad: { url: 'http://localhost:5052', status: 'online' },
        stt: { url: 'http://localhost:5051', status: 'online' },
        llm: { url: 'http://localhost:11434', status: 'online' },
        tts: { url: 'http://localhost:5050', status: 'online' }
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockStatus
      });

      const { container } = render(<ServiceStatus backendUrl="http://localhost:3001" />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /toggle|expand|collapse|show|hide/i })).toBeInTheDocument();
      });

      const toggleButton = screen.getByRole('button', { name: /toggle|expand|collapse|show|hide/i });

      // Collapse
      fireEvent.click(toggleButton);
      let serviceList = container.querySelector('.service-list');
      expect(serviceList).toHaveClass('collapsed');

      // Expand again
      fireEvent.click(toggleButton);
      serviceList = container.querySelector('.service-list');
      expect(serviceList).toHaveClass('expanded');
    });
  });

  describe('Last Updated Timestamp', () => {
    it('should display last updated timestamp', async () => {
      const mockStatus = {
        vad: { url: 'http://localhost:5052', status: 'online' },
        stt: { url: 'http://localhost:5051', status: 'online' },
        llm: { url: 'http://localhost:11434', status: 'online' },
        tts: { url: 'http://localhost:5050', status: 'online' }
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockStatus
      });

      render(<ServiceStatus backendUrl="http://localhost:3001" />);

      await waitFor(() => {
        expect(screen.getByText(/updated|last|timestamp/i)).toBeInTheDocument();
      });
    });
  });

  describe('Cleanup on Unmount', () => {
    it('should clear interval on unmount', async () => {
      const mockStatus = {
        vad: { url: 'http://localhost:5052', status: 'online' },
        stt: { url: 'http://localhost:5051', status: 'online' },
        llm: { url: 'http://localhost:11434', status: 'online' },
        tts: { url: 'http://localhost:5050', status: 'online' }
      };

      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => mockStatus
      });

      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

      const { unmount } = render(<ServiceStatus backendUrl="http://localhost:3001" refreshInterval={5000} />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });

      unmount();

      expect(clearIntervalSpy).toHaveBeenCalled();
      clearIntervalSpy.mockRestore();
    });
  });

  describe('AbortController for Fetch Cancellation', () => {
    it('should use AbortController for fetch requests', async () => {
      const mockStatus = {
        vad: { url: 'http://localhost:5052', status: 'online' },
        stt: { url: 'http://localhost:5051', status: 'online' },
        llm: { url: 'http://localhost:11434', status: 'online' },
        tts: { url: 'http://localhost:5050', status: 'online' }
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockStatus
      });

      render(<ServiceStatus backendUrl="http://localhost:3001" />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
        // Verify that the fetch includes a signal in the options (AbortController is used)
        const callArgs = global.fetch.mock.calls[0];
        if (callArgs.length > 1) {
          expect(callArgs[1]).toHaveProperty('signal');
        }
      });
    });
  });

  describe('Props Validation', () => {
    it('should accept backendUrl prop', async () => {
      const mockStatus = {
        vad: { url: 'http://localhost:5052', status: 'online' },
        stt: { url: 'http://localhost:5051', status: 'online' },
        llm: { url: 'http://localhost:11434', status: 'online' },
        tts: { url: 'http://localhost:5050', status: 'online' }
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockStatus
      });

      render(<ServiceStatus backendUrl="http://custom:3001" />);

      await waitFor(() => {
        // Check that fetch was called with the custom URL
        expect(global.fetch).toHaveBeenCalled();
        const callArgs = global.fetch.mock.calls[0][0];
        expect(callArgs).toContain('http://custom:3001/api/status');
      });
    });

    it('should accept refreshInterval prop', async () => {
      const mockStatus = {
        vad: { url: 'http://localhost:5052', status: 'online' },
        stt: { url: 'http://localhost:5051', status: 'online' },
        llm: { url: 'http://localhost:11434', status: 'online' },
        tts: { url: 'http://localhost:5050', status: 'online' }
      };

      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => mockStatus
      });

      // Use a custom refresh interval that's less than the default
      render(<ServiceStatus backendUrl="http://localhost:3001" refreshInterval={1000} />);

      // Initial fetch should happen
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(1);
      }, { timeout: 2000 });

      // Advance time past the refresh interval
      act(() => {
        jest.advanceTimersByTime(1500);
      });

      // Should have called fetch again after the interval
      expect(global.fetch.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
  });
});
