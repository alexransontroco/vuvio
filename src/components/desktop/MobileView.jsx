import { useState } from 'react';
import './mobile-view.css';

export default function MobileView({ streams = [], onViewModeChange }) {
  const [activePage, setActivePage] = useState('live');
  const [selectedStream, setSelectedStream] = useState(null);

  const handleNavClick = (page) => {
    setActivePage(page);
    setSelectedStream(null);
  };

  const navItems = [
    { id: 'live', label: 'Watch', icon: '🔴' },
    { id: 'explore', label: 'Explore', icon: '🔍' },
    { id: 'globe', label: 'Globe', icon: '🌍' },
    { id: 'profile', label: 'Profile', icon: '👤' },
  ];

  return (
    <div className="mobile-view-container">
      <div className="mobile-viewport">
        {/* STATUS BAR */}
        <div className="mobile-status-bar">
          <span className="time">9:41</span>
          <div className="status-icons">
            <span>📶</span>
            <span>🔋</span>
          </div>
        </div>

        {/* CONTENT */}
        <div className="mobile-content">
          {activePage === 'live' && (
            <div className="mobile-page">
              <div className="mobile-header">Live Feed</div>
              <div className="mobile-streams-vertical">
                {streams.slice(0, 5).map(stream => (
                  <div
                    key={stream.id}
                    className="mobile-stream-card"
                    onClick={() => setSelectedStream(stream)}
                  >
                    <div className="mobile-stream-img">
                      <span className="live-indicator">🔴 LIVE</span>
                    </div>
                    <div className="mobile-stream-info">
                      <div className="mobile-stream-title">{stream.experienceTitle || stream.name}</div>
                      <div className="mobile-stream-creator">{stream.name}</div>
                      <div className="mobile-stream-viewers">👁️ {stream.viewers || '500'} viewing</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activePage === 'explore' && (
            <div className="mobile-page">
              <div className="mobile-header">Explore</div>
              <div className="mobile-categories">
                {[
                  { icon: '🚴', name: 'Cycling' },
                  { icon: '🥾', name: 'Hiking' },
                  { icon: '🏄', name: 'Surfing' },
                  { icon: '👨‍🍳', name: 'Cooking' },
                  { icon: '🛩️', name: 'Paraglide' },
                  { icon: '🤿', name: 'Diving' },
                ].map(cat => (
                  <div key={cat.name} className="mobile-category">
                    <div className="mobile-category-icon">{cat.icon}</div>
                    <div className="mobile-category-name">{cat.name}</div>
                  </div>
                ))}
              </div>
              <div className="mobile-streams-vertical">
                {streams.slice(0, 8).map(stream => (
                  <div
                    key={stream.id}
                    className="mobile-stream-card"
                    onClick={() => setSelectedStream(stream)}
                  >
                    <div className="mobile-stream-img">
                      <span className="live-indicator">🔴 LIVE</span>
                    </div>
                    <div className="mobile-stream-info">
                      <div className="mobile-stream-title">{stream.experienceTitle || stream.name}</div>
                      <div className="mobile-stream-creator">{stream.name}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activePage === 'globe' && (
            <div className="mobile-page">
              <div className="mobile-header">Interactive Globe</div>
              <div className="mobile-globe-placeholder">
                <div className="globe-icon">🌐</div>
                <div className="globe-text">Tap to explore locations</div>
              </div>
              <div className="mobile-globe-stats">
                <div className="stat">
                  <div className="stat-value">47</div>
                  <div className="stat-label">Live Now</div>
                </div>
                <div className="stat">
                  <div className="stat-value">12</div>
                  <div className="stat-label">Upcoming</div>
                </div>
              </div>
            </div>
          )}

          {activePage === 'profile' && (
            <div className="mobile-page">
              <div className="mobile-header">My Profile</div>
              <div className="mobile-profile">
                <div className="profile-avatar" />
                <div className="profile-name">Your Name</div>
                <div className="profile-handle">@yourhandle</div>
                <div className="profile-stats">
                  <div className="pstat">
                    <div className="pstat-value">847</div>
                    <div className="pstat-label">Followers</div>
                  </div>
                  <div className="pstat">
                    <div className="pstat-value">42</div>
                    <div className="pstat-label">Lives</div>
                  </div>
                </div>
                <button className="mobile-cta">+ Start Live</button>
              </div>
            </div>
          )}
        </div>

        {/* BOTTOM NAV */}
        <div className="mobile-bottom-nav">
          {navItems.map(item => (
            <button
              key={item.id}
              className={`mobile-nav-item ${activePage === item.id ? 'active' : ''}`}
              onClick={() => handleNavClick(item.id)}
            >
              <span className="mobile-nav-icon">{item.icon}</span>
              <span className="mobile-nav-label">{item.label}</span>
            </button>
          ))}
        </div>

        {/* MODAL FOR STREAM DETAILS */}
        {selectedStream && (
          <div className="mobile-modal">
            <div className="mobile-modal-header">
              <button className="mobile-modal-close" onClick={() => setSelectedStream(null)}>✕</button>
              <div className="mobile-modal-title">Stream Details</div>
              <div style={{ width: 32 }} />
            </div>
            <div className="mobile-modal-content">
              <div className="modal-section">
                <div className="modal-title">Title</div>
                <div className="modal-value">{selectedStream.experienceTitle || selectedStream.name}</div>
              </div>
              <div className="modal-section">
                <div className="modal-title">Creator</div>
                <div className="modal-value">{selectedStream.name}</div>
              </div>
              <div className="modal-section">
                <div className="modal-title">Location</div>
                <div className="modal-value">{selectedStream.city || 'Unknown'}, {selectedStream.country || 'USA'}</div>
              </div>
              <div className="modal-section">
                <div className="modal-title">Viewers</div>
                <div className="modal-value">{selectedStream.viewers || '500'}</div>
              </div>
              <button className="mobile-modal-cta">Watch Live</button>
            </div>
          </div>
        )}
      </div>

      {/* FLOATING TOGGLE */}
      <div className="mobile-view-toggle">
        <button className="mode-switch" onClick={() => onViewModeChange('grid')}>
          ⊞ Grid
        </button>
        <button className="mode-switch" onClick={() => onViewModeChange('dashboard')}>
          ⋮⋯ Dashboard
        </button>
      </div>
    </div>
  );
}
