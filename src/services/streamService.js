import { categories, collections, streams, upcomingStreams } from '../data/mockStreams.js';

const delay = (value) => Promise.resolve(value);

export function getLiveStreams() {
  return delay(streams);
}

export function getStreamById(id) {
  return delay(streams.find((stream) => stream.id === id) ?? streams[0]);
}

export function getUpcomingStreams() {
  return delay(upcomingStreams);
}

export function getCollections() {
  return delay(collections);
}

export function getCategories() {
  return delay(categories);
}
