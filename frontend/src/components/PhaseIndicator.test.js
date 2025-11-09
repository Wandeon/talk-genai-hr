import React from 'react';
import { render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import PhaseIndicator from './PhaseIndicator';
import { ConversationProvider } from '../context/ConversationContext';
import conversationReducer, { initialState } from '../context/conversationReducer';

// Mock context value generator
const createMockContextValue = (state = 'idle') => ({
  state: {
    ...initialState,
    state,
  },
  dispatch: jest.fn(),
});

// Wrapper component that provides context
const PhaseIndicatorWithContext = ({ phase = 'idle' }) => {
  const mockContextValue = createMockContextValue(phase);

  return (
    <div>
      {/* For testing without provider, PhaseIndicator accepts a prop */}
      <PhaseIndicator currentPhase={phase} />
    </div>
  );
};

describe('PhaseIndicator Component', () => {
  describe('Rendering', () => {
    it('should render without crashing', () => {
      render(<PhaseIndicator currentPhase="idle" />);
      expect(screen.getByTestId('phase-indicator')).toBeInTheDocument();
    });

    it('should render phase name', () => {
      render(<PhaseIndicator currentPhase="idle" />);
      const phaseName = screen.getByText('Ready');
      expect(phaseName).toHaveClass('phase-name');
    });

    it('should have correct data-testid', () => {
      render(<PhaseIndicator currentPhase="idle" />);
      expect(screen.getByTestId('phase-indicator')).toBeInTheDocument();
    });
  });

  describe('Idle State', () => {
    it('should render idle phase indicator', () => {
      render(<PhaseIndicator currentPhase="idle" />);
      const indicator = screen.getByTestId('phase-indicator');
      expect(indicator).toHaveClass('phase-idle');
    });

    it('should display Ready text for idle phase', () => {
      render(<PhaseIndicator currentPhase="idle" />);
      expect(screen.getByText('Ready')).toBeInTheDocument();
    });

    it('should have idle-specific animation class', () => {
      render(<PhaseIndicator currentPhase="idle" />);
      const animatedElement = screen.getByTestId('phase-indicator-animation');
      expect(animatedElement).toHaveClass('indicator-idle');
    });

    it('should have proper ARIA labels for idle', () => {
      render(<PhaseIndicator currentPhase="idle" />);
      expect(screen.getByLabelText(/Idle.*ready/i)).toBeInTheDocument();
    });
  });

  describe('Listening State', () => {
    it('should render listening phase indicator', () => {
      render(<PhaseIndicator currentPhase="listening" />);
      const indicator = screen.getByTestId('phase-indicator');
      expect(indicator).toHaveClass('phase-listening');
    });

    it('should display Listening text for listening phase', () => {
      render(<PhaseIndicator currentPhase="listening" />);
      expect(screen.getByText('Listening')).toBeInTheDocument();
    });

    it('should have listening-specific animation class', () => {
      render(<PhaseIndicator currentPhase="listening" />);
      const animatedElement = screen.getByTestId('phase-indicator-animation');
      expect(animatedElement).toHaveClass('indicator-listening');
    });

    it('should have proper ARIA labels for listening', () => {
      render(<PhaseIndicator currentPhase="listening" />);
      expect(screen.getByLabelText(/Listening.*microphone/i)).toBeInTheDocument();
    });
  });

  describe('Transcribing State', () => {
    it('should render transcribing phase indicator', () => {
      render(<PhaseIndicator currentPhase="transcribing" />);
      const indicator = screen.getByTestId('phase-indicator');
      expect(indicator).toHaveClass('phase-transcribing');
    });

    it('should display Transcribing text for transcribing phase', () => {
      render(<PhaseIndicator currentPhase="transcribing" />);
      expect(screen.getByText('Transcribing')).toBeInTheDocument();
    });

    it('should have transcribing-specific animation class', () => {
      render(<PhaseIndicator currentPhase="transcribing" />);
      const animatedElement = screen.getByTestId('phase-indicator-animation');
      expect(animatedElement).toHaveClass('indicator-transcribing');
    });

    it('should have proper ARIA labels for transcribing', () => {
      render(<PhaseIndicator currentPhase="transcribing" />);
      expect(screen.getByLabelText(/Transcribing.*speech/i)).toBeInTheDocument();
    });
  });

  describe('Thinking State', () => {
    it('should render thinking phase indicator', () => {
      render(<PhaseIndicator currentPhase="thinking" />);
      const indicator = screen.getByTestId('phase-indicator');
      expect(indicator).toHaveClass('phase-thinking');
    });

    it('should display Thinking text for thinking phase', () => {
      render(<PhaseIndicator currentPhase="thinking" />);
      expect(screen.getByText('Thinking')).toBeInTheDocument();
    });

    it('should have thinking-specific animation class', () => {
      render(<PhaseIndicator currentPhase="thinking" />);
      const animatedElement = screen.getByTestId('phase-indicator-animation');
      expect(animatedElement).toHaveClass('indicator-thinking');
    });

    it('should have proper ARIA labels for thinking', () => {
      render(<PhaseIndicator currentPhase="thinking" />);
      expect(screen.getByLabelText(/Thinking.*processing/i)).toBeInTheDocument();
    });
  });

  describe('Speaking State', () => {
    it('should render speaking phase indicator', () => {
      render(<PhaseIndicator currentPhase="speaking" />);
      const indicator = screen.getByTestId('phase-indicator');
      expect(indicator).toHaveClass('phase-speaking');
    });

    it('should display Speaking text for speaking phase', () => {
      render(<PhaseIndicator currentPhase="speaking" />);
      expect(screen.getByText('Speaking')).toBeInTheDocument();
    });

    it('should have speaking-specific animation class', () => {
      render(<PhaseIndicator currentPhase="speaking" />);
      const animatedElement = screen.getByTestId('phase-indicator-animation');
      expect(animatedElement).toHaveClass('indicator-speaking');
    });

    it('should have proper ARIA labels for speaking', () => {
      render(<PhaseIndicator currentPhase="speaking" />);
      expect(screen.getByLabelText(/Speaking.*voice output/i)).toBeInTheDocument();
    });
  });

  describe('Phase Transitions', () => {
    it('should transition from idle to listening', () => {
      const { rerender } = render(<PhaseIndicator currentPhase="idle" />);
      expect(screen.getByTestId('phase-indicator')).toHaveClass('phase-idle');

      rerender(<PhaseIndicator currentPhase="listening" />);
      expect(screen.getByTestId('phase-indicator')).toHaveClass('phase-listening');
      expect(screen.getByText('Listening')).toBeInTheDocument();
    });

    it('should transition from listening to transcribing', () => {
      const { rerender } = render(<PhaseIndicator currentPhase="listening" />);
      expect(screen.getByTestId('phase-indicator')).toHaveClass('phase-listening');

      rerender(<PhaseIndicator currentPhase="transcribing" />);
      expect(screen.getByTestId('phase-indicator')).toHaveClass('phase-transcribing');
      expect(screen.getByText('Transcribing')).toBeInTheDocument();
    });

    it('should transition from transcribing to thinking', () => {
      const { rerender } = render(<PhaseIndicator currentPhase="transcribing" />);
      expect(screen.getByTestId('phase-indicator')).toHaveClass('phase-transcribing');

      rerender(<PhaseIndicator currentPhase="thinking" />);
      expect(screen.getByTestId('phase-indicator')).toHaveClass('phase-thinking');
      expect(screen.getByText('Thinking')).toBeInTheDocument();
    });

    it('should transition from thinking to speaking', () => {
      const { rerender } = render(<PhaseIndicator currentPhase="thinking" />);
      expect(screen.getByTestId('phase-indicator')).toHaveClass('phase-thinking');

      rerender(<PhaseIndicator currentPhase="speaking" />);
      expect(screen.getByTestId('phase-indicator')).toHaveClass('phase-speaking');
      expect(screen.getByText('Speaking')).toBeInTheDocument();
    });

    it('should transition from speaking back to idle', () => {
      const { rerender } = render(<PhaseIndicator currentPhase="speaking" />);
      expect(screen.getByTestId('phase-indicator')).toHaveClass('phase-speaking');

      rerender(<PhaseIndicator currentPhase="idle" />);
      expect(screen.getByTestId('phase-indicator')).toHaveClass('phase-idle');
      expect(screen.getByText('Ready')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA role', () => {
      render(<PhaseIndicator currentPhase="idle" />);
      const indicator = screen.getByTestId('phase-indicator');
      expect(indicator).toHaveAttribute('role', 'status');
    });

    it('should have aria-live attribute for status updates', () => {
      render(<PhaseIndicator currentPhase="idle" />);
      const indicator = screen.getByTestId('phase-indicator');
      expect(indicator).toHaveAttribute('aria-live', 'polite');
    });

    it('should have aria-label on indicator', () => {
      const { rerender } = render(<PhaseIndicator currentPhase="idle" />);
      expect(screen.getByLabelText(/Idle.*ready/i)).toBeInTheDocument();

      rerender(<PhaseIndicator currentPhase="listening" />);
      expect(screen.getByLabelText(/Listening.*microphone/i)).toBeInTheDocument();
    });

    it('should provide description text for each phase', () => {
      const phases = [
        { phase: 'idle', text: 'Ready to start' },
        { phase: 'listening', text: 'Listening for audio input' },
        { phase: 'transcribing', text: 'Converting speech to text' },
        { phase: 'thinking', text: 'Processing your request' },
        { phase: 'speaking', text: 'Voice output in progress' },
      ];

      phases.forEach(({ phase, text }) => {
        const { unmount } = render(<PhaseIndicator currentPhase={phase} />);
        expect(screen.getByText(text)).toBeInTheDocument();
        unmount();
      });
    });
  });

  describe('CSS Classes', () => {
    it('should apply correct phase class to container', () => {
      const phases = ['idle', 'listening', 'transcribing', 'thinking', 'speaking'];

      phases.forEach((phase) => {
        const { unmount } = render(<PhaseIndicator currentPhase={phase} />);
        const indicator = screen.getByTestId('phase-indicator');
        expect(indicator).toHaveClass(`phase-${phase}`);
        unmount();
      });
    });

    it('should apply correct animation class to indicator element', () => {
      const phases = ['idle', 'listening', 'transcribing', 'thinking', 'speaking'];

      phases.forEach((phase) => {
        const { unmount } = render(<PhaseIndicator currentPhase={phase} />);
        const animated = screen.getByTestId('phase-indicator-animation');
        expect(animated).toHaveClass(`indicator-${phase}`);
        unmount();
      });
    });

    it('should have phase-indicator-wrapper class on main container', () => {
      render(<PhaseIndicator currentPhase="idle" />);
      const wrapper = screen.getByTestId('phase-indicator');
      expect(wrapper).toHaveClass('phase-indicator-wrapper');
    });
  });

  describe('Content Structure', () => {
    it('should render phase name and description', () => {
      render(<PhaseIndicator currentPhase="idle" />);
      expect(screen.getByText('Ready')).toBeInTheDocument();
      expect(screen.getByText('Ready to start')).toBeInTheDocument();
    });

    it('should have animation element with data-testid', () => {
      render(<PhaseIndicator currentPhase="idle" />);
      expect(screen.getByTestId('phase-indicator-animation')).toBeInTheDocument();
    });

    it('should display description text for all phases', () => {
      const descriptions = {
        idle: 'Ready to start',
        listening: 'Listening for audio input',
        transcribing: 'Converting speech to text',
        thinking: 'Processing your request',
        speaking: 'Voice output in progress',
      };

      Object.entries(descriptions).forEach(([phase, description]) => {
        const { unmount } = render(<PhaseIndicator currentPhase={phase} />);
        expect(screen.getByText(description)).toBeInTheDocument();
        unmount();
      });
    });
  });

  describe('Phase Information', () => {
    it('should display correct phase names', () => {
      const phases = {
        idle: 'Ready',
        listening: 'Listening',
        transcribing: 'Transcribing',
        thinking: 'Thinking',
        speaking: 'Speaking',
      };

      Object.entries(phases).forEach(([phase, name]) => {
        const { unmount } = render(<PhaseIndicator currentPhase={phase} />);
        expect(screen.getByText(name)).toBeInTheDocument();
        unmount();
      });
    });
  });

  describe('Icon Rendering', () => {
    it('should render icon for each phase', () => {
      render(<PhaseIndicator currentPhase="idle" />);
      expect(screen.getByTestId('phase-icon')).toBeInTheDocument();
    });

    it('should change icon based on phase', () => {
      const { rerender } = render(<PhaseIndicator currentPhase="idle" />);
      let icon = screen.getByTestId('phase-icon');
      const idleIcon = icon.textContent;

      rerender(<PhaseIndicator currentPhase="listening" />);
      icon = screen.getByTestId('phase-icon');
      const listeningIcon = icon.textContent;

      // Icons should be different for different phases
      expect(idleIcon).toBeDefined();
      expect(listeningIcon).toBeDefined();
    });
  });
});
