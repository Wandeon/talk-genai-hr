import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import AudioRecorder from './AudioRecorder';
import useAudioRecorder from '../hooks/useAudioRecorder';

// Mock the useAudioRecorder hook
jest.mock('../hooks/useAudioRecorder');

describe('AudioRecorder Component', () => {
  let mockStartRecording;
  let mockStopRecording;
  let mockSendAudioChunk;

  beforeEach(() => {
    mockStartRecording = jest.fn();
    mockStopRecording = jest.fn();
    mockSendAudioChunk = jest.fn();

    // Default mock implementation
    useAudioRecorder.mockReturnValue({
      isRecording: false,
      hasPermission: true,
      permissionError: null,
      startRecording: mockStartRecording,
      stopRecording: mockStopRecording,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Permission States', () => {
    it('should render without crashing', () => {
      render(<AudioRecorder sendAudioChunk={mockSendAudioChunk} />);
      expect(screen.getByTestId('audio-recorder')).toBeInTheDocument();
    });

    it('should show requesting permission state initially', () => {
      useAudioRecorder.mockReturnValue({
        isRecording: false,
        hasPermission: null,
        permissionError: null,
        startRecording: mockStartRecording,
        stopRecording: mockStopRecording,
      });

      render(<AudioRecorder sendAudioChunk={mockSendAudioChunk} />);
      expect(screen.getByText(/requesting microphone access/i)).toBeInTheDocument();
    });

    it('should show ready state when permission granted', () => {
      render(<AudioRecorder sendAudioChunk={mockSendAudioChunk} />);
      expect(screen.getByText(/ready/i)).toBeInTheDocument();
    });

    it('should show permission error when denied', () => {
      useAudioRecorder.mockReturnValue({
        isRecording: false,
        hasPermission: false,
        permissionError: 'Microphone access denied',
        startRecording: mockStartRecording,
        stopRecording: mockStopRecording,
      });

      render(<AudioRecorder sendAudioChunk={mockSendAudioChunk} />);
      expect(screen.getByText(/microphone access denied/i)).toBeInTheDocument();
    });
  });

  describe('Recording Controls', () => {
    it('should show start button when not recording', () => {
      render(<AudioRecorder sendAudioChunk={mockSendAudioChunk} />);
      const button = screen.getByRole('button', { name: /start recording/i });
      expect(button).toBeInTheDocument();
    });

    it('should show stop button when recording', () => {
      useAudioRecorder.mockReturnValue({
        isRecording: true,
        hasPermission: true,
        permissionError: null,
        startRecording: mockStartRecording,
        stopRecording: mockStopRecording,
      });

      render(<AudioRecorder sendAudioChunk={mockSendAudioChunk} />);
      const button = screen.getByRole('button', { name: /stop recording/i });
      expect(button).toBeInTheDocument();
    });

    it('should call startRecording when start button clicked', () => {
      render(<AudioRecorder sendAudioChunk={mockSendAudioChunk} />);
      const button = screen.getByRole('button', { name: /start recording/i });

      fireEvent.click(button);

      expect(mockStartRecording).toHaveBeenCalledTimes(1);
    });

    it('should call stopRecording when stop button clicked', () => {
      useAudioRecorder.mockReturnValue({
        isRecording: true,
        hasPermission: true,
        permissionError: null,
        startRecording: mockStartRecording,
        stopRecording: mockStopRecording,
      });

      render(<AudioRecorder sendAudioChunk={mockSendAudioChunk} />);
      const button = screen.getByRole('button', { name: /stop recording/i });

      fireEvent.click(button);

      expect(mockStopRecording).toHaveBeenCalledTimes(1);
    });

    it('should disable button when permission is not granted', () => {
      useAudioRecorder.mockReturnValue({
        isRecording: false,
        hasPermission: false,
        permissionError: 'Permission denied',
        startRecording: mockStartRecording,
        stopRecording: mockStopRecording,
      });

      render(<AudioRecorder sendAudioChunk={mockSendAudioChunk} />);
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });

    it('should disable button when permission is pending', () => {
      useAudioRecorder.mockReturnValue({
        isRecording: false,
        hasPermission: null,
        permissionError: null,
        startRecording: mockStartRecording,
        stopRecording: mockStopRecording,
      });

      render(<AudioRecorder sendAudioChunk={mockSendAudioChunk} />);
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });
  });

  describe('Visual Indicators', () => {
    it('should show recording indicator when recording', () => {
      useAudioRecorder.mockReturnValue({
        isRecording: true,
        hasPermission: true,
        permissionError: null,
        startRecording: mockStartRecording,
        stopRecording: mockStopRecording,
      });

      render(<AudioRecorder sendAudioChunk={mockSendAudioChunk} />);
      expect(screen.getByTestId('recording-indicator')).toBeInTheDocument();
    });

    it('should not show recording indicator when not recording', () => {
      render(<AudioRecorder sendAudioChunk={mockSendAudioChunk} />);
      expect(screen.queryByTestId('recording-indicator')).not.toBeInTheDocument();
    });

    it('should apply recording class when recording', () => {
      useAudioRecorder.mockReturnValue({
        isRecording: true,
        hasPermission: true,
        permissionError: null,
        startRecording: mockStartRecording,
        stopRecording: mockStopRecording,
      });

      render(<AudioRecorder sendAudioChunk={mockSendAudioChunk} />);
      const recorder = screen.getByTestId('audio-recorder');
      expect(recorder).toHaveClass('recording');
    });
  });

  describe('Auto-start with isListening prop', () => {
    it('should start recording when isListening becomes true', async () => {
      const { rerender } = render(
        <AudioRecorder sendAudioChunk={mockSendAudioChunk} isListening={false} />
      );

      expect(mockStartRecording).not.toHaveBeenCalled();

      rerender(<AudioRecorder sendAudioChunk={mockSendAudioChunk} isListening={true} />);

      await waitFor(() => {
        expect(mockStartRecording).toHaveBeenCalledTimes(1);
      });
    });

    it('should stop recording when isListening becomes false', async () => {
      useAudioRecorder.mockReturnValue({
        isRecording: true,
        hasPermission: true,
        permissionError: null,
        startRecording: mockStartRecording,
        stopRecording: mockStopRecording,
      });

      const { rerender } = render(
        <AudioRecorder sendAudioChunk={mockSendAudioChunk} isListening={true} />
      );

      rerender(<AudioRecorder sendAudioChunk={mockSendAudioChunk} isListening={false} />);

      await waitFor(() => {
        expect(mockStopRecording).toHaveBeenCalledTimes(1);
      });
    });

    it('should not auto-start if permission is not granted', () => {
      useAudioRecorder.mockReturnValue({
        isRecording: false,
        hasPermission: false,
        permissionError: 'Permission denied',
        startRecording: mockStartRecording,
        stopRecording: mockStopRecording,
      });

      render(<AudioRecorder sendAudioChunk={mockSendAudioChunk} isListening={true} />);

      expect(mockStartRecording).not.toHaveBeenCalled();
    });

    it('should work with manual controls when isListening is not provided', () => {
      render(<AudioRecorder sendAudioChunk={mockSendAudioChunk} />);
      const button = screen.getByRole('button', { name: /start recording/i });

      fireEvent.click(button);

      expect(mockStartRecording).toHaveBeenCalledTimes(1);
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(<AudioRecorder sendAudioChunk={mockSendAudioChunk} />);
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-label');
    });

    it('should indicate recording state via ARIA', () => {
      useAudioRecorder.mockReturnValue({
        isRecording: true,
        hasPermission: true,
        permissionError: null,
        startRecording: mockStartRecording,
        stopRecording: mockStopRecording,
      });

      render(<AudioRecorder sendAudioChunk={mockSendAudioChunk} />);
      const recorder = screen.getByTestId('audio-recorder');
      expect(recorder).toHaveAttribute('aria-busy', 'true');
    });

    it('should not be aria-busy when not recording', () => {
      render(<AudioRecorder sendAudioChunk={mockSendAudioChunk} />);
      const recorder = screen.getByTestId('audio-recorder');
      expect(recorder).toHaveAttribute('aria-busy', 'false');
    });
  });

  describe('Error Display', () => {
    it('should show error message with proper styling', () => {
      useAudioRecorder.mockReturnValue({
        isRecording: false,
        hasPermission: false,
        permissionError: 'Test error message',
        startRecording: mockStartRecording,
        stopRecording: mockStopRecording,
      });

      render(<AudioRecorder sendAudioChunk={mockSendAudioChunk} />);
      const errorElement = screen.getByText(/test error message/i);
      expect(errorElement).toHaveClass('error');
    });

    it('should show help text for permission errors', () => {
      useAudioRecorder.mockReturnValue({
        isRecording: false,
        hasPermission: false,
        permissionError: 'Microphone access denied',
        startRecording: mockStartRecording,
        stopRecording: mockStopRecording,
      });

      render(<AudioRecorder sendAudioChunk={mockSendAudioChunk} />);
      expect(screen.getByText(/please grant permission/i)).toBeInTheDocument();
    });
  });

  describe('Integration with sendAudioChunk prop', () => {
    it('should pass sendAudioChunk to useAudioRecorder hook', () => {
      render(<AudioRecorder sendAudioChunk={mockSendAudioChunk} />);

      expect(useAudioRecorder).toHaveBeenCalledWith(mockSendAudioChunk);
    });

    it('should update when sendAudioChunk prop changes', () => {
      const newSendAudioChunk = jest.fn();

      const { rerender } = render(<AudioRecorder sendAudioChunk={mockSendAudioChunk} />);

      expect(useAudioRecorder).toHaveBeenCalledWith(mockSendAudioChunk);

      rerender(<AudioRecorder sendAudioChunk={newSendAudioChunk} />);

      expect(useAudioRecorder).toHaveBeenCalledWith(newSendAudioChunk);
    });
  });
});
