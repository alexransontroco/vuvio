import { FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import type { Request } from 'firebase-functions/v2/https';
import type { Response } from 'express';
import { collections, db } from '../shared/firestore.js';
import { ApiError } from '../shared/errors.js';
import { asRecord, stringField } from '../shared/validation.js';
import { streamRef } from '../streams/streamHelpers.js';

const ADMIN_EMAILS = new Set(['alexandre.ranson@gmail.com']);
const adminUidCache = new Map<string, boolean>();

async function isAdminUid(userId: string | null): Promise<boolean> {
  if (!userId) return false;
  if (adminUidCache.has(userId)) return adminUidCache.get(userId)!;
  try {
    const record = await getAuth().getUser(userId);
    const result = !!record.email && (ADMIN_EMAILS.has(record.email) || record.email.endsWith('@vuvio.app'));
    adminUidCache.set(userId, result);
    return result;
  } catch {
    adminUidCache.set(userId, false);
    return false;
  }
}

type AnalyticsEventName =
  // Website / acquisition
  | 'page_view'
  | 'session_start'
  | 'sign_up'
  | 'login'
  // Stream engagement
  | 'stream_impression'
  | 'stream_view_started'
  | 'stream_view_3_seconds'
  | 'stream_view_10_seconds'
  | 'stream_view_30_seconds'
  | 'stream_skipped'
  | 'stream_view_ended'
  | 'creator_profile_opened'
  | 'creator_followed'
  | 'stream_shared'
  | 'gear_panel_opened'
  | 'gear_item_opened'
  | 'gear_external_link_clicked'
  | 'comment_sent'
  | 'stream_rated'
  | 'stream_reported'
  | 'discovery_filter_applied'
  | 'search_performed'
  | 'globe_pin_clicked'
  | 'stream_quality_degraded'
  | 'app_backgrounded'
  | 'session_end';

const WEBSITE_EVENTS = new Set<string>(['page_view', 'session_start', 'sign_up', 'login', 'session_end']);

type AnalyticsSource =
  | 'watch'
  | 'explore'
  | 'globe'
  | 'profile'
  | 'notification'
  | 'shared_link'
  | 'direct'
  | null;

interface IncomingAnalyticsEvent {
  id: string;
  eventName: AnalyticsEventName;
  streamId?: string | null;
  creatorId?: string | null;
  sessionId: string;
  anonymousId: string;
  userId: string | null;
  source: AnalyticsSource;
  sourcePosition?: number | null;
  viewSessionId?: string | null;
  timestamp: number;
  metadata?: Record<string, unknown>;
  // Website fields
  environment?: string | null;
  deviceType?: string | null;
  pageType?: string | null;
  pagePath?: string | null;
  acquisitionSource?: string | null;
  acquisitionMedium?: string | null;
  acquisitionCampaign?: string | null;
  acquisitionReferrer?: string | null;
  // Server-injected, not from client
  _clientIp?: string;
}

// Map frontend event names to backend event types for stats tracking
const eventTypeMap: Record<string, string> = {
  'stream_impression': 'stream_impression',
  'stream_view_started': 'viewer_joined',
  'stream_view_3_seconds': 'view_3_seconds',
  'stream_view_10_seconds': 'view_10_seconds',
  'stream_view_30_seconds': 'view_30_seconds',
  'stream_skipped': 'stream_skipped',
  'stream_view_ended': 'viewer_left',
  'creator_followed': 'follow_creator',
  'stream_shared': 'share',
  'gear_panel_opened': 'gear_opened',
  'gear_item_opened': 'gear_clicked',
  'gear_external_link_clicked': 'gear_clicked',
  'comment_sent': 'comment_sent',
  'stream_reported': 'report_submitted',
};

function validateEvent(event: unknown): { valid: false; reason: string } | { valid: true; event: IncomingAnalyticsEvent } {
  try {
    const obj = asRecord(event);
    const id = stringField(obj, 'id', { required: true, max: 160 });
    const eventName = stringField(obj, 'eventName', { required: true, max: 64 });
    const sessionId = stringField(obj, 'sessionId', { required: true, max: 100 });
    const anonymousId = stringField(obj, 'anonymousId', { required: true, max: 120 });
    const timestamp = obj.timestamp;

    if (typeof timestamp !== 'number') {
      return { valid: false, reason: 'timestamp must be a number' };
    }

    const streamId = stringField(obj, 'streamId', { max: 100 });
    const creatorId = stringField(obj, 'creatorId', { max: 100 });
    const userId = stringField(obj, 'userId', { max: 128 });
    const source = stringField(obj, 'source', { max: 30 });
    const sourcePosition = obj.sourcePosition;
    const viewSessionId = stringField(obj, 'viewSessionId', { max: 160 });
    const metadata = obj.metadata ? asRecord(obj.metadata) : undefined;
    const environment = stringField(obj, 'environment', { max: 20 });
    const deviceType = stringField(obj, 'deviceType', { max: 20 });
    const pageType = stringField(obj, 'pageType', { max: 50 });
    const pagePath = stringField(obj, 'pagePath', { max: 200 });
    const acquisitionSource = stringField(obj, 'acquisitionSource', { max: 50 });
    const acquisitionMedium = stringField(obj, 'acquisitionMedium', { max: 50 });
    const acquisitionCampaign = stringField(obj, 'acquisitionCampaign', { max: 100 });
    const acquisitionReferrer = stringField(obj, 'acquisitionReferrer', { max: 200 });

    // Validate timestamp is reasonable (within last 24 hours)
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000;
    if (timestamp > now || timestamp < now - maxAge) {
      return { valid: false, reason: 'Invalid timestamp' };
    }

    return {
      valid: true,
      event: {
        id: id || '',
        eventName: eventName as AnalyticsEventName,
        streamId: streamId || undefined,
        creatorId: creatorId || undefined,
        sessionId: sessionId || '',
        anonymousId: anonymousId || '',
        userId: userId || null,
        source: (source || null) as AnalyticsSource,
        sourcePosition: typeof sourcePosition === 'number' ? sourcePosition : undefined,
        viewSessionId: viewSessionId || undefined,
        timestamp,
        metadata,
        environment: environment || null,
        deviceType: deviceType || null,
        pageType: pageType || null,
        pagePath: pagePath || null,
        acquisitionSource: acquisitionSource || null,
        acquisitionMedium: acquisitionMedium || null,
        acquisitionCampaign: acquisitionCampaign || null,
        acquisitionReferrer: acquisitionReferrer || null,
      },
    };
  } catch (error) {
    return { valid: false, reason: error instanceof Error ? error.message : 'Invalid event format' };
  }
}

function getDateKey(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10);
}

