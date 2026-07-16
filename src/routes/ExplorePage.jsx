import { useMemo, useState } from 'react';
import { Bike, ChefHat, ChevronRight, Leaf, MapPin, Plane, Waves } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import BrandMark from '../components/BrandMark.jsx';
import CollectionCard from '../components/CollectionCard.jsx';
import PovCard from '../components/PovCard.jsx';
import SearchBar from '../components/SearchBar.jsx';
import SegmentedControl from '../components/SegmentedControl.jsx';
import UpcomingItem from '../components/UpcomingItem.jsx';
import { categories, collections, streams, upcomingStreams } from '../data/mockStreams.js';

const exploreTabs = [
  { label: 'Live now', value: 'now' },
  { label: 'Upcoming', value: 'upcoming' },
  { label: 'Collections', value: 'collections' },
];

const categoryIcons = {
  All: null,
  Sport: Bike,
  Travel: Plane,
  Nature: Leaf,
  Water: Waves,
  Craft: ChefHat,
  Cuisine: ChefHat,
  City: MapPin,
  Sky: Plane,
};

export default function ExplorePage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('now');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [bells, setBells] = useState({ 'night-route': true });

  const filteredStreams = useMemo(() => {
    return streams.filter((stream) => {
      const matchesCategory = category === 'All' || stream.category === category;
      const haystack = `${stream.name} ${stream.role} ${stream.place} ${stream.category}`.toLowerCase();
      return matchesCategory && haystack.includes(query.toLowerCase());
    });
  }, [category, query]);

  return (
    <section className="screen-scroll explore-screen" aria-label="Explore">
      <header className="explore-header">
        <div className="explore-topbar">
          <BrandMark size={34} showName />
          <button type="button" className="explore-profile" aria-label="Open profile">
            <span>M</span>
          </button>
        </div>
        <SearchBar value={query} onChange={setQuery} withFilter />
        <SegmentedControl items={exploreTabs} value={tab} onChange={setTab} />
      </header>

      <button type="button" className="explore-globe-teaser" onClick={() => navigate('/map')} aria-label="Ouvrir le globe">
        <span className="explore-globe-teaser__sphere">
          <i />
          <i />
          <i />
          <i />
          <i />
        </span>
      </button>

      {tab === 'now' ? (
        <>
          <div className="category-row" aria-label="Categories">
            {categories.map((item) => {
              const Icon = categoryIcons[item];

              return (
                <button
                  key={item}
                  type="button"
                  className={item === category ? 'is-active' : ''}
                  onClick={() => setCategory(item)}
                >
                  {Icon ? <Icon size={17} strokeWidth={1.9} /> : null}
                  {item}
                </button>
              );
            })}
            <button type="button" className="category-row__more" aria-label="More categories">
              <ChevronRight size={18} strokeWidth={2.2} />
            </button>
          </div>
          <div className="live-grid">
            {filteredStreams.map((stream) => (
              <PovCard key={stream.id} stream={stream} onClick={() => navigate(`/live?live=${stream.id}`)} />
            ))}
          </div>
        </>
      ) : null}

      {tab === 'upcoming' ? (
        <div className="upcoming-list">
          <span className="section-kicker">TODAY / TOMORROW</span>
          {upcomingStreams.map((item) => (
            <UpcomingItem
              key={item.id}
              item={item}
              active={!!bells[item.id]}
              onToggle={() => setBells((state) => ({ ...state, [item.id]: !state[item.id] }))}
            />
          ))}
          <p className="explore-hint">Tap the bell - we'll notify you at departure.</p>
        </div>
      ) : null}

      {tab === 'collections' ? (
        <div className="collections-list">
          {collections.map((collection) => (
            <CollectionCard key={collection.id} collection={collection} />
          ))}
        </div>
      ) : null}
    </section>
  );
}
