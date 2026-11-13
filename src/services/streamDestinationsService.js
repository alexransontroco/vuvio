import { collection, doc, getDocs, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase.js';

// ─── In-memory session store for stream keys ────────────────────────────────
// Stream keys are NEVER written to Firestore or localStorage.
// They live only in this Map for the duration of the browser session.
const sessionDestinations = new Map();

export function registerLiveDestinations(liveId, destinations) {
  if (!liveId) return;
  sessionDestinations.set(liveId, destinations ?? []);
}

export function getLiveDestinations(liveId) {
  return sessionDestinations.get(liveId) ?? [];
}

export function clearLiveDestinations(liveId) {
  sessionDestinations.delete(liveId);
}

// ─── Firestore: destination metadata (NO stream keys) ───────────────────────

export async function saveStreamDestination(uid, dest) {
  const ref = dest.id
    ? doc(db, 'users', uid, 'streamDestinations', dest.id)
    : doc(collection(db, 'users', uid, 'streamDestinations'));
  const id = ref.id;
  const data = {
    id,
    provider: dest.provider ?? 'custom',
    name: dest.name ?? dest.provider ?? 'Custom RTMP',
    streamUrl: dest.streamUrl ?? '',
    enabled: dest.enabled ?? true,
    updatedAt: serverTimestamp(),
    ...(dest.id ? {} : { createdAt: serverTimestamp() }),
  };
  await setDoc(ref, data, { merge: true });
  return data;
}

export async function getStreamDestinations(uid) {
  if (!uid) return [];
  try {
    const snap = await getDocs(collection(db, 'users', uid, 'streamDestinations'));
    return snap.docs.map((d) => ({ ...d.data(), id: d.id }));
  } catch {
    return [];
  }
}

export async function deleteStreamDestination(uid, destId) {
  await deleteDoc(doc(db, 'users', uid, 'streamDestinations', destId));
}

// ─── Backend API calls for Cloudflare Live Outputs ──────────────────────────

export async function createCloudflareOutput(user, liveInputId, { url, streamKey, provider, name }) {
  const token = await user.getIdToken();
  const res = await fetch(`/api/cloudflare/live-input/${encodeURIComponent(liveInputId)}/outputs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ url, streamKey, provider, name }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message ?? `HTTP ${res.status}`);
  }
  return res.json();
}

export async function deleteCloudflareOutput(user, liveInputId, outputId) {
  const token = await user.getIdToken();
  const res = await fetch(`/api/cloudflare/live-input/${encodeURIComponent(liveInputId)}/outputs/${encodeURIComponent(outputId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}
