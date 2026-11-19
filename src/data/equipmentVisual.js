import {
  Camera,
  Video,
  Mic,
  Headphones,
  Guitar,
  Music,
  Backpack,
  Footprints,
  Wrench,
  Hammer,
  BatteryCharging,
  Watch,
  Laptop,
  Smartphone,
  Package,
  Mountain,
  Bike,
  Sailboat,
  Plane,
  Tractor,
  Flame,
  Utensils,
  ChefHat,
  Fish,
  Radio,
  Shirt,
  Zap,
  HardHat,
  LifeBuoy,
  Drum,
  Piano,
  Tent,
  Compass,
  Snowflake,
  Waves,
  Hexagon,
  Scissors,
  CookingPot,
  CarFront,
  Dumbbell,
  Layers,
} from 'lucide-react';

export const EQUIPMENT_ICONS = {
  camera: Camera,
  video: Video,
  mic: Mic,
  headphones: Headphones,
  guitar: Guitar,
  music: Music,
  backpack: Backpack,
  footprints: Footprints,
  wrench: Wrench,
  hammer: Hammer,
  battery: BatteryCharging,
  watch: Watch,
  laptop: Laptop,
  smartphone: Smartphone,
  package: Package,
  mountain: Mountain,
  bike: Bike,
  sailboat: Sailboat,
  plane: Plane,
  tractor: Tractor,
  flame: Flame,
  utensils: Utensils,
  chef: ChefHat,
  fish: Fish,
  radio: Radio,
  shirt: Shirt,
  zap: Zap,
  hardhat: HardHat,
  lifebuoy: LifeBuoy,
  drum: Drum,
  piano: Piano,
  tent: Tent,
  compass: Compass,
  snowflake: Snowflake,
  waves: Waves,
  hexagon: Hexagon,
  scissors: Scissors,
  cooking: CookingPot,
  car: CarFront,
  sport: Dumbbell,
  layers: Layers,
};

