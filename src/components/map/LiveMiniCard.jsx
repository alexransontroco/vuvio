import { Eye } from 'lucide-react';

export default function LiveMiniCard({ live, onSelect }) {
  const viewerCount = live.viewers ? Number.parseInt(String(live.viewers).replace(/\D/g, ''), 10) : 0;
  const formattedViewers = viewerCount >= 1000
    ? `${(viewerCount / 1000).toFixed(1)}k`
    : viewerCount.toString();

  return (
    <button
      type="button"
      className="live-mini-card"
      onClick={() => onSelect?.(live)}
      aria-label={`Watch ${live.experienceTitle}`}
    >
      <div className="live-mini-card__image-wrap">
        <img src={live.image} alt="" loading="lazy" />
        <span className="live-mini-card__live-badge">LIVE</span>
        <span className="live-mini-card__viewers">
          <Eye size={10} strokeWidth={2} />
          {formattedViewers}
        </span>
      </div>
      <div className="live-mini-card__content">
        <h4 className="live-mini-card__title">{live.experienceTitle}</h4>
        <p className="live-mini-card__creator">{live.name}</p>
      </div>
    </button>
  );
}
