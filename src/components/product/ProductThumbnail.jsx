/**
 * Product Thumbnail Component
 * Wrapper around GearThumbnail that handles product-specific display logic
 * Manages image states: loading, ready, failed, pending
 * Shows skeleton while imageStatus="processing"
 */

import { useState, useEffect } from 'react';
import { AlertCircle, Loader } from 'lucide-react';
import { getCategoryIcon } from '../../data/equipmentModel.js';
import '../gear/gear-thumbnail.css';

/**
 * Product Thumbnail Component
 * @param {Object} props
 * @param {Object} props.product - Product data
 * @param {string} props.product.id
 * @param {string} props.product.name
 * @param {string} props.product.category
 * @param {Object} [props.product.imageStatus] - Image processing status
 * @param {string} [props.product.imageStatus.status] - pending|processing|ready|failed
 * @param {Object} [props.product.imageStatus.urls] - Thumbnail URLs
 * @param {string} [props.product.imageStatus.urls.medium] - 320px thumbnail
 * @param {string} [props.size='md'] - Thumbnail size: sm|md|lg
 * @param {boolean} [props.priority=false] - Preload image eagerly
 * @param {Function} [props.onError] - Error callback
 * @param {Function} [props.onClick] - Click handler
 * @param {boolean} [props.selected=false] - Selection state
 * @returns {JSX.Element}
 */
export function ProductThumbnail({
  product,
  size = 'md',
  priority = false,
  onError,
  onClick,
  selected = false,
}) {
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);

  if (!product) {
    return null;
  }

  const {
    id,
    name,
    category,
    imageStatus,
    thumbnailUrl,
    imageSource,
  } = product;

  // Determine image URL based on processing status
  const getImageUrl = () => {
    // If processing, show skeleton
    if (imageStatus?.status === 'processing') {
      return null;
    }

    // If failed, show fallback
    if (imageStatus?.status === 'failed') {
      return null;
    }

    // Processed image URL (from image processing pipeline)
    if (imageStatus?.status === 'ready' && imageStatus.urls?.medium) {
      return imageStatus.urls.medium;
    }

    // Fallback to simple thumbnailUrl field (for seeded products)
    if (thumbnailUrl) {
      return thumbnailUrl;
    }

    return null;
  };

  const imageUrl = getImageUrl();
  const isProcessing = imageStatus?.status === 'processing';
  const isFailed = imageStatus?.status === 'failed';

  const handleImageLoad = () => setImageLoading(false);

  const handleImageError = (error) => {
    setImageError(true);
    setImageLoading(false);
    onError?.(error);
  };

  const sizeClass = `gear-thumbnail--${size}`;
  const isPlaceholder = imageSource === 'placeholder';
  const containerClass = `gear-thumbnail ${sizeClass} ${selected ? 'is-selected' : ''} ${isFailed || imageError ? 'has-error' : ''} ${isPlaceholder ? 'is-placeholder' : ''} is-rounded`;

  return (
    <div className={`product-thumbnail`}>
      <div className={containerClass}>
        <div className="gear-thumbnail__inner">
          {isProcessing ? (
            <div className="gear-thumbnail__loader">
              <Loader size={size === 'sm' ? 12 : size === 'md' ? 16 : 20} className="gear-thumbnail__spinner" />
            </div>
          ) : imageUrl && !imageError && !isFailed ? (
            <>
              {imageLoading && (
                <div className="gear-thumbnail__skeleton">
                  <Loader size={size === 'sm' ? 12 : size === 'md' ? 16 : 20} className="gear-thumbnail__spinner" />
                </div>
              )}
              <img
                src={imageUrl}
                alt={name}
                className={`gear-thumbnail__image ${imageLoading ? 'is-loading' : ''}`}
                onLoad={handleImageLoad}
                onError={handleImageError}
              />
            </>
          ) : (
            <div className="gear-thumbnail__fallback">
              {isFailed || imageError ? (
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
      </div>

      {/* Status indicator */}
      {isProcessing && (
        <div className="product-thumbnail__status processing">
          <span className="text-xs text-gray-500">Processing...</span>
        </div>
      )}

      {isFailed && (
        <div className="product-thumbnail__status error">
          <span className="text-xs text-red-500">Failed</span>
        </div>
      )}
    </div>
  );
}

export default ProductThumbnail;