function normalizeText(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// Keyword → icon id. First-match wins; the input text is normalized (lowercase +
// stripped accents) before testing, so patterns can be lowercase ASCII and match
// FR variants like "guitare", "micro", "sac a dos", "velo" without explicit
// accented spellings. Use `\b` at the start to require a word boundary and avoid
// leading-char overlap; omit the trailing boundary so "guitar" matches "guitare"
// and "mic" matches "micro". Order sensitive: more specific patterns first.
const KEYWORD_RULES = [
  // Instruments (first — prefer "guitar" over the "fender"-the-brand fallback)
  [/\bguitar/, 'guitar'],
  [/\bbass\b/, 'guitar'],
  [/\b(stratocaster|telecaster|les\s?paul|strat|gibson|yamaha\s?fg|martin)\b/, 'guitar'],
  [/\b(drum|cymbal|snare|hihat|hi-hat|kick|djembe|batterie)\b/, 'drum'],
  [/\b(piano|clavier|keyboard|synth|synthesizer|clavinova|rhodes|nord)\b/, 'piano'],
  [/\b(violin|violon|viola|cello|violoncelle|flute|flûte|trumpet|trompette|saxophone|saxo|clarinet|clarinette|harp|harpe|ukulele|uke)\b/, 'music'],

  // Cameras / video
  [/\b(gopro|hero|osmo|action[\s-]?cam|camcorder|dslr|mirrorless|cam(era)?|camescope|camescop|camscope)\b/, 'camera'],
  [/\b(drone|mavic|mini\s?\d|air\s?\d)\b/, 'camera'],
  [/\b(gimbal|stabilizer|stabilisateur|ronin)\b/, 'video'],
  [/\b(tripod|trepied|monopod|gorillapod|mount|clamp|pince)\b/, 'camera'],
  [/\b(lens|objectif|zoom|wide[\s-]?angle|telephoto)\b/, 'camera'],

  // Audio
  [/\b(microphone|micro|mic|lavalier|lav|rode|shure|sennheiser|dji\s?mic)\b/, 'mic'],
  [/\b(headphone|earphone|earbud|airpod|headset|casque\s?audio|ecouteur|ecouteurs)\b/, 'headphones'],
  [/\b(speaker|haut-parleur|hp\b|enceinte|amp(lifier)?|ampli|monitor|moniteur|audio\s?interface|carte\s?son|mixer|mixeur|table\s?de\s?mixage|pa\b)/, 'radio'],
  [/\b(pedal|pedale|effect|effet|loop|reverb|delay)\b/, 'music'],

  // Outdoor / hiking / camping
  [/\b(backpack|rucksack|daypack|sac\s?a\s?dos|sacados)\b/, 'backpack'],
  [/\b(boot|hiking shoe|chaussure|trail\s?shoe|sneaker|cleat|basket|crampon)\b/, 'footprints'],
  [/\b(trek(king)?\s?pole|walking\s?stick|baton\s?de\s?marche|baton)\b/, 'mountain'],
  [/\b(tent|tente|bivouac|shelter|abri|sleeping\s?bag|sac\s?de\s?couchage|pad|matelas|mat)\b/, 'tent'],
  [/\b(compass|boussole|map|carte|gps)\b/, 'compass'],
  [/\b(ski|snowboard|climbing|escalade|ice\s?axe|piolet|harness|baudrier)\b/, 'snowflake'],

  // Cycling
  [/\b(bike|bicycle|velo|cycle|cyclisme|helmet|casque|canyon|specialized|trek|giant|cannondale)\b/, 'bike'],

  // Water / sailing / fishing
  [/\b(sail|voile|boat|bateau|kayak|paddle|surf|windsurf|dinghy|catamaran)\b/, 'sailboat'],
  [/\b(wave|vague|wetsuit|combinaison|fin|planche|board)\b/, 'waves'],
  [/\b(life\s?jacket|life\s?vest|gilet\s?de\s?sauvetage|pfd|buoy|bouee)\b/, 'lifebuoy'],
  [/\b(fish|pech|rod|canne|reel|moulinet|tackle|lure|leurre)\b/, 'fish'],

  // Aviation
  [/\b(parachute|paraglider|parapente|glider|planeur|wing|aile|plane|avion)\b/, 'plane'],

  // Transport / tractor / farming
  [/\b(tractor|tracteur|harvester|moissonneuse|combine|plow|plough|charrue)\b/, 'tractor'],

  // Fire / emergency
  [/\b(fire|feu|flame|flamme|extinguisher|extincteur|turnout|scba)\b/, 'flame'],

  // Cooking / culinary
  [/\b(knife|couteau|chef|cuisinier|cleaver|hachoir|cutting\s?board|planche)\b/, 'chef'],
  [/\b(pan|skillet|wok|pot|casserole|poele|oven|four|thermometer|thermometre|thermapen|whisk|fouet|mixer|batteur|robot)\b/, 'utensils'],

  // Crafts / workshop / tools
  [/\b(saw|scie|drill|perceuse|driver|visseuse|bit|meche|hammer|marteau|screwdriver|tournevis|chisel|ciseau\s?a\s?bois|lathe|tour|planer|rabot|workbench|etabli)\b/, 'hammer'],
  [/\b(wrench|spanner|cle\s?a\s?molette|cle|plumber|plombier)\b/, 'wrench'],
  [/\b(scissor|ciseaux|cutter|cisaille)\b/, 'scissors'],

  // Power / batteries / cables
  [/\b(battery|batterie|power\s?bank|anker|charger|chargeur|cable|adapter|adaptateur|usb)\b/, 'battery'],
  [/\b(generator|generateur|solar|solaire|panel|panneau|inverter|onduleur|energy|energie)\b/, 'zap'],
  [/\b(memory|sd\s?card|carte\s?sd|ssd|hard\s?drive|disque\s?dur|storage|stockage)\b/, 'battery'],

  // Clothing / accessories
  [/\b(jacket|veste|coat|manteau|parka|pant|pantalon|short|tee|t-shirt|shirt|chemise|hoodie|sweat|vetement|sweater|pull)\b/, 'shirt'],
  [/\b(glove|gant|mitten|moufle)\b/, 'shirt'],
  [/\b(helmet|hat|cap|casque|chapeau|casquette)\b/, 'hardhat'],
  [/\b(watch|montre|garmin|suunto|fenix|forerunner|instinct)\b/, 'watch'],

  // Compute / mobile
  [/\b(laptop|macbook|notebook|ordinateur|pc\b)/, 'laptop'],
  [/\b(phone|smartphone|iphone|android|telephone|galaxy|pixel)\b/, 'smartphone'],

  // Brand-only fallbacks (last, so a "Fender Stratocaster" lands on guitar via
  // the earlier instrument rules first).
  [/\bfender\b/, 'guitar'],
];

// Data category → fallback icon when no keyword matches. "activity" is kept
// deliberately generic (Package) because it's an umbrella Firestore bucket that
// doesn't imply mountain gear. recording/audio/streaming/power keep their strong
// hints because those categories are narrow by design.
const CATEGORY_FALLBACK = {
  recording: 'camera',
  audio: 'mic',
  activity: 'package',
  streaming: 'laptop',
  power_accessories: 'battery',
  instruments: 'guitar',
  clothing: 'shirt',
  accessories: 'package',
  cooking: 'chef',
  tools: 'wrench',
  outdoor: 'backpack',
};

function iconIdFromText(text) {
  const normalized = normalizeText(text);
  if (!normalized) return null;
  for (const [pattern, iconId] of KEYWORD_RULES) {
    if (pattern.test(normalized)) return iconId;
  }
  return null;
}

/**
 * Resolve the Lucide icon component for an equipment item.
 * Accepts any item shape with name/displayName/brand/model/equipmentType/category.
 */
export function resolveEquipmentIcon(item = {}) {
  const parts = [
    item.displayName,
    item.name,
    item.brand,
    item.model,
    item.equipmentType,
    item.type,
  ].filter(Boolean).join(' ');
  const byText = iconIdFromText(parts);
  const byCategory = CATEGORY_FALLBACK[item.category] || 'package';
  const id = byText || byCategory;
  return EQUIPMENT_ICONS[id] || Package;
}

/** Same resolution but returns just the icon id string (useful for tests). */
export function resolveEquipmentIconId(item = {}) {
  const parts = [
    item.displayName,
    item.name,
    item.brand,
    item.model,
    item.equipmentType,
    item.type,
  ].filter(Boolean).join(' ');
  return iconIdFromText(parts) || CATEGORY_FALLBACK[item.category] || 'package';
}

const VISUAL_CATEGORIES = {
  guitar: 'instruments', music: 'instruments', drum: 'instruments', piano: 'instruments',
  mic: 'audio', headphones: 'audio', radio: 'audio',
  camera: 'cameras', video: 'cameras',
  backpack: 'outdoor', mountain: 'outdoor', tent: 'outdoor', compass: 'outdoor', snowflake: 'outdoor',
  chef: 'cooking', utensils: 'cooking', cooking: 'cooking',
  wrench: 'tools', hammer: 'tools', scissors: 'tools', hardhat: 'tools',
  shirt: 'clothing', footprints: 'footwear',
  laptop: 'computing', smartphone: 'computing',
  car: 'transport', tractor: 'transport', plane: 'transport',
  sailboat: 'navigation', waves: 'navigation', lifebuoy: 'navigation', fish: 'navigation',
  bike: 'sport', sport: 'sport', watch: 'sport',
  battery: 'energy', zap: 'energy',
  layers: 'accessories',
};

const CATEGORY_ICONS = {
  instruments: Guitar, audio: Mic, cameras: Camera, outdoor: Mountain,
  cooking: CookingPot, tools: Wrench, clothing: Shirt, footwear: Footprints,
  computing: Laptop, transport: CarFront, navigation: Sailboat, sport: Dumbbell,
  energy: BatteryCharging, accessories: Layers, other: Package,
};

const DATA_CATEGORY_VISUAL = {
  recording: 'cameras', audio: 'audio', streaming: 'computing', power_accessories: 'energy',
  instruments: 'instruments', cooking: 'cooking', tools: 'tools', outdoor: 'outdoor',
  clothing: 'clothing', footwear: 'footwear', accessories: 'accessories',
};

export const EQUIPMENT_VISUAL_CATEGORIES = Object.keys(CATEGORY_ICONS);

export function inferEquipmentVisualCategory(item = {}) {
  if (CATEGORY_ICONS[item.visualCategory]) return item.visualCategory;
  if (CATEGORY_ICONS[item.catalogCategory]) return item.catalogCategory;
  const text = [item.displayName, item.name, item.brand, item.model, item.equipmentType, item.type, item.subcategory].filter(Boolean).join(' ');
  const iconId = iconIdFromText(text);
  if (iconId && VISUAL_CATEGORIES[iconId]) return VISUAL_CATEGORIES[iconId];
  return DATA_CATEGORY_VISUAL[item.category] || 'other';
}

export function validEquipmentImageUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return false;
  if (value.startsWith('/')) return !value.startsWith('//');
  if (/^data:image\/(?:png|jpeg|webp|gif|avif);base64,/i.test(value)) return true;
  try { return new URL(value).protocol === 'https:'; } catch { return false; }
}

