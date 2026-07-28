import './desktop-explore.css';

export default function DesktopExplorePage({ streams = [], onStreamSelect = () => {} }) {
  return (
    <div className="desktop-explore-page">
      <div className="explore-header">
        <h1>Explore All Streams</h1>
      </div>

      <div className="category-grid">
        {[
          { icon: '🚴', label: 'Cycling' },
          { icon: '🏄', label: 'Surfing' },
          { icon: '🛩️', label: 'Paragliding' },
          { icon: '👨‍🍳', label: 'Cooking' },
          { icon: '🥾', label: 'Hiking' },
          { icon: '🤿', label: 'Diving' },
        ].map((cat, idx) => (
          <button key={idx} className="category-item">
            <div className="category-icon">{cat.icon}</div>
            <div className="category-label">{cat.label}</div>
          </button>
        ))}
      </div>

      <h2 style={{ marginTop: '40px', marginBottom: '20px', fontSize: '18px', fontWeight: '700' }}>
        Featured Creators
      </h2>

      <div className="streams-grid">
        {streams.slice(0, 12).map(stream => (
          <div
            key={stream.id}
            className="stream-card"
            onClick={() => onStreamSelect(stream)}
          >
            <div className="stream-thumbnail">
              <span className="stream-badge">🔴 LIVE</span>
            </div>
            <div className="stream-info">
              <div className="stream-title">{stream.experienceTitle || stream.name}</div>
              <div className="stream-creator">
                {stream.name} · {stream.viewers || Math.floor(Math.random() * 1000)} viewers
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
