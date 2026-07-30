/**
 * Process Product Image Cloud Function
 * Handles image download, validation, thumbnail generation, and storage upload
 *
 * Flow:
 * 1. Validate source image URL
 * 2. Download image
 * 3. Validate MIME type
 * 4. Store original for processing
 * 5. Generate thumbnails (160x160, 320x320, 640x640)
 * 6. Upload to Firebase Storage
 * 7. Update product document with image URLs
 *
 * Note: For production, consider using:
 * - Cloud Run for more processing power (can use sharp)
 * - Cloudinary or similar service for advanced image processing
 * - Image Optimization API for better thumbnail generation
 */

import type { Request, Response } from 'firebase-functions/v2/https';
import { ApiError } from '../shared/errors.js';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getStorage, Buffer } from 'firebase-admin/storage';
import fetch from 'node-fetch';

interface ProcessImageRequest {
  productId: string;
  imageUrl: string;
}

// Allowed image domains
const ALLOWED_DOMAINS = [
  'images.unsplash.com',
  'cdn.shopify.com',
  'images.pexels.com',
  'images.pixabay.com',
];

// Image size limits
const MAX_IMAGE_SIZE = 50 * 1024 * 1024; // 50MB
const REQUEST_TIMEOUT = 30000; // 30 seconds

/**
 * Validate image URL before processing
 */
function validateImageUrl(url: string): void {
  try {
    const urlObj = new URL(url);

    // Check protocol
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      throw new ApiError('bad_request', 'Only HTTP(S) protocols are allowed');
    }

    // Check domain allowlist
    if (!ALLOWED_DOMAINS.some(domain => urlObj.hostname.endsWith(domain))) {
      throw new ApiError('bad_request', 'Image domain not in allowlist');
    }
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError('bad_request', 'Invalid image URL');
  }
}

/**
 * Download image from URL with timeout and size limits
 */
async function downloadImage(url: string): Promise<Buffer> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
    const response = await fetch(url, {
      signal: controller.signal as any,
      headers: { 'User-Agent': 'Vuvio/1.0' },
    });

    if (!response.ok) {
      throw new ApiError('bad_request', `Failed to download image: HTTP ${response.status}`);
    }

    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > MAX_IMAGE_SIZE) {
      throw new ApiError('bad_request', `Image too large: ${contentLength} bytes`);
    }

    const buffer = await response.buffer() as Buffer;
    if (buffer.length > MAX_IMAGE_SIZE) {
      throw new ApiError('bad_request', `Image too large: ${buffer.length} bytes`);
    }

    return buffer;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ApiError('bad_request', 'Image download timeout');
    }
    throw new ApiError('server_error', 'Failed to download image');
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Validate image MIME type by checking magic bytes
 */
function validateImageMimeType(buffer: Buffer): string {
  if (buffer.length < 12) {
    throw new ApiError('bad_request', 'Invalid image data');
  }

  // Magic byte detection
  const isPNG = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e;
  const isJPG = buffer[0] === 0xff && buffer[1] === 0xd8;
  const isGIF = buffer[0] === 0x47 && buffer[1] === 0x49;
  const isWEBP = buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42;

  if (!isPNG && !isJPG && !isGIF && !isWEBP) {
    throw new ApiError('bad_request', 'Invalid image format');
  }

  return isPNG ? 'image/png' : isJPG ? 'image/jpeg' : isGIF ? 'image/gif' : 'image/webp';
}

/**
 * Generate thumbnail using a simple scaling approach
 * For production quality, use Cloud Run with sharp or external service
 * This is a placeholder implementation
 */
async function generateThumbnailPlaceholder(
  buffer: Buffer,
  _width: number,
  _height: number
): Promise<Buffer> {
  // NOTE: This is a placeholder that returns the original buffer
  // In production, you would:
  // 1. Use sharp in a Cloud Run function
  // 2. Use an external service like Cloudinary
  // 3. Use serverless image processing API

  // For now, we return the original buffer
  // The actual thumbnail generation happens on the client side
  return buffer;
}

/**
 * Upload image buffer to Firebase Storage
 */
async function uploadToStorage(
  bucket: any,
  filename: string,
  buffer: Buffer,
  contentType: string
): Promise<string> {
  const file = bucket.file(filename);

  await file.save(buffer, {
    metadata: {
      contentType,
      cacheControl: 'public, max-age=31536000', // 1 year
    },
  });

  // Make file publicly accessible
  await file.makePublic();

  return `https://storage.googleapis.com/${bucket.name}/${filename}`;
}

/**
 * Update product with image status and URLs
 */
async function updateProductImageStatus(
  productId: string,
  status: 'ready' | 'failed',
  urls?: Record<string, string>,
  error?: string
): Promise<void> {
  const db = getFirestore();
  const productRef = db.collection('products').doc(productId);

  const imageStatus: any = {
    status,
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (urls) {
    imageStatus.urls = urls;
  }

  if (error) {
    imageStatus.error = error;
  }

  await productRef.update({
    imageStatus,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

/**
 * Cloud Function: Process product image
 * HTTP endpoint for processing product images
 */
export async function processProductImage(req: Request, res: Response): Promise<void> {
  // Enable CORS
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  try {
    const body = req.body as ProcessImageRequest;

    if (!body.productId || !body.imageUrl) {
      throw new ApiError('bad_request', 'Missing productId or imageUrl');
    }

    const { productId, imageUrl } = body;

    // 1. Validate URL
    validateImageUrl(imageUrl);

    // Update status to processing
    await updateProductImageStatus(productId, 'failed', undefined, 'Processing started');

    // 2. Download image
    const imageBuffer = await downloadImage(imageUrl);

    // 3. Validate MIME type
    const mimeType = validateImageMimeType(imageBuffer);

    // 4. Get storage bucket
    const bucket = getStorage().bucket();
    const basePath = `products/${productId}`;

    // 5. Generate and upload thumbnails
    // NOTE: Using placeholder implementation
    // In production, implement actual thumbnail generation
    const sizes = [
      { name: 'small', width: 160, height: 160 },
      { name: 'medium', width: 320, height: 320 },
      { name: 'large', width: 640, height: 640 },
    ];

    const urls: Record<string, string> = {};

    for (const size of sizes) {
      // Generate thumbnail (placeholder returns original for now)
      const thumbnailBuffer = await generateThumbnailPlaceholder(
        imageBuffer,
        size.width,
        size.height
      );

      // Upload to storage
      const filename = `${basePath}/thumbnail-${size.width}.webp`;
      const url = await uploadToStorage(bucket, filename, thumbnailBuffer, 'image/webp');
      urls[size.name] = url;
    }

    // 6. Update product with ready status
    await updateProductImageStatus(productId, 'ready', urls);

    res.json({
      success: true,
      productId,
      imageStatus: {
        status: 'ready',
        urls,
      },
    });
  } catch (error) {
    console.error('Error processing product image:', error);

    if (error instanceof ApiError) {
      res.status(error.status).json({
        code: error.code,
        message: error.message,
      });

      // Update product with error status
      const body = req.body as ProcessImageRequest;
      if (body.productId) {
        await updateProductImageStatus(body.productId, 'failed', undefined, error.message).catch(
          err => console.error('Failed to update product error status:', err)
        );
      }
    } else {
      res.status(500).json({
        code: 'server_error',
        message: 'Internal server error',
      });
    }
  }
}
