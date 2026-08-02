import { createContext, useContext, useEffect, useState } from 'react';

const ViewModeContext = createContext();

export function ViewModeProvider({ children }) {
  const [forceDesktopMode, setForceDesktopMode] = useState(() => {
    const saved = localStorage.getItem('vuvio-force-desktop-mode');
    return saved ? JSON.parse(saved) : false;
  });
  const [isMobileDevice, setIsMobileDevice] = useState(false);

  useEffect(() => {
    const checkMobileDevice = () => {
      const isMobile = /iPhone|iPad|iPod|Android|Windows Phone|BlackBerry|Opera Mini/i.test(
        navigator.userAgent
      );
      setIsMobileDevice(isMobile);
    };

    checkMobileDevice();
    window.addEventListener('resize', checkMobileDevice);
    return () => window.removeEventListener('resize', checkMobileDevice);
  }, []);

  const toggleDesktopMode = () => {
    setForceDesktopMode((prev) => {
      const next = !prev;
      localStorage.setItem('vuvio-force-desktop-mode', JSON.stringify(next));
      return next;
    });
  };

  const isDesktopMode = forceDesktopMode || !isMobileDevice;
  const canToggleDesktop = !isMobileDevice;

  const value = {
    isDesktopMode,
    forceDesktopMode,
    toggleDesktopMode,
    isMobileDevice,
    canToggleDesktop,
  };

  return <ViewModeContext.Provider value={value}>{children}</ViewModeContext.Provider>;
}

export function useViewMode() {
  const context = useContext(ViewModeContext);
  if (!context) {
    throw new Error('useViewMode must be used within ViewModeProvider');
  }
  return context;
}