export function canDisplayEquipmentImage(item = {}, usage = 'persistent-gear') {
  const source = item.imageSource || item.product?.imageSource;
  const imageUrl = item.imageUrl || item.thumbnailUrl || item.product?.thumbnailUrl;
  const status = item.imageRightsStatus || item.product?.imageRightsStatus;
  const allowedUsages = item.imageAllowedUsages || item.product?.imageAllowedUsages || [];
  const expiresAt = item.imageRightsExpiresAt || item.product?.imageRightsExpiresAt;
  if (expiresAt && (!Number.isFinite(Date.parse(expiresAt)) || Date.parse(expiresAt) <= Date.now())) return false;
  if (['revoked', 'expired', 'denied'].includes(status)) return false;
  if (source === 'user_upload' || source === 'user-upload') return usage !== 'public-gear' || (['authorized', 'manual-approved'].includes(status) && allowedUsages.includes(usage));
  if (!['authorized', 'manual-approved'].includes(status)) return false;
  if (!Array.isArray(allowedUsages) || !allowedUsages.includes(usage)) return false;
  if (source === 'ebayCatalog' && (usage === 'search-preview' || item.imageRightsSource === 'ebay-api-license-public-display-conditional')) return false;
  if (['icecat', 'ebayCatalog'].includes(source) && (!expiresAt || !item.imageRightsCheckedAt || !item.imageProductId)) return false;
  if (source === 'icecat') {
    const ownStorage = typeof imageUrl === 'string' && (imageUrl.startsWith('/') || imageUrl.startsWith('https://storage.googleapis.com/vuvio-bf328.firebasestorage.app/'));
    if (item.imageHostingStatus !== 'self-hosted' || !ownStorage) return false;
  }
  return Boolean(item.imageRightsSource || item.product?.imageRightsSource);
}

