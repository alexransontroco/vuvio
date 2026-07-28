import { useRef, useState, useEffect } from 'react';
import { EXPERIENCE_FILTERS } from '../../data/experienceTaxonomy.js';

export default function QuickFilters({ activeFamily, onFamilyChange, streamCounts }) {
  const scrollRef = useRef(null);
  const [canScroll, setCanScroll] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScroll(el.scrollWidth > el.clientWidth);
  }, []);

  const scroll = (direction) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: direction === 'left' ? -120 : 120, behavior: 'smooth' });
  };

  return (
    <div className="quick-filters">
      <div className="quick-filters__track" ref={scrollRef} role="group" aria-label="Quick filters">
        {EXPERIENCE_FILTERS.map((filter) => (
          <button
            key={filter.id}
            type="button"
            className={`quick-filter-chip${activeFamily === filter.id ? ' is-active' : ''}`}
            style={filter.id !== 'all' ? { '--filter-color': filter.color } : undefined}
            onClick={() => onFamilyChange(filter.id)}
            aria-pressed={activeFamily === filter.id}
          >
            {filter.id !== 'all' && <i className={`is-${filter.id}`} />}
            <span>{filter.label}</span>
            <small>{streamCounts.byFamily?.[filter.id] ?? 0}</small>
          </button>
        ))}
      </div>
      {canScroll && (
        <>
          <button
            type="button"
            className="quick-filters__nav quick-filters__nav--prev"
            onClick={() => scroll('left')}
            aria-label="Scroll filters left"
          >
            ‹
          </button>
          <button
            type="button"
            className="quick-filters__nav quick-filters__nav--next"
            onClick={() => scroll('right')}
            aria-label="Scroll filters right"
          >
            ›
          </button>
        </>
      )}
    </div>
  );
}
