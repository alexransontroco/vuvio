/**
 * Seed script for products collection
 * Run this once to populate Firestore with initial product data
 */

import { db } from '../firebase.js';
import { collection, doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';

const PRODUCTS_COLLECTION = 'products';

function normalize(str) {
  return String(str ?? '')
    .normalize('NFKD')
    .replace(/[Øø]/g, 'o')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function compact(str) {
  return normalize(str).replace(/\s+/g, '');
}

function unique(values) {
  return [...new Set(values.map((value) => String(value ?? '').trim()).filter(Boolean))];
}

function termsFor(product) {
  const aliases = product.aliases ?? [];
  const tags = product.tags ?? [];
  const base = [
    product.brand,
    product.name,
    `${product.brand} ${product.name}`,
    ...aliases,
    ...tags,
  ];

  const normalized = base.flatMap((value) => {
    const term = normalize(value);
    if (!term) return [];
    const parts = term.split(' ').filter((part) => part.length > 1);
    return [term, compact(term), ...parts];
  });

  return unique(normalized);
}

function product({
  id,
  brand,
  name,
  category,
  subcategory,
  description,
  aliases = [],
  tags = [],
  officialProductUrl,
  thumbnailUrl,
}) {
  const item = {
    id,
    brand,
    name,
    normalizedName: normalize(name),
    category,
    description,
    aliases: unique(aliases),
    tags: unique(tags),
    searchTerms: [],
    provider: 'local',
    canImport: false,
    status: 'active',
  };

  if (subcategory) item.subcategory = subcategory;
  if (officialProductUrl) {
    item.officialProductUrl = officialProductUrl;
    item.productUrl = officialProductUrl;
    item.sourceProductUrl = officialProductUrl;
  }
  if (thumbnailUrl) {
    item.thumbnailUrl = thumbnailUrl;
    item.imageSource = 'manufacturer';
  }

  item.searchTerms = termsFor(item);
  return item;
}

const P = product;

export const seedProducts = [
  P({ id: 'gopro-hero13-black', brand: 'GoPro', name: 'HERO13 Black', category: 'recording', subcategory: 'action_camera', description: 'Flagship action camera for POV and sports creators', aliases: ['Hero 13', 'HERO13', 'Go Pro Hero 13', 'GoPro Hero13 Black'], tags: ['action camera', 'pov camera', 'waterproof camera', 'creator camera'], officialProductUrl: 'https://gopro.com/en/us/shop/cameras/hero13-black/CHDHX-131-master.html' }),
  P({ id: 'gopro-hero12-black', brand: 'GoPro', name: 'HERO12 Black', category: 'recording', subcategory: 'action_camera', description: 'Action camera with HyperSmooth stabilization', aliases: ['Hero 12', 'HERO12', 'Go Pro Hero 12'], tags: ['action camera', 'pov camera', 'waterproof camera'], officialProductUrl: 'https://gopro.com/en/us/shop/cameras/hero12-black/CHDHX-121-master.html' }),
  P({ id: 'gopro-hero11-black', brand: 'GoPro', name: 'HERO11 Black', category: 'recording', subcategory: 'action_camera', description: 'Action camera used widely for POV sports footage', aliases: ['Hero 11', 'HERO11', 'Go Pro Hero 11'], tags: ['action camera', 'pov camera', 'waterproof camera'] }),
  P({ id: 'gopro-hero10-black', brand: 'GoPro', name: 'HERO10 Black', category: 'recording', subcategory: 'action_camera', description: 'Compact action camera for high-frame-rate POV capture', aliases: ['Hero 10', 'HERO10', 'Go Pro Hero 10'], tags: ['action camera', 'pov camera'] }),
  P({ id: 'gopro-hero9-black', brand: 'GoPro', name: 'HERO9 Black', category: 'recording', subcategory: 'action_camera', description: 'Action camera with front display', aliases: ['Hero 9', 'HERO9', 'Go Pro Hero 9'], tags: ['action camera', 'pov camera'] }),
  P({ id: 'gopro-max', brand: 'GoPro', name: 'MAX', category: 'recording', subcategory: '360_camera', description: '360 action camera for immersive POV footage', aliases: ['GoPro 360', 'Go Pro Max'], tags: ['360 camera', 'action camera', 'pov camera'] }),
  P({ id: 'dji-osmo-action-5-pro', brand: 'DJI', name: 'Osmo Action 5 Pro', category: 'recording', subcategory: 'action_camera', description: 'Action camera for sports and outdoor creators', aliases: ['Action 5 Pro', 'DJI Action 5', 'Osmo Action5 Pro'], tags: ['action camera', 'pov camera', 'waterproof camera'], officialProductUrl: 'https://www.dji.com/osmo-action-5-pro' }),
  P({ id: 'dji-osmo-action-4', brand: 'DJI', name: 'Osmo Action 4', category: 'recording', subcategory: 'action_camera', description: 'Action camera with strong low-light performance', aliases: ['Action 4', 'DJI Action 4', 'Osmo Action4'], tags: ['action camera', 'pov camera', 'waterproof camera'], officialProductUrl: 'https://www.dji.com/osmo-action-4' }),
  P({ id: 'dji-osmo-action-3', brand: 'DJI', name: 'Osmo Action 3', category: 'recording', subcategory: 'action_camera', description: 'Rugged action camera for outdoor recording', aliases: ['Action 3', 'DJI Action 3'], tags: ['action camera', 'pov camera'] }),
  P({ id: 'dji-osmo-pocket-3', brand: 'DJI', name: 'Osmo Pocket 3', category: 'recording', subcategory: 'pocket_camera', description: 'Pocket gimbal camera for stabilized creator footage', aliases: ['Pocket 3', 'DJI Pocket 3'], tags: ['gimbal camera', 'creator camera', 'vlogging camera'], officialProductUrl: 'https://www.dji.com/osmo-pocket-3' }),
  P({ id: 'dji-pocket-2', brand: 'DJI', name: 'Pocket 2', category: 'recording', subcategory: 'pocket_camera', description: 'Compact stabilized camera for travel and live creators', aliases: ['Osmo Pocket 2', 'DJI Osmo Pocket 2'], tags: ['gimbal camera', 'creator camera'] }),
  P({ id: 'insta360-x4', brand: 'Insta360', name: 'X4', category: 'recording', subcategory: '360_camera', description: '8K 360 action camera for reframed POV video', aliases: ['Insta 360 X4'], tags: ['360 camera', 'action camera', 'pov camera'], officialProductUrl: 'https://www.insta360.com/product/insta360-x4' }),
  P({ id: 'insta360-x3', brand: 'Insta360', name: 'X3', category: 'recording', subcategory: '360_camera', description: '360-degree action camera', aliases: ['Insta 360 X3'], tags: ['360 camera', 'action camera', 'pov camera'], officialProductUrl: 'https://www.insta360.com/product/insta360-x3' }),
  P({ id: 'insta360-one-rs', brand: 'Insta360', name: 'ONE RS', category: 'recording', subcategory: 'action_camera', description: 'Modular action camera system', aliases: ['One RS', 'Insta 360 One RS'], tags: ['action camera', '360 camera', 'pov camera'] }),
  P({ id: 'insta360-go-3s', brand: 'Insta360', name: 'GO 3S', category: 'recording', subcategory: 'wearable_camera', description: 'Tiny wearable action camera for hands-free POV', aliases: ['Go 3S', 'Insta 360 GO 3S'], tags: ['wearable camera', 'pov camera', 'action camera'], officialProductUrl: 'https://www.insta360.com/product/insta360-go3s' }),
  P({ id: 'insta360-go-3', brand: 'Insta360', name: 'GO 3', category: 'recording', subcategory: 'wearable_camera', description: 'Compact wearable camera for creator POV shots', aliases: ['Go 3', 'Insta 360 GO 3'], tags: ['wearable camera', 'pov camera', 'action camera'] }),
  P({ id: 'sony-zv-e10', brand: 'Sony', name: 'ZV-E10', category: 'recording', subcategory: 'mirrorless_camera', description: 'Interchangeable-lens vlog camera used by creators', aliases: ['ZVE10', 'Sony ZV E10', 'Sony ZV-E10L'], tags: ['vlogging camera', 'mirrorless camera', 'creator camera'], officialProductUrl: 'https://electronics.sony.com/imaging/interchangeable-lens-cameras/aps-c/p/ilczve10-b' }),
  P({ id: 'sony-zv-e10-ii', brand: 'Sony', name: 'ZV-E10 II', category: 'recording', subcategory: 'mirrorless_camera', description: 'Second-generation APS-C creator camera', aliases: ['ZVE10 II', 'Sony ZV E10 II', 'ZV-E10M2'], tags: ['vlogging camera', 'mirrorless camera', 'creator camera'], officialProductUrl: 'https://electronics.sony.com/imaging/interchangeable-lens-cameras/aps-c/p/ilczve10m2-b' }),
  P({ id: 'sony-zv-1', brand: 'Sony', name: 'ZV-1', category: 'recording', subcategory: 'compact_camera', description: 'Compact creator camera with fast autofocus', aliases: ['ZV1', 'Sony ZV 1'], tags: ['vlogging camera', 'compact camera', 'creator camera'] }),
  P({ id: 'sony-zv-1-ii', brand: 'Sony', name: 'ZV-1 II', category: 'recording', subcategory: 'compact_camera', description: 'Wide-angle compact camera for vloggers', aliases: ['ZV1 II', 'Sony ZV 1 II'], tags: ['vlogging camera', 'compact camera', 'creator camera'], officialProductUrl: 'https://electronics.sony.com/imaging/compact-cameras/all-compact-cameras/p/zv1m2-b' }),
  P({ id: 'sony-zv-1f', brand: 'Sony', name: 'ZV-1F', category: 'recording', subcategory: 'compact_camera', description: 'Entry-level compact vlog camera', aliases: ['ZV1F', 'Sony ZV 1F'], tags: ['vlogging camera', 'compact camera', 'creator camera'] }),
  P({ id: 'sony-zv-e1', brand: 'Sony', name: 'ZV-E1', category: 'recording', subcategory: 'mirrorless_camera', description: 'Full-frame creator camera for high-quality video', aliases: ['ZVE1', 'Sony ZV E1'], tags: ['vlogging camera', 'full frame camera', 'creator camera'] }),
  P({ id: 'sony-a6400', brand: 'Sony', name: 'Alpha a6400', category: 'recording', subcategory: 'mirrorless_camera', description: 'APS-C mirrorless camera popular with creators', aliases: ['a6400', 'Alpha 6400', 'ILCE-6400'], tags: ['mirrorless camera', 'creator camera'] }),
  P({ id: 'sony-a6700', brand: 'Sony', name: 'Alpha a6700', category: 'recording', subcategory: 'mirrorless_camera', description: 'APS-C mirrorless hybrid camera', aliases: ['a6700', 'Alpha 6700', 'ILCE-6700'], tags: ['mirrorless camera', 'creator camera'] }),
  P({ id: 'sony-a7-iii', brand: 'Sony', name: 'Alpha 7 III', category: 'recording', subcategory: 'mirrorless_camera', description: 'Full-frame mirrorless camera used by many creators', aliases: ['a7 iii', 'A7III', 'Sony A7 III'], tags: ['mirrorless camera', 'full frame camera'] }),
  P({ id: 'sony-a7-iv', brand: 'Sony', name: 'Alpha 7 IV', category: 'recording', subcategory: 'mirrorless_camera', description: 'Full-frame hybrid creator camera', aliases: ['a7 iv', 'A7IV', 'Sony A7 IV'], tags: ['mirrorless camera', 'full frame camera', 'creator camera'] }),
  P({ id: 'canon-eos-r50', brand: 'Canon', name: 'EOS R50', category: 'recording', subcategory: 'mirrorless_camera', description: 'Compact mirrorless camera for creators', aliases: ['Canon R50'], tags: ['mirrorless camera', 'creator camera', 'vlogging camera'] }),
  P({ id: 'canon-eos-r10', brand: 'Canon', name: 'EOS R10', category: 'recording', subcategory: 'mirrorless_camera', description: 'APS-C mirrorless camera for hybrid shooting', aliases: ['Canon R10'], tags: ['mirrorless camera', 'creator camera'] }),
  P({ id: 'canon-eos-r6-mark-ii', brand: 'Canon', name: 'EOS R6 Mark II', category: 'recording', subcategory: 'mirrorless_camera', description: 'Full-frame hybrid mirrorless camera', aliases: ['Canon R6 II', 'R6 Mark 2'], tags: ['mirrorless camera', 'full frame camera'] }),
  P({ id: 'canon-powershot-g7-x-mark-iii', brand: 'Canon', name: 'PowerShot G7 X Mark III', category: 'recording', subcategory: 'compact_camera', description: 'Compact camera long used by vloggers', aliases: ['G7X III', 'G7 X Mark 3'], tags: ['vlogging camera', 'compact camera'] }),
  P({ id: 'fujifilm-x-s20', brand: 'Fujifilm', name: 'X-S20', category: 'recording', subcategory: 'mirrorless_camera', description: 'Compact mirrorless camera with strong video features', aliases: ['XS20', 'Fuji X-S20'], tags: ['mirrorless camera', 'creator camera'] }),
  P({ id: 'panasonic-lumix-gh6', brand: 'Panasonic', name: 'Lumix GH6', category: 'recording', subcategory: 'mirrorless_camera', description: 'Video-focused Micro Four Thirds camera', aliases: ['GH6', 'Panasonic GH6'], tags: ['mirrorless camera', 'creator camera'] }),
  P({ id: 'panasonic-lumix-s5iix', brand: 'Panasonic', name: 'Lumix S5IIX', category: 'recording', subcategory: 'mirrorless_camera', description: 'Full-frame video-focused mirrorless camera', aliases: ['S5IIX', 'S5 IIX', 'Lumix S5IIX'], tags: ['mirrorless camera', 'full frame camera'] }),
  P({ id: 'nikon-z30', brand: 'Nikon', name: 'Z30', category: 'recording', subcategory: 'mirrorless_camera', description: 'Compact creator camera for video and streaming', aliases: ['Nikon Z 30'], tags: ['mirrorless camera', 'vlogging camera', 'creator camera'] }),

  P({ id: 'dji-mic-2', brand: 'DJI', name: 'Mic 2', category: 'audio', subcategory: 'wireless_microphone', description: 'Wireless microphone system for content creators', aliases: ['DJI microphone', 'DJI Mic Two', 'Mic 2 transmitter'], tags: ['wireless mic', 'microphone', 'creator audio'], officialProductUrl: 'https://www.dji.com/mic-2' }),
  P({ id: 'dji-mic', brand: 'DJI', name: 'Mic', category: 'audio', subcategory: 'wireless_microphone', description: 'Compact wireless microphone system', aliases: ['DJI microphone', 'DJI Mic 1'], tags: ['wireless mic', 'microphone', 'creator audio'] }),
  P({ id: 'dji-mic-mini', brand: 'DJI', name: 'Mic Mini', category: 'audio', subcategory: 'wireless_microphone', description: 'Tiny wireless microphone kit for mobile creators', aliases: ['DJI Mini Mic', 'DJI microphone mini'], tags: ['wireless mic', 'microphone', 'creator audio'], officialProductUrl: 'https://www.dji.com/mic-mini' }),
  P({ id: 'rode-wireless-go-ii', brand: 'RØDE', name: 'Wireless GO II', category: 'audio', subcategory: 'wireless_microphone', description: 'Ultra-compact wireless microphone system', aliases: ['Rode Wireless Go', 'RODE Wireless GO 2', 'RØDE Wireless GO 2', 'Wireless Go II'], tags: ['wireless mic', 'microphone', 'creator audio'], officialProductUrl: 'https://rode.com/en/microphones/wireless/wirelessgoii' }),
  P({ id: 'rode-wireless-go', brand: 'RØDE', name: 'Wireless GO', category: 'audio', subcategory: 'wireless_microphone', description: 'Compact wireless microphone for creators', aliases: ['Rode Wireless Go', 'RODE Wireless GO'], tags: ['wireless mic', 'microphone', 'creator audio'] }),
  P({ id: 'rode-wireless-pro', brand: 'RØDE', name: 'Wireless PRO', category: 'audio', subcategory: 'wireless_microphone', description: 'Dual-channel wireless microphone system for creators', aliases: ['Rode Wireless Pro', 'RODE Wireless PRO'], tags: ['wireless mic', 'microphone', 'creator audio'], officialProductUrl: 'https://rode.com/en/microphones/wireless/wirelesspro' }),
  P({ id: 'rode-wireless-me', brand: 'RØDE', name: 'Wireless ME', category: 'audio', subcategory: 'wireless_microphone', description: 'Compact wireless microphone system', aliases: ['Rode Wireless Me', 'RODE Wireless ME'], tags: ['wireless mic', 'microphone', 'creator audio'] }),
  P({ id: 'rode-wireless-micro', brand: 'RØDE', name: 'Wireless Micro', category: 'audio', subcategory: 'wireless_microphone', description: 'Tiny wireless microphone for phone creators', aliases: ['Rode Wireless Micro', 'RODE Wireless Micro'], tags: ['wireless mic', 'microphone', 'phone microphone'], officialProductUrl: 'https://rode.com/en/microphones/wireless/wireless-micro' }),
  P({ id: 'rode-videomicro-2', brand: 'RØDE', name: 'VideoMicro II', category: 'audio', subcategory: 'camera_microphone', description: 'Ultra-compact on-camera microphone', aliases: ['Rode VideoMicro 2', 'RODE VideoMicro II'], tags: ['camera microphone', 'shotgun mic', 'creator audio'] }),
  P({ id: 'rode-videomic-go-ii', brand: 'RØDE', name: 'VideoMic GO II', category: 'audio', subcategory: 'camera_microphone', description: 'Lightweight on-camera shotgun microphone', aliases: ['Rode VideoMic Go 2', 'RODE VideoMic GO II'], tags: ['camera microphone', 'shotgun mic', 'creator audio'] }),
  P({ id: 'rode-videomic-ntg', brand: 'RØDE', name: 'VideoMic NTG', category: 'audio', subcategory: 'camera_microphone', description: 'Broadcast-style on-camera shotgun microphone', aliases: ['Rode VideoMic NTG'], tags: ['camera microphone', 'shotgun mic', 'creator audio'] }),
  P({ id: 'rode-nt-usb-plus', brand: 'RØDE', name: 'NT-USB+', category: 'audio', subcategory: 'usb_microphone', description: 'USB microphone for voice and streaming', aliases: ['Rode NT USB Plus', 'NTUSB+'], tags: ['usb microphone', 'streaming mic', 'voice mic'] }),
  P({ id: 'rode-nt1-5th-generation', brand: 'RØDE', name: 'NT1 5th Generation', category: 'audio', subcategory: 'studio_microphone', description: 'Studio condenser microphone', aliases: ['Rode NT1 5th Gen', 'NT1'], tags: ['studio microphone', 'condenser mic', 'voice mic'] }),
  P({ id: 'rode-nt5', brand: 'RØDE', name: 'NT5', category: 'audio', subcategory: 'studio_microphone', description: 'Small-diaphragm condenser microphone', aliases: ['Rode NT5'], tags: ['microphone', 'instrument mic', 'piano mic'] }),
  P({ id: 'sennheiser-mke-200', brand: 'Sennheiser', name: 'MKE 200', category: 'audio', subcategory: 'camera_microphone', description: 'Compact on-camera microphone', aliases: ['MKE200'], tags: ['camera microphone', 'shotgun mic', 'creator audio'] }),
  P({ id: 'sennheiser-mke-400', brand: 'Sennheiser', name: 'MKE 400', category: 'audio', subcategory: 'camera_microphone', description: 'Directional on-camera shotgun microphone', aliases: ['MKE400'], tags: ['camera microphone', 'shotgun mic', 'creator audio'] }),
  P({ id: 'sennheiser-profile-wireless', brand: 'Sennheiser', name: 'Profile Wireless', category: 'audio', subcategory: 'wireless_microphone', description: 'Wireless microphone system for creators', aliases: ['Sennheiser wireless mic'], tags: ['wireless mic', 'microphone', 'creator audio'] }),
  P({ id: 'sennheiser-xs-lav-usb-c', brand: 'Sennheiser', name: 'XS Lav USB-C', category: 'audio', subcategory: 'lavalier_microphone', description: 'USB-C lavalier microphone', aliases: ['XS Lav USB C'], tags: ['lavalier mic', 'phone microphone', 'creator audio'] }),
  P({ id: 'shure-sm58', brand: 'Shure', name: 'SM58', category: 'audio', subcategory: 'live_microphone', description: 'Industry-standard vocal microphone', aliases: ['SM 58', 'Shure mic', 'Shure vocal mic'], tags: ['microphone', 'live mic', 'vocal mic', 'stage microphone'], officialProductUrl: 'https://www.shure.com/en-US/products/microphones/sm58' }),
  P({ id: 'shure-sm57', brand: 'Shure', name: 'SM57', category: 'audio', subcategory: 'live_microphone', description: 'Dynamic instrument microphone', aliases: ['SM 57', 'Shure mic', 'Shure instrument mic'], tags: ['microphone', 'instrument mic', 'live mic'], officialProductUrl: 'https://www.shure.com/en-US/products/microphones/sm57' }),
  P({ id: 'shure-mv7-plus', brand: 'Shure', name: 'MV7+', category: 'audio', subcategory: 'usb_microphone', description: 'USB/XLR microphone for podcasting and streaming', aliases: ['MV7 Plus', 'Shure MV7'], tags: ['usb microphone', 'streaming mic', 'podcast mic'] }),
  P({ id: 'shure-mv88-plus', brand: 'Shure', name: 'MV88+ Video Kit', category: 'audio', subcategory: 'mobile_microphone', description: 'Mobile stereo microphone kit for video creators', aliases: ['MV88 Plus', 'Shure MV88'], tags: ['mobile microphone', 'phone microphone', 'creator audio'] }),
  P({ id: 'zoom-h1essential', brand: 'Zoom', name: 'H1essential', category: 'audio', subcategory: 'portable_recorder', description: 'Portable handheld audio recorder', aliases: ['H1 Essential', 'Zoom H1'], tags: ['audio recorder', 'field recorder', 'portable recorder'] }),
  P({ id: 'zoom-h4essential', brand: 'Zoom', name: 'H4essential', category: 'audio', subcategory: 'portable_recorder', description: 'Four-track portable field recorder', aliases: ['H4 Essential', 'Zoom H4'], tags: ['audio recorder', 'field recorder', 'portable recorder'] }),
  P({ id: 'zoom-h6essential', brand: 'Zoom', name: 'H6essential', category: 'audio', subcategory: 'portable_recorder', description: 'Multi-track portable recorder', aliases: ['H6 Essential', 'Zoom H6'], tags: ['audio recorder', 'field recorder', 'portable recorder'] }),
  P({ id: 'zoom-f3', brand: 'Zoom', name: 'F3', category: 'audio', subcategory: 'field_recorder', description: 'Compact 32-bit float field recorder', aliases: ['Zoom F3 recorder'], tags: ['audio recorder', 'field recorder', 'creator audio'] }),
  P({ id: 'tascam-dr-10l-pro', brand: 'Tascam', name: 'DR-10L Pro', category: 'audio', subcategory: 'portable_recorder', description: 'Wearable lavalier recorder', aliases: ['DR10L Pro'], tags: ['audio recorder', 'lavalier recorder', 'creator audio'] }),
  P({ id: 'tascam-dr-05x', brand: 'Tascam', name: 'DR-05X', category: 'audio', subcategory: 'portable_recorder', description: 'Stereo handheld audio recorder', aliases: ['DR05X'], tags: ['audio recorder', 'field recorder', 'portable recorder'] }),
  P({ id: 'deity-v-mic-d4-mini', brand: 'Deity', name: 'V-Mic D4 Mini', category: 'audio', subcategory: 'camera_microphone', description: 'Compact on-camera microphone', aliases: ['D4 Mini', 'Deity D4'], tags: ['camera microphone', 'shotgun mic', 'creator audio'] }),
  P({ id: 'deity-pocket-wireless', brand: 'Deity', name: 'Pocket Wireless', category: 'audio', subcategory: 'wireless_microphone', description: 'Compact wireless microphone system', aliases: ['Deity wireless mic'], tags: ['wireless mic', 'microphone', 'creator audio'] }),
  P({ id: 'hollyland-lark-m2', brand: 'Hollyland', name: 'Lark M2', category: 'audio', subcategory: 'wireless_microphone', description: 'Button-size wireless microphone system', aliases: ['Lark M2 wireless'], tags: ['wireless mic', 'microphone', 'creator audio'] }),
  P({ id: 'hollyland-lark-max', brand: 'Hollyland', name: 'Lark Max', category: 'audio', subcategory: 'wireless_microphone', description: 'Wireless microphone system for creators', aliases: ['Lark Max wireless'], tags: ['wireless mic', 'microphone', 'creator audio'] }),
  P({ id: 'saramonic-blink500-prox-b2', brand: 'Saramonic', name: 'Blink500 ProX B2', category: 'audio', subcategory: 'wireless_microphone', description: 'Dual wireless microphone system', aliases: ['Blink 500 Pro X B2'], tags: ['wireless mic', 'microphone', 'creator audio'] }),

  P({ id: 'gopro-chesty-mount', brand: 'GoPro', name: 'Chesty Mount', category: 'power_accessories', subcategory: 'camera_mount', description: 'Chest mount for hands-free POV recording', aliases: ['Chesty', 'Go Pro chest mount'], tags: ['mount', 'chest mount', 'pov mount', 'action camera mount'], officialProductUrl: 'https://gopro.com/en/us/shop/mounts-accessories/chesty/AGCHM-001.html' }),
  P({ id: 'gopro-head-strap-quickclip', brand: 'GoPro', name: 'Head Strap + QuickClip', category: 'power_accessories', subcategory: 'camera_mount', description: 'Head mount for POV capture', aliases: ['GoPro head strap', 'Go Pro head mount'], tags: ['mount', 'head mount', 'pov mount'] }),
  P({ id: 'gopro-helmet-front-side-mount', brand: 'GoPro', name: 'Helmet Front + Side Mount', category: 'power_accessories', subcategory: 'camera_mount', description: 'Helmet mounting kit for action cameras', aliases: ['GoPro helmet mount', 'Go Pro helmet mount'], tags: ['mount', 'helmet mount', 'pov mount'] }),
  P({ id: 'gopro-handlebar-seatpost-pole-mount', brand: 'GoPro', name: 'Handlebar / Seatpost / Pole Mount', category: 'power_accessories', subcategory: 'bike_mount', description: 'Bike and pole mount for action cameras', aliases: ['GoPro bike mount', 'Go Pro handlebar mount'], tags: ['mount', 'bike mount', 'handlebar mount', 'cycling'] }),
  P({ id: 'gopro-suction-cup-mount', brand: 'GoPro', name: 'Suction Cup Mount', category: 'power_accessories', subcategory: 'camera_mount', description: 'Industrial suction cup mount for cameras', aliases: ['GoPro suction mount', 'Go Pro suction cup'], tags: ['mount', 'suction mount', 'car mount'] }),
  P({ id: 'gopro-3-way-2-0', brand: 'GoPro', name: '3-Way 2.0', category: 'power_accessories', subcategory: 'grip_tripod', description: 'Camera grip, extension arm and tripod', aliases: ['3 Way', 'GoPro 3-Way', 'Go Pro 3 Way'], tags: ['grip', 'tripod', 'selfie stick', 'mount'] }),
  P({ id: 'gopro-shorty', brand: 'GoPro', name: 'Shorty', category: 'power_accessories', subcategory: 'grip_tripod', description: 'Mini extension pole and tripod', aliases: ['GoPro mini tripod', 'Go Pro Shorty'], tags: ['grip', 'tripod', 'mini tripod'] }),
  P({ id: 'gopro-volta', brand: 'GoPro', name: 'Volta', category: 'power_accessories', subcategory: 'grip_battery', description: 'Battery grip and tripod for GoPro cameras', aliases: ['GoPro battery grip', 'Go Pro Volta'], tags: ['grip', 'battery', 'tripod', 'remote'] }),
  P({ id: 'gopro-media-mod', brand: 'GoPro', name: 'Media Mod', category: 'power_accessories', subcategory: 'camera_accessory', description: 'Creator cage with directional mic and ports', aliases: ['GoPro media mod', 'Go Pro Media Mod'], tags: ['camera accessory', 'creator accessory', 'microphone'] }),
  P({ id: 'gopro-enduro-battery', brand: 'GoPro', name: 'Enduro Battery', category: 'power_accessories', subcategory: 'battery', description: 'Cold-weather rechargeable battery for GoPro cameras', aliases: ['GoPro battery', 'Enduro'], tags: ['battery', 'action camera battery'] }),
  P({ id: 'gopro-floaty', brand: 'GoPro', name: 'Floaty', category: 'power_accessories', subcategory: 'water_accessory', description: 'Floating camera accessory for water sports', aliases: ['GoPro Floaty', 'Go Pro Floaty'], tags: ['water sports', 'float', 'surf', 'mount'] }),
  P({ id: 'dji-osmo-action-bike-seat-rail-mount', brand: 'DJI', name: 'Osmo Action Bike Seat Rail Mount', category: 'power_accessories', subcategory: 'bike_mount', description: 'Bike saddle rail mount for DJI action cameras', aliases: ['DJI bike mount', 'Osmo Action bike mount'], tags: ['mount', 'bike mount', 'cycling'] }),
  P({ id: 'dji-osmo-action-chest-strap-mount', brand: 'DJI', name: 'Osmo Action Chest Strap Mount', category: 'power_accessories', subcategory: 'camera_mount', description: 'Chest harness for DJI action cameras', aliases: ['DJI chest mount', 'Osmo chest mount'], tags: ['mount', 'chest mount', 'pov mount'] }),
  P({ id: 'dji-osmo-action-helmet-chin-mount', brand: 'DJI', name: 'Osmo Action Helmet Chin Mount', category: 'power_accessories', subcategory: 'camera_mount', description: 'Helmet chin mount for POV action footage', aliases: ['DJI helmet mount', 'Osmo helmet mount'], tags: ['mount', 'helmet mount', 'pov mount'] }),
  P({ id: 'insta360-invisible-selfie-stick', brand: 'Insta360', name: 'Invisible Selfie Stick', category: 'power_accessories', subcategory: 'grip_tripod', description: 'Selfie stick hidden automatically in 360 footage', aliases: ['Insta 360 invisible stick'], tags: ['selfie stick', '360 camera', 'mount'] }),
  P({ id: 'insta360-bike-bundle', brand: 'Insta360', name: 'Bike Bundle', category: 'power_accessories', subcategory: 'bike_mount', description: 'Bike mounting kit for Insta360 cameras', aliases: ['Insta360 bike mount', 'Insta 360 bike bundle'], tags: ['mount', 'bike mount', 'cycling'] }),
  P({ id: 'insta360-chest-strap', brand: 'Insta360', name: 'Chest Strap', category: 'power_accessories', subcategory: 'camera_mount', description: 'Chest mount for Insta360 POV footage', aliases: ['Insta360 chest mount', 'Insta 360 chest strap'], tags: ['mount', 'chest mount', 'pov mount'] }),
  P({ id: 'peak-design-capture-clip', brand: 'Peak Design', name: 'Capture Clip', category: 'power_accessories', subcategory: 'camera_mount', description: 'Camera clip for backpack straps and belts', aliases: ['Capture Camera Clip'], tags: ['camera clip', 'mount', 'creator accessory'], officialProductUrl: 'https://www.peakdesign.com/products/capture' }),
  P({ id: 'peak-design-travel-tripod', brand: 'Peak Design', name: 'Travel Tripod', category: 'power_accessories', subcategory: 'tripod', description: 'Compact travel tripod for cameras', aliases: ['Peak Design tripod'], tags: ['tripod', 'camera support'] }),
  P({ id: 'joby-gorillapod-3k', brand: 'JOBY', name: 'GorillaPod 3K Kit', category: 'power_accessories', subcategory: 'tripod', description: 'Flexible tripod for creator cameras', aliases: ['Gorillapod 3K', 'Joby tripod'], tags: ['tripod', 'mini tripod', 'creator accessory'] }),
  P({ id: 'joby-gorillapod-1k', brand: 'JOBY', name: 'GorillaPod 1K Kit', category: 'power_accessories', subcategory: 'tripod', description: 'Compact flexible tripod', aliases: ['Gorillapod 1K', 'Joby tripod'], tags: ['tripod', 'mini tripod', 'creator accessory'] }),
  P({ id: 'ulanzi-mt-16', brand: 'Ulanzi', name: 'MT-16', category: 'power_accessories', subcategory: 'grip_tripod', description: 'Mini tripod and extension grip for cameras', aliases: ['Ulanzi tripod', 'MT16'], tags: ['tripod', 'grip', 'creator accessory'] }),
  P({ id: 'ulanzi-mt-44', brand: 'Ulanzi', name: 'MT-44', category: 'power_accessories', subcategory: 'grip_tripod', description: 'Extendable vlog tripod', aliases: ['Ulanzi MT44'], tags: ['tripod', 'grip', 'creator accessory'] }),
  P({ id: 'smallrig-super-clamp', brand: 'SmallRig', name: 'Super Clamp', category: 'power_accessories', subcategory: 'camera_mount', description: 'Multi-purpose clamp for camera rigs', aliases: ['SmallRig clamp'], tags: ['mount', 'clamp', 'camera rig'] }),
  P({ id: 'smallrig-magic-arm', brand: 'SmallRig', name: 'Magic Arm', category: 'power_accessories', subcategory: 'camera_mount', description: 'Articulating arm for monitors and cameras', aliases: ['SmallRig arm'], tags: ['mount', 'camera rig', 'creator accessory'] }),
  P({ id: 'manfrotto-pixi-mini-tripod', brand: 'Manfrotto', name: 'PIXI Mini Tripod', category: 'power_accessories', subcategory: 'tripod', description: 'Small tabletop tripod for compact cameras', aliases: ['Manfrotto PIXI'], tags: ['tripod', 'mini tripod', 'creator accessory'] }),
  P({ id: 'ram-mounts-tough-claw', brand: 'RAM Mounts', name: 'Tough-Claw', category: 'power_accessories', subcategory: 'camera_mount', description: 'Clamp mount for bikes, boats and vehicles', aliases: ['RAM Tough Claw'], tags: ['mount', 'clamp', 'bike mount', 'vehicle mount'] }),
  P({ id: 'quad-lock-out-front-mount', brand: 'Quad Lock', name: 'Out Front Mount', category: 'power_accessories', subcategory: 'bike_mount', description: 'Phone mount for cycling handlebars', aliases: ['Quadlock bike mount'], tags: ['phone mount', 'bike mount', 'cycling'] }),
  P({ id: 'sp-connect-bike-bundle', brand: 'SP Connect', name: 'Bike Bundle II', category: 'power_accessories', subcategory: 'bike_mount', description: 'Phone mounting kit for bikes', aliases: ['SP Connect bike mount'], tags: ['phone mount', 'bike mount', 'cycling'] }),
  P({ id: 'anker-737-power-bank', brand: 'Anker', name: '737 Power Bank', category: 'power_accessories', subcategory: 'power_bank', description: 'High-capacity USB-C power bank for creator gear', aliases: ['PowerCore 24K', 'Anker 737'], tags: ['battery', 'power bank', 'portable charger'] }),
  P({ id: 'anker-535-powercore-20000', brand: 'Anker', name: '535 PowerCore 20K', category: 'power_accessories', subcategory: 'power_bank', description: 'Portable charger for cameras and phones', aliases: ['Anker 20K power bank'], tags: ['battery', 'power bank', 'portable charger'] }),

  P({ id: 'fender-american-professional-ii-stratocaster', brand: 'Fender', name: 'American Professional II Stratocaster', category: 'activity', subcategory: 'music_guitar', description: 'Professional Stratocaster electric guitar', aliases: ['Fender Stratocaster', 'Strat', 'American Pro II Strat'], tags: ['electric guitar', 'guitar', 'music'] }),
  P({ id: 'fender-player-stratocaster', brand: 'Fender', name: 'Player Stratocaster', category: 'activity', subcategory: 'music_guitar', description: 'Popular Stratocaster electric guitar', aliases: ['Fender Strat', 'Player Strat'], tags: ['electric guitar', 'guitar', 'music'] }),
  P({ id: 'fender-player-telecaster', brand: 'Fender', name: 'Player Telecaster', category: 'activity', subcategory: 'music_guitar', description: 'Classic Telecaster electric guitar', aliases: ['Fender Telecaster', 'Tele', 'Player Tele'], tags: ['electric guitar', 'guitar', 'music'] }),
  P({ id: 'gibson-les-paul-standard-60s', brand: 'Gibson', name: 'Les Paul Standard 60s', category: 'activity', subcategory: 'music_guitar', description: 'Classic Les Paul electric guitar', aliases: ['Gibson Les Paul', 'Les Paul Standard'], tags: ['electric guitar', 'guitar', 'music'] }),
  P({ id: 'gibson-sg-standard', brand: 'Gibson', name: 'SG Standard', category: 'activity', subcategory: 'music_guitar', description: 'Iconic SG electric guitar', aliases: ['Gibson SG'], tags: ['electric guitar', 'guitar', 'music'] }),
  P({ id: 'epiphone-les-paul-standard', brand: 'Epiphone', name: 'Les Paul Standard', category: 'activity', subcategory: 'music_guitar', description: 'Accessible Les Paul-style electric guitar', aliases: ['Epiphone Les Paul'], tags: ['electric guitar', 'guitar', 'music'] }),
  P({ id: 'prs-se-custom-24', brand: 'PRS', name: 'SE Custom 24', category: 'activity', subcategory: 'music_guitar', description: 'Versatile electric guitar', aliases: ['PRS Custom 24 SE'], tags: ['electric guitar', 'guitar', 'music'] }),
  P({ id: 'ibanez-rg550', brand: 'Ibanez', name: 'RG550', category: 'activity', subcategory: 'music_guitar', description: 'High-performance electric guitar', aliases: ['Ibanez RG 550'], tags: ['electric guitar', 'guitar', 'music'] }),
  P({ id: 'yamaha-fg800', brand: 'Yamaha', name: 'FG800', category: 'activity', subcategory: 'music_guitar', description: 'Popular dreadnought acoustic guitar', aliases: ['Yamaha FG 800'], tags: ['acoustic guitar', 'guitar', 'music'] }),
  P({ id: 'yamaha-apx600', brand: 'Yamaha', name: 'APX600', category: 'activity', subcategory: 'music_guitar', description: 'Thin-line acoustic-electric guitar', aliases: ['Yamaha APX 600'], tags: ['acoustic guitar', 'acoustic electric', 'guitar'] }),
  P({ id: 'taylor-314ce', brand: 'Taylor', name: '314ce', category: 'activity', subcategory: 'music_guitar', description: 'Grand Auditorium acoustic-electric guitar', aliases: ['Taylor 314 ce'], tags: ['acoustic guitar', 'acoustic electric', 'guitar'] }),
  P({ id: 'martin-d-28', brand: 'Martin', name: 'D-28', category: 'activity', subcategory: 'music_guitar', description: 'Standard Series dreadnought acoustic guitar', aliases: ['Martin D28'], tags: ['acoustic guitar', 'dreadnought', 'guitar'] }),
  P({ id: 'yamaha-p-515', brand: 'Yamaha', name: 'P-515', category: 'activity', subcategory: 'music_keyboard', description: 'Digital piano for performance and practice', aliases: ['Yamaha P515'], tags: ['digital piano', 'keyboard', 'music'] }),
  P({ id: 'yamaha-p-125a', brand: 'Yamaha', name: 'P-125a', category: 'activity', subcategory: 'music_keyboard', description: 'Portable digital piano', aliases: ['Yamaha P125', 'P 125a'], tags: ['digital piano', 'keyboard', 'music'] }),
  P({ id: 'nord-stage-4', brand: 'Nord', name: 'Stage 4', category: 'activity', subcategory: 'music_keyboard', description: 'Stage keyboard for live performance', aliases: ['Nord Stage'], tags: ['keyboard', 'stage piano', 'music'] }),
  P({ id: 'nord-electro-6', brand: 'Nord', name: 'Electro 6', category: 'activity', subcategory: 'music_keyboard', description: 'Stage keyboard for organ, piano and synth sounds', aliases: ['Nord Electro'], tags: ['keyboard', 'stage piano', 'music'] }),
  P({ id: 'korg-minilogue-xd', brand: 'Korg', name: 'Minilogue XD', category: 'activity', subcategory: 'music_synth', description: 'Four-voice polyphonic analog synthesizer', aliases: ['Minilogue XD'], tags: ['synthesizer', 'synth', 'keyboard', 'music'] }),
  P({ id: 'arturia-minilab-3', brand: 'Arturia', name: 'MiniLab 3', category: 'activity', subcategory: 'music_controller', description: 'Compact MIDI controller keyboard', aliases: ['MiniLab III'], tags: ['midi controller', 'keyboard', 'music production'] }),
  P({ id: 'ableton-push-3', brand: 'Ableton', name: 'Push 3', category: 'activity', subcategory: 'music_controller', description: 'Standalone instrument and Ableton Live controller', aliases: ['Ableton Push'], tags: ['midi controller', 'music production', 'controller'] }),
  P({ id: 'akai-mpk-mini-mk3', brand: 'Akai', name: 'MPK Mini MK3', category: 'activity', subcategory: 'music_controller', description: 'Compact MIDI keyboard controller', aliases: ['Akai MPK Mini 3'], tags: ['midi controller', 'keyboard', 'music production'] }),
  P({ id: 'focusrite-scarlett-solo-4th-gen', brand: 'Focusrite', name: 'Scarlett Solo 4th Gen', category: 'audio', subcategory: 'audio_interface', description: 'USB audio interface for solo creators', aliases: ['Scarlett Solo', 'Focusrite Solo'], tags: ['audio interface', 'recording interface', 'music'] }),
  P({ id: 'focusrite-scarlett-2i2-4th-gen', brand: 'Focusrite', name: 'Scarlett 2i2 4th Gen', category: 'audio', subcategory: 'audio_interface', description: 'Two-input USB audio interface', aliases: ['Scarlett 2i2', 'Focusrite 2i2'], tags: ['audio interface', 'recording interface', 'music'] }),
  P({ id: 'universal-audio-volt-2', brand: 'Universal Audio', name: 'Volt 2', category: 'audio', subcategory: 'audio_interface', description: 'Two-input USB audio interface', aliases: ['UA Volt 2'], tags: ['audio interface', 'recording interface', 'music'] }),
  P({ id: 'universal-audio-volt-276', brand: 'Universal Audio', name: 'Volt 276', category: 'audio', subcategory: 'audio_interface', description: 'USB audio interface with built-in compression', aliases: ['UA Volt 276'], tags: ['audio interface', 'recording interface', 'music'] }),
  P({ id: 'behringer-umc202hd', brand: 'Behringer', name: 'UMC202HD', category: 'audio', subcategory: 'audio_interface', description: 'Two-input USB audio interface', aliases: ['U-Phoria UMC202HD'], tags: ['audio interface', 'recording interface', 'music'] }),
  P({ id: 'marshall-dsl40cr', brand: 'Marshall', name: 'DSL40CR', category: 'activity', subcategory: 'music_amp', description: 'Tube combo guitar amplifier', aliases: ['Marshall DSL 40CR'], tags: ['guitar amp', 'amplifier', 'music'] }),
  P({ id: 'boss-katana-50-mk2', brand: 'Boss', name: 'Katana-50 MkII', category: 'activity', subcategory: 'music_amp', description: 'Modeling guitar amplifier', aliases: ['Katana 50', 'Boss Katana'], tags: ['guitar amp', 'amplifier', 'music'] }),
  P({ id: 'boss-gt-1000', brand: 'Boss', name: 'GT-1000', category: 'activity', subcategory: 'music_pedal', description: 'Guitar effects processor', aliases: ['Boss GT1000'], tags: ['effects pedal', 'guitar pedal', 'music'] }),
  P({ id: 'line-6-helix-floor', brand: 'Line 6', name: 'Helix Floor', category: 'activity', subcategory: 'music_pedal', description: 'Guitar amp and effects processor', aliases: ['Line6 Helix'], tags: ['effects pedal', 'guitar processor', 'music'] }),
  P({ id: 'pearl-masters-mct', brand: 'Pearl', name: 'Masters MCT', category: 'activity', subcategory: 'music_drums', description: 'Maple drum kit', aliases: ['Pearl Masters'], tags: ['drum kit', 'drums', 'music'] }),
  P({ id: 'roland-td-27kv2', brand: 'Roland', name: 'TD-27KV2', category: 'activity', subcategory: 'music_drums', description: 'Electronic V-Drums kit', aliases: ['Roland TD27', 'TD 27KV2'], tags: ['electronic drums', 'drum kit', 'music'] }),
  P({ id: 'zildjian-a-custom-cymbal-pack', brand: 'Zildjian', name: 'A Custom Cymbal Pack', category: 'activity', subcategory: 'music_drums', description: 'Cymbal pack for drum kits', aliases: ['Zildjian A Custom'], tags: ['cymbal', 'drums', 'music'] }),
  P({ id: 'vic-firth-5a-american-classic', brand: 'Vic Firth', name: '5A American Classic', category: 'activity', subcategory: 'music_drums', description: 'Standard 5A drumsticks', aliases: ['Vic Firth 5A'], tags: ['drumsticks', 'drums', 'music'] }),
  P({ id: 'nord-triple-sustain-pedal', brand: 'Nord', name: 'Triple Sustain Pedal', category: 'power_accessories', subcategory: 'music_accessory', description: 'Triple pedal unit for Nord keyboards', aliases: ['Nord pedal'], tags: ['sustain pedal', 'piano pedal', 'keyboard'] }),

  P({ id: 'garmin-edge-540', brand: 'Garmin', name: 'Edge 540', category: 'activity', subcategory: 'cycling_computer', description: 'GPS cycling computer for training and navigation', aliases: ['Edge540', 'Garmin bike computer'], tags: ['cycling computer', 'gps bike', 'bike computer', 'cycling'] }),
  P({ id: 'garmin-edge-840', brand: 'Garmin', name: 'Edge 840', category: 'activity', subcategory: 'cycling_computer', description: 'GPS cycling computer with touchscreen', aliases: ['Edge840', 'Garmin bike computer'], tags: ['cycling computer', 'gps bike', 'bike computer', 'cycling'] }),
  P({ id: 'garmin-edge-1040-solar', brand: 'Garmin', name: 'Edge 1040 Solar', category: 'activity', subcategory: 'cycling_computer', description: 'Premium GPS cycling computer with solar charging', aliases: ['Edge1040 Solar', 'Garmin Edge 1040'], tags: ['cycling computer', 'gps bike', 'bike computer', 'cycling'] }),
  P({ id: 'garmin-edge-1050', brand: 'Garmin', name: 'Edge 1050', category: 'activity', subcategory: 'cycling_computer', description: 'Premium cycling computer with bright display', aliases: ['Edge1050', 'Garmin bike computer'], tags: ['cycling computer', 'gps bike', 'bike computer', 'cycling'] }),
  P({ id: 'wahoo-elemnt-bolt-v2', brand: 'Wahoo', name: 'ELEMNT BOLT v2', category: 'activity', subcategory: 'cycling_computer', description: 'Compact GPS cycling computer', aliases: ['Wahoo Bolt', 'Elemnt Bolt', 'Bolt v2'], tags: ['cycling computer', 'gps bike', 'bike computer', 'cycling'] }),
  P({ id: 'wahoo-elemnt-roam-v2', brand: 'Wahoo', name: 'ELEMNT ROAM v2', category: 'activity', subcategory: 'cycling_computer', description: 'GPS cycling computer for navigation', aliases: ['Wahoo Roam', 'Elemnt Roam', 'Roam v2'], tags: ['cycling computer', 'gps bike', 'bike computer', 'cycling'] }),
  P({ id: 'hammerhead-karoo', brand: 'Hammerhead', name: 'Karoo', category: 'activity', subcategory: 'cycling_computer', description: 'Android-based cycling computer', aliases: ['Hammerhead Karoo 3', 'Karoo bike computer'], tags: ['cycling computer', 'gps bike', 'bike computer', 'cycling'] }),
  P({ id: 'canyon-bike', brand: 'Canyon', name: 'Grail 7', category: 'activity', subcategory: 'cycling_bike', description: 'Gravel bike for mixed-surface riding', aliases: ['Canyon Grail'], tags: ['bike', 'gravel bike', 'cycling'] }),
  P({ id: 'trek-bike', brand: 'Trek', name: 'Domane SL 6', category: 'activity', subcategory: 'cycling_bike', description: 'Endurance road bike', aliases: ['Trek Domane'], tags: ['bike', 'road bike', 'cycling'] }),
  P({ id: 'specialized-bike', brand: 'Specialized', name: 'Tarmac SL8', category: 'activity', subcategory: 'cycling_bike', description: 'Lightweight road racing bike', aliases: ['Specialized Tarmac'], tags: ['bike', 'road bike', 'cycling'] }),
  P({ id: 'specialized-epic-evo', brand: 'Specialized', name: 'Epic EVO', category: 'activity', subcategory: 'cycling_bike', description: 'Cross-country mountain bike', aliases: ['Specialized Epic'], tags: ['bike', 'mountain bike', 'xc bike', 'cycling'] }),
  P({ id: 'canyon-spectral-cf-8', brand: 'Canyon', name: 'Spectral CF 8', category: 'activity', subcategory: 'cycling_bike', description: 'Full-suspension trail mountain bike', aliases: ['Canyon Spectral'], tags: ['bike', 'mountain bike', 'trail bike', 'cycling'] }),
  P({ id: 'santa-cruz-hightower', brand: 'Santa Cruz', name: 'Hightower', category: 'activity', subcategory: 'cycling_bike', description: 'Trail mountain bike', aliases: ['Santa Cruz Hightower'], tags: ['bike', 'mountain bike', 'trail bike', 'cycling'] }),
  P({ id: 'trek-fuel-ex-9-8', brand: 'Trek', name: 'Fuel EX 9.8', category: 'activity', subcategory: 'cycling_bike', description: 'Trail mountain bike', aliases: ['Trek Fuel EX'], tags: ['bike', 'mountain bike', 'trail bike', 'cycling'] }),
  P({ id: 'giant-anthem-advanced-pro-29', brand: 'Giant', name: 'Anthem Advanced Pro 29', category: 'activity', subcategory: 'cycling_bike', description: 'XC race mountain bike', aliases: ['Giant Anthem'], tags: ['bike', 'mountain bike', 'xc bike', 'cycling'] }),
  P({ id: 'orbea-terra-m30', brand: 'Orbea', name: 'Terra M30', category: 'activity', subcategory: 'cycling_bike', description: 'Gravel bike', aliases: ['Orbea Terra'], tags: ['bike', 'gravel bike', 'cycling'] }),
  P({ id: 'shimano-ultegra-r8100-di2', brand: 'Shimano', name: 'Ultegra R8100 Di2', category: 'activity', subcategory: 'cycling_drivetrain', description: 'Electronic road bike groupset', aliases: ['Ultegra Di2'], tags: ['groupset', 'electronic shifting', 'cycling'] }),
  P({ id: 'shimano-105-r7100-di2', brand: 'Shimano', name: '105 R7100 Di2', category: 'activity', subcategory: 'cycling_drivetrain', description: 'Electronic road bike groupset', aliases: ['Shimano 105 Di2'], tags: ['groupset', 'electronic shifting', 'cycling'] }),
  P({ id: 'sram-red-axs', brand: 'SRAM', name: 'RED AXS', category: 'activity', subcategory: 'cycling_drivetrain', description: 'Wireless road bike groupset', aliases: ['SRAM Red'], tags: ['groupset', 'wireless shifting', 'cycling'] }),
  P({ id: 'sram-force-axs', brand: 'SRAM', name: 'Force AXS', category: 'activity', subcategory: 'cycling_drivetrain', description: 'Wireless road bike groupset', aliases: ['SRAM Force'], tags: ['groupset', 'wireless shifting', 'cycling'] }),
  P({ id: 'poc-helmet', brand: 'POC', name: 'Omne Air', category: 'activity', subcategory: 'helmet', description: 'Road cycling helmet', aliases: ['POC Omne'], tags: ['helmet', 'cycling helmet', 'cycling'] }),
  P({ id: 'poc-kortal-race-mips', brand: 'POC', name: 'Kortal Race MIPS', category: 'activity', subcategory: 'helmet', description: 'Mountain bike helmet', aliases: ['POC Kortal'], tags: ['helmet', 'mtb helmet', 'cycling helmet'] }),
  P({ id: 'smith-network-mips', brand: 'Smith', name: 'Network MIPS', category: 'activity', subcategory: 'helmet', description: 'Cycling helmet with MIPS technology', aliases: ['Smith Network'], tags: ['helmet', 'cycling helmet', 'mips'] }),
  P({ id: 'bell-super-air-r-mips', brand: 'Bell', name: 'Super Air R MIPS', category: 'activity', subcategory: 'helmet', description: 'Convertible mountain bike helmet', aliases: ['Bell Super Air R'], tags: ['helmet', 'mtb helmet', 'full face helmet'] }),
  P({ id: 'giro-source-mips', brand: 'Giro', name: 'Source MIPS', category: 'activity', subcategory: 'helmet', description: 'Trail mountain bike helmet', aliases: ['Giro Source'], tags: ['helmet', 'mtb helmet', 'cycling helmet'] }),
  P({ id: 'five-ten-shoes', brand: 'Five Ten', name: 'Freerider Pro', category: 'activity', subcategory: 'cycling_shoes', description: 'Flat pedal mountain biking shoes', aliases: ['Adidas Five Ten Freerider'], tags: ['shoes', 'mtb shoes', 'cycling shoes'] }),
  P({ id: 'fox-suspension', brand: 'Fox', name: '38 Fork', category: 'activity', subcategory: 'cycling_suspension', description: 'Mountain bike suspension fork', aliases: ['Fox 38'], tags: ['suspension', 'fork', 'mountain bike', 'cycling'] }),

  P({ id: 'garmin-forerunner-965', brand: 'Garmin', name: 'Forerunner 965', category: 'activity', subcategory: 'sports_watch', description: 'Premium GPS running watch', aliases: ['Forerunner965', 'Garmin running watch'], tags: ['gps watch', 'running watch', 'sports watch'] }),
  P({ id: 'garmin-forerunner-265', brand: 'Garmin', name: 'Forerunner 265', category: 'activity', subcategory: 'sports_watch', description: 'GPS running watch with AMOLED display', aliases: ['Forerunner265'], tags: ['gps watch', 'running watch', 'sports watch'] }),
  P({ id: 'garmin-fenix-7-pro', brand: 'Garmin', name: 'Fenix 7 Pro', category: 'activity', subcategory: 'sports_watch', description: 'Multisport GPS smartwatch', aliases: ['Fenix 7', 'Garmin Fenix'], tags: ['gps watch', 'sports watch', 'outdoor watch'] }),
  P({ id: 'garmin-fenix-8', brand: 'Garmin', name: 'Fenix 8', category: 'activity', subcategory: 'sports_watch', description: 'Premium multisport GPS smartwatch', aliases: ['Garmin Fenix 8'], tags: ['gps watch', 'sports watch', 'outdoor watch'] }),
  P({ id: 'garmin-epix-pro-gen-2', brand: 'Garmin', name: 'Epix Pro Gen 2', category: 'activity', subcategory: 'sports_watch', description: 'Premium AMOLED multisport watch', aliases: ['Garmin Epix Pro'], tags: ['gps watch', 'sports watch', 'outdoor watch'] }),
  P({ id: 'garmin-instinct-2-solar', brand: 'Garmin', name: 'Instinct 2 Solar', category: 'activity', subcategory: 'sports_watch', description: 'Rugged GPS smartwatch with solar charging', aliases: ['Garmin Instinct'], tags: ['gps watch', 'outdoor watch', 'hiking'] }),
  P({ id: 'polar-vantage-v3', brand: 'Polar', name: 'Vantage V3', category: 'activity', subcategory: 'sports_watch', description: 'Advanced multisport GPS watch', aliases: ['Polar Vantage'], tags: ['gps watch', 'running watch', 'sports watch'] }),
  P({ id: 'polar-grit-x2-pro', brand: 'Polar', name: 'Grit X2 Pro', category: 'activity', subcategory: 'sports_watch', description: 'Outdoor multisport GPS watch', aliases: ['Polar Grit'], tags: ['gps watch', 'outdoor watch', 'sports watch'] }),
  P({ id: 'suunto-race', brand: 'Suunto', name: 'Race', category: 'activity', subcategory: 'sports_watch', description: 'GPS sports watch with AMOLED display', aliases: ['Suunto Race watch'], tags: ['gps watch', 'running watch', 'sports watch'] }),
  P({ id: 'suunto-vertical', brand: 'Suunto', name: 'Vertical', category: 'activity', subcategory: 'sports_watch', description: 'Adventure GPS watch', aliases: ['Suunto Vertical watch'], tags: ['gps watch', 'outdoor watch', 'sports watch'] }),
  P({ id: 'coros-apex-2-pro', brand: 'COROS', name: 'APEX 2 Pro', category: 'activity', subcategory: 'sports_watch', description: 'Ultra-running GPS watch', aliases: ['Coros Apex Pro 2'], tags: ['gps watch', 'running watch', 'sports watch'] }),
  P({ id: 'coros-pace-3', brand: 'COROS', name: 'PACE 3', category: 'activity', subcategory: 'sports_watch', description: 'Lightweight GPS sport watch', aliases: ['Coros Pace'], tags: ['gps watch', 'running watch', 'sports watch'] }),
  P({ id: 'apple-watch-ultra-2', brand: 'Apple', name: 'Watch Ultra 2', category: 'activity', subcategory: 'sports_watch', description: 'Rugged smartwatch for outdoor activities', aliases: ['Apple Watch Ultra'], tags: ['sports watch', 'outdoor watch', 'smartwatch'] }),
  P({ id: 'garmin-inreach-mini-2', brand: 'Garmin', name: 'inReach Mini 2', category: 'activity', subcategory: 'outdoor_gps', description: 'Compact satellite communicator for outdoor adventures', aliases: ['Garmin InReach'], tags: ['gps device', 'satellite communicator', 'hiking'] }),
  P({ id: 'garmin-etrex-se', brand: 'Garmin', name: 'eTrex SE', category: 'activity', subcategory: 'outdoor_gps', description: 'Handheld GPS device for hiking and navigation', aliases: ['Garmin eTrex'], tags: ['gps device', 'hiking', 'outdoor navigation'] }),
  P({ id: 'garmin-montana-700', brand: 'Garmin', name: 'Montana 700', category: 'activity', subcategory: 'outdoor_gps', description: 'Rugged handheld GPS navigator', aliases: ['Garmin Montana'], tags: ['gps device', 'hiking', 'outdoor navigation'] }),
  P({ id: 'smith-maze-mips', brand: 'Smith', name: 'Maze MIPS', category: 'activity', subcategory: 'snow_helmet', description: 'Snow helmet with MIPS protection', aliases: ['Smith Maze'], tags: ['ski helmet', 'snowboard helmet', 'snow sports'] }),
  P({ id: 'salomon-qst-92', brand: 'Salomon', name: 'QST 92', category: 'activity', subcategory: 'ski', description: 'All-mountain ski', aliases: ['Salomon QST'], tags: ['ski', 'snow sports', 'all mountain ski'] }),
  P({ id: 'atomic-bent-100', brand: 'Atomic', name: 'Bent 100', category: 'activity', subcategory: 'ski', description: 'All-mountain freeride ski', aliases: ['Atomic Bent'], tags: ['ski', 'snow sports', 'freeride ski'] }),
  P({ id: 'jones-flagship', brand: 'Jones', name: 'Flagship', category: 'activity', subcategory: 'snowboard', description: 'All-mountain snowboard', aliases: ['Jones Flagship snowboard'], tags: ['snowboard', 'snow sports'] }),

  P({ id: 'bosch-gsb-18v-55', brand: 'Bosch Professional', name: 'GSB 18V-55', category: 'activity', subcategory: 'tool_drill', description: 'Cordless combi drill for workshop and craft projects', aliases: ['Bosch GSB 18V 55', 'Bosch drill'], tags: ['drill', 'driver', 'workshop tool', 'crafts'] }),
  P({ id: 'bosch-gsr-18v-90-c', brand: 'Bosch Professional', name: 'GSR 18V-90 C', category: 'activity', subcategory: 'tool_drill', description: 'Cordless drill driver for workshop use', aliases: ['Bosch GSR 18V 90 C', 'Bosch drill'], tags: ['drill', 'driver', 'workshop tool', 'crafts'] }),
  P({ id: 'bosch-gws-18v-10', brand: 'Bosch Professional', name: 'GWS 18V-10', category: 'activity', subcategory: 'tool_grinder', description: 'Cordless angle grinder', aliases: ['Bosch angle grinder'], tags: ['grinder', 'workshop tool', 'crafts'] }),
  P({ id: 'bosch-gst-18v-155-sc', brand: 'Bosch Professional', name: 'GST 18V-155 SC', category: 'activity', subcategory: 'tool_saw', description: 'Cordless jigsaw for workshop projects', aliases: ['Bosch jigsaw'], tags: ['jigsaw', 'saw', 'workshop tool', 'crafts'] }),
  P({ id: 'makita-dhp486', brand: 'Makita', name: 'DHP486', category: 'activity', subcategory: 'tool_drill', description: 'Cordless hammer driver drill', aliases: ['Makita drill', 'DHP486Z'], tags: ['drill', 'driver', 'workshop tool', 'crafts'] }),
  P({ id: 'makita-dtd172', brand: 'Makita', name: 'DTD172', category: 'activity', subcategory: 'tool_driver', description: 'Cordless impact driver', aliases: ['Makita impact driver'], tags: ['impact driver', 'driver', 'workshop tool', 'crafts'] }),
  P({ id: 'makita-dga504', brand: 'Makita', name: 'DGA504', category: 'activity', subcategory: 'tool_grinder', description: 'Cordless angle grinder', aliases: ['Makita grinder'], tags: ['grinder', 'workshop tool', 'crafts'] }),
  P({ id: 'makita-dsp600', brand: 'Makita', name: 'DSP600', category: 'activity', subcategory: 'tool_saw', description: 'Cordless plunge cut saw', aliases: ['Makita track saw'], tags: ['saw', 'track saw', 'workshop tool', 'crafts'] }),
  P({ id: 'dewalt-dcd796', brand: 'DeWalt', name: 'DCD796', category: 'activity', subcategory: 'tool_drill', description: 'Cordless hammer drill driver', aliases: ['DeWalt drill'], tags: ['drill', 'driver', 'workshop tool', 'crafts'] }),
  P({ id: 'dewalt-dcf887', brand: 'DeWalt', name: 'DCF887', category: 'activity', subcategory: 'tool_driver', description: 'Cordless impact driver', aliases: ['DeWalt impact driver'], tags: ['impact driver', 'driver', 'workshop tool', 'crafts'] }),
  P({ id: 'dewalt-dwe7492', brand: 'DeWalt', name: 'DWE7492', category: 'activity', subcategory: 'tool_saw', description: 'Portable table saw', aliases: ['DeWalt table saw'], tags: ['table saw', 'saw', 'workshop tool', 'crafts'] }),
  P({ id: 'dewalt-dcs355', brand: 'DeWalt', name: 'DCS355', category: 'activity', subcategory: 'tool_multitool', description: 'Cordless oscillating multi-tool', aliases: ['DeWalt multi tool'], tags: ['multi tool', 'workshop tool', 'crafts'] }),
  P({ id: 'milwaukee-m18-fuel-drill-driver', brand: 'Milwaukee', name: 'M18 FUEL Drill Driver', category: 'activity', subcategory: 'tool_drill', description: 'Cordless drill driver for workshop use', aliases: ['Milwaukee M18 drill'], tags: ['drill', 'driver', 'workshop tool', 'crafts'] }),
  P({ id: 'milwaukee-m18-fuel-impact-driver', brand: 'Milwaukee', name: 'M18 FUEL Impact Driver', category: 'activity', subcategory: 'tool_driver', description: 'Cordless impact driver', aliases: ['Milwaukee M18 impact'], tags: ['impact driver', 'driver', 'workshop tool', 'crafts'] }),
  P({ id: 'milwaukee-m12-fuel-installation-driver', brand: 'Milwaukee', name: 'M12 FUEL Installation Driver', category: 'activity', subcategory: 'tool_driver', description: 'Compact installation driver', aliases: ['Milwaukee installation driver'], tags: ['driver', 'workshop tool', 'crafts'] }),
  P({ id: 'festool-ts-55-febq', brand: 'Festool', name: 'TS 55 FEBQ', category: 'activity', subcategory: 'tool_saw', description: 'Precision plunge-cut track saw', aliases: ['Festool TS55', 'Festool track saw'], tags: ['track saw', 'saw', 'workshop tool', 'crafts'] }),
  P({ id: 'festool-domino-df-500', brand: 'Festool', name: 'DOMINO DF 500', category: 'activity', subcategory: 'tool_joiner', description: 'Mortise joiner for woodworking', aliases: ['Festool Domino'], tags: ['joiner', 'woodworking tool', 'crafts'] }),
  P({ id: 'festool-rotex-ro-150', brand: 'Festool', name: 'ROTEX RO 150', category: 'activity', subcategory: 'tool_sander', description: 'Geared eccentric sander', aliases: ['Festool Rotex'], tags: ['sander', 'woodworking tool', 'crafts'] }),
  P({ id: 'dremel-3000', brand: 'Dremel', name: '3000', category: 'activity', subcategory: 'tool_rotary', description: 'Rotary tool for craft and workshop detail work', aliases: ['Dremel rotary tool'], tags: ['rotary tool', 'workshop tool', 'crafts'] }),
  P({ id: 'dremel-8220', brand: 'Dremel', name: '8220', category: 'activity', subcategory: 'tool_rotary', description: 'Cordless rotary tool', aliases: ['Dremel cordless'], tags: ['rotary tool', 'workshop tool', 'crafts'] }),
  P({ id: 'ryobi-one-plus-drill-driver', brand: 'Ryobi', name: 'ONE+ Drill Driver', category: 'activity', subcategory: 'tool_drill', description: 'Cordless drill driver for DIY projects', aliases: ['Ryobi drill'], tags: ['drill', 'driver', 'workshop tool', 'crafts'] }),
];

/**
 * Seed the products collection.
 * Idempotent per product: creates missing products and merges aliases/tags/search terms into existing ones.
 * Must be called explicitly — never runs automatically.
 */
export async function seedProductsCollection() {
  console.log('[seedProducts] Starting seed...');
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const productData of seedProducts) {
    try {
      const { id, ...data } = productData;
      const docRef = doc(collection(db, PRODUCTS_COLLECTION), id);
      const existing = await getDoc(docRef);

      if (existing.exists()) {
        const current = existing.data();
        const merged = {
          ...data,
          aliases: unique([...(current.aliases ?? []), ...(data.aliases ?? [])]),
          tags: unique([...(current.tags ?? []), ...(data.tags ?? [])]),
          searchTerms: unique([...(current.searchTerms ?? []), ...(data.searchTerms ?? [])]),
          updatedAt: serverTimestamp(),
        };
        await setDoc(docRef, merged, { merge: true });
        updated++;
        continue;
      }

      await setDoc(docRef, {
        ...data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      created++;
      console.log(`[seedProducts] Created ${productData.brand} ${productData.name}`);
    } catch (error) {
      skipped++;
      console.error(`[seedProducts] Error on ${productData.id}:`, error);
    }
  }

  console.log(`[seedProducts] Done — ${created} created, ${updated} updated, ${skipped} skipped`);
  return { success: true, created, updated, skipped };
}

export default seedProductsCollection;
