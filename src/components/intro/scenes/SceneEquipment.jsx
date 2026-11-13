import { motion } from 'framer-motion';
import { Backpack, Camera, Headphones, Mic, Shirt, Smartphone } from 'lucide-react';
import IntroVideo from '../IntroVideo.jsx';

const EASE = [0.22, 1, 0.36, 1];

const ITEMS = [
  { icon: Camera,     title: 'GoPro Hero 12 Black',     sub: 'Action camera · 5.3K60' },
  { icon: Mic,        title: 'RODE Wireless GO II',      sub: 'Lav mic · dual channel' },
  { icon: Headphones, title: 'Sony WH-1000XM5',          sub: 'Monitoring headphones' },
  { icon: Smartphone, title: 'iPhone 15 Pro Max',        sub: 'Broadcast device' },
  { icon: Shirt,      title: 'Chef whites — Moody Rooster', sub: 'Uniform' },
];

export default function SceneEquipment({ reducedMotion }) {
  return (
    <section className="intro-equip" aria-label="Equipment reveal">
      {/* Keep the live backdrop visible but dimmed/blurred */}
      <IntroVideo
        src="/intro/povs-montage.mp4"
        poster="/intro/povs-poster.jpg"
        className="intro-equip__backdrop-video"
        loop
      />
      <div className="intro-equip__dim" />

      {/* Highlight backpack button */}
      <motion.div
        className="intro-equip__spotlight"
        initial={{ opacity: 0, scale: 0.4 }}
        animate={{ opacity: [0, 1, 0.65], scale: [0.4, 1.1, 1] }}
        transition={{ duration: reducedMotion ? 0.3 : 1.2, ease: EASE, times: [0, 0.6, 1] }}
      />
      <motion.div
        className="intro-equip__backpack-btn"
        initial={{ opacity: 0, scale: 0.6, x: 40 }}
        animate={{ opacity: 1, scale: 1, x: 0 }}
        transition={{ type: 'spring', damping: 20, stiffness: 240 }}
      >
        <motion.div
          animate={!reducedMotion ? { rotate: [0, -6, 6, -4, 0] } : {}}
          transition={{ delay: 0.6, duration: 1.2, ease: EASE }}
        >
          <Backpack size={24} strokeWidth={1.8} />
        </motion.div>
      </motion.div>

      {/* Bottom sheet */}
      <motion.div
        className="intro-equip__sheet"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        transition={{ delay: reducedMotion ? 0.2 : 1.1, type: 'spring', damping: 26, stiffness: 160 }}
      >
        <div className="intro-equip__sheet-handle" />
        <h3 className="intro-equip__sheet-title">Equipment</h3>
        <p className="intro-equip__sheet-sub">The backpack of Moody Rooster — 5 items</p>

        {ITEMS.map((item, i) => {
          const Icon = item.icon;
          return (
            <motion.div
              key={item.title}
              className="intro-equip__item"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                delay: (reducedMotion ? 0.3 : 1.35) + i * 0.09,
                duration: 0.42,
                ease: EASE,
              }}
            >
              <span className="intro-equip__item-icon">
                <Icon size={20} strokeWidth={1.8} />
              </span>
              <div className="intro-equip__item-body">
                <p className="intro-equip__item-title">{item.title}</p>
                <p className="intro-equip__item-sub">{item.sub}</p>
              </div>
            </motion.div>
          );
        })}
      </motion.div>
    </section>
  );
}
