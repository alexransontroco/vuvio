// Activity-aware gear suggestions.
//
// Design principles (per spec):
//  1. Suggestions follow the activity, not a fixed "streaming kit".
//     Cooking → knives/pans/thermometer, NOT GoPro/DJI Mic.
//  2. Keep brands only where they're iconic enough to help recognition.
//     Otherwise use empty brand + generic descriptive model.
//  3. If no activity produces a match, return []. Do NOT invent.
//
// The activity names below use the exact vocabulary from
// ACTIVITY_CATEGORIES.subcategories in /src/data/activityCategories.js.

export const GEAR_SUGGESTIONS = [
  // ── Outdoor / Hiking ────────────────────────────────────────────────
  { id: 'sg-backpack-40l', brand: '', model: 'Hiking backpack',    category: 'activity',         equipmentType: 'Backpack',        activities: ['Hiking', 'Walking'] },
  { id: 'sg-hiking-boots', brand: '', model: 'Hiking boots',       category: 'activity',         equipmentType: 'Footwear',        activities: ['Hiking', 'Walking'] },
  { id: 'sg-trek-poles',   brand: '', model: 'Trekking poles',     category: 'activity',         equipmentType: 'Poles',           activities: ['Hiking', 'Walking'] },
  { id: 'sg-garmin-fenix', brand: 'Garmin', model: 'Fenix',        category: 'activity',         equipmentType: 'GPS Watch',       activities: ['Hiking', 'Walking', 'Mountain bike', 'Bicycle'] },
  { id: 'sg-headlamp',     brand: '', model: 'Headlamp',           category: 'activity',         equipmentType: 'Lighting',        activities: ['Hiking', 'Walking'] },

  // ── Cycling ─────────────────────────────────────────────────────────
  { id: 'sg-bike-helmet',  brand: '', model: 'Bike helmet',        category: 'activity',         equipmentType: 'Helmet',          activities: ['Bicycle', 'Mountain bike'] },
  { id: 'sg-bike-lights',  brand: '', model: 'Bike lights',        category: 'activity',         equipmentType: 'Lighting',        activities: ['Bicycle', 'Mountain bike'] },
  { id: 'sg-bike-gloves',  brand: '', model: 'Cycling gloves',     category: 'activity',         equipmentType: 'Gloves',          activities: ['Bicycle', 'Mountain bike'] },

  // ── Music ───────────────────────────────────────────────────────────
  { id: 'sg-guitar',       brand: '', model: 'Electric guitar',    category: 'activity',         equipmentType: 'Instrument',      activities: ['Concert'] },
  { id: 'sg-amp',          brand: '', model: 'Guitar amplifier',   category: 'audio',            equipmentType: 'Amplifier',       activities: ['Concert'] },
  { id: 'sg-pedal',        brand: '', model: 'Effect pedal',       category: 'audio',            equipmentType: 'Effect Pedal',    activities: ['Concert'] },
  { id: 'sg-interface',    brand: '', model: 'Audio interface',    category: 'audio',            equipmentType: 'Audio Interface', activities: ['Concert'] },
  { id: 'sg-keyboard',     brand: '', model: 'MIDI keyboard',      category: 'audio',            equipmentType: 'Keyboard',        activities: ['Concert'] },

  // ── Cooking / Food ──────────────────────────────────────────────────
  { id: 'sg-chef-knife',   brand: '', model: "Chef's knife",       category: 'activity',         equipmentType: 'Kitchen Tool',    activities: ['Cooking'] },
  { id: 'sg-pan',          brand: '', model: 'Frying pan',         category: 'activity',         equipmentType: 'Cookware',        activities: ['Cooking'] },
  { id: 'sg-thermometer',  brand: '', model: 'Food thermometer',   category: 'activity',         equipmentType: 'Instrument',      activities: ['Cooking'] },
  { id: 'sg-stand-mixer',  brand: '', model: 'Stand mixer',        category: 'activity',         equipmentType: 'Kitchen Tool',    activities: ['Cooking'] },
  { id: 'sg-cutting-board',brand: '', model: 'Cutting board',      category: 'activity',         equipmentType: 'Kitchen Tool',    activities: ['Cooking'] },

  // ── Fishing ─────────────────────────────────────────────────────────
  { id: 'sg-rod',          brand: '', model: 'Fishing rod',        category: 'activity',         equipmentType: 'Rod',             activities: ['Fishing'] },
  { id: 'sg-reel',         brand: '', model: 'Fishing reel',       category: 'activity',         equipmentType: 'Reel',            activities: ['Fishing'] },
  { id: 'sg-tackle',       brand: '', model: 'Tackle box',         category: 'activity',         equipmentType: 'Gear',            activities: ['Fishing'] },

  // ── Sailing ─────────────────────────────────────────────────────────
  { id: 'sg-lifejacket',   brand: '', model: 'Life jacket',        category: 'activity',         equipmentType: 'Safety',          activities: ['Sailboat', 'Boat'] },
  { id: 'sg-marine-gps',   brand: '', model: 'Marine GPS',         category: 'activity',         equipmentType: 'Navigation',      activities: ['Sailboat', 'Boat'] },

  // ── Water sports ────────────────────────────────────────────────────
  { id: 'sg-wetsuit',      brand: '', model: 'Wetsuit',            category: 'activity',         equipmentType: 'Apparel',         activities: ['Surfing', 'Kayak', 'Paddleboarding', 'Diving'] },
  { id: 'sg-surfboard',    brand: '', model: 'Surfboard',          category: 'activity',         equipmentType: 'Board',           activities: ['Surfing'] },
  { id: 'sg-paddle',       brand: '', model: 'Paddle',             category: 'activity',         equipmentType: 'Paddle',          activities: ['Kayak', 'Paddleboarding'] },

  // ── Aviation ────────────────────────────────────────────────────────
  { id: 'sg-drone',        brand: 'DJI', model: 'Mini 4 Pro',      category: 'recording',        equipmentType: 'Drone',           activities: ['Drone'] },
  { id: 'sg-paraglider',   brand: '', model: 'Paraglider wing',    category: 'activity',         equipmentType: 'Wing',            activities: ['Paragliding', 'Wingsuit'] },
  { id: 'sg-flight-helmet',brand: '', model: 'Flight helmet',      category: 'activity',         equipmentType: 'Helmet',          activities: ['Paragliding', 'Wingsuit', 'Airplane', 'Helicopter'] },

  // ── Transport ───────────────────────────────────────────────────────
  { id: 'sg-dashcam',      brand: '', model: 'Dashcam',            category: 'recording',        equipmentType: 'Camera',          activities: ['Transport', 'Tour'] },

  // ── Farming ─────────────────────────────────────────────────────────
  { id: 'sg-work-gloves',  brand: '', model: 'Work gloves',        category: 'activity',         equipmentType: 'Gloves',          activities: ['Agriculture', 'Work', 'Construction'] },
  { id: 'sg-safety-boots', brand: '', model: 'Safety boots',       category: 'activity',         equipmentType: 'Footwear',        activities: ['Agriculture', 'Work', 'Construction'] },

  // ── Crafts / Work / Construction ────────────────────────────────────
  { id: 'sg-drill',        brand: '', model: 'Cordless drill',     category: 'activity',         equipmentType: 'Power Tool',      activities: ['Work', 'Construction'] },
  { id: 'sg-hand-tools',   brand: '', model: 'Hand tool set',      category: 'activity',         equipmentType: 'Tools',           activities: ['Work', 'Construction'] },
  { id: 'sg-hard-hat',     brand: '', model: 'Hard hat',           category: 'activity',         equipmentType: 'Helmet',          activities: ['Work', 'Construction'] },

  // ── Emergency ───────────────────────────────────────────────────────
  { id: 'sg-fire-helmet',  brand: '', model: 'Fire helmet',        category: 'activity',         equipmentType: 'Helmet',          activities: ['Work'] },
  { id: 'sg-turnout',      brand: '', model: 'Turnout gear',       category: 'activity',         equipmentType: 'Apparel',         activities: ['Work'] },

  // ── Energy ──────────────────────────────────────────────────────────
  { id: 'sg-portable-pwr', brand: '', model: 'Portable power station', category: 'power_accessories', equipmentType: 'Battery',     activities: ['Work', 'Construction'] },
];

function normalize(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

/**
 * Return gear suggestions matching the given activity names.
 * Empty input → []. No match → []. We don't invent fake defaults.
 */
export function getSuggestions(activities = []) {
  if (!Array.isArray(activities) || activities.length === 0) return [];
  const normalized = activities.map(normalize).filter(Boolean);
  const seen = new Set();
  const out = [];
  for (const s of GEAR_SUGGESTIONS) {
    if (!Array.isArray(s.activities) || s.activities.length === 0) continue;
    const match = s.activities.some((a) => normalized.includes(normalize(a)));
    if (!match) continue;
    const key = `${normalize(s.brand)}|${normalize(s.model)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

export function isSuggestion(item) {
  if (!item?.id) return false;
  return GEAR_SUGGESTIONS.some((s) => s.id === item.id);
}