function sanitizeKey(value: string | null | undefined): string {
  if (!value) return 'unknown';
  return value.toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 30);
}

function buildWebsiteStatsUpdate(event: IncomingAnalyticsEvent): Record<string, unknown> {
  const env = event.environment === 'development' ? 'dev' : 'prod';
  const update: Record<string, unknown> = {
    date: getDateKey(event.timestamp),
    updatedAt: FieldValue.serverTimestamp(),
  };

  switch (event.eventName) {
    case 'page_view': {
      update.pageViews = FieldValue.increment(1);
      update[`pageViews_${env}`] = FieldValue.increment(1);
      if (event.pageType) {
        update[`pv_${sanitizeKey(event.pageType)}`] = FieldValue.increment(1);
      }
      if (event.deviceType) {
        update[`device_${sanitizeKey(event.deviceType)}`] = FieldValue.increment(1);
      }
      break;
    }
    case 'session_start': {
      update.sessions = FieldValue.increment(1);
      update[`sessions_${env}`] = FieldValue.increment(1);
      const src = sanitizeKey(event.acquisitionSource || 'direct');
      update[`source_${src}`] = FieldValue.increment(1);
      if (event.acquisitionMedium) {
        update[`medium_${sanitizeKey(event.acquisitionMedium)}`] = FieldValue.increment(1);
      }
      break;
    }
    case 'sign_up': {
      update.signups = FieldValue.increment(1);
      update[`signups_${env}`] = FieldValue.increment(1);
      break;
    }
    case 'login': {
      update.logins = FieldValue.increment(1);
      update[`logins_${env}`] = FieldValue.increment(1);
      break;
    }
    case 'session_end': {
      const dur = event.metadata?.durationSeconds;
      if (typeof dur === 'number' && dur > 0 && dur < 86400) {
        update.totalSessionDurationSeconds = FieldValue.increment(dur);
        update[`totalSessionDurationSeconds_${env}`] = FieldValue.increment(dur);
        update.sessionEndCount = FieldValue.increment(1);
        update[`sessionEndCount_${env}`] = FieldValue.increment(1);
      }
      break;
    }
  }

  return update;
}

interface GeoData {
  country: string;
  countryCode: string;
  city: string;
}

async function lookupGeo(ip: string): Promise<GeoData | null> {
  if (!ip || ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.')) {
    return null;
  }
  try {
    const res = await fetch(`https://ipwho.is/${ip}`);
    if (!res.ok) return null;
    const data = await res.json() as Record<string, unknown>;
    if (!data.success) return null;
    return {
      country: String(data.country || ''),
      countryCode: String(data.country_code || '').toUpperCase(),
      city: String(data.city || ''),
    };
  } catch {
    return null;
  }
}

