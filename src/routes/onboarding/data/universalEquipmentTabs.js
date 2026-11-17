// Universal filter tabs for the equipment step.
// Each tab filters suggestions by one of two mechanisms:
//  - dataCategories: matches item.category (the 5 Firestore categories).
//  - keywords: fallback regex tested against brand/model/equipmentType.
//
// Tabs are display-only. The underlying creatorEquipment schema is unchanged.
import {
  Camera,
  Mic,
  Guitar,
  Wrench,
  Mountain,
  Shirt,
  Package,
  BatteryCharging,
  CookingPot,
} from 'lucide-react';
import { inferEquipmentVisualCategory } from './equipmentIcons.js';

export const UNIVERSAL_TABS = [
  {
    id: 'cameras',
    labelKey: 'onboarding.equipment.universalTabs.cameras',
    icon: Camera,
    dataCategories: ['recording'],
    keywords: /\b(camera|cam|gopro|drone|lens|tripod|gimbal|mount|dashcam)\b/i,
  },
  {
    id: 'audio',
    labelKey: 'onboarding.equipment.universalTabs.audio',
    icon: Mic,
    dataCategories: ['audio'],
    keywords: /\b(mic|headphone|speaker|audio|interface|monitor|pa\b|amplifier|amp)\b/i,
  },
  {
    id: 'instruments',
    labelKey: 'onboarding.equipment.universalTabs.instruments',
    icon: Guitar,
    dataCategories: [],
    keywords: /\b(guitar|bass|drum|cymbal|piano|keyboard|synth|violin|saxophone|instrument|pedal|midi)\b/i,
  },
  {
    id: 'tools',
    labelKey: 'onboarding.equipment.universalTabs.tools',
    icon: Wrench,
    dataCategories: [],
    keywords: /\b(tool|drill|hammer|wrench|saw|knife|pan|utensil|chef|thermometer|mixer|kitchen|power tool)\b/i,
  },
  {
    id: 'outdoor',
    labelKey: 'onboarding.equipment.universalTabs.outdoor',
    icon: Mountain,
    dataCategories: [],
    keywords: /\b(backpack|boot|pole|tent|helmet|gps|compass|rod|reel|board|paddle|wing|wetsuit|life jacket)\b/i,
  },
  {
    id: 'cooking',
    labelKey: 'onboarding.equipment.universalTabs.cooking',
    icon: CookingPot,
    dataCategories: [],
    keywords: /\b(cooking|kitchen|knife|pan|cookware|mixer|oven)\b/i,
  },
  {
    id: 'clothing',
    labelKey: 'onboarding.equipment.universalTabs.clothing',
    icon: Shirt,
    dataCategories: [],
    keywords: /\b(jacket|coat|parka|pant|short|tee|t-shirt|shirt|hoodie|sweater|glove|hat|cap|turnout|apparel|footwear)\b/i,
  },
  {
    id: 'accessories',
    labelKey: 'onboarding.equipment.universalTabs.accessories',
    icon: BatteryCharging,
    dataCategories: ['power_accessories'],
    keywords: /\b(battery|charger|cable|adapter|memory|sd|watch|lighting|headlamp|power bank|portable power)\b/i,
  },
  {
    id: 'other',
    labelKey: 'onboarding.equipment.universalTabs.other',
    icon: Package,
    dataCategories: [],
    keywords: null,
  },
];

/**
 * Does this item belong to the given universal tab?
 * - Explicit dataCategories match wins first.
 * - Then keyword regex against item text.
 * - 'all' matches everything.
 * - 'other' matches items with no dataCategory coverage and no keyword hit.
 */
export function matchesUniversalTab(item, tabId) {
  if (!tabId || tabId === 'all') return true;
  const tab = UNIVERSAL_TABS.find((t) => t.id === tabId);
  if (!tab) return true;
  const visual = inferEquipmentVisualCategory(item);
  if (tabId === 'accessories') return visual === 'accessories' || visual === 'energy';
  return visual === tabId;
}

export function universalTabForCategory(dataCategory) {
  const tab = UNIVERSAL_TABS.find((t) => t.dataCategories.includes(dataCategory));
  return tab?.id || 'other';
}
