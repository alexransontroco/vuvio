import { FieldValue } from 'firebase-admin/firestore';
import type { Request } from 'firebase-functions/v2/https';
import type { Response } from 'express';
import { authenticateUser } from '../middleware/authenticateUser.js';
import { ApiError } from '../shared/errors.js';
import { db } from '../shared/firestore.js';
import { getCloudflareEnv } from '../config/env.js';
import { createCloudflareClient, type CloudflareVideo } from '../cloudflare/cloudflareClient.js';

function videoState(video: CloudflareVideo) {
  return video.status?.state ?? (video.readyToStream ? 'ready' : 'processing');
}

function videoReplayUrl(video: CloudflareVideo, customerCode: string) {
  return video.playback?.hls
    ?? (video.uid ? `https://customer-${customerCode}.cloudflarestream.com/${video.uid}/manifest/video.m3u8` : '');
}

function videoCreatedAt(video: CloudflareVideo) {
  return new Date(video.created ?? video.modified ?? 0).getTime() || 0;
}

function isWithinSession(video: CloudflareVideo, startedAtMs: number, endedAtMs: number) {
  const createdAtMs = videoCreatedAt(video);
  if (!createdAtMs) return false;
  return createdAtMs >= startedAtMs && createdAtMs <= endedAtMs;
}

