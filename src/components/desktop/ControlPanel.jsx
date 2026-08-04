import { useState } from 'react';
import './control-panel.css';

const FAMILIES = [
  { id: 'all', label: 'All', icon: '⭐' },
  { id: 'earth', label: 'Land', icon: '🚴' },
  { id: 'air', label: 'Air', icon: '🛩️' },
  { id: 'water', label: 'Water', icon: '🏄' },
];

export default function ControlPanel({ activePage, onNavigate, liveCount = 0 }) {
  const [activeFilter, setActiveFilter] = useState('all');

  const handleNavClick = (page) => {
    onNavigate(page);
  };

  return (
    <aside className="control-panel">
      <div className="cp-logo">
        VUV<span>IO</span>
      </div>

      <nav className="cp-section">
        <div className="cp-section-title">Navigation</div>
        <button
          className={`cp-button ${activePage === 'live' ? 'active' : ''}`}
          onClick={() => handleNavClick('live')}
        >
          <span className="cp-icon">🔴</span>
          <span>Live</span>
        </button>
        <button
          className={`cp-button ${activePage === 'discover' ? 'active' : ''}`}
          onClick={() => handleNavClick('discover')}
        >
          <span className="cp-icon">🔍</span>
          <span>Explore</span>
        </button>
        <button
          className={`cp-button ${activePage === 'globe' ? 'active' : ''}`}
          onClick={() => handleNavClick('globe')}
        >
          <span className="cp-icon">🌍</span>
          <span>Globe</span>
        </button>
      </nav>

      <div className="cp-section">
        <div className="cp-section-title">Filters</div>
        {FAMILIES.map(family => (
          <button
            key={family.id}
            className={`cp-button ${activeFilter === family.id ? 'active' : ''}`}
            onClick={() => setActiveFilter(family.id)}
          >
            <span className="cp-icon">{family.icon}</span>
            <span>{family.label}</span>
          </button>
        ))}
      </div>

      <div className="cp-section">
        <div className="cp-section-title">Status</div>
        <div className="cp-stat">
          <div className="cp-stat-value">{liveCount}</div>
          <div className="cp-stat-label">Live Now</div>
        </div>
        <div className="cp-stat">
          <div className="cp-stat-value">12</div>
          <div className="cp-stat-label">Upcoming</div>
        </div>
      </div>

      <div className="cp-spacer" />

      <div className="cp-section">
        <button className="cp-cta">+ Start Live</button>
      </div>
    </aside>
  );
}
