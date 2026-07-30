/**
 * Product Data Model
 * Defines the structure for products/items that can be used to create thumbnails
 * and shared across Vuvio (equipment, merchandise, recommended products, etc.)
 *
 * @typedef {Object} Product
 * @property {string} id - Unique identifier
 * @property {string} brand - Brand/manufacturer name
 * @property {string} name - Product name
 * @property {string} category - Category ID (recording, audio, activity, streaming, power_accessories)
 * @property {string} [description] - Product description
 * @property {string} [productUrl] - Official product page URL
 * @property {string} [affiliateUrl] - Affiliate link for the product
 * @property {Array<string>} [images] - Array of image URLs
 * @property {Object} [imageStatus] - Processing status of primary image
 * @property {string} [imageStatus.status] - 'pending' | 'processing' | 'ready' | 'failed'
 * @property {Object} [imageStatus.urls] - Thumbnail URLs by size
 * @property {string} [imageStatus.urls.small] - 160px thumbnail
 * @property {string} [imageStatus.urls.medium] - 320px thumbnail
 * @property {string} [imageStatus.urls.large] - 640px thumbnail
 * @property {string} [imageStatus.error] - Error message if failed
 * @property {string} [imageStatus.sourceUrl] - Original image URL being processed
 * @property {number} createdAt - Creation timestamp
 * @property {number} updatedAt - Last update timestamp
 */

/**
 * Product categories - aligned with EQUIPMENT_CATEGORIES
 */
export const PRODUCT_CATEGORIES = [
  {
    id: 'recording',
    label: 'Recording',
    description: 'Cameras, lenses, mounts and recording accessories',
  },
  {
    id: 'audio',
    label: 'Audio',
    description: 'Microphones, headphones and audio gear',
  },
  {
    id: 'activity',
    label: 'Activity Gear',
    description: 'Vehicles, tools, clothing and activity equipment',
  },
  {
    id: 'streaming',
    label: 'Streaming Setup',
    description: 'Streaming apps, encoders and connectivity gear',
  },
  {
    id: 'power_accessories',
    label: 'Power & Accessories',
    description: 'Batteries, mounts and other accessories',
  },
];

/**
 * Demo products collection
 * These can be used as fallback data before Firestore is available
 * or for development/testing
 */
