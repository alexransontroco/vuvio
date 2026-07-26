import { Anchor, Bike, ChefHat, Fish, Flame, Hammer, Mountain, Music, Plane, Truck, Waves, Wheat, Zap } from 'lucide-react';

export const ACTIVITY_CATEGORIES = [
  {
    id: 'food',
    label: 'Food',
    icon: ChefHat,
    color: '#ff9a3d',
    subcategories: ['Cooking'],
  },
  {
    id: 'crafts',
    label: 'Crafts',
    icon: Hammer,
    color: '#ff824a',
    subcategories: ['Work', 'Construction'],
  },
  {
    id: 'transport',
    label: 'Transport',
    icon: Truck,
    color: '#3b8cff',
    subcategories: ['Transport', 'Tour'],
  },
  {
    id: 'farming',
    label: 'Farming',
    icon: Wheat,
    color: '#6fd15a',
    subcategories: ['Agriculture'],
  },
  {
    id: 'outdoor',
    label: 'Outdoor',
    icon: Mountain,
    color: '#54db68',
    subcategories: ['Hiking', 'Walking'],
  },
  {
    id: 'cycling',
    label: 'Cycling',
    icon: Bike,
    color: '#3be89a',
    subcategories: ['Bicycle', 'Mountain bike'],
  },
  {
    id: 'aviation',
    label: 'Aviation',
    icon: Plane,
    color: '#5b9fff',
    subcategories: ['Drone', 'Airplane', 'Helicopter', 'Paragliding', 'Hot-air balloon', 'Wingsuit'],
  },
  {
    id: 'sailing',
    label: 'Sailing',
    icon: Anchor,
    color: '#2ed4de',
    subcategories: ['Sailboat', 'Boat'],
  },
  {
    id: 'watersports',
    label: 'Water sports',
    icon: Waves,
    color: '#2bd9c8',
    subcategories: ['Surfing', 'Kayak', 'Paddleboarding', 'Diving'],
  },
  {
    id: 'fishing',
    label: 'Fishing',
    icon: Fish,
    color: '#48c1e9',
    subcategories: ['Fishing'],
  },
  {
    id: 'music',
    label: 'Music',
    icon: Music,
    color: '#c77dff',
    subcategories: ['Concert'],
  },
  {
    id: 'emergency',
    label: 'Emergency',
    icon: Flame,
    color: '#ff5252',
    subcategories: ['Work'],
  },
  {
    id: 'energy',
    label: 'Energy',
    icon: Zap,
    color: '#ffd600',
    subcategories: ['Work', 'Construction'],
  },
];

export const INITIAL_ACTIVITY_COUNT = 8;
