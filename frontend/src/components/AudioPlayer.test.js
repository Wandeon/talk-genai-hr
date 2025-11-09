import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import AudioPlayer from './AudioPlayer';
import useAudioPlayer from '../hooks/useAudioPlayer';

// Mock the useAudioPlayer hook
jest.mock('../hooks/useAudioPlayer');

describe('AudioPlayer Component', () => {
  const mockPlayAudioChunk = jest.fn();
  const mockStop = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock implementation
    useAudioPlayer.mockReturnValue({
      isPlaying: false,
      playAudioChunk: mockPlayAudioChunk,
      stop: mockStop,
      queue: [],
    });
  });

  describe('rendering', () => {
    it('should render the audio player component', () => {
      render(<AudioPlayer />);

      expect(screen.getByText('Ready')).toBeInTheDocument();
    });

    it('should display stopped status when not playing', () => {
      useAudioPlayer.mockReturnValue({
        isPlaying: false,
        playAudioChunk: mockPlayAudioChunk,
        stop: mockStop,
        queue: [],
      });

      render(<AudioPlayer />);

      expect(screen.getByText('Ready')).toBeInTheDocument();
    });

    it('should display playing status when audio is playing', () => {
      useAudioPlayer.mockReturnValue({
        isPlaying: true,
        playAudioChunk: mockPlayAudioChunk,
        stop: mockStop,
        queue: [],
      });

      render(<AudioPlayer />);

      expect(screen.getByText('Playing audio...')).toBeInTheDocument();
    });
  });

  describe('queue display', () => {
    it('should not show queue info when queue is empty', () => {
      useAudioPlayer.mockReturnValue({
        isPlaying: false,
        playAudioChunk: mockPlayAudioChunk,
        stop: mockStop,
        queue: [],
      });

      render(<AudioPlayer />);

      expect(screen.queryByText('Queued chunks:')).not.toBeInTheDocument();
    });

    it('should show queue info with count when queue has chunks', () => {
      useAudioPlayer.mockReturnValue({
        isPlaying: true,
        playAudioChunk: mockPlayAudioChunk,
        stop: mockStop,
        queue: ['chunk1', 'chunk2', 'chunk3'],
      });

      render(<AudioPlayer />);

      expect(screen.getByText('Queued chunks:')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('should update queue count when queue changes', () => {
      const { rerender } = render(<AudioPlayer />);

      // Initial state: no queue
      expect(screen.queryByText('Queued chunks:')).not.toBeInTheDocument();

      // Update mock to have queue items
      useAudioPlayer.mockReturnValue({
        isPlaying: true,
        playAudioChunk: mockPlayAudioChunk,
        stop: mockStop,
        queue: ['chunk1', 'chunk2'],
      });

      rerender(<AudioPlayer />);

      expect(screen.getByText('Queued chunks:')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
    });
  });

  describe('stop button', () => {
    it('should not show stop button when not playing', () => {
      useAudioPlayer.mockReturnValue({
        isPlaying: false,
        playAudioChunk: mockPlayAudioChunk,
        stop: mockStop,
        queue: [],
      });

      render(<AudioPlayer />);

      expect(screen.queryByText('Stop Playing')).not.toBeInTheDocument();
    });

    it('should show stop button when playing', () => {
      useAudioPlayer.mockReturnValue({
        isPlaying: true,
        playAudioChunk: mockPlayAudioChunk,
        stop: mockStop,
        queue: [],
      });

      render(<AudioPlayer />);

      expect(screen.getByText('Stop Playing')).toBeInTheDocument();
    });

    it('should call stop handler when stop button is clicked', () => {
      useAudioPlayer.mockReturnValue({
        isPlaying: true,
        playAudioChunk: mockPlayAudioChunk,
        stop: mockStop,
        queue: [],
      });

      render(<AudioPlayer />);

      const stopButton = screen.getByText('Stop Playing');
      fireEvent.click(stopButton);

      expect(mockStop).toHaveBeenCalledTimes(1);
    });

    it('should have correct accessibility attributes on stop button', () => {
      useAudioPlayer.mockReturnValue({
        isPlaying: true,
        playAudioChunk: mockPlayAudioChunk,
        stop: mockStop,
        queue: [],
      });

      render(<AudioPlayer />);

      const stopButton = screen.getByText('Stop Playing');
      expect(stopButton).toHaveAttribute('title', 'Stop audio playback (interrupt)');
    });
  });

  describe('visual state', () => {
    it('should have correct CSS class when playing', () => {
      useAudioPlayer.mockReturnValue({
        isPlaying: true,
        playAudioChunk: mockPlayAudioChunk,
        stop: mockStop,
        queue: [],
      });

      const { container } = render(<AudioPlayer />);

      const indicator = container.querySelector('.playback-indicator');
      expect(indicator).toHaveClass('playing');
    });

    it('should have correct CSS class when not playing', () => {
      useAudioPlayer.mockReturnValue({
        isPlaying: false,
        playAudioChunk: mockPlayAudioChunk,
        stop: mockStop,
        queue: [],
      });

      const { container } = render(<AudioPlayer />);

      const indicator = container.querySelector('.playback-indicator');
      expect(indicator).toHaveClass('stopped');
    });
  });

  describe('state change callback', () => {
    it('should call onAudioStateChange callback when state changes', () => {
      const onAudioStateChange = jest.fn();

      useAudioPlayer.mockReturnValue({
        isPlaying: false,
        playAudioChunk: mockPlayAudioChunk,
        stop: mockStop,
        queue: [],
      });

      render(<AudioPlayer onAudioStateChange={onAudioStateChange} />);

      expect(onAudioStateChange).toHaveBeenCalledWith({
        isPlaying: false,
        queueLength: 0,
      });
    });

    it('should call onAudioStateChange with updated values', () => {
      const onAudioStateChange = jest.fn();

      const { rerender } = render(<AudioPlayer onAudioStateChange={onAudioStateChange} />);

      // Clear previous calls
      onAudioStateChange.mockClear();

      // Update mock state
      useAudioPlayer.mockReturnValue({
        isPlaying: true,
        playAudioChunk: mockPlayAudioChunk,
        stop: mockStop,
        queue: ['chunk1'],
      });

      rerender(<AudioPlayer onAudioStateChange={onAudioStateChange} />);

      expect(onAudioStateChange).toHaveBeenCalledWith({
        isPlaying: true,
        queueLength: 1,
      });
    });

    it('should handle missing onAudioStateChange callback gracefully', () => {
      useAudioPlayer.mockReturnValue({
        isPlaying: true,
        playAudioChunk: mockPlayAudioChunk,
        stop: mockStop,
        queue: [],
      });

      // Should not throw
      expect(() => {
        render(<AudioPlayer />);
      }).not.toThrow();
    });
  });

  describe('integration', () => {
    it('should render complete player with all elements', () => {
      useAudioPlayer.mockReturnValue({
        isPlaying: true,
        playAudioChunk: mockPlayAudioChunk,
        stop: mockStop,
        queue: ['chunk1', 'chunk2'],
      });

      const { container } = render(<AudioPlayer />);

      // Check structure
      expect(container.querySelector('.audio-player')).toBeInTheDocument();
      expect(container.querySelector('.audio-player-status')).toBeInTheDocument();
      expect(container.querySelector('.playback-indicator')).toBeInTheDocument();
      expect(container.querySelector('.queue-info')).toBeInTheDocument();
      expect(screen.getByText('Stop Playing')).toBeInTheDocument();
    });

    it('should handle rapid state changes', () => {
      const { rerender } = render(<AudioPlayer />);

      // Simulate rapid state changes
      for (let i = 0; i < 5; i++) {
        useAudioPlayer.mockReturnValue({
          isPlaying: i % 2 === 0,
          playAudioChunk: mockPlayAudioChunk,
          stop: mockStop,
          queue: Array(i).fill('chunk'),
        });

        expect(() => {
          rerender(<AudioPlayer />);
        }).not.toThrow();
      }
    });
  });
});
