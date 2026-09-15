import { useEffect, useState } from 'react';
import { getScheduledStreams } from '../services/streamApi.ts';

type FirestoreTimestamp = { _seconds: number; _nanoseconds: number };

function timestampToIso(value: FirestoreTimestamp | string | null | undefined): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && '_seconds' in value) {
    return new Date(value._seconds * 1000).toISOString();
  }
  return null;
}

export type ScheduledStreamItem = {
  id: string;
  status: 'upcoming';
  startsAt: string;
  day: string;
  time: string;
  title: string;
  description: string | null;
  creatorName: string;
  creatorId: string;
  locationLabel: string;
  image: string;
  category: string;
  environment: string;
  interestedCount: number;
  isReal: true;
};

function toScheduledItem(raw: Record<string, unknown>): ScheduledStreamItem | null {
  const startsAt = timestampToIso(raw.scheduledStartAt as FirestoreTimestamp | string | null);
  if (!startsAt) return null;

  const date = new Date(startsAt);
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isToday = date.toDateString() === now.toDateString();
  const isTomorrow = date.toDateString() === tomorrow.toDateString();
  const day = isToday ? 'TODAY' : isTomorrow ? 'TMRW' : date.toLocaleDateString('en', { weekday: 'short' }).toUpperCase();
  const time = date.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', hour12: false });

  const city = typeof raw.city === 'string' ? raw.city : null;
  const countryCode = typeof raw.countryCode === 'string' ? raw.countryCode : null;
  const locationLabel = [city, countryCode].filter(Boolean).join(', ') || 'Location to be confirmed';

  return {
    id: String(raw.id),
    status: 'upcoming',
    startsAt,
    day,
    time,
    title: String(raw.title ?? ''),
    description: typeof raw.description === 'string' ? raw.description : null,
    creatorName: 'Vuvio creator',
    creatorId: String(raw.creatorId ?? ''),
    locationLabel,
    image: '/icons/icon-512.png',
    category: String(raw.category ?? ''),
    environment: String(raw.environment ?? ''),
    interestedCount: 0,
    isReal: true,
  };
}

export function useScheduledStreams() {
  const [items, setItems] = useState<ScheduledStreamItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    getScheduledStreams({ limit: 12 })
      .then(({ streams }) => {
        if (cancelled) return;
        const parsed = (streams as Record<string, unknown>[])
          .map(toScheduledItem)
          .filter((item): item is ScheduledStreamItem => item !== null);
        setItems(parsed);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  return items;
}
