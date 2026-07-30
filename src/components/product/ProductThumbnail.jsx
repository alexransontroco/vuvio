/**
 * Product Thumbnail Component
 * Wrapper around GearThumbnail that handles product-specific display logic
 * Manages image states: loading, ready, failed, pending
 * Shows skeleton while imageStatus="processing"
 */

import { useState, useEffect } from 'react';
import { AlertCircle, Loader } from 'lucide-react';
import { GearThumbnail } from '../gear/GearThumbnail.jsx';
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
  } = product;

  // Determine image URL based on processing status
  const getImageUrl = () => {
    // Processing status check
    if (!imageStatus) {
      return null; // No image data yet
    }

    if (imageStatus.status === 'ready' && imageStatus.urls?.medium) {
      return imageStatus.urls.medium;
    }

    if (imageStatus.status === 'pending' || imageStatus.status === 'processing') {
      return null; // Show skeleton
    }

    if (imageStatus.status === 'failed') {
      return null; // Show fallback icon
    }

    return null;
  };

  const imageUrl = getImageUrl();
  const isProcessing = imageStatus?.status === 'processing';
  const isFailed = imageStatus?.status === 'failed';

  const handleImageError = (error) => {
    setImageError(true);
    setImageLoading(false);
    onError?.(error);
  };

  return (
    <div
      className={`product-thumbnail ${isProcessing ? 'is-processing' : ''} ${
        isFailed ? 'is-error' : ''
      }`}
    >
      <GearThumbnail
        imageUrl={imageUrl}
        category={category}
        displayName={name}
        size={size}
        selected={selected}
        loading={isProcessing}
        error={isFailed || imageError}
        onClick={onClick}
      />

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
