import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { Heart, MessageCircle, Gift, Share2, Backpack, MapPin, MousePointer2, UserRoundPlus, Star, Send, VolumeX } from 'lucide-react';
import { BIKING_LIVE, CHEF_LIVE, FIREFIGHTER_LIVE } from '../introLives.js';
import WatchMiniGlobe from '../../../WatchMiniGlobe.jsx';
import IntroBottomNav from './IntroBottomNav.jsx';

const EASE = [0.22, 1, 0.36, 1];

const CHEF_CHAT = [
  { delay:  800, initial: 'S', color: '#31BFD9', name: 'Sophie', text: 'The pace is insane 🔥' },
  { delay: 1900, initial: 'M', color: '#ff9d4d', name: 'Marco', text: 'Friday dinner rush energy' },
  { delay: 3100, initial: 'L', color: '#8b5cf6', name: 'Lisa', text: 'Chef life is real 🍽️' },
];
const FIREFIGHTER_CHAT = [
  { delay:  800, initial: 'T', color: '#31BFD9', name: 'Tyler', text: 'The heat in there must be insane' },
  { delay: 1900, initial: 'M', color: '#ff9d4d', name: 'Maria', text: 'Respect for these guys 🙏' },
  { delay: 3100, initial: 'J', color: '#8b5cf6', name: 'Josh', text: 'The comms in the background 🔥' },
];
const OTHER_CHAT = [
  { delay: 800, initial: 'S', color: '#31BFD9', name: 'Sam', text: 'What a view!' },
  { delay: 1900, initial: 'A', color: '#ff9d4d', name: 'Alex', text: 'This POV is incredible' },
  { delay: 3100, initial: 'L', color: '#8b5cf6', name: 'Lena', text: 'Where are you right now?' },
];
const CHEF_GLOBE_STREAM = { coordinates: [CHEF_LIVE.lng, CHEF_LIVE.lat], city: 'Wolverhampton' };

