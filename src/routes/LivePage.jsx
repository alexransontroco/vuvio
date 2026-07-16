import { ChevronUp, MessageCircle, Send, Star, UserPlus, Volume2, VolumeX } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import LiveBadge from '../components/LiveBadge.jsx';
import { lives } from '../data/lives.js';
import { streams } from '../data/mockStreams.js';
import { createLiveSoundscape } from '../services/liveSoundscape.js';

const SWIPE_THRESHOLD = 58;
const WHEEL_THRESHOLD = 36;
const WHEEL_LOCK_MS = 620;

const streamLocations = new Map(streams.map((stream) => [stream.id, stream.map]));

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

function LiveLocationGlobe({ live, onOpen }) {
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
      className="live-location-globe"
      onClick={onOpen}
      aria-label={`Voir ${live.city}, ${live.country} sur le globe`}
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

export default function LivePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const liveId = searchParams.get('live');
  const [index, setIndex] = useState(() => {
    const requestedIndex = lives.findIndex((item) => item.id === liveId);
    return requestedIndex >= 0 ? requestedIndex : 0;
  });
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [liked, setLiked] = useState({});
  const [reactionCounts, setReactionCounts] = useState({});
  const [starBursts, setStarBursts] = useState([]);
  const [starPulse, setStarPulse] = useState(false);
  const [following, setFollowing] = useState({});
  const [soundEnabled, setSoundEnabled] = useState(false);
  const feedRef = useRef(null);
  const pointerStart = useRef(null);
  const wheelLock = useRef(0);
  const soundRef = useRef(null);
  const soundRequestRef = useRef(0);
  const live = lives[index];
  const isLiked = !!liked[live.id];
  const isFollowing = !!following[live.id];

  useEffect(() => {
    const requestedIndex = lives.findIndex((item) => item.id === liveId);
    if (requestedIndex >= 0) {
      setIndex(requestedIndex);
      setDragY(0);
    }
  }, [liveId]);

  const stopSound = () => {
    const current = soundRef.current;
    if (!current) return;

    if (current.kind === 'file') {
      current.audio.pause();
      current.audio.src = '';
      current.audio.load();
    } else {
      current.soundscape.stop();
    }

    soundRef.current = null;
  };

  const startSound = (nextLive) => {
    const requestId = soundRequestRef.current + 1;
    soundRequestRef.current = requestId;
    stopSound();

    if (nextLive.audio) {
      const audio = new Audio(nextLive.audio);
      audio.loop = true;
      audio.volume = 0.82;
      audio.preload = 'auto';
      soundRef.current = { kind: 'file', audio };
      audio.play().catch(() => {
        if (soundRequestRef.current === requestId) {
          setSoundEnabled(false);
          stopSound();
        }
      });
      return;
    }

    const soundscape = createLiveSoundscape(nextLive);
    if (soundRequestRef.current !== requestId) {
      soundscape.stop();
      return;
    }

    soundRef.current = { kind: 'soundscape', soundscape };
  };

  const toggleSound = () => {
    if (soundEnabled) {
      setSoundEnabled(false);
      soundRequestRef.current += 1;
      stopSound();
      return;
    }

    setSoundEnabled(true);
    startSound(live);
  };

  useEffect(() => {
    let cancelled = false;

    if (!soundEnabled) return undefined;

    startSound(live);
    if (cancelled) {
      soundRequestRef.current += 1;
      stopSound();
    }

    return () => {
      cancelled = true;
    };
  }, [live]);

  useEffect(() => {
    return () => {
      stopSound();
    };
  }, []);

  const goTo = (direction) => {
    setIndex((current) => {
      const next = current + direction;
      if (next < 0) return lives.length - 1;
      if (next >= lives.length) return 0;
      return next;
    });
    setDragY(0);
  };

  const onPointerDown = (event) => {
    if (event.target.closest('button, a')) return;
    pointerStart.current = { y: event.clientY };
    setIsDragging(true);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const onPointerMove = (event) => {
    if (!pointerStart.current) return;
    const nextDrag = event.clientY - pointerStart.current.y;
    setDragY(Math.max(-120, Math.min(120, nextDrag)));
  };

  const endPointer = () => {
    if (!pointerStart.current) return;
    if (dragY <= -SWIPE_THRESHOLD) goTo(1);
    else if (dragY >= SWIPE_THRESHOLD) goTo(-1);
    else setDragY(0);
    pointerStart.current = null;
    setIsDragging(false);
  };

  const onWheel = (event) => {
    if (Math.abs(event.deltaY) < WHEEL_THRESHOLD) return;
    const now = Date.now();
    if (now - wheelLock.current < WHEEL_LOCK_MS) return;
    wheelLock.current = now;
    goTo(event.deltaY > 0 ? 1 : -1);
  };

  const reactWithStar = (event) => {
    const bounds = feedRef.current?.getBoundingClientRect();
    const x = bounds ? event.clientX - bounds.left : event.clientX;
    const y = bounds ? event.clientY - bounds.top : event.clientY;
    const id = `${live.id}-${Date.now()}`;

    setLiked((state) => ({ ...state, [live.id]: true }));
    setReactionCounts((state) => ({ ...state, [live.id]: (state[live.id] ?? 0) + 1 }));
    setStarBursts((state) => [...state, { id, x, y }]);
    setStarPulse(true);

    window.setTimeout(() => {
      setStarBursts((state) => state.filter((item) => item.id !== id));
    }, 680);
    window.setTimeout(() => {
      setStarPulse(false);
    }, 220);
  };

  const chat = useMemo(() => live.chat.slice(0, 2), [live]);
  const trackStyle = {
    transform: `translate3d(0, calc(${-index * 100}% + ${dragY}px), 0)`,
  };

  return (
    <section
      ref={feedRef}
      className="screen live-feed"
      aria-label="Live VuVio"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPointer}
      onPointerCancel={endPointer}
      onWheel={onWheel}
    >
      <div className={isDragging ? 'live-feed__track is-dragging' : 'live-feed__track'} style={trackStyle}>
        {lives.map((item) => {
          const isActive = item.id === live.id;

          return (
            <article className="live-slide" key={item.id} aria-hidden={!isActive}>
              {item.kind === 'video' ? (
                <video
                  className="live-slide__media live-slide__media--video"
                  src={isActive ? item.video : undefined}
                  poster={item.image}
                  muted
                  loop
                  playsInline
                  autoPlay={isActive}
                  preload={isActive ? 'auto' : 'metadata'}
                />
              ) : (
                <img className="live-slide__media" src={item.image} alt={`${item.job} POV`} draggable="false" />
              )}
            </article>
          );
        })}
      </div>

      <div className="live-feed__top-gradient" />
      <div className="live-feed__bottom-gradient" />

      <div className="live-feed__status">
        <LiveBadge pulse />
        <span className="live-feed__watching">{live.viewers} watching</span>
      </div>

      <LiveLocationGlobe live={live} onOpen={() => navigate(`/map?live=${live.id}`)} />

      <div className="live-chat" aria-label="Chat live">
        {chat.map((message) => (
          <p key={`${live.id}-${message.who}`}>
            <strong>{message.who}</strong> {message.text}
          </p>
        ))}
      </div>

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

      <div className="live-feed__details">
        <div className="live-feed__copy">
          <h1>{live.streamer}</h1>
          <p>
            {live.job} - {live.city}, {live.country}
          </p>
          <span>{live.description}</span>
        </div>

        <div className="live-actions" aria-label="Actions live">
          <button
            type="button"
            className={isFollowing ? 'is-active' : ''}
            onClick={() => setFollowing((state) => ({ ...state, [live.id]: !state[live.id] }))}
            aria-label={isFollowing ? 'Ne plus suivre' : 'Suivre ce streamer'}
          >
            <UserPlus size={21} strokeWidth={1.8} />
          </button>
          <button
            type="button"
            className={`${isLiked ? 'is-liked' : ''}${starPulse ? ' is-pulsing' : ''}`}
            onClick={reactWithStar}
            aria-label="Envoyer une étoile"
          >
            <Star size={22} strokeWidth={1.8} fill={isLiked ? 'currentColor' : 'none'} />
          </button>
          <button type="button" aria-label="Commenter">
            <MessageCircle size={22} strokeWidth={1.8} />
          </button>
          <button type="button" aria-label="Partager">
            <Send size={21} strokeWidth={1.8} />
          </button>
          <button
            type="button"
            className={soundEnabled ? 'is-active' : ''}
            onClick={toggleSound}
            aria-label={soundEnabled ? 'Couper le son POV' : 'Activer le son POV'}
          >
            {soundEnabled ? <Volume2 size={22} strokeWidth={1.8} /> : <VolumeX size={22} strokeWidth={1.8} />}
          </button>
        </div>
      </div>

      <button type="button" className="next-live" onClick={() => goTo(1)} aria-label="Live suivant">
        <ChevronUp size={18} strokeWidth={2} aria-hidden="true" />
      </button>
    </section>
  );
}
