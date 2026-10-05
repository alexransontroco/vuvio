import { creatorProfiles } from '../data/creatorProfiles.js';
import { streams } from '../data/mockStreams.js';
import { ACTIVITY_CATEGORIES } from '../data/activityCategories.js';

export const CATEGORY_SEO = {
  music: {
    label: 'Music',
    title: 'Musique en direct - Musiciens et studios en POV | Vuvio',
    h1: 'Decouvrez la musique en direct',
    intro: 'Entrez dans les repetitions, studios, concerts et sessions de musiciens grace aux Lives POV de Vuvio.',
    match: ['music', 'concert', 'guitar', 'drums', 'piano', 'live music'],
  },
  cooking: {
    label: 'Cooking',
    title: 'Cuisine en direct - Chefs, boulangers et baristas en POV | Vuvio',
    h1: 'Decouvrez la cuisine en direct',
    intro: 'Suivez les gestes de chefs, boulangers, baristas et artisans culinaires en direct, au plus pres de leur travail.',
    match: ['cooking', 'cuisine', 'chef', 'baker', 'barista', 'food'],
  },
  craft: {
    label: 'Craft',
    title: 'Artisanat en direct - Savoir-faire et ateliers en POV | Vuvio',
    h1: 'Decouvrez l artisanat en direct',
    intro: 'Entrez dans les ateliers, chantiers et gestes de metiers avec des experiences POV tournees vers le savoir-faire.',
    match: ['craft', 'work', 'construction', 'potter', 'welder', 'mechanic', 'electrician', 'artisan'],
  },
  sport: {
    label: 'Sport',
    title: 'Sport en direct - Athletes et actions en POV | Vuvio',
    h1: 'Decouvrez le sport en direct',
    intro: 'Vivez les descentes, entrainements, rides et moments sportifs depuis le point de vue de ceux qui les pratiquent.',
    match: ['sport', 'cycling', 'climbing', 'running', 'wingsuit', 'ski', 'surfing'],
  },
  travel: {
    label: 'Travel',
    title: 'Voyages en direct - Lieux et experiences reelles en POV | Vuvio',
    h1: 'Decouvrez les voyages en direct',
    intro: 'Explorez des villes, routes, paysages et lieux de vie a travers des lives POV crees sur le terrain.',
    match: ['travel', 'tour', 'transport', 'city', 'explorer', 'guide'],
  },
  work: {
    label: 'Work',
    title: 'Metiers en direct - Travail reel et coulisses en POV | Vuvio',
    h1: 'Decouvrez les metiers en direct',
    intro: 'Observez des professionnels pendant leur vrai travail : gestes, lieux, outils et decisions en direct.',
    match: ['work', 'metiers', 'job', 'driver', 'firefighter', 'worker', 'pilot', 'architect'],
  },
  outdoor: {
    label: 'Outdoor',
    title: 'Outdoor en direct - Nature, montagne et eau en POV | Vuvio',
    h1: 'Decouvrez l outdoor en direct',
    intro: 'Suivez des experiences en montagne, sur l eau, dans les airs ou en pleine nature depuis un point de vue immersif.',
    match: ['outdoor', 'nature', 'hiking', 'water', 'sky', 'fishing', 'kayak', 'paragliding'],
  },
};

function textFields(item) {
  return [
    item.id,
    item.name,
    item.role,
    item.job,
    item.note,
    item.title,
    item.description,
    item.category,
    item.subcategory,
    item.family,
    item.environment,
    item.city,
    item.country,
  ].filter(Boolean).join(' ').toLowerCase();
}

export function getCategoryStreams(slug, limit = 18) {
  const config = CATEGORY_SEO[slug];
  if (!config) return [];
  return streams
    .filter((stream) => config.match.some((term) => textFields(stream).includes(term)))
    .slice(0, limit);
}

export function getPublicCategories() {
  return Object.entries(CATEGORY_SEO)
    .map(([slug, config]) => ({ slug, ...config, streams: getCategoryStreams(slug, 6) }))
    .filter((category) => category.streams.length > 0 || ACTIVITY_CATEGORIES.some((item) => item.id === slug));
}

export function findPublicStream(id) {
  if (!id) return null;
  const cleanId = String(id).replace(/-replay$/, '');
  return streams.find((stream) => stream.id === id || stream.id === cleanId) ?? null;
}

export function streamTitle(stream) {
  return stream?.note ?? stream?.title ?? stream?.experienceTitle ?? stream?.role ?? 'Live Vuvio';
}

export function streamCreator(stream) {
  return stream?.name ?? stream?.streamer ?? stream?.creatorName ?? 'Vuvio creator';
}

export function streamLocation(stream) {
  return [stream?.city, stream?.country].filter(Boolean).join(', ') || stream?.place || stream?.locationLabel || '';
}

export function streamDescription(stream) {
  const parts = [
    stream?.description,
    stream?.subcategory || stream?.category,
    streamCreator(stream),
    streamLocation(stream),
  ].filter(Boolean);
  return parts.join(' - ').slice(0, 180) || 'Experience POV en direct sur Vuvio.';
}

export function profileUrl(profile) {
  const id = profile?.id || profile?.username;
  return id ? `/profile/${encodeURIComponent(id)}` : '/profile';
}

export function profileDescription(profile) {
  return [
    profile?.bio,
    profile?.profession,
    [profile?.city, profile?.country].filter(Boolean).join(', '),
  ].filter(Boolean).join(' - ').slice(0, 180) || 'Profil createur Vuvio.';
}

export function getPublicProfiles() {
  return Object.values(creatorProfiles).filter((profile) => profile?.id && profile?.displayName);
}
