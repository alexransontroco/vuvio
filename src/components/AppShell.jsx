import { useEffect, useState } from 'react';
import { Outlet, useLocation, Navigate, useNavigate } from 'react-router-dom';
import { Compass, Globe2, UserRound, Send, Tv2 } from 'lucide-react';
import BottomNav from './BottomNav.jsx';
import MobileLandingScreen from './MobileLandingScreen.jsx';
import NotificationToast from './NotificationToast.jsx';
import ViewModeToggle from './ViewModeToggle.jsx';
import BrandMark from './BrandMark.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useViewMode } from '../context/ViewModeContext.jsx';
import { useFollowedCreatorNotifications } from '../hooks/useFollowedCreatorNotifications.js';

export default function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const { isDesktopMode } = useViewMode();
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

  if (showLanding && !isDesktopMode) {
    return <MobileLandingScreen onComplete={handleLandingComplete} />;
  }

  return (
    <>
      <ViewModeToggle />
      {isDesktopMode && (
        <aside className="desktop-sidebar-nav">
          <div className="sidebar-brand">
            <BrandMark size={40} />
            <span>VUVIO</span>
          </div>
          <nav className="sidebar-menu">
            <button
              className={`sidebar-nav-btn ${location.pathname.startsWith('/watch') ? 'is-active' : ''}`}
              onClick={() => navigate('/watch')}
              title="Watch"
            >
              <Tv2 size={24} strokeWidth={1.8} />
              <span>Watch</span>
            </button>
            <button
              className={`sidebar-nav-btn ${location.pathname.startsWith('/explore') ? 'is-active' : ''}`}
              onClick={() => navigate('/explore')}
              title="Explore"
            >
              <Compass size={24} strokeWidth={1.8} />
              <span>Explore</span>
            </button>
            <button
              className={`sidebar-nav-btn ${location.pathname.startsWith('/globe') ? 'is-active' : ''}`}
              onClick={() => navigate('/globe')}
              title="Globe"
            >
              <Globe2 size={24} strokeWidth={1.8} />
              <span>Globe</span>
            </button>
            <button
              className="sidebar-nav-btn"
              onClick={() => navigate('/messages')}
              title="Messages"
            >
              <Send size={24} strokeWidth={1.8} />
              <span>Messages</span>
            </button>
          </nav>
          <button
            className={`sidebar-profile ${location.pathname.startsWith('/profile') ? 'is-active' : ''}`}
            onClick={() => navigate('/profile')}
            title="Profile"
          >
            <UserRound size={24} strokeWidth={1.8} />
            <span>Profile</span>
          </button>
        </aside>
      )}
      <main className={`${isDesktopMode ? 'app-canvas--desktop' : ''} ${isLive ? 'app-canvas app-canvas--live' : 'app-canvas'}`}>
      <section className="phone-stage" aria-label="VuVio mobile application">
        <div className="route-transition" key={location.pathname}>
          <Outlet />
        </div>
        {!isBroadcast && !isDesktopMode ? (
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
    </>
  );
}