/**
 * Update visitorActivity/{anonymousId} and websiteStats unique/new/returning counters.
 * Called after session_start is accepted (deduped).
 *
 * Logic:
 * - New visitor (first ever): increment newVisitors + uniqueVisitors in websiteStats
 * - Returning visitor (first session today): increment returningVisitors + uniqueVisitors
 * - Returning visitor (already counted today): only update lastSeenAt, no counter change
 */
async function updateVisitorStats(
  anonymousId: string,
  timestamp: number,
  environment: string | null,
  clientIp: string
): Promise<void> {
  const today = getDateKey(timestamp);
  const env = environment === 'development' ? 'dev' : 'prod';
  const visitorRef = db.collection('visitorActivity').doc(anonymousId);

  const geo = await lookupGeo(clientIp);

  try {
    await db.runTransaction(async (tx) => {
      const visitorSnap = await tx.get(visitorRef);
      const statsRef = db.collection('websiteStats').doc(today);

      if (!visitorSnap.exists) {
        tx.set(visitorRef, {
          anonymousId,
          firstSeenAt: new Date(timestamp),
          firstSeenDate: today,
          lastSeenAt: new Date(timestamp),
          lastSeenDate: today,
          lastCountedDate: today,
          totalSessions: 1,
          ...(geo ? { country: geo.country, countryCode: geo.countryCode, city: geo.city } : {}),
        });
        const statsData: Record<string, unknown> = {
          date: today,
          uniqueVisitors: FieldValue.increment(1),
          [`uniqueVisitors_${env}`]: FieldValue.increment(1),
          newVisitors: FieldValue.increment(1),
          [`newVisitors_${env}`]: FieldValue.increment(1),
          updatedAt: FieldValue.serverTimestamp(),
        };
        if (geo?.countryCode) {
          statsData[`country_${geo.countryCode.toLowerCase()}`] = FieldValue.increment(1);
        }
        tx.set(statsRef, statsData, { merge: true });
      } else {
        const data = visitorSnap.data()!;
        if (data.lastCountedDate !== today) {
          // First session today from a returning visitor
          tx.update(visitorRef, {
            lastSeenAt: new Date(timestamp),
            lastSeenDate: today,
            lastCountedDate: today,
            totalSessions: FieldValue.increment(1),
          });
          tx.set(statsRef, {
            date: today,
            uniqueVisitors: FieldValue.increment(1),
            [`uniqueVisitors_${env}`]: FieldValue.increment(1),
            returningVisitors: FieldValue.increment(1),
            [`returningVisitors_${env}`]: FieldValue.increment(1),
            updatedAt: FieldValue.serverTimestamp(),
          }, { merge: true });
        } else {
          // Same visitor already counted today — just update lastSeenAt
          tx.update(visitorRef, {
            lastSeenAt: new Date(timestamp),
            totalSessions: FieldValue.increment(1),
          });
        }
      }
    });
  } catch (error) {
    console.error('[Analytics] Failed to update visitor stats:', error);
  }
}

