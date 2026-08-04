import { Camera, Upload, X } from 'lucide-react';
import { useState, useRef } from 'react';
import { GearThumbnail } from './GearThumbnail.jsx';
import './gear-image-uploader.css';

/**
 * Component for uploading and managing gear images
 */
export function GearImageUploader({
  imageUrl,
  category,
  displayName,
  onImageChange,
  onRemoveImage,
  disabled = false,
  showLabel = true,
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileSelect = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be less than 5MB');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      // Convert image to base64 for now (localStorage)
      // Later: upload to Firebase Storage
      const reader = new FileReader();
      reader.onload = (e) => {
        const imageData = e.target?.result;
        onImageChange({
          imageUrl: imageData,
          imageSource: 'user_upload',
          imageStatus: 'confirmed',
        });
        setUploading(false);
      };
      reader.onerror = () => {
        setError('Failed to read image');
        setUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setError('Failed to process image');
      setUploading(false);
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemove = () => {
    onRemoveImage();
    setError(null);
  };

  const handleClick = () => {
    if (!disabled && !uploading) {
      fileInputRef.current?.click();
    }
  };

  return (
    <div className="gear-image-uploader">
      {showLabel && <label className="gear-image-uploader__label">Equipment Image</label>}

      <div className="gear-image-uploader__container">
        <div className="gear-image-uploader__preview">
          <GearThumbnail
            imageUrl={imageUrl}
            category={category}
            displayName={displayName}
            size="lg"
            loading={uploading}
            error={!!error}
          />
        </div>

        <div className="gear-image-uploader__actions">
          <button
            type="button"
            className="gear-image-uploader__upload-btn"
            onClick={handleClick}
            disabled={disabled || uploading}
            aria-label={imageUrl ? 'Change image' : 'Upload image'}
          >
            <Upload size={16} strokeWidth={1.8} />
            <span>{imageUrl ? 'Change' : 'Upload'}</span>
          </button>

          {imageUrl && (
            <button
              type="button"
              className="gear-image-uploader__remove-btn"
              onClick={handleRemove}
              disabled={disabled || uploading}
              aria-label="Remove image"
            >
              <X size={16} strokeWidth={1.8} />
              <span>Remove</span>
            </button>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="gear-image-uploader__input"
          onChange={handleFileSelect}
          disabled={disabled || uploading}
          aria-hidden="true"
        />
      </div>

      {error && <div className="gear-image-uploader__error">{error}</div>}

      <div className="gear-image-uploader__hint">
        <Camera size={12} strokeWidth={1.8} />
        <span>JPG, PNG or WebP • Max 5MB • Recommended: square 1:1 ratio</span>
      </div>
    </div>
  );
}
