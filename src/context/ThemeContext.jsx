import { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext({ theme: 'default', setTheme: () => {} });

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    const stored = localStorage.getItem('vuvio-theme') || 'default';
    if (stored === 'vuvio-blue' || stored === 'ink-blue') return 'midnight-sky';
    return stored;
  });

  useEffect(() => {
    if (theme && theme !== 'default') {
      document.documentElement.setAttribute('data-theme', theme);
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    localStorage.setItem('vuvio-theme', theme);
  }, [theme]);

  const setTheme = (next) => setThemeState(next);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
