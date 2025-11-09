import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import VisionUploader from './VisionUploader';

// Create a mock FileReader that uses onload callback
class MockFileReader {
  constructor() {
    this.result = null;
    this.onload = null;
    this.onerror = null;
  }

  readAsDataURL(file) {
    // Simulate async file reading
    setTimeout(() => {
      this.result = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      if (this.onload) {
        this.onload();
      }
    }, 0);
  }
}

beforeEach(() => {
  global.FileReader = MockFileReader;
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('VisionUploader Component', () => {
  const mockOnUpload = jest.fn();

  beforeEach(() => {
    mockOnUpload.mockClear();
  });

  describe('Rendering', () => {
    it('should render without crashing', () => {
      render(<VisionUploader onUpload={mockOnUpload} />);
      expect(screen.getByTestId('vision-uploader')).toBeInTheDocument();
    });

    it('should render file input', () => {
      render(<VisionUploader onUpload={mockOnUpload} />);
      expect(screen.getByTestId('image-input')).toBeInTheDocument();
    });

    it('should have correct file input accept attributes', () => {
      render(<VisionUploader onUpload={mockOnUpload} />);
      const input = screen.getByTestId('image-input');
      expect(input).toHaveAttribute('accept', 'image/jpeg,image/png,image/webp');
    });

    it('should render drag and drop zone', () => {
      render(<VisionUploader onUpload={mockOnUpload} />);
      expect(screen.getByTestId('drag-drop-zone')).toBeInTheDocument();
    });

    it('should render upload button', () => {
      render(<VisionUploader onUpload={mockOnUpload} />);
      expect(screen.getByRole('button', { name: /upload/i })).toBeInTheDocument();
    });

    it('should render clear button when image is selected', async () => {
      render(<VisionUploader onUpload={mockOnUpload} />);
      const input = screen.getByTestId('image-input');

      const file = new File(['image content'], 'image.png', { type: 'image/png' });
      fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /clear/i })).toBeInTheDocument();
      });
    });

    it('should render prompt input field', () => {
      render(<VisionUploader onUpload={mockOnUpload} />);
      expect(screen.getByPlaceholderText(/enter a prompt/i)).toBeInTheDocument();
    });
  });

  describe('File Selection', () => {
    it('should handle file input change', async () => {
      render(<VisionUploader onUpload={mockOnUpload} />);
      const input = screen.getByTestId('image-input');

      const file = new File(['image content'], 'image.png', { type: 'image/png' });
      fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        // File was processed successfully
        expect(screen.getByTestId('image-preview')).toBeInTheDocument();
      });
    });

    it('should reject files with invalid type', async () => {
      render(<VisionUploader onUpload={mockOnUpload} />);
      const input = screen.getByTestId('image-input');

      const file = new File(['text content'], 'file.txt', { type: 'text/plain' });
      fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByText(/jpg, png, and webp/i)).toBeInTheDocument();
      });
    });

    it('should reject files larger than 5MB', async () => {
      render(<VisionUploader onUpload={mockOnUpload} />);
      const input = screen.getByTestId('image-input');

      // Create a file larger than 5MB
      const largeFile = new File(['x'.repeat(5 * 1024 * 1024 + 1)], 'large.png', { type: 'image/png' });
      fireEvent.change(input, { target: { files: [largeFile] } });

      await waitFor(() => {
        expect(screen.getByText(/must be less than 5mb/i)).toBeInTheDocument();
      });
    });

    it('should accept JPEG files', async () => {
      render(<VisionUploader onUpload={mockOnUpload} />);
      const input = screen.getByTestId('image-input');

      const file = new File(['image content'], 'image.jpg', { type: 'image/jpeg' });
      fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByTestId('image-preview')).toBeInTheDocument();
      });
    });

    it('should accept PNG files', async () => {
      render(<VisionUploader onUpload={mockOnUpload} />);
      const input = screen.getByTestId('image-input');

      const file = new File(['image content'], 'image.png', { type: 'image/png' });
      fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByTestId('image-preview')).toBeInTheDocument();
      });
    });

    it('should accept WebP files', async () => {
      render(<VisionUploader onUpload={mockOnUpload} />);
      const input = screen.getByTestId('image-input');

      const file = new File(['image content'], 'image.webp', { type: 'image/webp' });
      fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByTestId('image-preview')).toBeInTheDocument();
      });
    });
  });

  describe('Drag and Drop', () => {
    it('should handle drag over event', () => {
      render(<VisionUploader onUpload={mockOnUpload} />);
      const dropZone = screen.getByTestId('drag-drop-zone');

      fireEvent.dragOver(dropZone);

      expect(dropZone).toHaveClass('drag-over');
    });

    it('should handle drag leave event', () => {
      render(<VisionUploader onUpload={mockOnUpload} />);
      const dropZone = screen.getByTestId('drag-drop-zone');

      fireEvent.dragOver(dropZone);
      fireEvent.dragLeave(dropZone);

      expect(dropZone).not.toHaveClass('drag-over');
    });

    it('should handle drop event with valid image', async () => {
      render(<VisionUploader onUpload={mockOnUpload} />);
      const dropZone = screen.getByTestId('drag-drop-zone');

      const file = new File(['image content'], 'image.png', { type: 'image/png' });
      const dataTransfer = {
        items: [{ kind: 'file', getAsFile: () => file }],
      };

      fireEvent.drop(dropZone, { dataTransfer });

      await waitFor(() => {
        expect(screen.getByTestId('image-preview')).toBeInTheDocument();
      });
    });

    it('should reject drop of invalid file type', async () => {
      render(<VisionUploader onUpload={mockOnUpload} />);
      const dropZone = screen.getByTestId('drag-drop-zone');

      const file = new File(['text content'], 'file.txt', { type: 'text/plain' });
      const dataTransfer = {
        items: [{ kind: 'file', getAsFile: () => file }],
      };

      fireEvent.drop(dropZone, { dataTransfer });

      await waitFor(() => {
        expect(screen.getByText(/jpg, png, and webp/i)).toBeInTheDocument();
      });
    });

    it('should remove drag-over class when dropping', async () => {
      render(<VisionUploader onUpload={mockOnUpload} />);
      const dropZone = screen.getByTestId('drag-drop-zone');

      const file = new File(['image content'], 'image.png', { type: 'image/png' });
      const dataTransfer = {
        items: [{ kind: 'file', getAsFile: () => file }],
      };

      fireEvent.dragOver(dropZone);
      fireEvent.drop(dropZone, { dataTransfer });

      expect(dropZone).not.toHaveClass('drag-over');
    });
  });

  describe('Image Preview', () => {
    it('should display image preview after selection', async () => {
      render(<VisionUploader onUpload={mockOnUpload} />);
      const input = screen.getByTestId('image-input');

      const file = new File(['image content'], 'image.png', { type: 'image/png' });
      fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        const preview = screen.getByTestId('image-preview');
        expect(preview).toBeInTheDocument();
      });
    });

    it('should display preview image with correct src', async () => {
      render(<VisionUploader onUpload={mockOnUpload} />);
      const input = screen.getByTestId('image-input');

      const file = new File(['image content'], 'image.png', { type: 'image/png' });
      fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        const preview = screen.getByTestId('image-preview');
        expect(preview).toHaveAttribute('src');
      });
    });

    it('should update preview when new image is selected', async () => {
      render(<VisionUploader onUpload={mockOnUpload} />);
      const input = screen.getByTestId('image-input');

      const file1 = new File(['image content 1'], 'image1.png', { type: 'image/png' });
      fireEvent.change(input, { target: { files: [file1] } });

      await waitFor(() => {
        expect(screen.getByTestId('image-preview')).toBeInTheDocument();
      });

      const file2 = new File(['image content 2'], 'image2.png', { type: 'image/png' });
      fireEvent.change(input, { target: { files: [file2] } });

      await waitFor(() => {
        expect(screen.getByTestId('image-preview')).toBeInTheDocument();
      });
    });
  });

  describe('Base64 Conversion', () => {
    it('should convert image to base64', async () => {
      render(<VisionUploader onUpload={mockOnUpload} />);
      const input = screen.getByTestId('image-input');

      const file = new File(['image content'], 'image.png', { type: 'image/png' });
      fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        // Verify image preview is shown, which means FileReader worked
        expect(screen.getByTestId('image-preview')).toBeInTheDocument();
      });
    });

    it('should create proper data URI for base64 image', async () => {
      render(<VisionUploader onUpload={mockOnUpload} />);
      const input = screen.getByTestId('image-input');

      const file = new File(['image content'], 'image.png', { type: 'image/png' });
      fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        // Verify that image preview contains the data URI
        const preview = screen.getByTestId('image-preview');
        expect(preview).toHaveAttribute('src');
        expect(preview.src).toMatch(/^data:image\//);
      });
    });

    it('should handle FileReader errors gracefully', async () => {
      // Create a FileReader that triggers error
      class ErrorFileReader {
        constructor() {
          this.result = null;
          this.onload = null;
          this.onerror = null;
        }

        readAsDataURL(file) {
          setTimeout(() => {
            if (this.onerror) {
              this.onerror();
            }
          }, 0);
        }
      }

      global.FileReader = ErrorFileReader;

      render(<VisionUploader onUpload={mockOnUpload} />);
      const input = screen.getByTestId('image-input');

      const file = new File(['image content'], 'image.png', { type: 'image/png' });
      fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByText(/failed to read/i)).toBeInTheDocument();
      });

      // Restore the mock
      global.FileReader = MockFileReader;
    });
  });

  describe('Upload Functionality', () => {
    it('should call onUpload with image data when upload button clicked', async () => {
      render(<VisionUploader onUpload={mockOnUpload} />);
      const input = screen.getByTestId('image-input');

      const file = new File(['image content'], 'image.png', { type: 'image/png' });
      fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        const uploadButton = screen.getByRole('button', { name: /upload/i });
        expect(uploadButton).not.toBeDisabled();
      });

      const uploadButton = screen.getByRole('button', { name: /upload/i });
      fireEvent.click(uploadButton);

      await waitFor(() => {
        expect(mockOnUpload).toHaveBeenCalledWith(
          expect.stringMatching(/^data:image\//),
          ''
        );
      });
    });

    it('should call onUpload with prompt text when provided', async () => {
      render(<VisionUploader onUpload={mockOnUpload} />);
      const input = screen.getByTestId('image-input');
      const promptInput = screen.getByPlaceholderText(/enter a prompt/i);

      const file = new File(['image content'], 'image.png', { type: 'image/png' });
      fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByTestId('image-preview')).toBeInTheDocument();
      });

      fireEvent.change(promptInput, { target: { value: 'Describe this image' } });

      const uploadButton = screen.getByRole('button', { name: /upload/i });
      fireEvent.click(uploadButton);

      await waitFor(() => {
        expect(mockOnUpload).toHaveBeenCalledWith(
          expect.stringMatching(/^data:image\//),
          'Describe this image'
        );
      });
    });

    it('should disable upload button when no image selected', () => {
      render(<VisionUploader onUpload={mockOnUpload} />);
      const uploadButton = screen.getByRole('button', { name: /upload/i });
      expect(uploadButton).toBeDisabled();
    });

    it('should disable upload button during upload', async () => {
      render(<VisionUploader onUpload={mockOnUpload} />);
      const input = screen.getByTestId('image-input');

      const file = new File(['image content'], 'image.png', { type: 'image/png' });
      fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByTestId('image-preview')).toBeInTheDocument();
      });

      const uploadButton = screen.getByRole('button', { name: /upload/i });
      fireEvent.click(uploadButton);

      // Button should be disabled during upload
      await waitFor(() => {
        expect(uploadButton).toBeDisabled();
      });
    });

    it('should show loading indicator during upload', async () => {
      render(<VisionUploader onUpload={mockOnUpload} />);
      const input = screen.getByTestId('image-input');

      const file = new File(['image content'], 'image.png', { type: 'image/png' });
      fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByTestId('image-preview')).toBeInTheDocument();
      });

      const uploadButton = screen.getByRole('button', { name: /upload/i });
      fireEvent.click(uploadButton);

      await waitFor(() => {
        expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
      });
    });
  });

  describe('Clear/Remove Image', () => {
    it('should clear image when clear button clicked', async () => {
      render(<VisionUploader onUpload={mockOnUpload} />);
      const input = screen.getByTestId('image-input');

      const file = new File(['image content'], 'image.png', { type: 'image/png' });
      fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByTestId('image-preview')).toBeInTheDocument();
      });

      const clearButton = screen.getByRole('button', { name: /clear/i });
      fireEvent.click(clearButton);

      await waitFor(() => {
        expect(screen.queryByTestId('image-preview')).not.toBeInTheDocument();
      });
    });

    it('should clear prompt text when image is cleared', async () => {
      render(<VisionUploader onUpload={mockOnUpload} />);
      const input = screen.getByTestId('image-input');
      const promptInput = screen.getByPlaceholderText(/enter a prompt/i);

      const file = new File(['image content'], 'image.png', { type: 'image/png' });
      fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByTestId('image-preview')).toBeInTheDocument();
      });

      fireEvent.change(promptInput, { target: { value: 'Test prompt' } });

      const clearButton = screen.getByRole('button', { name: /clear/i });
      fireEvent.click(clearButton);

      await waitFor(() => {
        expect(promptInput).toHaveValue('');
      });
    });

    it('should hide clear button when no image selected', () => {
      render(<VisionUploader onUpload={mockOnUpload} />);
      expect(screen.queryByRole('button', { name: /clear/i })).not.toBeInTheDocument();
    });
  });

  describe('Error States', () => {
    it('should display error message for invalid file type', async () => {
      render(<VisionUploader onUpload={mockOnUpload} />);
      const input = screen.getByTestId('image-input');

      const file = new File(['not an image'], 'file.txt', { type: 'text/plain' });
      fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByText(/jpg, png, and webp/i)).toBeInTheDocument();
      });
    });

    it('should display error message for oversized file', async () => {
      render(<VisionUploader onUpload={mockOnUpload} />);
      const input = screen.getByTestId('image-input');

      const largeFile = new File(['x'.repeat(5 * 1024 * 1024 + 1)], 'large.png', { type: 'image/png' });
      fireEvent.change(input, { target: { files: [largeFile] } });

      await waitFor(() => {
        expect(screen.getByText(/must be less than 5mb/i)).toBeInTheDocument();
      });
    });

    it('should display error message with error class', async () => {
      render(<VisionUploader onUpload={mockOnUpload} />);
      const input = screen.getByTestId('image-input');

      const file = new File(['not an image'], 'file.txt', { type: 'text/plain' });
      fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        const errorElement = screen.getByText(/jpg, png, and webp/i);
        expect(errorElement).toHaveClass('error-message');
      });
    });

    it('should clear error when new valid image is selected', async () => {
      render(<VisionUploader onUpload={mockOnUpload} />);
      const input = screen.getByTestId('image-input');

      // First select invalid file
      const invalidFile = new File(['not an image'], 'file.txt', { type: 'text/plain' });
      fireEvent.change(input, { target: { files: [invalidFile] } });

      await waitFor(() => {
        expect(screen.getByText(/jpg, png, and webp/i)).toBeInTheDocument();
      });

      // Then select valid file
      const validFile = new File(['image content'], 'image.png', { type: 'image/png' });
      fireEvent.change(input, { target: { files: [validFile] } });

      await waitFor(() => {
        expect(screen.queryByText(/jpg, png, and webp/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels on buttons', () => {
      render(<VisionUploader onUpload={mockOnUpload} />);
      const uploadButton = screen.getByRole('button', { name: /upload/i });
      expect(uploadButton).toHaveAttribute('aria-label');
    });

    it('should indicate loading state via ARIA', async () => {
      render(<VisionUploader onUpload={mockOnUpload} />);
      const input = screen.getByTestId('image-input');

      const file = new File(['image content'], 'image.png', { type: 'image/png' });
      fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByTestId('image-preview')).toBeInTheDocument();
      });

      const uploadButton = screen.getByRole('button', { name: /upload/i });
      fireEvent.click(uploadButton);

      await waitFor(() => {
        expect(uploadButton).toHaveAttribute('aria-busy', 'true');
      });
    });

    it('should have alt text for preview image', async () => {
      render(<VisionUploader onUpload={mockOnUpload} />);
      const input = screen.getByTestId('image-input');

      const file = new File(['image content'], 'image.png', { type: 'image/png' });
      fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        const preview = screen.getByTestId('image-preview');
        expect(preview).toHaveAttribute('alt');
      });
    });

    it('should have proper role on drag drop zone', () => {
      render(<VisionUploader onUpload={mockOnUpload} />);
      const dropZone = screen.getByTestId('drag-drop-zone');
      expect(dropZone).toHaveAttribute('role');
    });

    it('should support keyboard navigation for file input', () => {
      render(<VisionUploader onUpload={mockOnUpload} />);
      const input = screen.getByTestId('image-input');
      expect(input).toBeVisible();
    });
  });

  describe('Disabled State', () => {
    it('should disable component when disabled prop is true', () => {
      render(<VisionUploader onUpload={mockOnUpload} disabled={true} />);
      const input = screen.getByTestId('image-input');
      const uploadButton = screen.getByRole('button', { name: /upload/i });

      expect(input).toBeDisabled();
      expect(uploadButton).toBeDisabled();
    });

    it('should not accept file input when disabled', () => {
      render(<VisionUploader onUpload={mockOnUpload} disabled={true} />);
      const input = screen.getByTestId('image-input');

      const file = new File(['image content'], 'image.png', { type: 'image/png' });
      fireEvent.change(input, { target: { files: [file] } });

      expect(screen.queryByTestId('image-preview')).not.toBeInTheDocument();
    });
  });

  describe('Prompt Input', () => {
    it('should allow text input in prompt field', async () => {
      render(<VisionUploader onUpload={mockOnUpload} />);
      const input = screen.getByTestId('image-input');

      // First select an image to enable the prompt field
      const file = new File(['image content'], 'image.png', { type: 'image/png' });
      fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByTestId('image-preview')).toBeInTheDocument();
      });

      const promptInput = screen.getByPlaceholderText(/enter a prompt/i);
      await userEvent.type(promptInput, 'Describe this image');

      expect(promptInput).toHaveValue('Describe this image');
    });

    it('should pass prompt to onUpload callback', async () => {
      render(<VisionUploader onUpload={mockOnUpload} />);
      const input = screen.getByTestId('image-input');
      const promptInput = screen.getByPlaceholderText(/enter a prompt/i);

      const file = new File(['image content'], 'image.png', { type: 'image/png' });
      fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByTestId('image-preview')).toBeInTheDocument();
      });

      fireEvent.change(promptInput, { target: { value: 'What do you see?' } });

      const uploadButton = screen.getByRole('button', { name: /upload/i });
      fireEvent.click(uploadButton);

      await waitFor(() => {
        expect(mockOnUpload).toHaveBeenCalledWith(
          expect.any(String),
          'What do you see?'
        );
      });
    });

    it('should clear prompt after successful upload', async () => {
      render(<VisionUploader onUpload={mockOnUpload} />);
      const input = screen.getByTestId('image-input');
      const promptInput = screen.getByPlaceholderText(/enter a prompt/i);

      const file = new File(['image content'], 'image.png', { type: 'image/png' });
      fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByTestId('image-preview')).toBeInTheDocument();
      });

      fireEvent.change(promptInput, { target: { value: 'Test prompt' } });

      const uploadButton = screen.getByRole('button', { name: /upload/i });
      fireEvent.click(uploadButton);

      await waitFor(() => {
        expect(mockOnUpload).toHaveBeenCalled();
      });

      // After upload, prompt should be cleared
      await waitFor(() => {
        expect(promptInput).toHaveValue('');
      });
    });
  });

  describe('Status Messages', () => {
    it('should show no selection text initially', () => {
      render(<VisionUploader onUpload={mockOnUpload} />);
      expect(screen.getByText(/select an image/i)).toBeInTheDocument();
    });

    it('should show uploading text during upload', async () => {
      // Mock the onUpload to delay completion
      const delayedOnUpload = jest.fn(() => new Promise(resolve => setTimeout(resolve, 500)));

      render(<VisionUploader onUpload={delayedOnUpload} />);
      const input = screen.getByTestId('image-input');

      const file = new File(['image content'], 'image.png', { type: 'image/png' });
      fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByTestId('image-preview')).toBeInTheDocument();
      });

      const uploadButton = screen.getByRole('button', { name: /upload/i });
      fireEvent.click(uploadButton);

      await waitFor(() => {
        expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
      });
    });
  });
});
