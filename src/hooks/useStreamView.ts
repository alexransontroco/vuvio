import { useEffect, useRef, useCallback } from 'react';
import {
  StreamViewTracker,
  type StreamViewTrackerConfig,
  type ViewSessionMetrics,
} from '@/services/analytics/streamViewTracker';

interface UseStreamViewOptions {
  enabled?: boolean;
  onSessionEnd?: (metrics: ViewSessionMetrics) => void;
}

export function useStreamView(
  config: StreamViewTrackerConfig | null,
  options: UseStreamViewOptions = {}
) {
  const { enabled = true, onSessionEnd } = options;
  const trackerRef = useRef<StreamViewTracker | null>(null);
  const videoRefCallback = useCallback(
    (videoElement: HTMLVideoElement | null) => {
      if (!videoElement || !enabled || !config) {
        return;
      }

      if (!trackerRef.current) {
        trackerRef.current = new StreamViewTracker(config);
        trackerRef.current.recordImpression();
        trackerRef.current.startViewSession();
      }

      const tracker = trackerRef.current;

      const handlePlay = () => tracker.setPlaybackState(true);
      const handlePause = () => tracker.setPlaybackState(false);
      const handleEnded = () => {
        const metrics = tracker.endViewSession('stream_ended');
        onSessionEnd?.(metrics);
        trackerRef.current = null;
      };
      const handleError = () => {
        const metrics = tracker.endViewSession('network_error');
        onSessionEnd?.(metrics);
        trackerRef.current = null;
      };

      videoElement.addEventListener('play', handlePlay);
      videoElement.addEventListener('pause', handlePause);
      videoElement.addEventListener('ended', handleEnded);
      videoElement.addEventListener('error', handleError);

      return () => {
        videoElement.removeEventListener('play', handlePlay);
        videoElement.removeEventListener('pause', handlePause);
        videoElement.removeEventListener('ended', handleEnded);
        videoElement.removeEventListener('error', handleError);
      };
    },
    [config, enabled, onSessionEnd]
  );

  const recordGearOpened = useCallback(() => {
    trackerRef.current?.recordGearOpened();
  }, []);

  const recordGearItemClicked = useCallback(() => {
    trackerRef.current?.recordGearItemClicked();
  }, []);

  const recordGearExternalClicked = useCallback(() => {
    trackerRef.current?.recordGearExternalClicked();
  }, []);

  const recordProfileOpened = useCallback(() => {
    trackerRef.current?.recordProfileOpened();
  }, []);

  const recordCreatorFollowed = useCallback(() => {
    trackerRef.current?.recordCreatorFollowed();
  }, []);

  const recordShared = useCallback(() => {
    trackerRef.current?.recordShared();
  }, []);

  const recordCommented = useCallback(() => {
    trackerRef.current?.recordCommented();
  }, []);

  const recordRated = useCallback(() => {
    trackerRef.current?.recordRated();
  }, []);

  const recordReported = useCallback(() => {
    trackerRef.current?.recordReported();
  }, []);

  const endSession = useCallback((exitReason: string = 'navigation') => {
    if (trackerRef.current) {
      const metrics = trackerRef.current.endViewSession(exitReason);
      onSessionEnd?.(metrics);
      trackerRef.current = null;
    }
  }, [onSessionEnd]);

  useEffect(() => {
    return () => {
      if (trackerRef.current) {
        const metrics = trackerRef.current.endViewSession('pagehide');
        onSessionEnd?.(metrics);
        trackerRef.current.destroy();
        trackerRef.current = null;
      }
    };
  }, [onSessionEnd]);

  return {
    videoRefCallback,
    recordGearOpened,
    recordGearItemClicked,
    recordGearExternalClicked,
    recordProfileOpened,
    recordCreatorFollowed,
    recordShared,
    recordCommented,
    recordRated,
    recordReported,
    endSession,
  };
}
