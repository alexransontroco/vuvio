import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { ViewModeProvider } from './context/ViewModeContext.jsx';
import './i18n/index.js';
import './styles/tokens.css';
import './styles/base.css';
import './styles/layout.css';
import './styles/app-shell-desktop.css';
import './styles/components.css';
import './styles/components/notification-toast.css';
import './styles/pages/live.css';
import './styles/pages/live-recap.css';
import './styles/pages/explore.css';
import './styles/pages/map.css';
import './styles/pages/messages.css';
import './styles/pages/profile.css';
import './styles/pages/support.css';
import './styles/pages/icons.css';
import './styles/pages/vision.css';
import './styles/pages/auth.css';
import './styles/pages/test-users.css';
import './styles/pages/following.css';
import './styles/pages/onboarding.css';
import './styles/pages/internal-stream-admin.css';
import './styles/pages/agents.css';
import './components/social/social.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter future={{ v7_relativeSplatPath: true }}>
      <AuthProvider>
        <ViewModeProvider>
          <App />
        </ViewModeProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);

if ('serviceWorker' in navigator) {
  if (import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js');
    });
  } else {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((registration) => registration.unregister());
    });
    window.caches?.keys().then((keys) => {
      keys.forEach((key) => window.caches.delete(key));
    });
  }
}
