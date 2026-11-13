import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { analyticsService } from '../services/analytics/analyticsService.ts';

// Map known route patterns to stable page types
const ROUTE_PATTERNS: Array<[RegExp, string, string]> = [
  [/^\/explore\/live/, 'explore_live', '/explore/live'],
  [/^\/explore/, 'explore', '/explore'],
  [/^\/watch/, 'watch', '/watch'],
  [/^\/globe/, 'globe', '/globe'],
  [/^\/map/, 'globe', '/globe'],
  [/^\/profile\/following/, 'following', '/profile/following'],
  [/^\/profile\/stats/, 'profile_stats', '/profile/stats'],
  [/^\/profile\/edit/, 'edit_profile', '/profile/edit'],
  [/^\/profile\/equipment/, 'equipment', '/profile/equipment'],
  [/^\/profile\/gear/, 'equipment', '/profile/equipment'],
  [/^\/profile\/[^/]+/, 'profile', '/profile/:id'],
  [/^\/profile$/, 'my_profile', '/profile'],
  [/^\/live\/[^/]+\/recap/, 'live_recap', '/live/:id/recap'],
  [/^\/live\/[^/]+\/summary/, 'live_summary', '/live/:id/summary'],
  [/^\/live\/[^/]+/, 'live_stream', '/live/:id'],
  [/^\/login/, 'login', '/login'],
  [/^\/signup/, 'signup', '/signup'],
  [/^\/onboarding/, 'onboarding', '/onboarding'],
  [/^\/verify-email/, 'verify_email', '/verify-email'],
  [/^\/forgot-password/, 'forgot_password', '/forgot-password'],
  [/^\/messages\/[^/]+/, 'conversation', '/messages/:id'],
  [/^\/messages/, 'messages', '/messages'],
  [/^\/notifications/, 'notifications', '/notifications'],
  [/^\/settings\/privacy/, 'privacy_settings', '/settings/privacy'],
  [/^\/settings/, 'settings', '/settings'],
  [/^\/vision/, 'vision', '/vision'],
  [/^\/terms/, 'terms', '/terms'],
  [/^\/privacy/, 'privacy', '/privacy'],
  [/^\/help/, 'help', '/help'],
  [/^\/report-problem/, 'report_problem', '/report-problem'],
  [/^\/$/, 'home', '/'],
];

function normalizeRoute(pathname: string): { pageType: string; pagePath: string } | null {
  // Skip admin, internal, and desktop routes
  if (/^\/(admin|internal|desktop|vision|agents)/.test(pathname)) return null;

  for (const [pattern, pageType, pagePath] of ROUTE_PATTERNS) {
    if (pattern.test(pathname)) {
      return { pageType, pagePath };
    }
  }
  return { pageType: 'other', pagePath: pathname };
}

export function usePageTracking() {
  const location = useLocation();
  const lastPathRef = useRef<string | null>(null);
  const sessionEndSetupRef = useRef(false);

  useEffect(() => {
    const { pathname } = location;

    if (pathname === lastPathRef.current) return;
    lastPathRef.current = pathname;

    const normalized = normalizeRoute(pathname);
    if (!normalized) return;

    if (analyticsService.isNewSession()) {
      analyticsService.trackSessionStart();
    }

    if (!sessionEndSetupRef.current) {
      sessionEndSetupRef.current = true;
      analyticsService.setupSessionEndTracking();
    }

    analyticsService.trackPageView(normalized.pageType, normalized.pagePath);
  }, [location.pathname]);
}