export function getEquipmentVisual(item = {}, usage = 'persistent-gear') {
  const category = inferEquipmentVisualCategory(item);
  const text = [item.displayName, item.name, item.brand, item.model, item.equipmentType, item.type, item.subcategory].filter(Boolean).join(' ');
  const iconId = iconIdFromText(text);
  const imageUrl = item.imageUrl || item.thumbnailUrl || item.product?.thumbnailUrl || null;
  return {
    category,
    icon: iconId && VISUAL_CATEGORIES[iconId] === category ? EQUIPMENT_ICONS[iconId] : CATEGORY_ICONS[category] || Package,
    imageUrl: canDisplayEquipmentImage(item, usage) && validEquipmentImageUrl(imageUrl) ? imageUrl : null,
  };
}

export function equipmentImageForUsage(item = {}, usage = 'persistent-gear') {
  return getEquipmentVisual(item, usage).imageUrl;
}

export function persistentEquipmentImage(item = {}) {
  const imageUrl = equipmentImageForUsage(item, 'persistent-gear');
  return {
    imageUrl,
    thumbnailUrl: imageUrl,
    imageSource: item.imageSource || null,
    imageRightsStatus: item.imageRightsStatus || null,
    imageRightsSource: item.imageRightsSource || null,
    imageAllowedUsages: Array.isArray(item.imageAllowedUsages) ? item.imageAllowedUsages : [],
    imageRightsCheckedAt: item.imageRightsCheckedAt || null,
    imageRightsExpiresAt: item.imageRightsExpiresAt || null,
    imageProductId: item.imageProductId || item.sourceProductId || null,
    imageHostingStatus: item.imageHostingStatus || null,
  };
}
