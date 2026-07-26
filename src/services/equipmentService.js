import { demoEquipmentItems, demoLiveEquipmentIds, EQUIPMENT_CATEGORIES } from '../data/equipmentModel.js';

const EQUIPMENT_KEY = 'vuvio:equipment-library';
const LIVE_SETUP_KEY = 'vuvio:last-live-equipment';
const LIVE_SUBCATEGORY_KEY = 'vuvio:last-live-equipment-subcategory';
const EQUIPMENT_EVENT = 'vuvio:equipment-updated';

function safeWindow() {
  return typeof window !== 'undefined' ? window : null;
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeLegacyEquipment(item) {
  if (!item) return null;
  if (item.brand && item.model && item.category && EQUIPMENT_CATEGORIES.some((category) => category.id === item.category)) {
    return {
      userId: 'current-user',
      ownership: 'owned',
      isPublic: true,
      isDefault: false,
      imageUrl: item.imageUrl || null,
      imageSource: item.imageSource || 'default_icon',
      imageStatus: item.imageStatus || 'confirmed',
      createdAt: nowIso(),
      updatedAt: nowIso(),
      ...item,
    };
  }

  return {
    id: item.id ?? `equipment-${Date.now()}`,
    userId: 'current-user',
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
    imageSource: item.imageSource || 'default_icon',
    imageStatus: item.imageStatus || 'confirmed',
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
}

export function normalizeEquipmentItem(item) {
  return normalizeLegacyEquipment(item);
}

export function getEquipmentLibrary(seedItems = demoEquipmentItems) {
  const win = safeWindow();
  if (!win) return seedItems.map(normalizeEquipmentItem).filter(Boolean);

  try {
    const stored = JSON.parse(win.localStorage.getItem(EQUIPMENT_KEY) ?? 'null');
    if (Array.isArray(stored)) return stored.map(normalizeEquipmentItem).filter(Boolean);
  } catch {
    // Fall through to seed data.
  }

  const seeded = seedItems.map(normalizeEquipmentItem).filter(Boolean);
  win.localStorage.setItem(EQUIPMENT_KEY, JSON.stringify(seeded));
  return seeded;
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
    ...input,
  });
  return saveEquipmentLibrary([item, ...getEquipmentLibrary()])[0];
}

export function updateEquipmentItem(id, patch) {
  let updatedItem = null;
  const next = getEquipmentLibrary().map((item) => {
    if (item.id !== id) return item;
    updatedItem = normalizeEquipmentItem({ ...item, ...patch, updatedAt: nowIso() });
    return updatedItem;
  });
  saveEquipmentLibrary(next);
  return updatedItem;
}

export function removeEquipmentItem(id) {
  return saveEquipmentLibrary(getEquipmentLibrary().filter((item) => item.id !== id));
}

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
  return items.filter((item) => idSet.has(item.id));
}

export function buildEquipmentSnapshots(items, ids) {
  return getEquipmentSelection(items, ids).map((item) => ({
    equipmentId: item.id,
    displayName: item.displayName || `${item.brand} ${item.model}`,
    brand: item.brand,
    model: item.model,
    equipmentType: item.equipmentType,
    category: item.category,
    ownership: item.ownership,
    affiliateUrl: item.affiliateUrl,
    productUrl: item.productUrl,
    imageUrl: item.imageUrl || null,
    imageSource: item.imageSource || null,
  }));
}
