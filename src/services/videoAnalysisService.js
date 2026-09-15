import { addDoc, collection, doc, onSnapshot, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { auth, db } from '../firebase.js';

const JOB_COLLECTION = 'videoProcessingJobs';

export async function createReplayAnalysisJob({ replayUrl, liveId, userId }) {
  if (!replayUrl) throw new Error('Missing replayUrl');
  if (!liveId || !userId) throw new Error('Missing liveId or userId');
  const jobRef = await addDoc(collection(db, JOB_COLLECTION), {
    liveId,
    userId,
    sourceReplayUrl: replayUrl,
    status: 'queued',
    progress: 0,
    error: null,
    transcript: [],
    highlights: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return jobRef.id;
}

export async function startVideoAnalysisJob(jobId) {
  if (!jobId) throw new Error('Missing jobId');
  const token = await auth.currentUser?.getIdToken?.();
  if (!token) throw new Error('Authentication required');

  const res = await fetch(`/api/video-processing-jobs/${jobId}/start`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.message || `Analysis failed: ${res.status}`);
  return body;
}

export async function createAndStartVideoAnalysis({ videoBlob, liveId, userId }) {
  throw new Error('createAndStartVideoAnalysis(videoBlob) is disabled; use createReplayAnalysisJob(replayUrl) instead.');
}

export async function createAndStartReplayAnalysis({ replayUrl, liveId, userId }) {
  const jobId = await createReplayAnalysisJob({ replayUrl, liveId, userId });
  startVideoAnalysisJob(jobId).catch((err) => {
    console.warn('[videoAnalysis] Failed to start job:', err.message);
  });
  return jobId;
}

export function subscribeToVideoAnalysisJobs(liveId, userId, callback) {
  if (!liveId || !userId) return () => {};
  const jobsQuery = query(
    collection(db, JOB_COLLECTION),
    where('liveId', '==', liveId),
    where('userId', '==', userId)
  );

  return onSnapshot(jobsQuery, (snap) => {
    const jobs = snap.docs.map((jobDoc) => ({ id: jobDoc.id, ...jobDoc.data() }));
    jobs.sort((a, b) => {
      const aTime = a.createdAt?.toMillis?.() ?? 0;
      const bTime = b.createdAt?.toMillis?.() ?? 0;
      return bTime - aTime;
    });
    callback(jobs[0] || null);
  }, (err) => {
    console.warn('[videoAnalysis] Job subscription failed:', err.message);
    callback(null);
  });
}

export async function markHighlightDecision(jobId, highlightId, decision) {
  if (!jobId || !highlightId) return;
  const jobRef = doc(db, JOB_COLLECTION, jobId);
  await updateDoc(jobRef, {
    [`highlightDecisions.${highlightId}`]: decision,
    updatedAt: serverTimestamp(),
  });
}
