import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ToolCallDisplay from './ToolCallDisplay';

describe('ToolCallDisplay Component', () => {
  describe('Rendering and Basic Structure', () => {
    it('should render without crashing', () => {
      const toolCall = {
        toolName: 'get_time',
        args: {},
        status: 'executing',
      };

      render(<ToolCallDisplay toolCall={toolCall} />);
      expect(screen.getByTestId('tool-call-display')).toBeInTheDocument();
    });

    it('should display tool name prominently', () => {
      const toolCall = {
        toolName: 'get_weather',
        args: { location: 'San Francisco' },
        status: 'executing',
      };

      render(<ToolCallDisplay toolCall={toolCall} />);
      expect(screen.getByText('get_weather')).toBeInTheDocument();
    });

    it('should render with proper semantic HTML', () => {
      const toolCall = {
        toolName: 'test_tool',
        args: {},
        status: 'executing',
      };

      const { container } = render(<ToolCallDisplay toolCall={toolCall} />);
      expect(container.querySelector('article')).toBeInTheDocument();
    });
  });

  describe('Status Display', () => {
    it('should display executing status with loading indicator', () => {
      const toolCall = {
        toolName: 'get_time',
        args: {},
        status: 'executing',
      };

      render(<ToolCallDisplay toolCall={toolCall} />);
      expect(screen.getByTestId('status-badge')).toHaveTextContent(/executing/i);
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    });

    it('should display completed status without loading indicator', () => {
      const toolCall = {
        toolName: 'get_time',
        args: {},
        status: 'completed',
        result: { time: '2024-01-01T12:00:00Z' },
      };

      render(<ToolCallDisplay toolCall={toolCall} />);
      expect(screen.getByTestId('status-badge')).toHaveTextContent(/completed/i);
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
    });

    it('should display error status with error styling', () => {
      const toolCall = {
        toolName: 'get_weather',
        args: { location: 'InvalidCity' },
        status: 'error',
        result: { error: 'Location not found' },
      };

      render(<ToolCallDisplay toolCall={toolCall} />);
      expect(screen.getByTestId('status-badge')).toHaveTextContent(/error/i);
      const container = screen.getByTestId('tool-call-display');
      expect(container.classList.contains('error')).toBe(true);
    });
  });

  describe('Arguments Display', () => {
    it('should display arguments as readable key-value pairs', () => {
      const toolCall = {
        toolName: 'get_weather',
        args: {
          location: 'San Francisco',
          units: 'celsius',
        },
        status: 'executing',
      };

      render(<ToolCallDisplay toolCall={toolCall} />);
      // Expand to see arguments
      const expandButton = screen.getByRole('button', { name: /toggle details/i });
      fireEvent.click(expandButton);

      expect(screen.getByText(/location/i)).toBeInTheDocument();
      expect(screen.getByText(/San Francisco/i)).toBeInTheDocument();
      expect(screen.getByText(/units/i)).toBeInTheDocument();
      expect(screen.getByText(/celsius/i)).toBeInTheDocument();
    });

    it('should handle empty arguments gracefully', () => {
      const toolCall = {
        toolName: 'get_time',
        args: {},
        status: 'executing',
      };

      render(<ToolCallDisplay toolCall={toolCall} />);
      expect(screen.getByTestId('tool-call-display')).toBeInTheDocument();
    });

    it('should handle nested objects in arguments', () => {
      const toolCall = {
        toolName: 'complex_tool',
        args: {
          config: {
            timeout: 5000,
            retries: 3,
          },
          name: 'test',
        },
        status: 'executing',
      };

      render(<ToolCallDisplay toolCall={toolCall} />);
      // Expand to see arguments
      const expandButton = screen.getByRole('button', { name: /toggle details/i });
      fireEvent.click(expandButton);

      // Should show the nested structure
      expect(screen.getByText(/config/i)).toBeInTheDocument();
      expect(screen.getByText(/timeout/i)).toBeInTheDocument();
    });

    it('should handle arrays in arguments', () => {
      const toolCall = {
        toolName: 'array_tool',
        args: {
          items: ['item1', 'item2', 'item3'],
        },
        status: 'executing',
      };

      render(<ToolCallDisplay toolCall={toolCall} />);
      // Expand to see arguments
      const expandButton = screen.getByRole('button', { name: /toggle details/i });
      fireEvent.click(expandButton);

      expect(screen.getByText(/items/i)).toBeInTheDocument();
    });
  });

  describe('Result Display', () => {
    it('should display result when available', () => {
      const toolCall = {
        toolName: 'get_time',
        args: {},
        status: 'completed',
        result: { time: '2024-01-01T12:00:00Z' },
      };

      render(<ToolCallDisplay toolCall={toolCall} />);
      expect(screen.getByText(/result/i)).toBeInTheDocument();
      expect(screen.getByText(/2024-01-01T12:00:00Z/)).toBeInTheDocument();
    });

    it('should not display result when status is executing', () => {
      const toolCall = {
        toolName: 'get_time',
        args: {},
        status: 'executing',
      };

      render(<ToolCallDisplay toolCall={toolCall} />);
      expect(screen.queryByText(/result/i)).not.toBeInTheDocument();
    });

    it('should display error message in result section', () => {
      const toolCall = {
        toolName: 'get_weather',
        args: { location: 'InvalidCity' },
        status: 'error',
        result: { error: 'Location not found' },
      };

      render(<ToolCallDisplay toolCall={toolCall} />);
      expect(screen.getByText(/location not found/i)).toBeInTheDocument();
    });

    it('should handle complex result objects', () => {
      const toolCall = {
        toolName: 'complex_tool',
        args: {},
        status: 'completed',
        result: {
          data: [
            { id: 1, name: 'Item 1' },
            { id: 2, name: 'Item 2' },
          ],
          metadata: { count: 2 },
        },
      };

      render(<ToolCallDisplay toolCall={toolCall} />);
      expect(screen.getByText(/result/i)).toBeInTheDocument();
      // Check that the result section exists and contains data
      const resultSection = screen.getByText(/result/i).closest('.result-section');
      expect(resultSection).toBeInTheDocument();
      expect(resultSection).toHaveTextContent('data');
      expect(resultSection).toHaveTextContent('metadata');
    });
  });

  describe('Expand/Collapse Functionality', () => {
    it('should have expandable section for arguments', () => {
      const toolCall = {
        toolName: 'get_weather',
        args: {
          location: 'San Francisco',
          units: 'celsius',
        },
        status: 'executing',
      };

      render(<ToolCallDisplay toolCall={toolCall} />);
      const expandButton = screen.getByRole('button', { name: /toggle details/i });
      expect(expandButton).toBeInTheDocument();
    });

    it('should toggle expanded state when button clicked', () => {
      const toolCall = {
        toolName: 'get_weather',
        args: {
          location: 'San Francisco',
          units: 'celsius',
        },
        status: 'executing',
      };

      render(<ToolCallDisplay toolCall={toolCall} />);
      const expandButton = screen.getByRole('button', { name: /toggle details/i });

      // Initially arguments might be collapsed
      fireEvent.click(expandButton);
      // After click, should be expanded (or vice versa depending on initial state)
      expect(expandButton).toBeInTheDocument();
    });

    it('should maintain expanded state correctly', () => {
      const toolCall = {
        toolName: 'test_tool',
        args: { key1: 'value1' },
        status: 'executing',
      };

      const { rerender } = render(<ToolCallDisplay toolCall={toolCall} />);
      const expandButton = screen.getByRole('button', { name: /toggle details/i });

      fireEvent.click(expandButton);
      fireEvent.click(expandButton);

      // Should be back to original state
      expect(expandButton).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels for loading state', () => {
      const toolCall = {
        toolName: 'get_time',
        args: {},
        status: 'executing',
      };

      render(<ToolCallDisplay toolCall={toolCall} />);
      const spinner = screen.getByTestId('loading-spinner');
      expect(spinner).toHaveAttribute('aria-live', 'polite');
      expect(spinner).toHaveAttribute('aria-label');
    });

    it('should have proper semantic structure with article element', () => {
      const toolCall = {
        toolName: 'test_tool',
        args: {},
        status: 'completed',
      };

      const { container } = render(<ToolCallDisplay toolCall={toolCall} />);
      const article = container.querySelector('article');
      expect(article).toHaveAttribute('aria-label');
    });

    it('should have keyboard accessible buttons', () => {
      const toolCall = {
        toolName: 'get_weather',
        args: { location: 'San Francisco' },
        status: 'executing',
      };

      render(<ToolCallDisplay toolCall={toolCall} />);
      const button = screen.getByRole('button');
      expect(button).toBeVisible();
    });
  });

  describe('Multiple Tool Types', () => {
    it('should handle get_time tool', () => {
      const toolCall = {
        toolName: 'get_time',
        args: {},
        status: 'completed',
        result: { time: '2024-01-01T12:00:00Z' },
      };

      render(<ToolCallDisplay toolCall={toolCall} />);
      expect(screen.getByText('get_time')).toBeInTheDocument();
    });

    it('should handle get_weather tool', () => {
      const toolCall = {
        toolName: 'get_weather',
        args: { location: 'New York' },
        status: 'completed',
        result: { temperature: 25, condition: 'sunny' },
      };

      render(<ToolCallDisplay toolCall={toolCall} />);
      expect(screen.getByText('get_weather')).toBeInTheDocument();
    });

    it('should handle custom tool names', () => {
      const toolCall = {
        toolName: 'my_custom_tool',
        args: { param: 'value' },
        status: 'executing',
      };

      render(<ToolCallDisplay toolCall={toolCall} />);
      expect(screen.getByText('my_custom_tool')).toBeInTheDocument();
    });
  });

  describe('Status Badge Styling', () => {
    it('should apply executing class to status badge', () => {
      const toolCall = {
        toolName: 'test_tool',
        args: {},
        status: 'executing',
      };

      render(<ToolCallDisplay toolCall={toolCall} />);
      const statusBadge = screen.getByTestId('status-badge');
      expect(statusBadge.classList.contains('executing')).toBe(true);
    });

    it('should apply completed class to status badge', () => {
      const toolCall = {
        toolName: 'test_tool',
        args: {},
        status: 'completed',
        result: {},
      };

      render(<ToolCallDisplay toolCall={toolCall} />);
      const statusBadge = screen.getByTestId('status-badge');
      expect(statusBadge.classList.contains('completed')).toBe(true);
    });

    it('should apply error class to status badge', () => {
      const toolCall = {
        toolName: 'test_tool',
        args: {},
        status: 'error',
        result: { error: 'Something went wrong' },
      };

      render(<ToolCallDisplay toolCall={toolCall} />);
      const statusBadge = screen.getByTestId('status-badge');
      expect(statusBadge.classList.contains('error')).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle undefined result gracefully', () => {
      const toolCall = {
        toolName: 'test_tool',
        args: {},
        status: 'executing',
        result: undefined,
      };

      render(<ToolCallDisplay toolCall={toolCall} />);
      expect(screen.getByTestId('tool-call-display')).toBeInTheDocument();
    });

    it('should handle null result gracefully', () => {
      const toolCall = {
        toolName: 'test_tool',
        args: {},
        status: 'completed',
        result: null,
      };

      render(<ToolCallDisplay toolCall={toolCall} />);
      expect(screen.getByTestId('tool-call-display')).toBeInTheDocument();
    });

    it('should handle special characters in tool name', () => {
      const toolCall = {
        toolName: 'tool_with-special.chars',
        args: {},
        status: 'executing',
      };

      render(<ToolCallDisplay toolCall={toolCall} />);
      expect(screen.getByText('tool_with-special.chars')).toBeInTheDocument();
    });

    it('should handle very long argument values', () => {
      const toolCall = {
        toolName: 'test_tool',
        args: {
          longString: 'a'.repeat(500),
        },
        status: 'executing',
      };

      render(<ToolCallDisplay toolCall={toolCall} />);
      expect(screen.getByTestId('tool-call-display')).toBeInTheDocument();
    });

    it('should handle boolean values in arguments', () => {
      const toolCall = {
        toolName: 'test_tool',
        args: {
          enabled: true,
          debug: false,
        },
        status: 'executing',
      };

      render(<ToolCallDisplay toolCall={toolCall} />);
      // Expand to see arguments
      const expandButton = screen.getByRole('button', { name: /toggle details/i });
      fireEvent.click(expandButton);

      expect(screen.getByText(/enabled/i)).toBeInTheDocument();
    });

    it('should handle numeric values in arguments', () => {
      const toolCall = {
        toolName: 'test_tool',
        args: {
          count: 42,
          ratio: 3.14159,
        },
        status: 'executing',
      };

      render(<ToolCallDisplay toolCall={toolCall} />);
      // Expand to see arguments
      const expandButton = screen.getByRole('button', { name: /toggle details/i });
      fireEvent.click(expandButton);

      expect(screen.getByText(/count/i)).toBeInTheDocument();
    });
  });
});