export const demoProducts = [
  // Recording - Cameras
  {
    id: 'gopro-hero13-black',
    brand: 'GoPro',
    name: 'HERO13 Black',
    category: 'recording',
    description: 'Latest GoPro action camera with advanced stabilization',
    productUrl: 'https://gopro.com/en/us/shop/hero13-black',
    images: [
      'https://images.unsplash.com/photo-1595428774223-ef52624120d2?w=500&h=500&fit=crop',
    ],
    imageStatus: {
      status: 'pending',
      sourceUrl: 'https://images.unsplash.com/photo-1595428774223-ef52624120d2?w=500&h=500&fit=crop',
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'dji-osmo-action-4',
    brand: 'DJI',
    name: 'Osmo Action 4',
    category: 'recording',
    description: 'Professional action camera with advanced features',
    productUrl: 'https://www.dji.com/osmo-action/4',
    images: [
      'https://images.unsplash.com/photo-1612198188060-c7c2a3b66eae?w=500&h=500&fit=crop',
    ],
    imageStatus: {
      status: 'pending',
      sourceUrl: 'https://images.unsplash.com/photo-1612198188060-c7c2a3b66eae?w=500&h=500&fit=crop',
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },

  // Recording - Mounts
  {
    id: 'gopro-chesty-mount',
    brand: 'GoPro',
    name: 'Chesty Mount',
    category: 'recording',
    description: 'Chest mount for hands-free POV recording',
    productUrl: 'https://gopro.com/en/us/shop/mounts-accessories',
    imageStatus: {
      status: 'pending',
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'peak-design-capture-clip',
    brand: 'Peak Design',
    name: 'Capture Clip',
    category: 'recording',
    description: 'Universal camera clip for any camera',
    productUrl: 'https://www.peakdesign.com/products/capture-clip',
    imageStatus: {
      status: 'pending',
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },

  // Audio - Microphones
  {
    id: 'dji-mic-2',
    brand: 'DJI',
    name: 'Mic 2',
    category: 'audio',
    description: 'Wireless microphone system for content creators',
    productUrl: 'https://www.dji.com/mic',
    affiliateUrl: 'https://example.com/dji-mic-2',
    images: [
      'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=500&h=500&fit=crop',
    ],
    imageStatus: {
      status: 'pending',
      sourceUrl: 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=500&h=500&fit=crop',
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'rode-videomicro',
    brand: 'RODE',
    name: 'VideoMicro',
    category: 'audio',
    description: 'Compact on-camera microphone',
    productUrl: 'https://rode.com/en/microphones/on-camera/videomicro',
    images: [
      'https://images.unsplash.com/photo-1615127398623-88f5fad8e3cb?w=500&h=500&fit=crop',
    ],
    imageStatus: {
      status: 'pending',
      sourceUrl: 'https://images.unsplash.com/photo-1615127398623-88f5fad8e3cb?w=500&h=500&fit=crop',
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'rode-wireless-go-ii',
    brand: 'RODE',
    name: 'Wireless GO II',
    category: 'audio',
    description: 'Professional wireless microphone system',
    productUrl: 'https://rode.com/en/microphones/wireless/wireless-go',
    imageStatus: {
      status: 'pending',
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },

  // Activity Gear - Bikes
  {
    id: 'canyon-spectral-cf8',
    brand: 'Canyon',
    name: 'Spectral CF 8',
    category: 'activity',
    description: 'Full-suspension mountain bike',
    productUrl: 'https://www.canyon.com/en-us/mtb/spectral/',
    imageStatus: {
      status: 'pending',
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'specialized-s-works-epic',
    brand: 'Specialized',
    name: 'S-Works Epic',
    category: 'activity',
    description: 'High-performance cross-country mountain bike',
    productUrl: 'https://www.specialized.com/us/en/s-works-epic',
    imageStatus: {
      status: 'pending',
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },

  // Activity Gear - Protective
  {
    id: 'poc-kortal-race',
    brand: 'POC',
    name: 'Kortal Race MIPS',
    category: 'activity',
    description: 'Lightweight cycling helmet with MIPS',
    productUrl: 'https://www.pocsports.com/en/kortal-race-mips',
    affiliateUrl: 'https://example.com/poc-kortal',
    imageStatus: {
      status: 'pending',
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },

  // Streaming Setup
  {
    id: 'liveu-solo',
    brand: 'LiveU',
    name: 'Solo',
    category: 'streaming',
    description: 'Portable live streaming encoder',
    productUrl: 'https://www.liveu.tv/products/liveu-solo/',
    imageStatus: {
      status: 'pending',
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'teradek-bonito',
    brand: 'Teradek',
    name: 'Bolt LT',
    category: 'streaming',
    description: 'Wireless video transmission system',
    productUrl: 'https://www.teradek.com/products/bolt-lt',
    imageStatus: {
      status: 'pending',
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },

  // Power & Accessories - Batteries
  {
    id: 'anker-powerbank-26800',
    brand: 'Anker',
    name: 'Power Bank 26800mAh',
    category: 'power_accessories',
    description: 'High-capacity portable power bank',
    productUrl: 'https://www.anker.com/products/a1223',
    imageStatus: {
      status: 'pending',
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'sandisk-extreme-pro-256gb',
    brand: 'SanDisk',
    name: 'Extreme Pro 256GB',
    category: 'power_accessories',
    description: 'Fast UHS-II SDXC memory card',
    productUrl: 'https://www.sandisk.com/products/memory-cards/sd-cards/extreme-pro-sd-uhs-ii',
    imageStatus: {
      status: 'pending',
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'gopro-battery',
    brand: 'GoPro',
    name: 'HERO13 Rechargeable Battery',
    category: 'power_accessories',
    description: 'Official GoPro rechargeable battery',
    productUrl: 'https://gopro.com/en/us/shop/hero13-battery',
    imageStatus: {
      status: 'pending',
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
];

/**
 * Get product category by ID
 * @param {string} categoryId
 * @returns {Object|null}
 */
export function getProductCategory(categoryId) {
  return PRODUCT_CATEGORIES.find(cat => cat.id === categoryId) || null;
}

/**
 * Get demo product by ID
 * @param {string} productId
 * @returns {Object|null}
 */
export function getDemoProduct(productId) {
  return demoProducts.find(p => p.id === productId) || null;
}

/**
 * Get all demo products by category
 * @param {string} categoryId
 * @returns {Array}
 */
export function getDemoProductsByCategory(categoryId) {
  return demoProducts.filter(p => p.category === categoryId);
}
