import { Eye, Heart, MapPin, MessageCircle, Plus, Send, SlidersHorizontal, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import CreatorLink from '../components/CreatorLink.jsx';
import LiveBadge from '../components/LiveBadge.jsx';
import SegmentedControl from '../components/SegmentedControl.jsx';
import WatchMiniGlobe from '../components/WatchMiniGlobe.jsx';
import { streams } from '../data/mockStreams.js';

const discoverModes = [
  { labelKey: 'explore.modes.forYou', value: 'for-you' },
  { labelKey: 'explore.modes.random', value: 'random' },
];

const discoverFilters = [
  'explore.filtersList.cityTours',
  'explore.filtersList.air',
  'explore.filtersList.land',
  'explore.filtersList.water',
  'explore.filtersList.urban',
  'explore.filtersList.live',
  'explore.filtersList.replays',
];

const swipeHintStorageKey = 'vuvio-discover-swipe-hint-seen';
const swipeThreshold = 48;
const wheelThreshold = 80;
const swipeLockMs = 520;
const devOnlyVideo = (src) => (import.meta.env.DEV ? src : null);

const highResolutionDiscoverMedia = {
  air: {
    src: devOnlyVideo('/assets/videos/20667540-uhd_2160_3840_60fps.mp4'),
    poster: '/assets/videos/20667540-uhd_2160_3840_60fps-cover.jpg',
  },
  sky: {
    src: devOnlyVideo('/assets/videos/20667540-uhd_2160_3840_60fps.mp4'),
    poster: '/assets/videos/20667540-uhd_2160_3840_60fps-cover.jpg',
  },
  earth: {
    src: devOnlyVideo('/assets/videos/16232606_2160_3840_30fps.mp4'),
    poster: '/assets/videos/16232606_2160_3840_30fps-cover.jpg',
  },
  nature: {
    src: devOnlyVideo('/assets/videos/16232606_2160_3840_30fps.mp4'),
    poster: '/assets/videos/16232606_2160_3840_30fps-cover.jpg',
  },
  sport: {
    src: devOnlyVideo('/assets/videos/16232606_2160_3840_30fps.mp4'),
    poster: '/assets/videos/16232606_2160_3840_30fps-cover.jpg',
  },
  travel: {
    src: devOnlyVideo('/assets/videos/16232606_2160_3840_30fps.mp4'),
    poster: '/assets/videos/16232606_2160_3840_30fps-cover.jpg',
  },
  water: {
    src: devOnlyVideo('/assets/videos/16352747_1080_1920_30fps.mp4'),
    poster: '/assets/videos/16352747_1080_1920_30fps-cover.jpg',
  },
  fallback: {
    src: devOnlyVideo('/assets/videos/8678453-hd_1080_1920_30fps.mp4'),
    poster: '/assets/videos/8678453-hd_1080_1920_30fps-cover.jpg',
  },
};

function viewerCount(value) {
  return Number.parseInt(String(value ?? '').replace(/\D/g, ''), 10) || 0;
}

function formatViewers(value, language = 'en') {
  const count = viewerCount(value);
  if (count >= 1000) return `${(count / 1000).toLocaleString(language, { maximumFractionDigits: 1 })} k`;
  return count.toLocaleString(language);
}

function discoverMediaFor(stream) {
  if (stream?.playbackUrl || stream?.videoUrl || stream?.mediaUrl) {
    return {
      src: stream.playbackUrl ?? stream.videoUrl ?? stream.mediaUrl,
      poster: stream.thumbnailUrl ?? stream.image ?? null,
    };
  }

  if (stream?.video) {
    return { src: devOnlyVideo(stream.video), poster: stream.image ?? null };
  }

  if (stream?.image) {
    return { src: null, poster: stream.image };
  }

  const environment = stream?.environment ?? stream?.family;
  const fallbackMedia = highResolutionDiscoverMedia[environment]
    ?? highResolutionDiscoverMedia[String(stream?.category ?? '').toLowerCase()]
    ?? highResolutionDiscoverMedia.fallback;

  return {
    ...fallbackMedia,
    poster: fallbackMedia.poster ?? stream?.thumbnailUrl ?? stream?.image ?? null,
  };
}

function weightedDiscoverStreams(mode) {
  if (mode === 'random') {
    return [...streams]
      .map((stream, index) => ({ stream, score: ((index * 37) % 11) + viewerCount(stream.viewerLabel) / 1000 }))
      .sort((a, b) => b.score - a.score)
      .map((item) => item.stream);
  }

  return [...streams].sort((a, b) => viewerCount(b.viewerLabel) - viewerCount(a.viewerLabel));
}

export default function DiscoverFeedPage() {
  const { t, i18n } = useTranslation();
  const [searchParams] = useSearchParams();
  const requestedLiveId = searchParams.get('live');
  const [mode, setMode] = useState('for-you');
  const [index, setIndex] = useState(0);
  const [liked, setLiked] = useState({});
  const [following, setFollowing] = useState({});
  const [followStatus, setFollowStatus] = useState({});
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [swipeAnimation, setSwipeAnimation] = useState('');
  const [seenHint, setSeenHint] = useState(() => {
    try {
      return window.localStorage.getItem(swipeHintStorageKey) === 'true';
    } catch {
      return false;
    }
  });
  const pointerStart = useRef(null);
  const touchStart = useRef(null);
  const wheelDelta = useRef(0);
  const swipeLock = useRef(0);
  const swipeAnimationTimer = useRef(null);
  const screenRef = useRef(null);
  const swipeProgressRef = useRef(0);
  const isDraggingRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);
  const [swipeDir, setSwipeDir] = useState(1);

  const feed = useMemo(() => weightedDiscoverStreams(mode), [mode]);
  const current = feed[index] ?? feed[0] ?? null;
  const nextIndex = (index + 1) % (feed.length || 1);
  const prevIndex = (index - 1 + (feed.length || 1)) % (feed.length || 1);
  const globeAdjacentStream = swipeDir > 0 ? feed[nextIndex] : feed[prevIndex];

  useEffect(() => {
    if (!requestedLiveId || !feed.length) return;
    const requestedIndex = feed.findIndex((stream) => stream.id === requestedLiveId);
    if (requestedIndex >= 0) setIndex(requestedIndex);
  }, [feed, requestedLiveId]);

  const goTo = (direction) => {
    if (!feed.length) return;
    dismissHint();
    setCommentsOpen(false);
    setIndex((currentIndex) => {
      const next = currentIndex + direction;
      if (next < 0) return feed.length - 1;
      if (next >= feed.length) return 0;
      return next;
    });
  };

  const tryGoTo = (direction) => {
    const now = Date.now();
    if (commentsOpen || now < swipeLock.current) return;
    swipeLock.current = now + swipeLockMs;
    window.clearTimeout(swipeAnimationTimer.current);
    setSwipeAnimation(direction > 0 ? 'next' : 'prev');
    swipeAnimationTimer.current = window.setTimeout(() => setSwipeAnimation(''), 360);
    goTo(direction);
  };

  const dismissHint = () => {
    setSeenHint(true);
    try {
      window.localStorage.setItem(swipeHintStorageKey, 'true');
    } catch {}
  };

  useEffect(() => {
    if (seenHint) return undefined;
    const timer = window.setTimeout(dismissHint, 3000);
    return () => window.clearTimeout(timer);
  }, [seenHint]);

  useEffect(() => {
    return () => window.clearTimeout(swipeAnimationTimer.current);
  }, []);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (commentsOpen) return;
      if (event.key === 'ArrowDown' || event.key === 'PageDown' || event.key === ' ') {
        event.preventDefault();
        tryGoTo(1);
      }
      if (event.key === 'ArrowUp' || event.key === 'PageUp') {
        event.preventDefault();
        tryGoTo(-1);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [commentsOpen, feed.length]);

  const shouldIgnoreSwipeTarget = (target) => Boolean(target?.closest?.(
    '.discover-topbar, .discover-filter-row, .discover-bottom-bar, .discover-creator-row, .discover-comments, a, input, textarea, select'
  ));

  const resetDrag = () => {
    swipeProgressRef.current = 0;
    isDraggingRef.current = false;
    setIsDragging(false);
  };

  const onPointerDown = (event) => {
    if (event.pointerType === 'touch') return;
    if (shouldIgnoreSwipeTarget(event.target)) return;
    pointerStart.current = { x: event.clientX, y: event.clientY, pointerId: event.pointerId };
  };

  const onPointerMove = (event) => {
    if (event.pointerType === 'touch') return;
    if (!pointerStart.current) return;
    const deltaY = event.clientY - pointerStart.current.y;
    const deltaX = event.clientX - pointerStart.current.x;
    if (Math.abs(deltaX) > Math.abs(deltaY) * 1.5) return;
    const progress = Math.max(-1, Math.min(1, -deltaY / (window.innerHeight * 0.38)));
    swipeProgressRef.current = progress;
    if (!isDraggingRef.current && Math.abs(progress) > 0.09) {
      isDraggingRef.current = true;
      setIsDragging(true);
      setSwipeDir(progress > 0 ? 1 : -1);
    }
  };

  const onPointerUp = (event) => {
    if (event.pointerType === 'touch') return;
    if (!pointerStart.current) return;
    const deltaY = event.clientY - pointerStart.current.y;
    const deltaX = event.clientX - pointerStart.current.x;
    pointerStart.current = null;
    resetDrag();
    if (Math.abs(deltaY) < swipeThreshold || Math.abs(deltaY) < Math.abs(deltaX) * 1.2) return;
    tryGoTo(deltaY < 0 ? 1 : -1);
  };

  const onPointerCancel = () => {
    pointerStart.current = null;
    resetDrag();
  };

  const onTouchStart = (event) => {
    if (shouldIgnoreSwipeTarget(event.target)) return;
    const touch = event.touches[0];
    if (!touch) return;
    touchStart.current = { x: touch.clientX, y: touch.clientY };
  };

  const onTouchMove = (event) => {
    if (!touchStart.current || commentsOpen) return;
    const touch = event.touches[0];
    if (!touch) return;
    const deltaY = touch.clientY - touchStart.current.y;
    const deltaX = touch.clientX - touchStart.current.x;
    if (Math.abs(deltaX) > Math.abs(deltaY) * 1.5) return;
    const progress = Math.max(-1, Math.min(1, -deltaY / (window.innerHeight * 0.38)));
    swipeProgressRef.current = progress;
    if (!isDraggingRef.current && Math.abs(progress) > 0.09) {
      isDraggingRef.current = true;
      setIsDragging(true);
      setSwipeDir(progress > 0 ? 1 : -1);
    }
  };

  const onTouchEnd = (event) => {
    if (!touchStart.current) return;
    const touch = event.changedTouches[0];
    if (!touch) return;
    const deltaY = touch.clientY - touchStart.current.y;
    const deltaX = touch.clientX - touchStart.current.x;
    touchStart.current = null;
    resetDrag();
    if (Math.abs(deltaY) < swipeThreshold || Math.abs(deltaY) < Math.abs(deltaX) * 1.2) return;
    tryGoTo(deltaY < 0 ? 1 : -1);
  };

  const onWheel = (event) => {
    if (shouldIgnoreSwipeTarget(event.target)) return;
    if (commentsOpen || Math.abs(event.deltaY) < 4) return;
    wheelDelta.current += event.deltaY;
    if (Math.abs(wheelDelta.current) < wheelThreshold) return;
    tryGoTo(wheelDelta.current > 0 ? 1 : -1);
    wheelDelta.current = 0;
  };

  if (!current) {
    return (
      <section className="screen discover-screen discover-screen--empty">
        <p>{t('explore.empty')}</p>
      </section>
    );
  }

  const title = current.note ?? current.role ?? t('explore.liveTitleFallback');
  const creator = { ...current, status: 'live' };
  const isFollowing = Boolean(following[current.name]);
  const isFollowLoading = followStatus[current.name] === 'loading';
  const isLiked = Boolean(liked[current.id]);
  const media = discoverMediaFor(current);
  const locationLabel = [current.city, current.country].filter(Boolean).join(', ');
  const likeCount = formatViewers(Math.round(viewerCount(current.viewerLabel) * 3.1 + 420), i18n.language);

  const toggleFollow = () => {
    setFollowStatus((state) => ({ ...state, [current.name]: 'loading' }));
    window.setTimeout(() => {
      setFollowing((state) => ({ ...state, [current.name]: !state[current.name] }));
      setFollowStatus((state) => ({ ...state, [current.name]: 'idle' }));
    }, 220);
  };

  const travelCity = globeAdjacentStream?.city;
  const showTravelLabel = isDragging && Boolean(travelCity);

  return (
    <section
      ref={screenRef}
      className={`screen discover-screen${swipeAnimation ? ` is-swipe-${swipeAnimation}` : ''}`}
      aria-label={t('explore.aria')}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onWheel={onWheel}
    >
      {media.src ? (
        <video
          key={media.src}
          className="discover-media"
          poster={media.poster}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          aria-label={t('explore.preview', { title })}
        >
          <source src={media.src} type="video/mp4" />
        </video>
      ) : (
        <img
          key={media.poster}
          className="discover-media"
          src={media.poster}
          alt={title}
          loading="eager"
          decoding="async"
        />
      )}
      <span className="discover-shade" />

      <div className="watch-globe-wrap" aria-hidden="true">
        <WatchMiniGlobe
          currentStream={current}
          nextStream={isDragging ? globeAdjacentStream : null}
          swipeProgressRef={swipeProgressRef}
        />
        {showTravelLabel ? (
          <div className="watch-travel-label">
            {swipeDir > 0 ? 'Next' : 'Back'} · {travelCity}
          </div>
        ) : null}
      </div>

      <header className="discover-topbar">
        <SegmentedControl items={discoverModes.map((item) => ({ ...item, label: t(item.labelKey) }))} value={mode} onChange={(next) => {
          setMode(next);
          setIndex(0);
        }} className="discover-mode-control" />
        <button type="button" onClick={() => setFiltersOpen((value) => !value)} aria-label={t('explore.filters')}>
          <SlidersHorizontal size={18} strokeWidth={1.9} />
        </button>
      </header>

      {filtersOpen ? (
        <div className="discover-filter-row" role="group" aria-label={t('explore.filterGroup')}>
          {discoverFilters.map((filter) => (
            <button key={filter} type="button">{t(filter)}</button>
          ))}
        </div>
      ) : null}

      <div className="discover-top-meta">
        <div className="discover-top-meta__left">
          <LiveBadge compact />
          <span className="discover-viewer-count">
            <Eye size={11} strokeWidth={1.8} />
            {formatViewers(current.viewerLabel, i18n.language)}
          </span>
        </div>
        {locationLabel ? (
          <span className="discover-location">
            <MapPin size={12} strokeWidth={1.8} />
            <span>{locationLabel}</span>
          </span>
        ) : null}
      </div>

      {current.isCityTour && current.currentLocation ? (
        <div key={`pin-${current.id}`} className="discover-city-pin">
          <MapPin size={11} strokeWidth={1.8} />
          Currently {current.currentLocation}
        </div>
      ) : null}

      <div className="discover-copy" key={current.id}>
        <div className="discover-creator-row">
          <CreatorLink creator={creator} stopPropagation />
        </div>
        <button type="button" className="discover-title" aria-label={title}>
          {title}
        </button>
      </div>

      <div className="discover-bottom-bar">
        <button
          type="button"
          className={`discover-bar-btn${isLiked ? ' is-active' : ''}`}
          onClick={() => setLiked((state) => ({ ...state, [current.id]: !state[current.id] }))}
          aria-label={isLiked ? t('explore.favoriteRemove') : t('explore.favoriteAdd')}
        >
          <Heart size={21} strokeWidth={1.75} fill={isLiked ? 'currentColor' : 'none'} />
          <span>{likeCount}</span>
        </button>
        <button type="button" className="discover-bar-btn" onClick={() => setCommentsOpen(true)} aria-label={t('explore.openComments')}>
          <MessageCircle size={21} strokeWidth={1.75} />
          <span>{current.chat?.length ?? 0}</span>
        </button>
        <button type="button" className="discover-bar-btn" aria-label={t('explore.sharePov')}>
          <Send size={20} strokeWidth={1.75} />
        </button>
        <button
          type="button"
          className={`discover-bar-btn discover-bar-btn--plus${isFollowing ? ' is-following' : ''}`}
          disabled={isFollowLoading}
          onClick={toggleFollow}
          aria-label={isFollowing ? t('common.following') : t('common.follow')}
        >
          <Plus size={22} strokeWidth={2.2} />
        </button>
      </div>

      {!seenHint ? <p className="discover-swipe-hint">{t('explore.swipeHint')}</p> : null}

      {commentsOpen ? (
        <section className="discover-comments" role="dialog" aria-modal="true" aria-label={t('explore.commentsFor', { title })}>
          <button
            type="button"
            className="discover-comments__backdrop"
            onClick={() => setCommentsOpen(false)}
            aria-label={t('explore.closeComments')}
          />
          <div className="discover-comments__panel">
            <header>
              <strong>{t('common.comments')}</strong>
              <button type="button" onClick={() => setCommentsOpen(false)} aria-label={t('common.close')}>
                <X size={18} strokeWidth={1.9} />
              </button>
            </header>
            <div className="discover-comments__list">
              {(current.chat?.length ? current.chat : [{ who: 'Vuvio', text: t('explore.noComments') }]).map((message, messageIndex) => (
                <p key={`${message.who}-${messageIndex}`}>
                  <strong>{message.who}</strong>
                  {message.text}
                </p>
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </section>
  );
}
