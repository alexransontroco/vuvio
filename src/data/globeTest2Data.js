const DENSITY_COUNTS = {
  low: 50,
  medium: 250,
  high: 1000,
  stress: 5000,
};

export const globeTest2Config = {
  route: '/globe-test-2',
  styleUrl: 'https://basemaps.cartocdn.com/gl/dark-matter-nolabels-gl-style/style.json',
  initialCenter: [14, 20],
  initialZoom: 1.35,
  zoomLevels: {
    world: 2.35,
    region: 5.05,
    close: 5.6,
  },
  densityOptions: [
    { id: 'low', label: 'Low', count: DENSITY_COUNTS.low },
    { id: 'medium', label: 'Medium', count: DENSITY_COUNTS.medium },
    { id: 'high', label: 'High', count: DENSITY_COUNTS.high },
    { id: 'stress', label: 'Stress', count: DENSITY_COUNTS.stress },
  ],
  maxPreviewCards: {
    mobile: 8,
    desktop: 15,
  },
  colors: {
    land: '#9BCF86',
    water: '#6EA8E8',
    air: '#D6F7FF',
    featured: '#E99A54',
    mixed: '#C9DCE8',
  },
};

const IMAGE_POOL = {
  earth: [
    '/assets/videos/biking-cover.jpg',
    '/assets/pov/12_firefighter.jpg',
    '/assets/VuVio_POV_Pack_20/05_volcanologist.jpg',
    '/assets/VuVio_20_New_POV/09_rooftop_worker.jpg',
  ],
  water: [
    '/assets/VuVio_20_New_POV/01_surfer.jpg',
    '/assets/VuVio_20_New_POV/16_kayaker.jpg',
    '/assets/VuVio_POV_Pack_20/15_ice_diver.jpg',
    '/assets/videos/16352747_1080_1920_30fps-cover.jpg',
  ],
  air: [
    '/assets/pov/01_mountain_rescue_helicopter.jpg',
    '/assets/VuVio_20_New_POV/03_hot_air_balloon.jpg',
    '/assets/VuVio_POV_Pack_20/19_wingsuit.jpg',
    '/assets/VuVio_POV_Pack_20/20_rescue_drone_pilot.jpg',
  ],
};

const REGIONS = [
  { name: 'Western Europe', city: 'Lisbon', country: 'Portugal', family: 'earth', center: [-4.7, 43.5], spread: [10, 7], weight: 11 },
  { name: 'Alpine routes', city: 'Chamonix', country: 'France', family: 'earth', center: [7.2, 46.2], spread: [4, 2], weight: 8 },
  { name: 'Mediterranean coast', city: 'Split', country: 'Croatia', family: 'water', center: [14.8, 40.5], spread: [8, 2.6], weight: 7 },
  { name: 'North Atlantic', city: 'Azores', country: 'Portugal', family: 'water', center: [-24.7, 38.8], spread: [7, 3], weight: 6 },
  { name: 'California coast', city: 'Santa Cruz', country: 'United States', family: 'water', center: [-122.4, 36.8], spread: [5, 2], weight: 7 },
  { name: 'Pacific Northwest', city: 'Vancouver', country: 'Canada', family: 'earth', center: [-123.1, 48.4], spread: [4, 3], weight: 6 },
  { name: 'Japan corridor', city: 'Tokyo', country: 'Japan', family: 'air', center: [139.8, 35.9], spread: [5, 4], weight: 7 },
  { name: 'Indonesia reefs', city: 'Bali', country: 'Indonesia', family: 'water', center: [115.3, -8.2], spread: [5, 2.2], weight: 7 },
  { name: 'East Africa', city: 'Nairobi', country: 'Kenya', family: 'earth', center: [36.8, -1.2], spread: [6, 5], weight: 6 },
  { name: 'Gulf skies', city: 'Dubai', country: 'United Arab Emirates', family: 'air', center: [55.3, 25.2], spread: [5, 3], weight: 5 },
  { name: 'Andes', city: 'Cusco', country: 'Peru', family: 'earth', center: [-72.5, -13.1], spread: [6, 5], weight: 6 },
  { name: 'South Atlantic sailing', city: 'Cape Town', country: 'South Africa', family: 'water', center: [18.2, -34.8], spread: [8, 3.2], weight: 5 },
  { name: 'Australia coast', city: 'Sydney', country: 'Australia', family: 'water', center: [151.5, -33.8], spread: [5, 2.4], weight: 6 },
  { name: 'Nordic air routes', city: 'Oslo', country: 'Norway', family: 'air', center: [10.7, 60.2], spread: [7, 4], weight: 5 },
];

