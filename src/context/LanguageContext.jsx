import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import i18n from '../i18n/index.js';

const STORAGE_KEY = 'vuvio-language';
const AUTO_KEY = 'vuvio-language-auto';

const LanguageContext = createContext({
  language: 'en',
  mode: 'auto',
  setLanguage: () => {},
});

function detectBrowserLanguage() {
  const nav = typeof navigator !== 'undefined'
    ? (navigator.language || (navigator.languages && navigator.languages[0]))
    : 'en';
  return String(nav || 'en').toLowerCase().startsWith('fr') ? 'fr' : 'en';
}

export function LanguageProvider({ children }) {
  const [mode, setMode] = useState(() => {
    if (typeof window === 'undefined') return 'auto';
    const stored = window.localStorage.getItem(AUTO_KEY);
    if (stored === 'manual') return 'manual';
    return 'auto';
  });

  const [language, setLanguageState] = useState(() => {
    if (typeof window === 'undefined') return 'en';
    const manual = window.localStorage.getItem(STORAGE_KEY);
    if (manual === 'fr' || manual === 'en') {
      if (window.localStorage.getItem(AUTO_KEY) === 'manual') return manual;
    }
    return detectBrowserLanguage();
  });

  useEffect(() => {
    if (i18n.language !== language) {
      i18n.changeLanguage(language);
    }
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('lang', language);
    }
  }, [language]);

  const setLanguage = useCallback((next) => {
    if (next === 'auto') {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(AUTO_KEY, 'auto');
        window.localStorage.removeItem(STORAGE_KEY);
      }
      setMode('auto');
      setLanguageState(detectBrowserLanguage());
      return;
    }
    const safe = next === 'fr' ? 'fr' : 'en';
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(AUTO_KEY, 'manual');
      window.localStorage.setItem(STORAGE_KEY, safe);
    }
    setMode('manual');
    setLanguageState(safe);
  }, []);

  const value = useMemo(() => ({ language, mode, setLanguage }), [language, mode, setLanguage]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export const useLanguage = () => useContext(LanguageContext);
