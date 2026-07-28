import {
  Bell,
  Briefcase,
  ChevronRight,
  Eye,
  Globe,
  Hammer,
  Home,
  Leaf,
  MapPin,
  MessageCircle,
  Mountain,
  Music,
  Palette,
  Plus,
  Search,
  SlidersHorizontal,
  Smartphone,
  Truck,
  UtensilsCrossed,
  X,
  Zap,
  Check,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import LiveBadge from '../components/LiveBadge.jsx';
import { streams, upcomingStreams } from '../data/mockStreams.js';
import { getUnreadConversationCount, subscribeToMessaging } from '../services/messagingService.js';
import { searchCreators, followCreator, unfollowCreator } from '../services/creatorService.js';
import { useAuth } from '../context/AuthContext.jsx';
import { getCountdownState } from '../utils/countdown.js';

const quickFilters = [
  { id: 'for-you', label: 'For you' },
  { id: 'nearby', label: 'Nearby' },
  { id: 'jobs', label: 'Jobs' },
  { id: 'sports', label: 'Sports' },
  { id: 'crafts', label: 'Crafts' },
  { id: 'travel', label: 'Travel' },
  { id: 'nature', label: 'Nature' },
  { id: 'music', label: 'Music' },
];

const categoryTiles = [
  { id: 'jobs', label: 'Jobs', desc: 'Discover real workdays', icon: Briefcase, accent: 'var(--vuvio-cyan)' },
  { id: 'sports', label: 'Sports', desc: 'Move, ride and explore', icon: Zap, accent: 'var(--vuvio-blue)' },
  { id: 'crafts', label: 'Crafts', desc: 'Watch people make', icon: Hammer, accent: 'var(--vuvio-orange)' },
  { id: 'nature', label: 'Nature', desc: 'See the world outside', icon: Leaf, accent: '#4cd97b' },
  { id: 'food', label: 'Food & Drink', desc: 'Taste the world live', icon: UtensilsCrossed, accent: 'var(--vuvio-orange)' },
  { id: 'transport', label: 'Transport', desc: 'On board, on the move', icon: Truck, accent: 'var(--vuvio-blue)' },
  { id: 'travel', label: 'Travel', desc: 'Explore from anywhere', icon: Globe, accent: 'var(--vuvio-cyan)' },
  { id: 'city-tours', label: 'City Tours', desc: 'Walk the world live', icon: MapPin, accent: 'var(--vuvio-cyan)' },
  { id: 'music', label: 'Music', desc: 'Live sound from the world', icon: Music, accent: 'var(--vuvio-orange)' },
];

const chipCategories = {
  jobs: ['City', 'Craft', 'Cuisine'],
  sports: ['Sport', 'Nature', 'Sky', 'Water'],
  crafts: ['Craft', 'Cuisine'],
  'city-tours': ['City Tours'],
  travel: ['Travel', 'City Tours'],
  nature: ['Nature', 'Water'],
  music: [],
};

const envFilters = [
  { id: 'air', label: 'Air', family: 'air' },
  { id: 'earth', label: 'Land', family: 'earth' },
  { id: 'water', label: 'Water', family: 'water' },
];

const themeOptions = [
  { id: 'food', label: 'Food', icon: UtensilsCrossed },
  { id: 'adventure', label: 'Adventure', icon: Mountain },
  { id: 'transport', label: 'Transport', icon: Truck },
  { id: 'nature', label: 'Nature', icon: Leaf },
  { id: 'art', label: 'Art', icon: Palette },
  { id: 'music', label: 'Music', icon: Music },
  { id: 'daily', label: 'Daily life', icon: Home },
  { id: 'tech', label: 'Technology', icon: Smartphone },
];

const activityChips = [
  'Fishing', 'Surfing', 'Cycling', 'Hiking', 'Skiing',
  'Cooking', 'Architecture', 'Medicine', 'Pottery', 'Photography',
  'Tour Guide', 'Farming', 'Carpentry', 'Welding', 'Sailing',
];

const equipmentOptions = ['GoPro', 'Drone', 'Bicycle', 'Smartphone', 'Boat', 'Motorbike'];

const locationOptions = [
  { id: 'nearby', label: 'Nearby' },
  { id: 'city', label: 'City' },
  { id: 'country', label: 'Country' },
  { id: 'worldwide', label: 'Worldwide' },
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

function matchesChip(stream, chip) {
  if (!chip || chip === 'for-you' || chip === 'nearby') return true;
  const cats = chipCategories[chip];
  if (!cats) return true;
  if (cats.length === 0) return false;
  return cats.includes(stream.category);
}

function matchesFilters(stream, filters) {
  if (filters.env?.length && !filters.env.includes(stream.family)) return false;
  return true;
}

function countActiveFilters(filters) {
  return Object.values(filters).reduce((sum, arr) => {
    if (Array.isArray(arr)) return sum + arr.length;
    if (arr && arr !== 'both') return sum + 1;
    return sum;
  }, 0);
}

function LiveNowCard({ stream, onOpen }) {
  const title = stream.note ?? stream.role ?? stream.name;
  const location = [stream.city, stream.country].filter(Boolean).join(', ');

  return (
    <article className="ep-live-card" onClick={() => onOpen(stream.id)} role="button" tabIndex={0}>
      <div className="ep-live-card__media">
        <img
          src={stream.image ?? fallbackImage}
          alt={title}
          loading="lazy"
          onError={(e) => { e.currentTarget.src = fallbackImage; }}
        />
        <div className="ep-live-card__top">
          <LiveBadge compact pulse />
          <span className="ep-live-card__viewers">
            <Eye size={10} strokeWidth={1.8} />
            {formatViewers(stream.viewerLabel)}
          </span>
        </div>
        <div className="ep-live-card__overlay">
          <p className="ep-live-card__title">{title}</p>
          {location ? (
            <span className="ep-live-card__location">
              <MapPin size={10} strokeWidth={1.8} />
              {location}
            </span>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function NearbyCard({ stream, onOpen }) {
  const title = stream.note ?? stream.role ?? stream.name;
  const location = stream.city ?? stream.place ?? '';

  return (
    <article className="ep-nearby-card" onClick={() => onOpen(stream.id)} role="button" tabIndex={0}>
      <div className="ep-nearby-card__media">
        <img
          src={stream.image ?? fallbackImage}
          alt={title}
          loading="lazy"
          onError={(e) => { e.currentTarget.src = fallbackImage; }}
        />
        <LiveBadge compact pulse />
      </div>
      <div className="ep-nearby-card__info">
        <p className="ep-nearby-card__title">{title}</p>
        <span className="ep-nearby-card__meta">
          <MapPin size={10} strokeWidth={1.8} />
          {location}
        </span>
        <span className="ep-nearby-card__viewers">
          <Eye size={10} strokeWidth={1.8} />
          {formatViewers(stream.viewerLabel)}
        </span>
        {stream.category ? <span className="ep-nearby-card__tag">{stream.category}</span> : null}
      </div>
    </article>
  );
}

function UpcomingCard({ item }) {
  const [hasReminder, setHasReminder] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const date = item.day === 'TODAY' ? `Today · ${item.time}` : `Tomorrow · ${item.time}`;

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const countdown = item.startsAt ? getCountdownState(item.startsAt, now) : null;

  return (
    <article className="ep-upcoming-card">
      <div className="ep-upcoming-card__media">
        <img
          src={item.image ?? fallbackImage}
          alt={item.title}
          loading="lazy"
          onError={(e) => { e.currentTarget.src = fallbackImage; }}
        />
        <span className="ep-upcoming-card__badge">Upcoming</span>
      </div>
      <div className="ep-upcoming-card__info">
        <p className="ep-upcoming-card__title">{item.title}</p>
        {countdown ? (
          <div style={{ marginBottom: '6px' }}>
            <span style={{ fontSize: '10px', color: 'rgba(242, 247, 246, 0.6)', textTransform: 'uppercase', fontWeight: 600 }}>
              {countdown.label}
            </span>
            {countdown.value && (
              <strong style={{ display: 'block', fontSize: '16px', color: 'var(--color-accent)', fontWeight: 700 }}>
                {countdown.value}
              </strong>
            )}
          </div>
        ) : (
          <span className="ep-upcoming-card__time">{date}</span>
        )}
        {item.locationLabel ? (
          <span className="ep-upcoming-card__loc">
            <MapPin size={10} strokeWidth={1.8} />
            {item.locationLabel}
          </span>
        ) : null}
        <button
          type="button"
          className={hasReminder ? 'ep-upcoming-card__notify is-set' : 'ep-upcoming-card__notify'}
          onClick={(e) => { e.stopPropagation(); setHasReminder((v) => !v); }}
          aria-label={hasReminder ? 'Reminder set' : 'Set reminder'}
        >
          {hasReminder ? 'Reminder on' : 'Remind me'}
        </button>
      </div>
    </article>
  );
}

function CategoryTile({ tile, onSelect }) {
  const Icon = tile.icon;
  return (
    <button
      type="button"
      className="ep-category-tile"
      style={{ '--tile-accent': tile.accent }}
      onClick={() => onSelect(tile.id)}
      aria-label={tile.label}
    >
      <span className="ep-category-tile__icon">
        <Icon size={19} strokeWidth={1.6} />
      </span>
      <strong>{tile.label}</strong>
      <span>{tile.desc}</span>
    </button>
  );
}

function CreatorCard({ creator, isFollowing, onFollow, onUnfollow, onViewProfile }) {
  return (
    <article className="ep-creator-card" onClick={() => onViewProfile(creator.id)}>
      <div className="ep-creator-card__header">
        <div className="ep-creator-card__avatar" style={{ backgroundImage: creator.photoURL ? `url(${creator.photoURL})` : 'none' }}>
          {!creator.photoURL && creator.displayName ? creator.displayName[0].toUpperCase() : ''}
        </div>
      </div>
      <div className="ep-creator-card__body">
        <strong className="ep-creator-card__name">{creator.displayName}</strong>
        <span className="ep-creator-card__handle">@{creator.username}</span>
        {creator.bio ? <p className="ep-creator-card__bio">{creator.bio}</p> : null}
      </div>
      <button
        type="button"
        className={isFollowing ? 'ep-creator-card__follow is-following' : 'ep-creator-card__follow'}
        onClick={(e) => {
          e.stopPropagation();
          isFollowing ? onUnfollow(creator.id) : onFollow(creator.id);
        }}
      >
        {isFollowing ? (
          <>
            <Check size={15} strokeWidth={2} />
            Following
          </>
        ) : (
          <>
            <Plus size={15} strokeWidth={2} />
            Follow
          </>
        )}
      </button>
    </article>
  );
}

function ExploreSection({ title, onSeeAll, children }) {
  return (
    <section className="ep-section">
      <header className="ep-section__header">
        <h2>{title}</h2>
        {onSeeAll ? (
          <button type="button" className="ep-section__see-all" onClick={onSeeAll}>
            See all
            <ChevronRight size={14} strokeWidth={2.1} />
          </button>
        ) : null}
      </header>
      {children}
    </section>
  );
}

function FilterSheet({ onClose, filters, onApply, resultCount }) {
  const [local, setLocal] = useState({ status: 'both', ...filters });
  const [activitySearch, setActivitySearch] = useState('');

  const toggle = (group, value) => {
    setLocal((prev) => {
      const current = prev[group] ?? [];
      return {
        ...prev,
        [group]: current.includes(value) ? current.filter((v) => v !== value) : [...current, value],
      };
    });
  };

  const setRadio = (group, value) => {
    setLocal((prev) => ({ ...prev, [group]: value }));
  };

  const filteredActivities = activitySearch.trim()
    ? activityChips.filter((a) => a.toLowerCase().includes(activitySearch.toLowerCase()))
    : activityChips;

  return (
    <div className="ep-filter-sheet" role="dialog" aria-modal="true" aria-label="Filter live streams">
      <button type="button" className="ep-filter-sheet__backdrop" onClick={onClose} aria-label="Close" />
      <div className="ep-filter-sheet__panel">
        <span className="ep-filter-sheet__handle" aria-hidden="true" />
        <div className="ep-filter-sheet__titlerow">
          <strong>Filter</strong>
          <button
            type="button"
            className="ep-filter-sheet__reset"
            onClick={() => setLocal({ status: 'both' })}
          >
            Reset
          </button>
        </div>

        <div className="ep-filter-sheet__groups">

          <div className="ep-filter-group">
            <p>Status</p>
            <div className="ep-filter-chips">
              {['Live now', 'Upcoming', 'Both'].map((opt) => {
                const val = opt === 'Live now' ? 'live' : opt === 'Upcoming' ? 'upcoming' : 'both';
                return (
                  <button
                    key={val}
                    type="button"
                    className={(local.status ?? 'both') === val ? 'ep-filter-chip is-active' : 'ep-filter-chip'}
                    onClick={() => setRadio('status', val)}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="ep-filter-group">
            <p>Theme</p>
            <div className="ep-filter-theme-grid">
              {themeOptions.map((opt) => {
                const Icon = opt.icon;
                const active = local.theme?.includes(opt.id);
                return (
                  <button
                    key={opt.id}
                    type="button"
                    className={active ? 'ep-theme-tile is-active' : 'ep-theme-tile'}
                    onClick={() => toggle('theme', opt.id)}
                  >
                    <span className="ep-theme-tile__icon">
                      <Icon size={18} strokeWidth={1.6} />
                    </span>
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="ep-filter-group">
            <p>Activity or job</p>
            <div className="ep-filter-search">
              <Search size={13} strokeWidth={1.9} />
              <input
                type="search"
                placeholder="Search activities..."
                value={activitySearch}
                onChange={(e) => setActivitySearch(e.target.value)}
              />
            </div>
            <div className="ep-filter-chips ep-filter-chips--wrap" style={{ marginTop: '8px' }}>
              {filteredActivities.map((act) => (
                <button
                  key={act}
                  type="button"
                  className={local.activity?.includes(act) ? 'ep-filter-chip is-active' : 'ep-filter-chip'}
                  onClick={() => toggle('activity', act)}
                >
                  {act}
                </button>
              ))}
            </div>
          </div>

          <div className="ep-filter-group">
            <p>Environment</p>
            <div className="ep-filter-chips">
              {envFilters.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={local.env?.includes(opt.family) ? 'ep-filter-chip is-active' : 'ep-filter-chip'}
                  onClick={() => toggle('env', opt.family)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="ep-filter-group">
            <p>Equipment</p>
            <div className="ep-filter-chips ep-filter-chips--wrap">
              {equipmentOptions.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  className={local.equipment?.includes(opt) ? 'ep-filter-chip is-active' : 'ep-filter-chip'}
                  onClick={() => toggle('equipment', opt)}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          <div className="ep-filter-group">
            <p>Location</p>
            <div className="ep-filter-chips">
              {locationOptions.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={local.location === opt.id ? 'ep-filter-chip is-active' : 'ep-filter-chip'}
                  onClick={() => setRadio('location', local.location === opt.id ? null : opt.id)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

        </div>

        <button
          type="button"
          className="ep-filter-sheet__apply"
          onClick={() => { onApply(local); onClose(); }}
        >
          Show {resultCount} perspective{resultCount !== 1 ? 's' : ''}
        </button>
      </div>
    </div>
  );
}

function ExploreEmptyState({ title, body, action, onAction }) {
  return (
    <div className="ep-empty">
      <strong>{title}</strong>
      {body ? <p>{body}</p> : null}
      {action ? (
        <button type="button" onClick={onAction}>{action}</button>
      ) : null}
    </div>
  );
}

function ExploreHeader({ filterCount, onOpenFilter }) {
  const [msgUnread, setMsgUnread] = useState(() => getUnreadConversationCount());

  useEffect(() => subscribeToMessaging(() => setMsgUnread(getUnreadConversationCount())), []);

  return (
    <header className="ep-header">
      <h1 className="ep-header__title">Explore</h1>
      <div className="ep-header__actions">
        <Link to="/messages" className="ep-header__icon-btn ep-header__icon-btn--msg" aria-label="Messages">
          <MessageCircle size={22} strokeWidth={2} />
          {msgUnread > 0 ? (
            <span className="ep-header__badge" aria-label={`${msgUnread} unread`}>
              {msgUnread > 9 ? '9+' : msgUnread}
            </span>
          ) : null}
        </Link>
        <button type="button" className="ep-header__icon-btn" aria-label="Notifications">
          <Bell size={20} strokeWidth={1.9} />
        </button>
        <button
          type="button"
          className={filterCount ? 'ep-header__filter-btn has-active' : 'ep-header__filter-btn'}
          onClick={onOpenFilter}
          aria-label="Open filters"
        >
          <SlidersHorizontal size={17} strokeWidth={1.9} />
          {filterCount ? <span className="ep-header__filter-dot" aria-hidden="true" /> : null}
        </button>
      </div>
    </header>
  );
}

function ExploreSearch({ search, onSearchChange, hasSearch, onSearchClear, searchInputRef }) {
  return (
    <div className="ep-search-wrap">
      <div className="ep-search">
        <Search size={15} strokeWidth={1.9} className="ep-search__icon" />
        <input
          ref={searchInputRef}
          type="search"
          className="ep-search__input"
          placeholder="Search activities, jobs, places or gear"
          value={search}
          onChange={onSearchChange}
          aria-label="Search live streams"
        />
        {hasSearch ? (
          <button
            type="button"
            className="ep-search__clear"
            onClick={onSearchClear}
            aria-label="Clear search"
          >
            <X size={14} strokeWidth={2} />
          </button>
        ) : null}
      </div>
    </div>
  );
}

export default function ExplorePage() {
  const navigate = useNavigate();
  const { user, userProfile } = useAuth();
  const [search, setSearch] = useState('');
  const [activeChip, setActiveChip] = useState('for-you');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [activeFilters, setActiveFilters] = useState({});
  const [creators, setCreators] = useState([]);
  const searchInputRef = useRef(null);
  const chipsRef = useRef(null);

  const openStream = useCallback((id) => navigate(`/watch?live=${encodeURIComponent(id)}`), [navigate]);

  const handleFollowCreator = useCallback((creatorUid) => {
    if (!user?.uid) return;
    followCreator(user.uid, creatorUid);
  }, [user?.uid]);

  const handleUnfollowCreator = useCallback((creatorUid) => {
    if (!user?.uid) return;
    unfollowCreator(user.uid, creatorUid);
  }, [user?.uid]);

  const handleViewProfile = useCallback((creatorId) => {
    navigate(`/profile/${creatorId}`);
  }, [navigate]);

  const filteredStreams = useMemo(() => {
    return streams
      .filter((s) => matchesSearch(s, search))
      .filter((s) => matchesChip(s, activeChip))
      .filter((s) => matchesFilters(s, activeFilters));
  }, [search, activeChip, activeFilters]);

  const liveNowStreams = useMemo(
    () => [...filteredStreams].sort((a, b) => viewerCount(b.viewerLabel) - viewerCount(a.viewerLabel)).slice(0, 10),
    [filteredStreams],
  );

  const nearbyStreams = useMemo(
    () => [...filteredStreams].sort((a, b) => viewerCount(b.viewerLabel) - viewerCount(a.viewerLabel)).slice(0, 6),
    [filteredStreams],
  );

  const upcomingItems = useMemo(() => upcomingStreams.slice(0, 6), []);
  const hasSearch = search.trim().length > 0;
  const filterCount = countActiveFilters(activeFilters);

  const selectChip = (id) => {
    setActiveChip(id);
    chipsRef.current?.querySelector(`[data-chip="${id}"]`)?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  };

  const selectCategory = (id) => {
    selectChip(id);
    searchInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  useEffect(() => {
    const chip = chipsRef.current?.querySelector('[data-chip="for-you"]');
    chip?.scrollIntoView({ block: 'nearest', inline: 'start', behavior: 'instant' });
  }, []);

  useEffect(() => {
    if (!search.trim().startsWith('@')) {
      setCreators([]);
      return;
    }
    const query = search.trim().slice(1);
    if (query.length === 0) {
      setCreators([]);
      return;
    }
    searchCreators(query).then(setCreators).catch(() => setCreators([]));
  }, [search]);

  useEffect(() => {
    const scrollEl = document.querySelector('.ep-screen');
    if (!scrollEl) return;

    const onKeyDown = (event) => {
      const scrollAmount = 180;
      if (event.key === 'ArrowDown' || event.key === 'PageDown') {
        event.preventDefault();
        scrollEl.scrollTop += scrollAmount;
      } else if (event.key === 'ArrowUp' || event.key === 'PageUp') {
        event.preventDefault();
        scrollEl.scrollTop -= scrollAmount;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <section className="screen-scroll ep-screen" aria-label="Explore">

      <ExploreHeader
        filterCount={filterCount}
        onOpenFilter={() => setFiltersOpen(true)}
      />

      <ExploreSearch
        search={search}
        onSearchChange={(e) => setSearch(e.target.value)}
        hasSearch={hasSearch}
        onSearchClear={() => setSearch('')}
        searchInputRef={searchInputRef}
      />

      <div ref={chipsRef} className="ep-chips" role="group" aria-label="Quick filters">
        {quickFilters.map((chip) => (
          <button
            key={chip.id}
            type="button"
            data-chip={chip.id}
            className={activeChip === chip.id ? 'ep-chip is-active' : 'ep-chip'}
            onClick={() => selectChip(chip.id)}
            aria-pressed={activeChip === chip.id}
          >
            {chip.label}
          </button>
        ))}
      </div>

      <main className="ep-content">
        {hasSearch ? (
          <div className="ep-search-results">
            {search.trim().startsWith('@') ? (
              <>
                {creators.length > 0 ? (
                  <>
                    <p className="ep-results-count">{creators.length} creator{creators.length !== 1 ? 's' : ''}</p>
                    <div className="ep-creators-grid">
                      {creators.map((creator) => (
                        <CreatorCard
                          key={creator.id}
                          creator={creator}
                          isFollowing={userProfile?.followedCreators?.includes(creator.id) || false}
                          onFollow={handleFollowCreator}
                          onUnfollow={handleUnfollowCreator}
                          onViewProfile={handleViewProfile}
                        />
                      ))}
                    </div>
                  </>
                ) : (
                  <ExploreEmptyState
                    title="No creators found"
                    body="Try searching for another creator."
                    action="Clear search"
                    onAction={() => setSearch('')}
                  />
                )}
              </>
            ) : (
              <>
                {filteredStreams.length ? (
                  <>
                    <p className="ep-results-count">{filteredStreams.length} perspectives</p>
                    <div className="ep-results-grid">
                      {filteredStreams.map((stream) => (
                        <LiveNowCard key={stream.id} stream={stream} onOpen={openStream} />
                      ))}
                    </div>
                  </>
                ) : (
                  <ExploreEmptyState
                    title="No live perspectives found"
                    body="Try another activity, place or filter."
                    action="Reset search"
                    onAction={() => setSearch('')}
                  />
                )}
              </>
            )}
          </div>
        ) : (
          <>
            <ExploreSection title="Live now" onSeeAll={() => navigate('/explore/live')}>
              {liveNowStreams.length ? (
                <div className="ep-live-row">
                  {liveNowStreams.map((stream) => (
                    <LiveNowCard key={stream.id} stream={stream} onOpen={openStream} />
                  ))}
                </div>
              ) : (
                <ExploreEmptyState
                  title="No live streams right now"
                  body="Explore upcoming perspectives or try another category."
                />
              )}
            </ExploreSection>

            <ExploreSection title="Live nearby" onSeeAll={() => navigate('/explore/live')}>
              {nearbyStreams.length ? (
                <div className="ep-nearby-row">
                  {nearbyStreams.map((stream) => (
                    <NearbyCard key={stream.id} stream={stream} onOpen={openStream} />
                  ))}
                </div>
              ) : (
                <ExploreEmptyState
                  title="Nothing live nearby yet"
                  body="Try expanding your location or browse worldwide."
                />
              )}
            </ExploreSection>

            {upcomingItems.length ? (
            <ExploreSection title="Upcoming" onSeeAll={() => navigate('/explore/live')}>
                <div className="ep-upcoming-row">
                  {upcomingItems.map((item) => (
                    <UpcomingCard key={item.id} item={item} />
                  ))}
                </div>
              </ExploreSection>
            ) : null}

            <ExploreSection title="Browse by category">
              <div className="ep-category-grid">
                {categoryTiles.map((tile) => (
                  <CategoryTile key={tile.id} tile={tile} onSelect={selectCategory} />
                ))}
              </div>
            </ExploreSection>
          </>
        )}
      </main>

      {filtersOpen ? (
        <FilterSheet
          onClose={() => setFiltersOpen(false)}
          filters={activeFilters}
          onApply={setActiveFilters}
          resultCount={filteredStreams.length}
        />
      ) : null}
    </section>
  );
}
