import { useState } from 'react';
import './desktop-live.css';

export default function DesktopLivePage({ streams = [], onStreamSelect }) {
  const [selectedStreamId, setSelectedStreamId] = useState(null);
  const liveStreams = streams.filter(s => s.status === 'live').slice(0, 1);
  const heroStream = liveStreams[0];

  const categories = [
    { icon: '🚴', label: 'Cycling' },
    { icon: '🥾', label: 'Hiking' },
    { icon: '🏄', label: 'Surfing' },
    { icon: '👨‍🍳', label: 'Cooking' },
    { icon: '🛩️', label: 'Paraglide' },
    { icon: '🤿', label: 'Diving' },
  ];

  return (
    <div className="desktop-live-page">
      {/* VIDEO CONTAINER */}
      <div className="video-container">
        <div className="video-placeholder">🎬</div>
        <div className="video-overlay" />

        {/* VIDEO CONTROLS */}
        <div className="video-controls">
          <button className="video-btn" title="Mute">🔊</button>
          <button className="video-btn" title="Fullscreen">⛶</button>
          <button className="video-btn" title="Settings">⚙️</button>
        </div>

        {/* STREAM INFO OVERLAY */}
        {heroStream && (
          <div className="stream-info-overlay">
            <div className="stream-avatar-mini" />
            <div className="stream-info-text">
              <div className="stream-name">{heroStream.name}</div>
              <div className="stream-viewers">{heroStream.viewers || '500'} viewers</div>
            </div>
            <div className="live-badge">
              <span className="pulse" />
              LIVE
            </div>
          </div>
        )}
      </div>

      {/* QUEUE BAR */}
      <div className="queue-bar">
        {categories.map((cat, idx) => (
          <button key={idx} className="queue-item">
            <span className="queue-icon">{cat.icon}</span>
            <span className="queue-label">{cat.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
