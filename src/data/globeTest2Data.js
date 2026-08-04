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
const WATER_ACTIVITIES = ['surf', 'sailing', 'kayaking', 'diving', 'fishing', 'paddle'];

function inferWaterActivityFromStream(stream) {
  const value = String(stream?.activity ?? stream?.subcategory ?? stream?.title ?? stream?.experienceTitle ?? stream?.name ?? '').toLowerCase();
  if (value.includes('surf')) return 'surf';
  if (value.includes('sail')) return 'sailing';
  if (value.includes('kayak')) return 'kayaking';
  if (value.includes('div')) return 'diving';
  if (value.includes('fish')) return 'fishing';
  if (value.includes('paddle')) return 'paddle';
  if (value.includes('ferry')) return 'ferry';
  if (value.includes('jet')) return 'jetSki';
  if (value.includes('swim')) return 'swimming';
  if (value.includes('boat')) return 'boat';
  return undefined;
}

const WATER_PRIORITY_LIVES = [
  { id: 'water-live-basque-01', title: 'Basque break cam', streamer: 'Maya', city: 'Biarritz', country: 'France', coordinates: [-1.58, 43.48], viewers: 124, featured: false, activity: 'surf' },
  { id: 'water-live-basque-02', title: 'La barre live', streamer: 'Noah', city: 'Hossegor', country: 'France', coordinates: [-1.43, 43.66], viewers: 268, featured: true, activity: 'surf' },
  { id: 'water-live-portugal-01', title: 'Atlantic point', streamer: 'Rui', city: 'Nazaré', country: 'Portugal', coordinates: [-9.07, 39.6], viewers: 312, featured: false, activity: 'surf' },
  { id: 'water-live-portugal-02', title: 'Harbor runner', streamer: 'Clara', city: 'Lisbon', country: 'Portugal', coordinates: [-9.14, 38.72], viewers: 154, featured: false, activity: 'sailing' },
  { id: 'water-live-mediterranean-01', title: 'Port wake', streamer: 'Tomas', city: 'Split', country: 'Croatia', coordinates: [16.44, 43.51], viewers: 89, featured: false, activity: 'boat' },
  { id: 'water-live-mediterranean-02', title: 'Coastline tack', streamer: 'Sofia', city: 'Nice', country: 'France', coordinates: [7.27, 43.7], viewers: 211, featured: false, activity: 'sailing' },
  { id: 'water-live-norway-01', title: 'Fjord paddle line', streamer: 'Lena', city: 'Bergen', country: 'Norway', coordinates: [5.33, 60.39], viewers: 73, featured: false, activity: 'kayaking' },
  { id: 'water-live-norway-02', title: 'Cold water channel', streamer: 'Eli', city: 'Oslo', country: 'Norway', coordinates: [10.75, 59.91], viewers: 142, featured: false, activity: 'kayaking' },
  { id: 'water-live-greece-01', title: 'Aegean sails', streamer: 'Leyla', city: 'Athens', country: 'Greece', coordinates: [23.73, 37.98], viewers: 188, featured: true, activity: 'sailing' },
  { id: 'water-live-greece-02', title: 'Island crossing', streamer: 'Kenji', city: 'Crete', country: 'Greece', coordinates: [24.99, 35.34], viewers: 97, featured: false, activity: 'boat' },
  { id: 'water-live-red-sea-01', title: 'Reef descent', streamer: 'Amina', city: 'Hurghada', country: 'Egypt', coordinates: [33.81, 27.26], viewers: 207, featured: false, activity: 'diving' },
  { id: 'water-live-red-sea-02', title: 'Blue wall dive', streamer: 'Nora', city: 'Sharm El Sheikh', country: 'Egypt', coordinates: [34.29, 27.85], viewers: 231, featured: true, activity: 'diving' },
  { id: 'water-live-brittany-01', title: 'Harbor cast', streamer: 'Rui', city: 'Brest', country: 'France', coordinates: [-4.49, 48.39], viewers: 66, featured: false, activity: 'fishing' },
  { id: 'water-live-brittany-02', title: 'Tide line', streamer: 'Maya', city: 'Concarneau', country: 'France', coordinates: [-3.92, 47.87], viewers: 112, featured: false, activity: 'fishing' },
  { id: 'water-live-caribbean-01', title: 'Lagoon glide', streamer: 'Sofia', city: 'Cozumel', country: 'Mexico', coordinates: [-86.95, 20.51], viewers: 173, featured: false, activity: 'paddle' },
  { id: 'water-live-caribbean-02', title: 'Coral drift', streamer: 'Tomas', city: 'Nassau', country: 'Bahamas', coordinates: [-77.35, 25.05], viewers: 236, featured: true, activity: 'diving' },
  { id: 'water-live-california-01', title: 'West swell', streamer: 'Clara', city: 'Santa Cruz', country: 'United States', coordinates: [-122.03, 36.95], viewers: 342, featured: true, activity: 'surf' },
  { id: 'water-live-california-02', title: 'Harbor morning', streamer: 'Noah', city: 'Monterey', country: 'United States', coordinates: [-121.89, 36.6], viewers: 85, featured: false, activity: 'paddle' },
  { id: 'water-live-japan-01', title: 'Fish market run', streamer: 'Kenji', city: 'Tokyo', country: 'Japan', coordinates: [139.79, 35.67], viewers: 145, featured: false, activity: 'fishing' },
  { id: 'water-live-japan-02', title: 'Ferry line', streamer: 'Amina', city: 'Osaka', country: 'Japan', coordinates: [135.5, 34.69], viewers: 192, featured: false, activity: 'ferry' },
];

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
  const activity = family === 'water' ? WATER_ACTIVITIES[index % WATER_ACTIVITIES.length] : undefined;

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
    activity,
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
      activity: stream.activity ?? inferWaterActivityFromStream(stream),
    }));

  const random = seededRandom(targetCount * 97);
  const generated = Array.from({ length: Math.max(0, targetCount - normalizedBase.length - WATER_PRIORITY_LIVES.length) }, (_, index) => generatedLive(index, random));
  return [...normalizedBase, ...WATER_PRIORITY_LIVES, ...generated].slice(0, targetCount);
}
