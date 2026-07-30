/**
 * Image Processing Service
 * Handles image validation, downloading, and processing for product thumbnails
 * For backend cloud function - see functions/src/products/processProductImage.js
 *
 * Frontend responsibilities:
 * - Validate image URLs
 * - Download image data
 * - Trigger cloud function for heavy processing
 * - Monitor processing status
 */

/**
 * Allowed image domains for security
 */
const ALLOWED_DOMAINS = [
  'images.unsplash.com',
  'cdn.shopify.com',
  'images.pexels.com',
  'images.pixabay.com',
  // Add more trusted domains as needed
];

/**
 * Validate image URL
 * Checks protocol, domain (optional), and format
 * @param {string} url - Image URL to validate
 * @param {boolean} [checkDomain=false] - Whether to check against allowlist
 * @returns {Object} - { valid: boolean, error?: string }
 */
export function validateImageUrl(url, checkDomain = false) {
  if (!url || typeof url !== 'string') {
    return { valid: false, error: 'URL is required' };
  }

  try {
    const urlObj = new URL(url);

    // Check protocol
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return { valid: false, error: 'Only HTTP(S) protocols are allowed' };
    }

    // Check domain allowlist if enabled
    if (checkDomain && !ALLOWED_DOMAINS.some(domain => urlObj.hostname.endsWith(domain))) {
      return { valid: false, error: 'Domain not in allowlist' };
    }

    // Check if likely image format
    const path = urlObj.pathname.toLowerCase();
    const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const hasValidExtension = validExtensions.some(ext => path.endsWith(ext));

    // If no extension, accept it (query params might have the format)
    return { valid: true };
  } catch (error) {
    return { valid: false, error: 'Invalid URL format' };
  }
}

/**
 * Download image from URL with timeout and size limits
 * @param {string} url - Image URL
 * @param {number} [timeout=10000] - Timeout in milliseconds
 * @param {number} [maxSize=50000000] - Max size in bytes (50MB default)
 * @returns {Promise<Blob>}
 * @throws {Error}
 */
export async function downloadImage(url, timeout = 10000, maxSize = 50000000) {
  const validation = validateImageUrl(url);
  if (!validation.valid) {
    throw new Error(`Invalid image URL: ${validation.error}`);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Vuvio/1.0',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // Check content-length if available
    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > maxSize) {
      throw new Error(`Image too large: ${contentLength} bytes (max: ${maxSize})`);
    }

    const blob = await response.blob();

    // Check actual blob size
    if (blob.size > maxSize) {
      throw new Error(`Image too large: ${blob.size} bytes (max: ${maxSize})`);
    }

    return blob;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Validate image MIME type from blob
 * @param {Blob} blob - Image blob
 * @returns {Object} - { valid: boolean, mimeType: string, error?: string }
 */
export async function validateImageBlob(blob) {
  if (!blob) {
    return { valid: false, error: 'Blob is required' };
  }

  const validMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

  // Check MIME type from blob
  if (blob.type && !validMimeTypes.includes(blob.type)) {
    return { valid: false, mimeType: blob.type, error: 'Unsupported image format' };
  }

  // Try to validate by reading magic bytes
  try {
    const header = await blob.slice(0, 12).arrayBuffer();
    const bytes = new Uint8Array(header);

    // Magic byte detection
    const isPNG = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E;
    const isJPG = bytes[0] === 0xFF && bytes[1] === 0xD8;
    const isGIF = bytes[0] === 0x47 && bytes[1] === 0x49;
    const isWEBP = bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42;

    if (!isPNG && !isJPG && !isGIF && !isWEBP) {
      return { valid: false, mimeType: blob.type, error: 'Invalid image data' };
    }

    const detectedType = isPNG ? 'image/png' : isJPG ? 'image/jpeg' : isGIF ? 'image/gif' : 'image/webp';

    return { valid: true, mimeType: detectedType };
  } catch (error) {
    // If magic byte detection fails, trust the blob type
    return {
      valid: !!blob.type,
      mimeType: blob.type || 'unknown',
      error: blob.type ? undefined : 'Could not determine image type',
    };
  }
}

/**
 * Create thumbnail from image blob using canvas
 * Limited to frontend capabilities - generates lower quality thumbnails
 * For production quality, use cloud function
 * @param {Blob} blob - Image blob
 * @param {number} maxWidth - Maximum width in pixels
 * @param {number} maxHeight - Maximum height in pixels
 * @returns {Promise<Blob>}
 */
export async function generateThumbnailCanvas(blob, maxWidth = 320, maxHeight = 320) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      const img = new Image();

      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // Calculate dimensions maintaining aspect ratio
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        canvas.width = width;
        canvas.height = height;

        // Draw with anti-aliasing
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to blob
        canvas.toBlob(
          (thumbnailBlob) => {
            resolve(thumbnailBlob);
          },
          'image/webp',
          0.84
        );
      };

      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };

      img.src = event.target.result;
    };

    reader.onerror = () => {
      reject(new Error('Failed to read blob'));
    };

    reader.readAsDataURL(blob);
  });
}

