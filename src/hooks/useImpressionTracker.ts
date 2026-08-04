import { useEffect, useRef, useCallback } from 'react';
import { ANALYTICS_CONFIG } from '@/services/analytics/analyticsConfig';

interface UseImpressionTrackerOptions {
  enabled?: boolean;
  onImpression?: () => void;
  threshold?: number;
  debounceMs?: number;
}

export function useImpressionTracker(
  elementRef: React.RefObject<HTMLElement>,
  options: UseImpressionTrackerOptions = {}
) {
  const {
    enabled = true,
    onImpression,
    threshold = ANALYTICS_CONFIG.IMPRESSION_VISIBILITY_THRESHOLD,
    debounceMs = ANALYTICS_CONFIG.IMPRESSION_DEBOUNCE_MS,
  } = options;

  const observerRef = useRef<IntersectionObserver | null>(null);
  const visibilityTimeoutRef = useRef<number | null>(null);
  const isVisibleRef = useRef(false);
  const lastImpressionTimeRef = useRef<number>(0);

  const fireImpression = useCallback(() => {
    const now = Date.now();
    if (now - lastImpressionTimeRef.current > debounceMs) {
      lastImpressionTimeRef.current = now;
      onImpression?.();
    }
  }, [onImpression, debounceMs]);

  useEffect(() => {
    if (!enabled || !elementRef.current) {
      return;
    }

    const options: IntersectionObserverInit = {
      threshold,
    };

    observerRef.current = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          if (!isVisibleRef.current) {
            isVisibleRef.current = true;

            if (visibilityTimeoutRef.current !== null) {
              clearTimeout(visibilityTimeoutRef.current);
            }

            visibilityTimeoutRef.current = window.setTimeout(() => {
              if (isVisibleRef.current && elementRef.current) {
                fireImpression();
              }
            }, debounceMs);
          }
        } else {
          if (isVisibleRef.current) {
            isVisibleRef.current = false;

            if (visibilityTimeoutRef.current !== null) {
              clearTimeout(visibilityTimeoutRef.current);
              visibilityTimeoutRef.current = null;
            }
          }
        }
      });
    }, options);

    observerRef.current.observe(elementRef.current);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }

      if (visibilityTimeoutRef.current !== null) {
        clearTimeout(visibilityTimeoutRef.current);
        visibilityTimeoutRef.current = null;
      }
    };
  }, [enabled, elementRef, fireImpression, debounceMs, threshold]);

  return {
    fireImpressionNow: fireImpression,
  };
}
