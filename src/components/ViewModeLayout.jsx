import { lazy, Suspense } from 'react';
import AppShell from './AppShell.jsx';
import ViewModeToggle from './ViewModeToggle.jsx';
import { useViewMode } from '../context/ViewModeContext.jsx';

const DesktopLayout = lazy(() => import('./desktop/DesktopLayout.jsx'));

function RouteFallback() {
  return (
    <div className="route-fallback" role="status" aria-live="polite">
      <span />
    </div>
  );
}

export default function ViewModeLayout() {
  const { isDesktopMode } = useViewMode();

  return (
    <>
      <ViewModeToggle />
      {isDesktopMode ? (
        <Suspense fallback={<RouteFallback />}>
          <DesktopLayout />
        </Suspense>
      ) : (
        <AppShell />
      )}
    </>
  );
}
