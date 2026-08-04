/**
 * Seed script for products collection
 * Run this once to populate Firestore with initial product data
 */

import { db } from '../firebase.js';
import { collection, doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';

const PRODUCTS_COLLECTION = 'products';

function normalize(str) {
  return String(str ?? '').toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
}

const seedProducts = [
  // Cameras
  {
    id: 'gopro-hero13-black',
    brand: 'GoPro',
    name: 'HERO13 Black',
    normalizedName: 'hero13 black',
    category: 'recording',
    description: 'Latest GoPro action camera with advanced stabilization',
    searchTerms: ['gopro', 'hero13', 'hero13 black', 'gopro hero13', 'action camera'],
    thumbnailUrl: '/products/placeholders/camera-placeholder.svg',
    provider: 'demo',
    imageSource: 'placeholder',
    status: 'placeholder',
  },
  {
    id: 'dji-osmo-action-4',
    brand: 'DJI',
    name: 'Osmo Action 4',
    normalizedName: 'osmo action 4',
    category: 'recording',
    description: 'Professional action camera with advanced features',
    searchTerms: ['dji', 'osmo', 'osmo action', 'action camera', 'dji osmo'],
    thumbnailUrl: '/products/placeholders/camera-placeholder.svg',
    provider: 'demo',
    imageSource: 'placeholder',
    status: 'placeholder',
  },
  {
    id: 'insta360-x3',
    brand: 'Insta360',
    name: 'X3',
    normalizedName: 'x3',
    category: 'recording',
    description: '360-degree action camera',
    searchTerms: ['insta360', 'x3', '360 camera', 'insta360 x3'],
    thumbnailUrl: '/products/placeholders/camera-placeholder.svg',
    provider: 'demo',
    imageSource: 'placeholder',
    status: 'placeholder',
  },

  // Microphones
  {
    id: 'dji-mic-2',
    brand: 'DJI',
    name: 'Mic 2',
    normalizedName: 'mic 2',
    category: 'audio',
    description: 'Wireless microphone system for content creators',
    searchTerms: ['dji', 'mic', 'microphone', 'wireless mic', 'dji mic 2'],
    thumbnailUrl: '/products/placeholders/microphone-placeholder.svg',
    provider: 'demo',
    imageSource: 'placeholder',
    status: 'placeholder',
  },
  {
    id: 'rode-wireless-go-ii',
    brand: 'Rode',
    name: 'Wireless GO II',
    normalizedName: 'wireless go ii',
    category: 'audio',
    description: 'Ultra-compact wireless microphone system',
    searchTerms: ['rode', 'wireless', 'microphone', 'rode wireless', 'wireless go'],
    thumbnailUrl: '/products/placeholders/microphone-placeholder.svg',
    provider: 'demo',
    imageSource: 'placeholder',
    status: 'placeholder',
  },

  // Mounts & Accessories
  {
    id: 'gopro-chesty-mount',
    brand: 'GoPro',
    name: 'Chesty Mount',
    normalizedName: 'chesty mount',
    category: 'power_accessories',
    description: 'Chest mount for hands-free POV recording',
    searchTerms: ['gopro', 'mount', 'chest mount', 'chesty', 'pov mount'],
    thumbnailUrl: '/products/placeholders/accessory-placeholder.svg',
    provider: 'demo',
    imageSource: 'placeholder',
    status: 'placeholder',
  },
  {
    id: 'peak-design-capture-clip',
    brand: 'Peak Design',
    name: 'Capture Clip',
    normalizedName: 'capture clip',
    category: 'power_accessories',
    description: 'Universal camera clip for any camera',
    searchTerms: ['peak design', 'capture', 'clip', 'mount'],
    thumbnailUrl: '/products/placeholders/accessory-placeholder.svg',
    provider: 'demo',
    imageSource: 'placeholder',
    status: 'placeholder',
  },

  // Activity Gear
  {
    id: 'canyon-bike',
    brand: 'Canyon',
    name: 'Grail 7',
    normalizedName: 'grail 7',
    category: 'activity',
    description: 'High-performance gravel bike',
    searchTerms: ['canyon', 'bike', 'grail', 'gravel bike'],
    thumbnailUrl: '/products/placeholders/bike-placeholder.svg',
    provider: 'demo',
    imageSource: 'placeholder',
    status: 'placeholder',
  },
  {
    id: 'trek-bike',
    brand: 'Trek',
    name: 'Domane SL 6',
    normalizedName: 'domane sl 6',
    category: 'activity',
    description: 'Premium road bike',
    searchTerms: ['trek', 'bike', 'domane', 'road bike', 'cycling'],
    thumbnailUrl: '/products/placeholders/bike-placeholder.svg',
    provider: 'demo',
    imageSource: 'placeholder',
    status: 'placeholder',
  },
  {
    id: 'specialized-bike',
    brand: 'Specialized',
    name: 'Tarmac SL8',
    normalizedName: 'tarmac sl8',
    category: 'activity',
    description: 'Lightweight racing bike',
    searchTerms: ['specialized', 'bike', 'tarmac', 'racing bike'],
    thumbnailUrl: '/products/placeholders/bike-placeholder.svg',
    provider: 'demo',
    imageSource: 'placeholder',
    status: 'placeholder',
  },
  {
    id: 'poc-helmet',
    brand: 'POC',
    name: 'Omne Air',
    normalizedName: 'omne air',
    category: 'activity',
    description: 'Ventilated cycling helmet',
    searchTerms: ['poc', 'helmet', 'cycling helmet', 'safety gear'],
    thumbnailUrl: '/products/placeholders/activity-placeholder.svg',
    provider: 'demo',
    imageSource: 'placeholder',
    status: 'placeholder',
  },
  {
    id: 'five-ten-shoes',
    brand: 'Five Ten',
    name: 'Freerider Pro',
    normalizedName: 'freerider pro',
    category: 'activity',
    description: 'Flat pedal mountain biking shoes',
    searchTerms: ['five ten', 'shoes', 'mtb', 'cycling shoes'],
    thumbnailUrl: '/products/placeholders/activity-placeholder.svg',
    provider: 'demo',
    imageSource: 'placeholder',
    status: 'placeholder',
  },
  {
    id: 'fox-suspension',
    brand: 'Fox',
    name: '38 Fork',
    normalizedName: '38 fork',
    category: 'activity',
    description: 'Premium mountain bike suspension fork',
    searchTerms: ['fox', 'suspension', 'fork', 'mtb', 'mountain bike'],
    thumbnailUrl: '/products/placeholders/activity-placeholder.svg',
    provider: 'demo',
    imageSource: 'placeholder',
    status: 'placeholder',
  },
  {
    id: 'canyon-spectral-cf-8',
    brand: 'Canyon',
    name: 'Spectral CF 8',
    normalizedName: 'spectral cf 8',
    category: 'activity',
    description: 'Mountain bike placeholder product record',
    searchTerms: ['canyon', 'spectral', 'spectral cf 8', 'mountain bike'],
    thumbnailUrl: '/products/placeholders/bike-placeholder.svg',
    provider: 'demo',
    imageSource: 'placeholder',
    status: 'placeholder',
  },
  {
    id: 'poc-kortal-race-mips',
    brand: 'POC',
    name: 'Kortal Race MIPS',
    normalizedName: 'kortal race mips',
    category: 'activity',
    description: 'Helmet placeholder product record',
    searchTerms: ['poc', 'kortal', 'helmet', 'cycling helmet'],
    thumbnailUrl: '/products/placeholders/activity-placeholder.svg',
    provider: 'demo',
    imageSource: 'placeholder',
    status: 'placeholder',
  },
  {
    id: 'fender-american-professional-ii-stratocaster',
    brand: 'Fender',
    name: 'American Professional II Stratocaster',
    normalizedName: 'american professional ii stratocaster',
    category: 'activity',
    description: 'Electric guitar placeholder product record',
    searchTerms: ['fender', 'stratocaster', 'guitar', 'electric guitar'],
    thumbnailUrl: '/products/placeholders/activity-placeholder.svg',
    provider: 'demo',
    imageSource: 'placeholder',
    status: 'placeholder',
  },
  {
    id: 'marshall-dsl40cr',
    brand: 'Marshall',
    name: 'DSL40CR',
    normalizedName: 'dsl40cr',
    category: 'activity',
    description: 'Guitar amplifier placeholder product record',
    searchTerms: ['marshall', 'dsl40cr', 'amplifier', 'guitar amp'],
    thumbnailUrl: '/products/placeholders/activity-placeholder.svg',
    provider: 'demo',
    imageSource: 'placeholder',
    status: 'placeholder',
  },
  {
    id: 'boss-gt-1000',
    brand: 'Boss',
    name: 'GT-1000',
    normalizedName: 'gt 1000',
    category: 'activity',
    description: 'Effects pedal placeholder product record',
    searchTerms: ['boss', 'gt-1000', 'effects pedal', 'guitar pedal'],
    thumbnailUrl: '/products/placeholders/accessory-placeholder.svg',
    provider: 'demo',
    imageSource: 'placeholder',
    status: 'placeholder',
  },
  {
    id: 'pearl-masters-mct',
    brand: 'Pearl',
    name: 'Masters MCT',
    normalizedName: 'masters mct',
    category: 'activity',
    description: 'Drum kit placeholder product record',
    searchTerms: ['pearl', 'masters mct', 'drum kit', 'drums'],
    thumbnailUrl: '/products/placeholders/activity-placeholder.svg',
    provider: 'demo',
    imageSource: 'placeholder',
    status: 'placeholder',
  },
  {
    id: 'zildjian-a-custom-cymbal-pack',
    brand: 'Zildjian',
    name: 'A Custom Cymbal Pack',
    normalizedName: 'a custom cymbal pack',
    category: 'activity',
    description: 'Cymbal pack placeholder product record',
    searchTerms: ['zildjian', 'a custom', 'cymbal', 'drums'],
    thumbnailUrl: '/products/placeholders/activity-placeholder.svg',
    provider: 'demo',
    imageSource: 'placeholder',
    status: 'placeholder',
  },
  {
    id: 'vic-firth-5a-american-classic',
    brand: 'Vic Firth',
    name: '5A American Classic',
    normalizedName: '5a american classic',
    category: 'activity',
    description: 'Drumsticks placeholder product record',
    searchTerms: ['vic firth', '5a', 'drumsticks', 'drums'],
    thumbnailUrl: '/products/placeholders/accessory-placeholder.svg',
    provider: 'demo',
    imageSource: 'placeholder',
    status: 'placeholder',
  },
  {
    id: 'shure-sm57',
    brand: 'Shure',
    name: 'SM57',
    normalizedName: 'sm57',
    category: 'audio',
    description: 'Microphone placeholder product record',
    searchTerms: ['shure', 'sm57', 'microphone', 'instrument mic'],
    thumbnailUrl: '/products/placeholders/microphone-placeholder.svg',
    provider: 'demo',
    imageSource: 'placeholder',
    status: 'placeholder',
  },
  {
    id: 'yamaha-p-515',
    brand: 'Yamaha',
    name: 'P-515',
    normalizedName: 'p 515',
    category: 'activity',
    description: 'Digital piano placeholder product record',
    searchTerms: ['yamaha', 'p-515', 'piano', 'keyboard'],
    thumbnailUrl: '/products/placeholders/activity-placeholder.svg',
    provider: 'demo',
    imageSource: 'placeholder',
    status: 'placeholder',
  },
  {
    id: 'nord-triple-sustain-pedal',
    brand: 'Nord',
    name: 'Triple Sustain Pedal',
    normalizedName: 'triple sustain pedal',
    category: 'activity',
    description: 'Sustain pedal placeholder product record',
    searchTerms: ['nord', 'sustain pedal', 'piano pedal', 'keyboard'],
    thumbnailUrl: '/products/placeholders/accessory-placeholder.svg',
    provider: 'demo',
    imageSource: 'placeholder',
    status: 'placeholder',
  },
  {
    id: 'rode-nt5',
    brand: 'RØDE',
    name: 'NT5',
    normalizedName: 'nt5',
    category: 'audio',
    description: 'Microphone placeholder product record',
    searchTerms: ['rode', 'røde', 'nt5', 'microphone', 'piano mic'],
    thumbnailUrl: '/products/placeholders/microphone-placeholder.svg',
    provider: 'demo',
    imageSource: 'placeholder',
    status: 'placeholder',
  },
];

/**
 * Seed the products collection.
 * Idempotent per product: skips products that already exist.
 * Must be called explicitly — never runs automatically.
 */
export async function seedProductsCollection() {
  console.log('[seedProducts] Starting seed...');
  let created = 0;
  let skipped = 0;

  for (const product of seedProducts) {
    try {
      const { id, ...data } = product;
      const docRef = doc(db, PRODUCTS_COLLECTION, id);
      const existing = await getDoc(docRef);

      if (existing.exists()) {
        skipped++;
        continue;
      }

      await setDoc(docRef, {
        ...data,
        normalizedName: normalize(data.name),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      created++;
      console.log(`[seedProducts] Created ${product.brand} ${product.name}`);
    } catch (error) {
      console.error(`[seedProducts] Error on ${product.id}:`, error);
    }
  }

  console.log(`[seedProducts] Done — ${created} created, ${skipped} skipped`);
  return { success: true, created, skipped };
}

export default seedProductsCollection;
