import { Monitor, Smartphone } from 'lucide-react';
import { useViewMode } from '../context/ViewModeContext.jsx';
import './view-mode-toggle.css';

export default function ViewModeToggle() {
  const { isDesktopMode, toggleDesktopMode, canToggleDesktop } = useViewMode();

  if (!canToggleDesktop) return null;

  return (
    <div className="view-mode-toggle" role="group" aria-label="Display mode">
      <button
        type="button"
        className={`view-mode-toggle__btn${!isDesktopMode ? ' is-active' : ''}`}
        onClick={toggleDesktopMode}
        aria-pressed={!isDesktopMode}
        title="Mobile view"
      >
        <Smartphone size={16} />
      </button>
      <button
        type="button"
        className={`view-mode-toggle__btn${isDesktopMode ? ' is-active' : ''}`}
        onClick={toggleDesktopMode}
        aria-pressed={isDesktopMode}
        title="Desktop view"
      >
        <Monitor size={16} />
      </button>
    </div>
  );
}
