import { useRef, useState, useEffect } from 'react';
import LiveMiniCard from './LiveMiniCard.jsx';

export default function LivePreviewCarousel({ lives, onLiveSelect }) {
  const scrollRef = useRef(null);
  const [canScroll, setCanScroll] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScroll(el.scrollWidth > el.clientWidth);
  }, [lives]);

  const scroll = (direction) => {
    const el = scrollRef.current;
    if (!el) return;
    const distance = 280;
    el.scrollBy({ left: direction === 'left' ? -distance : distance, behavior: 'smooth' });
  };

  if (!lives || lives.length === 0) return null;

  return (
    <div className="live-preview-carousel">
      <div className="live-preview-carousel__track" ref={scrollRef} role="region" aria-label="Live streams carousel">
        {lives.map((live) => (
          <div key={live.id} className="live-preview-carousel__item">
            <LiveMiniCard live={live} onSelect={onLiveSelect} />
          </div>
        ))}
      </div>
      {canScroll && (
        <>
          <button
            type="button"
            className="live-preview-carousel__nav live-preview-carousel__nav--prev"
            onClick={() => scroll('left')}
            aria-label="Scroll left"
          >
            ‹
          </button>
          <button
            type="button"
            className="live-preview-carousel__nav live-preview-carousel__nav--next"
            onClick={() => scroll('right')}
            aria-label="Scroll right"
          >
            ›
          </button>
        </>
      )}
    </div>
  );
}
