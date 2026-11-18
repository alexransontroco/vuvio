import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import BottomNav from './BottomNav.jsx';
import LabBadge from './LabBadge.jsx';
import NotificationToast from './NotificationToast.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useFollowedCreatorNotifications } from '../hooks/useFollowedCreatorNotifications.js';

export default function AppShell() {
  const location = useLocation();
  const { userProfile } = useAuth();
  const { notifications, dismissNotification } = useFollowedCreatorNotifications(userProfile);
  const isBroadcast = location.pathname.startsWith('/live/');
  const isStudio = location.pathname === '/studio' || location.pathname.startsWith('/studio/');
  const isLive = location.pathname === '/watch' || location.pathname.startsWith('/watch/');
  const [liveNavCollapsed, setLiveNavCollapsed] = useState(false);

  useEffect(() => {
    setLiveNavCollapsed(false);
  }, [location.pathname]);

  return (
    <main className={`app-canvas${isLive ? ' app-canvas--live' : ''}${isStudio ? ' app-canvas--studio' : ''}`}>
      <section className={`phone-stage${isStudio ? ' phone-stage--studio' : ''}`} aria-label="VuVio mobile application">
        <div className="route-transition" key={location.pathname}>
          <Outlet />
        </div>
        {!isBroadcast && !isStudio ? (
          <BottomNav
            collapsible={isLive}
            collapsed={isLive && liveNavCollapsed}
            onExpand={() => setLiveNavCollapsed(false)}
            onCollapse={() => setLiveNavCollapsed(true)}
          />
        ) : null}
      </section>
      <NotificationToast notifications={notifications} onDismiss={dismissNotification} />
      <LabBadge />
    </main>
  );
}
