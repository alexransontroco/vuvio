import { useState } from 'react';
import './info-panel.css';

export default function InfoPanel({ stream, tab = 'details', onTabChange, onClose }) {
  const handleTabClick = (tabName) => {
    onTabChange(tabName);
  };

  return (
    <aside className="info-panel">
      <div className="info-header">
        <div className="info-tabs">
          <button
            className={`info-tab ${tab === 'details' ? 'active' : ''}`}
            onClick={() => handleTabClick('details')}
          >
            Details
          </button>
          <button
            className={`info-tab ${tab === 'chat' ? 'active' : ''}`}
            onClick={() => handleTabClick('chat')}
          >
            Chat
          </button>
          <button
            className={`info-tab ${tab === 'gear' ? 'active' : ''}`}
            onClick={() => handleTabClick('gear')}
          >
            Gear
          </button>
        </div>
        <button className="info-close" onClick={onClose}>✕</button>
      </div>

      <div className="info-content">
        {/* DETAILS TAB */}
        {tab === 'details' && (
          <>
            <div className="info-section">
              <div className="info-section-title">Stream Info</div>
              <div className="info-block">
                <div className="info-item">
                  <div className="info-label">Title</div>
                  <div className="info-value">{stream.experienceTitle || stream.name}</div>
                </div>
                <div className="info-item">
                  <div className="info-label">Activity</div>
                  <div className="info-value">{stream.subcategory || 'Adventure'}</div>
                </div>
                <div className="info-item">
                  <div className="info-label">Location</div>
                  <div className="info-value">{stream.city || 'Unknown'}, {stream.country || 'USA'}</div>
                </div>
              </div>
            </div>

            <div className="info-section">
              <div className="info-section-title">Creator</div>
              <div className="creator-card">
                <div className="creator-avatar" />
                <div className="creator-info">
                  <div className="creator-name">{stream.name}</div>
                  <div className="creator-handle">@{stream.name?.toLowerCase().replace(/\s+/g, '')}</div>
                </div>
              </div>
              <button className="info-action">Follow</button>
            </div>

            <div className="info-section">
              <div className="info-section-title">Stats</div>
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-value">{stream.viewers || Math.floor(Math.random() * 1000)}</div>
                  <div className="stat-label">Viewers</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">23m</div>
                  <div className="stat-label">Duration</div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* CHAT TAB */}
        {tab === 'chat' && (
          <div className="chat-container">
            <div className="chat-message">
              <div className="chat-user">Sarah Wild</div>
              <div className="chat-text">Amazing views! 🤩</div>
            </div>
            <div className="chat-message">
              <div className="chat-user">Explorer Jake</div>
              <div className="chat-text">What camera are you using?</div>
            </div>
            <div className="chat-message">
              <div className="chat-user">{stream.name}</div>
              <div className="chat-text">GoPro 12 with Rode Wireless!</div>
            </div>
            <div className="chat-message">
              <div className="chat-user">River Guide</div>
              <div className="chat-text">Have you tried that trail to the left?</div>
            </div>
          </div>
        )}

        {/* GEAR TAB */}
        {tab === 'gear' && (
          <>
            <div className="info-section">
              <div className="info-section-title">Capture Setup</div>
              <div className="equipment-list">
                <div className="equipment-item">
                  <div className="equipment-icon">📹</div>
                  <div className="equipment-details">
                    <div className="equipment-name">GoPro 12</div>
                    <div className="equipment-type">Camera</div>
                  </div>
                </div>
                <div className="equipment-item">
                  <div className="equipment-icon">🎤</div>
                  <div className="equipment-details">
                    <div className="equipment-name">Rode Wireless Go II</div>
                    <div className="equipment-type">Audio</div>
                  </div>
                </div>
                <div className="equipment-item">
                  <div className="equipment-icon">🔌</div>
                  <div className="equipment-details">
                    <div className="equipment-name">Anker 737 Power Bank</div>
                    <div className="equipment-type">Power</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="info-section">
              <div className="info-section-title">Activity Gear</div>
              <div className="equipment-list">
                <div className="equipment-item">
                  <div className="equipment-icon">⛑️</div>
                  <div className="equipment-details">
                    <div className="equipment-name">BD Half Dome</div>
                    <div className="equipment-type">Helmet</div>
                  </div>
                </div>
                <div className="equipment-item">
                  <div className="equipment-icon">🎒</div>
                  <div className="equipment-details">
                    <div className="equipment-name">Osprey Atmos 65L</div>
                    <div className="equipment-type">Backpack</div>
                  </div>
                </div>
                <div className="equipment-item">
                  <div className="equipment-icon">👟</div>
                  <div className="equipment-details">
                    <div className="equipment-name">Salomon Quest 4D</div>
                    <div className="equipment-type">Boots</div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="info-footer">
        <button className="info-action">Save Stream</button>
        <button className="info-action">Share</button>
      </div>
    </aside>
  );
}
