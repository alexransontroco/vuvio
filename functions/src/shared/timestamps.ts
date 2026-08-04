import { Timestamp } from 'firebase-admin/firestore';

export function nowTimestamp() {
  return Timestamp.now();
}

export function secondsBetween(start: FirebaseFirestore.Timestamp | null | undefined, end: FirebaseFirestore.Timestamp | null | undefined) {
  if (!start || !end) return 0;
  return Math.max(0, Math.floor((end.toMillis() - start.toMillis()) / 1000));
}
