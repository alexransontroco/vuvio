import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import LandingScreen from './LandingScreen';
import ViewModeToggle from './ViewModeToggle';
import ControlPanel from './ControlPanel';
import DesktopExplorePage from './DesktopExplorePage';
import DesktopGlobePage from './DesktopGlobePage';
import InfoPanel from './InfoPanel';
import { lives } from '../../data/lives.js';
import './desktop.css';

export default function DesktopLayout() {
  const navigate = useNavigate();
  const [showLanding, setShowLanding] = useState(true);
  const [streams] = useState(lives);
  const [viewMode, setViewMode] = useState('mobile');
  const [activePage, setActivePage] = useState('explore');
  const [selectedStream, setSelectedStream] = useState(null);

  const handleLandingComplete = () => {
    setShowLanding(false);
  };

  const handleModeChange = (mode) => {
    if (mode === 'mobile') {
      navigate('/watch', { replace: true });
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
      <div className="desktop-layout-grid">
        <div className="grid-top-bar">
          <div className="grid-title">Vuvio — Grid View</div>
          <ViewModeToggle mode={viewMode} onModeChange={handleModeChange} />
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
    );
  }

  // MODE DASHBOARD (default after landing)
  return (
    <div className="desktop-layout">
      <div className="mode-toggle-float">
        <ViewModeToggle mode={viewMode} onModeChange={handleModeChange} />
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
  );
}
