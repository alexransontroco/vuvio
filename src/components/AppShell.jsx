import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import BottomNav from './BottomNav.jsx';

export default function AppShell() {
  const location = useLocation();
  const isLive = location.pathname === '/live';
  const [liveNavCollapsed, setLiveNavCollapsed] = useState(false);

  useEffect(() => {
    setLiveNavCollapsed(false);
  }, [location.pathname]);

  return (
    <main className={isLive ? 'app-canvas app-canvas--live' : 'app-canvas'}>
      <section className="phone-stage" aria-label="VuVio mobile application">
        <Outlet />
        <BottomNav
          collapsible={isLive}
          collapsed={isLive && liveNavCollapsed}
          onExpand={() => setLiveNavCollapsed(false)}
          onCollapse={() => setLiveNavCollapsed(true)}
        />
      </section>
    </main>
  );
}
