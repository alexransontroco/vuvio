import { ANALYTICS_CONFIG } from './analyticsConfig';

const SESSION_STARTED_KEY = 'vuvio:session-started';
const ACQUISITION_KEY = 'vuvio:acquisition';

export interface AnalyticsSession {
  sessionId: string;
  anonymousId: string;
  userId: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface AcquisitionData {
  source: string;
  medium: string;
  campaign: string;
  referrer: string;
}

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function getReferrerSource(referrer: string): string {
  if (!referrer) return 'direct';
  if (/google\./i.test(referrer)) return 'google';
  if (/instagram\./i.test(referrer)) return 'instagram';
  if (/facebook\.|fb\.com/i.test(referrer)) return 'facebook';
  if (/linkedin\./i.test(referrer)) return 'linkedin';
  if (/twitter\.com|t\.co/i.test(referrer)) return 'twitter';
  if (/x\.com/i.test(referrer)) return 'twitter';
  try {
    const ref = new URL(referrer);
    if (ref.hostname === window.location.hostname) return 'internal';
  } catch { /* ignore */ }
  return 'referral';
}

function captureAcquisition(): AcquisitionData {
  try {
    const params = new URLSearchParams(window.location.search);
    const utmSource = params.get('utm_source');
    if (utmSource) {
      return {
        source: utmSource.toLowerCase().slice(0, 50),
        medium: (params.get('utm_medium') || 'unknown').toLowerCase().slice(0, 50),
        campaign: (params.get('utm_campaign') || '').toLowerCase().slice(0, 100),
        referrer: document.referrer ? document.referrer.slice(0, 200) : '',
      };
    }
    const referrer = document.referrer || '';
    const source = getReferrerSource(referrer);
    return {
      source,
      medium: source === 'direct' ? 'direct' : source === 'google' ? 'organic' : 'referral',
      campaign: '',
      referrer: referrer.slice(0, 200),
    };
  } catch {
    return { source: 'direct', medium: 'direct', campaign: '', referrer: '' };
  }
}

class AnalyticsSessionManager {
  private session: AnalyticsSession | null = null;

  constructor() {
    this.loadSession();
  }

  private loadSession(): void {
    try {
      const stored = sessionStorage.getItem(ANALYTICS_CONFIG.SESSION_STORAGE_KEY);
      if (stored) {
        this.session = JSON.parse(stored);
      } else {
        this.initializeSession();
      }
    } catch (error) {
      console.error('[Analytics] Failed to load session from storage', error);
      this.initializeSession();
    }
  }

  private initializeSession(): void {
    const anonymousId = this.loadOrCreateAnonymousId();
    this.session = {
      sessionId: generateUUID(),
      anonymousId,
      userId: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.saveSession();
  }

  private loadOrCreateAnonymousId(): string {
    try {
      const stored = localStorage.getItem(ANALYTICS_CONFIG.ANONYMOUS_ID_STORAGE_KEY);
      if (stored) {
        return stored;
      }
      const id = generateUUID();
      localStorage.setItem(ANALYTICS_CONFIG.ANONYMOUS_ID_STORAGE_KEY, id);
      return id;
    } catch (error) {
      console.error('[Analytics] Failed to manage anonymous ID', error);
      return generateUUID();
    }
  }

  private saveSession(): void {
    if (!this.session) return;
    try {
      sessionStorage.setItem(ANALYTICS_CONFIG.SESSION_STORAGE_KEY, JSON.stringify(this.session));
    } catch (error) {
      console.error('[Analytics] Failed to save session', error);
    }
  }

  getSession(): AnalyticsSession {
    if (!this.session) {
      this.initializeSession();
    }
    return this.session!;
  }

  setUserId(userId: string | null): void {
    if (!this.session) {
      this.initializeSession();
    }
    this.session!.userId = userId;
    this.session!.updatedAt = Date.now();
    this.saveSession();
  }

  getSessionCreatedAt(): number {
    return this.getSession().createdAt;
  }

  getSessionId(): string {
    return this.getSession().sessionId;
  }

  getAnonymousId(): string {
    return this.getSession().anonymousId;
  }

  getUserId(): string | null {
    return this.getSession().userId;
  }

  resetSessionId(): void {
    if (!this.session) {
      this.initializeSession();
      return;
    }
    this.session.sessionId = generateUUID();
    this.session.updatedAt = Date.now();
    this.saveSession();
  }

  /** Returns true if session_start has not been fired yet for this browser session. */
  isNewSession(): boolean {
    try {
      return !sessionStorage.getItem(SESSION_STARTED_KEY);
    } catch {
      return true;
    }
  }

  markSessionStarted(): void {
    try {
      sessionStorage.setItem(SESSION_STARTED_KEY, '1');
    } catch { /* ignore */ }
  }

  /** Capture acquisition data once per session (stored in sessionStorage). */
  getOrCaptureAcquisition(): AcquisitionData {
    try {
      const stored = sessionStorage.getItem(ACQUISITION_KEY);
      if (stored) return JSON.parse(stored);
      const data = captureAcquisition();
      sessionStorage.setItem(ACQUISITION_KEY, JSON.stringify(data));
      return data;
    } catch {
      return captureAcquisition();
    }
  }
}

export const analyticsSessionManager = new AnalyticsSessionManager();
