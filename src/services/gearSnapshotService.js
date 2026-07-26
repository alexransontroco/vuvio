/**
 * Service for managing gear snapshots for live streams
 * Snapshots preserve the exact gear information at the time of broadcast
 */

const GEAR_SNAPSHOTS_KEY = 'vuvio:gear-snapshots';

export function createGearSnapshot(gear) {
  if (!gear) return null;

  return {
    gearId: gear.id,
    category: gear.category,
    brand: gear.brand,
    model: gear.model,
    displayName: gear.displayName || `${gear.brand} ${gear.model}`,
    imageUrl: gear.imageUrl || null,
    imageSource: gear.imageSource || null,
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

// Service for future image suggestions
export async function getGearImageSuggestions({ category, brand, model }) {
  // Placeholder for future implementation
  // Could connect to:
  // - Internal product catalog
  // - Brand partner APIs
  // - Image recognition services
  // - User-contributed images

  try {
    // For now, return empty list
    // This structure allows easy integration later
    const suggestions = [];
    return { success: true, suggestions };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
