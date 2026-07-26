import { ArrowLeft, MoreHorizontal, Share2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function LiveRecapHero({ live, onShare, onMenu }) {
  const navigate = useNavigate();

  return (
    <section className="live-recap-hero" aria-label="Live recap header">
      <img src={live.heroImage} alt="POV mountain bike ride in the Alps" />
      <div className="live-recap-hero__shade" />
      <div className="live-recap-hero__top">
        <button type="button" className="live-recap-hero__back" onClick={() => navigate(-1)}>
          <ArrowLeft size={22} />
          <span>Back to Home</span>
        </button>
        <div className="live-recap-hero__actions">
          <button type="button" onClick={onShare}>
            <Share2 size={16} />
            <span>Share</span>
          </button>
          <button type="button" aria-label="More options" onClick={onMenu}>
            <MoreHorizontal size={21} />
          </button>
        </div>
      </div>
      <div className="live-recap-hero__content">
        <span className="live-recap-pill">LIVE ENDED</span>
        <h1>Morning Ride<br />in the Alps</h1>
        <p>{live.date} • {live.startTime} – {live.endTime} • 46 min</p>
      </div>
    </section>
  );
}
