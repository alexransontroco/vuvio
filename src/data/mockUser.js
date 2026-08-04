import { streams } from './mockStreams.js';

export const currentUser = {
  name: 'Marius',
  location: 'Traveling from Lyon, France',
  initial: 'M',
  stats: [
    { label: 'lives watched', value: '42' },
    { label: 'countries', value: '17' },
    { label: 'following', value: '12' },
  ],
  history: streams.slice(1, 4),
};
