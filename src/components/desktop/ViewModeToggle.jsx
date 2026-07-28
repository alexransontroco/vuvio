import './view-mode-toggle.css';

export default function ViewModeToggle({ mode, onModeChange }) {
  const modes = [
    { id: 'mobile', label: 'Mobile', icon: '📱' },
    { id: 'grid', label: 'Grid', icon: '⊞' },
    { id: 'dashboard', label: 'Dashboard', icon: '⋮⋯' },
  ];

  return (
    <div className="view-mode-toggle">
      {modes.map(m => (
        <button
          key={m.id}
          className={`mode-btn ${mode === m.id ? 'active' : ''}`}
          onClick={() => onModeChange(m.id)}
          title={m.label}
        >
          <span className="mode-icon">{m.icon}</span>
          <span className="mode-label">{m.label}</span>
        </button>
      ))}
    </div>
  );
}
