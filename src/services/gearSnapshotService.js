/**
 * Service for managing gear snapshots for live streams
 * Snapshots preserve the exact gear information at the time of broadcast
 */

const GEAR_SNAPSHOTS_KEY = 'vuvio:gear-snapshots';

export function createGearSnapshot(gear) {
  if (!gear) return null;

  return {
    gearId: gear.id,
    productId: gear.productId || null,
    category: gear.category,
    brand: gear.brand,
    model: gear.model,
    displayName: gear.displayName || `${gear.brand} ${gear.model}`,
    thumbnailUrl: gear.thumbnailUrl || gear.product?.thumbnailUrl || gear.imageUrl || null,
    imageUrl: gear.imageUrl || gear.thumbnailUrl || gear.product?.thumbnailUrl || null,
    imageSource: gear.imageSource || gear.product?.imageSource || 'placeholder',
    provider: gear.provider || gear.product?.provider || 'demo',
    status: gear.status || gear.product?.status || 'placeholder',
    ownership: gear.ownership || 'owned',
    equipmentType: gear.equipmentType || null,
    createdAt: new Date().toISOString(),
  };
}

export function createLiveGearSnapshots(gearItems) {
  if (!Array.isArray(gearItems)) return [];
  return gearItems
    .filter(Boolean)
    .map(createGearSnapshot)
    .filter(Boolean);
}

export function saveLiveGearSnapshots(liveId, gearSnapshots) {
  if (!liveId || !Array.isArray(gearSnapshots)) return;

  try {
    const snapshots = JSON.parse(
      typeof window !== 'undefined' ? window.localStorage?.getItem(GEAR_SNAPSHOTS_KEY) ?? '{}' : '{}'
    );
    snapshots[liveId] = {
      snapshots: gearSnapshots,
      savedAt: new Date().toISOString(),
    };
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(GEAR_SNAPSHOTS_KEY, JSON.stringify(snapshots));
    }
  } catch (e) {
    console.warn('Failed to save gear snapshots:', e);
  }
}

export function getLiveGearSnapshots(liveId) {
  if (!liveId) return [];

  try {
    const snapshots = JSON.parse(
      typeof window !== 'undefined' ? window.localStorage?.getItem(GEAR_SNAPSHOTS_KEY) ?? '{}' : '{}'
    );
    return snapshots[liveId]?.snapshots || [];
  } catch (e) {
    console.warn('Failed to retrieve gear snapshots:', e);
    return [];
  }
}

export function clearLiveGearSnapshots(liveId) {
  if (!liveId) return;

  try {
    const snapshots = JSON.parse(
      typeof window !== 'undefined' ? window.localStorage?.getItem(GEAR_SNAPSHOTS_KEY) ?? '{}' : '{}'
    );
    delete snapshots[liveId];
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(GEAR_SNAPSHOTS_KEY, JSON.stringify(snapshots));
    }
  } catch (e) {
    console.warn('Failed to clear gear snapshots:', e);
  }
}

export async function suggestGearImage({ category, brand, model, name }) {
  return getGearImageSuggestions({ category, brand, model, displayName: name });
}

export async function getGearImageSuggestions({ category, brand, model, displayName }) {
  return {
    success: true,
    suggestions: [],
    disabled: true,
    reason: 'Equipment images must come from Firestore products or explicit user uploads.',
  };
}
