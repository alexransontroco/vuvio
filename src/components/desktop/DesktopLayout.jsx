import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import LandingScreen from './LandingScreen';
import DesktopViewModeToggle from './ViewModeToggle';
import ControlPanel from './ControlPanel';
import DesktopExplorePage from './DesktopExplorePage';
import DesktopGlobePage from './DesktopGlobePage';
import InfoPanel from './InfoPanel';
import GlobalViewModeToggle from '../ViewModeToggle.jsx';
import { useViewMode } from '../../context/ViewModeContext.jsx';
import { lives } from '../../data/lives.js';
import './desktop.css';

export default function DesktopLayout() {
  const navigate = useNavigate();
  const { toggleDesktopMode } = useViewMode();
  const [showLanding, setShowLanding] = useState(true);
  const [streams] = useState(lives);
  const [viewMode, setViewMode] = useState('grid');
  const [activePage, setActivePage] = useState('explore');
  const [selectedStream, setSelectedStream] = useState(null);

  const handleLandingComplete = () => {
    setShowLanding(false);
  };

  const handleModeChange = (mode) => {
    if (mode === 'mobile') {
      toggleDesktopMode();
    } else {
      setViewMode(mode);
    }
  };

  if (showLanding) {
    return <LandingScreen onComplete={handleLandingComplete} />;
  }

  // MODE GRID
  if (viewMode === 'grid') {
    return (
      <>
        <GlobalViewModeToggle />
        <div className="desktop-layout-grid">
        <div className="grid-top-bar">
          <div className="grid-title">Vuvio — Grid View</div>
          <DesktopViewModeToggle mode={viewMode} onModeChange={handleModeChange} />
        </div>

        <div className="grid-nav">
          <button
            className={`grid-nav-btn ${activePage === 'explore' ? 'active' : ''}`}
            onClick={() => setActivePage('explore')}
          >
            🔍 Explore
          </button>
          <button
            className={`grid-nav-btn ${activePage === 'globe' ? 'active' : ''}`}
            onClick={() => setActivePage('globe')}
          >
            🌍 Globe
          </button>
        </div>

        <div className="grid-content">
          {activePage === 'explore' && <DesktopExplorePage streams={streams} onStreamSelect={setSelectedStream} />}
          {activePage === 'globe' && <DesktopGlobePage streams={streams} />}
        </div>

        {selectedStream && (
          <div className="grid-modal">
            <div className="grid-modal-content">
              <button className="grid-modal-close" onClick={() => setSelectedStream(null)}>✕</button>
              <InfoPanel
                stream={selectedStream}
                tab="details"
                onTabChange={() => {}}
                onClose={() => setSelectedStream(null)}
              />
            </div>
          </div>
        )}
      </div>
      </>
    );
  }

  // MODE DASHBOARD (default after landing)
  return (
    <>
      <GlobalViewModeToggle />
      <div className="desktop-layout">
      <div className="mode-toggle-float">
        <DesktopViewModeToggle mode={viewMode} onModeChange={handleModeChange} />
      </div>

      <ControlPanel
        activePage={activePage}
        onNavigate={setActivePage}
        liveCount={streams.filter(s => s.status === 'live').length}
      />

      <div className="hero-area">
        {activePage === 'explore' && <DesktopExplorePage streams={streams} onStreamSelect={setSelectedStream} />}
        {activePage === 'globe' && <DesktopGlobePage streams={streams} />}
      </div>

      {selectedStream && (
        <InfoPanel
          stream={selectedStream}
          tab="details"
          onTabChange={() => {}}
          onClose={() => setSelectedStream(null)}
        />
      )}
    </div>
    </>
  );
}
