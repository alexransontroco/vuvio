import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import BottomNav from './BottomNav.jsx';

export default function AppShell() {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const isBroadcast = location.pathname === '/watch' && searchParams.get('broadcast') === '1';
  const isLive = location.pathname.startsWith('/watch/') || (location.pathname === '/watch' && searchParams.has('live'));
  const [liveNavCollapsed, setLiveNavCollapsed] = useState(false);

  useEffect(() => {
    setLiveNavCollapsed(false);
  }, [location.pathname]);

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
    </main>
  );
}
