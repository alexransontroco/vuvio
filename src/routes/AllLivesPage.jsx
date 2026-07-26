import { ChevronLeft, Eye, MapPin, Search, SlidersHorizontal, X } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LiveBadge from '../components/LiveBadge.jsx';
import { categories, streams } from '../data/mockStreams.js';

const sortOptions = [
  { id: 'viewers', label: 'Most watched' },
  { id: 'recent', label: 'Most recent' },
];

const fallbackImage = '/icons/icon-512.png';

function viewerCount(value) {
  return Number.parseInt(String(value ?? '').replace(/\D/g, ''), 10) || 0;
}

function formatViewers(value) {
  const count = viewerCount(value);
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
  return String(count);
}

function matchesSearch(stream, query) {
  if (!query) return true;
  const q = query.toLowerCase().trim();
  return [
    stream.name, stream.role, stream.note, stream.city,
    stream.country, stream.category, stream.subcategory, stream.place,
  ].some((field) => String(field ?? '').toLowerCase().includes(q));
}

function LiveCard({ stream, onOpen }) {
  const title = stream.note ?? stream.role ?? stream.name;
  const location = [stream.city, stream.country].filter(Boolean).join(', ');

  return (
    <article className="alp-card" onClick={() => onOpen(stream.id)} role="button" tabIndex={0}>
      <div className="alp-card__media">
        <img
          src={stream.image ?? fallbackImage}
          alt={title}
          loading="lazy"
          onError={(e) => { e.currentTarget.src = fallbackImage; }}
        />
        <div className="alp-card__top">
          <LiveBadge compact pulse />
          <span className="alp-card__viewers">
            <Eye size={10} strokeWidth={1.8} />
            {formatViewers(stream.viewerLabel)}
          </span>
        </div>
        <div className="alp-card__overlay">
          <p className="alp-card__title">{title}</p>
          {location ? (
            <span className="alp-card__location">
              <MapPin size={10} strokeWidth={1.8} />
              {location}
            </span>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export default function AllLivesPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [activeSort, setActiveSort] = useState('viewers');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const searchRef = useRef(null);

  const openStream = (id) => navigate(`/watch?live=${encodeURIComponent(id)}`);

  const filtered = useMemo(() => {
    let result = streams.filter((s) => matchesSearch(s, search));
    if (activeCategory !== 'All') {
      result = result.filter((s) => s.category === activeCategory);
    }
    if (activeSort === 'viewers') {
      result = [...result].sort((a, b) => viewerCount(b.viewerLabel) - viewerCount(a.viewerLabel));
    }
    return result;
  }, [search, activeCategory, activeSort]);

  const hasSearch = search.trim().length > 0;

  return (
    <section className="screen-scroll alp-screen" aria-label="All live streams">

      <header className="alp-header">
        <button type="button" className="alp-header__back" onClick={() => navigate(-1)} aria-label="Back">
          <ChevronLeft size={20} strokeWidth={2} />
        </button>
        <h1 className="alp-header__title">All live streams</h1>
        <button
          type="button"
          className="alp-header__sort"
          onClick={() => setFiltersOpen((v) => !v)}
          aria-label="Sort and filter"
        >
          <SlidersHorizontal size={16} strokeWidth={1.9} />
        </button>
      </header>

      <div className="alp-search-wrap">
        <div className="alp-search">
          <Search size={15} strokeWidth={1.9} />
          <input
            ref={searchRef}
            type="search"
            placeholder="Search activities, jobs, places or gear"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search live streams"
          />
          {hasSearch ? (
            <button type="button" onClick={() => setSearch('')} aria-label="Clear search">
              <X size={14} strokeWidth={2} />
            </button>
          ) : null}
        </div>
      </div>

      {filtersOpen ? (
        <div className="alp-sort-row" role="group" aria-label="Sort options">
          {sortOptions.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className={activeSort === opt.id ? 'alp-sort-chip is-active' : 'alp-sort-chip'}
              onClick={() => setActiveSort(opt.id)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      ) : null}

      <div className="alp-categories" role="group" aria-label="Filter by category">
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            className={activeCategory === cat ? 'alp-cat-chip is-active' : 'alp-cat-chip'}
            onClick={() => setActiveCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="alp-count">
        {filtered.length} {filtered.length === 1 ? 'perspective' : 'perspectives'}
      </div>

      {filtered.length ? (
        <div className="alp-grid">
          {filtered.map((stream) => (
            <LiveCard key={stream.id} stream={stream} onOpen={openStream} />
          ))}
        </div>
      ) : (
        <div className="alp-empty">
          <strong>No live perspectives found</strong>
          <p>Try another activity, place or filter.</p>
          <button type="button" onClick={() => { setSearch(''); setActiveCategory('All'); }}>
            Reset filters
          </button>
        </div>
      )}

    </section>
  );
}
