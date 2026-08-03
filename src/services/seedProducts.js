/**
 * Seed script for products collection
 * Run this once to populate Firestore with initial product data
 */

import { db } from '../firebase.js';
import { collection, doc, setDoc, getDocs, query, limit } from 'firebase/firestore';

const PRODUCTS_COLLECTION = 'products';

const seedProducts = [
  // Cameras
  {
    id: 'gopro-hero13-black',
    brand: 'GoPro',
    name: 'HERO13 Black',
    category: 'recording',
    description: 'Latest GoPro action camera with advanced stabilization',
    searchTerms: ['gopro', 'hero13', 'hero13 black', 'gopro hero13', 'action camera'],
    thumbnailUrl: 'https://images.unsplash.com/photo-1595428774223-ef52624120d2?w=320&h=320&fit=crop',
    imageStatus: { status: 'ready' },
  },
  {
    id: 'dji-osmo-action-4',
    brand: 'DJI',
    name: 'Osmo Action 4',
    category: 'recording',
    description: 'Professional action camera with advanced features',
    searchTerms: ['dji', 'osmo', 'osmo action', 'action camera', 'dji osmo'],
    thumbnailUrl: 'https://images.unsplash.com/photo-1612198188060-c7c2a3b66eae?w=320&h=320&fit=crop',
    imageStatus: { status: 'ready' },
  },
  {
    id: 'insta360-x3',
    brand: 'Insta360',
    name: 'X3',
    category: 'recording',
    description: '360-degree action camera',
    searchTerms: ['insta360', 'x3', '360 camera', 'insta360 x3'],
    imageStatus: { status: 'ready' },
  },

  // Microphones
  {
    id: 'dji-mic-2',
    brand: 'DJI',
    name: 'Mic 2',
    category: 'audio',
    description: 'Wireless microphone system for content creators',
    searchTerms: ['dji', 'mic', 'microphone', 'wireless mic', 'dji mic 2'],
    thumbnailUrl: 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=320&h=320&fit=crop',
    imageStatus: { status: 'ready' },
  },
  {
    id: 'rode-wireless-go-ii',
    brand: 'Rode',
    name: 'Wireless GO II',
    category: 'audio',
    description: 'Ultra-compact wireless microphone system',
    searchTerms: ['rode', 'wireless', 'microphone', 'rode wireless', 'wireless go'],
    imageStatus: { status: 'ready' },
  },

  // Mounts & Accessories
  {
    id: 'gopro-chesty-mount',
    brand: 'GoPro',
    name: 'Chesty Mount',
    category: 'power_accessories',
    description: 'Chest mount for hands-free POV recording',
    searchTerms: ['gopro', 'mount', 'chest mount', 'chesty', 'pov mount'],
    imageStatus: { status: 'ready' },
  },
  {
    id: 'peak-design-capture-clip',
    brand: 'Peak Design',
    name: 'Capture Clip',
    category: 'power_accessories',
    description: 'Universal camera clip for any camera',
    searchTerms: ['peak design', 'capture', 'clip', 'mount'],
    imageStatus: { status: 'ready' },
  },

  // Activity Gear
  {
    id: 'canyon-bike',
    brand: 'Canyon',
    name: 'Grail 7',
    category: 'activity',
    description: 'High-performance gravel bike',
    searchTerms: ['canyon', 'bike', 'grail', 'gravel bike'],
    imageStatus: { status: 'ready' },
  },
  {
    id: 'trek-bike',
    brand: 'Trek',
    name: 'Domane SL 6',
    category: 'activity',
    description: 'Premium road bike',
    searchTerms: ['trek', 'bike', 'domane', 'road bike', 'cycling'],
    imageStatus: { status: 'ready' },
  },
  {
    id: 'specialized-bike',
    brand: 'Specialized',
    name: 'Tarmac SL8',
    category: 'activity',
    description: 'Lightweight racing bike',
    searchTerms: ['specialized', 'bike', 'tarmac', 'racing bike'],
    imageStatus: { status: 'ready' },
  },
  {
    id: 'poc-helmet',
    brand: 'POC',
    name: 'Omne Air',
    category: 'activity',
    description: 'Ventilated cycling helmet',
    searchTerms: ['poc', 'helmet', 'cycling helmet', 'safety gear'],
    imageStatus: { status: 'ready' },
  },
  {
    id: 'five-ten-shoes',
    brand: 'Five Ten',
    name: 'Freerider Pro',
    category: 'activity',
    description: 'Flat pedal mountain biking shoes',
    searchTerms: ['five ten', 'shoes', 'mtb', 'cycling shoes'],
    imageStatus: { status: 'ready' },
  },
  {
    id: 'fox-suspension',
    brand: 'Fox',
    name: '38 Fork',
    category: 'activity',
    description: 'Premium mountain bike suspension fork',
    searchTerms: ['fox', 'suspension', 'fork', 'mtb', 'mountain bike'],
    imageStatus: { status: 'ready' },
  },
];

/**
 * Check if products collection is empty
 */
export async function isProductsCollectionEmpty() {
  try {
    const q = query(collection(db, PRODUCTS_COLLECTION), limit(1));
    const snapshot = await getDocs(q);
    return snapshot.empty;
  } catch (error) {
    console.error('Error checking products collection:', error);
    return null;
  }
}

/**
 * Seed the products collection with initial data
 */
export async function seedProductsCollection() {
  try {
    console.log('[seedProducts] Starting seed...');

    // Check if already seeded
    const isEmpty = await isProductsCollectionEmpty();
    if (isEmpty === false) {
      console.log('[seedProducts] Collection already has products, skipping seed');
      return { success: true, message: 'Collection already populated', count: 0 };
    }

    if (isEmpty === null) {
      throw new Error('Could not check if collection is empty');
    }

    // Seed products
    const batchSize = 10;
    let count = 0;

    for (const product of seedProducts) {
      try {
        const docRef = doc(collection(db, PRODUCTS_COLLECTION), product.id);
        await setDoc(docRef, {
          ...product,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        count++;
        console.log(`[seedProducts] Added ${product.brand} ${product.name}`);
      } catch (error) {
        console.error(`[seedProducts] Error adding ${product.id}:`, error);
      }
    }

    console.log(`[seedProducts] Seeding complete! Added ${count} products`);
    return { success: true, message: 'Seed completed', count };
  } catch (error) {
    console.error('[seedProducts] Seeding failed:', error);
    return { success: false, error: error.message };
  }
}

// Export for manual execution
export default seedProductsCollection;
