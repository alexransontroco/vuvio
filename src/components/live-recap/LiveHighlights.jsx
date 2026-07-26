import { BarChart3, Camera, ChevronRight, Flame, MessageCircle, Star } from 'lucide-react';

const iconMap = {
  chart: BarChart3,
  star: Star,
  message: MessageCircle,
  flame: Flame,
  camera: Camera,
};

function MiniChart() {
  return (
    <svg className="highlight-mini-chart" viewBox="0 0 92 48" aria-hidden="true">
      <path d="M2 38 L11 34 L18 36 L25 28 L33 31 L41 22 L50 26 L58 18 L67 21 L75 13 L90 9" />
      <line x1="2" x2="90" y1="38" y2="38" />
    </svg>
  );
}

export function LiveHighlightRow({ item, active, onSelect }) {
  const Icon = iconMap[item.icon] ?? Star;
  return (
    <button type="button" className={`live-highlight-row ${active ? 'is-active' : ''}`} onClick={() => onSelect(item)}>
      <span className="live-highlight-row__thumb">
        {item.thumbnail === 'chart' ? <MiniChart /> : <img src={item.thumbnail} alt="" />}
      </span>
      <span className={`live-highlight-row__icon live-highlight-row__icon--${item.tone}`}><Icon size={18} /></span>
      <span className="live-highlight-row__copy">
        <strong>{item.title}</strong>
        <small>{item.text}</small>
      </span>
      <time>{item.timestamp}</time>
      <ChevronRight size={16} />
    </button>
  );
}

export default function LiveHighlights({ highlights, activeId, onSelect }) {
  return (
    <section className="live-recap-panel live-highlights">
      <header className="live-recap-panel__header">
        <div>
          <Star size={22} fill="currentColor" />
          <h2>Highlights</h2>
        </div>
        <button type="button">See all</button>
      </header>
      <div className="live-highlights__list">
        {highlights.map((item) => (
          <LiveHighlightRow key={item.id} item={item} active={item.id === activeId} onSelect={onSelect} />
        ))}
      </div>
    </section>
  );
}
