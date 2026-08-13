import Hls from 'hls.js';
import { Backpack, BatteryWarning, Bell, CalendarClock, Camera, Check, ChevronLeft, ChevronRight, ChevronUp, Clock, Eye, Flag, Flashlight, Lock, MapPin, MessageCircle, Mic, MicOff, Play, RotateCcw, Search, Send, Settings, Share2, ShieldBan, Square, Star, Trash2, UnlockKeyhole, UserPlus, UserRound, UsersRound, Volume2, VolumeX, WifiOff, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useStreamView } from '../hooks/useStreamView';
import { analyticsService } from '../services/analytics';
import BrandMark from '../components/BrandMark.jsx';
import CreatorLink from '../components/CreatorLink.jsx';
import { EquipmentViewerSheet } from '../components/equipment/EquipmentKit.jsx';
import ShareLiveSheet from '../components/ShareLiveSheet.jsx';
import LiveShareBanner from '../components/LiveShareBanner.jsx';
import LiveBadge from '../components/LiveBadge.jsx';
import SegmentedControl from '../components/SegmentedControl.jsx';
import { LivePresenceOverlay } from '../components/social/LivePresenceOverlay.jsx';
import { lives } from '../data/lives.js';
import { mapStreams } from '../data/mapStreams.js';
import { streams, upcomingStreams } from '../data/mockStreams.js';
import { getCreatedLives, getCreatedLiveStream, subscribeToCreatedLives, publishLivePing, updateCreatedLive } from '../services/createdLiveService.js';
import { startBroadcast, stopBroadcast, stopBroadcastSync, watchBroadcast, closePeer, getLocalStream, getRemoteStream, startWhepPlayback, stopWhepPlayback } from '../services/webrtcService.js';
import { collection, doc, onSnapshot, query, where, getDocs, getDoc, addDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { getDownloadURL, ref as storageRef, uploadString } from 'firebase/storage';
import { db, storage } from '../firebase.js';
import { useAuth } from '../context/AuthContext.jsx';
import { getUnreadConversationCount, subscribeToMessaging } from '../services/messagingService.js';
import { getUpcomingReminders, saveUpcomingReminder } from '../services/upcomingReminderService.js';
import { demoLiveEquipmentIds } from '../data/equipmentModel.js';
import { getEquipmentLibrary, getEquipmentLibraryWithProducts, getEquipmentSelection } from '../services/equipmentService.js';
import { formatLocalSchedule, getCountdownState, toValidDate } from '../utils/countdown.js';
import { finishStream } from '../services/streamApi.ts';

const SWIPE_THRESHOLD = 58;
const WHEEL_THRESHOLD = 36;
const WHEEL_IDLE_MS = 350;

const streamLocations = new Map(streams.map((stream) => [stream.id, stream.map]));
const mapStreamById = new Map(mapStreams.map((stream) => [stream.id, stream]));
const homeTabs = [
  { labelKey: 'home.tabs.forYou', value: 'for-you' },
  { labelKey: 'home.tabs.live', value: 'live' },
  { labelKey: 'home.tabs.following', value: 'following' },
];
const followedCreatorNames = ['Noah Perrin', 'Maya Afonso', 'Luka Marino'];
const fallbackUserLocation = { latitude: 48.8566, longitude: 2.3522 };
const fallbackCover = '/icons/icon-512.png';
const demoVideoLiveIds = [
  'guitar-solo-pov-paris',
  'metal-drummer-pov-berlin',
  'piano-pov-dubai',
  'chef-michelin-paris',
  'motorbike-srinagar',
  'horseback-cappadocia',
  'skate-portland',
  'sailor-split',
  'road-cyclist-mallorca',
  'biking-dolomites',
  'buggy-marrakesh',
  'glacier-guide-iceland',
];
const CLOCK_TICK_MS = 1000;
const COVER_CAPTURE_DELAY_MS = 2000;
const COVER_CAPTURE_MAX_WIDTH = 720;
const COVER_CAPTURE_QUALITY = 0.68;
const creatorComments = [
  { avatar: 'E', name: 'Emma', text: 'This looks amazing.' },
  { avatar: 'N', name: 'Noah', text: 'Trail view is clean.' },
  { avatar: 'M', name: 'Maya', text: 'Audio is good.' },
];

function sleep(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function captureVideoCoverDataUrl(videoEl) {
  if (!videoEl || videoEl.readyState < 2 || !videoEl.videoWidth || !videoEl.videoHeight) return null;

  const ratio = videoEl.videoHeight / videoEl.videoWidth;
  const width = Math.min(COVER_CAPTURE_MAX_WIDTH, videoEl.videoWidth);
  const height = Math.round(width * ratio);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(videoEl, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', COVER_CAPTURE_QUALITY);
}

async function uploadLiveCoverImage(liveId, uid, imageData) {
  if (!liveId || !uid || !imageData) return null;
  const coverRef = storageRef(storage, `live-covers/${uid}/${liveId}/cover.jpg`);
  await uploadString(coverRef, imageData, 'data_url', {
    contentType: 'image/jpeg',
    cacheControl: 'public,max-age=86400',
  });
  return getDownloadURL(coverRef);
}

function isPublicImageUrl(value) {
  return typeof value === 'string' && /^https?:\/\//i.test(value);
}

const fallbackLocations = {
  'fisherman-lofoten': { top: '29%', left: '50%' },
  'cabinetmaker-copenhagen': { top: '35%', left: '50%' },
  'surgeon-boston': { top: '39%', left: '28%' },
  'pottery-oaxaca': { top: '53%', left: '23%' },
  'surf-raglan': { top: '76%', left: '88%' },
};

function toNumber(value) {
  return Number.parseFloat(String(value).replace('%', ''));
}

function viewerCount(value) {
  return Number.parseInt(String(value ?? '').replace(/\D/g, ''), 10) || 0;
}

function formatViewers(value, language = 'en') {
  const count = viewerCount(value);
  if (count >= 1000) return `${(count / 1000).toLocaleString(language, { maximumFractionDigits: 1 })} k`;
  return count.toLocaleString(language);
}

function formatCompactCount(value, language = 'en') {
  const count = Number.parseInt(String(value ?? '').replace(/\D/g, ''), 10) || 0;
  if (!count) return '';
  if (count >= 1000) return `${(count / 1000).toLocaleString(language, { maximumFractionDigits: 1 })} k`;
  return count.toLocaleString(language);
}


function useScrollReveal(ref) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { el.classList.add('is-revealed'); observer.disconnect(); } },
      { threshold: 0.1 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
}

function useLiveViewerCount(base) {
  const [count, setCount] = useState(base);
  useEffect(() => {
    const id = setInterval(() => {
      setCount((c) => c + Math.floor(Math.random() * 7) - 3);
    }, 9000 + Math.random() * 4000);
    return () => clearInterval(id);
  }, []);
  return Math.max(0, count);
}

function useCurrentTime(active = true) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (!active) return undefined;

    const tick = () => {
      if (document.visibilityState !== 'hidden') {
        setNow(new Date());
      }
    };
    const interval = window.setInterval(tick, CLOCK_TICK_MS);
    const onVisibilityChange = () => setNow(new Date());

    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [active]);

  return now;
}

function liveImage(live) {
  return live?.image ?? live?.thumbnailUrl ?? fallbackCover;
}

function liveTitle(live) {
  return live?.title ?? live?.note ?? live?.role ?? live?.job ?? 'Live Vuvio';
}

function liveLocation(live) {
  return live?.locationLabel ?? live?.location ?? live?.place ?? [live?.city, live?.country].filter(Boolean).join(', ') ?? 'Location unavailable';
}

