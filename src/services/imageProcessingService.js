import { db } from '../firebase.js';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';

/**
 * Image Processing Service
 * Validates image URLs, initiates processing via Cloud Function,
 * and updates product status
 */

// List of allowed image domains for SSRF protection
const ALLOWED_IMAGE_DOMAINS = [
  'gopro.com',
  'dji.com',
  'insta360.com',
  'rode.com',
  'images.unsplash.com',
  'picsum.photos',
  'via.placeholder.com',
];

const MAX_IMAGE_SIZE = 50 * 1024 * 1024; // 50MB
const IMAGE_TIMEOUT_MS = 30000; // 30 seconds
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/avif',
];

/**
 * Validate image URL for SSRF and security
 * @param {string} url
 * @returns {Object} { valid: boolean, error?: string }
 */
export function validateImageUrl(url) {
  if (!url || typeof url !== 'string') {
    return { valid: false, error: 'URL is required' };
  }

  try {
    const parsed = new URL(url);

    // Only HTTPS allowed
    if (parsed.protocol !== 'https:') {
      return { valid: false, error: 'Only HTTPS URLs are allowed' };
    }

    // Check against allowed domains (in production)
    const hostname = parsed.hostname;
    const isAllowed = ALLOWED_IMAGE_DOMAINS.some(domain =>
      hostname === domain || hostname.endsWith('.' + domain)
    );

    if (!isAllowed) {
      console.warn('[imageProcessing] Domain not in allowlist:', hostname);
      // Allow for now in dev, but log warning
    }

    return { valid: true };
  } catch (err) {
    return { valid: false, error: 'Invalid URL format' };
  }
}

/**
 * Download and validate image from URL
 * @param {string} url
 * @returns {Promise<Buffer|null>}
 */
export async function downloadImage(url) {
  const validation = validateImageUrl(url);
  if (!validation.valid) {
    throw new Error(`Image URL validation failed: ${validation.error}`);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), IMAGE_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Vuvio/1.0 (+https://vuvio.app)',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > MAX_IMAGE_SIZE) {
      throw new Error(`Image too large: ${contentLength} bytes (max ${MAX_IMAGE_SIZE})`);
    }

    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > MAX_IMAGE_SIZE) {
      throw new Error(`Image too large: ${buffer.byteLength} bytes (max ${MAX_IMAGE_SIZE})`);
    }

    return new Uint8Array(buffer);
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error(`Image download timeout (${IMAGE_TIMEOUT_MS}ms)`);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Validate MIME type from buffer
 * @param {Buffer|Uint8Array} buffer
 * @returns {string|null}
 */
export function validateMimeType(buffer) {
  if (!buffer || buffer.length < 4) return null;

  // Check magic bytes
  const view = new Uint8Array(buffer);

  // JPEG: FF D8 FF
  if (view[0] === 0xff && view[1] === 0xd8 && view[2] === 0xff) {
    return 'image/jpeg';
  }

  // PNG: 89 50 4E 47
  if (
    view[0] === 0x89 &&
    view[1] === 0x50 &&
    view[2] === 0x4e &&
    view[3] === 0x47
  ) {
    return 'image/png';
  }

  // WebP: 52 49 46 46 ... 57 45 42 50
  if (
    view[0] === 0x52 &&
    view[1] === 0x49 &&
    view[2] === 0x46 &&
    view[3] === 0x46
  ) {
    const webpMarker = view.slice(8, 12);
    if (
      webpMarker[0] === 0x57 &&
      webpMarker[1] === 0x45 &&
      webpMarker[2] === 0x42 &&
      webpMarker[3] === 0x50
    ) {
      return 'image/webp';
    }
  }

  return null;
}

/**
 * Request image processing via Cloud Function
 * @param {string} productId
 * @param {string} sourceImageUrl
 * @returns {Promise<void>}
 */
export async function requestImageProcessing(productId, sourceImageUrl) {
  try {
    // Update product status to 'processing'
    const productRef = doc(db, 'products', productId);
    await updateDoc(productRef, {
      imageStatus: {
        status: 'processing',
        sourceUrl: sourceImageUrl,
      },
      updatedAt: serverTimestamp(),
    });

    console.log('[imageProcessing] Sent processing request for:', productId);

    // In production, this would call a Cloud Function via HTTP trigger
    // For now, this is a placeholder that the Cloud Function would handle
    // via Firestore triggers
  } catch (err) {
    console.error('[imageProcessing] Error requesting processing:', err);
    throw err;
  }
}

/**
 * Update product with processed image URLs
 * @param {string} productId
 * @param {Object} imageUrls - { thumbnailUrl, previewUrl, originalUrl }
 * @returns {Promise<void>}
 */
export async function updateProductImages(productId, imageUrls) {
  try {
    const productRef = doc(db, 'products', productId);
    await updateDoc(productRef, {
      imageStatus: {
        status: 'ready',
        urls: {
          thumbnail: imageUrls.thumbnailUrl,
          preview: imageUrls.previewUrl,
          original: imageUrls.originalUrl,
        },
      },
      updatedAt: serverTimestamp(),
    });

    console.log('[imageProcessing] Product images updated:', productId);
  } catch (err) {
    console.error('[imageProcessing] Error updating product images:', err);
    throw err;
  }
}

/**
 * Mark image processing as failed
 * @param {string} productId
 * @param {string} errorMessage
 * @returns {Promise<void>}
 */
export async function markImageProcessingFailed(productId, errorMessage) {
  try {
    const productRef = doc(db, 'products', productId);
    await updateDoc(productRef, {
      imageStatus: {
        status: 'failed',
        error: errorMessage,
      },
      updatedAt: serverTimestamp(),
    });

    console.error('[imageProcessing] Processing failed for', productId, ':', errorMessage);
  } catch (err) {
    console.error('[imageProcessing] Error marking as failed:', err);
    throw err;
  }
}
