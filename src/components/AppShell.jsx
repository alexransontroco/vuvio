import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import BottomNav from './BottomNav.jsx';
import MobileLandingScreen from './MobileLandingScreen.jsx';
import NotificationToast from './NotificationToast.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useFollowedCreatorNotifications } from '../hooks/useFollowedCreatorNotifications.js';

export default function AppShell() {
  const location = useLocation();
  const { userProfile } = useAuth();
  const { notifications, dismissNotification } = useFollowedCreatorNotifications(userProfile);
  // When on /live/:liveId, hide bottom nav (broadcaster page)
  const isBroadcast = location.pathname.startsWith('/live/');
  const isLive = location.pathname.startsWith('/watch/');
  const [liveNavCollapsed, setLiveNavCollapsed] = useState(false);
  const [showLanding, setShowLanding] = useState(() => {
    return !localStorage.getItem('vuvio-landing-shown');
  });

  useEffect(() => {
    setLiveNavCollapsed(false);
  }, [location.pathname]);

  const handleLandingComplete = () => {
    setShowLanding(false);
    localStorage.setItem('vuvio-landing-shown', 'true');
  };

  if (showLanding) {
    return <MobileLandingScreen onComplete={handleLandingComplete} />;
  }

  return (
    <main className={isLive ? 'app-canvas app-canvas--live' : 'app-canvas'}>
      <section className="phone-stage" aria-label="VuVio mobile application">
        <div className="route-transition" key={location.pathname}>
          <Outlet />
        </div>
        {!isBroadcast ? (
          <BottomNav
            collapsible={isLive}
            collapsed={isLive && liveNavCollapsed}
            onExpand={() => setLiveNavCollapsed(false)}
            onCollapse={() => setLiveNavCollapsed(true)}
          />
        ) : null}
      </section>
      <NotificationToast notifications={notifications} onDismiss={dismissNotification} />
    </main>
  );
}