function liveLocalTime(live, language = 'en') {
  const timeZoneByCountry = {
    France: 'Europe/Paris',
    Portugal: 'Europe/Lisbon',
    Switzerland: 'Europe/Zurich',
    Spain: 'Europe/Madrid',
    Italy: 'Europe/Rome',
    Turkey: 'Europe/Istanbul',
    Japan: 'Asia/Tokyo',
    'United States': 'America/New_York',
  };
  const timeZone = timeZoneByCountry[live?.country] ?? 'Europe/Paris';

  try {
    return new Intl.DateTimeFormat(language, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone,
    }).format(new Date());
  } catch {
    return new Intl.DateTimeFormat(language, { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
  }
}

function familyLabel(live, t) {
  const labels = {
    air: t('categories.air.label'),
    earth: t('categories.land.label'),
    water: t('categories.water.label'),
    urban: t('categories.urban.label'),
  };
  const environment = live?.environment ?? live?.family;

  if (environment) return labels[environment] ?? environment;

  const category = String(live?.category ?? '').toLowerCase();
  if (['sky', 'air'].includes(category)) return t('categories.air.label');
  if (['water'].includes(category)) return t('categories.water.label');
  if (['city', 'urban'].includes(category)) return t('categories.urban.label');
  return t('categories.land.label');
}

function LocationMeta({ live }) {
  const { i18n } = useTranslation();
  const location = [live?.city, live?.country].filter(Boolean).join(', ');
  const label = location || liveLocation(live);

  return (
    <span className="location-meta">
      <MapPin size={12} strokeWidth={1.9} />
      {label.toUpperCase()} · {liveLocalTime(live, i18n.language)} LOCAL
    </span>
  );
}

function PovTypeBadge({ live }) {
  const { t } = useTranslation();
  const labels = {
    drone: t('explore.povTypes.drone'),
    fixed: t('explore.povTypes.fixed'),
    marine: live?.subcategory === 'Surfing' || live?.subcategory === 'Surf' ? t('explore.povTypes.board') : t('explore.povTypes.underwater'),
    pov: ['Hiking', 'Tour'].includes(live?.subcategory) ? t('explore.povTypes.walking') : t('explore.povTypes.chestCamera'),
    vehicle: t('explore.povTypes.vehicle'),
  };
  const environment = familyLabel(live, t);
  const candidate = labels[live?.povType] ?? live?.subcategory ?? live?.role ?? live?.job ?? t('explore.povTypes.fallback');
  const activity = String(candidate).toLowerCase() === String(environment).toLowerCase() ? t('explore.povTypes.fallback') : candidate;

  return <small className="pov-type-badge">{activity.toUpperCase()} · {familyLabel(live, t).toUpperCase()}</small>;
}

function upcomingPovLabel(item, t) {
  const labels = {
    drone: t('explore.povTypes.drone'),
    fixed: t('explore.povTypes.fixed'),
    marine: item?.subcategory === 'Surfing' || item?.subcategory === 'Surf' ? t('explore.povTypes.board') : t('explore.povTypes.underwater'),
    pov: ['Hiking', 'Tour'].includes(item?.subcategory) ? t('explore.povTypes.walking') : t('explore.povTypes.chestCamera'),
    vehicle: t('explore.povTypes.vehicle'),
  };
  const pov = labels[item?.povType] ?? item?.subcategory ?? t('explore.povTypes.fallback');
  const environment = familyLabel(item, t);

  if (String(pov).toLowerCase() === String(environment).toLowerCase()) {
    return environment.toUpperCase();
  }

  return `${pov.toUpperCase()} · ${environment.toUpperCase()}`;
}

function upcomingStatus(item, now) {
  if (item?.status === 'cancelled') return 'cancelled';
  if (item?.status === 'ended') return 'ended';
  const countdown = getCountdownState(item?.startsAt, now);
  if (countdown.phase === 'invalid') return 'invalid';
  if (countdown.isLive || item?.status === 'live') return 'live';
  if (countdown.isStartingSoon) return 'starting-soon';
  return 'scheduled';
}

function isVisibleUpcoming(item, now) {
  const status = upcomingStatus(item, now);
  return !['ended', 'cancelled', 'invalid'].includes(status);
}

function toHomeLive(stream) {
  const mapStream = mapStreamById.get(stream.id);
  const [city = '', country = ''] = String(stream.place ?? '').split(',').map((part) => part.trim());
  const hasVideo = Boolean(stream.video);
  const isVideoKind = hasVideo;

  return {
    ...stream,
    title: mapStream?.experienceTitle ?? stream.note ?? stream.role ?? stream.job ?? stream.name,
    role: stream.role ?? mapStream?.job ?? stream.job,
    image: stream.image ?? mapStream?.image,
    video: stream.video,
    kind: isVideoKind ? 'video' : stream.kind,
    hasVideoAudio: Boolean(stream.hasVideoAudio),
    viewerLabel: stream.viewerLabel ?? mapStream?.viewers ?? stream.viewers ?? '0',
    city: mapStream?.city ?? stream.city ?? city,
    country: mapStream?.country ?? stream.country ?? country,
    locationLabel: mapStream ? `${mapStream.city}, ${mapStream.country}` : stream.place ?? `${stream.city}, ${stream.country}`,
    coordinates: mapStream?.coordinates ?? null,
    status: mapStream?.status ?? 'live',
    subcategory: mapStream?.subcategory ?? stream.category,
    family: mapStream?.family ?? null,
    environment: mapStream?.environment ?? mapStream?.family ?? stream.environment ?? stream.family ?? null,
    povType: mapStream?.povType ?? stream.povType ?? null,
    isFeatured: Boolean(stream.isFeatured ?? mapStream?.isFeatured),
  };
}

function creatorProfileIdForLive(live) {
  return live?.creatorUid || live?.creatorId || live?.creator || live?.id || '';
}

function selectFeaturedLive({ tab, recommendedLives, popularLives, followedLives, fallbackLives }) {
  const selectFrom = (primary = [], secondary = []) => (
    primary.find((live) => live.selectedFeaturedLive)
    ?? primary.find((live) => live.isFeatured)
    ?? primary.find((live) => live.status === 'live')
    ?? secondary.find((live) => live.isFeatured)
    ?? secondary.find((live) => live.status === 'live')
    ?? null
  );

  if (tab === 'following') return selectFrom(followedLives);
  if (tab === 'live') {
    return selectFrom(popularLives, [...recommendedLives, ...fallbackLives]);
  }

  return selectFrom(recommendedLives, [...popularLives, ...fallbackLives]);
}

function distanceKm(from, coordinates) {
  if (!from || !coordinates) return Number.POSITIVE_INFINITY;
  const [longitude, latitude] = coordinates;
  const earthRadius = 6371;
  const toRadians = (value) => (value * Math.PI) / 180;
  const latDistance = toRadians(latitude - from.latitude);
  const lonDistance = toRadians(longitude - from.longitude);
  const a = Math.sin(latDistance / 2) ** 2
    + Math.cos(toRadians(from.latitude)) * Math.cos(toRadians(latitude)) * Math.sin(lonDistance / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function shuffleArray(items) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function isVideoWatchItem(live) {
  return Boolean(live?.video || live?.kind === 'video');
}

function randomizeWatchLives(items) {
  const videos = [];
  const photos = [];

  items.forEach((item) => {
    (isVideoWatchItem(item) ? videos : photos).push(item);
  });

  return [...shuffleArray(videos), ...shuffleArray(photos)].map((item, index) => ({
    ...item,
    feedKey: item.feedKey ?? `${item.id}-${item.kind ?? 'live'}-${index}`,
  }));
}

function SearchSheet({ onClose }) {
  const { i18n } = useTranslation();
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);
  const allStreams = useMemo(() => streams.map(toHomeLive), []);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allStreams.slice(0, 8);
    return allStreams.filter((s) => {
      const haystack = [s.name, s.role, s.title, s.locationLabel, s.subcategory, s.family].join(' ').toLowerCase();
      return haystack.includes(q);
    }).slice(0, 12);
  }, [query, allStreams]);

  return (
    <div className="home-search-sheet" role="dialog" aria-modal="true" aria-label="Search lives">
      <button type="button" className="home-search-sheet__backdrop" onClick={onClose} aria-label="Close" />
      <section className="home-search-sheet__panel">
        <div className="home-search-sheet__input-row">
          <Search size={18} strokeWidth={1.9} />
          <input
            ref={inputRef}
            type="search"
            placeholder="Search lives, creators, places…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
          <button type="button" onClick={onClose} aria-label="Close">
            <X size={16} strokeWidth={2} />
          </button>
        </div>
        <p className="home-search-sheet__label">{query ? `${results.length} result${results.length !== 1 ? 's' : ''}` : 'Live now'}</p>
        <ul className="home-search-results" role="list">
          {results.map((s) => (
            <li key={s.id}>
              <button type="button" className="home-search-result" onClick={onClose}>
                <span className="home-search-result__thumb">
                  <img src={liveImage(s)} alt="" loading="lazy" />
                  <LiveBadge compact />
                </span>
                <span className="home-search-result__body">
                  <strong>{liveTitle(s)}</strong>
                  <small>
                    <MapPin size={11} strokeWidth={1.9} />
                    {s.locationLabel ?? s.place}
                  </small>
                </span>
                <span className="home-search-result__viewers">
                  <Eye size={12} strokeWidth={1.8} />
                  {formatViewers(s.viewerLabel, i18n.language)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function HomeHeader({ onSearchOpen }) {
  const { t } = useTranslation();
  const [msgUnread, setMsgUnread] = useState(() => getUnreadConversationCount());

  useEffect(() => subscribeToMessaging(() => setMsgUnread(getUnreadConversationCount())), []);

  return (
    <header className="home-header">
      <div className="home-topbar">
        <div className="home-topbar__actions">
          <button type="button" className="home-icon-button" aria-label={t('common.search')} onClick={onSearchOpen}>
            <Search size={21} strokeWidth={1.9} />
          </button>
          <Link to="/messages" className="home-icon-button home-icon-button--msg" aria-label={t('navigation.messages')}>
            <MessageCircle size={22} strokeWidth={2} />
            {msgUnread > 0 ? <span className="home-icon-badge" aria-label={`${msgUnread} unread`}>{msgUnread > 9 ? '9+' : msgUnread}</span> : null}
          </Link>
          <button type="button" className="home-icon-button" aria-label={t('home.notifications')}>
            <Bell size={20} strokeWidth={1.9} />
          </button>
        </div>
      </div>
    </header>
  );
}

function HomeTabs({ value, onChange }) {
  const { t } = useTranslation();
  return (
    <nav className="home-feed-tabs" aria-label="Feed tabs">
      {homeTabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          className={value === tab.value ? 'home-feed-tab is-active' : 'home-feed-tab'}
          onClick={() => onChange(tab.value)}
          aria-pressed={value === tab.value}
        >
          {t(tab.labelKey)}
          {tab.value === 'live' && <span className="home-feed-tab__live-dot" aria-hidden="true" />}
        </button>
      ))}
    </nav>
  );
}

function FeaturedLiveCard({ live, onOpen }) {
  const { t, i18n } = useTranslation();
  const title = liveTitle(live);
  const imgRef = useRef(null);
  const cardRef = useRef(null);
  const liveViewers = useLiveViewerCount(viewerCount(live.viewerLabel));

  useEffect(() => {
    const card = cardRef.current;
    const img = imgRef.current;
    if (!card || !img) return undefined;
    const scrollEl = card.closest('.screen-scroll') ?? card.closest('[data-scroll]') ?? window;

    const onScroll = () => {
      const rect = card.getBoundingClientRect();
      const viewH = window.innerHeight;
      const progress = Math.max(0, Math.min(1, 1 - rect.bottom / viewH));
      img.style.transform = `scale(1.04) translateY(${progress * 18}px)`;
    };

    scrollEl.addEventListener('scroll', onScroll, { passive: true });
    return () => scrollEl.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <article ref={cardRef} className="home-featured-live" onClick={() => onOpen(live.id)}>
      <button type="button" className="home-featured-live__open" aria-label={t('home.watchLive', { title })} />
      <img
        ref={imgRef}
        src={liveImage(live)}
        alt={`Live preview for ${title}`}
        loading="eager"
        onError={(event) => {
          event.currentTarget.src = fallbackCover;
        }}
      />
      <span className="pov-card__shade" />
      <span className="home-featured-live__top-shade" aria-hidden="true" />
      <span className="home-featured-live__top">
        <span>
          <LiveBadge compact pulse />
          <span className="viewer-pill home-viewer-pill-anim">
            <Eye size={13} strokeWidth={1.8} />
            <span className="home-viewer-count">{liveViewers >= 1000 ? `${(liveViewers / 1000).toFixed(1)} k` : liveViewers}</span>
          </span>
        </span>
        <PovTypeBadge live={live} />
      </span>
      <span className="home-featured-live__copy">
        <span className="home-featured-live__details">
          <LocationMeta live={live} />
          <strong className="home-featured-title">{title}</strong>
        </span>
        <span className="home-featured-live__footer">
          <CreatorLink creator={live} stopPropagation showMeta metaLabel={live.role ?? live.job} />
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onOpen(live.id);
            }}
            aria-label={t('home.watchLive', { title })}
          >
            <Play size={15} fill="currentColor" strokeWidth={1.8} />
            {t('common.watch')}
          </button>
        </span>
      </span>
    </article>
  );
}

function CompactLiveCard({ live, onOpen }) {
  const { t, i18n } = useTranslation();
  const title = liveTitle(live);
  const role = live.role ?? live.job ?? title;

  return (
    <article className="home-compact-live" onClick={() => onOpen(live.id)}>
      <button type="button" className="home-compact-live__media" aria-label={t('home.watchLive', { title })}>
        <img
          src={liveImage(live)}
          alt={`Live preview for ${role}`}
          loading="lazy"
          onError={(event) => {
            event.currentTarget.src = fallbackCover;
          }}
        />
        <LiveBadge compact pulse />
      </button>
      <div className="home-compact-live__body">
        <button type="button">
          {title}
        </button>
        <span>{liveLocation(live)}</span>
        <CreatorLink creator={live} compact stopPropagation />
      </div>
      <span className="viewer-pill">
        <Eye size={13} strokeWidth={1.8} />
        {formatViewers(live.viewerLabel, i18n.language)}
      </span>
    </article>
  );
}

function UpcomingHomeCard({ item, now, reminderSet, reminderSaving, reminderError, onNotify, onOpen, onWatch }) {
  const { t, i18n } = useTranslation();
  const countdown = getCountdownState(item.startsAt, now);
  const status = upcomingStatus(item, now);
  const isLiveNow = status === 'live';
  const creatorName = item.creatorName ?? 'Vuvio creator';
  const place = item.locationLabel ?? 'Location to be confirmed';
  const creator = { ...item, name: creatorName, place, status: 'upcoming' };
  const interested = typeof item.interestedCount === 'number'
    ? formatCompactCount(item.interestedCount + (reminderSet ? 1 : 0), i18n.language)
    : '';
  const buttonLabel = isLiveNow ? t('common.watch') : reminderSaving ? 'Saving…' : reminderError ? 'Try again' : reminderSet ? 'Reminder on' : 'Notify me';
  const badgeLabel = isLiveNow ? 'Live now' : status === 'starting-soon' ? 'Starting soon' : 'Upcoming';

  return (
    <article
      className={`home-upcoming-card home-upcoming-card--${status}${reminderSet ? ' is-reminder-set' : ''}`}
      onClick={() => (isLiveNow ? onWatch(item.id) : onOpen(item))}
    >
      <button type="button" className="home-upcoming-card__open" aria-label={`${isLiveNow ? t('common.watch') : 'Open details for'} ${item.title}`} />
      <div className="home-upcoming-card__media">
        <img
          src={item.image ?? fallbackCover}
          alt={`Preview for ${item.title}`}
          loading="lazy"
          onError={(event) => {
            event.currentTarget.src = fallbackCover;
          }}
        />
        <span className="home-upcoming-card__badges">
          <span className={status === 'live' ? 'home-upcoming-badge home-upcoming-badge--live' : 'home-upcoming-badge'}>
            {badgeLabel}
          </span>
          <small>{upcomingPovLabel(item, t)}</small>
        </span>
      </div>
      <div className="home-upcoming-card__content">
        <h3>{item.title}</h3>
        <p className="home-upcoming-card__place">
          <MapPin size={13} strokeWidth={1.9} />
          {place}
        </p>
        <p className="home-upcoming-card__date">
          <CalendarClock size={13} strokeWidth={1.9} />
          {formatLocalSchedule(item.startsAt, i18n.language)}
        </p>
        <div className="home-countdown" aria-label={countdown.ariaLabel}>
          <span>{countdown.label}</span>
          {countdown.value ? <strong>{countdown.value}</strong> : null}
        </div>
        <div className="home-upcoming-card__creator">
          <CreatorLink creator={creator} compact stopPropagation />
          {interested ? (
            <span className="home-upcoming-card__interested">
              <UsersRound size={13} strokeWidth={1.8} />
              {interested} interested
            </span>
          ) : null}
        </div>
        <button
          type="button"
          className={reminderSet ? 'home-upcoming-card__notify is-active' : 'home-upcoming-card__notify'}
          disabled={reminderSaving}
          onClick={(event) => {
            event.stopPropagation();
            if (isLiveNow) {
              onWatch(item.id);
              return;
            }
            onNotify(item);
          }}
          aria-label={reminderSet ? `Reminder on for ${item.title}` : `Notify me for ${item.title}`}
        >
          {isLiveNow ? <Play size={14} fill="currentColor" strokeWidth={1.8} /> : <Bell size={14} strokeWidth={1.9} />}
          {buttonLabel}
        </button>
      </div>
    </article>
  );
}

function UpcomingDetailSheet({ item, now, reminderSet, reminderSaving, onNotify, onClose, onWatch }) {
  const { t, i18n } = useTranslation();
  const countdown = getCountdownState(item.startsAt, now);
  const status = upcomingStatus(item, now);
  const creatorName = item.creatorName ?? 'Vuvio creator';
  const place = item.locationLabel ?? 'Location to be confirmed';
  const creator = { ...item, name: creatorName, place, status: 'upcoming' };
  const interested = typeof item.interestedCount === 'number'
    ? formatCompactCount(item.interestedCount + (reminderSet ? 1 : 0), i18n.language)
    : '';

  return (
    <div className="home-upcoming-sheet" role="dialog" aria-modal="true" aria-label={`${item.title} details`}>
      <button type="button" className="home-upcoming-sheet__backdrop" onClick={onClose} aria-label={t('common.close')} />
      <section className="home-upcoming-sheet__panel">
        <header>
          <div>
            <span className={status === 'live' ? 'home-upcoming-badge home-upcoming-badge--live' : 'home-upcoming-badge'}>
              {status === 'live' ? 'Live now' : status === 'starting-soon' ? 'Starting soon' : 'Upcoming'}
            </span>
            <h2>{item.title}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label={t('common.close')}>
            <X size={18} strokeWidth={1.9} />
          </button>
        </header>
        <img src={item.image ?? fallbackCover} alt={`Preview for ${item.title}`} loading="lazy" decoding="async" />
        <div className="home-upcoming-sheet__meta">
          <p><MapPin size={15} strokeWidth={1.9} /> {place}</p>
          <p><CalendarClock size={15} strokeWidth={1.9} /> {formatLocalSchedule(item.startsAt, i18n.language)}</p>
          <p><Clock size={15} strokeWidth={1.9} /> {upcomingPovLabel(item, t)}</p>
          {interested ? <p><UsersRound size={15} strokeWidth={1.9} /> {interested} interested</p> : null}
        </div>
        <div className="home-countdown home-countdown--sheet" aria-label={countdown.ariaLabel}>
          <span>{countdown.label}</span>
          {countdown.value ? <strong>{countdown.value}</strong> : null}
        </div>
        <p className="home-upcoming-sheet__description">{item.description ?? 'Details will be available before the live starts.'}</p>
        <CreatorLink creator={creator} stopPropagation />
        <div className="home-upcoming-sheet__actions">
          <button
            type="button"
            className={reminderSet ? 'is-active' : ''}
            disabled={reminderSaving}
            onClick={() => (status === 'live' ? onWatch(item.id) : onNotify(item))}
          >
            {status === 'live' ? <Play size={15} fill="currentColor" strokeWidth={1.8} /> : <Bell size={15} strokeWidth={1.9} />}
            {status === 'live' ? t('common.watch') : reminderSaving ? 'Saving…' : reminderSet ? 'Reminder on' : 'Notify me'}
          </button>
          <button type="button" onClick={() => navigator.share?.({ title: item.title, text: item.description })}>
            <Share2 size={15} strokeWidth={1.9} />
            Share
          </button>
        </div>
      </section>
    </div>
  );
}

function HomeEmptyState({ children, actionLabel, onAction }) {
  return (
    <section className="home-empty-state">
      <p>{children}</p>
      {actionLabel ? (
        <button type="button" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </section>
  );
}

function NearbyLiveSection({ lives: nearbyLives, locationStatus, onOpen, onSeeAll }) {
  const { t } = useTranslation();
  const sectionRef = useRef(null);
  useScrollReveal(sectionRef);

  // Only show if geolocation is granted
  if (locationStatus !== 'ready') return null;

  return (
    <section ref={sectionRef} className="home-section reveal-section">
      <header>
        <div>
          <h2>{t('home.nearby.title')}</h2>
          <p>Sorted around your region</p>
        </div>
        <button type="button" onClick={onSeeAll}>
          {t('home.nearby.seeAll')}
          <ChevronRight size={15} strokeWidth={2} />
        </button>
      </header>
      {nearbyLives.length ? (
        <div className="home-nearby-list">
          {nearbyLives.map((live) => (
            <CompactLiveCard key={live.id} live={live} onOpen={onOpen} />
          ))}
        </div>
      ) : (
        <HomeEmptyState>{t('home.nearby.none')}</HomeEmptyState>
      )}
    </section>
  );
}

function CityToursSection({ lives, onOpen, onSeeAll }) {
  const sectionRef = useRef(null);
  useScrollReveal(sectionRef);

  if (!lives.length) return null;

  return (
    <section ref={sectionRef} className="home-section reveal-section">
      <header>
        <div>
          <h2>Live City Tours</h2>
          <p>Walk the world in real time</p>
        </div>
        <button type="button" onClick={onSeeAll}>
          See all
          <ChevronRight size={15} strokeWidth={2} />
        </button>
      </header>
      <div className="home-city-tours-row">
        {lives.map((live) => (
          <CompactLiveCard key={live.id} live={live} onOpen={onOpen} />
        ))}
      </div>
    </section>
  );
}

function UpcomingLiveSection({ items, onWatch, onExplore }) {
  const { t } = useTranslation();
  const now = useCurrentTime(items.length > 0);
  const [selectedItem, setSelectedItem] = useState(null);
  const [reminders, setReminders] = useState(() => getUpcomingReminders());
  const [savingIds, setSavingIds] = useState({});
  const [errorIds, setErrorIds] = useState({});
  const visibleItems = useMemo(() => (
    items
      .filter((item) => isVisibleUpcoming(item, now))
      .sort((a, b) => toValidDate(a.startsAt).getTime() - toValidDate(b.startsAt).getTime())
  ), [items, now]);

  const notify = async (item) => {
    if (reminders[item.id] || savingIds[item.id]) return;
    const previous = reminders;

    setErrorIds((current) => ({ ...current, [item.id]: false }));
    setSavingIds((current) => ({ ...current, [item.id]: true }));
    setReminders((current) => ({
      ...current,
      [item.id]: { liveId: item.id, startsAt: item.startsAt, status: 'active' },
    }));

    try {
      await saveUpcomingReminder(item);
      setReminders(getUpcomingReminders());
    } catch {
      setReminders(previous);
      setErrorIds((current) => ({ ...current, [item.id]: true }));
    } finally {
      setSavingIds((current) => ({ ...current, [item.id]: false }));
    }
  };

  return (
    <section className="home-section">
      <header>
        <div>
          <h2>{t('home.upcoming.title')}</h2>
        </div>
      </header>
      {visibleItems.length ? (
        <div className="home-upcoming-row">
          {visibleItems.map((item) => (
            <UpcomingHomeCard
              key={item.id}
              item={item}
              now={now}
              reminderSet={Boolean(reminders[item.id])}
              reminderSaving={Boolean(savingIds[item.id])}
              reminderError={Boolean(errorIds[item.id])}
              onNotify={notify}
              onOpen={setSelectedItem}
              onWatch={onWatch}
            />
          ))}
        </div>
      ) : (
        <HomeEmptyState actionLabel={t('home.empty.discoverLives')} onAction={onExplore}>
          {t('home.upcoming.empty')}
        </HomeEmptyState>
      )}
      {selectedItem ? (
        <UpcomingDetailSheet
          item={selectedItem}
          now={now}
          reminderSet={Boolean(reminders[selectedItem.id])}
          reminderSaving={Boolean(savingIds[selectedItem.id])}
          onNotify={notify}
          onClose={() => setSelectedItem(null)}
          onWatch={onWatch}
        />
      ) : null}
    </section>
  );
}

function WatchPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [tab, setTab] = useState('for-you');
  const [searchOpen, setSearchOpen] = useState(false);
  const [locationStatus, setLocationStatus] = useState('loading');
  const [userLocation, setUserLocation] = useState(fallbackUserLocation);
  const [firestoreLives, setFirestoreLives] = useState([]);

  useEffect(() => subscribeToCreatedLives(setFirestoreLives), []);

  const homeLives = useMemo(() => {
    const mockLives = randomizeWatchLives(streams.map(toHomeLive).filter((stream) => stream.status === 'live'));
    const realLives = firestoreLives.filter((l) => l.status === 'live');
    const realIds = new Set(realLives.map((l) => l.id));
    return [...realLives, ...mockLives.filter((l) => !realIds.has(l.id))];
  }, [firestoreLives]);
  const fallbackLiveStreams = useMemo(
    () => randomizeWatchLives(mapStreams.map(toHomeLive).filter((stream) => stream.status === 'live')),
    [],
  );
  const cityTourLives = useMemo(() => homeLives.filter((live) => live.category === 'City Tours').slice(0, 6), [homeLives]);
  const followedLives = useMemo(() => homeLives.filter((stream) => followedCreatorNames.includes(stream.name)), [homeLives]);
  const popularLiveLives = useMemo(() => [...homeLives].sort((a, b) => viewerCount(b.viewerLabel) - viewerCount(a.viewerLabel)), [homeLives]);
  const displayedLives = tab === 'following' ? followedLives : tab === 'live' ? popularLiveLives : homeLives;
  const featuredLive = selectFeaturedLive({
    tab,
    recommendedLives: homeLives,
    popularLives: popularLiveLives,
    followedLives,
    fallbackLives: fallbackLiveStreams,
  });

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationStatus('unavailable');
      return;
    }

    // Request geolocation with high accuracy for nearby features
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setLocationStatus('ready');
      },
      () => {
        setLocationStatus('denied');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  }, []);

  useEffect(() => {
    const scrollEl = document.querySelector('.screen-scroll');
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

  const nearbyLives = useMemo(() => {
    const sourceLives = tab === 'following' ? followedLives : displayedLives;

    return [...sourceLives]
      .filter((stream) => stream.status === 'live')
      .sort((a, b) => distanceKm(userLocation, a.coordinates) - distanceKm(userLocation, b.coordinates))
      .filter((stream) => stream.id !== featuredLive?.id)
      .slice(0, 3);
  }, [displayedLives, featuredLive, followedLives, tab, userLocation]);

  const upcomingItems = useMemo(() => (tab === 'for-you' ? upcomingStreams.slice(0, 8) : []), [tab]);

  const openLive = (id) => navigate(`/discover?live=${encodeURIComponent(id)}`);

  return (
    <section className="screen-scroll home-screen" aria-label={t('home.aria')}>
      <HomeHeader onSearchOpen={() => setSearchOpen(true)} />
      <HomeTabs value={tab} onChange={setTab} />

      {tab === 'following' && !followedLives.length ? (
        <HomeEmptyState actionLabel={t('home.empty.discoverLives')} onAction={() => navigate('/discover')}>
          {t('home.empty.following')}
        </HomeEmptyState>
      ) : !featuredLive ? (
        <HomeEmptyState actionLabel={t('home.empty.discoverLives')} onAction={() => navigate('/discover')}>
          {t('home.empty.noLives')}
        </HomeEmptyState>
      ) : (
        <div key={tab} className="home-feed-content">
          <FeaturedLiveCard live={featuredLive} onOpen={openLive} />
          <NearbyLiveSection
            lives={nearbyLives}
            locationStatus={locationStatus}
            onOpen={openLive}
            onSeeAll={() => navigate('/globe?filter=nearby')}
          />
          {tab === 'for-you' ? (
            <CityToursSection
              lives={cityTourLives}
              onOpen={openLive}
              onSeeAll={() => navigate('/explore')}
            />
          ) : null}
          {tab === 'for-you' ? <UpcomingLiveSection items={upcomingItems} onWatch={openLive} onExplore={() => navigate('/discover')} /> : null}
        </div>
      )}
      {searchOpen ? <SearchSheet onClose={() => setSearchOpen(false)} /> : null}
    </section>
  );
}

function LiveLocationGlobe({ live, onOpen }) {
  const { t } = useTranslation();
  const location = streamLocations.get(live.id) ?? fallbackLocations[live.id] ?? { top: '50%', left: '50%' };
  const x = toNumber(location.left);
  const y = toNumber(location.top);
  const surfaceSize = 118;
  const globeCenter = 31;
  const surfaceX = globeCenter - (x / 100) * surfaceSize;
  const surfaceY = globeCenter - (y / 100) * surfaceSize;

  return (
    <button
      type="button"
      className="live-location-globe live-location-globe--compass"
      onClick={onOpen}
      aria-label={`${t('common.open')} ${live.city}, ${live.country} on the globe`}
    >
      <span className="live-location-globe__compass live-location-globe__compass--n" aria-hidden="true">N</span>
      <span className="live-location-globe__compass live-location-globe__compass--e" aria-hidden="true">E</span>
      <span className="live-location-globe__compass live-location-globe__compass--s" aria-hidden="true">S</span>
      <span className="live-location-globe__compass live-location-globe__compass--w" aria-hidden="true">W</span>
      <div className="live-location-globe__world" aria-hidden="true">
        <span
          className="live-location-globe__surface"
          style={{ transform: `translate3d(${surfaceX}px, ${surfaceY}px, 0)` }}
        />
        <span className="live-location-globe__marker" />
      </div>
    </button>
  );
}

function LiveUserSheet({ live, onClose, onViewProfile, onViewGear, onMessage }) {
  const { t } = useTranslation();

  return (
    <div className="live-user-sheet" role="dialog" aria-modal="true" aria-label={`Actions for ${live.streamer}`}>
      <button type="button" className="live-user-sheet__backdrop" onClick={onClose} aria-label={t('common.close')} />
      <div className="live-user-sheet__panel">
        <span className="live-user-sheet__handle" aria-hidden="true" />
        <header>
          <span className="live-user-sheet__avatar" aria-hidden="true">
            {live.streamer ? live.streamer.charAt(0).toUpperCase() : '?'}
          </span>
          <div>
            <strong>{live.streamer}</strong>
            <small>{live.job} · {live.city}</small>
          </div>
        </header>
        <button type="button" onClick={onViewProfile}>
          <UserRound size={18} strokeWidth={1.8} />
          {t('common.viewProfile')}
        </button>
        <button type="button" onClick={onViewGear}>
          <Backpack size={18} strokeWidth={1.8} />
          Gear
        </button>
        <button type="button" onClick={onClose}>
          <UserPlus size={18} strokeWidth={1.8} />
          {t('common.follow')}
        </button>
        <button type="button" className="is-message" onClick={onMessage}>
          <MessageCircle size={18} strokeWidth={1.8} />
          {t('common.sendMessage')}
        </button>
        <button type="button" className="is-danger" onClick={onClose}>
          <Flag size={18} strokeWidth={1.8} />
          {t('common.report')}
        </button>
        <button type="button" className="is-danger" onClick={onClose}>
          <ShieldBan size={18} strokeWidth={1.8} />
          {t('common.block')}
        </button>
      </div>
    </div>
  );
}

function CameraLiveMedia({ live, isActive, isDragging, dragY }) {
  const videoRef = useRef(null);
  const stream = getCreatedLiveStream(live.id);
  const dragStyle = isActive && isDragging ? { transform: `scale(1.03) translateY(${dragY * 0.1}px)` } : undefined;

  useEffect(() => {
    if (!videoRef.current || !stream) return undefined;
    videoRef.current.srcObject = stream;
    return () => {
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [stream]);

  if (!stream) {
    return (
      <>
        <img className="live-slide__bg" src={live.image} aria-hidden="true" draggable="false" />
        <img
          className="live-slide__media live-slide__media--pov"
          src={live.image}
          alt={`${live.job ?? live.title ?? 'Live'} POV`}
          draggable="false"
          style={dragStyle}
        />
      </>
    );
  }

  return (
    <video
      ref={videoRef}
      className="live-slide__media live-slide__media--video"
      muted
      playsInline
      autoPlay={isActive}
      style={dragStyle}
    />
  );
}

function formatLiveDuration(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function CreatorCameraSurface({ live, className = '', children, videoRef: externalVideoRef, onVideoReady }) {
  const stream = getCreatedLiveStream(live.id);
  const internalRef = useRef(null);
  const videoRef = externalVideoRef || internalRef;
  // Keep onVideoReady in a ref so changing it never re-runs the effect
  const onVideoReadyRef = useRef(onVideoReady);
  useEffect(() => { onVideoReadyRef.current = onVideoReady; });

  useEffect(() => {
    console.log('[CreatorCameraSurface] mount — stream:', stream?.id ?? 'none');
    if (!videoRef.current || !stream) return () => console.log('[CreatorCameraSurface] unmount (no stream)');
    console.log('[CreatorCameraSurface] srcObject = stream', stream.id);
    videoRef.current.srcObject = stream;

    const tracks = stream.getTracks();
    tracks.forEach((track) => {
      track.onmute = () => console.warn('[CreatorCameraSurface] track muted:', track.kind);
      track.onunmute = () => console.log('[CreatorCameraSurface] track unmuted:', track.kind);
      track.onended = () => console.warn('[CreatorCameraSurface] track ended:', track.kind);
    });

    const handleLoadedMetadata = () => onVideoReadyRef.current?.();
    videoRef.current.addEventListener('loadedmetadata', handleLoadedMetadata);
    return () => {
      console.warn('[CreatorCameraSurface] unmount — srcObject = null');
      tracks.forEach((track) => { track.onmute = null; track.onunmute = null; track.onended = null; });
      if (videoRef.current) {
        videoRef.current.removeEventListener('loadedmetadata', handleLoadedMetadata);
        videoRef.current.srcObject = null;
      }
    };
  }, [stream, videoRef]); // onVideoReady intentionally excluded — held in ref above

  return (
    <div className={`creator-live-camera ${className}`}>
      {stream ? (
        <video ref={videoRef} className="creator-live-camera__video" autoPlay muted playsInline />
      ) : (
        <img className="creator-live-camera__video" src={live.image} alt="" draggable="false" />
      )}
      {children}
    </div>
  );
}

function CreatorLiveSession({ live, onEndingChange }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [phase, setPhase] = useState('live');
  const [elapsed, setElapsed] = useState(0);
  const [viewerCount, setViewerCount] = useState(1);
  const [peakViewers, setPeakViewers] = useState(1);
  const [stars, setStars] = useState(0);
  const [commentsCount, setCommentsCount] = useState(0);
  const [followers, setFollowers] = useState(0);
  const [hudVisible, setHudVisible] = useState(true);
  const [controlsVisible, setControlsVisible] = useState(false);
  const [micMuted, setMicMuted] = useState(false);
  const [flashOn, setFlashOn] = useState(false);
  const [locked, setLocked] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [toast, setToast] = useState(null);
  const [comment, setComment] = useState(null);
  const [starBursts, setStarBursts] = useState([]);
  const [shareLiveOpen, setShareLiveOpen] = useState(false);
  const [bannerVisible, setBannerVisible] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const hideTimer = useRef(null);
  const longPressTimer = useRef(null);
  const lastCenterTapRef = useRef({ time: 0, x: 0, y: 0 });
  const broadcastStartedRef = useRef(false);
  const videoElementRef = useRef(null);
  const coverCaptureRef = useRef({ status: 'idle', imageData: null });
  const lastCommentKeyRef = useRef(null);

  const captureAndSaveCoverImage = useCallback(async (liveId, options = {}) => {
    if (!liveId) return null;
    if (coverCaptureRef.current.imageData && !options.force) return coverCaptureRef.current.imageData;
    if (coverCaptureRef.current.status === 'pending' && !options.force) return null;

    coverCaptureRef.current.status = 'pending';
    try {
      if (options.delayMs !== 0) {
        await sleep(options.delayMs ?? COVER_CAPTURE_DELAY_MS);
      }

      let imageData = null;
      for (let attempt = 0; attempt < 6; attempt += 1) {
        imageData = captureVideoCoverDataUrl(videoElementRef.current);
        if (imageData) break;
        await sleep(350);
      }
      if (!imageData) {
        coverCaptureRef.current.status = 'idle';
        return null;
      }

      let publicCoverUrl = null;
      try {
        publicCoverUrl = await uploadLiveCoverImage(liveId, user?.uid, imageData);
      } catch (err) {
        console.warn('[CreatorLiveSession] Failed to upload cover image:', err.message);
      }

      const shareCoverUrl = publicCoverUrl || imageData;
      const localCoverPatch = {
        image: shareCoverUrl,
        thumbnailUrl: shareCoverUrl,
        coverImageUrl: shareCoverUrl,
        coverImageDataUrl: imageData,
        coverSource: 'screenshot',
        coverCapturedAt: new Date().toISOString(),
        coverCaptureOffsetSeconds: 2,
      };
      coverCaptureRef.current = { status: 'captured', imageData: shareCoverUrl };
      updateCreatedLive(liveId, localCoverPatch);

      if (publicCoverUrl) {
        const liveRef = doc(db, 'activeLives', liveId);
        await updateDoc(liveRef, {
          image: publicCoverUrl,
          thumbnailUrl: publicCoverUrl,
          coverImageUrl: publicCoverUrl,
          coverSource: 'screenshot',
          coverCapturedAt: serverTimestamp(),
          coverCaptureOffsetSeconds: 2,
          updatedAt: serverTimestamp(),
        });
      }
      return shareCoverUrl;
    } catch (err) {
      coverCaptureRef.current.status = 'idle';
      console.warn('[CreatorLiveSession] Failed to capture image:', err.message);
      return null;
    }
  }, [user?.uid]);

  const keepHudAwake = () => {
    if (locked || phase !== 'live') return;
    setHudVisible(true);
    window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => {
      setHudVisible(false);
      setControlsVisible(false);
    }, 3000);
  };

  const revealControls = () => {
    if (locked || phase !== 'live') return;
    setControlsVisible(true);
    keepHudAwake();
  };

  useEffect(() => {
    keepHudAwake();
    return () => window.clearTimeout(hideTimer.current);
  }, []);

  useEffect(() => {
    if (bannerDismissed || viewerCount >= 5) return undefined;
    const t = window.setTimeout(() => setBannerVisible(true), 8000);
    return () => window.clearTimeout(t);
  }, [bannerDismissed, viewerCount]);

  useEffect(() => {
    if (!live?.id || !user?.uid || broadcastStartedRef.current) return undefined;
    broadcastStartedRef.current = true;
    let active = true;

    const setupBroadcast = async () => {
      let whipCredentials = null;
      let cloudflareLiveInputId = live.cloudflareLiveInputId || null;
      try {
        try {
          const token = await user.getIdToken();
          const cfResponse = await fetch('/api/cloudflare/live-input/create', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
              streamId: live.id,
              title: live.name || live.id,
            }),
          });
          if (cfResponse.ok) {
            const cfData = await cfResponse.json();
            console.log('[CLOUDFLARE] broadcast started — live input:', cfData.liveInputId, '| WHEP URL:', cfData.whepUrl ?? 'none');
            if (cfData.liveInputId) cloudflareLiveInputId = cfData.liveInputId;
            if (cfData.webRTCUrl && cfData.streamKey) {
              whipCredentials = { url: cfData.webRTCUrl, key: cfData.streamKey };
            } else {
              console.error('[CLOUDFLARE] ❌ Missing WHIP credentials — broadcast will NOT reach Cloudflare. webRTCUrl:', cfData.webRTCUrl, 'streamKey present:', !!cfData.streamKey);
            }
            // whepUrl is already stored in Firestore by createLiveInputHandler
          }
        } catch (cfErr) {
          console.warn('[CLOUDFLARE] Cloudflare setup failed:', cfErr.message);
        }

        const stream = await startBroadcast(live.id, user.uid, getCreatedLiveStream(live.id), whipCredentials?.url, whipCredentials?.key);
        if (!active) {
          stream?.getTracks?.().forEach((track) => track.stop());
          return;
        }
        if (stream) {
          await updateDoc(doc(db, 'activeLives', live.id), {
            cloudflareLiveInputId,
            liveStartedAt: serverTimestamp(),
            recordingStatus: 'recording',
            updatedAt: serverTimestamp(),
          });
        }
      } catch (err) {
        console.error('[CLOUDFLARE] Broadcast setup failed:', err.message);
        setToast('Broadcast connection failed');
        window.setTimeout(() => setToast(null), 1800);
      }
    };

    setupBroadcast();

    return () => {
      active = false;
      closePeer();
      onEndingChange?.(false, live.id);
    };
  }, [live?.id, onEndingChange, user?.uid]);

  // Heartbeat — keeps activeLives doc alive so the server stale-live detector doesn't end it
  useEffect(() => {
    if (phase !== 'live' || !live?.id) return undefined;
    const sendHeartbeat = () => {
      updateDoc(doc(db, 'activeLives', live.id), {
        lastHeartbeatAt: serverTimestamp(),
      }).catch(() => {});
    };
    sendHeartbeat();
    const timer = window.setInterval(sendHeartbeat, 30000);
    return () => window.clearInterval(timer);
  }, [phase, live?.id]);

  // beforeunload — best-effort sync cleanup when broadcaster closes tab or loses network
  useEffect(() => {
    if (!live?.id) return undefined;
    const handleBeforeUnload = () => {
      console.log('[CLOUDFLARE] broadcast ending (unload)');
      stopBroadcastSync();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [live?.id]);

  useEffect(() => {
    if (phase !== 'live') return undefined;
    const timer = window.setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'live') return undefined;
    const timer = window.setInterval(() => {
      const gain = Math.floor(Math.random() * 7) + 1;
      setViewerCount((value) => {
        const next = value + gain;
        setPeakViewers((peak) => Math.max(peak, next));
        return next;
      });
      setToast(`+${gain} watching`);
      window.setTimeout(() => setToast(null), 1600);
    }, 7600);
    return () => window.clearInterval(timer);
  }, [phase]);

  useEffect(() => {
    if (!live?.id || phase !== 'live') return undefined;
    const commentsRef = collection(db, `activeLives/${live.id}/comments`);
    let initialSnapshotSeen = false;
    const showComment = (commentKey, data) => {
      if (!commentKey || lastCommentKeyRef.current === commentKey) return;
      lastCommentKeyRef.current = commentKey;
      setComment({ name: data.userDisplayName || 'Anonymous', text: ` ${data.text}`, avatar: data.avatar || '👤' });
      window.setTimeout(() => setComment(null), 4000);
      setCommentsCount((count) => count + 1);
    };
    const unsubscribe = onSnapshot(
      query(commentsRef),
      (snapshot) => {
        if (!initialSnapshotSeen) {
          initialSnapshotSeen = true;
          return;
        }

        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const data = change.doc.data();
            showComment(change.doc.id, data);
          }
        });
      },
      (err) => console.warn('[CreatorLiveSession] Comments listener error:', err.message)
    );
    return () => unsubscribe();
  }, [live?.id, phase]);

  useEffect(() => {
    if (!live?.id || phase !== 'live') return undefined;

    const liveRef = doc(db, 'activeLives', live.id);
    let lastLatestCommentId = null;
    const unsubscribe = onSnapshot(
      liveRef,
      (docSnap) => {
        if (!docSnap.exists()) return;
        const data = docSnap.data();
        const latestComment = data?.latestComment;
        if (!latestComment || latestComment.id === lastLatestCommentId) return;
        lastLatestCommentId = latestComment.id;
        lastCommentKeyRef.current = latestComment.id;
        setComment({
          name: latestComment.userDisplayName || 'Anonymous',
          text: ` ${latestComment.text || ''}`,
          avatar: latestComment.avatar || '👤',
        });
        window.setTimeout(() => setComment(null), 4000);
        setCommentsCount((count) => count + 1);
      },
      (err) => console.warn('[CreatorLiveSession] Live doc listener error:', err.message)
    );

    return () => unsubscribe();
  }, [live?.id, phase]);

  useEffect(() => {
    if (!live?.id || phase !== 'live') return undefined;
    const starsRef = collection(db, `activeLives/${live.id}/stars`);
    const unsubscribe = onSnapshot(
      query(starsRef),
      (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const id = `star-${Date.now()}`;
            setStars((value) => value + 1);
            setStarBursts((value) => [...value.slice(-2), { id, left: 62 + Math.random() * 24 }]);
            window.setTimeout(() => setStarBursts((value) => value.filter((item) => item.id !== id)), 1400);
          }
        });
      },
      (err) => console.warn('[CreatorLiveSession] Stars listener error:', err.message)
    );
    return () => unsubscribe();
  }, [live?.id, phase]);

  useEffect(() => {
    if (phase !== 'live') return undefined;
    const timer = window.setInterval(() => {
      setFollowers((value) => value + 1);
      setToast('+1 follower');
      window.setTimeout(() => setToast(null), 1600);
    }, 18000);
    return () => window.clearInterval(timer);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'live') return undefined;
    const timer = window.setTimeout(() => {
      setToast('Weak connection');
      window.setTimeout(() => setToast(null), 1800);
    }, 13000);
    return () => window.clearTimeout(timer);
  }, [phase]);

  const onLockedPointerDown = () => {
    if (!locked) return;
    longPressTimer.current = window.setTimeout(() => {
      setLocked(false);
      revealControls();
    }, 900);
  };

  const clearLongPress = () => {
    window.clearTimeout(longPressTimer.current);
  };

  const sendGlobePing = async () => {
    const ping = await publishLivePing(live.id);
    if (!ping) return;
    setToast('Orange ping sent');
    window.setTimeout(() => setToast(null), 1400);
  };

  const onCreatorPointerUp = (event) => {
    clearLongPress();
    if (locked || phase !== 'live') return;
    if (event.target?.closest?.('.creator-live-controls, .creator-end-sheet')) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const inCenter =
      x > rect.width * 0.24 &&
      x < rect.width * 0.76 &&
      y > rect.height * 0.28 &&
      y < rect.height * 0.72;

    if (!inCenter) {
      lastCenterTapRef.current = { time: 0, x: 0, y: 0 };
      return;
    }

    const now = Date.now();
    const previous = lastCenterTapRef.current;
    const distance = Math.hypot(previous.x - x, previous.y - y);
    if (now - previous.time < 330 && distance < 54) {
      lastCenterTapRef.current = { time: 0, x: 0, y: 0 };
      sendGlobePing();
      return;
    }

    lastCenterTapRef.current = { time: now, x, y };
  };

  const endLive = async () => {
    setConfirmEnd(false);
    setPhase('ending');
    onEndingChange?.(true, live.id);

    const finalCoverImage = coverCaptureRef.current.imageData || await captureAndSaveCoverImage(live.id, { delayMs: 0, force: true });
    const coverFields = finalCoverImage ? {
      image: finalCoverImage,
      thumbnailUrl: finalCoverImage,
      coverImageUrl: finalCoverImage,
      coverSource: 'screenshot',
      coverCapturedAt: new Date().toISOString(),
      coverCaptureOffsetSeconds: 2,
    } : {};
    const firestoreCoverFields = isPublicImageUrl(finalCoverImage) ? {
      image: finalCoverImage,
      thumbnailUrl: finalCoverImage,
      coverImageUrl: finalCoverImage,
      coverSource: 'screenshot',
      coverCapturedAt: serverTimestamp(),
      coverCaptureOffsetSeconds: 2,
    } : {};

    try {
      await finishStream(live.id);
      await stopBroadcast(live.id);
      closePeer();
    } catch (err) {
      console.error('[endLive] Failed to finish stream:', err);
    }

    try {
      const liveId = live.id;
      await updateDoc(doc(db, 'activeLives', liveId), {
        liveEndedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (uploadErr) {
      console.warn('[endLive] Could not mark processing:', uploadErr.message);
    }

    try {
      console.log('[endLive] Stats - elapsed:', elapsed, 'viewers:', viewerCount, 'peak:', peakViewers, 'comments:', commentsCount, 'stars:', stars);
      const liveRef = doc(db, 'activeLives', live.id);

      let commentCount = commentsCount;
      let starCount = stars;

      try {
        const commentsRef = collection(db, `activeLives/${live.id}/comments`);
        const starsRef = collection(db, `activeLives/${live.id}/stars`);
        const commentSnap = await getDocs(commentsRef);
        const starSnap = await getDocs(starsRef);
        commentCount = commentSnap.size;
        starCount = starSnap.size;
        console.log('[endLive] Subcollections read successfully - comments:', commentCount, 'stars:', starCount);
      } catch (readErr) {
        console.warn('[endLive] Failed to read subcollections, using state counts:', readErr.message);
        console.log('[endLive] Using state counts - comments:', commentsCount, 'stars:', stars);
      }

      const stats = {
        status: 'ended',
        endedAt: serverTimestamp(),
        durationSeconds: elapsed,
        totalUniqueViewers: viewerCount,
        peakViewerCount: peakViewers,
        commentCount: commentCount,
        starCount: starCount,
      };

      await updateDoc(liveRef, { ...stats, ...firestoreCoverFields });
      console.log('[CLOUDFLARE] live marked ended');
      console.log('[CLOUDFLARE] cleanup complete');

      const recapLiveData = {
        ...live,
        ...stats,
        ...coverFields,
        status: 'ended',
        durationSeconds: elapsed,
        totalUniqueViewers: viewerCount,
        peakViewerCount: peakViewers,
        commentCount,
        starCount,
        endedAt: new Date().toISOString(),
      };

      setPhase('processing');
      await sleep(1500);
      navigate(`/live/${live.id}/recap`, {
        replace: true,
        state: { liveData: recapLiveData },
      });
      return;
    } catch (err) {
      console.error('[endLive] Stats save error:', err.code, err.message);
      console.error('[endLive] Error details:', err);
    }

    setPhase('processing');
    await sleep(1500);
    navigate(`/live/${live.id}/recap`, {
      replace: true,
      state: {
        liveData: {
          ...live,
          ...coverFields,
          status: 'ended',
          durationSeconds: elapsed,
          totalUniqueViewers: viewerCount,
          peakViewerCount: peakViewers,
          commentCount: commentsCount,
          starCount: stars,
          endedAt: new Date().toISOString(),
        },
      },
    });
  };

  const stats = {
    duration: formatLiveDuration(elapsed),
    viewers: Math.max(viewerCount, 128),
    peak: Math.max(peakViewers, viewerCount, 164),
    stars: Math.max(stars, 24),
    comments: Math.max(commentsCount, 6),
    followers: Math.max(followers, 3),
  };

  if (phase === 'ending') {
    return (
      <section className="screen creator-live-ending">
        <CreatorCameraSurface live={live} className="creator-live-ending__bg" />
        <div className="creator-live-ending__overlay">
          <span className="creator-live-ending__mark"><Check size={36} strokeWidth={1.7} /></span>
          <strong>Live ended</strong>
        </div>
      </section>
    );
  }

  if (phase === 'processing') {
    return (
      <section className="screen creator-live-processing">
        <CreatorCameraSurface live={live} className="creator-live-processing__bg" />
        <div className="creator-live-processing__overlay">
          <span className="creator-live-processing__spinner" aria-hidden="true" />
          <strong>Preparing your recap…</strong>
          <p>Collecting messages, highlights and audience activity.</p>
        </div>
      </section>
    );
  }

  return (
    <section
      className={`screen creator-live-screen${hudVisible ? ' is-awake' : ' is-idle'}${controlsVisible ? ' is-controls-open' : ''}${locked ? ' is-locked' : ''}`}
      onClick={revealControls}
      onPointerDown={onLockedPointerDown}
      onPointerUp={onCreatorPointerUp}
      onPointerCancel={clearLongPress}
      aria-label="Creator live camera"
    >
      <CreatorCameraSurface live={live} videoRef={videoElementRef} onVideoReady={() => captureAndSaveCoverImage(live.id)} />
      <div className="creator-live-hud">
        <div className="creator-live-hud__left">
          <LiveBadge compact pulse />
          <span>{formatLiveDuration(elapsed)}</span>
        </div>
        <div className="creator-live-hud__right">
          <button
            type="button"
            className="creator-hud-share-btn"
            onClick={(e) => { e.stopPropagation(); setShareLiveOpen(true); }}
            aria-label="Share your live"
          >
            <Share2 size={15} strokeWidth={1.9} />
          </button>
          <Eye size={13} strokeWidth={1.8} />
          {viewerCount}
        </div>
      </div>
      <div className="creator-live-indicators">
        {micMuted ? <span><MicOff size={13} strokeWidth={1.9} />Microphone muted</span> : null}
        {flashOn ? <span><Flashlight size={13} strokeWidth={1.9} />Flash on</span> : null}
      </div>
      {toast ? <span className="creator-live-toast">{toast === 'Weak connection' ? <WifiOff size={13} strokeWidth={1.9} /> : null}{toast}</span> : null}
      {elapsed > 45 ? <span className="creator-live-warning"><BatteryWarning size={13} strokeWidth={1.8} />Low battery</span> : null}
      {comment ? (
        <div className="creator-live-comment">
          <span>{comment.avatar}</span>
          <p><strong>{comment.name}</strong>{comment.text}</p>
        </div>
      ) : null}
      <div className="creator-live-stars" aria-hidden="true">
        {starBursts.map((item) => <Star key={item.id} size={18} fill="currentColor" strokeWidth={1.6} style={{ left: `${item.left}%` }} />)}
      </div>
      {locked ? (
        <div className="creator-live-lock">
          <Lock size={22} strokeWidth={1.7} />
          <span>Hold to unlock</span>
        </div>
      ) : null}
      <div className="creator-live-controls" onClick={(event) => event.stopPropagation()}>
        <button type="button" onClick={revealControls}><RotateCcw size={19} strokeWidth={1.8} /><span>Switch Camera</span></button>
        <button type="button" className={micMuted ? 'is-active' : ''} onClick={() => { setMicMuted((value) => !value); revealControls(); }}>{micMuted ? <MicOff size={19} strokeWidth={1.8} /> : <Mic size={19} strokeWidth={1.8} />}<span>Microphone</span></button>
        <button type="button" className={flashOn ? 'is-active' : ''} onClick={() => { setFlashOn((value) => !value); revealControls(); }}><Flashlight size={19} strokeWidth={1.8} /><span>Flash</span></button>
        <button type="button" onClick={() => setLocked(true)}><Lock size={19} strokeWidth={1.8} /><span>Screen Lock</span></button>
        <button type="button" onClick={revealControls}><Settings size={19} strokeWidth={1.8} /><span>Settings</span></button>
        <button type="button" className="is-end" onClick={() => setConfirmEnd(true)}><Square size={16} fill="currentColor" strokeWidth={1.6} /><span>End Live</span></button>
      </div>
      {confirmEnd ? (
        <div className="creator-end-sheet" role="dialog" aria-modal="true" aria-label="End this live?">
          <button type="button" className="creator-end-sheet__backdrop" onClick={() => setConfirmEnd(false)} aria-label="Cancel" />
          <section>
            <span><Flag size={22} strokeWidth={1.7} /></span>
            <h2>End this live?</h2>
            <p>Your stream will stop for everyone. You'll be able to review messages and highlights right after.</p>
            <button type="button" onClick={() => setConfirmEnd(false)}>Cancel</button>
            <button type="button" className="is-danger" onClick={endLive}>End Live</button>
          </section>
        </div>
      ) : null}
      {bannerVisible && !bannerDismissed && !shareLiveOpen && !confirmEnd ? (
        <LiveShareBanner
          onShare={() => { setBannerVisible(false); setShareLiveOpen(true); }}
          onDismiss={() => { setBannerVisible(false); setBannerDismissed(true); }}
        />
      ) : null}
      {shareLiveOpen ? (
        <ShareLiveSheet live={live} onClose={() => setShareLiveOpen(false)} />
      ) : null}
    </section>
  );
}

function LiveViewer({ liveId, creatorMode = false }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [createdLives, setCreatedLives] = useState([]);
  const [lives, setLives] = useState([]);
  const [remoteStream, setRemoteStream] = useState(null);
  const [watchStatus, setWatchStatus] = useState('');
  const [watchRetry, setWatchRetry] = useState(0);
  const [broadcastEnded, setBroadcastEnded] = useState(false);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const videoPlaybackRef = useRef(null);
  const webrtcCallRef = useRef(null);
  const watcherIdRef = useRef(null);
  const retryTimerRef = useRef(null);
  const timeoutTimerRef = useRef(null);
  const hlsFallbackTimerRef = useRef(null);
  const whepSessionRef = useRef(null);

  const ensureRemoteVideoMuted = (video) => {
    if (!video) return;
    video.muted = true;
  };

  useEffect(() => { getCreatedLives().then(setCreatedLives).catch(() => setCreatedLives([])); }, []);
  // Stable shuffle — computed once per session so Firestore updates don't reshuffle the feed
  const [shuffledDemoIds] = useState(() => shuffleArray(demoVideoLiveIds));
  const liveFeed = useMemo(() => {
    if (lives && lives.length > 0) return lives;
    const baseFeed = streams.map(toHomeLive).filter((stream) => stream.status === 'live' || stream.id === liveId);
    const activeLives = createdLives.filter((live) => live.status === 'live');
    const demoVideos = shuffledDemoIds
      .map((id) => baseFeed.find((stream) => stream.id === id && stream.video))
      .filter(Boolean);

    // Prioritize demo videos first (order stable — shuffled once at mount)
    const demoIds = new Set(demoVideos.map((v) => v.id));
    const nonDemoStreams = [...activeLives, ...baseFeed].filter((s) => !demoIds.has(s.id));
    let combined = [...demoVideos, ...nonDemoStreams];

    // Exclude specific creators - STRICT FILTER
    combined = combined.filter((stream) => {
      if (stream.id === liveId) return true;

      const streamer = (stream.streamer || stream.name || stream.displayName || '').toLowerCase().trim();
      const creatorId = (stream.creatorId || stream.creator || '').toLowerCase().trim();
      const streamId = (stream.id || '').toLowerCase().trim();

      // Block Elin Arnadottir and StreetVibes completely
      if (streamer.includes('elin') || streamer.includes('arnadottir')) return false;
      if (streamer === 'streetvibes' || creatorId === 'streetvibes' || streamId.includes('streetvibes')) return false;

      return true;
    });

    // If a specific stream is requested, always put it first
    if (liveId) {
      const requestedIdx = combined.findIndex((s) => s.id === liveId);
      if (requestedIdx > 0) {
        const [requested] = combined.splice(requestedIdx, 1);
        combined.unshift(requested);
      }
    }

    return combined;
  }, [lives, createdLives, liveId, shuffledDemoIds]);
  const [index, setIndex] = useState(() => {
    const requestedIndex = liveFeed.findIndex((item) => item.id === liveId);
    return requestedIndex >= 0 ? requestedIndex : 0;
  });
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [liked, setLiked] = useState({});
  const [reactionCounts, setReactionCounts] = useState({});
  const [starBursts, setStarBursts] = useState([]);
  const [starPulse, setStarPulse] = useState(false);
  const [following, setFollowing] = useState({});
  const [userSheetOpen, setUserSheetOpen] = useState(false);
  const [equipmentSheetOpen, setEquipmentSheetOpen] = useState(false);
  const [shareLiveSheetOpen, setShareLiveSheetOpen] = useState(false);
  const [chatComposerOpen, setChatComposerOpen] = useState(false);
  const [chatPanelOpen, setChatPanelOpen] = useState(false);
  const [immersive, setImmersive] = useState(false);
  const [chatDraft, setChatDraft] = useState('');
  const [localChat, setLocalChat] = useState({});
  const [videoMuted, setVideoMuted] = useState(true);
  const [equipmentLibrary, setEquipmentLibrary] = useState(() => getEquipmentLibrary());
  const feedRef = useRef(null);
  const chatInputRef = useRef(null);
  const chatScrollRef = useRef({ x: 0, y: 0 });
  const chatSwipeStart = useRef(null);
  const chatSwipeOpened = useRef(false);
  const pointerStart = useRef(null);
  const lastLiveTap = useRef({ time: 0, x: 0, y: 0 });
  const tapSheetTimer = useRef(null);
  const wheelTimer = useRef(null);
  const live = liveFeed[index] ?? liveFeed[0] ?? { id: '', equipment: [] };
  const activeLiveId = live.id;
  const liveEquipment = live.id ? getEquipmentSelection(equipmentLibrary, live.equipment?.map((item) => item.equipmentId) ?? demoLiveEquipmentIds) : [];
  const isLiked = !!liked[live.id];
  const isFollowing = !!following[live.id];

  const {
    videoRefCallback,
    recordGearOpened,
    recordGearExternalClicked,
    recordCreatorFollowed,
    recordShared,
    endSession,
  } = useStreamView(
    live.id ? {
      streamId: live.id,
      creatorId: creatorProfileIdForLive(live) || live.name || 'unknown',
      source: 'watch',
      sourcePosition: index,
      category: live.category,
      environment: live.environment,
    } : null,
    {
      enabled: !!live.id && !creatorMode,
      onSessionEnd: (metrics) => {
        console.log('[Analytics] View session ended:', metrics);
      },
    }
  );

  useEffect(() => {
    const requestedIndex = liveFeed.findIndex((item) => item.id === liveId);
    if (requestedIndex >= 0) {
      setIndex(requestedIndex);
      setDragY(0);
    }
  }, [liveFeed, liveId]);

  useEffect(() => subscribeToCreatedLives(setCreatedLives), []);

  // WebRTC streaming for broadcaster
  useEffect(() => {
    if (!creatorMode || !liveId || !user || live.createdLocally) return;

    const setupBroadcaster = async () => {
      try {
        console.log('[LiveViewer] Setting up broadcaster');
        const stream = await startBroadcast(liveId, user.uid);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
          localVideoRef.current.play()?.catch?.((err) => {
            console.warn('[LiveViewer] Local video play error:', err.name, err.message);
          });
        }
      } catch (err) {
        console.error('[LiveViewer] Broadcaster setup failed:', err.message);
      }
    };

    setupBroadcaster();

    return () => {
      closePeer();
    };
  }, [creatorMode, liveId, user, live.createdLocally]);

  // Watch for broadcaster ending their live (only for real broadcasts)
  useEffect(() => {
    if (creatorMode || !activeLiveId || !live.creatorUid) return;

    let isMounted = true;

    const unsubscribe = onSnapshot(doc(db, 'activeLives', activeLiveId), (docSnap) => {
      if (!isMounted) return;

      try {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.status === 'ended') {
            setBroadcastEnded(true);
            setRemoteStream(null);
            if (webrtcCallRef.current) {
              webrtcCallRef.current.close();
            }
            closePeer();
          }
        }
      } catch (err) {
        console.error('[LiveViewer] Broadcast listener error:', err.message);
      }
    }, (err) => {
      if (isMounted && err.code !== 'permission-denied') {
        console.error('[LiveViewer] Firestore subscription error:', err.message);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [creatorMode, activeLiveId, live.creatorUid]);

  // WHEP viewer — one RTCPeerConnection per viewer instance.
  useEffect(() => {
    if (creatorMode || !live?.whepUrl || !remoteVideoRef.current) return;
    const video = remoteVideoRef.current;
    let cancelled = false;
    const viewerSessionId = Math.random().toString(36).slice(2, 8);
    let whepSession = null;
    let retryTimer = null;
    let retryCount = 0;
    const MAX_RETRIES = 12;
    const RETRY_DELAY = 1500;

    window.clearTimeout(hlsFallbackTimerRef.current);
    if (video.srcObject) video.srcObject = null;
    setRemoteStream('whep');
    setBroadcastEnded(false);

    const connect = () => {
      if (cancelled) return;
      console.log(`[WHEP viewer ${viewerSessionId}] creating`, live.whepUrl);

      startWhepPlayback(live.whepUrl, (stream, status) => {
        if (cancelled) return;
        if (stream) {
          video.srcObject = stream;
          video.muted = true;
          video.play()?.catch(() => {});
          setRemoteStream(stream);
          setWatchStatus('connected');
          window.clearTimeout(hlsFallbackTimerRef.current);
        } else if (status === 'failed' || status === 'disconnected') {
          console.warn(`[WHEP viewer ${viewerSessionId}] disconnected`);
          setWatchStatus('retrying');
          if (!cancelled) {
            retryTimer = window.setTimeout(connect, RETRY_DELAY);
          }
        }
      }, viewerSessionId).then((result) => {
        whepSession = result;
        whepSessionRef.current = result;
      }).catch((err) => {
        if (cancelled) return;
        const message = String(err?.message ?? err);
        console.warn(`[WHEP viewer ${viewerSessionId}] failed`, message);
        if (message.includes('409') && message.includes('Live broadcast not started yet') && retryCount < MAX_RETRIES) {
          retryCount += 1;
          setWatchStatus('retrying');
          retryTimer = window.setTimeout(connect, RETRY_DELAY);
        }
      });
    };

    connect();

    return () => {
      cancelled = true;
      window.clearTimeout(hlsFallbackTimerRef.current);
      if (retryTimer) window.clearTimeout(retryTimer);
      if (whepSessionRef.current === whepSession) {
        whepSessionRef.current = null;
      }
      whepSession?.stop?.();
    };
  }, [creatorMode, live?.whepUrl]);

  // HLS viewer disabled for the restored WHEP multi-viewer path.
  useEffect(() => {
    return undefined;
  }, [creatorMode, live?.hlsManifestUrl, live?.whepUrl]);

  // WebRTC P2P — disabled for Cloudflare one-to-many playback.
  useEffect(() => {
    return undefined;
  }, [creatorMode, activeLiveId, live.creatorUid, live.createdLocally, live.whepUrl, live.hlsManifestUrl]);



  useEffect(() => {
    const video = videoPlaybackRef.current;
    if (!video) return;
    video.muted = videoMuted;
  }, [videoMuted]);

  useEffect(() => {
    const feedEl = feedRef.current;
    if (!feedEl) return;
    feedEl.querySelectorAll('video').forEach((v) => {
      if (v !== videoPlaybackRef.current && v !== remoteVideoRef.current) {
        v.pause();
        v.currentTime = 0;
      } else {
        v.muted = videoMuted;
      }
    });
  }, [index, videoMuted]);

  const goTo = (liveion) => {
    endSession('swipe');
    setBroadcastEnded(false);
    setIndex((current) => {
      const next = current + liveion;
      if (next < 0) return liveFeed.length - 1;
      if (next >= liveFeed.length) return 0;
      return next;
    });
    setDragY(0);
  };

  const onPointerDown = (event) => {
    if (event.target.closest('button, a, input, textarea, .live-chat-panel, .live-floating-composer')) return;
    pointerStart.current = { x: event.clientX, y: event.clientY };
    setIsDragging(true);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const onPointerMove = (event) => {
    if (!pointerStart.current) return;
    const nextDrag = event.clientY - pointerStart.current.y;
    setDragY(Math.max(-120, Math.min(120, nextDrag)));
  };

  const toggleImmersive = () => {
    if (tapSheetTimer.current) {
      window.clearTimeout(tapSheetTimer.current);
      tapSheetTimer.current = null;
    }
    setChatComposerOpen(false);
    setChatPanelOpen(false);
    setUserSheetOpen(false);
    setEquipmentSheetOpen(false);
    setImmersive((value) => !value);
  };

  const handleLiveTap = (event, moved) => {
    if (moved > 8 || event.target.closest('button, a, input, textarea, .live-chat-panel, .live-floating-composer')) return;

    const now = Date.now();
    const previous = lastLiveTap.current;
    const distance = Math.hypot(event.clientX - previous.x, event.clientY - previous.y);

    if (now - previous.time < 320 && distance < 42) {
      lastLiveTap.current = { time: 0, x: 0, y: 0 };
      toggleImmersive();
      return;
    }

    lastLiveTap.current = { time: now, x: event.clientX, y: event.clientY };
    if (tapSheetTimer.current) window.clearTimeout(tapSheetTimer.current);
    tapSheetTimer.current = window.setTimeout(() => {
      tapSheetTimer.current = null;
      if (!chatComposerOpen && !chatPanelOpen) {
        setUserSheetOpen(true);
      }
    }, 340);
  };

  const endPointer = (event) => {
    if (!pointerStart.current) return;
    const moved = Math.hypot(event.clientX - pointerStart.current.x, event.clientY - pointerStart.current.y);
    if (dragY <= -SWIPE_THRESHOLD) {
      goTo(1);
      lastLiveTap.current = { time: 0, x: 0, y: 0 };
    } else if (dragY >= SWIPE_THRESHOLD) {
      goTo(-1);
      lastLiveTap.current = { time: 0, x: 0, y: 0 };
    } else {
      setDragY(0);
      handleLiveTap(event, moved);
    }
    pointerStart.current = null;
    setIsDragging(false);
  };

  const wheelDirection = useRef(0);
  const onWheel = (event) => {
    if (Math.abs(event.deltaY) < WHEEL_THRESHOLD) return;
    // Record the dominant scroll direction for this gesture
    if (wheelTimer.current === null) {
      wheelDirection.current = event.deltaY > 0 ? 1 : -1;
    }
    // Reset idle timer — navigate only after scrolling stops
    if (wheelTimer.current !== null) clearTimeout(wheelTimer.current);
    wheelTimer.current = setTimeout(() => {
      wheelTimer.current = null;
      goTo(wheelDirection.current);
    }, WHEEL_IDLE_MS);
  };

  useEffect(() => {
    setBroadcastEnded(false);
    setRemoteStream(null);
    setWatchStatus('');
    setWatchRetry(0);
  }, [activeLiveId]);

  const reactWithStar = async (event) => {
    if (isLiked) return;

    const bounds = feedRef.current?.getBoundingClientRect();
    const x = bounds ? event.clientX - bounds.left : event.clientX;
    const y = bounds ? event.clientY - bounds.top : event.clientY;
    const id = `${live.id}-${Date.now()}`;

    setLiked((state) => ({ ...state, [live.id]: true }));
    setReactionCounts((state) => ({ ...state, [live.id]: (state[live.id] ?? 0) + 1 }));
    setStarBursts((state) => [...state, { id, x, y }]);
    setStarPulse(true);

    try {
      const targetLiveId = activeLiveId || liveId;
      if (!targetLiveId || !user?.uid) return;

      const starsRef = collection(db, `activeLives/${targetLiveId}/stars`);
      await addDoc(starsRef, {
        userId: user.uid,
        userDisplayName: user.displayName || 'Anonymous',
        timestamp: serverTimestamp(),
      });
    } catch (err) {
      console.warn('[LiveViewer] Failed to save star:', err.message);
    }

    window.setTimeout(() => {
      setStarBursts((state) => state.filter((item) => item.id !== id));
    }, 1200);
    window.setTimeout(() => {
      setStarPulse(false);
    }, 220);
  };

  const chat = useMemo(() => [...(live.chat ?? []), ...(localChat[activeLiveId] ?? [])], [live.chat, localChat, activeLiveId]);
  const visibleChat = useMemo(() => chat.slice(-4), [chat]);
  const chatCount = Math.max(chat.length, viewerCount(live.viewerLabel) + 21);
  const trackStyle = {
    transform: `translate3d(0, calc(${-index * 100}% + ${dragY}px), 0)`,
  };

  useEffect(() => {
    if (!chatComposerOpen && !chatPanelOpen) return;
    window.setTimeout(() => chatInputRef.current?.focus(), 80);
  }, [chatComposerOpen, chatPanelOpen]);

  useEffect(() => {
    if (!chatComposerOpen && !chatPanelOpen) {
      document.documentElement.style.removeProperty('--live-keyboard-offset');
      return undefined;
    }

    const viewport = window.visualViewport;
    if (!viewport) return undefined;

    const updateKeyboardOffset = () => {
      const offset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
      document.documentElement.style.setProperty('--live-keyboard-offset', `${Math.round(offset)}px`);
    };

    updateKeyboardOffset();
    viewport.addEventListener('resize', updateKeyboardOffset);
    viewport.addEventListener('scroll', updateKeyboardOffset);

    return () => {
      viewport.removeEventListener('resize', updateKeyboardOffset);
      viewport.removeEventListener('scroll', updateKeyboardOffset);
      document.documentElement.style.removeProperty('--live-keyboard-offset');
    };
  }, [chatComposerOpen, chatPanelOpen]);

  useEffect(() => {
    let active = true;
    getEquipmentLibraryWithProducts().then((items) => {
      if (active) setEquipmentLibrary(items);
    }).catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    setChatComposerOpen(false);
    setChatPanelOpen(false);
    setChatDraft('');
    setImmersive(false);
    lastLiveTap.current = { time: 0, x: 0, y: 0 };
  }, [live.id]);

  useEffect(() => {
    document.body.classList.toggle('vuvio-live-immersive', immersive);
    return () => {
      document.body.classList.remove('vuvio-live-immersive');
    };
  }, [immersive]);

  useEffect(() => {
    return () => {
      if (tapSheetTimer.current) window.clearTimeout(tapSheetTimer.current);
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.repeat) return;
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        goTo(1);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        goTo(-1);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      if (wheelTimer.current !== null) clearTimeout(wheelTimer.current);
    };
  }, []);

  const openChatComposer = () => {
    chatScrollRef.current = {
      x: window.scrollX || document.documentElement.scrollLeft || 0,
      y: window.scrollY || document.documentElement.scrollTop || 0,
    };
    setChatPanelOpen(false);
    setChatComposerOpen(true);
  };

  const openChatPanel = () => {
    setChatComposerOpen(false);
    setChatPanelOpen(true);
  };

  const closeChatComposer = () => {
    chatInputRef.current?.blur();
    setChatComposerOpen(false);
    window.requestAnimationFrame(() => {
      window.scrollTo(chatScrollRef.current.x, chatScrollRef.current.y);
    });
  };

  const sendLiveMessage = async (event) => {
    event?.preventDefault();
    event?.stopPropagation();
    const text = chatDraft.trim();
    const targetLiveId = activeLiveId || liveId;
    if (!text || !targetLiveId || !user?.uid) return;
    const sentAt = Date.now();

    chatInputRef.current?.blur();
    pointerStart.current = null;
    setIsDragging(false);
    setDragY(0);
    setLocalChat((state) => ({
      ...state,
      [targetLiveId]: [
        ...(state[targetLiveId] ?? []),
        { who: 'You', text, time: new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(new Date()) },
      ],
    }));
    setChatDraft('');
    setChatComposerOpen(false);
    setChatPanelOpen(false);

    try {
      const commentsRef = collection(db, `activeLives/${targetLiveId}/comments`);
      const latestComment = {
        id: `${targetLiveId}-${sentAt}`,
        text,
        userId: user.uid,
        userDisplayName: user.displayName || 'Anonymous',
        userPhotoURL: user.photoURL || null,
        avatar: '👤',
        timestamp: new Date().toISOString(),
      };
      const liveStartMs = live.liveStartedAt?.toMillis?.() ?? (live.liveStartedAt?.seconds != null ? live.liveStartedAt.seconds * 1000 : null);
      const liveElapsedSeconds = liveStartMs ? Math.max(0, Math.round((Date.now() - liveStartMs) / 1000)) : null;
      await addDoc(commentsRef, {
        text,
        userId: user.uid,
        userDisplayName: user.displayName || 'Anonymous',
        userPhotoURL: user.photoURL || null,
        timestamp: serverTimestamp(),
        ...(liveElapsedSeconds != null ? { liveElapsedSeconds } : {}),
      });
      await updateDoc(doc(db, 'activeLives', targetLiveId), {
        latestComment,
        latestCommentAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.error('[LiveViewer] Failed to save comment:', err);
    }

    [0, 80, 220].forEach((delay) => {
      window.setTimeout(() => {
        window.scrollTo(chatScrollRef.current.x, chatScrollRef.current.y);
      }, delay);
    });
  };

  const onChatPointerDown = (event) => {
    chatSwipeOpened.current = false;
    chatSwipeStart.current = { y: event.clientY };
  };

  const onChatPointerUp = (event) => {
    const start = chatSwipeStart.current;
    chatSwipeStart.current = null;
    if (!start || start.y - event.clientY < 28) return;

    chatSwipeOpened.current = true;
    event.preventDefault();
    event.stopPropagation();
    openChatPanel();
  };

  const onChatClickCapture = (event) => {
    if (!chatSwipeOpened.current) return;
    chatSwipeOpened.current = false;
    event.preventDefault();
    event.stopPropagation();
  };

  if (creatorMode && live?.createdLocally) {
    return <CreatorLiveSession live={live} />;
  }

  return (
    <section
      ref={feedRef}
      className={`screen live-feed${immersive ? ' is-immersive' : ''}`}
      aria-label="Vuvio live"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPointer}
      onPointerCancel={endPointer}
      onWheel={onWheel}
    >
      <div className={isDragging ? 'live-feed__track is-dragging' : 'live-feed__track'} style={trackStyle}>
        {liveFeed.map((item, itemIndex) => {
          const isActive = itemIndex === index;

          return (
            <article className="live-slide" key={item.feedKey ?? item.id} aria-hidden={!isActive}>
              {item.kind === 'camera' && creatorMode ? (
                <CameraLiveMedia live={item} isActive={isActive} isDragging={isDragging} dragY={dragY} />
              ) : item.kind === 'video' ? (
                <video
                  ref={isActive ? (el) => {
                    videoPlaybackRef.current = el;
                    videoRefCallback(el);
                  } : null}
                  className="live-slide__media live-slide__media--video"
                  src={isActive ? item.video : undefined}
                  muted={true}
                  loop
                  playsInline
                  autoPlay={isActive}
                  preload={isActive ? 'auto' : 'metadata'}
                  style={isActive && isDragging ? { transform: `scale(1.03) translateY(${dragY * 0.1}px)` } : undefined}
                />
              ) : (
                <>
                  {creatorMode && isActive ? (
                    <video
                      ref={localVideoRef}
                      className="live-slide__media live-slide__media--pov"
                      autoPlay
                      muted
                      playsInline
                      style={isDragging ? { transform: `scale(1.03) translateY(${dragY * 0.1}px)` } : undefined}
                    />
                  ) : !creatorMode && isActive && !broadcastEnded && (item.creatorUid || item.createdLocally) ? (
                    <video
                      ref={remoteVideoRef}
                      className="live-slide__media live-slide__media--pov"
                      autoPlay
                      muted
                      playsInline
                      style={isDragging ? { transform: `scale(1.03) translateY(${dragY * 0.1}px)` } : undefined}
                    />
                  ) : (
                    <>
                      <img className="live-slide__bg" src={item.image} aria-hidden="true" draggable="false" />
                      <img
                        className="live-slide__media live-slide__media--pov"
                        src={item.image}
                        alt={`${item.job ?? item.title ?? 'Live'} POV`}
                        draggable="false"
                        style={isActive && isDragging ? { transform: `scale(1.03) translateY(${dragY * 0.1}px)` } : undefined}
                      />
                    </>
                  )}
                </>
              )}
              {broadcastEnded && isActive && !creatorMode && (
                <div className="live-ended-screen">
                  <div className="live-ended-screen__avatar">
                    {item.avatarUrl ? (
                      <img src={item.avatarUrl} alt="" />
                    ) : (
                      <span>{(item.streamer ?? item.name ?? '?')[0].toUpperCase()}</span>
                    )}
                  </div>
                  <p className="live-ended-screen__headline">
                    <strong>@{item.streamer ?? item.name}</strong> ended their livestream
                  </p>
                  <div className="live-ended-screen__btns">
                    <Link
                      to={`/profile/${item.creatorUid}`}
                      className="live-ended-screen__btn"
                      onClick={(e) => e.stopPropagation()}
                    >
                      View profile
                    </Link>
                    <button
                      type="button"
                      className="live-ended-screen__btn live-ended-screen__btn--primary"
                      onClick={() => goTo(1)}
                    >
                      Back to Watch
                    </button>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>

      <div className="live-feed__top-gradient" />
      <div className="live-feed__bottom-gradient" />
      <div className="live-feed__watermark" aria-hidden="true">
        <BrandMark size={26} showName />
      </div>

      <div className="live-position-pill" aria-label={`Live ${index + 1} of ${liveFeed.length}`}>
        {index + 1} / {liveFeed.length}
      </div>

      {!broadcastEnded && (
        <div className="live-feed__status">
          <LiveBadge pulse />
          <span className="live-feed__viewer-count">{formatViewers(live.viewerLabel ?? live.viewers ?? '0', i18n.language)}</span>
        </div>
      )}

      {!broadcastEnded && <LivePresenceOverlay liveId={live.id} liveTitle={live.title ?? live.note} onJoinFriend={() => {}} />}

      {!broadcastEnded && <LiveLocationGlobe live={live} onOpen={() => navigate(`/globe?live=${encodeURIComponent(live.id)}`)} />}

      {!broadcastEnded && (
        <div
          className={`live-chat${chatComposerOpen || chatPanelOpen ? ' is-lifted' : ''}`}
          aria-label="Live chat"
          onPointerDownCapture={onChatPointerDown}
          onPointerUpCapture={onChatPointerUp}
          onClickCapture={onChatClickCapture}
        >
          {visibleChat.map((message, messageIndex) => (
            <button type="button" key={`${live.id}-${message.who}-${messageIndex}`} onClick={() => setUserSheetOpen(true)}>
              <strong>{message.who}</strong> {message.text}
            </button>
          ))}
          <button type="button" className="live-chat__count" onClick={openChatPanel}>
            {chatCount} live messages
          </button>
        </div>
      )}

      {!broadcastEnded && (
        <div className="live-reactions" aria-hidden="true">
          {starBursts.map((burst) => (
            <span
              key={burst.id}
              className="live-reaction-star"
              style={{ left: `${burst.x}px`, top: `${burst.y}px` }}
            >
              <Star size={18} strokeWidth={1.8} fill="currentColor" />
            </span>
          ))}
        </div>
      )}

      {!broadcastEnded && <div className="live-feed__details">
        <div className="live-feed__copy">
          <CreatorLink creator={live} className="live-feed__creator" stopPropagation />
          <p>
            <MapPin size={14} strokeWidth={2} aria-hidden="true" />
            {live.city}, {live.country}
          </p>
          <span>{live.job}{live.job && live.description ? ' • ' : ''}{live.description}</span>
        </div>

        <div className="live-actions" aria-label="Live actions">
          <button
            type="button"
            className={isFollowing ? 'is-active' : ''}
            onClick={() => {
              const wasFollowing = isFollowing;
              setFollowing((state) => ({ ...state, [live.id]: !state[live.id] }));
              if (!wasFollowing) {
                recordCreatorFollowed();
              }
            }}
            aria-label={isFollowing ? t('common.unfollow') : t('common.follow')}
          >
            <UserPlus size={21} strokeWidth={1.8} />
          </button>
          <button
            type="button"
            className={`${isLiked ? 'is-liked' : ''}${starPulse ? ' is-pulsing' : ''}`}
            onClick={reactWithStar}
            aria-label={t('live.sendStar')}
          >
            <Star size={22} strokeWidth={1.8} fill={isLiked ? 'currentColor' : 'none'} />
          </button>
          <button type="button" onClick={openChatComposer} aria-label={t('live.privateMessage')}>
            <MessageCircle size={22} strokeWidth={1.8} />
          </button>
          <button type="button" onClick={() => { recordShared(); setShareLiveSheetOpen(true); }} aria-label={t('common.share')}>
            <Send size={21} strokeWidth={1.8} />
          </button>
          {(live.hasVideoAudio || live.whepUrl || (live.kind === 'camera' && (live.creatorUid || live.createdLocally))) && !creatorMode && (
            <button type="button" className={videoMuted ? 'live-sound-button' : 'is-active live-sound-button'} onClick={() => setVideoMuted((prev) => !prev)} aria-label={videoMuted ? 'Unmute video' : 'Mute video'}>
              {videoMuted ? <VolumeX size={22} strokeWidth={1.8} /> : <Volume2 size={22} strokeWidth={1.8} />}
            </button>
          )}
          <button type="button" className="equipment-button" onClick={() => { recordGearOpened(); setEquipmentSheetOpen(true); }} aria-label="Open live equipment">
            <Backpack size={22} strokeWidth={1.9} />
          </button>
        </div>
      </div>}

      {!broadcastEnded && (
        <button type="button" className="next-live" onClick={() => goTo(1)} aria-label={t('live.next')}>
          <ChevronUp size={18} strokeWidth={2} aria-hidden="true" />
        </button>
      )}

      {chatComposerOpen ? (
        <button type="button" className="live-chat-dismiss" aria-label="Close message composer" onClick={closeChatComposer} />
      ) : null}

      {chatComposerOpen ? (
        <form className="live-floating-composer" onSubmit={sendLiveMessage}>
          <input
            ref={chatInputRef}
            type="text"
            value={chatDraft}
            onChange={(event) => setChatDraft(event.target.value)}
            onBlur={() => window.setTimeout(() => {
              if (!document.activeElement?.closest?.('.live-floating-composer')) {
                setChatComposerOpen(false);
              }
            }, 120)}
            placeholder="Write a message..."
            aria-label="Write a message"
          />
          <button type="submit" className={chatDraft.trim() ? 'is-active' : ''} disabled={!chatDraft.trim()}>
            Send
          </button>
        </form>
      ) : null}

      {chatPanelOpen ? (
        <section className="live-chat-panel" aria-label="Live chat history">
          <button type="button" className="live-chat-panel__backdrop" aria-label="Close chat" onClick={() => setChatPanelOpen(false)} />
          <div className="live-chat-panel__sheet">
            <span className="live-chat-panel__handle" aria-hidden="true" />
            <header>
              <div>
                <strong>{chatCount} live messages</strong>
                <span>{live.title ?? live.description}</span>
              </div>
              <button type="button" onClick={() => setChatPanelOpen(false)} aria-label="Close chat">
                <X size={17} strokeWidth={2} />
              </button>
            </header>
            <div className="live-chat-panel__list">
              {chat.map((message, messageIndex) => (
                <article key={`${live.id}-panel-${message.who}-${messageIndex}`}>
                  <time>{message.time ?? `${Math.max(1, chat.length - messageIndex)}m`}</time>
                  <p><strong>{message.who}</strong> {message.text}</p>
                </article>
              ))}
            </div>
            <form className="live-chat-panel__composer" onSubmit={sendLiveMessage}>
              <input
                ref={chatInputRef}
                type="text"
                value={chatDraft}
                onChange={(event) => setChatDraft(event.target.value)}
                placeholder="Write a message..."
                aria-label="Write a message"
              />
              <button type="submit" className={chatDraft.trim() ? 'is-active' : ''} disabled={!chatDraft.trim()}>
                Send
              </button>
            </form>
          </div>
        </section>
      ) : null}

      {userSheetOpen ? (
        <LiveUserSheet
          live={live}
          onClose={() => setUserSheetOpen(false)}
          onViewProfile={() => {
            setUserSheetOpen(false);
            navigate(`/profile/${creatorProfileIdForLive(live)}`);
          }}
          onViewGear={() => {
            setUserSheetOpen(false);
            setEquipmentSheetOpen(true);
          }}
          onMessage={() => {
            setUserSheetOpen(false);
            openChatComposer();
          }}
        />
      ) : null}
      {shareLiveSheetOpen ? (
        <ShareLiveSheet live={live} onClose={() => setShareLiveSheetOpen(false)} />
      ) : null}
      {equipmentSheetOpen ? (
        <EquipmentViewerSheet
          items={liveEquipment}
          onClose={() => setEquipmentSheetOpen(false)}
          onViewProfile={() => navigate(`/profile/${creatorProfileIdForLive(live)}?tab=equipment`)}
        />
      ) : null}
    </section>
  );
}

export function WatchDiscoverFeed() {
  return <WatchPage />;
}

// Export LiveViewer and CreatorLiveSession for use in other routes
export { LiveViewer, CreatorLiveSession };

export default function WatchPageRoute() {
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [createdLives, setCreatedLives] = useState([]);
  const liveId = searchParams.get('live') ?? '';
  const forcedViewerMode = searchParams.get('mode') === 'view';
  const resolvedLiveId = createdLives.some((l) => l.id === liveId)
    ? liveId
    : (liveId && /^\d+$/.test(liveId) ? `created-${liveId}` : liveId);

  useEffect(() => { getCreatedLives().then(setCreatedLives).catch(() => {}); }, []);

  // Check if viewing own live to enable creator mode
  const live = createdLives.find((l) => l.id === resolvedLiveId);
  const hasLocalBroadcastStream = !!getCreatedLiveStream(resolvedLiveId);
  const creatorMode = !!(
    !forcedViewerMode
    && user
    && live
    && live.creatorUid === user.uid
    && live.status === 'live'
    && hasLocalBroadcastStream
  );

  return <LiveViewer liveId={resolvedLiveId} creatorMode={creatorMode} />;
}