// LiveLayer is visible during live AND equipment (so Live stays behind the sheet)
export default function LiveLayer({ phase, reducedMotion, selectedLive, autoOpenGlobe, onOpenGlobe, autoCreate, onCreatePress, onCreate }) {
  const visible = phase === 'live' || phase === 'equipment' || phase === 'returnlive' || phase === 'globelive' || phase === 'startlive';
  const chatVisible = phase === 'live' || phase === 'returnlive' || phase === 'globelive';
  const activeLive = phase === 'startlive' ? BIKING_LIVE : phase === 'globelive' ? selectedLive ?? FIREFIGHTER_LIVE : CHEF_LIVE;
  const chatScript = activeLive.id === 'firefighter' ? FIREFIGHTER_CHAT : activeLive.id === 'chef' ? CHEF_CHAT : OTHER_CHAT;
  const globeStream = useMemo(() => ({ coordinates: [activeLive.lng, activeLive.lat], city: activeLive.label }), [activeLive]);

  const [chatCount, setChatCount] = useState(0);
  const [globePressed, setGlobePressed] = useState(false);
  const [createPressed, setCreatePressed] = useState(false);
  const [showCreateCue, setShowCreateCue] = useState(false);
  useEffect(() => {
    if (!chatVisible) { setChatCount(0); return; }
    const timers = chatScript.map((m, i) => setTimeout(() => setChatCount(i + 1), reducedMotion ? 300 * (i + 1) : m.delay));
    return () => timers.forEach(clearTimeout);
  }, [chatVisible, reducedMotion, chatScript]);

  useEffect(() => {
    if (phase !== 'returnlive') {
      setGlobePressed(false);
      return undefined;
    }
    if (!autoOpenGlobe || globePressed) return undefined;
    const timer = setTimeout(() => setGlobePressed(true), reducedMotion ? 700 : 3200);
    return () => clearTimeout(timer);
  }, [phase, autoOpenGlobe, globePressed, reducedMotion]);

  useEffect(() => {
    if (phase !== 'returnlive' || !globePressed) return undefined;
    const timer = setTimeout(onOpenGlobe, reducedMotion ? 100 : 300);
    return () => clearTimeout(timer);
  }, [phase, globePressed, onOpenGlobe, reducedMotion]);

  useEffect(() => {
    if (phase !== 'globelive') {
      setCreatePressed(false);
      setShowCreateCue(false);
      return undefined;
    }
    if (!autoCreate) return undefined;
    const cueTimer = setTimeout(() => setShowCreateCue(true), reducedMotion ? 400 : 5200);
    return () => clearTimeout(cueTimer);
  }, [phase, autoCreate, reducedMotion]);

  useEffect(() => {
    if (phase !== 'globelive') return undefined;
    if (!autoCreate || createPressed) return undefined;
    const timer = setTimeout(() => {
      setCreatePressed(true);
      onCreatePress();
    }, reducedMotion ? 600 : 7300);
    return () => clearTimeout(timer);
  }, [phase, autoCreate, createPressed, onCreatePress, reducedMotion]);

  useEffect(() => {
    if (phase !== 'globelive' || !createPressed) return undefined;
    const timer = setTimeout(onCreate, reducedMotion ? 100 : 520);
    return () => clearTimeout(timer);
  }, [phase, createPressed, onCreate, reducedMotion]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className={'introv2-live' + (phase === 'equipment' ? ' introv2-live--dim' : '') + (phase === 'returnlive' ? ' introv2-live--return' : '')}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reducedMotion ? 0.25 : 0.5, ease: EASE }}
        >
          {/* Top bar: creator chip */}
          <motion.div
            className="introv2-live__creator"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.55, ease: EASE, delay: 0.15 }}
          >
            <div className="introv2-live__avatar">{activeLive.name[0]}</div>
            <div className="introv2-live__creator-meta">
              <div className="introv2-live__creator-name">{activeLive.name}</div>
              <div className="introv2-live__creator-sub">
                <span className="introv2-live__live-dot" />
                LIVE · {activeLive.viewers}
              </div>
            </div>
            <button type="button" className="introv2-live__follow">Follow</button>
          </motion.div>

          {/* Location pill */}
          <motion.div
            className="introv2-live__location"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: EASE, delay: 0.3 }}
          >
            <MapPin size={11} strokeWidth={2} />
            {activeLive.location}
          </motion.div>

          {phase === 'returnlive' && (
            <motion.span
              className="introv2-live__globe-hint"
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: reducedMotion ? 0 : 1.3, duration: 0.35, ease: EASE }}
              aria-hidden="true"
            >View on globe</motion.span>
          )}
          {phase === 'returnlive' && (
            <motion.button
              type="button"
              className={'introv2-live__mini-globe' + (globePressed ? ' is-pressed' : '')}
              onClick={() => setGlobePressed(true)}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: globePressed ? 0.86 : 1 }}
              transition={{ duration: globePressed ? 0.15 : reducedMotion ? 0.2 : 0.45, ease: EASE }}
              aria-label="Open this live on the globe"
            >
              <span className="introv2-live__mini-dir introv2-live__mini-dir--n">N</span>
              <span className="introv2-live__mini-dir introv2-live__mini-dir--e">E</span>
              <span className="introv2-live__mini-dir introv2-live__mini-dir--s">S</span>
              <span className="introv2-live__mini-dir introv2-live__mini-dir--w">W</span>
              <WatchMiniGlobe currentStream={CHEF_GLOBE_STREAM} />
              {autoOpenGlobe && !reducedMotion && (
                <motion.span
                  className="introv2-live__mini-cursor"
                  initial={{ opacity: 0, x: 18, y: 18, scale: 1 }}
                  animate={{ opacity: [0, 1, 1, 1], x: [18, 18, 0, 0], y: [18, 18, 0, 0], scale: [1, 1, 1, 0.72] }}
                  transition={{ delay: 2.05, duration: 1.1, times: [0, 0.2, 0.8, 1], ease: EASE }}
                ><MousePointer2 size={23} fill="white" strokeWidth={1.5} /></motion.span>
              )}
            </motion.button>
          )}

          {/* Chat bubbles */}
          <div className="introv2-live__chat" aria-hidden="true">
            {chatScript.slice(0, chatCount).map((m, i) => (
              <motion.div
                key={i}
                className="introv2-live__bubble"
                initial={{ opacity: 0, x: -14, scale: 0.94 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                transition={{ type: 'spring', damping: 24, stiffness: 240 }}
              >
                <span className="introv2-live__bubble-initial" style={{ background: m.color }}>{m.initial}</span>
                <span className="introv2-live__bubble-text">
                  <strong>{m.name}</strong> {m.text}
                </span>
              </motion.div>
            ))}
          </div>

          {/* Action rail */}
          {phase === 'globelive' ? (
            <motion.div
              className="introv2-live__fire-actions"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: reducedMotion ? 0.2 : 0.5, ease: EASE }}
              aria-hidden="true"
            >
              <div className="introv2-live__fire-globe"><span>N</span><WatchMiniGlobe currentStream={globeStream} /></div>
              {[UserRoundPlus, Star, MessageCircle, Send, VolumeX].map((Icon, index) => (
                <div className="introv2-live__fire-action" key={index}><Icon size={21} strokeWidth={1.8} /></div>
              ))}
              <div className="introv2-live__fire-action introv2-live__fire-action--gear"><Backpack size={21} strokeWidth={1.8} /></div>
            </motion.div>
          ) : <motion.div
            className="introv2-live__actions"
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.55, ease: EASE, delay: 0.3 }}
          >
            {[Heart, MessageCircle, Gift, Share2].map((Icon, i) => (
              <div key={i} className="introv2-live__action">
                <Icon size={18} strokeWidth={2} />
              </div>
            ))}
            <div className="introv2-live__action introv2-live__gear-slot" aria-hidden="true" />
          </motion.div>}

          {/* Composer */}
          <motion.div
            className="introv2-live__composer"
            initial={{ opacity: 0, y: 12 }}
            animate={phase === 'globelive' && showCreateCue ? { opacity: 0, y: 8 } : { opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.55, ease: EASE, delay: 0.35 }}
          >
            Ask a question…
          </motion.div>
          {phase === 'globelive' && showCreateCue && (
            <motion.div
              className="introv2-live__create-hint"
              initial={{ opacity: 0, x: '-50%', y: 8 }}
              animate={{ opacity: 1, x: '-50%', y: 0 }}
              transition={{ duration: reducedMotion ? 0.2 : 0.35, ease: EASE }}
              aria-hidden="true"
            >
              Start a live <span>↓</span>
            </motion.div>
          )}
          {phase === 'globelive' && (
            <IntroBottomNav
              onCreate={() => { setCreatePressed(true); onCreatePress(); }}
              createPressed={createPressed}
              cursor={autoCreate && !reducedMotion && !createPressed && (
                  <motion.span className="introv2-live__create-cursor" initial={{ opacity: 0, x: 40, y: -32 }} animate={{ opacity: [0, 1, 1, 1], x: [40, 40, 0, 0], y: [-32, -32, 0, 0], scale: [1, 1, 1, 0.72] }} transition={{ delay: 6.35, duration: 0.9, times: [0, 0.15, 0.82, 1], ease: EASE }} aria-hidden="true"><MousePointer2 size={25} fill="white" strokeWidth={1.5} /></motion.span>
              )}
            />
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
