import {
  Bell,
  Briefcase,
  CalendarClock,
  ChevronRight,
  Clock,
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
  Play,
  Plus,
  Radio,
  Search,
  Share2,
  SlidersHorizontal,
  Smartphone,
  Truck,
  UsersRound,
  UserRound,
  UtensilsCrossed,
  X,
  Zap,
  Check,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LiveBadge from '../components/LiveBadge.jsx';
import CreatorLink from '../components/CreatorLink.jsx';
import { streams, upcomingStreams } from '../data/mockStreams.js';
import { useMessaging } from '../context/MessagingContext.jsx';
import { searchCreators, followCreator, unfollowCreator } from '../services/creatorService.js';
import { useAuth } from '../context/AuthContext.jsx';
import { subscribeToCreatedLives } from '../services/createdLiveService.js';
import { getCountdownState, makeCountdownLabels } from '../utils/countdown.js';
import { analyticsService } from '../services/analytics/analyticsService.ts';
import { useNotifications } from '../hooks/useNotifications.js';
import { getUpcomingReminders, removeUpcomingReminder, saveUpcomingReminder } from '../services/upcomingReminderService.js';
import { shareVuvioContent } from '../platform/sharing.js';
import NotifPopover from '../components/NotifPopover.jsx';

const chipCategories = {
  jobs: ['City', 'Craft', 'Cuisine'],
  sports: ['Sport', 'Nature', 'Sky', 'Water'],
  crafts: ['Craft', 'Cuisine'],
  'city-tours': ['City Tours'],
  travel: ['Travel', 'City Tours'],
  nature: ['Nature', 'Water'],
  music: [],
};

const activityChipIds = [
  'fishing', 'surfing', 'cycling', 'hiking', 'skiing',
  'cooking', 'architecture', 'medicine', 'pottery', 'photography',
  'tourGuide', 'farming', 'carpentry', 'welding', 'sailing',
];

const equipmentOptionIds = ['gopro', 'drone', 'bicycle', 'smartphone', 'boat', 'motorbike'];

const fallbackImage = '/assets/icons/icon-512.png';

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

function prefetchManifest(url) {
  if (!url) return;
  try {
    const existing = [...document.querySelectorAll('link[rel="prefetch"]')].some((l) => l.href === url);
    if (existing) return;
    const el = document.createElement('link');
    el.rel = 'prefetch';
    el.href = url;
    document.head.appendChild(el);
  } catch {}
}

function LiveNowCard({ stream, onOpen }) {
  const title = stream.note ?? stream.role ?? stream.name;
  const location = [stream.city, stream.country].filter(Boolean).join(', ');

  return (
    <article className="ep-live-card" onClick={() => onOpen(stream.id)} onKeyDown={(event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onOpen(stream.id);
      }
    }} onMouseEnter={() => prefetchManifest(stream.hlsManifestUrl)} role="button" tabIndex={0}>
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
          {stream.name ? (
            <div className="ep-live-card__creator">
              <span className="ep-live-card__creator-avatar">
                {stream.photoURL ? (
                  <img src={stream.photoURL} alt={stream.name} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                ) : stream.name[0].toUpperCase()}
              </span>
              <span className="ep-live-card__creator-name">{stream.name}</span>
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function NearbyCard({ stream, onOpen }) {
  const title = stream.note ?? stream.role ?? stream.name;
  const location = [stream.city, stream.country].filter(Boolean).join(', ') || stream.place || '';

  return (
    <article className="ep-nearby-card" onClick={() => onOpen(stream.id)} onKeyDown={(event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onOpen(stream.id);
      }
    }} onMouseEnter={() => prefetchManifest(stream.hlsManifestUrl)} role="button" tabIndex={0}>
      <div className="ep-nearby-card__media">
        <img
          src={stream.image ?? fallbackImage}
          alt={title}
          loading="lazy"
          onError={(e) => { e.currentTarget.src = fallbackImage; }}
        />
        <div className="ep-nearby-card__top">
          <LiveBadge compact pulse />
        </div>
        <div className="ep-nearby-card__overlay">
          <p className="ep-nearby-card__title">{title}</p>
          {location ? (
            <span className="ep-nearby-card__location">
              <MapPin size={10} strokeWidth={1.8} />
              {location}
            </span>
          ) : null}
          {stream.name ? (
            <div className="ep-nearby-card__creator">
              <span className="ep-nearby-card__creator-avatar">
                {stream.photoURL ? (
                  <img src={stream.photoURL} alt={stream.name} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                ) : stream.name[0].toUpperCase()}
              </span>
              <span className="ep-nearby-card__creator-name">{stream.name}</span>
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function UpcomingCard({ item, onOpen, onRemind, isReminded = false }) {
  const { t } = useTranslation();
  const cLabels = makeCountdownLabels(t);
  const [hasReminder, setHasReminder] = useState(isReminded);
  useEffect(() => { setHasReminder(isReminded); }, [isReminded]);
  const [now, setNow] = useState(() => new Date());
  const date = item.day === 'TODAY'
    ? t('explore.dateToday', { time: item.time })
    : t('explore.dateTomorrow', { time: item.time });

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const countdown = item.startsAt ? getCountdownState(item.startsAt, now, cLabels) : null;

  return (
    <article
      className="ep-upcoming-card"
      onClick={() => onOpen(item)}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpen(item);
        }
      }}
      role="button"
      tabIndex={0}
      style={{ cursor: 'pointer' }}
    >
      <div className="ep-upcoming-card__media">
        <img
          src={item.image ?? fallbackImage}
          alt={item.title}
          loading="lazy"
          onError={(e) => { e.currentTarget.src = fallbackImage; }}
        />
        <span className="ep-upcoming-card__badge">{t('explore.upcomingBadge')}</span>
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
          onClick={(e) => {
            e.stopPropagation();
            onRemind?.(item);
          }}
          aria-label={hasReminder ? t('explore.reminderSet') : t('explore.setReminder')}
        >
          {hasReminder ? t('explore.reminderOn') : t('explore.remindMe')}
        </button>
      </div>
    </article>
  );
}

function UpcomingDetailSheet({ item, onClose, onWatch, onRemind, isReminded = false }) {
  const { t } = useTranslation();
  const cLabels = makeCountdownLabels(t);
  const [hasReminder, setHasReminder] = useState(isReminded);
  const [shareStatus, setShareStatus] = useState('');
  useEffect(() => { setHasReminder(isReminded); }, [isReminded]);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const countdown = item.startsAt ? getCountdownState(item.startsAt, now, cLabels) : null;
  const startsAt = item.startsAt ? new Date(item.startsAt) : null;
  const isLive = startsAt ? startsAt <= now : false;
  const dateLabel = startsAt
    ? startsAt.toLocaleString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' })
    : item.day === 'TODAY'
      ? t('explore.dateToday', { time: item.time })
      : t('explore.dateTomorrow', { time: item.time });
  const place = item.locationLabel ?? t('explore.locationTbc');
  const creatorName = item.creatorName ?? 'Vuvio creator';
  const creator = { ...item, name: creatorName, place, status: 'upcoming' };
  const povLabel = item.povType === 'vehicle'
    ? t('explore.povVehicle')
    : item.povType === 'fixed'
      ? t('explore.povFixed')
      : t('explore.liveTitleFallback');
  const interested = typeof item.interestedCount === 'number'
    ? (item.interestedCount + (hasReminder ? 1 : 0)).toLocaleString()
    : '';

  return (
    <div className="home-upcoming-sheet" role="dialog" aria-modal="true" aria-label={t('explore.detailsFor', { title: item.title })}>
      <button type="button" className="home-upcoming-sheet__backdrop" onClick={onClose} aria-label={t('explore.close')} />
      <section className="home-upcoming-sheet__panel">
        <header>
          <div>
            <span className={isLive ? 'home-upcoming-badge home-upcoming-badge--live' : 'home-upcoming-badge'}>
              {isLive ? t('explore.liveNow') : t('explore.upcomingBadge')}
            </span>
            <h2>{item.title}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label={t('explore.close')}>
            <X size={18} strokeWidth={1.9} />
          </button>
        </header>
        <img src={item.image ?? fallbackImage} alt={item.title} loading="lazy" decoding="async" />
        <div className="home-upcoming-sheet__meta">
          <p><MapPin size={15} strokeWidth={1.9} /> {place}</p>
          <p><CalendarClock size={15} strokeWidth={1.9} /> {dateLabel}</p>
          <p><Clock size={15} strokeWidth={1.9} /> {povLabel}</p>
          {interested ? <p><UsersRound size={15} strokeWidth={1.9} /> {t('explore.interestedCount', { count: interested })}</p> : null}
        </div>
        {countdown ? (
          <div className="home-countdown home-countdown--sheet" aria-label={countdown.ariaLabel}>
            <span>{countdown.label}</span>
            {countdown.value ? <strong>{countdown.value}</strong> : null}
          </div>
        ) : null}
        <p className="home-upcoming-sheet__description">{item.description ?? t('explore.detailsBeforeLive')}</p>
        <div className="home-upcoming-creator">
          <CreatorLink creator={creator} stopPropagation showMeta metaLabel={`${povLabel} · ${place}`} />
          <p>{item.livePlan ?? item.description ?? `${creatorName} will share this POV live from ${place}.`}</p>
        </div>
        <div className="home-upcoming-sheet__actions">
          <button
            type="button"
            className={hasReminder ? 'is-active' : ''}
            onClick={() => {
              if (isLive) {
                onWatch(item.id);
              } else {
                onRemind?.(item);
              }
            }}
          >
            {isLive ? <Play size={15} fill="currentColor" strokeWidth={1.8} /> : <Bell size={15} strokeWidth={1.9} />}
            {isLive ? t('common.watch') : hasReminder ? t('explore.reminderOn') : t('common.notifyMe')}
          </button>
          <button type="button" onClick={async () => {
            const result = await shareVuvioContent({
              title: item.title,
              text: item.description,
              url: `/explore/upcoming?live=${encodeURIComponent(item.id)}`,
            });
            if (!result.cancelled) setShareStatus(result.success ? (result.fallback === 'copied' ? t('explore.linkCopied') : t('explore.shared')) : t('explore.shareFailed'));
          }}>
            <Share2 size={15} strokeWidth={1.9} />
            {shareStatus || t('common.share')}
          </button>
        </div>
      </section>
    </div>
  );
}

function CategoryTile({ tile, onSelect }) {
  const Icon = tile.icon;
  return (
    <button
      type="button"
      className={tile.comingSoon ? 'ep-category-tile ep-category-tile--soon' : 'ep-category-tile'}
      style={{ '--tile-accent': tile.accent }}
      onClick={tile.comingSoon ? undefined : () => onSelect(tile.id)}
      aria-label={tile.label}
      aria-disabled={tile.comingSoon}
    >
      <span className="ep-category-tile__icon">
        <Icon size={19} strokeWidth={1.6} />
      </span>
      <strong>{tile.label}</strong>
      <span>{tile.desc}</span>
      {tile.comingSoon ? <span className="ep-category-tile__soon">Bientôt</span> : null}
      {tile.comingSoon ? <span className="ep-category-tile__tooltip">Découvre un quartier ou lieu à travers les yeux d'un guide local</span> : null}
    </button>
  );
}

function CreatorCard({ creator, isFollowing, onFollow, onUnfollow, onViewProfile }) {
  const { t } = useTranslation();
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
            {t('common.following')}
          </>
        ) : (
          <>
            <Plus size={15} strokeWidth={2} />
            {t('common.follow')}
          </>
        )}
      </button>
    </article>
  );
}

function ExploreSection({ title, onSeeAll, children }) {
  const { t } = useTranslation();
  return (
    <section className="ep-section">
      <header className="ep-section__header">
        <h2>{title}</h2>
        {onSeeAll ? (
          <button type="button" className="ep-section__see-all" onClick={onSeeAll}>
            {t('explore.seeAll')}
            <ChevronRight size={14} strokeWidth={2.1} />
          </button>
        ) : null}
      </header>
      {children}
    </section>
  );
}

function FilterSheet({ onClose, filters, onApply, resultCount }) {
  const { t } = useTranslation();
  const [local, setLocal] = useState({ status: 'both', ...filters });
  const [activitySearch, setActivitySearch] = useState('');

  const themeOptions = useMemo(() => ([
    { id: 'food', label: t('explore.themes.food'), icon: UtensilsCrossed },
    { id: 'adventure', label: t('explore.themes.adventure'), icon: Mountain },
    { id: 'transport', label: t('explore.themes.transport'), icon: Truck },
    { id: 'nature', label: t('explore.themes.nature'), icon: Leaf },
    { id: 'art', label: t('explore.themes.art'), icon: Palette },
    { id: 'music', label: t('explore.themes.music'), icon: Music },
    { id: 'daily', label: t('explore.themes.daily'), icon: Home },
    { id: 'tech', label: t('explore.themes.tech'), icon: Smartphone },
  ]), [t]);

  const envFilters = useMemo(() => ([
    { id: 'air', label: t('explore.filtersList.air'), family: 'air' },
    { id: 'earth', label: t('explore.filtersList.land'), family: 'earth' },
    { id: 'water', label: t('explore.filtersList.water'), family: 'water' },
  ]), [t]);

  const equipmentOptions = useMemo(
    () => equipmentOptionIds.map((id) => ({ id, label: t(`explore.equipment.${id}`) })),
    [t],
  );

  const locationOptions = useMemo(() => ([
    { id: 'nearby', label: t('explore.locations.nearby') },
    { id: 'city', label: t('explore.locations.city') },
    { id: 'country', label: t('explore.locations.country') },
    { id: 'worldwide', label: t('explore.locations.worldwide') },
  ]), [t]);

  const activityChips = useMemo(
    () => activityChipIds.map((id) => ({ id, label: t(`explore.activities.${id}`) })),
    [t],
  );

  const statusOptions = useMemo(() => ([
    { value: 'live', label: t('explore.statusLiveNow') },
    { value: 'upcoming', label: t('explore.upcomingBadge') },
    { value: 'both', label: t('explore.statusBoth') },
  ]), [t]);

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
    ? activityChips.filter((a) => a.label.toLowerCase().includes(activitySearch.toLowerCase()))
    : activityChips;

  return (
    <div className="ep-filter-sheet" role="dialog" aria-modal="true" aria-label={t('explore.filterSheetAria')}>
      <button type="button" className="ep-filter-sheet__backdrop" onClick={onClose} aria-label={t('explore.close')} />
      <div className="ep-filter-sheet__panel">
        <span className="ep-filter-sheet__handle" aria-hidden="true" />
        <div className="ep-filter-sheet__titlerow">
          <strong>{t('explore.filterTitle')}</strong>
          <button
            type="button"
            className="ep-filter-sheet__reset"
            onClick={() => setLocal({ status: 'both' })}
          >
            {t('explore.reset')}
          </button>
        </div>

        <div className="ep-filter-sheet__groups">

          <div className="ep-filter-group">
            <p>{t('explore.groupStatus')}</p>
            <div className="ep-filter-chips">
              {statusOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={(local.status ?? 'both') === opt.value ? 'ep-filter-chip is-active' : 'ep-filter-chip'}
                  onClick={() => setRadio('status', opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="ep-filter-group">
            <p>{t('explore.groupTheme')}</p>
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
            <p>{t('explore.groupActivity')}</p>
            <div className="ep-filter-search">
              <Search size={13} strokeWidth={1.9} />
              <input
                type="search"
                placeholder={t('explore.searchActivitiesPlaceholder')}
                value={activitySearch}
                onChange={(e) => setActivitySearch(e.target.value)}
              />
            </div>
            <div className="ep-filter-chips ep-filter-chips--wrap" style={{ marginTop: '8px' }}>
              {filteredActivities.map((act) => (
                <button
                  key={act.id}
                  type="button"
                  className={local.activity?.includes(act.id) ? 'ep-filter-chip is-active' : 'ep-filter-chip'}
                  onClick={() => toggle('activity', act.id)}
                >
                  {act.label}
                </button>
              ))}
            </div>
          </div>

          <div className="ep-filter-group">
            <p>{t('explore.groupEnvironment')}</p>
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
            <p>{t('explore.groupEquipment')}</p>
            <div className="ep-filter-chips ep-filter-chips--wrap">
              {equipmentOptions.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={local.equipment?.includes(opt.id) ? 'ep-filter-chip is-active' : 'ep-filter-chip'}
                  onClick={() => toggle('equipment', opt.id)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="ep-filter-group">
            <p>{t('explore.groupLocation')}</p>
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
          {t('explore.showResults', { count: resultCount })}
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

function ExploreHeader({ filterCount, onOpenFilter, notifUnread, notifications, notifsLoading, markRead, markAllRead }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { unreadCount: msgUnread } = useMessaging();
  const [notifOpen, setNotifOpen] = useState(false);

  const handleNavigate = (target) => { setNotifOpen(false); navigate(target); };

  return (
    <header className="ep-header">
      <h1 className="ep-header__title">{t('explore.title')}</h1>
      <div className="ep-header__actions">
        <Link to="/messages" className="ep-header__icon-btn ep-header__icon-btn--msg" aria-label={t('explore.messagesAria')}>
          <MessageCircle size={22} strokeWidth={2} />
          {msgUnread > 0 ? (
            <span className="ep-header__badge" aria-label={t('explore.unreadCount', { count: msgUnread })}>
              {msgUnread > 9 ? '9+' : msgUnread}
            </span>
          ) : null}
        </Link>
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            className="ep-header__icon-btn ep-header__icon-btn--notif"
            aria-label={t('explore.notificationsAria')}
            onClick={() => setNotifOpen((v) => !v)}
          >
            <Bell size={20} strokeWidth={1.9} />
            {notifUnread > 0 ? (
              <span className="ep-header__badge" aria-label={t('explore.unreadCount', { count: notifUnread })}>
                {notifUnread > 9 ? '9+' : notifUnread}
              </span>
            ) : null}
          </button>
          {notifOpen ? (
            <NotifPopover
              notifications={notifications}
              loading={notifsLoading}
              unreadCount={notifUnread}
              markRead={markRead}
              markAllRead={markAllRead}
              onClose={() => setNotifOpen(false)}
              onNavigate={handleNavigate}
            />
          ) : null}
        </div>
        <button
          type="button"
          className={filterCount ? 'ep-header__filter-btn has-active' : 'ep-header__filter-btn'}
          onClick={onOpenFilter}
          aria-label={t('explore.openFiltersAria')}
        >
          <SlidersHorizontal size={17} strokeWidth={1.9} />
          {filterCount ? <span className="ep-header__filter-dot" aria-hidden="true" /> : null}
        </button>
      </div>
    </header>
  );
}

function ExploreSearch({ search, onSearchChange, hasSearch, onSearchClear, searchInputRef }) {
  const { t } = useTranslation();
  return (
    <div className="ep-search-wrap">
      <div className="ep-search">
        <Search size={15} strokeWidth={1.9} className="ep-search__icon" />
        <input
          ref={searchInputRef}
          type="search"
          className="ep-search__input"
          placeholder={t('explore.searchPlaceholder')}
          value={search}
          onChange={onSearchChange}
          aria-label={t('explore.searchAria')}
        />
        {hasSearch ? (
          <button
            type="button"
            className="ep-search__clear"
            onClick={onSearchClear}
            aria-label={t('explore.clearSearch')}
          >
            <X size={14} strokeWidth={2} />
          </button>
        ) : null}
      </div>
    </div>
  );
}

export default function ExplorePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, userProfile } = useAuth();
  const { notifications, unreadCount: notifUnread, loading: notifsLoading, markRead, markAllRead } = useNotifications();
  const [search, setSearch] = useState('');
  const [activeChip, setActiveChip] = useState('for-you');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [activeFilters, setActiveFilters] = useState({});
  const [creators, setCreators] = useState([]);
  const [optimisticFollows, setOptimisticFollows] = useState(() => new Set());
  const [optimisticUnfollows, setOptimisticUnfollows] = useState(() => new Set());
  const [firestoreLives, setFirestoreLives] = useState([]);
  const [openUpcoming, setOpenUpcoming] = useState(null);
  const [remindedIds, setRemindedIds] = useState(() => new Set(Object.keys(getUpcomingReminders())));
  const searchInputRef = useRef(null);
  const chipsRef = useRef(null);
  const liveRowRef = useRef(null);

  const quickFilters = useMemo(() => ([
    { id: 'for-you', label: t('explore.quickFilters.forYou') },
    { id: 'nearby', label: t('explore.quickFilters.nearby') },
    { id: 'jobs', label: t('explore.quickFilters.jobs') },
    { id: 'sports', label: t('explore.quickFilters.sports') },
    { id: 'crafts', label: t('explore.quickFilters.crafts') },
    { id: 'travel', label: t('explore.quickFilters.travel') },
    { id: 'nature', label: t('explore.quickFilters.nature') },
    { id: 'music', label: t('explore.quickFilters.music') },
  ]), [t]);

  const categoryTiles = useMemo(() => ([
    { id: 'jobs', label: t('explore.categoryTiles.jobs.label'), desc: t('explore.categoryTiles.jobs.desc'), icon: Briefcase, accent: 'var(--vuvio-cyan)' },
    { id: 'sports', label: t('explore.categoryTiles.sports.label'), desc: t('explore.categoryTiles.sports.desc'), icon: Zap, accent: 'var(--vuvio-blue)' },
    { id: 'crafts', label: t('explore.categoryTiles.crafts.label'), desc: t('explore.categoryTiles.crafts.desc'), icon: Hammer, accent: 'var(--vuvio-orange)' },
    { id: 'nature', label: t('explore.categoryTiles.nature.label'), desc: t('explore.categoryTiles.nature.desc'), icon: Leaf, accent: '#4cd97b' },
    { id: 'food', label: t('explore.categoryTiles.food.label'), desc: t('explore.categoryTiles.food.desc'), icon: UtensilsCrossed, accent: 'var(--vuvio-orange)' },
    { id: 'transport', label: t('explore.categoryTiles.transport.label'), desc: t('explore.categoryTiles.transport.desc'), icon: Truck, accent: 'var(--vuvio-blue)' },
    { id: 'travel', label: t('explore.categoryTiles.travel.label'), desc: t('explore.categoryTiles.travel.desc'), icon: Globe, accent: 'var(--vuvio-cyan)' },
    { id: 'city-tours', label: t('explore.categoryTiles.cityTours.label'), desc: t('explore.categoryTiles.cityTours.desc'), icon: MapPin, accent: 'var(--vuvio-cyan)', comingSoon: true },
    { id: 'music', label: t('explore.categoryTiles.music.label'), desc: t('explore.categoryTiles.music.desc'), icon: Music, accent: 'var(--vuvio-orange)' },
  ]), [t]);

  const openStream = useCallback((id) => navigate(`/watch?live=${encodeURIComponent(id)}&mode=view`), [navigate]);

  const handleFollowCreator = useCallback((creatorUid) => {
    if (!user?.uid) return;
    setOptimisticFollows((prev) => new Set([...prev, creatorUid]));
    setOptimisticUnfollows((prev) => { const s = new Set(prev); s.delete(creatorUid); return s; });
    followCreator(user.uid, creatorUid);
  }, [user?.uid]);

  const handleUnfollowCreator = useCallback((creatorUid) => {
    if (!user?.uid) return;
    setOptimisticUnfollows((prev) => new Set([...prev, creatorUid]));
    setOptimisticFollows((prev) => { const s = new Set(prev); s.delete(creatorUid); return s; });
    unfollowCreator(user.uid, creatorUid);
  }, [user?.uid]);

  const handleViewProfile = useCallback((creatorId) => {
    analyticsService.trackCreatorProfileOpened(creatorId, undefined, 'explore');
    navigate(`/profile/${creatorId}`);
  }, [navigate]);

  const handleRemind = useCallback((item) => {
    const next = !getUpcomingReminders()[item.id];
    if (next) saveUpcomingReminder(item).catch(() => {
      setRemindedIds((current) => {
        const updated = new Set(current);
        updated.delete(item.id);
        return updated;
      });
    });
    else removeUpcomingReminder(item.id);
    setRemindedIds((current) => {
      const updated = new Set(current);
      if (next) updated.add(item.id);
      else updated.delete(item.id);
      return updated;
    });
  }, []);

  const filteredStreams = useMemo(() => {
    return streams
      .filter((s) => matchesSearch(s, search))
      .filter((s) => matchesChip(s, activeChip))
      .filter((s) => matchesFilters(s, activeFilters));
  }, [search, activeChip, activeFilters]);

  const realLives = useMemo(
    () => firestoreLives
      .filter((l) => l.status === 'live')
      .map((l) => ({
        ...l,
        note: l.experienceTitle || l.title || l.name,
        image: l.image || l.coverImageUrl || l.thumbnailUrl,
        viewerLabel: l.currentViewerCount ? String(l.currentViewerCount) : '0',
      })),
    [firestoreLives],
  );

  const prevRealLivesCountRef = useRef(0);
  useEffect(() => {
    if (realLives.length > prevRealLivesCountRef.current) {
      liveRowRef.current?.scrollTo({ left: 0, behavior: 'smooth' });
    }
    prevRealLivesCountRef.current = realLives.length;
  }, [realLives.length]);

  const liveNowStreams = useMemo(() => {
    const mockIds = new Set(realLives.map((l) => l.id));
    const hasVideo = (s) => Boolean(s.video || s.hlsManifestUrl);
    const mocks = filteredStreams
      .filter((s) => !mockIds.has(s.id))
      .sort((a, b) => {
        const va = hasVideo(a) ? 0 : 1;
        const vb = hasVideo(b) ? 0 : 1;
        if (va !== vb) return va - vb;
        const ha = ((a.id ?? '').charCodeAt(0) * 31 + (a.id ?? '').charCodeAt(1)) | 0;
        const hb = ((b.id ?? '').charCodeAt(0) * 31 + (b.id ?? '').charCodeAt(1)) | 0;
        return ha - hb;
      });
    return [...realLives, ...mocks].slice(0, 10);
  }, [filteredStreams, realLives]);

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

  useEffect(() => subscribeToCreatedLives(setFirestoreLives), []);

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
    <section className="screen-scroll ep-screen" aria-label={t('explore.screenAria')}>

      <ExploreHeader
        filterCount={filterCount}
        onOpenFilter={() => setFiltersOpen(true)}
        notifUnread={notifUnread}
        notifications={notifications}
        notifsLoading={notifsLoading}
        markRead={markRead}
        markAllRead={markAllRead}
      />

      <ExploreSearch
        search={search}
        onSearchChange={(e) => setSearch(e.target.value)}
        hasSearch={hasSearch}
        onSearchClear={() => setSearch('')}
        searchInputRef={searchInputRef}
      />

      <div ref={chipsRef} className="ep-chips" role="group" aria-label={t('explore.quickFiltersAria')}>
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
                    <p className="ep-results-count">{t('explore.creatorCount', { count: creators.length })}</p>
                    <div className="ep-creators-grid">
                      {creators.map((creator) => (
                        <CreatorCard
                          key={creator.id}
                          creator={creator}
                          isFollowing={(userProfile?.followedCreators?.includes(creator.id) || optimisticFollows.has(creator.id)) && !optimisticUnfollows.has(creator.id)}
                          onFollow={handleFollowCreator}
                          onUnfollow={handleUnfollowCreator}
                          onViewProfile={handleViewProfile}
                        />
                      ))}
                    </div>
                  </>
                ) : (
                  <ExploreEmptyState
                    title={t('explore.noCreatorsFound')}
                    body={t('explore.tryAnotherCreator')}
                    action={t('explore.clearSearch')}
                    onAction={() => setSearch('')}
                  />
                )}
              </>
            ) : (
              <>
                {filteredStreams.length ? (
                  <>
                    <p className="ep-results-count">{t('explore.perspectivesCount', { count: filteredStreams.length })}</p>
                    <div className="ep-results-grid">
                      {filteredStreams.map((stream, index) => (
                        <LiveNowCard key={stream.id} stream={stream} onOpen={(id) => {
                          analyticsService.trackStreamImpression(id, stream.creatorId || id, 'explore', index);
                          openStream(id);
                        }} />
                      ))}
                    </div>
                  </>
                ) : (
                  <ExploreEmptyState
                    title={t('explore.noPerspectivesFound')}
                    body={t('explore.tryAnotherFilter')}
                    action={t('explore.resetSearch')}
                    onAction={() => setSearch('')}
                  />
                )}
              </>
            )}
          </div>
        ) : (
          <>
            <ExploreSection title={t('explore.sectionLiveNow')} onSeeAll={() => navigate('/explore/live')}>
              {liveNowStreams.length ? (
                <div className="ep-live-row" ref={liveRowRef}>
                  {liveNowStreams.map((stream, index) => (
                    <LiveNowCard key={stream.id} stream={stream} onOpen={(id) => {
                      analyticsService.trackStreamImpression(id, stream.creatorId || id, 'explore', index);
                      openStream(id);
                    }} />
                  ))}
                </div>
              ) : (
                <ExploreEmptyState
                  title={t('explore.noLiveStreamsRightNow')}
                  body={t('explore.exploreUpcomingOrCategory')}
                />
              )}
            </ExploreSection>

            <ExploreSection title={t('explore.sectionLiveNearby')} onSeeAll={() => navigate('/explore/live')}>
              {nearbyStreams.length ? (
                <div className="ep-nearby-row">
                  {nearbyStreams.map((stream, index) => (
                    <NearbyCard key={stream.id} stream={stream} onOpen={(id) => {
                      analyticsService.trackStreamImpression(id, stream.creatorId || id, 'explore', index);
                      openStream(id);
                    }} />
                  ))}
                </div>
              ) : (
                <ExploreEmptyState
                  title={t('explore.nothingLiveNearby')}
                  body={t('explore.expandLocationOrWorldwide')}
                />
              )}
            </ExploreSection>

            {upcomingItems.length ? (
            <ExploreSection title={t('explore.sectionUpcoming')} onSeeAll={() => navigate('/explore/upcoming')}>
                <div className="ep-upcoming-row">
                  {upcomingItems.map((item) => (
                    <UpcomingCard key={item.id} item={item} onOpen={setOpenUpcoming} onRemind={handleRemind} isReminded={remindedIds.has(item.id)} />
                  ))}
                </div>
              </ExploreSection>
            ) : null}

            <ExploreSection title={t('explore.sectionBrowseByCategory')}>
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

      {openUpcoming ? (
        <UpcomingDetailSheet
          item={openUpcoming}
          onClose={() => setOpenUpcoming(null)}
          onWatch={(id) => { setOpenUpcoming(null); openStream(id); }}
          onRemind={handleRemind}
          isReminded={remindedIds.has(openUpcoming.id)}
        />
      ) : null}
    </section>
  );
}
