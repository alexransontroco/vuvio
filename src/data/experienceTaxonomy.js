export const EXPERIENCE_FAMILIES = {
  air: {
    id: 'air',
    label: 'Air',
    color: '#3B5AFF',
    glow: 'rgba(59, 90, 255, 0.26)',
    shape: 'diamond',
    altitudeOffset: 12,
    description: 'Drone, airplane, helicopter, paragliding',
    subcategories: ['Drone', 'Airplane', 'Helicopter', 'Paragliding', 'Hot-air balloon', 'Wingsuit'],
  },
  earth: {
    id: 'earth',
    label: 'Land',
    color: '#45B86B',
    glow: 'rgba(69, 184, 107, 0.24)',
    shape: 'circle',
    altitudeOffset: 0,
    description: 'Walking, work, cycling, cooking',
    subcategories: ['Hiking', 'Walking', 'Cooking', 'Work', 'Bicycle', 'Mountain bike', 'Construction', 'Agriculture', 'Tour', 'Transport', 'Concert'],
  },
  water: {
    id: 'water',
    label: 'Water',
    color: '#2AB8C8',
    glow: 'rgba(42, 184, 200, 0.24)',
    shape: 'drop',
    altitudeOffset: -2,
    description: 'Sailboat, surfing, diving, fishing',
    subcategories: ['Sailboat', 'Boat', 'Kayak', 'Surfing', 'Diving', 'Paddleboarding', 'Fishing'],
  },
};

export const EXPERIENCE_FILTERS = [
  { id: 'all', label: 'All' },
  EXPERIENCE_FAMILIES.air,
  EXPERIENCE_FAMILIES.earth,
  EXPERIENCE_FAMILIES.water,
];

export const POV_TYPES = {
  pov: { id: 'pov', label: 'POV', icon: '👤' },
  drone: { id: 'drone', label: 'Drone', icon: '✦' },
  vehicle: { id: 'vehicle', label: 'Vehicle', icon: '▻' },
  marine: { id: 'marine', label: 'Water', icon: '≈' },
  fixed: { id: 'fixed', label: 'Fixed', icon: '•' },
};

const jobExperienceMap = {
  'Mountain biker': ['earth', 'Mountain bike', 'vehicle'],
  'Road cyclist': ['earth', 'Bicycle', 'vehicle'],
  'Motorcycle rider': ['earth', 'Vehicle', 'vehicle'],
  Longboarder: ['earth', 'Walking', 'vehicle'],
  'Buggy driver': ['earth', 'Vehicle', 'vehicle'],
  'Equestrian guide': ['earth', 'Hiking', 'pov'],
  'Urban runner': ['earth', 'Walking', 'pov'],
  'Dog trainer': ['earth', 'Work', 'pov'],
  'Sailing skipper': ['water', 'Sailboat', 'marine'],
  'Glacier guide': ['earth', 'Hiking', 'pov'],
  'Helicopter pilot': ['air', 'Helicopter', 'vehicle'],
  Fisherman: ['water', 'Fishing', 'marine'],
  Chef: ['earth', 'Cooking', 'pov'],
  Firefighter: ['earth', 'Work', 'pov'],
  Cabinetmaker: ['earth', 'Work', 'fixed'],
  Beekeeper: ['earth', 'Agriculture', 'pov'],
  Surgeon: ['earth', 'Work', 'fixed'],
  'Wildlife photographer': ['earth', 'Tour', 'pov'],
  'Train driver': ['earth', 'Vehicle', 'vehicle'],
  Potter: ['earth', 'Work', 'fixed'],
  Surfer: ['water', 'Surfing', 'marine'],
  'Drone pilot': ['air', 'Drone', 'drone'],
  Hiker: ['earth', 'Hiking', 'pov'],
  Mountaineer: ['earth', 'Hiking', 'pov'],
  Paraglider: ['air', 'Paragliding', 'pov'],
  'Balloon pilot': ['air', 'Hot-air balloon', 'vehicle'],
  Architect: ['earth', 'Tour', 'fixed'],
  Baker: ['earth', 'Cooking', 'pov'],
  Barista: ['earth', 'Cooking', 'pov'],
  'Rooftop worker': ['earth', 'Construction', 'pov'],
  Electrician: ['earth', 'Work', 'fixed'],
  Welder: ['earth', 'Construction', 'fixed'],
  Mechanic: ['earth', 'Work', 'fixed'],
  'Scuba diver': ['water', 'Diving', 'marine'],
  Kayaker: ['water', 'Kayak', 'marine'],
  Caver: ['earth', 'Tour', 'pov'],
  'Night photographer': ['earth', 'Tour', 'fixed'],
  'Mountain rescue pilot': ['air', 'Helicopter', 'vehicle'],
  'Rally driver': ['earth', 'Transport', 'vehicle'],
  'Harvester driver': ['earth', 'Agriculture', 'vehicle'],
  'High-voltage technician': ['earth', 'Construction', 'pov'],
  Volcanologist: ['earth', 'Hiking', 'pov'],
  'Big wall climber': ['earth', 'Hiking', 'pov'],
  'Antarctic scientist': ['earth', 'Tour', 'fixed'],
  'Sea rescuer': ['water', 'Boat', 'marine'],
  Luthier: ['earth', 'Work', 'fixed'],
  Jeweler: ['earth', 'Work', 'fixed'],
  Falconer: ['earth', 'Work', 'pov'],
  'Oil platform worker': ['water', 'Boat', 'fixed'],
  'Space controller': ['air', 'Airplane', 'fixed'],
  Cinematographer: ['earth', 'Work', 'pov'],
  'Ice diver': ['water', 'Diving', 'marine'],
  'TGV driver': ['earth', 'Transport', 'vehicle'],
  'Rafting guide': ['water', 'Kayak', 'marine'],
  Jockey: ['earth', 'Transport', 'pov'],
  'Wingsuit pilot': ['air', 'Wingsuit', 'pov'],
  'Rescue drone pilot': ['air', 'Drone', 'drone'],
};

export function getFamily(familyId) {
  return EXPERIENCE_FAMILIES[familyId] ?? EXPERIENCE_FAMILIES.earth;
}

export function getPovType(typeId) {
  return POV_TYPES[typeId] ?? POV_TYPES.pov;
}

export function enrichExperience(stream) {
  const fallback = jobExperienceMap[stream.job] ?? ['earth', 'Tour', 'pov'];
  const familyId = stream.family ?? fallback[0];
  const family = getFamily(familyId);
  const subcategory = stream.subcategory ?? fallback[1];
  const povType = stream.povType ?? fallback[2];

  return {
    ...stream,
    family: family.id,
    familyLabel: family.label,
    familyColor: family.color,
    familyShape: family.shape,
    altitudeOffset: stream.altitudeOffset ?? family.altitudeOffset,
    subcategory,
    povType,
    povLabel: getPovType(povType).label,
    povIcon: getPovType(povType).icon,
    experienceTitle: stream.experienceTitle ?? `Live ${subcategory}`,
  };
}
