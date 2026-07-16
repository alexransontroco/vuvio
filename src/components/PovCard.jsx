import LiveBadge from './LiveBadge.jsx';
import { Bookmark, Eye } from 'lucide-react';

export default function PovCard({ stream, onClick }) {
  return (
    <button className="pov-card" type="button" onClick={onClick}>
      <img src={stream.image} alt={`${stream.role} POV`} />
      <span className="pov-card__shade" />
      <span className="pov-card__top">
        <LiveBadge compact />
        <span className="viewer-pill">
          <Eye size={14} strokeWidth={2.1} />
          {stream.viewerLabel}
        </span>
      </span>
      <span className="pov-card__meta">
        <span className="pov-card__avatar" aria-hidden="true">
          {stream.name.slice(0, 1)}
        </span>
        <strong>{stream.role}</strong>
        <small>{stream.place}</small>
      </span>
      <span className="pov-card__save" aria-hidden="true">
        <Bookmark size={21} strokeWidth={2} />
      </span>
    </button>
  );
}
