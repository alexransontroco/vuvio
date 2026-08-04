import { enrichExperience } from './experienceTaxonomy.js';

export const MARKER_TYPES = {
  standard: 'standard',
  sponsored: 'sponsored',
  vuvio: 'vuvio',
};

const MAX_SPONSORED_VISIBLE = 3;
const MAX_VUVIO_VISIBLE = 3;

function viewersNumber(stream) {
  if (!stream?.viewers) return 0;
  return Number.parseInt(String(stream.viewers).replace(/\D/g, ''), 10) || 0;
}

function stableSeed(id) {
  let hash = 0;
  const value = String(id ?? '');
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) % 10007;
  }
  return hash / 10007;
}

function isWaterOrTravelFamily(stream) {
  return ['water', 'air'].includes(stream?.family);
}

function scoreSponsored(stream) {
  const viewers = Math.min(1, viewersNumber(stream) / 2500);
  const familyBoost = isWaterOrTravelFamily(stream) ? 0.5 : 0.15;
  const featuredBoost = stream.featured ? 0.25 : 0;
  const seedBoost = stableSeed(stream.id) * 0.12;
  return viewers * 0.58 + familyBoost + featuredBoost + seedBoost;
}

function scoreVuvio(stream) {
  const viewers = Math.min(1, viewersNumber(stream) / 1800);
  const featuredBoost = stream.featured ? 0.72 : 0.2;
  const familyBoost = stream.family === 'water' ? 0.2 : 0.08;
  const seedBoost = stableSeed(`${stream.id}-vuvio`) * 0.18;
  return viewers * 0.3 + featuredBoost + familyBoost + seedBoost;
}

export function isNearUser(live, userContext) {
  if (!userContext?.center || !Array.isArray(live?.coordinates)) return false;
  const [lng, lat] = live.coordinates;
  const dx = Math.abs((((lng - userContext.center[0]) + 540) % 360) - 180);
  const dy = Math.abs(lat - userContext.center[1]);
  return Math.sqrt(dx * dx + dy * dy) < 28;
}

export function matchesUserInterest(live, userContext) {
  if (!Array.isArray(userContext?.interests) || userContext.interests.length === 0) return false;
  const text = `${live.family} ${live.subcategory ?? ''} ${live.category ?? ''} ${live.job ?? ''}`.toLowerCase();
  return userContext.interests.some((interest) => text.includes(String(interest).toLowerCase()));
}

export function isTrending(live) {
  return viewersNumber(live) >= 1200 || live.featured === true;
}

export function isSpecialEvent(live) {
  const text = `${live.title ?? ''} ${live.experienceTitle ?? ''}`.toLowerCase();
  return text.includes('special') || text.includes('festival') || text.includes('expo') || text.includes('edition');
}

export function isRelevantOutsideFilter(live, userContext) {
  return isNearUser(live, userContext) || matchesUserInterest(live, userContext) || isTrending(live) || isSpecialEvent(live);
}

export function shouldFeatureEditorially(live, userContext) {
  if (live.featured) return true;
  return matchesUserInterest(live, userContext) || isNearUser(live, userContext) || viewersNumber(live) >= 900;
}

function chooseTopLives(lives, scoreFn, limit, excludedIds = new Set()) {
  return [...lives]
    .filter((live) => !excludedIds.has(live.id))
    .sort((a, b) => scoreFn(b) - scoreFn(a))
    .slice(0, limit);
}

export function decorateGlobeTest3Streams(streams, userContext = {}) {
  const liveStreams = streams
    .map(enrichExperience)
    .filter((stream) => stream.status === 'live' && Array.isArray(stream.coordinates))
    .map((stream) => ({
      ...stream,
      markerType: MARKER_TYPES.standard,
      sponsoredReason: null,
      featuredReason: null,
    }));

  const sponsored = chooseTopLives(
    liveStreams.filter((stream) => isWaterOrTravelFamily(stream) || viewersNumber(stream) >= 700),
    (stream) => scoreSponsored(stream) + (isRelevantOutsideFilter(stream, userContext) ? 0.2 : 0),
    MAX_SPONSORED_VISIBLE,
  );

  const sponsoredIds = new Set(sponsored.map((stream) => stream.id));
  sponsored.forEach((stream) => {
    stream.markerType = MARKER_TYPES.sponsored;
    stream.sponsoredReason = isNearUser(stream, userContext)
      ? 'Near you'
      : matchesUserInterest(stream, userContext)
        ? 'Matches your interests'
        : isTrending(stream)
          ? 'Trending'
          : 'Editorial relevance';
  });

  const vuvio = chooseTopLives(
    liveStreams.filter((stream) => stream.featured || viewersNumber(stream) >= 800),
    (stream) => scoreVuvio(stream) + (shouldFeatureEditorially(stream, userContext) ? 0.15 : 0),
    MAX_VUVIO_VISIBLE,
    sponsoredIds,
  );

  vuvio.forEach((stream) => {
    if (sponsoredIds.has(stream.id)) return;
    stream.markerType = MARKER_TYPES.vuvio;
    stream.featuredReason = stream.featured ? 'Selected by Vuvio' : 'Editorial pick';
  });

  return liveStreams;
}

export { MAX_SPONSORED_VISIBLE, MAX_VUVIO_VISIBLE };
