import './desktop-globe.css';

export default function DesktopGlobePage({ streams = [] }) {
  return (
    <div className="desktop-globe-page">
      <div className="globe-container">
        <div className="globe-placeholder">🌐</div>
        <div className="globe-overlay" />

        {/* GLOBE CONTROLS */}
        <div className="globe-controls">
          <button className="globe-btn" title="Zoom in">➕</button>
          <button className="globe-btn" title="Zoom out">➖</button>
          <button className="globe-btn" title="Recenter">⬆️</button>
        </div>
      </div>
    </div>
  );
}
