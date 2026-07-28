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

export async function suggestGearImage({ category, brand, model, name }) {
  return getGearImageSuggestions({ category, brand, model, displayName: name });
}

export async function getGearImageSuggestions({ category, brand, model, displayName }) {
  try {
    const query = displayName || `${brand} ${model}`.trim();
    if (!query || query.length < 2) {
      return { success: true, suggestions: [] };
    }

    // Try to fetch image from Unsplash API (free, no auth required)
    const encodedQuery = encodeURIComponent(query);
    const response = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodedQuery}&per_page=5&client_id=kVZeL207K1gVmJPqnhSH2Yx9rK2LTn9dS7a0A9J5Q_w`,
      { signal: AbortSignal.timeout(5000) }
    );

    if (!response.ok) throw new Error('Unsplash API failed');

    const data = await response.json();
    const suggestions = data.results
      ?.slice(0, 3)
      .map((photo) => ({
        url: photo.urls.small,
        thumb: photo.urls.thumb,
        alt: photo.alt_description || query,
        source: 'unsplash',
      })) || [];

    return { success: true, suggestions };
  } catch (error) {
    console.warn('Failed to fetch gear images:', error.message);
    return { success: false, error: error.message, suggestions: [] };
  }
}
