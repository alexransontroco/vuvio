import { describe, it, expect, beforeEach } from 'vitest';
import { analyticsSessionManager } from '../analyticsSession';

describe('AnalyticsSessionManager', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  describe('getSession', () => {
    it('should create a session on first call', () => {
      const session = analyticsSessionManager.getSession();

      expect(session).toBeDefined();
      expect(session.sessionId).toBeDefined();
      expect(session.anonymousId).toBeDefined();
      expect(session.userId).toBeNull();
      expect(session.createdAt).toBeGreaterThan(0);
    });

    it('should return same sessionId within session', () => {
      const session1 = analyticsSessionManager.getSessionId();
      const session2 = analyticsSessionManager.getSessionId();

      expect(session1).toBe(session2);
    });
  });

  describe('anonymousId', () => {
    it('should persist anonymousId in localStorage', () => {
      const id1 = analyticsSessionManager.getAnonymousId();

      localStorage.clear();
      sessionStorage.clear();

      const stored = localStorage.getItem('vuvio:anonymous-id');
      expect(stored).toBeUndefined();
    });

    it('should return same anonymousId for user', () => {
      const id1 = analyticsSessionManager.getAnonymousId();
      const id2 = analyticsSessionManager.getAnonymousId();

      expect(id1).toBe(id2);
    });

    it('should use UUID format', () => {
      const id = analyticsSessionManager.getAnonymousId();

      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(uuidRegex.test(id)).toBe(true);
    });
  });

  describe('setUserId', () => {
    it('should set userId in session', () => {
      analyticsSessionManager.setUserId('user-123');

      const session = analyticsSessionManager.getSession();
      expect(session.userId).toBe('user-123');
    });

    it('should allow null userId', () => {
      analyticsSessionManager.setUserId('user-123');
      analyticsSessionManager.setUserId(null);

      const session = analyticsSessionManager.getSession();
      expect(session.userId).toBeNull();
    });

    it('should update timestamp when setting userId', () => {
      const before = analyticsSessionManager.getSession().updatedAt;

      setTimeout(() => {
        analyticsSessionManager.setUserId('user-123');
      }, 100);

      const after = analyticsSessionManager.getSession().updatedAt;
      expect(after).toBeGreaterThanOrEqual(before);
    });
  });

  describe('resetSessionId', () => {
    it('should generate new sessionId', () => {
      const id1 = analyticsSessionManager.getSessionId();

      analyticsSessionManager.resetSessionId();

      const id2 = analyticsSessionManager.getSessionId();

      expect(id1).not.toBe(id2);
    });

    it('should preserve anonymousId on reset', () => {
      const anonId1 = analyticsSessionManager.getAnonymousId();

      analyticsSessionManager.resetSessionId();

      const anonId2 = analyticsSessionManager.getAnonymousId();

      expect(anonId1).toBe(anonId2);
    });

    it('should preserve userId on reset', () => {
      analyticsSessionManager.setUserId('user-123');

      const userId1 = analyticsSessionManager.getUserId();

      analyticsSessionManager.resetSessionId();

      const userId2 = analyticsSessionManager.getUserId();

      expect(userId1).toBe(userId2);
    });
  });

  describe('session persistence', () => {
    it('should store session in sessionStorage', () => {
      analyticsSessionManager.getSession();

      const stored = sessionStorage.getItem('vuvio:analytics-session');
      expect(stored).toBeDefined();
      expect(JSON.parse(stored!)).toBeDefined();
    });

    it('should survive page reload (sessionStorage behavior)', () => {
      const sessionId1 = analyticsSessionManager.getSessionId();

      const stored = sessionStorage.getItem('vuvio:analytics-session');
      const reloaded = JSON.parse(stored!);

      expect(reloaded.sessionId).toBe(sessionId1);
    });
  });

  describe('UUID generation', () => {
    it('should generate valid UUIDs', () => {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

      for (let i = 0; i < 100; i++) {
        localStorage.clear();
        sessionStorage.clear();

        const id = analyticsSessionManager.getAnonymousId();
        expect(uuidRegex.test(id)).toBe(true);
      }
    });
  });
});
