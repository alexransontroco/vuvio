import { useState, useCallback } from 'react';

const PRIVACY_STORAGE_KEY = 'vuvio_live_activity_privacy';

const DEFAULT_PRIVACY_SETTINGS = {
  liveActivityVisibility: 'friends', // 'friends', 'nobody'
  showWatchingIndicator: true,
};

/**
 * Hook to manage live activity privacy settings
 */
export function useLiveActivityPrivacy() {
  const [settings, setSettings] = useState(() => {
    const stored = localStorage.getItem(PRIVACY_STORAGE_KEY);
    return stored ? JSON.parse(stored) : DEFAULT_PRIVACY_SETTINGS;
  });

  const updateSetting = useCallback((key, value) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: value };
      localStorage.setItem(PRIVACY_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const setLiveActivityVisibility = useCallback((visibility) => {
    if (!['friends', 'nobody'].includes(visibility)) {
      throw new Error('Invalid visibility setting');
    }
    updateSetting('liveActivityVisibility', visibility);
  }, [updateSetting]);

  const setShowWatchingIndicator = useCallback((show) => {
    updateSetting('showWatchingIndicator', show);
  }, [updateSetting]);

  const resetToDefaults = useCallback(() => {
    setSettings(DEFAULT_PRIVACY_SETTINGS);
    localStorage.setItem(PRIVACY_STORAGE_KEY, JSON.stringify(DEFAULT_PRIVACY_SETTINGS));
  }, []);

  return {
    settings,
    liveActivityVisibility: settings.liveActivityVisibility,
    showWatchingIndicator: settings.showWatchingIndicator,
    setLiveActivityVisibility,
    setShowWatchingIndicator,
    resetToDefaults,
    updateSetting,
  };
}
