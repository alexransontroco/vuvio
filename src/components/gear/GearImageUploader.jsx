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

  const compressImage = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const MAX = 640;
          let w = img.width;
          let h = img.height;
          if (w > h) {
            if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; }
          } else {
            if (h > MAX) { w = Math.round(w * MAX / h); h = MAX; }
          }
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', 0.75));
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleFileSelect = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      setError('Image must be less than 20MB');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const compressed = await compressImage(file);
      onImageChange({
        imageUrl: compressed,
        imageSource: 'user_upload',
        imageStatus: 'confirmed',
      });
    } catch {
      setError('Failed to process image');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
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
