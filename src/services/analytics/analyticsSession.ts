import { ANALYTICS_CONFIG } from './analyticsConfig';

export interface AnalyticsSession {
  sessionId: string;
  anonymousId: string;
  userId: string | null;
  createdAt: number;
  updatedAt: number;
}

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
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
}

export const analyticsSessionManager = new AnalyticsSessionManager();
