import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Bell, Search, Users } from 'lucide-react';
import IntroVideo from '../IntroVideo.jsx';

const EASE = [0.22, 1, 0.36, 1];
const SPRING = { type: 'spring', damping: 24, stiffness: 180 };

export default function SceneWatch({ reducedMotion }) {
  const ease = reducedMotion ? 'linear' : EASE;

  return (
    <section className="intro-watch" aria-label="Watch tour">
      {/* Header: title + icons */}
      <motion.header
        className="intro-fakeheader"
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease }}
      >
        <div className="intro-fakeheader__title">Watch</div>
        <div className="intro-fakeheader__actions">
          <motion.span
            className="intro-fakeheader__icon"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.25, ...SPRING }}
          >
            <Search size={16} strokeWidth={1.8} />
          </motion.span>
          <motion.span
            className="intro-fakeheader__icon"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.35, ...SPRING }}
          >
            <Bell size={16} strokeWidth={1.8} />
          </motion.span>
        </div>
      </motion.header>

      {/* Tabs */}
      <motion.div
        className="intro-tabs"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.5, ease }}
      >
        <span className="intro-tab intro-tab--active">For you</span>
        <span className="intro-tab">Nearby</span>
        <span className="intro-tab">Following</span>
        <span className="intro-tab">Upcoming</span>
      </motion.div>

      {/* Featured live card (with spotlight + zoom-in finish) */}
      <div className="intro-feed">
        <motion.div
          className="intro-livecard"
          initial={{ opacity: 0, y: 30 }}
          animate={{
            opacity: 1,
            y: 0,
            scale: reducedMotion ? 1 : [1, 1, 1.08, 1.18],
          }}
          transition={{
            opacity: { delay: 0.25, duration: 0.6, ease },
            y:       { delay: 0.25, duration: 0.6, ease },
            scale:   { duration: 5.8, times: [0, 0.55, 0.85, 1], ease },
          }}
        >
          <IntroVideo
            src="/intro/povs-montage.mp4"
            poster="/intro/povs-poster.jpg"
            className="intro-livecard__video"
            loop
            playbackRate={0.85}
          />
          <div className="intro-livecard__gradient" />

          <motion.div
            className="intro-livecard__badge"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.75, ...SPRING }}
          >
            <span className="intro-livecard__badge-dot" />
            Live
          </motion.div>

          <motion.div
            className="intro-livecard__viewers"
            initial={{ opacity: 0, scale: 0.6, x: 10 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            transition={{ delay: 0.9, ...SPRING }}
          >
            <Users size={11} strokeWidth={2} />
            <CountUp from={0} to={2847} duration={reducedMotion ? 0 : 1800} delay={1100} />
          </motion.div>

          <div className="intro-livecard__body">
            <motion.h3
              className="intro-livecard__title"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.0, duration: 0.5, ease }}
            >
              Friday service — behind the pass
            </motion.h3>
            <motion.div
              className="intro-livecard__meta"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.15, duration: 0.5, ease }}
            >
              <span className="intro-livecard__avatar">M</span>
              <span>@moodyroosterwlv · Paris</span>
            </motion.div>
          </div>

          {/* Spotlight ring pulses after the card settles */}
          {!reducedMotion && (
            <motion.div
              className="intro-livecard__spotlight"
              initial={{ opacity: 0, scale: 1.05 }}
              animate={{ opacity: [0, 0.9, 0.3], scale: [1.05, 1, 1] }}
              transition={{ delay: 1.6, duration: 1.6, ease }}
            />
          )}
        </motion.div>
      </div>
    </section>
  );
}

function CountUp({ from = 0, to = 100, duration = 1500, delay = 0 }) {
  const [v] = useCountUp(from, to, duration, delay);
  return <span>{v.toLocaleString()}</span>;
}

function useCountUp(from, to, duration, delay) {
  const [v, setV] = useState(from);
  useEffect(() => {
    if (duration <= 0) { setV(to); return undefined; }
    let raf;
    let start;
    const timer = setTimeout(() => {
      const step = (ts) => {
        if (!start) start = ts;
        const t = Math.min(1, (ts - start) / duration);
        // easeOutCubic
        const eased = 1 - Math.pow(1 - t, 3);
        setV(Math.round(from + (to - from) * eased));
        if (t < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }, delay);
    return () => {
      clearTimeout(timer);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [from, to, duration, delay]);
  return [v, setV];
}
