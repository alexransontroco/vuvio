import Hls from 'hls.js';
import { Backpack, BatteryWarning, Bell, CalendarClock, Camera, Check, ChevronLeft, ChevronRight, ChevronUp, Clock, Eye, Flag, Flashlight, Lock, MapPin, MessageCircle, Mic, MicOff, Monitor, Pause, Play, RotateCcw, Search, Send, Settings, Share2, Square, Star, Trash2, UnlockKeyhole, UserPlus, UserRound, UsersRound, Volume2, VolumeX, WifiOff, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useStreamView } from '../hooks/useStreamView';
import { useScheduledStreams } from '../hooks/useScheduledStreams.ts';
import { analyticsService } from '../services/analytics';
import BrandMark from '../components/BrandMark.jsx';
import SEO, { SITE_URL } from '../components/SEO.jsx';
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
import { getCreatedLives, getCreatedLiveStream, registerCreatedLiveStream, subscribeToCreatedLives, publishLivePing, updateCreatedLive } from '../services/createdLiveService.js';
import { getLiveDestinations, clearLiveDestinations, createCloudflareOutput, deleteCloudflareOutput } from '../services/streamDestinationsService.js';
import { startBroadcast, stopBroadcast, watchBroadcast, closePeer, getLocalStream, getRemoteStream, startRtmpRelayBroadcast, stopRtmpRelayBroadcast, stopRtmpRelayBroadcastSync, startWhipConnection, startWhepViewer, stopWhepViewer, pauseWhipTracks, resumeWhipTracks, pauseRelayTracks, resumeRelayTracks } from '../services/webrtcService.js';
import PauseLiveSheet from '../components/live/PauseLiveSheet.jsx';
import '../styles/components/live-pause.css';
import { collection, doc, onSnapshot, query, where, getDocs, getDoc, addDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { getDownloadURL, ref as storageRef, uploadString } from 'firebase/storage';
import { db, storage } from '../firebase.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useMessaging } from '../context/MessagingContext.jsx';
import { getUpcomingReminders, saveUpcomingReminder } from '../services/upcomingReminderService.js';
import { demoLiveEquipmentIds } from '../data/equipmentModel.js';
import { getEquipmentLibrary, getEquipmentLibraryWithProducts, getEquipmentSelection } from '../services/equipmentService.js';
import { formatLocalSchedule, getCountdownState, makeCountdownLabels, toValidDate } from '../utils/countdown.js';
import { finishStream } from '../services/streamApi.ts';
import { isFollowingCreator, setFollowingCreator } from '../services/followService.js';
import { followCreator, unfollowCreator } from '../services/creatorService.js';
import LiveQASheet from '../components/LiveQASheet.jsx';
import { subscribeToQuestions, sendQuestion, answerQuestion } from '../services/liveQAService.js';
import { streamCreator, streamDescription, streamLocation, streamTitle } from '../utils/seoData.js';

const SWIPE_THRESHOLD = 58;
const WHEEL_THRESHOLD = 36;
const WHEEL_IDLE_MS = 350;

const PAUSE_RESUME_ENABLED = import.meta.env.VITE_PAUSE_RESUME_ENABLED === 'true';

const streamLocations = new Map(streams.map((stream) => [stream.id, stream.map]));
const mapStreamById = new Map(mapStreams.map((stream) => [stream.id, stream]));
const homeTabs = [
  { labelKey: 'home.tabs.forYou', value: 'for-you' },
  { labelKey: 'home.tabs.live', value: 'live' },
  { labelKey: 'home.tabs.following', value: 'following' },
];
const followedCreatorNames = ['Noah Perrin', 'Maya Afonso', 'Luka Marino'];
const fallbackUserLocation = { latitude: 48.8566, longitude: 2.3522 };
const fallbackCover = '/assets/icons/icon-512.png';
const demoVideoLiveIds = [
  'guitar-solo-pov-paris',
  'metal-drummer-pov-berlin',
  'piano-pov-dubai',
  'feuchaterton-live-paris',
  'chef-michelin-paris',
  'motorbike-srinagar',
  'horseback-cappadocia',
  'skate-portland',
  'sailor-split',
  'road-cyclist-mallorca',
  'buggy-marrakesh',
  'glacier-guide-iceland',
  'gopro-firefighters-la',
  'hailey-equestrian-tryon',
  'mrt-burgerbar-manchester',
  'muaythai-training-phuket',
  'f16-pilot-miami',
  'gopro-climbing-wall',
  'wingsuit-taschhorn',
  'wingsuit-new-pov',
  'chef-cooking-pov',
  'busy-friday-chef-pov',
  'cetait-chaud-weekend-pov',
  'goggins-mentality-pov',
  'street-food-chengdu-pov',
  'kitchen-service-pov',
  'watercolor-sketch-pov',
  'mtb-ridge-queenstown',
  'honey-hunter-nepal',
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
    coordinates: mapStream?.coordinates ?? stream.coordinates ?? null,
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
  const { unreadCount: msgUnread } = useMessaging();

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
  const cLabels = makeCountdownLabels(t);
  const countdown = getCountdownState(item.startsAt, now, cLabels);
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
          {formatLocalSchedule(item.startsAt, i18n.language, cLabels)}
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
  const cLabels = makeCountdownLabels(t);
  const countdown = getCountdownState(item.startsAt, now, cLabels);
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
          <p><CalendarClock size={15} strokeWidth={1.9} /> {formatLocalSchedule(item.startsAt, i18n.language, cLabels)}</p>
          <p><Clock size={15} strokeWidth={1.9} /> {upcomingPovLabel(item, t)}</p>
          {interested ? <p><UsersRound size={15} strokeWidth={1.9} /> {interested} interested</p> : null}
        </div>
        <div className="home-countdown home-countdown--sheet" aria-label={countdown.ariaLabel}>
          <span>{countdown.label}</span>
          {countdown.value ? <strong>{countdown.value}</strong> : null}
        </div>
        <p className="home-upcoming-sheet__description">{item.description ?? 'Details will be available before the live starts.'}</p>
        <div className="home-upcoming-creator">
          <CreatorLink creator={creator} stopPropagation showMeta metaLabel={`${upcomingPovLabel(item, t)} · ${place}`} />
          <p>{item.livePlan ?? item.description ?? `${creatorName} will share this POV live from ${place}.`}</p>
        </div>
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
        <span className="home-section__soon-badge">Bientôt</span>
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
  const scheduledStreams = useScheduledStreams();

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

  const upcomingItems = useMemo(() => {
    if (tab !== 'for-you') return [];
    const scheduledIds = new Set(scheduledStreams.map((item) => item.id));
    return [
      ...scheduledStreams,
      ...upcomingStreams.filter((item) => !scheduledIds.has(item.id)),
    ].slice(0, 8);
  }, [scheduledStreams, tab]);

  const openLive = (id) => navigate(`/watch?live=${encodeURIComponent(id)}`);

  return (
    <section className="screen-scroll home-screen" aria-label={t('home.aria')}>
      <HomeHeader onSearchOpen={() => setSearchOpen(true)} />
      <HomeTabs value={tab} onChange={setTab} />

      {tab === 'following' && !followedLives.length ? (
        <HomeEmptyState actionLabel={t('home.empty.discoverLives')} onAction={() => navigate('/watch')}>
          {t('home.empty.following')}
        </HomeEmptyState>
      ) : !featuredLive ? (
        <HomeEmptyState actionLabel={t('home.empty.discoverLives')} onAction={() => navigate('/watch')}>
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
          {tab === 'for-you' ? <UpcomingLiveSection items={upcomingItems} onWatch={openLive} onExplore={() => navigate('/watch')} /> : null}
        </div>
      )}
      {searchOpen ? <SearchSheet onClose={() => setSearchOpen(false)} /> : null}
    </section>
  );
}

// Simplified continent outlines — [lng, lat] pairs, equirectangular
const GLOBE_LAND = [
  // Greenland
  [[-53,83],[-22,83],[-16,77],[-18,70],[-22,65],[-44,60],[-51,62],[-57,67],[-67,73]],
  // North America
  [[-168,72],[-140,60],[-125,49],[-124,37],[-117,32],[-105,20],[-83,10],[-77,8],
   [-80,25],[-75,35],[-70,42],[-53,47],[-57,52],[-62,63],[-82,66],[-100,72],[-168,72]],
  // South America
  [[-78,8],[-62,11],[-35,-9],[-40,-22],[-50,-33],[-56,-39],[-65,-55],[-68,-54],
   [-72,-50],[-75,-38],[-76,-14],[-77,5],[-78,8]],
  // Western Europe (mainland)
  [[-9,37],[3,36],[8,44],[12,44],[15,38],[22,38],[28,42],[30,40],[36,37],
   [28,56],[5,58],[0,51],[-5,50],[-9,44],[-9,37]],
  // Scandinavia
  [[5,58],[28,56],[28,70],[15,68],[5,62],[5,58]],
  // Africa
  [[-17,15],[10,37],[32,30],[38,22],[43,12],[51,12],[44,-10],[35,-17],[20,-35],[12,-5],[-2,5],[-17,15]],
  // Arabia
  [[36,30],[57,26],[56,12],[45,12],[38,22],[36,30]],
  // Eurasia (Turkey → Siberia → Pacific)
  [[28,42],[36,37],[54,24],[60,22],[78,8],[100,5],[108,4],[120,22],[130,33],[140,35],
   [141,46],[130,52],[142,55],[141,62],[130,70],[100,72],[68,68],[38,64],[28,56],[28,42]],
  // SE Asia & Indochina
  [[100,5],[108,4],[110,15],[100,5]],
  // Maritime SE Asia (Sumatra/Java/Borneo simplified)
  [[95,6],[104,1],[108,-7],[116,-8],[119,1],[122,5],[118,18],[108,20],[100,14],[95,6]],
  // Australia
  [[114,-22],[132,-11],[136,-12],[141,-17],[148,-20],[153,-27],[151,-35],[130,-33],[114,-29],[114,-22]],
  // Iceland
  [[-24,63],[-13,63],[-13,66],[-20,66],[-24,63]],
  // Japan (Honshu rough)
  [[130,31],[132,34],[141,38],[141,42],[135,36],[130,33],[130,31]],
];

function GlobeMini({ lng = 0, lat = 0 }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const SIZE = 56;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = SIZE * dpr;
    canvas.height = SIZE * dpr;
    canvas.style.width = `${SIZE}px`;
    canvas.style.height = `${SIZE}px`;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    const r = SIZE / 2;
    ctx.beginPath();
    ctx.arc(r, r, r, 0, Math.PI * 2);
    ctx.clip();
    const ocean = ctx.createRadialGradient(r * 0.6, r * 0.35, 0, r, r, r * 1.05);
    ocean.addColorStop(0, '#1d4f88');
    ocean.addColorStop(0.65, '#0e2a4e');
    ocean.addColorStop(1, '#040d1c');
    ctx.fillStyle = ocean;
    ctx.fillRect(0, 0, SIZE, SIZE);
    function project(pLng, pLat) {
      const dLng = ((pLng - lng + 540) % 360) - 180;
      return [r + (dLng / 180) * r, r - (pLat / 90) * r];
    }
    ctx.fillStyle = 'rgba(32,96,78,0.88)';
    ctx.strokeStyle = 'rgba(43,217,200,0.52)';
    ctx.lineWidth = 0.4;
    for (const poly of GLOBE_LAND) {
      ctx.beginPath();
      const [sx, sy] = project(poly[0][0], poly[0][1]);
      ctx.moveTo(sx, sy);
      for (let i = 1; i < poly.length; i++) {
        const gap = ((poly[i][0] - poly[i - 1][0] + 540) % 360) - 180;
        const [x, y] = project(poly[i][0], poly[i][1]);
        if (Math.abs(gap) > 150) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    const atmo = ctx.createRadialGradient(r, r, r * 0.72, r, r, r);
    atmo.addColorStop(0, 'transparent');
    atmo.addColorStop(1, 'rgba(43,217,200,0.18)');
    ctx.fillStyle = atmo;
    ctx.beginPath();
    ctx.arc(r, r, r, 0, Math.PI * 2);
    ctx.fill();
    // Marker at exact stream location (lng is always x=r center; lat drives y)
    const markerY = r - (lat / 90) * r;
    ctx.beginPath();
    ctx.arc(r, markerY, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(43,217,200,0.95)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(r, markerY, 4.5, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(43,217,200,0.5)';
    ctx.lineWidth = 0.8;
    ctx.stroke();
    const spec = ctx.createRadialGradient(r * 0.58, r * 0.3, 0, r * 0.65, r * 0.4, r * 0.35);
    spec.addColorStop(0, 'rgba(255,255,255,0.13)');
    spec.addColorStop(1, 'transparent');
    ctx.fillStyle = spec;
    ctx.beginPath();
    ctx.arc(r, r, r, 0, Math.PI * 2);
    ctx.fill();
  }, [lng, lat]);
  return <canvas ref={canvasRef} aria-hidden="true" />;
}

function LiveLocationGlobe({ live, onOpen }) {
  const { t } = useTranslation();
  const [lng = 0, lat = 0] = live.coordinates ?? mapStreamById.get(live.id)?.coordinates ?? [0, 0];
  const [flashing, setFlashing] = useState(false);

  const handleClick = () => {
    setFlashing(true);
    setTimeout(() => setFlashing(false), 420);
    onOpen?.();
  };

  return (
    <button
      type="button"
      className={`live-location-globe live-location-globe--compass${flashing ? ' is-flashing' : ''}`}
      onClick={handleClick}
      aria-label={`${t('common.open')} ${live.city}, ${live.country} on the globe`}
    >
      <span className="live-location-globe__compass live-location-globe__compass--n" aria-hidden="true">N</span>
      <span className="live-location-globe__compass live-location-globe__compass--e" aria-hidden="true">E</span>
      <span className="live-location-globe__compass live-location-globe__compass--s" aria-hidden="true">S</span>
      <span className="live-location-globe__compass live-location-globe__compass--w" aria-hidden="true">W</span>
      <GlobeMini lng={lng} lat={lat} />
    </button>
  );
}

function LiveUserSheet({ live, onClose, onViewProfile, onViewGear, onMessage }) {
  const { t } = useTranslation();
  const liveUrl = `https://vuvio.app/watch?live=${encodeURIComponent(live.id)}`;
  const reportUrl = `mailto:hello@vuvio.app?subject=${encodeURIComponent(`Report live ${live.id}`)}&body=${encodeURIComponent(`Live: ${liveUrl}\nReason: `)}`;

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
        <button type="button" className="is-message" onClick={onMessage}>
          <MessageCircle size={18} strokeWidth={1.8} />
          {t('common.sendMessage')}
        </button>
        <a className="is-danger" href={reportUrl} onClick={onClose}>
          <Flag size={18} strokeWidth={1.8} />
          {t('live.reportByEmail')}
        </a>
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

function CreatorCameraSurface({ live, stream: streamProp, className = '', children, videoRef: externalVideoRef, onVideoReady }) {
  const stream = streamProp ?? getCreatedLiveStream(live.id);
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
  const [recordingActive, setRecordingActive] = useState(false);
  const [ingestStatus, setIngestStatus] = useState('pending'); // 'pending' | 'relay' | 'whip' | 'failed'
  // Multistream outputs: [{ provider, name, outputId, status }]
  // status: 'connecting' | 'live' | 'error' | 'disconnected'
  const [outputStatuses, setOutputStatuses] = useState([]);
  const [multistreamOpen, setMultistreamOpen] = useState(false);
  const activeOutputIdsRef = useRef([]); // track output IDs for cleanup on endLive
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
  const [qaSheetOpen, setQaSheetOpen] = useState(false);
  const [liveQuestions, setLiveQuestions] = useState([]);
  const [newQCount, setNewQCount] = useState(0);
  const seenQIdsRef = useRef(new Set());
  // ── Pause / Resume state (feature-flagged) ────────────────────────────
  const [pauseSheetOpen, setPauseSheetOpen] = useState(false);
  // 'live' | 'paused' — distinct from Firestore `status` ('live' | 'ended')
  const [liveStatus, setLiveStatus] = useState('live');
  // isTransitioning: true during pause or resume in-flight (prevents double-clicks)
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [pauseStartedAt, setPauseStartedAt] = useState(null);
  const [pauseExpectedMinutes, setPauseExpectedMinutes] = useState(null);
  const [pauseCount, setPauseCount] = useState(0);
  const [totalPausedMs, setTotalPausedMs] = useState(0);
  // pauseSegmentsRef: [{startedAt, resumedAt, durationMs, expectedMinutes}] — for replay post-processing
  const pauseSegmentsRef = useRef([]);
  const hideTimer = useRef(null);
  const longPressTimer = useRef(null);
  const lastCenterTapRef = useRef({ time: 0, x: 0, y: 0 });
  const broadcastStartedRef = useRef(false);
  const broadcastCleanupTimerRef = useRef(null);
  const ingestModeRef = useRef('whip');
  const [broadcastStream, setBroadcastStream] = useState(() => getCreatedLiveStream(live.id));
  const videoElementRef = useRef(null);
  const coverCaptureRef = useRef({ status: 'idle', imageData: null });
  const lastCommentKeyRef = useRef(null);
  const wakeLockRef = useRef(null);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return undefined;

    let cancelled = false;
    const request = async () => {
      try {
        const sentinel = await navigator.wakeLock.request('screen');
        if (cancelled) { try { await sentinel.release(); } catch {} return; }
        wakeLockRef.current = sentinel;
        sentinel.addEventListener('release', () => {
          if (wakeLockRef.current === sentinel) wakeLockRef.current = null;
        });
      } catch (err) {
        console.warn('[CreatorLiveSession] Wake Lock request failed:', err.message);
      }
    };
    request();

    const onVisibility = () => {
      if (document.visibilityState === 'visible' && !wakeLockRef.current) {
        request();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      const sentinel = wakeLockRef.current;
      wakeLockRef.current = null;
      if (sentinel) { try { sentinel.release(); } catch {} }
    };
  }, []);

  const captureAndSaveCoverImage = useCallback(async (liveId, options = {}) => {
    if (!liveId) return null;
    if (coverCaptureRef.current.imageData && !options.force) return coverCaptureRef.current.imageData;
    if (coverCaptureRef.current.status === 'pending' && !options.force) return null;

    coverCaptureRef.current.status = 'pending';

    // Use manual cover photo taken before the live started
    const manualCoverDataUrl = live?.manualCoverDataUrl;
    if (manualCoverDataUrl && !options.force) {
      try {
        let publicCoverUrl = null;
        try {
          publicCoverUrl = await uploadLiveCoverImage(liveId, user?.uid, manualCoverDataUrl);
        } catch (err) {
          console.warn('[CreatorLiveSession] Failed to upload manual cover:', err.message);
        }
        const shareCoverUrl = publicCoverUrl || manualCoverDataUrl;
        coverCaptureRef.current = { status: 'captured', imageData: shareCoverUrl };
        updateCreatedLive(liveId, {
          image: shareCoverUrl,
          thumbnailUrl: shareCoverUrl,
          coverImageUrl: shareCoverUrl,
          coverImageDataUrl: manualCoverDataUrl,
          coverSource: 'manual',
          coverCapturedAt: new Date().toISOString(),
        });
        if (publicCoverUrl) {
          const liveRef = doc(db, 'activeLives', liveId);
          await updateDoc(liveRef, {
            image: publicCoverUrl,
            thumbnailUrl: publicCoverUrl,
            coverImageUrl: publicCoverUrl,
            coverSource: 'manual',
            coverCapturedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
        return shareCoverUrl;
      } catch (err) {
        coverCaptureRef.current.status = 'idle';
        console.warn('[CreatorLiveSession] Failed to save manual cover:', err.message);
      }
    }

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
    const stream = getCreatedLiveStream(live.id);
    if (!stream) return;
    stream.getAudioTracks().forEach((track) => { track.enabled = !micMuted; });
  }, [micMuted, live.id]);


  useEffect(() => {
    if (bannerDismissed || viewerCount >= 5) return undefined;
    const t = window.setTimeout(() => setBannerVisible(true), 8000);
    return () => window.clearTimeout(t);
  }, [bannerDismissed, viewerCount]);

  useEffect(() => {
    if (!live?.id || !user?.uid) return undefined;
    if (broadcastStartedRef.current) {
      // Re-mount (likely React StrictMode) — cancel any pending cleanup so we survive
      if (broadcastCleanupTimerRef.current) {
        clearTimeout(broadcastCleanupTimerRef.current);
        broadcastCleanupTimerRef.current = null;
        console.log('[BROADCAST-LIFECYCLE] cancelled pending cleanup (StrictMode remount)');
      }
      return undefined;
    }
    broadcastStartedRef.current = true;
    let active = true;

    const setupBroadcast = async () => {
      let whipCredentials = null;
      let relayCredentials = null;
      let cloudflareLiveInputId = live.cloudflareLiveInputId || null;
      let capturedHlsManifestUrl = live.hlsManifestUrl || null;
      let capturedWhepUrl = live.whepUrl || null;
      try {
        // ── Step 1: Create Cloudflare live input ──
        // Always call the backend — never reuse webRTCUrl/streamKey cached in Firestore,
        // as those credentials may point to a deleted live input.
        try {
          const token = await user.getIdToken();
          const destinations = getLiveDestinations(live.id);
          const cfResponse = await fetch('/api/cloudflare/live-input/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({
              streamId: live.id,
              title: live.title || live.experienceTitle || live.name || live.id,
              ...(destinations.length > 0 && {
                destinations: destinations.map((d) => ({
                  url: d.streamUrl,
                  streamKey: d.streamKey,
                  provider: d.provider,
                  name: d.name,
                })),
              }),
            }),
          });
          if (cfResponse.ok) {
            const cfData = await cfResponse.json();
            console.log('[INGEST][CREATE-RESPONSE] vuvioLiveId=%s cloudflareLiveInputUid=%s relayUrl=%s hasIngestUrl=%s hasStreamKey=%s hasWebRTCUrl=%s', live.id, cfData.liveInputId || 'MISSING', cfData.relayUrl || 'none', !!(cfData.rtmpsIngestUrl || cfData.ingestUrl), !!(cfData.rtmpsStreamKey || cfData.streamKey), !!cfData.webRTCUrl);
            if (cfData.liveInputId) cloudflareLiveInputId = cfData.liveInputId;
            if (cfData.webRTCUrl) {
              whipCredentials = { url: cfData.webRTCUrl, key: cfData.streamKey };
            }
            if (cfData.relayUrl && cfData.rtmpsIngestUrl && cfData.rtmpsStreamKey) {
              relayCredentials = { relayUrl: cfData.relayUrl, ingestUrl: cfData.rtmpsIngestUrl, streamKey: cfData.rtmpsStreamKey };
            }

            // Push hlsManifestUrl into local live state immediately so viewers can start HLS
            // without waiting for the Firestore subscription to round-trip.
            if (cfData.hlsManifestUrl || cfData.whepUrl) {
              if (cfData.hlsManifestUrl) capturedHlsManifestUrl = cfData.hlsManifestUrl;
              if (cfData.whepUrl) capturedWhepUrl = cfData.whepUrl;
              updateCreatedLive(live.id, {
                hlsManifestUrl: cfData.hlsManifestUrl,
                whepUrl: cfData.whepUrl || null,
                cloudflareLiveInputId: cfData.liveInputId || cloudflareLiveInputId,
                playbackUrl: cfData.playbackUrl || cfData.hlsManifestUrl,
              });
            }

            // ?relayLocal=1 overrides the relay URL to localhost:8787
            // Credentials always come from the backend response, never from sessionStorage
            // relayLocal is also read from sessionStorage so it survives navigation
            try {
              const params = new URLSearchParams(window.location.search);
              const relayLocalActive = params.get('relayLocal') || sessionStorage.getItem('vuvio.relayLocal');
              if (relayLocalActive) {
                const ingestUrl = cfData.rtmpsIngestUrl || cfData.ingestUrl;
                const streamKey = cfData.rtmpsStreamKey || cfData.streamKey;
                if (ingestUrl && streamKey) {
                  const relayProtocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
                  const relayHost = window.location.hostname || 'localhost';
                  relayCredentials = { relayUrl: `${relayProtocol}//${relayHost}:8787`, ingestUrl, streamKey };
                  whipCredentials = null;
                  console.log('[INGEST][OVERRIDE] relayLocal=1 → using %s', relayCredentials.relayUrl);
                } else {
                  console.warn('[INGEST][OVERRIDE] relayLocal=1 but backend returned no RTMPS credentials');
                }
              }
            } catch (_) {}

            // ── Handle multistream outputs returned by create ──
            if (Array.isArray(cfData.outputs) && cfData.outputs.length > 0) {
              setOutputStatuses(cfData.outputs.map((o) => ({
                outputId: o.outputId || null,
                provider: o.provider ?? 'custom',
                name: o.name ?? o.provider ?? 'Custom RTMP',
                status: o.status ?? (o.outputId ? 'live' : 'error'),
              })));
              activeOutputIdsRef.current = cfData.outputs
                .filter((o) => o.outputId)
                .map((o) => ({ liveInputId: cfData.liveInputId, outputId: o.outputId }));
              clearLiveDestinations(live.id);
              console.log(`[MULTISTREAM] ${cfData.outputs.length} output(s) created inline with live input`);
            }

            if (!whipCredentials && !relayCredentials) {
              console.warn('[INGEST] No relay or WHIP credentials returned — recording will be unavailable');
            }
          } else {
            console.warn('[INGEST] Cloudflare live input creation failed — HTTP', cfResponse.status);
          }
        } catch (cfErr) {
          console.warn('[INGEST] Cloudflare setup error:', cfErr.message);
        }

        // ── Step 2: Acquire camera stream + start P2P signaling ──
        const existingStream = getCreatedLiveStream(live.id);
        const stream = await startBroadcast(live.id, user.uid, existingStream);
        console.log('[INGEST][POST-STARTBROADCAST] stream tracks:', stream?.getTracks?.().length, '| active:', active, '| relayCredentials:', relayCredentials ? 'set' : 'null');

        // ── Step 3: Update Firestore immediately so viewers can start HLS retries ──
        // Write hlsManifestUrl + cloudflareLiveInputId NOW (before ingest connects).
        // Cloudflare HLS becomes available ~20s after WHIP connects, and viewers have a
        // 60-second HLS retry window. Delaying this write until after ingest (up to 25s)
        // was burning most of that window before viewers could even start.
        if (stream) {
          registerCreatedLiveStream(live.id, stream);
          setBroadcastStream(stream);
          await updateDoc(doc(db, 'activeLives', live.id), {
            cloudflareLiveInputId,
            ...(capturedHlsManifestUrl && { hlsManifestUrl: capturedHlsManifestUrl }),
            ...(capturedWhepUrl && { whepUrl: capturedWhepUrl }),
            liveStartedAt: serverTimestamp(),
            recordingStatus: 'pending',
            updatedAt: serverTimestamp(),
          });
        }

        // ── Step 4: Start ingest to Cloudflare in background (WHIP → relay fallback) ──
        // Fire-and-forget so we don't block the component. Viewers already have the HLS
        // URL and are retrying; ingest just needs to connect before their window closes.
        const hasVP8 = (() => {
          try {
            if (typeof RTCRtpSender?.getCapabilities !== 'function') return false;
            return (RTCRtpSender.getCapabilities('video')?.codecs ?? []).some((c) => c.mimeType?.toLowerCase() === 'video/vp8');
          } catch { return false; }
        })();
        console.log('[INGEST][ROUTE] usingRelay=%s usingWhip=%s hasVP8=%s relayUrl=%s cloudflareLiveInputUid=%s', !!relayCredentials && hasVP8, !!whipCredentials, hasVP8, relayCredentials?.relayUrl || 'none', cloudflareLiveInputId || 'MISSING');
        (async () => {
          let ingestMode = 'none';
          // Use relay first when multistream outputs are active (relay → RTMPS → Cloudflare triggers live output forwarding)
          const hasMultistreamOutputs = activeOutputIdsRef.current.length > 0;
          if (!hasMultistreamOutputs && whipCredentials) {
            try {
              await startWhipConnection(stream, whipCredentials.url, whipCredentials.key);
              ingestMode = 'whip';
              if (active) setRecordingActive(true);
              console.log('[INGEST] WHIP connected');
            } catch (whipErr) {
              console.warn('[INGEST] WHIP failed:', whipErr.message, '— falling back to relay');
            }
          }
          if (ingestMode === 'none' && relayCredentials && hasVP8) {
            const keyForLog = relayCredentials.streamKey ? relayCredentials.streamKey.slice(-16) : 'MISSING';
            console.log('[INGEST][PRE-RELAY] Vuvio live id:', live.id, '| CF liveInputId:', cloudflareLiveInputId || 'MISSING', '| relayUrl:', relayCredentials.relayUrl, '| ingestUrl:', relayCredentials.ingestUrl || 'MISSING', '| streamKey suffix:', keyForLog);
            try {
              await startRtmpRelayBroadcast(live.id, user.uid, stream, relayCredentials.relayUrl, relayCredentials.ingestUrl, relayCredentials.streamKey);
              ingestMode = 'rtmps-relay';
              if (active) setRecordingActive(true);
              console.log('[INGEST] relay connected');
            } catch (relayErr) {
              console.error('[INGEST] relay failed:', relayErr.message);
            }
          }
          console.log('[INGEST] FINAL MODE:', ingestMode);
          ingestModeRef.current = ingestMode === 'rtmps-relay' ? 'rtmps-relay' : 'whip';
          if (active) setIngestStatus(ingestMode === 'rtmps-relay' ? 'relay' : ingestMode === 'whip' ? 'whip' : 'failed');
          updateDoc(doc(db, 'activeLives', live.id), {
            recordingStatus: ingestMode !== 'none' ? 'recording' : 'ingest_failed',
            broadcastIngestMode: ingestMode,
            updatedAt: serverTimestamp(),
          }).catch((err) => console.warn('[INGEST] recordingStatus update failed:', err.message));
        })();
      } catch (err) {
        console.error('[INGEST] Broadcast setup failed:', err.message);
        setToast('Broadcast connection failed');
        window.setTimeout(() => setToast(null), 1800);
      }
    };

    setupBroadcast();

    return () => {
      // Delay cleanup so React StrictMode's fake unmount doesn't kill the broadcast.
      // A real unmount lets the timer fire; a synchronous remount cancels it above.
      broadcastCleanupTimerRef.current = setTimeout(() => {
        active = false;
        broadcastStartedRef.current = false;
        broadcastCleanupTimerRef.current = null;
        console.log('[BROADCAST-LIFECYCLE] executing cleanup');
        if (ingestModeRef.current === 'rtmps-relay') stopRtmpRelayBroadcastSync();
        else closePeer();
        onEndingChange?.(false, live.id);
      }, 500);
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
      if (ingestModeRef.current === 'rtmps-relay') stopRtmpRelayBroadcastSync();
      else stopBroadcast(live.id).catch(() => {});
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [live?.id]);

  useEffect(() => {
    if (!recordingActive) return undefined;
    const timer = window.setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [recordingActive]);

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
            window.setTimeout(() => setStarBursts((value) => value.filter((item) => item.id !== id)), 2200);
          }
        });
      },
      (err) => console.warn('[CreatorLiveSession] Stars listener error:', err.message)
    );
    return () => unsubscribe();
  }, [live?.id, phase]);

  useEffect(() => {
    if (!live?.id || phase !== 'live') return undefined;
    return subscribeToQuestions(live.id, (qs) => {
      setLiveQuestions(qs);
      const unseen = qs.filter((q) => !seenQIdsRef.current.has(q.id) && !q.answered);
      setNewQCount(unseen.length);
    });
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

  const pauseLive = async (expectedMinutes) => {
    if (isTransitioning || liveStatus !== 'live') return;
    setPauseSheetOpen(false);
    setIsTransitioning(true);

    // 1. Mute ingest tracks first (privacy: no private media reaches Cloudflare)
    const isRelay = ingestModeRef.current === 'rtmps-relay';
    const muted = isRelay ? pauseRelayTracks() : pauseWhipTracks();
    if (!muted) {
      // No active ingest connection — cannot pause safely
      console.warn('[pauseLive] No ingest connection to pause (mode=%s)', ingestModeRef.current);
      setIsTransitioning(false);
      return;
    }

    // 2. Update Firestore — if this fails, roll back track muting
    const now = new Date();
    try {
      await updateDoc(doc(db, 'activeLives', live.id), {
        liveStatus: 'paused',
        pauseStartedAt: serverTimestamp(),
        pauseExpectedEndAt: expectedMinutes
          ? new Date(now.getTime() + expectedMinutes * 60 * 1000)
          : null,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.error('[pauseLive] Firestore update failed — rolling back track mute:', err.message);
      if (isRelay) resumeRelayTracks(); else resumeWhipTracks();
      setIsTransitioning(false);
      setToast('Pause échouée — vérifiez votre connexion');
      setTimeout(() => setToast(null), 2500);
      return;
    }

    // 3. Record segment start (for future replay post-processing)
    pauseSegmentsRef.current = [
      ...pauseSegmentsRef.current,
      { startedAt: now, resumedAt: null, durationMs: null, expectedMinutes: expectedMinutes ?? null },
    ];

    setPauseStartedAt(now);
    setPauseExpectedMinutes(expectedMinutes);
    setPauseCount((c) => c + 1);
    setLiveStatus('paused');
    setIsTransitioning(false);
  };

  const resumeLive = async () => {
    if (isTransitioning || liveStatus !== 'paused') return;
    setIsTransitioning(true);

    // 1. Update Firestore first — if this fails, stay paused (no media leaked)
    try {
      await updateDoc(doc(db, 'activeLives', live.id), {
        liveStatus: 'live',
        pauseStartedAt: null,
        pauseExpectedEndAt: null,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.error('[resumeLive] Firestore update failed — staying paused:', err.message);
      setIsTransitioning(false);
      setToast('Reprise impossible — vérifiez votre connexion');
      setTimeout(() => setToast(null), 2500);
      return;
    }

    // 2. Resume ingest tracks (Firestore confirmed, safe to transmit again)
    const isRelay = ingestModeRef.current === 'rtmps-relay';
    if (isRelay) resumeRelayTracks(); else resumeWhipTracks();

    // 3. Close segment and accumulate paused time
    const now = new Date();
    const pausedMs = pauseStartedAt ? now.getTime() - pauseStartedAt.getTime() : 0;
    setTotalPausedMs((t) => t + pausedMs);

    const segs = pauseSegmentsRef.current;
    if (segs.length > 0) {
      const last = segs[segs.length - 1];
      pauseSegmentsRef.current = [
        ...segs.slice(0, -1),
        { ...last, resumedAt: now, durationMs: pausedMs },
      ];
    }

    setPauseStartedAt(null);
    setPauseExpectedMinutes(null);
    setLiveStatus('live');
    setIsTransitioning(false);
  };

  const endLive = async () => {
    if (isTransitioning) return;
    if (liveStatus === 'paused') {
      // Close any open pause segment before ending
      const now = new Date();
      const pausedMs = pauseStartedAt ? now.getTime() - pauseStartedAt.getTime() : 0;
      const segs = pauseSegmentsRef.current;
      if (segs.length > 0) {
        const last = segs[segs.length - 1];
        if (!last.resumedAt) {
          pauseSegmentsRef.current = [
            ...segs.slice(0, -1),
            { ...last, resumedAt: now, durationMs: pausedMs },
          ];
        }
      }
      setTotalPausedMs((t) => t + pausedMs);
      const isRelay = ingestModeRef.current === 'rtmps-relay';
      if (isRelay) resumeRelayTracks(); else resumeWhipTracks();
      setLiveStatus('live');
    }
    setConfirmEnd(false);
    setPhase('ending');
    onEndingChange?.(true, live.id);

    // Clean up multistream outputs (best-effort — CF also stops them when the live input ends)
    const outputs = activeOutputIdsRef.current;
    if (outputs.length > 0 && user) {
      setOutputStatuses((prev) => prev.map((o) => ({ ...o, status: 'disconnected' })));
      Promise.all(outputs.map(({ liveInputId, outputId }) =>
        deleteCloudflareOutput(user, liveInputId, outputId).catch(() => {}),
      )).catch(() => {});
      activeOutputIdsRef.current = [];
    }

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
    } catch (err) {
      console.warn('[endLive] finishStream failed (non-critical):', err.message);
    }

    try {
      if (ingestModeRef.current === 'rtmps-relay') {
        await stopRtmpRelayBroadcast(live.id);
      } else {
        await stopBroadcast(live.id);
        closePeer();
      }
    } catch (err) {
      console.error('[endLive] Failed to stop broadcast:', err);
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

      const finalPausedMs = totalPausedMs;
      const broadcastSecs = Math.max(0, elapsed - Math.round(finalPausedMs / 1000));
      // Serialise pause segments (Dates → ISO strings for Firestore)
      const serialisedSegments = pauseSegmentsRef.current.map((seg) => ({
        startedAt: seg.startedAt?.toISOString?.() ?? null,
        resumedAt: seg.resumedAt?.toISOString?.() ?? null,
        durationMs: seg.durationMs ?? null,
        expectedMinutes: seg.expectedMinutes ?? null,
      }));
      const stats = {
        status: 'ended',
        liveStatus: 'ended',
        endedAt: serverTimestamp(),
        durationSeconds: elapsed,
        broadcastDurationSeconds: broadcastSecs,
        totalPausedSeconds: Math.round(finalPausedMs / 1000),
        pauseCount,
        pauseSegments: serialisedSegments,
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
        broadcastIngestMode: ingestModeRef.current,
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
      <CreatorCameraSurface live={live} stream={broadcastStream} videoRef={videoElementRef} onVideoReady={() => captureAndSaveCoverImage(live.id)} />
      <div className="creator-live-hud">
        <div className="creator-live-hud__left">
          <LiveBadge compact pulse />
          <span>{formatLiveDuration(elapsed)}</span>
        </div>
        <div className="creator-live-hud__right">
          <button
            type="button"
            className={`creator-hud-qa-btn${newQCount > 0 ? ' has-badge' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              setQaSheetOpen(true);
              seenQIdsRef.current = new Set(liveQuestions.map((q) => q.id));
              setNewQCount(0);
            }}
            aria-label="Questions des spectateurs"
          >
            <MessageCircle size={15} strokeWidth={1.9} />
            {newQCount > 0 ? <span className="creator-hud-qa-btn__badge">{newQCount}</span> : null}
          </button>
          <button
            type="button"
            className="creator-hud-share-btn"
            onClick={async (e) => {
              e.stopPropagation();
              const url = `${window.location.origin}/studio`;
              try {
                await navigator.clipboard.writeText(url);
                setToast('Lien Studio copié — ouvrez-le sur votre ordi');
                setTimeout(() => setToast(null), 2600);
              } catch {
                setToast(url);
                setTimeout(() => setToast(null), 3200);
              }
            }}
            aria-label="Copier le lien Studio pour répondre depuis un autre appareil"
          >
            <Monitor size={15} strokeWidth={1.9} />
          </button>
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
        {ingestStatus === 'failed' ? <span style={{color:'#f87171'}}>⚠ Stream not reaching Cloudflare — viewers limited to 1</span> : null}
        {ingestStatus === 'whip' ? <span style={{color:'#4ade80'}}>● HLS active — unlimited viewers</span> : null}
        {ingestStatus === 'relay' ? <span style={{color:'#4ade80'}}>● Relay active — unlimited viewers</span> : null}
        {outputStatuses.length > 0 && (
          <button
            type="button"
            className="creator-multistream-pill"
            onClick={() => setMultistreamOpen((v) => !v)}
          >
            {outputStatuses.some((o) => o.status === 'error') ? '⚠' : '●'}
            {' Vuvio'}
            {outputStatuses.map((o) => ` + ${o.name ?? o.provider}`).join('')}
          </button>
        )}
      </div>

      {multistreamOpen && outputStatuses.length > 0 && (
        <div className="creator-multistream-sheet" onClick={() => setMultistreamOpen(false)}>
          <div className="creator-multistream-sheet__panel" onClick={(e) => e.stopPropagation()}>
            <div className="creator-multistream-sheet__header">
              <span>Live destinations</span>
              <button type="button" onClick={() => setMultistreamOpen(false)}><X size={16} strokeWidth={1.9} /></button>
            </div>
            <div className="creator-multistream-sheet__list">
              <div className="creator-multistream-sheet__row creator-multistream-sheet__row--on">
                <span className="creator-multistream-sheet__dot" />
                <span className="creator-multistream-sheet__name">Vuvio</span>
                <span className="creator-multistream-sheet__status">Live</span>
              </div>
              {outputStatuses.map((o) => (
                <div key={o.name ?? o.provider} className={`creator-multistream-sheet__row${o.status === 'error' || o.status === 'disconnected' ? ' creator-multistream-sheet__row--error' : o.status === 'live' ? ' creator-multistream-sheet__row--on' : ''}`}>
                  <span className="creator-multistream-sheet__dot" />
                  <div className="creator-multistream-sheet__info">
                    <span className="creator-multistream-sheet__name">{o.name ?? o.provider}</span>
                    {(o.status === 'error' || o.status === 'disconnected') && (
                      <span className="creator-multistream-sheet__note">Your Vuvio Live is still running.</span>
                    )}
                  </div>
                  <span className="creator-multistream-sheet__status">
                    {o.status === 'connecting' ? 'Connecting…' : o.status === 'live' ? 'Live' : o.status === 'error' ? '⚠ Error' : 'Stopped'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
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
        {PAUSE_RESUME_ENABLED ? (
          <button
            type="button"
            disabled={isTransitioning}
            onClick={(e) => { e.stopPropagation(); setPauseSheetOpen(true); revealControls(); }}
          >
            <Pause size={19} strokeWidth={1.8} />
            <span>{isTransitioning ? 'En cours…' : 'Pause'}</span>
          </button>
        ) : null}
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
      {qaSheetOpen ? (
        <LiveQASheet
          questions={liveQuestions}
          streamerName={user?.displayName || 'Streamer'}
          onClose={() => setQaSheetOpen(false)}
          onAnswer={async (questionId, text) => {
            await answerQuestion({
              liveId: live.id,
              questionId,
              text,
              authorId: user.uid,
              authorName: user.displayName || 'Streamer',
            });
          }}
        />
      ) : null}
      {PAUSE_RESUME_ENABLED && pauseSheetOpen ? (
        <PauseLiveSheet
          onPause={pauseLive}
          onCancel={() => setPauseSheetOpen(false)}
        />
      ) : null}
      {PAUSE_RESUME_ENABLED && liveStatus === 'paused' ? (
        <CreatorPauseView
          pauseStartedAt={pauseStartedAt}
          pauseExpectedMinutes={pauseExpectedMinutes}
          viewerCount={viewerCount}
          isTransitioning={isTransitioning}
          onResume={resumeLive}
          onEndLive={() => setConfirmEnd(true)}
        />
      ) : null}
    </section>
  );
}

function CreatorPauseView({ pauseStartedAt, pauseExpectedMinutes, viewerCount, isTransitioning, onResume, onEndLive }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = pauseStartedAt ? pauseStartedAt.getTime() : Date.now();
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [pauseStartedAt]);

  const formatDuration = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const remainingSecs = pauseExpectedMinutes
    ? Math.max(0, pauseExpectedMinutes * 60 - elapsed)
    : null;

  return (
    <div className="creator-pause-screen">
      <div className="creator-pause-content">
        <span className="creator-pause-badge">
          <Pause size={11} strokeWidth={2.2} />
          LIVE EN PAUSE
        </span>
        <span className="creator-pause-elapsed">{formatDuration(elapsed)}</span>
        <span className="creator-pause-elapsed-label">Durée de la pause</span>
        {remainingSecs !== null ? (
          <span className="creator-pause-countdown">
            Retour prévu dans <strong>{formatDuration(remainingSecs)}</strong>
          </span>
        ) : (
          <span className="creator-pause-countdown">Durée indéterminée · max 30 min</span>
        )}
        <span className="creator-pause-viewers">
          <Eye size={12} strokeWidth={1.8} />
          {viewerCount} spectateur{viewerCount > 1 ? 's' : ''} en attente
        </span>
      </div>
      <div className="creator-pause-actions">
        <button type="button" className="creator-pause-btn-resume" onClick={onResume} disabled={isTransitioning}>
          {isTransitioning ? (
            <span className="creator-pause-spinner" aria-hidden="true" />
          ) : (
            <Play size={18} fill="currentColor" strokeWidth={0} />
          )}
          {isTransitioning ? 'Reprise en cours…' : 'Reprendre le live'}
        </button>
        <div className="creator-pause-secondary">
          <button type="button" className="creator-pause-btn-secondary creator-pause-btn-end" onClick={onEndLive} disabled={isTransitioning}>
            Terminer
          </button>
        </div>
      </div>
    </div>
  );
}

function ViewerPauseOverlay({ pauseExpectedEndAt }) {
  const [remaining, setRemaining] = useState(() => {
    if (!pauseExpectedEndAt) return null;
    return Math.max(0, Math.floor((pauseExpectedEndAt.getTime() - Date.now()) / 1000));
  });

  useEffect(() => {
    if (!pauseExpectedEndAt) return;
    const tick = () => setRemaining(Math.max(0, Math.floor((pauseExpectedEndAt.getTime() - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [pauseExpectedEndAt]);

  const formatCountdown = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div className="viewer-pause-overlay">
      <span className="viewer-pause-icon">
        <Pause size={22} strokeWidth={2} />
      </span>
      <p className="viewer-pause-title">Live en pause</p>
      <p className="viewer-pause-subtitle">Le créateur revient bientôt.</p>
      {remaining !== null && (
        <div className="viewer-pause-countdown">
          <span>Retour prévu dans</span>
          <span className="viewer-pause-countdown-timer">{formatCountdown(remaining)}</span>
        </div>
      )}
    </div>
  );
}

function LiveViewer({ liveId, creatorMode = false }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const debugViewer = searchParams.get('debug') === 'viewer';
  const [createdLives, setCreatedLives] = useState([]);
  const [lives, setLives] = useState([]);
  const [remoteStream, setRemoteStream] = useState(null);
  const [watchStatus, setWatchStatus] = useState('');
  const [watchRetry, setWatchRetry] = useState(0);
  const [hlsFailure, setHlsFailure] = useState(null);
  const [broadcastEnded, setBroadcastEnded] = useState(false);
  const [endedLiveSnap, setEndedLiveSnap] = useState(null); // captured live when it ends, so feed removal doesn't hide the ended screen
  const [remoteVideoEl, setRemoteVideoEl] = useState(null);
  const [whepFailed, setWhepFailed] = useState(false);
  const [debugInfo, setDebugInfo] = useState({});
  const [isLivePaused, setIsLivePaused] = useState(false);
  const [pauseExpectedEndAt, setPauseExpectedEndAt] = useState(null);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const wasLivePausedRef = useRef(false);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  // Stable ref callback — must not change on re-renders, otherwise React calls it with null
  // on every render which triggers setRemoteVideoEl(null) → effect cleanup → stopWhepViewer
  const stableVideoRef = useCallback((el) => {
    remoteVideoRef.current = el;
    setRemoteVideoEl(el);
  }, []);
  const videoPlaybackRef = useRef(null);
  const webrtcCallRef = useRef(null);
  const watcherIdRef = useRef(null);
  const retryTimerRef = useRef(null);
  const timeoutTimerRef = useRef(null);
  const hlsFallbackTimerRef = useRef(null);
  const whepConnectedRef = useRef(false);
  const anySourceWonRef = useRef(false);
  const ensureRemoteVideoMuted = (video) => {
    if (!video) return;
    video.muted = true;
  };


  useEffect(() => { getCreatedLives().then(setCreatedLives).catch(() => setCreatedLives([])); }, []);
  // Fast path: fetch liveId doc directly so liveReady flips before the collection query returns
  useEffect(() => {
    if (!liveId) return;
    getDoc(doc(db, 'activeLives', liveId)).then((snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      if (data?.status !== 'live') return;
      setCreatedLives((prev) => {
        if (prev.some((l) => l.id === liveId)) return prev;
        return [{ ...data, id: snap.id }, ...prev];
      });
    }).catch(() => {});
  }, [liveId]); // eslint-disable-line react-hooks/exhaustive-deps
  // Stable shuffle — computed once per session so Firestore updates don't reshuffle the feed
  const [shuffledDemoIds] = useState(() => shuffleArray(demoVideoLiveIds));
  const liveFeed = useMemo(() => {
    if (lives && lives.length > 0) {
      const videos = lives.filter((l) => isVideoWatchItem(l));
      const photos = lives.filter((l) => !isVideoWatchItem(l));
      return [...videos, ...photos];
    }
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

    // Deduplicate by ID (multiple mock sources can have the same ID)
    const seen = new Set();
    combined = combined.filter((s) => {
      if (seen.has(s.id)) return false;
      seen.add(s.id);
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
  const [isCurrentVideoReady, setIsCurrentVideoReady] = useState(false);
  const videoReadySetRef = useRef(new Set());
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [liked, setLiked] = useState({});
  const [reactionCounts, setReactionCounts] = useState({});
  const [starBursts, setStarBursts] = useState([]);
  const [starPulse, setStarPulse] = useState(false);
  const [followBursts, setFollowBursts] = useState([]);
  const [followPulse, setFollowPulse] = useState(false);
  const [sendBursts, setSendBursts] = useState([]);
  const [following, setFollowing] = useState(() => {
    // Pre-populate from localStorage so state matches what was persisted
    const init = {};
    try {
      const stored = JSON.parse(localStorage.getItem('vuvio:following-creators') ?? '[]');
      if (Array.isArray(stored)) stored.forEach((id) => { init[id] = true; });
    } catch {}
    return init;
  });
  const [userSheetOpen, setUserSheetOpen] = useState(false);
  const [equipmentSheetOpen, setEquipmentSheetOpen] = useState(false);
  const [shareLiveSheetOpen, setShareLiveSheetOpen] = useState(false);
  const [chatComposerOpen, setChatComposerOpen] = useState(false);
  const [chatPanelOpen, setChatPanelOpen] = useState(false);
  const [chatPanelTab, setChatPanelTab] = useState('messages');
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const [qaComposerOpen, setQaComposerOpen] = useState(false);
  const [floatingComment, setFloatingComment] = useState(null);
  const lastFloatingCommentIdRef = useRef(null);
  const [firestoreMessages, setFirestoreMessages] = useState([]);
  const [qaDraft, setQaDraft] = useState('');
  const qaInputRef = useRef(null);
  const shownAnswerIdsRef = useRef(new Set());
  const [answerToast, setAnswerToast] = useState(null);
  const answerToastTimerRef = useRef(null);
  const knownQuestionsRef = useRef(new Set());
  const [immersive, setImmersive] = useState(false);
  const [watermarkFaded, setWatermarkFaded] = useState(false);
  const watermarkTimerRef = useRef(null);
  const [chatDraft, setChatDraft] = useState('');
  const [localChat, setLocalChat] = useState({});
  const [videoMuted, setVideoMuted] = useState(true);
  const videoMutedRef = useRef(true);
  const [equipmentLibrary, setEquipmentLibrary] = useState(() => getEquipmentLibrary());
  const feedRef = useRef(null);
  const chatInputRef = useRef(null);
  const chatScrollRef = useRef({ x: 0, y: 0 });
  const chatSwipeStart = useRef(null);
  const chatSwipeOpened = useRef(false);
  const pointerStart = useRef(null);
  const pointerVelocity = useRef({ y: 0, time: 0, vy: 0 });
  const lastLiveTap = useRef({ time: 0, x: 0, y: 0 });
  const tapSheetTimer = useRef(null);
  const wheelTimer = useRef(null);
  const live = liveFeed[index] ?? liveFeed[0] ?? { id: '', equipment: [] };
  const activeLiveId = live.id;
  // When a specific liveId is requested (viewer navigating to a real broadcast), hide content
  // until that live is loaded into the feed — avoids briefly showing a random mock live.
  // Once the requested live is present in the feed, stop gating so swiping to the next lives
  // still renders their UI (streamer, buttons, etc.).
  const liveReady = !liveId || liveFeed.some((item) => item.id === liveId);

  // Track the real live being watched so we can detect when it ends
  const watchingLiveRef = useRef(null);
  const prevCreatedLivesRef = useRef([]);
  useEffect(() => {
    if (broadcastEnded || creatorMode || !live.creatorUid) return;
    watchingLiveRef.current = live;
  }, [live.id, live.creatorUid, broadcastEnded, creatorMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Detect when a real live ends: either disappears from createdLives or its status leaves 'live'.
  // Works even when the user is on a demo live in the feed (no liveId in URL).
  useEffect(() => {
    if (broadcastEnded || creatorMode) return;
    const prev = prevCreatedLivesRef.current;
    prevCreatedLivesRef.current = createdLives;
    if (prev.length === 0) return; // first load, no baseline yet

    // Find a live that either disappeared OR whose status changed away from 'live'
    const endedLive = prev.find((l) => {
      if (!l.id || !l.creatorUid) return false; // only real Firestore lives
      const current = createdLives.find((c) => c.id === l.id);
      return !current || (current.status && current.status !== 'live');
    });
    if (!endedLive) return;

    // Only show ended screen if user was watching this live or it's their own
    const wasWatching = watchingLiveRef.current?.id === endedLive.id
      || live.id === endedLive.id
      || liveId === endedLive.id
      || endedLive.creatorUid === user?.uid;
    console.log('[live-ended] createdLives detection — endedLive:', endedLive?.id, 'wasWatching:', wasWatching, 'liveId:', liveId);
    if (wasWatching) {
      setEndedLiveSnap((p) => p ?? endedLive);
      setBroadcastEnded(true);
      watchingLiveRef.current = null;
    }
  }, [createdLives, broadcastEnded, creatorMode, live.id, liveId, user?.uid]); // eslint-disable-line react-hooks/exhaustive-deps

  // Robust fallback: watch liveId (stable prop) directly in Firestore.
  // Uses a ref so the callback always sees the latest broadcastEnded value.
  const broadcastEndedRef = useRef(false);
  useEffect(() => { broadcastEndedRef.current = broadcastEnded; }, [broadcastEnded]);
  useEffect(() => {
    if (!liveId || creatorMode) return;
    let cancelled = false;
    let everExisted = false;
    console.log('[live-ended] direct fallback: subscribing to activeLives/', liveId);
    const unsub = onSnapshot(doc(db, 'activeLives', liveId), (snap) => {
      if (cancelled || broadcastEndedRef.current) return;
      const status = snap.data()?.status;
      console.log('[live-ended] direct fallback snapshot — exists:', snap.exists(), 'status:', status);
      if (snap.exists()) everExisted = true;
      // Only count as ended if the doc existed before (real Firestore live) and is now gone/ended.
      // If the doc never existed, it's a mock live — do not show ended screen.
      const isEnded = everExisted && (!snap.exists() || status === 'ended' || status === 'completed' || status === 'cancelled');
      if (isEnded) {
        console.log('[live-ended] direct fallback: triggering ended screen');
        setEndedLiveSnap((prev) => prev ?? watchingLiveRef.current ?? live);
        setBroadcastEnded(true);
      }
    }, (err) => { console.warn('[live-ended] direct fallback error:', err.message); });
    return () => { cancelled = true; unsub(); };
  }, [liveId, creatorMode]); // eslint-disable-line react-hooks/exhaustive-deps
  const liveEquipment = live.id ? getEquipmentSelection(equipmentLibrary, live.equipment?.map((item) => item.equipmentId) ?? demoLiveEquipmentIds) : [];
  const isLiked = !!liked[live.id];
  const liveCreatorId = live.creatorUid || live.id;
  const isFollowing = !!(following[liveCreatorId] ?? isFollowingCreator(liveCreatorId));

  // Debug overlay — poll video + peer connection state every second when ?debug=viewer
  useEffect(() => {
    if (!debugViewer) return;
    const interval = setInterval(() => {
      const video = remoteVideoRef.current;
      const pc = window.__vuvioPeerConnection;
      setDebugInfo({
        readyState: video?.readyState ?? '—',
        paused: video?.paused ?? '—',
        srcType: video?.srcObject ? 'srcObject' : video?.src ? 'src' : 'none',
        tracks: video?.srcObject ? video.srcObject.getTracks().map((t) => `${t.kind}:${t.readyState}`).join(' ') : '—',
        connState: pc?.connectionState ?? '—',
        iceState: pc?.iceConnectionState ?? '—',
        watchStatus,
        remoteStream: remoteStream ? (remoteStream === 'watching' ? 'watching' : 'stream') : 'null',
        hlsManifest: live?.hlsManifestUrl ? '✓' : '✗',
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [debugViewer, watchStatus, remoteStream, live?.hlsManifestUrl]);

  const attemptVideoPlayback = (video) => {
    if (!video) return;

    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.autoplay = true;

    const playWhenReady = () => {
      if (video.readyState >= 2) {
        video.play()?.catch?.((err) => {
          console.warn('[WatchPage] Video play error:', err.name, err.message);
        });
      } else {
        video.addEventListener('canplay', playWhenReady, { once: true });
      }
    };

    playWhenReady();
  };

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

  useEffect(() => {
    const item = liveFeed[index];
    if (item?.kind !== 'video') return;
    setIsCurrentVideoReady(videoReadySetRef.current.has(item.id));
  }, [index, liveFeed]);

  useEffect(() => subscribeToCreatedLives(setCreatedLives), []);

  // Subscribe to real comments + questions from Firestore for real broadcasts
  useEffect(() => {
    const targetId = activeLiveId || liveId;
    if (!targetId || !live.creatorUid) { setFirestoreMessages([]); return; }

    const toMsg = (d, kind) => ({
      id: d.id,
      who: d.userDisplayName || d.authorName || 'Anonymous',
      text: d.text || '',
      isQuestion: kind === 'question',
      ts: d.createdAt?.toMillis?.() ?? (d.createdAt?.seconds ?? 0) * 1000,
      time: d.createdAt ? new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(new Date((d.createdAt?.toMillis?.() ?? (d.createdAt?.seconds ?? 0) * 1000))) : '',
    });

    let comments = [];
    let questions = [];
    const merge = () => {
      const all = [...comments, ...questions].sort((a, b) => a.ts - b.ts);
      setFirestoreMessages(all);
    };

    const unsubComments = onSnapshot(collection(db, `activeLives/${targetId}/comments`), (snap) => {
      comments = snap.docs.map((d) => toMsg({ id: d.id, ...d.data() }, 'comment'));
      merge();
    }, () => {});

    const unsubQuestions = subscribeToQuestions(targetId, (qs) => {
      const items = [];
      qs.forEach((q) => {
        items.push(toMsg(q, 'question'));
        if (q.answered && q.answer?.text) {
          const answerTsMs = q.answer.createdAt
            ? new Date(q.answer.createdAt).getTime()
            : (q.createdAt?.toMillis?.() ?? (q.createdAt?.seconds ?? 0) * 1000);
          items.push({
            id: `${q.id}__answer`,
            who: q.answer.authorName || 'Streamer',
            text: q.answer.text,
            isQuestion: false,
            isAnswer: true,
            answerToWho: q.authorName || 'Spectateur',
            ts: answerTsMs,
            time: new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(new Date(answerTsMs)),
          });
        }
      });
      questions = items;
      merge();
    });

    return () => { unsubComments(); unsubQuestions(); };
  }, [activeLiveId, liveId, live.creatorUid]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Watch for broadcaster live updates (hlsManifestUrl, status, etc.)
  useEffect(() => {
    if (creatorMode || !activeLiveId || !live.creatorUid) return;

    let isMounted = true;

    const unsubscribe = onSnapshot(doc(db, 'activeLives', activeLiveId), (docSnap) => {
      if (!isMounted) return;

      try {
        if (!docSnap.exists()) {
          console.log('[live-ended] broadcast watcher: doc deleted — triggering ended screen');
          setEndedLiveSnap((prev) => prev ?? live);
          setBroadcastEnded(true);
          return;
        }
        if (docSnap.exists()) {
          const data = docSnap.data();

          // Propagate live field updates (hlsManifestUrl, cloudflareLiveInputId, etc.) into
          // createdLives so the viewer connection effect re-runs when HLS becomes available.
          setCreatedLives((prev) => {
            const idx = prev.findIndex((l) => l.id === activeLiveId);
            if (idx === -1) return prev;
            const updated = { ...prev[idx], ...data };
            if (
              prev[idx].hlsManifestUrl === updated.hlsManifestUrl &&
              prev[idx].whepUrl === updated.whepUrl &&
              prev[idx].status === updated.status
            ) return prev;
            const next = [...prev];
            next[idx] = updated;
            return next;
          });

          // Show incoming comments as a brief floating overlay
          const lc = data?.latestComment;
          if (lc?.id && lc.id !== lastFloatingCommentIdRef.current) {
            lastFloatingCommentIdRef.current = lc.id;
            setFloatingComment({ name: lc.userDisplayName || 'Anonymous', text: lc.text || '' });
            window.setTimeout(() => setFloatingComment(null), 4000);
          }

          if (data.status === 'ended' || data.status === 'completed' || data.status === 'cancelled') {
            console.log('[live-ended] broadcast watcher: status =', data.status, '— triggering ended screen');
            setIsLivePaused(false);
            setEndedLiveSnap((prev) => prev ?? live);
            setBroadcastEnded(true);
            setRemoteStream(null);
            if (webrtcCallRef.current) {
              webrtcCallRef.current.close();
            }
            closePeer();
          }

          if (PAUSE_RESUME_ENABLED) {
            const paused = data.liveStatus === 'paused';
            setIsLivePaused(paused);
            if (paused) {
              setPauseExpectedEndAt(data.pauseExpectedEndAt?.toDate?.() ?? null);
            } else {
              setPauseExpectedEndAt(null);
              if (wasLivePausedRef.current) {
                setIsReconnecting(true);
                setTimeout(() => setIsReconnecting(false), 3000);
              }
            }
            wasLivePausedRef.current = paused;
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

  // Auto-navigate to /watch 5s after a live ends (viewer side)
  useEffect(() => {
    if (!broadcastEnded || creatorMode) return;
    const timer = setTimeout(() => {
      navigate('/watch', { replace: true });
    }, 5000);
    return () => clearTimeout(timer);
  }, [broadcastEnded, creatorMode, navigate]);

  // Reset ended state only when liveId transitions from truthy → falsy (navigation away from a specific live).
  // Must NOT fire when liveId was never set — that would instantly clear broadcastEnded for viewers
  // watching a live from the feed (no liveId in URL), preventing the ended screen from showing.
  const prevLiveIdForResetRef = useRef(liveId);
  useEffect(() => {
    const was = prevLiveIdForResetRef.current;
    prevLiveIdForResetRef.current = liveId;
    if (was && !liveId) {
      setBroadcastEnded(false);
      setEndedLiveSnap(null);
    }
  }, [liveId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Prefetch HLS manifests for adjacent feed items so swiping feels instant.
  useEffect(() => {
    if (creatorMode) return;
    const prefetch = (url) => {
      if (!url) return;
      const existing = [...document.querySelectorAll('link[rel="prefetch"]')].some((l) => l.href === url);
      if (existing) return;
      const el = document.createElement('link');
      el.rel = 'prefetch';
      el.href = url;
      document.head.appendChild(el);
    };
    [-1, 1, 2].forEach((offset) => {
      const item = liveFeed[index + offset];
      if (item?.hlsManifestUrl) prefetch(item.hlsManifestUrl);
    });
  }, [index, liveFeed, creatorMode]);

  // Viewer connection. Priority: HLS (Cloudflare) → P2P WebRTC.
  useEffect(() => {
    if (creatorMode || !activeLiveId || !remoteVideoEl || !liveReady || broadcastEnded) return;
    const video = remoteVideoEl;

    // Reset spinner whenever this effect re-runs (e.g. hlsManifestUrl just arrived via Firestore).
    // Without this, a previous P2P attempt's setRemoteStream('watching') hides the spinner while
    // HLS retries silently in the background, leaving the user with a black screen.
    setRemoteStream(null);

    // Ended lives: prefer replayUrl (VOD, permanent). If none, replay isn't ready — show ended UI.
    const isEnded = live.status === 'ended' || Boolean(live.liveEndedAt);
    if (isEnded && !live.replayUrl) {
      setEndedLiveSnap((prev) => prev ?? live);
      setBroadcastEnded(true);
      return;
    }
    const whepSource = !isEnded ? live.whepUrl : null;
    const hlsSource = isEnded ? live.replayUrl : live.hlsManifestUrl;
    const hlsFailureKey = hlsSource ? `${activeLiveId}:${hlsSource}` : null;
    const hlsFailed = hlsFailureKey && hlsFailure?.key === hlsFailureKey;
    const viewerId = `viewer-${activeLiveId}-${Math.random().toString(36).slice(2, 8)}`;

    // If any source already won (P2P, HLS, or WHEP), don't restart — effect re-runs on dep changes.
    if (anySourceWonRef.current) return;
    if (whepConnectedRef.current) return;

    // --- Path A: HLS (Cloudflare) + parallel P2P fallback ---
    // HLS is preferred (works cross-network). P2P starts in parallel after a few HLS failures
    // so same-WiFi viewers don't wait 60s for Cloudflare to be ready.
    if (hlsSource && !hlsFailed) {
      let cancelled = false;
      let hls = null;
      let retryTimer = null;
      let retryCount = 0;
      const MAX_HLS_RETRIES = 30;
      const HLS_RETRY_DELAY = 1500;
      // After this many HLS failures, start P2P in parallel (don't wait for HLS to give up)
      const P2P_PARALLEL_AFTER = 1;

      // Parallel P2P state
      let p2pSession = null;
      let p2pStarted = false;
      let won = false; // set to true when any source connects — cancels the other
      let p2pConnected = false; // guard against ontrack firing twice (audio + video)

      const onSourceWon = (source) => {
        if (won) return false;
        won = true;
        anySourceWonRef.current = true;
        console.log(`[VIEWER] playback started | viewerId: ${viewerId} | liveId: ${activeLiveId} | source: ${source}`);
        setWatchStatus('connected');
        setWatchRetry(0);
        return true;
      };

      const stopHls = () => {
        cancelled = true;
        window.clearTimeout(retryTimer);
        hls?.destroy(); hls = null;
        if (video.src) video.src = '';
      };

      const stopP2p = () => {
        p2pSession?.close?.();
        closePeer();
      };

      const startP2p = () => {
        if (p2pStarted || won || cancelled) return;
        p2pStarted = true;
        const p2pId = `p2p-${viewerId}`;
        console.log(`[VIEWER] starting parallel P2P | liveId: ${activeLiveId}`);
        watchBroadcast(activeLiveId, (stream, status) => {
          if (stream) {
            if (won && !p2pConnected) { stopP2p(); return; } // HLS won before P2P — close P2P
            if (p2pConnected) return; // ontrack fires once per track; ignore duplicates
            p2pConnected = true;
            if (!onSourceWon('p2p')) return;
            stopHls();
            if (video.srcObject !== stream) {
              video.src = '';
              video.srcObject = stream;
            }
            setRemoteStream(stream);
            attemptVideoPlayback(video);
          } else if (status && ['failed', 'disconnected', 'ice:failed', 'ice:disconnected'].includes(status) && !won) {
            console.warn(`[VIEWER] parallel P2P disconnected (${status}) — HLS still retrying | liveId: ${activeLiveId}`);
          }
        }, p2pId, user?.uid ?? null)
          .then((result) => { p2pSession = result; })
          .catch((err) => { if (!won) console.warn(`[VIEWER] parallel P2P failed: ${err?.message} | liveId: ${activeLiveId}`); });
      };

      if (video.srcObject) video.srcObject = null;
      setBroadcastEnded(false);

      const tryHls = () => {
        if (cancelled) return;
        if (anySourceWonRef.current) return; // P2P/WHEP won while retry timer was pending
        hls?.destroy();
        hls = null;

        if (Hls.isSupported()) {
          hls = new Hls({
            lowLatencyMode: !isEnded,
            startFragPrefetch: true,
            maxBufferLength: isEnded ? 30 : 8,
            liveSyncDurationCount: 2,
          });
          hls.loadSource(hlsSource);
          hls.attachMedia(video);
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            if (cancelled || won || whepConnectedRef.current) return;
            if (!onSourceWon('hls')) return;
            stopP2p();
            stopWhepViewer(); // HLS won — cancel WHEP if still trying
            setRemoteStream('watching');
            attemptVideoPlayback(video);
          });
          hls.on(Hls.Events.ERROR, (_, data) => {
            if (cancelled || !data.fatal) return;
            if (anySourceWonRef.current) { hls?.destroy(); hls = null; return; } // P2P/WHEP won — stop HLS
            hls?.destroy();
            hls = null;
            if (retryCount < MAX_HLS_RETRIES) {
              retryCount += 1;
              console.warn(`[VIEWER] HLS retry ${retryCount}/${MAX_HLS_RETRIES}: ${data.details} | liveId: ${activeLiveId}`);
              setWatchStatus('retrying');
              setWatchRetry(retryCount);
              if (retryCount >= P2P_PARALLEL_AFTER) startP2p();
              retryTimer = window.setTimeout(tryHls, HLS_RETRY_DELAY);
            } else {
              console.warn(`[VIEWER] HLS exhausted; P2P already running | liveId: ${activeLiveId}`);
              setWatchStatus('fallback');
              setHlsFailure({ key: hlsFailureKey, details: data.details });
            }
          });
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          // Safari native HLS — pre-fetch manifest to confirm it's valid before handing to video element
          const scheduleNativeRetry = (detail) => {
            if (cancelled) return;
            if (retryCount < MAX_HLS_RETRIES) {
              retryCount += 1;
              console.warn(`[VIEWER] Safari HLS retry ${retryCount}/${MAX_HLS_RETRIES}: ${detail} | liveId: ${activeLiveId}`);
              setWatchStatus('retrying');
              setWatchRetry(retryCount);
              if (retryCount >= P2P_PARALLEL_AFTER) startP2p();
              retryTimer = window.setTimeout(tryHls, HLS_RETRY_DELAY);
            } else {
              console.warn(`[VIEWER] Safari HLS exhausted; P2P already running | liveId: ${activeLiveId}`);
              setWatchStatus('fallback');
              setHlsFailure({ key: hlsFailureKey, details: detail });
            }
          };
          // Fetch with timeout so a hanging Cloudflare response doesn't block retries
          const fetchCtrl = new AbortController();
          const fetchTimeout = window.setTimeout(() => fetchCtrl.abort(), 8000);
          fetch(hlsSource, { method: 'GET', cache: 'no-store', signal: fetchCtrl.signal })
            .then((res) => { window.clearTimeout(fetchTimeout); return res.text(); })
            .then((text) => {
              if (cancelled) return;
              if (!text.startsWith('#EXTM3U')) {
                scheduleNativeRetry('not-hls');
                return;
              }
              // Check manifest has actual segment data — an empty manifest (no segments) means
              // Cloudflare HLS pipeline isn't ready yet even if the header is valid
              const hasSegments = text.includes('#EXTINF') || text.includes('#EXT-X-STREAM-INF');
              if (!hasSegments) {
                scheduleNativeRetry('empty-manifest');
                return;
              }
              video.src = '';
              video.load();
              video.src = hlsSource;
              const onMeta = () => {
                if (cancelled || won) return;
                if (!onSourceWon('nativeHls')) return;
                stopP2p();
                setRemoteStream('watching');
                attemptVideoPlayback(video);
              };
              const onErr = () => {
                if (cancelled) return;
                video.removeEventListener('loadedmetadata', onMeta);
                scheduleNativeRetry('nativeHlsError');
              };
              video.addEventListener('loadedmetadata', onMeta, { once: true });
              video.addEventListener('error', onErr, { once: true });
            })
            .catch((err) => {
              window.clearTimeout(fetchTimeout);
              if (cancelled) return;
              scheduleNativeRetry(err.name === 'AbortError' ? 'fetch-timeout' : err.message);
            });
        }
      };

      tryHls();

      return () => {
        cancelled = true;
        won = true;
        window.clearTimeout(retryTimer);
        hls?.destroy();
        video.src = '';
        stopP2p();
      };
    }

    // If a Cloudflare live input exists but hlsManifestUrl is not yet available, wait for the
    // Firestore update instead of falling into P2P. The backend writes hlsManifestUrl in the same
    // request that creates the live input, so this window is very brief.
    if (live.cloudflareLiveInputId && !hlsFailed) {
      console.log(`[VIEWER] Cloudflare live input detected but hlsManifestUrl not yet set — waiting | liveId: ${activeLiveId} | P2P fallback used: false`);
      return;
    }

    // --- Path B: P2P WebRTC — final fallback when Cloudflare HLS is unavailable ---
    console.log(`[VIEWER] playback source: p2p | viewerId: ${viewerId} | liveId: ${activeLiveId} | P2P fallback used: true`);

    let cancelled = false;
    const viewerSessionId = Math.random().toString(36).slice(2, 8);
    let viewerSession = null;
    let retryTimer = null;
    let retryCount = 0;
    const MAX_RETRIES = 12;
    const RETRY_DELAY = 2000;

    window.clearTimeout(hlsFallbackTimerRef.current);
    if (video.srcObject) video.srcObject = null;
    setRemoteStream('watching');
    setBroadcastEnded(false);

    const connect = () => {
      if (cancelled) return;
      console.log(`[VIEWER] P2P connect attempt | viewerId: ${viewerSessionId} | liveId: ${activeLiveId}`);

      watchBroadcast(activeLiveId, (stream, status) => {
        if (cancelled) return;
        if (stream) {
          console.log(`[VIEWER] playback started | viewerId: ${viewerSessionId} | liveId: ${activeLiveId} | source: P2P`);
          video.srcObject = stream;
          attemptVideoPlayback(video);
          setRemoteStream(stream);
          setWatchStatus('connected');
          window.clearTimeout(hlsFallbackTimerRef.current);
        } else if (status && ['failed', 'disconnected', 'ice:failed', 'ice:disconnected'].includes(status)) {
          console.warn(`[VIEWER] P2P disconnected | viewerId: ${viewerSessionId} | liveId: ${activeLiveId} | status: ${status}`);
          if (!cancelled && retryCount < MAX_RETRIES) {
            retryCount += 1;
            setWatchStatus('retrying');
            setWatchRetry(retryCount);
            retryTimer = window.setTimeout(connect, RETRY_DELAY);
          } else if (!cancelled) {
            console.warn(`[VIEWER] P2P exhausted all retries after disconnect | liveId: ${activeLiveId}`);
            setWatchStatus('error');
          }
        }
      }, viewerSessionId, user?.uid ?? null).then((result) => {
        viewerSession = result;
      }).catch((err) => {
        if (cancelled) return;
        console.warn(`[VIEWER] P2P failed | viewerId: ${viewerSessionId} | liveId: ${activeLiveId} | error: ${err?.message ?? err}`);
        if (retryCount < MAX_RETRIES) {
          retryCount += 1;
          setWatchStatus('retrying');
          setWatchRetry(retryCount);
          retryTimer = window.setTimeout(connect, RETRY_DELAY);
        } else {
          console.warn(`[VIEWER] P2P exhausted all retries | liveId: ${activeLiveId}`);
          setWatchStatus('error');
        }
      });
    };

    connect();

    return () => {
      cancelled = true;
      window.clearTimeout(hlsFallbackTimerRef.current);
      if (retryTimer) window.clearTimeout(retryTimer);
      viewerSession?.close?.();
      closePeer();
    };
  }, [creatorMode, activeLiveId, user?.uid, live.whepUrl, live.hlsManifestUrl, live.replayUrl, live.status, live.cloudflareLiveInputId, hlsFailure, remoteVideoEl, whepFailed, liveReady, broadcastEnded]);

  // Reset whepFailed when the live stream changes so a new stream gets a fresh WHEP attempt.
  useEffect(() => { setWhepFailed(false); whepConnectedRef.current = false; anySourceWonRef.current = false; }, [activeLiveId]);

  // Dedicated WHEP effect — minimal deps so Firestore updates don't restart the connection mid-ICE.
  useEffect(() => {
    if (creatorMode || !activeLiveId || !remoteVideoEl || whepFailed || !liveReady || broadcastEnded) return;
    const isEnded = live.status === 'ended' || Boolean(live.liveEndedAt);
    const whepSource = !isEnded ? live.whepUrl : null;
    if (!whepSource) return;

    let cancelled = false;
    let retryTimer = null;
    let whepRetryCount = 0;
    const MAX_WHEP_RETRIES = 10;
    const WHEP_RETRY_DELAY = 1000;

    const tryWhep = () => {
      if (cancelled) return;
      console.log(`[VIEWER] trying WHEP${whepRetryCount > 0 ? ` (retry ${whepRetryCount}/${MAX_WHEP_RETRIES})` : ''} | liveId: ${activeLiveId}`);

      startWhepViewer(whepSource, (stream, status) => {
        if (cancelled) return;
        if (stream) {
          if (anySourceWonRef.current) { stopWhepViewer(); return; }
          console.log(`[VIEWER] WHEP connected | liveId: ${activeLiveId}`);
          const el = remoteVideoRef.current;
          console.log(`[WHEP] el=${el ? 'ok' : 'NULL'} | tracks=${stream.getTracks().map(t => t.kind + ':' + t.readyState).join(',')}`);
          if (!el) { console.warn('[WHEP] remoteVideoRef.current is null'); return; }
          whepConnectedRef.current = true;
          anySourceWonRef.current = true;
          el.src = '';
          el.srcObject = stream;
          el.muted = true;
          el.playsInline = true;
          const p = el.play();
          if (p) p.then(() => console.log('[WHEP] play() started')).catch((e) => console.warn('[WHEP] play() blocked:', e.message));
          setRemoteStream('watching');
          setWatchStatus('connected');
          setWatchRetry(0);
        } else if (status === 'failed' || status === 'disconnected') {
          console.warn(`[VIEWER] WHEP ${status} — falling back to HLS | liveId: ${activeLiveId}`);
          whepConnectedRef.current = false;
          setWhepFailed(true);
          setRemoteStream(null);
          setWatchStatus('retrying');
        }
      }).catch((err) => {
        if (cancelled) return;
        // 409 = stream not started yet on Cloudflare — retry
        if (err.message?.includes('409') && whepRetryCount < MAX_WHEP_RETRIES) {
          whepRetryCount += 1;
          console.warn(`[VIEWER] WHEP 409 — stream not ready, retry ${whepRetryCount}/${MAX_WHEP_RETRIES} in ${WHEP_RETRY_DELAY}ms`);
          retryTimer = window.setTimeout(tryWhep, WHEP_RETRY_DELAY);
        } else {
          console.warn(`[VIEWER] WHEP threw: ${err.message} — falling back to HLS`);
          setWhepFailed(true);
        }
      });
    };

    tryWhep();

    return () => {
      cancelled = true;
      window.clearTimeout(retryTimer);
      whepConnectedRef.current = false;
      stopWhepViewer();
      const el = remoteVideoRef.current;
      if (el) el.srcObject = null;
    };
  }, [creatorMode, activeLiveId, remoteVideoEl, live.whepUrl, live.status, whepFailed, liveReady, broadcastEnded]);

  useEffect(() => {
    videoMutedRef.current = videoMuted;
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
    if (equipmentSheetOpen) return;
    if (event.target.closest('button, a, input, textarea, .live-chat-panel, .live-floating-composer, .equipment-viewer-sheet')) return;
    pointerStart.current = { x: event.clientX, y: event.clientY };
    pointerVelocity.current = { y: event.clientY, time: performance.now(), vy: 0 };
    setIsDragging(true);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const onPointerMove = (event) => {
    if (equipmentSheetOpen || !pointerStart.current) return;
    const now = performance.now();
    const dt = now - pointerVelocity.current.time;
    if (dt > 0) {
      pointerVelocity.current = {
        y: event.clientY,
        time: now,
        vy: (event.clientY - pointerVelocity.current.y) / dt,
      };
    }
    const nextDrag = event.clientY - pointerStart.current.y;
    setDragY(nextDrag);
  };

  const toggleImmersive = () => {
    if (tapSheetTimer.current) {
      window.clearTimeout(tapSheetTimer.current);
      tapSheetTimer.current = null;
    }
    setChatComposerOpen(false);
    setChatPanelOpen(false);
    setQaComposerOpen(false);
    setUserSheetOpen(false);
    setEquipmentSheetOpen(false);
    setImmersive((prev) => {
      const next = !prev;
      if (next) {
        const el = feedRef.current || document.documentElement;
        (el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen)?.call(el);
      } else {
        (document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen)?.call(document);
      }
      return next;
    });
  };

  useEffect(() => {
    const onFsChange = () => {
      if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        setImmersive(false);
      }
    };
    document.addEventListener('fullscreenchange', onFsChange);
    document.addEventListener('webkitfullscreenchange', onFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      document.removeEventListener('webkitfullscreenchange', onFsChange);
    };
  }, []);

  const handleLiveTap = (event, moved) => {
    if (moved > 18 || event.target.closest('button, a, input, textarea, .live-chat-panel, .live-floating-composer')) return;

    const now = Date.now();
    const previous = lastLiveTap.current;
    const distance = Math.hypot(event.clientX - previous.x, event.clientY - previous.y);

    if (now - previous.time < 460 && distance < 72) {
      lastLiveTap.current = { time: 0, x: 0, y: 0 };
      toggleImmersive();
      return;
    }

    lastLiveTap.current = { time: now, x: event.clientX, y: event.clientY };
    if (immersive && watermarkFaded) {
      setWatermarkFaded(false);
      clearTimeout(watermarkTimerRef.current);
      watermarkTimerRef.current = setTimeout(() => setWatermarkFaded(true), 2800);
    }
    if (tapSheetTimer.current) window.clearTimeout(tapSheetTimer.current);
    tapSheetTimer.current = window.setTimeout(() => {
      tapSheetTimer.current = null;
      if (!chatComposerOpen && !chatPanelOpen && !qaComposerOpen) {
        setUserSheetOpen(true);
      }
    }, 480);
  };

  const onLiveDoubleClick = (event) => {
    if (event.target.closest('button, a, input, textarea, .live-chat-panel, .live-floating-composer, .equipment-viewer-sheet')) return;
    event.preventDefault();
    lastLiveTap.current = { time: 0, x: 0, y: 0 };
    toggleImmersive();
  };

  const endPointer = (event) => {
    if (!pointerStart.current) return;
    const moved = Math.hypot(event.clientX - pointerStart.current.x, event.clientY - pointerStart.current.y);
    const vy = pointerVelocity.current.vy; // px/ms, negative = up
    const VELOCITY_THRESHOLD = 0.3;
    const shouldGoNext = dragY <= -SWIPE_THRESHOLD || vy < -VELOCITY_THRESHOLD;
    const shouldGoPrev = dragY >= SWIPE_THRESHOLD || vy > VELOCITY_THRESHOLD;
    if (shouldGoNext) {
      goTo(1);
      lastLiveTap.current = { time: 0, x: 0, y: 0 };
    } else if (shouldGoPrev) {
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
    if (event.target.closest('.equipment-viewer-sheet')) return;
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

  const chat = useMemo(() => {
    if (firestoreMessages.length > 0) return firestoreMessages;
    return [...(live.chat ?? []), ...(localChat[activeLiveId] ?? [])];
  }, [firestoreMessages, live.chat, localChat, activeLiveId]);
  const visibleChat = useMemo(() => chat.slice(-6), [chat]);
  const chatCount = Math.max(chat.length, viewerCount(live.viewerLabel) + 21);
  const trackStyle = {
    transform: `translate3d(0, calc(${-index * 100}% + ${dragY}px), 0)`,
  };

  useEffect(() => {
    if (!chatComposerOpen && !chatPanelOpen) return;
    window.setTimeout(() => chatInputRef.current?.focus(), 80);
  }, [chatComposerOpen, chatPanelOpen]);

  useEffect(() => {
    if (!qaComposerOpen) return;
    window.setTimeout(() => qaInputRef.current?.focus(), 80);
  }, [qaComposerOpen]);

  useEffect(() => {
    if (!activeLiveId) return undefined;
    // Reset per-live caches so a new live doesn't inherit old IDs
    knownQuestionsRef.current = new Set();
    return subscribeToQuestions(activeLiveId, (qs) => {
      // Track all seen question IDs — questions created in THIS session (missing from first snapshot)
      // are the only ones we treat as "mine" for toast purposes when answered.
      const isFirstSnapshot = knownQuestionsRef.current.size === 0;
      if (isFirstSnapshot) {
        qs.forEach((q) => knownQuestionsRef.current.add(q.id));
      }
      qs.filter((q) => q.answered && q.answer && !shownAnswerIdsRef.current.has(q.id)).forEach((q) => {
        shownAnswerIdsRef.current.add(q.id);
        // Toast only if answer is to a question the current user asked
        const isMine = user?.uid && q.authorId === user.uid;
        if (isMine) {
          if (answerToastTimerRef.current) window.clearTimeout(answerToastTimerRef.current);
          setAnswerToast({ text: q.answer.text, who: q.answer.authorName || 'Streamer' });
          answerToastTimerRef.current = window.setTimeout(() => setAnswerToast(null), 5200);
        }
      });
    });
  }, [activeLiveId, user?.uid]);

  useEffect(() => () => {
    if (answerToastTimerRef.current) window.clearTimeout(answerToastTimerRef.current);
  }, []);

  useEffect(() => {
    if (!chatComposerOpen && !chatPanelOpen && !qaComposerOpen) {
      document.documentElement.style.removeProperty('--live-keyboard-offset');
      document.documentElement.classList.remove('has-soft-keyboard');
      setKeyboardOffset(0);
      if (window.scrollY !== 0) window.scrollTo(0, 0);
      return undefined;
    }

    const viewport = window.visualViewport;
    if (!viewport) return undefined;

    let removeTimer = null;
    const pinScrollTop = () => {
      if (window.scrollY !== 0 || document.documentElement.scrollTop !== 0 || document.body.scrollTop !== 0) {
        window.scrollTo(0, 0);
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
      }
    };

    const updateKeyboardOffset = () => {
      const offset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
      const rounded = Math.round(offset);
      document.documentElement.style.setProperty('--live-keyboard-offset', `${rounded}px`);
      if (rounded > 80) {
        if (removeTimer) { window.clearTimeout(removeTimer); removeTimer = null; }
        document.documentElement.classList.add('has-soft-keyboard');
      } else if (document.documentElement.classList.contains('has-soft-keyboard') && !removeTimer) {
        removeTimer = window.setTimeout(() => {
          document.documentElement.classList.remove('has-soft-keyboard');
          removeTimer = null;
          pinScrollTop();
          window.requestAnimationFrame(pinScrollTop);
        }, 180);
      }
      pinScrollTop();
      setKeyboardOffset(rounded);
    };

    updateKeyboardOffset();
    viewport.addEventListener('resize', updateKeyboardOffset);
    viewport.addEventListener('scroll', updateKeyboardOffset);

    return () => {
      viewport.removeEventListener('resize', updateKeyboardOffset);
      viewport.removeEventListener('scroll', updateKeyboardOffset);
      if (removeTimer) window.clearTimeout(removeTimer);
      document.documentElement.style.removeProperty('--live-keyboard-offset');
      document.documentElement.classList.remove('has-soft-keyboard');
      setKeyboardOffset(0);
      pinScrollTop();
      window.requestAnimationFrame(pinScrollTop);
    };
  }, [chatComposerOpen, chatPanelOpen, qaComposerOpen]);

  useEffect(() => {
    const clean = () => {
      document.documentElement.style.removeProperty('--live-keyboard-offset');
      document.documentElement.classList.remove('has-soft-keyboard');
      if (window.scrollY !== 0) window.scrollTo(0, 0);
    };
    window.addEventListener('pagehide', clean);
    return () => {
      window.removeEventListener('pagehide', clean);
      clean();
    };
  }, []);

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
    if (!immersive) {
      clearTimeout(watermarkTimerRef.current);
      setWatermarkFaded(false);
      return;
    }
    setWatermarkFaded(false);
    watermarkTimerRef.current = setTimeout(() => setWatermarkFaded(true), 2800);
    return () => clearTimeout(watermarkTimerRef.current);
  }, [immersive]);

  useEffect(() => {
    return () => {
      if (tapSheetTimer.current) window.clearTimeout(tapSheetTimer.current);
    };
  }, []);

  // Reset iOS viewport zoom on unmount — keyboard interactions during a live can
  // leave the viewport at a non-1 scale that persists across navigation.
  useEffect(() => {
    return () => {
      const meta = document.querySelector('meta[name="viewport"]');
      if (!meta) return;
      const original = meta.getAttribute('content');
      meta.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1');
      requestAnimationFrame(() => meta.setAttribute('content', original));
      window.scrollTo(0, 0);
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
    const burstId = Date.now();
    setSendBursts((s) => [...s, { id: burstId, text }]);
    window.setTimeout(() => setSendBursts((s) => s.filter((b) => b.id !== burstId)), 3200);

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

  const sendLiveQuestion = async (event) => {
    event?.preventDefault();
    event?.stopPropagation();
    const text = qaDraft.trim();
    const targetLiveId = activeLiveId || liveId;
    if (!text || !targetLiveId || !user?.uid) return;

    qaInputRef.current?.blur();
    pointerStart.current = null;
    setIsDragging(false);
    setDragY(0);
    setLocalChat((state) => ({
      ...state,
      [targetLiveId]: [
        ...(state[targetLiveId] ?? []),
        {
          who: user.displayName || 'Vous',
          text,
          time: new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(new Date()),
          isQuestion: true,
        },
      ],
    }));
    const burstId = Date.now();
    setSendBursts((s) => [...s, { id: burstId, text }]);
    window.setTimeout(() => setSendBursts((s) => s.filter((b) => b.id !== burstId)), 3200);
    setQaDraft('');
    setQaComposerOpen(false);

    try {
      await sendQuestion({
        liveId: targetLiveId,
        streamCreatorId: live.creatorUid || null,
        authorId: user.uid,
        authorName: user.displayName || 'Spectateur',
        authorAvatar: user.photoURL || null,
        text,
      });
    } catch (err) {
      console.error('[LiveViewer] Failed to send question:', err);
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

  const seoTitle = live?.id
    ? `${liveTitle(live)} - ${familyLabel(live, t)} | Vuvio`
    : 'Vuvio - Metiers, passions et experiences en direct';
  const seoDescription = live?.id
    ? streamDescription(live)
    : 'Decouvrez le monde en direct a travers le regard de ceux qui le vivent. Metiers, passions, voyages, artisanat, sport, musique et experiences reelles en POV.';
  const seoCanonical = liveId ? `/watch?live=${encodeURIComponent(liveId)}` : '/watch';
  const seoImage = liveImage(live);
  const seoJsonLd = live?.id ? {
    '@context': 'https://schema.org',
    '@type': 'BroadcastEvent',
    name: streamTitle(live),
    description: seoDescription,
    url: `${SITE_URL}${seoCanonical}`,
    isLiveBroadcast: live.status !== 'ended',
    eventAttendanceMode: 'https://schema.org/OnlineEventAttendanceMode',
    location: {
      '@type': 'VirtualLocation',
      url: `${SITE_URL}${seoCanonical}`,
    },
    performer: {
      '@type': 'Person',
      name: streamCreator(live),
    },
    about: [live.category, live.subcategory, streamLocation(live)].filter(Boolean).join(' - ') || undefined,
    image: seoImage ? [seoImage.startsWith('http') ? seoImage : `${SITE_URL}${seoImage}`] : undefined,
  } : null;

  return (
    <section
      ref={feedRef}
      className={`screen live-feed${immersive ? ' is-immersive' : ''}`}
      aria-label="Vuvio live"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPointer}
      onPointerCancel={endPointer}
      onDoubleClick={onLiveDoubleClick}
      onWheel={onWheel}
    >
      <SEO title={seoTitle} description={seoDescription} canonical={seoCanonical} image={seoImage} jsonLd={seoJsonLd} />
      <div className={isDragging ? 'live-feed__track is-dragging' : 'live-feed__track'} style={trackStyle}>
        {liveFeed.map((item, itemIndex) => {
          const isActive = itemIndex === index;

          return (
            <article className="live-slide" key={item.feedKey ?? item.id} aria-hidden={!isActive}>
              {item.kind === 'camera' && creatorMode ? (
                <CameraLiveMedia live={item} isActive={isActive} isDragging={isDragging} dragY={dragY} />
              ) : item.kind === 'video' ? (
                <>
                  {!isActive && item.image
                    ? <>
                        <img className="live-slide__media live-slide__media--pov" src={item.image} aria-hidden="true" draggable="false" />
                        {Math.abs(itemIndex - index) === 1 && item.video && (
                          <video key={`preload-${item.id}`} src={item.video} preload="auto" muted playsInline style={{ display: 'none' }} />
                        )}
                      </>
                    : <>
                        <video
                          ref={isActive ? (el) => { videoPlaybackRef.current = el; videoRefCallback(el); } : null}
                          className="live-slide__media live-slide__media--video"
                          src={item.video}
                          muted={true}
                          loop
                          playsInline
                          autoPlay={isActive}
                          preload="auto"
                          onCanPlay={isActive ? () => {
                            videoReadySetRef.current.add(item.id);
                            setIsCurrentVideoReady(true);
                          } : undefined}
                          style={isActive && isDragging ? { transform: `scale(1.03) translateY(${dragY * 0.1}px)` } : undefined}
                        />
                      </>
                  }
                </>
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
                    <>
                      <div className="live-slide__poster" aria-hidden="true">
                        <img src="/assets/logo/vuvio-logo-dark.png" alt="" />
                      </div>
                      <video
                        ref={stableVideoRef}
                        className="live-slide__media live-slide__media--pov"
                        autoPlay
                        muted
                        playsInline
                        style={isDragging ? { transform: `scale(1.03) translateY(${dragY * 0.1}px)` } : undefined}
                      />
                      {PAUSE_RESUME_ENABLED && isLivePaused ? (
                        <ViewerPauseOverlay pauseExpectedEndAt={pauseExpectedEndAt} />
                      ) : PAUSE_RESUME_ENABLED && isReconnecting ? (
                        <div className="viewer-reconnecting-overlay">
                          <span className="viewer-reconnecting-spinner" aria-hidden="true" />
                          <span className="viewer-reconnecting-label">Reconnexion au live…</span>
                        </div>
                      ) : !remoteStream ? (
                        <div className="live-slide__connecting">
                          {watchStatus === 'error' ? null : <i aria-hidden="true" />}
                          <span>
                            {watchStatus === 'error'
                              ? 'Stream unavailable. Try again later.'
                              : watchStatus === 'fallback'
                              ? 'Switching to direct connection…'
                              : 'Connecting live'}
                          </span>
                          {import.meta.env.DEV && watchStatus ? <small>{watchStatus}</small> : null}
                        </div>
                      ) : null}
                      {debugViewer ? (
                        <div style={{
                          position: 'absolute', top: 8, left: 8, zIndex: 9999,
                          background: 'rgba(0,0,0,0.75)', color: '#0f0', fontFamily: 'monospace',
                          fontSize: 11, padding: '6px 8px', borderRadius: 6, lineHeight: 1.6,
                          maxWidth: '90vw', wordBreak: 'break-all',
                        }}>
                          <div>readyState: {debugInfo.readyState} | paused: {String(debugInfo.paused)}</div>
                          <div>src: {debugInfo.srcType} | tracks: {debugInfo.tracks}</div>
                          <div>conn: {debugInfo.connState} | ice: {debugInfo.iceState}</div>
                          <div>watchStatus: {debugInfo.watchStatus || '—'} | stream: {debugInfo.remoteStream}</div>
                          <div>hlsManifest: {debugInfo.hlsManifest} | retry: {watchRetry}</div>
                        </div>
                      ) : null}
                    </>
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
              {broadcastEnded && isActive && !creatorMode && (() => {
                const endedItem = endedLiveSnap ?? item;
                return (
                  <div className="live-ended-screen">
                    {(endedItem.coverImageUrl ?? endedItem.thumbnailUrl ?? endedItem.image) && (
                      <img
                        src={endedItem.coverImageUrl ?? endedItem.thumbnailUrl ?? endedItem.image}
                        alt=""
                        className="live-ended-screen__cover"
                      />
                    )}
                    <div className="live-ended-screen__avatar">
                      {endedItem.avatarUrl ? (
                        <img src={endedItem.avatarUrl} alt="" />
                      ) : (
                        <span>{(endedItem.streamer ?? endedItem.name ?? '?')[0].toUpperCase()}</span>
                      )}
                    </div>
                    <p className="live-ended-screen__headline">
                      <strong>@{endedItem.streamer ?? endedItem.name}</strong> ended their livestream
                    </p>
                    <div className="live-ended-screen__btns">
                      <Link
                        to={`/profile/${endedItem.creatorUid}`}
                        className="live-ended-screen__btn"
                        onClick={(e) => e.stopPropagation()}
                      >
                        View profile
                      </Link>
                      <button
                        type="button"
                        className="live-ended-screen__btn live-ended-screen__btn--primary"
                        onClick={() => { navigate('/watch', { replace: true }); }}
                      >
                        Back to Watch
                      </button>
                    </div>
                  </div>
                );
              })()}
            </article>
          );
        })}
      </div>

      <div className="live-feed__top-gradient" />
      <div className="live-feed__bottom-gradient" />
      <div
        className={`live-feed__watermark${immersive ? (watermarkFaded ? ' wm-faded' : ' wm-visible') : ''}`}
        aria-hidden="true"
      >
        <BrandMark size={22} nameSize={12} gap={4} showName />
      </div>

      {floatingComment && !creatorMode && (
        <div className="creator-live-comment">
          <span>💬</span>
          <p><strong>{floatingComment.name}</strong>{` ${floatingComment.text}`}</p>
        </div>
      )}

      {/* Live-ended overlay — rendered outside the feed so it persists even if the stream
          is removed from liveFeed by the Firestore status update */}
      {broadcastEnded && !creatorMode && (() => {
        const snap = endedLiveSnap;
        const streamerName = snap?.streamer ?? snap?.name ?? null;
        return (
          <div className="live-ended-screen" style={{ position: 'fixed', zIndex: 9000 }}>
            {snap && (snap.coverImageUrl ?? snap.thumbnailUrl ?? snap.image) && (
              <img src={snap.coverImageUrl ?? snap.thumbnailUrl ?? snap.image} alt="" className="live-ended-screen__cover" />
            )}
            {snap && (
              <div className="live-ended-screen__avatar">
                {snap.avatarUrl ? (
                  <img src={snap.avatarUrl} alt="" />
                ) : (
                  <span>{(streamerName ?? '?')[0].toUpperCase()}</span>
                )}
              </div>
            )}
            <p className="live-ended-screen__headline">
              {streamerName
                ? <><strong>@{streamerName}</strong> ended their livestream</>
                : 'The livestream has ended'}
            </p>
            <div className="live-ended-screen__btns">
              {snap?.creatorUid && (
                <Link to={`/profile/${snap.creatorUid}`} className="live-ended-screen__btn" onClick={(e) => e.stopPropagation()}>
                  View profile
                </Link>
              )}
              <button type="button" className="live-ended-screen__btn live-ended-screen__btn--primary" onClick={() => { navigate('/watch', { replace: true }); }}>
                Back to Watch
              </button>
            </div>
          </div>
        );
      })()}

      {!broadcastEnded && liveReady && (
        <div className="live-feed__status">
          <LiveBadge pulse />
          <span className="live-feed__viewer-count">{formatViewers(live.viewerLabel ?? live.viewers ?? '0', i18n.language)}</span>
        </div>
      )}

      {!broadcastEnded && <LivePresenceOverlay liveId={live.id} liveTitle={live.title ?? live.note} onJoinFriend={() => {}} />}

      {!broadcastEnded && <LiveLocationGlobe live={live} onOpen={() => navigate(`/globe?live=${encodeURIComponent(live.id)}`)} />}

      {!broadcastEnded && (
        <div
          className={`live-chat${chatComposerOpen || chatPanelOpen || qaComposerOpen ? ' is-lifted' : ''}`}
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
          {followBursts.map((burst) => (
            <span
              key={burst.id}
              className="live-reaction-follow"
              style={{ left: `${burst.x}px`, top: `${burst.y}px` }}
            >
              <UserPlus size={18} strokeWidth={1.8} />
            </span>
          ))}
        </div>
      )}

      {!broadcastEnded && liveReady && <div className="live-feed__details">
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
            className={`${isFollowing ? 'is-active' : ''}${followPulse ? ' is-pulsing' : ''}`}
            onClick={(event) => {
              const next = !isFollowing;
              setFollowing((state) => ({ ...state, [liveCreatorId]: next }));
              setFollowingCreator(liveCreatorId, next).catch(() => {});
              if (live.creatorUid && user?.uid) {
                (next ? followCreator : unfollowCreator)(user.uid, live.creatorUid).catch(() => {});
              }
              if (next) {
                recordCreatorFollowed();
                const bounds = feedRef.current?.getBoundingClientRect();
                const bx = bounds ? event.clientX - bounds.left : event.clientX;
                const by = bounds ? event.clientY - bounds.top : event.clientY;
                const now = Date.now();
                const offsets = [
                  { dx: 0,   dy: 0,   delay: 0 },
                  { dx: -14, dy: -10, delay: 80 },
                  { dx: 12,  dy: -6,  delay: 155 },
                ];
                offsets.forEach(({ dx, dy, delay }) => {
                  const id = `follow-${now}-${delay}`;
                  window.setTimeout(() => {
                    setFollowBursts((s) => [...s, { id, x: bx + dx, y: by + dy }]);
                    window.setTimeout(() => setFollowBursts((s) => s.filter((b) => b.id !== id)), 1200);
                  }, delay);
                });
                setFollowPulse(true);
                window.setTimeout(() => setFollowPulse(false), 220);
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
          <button type="button" onClick={() => { chatScrollRef.current = { x: window.scrollX || 0, y: window.scrollY || 0 }; setQaComposerOpen(false); setChatPanelOpen(true); }} aria-label={t('live.privateMessage')}>
            <MessageCircle size={22} strokeWidth={1.8} />
          </button>
          <button type="button" onClick={() => { recordShared(); setShareLiveSheetOpen(true); }} aria-label={t('common.share')}>
            <Send size={21} strokeWidth={1.8} />
          </button>
          {(live.hasVideoAudio || live.whepUrl || (live.kind === 'camera' && (live.creatorUid || live.createdLocally))) && !creatorMode && (
            <button type="button" className={videoMuted ? 'live-sound-button' : 'is-active live-sound-button'} onClick={() => {
                const next = !videoMuted;
                setVideoMuted(next);
                // Synchronous unmute needed for iOS user-gesture audio unlock
                if (remoteVideoRef.current) remoteVideoRef.current.muted = next;
                if (videoPlaybackRef.current) videoPlaybackRef.current.muted = next;
              }} aria-label={videoMuted ? 'Unmute video' : 'Mute video'}>
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

      {sendBursts.map((burst) => (
        <div key={burst.id} className="live-send-burst" aria-hidden="true">{burst.text}</div>
      ))}

      {chatComposerOpen ? (
        <button type="button" className="live-chat-dismiss" aria-label="Close message composer" onClick={closeChatComposer} />
      ) : null}

      {qaComposerOpen ? (
        <button type="button" className="live-chat-dismiss" aria-label="Fermer" onClick={() => setQaComposerOpen(false)} />
      ) : null}

      {qaComposerOpen ? (
        <form className="live-floating-composer" onSubmit={sendLiveQuestion}>
          <input
            ref={qaInputRef}
            type="text"
            value={qaDraft}
            onChange={(event) => setQaDraft(event.target.value)}
            onBlur={() => window.setTimeout(() => {
              if (!document.activeElement?.closest?.('.live-floating-composer')) {
                setQaComposerOpen(false);
              }
            }, 120)}
            placeholder="Poser une question…"
            aria-label="Poser une question"
          />
          <button type="submit" className={qaDraft.trim() ? 'is-active' : ''} disabled={!qaDraft.trim()}>
            Envoyer
          </button>
        </form>
      ) : null}

      {chatComposerOpen ? (
        <form className="live-floating-composer" onSubmit={sendLiveMessage}>
          <input
            ref={chatInputRef}
            type="text"
            value={chatDraft}
            onChange={(event) => setChatDraft(event.target.value)}
            onBlur={() => window.setTimeout(() => {
              if (chatPanelOpen) return;
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

      {chatPanelOpen ? (() => {
        const messagesOnly = chat.filter((m) => !m.isQuestion && !m.isAnswer);
        const questionsOnly = chat.filter((m) => m.isQuestion || m.isAnswer);
        const isAsking = chatPanelTab === 'questions';
        const visibleChatPanel = isAsking ? questionsOnly : messagesOnly;
        const currentDraft = isAsking ? qaDraft : chatDraft;
        const currentSetDraft = isAsking ? setQaDraft : setChatDraft;
        const onComposerSubmit = isAsking ? sendLiveQuestion : sendLiveMessage;
        const bindComposerRef = (el) => {
          chatInputRef.current = el;
          qaInputRef.current = el;
        };
        return (
          <section
            className={`live-chat-panel${keyboardOffset > 80 ? ' is-keyboard' : ''}`}
            aria-label="Live chat"
          >
            <div
              className="live-chat-panel__backdrop"
              role="button"
              tabIndex={-1}
              aria-label="Close chat"
              onPointerDown={(event) => { event.preventDefault(); setChatPanelOpen(false); }}
            />
            <div className="live-chat-panel__sheet">
              <span className="live-chat-panel__handle" aria-hidden="true" />

              <div className="live-chat-panel__tabs" role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={!isAsking}
                  className={`live-chat-panel__tab${!isAsking ? ' is-active' : ''}`}
                  onClick={() => setChatPanelTab('messages')}
                >
                  <span>Chat</span>
                  <span className="live-chat-panel__tab-count">{messagesOnly.length}</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={isAsking}
                  className={`live-chat-panel__tab${isAsking ? ' is-active' : ''}`}
                  onClick={() => setChatPanelTab('questions')}
                >
                  <span>Questions</span>
                  <span className="live-chat-panel__tab-count">{questionsOnly.filter((m) => m.isQuestion).length}</span>
                </button>
                <button
                  type="button"
                  className="live-chat-panel__close"
                  onClick={() => setChatPanelOpen(false)}
                  aria-label="Close chat"
                >
                  <X size={15} strokeWidth={2.2} />
                </button>
              </div>

              <div className="live-chat-panel__list">
                {visibleChatPanel.length === 0 ? (
                  <div className="live-chat-panel__empty">
                    {isAsking
                      ? 'Aucune question pour le moment.'
                      : 'Aucun message pour le moment.'}
                  </div>
                ) : (
                  visibleChatPanel.map((message, messageIndex) => (
                    <article key={message.id ?? `${live.id}-panel-${message.who}-${messageIndex}`} className={`${message.isQuestion ? 'is-question' : ''}${message.isAnswer ? ' is-answer' : ''}`.trim()}>
                      <time>{message.time ?? `${Math.max(1, visibleChatPanel.length - messageIndex)}m`}</time>
                      <p>
                        {message.isQuestion ? <span className="live-chat-panel__q-badge">Q</span> : null}
                        {message.isAnswer ? <span className="live-chat-panel__a-badge">A</span> : null}
                        <strong>{message.who}</strong>
                        {message.isAnswer ? <span className="live-chat-panel__a-to"> → {message.answerToWho}</span> : null}
                        {' '}{message.text}
                      </p>
                    </article>
                  ))
                )}
              </div>

              <form className={`live-chat-panel__composer${isAsking ? ' is-asking' : ''}`} onSubmit={onComposerSubmit}>
                <button
                  type="button"
                  className="live-chat-panel__mode"
                  onClick={() => setChatPanelTab(isAsking ? 'messages' : 'questions')}
                  aria-pressed={isAsking}
                  aria-label={isAsking ? 'Switch to chat' : 'Ask a question'}
                >
                  {isAsking ? (
                    <>
                      <MessageCircle size={13} strokeWidth={2.2} />
                      <span>Chat</span>
                    </>
                  ) : (
                    <>
                      <span className="live-chat-panel__mode-q">?</span>
                      <span>Ask</span>
                    </>
                  )}
                </button>
                <input
                  ref={bindComposerRef}
                  type="text"
                  value={currentDraft}
                  onChange={(event) => currentSetDraft(event.target.value)}
                  placeholder={isAsking ? 'Ask a question…' : 'Write a message…'}
                  aria-label={isAsking ? 'Ask a question' : 'Write a message'}
                />
                <button type="submit" className={currentDraft.trim() ? 'is-active' : ''} disabled={!currentDraft.trim()}>
                  {isAsking ? 'Ask' : 'Send'}
                </button>
              </form>
            </div>
          </section>
        );
      })() : null}

      {answerToast ? (
        <button
          type="button"
          className="live-answer-toast"
          onClick={() => { setChatPanelOpen(true); setAnswerToast(null); }}
          aria-label="Voir la réponse dans le chat"
        >
          <span className="live-answer-toast__badge">A</span>
          <span className="live-answer-toast__body">
            <strong>{answerToast.who} t'a répondu</strong>
            <span>{answerToast.text}</span>
          </span>
        </button>
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
          context={{ liveId: live.id, streamerId: live.creatorUid ?? live.creatorId ?? null, viewerId: user?.uid ?? null }}
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

  // Persist ?relayLocal=1 to sessionStorage so it survives navigation
  // (does not persist RTMPS credentials — those always come fresh from the backend)
  useEffect(() => {
    try {
      const v = searchParams.get('relayLocal');
      if (v) sessionStorage.setItem('vuvio.relayLocal', v);
    } catch (_) {}
  }, [searchParams]);
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