export async function getReplayStatus(req: Request, res: Response, streamId: string) {
  let requesterUid: string | null = null;
  try {
    requesterUid = (await authenticateUser(req)).uid;
  } catch {
    requesterUid = null;
  }

  const liveRef = db.collection('activeLives').doc(streamId);
  const liveSnap = await liveRef.get();
  const queryUid = typeof req.query.uid === 'string' ? req.query.uid : '';
  if (!liveSnap.exists && !queryUid) throw new ApiError('not_found', 'Live not found');

  const live = liveSnap.data() ?? {};
  if (requesterUid && live.creatorUid && live.creatorUid !== requesterUid) {
    throw new ApiError('forbidden', 'Only the creator can check replay status');
  }

  // Fall back to liveInputId (set by WatchPage frontend) if cloudflareLiveInputId is missing
  const liveInputUid = (typeof live.cloudflareLiveInputId === 'string' && live.cloudflareLiveInputId)
    ? live.cloudflareLiveInputId
    : (typeof live.liveInputId === 'string' ? live.liveInputId : '');
  const storedRecordingUid = typeof live.recordingUid === 'string' ? live.recordingUid : '';
  const fallbackStreamId = typeof live.id === 'string' ? live.id : streamId;
  const liveStartedAt = live.startedAt?.toMillis?.() ?? live.liveStartedAt?.toMillis?.() ?? 0;
  // Extend end window by 30 min — Cloudflare creates the recording after stream ends
  const liveEndedAt = (live.endedAt?.toMillis?.() ?? live.liveEndedAt?.toMillis?.() ?? Date.now()) + 30 * 60 * 1000;
  console.log(`[replay-status] streamId=${streamId} liveInputUid=${liveInputUid || 'MISSING'} storedRecordingUid=${storedRecordingUid || 'none'} exists=${liveSnap.exists}`);
  if (!liveInputUid && !storedRecordingUid && !queryUid) throw new ApiError('bad_request', 'Missing Cloudflare liveInputId — was createLiveInput called?');

  // Fast path — webhook already stored the replay URL
  if (typeof live.replayUrl === 'string' && live.replayUrl) {
    res.json({
      success: true,
      cloudflareUid: live.recordingUid ?? live.cloudflareVideoId ?? '',
      liveInputUid,
      recordingStatus: 'ready',
      state: 'ready',
      pctComplete: null,
      readyToStream: true,
      replayUrl: live.replayUrl,
    });
    return;
  }

  const { apiToken, customerCode } = getCloudflareEnv();
  if (!apiToken) throw new ApiError('server_error', 'Cloudflare not configured');

  const client = createCloudflareClient();
  let videos: CloudflareVideo[] = [];
  try {
    videos = liveInputUid ? await client.listVideosByLiveInput(liveInputUid) : [];
    console.log(`[replay-status] Cloudflare videos found: ${videos.length} for liveInputUid=${liveInputUid}`);
    if (videos.length === 0 && storedRecordingUid) {
      const video = await client.getLiveInput(storedRecordingUid).catch(() => null);
      if (video) videos = [video as unknown as CloudflareVideo];
    }
    if (videos.length === 0 && fallbackStreamId && fallbackStreamId !== streamId) {
      const liveDoc = await db.collection('activeLives').doc(fallbackStreamId).get().catch(() => null);
      const liveDocData = liveDoc?.data?.() ?? null;
      const fallbackLiveInputUid = typeof liveDocData?.cloudflareLiveInputId === 'string' && liveDocData.cloudflareLiveInputId
        ? liveDocData.cloudflareLiveInputId
        : typeof liveDocData?.liveInputId === 'string'
          ? liveDocData.liveInputId
          : '';
      if (fallbackLiveInputUid && fallbackLiveInputUid !== liveInputUid) {
        videos = await client.listVideosByLiveInput(fallbackLiveInputUid);
        console.log(`[replay-status] fallback videos found: ${videos.length} for liveInputUid=${fallbackLiveInputUid}`);
      }
    }
  } catch (cfErr) {
    const cfErrMsg = cfErr instanceof Error ? cfErr.message : String(cfErr);
    console.error(`[replay-status] Cloudflare API error for liveInputUid=${liveInputUid}:`, cfErrMsg);
    res.json({ success: true, cloudflareUid: '', liveInputUid, recordingStatus: 'processing', state: 'processing', pctComplete: null, readyToStream: false, replayUrl: '', videosFound: 0, cfError: cfErrMsg });
    return;
  }
  const sessionVideos = videos.filter((video) => isWithinSession(video, liveStartedAt, liveEndedAt));
  const searchableVideos = sessionVideos.length > 0 ? sessionVideos : videos;
  console.log(`[replay-status] sessionVideos=${sessionVideos.length} allVideos=${videos.length} startedAt=${liveStartedAt} endedAt=${liveEndedAt}`);
  const video = searchableVideos.find((item) => item.uid === (queryUid || storedRecordingUid)) ?? searchableVideos[0] ?? null;
  const cloudflareUid = video?.uid ?? storedRecordingUid ?? '';

  if (!video || !cloudflareUid) {
    res.json({
      success: true,
      cloudflareUid: '',
      liveInputUid,
      recordingStatus: 'processing',
      state: 'processing',
      pctComplete: null,
      readyToStream: false,
      replayUrl: '',
      videosFound: videos.length,
    });
    return;
  }

  const state = videoState(video);
  const pctComplete = video.status?.pctComplete ?? null;
  const replayUrl = videoReplayUrl(video, customerCode);
  const thumbnailUrl = typeof video.thumbnail === 'string' ? video.thumbnail : '';
  const duration = typeof video.duration === 'number' ? video.duration : null;

  if (video.readyToStream || state === 'ready') {
    await liveRef.set({
      replayUrl,
      thumbnailUrl,
      duration,
      recordingStatus: 'ready',
      cloudflareVideoId: cloudflareUid,
      recordingUid: cloudflareUid,
      replayReadyAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  } else if (state === 'error') {
    await liveRef.set({
      recordingStatus: 'processing_failed',
      replayError: video.status?.errorReasonText ?? video.status?.errorReasonCode ?? 'Cloudflare processing failed',
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  }

  res.json({
    success: true,
    cloudflareUid,
    liveInputUid,
    recordingStatus: state === 'ready' || video.readyToStream ? 'ready' : state === 'error' ? 'processing_failed' : 'processing',
    state,
    pctComplete,
    readyToStream: video.readyToStream === true,
    replayUrl,
    cloudflareVideoId: cloudflareUid,
    videosFound: videos.length,
  });
}