/**
 * Get image dimensions from blob
 * @param {Blob} blob - Image blob
 * @returns {Promise<Object>} - { width, height }
 */
export async function getImageDimensions(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      const img = new Image();

      img.onload = () => {
        resolve({ width: img.width, height: img.height });
      };

      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };

      img.src = event.target.result;
    };

    reader.onerror = () => {
      reject(new Error('Failed to read blob'));
    };

    reader.readAsDataURL(blob);
  });
}

/**
 * Trigger image processing via cloud function
 * The actual thumbnail generation happens server-side
 * @param {string} productId
 * @param {string} imageUrl - URL of image to process
 * @returns {Promise<void>}
 */
export async function triggerImageProcessing(productId, imageUrl) {
  try {
    const response = await fetch('/api/products/process-image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        productId,
        imageUrl,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error triggering image processing:', error);
    throw error;
  }
}

/**
 * Monitor image processing status
 * Polls the product service to check if processing is complete
 * @param {string} productId
 * @param {number} maxAttempts - Maximum number of poll attempts
 * @param {number} interval - Interval between polls in milliseconds
 * @returns {Promise<Object>} - Product image status
 */
export async function monitorImageProcessing(productId, maxAttempts = 30, interval = 1000) {
  const { getProduct } = await import('./productService.js');

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const product = await getProduct(productId);

      if (!product || !product.imageStatus) {
        throw new Error('Product not found');
      }

      if (product.imageStatus.status === 'ready') {
        return product.imageStatus;
      }

      if (product.imageStatus.status === 'failed') {
        throw new Error(product.imageStatus.error || 'Image processing failed');
      }

      // Wait before next poll
      if (attempt < maxAttempts - 1) {
        await new Promise(resolve => setTimeout(resolve, interval));
      }
    } catch (error) {
      if (attempt === maxAttempts - 1) {
        throw error;
      }
      // Continue polling on error
      await new Promise(resolve => setTimeout(resolve, interval));
    }
  }

  throw new Error('Image processing timeout');
}

/**
 * Process image URL to product thumbnail URLs
 * Steps:
 * 1. Validate URL
 * 2. Download image
 * 3. Validate blob
 * 4. Get dimensions
 * 5. Trigger cloud function for processing
 * 6. Monitor status
 * @param {string} productId
 * @param {string} imageUrl
 * @returns {Promise<Object>} - Thumbnail URLs { small, medium, large }
 */
export async function processProductImage(productId, imageUrl) {
  // 1. Validate URL
  const urlValidation = validateImageUrl(imageUrl);
  if (!urlValidation.valid) {
    throw new Error(`Invalid image URL: ${urlValidation.error}`);
  }

  // 2. Download image
  const blob = await downloadImage(imageUrl);

  // 3. Validate blob
  const blobValidation = await validateImageBlob(blob);
  if (!blobValidation.valid) {
    throw new Error(`Invalid image blob: ${blobValidation.error}`);
  }

  // 4. Get dimensions
  const dimensions = await getImageDimensions(blob);
  console.log(`Image dimensions: ${dimensions.width}x${dimensions.height}`);

  // 5. Trigger cloud function
  await triggerImageProcessing(productId, imageUrl);

  // 6. Monitor status (wait for processing to complete)
  const result = await monitorImageProcessing(productId);

  return result.urls;
}
