import { AlertCircle, Loader } from 'lucide-react';
import { useState } from 'react';
import { getCategoryIcon } from '../../data/equipmentModel.js';
import './gear-thumbnail.css';

/**
 * Reusable gear thumbnail component
 * Displays product image with fallback to category icon
 */
export function GearThumbnail({
  imageUrl,
  category,
  displayName,
  size = 'md',
  selected = false,
  liveStatus = null,
  rounded = true,
  loading = false,
  error = false,
  onClick,
}) {
  const [imageLoading, setImageLoading] = useState(!!imageUrl && !loading);
  const [imageError, setImageError] = useState(false);

  const handleImageLoad = () => setImageLoading(false);
  const handleImageError = () => {
    setImageError(true);
    setImageLoading(false);
  };

  const sizeClass = `gear-thumbnail--${size}`;
  const containerClass = `gear-thumbnail ${sizeClass} ${selected ? 'is-selected' : ''} ${error || imageError ? 'has-error' : ''} ${rounded ? 'is-rounded' : ''}`;

  return (
    <button
      type="button"
      className={containerClass}
      onClick={onClick}
      aria-label={displayName}
      aria-pressed={selected}
      title={displayName}
    >
      <div className="gear-thumbnail__inner">
        {loading ? (
          <div className="gear-thumbnail__loader">
            <Loader size={size === 'sm' ? 12 : size === 'md' ? 16 : 20} className="gear-thumbnail__spinner" />
          </div>
        ) : imageUrl && !imageError && !error ? (
          <>
            {imageLoading && (
              <div className="gear-thumbnail__skeleton">
                <Loader size={size === 'sm' ? 12 : size === 'md' ? 16 : 20} className="gear-thumbnail__spinner" />
              </div>
            )}
            <img
              src={imageUrl}
              alt={displayName}
              className={`gear-thumbnail__image ${imageLoading ? 'is-loading' : ''}`}
              onLoad={handleImageLoad}
              onError={handleImageError}
            />
          </>
        ) : (
          <div className="gear-thumbnail__fallback">
            {error || imageError ? (
              <AlertCircle size={size === 'sm' ? 12 : size === 'md' ? 16 : 20} />
            ) : (
              <span style={{ fontSize: size === 'sm' ? '14px' : size === 'md' ? '18px' : '24px' }}>
                {getCategoryIcon(category)}
              </span>
            )}
          </div>
        )}

        {selected && <div className="gear-thumbnail__checkmark">✓</div>}
      </div>

      {liveStatus && <div className="gear-thumbnail__badge">{liveStatus}</div>}
    </button>
  );
}
