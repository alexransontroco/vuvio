import { Timestamp } from 'firebase-admin/firestore';
import { db, collections } from '../shared/firestore.js';
import type { StreamDocument } from '../types/stream.js';

export type TrustTier = 'new' | 'standard' | 'trusted' | 'at-risk' | 'suspended';

interface TrustSignals {
  accountAgeDays: number;
  totalLives: number;
  avgDurationMin: number;
  shortLivesRatio: number; // ratio of lives < 2min
  hasPhoto: boolean;
  hasDisplayName: boolean;
  reports: number; // reserved for future use
}

function computeScore(signals: TrustSignals): number {
  let score = 40; // base

  score += Math.min(signals.accountAgeDays / 3, 20);       // max +20 (ancienneté)
  score += Math.min(signals.totalLives * 2, 15);            // max +15 (activité)
  score += Math.min(signals.avgDurationMin, 10);            // max +10 (durée moyenne)
  score += signals.hasPhoto ? 5 : 0;                        // +5 profil avec photo
  score += signals.hasDisplayName ? 3 : 0;                  // +3 nom affiché
  score -= signals.shortLivesRatio * 20;                    // -0 à -20 (lives < 2min)
  score -= signals.reports * 15;                            // -15 par signalement

  return Math.max(0, Math.min(100, Math.round(score)));
}

function tierFromScore(score: number, totalLives: number, reports: number): TrustTier {
  if (reports >= 3) return 'suspended';
  if (score < 20) return 'at-risk';
  if (totalLives === 0) return 'new';
  if (score >= 70) return 'trusted';
  if (score >= 40) return 'standard';
  return 'new';
}

export async function updateTrustScore(creatorId: string): Promise<void> {
  const userRef = db.collection(collections.users).doc(creatorId);
  const userSnap = await userRef.get();
  const userData = userSnap.data() ?? {};

  // Account age from Firestore createdAt or Firebase Auth metadata
  const createdAt = userData.createdAt instanceof Timestamp
    ? userData.createdAt.toDate()
    : new Date();
  const accountAgeDays = Math.floor((Date.now() - createdAt.getTime()) / 86_400_000);

  // Stream history
  const streamsSnap = await db.collection(collections.streams)
    .where('creatorId', '==', creatorId)
    .where('status', '==', 'completed')
    .orderBy('endedAt', 'desc')
    .limit(50)
    .get();

  const streamDocs = streamsSnap.docs.map((d) => d.data() as StreamDocument);
  const totalLives = streamDocs.length;
  const totalDurationMin = streamDocs.reduce((sum, s) => sum + (s.durationSeconds ?? 0) / 60, 0);
  const avgDurationMin = totalLives > 0 ? totalDurationMin / totalLives : 0;
  const shortLives = streamDocs.filter((s) => (s.durationSeconds ?? 0) < 120).length;
  const shortLivesRatio = totalLives > 0 ? shortLives / totalLives : 0;

  const signals: TrustSignals = {
    accountAgeDays,
    totalLives,
    avgDurationMin,
    shortLivesRatio,
    hasPhoto: typeof userData.photoURL === 'string' && userData.photoURL.length > 0,
    hasDisplayName: typeof userData.displayName === 'string' && userData.displayName.length > 0,
    reports: typeof userData.reportCount === 'number' ? userData.reportCount : 0,
  };

  const trustScore = computeScore(signals);
  const trustTier = tierFromScore(trustScore, totalLives, signals.reports);

  await userRef.set({ trustScore, trustTier, trustUpdatedAt: Timestamp.now() }, { merge: true });

  console.log(`[trust] ${creatorId} → score=${trustScore} tier=${trustTier} (lives=${totalLives} ageDays=${accountAgeDays})`);
}

export async function updateAllTrustScores(): Promise<void> {
  const usersSnap = await db.collection(collections.users).get();
  await Promise.all(usersSnap.docs.map((doc) => updateTrustScore(doc.id).catch((err) => {
    console.error(`[trust] failed for ${doc.id}:`, err);
  })));
  console.log(`[trust] recalculated ${usersSnap.size} users`);
}