const TITLES = {
  earth: ['Morning ridge walk', 'City roofline live', 'Forest trail ride', 'Old town patrol', 'Mountain pass POV'],
  water: ['Harbor crossing', 'Reef break session', 'Blue water sail', 'Kayak channel live', 'Diving the wall'],
  air: ['Sunrise flight path', 'Drone survey live', 'Balloon drift', 'Paraglider ridge run', 'Helicopter approach'],
};

const STREAMERS = ['Maya', 'Noah', 'Sofia', 'Rui', 'Clara', 'Tomas', 'Lena', 'Amina', 'Kenji', 'Leyla', 'Eli', 'Nora'];
const FEATURED_TYPES = ['editorial', 'trending', 'partner'];

function seededRandom(seed) {
  let value = seed + 0x6d2b79f5;
  return () => {
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function pickWeighted(regions, random) {
  const total = regions.reduce((sum, region) => sum + region.weight, 0);
  let cursor = random() * total;
  for (const region of regions) {
    cursor -= region.weight;
    if (cursor <= 0) return region;
  }
  return regions[regions.length - 1];
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function generatedLive(index, random) {
  const region = pickWeighted(REGIONS, random);
  const family = random() < 0.16 ? ['earth', 'water', 'air'][Math.floor(random() * 3)] : region.family;
  const lng = clamp(region.center[0] + (random() - 0.5) * region.spread[0], -179.5, 179.5);
  const lat = clamp(region.center[1] + (random() - 0.5) * region.spread[1], -72, 72);
  const viewers = Math.floor(40 + Math.pow(random(), 1.9) * 5200);
  const featured = random() < (viewers > 2200 ? 0.18 : 0.055);
  const imagePool = IMAGE_POOL[family] ?? IMAGE_POOL.earth;

  return {
    id: `test2-${index.toString(36).padStart(4, '0')}`,
    status: 'live',
    family,
    subcategory: family === 'air' ? 'Drone' : family === 'water' ? 'Surfing' : 'Tour',
    name: STREAMERS[index % STREAMERS.length],
    streamer: STREAMERS[index % STREAMERS.length],
    city: region.city,
    country: region.country,
    viewers,
    image: imagePool[index % imagePool.length],
    coordinates: [Number(lng.toFixed(4)), Number(lat.toFixed(4))],
    experienceTitle: TITLES[family][index % TITLES[family].length],
    title: TITLES[family][index % TITLES[family].length],
    featured,
    featuredType: featured ? FEATURED_TYPES[index % FEATURED_TYPES.length] : undefined,
    qualityScore: Number((0.48 + random() * 0.52).toFixed(3)),
    startedMinutesAgo: Math.floor(random() * 180),
  };
}

export function createGlobeTest2Lives(density = 'medium', baseStreams = []) {
  const targetCount = DENSITY_COUNTS[density] ?? DENSITY_COUNTS.medium;
  const normalizedBase = baseStreams
    .filter((stream) => stream.status === 'live' && Array.isArray(stream.coordinates))
    .map((stream, index) => ({
      ...stream,
      id: `test2-base-${stream.id}`,
      viewers: Number.parseInt(String(stream.viewers ?? 0).replace(/\D/g, ''), 10) || 0,
      featured: index % 9 === 0,
      featuredType: index % 18 === 0 ? 'editorial' : 'trending',
      qualityScore: 0.7 + (index % 25) / 100,
      startedMinutesAgo: 8 + index * 3,
    }));

  const random = seededRandom(targetCount * 97);
  const generated = Array.from({ length: Math.max(0, targetCount - normalizedBase.length) }, (_, index) => generatedLive(index, random));
  return [...normalizedBase, ...generated].slice(0, targetCount);
}
