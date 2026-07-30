/**
 * Cloud Function: Process Product Images
 * 
 * Triggered by:
 * - HTTP POST request: /processProductImage
 * - Firestore update: products/{productId} where imageStatus.status == 'processing'
 * 
 * Flow:
 * 1. Validate input and image URL
 * 2. Download image from source
 * 3. Validate MIME type
 * 4. Generate thumbnails (160px, 320px, 640px)
 * 5. Upload to Cloud Storage
 * 6. Update product document with image URLs
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const sharp = require('sharp');
const fetch = require('node-fetch');
const { v4: uuid } = require('uuid');

// Image processing constants
const SIZES = {
  thumbnail: { width: 160, height: 160 },
  preview: { width: 320, height: 320 },
  original: { width: 640, height: 640 },
};

const PADDING_RATIO = 0.12;
const WEBP_QUALITY = 84;
const MAX_IMAGE_SIZE = 50 * 1024 * 1024;
const IMAGE_TIMEOUT_MS = 30000;

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
const ALLOWED_DOMAINS = ['gopro.com', 'dji.com', 'insta360.com', 'rode.com', 'unsplash.com'];

const db = admin.firestore();
const storage = admin.storage();

/**
 * Validate image URL for security
 */
function validateImageUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') throw new Error('Only HTTPS allowed');
    
    // Optional: check domain
    // const isAllowed = ALLOWED_DOMAINS.some(d => parsed.hostname.includes(d));
    // if (!isAllowed) throw new Error('Domain not allowed');
    
    return { valid: true };
  } catch (err) {
    return { valid: false, error: err.message };
  }
}

/**
 * Download image from URL with validation
 */
async function downloadImage(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), IMAGE_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Vuvio/1.0 (Firebase)' },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const buffer = await response.buffer();
    if (buffer.length > MAX_IMAGE_SIZE) {
      throw new Error(`Image too large: ${buffer.length} bytes`);
    }

    return buffer;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Validate MIME type from buffer magic bytes
 */
function validateMimeType(buffer) {
  const view = new Uint8Array(buffer.slice(0, 12));

  if (view[0] === 0xff && view[1] === 0xd8 && view[2] === 0xff) return 'image/jpeg';
  if (view[0] === 0x89 && view[1] === 0x50 && view[2] === 0x4e && view[3] === 0x47) return 'image/png';
  if (view[0] === 0x52 && view[1] === 0x49 && view[2] === 0x46 && view[3] === 0x46) {
    if (view[8] === 0x57 && view[9] === 0x45 && view[10] === 0x42 && view[11] === 0x50) {
      return 'image/webp';
    }
  }

  return null;
}

/**
 * Process image: rotate, resize, pad, convert to WebP
 */
async function processImage(buffer, sizeKey) {
  const { width, height } = SIZES[sizeKey];
  const paddingPx = Math.round(width * PADDING_RATIO);
  const innerSize = width - paddingPx * 2;

  return sharp(buffer)
    .rotate() // Auto-rotate based on EXIF
    .resize(innerSize, innerSize, {
      fit: 'contain',
      withoutEnlargement: true,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .extend({
      top: paddingPx,
      bottom: paddingPx,
      left: paddingPx,
      right: paddingPx,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();
}

/**
 * Upload buffer to Cloud Storage
 */
async function uploadToStorage(productId, fileName, buffer) {
  const bucket = storage.bucket();
  const file = bucket.file(`products/${productId}/${fileName}`);

  await file.save(buffer, {
    metadata: {
      contentType: 'image/webp',
      cacheControl: 'public, max-age=31536000, immutable',
    },
  });

  const publicUrl = `https://storage.googleapis.com/${bucket.name}/products/${productId}/${fileName}`;
  return publicUrl;
}

/**
 * Main processing function
 */
async function processProductImage(productId, sourceImageUrl) {
  const startTime = Date.now();

  try {
    console.log(`[${productId}] Starting image processing...`);

    // 1. Validate URL
    const validation = validateImageUrl(sourceImageUrl);
    if (!validation.valid) {
      throw new Error(`Invalid URL: ${validation.error}`);
    }

    // 2. Download image
    console.log(`[${productId}] Downloading image...`);
    const imageBuffer = await downloadImage(sourceImageUrl);

    // 3. Validate MIME type
    const mimeType = validateMimeType(imageBuffer);
    if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
      throw new Error(`Unsupported image type: ${mimeType}`);
    }

    // 4. Process each size
    console.log(`[${productId}] Processing sizes...`);
    const processed = {};
    const urls = {};

    for (const [sizeKey] of Object.entries(SIZES)) {
      const processedBuffer = await processImage(imageBuffer, sizeKey);
      const fileName = `${sizeKey}-${Date.now()}.webp`;
      urls[sizeKey] = await uploadToStorage(productId, fileName, processedBuffer);
      console.log(`[${productId}] ${sizeKey}: ${urls[sizeKey]}`);
    }

    // 5. Update product document
    console.log(`[${productId}] Updating product...`);
    await db.collection('products').doc(productId).update({
      imageStatus: {
        status: 'ready',
        urls: {
          thumbnail: urls.thumbnail,
          preview: urls.preview,
          original: urls.original,
        },
      },
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const duration = Date.now() - startTime;
    console.log(`[${productId}] ✅ Complete in ${duration}ms`);

    return { success: true, productId, urls, duration };
  } catch (error) {
    console.error(`[${productId}] ❌ Error:`, error.message);

    // Mark as failed in Firestore
    try {
      await db.collection('products').doc(productId).update({
        imageStatus: {
          status: 'failed',
          error: error.message,
        },
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (updateErr) {
      console.error(`[${productId}] Failed to update error status:`, updateErr);
    }

    throw error;
  }
}

/**
 * HTTP Cloud Function
 */
exports.processProductImageHttp = functions.https.onRequest(async (req, res) => {
  const { productId, sourceImageUrl } = req.body;

  if (!productId || !sourceImageUrl) {
    return res.status(400).json({ error: 'productId and sourceImageUrl required' });
  }

  try {
    const result = await processProductImage(productId, sourceImageUrl);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Firestore-triggered Cloud Function
 * Listen for products where imageStatus.status == 'processing'
 */
exports.processProductImageFirestore = functions.firestore
  .document('products/{productId}')
  .onWrite(async (change, context) => {
    const productId = context.params.productId;
    const newData = change.after.data();

    if (!newData) return;

    // Only process if status is 'processing'
    if (newData.imageStatus?.status !== 'processing') {
      return;
    }

    const sourceImageUrl = newData.imageStatus.sourceUrl;
    if (!sourceImageUrl) {
      console.error(`[${productId}] No sourceUrl in imageStatus`);
      return;
    }

    try {
      await processProductImage(productId, sourceImageUrl);
    } catch (error) {
      console.error(`[${productId}] Processing failed:`, error);
    }
  });

module.exports = { processProductImage };
