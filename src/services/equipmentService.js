import { db } from '../firebase.js';
import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { demoEquipmentItems, demoLiveEquipmentIds, EQUIPMENT_CATEGORIES, EQUIPMENT_PRODUCT_ID_MAP } from '../data/equipmentModel.js';
import { resolveEquipmentProduct, getProductThumbnailUrl } from './productService.js';

const EQUIPMENT_KEY = 'vuvio:equipment-library';
const LIVE_SETUP_KEY = 'vuvio:last-live-equipment';
const LIVE_SUBCATEGORY_KEY = 'vuvio:last-live-equipment-subcategory';
const EQUIPMENT_EVENT = 'vuvio:equipment-updated';
const CREATOR_EQUIPMENT_COLLECTION = 'creatorEquipment';

// Current authenticated user ID — set by initEquipmentService()
let _currentUserId = null;

function safeWindow() {
  return typeof window !== 'undefined' ? window : null;
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeLegacyEquipment(item) {
  if (!item) return null;
  const productId = item.productId || EQUIPMENT_PRODUCT_ID_MAP[item.id] || item.id;
  if (item.brand && item.model && item.category && EQUIPMENT_CATEGORIES.some((category) => category.id === item.category)) {
    return {
      userId: 'current-user',
      productId,
      ownership: 'owned',
      isPublic: true,
      isDefault: false,
      imageUrl: item.imageUrl || null,
      imageSource: item.imageSource || 'placeholder',
      imageStatus: item.imageStatus || 'placeholder',
      provider: item.provider || 'demo',
      status: item.status || 'placeholder',
      createdAt: nowIso(),
      updatedAt: nowIso(),
      ...item,
      productId,
    };
  }

  return {
    id: item.id ?? `equipment-${Date.now()}`,
    userId: 'current-user',
    productId,
    category: item.category === 'Camera' ? 'recording' : item.category === 'Mixer' ? 'activity' : item.category === 'Oven' ? 'activity' : 'activity',
    brand: item.brand ?? String(item.name ?? '').split(' ')[0] ?? 'Gear',
    model: item.model ?? item.name ?? 'Equipment',
    displayName: item.displayName ?? `${item.brand ?? 'Gear'} ${item.model ?? 'Equipment'}`,
    equipmentType: item.category ?? 'Equipment',
    ownership: 'owned',
    isPublic: true,
    isDefault: false,
    notes: item.note ?? '',
    imageUrl: item.imageUrl || null,
    imageSource: item.imageSource || 'placeholder',
    imageStatus: item.imageStatus || 'placeholder',
    provider: item.provider || 'demo',
    status: item.status || 'placeholder',
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
}

export function normalizeEquipmentItem(item) {
  return normalizeLegacyEquipment(item);
}

// ── Firestore helpers ─────────────────────────────────────────────────────────

function toFirestoreDoc(item, userId) {
  const { id, userId: _uid, ...rest } = item;
  return {
    ...rest,
    creatorId: userId,
    updatedAt: serverTimestamp(),
  };
}

async function loadFromFirestore(userId) {
  try {
    const q = query(
      collection(db, CREATOR_EQUIPMENT_COLLECTION),
      where('creatorId', '==', userId),
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.warn('[equipmentService] Firestore load failed:', err.message);
    return null;
  }
}

async function writeToFirestore(item, userId) {
  try {
    const docRef = doc(db, CREATOR_EQUIPMENT_COLLECTION, item.id);
    await setDoc(docRef, toFirestoreDoc(item, userId), { merge: true });
  } catch (err) {
    console.warn('[equipmentService] Firestore write failed:', err.message);
  }
}

async function deleteFromFirestore(id) {
  try {
    await deleteDoc(doc(db, CREATOR_EQUIPMENT_COLLECTION, id));
  } catch (err) {
    console.warn('[equipmentService] Firestore delete failed:', err.message);
  }
}

// ── Init — call on auth state change ─────────────────────────────────────────

/**
 * Initialize equipment service for an authenticated user.
 * Loads their equipment from Firestore into localStorage, then migrates
 * any existing localStorage items not yet in Firestore.
 */
export async function initEquipmentService(userId) {
  _currentUserId = userId;
  if (!userId) return;

  const remoteItems = await loadFromFirestore(userId);
  if (remoteItems === null) return; // Firestore unavailable, keep localStorage

  const win = safeWindow();
  if (!win) return;

  // Merge: remote is source of truth, local items without remote counterpart get migrated up
  const remoteIds = new Set(remoteItems.map((i) => i.id));
  let localItems = [];
  try {
    localItems = JSON.parse(win.localStorage.getItem(EQUIPMENT_KEY) ?? '[]');
  } catch { /* */ }

  const localOnly = localItems.filter((i) => i && i.id && !remoteIds.has(i.id));

  // Migrate local-only items to Firestore
  for (const item of localOnly) {
    const normalized = normalizeLegacyEquipment(item);
    if (normalized) {
      await writeToFirestore(normalized, userId);
    }
  }

  // Write merged set to localStorage as cache
  const merged = [
    ...remoteItems.map(normalizeLegacyEquipment).filter(Boolean),
    ...localOnly.map(normalizeLegacyEquipment).filter(Boolean),
  ];
  win.localStorage.setItem(EQUIPMENT_KEY, JSON.stringify(merged));
  win.dispatchEvent(new CustomEvent(EQUIPMENT_EVENT, { detail: merged }));
}

/**
 * Call when user signs out.
 */
export function resetEquipmentService() {
  _currentUserId = null;
}

// ── Core CRUD ─────────────────────────────────────────────────────────────────

export function getEquipmentLibrary(seedItems = demoEquipmentItems) {
  const win = safeWindow();
  if (!win) return seedItems.map(normalizeEquipmentItem).filter(Boolean);

  try {
    const stored = JSON.parse(win.localStorage.getItem(EQUIPMENT_KEY) ?? 'null');
    if (Array.isArray(stored)) {
      const storedIds = new Set(stored.map((i) => i.id));
      const newSeeds = seedItems.filter((i) => !storedIds.has(i.id)).map(normalizeEquipmentItem).filter(Boolean);
      if (newSeeds.length) {
        const merged = [...stored.map(normalizeEquipmentItem).filter(Boolean), ...newSeeds];
        win.localStorage.setItem(EQUIPMENT_KEY, JSON.stringify(merged));
        return merged;
      }
      return stored.map(normalizeEquipmentItem).filter(Boolean);
    }
  } catch {
    // Fall through to seed data.
  }

  const seeded = seedItems.map(normalizeEquipmentItem).filter(Boolean);
  win.localStorage.setItem(EQUIPMENT_KEY, JSON.stringify(seeded));
  return seeded;
}

function mergeEquipmentProduct(item, product) {
  if (!item || !product) return item;
  const thumbnailUrl = getProductThumbnailUrl(product, 'medium') || product.thumbnailUrl || null;
  return {
    ...item,
    product,
    productId: item.productId || product.id,
    brand: item.brand || product.brand,
    model: item.model || product.name,
    productUrl: item.productUrl || product.productUrl || '',
    affiliateUrl: item.affiliateUrl || product.affiliateUrl || '',
    thumbnailUrl,
    imageUrl: item.imageUrl || thumbnailUrl,
    imageSource: item.imageSource || product.imageSource || 'placeholder',
    imageStatus: item.imageStatus || product.status || 'placeholder',
    provider: item.provider || product.provider || 'demo',
    status: item.status || product.status || 'placeholder',
  };
}

export async function enrichEquipmentWithProducts(items, options = {}) {
  const normalized = items.map(normalizeEquipmentItem).filter(Boolean);
  const enriched = await Promise.all(normalized.map(async (item) => {
    const product = await resolveEquipmentProduct(item.productId, options);
    return mergeEquipmentProduct(item, product);
  }));
  return enriched;
}

export async function getEquipmentLibraryWithProducts(seedItems = demoEquipmentItems, options = {}) {
  return enrichEquipmentWithProducts(getEquipmentLibrary(seedItems), options);
}

export function saveEquipmentLibrary(items) {
  const normalized = items.map(normalizeEquipmentItem).filter(Boolean);
  const win = safeWindow();
  if (win) {
    win.localStorage.setItem(EQUIPMENT_KEY, JSON.stringify(normalized));
    win.dispatchEvent(new CustomEvent(EQUIPMENT_EVENT, { detail: normalized }));
  }
  return normalized;
}

export function subscribeToEquipment(callback) {
  const win = safeWindow();
  if (!win) return () => {};
  const listener = (event) => callback(event.detail ?? getEquipmentLibrary());
  win.addEventListener(EQUIPMENT_EVENT, listener);
  return () => win.removeEventListener(EQUIPMENT_EVENT, listener);
}

export function addEquipmentItem(input) {
  const item = normalizeEquipmentItem({
    id: `equipment-${Date.now()}`,
    userId: 'current-user',
    ownership: 'owned',
    isPublic: true,
    isDefault: false,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    provider: input.provider || (input.productId ? 'user' : 'demo'),
    imageSource: input.imageSource || (input.productId ? 'product-catalog' : 'placeholder'),
    status: input.status || (input.productId ? 'active' : 'placeholder'),
    ...input,
  });
  const saved = saveEquipmentLibrary([item, ...getEquipmentLibrary()])[0];
  if (_currentUserId) writeToFirestore(item, _currentUserId);
  return saved;
}

export function updateEquipmentItem(id, patch) {
  let updatedItem = null;
  const next = getEquipmentLibrary().map((item) => {
    if (item.id !== id) return item;
    updatedItem = normalizeEquipmentItem({ ...item, ...patch, updatedAt: nowIso() });
    return updatedItem;
  });
  saveEquipmentLibrary(next);
  if (_currentUserId && updatedItem) writeToFirestore(updatedItem, _currentUserId);
  return updatedItem;
}

export function removeEquipmentItem(id) {
  const result = saveEquipmentLibrary(getEquipmentLibrary().filter((item) => item.id !== id));
  if (_currentUserId) deleteFromFirestore(id);
  return result;
}

// ── Utilities ─────────────────────────────────────────────────────────────────

export function groupEquipmentByCategory(items) {
  return EQUIPMENT_CATEGORIES.map((category) => ({
    ...category,
    items: items.filter((item) => item.category === category.id),
  }));
}

export function equipmentLabel(item) {
  return [item.brand, item.model].filter(Boolean).join(' ');
}

export function getDefaultEquipmentIds(items = getEquipmentLibrary()) {
  const defaults = items.filter((item) => item.isDefault).map((item) => item.id);
  return defaults.length ? defaults : demoLiveEquipmentIds.filter((id) => items.some((item) => item.id === id));
}

export function getLastLiveEquipmentIds(family = 'default') {
  const win = safeWindow();
  if (!win) return [];
  try {
    const stored = JSON.parse(win.localStorage.getItem(LIVE_SETUP_KEY) ?? '{}');
    return stored[family] ?? stored.default ?? [];
  } catch {
    return [];
  }
}

export function rememberLiveEquipmentSetup(family, ids) {
  const win = safeWindow();
  if (!win) return;
  let stored = {};
  try {
    stored = JSON.parse(win.localStorage.getItem(LIVE_SETUP_KEY) ?? '{}');
  } catch {
    stored = {};
  }
  const next = { ...stored, default: ids, [family || 'default']: ids };
  win.localStorage.setItem(LIVE_SETUP_KEY, JSON.stringify(next));
}

export function getLastLiveEquipmentIdsBySubcategory(subcategory) {
  const win = safeWindow();
  if (!win || !subcategory) return [];
  try {
    const stored = JSON.parse(win.localStorage.getItem(LIVE_SUBCATEGORY_KEY) ?? '{}');
    return stored[subcategory.toLowerCase()] ?? [];
  } catch {
    return [];
  }
}

export function rememberLiveEquipmentSetupBySubcategory(subcategory, ids) {
  if (!subcategory) return;
  const win = safeWindow();
  if (!win) return;
  let stored = {};
  try { stored = JSON.parse(win.localStorage.getItem(LIVE_SUBCATEGORY_KEY) ?? '{}'); } catch { /* */ }
  win.localStorage.setItem(LIVE_SUBCATEGORY_KEY, JSON.stringify({
    ...stored,
    [subcategory.toLowerCase()]: ids,
  }));
}

export function getSuggestedEquipmentIds(items, subcategory, compatibleTypes = []) {
  const captureDefaults = items
    .filter((item) => item.category !== 'activity' && item.isDefault)
    .map((item) => item.id);

  if (!subcategory) return captureDefaults;

  const sub = subcategory.toLowerCase();
  const activityMatches = items
    .filter((item) =>
      item.category === 'activity' && (
        compatibleTypes.includes(item.equipmentType) ||
        (item.compatibleActivityIds ?? []).some((id) => id.toLowerCase() === sub)
      )
    )
    .map((item) => item.id);

  return [...new Set([...captureDefaults, ...activityMatches])];
}

export function getEquipmentSelection(items, ids = demoLiveEquipmentIds) {
  const idSet = new Set(ids);
  return items.filter((item) => idSet.has(item.id) || idSet.has(item.equipmentId));
}

export function buildEquipmentSnapshots(items, ids) {
  return getEquipmentSelection(items, ids).map((item) => ({
    equipmentId: item.id,
    productId: item.productId || null,
    displayName: item.displayName || `${item.brand} ${item.model}`,
    brand: item.brand,
    model: item.model,
    equipmentType: item.equipmentType,
    category: item.category,
    ownership: item.ownership,
    affiliateUrl: item.affiliateUrl,
    productUrl: item.productUrl,
    thumbnailUrl: item.thumbnailUrl || item.product?.thumbnailUrl || item.imageUrl || null,
    imageUrl: item.imageUrl || item.thumbnailUrl || item.product?.thumbnailUrl || null,
    imageSource: item.imageSource || item.product?.imageSource || 'placeholder',
    provider: item.provider || item.product?.provider || 'demo',
    status: item.status || item.product?.status || 'placeholder',
  }));
}

export async function fetchMissingEquipmentImages() {
  return {
    updated: 0,
    items: [],
    disabled: true,
    reason: 'Equipment images are resolved from Firestore products or explicit user uploads only.',
  };
}
