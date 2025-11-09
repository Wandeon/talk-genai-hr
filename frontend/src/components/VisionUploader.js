import React, { useState, useRef } from 'react';
import './VisionUploader.css';

/**
 * VisionUploader component - Allows users to upload images for vision analysis
 * @param {Object} props
 * @param {function} props.onUpload - Callback with (imageBase64, prompt) parameters
 * @param {boolean} [props.disabled] - Optional flag to disable the component
 */
const VisionUploader = ({ onUpload, disabled = false }) => {
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [prompt, setPrompt] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  // Allowed image types and max file size
  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

  /**
   * Validates file type and size
   * @param {File} file - The file to validate
   * @returns {Object} - { valid: boolean, error: string }
   */
  const validateFile = (file) => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return {
        valid: false,
        error: 'Invalid file type. This uploader only supports JPG, PNG, and WebP images.',
      };
    }

    if (file.size > MAX_FILE_SIZE) {
      return {
        valid: false,
        error: 'File size too large. Image must be less than 5MB.',
      };
    }

    return { valid: true, error: '' };
  };

  /**
   * Converts file to base64 and sets preview
   * @param {File} file - The file to read
   */
  const handleFileRead = (file) => {
    const reader = new FileReader();

    reader.onload = () => {
      const base64 = reader.result;
      setImage(base64);
      setPreview(base64);
      setError('');
    };

    reader.onerror = () => {
      setError('Failed to read image file. Please try again.');
      setImage(null);
      setPreview(null);
    };

    reader.readAsDataURL(file);
  };

  /**
   * Handle file input change
   * @param {Event} event - The change event
   */
  const handleFileInputChange = (event) => {
    if (disabled) return;

    const files = event.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const validation = validateFile(file);

    if (!validation.valid) {
      setError(validation.error);
      setImage(null);
      setPreview(null);
      return;
    }

    handleFileRead(file);
  };

  /**
   * Handle drag over event
   * @param {Event} event - The drag event
   */
  const handleDragOver = (event) => {
    if (disabled) return;

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.classList.add('drag-over');
  };

  /**
   * Handle drag leave event
   * @param {Event} event - The drag event
   */
  const handleDragLeave = (event) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.classList.remove('drag-over');
  };

  /**
   * Handle drop event
   * @param {Event} event - The drop event
   */
  const handleDrop = (event) => {
    if (disabled) return;

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.classList.remove('drag-over');

    const dataTransfer = event.dataTransfer;
    const items = dataTransfer.items || [];

    // Get the first file from dropped items
    for (let i = 0; i < items.length; i++) {
      if (items[i].kind === 'file') {
        const file = items[i].getAsFile();

        const validation = validateFile(file);
        if (!validation.valid) {
          setError(validation.error);
          setImage(null);
          setPreview(null);
          return;
        }

        handleFileRead(file);
        return;
      }
    }
  };

  /**
   * Handle upload button click
   */
  const handleUpload = async () => {
    if (!image || uploading) return;

    setUploading(true);

    try {
      // Call the onUpload callback with image and prompt
      await onUpload(image, prompt);

      // Clear state after successful upload
      setImage(null);
      setPreview(null);
      setPrompt('');
      setError('');

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      setError(`Upload failed: ${err.message || 'Unknown error'}`);
    } finally {
      setUploading(false);
    }
  };

  /**
   * Handle clear image button click
   */
  const handleClear = () => {
    setImage(null);
    setPreview(null);
    setPrompt('');
    setError('');

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  /**
   * Handle prompt input change
   * @param {Event} event - The change event
   */
  const handlePromptChange = (event) => {
    setPrompt(event.target.value);
  };

  return (
    <div
      className="vision-uploader"
      data-testid="vision-uploader"
      role="region"
      aria-label="Vision image uploader"
    >
      {/* Drag and Drop Zone */}
      <div
        className="drag-drop-zone"
        data-testid="drag-drop-zone"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label="Drag and drop image here or click to select"
      >
        {preview ? (
          <div className="preview-container">
            <img
              src={preview}
              alt="Selected image preview"
              className="image-preview"
              data-testid="image-preview"
            />
          </div>
        ) : (
          <div className="empty-state">
            <div className="upload-icon">📁</div>
            <p>Drag and drop an image here</p>
            <p className="or-text">or</p>
            <button
              type="button"
              className="select-button"
              onClick={() => !disabled && fileInputRef.current?.click()}
              disabled={disabled}
              aria-label="Select image from device"
            >
              Select Image
            </button>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileInputChange}
          disabled={disabled}
          data-testid="image-input"
          aria-label="Image file input"
          className="file-input"
        />
      </div>

      {/* Error Message */}
      {error && (
        <div
          className="error-message"
          role="alert"
          aria-live="polite"
        >
          {error}
        </div>
      )}

      {/* Status Message */}
      {!preview && !error && (
        <div className="status-message">
          Select an image to begin
        </div>
      )}

      {/* Prompt Input */}
      <div className="prompt-section">
        <label htmlFor="prompt-input" className="prompt-label">
          Optional Prompt (for vision analysis)
        </label>
        <textarea
          id="prompt-input"
          className="prompt-input"
          placeholder="Enter a prompt for the vision analysis (optional)"
          value={prompt}
          onChange={handlePromptChange}
          disabled={disabled || !preview}
          rows={3}
          aria-label="Vision analysis prompt"
        />
      </div>

      {/* Upload Status and Loading Indicator */}
      {uploading && (
        <div className="loading-section">
          <div className="loading-indicator" data-testid="loading-indicator">
            <div className="spinner"></div>
            <span>Uploading...</span>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="action-buttons">
        <button
          className="upload-button"
          onClick={handleUpload}
          disabled={!image || uploading || disabled}
          aria-label="Upload image for vision analysis"
          aria-busy={uploading}
        >
          {uploading ? 'Uploading...' : 'Upload for Analysis'}
        </button>

        {preview && (
          <button
            className="clear-button"
            onClick={handleClear}
            disabled={uploading || disabled}
            aria-label="Clear selected image"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
};

export default VisionUploader;
