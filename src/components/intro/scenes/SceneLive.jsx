import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Gift, Heart, MessageCircle, Share2, Users } from 'lucide-react';
import IntroVideo from '../IntroVideo.jsx';

const EASE = [0.22, 1, 0.36, 1];

const CHAT_SCRIPT = [
  { delay:  900, initial: 'A', color: '#31BFD9', name: 'Alex', text: 'Incredible flames 🔥' },
  { delay: 2100, initial: 'M', color: '#ff9d4d', name: 'Mila',  text: 'What pan is that?' },
  { delay: 3400, initial: 'J', color: '#8b5cf6', name: 'Juno',  text: 'Service looks intense' },
  { delay: 4700, initial: 'K', color: '#10b981', name: 'Kai',   text: 'Watching from Tokyo 🌍' },
];

export default function SceneLive({ reducedMotion }) {
  const [messages, setMessages] = useState([]);
  const [likes, setLikes] = useState(1247);

  useEffect(() => {
    const timers = CHAT_SCRIPT.map((msg, i) =>
      setTimeout(() => {
        setMessages((prev) => [...prev, { ...msg, id: i }]);
      }, msg.delay),
    );
    const likeBoost = setInterval(() => setLikes((l) => l + Math.floor(Math.random() * 4) + 1), 650);
    return () => {
      timers.forEach(clearTimeout);
      clearInterval(likeBoost);
    };
  }, []);

  return (
    <section className="intro-live" aria-label="Live viewer">
      {/* Full-bleed video */}
      <IntroVideo
        src="/intro/povs-montage.mp4"
        poster="/intro/povs-poster.jpg"
        className="intro-live__video"
        loop
      />
      <div className="intro-live__gradient" />

      {/* Top bar — creator pill + live + viewers */}
      <motion.div
        className="intro-live__top"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE }}
      >
        <div className="intro-live__creator">
          <div className="intro-live__creator-avatar">M</div>
          <div className="intro-live__creator-name">@moodyroosterwlv</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <motion.div
            className="intro-live__pill intro-live__pill--live"
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, type: 'spring', damping: 18, stiffness: 240 }}
          >
            LIVE
          </motion.div>
          <motion.div
            className="intro-live__pill"
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.3, type: 'spring', damping: 18, stiffness: 240 }}
          >
            <Users size={11} strokeWidth={2} />
            2,847
          </motion.div>
        </div>
      </motion.div>

      {/* Chat bubbles */}
      <div className="intro-live__chat">
        <AnimatePresence>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              className="intro-chat-bubble"
              initial={{ opacity: 0, x: -24, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ type: 'spring', damping: 22, stiffness: 240 }}
            >
              <div className="intro-chat-bubble__avatar" style={{ background: msg.color }}>
                {msg.initial}
              </div>
              <div className="intro-chat-bubble__body">
                <strong>{msg.name}</strong>
                {msg.text}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Right action rail */}
      <motion.div
        className="intro-live__actions"
        initial={{ opacity: 0, x: 24 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.4, duration: 0.55, ease: EASE }}
      >
        <div className="intro-live__action">
          <motion.div
            className="intro-live__action-icon"
            animate={!reducedMotion ? { scale: [1, 1.18, 1] } : {}}
            transition={{ duration: 0.8, repeat: Infinity, repeatDelay: 1.2 }}
            style={{ color: '#ff4d6a' }}
          >
            <Heart size={20} strokeWidth={1.8} fill="currentColor" />
          </motion.div>
          <span>{likes.toLocaleString()}</span>
        </div>
        <div className="intro-live__action">
          <div className="intro-live__action-icon">
            <MessageCircle size={20} strokeWidth={1.8} />
          </div>
          <span>142</span>
        </div>
        <div className="intro-live__action">
          <div className="intro-live__action-icon">
            <Gift size={20} strokeWidth={1.8} />
          </div>
          <span>Tip</span>
        </div>
        <div className="intro-live__action">
          <div className="intro-live__action-icon">
            <Share2 size={20} strokeWidth={1.8} />
          </div>
          <span>Share</span>
        </div>
      </motion.div>

      {/* Bottom composer (static, non-interactive) */}
      <motion.div
        className="intro-live__bottom"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.5, ease: EASE }}
      >
        <div className="intro-live__composer">Say something nice…</div>
      </motion.div>
    </section>
  );
}