async function ingestWebsiteEvent(event: IncomingAnalyticsEvent): Promise<{ accepted: boolean; deduped: boolean; error?: string }> {
  const eventsRef = collections.analyticsEvents;
  const dedupeId = event.id;

  try {
    const result = await db.runTransaction(async (tx) => {
      const existing = await tx.get(eventsRef.doc(dedupeId));
      if (existing.exists) {
        return { accepted: false, deduped: true };
      }

      tx.set(eventsRef.doc(dedupeId), {
        eventName: event.eventName,
        eventId: event.id,
        sessionId: event.sessionId,
        anonymousId: event.anonymousId,
        userId: event.userId,
        environment: event.environment || 'production',
        deviceType: event.deviceType || null,
        pageType: event.pageType || null,
        pagePath: event.pagePath || null,
        acquisitionSource: event.acquisitionSource || null,
        acquisitionMedium: event.acquisitionMedium || null,
        acquisitionCampaign: event.acquisitionCampaign || null,
        acquisitionReferrer: event.acquisitionReferrer || null,
        timestamp: new Date(event.timestamp),
        receivedAt: FieldValue.serverTimestamp(),
      });

      const statsUpdate = buildWebsiteStatsUpdate(event);
      const dateKey = getDateKey(event.timestamp);
      const websiteStatsRef = db.collection('websiteStats').doc(dateKey);
      tx.set(websiteStatsRef, statsUpdate, { merge: true });

      return { accepted: true, deduped: false };
    });

    // After dedup transaction: update unique/new/returning visitor counters for session_start
    if (result.accepted && event.eventName === 'session_start' && event.anonymousId) {
      await updateVisitorStats(event.anonymousId, event.timestamp, event.environment ?? null, event._clientIp ?? '');
    }

    return result;
  } catch (error) {
    return { accepted: false, deduped: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

async function ingestStreamEvent(event: IncomingAnalyticsEvent): Promise<{ accepted: boolean; deduped: boolean; error?: string }> {
  if (!event.streamId) {
    return { accepted: false, deduped: false, error: 'Missing streamId' };
  }

  const streamId = event.streamId;

  // Verify stream exists
  const streamSnap = await streamRef(streamId).get();
  if (!streamSnap.exists) {
    return { accepted: false, deduped: false, error: 'Stream not found' };
  }

  const eventsRef = collections.analyticsEvents;
  const dedupeId = event.id;

  try {
    const result = await db.runTransaction(async (tx) => {
      const existing = await tx.get(eventsRef.doc(dedupeId));
      if (existing.exists) {
        return { accepted: false, deduped: true };
      }

      tx.set(eventsRef.doc(dedupeId), {
        eventName: event.eventName,
        eventId: event.id,
        streamId: streamId,
        creatorId: event.creatorId,
        sessionId: event.sessionId,
        anonymousId: event.anonymousId,
        userId: event.userId,
        source: event.source,
        sourcePosition: event.sourcePosition ?? null,
        viewSessionId: event.viewSessionId || null,
        environment: event.environment || 'production',
        metadata: event.metadata || {},
        timestamp: new Date(event.timestamp),
        receivedAt: FieldValue.serverTimestamp(),
      });

      // Update stream stats on the root stream document
      const backendEventType = eventTypeMap[event.eventName] || event.eventName;
      const statsRef = streamRef(streamId);

      const update: Record<string, unknown> = {
        statsUpdatedAt: FieldValue.serverTimestamp(),
      };

      switch (backendEventType) {
        case 'stream_impression':
          update.impressions = FieldValue.increment(1);
          break;
        case 'viewer_joined':
          update.viewStarts = FieldValue.increment(1);
          break;
        case 'view_3_seconds':
          update.retention3s = FieldValue.increment(1);
          break;
        case 'view_10_seconds':
          update.retention10s = FieldValue.increment(1);
          break;
        case 'view_30_seconds':
          update.retention30s = FieldValue.increment(1);
          break;
        case 'viewer_left': {
          const watchSecs = event.metadata?.activeWatchDurationSeconds;
          if (typeof watchSecs === 'number' && watchSecs > 0) {
            update.totalWatchTime = FieldValue.increment(watchSecs);
          }
          break;
        }
        case 'stream_skipped':
          update.skips = FieldValue.increment(1);
          break;
        case 'follow_creator':
          update.follows = FieldValue.increment(1);
          break;
        case 'share':
          update.shares = FieldValue.increment(1);
          break;
        case 'gear_opened':
          update.gear = FieldValue.increment(1);
          break;
      }

      tx.update(statsRef, update);

      return { accepted: true, deduped: false };
    });

    return result;
  } catch (error) {
    return { accepted: false, deduped: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

async function ingestEvent(event: IncomingAnalyticsEvent): Promise<{ accepted: boolean; deduped: boolean; error?: string }> {
  if (await isAdminUid(event.userId)) {
    return { accepted: false, deduped: true };
  }
  if (WEBSITE_EVENTS.has(event.eventName)) {
    return ingestWebsiteEvent(event);
  }
  return ingestStreamEvent(event);
}

export async function ingestEvents(req: Request, res: Response) {
  try {
    const body = asRecord(req.body);
    const events = body.events;

    if (!Array.isArray(events)) {
      throw new ApiError('bad_request', 'events must be an array');
    }

    if (events.length === 0) {
      throw new ApiError('bad_request', 'No events provided');
    }

    if (events.length > 500) {
      throw new ApiError('bad_request', 'Too many events (max 500)');
    }

    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || '';

    const results = {
      accepted: 0,
      deduped: 0,
      errors: 0,
    };

    for (const rawEvent of events) {
      const validation = validateEvent(rawEvent);

      if (!validation.valid) {
        results.errors++;
        continue;
      }

      const ingestResult = await ingestEvent({ ...validation.event, _clientIp: clientIp });

      if (ingestResult.accepted) {
        results.accepted++;
      } else if (ingestResult.deduped) {
        results.deduped++;
      } else {
        results.errors++;
      }
    }

    res.status(200).json({
      accepted: results.accepted,
      deduped: results.deduped,
      errors: results.errors,
    });
  } catch (error) {
    throw error;
  }
}
