import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { collections, db } from '../shared/firestore.js';
import type { StreamDocument } from '../types/stream.js';

const REMINDER_WINDOWS = [
  { minutesBefore: 60, label: '1 hour' },
  { minutesBefore: 15, label: '15 minutes' },
];

// Tolerance window: fire reminder if stream starts within [target - 2min, target + 2min]
const TOLERANCE_MS = 2 * 60 * 1000;

export async function remindScheduledStreams() {
  const now = Date.now();

  // Query streams starting within the next 65 minutes
  const windowEnd = Timestamp.fromMillis(now + 65 * 60 * 1000);
  const windowStart = Timestamp.fromMillis(now);

  const snap = await db.collection(collections.streams)
    .where('status', '==', 'scheduled')
    .where('scheduledStartAt', '>=', windowStart)
    .where('scheduledStartAt', '<=', windowEnd)
    .get();

  if (snap.empty) return;

  const batch = db.batch();
  let writesCount = 0;

  for (const streamDoc of snap.docs) {
    const stream = streamDoc.data() as StreamDocument;
    const scheduledMs = stream.scheduledStartAt!.toMillis();
    const remindersSent = stream.remindersSent ?? [];

    for (const { minutesBefore, label } of REMINDER_WINDOWS) {
      if (remindersSent.includes(minutesBefore)) continue;

      const targetMs = scheduledMs - minutesBefore * 60 * 1000;
      if (Math.abs(now - targetMs) > TOLERANCE_MS) continue;

      // Write notification for the creator
      const notifRef = db
        .collection(collections.notifications)
        .doc(stream.creatorId)
        .collection('items')
        .doc();

      batch.set(notifRef, {
        type: 'stream_reminder',
        streamId: stream.id,
        streamTitle: stream.title,
        scheduledStartAt: stream.scheduledStartAt,
        minutesBefore,
        label,
        read: false,
        createdAt: FieldValue.serverTimestamp(),
      });

      // Mark reminder as sent on the stream document
      batch.update(streamDoc.ref, {
        remindersSent: FieldValue.arrayUnion(minutesBefore),
        updatedAt: FieldValue.serverTimestamp(),
      });

      writesCount++;
      break; // Only one reminder per stream per run
    }
  }

  if (writesCount > 0) {
    await batch.commit();
    console.log(`[remindScheduledStreams] Sent ${writesCount} reminder(s)`);
  }
}
