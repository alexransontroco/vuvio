import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const projectId = process.argv.find((arg) => arg.startsWith('--project='))?.slice('--project='.length);
if (!projectId) throw new Error('Pass --project=<Firebase project ID> explicitly');

initializeApp({ projectId });
const db = getFirestore();

function visibilityOf(data) {
  return String(data.visibility ?? data.privacy ?? 'missing').toLowerCase();
}

function summarize(collection, doc) {
  const data = doc.data();
  const visibility = visibilityOf(data);
  const secretFields = ['streamKey', 'rtmpsStreamKey', 'webRTCUrl', 'ingestUrl', 'rtmpsIngestUrl', 'ingest', 'credentials', 'apiToken'];
  return {
    collection,
    id: doc.id,
    visibility,
    publicSafe: data.publicSafe === true,
    hasIngestSecret: secretFields.some((key) => Object.hasOwn(data, key)),
    hasCloudflareInput: Boolean(data.cloudflareLiveInputId || data.liveInputId),
    hasRecording: Boolean(data.recordingUid || data.cloudflareVideoId || data.replayUrl),
    hasCover: Boolean(data.coverImageUrl || data.image || data.thumbnailUrl),
  };
}

for (const collection of ['activeLives', 'streams']) {
  const snapshot = await db.collection(collection).get();
  for (const doc of snapshot.docs) {
    const result = summarize(collection, doc);
    if (result.visibility !== 'public' && result.visibility !== 'everyone'
      || result.hasIngestSecret || collection === 'activeLives' && !result.publicSafe) {
      process.stdout.write(`${JSON.stringify(result)}\n`);
    }
  }
  process.stderr.write(`${collection}: ${snapshot.size} documents examined (read-only)\n`);
}
